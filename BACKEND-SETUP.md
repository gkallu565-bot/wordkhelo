# Word Khelo backend — Phase 1

## Firebase setup

1. Create a Firebase project at https://console.firebase.google.com.
2. Add a Web app and copy its configuration.
3. Copy `firebase-config.example.js` to `firebase-config.js` and fill in the configuration.
4. Enable **Google** under Authentication → Sign-in method.
5. Create a Firestore database.
6. Deploy the rules with `firebase deploy --only firestore:rules`.

`firebase-config.js` contains only the Firebase browser configuration. It is
safe to publish this web config; never put Admin SDK credentials in it. The
current local game remains usable if the file is missing.

## Phase 1 collections

- `users/{uid}` — profile
- `users/{uid}/progress/{subjectId}` — level and score progress
- `gameResults/{resultId}` — completed game history
- `leaderboard/{uid}` — current leaderboard summary

The client-side score write is only a Phase 1 foundation. Before treating the
leaderboard as competitive, Phase 3 must generate puzzles and validate scores
inside a trusted Cloud Function.
