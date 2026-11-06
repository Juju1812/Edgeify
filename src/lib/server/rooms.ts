import "server-only";
import { redis, K } from "./redis";
import { HttpError } from "./http";
import { roomCode, withLock } from "./lock";
import { activeMatchOf, createMatch } from "./matches";

export type Room = { code: string; host: string; createdAt: number; matchId: string | null; guest: string | null };

const ROOM_TTL = 60 * 20;

function parse(raw: unknown): Room | null {
  if (!raw) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as Room;
}

export async function getRoom(code: string): Promise<Room> {
  const r = parse(await redis().get(K.room(code)));
  if (!r) throw new HttpError(404, "no_room", "That room code doesn't exist or has expired.");
  return r;
}

export async function createRoom(host: string): Promise<Room> {
  for (let i = 0; i < 5; i++) {
    const room: Room = { code: roomCode(), host, createdAt: Date.now(), matchId: null, guest: null };
    if (await redis().set(K.room(room.code), JSON.stringify(room), { nx: true, ex: ROOM_TTL })) return room;
  }
  throw new HttpError(503, "busy", "Couldn't create a room, try again.");
}

export async function joinRoom(code: string, guest: string): Promise<Room> {
  return withLock(K.room(code), async () => {
    const room = await getRoom(code);
    if (room.host.toLowerCase() === guest.toLowerCase()) throw new HttpError(400, "own_room", "That's your own room — share the code with a friend.");
    if (room.matchId) {
      if (room.guest?.toLowerCase() === guest.toLowerCase()) return room;
      throw new HttpError(409, "room_full", "Someone already joined that room.");
    }
    if (await activeMatchOf(room.host)) throw new HttpError(409, "host_busy", "The host is in another match.");
    if (await activeMatchOf(guest)) throw new HttpError(409, "you_busy", "Finish your current match first.");
    const m = await createMatch("room", room.host, guest);
    room.matchId = m.id;
    room.guest = guest;
    await redis().set(K.room(code), JSON.stringify(room), { ex: ROOM_TTL });
    return room;
  });
}
