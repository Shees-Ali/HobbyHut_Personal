import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { CoreFacade } from './../../core/core.facade';
import { User, Gender } from 'src/app/core/core.model';
import {
  MIN_AGE,
  PLACEHOLDER_DOBS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  isValidDob,
  isValidGender,
  latestAllowedDob,
  toDateOnly,
} from 'src/app/core/profile';
import { cropProfilePhoto } from '../photo-cropper/photo-cropper.component';

/** Limit on the picked file. Only the cropped result (much smaller) is uploaded. */
const MAX_PHOTO_BYTES = 30 * 1024 * 1024;

/**
 * The required-profile form: display name, username, date of birth, gender and a photo.
 * Emits `saved` once everything is stored. Nothing is saved until the user submits,
 * except the photo, which is uploaded as soon as it is picked and adjusted.
 */
@Component({
  selector: 'app-update-profile',
  templateUrl: './update-profile.component.html',
  styleUrls: ['./update-profile.component.scss'],
})
export class UpdateProfileComponent implements OnInit {
  @Input() user: User;
  @Output() saved = new EventEmitter<void>();

  updateProfileForm: FormGroup;
  readonly Gender = Gender;
  readonly minAge = MIN_AGE;
  readonly maxDob = latestAllowedDob();
  readonly usernameMinLength = USERNAME_MIN_LENGTH;
  readonly usernameMaxLength = USERNAME_MAX_LENGTH;

  photoUrl: string | null = null;
  isUploading = false;
  isSaving = false;
  /** Set after the user tried to submit, so missing fields are pointed out. */
  submitted = false;

  constructor(
    private formBuilder: FormBuilder,
    private coreFacade: CoreFacade,
    private modalController: ModalController,
  ) {}

  ngOnInit() {
    const user: Partial<User> = this.user || {};
    this.photoUrl = this.coreFacade.getPhoto(user as User) || null;

    // The old form filled in a date by itself; make the user choose a real one.
    const existingDob = toDateOnly(user.dob);
    const dob = existingDob && !PLACEHOLDER_DOBS.includes(existingDob) ? existingDob : '';

    this.updateProfileForm = this.formBuilder.group({
      displayName: [user.displayName || '', [Validators.required, notBlank, Validators.maxLength(40)]],
      gender: [isValidGender(user.gender) ? user.gender : null, Validators.required],
      dob: [dob, [Validators.required, dobValidator]],
      username: [
        user.username || '',
        [
          Validators.required,
          Validators.minLength(USERNAME_MIN_LENGTH),
          Validators.maxLength(USERNAME_MAX_LENGTH),
          Validators.pattern(USERNAME_PATTERN),
        ],
      ],
    });
  }

  get canSubmit(): boolean {
    return !this.isSaving && !this.isUploading;
  }

  showError(controlName: string): boolean {
    const control = this.updateProfileForm.get(controlName);
    return !!control && control.invalid && (control.touched || this.submitted);
  }

  hasError(controlName: string, error: string): boolean {
    return !!this.updateProfileForm.get(controlName)?.errors?.[error];
  }

  async onProfileFormSubmit() {
    this.submitted = true;
    this.updateProfileForm.markAllAsTouched();
    if (this.updateProfileForm.invalid || !this.photoUrl || !this.canSubmit) {
      this.coreFacade.presentToast(
        this.photoUrl ? 'Please check the highlighted fields.' : 'Please add a profile photo.',
      );
      return;
    }

    this.isSaving = true;
    try {
      const { displayName, username, dob, gender } = this.updateProfileForm.value;
      await this.coreFacade.saveProfile({ displayName, username, dob, gender });
      this.coreFacade.presentToast('Profile saved.');
      this.saved.emit();
    } catch (err) {
      console.error('Error saving profile', err);
      if (err?.code === 'username-taken') {
        this.updateProfileForm.get('username').setErrors({ taken: true });
        this.coreFacade.presentToast('That username is already taken. Please choose another.');
      } else if (err?.code === 'photo-required') {
        this.photoUrl = null;
        this.coreFacade.presentToast('Please add a profile photo.');
      } else if (err?.code === 'invalid-profile' || err?.code === 'signed-out') {
        this.coreFacade.presentToast(err.message);
      } else {
        this.coreFacade.presentToast(
          'Could not save your profile. Check your connection and try again.',
        );
      }
    } finally {
      this.isSaving = false;
    }
  }

  async onUploadFile(event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    // Allow picking the same file again after a failed upload.
    input.value = '';
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.coreFacade.presentToast('Please choose an image file.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      this.coreFacade.presentToast('That photo is too large. Please choose one under 30 MB.');
      return;
    }

    let cropped: Blob | null;
    try {
      cropped = await cropProfilePhoto(this.modalController, file);
    } catch (err) {
      this.coreFacade.presentToast('Could not open that photo. Please choose another one.');
      return;
    }
    if (!cropped) {
      return;
    }

    const uid = this.user.uid;
    const filePath = `users/${uid}/profile-pic/${uid}-${Date.now().toString()}`;
    this.isUploading = true;
    try {
      this.photoUrl = await this.coreFacade.uploadProfilePic(filePath, cropped, uid);
    } catch (err) {
      // uploadProfilePic has already told the user.
    } finally {
      this.isUploading = false;
    }
  }
}

function notBlank(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim().length === 0
    ? { required: true }
    : null;
}

function dobValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null; // `required` reports this
  }
  return isValidDob(control.value) ? null : { dob: true };
}
