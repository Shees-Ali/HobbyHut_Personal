import { combineLatest } from 'rxjs';
import { CoreFacade } from './../../core/core.facade';
import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { map, tap } from 'rxjs/operators';
import { SkillLevel } from '../../core/core.model';

@Component({
  selector: 'app-edit-hobbies',
  templateUrl: './edit-hobbies.component.html',
  styleUrls: ['./edit-hobbies.component.scss']
})
export class EditHobbiesComponent implements OnInit {
  vm$;
  readonly SkillLevel = SkillLevel;
  constructor(private modalCtrl: ModalController, private coreFacade: CoreFacade) {}

  dismiss() {
    // using the injected ModalController this page
    // can "dismiss" itself and optionally pass back data
    this.modalCtrl.dismiss();
  }

  ngOnInit() {
    const hobbies$ = this.coreFacade.hobbies$;
    const usersHobbies$ = this.coreFacade.user$;
    this.vm$ = combineLatest([hobbies$, usersHobbies$]).pipe(
      map(([hobbies, userHobbies]) =>
        hobbies.map(hobby => ({
          ...hobby,
          skillLevel: userHobbies.hobbies.find(userHobby => {
            return userHobby.hobbyID === hobby.hobbyID;
          })
        }))
      ),
      tap(params => {
      })
    );
  }

  onSkillLevelChanged(skillLevel, hobby) {
    const feedback = this.coreFacade.feedback;
    if (hobby.skillLevel) {
      if (hobby.skillLevel.skillLevel == skillLevel) {
        this.removeHobby(hobby);
        return;
      }
      feedback.run(() => this.coreFacade.updateUserHobbies(hobby, skillLevel), {
        failure: `Could not update ${hobby.name}.`,
      });
      return;
    }
    feedback.run(() => this.coreFacade.addUserHobby(hobby, skillLevel), {
      failure: `Could not add ${hobby.name}.`,
    });
  }

  removeHobby(hobby) {
    this.coreFacade.feedback.run(() => this.coreFacade.removeUserHobby(hobby), {
      failure: `Could not remove ${hobby.name}.`,
    });
  }

  save() {
    this.dismiss();
  }
}
