import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { HobbyRoomPage } from './hobby-room.page';

describe('HobbyRoomPage', () => {
  let component: HobbyRoomPage;
  let fixture: ComponentFixture<HobbyRoomPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ HobbyRoomPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(HobbyRoomPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
