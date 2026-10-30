/**
 * obstacles.js — Модуль препятствий и кинетических преград для «ТОЛЬКО ВВЕРХ!»
 * 
 * Правила:
 *  - СМЕРТЕЛЬНЫЕ (spiked: true): шипастые колеса и клинья, утопленные наполовину в стену.
 *  - БЕЗОПАСНЫЕ КИНЕТИЧЕСКИЕ (spiked: false): рельсы, выдвижные балки, безопасные колеса, фонари.
 *    Они лишь физически отталкивают Тома, мешая прямому полёту.
 */

class ObstacleManager {
    constructor() {
        this.obstacles = [];
    }

    clear() {
        this.obstacles = [];
    }

    /**
     * Спавн препятствия в каньоне (вызывается процедурным генератором)
     */
    spawnAt(y, W, WALL_W, difficulty = 0, rng = Math.random) {
        const roll = rng();

        // 1. ШИПАСТЫЕ ОПАСНОСТИ СТРОГО В СТЕНЕ (70% шанс)
        if (roll < 0.70) {
            const side = rng() < 0.5 ? 'left' : 'right';
            const isWheel = rng() < 0.55;

            if (isWheel) {
                // Массивное шипастое колесо, утопленное наполовину в стену
                this.obstacles.push({
                    type: 'side_spiked_wheel',
                    side: side,
                    x: side === 'left' ? WALL_W : W - WALL_W,
                    y: y,
                    radius: 48,
                    angle: rng() * Math.PI * 2,
                    rotSpeed: (0.012 + rng() * 0.008) * (rng() < 0.5 ? 1 : -1),
                    spiked: true
                });
            } else {
                // Деревянный клин с острыми металлическими зубьями на стене
                this.obstacles.push({
                    type: 'side_spiked_wedge',
                    side: side,
                    x: side === 'left' ? WALL_W : W - WALL_W,
                    y: y,
                    width: 82,
                    height: 106,
                    spiked: true
                });
            }
            return side; // Возвращаем сторону, чтобы сместить пин в противоположную
        }

        // 2. БЕЗОПАСНЫЕ КИНЕТИЧЕСКИЕ ПРЕПЯТСТВИЯ (30% шанс — НЕ убивают, только толкают)
        const safeRoll = rng();

        if (safeRoll < 0.40) {
            // Наклонный деревянный рельс / балка, торчащая из стены (как в оригинале)
            const side = rng() < 0.5 ? 'left' : 'right';
            this.obstacles.push({
                type: 'side_wood_rail',
                side: side,
                x: side === 'left' ? WALL_W : W - WALL_W,
                y: y,
                length: 90 + rng() * 25,
                angle: (side === 'left' ? 0.35 : -0.35) + (rng() - 0.5) * 0.2,
                thickness: 20,
                spiked: false
            });
            return side;
        } 
        else if (safeRoll < 0.70) {
            // Выдвигающийся барьер со шлагбаумом (периодическое движение)
            const side = rng() < 0.5 ? 'left' : 'right';
            this.obstacles.push({
                type: 'sliding_barrier',
                side: side,
                baseX: side === 'left' ? WALL_W : W - WALL_W,
                x: side === 'left' ? WALL_W : W - WALL_W,
                y: y,
                maxReach: 105,
                phase: rng() * Math.PI * 2,
                speed: 0.03 + difficulty * 0.015,
                width: 95,
                height: 18,
                spiked: false
            });
            return side;
        } 
        else {
            // Безопасное гладкое колесо по центру (редкий спавн)
            this.obstacles.push({
                type: 'center_safe_wheel',
                x: W / 2 + (rng() - 0.5) * 40,
                y: y,
                radius: 44,
                angle: rng() * Math.PI * 2,
                rotSpeed: 0.012,
                spiked: false
            });
            return 'center';
        }
    }

