import { RoomMetadata } from '../types';

const STORAGE_KEY_ROOMS = 'livesteno_rooms_registry';

class RoomRegistry {
  public getRooms(): RoomMetadata[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ROOMS);
      if (!stored) return [];
      const rooms: RoomMetadata[] = JSON.parse(stored);
      // Sort by last active desc
      return rooms.sort((a, b) => b.lastActive - a.lastActive);
    } catch (e) {
      console.error("Failed to parse room registry", e);
      return [];
    }
  }

  public getRoom(id: string): RoomMetadata | undefined {
    return this.getRooms().find(r => r.id === id);
  }

  public registerRoom(id: string, name: string) {
    const rooms = this.getRooms();
    const now = Date.now();
    const existingIndex = rooms.findIndex(r => r.id === id);

    if (existingIndex >= 0) {
      // Update existing
      rooms[existingIndex].lastActive = now;
      // Update name if provided and different
      if (name && rooms[existingIndex].name !== name) {
        rooms[existingIndex].name = name;
      }
    } else {
      // Create new
      rooms.push({
        id,
        name: name || `Room ${id}`,
        createdAt: now,
        lastActive: now
      });
    }

    this.saveRooms(rooms);
  }

  public touchRoom(id: string) {
    const rooms = this.getRooms();
    const room = rooms.find(r => r.id === id);
    if (room) {
      room.lastActive = Date.now();
      this.saveRooms(rooms);
    }
  }

  public deleteRoom(id: string) {
    const rooms = this.getRooms().filter(r => r.id !== id);
    this.saveRooms(rooms);
  }

  private saveRooms(rooms: RoomMetadata[]) {
    localStorage.setItem(STORAGE_KEY_ROOMS, JSON.stringify(rooms));
  }
}

export const roomRegistry = new RoomRegistry();