const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  experience: $("#experience"),
  canvas: $("#effectsCanvas"),
  landing: $("#landingScene"),
  stage: $("#stageScene"),
  finale: $("#finaleScene"),
  beginSound: $("#beginSoundButton"),
  beginSilent: $("#beginSilentButton"),
  soundToggle: $("#soundToggle"),
  soundLabel: $("#soundLabel"),
  objectCount: $("#objectCount"),
  stageTitle: $("#stageTitle"),
  reaction: $("#reactionLine"),
  blackout: $("#blackoutCopy"),
  blackoutLine: $("#blackoutLine"),
  performanceTime: $("#performanceTime"),
  save: $("#saveButton"),
  encore: $("#encoreButton"),
  pause: $("#pauseOverlay"),
  resume: $("#resumeButton"),
  toast: $("#toast"),
  announcer: $("#announcer"),
};

const objectButtons = $$(".table-object");
const objectButtonById = new Map(objectButtons.map((button) => [button.dataset.object, button]));
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const OBJECTS = {
  glass: {
    reaction: "The glass found its note.",
    color: "#80cfff",
    harmony: 659.25,
  },
  key: {
    reaction: "A key change. Inevitably.",
    color: "#ffc968",
    harmony: 493.88,
  },
  spoon: {
    reaction: "The spoon chose percussion.",
    color: "#f0eef8",
    harmony: 392,
  },
  band: {
    reaction: "Unexpectedly qualified for bass.",
    color: "#ff7e6c",
    harmony: 146.83,
  },
  receipt: {
    reaction: "The receipt is keeping records.",
    color: "#ffe6a6",
    harmony: 587.33,
  },
  matchbox: {
    reaction: "Small box. Unreasonable confidence.",
    color: "#ef9b63",
    harmony: 196,
  },
  plant: {
    reaction: "The plant brought backing vocals.",
    color: "#75dbbd",
    harmony: 440,
  },
};

