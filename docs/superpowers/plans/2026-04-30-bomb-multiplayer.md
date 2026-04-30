# 폭탄 돌리기 멀티플레이어 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firebase Realtime Database를 이용해 여러 기기가 같은 방을 공유하며 폭탄 돌리기 게임을 진행할 수 있도록 멀티플레이어 기능을 추가한다.

**Architecture:** 클라이언트 SDK로 Firebase RTDB에 직접 연결하는 서버리스 구조. 방장 기기가 타이머를 관리하고, 모든 기기가 `bombExplodesAt` 타임스탬프 기반으로 로컬 타이머를 설정해 폭발 판정. `onDisconnect().remove()`로 방장 퇴장 시 방 자동 삭제해 DB 레코드 누적 방지.

**Tech Stack:** React 19, TypeScript, Firebase v10 (Realtime Database), Vite (VITE_ env vars)

---

## 파일 구조

| 파일 | 작업 | 역할 |
|---|---|---|
| `.env.example` | 신규 | Firebase config 키 템플릿 |
| `.env` | 신규 (사용자 입력) | 실제 Firebase config 값 |
| `src/lib/firebase.ts` | 신규 | Firebase 앱 초기화 + db 인스턴스 export |
| `src/lib/roomUtils.ts` | 신규 | 타입 정의 + 순수 유틸 함수 (generateRoomCode, getOrCreatePlayerId) |
| `src/hooks/useGameRoom.ts` | 신규 | Firebase 구독 + 모든 방/게임 액션을 담은 React 훅 |
| `src/components/games/Bomb/Bomb.tsx` | 수정 | 멀티플레이 UI 통합 (솔로 플로우 보존) |
| `src/components/games/Bomb/Bomb.module.css` | 수정 | 모드 탭, 로비, 방 코드, "나" 뱃지 스타일 추가 |

---

## ⚠️ Task 0: Firebase Console 설정 (사용자 직접 수행 — 코드 작업 전 필수)

이 단계는 코드를 건드리기 전에 완료해야 한다.

- [ ] **Step 1: Firebase 프로젝트 생성**

  https://console.firebase.google.com/ → "프로젝트 추가" → 프로젝트 이름 입력 → 생성

- [ ] **Step 2: Realtime Database 활성화**

  좌측 메뉴 "빌드" → "Realtime Database" → "데이터베이스 만들기" → 테스트 모드로 시작 → 리전 선택(asia-southeast1 권장)

- [ ] **Step 3: 웹 앱 등록**

  프로젝트 설정(⚙️) → "앱 추가" → 웹(</>)  → 앱 닉네임 입력 → 등록 → `firebaseConfig` 객체 복사해 두기

- [ ] **Step 4: Realtime Database 보안 규칙 설정**

  Realtime Database → "규칙" 탭 → 아래 내용으로 교체 후 게시:

  ```json
  {
    "rules": {
      "rooms": {
        "$roomCode": {
          ".read": true,
          ".write": true
        }
      }
    }
  }
  ```

---

## Task 1: 패키지 설치 + 환경 변수 파일

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: firebase 패키지 설치**

  ```bash
  npm install firebase
  ```

  Expected: `added N packages` without errors

- [ ] **Step 2: .env.example 생성**

  ```
  VITE_FIREBASE_API_KEY=your_api_key_here
  VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
  VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.asia-southeast1.firebasedatabase.app
  VITE_FIREBASE_PROJECT_ID=your_project_id
  VITE_FIREBASE_APP_ID=your_app_id
  ```

- [ ] **Step 3: .gitignore에 .env 추가**

  `.gitignore` 파일에 아래 줄이 없으면 추가한다:

  ```
  .env
  ```

- [ ] **Step 4: .env 파일 생성 후 Task 0에서 복사한 값 입력**

  `.env.example`을 복사해 `.env`로 만들고, Firebase Console에서 확인한 실제 값을 각 항목에 입력한다.

- [ ] **Step 5: commit**

  ```bash
  git add .env.example .gitignore package.json package-lock.json
  git commit -m "chore: add firebase dependency and env template"
  ```

---

## Task 2: Firebase 초기화 (`src/lib/firebase.ts`)

**Files:**
- Create: `src/lib/firebase.ts`

