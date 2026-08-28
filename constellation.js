const STAR_LIMIT = 7;
const LIVE_DPR_CAP = 2;

const creationMessages = [
  'Tap anywhere to place the first star.',
  'The sky noticed.',
  'Now it has a direction.',
  'A pattern is waking up.',
  'Okay, this has character.',
  'Two stars left.',
  'Last one. Anywhere.',
  'Hold on. It’s deciding what you made.'
];

const palettes = [
  { accent: '#8ba8ff', accent2: '#c99cff', accent3: '#ffd48a', glow: 'rgba(139, 168, 255, .34)' },
  { accent: '#73d8cf', accent2: '#91b6ff', accent3: '#ffd38f', glow: 'rgba(83, 210, 202, .3)' },
  { accent: '#f29bb2', accent2: '#a9a3ff', accent3: '#ffe09b', glow: 'rgba(242, 155, 178, .3)' },
  { accent: '#9ed66f', accent2: '#78c6e8', accent3: '#ffcf7b', glow: 'rgba(158, 214, 111, .28)' },
  { accent: '#ffad72', accent2: '#bc91ff', accent3: '#fff0a6', glow: 'rgba(255, 173, 114, .28)' }
];

const nameFirst = [
  'Quiet', 'Velvet', 'Pocket', 'Midnight', 'Curious', 'Soft', 'Golden',
  'Tiny', 'Electric', 'Polite', 'Secret', 'Dancing', 'Unlikely', 'Brave'
];

const nameSecond = [
  'Comet', 'Orbit', 'Plot Twist', 'Supernova', 'Maybe', 'Static', 'Lantern',
  'Side Quest', 'Meteor', 'Daydream', 'Detour', 'Spark', 'Echo', 'Adventure'
];

const scenes = [...document.querySelectorAll('.scene')];
const experience = document.querySelector('#experience');
const canvas = document.querySelector('#skyCanvas');
const context = canvas.getContext('2d', { alpha: true });
const beginButton = document.querySelector('#beginButton');
const soundToggle = document.querySelector('#soundToggle');
const soundLabel = document.querySelector('#soundLabel');
const touchSurface = document.querySelector('#touchSurface');
const creationTitle = document.querySelector('#creationTitle');
const starCount = document.querySelector('#starCount');
const progressMarks = [...document.querySelectorAll('#starProgress span')];
const nameForm = document.querySelector('#nameForm');
const nameInput = document.querySelector('#constellationName');
const surpriseNameButton = document.querySelector('#surpriseNameButton');
const fieldMessage = document.querySelector('#fieldMessage');
const revealTitle = document.querySelector('#revealTitle');
const skyCode = document.querySelector('#skyCode');
const discoveryDate = document.querySelector('#discoveryDate');
const saveButton = document.querySelector('#saveButton');
const copyButton = document.querySelector('#copyButton');
const announcer = document.querySelector('#announcer');
const toast = document.querySelector('#toast');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const viewport = { width: window.innerWidth, height: window.innerHeight, dpr: 1 };
let animationFrame;
let animateUntil = 0;
let resizeFrame;
let revealTimer;
let toastTimer;

const state = {
  phase: 'intro',
  baseSeed: randomSeed(),
  finalSeed: 0,
  code: '000000',
  createdAt: new Date(),
  stars: [],
  collectionEdges: [],
  finalEdges: [],
  backgroundStars: [],
  particles: [],
  rings: [],
  revealStartedAt: 0,
  revealDuration: 1750,
  description: 'A seven-star constellation waiting to be discovered.',
  name: '',
  suggestionIndex: 0,
  soundOn: false,
  audioContext: null,
  sessionToken: 0,
  reducedMotion: reducedMotionQuery.matches,
  palette: palettes[0]
};

beginButton.addEventListener('click', beginExperience);
soundToggle.addEventListener('click', toggleSound);
touchSurface.addEventListener('pointerdown', handleSkyPointer);
touchSurface.addEventListener('click', handleSkyActivation);
touchSurface.addEventListener('keydown', handleSkyKeyboard);
nameForm.addEventListener('submit', submitName);
surpriseNameButton.addEventListener('click', suggestName);
saveButton.addEventListener('click', saveDiscoveryCard);
copyButton.addEventListener('click', copyReply);
window.addEventListener('resize', queueResize, { passive: true });
window.visualViewport?.addEventListener('resize', queueResize, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) requestRender(500);
});

