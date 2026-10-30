/**
 * skins.js — Главный реестр кастомизации и отрисовщик Тома
 * Управляет:
 *  - Гардеробом (костюмы, шляпы, аксессуары)
 *  - Связкой с плитками (pins), фонами (bg) и следами (trails)
 *  - Сохранением выбора в память (localStorage)
 */

class CustomizationManager {
    constructor() {
        // Текущий выбор игрока
        this.selected = {
            skin: localStorage.getItem('tom_skin') || 'classic',
            pin: localStorage.getItem('tom_pin') || 'canyon_paw',
            bg: localStorage.getItem('tom_bg') || 'canyon',
            trail: localStorage.getItem('tom_trail') || 'dust'
        };

        // Реестр скинов и одежды Тома
        this.skins = {
            classic: {
                id: 'classic',
                name: 'Классик',
                icon: '🐱',
                price: 0,
                furGrad: ['#a39f99', '#7f7a75', '#5c5853'],
                bellyColor: '#e5e5e5',
                eyeColor: ['#4ade80', '#16a34a', '#14532d'],
                hat: null,
                accessory: null
            },
            cowboy: {
                id: 'cowboy',
                name: 'Шериф',
                icon: '🤠',
                price: 500,
                furGrad: ['#b59a79', '#8c6e4e', '#5a4128'],
                bellyColor: '#fde68a',
                eyeColor: ['#38bdf8', '#0284c7', '#0c4a6e'],
                hat: 'cowboy_hat',
                accessory: 'bandana'
            },
            cyber: {
                id: 'cyber',
                name: 'Неон 2077',
                icon: '🤖',
                price: 1500,
                furGrad: ['#475569', '#1e293b', '#0f172a'],
                bellyColor: '#38bdf8',
                eyeColor: ['#f43f5e', '#e11d48', '#881337'],
                hat: 'cyber_visor',
                accessory: null
            },
            gold: {
                id: 'gold',
                name: 'Золотой VIP',
                icon: '👑',
                price: 5000,
                furGrad: ['#fef08a', '#facc15', '#ca8a04'],
                bellyColor: '#fffbeb',
                eyeColor: ['#a855f7', '#7e22ce', '#3b0764'],
                hat: 'crown',
                accessory: 'cape'
            }
        };
    }

    // Получить список для отображения в табах меню
    getItems(tabKey) {
        if (tabKey === 'skins') {
            return Object.values(this.skins).map(s => ({
                id: s.id,
                name: s.name,
                icon: s.icon,
                active: this.selected.skin === s.id
            }));
        }
        if (tabKey === 'pins' && window.Pins) {
            return window.Pins.getStylesList(this.selected.pin);
        }
        if (tabKey === 'bg' && window.BackgroundEngine) {
            return window.BackgroundEngine.getBiomesList(this.selected.bg);
        }
        if (tabKey === 'trails' && window.TrailEngine) {
            return window.TrailEngine.getTrailsList(this.selected.trail);
        }
        return [];
    }

    // Выбрать предмет в гардеробе
    select(category, id) {
        if (category === 'skins' && this.skins[id]) {
            this.selected.skin = id;
            localStorage.setItem('tom_skin', id);
        } else if (category === 'pins') {
            this.selected.pin = id;
            localStorage.setItem('tom_pin', id);
        } else if (category === 'bg') {
            this.selected.bg = id;
            localStorage.setItem('tom_bg', id);
        } else if (category === 'trails') {
            this.selected.trail = id;
            localStorage.setItem('tom_trail', id);
        }
    }

    getCurrentSkin() {
        return this.skins[this.selected.skin] || this.skins.classic;
    }

