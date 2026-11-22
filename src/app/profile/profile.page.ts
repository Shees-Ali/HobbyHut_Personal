import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import {
  IonRouterOutlet,
  ModalController,
  AlertController,
  LoadingController,
  ToastController,
} from '@ionic/angular';
import { iif } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { CoreFacade } from './../core/core.facade';
import { User, Game, Hobby, GameRecord, PhotoPosition } from './../core/core.model';
import { EditHobbiesComponent } from './../shared/edit-hobbies/edit-hobbies.component';
import { Player1GameComponent } from './../shared/player1-game/player1-game.component';
import { MessageService } from '../message.service';
import { TimerService } from '../shared/timer/timer.service';
import * as moment from 'moment';
import { EventManager } from '@angular/platform-browser';
import { cropProfilePhoto } from '../shared/photo-cropper/photo-cropper.component';
import * as _ from 'lodash';
// import $ from "jquery";

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {
  @ViewChild('myInput', { static: false }) myInput: ElementRef;

  requestgame: boolean = false;
  lastActive: string;
  isPlaceholderEnable: boolean = false;
  placeholder1Flag: boolean = false;
  placeholder2Flag: boolean = false;
  placeholder3Flag: boolean = false;
  get alreadyMessaged() {
    let isMessageRequestSend =
      this.currentUser && this.currentUser.chats
        ? this.currentUser.chats.includes(this.params.userID)
        : false;

    //this.fsUsersCollection.doc(this.user.uid).update({

    this.user$.subscribe((resCurrentSelectedUserData) => {
      if (resCurrentSelectedUserData) {
        if (
          resCurrentSelectedUserData.friend &&
          resCurrentSelectedUserData.friend.indexOf(this.currentUser.uid) >= 0
        ) {
          this.isAccepted = true;
        } else {
          this.isAccepted = false;
        }
      }
    });
    return isMessageRequestSend;
  }
  canEdit: boolean;
  currentUser: User;
  currentActiveUser: any;
  params: Params;
  str: String;
  showPlaceholder: boolean;
  showPlaceholder1: boolean;
  showPlaceholder2: boolean;
  user$;
  userProfileForm = this.formBuilder.group({
    aboutMe: [''],
    likeToGo: [``],
    timeOfWeekToPay: [``],
    heroAndSportTeam: [''],
    song: [``],
    lastMeal: [''],
  });
  private loading: any;
  activatedHobby: any;
  isAlreadyMessaged: boolean;
  messageaccepted: boolean;
  game: Game;
  userGames: Game[] = [];
  userGameRecords: GameRecord[] = [];
  unsubscribeGame;
  isGameRequestSent: boolean;
  isAccepted = false;
  hobbyName: any;
  rowOfAboutMe = 1;
  isFromHobbyRoom: boolean = false;
  userNotificationSettings = {};
  objSubscriber;
  aboutText = `<div> What are your fav hobbies? 
  Can you be more specific? 
  i.e if you selected Music, which instruments? 
  Occupation? Studies? Places lived? 
  Why did you download HangTime? </div>`;

  pushNotificationSettings;
  /** True while the owner is dragging their profile picture to a new position in the frame. */
  isRepositioning = false;
  isSavingPosition = false;
  /** Unsaved position while repositioning. */
  private draftPosition: PhotoPosition | null = null;
  private photoDrag: { pointerId: number; x: number; y: number } | null = null;
  // variable to check if user is turning off hobbies
  isTurningHobbiesOff: boolean = false;
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modalController: ModalController,
    private coreFacade: CoreFacade,
    private formBuilder: FormBuilder,
    public alertController: AlertController,
    private messageService: MessageService,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private timerService: TimerService,
  ) {
    if (this.router.getCurrentNavigation()?.extras?.state) {
      this.hobbyName = this.router.getCurrentNavigation().extras.state.hobbyName;
    } else if (this.coreFacade?.user?.activeHobby?.name) {
      this.hobbyName = this.coreFacade.user.activeHobby?.name;
    } else {
      this.hobbyName = null;
    }

    if (this.route.snapshot.params.userID) {
      this.objSubscriber = this.coreFacade
        .subscribeToUserChange(this.route.snapshot.params.userID)
        .onSnapshot(async (doc) => {
          this.userNotificationSettings = doc.data().pushNotificationSettings;
          if (doc.data() && doc.data().lastlogintime) {
            let userDate = doc.data().lastlogintime;

            let curentTime = moment().format();
            const diff = moment(curentTime).diff(userDate);
            const diffDuration = moment.duration(diff);

            if (diffDuration.minutes() < 60 && diffDuration.hours() == 0) {
              if (diffDuration.minutes() == 0) {
                if (diffDuration.seconds() <= 10) {
                  this.lastActive = 'Active Now';
                } else {
                  this.lastActive = 'Active ' + diffDuration.seconds().toString() + ' seconds ago';
                }
              } else {
                this.lastActive = 'Active ' + diffDuration.minutes().toString() + ' minutes ago';
              }
            } else if (diffDuration.hours() < 24 && diffDuration.days() == 0) {
              this.lastActive = 'Active ' + diffDuration.hours().toString() + ' hours ago';
            } else if (diffDuration.days() <= 9) {
              this.lastActive = 'Active ' + diffDuration.days().toString() + ' days ago';
            } else {
              this.lastActive =
                'Last active at ' + moment(doc.data().lastlogintime).format('DD/MM/YYYY');
            }
          }
        });
    } else {
      this.userNotificationSettings = { recordBookPublic: true };
    }
  }

  async ngOnInit() {
    this.showPlaceholder = true;
    this.showPlaceholder1 = true;
    this.showPlaceholder2 = true;
    this.params = this.route.snapshot.params;

    if (this.params && this.params.hobbyID) {
      this.isFromHobbyRoom = true;
    }

    this.currentUser = this.coreFacade.user;

    if (this.currentUser && this.currentUser.pushNotificationSettings) {
      this.pushNotificationSettings = {
        messagesReceived: this.currentUser.pushNotificationSettings.messagesReceived,
        messagesRequested: this.currentUser.pushNotificationSettings.messagesRequested,
        groupMessage: this.currentUser.pushNotificationSettings.groupMessage,
        timerFromTop20Contacts: this.currentUser.pushNotificationSettings.timerFromTop20Contacts,
        timerToTop5Contacts: this.currentUser.pushNotificationSettings.timerToTop5Contacts,
        proGameRequest: this.currentUser.pushNotificationSettings.proGameRequest,
        recordBookPublic: this.currentUser.pushNotificationSettings.recordBookPublic,
      };
    } else {
      this.pushNotificationSettings = {
        messagesReceived: true,
        messagesRequested: true,
        groupMessage: true,
        timerFromTop20Contacts: true,
        timerToTop5Contacts: true,
        proGameRequest: true,
        recordBookPublic: true,
      };
    }

    this.user$ = iif(
      () => this.canEdit,
      this.coreFacade.user$.pipe(
        map((user: any) => {
          this.userProfileForm.patchValue({ ...user.info });
          this.placeholder1Flag = this.userProfileForm.value.aboutMe ? true : false;
          this.placeholder2Flag = this.userProfileForm.value.likeToGo ? true : false;
          this.placeholder3Flag = this.userProfileForm.value.lastMeal ? true : false;
          if (this.userProfileForm.value.aboutMe) {
            this.showPlaceholder = false;
          }
          if (this.userProfileForm.value.likeToGo) {
            this.showPlaceholder1 = false;
          }
          if (this.userProfileForm.value.lastMeal) {
            this.showPlaceholder2 = false;
          }
          this.coreFacade.currentSelectedhobby =
            user.hobbies.find((hobby) => hobby.name === user.activeHobby?.name) || user.activeHobby;
          return {
            ...user,
            activeHobby:
              user.hobbies.find((hobby) => hobby.name === user.activeHobby?.name) ||
              user.activeHobby,
          };
        }),
      ),

      this.coreFacade.getUser(this.params.userID).pipe(
        map((user: any) => {
          if (user.data()) {
            this.userProfileForm.patchValue({ ...user.data().info });
            this.currentActiveUser = {
              ...user.data(),
              activeHobby:
                user.data().hobbies.find((hobby) => hobby.name === user.data().activeHobby.name) ||
                user.data().activeHobby,
            };
          }

          return this.currentActiveUser;
        }),
      ),
    );

    this.coreFacade.currentUserUpdate(this.params.userID);

    this.coreFacade.UpdatedUser$.subscribe((resCurrentSelectedUserData) => {
      if (
        resCurrentSelectedUserData &&
        resCurrentSelectedUserData.friend &&
        resCurrentSelectedUserData.friend.indexOf(this.currentUser.uid) >= 0
      ) {
        this.isAccepted = true;
      } else {
        this.isAccepted = false;
      }
    });

    this.isAlreadyMessaged = this.alreadyMessaged;
    this.canEdit = this.route.snapshot.data.canEdit;
    this.activatedHobby = this.coreFacade.currentSelectedhobby;
  }
  ionViewWillEnter() {
    this.coreFacade.updateLastLoginTime();
  }

  getPhoto(user: any) {
    return this.coreFacade.getPhoto(user);
  }

  getPhotoObjectPosition(user: User): string {
    if (this.isRepositioning && this.draftPosition) {
      return `${this.draftPosition.x}% ${this.draftPosition.y}%`;
    }
    return this.coreFacade.getPhotoObjectPosition(user);
  }

  startReposition(user: User) {
    const url = this.getPhoto(user);
    if (!this.canEdit || !url) {
      return;
    }
    const pos = user.photoPosition;
    const saved = pos && pos.url === url && isFinite(pos.x) && isFinite(pos.y);
    this.draftPosition = { url, x: saved ? pos.x : 50, y: saved ? pos.y : 50 };
    this.isRepositioning = true;
  }

  cancelReposition() {
    this.isRepositioning = false;
    this.draftPosition = null;
    this.photoDrag = null;
  }

  async saveReposition() {
    if (!this.draftPosition || this.isSavingPosition) {
      return;
    }
    const uid = this.currentUser?.uid || this.coreFacade.user?.uid;
    if (!uid) {
      return;
    }
    this.isSavingPosition = true;
    try {
      // updatePhotoPosition tells the user if the save fails; stay in edit mode so they can retry.
      await this.coreFacade.updatePhotoPosition(uid, this.draftPosition);
      this.cancelReposition();
    } catch {
      // Already reported by updatePhotoPosition.
    } finally {
      this.isSavingPosition = false;
    }
  }

  onPhotoPointerDown(event: PointerEvent) {
    if (!this.isRepositioning) {
      return;
    }
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.photoDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }

  onPhotoPointerMove(event: PointerEvent) {
    const drag = this.photoDrag;
    if (!this.isRepositioning || !this.draftPosition || drag?.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const img = event.target as HTMLImageElement;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    this.photoDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };

    // With object-fit: cover the image overflows the frame on at most one axis.
    // Moving object-position by 1% shifts the image by 1% of that overflow.
    const frameW = img.clientWidth;
    const frameH = img.clientHeight;
    const naturalW = img.naturalWidth || frameW;
    const naturalH = img.naturalHeight || frameH;
    const scale = Math.max(frameW / naturalW, frameH / naturalH);
    const overflowX = naturalW * scale - frameW;
    const overflowY = naturalH * scale - frameH;

    const clamp = (value: number) => Math.min(100, Math.max(0, value));
    // Dragging right reveals more of the left side, so the percentage goes down.
    const { x, y } = this.draftPosition;
    this.draftPosition = {
      ...this.draftPosition,
      x: overflowX > 1 ? clamp(x - (dx / overflowX) * 100) : x,
      y: overflowY > 1 ? clamp(y - (dy / overflowY) * 100) : y,
    };
  }

  onPhotoPointerUp(event: PointerEvent) {
    if (this.photoDrag?.pointerId === event.pointerId) {
      this.photoDrag = null;
    }
  }

  async ionViewDidEnter() {
    if (!this.canEdit) {
      await this.checkIfProGameRequestSent();
    }

    let userId;
    if (this.canEdit) {
      if (!this.currentUser) {
        this.currentUser = await this.coreFacade.getCurrentUser();
      }
      userId = this.currentUser.uid;
    } else {
      userId = this.params.userID;
      this.placeholder1Flag = this.userProfileForm.value.aboutMe ? true : false;
      this.placeholder2Flag = this.userProfileForm.value.likeToGo ? true : false;
      this.placeholder3Flag = this.userProfileForm.value.lastMeal ? true : false;
    }

    this.userGames = [];
    this.userGameRecords = [];
    const userGames: Game[] = (await this.coreFacade.getUserGames(userId)) as Game[];
    userGames.sort(function (x, y) {
      return y.createdAt - x.createdAt;
    });
    userGames.forEach(async (game) => {
      const hobbyId = game.hobby['id'];
      game.player1 = (await this.coreFacade.getDocument('users', game.player1['id'])) as User;
      game.player2 = (await this.coreFacade.getDocument('users', game.player2['id'])) as User;
      game.hobby = (await this.coreFacade.getDocument('hobbies', game.hobby['id'])) as Hobby;
      const player1Hobby = game.player1.hobbies.find((hobby) => hobby.hobbyID === hobbyId);
      const player2Hobby = game.player2.hobbies.find((hobby) => hobby.hobbyID === hobbyId);
      // Set the game record along with skill levels of both players
      const gameRecord: GameRecord = {
        game,
        player1Skill: player1Hobby.skillLevel,
        player2Skill: player2Hobby.skillLevel,
      };
      gameRecord.game = game;
      this.userGameRecords.push(gameRecord);

      // Sort the userGameRecords by createdAt in descending order
      this.userGameRecords.sort((a, b) => b.game.createdAt - a.game.createdAt);
    });
  }

  onAvatarClick(participant) {
    this.router.navigate([
      'tabs/home-main/home/hobby-room/' + this.params.hobbyID + '/profile/',
      participant,
    ]);
  }

  isActiveHobby(hobbyName, isActiveHobbyName) {
    if (isActiveHobbyName) {
      for (let i = 0; i < isActiveHobbyName.length; i++) {
        if (isActiveHobbyName[i].name === hobbyName) {
          return true;
        }
      }
    }
    return false;
  }

  async onUploadFile(event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    // Allow picking the same file again.
    input.value = '';
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.coreFacade.presentToast('Please choose an image file.');
      return;
    }

    // Let the user drag and zoom the photo into the frame before uploading it.
    let cropped: Blob | null;
    try {
      cropped = await cropProfilePhoto(this.modalController, file);
    } catch (err) {
      this.coreFacade.presentToast('Could not open that photo. Please choose another one.');
      return;
    }
    if (!cropped) {
      return;
    }

    const uid = this.currentUser.uid;
    const filePath = `users/${uid}/profile-pic/${uid}-${Date.now().toString()}`;
    // uploadProfilePic tells the user if the upload fails.
    this.coreFacade.uploadProfilePic(filePath, cropped, uid).catch(() => {});
  }

  async presentLoading() {
    this.loading = await this.loadingController.create({
      message: 'Loading',
    });
    await this.loading.present();
  }

  async presentGameModal(game) {
    const modal = await this.modalController.create({
      component: Player1GameComponent,
      componentProps: {
        hobbyId: this.params.hobbyID,
        player2Id: this.params.userID,
        game,
      },
    });

    modal.onDidDismiss().then((modaldata) => {
      if (modaldata.data.IsFrom == 'Cancel') {
        // this.requestgame = false;
      }
    });
    await modal.present();
  }

  async presentModal() {
    const modal = await this.modalController.create({
      cssClass: 'addRemoveHobbiesModal',
      component: EditHobbiesComponent,
    });

    await modal.present();
  }

  async sendMessage(user) {
    this.coreFacade.messageUserId = null;
    if (this.isAccepted == true) {
      this.coreFacade.messageUserId = user.uid;
      this.router.navigate(['tabs/messages']);
      return;
    }
    const sent = await this.coreFacade.feedback.run(
      () => this.coreFacade.sendMessageRequest(user.uid),
      { failure: 'Could not send your request.' },
    );
    if (sent) {
      this.isAlreadyMessaged = true;
    }
  }

  turnOffTimers() {
    this.messageService.sendMessage(true);
    this.stopAllTimers();
  }

  async stopAllTimers() {
    this.isTurningHobbiesOff = true;
    const activatedHobbies = this.coreFacade.user.isActive || [];
    const timeout = 1000;
    const length = activatedHobbies.length;

    this.timerService.turnOffAll();

    if (activatedHobbies.length > 0) {
      await this.coreFacade.feedback.run(() => this.coreFacade.clearAllActiveHobbies(), {
        failure: 'Could not turn off your timers.',
      });
    }

    setTimeout(() => {
      this.isTurningHobbiesOff = false;
    }, timeout * length);
  }

  async checkIfProGameRequestSent() {
    const game = (await this.coreFacade.getGameObj(
      this.params?.hobbyID,
      this.currentUser?.uid,
      this.params?.userID,
    )) as Game;
    if (game) {
      this.game = game;
      this.isGameRequestSent = true;
      this.presentGameModal(this.game);
      // this.subscribeToGameChange(game);
    }
  }

  async resetGame() {
    this.isGameRequestSent = false;
    this.game = {} as Game;
    // this.unsubscribeGame();
  }

  async updateActiveHobby(hobby, user) {
    const saved = await this.coreFacade.feedback.run(
      () => this.coreFacade.updateUserActiveHobby(hobby, user),
      { failure: 'Could not change your featured hobby.' },
    );
    if (saved) {
      this.activatedHobby = hobby;
      this.hobbyName = hobby.name;
    }
  }

  onFocusInput() {
    this.coreFacade.inputStatus$.next('active');
  }

  onFocusOut() {}

  onBlurInput(user) {
    this.coreFacade.inputStatus$.next('disable');
    this.coreFacade.feedback.run(
      () => this.coreFacade.updateInfo(this.userProfileForm.value, user),
      { failure: 'Could not save your profile details.' },
    );
  }
  onChangeInput(e, key) {
    // let self = this;
    // $("ion-textarea").on('change keyup paste', function () {
    //   var length = $(this).val().length;
    //   if (length > 0) {
    //     $(this).addClass('data-edits');
    //   } else if (length === 0) {
    //     $(this).removeClass('data-edits');
    //     if (key == 'aboutMe') {
    //       self.placeholder1Flag = false;
    //     }
    //     else {
    //       self.placeholder2Flag = false;
    //       self.placeholder1Flag = true;
    //     }
    //   }
    // });
    if (key == 'aboutMe') {
      if (e.length == 0) {
        this.showPlaceholder = true;
        this.placeholder1Flag = false;
      } else {
        this.showPlaceholder = false;
      }
    } else if (key == 'lastMeal') {
      if (e.length == 0) {
        this.showPlaceholder2 = true;
        this.placeholder3Flag = false;
      } else {
        this.showPlaceholder2 = false;
      }
    } else {
      if (e.length == 0) {
        this.showPlaceholder1 = true;
        this.placeholder2Flag = false;
      } else {
        this.showPlaceholder1 = false;
      }
    }
  }
  activatedHobbyIndex(event) {
    this.activatedHobby = event;
  }

  ionViewWillLeave() {
    this.cancelReposition();
    if (this.objSubscriber) {
      this.objSubscriber();
    }
  }

  private async presentToast(Msg: string): Promise<void> {
    const toast = await this.toastController.create({
      message: Msg,
      duration: 2000,
    });
    toast.present().catch();
  }

  getAge(user) {
    if (user && user.dob) {
      return moment().diff(user.dob, 'years');
    }
    return '';
  }

  updateUserpushNotificationSettings() {
    this.coreFacade.updateUserpushNotificationSettings(this.pushNotificationSettings);
  }

  updateUserSettingsForMakeBookRecordPublic($event) {
    this.pushNotificationSettings.recordBookPublic =
      !this.pushNotificationSettings.recordBookPublic;
    this.updateUserpushNotificationSettings();
  }
}
