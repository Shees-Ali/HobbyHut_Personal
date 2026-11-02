import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { HomeMainPage } from './home-main.page';

const routes: Routes = [
  {
    path: '',
    component: HomeMainPage,
  },
  {
    path: 'home',
    loadChildren: () => import('../home/home.module').then((m) => m.HomePageModule),
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HomeMainPageRoutingModule {}