const handleReducedMotionChange = (event) => {
  state.reducedMotion = event.matches;
  if (event.matches) {
    state.particles = [];
    state.rings = [];
    if (state.phase === 'revealing') {
      state.revealDuration = 1;
      state.revealStartedAt = performance.now() - 1;
      clearTimeout(revealTimer);
      revealTimer = window.setTimeout(showNaming, 120);
    }
  }
  requestRender(150);
};

if (typeof reducedMotionQuery.addEventListener === 'function') {
  reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
} else {
  reducedMotionQuery.addListener(handleReducedMotionChange);
}

resizeCanvas();
resetBackground();
applyPalette(state.palette);
requestRender(1200);

function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
}

function mulberry32(seed) {
  return function next() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function easeInOutCubic(value) {
  return value < .5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function showScene(sceneId, phase) {
  scenes.forEach((scene) => {
    const active = scene.id === sceneId;
    scene.hidden = !active;
    scene.classList.toggle('is-active', active);
  });
  state.phase = phase;
  experience.dataset.phase = phase;
  document.body.dataset.phase = phase;
  const activeScene = document.querySelector(`#${sceneId}`);
  const heading = activeScene?.querySelector('h1, h2');
  if (heading) requestAnimationFrame(() => heading.focus({ preventScroll: true }));
  window.scrollTo({ top: 0, behavior: state.reducedMotion ? 'auto' : 'smooth' });
  requestRender(900);
}

function beginExperience() {
  showScene('creationScene', 'collecting');
  updateCreationCopy();
  requestAnimationFrame(() => touchSurface.focus({ preventScroll: true }));
  announce('Tap anywhere to place star 1 of 7.');
  playTone(0, true);
}

function handleSkyPointer(event) {
  if (
    state.phase !== 'collecting'
    || state.stars.length >= STAR_LIMIT
    || !event.isPrimary
    || (event.pointerType === 'mouse' && event.button !== 0)
  ) return;
  const x = event.clientX / viewport.width;
  const y = event.clientY / viewport.height;
  addStar(x, y);
}

function handleSkyActivation(event) {
  if (event.detail !== 0 || state.phase !== 'collecting') return;
  addAccessibleStar();
}

function handleSkyKeyboard(event) {
  if (![' ', 'Enter'].includes(event.key) || state.phase !== 'collecting') return;
  event.preventDefault();
  addAccessibleStar();
}

function addAccessibleStar() {
  if (state.stars.length >= STAR_LIMIT) return;
  const random = mulberry32((state.baseSeed + state.stars.length * 2654435761) >>> 0);
  const x = .16 + random() * .68;
  const y = .17 + random() * .48;
  addStar(x, y);
}

function addStar(rawX, rawY) {
  const index = state.stars.length;
  let u = clamp(rawX, .07, .93);
  const maximumY = viewport.height < 680 && viewport.width > viewport.height ? .75 : .7;
  let v = clamp(rawY, .12, maximumY);

  for (const existing of state.stars) {
    const distance = Math.hypot(u - existing.u, v - existing.v);
    if (distance < .065) {
      const angle = (index + 1) * 2.399963;
      u = clamp(u + Math.cos(angle) * (.07 - distance), .07, .93);
      v = clamp(v + Math.sin(angle) * (.07 - distance), .12, maximumY);
    }
  }

  const bornAt = performance.now();
  const star = {
    id: index,
    u,
    v,
    fromU: u,
    fromV: v,
    targetU: u,
    targetV: v,
    bornAt,
    phase: ((state.baseSeed >>> (index % 16)) + index * 1.47) % (Math.PI * 2),
    size: 2.7 + ((state.baseSeed >>> (index * 3 % 24)) & 3) * .38,
    curve: 0
  };

  if (state.stars.length) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    state.stars.forEach((candidate, candidateIndex) => {
      const distance = Math.hypot(u - candidate.u, v - candidate.v);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = candidateIndex;
      }
    });
    state.collectionEdges.push([nearestIndex, index]);
  }

  state.stars.push(star);
  createStarBurst(star);
  updateCreationCopy();
  playTone(index + 1);
  navigator.vibrate?.(index === STAR_LIMIT - 1 ? [12, 30, 18] : 10);
  requestRender(state.reducedMotion ? 180 : 1500);

  announce(`Star ${state.stars.length} of ${STAR_LIMIT} placed.`);
  if (state.stars.length === STAR_LIMIT) beginReveal();
}

function updateCreationCopy() {
  const count = state.stars.length;
  starCount.textContent = String(count);
  creationTitle.textContent = creationMessages[count];
  progressMarks.forEach((mark, index) => mark.classList.toggle('is-awake', index < count));
  if (count < STAR_LIMIT) {
    touchSurface.setAttribute('aria-label', `Place star ${count + 1} of ${STAR_LIMIT}`);
    touchSurface.removeAttribute('aria-disabled');
  } else {
    touchSurface.setAttribute('aria-label', 'The constellation is forming');
    touchSurface.setAttribute('aria-disabled', 'true');
  }
}

