import { personalityTelemetry } from './personality-tracker.js';
import {
  endingGif,
  prankGif,
  questions,
  reactionAssets,
  validatePersonalityData
} from './personality-data.js';

const REACTION_MS = 3000;
const GIF_LOAD_TIMEOUT_MS = 1600;

validatePersonalityData();

const questionById = new Map(questions.map((question) => [question.id, question]));
const screens = [...document.querySelectorAll('.screen')];
const game = document.querySelector('#game');
const progressHeader = document.querySelector('#progressHeader');
const progressLabel = document.querySelector('#progressLabel');
const progressStatus = document.querySelector('#progressStatus');
const progressTrack = document.querySelector('#progressTrack');
const progressBar = document.querySelector('#progressBar');
const mascotStage = document.querySelector('#mascotStage');
const mascotProp = document.querySelector('#mascotProp');
const collectedIcons = document.querySelector('#collectedIcons');
const questionEyebrow = document.querySelector('#questionEyebrow');
const questionTitle = document.querySelector('#questionTitle');
const questionHint = document.querySelector('#questionHint');
const choiceGrid = document.querySelector('#choiceGrid');
const reactionEyebrow = document.querySelector('#reactionEyebrow');
const reactionTitle = document.querySelector('#reactionTitle');
const reactionGifFrame = document.querySelector('#reactionGifFrame');
const reactionFallback = document.querySelector('#reactionFallback');
const reactionFallbackEmoji = document.querySelector('#reactionFallbackEmoji');
const reactionGif = document.querySelector('#reactionGif');
const gifCredit = document.querySelector('#gifCredit');
const reactionTimerBar = document.querySelector('#reactionTimerBar');
const countdownNumber = document.querySelector('#countdownNumber');
const prankGifFrame = document.querySelector('#prankGifFrame');
const prankFallback = document.querySelector('#prankFallback');
const prankGifElement = document.querySelector('#prankGif');
const endingGifFrame = document.querySelector('#endingGifFrame');
const endingFallback = document.querySelector('#endingFallback');
const endingGifElement = document.querySelector('#endingGif');
const endingGifCredit = document.querySelector('#endingGifCredit');
const confetti = document.querySelector('#confetti');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

reactionTimerBar.style.setProperty('--reaction-duration', `${REACTION_MS}ms`);

let currentQuestion = 0;
let answerLocked = false;
let answers = {};
let timers = new Set();
let poseTimer;
let gifLoadToken = 0;
let usedGifIds = new Set();

document.querySelector('#startButton').addEventListener('click', startGame);
document.querySelector('#replayButton').addEventListener('click', replayGame);

function schedule(callback, delay) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
  return timer;
}

function stopGif(frame, iframe, fallback) {
  iframe.onload = null;
  iframe.src = 'about:blank';
  frame.classList.remove('is-loading', 'is-fallback');
  frame.setAttribute('aria-busy', 'false');
  fallback.setAttribute('aria-hidden', 'true');
}

function clearTimers() {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  window.clearTimeout(poseTimer);
  gifLoadToken += 1;
  stopGif(reactionGifFrame, reactionGif, reactionFallback);
  stopGif(prankGifFrame, prankGifElement, prankFallback);
  stopGif(endingGifFrame, endingGifElement, endingFallback);
}

