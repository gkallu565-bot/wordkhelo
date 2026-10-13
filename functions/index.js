const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

// Phase 3 foundation: never trust a client score blindly. A later version
// will validate the submitted moves against a server-issued puzzle seed.
exports.submitGameResult = onCall(async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');
  const data = request.data || {};
  const score = Number(data.score);
  const level = Number(data.level);
  const timeTaken = Number(data.timeTaken);
  const hintsUsed = Number(data.hintsUsed || 0);
  const livesRemaining = Number(data.livesRemaining || 0);

  if (!Number.isInteger(level) || level < 1 || level > 100 ||
      !Number.isFinite(score) || score < 0 || score > 100000 ||
      !Number.isFinite(timeTaken) || timeTaken < 0 || timeTaken > 86400 ||
      !Number.isInteger(hintsUsed) || hintsUsed < 0 || hintsUsed > 20 ||
      !Number.isInteger(livesRemaining) || livesRemaining < 0 || livesRemaining > 10) {
    throw new HttpsError('invalid-argument', 'Invalid game result.');
  }

  const result = {
    userId: request.auth.uid,
    subjectId: String(data.subjectId || 'general').slice(0, 120),
    level, score, timeTaken, hintsUsed, livesRemaining,
    verified: false,
    validationVersion: 1,
    createdAt: FieldValue.serverTimestamp()
  };
  const resultRef = await db.collection('gameResults').add(result);
  const leaderboardRef = db.doc(`leaderboard/${request.auth.uid}`);
  await leaderboardRef.set({
    userId: request.auth.uid,
    displayName: request.auth.token.name || 'Player',
    bestScore: score,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { resultId: resultRef.id, accepted: true, verified: false };
});

// Creates a single daily challenge document if one does not exist.
exports.createDailyChallenge = onSchedule('every day 00:05', async () => {
  const day = new Date().toISOString().slice(0, 10);
  await db.doc(`dailyChallenges/${day}`).set({
    date: day,
    status: 'draft',
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
});
