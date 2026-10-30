(function () {
    if (!window.firebase) {
        const script1 = document.createElement('script');
        script1.src = "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js";
        document.head.appendChild(script1);
        
        const script2 = document.createElement('script');
        script2.src = "https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js";
        script2.onload = initFirebase;
        document.head.appendChild(script2);
    } else {
        initFirebase();
    }

    let db = null;
    let remoteLeaders = [];

    function initFirebase() {
        try {
            const firebaseConfig = {
                apiKey: "AIzaSyBzZAvjxUPvmHw3Vra9yaVN6Qsbq6I5Xw4",
                authDomain: "goupt-9c04b.firebaseapp.com",
                databaseURL: "https://goupt-9c04b-default-rtdb.firebaseio.com",
                projectId: "goupt-9c04b",
                storageBucket: "goupt-9c04b.firebasestorage.app",
                messagingSenderId: "886738755810",
                appId: "1:886738755810:web:ce9755414606154584bebb"
            };

            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.database();
            console.log("Firebase подключен успешно!");

            // Слушаем мировую базу
            db.ref('leaderboard').orderByChild('score').limitToLast(10).on('value', (snapshot) => {
                const val = snapshot.val();
                if (val) {
                    remoteLeaders = Object.values(val).sort((a, b) => b.score - a.score);
                    console.log("Загружен топ игроков:", remoteLeaders);
                } else {
                    remoteLeaders = [];
                    console.log("База лидеров пока пуста.");
                }
                renderList();
            }, (error) => {
                console.error("Ошибка чтения базы данных:", error);
            });
        } catch (e) {
            console.error("Ошибка инициализации Firebase:", e);
        }
    }

    function getPlayerName() {
        try {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
                const user = window.Telegram.WebApp.initDataUnsafe.user;
                if (user) {
                    if (user.first_name) return user.first_name + (user.last_name ? ' ' + user.last_name[0] + '.' : '');
                    if (user.username) return '@' + user.username;
                }
            }
        } catch (e) {}
        return 'Игрок #' + Math.floor(100 + Math.random() * 900);
    }

    function submitScore(newScore) {
        if (!newScore || newScore <= 0) return;
        const name = getPlayerName();
        console.log(`Попытка отправить рекорд: ${newScore} от игрока ${name}`);

        try {
            const best = parseInt(localStorage.getItem('tomCanyonBest') || '0', 10);
            if (newScore > best) localStorage.setItem('tomCanyonBest', newScore.toString());
        } catch(e) {}

        if (db) {
            try {
                const newRef = db.ref('leaderboard').push();
                newRef.set({
                    name: name,
                    score: newScore,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                }).then(() => {
                    console.log("Рекорд успешно улетел в Firebase!");
                }).catch((err) => {
                    console.error("Ошибка записи рекорда:", err);
                });
            } catch (e) {
                console.error("Исключение при отправке рекорда:", e);
            }
        } else {
            console.warn("База данных db не инициализирована!");
        }
    }

    function renderList() {
        const container = document.getElementById('leader-list-container');
        if (!container) return;

        // Если в сети пусто, показываем дефолтные, чтобы блок не был пустым
        const leaders = remoteLeaders.length > 0 ? remoteLeaders : [
            { name: 'Говорящий Том', score: 1540 },
            { name: 'Анджела', score: 1200 },
            { name: 'Бен', score: 850 }
        ];

        container.innerHTML = '';
        leaders.slice(0, 10).forEach((item, index) => {
            const medals = ['🥇', '🥈', '🥉'];
            const rankPrefix = medals[index] || `#${index + 1}`;

            const li = document.createElement('li');
            li.className = 'leader-item';
            li.innerHTML = `<span>${rankPrefix} ${item.name}</span><span style="color:#d94b07; font-weight:900;">${item.score}</span>`;
            container.appendChild(li);
        });
    }

    window.Leaderboard = {
        submitScore,
        renderList
    };
})();
