import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ModalController, LoadingController, PopoverController } from '@ionic/angular';
import { CoreFacade } from '../../core/core.facade';
import { SkillLevelComponent } from '../skill-level/skill-level.component';
import { Gender } from '../../core/core.model';

@Component({
  selector: 'app-filters-home',
  templateUrl: './filters-home.component.html',
  styleUrls: ['./filters-home.component.scss'],
})
export class FiltersHomeComponent implements OnInit {
  @Input() filters: { ageRange: any; gender: any; radius: any };
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
  @Input() showButtons: boolean = true;
  private loading: any;

  constructor(
    private modalCtrl: ModalController,
    private coreFacade: CoreFacade,
    private formBuilder: FormBuilder,
    private loadingController: LoadingController
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
    this.dismiss();
  }
}
