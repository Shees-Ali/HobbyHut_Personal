/**
 * Core Facade
 *
 * Departure from the actual facade pattern, built this way with the interest of time
 */
import { Inject, Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { GeoPoint, arrayRemove, arrayUnion } from '@angular/fire/firestore';
import { PhoneAuthProvider } from '@angular/fire/auth';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import * as moment from 'moment';
import { Router } from '@angular/router';
import {
  ToastController,
  AlertController,
  LoadingController,
  Platform,
  AnimationController,
} from '@ionic/angular';
import { LinkedinService } from '../linkedin.service';
import { AuthService } from '../auth.service';
import { BehaviorSubject, Observable, Subject, Subscription, combineLatest, of } from 'rxjs';
import {
  filter,
  shareReplay,
  switchMap,
  take,
  tap,
  map,
  first,
  catchError,
  timeout,
} from 'rxjs/operators';
import {
  ActiveDoc,
  ActiveEntry,
  Chat,
  ChatDoc,
  Hobby,
  HobbyMember,
  Message,
  PhotoPosition,
  PushNotificationSettings,
  SkillLevel,
  User,
  UserHobby,
  UserInfo,
} from './core.model';
import {
  DEFAULT_PUSH_NOTIFICATION_SETTINGS,
  normalizeHobbyMember,
  normalizeUser,
} from './normalize';
import { FeedbackService, describeError } from './feedback.service';
import {
  PROFILE_VERSION,
  isListableMember,
  isProfileComplete,
  isValidDob,
  isValidGender,
  isValidUsername,
  toDateOnly,
} from './profile';
import { HTTP } from '@ionic-native/http/ngx';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as geofirestore from 'geofirestore';
import * as firebase from 'firebase/app';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { NativeSettings, IOSSettings } from 'capacitor-native-settings';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import * as _ from 'lodash';
type Hobbies = Observable<Hobby[]>;

/**
 * PRODUCT DECISION PENDING (see docs/open-decisions.md).
 *
 * false: after a request is declined the sender stays marked as "request sent" and
 *        cannot ask the same person again. This is how the app has always behaved.
 * true:  declining also clears that mark, so the sender can ask again.
 */
const DECLINE_ALLOWS_NEW_REQUEST = false;

type OwnChat = ChatDoc & { chatID: string };

/** An error with a reason that is safe and useful to show to the user. */
function userError(code: string, userMessage: string): Error {
  return Object.assign(new Error(userMessage), { code, userMessage });
}

declare var window;
@Injectable({
  providedIn: 'root',
})
export class CoreFacade {
  /** The signed-in user's chats (never anyone else's). Shared: one listener for all subscribers. */
  chats$: Observable<OwnChat[]>;
  confirmationResult: any;
  currentHobbyRoom = new BehaviorSubject('');
  currentHobbyId = new BehaviorSubject('');
  fsChatsCollection = this.afFs.collection('chats');
  fsHobbiesCollection = this.afFs.collection<Hobby[]>('hobbies', (ref) =>
    ref.orderBy('name').where('status', '==', 'active'),
  );
  fsUsersCollection = this.afFs.collection('users');
  fsGamesCollection = this.afFs.collection('games');
  fsPostCollection = this.afFs.collection('posts');
  fsPostChatCollection = this.afFs.collection('posts-chat');
  hobbies$: Hobbies;
  unreadRequest: any = [];
  messageLength: number;
  toptenString: string;
  messageReceived = new Subject();
  private locationActiveSource = new BehaviorSubject(undefined);
  locationActive$ = this.locationActiveSource.asObservable();
  recaptchaVerifier: any;
  timerStatus$ = new BehaviorSubject('disabled');
  timerStatusP$ = new BehaviorSubject('disabled');
  homeStatus$ = new BehaviorSubject('disabled');
  inputStatus$ = new BehaviorSubject('disabled');
  timerStatusWaitingScore$ = new BehaviorSubject('disabled');
  UpdatedUser$: any;
  token = '';
  GeoFirestore;
  geoLocationSubscription;
  isAllUser: any = true;
  isAllPosts: any = true;
  radius;
  user: User;
  user$: Observable<User>;
  // Add BehaviorSubject for user
  private userSubject = new BehaviorSubject<User | null>(null);
  selfData = { id: '', firstName: '', lastName: '' };
  animationObject: any = null;
  currentSelectedhobby: any;
  filters: any;
  hobbiesList = [];
  messageUserId: any = null;
  private expiredActivesSubscription: Subscription;
  private latestActives: ActiveDoc[] = [];
  private expiringActives = new Set<string>();
  advertismentImages: any[] = [];
  postChat$;
  constructor(
    private afFs: AngularFirestore,
    private afAuth: AngularFireAuth,
    private afStorage: AngularFireStorage,
    private toastController: ToastController,
    private router: Router,
    // private facebook: Facebook,
    private alertController: AlertController,
    private linkedinService: LinkedinService,
    // private signInWithApple: SignInWithApple,
    private loadingController: LoadingController,
    private platform: Platform,
    private http: HTTP,
    private ht: HttpClient,
    private authService: AuthService,
    // private locationAccuracy: LocationAccuracy,
    private androidPermissions: AndroidPermissions,
    // private diagnostic: Diagnostic,
    private geolocation: Geolocation,
    public animationCtrl: AnimationController,
    /** For telling the user what happened to something they did. */
    public feedback: FeedbackService,
  ) {
    this.GeoFirestore = geofirestore.initializeApp(this.afFs.firestore);

    this.hobbies$ = this.fsHobbiesCollection.valueChanges({
      idField: 'hobbyID',
    }) as unknown as Hobbies;
    this.user$ = null;
    this.user$ = this.afAuth.user.pipe(
      filter((user) => !!user),
      switchMap((authUser: any) =>
        this.afFs
          .doc(`users/${authUser.uid}`)
          .valueChanges()
          .pipe(
            // A brand-new user's Firestore doc may not exist yet; wait until it does.
            filter((userDoc: any) => !!userDoc),
            map((userDoc: any) => normalizeUser(userDoc, authUser.uid)),
          ),
      ),
      tap((user: User) => {
        this.user = user;
        // Emit the user to the BehaviorSubject
        this.userSubject.next(this.user);
      }),
      shareReplay(1),
    );

    this.chats$ = this.afAuth.user.pipe(
      switchMap((authUser: any): Observable<OwnChat[]> => {
        if (!authUser) {
          return of([]);
        }
        const uid: string = authUser.uid;
        // Only this user's chats are requested from Firestore. Every chat must carry
        // `participantIds` (added to old chats by the 2026-11 data migration).
        const chats = this.afFs.collection<ChatDoc>('chats', (ref) =>
          ref.where('participantIds', 'array-contains', uid),
        );
        return (chats.valueChanges({ idField: 'chatID' }) as Observable<OwnChat[]>).pipe(
          map((own) =>
            own.filter(
              (chat) =>
                Array.isArray(chat.participants) &&
                chat.participants.some((participant) => participant?.uid === uid),
            ),
          ),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.postChat$ = this.afFs.collection('posts-chat').valueChanges({ idField: 'postChatID' });
  }

  /** Adds a hobby to the signed-in user (or updates the skill level if they have it). */
  async addUserHobby(
    hobby: Pick<Hobby, 'hobbyID' | 'name'>,
    skillLevel: SkillLevel,
  ): Promise<void> {
    const user = await this.getCurrentUser();
    const entry: UserHobby = { name: hobby.name, hobbyID: hobby.hobbyID, skillLevel };
    await this.fsUsersCollection.doc(user.uid).update({
      hobbies: [...user.hobbies.filter((item) => item.hobbyID !== hobby.hobbyID), entry],
    });
  }

  createGame(hobbyID: string, user: User) {
    if (user.pushNotificationSettings && user.pushNotificationSettings.proGameRequest) {
      user.device.forEach((token) => {
        const notificationData = {
          title: 'New message',
          body: 'Received new game request from ' + this.user.displayName,
        };
        const bodyData = {
          gameID: '',
          request: 'game-request',
        };
        this.sendNotification(token, notificationData, bodyData);
      });
    }
    const gameData = {
      hobby: this.afFs.doc('hobbies/' + hobbyID).ref,
      player1: this.afFs.doc('users/' + this.user.uid).ref,
      player2: this.afFs.doc('users/' + user.uid).ref,
      status: 'pending',
      createdAt: Date.now(),
    };
    return new Promise<any>((resolve, reject) => {
      this.fsGamesCollection.add(gameData).then(
        async (res) => {
          resolve(await res.get());
        },
        (err) => reject(err),
      );
    });
  }

  updateGame(gameId, updatedGame) {
    return new Promise<any>((resolve, reject) => {
      this.fsGamesCollection
        .doc(gameId)
        .set(updatedGame, { merge: true })
        .then(
          (res) => {
            resolve(res);
          },
          (err) => reject(err),
        );
    });
  }

  /**
   * Deletes the signed-in account and signs out. The cleanupUser Cloud Function then
   * removes the user's data (profile, hobby memberships, chats, photos).
   *
   * Rejects without changing anything if the deletion is refused, most often with
   * `auth/requires-recent-login` when the user signed in too long ago.
   */
  async deleteAccount(): Promise<void> {
    const authUser = await this.afAuth.currentUser;
    if (!authUser) {
      throw Object.assign(new Error('No user signed in'), { code: 'unauthenticated' });
    }
    await authUser.delete();
    localStorage.clear();
    await this.afAuth.signOut().catch((err) => console.error('Sign out after delete failed', err));
  }

  /**
   * Watches the "ready now" list and removes entries whose 30 minutes are up.
   * Safe to call often: there is only ever one listener, and every call re-checks.
   */
  fetchExpiredActiveHobbies() {
    if (!this.expiredActivesSubscription || this.expiredActivesSubscription.closed) {
      this.expiredActivesSubscription = this.afFs
        .collection<ActiveDoc>('active')
        .valueChanges()
        .subscribe(
          (actives) => {
            this.latestActives = actives;
            this.removeExpiredFrom(actives);
          },
          (err) => console.error('Could not watch the ready-now list', err),
        );
    }
    this.removeExpiredFrom(this.latestActives);
  }

  private removeExpiredFrom(actives: ActiveDoc[]) {
    const now = Date.now();
    (actives || []).forEach((active) => {
      (active?.hobby || []).forEach((entry) => {
        if (now > entry.start + 30 * 60 * 1000) {
          this.removeExpiredActives(entry.name, active.uid);
        }
      });
    });
  }

  /** Background clean-up; failures are logged, not shown. */
  private async removeExpiredActives(hobbyName: string, uid: string): Promise<void> {
    const key = `${uid}/${hobbyName}`;
    if (this.expiringActives.has(key)) {
      return;
    }
    this.expiringActives.add(key);
    try {
      await this.updateActiveEntries(uid, (entries) =>
        entries.filter((entry) => entry.name !== hobbyName),
      );
    } catch (err) {
      console.error('Could not remove an expired ready-now entry', err);
    } finally {
      this.expiringActives.delete(key);
    }
  }

  /**
   * Changes a user's running timers. users/{uid}.isActive and active/{uid} are written
   * together, from the latest stored value, so concurrent changes cannot lose each other.
   */
  private async updateActiveEntries(
    uid: string,
    change: (entries: ActiveEntry[]) => ActiveEntry[],
  ): Promise<void> {
    const db = this.afFs.firestore;
    const userRef = db.doc(`users/${uid}`);
    const activeRef = db.doc(`active/${uid}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) {
        // Left over from a deleted user.
        tx.delete(activeRef);
        return;
      }
      const stored = snap.data()?.isActive;
      const next = change(Array.isArray(stored) ? stored : []);
      tx.update(userRef, { isActive: next });
      if (next.length > 0) {
        tx.set(activeRef, { uid, hobby: next });
      } else {
        tx.delete(activeRef);
      }
    });
  }

  /**
   * @description Use this for chats
   */
  fetchActiveUsers(): Observable<ActiveDoc[]> {
    return this.userSubject.pipe(
      filter((user) => !!user && !!user.uid),
      switchMap(
        (user): Observable<ActiveDoc[]> =>
          this.afFs
            .collection<ActiveDoc>('active', (ref) => ref.where('uid', '!=', user.uid))
            .valueChanges(),
      ),
    );
  }

  /**
   * @description Use this for hobby lobby
   */
  fetchActiveUsersByHobby(hobby: string): Observable<ActiveDoc[]> {
    return this.fetchActiveUsers();
  }

  fetchChatDetails(chatID: string): Observable<ChatDoc | undefined> {
    return this.fsChatsCollection.doc<ChatDoc>(chatID).valueChanges();
  }

  fetchChatDetailsOnce(chatID: string): Promise<ChatDoc | null> {
    return new Promise((resolve, reject) => {
      this.fsChatsCollection
        .doc(chatID)
        .ref.get()
        .then((doc) => {
          if (doc.exists) {
            return resolve(doc.data() as ChatDoc);
          } else {
            return resolve(null);
          }
        })
        .catch((err) => {
          return reject(err);
        });
    });
  }

  fetchHobbyMembers(hobbyID) {
    if (this.isAllUser) {
      if (this.geoLocationSubscription) {
        this.geoLocationSubscription();
        this.geoLocationSubscription = false;
      }
      return this.afFs
        .collection(`hobbies/${hobbyID}/members`)
        .valueChanges()
        .pipe(
          map((members: any[]) => members.map(normalizeHobbyMember).filter(isListableMember)),
        );
    } else {
      return this.getUserList(hobbyID).then((members) => {
        return members;
      });
    }
  }

  getUserList(hobbyID: string): Promise<HobbyMember[]> {
    return new Promise(async (resolve, reject) => {
      const members: HobbyMember[] = [];
      const geocollection = this.GeoFirestore.collection(`hobbies/${hobbyID}/members`);
      const location: any = await this.getCurrentLocation();
      console.log('In Get Users List', this.radius);
      const query = geocollection.near({
        center: new GeoPoint(location.lat, location.lng),
        radius: this.radius,
      });
      this.geoLocationSubscription = query.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const member = normalizeHobbyMember(change.doc.data());
          if (isListableMember(member)) {
            members.push(member);
          }
        });
        resolve(members);
      });
    });
  }

  /** Members of a hobby, excluding the current user. Resolves once with the current list. */
  fetchHobbyMembersByHobbyId(hobbyId: string): Promise<HobbyMember[]> {
    return new Promise((resolve, reject) => {
      this.afFs
        .collection(`hobbies/${hobbyId}/members`)
        .valueChanges()
        .pipe(first())
        .subscribe(
          (members: any[]) => {
            const currentUid = this.user?.uid;
            resolve(
              members
                .map(normalizeHobbyMember)
                .filter((member) => member.uid !== currentUid && isListableMember(member)),
            );
          },
          (err) => reject(err),
        );
    });
  }

  async sendNotificationToTop5Contacts(members: Chat[], hobbyName, hobbyID) {
    if (this.user.pushNotificationSettings?.timerToTop5Contacts === false) {
      return;
    }
    for (let memberIndex = 0; memberIndex < members.length; memberIndex++) {
      const member = members[memberIndex];
      let memberData: any = await this.getUserObj(member.participant.uid);
      const currentUserUid = this.user.uid;
      if (
        memberData.pushNotificationSettings &&
        memberData.pushNotificationSettings.timerFromTop20Contacts &&
        member.meta.isInTopFive &&
        member.meta.isInTopFive[currentUserUid] === true
      ) {
        memberData.device.forEach((token) => {
          const notificationData = {
            title: 'Timer Started',
            body: this.user.displayName + ' has started timer for ' + hobbyName,
          };
          const bodyData = {
            chatID: member.chatID,
            request: 'message',
          };
          this.sendNotification(token, notificationData, bodyData);
        });
      }
    }
  }

  updateRadius(radius) {
    this.isAllUser = false;
    this.isAllPosts = false;
    if (radius > 50) {
      this.isAllUser = true;
      this.isAllPosts = true;
    } else {
      this.isAllUser = false;
      this.isAllPosts = false;
    }
    // this.radius = radius
    this.radius = radius * 1.609;
  }

  getUser(userID) {
    return this.afFs.doc(`users/${userID}`).get();
  }

  currentUserUpdate(userID) {
    this.UpdatedUser$ = this.afFs.doc(`users/${userID}`).valueChanges();
  }

  getCurrentUser() {
    return new Promise<User>((resolve, reject) => {
      if (this.user && this.user.uid) {
        return resolve(this.user);
      }

      this.user$
        .pipe(
          filter((user) => !!user),
          first(),
        )
        .subscribe(
          (user) => resolve(user),
          (error) => reject(error),
        );
    });
  }

  /** Reads a user once. Resolves with null if the user document does not exist. */
  getUserObj(userId: string): Promise<User | null> {
    return new Promise<User | null>((resolve, reject) => {
      this.afFs
        .doc(`users/${userId}`)
        .ref.get()
        .then((doc: any) => {
          if (doc.exists) {
            return resolve(normalizeUser(doc.data(), doc.id));
          } else {
            return resolve(null);
          }
        })
        .catch((err) => {
          return reject(err);
        });
    });
  }

  /** The user's profile picture: the most recently added photo. */
  getPhoto(user: Pick<User, 'photos'> | null | undefined): string | undefined {
    if (user && user.photos && user.photos.length > 0) {
      return user.photos[user.photos.length - 1];
    }
  }

  /**
   * Finds users by exact username (any letter case). Users who have not completed
   * their profile are never returned.
   */
  async searchUsersByUsername(query: string): Promise<any[]> {
    const username = (query || '').trim();
    if (!username) {
      return [];
    }
    const users = this.afFs.firestore.collection('users');
    // `usernameLower` is only present on profiles saved through the new profile form,
    // so also match the stored username exactly.
    const [byLower, byExact] = await Promise.all([
      users.where('usernameLower', '==', username.toLowerCase()).limit(20).get(),
      users.where('username', '==', username).limit(20).get(),
    ]);

    const found = new Map<string, User>();
    [...byLower.docs, ...byExact.docs].forEach((doc) => {
      const user = normalizeUser(doc.data(), doc.id);
      if (isProfileComplete(user)) {
        found.set(doc.id, user);
      }
    });

    return Promise.all(
      Array.from(found.values()).map(async (user) => {
        const isInChats = await this.isContactInUserChats(user.uid).pipe(take(1)).toPromise();
        return {
          uid: user.uid,
          displayName: user.displayName || '',
          username: user.username || '',
          photos: user.photos,
          isInChats: isInChats || false,
        };
      }),
    );
  }

  getGameObj(hobby, player1, player2) {
    return new Promise((resolve, reject) => {
      return (
        this.afFs.firestore
          .collection('games')
          .where('hobby', '==', this.afFs.collection('hobbies').doc(hobby).ref)
          .where('player1', '==', this.afFs.collection('users').doc(player1).ref)
          .where('player2', '==', this.afFs.collection('users').doc(player2).ref)
          .where('status', 'in', [
            'created',
            'pending',
            'accepted',
            'scoreSent',
            'scoreRejected',
            'correctedScoreSent',
          ])
          // .where('createdAt', '>', Date.now())
          .onSnapshot(
            async (querySnapshot) => {
              // let player1List = [];
              let game = null;
              querySnapshot.forEach(async (doc) => {
                game = doc.data();
                game.id = doc.id;
              });
              return resolve(game);
            },
            (err) => {
              return reject(err);
            },
          )
      );
    });
  }

  getUserGames(player1) {
    return new Promise((resolve, reject) => {
      this.getUserAllGames(player1).then((result) => {
        const games = [];
        result.forEach((docSnapshot) => {
          games.push(docSnapshot.data());
        });
        resolve(games);
      });
    });
  }

  async getUserAllGames(player1) {
    const userAsPlayer1 = this.afFs.firestore
      .collection('games')
      .where('player1', '==', this.afFs.collection('users').doc(player1).ref)
      .where('status', 'in', ['completed'])
      .where('isFriendly', '==', false)
      .get();
    const userAsPlayer2 = this.afFs.firestore
      .collection('games')
      .where('player2', '==', this.afFs.collection('users').doc(player1).ref)
      .where('status', 'in', ['completed'])
      .where('isFriendly', '==', false)
      .get();

    const [userAsPlayer1QuerySnapshot, userAsPlayer2QuerySnapshot] = await Promise.all([
      userAsPlayer1,
      userAsPlayer2,
    ]);

    const userAsPlayer1Array = userAsPlayer1QuerySnapshot.docs;
    const userAsPlayer2Array = userAsPlayer2QuerySnapshot.docs;

    const gamesArray = userAsPlayer1Array.concat(userAsPlayer2Array);
    return gamesArray;
  }

  subscribeToGameChange(game) {
    return this.afFs.firestore.collection('games').doc(game.id);
  }

  subscribeToUserChange(uid) {
    return this.afFs.firestore.collection('users').doc(uid);
  }

  getDocument(collectionName, id) {
    return new Promise((resolve, reject) => {
      this.afFs
        .doc(`${collectionName}/${id}`)
        .ref.get()
        .then((doc) => {
          if (doc.exists) {
            return resolve(doc.data());
          } else {
            return resolve(null);
          }
        })
        .catch((err) => {
          return reject(err);
        });
    });
  }

  /** Push notifications are best effort: a failure is logged and never fails the caller. */
  sendNotification(token, notificationData, bodyData) {
    // Prepare the notification
    const notifcationObj: any = {
      notification: notificationData,
      data: bodyData,
      token: token,
    };

    // URL for the cloud function
    const url = 'https://us-central1-hobby-hut-dev.cloudfunctions.net/sendNotification';

    try {
      this.http.setDataSerializer('json');
      this.http
        .post(url, notifcationObj, {})
        .then((data) => {
          console.log('Notification sent successfully', data);
        })
        .catch((error) => {
          console.error('Error sending notification', error);
        });
    } catch (error) {
      // The HTTP plugin does not exist when the app runs in a browser.
      console.warn('Notification not sent', error);
    }
  }

  /** Sends a push notification to every device of a user, if they have that setting on. */
  private notifyUser(
    user: User | null,
    setting: keyof PushNotificationSettings,
    notification: { title: string; body: string },
    data: { [key: string]: string },
  ) {
    if (!user || !user.pushNotificationSettings?.[setting]) {
      return;
    }
    user.device.forEach((token) => this.sendNotification(token, notification, data));
  }

  /**
   * Changes the participant list of a chat (unread counts, read state, members) from
   * the latest stored value, in a transaction. Two changes at the same moment are both
   * applied instead of one overwriting the other.
   *
   * @param change returns the new list, or null to leave the chat as it is
   */
  private async changeParticipants(
    docPath: string,
    change: (participants: any[]) => any[] | null,
  ): Promise<void> {
    const db = this.afFs.firestore;
    const ref = db.doc(docPath);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const stored = snap.data()?.participants;
      if (!snap.exists || !Array.isArray(stored)) {
        throw userError('not-found', 'This chat no longer exists.');
      }
      const next = change(stored.map((participant) => ({ ...participant })));
      if (next) {
        tx.update(ref, { participants: next });
      }
    });
  }

  /** Records that the signed-in user opened or left a chat. Background; failures are logged. */
  async updateChatTimestamp(chatID: string, msgThreadOpen: boolean): Promise<void> {
    try {
      const uid = this.user?.uid;
      if (!uid) {
        return;
      }
      await this.changeParticipants(`chats/${chatID}`, (participants) =>
        participants.map((participant) =>
          participant.uid !== uid
            ? participant
            : {
                ...participant,
                timestamp: Date.now(),
                isThreadOpen: msgThreadOpen,
                unreadCount: msgThreadOpen ? 0 : participant.unreadCount,
              },
        ),
      );
    } catch (err) {
      console.error('Could not update the chat read state', err);
    }
  }

  /** The signed-in user's chat with another user, if there is one. */
  private async findChatWith(otherUid: string): Promise<OwnChat | undefined> {
    const chats = await this.chats$.pipe(first()).toPromise();
    return chats.find((chat) => chat.participants.some((p) => p.uid === otherUid));
  }

  /**
   * Loads another user for a friend or message action. Rejects with a reason the user
   * can be shown when the other user is gone or has blocked the signed-in user.
   */
  private async requireOtherUser(otherUid: string): Promise<{ me: User; other: User }> {
    const me = await this.getCurrentUser();
    if (!otherUid || otherUid === me.uid) {
      throw userError('invalid-argument', 'You cannot do that with your own profile.');
    }
    const other = await this.getUserObj(otherUid);
    if (!other) {
      throw userError('not-found', 'This user no longer exists.');
    }
    if (other.blockedUsers.includes(me.uid)) {
      throw userError('blocked', `You are blocked by ${other.displayName || 'this user'}.`);
    }
    return { me, other };
  }

  /**
   * Makes sure there is exactly one chat between the signed-in user and another user.
   *
   * New chats get an id built from the two user ids, and are created in a transaction,
   * so two people starting a chat with each other at the same moment still end up with
   * one chat. Resolves with the chat id and whether it was created now.
   */
  private async ensureChat(
    me: User,
    other: User,
    isMessageRequest: boolean,
  ): Promise<{ chatID: string; created: boolean }> {
    const existing = await this.findChatWith(other.uid);
    if (existing) {
      // Adding someone as a friend settles a request that was still pending.
      if (!isMessageRequest && existing.meta?.isMessageRequest) {
        await this.fsChatsCollection
          .doc(existing.chatID)
          .update({ 'meta.isMessageRequest': false });
      }
      return { chatID: existing.chatID, created: false };
    }

    const db = this.afFs.firestore;
    const chatID = [me.uid, other.uid].sort().join('_');
    const chatRef = db.doc(`chats/${chatID}`);
    const meRef = db.doc(`users/${me.uid}`);
    const now = Date.now();

    const created = await db.runTransaction(async (tx) => {
      const snap = await tx.get(chatRef);
      if (snap.exists) {
        return false;
      }
      const chat: ChatDoc = {
        messages: [],
        participantIds: [other.uid, me.uid],
        participants: [
          {
            uid: other.uid,
            photoUrl: this.getPhoto(other) || '',
            displayName: other.displayName || '',
            timestamp: 0,
            isThreadOpen: false,
            unreadCount: 1,
          },
          {
            uid: me.uid,
            photoUrl: this.getPhoto(me) || '',
            displayName: me.displayName || '',
            timestamp: now,
            isThreadOpen: false,
            unreadCount: 0,
          },
        ],
        meta: {
          lastMessage: 'Send a message',
          timestamp: now,
          isMessageRequest,
          block: '',
          lastSenderID: me.uid,
        },
      };
      tx.set(chatRef, chat);
      // Legacy: the profile page reads this to show "request sent".
      tx.update(meRef, { chats: arrayUnion(other.uid) });
      return true;
    });

    return { chatID, created };
  }

  /**
   * Starts a chat with another user (a message request by default) and notifies them.
   * Does nothing if the two already have a chat. Resolves with the chat id.
   */
  async initiateChat(otherUser: User, isMessageRequest = true): Promise<string> {
    const me = await this.getCurrentUser();
    const { chatID, created } = await this.ensureChat(me, otherUser, isMessageRequest);
    if (created) {
      this.notifyUser(
        otherUser,
        'messagesRequested',
        {
          title: isMessageRequest ? 'Friend Request Received' : 'New Message Received',
          body: isMessageRequest
            ? 'You have received a Friend Request from ' + me.displayName
            : 'You have received a new message from ' + me.displayName,
        },
        { chatID: '', request: 'request' },
      );
    }
    return chatID;
  }

  /** Sends a message request to another user. Rejects if they are gone or have blocked you. */
  async sendMessageRequest(otherUid: string): Promise<void> {
    const { me, other } = await this.requireOtherUser(otherUid);
    // A request that was sent before and declined (the mark is still there, the chat is not).
    if (me.chats.includes(other.uid) && !(await this.findChatWith(other.uid))) {
      throw userError('already-requested', 'You have already sent this person a request.');
    }
    await this.initiateChat(other, true);
  }

  /** Makes two users friends straight away (no request) and opens a chat between them. */
  async addFriend(otherUid: string): Promise<void> {
    const { me, other } = await this.requireOtherUser(otherUid);
    const db = this.afFs.firestore;
    const batch = db.batch();
    batch.update(db.doc(`users/${me.uid}`), { friend: arrayUnion(other.uid) });
    batch.update(db.doc(`users/${other.uid}`), { friend: arrayUnion(me.uid) });
    await batch.commit();
    await this.initiateChat(other, false);
  }

  async loginWithPhone(confirmationCode, verificationId): Promise<void> {
    try {
      // this.presentLoading();
      const credential = PhoneAuthProvider.credential(verificationId, confirmationCode);

      const auth = await this.afAuth.signInWithCredential(credential);
      const uid = auth.user.uid;

      // Creates the user document if this is a new user, and records the phone number.
      await this.ensureUserDoc(auth.user);

      // Method completes successfully - Promise<void> resolves
    } catch (error) {
      console.error('Phone sign-in failed', error);
      this.showAlert('Could not sign you in', describeError(error));
      throw error; // Re-throw so caller knows operation failed
    }
  }

  async showAlert(title: string, msg: string) {
    const alert = await this.alertController.create({
      header: title,
      message: msg,
      buttons: ['OK'],
    });

    await alert.present();
  }

  loginWithEmail(email: string, password: string): Promise<any> {
    return this.afAuth.signInWithEmailAndPassword(email, password);
  }

  notifyMessageReceived(show: boolean) {
    this.messageReceived.next(show);
  }

  async removeUserHobby(hobby: Pick<UserHobby, 'hobbyID'>): Promise<void> {
    const user = await this.getCurrentUser();
    await this.fsUsersCollection.doc(user.uid).update({
      hobbies: user.hobbies.filter((userHobby) => userHobby.hobbyID !== hobby.hobbyID),
    });
  }

  /**
   * Adds messages to a chat and notifies the other person. Rejects if the save fails.
   *
   * The messages, the chat summary and the other person's unread count are written in
   * one transaction, so messages sent at the same moment are all counted.
   */
  async sendMessage(chatID: string, messages: Message[]): Promise<void> {
    if (!messages || messages.length === 0) {
      return;
    }
    const me = await this.getCurrentUser();
    const last = messages[messages.length - 1];
    const db = this.afFs.firestore;
    const chatRef = db.doc(`chats/${chatID}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(chatRef);
      const stored = snap.data()?.participants;
      if (!snap.exists || !Array.isArray(stored)) {
        throw userError('not-found', 'This chat no longer exists.');
      }
      // Field paths, so the rest of `meta` (top five positions) is left alone.
      tx.update(chatRef, {
        messages: arrayUnion(...messages),
        'meta.lastMessage': last.text,
        'meta.timestamp': Date.now(),
        'meta.isMessageRequest': false,
        'meta.block': '',
        'meta.lastSenderID': me.uid,
        // Unread only goes up for someone who does not have the chat open.
        participants: stored.map((participant) =>
          participant.uid === me.uid || participant.isThreadOpen
            ? participant
            : { ...participant, unreadCount: (participant.unreadCount || 0) + messages.length },
        ),
      });
    });

    this.notifyChatPartner(chatID, me.uid, 'messagesReceived', {
      title: 'New message',
      body: 'Received new message from ' + me.displayName,
    }, { chatID, request: 'message' });
  }

  /** Best effort: looks up the other person in a chat and sends them a notification. */
  private async notifyChatPartner(
    chatID: string,
    myUid: string,
    setting: keyof PushNotificationSettings,
    notification: { title: string; body: string },
    data: { [key: string]: string },
  ): Promise<void> {
    try {
      const chat = await this.fetchChatDetailsOnce(chatID);
      const partner = chat?.participants?.find((participant) => participant.uid !== myUid);
      if (!partner) {
        return;
      }
      this.notifyUser(await this.getUserObj(partner.uid), setting, notification, data);
    } catch (err) {
      console.error('Could not send a notification', err);
    }
  }

  /**
   * Accepts a message request: the two users become friends and the chat opens up.
   * Everything is written together, so it cannot be left half done.
   */
  async acceptRequest(chatID: string): Promise<void> {
    const me = await this.getCurrentUser();
    const chat = await this.fetchChatDetailsOnce(chatID);
    const partner = chat?.participants?.find((participant) => participant.uid !== me.uid);
    if (!chat || !partner) {
      throw userError('not-found', 'This request no longer exists.');
    }

    const db = this.afFs.firestore;
    const chatRef = db.doc(`chats/${chatID}`);
    const other = await this.getUserObj(partner.uid);
    if (!other) {
      // The person who sent it has deleted their account.
      await chatRef.delete();
      throw userError('not-found', 'This user no longer exists.');
    }

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(chatRef);
      const stored = snap.data()?.participants;
      if (!snap.exists || !Array.isArray(stored)) {
        throw userError('not-found', 'This request no longer exists.');
      }
      tx.update(chatRef, {
        'meta.isMessageRequest': false,
        'meta.lastMessage': 'Send a message',
        'meta.timestamp': Date.now(),
        'meta.block': '',
        'meta.lastSenderID': me.uid,
        participantIds: stored.map((participant) => participant.uid),
        participants: stored.map((participant) =>
          participant.uid === me.uid ? { ...participant, unreadCount: 0 } : participant,
        ),
      });
      tx.update(db.doc(`users/${me.uid}`), { friend: arrayUnion(other.uid) });
      tx.update(db.doc(`users/${other.uid}`), { friend: arrayUnion(me.uid) });
    });

    this.notifyUser(
      other,
      'messagesReceived',
      {
        title: 'Message Request Accepted',
        body: (me.displayName || 'Someone') + ' accepted your message request',
      },
      { chatID: '', request: 'Accept' },
    );
  }

  /**
   * Declines a message request: the chat is removed and nobody becomes a friend.
   * Whether the sender may ask again is controlled by DECLINE_ALLOWS_NEW_REQUEST.
   */
  declineRequest(chatID: string): Promise<void> {
    return this.endChat(chatID, {
      block: false,
      unfriend: false,
      clearRequestMark: DECLINE_ALLOWS_NEW_REQUEST,
    });
  }

  /** Blocks the other person in a chat: no longer friends, chat removed, future requests refused. */
  blockMessage(chat: Pick<Chat, 'chatID'>): Promise<void> {
    return this.endChat(chat.chatID, { block: true, unfriend: true, clearRequestMark: true });
  }

  /** Removes the other person in a chat as a friend and removes the chat. */
  removeFromChatsAndFriends(chat: Pick<Chat, 'chatID'>): Promise<void> {
    return this.endChat(chat.chatID, { block: false, unfriend: true, clearRequestMark: true });
  }

  /**
   * Removes a chat and, depending on the options, what links the two users.
   * `clearRequestMark` removes each user from the other's "request sent" list (`chats`).
   */
  private async endChat(
    chatID: string,
    options: { block: boolean; unfriend: boolean; clearRequestMark: boolean },
  ): Promise<void> {
    const me = await this.getCurrentUser();
    const db = this.afFs.firestore;
    const chatRef = db.doc(`chats/${chatID}`);
    const chat = await this.fetchChatDetailsOnce(chatID);
    const partner = chat?.participants?.find((participant) => participant.uid !== me.uid);

    const batch = db.batch();
    batch.delete(chatRef);
    if (partner) {
      const mine: { [field: string]: unknown } = {};
      const theirs: { [field: string]: unknown } = {};
      if (options.clearRequestMark) {
        mine.chats = arrayRemove(partner.uid);
        theirs.chats = arrayRemove(me.uid);
      }
      if (options.unfriend) {
        mine.friend = arrayRemove(partner.uid);
        theirs.friend = arrayRemove(me.uid);
      }
      if (options.block) {
        mine.blockedUsers = arrayUnion(partner.uid);
      }
      if (Object.keys(mine).length > 0) {
        batch.update(db.doc(`users/${me.uid}`), mine);
      }
      // Their account may have been deleted; updating a missing document would fail.
      if (Object.keys(theirs).length > 0 && (await this.getUserObj(partner.uid))) {
        batch.update(db.doc(`users/${partner.uid}`), theirs);
      }
    }
    await batch.commit();
  }

  /**
   * Shows the signed-in user as "ready now" for a hobby.
   * @param start when the timer started; pass the original time when restoring a timer
   */
  async setUserActive(hobbyName: string, start: number = Date.now()): Promise<void> {
    const user = await this.getCurrentUser();
    const hobbyId =
      user.hobbies.find((hobby) => hobby.name === hobbyName)?.hobbyID ||
      this.hobbiesList.find((hobby) => hobby.name === hobbyName)?.id;
    if (!hobbyId) {
      throw Object.assign(new Error(`Not one of your hobbies: ${hobbyName}`), {
        code: 'not-found',
      });
    }
    const entry: ActiveEntry = { name: hobbyName, start, id: hobbyId };
    await this.updateActiveEntries(user.uid, (entries) => [
      ...entries.filter((item) => item.name !== hobbyName),
      entry,
    ]);
  }

  async setUserActiveFalse(hobbyName: string): Promise<void> {
    const user = await this.getCurrentUser();
    await this.updateActiveEntries(user.uid, (entries) =>
      entries.filter((entry) => entry.name !== hobbyName),
    );
  }

  async clearAllActiveHobbies(): Promise<void> {
    const user = this.userSubject.value;
    if (!user || !user.uid) {
      return;
    }
    await this.updateActiveEntries(user.uid, () => []);
  }

  signOut() {
    localStorage.setItem('showInfoSlides', 'false');
    // this.user$= new Observable<User>
    return this.afAuth.signOut();
  }

  async signUpWithEmail(email: string, password: string): Promise<any> {
    return this.afAuth.createUserWithEmailAndPassword(email, password);
  }

  // signupWithPhone(phoneNumber: string) {
  //   if (!window.recaptchaVerifier) {
  //     window.recaptchaVerifier = new auth.RecaptchaVerifier('recaptcha');
  //   }

  //   this.afAuth.auth.languageCode = 'gb';
  //   const applicationVerifier = window.recaptchaVerifier;
  //   return this.afAuth.auth.signInWithPhoneNumber(phoneNumber, applicationVerifier);
  // }

  // signInWithPhoneNumberNew(phoneNumber: string) {
  //   // alert(phoneNumber);
  //   return new Promise((resolve) => {
  //     (<any>window).FirebasePlugin.verifyPhoneNumber(
  //       phoneNumber,
  //       60,
  //       function (resSuccess) {
  //         resolve({ success: true, response: resSuccess });
  //       },
  //       function (error) {
  //         resolve({ success: false, error: error });
  //       }
  //     );
  //   });
  // }

  // async LoginWithCredentail(verificationId, code) {
  //   var credential = firebase.auth.PhoneAuthProvider.credential(verificationId, code);
  //   return this.afAuth
  //     .signInWithCredential(credential)
  //     .then((responseCredential) => {
  //       return { success: true, response: responseCredential, message: 'Done' };
  //     })
  //     .catch((err) => {
  //       return { success: false, response: err, message: err.message };
  //     });
  // }

  updateUserActiveHobby(hobby: Partial<UserHobby>, user: Pick<User, 'uid'>) {
    return this.fsUsersCollection.doc(user.uid).update({
      activeHobby: hobby,
    });
  }

  /**
   * @Service User Facade
   *
   * Update members array with users id
   */
  updateUserHobbies(hobby: Partial<Hobby>, skillLevel: SkillLevel): Promise<void> {
    const entry: UserHobby = {
      hobbyID: hobby.hobbyID,
      name: hobby.name,
      skillLevel,
      meta: hobby.meta || {},
    };
    const current = this.user.hobbies;
    const hobbies = current.some((userHobby) => userHobby.hobbyID === hobby.hobbyID)
      ? current.map((userHobby) => (userHobby.hobbyID === hobby.hobbyID ? entry : userHobby))
      : [...current, entry];

    return this.fsUsersCollection.doc(this.user.uid).update({ hobbies });
  }

  /**
   * Makes sure the signed-in user has a user document and returns it.
   *
   * New users get a starter document. It is written with merge so it never overwrites
   * anything that is already there, and it leaves the profile fields empty: the user
   * fills those in on the complete-profile page.
   */
  async ensureUserDoc(authUser: {
    uid: string;
    email?: string | null;
    phoneNumber?: string | null;
  }): Promise<User> {
    const uid = authUser.uid;
    const existing = await this.getUserObj(uid);
    // Digits only, to match how contacts are looked up.
    const phoneNumber = (authUser.phoneNumber || '').replace(/\D/g, '');

    if (existing) {
      const patch: Partial<User> = {};
      if (!existing.phoneNumber && phoneNumber) {
        patch.phoneNumber = phoneNumber;
      }
      if (!existing.email && authUser.email) {
        patch.email = authUser.email;
      }
      if (Object.keys(patch).length > 0) {
        await this.fsUsersCollection.doc(uid).set(patch, { merge: true });
      }
      return { ...existing, ...patch };
    }

    const starter: Partial<User> = {
      uid,
      hobbies: [],
      chats: [],
      photos: [],
      activeHobby: {},
      pushNotificationSettings: { ...DEFAULT_PUSH_NOTIFICATION_SETTINGS },
    };
    if (phoneNumber) {
      starter.phoneNumber = phoneNumber;
    }
    if (authUser.email) {
      starter.email = authUser.email;
    }
    await this.fsUsersCollection.doc(uid).set(starter, { merge: true });
    return normalizeUser(starter, uid);
  }

  /**
   * Is this username free for the given user? Usernames are unique regardless of
   * letter case.
   */
  async isUsernameAvailable(username: string, uid: string): Promise<boolean> {
    const lower = username.toLowerCase();
    const db = this.afFs.firestore;

    // A claim document is the authority once it exists.
    const claim = await db.doc(`usernames/${lower}`).get();
    if (claim.exists) {
      return claim.data()?.uid === uid;
    }

    // Profiles saved before claims existed: look for anyone else using the name.
    const users = db.collection('users');
    const [byLower, byExact] = await Promise.all([
      users.where('usernameLower', '==', lower).limit(2).get(),
      users.where('username', '==', username).limit(2).get(),
    ]);
    return ![...byLower.docs, ...byExact.docs].some((doc) => doc.id !== uid);
  }

  /**
   * Saves the required profile fields and marks the profile as complete.
   *
   * The username is claimed in the same transaction, so two users can never end up
   * with the same one. Rejects with `code: 'username-taken'` if it is already in use
   * and `code: 'photo-required'` if the user has no photo yet.
   */
  async saveProfile(profile: {
    displayName: string;
    username: string;
    dob: string;
    gender: User['gender'];
  }): Promise<void> {
    const uid = (await this.afAuth.currentUser)?.uid;
    if (!uid) {
      throw Object.assign(new Error('You are signed out. Please sign in again.'), {
        code: 'signed-out',
      });
    }

    const displayName = (profile.displayName || '').trim();
    const username = (profile.username || '').trim();
    const dob = toDateOnly(profile.dob);
    if (
      !displayName ||
      !isValidUsername(username) ||
      !isValidDob(dob) ||
      !isValidGender(profile.gender)
    ) {
      throw Object.assign(new Error('Please check the highlighted fields.'), {
        code: 'invalid-profile',
      });
    }

    if (!(await this.isUsernameAvailable(username, uid))) {
      throw Object.assign(new Error('That username is already taken.'), {
        code: 'username-taken',
      });
    }

    const db = this.afFs.firestore;
    const lower = username.toLowerCase();
    const userRef = db.doc(`users/${uid}`);
    const claimRef = db.doc(`usernames/${lower}`);

    await db.runTransaction(async (tx) => {
      // All reads first, then writes.
      const [userSnap, claimSnap] = await Promise.all([tx.get(userRef), tx.get(claimRef)]);
      const current: any = userSnap.data() || {};
      const previousLower: string | undefined = current.usernameLower;
      const previousClaimRef =
        previousLower && previousLower !== lower ? db.doc(`usernames/${previousLower}`) : null;
      const previousClaimSnap = previousClaimRef ? await tx.get(previousClaimRef) : null;

      if (claimSnap.exists && claimSnap.data()?.uid !== uid) {
        throw Object.assign(new Error('That username is already taken.'), {
          code: 'username-taken',
        });
      }
      if (!Array.isArray(current.photos) || current.photos.filter((photo) => !!photo).length === 0) {
        throw Object.assign(new Error('Please add a profile photo.'), { code: 'photo-required' });
      }

      if (previousClaimRef && previousClaimSnap.exists && previousClaimSnap.data()?.uid === uid) {
        tx.delete(previousClaimRef);
      }
      tx.set(claimRef, { uid, username });
      tx.set(
        userRef,
        {
          uid,
          displayName,
          username,
          usernameLower: lower,
          dob,
          gender: profile.gender,
          profileVersion: PROFILE_VERSION,
        },
        { merge: true },
      );
    });

    // The save is on the server, but the live user stream (and any read that shares its
    // listener) only catches up a moment later. Wait for it, so whatever runs next, such
    // as the route guard, sees the completed profile instead of the previous state.
    try {
      await this.user$
        .pipe(
          filter((user) => !!user && user.uid === uid && isProfileComplete(user)),
          first(),
          timeout(8000),
        )
        .toPromise();
    } catch (err) {
      // Slow connection. The save itself succeeded, so carry on.
      console.warn('Saved the profile, but the live profile has not updated yet', err);
    }
  }

  /**
   * True when the live copy of this user's profile is complete. A one-off read straight
   * after a save can still return the previous state; the live copy does not.
   */
  isLiveProfileComplete(uid: string): boolean {
    return !!this.user && this.user.uid === uid && isProfileComplete(this.user);
  }

  updateUserpushNotificationSettings(
    pushNotificationSettings: Partial<PushNotificationSettings>,
  ) {
    const sanitized = { ...(pushNotificationSettings || {}) };
    Object.keys(sanitized).forEach((key) => {
      sanitized[key] = sanitized[key] === undefined ? true : !!sanitized[key];
    });
    return this.fsUsersCollection
      .doc(this.user.uid)
      .set({ pushNotificationSettings: sanitized }, { merge: true })
      .catch((err) => {
        console.error('Error saving notification settings', err);
        this.presentToast('Could not save notification settings. Please try again.');
      });
  }

  /** Background update; failures are logged, not shown. */
  async updateUserLocation(location): Promise<void> {
    if (!location || !this.user?.uid) {
      return;
    }
    try {
      await this.GeoFirestore.collection('users')
        .doc(this.user.uid)
        .update({ coordinates: new GeoPoint(location.lat, location.lng) });
    } catch (err) {
      console.error('Could not save your location', err);
    }
  }

  /** Background update; failures are logged, not shown. */
  async updateUserLocationInHobby(location, hobbyID): Promise<void> {
    if (!location || !hobbyID || !this.user?.uid) {
      return;
    }
    try {
      await this.GeoFirestore.collection(`hobbies/${hobbyID}/members`)
        .doc(this.user.uid)
        .update({ coordinates: new GeoPoint(location.lat, location.lng) });
    } catch (err) {
      // Expected when the user is not (yet) listed in this hobby.
      console.warn('Could not save your location in this hobby', err);
    }
  }

  /**
   * Uploads a photo and adds it to the user's photos. Resolves with the photo URL.
   * Shows a toast and rejects if the upload or the save fails.
   */
  async uploadProfilePic(filePath: string, file: unknown, uid: string): Promise<string> {
    const loading = await this.loadingController.create({ message: 'Uploading photo' });
    await loading.present();
    try {
      const res: any = await this.afStorage.upload(filePath, file, {
        customMetadata: {
          userID: uid,
        },
      });
      const url: string = await res.ref.getDownloadURL();
      await this.fsUsersCollection.doc(uid).set({ photos: arrayUnion(url) }, { merge: true });
      return url;
    } catch (err) {
      console.error('Error uploading profile photo', err);
      this.presentToast('Could not save profile photo. Please try again.');
      throw err;
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Saves where the user's profile picture sits in its frame.
   * Shows a toast and rejects if the save fails.
   */
  async updatePhotoPosition(uid: string, position: PhotoPosition): Promise<void> {
    const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
    const photoPosition: PhotoPosition = {
      url: position.url,
      x: clamp(position.x),
      y: clamp(position.y),
    };
    try {
      await this.fsUsersCollection.doc(uid).set({ photoPosition }, { merge: true });
    } catch (err) {
      console.error('Error saving profile photo position', err);
      this.presentToast('Could not save photo position. Please try again.');
      throw err;
    }
  }

  /** CSS `object-position` for the user's profile picture; centred unless the user moved it. */
  getPhotoObjectPosition(user: Pick<User, 'photos' | 'photoPosition'> | null | undefined): string {
    const pos = user?.photoPosition;
    if (pos && pos.url === this.getPhoto(user) && isFinite(pos.x) && isFinite(pos.y)) {
      return `${pos.x}% ${pos.y}%`;
    }
    return '50% 50%';
  }

  verifyConfirmationCode(confirmationCode: string) {
    return window.confirmationResult.confirm(confirmationCode);
  }

  setDeviceForUser() {
    console.log('[PushNotifications] setDeviceForUser called, token:', this.token, 'user:', this.user?.uid);

    if (!this.token) {
      console.warn('[PushNotifications] No token available, skipping device update');
      return Promise.resolve();
    }

    if (!this.user || !this.user.uid) {
      console.warn('[PushNotifications] No user available, skipping device update');
      return Promise.resolve();
    }

    // Remove any empty/null tokens that may have been saved previously
    const existingDevices = (this.user.device || []).filter((userDevice) => !!userDevice);

    if (existingDevices.length > 0) {
      const isDevice = existingDevices.filter((userDevice) => {
        return userDevice === this.token;
      });
      if (isDevice.length === 0) {
        console.log('[PushNotifications] Adding new token to existing devices');
        return this.fsUsersCollection.doc(this.user.uid).update({
          device: [...existingDevices, this.token],
        });
      } else {
        console.log('[PushNotifications] Token already exists in user devices');
      }
    } else {
      console.log('[PushNotifications] Creating device array with new token');
      return this.fsUsersCollection.doc(this.user.uid).update({
        device: [this.token],
      });
    }
  }

  checkGPSPermission() {
    return new Promise((resolve, reject) => {
      this.androidPermissions
        .checkPermission(this.androidPermissions.PERMISSION.ACCESS_FINE_LOCATION)
        .then(
          (result) => {
            if (result.hasPermission) {
              this.askToTurnOnGPS().then((loc) => {
                resolve(loc);
              });
            } else {
              this.requestGPSPermission().then((loc) => {
                resolve(loc);
              });
            }
          },
          (err) => {
            resolve(null);
          },
        );
    });
  }

  requestGPSPermission() {
    return new Promise((resolve, reject) => {
      //   this.locationAccuracy.canRequest().then((canRequest: boolean) => {
      //     if (canRequest) {
      //     } else {
      this.androidPermissions
        .requestPermission(this.androidPermissions.PERMISSION.ACCESS_FINE_LOCATION)
        .then(
          () => {
            this.askToTurnOnGPS().then((loc) => {
              resolve(loc);
            });
          },
          (error) => {
            //console.log('requestPermission Error requesting location permissions ' + error);
          },
        );
      //     }
      //   });
    });
  }

  askToTurnOnGPS() {
    return new Promise((resolve, reject) => {
      // this.locationAccuracy.request(this.locationAccuracy.REQUEST_PRIORITY_HIGH_ACCURACY).then(
      //   (res) => {
      this.getCurrentLocation().then((loc) => {
        resolve(loc);
      });
      //   },
      //   (error) => {
      //     if (error.code == 4) {
      //       this.locationActiveSource.next(false);
      //     }
      //   }
      // );
    });
  }

  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      const posOptions = {
        maximumAge: 3000,
        timeout: 5000,
        enableHighAccuracy: true,
      };
      this.geolocation
        .getCurrentPosition(posOptions)
        .then((position) => {
          const obj = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          this.locationActiveSource.next(true);
          resolve(obj);
        })
        .catch((PositionError) => {
          reject(PositionError);
          //console.log('e', PositionError);
          if (PositionError.PERMISSION_DENIED) {
            //console.log('Denied Permission');
            this.locationActiveSource.next(false);
          }
        });
    });
  }

  enableLocationSetting() {
    NativeSettings.openIOS({
      option: IOSSettings.App,
    });
  }

  async handleSuccessfulLogin(): Promise<boolean> {
    localStorage.setItem('showInfoSlides', 'true');
    return this.router.navigateByUrl('', {
      replaceUrl: true,
    });
  }

  public async presentToast(errMsg: string): Promise<void> {
    const toast = await this.toastController.create({
      message: errMsg,
      duration: 3000,
    });
    toast.present().catch();
  }

  createAnimationInstance(objelement) {
    if (this.animationObject == null) {
      this.animationObject = this.animationCtrl
        .create()
        .addElement(objelement)
        .duration(1000)
        .iterations(Infinity)
        .keyframes([
          { offset: 0, transform: 'scale(1)' },
          { offset: 0.5, transform: 'scale(1.15) ' },
          { offset: 1, transform: 'scale(1) ' },
        ]);
    }
    return this.animationObject;
  }

  playAnimation() {
    if (this.animationObject != null) {
      this.animationObject.play();
    }
  }

  stopAnimation() {
    this.animationObject && this.animationObject.stop();
  }

  destroyAnimation() {
    if (this.animationObject) {
      this.animationObject.stop();
      this.animationObject.destroy();
      this.animationObject = null;
    }
  }

  updateInfo(info: UserInfo, user: Pick<User, 'uid'>) {
    return this.fsUsersCollection.doc(user.uid).update({
      info: info,
    });
  }

  /** Background update; failures are logged, not shown. */
  updateLastLoginTime() {
    if (this.user) {
      this.fsUsersCollection
        .doc(this.user.uid)
        .update({
          lastlogintime: moment().format(),
        })
        .catch((err) => console.error('Could not save the last login time', err));
    }
  }

  /** Creates a post and its group chat. Rejects if either write fails. */
  async createPost(post): Promise<any> {
    const loading = await this.loadingController.create({ message: 'Loading' });
    await loading.present();
    try {
      const chat = await this.createPostChat(post.subject);
      const created = await this.fsPostCollection.add({ ...post, chatId: chat.id });
      return await created.get();
    } finally {
      await loading.dismiss();
    }
  }

  getPost() {
    return this.fsPostCollection.snapshotChanges();
  }

  updatePostLocation(postID) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const location: any = await this.getCurrentLocation();
        const geocollection = this.GeoFirestore.collection(`posts`).doc(postID);
        const locationObj = {
          coordinates: new GeoPoint(location.lat, location.lng),
        };
        resolve(geocollection.update(locationObj));
      } catch (err) {
        reject(err);
      }
    });
  }

  async getPostWithRadius(): Promise<geofirestore.GeoQuery> {
    return new Promise<geofirestore.GeoQuery>((resolve, reject) => {
      if (this.isAllPosts) {
        const query: geofirestore.GeoQuery = this.GeoFirestore.collection('posts');
        resolve(query);
      } else if (!this.isAllPosts) {
        this.getCurrentLocation().then((location: any) => {
          const geocollection = this.GeoFirestore.collection(`posts`);

          const query: geofirestore.GeoQuery = geocollection.near({
            center: new GeoPoint(location.lat, location.lng),
            radius: this.radius,
          });
          resolve(query);
        });
      }
    });
  }

  deletePost(postID) {
    this.fsPostCollection.doc(postID).delete();
  }
  createPostChat(postSubject) {
    let chat = {
      postSubject: postSubject,
      messages: [],
      meta: {
        lastMessage: '',
        timestamp: Date.now(),
        isMessageRequest: false,
        lastSenderID: this.user.uid,
      },
      participants: [
        {
          uid: this.user.uid,
          photoUrl: this.user.photos || [],
          displayName: this.user.displayName,
          timestamp: Date.now(),
          isAdmin: true,
        },
      ],
    };
    return new Promise<any>((resolve, reject) => {
      this.fsPostChatCollection.add(chat).then(
        async (res) => {
          resolve(await res.get());
        },
        (err) => reject(err),
      );
    });
  }

  updatePostMessageCount(postID, count) {
    return new Promise<any>((resolve, reject) => {
      this.fsPostCollection
        .doc(postID)
        .update({
          messageCount: count,
        })
        .then(
          async (res) => {
            resolve('');
          },
          (err) => reject(err),
        );
    });
  }

  deletePostChat(chatID) {
    this.fsPostChatCollection.doc(chatID).delete();
  }

  sendPostMessage(chatID: string, messages: any[]) {
    return this.fsPostChatCollection.doc(chatID).update({
      messages: arrayUnion(...messages),
      meta: {
        lastMessage: [...messages].pop().text,
        timestamp: Date.now(),
        isMessageRequest: false,
        lastSenderID: [...messages].pop().senderID,
      },
    });
  }

  sendNotificationOfGroup(chatID: string) {
    this.fetchPostChatDetails(chatID)
      .pipe(first())
      .subscribe((chat: any) => {
        let participantsArray = chat.participants.filter((user) => user.uid !== this.user.uid);
        const self = this;
        async function forLoop(i) {
          if (i < participantsArray.length) {
            let otherUserData: any = await self.getUserObj(participantsArray[i].uid);
            console.log('otherUserData: ', otherUserData);
            if (otherUserData['device']) {
              if (
                otherUserData.pushNotificationSettings &&
                otherUserData.pushNotificationSettings.groupMessage
              ) {
                otherUserData['device'].forEach((token) => {
                  const notificationData = {
                    title: 'New group message',
                    body: 'Received new group message from ' + self.user.displayName,
                  };
                  const bodyData = {
                    chatID: chatID,
                    request: 'request',
                  };
                  self.sendNotification(token, notificationData, bodyData);
                });
              }
            }
            forLoop(i + 1);
          }
        }
        forLoop(0);
      });
  }

  /**
   * Adds people to a group chat. Anyone in `participants` who is not in the chat yet is
   * added; people already there keep their stored state (unread count).
   */
  addParticipantInPostChat(chatID: string, participants: any[]): Promise<void> {
    return this.changeParticipants(`posts-chat/${chatID}`, (stored) => {
      const present = new Set(stored.map((participant) => participant.uid));
      const added = (participants || []).filter(
        (participant) => participant?.uid && !present.has(participant.uid),
      );
      return added.length > 0 ? [...stored, ...added] : null;
    });
  }
  getPostMessage(chatID: string) {
    return this.fsPostChatCollection.doc(chatID).snapshotChanges();
  }
  /**
   * The signed-in user's chats, newest first, each with "the other person" attached.
   * Resolves once with the current list.
   */
  getContacts(): Promise<Chat[]> {
    return combineLatest([this.chats$, this.fetchActiveUsers()])
      .pipe(
        first(),
        map(([chats, activeUsers]) => {
          const uid = this.user.uid;
          return [...chats]
            .sort((chat1, chat2) => (chat2.meta?.timestamp || 0) - (chat1.meta?.timestamp || 0))
            .map((chat) => {
              const partner = chat.participants.find((participant) => participant.uid !== uid);
              const self = chat.participants.find((participant) => participant.uid === uid);
              return {
                ...chat,
                participant: {
                  ...partner,
                  isActive: activeUsers.find((activeUser) => activeUser.uid === partner?.uid),
                  isLast:
                    uid !== chat.meta?.lastSenderID &&
                    !!self &&
                    chat.meta?.timestamp > self.timestamp,
                },
              } as Chat;
            })
            .filter((chat) => !!chat.participant?.uid);
        }),
      )
      .toPromise();
  }

  fetchPostChatDetails(chatID: string) {
    return this.fsPostChatCollection.doc(chatID).valueChanges();
  }

  /** Adds one unread message for everyone in a group chat except the signed-in user. */
  updateUnreadCountInPostChat(chatID: string): Promise<void> {
    const uid = this.user.uid;
    return this.changeParticipants(`posts-chat/${chatID}`, (participants) =>
      participants.map((participant) =>
        participant.uid === uid
          ? participant
          : { ...participant, unreadCount: (participant.unreadCount || 0) + 1 },
      ),
    );
  }

  /** Marks a group chat as read for the signed-in user. Background; failures are logged. */
  updateCountonOpenChat(chatID: string): Promise<void> {
    const uid = this.user.uid;
    return this.changeParticipants(`posts-chat/${chatID}`, (participants) =>
      participants.some((participant) => participant.uid === uid && participant.unreadCount)
        ? participants.map((participant) =>
            participant.uid === uid ? { ...participant, unreadCount: 0 } : participant,
          )
        : null,
    ).catch((err) => console.error('Could not mark the group chat as read', err));
  }

  updatePost(postID: string, data: any) {
    return this.fsPostCollection.doc(postID).update(data);
  }

  async getAllAds() {
    const folderRef = this.afStorage.storage.ref('ads_new');
    const adsArray = [];

    try {
      const result = await folderRef.listAll();
      await Promise.all(
        result.items.map(async (itemRef) => {
          const [url, metadata] = await Promise.all([
            itemRef.getDownloadURL(),
            itemRef.getMetadata(),
          ]);

          adsArray.push({
            image: url,
            link: metadata.customMetadata?.link ?? '',
          });
        }),
      );
      return adsArray;
    } catch (error) {
      console.error('Error fetching ads:', error);
      return []; // Return an empty array in case of an error
    }
  }

  /**
   * Updates a chat's top five status
   */
  updateChatTopFiveStatus(
    chatId: string,
    isInTopFive: boolean,
    position: number | null,
    userId?: string,
  ): Promise<void> {
    const uid = userId || this.user.uid;

    if (isInTopFive) {
      return this.afFs
        .collection('chats')
        .doc(chatId)
        .update({
          [`meta.isInTopFive.${uid}`]: isInTopFive,
          [`meta.topFivePosition.${uid}`]: position,
        });
    } else {
      // For removal, we'll use a simpler approach - setting to null
      return this.afFs
        .collection('chats')
        .doc(chatId)
        .update({
          [`meta.isInTopFive.${uid}`]: null,
          [`meta.topFivePosition.${uid}`]: null,
        });
    }
  }

  /**
   * Gets user's top five chats
   */
  getTopFiveChats(): Observable<Chat[]> {
    return this.chats$.pipe(
      map((chats: any) => {
        const uid = this.user.uid;
        return chats
          .filter((chat) => chat.meta?.isInTopFive && chat.meta?.isInTopFive[uid] === true)
          .sort((a, b) => {
            const posA = a.meta?.topFivePosition?.[uid];
            const posB = b.meta?.topFivePosition?.[uid];
            if (posA !== undefined && posB !== undefined) {
              return posA - posB;
            }
            return 0;
          });
      }),
    );
  }

  /**
   * Check if contact is registered
   */
  checkIfContactIsRegistered(phoneNumbers: string[]): Observable<string> {
    // Check if phoneNumbers is an array and not empty
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return of(null); // Return null if input is invalid
    }

    // Create a Firestore query to check for users with matching phone numbers
    return this.afFs
      .collection('users', (ref) =>
        ref.where(
          'phoneNumber',
          'in',
          phoneNumbers.map((num) => num.replace(/\D/g, '')),
        ),
      )
      .valueChanges()
      .pipe(
        map((users: User[]) => {
          // Only users who have completed their profile count as registered.
          const registered = users.find((user) => isProfileComplete(user));
          return registered ? registered.uid : null;
        }),
        catchError(() => of(null)), // Return false in case of an error
      );
  }

  /**
   * Check if a contact is in any of the user's chats
   * @param contactuid - The UID of the contact to check
   */
  isContactInUserChats(contactuid: string): Observable<boolean> {
    return this.chats$.pipe(
      map((chats) => {
        // First filter chats to only include those where current user is a participant
        const userChats = chats.filter((chat) =>
          chat.participants.some((participant) => participant.uid === this.user.uid),
        );

        // Then check if the contact is in any of the user's chats
        return userChats.some((chat) =>
          chat.participants.some((participant) => participant.uid === contactuid),
        );
      }),
    );
  }
}
