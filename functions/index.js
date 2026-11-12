const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
// Auth triggers (user created / deleted) only exist in the v1 API.
const functionsV1 = require('firebase-functions/v1');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { planSync } = require('./sync');

// Initialize Firebase Admin with the runtime's default credentials
admin.initializeApp();

/** Firestore allows 500 writes per batch; stay well under it. */
const BATCH_SIZE = 400;

/** What a brand-new user document contains. Profile fields are filled in by the app. */
function starterUserDoc(user) {
  const doc = {
    uid: user.uid,
    hobbies: [],
    chats: [],
    photos: [],
    activeHobby: {},
    pushNotificationSettings: {
      messagesReceived: true,
      messagesRequested: true,
      groupMessage: true,
      timerFromTop20Contacts: true,
      timerToTop5Contacts: true,
      proGameRequest: true,
      recordBookPublic: true,
    },
  };
  if (user.email) {
    doc.email = user.email;
  }
  if (user.phoneNumber) {
    // Digits only, to match how the app looks up contacts.
    doc.phoneNumber = user.phoneNumber.replace(/\D/g, '');
  }
  return doc;
}

/**
 * Creates the user document when someone signs up.
 *
 * The app creates the same document itself at sign-in, and either can come first, so
 * this only ever adds fields that are missing. It never overwrites existing data.
 */
exports.createUserProfile = functionsV1.auth.user().onCreate(async (user) => {
  const db = admin.firestore();
  const ref = db.doc(`users/${user.uid}`);
  const starter = starterUserDoc(user);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, starter);
      return;
    }
    const existing = snap.data() || {};
    const missing = {};
    Object.keys(starter).forEach((key) => {
      if (existing[key] === undefined) {
        missing[key] = starter[key];
      }
    });
    if (Object.keys(missing).length > 0) {
      tx.set(ref, missing, { merge: true });
    }
  });
  logger.info('createUserProfile: user document ready', { uid: user.uid });
});

/**
 * Keeps hobby member lists in step with the user document.
 *
 * Runs on every change to users/{uid}. Users with a complete profile are published to
 * hobbies/{hobbyID}/members/{uid} and hobbies/{hobbyID}.members for each of their
 * hobbies; users without one (and deleted users) are removed from all of them.
 * See sync.js for the rules.
 */
exports.syncUserProfile = onDocumentWritten('users/{uid}', async (event) => {
  const uid = event.params.uid;
  const db = admin.firestore();
  const before = event.data && event.data.before.exists ? event.data.before.data() : undefined;

  // Events can arrive late or out of order. Always work from the document as it is now,
  // so the member lists end up matching the latest state whichever event runs last.
  const currentSnap = await db.doc(`users/${uid}`).get();
  const after = currentSnap.exists ? currentSnap.data() : undefined;

  const plan = planSync(uid, before, after);
  if (!plan) {
    return;
  }

  // Never create hobby documents; only touch hobbies that exist.
  const hobbyIds = Array.from(
    new Set([...plan.upserts.map((upsert) => upsert.hobbyID), ...plan.removeHobbyIds]),
  );
  const existingHobbies = new Set();
  if (hobbyIds.length > 0) {
    const snaps = await db.getAll(...hobbyIds.map((hobbyID) => db.doc(`hobbies/${hobbyID}`)));
    snaps.forEach((snap) => {
      if (snap.exists) {
        existingHobbies.add(snap.id);
      }
    });
  }

  const writes = [];
  plan.upserts.forEach(({ hobbyID, member }) => {
    if (!existingHobbies.has(hobbyID)) {
      logger.warn('syncUserProfile: user has a hobby that does not exist', { uid, hobbyID });
      return;
    }
    writes.push((batch) => batch.set(db.doc(`hobbies/${hobbyID}/members/${uid}`), member));
    writes.push((batch) =>
      batch.update(db.doc(`hobbies/${hobbyID}`), { members: FieldValue.arrayUnion(uid) }),
    );
  });
  plan.removeHobbyIds.forEach((hobbyID) => {
    writes.push((batch) => batch.delete(db.doc(`hobbies/${hobbyID}/members/${uid}`)));
    if (existingHobbies.has(hobbyID)) {
      writes.push((batch) =>
        batch.update(db.doc(`hobbies/${hobbyID}`), { members: FieldValue.arrayRemove(uid) }),
      );
    }
  });
  if (plan.deleteActive) {
    writes.push((batch) => batch.delete(db.doc(`active/${uid}`)));
  }

  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = db.batch();
    writes.slice(i, i + BATCH_SIZE).forEach((write) => write(batch));
    await batch.commit();
  }

  if (plan.releaseUsername) {
    const claimRef = db.doc(`usernames/${plan.releaseUsername}`);
    const claim = await claimRef.get();
    if (claim.exists && claim.data().uid === uid) {
      await claimRef.delete();
    }
  }

  if (plan.setProfileComplete !== null) {
    try {
      await db.doc(`users/${uid}`).update({ profileComplete: plan.setProfileComplete });
    } catch (error) {
      // 5 = NOT_FOUND: the user was deleted in the meantime; that change has its own event.
      if (error.code !== 5) {
        throw error;
      }
    }
  }

  logger.info('syncUserProfile: done', {
    uid,
    complete: plan.complete,
    published: plan.upserts.length,
    removed: plan.removeHobbyIds.length,
  });
});

