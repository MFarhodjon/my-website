import { personalityTelemetry } from './personality-tracker.js';

const REACTION_MS = 3000;
const GIF_LOAD_TIMEOUT_MS = 2500;

const memeGifs = {
  sideEye: {
    id: 'H5C8CevNMbpBqNqFjl',
    page: 'https://giphy.com/gifs/H5C8CevNMbpBqNqFjl'
  },
  blinking: {
    id: 'l3q2K5jinAlChoCLS',
    page: 'https://giphy.com/gifs/mashable-l3q2K5jinAlChoCLS'
  },
  awkward: {
    id: 'ud8UQU45RI3mDwlkFI',
    page: 'https://giphy.com/gifs/when-you-have-to-smile-dont-know-how-react-kinda-friendly-ud8UQU45RI3mDwlkFI'
  },
  celebration: {
    id: 'sVnKj2wDhUTsFKFWhx',
    page: 'https://giphy.com/gifs/theoffice-sVnKj2wDhUTsFKFWhx'
  },
  dance: {
    id: '4mWrik7xIjsNDStrnl',
    page: 'https://giphy.com/gifs/muppetwiki-shimmy-muppets-from-space-4mWrik7xIjsNDStrnl'
  },
  facepalm: {
    id: 'xT1XGvQsbTq3JRF7YQ',
    page: 'https://giphy.com/gifs/originals-reaction-xT1XGvQsbTq3JRF7YQ'
  },
  mindBlown: {
    id: 'l4FGvUYI0tETAQwGk',
    page: 'https://giphy.com/gifs/debbyryan-debby-ryan-l4FGvUYI0tETAQwGk'
  },
  ohMyGod: {
    id: 'MZocLC5dJprPTcrm65',
    page: 'https://giphy.com/gifs/theoffice-MZocLC5dJprPTcrm65'
  },
  slowClap: {
    id: 'l378o7dYnoHlgH4ha',
    page: 'https://giphy.com/gifs/nba-l378o7dYnoHlgH4ha'
  },
  surprised: {
    id: 'O1fADjyIaQeu7tEUuU',
    page: 'https://giphy.com/gifs/iamcatali-reaction-i-did-not-see-that-coming-love-a-plot-twist-O1fADjyIaQeu7tEUuU'
  },
  approval: {
    id: 'KffdTQfewxdbKTGEJY',
    page: 'https://giphy.com/gifs/yes-jum-charlottekhm-KffdTQfewxdbKTGEJY'
  },
  supportNod: {
    id: 'tthQVoLHhoXGks5niy',
    page: 'https://giphy.com/gifs/NetflixKorea-netflix-netflixkr-netflixkorea-tthQVoLHhoXGks5niy'
  },
  problemSolved: {
    id: '5z0cCCGooBQUtejM4v',
    page: 'https://giphy.com/gifs/thedailyshow-funny-reaction-5z0cCCGooBQUtejM4v'
  },
  angryMonkey: {
    id: 'l0HlGd1H6XkdlfjZS',
    page: 'https://giphy.com/gifs/pgtips-l0HlGd1H6XkdlfjZS'
  }
};

