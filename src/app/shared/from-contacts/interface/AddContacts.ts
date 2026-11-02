export interface AddContacts {
    name: string;
    phoneNumber: string;
    isRegistered: boolean;
    isInChats: boolean; // Indicates if the contact is already in chats
    userId?: string; // Optional: User ID if the contact is registered
}