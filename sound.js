/**
 * sound.js — Полный аудиодвижок для «ТОЛЬКО ВВЕРХ!»
 * Включает:
 *  - Все оригинальные SFX (рогатка, зацеп, шипы, щит, комбо)
 *  - Процедурный синтезатор фоновой вестерн-мелодии (без файлов)
 *  - Загрузчик внешней MP3/OGG музыки
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.masterVolume = 1.0;
        this.sfxVolume = 0.85;
        this.musicVolume = 0.35;

        // Внутренние шины громкости Web Audio API
        this.sfxGainNode = null;
        this.musicGainNode = null;

        // Фоновая процедурная музыка
        this.musicInterval = null;
        this.musicPlaying = false;
        this.musicStep = 0;

        // Внешний плеер для MP3 треков
        this.bgAudio = new Audio();
        this.bgAudio.loop = true;
        this.hasCustomTrack = false;
    }

    /**
     * Инициализация аудио-контекста по клику / тачу (требование браузеров)
     */
    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
                
                // Создаем отдельные каналы громкости
                this.sfxGainNode = this.ctx.createGain();
                this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
                this.sfxGainNode.connect(this.ctx.destination);

                this.musicGainNode = this.ctx.createGain();
                this.musicGainNode.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
                this.musicGainNode.connect(this.ctx.destination);
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Переключение звука Вкл / Выкл
     */
    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            if (this.sfxGainNode) this.sfxGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
            if (this.musicGainNode) this.musicGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
            this.bgAudio.pause();
        } else {
            if (this.sfxGainNode) this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
            if (this.musicGainNode) this.musicGainNode.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
            if (this.hasCustomTrack) this.bgAudio.play().catch(() => {});
        }
        return this.muted;
    }

    /* =========================================================================
     *  1. ИГРОВЫЕ ЗВУКОВЫЕ ЭФФЕКТЫ (SFX)
     * ========================================================================= */

    // Звук натяжения резины при оттягивании Тома
    playRubberStretch(ratio) {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(140 + ratio * 180, now);
        osc.frequency.exponentialRampToValueAtTime(160 + ratio * 200, now + 0.05);

        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

        osc.connect(gain);
        gain.connect(this.sfxGainNode || this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.055);
    }

    // Звук выстрела из рогатки
    playLaunch() {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(720, now + 0.18);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

        osc.connect(gain);
        gain.connect(this.sfxGainNode || this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.19);
    }

    // Звук зацепа за плитку (тональность повышается с ростом комбо)
    playLatch(combo = 1, isRed = false) {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        const base = (isRed ? 480 : 420) + Math.min(combo * 35, 260);

        osc.frequency.setValueAtTime(base, now);
        osc.frequency.exponentialRampToValueAtTime(base * 1.35, now + 0.1);

        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        osc.connect(gain);
        gain.connect(this.sfxGainNode || this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.11);
    }

    // Рикошет от деревянных/каменных стен каньона
    playWallBounce() {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        osc.connect(gain);
        gain.connect(this.sfxGainNode || this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.11);
    }

    // Подбор магнита-щита
    playBonus() {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.04);

            gain.gain.setValueAtTime(0.1, now + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.15);

            osc.connect(gain);
            gain.connect(this.sfxGainNode || this.ctx.destination);

            osc.start(now + idx * 0.04);
            osc.stop(now + idx * 0.04 + 0.15);
        });
    }

    // Удар о шипы или спасение щитом
    playHit(shieldSaved = false) {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

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

        osc.connect(gain);
        gain.connect(this.sfxGainNode || this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
    }

    /* =========================================================================
     *  2. ПРОЦЕДУРНАЯ ФОНОВАЯ ВЕСТЕРН-МЕЛОДИЯ (СИНТЕЗ БЕЗ MP3)
     * ========================================================================= */

    // Запуск процедурного вестерн-эмбиента
    startBgm() {
        if (this.musicPlaying || this.hasCustomTrack) return;
        this.init();
        this.musicPlaying = true;
        this.musicStep = 0;

        // Вестерн-пентатоника (басовые и колокольчиковые частоты)
        const bassLine = [110, 110, 130.81, 146.83, 164.81, 146.83, 130.81, 98]; // A, C, D, E
        const leadLine = [440, 0, 523.25, 587.33, 0, 659.25, 587.33, 440];

        this.musicInterval = setInterval(() => {
            if (this.muted || !this.ctx) return;

            const now = this.ctx.currentTime;
            const bassNote = bassLine[this.musicStep % bassLine.length];
            const leadNote = leadLine[this.musicStep % leadLine.length];

            // 1. Щипок кантри-баса
            if (bassNote > 0) {
                const bOsc = this.ctx.createOscillator();
                const bGain = this.ctx.createGain();
                bOsc.type = 'triangle';
                bOsc.frequency.setValueAtTime(bassNote, now);
                bGain.gain.setValueAtTime(0.08, now);
                bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                bOsc.connect(bGain);
                bGain.connect(this.musicGainNode || this.ctx.destination);
                bOsc.start(now);
                bOsc.stop(now + 0.22);
            }

            // 2. Легкий колокольчик / банджо-гармоника
            if (leadNote > 0) {
                const lOsc = this.ctx.createOscillator();
                const lGain = this.ctx.createGain();
                lOsc.type = 'sine';
                lOsc.frequency.setValueAtTime(leadNote, now);
                lGain.gain.setValueAtTime(0.04, now);
                lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                lOsc.connect(lGain);
                lGain.connect(this.musicGainNode || this.ctx.destination);
                lOsc.start(now);
                lOsc.stop(now + 0.35);
            }

            this.musicStep++;
        }, 260); // Скорость темпа
    }

    // Остановка музыки
    stopBgm() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
        this.musicPlaying = false;
        if (this.bgAudio) this.bgAudio.pause();
    }

    /* =========================================================================
     *  3. ПОДКЛЮЧЕНИЕ СВОЕГО MP3 ТРЕКА
     * ========================================================================= */

    /**
     * Позволяет установить внешнюю музыку:
     * sfx.loadSong('music/western_theme.mp3');
     */
    loadSong(url) {
        this.stopBgm();
        this.bgAudio.src = url;
        this.bgAudio.volume = this.musicVolume;
        this.hasCustomTrack = true;
        if (!this.muted) {
            this.bgAudio.play().catch(() => {
                console.log("Автовоспроизведение аудио будет активировано после первого клика");
            });
        }
    }
}

// Экспортируем единственный глобальный экземпляр
window.sfx = new SoundEngine();
