import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { PostChatPage } from './post-chat.page';

describe('PostChatPage', () => {
  let component: PostChatPage;
  let fixture: ComponentFixture<PostChatPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PostChatPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(PostChatPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
