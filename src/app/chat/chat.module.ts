import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChatPageRoutingModule } from './chat-routing.module';

import { ChatPage } from './chat.page';
import { CapitalizeFirstModule } from '../directives/capitalize-first/capitalize-first.module';

@NgModule({
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule, ChatPageRoutingModule, CapitalizeFirstModule],
  declarations: [ChatPage]
})
export class ChatPageModule {}
