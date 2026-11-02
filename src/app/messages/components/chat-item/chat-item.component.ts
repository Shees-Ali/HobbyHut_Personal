import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Chat } from '../../interfaces/Chat';
import { ActionSheetController } from '@ionic/angular';

@Component({
  selector: 'app-chat-item',
  templateUrl: './chat-item.component.html',
  styleUrls: ['./chat-item.component.scss'],
})
export class ChatItemComponent {
  @Input() message!: Chat;
  @Input() index!: number;
  @Input() isTopFive!: boolean;
  @Input() currentUserId!: string;

  @Output() avatarClick = new EventEmitter<Chat>();
  @Output() messageClick = new EventEmitter<Chat>();
  @Output() blockUser = new EventEmitter<Chat>();
  @Output() reportUser = new EventEmitter<Chat>();
  @Output() removeTopFive = new EventEmitter<Chat>();
  @Output() addTopFive = new EventEmitter<Chat>();
  @Output() unmatch = new EventEmitter<Chat>();
  constructor(private actionSheetCtrl: ActionSheetController) {}

  getAdminImage(message: Chat): string {
    // Implement logic to return the appropriate image URL
    return message?.participant?.['image'] || '../../assets/images/default-avatar.png';
  }

  onAvatarClick(message: Chat): void {
    this.avatarClick.emit(message);
  }

  onOpenMessage(message: Chat): void {
    this.messageClick.emit(message);
  }

  handleBlockUser(message: Chat): void {
    this.blockUser.emit(message);
  }

  handleReportUser(message: Chat): void {
    this.reportUser.emit(message);
  }

  handleUnmatch(message: Chat): void {
    this.unmatch.emit(message);
  }

  handleRemoveFromTopFive(): void {
    this.removeTopFive.emit(this.message);
  }

  handleAddToTopFive(): void {
    this.addTopFive.emit(this.message);
  }

  async presentActionSheet(message: Chat, isadd = false): Promise<void> {
    console.log('Presenting action sheet for message:', message);
    let buttons = [
      {
        text: 'Cancel',
        role: 'cancel',
        data: {
          action: 'cancel',
        },
      },
    ];
    // Check if the chat is in the top five then show the remove option
    if (this.isTopFive) {
      buttons.unshift({
        text: 'Remove from Top 5',
        role: 'destructive',
        data: {
          action: 'remove',
        },
      });
    }

    if (isadd) {
      buttons.unshift({
        text: 'Add to Top 5',
        role: 'add',
        data: {
          action: 'add',
        },
      });
    }
    // Implement action sheet logic here
    const actionSheet = await this.actionSheetCtrl.create({
      buttons: buttons,
    });

    await actionSheet.present();

    const result = await actionSheet.onDidDismiss();
    const action = result.data?.action;
    if (action === 'remove') {
      this.handleRemoveFromTopFive();
    } else if (action === 'add') {
      this.handleAddToTopFive();
    }
  }
}
