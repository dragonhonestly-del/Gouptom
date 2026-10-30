/**
 * game.js — Главное ядро игрового цикла «ТОЛЬКО ВВЕРХ!»
 * Управляет сессией, спавном уровней по Seed, очками и связывает модули.
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
    if (window.BackgroundEngine) window.BackgroundEngine.init(W, H, Physics.WALL_W);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Детерминированный генератор случайных чисел для дуэлей
let currentSeed = Date.now();
function seededRandom() {
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    return currentSeed / 4294967296;
}

// Переменные сессии
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

// Сетевой соперник (дуэль)
let opponent = {
    active: false, x: 220, y: 500, vx: 0, vy: 0, state: 'STUCK',
    pinX: 220, pinY: 420, score: 0, dead: false
};

let pins = [], bonuses = [], particles = [], floatingTexts = [];

function formatNumber(n) { return n >= 10000 ? (n / 1000).toFixed(1) + 'K' : n.toString(); }

function updateHUD() {
    const sEl = document.getElementById('hud-score') || document.getElementById('scoreVal');
    const bEl = document.getElementById('hud-best') || document.getElementById('bestVal');
    const cEl = document.getElementById('comboVal');
    const eEl = document.getElementById('hud-enemy-score');
    if (sEl) sEl.textContent = formatNumber(score);
    if (bEl) bEl.textContent = formatNumber(bestScore);
    if (cEl) cEl.textContent = 'x' + combo;
    if (eEl && gameMode === 'duel') eEl.textContent = formatNumber(opponent.score);
}

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
    Physics.resetCamera(0);

    pins = [];
    bonuses = [];
    particles = [];
    floatingTexts = [];
    Obstacles.clear();

    const startPin = Pins.createPin(W / 2, startY, 'blue', 110, seededRandom);
    startPin.visited = true;
    pins.push(startPin);
    pins.push(Pins.createPin(W * 0.35, startY - 370, 'blue', 110, seededRandom));
    pins.push(Pins.createPin(W * 0.65, startY - 740, 'blue', 110, seededRandom));
    highestSpawnY = startY - 740;

    while (highestSpawnY > Physics.camera.y - H * 1.5) spawnNextSection();

    tom.attachedPin = startPin;
    tom.state = 'STUCK';
    tom.x = startPin.x;
    tom.y = startPin.y + 88;
    tom.vx = 0; tom.vy = 0; tom.swingAngle = 0; tom.swingVel = 0;
    tom.jellyX = 1; tom.jellyY = 1; tom.hasShield = false; tom.shieldTimer = 0; tom.deathReason = '';

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

function spawnNextSection() {
    const stepY = 370 + seededRandom() * 45;
    highestSpawnY -= stepY;
    const y = highestSpawnY;
    const heightMeters = Math.max(0, Math.floor((startY - y) / 25));
    const difficulty = Math.min(1, heightMeters / 140);
    const safeMinX = Physics.WALL_W + 96, safeMaxX = W - Physics.WALL_W - 96;
    let pinX = safeMinX + seededRandom() * (safeMaxX - safeMinX);

    if (heightMeters > 4 && seededRandom() < (0.38 + difficulty * 0.2)) {
        const obsSide = Obstacles.spawnAt(y + stepY * 0.5, W, Physics.WALL_W, difficulty, seededRandom);
        if (obsSide === 'left') pinX = W * 0.65 + seededRandom() * (safeMaxX - W * 0.65);
        else if (obsSide === 'right') pinX = safeMinX + seededRandom() * (W * 0.35 - safeMinX);
    }

    let pType = 'blue';
    const typeRoll = seededRandom();
    if (heightMeters > 6) {
        if (typeRoll < 0.16 + difficulty * 0.1) pType = 'red';
        else if (typeRoll < 0.32 + difficulty * 0.08) pType = seededRandom() < 0.55 ? 'rail_v' : 'rail_h';
    }
    if (pType === 'rail_h') pinX = W / 2;
    pins.push(Pins.createPin(pinX, y, pType, 110, seededRandom));

    if (seededRandom() < 0.18) {
        bonuses.push({
            x: seededRandom() < 0.5 ? W * 0.3 : W * 0.7,
            y: y + stepY * 0.45, radius: 26, collected: false, bobPhase: seededRandom() * Math.PI * 2
        });
    }
}

function triggerHazardHit(hx, hy, text) {
    if (tom.state === 'DEAD') return;
    if (tom.hasShield) {
        tom.hasShield = false;
        tom.shieldTimer = 0;
        if (window.sfx) sfx.playHit(true);
        Physics.addShake(8);
        addFloatingScore(tom.x, tom.y - 30, 'ЩИТ СПАС!', '#fde047', 1.2);
        const ang = Math.atan2(tom.y - hy, tom.x - hx);
        tom.vx = Math.cos(ang) * 8;
        tom.vy = -12;
        tom.state = 'FLYING';
        tom.attachedPin = null;
    } else {
        tom.state = 'DEAD';
        tom.attachedPin = null;
        tom.vy = -8;
        tom.vx = (tom.x < hx ? -1 : 1) * 5;
        tom.deathReason = text;
        combo = 1;
        Physics.addShake(14);
        if (window.sfx) sfx.playHit(false);
        addFloatingScore(tom.x, tom.y - 20, 'АЙ!', '#fb7185', 1.3);
        updateHUD();
    }
}

function addScorePoints(pts, x, y, labelPrefix = '+') {
    score += pts;
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('tomCanyonBest', bestScore.toString());
    }
    updateHUD();
    if (x !== undefined && y !== undefined) addFloatingScore(x, y, `${labelPrefix}${pts}`, '#ffffff', 1.15);
}

function addFloatingScore(x, y, text, color = '#ffffff', scale = 1) {
    floatingTexts.push({ x, y, text, color, scale, alpha: 1, vy: -2 });
}

// Обработка тач / мышь событий
function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches && e.touches[0] ? e.touches[0].clientX : (e.changedTouches ? e.changedTouches[0].clientX : e.clientX));
    const cy = (e.touches && e.touches[0] ? e.touches[0].clientY : (e.changedTouches ? e.changedTouches[0].clientY : e.clientY));
    return { x: (cx - rect.left) * (W / rect.width), y: (cy - rect.top) * (H / rect.height) };
}

canvas.addEventListener('mousedown', (e) => { if (gameState === 'PLAYING') { sfx.init(); Physics.handlePointerDown(getPointerPos(e), tom); } });
window.addEventListener('mousemove', (e) => { if (gameState === 'PLAYING') Physics.handlePointerMove(getPointerPos(e), tom); });
window.addEventListener('mouseup', () => { if (gameState === 'PLAYING') Physics.handlePointerUp(tom); });

canvas.addEventListener('touchstart', (e) => {
    if (e.target === canvas) e.preventDefault();
    if (gameState === 'PLAYING') { sfx.init(); Physics.handlePointerDown(getPointerPos(e), tom); }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (Physics.drag.active) e.preventDefault();
    if (gameState === 'PLAYING') Physics.handlePointerMove(getPointerPos(e), tom);
}, { passive: false });

window.addEventListener('touchend', () => { if (gameState === 'PLAYING') Physics.handlePointerUp(tom); });

// Главный цикл обновлений
function update(deltaFactor) {
    gameTime++;
    BackgroundEngine.updateDust(W, H, gameTime);
    TrailEngine.update(deltaFactor);

    if (gameState !== 'PLAYING') return;

    // Расчёт физики движения и камеры
    Physics.update(tom, pins, Obstacles.obstacles, W, H, deltaFactor);

    // След за летящим Томом
    if (tom.state === 'FLYING' && Math.hypot(tom.vx, tom.vy) > 3) {
        TrailEngine.emit(tom.x, tom.y, tom.vx, tom.vy);
    }

    // Обновление состояния плиток
    Pins.update(pins, tom, deltaFactor, (brokenPin) => {
        tom.state = 'FLYING';
        tom.attachedPin = null;
        tom.vx = (Math.random() - 0.5) * 2;
        tom.vy = 2;
        Physics.drag.active = false;
        if (window.sfx) sfx.playHit(true);
    });

    // Проверка зацепа за плитку в полете
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
                if (window.sfx) sfx.playLatch(combo, p.type === 'red');
                break;
            }
        }
    }

    // Проверка коллизий с препятствиями (шипы убивают, рельсы/балки толкают)
    Obstacles.update(tom, deltaFactor, triggerHazardHit, (bx, by) => {
        if (window.sfx) sfx.playWallBounce();
        Physics.addShake(3);
    });

    // Бонусы-щиты
    for (let i = 0; i < bonuses.length; i++) {
        const b = bonuses[i];
        if (!b.collected && Math.hypot(tom.x - b.x, tom.y - b.y) < tom.radius + b.radius) {
            b.collected = true;
            if (window.sfx) sfx.playBonus();
            tom.hasShield = true;
            tom.shieldTimer = 900;
            addScorePoints(200, b.x, b.y - 20, '🛡️ +');
        }
    }

    // Спавн новых секций и очистка пройденных
    while (highestSpawnY > Physics.camera.y - H * 1.5) spawnNextSection();
    const cleanupY = Physics.camera.y + H + 360;
    pins = pins.filter(p => p.y < cleanupY);
    Obstacles.obstacles = Obstacles.obstacles.filter(o => o.y < cleanupY);
    bonuses = bonuses.filter(b => !b.collected && b.y < cleanupY);

    // Дуэльная сетевая синхронизация
    if (gameMode === 'duel' && window.DuelNetwork && typeof window.DuelNetwork.sendState === 'function') {
        window.DuelNetwork.sendState({
            x: tom.x, y: tom.y, vx: tom.vx, vy: tom.vy, state: tom.state,
            pinX: tom.attachedPin ? tom.attachedPin.x : tom.x,
            pinY: tom.attachedPin ? tom.attachedPin.y : tom.y - 78,
            score: score, dead: false
        });
    }

    // Падение вниз экрана
    if (tom.y - Physics.camera.y > H + 120) {
        if (window.sfx) sfx.playHit(false);
        gameState = 'GAMEOVER';
        if (gameMode === 'duel' && window.DuelNetwork && typeof window.DuelNetwork.notifyLocalDeath === 'function') {
            window.DuelNetwork.notifyLocalDeath(score, tom.deathReason);
        } else if (window.AppHub) {
            window.AppHub.onGameOver({
                score, best: bestScore,
                title: 'ТОМ СОРВАЛСЯ!',
                subtitle: `${tom.deathReason || 'Упал в пропасть'} • Счёт: ${score}`
            });
        }
    }

    // Всплывающие очки
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy * deltaFactor;
        ft.alpha -= 0.02 * deltaFactor;
        if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }
}

// Отрисовка кадра
function render() {
    ctx.clearRect(0, 0, W, H);

    // 1. Фон каньона
    BackgroundEngine.draw(ctx, W, H, Physics.WALL_W, Physics.camera.y, gameTime);

    ctx.save();
    // 2. Кинематографичная камера (зум, смещение при натяге и тряска)
    ctx.translate(W / 2, H / 2);
    ctx.scale(Physics.camera.zoom, Physics.camera.zoom);
    ctx.translate(-W / 2 + Physics.camera.xOffset + Physics.camera.shakeX, -H / 2 - Physics.camera.y + Physics.camera.shakeY);

    // 3. Плитки-зацепы
    pins.forEach(p => Pins.draw(ctx, p, tom));

    // 4. Бонусы
    bonuses.forEach(b => {
        if (b.collected) return;
        ctx.save();
        const bob = Math.sin(gameTime * 0.07 + b.bobPhase) * 5;
        ctx.translate(b.x, b.y + bob);
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#1e1b18';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    // 5. Препятствия (шипастые колеса, клинья, рельсы, шлагбаумы)
    Obstacles.draw(ctx);

    // 6. След от полета
    TrailEngine.draw(ctx);

    // 7. Пунктирная траектория натяжения
    Physics.drawAimDots(ctx, tom, W);

    // 8. Отрисовка Тома и сетевого соперника через CustomManager (гардероб)
    if (gameMode === 'duel' && opponent.active) CustomManager.drawTom(ctx, opponent, true, gameTime);
    CustomManager.drawTom(ctx, tom, false, gameTime, Physics.drag);

    // 9. Всплывающие очки (+100, +200)
    floatingTexts.forEach(ft => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = `900 ${Math.round(26 * ft.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = ft.color;
        ctx.strokeStyle = 'rgba(62, 32, 9, 0.7)';
        ctx.lineWidth = 3.5;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
    });

    ctx.restore();
}

// 120 FPS цикл на RequestAnimationFrame
function gameLoop(timestamp) {
    const deltaMs = Math.min(32, timestamp - lastFrameTime);
    lastFrameTime = timestamp;
    const deltaFactor = deltaMs / 16.66; // нормализация под 60/120 Гц

    update(deltaFactor);
    render();
    requestAnimationFrame(gameLoop);
}

// Внешний интерфейс для связи с index.html
window.GameEngine = {
    start({ mode = 'solo', seed = Date.now() } = {}) {
        if (window.sfx) sfx.init();
        gameState = 'PLAYING';
        initGame(seed, mode);
    },
    stop() { gameState = 'MENU'; },
    updateOpponent(data) {
        opponent.active = true;
        Object.assign(opponent, data);
        updateHUD();
    },
    getScore() { return score; },
    isDead() { return gameState === 'GAMEOVER' || tom.state === 'DEAD'; }
};

initGame();
requestAnimationFrame(gameLoop);
