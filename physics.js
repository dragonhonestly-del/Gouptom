/**
 * physics.js — Улучшенный физический и кинематический движок
 */

class PhysicsEngine {
    constructor() {
        // Константы мира каньона
        this.WALL_W = 28;
        this.BASE_GRAVITY = 0.34;
        this.BASE_AIR_DRAG = 0.995;
        this.WALL_BOUNCE = 0.82;
        this.MAX_PULL = 145;
        this.LAUNCH_POWER = 0.185;

        // Камера и кинематографика
        this.camera = {
            y: 0,
            xOffset: 0,
            targetXOffset: 0,
            zoom: 1.0,
            targetZoom: 1.0,
            shakeX: 0,
            shakeY: 0,
            shakeIntensity: 0
        };

        // Ввод и натяжение
        this.drag = {
            active: false,
            startX: 0,
            startY: 0,
            currX: 0,
            currY: 0,
            dx: 0,
            dy: 0,
            pullRatio: 0,
            lastSoundTime: 0
        };
    }

    resetCamera(initialY) {
        this.camera.y = initialY;
        this.camera.xOffset = 0;
        this.camera.targetXOffset = 0;
        this.camera.zoom = 1.0;
        this.camera.targetZoom = 1.0;
        this.camera.shakeIntensity = 0;
        this.drag.active = false;
        this.drag.dx = 0;
        this.drag.dy = 0;
    }

    addShake(intensity) {
        this.camera.shakeIntensity = Math.min(12, this.camera.shakeIntensity + intensity);
    }

    handlePointerDown(pos, tom) {
        if (tom.state !== 'STUCK') return false;
        this.drag.active = true;
        this.drag.startX = pos.x;
        this.drag.startY = pos.y;
        this.drag.currX = pos.x;
        this.drag.currY = pos.y;
        this.drag.dx = 0;
        this.drag.dy = 0;
        this.drag.pullRatio = 0;
        return true;
    }

    handlePointerMove(pos, tom) {
        if (!this.drag.active || tom.state !== 'STUCK') return;

        this.drag.currX = pos.x;
        this.drag.currY = pos.y;

        let rawDx = this.drag.startX - this.drag.currX;
        let rawDy = this.drag.startY - this.drag.currY;
        const dist = Math.hypot(rawDx, rawDy);

        if (dist > this.MAX_PULL) {
            rawDx = (rawDx / dist) * this.MAX_PULL;
            rawDy = (rawDy / dist) * this.MAX_PULL;
        }

        this.drag.dx = rawDx;
        this.drag.dy = rawDy;
        this.drag.pullRatio = Math.min(1, dist / this.MAX_PULL);

        // ИСПРАВЛЕНИЕ: Отключаем боковой сдвиг камеры, чтобы передний план не отрывался от стен
        this.camera.targetXOffset = 0;

        // Плавный кинематографичный зум при натяжении (смягчен до 1.05x, чтобы не резать края)
        this.camera.targetZoom = 1.0 + this.drag.pullRatio * 0.05;

        // Легкий трепет натяжения на пределе
        if (this.drag.pullRatio > 0.90) {
            const tremor = (this.drag.pullRatio - 0.90) * 5;
            this.camera.shakeX = (Math.random() - 0.5) * tremor;
            this.camera.shakeY = (Math.random() - 0.5) * tremor;
        } else {
            this.camera.shakeX = 0;
            this.camera.shakeY = 0;
        }

        const now = performance.now();
        if (dist > 18 && now - this.drag.lastSoundTime > 85) {
            if (window.sfx && typeof window.sfx.playRubberStretch === 'function') {
                window.sfx.playRubberStretch(this.drag.pullRatio);
            }
            this.drag.lastSoundTime = now;
        }
    }

    handlePointerUp(tom) {
        if (!this.drag.active) return false;
        this.drag.active = false;
        this.camera.targetXOffset = 0;
        this.camera.targetZoom = 1.0;

        const dist = Math.hypot(this.drag.dx, this.drag.dy);
        if (dist > 16 && tom.state === 'STUCK') {
            tom.vx = this.drag.dx * this.LAUNCH_POWER;
            tom.vy = this.drag.dy * this.LAUNCH_POWER;
            tom.state = 'FLYING';
            tom.ignorePin = tom.attachedPin;
            tom.ignoreTimer = 14;
            tom.attachedPin = null;

            tom.jellyX = 0.65;
            tom.jellyY = 1.38;

            this.addShake(4);

            if (window.sfx && typeof window.sfx.playLaunch === 'function') {
                window.sfx.playLaunch();
            }

            this.drag.dx = 0;
            this.drag.dy = 0;
            return true;
        }

        this.drag.dx = 0;
        this.drag.dy = 0;
        return false;
    }

