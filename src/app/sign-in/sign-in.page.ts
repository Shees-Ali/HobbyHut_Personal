import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ModalController } from '@ionic/angular';
import { CoreFacade } from './../core/core.facade';
import { VerifyAccountComponent } from './../shared/verify-account/verify-account.component';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.page.html',
  styleUrls: ['./sign-in.page.scss'],
})
export class SignInPage implements OnInit {
  authForm: FormGroup;
  checkedSegment = 'login';
  showSlides: boolean = false;
  status = true;
  isIOS = false;
  slidenum: number = 0;
  phoneNumber = '';

  constructor(
    private formBuilder: FormBuilder,
    private coreFacade: CoreFacade,
    private loadingCtrl: LoadingController,
    private alertController: AlertController,
    private modalController: ModalController,
    private router: Router,
    private platform: Platform
  ) {}

  manageIntroSlides() {
    this.next();
  }

  // --- Removed login methods apart from phone number ---

  loginWithEmail(): void {
    this.presentLoading();
    const authDetails = this.authForm.value as {
      email: string;
      password: string;
    };
    this.coreFacade
      .loginWithEmail(authDetails.email, authDetails.password)
      .then(async (user) => {
        this.manageIntroSlides();
      })
      .catch((err) => this.coreFacade.feedback.error(err, 'Could not sign you in.'));
  }

  ngOnInit() {
    this.isIOS = this.platform.is('ios');
    this.authForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
    if (this.router.getCurrentNavigation().extras.state) {
      if (this.router.getCurrentNavigation().extras.state.goToPage == 'sign-in') {
        this.next();
      }
    }
  }

  changeLoginPage() {
    this.status = !this.status;
  }

  async presentLoading() {
    const loading = await this.loadingCtrl.create({
      duration: 3000,
      spinner: 'bubbles',
    });
    await loading.present();
  }

  async presentPhoneInput() {
    const modal = await this.modalController.create({
      component: VerifyAccountComponent,
      showBackdrop: true,
      backdropDismiss: true,
      cssClass: 'verifyAccount',
      componentProps: {},
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();
    this.manageIntroSlides();
  }

  async verifyPhoneNumberAndLogin() {
    const loading = await this.loadingCtrl.create({
      message: 'Verifying Phone...',
    });

    loading.present();
  }

  segmentChanged(event: any): void {
    this.checkedSegment = event.detail.value;
  }

  async signupWithEmail(): Promise<void> {
    const authDetails = this.authForm.value as {
      email: string;
      password: string;
    };

    this.presentLoading();

    this.coreFacade
      .signUpWithEmail(authDetails.email, authDetails.password)
      .then(async (user) => {
        this.manageIntroSlides();
      })
      .catch((err: any) => this.coreFacade.feedback.error(err, 'Could not create your account.'));
  }

  next() {
    localStorage.setItem('showInfoSlides', 'false');
    this.showSlides = false;

    return this.router.navigateByUrl('', {
      replaceUrl: true,
    });
  }

  slide(slidenumber) {
    this.slidenum = slidenumber;
  }

  onSlideDidChange() {}
  onSlideWillChange() {}
}
