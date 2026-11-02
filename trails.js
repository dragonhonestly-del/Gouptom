/**
 * trails.js — Модуль следов за Томом в полете (пыль, искры, огонь, неоновая радуга)
 */

class TrailManager {
    constructor() {
        this.trails = [];         // Для обычных частиц (пыль, огонь, звезды)
        this.ribbonPoints = [];   // Для сплошного хвоста (радуга)
        
        this.styles = {
            dust: { id: 'dust', name: 'Каньонная пыль', icon: '💨', type: 'particle', color: '#fde68a' },
            stars: { id: 'stars', name: 'Звёздные искры', icon: '✨', type: 'particle', color: '#38bdf8' },
            fire: { id: 'fire', name: 'Огненный хвост', icon: '🔥', type: 'particle', color: '#f97316' },
            rainbow: { id: 'rainbow', name: 'Неоновая радуга', icon: '🌈', type: 'ribbon' }
        };
    }

    clear() {
        this.trails = [];
        this.ribbonPoints = [];
    }

    getTrailsList(activeId) {
        return Object.values(this.styles).map(t => ({
            id: t.id,
            name: t.name,
            icon: t.icon,
            active: t.id === activeId
        }));
    }

    // Добавление частицы/точки следа каждый кадр полета
    emit(x, y, vx, vy) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        // Поддержка обоих вариантов ключа (trails и trail) из CustomManager
        const sel = (window.CustomManager && window.CustomManager.selected) || {};
        const activeTrailId = sel.trails || sel.trail || 'dust';
        const st = this.styles[activeTrailId] || this.styles.dust;

        if (st.type === 'particle') {
            let r = 3 + Math.random() * 3.5;
            let dec = 0.035;
            
            if (st.id === 'stars') { r = 4 + Math.random() * 4.5; dec = 0.02; }
            if (st.id === 'fire') { r = 5.5 + Math.random() * 6; dec = 0.025; }

            this.trails.push({
                x: x + (Math.random() - 0.5) * 16,
                y: y + 24 + (Math.random() - 0.5) * 12,
                vx: (-vx || 0) * 0.15 + (Math.random() - 0.5) * 1.5,
                vy: (-vy || 0) * 0.15 + (Math.random() - 0.5) * 1.5,
                radius: r,
                color: st.color,
                alpha: 1.0,
                decay: dec
            });
        } 
        else if (st.type === 'ribbon') {
            this.ribbonPoints.unshift({ x: x, y: y + 15, alpha: 1 });
            if (this.ribbonPoints.length > 18) {
                this.ribbonPoints.pop();
            }
        }
    }

    update(deltaFactor = 1.0) {
        const dt = Number.isFinite(deltaFactor) ? deltaFactor : 1.0;

        for (let i = this.trails.length - 1; i >= 0; i--) {
            const t = this.trails[i];
            t.x += t.vx * dt;
            t.y += t.vy * dt;
            t.alpha -= t.decay * dt;
            if (t.alpha <= 0) this.trails.splice(i, 1);
        }

        for (let i = this.ribbonPoints.length - 1; i >= 0; i--) {
            this.ribbonPoints[i].alpha -= 0.04 * dt;
            if (this.ribbonPoints[i].alpha <= 0) {
                this.ribbonPoints.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        
        // 1. Отрисовка частиц (пыль, звезды, огонь)
        for (let i = 0; i < this.trails.length; i++) {
            const t = this.trails[i];
            if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
            ctx.globalAlpha = Math.max(0, Math.min(1, t.alpha));
            ctx.fillStyle = t.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Отрисовка сплошного неонового хвоста (радуга)
        if (this.ribbonPoints.length > 1) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 10;
            
            for (let i = 0; i < this.ribbonPoints.length - 1; i++) {
                const p1 = this.ribbonPoints[i];
                const p2 = this.ribbonPoints[i + 1];
                if (!Number.isFinite(p1.x) || !Number.isFinite(p1.y) || !Number.isFinite(p2.x) || !Number.isFinite(p2.y)) continue;
                
                ctx.globalAlpha = Math.max(0, Math.min(1, p1.alpha * 0.75));
                ctx.lineWidth = Math.max(1, 26 * (1 - i / this.ribbonPoints.length)); 
                
                const hue = Math.floor((i * 25 + Date.now() * 0.15) % 360); 
                const color = `hsl(${hue}, 100%, 60%)`;
                
                ctx.strokeStyle = color;
                ctx.shadowColor = color;
                
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }
}

window.TrailEngine = new TrailManager();
