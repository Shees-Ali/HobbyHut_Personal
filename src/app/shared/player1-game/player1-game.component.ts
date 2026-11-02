import { combineLatest, interval, Subject, timer } from 'rxjs';
import { CoreFacade } from './../../core/core.facade';
import { Component, Input, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';
import { map, takeUntil, tap } from 'rxjs/operators';
import { Game, User, Hobby, GameStatus } from 'src/app/core/core.model';

@Component({
  selector: 'app-player1-game',
  templateUrl: './player1-game.component.html',
  styleUrls: ['./player1-game.component.scss'],
})
export class Player1GameComponent implements OnInit {
  vm$;
  @Input() hobbyId: string;
  @Input() player2Id: string;
  @Input() game: Game;
  unsubscribeGame;
  isGameRequestSent: boolean;
  player1: User & { photoUrl?: string };
  player2: User & { photoUrl?: string };
  gameWinner: User;
  inputStatus$;
  showScoreForm = false;
  hobby: any;
  player1Won: string;
  player2Won: string;
  countDownTime = 1000 * 30;
  messageReceived$;

  IsTimeOut = false;
  timerStatusp1$;
  timerStatusWaitingScore$;
  timer: any;
  timingInterval: any;
  flagForInterval: any;
  thirtyMinuteTimer = (t) =>
    timer(this.countDownTime).pipe(
      tap((_) => {
        this.coreFacade.timerStatusP$.next('stopped');
        this.stop(t);
      })
    );
  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private coreFacade: CoreFacade,
    private cdr: ChangeDetectorRef,
    public zone: NgZone
  ) {
    this.timerStatusp1$ = this.coreFacade.timerStatusP$;
    this.inputStatus$ = this.coreFacade.inputStatus$;
    this.timerStatusWaitingScore$ = this.coreFacade.timerStatusWaitingScore$;
    this.timer = {};
    this.timingInterval = [];
    this.flagForInterval = [];
  }

  dismiss(IsFromCancel = false) {
    // using the injected ModalController this page
    // can "dismiss" itself and optionally pass back data
    this.modalCtrl.dismiss({ IsFrom: IsFromCancel ? 'Cancel' : '' });
  }

  async ngOnInit() {
    this.player1Won = '';
    this.player2Won = '';
    this.hobby = (await this.coreFacade.getDocument('hobbies', this.hobbyId)) as Hobby;
    this.player1 = (await this.coreFacade.getCurrentUser()) as User;
    this.player2 = (await this.coreFacade.getUserObj(this.player2Id)) as User;

    this.player1['photoUrl'] = this.getPhoto(this.player1);
    this.player2['photoUrl'] = this.getPhoto(this.player2);

    await this.checkIfProGameRequestSent();
  }
  ionViewWillEnter() {
    this.coreFacade.updateLastLoginTime();
  }

  async chooseWinner(player) {
    if (this.player1.uid === player.uid) {
      this.player1Won = 'W';
      this.player2Won = '';
    } else {
      this.player1Won = '';
      this.player2Won = 'W';
    }
  }

  async checkIfProGameRequestSent() {
    const game = (await this.coreFacade.getGameObj(
      this.hobbyId,
      this.player1.uid,
      this.player2.uid
    )) as Game;
    if (game) {
      this.game = game;
      this.isGameRequestSent = true;
      this.subscribeToGameChange(game);

      if (this.game.status === GameStatus.SCORE_REJECTED) {
        this.player1Won = this.game.score.player1Won;
        this.player2Won = this.game.score.player2Won;
      }
    }
  }

  async resetGame() {
    // this.isGameRequestSent = false;
    // this.game = {} as Game;
    this.unsubscribeGame();
  }

  async subscribeToGameChange(game) {
    this.unsubscribeGame = this.coreFacade.subscribeToGameChange(game).onSnapshot(async (doc) => {
      this.zone.run(async () => {
        this.game = { id: doc.id, ...doc.data() } as Game;

        if (!this.game.isFriendly) {
          this.game.isFriendly = false;
        }
        this.stopTimerforScoreRequest();
        if (
          this.game.status == GameStatus.SCORE_SENT ||
          this.game.status == GameStatus.CORRECTED_SCORE_SENT
        ) {
          this.startTimerforScoreRequest();
        }

        if ([GameStatus.PENDING, GameStatus.CREATED].indexOf(this.game.status) == -1) {
          this.stop(this.coreFacade.homeStatus$.value);
        }

        if (
          [GameStatus.REJECTED, GameStatus.COMPLETED, GameStatus.DISPUTED].indexOf(
            this.game.status
          ) >= 0
        ) {
          // await this.showFinalModal(this.game);
          await this.resetGame();
          if (this.game.status === GameStatus.COMPLETED) {
            if (this.game.correctedScore && this.game.correctedScore.player1Won === 'W') {
              this.gameWinner = this.player1;
            } else if (this.game.correctedScore && this.game.correctedScore.player2Won === 'W') {
              this.gameWinner = this.player2;
            } else if (this.game.score.player1Won === 'W') {
              this.gameWinner = this.player1;
            } else if (this.game.score.player2Won === 'W') {
              this.gameWinner = this.player2;
            }
          }
        }
      });
    });
  }

  async startTimer() {
    this.IsTimeOut = false;
    var hobbyID = this.coreFacade.homeStatus$.value;
    if (this.timerStatusp1$.value === 'started') {
      // this.stop(hobbyID);
      // this.IsTimeOut = true;
      return;
    } else {
      this.flagForInterval[hobbyID] = new Subject();
      this.coreFacade.timerStatusP$.next('started');
    }

    this.timingInterval[hobbyID] = interval(1000);
    this.timingInterval[hobbyID]
      .pipe(
        tap((_) => {}),
        takeUntil(this.flagForInterval[hobbyID])
      )
      .subscribe(
        (val) => {
          if (val !== this.countDownTime / 1000) {
            this.timer[hobbyID] = +this.countDownTime - (+val + 1) * 1000;
          } else {
            this.stop(hobbyID);
            this.IsTimeOut = true;
            this.OnTimeOut();
          }
        },
        () => {},
        () => {
          delete this.timer[this.coreFacade.homeStatus$.value];
          this.coreFacade.timerStatusP$.next('stopped');
          this.timingInterval[hobbyID] = undefined;
        }
      );
  }

  stop(hobbyID) {
    if (this.flagForInterval[hobbyID]) {
      this.flagForInterval[hobbyID].next();
    }
    // if (this.coreFacade) {
    //   this.coreFacade.setUserActiveFalse(hobbyID);
    // }
    delete this.timer[hobbyID];
    if (this.coreFacade) {
      this.coreFacade.timerStatusP$.next('stopped');
    }
    this.timingInterval[hobbyID] = undefined;
  }

  getCountdownTime(): number {
    if (this.timerStatusp1$.value === 'stopped') {
      return 30;
    }
    if (this.timer[this.coreFacade.homeStatus$.value]) {
      this.coreFacade.timerStatusP$.next('started');
      if (this.timer[this.coreFacade.homeStatus$.value] > 60000) {
        return Math.floor(this.timer[this.coreFacade.homeStatus$.value] / 1000 / 60);
      }
      return this.timer[this.coreFacade.homeStatus$.value] / 1000;
    } else {
      return 0;
    }
  }

  objserverTimer;
  startTimerVal = -1;
  async startTimerforScoreRequest() {
    this.IsTimeOut = false;

    if (this.timerStatusWaitingScore$.value === 'started') {
      return;
    } else {
      this.coreFacade.timerStatusWaitingScore$.next('started');
    }

    const ScoretimingInterval = interval(1000);
    this.objserverTimer = ScoretimingInterval.pipe().subscribe((val) => {
      if (val !== this.countDownTime / 1000) {
        this.startTimerVal = +this.countDownTime - (+val + 1) * 1000;
      } else {
        this.IsTimeOut = true;
        this.OnTimeOut();
        this.stopTimerforScoreRequest();
      }
    });
  }

  getCountdownTimeForScoreRequest(): number {
    if (this.timerStatusWaitingScore$.value === 'stopped') {
      return 30;
    }
    if (this.startTimerVal != -1) {
      this.coreFacade.timerStatusWaitingScore$.next('started');
      if (this.startTimerVal > 60000) {
        return Math.floor(this.startTimerVal / 1000 / 60);
      }
      return this.startTimerVal / 1000;
    } else {
      return 30;
    }
  }

  stopTimerforScoreRequest() {
    this.startTimerVal = -1;
    this.coreFacade.timerStatusWaitingScore$.next('stopped');

    if (this.objserverTimer) {
      this.objserverTimer.unsubscribe();
    }
  }

  async OnTimeOut() {
    await this.coreFacade.updateGame(this.game.id, {
      status: GameStatus.TIMEOUT,
      requestTimeoutAt: Date.now(),
    });
    this.game.status = GameStatus.TIMEOUT;
  }

  async showFinalModal(game) {
    // let winner = null;
    // if (game.winner && game.winner.id) {
    //   winner = await this.coreFacade.getUserObj(game.winner.id) as User;
    // }
    // const alert = await this.alertController.create({
    //   cssClass: 'pro-game-request-modal',
    //   header: winner && winner.displayName ? `Congratulations ${winner.displayName}!` : `Better luck next time`,
    //   buttons: [
    //     {
    //       text: 'OK'
    //     }
    //   ]
    // });
    // return await alert.present();
  }

  async sendProGameRequest() {
    this.game = (await this.coreFacade.createGame(this.hobbyId, this.player2)) as Game;
    this.isGameRequestSent = true;
    this.subscribeToGameChange(this.game);

    this.startTimer();
  }

  isFriendlyGame() {
    this.game.isFriendly = !this.game.isFriendly;
    // if (this.game.isFriendly) {
    const player1ScoreEl = document.getElementById('player1-score') as HTMLInputElement;
    const player2ScoreEl = document.getElementById('player2-score') as HTMLInputElement;
    const player1WonEl = document.getElementById('player1-won') as HTMLInputElement;
    const player2WonEl = document.getElementById('player2-won') as HTMLInputElement;
    player1ScoreEl.value = '';
    player2ScoreEl.value = '';
    player1WonEl.value = this.game.isFriendly ? 'F' : '';
    player2WonEl.value = this.game.isFriendly ? 'F' : '';
    // }
  }

  async sendProGameScore() {
    const player1ScoreEl = document.getElementById('player1-score') as HTMLInputElement;
    const player2ScoreEl = document.getElementById('player2-score') as HTMLInputElement;
    const player1WonEl = document.getElementById('player1-won') as HTMLInputElement;
    const player2WonEl = document.getElementById('player2-won') as HTMLInputElement;
    if (!this.game.isFriendly) {
      if (!player1ScoreEl.value && !player2ScoreEl.value) {
        const alert = await this.alertCtrl.create({
          cssClass: 'pro-game-request-modal',
          header: 'Please add Scores',
          // message: 'Message <strong>text</strong>!!!',
          buttons: [
            {
              text: 'OK',
              role: 'cancel',
            },
          ],
        });

        return await alert.present();
      }

      const scorePlayer1 = parseInt(player1ScoreEl.value || '0');
      const scorePlayer2 = parseInt(player2ScoreEl.value || '0');

      if (scorePlayer1 > 0 && scorePlayer2 == 0) {
        player2ScoreEl.value = '0';
        player2WonEl.value = '';
        player1WonEl.value = 'W';
      } else if (scorePlayer2 > 0 && scorePlayer1 == 0) {
        player1WonEl.value = '';
        player1ScoreEl.value = '0';
        player2WonEl.value = 'W';
      }

      // Make the player having high score as winner
      if (scorePlayer1 > scorePlayer2) {
        player1WonEl.value = 'W';
        player2WonEl.value = '';
      } else if (scorePlayer2 > scorePlayer1) {
        player2WonEl.value = 'W';
        player1WonEl.value = '';
      }

      // Condition for checking if the winner is added or not
      if (player1WonEl.value.toLowerCase() !== 'w' && player2WonEl.value.toLowerCase() !== 'w') {
        const alert = await this.alertCtrl.create({
          cssClass: 'pro-game-request-modal',
          header: 'Please add Winner',
          // message: 'Message <strong>text</strong>!!!',
          buttons: [
            {
              text: 'OK',
              role: 'cancel',
            },
          ],
        });

        return await alert.present();
      }
    }
    if (this.game.status === 'scoreRejected') {
      this.coreFacade.updateGame(this.game.id, {
        status: GameStatus.CORRECTED_SCORE_SENT,
        correctedScore: {
          player1: player1ScoreEl.value,
          player2: player2ScoreEl.value,
          player1Won: player1WonEl.value,
          player2Won: player2WonEl.value,
        },
        correctedScoreCreatedAt: Date.now(),
        isFriendly: this.game.isFriendly,
      });
    } else {
      this.coreFacade.updateGame(this.game.id, {
        status: GameStatus.SCORE_SENT,
        score: {
          player1: player1ScoreEl.value,
          player2: player2ScoreEl.value,
          player1Won: player1WonEl.value,
          player2Won: player2WonEl.value,
        },
        scoreCreatedAt: Date.now(),
        isFriendly: this.game.isFriendly,
      });
    }
  }

  async sendProGameCorrectedScore() {
    // console.log('user:', user, this.hobbyId);
    // const alert = await this.alertController.create({
    //   cssClass: 'pro-game-request-modal',
    //   header: 'Enter corrected scores',
    //   // message: 'Message <strong>text</strong>!!!',
    //   inputs: [
    //     {
    //       name: 'player1Score',
    //       type: 'number',
    //       placeholder: 'Your score'
    //     },
    //     {
    //       name: 'player2Score',
    //       type: 'number',
    //       placeholder: `${user.displayName}'s score`
    //     }
    //   ],
    //   buttons: [
    //     {
    //       text: 'Confirm',
    //       handler: (result) => {
    //         if (!result.player1Score || !result.player2Score) {
    //           return false;
    //         }
    //         this.coreFacade.updateGame(this.game.id, {
    //           status: GameStatus.CORRECTED_SCORE_SENT,
    //           correctedScore: {
    //             player1: result.player1Score,
    //             player2: result.player2Score
    //           },
    //           correctedScoreCreatedAt: Date.now()
    //         });
    //         console.log('Confirm Okay', result);
    //       }
    //     },
    //     {
    //       text: 'Cancel',
    //       role: 'cancel',
    //       // cssClass: 'secondary',
    //       handler: (blah) => {
    //         console.log('Confirm Reject');
    //       }
    //     }
    //   ]
    // });
    // await alert.present();
  }
  getPhoto(user: any) {
    if (user && user.photos && user.photos.length > 0) {
      return user.photos[user.photos.length - 1];
    }
  }

  ionViewWillLeave() {
    if (
      this.game.status == GameStatus.SCORE_SENT ||
      this.game.status == GameStatus.CORRECTED_SCORE_SENT
    ) {
      this.OnTimeOut();
      this.stopTimerforScoreRequest();
    }
  }
}
