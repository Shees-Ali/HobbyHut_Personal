import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { Player2GameComponent } from './player2-game.component';

describe('Player2GameComponent', () => {
  let component: Player2GameComponent;
  let fixture: ComponentFixture<Player2GameComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ Player2GameComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(Player2GameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