function createStarBurst(star) {
  if (state.reducedMotion) return;
  state.rings.push({ u: star.u, v: star.v, bornAt: performance.now(), life: 850 });
  const random = mulberry32((state.baseSeed ^ (star.id + 1) * 2246822519) >>> 0);
  for (let index = 0; index < 10; index += 1) {
    state.particles.push({
      u: star.u,
      v: star.v,
      bornAt: performance.now(),
      life: 700 + random() * 420,
      angle: random() * Math.PI * 2,
      speed: 15 + random() * 32,
      size: .7 + random() * 1.7
    });
  }
}

function beginReveal() {
  state.phase = 'revealing';
  experience.dataset.phase = 'revealing';
  document.body.dataset.phase = 'revealing';
  state.sessionToken += 1;
  const token = state.sessionToken;

  finalizeConstellation();
  state.revealDuration = state.reducedMotion ? 1 : 1750;
  state.revealStartedAt = performance.now() + (state.reducedMotion ? 0 : 600);
  clearTimeout(revealTimer);
  revealTimer = window.setTimeout(() => {
    if (token !== state.sessionToken) return;
    showNaming();
  }, (state.reducedMotion ? 300 : 2850));
  requestRender(state.reducedMotion ? 650 : 3000);
  playRevealChord();
}

function finalizeConstellation() {
  const signature = state.stars
    .map((star, index) => `${index}:${Math.round(star.u * 1000)},${Math.round(star.v * 1000)}`)
    .join('|');
  state.finalSeed = hashText(`${state.baseSeed}|${signature}`);
  state.code = state.finalSeed.toString(36).toUpperCase().padStart(6, '0').slice(-6);
  state.palette = palettes[state.finalSeed % palettes.length];
  applyPalette(state.palette);

  const targets = buildTargetPoints(state.finalSeed, state.stars);
  const random = mulberry32(state.finalSeed ^ 0xA5A5A5A5);
  state.stars.forEach((star, index) => {
    star.fromU = star.u;
    star.fromV = star.v;
    star.targetU = targets[index].u;
    star.targetV = targets[index].v;
    star.curve = (random() - .5) * .095;
  });
  state.finalEdges = buildMinimumSpanningTree(targets);
  addOptionalChord(state.finalEdges, targets, random);
  state.description = describeConstellation(targets, state.finalEdges);
  canvas.setAttribute('aria-label', state.description);
}

function describeConstellation(points, edges) {
  const minU = Math.min(...points.map((point) => point.u));
  const maxU = Math.max(...points.map((point) => point.u));
  const minV = Math.min(...points.map((point) => point.v));
  const maxV = Math.max(...points.map((point) => point.v));
  const width = maxU - minU;
  const height = maxV - minV;
  const orientation = width > height * 1.45 ? 'wide' : height > width * 1.45 ? 'tall' : 'balanced';
  const degrees = Array(points.length).fill(0);
  edges.forEach(([from, to]) => {
    degrees[from] += 1;
    degrees[to] += 1;
  });
  const endpoints = degrees.filter((degree) => degree === 1).length;
  const shape = edges.length >= points.length
    ? 'a small loop and branching lines'
    : endpoints >= 4
      ? 'several branching paths'
      : 'one connected path';
  return `A ${orientation}, seven-star constellation forming ${shape}.`;
}

