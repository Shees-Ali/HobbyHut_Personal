'use strict';

// End-to-end test of the Cloud Functions against the Firebase emulators.
// Uses a demo project id, so it can never touch the real project.
// Run from functions/: npm run test:emulator

const test = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Refusing to run: the emulators are not configured. Use npm run test:emulator.');
}
const projectId = process.env.GCLOUD_PROJECT || 'demo-hobbyhut';
if (!projectId.startsWith('demo-')) {
  throw new Error(`Refusing to run against non-demo project "${projectId}".`);
}

admin.initializeApp({ projectId });
const db = admin.firestore();
const auth = admin.auth();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls until `check` returns a truthy value; fails the test with `what` on timeout. */
async function waitFor(what, check, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await check();
    if (last) {
      return last;
    }
    await sleep(250);
  }
  assert.fail(`Timed out waiting for: ${what}`);
}

const userDoc = async (uid) => (await db.doc(`users/${uid}`).get()).data();
const memberSnap = (hobbyID, uid) => db.doc(`hobbies/${hobbyID}/members/${uid}`).get();
const hobbyMembers = async (hobbyID) => (await db.doc(`hobbies/${hobbyID}`).get()).data().members;

const PROFILE = {
  profileVersion: 1,
  displayName: 'Ada',
  username: 'ada_l',
  usernameLower: 'ada_l',
  dob: '1990-01-01',
  gender: 'female',
  photos: ['https://example.test/a.jpg'],
};

test.before(async () => {
  await Promise.all(
    ['h1', 'h2'].map((id) =>
      db.doc(`hobbies/${id}`).set({ name: id, status: 'active', parent_room: 'Test', members: [] }),
    ),
  );
});

test('sign-up creates a starter user document', async () => {
  await auth.createUser({ uid: 'u1', phoneNumber: '+15555550101' });
  const doc = await waitFor('starter doc for u1', () => userDoc('u1'));
  assert.equal(doc.uid, 'u1');
  assert.equal(doc.phoneNumber, '15555550101');
  assert.deepEqual(doc.hobbies, []);
  assert.deepEqual(doc.photos, []);
  assert.equal(Object.keys(doc.pushNotificationSettings).length, 7);
});

test('sign-up never overwrites a document the app created first', async () => {
  await db.doc('users/u2').set({ gender: 'female', photos: ['https://example.test/mine.jpg'] });
  await auth.createUser({ uid: 'u2', email: 'u2@example.test' });
  const doc = await waitFor('missing fields filled in for u2', async () => {
    const d = await userDoc('u2');
    return d && d.uid ? d : null;
  });
  assert.deepEqual(doc.photos, ['https://example.test/mine.jpg']);
  assert.equal(doc.gender, 'female');
  assert.equal(doc.email, 'u2@example.test');
  assert.deepEqual(doc.hobbies, []);
});

test('an incomplete profile is not listed, even with hobbies', async () => {
  await db.doc('users/u1').update({
    hobbies: [{ hobbyID: 'h1', name: 'h1', skillLevel: 'Pro' }],
  });
  await waitFor('profileComplete=false on u1', async () => (await userDoc('u1')).profileComplete === false);
  assert.equal((await memberSnap('h1', 'u1')).exists, false);
  assert.deepEqual(await hobbyMembers('h1'), []);
});

test('completing the profile publishes the user to their hobbies', async () => {
  await db.doc('users/u1').update(PROFILE);
  const snap = await waitFor('member doc h1/u1', async () => {
    const s = await memberSnap('h1', 'u1');
    return s.exists ? s : null;
  });
  assert.deepEqual(snap.data(), {
    uid: 'u1',
    displayName: 'Ada',
    username: 'ada_l',
    dob: '1990-01-01',
    gender: 'female',
    photos: ['https://example.test/a.jpg'],
    skillLevel: 'Pro',
    meta: {},
  });
  assert.deepEqual(await hobbyMembers('h1'), ['u1']);
  await waitFor('profileComplete=true on u1', async () => (await userDoc('u1')).profileComplete === true);
});