const state = {
  phase: "landing",
  soundOn: false,
  order: [],
  tapTimes: [],
  pans: [],
  offsets: [],
  token: 0,
  visualFrame: 0,
  visualStartMs: 0,
  audioStart: 0,
  concertHasAudio: false,
  interrupted: false,
  pauseOrigin: "",
  performanceCode: "",
  finaleTime: "",
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.tapBus = null;
    this.noiseBuffer = null;
    this.concertBus = null;
    this.immediateSources = new Set();
    this.concertSources = new Set();
    this.muted = false;
  }

  create() {
    if (this.context) return this.context;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio is not supported in this browser.");

    const context = new AudioContextClass({ latencyHint: "interactive" });
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;

    this.master = context.createGain();
    this.master.gain.value = 0.52;
    this.master.connect(compressor);
    compressor.connect(context.destination);

    this.musicBus = context.createGain();
    const dry = context.createGain();
    const send = context.createGain();
    const delay = context.createDelay(1);
    const feedback = context.createGain();
    const delayFilter = context.createBiquadFilter();
    const wet = context.createGain();

    dry.gain.value = 0.88;
    send.gain.value = 0.14;
    delay.delayTime.value = 0.17;
    feedback.gain.value = 0.2;
    delayFilter.type = "lowpass";
    delayFilter.frequency.value = 3400;
    wet.gain.value = 0.18;

    this.musicBus.connect(dry);
    dry.connect(this.master);
    this.musicBus.connect(send);
    send.connect(delay);
    delay.connect(delayFilter);
    delayFilter.connect(wet);
    wet.connect(this.master);
    delayFilter.connect(feedback);
    feedback.connect(delay);

    this.tapBus = context.createGain();
    this.tapBus.connect(this.musicBus);
    this.context = context;
    this.noiseBuffer = this.makeNoiseBuffer();
    return context;
  }

  unlock(withChime = false) {
    let context;
    try {
      context = this.create();
      if (withChime) this.playUnlockChime(context.currentTime + 0.01);
    } catch (error) {
      return Promise.reject(error);
    }

    const result = context.state === "running" ? Promise.resolve() : context.resume();
    return result.then(() => {
      this.setMuted(this.muted);
      return context;
    });
  }

  makeNoiseBuffer() {
    const length = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    let seed = 0x7f4a7c15;
    for (let index = 0; index < length; index += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      channel[index] = (seed / 0xffffffff) * 2 - 1;
    }
    return buffer;
  }

  route(input, bus, pan = 0) {
    if (typeof this.context.createStereoPanner === "function") {
      const panner = this.context.createStereoPanner();
      panner.pan.value = clamp(pan, -0.55, 0.55);
      input.connect(panner);
      panner.connect(bus);
      return panner;
    }
    input.connect(bus);
    return input;
  }

  track(source, sourceSet, disposableNodes = []) {
    sourceSet.add(source);
    source.addEventListener("ended", () => {
      sourceSet.delete(source);
      [source, ...disposableNodes].forEach((node) => {
        try { node.disconnect(); } catch (_) { /* already disconnected */ }
      });
    }, { once: true });
  }

  tone({
    time, frequency, endFrequency, type = "sine", peak = 0.05,
    attack = 0.003, duration = 0.3, detune = 0, pan = 0,
    filters = [], bus = this.tapBus, sourceSet = this.immediateSources,
  }) {
    const context = this.context;
    const start = Math.max(time, context.currentTime + 0.002);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.detune.setValueAtTime(detune, start);
    if (endFrequency && endFrequency > 0) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + Math.min(duration, 0.13));
    }

    let output = oscillator;
    const disposableNodes = [];
    filters.forEach((settings) => {
      const filter = context.createBiquadFilter();
      filter.type = settings.type;
      filter.frequency.setValueAtTime(settings.frequency, start);
      if (settings.endFrequency) {
        filter.frequency.exponentialRampToValueAtTime(settings.endFrequency, start + duration);
      }
      filter.Q.value = settings.Q ?? 0.7;
      output.connect(filter);
      output = filter;
      disposableNodes.push(filter);
    });

    output.connect(gain);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, peak), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    const routed = this.route(gain, bus, pan);
    disposableNodes.push(gain);
    if (routed !== gain) disposableNodes.push(routed);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.06);
    this.track(oscillator, sourceSet, disposableNodes);
    return oscillator;
  }

  noise({
    time, duration = 0.1, peak = 0.04, attack = 0.002, pan = 0,
    offset = 0, filters = [], bus = this.tapBus,
    sourceSet = this.immediateSources,
  }) {
    const context = this.context;
    const start = Math.max(time, context.currentTime + 0.002);
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = this.noiseBuffer;
    source.loop = duration > 0.85;

    let output = source;
    const disposableNodes = [];
    filters.forEach((settings) => {
      const filter = context.createBiquadFilter();
      filter.type = settings.type;
      filter.frequency.setValueAtTime(settings.frequency, start);
      if (settings.endFrequency) {
        filter.frequency.exponentialRampToValueAtTime(settings.endFrequency, start + duration);
      }
      filter.Q.value = settings.Q ?? 0.7;
      output.connect(filter);
      output = filter;
      disposableNodes.push(filter);
    });

    output.connect(gain);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, peak), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    const routed = this.route(gain, bus, pan);
    disposableNodes.push(gain);
    if (routed !== gain) disposableNodes.push(routed);
    const safeOffset = Math.min(
      Math.abs(offset) % this.noiseBuffer.duration,
      Math.max(0, this.noiseBuffer.duration - duration - 0.01),
    );
    source.start(start, safeOffset);
    source.stop(start + duration + 0.02);
    this.track(source, sourceSet, disposableNodes);
    return source;
  }

  playUnlockChime(time) {
    this.tone({ time, frequency: 659.25, peak: 0.022, attack: 0.01, duration: 0.42, pan: -0.1 });
    this.tone({ time: time + 0.08, frequency: 987.77, peak: 0.015, attack: 0.01, duration: 0.5, pan: 0.1 });
  }

  playObject(id, time, velocity = 1, pan = 0, bus = this.tapBus, sourceSet = this.immediateSources) {
    const scale = clamp(velocity, 0.1, 1.2);
    const common = { time, pan, bus, sourceSet };

    if (id === "glass") {
      [
        [1318.51, 0.15, 1.3],
        [3059, 0.052, 0.72],
        [5604, 0.022, 0.38],
      ].forEach(([frequency, peak, duration], index) => this.tone({
        ...common,
        frequency,
        peak: peak * scale,
        duration,
        attack: 0.002,
        detune: index - 1,
        filters: [{ type: "highpass", frequency: 700, Q: 0.5 }],
      }));
      return;
    }

    if (id === "key") {
      [
        [2093, 0.09, 0.2],
        [3260, 0.045, 0.13],
        [5140, 0.018, 0.075],
      ].forEach(([frequency, peak, duration]) => this.tone({
        ...common,
        frequency,
        peak: peak * scale,
        duration,
        attack: 0.001,
        filters: [{ type: "highpass", frequency: 1450, Q: 0.7 }],
      }));
      this.noise({
        ...common,
        duration: 0.018,
        peak: 0.025 * scale,
        offset: 0.11,
        filters: [{ type: "bandpass", frequency: 4400, Q: 1.4 }],
      });
      return;
    }

    if (id === "spoon") {
      [
        [783.99, 0.115, 0.72],
        [1168, 0.061, 0.43],
        [2070, 0.026, 0.25],
      ].forEach(([frequency, peak, duration]) => this.tone({
        ...common, frequency, peak: peak * scale, duration, attack: 0.0015,
      }));
      this.noise({
        ...common,
        duration: 0.024,
        peak: 0.018 * scale,
        offset: 0.23,
        filters: [{ type: "bandpass", frequency: 2600, Q: 0.8 }],
      });
      return;
    }

    if (id === "band") {
      this.tone({
        ...common,
        type: "triangle",
        frequency: 196,
        endFrequency: 146.83,
        peak: 0.105 * scale,
        duration: 0.38,
        attack: 0.003,
        filters: [{ type: "lowpass", frequency: 1250, Q: 1.1 }],
      });
      this.tone({
        ...common,
        frequency: 293.66,
        peak: 0.026 * scale,
        duration: 0.25,
        attack: 0.003,
        filters: [{ type: "lowpass", frequency: 1250, Q: 1.1 }],
      });
      return;
    }

    if (id === "receipt") {
      [
        [0, 0.075, 0.06, 0.37],
        [0.048, 0.115, 0.043, 0.43],
      ].forEach(([delay, duration, peak, offset]) => this.noise({
        ...common,
        time: time + delay,
        duration,
        peak: peak * scale,
        offset,
        filters: [
          { type: "highpass", frequency: 850, Q: 0.4 },
          { type: "bandpass", frequency: 3100, Q: 0.65 },
        ],
      }));
      this.tone({ ...common, frequency: 880, peak: 0.018 * scale, duration: 0.038, attack: 0.001 });
      return;
    }

    if (id === "matchbox") {
      this.tone({
        ...common,
        frequency: 190,
        endFrequency: 132,
        peak: 0.075 * scale,
        duration: 0.14,
        attack: 0.002,
      });
      [0, 0.018, 0.043, 0.072].forEach((delay, index) => this.noise({
        ...common,
        time: time + delay,
        duration: 0.024 + index * 0.001,
        peak: 0.011 * scale,
        offset: 0.54 + index * 0.07,
        filters: [{ type: "bandpass", frequency: 1550, Q: 0.75 }],
      }));
      return;
    }

    if (id === "plant") {
      this.noise({
        ...common,
        duration: 0.31,
        peak: 0.046 * scale,
        attack: 0.028,
        offset: 0.76,
        filters: [
          { type: "highpass", frequency: 350, Q: 0.4 },
          { type: "bandpass", frequency: 1250, Q: 0.55 },
          { type: "lowpass", frequency: 4300, Q: 0.5 },
        ],
      });
      this.tone({
        ...common,
        type: "triangle",
        frequency: 440,
        endFrequency: 392,
        peak: 0.04 * scale,
        duration: 0.19,
        attack: 0.004,
      });
    }
  }

  newConcertBus() {
    this.cancelConcert();
    const bus = this.context.createGain();
    bus.gain.value = 1;
    bus.connect(this.musicBus);
    this.concertBus = bus;
    this.concertSources = new Set();
    return bus;
  }

  harmonicShadow(frequency, time, peak, pan, bus) {
    this.tone({
      time,
      frequency,
      peak,
      attack: 0.024,
      duration: 0.58,
      pan,
      filters: [{ type: "lowpass", frequency: 2400, Q: 0.5 }],
      bus,
      sourceSet: this.concertSources,
    });
    this.tone({
      time,
      frequency: frequency * 2,
      type: "triangle",
      peak: peak * 0.15,
      attack: 0.024,
      duration: 0.5,
      pan,
      filters: [{ type: "lowpass", frequency: 2400, Q: 0.5 }],
      bus,
      sourceSet: this.concertSources,
    });
  }

  pad(time, duration, bus, gainScale = 1) {
    [[164.81, 0.012], [246.94, 0.009]].forEach(([frequency, peak]) => {
      this.tone({
        time,
        frequency,
        peak: peak * gainScale,
        attack: 0.28,
        duration,
        filters: [{ type: "lowpass", frequency: 900, Q: 0.4 }],
        bus,
        sourceSet: this.concertSources,
      });
    });
  }

  bassThump(time, bus) {
    this.tone({
      time,
      frequency: 92,
      endFrequency: 48,
      peak: 0.06,
      attack: 0.002,
      duration: 0.18,
      bus,
      sourceSet: this.concertSources,
    });
  }

  finaleChord(time, bus) {
    const chord = [329.63, 392, 493.88, 587.33];
    const detunes = [-3, 2, -2, 3];
    chord.forEach((frequency, index) => {
      const pan = -0.36 + index * 0.24;
      this.tone({
        time,
        frequency,
        peak: 0.02,
        attack: 0.055,
        duration: 1.45,
        detune: detunes[index],
        pan,
        bus,
        sourceSet: this.concertSources,
      });
      this.tone({
        time,
        frequency: frequency * 2,
        type: "triangle",
        peak: 0.004,
        attack: 0.055,
        duration: 1.2,
        detune: detunes[index],
        pan,
        bus,
        sourceSet: this.concertSources,
      });
    });
    this.playObject("glass", time + 0.015, 0.55, 0, bus, this.concertSources);
  }

  applause(time, bus) {
    for (let index = 0; index < 18; index += 1) {
      const stagger = index * 0.037 + (index % 3) * 0.011;
      this.noise({
        time: time + stagger,
        duration: 0.055 + (index % 4) * 0.012,
        peak: 0.016 + (index % 3) * 0.004,
        attack: 0.002,
        pan: ((index % 7) - 3) / 6,
        offset: (index * 0.071) % 0.8,
        filters: [
          { type: "highpass", frequency: 700, Q: 0.4 },
          { type: "lowpass", frequency: 5200, Q: 0.3 },
        ],
        bus,
        sourceSet: this.concertSources,
      });
    }
  }

  scheduleConcert(order, offsets, pans) {
    const context = this.context;
    const bus = this.newConcertBus();
    const start = context.currentTime + 0.12;
    const passStarts = [0.2, 3.9, 7.6];
    const velocities = [0.52, 0.66, 0.8];

    passStarts.forEach((passStart, passIndex) => {
      order.forEach((id, index) => {
        const noteTime = start + passStart + offsets[index];
        this.playObject(id, noteTime, velocities[passIndex], pans[index], bus, this.concertSources);
        if (passIndex > 0) {
          this.harmonicShadow(
            OBJECTS[id].harmony,
            noteTime + 0.075,
            passIndex === 1 ? 0.026 : 0.034,
            pans[index],
            bus,
          );
        }
      });
    });

    this.pad(start + 3.9, 3.55, bus, 1);
    this.pad(start + 7.6, 3.72, bus, 1.25);

    const intervals = offsets.slice(1).map((value, index) => value - offsets[index]).sort((a, b) => a - b);
    const middle = Math.floor(intervals.length / 2);
    const median = intervals.length % 2
      ? intervals[middle]
      : (intervals[middle - 1] + intervals[middle]) / 2;
    const tickStep = clamp(median / 2, 0.17, 0.38);
    for (let tick = 0, index = 0; tick <= 3.45; tick += tickStep, index += 1) {
      this.noise({
        time: start + 7.6 + tick,
        duration: 0.024,
        peak: index % 2 ? 0.03 : 0.018,
        pan: index % 2 ? 0.24 : -0.24,
        offset: (0.12 + index * 0.061) % 0.8,
        filters: [
          { type: "highpass", frequency: 1800, Q: 0.4 },
          { type: "bandpass", frequency: 3600, Q: 0.7 },
        ],
        bus,
        sourceSet: this.concertSources,
      });
    }

    this.bassThump(start + 7.6, bus);
    this.bassThump(start + 7.6 + 1.725, bus);
    this.noise({
      time: start + 9.325,
      duration: 0.42,
      peak: 0.026,
      attack: 0.035,
      filters: [{ type: "bandpass", frequency: 1800, endFrequency: 4200, Q: 0.55 }],
      bus,
      sourceSet: this.concertSources,
    });

    this.finaleChord(start + 11.2, bus);
    this.applause(start + 12.15, bus);
    return { start, duration: 13.18, passStarts };
  }

  transitionHit() {
    if (!this.context) return;
    const time = this.context.currentTime + 0.01;
    this.tone({
      time,
      frequency: 92,
      endFrequency: 55,
      peak: 0.035,
      attack: 0.012,
      duration: 0.68,
      filters: [{ type: "lowpass", frequency: 480, Q: 0.5 }],
    });
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    gain.exponentialRampToValueAtTime(muted ? 0.0001 : 0.52, now + 0.035);
  }

  cancelConcert() {
    if (!this.context || !this.concertBus) return;
    const now = this.context.currentTime;
    const bus = this.concertBus;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
    bus.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    this.concertSources.forEach((source) => {
      try { source.stop(now + 0.04); } catch (_) { /* already stopped */ }
    });
    window.setTimeout(() => {
      try { bus.disconnect(); } catch (_) { /* already disconnected */ }
    }, 90);
    this.concertBus = null;
    this.concertSources = new Set();
  }
}

