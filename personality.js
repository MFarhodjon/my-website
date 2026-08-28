import { personalityTelemetry } from './personality-tracker.js';
import {
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
const missionPreviewCard = document.querySelector('#missionPreviewCard');
const missionPreviewIcon = document.querySelector('#missionPreviewIcon');
const missionPreviewLabel = document.querySelector('#missionPreviewLabel');
const missionPreviewText = document.querySelector('#missionPreviewText');
const missionBuildDots = [...document.querySelectorAll('[data-mission-dot]')];
const missionArchetype = document.querySelector('#missionArchetype');
const blueprintGrid = document.querySelector('#blueprintGrid');
const absurdNotes = document.querySelector('#absurdNotes');
const finalChoiceGrid = document.querySelector('#finalChoiceGrid');
const endingEyebrow = document.querySelector('#endingEyebrow');
const endingTitle = document.querySelector('#endingTitle');
const endingMessage = document.querySelector('#endingMessage');
const endingJoke = document.querySelector('#endingJoke');
const confetti = document.querySelector('#confetti');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

reactionTimerBar.style.setProperty('--reaction-duration', `${REACTION_MS}ms`);

let currentQuestion = 0;
let answerLocked = false;
let finalLocked = false;
let answers = {};
let currentProfile;
let timers = new Set();
let poseTimer;
let gifLoadToken = 0;
let usedGifIds = new Set();

document.querySelector('#startButton').addEventListener('click', startGame);
document.querySelector('#replayButton').addEventListener('click', replayGame);
finalChoiceGrid.addEventListener('click', handleFinalChoice);

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
  finalLocked = false;
  answers = {};
  currentProfile = undefined;
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
  currentProfile = buildProfile();
  personalityTelemetry.recordProfile(currentProfile.codes);
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
    onReady: () => schedule(showRescue, 2200)
  });
}

function showRescue() {
  gifLoadToken += 1;
  stopGif(prankGifFrame, prankGifElement, prankFallback);
  mascotProp.textContent = '⚠️';
  setMascotPose('freeze', 1800);
  showScreen('rescueScreen', 'rescue', 'coral');
  schedule(showRealTwist, 1700);
}

function showRealTwist() {
  mascotProp.textContent = '🗂️';
  setMascotPose('inspect', 2900);
  showScreen('realTwistScreen', 'real-twist', 'violet');
  schedule(showMissionBuild, 2800);
}

function showMissionBuild() {
  mascotProp.textContent = '🔐';
  setMascotPose('nod', 4400);
  missionBuildDots.forEach((dot) => dot.classList.remove('active'));
  showScreen('missionBuildScreen', 'mission-build', 'blue');
  currentProfile.trailer.forEach((step, index) => {
    schedule(() => renderMissionStep(step, index), index * 1400);
  });
  schedule(showRealResult, currentProfile.trailer.length * 1400 + 500);
}

function renderMissionStep(step, index) {
  missionPreviewCard.classList.remove('changing');
  void missionPreviewCard.offsetWidth;
  missionPreviewCard.classList.add('changing');
  missionPreviewIcon.textContent = step.icon;
  missionPreviewLabel.textContent = step.label;
  missionPreviewText.textContent = step.text;
  missionBuildDots.forEach((dot, dotIndex) => {
    dot.classList.toggle('active', dotIndex <= index);
  });
}

function selectedChoice(questionId) {
  const question = questionById.get(questionId);
  return question.choices.find((choice) => choice.id === answers[questionId]);
}

function scoreFor(questionId) {
  return selectedChoice(questionId)?.score ?? 0;
}

function missionTitleFor(planStyle, adventureSetting) {
  const titles = {
    structured: {
      novelty_first: 'The Prepared Explorer',
      comfort_first: 'The Comfort Architect',
      context_first: 'The Thoughtful Planner'
    },
    improvised: {
      novelty_first: 'The Spontaneous Explorer',
      comfort_first: 'The Easygoing Favorite-Finder',
      context_first: 'The In-the-Moment Detective'
    },
    adaptive: {
      novelty_first: 'The Flexible Adventurer',
      comfort_first: 'The Calm Choice-Maker',
      context_first: 'The Curious Navigator'
    }
  };
  return titles[planStyle][adventureSetting];
}

