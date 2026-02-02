import { StenoMessage, AppSettings } from '../types';

type BroadcastEvent = 
  | { type: 'NEW_MESSAGE'; payload: StenoMessage }
  | { type: 'UPDATE_MESSAGE'; payload: StenoMessage }
  | { type: 'LIVE_INPUT'; payload: string } 
  | { type: 'SYNC_SETTINGS'; payload: AppSettings }
  | { type: 'CLEAR_SCREEN'; payload: null };

class BroadcastService {
  private channel: BroadcastChannel | null = null;
  private listeners: ((event: BroadcastEvent) => void)[] = [];
  private currentRoomId: string | null = null;

  constructor() {
    // Channel is initialized via connect()
  }

  public connect(roomId: string) {
    if (this.currentRoomId === roomId && this.channel) {
      return; // Already connected to this room
    }

    // Close existing channel if switching rooms
    if (this.channel) {
      this.channel.close();
    }

    this.currentRoomId = roomId;
    this.channel = new BroadcastChannel(`livesteno_channel_${roomId}`);
    
    this.channel.onmessage = (ev) => {
      const data = ev.data as BroadcastEvent;
      this.notifyListeners(data);
    };
    
    console.log(`Connected to broadcast channel: livesteno_channel_${roomId}`);
  }

  public disconnect() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
      this.currentRoomId = null;
    }
  }

  public subscribe(callback: (event: BroadcastEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(event: BroadcastEvent) {
    this.listeners.forEach(listener => listener(event));
  }

  private post(event: BroadcastEvent) {
    if (this.channel) {
      this.channel.postMessage(event);
    }
    // Also notify local listeners (for the sender's UI update)
    this.notifyListeners(event);
  }

  public sendNewMessage(message: StenoMessage) {
    this.post({ type: 'NEW_MESSAGE', payload: message });
  }

  public sendUpdateMessage(message: StenoMessage) {
    this.post({ type: 'UPDATE_MESSAGE', payload: message });
  }

  public sendLiveInput(text: string) {
    this.post({ type: 'LIVE_INPUT', payload: text });
  }

  public syncSettings(settings: AppSettings) {
    this.post({ type: 'SYNC_SETTINGS', payload: settings });
  }

  public clearScreen() {
    this.post({ type: 'CLEAR_SCREEN', payload: null });
  }
}

export const broadcastService = new BroadcastService();