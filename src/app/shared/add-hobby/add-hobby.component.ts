import { CoreFacade } from './../../core/core.facade';
import { PopoverController, NavParams } from '@ionic/angular';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';

@Component({
  selector: 'app-add-hobby',
  templateUrl: './add-hobby.component.html',
  styleUrls: ['./add-hobby.component.scss']
})
export class AddHobbyComponent implements OnInit {
  selectedHobby;
  params: Params;
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private popoverController: PopoverController,
    private navParams: NavParams,
    private coreFacade: CoreFacade
  ) {}

  ngOnInit() {
    this.params = this.route.snapshot.params;
    this.selectedHobby = this.navParams.get('props');
  }

  onClose() {
    this.popoverController.dismiss();
  }

  async onSkillLevelChanged(skillLevel) {
    const added = await this.coreFacade.feedback.run(
      () => this.coreFacade.addUserHobby(this.selectedHobby, skillLevel),
      { failure: 'Could not add this hobby.' },
    );
    if (!added) {
      // Stay on the popover so the user can try again.
      return;
    }
    this.popoverController.dismiss();
    this.coreFacade.hobbiesList.push({ name: this.selectedHobby.name, id: this.selectedHobby.hobbyID })
    this.coreFacade.currentSelectedhobby = this.selectedHobby;
    this.go(this.selectedHobby.hobbyID);
  }

  private go(hobbyID) {
    this.router.navigate(['tabs/home-main/home/hobby-room', hobbyID], {
      relativeTo: this.route
    });
  }
}
