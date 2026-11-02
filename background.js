/**
 * background.js — Мульти-биомовый менеджер карт («Вестерн Каньон» и «Джунгли»)
 */

// ==========================================
// БИОМ 1: ВЕСТЕРН КАНЬОН (Классический)
// ==========================================
class CanyonMapEngine {
    constructor() {
        this.canyonStones = [];
        this.wallRocks = [];
        this.dustMotes = [];
        this.obstacles = [];
    }

    init(W, H, WALL_W) {
        this.canyonStones = [];
        this.wallRocks = [];
        this.dustMotes = [];
        this.obstacles = [];

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

    spawnObstacle(y, W, WALL_W, difficulty = 0, rng = Math.random) {
        const roll = rng();
        if (roll < 0.70) {
            const side = rng() < 0.5 ? 'left' : 'right';
            if (rng() < 0.55) {
                this.obstacles.push({
                    type: 'side_spiked_wheel', side: side,
                    x: side === 'left' ? WALL_W : W - WALL_W, y: y,
                    radius: 48, angle: rng() * Math.PI * 2,
                    rotSpeed: (0.012 + rng() * 0.008) * (rng() < 0.5 ? 1 : -1), spiked: true
                });
            } else {
                this.obstacles.push({
                    type: 'side_spiked_wedge', side: side,
                    x: side === 'left' ? WALL_W : W - WALL_W, y: y,
                    width: 82, height: 106, spiked: true
                });
            }
            return side;
        }

        const safeRoll = rng();
        if (safeRoll < 0.40) {
            const side = rng() < 0.5 ? 'left' : 'right';
            this.obstacles.push({
                type: 'side_wood_rail', side: side,
                x: side === 'left' ? WALL_W : W - WALL_W, y: y,
                length: 90 + rng() * 25, angle: (side === 'left' ? 0.35 : -0.35) + (rng() - 0.5) * 0.2,
                thickness: 20, spiked: false
            });
            return side;
        } else if (safeRoll < 0.70) {
            const side = rng() < 0.5 ? 'left' : 'right';
            this.obstacles.push({
                type: 'sliding_barrier', side: side,
                baseX: side === 'left' ? WALL_W : W - WALL_W, x: side === 'left' ? WALL_W : W - WALL_W,
                y: y, maxReach: 105, phase: rng() * Math.PI * 2, speed: 0.03 + difficulty * 0.015,
                width: 95, height: 18, spiked: false
            });
            return side;
        } else {
            this.obstacles.push({
                type: 'center_safe_wheel',
                x: W / 2 + (rng() - 0.5) * 40, y: y, radius: 44,
                angle: rng() * Math.PI * 2, rotSpeed: 0.012, spiked: false
            });
            return 'center';
        }
    }

    update(tom, W, H, deltaFactor, gameTime, onHazardHit, onBounce) {
        this.dustMotes.forEach(m => {
            m.x += m.vx + Math.sin(gameTime * 0.02 + m.phase) * 0.15;
            m.y += m.vy;
            if (m.y < -10) m.y = H + 10;
            if (m.x > W + 10) m.x = -10;
        });

        for (let i = 0; i < this.obstacles.length; i++) {
            const o = this.obstacles[i];
            if (o.type === 'side_spiked_wheel') {
                o.angle += o.rotSpeed * deltaFactor;
                if (Math.hypot(tom.x - o.x, tom.y - o.y) < o.radius + tom.radius * 0.7) {
                    onHazardHit(o.x, o.y, 'Том налетел на шипастое колесо на стене!');
                }
            } else if (o.type === 'side_spiked_wedge') {
                const tipX = o.side === 'left' ? o.x + o.width : o.x - o.width;
                const topY = o.y - o.height / 2, botY = o.y + o.height / 2;
                if (tom.y + tom.radius * 0.7 > topY && tom.y - tom.radius * 0.7 < botY) {
                    const currentExtent = o.width * (1 - Math.min(1, Math.abs(tom.y - o.y) / (o.height / 2)));
                    let hit = false;
                    if (o.side === 'left' && tom.x - tom.radius * 0.75 < o.x + currentExtent) hit = true;
                    if (o.side === 'right' && tom.x + tom.radius * 0.75 > o.x - currentExtent) hit = true;
                    if (hit) onHazardHit(tipX, o.y, 'Том укололся о шипы на стене!');
                }
            } else if (o.type === 'center_safe_wheel') {
                o.angle += o.rotSpeed * deltaFactor;
                if (Math.hypot(tom.x - o.x, tom.y - o.y) < o.radius + tom.radius * 0.78) {
                    const pushAng = Math.atan2(tom.y - o.y, tom.x - o.x);
                    tom.vx = Math.cos(pushAng) * 7.5; tom.vy = Math.sin(pushAng) * 7.5;
                    tom.jellyX = 0.72; tom.jellyY = 1.25;
                    onBounce(o.x, o.y);
                }
            } else if (o.type === 'side_wood_rail') {
                const isLeft = o.side === 'left';
                const endX = isLeft ? o.x + Math.cos(o.angle) * o.length : o.x - Math.cos(o.angle) * o.length;
                const endY = o.y + Math.sin(o.angle) * o.length;
                const l2 = Math.pow(endX - o.x, 2) + Math.pow(endY - o.y, 2);
                let t = Math.max(0, Math.min(1, ((tom.x - o.x) * (endX - o.x) + (tom.y - o.y) * (endY - o.y)) / l2));
                const projX = o.x + t * (endX - o.x), projY = o.y + t * (endY - o.y);
                if (Math.hypot(tom.x - projX, tom.y - projY) < tom.radius + o.thickness * 0.5) {
                    const bounceAng = Math.atan2(tom.y - projY, tom.x - projX);
                    tom.vx = Math.cos(bounceAng) * 8; tom.vy = Math.sin(bounceAng) * 8;
                    tom.jellyX = 0.7; tom.jellyY = 1.3;
                    onBounce(projX, projY);
                }
            } else if (o.type === 'sliding_barrier') {
                o.phase += o.speed * deltaFactor;
                const reach = Math.max(0, Math.sin(o.phase)) * o.maxReach;
                const isLeft = o.side === 'left', curEndX = isLeft ? o.baseX + reach : o.baseX - reach;
                const topY = o.y - o.height / 2, botY = o.y + o.height / 2;
                if (tom.y + tom.radius * 0.7 > topY && tom.y - tom.radius * 0.7 < botY) {
                    let collided = false;
                    if (isLeft && tom.x - tom.radius * 0.7 < curEndX) collided = true;
                    if (!isLeft && tom.x + tom.radius * 0.7 > curEndX) collided = true;
                    if (collided) {
                        tom.vx = isLeft ? 6.5 : -6.5; tom.vy = tom.vy < 0 ? -6 : 5;
                        onBounce(curEndX, o.y);
                    }
                }
            }
        }
    }

    drawBackground(ctx, W, H, WALL_W, cameraY, gameTime) {
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, '#fff3d1');
        bgGrad.addColorStop(0.45, '#fde09b');
        bgGrad.addColorStop(1, '#f7c978');
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

        this.wallRocks.forEach(wr => {
            let wy = (wr.y - cameraY) % wrapH;
            if (wy < -60) wy += wrapH;
            ctx.fillStyle = '#e5a95c'; ctx.strokeStyle = '#9c5a25'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.roundRect(-8, wy, wr.leftW + 8, 48, 10); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.roundRect(W - wr.rightW, wy, wr.rightW + 8, 48, 10); ctx.fill(); ctx.stroke();
        });

        this.dustMotes.forEach(m => {
            const glow = 0.35 + Math.sin(gameTime * 0.05 + m.phase) * 0.25;
            ctx.fillStyle = `rgba(255, 252, 220, ${glow})`;
            ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
    }

    drawObstacles(ctx) {
        ctx.save();
        for (let i = 0; i < this.obstacles.length; i++) {
            const o = this.obstacles[i];
            if (o.type === 'side_spiked_wheel') this.drawWagonWheel(ctx, o.x, o.y, o.radius, o.angle, true);
            else if (o.type === 'center_safe_wheel') this.drawWagonWheel(ctx, o.x, o.y, o.radius, o.angle, false);
            else if (o.type === 'side_spiked_wedge') this.drawSpikedWoodWedge(ctx, o);
            else if (o.type === 'side_wood_rail') this.drawWoodRail(ctx, o);
            else if (o.type === 'sliding_barrier') this.drawSlidingBarrier(ctx, o);
        }
        ctx.restore();
    }

    drawWagonWheel(ctx, x, y, r, angle, spiked) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
        ctx.fillStyle = 'rgba(105, 58, 18, 0.28)';
        ctx.beginPath(); ctx.arc(6, 10, r + (spiked ? 14 : 0), 0, Math.PI * 2); ctx.fill();
        if (spiked) {
            ctx.fillStyle = '#94a3b8'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
            for (let i = 0; i < 12; i++) {
                ctx.save(); ctx.rotate((i * Math.PI * 2) / 12);
                ctx.beginPath(); ctx.moveTo(r - 4, -7); ctx.lineTo(r + 17, 0); ctx.lineTo(r - 4, 7);
                ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
            }
        }
        ctx.strokeStyle = '#2b1608'; ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
            ctx.save(); ctx.rotate((i * Math.PI) / 4);
            ctx.fillStyle = '#b4692c'; ctx.beginPath(); ctx.roundRect(-5, 0, 10, r - 10, 3);
            ctx.fill(); ctx.stroke(); ctx.restore();
        }
        ctx.lineWidth = 14; ctx.strokeStyle = '#a35822'; ctx.beginPath(); ctx.arc(0, 0, r - 10, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 10; ctx.strokeStyle = '#64748b'; ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#c87a38'; ctx.strokeStyle = '#2b1608'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    drawSpikedWoodWedge(ctx, o) {
        ctx.save();
        const isLeft = o.side === 'left', baseX = o.x, tipX = isLeft ? baseX + o.width : baseX - o.width;
        const topY = o.y - o.height / 2, botY = o.y + o.height / 2;
        ctx.fillStyle = 'rgba(105, 58, 18, 0.3)';
        ctx.beginPath(); ctx.moveTo(baseX, topY + 8); ctx.lineTo(tipX + (isLeft ? 8 : -8), o.y + 8); ctx.lineTo(baseX, botY + 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#94a3b8'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
        for (let i = 1; i <= 5; i++) {
            const t = i / 6, sx = baseX + (tipX - baseX) * t;
            ctx.beginPath(); ctx.arc(sx, topY + (o.y - topY) * t - 5, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(sx, botY + (o.y - botY) * t + 5, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = '#64748b'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(baseX, topY); ctx.lineTo(tipX, o.y); ctx.lineTo(baseX, botY); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#b4692c';
        ctx.beginPath(); ctx.moveTo(baseX, topY + 12); ctx.lineTo(tipX - (isLeft ? 18 : -18), o.y); ctx.lineTo(baseX, botY - 12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(baseX + (isLeft ? 22 : -22), topY + 24); ctx.lineTo(baseX + (isLeft ? 45 : -45), o.y); ctx.lineTo(baseX + (isLeft ? 22 : -22), botY - 24); ctx.stroke();
        ctx.restore();
    }

    drawWoodRail(ctx, o) {
        ctx.save();
        ctx.translate(o.x, o.y); ctx.rotate(o.side === 'left' ? o.angle : Math.PI - o.angle);
        ctx.fillStyle = 'rgba(105, 58, 18, 0.25)'; ctx.beginPath(); ctx.roundRect(0, -o.thickness / 2 + 8, o.length, o.thickness, 6); ctx.fill();
        ctx.fillStyle = '#c28148'; ctx.strokeStyle = '#45230d'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(0, -o.thickness / 2, o.length, o.thickness, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#64748b';
        [24, o.length - 24].forEach(posX => {
            ctx.beginPath(); ctx.roundRect(posX - 6, -o.thickness / 2 - 3, 12, o.thickness + 6, 3); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(posX, -o.thickness / 2 + 1, 1.8, 0, Math.PI * 2); ctx.arc(posX, o.thickness / 2 - 1, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#64748b';
        });
        ctx.restore();
    }

    drawSlidingBarrier(ctx, o) {
        ctx.save();
        const reach = Math.max(0, Math.sin(o.phase)) * o.maxReach, isLeft = o.side === 'left';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(o.baseX, o.y); ctx.lineTo(isLeft ? o.baseX + o.maxReach : o.baseX - o.maxReach, o.y); ctx.stroke(); ctx.setLineDash([]);
        const curX = isLeft ? o.baseX : o.baseX - reach;
        ctx.fillStyle = '#b45309'; ctx.strokeStyle = '#451a03'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(curX, o.y - o.height / 2, reach, o.height, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ef4444'; ctx.fillRect(isLeft ? o.baseX + reach - 16 : curX, o.y - o.height / 2 + 2, 14, o.height - 4);
        ctx.restore();
    }
}


// ==========================================
// БИОМ 2: БАМБУКОВЫЕ ДЖУНГЛИ (Новый)
// ==========================================
class JungleMapEngine {
    constructor() {
        this.obstacles = [];
        this.bambooSegments = [];
        this.fireflies = [];
        this.vines = [];
    }

    init(W, H, WALL_W) {
        this.obstacles = [];
        this.bambooSegments = [];
        this.fireflies = [];
        this.vines = [];

        for (let y = -H * 2; y < H * 3; y += 120) {
            this.bambooSegments.push({
                y,
                leftOffset: 8 + Math.sin(y) * 4,
                rightOffset: 8 + Math.cos(y) * 4
            });
        }

        for (let i = 0; i < 15; i++) {
            this.fireflies.push({
                x: WALL_W + Math.random() * (W - WALL_W * 2),
                y: Math.random() * H,
                size: 2 + Math.random() * 3,
                pulsePhase: Math.random() * Math.PI * 2,
                speedY: -0.2 - Math.random() * 0.5
            });
        }

        for (let x = 80; x < W; x += 140) {
            this.vines.push({
                anchorX: x + (Math.random() - 0.5) * 40,
                length: 150 + Math.random() * 120,
                swingAnim: Math.random() * Math.PI
            });
        }
    }

    spawnObstacle(y, W, WALL_W, difficulty = 0, rng = Math.random) {
        const radius = 24;
        const x = WALL_W + 60 + rng() * (W - WALL_W * 120);
        const isCoconut = rng() < 0.5;

        this.obstacles.push({
            x, y, radius,
            type: isCoconut ? 'coconut' : 'bamboo_spring',
            rotation: rng() * Math.PI * 2,
            rotSpeed: (rng() - 0.5) * 0.05,
            hitProgress: 0
        });

        return isCoconut ? 'center' : (rng() < 0.5 ? 'left' : 'right');
    }

    update(tom, W, H, deltaFactor, gameTime, onHazardHit, onBounce) {
        this.fireflies.forEach(f => {
            f.y += f.speedY * deltaFactor;
            f.pulsePhase += 0.04 * deltaFactor;
            if (f.y < -50) f.y = H + 50;
        });

        this.vines.forEach(v => {
            v.swingAnim += 0.03 * deltaFactor;
        });

        for (let i = 0; i < this.obstacles.length; i++) {
            const o = this.obstacles[i];
            o.rotation += o.rotSpeed * deltaFactor;
            if (o.hitProgress > 0) {
                o.hitProgress = Math.max(0, o.hitProgress - 0.05 * deltaFactor);
            }

            const dist = Math.hypot(tom.x - o.x, tom.y - o.y);
            if (dist < tom.radius + o.radius) {
                o.hitProgress = 1.0;
                if (o.type === 'coconut') {
                    onHazardHit(o.x, o.y, 'Том получил кокосом по голове!');
                } else {
                    // Бамбуковый батут подбрасывает Тома
                    tom.vy = -1700;
                    tom.vx += (tom.x - o.x) * 0.12;
                    tom.state = 'FLYING';
                    tom.attachedPin = null;
                    tom.ignorePin = null;
                    onBounce(o.x, o.y);
                }
            }
        }
    }

    drawBackground(ctx, W, H, WALL_W, cameraY, gameTime) {
        const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        skyGrad.addColorStop(0, '#dbe29d');
        skyGrad.addColorStop(0.3, '#8cb847');
        skyGrad.addColorStop(1, '#2e591c');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#c9b076';
        ctx.beginPath();
        ctx.moveTo(W * 0.45, H * 0.1);
        ctx.lineTo(W * 0.55, H * 0.1);
        ctx.bezierCurveTo(W * 0.7, H * 0.5, W * 0.9, H * 0.8, W * 0.85, H * 1.0);
        ctx.lineTo(W * 0.15, H * 1.0);
        ctx.bezierCurveTo(W * 0.1, H * 0.8, W * 0.3, H * 0.5, W * 0.45, H * 0.1);
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#473a1e';
        ctx.stroke();

        const drawBambooStem = (x, width, heightColor, darkColor) => {
            ctx.fillStyle = heightColor;
            ctx.strokeStyle = darkColor;
            ctx.lineWidth = 5;
            const segmentHeight = 80;
            const totalSegments = Math.ceil(H / segmentHeight);

            for (let i = 0; i < totalSegments; i++) {
                const y = H - (i * segmentHeight) + (cameraY * 0.2) % segmentHeight;
                ctx.beginPath();
                ctx.roundRect(x - 2, y - segmentHeight + 4, width + 4, segmentHeight - 8, 4);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = darkColor;
                ctx.fillRect(x - 6, y - 2, width + 12, 4);
                ctx.fillStyle = heightColor;
            }
        };

        drawBambooStem(10, 24, '#7fa632', '#1b3305');
        drawBambooStem(35, 30, '#94bf3b', '#244507');
        drawBambooStem(W - 40, 26, '#7fa632', '#1b3305');
        drawBambooStem(W - 65, 32, '#94bf3b', '#244507');

        const lightGrad = ctx.createLinearGradient(0, 0, W, H * 0.5);
        lightGrad.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
        lightGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.moveTo(W * 0.1, 0);
        ctx.lineTo(W * 0.6, 0);
        ctx.lineTo(W * 1.0, H * 0.6);
        ctx.lineTo(W * 0.3, H * 0.9);
        ctx.closePath();
        ctx.fill();

        this.vines.forEach(v => this.drawJungleVine(ctx, v.anchorX, v.length, v.swingAnim));
        this.drawJungleFireflies(ctx, this.fireflies);
    }

    drawObstacles(ctx) {
        ctx.save();
        for (let i = 0; i < this.obstacles.length; i++) {
            const o = this.obstacles[i];
            if (o.type === 'coconut') {
                if (o.hitProgress > 0) {
                    this.drawCrackedCoconut(ctx, o.x, o.y, o.radius, o.hitProgress);
                } else {
                    this.drawFlyingCoconut(ctx, o.x, o.y, o.radius, o.rotation);
                }
            } else {
                const isLeft = o.x < W / 2;
                this.drawBambooWallTrampoline(ctx, W, o.y, isLeft, o.hitProgress);
            }
        }
        ctx.restore();
    }

    drawJungleVine(ctx, anchorX, length, swingAnim) {
        ctx.save();
        const endX = anchorX + Math.sin(swingAnim) * 60;
        const endY = length;
        const ctrlX = anchorX + Math.sin(swingAnim) * 30;
        const ctrlY = length * 0.5;

        ctx.lineWidth = 6;
        ctx.strokeStyle = '#325c1c';
        ctx.beginPath();
        ctx.moveTo(anchorX, 0);
        ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
        ctx.stroke();

        ctx.fillStyle = '#659c2a';
        ctx.strokeStyle = '#1b3806';
        ctx.lineWidth = 2.5;

        const leafCount = 5;
        for (let j = 1; j <= leafCount; j++) {
            const t = j / (leafCount + 1);
            const leafX = (1 - t) * (1 - t) * anchorX + 2 * (1 - t) * t * ctrlX + t * t * endX;
            const leafY = 2 * (1 - t) * t * ctrlY + t * t * endY;

            ctx.save();
            ctx.translate(leafX, leafY);
            ctx.rotate(Math.sin(swingAnim + j) * 0.3 + (j % 2 === 0 ? 0.8 : -0.8));
            ctx.beginPath();
            ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = '#422813';
        ctx.beginPath();
        ctx.arc(endX, endY, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawFlyingCoconut(ctx, x, y, radius, rotation) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1f130b';
        ctx.fillStyle = '#5c3a21';

        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#1f130b';
        ctx.beginPath();
        ctx.arc(-radius * 0.3, -radius * 0.2, radius * 0.12, 0, Math.PI * 2);
        ctx.arc(radius * 0.3, -radius * 0.2, radius * 0.12, 0, Math.PI * 2);
        ctx.arc(0, radius * 0.3, radius * 0.12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.ellipse(-radius * 0.2, -radius * 0.2, radius * 0.4, radius * 0.2, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawCrackedCoconut(ctx, x, y, radius, splitProgress) {
        ctx.save();
        ctx.translate(x, y);
        const dist = splitProgress * 40;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1f130b';

        ctx.save();
        ctx.translate(-dist, 0);
        ctx.rotate(-splitProgress * 0.5);
        ctx.fillStyle = '#5c3a21';
        ctx.beginPath();
        ctx.arc(0, 0, radius, Math.PI * 0.5, Math.PI * 1.5, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 0.4, radius, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(dist, 0);
        ctx.rotate(splitProgress * 0.5);
        ctx.fillStyle = '#5c3a21';
        ctx.beginPath();
        ctx.arc(0, 0, radius, Math.PI * 1.5, Math.PI * 0.5, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 0.4, radius, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();
    }

    drawBambooWallTrampoline(ctx, canvasWidth, y, isLeftWall, hitAnimProgress) {
        ctx.save();
        const height = 120;
        const baseWidth = 25;
        const deflection = Math.sin(hitAnimProgress * Math.PI) * 35;
        const startX = isLeftWall ? 0 : canvasWidth;
        const endX = isLeftWall ? 0 : canvasWidth;
        const midX = isLeftWall ? (baseWidth - deflection) : (canvasWidth - baseWidth + deflection);

        ctx.fillStyle = '#a1cc36';
        ctx.strokeStyle = '#1b3305';
        ctx.lineWidth = 5;

        ctx.beginPath();
        ctx.moveTo(startX, y - height / 2);
        ctx.quadraticCurveTo(midX, y - height * 0.25, midX, y);
        ctx.quadraticCurveTo(midX, y + height * 0.25, endX, y + height / 2);
        ctx.lineTo(startX, y + height / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#1b3305';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(isLeftWall ? 0 : canvasWidth, y);
        ctx.lineTo(midX, y);
        ctx.stroke();
        ctx.restore();
    }

    drawJungleFireflies(ctx, firefliesArray) {
        ctx.save();
        for (let i = 0; i < firefliesArray.length; i++) {
            const f = firefliesArray[i];
            const alpha = 0.4 + Math.sin(f.pulsePhase) * 0.5;
            const currentSize = f.size * (1 + Math.sin(f.pulsePhase) * 0.2);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.shadowBlur = currentSize * 2.5;
            ctx.shadowColor = '#d2ff36';
            ctx.fillStyle = '#ffffff';

            ctx.beginPath();
            ctx.arc(f.x, f.y, currentSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }
}


// ==========================================
// УПРАВЛЯЮЩИЙ МЕНЕДЖЕР БИОМОВ (Синглтон)
// ==========================================
class MapManager {
    constructor() {
        this.engines = {
            canyon: new CanyonMapEngine(),
            jungle: new JungleMapEngine()
        };
        // Текущий биом по умолчанию (можно менять из меню магазина/кастомизации)
        this.currentBiome = 'canyon';
    }

    setBiome(biomeId) {
        if (this.engines[biomeId]) {
            this.currentBiome = biomeId;
            localStorage.setItem('tomCurrentBiome', biomeId);
        }
    }

    getActiveEngine() {
        // Подхватываем сохраненный биом, если он есть
        const saved = localStorage.getItem('tomCurrentBiome');
        if (saved && this.engines[saved]) {
            this.currentBiome = saved;
        }
        return this.engines[this.currentBiome];
    }

    // Проксирующие методы, которые вызывают активный биом
    init(W, H, WALL_W) {
        this.getActiveEngine().init(W, H, WALL_W);
    }

    spawnObstacle(y, W, WALL_W, difficulty = 0, rng = Math.random) {
        return this.getActiveEngine().spawnObstacle(y, W, WALL_W, difficulty, rng);
    }

    update(tom, W, H, deltaFactor, gameTime, onHazardHit, onBounce) {
        this.getActiveEngine().update(tom, W, H, deltaFactor, gameTime, onHazardHit, onBounce);
    }

    drawBackground(ctx, W, H, WALL_W, cameraY, gameTime) {
        this.getActiveEngine().drawBackground(ctx, W, H, WALL_W, cameraY, gameTime);
    }

    drawObstacles(ctx) {
        this.getActiveEngine().drawObstacles(ctx);
    }

    get obstacles() {
        return this.getActiveEngine().obstacles;
    }
    set obstacles(val) {
        this.getActiveEngine().obstacles = val;
    }
}

// Экспортируем под именем BackgroundEngine, чтобы координирующий игровой модуль не сломался
window.BackgroundEngine = new MapManager();
