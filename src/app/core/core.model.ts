/**
 * Shared data model. Interfaces ending in `Doc` describe a document exactly as it is
 * stored in Firestore; the others are view models the app builds on top of them.
 *
 * Collections: users, usernames, hobbies, hobbies/{id}/members, active, chats, games,
 * posts, posts-chat.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum SkillLevel {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced',
  PRO = 'Pro',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  NON_BINARY = 'non-binary',
}

export enum GameStatus {
  CREATED = 'created',
  PENDING = 'pending',
  REJECTED = 'rejected',
  ACCEPTED = 'accepted',
  SCORE_SENT = 'scoreSent',
  SCORE_REJECTED = 'scoreRejected',
  CORRECTED_SCORE_SENT = 'correctedScoreSent',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  TIMEOUT = 'timeout',
}

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

/** Firestore GeoPoint as the app reads it. */
export interface GeoPointLike {
  latitude: number;
  longitude: number;
}

/** Written by GeoFirestore next to `coordinates`; needed for radius queries. */
export interface GeoData {
  geohash: string;
  geopoint: GeoPointLike;
}

/** Firestore DocumentReference as the app reads it. */
export interface DocRefLike {
  id: string;
  path: string;
}

// ---------------------------------------------------------------------------
// Hobbies
// ---------------------------------------------------------------------------

/** hobbies/{hobbyID} */
export interface Hobby {
  /** Document id; added by `valueChanges({ idField: 'hobbyID' })`. */
  hobbyID: string;
  name: string;
  parent_room: string;
  status: 'active' | string;
  /** UIDs of members. Maintained by the Cloud Function, not by the app. */
  members: string[];
  /** Not present in current data; kept optional for the templates that read it. */
  icon?: string;
  meta?: HobbyMeta;
}

export interface HobbyMeta {
  coach?: unknown;
  equipment?: unknown;
  facilities?: unknown;
}

/** Entry in users/{uid}.hobbies */
export interface UserHobby {
  hobbyID: string;
  name: string;
  skillLevel: SkillLevel;
  meta?: HobbyMeta;
}

/** @deprecated Use `UserHobby`. */
export type UserHobbies = UserHobby;

/**
 * hobbies/{hobbyID}/members/{uid}: a copy of the user's public profile for one hobby.
 * Maintained by the Cloud Function from the user document.
 */
export interface HobbyMember {
  uid: string;
  displayName: string;
  /** Copied from the user so lists do not need one extra read per member. */
  username?: string;
  dob: string;
  gender?: Gender;
  photos: string[];
  skillLevel: SkillLevel;
  meta?: HobbyMeta;
  coordinates?: GeoPointLike;
  g?: GeoData;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface PushNotificationSettings {
  messagesReceived: boolean;
  messagesRequested: boolean;
  groupMessage: boolean;
  timerFromTop20Contacts: boolean;
  timerToTop5Contacts: boolean;
  proGameRequest: boolean;
  recordBookPublic: boolean;
}

/** Free-text answers on the profile page. */
export interface UserInfo {
  aboutMe?: string;
  heroAndSportTeam?: string;
  lastMeal?: string;
  likeToGo?: string;
  song?: string;
  timeOfWeekToPay?: string;
}

/** A running "ready now" timer. Stored in users/{uid}.isActive and active/{uid}.hobby */
export interface ActiveEntry {
  /** Hobby id. */
  id: string;
  /** Hobby name. */
  name: string;
  /** Start time, ms since epoch. */
  start: number;
}

/** active/{uid}: users who currently have at least one timer running. */
export interface ActiveDoc {
  uid: string;
  hobby: ActiveEntry[];
}

/**
 * Focal point of a profile picture inside its frame, as CSS `object-position` percentages
 * (0 = left/top, 50 = centre, 100 = right/bottom). Only applies to the photo at `url`, so a
 * newly uploaded picture starts centred.
 */
export interface PhotoPosition {
  url: string;
  x: number;
  y: number;
}

/** users/{uid} */
export interface User {
  uid: string;

  // Required before the profile is active (see core/profile.ts, added in phase 2).
  displayName: string;
  username: string;
  /** `YYYY-MM-DD` */
  dob: string;
  gender: Gender;
  /** Download URLs; the last entry is the profile picture. */
  photos: string[];
  /** Where the profile picture sits in its frame, chosen by the user by dragging. */
  photoPosition?: PhotoPosition;

  /** Lower-cased `username`, for uniqueness and search. */
  usernameLower?: string;
  /** Set by the profile completion form; absent on profiles that never completed it. */
  profileVersion?: number;
  /** Mirror of the completeness check, maintained by the Cloud Function. */
  profileComplete?: boolean;

  email?: string;
  /** Digits only, including country code. */
  phoneNumber?: string;