    /**
     * Обновление и проверка коллизий с Томом
     */
    update(tom, deltaFactor = 1.0, onHazardHit, onBounce) {
        for (let i = 0; i < this.obstacles.length; i++) {
            const o = this.obstacles[i];

            // 1. ШИПАСТОЕ КОЛЕСО НА СТЕНЕ (Смертельно)
            if (o.type === 'side_spiked_wheel') {
                o.angle += o.rotSpeed * deltaFactor;
                const dist = Math.hypot(tom.x - o.x, tom.y - o.y);
                if (dist < o.radius + tom.radius * 0.7) {
                    onHazardHit(o.x, o.y, 'Том налетел на шипастое колесо на стене!');
                }
            }

            // 2. ШИПАСТЫЙ КЛИН НА СТЕНЕ (Смертельно)
            else if (o.type === 'side_spiked_wedge') {
                const tipX = o.side === 'left' ? o.x + o.width : o.x - o.width;
                const tipY = o.y;
                const topY = o.y - o.height / 2;
                const botY = o.y + o.height / 2;

                if (tom.y + tom.radius * 0.7 > topY && tom.y - tom.radius * 0.7 < botY) {
                    const progressY = 1 - Math.min(1, Math.abs(tom.y - tipY) / (o.height / 2));
                    const currentExtent = o.width * progressY;

                    let hit = false;
                    if (o.side === 'left' && tom.x - tom.radius * 0.75 < o.x + currentExtent) hit = true;
                    if (o.side === 'right' && tom.x + tom.radius * 0.75 > o.x - currentExtent) hit = true;

                    if (hit) {
                        onHazardHit(tipX, tipY, 'Том укололся о шипы на стене!');
                    }
                }
            }

            // 3. БЕЗОПАСНОЕ ЦЕНТРАЛЬНОЕ КОЛЕСО (Только физический толчок)
            else if (o.type === 'center_safe_wheel') {
                o.angle += o.rotSpeed * deltaFactor;
                const dist = Math.hypot(tom.x - o.x, tom.y - o.y);
                if (dist < o.radius + tom.radius * 0.78) {
                    const pushAng = Math.atan2(tom.y - o.y, tom.x - o.x);
                    tom.vx = Math.cos(pushAng) * 7.5;
                    tom.vy = Math.sin(pushAng) * 7.5;
                    tom.jellyX = 0.72;
                    tom.jellyY = 1.25;
                    onBounce(o.x, o.y);
                }
            }

            // 4. ТОРЧАЩИЙ ДЕРЕВЯННЫЙ РЕЛЬС / БАЛКА (Безопасный рикошет)
            else if (o.type === 'side_wood_rail') {
                const isLeft = o.side === 'left';
                const endX = isLeft ? o.x + Math.cos(o.angle) * o.length : o.x - Math.cos(o.angle) * o.length;
                const endY = o.y + Math.sin(o.angle) * o.length;

                // Проверка расстояния от Тома до отрезка балки
                const l2 = Math.pow(endX - o.x, 2) + Math.pow(endY - o.y, 2);
                let t = ((tom.x - o.x) * (endX - o.x) + (tom.y - o.y) * (endY - o.y)) / l2;
                t = Math.max(0, Math.min(1, t));

                const projX = o.x + t * (endX - o.x);
                const projY = o.y + t * (endY - o.y);
                const dist = Math.hypot(tom.x - projX, tom.y - projY);

                if (dist < tom.radius + o.thickness * 0.5) {
                    const bounceAng = Math.atan2(tom.y - projY, tom.x - projX);
                    tom.vx = Math.cos(bounceAng) * 8;
                    tom.vy = Math.sin(bounceAng) * 8;
                    tom.jellyX = 0.7;
                    tom.jellyY = 1.3;
                    onBounce(projX, projY);
                }
            }

            // 5. ВЫДВИЖНОЙ БАРЬЕР-ШЛАГБАУМ (Безопасное выталкивание)
            else if (o.type === 'sliding_barrier') {
                o.phase += o.speed * deltaFactor;
                const reach = Math.max(0, Math.sin(o.phase)) * o.maxReach;
                const isLeft = o.side === 'left';
                const curEndX = isLeft ? o.baseX + reach : o.baseX - reach;

                const topY = o.y - o.height / 2;
                const botY = o.y + o.height / 2;

                if (tom.y + tom.radius * 0.7 > topY && tom.y - tom.radius * 0.7 < botY) {
                    let collided = false;
                    if (isLeft && tom.x - tom.radius * 0.7 < curEndX) collided = true;
                    if (!isLeft && tom.x + tom.radius * 0.7 > curEndX) collided = true;

                    if (collided) {
                        tom.vx = isLeft ? 6.5 : -6.5;
                        tom.vy = tom.vy < 0 ? -6 : 5;
                        onBounce(curEndX, o.y);
                    }
                }
            }
        }
    }