const audio = new AudioEngine();

function announce(message) {
  elements.announcer.textContent = "";
  window.setTimeout(() => { elements.announcer.textContent = message; }, 30);
}

let toastTimer = 0;
function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  requestAnimationFrame(() => elements.toast.classList.add("is-visible"));
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
    window.setTimeout(() => { elements.toast.hidden = true; }, 250);
  }, 2600);
}

function focusHeading(heading) {
  window.setTimeout(() => heading.focus({ preventScroll: true }), reducedMotion.matches ? 20 : 280);
}

function showScene(scene, phase) {
  [elements.landing, elements.stage, elements.finale].forEach((candidate) => {
    candidate.hidden = candidate !== scene;
    candidate.classList.toggle("is-active", candidate === scene);
  });
  elements.experience.dataset.phase = phase;
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
}

function updateSoundButton() {
  elements.soundToggle.hidden = false;
  elements.soundToggle.setAttribute("aria-pressed", String(state.soundOn));
  elements.soundLabel.textContent = state.soundOn ? "Sound on" : "Sound off";
  elements.soundToggle.querySelector("span").textContent = state.soundOn ? "♪" : "×";
}

function handleAudioFailure() {
  state.soundOn = false;
  audio.setMuted(true);
  updateSoundButton();
  showToast("Sound stayed off, but the table still works.");
}

