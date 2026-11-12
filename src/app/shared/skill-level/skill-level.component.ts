import { CoreFacade } from './../../core/core.facade';
import { PopoverController } from '@ionic/angular';
import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  Input
} from '@angular/core';
import { HobbyMeta, SkillLevel } from '../../core/core.model';

@Component({
  selector: 'ui-skill-level',
  templateUrl: './skill-level.component.html',
  styleUrls: ['./skill-level.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SkillLevelComponent implements OnInit {
  @Input() skillLevel?: string;
  @Input() fromPopover: string;
  @Input() hobbyLevelFilter: string;
  @Input() meta: HobbyMeta;
  @Input() hobbyID: string;
  @Input() hobbyName: string;
  @Output() skillLevelChanged = new EventEmitter<string>();
  readonly SkillLevel = SkillLevel;
  constructor(private popoverController: PopoverController, private coreFacade: CoreFacade) { }


  ngOnInit() {
    // console.log(this.fromPopover, this.meta, this.hobbyID, this.hobbyName, this.hobbyLevelFilter);
  }

  async segmentChanged({ detail: { value } }) {
    this.skillLevelChanged.emit(value);
    if (this.fromPopover && this.fromPopover == "1") {
      const saved = await this.coreFacade.feedback.run(
        () =>
          this.coreFacade.updateUserHobbies(
            { hobbyID: this.hobbyID, name: this.hobbyName, meta: this.meta },
            value
          ),
        { failure: 'Could not update your skill level.' }
      );
      if (saved) {
        localStorage.setItem('skillLevel', value);
      }
      this.popoverController.dismiss();
    }
  }
}
