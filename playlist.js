/**
 * music-mod.js — Исправленный плеер SoundCloud + JSONP Поиск (без CORS-ошибок на iOS/Telegram)
 */

(function () {
    // 1. Подключаем официальный SDK SoundCloud
    const scScript = document.createElement('script');
    scScript.src = 'https://w.soundcloud.com/player/api.js';
    document.head.appendChild(scScript);

    class SoundCloudModPlayer {
        constructor() {
            this.playlist = JSON.parse(localStorage.getItem('tom_sc_playlist_v2')) || [];
            this.currentIndex = 0;
            this.isPlaying = false;

            // HTML5 Audio для прямых потоков и найденных треков
            this.rawAudio = new Audio();
            this.rawAudio.addEventListener('ended', () => this.playNext());

            // Виджет SoundCloud
            this.scWidget = null;
            this.scIframe = null;

            this.initUI();
            this.initSCContainer();
        }

        initSCContainer() {
            // ВАЖНО для iOS: нельзя ставить display: none, иначе WebKit глушит звук и выдает ошибку!
            // Делаем микро-контейнер 1x1 пиксель за пределами видимости
            this.scIframe = document.createElement('iframe');
            this.scIframe.style.cssText = 'position:absolute; width:1px; height:1px; left:-9999px; top:-9999px; opacity:0.01; pointer-events:none;';
            this.scIframe.allow = 'autoplay; encrypted-media';
            this.scIframe.src = 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/293&auto_play=false';
            document.body.appendChild(this.scIframe);

            const bindWidget = () => {
                if (window.SC && window.SC.Widget) {
                    this.scWidget = window.SC.Widget(this.scIframe);
                    this.scWidget.bind(window.SC.Widget.Events.FINISH, () => this.playNext());
                } else {
                    setTimeout(bindWidget, 300);
                }
            };
            bindWidget();
        }

        initUI() {
            const style = document.createElement('style');
            style.innerHTML = `
                #sc-mod-btn { position: absolute; bottom: 20px; right: 20px; width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, #ff5500, #ff2200); color: white; font-size: 24px; border: 3px solid #fff; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 100; box-shadow: 0 5px 15px rgba(0,0,0,0.6); transition: transform 0.15s; }
                #sc-mod-btn:active { transform: scale(0.9); }
                #sc-mod-btn.playing { animation: scPulse 1.4s infinite; }
                @keyframes scPulse { 0% { box-shadow: 0 0 0 0 rgba(255, 85, 0, 0.8); } 70% { box-shadow: 0 0 0 16px rgba(255, 85, 0, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 85, 0, 0); } }
                
                #sc-modal { position: absolute; inset: 0; background: rgba(15, 10, 5, 0.85); backdrop-filter: blur(6px); display: none; flex-direction: column; justify-content: center; align-items: center; z-index: 150; padding: 16px; }
                .sc-card { background: #18181b; border: 3px solid #ff5500; border-radius: 20px; width: 100%; max-width: 360px; padding: 16px; color: #fff; box-shadow: 0 12px 35px rgba(0,0,0,0.8); }
                .sc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                .sc-title { font-size: 18px; font-weight: 900; color: #ff5500; display: flex; align-items: center; gap: 6px; }
                .sc-close-x { background: none; border: none; color: #a1a1aa; font-size: 20px; font-weight: bold; cursor: pointer; }
                
                .sc-input-group { display: flex; gap: 6px; margin-bottom: 8px; }
                .sc-input { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid #3f3f46; background: #27272a; color: #fff; font-size: 13px; outline: none; }
                .sc-input:focus { border-color: #ff5500; }
                .sc-action-btn { background: #ff5500; border: none; padding: 0 12px; border-radius: 10px; color: white; font-weight: 900; font-size: 13px; cursor: pointer; }
                
                .sc-status { font-size: 11px; color: #fbbf24; margin-bottom: 8px; min-height: 15px; text-align: center; }
                
                .sc-search-results { list-style: none; max-height: 120px; overflow-y: auto; background: #27272a; border-radius: 10px; margin-bottom: 8px; display: none; padding: 4px; border: 1px solid #52525b; }
                .sc-search-item { padding: 7px 8px; font-size: 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #3f3f46; cursor: pointer; }
                .sc-search-item:last-child { border-bottom: none; }

                .sc-list-label { font-size: 11px; color: #a1a1aa; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
                .sc-list { list-style: none; max-height: 170px; overflow-y: auto; margin-bottom: 12px; }
                .sc-item { background: #27272a; padding: 8px 10px; margin-bottom: 6px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border: 2px solid transparent; }
                .sc-item.active { border-color: #ff5500; background: #2e190f; }
                .sc-item-title { font-size: 12px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 230px; }
                .sc-item-del { background: transparent; border: none; color: #ef4444; font-size: 16px; cursor: pointer; margin-left: 8px; }
                
                .sc-controls { display: flex; gap: 8px; }
                .sc-btn { flex: 1; background: #3f3f46; border: none; padding: 11px; border-radius: 12px; color: white; font-weight: 900; font-size: 14px; cursor: pointer; }
                .sc-btn.play { background: #22c55e; }
                .sc-btn.pause { background: #eab308; color: #000; }
            `;
            document.head.appendChild(style);

            const wrapper = document.getElementById('app-wrapper') || document.body;

            this.btn = document.createElement('div');
            this.btn.id = 'sc-mod-btn';
            this.btn.innerHTML = '☁️';
            this.btn.onclick = () => this.toggleModal(true);
            wrapper.appendChild(this.btn);

            this.modal = document.createElement('div');
            this.modal.id = 'sc-modal';
            this.modal.innerHTML = `
                <div class="sc-card">
                    <div class="sc-header">
                        <div class="sc-title">☁️ SOUNDCLOUD МОД</div>
                        <button class="sc-close-x" id="sc-close-btn">✖</button>
                    </div>
                    <div class="sc-input-group">
                        <input type="text" id="sc-query-input" class="sc-input" placeholder="Ссылка SoundCloud или название песни...">
                        <button class="sc-action-btn" id="sc-submit-btn">НАЙТИ / ➕</button>
                    </div>
                    <div class="sc-status" id="sc-status-txt">Вставь ссылку с SoundCloud или введи название трека</div>
                    
                    <ul class="sc-search-results" id="sc-search-results"></ul>

                    <div class="sc-list-label">Мой плейлист (<span id="sc-count">0</span>/10):</div>
                    <ul class="sc-list" id="sc-track-list"></ul>
                    
                    <div class="sc-controls">
                        <button class="sc-btn play" id="sc-play-btn">▶ ИГРАТЬ</button>
                        <button class="sc-btn" id="sc-next-btn">⏭ СЛЕД.</button>
                    </div>
                </div>
            `;
            wrapper.appendChild(this.modal);

            document.getElementById('sc-close-btn').onclick = () => this.toggleModal(false);
            document.getElementById('sc-submit-btn').onclick = () => this.handleInput();
            document.getElementById('sc-play-btn').onclick = () => this.togglePlay();
            document.getElementById('sc-next-btn').onclick = () => this.playNext();

            this.renderList();
        }

        setStatus(msg) {
            const el = document.getElementById('sc-status-txt');
            if (el) el.textContent = msg;
        }

        toggleModal(show) {
            this.modal.style.display = show ? 'flex' : 'none';
        }

        async handleInput() {
            const input = document.getElementById('sc-query-input');
            const val = input.value.trim();
            if (!val) return;

            if (this.playlist.length >= 10) {
                this.setStatus('⚠️ Плейлист полон (макс 10 треков)!');
                return;
            }

            // 1. Обработка любой ссылки SoundCloud
            if (val.includes('soundcloud.com')) {
                this.setStatus('⏳ Получаю поток из SoundCloud...');
                try {
                    // Очищаем ссылку от лишних мобильных меток (?si=...)
                    const cleanUrl = val.split('?')[0];
                    const res = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(cleanUrl)}`);
                    if (!res.ok) throw new Error('SC error');
                    const data = await res.json();

                    // Вытаскиваем точный embed-URL из официального iframe-кода SoundCloud
                    let embedSrc = `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleanUrl)}&auto_play=true`;
                    const srcMatch = data.html && data.html.match(/src="([^"]+)"/);
                    if (srcMatch && srcMatch[1]) {
                        embedSrc = srcMatch[1];
                    }

                    this.playlist.push({
                        name: data.title || 'SoundCloud Track',
                        url: cleanUrl,
                        embedSrc: embedSrc,
                        type: 'soundcloud'
                    });
                    this.save();
                    input.value = '';
                    this.setStatus('✅ Трек добавлен!');
                    this.renderList();
                    this.playTrack(this.playlist.length - 1);
                } catch (err) {
                    this.setStatus('❌ Проверь, что ссылка полная (soundcloud.com/артист/трек)');
                }
                return;
            }

            // 2. Прямая ссылка на MP3
            if (val.startsWith('http') && (val.includes('.mp3') || val.includes('.ogg') || val.includes('.wav'))) {
                const name = decodeURIComponent(val.split('/').pop().split('?')[0]) || 'Аудиофайл';
                this.playlist.push({ name, url: val, type: 'raw' });
                this.save();
                input.value = '';
                this.setStatus('✅ MP3-трек добавлен!');
                this.renderList();
                return;
            }

            // 3. Поиск по названию через JSONP (обходит любые блокировки CORS в Telegram iOS)
            this.searchSongsJSONP(val);
        }

        searchSongsJSONP(query) {
            this.setStatus('🔍 Ищу песни...');
            const resultsBox = document.getElementById('sc-search-results');
            resultsBox.innerHTML = '';
            resultsBox.style.display = 'none';

            const cbName = 'itunes_cb_' + Math.floor(Math.random() * 1000000);
            const script = document.createElement('script');

            const timeout = setTimeout(() => {
                if (window[cbName]) {
                    delete window[cbName];
                    this.setStatus('❌ Сервер поиска не ответил');
                }
            }, 6000);

            window[cbName] = (data) => {
                clearTimeout(timeout);
                delete window[cbName];
                if (script.parentNode) script.parentNode.removeChild(script);

                if (!data || !data.results || data.results.length === 0) {
                    this.setStatus('😕 Ничего не найдено. Попробуй другое название.');
                    return;
                }

                this.setStatus('👇 Нажми на песню, чтобы добавить и включить:');
                resultsBox.style.display = 'block';

                data.results.forEach(item => {
                    if (!item.previewUrl) return;
                    const li = document.createElement('li');
                    li.className = 'sc-search-item';
                    const title = `${item.artistName} — ${item.trackName}`;
                    li.innerHTML = `
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:230px;">🎵 ${title}</span>
                        <span style="color:#22c55e; font-weight:bold;">+ В ПЛЕЙЛИСТ</span>
                    `;
                    li.onclick = () => {
                        if (this.playlist.length >= 10) {
                            this.setStatus('⚠️ Лимит 10 треков!');
                            return;
                        }
                        this.playlist.push({
                            name: title,
                            url: item.previewUrl,
                            type: 'raw'
                        });
                        this.save();
                        this.renderList();
                        resultsBox.style.display = 'none';
                        document.getElementById('sc-query-input').value = '';
                        this.playTrack(this.playlist.length - 1);
                    };
                    resultsBox.appendChild(li);
                });
            };

            script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=6&callback=${cbName}`;
            script.onerror = () => {
                clearTimeout(timeout);
                this.setStatus('❌ Ошибка подключения к каталогу');
            };
            document.body.appendChild(script);
        }

        stopAll() {
            this.rawAudio.pause();
            if (this.scWidget) {
                try { this.scWidget.pause(); } catch (e) {}
            }
            this.isPlaying = false;
            this.updatePlayBtnUI();
        }

        playTrack(index) {
            if (this.playlist.length === 0) return;
            this.currentIndex = index;
            const track = this.playlist[this.currentIndex];

            // Отключаем стандартную музыку игры
            if (window.sfx && typeof window.sfx.stopBgm === 'function') {
                window.sfx.stopBgm();
            }

            this.stopAll();
            this.isPlaying = true;
            this.renderList();
            this.updatePlayBtnUI();

            if (track.type === 'soundcloud') {
                this.setStatus(`▶️ Играет SC: ${track.name}`);
                // Загружаем напрямую в видимый 1x1 iframe с автозапуском
                const targetUrl = track.embedSrc || `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}`;
                this.scIframe.src = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'auto_play=true&buying=false&sharing=false&show_artwork=false';

                // Дополнительно пинаем через Widget API после подгрузки
                setTimeout(() => {
                    if (window.SC && window.SC.Widget) {
                        this.scWidget = window.SC.Widget(this.scIframe);
                        this.scWidget.bind(window.SC.Widget.Events.READY, () => {
                            this.scWidget.play();
                        });
                        this.scWidget.bind(window.SC.Widget.Events.FINISH, () => this.playNext());
                    }
                }, 400);
            } else {
                this.setStatus(`▶️ Играет: ${track.name}`);
                this.rawAudio.src = track.url;
                this.rawAudio.play().catch(() => {
                    this.setStatus('⚠️ Нажми ▶ ИГРАТЬ ещё раз для разблокировки звука');
                    this.isPlaying = false;
                    this.updatePlayBtnUI();
                });
            }
        }

        togglePlay() {
            if (this.playlist.length === 0) {
                this.setStatus('⚠️ Сначала найди песню или вставь ссылку!');
                return;
            }

            if (this.isPlaying) {
                this.stopAll();
                this.setStatus('⏸ Пауза');
            } else {
                this.playTrack(this.currentIndex);
            }
        }

        playNext() {
            if (this.playlist.length === 0) return;
            const nextIdx = (this.currentIndex + 1) % this.playlist.length;
            this.playTrack(nextIdx);
        }

        removeTrack(index, e) {
            e.stopPropagation();
            const wasPlayingThis = (index === this.currentIndex && this.isPlaying);
            this.playlist.splice(index, 1);
            if (this.currentIndex >= this.playlist.length) {
                this.currentIndex = Math.max(0, this.playlist.length - 1);
            }
            this.save();
            this.renderList();
            if (wasPlayingThis) {
                this.stopAll();
                if (this.playlist.length > 0) this.playTrack(this.currentIndex);
            }
        }

        updatePlayBtnUI() {
            const playBtn = document.getElementById('sc-play-btn');
            if (!playBtn) return;
            if (this.isPlaying) {
                playBtn.textContent = '⏸ ПАУЗА';
                playBtn.className = 'sc-btn pause';
                this.btn.classList.add('playing');
            } else {
                playBtn.textContent = '▶ ИГРАТЬ';
                playBtn.className = 'sc-btn play';
                this.btn.classList.remove('playing');
            }
        }

        save() {
            localStorage.setItem('tom_sc_playlist_v2', JSON.stringify(this.playlist));
        }

        renderList() {
            const list = document.getElementById('sc-track-list');
            const countEl = document.getElementById('sc-count');
            if (countEl) countEl.textContent = this.playlist.length;
            if (!list) return;

            list.innerHTML = '';
            this.playlist.forEach((track, idx) => {
                const li = document.createElement('li');
                li.className = `sc-item ${idx === this.currentIndex ? 'active' : ''}`;
                const badge = track.type === 'soundcloud' ? '☁️' : '🎵';
                li.innerHTML = `
                    <div class="sc-item-title">${idx + 1}. ${badge} ${track.name}</div>
                    <button class="sc-item-del" title="Удалить">✖</button>
                `;
                li.onclick = () => this.playTrack(idx);
                li.querySelector('.sc-item-del').onclick = (e) => this.removeTrack(idx, e);
                list.appendChild(li);
            });
        }
    }

    window.MusicMod = new SoundCloudModPlayer();
})();
