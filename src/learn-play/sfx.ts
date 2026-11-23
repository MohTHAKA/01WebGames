/**
 * Sound effects, synthesized at runtime with the Web Audio API.
 * Everything here is original generated content: oscillators, noise and gain envelopes.
 * There are no recordings, samples or third-party audio.
 */

export type SfxName = 'start' | 'grab' | 'release' | 'zone' | 'bump' | 'fail' | 'success' | 'tick';

export interface Sfx {
    play(name: SfxName): void;
    /** 0 silences the drive hum; 1 is full speed. */
    setMotor(level: number): void;
    /** 0 silences the arm servo; 1 is full speed. */
    setServo(level: number): void;
    setMuted(muted: boolean): void;
    isMuted(): boolean;
    dispose(): void;
}

const MUTE_KEY = 'zero1.learnplay.muted';
const MASTER_GAIN = 0.25;

/** Plain equal-tempered pitch: semitones above A4 (440 Hz). */
export const noteHz = (semitonesFromA4: number): number => 440 * 2 ** (semitonesFromA4 / 12);

/** Drive hum pitch for a speed level in 0..1 (kept low so the roll sounds slow). */
export const motorHz = (level: number): number => 28 + Math.max(0, Math.min(1, level)) * 22;

const readMuted = (): boolean => {
    try {
        return localStorage.getItem(MUTE_KEY) === '1';
    } catch {
        return false;
    }
};

export const createSfx = (): Sfx => {
    let muted = readMuted();
    let ctx: AudioContext | null = null;
    let master: GainNode | null = null;
    let noiseBuf: AudioBuffer | null = null;
    let motor: { osc: OscillatorNode; gain: GainNode } | null = null;
    let servo: { osc: OscillatorNode; gain: GainNode } | null = null;
    let motorLevel = 0;
    let servoLevel = 0;

    /** The context is created on first use, which only happens after a user click. */
    const ensure = (): AudioContext | null => {
        if (!ctx) {
            const Ctor = window.AudioContext;
            if (!Ctor) return null;
            ctx = new Ctor();
            master = ctx.createGain();
            master.gain.value = muted ? 0 : MASTER_GAIN;
            master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') void ctx.resume();
        return ctx;
    };

    const noise = (c: AudioContext): AudioBuffer => {
        if (!noiseBuf) {
            noiseBuf = c.createBuffer(1, c.sampleRate / 2, c.sampleRate);
            const data = noiseBuf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
        return noiseBuf;
    };

    /** One tone: type, start/end frequency, start offset and duration (seconds), peak gain. */
    const tone = (
        c: AudioContext,
        type: OscillatorType,
        f0: number,
        f1: number,
        at: number,
        dur: number,
        peak: number
    ): void => {
        if (!master) return;
        const t = c.currentTime + at;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g).connect(master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    };

    /** A burst of filtered noise. */
    const burst = (c: AudioContext, at: number, dur: number, hz: number, peak: number): void => {
        if (!master) return;
        const t = c.currentTime + at;
        const src = c.createBufferSource();
        src.buffer = noise(c);
        const filter = c.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = hz;
        const g = c.createGain();
        g.gain.setValueAtTime(peak, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filter).connect(g).connect(master);
        src.start(t);
        src.stop(t + dur + 0.02);
    };

    const sounds: Record<SfxName, (c: AudioContext) => void> = {
        start: (c) => {
            tone(c, 'triangle', noteHz(-12), noteHz(-5), 0, 0.12, 0.5);
            tone(c, 'triangle', noteHz(-5), noteHz(0), 0.08, 0.14, 0.5);
        },
        grab: (c) => {
            burst(c, 0, 0.05, 2200, 0.5);
            tone(c, 'square', 220, 140, 0, 0.08, 0.25);
        },
        release: (c) => {
            burst(c, 0, 0.09, 600, 0.4);
            tone(c, 'sine', 150, 90, 0, 0.12, 0.45);
        },
        zone: (c) => {
            tone(c, 'sine', noteHz(3), noteHz(3), 0, 0.14, 0.45);
            tone(c, 'sine', noteHz(10), noteHz(10), 0.09, 0.2, 0.45);
        },
        bump: (c) => {
            burst(c, 0, 0.18, 300, 0.9);
            tone(c, 'sawtooth', 110, 45, 0, 0.25, 0.4);
        },
        fail: (c) => {
            tone(c, 'triangle', noteHz(-2), noteHz(-2), 0.05, 0.18, 0.5);
            tone(c, 'triangle', noteHz(-9), noteHz(-10), 0.25, 0.35, 0.5);
        },
        success: (c) => {
            // A major arpeggio in plain scale steps.
            [0, 4, 7, 12].forEach((n, i) => tone(c, 'triangle', noteHz(n), noteHz(n), i * 0.1, 0.28, 0.5));
            tone(c, 'sine', noteHz(16), noteHz(16), 0.4, 0.5, 0.4);
        },
        tick: (c) => {
            tone(c, 'square', 1200, 900, 0, 0.025, 0.12);
        }
    };

    /** A looping oscillator whose gain follows a level; created once, silenced when the level is 0. */
    const loop = (c: AudioContext, type: OscillatorType, hz: number): { osc: OscillatorNode; gain: GainNode } => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type;
        osc.frequency.value = hz;
        gain.gain.value = 0;
        if (master) osc.connect(gain).connect(master);
        osc.start();
        return { osc, gain };
    };

    const applyLoops = (): void => {
        const c = ctx;
        if (!c) return;
        const t = c.currentTime;
        if (motor) {
            motor.osc.frequency.setTargetAtTime(motorHz(motorLevel), t, 0.05);
            // Movement hum stays quiet (25% of the earlier peak) so it sits under the one-shot sounds.
            motor.gain.gain.setTargetAtTime(motorLevel > 0 ? 0.045 : 0, t, 0.08);
        }
        if (servo) {
            servo.osc.frequency.setTargetAtTime(600 + servoLevel * 400, t, 0.05);
            servo.gain.gain.setTargetAtTime(servoLevel > 0 ? 0.05 : 0, t, 0.05);
        }
    };

    return {
        play: (name) => {
            if (muted) return;
            const c = ensure();
            if (c) sounds[name](c);
        },
        setMotor: (level) => {
            motorLevel = level;
            if (muted || (level <= 0 && !motor)) return;
            const c = ensure();
            if (!c) return;
            motor ??= loop(c, 'sawtooth', motorHz(0));
            applyLoops();
        },
        setServo: (level) => {
            servoLevel = level;
            if (muted || (level <= 0 && !servo)) return;
            const c = ensure();
            if (!c) return;
            servo ??= loop(c, 'sine', 600);
            applyLoops();
        },
        setMuted: (value) => {
            muted = value;
            try {
                localStorage.setItem(MUTE_KEY, value ? '1' : '0');
            } catch {
                // storage unavailable: the choice lasts for this session
            }
            if (master && ctx) master.gain.setTargetAtTime(value ? 0 : MASTER_GAIN, ctx.currentTime, 0.02);
        },
        isMuted: () => muted,
        dispose: () => {
            motor?.osc.stop();
            servo?.osc.stop();
            motor = null;
            servo = null;
            void ctx?.close();
            ctx = null;
            master = null;
        }
    };
};
