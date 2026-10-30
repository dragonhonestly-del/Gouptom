class SoundFX {
    constructor() { this.ctx = null; this.muted = false; }
    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }
    toggleMute() { this.muted = !this.muted; return this.muted; }
    playRubberStretch(ratio) {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140 + ratio * 180, now);
        osc.frequency.exponentialRampToValueAtTime(160 + ratio * 200, now + 0.05);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(now); osc.stop(now + 0.055);
    }
    playLaunch() {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(720, now + 0.18);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(now); osc.stop(now + 0.19);
    }
    playLatch(combo = 1, isRed = false) {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = 'triangle';
        const base = (isRed ? 480 : 420) + Math.min(combo * 35, 250);
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.exponentialRampToValueAtTime(base * 1.35, now + 0.1);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(now); osc.stop(now + 0.11);
    }
    playWallBounce() {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(now); osc.stop(now + 0.11);
    }
    playBonus() {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.04);
            gain.gain.setValueAtTime(0.1, now + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.15);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(now + idx * 0.04); osc.stop(now + idx * 0.04 + 0.15);
        });
    }
    playHit(shieldSaved = false) {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        if (shieldSaved) {
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(180, now + 0.2);
        } else {
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.35);
        }
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(now); osc.stop(now + 0.35);
    }
}

const sfx = new SoundFX();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('app-wrapper') || document.getElementById('canvasContainer') || document.body;

let W = 430, H = 820;
function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    W = rect.width || 430; H = rect.height || 820;
    canvas.width = W; canvas.height = H;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Генератор случайных чисел по Seed (чтобы в Дуэли карта была одинаковой у обоих)
let currentSeed = Date.now();
function seededRandom() {
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    return currentSeed / 4294967296;
}

const WALL_W = 28, GRAVITY = 0.34, AIR_DRAG = 0.995, WALL_BOUNCE = 0.82, MAX_PULL = 140, LAUNCH_POWER = 0.18;
let gameState = 'MENU', gameMode = 'solo';
let score = 0, bestScore = parseInt(localStorage.getItem('tomCanyonBest') || '0', 10), combo = 1;
let maxReachedY = 0, startY = 0, cameraY = 0, highestSpawnY = 0, gameTime = 0;

let tom = {
    x: 220, y: 500, vx: 0, vy: 0, radius: 34, state: 'STUCK',
    attachedPin: null, ignorePin: null, ignoreTimer: 15,
    swingAngle: 0, swingVel: 0, jellyX: 1, jellyY: 1, jellyVelX: 0, jellyVelY: 0,
    blinkTimer: 120, lookX: 0, lookY: 0, hasShield: false, shieldTimer: 0, deathReason: ''
};

// Состояние полупрозрачного соперника для Дуэли
let opponent = {
    active: false, x: 220, y: 500, vx: 0, vy: 0, state: 'STUCK',
    pinX: 220, pinY: 420, score: 0, dead: false
};

let drag = { active: false, startX: 0, startY: 0, currX: 0, currY: 0, dx: 0, dy: 0, lastSoundTime: 0 };
let pins = [], obstacles = [], bonuses = [], particles = [], floatingTexts = [], canyonStones = [], wallRocks = [], dustMotes = [];

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

function initBackgroundArt() {
    canyonStones = []; wallRocks = []; dustMotes = [];
    for (let i = 0; i < 36; i++) {
        canyonStones.push({
            x: WALL_W + 20 + Math.random() * (W - WALL_W * 2 - 80),
            y: Math.random() * 1600,
            w: 60 + Math.random() * 70,
            h: 36 + Math.random() * 40,
            shade: Math.random() > 0.5 ? '#f5c77e' : '#f2be6f',
            hasGrass: Math.random() < 0.28
        });
    }
    for (let y = 0; y < 1600; y += 48) {
        wallRocks.push({
            y: y,
            leftW: WALL_W - 4 + Math.random() * 6,
            rightW: WALL_W - 4 + Math.random() * 6,
            hasFlowerLeft: Math.random() < 0.16,
            hasFlowerRight: Math.random() < 0.16
        });
    }
    for (let i = 0; i < 28; i++) {
        dustMotes.push({
            x: Math.random() * W, y: Math.random() * H,
            r: 1.8 + Math.random() * 2.8,
            vy: -0.25 - Math.random() * 0.35,
            vx: 0.15 + Math.random() * 0.25,
            phase: Math.random() * Math.PI * 2
        });
    }
}

function createPin(x, y, type = 'blue', railSpan = 0) {
    return {
        x, y, baseX: x, baseY: y, size: 56, catchRadius: 46, type,
        visited: false, holdTimer: 0, maxHoldTime: 95, broken: false, respawnTimer: 0,
        railSpan: railSpan || 110, railPhase: seededRandom() * Math.PI * 2,
        railSpeed: 0.022 + seededRandom() * 0.012, pulseAnim: 0
    };
}

