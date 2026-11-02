import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { CoreFacade } from './../core/core.facade';
import { EmailComposer } from '@ionic-native/email-composer/ngx';
import { Badge } from '@awesome-cordova-plugins/badge/ngx';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import * as moment from 'moment';
import { ItemReorderEventDetail, ModalController } from '@ionic/angular';
import { RequestsComponent } from '../shared/requests/requests.component';
import { SearchFriendsComponent } from '../shared/search-friends/search-friends.component';
import { Chat } from './interfaces/Chat';
import { FromContactsComponent } from '../shared/from-contacts/from-contacts.component';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
})
export class MessagesPage implements OnInit, OnDestroy {
  messages$: Observable<Chat[]>;
  topFiveChats: Chat[];
  params: Params;
  timestamp;
  messageTypeStatus: boolean = true;
  currentPopover;
  messages = [];
  lstUserMessage = [];
  messagesSubscription: Subscription;
  messageFlag: boolean = false;
  unreadCount: any = 0;
  requestCount: any = 0;
  unreadRequest: any = [];
  isLoading: boolean = false;
  maxlength = 0;
  messageLength: number;
  toptenString: string;
  isDisplayGroups: boolean = false;
  postMessage = [];
  isLoadingPostMessage: boolean = true;
  radius: any;
  unreadMessage: any = 0;
  unreadGroupMessage: any = 0;
  isUpdatingTopFive: boolean = false;
  currentUserId: string;
  pushNotificationSettings: any;
  constructor(
    private emailComposer: EmailComposer,
    private router: Router,
    private route: ActivatedRoute,
    private coreFacade: CoreFacade,
    private badge: Badge,
    private afFs: AngularFirestore,
    private modalController: ModalController
  ) {
    this.timestamp = Date.now();
  }

