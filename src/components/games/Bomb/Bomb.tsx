import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './Bomb.module.css';
import { useGameRoom } from '../../../hooks/useGameRoom';

type GameState  = 'setup' | 'playing' | 'exploded';
type Mode       = 'solo' | 'multi';
type EntryTab   = 'create' | 'join';

export default function Bomb() {

  // ── 솔로 상태 ─────────────────────────────────────────────────────────
  const [playerInput, setPlayerInput] = useState('');
  const [players, setPlayers]         = useState<string[]>(['플레이어 1', '플레이어 2', '플레이어 3', '플레이어 4']);
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
  const [toast, setToast]                 = useState('');

  const room = useGameRoom(activeRoomCode);
  const hadRoomDataRef    = useRef(false);
  const activeRoomCodeRef = useRef<string | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // activeRoomCode ref 동기화
  useEffect(() => { activeRoomCodeRef.current = activeRoomCode; }, [activeRoomCode]);

  // ── 효과 ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // 스페이스바 / 엔터 키로 패스
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      if (mode === 'multi' && room.isMyTurn) {
        room.passBomb();
      } else if (mode === 'solo' && gameStateRef.current === 'playing') {
        passSoloBomb();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, room]);

  // URL ?room= 파라미터 자동 처리 (초기 마운트)
  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setMode('multi');
      setEntryTab('join');
      setRoomCodeInput(roomParam.toUpperCase());
    }
  }, []);

  // 방 데이터 수신 여부 추적
  useEffect(() => {
    if (room.roomData !== null) hadRoomDataRef.current = true;
  }, [room.roomData]);

  // 방장 퇴장 감지
  useEffect(() => {
    if (activeRoomCode && !room.isLoading && room.roomData === null && hadRoomDataRef.current) {
      hadRoomDataRef.current = false;
      activeRoomCodeRef.current = null;
      setActiveRoomCode(null);
      setMultiError('방장이 방을 나갔습니다.');
      navigate(-1);
    }
  }, [activeRoomCode, room.isLoading, room.roomData]);

  // URL 변경 동기화 (브라우저 뒤로가기 처리)
  useEffect(() => {
    const roomInUrl  = searchParams.get('room');
    const phaseInUrl = searchParams.get('phase');
    const currentCode = activeRoomCodeRef.current;

    // 멀티: URL에서 room이 사라지면 방 나가기
    if (!roomInUrl && currentCode) {
      activeRoomCodeRef.current = null;
      setActiveRoomCode(null);
      setNicknameInput('');
      setRoomCodeInput('');
      setMultiError('');
      hadRoomDataRef.current = false;
      room.leaveRoom(currentCode);
    }

    // 솔로: URL에서 phase가 사라지면 게임 초기화
    if (!phaseInUrl && (gameStateRef.current === 'playing' || gameStateRef.current === 'exploded')) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      gameStateRef.current = 'setup';
      setGameState('setup');
      setLoserIndex(null);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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
    navigate('?phase=game');
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
    navigate(-1);
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
      navigate(`?room=${code}`);
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
      // 초대 링크로 들어온 경우 URL에 이미 room이 있으므로 replace로 중복 항목 방지
      navigate(`?room=${code}`, { replace: searchParams.get('room') !== null });
    } else {
      setMultiError(result.error ?? '입장에 실패했습니다.');
    }
    setIsSubmitting(false);
  };

  const handleLeaveRoom = async () => {
    if (!activeRoomCode) return;
    const code = activeRoomCode;
    // 상태를 먼저 초기화해서 URL 동기화 효과의 이중 호출 방지
    activeRoomCodeRef.current = null;
    setActiveRoomCode(null);
    setNicknameInput('');
    setRoomCodeInput('');
    setMultiError('');
    hadRoomDataRef.current = false;
    await room.leaveRoom(code);
    navigate(-1);
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
        로컬 플레이
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
        <div className={styles.setupCenter}>
          <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>연결 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── 멀티: 입장 화면 ───────────────────────────────────────────────────
  if (mode === 'multi' && !activeRoomCode) {
    return (
      <div className={styles.container}>
        <div className={styles.setupCenter}>
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
        {toast && (
          <div style={{
            position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(30, 20, 10, 0.88)', color: 'white',
            padding: '12px 20px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 500,
            zIndex: 9999, whiteSpace: 'nowrap',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}>
            {toast}
          </div>
        )}
        <div className={styles.setupCenter}>
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
                onClick={() => {
                  if (playerCount < 2) {
                    setToast('게임 시작을 위해 최소 2명이 필요합니다');
                    setTimeout(() => setToast(''), 2500);
                  } else {
                    room.startGame();
                  }
                }}
              >
                시작
              </button>
            ) : (
              <p className={styles.waitingText}>방장이 게임을 시작하면 시작됩니다...</p>
            )}

            <button className={styles.leaveBtn} onClick={handleLeaveRoom}>
              방 나가기
            </button>
          </div>
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
              {isMyTurn
                ? '💣 패스하기!'
                : `${orderedPlayers.find(p => p.isCurrent)?.name ?? '?'}의 차례`}
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
        <div className={styles.setupCenter}>
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
