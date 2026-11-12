import {
  HobbyMember,
  PushNotificationSettings,
  SkillLevel,
  User,
  UserHobby,
} from './core.model';

/**
 * Firestore documents written by older app versions and Cloud Functions are missing
 * fields or use inconsistent values. Everything read from Firestore goes through these
 * functions so the rest of the app can rely on the shapes in core.model.ts.
 *
 * These only fix what the app sees in memory; they do not write to Firestore.
 */

export const DEFAULT_PUSH_NOTIFICATION_SETTINGS: PushNotificationSettings = {
  messagesReceived: true,
  messagesRequested: true,
  groupMessage: true,
  timerFromTop20Contacts: true,
  timerToTop5Contacts: true,
  proGameRequest: true,
  recordBookPublic: true,
};

const SKILL_LEVELS = Object.values(SkillLevel) as string[];

/** 'beginner' -> 'Beginner'. Unknown values are returned unchanged. */
export function normalizeSkillLevel(value: unknown): SkillLevel {
  if (typeof value !== 'string') {
    return value as SkillLevel;
  }
  const match = SKILL_LEVELS.find((level) => level.toLowerCase() === value.trim().toLowerCase());
  return (match || value) as SkillLevel;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Drops entries without a hobby id, removes duplicates, fixes skill level casing. */
export function normalizeUserHobbies(hobbies: unknown): UserHobby[] {
  const seen = new Set<string>();
  const result: UserHobby[] = [];
  asArray<UserHobby>(hobbies).forEach((hobby) => {
    if (!hobby || !hobby.hobbyID || seen.has(hobby.hobbyID)) {
      return;
    }
    seen.add(hobby.hobbyID);
    result.push({ ...hobby, skillLevel: normalizeSkillLevel(hobby.skillLevel) });
  });
  return result;
}

export function normalizePushNotificationSettings(settings: unknown): PushNotificationSettings {
  const result = { ...DEFAULT_PUSH_NOTIFICATION_SETTINGS };
  if (settings && typeof settings === 'object') {
    (Object.keys(result) as (keyof PushNotificationSettings)[]).forEach((key) => {
      const value = (settings as Partial<PushNotificationSettings>)[key];
      if (typeof value === 'boolean') {
        result[key] = value;
      }
    });
  }
  return result;
}

/**
 * @param raw the document data, or null/undefined if the document does not exist
 * @param uid the document id; used when the document has no `uid` field
 */
export function normalizeUser(raw: any, uid: string): User | null {
  if (!raw) {
    return null;
  }
  return {
    ...raw,
    uid: raw.uid || uid,
    hobbies: normalizeUserHobbies(raw.hobbies),
    photos: asArray<string>(raw.photos).filter((photo) => !!photo),
    chats: asArray<string>(raw.chats),
    friend: asArray<string>(raw.friend),
    blockedUsers: asArray<string>(raw.blockedUsers),
    // Older builds saved an empty token before one was available.
    device: asArray<string>(raw.device).filter((token) => !!token),
    isActive: asArray(raw.isActive),
    activeHobby: raw.activeHobby || {},
    pushNotificationSettings: normalizePushNotificationSettings(raw.pushNotificationSettings),
  };
}

export function normalizeHobbyMember(raw: any): HobbyMember {
  return {
    ...raw,
    photos: asArray<string>(raw?.photos).filter((photo) => !!photo),
    skillLevel: normalizeSkillLevel(raw?.skillLevel),
  };
}