  hobbies: UserHobby[];
  activeHobby: Partial<UserHobby>;
  isActive: ActiveEntry[];

  /**
   * UIDs (not chat ids) of users this user has sent a message request to.
   * Legacy and unreliable; do not build new features on it.
   */
  chats: string[];
  /** UIDs of accepted friends. */
  friend: string[];
  blockedUsers: string[];

  /** FCM device tokens. */
  device: string[];
  pushNotificationSettings: PushNotificationSettings;

  info?: UserInfo;
  coordinates?: GeoPointLike;
  g?: GeoData;
  /** ISO 8601 with offset, written by moment().format(). */
  lastlogintime?: string;

  /**
   * @deprecated Holds a browser fake path (`C:\fakepath\...`) for most users.
   * Use the last entry of `photos` instead.
   */
  profilePicture?: string;
}

// ---------------------------------------------------------------------------
// Chats (1:1)
// ---------------------------------------------------------------------------

export interface Message {
  timestamp: number;
  text: string;
  senderID: string;
}

export interface Participant {
  uid: string;
  /** Snapshot taken when the chat was created; may be stale. */
  displayName: string;
  /** Snapshot taken when the chat was created; may be empty or stale. */
  photoUrl: string;
  /** Last time this participant opened the chat, ms since epoch (0 = never). */
  timestamp: number;
  isThreadOpen: boolean;
  unreadCount: number;
  // View-only, added by the app:
  isActive?: boolean | ActiveDoc;
  isLast?: boolean;
}

export interface ChatMeta {
  /** UID of the user who blocked the chat, or ''. */
  block: string;
  isMessageRequest: boolean;
  lastMessage: string;
  lastSenderID: string;
  timestamp: number;
  /** Per user: is this chat in their top five. `null` after removal. */
  isInTopFive?: { [uid: string]: boolean | null };
  /** Per user: position of this chat in their top five. `null` after removal. */
  topFivePosition?: { [uid: string]: number | null };
}

/** chats/{chatID} */
export interface ChatDoc {
  messages: Message[];
  meta: ChatMeta;
  /** Always two entries. */
  participants: Participant[];
  /** UIDs of `participants`, for querying. Added in phase 5. */
  participantIds?: string[];
}

/** A chat as shown in lists: the stored doc plus its id and "the other person". */
export interface Chat extends ChatDoc {
  chatID: string;
  participant: Participant;
  chatUnreadMessage?: boolean;
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export interface GameScore {
  /** Scores are stored as text. */
  player1: string;
  player2: string;
  /** 'W' for the winner, '' otherwise. */
  player1Won: string;
  player2Won: string;
}

interface GameBase {
  status: GameStatus;
  isFriendly: boolean;
  score: GameScore;
  correctedScore: GameScore;
  createdAt: number;
  requestAcceptedAt: number;
  requestRejectedAt: number;
  scoreCreatedAt: number;
  scoreAcceptedAt: number;
  scoreRejectedAt: number;
  scoreRejected: boolean;
  correctedScoreCreatedAt: number;
  correctedScoreAcceptedAt: number;
  correctedScoreRejectedAt: number;
  correctedScoreRejected: boolean;
}

/** games/{gameID} as stored: hobby and players are document references. */
export interface GameDoc extends Partial<GameBase> {
  hobby: DocRefLike;
  player1: DocRefLike;
  player2: DocRefLike;
}

/** A game after the app has loaded the referenced hobby and players. */
export interface Game extends GameBase {
  id: string;
  hobby: Partial<Hobby>;
  player1: Partial<User>;
  player2: Partial<User>;
}

export interface GameRecord {
  game: Partial<Game>;
  player1Skill: SkillLevel;
  player2Skill: SkillLevel;
}

// ---------------------------------------------------------------------------
// Posts and post (group) chats
// ---------------------------------------------------------------------------

/** posts/{postID} */
export interface PostDoc {
  subject: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  hobbyId: string;
  hobbyName?: string;
  /** UID of the author. */
  createdBy: string;
  /** Author's photo URL when the post was written. */
  userProfile: string;
  userSkill?: SkillLevel;
  userDisplayName: string;
  messageCount: number;
  /** Id of the posts-chat document. */
  chatId: string;
  coordinates?: GeoPointLike;
  g?: GeoData;
}

export interface PostChatParticipant {
  uid: string;
  displayName: string;
  /** Historically written as the whole `photos` array. */
  photoUrl: string | string[];
  timestamp: number;
  isAdmin?: boolean;
  unreadCount?: number;
}

/** posts-chat/{postChatID} */
export interface PostChatDoc {
  postSubject: string;
  messages: Message[];
  meta: Pick<ChatMeta, 'lastMessage' | 'timestamp' | 'isMessageRequest' | 'lastSenderID'>;
  participants: PostChatParticipant[];
}
