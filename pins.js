/**
 * pins.js — Модуль плиток-зацепов
 * Управляет логикой платформ и рендерит скины (Каньон / Нянкэт)
 */

class PinManager {
    constructor() {
        this.pins = [];
        this.styles = {
            canyon_paw: { id: 'canyon_paw', name: 'Лапка Каньона', icon: '🐾', innerColor: '#60a5fa', pawColor: '#1d4ed8' },
            nyan_paw: { id: 'nyan_paw', name: 'Нянкэт', icon: '🌈' } // Заменили фейки на реальный скин
        };

        // Подготовка текстуры Нянкэта
        this.nyanImage = new Image();
        this.isNyanLoaded = false;
        this.initNyanTexture();
    }

    initNyanTexture() {
        const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
          <defs>
            <linearGradient id="outerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#e3ccff"/><stop offset="40%" stop-color="#b8cbff"/>
              <stop offset="70%" stop-color="#9cb1ff"/><stop offset="100%" stop-color="#dca2ff"/>
            </linearGradient>
            <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff41b3"/><stop offset="25%" stop-color="#ff527b"/>
              <stop offset="45%" stop-color="#ffda3e"/><stop offset="65%" stop-color="#2eff9c"/>
              <stop offset="85%" stop-color="#00bfff"/><stop offset="100%" stop-color="#6a0dad"/>
            </linearGradient>
            <linearGradient id="pawGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#ffffff"/><stop offset="25%" stop-color="#b3c2ff"/>
              <stop offset="55%" stop-color="#927eff"/><stop offset="100%" stop-color="#ff46b0"/>
            </linearGradient>
            <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur1"/>
              <feGaussianBlur stdDeviation="12" result="blur2"/>
              <feMerge><feMergeNode in="blur2"/><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="sparkleGlow">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <g id="sparkleShape"><path d="M 0,-15 Q 0,0 15,0 Q 0,0 0,15 Q 0,0 -15,0 Q 0,0 0,-15 Z" fill="#ffffff" filter="url(#sparkleGlow)"/></g>
          </defs>
          <use href="#sparkleShape" x="45" y="110" transform="rotate(-15, 45, 110) scale(1.1)"/>
          <use href="#sparkleShape" x="255" y="45" transform="rotate(15, 255, 45) scale(1.3)"/>
          <circle cx="160" cy="22" r="2.5" fill="#ffffff" opacity="0.9"/>
          <rect x="35" y="35" width="250" height="250" rx="68" ry="68" fill="url(#outerGrad)" stroke="#231b54" stroke-width="7"/>
          <rect x="42" y="42" width="236" height="236" rx="55" ry="55" fill="none" stroke="#4a3e91" stroke-width="4.5"/>
          <rect x="52" y="52" width="216" height="216" rx="42" ry="42" fill="url(#rainbowGrad)" stroke="#231b54" stroke-width="6"/>
          <use href="#sparkleShape" x="120" y="85" transform="scale(0.75)"/>
          <circle cx="75" cy="145" r="3" fill="#ffffff" opacity="0.8"/>
          <circle cx="235" cy="185" r="3.5" fill="#ffffff" opacity="0.6"/>
          <g filter="url(#neonGlow)">
            <ellipse cx="102" cy="148" rx="14" ry="18" fill="url(#pawGrad)" stroke="#231b54" stroke-width="5"/>
            <ellipse cx="134" cy="125" rx="15" ry="20" fill="url(#pawGrad)" stroke="#231b54" stroke-width="5"/>
            <ellipse cx="186" cy="125" rx="15" ry="20" fill="url(#pawGrad)" stroke="#231b54" stroke-width="5"/>
            <ellipse cx="218" cy="148" rx="14" ry="18" fill="url(#pawGrad)" stroke="#231b54" stroke-width="5"/>
            <path d="M 125,190 C 125,160 195,160 195,190 C 195,215 180,225 160,225 C 140,225 125,215 125,190 Z" fill="url(#pawGrad)" stroke="#231b54" stroke-width="5.5" stroke-linejoin="round"/>
          </g>
          <use href="#sparkleShape" x="250" y="235" transform="rotate(10, 250, 235) scale(0.7)"/>
        </svg>`;
        
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        this.nyanImage.onload = () => {
            this.isNyanLoaded = true;
            URL.revokeObjectURL(url);
        };
        this.nyanImage.src = url;
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
        const activeStyleId = (window.CustomManager && window.CustomManager.selected.pins) || 'canyon_paw';
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

        // Отрисовка скина Нянкэта (Только для синих/безопасных плиток)
        if (st.id === 'nyan_paw' && p.type !== 'red' && this.isNyanLoaded) {
            // Компенсируем отступы SVG, чтобы физический размер кнопки совпадал с каньонной
            const drawSize = p.size * 1.25; 
            const offset = drawSize / 2;
            
            // Тень под плиткой
            ctx.fillStyle = 'rgba(105, 58, 18, 0.35)';
            ctx.beginPath(); ctx.roundRect(-offset + 8, -offset + 10, drawSize * 0.86, drawSize * 0.86, 12); ctx.fill();
            
            ctx.drawImage(this.nyanImage, -offset, -offset, drawSize, drawSize);

            // Подсветка при зацепе
            if (isAttached) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.beginPath(); ctx.roundRect(-offset * 0.86, -offset * 0.86, drawSize * 0.86, drawSize * 0.86, 15); ctx.fill();
            }
        } 
        // Стандартная отрисовка (Лапка Каньона + всегда для Красных плиток)
        else {
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
        }
        ctx.restore();
    }
}

window.Pins = new PinManager();
