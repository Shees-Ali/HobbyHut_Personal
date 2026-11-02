import { AngularFirestore } from '@angular/fire/compat/firestore';
import { CoreFacade } from './../core/core.facade';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TabsPage } from './tabs.page';

class MockCoreFacade {}

describe('TabsPage', () => {
  let component: TabsPage;
  let fixture: ComponentFixture<TabsPage>;
  let testBedService: MockCoreFacade;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [TabsPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [{provide: CoreFacade, useClass: MockCoreFacade}]
    }).compileComponents();


  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TabsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    testBedService = TestBed.get(CoreFacade);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
