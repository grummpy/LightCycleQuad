/** Live Web Audio chiptune. Nothing is loaded from disk. */

const STEP = 0.17;
const LEAD = [523.25, 0, 659.25, 587.33, 0, 440, 523.25, 392, 0, 440, 349.23, 392, 0, 523.25, 659.25, 587.33];
const BASS = [130.81, 0, 0, 0, 98, 0, 0, 0, 110, 0, 0, 0, 87.31, 0, 0, 0];
const LOOP_SEC = LEAD.length * STEP;

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let volume = 0.8;
  let themeTimer = null;
  let noise = null;

  function ensure() {
    if (ctx) return true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    const samples = Math.floor(ctx.sampleRate * 0.25);
    noise = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < samples; i += 1) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function applyGain() {
    if (!master) return;
    master.gain.value = muted ? 0 : volume;
  }

  function tone(freq, when, dur, type, gain) {
    if (!ctx || !freq) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(amp);
    amp.connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  function scheduleLoop(start) {
    for (let i = 0; i < LEAD.length; i += 1) {
      const when = start + i * STEP;
      if (LEAD[i]) tone(LEAD[i], when, STEP * 0.85, "square", 0.05);
      if (BASS[i]) tone(BASS[i], when, STEP * 0.9, "triangle", 0.07);
    }
  }

  function startTheme() {
    if (!ctx || themeTimer) return;
    const loop = () => {
      if (!ctx) return;
      scheduleLoop(ctx.currentTime + 0.04);
      themeTimer = setTimeout(loop, LOOP_SEC * 1000);
    };
    loop();
  }

  return {
    unlock() {
      if (!ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
      startTheme();
    },
    setVolume(value) {
      volume = value;
      applyGain();
    },
    setMuted(value) {
      muted = !!value;
      applyGain();
    },
    get muted() {
      return muted;
    },
    countdown(n) {
      if (!ensure()) return;
      const freq = 320 + (4 - n) * 70;
      tone(freq, ctx.currentTime, 0.12, "square", 0.08);
    },
    go() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      tone(523.25, t, 0.16, "square", 0.09);
      tone(659.25, t, 0.18, "square", 0.06);
    },
    pickup(type) {
      if (!ensure()) return;
      const t = ctx.currentTime;
      if (type === "boost") {
        tone(440, t, 0.08, "square", 0.07);
        tone(660, t + 0.07, 0.1, "square", 0.07);
        tone(880, t + 0.14, 0.14, "square", 0.07);
      } else if (type === "gap") {
        tone(980, t, 0.09, "sawtooth", 0.04);
        tone(720, t + 0.06, 0.1, "triangle", 0.05);
      } else {
        tone(620, t, 0.07, "square", 0.07);
        tone(930, t + 0.06, 0.12, "square", 0.06);
      }
    },
    ko() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const amp = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(180, t + 0.22);
      amp.gain.setValueAtTime(0.22, t);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      src.connect(filter);
      filter.connect(amp);
      amp.connect(master);
      src.start(t);
      src.stop(t + 0.25);
      tone(240, t, 0.18, "sawtooth", 0.08);
      tone(110, t + 0.04, 0.22, "square", 0.06);
    },
    roundWin() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        tone(freq, t + i * 0.09, 0.2, "square", 0.07);
      });
    },
    draw() {
      if (!ensure()) return;
      tone(140, ctx.currentTime, 0.22, "triangle", 0.08);
    },
    matchWin() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      [392, 523.25, 659.25, 784, 1046.5].forEach((freq, i) => {
        tone(freq, t + i * 0.1, 0.28, "square", 0.08);
      });
    },
  };
}
