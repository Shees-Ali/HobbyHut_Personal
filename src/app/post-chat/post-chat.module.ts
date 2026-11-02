import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PostChatPageRoutingModule } from './post-chat-routing.module';

import { PostChatPage } from './post-chat.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PostChatPageRoutingModule,
    ReactiveFormsModule,
  ],
  declarations: [PostChatPage]
})
export class PostChatPageModule {}
