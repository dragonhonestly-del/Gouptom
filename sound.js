/**
 * sound.js — Аудиодвижок с автоматической поддержкой western.mp3
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.sfxVolume = 0.85;
        this.musicVolume = 0.35;

        this.sfxGainNode = null;
        this.musicGainNode = null;

        // Плеер для трека western.mp3
        this.bgAudio = new Audio();
        this.bgAudio.loop = true;
        this.bgAudio.src = 'western.mp3';
        this.hasCustomTrack = false;

        this.musicInterval = null;
        this.musicPlaying = false;
        this.musicStep = 0;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
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

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            if (this.sfxGainNode) this.sfxGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
            if (this.musicGainNode) this.musicGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
            this.bgAudio.pause();
        } else {
            if (this.sfxGainNode) this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
            if (this.musicGainNode) this.musicGainNode.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
            if (!this.musicPlaying) this.startBgm();
        }
        return this.muted;
    }

    /* SFX ЭФФЕКТЫ */
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

    playBonus() {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
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

    /* ФОНОВАЯ МУЗЫКА */
    startBgm() {
        if (this.muted) return;
        this.init();

        this.bgAudio.volume = this.musicVolume;
        const playPromise = this.bgAudio.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.musicPlaying = true;
            }).catch(() => {
                this.startFallbackSynth();
            });
        }
    }

    startFallbackSynth() {
        if (this.musicPlaying) return;
        this.musicPlaying = true;
        this.musicStep = 0;
        const bassLine = [110, 110, 130.81, 146.83, 164.81, 146.83, 130.81, 98];
        const leadLine = [440, 0, 523.25, 587.33, 0, 659.25, 587.33, 440];

        this.musicInterval = setInterval(() => {
            if (this.muted || !this.ctx) return;
            const now = this.ctx.currentTime;
            const bass = bassLine[this.musicStep % bassLine.length];
            const lead = leadLine[this.musicStep % leadLine.length];

            if (bass > 0) {
                const bOsc = this.ctx.createOscillator();
                const bGain = this.ctx.createGain();
                bOsc.type = 'triangle';
                bOsc.frequency.setValueAtTime(bass, now);
                bGain.gain.setValueAtTime(0.08, now);
                bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                bOsc.connect(bGain);
                bGain.connect(this.musicGainNode || this.ctx.destination);
                bOsc.start(now);
                bOsc.stop(now + 0.22);
            }

            if (lead > 0) {
                const lOsc = this.ctx.createOscillator();
                const lGain = this.ctx.createGain();
                lOsc.type = 'sine';
                lOsc.frequency.setValueAtTime(lead, now);
                lGain.gain.setValueAtTime(0.04, now);
                lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                lOsc.connect(lGain);
                lGain.connect(this.musicGainNode || this.ctx.destination);
                lOsc.start(now);
                lOsc.stop(now + 0.35);
            }
            this.musicStep++;
        }, 260);
    }

    stopBgm() {
        this.musicPlaying = false;
        if (this.bgAudio) {
            this.bgAudio.pause();
            this.bgAudio.currentTime = 0; // Сбрасываем трек на начало
        }
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    }
}

window.sfx = new SoundEngine();