- [ ] **Step 1: src/lib/firebase.ts 작성**

  ```ts
  import { initializeApp } from 'firebase/app';
  import { getDatabase } from 'firebase/database';

  const firebaseConfig = {
    apiKey:      import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId:   import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId:       import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const app = initializeApp(firebaseConfig);
  export const db = getDatabase(app);
  ```

- [ ] **Step 2: 빌드 확인**

  ```bash
  npm run build
  ```

  Expected: TypeScript 오류 없이 빌드 성공

- [ ] **Step 3: commit**

  ```bash
  git add src/lib/firebase.ts
  git commit -m "feat: initialize firebase realtime database"
  ```

---

## Task 3: 타입 + 유틸 함수 (`src/lib/roomUtils.ts`)

**Files:**
- Create: `src/lib/roomUtils.ts`

- [ ] **Step 1: src/lib/roomUtils.ts 작성**

  ```ts
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
  ```

- [ ] **Step 2: 빌드 확인**

  ```bash
  npm run build
  ```

  Expected: 오류 없음

- [ ] **Step 3: commit**

  ```bash
  git add src/lib/roomUtils.ts
  git commit -m "feat: add room types and utility functions"
  ```

---

## Task 4: `useGameRoom` 훅 (`src/hooks/useGameRoom.ts`)

**Files:**
- Create: `src/hooks/useGameRoom.ts`

- [ ] **Step 1: src/hooks/useGameRoom.ts 전체 작성**

  ```ts
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
  ```

- [ ] **Step 2: 빌드 확인**

  ```bash
  npm run build
  ```

  Expected: TypeScript 오류 없음

- [ ] **Step 3: commit**

  ```bash
  git add src/hooks/useGameRoom.ts
  git commit -m "feat: add useGameRoom hook with firebase sync and bomb timer"
  ```

---

## Task 5: Bomb.tsx 전체 수정

**Files:**
- Modify: `src/components/games/Bomb/Bomb.tsx`

현재 파일을 아래 내용으로 완전히 교체한다. 솔로 게임 로직은 100% 보존되고 멀티플레이 렌더 경로가 상단에 추가된다.

