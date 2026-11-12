import { ErrorHandler, Injectable, Injector, NgZone } from '@angular/core';
import { FeedbackService } from './feedback.service';

/** At most one "something went wrong" message in this many milliseconds. */
const TOAST_INTERVAL_MS = 10000;

/**
 * Errors that are expected and not worth telling the user about: native plugins that do
 * not exist when the app runs in a browser, and a cancelled navigation.
 */
const IGNORED = [
  /cordova_not_available/i,
  /plugin_not_installed/i,
  /not implemented on web/i,
  /not available on this platform/i,
  /navigation (cancel|id)/i,
];

/**
 * Last line of defence: anything that was not handled where it happened ends up here.
 * It is always logged, and the user is told that something went wrong, so a failure is
 * never completely silent. Errors handled through FeedbackService never reach this.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private lastToastAt = 0;

  // The injector is used lazily: this class is created before most services exist.
  constructor(private injector: Injector) {}

  handleError(error: any): void {
    // Angular wraps unhandled promise rejections.
    const original = error?.rejection || error;
    console.error('Unhandled error:', original);

    const message = String(original?.message || original || '');
    if (IGNORED.some((pattern) => pattern.test(message))) {
      return;
    }

    // A lazy-loaded page failed to download, usually after an app update or offline.
    const isChunkError = /loading chunk [\w-]+ failed/i.test(message);

    const now = Date.now();
    if (now - this.lastToastAt < TOAST_INTERVAL_MS) {
      return;
    }
    this.lastToastAt = now;

    try {
      const zone = this.injector.get(NgZone);
      const feedback = this.injector.get(FeedbackService);
      zone.run(() =>
        feedback.toast(
          isChunkError
            ? 'Could not load this screen. Check your connection and try again.'
            : 'Something went wrong. Please try again.',
        ),
      );
    } catch (err) {
      console.error('Could not report the error to the user', err);
    }
  }
}
