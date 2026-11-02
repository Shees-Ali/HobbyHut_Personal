import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditHobbiesComponent } from './edit-hobbies.component';

describe('EditHobbiesComponent', () => {
  let component: EditHobbiesComponent;
  let fixture: ComponentFixture<EditHobbiesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EditHobbiesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EditHobbiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
