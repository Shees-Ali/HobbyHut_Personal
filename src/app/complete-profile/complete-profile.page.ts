import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { first } from 'rxjs/operators';
import { CoreFacade } from '../core/core.facade';
import { User } from '../core/core.model';
import { isProfileComplete } from '../core/profile';

/**
 * Shown instead of the app while the signed-in user's profile is incomplete.
 * There is no way past it except completing the profile or signing out.
 */
@Component({
  selector: 'app-complete-profile',
  templateUrl: './complete-profile.page.html',
  styleUrls: ['./complete-profile.page.scss'],
})
export class CompleteProfilePage {
  user: User | null = null;
  state: 'loading' | 'ready' | 'error' = 'loading';

  constructor(
    private afAuth: AngularFireAuth,
    private coreFacade: CoreFacade,
    private router: Router,
  ) {}

  ionViewWillEnter() {
    this.load();
  }

  async load() {
    this.state = 'loading';
    try {
      const authUser = await this.afAuth.user.pipe(first()).toPromise();
      if (!authUser) {
        await this.router.navigateByUrl('/sign-in', { replaceUrl: true });
        return;
      }
      const user = await this.coreFacade.ensureUserDoc(authUser);
      if (isProfileComplete(user)) {
        await this.enterApp();
        return;
      }
      this.user = user;
      this.state = 'ready';
    } catch (err) {
      console.error('Could not load the profile', err);
      this.state = 'error';
    }
  }

  onSaved() {
    this.enterApp();
  }

  async signOut() {
    try {
      await this.coreFacade.signOut();
      await this.router.navigateByUrl('/sign-in', {
        replaceUrl: true,
        state: { goToPage: 'sign-in' },
      });
    } catch (err) {
      console.error('Could not sign out', err);
      this.coreFacade.presentToast('Could not sign out. Please try again.');
    }
  }

  private enterApp() {
    return this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