function initGame(seed = Date.now(), mode = 'solo') {
    resizeCanvas();
    currentSeed = seed;
    gameMode = mode;
    initBackgroundArt();

    score = 0; combo = 1; gameTime = 0;
    startY = H - 180; maxReachedY = startY; cameraY = 0; highestSpawnY = startY;
    pins = []; obstacles = []; bonuses = []; particles = []; floatingTexts = [];

    const startPin = createPin(W / 2, startY, 'blue');
    startPin.visited = true;
    pins.push(startPin);
    pins.push(createPin(W * 0.35, startY - 370, 'blue'));
    pins.push(createPin(W * 0.65, startY - 740, 'blue'));
    highestSpawnY = startY - 740;

    while (highestSpawnY > cameraY - H * 1.5) spawnNextSection();

    tom.attachedPin = startPin; tom.state = 'STUCK';
    tom.x = startPin.x; tom.y = startPin.y + 88;
    tom.vx = 0; tom.vy = 0; tom.swingAngle = 0; tom.swingVel = 0;
    tom.jellyX = 1; tom.jellyY = 1; tom.hasShield = false; tom.shieldTimer = 0; tom.deathReason = '';

    opponent.active = (mode === 'duel');
    opponent.x = startPin.x; opponent.y = startPin.y + 88;
    opponent.pinX = startPin.x; opponent.pinY = startPin.y;
    opponent.score = 0; opponent.dead = false; opponent.state = 'STUCK';

    drag.active = false;
    updateHUD();
}

function spawnNextSection() {
    const stepY = 370 + seededRandom() * 45;
    highestSpawnY -= stepY;
    const y = highestSpawnY;
    const heightMeters = Math.max(0, Math.floor((startY - y) / 25));
    const difficulty = Math.min(1, heightMeters / 140);
    const safeMinX = WALL_W + 96, safeMaxX = W - WALL_W - 96;
    let pinX = safeMinX + seededRandom() * (safeMaxX - safeMinX);

    if (heightMeters > 4 && seededRandom() < (0.38 + difficulty * 0.2)) {
        const obsY = y + stepY * 0.5;
        if (seededRandom() < 0.8) {
            const side = seededRandom() < 0.5 ? 'left' : 'right';
            const isWheel = seededRandom() < 0.55;
            obstacles.push({
                type: isWheel ? 'side_spiked_wheel' : 'side_spiked_wedge',
                side, x: side === 'left' ? WALL_W : W - WALL_W, y: obsY,
                radius: 48, width: 82, height: 104, angle: seededRandom() * Math.PI * 2, rotSpeed: 0.014, spiked: true
            });
            pinX = side === 'left'
                ? (W * 0.65 + seededRandom() * (safeMaxX - W * 0.65))
                : (safeMinX + seededRandom() * (W * 0.35 - safeMinX));
        } else {
            obstacles.push({
                type: 'center_safe_wheel', x: W / 2, y: obsY,
                radius: 44, angle: seededRandom() * Math.PI * 2, rotSpeed: 0.01, spiked: false
            });
        }
    }

    let pType = 'blue';
    const typeRoll = seededRandom();
    if (heightMeters > 6) {
        if (typeRoll < 0.16 + difficulty * 0.1) pType = 'red';
        else if (typeRoll < 0.32 + difficulty * 0.08) pType = seededRandom() < 0.55 ? 'rail_v' : 'rail_h';
    }
    if (pType === 'rail_h') pinX = W / 2;
    pins.push(createPin(pinX, y, pType, 110));

    if (seededRandom() < 0.18) {
        bonuses.push({
            x: seededRandom() < 0.5 ? W * 0.3 : W * 0.7,
            y: y + stepY * 0.45, type: 'shield', radius: 26, collected: false, bobPhase: seededRandom() * Math.PI * 2
        });
    }
}

function spawnParticles(x, y, color, count = 12, speed = 4.5) {
    for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2, spd = (0.3 + Math.random() * 0.8) * speed;
        particles.push({
            x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 1.2,
            radius: 2.8 + Math.random() * 4, color, alpha: 1, decay: 0.024 + Math.random() * 0.018
        });
    }
}

function addFloatingScore(x, y, text, color = '#ffffff', scale = 1) {
    floatingTexts.push({ x, y, text, color, scale, alpha: 1, vy: -2 });
}

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    let cx = e.clientX, cy = e.clientY;
    if (e.touches && e.touches.length > 0) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
    else if (e.changedTouches && e.changedTouches.length > 0) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
    return { x: (cx - rect.left) * (W / rect.width), y: (cy - rect.top) * (H / rect.height) };
}

function onPointerDown(e) {
    if (gameState !== 'PLAYING') return;
    sfx.init();
    if (tom.state === 'STUCK') {
        const pos = getPointerPos(e);
        drag.active = true; drag.startX = pos.x; drag.startY = pos.y;
        drag.currX = pos.x; drag.currY = pos.y; drag.dx = 0; drag.dy = 0;
    }
}