  ngOnInit() {
    this.isLoading = true;
    this.getPushNotificationSettings();
    this.getUnreadMessagesCount();
    this.getUnreadGroupMessage();

    this.params = this.route.snapshot.params;

    this.messages$ = combineLatest([
      this.coreFacade.chats$,
      this.coreFacade.fetchActiveUsers(),
    ]).pipe(
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
                (participant) => participant.uid !== this.coreFacade.user.uid
              )[0];
              const chatUser = chat.participants.filter(
                (participant) => participant.uid === this.coreFacade.user.uid
              )[0];

              return {
                ...chat,
                participant: {
                  ...chatParticipant,
                  isActive: activeUsers.find((activeUser) => {
                    return activeUser.uid === chatParticipant.uid;
                  }),
                  isLast:
                    (chatUser && chatUser.unreadCount > 0) ||
                    (this.coreFacade.user.uid !== chat.meta.lastSenderID &&
                      chatUser &&
                      chat.meta['timestamp'] > chatUser['timestamp']),
                },
              };
            }
          })
          .filter((chat) => {
            if (chat) {
              return chat.participants.find(
                (participantUser: { uid: string }) =>
                  participantUser.uid === this.coreFacade.user.uid
              );
            }
          });
      })
    );

    this.coreFacade.postChat$.subscribe((chats: Chat[]) => {
      chats = chats.filter((chat: Chat) => {
        const chatParticipant = chat.participants.filter(
          (participant) => participant.uid == this.coreFacade.user.uid
        );
        if (chatParticipant.length > 0) {
          return true;
        } else {
          return false;
        }
      });
      chats.sort((chat1, chat2) => {
        if (chat2.meta && chat1.meta) {
          return chat2.meta.timestamp - chat1.meta.timestamp;
        }
      });
      chats.forEach((chat) => {
        const chatParticipant = chat.participants.filter(
          (participant) => participant.uid == this.coreFacade.user.uid
        );
        if (chatParticipant.length > 0 && chatParticipant[0].unreadCount > 0) {
          chat.chatUnreadMessage = true;
        }
      });
      this.postMessage = chats;
      this.isLoadingPostMessage = false;
    });
  }

  ionViewWillEnter() {
    this.coreFacade.updateLastLoginTime();
  }

  imageForUserData(chat: any) {
    return new Promise<any>((resolve, reject) => {
      this.coreFacade.getUser(chat.participant.uid).subscribe((res: any) => {
        const photos = res.data()?.photos || [];
        resolve(photos.length > 0 ? photos[photos.length - 1] : '../../assets/images/palm-tree.png');
      });
    });
  }

  getPushNotificationSettings() {
    const user = this.coreFacade.user;
    if (user && user.pushNotificationSettings) {
      this.pushNotificationSettings = {
        timerFromTop20Contacts: user.pushNotificationSettings.timerFromTop20Contacts,
        timerToTop5Contacts: user.pushNotificationSettings.timerToTop5Contacts,
      };
    } else {
      this.pushNotificationSettings = {
        timerFromTop20Contacts: true,
        timerToTop5Contacts: true,
      };
    }
  }

  updateUserSettingsForTimerToTop5Contacts($event) {
    this.pushNotificationSettings.timerToTop5Contacts = $event.detail.checked;
    this.coreFacade.updateUserpushNotificationSettings(this.pushNotificationSettings);
  }

  ionViewDidEnter() {
    this.unreadRequest = [];
    this.getAllMessages();
    this.timestamp = Date.now();
    this.coreFacade.notifyMessageReceived(false);
  }

  getAllMessages() {
    this.isLoading = true;
    this.messages = [];
    this.messagesSubscription = this.messages$.subscribe((resChats: Chat[]) => {
      if (this.isUpdatingTopFive) {
        this.isLoading = false;
        return;
      }
      // Make a deep copy of the original chats
      const origninalChats = JSON.parse(JSON.stringify(resChats));

      // Filter out chats marked as request
      resChats = resChats.filter((x) => x.meta.isMessageRequest == false);
      this.currentUserId = this.coreFacade.user.uid;
      const currentUserId = this.coreFacade.user.uid;
      // Filter out chats that are marked as topFive for the current user
      this.messages = resChats.filter(
        (x) =>
          !x.meta.isInTopFive ||
          !x.meta.isInTopFive[currentUserId] ||
          x.meta.isInTopFive[currentUserId] !== true
      );
      // Get topFiveChats for the current user
      const topFiveChats = resChats.filter(
        (x) => x.meta.isInTopFive && x.meta.isInTopFive[currentUserId] === true
      );
      this.topFiveChats = new Array(5).fill(null);
      topFiveChats.forEach((element) => {
        if (
          element.meta.topFivePosition &&
          element.meta.topFivePosition[currentUserId] !== undefined
        ) {
          this.topFiveChats[element.meta.topFivePosition[currentUserId]] = element;
        }
      });
      this.messageLength = this.messages.length;
      this.isLoading = false;
      const self = this;
      async function forLoop(i) {
        if (i < origninalChats.length) {
          origninalChats[i].participant.photoUrl = await self.imageForUserData(origninalChats[i]);
          forLoop(i + 1);
        } else {
          self.unreadRequest = origninalChats.filter(
            (x) =>
              x.participants[0].uid == self.coreFacade.user.uid && x.meta.isMessageRequest == true
          );
          if (self.coreFacade.messageUserId != null) {
            const chat = origninalChats.filter(
              (x) => x.participant.uid == self.coreFacade.messageUserId
            );
            if (!!chat && chat.length > 0) {
              self.coreFacade.messageUserId = null;
              self.router.navigate(
                [
                  'messages',
                  chat[0].chatID,
                  'chat',
                  {
                    displayName: chat[0].participant.displayName,
                    photoUrl: chat[0].participant.photoUrl,
                  },
                ],
                { state: { uid: chat[0].participant.uid } }
              );
            }
          }
        }
      }
      forLoop(0);
    });
  }

  getUserMessage() {
    this.maxlength += 10;
    this.lstUserMessage = this.messages.slice(0, this.maxlength);
  }

  async onScrollMessage($event) {
    const scrollElement = await $event.target.getScrollElement();
    if (scrollElement.scrollTop === scrollElement.scrollHeight - scrollElement.clientHeight) {
      this.getUserMessage();
    }
  }

  onOpenMessage({ chatID, messages, participant, meta }) {
    this.badge.clear();
    if (meta.isMessageRequest) {
      this.router.navigate(['profile/user', participant.uid], {
        relativeTo: this.route,
      });
    } else {
      this.router.navigate(
        [
          'messages',
          chatID,
          'chat',
          { displayName: participant.displayName, photoUrl: participant.photoUrl },
        ],
        { state: participant.uid }
      );
      this.timestamp = Date.now();
    }
  }

  onAvatarClick({ chatID, messages, participant, meta }) {
    this.router.navigate(['profile/user', participant.uid], {
      relativeTo: this.route,
    });
  }

  handleAcceptRequest({ chatID, messages }) {
    this.messageFlag = true;
    this.coreFacade.acceptRequest(chatID);
    setTimeout(() => {
      this.getUnreadMessagesCount();
    }, 1500);
  }

  handleDeclineRequest({ chatID, messages }) {
    this.coreFacade.declineRequest(chatID);
  }

  handleBlockUser(message) {
    this.coreFacade.blockMessage(message);
  }

  handleUnmatch(message) {
    this.coreFacade.removeFromChatsAndFriends(message);
  }

  handleReportUser(message) {
    let user = this.coreFacade.user.displayName;
    let otherUser = message.participant.displayName;

    let email = {
      to: 'info@wannahangtime.app',
      cc: [],
      bcc: [],
      attachment: [],
      subject: 'Report User',
      body: `"${user}" has reported "${otherUser}"`,
      isHtml: false,
      app: 'gmail',
    };
    this.emailComposer.open(email);
  }

  onSegmentChanged(event) {
    if (event.detail.value === 'messages') {
      this.isDisplayGroups = false;
    } else if (event.detail.value === 'groups') {
      this.isDisplayGroups = true;
    }
  }

  getUnreadMessagesCount() {
    const joined$ = combineLatest([this.coreFacade.user$, this.coreFacade.chats$]);

    joined$.subscribe(([user, chats]: any) => {
      this.unreadCount = 0;
      this.unreadMessage = 0;
      chats.forEach((chat) => {
        if (chat.participants) {
          const chatUser = chat.participants.filter(
            (participant) => participant.uid === this.coreFacade.user.uid
          )[0];
          if (chatUser && chatUser.unreadCount) {
            this.unreadCount = this.unreadCount + chatUser.unreadCount;
          }
          if (chatUser && chatUser.unreadCount > 0 && !chat.meta.isMessageRequest) {
            this.unreadMessage += chatUser.unreadCount;
          }
        }
      });
    });
  }

  async displayRequests() {
    const modal = await this.modalController.create({
      component: RequestsComponent,
      cssClass: 'homeFilterModal',
      componentProps: {
        messages$: this.messages$,
      },
    });

    await modal.present();
    await modal.onDidDismiss().then(() => {
      this.getUnreadMessagesCount();
    });
  }

  async openPostMessage(messages) {
    let postInfo = {};
    this.afFs
      .collection('posts', (ref) => ref.where('chatId', '==', messages.postChatID))
      .valueChanges({ idField: 'id' })
      .pipe(take(1))
      .subscribe((data: any) => {
        data[0]['formatedStartDate'] = moment(data[0].startDate).format('MMM DD').split(' ')[1];
        data[0]['formatedStartMonth'] = moment(data[0].startDate).format('MMM DD').split(' ')[0];
        data[0]['formatedStartTime'] = moment(data[0].startTime).format('LT');
        // data[0]['formatedEndDate'] = moment(data[0].endDate).format("MMM DD").split(" ")[1];
        // data[0]['formatedEndMonth'] = moment(data[0].endDate).format("MMM DD").split(" ")[0];
        data[0]['formatedEndTime'] = moment(data[0].endTime).format('LT');
        const { id, ...rest } = data[0];
        postInfo = {
          data: rest,
          id: id,
        };
        this.router.navigate(['/post-chat', postInfo['id']], { state: postInfo });
      });
  }

  getAdminImage(message) {
    return message.participants.find((element) => element.isAdmin == true).photoUrl[0];
  }

  onPostAvatarClick({ participants }) {
    const participantId = participants.find((element) => element.isAdmin == true).uid;
    if (participantId != this.coreFacade.user.uid) {
      this.router.navigate(['profile/user', participantId], {
        relativeTo: this.route,
      });
    } else {
      this.router.navigate(['/tabs/profile'], { relativeTo: this.route });
    }
  }

  getUnreadGroupMessage() {
    const postChat$ = combineLatest(this.coreFacade.user$, this.coreFacade.postChat$);
    postChat$.subscribe(([user, chats]: any) => {
      this.unreadGroupMessage = 0;
      chats.forEach((chat) => {
        if (chat.participants) {
          const chatUser = chat.participants.filter(
            (participant) => participant.uid === this.coreFacade.user.uid
          )[0];
          if (chatUser && chatUser.unreadCount) {
            this.unreadGroupMessage = this.unreadGroupMessage + chatUser.unreadCount;
          }
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.coreFacade.messageUserId = null;
    this.messages = [];
    this.messagesSubscription.unsubscribe();
  }

  async handleAddUser(chat: Chat) {
    this.isLoading = true;
    const currentUserId = this.coreFacade.user.uid;

    // If the item is already being updated, just complete the event
    if (this.isUpdatingTopFive) {
      this.isLoading = false;
      return;
    }

    // To avoid multiple updates, set a flag to indicate that the top five is being updated
    this.isUpdatingTopFive = true;

    // Check if the chat already has all top five positions filled
    if (this.topFiveChats.length >= 5) {
      // If so, remove the last chat from the top five
      const lastChat = this.topFiveChats[this.topFiveChats.length - 1];
      if (lastChat) {
        await this.coreFacade.updateChatTopFiveStatus(lastChat.chatID, false, null, currentUserId);
      }
    }

    // Get the chat to be added to top five
    const chatToAdd: Chat = chat;

    // Shift all other chats down by one position
    for (let i = this.topFiveChats.length - 1; i > 0; i--) {
      if (this.topFiveChats[i - 1]) {
        // If there's a chat at position i-1, move it to position i
        const chatToMove = this.topFiveChats[i - 1];
        if (chatToMove) {
          await this.coreFacade.updateChatTopFiveStatus(chatToMove.chatID, true, i, currentUserId);
        }
      }
    }

    // Add the new chat to the top position (0)
    await this.coreFacade.updateChatTopFiveStatus(chatToAdd.chatID, true, 0, currentUserId);

    this.isUpdatingTopFive = false;
    this.isLoading = false;
  }

  // Handles the removal of a chat from the top five list
  async handleRemoveFromTopFive(message) {
    const currentUserId = this.coreFacade.user.uid;
    const removedPosition = message.meta.topFivePosition[currentUserId];
    await this.coreFacade.updateChatTopFiveStatus(message.chatID, false, null, currentUserId);
    // if there are chats below the removed chat, shift them up by one position
    for (let i = removedPosition + 1; i < this.topFiveChats.length; i++) {
      const chatToMove = this.topFiveChats[i];
      if (chatToMove) {
        await this.coreFacade.updateChatTopFiveStatus(
          chatToMove.chatID,
          true,
          i - 1,
          currentUserId
        );
      }
    }
  }

  // Display the from contacts modal to add friends
  displayAddFriends() {
    this.modalController
      .create({
        component: FromContactsComponent,
      })
      .then((modal) => {
        modal.present();
        modal.onDidDismiss().then(() => {
        });
      });
  }

  async displaySearchFriends() {
    const modal = await this.modalController.create({
      component: SearchFriendsComponent,
      cssClass: 'homeFilterModal',
    });
    await modal.present();
  }
}
