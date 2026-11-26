// Synthesised sound, no audio files: the engine hum follows the throttle, and every
// event has its own little voice. The context is created on the first user gesture
// (browsers refuse sound before that) and everything is guarded so a game with
// sound off, or in a browser without WebAudio, still plays fine.

export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  /** The engine's note follows the throttle; call every frame while flying. */
  function engine(throttle, flying) {
    if (muted || !ensure() || context.state !== 'running') return;
    const target = flying ? 0.045 + throttle * 0.05 : 0;
    engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + throttle * 70, context.currentTime, 0.1);
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (muted || !ensure() || context.state !== 'running') return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  function noise(dur, vol) {
    if (muted || !ensure() || context.state !== 'running') return;
    const start = context.currentTime;
    const length = Math.floor(context.sampleRate * dur);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = vol;
    source.connect(gain);
    gain.connect(context.destination);
    source.start(start);
  }

  return {
    unlock() {
      ensure();
      if (context !== null && context.state === 'suspended') context.resume().catch(() => {});
    },
    engine,
    ring() {
      tone(880, 0.35, 'sine', 0.16);
      tone(1318, 0.45, 'sine', 0.12, 0.07);
    },
    pickup() {
      tone(523, 0.18, 'triangle', 0.18);
      tone(784, 0.28, 'triangle', 0.16, 0.08);
    },
    land() {
      tone(140, 0.25, 'sine', 0.22);
      noise(0.15, 0.08);
    },
    crash() {
      noise(0.5, 0.25);
      tone(90, 0.4, 'sawtooth', 0.15);
    },
    fanfare() {
      tone(523, 0.2, 'triangle', 0.16);
      tone(659, 0.2, 'triangle', 0.16, 0.12);
      tone(784, 0.35, 'triangle', 0.18, 0.24);
    },
    toggleMute() {
      muted = !muted;
      if (engineGain !== null) engineGain.gain.value = 0;
      return muted;
    },
    get isMuted() {
      return muted;
    },
  };
}
