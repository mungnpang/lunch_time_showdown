import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './DrawingLots.module.css';
import { useDrawingRoom } from '../../../hooks/useDrawingRoom';

type Card = { id: number; result: string; isFlipped: boolean; isHit: boolean };
type Mode = 'local' | 'multi';
type EntryTab = 'create' | 'join';

export default function DrawingLots() {
  // ── 공통 ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('local');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── 로컬 상태 ─────────────────────────────────────────────────────────
  const [totalCount, setTotalCount] = useState(10);
  const [hitCount, setHitCount] = useState(2);
  const [hitMessage, setHitMessage] = useState('당첨 ✨');
  const [missMessage, setMissMessage] = useState('통과');
  const [cards, setCards] = useState<Card[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [error, setError] = useState('');
  const shuffleTimerRef = useRef<number | null>(null);

  // ── 멀티 상태 ─────────────────────────────────────────────────────────
  const [entryTab, setEntryTab]           = useState<EntryTab>('create');
  const [nicknameInput, setNicknameInput] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [multiError, setMultiError]       = useState('');
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [localTotalCount, setLocalTotalCount] = useState(10);
  const [localHitCount, setLocalHitCount] = useState(1);
  const [localHitMsg, setLocalHitMsg]     = useState('당첨 ✨');
  const [localMissMsg, setLocalMissMsg]   = useState('통과');

  const activeRoomCodeRef = useRef<string | null>(null);
  const hadRoomDataRef    = useRef(false);
  const room = useDrawingRoom(activeRoomCode);

  useEffect(() => { activeRoomCodeRef.current = activeRoomCode; }, [activeRoomCode]);

  useEffect(() => {
    return () => { if (shuffleTimerRef.current) clearTimeout(shuffleTimerRef.current); };
  }, []);

  // 초대 링크 자동 입력
  useEffect(() => {
    const codeFromUrl = searchParams.get('room');
    if (codeFromUrl && !activeRoomCode) {
      setMode('multi');
      setEntryTab('join');
      setRoomCodeInput(codeFromUrl.toUpperCase());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 로컬: URL phase 동기화
  useEffect(() => {
    if (mode !== 'local') return;
    if (searchParams.get('phase') !== 'game' && gameStarted) {
      if (shuffleTimerRef.current) clearTimeout(shuffleTimerRef.current);
      setGameStarted(false); setCards([]); setError('');
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // 멀티: 방장 퇴장 감지
  useEffect(() => {
    if (!activeRoomCode || !hadRoomDataRef.current) return;
    if (!room.isLoading && room.roomData === null) {
      hadRoomDataRef.current = false;
      activeRoomCodeRef.current = null;
      setActiveRoomCode(null);
      setMultiError('방장이 방을 나갔습니다.');
      navigate(-1);
    }
  }, [activeRoomCode, room.isLoading, room.roomData]);

  useEffect(() => { if (room.roomData !== null) hadRoomDataRef.current = true; }, [room.roomData]);

  // 멀티: URL 동기화 (브라우저 뒤로가기)
  useEffect(() => {
    const roomInUrl = searchParams.get('room');
    const currentCode = activeRoomCodeRef.current;
    if (!roomInUrl && currentCode) {
      activeRoomCodeRef.current = null;
      setActiveRoomCode(null);
      setNicknameInput(''); setRoomCodeInput(''); setMultiError('');
      hadRoomDataRef.current = false;
      room.leaveRoom(currentCode);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // 멀티: 방장이 설정 변경 시 로컬 상태 동기화
  useEffect(() => {
    if (room.roomData?.gameState === 'lobby') {
      setLocalTotalCount(room.roomData.totalCount);
      setLocalHitCount(room.roomData.hitCount);
      setLocalHitMsg(room.roomData.hitMessage);
      setLocalMissMsg(room.roomData.missMessage);
    }
  }, [room.roomData?.totalCount, room.roomData?.hitCount, room.roomData?.hitMessage, room.roomData?.missMessage]);

  // ── 로컬 핸들러 ───────────────────────────────────────────────────────

  const startLocalGame = () => {
    if (hitCount >= totalCount || hitCount <= 0 || totalCount < 2) {
      setError('설정값이 올바르지 않습니다.'); return;
    }
    setError(''); setIsShuffling(true); setGameStarted(true);
    navigate('?phase=game');
    const newCards: Card[] = Array.from({ length: totalCount }, (_, i) => ({
      id: i, result: i < hitCount ? hitMessage : missMessage, isFlipped: false, isHit: i < hitCount,
    }));
    for (let i = newCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
    }
    shuffleTimerRef.current = window.setTimeout(() => {
      shuffleTimerRef.current = null; setCards(newCards); setIsShuffling(false);
    }, 800);
  };

  const reshuffleGame = () => {
    if (isShuffling) return;
    setIsShuffling(true); setCards([]);
    const newCards: Card[] = Array.from({ length: totalCount }, (_, i) => ({
      id: i, result: i < hitCount ? hitMessage : missMessage, isFlipped: false, isHit: i < hitCount,
    }));
    for (let i = newCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
    }
    shuffleTimerRef.current = window.setTimeout(() => {
      shuffleTimerRef.current = null; setCards(newCards); setIsShuffling(false);
    }, 800);
  };

  const handleCardClick = (index: number) => {
    if (!gameStarted || isShuffling || cards[index].isFlipped) return;
    setCards(prev => { const next = [...prev]; next[index] = { ...next[index], isFlipped: true }; return next; });
  };

  // ── 멀티 핸들러 ───────────────────────────────────────────────────────

  const handleCreateRoom = async () => {
    const name = nicknameInput.trim();
    if (!name) { setMultiError('닉네임을 입력해 주세요.'); return; }
    setIsSubmitting(true); setMultiError('');
    try {
      const code = await room.createRoom(name);
      setActiveRoomCode(code);
      navigate(`?room=${code}`);
    } catch { setMultiError('방 생성에 실패했습니다.'); }
    finally { setIsSubmitting(false); }
  };

  const handleJoinRoom = async () => {
    const name = nicknameInput.trim();
    const code = roomCodeInput.trim().toUpperCase();
    if (!name)             { setMultiError('닉네임을 입력해 주세요.'); return; }
    if (code.length !== 4) { setMultiError('방 코드는 4자리입니다.'); return; }
    setIsSubmitting(true); setMultiError('');
    const result = await room.joinRoom(code, name);
    if (result.success) {
      setActiveRoomCode(code);
      navigate(`?room=${code}`, { replace: searchParams.get('room') !== null });
    } else { setMultiError(result.error ?? '입장에 실패했습니다.'); }
    setIsSubmitting(false);
  };

  const handleLeaveRoom = async () => {
    if (!activeRoomCode) return;
    const code = activeRoomCode;
    activeRoomCodeRef.current = null;
    setActiveRoomCode(null);
    setNicknameInput(''); setRoomCodeInput(''); setMultiError('');
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

  const handleSettingsChange = async (tc: number, hc: number, hm: string, mm: string) => {
    setLocalTotalCount(tc); setLocalHitCount(hc); setLocalHitMsg(hm); setLocalMissMsg(mm);
    await room.updateSettings(tc, hc, hm, mm);
  };

  // ── 공용 모드 탭 UI ───────────────────────────────────────────────────

  const modeTabs = (
    <div className={styles.modeTabs}>
      <button className={`${styles.modeTab} ${mode === 'local' ? styles.modeTabActive : ''}`} onClick={() => setMode('local')}>
        로컬 플레이
      </button>
      <button className={`${styles.modeTab} ${mode === 'multi' ? styles.modeTabActive : ''}`} onClick={() => setMode('multi')}>
        멀티플레이
      </button>
    </div>
  );

  // ── 멀티: 로딩 ────────────────────────────────────────────────────────
  if (mode === 'multi' && activeRoomCode && room.isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.setupCenter}>
          <div className={`glass-panel ${styles.setupPanel}`}>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>연결 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── 멀티: 입장 ────────────────────────────────────────────────────────
  if (mode === 'multi' && !activeRoomCode) {
    return (
      <div className={styles.container}>
        <div className={styles.setupCenter}>
          <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
            <h2 style={{ textAlign: 'center', marginBottom: 0 }}>제비 뽑기</h2>
            {modeTabs}
            <div className={styles.entryTabs}>
              <button className={`${styles.entryTab} ${entryTab === 'create' ? styles.entryTabActive : ''}`}
                onClick={() => { setEntryTab('create'); setMultiError(''); }}>방 만들기</button>
              <button className={`${styles.entryTab} ${entryTab === 'join' ? styles.entryTabActive : ''}`}
                onClick={() => { setEntryTab('join'); setMultiError(''); }}>방 참가하기</button>
            </div>
            {entryTab === 'join' && (
              <input type="text" className={`${styles.textInput} ${styles.codeInput}`}
                placeholder="방 코드 4자리" value={roomCodeInput}
                onChange={e => { setRoomCodeInput(e.target.value.toUpperCase()); setMultiError(''); }}
                maxLength={4} />
            )}
            <input type="text" className={styles.textInput} placeholder="내 닉네임 입력"
              value={nicknameInput}
              onChange={e => { setNicknameInput(e.target.value); setMultiError(''); }}
              maxLength={10} />
            {multiError && <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{multiError}</p>}
            <button className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
              onClick={entryTab === 'create' ? handleCreateRoom : handleJoinRoom}
              disabled={isSubmitting}>
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

    return (
      <div className={styles.container}>
        <div className={styles.setupCenter}>
          <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
            <h2 style={{ textAlign: 'center', marginBottom: 0 }}>제비 뽑기</h2>

            <div className={styles.roomCodeDisplay}>
              <span className={styles.roomCodeLabel}>방 코드</span>
              <span className={styles.roomCode}>{activeRoomCode}</span>
              <button className={styles.copyLinkBtn} onClick={handleCopyLink}>🔗 복사</button>
            </div>

            <div className={styles.playerList}>
              {orderedPlayers.map(p => (
                <div key={p.id} className={styles.playerChip}>
                  <span>{roomData!.hostId === p.id ? '👑' : '✋'}</span>
                  <span className={styles.playerChipName}>{p.name}</span>
                  {p.isMe && <span className={styles.meBadge}>나</span>}
                </div>
              ))}
            </div>

            <div className={styles.divider} />

            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', opacity: 0.7, margin: 0 }}>
              💡 옵션 설정은 방장만 가능합니다
            </p>

            <div className={styles.inputGroup}>
              <label>총 제비 개수</label>
              <div className={styles.numControl}>
                <button type="button" disabled={!isHost}
                  onClick={() => handleSettingsChange(Math.max(2, localTotalCount - 1), Math.min(localHitCount, localTotalCount - 2), localHitMsg, localMissMsg)}>-</button>
                <input type="number" readOnly value={localTotalCount} />
                <button type="button" disabled={!isHost}
                  onClick={() => handleSettingsChange(Math.min(100, localTotalCount + 1), localHitCount, localHitMsg, localMissMsg)}>+</button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>당첨 개수</label>
              <div className={styles.numControl}>
                <button type="button" disabled={!isHost}
                  onClick={() => handleSettingsChange(localTotalCount, Math.max(1, localHitCount - 1), localHitMsg, localMissMsg)}>-</button>
                <input type="number" readOnly value={localHitCount} />
                <button type="button" disabled={!isHost}
                  onClick={() => handleSettingsChange(localTotalCount, Math.min(localTotalCount - 1, localHitCount + 1), localHitMsg, localMissMsg)}>+</button>
              </div>
            </div>

            <div className={styles.textInputGroup}>
              <label>당첨 결과 텍스트</label>
              <input type="text" className={styles.textInput} value={localHitMsg} disabled={!isHost}
                onChange={e => handleSettingsChange(localTotalCount, localHitCount, e.target.value, localMissMsg)} />
            </div>

            <div className={styles.textInputGroup}>
              <label>통과 결과 텍스트</label>
              <input type="text" className={styles.textInput} value={localMissMsg} disabled={!isHost}
                onChange={e => handleSettingsChange(localTotalCount, localHitCount, localHitMsg, e.target.value)} />
            </div>

            {isHost ? (
              <button className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.25rem' }}
                onClick={() => { if (orderedPlayers.length < 2) setMultiError('최소 2명이 필요합니다.'); else room.startGame(); }}>
                시작
              </button>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '12px 0' }}>
                방장이 게임을 시작하면 시작됩니다...
              </p>
            )}
            {multiError && <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{multiError}</p>}
            <button className={styles.leaveBtn} onClick={handleLeaveRoom}>방 나가기</button>
          </div>
        </div>
      </div>
    );
  }

  // ── 멀티: 게임 ────────────────────────────────────────────────────────
  if (mode === 'multi' && activeRoomCode && room.roomData?.gameState === 'playing') {
    const { roomData, isHost, orderedPlayers, cards: multiCards, currentPlayerId, isMyTurn, allFlipped } = room;
    const currentPlayerName = orderedPlayers.find(p => p.id === currentPlayerId)?.name ?? '?';
    const flippedCount = multiCards.filter(c => c.isFlipped).length;

    return (
      <div className={styles.container}>
        <div className={`${styles.gamePanel} animate-fade-in`}>

          <div className={styles.gameHeader}>
            <div>
              <h3>총 {roomData!.totalCount}개 중 당첨 {roomData!.hitCount}개</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                {flippedCount} / {multiCards.length} 오픈됨
              </p>
            </div>
            {isHost && allFlipped && (
              <button className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.9rem' }}
                onClick={room.resetToLobby}>
                다시 하기
              </button>
            )}
          </div>

          {/* 순서 표시 */}
          {!allFlipped && (
            <div style={{
              textAlign: 'center', padding: '1rem',
              background: isMyTurn ? 'rgba(236, 72, 153, 0.1)' : 'rgba(var(--accent-primary-rgb), 0.05)',
              borderRadius: '16px', border: isMyTurn ? '1px solid rgba(236,72,153,0.3)' : '1px solid var(--glass-border)',
              transition: 'all 0.3s',
            }}>
              {isMyTurn ? (
                <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-primary)', margin: 0 }}>
                  내 차례! 카드를 선택하세요
                </p>
              ) : (
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{currentPlayerName}</strong>의 차례
                </p>
              )}
            </div>
          )}

          {allFlipped && (() => {
            const winners = Array.from(
              new Set(multiCards.filter(c => c.isHit && c.flippedBy).map(c => c.flippedBy!))
            ).map(id => orderedPlayers.find(p => p.id === id)?.name ?? '?');
            return (
              <div style={{ textAlign: 'center', padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>당첨자</p>
                <p style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--accent-primary)', margin: 0 }}>
                  {winners.join(', ')}
                </p>
                {!isHost && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    방장이 다시 시작할 수 있습니다
                  </p>
                )}
              </div>
            );
          })()}

          {/* 카드 그리드 */}
          <div className={styles.cardsGrid}>
            {multiCards.map((card, idx) => {
              const flipperName = card.flippedBy
                ? (orderedPlayers.find(p => p.id === card.flippedBy)?.name ?? '?')
                : null;
              const canFlip = isMyTurn && !card.isFlipped;
              return (
                <div
                  key={idx}
                  className={`${styles.card} ${card.isFlipped ? styles.flipped : ''}`}
                  style={{ cursor: canFlip ? 'pointer' : card.isFlipped ? 'default' : 'not-allowed', opacity: !card.isFlipped && !isMyTurn && !allFlipped ? 0.6 : 1 }}
                  onClick={() => canFlip && room.flipCard(idx)}
                >
                  <div className={styles.cardInner}>
                    <div className={styles.cardFront}>
                      <span className={styles.cardNumber}>{idx + 1}</span>
                    </div>
                    <div className={`${styles.cardBack} ${card.isHit ? styles.cardHit : styles.cardMiss}`}>
                      <span>{card.isHit ? roomData!.hitMessage : roomData!.missMessage}</span>
                      {flipperName && (
                        <span style={{ fontSize: '0.72rem', opacity: 0.75, marginTop: '0.6rem', display: 'block', lineHeight: 1.3 }}>
                          {flipperName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button className={styles.leaveBtn} onClick={handleLeaveRoom}>나가기</button>
        </div>
      </div>
    );
  }

  // ── 로컬: 설정 ────────────────────────────────────────────────────────
  if (!gameStarted) {
    return (
      <div className={styles.container}>
        <div className={styles.setupCenter}>
          <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
            <h2 style={{ marginBottom: 0, textAlign: 'center' }}>제비 뽑기 설정</h2>
            {modeTabs}

            <div className={styles.inputGroup}>
              <label>총 제비 개수</label>
              <div className={styles.numControl}>
                <button type="button" onClick={() => { setError(''); setTotalCount(c => Math.max(2, c - 1)); }}>-</button>
                <input type="number" readOnly value={totalCount} />
                <button type="button" onClick={() => { setError(''); setTotalCount(c => Math.min(100, c + 1)); }}>+</button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>당첨(혹은 벌칙) 개수</label>
              <div className={styles.numControl}>
                <button type="button" onClick={() => { setError(''); setHitCount(c => Math.max(1, c - 1)); }}>-</button>
                <input type="number" readOnly value={hitCount} />
                <button type="button" onClick={() => { setError(''); setHitCount(c => Math.min(totalCount - 1, c + 1)); }}>+</button>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.textInputGroup}>
              <label>당첨 결과 텍스트</label>
              <input type="text" value={hitMessage} onChange={(e) => setHitMessage(e.target.value)} className={styles.textInput} />
            </div>

            <div className={styles.textInputGroup}>
              <label>통과 결과 텍스트</label>
              <input type="text" value={missMessage} onChange={(e) => setMissMessage(e.target.value)} className={styles.textInput} />
            </div>

            {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{error}</p>}
            <button className="btn-primary" style={{ width: '100%', padding: '16px' }} onClick={startLocalGame}>
              게임 시작!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 로컬: 게임 ────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <div className={`${styles.gamePanel} animate-fade-in`}>
        <div className={styles.gameHeader}>
          <div>
            <h3>총 {totalCount}개 중 당첨 {hitCount}개</h3>
            <p style={{ color: 'var(--text-secondary)' }}>카드를 클릭하여 결과를 확인하세요</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.9rem' }} onClick={reshuffleGame} disabled={isShuffling}>
              다시 섞기
            </button>
            <button className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.9rem' }} onClick={() => navigate(-1)}>
              다시 설정하기
            </button>
          </div>
        </div>

        {isShuffling ? (
          <div className={styles.shufflingDisplay}>
            <div className={styles.spinner} />
            <p>제비 섞는 중...</p>
          </div>
        ) : (
          <div className={styles.cardsGrid}>
            {cards.map((card, idx) => (
              <div key={card.id} className={`${styles.card} ${card.isFlipped ? styles.flipped : ''}`} onClick={() => handleCardClick(idx)}>
                <div className={styles.cardInner}>
                  <div className={styles.cardFront}><span className={styles.cardNumber}>{idx + 1}</span></div>
                  <div className={`${styles.cardBack} ${card.isHit ? styles.cardHit : styles.cardMiss}`}>{card.result}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