    update(tom, pins, obstacles, W, H, deltaFactor = 1.0) {
        if (this.camera.shakeIntensity > 0) {
            this.camera.shakeX = (Math.random() - 0.5) * this.camera.shakeIntensity;
            this.camera.shakeY = (Math.random() - 0.5) * this.camera.shakeIntensity;
            this.camera.shakeIntensity *= 0.88;
            if (this.camera.shakeIntensity < 0.2) this.camera.shakeIntensity = 0;
        }

        // Жесткая центровка по X и плавная интерполяция зума
        this.camera.xOffset = 0;
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.12 * deltaFactor;

        // Пружинистое желе
        tom.jellyVelX += (1 - tom.jellyX) * 0.24 * deltaFactor;
        tom.jellyVelY += (1 - tom.jellyY) * 0.24 * deltaFactor;
        tom.jellyVelX *= Math.pow(0.74, deltaFactor);
        tom.jellyVelY *= Math.pow(0.74, deltaFactor);
        tom.jellyX += tom.jellyVelX * deltaFactor;
        tom.jellyY += tom.jellyVelY * deltaFactor;

        tom.blinkTimer -= deltaFactor;
        if (tom.blinkTimer < -8) {
            tom.blinkTimer = 110 + Math.floor(Math.random() * 130);
        }

        if (tom.shieldTimer > 0) {
            tom.shieldTimer -= deltaFactor;
            if (tom.shieldTimer <= 0) {
                tom.shieldTimer = 0;
                tom.hasShield = false;
            }
        }

        if (tom.state === 'STUCK' && tom.attachedPin) {
            const p = tom.attachedPin;
            const hangDistance = 78;

            if (this.drag.active) {
                const pullX = -this.drag.dx * 0.55;
                const pullY = -this.drag.dy * 0.55;
                const targetX = p.x + pullX;
                const targetY = p.y + hangDistance + pullY;

                tom.x += (targetX - tom.x) * 0.42 * deltaFactor;
                tom.y += (targetY - tom.y) * 0.42 * deltaFactor;

                tom.swingAngle = Math.atan2(tom.x - p.x, Math.max(25, tom.y - p.y));
                tom.lookX = this.drag.dx * 0.04;
                tom.lookY = this.drag.dy * 0.04;
            } else {
                // Улучшенная физика маятника (качается плавнее и дольше)
                tom.swingVel += -0.075 * tom.swingAngle * deltaFactor;
                tom.swingVel *= Math.pow(0.95, deltaFactor);
                tom.swingAngle += tom.swingVel * deltaFactor;

                tom.x = p.x + Math.sin(tom.swingAngle) * hangDistance;
                tom.y = p.y + Math.cos(tom.swingAngle) * hangDistance;
                tom.lookX *= 0.85;
                tom.lookY = -2;
            }
            tom.vx = 0;
            tom.vy = 0;

        } else if (tom.state === 'FLYING' || tom.state === 'DEAD') {
            if (tom.ignoreTimer > 0) {
                tom.ignoreTimer -= deltaFactor;
                if (tom.ignoreTimer <= 0) tom.ignorePin = null;
            }

            tom.vy += this.BASE_GRAVITY * deltaFactor;
            const curDrag = Math.pow(this.BASE_AIR_DRAG, deltaFactor);
            tom.vx *= curDrag;
            tom.vy *= curDrag;

            tom.x += tom.vx * deltaFactor;
            tom.y += tom.vy * deltaFactor;

            tom.lookX = Math.max(-5, Math.min(5, tom.vx * 0.35));
            tom.lookY = Math.max(-5, Math.min(5, tom.vy * 0.35));

            if (tom.x - tom.radius < this.WALL_W) {
                tom.x = this.WALL_W + tom.radius;
                tom.vx = Math.abs(tom.vx) * this.WALL_BOUNCE;
                tom.jellyX = 0.68;
                tom.jellyY = 1.3;
                this.addShake(2.5);
                if (window.sfx) window.sfx.playWallBounce();
                if (window.GameEngine && window.GameEngine.spawnBounceParticles) {
                    window.GameEngine.spawnBounceParticles(this.WALL_W, tom.y);
                }
            } 
            else if (tom.x + tom.radius > W - this.WALL_W) {
                tom.x = W - this.WALL_W - tom.radius;
                tom.vx = -Math.abs(tom.vx) * this.WALL_BOUNCE;
                tom.jellyX = 0.68;
                tom.jellyY = 1.3;
                this.addShake(2.5);
                if (window.sfx) window.sfx.playWallBounce();
                if (window.GameEngine && window.GameEngine.spawnBounceParticles) {
                    window.GameEngine.spawnBounceParticles(W - this.WALL_W, tom.y);
                }
            }
        }

        const targetCamY = tom.y - H * 0.64;
        if (targetCamY < this.camera.y) {
            this.camera.y += (targetCamY - this.camera.y) * 0.098 * deltaFactor;
        } else if (targetCamY > this.camera.y + 140 && this.camera.y < 0) {
            this.camera.y += (targetCamY - this.camera.y) * 0.05 * deltaFactor;
        }
    }

    drawAimDots(ctx, tom, W) {
        if (!this.drag.active || tom.state !== 'STUCK') return;
        if (Math.hypot(this.drag.dx, this.drag.dy) < 16) return;

        ctx.save();
        let simX = tom.x;
        let simY = tom.y;
        let simVx = this.drag.dx * this.LAUNCH_POWER;
        let simVy = this.drag.dy * this.LAUNCH_POWER;

        for (let step = 1; step <= 26; step++) {
            simVy += this.BASE_GRAVITY;
            simVx *= this.BASE_AIR_DRAG;
            simVy *= this.BASE_AIR_DRAG;
            simX += simVx;
            simY += simVy;

            if (simX - tom.radius < this.WALL_W) {
                simX = this.WALL_W + tom.radius;
                simVx = Math.abs(simVx) * this.WALL_BOUNCE;
            } else if (simX + tom.radius > W - this.WALL_W) {
                simX = W - this.WALL_W - tom.radius;
                simVx = -Math.abs(simVx) * this.WALL_BOUNCE;
            }

            if (step % 2 === 0) {
                const alpha = (1 - step / 28) * 0.88;
                const r = Math.max(2.5, 6.4 - step * 0.16);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.strokeStyle = `rgba(62, 32, 9, ${alpha * 0.65})`;
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.arc(simX, simY, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}

window.Physics = new PhysicsEngine();
