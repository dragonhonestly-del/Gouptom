/**
 * music-mod.js — Премиальный SoundCloud Плейлист (в стиле Telegram Mini App)
 * Без ломающих верстку поисковиков: вставил ссылку -> трек мгновенно в плейлисте.
 */

(function () {
    const scScript = document.createElement('script');
    scScript.src = 'https://w.soundcloud.com/player/api.js';
    document.head.appendChild(scScript);

    class SoundCloudModPlayer {
        constructor() {
            this.playlist = JSON.parse(localStorage.getItem('tom_sc_playlist_v3')) || [];
            this.currentIndex = 0;
            this.isPlaying = false;

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
                
                #sc-modal { position: absolute; inset: 0; background: rgba(15, 10, 5, 0.88); backdrop-filter: blur(6px); display: none; flex-direction: column; justify-content: center; align-items: center; z-index: 150; padding: 16px; }
                .sc-card { background: #18181b; border: 3px solid #ff5500; border-radius: 22px; width: 100%; max-width: 360px; padding: 18px; color: #fff; box-shadow: 0 15px 40px rgba(0,0,0,0.85); }
                .sc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
                .sc-title { font-size: 18px; font-weight: 900; color: #ff5500; display: flex; align-items: center; gap: 6px; }
                .sc-close-x { background: none; border: none; color: #a1a1aa; font-size: 22px; font-weight: bold; cursor: pointer; }
                
                .sc-input-group { display: flex; gap: 6px; margin-bottom: 10px; }
                .sc-input { flex: 1; padding: 11px; border-radius: 12px; border: 1px solid #3f3f46; background: #27272a; color: #fff; font-size: 13px; outline: none; }
                .sc-input:focus { border-color: #ff5500; }
                .sc-action-btn { background: #ff5500; border: none; padding: 0 14px; border-radius: 12px; color: white; font-weight: 900; font-size: 14px; cursor: pointer; }
                
                .sc-status { font-size: 11px; color: #fbbf24; margin-bottom: 10px; min-height: 16px; text-align: center; }

                .sc-list-label { font-size: 11px; color: #a1a1aa; text-transform: uppercase; font-weight: bold; margin-bottom: 6px; display: flex; justify-content: space-between; }
                .sc-list { list-style: none; max-height: 220px; overflow-y: auto; margin-bottom: 14px; padding-right: 2px; }
                .sc-item { background: #27272a; padding: 10px 12px; margin-bottom: 8px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border: 2px solid transparent; transition: background 0.1s; }
                .sc-item:hover { background: #3f3f46; }
                .sc-item.active { border-color: #ff5500; background: #2e190f; }
                
                .sc-item-info { display: flex; flex-direction: column; max-width: 240px; }
                .sc-item-title { font-size: 13px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff; }
                .sc-item-source { font-size: 10px; color: #ff5500; font-weight: bold; margin-top: 2px; display: flex; align-items: center; gap: 3px; }
                
                .sc-item-del { background: rgba(239, 68, 68, 0.15); border: none; color: #ef4444; width: 28px; height: 28px; border-radius: 50%; font-size: 14px; display: flex; justify-content: center; align-items: center; cursor: pointer; }
                
                .sc-controls { display: flex; gap: 8px; }
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
                        <div class="sc-title">☁️ SOUNDCLOUD ПЛЕЙЛИСТ</div>
                        <button class="sc-close-x" id="sc-close-btn">✖</button>
                    </div>
                    <div class="sc-input-group">
                        <input type="text" id="sc-url-input" class="sc-input" placeholder="Вставь ссылку на трек из SoundCloud...">
                        <button class="sc-action-btn" id="sc-add-btn">➕</button>
                    </div>
                    <div class="sc-status" id="sc-status-txt">Вставь ссылку (макс. 10 треков)</div>

                    <div class="sc-list-label">
                        <span>История треков</span>
                        <span id="sc-count">0/10</span>
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
            document.getElementById('sc-add-btn').onclick = () => this.handleLinkInput();
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

        async handleLinkInput() {
            const input = document.getElementById('sc-url-input');
            const val = input.value.trim();
            if (!val) return;

            if (this.playlist.length >= 10) {
                this.setStatus('⚠️ Плейлист полон (макс 10 треков)! Удалите старый.');
                return;
            }

            if (!val.includes('soundcloud.com') && !val.includes('on.soundcloud.com')) {
                this.setStatus('❌ Нужна ссылка именно с SoundCloud');
                return;
            }

            this.setStatus('⏳ Загружаю трек...');
            try {
                const cleanUrl = val.split('?')[0];
                const res = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(cleanUrl)}`);
                if (!res.ok) throw new Error('SC error');
                const data = await res.json();

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
                this.setStatus('✅ Трек успешно добавлен!');
                this.renderList();
                this.playTrack(this.playlist.length - 1);
            } catch (err) {
                this.setStatus('❌ Ошибка: проверьте ссылку на трек');
            }
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
            this.renderList();
            this.updatePlayBtnUI();

            this.setStatus(`▶️ Играет: ${track.name}`);
            const targetUrl = track.embedSrc || `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}`;
            this.scIframe.src = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'auto_play=true&buying=false&sharing=false&show_artwork=false';

            setTimeout(() => {
                if (window.SC && window.SC.Widget) {
                    this.scWidget = window.SC.Widget(this.scIframe);
                    this.scWidget.bind(window.SC.Widget.Events.READY, () => this.scWidget.play());
                    this.scWidget.bind(window.SC.Widget.Events.FINISH, () => this.playNext());
                }
            }, 300);
        }

        togglePlay() {
            if (this.playlist.length === 0) {
                this.setStatus('⚠️ Вставьте ссылку на трек вверху!');
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
            localStorage.setItem('tom_sc_playlist_v3', JSON.stringify(this.playlist));
            const countEl = document.getElementById('sc-count');
            if (countEl) countEl.textContent = `${this.playlist.length}/10`;
        }

        renderList() {
            const list = document.getElementById('sc-track-list');
            const countEl = document.getElementById('sc-count');
            if (countEl) countEl.textContent = `${this.playlist.length}/10`;
            if (!list) return;

            list.innerHTML = '';
            this.playlist.forEach((track, idx) => {
                const li = document.createElement('li');
                li.className = `sc-item ${idx === this.currentIndex ? 'active' : ''}`;
                li.innerHTML = `
                    <div class="sc-item-info">
                        <div class="sc-item-title">${idx + 1}. ${track.name}</div>
                        <div class="sc-item-source">☁️ SoundCloud</div>
                    </div>
                    <button class="sc-item-del" title="Удалить">🗑</button>
                `;
                li.onclick = () => this.playTrack(idx);
                li.querySelector('.sc-item-del').onclick = (e) => this.removeTrack(idx, e);
                list.appendChild(li);
            });
        }
    }

    window.MusicMod = new SoundCloudModPlayer();
})();
