import { Component, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { CoreFacade } from './../core/core.facade';
import { TimerService } from '../shared/timer/timer.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
})
export class TabsPage implements OnInit {
  locationActive$;
  unreadCount: number = 0;
  unreadCountPost: number = 0;

  constructor(
    private coreFacade: CoreFacade,
    private timerService: TimerService,
  ) {
    this.locationActive$ = this.coreFacade.locationActive$;
  }

  ngOnInit() {
    this.coreFacade.fetchExpiredActiveHobbies();

    // Regular chats unread count
    combineLatest([this.coreFacade.user$, this.coreFacade.chats$]).subscribe(
      ([user, chats]: any) => {
        this.unreadCount = 0;
        chats.forEach((chat) => {
          if (chat.participants) {
            const chatUser = chat.participants.find(
              (participant) => participant.uid === this.coreFacade.user.uid,
            );
            if (chatUser && chatUser.unreadCount) {
              this.unreadCount += chatUser.unreadCount;
            }
          }
        });
      },
    );

    // Post chats unread count
    combineLatest([this.coreFacade.user$, this.coreFacade.postChat$]).subscribe(
      ([user, chats]: any) => {
        this.unreadCountPost = 0;
        chats.forEach((chat) => {
          if (chat.participants) {
            const chatUser = chat.participants.find(
              (participant) => participant.uid === this.coreFacade.user.uid,
            );
            if (chatUser && chatUser.unreadCount) {
              this.unreadCountPost += chatUser.unreadCount;
            }
          }
        });
      },
    );

    // Check for timer status on tab change
    this.timerService.timerStatus$.subscribe((val) => {
      console.log('Timer status:', val);
    });
  }

  changeTab(myTabs) {
    this.coreFacade.fetchExpiredActiveHobbies();

    if (myTabs.getSelected() !== 'home-main') {
      this.coreFacade.currentHobbyId.next('');
    }
  }

  enableLocation() {
    this.coreFacade.enableLocationSetting();
  }
}
