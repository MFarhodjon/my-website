import { appCheckSiteKey, firebaseConfig } from './firebase-config.js';

const FIREBASE_VERSION = '12.18.0';
const FIREBASE_APP_NAME = 'good-mood-quiz';
const QUESTION_IDS = new Set(['travel', 'nature', 'cities', 'food', 'spontaneous']);
const REQUIRED_CONFIG = ['apiKey', 'authDomain', 'projectId', 'appId'];
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
  console.warn('Anonymous quiz tracking is currently unavailable.', error ?? 'Firebase is not configured.');
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
  return firebase.doc(firebase.db, 'quizRuns', run.id);
}

export const quizTelemetry = {
  beginRun() {
    const run = { id: makeRunId() };
    currentRun = run;

    enqueue(run, async (firebase) => {
      await firebase.setDoc(runDocument(firebase, run), {
        ownerUid: firebase.uid,
        schemaVersion: 1,
        startedAt: firebase.serverTimestamp(),
        updatedAt: firebase.serverTimestamp(),
        completedAt: null,
        answers: {
          travel: null,
          nature: null,
          cities: null,
          food: null,
          spontaneous: null
        },
        finalNoAttempts: 0,
        finalAttempts: 0,
        finalDecision: 'pending'
      });
    });
  },

  recordAnswer(questionId, answer) {
    const run = currentRun;
    if (!run || !QUESTION_IDS.has(questionId) || !['yes', 'no'].includes(answer)) return;

    enqueue(run, async (firebase) => {
      await firebase.updateDoc(runDocument(firebase, run), {
        [`answers.${questionId}`]: answer,
        updatedAt: firebase.serverTimestamp()
      });
    });
  },

  recordFinalNoAttempt(attempt) {
    const run = currentRun;
    if (!run || !Number.isInteger(attempt) || attempt < 1 || attempt > 3) return;

    enqueue(run, async (firebase) => {
      await firebase.updateDoc(runDocument(firebase, run), {
        finalNoAttempts: attempt,
        finalAttempts: attempt,
        updatedAt: firebase.serverTimestamp()
      });
    });
  },

  completeRun({ decision, finalNoAttempts, finalAttempts }) {
    const run = currentRun;
    const validCounts = Number.isInteger(finalNoAttempts)
      && Number.isInteger(finalAttempts)
      && finalNoAttempts >= 0
      && finalNoAttempts <= 4
      && finalAttempts >= 1
      && finalAttempts <= 4;
    const validDecision = decision === 'yes'
      ? finalAttempts === finalNoAttempts + 1
      : decision === 'no' && finalNoAttempts === 4 && finalAttempts === 4;

    if (!run || !validCounts || !validDecision) return;

    enqueue(run, async (firebase) => {
      await firebase.updateDoc(runDocument(firebase, run), {
        finalDecision: decision,
        finalNoAttempts,
        finalAttempts,
        completedAt: firebase.serverTimestamp(),
        updatedAt: firebase.serverTimestamp()
      });
    });
  },

  resetRun() {
    currentRun = undefined;
  }
};