    /**
     * Отрисовка всех объектов
     */
    draw(ctx) {
        for (let i = 0; i < this.obstacles.length; i++) {
            const o = this.obstacles[i];
            ctx.save();
            switch (o.type) {
                case 'side_spiked_wheel':
                    this.drawWagonWheel(ctx, o.x, o.y, o.radius, o.angle, true);
                    break;
                case 'center_safe_wheel':
                    this.drawWagonWheel(ctx, o.x, o.y, o.radius, o.angle, false);
                    break;
                case 'side_spiked_wedge':
                    this.drawSpikedWoodWedge(ctx, o);
                    break;
                case 'side_wood_rail':
                    this.drawWoodRail(ctx, o);
                    break;
                case 'sliding_barrier':
                    this.drawSlidingBarrier(ctx, o);
                    break;
            }
            ctx.restore();
        }
    }

    /* =========================================================================
     *  ВИЗУАЛЬНЫЕ МЕТОДЫ ОТРИСОВКИ
     * ========================================================================= */

    // Колесо телеги (с шипами или без)[span_6](start_span)[span_6](end_span)[span_7](start_span)[span_7](end_span)[span_8](start_span)[span_8](end_span)
    drawWagonWheel(ctx, x, y, r, angle, spiked) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Падающая мягкая тень колеса
        ctx.fillStyle = 'rgba(105, 58, 18, 0.28)';
        ctx.beginPath();
        ctx.arc(6, 10, r + (spiked ? 14 : 0), 0, Math.PI * 2);
        ctx.fill();

