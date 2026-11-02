import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { CoreFacade } from '../../core/core.facade';
import { TimerService } from './timer.service';

@Component({
  selector: 'app-timer-button',
  templateUrl: './timer-button.component.html',
  styleUrls: ['./timer-button.component.scss'],
})
export class TimerButtonComponent implements OnInit, OnDestroy {
  @ViewChild('demo', { static: false }) demo: ElementRef;

  private destroy$ = new Subject<void>();
  public inActivityRoom: boolean = false;

  /** Hobby currently in focus on hobby-room page */
  currentHobbyId: string | null = null;

  /** The hobbyId the button should display — latest running timer when off hobby-room */
  displayHobbyId: string | null = null;

  constructor(
    public timerService: TimerService,
    private coreFacade: CoreFacade,
    private router: Router
  ) {
    this.inActivityRoom = this.router.url.includes('hobby-room') && !this.router.url.includes('/profile');
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      this.inActivityRoom = event.urlAfterRedirects.includes('hobby-room') && !event.urlAfterRedirects.includes('/profile');
    });
  }

  ngOnInit() {
    this.coreFacade.currentHobbyId
      .pipe(takeUntil(this.destroy$))
      .subscribe((hobbyId) => {
        this.currentHobbyId = hobbyId || null;
        this.updateDisplayHobbyId();
      });

    this.timerService.activeTimers$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateDisplayHobbyId();
      });

    this.timerService.tick$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateAnimation();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.coreFacade.destroyAnimation();
  }

  isRunning(): boolean {
    return this.timerService.isRunning(this.displayHobbyId);
  }

  async toggleTimer() {
    if (!this.displayHobbyId) {
      return;
    }

    if (!this.isRunning()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (e) {
        console.warn('Haptics unavailable', e);
      }
    }

    await this.timerService.toggle(this.displayHobbyId);
  }

  private updateDisplayHobbyId(): void {
    if (this.currentHobbyId) {
      this.displayHobbyId = this.currentHobbyId;
      return;
    }
    const timers = this.timerService.activeTimers$.value;
    const entries = Object.values(timers);
    if (entries.length > 0) {
      const latest = entries.reduce((a, b) => a.startTime > b.startTime ? a : b);
      this.displayHobbyId = latest.hobbyId;
    } else {
      this.displayHobbyId = null;
    }
  }

  private updateAnimation(): void {
    if (!this.demo?.nativeElement || this.destroy$.closed) {
      return;
    }

    if (this.isRunning()) {
      this.coreFacade.createAnimationInstance(this.demo.nativeElement);
      this.coreFacade.playAnimation();
    } else {
      this.coreFacade.stopAnimation();
    }
  }
}
