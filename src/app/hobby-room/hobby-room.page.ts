import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { ModalController, NavController } from '@ionic/angular';
import { combineLatest } from 'rxjs';
import { map, switchMap, tap, first } from 'rxjs/operators';
import { from } from 'rxjs';
import { CoreFacade } from './../core/core.facade';
import { FiltersComponent } from './../shared/filters/filters.component';
import { SearchFriendsComponent } from '../shared/search-friends/search-friends.component';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Browser } from '@capacitor/browser';
import { SkillLevel } from '../core/core.model';

@Component({
  selector: 'app-hobby-room',
  templateUrl: './hobby-room.page.html',
  styleUrls: ['./hobby-room.page.scss'],
})
export class HobbyRoomPage implements OnInit, OnDestroy {
  filters = {
    ageRange: undefined,
    gender: undefined,
    username: '',
  };
  radius = { value: 101 };
  hobby$;
  hobbyName: string;
  hobbyIcon: string;
  parentRoom: string;
  hobbySkillLevel: string;
  params: Params;
  user;
  user$;
  memberDetails: any;
  loadhobbyUsers: boolean = false;
  @ViewChild('slides', { static: false }) slider: any;
  hobbiesList = [];
  hobbyIndex: number = 0;
  isFriendsVisible: boolean = true;
  loadPost: boolean = false;
  posts = [];

  membersAndHobbies: any;
  membersList: any = [];
  ads: any[] = [];
  constructor(
    private route: ActivatedRoute,
    private coreFacade: CoreFacade,
    private router: Router,
    private modalController: ModalController,
    private socialSharing: SocialSharing,
    private cd: ChangeDetectorRef,
    private navCtrl: NavController,
  ) {}

  go(userID) {
    this.router.navigate(['profile', userID], {
      relativeTo: this.route,
      state: {
        hobbyName: this.hobbyName,
      },
    });
  }

  ngOnDestroy(): void {
    this.coreFacade.homeStatus$.next('disabled');
    this.coreFacade.currentHobbyId.next('');
    this.hobbyIndex = null;
  }

  async ngOnInit() {
    this.coreFacade.fetchExpiredActiveHobbies();
    this.params = this.route.snapshot.params;

    if (this.coreFacade.filters?.ageRange) {
      this.filters.ageRange = this.coreFacade.filters?.ageRange;
    }
    if (this.coreFacade.filters?.gender) {
      this.filters.gender = this.coreFacade.filters?.gender;
    }
    if (this.coreFacade.filters?.radius) {
      this.radius.value = this.coreFacade.filters?.radius.value;
      this.coreFacade.updateRadius(this.radius.value);
    }
    if (this.coreFacade.filters?.username) {
      this.filters.username = this.coreFacade.filters?.username;
    }

    // Set the current hobby and update initial index.
    this.hobbiesList = _.sortBy(this.coreFacade.hobbiesList, [
      (o) => {
        return o.name;
      },
    ]);
    this.hobbyIndex = _.findIndex(this.hobbiesList, {
      name: this.coreFacade.currentSelectedhobby?.name ?? '',
    });

    setTimeout(() => {
      this.slider?.nativeElement.swiper.slideTo(this.hobbyIndex);
    }, 1000);

    // Init all the data and fetch for once.
    this.init();
  }