function beginExperience(withSound) {
  if (state.phase !== "landing") return;
  document.title = "The Accidental Orchestra";
  state.soundOn = withSound;
  if (withSound) {
    audio.muted = false;
    audio.unlock(true).catch(handleAudioFailure);
  }
  updateSoundButton();
  state.phase = "collecting";
  elements.stage.dataset.act = "collecting";
  showScene(elements.stage, "collecting");
  focusHeading(elements.stageTitle);
  announce("The table is awake. Touch each of the seven objects once.");
}

function panForElement(element) {
  const rect = element.getBoundingClientRect();
  const center = rect.left + rect.width / 2;
  return clamp((center / window.innerWidth - 0.5) * 1.1, -0.55, 0.55);
}

function normalizedOffsets() {
  if (state.tapTimes.length < 3) return state.tapTimes.map((_, index) => index * 0.42);
  const intervals = state.tapTimes.slice(1).map((time, index) => clamp(time - state.tapTimes[index], 90, 1400));
  const sum = intervals.reduce((total, interval) => total + interval, 0);
  const scale = 3.45 / sum;
  const offsets = [0];
  intervals.forEach((interval) => offsets.push(offsets[offsets.length - 1] + interval * scale));
  return offsets;
}

function hashPerformance() {
  let hash = 2166136261;
  const signature = `${state.order.join("-")}:${state.tapTimes.map((time, index) => index ? Math.round(time - state.tapTimes[index - 1]) : 0).join("-")}`;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}

