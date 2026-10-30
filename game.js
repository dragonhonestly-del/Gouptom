/**
 * game.js — Главный координатор и игровой цикл «ТОЛЬКО ВВЕРХ!»
 * 
 * Синхронизирован с:
 *  - Physics (physics.js)
 *  - BackgroundEngine (background.js)
 *  - CustomManager (skins.js) -> TomModel (model.js)
 *  - Pins (pins.js)
 *  - TrailEngine (trails.js)
 *  - sfx (sound.js)
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('app-wrapper') || document.body;

let W = 430, H = 820;

function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    W = rect.width || 430;
    H = rect.height || 820;
    canvas.width = W;
    canvas.height = H;

    const wallW = window.Physics ? window.Physics.WALL_W : 28;
    if (window.BackgroundEngine) {
        window.BackgroundEngine.init(W, H, wallW);
    }
}
window.addEventListener('resize', resizeCanvas);

// Детерминированный генератор случайных чисел по Seed
let currentSeed = Date.now();
function seededRandom() {
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    return currentSeed / 4294967296;
}

// Состояние игровой сессии
let gameState = 'MENU', gameMode = 'solo';
let score = 0, bestScore = parseInt(localStorage.getItem('tomCanyonBest') || '0', 10), combo = 1;
let maxReachedY = 0, startY = 0, highestSpawnY = 0, gameTime = 0, lastFrameTime = performance.now();

// Главный герой
let tom = {
    x: 220, y: 500, vx: 0, vy: 0, radius: 34, state: 'STUCK',
    attachedPin: null, ignorePin: null, ignoreTimer: 15,
    swingAngle: 0, swingVel: 0, jellyX: 1, jellyY: 1, jellyVelX: 0, jellyVelY: 0,
    blinkTimer: 120, lookX: 0, lookY: 0, hasShield: false, shieldTimer: 0, deathReason: ''
};

// Сетевой соперник
let opponent = {
    active: false, x: 220, y: 500, vx: 0, vy: 0, state: 'STUCK',
    pinX: 220, pinY: 420, score: 0, dead: false
};

// Игровые коллекции
let pins = [], bonuses = [], particles = [], floatingTexts = [];

function formatNumber(n) {
    return n >= 10000 ? (n / 1000).toFixed(1) + 'K' : n.toString();
}

function updateHUD() {
    const sEl = document.getElementById('hud-score');
    const bEl = document.getElementById('hud-best');
    const eEl = document.getElementById('hud-enemy-score');
    if (sEl) sEl.textContent = formatNumber(score);
    if (bEl) bEl.textContent = formatNumber(bestScore);
    if (eEl && gameMode === 'duel') eEl.textContent = formatNumber(opponent.score);
}

// Инициализация новой партии
function initGame(seed = Date.now(), mode = 'solo') {
    resizeCanvas();
    currentSeed = seed;
    gameMode = mode;
    score = 0;
    combo = 1;
    gameTime = 0;

    startY = H - 180;
    maxReachedY = startY;
    highestSpawnY = startY;

    if (window.Physics) window.Physics.resetCamera(0);

    pins = [];
    bonuses = [];
    particles = [];
    floatingTexts = [];

    if (window.BackgroundEngine) {
        const wallW = window.Physics ? window.Physics.WALL_W : 28;
        window.BackgroundEngine.init(W, H, wallW);
    }

    // Стартовые плитки
    const startPin = window.Pins.createPin(W / 2, startY, 'blue', 110, seededRandom);
    startPin.visited = true;
    pins.push(startPin);
    pins.push(window.Pins.createPin(W * 0.35, startY - 370, 'blue', 110, seededRandom));
    pins.push(window.Pins.createPin(W * 0.65, startY - 740, 'blue', 110, seededRandom));
    highestSpawnY = startY - 740;

    const camY = window.Physics ? window.Physics.camera.y : 0;
    while (highestSpawnY > camY - H * 1.5) {
        spawnNextSection();
    }

    // Привязываем Тома
    tom.attachedPin = startPin;
    tom.state = 'STUCK';
    tom.x = startPin.x;
    tom.y = startPin.y + 88;
    tom.vx = 0; tom.vy = 0;
    tom.swingAngle = 0; tom.swingVel = 0;
    tom.jellyX = 1; tom.jellyY = 1;
    tom.hasShield = false; tom.shieldTimer = 0;
    tom.deathReason = '';

    // Настройка соперника
    opponent.active = (mode === 'duel');
    opponent.x = startPin.x;
    opponent.y = startPin.y + 88;
    opponent.pinX = startPin.x;
    opponent.pinY = startPin.y;
    opponent.score = 0;
    opponent.dead = false;
    opponent.state = 'STUCK';

    updateHUD();
}

// Генерация секции каньона
function spawnNextSection() {
    const stepY = 370 + seededRandom() * 45;
    highestSpawnY -= stepY;
    const y = highestSpawnY;
    const heightMeters = Math.max(0, Math.floor((startY - y) / 25));
    const difficulty = Math.min(1, heightMeters / 140);

    const wallW = window.Physics ? window.Physics.WALL_W : 28;
    const safeMinX = wallW + 96;
    const safeMaxX = W - wallW - 96;
    let pinX = safeMinX + seededRandom() * (safeMaxX - safeMinX);

    // Спавн препятствий
    if (heightMeters > 4 && seededRandom() < (0.38 + difficulty * 0.2)) {
        if (window.BackgroundEngine) {
            const obsSide = window.BackgroundEngine.spawnObstacle(y + stepY * 0.5, W, wallW, difficulty, seededRandom);
            if (obsSide === 'left') pinX = W * 0.65 + seededRandom() * (safeMaxX - W * 0.65);
            else if (obsSide === 'right') pinX = safeMinX + seededRandom() * (W * 0.35 - safeMinX);
        }
    }

    // Спавн плитки
    let pType = 'blue';
    const typeRoll = seededRandom();
    if (heightMeters > 6) {
        if (typeRoll < 0.16 + difficulty * 0.1) pType = 'red';
        else if (typeRoll < 0.32 + difficulty * 0.08) pType = seededRandom() < 0.55 ? 'rail_v' : 'rail_h';
    }
    if (pType === 'rail_h') pinX = W / 2;
    
    if (window.Pins) {
        pins.push(window.Pins.createPin(pinX, y, pType, 110, seededRandom));
    }

    // Спавн щита
    if (seededRandom() < 0.18) {
        bonuses.push({
            x: seededRandom() < 0.5 ? W * 0.3 : W * 0.7,
            y: y + stepY * 0.45,
            radius: 26, collected: false, bobPhase: seededRandom() * Math.PI * 2
        });
    }
}

// Система частиц
function spawnParticles(x, y, color, count = 12, speed = 4.5) {
    for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.3 + Math.random() * 0.8) * speed;
        particles.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 1.2,
            radius: 2.8 + Math.random() * 4,
            color, alpha: 1, decay: 0.024 + Math.random() * 0.018
        });
    }
}

function addFloatingScore(x, y, text, color = '#ffffff', scale = 1) {
    floatingTexts.push({ x, y, text, color, scale, alpha: 1, vy: -2 });
}

function addScorePoints(pts, x, y, labelPrefix = '+') {
    score += pts;
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('tomCanyonBest', bestScore.toString());
    }
    updateHUD();
    if (x !== undefined && y !== undefined) {
        addFloatingScore(x, y, `${labelPrefix}${pts}`, '#ffffff', 1.15);
    }
}

// Обработка урона от препятствий
function triggerHazardHit(hx, hy, text) {
    if (tom.state === 'DEAD') return;

    if (tom.hasShield) {
        tom.hasShield = false;
        tom.shieldTimer = 0;
        if (window.sfx) window.sfx.playHit(true);
        if (window.Physics) window.Physics.addShake(8);
        spawnParticles(tom.x, tom.y, '#ef4444', 22, 6);
        addFloatingScore(tom.x, tom.y - 30, 'ЩИТ СПАС!', '#fde047', 1.2);

        const ang = Math.atan2(tom.y - hy, tom.x - hx);
        tom.vx = Math.cos(ang) * 8;
        tom.vy = -12;
        tom.state = 'FLYING';
        tom.attachedPin = null;
        tom.jellyX = 1.3;
        tom.jellyY = 0.72;
    } else {
        tom.state = 'DEAD';
        tom.attachedPin = null;
        tom.vy = -8;
        tom.vx = (tom.x < hx ? -1 : 1) * 5;
        tom.deathReason = text;
        combo = 1;
        if (window.Physics) window.Physics.addShake(14);
        if (window.sfx) window.sfx.playHit(false);
        spawnParticles(tom.x, tom.y, '#f43f5e', 26, 6.5);
        addFloatingScore(tom.x, tom.y - 20, 'АЙ!', '#fb7185', 1.3);
        updateHUD();
    }
}

// Управление
function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    let cx = e.clientX, cy = e.clientY;
    if (e.touches && e.touches.length > 0) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; } 
    else if (e.changedTouches && e.changedTouches.length > 0) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
    return { x: (cx - rect.left) * (W / rect.width), y: (cy - rect.top) * (H / rect.height) };
}

canvas.addEventListener('mousedown', (e) => {
    if (gameState !== 'PLAYING') return;
    if (window.sfx) window.sfx.init();
    if (window.Physics) window.Physics.handlePointerDown(getPointerPos(e), tom);
});
window.addEventListener('mousemove', (e) => {
    if (gameState !== 'PLAYING' || !window.Physics) return;
    window.Physics.handlePointerMove(getPointerPos(e), tom);
});
window.addEventListener('mouseup', () => {
    if (gameState !== 'PLAYING' || !window.Physics) return;
    if (window.Physics.handlePointerUp(tom)) spawnParticles(tom.x, tom.y - 22, '#ffffff', 10, 4);
});

canvas.addEventListener('touchstart', (e) => {
    if (e.target === canvas) e.preventDefault();
    if (gameState !== 'PLAYING') return;
    if (window.sfx) window.sfx.init();
    if (window.Physics) window.Physics.handlePointerDown(getPointerPos(e), tom);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (window.Physics && window.Physics.drag.active) e.preventDefault();
    if (gameState !== 'PLAYING' || !window.Physics) return;
    window.Physics.handlePointerMove(getPointerPos(e), tom);
}, { passive: false });

window.addEventListener('touchend', () => {
    if (gameState !== 'PLAYING' || !window.Physics) return;
    if (window.Physics.handlePointerUp(tom)) spawnParticles(tom.x, tom.y - 22, '#ffffff', 10, 4);
});

// Игровая логика
function update(deltaFactor) {
    gameTime++;

    if (window.TrailEngine) window.TrailEngine.update(deltaFactor);

    if (gameState !== 'PLAYING') {
        if (window.BackgroundEngine) window.BackgroundEngine.update(tom, W, H, deltaFactor, gameTime, () => {}, () => {});
        return;
    }

    // 1. Физика
    if (window.Physics) {
        const obsList = window.BackgroundEngine ? window.BackgroundEngine.obstacles : [];
        window.Physics.update(tom, pins, obsList, W, H, deltaFactor);
    }

    // 2. След
    if (tom.state === 'FLYING' && Math.hypot(tom.vx, tom.vy) > 3 && window.TrailEngine) {
        window.TrailEngine.emit(tom.x, tom.y, tom.vx, tom.vy);
    }

    // 3. Плитки
    if (window.Pins) {
        window.Pins.update(pins, tom, deltaFactor, (brokenPin) => {
            tom.state = 'FLYING';
            tom.attachedPin = null;
            tom.vx = (Math.random() - 0.5) * 2;
            tom.vy = 2;
            if (window.Physics) window.Physics.drag.active = false;
            if (window.sfx) window.sfx.playHit(true);
            spawnParticles(brokenPin.x, brokenPin.y, '#ef4444', 16, 4.5);
        });
    }

    // 4. Зацеп
    if (tom.state === 'FLYING') {
        if (tom.y < maxReachedY) {
            const diffMeters = Math.floor((maxReachedY - tom.y) / 14);
            if (diffMeters > 0) {
                maxReachedY -= diffMeters * 14;
                addScorePoints(diffMeters * 2);
            }
        }

        for (let i = 0; i < pins.length; i++) {
            const p = pins[i];
            if (p === tom.ignorePin || (p.type === 'red' && p.broken)) continue;
            if (Math.hypot(tom.x - p.x, (tom.y - 24) - p.y) <= p.catchRadius + 14) {
                tom.state = 'STUCK';
                tom.attachedPin = p;
                tom.swingAngle = Math.max(-0.7, Math.min(0.7, (tom.x - p.x) * 0.015));
                tom.swingVel = tom.vx * 0.016;
                tom.vx = 0; tom.vy = 0;
                tom.jellyX = 1.26; tom.jellyY = 0.78;
                p.pulseAnim = 1;

                if (!p.visited) {
                    p.visited = true;
                    addScorePoints(100 * combo, p.x, p.y - 36, '+');
                    combo = Math.min(10, combo + 1);
                } else combo = 1;

                updateHUD();
                if (window.sfx) window.sfx.playLatch(combo, p.type === 'red');
                spawnParticles(p.x, p.y, '#7dd3fc', 12, 4);
                break;
            }
        }
    }

    // 5. Препятствия
    if (window.BackgroundEngine) {
        window.BackgroundEngine.update(tom, W, H, deltaFactor, gameTime, triggerHazardHit, (bx, by) => {
            if (window.sfx) window.sfx.playWallBounce();
            if (window.Physics) window.Physics.addShake(3);
            spawnParticles(bx, by, '#fde68a', 8, 3.2);
        });
    }

    // 6. Щиты
    for (let i = 0; i < bonuses.length; i++) {
        const b = bonuses[i];
        if (!b.collected && Math.hypot(tom.x - b.x, tom.y - b.y) < tom.radius + b.radius) {
            b.collected = true;
            if (window.sfx) window.sfx.playBonus();
            tom.hasShield = true;
            tom.shieldTimer = 900;
            addScorePoints(200, b.x, b.y - 20, '🛡️ +');
            spawnParticles(b.x, b.y, '#38bdf8', 20, 5.5);
        }
    }

    // 7. Очистка
    const camY = window.Physics ? window.Physics.camera.y : 0;
    while (highestSpawnY > camY - H * 1.5) spawnNextSection();

    const cleanupY = camY + H + 360;
    pins = pins.filter(p => p.y < cleanupY);
    if (window.BackgroundEngine) window.BackgroundEngine.obstacles = window.BackgroundEngine.obstacles.filter(o => o.y < cleanupY);
    bonuses = bonuses.filter(b => !b.collected && b.y < cleanupY);

    // 8. Сеть
    if (gameMode === 'duel' && window.DuelNetwork && typeof window.DuelNetwork.sendState === 'function') {
        window.DuelNetwork.sendState({
            x: tom.x, y: tom.y, vx: tom.vx, vy: tom.vy, state: tom.state,
            pinX: tom.attachedPin ? tom.attachedPin.x : tom.x,
            pinY: tom.attachedPin ? tom.attachedPin.y : tom.y - 78,
            score, dead: false
        });
    }

    // 9. Смерть (падение)
    if (tom.y - camY > H + 120) {
        if (window.sfx) window.sfx.playHit(false);
        gameState = 'GAMEOVER';
        if (gameMode === 'duel' && window.DuelNetwork && typeof window.DuelNetwork.notifyLocalDeath === 'function') {
            window.DuelNetwork.notifyLocalDeath(score, tom.deathReason);
        } else if (window.AppHub) {
            window.AppHub.onGameOver({ score, best: bestScore, title: 'ТОМ СОРВАЛСЯ!', subtitle: `${tom.deathReason || 'Упал в пропасть'} • Счёт: ${score}` });
        }
    }

    // 10. Анимация текста и частиц
    for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx * deltaFactor; pt.y += pt.vy * deltaFactor; pt.vy += 0.14 * deltaFactor; pt.alpha -= pt.decay * deltaFactor;
        if (pt.alpha <= 0) particles.splice(i, 1);
    }
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy * deltaFactor; ft.alpha -= 0.02 * deltaFactor;
        if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }
}

// Отрисовка
function render() {
    ctx.clearRect(0, 0, W, H);
    const cam = window.Physics ? window.Physics.camera : { y: 0, xOffset: 0, zoom: 1, shakeX: 0, shakeY: 0 };
    const wallW = window.Physics ? window.Physics.WALL_W : 28;

    if (window.BackgroundEngine) window.BackgroundEngine.drawBackground(ctx, W, H, wallW, cam.y, gameTime);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-W / 2 + cam.xOffset + cam.shakeX, -H / 2 - cam.y + cam.shakeY);

    if (window.Pins) pins.forEach(p => window.Pins.draw(ctx, p, tom));

    bonuses.forEach(b => {
        if (b.collected) return;
        ctx.save();
        ctx.translate(b.x, b.y + Math.sin(gameTime * 0.07 + b.bobPhase) * 5);
        ctx.fillStyle = 'rgba(105, 58, 18, 0.28)'; ctx.beginPath(); ctx.arc(4, 8, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#38bdf8'; ctx.strokeStyle = '#1e1b18'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    if (window.BackgroundEngine) window.BackgroundEngine.drawObstacles(ctx);
    if (window.TrailEngine) window.TrailEngine.draw(ctx);
    if (window.Physics) window.Physics.drawAimDots(ctx, tom, W);

    // Чистый вызов отрисовки из CustomManager
    if (window.CustomManager && typeof window.CustomManager.renderCharacter === 'function') {
        const dragObj = window.Physics ? window.Physics.drag : null;
        if (gameMode === 'duel' && opponent.active) {
            window.CustomManager.renderCharacter(ctx, opponent, true, gameTime, null);
        }
        window.CustomManager.renderCharacter(ctx, tom, false, gameTime, dragObj);
    }

    particles.forEach(pt => {
        ctx.save(); ctx.globalAlpha = Math.max(0, pt.alpha); ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });

    floatingTexts.forEach(ft => {
        ctx.save(); ctx.globalAlpha = Math.max(0, ft.alpha); ctx.font = `900 ${Math.round(26 * ft.scale)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.fillStyle = ft.color; ctx.strokeStyle = 'rgba(62, 32, 9, 0.7)'; ctx.lineWidth = 3.5;
        ctx.strokeText(ft.text, ft.x, ft.y); ctx.fillText(ft.text, ft.x, ft.y); ctx.restore();
    });

    ctx.restore();
}

function gameLoop(timestamp) {
    const deltaMs = Math.min(32, timestamp - lastFrameTime);
    lastFrameTime = timestamp;
    update(deltaMs / 16.66);
    render();
    requestAnimationFrame(gameLoop);
}

// Экспорт API
window.GameEngine = {
    start({ mode = 'solo', seed = Date.now() } = {}) {
        if (window.sfx) window.sfx.init();
        gameState = 'PLAYING';
        initGame(seed, mode);
    },
    stop() { gameState = 'MENU'; },
    updateOpponent(data) { opponent.active = true; Object.assign(opponent, data); updateHUD(); },
    spawnBounceParticles(x, y) { spawnParticles(x, y, '#fde68a', 8, 3.2); },
    getScore() { return score; },
    isDead() { return gameState === 'GAMEOVER' || tom.state === 'DEAD'; }
};

// Прямой старт без бесконечных проверок
initGame();
requestAnimationFrame(gameLoop);