  async init() {
    this.loadhobbyUsers = false;
    this.user$ = this.coreFacade.user$
      .pipe(
        tap((user) => {
          this.user = user;
          const userHobby = this.user?.hobbies?.find(
            (hobby) => hobby?.hobbyID === this.params.hobbyID,
          );
          this.hobbySkillLevel = userHobby?.skillLevel || '';
        }),
      )
      .subscribe();

    this.hobby$ = this.coreFacade.hobbies$
      .pipe(
        map((hobbies) => hobbies.find((hobby) => hobby.hobbyID === this.params.hobbyID)),
        tap((hobby) => {
          this.hobbyName = hobby.name;
          this.hobbyIcon = hobby.icon;
          this.parentRoom = hobby.parent_room;
          this.coreFacade.currentHobbyRoom.next(hobby.name);
          this.coreFacade.currentHobbyId.next(hobby.hobbyID);
          this.coreFacade.homeStatus$.next(hobby.name);
        }),
        switchMap((hobby) =>
          combineLatest([
            this.coreFacade.fetchHobbyMembers(hobby.hobbyID),
            this.coreFacade.fetchActiveUsers(),
          ]),
        ),
        switchMap(([members, activeMembers]: [any[], any[]]) => {
          members = _.sortBy(members, (member: any) =>
            member.skillLevel == this.hobbySkillLevel ? 0 : 1,
          );

          const filteredMembers = members.filter((member: any) => {
            return member.uid !== this.user?.uid;
          });

          // Create an array of promises to fetch user details
          const memberPromises = filteredMembers.map(async (member: any) => {
            const activeList: any[] = [];
            activeMembers.forEach((actives: any) => {
              actives.hobby.forEach((hobby: any) => {
                if (hobby.name === this.hobbyName) {
                  activeList.push(actives);
                }
              });
            });

            // Get user name for the member - await the promise
            try {
              const memberDoc = await this.coreFacade.getUser(member.uid).pipe(first()).toPromise();
              const memberData: any = memberDoc.data();
              member.username = memberData?.username || '';
            } catch (error) {
              member.username = '';
            }

            return {
              ...member,
              isActive: activeList.find((activeMember: any) => {
                return activeMember.uid === member.uid;
              }),
            };
          });

          // Return observable of all resolved promises
          return from(Promise.all(memberPromises));
        }),
      )
      .subscribe(async (data) => {
        this.membersList = await this.vmMember(data);
        this.loadhobbyUsers = true;
      });

    const query = await this.coreFacade.getPostWithRadius();

    query.onSnapshot((snapshot) => {
      this.posts = snapshot.docs.map((doc) => {
        return {
          data: doc.data(),
          id: doc.id,
        };
      });
      this.loadPost = true;
      this.posts = this.posts.filter((post) => {
        if (post.data.hobbyId === this.route.snapshot.params.hobbyID) {
          if (
            moment(post.data.endDate).format('YYYY/MM/DD') > moment(new Date()).format('YYYY/MM/DD')
          ) {
            return true;
          } else if (
            moment(post.data.endDate).format('YYYY/MM/DD') ==
              moment(new Date()).format('YYYY/MM/DD') &&
            moment(post.data.endTime).format('HH:mm:ss') > moment(new Date()).format('HH:mm:ss')
          ) {
            return true;
          } else {
            this.coreFacade.deletePost(post.id);
            this.coreFacade.deletePostChat(post.data.chatId);
            return false;
          }
        } else {
          return false;
        }
      });
      this.posts.forEach((post) => {
        post.data['formatedStartDate'] = moment(post.data.startDate).format('MMM DD').split(' ')[1];
        post.data['formatedStartMonth'] = moment(post.data.startDate)
          .format('MMM DD')
          .split(' ')[0];
        post.data['formatedStartTime'] = moment(post.data.startTime).format('LT');
        post.data['formatedEndDate'] = moment(post.data.endDate).format('MMM DD').split(' ')[1];
        post.data['formatedEndMonth'] = moment(post.data.endDate).format('MMM DD').split(' ')[0];
        post.data['formatedEndTime'] = moment(post.data.endTime).format('LT');
      });
    });
  }

  inviteFriends() {
    let appLink = 'https://apps.apple.com/in/app/hangtime-hobby-meetup/id1544245073';
    this.socialSharing
      .share(
        `Hey! \nYou gotta check out this new app so we can play ${this.hobbyName}.\nDownload it and message me!\n`,
        '',
        '',
        appLink,
      )
      .then(() => {})
      .catch(() => {});
  }

  async searchFriends() {
    const modal = await this.modalController.create({
      component: SearchFriendsComponent,
      cssClass: 'searchFriendsModal',
    });
    await modal.present();
  }

  async updateLocation() {
    let location = await this.coreFacade.checkGPSPermission();
    this.coreFacade.updateUserLocation(location);
  }