function activateObject(button) {
  if (state.phase !== "collecting" || button.disabled) return;
  const id = button.dataset.object;
  const meta = OBJECTS[id];
  const tapTime = performance.now();
  const pan = panForElement(button);

  button.disabled = true;
  button.classList.add("is-awake", "is-reacting");
  state.order.push(id);
  state.tapTimes.push(tapTime);
  state.pans.push(pan);

  window.setTimeout(() => button.classList.remove("is-reacting"), reducedMotion.matches ? 80 : 720);
  elements.objectCount.textContent = String(state.order.length);
  elements.reaction.textContent = meta.reaction;
  announce(`${meta.reaction} ${state.order.length} of 7.`);
  if (!reducedMotion.matches) burstFromElement(button, meta.color, 16);

  if (state.soundOn) {
    audio.unlock(false).then(() => {
      if (state.soundOn && audio.context?.state === "running") {
        audio.playObject(id, audio.context.currentTime + 0.005, 1, pan);
      }
    }).catch(handleAudioFailure);
  }
  if (navigator.vibrate && !reducedMotion.matches) navigator.vibrate(8);

  if (state.order.length === 7) {
    state.phase = "ready";
    state.offsets = normalizedOffsets();
    state.performanceCode = hashPerformance();
    elements.stageTitle.textContent = "All seven are awake.";
    elements.reaction.textContent = meta.reaction;
    window.setTimeout(beginReveal, reducedMotion.matches ? 360 : 920);
  }
}

function beginReveal() {
  if (state.phase !== "ready") return;
  const token = ++state.token;
  state.phase = "reveal";
  elements.stage.dataset.act = "blackout";
  elements.blackoutLine.textContent = "Now keep your hands off the table.";
  elements.blackout.setAttribute("aria-hidden", "false");
  elements.blackout.classList.add("is-visible");
  announce("Now keep your hands off the table.");
  if (state.soundOn) audio.transitionHit();

  window.setTimeout(() => {
    if (token !== state.token || state.phase !== "reveal") return;
    elements.blackoutLine.textContent = "They were listening.";
    announce("They were listening.");
  }, reducedMotion.matches ? 520 : 1120);

  window.setTimeout(() => {
    if (token !== state.token || state.phase !== "reveal") return;
    elements.blackout.classList.remove("is-visible");
    elements.blackout.setAttribute("aria-hidden", "true");
    startConcert();
  }, reducedMotion.matches ? 1050 : 2250);
}

function visualEvents() {
  const passes = [0.2, 3.9, 7.6];
  return passes.flatMap((passStart, passIndex) => state.order.map((id, index) => ({
    id,
    passIndex,
    index,
    time: passStart + state.offsets[index],
    key: `${passIndex}-${index}`,
  }))).sort((a, b) => a.time - b.time);
}

