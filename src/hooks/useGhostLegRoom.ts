import { useState, useEffect, useCallback } from 'react';
import { ref, set, get, update, remove, onValue, onDisconnect } from 'firebase/database';
import { db } from '../lib/firebase';
import { generateRoomCode, getOrCreatePlayerId, type PlayerEntry } from '../lib/roomUtils';

const ROWS = 12;

export interface GhostLegRoomData {
  hostId: string;
  gameState: 'lobby' | 'playing';
  hitText: string;
  normalText: string;
  lines: number[][];   // 0/1 matrix stored in Firebase
  results: string[];
  players: Record<string, PlayerEntry>;
  playerOrder: string[];
  playStartedAt: number | null;
  revealed: Record<string, number>;     // playerId → revealedAt timestamp
  chosenSlots: Record<string, number>;  // playerId → slot index (0-based)
}

export interface GhostLegOrderedPlayer {
  id: string;
  name: string;
  isMe: boolean;
}

export interface UseGhostLegRoomReturn {
  roomData: GhostLegRoomData | null;
  isLoading: boolean;
  myPlayerId: string;
  isHost: boolean;
  orderedPlayers: GhostLegOrderedPlayer[];
  createRoom: (nickname: string) => Promise<string>;
  joinRoom: (code: string, nickname: string) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: (code: string) => Promise<void>;
  updateTexts: (hitText: string, normalText: string) => Promise<void>;
  startPlay: () => Promise<void>;
  claimSlot: (slotIndex: number | null) => Promise<void>;
  revealPath: () => Promise<void>;
  resetToLobby: () => Promise<void>;
}

function generateLinesMatrix(n: number): number[][] {
  const matrix: number[][] = Array.from({ length: ROWS }, () => Array(n - 1).fill(0));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < n - 1; c++) {
      if (c > 0 && matrix[r][c - 1]) continue;
      if (Math.random() > 0.5) matrix[r][c] = 1;
    }
  }
  // 각 세로선 사이에 최소 3개의 가로 연결 보장
  for (let c = 0; c < n - 1; c++) {
    let count = matrix.filter(row => row[c]).length;
    let attempts = 0;
    while (count < 3 && attempts < 100) {
      attempts++;
      const r = Math.floor(Math.random() * ROWS);
      if (matrix[r][c]) continue;
      const hasLeft  = c > 0     && matrix[r][c - 1];
      const hasRight = c < n - 2 && matrix[r][c + 1];
      if (!hasLeft && !hasRight) { matrix[r][c] = 1; count++; }
    }
  }
  return matrix;
}

