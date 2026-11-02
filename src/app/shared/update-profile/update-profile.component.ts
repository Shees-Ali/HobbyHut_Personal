import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { CoreFacade } from './../../core/core.facade';
import { map, tap } from 'rxjs/operators';
import { User, Gender } from 'src/app/core/core.model';

@Component({
  selector: 'app-update-profile',
  templateUrl: './update-profile.component.html',
  styleUrls: ['./update-profile.component.scss'],
})
export class UpdateProfileComponent implements OnInit {
  @Input() user: User;
  updateProfileForm: FormGroup;
  readonly Gender = Gender;

  constructor(
    private formBuilder: FormBuilder,
    private modalController: ModalController,
    private coreFacade: CoreFacade
  ) {}

  dismissModal() {
    this.modalController.dismiss();
  }

  ngOnInit() {
    // Get the date for 2000-01-01
    const date = new Date(2000, 0, 1);
    // Set the default value for the date input
    const defaultDate = date.toISOString().split('T')[0];

    // Custom validator function for username
    const usernameValidator = (control: { value: string }) => {
      const valid = /^[a-zA-Z0-9_]+$/.test(control.value);
      return valid ? null : { invalidUsername: true };
    };

    this.updateProfileForm = this.formBuilder.group({
      displayName: [this.user.displayName ? this.user.displayName : '', Validators.required],
      gender: [this.user.gender || Gender.MALE, Validators.required],
      dob: [this.user.dob || defaultDate, Validators.required],
      username: [
        this.user.username ? this.user.username : '',
        [Validators.required, usernameValidator],
      ],
      profilePicture: [this.getPhoto(this.user), Validators.required],
    });
  }

  onProfileFormSubmit() {
    this.coreFacade.updateUserProfile(this.updateProfileForm.value);
    this.dismissModal();
  }

  async onUploadFile(event) {
    for (let index = 0; index < event.target.files.length; index++) {
      const element = event.target.files[index];
      const filePath = `users/${this.user.uid}/profile-pic/${
        this.user.uid
      }-${Date.now().toString()}`;
      this.coreFacade
        .uploadProfilePic(filePath, element, this.user.uid)
        .then((res) => {
          this.coreFacade.user$.subscribe((user) => {
            this.user = user;
          });
        })
        .catch((err) => {
          console.log(err);
        });
    }
  }

  getPhoto(user: any) {
    if (user && user.photos && user.photos.length > 0) {
      return user.photos[user.photos.length - 1];
    } else {
      return null;
    }
  }
}