function startConcert() {
  state.token += 1;
  const token = state.token;
  state.phase = "concert";
  state.interrupted = false;
  elements.pause.hidden = true;
  elements.stage.dataset.act = "concert";
  elements.stage.dataset.pass = "0";
  elements.stage.classList.remove("is-finale-hit", "performance-underway");
  elements.blackout.classList.remove("is-visible");
  showScene(elements.stage, "concert");
  announce("Live from this table: The Accidental Orchestra, performing Seven Small Decisions.");

  state.visualStartMs = performance.now() + 120;
  state.audioStart = 0;
  state.concertHasAudio = false;
  if (state.soundOn && audio.context?.state === "running") {
    try {
      audio.setMuted(false);
      const concert = audio.scheduleConcert(state.order, state.offsets, state.pans);
      state.audioStart = concert.start;
      state.concertHasAudio = true;
    } catch (_) {
      handleAudioFailure();
    }
  } else {
    audio.cancelConcert();
    if (state.soundOn) handleAudioFailure();
  }

  window.cancelAnimationFrame(state.visualFrame);
  const events = visualEvents();
  let activeKey = "";
  let activePass = 0;
  let finaleHit = false;
  let titleDimmed = false;

  const frame = () => {
    if (token !== state.token || state.phase !== "concert") return;
    const elapsed = state.concertHasAudio && audio.context
      ? audio.context.currentTime - state.audioStart
      : (performance.now() - state.visualStartMs) / 1000;

    const nextPass = elapsed < 3.9 ? 1 : elapsed < 7.6 ? 2 : 3;
    if (nextPass !== activePass) {
      activePass = nextPass;
      elements.stage.dataset.pass = String(activePass);
      objectButtons.forEach((button) => {
        button.classList.toggle("is-ensemble", activePass === 3);
        button.classList.remove("is-backing");
      });
      if (activePass === 2) announce("The rhythm found a harmony.");
      if (activePass === 3) announce("The full accidental orchestra joins in.");
    }

    if (!titleDimmed && elapsed >= 1.45) {
      titleDimmed = true;
      elements.stage.classList.add("performance-underway");
    }

    let activeEvent = null;
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const candidate = events[index];
      if (elapsed >= candidate.time && elapsed <= candidate.time + 0.56) {
        activeEvent = candidate;
        break;
      }
    }

    if (activeEvent && activeEvent.key !== activeKey) {
      objectButtons.forEach((button) => button.classList.remove("is-performing", "is-backing"));
      const button = objectButtonById.get(activeEvent.id);
      void button.offsetWidth;
      button.classList.add("is-performing");
      if (activeEvent.passIndex === 1) {
        const backingId = state.order[(activeEvent.index + state.order.length - 1) % state.order.length];
        const backingButton = objectButtonById.get(backingId);
        if (backingButton !== button) backingButton.classList.add("is-backing");
      }
      activeKey = activeEvent.key;
      if (!reducedMotion.matches) burstFromElement(button, OBJECTS[activeEvent.id].color, 9);
    } else if (!activeEvent && activeKey) {
      objectButtons.forEach((button) => button.classList.remove("is-performing", "is-backing"));
      activeKey = "";
    }

    if (!finaleHit && elapsed >= 11.2) {
      finaleHit = true;
      elements.stage.classList.add("is-finale-hit");
      if (!reducedMotion.matches) spawnConfetti(72);
      announce("The audience approves.");
    }

    if (elapsed >= 13.18) {
      state.phase = "concert-ending";
      objectButtons.forEach((button) => button.classList.remove("is-performing", "is-backing", "is-ensemble"));
      window.setTimeout(() => {
        if (token === state.token && state.phase === "concert-ending") showFinale();
      }, reducedMotion.matches ? 120 : 480);
      return;
    }
    state.visualFrame = requestAnimationFrame(frame);
  };
  state.visualFrame = requestAnimationFrame(frame);
}

function showFinale() {
  state.phase = "finale";
  const performedAt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
  state.finaleTime = performedAt;
  elements.performanceTime.textContent = `Performed once at ${performedAt}`;
  elements.finale.classList.remove("is-revealing");
  showScene(elements.finale, "finale");
  requestAnimationFrame(() => elements.finale.classList.add("is-revealing"));
  window.setTimeout(() => $("#finaleTitle").focus({ preventScroll: true }), reducedMotion.matches ? 40 : 1850);
  if (!reducedMotion.matches) spawnConfetti(46);
  announce("Before you arrived: seven ordinary objects. After you arrived: one sold-out concert. Apparently, ordinary things become more interesting when you show up.");
}

function toggleSound() {
  if (state.soundOn) {
    state.soundOn = false;
    audio.setMuted(true);
    updateSoundButton();
    showToast("Sound off.");
    return;
  }

  state.soundOn = true;
  audio.muted = false;
  const restartSilentConcert = state.phase === "concert" && !state.concertHasAudio;
  audio.unlock(!restartSilentConcert).then(() => {
    audio.setMuted(false);
    if (restartSilentConcert && state.phase === "concert") {
      showToast("Sound on. Starting the concert again.");
      startConcert();
    }
  }).catch(handleAudioFailure);
  updateSoundButton();
}

function replayConcert() {
  if (!state.order.length) return;
  showScene(elements.stage, "concert");
  if (state.soundOn) {
    audio.muted = false;
    audio.unlock(false).then(startConcert).catch(() => {
      handleAudioFailure();
      startConcert();
    });
  } else {
    startConcert();
  }
}

