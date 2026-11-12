'use strict';

/**
 * The rule for an active profile.
 *
 * KEEP IN SYNC with src/app/core/profile.ts in the app. The app uses its copy to lock
 * the UI; this copy decides who is published to hobby member lists.
 */

const PROFILE_VERSION = 1;
const MIN_AGE = 18;
const MAX_AGE = 120;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const GENDERS = ['male', 'female', 'non-binary'];
const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];

/** `2001-05-09T00:00:00+05:00` -> `2001-05-09`. Returns '' when the value is not a real date. */
function toDateOnly(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    return '';
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isRealDate ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

/** Whole years between the date of birth and `now`. Returns null when the date is not valid. */
function ageFromDob(dob, now = new Date()) {
  const dateOnly = toDateOnly(dob);
  if (!dateOnly) {
    return null;
  }
  const [year, month, day] = dateOnly.split('-').map(Number);
  let age = now.getFullYear() - year;
  const hadBirthdayThisYear =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hadBirthdayThisYear) {
    age--;
  }
  return age;
}

function isValidDob(dob, now = new Date()) {
  const age = ageFromDob(dob, now);
  return age !== null && age >= MIN_AGE && age <= MAX_AGE;
}

function isValidUsername(username) {
  return (
    typeof username === 'string' &&
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(username)
  );
}

function isValidGender(gender) {
  return GENDERS.includes(gender);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasPhoto(photos) {
  return Array.isArray(photos) && photos.some((photo) => hasText(photo));
}

/** The required profile fields this user still has to provide. */
function missingProfileFields(user, now = new Date()) {
  const u = user || {};
  const missing = [];
  if (!hasText(u.displayName)) {
    missing.push('displayName');
  }
  if (!isValidUsername(u.username)) {
    missing.push('username');
  }
  if (!isValidDob(u.dob, now)) {
    missing.push('dob');
  }
  if (!isValidGender(u.gender)) {
    missing.push('gender');
  }
  if (!hasPhoto(u.photos)) {
    missing.push('photo');
  }
  return missing;
}

/**
 * True when the user has been through the profile form (`profileVersion`) and every
 * required field is set.
 */
function isProfileComplete(user, now = new Date()) {
  return (
    !!user &&
    (user.profileVersion || 0) >= PROFILE_VERSION &&
    missingProfileFields(user, now).length === 0
  );
}

/** 'beginner' -> 'Beginner'. Unknown values are returned unchanged. */
function normalizeSkillLevel(value) {
  if (typeof value !== 'string') {
    return value;
  }
  const match = SKILL_LEVELS.find((level) => level.toLowerCase() === value.trim().toLowerCase());
  return match || value;
}

module.exports = {
  PROFILE_VERSION,
  MIN_AGE,
  toDateOnly,
  ageFromDob,
  isValidDob,
  isValidUsername,
  isValidGender,
  missingProfileFields,
  isProfileComplete,
  normalizeSkillLevel,
};
