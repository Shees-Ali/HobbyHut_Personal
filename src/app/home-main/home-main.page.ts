import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { combineLatest } from 'rxjs';
import { filter, concatMap, map, tap } from 'rxjs/operators';
import { FiltersHomeComponent } from '../shared/filters-home/filters-home.component';
import { AnyoneReadyComponent } from '../shared/anyone-ready/anyone-ready.component';
import { FiltersComponent } from '../shared/filters/filters.component';

import { CoreFacade } from '../core/core.facade';
import { User } from '../core/core.model';
import { AddHobbyComponent } from '../shared/add-hobby/add-hobby.component';
import { UpdateProfileComponent } from '../shared/update-profile/update-profile.component';
import * as _ from 'lodash';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Component({
  selector: 'app-home-main',
  templateUrl: './home-main.page.html',
  styleUrls: ['./home-main.page.scss'],
})
export class HomeMainPage implements OnInit {
  // filters = {
  //   ageRange: undefined,
  //   gender: undefined,
  // };
  filters: any = {};
  hobbies$;
  params: Params;
  private updateProfileStatus = 'evaluating';
  private user;
  user$;
  vm$;
  radius: any;
  mydate: any;
  subscriptions: any;

  // new variables _ July 2024
  right_row: any = [
      {
      name: 'Bar Time',
      image:
        'https://firebasestorage.googleapis.com/v0/b/hobby-hut-dev.appspot.com/o/assets%2Fbar_time.png?alt=media&token=439af05b-db9e-41b9-8d23-fc67c0aaae45',
      isComingSoon: false,
    },
    {
      name: 'Wellness Time',
      image:
        'https://firebasestorage.googleapis.com/v0/b/hobby-hut-dev.appspot.com/o/assets%2Fwellness_time.png?alt=media&token=e32d487e-0d5d-40dc-bca7-c59b13c770d5',
      isComingSoon: false,
    },
 
  ];
  left_row: any = [
    {
      name: 'Social Time',
      image:
        'https://firebasestorage.googleapis.com/v0/b/hobby-hut-dev.appspot.com/o/assets%2FSocial_time.png?alt=media&token=0175de7e-65de-4f1f-987f-3b1095f83848',
      isComingSoon: false,
    },
  
    {
      name: 'Sports Time',
      image:
        'https://firebasestorage.googleapis.com/v0/b/hobby-hut-dev.appspot.com/o/assets%2Fsports_time.png?alt=media&token=0dacb41e-ad8b-4df0-84d3-9748e7830bac',
      isComingSoon: false,
    },
       {
      name: 'Beach Time',
      image:
        'https://firebasestorage.googleapis.com/v0/b/hobby-hut-dev.appspot.com/o/assets%2Fbeach_time.png?alt=media&token=bfa55c75-60b3-4c5d-b357-3ebcaebcd50d',
      isComingSoon: false,
    },
  ];
  showRooms = false;
  selectedRoom = null;
  constructor(
    private route: ActivatedRoute,
    private popoverController: PopoverController,
    private router: Router,
    private coreFacade: CoreFacade,
    private modalController: ModalController,
    private cd: ChangeDetectorRef,
    private afAuth: AngularFireAuth,
  ) {}

  async ngOnInit() {
    this.params = this.route.snapshot.params;

    const user$ = this.coreFacade.user$.pipe(
      tap((user) => {
        this.user = user;

        this.coreFacade.setDeviceForUser();
      }),
    );

    const hobbies$ = await this.coreFacade.hobbies$;
    this.vm$ = combineLatest([user$, hobbies$]).pipe(
      map(([user, hobbies]) => {
        return { user, hobbies: markUsersHobbies(hobbies, user) };
      }),
      map((resDetail: any) => {
        resDetail.hobbies.forEach(async (hobby: any) => {
          let members = await this.coreFacade.fetchHobbyMembersByHobbyId(hobby.hobbyID);
          hobby['memberInfo'] = members;
        });
        this.coreFacade.hobbiesList = [];
        resDetail.user.hobbies.forEach(async (hobby: any) => {
          this.coreFacade.hobbiesList.push({ name: hobby.name, id: hobby.hobbyID });
        });
        this.getFiltersFromLocalStorage();
        return resDetail;
      }),
    );

    this.coreFacade.currentSelectedhobby = null;
    this.coreFacade.advertismentImages = await this.coreFacade.getAllAds();
  }

