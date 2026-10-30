/**
 * model.js — Модуль анатомии, анимации и отрисовки Говорящего Тома
 * Принимает координаты, состояние персонажа и визуальный конфиг скина из skins.js
 */

(function () {
    class TomModelEngine {
        /**
         * Главная функция отрисовки персонажа
         * @param {CanvasRenderingContext2D} ctx 
         * @param {Object} charObj — объект Тома или оппонента (x, y, jellyX, state, etc.)
         * @param {Object} skinConfig — цвета шерсти, глаз и одежда из skins.js
         * @param {boolean} isGhost — полупрозрачный ли это соперник
         * @param {number} gameTime — игровой счётчик кадров для анимаций
         * @param {Object} drag — состояние натяжения рогатки пальцем
         */
        draw(ctx, charObj, skinConfig, isGhost = false, gameTime = 0, drag = null) {
            ctx.save();
            if (isGhost) ctx.globalAlpha = 0.45;

            const skin = skinConfig || {
                fur: ['#a39f99', '#7f7a75', '#5c5853'],
                belly: '#e5e5e5',
                eyes: ['#4ade80', '#16a34a', '#14532d'],
                hat: null,
                accessory: null
            };

            const pinX = isGhost ? charObj.pinX : (charObj.attachedPin ? charObj.attachedPin.x : charObj.x);
            const pinY = isGhost ? charObj.pinY : (charObj.attachedPin ? charObj.attachedPin.y : charObj.y - 78);

            // 1. Руки-резинки при висении на плитке
            if (charObj.state === 'STUCK' && (isGhost || charObj.attachedPin)) {
                this.drawRubberArms(ctx, charObj.x, charObj.y, pinX, pinY, skin.fur[1]);
            }

            ctx.translate(charObj.x, charObj.y);

            // 2. Расчет угла наклона и коэффициентов деформации (желе)
            let rot = 0;
            let sx = charObj.jellyX || 1;
            let sy = charObj.jellyY || 1;

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

            // Мягкая падающая тень под персонажем
            ctx.fillStyle = 'rgba(105, 58, 18, 0.3)';
            ctx.beginPath();
            ctx.arc(6, 12, 34, 0, Math.PI * 2);
            ctx.fill();

            // 3. Защитный силовой щит (если активен)
            if (charObj.hasShield) {
                this.drawShieldAura(ctx);
            }

            // 4. Тело, животик и лапки
            this.drawBodyAndLegs(ctx, skin);

            // 5. Ушки
            this.drawEars(ctx, skin);

            // 6. Голова, щеки и мордочка
            this.drawHead(ctx, skin);

            // 7. Глаза и направление взгляда
            this.drawEyes(ctx, charObj, skin, isGhost);

            // 8. Нос и рот
            this.drawNoseAndMouth(ctx);

            // 9. Одежда и головные уборы из скина
            this.drawWearables(ctx, skin);

            ctx.restore();
        }

        // Отрисовка длинных тянущихся лап-резинок
        drawRubberArms(ctx, tomX, tomY, pinX, pinY, furColor) {
            const stretchDist = Math.hypot(tomX - pinX, tomY - pinY);
            const armWidth = Math.max(6, 11 - (stretchDist - 70) * 0.035);

            // Тень рук
            ctx.strokeStyle = 'rgba(105, 58, 18, 0.28)';
            ctx.lineWidth = armWidth + 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(pinX - 10 + 6, pinY + 18 + 6); ctx.lineTo(tomX - 13 + 6, tomY - 18 + 6);
            ctx.moveTo(pinX + 10 + 6, pinY + 18 + 6); ctx.lineTo(tomX + 13 + 6, tomY - 18 + 6);
            ctx.stroke();

            // Обводка рук
            ctx.strokeStyle = '#2d2926';
            ctx.lineWidth = armWidth + 4;
            ctx.beginPath();
            ctx.moveTo(pinX - 10, pinY + 18); ctx.lineTo(tomX - 13, tomY - 18);
            ctx.moveTo(pinX + 10, pinY + 18); ctx.lineTo(tomX + 13, tomY - 18);
            ctx.stroke();

            // Заливка цветом шерсти
            ctx.strokeStyle = furColor;
            ctx.lineWidth = armWidth;
            ctx.beginPath();
            ctx.moveTo(pinX - 10, pinY + 18); ctx.lineTo(tomX - 13, tomY - 18);
            ctx.moveTo(pinX + 10, pinY + 18); ctx.lineTo(tomX + 13, tomY - 18);
            ctx.stroke();
        }

        // Аура щита
        drawShieldAura(ctx) {
            ctx.save();
            ctx.strokeStyle = '#1e1b18';
            ctx.lineWidth = 18;
            ctx.beginPath();
            ctx.arc(0, 12, 36, -Math.PI * 0.15, Math.PI * 1.15);
            ctx.stroke();

            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.arc(0, 12, 36, -Math.PI * 0.15, Math.PI * 1.15);
            ctx.stroke();
            ctx.restore();
        }

        // Тело и нижние лапы
        drawBodyAndLegs(ctx, skin) {
            ctx.save();
            ctx.fillStyle = skin.fur[1];
            ctx.strokeStyle = '#2d2926';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 26, 18, 16, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Живот
            ctx.fillStyle = skin.belly;
            ctx.beginPath();
            ctx.ellipse(0, 24, 11, 10, 0, 0, Math.PI * 2);
            ctx.fill();

            // Лапки
            ctx.fillStyle = skin.fur[1];
            ctx.beginPath();
            ctx.ellipse(-7, 40, 6.5, 8, 0.1, 0, Math.PI * 2);
            ctx.ellipse(7, 40, 6.5, 8, -0.1, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // Ушки Тома
        drawEars(ctx, skin) {
            [-1, 1].forEach(dir => {
                ctx.save();
                ctx.translate(dir * 20, -20);
                ctx.rotate(dir * 0.35);
                ctx.fillStyle = skin.fur[0];
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
        }

        // Голова и щеки
        drawHead(ctx, skin) {
            const headGrad = ctx.createRadialGradient(-7, -9, 5, 0, 0, 34);
            headGrad.addColorStop(0, skin.fur[0]);
            headGrad.addColorStop(0.65, skin.fur[1]);
            headGrad.addColorStop(1, skin.fur[2]);
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

            // Светлая область мордочки и брови
            ctx.fillStyle = '#e7e5e4';
            ctx.beginPath();
            ctx.ellipse(-11, -15, 5.5, 2.2, -0.2, 0, Math.PI * 2);
            ctx.ellipse(11, -15, 5.5, 2.2, 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(0, 8, 14, 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Глаза с динамическим зрачком и анимацией моргания
        drawEyes(ctx, charObj, skin, isGhost) {
            const isBlinking = !isGhost && charObj.blinkTimer < 0;

            [-11, 11].forEach(ex => {
                ctx.save();
                ctx.translate(ex, -4);
                if (charObj.state === 'DEAD') {
                    // Крестики вместо глаз при гибели
                    ctx.strokeStyle = '#1e1b18';
                    ctx.lineWidth = 3.2;
                    ctx.beginPath();
                    ctx.moveTo(-6, -6); ctx.lineTo(6, 6);
                    ctx.moveTo(6, -6); ctx.lineTo(-6, 6);
                    ctx.stroke();
                } else if (isBlinking) {
                    // Закрытые веки
                    ctx.strokeStyle = '#2d2926';
                    ctx.lineWidth = 3.2;
                    ctx.beginPath();
                    ctx.moveTo(-6, 0); ctx.quadraticCurveTo(0, 4, 6, 0);
                    ctx.stroke();
                } else {
                    // Белок
                    ctx.fillStyle = '#ffffff';
                    ctx.strokeStyle = '#2d2926';
                    ctx.lineWidth = 2.4;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, 8, 9, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    // Радужка
                    const lx = Math.max(-2.2, Math.min(2.2, charObj.lookX || 0));
                    const ly = Math.max(-2.2, Math.min(2.2, charObj.lookY || 0));

                    const irisGrad = ctx.createRadialGradient(lx, ly - 2, 1, lx, ly, 6);
                    irisGrad.addColorStop(0, skin.eyes[0]);
                    irisGrad.addColorStop(0.7, skin.eyes[1]);
                    irisGrad.addColorStop(1, skin.eyes[2]);
                    ctx.fillStyle = irisGrad;
                    ctx.beginPath();
                    ctx.arc(lx, ly, 5.8, 0, Math.PI * 2);
                    ctx.fill();

                    // Зрачок
                    ctx.fillStyle = '#09090b';
                    ctx.beginPath();
                    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
                    ctx.fill();

                    // Блики
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(lx - 1.8, ly - 2.2, 1.8, 0, Math.PI * 2);
                    ctx.arc(lx + 1.6, ly + 1.6, 0.9, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            });
        }

        // Нос и кошачий ротик
        drawNoseAndMouth(ctx) {
            const noseGrad = ctx.createLinearGradient(0, 2, 0, 8.5);
            noseGrad.addColorStop(0, '#fb7185');
            noseGrad.addColorStop(1, '#e11d48');
            ctx.fillStyle = noseGrad;
            ctx.beginPath();
            ctx.moveTo(-5, 4);
            ctx.quadraticCurveTo(0, 2.5, 5, 4);
            ctx.quadraticCurveTo(0, 9.5, 0, 8.5);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#3f3b37';
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-6, 11);
            ctx.quadraticCurveTo(0, 14.5, 6, 11);
            ctx.stroke();
        }

        // Одежда, головные уборы и аксессуары
        drawWearables(ctx, skin) {
            // Ковбойская шляпа
            if (skin.hat === 'cowboy_hat') {
                ctx.save();
                ctx.fillStyle = '#78350f';
                ctx.strokeStyle = '#2b1608';
                ctx.lineWidth = 2.8;
                ctx.beginPath(); ctx.ellipse(0, -26, 38, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.roundRect(-16, -45, 32, 22, [8, 8, 2, 2]); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#b45309'; ctx.fillRect(-16, -28, 32, 5);
                ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(0, -25.5, 3, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }

            // Бандана на шею
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

            // Неоновый кибер-визор
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

            // Золотая корона
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

    // Экспортируем единственный глобальный объект модели
    window.TomModel = new TomModelEngine();
})();
