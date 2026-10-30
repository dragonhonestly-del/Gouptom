/**
 * trails.js — Модуль следов за Томом в полете (пыль, искры, радуга)
 */

class TrailManager {
    constructor() {
        this.trails = [];
        this.styles = {
            dust: { id: 'dust', name: 'Каньонная пыль', icon: '💨', color: '#fde68a' },
            stars: { id: 'stars', name: 'Звёздные искры', icon: '✨', color: '#38bdf8' },
            fire: { id: 'fire', name: 'Огненный хвост', icon: '🔥', color: '#f97316' }
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

    // Добавление частицы следа в полете
    emit(x, y, vx, vy) {
        const activeTrailId = (window.CustomManager && window.CustomManager.selected.trail) || 'dust';
        const st = this.styles[activeTrailId] || this.styles.dust;

        this.trails.push({
            x: x + (Math.random() - 0.5) * 12,
            y: y + 24 + (Math.random() - 0.5) * 8,
            vx: -vx * 0.15 + (Math.random() - 0.5) * 1.5,
            vy: -vy * 0.15 + (Math.random() - 0.5) * 1.5,
            radius: 3 + Math.random() * 3.5,
            color: st.color,
            alpha: 0.85,
            decay: 0.035
        });
    }

    update(deltaFactor = 1.0) {
        for (let i = this.trails.length - 1; i >= 0; i--) {
            const t = this.trails[i];
            t.x += t.vx * deltaFactor;
            t.y += t.vy * deltaFactor;
            t.alpha -= t.decay * deltaFactor;
            if (t.alpha <= 0) this.trails.splice(i, 1);
        }
    }

    draw(ctx) {
        ctx.save();
        for (let i = 0; i < this.trails.length; i++) {
            const t = this.trails[i];
            ctx.globalAlpha = Math.max(0, t.alpha);
            ctx.fillStyle = t.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

window.TrailEngine = new TrailManager();
