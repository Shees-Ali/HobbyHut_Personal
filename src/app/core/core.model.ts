export interface Hobby {
  hobbyID: string;
  members: string[];
  parent_room: string;
  meta?: unknown;
  name: string;
  icon: string;
}

export interface UserHobbies {
  hobbyID;
  meta;
  name;
  skillLevel: SkillLevel;
}

export interface User {
  activeHobby: Partial<Hobby>;
  chats: string[];
  displayName: string;
  dob: string;
  username: string;
  email: string;
  gender: Gender;
  hobbies: UserHobbies[];
  photos: string[];
  profilePicture: string;
  uid: string;
  isActive: string[];
  device: string[];
  blockedUsers: string[];
  phoneNumber: string;
  pushNotificationSettings: {
    messagesReceived: boolean;
    messagesRequested: boolean;
    groupMessage: boolean;
    timerFromTop20Contacts: boolean;
    timerToTop5Contacts: boolean;
    proGameRequest: boolean;
    recordBookPublic: boolean;
  };
}

export interface Game {
  id: string;
  hobby: Partial<Hobby>;
  player1: Partial<User>;
  player2: Partial<User>;
  status: Partial<GameStatus>;
  score: {
    player1: number;
    player2: number;
    player1Won: string;
    player2Won: string;
  };
  scoreAcceptedAt: number;
  scoreCreatedAt: number;
  scoreRejectedAt: number;
  scoreRejected: boolean;
  correctedScore: {
    player1: number;
    player2: number;
    player1Won: string;
    player2Won: string;
  };
  correctedScoreAcceptedAt: number;
  correctedScoreCreatedAt: number;
  correctedScoreRejectedAt: number;
  correctedScoreRejected: boolean;
  createdAt: number;
  requestAcceptedAt: number;
  requestRejectedAt: number;
  isFriendly: boolean;
}

export interface GameRecord {
  game: Partial<Game>;
  player1Skill: SkillLevel;
  player2Skill: SkillLevel;
}

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
