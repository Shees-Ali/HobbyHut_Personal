import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { first } from 'rxjs/operators';
import { CoreFacade } from './core.facade';
import { isProfileComplete } from './profile';

export const COMPLETE_PROFILE_URL = '/complete-profile';

/**
 * Keeps users out of the app until their profile is complete.
 *
 * Use it together with the auth guard: when nobody is signed in this guard lets the
 * navigation through so the auth guard can redirect to sign-in.
 */
@Injectable({ providedIn: 'root' })
export class ProfileCompleteGuard implements CanActivate {
  constructor(
    private afAuth: AngularFireAuth,
    private coreFacade: CoreFacade,
    private router: Router,
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const authUser = await this.afAuth.user.pipe(first()).toPromise();
    if (!authUser) {
      return true;
    }

    // Right after the profile form is saved, the live profile is ahead of a fresh read.
    if (this.coreFacade.isLiveProfileComplete(authUser.uid)) {
      return true;
    }

    try {
      const user = await this.coreFacade.ensureUserDoc(authUser);
      const complete =
        isProfileComplete(user) || this.coreFacade.isLiveProfileComplete(authUser.uid);
      return complete ? true : this.router.parseUrl(COMPLETE_PROFILE_URL);
    } catch (err) {
      // The profile could not be read (offline, permissions). Do not let the user in on
      // a guess; the complete-profile page shows the problem and lets them retry.
      console.error('Could not check the profile', err);
      return this.router.parseUrl(COMPLETE_PROFILE_URL);
    }
  }
}
