import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { combineLatest } from 'rxjs';
import { filter, concatMap, map, tap } from 'rxjs/operators';
import { FiltersHomeComponent } from '../shared/filters-home/filters-home.component';
import { FiltersComponent } from '../shared/filters/filters.component';

import { CoreFacade } from './../core/core.facade';
import { User } from './../core/core.model';
import { AddHobbyComponent } from './../shared/add-hobby/add-hobby.component';
import { UpdateProfileComponent } from './../shared/update-profile/update-profile.component';
import * as _ from 'lodash';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
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
  showRooms = false;
  selectedRoom = null;
  constructor(
    private route: ActivatedRoute,
    private popoverController: PopoverController,
    private router: Router,
    private coreFacade: CoreFacade,
    private modalController: ModalController,
    private cd: ChangeDetectorRef,
    private afAuth: AngularFireAuth
  ) {}

  async ngOnInit() {
    this.params = this.route.snapshot.queryParams;

    this.selectedRoom = this.params.room;

    const user$ = this.coreFacade.user$.pipe(
      tap((user) => {
        this.user = user;

        this.coreFacade.setDeviceForUser();
      })
    );

    const hobbies$ = this.coreFacade.hobbies$;
    this.vm$ = combineLatest([user$, hobbies$]).pipe(
      map(([user, hobbies]) => {
        const filteredHobbies = hobbies.filter((hobby) => hobby.parent_room === this.selectedRoom);
        return { user, hobbies: markUsersHobbies(filteredHobbies, user) };
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
      })
    );
  }

  async ionViewWillEnter() {
    this.params = this.route.snapshot.queryParams;
    if (this.params.room != this.selectedRoom) {
      this.ngOnInit();
    }

    this.subscriptions = this.afAuth.user
      .pipe(filter((user) => !!user))
      .subscribe(async (resUser: any) => {
        const currentUserObj: any = await this.coreFacade.getUserObj(resUser.uid);
        if (!!!currentUserObj.dob) {
          this.updateProfileStatus = 'updating';
          this.presentUpdateProfileModal(resUser);
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
  goBack() {
    this.router.navigate(['tabs/home-main']);
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
