(function () {
    const PEER_PREFIX = 'tom-goup-duel-v1-';
    let peer = null;
    let conn = null;
    let lastSendTime = 0;

    let matchState = {
        active: false,
        finished: false,
        localDead: false,
        localScore: 0,
        remoteDead: false,
        remoteScore: 0
    };

    const statusEl = document.getElementById('net-status');
    const codeDisplayEl = document.getElementById('room-code-display');
    const createdBlockEl = document.getElementById('created-room-block');
    const joinInputEl = document.getElementById('join-code-input');
    const createBtn = document.getElementById('create-room-btn');
    const joinBtn = document.getElementById('join-room-btn');

    function setStatus(text, isError = false) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.style.color = isError ? '#d91b1b' : '#4a2810';
    }

    function resetMatchState() {
        matchState = {
            active: true,
            finished: false,
            localDead: false,
            localScore: 0,
            remoteDead: false,
            remoteScore: 0
        };
    }

    function cleanupPeer() {
        if (conn) {
            try { conn.close(); } catch (e) {}
            conn = null;
        }
        if (peer) {
            try { peer.destroy(); } catch (e) {}
            peer = null;
        }
        matchState.active = false;
    }

    // Проверка условий победы/поражения
    function evaluateDuelOutcome() {
        if (!matchState.active || matchState.finished) return;

        const myScore = window.GameEngine ? window.GameEngine.getScore() : matchState.localScore;
        const enemyScore = matchState.remoteScore;
        matchState.localScore = myScore;

        // 1. Я умер, а соперник уже впереди (или счёт равный и он ещё жив) -> я сразу проиграл
        if (matchState.localDead && !matchState.remoteDead && enemyScore > myScore) {
            finishDuel(false, `Соперник обошёл тебя! (${myScore} vs ${enemyScore})`);
            return;
        }

        // 2. Соперник умер, а я уже впереди (или обогнал его после его смерти) -> я сразу победил!
        if (matchState.remoteDead && !matchState.localDead && myScore > enemyScore) {
            finishDuel(true, `Ты обогнал павшего соперника! (${myScore} vs ${enemyScore})`);
            return;
        }

        // 3. Оба сорвались -> сравниваем итоговый счёт
        if (matchState.localDead && matchState.remoteDead) {
            if (myScore > enemyScore) {
                finishDuel(true, `Оба упали, но ты выше! (${myScore} vs ${enemyScore})`);
            } else if (myScore < enemyScore) {
                finishDuel(false, `Соперник забрался выше! (${myScore} vs ${enemyScore})`);
            } else {
                finishDuel(true, `Ничья по счёту! (${myScore} : ${enemyScore})`);
            }
        }
    }

    function finishDuel(isWin, subtitleText) {
        if (matchState.finished) return;
        matchState.finished = true;

        const myScore = window.GameEngine ? window.GameEngine.getScore() : matchState.localScore;

        if (conn && conn.open) {
            conn.send({
                type: 'MATCH_RESULT',
                winnerIsSender: isWin,
                senderScore: myScore
            });
        }

        if (window.GameEngine) window.GameEngine.stop();

        if (window.AppHub) {
            window.AppHub.onGameOver({
                score: myScore,
                title: isWin ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ',
                subtitle: subtitleText
            });
        }
    }

    function setupConnectionHandlers(connection, isHost) {
        conn = connection;

        conn.on('open', () => {
            setStatus('Соперник подключён! Запуск...');
            resetMatchState();

            if (isHost) {
                const sharedSeed = Math.floor(100000 + Math.random() * 900000);
                conn.send({ type: 'START_DUEL', seed: sharedSeed });
                if (window.AppHub) window.AppHub.startGame('duel', sharedSeed);
            }
        });

        conn.on('data', (msg) => {
            if (!msg || typeof msg !== 'object') return;

            if (msg.type === 'START_DUEL') {
                resetMatchState();
                if (window.AppHub) window.AppHub.startGame('duel', msg.seed);
            } 
            else if (msg.type === 'STATE') {
                matchState.remoteScore = msg.score || 0;
                if (window.GameEngine) {
                    window.GameEngine.updateOpponent(msg);
                }
                evaluateDuelOutcome();
            } 
            else if (msg.type === 'PLAYER_DEAD') {
                matchState.remoteDead = true;
                matchState.remoteScore = msg.score || 0;
                if (window.GameEngine) {
                    window.GameEngine.updateOpponent({
                        score: msg.score || 0,
                        state: 'DEAD',
                        dead: true
                    });
                }
                evaluateDuelOutcome();
            } 
            else if (msg.type === 'MATCH_RESULT' && !matchState.finished) {
                matchState.finished = true;
                const myScore = window.GameEngine ? window.GameEngine.getScore() : matchState.localScore;
                const iWon = !msg.winnerIsSender;
                if (window.GameEngine) window.GameEngine.stop();
                if (window.AppHub) {
                    window.AppHub.onGameOver({
                        score: myScore,
                        title: iWon ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ',
                        subtitle: `Итог дуэли: ${myScore} vs ${msg.senderScore}`
                    });
                }
            }
        });

        conn.on('close', () => {
            if (matchState.active && !matchState.finished) {
                finishDuel(true, 'Соперник покинул дуэль!');
            }
        });

        conn.on('error', () => {
            setStatus('Ошибка соединения с соперником', true);
        });
    }

    // 1. Создание комнаты (4-значный код)
    function createRoom() {
        cleanupPeer();
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        if (createdBlockEl) createdBlockEl.style.display = 'block';
        if (codeDisplayEl) codeDisplayEl.textContent = '....';
        setStatus('Создаём комнату...');

        peer = new Peer(PEER_PREFIX + code);

        peer.on('open', () => {
            if (codeDisplayEl) codeDisplayEl.textContent = code;
            setStatus('Ждём подключения друга по коду...');
        });

        peer.on('connection', (incomingConn) => {
            setupConnectionHandlers(incomingConn, true);
        });

        peer.on('error', (err) => {
            if (err.type === 'unavailable-id') {
                createRoom(); // Если 4-значный код случайно занят, генерируем новый
            } else {
                setStatus('Ошибка сети: ' + err.type, true);
            }
        });
    }

    // 2. Подключение к комнате по 4 цифрам
    function joinRoom() {
        const code = (joinInputEl ? joinInputEl.value : '').trim();
        if (!/^\d{4}$/.test(code)) {
            setStatus('Введи ровно 4 цифры кода!', true);
            return;
        }

        cleanupPeer();
        setStatus(`Подключаемся к комнате ${code}...`);

        peer = new Peer();

        peer.on('open', () => {
            const outgoingConn = peer.connect(PEER_PREFIX + code, { reliable: true });
            setupConnectionHandlers(outgoingConn, false);
        });

        peer.on('error', (err) => {
            if (err.type === 'peer-unavailable') {
                setStatus('Комната с таким кодом не найдена!', true);
            } else {
                setStatus('Ошибка подключения: ' + err.type, true);
            }
        });
    }

    if (createBtn) createBtn.addEventListener('click', createRoom);
    if (joinBtn) joinBtn.addEventListener('click', joinRoom);

    // Экспорт в глобальный объект для связи с game.js и index.html
    window.DuelNetwork = {
        sendState(stateObj) {
            if (!conn || !conn.open || matchState.finished) return;
            const now = performance.now();
            // Отправляем пакеты ~30 раз в секунду, чтобы не перегружать канал
            if (now - lastSendTime < 32) return;
            lastSendTime = now;

            matchState.localScore = stateObj.score || 0;
            conn.send(Object.assign({ type: 'STATE' }, stateObj));
            evaluateDuelOutcome();
        },

        notifyLocalDeath(finalScore, reason) {
            matchState.localDead = true;
            matchState.localScore = finalScore;

            if (conn && conn.open) {
                conn.send({
                    type: 'PLAYER_DEAD',
                    score: finalScore
                });
            }

            evaluateDuelOutcome();

            // Если я умер, но у меня больше очков, а соперник ещё жив — ждём, обгонит ли он меня
            if (!matchState.finished && !matchState.remoteDead && finalScore >= matchState.remoteScore) {
                if (window.AppHub) {
                    window.AppHub.showScreen('screen-gameover');
                    document.getElementById('go-title').textContent = '⏳ ЖДЁМ СОПЕРНИКА...';
                    document.getElementById('go-subtitle').textContent =
                        `Твой счёт: ${finalScore}. Соперник (${matchState.remoteScore}) ещё летит!`;
                }
            }
        },

        disconnect() {
            cleanupPeer();
        }
    };
})();
