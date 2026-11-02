import { SharedModule } from './../shared/shared.module';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { HobbyRoomPageRoutingModule } from './hobby-room-routing.module';

import { HobbyRoomPage } from './hobby-room.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    HobbyRoomPageRoutingModule
  ],
  declarations: [HobbyRoomPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HobbyRoomPageModule {}
