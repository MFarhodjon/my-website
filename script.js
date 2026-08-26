import { quizTelemetry } from './firebase-tracker.js';

const quizData = [
  {
    id: 'travel',
    prompt: 'Do you like traveling?',
    icon: '✈️',
    theme: 'sky',
    yes: {
      reaction: 'Passport energy detected. Your bank account just pretended not to hear that.',
      sticker: '✈️',
      face: '•̀ᴗ•́',
      visual: ['✈️', '💸'],
      effect: 'fly'
    },
    no: {
      reaction: 'Home has snacks, Wi-Fi, and no gate changes. Honestly, elite.',
      sticker: '🛋️',
      face: '•ᴗ•',
      visual: ['🛋️', '📶'],
      effect: 'couch'
    }
  },
  {
    id: 'nature',
    prompt: 'Do you enjoy trips into nature?',
    icon: '🌿',
    theme: 'nature',
    yes: {
      reaction: 'Perfect. The mosquitoes have already sent you a friend request.',
      sticker: '🌲',
      face: '•̀ᴗ•́',
      visual: ['🌲', '🦟'],
      effect: 'buzz'
    },
    no: {
      reaction: 'Fair. Trees are beautiful, but none of them know the Wi-Fi password.',
      sticker: '📶',
      face: '•ᴗ•',
      visual: ['🌲', '📵'],
      effect: 'offline'
    }
  },
  {
    id: 'cities',
    prompt: 'Do you like exploring new cities?',
    icon: '🏙️',
    theme: 'city',
    yes: {
      reaction: 'Excellent. 18,000 steps, one tiny coffee, and somehow a great day.',
      sticker: '🏙️',
      face: '•̀ᴗ•́',
      visual: ['☕', '👟'],
      effect: 'city'
    },
    no: {
      reaction: 'Crowds avoided. Social battery still at 100%. Genius.',
      sticker: '🔋',
      face: '•ᴗ•',
      visual: ['🔋', '😌'],
      effect: 'battery'
    }
  },
  {
    id: 'food',
    prompt: 'Do you enjoy trying new food?',
    icon: '🍜',
    theme: 'food',
    yes: {
      reaction: 'The mystery sauce respects your courage. The chef gives you a dramatic nod.',
      sticker: '🍜',
      face: '•̀ᴗ•́',
      visual: ['🍜', '👨‍🍳'],
      effect: 'chef'
    },
    no: {
      reaction: 'Fries have never betrayed anyone. Loyalty matters.',
      sticker: '🍟',
      face: '•ᴗ•',
      visual: ['🍟', '🤝'],
      effect: 'fries'
    }
  },
  {
    id: 'spontaneous',
    prompt: 'Do you like spontaneous adventures?',
    icon: '🎒',
    theme: 'adventure',
    yes: {
      reaction: 'Bag packed. Destination unknown. Future-you is surprisingly confident.',
      sticker: '⚡',
      face: '•̀ᴗ•́',
      visual: ['🎒', '🗺️'],
      effect: 'backpack'
    },
    no: {
      reaction: "Your calendar requests 3–5 business days' notice—and a color-coded plan.",
      sticker: '📅',
      face: '•ᴗ•',
      visual: ['📅', '✅'],
      effect: 'calendar'
    }
  }
];

const screens = [...document.querySelectorAll('.screen')];
const app = document.querySelector('#app');
const progressHeader = document.querySelector('#progressHeader');
const progressLabel = document.querySelector('#progressLabel');
const progressStatus = document.querySelector('#progressStatus');
const progressTrack = document.querySelector('#progressTrack');
const progressBar = document.querySelector('#progressBar');
const sceneIcon = document.querySelector('#sceneIcon');
const suitcase = document.querySelector('#suitcase');
const suitcaseFace = document.querySelector('#suitcaseFace');
const stickers = [...document.querySelectorAll('.case-sticker')];
const questionEyebrow = document.querySelector('#questionEyebrow');
const questionTitle = document.querySelector('#questionTitle');
const reaction = document.querySelector('#reaction');
const reactionVisual = document.querySelector('#reactionVisual');
const reactionIconMain = document.querySelector('#reactionIconMain');
const reactionIconSide = document.querySelector('#reactionIconSide');
const answerReactionTitle = document.querySelector('#answerReactionTitle');
const reactionCountdown = document.querySelector('#reactionCountdown');
const yesButton = document.querySelector('#yesButton');
const noButton = document.querySelector('#noButton');
const endingEyebrow = document.querySelector('#endingEyebrow');
const endingTitle = document.querySelector('#endingTitle');
const endingMessage = document.querySelector('#endingMessage');
const endingJoke = document.querySelector('#endingJoke');
const confetti = document.querySelector('#confetti');
const finalReaction = document.querySelector('#finalReaction');
const finalYesButton = document.querySelector('#finalYesButton');
const finalNoButton = document.querySelector('#finalNoButton');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let currentQuestion = 0;
let answerLocked = false;
let endingChosen = false;
let finalNoClicks = 0;
let advanceTimer;
let confettiTimer;