/**
 * Removes everything that belongs to a user when their account is deleted.
 *
 * Deleting the user document makes syncUserProfile remove the hobby memberships, the
 * "ready now" entry and the username claim. This function handles the rest: links from
 * other users, chats and uploaded photos.
 */
exports.cleanupUser = functionsV1.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  const db = admin.firestore();

  await db.doc(`users/${uid}`).delete();

  const [friends, requesters, blockers, chats] = await Promise.all([
    db.collection('users').where('friend', 'array-contains', uid).get(),
    db.collection('users').where('chats', 'array-contains', uid).get(),
    db.collection('users').where('blockedUsers', 'array-contains', uid).get(),
    // `participantIds` is written by the app from the messaging update onwards and
    // backfilled by the data migration.
    db.collection('chats').where('participantIds', 'array-contains', uid).get(),
  ]);

  const writes = [];
  friends.forEach((doc) =>
    writes.push((batch) => batch.update(doc.ref, { friend: FieldValue.arrayRemove(uid) })),
  );
  requesters.forEach((doc) =>
    writes.push((batch) => batch.update(doc.ref, { chats: FieldValue.arrayRemove(uid) })),
  );
  blockers.forEach((doc) =>
    writes.push((batch) => batch.update(doc.ref, { blockedUsers: FieldValue.arrayRemove(uid) })),
  );
  chats.forEach((doc) => writes.push((batch) => batch.delete(doc.ref)));

  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = db.batch();
    writes.slice(i, i + BATCH_SIZE).forEach((write) => write(batch));
    await batch.commit();
  }

  try {
    await admin.storage().bucket().deleteFiles({ prefix: `users/${uid}/` });
  } catch (error) {
    // Photos are not worth failing the whole cleanup for; log and move on.
    logger.error('cleanupUser: could not delete uploaded files', { uid, error: error.message });
  }

  logger.info('cleanupUser: done', {
    uid,
    friendLinks: friends.size,
    requestLinks: requesters.size,
    blockLinks: blockers.size,
    chats: chats.size,
  });
});

// Firebase HTTP Function for sending a notification
exports.sendNotification = onRequest(async (request, response) => {
  logger.info('Request received:', request.body);

  // Validate that the request method is POST
  if (request.method !== 'POST') {
    response.status(405).send('Method Not Allowed');
    return;
  }

  // Extract notification data from the request body
  const { notification, data, token } = request.body;

  console.log('notification', notification);
  console.log('data', data);
  console.log('token', token);

  // Validate that all required fields are provided
  if (!notification || !data || !token) {
    response.status(400).json({ error: 'Missing title, body, or token in request payload' });
    return;
  }

  // FCM message payload
  const message = {
    notification: notification,
    data: data,
    token: token,
  };

  try {
    // Send the notification to the device
    const res = await admin.messaging().send(message);
    logger.info('Notification sent successfully:', res);
    response.status(200).json({ message: 'Notification sent successfully', res });
  } catch (error) {
    logger.error('Error sending notification:', error);
    response.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});