function buildTargetPoints(seed, stars) {
  const random = mulberry32(seed);
  const archetypes = [
    [[-.39,.08],[-.26,-.13],[-.08,-.23],[.11,-.17],[.28,-.03],[.39,.17],[.02,.2]],
    [[-.36,.2],[-.27,-.12],[-.08,.03],[0,-.28],[.1,.04],[.29,-.14],[.37,.21]],
    [[-.32,-.17],[-.16,-.05],[-.28,.2],[.02,.08],[.18,-.2],[.33,-.01],[.23,.23]],
    [[-.38,.02],[-.24,-.2],[-.02,-.1],[.19,-.23],[.36,-.02],[.19,.18],[-.06,.22]],
    [[-.36,-.13],[-.2,.08],[-.04,-.21],[.1,.03],[.29,-.1],[.37,.18],[.03,.24]],
    [[-.34,.19],[-.31,-.08],[-.08,-.21],[.08,.02],[.31,-.17],[.36,.13],[.02,.24]]
  ];
  const shape = archetypes[seed % archetypes.length];
  const rotation = (random() - .5) * .72;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const centerU = stars.reduce((sum, star) => sum + star.u, 0) / stars.length;
  const centerV = stars.reduce((sum, star) => sum + star.v, 0) / stars.length;
  const maxDistance = Math.max(...stars.map((star) => Math.hypot(star.u - centerU, star.v - centerV)), .1);
  const targetCenterV = viewport.width > viewport.height ? .4 : .35;

  const points = shape.map(([shapeX, shapeY], index) => {
    const rotatedX = shapeX * cos - shapeY * sin;
    const rotatedY = shapeX * sin + shapeY * cos;
    const originalX = (stars[index].u - centerU) / maxDistance * .31;
    const originalY = (stars[index].v - centerV) / maxDistance * .22;
    const localX = rotatedX * .48 + originalX * .52 + (random() - .5) * .026;
    const localY = rotatedY * .48 + originalY * .52 + (random() - .5) * .021;
    return {
      u: .5 + localX * (viewport.width < 520 ? .84 : .72),
      v: targetCenterV + localY * (viewport.width < 520 ? .77 : .66)
    };
  });

  for (let pass = 0; pass < 7; pass += 1) {
    for (let first = 0; first < points.length; first += 1) {
      for (let second = first + 1; second < points.length; second += 1) {
        const dx = points[second].u - points[first].u;
        const dy = points[second].v - points[first].v;
        const distance = Math.hypot(dx, dy) || .001;
        const minimum = .092;
        if (distance >= minimum) continue;
        const push = (minimum - distance) / 2;
        points[first].u -= dx / distance * push;
        points[first].v -= dy / distance * push;
        points[second].u += dx / distance * push;
        points[second].v += dy / distance * push;
      }
    }
  }

  return points.map((point) => ({
    u: clamp(point.u, .1, .9),
    v: clamp(point.v, .14, viewport.width > viewport.height ? .67 : .59)
  }));
}

function buildMinimumSpanningTree(points) {
  const visited = new Set([0]);
  const edges = [];
  while (visited.size < points.length) {
    let best;
    visited.forEach((from) => {
      points.forEach((point, to) => {
        if (visited.has(to)) return;
        const distance = Math.hypot(point.u - points[from].u, point.v - points[from].v);
        if (!best || distance < best.distance) best = { from, to, distance };
      });
    });
    edges.push([best.from, best.to]);
    visited.add(best.to);
  }
  return edges;
}

function addOptionalChord(edges, points, random) {
  if (random() < .35) return;
  const candidates = [];
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      if (edges.some(([a, b]) => (a === first && b === second) || (a === second && b === first))) continue;
      const distance = Math.hypot(points[first].u - points[second].u, points[first].v - points[second].v);
      if (distance < .29 && !lineCrossesEdges(first, second, edges, points)) {
        candidates.push({ edge: [first, second], distance });
      }
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  if (candidates.length) edges.push(candidates[Math.floor(random() * Math.min(3, candidates.length))].edge);
}

function lineCrossesEdges(first, second, edges, points) {
  return edges.some(([edgeFirst, edgeSecond]) => {
    if ([first, second].includes(edgeFirst) || [first, second].includes(edgeSecond)) return false;
    return segmentsIntersect(points[first], points[second], points[edgeFirst], points[edgeSecond]);
  });
}

function segmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (q.u - p.u) * (r.v - p.v) - (q.v - p.v) * (r.u - p.u);
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

function showNaming() {
  showScene('namingScene', 'naming');
  announce(`Your constellation is ready. ${state.description} Give it a name.`);
  if (window.matchMedia('(pointer: fine)').matches) {
    window.setTimeout(() => nameInput.focus({ preventScroll: false }), state.reducedMotion ? 50 : 450);
  }
}

function submitName(event) {
  event.preventDefault();
  const cleanName = sanitizeName(nameInput.value);
  if (!cleanName) {
    fieldMessage.textContent = 'Anything counts. Even Steve.';
    nameInput.focus();
    return;
  }
  state.name = cleanName;
  fieldMessage.textContent = '';
  revealConstellation();
}

function sanitizeName(value) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  if (globalThis.Intl?.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return [...segmenter.segment(normalized)].slice(0, 24).map(({ segment }) => segment).join('');
  }
  return Array.from(normalized).slice(0, 24).join('');
}

function suggestName() {
  const random = mulberry32((state.finalSeed + state.suggestionIndex * 1013904223) >>> 0);
  const first = nameFirst[Math.floor(random() * nameFirst.length)];
  const second = nameSecond[Math.floor(random() * nameSecond.length)];
  state.suggestionIndex += 1;
  nameInput.value = sanitizeName(`${first} ${second}`);
  fieldMessage.textContent = 'The sky made a suggestion.';
  nameInput.focus();
  nameInput.select();
  playTone(4);
}