function showScreen(screenId, view, theme = document.body.dataset.theme) {
  screens.forEach((screen) => {
    screen.hidden = screen.id !== screenId;
  });
  game.dataset.view = view;
  document.body.dataset.theme = theme;

  const active = document.querySelector(`#${screenId}`);
  const heading = active?.querySelector('h1, h2');
  if (heading) requestAnimationFrame(() => heading.focus({ preventScroll: true }));
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

function setMascotPose(pose, duration = 1450) {
  window.clearTimeout(poseTimer);
  mascotStage.dataset.pose = '';
  void mascotStage.offsetWidth;
  mascotStage.dataset.pose = pose;
  poseTimer = window.setTimeout(() => {
    mascotStage.dataset.pose = '';
  }, duration);
}

function loadGif({ frame, iframe, fallback, source, title, fallbackEmoji, onReady }) {
  const token = ++gifLoadToken;
  let gifLoaded = false;
  let readyNotified = false;
  let fallbackTimer;

  frame.classList.remove('is-fallback');
  frame.classList.add('is-loading');
  frame.setAttribute('aria-busy', 'true');
  fallback.setAttribute('aria-hidden', 'true');
  const emoji = fallback.querySelector('span');
  if (emoji) emoji.textContent = fallbackEmoji;
  iframe.title = title;

  const notifyReady = () => {
    if (readyNotified) return;
    readyNotified = true;
    onReady();
  };

  iframe.onload = () => {
    if (token !== gifLoadToken) return;
    gifLoaded = true;
    window.clearTimeout(fallbackTimer);
    timers.delete(fallbackTimer);
    frame.classList.remove('is-loading', 'is-fallback');
    frame.setAttribute('aria-busy', 'false');
    fallback.setAttribute('aria-hidden', 'true');
    notifyReady();
  };

  iframe.src = source;
  fallbackTimer = schedule(() => {
    if (token !== gifLoadToken || gifLoaded) return;
    frame.classList.remove('is-loading');
    frame.classList.add('is-fallback');
    frame.setAttribute('aria-busy', 'false');
    fallback.setAttribute('aria-hidden', 'false');
    notifyReady();
  }, GIF_LOAD_TIMEOUT_MS);
}

function startGame() {
  clearTimers();
  currentQuestion = 0;
  answerLocked = false;
  answers = {};
  usedGifIds = new Set();
  collectedIcons.replaceChildren();
  confetti.replaceChildren();
  mascotProp.textContent = '🧠';
  personalityTelemetry.beginRun();
  renderQuestion();
}

function replayGame() {
  personalityTelemetry.resetRun();
  startGame();
}

function renderQuestion() {
  const question = questions[currentQuestion];
  answerLocked = false;
  progressHeader.hidden = false;
  progressLabel.textContent = `Question ${currentQuestion + 1} of ${questions.length}`;
  progressStatus.textContent = question.silly
    ? 'Important nonsense'
    : currentQuestion < 6 ? 'Quick choice' : 'Almost there';
  progressTrack.setAttribute('aria-valuenow', String(currentQuestion + 1));
  progressBar.style.width = `${((currentQuestion + 1) / questions.length) * 100}%`;
  questionEyebrow.textContent = question.silly
    ? 'Very important question'
    : `Question ${currentQuestion + 1}`;
  questionTitle.textContent = question.prompt;
  questionHint.textContent = question.silly
    ? 'This is definitely important. Probably.'
    : 'Choose the answer that feels most like you.';
  mascotProp.textContent = question.icon;
  choiceGrid.replaceChildren();

  question.choices.forEach((choice) => {
    const button = document.createElement('button');
    button.className = 'button choice-card';
    button.type = 'button';
    button.dataset.choice = choice.id;

    const icon = document.createElement('span');
    icon.className = 'choice-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = choice.icon;

    const label = document.createElement('span');
    label.className = 'choice-label';
    label.textContent = choice.label;

    button.append(icon, label);
    button.addEventListener('click', () => answerQuestion(question, choice, button));
    choiceGrid.append(button);
  });

  showScreen('questionScreen', 'question', question.theme);
}

function answerQuestion(question, choice, selectedButton) {
  if (answerLocked) return;
  answerLocked = true;
  answers[question.id] = choice.id;
  personalityTelemetry.recordAnswer(question.id, choice.id);

  [...choiceGrid.querySelectorAll('button')].forEach((button) => {
    button.disabled = true;
  });
  selectedButton.classList.add('chosen');
  addCollectedIcon(choice.icon);
  setMascotPose(choice.pose);
  showReaction(question, choice);
}

function addCollectedIcon(icon) {
  const badge = document.createElement('span');
  badge.textContent = icon;
  collectedIcons.append(badge);
}

function showReaction(question, choice) {
  const asset = reactionAssets[choice.gif];
  let countdownStarted = false;

  reactionEyebrow.textContent = question.silly ? 'Important reaction' : 'Your answer says';
  reactionTitle.textContent = choice.reaction;
  reactionFallbackEmoji.textContent = asset.fallbackEmoji;
  gifCredit.href = asset.page;
  mascotProp.textContent = choice.icon;
  reactionTimerBar.classList.remove('running');
  showScreen('reactionScreen', 'reaction', question.theme);

  const beginCountdown = () => {
    if (countdownStarted) return;
    countdownStarted = true;
    void reactionTimerBar.offsetWidth;
    reactionTimerBar.classList.add('running');
    schedule(advanceAfterReaction, REACTION_MS);
  };

  if (usedGifIds.has(asset.id)) {
    reactionGifFrame.classList.remove('is-loading');
    reactionGifFrame.classList.add('is-fallback');
    reactionFallback.setAttribute('aria-hidden', 'false');
    reactionGif.src = 'about:blank';
    schedule(beginCountdown, 120);
    return;
  }

  usedGifIds.add(asset.id);
  loadGif({
    frame: reactionGifFrame,
    iframe: reactionGif,
    fallback: reactionFallback,
    source: `https://giphy.com/embed/${asset.id}`,
    title: `${asset.alt}. ${choice.reaction}`,
    fallbackEmoji: asset.fallbackEmoji,
    onReady: beginCountdown
  });
}

function advanceAfterReaction() {
  gifLoadToken += 1;
  stopGif(reactionGifFrame, reactionGif, reactionFallback);
  if (currentQuestion === questions.length - 1) {
    beginAnalysis();
    return;
  }
  currentQuestion += 1;
  renderQuestion();
}

function beginAnalysis() {
  progressHeader.hidden = true;
  mascotProp.textContent = '🧪';
  setMascotPose('inspect', 3200);
  personalityTelemetry.recordProfile(buildProfile());
  showScreen('analysisScreen', 'analysis', 'violet');

  const analysisSteps = [...document.querySelectorAll('[data-analysis-step]')];
  analysisSteps.forEach((step) => step.classList.remove('done'));
  analysisSteps.forEach((step, index) => {
    schedule(() => step.classList.add('done'), 300 + index * 520);
  });
  schedule(showCountdown, 2200);
}

function setCountdown(value) {
  countdownNumber.textContent = value;
  countdownNumber.style.animation = 'none';
  void countdownNumber.offsetWidth;
  countdownNumber.style.animation = '';
}

function showCountdown() {
  mascotProp.textContent = '🎁';
  setMascotPose('bounce', 2500);
  setCountdown('3');
  showScreen('countdownScreen', 'countdown', 'gold');
  schedule(() => setCountdown('2'), 800);
  schedule(() => setCountdown('1'), 1600);
  schedule(showPrank, 2400);
}

function showPrank() {
  mascotProp.textContent = '😏';
  setMascotPose('wiggle', 2500);
  showScreen('prankScreen', 'prank', 'coral');
  loadGif({
    frame: prankGifFrame,
    iframe: prankGifElement,
    fallback: prankFallback,
    source: `https://giphy.com/embed/${prankGif.id}`,
    title: prankGif.alt,
    fallbackEmoji: prankGif.fallbackEmoji,
    onReady: () => schedule(showTruth, 2200)
  });
}

function showTruth() {
  gifLoadToken += 1;
  stopGif(prankGifFrame, prankGifElement, prankFallback);
  mascotProp.textContent = '💛';
  setMascotPose('nod', 4200);
  showScreen('truthScreen', 'truth', 'teal');
  schedule(showEnding, 4200);
}

function selectedChoice(questionId) {
  const question = questionById.get(questionId);
  return question.choices.find((choice) => choice.id === answers[questionId]);
}

function scoreFor(questionId) {
  return selectedChoice(questionId)?.score ?? 0;
}

function buildProfile() {
  const socialScore = scoreFor('unknown_gathering') + scoreFor('recovery_style');
  const planScore = scoreFor('free_day') + scoreFor('plan_breaks');
  const adventureScore = scoreFor('menu_novelty') + scoreFor('mystery_activity');

  let socialRhythm = 'balanced';
  if (answers.unknown_gathering === 'trusted_person' && socialScore >= 0) socialRhythm = 'close_circle';
  else if (socialScore >= 1) socialRhythm = 'people_powered';
  else if (socialScore <= -1) socialRhythm = 'quiet_recharger';

  const planStyle = planScore >= 1 ? 'structured' : planScore <= -1 ? 'improvised' : 'adaptive';
  const adventureSetting = adventureScore >= 1
    ? 'novelty_first'
    : adventureScore <= -1 ? 'comfort_first' : 'context_first';
  const careLanguage = {
    listen: 'listener',
    solve: 'problem_solver',
    ask_need: 'ask_first'
  }[answers.friend_bad_day];
  const surpriseStyle = {
    no_spoilers: 'full_mystery',
    one_clue: 'one_clue',
    help_plan: 'co_created'
  }[answers.surprise_planning];
  return { socialRhythm, planStyle, adventureSetting, careLanguage, surpriseStyle };
}

function showEnding() {
  progressHeader.hidden = true;
  mascotProp.textContent = '🎉';
  setMascotPose('celebrate', 3000);
  endingGifCredit.href = endingGif.page;
  showScreen('endingScreen', 'ending', 'gold');
  personalityTelemetry.completeRun('ending_seen');
  loadGif({
    frame: endingGifFrame,
    iframe: endingGifElement,
    fallback: endingFallback,
    source: `https://giphy.com/embed/${endingGif.id}`,
    title: endingGif.alt,
    fallbackEmoji: endingGif.fallbackEmoji,
    onReady: launchConfetti
  });
}

function launchConfetti() {
  confetti.replaceChildren();
  const colors = ['#7c3aed', '#14b8a6', '#f59e0b', '#e25462', '#2878d0'];
  const amount = reducedMotion.matches ? 12 : 46;
  for (let index = 0; index < amount; index += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty('--drift', `${Math.round((Math.random() - .5) * 220)}px`);
    piece.style.animationDelay = `${Math.random() * .7}s`;
    confetti.append(piece);
  }
  schedule(() => confetti.replaceChildren(), 3900);
}
