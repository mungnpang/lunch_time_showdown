import { useState, useEffect, useCallback } from 'react';
import { ref, set, get, update, remove, onValue, onDisconnect } from 'firebase/database';
import { db } from '../lib/firebase';
import { generateRoomCode, getOrCreatePlayerId, type PlayerEntry } from '../lib/roomUtils';

export interface DrawingCard {
  isHit: boolean;
  isFlipped: boolean;
  flippedBy: string | null;
}

export interface DrawingRoomData {
  hostId: string;
  gameState: 'lobby' | 'playing';
  totalCount: number;
  hitCount: number;
  hitMessage: string;
  missMessage: string;
  turnOrder: string[];
  currentTurnIndex: number;
  cards: DrawingCard[] | Record<string, DrawingCard>;
  players: Record<string, PlayerEntry>;
  playerOrder: string[];
}

export interface UseDrawingRoomReturn {
  roomData: DrawingRoomData | null;
  isLoading: boolean;
  myPlayerId: string;
  isHost: boolean;
  cards: DrawingCard[];
  orderedPlayers: Array<{ id: string; name: string; isMe: boolean }>;
  currentPlayerId: string | null;
  isMyTurn: boolean;
  allFlipped: boolean;
  createRoom: (nickname: string) => Promise<string>;
  joinRoom: (code: string, nickname: string) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: (code: string) => Promise<void>;
  updateSettings: (totalCount: number, hitCount: number, hitMessage: string, missMessage: string) => Promise<void>;
  startGame: () => Promise<void>;
  flipCard: (cardIndex: number) => Promise<void>;
  resetToLobby: () => Promise<void>;
}

function normalizeCards(raw: DrawingRoomData['cards'] | null | undefined): DrawingCard[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.keys(raw)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => (raw as Record<string, DrawingCard>)[k]);
}

export function useDrawingRoom(roomCode: string | null): UseDrawingRoomReturn {
  const [roomData, setRoomData] = useState<DrawingRoomData | null>(null);
  const [isLoading, setIsLoading] = useState(roomCode !== null);
  const myPlayerId = getOrCreatePlayerId();

  useEffect(() => {
    if (!roomCode) { setIsLoading(false); return; }
    setIsLoading(true);
    const unsub = onValue(ref(db, `drawing-rooms/${roomCode}`), snap => {
      setRoomData(snap.val() as DrawingRoomData | null);
      setIsLoading(false);
    });
    return () => unsub();
  }, [roomCode]);

  const isHost = roomData?.hostId === myPlayerId;

  const orderedPlayers = (() => {
    if (!roomData) return [];
    const ids = roomData.playerOrder?.length
      ? roomData.playerOrder
      : Object.entries(roomData.players ?? {}).sort(([, a], [, b]) => a.joinedAt - b.joinedAt).map(([id]) => id);
    return ids.map(id => ({ id, name: roomData.players[id]?.name ?? '?', isMe: id === myPlayerId }));
  })();

  const cards = normalizeCards(roomData?.cards);
  const allFlipped = cards.length > 0 && cards.every(c => c.isFlipped);

  const currentPlayerId = (() => {
    if (!roomData || roomData.gameState !== 'playing' || allFlipped) return null;
    const order = roomData.turnOrder ?? [];
    if (!order.length) return null;
    return order[roomData.currentTurnIndex % order.length];
  })();

  const isMyTurn = currentPlayerId === myPlayerId;

  const createRoom = useCallback(async (nickname: string): Promise<string> => {
    const code = generateRoomCode();
    const data: Omit<DrawingRoomData, 'cards'> & { cards: DrawingCard[] } = {
      hostId: myPlayerId,
      gameState: 'lobby',
      totalCount: 10,
      hitCount: 2,
      hitMessage: '당첨 ✨',
      missMessage: '통과',
      turnOrder: [],
      currentTurnIndex: 0,
      cards: [],
      playerOrder: [],
      players: { [myPlayerId]: { name: nickname, joinedAt: Date.now() } },
    };
    const roomRef = ref(db, `drawing-rooms/${code}`);
    await set(roomRef, data);
    onDisconnect(roomRef).remove();
    return code;
  }, [myPlayerId]);

  const joinRoom = useCallback(async (code: string, nickname: string) => {
    const snap = await get(ref(db, `drawing-rooms/${code}`));
    if (!snap.exists()) return { success: false, error: '존재하지 않는 방입니다.' };
    const data = snap.val() as DrawingRoomData;
    if (data.gameState !== 'lobby') return { success: false, error: '이미 게임이 진행 중입니다.' };
    if (Object.keys(data.players ?? {}).length >= 20) return { success: false, error: '방이 가득 찼습니다. (최대 20명)' };
    const playerRef = ref(db, `drawing-rooms/${code}/players/${myPlayerId}`);
    await set(playerRef, { name: nickname, joinedAt: Date.now() });
    onDisconnect(playerRef).remove();
    return { success: true };
  }, [myPlayerId]);

  const leaveRoom = useCallback(async (code: string) => {
    if (isHost) { await remove(ref(db, `drawing-rooms/${code}`)); }
    else { await remove(ref(db, `drawing-rooms/${code}/players/${myPlayerId}`)); }
  }, [isHost, myPlayerId]);

  const updateSettings = useCallback(async (totalCount: number, hitCount: number, hitMessage: string, missMessage: string) => {
    if (!roomCode || !isHost) return;
    await update(ref(db, `drawing-rooms/${roomCode}`), { totalCount, hitCount, hitMessage, missMessage });
  }, [roomCode, isHost]);

  const startGame = useCallback(async () => {
    if (!roomCode || !roomData || !isHost) return;
    const playerIds = Object.entries(roomData.players)
      .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
      .map(([id]) => id);

    // 카드 생성 + 셔플
    const newCards: DrawingCard[] = Array.from({ length: roomData.totalCount }, (_, i) => ({
      isHit: i < roomData.hitCount,
      isFlipped: false,
      flippedBy: null,
    }));
    for (let i = newCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
    }

    // 라운드로빈 순서 랜덤화
    const turnOrder = [...playerIds];
    for (let i = turnOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
    }

    await update(ref(db, `drawing-rooms/${roomCode}`), {
      gameState: 'playing',
      playerOrder: playerIds,
      turnOrder,
      currentTurnIndex: 0,
      cards: newCards,
    });
  }, [roomCode, roomData, isHost]);

  const flipCard = useCallback(async (cardIndex: number) => {
    if (!roomCode || !roomData || !isMyTurn) return;
    await update(ref(db, `drawing-rooms/${roomCode}`), {
      [`cards/${cardIndex}/isFlipped`]: true,
      [`cards/${cardIndex}/flippedBy`]: myPlayerId,
      currentTurnIndex: roomData.currentTurnIndex + 1,
    });
  }, [roomCode, roomData, isMyTurn, myPlayerId]);

  const resetToLobby = useCallback(async () => {
    if (!roomCode || !isHost) return;
    await update(ref(db, `drawing-rooms/${roomCode}`), {
      gameState: 'lobby',
      playerOrder: [],
      turnOrder: [],
      currentTurnIndex: 0,
      cards: [],
    });
  }, [roomCode, isHost]);

  return {
    roomData, isLoading, myPlayerId, isHost,
    cards, orderedPlayers, currentPlayerId, isMyTurn, allFlipped,
    createRoom, joinRoom, leaveRoom,
    updateSettings, startGame, flipCard, resetToLobby,
  };
}
