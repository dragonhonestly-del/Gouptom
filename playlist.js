/**
 * music-mod.js — Плавающий мод-плеер для загрузки своих треков
 * Позволяет добавлять треки по URL (или прямым ссылкам на mp3/soundcloud)
 * Хранит до 10 треков в локальном плейлисте.
 */

(function () {
    class CustomMusicPlayer {
        constructor() {
            this.playlist = JSON.parse(localStorage.getItem('tom_playlist')) || [];
            this.currentIndex = 0;
            this.audio = new Audio();
            this.audio.addEventListener('ended', () => this.playNext());
            
            this.initUI();
        }

        initUI() {
            // Внедряем стили мода прямо через JS, чтобы не трогать CSS в index.html
            const style = document.createElement('style');
            style.innerHTML = `
                #sc-mod-btn { position: absolute; bottom: 20px; right: 20px; width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #ff5500, #ff7700); color: white; font-size: 24px; border: 3px solid #4a2810; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 100; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: transform 0.1s; }
                #sc-mod-btn:active { transform: scale(0.9); }
                #sc-modal { position: absolute; inset: 0; background: rgba(0,0,0,0.8); display: none; flex-direction: column; justify-content: center; align-items: center; z-index: 150; padding: 20px; }
                .sc-card { background: #1e1e1e; border: 4px solid #ff5500; border-radius: 16px; width: 100%; max-width: 340px; padding: 16px; color: white; box-shadow: 0 10px 30px rgba(255,85,0,0.2); }
                .sc-title { font-size: 20px; font-weight: 900; color: #ff5500; text-align: center; margin-bottom: 12px; }
                .sc-input-group { display: flex; gap: 8px; margin-bottom: 12px; }
                .sc-input { flex: 1; padding: 8px; border-radius: 8px; border: none; background: #333; color: white; font-size: 14px; outline: none; }
                .sc-add-btn { background: #ff5500; border: none; padding: 0 12px; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; }
                .sc-list { list-style: none; max-height: 200px; overflow-y: auto; margin-bottom: 12px; padding-right: 4px; }
                .sc-item { background: #2a2a2a; padding: 8px 12px; margin-bottom: 6px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border: 2px solid transparent; }
                .sc-item.active { border-color: #ff5500; background: #3a2215; }
                .sc-item-del { background: transparent; border: none; color: #ef4444; font-size: 18px; cursor: pointer; }
                .sc-controls { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
                .sc-btn { background: #444; border: none; padding: 10px 16px; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; width: 48%; }
                .sc-btn.play { background: #22c55e; }
            `;
            document.head.appendChild(style);

            // Кнопка на экране
            this.btn = document.createElement('div');
            this.btn.id = 'sc-mod-btn';
            this.btn.innerHTML = '🎵';
            this.btn.onclick = () => this.toggleModal(true);
            document.getElementById('app-wrapper').appendChild(this.btn);

            // Модальное окно
            this.modal = document.createElement('div');
            this.modal.id = 'sc-modal';
            this.modal.innerHTML = `
                <div class="sc-card">
                    <div class="sc-title">МОЙ ПЛЕЙЛИСТ</div>
                    <div class="sc-input-group">
                        <input type="text" id="sc-url-input" class="sc-input" placeholder="Прямая ссылка на mp3...">
                        <button class="sc-add-btn" id="sc-add-btn">➕</button>
                    </div>
                    <ul class="sc-list" id="sc-track-list"></ul>
                    <div class="sc-controls">
                        <button class="sc-btn play" id="sc-play-btn">▶ ИГРАТЬ</button>
                        <button class="sc-btn" id="sc-close-btn">ЗАКРЫТЬ</button>
                    </div>
                </div>
            `;
            document.getElementById('app-wrapper').appendChild(this.modal);

            // Привязка событий
            document.getElementById('sc-close-btn').onclick = () => this.toggleModal(false);
            document.getElementById('sc-add-btn').onclick = () => this.addTrack();
            document.getElementById('sc-play-btn').onclick = () => this.togglePlay();

            this.renderList();
        }

        toggleModal(show) {
            this.modal.style.display = show ? 'flex' : 'none';
        }

        addTrack() {
            const input = document.getElementById('sc-url-input');
            const url = input.value.trim();
            if (!url) return;

            if (this.playlist.length >= 10) {
                alert('Плейлист переполнен! Удали старые треки (макс 10).');
                return;
            }

            // Берем название файла из ссылки (или ставим дефолтное)
            let name = url.split('/').pop().split('?')[0] || `Трек ${this.playlist.length + 1}`;
            if (name.length > 20) name = name.substring(0, 20) + '...';

            this.playlist.push({ name, url });
            this.save();
            input.value = '';
            this.renderList();
        }

        removeTrack(index, e) {
            e.stopPropagation();
            this.playlist.splice(index, 1);
            if (this.currentIndex >= index && this.currentIndex > 0) this.currentIndex--;
            this.save();
            this.renderList();
        }

        save() {
            localStorage.setItem('tom_playlist', JSON.stringify(this.playlist));
        }

        renderList() {
            const list = document.getElementById('sc-track-list');
            list.innerHTML = '';
            this.playlist.forEach((track, idx) => {
                const li = document.createElement('li');
                li.className = `sc-item ${idx === this.currentIndex ? 'active' : ''}`;
                li.innerHTML = `
                    <span style="font-size:13px; font-weight:bold;">${idx + 1}. ${track.name}</span>
                    <button class="sc-item-del">✖</button>
                `;
                li.onclick = () => {
                    this.currentIndex = idx;
                    this.renderList();
                };
                li.querySelector('.sc-item-del').onclick = (e) => this.removeTrack(idx, e);
                list.appendChild(li);
            });
        }

        togglePlay() {
            const playBtn = document.getElementById('sc-play-btn');
            
            if (!this.audio.paused && this.audio.src) {
                this.audio.pause();
                playBtn.innerHTML = '▶ ИГРАТЬ';
                this.btn.style.animation = 'none';
                return;
            }

            if (this.playlist.length === 0) {
                alert('Добавь хотя бы один трек!');
                return;
            }

            // Глушим стандартный движок игры
            if (window.sfx && typeof window.sfx.stopBgm === 'function') {
                window.sfx.stopBgm();
            }

            this.audio.src = this.playlist[this.currentIndex].url;
            this.audio.play().catch(e => alert('Ошибка загрузки трека. Убедись, что это прямая ссылка.'));
            playBtn.innerHTML = '⏸ ПАУЗА';
            
            // Анимация пульсации кнопки при игре
            this.btn.style.animation = 'pulse 1.5s infinite';
        }

        playNext() {
            if (this.playlist.length === 0) return;
            this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
            this.renderList();
            this.togglePlay(); // запускаем следующий
            this.togglePlay(); // хак для сброса стейта кнопки
        }
    }

    // Инициализируем плеер
    window.MusicMod = new CustomMusicPlayer();

    // Добавляем кейфреймы для пульсации
    const animStyle = document.createElement('style');
    animStyle.innerHTML = `@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255, 85, 0, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(255, 85, 0, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 85, 0, 0); } }`;
    document.head.appendChild(animStyle);
})();