document.querySelector('#startButton').addEventListener('click', startQuiz);
yesButton.addEventListener('click', () => answerQuestion(true));
noButton.addEventListener('click', () => answerQuestion(false));
finalYesButton.addEventListener('click', () => showEnding(true));
finalNoButton.addEventListener('click', handleFinalNo);
document.querySelector('#replayButton').addEventListener('click', resetExperience);

function startQuiz() {
  currentQuestion = 0;
  answerLocked = false;
  endingChosen = false;
  finalNoClicks = 0;
  stickers.forEach((sticker) => {
    sticker.textContent = '';
    sticker.classList.remove('earned');
  });
  quizTelemetry.beginRun();
  renderQuestion();
}

function renderQuestion() {
  const current = quizData[currentQuestion];
  answerLocked = false;
  showScreen('quizScreen', current.theme, 'quiz');
  progressHeader.hidden = false;
  progressLabel.textContent = `Question ${currentQuestion + 1} of ${quizData.length}`;
  progressStatus.textContent = currentQuestion < 3 ? 'Good-mood check' : 'Almost there';
  progressTrack.setAttribute('aria-valuenow', String(currentQuestion + 1));
  progressBar.style.width = `${((currentQuestion + 1) / quizData.length) * 100}%`;
  questionEyebrow.textContent = `Tiny choice ${currentQuestion + 1}`;
  questionTitle.textContent = current.prompt;
  reaction.textContent = 'Pick one. The suitcase is taking notes.';
  reaction.classList.remove('punchline');
  sceneIcon.textContent = current.icon;
  suitcaseFace.textContent = '•ᴗ•';
  yesButton.disabled = false;
  noButton.disabled = false;
  yesButton.classList.remove('chosen');
  noButton.classList.remove('chosen');
}

function answerQuestion(answerIsYes) {
  if (answerLocked) return;
  answerLocked = true;

  const current = quizData[currentQuestion];
  const selected = answerIsYes ? current.yes : current.no;
  const selectedButton = answerIsYes ? yesButton : noButton;
  quizTelemetry.recordAnswer(current.id, answerIsYes ? 'yes' : 'no');
  yesButton.disabled = true;
  noButton.disabled = true;
  selectedButton.classList.add('chosen');
  reaction.textContent = selected.reaction;
  reaction.classList.add('punchline');
  suitcaseFace.textContent = selected.face;
  awardSticker(currentQuestion, selected.sticker);
  animateSuitcase();
  showAnswerReaction(selected, current.theme);

  window.clearTimeout(advanceTimer);
  const readingTime = 3600;
  advanceTimer = window.setTimeout(() => {
    if (currentQuestion === quizData.length - 1) {
      showLastQuestionIntro();
    } else {
      currentQuestion += 1;
      renderQuestion();
    }
  }, readingTime);
}

function showAnswerReaction(selected, theme) {
  reactionIconMain.textContent = selected.visual[0];
  reactionIconSide.textContent = selected.visual[1];
  reactionVisual.dataset.effect = selected.effect;
  answerReactionTitle.textContent = selected.reaction;
  sceneIcon.textContent = selected.visual[0];
  showScreen('answerReactionScreen', theme, 'reaction');
  reactionCountdown.classList.remove('running');
  void reactionCountdown.offsetWidth;
  reactionCountdown.classList.add('running');
}

function showLastQuestionIntro() {
  progressHeader.hidden = true;
  sceneIcon.textContent = '⏳';
  suitcaseFace.textContent = '•o•';
  showScreen('lastQuestionScreen', 'final', 'final');
  window.clearTimeout(advanceTimer);
  advanceTimer = window.setTimeout(showFinalQuestion, 1800);
}

function showFinalQuestion() {
  progressHeader.hidden = true;
  endingChosen = false;
  finalNoClicks = 0;
  finalReaction.textContent = 'Choose carefully. The suitcase has opinions.';
  finalYesButton.style.transform = '';
  finalNoButton.style.transform = '';
  finalNoButton.textContent = 'No, but nice try 😄';
  sceneIcon.textContent = '💌';
  suitcaseFace.textContent = '•ᴗ•';
  showScreen('finalScreen', 'final', 'final');
}

