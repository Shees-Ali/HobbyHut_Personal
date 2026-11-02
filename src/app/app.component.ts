import { Component, OnInit } from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import { Platform, ToastController, AlertController, ModalController } from '@ionic/angular';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { CoreFacade } from './core/core.facade';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Player2GameComponent } from './shared/player2-game/player2-game.component';
import { Badge } from '@awesome-cordova-plugins/badge/ngx';
import { combineLatest } from 'rxjs';
import {
  ActionPerformed,
  PushNotification,
  PushNotifications,
  PushNotificationSchema,
  Token,
} from '@capacitor/push-notifications';
import { register } from 'swiper/element/bundle';
register();

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  games$;
  currentUser;
  isGameModalOpen;
  constructor(
    private afFs: AngularFirestore,
    private afAuth: AngularFireAuth,
    private platform: Platform,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar,
    private coreFacade: CoreFacade,
    private toastController: ToastController,
    private router: Router,
    public alertController: AlertController,
    private modalController: ModalController,
    private badge: Badge
  ) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      // console.log('ready App')
      this.statusBar.styleDefault();
      this.splashScreen.hide();
    });
    this.platform.resume.subscribe((resResume) => {
      this.badge.clear();
    });
  }

  async ngOnInit() {
    this.badge.clear();
    console.log('[PushNotifications] ngOnInit started');

    this.afAuth.authState.subscribe(async (authState) => {
      if (!authState) {
        console.warn('[PushNotifications] Auth state is null - user not logged in');
        return;
      }
      console.log('[PushNotifications] Auth state received, uid:', authState.uid);
      try {
        this.currentUser = await this.coreFacade.getUserObj(authState.uid);
        console.log('[PushNotifications] Current user loaded:', this.currentUser?.uid);
        this.subscribeProGameRequestCollection();
      } catch (err) {
        console.error('[PushNotifications] Error getting user object:', err);
      }
    });

    // Check if User is null and update
    if (!this.coreFacade.user) {
      await this.coreFacade.getCurrentUser();
      console.log('[PushNotifications] getCurrentUser resolved, user:', this.coreFacade.user?.uid);
    }

    // Request permission to use push notifications
    try {
      let permStatus = await PushNotifications.checkPermissions();
      console.log('[PushNotifications] Initial permission status:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
        console.log('[PushNotifications] Permission after request:', permStatus.receive);
      }

      if (permStatus.receive !== 'granted') {
        console.warn('[PushNotifications] Permission not granted, aborting registration. Status:', permStatus.receive);
        return;
      }

      console.log('[PushNotifications] Registering for push notifications...');
      await PushNotifications.register();
      console.log('[PushNotifications] Register() called successfully');
    } catch (err) {
      console.error('[PushNotifications] Error during permission/register flow:', err);
      return;
    }

    // On success, we should be able to receive notifications
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[PushNotifications] Registration success, token:', token.value);
      this.coreFacade.token = token.value;

      // Persist token to Firestore immediately if user is available
      if (this.coreFacade.user && this.coreFacade.user.uid) {
        console.log('[PushNotifications] Persisting token to Firestore for user:', this.coreFacade.user.uid);
        try {
          await this.coreFacade.setDeviceForUser();
          console.log('[PushNotifications] Token persisted successfully');
        } catch (err) {
          console.error('[PushNotifications] Error persisting token to Firestore:', err);
        }
      } else {
        console.warn('[PushNotifications] User not available yet, token stored in memory only');
      }
    });

    // Some issue with our setup and push will not work
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[PushNotifications] Registration error:', error);
      this.presentToast('Error on registration: ' + JSON.stringify(error));
    });

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('[PushNotifications] Notification received:', notification);
        if (notification.data && notification.data.request === 'message') {
          // this.presentToast(notification.body);
        } else if (notification.data && notification.data.request === 'request') {
          this.presentToast('New Request Received');
        }

        this.badge.increase(1);
      }
    );

    // Method called when tapping on a notification
    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('[PushNotifications] Notification action performed:', notification);
        if (notification.notification.data && notification.notification.data.request === 'message') {
          this.router.navigate(['messages', notification.notification.data.chatID, 'chat']);
          // this.presentToast(notification.notification.body);
        } else if (notification.notification.data && notification.notification.data.request === 'request') {
          this.presentToast('New Request Received');
          this.router.navigate(['tabs/messages']);
        } else if (notification.notification.data && notification.notification.data.request === 'Accept') {
          this.presentToast('Message Request Accepted');
          this.router.navigate(['tabs/profile']);
        }
      }
    );
    // }
    this.updateLocation();
  }

  manageBadgeCount() {
    this.coreFacade.fetchExpiredActiveHobbies();
    const joined$ = combineLatest(this.coreFacade.user$, this.coreFacade.chats$);

    joined$.subscribe(([user, chats]: any) => {
      let unreadMSGCount = 0;
      chats.forEach((chat) => {
        const chatUser = chat.participants.filter(
          (participant) => participant.uid === this.coreFacade.user.uid
        )[0];
        if (chatUser && chatUser.unreadCount) {
          unreadMSGCount = unreadMSGCount + chatUser.unreadCount;
        }
        this.badge.set(unreadMSGCount);
      });
    });
  }

  subscribeProGameRequestCollection() {
    this.afFs.firestore
      .collection('games')
      .where('player2', '==', this.afFs.collection('users').doc(this.currentUser.uid).ref)
      .where('status', 'in', [
        'created',
        'pending',
        'accepted',
        'scoreSent',
        'scoreRejected',
        'correctedScoreSent',
      ])
      // .where('createdAt', '>', Date.now())
      .onSnapshot(async (querySnapshot) => {
        // let player1List = [];
        querySnapshot.forEach(async (doc) => {
          const game = doc.data();
          game.id = doc.id;
          const player1 = await this.coreFacade.getUserObj(game.player1.id);
          await this.showGameModalForPlayer2(game, player1);
        });
      });
  }

  private async showGameModalForPlayer2(game, player1) {
    if (this.isGameModalOpen) {
      return;
    }
    this.isGameModalOpen = true;
    const modal = await this.modalController.create({
      component: Player2GameComponent,
      componentProps: {
        game,
      },
    });

    await modal.present();

    await modal.onDidDismiss();

    //console.log('Game Modal Closed ');
    this.isGameModalOpen = false;
  }

  private async presentToast(Msg: string): Promise<void> {
    const toast = await this.toastController.create({
      message: Msg,
      duration: 3000,
    });
    toast.present().catch();
  }

  async updateLocation() {
    let location = await this.coreFacade.checkGPSPermission();
    if (location) {
      this.coreFacade.updateUserLocation(location);
    }
  }
}
