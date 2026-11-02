import { ProfilePageModule } from './../profile/profile.module';
import { ProfilePage } from './../profile/profile.page';
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { HobbyRoomPage } from './hobby-room.page';
import { CreatePostComponent } from '../shared/create-post/create-post.component';

const routes: Routes = [
  {
    path: ':hobbyID',
    component: HobbyRoomPage
  },
  {
    path: ':hobbyID/profile/:userID',
    component: ProfilePage
  },
  {
    path:':hobbyID/create-post',
    component: CreatePostComponent
  },
  {
    path:':hobbyID/edit-post',
    component: CreatePostComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), ProfilePageModule],
  exports: [RouterModule]
})
export class HobbyRoomPageRoutingModule {}