function revealConstellation() {
  state.createdAt = new Date();
  revealTitle.textContent = state.name;
  skyCode.textContent = `SKY–${state.code}`;
  discoveryDate.textContent = new Intl.DateTimeFormat(undefined, {
    month: 'long', day: 'numeric', year: 'numeric'
  }).format(state.createdAt);
  showScene('revealScene', 'complete');
  announce(`${state.name} discovered. The internet is slightly less ordinary because you showed up.`);
  playFinalChord();
  createFinalPulse();
  requestRender(state.reducedMotion ? 250 : 2100);
}

function createFinalPulse() {
  if (state.reducedMotion) return;
  state.stars.forEach((star, index) => {
    state.rings.push({
      targetIndex: index,
      bornAt: performance.now() + index * 70,
      life: 1100
    });
  });
}

function toggleSound() {
  state.soundOn = !state.soundOn;
  soundToggle.setAttribute('aria-pressed', String(state.soundOn));
  soundLabel.textContent = state.soundOn ? 'Sound on' : 'Sound off';
  if (state.soundOn) {
    ensureAudioContext();
    playTone(2, true);
  }
}

function ensureAudioContext() {
  if (!state.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) state.audioContext = new AudioContext();
  }
  if (state.audioContext?.state === 'suspended') state.audioContext.resume().catch(() => {});
  return state.audioContext;
}

function playTone(index, gentle = false) {
  if (!state.soundOn) return;
  const audio = ensureAudioContext();
  if (!audio) return;
  const notes = [261.63, 293.66, 329.63, 392, 440, 493.88, 523.25, 659.25];
  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = gentle ? 'sine' : 'triangle';
  oscillator.frequency.setValueAtTime(notes[index % notes.length], now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gentle ? .025 : .045, now + .02);
  gain.gain.exponentialRampToValueAtTime(.0001, now + (gentle ? .45 : .62));
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + .68);
}

function playRevealChord() {
  if (!state.soundOn) return;
  [0, 2, 4].forEach((note, index) => window.setTimeout(() => playTone(note + 1, true), 760 + index * 170));
}

function playFinalChord() {
  if (!state.soundOn) return;
  [1, 3, 5, 7].forEach((note, index) => window.setTimeout(() => playTone(note, true), index * 130));
}

function applyPalette(palette) {
  const root = document.documentElement.style;
  root.setProperty('--accent', palette.accent);
  root.setProperty('--accent-2', palette.accent2);
  root.setProperty('--accent-3', palette.accent3);
  root.setProperty('--glow', palette.glow);
}

function announce(message) {
  announcer.textContent = '';
  window.setTimeout(() => { announcer.textContent = message; }, 25);
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2600);
}

async function copyReply() {
  const reply = state.name;
  let copied = false;
  try {
    await navigator.clipboard.writeText(reply);
    copied = true;
  } catch {
    const helper = document.createElement('textarea');
    helper.value = reply;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.append(helper);
    try {
      helper.select();
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    } finally {
      helper.remove();
    }
  }
  showToast(copied ? `Copied: “${state.name}”` : 'Copy did not work. Press and hold the name instead.');
}

async function saveDiscoveryCard() {
  saveButton.disabled = true;
  try {
    const card = renderDiscoveryCard();
    const blob = await new Promise((resolve) => card.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The discovery card could not be created.');
    const filename = `constellation-${state.code.toLowerCase()}.png`;
    const file = typeof File === 'function' ? new File([blob], filename, { type: 'image/png' }) : null;

    if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: state.name });
        showToast('Your discovery card is ready.');
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast('Download started. Check your Downloads.');
  } catch (error) {
    console.error(error);
    showToast('The sky misplaced the card. Please try once more.');
  } finally {
    saveButton.disabled = false;
  }
}

