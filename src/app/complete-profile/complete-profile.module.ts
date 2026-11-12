import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../shared/shared.module';
import { CompleteProfilePage } from './complete-profile.page';

const routes: Routes = [{ path: '', component: CompleteProfilePage }];

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, RouterModule.forChild(routes)],
  declarations: [CompleteProfilePage],
})
export class CompleteProfilePageModule {}