        // Стальные шипы по периметру (если колесо шипастое)
        if (spiked) {
            const count = 12;
            ctx.fillStyle = '#94a3b8';
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2.5;
            for (let i = 0; i < count; i++) {
                ctx.save();
                ctx.rotate((i * Math.PI * 2) / count);
                ctx.beginPath();
                ctx.moveTo(r - 4, -7);
                ctx.lineTo(r + 17, 0);
                ctx.lineTo(r - 4, 7);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
        }

        // Деревянные спицы телеги
        ctx.strokeStyle = '#2b1608';
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
            ctx.save();
            ctx.rotate((i * Math.PI) / 4);
            ctx.fillStyle = '#b4692c';
            ctx.beginPath();
            ctx.roundRect(-5, 0, 10, r - 10, 3);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // Деревянный обод
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#a35822';
        ctx.beginPath();
        ctx.arc(0, 0, r - 10, 0, Math.PI * 2);
        ctx.stroke();

        // Кованый железный обод
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
        ctx.stroke();

        // Кожаные крестовые стяжки
        ctx.strokeStyle = '#854d0e';
        ctx.lineWidth = 4;
        [-Math.PI / 4, Math.PI / 4].forEach(rot => {
            ctx.save();
            ctx.rotate(rot);
            ctx.beginPath();
            ctx.moveTo(-18, 0); ctx.lineTo(18, 0);
            ctx.stroke();
            ctx.restore();
        });

        // Центральная медная втулка
        ctx.fillStyle = '#c87a38';
        ctx.strokeStyle = '#2b1608';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    // Деревянный клин с красными ремнями и шипами[span_9](start_span)[span_9](end_span)[span_10](start_span)[span_10](end_span)
    drawSpikedWoodWedge(ctx, o) {
        ctx.save();
        const isLeft = o.side === 'left';
        const baseX = o.x;
        const tipX = isLeft ? baseX + o.width : baseX - o.width;
        const topY = o.y - o.height / 2;
        const botY = o.y + o.height / 2;

        // Падающая тень
        ctx.fillStyle = 'rgba(105, 58, 18, 0.3)';
        ctx.beginPath();
        ctx.moveTo(baseX, topY + 8);
        ctx.lineTo(tipX + (isLeft ? 8 : -8), o.y + 8);
        ctx.lineTo(baseX, botY + 8);
        ctx.closePath();
        ctx.fill();

        // Острые металлические зубья-шипы
        ctx.fillStyle = '#94a3b8';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        for (let i = 1; i <= 5; i++) {
            const t = i / 6;
            const sx1 = baseX + (tipX - baseX) * t;
            const sy1 = topY + (o.y - topY) * t;
            ctx.beginPath();
            ctx.arc(sx1, sy1 - 5, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            const sx2 = baseX + (tipX - baseX) * t;
            const sy2 = botY + (o.y - botY) * t;
            ctx.beginPath();
            ctx.arc(sx2, sy2 + 5, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Стальная окантовка клина
        ctx.fillStyle = '#64748b';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(baseX, topY);
        ctx.lineTo(tipX, o.y);
        ctx.lineTo(baseX, botY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Внутреннее дерево
        ctx.fillStyle = '#b4692c';
        ctx.beginPath();
        ctx.moveTo(baseX, topY + 12);
        ctx.lineTo(tipX - (isLeft ? 18 : -18), o.y);
        ctx.lineTo(baseX, botY - 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Аутентичные красные кожаные ремни клина (как в оригинале)[span_11](start_span)[span_11](end_span)
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(baseX + (isLeft ? 22 : -22), topY + 24);
        ctx.lineTo(baseX + (isLeft ? 45 : -45), o.y);
        ctx.lineTo(baseX + (isLeft ? 22 : -22), botY - 24);
        ctx.stroke();

        ctx.restore();
    }

    // Торчащий рельс / балка из стены[span_12](start_span)[span_12](end_span)
    drawWoodRail(ctx, o) {
        ctx.save();
        const isLeft = o.side === 'left';
        ctx.translate(o.x, o.y);
        ctx.rotate(isLeft ? o.angle : Math.PI - o.angle);

        // Тень балки
        ctx.fillStyle = 'rgba(105, 58, 18, 0.25)';
        ctx.beginPath();
        ctx.roundRect(0, -o.thickness / 2 + 8, o.length, o.thickness, 6);
        ctx.fill();

        // Деревянный брус
        ctx.fillStyle = '#c28148';
        ctx.strokeStyle = '#45230d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(0, -o.thickness / 2, o.length, o.thickness, 6);
        ctx.fill();
        ctx.stroke();

        // Стальные скобы крепления (рельсовые накладки)[span_13](start_span)[span_13](end_span)
        ctx.fillStyle = '#64748b';
        [24, o.length - 24].forEach(posX => {
            ctx.beginPath();
            ctx.roundRect(posX - 6, -o.thickness / 2 - 3, 12, o.thickness + 6, 3);
            ctx.fill();
            ctx.stroke();

            // Заклепки
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.arc(posX, -o.thickness / 2 + 1, 1.8, 0, Math.PI * 2);
            ctx.arc(posX, o.thickness / 2 - 1, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#64748b';
        });

        ctx.restore();
    }

    // Выдвижной барьер со шлагбаумом[span_14](start_span)[span_14](end_span)
    drawSlidingBarrier(ctx, o) {
        ctx.save();
        const reach = Math.max(0, Math.sin(o.phase)) * o.maxReach;
        const isLeft = o.side === 'left';

        // Белая пунктирная линия разметки траектории (как в оригинале)[span_15](start_span)[span_15](end_span)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(o.baseX, o.y);
        ctx.lineTo(isLeft ? o.baseX + o.maxReach : o.baseX - o.maxReach, o.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Выдвинутый деревянный шлагбаум
        const curX = isLeft ? o.baseX : o.baseX - reach;
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(curX, o.y - o.height / 2, reach, o.height, 5);
        ctx.fill();
        ctx.stroke();

        // Полосы безопасности на кончике шлагбаума
        ctx.fillStyle = '#ef4444';
        const tip = isLeft ? o.baseX + reach - 16 : curX;
        ctx.fillRect(tip, o.y - o.height / 2 + 2, 14, o.height - 4);

        ctx.restore();
    }
}

// Экспортируем глобальный менеджер препятствий
window.Obstacles = new ObstacleManager();