function renderDiscoveryCard() {
  const card = document.createElement('canvas');
  const cardContext = card.getContext('2d');
  card.width = 1080;
  card.height = 1350;

  const background = cardContext.createLinearGradient(0, 0, 1080, 1350);
  background.addColorStop(0, '#101942');
  background.addColorStop(.42, '#080d25');
  background.addColorStop(1, '#030610');
  cardContext.fillStyle = background;
  cardContext.fillRect(0, 0, 1080, 1350);

  const aura = cardContext.createRadialGradient(540, 480, 0, 540, 480, 520);
  aura.addColorStop(0, hexToRgba(state.palette.accent, .2));
  aura.addColorStop(.52, hexToRgba(state.palette.accent2, .08));
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  cardContext.fillStyle = aura;
  cardContext.fillRect(0, 0, 1080, 1000);

  const random = mulberry32(state.finalSeed ^ 0x51ED270B);
  for (let index = 0; index < 175; index += 1) {
    const x = 48 + random() * 984;
    const y = 42 + random() * 980;
    const radius = .5 + random() * 1.45;
    cardContext.beginPath();
    cardContext.arc(x, y, radius, 0, Math.PI * 2);
    cardContext.fillStyle = `rgba(232,238,255,${.18 + random() * .55})`;
    cardContext.fill();
  }

  cardContext.fillStyle = state.palette.accent3;
  cardContext.font = '800 24px "Segoe UI", system-ui, sans-serif';
  cardContext.letterSpacing = '5px';
  cardContext.fillText('DISCOVERY RECORD', 78, 88);
  cardContext.textAlign = 'right';
  cardContext.fillText(`SKY–${state.code}`, 1002, 88);
  cardContext.textAlign = 'left';

  const cardPoints = fitPointsForCard(state.stars.map((star) => ({ u: star.targetU, v: star.targetV })));
  drawConstellation(cardContext, cardPoints, state.finalEdges, {
    lineColor: hexToRgba(state.palette.accent, .62),
    coreColor: '#ffffff',
    glowColor: state.palette.accent,
    lineWidth: 2.2,
    starScale: 1.8
  });

  cardContext.textAlign = 'center';
  cardContext.fillStyle = '#ffffff';
  fitCanvasText(cardContext, state.name, 900, 104, 50, '800', 540, 1010);
  cardContext.fillStyle = '#bfc8e5';
  cardContext.font = '500 28px "Segoe UI", system-ui, sans-serif';
  const date = new Intl.DateTimeFormat(undefined, {
    month: 'long', day: 'numeric', year: 'numeric'
  }).format(state.createdAt);
  cardContext.fillText(`SEVEN STARS  ·  ${date.toUpperCase()}`, 540, 1085);
  cardContext.fillStyle = '#edf0ff';
  cardContext.font = '600 26px "Segoe UI", system-ui, sans-serif';
  cardContext.fillText('Discovered by one curious person', 540, 1141);

  cardContext.strokeStyle = 'rgba(211,220,255,.18)';
  cardContext.lineWidth = 2;
  cardContext.beginPath();
  cardContext.moveTo(78, 1212);
  cardContext.lineTo(1002, 1212);
  cardContext.stroke();
  cardContext.fillStyle = '#75809f';
  cardContext.font = '500 21px "Segoe UI", system-ui, sans-serif';
  cardContext.fillText('THIS EXACT SKY WAS DRAWN ONCE', 540, 1265);
  return card;
}

function fitPointsForCard(points) {
  const minU = Math.min(...points.map((point) => point.u));
  const maxU = Math.max(...points.map((point) => point.u));
  const minV = Math.min(...points.map((point) => point.v));
  const maxV = Math.max(...points.map((point) => point.v));
  const sourceWidth = Math.max(maxU - minU, .1);
  const sourceHeight = Math.max(maxV - minV, .1);
  const scale = Math.min(780 / sourceWidth, 590 / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const left = 540 - width / 2;
  const top = 445 - height / 2;
  return points.map((point) => ({
    x: left + (point.u - minU) * scale,
    y: top + (point.v - minV) * scale
  }));
}

function fitPointsForLive(points) {
  if (!points.length) return [];
  const minU = Math.min(...points.map((point) => point.u));
  const maxU = Math.max(...points.map((point) => point.u));
  const minV = Math.min(...points.map((point) => point.v));
  const maxV = Math.max(...points.map((point) => point.v));
  const sourceWidth = Math.max(maxU - minU, .1);
  const sourceHeight = Math.max(maxV - minV, .1);
  const landscape = viewport.width > viewport.height;
  const maximumWidth = Math.min(viewport.width * (viewport.width < 620 ? .82 : .68), 760);
  const maximumHeight = Math.min(viewport.height * (landscape ? .42 : .32), 320);
  const scale = Math.min(maximumWidth / sourceWidth, maximumHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const centerY = viewport.height * (landscape ? .39 : .34);
  const left = viewport.width / 2 - width / 2;
  const top = centerY - height / 2;
  return points.map((point) => ({
    x: left + (point.u - minU) * scale,
    y: top + (point.v - minV) * scale
  }));
}

function fitCanvasText(ctx, text, maxWidth, startSize, minimumSize, weight, x, y) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > minimumSize);
  let output = text;
  while (ctx.measureText(output).width > maxWidth && output.length > 1) output = `${output.slice(0, -2)}…`;
  ctx.fillText(output, x, y);
}

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((part) => part + part).join('') : value;
  const number = Number.parseInt(full, 16);
  return `rgba(${number >> 16},${number >> 8 & 255},${number & 255},${alpha})`;
}

