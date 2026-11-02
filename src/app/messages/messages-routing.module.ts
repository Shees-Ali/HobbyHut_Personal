import { ProfilePageModule } from './../profile/profile.module';
import { ProfilePage } from './../profile/profile.page';
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MessagesPage } from './messages.page';
const routes: Routes = [
  {
    path: '',
    component: MessagesPage
  },
  {
    path: ':userID',
    loadChildren: () => import('../profile/profile.module').then(m => m.ProfilePageModule)
    // component: ProfilePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MessagesPageRoutingModule {}
