import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PostChatPage } from './post-chat.page';

const routes: Routes = [
  {
    path: '',
    component: PostChatPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PostChatPageRoutingModule {}
