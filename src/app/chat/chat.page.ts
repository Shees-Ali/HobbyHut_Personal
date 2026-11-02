import { CoreFacade } from './../core/core.facade';
import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { FormControl, Validators } from '@angular/forms';
import { map, startWith, throttle, throttleTime, tap } from 'rxjs/operators';
import { IonContent, Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Badge } from '@awesome-cordova-plugins/badge/ngx';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss']
})
export class ChatPage implements OnInit {
  chatInput = new FormControl('', Validators.min(1));
  @ViewChild('ionContent', { static: true }) content: IonContent;
  private onResumeSubscription: Subscription;
  private onPauseSubscription: Subscription;
  messages = [];
  messages$;
  flag: boolean = false;
  message: string = '';
  sign = '&#x270C;'
  cubicSymbol = ' &#x23F0;';
  private params: Params;

  emoji_bust = '👥';
  emoji_alarm = '⏰';
  emoji_callmehand = '🤙';

  textareaRows$ = this.chatInput.valueChanges.pipe(
    throttleTime(600),
    map(this.calculateTextareaRows),
    startWith(1)
  );
  user = this.coreFacade.user;
  icon: string;
  displayName = "";
  photoUrl: any;
  msg: string = "";
  participant_uid: any;
  constructor(private route: ActivatedRoute,
    private coreFacade: CoreFacade,
    private badge: Badge,
    private router: Router,
    private platform: Platform) {
    this.onResumeSubscription = platform.resume.subscribe(() => {
      // do something meaningful when the app is put in the foreground
      this.coreFacade.updateChatTimestamp(this.params.chatID, true);
    });
    this.onPauseSubscription = platform.pause.subscribe(() => {
      // do something meaningful when the app is put in the foreground
      this.coreFacade.updateChatTimestamp(this.params.chatID, false);
    });
  }

  calculateTextareaRows(value) {
    if (!value) {
      return 1;
    }

    const words = value.split(' ');
    const wordsPerLine = 7;
    const proposedRows = Math.ceil(words.length / wordsPerLine);

    if (proposedRows < 1) {
      return 1;
    }

    const maxRows = 4;
    return proposedRows > maxRows ? maxRows : proposedRows;
  }

  ngOnInit() {
    this.participant_uid = this.router.getCurrentNavigation().extras.state
    // console.log(new Date())
    this.params = this.route.snapshot.params;
    // console.log(this.params)
    this.displayName = this.params.displayName;
    this.photoUrl = this.params.photoUrl;
    this.coreFacade.updateChatTimestamp(this.params.chatID, true);
    this.messages$ = this.coreFacade.fetchChatDetails(this.params.chatID).pipe(
      tap((chat: any) => {
        // console.log(chat)
        this.messages = chat.messages;
      }),
      map((chat: any) => chat.messages),
      tap(_ =>
        setTimeout(() => {
          this.content.scrollToBottom(300);
        }, 200)
      )
    );
  }
  ionViewWillEnter() {
    this.coreFacade.updateLastLoginTime();
  }
  ngOnDestroy(): void {
    this.coreFacade.updateChatTimestamp(this.params.chatID, false);
    this.onResumeSubscription.unsubscribe();
    this.onPauseSubscription.unsubscribe();
  }

  Addemoji(emojicode) {
    // console.log(emojicode)
    this.flag = true;
    if (emojicode == 1) emojicode = "Wanna hang?🤙";
    if (emojicode == 2) emojicode = "Next time";
    if (emojicode == 3) emojicode = "Let's do it";

    var msg = '';
    if (this.chatInput.value == null || !this.chatInput.value || this.chatInput.value == "") {
      msg = emojicode
    } else {
      msg = this.chatInput.value + emojicode;
    }
    this.chatInput.setValue(msg);
  }

  sendMessage() {
    const text = this.chatInput.value;
    if (!text || !text.trim()) {
      return;
    }
    const currentUser = this.coreFacade.user;
    if (!currentUser) {
      this.coreFacade.presentToast('Please wait, your profile is still loading.');
      return;
    }

    const message = [{ text, timestamp: Date.now(), senderID: currentUser.uid }];

    this.badge.clear();

    this.coreFacade
      .updateUnreadCount(this.params.chatID)
      .then(() => this.coreFacade.sendMessage(this.params.chatID, message))
      .then(() => this.chatInput.reset())
      .catch((err) => {
        console.error('Failed to send message to chat', this.params.chatID, err);
        this.coreFacade.presentToast('Message not sent. Please try again.');
      });
  }


  handleSelection(event) {
    // console.log(event.char);
    this.messages += event.char;
  }

  onAvatarClick() {
    this.router.navigate(['tabs/messages/profile/user', this.participant_uid]);
  }
}
