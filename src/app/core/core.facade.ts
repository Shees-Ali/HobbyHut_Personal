/**
 * Core Facade
 *
 * Departure from the actual facade pattern, built this way with the interest of time
 */
import { Inject, Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { GeoPoint, arrayUnion } from '@angular/fire/firestore';
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
import { Gender, SkillLevel } from './core.model';
import { LinkedinService } from '../linkedin.service';
import { AuthService } from '../auth.service';
import { BehaviorSubject, Observable, Subject, Subscription, combineLatest, of } from 'rxjs';
import { filter, shareReplay, switchMap, take, tap, map, first, catchError } from 'rxjs/operators';
import { Hobby, User, UserHobbies } from './core.model';
import { HTTP } from '@ionic-native/http/ngx';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as geofirestore from 'geofirestore';
import * as firebase from 'firebase/app';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { NativeSettings, IOSSettings } from 'capacitor-native-settings';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import * as _ from 'lodash';
import { Chat } from '../messages/interfaces/Chat';
type Hobbies = Observable<Hobby[]>;

declare var window;
@Injectable({
  providedIn: 'root',
})
export class CoreFacade {
  chats$;
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
  messagesSubscription: Subscription;
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
  messages$;
  messages = [];
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
  private loading: any;
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
            map((userDoc: any) => ({
              uid: authUser.uid,
              ...userDoc,
              hobbies: userDoc.hobbies || [],
            })),
          ),
      ),
      tap((user: any) => {
        this.user = user;
        // Emit the user to the BehaviorSubject
        this.userSubject.next(this.user);
      }),
      shareReplay(1),
    );

    this.chats$ = this.afFs.collection('chats').valueChanges({ idField: 'chatID' });
    this.postChat$ = this.afFs.collection('posts-chat').valueChanges({ idField: 'postChatID' });
  }

  addUserHobby(hobby, skillLevel) {
    this.userSubject
      .pipe(
        filter((user) => !!user && !!user.uid),
        first(),
      )
      .subscribe((user) => {
        this.fsUsersCollection.doc(user.uid).update({
          hobbies: [...user.hobbies, { name: hobby.name, hobbyID: hobby.hobbyID, skillLevel }],
        });
      });
  }

  createGame(hobbyID, user) {
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

deleteAccount() {
  return new Promise((resolve, reject) => {
    this.afAuth.authState.pipe(take(1)).subscribe(async (user) => {
      if (user) {
        try {
          // Remove the user from hobby members and active lists before deleting the Auth user
          const uid = user.uid;
          await Promise.all(
            (this.user?.hobbies || []).map((hobby) =>
              this.afFs.doc(`hobbies/${hobby.hobbyID}/members/${uid}`).delete(),
            ),
          );
          await this.afFs.collection('active').doc(uid).delete();

          // Delete the user account
          await user.delete();
          console.log('Account deleted successfully');
          
          // Clear local storage
          localStorage.clear();
          
          // Sign out the user (this will clear the auth state)
          await this.afAuth.signOut();
          
          // Navigate to login/welcome screen
          await this.router.navigateByUrl('sign-in', { replaceUrl: true });
          
          // Show success message
          this.presentToast('Account deleted successfully');
          
          resolve(true);
        } catch (error) {
          console.error('Error deleting account:', error);
          this.presentToast('Error deleting account: ' + error.message);
          reject(error);
        }
      } else {
        console.error('No user signed in to delete');
        reject(new Error('No user signed in'));
      }
    });
  });
}

  fetchExpiredActiveHobbies() {
    this.afFs
      .collection('active')
      .valueChanges()
      .pipe()
      .subscribe((v) => {
        v.forEach((actives) => {
          actives['hobby'].forEach((hobby) => {
            let createdAt = 0;
            let now = 0;
            let expiredAt = 0;
            createdAt = hobby.start;
            now = new Date().getTime();
            expiredAt = createdAt + 30 * 60 * 1000;
            if (now > expiredAt) {
              this.removeExpiredActives(hobby.name, actives['uid']);
            } else {
            }
          });
        });
      });
  }

  removeExpiredActives(hobbyName, uid) {
    this.fsUsersCollection
      .doc(uid)
      .valueChanges()
      .subscribe((user) => {
        const isActive = user['isActive'].filter((userIsActive) => {
          return userIsActive['name'] !== hobbyName;
        });
        this.fsUsersCollection.doc(user['uid']).update({
          isActive,
        });
        if (isActive.length > 0) {
          this.afFs.collection('active').doc(user['uid']).set({
            uid: user['uid'],
            hobby: isActive,
          });
        } else {
          this.afFs.collection('active').doc(user['uid']).delete();
        }
      });
  }

  /**
   * @description Use this for chats
   */
  fetchActiveUsers() {
    return this.userSubject.pipe(
      filter((user) => !!user && !!user.uid),
      switchMap((user) =>
        this.afFs.collection('active', (ref) => ref.where('uid', '!=', user.uid)).valueChanges(),
      ),
    );
  }

  /**
   * @description Use this for hobby lobby
   */
  fetchActiveUsersByHobby(hobby: string) {
    // return this.afFs.collection('active', ref => ref.where('hobby', '==', hobby)).valueChanges();
    return this.userSubject.pipe(
      filter((user) => !!user && !!user.uid),
      switchMap((user) =>
        this.afFs.collection('active', (ref) => ref.where('uid', '!=', user.uid)).valueChanges(),
      ),
    );
  }

  fetchChatDetails(chatID: string) {
    return this.fsChatsCollection.doc(chatID).valueChanges();
  }

  fetchChatDetailsOnce(chatID: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.fsChatsCollection
        .doc(chatID)
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

  fetchHobbyMembers(hobbyID) {
    if (this.isAllUser) {
      if (this.geoLocationSubscription) {
        this.geoLocationSubscription();
        this.geoLocationSubscription = false;
      }
      return this.afFs.collection(`hobbies/${hobbyID}/members`).valueChanges();
    } else {
      return this.getUserList(hobbyID).then((members) => {
        return members;
      });
    }
  }

  getUserList(hobbyID) {
    return new Promise(async (resolve, reject) => {
      const members = [];
      const geocollection = this.GeoFirestore.collection(`hobbies/${hobbyID}/members`);
      const location: any = await this.getCurrentLocation();
      console.log('In Get Users List', this.radius);
      const query = geocollection.near({
        center: new GeoPoint(location.lat, location.lng),
        radius: this.radius,
      });
      this.geoLocationSubscription = query.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          members.push(change.doc.data());
        });
        resolve(members);
      });
    });
  }

  fetchHobbyMembersByHobbyId(hobbyId) {
    return new Promise((resolve, reject) => {
      let membersCollection = this.afFs.collection(`hobbies/${hobbyId}/members`);
      membersCollection.valueChanges().subscribe((members) => {
        let currentUser = this.user;
        let filterMembers = _.map(members, function (member) {
          if (member.uid != currentUser.uid) return member;
        });
        filterMembers = _.without(filterMembers, undefined);
        resolve(filterMembers);
      });
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

  getUserObj(userId: string) {
    return new Promise<User>((resolve, reject) => {
      this.afFs
        .doc(`users/${userId}`)
        .ref.get()
        .then((doc: any) => {
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

  getPhoto(user: any) {
    if (user && user.photos && user.photos.length > 0) {
      return user.photos[user.photos.length - 1];
    }
  }

  searchUsersByUsername(query: string): Promise<any[]> {
    console.log('Query', query);
    return new Promise((resolve, reject) => {
      return (
        this.afFs.firestore
          .collection('users')
          // Does exact matches if there is issue think of an alternative
          .where('username', '==', query.trim())
          .limit(20)
          .get()
          .then(
            async (querySnapshot) => {
              const userPromises = querySnapshot.docs.map(async (doc) => {
                const userData = doc.data();
                const isInChats = await this.isContactInUserChats(doc.id).pipe(take(1)).toPromise();
                return {
                  uid: doc.id,
                  displayName: userData['displayName'] || '',
                  username: userData['username'] || '',
                  photos: userData['photos'] || [],
                  isInChats: isInChats || false,
                };
              });
              return resolve(await Promise.all(userPromises));
            },
            (err) => {
              return reject(err);
            },
          )
      );
    });
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

  sendNotification(token, notificationData, bodyData) {
    // Prepare the notification
    const notifcationObj: any = {
      notification: notificationData,
      data: bodyData,
      token: token,
    };

    // URL for the cloud function
    const url = 'https://us-central1-hobby-hut-dev.cloudfunctions.net/sendNotification';

    // Send the notification
    this.http.setDataSerializer('json');
    this.http
      .post(url, notifcationObj, {})
      .then((data) => {
        console.log('Notification sent successfully', data);
      })
      .catch((error) => {
        console.error('Error sending notification', error);
      });
  }

  async updateChatTimestamp(chatID, msgThreadOpen) {
    let count = 0;
    const chat = await this.fetchChatDetails(chatID).subscribe((item) => {
      count++;
      item['participants'].forEach((participant, index) => {
        if (participant.uid === this.user.uid) {
          item['participants'][index].timestamp = Date.now();
          if (msgThreadOpen) {
            item['participants'][index].isThreadOpen = msgThreadOpen;
            item['participants'][index].unreadCount = 0;
          } else {
            item['participants'][index].isThreadOpen = msgThreadOpen;
          }
        }
      });
      if (count === 1) {
        this.fsChatsCollection.doc(chatID).update({ participants: item['participants'] });
      }
    });
  }

  initiateChat(otherUser: User, isMessageRequest = true) {
    if (
      otherUser.pushNotificationSettings &&
      otherUser.pushNotificationSettings.messagesRequested
    ) {
      otherUser.device.forEach((token) => {
        const notificationData = {
          title: isMessageRequest ? 'Friend Request Received' : 'New Message Received',
          body: isMessageRequest
            ? 'You have received a Friend Request from ' + this.user.displayName
            : 'You have received a new message from ' + this.user.displayName,
        };
        const bodyData = {
          chatID: '',
          request: 'request',
        };
        this.sendNotification(token, notificationData, bodyData);
      });
    }

    // unreadCount
    this.fsChatsCollection.add({
      messages: [],
      participants: [
        {
          uid: otherUser.uid,
          photoUrl: this.getPhoto(otherUser) || '',
          displayName: otherUser.displayName,
          timestamp: 0,
          isThreadOpen: false,
          unreadCount: 1,
        },
        {
          uid: this.user.uid,
          photoUrl: this.getPhoto(this.user) || '',
          displayName: this.user.displayName,
          timestamp: Date.now(),
          isThreadOpen: false,
          unreadCount: 0,
        },
      ],
      meta: {
        lastMessage: 'Send a message',
        timestamp: Date.now(),
        isMessageRequest: isMessageRequest,
        block: '',
        lastSenderID: this.user.uid,
      },
    });

    const chats = this.user.chats || [];
    return this.fsUsersCollection.doc(this.user.uid).update({
      chats: [...chats, otherUser.uid],
    });
  }

  async loginWithPhone(confirmationCode, verificationId): Promise<void> {
    try {
      // this.presentLoading();
      const credential = PhoneAuthProvider.credential(verificationId, confirmationCode);

      const auth = await this.afAuth.signInWithCredential(credential);
      const uid = auth.user.uid;

      const loginUserData: User | null = await this.getUserObj(uid);

      // If the user is new, update with default values
      if (!loginUserData || loginUserData === null) {
        // using set instead of update to ensure the document is created
        await this.fsUsersCollection.doc(uid).set({
          gender: 'male',
        }, { merge: true });
      }

      // Check if the user data has phoneNumber set
      if (!loginUserData?.phoneNumber) {
        this.presentToast('Phone number not set, updating...');
        // If phoneNumber is not set, update it
        // Normalize the phone number before storing
        const normalizedPhoneNumber = auth.user.phoneNumber
          ? auth.user.phoneNumber.replace(/\D/g, '') // Remove non-digit characters
          : '';

        // Update the user's phone number in Firestore
        await this.fsUsersCollection.doc(uid).update({
          phoneNumber: normalizedPhoneNumber,
        });
      }

      // Method completes successfully - Promise<void> resolves
    } catch (error) {
      console.log(error);
      this.showAlert('Error', 'Something went wrong: ' + error.message);
      throw error; // Re-throw so caller knows operation failed
    }
  }

  async presentLoading() {
    this.loading = await this.loadingController.create({
      message: 'Loading',
    });
    await this.loading.present();
  }

  async showAlert(title: string, msg: string) {
    const alert = await this.alertController.create({
      header: title,
      message: msg,
      buttons: ['OK'],
    });

    await alert.present();
  }

  createUser(name, email, profilePicture) {
    return new Promise((resolve, reject) => {
      this.getCustomToken(email).then((token) => {
        this.signInWithToken(token.data)
          .then((userCredentials) => {
            if (userCredentials.additionalUserInfo.isNewUser) {
              const user = {
                name,
                email,
                profile: profilePicture,
                uid: userCredentials.user.uid,
                phoneNumber: userCredentials.user.phoneNumber || '',
              };
              this.updateUserInfo(user)
                .then(() => {
                  this.fsUsersCollection.doc(user.uid).set({
                    hobbies: [],
                    chats: [],
                    photos: user.profile ? [user.profile] : [],
                    activeHobby: {},
                    uid: user.uid,
                    email: user.email,
                    displayName: user.name,
                    phoneNumber: user.phoneNumber || '',
                  });
                  this.loading.dismiss();
                  this.handleSuccessfulLogin();
                  resolve('Done');
                })
                .catch((error) => [
                  //console.log('updateUser', error)
                ]);
            } else {
              this.loading.dismiss();
              this.handleSuccessfulLogin();
            }
          })
          .catch((error) => {
            //console.log('customTokenError', error);
          });
      });
    });
  }

  getCustomToken(email) {
    return this.http.post(
      'https://us-central1-hobby-hut-dev.cloudfunctions.net/getCredential',
      // "https://www.linkedin.com/oauth/v2/accessToken?grant_type=client_credentials&client_id="+ environment.linkedinClientId +"&client_secret=" + environment.linkedinClientSecret,
      {
        email,
      },
      {},
    );
  }

  signInWithToken(token) {
    return this.afAuth.signInWithCustomToken(token);
  }

  updateUserInfo(user) {
    return this.afAuth.updateCurrentUser(user);
  }

  loginWithEmail(email: string, password: string): Promise<any> {
    return this.afAuth.signInWithEmailAndPassword(email, password);
  }

  notifyMessageReceived(show: boolean) {
    this.messageReceived.next(show);
  }

  removeUserHobby(hobby: UserHobbies) {
    return new Promise((resolve, reject) => {
      this.userSubject
        .pipe(
          filter((user) => !!user && !!user.uid),
          first(),
        )
        .subscribe((user) => {
          const userHobbies = user.hobbies.filter((userHobby) => {
            return userHobby.hobbyID !== hobby.hobbyID;
          });

          this.fsUsersCollection
            .doc(user.uid)
            .update({
              hobbies: userHobbies,
            })
            .then(resolve)
            .catch(reject);
        });
    });
  }

  async sendMessage(chatID: string, messages: any[]) {
    let count = 0;
    this.fetchChatDetails(chatID).subscribe(async (item: Chat) => {
      let otherUser = item['participants'].filter((user) => user.uid !== this.user.uid);
      let otherUserData: any = await this.getUserObj(otherUser[0].uid);
      this.fsUsersCollection
        .doc(otherUser[0].uid)
        .valueChanges()
        .subscribe((user) => {
          if (user['device']) {
            count++;
            if (count === 1) {
              if (
                otherUserData.pushNotificationSettings &&
                otherUserData.pushNotificationSettings.messagesReceived
              ) {
                user['device'].forEach((token) => {
                  const notificationData = {
                    title: 'New message',
                    body: 'Received new message from ' + this.user.displayName,
                  };
                  const bodyData = {
                    chatID: chatID,
                    request: 'message',
                  };
                  this.sendNotification(token, notificationData, bodyData);
                });
              }
            }
          }
        });
    });

    // Get existing chat details it order to persist the meta data
    // and update the messages
    const chat: Chat = await this.fetchChatDetailsOnce(chatID);
    const existingMeta = chat?.meta;

    const metaUpdate = {
      ...existingMeta,
      lastMessage: [...messages].pop().text,
      timestamp: Date.now(),
      isMessageRequest: false,
      block: '',
      lastSenderID: this.user.uid,
    };

    // Make sure we preserve the existing isInTopFive and topFivePosition objects
    if (!metaUpdate.isInTopFive) {
      metaUpdate.isInTopFive = {};
    }

    if (!metaUpdate.topFivePosition) {
      metaUpdate.topFivePosition = {};
    }

    return this.fsChatsCollection.doc(chatID).update({
      messages: arrayUnion(...messages),
      meta: metaUpdate,
    });
  }

  updateUnreadCount(chatID: string) {
    return new Promise((resolve, reject) => {
      this.fetchChatDetails(chatID)
        .pipe(first())
        .subscribe((item) => {
          if (!item || !item['participants']) {
            return reject(new Error('Chat not found: ' + chatID));
          }
          item['participants'].forEach((participant, index) => {
            if (participant.uid !== this.user.uid) {
              if (!item['participants'][index].isThreadOpen) {
                item['participants'][index].unreadCount =
                  item['participants'][index].unreadCount + 1;
                resolve(
                  this.fsChatsCollection
                    .doc(chatID)
                    .update({ participants: item['participants'] }),
                );
              } else {
                resolve(null);
              }
            }
          });
          resolve(null);
        });
    });
  }

  updateCountonRequestAccept(chatID: string) {
    return new Promise((resolve, reject) => {
      this.fetchChatDetails(chatID)
        .pipe(first())
        .subscribe((item) => {
          item['participants'].forEach((participant, index) => {
            if (participant.uid == this.user.uid) {
              item['participants'][index].unreadCount = 0;
              resolve(this.fsChatsCollection.doc(chatID).update({ participants: item['participants'] }));
            }
          });
        });
    });
  }

  acceptRequest(chatID: string) {
    // Add new for notification
    let count = 0;
    this.fetchChatDetails(chatID).subscribe(async (item) => {
      let otherUser = item['participants'];
      let CurrentUserData: any = await this.getUserObj(otherUser[0].uid);
      let otherUserData: any = await this.getUserObj(otherUser[1].uid);
      if (typeof otherUserData.friend == 'undefined' || !otherUserData.friend) {
        otherUserData.friend = [];
      }

      let CurrentFriend = otherUserData.friend ? otherUserData.friend : [];
      if (CurrentFriend.indexOf(CurrentUserData.uid) == -1) {
        CurrentFriend.push(CurrentUserData.uid);
        otherUserData.friend = CurrentFriend;
      }

      if (typeof CurrentUserData.friend == 'undefined' || !CurrentUserData.friend) {
        CurrentUserData.friend = [];
      }
      var NewCurrentFriend = CurrentUserData.friend ? CurrentUserData.friend : [];
      if (NewCurrentFriend.indexOf(otherUserData.uid) == -1) {
        NewCurrentFriend.push(otherUserData.uid);
        CurrentUserData.friend = NewCurrentFriend;
      }

      this.fsUsersCollection
        .doc(otherUser[1].uid)
        .valueChanges()
        .subscribe(async (user) => {
          if (user['device']) {
            count++;
            if (count === 1) {
              this.fsUsersCollection.doc(otherUserData.uid).update({
                friend: otherUserData.friend,
              });

              this.fsUsersCollection.doc(CurrentUserData.uid).update({
                friend: CurrentUserData.friend,
              });

              await this.updateCountonRequestAccept(chatID);

              if (
                otherUserData.pushNotificationSettings &&
                otherUserData.pushNotificationSettings.messagesReceived
              ) {
                user['device'].forEach((token) => {
                  const notificationData = {
                    title: 'Message Request Accepted',
                    body: 'Message request accepted from ' + otherUserData.displayName,
                  };
                  const bodyData = {
                    chatID: '',
                    request: 'Accept',
                  };
                  this.sendNotification(token, notificationData, bodyData);
                });
              }
            }
          }
        });
    });

    return this.fsChatsCollection.doc(chatID).update({
      meta: {
        lastMessage: 'Send a message',
        timestamp: Date.now(),
        isMessageRequest: false,
        block: '',
        lastSenderID: this.user.uid,
      },
    });
  }

  checkRequestAcceptedForMessage(objSelectedUser, CurrentUser) {
    var lstuserChat = [];
    return new Promise((resolve, reject) => {
      this.chats$.subscribe((AllChates) => {
        lstuserChat = AllChates.filter((uchat) => {
          if (
            CurrentUser.uid == uchat.meta.lastSenderID &&
            uchat.meta.lastMessage == 'Send a message'
          ) {
            let cnt = 0;
            uchat.participants.forEach((element) => {
              if (element.uid == objSelectedUser.uid) {
                cnt += 1;
              }
            });
            if (cnt > 0) {
              return uchat;
            }
          }
        });
        return resolve(lstuserChat.length > 0 ? true : false);
      });
    });
  }

  acceptRequest1(email: string) {
    this.afFs.firestore
      .collection('users')
      .where('email', '==', email)
      .onSnapshot(async (querySnapshot) => {
        // let player1List = [];
        let game = null;
        // let game = null;
        //console.log(querySnapshot)
        querySnapshot.forEach(async (doc) => {
          game = doc.data();
          // game.id = doc.id;
        });

        if (game && game.uid) {
          //console.log(game);

          this.handleSuccessfulLogin();
        }
      });
  }

  declineRequest(chatID: string) {
    this.fsChatsCollection.doc(chatID).delete();
  }

  blockMessage(messages: any) {
    messages.participants.forEach((participant) => {
      this.fsUsersCollection
        .doc(participant.uid)
        .get()
        .subscribe((data: any) => {
          // remove from chats
          const chat = data.data().chats;
          const index = chat.indexOf(participant.uid);
          if (index > -1) {
            chat.splice(index, 1);
          }

          // remove from friend
          const friend = data.data().friend;
          const friendindex = chat.indexOf(participant.uid);
          if (friendindex > -1) {
            friend.splice(friendindex, 1);
          }

          if (participant.uid == this.user.uid) {
            const blockedUsers = data.data().blockedUsers ? data.data().blockedUsers : [];
            blockedUsers.push(
              messages.participants[0].uid == this.user.uid
                ? messages.participants[1].uid
                : messages.participants[0].uid,
            );

            this.fsUsersCollection.doc(this.user.uid).update({
              friend: friend,
              chats: chat,
              blockedUsers: blockedUsers,
            });
          } else {
            this.fsUsersCollection.doc(participant.uid).update({
              friend: friend,
              chats: chat,
            });
          }
        });
    });
    this.fsChatsCollection.doc(messages.chatID).delete();

    // return this.fsChatsCollection.doc(chatID).update({
    //   meta: {
    //     lastMessage: messages.length > 0 ? [...messages].pop().text : 'Send a message',
    //     timestamp: Date.now(),
    //     isMessageRequest: false,
    //     block: this.user.uid,
    //     lastSenderID: this.user.uid,
    //   },
    // });
  }

  removeFromChatsAndFriends(messages: any) {
    messages.participants.forEach((participant) => {
      this.userSubject
        .pipe(
          filter((user) => !!user && !!user.uid),
          first(),
        )
        .subscribe((user) => {
          this.fsUsersCollection
            .doc(participant.uid)
            .get()
            .subscribe((data: any) => {
              const userData = data.data();

              // Get the other participant's UID (not the current participant)
              const otherParticipantUid = messages.participants.find(
                (p) => p.uid !== participant.uid,
              )?.uid;

              // Remove from chats
              const chat = userData.chats || [];
              const chatIndex = chat.indexOf(otherParticipantUid);
              if (chatIndex > -1) {
                chat.splice(chatIndex, 1);
              }

              // Remove from friend list
              const friend = userData.friend || [];
              const friendIndex = friend.indexOf(otherParticipantUid);
              if (friendIndex > -1) {
                friend.splice(friendIndex, 1);
              }

              // Update the participant's document (no blocking involved)
              this.fsUsersCollection.doc(participant.uid).update({
                friend: friend,
                chats: chat,
              });
            });
        });
    });

    // Delete the chat document
    this.fsChatsCollection.doc(messages.chatID).delete();
  }

  unblockMessage(chatID: string, messages: any[]) {
    return this.fsChatsCollection.doc(chatID).update({
      meta: {
        lastMessage: messages.length > 0 ? [...messages].pop().text : 'Send a message',
        timestamp: Date.now(),
        isMessageRequest: false,
        block: '',
        lastSenderID: this.user.uid,
      },
    });
  }

  setUserActive(hobbyID: string) {
    this.userSubject
      .pipe(
        filter((user) => !!user && !!user.uid),
        first(),
      )
      .subscribe((user) => {
        const isActive = user.isActive || [];
        const now = new Date().getTime();
        const hobby = this.hobbiesList.find((hobby) => hobby.name === hobbyID);
        const newActive = { name: this.currentHobbyRoom.getValue(), start: now, id: hobby.id };
        this.fsUsersCollection.doc(user.uid).update({
          isActive: [...isActive, newActive],
        });

        this.afFs
          .collection('active')
          .doc(user.uid)
          .set({
            uid: user.uid,
            hobby: [...isActive, newActive],
          });
      });
  }

  setUserActiveFalse(hobbyName) {
    this.userSubject
      .pipe(
        filter((user) => !!user && !!user.uid),
        first(),
      )
      .subscribe((user) => {
        const isActive = user.isActive.filter((userIsActive) => {
          return userIsActive['name'] !== hobbyName;
        });
        this.fsUsersCollection.doc(user.uid).update({
          isActive,
        });
        if (isActive.length > 0) {
          this.afFs.collection('active').doc(user.uid).set({
            uid: user.uid,
            hobby: isActive,
          });
        } else {
          this.afFs.collection('active').doc(user.uid).delete();
        }
      });
  }

  clearAllActiveHobbies(): Promise<void> {
    return new Promise((resolve, reject) => {
      const user = this.userSubject.value;
      if (!user || !user.uid) {
        resolve();
        return;
      }
      this.fsUsersCollection.doc(user.uid).update({
        isActive: [],
      }).then(() => {
        this.afFs.collection('active').doc(user.uid).delete().then(resolve).catch(reject);
      }).catch(reject);
    });
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

  updateUserActiveHobby(hobby, user) {
    return this.fsUsersCollection.doc(user.uid).update({
      activeHobby: hobby,
    });
  }

  /**
   * @Service User Facade
   *
   * Update members array with users id
   */
  updateUserHobbies(hobby: Partial<Hobby>, skillLevel: SkillLevel) {
    const hobbyIndex = this.user.hobbies.findIndex(
      (userHobby) => userHobby.hobbyID === hobby.hobbyID,
    );
    this.user.hobbies[hobbyIndex] = {
      hobbyID: hobby.hobbyID,
      name: hobby.name,
      skillLevel,
      meta: hobby.meta || {},
    };

    return this.fsUsersCollection.doc(this.user.uid).update({
      hobbies: this.user.hobbies,
    });
  }

  updateUserProfile(profile: Partial<User>) {
    return new Promise((resolve, reject) => {
      this.userSubject
        .pipe(
          filter((user) => !!user && !!user.uid),
          first(),
        )
        .subscribe((user) => {
          this.fsUsersCollection.doc(user.uid).update(profile).then(resolve).catch(reject);
        });
    });
  }

  updateUserpushNotificationSettings(pushNotificationSettings) {
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

  updateUserLocation(location) {
    const geocollection = this.GeoFirestore.collection('users').doc(this.user.uid);
    const locationObj = {
      coordinates: new GeoPoint(location.lat, location.lng),
    };
    return geocollection.update(locationObj);
  }

  updateUserLocationInHobby(location, hobbyID) {
    const geocollection = this.GeoFirestore.collection(`hobbies/${hobbyID}/members`).doc(
      this.user.uid,
    );
    const locationObj = {
      coordinates: new GeoPoint(location.lat, location.lng),
    };
    return geocollection.update(locationObj);
  }

  async uploadProfilePic(filePath: string, file: unknown, uid: string) {
    this.presentLoading();
    return this.afStorage
      .upload(filePath, file, {
        customMetadata: {
          userID: uid,
        },
      })
      .then(async (res: any) => {
        const url = await res.ref.getDownloadURL();
        await this.fsUsersCollection.doc(uid).update({
          photos: [...(this.user?.photos || []), url],
        });
        setTimeout(() => {
          if (res.state == 'success') {
            this.loading.dismiss();
          } else {
            this.loading.dismiss();
          }
        }, 5000);
      })
      .catch((err: any) => {
        this.loading.dismiss();
        this.presentToast('Could not save profile photo. Please try again.');
      });
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

  updateInfo(info, user) {
    console.log(user.uid);
    return this.fsUsersCollection.doc(user.uid).update({
      info: info,
    });
  }

  updateLastLoginTime() {
    if (this.user) {
      this.fsUsersCollection.doc(this.user.uid).update({
        lastlogintime: moment().format(),
      });
    }
  }

  createPost(post) {
    this.presentLoading();
    return new Promise<any>((resolve, reject) => {
      this.createPostChat(post.subject)
        .then((res) => {
          this.fsPostCollection.add({ ...post, chatId: res.id }).then(
            async (res) => {
              setTimeout(() => {
                this.loading.dismiss();
              }, 2000);
              resolve(await res.get());
            },
            (err) => {
              reject(err);
              this.loading.dismiss();
            },
          );
        })
        .catch((err) => {
          console.log(err);
          this.loading.dismiss();
        });
    });
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

  addParticipantInPostChat(chatID: string, participants: any[]) {
    return this.fsPostChatCollection.doc(chatID).update({
      participants,
    });
  }
  getPostMessage(chatID: string) {
    return this.fsPostChatCollection.doc(chatID).snapshotChanges();
  }
  getContacts() {
    return new Promise((resolve, reject) => {
      this.messages$ = combineLatest([this.chats$, this.fetchActiveUsers()]).pipe(
        map(([chats, activeUsers]: [any[], any[]]) => {
          chats.sort(function (chat1, chat2) {
            if (chat2.meta && chat1.meta) {
              return chat2.meta.timestamp - chat1.meta.timestamp;
            }
          });
          return chats
            .map((chat) => {
              if (chat.participants) {
                const chatParticipant = chat.participants.filter(
                  (participant) => participant.uid !== this.user.uid,
                )[0];
                const chatUser = chat.participants.filter(
                  (participant) => participant.uid === this.user.uid,
                )[0];

                return {
                  ...chat,
                  participant: {
                    ...chatParticipant,
                    isActive: activeUsers.find((activeUser) => {
                      return activeUser.uid === chatParticipant.uid;
                    }),
                    isLast:
                      this.user.uid !== chat.meta.lastSenderID &&
                      chatUser &&
                      chat.meta['timestamp'] > chatUser['timestamp'],
                  },
                };
              }
            })
            .filter((chat) => {
              if (chat) {
                return chat.participants.find(
                  (participantUser) => participantUser.uid === this.user.uid,
                );
              }
            });
        }),
      );
      this.messages = [];
      this.messagesSubscription = this.messages$.subscribe((resChats: any) => {
        if (!!resChats) {
          resolve(resChats);
        } else {
          resolve(resChats);
        }
      });
    });
  }

  fetchPostChatDetails(chatID: string) {
    return this.fsPostChatCollection.doc(chatID).valueChanges();
  }

  updateUnreadCountInPostChat(chatID: string) {
    return new Promise((resolve, reject) => {
      this.fetchPostChatDetails(chatID)
        .pipe(first())
        .subscribe((item) => {
          item['participants'].forEach((participant, index) => {
            if (participant.uid !== this.user.uid) {
              item['participants'][index].unreadCount = item['participants'][index].unreadCount
                ? item['participants'][index].unreadCount + 1
                : 1;
              resolve(this.fsPostChatCollection.doc(chatID).update({ participants: item['participants'] }));
            }
          });
        });
    });
  }

  updateCountonOpenChat(chatID: string) {
    return new Promise((resolve, reject) => {
      this.fetchPostChatDetails(chatID)
        .pipe(first())
        .subscribe((item) => {
          item['participants'].forEach((participant, index) => {
            if (participant.uid == this.user.uid) {
              item['participants'][index].unreadCount = 0;
              resolve(this.fsPostChatCollection.doc(chatID).update({ participants: item['participants'] }));
            }
          });
        });
    });
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
          // If any user is found, return their user id
          return users.length > 0
            ? users[0].uid // Return the first user's UID
            : null; // Return false if no user is found
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
      map((chats: Chat[]) => {
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
function firstValueFrom(arg0: Observable<boolean>) {
  throw new Error('Function not implemented.');
}
