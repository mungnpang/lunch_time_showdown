# 폭탄 돌리기 멀티플레이어 설계 문서

**날짜:** 2026-04-30  
**대상 게임:** 폭탄 돌리기 (`src/components/games/Bomb/`)  
**목표:** Firebase Realtime Database를 이용해 여러 기기가 같은 방을 공유하며 게임 진행

---

## 1. 아키텍처 개요

```
[기기 A (방장)]          [Firebase RTDB]          [기기 B, C, ...]
     │                        │                        │
     ├── 방 생성 ─────────────►│                        │
     │                        │◄── 방 참가 ─────────────┤
     │                        │                        │
     ├── 플레이어 추가 ────────►│──── 실시간 sync ───────►│
     ├── 게임 시작 ────────────►│──── gameState 변경 ────►│
     ├── 패스 ────────────────►│──── currentHolder ─────►│
     └── 폭발 기록 ────────────►│──── exploded ──────────►│
```

- 백엔드 서버 코드 없음 — Firebase SDK를 클라이언트에서 직접 사용
- 방장 탭 종료 시 `onDisconnect().remove()`로 방 자동 삭제 → DB 레코드 누적 없음

---

## 2. Firebase 데이터 구조

```
/rooms/{roomCode}/
  hostId: string                    # 방장 playerId
  gameState: 'lobby' | 'playing' | 'exploded'
  minTime: number                   # 최소 시간 (초)
  maxTime: number                   # 최대 시간 (초)
  currentHolderPlayerId: string     # 현재 폭탄 보유자 playerId
  passCount: number
  loserPlayerId: string | null
  bombExplodesAt: number            # 타임스탬프 (ms). 0 = 미설정
  playerOrder: string[]             # 게임 시작 시 확정되는 playerId 배열
  players: {
    [playerId]: {
      name: string                  # 사용자가 직접 입력한 닉네임
      joinedAt: number              # 입장 시각 (정렬용)
    }
  }
```

**방 코드:** 혼동 없는 문자 조합 4자리 (예: `ABCD`, `3K7M`) — `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` 중 무작위 선택

**playerId:** `crypto.randomUUID()`로 생성, `sessionStorage`에 저장. 페이지 새로고침 시 유지, 탭 종료 시 소멸.

**연결 해제 처리:**
- 방장: `onDisconnect().remove()` → `/rooms/{roomCode}` 전체 삭제
- 참가자: `onDisconnect().remove()` → `/rooms/{roomCode}/players/{playerId}` 만 삭제

---

## 3. UI 화면 흐름

```
Bomb.tsx 진입
  └─ [혼자 하기] [멀티플레이] 탭
        │
        ├─ 혼자 하기 → 기존 솔로 플로우 (변경 없음)
        │
        └─ 멀티플레이
              ├─ [방 만들기]
              │     └─ 닉네임 입력 → 방 생성 → 로비 (방장)
              │
              └─ [방 참가하기]  ← ?room=XXXX URL 접근 시 코드 자동 입력
                    └─ 방 코드 입력 + 닉네임 입력 → 로비 (참가자)

로비
  ├─ 방 코드 크게 표시
  ├─ 링크 복사 버튼 (현재 URL + ?room=XXXX)
  ├─ 접속 중인 플레이어 목록 (실시간 업데이트)
  ├─ 최소/최대 시간 설정
  │     ├─ 방장: 조작 가능
  │     └─ 참가자: 읽기 전용
  └─ [게임 시작] 버튼
        ├─ 방장만 표시, 참가자에게는 "방장이 게임을 시작하면 시작됩니다" 안내
        └─ 2명 이상일 때 활성화

게임 화면 (기존 UI 유지 + 멀티플레이 차이점)
  ├─ 내 플레이어 카드에 "나" 뱃지 표시
  ├─ 패스 버튼: 현재 보유자 기기에서만 활성화 (나머지는 비활성화)
  └─ 폭발 시 모든 기기 동시 전환

결과 화면
  ├─ [다시 하기] — 방장만, 로비로 복귀 (players/settings 유지)
  └─ [나가기] — 모두 사용 가능, Firebase에서 본인 player 항목 삭제 후 초기 화면으로
```

---

## 4. 폭탄 타이머 동기화

1. 방장이 게임 시작 시 `bombExplodesAt = Date.now() + 랜덤ms` 를 Firebase에 기록
2. 모든 기기는 이 값을 읽어 `setTimeout(bombExplodesAt - Date.now())` 로 로컬 타이머 설정
3. 타이머 만료 시 해당 기기가 Firebase에 `gameState: 'exploded'`, `loserPlayerId: currentHolderPlayerId` 기록
4. 여러 기기가 거의 동시에 쓰더라도 동일한 `currentHolderPlayerId`를 쓰므로 결과 일치 (멱등성)

---

## 5. 권한 요약

| 액션 | 방장 | 참가자 |
|---|---|---|
| 시간 설정 변경 | ✅ | ❌ (읽기만) |
| 게임 시작 | ✅ | ❌ |
| 패스 | 본인 차례일 때만 | 본인 차례일 때만 |
| 다시 하기 | ✅ | ❌ |
| 나가기 | ✅ (방 전체 삭제) | ✅ (본인만 삭제) |

---

## 6. 변경 파일 목록

| 파일 | 작업 |
|---|---|
| `src/lib/firebase.ts` | 신규 — Firebase 초기화 |
| `src/hooks/useGameRoom.ts` | 신규 — 방 생성/입장/상태 동기화 커스텀 훅 (URL `?room=` 파라미터 파싱 포함) |
| `.env` | 신규 — Firebase config 환경변수 |
| `.env.example` | 신규 — 환경변수 템플릿 |
| `src/components/games/Bomb/Bomb.tsx` | 수정 — 멀티플레이 UI 통합 |
| `src/components/games/Bomb/Bomb.module.css` | 수정 — 로비, 방 코드 UI 스타일 추가 |

---

## 7. Firebase 설정 (사용자 작업)

구현 전 사용자가 직접 수행해야 하는 단계:

1. [Firebase Console](https://console.firebase.google.com/) 에서 새 프로젝트 생성
2. **Realtime Database** 활성화 (테스트 모드로 시작, 이후 보안 규칙 적용)
3. 웹 앱 등록 후 config 값을 `.env` 에 입력

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

**권장 보안 규칙:**
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

## 8. 비용 예측

| 항목 | 무료 한도 | 게임 1판 소비량 | 월 무료 가능 판수 |
|---|---|---|---|
| 동시 접속 | 100명 | 최대 8명 | — |
| 저장 용량 | 1 GB | ~2 KB (자동 삭제) | — |
| 데이터 전송 | 10 GB/월 | ~30 KB | **약 33만 판** |

---

## 9. 미구현 (추후 고려)

- 실시간 채팅 / 이모지 반응 — 필요성 느낄 때 추가
- 관전자 모드 (플레이어가 아닌 참가)
- 방장 위임 기능
