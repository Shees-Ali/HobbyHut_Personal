import { Component, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { CoreFacade } from 'src/app/core/core.facade';
import { SearchUser } from './models/SearchUser';

@Component({
  selector: 'app-search-friends',
  templateUrl: './search-friends.component.html',
  styleUrls: ['./search-friends.component.scss'],
})
export class SearchFriendsComponent implements OnInit {
  searchQuery: string = '';
  searchResults: SearchUser[] = [];
  isSearching: boolean = false;

  constructor(
    private modalCtrl: ModalController,
    private coreFacade: CoreFacade,
    private toastController: ToastController,
  ) {}

  ngOnInit() {}

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async onSearchChange(event: any) {
    this.searchQuery = event.detail.value;

    if (!this.searchQuery || this.searchQuery.trim().length === 0) {
      this.searchResults = [];
      this.isSearching = false;
      return;
    }

    this.isSearching = true;
    try {
      // Search Firestore for the users
      this.searchResults = await this.coreFacade.searchUsersByUsername(this.searchQuery.trim());

      // Filter out the current user from the search results
      this.searchResults = this.searchResults.filter(
        (user) => user.uid !== this.coreFacade.user?.uid,
      );

      console.log('search Results', this.searchResults);
    } catch (error) {
      console.error('Error searching users:', error);
      this.searchResults = [];
    }
    this.isSearching = false;
  }

  async addAsFriend(user: SearchUser) {
    if (user.isInChats) {
      this.presentToast('You are already friends!');
      return;
    }

    this.coreFacade.messageUserId = null;
    const added = await this.coreFacade.feedback.run(() => this.coreFacade.addFriend(user.uid), {
      success: 'Added as friend successfully 🙂',
      failure: 'Could not add this friend.',
    });
    if (added) {
      user.isInChats = true;
    }
  }

  private async presentToast(msg: string): Promise<void> {
    const toast = await this.toastController.create({
      message: msg,
      duration: 2000,
    });
    toast.present().catch();
  }
}
