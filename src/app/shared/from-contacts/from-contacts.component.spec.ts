import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FromContactsComponent } from './from-contacts.component';

describe('FromContactsComponent', () => {
  let component: FromContactsComponent;
  let fixture: ComponentFixture<FromContactsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FromContactsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FromContactsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
