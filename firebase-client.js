/* Word Khelo Phase 1 client adapter.
   The game remains playable offline. When firebase-config.js is present and
   the browser is online, auth/progress/results/leaderboard sync automatically. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged,
  signInWithPopup, signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, doc, setDoc, addDoc, collection, query, orderBy,
  limit, getDocs, getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';

const config = window.WORDKHELO_FIREBASE_CONFIG;
let auth = null;
let db = null;
let currentUser = null;
let submitGameResult = null;
const QUEUE_KEY = 'wk_backend_queue_v1';

if (config && config.projectId && !String(config.projectId).startsWith('YOUR_')) {
  try {
    const app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    submitGameResult = httpsCallable(getFunctions(app), 'submitGameResult');
    onAuthStateChanged(auth, user => {
      currentUser = user || null;
      window.dispatchEvent(new CustomEvent('wordkhelo-auth', { detail: currentUser }));
    });
  } catch (error) {
    console.warn('Word Khelo Firebase disabled:', error.message);
  }
}

async function login() {
  if (!auth) throw new Error('Firebase config abhi set nahi hai.');
  return signInWithPopup(auth, new GoogleAuthProvider());
}

async function logout() {
  if (auth) return signOut(auth);
}

async function saveProgress(progress) {
  if (!db || !currentUser) return false;
  const payload = { ...progress, updatedAt: serverTimestamp() };
  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'progress', progress.subjectId), payload, { merge: true });
  } catch (error) {
    queueOffline('progress', progress);
    throw error;
  }
  return true;
}

async function getProgress(subjectId) {
  if (!db || !currentUser) return null;
  const result = await getDoc(doc(db, 'users', currentUser.uid, 'progress', subjectId));
  return result.exists() ? result.data() : null;
}

async function saveProfile(profile = {}) {
  if (!db || !currentUser) return false;
  await setDoc(doc(db, 'users', currentUser.uid), {
    displayName: profile.displayName || currentUser.displayName || 'Player',
    email: currentUser.email || '',
    photoURL: currentUser.photoURL || '',
    updatedAt: serverTimestamp()
  }, { merge: true });
  return true;
}

async function recordGame(result) {
  if (!db || !currentUser) return false;
  try {
    if (!submitGameResult) throw new Error('Score validation function unavailable.');
    await submitGameResult(result);
  } catch (error) {
    // Transitional Phase 1 fallback. Once Cloud Functions are deployed,
    // this path is no longer used and scores are validated server-side.
    const unavailable = String(error.code || '').includes('not-found') ||
      String(error.message || '').includes('unavailable');
    if (!unavailable) {
      queueOffline('game', result);
      throw error;
    }
    await addDoc(collection(db, 'gameResults'), {
      ...result, userId: currentUser.uid, createdAt: serverTimestamp(), verified: false
    });
    await setDoc(doc(db, 'leaderboard', currentUser.uid), {
      userId: currentUser.uid,
      displayName: currentUser.displayName || 'Player',
      totalScore: Number(result.totalScore || 0),
      bestScore: Number(result.score || 0),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
  return true;
}

function queueOffline(type, data) {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    queue.push({ type, data, queuedAt: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-100)));
  } catch (_) {}
}

async function flushOfflineQueue() {
  if (!db || !currentUser) return;
  let queue = [];
  try { queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (_) { return; }
  if (!queue.length) return;
  const pending = [];
  for (const item of queue) {
    try {
      if (item.type === 'progress') await saveProgress(item.data);
      if (item.type === 'game') await recordGame(item.data);
    } catch (_) { pending.push(item); }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(pending));
}

async function getLeaderboard() {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, 'leaderboard'), orderBy('totalScore', 'desc'), limit(20)));
  return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

window.WordKheloBackend = {
  login, logout, saveProfile, saveProgress, getProgress, recordGame,
  getLeaderboard, flushOfflineQueue,
  get user() { return currentUser; },
  get enabled() { return Boolean(db); }
};
