import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from './../shared/shared.module';
import { MessagesPageRoutingModule } from './messages-routing.module';
import { MessagesPage } from './messages.page';

import { Badge } from '@awesome-cordova-plugins/badge/ngx';
import { ChatItemComponent } from './components/chat-item/chat-item.component';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, MessagesPageRoutingModule, SharedModule],
  providers: [Badge],
  declarations: [MessagesPage, ChatItemComponent],
})
export class MessagesPageModule {}