function onPointerMove(e) {
    if (!drag.active || gameState !== 'PLAYING') return;
    const pos = getPointerPos(e);
    drag.currX = pos.x; drag.currY = pos.y;
    let rawDx = drag.startX - drag.currX, rawDy = drag.startY - drag.currY;
    const dist = Math.hypot(rawDx, rawDy);
    if (dist > MAX_PULL) { rawDx = (rawDx / dist) * MAX_PULL; rawDy = (rawDy / dist) * MAX_PULL; }
    drag.dx = rawDx; drag.dy = rawDy;
    const now = performance.now();
    if (dist > 18 && now - drag.lastSoundTime > 90) {
        sfx.playRubberStretch(dist / MAX_PULL);
        drag.lastSoundTime = now;
    }
}

function onPointerUp() {
    if (!drag.active || gameState !== 'PLAYING') return;
    drag.active = false;
    if (Math.hypot(drag.dx, drag.dy) > 16 && tom.state === 'STUCK') {
        tom.vx = drag.dx * LAUNCH_POWER; tom.vy = drag.dy * LAUNCH_POWER;
        tom.state = 'FLYING'; tom.ignorePin = tom.attachedPin; tom.ignoreTimer = 14; tom.attachedPin = null;
        tom.jellyX = 0.68; tom.jellyY = 1.34;
        sfx.playLaunch();
        spawnParticles(tom.x, tom.y - 22, '#ffffff', 10, 4);
    }
    drag.dx = 0; drag.dy = 0;
}

canvas.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('touchstart', e => { if (e.target === canvas) e.preventDefault(); onPointerDown(e); }, { passive: false });
window.addEventListener('touchmove', e => { if (drag.active) e.preventDefault(); onPointerMove(e); }, { passive: false });
window.addEventListener('touchend', onPointerUp);

