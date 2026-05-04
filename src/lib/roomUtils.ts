// ── 타입 ─────────────────────────────────────────────────────────────────

export interface PlayerEntry {
  name: string;
  joinedAt: number;
}

export interface RoomData {
  hostId: string;
  gameState: 'lobby' | 'playing' | 'exploded';
  minTime: number;
  maxTime: number;
  currentHolderPlayerId: string;
  passCount: number;
  loserPlayerId: string | null;
  bombExplodesAt: number;
  playerOrder: string[];
  players: Record<string, PlayerEntry>;
}

// ── 방 코드 생성 ──────────────────────────────────────────────────────────

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  return Array.from(
    { length: 4 },
    () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  ).join('');
}

// ── 플레이어 ID (sessionStorage 기반) ────────────────────────────────────

const PLAYER_ID_KEY = 'bomb_player_id';

export function getOrCreatePlayerId(): string {
  let id = sessionStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}
