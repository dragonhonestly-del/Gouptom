/**
 * background.js — Отрисовка биомов, каменной кладки, лучей и пылинок
 */

class BackgroundEngine {
    constructor() {
        this.canyonStones = [];
        this.wallRocks = [];
        this.dustMotes = [];
        this.biomes = {
            canyon: { id: 'canyon', name: 'Песчаный каньон', icon: '🏜️', topCol: '#fff3d1', midCol: '#fde09b', botCol: '#f7c978' },
            night: { id: 'night', name: 'Лунная долина', icon: '🌌', topCol: '#334155', midCol: '#1e293b', botCol: '#0f172a' },
            jungle: { id: 'jungle', name: 'Джунгли', icon: '🌴', topCol: '#dcfce7', midCol: '#86efac', botCol: '#22c55e' }
        };
    }

    getBiomesList(activeId) {
        return Object.values(this.biomes).map(b => ({
            id: b.id,
            name: b.name,
            icon: b.icon,
            active: b.id === activeId
        }));
    }

    init(W, H, WALL_W) {
        this.canyonStones = []; this.wallRocks = []; this.dustMotes = [];
        for (let i = 0; i < 36; i++) {
            this.canyonStones.push({
                x: WALL_W + 20 + Math.random() * (W - WALL_W * 2 - 80),
                y: Math.random() * 1600,
                w: 60 + Math.random() * 70,
                h: 36 + Math.random() * 40,
                shade: Math.random() > 0.5 ? '#f5c77e' : '#f2be6f',
                hasGrass: Math.random() < 0.28
            });
        }
        for (let y = 0; y < 1600; y += 48) {
            this.wallRocks.push({
                y: y,
                leftW: WALL_W - 4 + Math.random() * 6,
                rightW: WALL_W - 4 + Math.random() * 6,
                hasFlowerLeft: Math.random() < 0.16,
                hasFlowerRight: Math.random() < 0.16
            });
        }
        for (let i = 0; i < 28; i++) {
            this.dustMotes.push({
                x: Math.random() * W, y: Math.random() * H,
                r: 1.8 + Math.random() * 2.8,
                vy: -0.25 - Math.random() * 0.35,
                vx: 0.15 + Math.random() * 0.25,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    updateDust(W, H, gameTime) {
        this.dustMotes.forEach(m => {
            m.x += m.vx + Math.sin(gameTime * 0.02 + m.phase) * 0.15;
            m.y += m.vy;
            if (m.y < -10) m.y = H + 10;
            if (m.x > W + 10) m.x = -10;
        });
    }

    draw(ctx, W, H, WALL_W, cameraY, gameTime) {
        const activeBgId = (window.CustomManager && window.CustomManager.selected.bg) || 'canyon';
        const biome = this.biomes[activeBgId] || this.biomes.canyon;

        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, biome.topCol);
        bgGrad.addColorStop(0.45, biome.midCol);
        bgGrad.addColorStop(1, biome.botCol);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        const wrapH = 1600;
        this.canyonStones.forEach(st => {
            let sy = (st.y - cameraY * 0.65) % wrapH;
            if (sy < -120) sy += wrapH;
            ctx.fillStyle = st.shade; ctx.strokeStyle = '#eab364'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(st.x, sy, st.w, st.h, 8); ctx.fill(); ctx.stroke();
        });
        ctx.restore();

        // Стены каньона
        ctx.save();
        this.wallRocks.forEach(wr => {
            let wy = (wr.y - cameraY) % wrapH;
            if (wy < -60) wy += wrapH;
            ctx.fillStyle = '#e5a95c'; ctx.strokeStyle = '#9c5a25'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.roundRect(-8, wy, wr.leftW + 8, 48, 10); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.roundRect(W - wr.rightW, wy, wr.rightW + 8, 48, 10); ctx.fill(); ctx.stroke();
        });

        // Солнечные лучи и пылинки
        this.dustMotes.forEach(m => {
            const glow = 0.35 + Math.sin(gameTime * 0.05 + m.phase) * 0.25;
            ctx.fillStyle = `rgba(255, 252, 220, ${glow})`;
            ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
    }
}

window.BackgroundEngine = new BackgroundEngine();
