/**
 * music-mod.js — Полноценный плеер SoundCloud + Полноразмерный каталог музыки
 */

(function () {
    const scScript = document.createElement('script');
    scScript.src = 'https://w.soundcloud.com/player/api.js';
    document.head.appendChild(scScript);

    class SoundCloudModPlayer {
        constructor() {
            this.playlist = JSON.parse(localStorage.getItem('tom_sc_playlist_v4')) || [];
            this.currentIndex = 0;
            this.isPlaying = false;
            this.searchResults = [];

            this.rawAudio = new Audio();
            this.rawAudio.addEventListener('ended', () => this.playNext());

            this.scWidget = null;
            this.scIframe = null;

            this.initUI();
            this.initSCContainer();
        }

        initSCContainer() {
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
                
                #sc-modal { position: absolute; inset: 0; background: rgba(15, 10, 5, 0.92); backdrop-filter: blur(8px); display: none; flex-direction: column; z-index: 150; padding: 16px; }
                .sc-card { background: #18181b; border: 3px solid #ff5500; border-radius: 20px; width: 100%; height: 100%; display: flex; flex-direction: column; padding: 16px; color: #fff; box-shadow: 0 12px 35px rgba(0,0,0,0.8); overflow: hidden; }
                .sc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
                .sc-title { font-size: 18px; font-weight: 900; color: #ff5500; display: flex; align-items: center; gap: 6px; }
                .sc-close-x { background: none; border: none; color: #a1a1aa; font-size: 22px; font-weight: bold; cursor: pointer; }
                
                .sc-input-group { display: flex; gap: 6px; margin-bottom: 8px; }
                .sc-input { flex: 1; padding: 12px; border-radius: 12px; border: 1px solid #3f3f46; background: #27272a; color: #fff; font-size: 14px; outline: none; }
                .sc-input:focus { border-color: #ff5500; }
                .sc-action-btn { background: #ff5500; border: none; padding: 0 16px; border-radius: 12px; color: white; font-weight: 900; font-size: 14px; cursor: pointer; }
                
                .sc-status { font-size: 12px; color: #fbbf24; margin-bottom: 8px; min-height: 18px; text-align: center; }
                
                .sc-tabs { display: flex; gap: 6px; margin-bottom: 10px; background: #27272a; padding: 4px; border-radius: 12px; }
                .sc-tab { flex: 1; background: transparent; border: none; padding: 8px; color: #a1a1aa; font-weight: 900; font-size: 12px; border-radius: 8px; cursor: pointer; }
                .sc-tab.active { background: #ff5500; color: #fff; }

                .sc-list { list-style: none; flex: 1; overflow-y: auto; margin-bottom: 10px; padding-right: 2px; }
                .sc-item { background: #27272a; padding: 10px 12px; margin-bottom: 8px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border: 2px solid transparent; }
                .sc-item.active { border-color: #ff5500; background: #2e190f; }
                .sc-item-info { display: flex; align-items: center; gap: 10px; overflow: hidden; }
                .sc-item-thumb { width: 40px; height: 40px; border-radius: 8px; background: #3f3f46; object-fit: cover; flex-shrink: 0; }
                .sc-item-title { font-size: 13px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
                .sc-item-sub { font-size: 11px; color: #a1a1aa; }
                .sc-item-btn { background: #ff5500; border: none; color: #fff; font-weight: 900; font-size: 12px; padding: 6px 10px; border-radius: 8px; cursor: pointer; flex-shrink: 0; }
                .sc-item-del { background: transparent; border: none; color: #ef4444; font-size: 18px; cursor: pointer; padding: 4px; }
                
                .sc-controls { display: flex; gap: 8px; padding-top: 6px; border-top: 1px solid #27272a; }
                .sc-btn { flex: 1; background: #3f3f46; border: none; padding: 12px; border-radius: 12px; color: white; font-weight: 900; font-size: 14px; cursor: pointer; }
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
                        <div class="sc-title">☁️ МУЗЫКАЛЬНЫЙ МОД</div>
                        <button class="sc-close-x" id="sc-close-btn">✖</button>
                    </div>
                    <div class="sc-input-group">
                        <input type="text" id="sc-query-input" class="sc-input" placeholder="Ссылка SoundCloud или название песни...">
                        <button class="sc-action-btn" id="sc-submit-btn">НАЙТИ</button>
                    </div>
                    <div class="sc-status" id="sc-status-txt">Вставь ссылку SoundCloud или введи название</div>
                    
                    <div class="sc-tabs">
                        <button class="sc-tab active" id="tab-playlist">ПЛЕЙЛИСТ (<span id="sc-count">0</span>/10)</button>
                        <button class="sc-tab" id="tab-search">РЕЗУЛЬТАТЫ ПОИСКА</button>
                    </div>

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

            document.getElementById('tab-playlist').onclick = () => {
                document.getElementById('tab-playlist').classList.add('active');
                document.getElementById('tab-search').classList.remove('active');
                this.renderPlaylist();
            };

            document.getElementById('tab-search').onclick = () => {
                document.getElementById('tab-search').classList.add('active');
                document.getElementById('tab-playlist').classList.remove('active');
                this.renderSearchResults();
            };

            this.renderPlaylist();
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

            if (val.includes('soundcloud.com')) {
                this.setStatus('⏳ Загружаю трек SoundCloud...');
                try {
                    const cleanUrl = val.split('?')[0];
                    const res = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(cleanUrl)}`);
                    if (!res.ok) throw new Error();
                    const data = await res.json();

                    let embedSrc = `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleanUrl)}&auto_play=true`;
                    const srcMatch = data.html && data.html.match(/src="([^"]+)"/);
                    if (srcMatch && srcMatch[1]) embedSrc = srcMatch[1];

                    if (this.playlist.length >= 10) {
                        this.setStatus('⚠️ Плейлист полон (макс 10)!');
                        return;
                    }

                    this.playlist.push({
                        name: data.title || 'SoundCloud Track',
                        artist: data.author_name || 'SoundCloud',
                        thumb: data.thumbnail_url || '',
                        url: cleanUrl,
                        embedSrc: embedSrc,
                        type: 'soundcloud'
                    });
                    this.save();
                    input.value = '';
                    this.setStatus('✅ Трек добавлен!');
                    document.getElementById('tab-playlist').click();
                    this.playTrack(this.playlist.length - 1);
                } catch (err) {
                    this.setStatus('❌ Ошибка ссылки SoundCloud');
                }
                return;
            }

            this.searchMusic(val);
        }

        searchMusic(query) {
            this.setStatus('🔍 Ищу треки...');
            const cbName = 'itunes_cb_' + Math.floor(Math.random() * 1000000);
            const script = document.createElement('script');

            const timeout = setTimeout(() => {
                if (window[cbName]) {
                    delete window[cbName];
                    this.setStatus('❌ Время поиска истекло');
                }
            }, 7000);

            window[cbName] = (data) => {
                clearTimeout(timeout);
                delete window[cbName];
                if (script.parentNode) script.parentNode.removeChild(script);

                if (!data || !data.results || data.results.length === 0) {
                    this.setStatus('😕 Ничего не найдено.');
                    return;
                }

                this.searchResults = data.results.map(item => ({
                    name: item.trackName,
                    artist: item.artistName,
                    thumb: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '300x300bb') : '',
                    url: item.previewUrl,
                    type: 'raw'
                }));

                this.setStatus(`✨ Найдено: ${this.searchResults.length}`);
                document.getElementById('tab-search').click();
            };

            script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=15&callback=${cbName}`;
            script.onerror = () => {
                clearTimeout(timeout);
                this.setStatus('❌ Ошибка сети');
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

            if (window.sfx && typeof window.sfx.stopBgm === 'function') {
                window.sfx.stopBgm();
            }

            this.stopAll();
            this.isPlaying = true;
            this.renderPlaylist();
            this.updatePlayBtnUI();

            if (track.type === 'soundcloud') {
                this.setStatus(`▶️ Играет: ${track.artist} - ${track.name}`);
                const targetUrl = track.embedSrc || `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}`;
                this.scIframe.src = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'auto_play=true&buying=false&sharing=false&show_artwork=false';

                setTimeout(() => {
                    if (window.SC && window.SC.Widget) {
                        this.scWidget = window.SC.Widget(this.scIframe);
                        this.scWidget.bind(window.SC.Widget.Events.READY, () => this.scWidget.play());
                        this.scWidget.bind(window.SC.Widget.Events.FINISH, () => this.playNext());
                    }
                }, 400);
            } else {
                this.setStatus(`▶️ Играет: ${track.artist} - ${track.name}`);
                this.rawAudio.src = track.url;
                this.rawAudio.play().catch(() => {
                    this.setStatus('⚠️ Нажми ▶ ИГРАТЬ для старта');
                    this.isPlaying = false;
                    this.updatePlayBtnUI();
                });
            }
        }

        togglePlay() {
            if (this.playlist.length === 0) {
                this.setStatus('⚠️ Плейлист пуст!');
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
            this.renderPlaylist();
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
            localStorage.setItem('tom_sc_playlist_v4', JSON.stringify(this.playlist));
        }

        renderPlaylist() {
            const list = document.getElementById('sc-track-list');
            const countEl = document.getElementById('sc-count');
            if (countEl) countEl.textContent = this.playlist.length;
            if (!list) return;

            list.innerHTML = '';
            if (this.playlist.length === 0) {
                list.innerHTML = `<div style="text-align:center; color:#71717a; padding: 40px; font-weight:bold;">Плейлист пуст. Найди песню через поиск или вставь ссылку SoundCloud!</div>`;
                return;
            }

            this.playlist.forEach((track, idx) => {
                const li = document.createElement('li');
                li.className = `sc-item ${idx === this.currentIndex && this.isPlaying ? 'active' : ''}`;
                li.innerHTML = `
                    <div class="sc-item-info">
                        <img class="sc-item-thumb" src="${track.thumb || 'https://via.placeholder.com/40'}" onerror="this.src='https://via.placeholder.com/40'">
                        <div>
                            <div class="sc-item-title">${track.name}</div>
                            <div class="sc-item-sub">${track.artist}</div>
                        </div>
                    </div>
                    <button class="sc-item-del" title="Удалить">🗑️</button>
                `;
                li.onclick = () => this.playTrack(idx);
                li.querySelector('.sc-item-del').onclick = (e) => this.removeTrack(idx, e);
                list.appendChild(li);
            });
        }

        renderSearchResults() {
            const list = document.getElementById('sc-track-list');
            if (!list) return;

            list.innerHTML = '';
            if (this.searchResults.length === 0) {
                list.innerHTML = `<div style="text-align:center; color:#71717a; padding: 40px; font-weight:bold;">Ничего не найдено. Введи название в строку сверху.</div>`;
                return;
            }

            this.searchResults.forEach((track) => {
                const li = document.createElement('li');
                li.className = `sc-item`;
                li.innerHTML = `
                    <div class="sc-item-info">
                        <img class="sc-item-thumb" src="${track.thumb}" onerror="this.src='https://via.placeholder.com/40'">
                        <div>
                            <div class="sc-item-title">${track.name}</div>
                            <div class="sc-item-sub">${track.artist}</div>
                        </div>
                    </div>
                    <button class="sc-item-btn">+ ДОБАВИТЬ</button>
                `;
                li.querySelector('.sc-item-btn').onclick = (e) => {
                    e.stopPropagation();
                    if (this.playlist.length >= 10) {
                        this.setStatus('⚠️ Лимит плейлиста (10 треков)!');
                        return;
                    }
                    this.playlist.push(track);
                    this.save();
                    this.setStatus(`✅ Добавлено: ${track.name}`);
                    document.getElementById('tab-playlist').click();
                    this.playTrack(this.playlist.length - 1);
                };
                list.appendChild(li);
            });
        }
    }

    window.MusicMod = new SoundCloudModPlayer();
})();
