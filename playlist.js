/**
 * playlist.js — Автономное SoundCloud Мод-Меню
 * Создает плавающую кнопку, интерфейс и управляет скрытым виджетом SC
 */

(function() {
    // 1. Подгружаем официальный API SoundCloud
    const scApiScript = document.createElement('script');
    scApiScript.src = "https://w.soundcloud.com/player/api.js";
    document.head.appendChild(scApiScript);

    // 2. Внедряем стили для мод-меню
    const style = document.createElement('style');
    style.innerHTML = `
        #sc-mod-btn { position: absolute; bottom: 20px; right: 20px; width: 50px; height: 50px; background: #d94b07; border: 3px solid #fff; border-radius: 50%; color: #fff; font-size: 24px; font-weight: bold; cursor: pointer; display: flex; justify-content: center; align-items: center; z-index: 100; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: transform 0.1s; }
        #sc-mod-btn:active { transform: scale(0.9); }
        #sc-modal { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 320px; background: #fff8eb; border: 4px solid #4a2810; border-radius: 20px; padding: 16px; z-index: 101; display: none; flex-direction: column; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
        #sc-modal.active { display: flex; }
        .sc-title { font-size: 20px; font-weight: 900; color: #d94b07; text-align: center; text-transform: uppercase; margin-bottom: 5px; }
        .sc-input-group { display: flex; gap: 6px; }
        #sc-input { flex: 1; padding: 8px; border: 2px solid #4a2810; border-radius: 8px; font-weight: bold; outline: none; }
        #sc-add-btn { background: #56d943; border: 2px solid #2b1708; color: #fff; font-weight: 900; padding: 0 12px; border-radius: 8px; cursor: pointer; }
        #sc-search-link { display: none; text-align: center; background: #ff7b29; color: #fff; padding: 8px; text-decoration: none; border-radius: 8px; font-weight: bold; border: 2px solid #2b1708; }
        .sc-list { list-style: none; margin: 0; padding: 0; max-height: 200px; overflow-y: auto; }
        .sc-item { display: flex; justify-content: space-between; align-items: center; background: #fff; border: 2px solid #4a2810; margin-bottom: 6px; padding: 6px 10px; border-radius: 8px; font-size: 13px; font-weight: bold; color: #4a2810; cursor: pointer; }
        .sc-item.playing { background: #b8f246; border-color: #15803d; }
        .sc-del-btn { background: #ef4444; border: 2px solid #7f1d1d; color: white; border-radius: 4px; padding: 2px 6px; font-weight: bold; cursor: pointer; }
        #sc-close-btn { background: #9e9083; border: 2px solid #4a2810; color: #fff; padding: 8px; font-weight: 900; border-radius: 8px; cursor: pointer; margin-top: 5px; }
    `;
    document.head.appendChild(style);

    // 3. Создаем скрытый iframe плеера и UI
    const container = document.getElementById('app-wrapper') || document.body;
    
    const iframe = document.createElement('iframe');
    iframe.id = 'sc-widget-iframe';
    iframe.width = "0"; iframe.height = "0";
    iframe.frameBorder = "no";
    iframe.allow = "autoplay";
    // Загружаем пустой виджет по умолчанию
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/293&auto_play=false&hide_related=true";
    container.appendChild(iframe);

    const modBtn = document.createElement('div');
    modBtn.id = 'sc-mod-btn';
    modBtn.innerHTML = '🎵';
    container.appendChild(modBtn);

    const modal = document.createElement('div');
    modal.id = 'sc-modal';
    modal.innerHTML = `
        <div class="sc-title">Плейлист</div>
        <div class="sc-input-group">
            <input type="text" id="sc-input" placeholder="Ссылка или название...">
            <button id="sc-add-btn">➕</button>
        </div>
        <a id="sc-search-link" href="#" target="_blank">🔍 Найти в SoundCloud</a>
        <ul class="sc-list" id="sc-list"></ul>
        <button id="sc-close-btn">ЗАКРЫТЬ</button>
    `;
    container.appendChild(modal);

    // 4. Логика плейлиста
    let playlist = JSON.parse(localStorage.getItem('tom_playlist') || '[]');
    let currentTrackIndex = -1;
    let widget = null;
    let isWidgetReady = false;

    const listEl = document.getElementById('sc-list');
    const inputEl = document.getElementById('sc-input');
    const addBtn = document.getElementById('sc-add-btn');
    const searchLink = document.getElementById('sc-search-link');

    // Инициализация SC Widget после загрузки скрипта
    scApiScript.onload = () => {
        widget = SC.Widget(iframe);
        widget.bind(SC.Widget.Events.READY, () => {
            isWidgetReady = true;
            widget.setVolume(50);
        });
        widget.bind(SC.Widget.Events.FINISH, () => {
            playNext(); // Автопереключение на следующий трек
        });
    };

    function saveAndRender() {
        if (playlist.length > 10) playlist = playlist.slice(0, 10);
        localStorage.setItem('tom_playlist', JSON.stringify(playlist));
        listEl.innerHTML = '';
        
        playlist.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = `sc-item ${index === currentTrackIndex ? 'playing' : ''}`;
            
            const titleSpan = document.createElement('span');
            // Вытягиваем имя из ссылки для красоты, если нет явного названия
            titleSpan.textContent = track.name || track.url.split('/').pop().split('?')[0].substring(0, 20) + '...';
            titleSpan.style.flex = "1";
            titleSpan.onclick = () => playTrack(index);

            const delBtn = document.createElement('button');
            delBtn.className = 'sc-del-btn';
            delBtn.textContent = 'X';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                playlist.splice(index, 1);
                if (currentTrackIndex === index) {
                    widget.pause();
                    currentTrackIndex = -1;
                } else if (currentTrackIndex > index) {
                    currentTrackIndex--;
                }
                saveAndRender();
            };

            li.appendChild(titleSpan);
            li.appendChild(delBtn);
            listEl.appendChild(li);
        });
    }

    function playTrack(index) {
        if (!isWidgetReady || !playlist[index]) return;
        currentTrackIndex = index;
        saveAndRender();

        // Глушим стандартную музыку игры, если она есть
        if (window.sfx && typeof window.sfx.stopBgm === 'function') {
            window.sfx.stopBgm();
        }

        // Загружаем и играем
        widget.load(playlist[index].url, {
            auto_play: true,
            hide_related: true,
            show_comments: false,
            show_user: false,
            show_reposts: false
        });
    }

    function playNext() {
        if (playlist.length === 0) return;
        let nextIdx = currentTrackIndex + 1;
        if (nextIdx >= playlist.length) nextIdx = 0;
        playTrack(nextIdx);
    }

    // Обработка ввода (Умный инпут)
    inputEl.addEventListener('input', () => {
        const val = inputEl.value.trim();
        if (val.length > 0 && !val.includes('soundcloud.com')) {
            // Режим поиска по названию (открывает новую вкладку с результатами)
            searchLink.style.display = 'block';
            searchLink.href = `https://soundcloud.com/search/sounds?q=${encodeURIComponent(val)}`;
            addBtn.style.display = 'none';
        } else {
            // Режим добавления прямой ссылки
            searchLink.style.display = 'none';
            addBtn.style.display = 'block';
        }
    });

    addBtn.onclick = () => {
        const val = inputEl.value.trim();
        if (!val.includes('soundcloud.com')) return;
        
        if (playlist.length >= 10) {
            alert('Плейлист заполнен (макс 10). Удалите старые треки.');
            return;
        }

        playlist.push({ url: val, name: val.split('/').pop().replace(/-/g, ' ') });
        inputEl.value = '';
        addBtn.style.display = 'block';
        searchLink.style.display = 'none';
        saveAndRender();
    };

    modBtn.onclick = () => modal.classList.add('active');
    document.getElementById('sc-close-btn').onclick = () => modal.classList.remove('active');

    saveAndRender();
})();