test('adding a hobby and editing the profile updates every member document', async () => {
  await db.doc('users/u1').update({
    displayName: 'Ada L',
    hobbies: [
      { hobbyID: 'h1', name: 'h1', skillLevel: 'Advanced' },
      { hobbyID: 'h2', name: 'h2', skillLevel: 'beginner' },
      { hobbyID: 'ghost', name: 'does not exist', skillLevel: 'Pro' },
    ],
  });
  await waitFor('member doc h2/u1', async () => (await memberSnap('h2', 'u1')).exists);
  await waitFor(
    'h1/u1 updated',
    async () => (await memberSnap('h1', 'u1')).data().displayName === 'Ada L',
  );
  assert.equal((await memberSnap('h1', 'u1')).data().skillLevel, 'Advanced');
  assert.equal((await memberSnap('h2', 'u1')).data().skillLevel, 'Beginner');
  assert.deepEqual(await hobbyMembers('h2'), ['u1']);
  // A hobby id that does not exist must not create a hobby document.
  assert.equal((await db.doc('hobbies/ghost').get()).exists, false);
});

test('private changes do not rewrite member documents', async () => {
  const before = (await memberSnap('h1', 'u1')).updateTime.toMillis();
  await db.doc('users/u1').update({ lastlogintime: '2026-11-13T10:00:00+00:00', device: ['tok'] });
  await sleep(4000);
  assert.equal((await memberSnap('h1', 'u1')).updateTime.toMillis(), before);
});

test('removing a hobby removes the membership', async () => {
  await db.doc('users/u1').update({
    hobbies: [{ hobbyID: 'h2', name: 'h2', skillLevel: 'Beginner' }],
  });
  await waitFor('member doc h1/u1 removed', async () => !(await memberSnap('h1', 'u1')).exists);
  assert.deepEqual(await hobbyMembers('h1'), []);
  assert.equal((await memberSnap('h2', 'u1')).exists, true);
});

test('a profile that becomes incomplete is removed everywhere', async () => {
  await db.doc('active/u1').set({ uid: 'u1', hobby: [{ id: 'h2', name: 'h2', start: Date.now() }] });
  await db.doc('users/u1').update({ photos: [] });
  await waitFor('member doc h2/u1 removed', async () => !(await memberSnap('h2', 'u1')).exists);
  assert.deepEqual(await hobbyMembers('h2'), []);
  await waitFor('active/u1 removed', async () => !(await db.doc('active/u1').get()).exists);
  await waitFor('profileComplete=false on u1', async () => (await userDoc('u1')).profileComplete === false);
});

test('deleting an account removes everything that pointed at it', async () => {
  await auth.createUser({ uid: 'u3' });
  await waitFor('starter doc for u3', () => userDoc('u3'));
  await db.doc('users/u3').update({
    ...PROFILE,
    username: 'grace',
    usernameLower: 'grace',
    hobbies: [{ hobbyID: 'h1', name: 'h1', skillLevel: 'Pro' }],
    friend: ['u1'],
  });
  await db.doc('usernames/grace').set({ uid: 'u3', username: 'grace' });
  await db.doc('usernames/other').set({ uid: 'u1', username: 'other' });
  await db.doc('users/u1').update({ friend: ['u3', 'u2'], chats: ['u3'], blockedUsers: ['u3'] });
  await db.doc('chats/c1').set({ participantIds: ['u1', 'u3'], messages: [] });
  await db.doc('chats/c2').set({ participantIds: ['u1', 'u2'], messages: [] });
  await waitFor('member doc h1/u3', async () => (await memberSnap('h1', 'u3')).exists);

  await auth.deleteUser('u3');

  await waitFor('user doc u3 removed', async () => !(await db.doc('users/u3').get()).exists);
  await waitFor('member doc h1/u3 removed', async () => !(await memberSnap('h1', 'u3')).exists);
  assert.deepEqual(await hobbyMembers('h1'), []);
  await waitFor('username claim released', async () => !(await db.doc('usernames/grace').get()).exists);
  await waitFor('chat with u3 removed', async () => !(await db.doc('chats/c1').get()).exists);
  const u1 = await waitFor('links removed from u1', async () => {
    const d = await userDoc('u1');
    return !d.friend.includes('u3') && !d.chats.includes('u3') && !d.blockedUsers.includes('u3')
      ? d
      : null;
  });
  // Unrelated data is untouched.
  assert.deepEqual(u1.friend, ['u2']);
  assert.equal((await db.doc('chats/c2').get()).exists, true);
  assert.equal((await db.doc('usernames/other').get()).exists, true);
});
