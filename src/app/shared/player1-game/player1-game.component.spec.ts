import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { Player1GameComponent } from './player1-game.component';

describe('Player1GameComponent', () => {
  let component: Player1GameComponent;
  let fixture: ComponentFixture<Player1GameComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ Player1GameComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(Player1GameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