function triggerHazardHit(hx, hy, text) {
    if (tom.state === 'DEAD') return;
    if (tom.hasShield) {
        tom.hasShield = false; tom.shieldTimer = 0;
        sfx.playHit(true);
        spawnParticles(tom.x, tom.y, '#ef4444', 22, 6);
        addFloatingScore(tom.x, tom.y - 30, 'ЩИТ СПАС!', '#fde047', 1.2);
        const ang = Math.atan2(tom.y - hy, tom.x - hx);
        tom.vx = Math.cos(ang) * 8; tom.vy = -12;
        tom.state = 'FLYING'; tom.attachedPin = null; tom.jellyX = 1.3; tom.jellyY = 0.72;
    } else {
        tom.state = 'DEAD'; tom.attachedPin = null;
        tom.vy = -8; tom.vx = (tom.x < hx ? -1 : 1) * 5;
        tom.deathReason = text; combo = 1;
        sfx.playHit(false);
        spawnParticles(tom.x, tom.y, '#f43f5e', 26, 6.5);
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

function update() {
    gameTime++;
    dustMotes.forEach(m => {
        m.x += m.vx + Math.sin(gameTime * 0.02 + m.phase) * 0.15; m.y += m.vy;
        if (m.y < -10) m.y = H + 10;
        if (m.x > W + 10) m.x = -10;
    });
    if (gameState !== 'PLAYING') return;

    tom.jellyVelX += (1 - tom.jellyX) * 0.22; tom.jellyVelY += (1 - tom.jellyY) * 0.22;
    tom.jellyVelX *= 0.75; tom.jellyVelY *= 0.75;
    tom.jellyX += tom.jellyVelX; tom.jellyY += tom.jellyVelY;

    tom.blinkTimer--;
    if (tom.blinkTimer < -8) tom.blinkTimer = 110 + Math.floor(Math.random() * 120);
    if (tom.shieldTimer > 0 && --tom.shieldTimer === 0) tom.hasShield = false;

    for (let i = 0; i < pins.length; i++) {
        const p = pins[i];
        if (p.pulseAnim > 0) p.pulseAnim = Math.max(0, p.pulseAnim - 0.06);
        if (p.type === 'rail_v') { p.railPhase += p.railSpeed; p.y = p.baseY + Math.sin(p.railPhase) * (p.railSpan / 2); }
        else if (p.type === 'rail_h') { p.railPhase += p.railSpeed; p.x = p.baseX + Math.sin(p.railPhase) * (p.railSpan / 2); }
        else if (p.type === 'red') {
            if (p.broken) {
                if (--p.respawnTimer <= 0) { p.broken = false; p.holdTimer = 0; }
            } else if (tom.state === 'STUCK' && tom.attachedPin === p) {
                if (++p.holdTimer >= p.maxHoldTime) {
                    p.broken = true; p.respawnTimer = 180;
                    tom.state = 'FLYING'; tom.attachedPin = null;
                    tom.vx = (Math.random() - 0.5) * 2; tom.vy = 2; drag.active = false;
                    sfx.playHit(true); spawnParticles(p.x, p.y, '#ef4444', 16, 4.5);
                }
            } else p.holdTimer = Math.max(0, p.holdTimer - 1);
        }
    }

    if (tom.state === 'STUCK' && tom.attachedPin) {
        const p = tom.attachedPin, hangDistance = 78;
        if (drag.active) {
            const targetX = p.x - drag.dx * 0.55, targetY = p.y + hangDistance - drag.dy * 0.55;
            tom.x += (targetX - tom.x) * 0.4; tom.y += (targetY - tom.y) * 0.4;
            tom.swingAngle = Math.atan2(tom.x - p.x, Math.max(25, tom.y - p.y));
            tom.lookX = drag.dx * 0.04; tom.lookY = drag.dy * 0.04;
        } else {
            tom.swingVel += -0.065 * tom.swingAngle; tom.swingVel *= 0.92; tom.swingAngle += tom.swingVel;
            tom.x = p.x + Math.sin(tom.swingAngle) * hangDistance;
            tom.y = p.y + Math.cos(tom.swingAngle) * hangDistance;
            tom.lookX *= 0.85; tom.lookY = -2;
        }
        tom.vx = 0; tom.vy = 0;
    } else if (tom.state === 'FLYING' || tom.state === 'DEAD') {
        if (tom.ignoreTimer > 0 && --tom.ignoreTimer === 0) tom.ignorePin = null;
        tom.vy += GRAVITY; tom.vx *= AIR_DRAG; tom.vy *= AIR_DRAG;
        tom.x += tom.vx; tom.y += tom.vy;
        tom.lookX = Math.max(-5, Math.min(5, tom.vx * 0.35));
        tom.lookY = Math.max(-5, Math.min(5, tom.vy * 0.35));

        if (tom.state === 'FLYING' && tom.y < maxReachedY) {
            const diffMeters = Math.floor((maxReachedY - tom.y) / 14);
            if (diffMeters > 0) { maxReachedY -= diffMeters * 14; addScorePoints(diffMeters * 2); }
        }
        if (tom.x - tom.radius < WALL_W) {
            tom.x = WALL_W + tom.radius; tom.vx = Math.abs(tom.vx) * WALL_BOUNCE;
            tom.jellyX = 0.68; tom.jellyY = 1.28; sfx.playWallBounce();
            spawnParticles(WALL_W, tom.y, '#fde68a', 8, 3.2);
        } else if (tom.x + tom.radius > W - WALL_W) {
            tom.x = W - WALL_W - tom.radius; tom.vx = -Math.abs(tom.vx) * WALL_BOUNCE;
            tom.jellyX = 0.68; tom.jellyY = 1.28; sfx.playWallBounce();
            spawnParticles(W - WALL_W, tom.y, '#fde68a', 8, 3.2);
        }
        if (tom.state === 'FLYING') {
            for (let i = 0; i < pins.length; i++) {
                const p = pins[i];
                if (p === tom.ignorePin || (p.type === 'red' && p.broken)) continue;
                if (Math.hypot(tom.x - p.x, (tom.y - 24) - p.y) <= p.catchRadius + 14) {
                    tom.state = 'STUCK'; tom.attachedPin = p;
                    tom.swingAngle = Math.max(-0.7, Math.min(0.7, (tom.x - p.x) * 0.015));
                    tom.swingVel = tom.vx * 0.016; tom.vx = 0; tom.vy = 0;
                    tom.jellyX = 1.26; tom.jellyY = 0.78; p.pulseAnim = 1;
                    if (!p.visited) {
                        p.visited = true;
                        addScorePoints(100 * combo, p.x, p.y - 36, '+');
                        combo = Math.min(10, combo + 1);
                    } else combo = 1;
                    updateHUD();
                    sfx.playLatch(combo, p.type === 'red');
                    spawnParticles(p.x, p.y, '#7dd3fc', 12, 4);
                    break;
                }
            }
        }
    }

    for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (o.type === 'center_safe_wheel') {
            o.angle += o.rotSpeed;
            if (Math.hypot(tom.x - o.x, tom.y - o.y) < o.radius + tom.radius * 0.75) {
                const pushAng = Math.atan2(tom.y - o.y, tom.x - o.x);
                tom.vx = Math.cos(pushAng) * 6; tom.vy = Math.sin(pushAng) * 6;
                sfx.playWallBounce();
            }
        } else if (o.type === 'side_spiked_wheel') {
            o.angle += o.rotSpeed;
            if (Math.hypot(tom.x - o.x, tom.y - o.y) < o.radius + tom.radius * 0.7)
                triggerHazardHit(o.x, o.y, 'Том налетел на шипастое колесо на стене!');
        } else if (o.type === 'side_spiked_wedge') {
            const tipX = o.side === 'left' ? o.x + o.width : o.x - o.width, tipY = o.y;
            const topY = o.y - o.height / 2, botY = o.y + o.height / 2;
            if (tom.y + tom.radius * 0.7 > topY && tom.y - tom.radius * 0.7 < botY) {
                const currentExtent = o.width * (1 - Math.min(1, Math.abs(tom.y - tipY) / (o.height / 2)));
                if ((o.side === 'left' && tom.x - tom.radius * 0.75 < o.x + currentExtent) ||
                    (o.side === 'right' && tom.x + tom.radius * 0.75 > o.x - currentExtent)) {
                    triggerHazardHit(tipX, tipY, 'Том укололся о шипы на стене!');
                }
            }
        }
    }

    for (let i = 0; i < bonuses.length; i++) {
        const b = bonuses[i];
        if (!b.collected && Math.hypot(tom.x - b.x, tom.y - b.y) < tom.radius + b.radius) {
            b.collected = true; sfx.playBonus();
            tom.hasShield = true; tom.shieldTimer = 900;
            addScorePoints(200, b.x, b.y - 20, '🛡️ +');
            spawnParticles(b.x, b.y, '#38bdf8', 20, 5.5);
        }
    }

    const targetCamY = tom.y - H * 0.64;
    if (targetCamY < cameraY) cameraY += (targetCamY - cameraY) * 0.095;
    else if (targetCamY > cameraY + 140 && cameraY < 0) cameraY += (targetCamY - cameraY) * 0.05;

    while (highestSpawnY > cameraY - H * 1.4) spawnNextSection();

    const cleanupY = cameraY + H + 360;
    pins = pins.filter(p => p.y < cleanupY);
    obstacles = obstacles.filter(o => o.y < cleanupY);
    bonuses = bonuses.filter(b => !b.collected && b.y < cleanupY);

    // Отправка своих координат сопернику в режиме Дуэли
    if (gameMode === 'duel' && window.DuelNetwork && typeof window.DuelNetwork.sendState === 'function') {
        window.DuelNetwork.sendState({
            x: tom.x, y: tom.y, vx: tom.vx, vy: tom.vy, state: tom.state,
            pinX: tom.attachedPin ? tom.attachedPin.x : tom.x,
            pinY: tom.attachedPin ? tom.attachedPin.y : tom.y - 78,
            score: score, dead: false
        });
    }

    if (tom.y - cameraY > H + 120) {
        sfx.playHit(false);
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

    for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i]; pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.14; pt.alpha -= pt.decay;
        if (pt.alpha <= 0) particles.splice(i, 1);
    }
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i]; ft.y += ft.vy; ft.alpha -= 0.02;
        if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }
}