function handleFinalNo() {
  if (endingChosen) return;

  const funnyReactions = [
    ['That was suspiciously fast. The suitcase requests a recount. 🧳', '🤨'],
    ['The scientists checked. Apparently Yes is still available. 👀', '🔬'],
    ['Okay, final joke. Your real answer wins. 😄', '😅']
  ];

  finalNoClicks += 1;

  if (finalNoClicks > funnyReactions.length) {
    showEnding(false);
    return;
  }

  quizTelemetry.recordFinalNoAttempt(finalNoClicks);
  const [message, icon] = funnyReactions[finalNoClicks - 1];
  finalReaction.textContent = message;
  sceneIcon.textContent = icon;
  suitcaseFace.textContent = finalNoClicks === 1 ? '•o•' : finalNoClicks === 2 ? '•̀_•́' : '•ᴗ•';
  animateSuitcase();

  const mobile = window.matchMedia('(max-width: 600px)').matches;
  const yesScale = Math.min(1 + finalNoClicks * (mobile ? 0.04 : 0.1), mobile ? 1.12 : 1.3);
  const noScale = Math.max(1 - finalNoClicks * 0.05, 0.85);
  finalYesButton.style.transform = `scale(${yesScale})`;
  finalNoButton.style.transform = `scale(${noScale})`;

  if (finalNoClicks === funnyReactions.length) {
    finalNoButton.textContent = 'No, honestly 🙂';
  }
}

function showEnding(answerIsYes) {
  if (endingChosen) return;
  endingChosen = true;
  progressHeader.hidden = true;
  quizTelemetry.completeRun({
    decision: answerIsYes ? 'yes' : 'no',
    finalNoAttempts: finalNoClicks,
    finalAttempts: answerIsYes ? finalNoClicks + 1 : finalNoClicks
  });

  if (answerIsYes) {
    endingEyebrow.textContent = 'Chance granted';
    endingTitle.textContent = 'Deal! 🎉';
    endingMessage.textContent = 'No pressure and no grand speech—just one small chance to make you smile.';
    endingJoke.textContent = 'The suitcase already packed. It packed one sock.';
    sceneIcon.textContent = '🎉';
    suitcaseFace.textContent = '♥ᴗ♥';
    suitcase.classList.add('celebrating');
    showScreen('endingScreen', 'result', 'ending');
    launchConfetti();
  } else {
    endingEyebrow.textContent = 'Fair enough';
    endingTitle.textContent = 'Answer accepted 🙂';
    endingMessage.textContent = 'No tricks, no runaway button, and absolutely no hard feelings.';
    endingJoke.textContent = 'The suitcase still gives you five stars for completing the test.';
    sceneIcon.textContent = '⭐';
    suitcaseFace.textContent = '•ᴗ•';
    showScreen('endingScreen', 'calm', 'ending');
  }
}

function resetExperience() {
  window.clearTimeout(advanceTimer);
  window.clearTimeout(confettiTimer);
  quizTelemetry.resetRun();
  currentQuestion = 0;
  answerLocked = false;
  endingChosen = false;
  finalNoClicks = 0;
  progressHeader.hidden = true;
  stickers.forEach((sticker) => {
    sticker.textContent = '';
    sticker.classList.remove('earned');
  });
  suitcase.classList.remove('reacting', 'celebrating');
  suitcaseFace.textContent = '•ᴗ•';
  sceneIcon.textContent = '✨';
  finalYesButton.style.transform = '';
  finalNoButton.style.transform = '';
  finalNoButton.textContent = 'No, but nice try 😄';
  confetti.replaceChildren();
  showScreen('startScreen', 'sky', 'start');
}

function showScreen(screenId, theme, view) {
  screens.forEach((screen) => { screen.hidden = screen.id !== screenId; });
  document.body.dataset.theme = theme;
  app.dataset.view = view;
  const heading = document.querySelector(`#${screenId} h1, #${screenId} h2`);
  requestAnimationFrame(() => heading?.focus({ preventScroll: true }));
}

function awardSticker(index, symbol) {
  const sticker = stickers[index];
  sticker.textContent = symbol;
  sticker.classList.remove('earned');
  void sticker.offsetWidth;
  sticker.classList.add('earned');
}

function animateSuitcase() {
  suitcase.classList.remove('reacting');
  void suitcase.offsetWidth;
  suitcase.classList.add('reacting');
  window.setTimeout(() => suitcase.classList.remove('reacting'), reducedMotion.matches ? 10 : 600);
}

function launchConfetti() {
  if (reducedMotion.matches) return;
  const colors = ['#2563eb', '#14b8a6', '#8b5cf6', '#f59e0b', '#f45b69'];

  for (let index = 0; index < 42; index += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.55}s`;
    piece.style.setProperty('--drift', `${Math.random() * 180 - 90}px`);
    confetti.appendChild(piece);
  }

  confettiTimer = window.setTimeout(() => confetti.replaceChildren(), 4300);
}
