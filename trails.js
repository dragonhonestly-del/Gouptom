/**
 * trails.js — Модуль следов за Томом в полете (пыль, искры, огонь, радуга)
 */

class TrailManager {
    constructor() {
        this.trails = [];
        this.rainbowPoints = []; // Буфер точек для радужной ленты
        this.styles = {
            dust: { id: 'dust', name: 'Каньонная пыль', icon: '💨', color: '#fde68a' },
            stars: { id: 'stars', name: 'Звёздные искры', icon: '✨', color: '#38bdf8' },
            fire: { id: 'fire', name: 'Огненный хвост', icon: '🔥', color: '#f97316' },
            rainbow: { id: 'rainbow', name: 'Радужный шлейф', icon: '🌈', color: '#ec4899' }
        };
    }

    getTrailsList(activeId) {
        return Object.values(this.styles).map(t => ({
            id: t.id,
            name: t.name,
            icon: t.icon,
            active: t.id === activeId
        }));
    }

    emit(x, y, vx, vy) {
        const activeTrailId = (window.CustomManager && window.CustomManager.selected.trails) || 'dust';
        const st = this.styles[activeTrailId] || this.styles.dust;

        // 1. Логика для неонового радужного шлейфа
        if (st.id === 'rainbow') {
            this.rainbowPoints.unshift({
                x: x,
                y: y + 20,
                alpha: 1.0
            });
            if (this.rainbowPoints.length > 16) {
                this.rainbowPoints.pop();
            }
            return;
        }

        // 2. Частицы для остальных стилей (с повышенной плотностью и сочностью)
        let count = 1;
        let color = st.color;
        let baseRadius = 3.5;
        let decayRate = 0.035;

        if (st.id === 'fire') {
            count = 2; // Огонь плотнее
            color = Math.random() < 0.6 ? '#f97316' : (Math.random() < 0.5 ? '#ef4444' : '#fde047');
            baseRadius = 4.2;
            decayRate = 0.045;
        } else if (st.id === 'stars') {
            color = Math.random() < 0.7 ? '#38bdf8' : '#ffffff';
            baseRadius = 3.2;
            decayRate = 0.028;
        }

        for (let i = 0; i < count; i++) {
            this.trails.push({
                x: x + (Math.random() - 0.5) * 12,
                y: y + 24 + (Math.random() - 0.5) * 8,
                vx: -vx * 0.15 + (Math.random() - 0.5) * 1.5,
                vy: -vy * 0.15 + (Math.random() - 0.5) * 1.5,
                radius: baseRadius + Math.random() * 3.0,
                color: color,
                alpha: 1.0,
                decay: decayRate,
                isStar: st.id === 'stars'
            });
        }
    }

    update(deltaFactor = 1.0) {
        // Обновление стандартных частиц
        for (let i = this.trails.length - 1; i >= 0; i--) {
            const t = this.trails[i];
            t.x += t.vx * deltaFactor;
            t.y += t.vy * deltaFactor;
            t.alpha -= t.decay * deltaFactor;
            if (t.alpha <= 0) this.trails.splice(i, 1);
        }

        // Затухание точек радужной ленты
        for (let i = this.rainbowPoints.length - 1; i >= 0; i--) {
            const pt = this.rainbowPoints[i];
            pt.alpha -= 0.06 * deltaFactor;
            if (pt.alpha <= 0) this.rainbowPoints.splice(i, 1);
        }
    }

    draw(ctx) {
        ctx.save();

        // 1. Отрисовка радужной ленты
        if (this.rainbowPoints.length >= 2) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (let i = 0; i < this.rainbowPoints.length - 1; i++) {
                const p1 = this.rainbowPoints[i];
                const p2 = this.rainbowPoints[i + 1];
                const progress = i / this.rainbowPoints.length;

                ctx.globalAlpha = Math.max(0, p1.alpha * 0.85);
                ctx.lineWidth = Math.max(2, 22 * (1 - progress));

                // Неоновый спектр перелива
                const hue = (performance.now() * 0.35 + i * 25) % 360;
                ctx.strokeStyle = `hsl(${hue}, 100%, 65%)`;

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }

        // 2. Отрисовка частиц (пыль, огонь, искры)
        for (let i = 0; i < this.trails.length; i++) {
            const t = this.trails[i];
            ctx.globalAlpha = Math.max(0, t.alpha);
            ctx.fillStyle = t.color;

            if (t.isStar) {
                // Маленький ромбик для искр
                ctx.beginPath();
                ctx.moveTo(t.x, t.y - t.radius * 1.3);
                ctx.lineTo(t.x + t.radius * 1.3, t.y);
                ctx.lineTo(t.x, t.y + t.radius * 1.3);
                ctx.lineTo(t.x - t.radius * 1.3, t.y);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}

window.TrailEngine = new TrailManager();