function queueResize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(resizeCanvas);
}

function resizeCanvas() {
  viewport.width = window.innerWidth;
  viewport.height = window.innerHeight;
  viewport.dpr = Math.min(window.devicePixelRatio || 1, LIVE_DPR_CAP);
  canvas.width = Math.round(viewport.width * viewport.dpr);
  canvas.height = Math.round(viewport.height * viewport.dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  context.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  requestRender(250);
}

function resetBackground() {
  const random = mulberry32(state.baseSeed ^ 0x9E3779B9);
  const amount = clamp(Math.round((viewport.width * viewport.height) / 7200), 80, 145);
  state.backgroundStars = Array.from({ length: amount }, () => ({
    u: random(),
    v: random(),
    size: .35 + random() * 1.15,
    alpha: .18 + random() * .58,
    phase: random() * Math.PI * 2,
    speed: .00035 + random() * .00065
  }));
}

function requestRender(duration = 0) {
  animateUntil = Math.max(animateUntil, performance.now() + duration);
  if (!animationFrame) animationFrame = requestAnimationFrame(renderLoop);
}

function renderLoop(now) {
  animationFrame = undefined;
  drawLiveScene(now);
  const hasLiveEffects = state.particles.some((particle) => now < particle.bornAt + particle.life)
    || state.rings.some((ring) => now < ring.bornAt + ring.life);
  if (state.phase === 'revealing' || now < animateUntil || hasLiveEffects) {
    animationFrame = requestAnimationFrame(renderLoop);
  }
}

function drawLiveScene(now) {
  const { width, height } = viewport;
  context.clearRect(0, 0, width, height);
  drawBackgroundStars(context, now);
  if (!state.stars.length) return;

  const points = currentStarPoints(now);
  let edges = state.collectionEdges;
  let lineProgress = 1;
  let lineAlpha = .42;

  if (state.phase === 'revealing' || ['naming', 'complete'].includes(state.phase)) {
    edges = state.finalEdges;
    const revealProgress = state.phase === 'revealing'
      ? clamp((now - state.revealStartedAt) / state.revealDuration, 0, 1)
      : 1;
    lineProgress = state.reducedMotion ? 1 : clamp((revealProgress - .48) / .45, 0, 1);
    lineAlpha = .66;
  }

  drawLiveConnections(points, edges, lineProgress, lineAlpha);
  drawLiveStars(points, now);
  drawEffects(now);
}

function drawBackgroundStars(ctx, now) {
  const animate = now < animateUntil && !state.reducedMotion;
  state.backgroundStars.forEach((star) => {
    const shimmer = animate ? .78 + Math.sin(now * star.speed + star.phase) * .22 : 1;
    ctx.beginPath();
    ctx.arc(star.u * viewport.width, star.v * viewport.height, star.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(226,233,255,${star.alpha * shimmer})`;
    ctx.fill();
  });
}

function currentStarPoints(now) {
  const fittedTargets = fitPointsForLive(state.stars.map((star) => ({
    u: star.targetU,
    v: star.targetV
  })));
  if (state.phase !== 'revealing') {
    const useTargets = ['naming', 'complete'].includes(state.phase);
    return state.stars.map((star, index) => useTargets ? fittedTargets[index] : ({
      x: star.u * viewport.width,
      y: star.v * viewport.height
    }));
  }

  const overall = clamp((now - state.revealStartedAt) / state.revealDuration, 0, 1);
  return state.stars.map((star, index) => {
    const stagger = state.reducedMotion ? 0 : index * .035;
    const local = easeInOutCubic(clamp((overall - stagger) / (1 - stagger), 0, 1));
    const fromX = star.fromU * viewport.width;
    const fromY = star.fromV * viewport.height;
    const targetX = fittedTargets[index].x;
    const targetY = fittedTargets[index].y;
    const dx = targetX - fromX;
    const dy = targetY - fromY;
    const distance = Math.hypot(dx, dy) || 1;
    const arc = Math.sin(local * Math.PI) * star.curve * Math.min(viewport.width, viewport.height);
    return {
      x: fromX + dx * local + (-dy / distance) * arc,
      y: fromY + dy * local + (dx / distance) * arc
    };
  });
}

function drawLiveConnections(points, edges, progress, alpha) {
  if (!edges.length || progress <= 0) return;
  context.save();
  context.lineCap = 'round';
  context.lineWidth = 1.15;
  context.shadowBlur = 8;
  context.shadowColor = state.palette.glow;
  edges.forEach(([from, to], index) => {
    const start = points[from];
    const end = points[to];
    if (!start || !end) return;
    const edgeProgress = clamp(progress * edges.length - index, 0, 1);
    if (edgeProgress <= 0) return;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(
      start.x + (end.x - start.x) * edgeProgress,
      start.y + (end.y - start.y) * edgeProgress
    );
    context.strokeStyle = hexToRgba(state.palette.accent, alpha);
    context.stroke();
  });
  context.restore();
}

function drawLiveStars(points, now) {
  points.forEach((point, index) => {
    const star = state.stars[index];
    const age = now - star.bornAt;
    const arrival = state.reducedMotion ? 1 : clamp(age / 420, 0, 1);
    const pulse = state.reducedMotion ? 1 : 1 + Math.sin(now * .003 + star.phase) * .08;
    drawStar(context, point.x, point.y, star.size * arrival * pulse, {
      coreColor: '#ffffff',
      glowColor: index % 3 === 0 ? state.palette.accent2 : state.palette.accent,
      alpha: .95
    });
  });
}

function drawStar(ctx, x, y, radius, options) {
  if (radius <= 0) return;
  const haloRadius = Math.max(14, radius * 6.5);
  const halo = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
  halo.addColorStop(0, hexToRgba(options.glowColor, .42 * options.alpha));
  halo.addColorStop(.22, hexToRgba(options.glowColor, .16 * options.alpha));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = hexToRgba(options.coreColor, .45 * options.alpha);
  ctx.lineWidth = Math.max(.55, radius * .2);
  ctx.beginPath();
  ctx.moveTo(x - radius * 3.4, y);
  ctx.lineTo(x + radius * 3.4, y);
  ctx.moveTo(x, y - radius * 3.4);
  ctx.lineTo(x, y + radius * 3.4);
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, Math.max(1.2, radius), 0, Math.PI * 2);
  ctx.fillStyle = options.coreColor;
  ctx.shadowBlur = radius * 4;
  ctx.shadowColor = options.glowColor;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawEffects(now) {
  const fittedTargets = fitPointsForLive(state.stars.map((star) => ({
    u: star.targetU,
    v: star.targetV
  })));
  state.rings = state.rings.filter((ring) => now < ring.bornAt + ring.life);
  state.rings.forEach((ring) => {
    const progress = clamp((now - ring.bornAt) / ring.life, 0, 1);
    if (progress <= 0) return;
    const target = Number.isInteger(ring.targetIndex) ? fittedTargets[ring.targetIndex] : null;
    context.beginPath();
    context.arc(
      target ? target.x : ring.u * viewport.width,
      target ? target.y : ring.v * viewport.height,
      8 + progress * 31,
      0,
      Math.PI * 2
    );
    context.strokeStyle = hexToRgba(state.palette.accent, (1 - progress) * .45);
    context.lineWidth = 1.2;
    context.stroke();
  });

  state.particles = state.particles.filter((particle) => now < particle.bornAt + particle.life);
  state.particles.forEach((particle) => {
    const progress = clamp((now - particle.bornAt) / particle.life, 0, 1);
    const distance = particle.speed * progress;
    const x = particle.u * viewport.width + Math.cos(particle.angle) * distance;
    const y = particle.v * viewport.height + Math.sin(particle.angle) * distance;
    context.beginPath();
    context.arc(x, y, particle.size * (1 - progress * .45), 0, Math.PI * 2);
    context.fillStyle = hexToRgba(state.palette.accent3, (1 - progress) * .72);
    context.fill();
  });
}

function drawConstellation(ctx, points, edges, options) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = options.lineWidth;
  ctx.strokeStyle = options.lineColor;
  ctx.shadowBlur = 12;
  ctx.shadowColor = options.glowColor;
  edges.forEach(([from, to]) => {
    ctx.beginPath();
    ctx.moveTo(points[from].x, points[from].y);
    ctx.lineTo(points[to].x, points[to].y);
    ctx.stroke();
  });
  ctx.restore();
  points.forEach((point, index) => {
    drawStar(ctx, point.x, point.y, (3.1 + index % 3 * .4) * options.starScale, {
      coreColor: options.coreColor,
      glowColor: index % 3 === 0 ? state.palette.accent2 : options.glowColor,
      alpha: 1
    });
  });
}
