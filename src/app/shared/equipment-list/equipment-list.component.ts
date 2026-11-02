import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  ViewChild,
  Output,
  EventEmitter,
  OnChanges,
  ElementRef,
} from '@angular/core';
import { Hobby } from 'src/app/core/core.model';
import { CoreFacade } from 'src/app/core/core.facade';
import * as _ from 'lodash';

@Component({
  selector: 'equipment-list',
  templateUrl: './equipment-list.component.html',
  styleUrls: ['./equipment-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentListComponent implements OnInit, OnChanges {
  @Input() activeHobbies: Partial<Hobby>;
  @Input() hobbies: any = [];
  @ViewChild('slides', { static: true }) slider: ElementRef | undefined;
  @Output() currentActiveHobby: EventEmitter<any> = new EventEmitter();
  callFromHome: boolean = false;
  HobbiesArray: any = [];
  constructor(private coreFacade: CoreFacade) {}
  ngOnInit() {
    if (typeof this.hobbies == 'object') {
      this.callFromHome = true;
    } else {
      this.callFromHome = false;
    }
    if (this.hobbies.length != undefined) {
      this.HobbiesArray = this.hobbies;
      if (this.coreFacade.currentSelectedhobby) {
        let hobbyIndex = _.findIndex(this.hobbies, {
          name: this.coreFacade.currentSelectedhobby['name'],
        });

        this.slider?.nativeElement.swiper.slideTo(hobbyIndex);
      } else {
        this.slider?.nativeElement.swiper.slideTo(0);
      }
    } else {
      this.HobbiesArray = [];
    }
  }
  ngOnChanges() {
    this.HobbiesArray = this.hobbies;
    if (this.activeHobbies && this.hobbies.length != undefined) {
      let index = this.hobbies
        .map(function (e) {
          return e.name;
        })
        .indexOf(this.activeHobbies.name);
      this.slider?.nativeElement.swiper.slideTo(index);
    }
  }
  slideChanged() {
    const index = this.slider?.nativeElement.swiper.activeIndex;
    this.currentActiveHobby.emit(this.hobbies[index]);
  }
}
