import { quizTelemetry } from './firebase-tracker.js';

const quizData = [
  {
    id: 'travel',
    prompt: 'Sayohat qilishni yoqtirasanmi?',
    icon: '✈️',
    theme: 'sky',
    yes: {
      reaction: 'Pasport energiyasi aniqlandi. Bu yo\'lga chiqqanlik hissi to\'g\'ri kelmoqda.',
      sticker: '✈️',
      face: '•̀ᴗ•́',
      visual: ['✈️', '💸'],
      effect: 'fly'
    },
    no: {
      reaction: 'Uyda bo\'lish ehtimoli yanada qulayroq: Wi‑Fi, choy va parvoz eshigi yo\'q.',
      sticker: '🛋️',
      face: '•ᴗ•',
      visual: ['🛋️', '📶'],
      effect: 'couch'
    }
  },
  {
    id: 'nature',
    prompt: 'Tabiatga sayohat qilishni yoqtirasanmi?',
    icon: '🌿',
    theme: 'nature',
    yes: {
      reaction: 'Zo\'r. O\'rmonlar senga yaxshi niyat bilan qaraydi.',
      sticker: '🌲',
      face: '•̀ᴗ•́',
      visual: ['🌲', '🦟'],
      effect: 'buzz'
    },
    no: {
      reaction: 'Mantiqiy. Daraxtlar go\'zal, lekin ular ham Wi‑Fi simsiz ishlaydi.',
      sticker: '📶',
      face: '•ᴗ•',
      visual: ['🌲', '📵'],
      effect: 'offline'
    }
  },
  {
    id: 'cities',
    prompt: 'Yangi shaharlarni kezishni yoqtirasanmi?',
    icon: '🏙️',
    theme: 'city',
    yes: {
      reaction: 'Ajoyib. 18 ming qadam, bitta kofe va bir kunda yaxshi his.',
      sticker: '🏙️',
      face: '•̀ᴗ•́',
      visual: ['☕', '👟'],
      effect: 'city'
    },
    no: {
      reaction: 'Olomon senga mos kelmadi. O\'zingning qulay zonang hali ham 100%.',
      sticker: '🔋',
      face: '•ᴗ•',
      visual: ['🔋', '😌'],
      effect: 'battery'
    }
  },
  {
    id: 'food',
    prompt: 'Yangi taomlarni sinab ko\'rishni yoqtirasanmi?',
    icon: '🍜',
    theme: 'food',
    yes: {
      reaction: 'Maxfiy sousga hurmat. Oshpaz senga shunday qaraydi, xuddi filmda.',
      sticker: '🍜',
      face: '•̀ᴗ•́',
      visual: ['🍜', '👨‍🍳'],
      effect: 'chef'
    },
    no: {
      reaction: 'Frantsuz kartoshkasi hech kimga xiyonat qilmagan. Sadoqat muhim.',
      sticker: '🍟',
      face: '•ᴗ•',
      visual: ['🍟', '🤝'],
      effect: 'fries'
    }
  },
  {
    id: 'spontaneous',
    prompt: 'Kutilmagan sarguzashtlarni yoqtirasanmi?',
    icon: '🎒',
    theme: 'adventure',
    yes: {
      reaction: 'Sumka tayyor. Manzil noma\'lum. Kelajakdagi sen ajablanarli darajada ishonchli.',
      sticker: '⚡',
      face: '•̀ᴗ•́',
      visual: ['🎒', '🗺️'],
      effect: 'backpack'
    },
    no: {
      reaction: 'Jadvalingiz oldindan 3–5 kunlik reja va rangli maqsad talab qiladi.',
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
  progressLabel.textContent = `${currentQuestion + 1}-savol, ${quizData.length} tadan`;
  progressStatus.textContent = currentQuestion < 3 ? 'Kayfiyat tekshiruvi' : 'Deyarli tayyor';
  progressTrack.setAttribute('aria-valuenow', String(currentQuestion + 1));
  progressBar.style.width = `${((currentQuestion + 1) / quizData.length) * 100}%`;
  questionEyebrow.textContent = `Mayda tanlov ${currentQuestion + 1}`;
  questionTitle.textContent = current.prompt;
  reaction.textContent = 'Birini tanla. Sumka bularni yozib boryapti.';
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
  finalReaction.textContent = 'Ehtiyotkorlik bilan tanla. Sumkaning ham o\'z fikri bor.';
  finalYesButton.style.transform = '';
  finalNoButton.style.transform = '';
  finalNoButton.textContent = 'Yo\'q, lekin harakating yoqdi 😄';
  sceneIcon.textContent = '💌';
  suitcaseFace.textContent = '•ᴗ•';
  showScreen('finalScreen', 'final', 'final');
}

function handleFinalNo() {
  if (endingChosen) return;

  const funnyReactions = [
    ['Bu picha tez bo\'ldi. Sumka yana hisoblashni so\'ramoqda. 🧳', '🤨'],
    ['Olimlar tekshirib ko\'rishdi. "Ha" varianti hali ham mavjud ekan. 👀', '🔬'],
    ['Xo\'p, oxirgi hazil. Haqiqiy javobing g\'alaba qiladi. 😄', '😅']
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
    finalNoButton.textContent = 'Yo\'q, chindan ham 🙂';
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
    endingEyebrow.textContent = 'Imkoniyat berildi';
    endingTitle.textContent = 'Kelishdik! 🎉';
    endingMessage.textContent = 'Hech qanday bosim yo\'q, katta nutq ham yo\'q — faqat seni kuldirish uchun bitta kichik imkoniyat.';
    endingJoke.textContent = 'Sumka allaqachon yig\'ildi. Faqat bitta po\'stik bilan qo\'shildi.';
    sceneIcon.textContent = '🎉';
    suitcaseFace.textContent = '♥ᴗ♥';
    suitcase.classList.add('celebrating');
    showScreen('endingScreen', 'result', 'ending');
    launchConfetti();
  } else {
    endingEyebrow.textContent = 'Mayli, tushunarli';
    endingTitle.textContent = 'Javob qabul qilindi 🙂';
    endingMessage.textContent = 'Hech qanday hiyla yo\'q, qochib ketuvchi tugma yo\'q va hech qanday xafagarchilik yo\'q.';
    endingJoke.textContent = 'Sumka baribir senga testni tugatganing uchun besh yulduz qo\'yadi.';
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
  finalNoButton.textContent = 'Yo\'q, lekin harakating yoqdi 😄';
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