  async ionViewWillEnter() {
    this.subscriptions = this.afAuth.user
      .pipe(filter((user) => !!user))
      .subscribe(async (resUser: any) => {
        const currentUserObj: User = await this.coreFacade.getUserObj(resUser.uid);

        // Check if the user profile is incomplete
        if (!!!currentUserObj.dob || !!!currentUserObj.username || currentUserObj.username === '') {
          this.updateProfileStatus = 'updating';
          this.presentUpdateProfileModal(currentUserObj);
        }
      });

    try {
      let location = await this.coreFacade.checkGPSPermission();
      this.coreFacade.updateUserLocation(location);
    } catch (er) {}
  }

  getFiltersFromLocalStorage() {
    setTimeout(() => {
      if (localStorage.getItem('filters') !== null) {
        this.filters = {
          ageRange: JSON.parse(localStorage.getItem('filters')).ageRange,
          gender: JSON.parse(localStorage.getItem('filters')).gender,
        };
      }

      if (
        localStorage.getItem('filters-radius') !== null &&
        localStorage.getItem('filters-radius') !== 'undefined'
      ) {
        this.radius = JSON.parse(localStorage.getItem('filters-radius'));
      }

      if (this.filters.gender == '' || !this.filters.gender) {
        this.filters.gender = 'both';
      }
    }, 500);
  }

  async onHobbyClick(hobby) {
    this.coreFacade.filters = this.filters;
    this.coreFacade.filters['radius'] = this.radius;

    if (hobby.isChosen) {
      this.coreFacade.currentSelectedhobby = hobby;
      this.go(hobby.hobbyID);
      return;
    }

    this.presentPopover(hobby);
  }
  async openFilters() {
    let filtersObj: any = this.filters;
    filtersObj.radius = this.radius;
    const modal = await this.modalController.create({
      component: FiltersHomeComponent,
      cssClass: 'homeFilterModal',
      componentProps: {
        hobbyName: 'hobbyname',
        hobbyID: this.params.hobbyID,
        filters: filtersObj,
        hobbyLevel: 'this.hobbySkillLevel',
      },
    });

    await modal.present();
    const {
      data: { ageRange, gender, radius },
    } = await modal.onDidDismiss();

    if (radius && radius.value) {
      this.radius = radius;
      this.coreFacade.updateRadius(this.radius.value);
    }
    this.filters = {
      ageRange,
      gender,
    };
    localStorage.setItem('filters', JSON.stringify(this.filters));
    localStorage.setItem('filters-radius', JSON.stringify(this.radius));
  }

  async anyoneReadyNow() {
    const modal = await this.modalController.create({
      component: AnyoneReadyComponent,
      cssClass: 'anyoneReadyModal',
    });
    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data && data.selectedUid) {
      this.goProfile(data.selectedUid);
    }
  }

  goProfile(uid: string) {
    this.router.navigate(['profile', uid], {
      relativeTo: this.route
    });
  }
  private async go(hobbyID) {
    // let location =  await this.coreFacade.checkGPSPermission();
    // this.coreFacade.updateUserLocation(location);
    this.router.navigate(['hobby-room', hobbyID], { relativeTo: this.route });
  }

  private async presentPopover(hobby) {
    const popover = await this.popoverController.create({
      component: AddHobbyComponent,
      translucent: false,
      backdropDismiss: false,
      cssClass: 'skill-level',
      componentProps: {
        props: hobby,
      },
    });
    return await popover.present();
  }

  private async presentUpdateProfileModal(user: User) {
    const userProfileModal = await this.modalController.create({
      component: UpdateProfileComponent,
      componentProps: { user },
    });

    await userProfileModal.present();
  }

  ionViewWillLeave() {
    if (this.subscriptions) {
      this.subscriptions.unsubscribe();
    }
  }

  ngOnDestroy() {
    if (this.subscriptions) {
      this.subscriptions.unsubscribe();
    }
  }

  // new functions _ July 2024
  onRoomClick(room) {
    if (room.isComingSoon) {
      return;
    }
    // this.showRooms = true;
    this.selectedRoom = room;
    this.router.navigate(['home'], { relativeTo: this.route, queryParams: { room: room.name } });
  }
}

function markUsersHobbies(hobbies, user: User) {
  return hobbies.map((hobby) => {
    return {
      ...hobby,
      isChosen: !!user.hobbies.find((userHobby) => userHobby.hobbyID === hobby.hobbyID),
    };
  });
}
