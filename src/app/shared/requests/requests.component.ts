import { Component, Input, OnInit } from '@angular/core';
import { CoreFacade } from '../../core/core.facade';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Badge } from '@awesome-cordova-plugins/badge/ngx';
import { EmailComposer } from '@ionic-native/email-composer/ngx';
import { Subscription, combineLatest } from 'rxjs';
import { ModalController } from '@ionic/angular';
import { MessagesFilterPipe } from '../messages-filter/messages-filter.pipe';

@Component({
  selector: 'app-requests',
  templateUrl: './requests.component.html',
  styleUrls: ['./requests.component.scss'],
})
export class RequestsComponent implements OnInit {
  @Input() messages$: any;
  // messageTypeStatus: any;
  timestamp: number;
  unreadCount: number = 0;
  messagesFilterPipe = new MessagesFilterPipe();
  messagesFilterArrLength = 0;
  messages = [];
  messagesSubscription: Subscription;
  constructor(
    private coreFacade: CoreFacade,
    private router: Router,
    private route: ActivatedRoute,
    private badge: Badge,
    private emailComposer: EmailComposer,
    private modalCtrl: ModalController
  ) { }

  ngOnInit() {
    this.messagesSubscription = this.messages$.subscribe((result: any) => {
      this.messages = result;
      let fiteredArr = this.messagesFilterPipe.transform(result, 'requests')
      fiteredArr = fiteredArr.filter((request) => {
        if (request.meta.lastSenderID !== this.coreFacade.user.uid) {
          return true;
        } else {
          return false;
        }
      });
      this.messagesFilterArrLength = fiteredArr.length;
      const self = this;
      async function forLoop(i) {
        if (i < result.length) {
          result[i].participant.photoUrl = await self.imageForUserData(result[i]);
          forLoop(i + 1);
        } else {
          self.messages = result;
        }
      }
      forLoop(0);
    });
  }

  filterRequestMessage(message) {
    // if (this.messageTypeStatus) {
    //   return true;
    // } else {
    if (message.participant.uid === message.participants[1].uid) {
      return true;
    } else {
      return false;
    }
    // }
  }

  onAvatarClick({ chatID, messages, participant, meta }) {
    this.router.navigate(['tabs/messages/profile/user', participant.uid]);
    this.modalCtrl.dismiss();
  }

  onOpenMessage({ chatID, messages, participant, meta }) {
    this.badge.clear();
    if (meta.isMessageRequest) {
      this.router.navigate(['tabs/messages/profile/user', participant.uid]);
      this.modalCtrl.dismiss();
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

  handleDeclineRequest({ chatID, messages }) {
    this.coreFacade.feedback.run(() => this.coreFacade.declineRequest(chatID), {
      failure: 'Could not decline the request.',
    });
  }

  handleAcceptRequest({ chatID, messages }) {
    this.coreFacade.feedback.run(() => this.coreFacade.acceptRequest(chatID), {
      failure: 'Could not accept the request.',
    });
    // setTimeout(() => {
    //   this.getUnreadMessagesCount();
    // }, 1500);
  }

  imageForUserData(chat) {
    return new Promise((resolve, reject) => {
      this.coreFacade.getUser(chat.participant.uid).subscribe((res: any) => {
        const photos = res.data()?.photos || [];
        resolve(photos.length > 0 ? photos[photos.length - 1] : '../../assets/images/palm-tree.png');
      });
    });
  }

  dismiss() {
    this.modalCtrl.dismiss();
    this.messagesSubscription.unsubscribe();
  }
}
