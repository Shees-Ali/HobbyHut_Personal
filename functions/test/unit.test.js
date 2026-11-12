'use strict';

// Unit tests for the profile rule and the membership planner. No Firebase needed.
// Run from functions/: npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../profile');
const { planSync, publicFingerprint } = require('../sync');

const NOW = new Date(2026, 10, 13); // 13 Nov 2026

const completeUser = (overrides = {}) => ({
  uid: 'u1',
  profileVersion: 1,
  displayName: 'Ada',
  username: 'ada_l',
  usernameLower: 'ada_l',
  dob: '1990-01-01',
  gender: 'female',
  photos: ['https://example.test/a.jpg'],
  hobbies: [
    { hobbyID: 'h1', name: 'Tennis', skillLevel: 'Pro' },
    { hobbyID: 'h2', name: 'Golf', skillLevel: 'beginner', meta: { coach: null } },
  ],
  profileComplete: true,
  ...overrides,
});

test('profile: age boundaries', () => {
  assert.equal(profile.isValidDob('2008-11-13', NOW), true, '18 today');
  assert.equal(profile.isValidDob('2008-11-14', NOW), false, '18 tomorrow');
  assert.equal(profile.isValidDob('2001-02-30', NOW), false, 'impossible date');
  assert.equal(profile.isValidDob('1850-01-01', NOW), false, 'too old');
  assert.equal(profile.isValidDob(undefined, NOW), false);
  assert.equal(profile.toDateOnly('2001-05-09T00:00:00+05:00'), '2001-05-09');
});

test('profile: completeness', () => {
  assert.equal(profile.isProfileComplete(completeUser(), NOW), true);
  assert.equal(profile.isProfileComplete(completeUser({ profileVersion: undefined }), NOW), false);
  assert.equal(profile.isProfileComplete(completeUser({ photos: [] }), NOW), false);
  assert.equal(profile.isProfileComplete(completeUser({ photos: [''] }), NOW), false);
  assert.equal(profile.isProfileComplete(completeUser({ displayName: '  ' }), NOW), false);
  assert.equal(profile.isProfileComplete(completeUser({ username: 'aa' }), NOW), false);
  assert.equal(profile.isProfileComplete(completeUser({ gender: 'x' }), NOW), false);
  assert.equal(profile.isProfileComplete(undefined, NOW), false);
  assert.deepEqual(profile.missingProfileFields({}, NOW), [
    'displayName',
    'username',
    'dob',
    'gender',
    'photo',
  ]);
});

test('planSync: nothing to do when only private fields change', () => {
  const before = completeUser();
  const after = completeUser({ lastlogintime: '2026-11-13T10:00:00+00:00', device: ['token'] });
  assert.equal(planSync('u1', before, after, NOW), null);
});

test('planSync: small location changes are ignored, large ones are not', () => {
  const at = (latitude, longitude) => ({
    coordinates: { latitude, longitude },
    g: { geohash: 'x', geopoint: { latitude, longitude } },
  });
  const before = completeUser(at(34.0252, -118.5132));
  // A few metres away.
  assert.equal(planSync('u1', before, completeUser(at(34.02522, -118.51321)), NOW), null);

  const plan = planSync('u1', before, completeUser(at(34.2, -118.5132)), NOW);
  assert.equal(plan.upserts.length, 2);
  assert.equal(plan.upserts[0].member.coordinates.latitude, 34.2);
  assert.ok(plan.upserts[0].member.g);
});

test('planSync: newly completed profile is published to every hobby', () => {
  const before = completeUser({ profileVersion: undefined, profileComplete: false });
  const plan = planSync('u1', before, completeUser({ profileComplete: false }), NOW);
  assert.equal(plan.complete, true);
  assert.deepEqual(plan.upserts.map((u) => u.hobbyID), ['h1', 'h2']);
  assert.deepEqual(plan.removeHobbyIds, []);
  assert.equal(plan.deleteActive, false);
  assert.equal(plan.setProfileComplete, true);
  assert.deepEqual(plan.upserts[1].member, {
    uid: 'u1',
    displayName: 'Ada',
    username: 'ada_l',
    dob: '1990-01-01',
    gender: 'female',
    photos: ['https://example.test/a.jpg'],
    skillLevel: 'Beginner', // casing fixed
    meta: { coach: null },
  });
});

