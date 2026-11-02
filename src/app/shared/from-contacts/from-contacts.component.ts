import { Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ModalController, LoadingController, ToastController } from '@ionic/angular';
import { CoreFacade } from 'src/app/core/core.facade';
import { Contacts } from '@capacitor-community/contacts';
import { AddContacts } from './interface/AddContacts';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { SmsManager } from '@byteowls/capacitor-sms';

@Component({
  selector: 'app-from-contacts',
  templateUrl: './from-contacts.component.html',
  styleUrls: ['./from-contacts.component.scss'],
})
export class FromContactsComponent implements OnInit {
  contacts: AddContacts[] = [];
  registeredContacts: AddContacts[] = [];
  unregisteredContacts: AddContacts[] = [];

  // Multi-select properties
  isMultiSelectMode: boolean = false;
  selectedContacts: AddContacts[] = [];

  processedContacts: number = 0; // Counter for processed contacts
  totalContacts: number = 0; // Total number of contacts to process
  processingContacts: boolean = true; // Flag to indicate if contacts are being processed
  constructor(
    private modalCtrl: ModalController,
    private coreFacade: CoreFacade,
    private formBuilder: FormBuilder,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private socialSharing: SocialSharing,
  ) {}

  async ngOnInit() {
    try {
      await this.initializeContacts();
      this.filterContacts();
    } catch (error) {
      console.error('Error initializing contacts:', error);
      // Handle the error appropriately, e.g., show an alert or log it
      this.presentToast('Error initializing contacts: ' + error);
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  getAllContacts() {
    const projection = {
      // Specify which fields should be retrieved.
      name: true,
      phones: true,
      postalAddresses: true,
    };

    return Contacts.getContacts({
      projection,
    });
  }

  /**
   * Gets the contacts from the device and checks if any of them are already registered in the app.
   * If they are then we show add button to add them as friends.
   * If they are not registered, we show a button to invite them.
   */
  async initializeContacts() {
    return new Promise(async (resolve, reject) => {
      try {
        this.processingContacts = true;
        this.processedContacts = 0; // Reset processed contacts counter
        this.totalContacts = 0; // Reset total contacts counter
        this.contacts = []; // Clear existing contacts

        // Get all contacts from the device
        const contacts = await this.getAllContacts();

        // Filter contacts that have name and phones
        const validContacts = contacts.contacts.filter(
          (contact) => contact?.name?.display && contact.phones && contact.phones.length > 0,
        );

        this.totalContacts = validContacts.length;

        if (this.totalContacts === 0) {
          this.processingContacts = false; // Move this here
          resolve(this.contacts);
          return;
        }

        // Process contacts in batches to avoid overwhelming the system
        const batchSize = 50; // Process 50 contacts at a time
        const processBatch = async (batch: any[]) => {
          const batchPromises = batch.map((contact) => this.processContact(contact));
          await Promise.all(batchPromises);
        };

        // Process all contacts in batches
        for (let i = 0; i < validContacts.length; i += batchSize) {
          const batch = validContacts.slice(i, i + batchSize);
          await processBatch(batch);
        }

        this.processingContacts = false; // Move this here after all processing is done
        resolve(this.contacts);
      } catch (error) {
        console.error('Error initializing contacts:', error);
        this.presentToast('Error initializing contacts: ' + error);
        this.processingContacts = false; // Set to false on error
        reject(error);
      }
    });
  }

  /**
   * Filters the contacts to show only those that are registered and not already in chats.
   */
  filterContacts() {
    // This function can be used to filter contacts based on certain criteria
    // Sort contacts alphabetically by name
    this.contacts.sort((a, b) => a.name?.localeCompare(b.name) || 0);
    // Remove duplicates based on phone number and filter out contacts with null/undefined values
    this.contacts = this.contacts.filter(
      (contact, index, self) =>
        contact?.name &&
        contact?.phoneNumber &&
        index === self.findIndex((c) => c?.phoneNumber === contact.phoneNumber),
    );
    // Remove contacts that are already in chats
    this.contacts = this.contacts.filter((contact) => contact && !contact.isInChats);

    // Separate registered and unregistered contacts
    this.registeredContacts = this.contacts.filter((contact) => contact?.isRegistered);
    this.unregisteredContacts = this.contacts.filter((contact) => contact && !contact.isRegistered);
  }
  /**
   * Adds a contact to the user's friend list.
   * @param contact - The contact to be added.
   * This function is a placeholder and should be implemented to handle the logic of adding a contact
   */
  addContact(contact: AddContacts) {
    this.coreFacade.messageUserId = null;
    this.coreFacade.fsUsersCollection
      .doc(contact.userId)
      .get()
      .subscribe(async (data: any) => {
        if (
          data.data().blockedUsers &&
          data.data().blockedUsers.includes(this.coreFacade.user.uid)
        ) {
          this.presentToast('You are blocked by ' + data.data().displayName);
          return;
        }

        // Get both users' data
        let otherUserData = data.data();
        let currentUserData = this.coreFacade.user as any;

        // Add current user to other user's friend list
        if (typeof otherUserData.friend == 'undefined' || !otherUserData.friend) {
          otherUserData.friend = [];
        }
        let otherUserFriends = otherUserData.friend ? otherUserData.friend : [];
        if (otherUserFriends.indexOf(currentUserData.uid) == -1) {
          otherUserFriends.push(currentUserData.uid);
        }

        // Add other user to current user's friend list
        if (typeof currentUserData.friend == 'undefined' || !currentUserData.friend) {
          currentUserData.friend = [];
        }
        let currentUserFriends = currentUserData.friend ? currentUserData.friend : [];
        if (currentUserFriends.indexOf(otherUserData.uid) == -1) {
          currentUserFriends.push(otherUserData.uid);
        }

        // Update both users' friend lists
        await this.coreFacade.fsUsersCollection.doc(otherUserData.uid).update({
          friend: otherUserFriends,
        });

        await this.coreFacade.fsUsersCollection.doc(currentUserData.uid).update({
          friend: currentUserFriends,
        });

        // Initiate the chat (this will handle adding to chats array)
        await this.coreFacade.initiateChat(otherUserData, false);

        contact.isInChats = true; // Update the contact's status to indicate they are now in chats
        this.filterContacts(); // Re-filter contacts to update the view
        this.presentToast('Contact added as friend successfully 🙂');
      });
  }

  /**
   * Invites a contact to join the app.
   * @param contact - The contact to be invited.
   * This function is a placeholder and should be implemented to handle the logic of inviting a contact
   */
  inviteContact(contact: AddContacts) {
    // This could involve sending an SMS, email, or using a sharing mechanism
    const message = `Hey ${
      contact.name.split(' ')[0]
    }! \nYou gotta download this new app HangTime so we can hang soon! 🤙🏼\nhttps://apps.apple.com/in/app/hangtime-hobby-meetup/id1544245073`;

    this.sendSms([contact.phoneNumber], message);
  }

  private async presentToast(Msg: string): Promise<void> {
    const toast = await this.toastController.create({
      message: Msg,
      duration: 2000,
    });
    toast.present().catch();
  }

  async refreshContacts() {
    await this.initializeContacts();
    this.filterContacts();
    this.presentToast('Contacts refreshed successfully!'); // Notify the user that contacts have been refreshed
  }

  /**
   * Process a single contact
   */
  private processContact(contact: any): Promise<void> {
    return new Promise((resolve) => {
      // Ensure the contact has a name and at least one phone number
      if (
        !contact ||
        !contact.name ||
        !contact.name.display ||
        !contact.phones ||
        contact.phones.length === 0
      ) {
        this.processedContacts++;
        resolve();
        return;
      }

      const phoneNumbers = contact.phones
        .map((phone: any) => phone?.number)
        .filter((num: any) => num != null);
      if (phoneNumbers.length === 0) {
        this.processedContacts++;
        resolve();
        return;
      }

      // Check if the contact is registered in the app
      this.coreFacade.checkIfContactIsRegistered(phoneNumbers).subscribe((userId: string) => {
        const isRegistered = userId !== null && userId !== undefined;

        // Create contact object with common properties
        const contactInfo: AddContacts = {
          name: contact.name.display,
          phoneNumber: phoneNumbers[0], // Assuming the first phone number is the primary one
          isRegistered: isRegistered,
          isInChats: false, // Default value, will be updated if the contact is registered
          userId: userId || '', // Set userId if available
        };

        // Need to check if the contact is also in the user's chats
        if (isRegistered) {
          // If the contact is registered, we need to check if they are already in the user's chats
          this.coreFacade.isContactInUserChats(userId).subscribe((isInChats) => {
            contactInfo.isInChats = isInChats;
            // Add the contact to the contacts array
            this.contacts.push(contactInfo);
            this.processedContacts++;
            resolve();
          });
        } else {
          // Add the contact to the contacts array
          this.contacts.push(contactInfo);
          this.processedContacts++;
          resolve();
        }
      });
    });
  }

  /**
   * Toggle multi-select mode for inviting multiple contacts
   */
  toggleMultiSelectMode() {
    this.isMultiSelectMode = !this.isMultiSelectMode;
    if (!this.isMultiSelectMode) {
      this.selectedContacts = []; // Clear selections when exiting multi-select mode
    }
  }

  /**
   * Toggle contact selection in multi-select mode
   */
  toggleContactSelection(contact: AddContacts) {
    const index = this.selectedContacts.findIndex((c) => c.phoneNumber === contact.phoneNumber);
    if (index > -1) {
      this.selectedContacts.splice(index, 1); // Remove if already selected
    } else {
      this.selectedContacts.push(contact); // Add if not selected
    }
  }

  /**
   * Check if a contact is selected
   */
  isContactSelected(contact: AddContacts): boolean {
    return this.selectedContacts.some((c) => c.phoneNumber === contact.phoneNumber);
  }

  /**
   * Send invites to all selected contacts
   */
  async sendMultipleInvites() {
    if (this.selectedContacts.length === 0) {
      this.presentToast('Please select contacts to invite');
      return;
    }

    try {
      const message = `Hey! \nYou gotta download this new app HangTime so we can hang soon! 🤙🏼\nhttps://apps.apple.com/in/app/hangtime-hobby-meetup/id1544245073`;

      // put the phone numbers in an array
      const phoneNumbers = this.selectedContacts.map((contact) => contact.phoneNumber);

      await this.sendSms(phoneNumbers, message);

      this.presentToast(`Invites sent to ${this.selectedContacts.length} contacts!`);
      this.selectedContacts = []; // Clear selections
      this.isMultiSelectMode = false; // Exit multi-select mode
    } catch (error) {
      console.error('Error sending multiple invites:', error);
      this.presentToast('Error sending invites. Please try again.');
    }
  }

  async sendSms(number: string[], message: string) {
    try {
      await SmsManager.send({
        numbers: number,
        text: message,
      });
      console.log('SMS interface opened');
    } catch (e) {
      console.error('Error:', e);
    }
  }
}