const questions = [
  {
    id: 'unknown_gathering',
    theme: 'violet',
    icon: '👋',
    prompt: 'You arrive at a gathering knowing one person. You usually…',
    choices: [
      {
        id: 'meet_people', label: 'Start meeting people', icon: '👋', gif: 'celebration', pose: 'bounce',
        reaction: 'Side quest unlocked: new human.', score: 1,
        summary: 'You can start meeting people without needing a long runway.'
      },
      {
        id: 'trusted_person', label: 'Settle in with my person', icon: '🤝', gif: 'approval', pose: 'nod',
        reaction: 'Trusted-human mode activated.', score: 0,
        summary: 'A familiar person makes a new room feel easier.'
      },
      {
        id: 'warm_up', label: 'Warm up, then decide', icon: '👀', gif: 'sideEye', pose: 'inspect',
        reaction: 'Vibe scan in progress.', score: -1,
        summary: 'You prefer to read the room before choosing your lane.'
      }
    ]
  },
  {
    id: 'free_day',
    theme: 'teal',
    icon: '☀️',
    prompt: 'A completely free Saturday appears. You…',
    choices: [
      {
        id: 'plan_day', label: 'Plan the day out', icon: '🗓️', gif: 'slowClap', pose: 'nod',
        reaction: 'The itinerary has entered the chat.', score: 1,
        summary: 'A loose structure helps a free day feel satisfying.'
      },
      {
        id: 'follow_vibes', label: 'See where it goes', icon: '🌊', gif: 'dance', pose: 'bounce',
        reaction: 'Plot optional. Vibes essential.', score: -1,
        summary: 'You enjoy leaving room for the day to surprise you.'
      },
      {
        id: 'one_anchor', label: 'Choose one thing, then improvise', icon: '📍', gif: 'approval', pose: 'wiggle',
        reaction: 'One anchor. Maximum freedom.', score: 0,
        summary: 'One anchor is enough; the rest can stay flexible.'
      }
    ]
  },
  {
    id: 'friend_bad_day',
    theme: 'coral',
    icon: '💬',
    prompt: 'Someone you care about has a rough day. Your first instinct?',
    choices: [
      {
        id: 'listen', label: 'Listen and comfort them', icon: '💛', gif: 'supportNod', pose: 'nod',
        reaction: 'Emotional blanket deployed.',
        summary: 'When someone is struggling, your instinct is to listen and comfort.'
      },
      {
        id: 'solve', label: 'Help solve the problem', icon: '🧰', gif: 'problemSolved', pose: 'inspect',
        reaction: 'Tiny toolbox: opened.',
        summary: 'You often show care by helping make the problem lighter.'
      },
      {
        id: 'ask_need', label: 'Ask what they need', icon: '🎛️', gif: 'supportNod', pose: 'nod',
        reaction: 'Support settings: customized.',
        summary: 'You prefer to ask before deciding what kind of support will help.'
      }
    ]
  },
  {
    id: 'menu_novelty',
    theme: 'orange',
    icon: '🍜',
    prompt: 'The menu has your favorite and one strange new dish. You…',
    choices: [
      {
        id: 'try_new', label: 'Try the strange one', icon: '🥢', gif: 'surprised', pose: 'bounce',
        reaction: 'Taste-bud side quest accepted.', score: 1,
        summary: 'Novelty can win even when a safe favorite is available.'
      },
      {
        id: 'choose_favorite', label: 'Choose the favorite', icon: '🍝', gif: 'celebration', pose: 'nod',
        reaction: 'A classic never misses.', score: -1,
        summary: 'A proven favorite is valuable because you already know it delivers.'
      },
      {
        id: 'taste_first', label: 'Try one bite first', icon: '🥄', gif: 'sideEye', pose: 'inspect',
        reaction: 'Risk level: exactly one bite.', score: 0,
        summary: 'You like novelty with a small, sensible test run.'
      }
    ]
  },
  {
    id: 'surprise_planning',
    theme: 'blue',
    icon: '🎁',
    prompt: 'A surprise is being planned for you. Best version?',
    choices: [
      {
        id: 'no_spoilers', label: 'Tell me nothing', icon: '🙈', gif: 'ohMyGod', pose: 'bounce',
        reaction: 'Maximum mystery selected.',
        summary: 'A surprise is most fun when the mystery stays intact.'
      },
      {
        id: 'one_clue', label: 'Give me one clue', icon: '🔎', gif: 'blinking', pose: 'inspect',
        reaction: 'One clue. Sanity preserved.',
        summary: 'One clue gives you enough context without ruining the surprise.'
      },
      {
        id: 'help_plan', label: 'Let me help plan', icon: '🧭', gif: 'slowClap', pose: 'nod',
        reaction: 'Co-pilot privileges granted.',
        summary: 'Being included in the plan helps the experience feel right.'
      }
    ]
  },
  {
    id: 'raccoon_snack',
    theme: 'gold',
    icon: '🦝',
    silly: true,
    prompt: 'A raccoon steals your snack and maintains eye contact. You…',
    choices: [
      {
        id: 'negotiate', label: 'Negotiate for half', icon: '🤝', gif: 'sideEye', pose: 'inspect',
        reaction: 'Alley diplomacy begins.'
      },
      {
        id: 'formal_trial', label: 'Demand a formal trial', icon: '⚖️', gif: 'angryMonkey', pose: 'wiggle',
        reaction: 'Snack court is now in session.'
      },
      {
        id: 'accept_management', label: 'Accept the new management', icon: '👔', gif: 'awkward', pose: 'nod',
        reaction: 'Peaceful transfer of snacks.'
      }
    ]
  },
  {
    id: 'recovery_style',
    theme: 'green',
    icon: '🔋',
    prompt: 'After a packed week, what restores you fastest?',
    choices: [
      {
        id: 'favorite_people', label: 'Time with favorite people', icon: '🎉', gif: 'dance', pose: 'bounce',
        reaction: 'People-powered battery.', score: 1,
        summary: 'Favorite people can help refill your energy.'
      },
      {
        id: 'quiet_alone', label: 'Quiet time alone', icon: '🛋️', gif: 'approval', pose: 'freeze',
        reaction: 'Recovery cave activated.', score: -1,
        summary: 'Quiet time alone is your fastest reset after a full week.'
      },
      {
        id: 'both', label: 'A little of both', icon: '🔋', gif: 'celebration', pose: 'wiggle',
        reaction: 'Hybrid charging enabled.', score: 0,
        summary: 'You recharge best with a careful mix of people and peace.'
      }
    ]
  },
  {
    id: 'plan_breaks',
    theme: 'blue',
    icon: '🗺️',
    prompt: 'Your plan falls apart at the last minute. You usually…',
    choices: [
      {
        id: 'replan', label: 'Make a new plan', icon: '🗺️', gif: 'problemSolved', pose: 'inspect',
        reaction: 'Backup map deployed.', score: 1,
        summary: 'When plans break, rebuilding a clear route helps.'
      },
      {
        id: 'improvise', label: 'Improvise from there', icon: '🎷', gif: 'dance', pose: 'bounce',
        reaction: 'Jazz mode activated.', score: -1,
        summary: 'When plans break, you can turn the detour into the plan.'
      },
      {
        id: 'pause_then_choose', label: 'Take a beat, then choose', icon: '⏸️', gif: 'blinking', pose: 'freeze',
        reaction: 'Strategic buffering…', score: 0,
        summary: 'A short reset helps you adapt without rushing.'
      }
    ]
  },
  {
    id: 'own_bad_day',
    theme: 'coral',
    icon: '🌧️',
    prompt: 'You are having a hard day. What helps most?',
    choices: [
      {
        id: 'talk_it_through', label: 'Talk it through', icon: '💬', gif: 'supportNod', pose: 'nod',
        reaction: 'Words are doing the lifting.',
        summary: 'On a hard day, talking helps you process what happened.'
      },
      {
        id: 'space_first', label: 'Have space first', icon: '🌙', gif: 'sideEye', pose: 'freeze',
        reaction: 'Space bubble protected.',
        summary: 'On a hard day, space first gives you room to reset.'
      },
      {
        id: 'quiet_company', label: 'Quiet company, no fixing', icon: '☕', gif: 'supportNod', pose: 'nod',
        reaction: 'Silent teammate unlocked.',
        summary: 'On a hard day, steady company can matter more than advice.'
      }
    ]
  },
  {
    id: 'mystery_activity',
    theme: 'violet',
    icon: '🎭',
    prompt: 'A trusted friend suggests a mystery activity. You…',
    choices: [
      {
        id: 'no_details', label: 'I’m in—no details', icon: '🎭', gif: 'ohMyGod', pose: 'bounce',
        reaction: 'Mystery mode: engaged.', score: 1,
        summary: 'With someone you trust, you can enjoy going in without details.'
      },
      {
        id: 'need_basics', label: 'Give me the basics', icon: '🧾', gif: 'blinking', pose: 'inspect',
        reaction: 'Context first. Then chaos.', score: 0,
        summary: 'A few useful basics make something new much easier to enjoy.'
      },
      {
        id: 'depends_day', label: 'Depends on the day', icon: '🌤️', gif: 'sideEye', pose: 'wiggle',
        reaction: 'Today’s vibe gets a vote.', score: -1,
        summary: 'Your appetite for novelty depends on your energy and the moment.'
      }
    ]
  },
  {
    id: 'talking_fridge',
    theme: 'teal',
    icon: '🧊',
    silly: true,
    prompt: 'Your refrigerator starts giving life advice. You…',
    choices: [
      {
        id: 'hear_out', label: 'Hear it out', icon: '👂', gif: 'blinking', pose: 'inspect',
        reaction: 'Cold wisdom detected.'
      },
      {
        id: 'unplug', label: 'Unplug the philosopher', icon: '🔌', gif: 'facepalm', pose: 'wiggle',
        reaction: 'Boundary: established.'
      },
      {
        id: 'ask_lottery', label: 'Ask for lottery numbers', icon: '🔮', gif: 'mindBlown', pose: 'bounce',
        reaction: 'Finally, the important question.'
      }
    ]
  },
  {
    id: 'celebration_style',
    theme: 'gold',
    icon: '🎉',
    prompt: 'Someone wants to celebrate you. What lands best?',
    choices: [
      {
        id: 'little_fuss', label: 'Make a little fuss', icon: '🎉', gif: 'celebration', pose: 'celebrate',
        reaction: 'Tiny confetti cannon!',
        summary: 'A warm little celebration makes the moment feel real.'
      },
      {
        id: 'private_words', label: 'Say it privately', icon: '💌', gif: 'approval', pose: 'nod',
        reaction: 'Private words. Big impact.',
        summary: 'Private, thoughtful words can mean more than a public fuss.'
      },
      {
        id: 'simple_time', label: 'Spend simple time together', icon: '🫖', gif: 'supportNod', pose: 'wiggle',
        reaction: 'Presence says plenty.',
        summary: 'Simple time together is a celebration all by itself.'
      }
    ]
  }
];

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
const reactionGif = document.querySelector('#reactionGif');
const gifCredit = document.querySelector('#gifCredit');
const reactionTimerBar = document.querySelector('#reactionTimerBar');
const fakeResultTitle = document.querySelector('#fakeResultTitle');
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
let timers = new Set();
let poseTimer;
let reactionToken = 0;

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

