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
    if (hobby.skillLevel) {
      if (hobby.skillLevel.skillLevel == skillLevel) {
        this.coreFacade.removeUserHobby(hobby);
        return;
      }
      this.coreFacade.updateUserHobbies(hobby, skillLevel);

      return;
    }
    this.coreFacade.addUserHobby(hobby, skillLevel);
  }

  removeHobby(hobby) {
    this.coreFacade.removeUserHobby(hobby);
  }

  save() {
    this.dismiss();
  }
}
