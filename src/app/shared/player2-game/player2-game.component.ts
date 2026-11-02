import { combineLatest, interval, Subject, timer } from 'rxjs';
import { CoreFacade } from './../../core/core.facade';
import { Component, Input, OnInit, NgZone } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { map, takeUntil, tap } from 'rxjs/operators';
import { Game, GameStatus, Hobby, User } from 'src/app/core/core.model';

@Component({
  selector: 'app-player2-game',
  templateUrl: './player2-game.component.html',
  styleUrls: ['./player2-game.component.scss']
})
export class Player2GameComponent implements OnInit {
  vm$;
  @Input() game: Game;
  unsubscribeGame;
  isGameRequestSent: boolean;

  player1: User & { photoUrl?: string };
  player2: User & { photoUrl?: string };
  gameWinner: User;
  inputStatus$;
  hobby: any;
  player1SkillLevel: string;

  countDownTime = 1000 * 30;
  IsTimeOut = false;
  timerStatusp2$;
  timer: any;
  timingInterval: any;
  flagForInterval: any;
  thirtyMinuteTimer = (t) => timer(this.countDownTime).pipe(
    tap(_ => {
      this.coreFacade.timerStatusP$.next('stopped');
      this.stop(t);
    })
  );
  constructor(private modalCtrl: ModalController,
    private afFs: AngularFirestore,
    public zone: NgZone,
    private coreFacade: CoreFacade) {
    this.timerStatusp2$ = this.coreFacade.timerStatusP$;
    this.inputStatus$ = this.coreFacade.inputStatus$;
    this.timer = {};
    this.timingInterval = [];
    this.flagForInterval = [];
  }

  dismiss() {
    // using the injected ModalController this page
    // can "dismiss" itself and optionally pass back data
    this.modalCtrl.dismiss();
  }

  async ngOnInit() {
    this.hobby = await this.coreFacade.getDocument('hobbies', this.game.hobby['id']) as Hobby;
    this.hobby.hobbyID = this.game.hobby['id'];
    this.player1 = await this.coreFacade.getDocument('users', this.game.player1['id']) as User;
    this.player2 = await this.coreFacade.getDocument('users', this.game.player2['id']) as User;

    this.player1["photoUrl"] = this.getPhoto(this.player1);
    this.player2["photoUrl"] = this.getPhoto(this.player2);

    const player1Hobby = this.player1.hobbies.find(hobby => hobby.hobbyID === this.hobby.hobbyID);
    this.player1SkillLevel = player1Hobby.skillLevel;
    this.subscribeProGameRequestCollection();
  }
  ionViewWillEnter() {
    this.coreFacade.updateLastLoginTime();
  }
  async acceptProGameRequest() {
    await this.coreFacade.updateGame(this.game.id, {
      status: GameStatus.ACCEPTED,
      requestAcceptedAt: Date.now()
    });
    this.game.status = GameStatus.ACCEPTED;
  }

  async rejectProGameRequest() {
    await this.coreFacade.updateGame(this.game.id, {
      status: GameStatus.REJECTED,
      requestRejectedAt: Date.now()
    });
    this.game.status = GameStatus.REJECTED;
    this.dismiss();
  }

  async acceptGameScore() {
    if (this.game.status === 'correctedScoreSent') {
      await this.coreFacade.updateGame(this.game.id, {
        status: GameStatus.COMPLETED,
        // isDraw: this.game.score.player1 === this.game.score.player2,
        correctedScoreAcceptedAt: Date.now()
      });
      if (this.game.correctedScore.player1Won === 'W') {
        this.gameWinner = this.player1;
      } else if (this.game.correctedScore.player2Won === 'W') {
        this.gameWinner = this.player2;
      }
      this.game.status = GameStatus.COMPLETED;
    } else {
      await this.coreFacade.updateGame(this.game.id, {
        status: GameStatus.COMPLETED,
        // isDraw: this.game.score.player1 === this.game.score.player2,
        scoreAcceptedAt: Date.now()
      });
      if (this.game.score.player1Won === 'W') {
        this.gameWinner = this.player1;
      } else if (this.game.score.player2Won === 'W') {
        this.gameWinner = this.player2;
      }
      this.game.status = GameStatus.COMPLETED;
    }
  }

  async rejectGameScore() {
    if (this.game.status === 'correctedScoreSent') {
      this.coreFacade.updateGame(this.game.id, {
        status: GameStatus.DISPUTED,
        correctedScoreRejected: true,
        correctedScoreRejectedAt: Date.now()
      });
      this.game.status = GameStatus.DISPUTED;
    } else {
      this.coreFacade.updateGame(this.game.id, {
        status: GameStatus.SCORE_REJECTED,
        scoreRejected: true,
        scoreRejectedAt: Date.now()
      });
      this.game.status = GameStatus.SCORE_REJECTED;
    }
  }

  subscribeProGameRequestCollection() {
    // listen to the game changes
    // console.log(`@@@@@@`, this.player2);
    this.afFs.firestore.collection('games').doc(`${this.game.id}`)
      .onSnapshot(async (doc) => {
        this.zone.run(() => {
          this.game = doc.data() as Game;
          this.game.id = doc.id;
        });

        console.log('game on player 2:', this.game);


        if (this.game.status === 'pending') {
          this.startTimer();
        } else if (this.game.status === 'accepted') {
          this.startTimer();
        } else {
          this.stop(this.coreFacade.homeStatus$.value);
        }
      });
  }


  async startTimer() {
    this.IsTimeOut = false;
    var hobbyID = this.coreFacade.homeStatus$.value;
    if (this.timerStatusp2$.value === 'started') {
      // this.stop(hobbyID);
      // this.IsTimeOut = true;
      return;
    } else {
      this.flagForInterval[hobbyID] = new Subject;
      this.coreFacade.timerStatusP$.next('started');
    }

    this.timingInterval[hobbyID] = interval(1000);
    this.timingInterval[hobbyID].pipe(
      tap(_ => {
      }),
      takeUntil(this.flagForInterval[hobbyID])
    )
      .subscribe(
        val => {
          if (val !== this.countDownTime / 1000) {
            this.timer[hobbyID] = +this.countDownTime - (+val + 1) * 1000;
          } else {
            console.log(this.game)
            this.IsTimeOut = true;
            this.stop(hobbyID);
          }
        },
        () => { },
        () => {
          delete this.timer[this.coreFacade.homeStatus$.value];
          this.coreFacade.timerStatusP$.next('stopped');
          this.timingInterval[hobbyID] = undefined;
        }
      );
  }

  stop(hobbyID) {
    this.flagForInterval[hobbyID].next();
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
    if (this.timerStatusp2$.value === 'stopped') {
      return 30;
    }
    if (this.timer[this.coreFacade.homeStatus$.value]) {
      this.coreFacade.timerStatusP$.next('started');
      if (this.timer[this.coreFacade.homeStatus$.value] > 60000) {
        return Math.floor((this.timer[this.coreFacade.homeStatus$.value] / 1000) / 60);
      }
      return this.timer[this.coreFacade.homeStatus$.value] / 1000;
    } else {
      return 30;
    }
  }
  getPhoto(user: any) {

    if (user && user.photos && user.photos.length > 0) {
      return user.photos[user.photos.length - 1];
    }
  }
}
