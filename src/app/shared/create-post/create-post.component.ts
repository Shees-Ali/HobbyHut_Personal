import { Location } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CoreFacade } from 'src/app/core/core.facade';
import { User } from '../../core/core.model';
import * as moment from 'moment';
import { AlertController, IonTextarea } from '@ionic/angular';
import { AlertsService } from 'src/app/alert.service';

@Component({
  selector: 'app-create-post',
  templateUrl: './create-post.component.html',
  styleUrls: ['./create-post.component.scss'],
})
export class CreatePostComponent implements OnInit {
  now = moment();
  postForm = this.formBuilder.group({
    startDate: [moment(this.now.format(), moment.ISO_8601).format(), [Validators.required]],
    startTime: [moment(this.now.format(), moment.ISO_8601).format(), [Validators.required]],
    endTime: [moment(this.now.format(), moment.ISO_8601).format(), [Validators.required]],
    endDate: [moment(this.now.format(), moment.ISO_8601).format(), [Validators.required]],
    subject: ['', [Validators.required]],
    description: ['', [Validators.required]],
  });
  hobbyID = '';
  currentUser: User;
  minStartDate = moment(this.now.format(), moment.ISO_8601).format().split('T')[0];
  minEndDate = moment(this.now.format(), moment.ISO_8601).format().split('T')[0];
  editPost = {};
  pageName: string = 'Create';
  @ViewChild('myTextAreaDesc', { static: true }) private textAreaDesc: IonTextarea;
  @ViewChild('myTextAreaSub', { static: true }) private textAreaSub: IonTextarea;
  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private coreFacade: CoreFacade,
    private location: Location,
    private router: Router,
    private alertService: AlertsService
  ) {
    if (this.router.url.includes('/edit-post')) {
      this.pageName = 'Edit';
      this.editPost = this.router.getCurrentNavigation().extras.state;
      this.postForm.setValue({
        startDate: this.editPost['data'].startDate,
        startTime: this.editPost['data'].startTime,
        endTime: this.editPost['data'].endTime,
        endDate: this.editPost['data'].endDate,
        subject: this.editPost['data'].subject,
        description: this.editPost['data'].description,
      });
    }
  }

  async ngOnInit() {
    this.hobbyID = this.route.snapshot.params.hobbyID;
    this.currentUser = await this.coreFacade.getCurrentUser();
    console.log(this.currentUser['coordinates']);
  }

  ngAfterViewInit() {
    this.textAreaDesc.ionChange.subscribe(() => {
      this.textAreaDesc.autoGrow = true;
    });
    this.textAreaSub.ionChange.subscribe(() => {
      this.textAreaSub.autoGrow = true;
    });
  }

  async onPostSubmit() {
    if (this.postForm.invalid) {
      this.alertService.showAlert('Please fill all the fields', 'Fields Missing!');
      return;
    }

    const formValue = {
      ...this.postForm.value,
      subject: this.postForm.value.subject.trim(),
      description: this.postForm.value.description.trim(),
    };
    if (!formValue.subject || !formValue.description) {
      this.alertService.showAlert('Please fill all the fields', 'Fields Missing!');
      return;
    }

    const start = this.toDateTime(formValue.startDate, formValue.startTime);
    const end = this.toDateTime(formValue.endDate, formValue.endTime);
    if (!end.isAfter(start)) {
      this.alertService.showAlert('End date and time must be after the start.', 'Invalid Time');
      return;
    }

    if (!this.currentUser) {
      this.currentUser = await this.coreFacade.getCurrentUser();
    }

    if (this.pageName === 'Create') {
      const obj = {
        ...formValue,
        hobbyId: this.hobbyID,
        hobbyName: this.currentUser.hobbies.find((hobby) => hobby.hobbyID == this.hobbyID)?.name,
        createdBy: this.currentUser.uid,
        userProfile:
          this.currentUser.photos?.length > 0
            ? this.currentUser.photos[this.currentUser.photos.length - 1]
            : '',
        userSkill: this.currentUser.hobbies.find((hobby) => hobby.hobbyID == this.hobbyID)
          ?.skillLevel,
        userDisplayName: this.currentUser.displayName,
        messageCount: 0,
      };
      this.coreFacade
        .createPost(obj)
        .then((result) => {
          this.coreFacade
            .updatePostLocation(result.id)
            .catch((err) => console.error('Failed to save post location', err));
          this.location.back();
        })
        .catch((error) => {});
    } else {
      const obj = {
        ...formValue,
        hobbyId: this.hobbyID,
        hobbyName: this.currentUser.hobbies.find((hobby) => hobby.hobbyID == this.hobbyID)?.name,
        createdBy: this.currentUser.uid,
        userProfile:
          this.currentUser.photos?.length > 0
            ? this.currentUser.photos[this.currentUser.photos.length - 1]
            : '',
        userSkill: this.currentUser.hobbies.find((hobby) => hobby.hobbyID == this.hobbyID)
          ?.skillLevel,
        userDisplayName: this.currentUser.displayName,
        messageCount: this.editPost['data'].messageCount,
        chatId: this.editPost['data'].chatId,
        coordinates: this.currentUser['coordinates'],
      };
      this.coreFacade
        .updatePost(this.editPost['id'], obj)
        .then((result) => {
          this.router.navigate([
            `/tabs/home-main/home/hobby-room/${this.editPost['data'].hobbyId}`,
          ]);
        })
        .catch((error) => {});
    }
  }
  private toDateTime(date: string, time: string) {
    return moment(
      `${moment(date).format('YYYY-MM-DD')} ${moment(time).format('HH:mm')}`,
      'YYYY-MM-DD HH:mm',
    );
  }

  onChangeStartDate(event) {
    const startDate = moment(this.postForm.controls['startDate'].value, moment.ISO_8601);
    const endDate = startDate.clone();
    this.minEndDate = endDate.format('YYYY-MM-DD');

    // Format the date to ISO 8601 and fix the time zone
    this.postForm.controls['endDate'].setValue(moment(endDate.format(), moment.ISO_8601).format());
  }

  // onChangeTime(event, type: string) {
  //   // const startValue = this.postForm.controls['startTime'].value;
  //   // const endDate = new Date(startValue);
  //   if (type === 'startTime') {
  //     this.postForm.controls['startTime'].setValue(event.detail.value);
  //   } else if (type === 'endTime') {
  //     this.postForm.controls['endTime'].setValue(event.detail.value);
  //   }
  // }

  capitalizeFirstLetter(textarea: HTMLTextAreaElement) {
    const text = textarea.value;
    const lines = text.split('\n');
    const capitalized = lines.map((line) => line.charAt(0).toUpperCase() + line.slice(1));
    textarea.value = capitalized.join('\n');
  }
}
