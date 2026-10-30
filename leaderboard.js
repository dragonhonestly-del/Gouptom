(function () {
    const STORAGE_KEY = 'tom_canyon_leaderboard_v1';

    // Получаем имя игрока (из Telegram WebApp или дефолтное)
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

    // Загрузка таблицы лидеров из localStorage
    function getLeaders() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {}
        
        // Дефолтные стартовые значения, если таблица пуста
        return [
            { name: 'Говорящий Том', score: 1540 },
            { name: 'Анджела', score: 1200 },
            { name: 'Бен', score: 850 },
            { name: 'Хэнк', score: 520 }
        ];
    }

    // Сохранение рекорда
    function submitScore(newScore) {
        if (!newScore || newScore <= 0) return;
        const name = getPlayerName();
        let leaders = getLeaders();

        leaders.push({ name: name, score: newScore });
        
        // Сортируем по убыванию очков и оставляем топ-10
        leaders.sort((a, b) => b.score - a.score);
        
        // Уникализируем (если тот же игрок, оставляем лучший результат)
        const unique = [];
        const seenNames = new Set();
        for (let item of leaders) {
            if (!seenNames.has(item.name)) {
                seenNames.add(item.name);
                unique.push(item);
            }
        }

        const top10 = unique.slice(0, 10);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(top10));
        } catch (e) {}
    }

    // Рендер списка в интерфейсе (в HTML-элемент #leader-list-container)
    function renderList() {
        const container = document.getElementById('leader-list-container');
        if (!container) return;

        const leaders = getLeaders();
        container.innerHTML = '';

        if (leaders.length === 0) {
            container.innerHTML = '<li class="leader-item"><span>Пока нет рекордов</span><span>---</span></li>';
            return;
        }

        leaders.forEach((item, index) => {
            const medals = ['🥇', '🥈', '🥉'];
            const rankPrefix = medals[index] || `#${index + 1}`;

            const li = document.createElement('li');
            li.className = 'leader-item';
            li.innerHTML = `<span>${rankPrefix} ${item.name}</span><span style="color:#d94b07; font-weight:900;">${item.score}</span>`;
            container.appendChild(li);
        });
    }

    // Экспорт в глобальный объект
    window.Leaderboard = {
        submitScore,
        renderList
    };
})();
