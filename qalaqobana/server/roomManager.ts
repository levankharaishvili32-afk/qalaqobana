import crypto from 'node:crypto';
import { LIMITS, TIMING } from '../shared/config/gameDefaults.js';
import { cleanDisplay } from '../shared/normalize.js';
import { Room, type Emit } from './room.js';

/** ადვილად წასაკითხი სიმბოლოები (0/O, 1/I/L-ის გარეშე) */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  return code;
}

/** ყველა ოთახი ინახება მეხსიერებაში; ცარიელი ოთახი 30 წუთში იშლება */
export class RoomManager {
  private rooms = new Map<string, Room>();
  private sweeper: NodeJS.Timeout;

  constructor(
    private emit: Emit,
    private scale = 1,
  ) {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  get(code: unknown): Room | undefined {
    return typeof code === 'string' ? this.rooms.get(code.trim().toUpperCase()) : undefined;
  }

  create(rawName: string, password?: string): Room {
    let code = generateCode();
    while (this.rooms.has(code)) code = generateCode();
    const name = cleanDisplay(rawName).slice(0, LIMITS.roomNameMax) || 'ქალაქობანა';
    const pass = (password ?? '').slice(0, LIMITS.passwordMax);
    const room = new Room(code, name, pass ? Room.hashPassword(code, pass) : null, this.emit, this.scale);
    this.rooms.set(code, room);
    return room;
  }

  delete(code: string) {
    this.rooms.get(code)?.dispose();
    this.rooms.delete(code);
  }

  sweep(now = Date.now()) {
    for (const [code, room] of this.rooms) {
      const empty = room.players.length === 0 || room.online().length === 0;
      if (empty && room.emptySince !== null && now - room.emptySince >= TIMING.emptyRoomMs) {
        this.delete(code);
      }
    }
  }

  get size() {
    return this.rooms.size;
  }

  close() {
    clearInterval(this.sweeper);
    for (const code of [...this.rooms.keys()]) this.delete(code);
  }
}
