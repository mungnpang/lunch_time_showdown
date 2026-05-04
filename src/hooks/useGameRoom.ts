import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ref, set, get, update, remove, onValue,
  onDisconnect, type Unsubscribe,
} from 'firebase/database';
import { db } from '../lib/firebase';
import {
  generateRoomCode, getOrCreatePlayerId,
  type RoomData, type PlayerEntry,
} from '../lib/roomUtils';

// ── 훅 반환 타입 ───────────────────────────────────────────────────────────

export interface OrderedPlayer {
  id: string;
  name: string;
  isMe: boolean;
  isCurrent: boolean;
  isLoser: boolean;
}

export interface UseGameRoomReturn {
  roomData:       RoomData | null;
  isLoading:      boolean;
  error:          string | null;
  myPlayerId:     string;
  isHost:         boolean;
  isMyTurn:       boolean;
  orderedPlayers: OrderedPlayer[];
  loserName:      string | null;
  createRoom:        (nickname: string) => Promise<string>;
  joinRoom:          (roomCode: string, nickname: string) => Promise<{ success: boolean; error?: string }>;
  leaveRoom:         (roomCode: string) => Promise<void>;
  startGame:         () => Promise<void>;
  passBomb:          () => Promise<void>;
  resetToLobby:      () => Promise<void>;
  updateTimeSettings:(minTime: number, maxTime: number) => Promise<void>;
}

// ── 훅 ────────────────────────────────────────────────────────────────────

