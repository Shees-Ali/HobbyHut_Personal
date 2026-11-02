import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { CoreFacade } from '../../core/core.facade';
import { MessageService } from '../../message.service';

const TIMER_DURATION_MS = 1000 * 60 * 30; // 30 minutes
const LS_TIMERS_KEY = 'hobbyActiveTimers';

export interface HobbyTimer {
  hobbyId: string;
  hobbyName: string;
  startTime: number;
}

type HobbyTimerMap = Record<string, HobbyTimer>;

@Injectable({
  providedIn: 'root',
})
export class TimerService {
  /** Active timers keyed by hobbyId */
  activeTimers$ = new BehaviorSubject<HobbyTimerMap>({});

  /** 1-second pulse used by consumers to recompute remaining time */
  tick$ = new BehaviorSubject<number>(Date.now());

  /** Active interval subscription; null when no timer is running */
  private intervalSubscription: Subscription | null = null;

  constructor(
    private coreFacade: CoreFacade,
    private messageService: MessageService
  ) {
    // Auto-stop all timers when another part of the app sends a message signal
    this.messageService
      .getMessage()
      .pipe(filter((msg) => !!msg?.text))
      .subscribe(() => this.turnOffAll());

    // Rehydrate timers from localStorage on init
    this.rehydrate();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  get timerStatus$() {
    return this.coreFacade.timerStatus$;
  }

  isRunning(hobbyId: string | null | undefined): boolean {
    return !!hobbyId && !!this.activeTimers$.value[hobbyId];
  }

  getRemainingMs(hobbyId: string | null | undefined): number {
    if (!hobbyId) {
      return TIMER_DURATION_MS;
    }
    const timer = this.activeTimers$.value[hobbyId];
    if (!timer) {
      return TIMER_DURATION_MS;
    }
    return Math.max(0, TIMER_DURATION_MS - (Date.now() - timer.startTime));
  }

  /**
   * Returns the display value (minutes or seconds as a whole number).
   * > 60 000 ms remaining → show minutes, otherwise show seconds.
   */
  getDisplayValue(hobbyId: string | null | undefined): number {
    return this.getDisplayValueForMs(this.getRemainingMs(hobbyId));
  }

  /** True when remaining time is < 1 minute (use to shift countdown left in UI) */
  isUnderOneMinute(hobbyId: string | null | undefined): boolean {
    return this.getRemainingMs(hobbyId) <= 60_000;
  }

  /**
   * Toggle: if already running stop it, otherwise start for the given hobby.
   */
  async toggle(hobbyId: string | null | undefined): Promise<void> {
    if (!hobbyId) {
      return;
    }
    if (this.isRunning(hobbyId)) {
      this.stop(hobbyId);
    } else {
      await this.start(hobbyId);
    }
  }

  async start(hobbyId: string): Promise<void> {
    const hobbyName = this.coreFacade.currentHobbyRoom.value;
    const now = Date.now();

    const updatedTimers: HobbyTimerMap = {
      ...this.activeTimers$.value,
      [hobbyId]: { hobbyId, hobbyName, startTime: now },
    };

    this.activeTimers$.next(updatedTimers);
    this.coreFacade.timerStatus$.next('started');
    this.startTicking();
    this.persistTimers();

    try {
      const currentUser = await this.coreFacade.getCurrentUser();
      if (currentUser?.pushNotificationSettings?.timerToTop5Contacts) {
        const chatMembers: any = await this.coreFacade.getContacts();
          this.coreFacade.sendNotificationToTop5Contacts(
            chatMembers,
            hobbyName || hobbyId,
            this.coreFacade.currentHobbyId.value
          );
          this.coreFacade.presentToast('A Ready Now Notification has been Sent To Your Top 5');
      }
    } catch (error) {
      console.error('Failed to notify contacts:', error);
      // Continue anyway - local timer should still work
    }

    // Update Firebase with hobby-specific activity
    if (hobbyName) {
      this.coreFacade.setUserActive(hobbyName);
    }
  }

  stop(hobbyId: string): void {
    const timer = this.activeTimers$.value[hobbyId];
    if (!timer) {
      return;
    }

    const updatedTimers: HobbyTimerMap = { ...this.activeTimers$.value };
    delete updatedTimers[hobbyId];

    this.activeTimers$.next(updatedTimers);
    this.persistTimers();

    // Clear hobby-specific activity in Firebase
    if (timer.hobbyName) {
      this.coreFacade.setUserActiveFalse(timer.hobbyName);
    }

    if (Object.keys(updatedTimers).length === 0) {
      this.stopTicking();
      this.coreFacade.timerStatus$.next('stopped');
    }
  }

  turnOffAll(): void {
    const timers = { ...this.activeTimers$.value };
    Object.values(timers).forEach((timer) => {
      if (timer.hobbyName) {
        this.coreFacade.setUserActiveFalse(timer.hobbyName);
      }
    });

    this.activeTimers$.next({});
    this.persistTimers();
    this.stopTicking();
    this.coreFacade.timerStatus$.next('stopped');
  }

  // ---------------------------------------------------------------------------
  // Helper Methods
  // ---------------------------------------------------------------------------

  private rehydrate(): void {
    try {
      const stored = localStorage.getItem(LS_TIMERS_KEY);
      if (!stored) {
        return;
      }

      const parsed: HobbyTimerMap = JSON.parse(stored);
      const now = Date.now();
      const validTimers: HobbyTimerMap = {};

      Object.values(parsed).forEach((timer) => {
        if (!timer?.hobbyId || typeof timer.startTime !== 'number') {
          return;
        }
        const elapsed = now - timer.startTime;
        if (elapsed < TIMER_DURATION_MS) {
          validTimers[timer.hobbyId] = timer;
          // Restore Firebase active state for this hobby
          if (timer.hobbyName) {
            this.coreFacade.setUserActive(timer.hobbyName);
          }
        }
      });

      if (Object.keys(validTimers).length > 0) {
        this.activeTimers$.next(validTimers);
        this.coreFacade.timerStatus$.next('started');
        this.startTicking();
      } else {
        localStorage.removeItem(LS_TIMERS_KEY);
      }
    } catch (error) {
      console.error('Failed to rehydrate timers:', error);
      this.coreFacade.presentToast('Timer storage error. Please try again.');
    }
  }

  private persistTimers(): void {
    try {
      localStorage.setItem(LS_TIMERS_KEY, JSON.stringify(this.activeTimers$.value));
    } catch (error) {
      console.error('Failed to persist timers:', error);
      this.coreFacade.presentToast('Unable to save timer state.');
    }
  }

  private startTicking(): void {
    if (this.intervalSubscription && !this.intervalSubscription.closed) {
      return;
    }

    this.intervalSubscription = interval(1000).subscribe({
      next: () => {
        this.tick$.next(Date.now());
        this.cleanupExpiredTimers();
      },
      complete: () => {
        this.tick$.next(Date.now());
      },
    });
  }

  private stopTicking(): void {
    if (this.intervalSubscription) {
      this.intervalSubscription.unsubscribe();
      this.intervalSubscription = null;
    }
  }

  private cleanupExpiredTimers(): void {
    const now = Date.now();
    const currentTimers = { ...this.activeTimers$.value };
    let changed = false;

    Object.values(currentTimers).forEach((timer) => {
      const elapsed = now - timer.startTime;
      if (elapsed >= TIMER_DURATION_MS) {
        changed = true;
        delete currentTimers[timer.hobbyId];
        if (timer.hobbyName) {
          this.coreFacade.setUserActiveFalse(timer.hobbyName);
        }
      }
    });

    if (!changed) {
      return;
    }

    this.activeTimers$.next(currentTimers);
    this.persistTimers();

    if (Object.keys(currentTimers).length === 0) {
      this.stopTicking();
      this.coreFacade.timerStatus$.next('stopped');
    }
  }

  private getDisplayValueForMs(remainingMs: number): number {
    if (remainingMs > 60_000) {
      return Math.floor(remainingMs / 1000 / 60);
    }
    return Math.floor(remainingMs / 1000);
  }
}