function handleVisibilityChange() {
  const pausable = ["ready", "reveal", "concert"].includes(state.phase);
  if (document.hidden && pausable) {
    state.pauseOrigin = state.phase === "concert" ? "concert" : "reveal";
    state.token += 1;
    state.phase = "paused";
    state.interrupted = true;
    window.cancelAnimationFrame(state.visualFrame);
    audio.cancelConcert();
    objectButtons.forEach((button) => button.classList.remove("is-performing", "is-backing", "is-ensemble"));
    return;
  }

  if (!document.hidden && state.interrupted) {
    elements.pause.hidden = false;
    window.setTimeout(() => elements.resume.focus({ preventScroll: true }), 20);
  }
}

function resumeConcert() {
  const origin = state.pauseOrigin;
  elements.pause.hidden = true;
  state.interrupted = false;
  elements.stage.setAttribute("tabindex", "-1");
  elements.stage.focus({ preventScroll: true });
  const continueFlow = () => {
    if (origin === "reveal") {
      state.phase = "ready";
      beginReveal();
    } else {
      startConcert();
    }
  };
  if (state.soundOn) {
    audio.muted = false;
    audio.unlock(false).then(continueFlow).catch(() => {
      handleAudioFailure();
      continueFlow();
    });
  } else {
    continueFlow();
  }
}

const fx = {
  context: elements.canvas.getContext("2d"),
  particles: [],
  frame: 0,
  lastTime: performance.now(),
  width: window.innerWidth,
  height: window.innerHeight,
};

function resizeEffects() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  fx.width = window.innerWidth;
  fx.height = window.innerHeight;
  elements.canvas.width = Math.round(fx.width * ratio);
  elements.canvas.height = Math.round(fx.height * ratio);
  elements.canvas.style.width = `${fx.width}px`;
  elements.canvas.style.height = `${fx.height}px`;
  fx.context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function spawnBurst(x, y, color, count = 14) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.35;
    const speed = 44 + Math.random() * 94;
    fx.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 12,
      color,
      life: 0.55 + Math.random() * 0.5,
      age: 0,
      size: 1.5 + Math.random() * 3.8,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 6,
      confetti: false,
    });
  }
  ensureEffectsLoop();
}

function burstFromElement(element, color, count) {
  const rect = element.getBoundingClientRect();
  spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, color, count);
}

function spawnConfetti(count) {
  const colors = ["#ffc968", "#75dbbd", "#80a8ff", "#ff7e6c", "#f7f1df"];
  for (let index = 0; index < count; index += 1) {
    fx.particles.push({
      x: fx.width * (0.12 + Math.random() * 0.76),
      y: -10 - Math.random() * fx.height * 0.18,
      vx: (Math.random() - 0.5) * 62,
      vy: 78 + Math.random() * 115,
      color: colors[index % colors.length],
      life: 2.1 + Math.random() * 1.8,
      age: 0,
      size: 3 + Math.random() * 5,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 8,
      confetti: true,
    });
  }
  ensureEffectsLoop();
}

function ensureEffectsLoop() {
  if (!fx.frame) {
    fx.lastTime = performance.now();
    fx.frame = requestAnimationFrame(renderEffects);
  }
}

