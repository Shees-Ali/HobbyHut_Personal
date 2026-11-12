import { Injectable } from '@angular/core';
import { LoadingController, ToastController } from '@ionic/angular';

export interface RunOptions {
  /** Shown when the action fails, e.g. 'Could not save your hobby.' A reason is added to it. */
  failure: string;
  /** Shown when the action succeeds. Leave out for actions whose result is visible anyway. */
  success?: string;
  /** Show a blocking spinner with this text while the action runs. */
  loading?: string;
}

/** How long to wait before telling the user a save is taking too long. */
const SLOW_ACTION_MS = 10000;

/**
 * One place for telling the user what happened to something they did.
 *
 * Wrap anything the user triggers that writes data:
 *
 *   const ok = await this.feedback.run(() => this.coreFacade.updateInfo(info, user), {
 *     failure: 'Could not save your profile details.',
 *   });
 *
 * `run` never throws. It logs the error, shows a toast with a plain reason, and
 * resolves with false, so the caller can undo optimistic UI changes.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  constructor(
    private toastController: ToastController,
    private loadingController: LoadingController,
  ) {}

  /** Runs a user-triggered action. Resolves true on success, false on failure. Never throws. */
  async run(action: () => Promise<unknown> | unknown, options: RunOptions): Promise<boolean> {
    const loading = options.loading
      ? await this.loadingController.create({ message: options.loading })
      : null;
    if (loading) {
      await loading.present();
    }

    // Firestore writes do not fail while offline; they wait. Tell the user instead of
    // leaving them guessing.
    let slowTimer: any = setTimeout(() => {
      slowTimer = null;
      this.toast('This is taking longer than usual. Check your connection.');
    }, SLOW_ACTION_MS);

    try {
      await action();
      if (options.success) {
        this.toast(options.success);
      }
      return true;
    } catch (err) {
      this.error(err, options.failure);
      return false;
    } finally {
      if (slowTimer) {
        clearTimeout(slowTimer);
      }
      if (loading) {
        await loading.dismiss().catch(() => {});
      }
    }
  }

  /** Logs an error and tells the user: `<failure> <reason>`. */
  error(err: unknown, failure: string): void {
    console.error(failure, err);
    this.toast(`${failure} ${describeError(err)}`.trim());
  }

  async toast(message: string, duration = 3500): Promise<void> {
    try {
      const toast = await this.toastController.create({ message, duration });
      await toast.present();
    } catch (err) {
      console.error('Could not show a message to the user:', message, err);
    }
  }
}

/** Firebase error code -> a reason a person can act on. */
const REASONS: { [code: string]: string } = {
  // Firestore
  unavailable: 'Check your connection and try again.',
  'deadline-exceeded': 'Check your connection and try again.',
  'permission-denied': 'You do not have permission to do that.',
  unauthenticated: 'Please sign in again.',
  'not-found': 'It no longer exists.',
  'resource-exhausted': 'Too many requests. Please try again in a moment.',
  aborted: 'Please try again.',
  // Storage
  'storage/unauthorized': 'You do not have permission to do that.',
  'storage/unauthenticated': 'Please sign in again.',
  'storage/canceled': 'The upload was cancelled.',
  'storage/retry-limit-exceeded': 'Check your connection and try again.',
  'storage/quota-exceeded': 'Storage is full. Please try again later.',
  // Auth
  'auth/network-request-failed': 'Check your connection and try again.',
  'auth/requires-recent-login': 'For security, sign out, sign in again, and then retry.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/invalid-verification-code': 'That code is not correct.',
  'auth/code-expired': 'That code has expired. Request a new one.',
  'auth/invalid-phone-number': 'That phone number is not valid.',
  'auth/wrong-password': 'The email or password is not correct.',
  'auth/user-not-found': 'The email or password is not correct.',
  'auth/invalid-email': 'That email address is not valid.',
  'auth/email-already-in-use': 'That email address is already registered.',
  'auth/weak-password': 'Choose a stronger password.',
  'auth/user-disabled': 'This account has been disabled.',
};

/** A short reason for a failure, safe to show to the user. */
export function describeError(err: unknown): string {
  // Errors raised by the app itself can say exactly what the user should know.
  if (typeof (err as any)?.userMessage === 'string') {
    return (err as any).userMessage;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline.';
  }
  const code = typeof (err as any)?.code === 'string' ? ((err as any).code as string) : '';
  // Firestore codes sometimes arrive prefixed, e.g. 'firestore/unavailable'.
  const reason = REASONS[code] || REASONS[code.replace(/^firestore\//, '')];
  return reason || 'Please try again.';
}
