import { CoreFacade } from './../core/core.facade';
import { Component, OnInit, Input } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { FormBuilder, FormGroup } from '@angular/forms';
import { map, tap } from 'rxjs/operators';
import { AlertController, ModalController } from '@ionic/angular';
import { FromContactsComponent } from '../shared/from-contacts/from-contacts.component';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
  params: Params;
  user;
  pushNotificationSettings;
  dispplayToggleSection: boolean = false;
  activeSection: 'notifications' | 'account' = 'notifications'; // ← only addition
  @Input() hobbyName: string;

  constructor(
    private route: ActivatedRoute,
    private coreFacade: CoreFacade,
    private router: Router,
    public alertController: AlertController,
    private modalController: ModalController
  ) {}

  get skillMeta() {
    return this.user.hobbies.find((hobby) => hobby.name === this.hobbyName).meta;
  }

  async deleteAccount() {
    const deleted = await this.coreFacade.feedback.run(() => this.coreFacade.deleteAccount(), {
      loading: 'Deleting your account',
      success: 'Your account has been deleted.',
      failure: 'Could not delete your account.',
    });
    if (deleted) {
      this.router.navigate(['sign-in'], { replaceUrl: true });
    }
  }

  ngOnInit() {
    this.params = this.route.snapshot.params;
    this.getCurrentUser();
  }

  ionViewWillEnter() {
    this.coreFacade.updateLastLoginTime();
  }

  async presentAlertMultipleButtons() {
    const alert = await this.alertController.create({
      cssClass: 'deleteAccount',
      header: 'Delete Account',
      subHeader: 'Are you sure want to delete your account?',
      buttons: [
        { text: 'No', role: 'cancel', cssClass: 'secondary' },
        { text: 'Yes', handler: () => { this.deleteAccount(); } },
      ],
    });
    await alert.present();
  }

  async getCurrentUser() {
    this.user = await this.coreFacade.getCurrentUser();
    if (this.user && this.user.pushNotificationSettings) {
      this.pushNotificationSettings = {
        messagesReceived: this.user.pushNotificationSettings.messagesReceived,
        messagesRequested: this.user.pushNotificationSettings.messagesRequested,
        groupMessage: this.user.pushNotificationSettings.groupMessage,
        timerFromTop20Contacts: this.user.pushNotificationSettings.timerFromTop20Contacts,
        timerToTop5Contacts: this.user.pushNotificationSettings.timerToTop5Contacts,
        proGameRequest: this.user.pushNotificationSettings.proGameRequest,
        recordBookPublic: this.user.pushNotificationSettings.recordBookPublic,
      };
    } else {
      this.pushNotificationSettings = {
        messagesReceived: true,
        messagesRequested: true,
        groupMessage: true,
        timerFromTop20Contacts: true,
        timerToTop5Contacts: true,
        proGameRequest: true,
        recordBookPublic: true,
      };
    }
    this.dispplayToggleSection = true;
  }

  onClick() {}

  async displayFromContacts() {
    const modal = await this.modalController.create({
      component: FromContactsComponent,
    });
    await modal.present();
  }

  updateUserSettingsForMessageReceived($event) {
    this.pushNotificationSettings.messagesReceived = $event.detail.checked;
    this.updateUserpushNotificationSettings();
  }

  updateUserSettingsForMessageRequested($event) {
    this.pushNotificationSettings.messagesRequested = $event.detail.checked;
    this.updateUserpushNotificationSettings();
  }

  updateUserSettingsForTimerFromTop20Contacts($event) {
    this.pushNotificationSettings.timerFromTop20Contacts = $event.detail.checked;
    this.updateUserpushNotificationSettings();
  }

  updateUserSettingsForProGameRequest($event) {
    this.pushNotificationSettings.proGameRequest = $event.detail.checked;
    this.updateUserpushNotificationSettings();
  }

  updateUserpushNotificationSettings() {
    this.coreFacade.updateUserpushNotificationSettings(this.pushNotificationSettings);
  }

  updateUserSettingsForGroupMessage($event) {
    this.pushNotificationSettings.groupMessage = $event.detail.checked;
    this.updateUserpushNotificationSettings();
  }

  updateUserSettingsForMakeBookRecordPublic($event) {
    this.pushNotificationSettings.recordBookPublic = $event.detail.checked;
    this.updateUserpushNotificationSettings();
  }

  async signOut() {
    const signedOut = await this.coreFacade.feedback.run(() => this.coreFacade.signOut(), {
      failure: 'Could not sign out.',
    });
    if (signedOut) {
      this.coreFacade.currentSelectedhobby = null;
      this.router.navigate(['sign-in'], {
        replaceUrl: true,
        state: { goToPage: 'sign-in' },
      });
    }
  }
}