function clearTimers() {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  window.clearTimeout(poseTimer);
  reactionToken += 1;
  reactionGif.onload = null;
  reactionGif.src = 'about:blank';
  reactionGifFrame.classList.remove('is-loading');
  reactionGifFrame.setAttribute('aria-busy', 'false');
}

function showScreen(screenId, view, theme = document.body.dataset.theme) {
  screens.forEach((screen) => {
    screen.hidden = screen.id !== screenId;
  });
  game.dataset.view = view;
  document.body.dataset.theme = theme;

  const active = document.querySelector(`#${screenId}`);
  const heading = active?.querySelector('h1, h2');
  if (heading) {
    requestAnimationFrame(() => heading.focus({ preventScroll: true }));
  }
  if (screenId !== 'resultScreen') {
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }
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

function startGame() {
  clearTimers();
  currentQuestion = 0;
  answerLocked = false;
  finalLocked = false;
  answers = {};
  collectedIcons.replaceChildren();
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
  progressStatus.textContent = question.silly ? 'Critical nonsense' : currentQuestion < 6 ? 'Instinct check' : 'Raccoon audit';
  progressTrack.setAttribute('aria-valuenow', String(currentQuestion + 1));
  progressBar.style.width = `${((currentQuestion + 1) / questions.length) * 100}%`;
  questionEyebrow.textContent = question.silly ? 'Important legal question' : `Instinct choice ${currentQuestion + 1}`;
  questionTitle.textContent = question.prompt;
  questionHint.textContent = question.silly
    ? 'The legal department insisted we ask.'
    : 'Go with your first honest answer.';
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
  const gif = memeGifs[choice.gif];
  const token = ++reactionToken;
  let countdownStarted = false;
  let fallbackTimer;
  reactionEyebrow.textContent = question.silly ? 'Peer-reviewed nonsense' : 'Extremely serious observation';
  reactionTitle.textContent = choice.reaction;
  reactionGif.title = `${choice.reaction} reaction GIF`;
  gifCredit.href = gif.page;
  mascotProp.textContent = choice.icon;
  reactionGifFrame.classList.add('is-loading');
  reactionGifFrame.setAttribute('aria-busy', 'true');
  showScreen('reactionScreen', 'reaction', question.theme);

  reactionTimerBar.classList.remove('running');

  const beginCountdown = () => {
    if (countdownStarted || token !== reactionToken) return;
    countdownStarted = true;
    reactionGif.onload = null;
    window.clearTimeout(fallbackTimer);
    timers.delete(fallbackTimer);
    reactionGifFrame.classList.remove('is-loading');
    reactionGifFrame.setAttribute('aria-busy', 'false');
    void reactionTimerBar.offsetWidth;
    reactionTimerBar.classList.add('running');

    schedule(() => {
      reactionGif.src = 'about:blank';
      if (currentQuestion === questions.length - 1) {
        beginAnalysis();
        return;
      }
      currentQuestion += 1;
      renderQuestion();
    }, REACTION_MS);
  };

  reactionGif.onload = beginCountdown;
  reactionGif.src = `https://giphy.com/embed/${gif.id}`;
  fallbackTimer = schedule(beginCountdown, GIF_LOAD_TIMEOUT_MS);
}

function beginAnalysis() {
  progressHeader.hidden = true;
  mascotProp.textContent = '🧪';
  setMascotPose('inspect', 3200);
  showScreen('analysisScreen', 'analysis', 'violet');

  const profile = buildProfile().codes;
  personalityTelemetry.recordProfile(profile);

  const analysisSteps = [...document.querySelectorAll('[data-analysis-step]')];
  analysisSteps.forEach((step) => step.classList.remove('done'));
  analysisSteps.forEach((step, index) => {
    schedule(() => step.classList.add('done'), 450 + index * 720);
  });
  schedule(showFakeResult, 3100);
}

function showFakeResult() {
  mascotProp.textContent = '📜';
  fakeResultTitle.textContent = buildFakeTitle();
  setMascotPose('nod', 2100);
  showScreen('fakeResultScreen', 'fake-result', 'gold');
  schedule(showTwist, 2650);
}

function buildFakeTitle() {
  const prefix = {
    plan_day: 'The Prepared',
    follow_vibes: 'The Spontaneous',
    one_anchor: 'The Strategically Flexible'
  }[answers.free_day] ?? 'The Thoughtful';
  const title = {
    try_new: 'Side-Quest Goblin',
    choose_favorite: 'Comfort Connoisseur',
    taste_first: 'Cautious Taste Tester'
  }[answers.menu_novelty] ?? 'Vibe Analyst';
  return `${prefix} ${title}`;
}

function showTwist() {
  mascotProp.textContent = '📄';
  setMascotPose('steal', 1950);
  showScreen('twistScreen', 'twist', 'coral');
  schedule(showRealResult, 2350);
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

  return {
    codes: { socialRhythm, planStyle, adventureSetting, careLanguage, surpriseStyle },
    cards: [
      {
        label: 'Social rhythm', icon: '🔋',
        text: `${selectedChoice('unknown_gathering').summary} ${selectedChoice('recovery_style').summary}`
      },
      {
        label: 'Plan style', icon: '🗺️',
        text: `${selectedChoice('free_day').summary} ${selectedChoice('plan_breaks').summary}`
      },
      {
        label: 'Adventure setting', icon: '🎭',
        text: `${selectedChoice('menu_novelty').summary} ${selectedChoice('mystery_activity').summary}`
      },
      {
        label: 'Care language', icon: '💛',
        text: `${selectedChoice('friend_bad_day').summary} ${selectedChoice('own_bad_day').summary}`
      },
      {
        label: 'Surprise style', icon: '🎁',
        text: `${selectedChoice('surprise_planning').summary} ${selectedChoice('celebration_style').summary}`
      }
    ],
    extras: [
      `Raccoon policy: ${selectedChoice('raccoon_snack').label.toLowerCase()}`,
      `Refrigerator protocol: ${selectedChoice('talking_fridge').label.toLowerCase()}`
    ]
  };
}

function showRealResult() {
  const profile = buildProfile();
  blueprintGrid.replaceChildren();

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
      eyebrow: 'Blueprint accepted',
      title: 'Settings saved! 🎉',
      message: 'Mystery approved. The blueprint may now leave the screen.',
      joke: 'The raccoon has entered planning mode. It has enthusiasm and absolutely no qualifications.',
      theme: 'gold',
      prop: '🎉',
      confetti: true
    },
    show_idea: {
      eyebrow: 'Preview requested',
      title: 'One clue first 🔎',
      message: 'Perfect—mystery level lowered from 100% to comfortably suspicious.',
      joke: 'The raccoon is preparing a presentation with one slide and too many transitions.',
      theme: 'blue',
      prop: '🔎',
      confetti: true
    },
    not_now: {
      eyebrow: 'Answer respected',
      title: 'Not right now 🙂',
      message: 'Absolutely fair. The blueprint stays safely on the page with no pressure attached.',
      joke: 'The raccoon has filed it under “maybe someday” and returned the snacks.',
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
