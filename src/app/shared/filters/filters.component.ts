import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ModalController, LoadingController, PopoverController } from '@ionic/angular';
import { CoreFacade } from '../../core/core.facade';
import { SkillLevelComponent } from '../skill-level/skill-level.component';
import { Gender, SkillLevel } from '../../core/core.model';

@Component({
  selector: 'app-filters',
  templateUrl: './filters.component.html',
  styleUrls: ['./filters.component.scss'],
})
export class FiltersComponent implements OnInit {
  get skillLevel(): SkillLevel {
    return this.user.hobbies.find((hobby) => hobby.name === this.hobbyName).skillLevel;
  }

  get skillMeta() {
    return this.user.hobbies.find((hobby) => hobby.name === this.hobbyName).meta;
  }

  @Input() filters: { ageRange: any; gender: any; radius: any; username?: string };
  skillLevelForm: FormGroup;
  filtersForm: FormGroup;
  @Input() hobbyID: string;
  @Input() hobbyName: string;
  @Input() minAge: any;
  @Input() maxAge: any;
  @Input() hobbyLevel: any;
  maxRadius: any;
  user = this.coreFacade.user;
  readonly Gender = Gender;

  // new variables _ July 2024
  filters_search: any = {};
  radius: any;
  private loading: any;
  constructor(
    private modalCtrl: ModalController,
    private coreFacade: CoreFacade,
    private formBuilder: FormBuilder,
    private loadingController: LoadingController,
    private popoverController: PopoverController
  ) {
    this.minAge = 18;
    this.maxAge = 66;
    this.maxRadius = '51';
  }

  dismiss() {
    this.modalCtrl.dismiss(this.filters);
  }

  ngOnInit() {
    this.filtersForm = this.formBuilder.group({
      coach: [],
      equipment: [],
      facilities: [],
    });

    this.skillLevelForm = this.formBuilder.group({
      skillLevel: [this.hobbyLevel],
    });

    this.getFiltersFromLocalStorage();
  }

  ngAfterViewInit() {
    if (this.skillMeta) {
      this.filtersForm.patchValue(this.skillMeta);
    }
  }

  onAgeRangeChanged({ detail }) {
    this.filters.ageRange = detail;
    this.minAge = detail.value.lower;
    this.maxAge = detail.value.upper;
  }

  onRadiusRangeChanged({ detail }) {
    this.filters.radius = detail;
    this.maxRadius = detail.value;
  }

  onGenderSegmentChanged(detail) {
    this.filters.gender = detail;
  }

  onSearchInputChanged(event: any) {
    const value = event.target.value;
    if (value && value.trim() !== '') {
      this.filters.username = value;
    } else {
      this.filters.username = '';
    }
  }

  onSkillLevelChanged(skillLevel: SkillLevel) {
    this.coreFacade.updateUserHobbies(
      { hobbyID: this.hobbyID, name: this.hobbyName, meta: this.filtersForm.value },
      skillLevel
    );
  }

  async presentLoading() {
    this.loading = await this.loadingController.create({
      message: 'Loading',
    });
    await this.loading.present();
  }

  async updateLocation() {
    await this.presentLoading();
    let location = await this.coreFacade.checkGPSPermission();
    if (location) {
      this.coreFacade.updateUserLocation(location);
    }
    this.loading.dismiss();
  }

  save() {
    this.coreFacade.updateUserHobbies(
      { hobbyID: this.hobbyID, name: this.hobbyName, meta: this.filtersForm.value },
      this.skillLevel
    );
    this.dismiss();
  }

  async OpenSkillLevel() {
    const popover = await this.popoverController.create({
      component: SkillLevelComponent,
      translucent: false,
      backdropDismiss: true,
      cssClass: 'skill-level',
      componentProps: {
        hobbyName: this.hobbyName,
        hobbyID: this.hobbyID,
        meta: this.filtersForm.value,
        hobbyLevelFilter: this.hobbyLevel,
        fromPopover: 1,
      },
    });

    await popover.present();
    const dismissData = await popover.onDidDismiss();
    if (dismissData) {
      this.skillLevelForm.controls.skillLevel.setValue(localStorage.getItem('skillLevel'));
    }
  }

  getFiltersFromLocalStorage() {
    setTimeout(() => {
      if (localStorage.getItem('filters') !== null) {
        this.filters_search = {
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

      this.filters.radius = this.radius;
      this.filters.gender = this.filters_search.gender;
      if (this.filters.gender == '' || !this.filters.gender) {
        this.filters.gender = 'both';
      }
    }, 500);
  }
}
