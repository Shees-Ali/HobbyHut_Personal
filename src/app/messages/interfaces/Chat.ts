// Update your Chat interface with these properties
export interface Chat {
    chatID: string;
    messages: Message[];
    meta: ChatMeta;
    participant: Participant;
    participants: Participant[];
    chatUnreadMessage?: boolean;
}


export interface Message {
    timestamp: number;
    text: string;
    senderID: string;
}

export interface ChatMeta {
    block: string;
    isMessageRequest: boolean;
    lastMessage: string;
    lastSenderID: string;
    timestamp: number;
    // Can be used to integrate the top five list with the chat list
    isInTopFive: { [userId: string]: boolean }; // Maps user IDs to whether this chat is in their top five
    topFiveCount: number; // Number of chats in the top five list
    topFivePosition: { [userId: string]: number }; // Maps user IDs to the position of this chat in their top five list
}

export interface Participant {
    displayName: string;
    isActive?: boolean;
    isLast?: boolean;
    isThreadOpen: boolean;
    photoUrl: string;
    timestamp: number;
    uid: string;
    unreadCount: number;
}