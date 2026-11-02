import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { startWith, throttleTime, map } from 'rxjs/operators';
import { CoreFacade } from '../core/core.facade';
import { User, SkillLevel } from '../core/core.model';
import { Location } from '@angular/common';

@Component({
  selector: 'app-post-chat',
  templateUrl: './post-chat.page.html',
  styleUrls: ['./post-chat.page.scss'],
})
export class PostChatPage implements OnInit {
  post: any = {};
  chatInput = new FormControl('', Validators.min(1));
  textareaRows$ = this.chatInput.valueChanges.pipe(
    throttleTime(600),
    map(this.calculateTextareaRows),
    startWith(1)
  );
  messages = [];
  participants = [];
  currentUser: User;

  constructor(
    private router: Router,
    private coreFacade: CoreFacade,
    private location: Location
  ) { }

  ngOnInit() {
    this.currentUser = this.coreFacade.user;
    this.post = this.router.getCurrentNavigation().extras.state
    this.coreFacade.updateCountonOpenChat(this.post['data'].chatId).then((res)=>{
      // console.log('res: ', res);
    });
    this.coreFacade.getPostMessage(this.post['data'].chatId).subscribe((data) => {
      this.messages = data.payload.data()['messages'];
      this.participants = data.payload.data()['participants'];
      const me = this.participants.find((p) => p.uid === this.currentUser.uid);
      if (me && me.unreadCount) {
        this.coreFacade.updateCountonOpenChat(this.post['data'].chatId);
      }
    })
  }

  getSkillPhoto(userSkill) {
    if (userSkill == SkillLevel.BEGINNER) {
      return "../../../assets/icon/icon-beginner.png";
    } else if (userSkill == SkillLevel.INTERMEDIATE) {
      return "../../../assets/icon/icon-intermediate.png";
    } else if (userSkill == SkillLevel.ADVANCED) {
      return "../../../assets/icon/icon-advanced.png";
    } else {
      return "../../../assets/icon/icon-pro.png";
    }
  }
  isAdmin() {
    return this.post['data'].createdBy === this.currentUser.uid;
  }
  deletePost() {
    this.coreFacade.deletePost(this.post['id']);
    this.coreFacade.deletePostChat(this.post['data'].chatId);
    this.location.back();
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
  sendMessage() {
    if(this.chatInput.value!=null && this.chatInput.value!=''){
      const message = [
        { text: this.chatInput.value, timestamp: Date.now(), senderID: this.currentUser.uid }
      ];
      
      if (!this.userIsParticipent(this.currentUser.uid, this.participants)) {
        this.participants = [...this.participants, {
          uid: this.currentUser.uid,
          photoUrl: this.currentUser.photos || [],
          displayName: this.currentUser.displayName,
          timestamp: Date.now(),
          isAdmin: false
        }]
        this.coreFacade.addParticipantInPostChat(this.post['data'].chatId, this.participants);
      }
      this.coreFacade.sendPostMessage(this.post['data'].chatId, message).then((res) => {
        // console.log('send Message res: ', res);
        this.coreFacade.sendNotificationOfGroup(this.post['data'].chatId)
        this.coreFacade.updatePostMessageCount(this.post['id'], this.messages.length + message.length).then((res) => {
          // console.log('updatePostMessageCount res: ', res);
        });
        this.coreFacade.updateUnreadCountInPostChat(this.post['data'].chatId).then((res) => {
          // console.log('updateUnreadCountInPostChat res: ', res);
        });
      }).catch((err) => {
        console.error('send Message err: ', err);
      });
     
      this.chatInput.reset();
    }
  }

  isMessageFromAdmin(message) {
    return message.senderID == this.post['data'].createdBy;
  }

  getPhoto(userId) {
    let url = '';
    this.participants.forEach((participant) => {
      if (participant.uid == userId) {
        url = participant.photoUrl.length > 0 ? participant.photoUrl[participant.photoUrl.length - 1] : '';
      }
    });
    return url;
  }

  userIsParticipent(userId, myArray) {
    for (let i = 0; i < myArray.length; i++) {
      if (myArray[i].uid === userId) {
        return true;
      }
    }
  }

  goToProfile(userId){
    this.router.navigate([`/tabs/home-main/home/hobby-room/${this.post['data'].hobbyId}/profile/${userId}`]);
  }

  editPost(){
    this.router.navigate([`/tabs/home-main/home/hobby-room/${this.post['data'].hobbyId}/edit-post`],{ state: this.post });
  }
}
