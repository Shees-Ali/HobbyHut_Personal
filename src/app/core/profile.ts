import { Gender, HobbyMember, User } from './core.model';

/**
 * The rule for an active profile, in one place.
 *
 * A user may not use the app, and is not shown to other users, until they have
 * completed the profile form: display name, username, date of birth, gender and
 * at least one photo. The Cloud Function applies the same rule on the server.
 */

/** Written by the profile completion form. Bump to make every user confirm their profile again. */
export const PROFILE_VERSION = 1;

export const MIN_AGE = 18;
const MAX_AGE = 120;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/**
 * Dates the old form filled in by itself. A profile with one of these has to pick a
 * date of birth again (`1999-12-31` is `2000-01-01` shifted by a time zone).
 */
export const PLACEHOLDER_DOBS = ['2000-01-01', '1999-12-31'];

export type ProfileField = 'displayName' | 'username' | 'dob' | 'gender' | 'photo';

/** `2001-05-09T00:00:00+05:00` -> `2001-05-09`. Returns '' when the value is not a real date. */
export function toDateOnly(value: unknown): string {
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
export function ageFromDob(dob: unknown, now: Date = new Date()): number | null {
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

export function isValidDob(dob: unknown, now: Date = new Date()): boolean {
  const age = ageFromDob(dob, now);
  return age !== null && age >= MIN_AGE && age <= MAX_AGE;
}

/** The latest date of birth that is still old enough, as `YYYY-MM-DD` (for the date picker). */
export function latestAllowedDob(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear() - MIN_AGE}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isValidUsername(username: unknown): boolean {
  return (
    typeof username === 'string' &&
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(username)
  );
}

export function isValidGender(gender: unknown): gender is Gender {
  return (Object.values(Gender) as unknown[]).includes(gender);
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasPhoto(photos: unknown): boolean {
  return Array.isArray(photos) && photos.some((photo) => hasText(photo));
}

/** The required profile fields this user still has to provide. */
export function missingProfileFields(user: Partial<User> | null | undefined): ProfileField[] {
  const missing: ProfileField[] = [];
  if (!hasText(user?.displayName)) {
    missing.push('displayName');
  }
  if (!isValidUsername(user?.username)) {
    missing.push('username');
  }
  if (!isValidDob(user?.dob)) {
    missing.push('dob');
  }
  if (!isValidGender(user?.gender)) {
    missing.push('gender');
  }
  if (!hasPhoto(user?.photos)) {
    missing.push('photo');
  }
  return missing;
}

/**
 * True when the user has been through the profile form and every required field is set.
 * Profiles that were never confirmed through the form (no `profileVersion`) are incomplete
 * even if the fields happen to be filled in.
 */
export function isProfileComplete(user: Partial<User> | null | undefined): boolean {
  return (
    !!user && (user.profileVersion || 0) >= PROFILE_VERSION && missingProfileFields(user).length === 0
  );
}

/**
 * Hobby member documents are copies and carry no `profileVersion`, so lists built from
 * them can only check that the visible fields are there.
 */
export function isListableMember(member: Partial<HobbyMember> | null | undefined): boolean {
  return (
    !!member &&
    hasText(member.uid) &&
    hasText(member.displayName) &&
    isValidDob(member.dob) &&
    hasPhoto(member.photos)
  );
}
