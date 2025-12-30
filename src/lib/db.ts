import Dexie, { type Table } from 'dexie';

export interface Message {
  id: string;
  roomId: string; // New field to separate rooms
  content: string;
  sender: 'me' | 'peer';
  timestamp: number;
  status: 'sent' | 'read';
}

export interface Profile {
  id: string; 
  name: string;
}

class ChatDB extends Dexie {
  messages!: Table<Message>;
  profiles!: Table<Profile>;

  constructor() {
    super('SuperP2P_DB');
    this.version(2).stores({ // Bumped version to 2
      messages: 'id, roomId, timestamp', // Added roomId index
      profiles: 'id'
    });
  }
}

export const db = new ChatDB();

export const cleanupOldMessages = async () => {
  const twentyHoursAgo = Date.now() - (20 * 60 * 60 * 1000);
  await db.messages.where('timestamp').below(twentyHoursAgo).delete();
};