    /* =========================================================================
     *  ОТРИСОВКА ТОМА С УЧЕТОМ ТЕКУЩЕГО СКИНА И ОДЕЖДЫ
     * ========================================================================= */
    drawTom(ctx, charObj, isGhost = false, gameTime = 0, drag = null) {
        ctx.save();
        if (isGhost) ctx.globalAlpha = 0.45;

        const skin = this.getCurrentSkin();
        const pinX = isGhost ? charObj.pinX : (charObj.attachedPin ? charObj.attachedPin.x : charObj.x);
        const pinY = isGhost ? charObj.pinY : (charObj.attachedPin ? charObj.attachedPin.y : charObj.y - 78);

        // 1. Руки-резинки при зацепе
        if (charObj.state === 'STUCK' && (isGhost || charObj.attachedPin)) {
            const stretchDist = Math.hypot(charObj.x - pinX, charObj.y - pinY);
            const armWidth = Math.max(6, 11 - (stretchDist - 70) * 0.035);

            // Тень рук
            ctx.strokeStyle = 'rgba(105, 58, 18, 0.28)';
            ctx.lineWidth = armWidth + 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(pinX - 10 + 6, pinY + 18 + 6); ctx.lineTo(charObj.x - 13 + 6, charObj.y - 18 + 6);
            ctx.moveTo(pinX + 10 + 6, pinY + 18 + 6); ctx.lineTo(charObj.x + 13 + 6, charObj.y - 18 + 6);
            ctx.stroke();

            // Контур рук
            ctx.strokeStyle = '#2d2926';
            ctx.lineWidth = armWidth + 4;
            ctx.beginPath();
            ctx.moveTo(pinX - 10, pinY + 18); ctx.lineTo(charObj.x - 13, charObj.y - 18);
            ctx.moveTo(pinX + 10, pinY + 18); ctx.lineTo(charObj.x + 13, charObj.y - 18);
            ctx.stroke();

            // Цвет шерсти рук из текущего скина
            ctx.strokeStyle = skin.furGrad[1];
            ctx.lineWidth = armWidth;
            ctx.beginPath();
            ctx.moveTo(pinX - 10, pinY + 18); ctx.lineTo(charObj.x - 13, charObj.y - 18);
            ctx.moveTo(pinX + 10, pinY + 18); ctx.lineTo(charObj.x + 13, charObj.y - 18);
            ctx.stroke();
        }

        ctx.translate(charObj.x, charObj.y);

        let rot = 0, sx = charObj.jellyX || 1, sy = charObj.jellyY || 1;
        if (!isGhost && charObj.state === 'STUCK' && charObj.attachedPin) {
            rot = -charObj.swingAngle * 0.45;
            if (drag && drag.active) {
                const ratio = drag.pullRatio || 0;
                sx *= (1 - ratio * 0.14);
                sy *= (1 + ratio * 0.18);
            }
        } else if (charObj.state === 'FLYING') {
            const spd = Math.hypot(charObj.vx || 0, charObj.vy || 0);
            if (spd > 2.5) {
                rot = Math.atan2(charObj.vy, charObj.vx) + Math.PI / 2;
                const stretch = Math.min(0.24, spd * 0.012);
                sy *= (1 + stretch);
                sx *= (1 - stretch * 0.5);
            }
        } else if (charObj.state === 'DEAD') {
            rot = gameTime * 0.18;
        }

        ctx.rotate(rot);
        ctx.scale(sx, sy);

        // Тень тела
        ctx.fillStyle = 'rgba(105, 58, 18, 0.3)';
        ctx.beginPath();
        ctx.arc(6, 12, 34, 0, Math.PI * 2);
        ctx.fill();

        // Защитный щит-магнит
        if (charObj.hasShield) {
            ctx.save();
            ctx.strokeStyle = '#1e1b18'; ctx.lineWidth = 18;
            ctx.beginPath(); ctx.arc(0, 12, 36, -Math.PI * 0.15, Math.PI * 1.15); ctx.stroke();
            ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 12;
            ctx.beginPath(); ctx.arc(0, 12, 36, -Math.PI * 0.15, Math.PI * 1.15); ctx.stroke();
            ctx.restore();
        }

        // Тело Тома
        ctx.save();
        ctx.fillStyle = skin.furGrad[1];
        ctx.strokeStyle = '#2d2926';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 26, 18, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Животик
        ctx.fillStyle = skin.bellyColor;
        ctx.beginPath();
        ctx.ellipse(0, 24, 11, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Лапки
        ctx.fillStyle = skin.furGrad[1];
        ctx.beginPath();
        ctx.ellipse(-7, 40, 6.5, 8, 0.1, 0, Math.PI * 2);
        ctx.ellipse(7, 40, 6.5, 8, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Ушки
        [-1, 1].forEach(dir => {
            ctx.save();
            ctx.translate(dir * 20, -20);
            ctx.rotate(dir * 0.35);
            ctx.fillStyle = skin.furGrad[0];
            ctx.strokeStyle = '#2d2926';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-11, 7);
            ctx.quadraticCurveTo(0, -17, 11, 7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#f472b6';
            ctx.beginPath();
            ctx.moveTo(-6, 5);
            ctx.quadraticCurveTo(0, -11, 6, 5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });

        // Голова Тома
        const headGrad = ctx.createRadialGradient(-7, -9, 5, 0, 0, 34);
        headGrad.addColorStop(0, skin.furGrad[0]);
        headGrad.addColorStop(0.65, skin.furGrad[1]);
        headGrad.addColorStop(1, skin.furGrad[2]);
        ctx.fillStyle = headGrad;
        ctx.strokeStyle = '#2d2926';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.ellipse(0, -2, 33, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Полоски на щеках
        ctx.fillStyle = '#3f3b37';
        [-1, 1].forEach(dir => {
            ctx.save();
            ctx.translate(dir * 27, 2);
            ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.2, dir * -0.2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.translate(dir * 24, 9);
            ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.2, dir * -0.35, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });

        // Белые брови и мордочка
        ctx.fillStyle = '#e7e5e4';
        ctx.beginPath();
        ctx.ellipse(-11, -15, 5.5, 2.2, -0.2, 0, Math.PI * 2);
        ctx.ellipse(11, -15, 5.5, 2.2, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, 8, 14, 10, 0, 0, Math.PI * 2); ctx.fill();

        // Глаза
        const isBlinking = !isGhost && charObj.blinkTimer < 0;
        [-11, 11].forEach(ex => {
            ctx.save();
            ctx.translate(ex, -4);
            if (charObj.state === 'DEAD') {
                ctx.strokeStyle = '#1e1b18'; ctx.lineWidth = 3.2;
                ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke();
            } else if (isBlinking) {
                ctx.strokeStyle = '#2d2926'; ctx.lineWidth = 3.2;
                ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(0, 4, 6, 0); ctx.stroke();
            } else {
                ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2d2926'; ctx.lineWidth = 2.4;
                ctx.beginPath(); ctx.ellipse(0, 0, 8, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

                const lx = Math.max(-2.2, Math.min(2.2, charObj.lookX || 0));
                const ly = Math.max(-2.2, Math.min(2.2, charObj.lookY || 0));

                const irisGrad = ctx.createRadialGradient(lx, ly - 2, 1, lx, ly, 6);
                irisGrad.addColorStop(0, skin.eyeColor[0]);
                irisGrad.addColorStop(0.7, skin.eyeColor[1]);
                irisGrad.addColorStop(1, skin.eyeColor[2]);
                ctx.fillStyle = irisGrad;
                ctx.beginPath(); ctx.arc(lx, ly, 5.8, 0, Math.PI * 2); ctx.fill();

                ctx.fillStyle = '#09090b';
                ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(lx - 1.8, ly - 2.2, 1.8, 0, Math.PI * 2);
                ctx.arc(lx + 1.6, ly + 1.6, 0.9, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        });

        // Носик и ротик
        const noseGrad = ctx.createLinearGradient(0, 2, 0, 8.5);
        noseGrad.addColorStop(0, '#fb7185'); noseGrad.addColorStop(1, '#e11d48');
        ctx.fillStyle = noseGrad;
        ctx.beginPath();
        ctx.moveTo(-5, 4); ctx.quadraticCurveTo(0, 2.5, 5, 4); ctx.quadraticCurveTo(0, 9.5, 0, 8.5);
        ctx.closePath(); ctx.fill();

        ctx.strokeStyle = '#3f3b37'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-6, 11); ctx.quadraticCurveTo(0, 14.5, 6, 11); ctx.stroke();

        // 2. ОДЕЖДА И АКСЕССУАРЫ СКИНА
        this.drawClothing(ctx, skin);

        ctx.restore();
    }

    // Отрисовка головных уборов и одежды
    drawClothing(ctx, skin) {
        // Ковбойская шляпа и бандана
        if (skin.hat === 'cowboy_hat') {
            ctx.save();
            ctx.fillStyle = '#78350f';
            ctx.strokeStyle = '#2b1608';
            ctx.lineWidth = 2.8;
            // Поля шляпы
            ctx.beginPath(); ctx.ellipse(0, -26, 38, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            // Тулья
            ctx.beginPath(); ctx.roundRect(-16, -45, 32, 22, [8, 8, 2, 2]); ctx.fill(); ctx.stroke();
            // Ремешок со звездочкой
            ctx.fillStyle = '#b45309'; ctx.fillRect(-16, -28, 32, 5);
            ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(0, -25.5, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        if (skin.accessory === 'bandana') {
            ctx.save();
            ctx.fillStyle = '#dc2626';
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-16, 16); ctx.lineTo(16, 16); ctx.lineTo(0, 28); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        // Кибер-очки
        if (skin.hat === 'cyber_visor') {
            ctx.save();
            ctx.fillStyle = '#06b6d4';
            ctx.strokeStyle = '#0891b2';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.roundRect(-22, -9, 44, 11, 4); ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        // Корона
        if (skin.hat === 'crown') {
            ctx.save();
            ctx.fillStyle = '#facc15';
            ctx.strokeStyle = '#854d0e';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-16, -26); ctx.lineTo(-18, -40); ctx.lineTo(-8, -32);
            ctx.lineTo(0, -44); ctx.lineTo(8, -32); ctx.lineTo(18, -40);
            ctx.lineTo(16, -26); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }
    }
}

window.CustomManager = new CustomizationManager();
