/**
 * pins.js — Модуль плиток-зацепов
 * Управляет логикой синих, рельсовых, красных плиток и их кастомными стилями
 */

class PinManager {
    constructor() {
        this.pins = [];
        this.styles = {
            canyon_paw: { id: 'canyon_paw', name: 'Лапка Каньона', icon: '🐾', innerColor: '#60a5fa', pawColor: '#1d4ed8' },
            gold: { id: 'gold', name: 'Золотая Звезда', icon: '⭐', innerColor: '#facc15', pawColor: '#854d0e' },
            emerald: { id: 'emerald', name: 'Изумруд', icon: '💎', innerColor: '#34d399', pawColor: '#065f46' }
        };
    }

    getStylesList(activeId) {
        return Object.values(this.styles).map(st => ({
            id: st.id,
            name: st.name,
            icon: st.icon,
            active: st.id === activeId
        }));
    }

    createPin(x, y, type = 'blue', railSpan = 110, rng = Math.random) {
        return {
            x, y, baseX: x, baseY: y, size: 56, catchRadius: 46, type,
            visited: false, holdTimer: 0, maxHoldTime: 95, broken: false, respawnTimer: 0,
            railSpan, railPhase: rng() * Math.PI * 2, railSpeed: 0.022 + rng() * 0.012, pulseAnim: 0
        };
    }

    update(pins, tom, deltaFactor = 1.0, onRedBreak) {
        for (let i = 0; i < pins.length; i++) {
            const p = pins[i];
            if (p.pulseAnim > 0) p.pulseAnim = Math.max(0, p.pulseAnim - 0.06 * deltaFactor);

            if (p.type === 'rail_v') {
                p.railPhase += p.railSpeed * deltaFactor;
                p.y = p.baseY + Math.sin(p.railPhase) * (p.railSpan / 2);
            } else if (p.type === 'rail_h') {
                p.railPhase += p.railSpeed * deltaFactor;
                p.x = p.baseX + Math.sin(p.railPhase) * (p.railSpan / 2);
            } else if (p.type === 'red') {
                if (p.broken) {
                    p.respawnTimer -= deltaFactor;
                    if (p.respawnTimer <= 0) { p.broken = false; p.holdTimer = 0; }
                } else if (tom.state === 'STUCK' && tom.attachedPin === p) {
                    p.holdTimer += deltaFactor;
                    if (p.holdTimer >= p.maxHoldTime) {
                        p.broken = true;
                        p.respawnTimer = 180;
                        onRedBreak(p);
                    }
                } else {
                    p.holdTimer = Math.max(0, p.holdTimer - 1 * deltaFactor);
                }
            }
        }
    }

    draw(ctx, p, tom) {
        ctx.save();
        const activeStyleId = (window.CustomManager && window.CustomManager.selected.pin) || 'canyon_paw';
        const st = this.styles[activeStyleId] || this.styles.canyon_paw;

        if (p.type === 'rail_v' || p.type === 'rail_h') {
            ctx.save();
            ctx.strokeStyle = '#5c4028'; ctx.lineWidth = 10; ctx.lineCap = 'round';
            ctx.beginPath();
            if (p.type === 'rail_v') {
                ctx.moveTo(p.baseX, p.baseY - p.railSpan / 2 - 18);
                ctx.lineTo(p.baseX, p.baseY + p.railSpan / 2 + 18);
            } else {
                ctx.moveTo(p.baseX - p.railSpan / 2 - 18, p.baseY);
                ctx.lineTo(p.baseX + p.railSpan / 2 + 18, p.baseY);
            }
            ctx.stroke();
            ctx.strokeStyle = '#b08d6a'; ctx.lineWidth = 4; ctx.stroke();
            ctx.restore();
        }

        if (p.type === 'red' && p.broken) {
            ctx.strokeStyle = 'rgba(185, 28, 28, 0.35)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 3;
            ctx.strokeRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            ctx.restore();
            return;
        }

        let shakeX = 0, shakeY = 0;
        if (p.type === 'red' && p.holdTimer > 0) {
            const shk = (p.holdTimer / p.maxHoldTime) * 5;
            shakeX = (Math.random() - 0.5) * shk;
            shakeY = (Math.random() - 0.5) * shk;
        }

        const isAttached = (tom.state === 'STUCK' && tom.attachedPin === p);
        const scale = 1 + Math.sin(p.pulseAnim * Math.PI) * 0.14;
        ctx.translate(p.x + shakeX, p.y + shakeY);
        ctx.scale(scale, scale);

        const half = p.size / 2;
        ctx.fillStyle = 'rgba(105, 58, 18, 0.35)';
        ctx.beginPath(); ctx.roundRect(-half + 4, -half + 7, p.size, p.size, 12); ctx.fill();

        const frameGrad = ctx.createLinearGradient(0, -half, 0, half);
        if (isAttached) { frameGrad.addColorStop(0, '#ffffff'); frameGrad.addColorStop(1, '#bae6fd'); }
        else { frameGrad.addColorStop(0, '#eac4a0'); frameGrad.addColorStop(0.5, '#bd814f'); frameGrad.addColorStop(1, '#814720'); }
        ctx.fillStyle = frameGrad; ctx.strokeStyle = '#2b1608'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.roundRect(-half, -half, p.size, p.size, 10); ctx.fill(); ctx.stroke();

        const innerHalf = half - 7;
        const innerGrad = ctx.createLinearGradient(0, -innerHalf, 0, innerHalf);
        if (p.type === 'red') {
            const flash = p.holdTimer > 35 && Math.floor(p.holdTimer / 4) % 2 === 0;
            innerGrad.addColorStop(0, flash ? '#fecdd3' : '#fb7185'); innerGrad.addColorStop(1, '#e11d48');
        } else if (isAttached) {
            innerGrad.addColorStop(0, '#e0f2fe'); innerGrad.addColorStop(0.4, '#7dd3fc'); innerGrad.addColorStop(1, '#0284c7');
        } else {
            innerGrad.addColorStop(0, st.innerColor); innerGrad.addColorStop(1, '#1d4ed8');
        }
        ctx.fillStyle = innerGrad; ctx.strokeStyle = isAttached ? '#ffffff' : '#1e3a8a'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.roundRect(-innerHalf, -innerHalf, innerHalf * 2, innerHalf * 2, 6); ctx.fill(); ctx.stroke();

        ctx.fillStyle = p.type === 'red' ? '#881337' : (isAttached ? '#0284c7' : st.pawColor);
        ctx.beginPath(); ctx.ellipse(0, 4, 8, 6.5, 0, 0, Math.PI * 2); ctx.fill();
        [{ x: -9, y: -4, r: 3.3 }, { x: -3.5, y: -8, r: 3.5 }, { x: 3.5, y: -8, r: 3.5 }, { x: 9, y: -4, r: 3.3 }].forEach(toe => {
            ctx.beginPath(); ctx.arc(toe.x, toe.y, toe.r, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
    }
}

window.Pins = new PinManager();
