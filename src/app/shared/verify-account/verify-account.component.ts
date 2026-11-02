import { AfterViewInit, Component, Inject, NgZone, OnInit } from '@angular/core';
import { LoadingController, ModalController, NavParams, ToastController } from '@ionic/angular';
import { CoreFacade } from './../../core/core.facade';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as country_code from 'src/assets/country_code_flag.json';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

declare var window;
@Component({
  selector: 'app-verify-account',
  templateUrl: './verify-account.component.html',
  styleUrls: ['./verify-account.component.scss'],
})
export class VerifyAccountComponent implements OnInit, AfterViewInit {
  sendCodeForm: FormGroup;
  public isSubmitted: boolean = false;
  phoneNumber: string;
  public isCode: boolean = false;
  recaptchaStatus = 'not-started';
  public verificationId = '';
  country_code: any = [];
  // private phoneNum = '+919712309690';
  phoneNum = '+917043020666';

  constructor(
    private coreFacade: CoreFacade,
    public formBuilder: FormBuilder,
    public loadingCtrl: LoadingController,
    private toastController: ToastController,
    private navParams: NavParams,
    private zone: NgZone,
    private modalController: ModalController
  ) {}

  dimissModal() {
    this.modalController.dismiss();
  }

  private async presentToast(errMsg: string): Promise<void> {
    const toast = await this.toastController.create({
      message: errMsg,
      duration: 2000,
    });
    toast.present().catch();
  }

  ngOnInit() {
    this.defineForm();
  }

  ngAfterViewInit() {
    this.phoneNumber = this.navParams.get('phoneNumber');
  }

  defineForm() {
    // this.country_code = [];
    this.country_code = country_code['default'];
    // this.country_code.sort((a: any, b: any) =>
    //   (a.code == 'US' || a.code == 'MX') ? -1 : a.code > b.code ? 1 : -1
    // );
    // console.log("SORTEDCOUNTRYCODE",this.country_code)
    this.sendCodeForm = this.formBuilder.group({
      country_code: ['+1', Validators.required],
      phoneNumber: ['', Validators.required],
    });
  }

  signInPhone() {
    return new Promise(async (resolve) => {
      const loading = await this.loadingCtrl.create({
        message: 'Sending Phone Code...',
      });

      loading.present();
      // Attach `phoneCodeSent` listener to be notified as soon as the SMS is sent
      await FirebaseAuthentication.addListener('phoneCodeSent', async (event) => {
        // Ask the user for the SMS code
        this.verificationId = event.verificationId;
        this.isCode = true;
        await loading.dismiss();
      });

      // Start sign in with phone number and send the SMS
      await FirebaseAuthentication.signInWithPhoneNumber({
        phoneNumber: this.phoneNumber,
      });
    });
  }

  async verifyCode(confirmationCode: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Verifying Phone...',
    });
    try {
      loading.present();
      await this.signinFirebase(confirmationCode);
      await loading.dismiss();
    } catch (error) {
      await loading.dismiss();
      console.error('Error verifying code:', error);
      throw error;
    }
  }

  async signinFirebase(confirmationCode) {
    try {
      await this.coreFacade.loginWithPhone(confirmationCode, this.verificationId);
      this.dimissModal();
    } catch (error) {
      throw error;
    }
  }

  // signupWithPhone(phoneNumber: string) {
  //   console.log('signup');
  //   this.coreFacade.signupWithPhone(phoneNumber).then((confirmationResult) => {
  //     this.zone.run(() => {
  //       console.log('confirm', confirmationResult);
  //       this.recaptchaStatus = 'completed';
  //       window.confirmationResult = confirmationResult;
  //     });
  //   });
  // }

  sendCode() {
    this.isSubmitted = true;
    if (this.sendCodeForm.controls.phoneNumber.status == 'VALID') {
      this.phoneNumber =
        this.sendCodeForm.controls.country_code.value +
        this.sendCodeForm.controls.phoneNumber.value;
      this.signInPhone();
    }
  }
  gotoPhoneNumber() {
    this.isCode = false;
    this.sendCodeForm.controls.phoneNumber.setValue(this.phoneNumber);
  }
}