export function useGhostLegRoom(roomCode: string | null): UseGhostLegRoomReturn {
  const [roomData, setRoomData] = useState<GhostLegRoomData | null>(null);
  const [isLoading, setIsLoading] = useState(roomCode !== null);
  const myPlayerId = getOrCreatePlayerId();

  useEffect(() => {
    if (!roomCode) { setIsLoading(false); return; }
    setIsLoading(true);
    const unsub = onValue(ref(db, `ghostleg-rooms/${roomCode}`), snap => {
      setRoomData(snap.val() as GhostLegRoomData | null);
      setIsLoading(false);
    });
    return () => unsub();
  }, [roomCode]);

  const isHost = roomData?.hostId === myPlayerId;

  const orderedPlayers: GhostLegOrderedPlayer[] = (() => {
    if (!roomData) return [];
    const ids = roomData.playerOrder?.length
      ? roomData.playerOrder
      : Object.entries(roomData.players ?? {}).sort(([, a], [, b]) => a.joinedAt - b.joinedAt).map(([id]) => id);
    return ids.map(id => ({
      id,
      name: roomData.players[id]?.name ?? '?',
      isMe: id === myPlayerId,
    }));
  })();

  const createRoom = useCallback(async (nickname: string): Promise<string> => {
    const code = generateRoomCode();
    const data: GhostLegRoomData = {
      hostId: myPlayerId,
      gameState: 'lobby',
      hitText: '💣',
      normalText: '생존',
      lines: generateLinesMatrix(2),
      results: [],
      playerOrder: [],
      players: { [myPlayerId]: { name: nickname, joinedAt: Date.now() } },
      playStartedAt: null,
      revealed: {},
      chosenSlots: {},
    };
    const roomRef = ref(db, `ghostleg-rooms/${code}`);
    await set(roomRef, data);
    onDisconnect(roomRef).remove();
    return code;
  }, [myPlayerId]);

  const joinRoom = useCallback(async (code: string, nickname: string) => {
    const snap = await get(ref(db, `ghostleg-rooms/${code}`));
    if (!snap.exists()) return { success: false, error: '존재하지 않는 방입니다.' };
    const data = snap.val() as GhostLegRoomData;
    if (data.gameState !== 'lobby') return { success: false, error: '이미 게임이 진행 중입니다.' };
    if (Object.keys(data.players ?? {}).length >= 8) return { success: false, error: '방이 가득 찼습니다. (최대 8명)' };
    const playerRef = ref(db, `ghostleg-rooms/${code}/players/${myPlayerId}`);
    await set(playerRef, { name: nickname, joinedAt: Date.now() });
    onDisconnect(playerRef).remove();
    return { success: true };
  }, [myPlayerId]);

  const leaveRoom = useCallback(async (code: string) => {
    if (isHost) {
      await remove(ref(db, `ghostleg-rooms/${code}`));
    } else {
      await remove(ref(db, `ghostleg-rooms/${code}/players/${myPlayerId}`));
    }
  }, [isHost, myPlayerId]);

  const updateTexts = useCallback(async (hitText: string, normalText: string) => {
    if (!roomCode || !isHost) return;
    await update(ref(db, `ghostleg-rooms/${roomCode}`), { hitText, normalText });
  }, [roomCode, isHost]);

  const startPlay = useCallback(async () => {
    if (!roomCode || !roomData || !isHost) return;
    const playerIds = Object.entries(roomData.players)
      .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
      .map(([id]) => id);
    const n = playerIds.length;

    // chosenSlots 기반으로 playerOrder 결정
    const chosenSlots = roomData.chosenSlots ?? {};
    const orderedBySlot: (string | null)[] = Array(n).fill(null);
    const usedSlots = new Set<number>();
    const unchosenPlayers: string[] = [];

    playerIds.forEach(pid => {
      const slot = chosenSlots[pid];
      if (slot !== undefined && slot >= 0 && slot < n && !usedSlots.has(slot)) {
        orderedBySlot[slot] = pid;
        usedSlots.add(slot);
      } else {
        unchosenPlayers.push(pid);
      }
    });

    // 남은 빈 자리를 랜덤하게 섞어 미선택 플레이어에 배정
    const emptySlots = orderedBySlot.map((v, i) => v === null ? i : -1).filter(i => i !== -1);
    for (let i = emptySlots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [emptySlots[i], emptySlots[j]] = [emptySlots[j], emptySlots[i]];
    }
    unchosenPlayers.forEach((pid, i) => { orderedBySlot[emptySlots[i]] = pid; });
    const finalPlayerOrder = orderedBySlot as string[];

    const newLines = generateLinesMatrix(n);
    const results: string[] = Array(n).fill(roomData.normalText);
    results[0] = roomData.hitText;
    for (let i = results.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }
    await update(ref(db, `ghostleg-rooms/${roomCode}`), {
      gameState: 'playing',
      playerOrder: finalPlayerOrder,
      lines: newLines,
      results,
      playStartedAt: Date.now(),
      revealed: {},
    });
  }, [roomCode, roomData, isHost]);

  const claimSlot = useCallback(async (slotIndex: number | null) => {
    if (!roomCode) return;
    if (slotIndex === null) {
      await remove(ref(db, `ghostleg-rooms/${roomCode}/chosenSlots/${myPlayerId}`));
    } else {
      await update(ref(db, `ghostleg-rooms/${roomCode}/chosenSlots`), { [myPlayerId]: slotIndex });
    }
  }, [roomCode, myPlayerId]);

  const revealPath = useCallback(async () => {
    if (!roomCode) return;
    await update(ref(db, `ghostleg-rooms/${roomCode}/revealed`), {
      [myPlayerId]: Date.now(),
    });
  }, [roomCode, myPlayerId]);

  const resetToLobby = useCallback(async () => {
    if (!roomCode || !isHost) return;
    await update(ref(db, `ghostleg-rooms/${roomCode}`), {
      gameState: 'lobby',
      playerOrder: [],
      playStartedAt: null,
      revealed: {},
      chosenSlots: {},
    });
  }, [roomCode, isHost]);

  return {
    roomData, isLoading, myPlayerId, isHost, orderedPlayers,
    createRoom, joinRoom, leaveRoom,
    updateTexts, startPlay, claimSlot, revealPath, resetToLobby,
  };
}
