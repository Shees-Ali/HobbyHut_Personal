'use strict';

/**
 * Works out what has to change in hobby member lists when a user document changes.
 * Pure functions (no Firestore access) so the rules can be tested on their own;
 * index.js applies the result.
 *
 * Data written:
 *   hobbies/{hobbyID}.members            array of member uids
 *   hobbies/{hobbyID}/members/{uid}      copy of the user's public profile for that hobby
 *   active/{uid}                         the user's running timers (removed when inactive)
 *   users/{uid}.profileComplete          mirror of the completeness rule
 *
 * Only users with a complete profile are published. Everyone else is removed.
 */

const { isProfileComplete, normalizeSkillLevel } = require('./profile');

/** Location changes smaller than this (about 100 m) do not rewrite member documents. */
const COORDINATE_PRECISION = 3;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/** The user's hobbies with a valid id, without duplicates, skill level casing fixed. */
function userHobbies(user) {
  const seen = new Set();
  const result = [];
  asArray(user && user.hobbies).forEach((hobby) => {
    if (!hobby || typeof hobby.hobbyID !== 'string' || !hobby.hobbyID || seen.has(hobby.hobbyID)) {
      return;
    }
    seen.add(hobby.hobbyID);
    result.push({
      hobbyID: hobby.hobbyID,
      skillLevel: normalizeSkillLevel(hobby.skillLevel) || '',
      meta: hobby.meta || {},
    });
  });
  return result;
}

function latLng(point) {
  if (!point) {
    return null;
  }
  // Admin SDK GeoPoint exposes latitude/longitude.
  const lat = typeof point.latitude === 'number' ? point.latitude : point.lat;
  const lng = typeof point.longitude === 'number' ? point.longitude : point.lng;
  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
}

function coarseLocation(user) {
  const point = latLng(user && user.coordinates);
  return point
    ? `${point.lat.toFixed(COORDINATE_PRECISION)},${point.lng.toFixed(COORDINATE_PRECISION)}`
    : '';
}

/**
 * Everything about a user that ends up in member documents, as a string. If this is the
 * same before and after a change, member documents do not need to be rewritten.
 */
function publicFingerprint(user) {
  if (!user) {
    return '';
  }
  return JSON.stringify({
    displayName: user.displayName || '',
    username: user.username || '',
    dob: user.dob || '',
    gender: user.gender || '',
    photos: asArray(user.photos),
    hobbies: userHobbies(user),
    profileVersion: user.profileVersion || 0,
    location: coarseLocation(user),
  });
}

/** The document stored at hobbies/{hobbyID}/members/{uid}. */
function memberDoc(uid, user, hobby) {
  const doc = {
    uid,
    displayName: user.displayName,
    username: user.username,
    dob: user.dob,
    gender: user.gender,
    photos: asArray(user.photos).filter((photo) => !!photo),
    skillLevel: hobby.skillLevel,
    meta: hobby.meta || {},
  };
  // Needed for "within X miles" queries on the member list.
  if (user.coordinates && user.g) {
    doc.coordinates = user.coordinates;
    doc.g = user.g;
  }
  return doc;
}

/**
 * @param {string} uid
 * @param {object|undefined} before user document before the change (undefined when created)
 * @param {object|undefined} after user document after the change (undefined when deleted)
 * @returns {null | {
 *   complete: boolean,
 *   upserts: {hobbyID: string, member: object}[],
 *   removeHobbyIds: string[],
 *   deleteActive: boolean,
 *   setProfileComplete: boolean | null,
 *   releaseUsername: string | null,
 * }} null when nothing has to be done
 */
function planSync(uid, before, after, now = new Date()) {
  const beforeIds = userHobbies(before).map((hobby) => hobby.hobbyID);

  // User document deleted: take the user out of everything.
  if (!after) {
    return {
      complete: false,
      upserts: [],
      removeHobbyIds: beforeIds,
      deleteActive: true,
      setProfileComplete: null,
      releaseUsername: (before && before.usernameLower) || null,
    };
  }

  const complete = isProfileComplete(after, now);
  const flagIsRight = after.profileComplete === complete;
  const publicChanged = publicFingerprint(before) !== publicFingerprint(after);
  if (!publicChanged && flagIsRight) {
    return null;
  }

  const afterHobbies = userHobbies(after);
  const afterIds = afterHobbies.map((hobby) => hobby.hobbyID);
  const wanted = complete ? afterHobbies : [];
  const wantedIds = new Set(wanted.map((hobby) => hobby.hobbyID));
  const removeHobbyIds = Array.from(new Set([...beforeIds, ...afterIds])).filter(
    (hobbyID) => !wantedIds.has(hobbyID),
  );

  return {
    complete,
    upserts: wanted.map((hobby) => ({ hobbyID: hobby.hobbyID, member: memberDoc(uid, after, hobby) })),
    removeHobbyIds,
    // An inactive profile must not show up as "ready now" either.
    deleteActive: !complete,
    setProfileComplete: flagIsRight ? null : complete,
    releaseUsername: null,
  };
}

module.exports = { planSync, userHobbies, memberDoc, publicFingerprint };