function renderEffects(now) {
  const delta = Math.min((now - fx.lastTime) / 1000, 0.033);
  fx.lastTime = now;
  fx.context.clearRect(0, 0, fx.width, fx.height);
  fx.particles = fx.particles.filter((particle) => {
    particle.age += delta;
    if (particle.age >= particle.life) return false;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    if (particle.confetti) {
      particle.vy += 23 * delta;
      particle.vx += Math.sin(particle.age * 5 + particle.rotation) * 7 * delta;
    } else {
      particle.vx *= 0.982;
      particle.vy *= 0.982;
    }
    particle.rotation += particle.spin * delta;
    const alpha = Math.max(0, 1 - particle.age / particle.life);
    fx.context.save();
    fx.context.globalAlpha = alpha;
    fx.context.translate(particle.x, particle.y);
    fx.context.rotate(particle.rotation);
    fx.context.fillStyle = particle.color;
    if (particle.confetti) {
      fx.context.fillRect(-particle.size, -particle.size * 0.45, particle.size * 2, particle.size * 0.9);
    } else {
      fx.context.beginPath();
      fx.context.arc(0, 0, particle.size, 0, Math.PI * 2);
      fx.context.fill();
    }
    fx.context.restore();
    return true;
  });
  if (fx.particles.length) {
    fx.frame = requestAnimationFrame(renderEffects);
  } else {
    fx.context.clearRect(0, 0, fx.width, fx.height);
    fx.frame = 0;
  }
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawReceiptPoster() {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  const background = context.createLinearGradient(0, 0, 0, canvas.height);
  background.addColorStop(0, "#111830");
  background.addColorStop(0.6, "#090e20");
  background.addColorStop(1, "#050815");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255, 211, 125, .09)";
  context.beginPath();
  context.moveTo(210, 80);
  context.lineTo(455, 625);
  context.lineTo(625, 625);
  context.lineTo(870, 80);
  context.closePath();
  context.fill();

  context.textAlign = "center";
  context.fillStyle = "#ffc968";
  context.font = "700 25px system-ui, sans-serif";
  context.fillText("LIVE FROM THIS TABLE", 540, 105);
  context.fillStyle = "#f7f1df";
  context.font = "900 67px system-ui, sans-serif";
  context.fillText("THE ACCIDENTAL", 540, 180);
  context.fillText("ORCHESTRA", 540, 252);
  context.fillStyle = "#aeb5ce";
  context.font = "500 25px system-ui, sans-serif";
  context.fillText("Performing “Seven Small Decisions”", 540, 300);

  const labels = ["GLASS", "KEY", "SPOON", "BAND", "RECEIPT", "MATCHBOX", "PLANT"];
  const colors = state.order.map((id) => OBJECTS[id].color);
  state.order.forEach((id, index) => {
    const x = 150 + index * 130;
    const y = 455 + (index % 2) * 32;
    context.fillStyle = colors[index];
    context.beginPath();
    context.arc(x, y, 35, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#080d1d";
    context.font = "900 24px system-ui, sans-serif";
    context.fillText(String(index + 1), x, y + 8);
    context.fillStyle = "#dfe3f2";
    context.font = "700 13px system-ui, sans-serif";
    context.fillText(labels[["glass", "key", "spoon", "band", "receipt", "matchbox", "plant"].indexOf(id)], x, y + 66);
  });

  context.fillStyle = "#f5ecd5";
  roundedRect(context, 145, 585, 790, 410, 22);
  context.fill();
  context.fillStyle = "#1d2130";
  context.font = "800 21px ui-monospace, monospace";
  context.fillText("FINAL RECEIPT", 540, 640);
  context.textAlign = "left";
  context.fillStyle = "#676a72";
  context.font = "700 18px system-ui, sans-serif";
  context.fillText("BEFORE YOU ARRIVED", 200, 714);
  context.fillStyle = "#171a24";
  context.font = "800 30px system-ui, sans-serif";
  context.fillText("7 ordinary objects", 200, 755);
  context.strokeStyle = "#cbc3af";
  context.lineWidth = 2;
  context.setLineDash([8, 8]);
  context.beginPath();
  context.moveTo(200, 800);
  context.lineTo(880, 800);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "#676a72";
  context.font = "700 18px system-ui, sans-serif";
  context.fillText("AFTER YOU ARRIVED", 200, 860);
  context.fillStyle = "#171a24";
  context.font = "900 38px system-ui, sans-serif";
  context.fillText("1 sold-out concert", 200, 908);
  context.fillStyle = "#676a72";
  context.font = "600 17px ui-monospace, monospace";
  context.fillText(`SHOW ${state.performanceCode}  •  ${state.finaleTime || "PERFORMED ONCE"}`, 200, 960);

  context.textAlign = "center";
  context.fillStyle = "#f7f1df";
  context.font = "850 42px system-ui, sans-serif";
  context.fillText("Apparently, ordinary things become", 540, 1090);
  context.fillText("more interesting when you show up.", 540, 1144);
  context.fillStyle = "#75dbbd";
  context.font = "700 20px system-ui, sans-serif";
  context.fillText("ONE PERFORMANCE. NO REHEARSALS.", 540, 1226);
  context.fillStyle = "#727b98";
  context.font = "600 16px system-ui, sans-serif";
  context.fillText("THE ACCIDENTAL ORCHESTRA", 540, 1280);
  return canvas;
}

function saveReceipt() {
  const canvas = drawReceiptPoster();
  canvas.toBlob(async (blob) => {
    if (!blob) {
      showToast("The receipt printer jammed. Try once more.");
      return;
    }
    const filename = `accidental-orchestra-${state.performanceCode || "receipt"}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "The Accidental Orchestra",
          text: "A receipt from one unrehearsed performance.",
        });
        showToast("Receipt ready. Accounting is delighted.");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast("Download requested. Accounting is delighted.");
  }, "image/png");
}

elements.beginSound.addEventListener("click", () => beginExperience(true));
elements.beginSilent.addEventListener("click", () => beginExperience(false));
elements.soundToggle.addEventListener("click", toggleSound);
elements.encore.addEventListener("click", replayConcert);
elements.resume.addEventListener("click", resumeConcert);
elements.save.addEventListener("click", saveReceipt);
objectButtons.forEach((button) => button.addEventListener("click", () => activateObject(button)));
document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("resize", resizeEffects, { passive: true });
window.addEventListener("pagehide", () => audio.cancelConcert());
reducedMotion.addEventListener("change", (event) => {
  if (!event.matches) return;
  fx.particles = [];
  window.cancelAnimationFrame(fx.frame);
  fx.frame = 0;
  fx.context.clearRect(0, 0, fx.width, fx.height);
});

$$('.audience span').forEach((person, index) => person.style.setProperty("--i", String(index % 6)));
$$('.stage-lights span').forEach((light, index) => light.style.setProperty("--i", String(index)));
objectButtons.forEach((button, index) => button.style.setProperty("--band-index", String(index)));
resizeEffects();