function buildTrailer(codes) {
  const setting = {
    people_powered: 'Good company belongs in the plan.',
    close_circle: 'A familiar person makes a new place easier.',
    quiet_recharger: 'Leave room for peace and a quiet reset.',
    balanced: 'Mix good company with enough quiet space.'
  }[codes.socialRhythm];
  const adventure = {
    novelty_first: 'Add something new.',
    comfort_first: 'Keep one trusted favorite.',
    context_first: 'Give the useful details first.'
  }[codes.adventureSetting];
  const pace = {
    structured: 'Use a clear plan and keep a backup ready.',
    improvised: 'Keep the schedule open and choose in the moment.',
    adaptive: 'Choose one starting point, then stay flexible.'
  }[codes.planStyle];
  const surprise = {
    full_mystery: 'Keep the details secret.',
    one_clue: 'Give exactly one clue.',
    co_created: 'Plan it together.'
  }[codes.surpriseStyle];
  const care = {
    listener: 'If support is needed, listen first.',
    problem_solver: 'If support is needed, practical help matters.',
    ask_first: 'If support is needed, ask what would help.'
  }[codes.careLanguage];

  return [
    { icon: '📍', label: 'The setting', text: `${setting} ${adventure}` },
    { icon: '⏱️', label: 'The pace', text: pace },
    { icon: '🔐', label: 'The secret rules', text: `${surprise} ${care}` }
  ];
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
  const codes = { socialRhythm, planStyle, adventureSetting, careLanguage, surpriseStyle };

  return {
    codes,
    title: missionTitleFor(planStyle, adventureSetting),
    trailer: buildTrailer(codes),
    cards: [
      {
        label: 'People and energy', icon: '🔋',
        text: `${selectedChoice('unknown_gathering').summary} ${selectedChoice('recovery_style').summary}`
      },
      {
        label: 'Plan and pace', icon: '🗺️',
        text: `${selectedChoice('free_day').summary} ${selectedChoice('plan_breaks').summary}`
      },
      {
        label: 'New experiences', icon: '🎭',
        text: `${selectedChoice('menu_novelty').summary} ${selectedChoice('mystery_activity').summary}`
      },
      {
        label: 'Support rules', icon: '💛',
        text: `${selectedChoice('friend_bad_day').summary} ${selectedChoice('own_bad_day').summary}`
      },
      {
        label: 'Surprises and celebration', icon: '🎁',
        text: `${selectedChoice('surprise_planning').summary} ${selectedChoice('celebration_style').summary}`
      }
    ],
    extras: [
      `Raccoon rule: ${selectedChoice('raccoon_snack').label.toLowerCase()}.`,
      `Talking-fridge rule: ${selectedChoice('talking_fridge').label.toLowerCase()}.`
    ]
  };
}

function showRealResult() {
  const profile = currentProfile ?? buildProfile();
  blueprintGrid.replaceChildren();
  missionArchetype.textContent = profile.title;

  profile.cards.forEach((card, index) => {
    const article = document.createElement('article');
    article.className = 'blueprint-card';
    article.style.setProperty('--card-index', String(index));

    const heading = document.createElement('div');
    heading.className = 'blueprint-heading';
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = card.icon;
    const label = document.createElement('strong');
    label.textContent = card.label;
    heading.append(icon, label);

    const description = document.createElement('p');
    description.textContent = card.text;
    article.append(heading, description);
    blueprintGrid.append(article);
  });

  absurdNotes.replaceChildren();
  profile.extras.forEach((note) => {
    const span = document.createElement('span');
    span.textContent = note;
    absurdNotes.append(span);
  });

  finalLocked = false;
  [...finalChoiceGrid.querySelectorAll('button')].forEach((button) => {
    button.disabled = false;
  });
  mascotProp.textContent = '🔓';
  setMascotPose('inspect');
  showScreen('resultScreen', 'result', 'teal');
}

function handleFinalChoice(event) {
  const button = event.target.closest('[data-response]');
  if (!button || finalLocked) return;
  finalLocked = true;
  const response = button.dataset.response;
  [...finalChoiceGrid.querySelectorAll('button')].forEach((choiceButton) => {
    choiceButton.disabled = true;
  });
  personalityTelemetry.completeRun(response);
  showEnding(response);
}

function showEnding(response) {
  const endings = {
    use_settings: {
      eyebrow: 'Mission approved',
      title: 'Mission accepted! ✨',
      message: 'Your classified file can now become a real plan for a day that fits you.',
      joke: 'The raccoon has requested a clipboard. This feels unnecessarily official.',
      theme: 'gold',
      prop: '📋',
      confetti: true
    },
    show_idea: {
      eyebrow: 'Preview requested',
      title: 'Preview unlocked 🔎',
      message: 'Useful details first, surprise second. That is a very reasonable mission rule.',
      joke: 'The raccoon is preparing exactly one clue and trying very hard not to spoil it.',
      theme: 'blue',
      prop: '🔎',
      confetti: true
    },
    not_now: {
      eyebrow: 'Mission saved',
      title: 'Saved for later 🙂',
      message: 'No pressure. Your classified file will stay safely here for another day.',
      joke: 'The raccoon put it in the secure drawer beside the snacks.',
      theme: 'green',
      prop: '🗂️',
      confetti: false
    }
  };

  const ending = endings[response];
  progressHeader.hidden = true;
  endingEyebrow.textContent = ending.eyebrow;
  endingTitle.textContent = ending.title;
  endingMessage.textContent = ending.message;
  endingJoke.textContent = ending.joke;
  mascotProp.textContent = ending.prop;
  setMascotPose(ending.confetti ? 'celebrate' : 'nod', 2600);
  showScreen('endingScreen', 'ending', ending.theme);
  if (ending.confetti) launchConfetti();
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