  async openFilters() {
    let filtersObj: any = this.filters;
    filtersObj.radius = this.radius;

    const modal = await this.modalController.create({
      component: FiltersComponent,
      cssClass: 'filterModal',
      componentProps: {
        hobbyName: this.hobbyName,
        hobbyID: this.params.hobbyID,
        filters: filtersObj,
        hobbyLevel: this.hobbySkillLevel,
      },
    });

    await modal.present();
    const filterParams = await modal.onDidDismiss();
    let radius, ageRange, gender, username;
    if (filterParams && filterParams.data) {
      ageRange = filterParams.data.ageRange;
      gender = filterParams.data.gender;
      radius = filterParams.data.radius;
      username = filterParams.data.username;
    } else {
      return;
    }

    if (radius && radius.value && this.radius.value != radius.value) {
      this.radius = radius;
      this.coreFacade.updateRadius(radius.value);
    }

    if (filterParams.data.gender && filterParams.data.ageRange) {
      this.filters = {
        ageRange,
        gender,
        username,
      };
      localStorage.setItem('filters', JSON.stringify(this.filters));
      localStorage.setItem('filters-radius', JSON.stringify(this.radius));
      this.coreFacade.filters = this.filters;
      this.ngOnInit();
    }
  }

  async ionViewDidEnter() {
    if (!this.ads.length) {
      this.ads = await this.coreFacade.getAllAds();
    }
  }

  getAdForIndex(index: number): any {
    if (!this.ads.length) return null;
    const adIndex = Math.floor(index / 2) % this.ads.length;
    return this.ads[adIndex];
  }

  async openAd(ad: any) {
    if (ad?.link) {
      await Browser.open({ url: ad.link });
    }
  }

  async ionViewWillEnter() {
    if (this.params?.hobbyID) {
      this.coreFacade.currentHobbyId.next(this.params.hobbyID);
    }
    this.coreFacade.updateLastLoginTime();
    try {
      let location = await this.coreFacade.checkGPSPermission();

      if (location && this.coreFacade.currentSelectedhobby) {
        this.coreFacade.updateUserLocationInHobby(
          location,
          this.coreFacade.currentSelectedhobby['hobbyID'],
        );
      }
    } catch {}
  }

  ionViewWillLeave() {
    this.coreFacade.updateRadius(101);
  }

  onSegmentChanged(event) {
    if (event.target.value === 'friends') {
      this.isFriendsVisible = true;
    } else {
      this.isFriendsVisible = false;
    }
  }

  createPost() {
    this.router.navigate(['create-post'], {
      relativeTo: this.route,
    });
  }

  getSkillPhoto(userSkill) {
    if (userSkill == SkillLevel.BEGINNER) {
      return '../../../assets/icon/icon-beginner.png';
    } else if (userSkill == SkillLevel.INTERMEDIATE) {
      return '../../../assets/icon/icon-intermediate.png';
    } else if (userSkill == SkillLevel.ADVANCED) {
      return '../../../assets/icon/icon-advanced.png';
    } else {
      return '../../../assets/icon/icon-pro.png';
    }
  }

  async vmMember(data: any) {
    try {
      return await new Promise<any>((resolve) => {
        let members = [];

        const blockedUsers = this.coreFacade.user.blockedUsers;
        if (blockedUsers && blockedUsers.length > 0) {
          data = data.filter((member: any) => !blockedUsers.includes(member.uid));
        }

        const activeMembers = data.filter((member_1: any) => member_1.isActive);
        if (activeMembers.length > 0) {
          members.push(activeMembers);
        }

        const nonActiveMembers = data.filter((member_2: any) => !member_2.isActive);
        if (nonActiveMembers.length > 0) {
          members.push(nonActiveMembers);
        }
        members = [].concat(...members);

        resolve(members);
      });
    } catch (error) {
      console.log('error', error);
    }
  }

  onClickPost(postInfo) {
    this.router.navigate(['/post-chat', postInfo.id], { state: postInfo });
  }

  identify(item: any) {
    return item.id; // Replace 'id' with the actual identifier property in your 'membersList' array
  }

  pop() {
    const room = this.parentRoom || this.coreFacade.currentSelectedhobby?.parent_room;
    if (room) {
      this.navCtrl.navigateBack(['/tabs/home-main/home'], { queryParams: { room } });
    } else {
      this.navCtrl.navigateBack(['/tabs/home-main']);
    }
  }
}
