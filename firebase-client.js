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
  limit, getDocs, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const config = window.WORDKHELO_FIREBASE_CONFIG;
let auth = null;
let db = null;
let currentUser = null;

if (config && config.projectId && !String(config.projectId).startsWith('YOUR_')) {
  try {
    const app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
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
  await setDoc(doc(db, 'users', currentUser.uid, 'progress', progress.subjectId), {
    ...progress, updatedAt: serverTimestamp()
  }, { merge: true });
  return true;
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
  await addDoc(collection(db, 'gameResults'), {
    ...result, userId: currentUser.uid, createdAt: serverTimestamp()
  });
  // Phase 1 leaderboard. Phase 3 will move score calculation to a function.
  await setDoc(doc(db, 'leaderboard', currentUser.uid), {
    userId: currentUser.uid,
    displayName: currentUser.displayName || 'Player',
    totalScore: Number(result.totalScore || 0),
    bestScore: Number(result.score || 0),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return true;
}

async function getLeaderboard() {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, 'leaderboard'), orderBy('totalScore', 'desc'), limit(20)));
  return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

window.WordKheloBackend = {
  login, logout, saveProfile, saveProgress, recordGame, getLeaderboard,
  get user() { return currentUser; },
  get enabled() { return Boolean(db); }
};