test('planSync: removing a hobby removes the membership (any position)', () => {
  const before = completeUser();
  const after = completeUser({ hobbies: [before.hobbies[1]] });
  const plan = planSync('u1', before, after, NOW);
  assert.deepEqual(plan.removeHobbyIds, ['h1']);
  assert.deepEqual(plan.upserts.map((u) => u.hobbyID), ['h2']);
  assert.equal(plan.setProfileComplete, null);
});

test('planSync: swapping one hobby for another (same count) adds and removes', () => {
  const before = completeUser();
  const after = completeUser({
    hobbies: [before.hobbies[0], { hobbyID: 'h3', name: 'Run', skillLevel: 'Advanced' }],
  });
  const plan = planSync('u1', before, after, NOW);
  assert.deepEqual(plan.removeHobbyIds, ['h2']);
  assert.deepEqual(plan.upserts.map((u) => u.hobbyID), ['h1', 'h3']);
});

test('planSync: an incomplete profile is removed from everything', () => {
  const before = completeUser();
  const plan = planSync('u1', before, completeUser({ photos: [] }), NOW);
  assert.equal(plan.complete, false);
  assert.deepEqual(plan.upserts, []);
  assert.deepEqual(plan.removeHobbyIds.sort(), ['h1', 'h2']);
  assert.equal(plan.deleteActive, true);
  assert.equal(plan.setProfileComplete, false);
});

test('planSync: first sight of a legacy profile (no flag yet) cleans it up once', () => {
  const legacy = completeUser({ profileVersion: undefined, profileComplete: undefined });
  const first = planSync('u1', legacy, { ...legacy, lastlogintime: 'x' }, NOW);
  assert.equal(first.setProfileComplete, false);
  assert.deepEqual(first.removeHobbyIds.sort(), ['h1', 'h2']);
  // After the flag is written the function has nothing more to do.
  const flagged = { ...legacy, profileComplete: false };
  assert.equal(planSync('u1', legacy, flagged, NOW), null);
});

test('planSync: tolerates documents with missing or broken fields', () => {
  assert.doesNotThrow(() => planSync('u1', undefined, { gender: 'male', phoneNumber: '1' }, NOW));
  assert.doesNotThrow(() => planSync('u1', { hobbies: 'nope' }, { hobbies: [null, {}] }, NOW));
  const plan = planSync('u1', undefined, { gender: 'male' }, NOW);
  assert.equal(plan.complete, false);
  assert.equal(plan.setProfileComplete, false);
});

test('planSync: duplicate hobby entries are published once', () => {
  const user = completeUser();
  const after = completeUser({ hobbies: [...user.hobbies, user.hobbies[0]], displayName: 'Ada L' });
  const plan = planSync('u1', user, after, NOW);
  assert.deepEqual(plan.upserts.map((u) => u.hobbyID), ['h1', 'h2']);
});

test('planSync: deleted user document', () => {
  const plan = planSync('u1', completeUser(), undefined, NOW);
  assert.deepEqual(plan.removeHobbyIds, ['h1', 'h2']);
  assert.equal(plan.deleteActive, true);
  assert.equal(plan.releaseUsername, 'ada_l');
  assert.equal(plan.setProfileComplete, null);
});

test('publicFingerprint: stable for equal users', () => {
  assert.equal(publicFingerprint(completeUser()), publicFingerprint(completeUser()));
  assert.notEqual(
    publicFingerprint(completeUser()),
    publicFingerprint(completeUser({ displayName: 'Other' })),
  );
});