export function useGameRoom(roomCode: string | null): UseGameRoomReturn {
  const [roomData, setRoomData]   = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(roomCode !== null);
  const [error, setError]         = useState<string | null>(null);

  const timerRef    = useRef<number | null>(null);
  const roomDataRef = useRef<RoomData | null>(null);

  const myPlayerId = getOrCreatePlayerId();

  // ── 방 구독 ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomCode) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const roomRef = ref(db, `rooms/${roomCode}`);
    let unsub: Unsubscribe;

    unsub = onValue(
      roomRef,
      snapshot => {
        const data = snapshot.val() as RoomData | null;
        roomDataRef.current = data;
        setRoomData(data);
        setIsLoading(false);
      },
      err => {
        setError(err.message);
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, [roomCode]);

  // ── 폭탄 타이머 ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (
      !roomCode ||
      !roomData ||
      roomData.gameState !== 'playing' ||
      !roomData.bombExplodesAt
    ) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      return;
    }

    const explode = async () => {
      const current = roomDataRef.current;
      if (!current || current.gameState !== 'playing') return;
      await update(ref(db, `rooms/${roomCode}`), {
        gameState:    'exploded',
        loserPlayerId: current.currentHolderPlayerId,
      });
      if (window.navigator?.vibrate) window.navigator.vibrate([500, 200, 500]);
    };

    const delay = roomData.bombExplodesAt - Date.now();
    if (delay <= 0) { explode(); return; }

    timerRef.current = window.setTimeout(explode, delay);
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [roomCode, roomData?.bombExplodesAt, roomData?.gameState]);

  // ── 파생 상태 ────────────────────────────────────────────────────────────

  const isHost   = roomData?.hostId === myPlayerId;
  const isMyTurn = roomData?.currentHolderPlayerId === myPlayerId && roomData?.gameState === 'playing';

  const orderedPlayers: OrderedPlayer[] = roomData?.playerOrder?.length
    ? roomData.playerOrder.map(id => ({
        id,
        name:      roomData.players[id]?.name ?? '?',
        isMe:      id === myPlayerId,
        isCurrent: id === roomData.currentHolderPlayerId,
        isLoser:   id === roomData.loserPlayerId,
      }))
    : Object.entries(roomData?.players ?? {})
        .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
        .map(([id, p]) => ({
          id,
          name:      p.name,
          isMe:      id === myPlayerId,
          isCurrent: false,
          isLoser:   false,
        }));

  const loserName = roomData?.loserPlayerId
    ? (roomData.players[roomData.loserPlayerId]?.name ?? null)
    : null;

  // ── 액션 ─────────────────────────────────────────────────────────────────

  const createRoom = useCallback(async (nickname: string): Promise<string> => {
    const code    = generateRoomCode();
    const roomRef = ref(db, `rooms/${code}`);
    const now     = Date.now();

    const initialRoom: RoomData = {
      hostId:                myPlayerId,
      gameState:             'lobby',
      minTime:               10,
      maxTime:               30,
      currentHolderPlayerId: '',
      passCount:             0,
      loserPlayerId:         null,
      bombExplodesAt:        0,
      playerOrder:           [],
      players: { [myPlayerId]: { name: nickname, joinedAt: now } },
    };

    await set(roomRef, initialRoom);
    onDisconnect(roomRef).remove();
    return code;
  }, [myPlayerId]);

  const joinRoom = useCallback(async (
    targetCode: string,
    nickname:   string,
  ): Promise<{ success: boolean; error?: string }> => {
    const roomRef  = ref(db, `rooms/${targetCode}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists())
      return { success: false, error: '존재하지 않는 방입니다.' };

    const data = snapshot.val() as RoomData;
    if (data.gameState !== 'lobby')
      return { success: false, error: '이미 게임이 진행 중입니다.' };

    const playerCount = Object.keys(data.players ?? {}).length;
    if (playerCount >= 8)
      return { success: false, error: '방이 가득 찼습니다. (최대 8명)' };

    const playerRef  = ref(db, `rooms/${targetCode}/players/${myPlayerId}`);
    const playerData: PlayerEntry = { name: nickname, joinedAt: Date.now() };
    await set(playerRef, playerData);
    onDisconnect(playerRef).remove();

    return { success: true };
  }, [myPlayerId]);

  const leaveRoom = useCallback(async (currentRoomCode: string): Promise<void> => {
    if (isHost) {
      await remove(ref(db, `rooms/${currentRoomCode}`));
    } else {
      await remove(ref(db, `rooms/${currentRoomCode}/players/${myPlayerId}`));
    }
  }, [isHost, myPlayerId]);

  const startGame = useCallback(async (): Promise<void> => {
    if (!roomCode || !roomData || !isHost) return;
    const { minTime, maxTime, players } = roomData;

    const playerOrder = Object.entries(players)
      .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
      .map(([id]) => id);

    const randomMs       = Math.floor(Math.random() * (maxTime - minTime + 1) * 1000) + minTime * 1000;
    const bombExplodesAt = Date.now() + randomMs;

    await update(ref(db, `rooms/${roomCode}`), {
      gameState:             'playing',
      playerOrder,
      currentHolderPlayerId: playerOrder[0],
      passCount:             0,
      loserPlayerId:         null,
      bombExplodesAt,
    });
  }, [roomCode, roomData, isHost]);

  const passBomb = useCallback(async (): Promise<void> => {
    if (!roomCode || !roomData || roomData.gameState !== 'playing') return;
    const { playerOrder, currentHolderPlayerId, passCount } = roomData;
    const currentIdx = playerOrder.indexOf(currentHolderPlayerId);
    const nextIdx    = (currentIdx + 1) % playerOrder.length;

    await update(ref(db, `rooms/${roomCode}`), {
      currentHolderPlayerId: playerOrder[nextIdx],
      passCount:             passCount + 1,
    });
    if (window.navigator?.vibrate) window.navigator.vibrate(30);
  }, [roomCode, roomData]);

  const resetToLobby = useCallback(async (): Promise<void> => {
    if (!roomCode || !isHost) return;
    await update(ref(db, `rooms/${roomCode}`), {
      gameState:             'lobby',
      playerOrder:           [],
      currentHolderPlayerId: '',
      passCount:             0,
      loserPlayerId:         null,
      bombExplodesAt:        0,
    });
  }, [roomCode, isHost]);

  const updateTimeSettings = useCallback(async (minTime: number, maxTime: number): Promise<void> => {
    if (!roomCode || !isHost) return;
    await update(ref(db, `rooms/${roomCode}`), { minTime, maxTime });
  }, [roomCode, isHost]);

  return {
    roomData, isLoading, error,
    myPlayerId, isHost, isMyTurn,
    orderedPlayers, loserName,
    createRoom, joinRoom, leaveRoom,
    startGame, passBomb, resetToLobby, updateTimeSettings,
  };
}
