// Tiny WebAudio beeps. Rising pitch per wave (pentatonic).
let ctx: AudioContext | null = null;
let muted = false;
const PENTA = [0, 2, 4, 7, 9]; // semitone offsets

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch { /* audio unavailable */ }
}
export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

function tone(freq: number, dur = 0.16, type: OscillatorType = "triangle", gain = 0.14, delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

/** Pitch for wave k: climbs a pentatonic scale, an octave every 5 waves (capped). */
export function waveFreq(k: number): number {
  const step = Math.min(k, 14);
  const semis = PENTA[step % 5] + 12 * Math.floor(step / 5);
  return 330 * Math.pow(2, semis / 12);
}
export function beepWave(k: number) { tone(waveFreq(k)); }
export function beepPlace() { tone(196, 0.12, "sine", 0.18); }
export function beepBlocked() { tone(120, 0.14, "square", 0.06); }
export function beepUndo() { tone(262, 0.08, "sine", 0.1); }
export function beepWin() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, "triangle", 0.16, i * 0.11)); }