function drawCanyonBackground() {
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#fff3d1'); bgGrad.addColorStop(0.45, '#fde09b'); bgGrad.addColorStop(1, '#f7c978');
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

    ctx.save();
    const wrapH = 1600;
    canyonStones.forEach(st => {
        let sy = (st.y - cameraY * 0.65) % wrapH;
        if (sy < -120) sy += wrapH;
        ctx.fillStyle = st.shade; ctx.strokeStyle = '#eab364'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(st.x, sy, st.w, st.h, 8); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 250, 230, 0.55)';
        ctx.beginPath(); ctx.moveTo(st.x + 6, sy + 3); ctx.lineTo(st.x + st.w - 6, sy + 3); ctx.stroke();
        if (st.hasGrass) {
            const gx = st.x + st.w * 0.5, gy = sy;
            ctx.fillStyle = '#7cb342'; ctx.strokeStyle = '#558b2f'; ctx.lineWidth = 1.5;
            [-12, -5, 2, 9].forEach((ang, idx) => {
                ctx.beginPath(); ctx.moveTo(gx, gy + 2);
                ctx.quadraticCurveTo(gx + ang * 1.4, gy - 14 - (idx % 2) * 5, gx + ang * 2.1, gy - 10);
                ctx.quadraticCurveTo(gx + ang * 0.8, gy - 4, gx, gy + 2);
                ctx.fill(); ctx.stroke();
            });
        }
    });
    ctx.restore();

    ctx.save();
    const leftShadow = ctx.createLinearGradient(0, 0, WALL_W + 24, 0);
    leftShadow.addColorStop(0, 'rgba(138, 75, 28, 0.42)'); leftShadow.addColorStop(1, 'rgba(138, 75, 28, 0)');
    ctx.fillStyle = leftShadow; ctx.fillRect(0, 0, WALL_W + 24, H);

    const rightShadow = ctx.createLinearGradient(W, 0, W - WALL_W - 24, 0);
    rightShadow.addColorStop(0, 'rgba(138, 75, 28, 0.42)'); rightShadow.addColorStop(1, 'rgba(138, 75, 28, 0)');
    ctx.fillStyle = rightShadow; ctx.fillRect(W - WALL_W - 24, 0, WALL_W + 24, H);

    wallRocks.forEach(wr => {
        let wy = (wr.y - cameraY) % wrapH;
        if (wy < -60) wy += wrapH;
        ctx.fillStyle = '#e5a95c'; ctx.strokeStyle = '#9c5a25'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(-8, wy, wr.leftW + 8, 48, 10); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(W - wr.rightW, wy, wr.rightW + 8, 48, 10); ctx.fill(); ctx.stroke();
        if (wr.hasFlowerLeft) drawWallVine(wr.leftW - 2, wy + 24, 1);
        if (wr.hasFlowerRight) drawWallVine(W - wr.rightW + 2, wy + 24, -1);
    });
    ctx.restore();

    ctx.save();
    const rayGrad = ctx.createLinearGradient(0, 0, W * 0.7, H * 0.65);
    rayGrad.addColorStop(0, 'rgba(255, 255, 240, 0.28)'); rayGrad.addColorStop(1, 'rgba(255, 255, 240, 0)');
    ctx.fillStyle = rayGrad;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.55, 0); ctx.lineTo(W, H * 0.65); ctx.lineTo(W * 0.2, H * 0.65); ctx.closePath(); ctx.fill();
    dustMotes.forEach(m => {
        const glow = 0.35 + Math.sin(gameTime * 0.05 + m.phase) * 0.25;
        ctx.fillStyle = `rgba(255, 252, 220, ${glow})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
}

function drawWallVine(x, y, dir) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    ctx.fillStyle = '#65a30d'; ctx.strokeStyle = '#365314'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(6, -5, 8, 4, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(12, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(12, 0, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawPinTile(p) {
    ctx.save();
    if (p.type === 'rail_v' || p.type === 'rail_h') {
        ctx.save(); ctx.strokeStyle = '#5c4028'; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath();
        if (p.type === 'rail_v') { ctx.moveTo(p.baseX, p.baseY - p.railSpan / 2 - 18); ctx.lineTo(p.baseX, p.baseY + p.railSpan / 2 + 18); }
        else { ctx.moveTo(p.baseX - p.railSpan / 2 - 18, p.baseY); ctx.lineTo(p.baseX + p.railSpan / 2 + 18, p.baseY); }
        ctx.stroke(); ctx.strokeStyle = '#b08d6a'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    }
    if (p.type === 'red' && p.broken) {
        ctx.strokeStyle = 'rgba(185, 28, 28, 0.35)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 3;
        ctx.strokeRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); ctx.restore(); return;
    }
    let shakeX = 0, shakeY = 0;
    if (p.type === 'red' && p.holdTimer > 0) {
        const shk = (p.holdTimer / p.maxHoldTime) * 5;
        shakeX = (Math.random() - 0.5) * shk; shakeY = (Math.random() - 0.5) * shk;
    }
    const isAttached = (tom.state === 'STUCK' && tom.attachedPin === p);
    const scale = 1 + Math.sin(p.pulseAnim * Math.PI) * 0.14;
    ctx.translate(p.x + shakeX, p.y + shakeY); ctx.scale(scale, scale);
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
        innerGrad.addColorStop(0, '#60a5fa'); innerGrad.addColorStop(1, '#2563eb');
    }
    ctx.fillStyle = innerGrad; ctx.strokeStyle = isAttached ? '#ffffff' : '#1e3a8a'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.roundRect(-innerHalf, -innerHalf, innerHalf * 2, innerHalf * 2, 6); ctx.fill(); ctx.stroke();

    ctx.fillStyle = p.type === 'red' ? '#881337' : (isAttached ? '#0284c7' : '#1d4ed8');
    ctx.beginPath(); ctx.ellipse(0, 4, 8, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    [{ x: -9, y: -4, r: 3.3 }, { x: -3.5, y: -8, r: 3.5 }, { x: 3.5, y: -8, r: 3.5 }, { x: 9, y: -4, r: 3.3 }].forEach(toe => {
        ctx.beginPath(); ctx.arc(toe.x, toe.y, toe.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
}

function drawBigObstacle(o) {
    ctx.save();
    if (o.type === 'center_safe_wheel') drawWagonWheel(o.x, o.y, o.radius, o.angle, false);
    else if (o.type === 'side_spiked_wheel') drawWagonWheel(o.x, o.y, o.radius, o.angle, true);
    else if (o.type === 'side_spiked_wedge') drawSpikedWoodWedge(o);
    ctx.restore();
}

function drawWagonWheel(x, y, r, angle, spiked) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    if (spiked) {
        ctx.fillStyle = '#94a3b8'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
        for (let i = 0; i < 12; i++) {
            ctx.save(); ctx.rotate((i * Math.PI * 2) / 12);
            ctx.beginPath(); ctx.moveTo(r - 4, -7); ctx.lineTo(r + 16, 0); ctx.lineTo(r - 4, 7); ctx.closePath();
            ctx.fill(); ctx.stroke(); ctx.restore();
        }
    }
    ctx.strokeStyle = '#2b1608'; ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
        ctx.save(); ctx.rotate((i * Math.PI) / 4);
        ctx.fillStyle = '#b4692c'; ctx.beginPath(); ctx.roundRect(-5, 0, 10, r - 10, 3); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.lineWidth = 14; ctx.strokeStyle = '#a35822'; ctx.beginPath(); ctx.arc(0, 0, r - 10, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 10; ctx.strokeStyle = '#64748b'; ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#c87a38'; ctx.strokeStyle = '#2b1608'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
}

function drawSpikedWoodWedge(o) {
    ctx.save();
    const isLeft = o.side === 'left', baseX = o.x, tipX = isLeft ? baseX + o.width : baseX - o.width;
    const topY = o.y - o.height / 2, botY = o.y + o.height / 2;
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
    ctx.restore();
}

function drawBonusItem(b) {
    if (b.collected) return;
    ctx.save();
    const bob = Math.sin(gameTime * 0.07 + b.bobPhase) * 5;
    ctx.translate(b.x, b.y + bob);
    ctx.fillStyle = 'rgba(105, 58, 18, 0.28)'; ctx.beginPath(); ctx.arc(4, 8, 24, 0, Math.PI * 2); ctx.fill();
    const shieldGrad = ctx.createRadialGradient(-4, -4, 4, 0, 0, 22);
    shieldGrad.addColorStop(0, '#60a5fa'); shieldGrad.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = shieldGrad; ctx.strokeStyle = '#1e1b18'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawTomCharacter(charObj, isGhost = false) {
    ctx.save();
    if (isGhost) ctx.globalAlpha = 0.48;

    const pinX = isGhost ? charObj.pinX : (charObj.attachedPin ? charObj.attachedPin.x : charObj.x);
    const pinY = isGhost ? charObj.pinY : (charObj.attachedPin ? charObj.attachedPin.y : charObj.y - 78);

    if (charObj.state === 'STUCK' && (isGhost || charObj.attachedPin)) {
        const stretchDist = Math.hypot(charObj.x - pinX, charObj.y - pinY);
        const armWidth = Math.max(6, 11 - (stretchDist - 70) * 0.035);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(105, 58, 18, 0.28)'; ctx.lineWidth = armWidth + 4;
        ctx.beginPath();
        ctx.moveTo(pinX - 10 + 6, pinY + 18 + 6); ctx.lineTo(charObj.x - 13 + 6, charObj.y - 18 + 6);
        ctx.moveTo(pinX + 10 + 6, pinY + 18 + 6); ctx.lineTo(charObj.x + 13 + 6, charObj.y - 18 + 6);
        ctx.stroke();

        ctx.strokeStyle = '#2d2926'; ctx.lineWidth = armWidth + 4;
        ctx.beginPath();
        ctx.moveTo(pinX - 10, pinY + 18); ctx.lineTo(charObj.x - 13, charObj.y - 18);
        ctx.moveTo(pinX + 10, pinY + 18); ctx.lineTo(charObj.x + 13, charObj.y - 18);
        ctx.stroke();

        ctx.strokeStyle = '#78746f'; ctx.lineWidth = armWidth;
        ctx.beginPath();
        ctx.moveTo(pinX - 10, pinY + 18); ctx.lineTo(charObj.x - 13, charObj.y - 18);
        ctx.moveTo(pinX + 10, pinY + 18); ctx.lineTo(charObj.x + 13, charObj.y - 18);
        ctx.stroke();
    }

    ctx.translate(charObj.x, charObj.y);
    let rot = 0, sx = charObj.jellyX || 1, sy = charObj.jellyY || 1;
    if (!isGhost && charObj.state === 'STUCK' && charObj.attachedPin) {
        rot = -charObj.swingAngle * 0.45;
        if (drag.active) {
            const ratio = Math.min(1, Math.hypot(drag.dx, drag.dy) / MAX_PULL);
            sx *= (1 - ratio * 0.14); sy *= (1 + ratio * 0.18);
        }
    } else if (charObj.state === 'FLYING') {
        const spd = Math.hypot(charObj.vx || 0, charObj.vy || 0);
        if (spd > 2.5) {
            rot = Math.atan2(charObj.vy, charObj.vx) + Math.PI / 2;
            const stretch = Math.min(0.24, spd * 0.012);
            sy *= (1 + stretch); sx *= (1 - stretch * 0.5);
        }
    } else if (charObj.state === 'DEAD') rot = gameTime * 0.18;

    ctx.rotate(rot); ctx.scale(sx, sy);

    ctx.fillStyle = 'rgba(105, 58, 18, 0.3)';
    ctx.beginPath(); ctx.arc(6, 12, 34, 0, Math.PI * 2); ctx.fill();

    if (charObj.hasShield) {
        ctx.save();
        ctx.strokeStyle = '#1e1b18'; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.arc(0, 12, 36, -Math.PI * 0.15, Math.PI * 1.15); ctx.stroke();
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 12;
        ctx.beginPath(); ctx.arc(0, 12, 36, -Math.PI * 0.15, Math.PI * 1.15); ctx.stroke();
        ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = '#78746f'; ctx.strokeStyle = '#2d2926'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 26, 18, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e5e5e5'; ctx.beginPath(); ctx.ellipse(0, 24, 11, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#78746f';
    ctx.beginPath();
    ctx.ellipse(-7, 40, 6.5, 8, 0.1, 0, Math.PI * 2);
    ctx.ellipse(7, 40, 6.5, 8, -0.1, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    [{ x: -20, y: -20, rot: -0.35 }, { x: 20, y: -20, rot: 0.35 }].forEach(ear => {
        ctx.save(); ctx.translate(ear.x, ear.y); ctx.rotate(ear.rot);
        ctx.fillStyle = '#87827d'; ctx.strokeStyle = '#2d2926'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-11, 7); ctx.quadraticCurveTo(0, -17, 11, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.moveTo(-6, 5); ctx.quadraticCurveTo(0, -11, 6, 5); ctx.closePath(); ctx.fill();
        ctx.restore();
    });

    const headGrad = ctx.createRadialGradient(-7, -9, 5, 0, 0, 34);
    headGrad.addColorStop(0, '#a39f99'); headGrad.addColorStop(0.65, '#7f7a75'); headGrad.addColorStop(1, '#5c5853');
    ctx.fillStyle = headGrad; ctx.strokeStyle = '#2d2926'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.ellipse(0, -2, 33, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#3f3b37';
    [{ x: -27, y: 2, r: 0.2 }, { x: -24, y: 9, r: 0.35 }, { x: 27, y: 2, r: -0.2 }, { x: 24, y: 9, r: -0.35 }].forEach(s => {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.r);
        ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });

    ctx.fillStyle = '#e7e5e4';
    ctx.beginPath();
    ctx.ellipse(-11, -15, 5.5, 2.2, -0.2, 0, Math.PI * 2);
    ctx.ellipse(11, -15, 5.5, 2.2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 8, 14, 10, 0, 0, Math.PI * 2); ctx.fill();

    const isBlinking = !isGhost && tom.blinkTimer < 0;
    [-11, 11].forEach(ex => {
        ctx.save(); ctx.translate(ex, -4);
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
            irisGrad.addColorStop(0, '#4ade80'); irisGrad.addColorStop(0.7, '#16a34a'); irisGrad.addColorStop(1, '#14532d');
            ctx.fillStyle = irisGrad; ctx.beginPath(); ctx.arc(lx, ly, 5.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#09090b'; ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(lx - 1.8, ly - 2.2, 1.8, 0, Math.PI * 2); ctx.arc(lx + 1.6, ly + 1.6, 0.9, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    });

    const noseGrad = ctx.createLinearGradient(0, 2, 0, 8.5);
    noseGrad.addColorStop(0, '#fb7185'); noseGrad.addColorStop(1, '#e11d48');
    ctx.fillStyle = noseGrad;
    ctx.beginPath(); ctx.moveTo(-5, 4); ctx.quadraticCurveTo(0, 2.5, 5, 4); ctx.quadraticCurveTo(0, 9.5, 0, 8.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3f3b37'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, 11); ctx.quadraticCurveTo(0, 14.5, 6, 11); ctx.stroke();
    ctx.restore();
}

function drawAimDots() {
    if (!drag.active || tom.state !== 'STUCK') return;
    if (Math.hypot(drag.dx, drag.dy) < 16) return;
    ctx.save();
    let simX = tom.x, simY = tom.y, simVx = drag.dx * LAUNCH_POWER, simVy = drag.dy * LAUNCH_POWER;
    for (let step = 1; step <= 24; step++) {
        simVy += GRAVITY; simVx *= AIR_DRAG; simVy *= AIR_DRAG; simX += simVx; simY += simVy;
        if (simX - tom.radius < WALL_W) { simX = WALL_W + tom.radius; simVx = Math.abs(simVx) * WALL_BOUNCE; }
        else if (simX + tom.radius > W - WALL_W) { simX = W - WALL_W - tom.radius; simVx = -Math.abs(simVx) * WALL_BOUNCE; }
        if (step % 2 === 0) {
            const alpha = (1 - step / 26) * 0.85, r = Math.max(2.5, 6.2 - step * 0.15);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`; ctx.strokeStyle = `rgba(62, 32, 9, ${alpha * 0.6})`; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(simX, simY, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
    }
    ctx.restore();
}

function render() {
    ctx.clearRect(0, 0, W, H);
    drawCanyonBackground();
    ctx.save();
    ctx.translate(0, -cameraY);
    pins.forEach(drawPinTile);
    bonuses.forEach(drawBonusItem);
    obstacles.forEach(drawBigObstacle);
    drawAimDots();
    if (gameMode === 'duel' && opponent.active) drawTomCharacter(opponent, true);
    drawTomCharacter(tom, false);

    particles.forEach(pt => {
        ctx.save(); ctx.globalAlpha = Math.max(0, pt.alpha); ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    floatingTexts.forEach(ft => {
        ctx.save(); ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = `900 ${Math.round(28 * ft.scale)}px Rubik, sans-serif`; ctx.textAlign = 'center';
        ctx.fillStyle = ft.color; ctx.strokeStyle = 'rgba(62, 32, 9, 0.65)'; ctx.lineWidth = 4;
        ctx.strokeText(ft.text, ft.x, ft.y); ctx.fillText(ft.text, ft.x, ft.y); ctx.restore();
    });
    ctx.restore();
}

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// Экспорт управления в наш хаб index.html
window.GameEngine = {
    start({ mode = 'solo', seed = Date.now() } = {}) {
        sfx.init();
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
gameLoop();