- [ ] **Step 1: Bomb.tsx 전체 교체**

  ```tsx
  import { useState, useEffect, useRef } from 'react';
  import styles from './Bomb.module.css';
  import { useGameRoom } from '../../../hooks/useGameRoom';

  type GameState  = 'setup' | 'playing' | 'exploded';
  type Mode       = 'solo' | 'multi';
  type EntryTab   = 'create' | 'join';

  export default function Bomb() {

    // ── 솔로 상태 (기존 그대로) ────────────────────────────────────────────
    const [playerInput, setPlayerInput] = useState('');
    const [players, setPlayers]         = useState<string[]>(['플레이어 1', '플레이어 2', '플레이어 3']);
    const [minTime, setMinTime]         = useState(10);
    const [maxTime, setMaxTime]         = useState(30);
    const [error, setError]             = useState('');
    const [gameState, setGameState]     = useState<GameState>('setup');
    const [currentHolder, setCurrentHolder] = useState(0);
    const [passCount, setPassCount]     = useState(0);
    const [loserIndex, setLoserIndex]   = useState<number | null>(null);

    const timerRef         = useRef<number | null>(null);
    const currentHolderRef = useRef(0);
    const gameStateRef     = useRef<GameState>('setup');

    // ── 멀티 상태 ─────────────────────────────────────────────────────────
    const [mode, setMode]                   = useState<Mode>('solo');
    const [entryTab, setEntryTab]           = useState<EntryTab>('create');
    const [nicknameInput, setNicknameInput] = useState('');
    const [roomCodeInput, setRoomCodeInput] = useState('');
    const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
    const [multiError, setMultiError]       = useState('');
    const [isSubmitting, setIsSubmitting]   = useState(false);

    const room = useGameRoom(activeRoomCode);

    // ── 효과 ──────────────────────────────────────────────────────────────

    useEffect(() => {
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    // URL ?room= 파라미터 자동 처리
    useEffect(() => {
      const params    = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setMode('multi');
        setEntryTab('join');
        setRoomCodeInput(roomParam.toUpperCase());
      }
    }, []);

    // 방장 퇴장 감지 (방 데이터가 null로 변하는 경우)
    useEffect(() => {
      if (activeRoomCode && !room.isLoading && room.roomData === null) {
        setActiveRoomCode(null);
        setMultiError('방장이 방을 나갔습니다.');
      }
    }, [activeRoomCode, room.isLoading, room.roomData]);

    // ── 솔로 핸들러 ───────────────────────────────────────────────────────

    const addPlayer = (e: React.FormEvent) => {
      e.preventDefault();
      const name = playerInput.trim();
      if (name && players.length < 8) {
        setPlayers(prev => [...prev, name]);
        setPlayerInput('');
        setError('');
      }
    };

    const removePlayer = (index: number) => {
      setPlayers(prev => prev.filter((_, i) => i !== index));
      setError('');
    };

    const startSoloGame = () => {
      if (players.length < 2) { setError('최소 2명 이상 필요합니다.'); return; }
      if (minTime > maxTime)  { setError('최소 시간이 최대 시간보다 클 수 없습니다.'); return; }
      setError('');
      currentHolderRef.current = 0;
      gameStateRef.current     = 'playing';
      setCurrentHolder(0);
      setPassCount(0);
      setLoserIndex(null);
      setGameState('playing');
      const randomMs = Math.floor(Math.random() * (maxTime - minTime + 1) * 1000) + minTime * 1000;
      timerRef.current = window.setTimeout(() => {
        const loser = currentHolderRef.current;
        gameStateRef.current = 'exploded';
        setLoserIndex(loser);
        setGameState('exploded');
        if (window.navigator?.vibrate) window.navigator.vibrate([500, 200, 500]);
      }, randomMs);
    };

    const passSoloBomb = () => {
      if (gameStateRef.current !== 'playing') return;
      const next = (currentHolderRef.current + 1) % players.length;
      currentHolderRef.current = next;
      setCurrentHolder(next);
      setPassCount(c => c + 1);
      if (window.navigator?.vibrate) window.navigator.vibrate(30);
    };

    const resetSoloGame = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      gameStateRef.current = 'setup';
      setGameState('setup');
      setLoserIndex(null);
    };

    // ── 멀티 핸들러 ───────────────────────────────────────────────────────

    const handleCreateRoom = async () => {
      const name = nicknameInput.trim();
      if (!name) { setMultiError('닉네임을 입력해 주세요.'); return; }
      setIsSubmitting(true);
      setMultiError('');
      try {
        const code = await room.createRoom(name);
        setActiveRoomCode(code);
      } catch {
        setMultiError('방 생성에 실패했습니다. 다시 시도해 주세요.');
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleJoinRoom = async () => {
      const name = nicknameInput.trim();
      const code = roomCodeInput.trim().toUpperCase();
      if (!name)          { setMultiError('닉네임을 입력해 주세요.'); return; }
      if (code.length !== 4) { setMultiError('방 코드는 4자리입니다.'); return; }
      setIsSubmitting(true);
      setMultiError('');
      const result = await room.joinRoom(code, name);
      if (result.success) {
        setActiveRoomCode(code);
      } else {
        setMultiError(result.error ?? '입장에 실패했습니다.');
      }
      setIsSubmitting(false);
    };

    const handleLeaveRoom = async () => {
      if (!activeRoomCode) return;
      await room.leaveRoom(activeRoomCode);
      setActiveRoomCode(null);
      setNicknameInput('');
      setRoomCodeInput('');
      setMultiError('');
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url);
    };

    const handleCopyLink = () => {
      if (!activeRoomCode) return;
      const url = new URL(window.location.href);
      url.searchParams.set('room', activeRoomCode);
      navigator.clipboard.writeText(url.toString());
    };

    // ── 공유 UI 조각 ──────────────────────────────────────────────────────

    const modeTabs = (
      <div className={styles.modeTabs}>
        <button
          className={`${styles.modeTab} ${mode === 'solo' ? styles.modeTabActive : ''}`}
          onClick={() => setMode('solo')}
        >
          혼자 하기
        </button>
        <button
          className={`${styles.modeTab} ${mode === 'multi' ? styles.modeTabActive : ''}`}
          onClick={() => setMode('multi')}
        >
          멀티플레이
        </button>
      </div>
    );

    // ── 멀티: 로딩 ────────────────────────────────────────────────────────
    if (mode === 'multi' && activeRoomCode && room.isLoading) {
      return (
        <div className={styles.container}>
          <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>연결 중...</p>
          </div>
        </div>
      );
    }

    // ── 멀티: 입장 화면 ───────────────────────────────────────────────────
    if (mode === 'multi' && !activeRoomCode) {
      return (
        <div className={styles.container}>
          <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
            <h2 style={{ textAlign: 'center', fontSize: '2rem' }}>💣 폭탄 돌리기</h2>
            {modeTabs}

            <div className={styles.entryTabs}>
              <button
                className={`${styles.entryTab} ${entryTab === 'create' ? styles.entryTabActive : ''}`}
                onClick={() => { setEntryTab('create'); setMultiError(''); }}
              >
                방 만들기
              </button>
              <button
                className={`${styles.entryTab} ${entryTab === 'join' ? styles.entryTabActive : ''}`}
                onClick={() => { setEntryTab('join'); setMultiError(''); }}
              >
                방 참가하기
              </button>
            </div>

            {entryTab === 'join' && (
              <input
                type="text"
                className={`${styles.playerInput} ${styles.roomCodeInput}`}
                placeholder="방 코드 4자리"
                value={roomCodeInput}
                onChange={e => { setRoomCodeInput(e.target.value.toUpperCase()); setMultiError(''); }}
                maxLength={4}
              />
            )}

            <input
              type="text"
              className={styles.playerInput}
              placeholder="내 닉네임 입력"
              value={nicknameInput}
              onChange={e => { setNicknameInput(e.target.value); setMultiError(''); }}
              maxLength={10}
            />

            {multiError && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{multiError}</p>
            )}

            <button
              className="btn-primary"
              style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
              onClick={entryTab === 'create' ? handleCreateRoom : handleJoinRoom}
              disabled={isSubmitting}
            >
              {isSubmitting ? '처리 중...' : entryTab === 'create' ? '방 만들기' : '입장하기'}
            </button>
          </div>
        </div>
      );
    }

    // ── 멀티: 로비 ────────────────────────────────────────────────────────
    if (mode === 'multi' && activeRoomCode && room.roomData?.gameState === 'lobby') {
      const { roomData, isHost, orderedPlayers } = room;
      const minT        = roomData?.minTime ?? 10;
      const maxT        = roomData?.maxTime ?? 30;
      const playerCount = orderedPlayers.length;

      return (
        <div className={styles.container}>
          <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
            <h2 style={{ textAlign: 'center', fontSize: '2rem' }}>💣 폭탄 돌리기</h2>

            <div className={styles.roomCodeDisplay}>
              <span className={styles.roomCodeLabel}>방 코드</span>
              <span className={styles.roomCode}>{activeRoomCode}</span>
              <button className={styles.copyLinkBtn} onClick={handleCopyLink}>
                🔗 링크 복사
              </button>
            </div>

            <div className={styles.playerList}>
              {orderedPlayers.map(p => (
                <div key={p.id} className={styles.playerChip}>
                  <span className={styles.playerChipIcon}>
                    {roomData!.hostId === p.id ? '👑' : '✋'}
                  </span>
                  <span className={styles.playerChipName}>{p.name}</span>
                  {p.isMe && <span className={styles.meBadge}>나</span>}
                </div>
              ))}
              {playerCount === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  아직 아무도 없습니다...
                </p>
              )}
            </div>

            <div className={styles.timeRow}>
              <div className={styles.timeSetting}>
                <label>최소 시간 (초)</label>
                <div className={styles.numControl}>
                  <button type="button" disabled={!isHost}
                    onClick={() => room.updateTimeSettings(Math.max(5, minT - 5), maxT)}>-</button>
                  <input type="number" readOnly value={minT} />
                  <button type="button" disabled={!isHost}
                    onClick={() => room.updateTimeSettings(Math.min(maxT, minT + 5), maxT)}>+</button>
                </div>
              </div>
              <div className={styles.timeSetting}>
                <label>최대 시간 (초)</label>
                <div className={styles.numControl}>
                  <button type="button" disabled={!isHost}
                    onClick={() => room.updateTimeSettings(minT, Math.max(minT, maxT - 5))}>-</button>
                  <input type="number" readOnly value={maxT} />
                  <button type="button" disabled={!isHost}
                    onClick={() => room.updateTimeSettings(minT, Math.min(120, maxT + 5))}>+</button>
                </div>
              </div>
            </div>

            {isHost ? (
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '16px', fontSize: '1.25rem' }}
                onClick={() => room.startGame()}
                disabled={playerCount < 2}
              >
                {playerCount < 2 ? `${2 - playerCount}명 더 필요합니다` : '게임 시작!'}
              </button>
            ) : (
              <p className={styles.waitingText}>방장이 게임을 시작하면 시작됩니다...</p>
            )}

            <button
              className={styles.leaveBtn}
              onClick={handleLeaveRoom}
            >
              방 나가기
            </button>
          </div>
        </div>
      );
    }

    // ── 멀티: 게임 / 결과 ─────────────────────────────────────────────────
    if (mode === 'multi' && activeRoomCode && room.roomData) {
      const { roomData, isMyTurn, orderedPlayers, loserName, isHost } = room;
      const isExploded = roomData.gameState === 'exploded';

      return (
        <div className={`${styles.container} ${isExploded ? styles.shakeScreen : ''}`}>
          <div className={`${styles.gamePanel} animate-fade-in`}>
            <div className={styles.scoreBoard}>
              <span className={styles.scoreLabel}>패스 횟수</span>
              <span className={styles.scoreValue}>{roomData.passCount}</span>
            </div>

            <div className={styles.playersGrid}>
              {orderedPlayers.map(p => (
                <div
                  key={p.id}
                  className={`
                    ${styles.playerCard}
                    ${p.isCurrent && !isExploded ? styles.holderCard : ''}
                    ${p.isLoser ? styles.loserCard : ''}
                  `}
                >
                  <div className={styles.handEmoji}>
                    {p.isLoser ? '💥' : p.isCurrent ? '💣' : '✋'}
                  </div>
                  <div className={styles.playerName}>{p.name}</div>
                  {p.isMe && <span className={styles.meBadge}>나</span>}
                </div>
              ))}
            </div>

            {!isExploded ? (
              <button
                className={`btn-primary ${styles.passBtn}`}
                onClick={() => room.passBomb()}
                disabled={!isMyTurn}
                style={{ opacity: isMyTurn ? 1 : 0.4 }}
              >
                {isMyTurn ? '💣 패스하기!' : '상대방의 차례...'}
              </button>
            ) : (
              <div className={`animate-fade-in ${styles.resultArea}`}>
                <p className={styles.explodedSub}>폭탄이 터졌습니다!</p>
                <h1 className={styles.explodedTitle}>💥 {loserName}</h1>
                {isHost ? (
                  <button
                    className="btn-primary"
                    style={{ padding: '12px 36px', fontSize: '1.1rem', marginTop: '0.5rem' }}
                    onClick={() => room.resetToLobby()}
                  >
                    다시 하기
                  </button>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
                    방장이 다시 하기를 누르면 재시작됩니다
                  </p>
                )}
                <button className={styles.leaveBtn} onClick={handleLeaveRoom}>
                  나가기
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // ── 솔로: 셋업 ────────────────────────────────────────────────────────
    if (gameState === 'setup') {
      return (
        <div className={styles.container}>
          <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
            <h2 style={{ textAlign: 'center', fontSize: '2rem' }}>💣 폭탄 돌리기</h2>
            {modeTabs}

            <form onSubmit={addPlayer} className={styles.addPlayerForm}>
              <input
                type="text"
                className={styles.playerInput}
                placeholder="플레이어 이름 추가 (최대 8명)"
                value={playerInput}
                onChange={e => { setPlayerInput(e.target.value); setError(''); }}
                maxLength={10}
                disabled={players.length >= 8}
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '12px 20px', borderRadius: '12px', fontSize: '1rem', flexShrink: 0 }}
                disabled={!playerInput.trim() || players.length >= 8}
              >
                추가
              </button>
            </form>

            <div className={styles.playerList}>
              {players.map((name, i) => (
                <div key={i} className={styles.playerChip}>
                  <span className={styles.playerChipIcon}>✋</span>
                  <span className={styles.playerChipName}>{name}</span>
                  <button type="button" className={styles.removeChipBtn} onClick={() => removePlayer(i)}>×</button>
                </div>
              ))}
            </div>

            <div className={styles.timeRow}>
              <div className={styles.timeSetting}>
                <label>최소 시간 (초)</label>
                <div className={styles.numControl}>
                  <button type="button" onClick={() => { setError(''); setMinTime(c => Math.max(5, c - 5)); }}>-</button>
                  <input type="number" readOnly value={minTime} />
                  <button type="button" onClick={() => { setError(''); setMinTime(c => Math.min(maxTime, c + 5)); }}>+</button>
                </div>
              </div>
              <div className={styles.timeSetting}>
                <label>최대 시간 (초)</label>
                <div className={styles.numControl}>
                  <button type="button" onClick={() => { setError(''); setMaxTime(c => Math.max(minTime, c - 5)); }}>-</button>
                  <input type="number" readOnly value={maxTime} />
                  <button type="button" onClick={() => { setError(''); setMaxTime(c => Math.min(120, c + 5)); }}>+</button>
                </div>
              </div>
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{error}</p>
            )}

            <button
              className="btn-primary"
              style={{ width: '100%', padding: '16px', fontSize: '1.25rem' }}
              onClick={startSoloGame}
            >
              게임 시작!
            </button>
          </div>
        </div>
      );
    }

    // ── 솔로: 게임 ────────────────────────────────────────────────────────
    return (
      <div className={`${styles.container} ${gameState === 'exploded' ? styles.shakeScreen : ''}`}>
        <div className={`${styles.gamePanel} animate-fade-in`}>
          <div className={styles.scoreBoard}>
            <span className={styles.scoreLabel}>패스 횟수</span>
            <span className={styles.scoreValue}>{passCount}</span>
          </div>

          <div className={styles.playersGrid}>
            {players.map((name, i) => {
              const isCurrent = i === currentHolder;
              const isLoser   = gameState === 'exploded' && i === loserIndex;
              return (
                <div
                  key={i}
                  className={`
                    ${styles.playerCard}
                    ${isCurrent && gameState === 'playing' ? styles.holderCard : ''}
                    ${isLoser ? styles.loserCard : ''}
                  `}
                >
                  <div className={styles.handEmoji}>
                    {isLoser ? '💥' : isCurrent ? '💣' : '✋'}
                  </div>
                  <div className={styles.playerName}>{name}</div>
                </div>
              );
            })}
          </div>

          {gameState === 'playing' ? (
            <button className={`btn-primary ${styles.passBtn}`} onClick={passSoloBomb}>
              💣 &nbsp;패스하기!
            </button>
          ) : (
            <div className={`animate-fade-in ${styles.resultArea}`}>
              <p className={styles.explodedSub}>폭탄이 터졌습니다!</p>
              <h1 className={styles.explodedTitle}>💥 {players[loserIndex!]}</h1>
              <button
                className="btn-primary"
                style={{ padding: '12px 36px', fontSize: '1.1rem', marginTop: '0.5rem' }}
                onClick={resetSoloGame}
              >
                다시 하기
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: 빌드 확인**

  ```bash
  npm run build
  ```

  Expected: TypeScript 오류 없음

- [ ] **Step 3: commit**

  ```bash
  git add src/components/games/Bomb/Bomb.tsx
  git commit -m "feat: integrate multiplayer UI into bomb game"
  ```

---

## Task 6: Bomb.module.css — 새 스타일 추가

**Files:**
- Modify: `src/components/games/Bomb/Bomb.module.css`

기존 파일 맨 아래에 아래 CSS를 추가한다.

- [ ] **Step 1: Bomb.module.css 파일 끝에 추가**

  ```css
  /* ── 모드 탭 ──────────────────────────────────────────────────────────── */

  .modeTabs {
    display: flex;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.06);
    padding: 4px;
    border-radius: 12px;
  }

  .modeTab {
    flex: 1;
    padding: 8px 0;
    border-radius: 9px;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
    transition: background 0.2s, color 0.2s;
  }

  .modeTabActive {
    background: white;
    color: var(--text-primary);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  }

  /* ── 멀티 입장 탭 ─────────────────────────────────────────────────────── */

  .entryTabs {
    display: flex;
    gap: 0.5rem;
  }

  .entryTab {
    flex: 1;
    padding: 10px 0;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
    border: 2px solid transparent;
    transition: border-color 0.2s, color 0.2s;
  }

  .entryTabActive {
    border-color: var(--accent-secondary);
    color: var(--accent-secondary);
  }

  /* ── 방 코드 입력 ─────────────────────────────────────────────────────── */

  .roomCodeInput {
    text-align: center;
    letter-spacing: 0.4em;
    font-weight: 700;
    font-size: 1.3rem !important;
  }

  /* ── 로비: 방 코드 표시 ───────────────────────────────────────────────── */

  .roomCodeDisplay {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(99, 102, 241, 0.07);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 14px;
    padding: 12px 16px;
  }

  .roomCodeLabel {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .roomCode {
    flex: 1;
    font-size: 1.5rem;
    font-weight: 900;
    letter-spacing: 0.25em;
    color: var(--accent-secondary);
  }

  .copyLinkBtn {
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    background: rgba(99, 102, 241, 0.12);
    color: var(--accent-secondary);
    white-space: nowrap;
    transition: background 0.2s;
  }

  .copyLinkBtn:hover {
    background: rgba(99, 102, 241, 0.22);
  }

  /* ── "나" 뱃지 ───────────────────────────────────────────────────────── */

  .meBadge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 7px;
    border-radius: 99px;
    background: var(--accent-secondary);
    color: white;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
    margin-left: auto;
    flex-shrink: 0;
  }

  /* playerCard 안에서의 meBadge */
  .playerCard .meBadge {
    margin-left: 0;
    margin-top: 0.25rem;
  }

  /* ── 대기 / 나가기 버튼 ────────────────────────────────────────────────── */

  .waitingText {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
    padding: 12px 0;
  }

  .leaveBtn {
    width: 100%;
    padding: 10px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .leaveBtn:hover {
    opacity: 1;
  }

  /* ── numControl disabled ──────────────────────────────────────────────── */

  .numControl button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  ```

- [ ] **Step 2: 빌드 확인**

  ```bash
  npm run build
  ```

  Expected: 오류 없음

- [ ] **Step 3: commit**

  ```bash
  git add src/components/games/Bomb/Bomb.module.css
  git commit -m "feat: add multiplayer lobby and entry styles"
  ```

---

## Task 7: 수동 테스트 체크리스트

개발 서버를 실행하고 아래 시나리오를 순서대로 확인한다.

```bash
npm run dev
```

- [ ] **솔로 모드 회귀 테스트**
  - 기본 탭이 "혼자 하기"인지 확인
  - 기존 플레이어 추가/제거, 게임 시작, 패스, 폭발, 다시 하기가 정상 동작하는지 확인

- [ ] **방 만들기 플로우**
  - "멀티플레이" 탭 클릭
  - 닉네임 입력 없이 "방 만들기" 클릭 → "닉네임을 입력해 주세요." 에러 표시 확인
  - 닉네임 입력 후 "방 만들기" 클릭 → 로비 화면으로 이동 확인
  - 로비에서 방 코드(4자리) 표시 확인
  - "🔗 링크 복사" 클릭 → 클립보드에 `?room=XXXX` 포함 URL이 복사됐는지 확인

- [ ] **방 참가 플로우 (두 번째 탭/기기)**
  - 복사한 링크로 새 브라우저 탭 접속 → 방 코드 자동 입력 + "방 참가하기" 탭 활성화 확인
  - 닉네임 입력 후 "입장하기" 클릭 → 로비에 두 플레이어 모두 표시 확인
  - 첫 번째 탭에서도 두 번째 플레이어가 실시간으로 추가되는지 확인
  - 각자 "나" 뱃지가 자신의 카드에만 표시되는지 확인
  - 방장 카드에 👑 아이콘 표시 확인

- [ ] **시간 설정 권한**
  - 방장 탭: 최소/최대 시간 버튼 조작 가능, 참가자 탭에 즉시 반영 확인
  - 참가자 탭: 버튼 비활성화(opacity 낮음, 클릭 불가) 확인

- [ ] **게임 플로우**
  - 방장이 "게임 시작!" 클릭 → 두 탭 모두 게임 화면 전환 확인
  - 폭탄 보유자의 탭: "💣 패스하기!" 버튼 활성화 확인
  - 비보유자 탭: "상대방의 차례..." 버튼 비활성화 확인
  - 패스 클릭 → 양 탭에서 폭탄 보유자 변경 확인
  - 폭발 후 양 탭 동시에 결과 화면 전환, 패배자 이름 동일 표시 확인
  - 방장 탭: "다시 하기" 버튼 → 로비 복귀 확인
  - 참가자 탭: "다시 하기" 대신 안내 텍스트 표시 확인

- [ ] **방 나가기 / 방 삭제**
  - 참가자가 "나가기" → 로비 플레이어 목록에서 즉시 제거 확인
  - 방장이 "방 나가기" → 참가자 탭에 "방장이 방을 나갔습니다." 메시지 표시 확인
  - Firebase Console에서 `/rooms` 경로가 비어있는지 확인 (데이터 누적 없음)

- [ ] **잘못된 방 코드**
  - "방 참가하기" 탭에서 없는 방 코드 입력 후 입장 → "존재하지 않는 방입니다." 에러 확인
