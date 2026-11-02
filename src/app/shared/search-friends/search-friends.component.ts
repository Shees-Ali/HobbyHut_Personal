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
    this.coreFacade.fsUsersCollection
      .doc(user.uid)
      .get()
      .subscribe(async (data: any) => {
        if (
          data.data().blockedUsers &&
          data.data().blockedUsers.includes(this.coreFacade.user.uid)
        ) {
          this.presentToast('You are blocked by ' + data.data().displayName);
          return;
        }

        let otherUserData = data.data();
        let currentUserData = this.coreFacade.user as any;

        if (typeof otherUserData.friend == 'undefined' || !otherUserData.friend) {
          otherUserData.friend = [];
        }
        let otherUserFriends = otherUserData.friend ? otherUserData.friend : [];
        if (otherUserFriends.indexOf(currentUserData.uid) == -1) {
          otherUserFriends.push(currentUserData.uid);
        }

        if (typeof currentUserData.friend == 'undefined' || !currentUserData.friend) {
          currentUserData.friend = [];
        }
        let currentUserFriends = currentUserData.friend ? currentUserData.friend : [];
        if (currentUserFriends.indexOf(otherUserData.uid) == -1) {
          currentUserFriends.push(otherUserData.uid);
        }

        await this.coreFacade.fsUsersCollection.doc(otherUserData.uid).update({
          friend: otherUserFriends,
        });

        await this.coreFacade.fsUsersCollection.doc(currentUserData.uid).update({
          friend: currentUserFriends,
        });

        await this.coreFacade.initiateChat(otherUserData, false);

        user.isInChats = true;
        this.presentToast('Added as friend successfully 🙂');
      });
  }

  private async presentToast(msg: string): Promise<void> {
    const toast = await this.toastController.create({
      message: msg,
      duration: 2000,
    });
    toast.present().catch();
  }
}
