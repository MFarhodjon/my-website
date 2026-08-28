import { appCheckSiteKey, firebaseConfig } from './firebase-config.js';

const FIREBASE_VERSION = '12.18.0';
const FIREBASE_APP_NAME = 'good-mood-quiz';
const COLLECTION_NAME = 'personalityRuns';
const GAME_VERSION = 'instinct-surprise-v2';
const REQUIRED_CONFIG = ['apiKey', 'authDomain', 'projectId', 'appId'];

const QUESTION_CHOICES = Object.freeze({
  unknown_gathering: ['meet_people', 'trusted_person', 'warm_up'],
  free_day: ['plan_day', 'follow_vibes', 'one_anchor'],
  friend_bad_day: ['listen', 'solve', 'ask_need'],
  menu_novelty: ['try_new', 'choose_favorite', 'taste_first'],
  surprise_planning: ['no_spoilers', 'one_clue', 'help_plan'],
  raccoon_snack: ['negotiate', 'formal_trial', 'accept_management'],
  recovery_style: ['favorite_people', 'quiet_alone', 'both'],
  plan_breaks: ['replan', 'improvise', 'pause_then_choose'],
  own_bad_day: ['talk_it_through', 'space_first', 'quiet_company'],
  mystery_activity: ['no_details', 'need_basics', 'depends_day'],
  talking_fridge: ['hear_out', 'unplug', 'ask_lottery'],
  celebration_style: ['little_fuss', 'private_words', 'simple_time']
});

const PROFILE_CHOICES = Object.freeze({
  socialRhythm: ['people_powered', 'close_circle', 'quiet_recharger', 'balanced'],
  planStyle: ['structured', 'improvised', 'adaptive'],
  adventureSetting: ['novelty_first', 'comfort_first', 'context_first'],
  careLanguage: ['listener', 'problem_solver', 'ask_first'],
  surpriseStyle: ['full_mystery', 'one_clue', 'co_created']
});

const FINAL_RESPONSES = new Set(['use_settings', 'show_idea', 'not_now']);
const isConfigured = REQUIRED_CONFIG.every((key) => Boolean(firebaseConfig[key]));

let firebasePromise;
let currentRun;
let writeQueue = Promise.resolve();
let warningShown = false;

function makeRunId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`;
}

function warnOnce(error) {
  if (warningShown) return;
  warningShown = true;
  console.warn('Anonymous instinct-game tracking is currently unavailable.', error ?? 'Firebase is not configured.');
}

async function loadFirebase() {
  if (!isConfigured) {
    warnOnce();
    return null;
  }

  if (!firebasePromise) {
    firebasePromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
      appCheckSiteKey
        ? import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-check.js`)
        : Promise.resolve(null)
    ]).then(async ([appSdk, authSdk, firestoreSdk, appCheckSdk]) => {
      const app = appSdk.getApps().find(({ name }) => name === FIREBASE_APP_NAME)
        ?? appSdk.initializeApp(firebaseConfig, FIREBASE_APP_NAME);
      const auth = authSdk.getAuth(app);
      const credential = await authSdk.signInAnonymously(auth);

      if (appCheckSdk && appCheckSiteKey) {
        appCheckSdk.initializeAppCheck(app, {
          provider: new appCheckSdk.ReCaptchaEnterpriseProvider(appCheckSiteKey),
          isTokenAutoRefreshEnabled: true
        });
      }

      return {
        db: firestoreSdk.getFirestore(app),
        uid: credential.user.uid,
        doc: firestoreSdk.doc,
        setDoc: firestoreSdk.setDoc,
        updateDoc: firestoreSdk.updateDoc,
        serverTimestamp: firestoreSdk.serverTimestamp
      };
    }).catch((error) => {
      firebasePromise = undefined;
      warnOnce(error);
      return null;
    });
  }

  return firebasePromise;
}

function enqueue(run, operation) {
  const pending = writeQueue.then(async () => {
    const firebase = await loadFirebase();
    if (!firebase) return;
    await operation(firebase, run);
  });

  writeQueue = pending.catch((error) => warnOnce(error));
  return writeQueue;
}

function runDocument(firebase, run) {
  return firebase.doc(firebase.db, COLLECTION_NAME, run.id);
}

function emptyAnswers() {
  return Object.fromEntries(Object.keys(QUESTION_CHOICES).map((questionId) => [questionId, null]));
}

function emptyProfile() {
  return Object.fromEntries(Object.keys(PROFILE_CHOICES).map((profileId) => [profileId, null]));
}

function isValidProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
  const keys = Object.keys(profile);
  const expectedKeys = Object.keys(PROFILE_CHOICES);
  return keys.length === expectedKeys.length
    && expectedKeys.every((key) => keys.includes(key) && PROFILE_CHOICES[key].includes(profile[key]));
}

export const personalityTelemetry = {
  beginRun() {
    const run = { id: makeRunId() };
    currentRun = run;

    enqueue(run, async (firebase) => {
      await firebase.setDoc(runDocument(firebase, run), {
        ownerUid: firebase.uid,
        schemaVersion: 1,
        gameVersion: GAME_VERSION,
        startedAt: firebase.serverTimestamp(),
        updatedAt: firebase.serverTimestamp(),
        completedAt: null,
        answers: emptyAnswers(),
        profile: emptyProfile(),
        finalResponse: null
      });
    });
  },

  recordAnswer(questionId, answer) {
    const run = currentRun;
    const allowed = QUESTION_CHOICES[questionId];
    if (!run || !allowed?.includes(answer)) return;

    enqueue(run, async (firebase) => {
      await firebase.updateDoc(runDocument(firebase, run), {
        [`answers.${questionId}`]: answer,
        updatedAt: firebase.serverTimestamp()
      });
    });
  },

  recordProfile(profile) {
    const run = currentRun;
    if (!run || !isValidProfile(profile)) return;

    enqueue(run, async (firebase) => {
      await firebase.updateDoc(runDocument(firebase, run), {
        profile: { ...profile },
        updatedAt: firebase.serverTimestamp()
      });
    });
  },

  completeRun(finalResponse) {
    const run = currentRun;
    if (!run || !FINAL_RESPONSES.has(finalResponse)) return;

    enqueue(run, async (firebase) => {
      await firebase.updateDoc(runDocument(firebase, run), {
        finalResponse,
        completedAt: firebase.serverTimestamp(),
        updatedAt: firebase.serverTimestamp()
      });
    });
  },

  resetRun() {
    currentRun = undefined;
  }
};
