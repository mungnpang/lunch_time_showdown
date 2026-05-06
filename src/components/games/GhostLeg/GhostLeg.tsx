import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './GhostLeg.module.css';
import { useGhostLegRoom } from '../../../hooks/useGhostLegRoom';

const ROWS = 12;
const COL_WIDTH = 100;
const ROW_HEIGHT = 40;
const PADDING_Y = 20;
const COLORS = ['#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#6366f1'];

type Step = { row: number; col: number };
type PathMetrics = { d: string; length: number; dest: number };
type Mode = 'local' | 'multi';
type EntryTab = 'create' | 'join';

// ─── 순수 함수 ────────────────────────────────────────────────────────────────

function ensureOneWinner(results: string[]): string[] {
  if (results.some(r => r.includes('💣'))) return results;
  if (!results.length) return results;
  const updated = [...results];
  updated[Math.floor(Math.random() * results.length)] = '💣';
  return updated;
}

function buildPath(lines: boolean[][], numParticipants: number, startIndex: number): Step[] {
  if (!lines.length) return [];
  const path: Step[] = [{ row: -1, col: startIndex }];
  let col = startIndex;
  for (let r = 0; r < ROWS; r++) {
    path.push({ row: r, col });
    if (col < numParticipants - 1 && lines[r][col]) { col++; path.push({ row: r, col }); }
    else if (col > 0 && lines[r][col - 1]) { col--; path.push({ row: r, col }); }
  }
  path.push({ row: ROWS, col });
  return path;
}

function computePathMetrics(path: Step[], svgHeight: number): PathMetrics {
  if (!path.length) return { d: '', length: 0, dest: 0 };
  const toY = (row: number) => row === -1 ? 0 : row === ROWS ? svgHeight : row * ROW_HEIGHT + PADDING_Y;
  let d = ''; let length = 0;
  for (let i = 0; i < path.length; i++) {
    const x = path[i].col * COL_WIDTH, y = toY(path[i].row);
    if (i === 0) { d += `M ${x} ${y}`; }
    else {
      d += ` L ${x} ${y}`;
      const px = path[i - 1].col * COL_WIDTH, py = toY(path[i - 1].row);
      length += Math.abs(x - px) + Math.abs(y - py);
    }
  }
  return { d, length, dest: path[path.length - 1].col };
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function GhostLeg() {
  // ── 공통 ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('local');
  const [modeChosen, setModeChosen] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── 로컬 상태 ─────────────────────────────────────────────────────────
  const [participants, setParticipants] = useState<string[]>(['유저 A', '유저 B', '유저 C', '유저 D']);
  const [results, setResults]           = useState<string[]>(['생존', '💣', '생존', '생존']);
  const [lines, setLines]               = useState<boolean[][]>([]);
  const [activePaths, setActivePaths]   = useState<Set<number>>(new Set());
  const [destinations, setDestinations] = useState<Map<number, number>>(new Map());
  const [winnerColors, setWinnerColors] = useState<Map<number, string>>(new Map());
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [tempParticipants, setTempParticipants] = useState<string[]>([]);

  // ── 멀티 상태 ─────────────────────────────────────────────────────────
  const [entryTab, setEntryTab]           = useState<EntryTab>('create');
  const [nicknameInput, setNicknameInput] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [multiError, setMultiError]       = useState('');
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [localHitText, setLocalHitText]   = useState('💣');
  const [localNormalText, setLocalNormalText] = useState('생존');

  const [multiGameData, setMultiGameData] = useState<{
    participants: string[]; lines: boolean[][]; results: string[];
  } | null>(null);

  const activeRoomCodeRef    = useRef<string | null>(null);
  const hadRoomDataRef       = useRef(false);
  const prevPlayStartedAt    = useRef<number | null>(null);
  const activePathsRef       = useRef<Set<number>>(new Set());
  const participantTimersRef = useRef<Map<number, number>>(new Map());
  const staggerTimersRef     = useRef<number[]>([]);
  const processedRevealRef   = useRef<Set<string>>(new Set());

  useEffect(() => { activePathsRef.current = activePaths; }, [activePaths]);
  useEffect(() => { activeRoomCodeRef.current = activeRoomCode; }, [activeRoomCode]);

  const room = useGhostLegRoom(activeRoomCode);

  useEffect(() => {
    return () => {
      participantTimersRef.current.forEach(clearTimeout);
      staggerTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // 초대 링크 자동 입력 + URL에서 모드 복원
  useEffect(() => {
    const codeFromUrl = searchParams.get('room');
    const phaseFromUrl = searchParams.get('phase');
    const modeFromUrl = searchParams.get('mode');
    if (codeFromUrl && !activeRoomCode) {
      setMode('multi'); setModeChosen(true);
      setEntryTab('join'); setRoomCodeInput(codeFromUrl.toUpperCase());
    } else if (phaseFromUrl === 'local') {
      setMode('local'); setModeChosen(true);
    } else if (modeFromUrl === 'multi') {
      setMode('multi'); setModeChosen(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 모드 선택 URL 동기화 (브라우저 뒤로가기로 모드 선택 화면 복귀)
  useEffect(() => {
    const phase = searchParams.get('phase');
    const modeParam = searchParams.get('mode');
    const roomParam = searchParams.get('room');
    if (!phase && !modeParam && !roomParam && modeChosen && !activeRoomCode) {
      setModeChosen(false);
      setMode('local');
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // 멀티: URL 동기화 (브라우저 뒤로가기)
  useEffect(() => {
    const roomInUrl = searchParams.get('room');
    const currentCode = activeRoomCodeRef.current;
    if (!roomInUrl && currentCode) {
      activeRoomCodeRef.current = null;
      setActiveRoomCode(null);
      setNicknameInput(''); setRoomCodeInput(''); setMultiError('');
      hadRoomDataRef.current = false;
      setMultiGameData(null);
      room.leaveRoom(currentCode);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // 멀티: 방장 퇴장
  useEffect(() => {
    if (!activeRoomCode || !hadRoomDataRef.current) return;
    if (!room.isLoading && room.roomData === null) {
      hadRoomDataRef.current = false;
      activeRoomCodeRef.current = null;
      setActiveRoomCode(null);
      setMultiGameData(null);
      setMultiError('방장이 방을 나갔습니다.');
      navigate(-1);
    }
  }, [activeRoomCode, room.isLoading, room.roomData]);

  useEffect(() => { if (room.roomData !== null) hadRoomDataRef.current = true; }, [room.roomData]);

  // 멀티: 텍스트 설정 동기화
  useEffect(() => {
    if (room.roomData?.gameState === 'lobby') {
      setLocalHitText(room.roomData.hitText);
      setLocalNormalText(room.roomData.normalText);
    }
  }, [room.roomData?.hitText, room.roomData?.normalText]);

  // 멀티: 게임 시작 감지 → 로컬 상태 세팅 (애니메이션은 각자 클릭으로 실행)
  useEffect(() => {
    if (mode !== 'multi') return;
    const data = room.roomData;
    if (!data || data.gameState !== 'playing') return;
    if (data.playStartedAt === prevPlayStartedAt.current) return;
    prevPlayStartedAt.current = data.playStartedAt;

    const names = data.playerOrder.map((id: string) => data.players[id]?.name ?? '?');
    const boolLines = (data.lines || []).map((row: number[]) => row.map((v: number) => v === 1));

    setMultiGameData({ participants: names, lines: boolLines, results: data.results });
    setActivePaths(new Set());
    setDestinations(new Map());
    setWinnerColors(new Map());
    processedRevealRef.current = new Set();
  }, [room.roomData, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 멀티: revealed 변화 감지 → 해당 플레이어 애니메이션 실행 (전체 공유)
  useEffect(() => {
    if (mode !== 'multi' || !multiGameData) return;
    const revealed = room.roomData?.revealed;
    const playerOrder = room.roomData?.playerOrder;
    if (!revealed || !playerOrder) return;

    Object.keys(revealed).forEach(playerId => {
      if (processedRevealRef.current.has(playerId)) return;
      processedRevealRef.current.add(playerId);
      const idx = playerOrder.indexOf(playerId);
      if (idx !== -1) playParticipant(idx);
    });
  }, [room.roomData?.revealed, multiGameData, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 로컬: 사다리 관련 ─────────────────────────────────────────────────

  const numParticipants = participants.length;
  const svgWidth  = (numParticipants - 1) * COL_WIDTH;
  const svgHeight = ROWS * ROW_HEIGHT + PADDING_Y * 2;

  const generateLines = useCallback(() => {
    setActivePaths(new Set()); setDestinations(new Map()); setWinnerColors(new Map());
    setResults(prev => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return ensureOneWinner(shuffled);
    });
    const newLines: boolean[][] = Array.from({ length: ROWS }, () => Array(numParticipants - 1).fill(false));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < numParticipants - 1; c++) {
        if (c > 0 && newLines[r][c - 1]) continue;
        if (Math.random() > 0.5) newLines[r][c] = true;
      }
    }
    for (let c = 0; c < numParticipants - 1; c++) {
      let count = newLines.filter(row => row[c]).length;
      let attempts = 0;
      while (count < 3 && attempts < 100) {
        attempts++;
        const r = Math.floor(Math.random() * ROWS);
        if (newLines[r][c]) continue;
        const hasLeft  = c > 0 && newLines[r][c - 1];
        const hasRight = c < numParticipants - 2 && newLines[r][c + 1];
        if (!hasLeft && !hasRight) { newLines[r][c] = true; count++; }
      }
    }
    setLines(newLines);
  }, [numParticipants]);

  useEffect(() => { if (mode === 'local' && modeChosen) generateLines(); }, [generateLines]); // eslint-disable-line react-hooks/exhaustive-deps

  // 렌더에 사용할 실제 데이터 (로컬 vs 멀티)
  const activeParticipants = (mode === 'multi' && multiGameData) ? multiGameData.participants : participants;
  const activeLines        = (mode === 'multi' && multiGameData) ? multiGameData.lines        : lines;
  const activeResults      = (mode === 'multi' && multiGameData) ? multiGameData.results      : results;
  const activeN = activeParticipants.length;
  const activeSvgW = (activeN - 1) * COL_WIDTH;
  const activeSvgH = ROWS * ROW_HEIGHT + PADDING_Y * 2;

  const pathData = useMemo<PathMetrics[]>(
    () => activeParticipants.map((_, i) => computePathMetrics(buildPath(activeLines, activeN, i), activeSvgH)),
    [activeLines, activeN, activeSvgH] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const destColToParticipant = useMemo(() => {
    const map = new Map<number, number>();
    destinations.forEach((destCol, pIdx) => map.set(destCol, pIdx));
    return map;
  }, [destinations]);

  const playParticipant = useCallback((idx: number) => {
    if (activePathsRef.current.has(idx)) return;
    setActivePaths(prev => new Set(prev).add(idx));
    const { dest, length } = pathData[idx];
    const durationMs = length * 1.5;
    const timerId = window.setTimeout(() => {
      participantTimersRef.current.delete(idx);
      setDestinations(prev => new Map(prev).set(idx, dest));
      setWinnerColors(prev => new Map(prev).set(dest, COLORS[idx % COLORS.length]));
      setActivePaths(prev => { const next = new Set(prev); next.delete(idx); return next; });
    }, durationMs);
    participantTimersRef.current.set(idx, timerId);
  }, [pathData]);

  const playAll = useCallback(() => {
    staggerTimersRef.current.forEach(clearTimeout); staggerTimersRef.current = [];
    participants.forEach((_, i) => {
      const t = window.setTimeout(() => playParticipant(i), i * 400);
      staggerTimersRef.current.push(t);
    });
  }, [participants, playParticipant]);

  // ── 로컬: 인원 조작 ───────────────────────────────────────────────────

  const addColumn = () => {
    if (numParticipants >= 8) return;
    setParticipants(p => [...p, `유저 ${String.fromCharCode(65 + p.length)}`]);
    setResults(r => [...r, '생존']);
  };

  const removeColumn = () => {
    if (numParticipants <= 2) return;
    setParticipants(p => p.slice(0, -1));
    setResults(r => ensureOneWinner(r.slice(0, -1)));
  };

  const handleResultChange = (index: number, val: string) => {
    setResults(prev => { const next = [...prev]; next[index] = val; return next; });
  };

  const openBulkEdit = () => {
    if (activePaths.size > 0) return;
    setTempParticipants([...participants]); setIsBulkEditing(true);
  };

  const saveBulkNames = () => {
    if (tempParticipants.every(name => name.trim() !== '')) {
      setParticipants([...tempParticipants]); setIsBulkEditing(false);
    }
  };

  const onModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveBulkNames();
    if (e.key === 'Escape') setIsBulkEditing(false);
  };

  // ── 멀티 핸들러 ───────────────────────────────────────────────────────

  const handleCreateRoom = async () => {
    const name = nicknameInput.trim();
    if (!name) { setMultiError('닉네임을 입력해 주세요.'); return; }
    setIsSubmitting(true); setMultiError('');
    try {
      const code = await room.createRoom(name);
      setActiveRoomCode(code); navigate(`?room=${code}`);
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
    setMultiGameData(null);
    prevPlayStartedAt.current = null;
    await room.leaveRoom(code);
    navigate(-1);
  };

  const handleCopyLink = () => {
    if (!activeRoomCode) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', activeRoomCode);
    navigator.clipboard.writeText(url.toString());
  };

  // ── 모드 선택 화면 ────────────────────────────────────────────────────
  if (!modeChosen) {
    return (
      <div className={styles.container}>
        <div className={styles.setupCenter}>
          <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
            <h2 style={{ textAlign: 'center', marginBottom: 0 }}>사다리 타기</h2>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                className="btn-primary"
                style={{ flex: 1, padding: '18px', fontSize: '1.1rem', borderRadius: '14px' }}
                onClick={() => { setMode('local'); setModeChosen(true); navigate('?phase=local'); }}
              >
                로컬 플레이
              </button>
              <button
                className="btn-primary"
                style={{ flex: 1, padding: '18px', fontSize: '1.1rem', borderRadius: '14px', background: 'rgba(var(--accent-primary-rgb), 0.12)', color: 'var(--accent-secondary)' }}
                onClick={() => { setMode('multi'); setModeChosen(true); navigate('?mode=multi'); }}
              >
                멀티플레이
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  // ── 멀티: 입장 화면 ───────────────────────────────────────────────────
  if (mode === 'multi' && !activeRoomCode) {
    return (
      <div className={styles.container}>
        <div className={styles.setupCenter}>
          <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
            <h2 style={{ textAlign: 'center', marginBottom: 0 }}>사다리 타기</h2>
            <div className={styles.entryTabs}>
              <button className={`${styles.entryTab} ${entryTab === 'create' ? styles.entryTabActive : ''}`}
                onClick={() => { setEntryTab('create'); setMultiError(''); }}>방 만들기</button>
              <button className={`${styles.entryTab} ${entryTab === 'join' ? styles.entryTabActive : ''}`}
                onClick={() => { setEntryTab('join'); setMultiError(''); }}>방 참가하기</button>
            </div>
            {entryTab === 'join' && (
              <input type="text" className={`${styles.multiInput} ${styles.codeInput}`}
                placeholder="방 코드 4자리" value={roomCodeInput}
                onChange={e => { setRoomCodeInput(e.target.value.toUpperCase()); setMultiError(''); }}
                maxLength={4} />
            )}
            <input type="text" className={styles.multiInput} placeholder="내 닉네임 입력"
              value={nicknameInput}
              onChange={e => { setNicknameInput(e.target.value); setMultiError(''); }}
              maxLength={10} />
            {multiError && <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{multiError}</p>}
            <button className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
              onClick={entryTab === 'create' ? handleCreateRoom : handleJoinRoom}
              disabled={isSubmitting}>
              {isSubmitting ? '처리 중...' : entryTab === 'create' ? '방 만들기' : '입장하기'}
            </button>
            <button className={styles.leaveBtn} onClick={() => navigate(-1)}>돌아가기</button>
          </div>
        </div>
      </div>
    );
  }

  // ── 멀티: 로비 ────────────────────────────────────────────────────────
  if (mode === 'multi' && activeRoomCode && room.roomData?.gameState === 'lobby') {
    const { roomData, isHost, orderedPlayers } = room;
    const playerCount = orderedPlayers.length;

    return (
      <div className={styles.container}>
        <div className={styles.setupCenter}>
          <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
            <h2 style={{ textAlign: 'center', marginBottom: 0 }}>사다리 타기</h2>

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

            <div style={{ height: 1, background: 'var(--glass-border)' }} />

            {/* 자리 선택 */}
            {(() => {
              const chosenSlots = roomData?.chosenSlots ?? {};
              const slotToPlayer: Record<number, { id: string; name: string; isMe: boolean }> = {};
              Object.entries(chosenSlots).forEach(([pid, slot]) => {
                const p = orderedPlayers.find(pl => pl.id === pid);
                if (p) slotToPlayer[slot] = p;
              });
              const mySlot = chosenSlots[room.myPlayerId];

              return (
                <div className={styles.slotPickerSection}>
                  <span className={styles.slotPickerLabel}>시작 위치 선택 (선택 안 하면 랜덤)</span>
                  <div className={styles.slotPickerRow}>
                    {Array.from({ length: playerCount }, (_, i) => {
                      const owner = slotToPlayer[i];
                      const isMine = owner?.isMe;
                      const isTaken = !!owner && !isMine;
                      const bgColor = owner ? COLORS[(orderedPlayers.findIndex(p => p.id === owner.id)) % COLORS.length] : undefined;

                      return (
                        <button
                          key={i}
                          className={`${styles.slot} ${isMine ? styles.slotMine : ''} ${isTaken ? styles.slotTaken : ''}`}
                          style={owner ? { background: bgColor + '22', borderColor: bgColor } : undefined}
                          onClick={() => {
                            if (isTaken) return;
                            room.claimSlot(isMine ? null : i);
                          }}
                        >
                          <span className={styles.slotNumber}>{i + 1}번</span>
                          <span className={styles.slotName} style={owner ? { color: bgColor } : { color: 'var(--text-secondary)', fontWeight: 400 }}>
                            {owner ? owner.name : '빈 자리'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {mySlot !== undefined && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                      내 자리: <strong>{mySlot + 1}번</strong> · 다시 누르면 취소
                    </p>
                  )}
                </div>
              );
            })()}

            <div style={{ height: 1, background: 'var(--glass-border)' }} />

            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', opacity: 0.7, margin: 0 }}>
              💡 옵션 설정은 방장만 가능합니다
            </p>

            <div className={styles.textRow}>
              <div className={styles.textSetting}>
                <label>벌칙 텍스트</label>
                <input type="text" className={styles.multiInput} value={localHitText} disabled={!isHost}
                  onChange={e => { setLocalHitText(e.target.value); room.updateTexts(e.target.value, localNormalText); }} />
              </div>
              <div className={styles.textSetting}>
                <label>통과 텍스트</label>
                <input type="text" className={styles.multiInput} value={localNormalText} disabled={!isHost}
                  onChange={e => { setLocalNormalText(e.target.value); room.updateTexts(localHitText, e.target.value); }} />
              </div>
            </div>

            {isHost ? (
              <button className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.25rem' }}
                onClick={() => { if (playerCount < 2) setMultiError('최소 2명이 필요합니다.'); else { setMultiError(''); room.startPlay(); } }}>
                시작하기
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

  // ── 멀티: 게임 (로컬 사다리 화면과 공유) ─────────────────────────────
  const isMultiPlaying = mode === 'multi' && activeRoomCode && room.roomData?.gameState === 'playing';
  const myMultiIdx = isMultiPlaying ? room.orderedPlayers.findIndex(p => p.isMe) : -1;

  // ── 사다리 렌더 (로컬 / 멀티 공유) ───────────────────────────────────
  const ladderBoard = (
    <div className={styles.gameBoard} style={{ alignItems: 'center' }}>
      <div className={styles.participantsRow}>
        {activeParticipants.map((p, i) => {
          const isMyCol = isMultiPlaying && i === myMultiIdx;
          const myPlayerId = isMultiPlaying ? room.myPlayerId : '';
          const alreadyRevealed = isMultiPlaying
            ? !!(room.roomData?.revealed?.[myPlayerId])
            : false;
          const isAnimating = activePaths.has(i);
          const canClick = isMultiPlaying
            ? (isMyCol && !alreadyRevealed && !isAnimating)
            : true;

          return (
            <div key={`p-${i}`} className={styles.playerWrapper} style={{ width: COL_WIDTH }}>
              <div
                className={`${styles.pInput} ${canClick ? styles.clickableInput : ''}`}
                onClick={() => { if (canClick) { if (isMultiPlaying) room.revealPath(); else playParticipant(i); } }}
                style={{
                  background: COLORS[i % COLORS.length],
                  color: 'white',
                  opacity: isMultiPlaying && !isMyCol && !alreadyRevealed && !isAnimating ? 0.45 : 1,
                  outline: isMyCol && !alreadyRevealed && !isAnimating ? `3px solid white` : 'none',
                  outlineOffset: '2px',
                  boxShadow: isMyCol && !alreadyRevealed && !isAnimating ? `0 0 12px ${COLORS[i % COLORS.length]}` : undefined,
                }}
              >
                <span className={styles.userName}>{p}</span>
              </div>
              {isMyCol && !alreadyRevealed && !isAnimating && (
                <span style={{ fontSize: '0.65rem', color: COLORS[i % COLORS.length], fontWeight: 700, marginTop: 4 }}>
                  클릭!
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.svgWrapper} style={{ width: activeSvgW, height: activeSvgH, marginLeft: COL_WIDTH / 2, marginRight: COL_WIDTH / 2 }}>
        <svg width={activeSvgW} height={activeSvgH} className={styles.svg}>
          {activeParticipants.map((_, i) => (
            <line key={`v-${i}`} x1={i * COL_WIDTH} y1={0} x2={i * COL_WIDTH} y2={activeSvgH} stroke="rgba(148,163,184,0.4)" strokeWidth="4" strokeLinecap="round" />
          ))}
          {(activePaths.size > 0 || destinations.size > 0) && activeLines.map((rowArr, r) =>
            rowArr.map((hasLine, c) => hasLine && (
              <line key={`h-${r}-${c}`} x1={c * COL_WIDTH} y1={r * ROW_HEIGHT + PADDING_Y} x2={(c + 1) * COL_WIDTH} y2={r * ROW_HEIGHT + PADDING_Y} stroke="rgba(148,163,184,0.4)" strokeWidth="4" strokeLinecap="round" />
            ))
          )}
          {Array.from(destinations.keys()).map(idx => (
            <path key={`static-${idx}`} d={pathData[idx]?.d ?? ''} fill="none" stroke={COLORS[idx % COLORS.length]} strokeWidth="6" strokeLinecap="round" style={{ opacity: 0.8 }} />
          ))}
          {Array.from(activePaths).map(idx => {
            const { d, length } = pathData[idx] ?? { d: '', length: 0 };
            return (
              <path key={`anim-${idx}`} d={d} fill="none" stroke={COLORS[idx % COLORS.length]} strokeWidth="6" strokeLinecap="round"
                className={styles.animatedPath}
                style={{ strokeDasharray: length, strokeDashoffset: length, animationDuration: `${length * 1.5}ms` }} />
            );
          })}
        </svg>
      </div>

      <div className={styles.resultsRow}>
        {activeResults.map((r, i) => {
          const winnerIndex = destColToParticipant.get(i) ?? null;
          const isHit = r.includes('💣') || r.includes('벌칙');
          const customStyle = winnerColors.has(i)
            ? { background: winnerColors.get(i), color: 'white', borderColor: 'transparent', textShadow: '0 1px 2px rgba(0,0,0,0.2)', zIndex: 10 }
            : {};
          return (
            <div key={`r-${i}`} className={styles.resultWrapper} style={{ width: COL_WIDTH }}>
              <input
                className={`${styles.rInput} ${winnerIndex === null ? styles.normalResult : ''} ${winnerIndex !== null && isHit ? styles.highlightHit : ''}`}
                value={r}
                onChange={(e) => !isMultiPlaying && handleResultChange(i, e.target.value)}
                disabled={activePaths.size > 0 || !!isMultiPlaying}
                style={customStyle}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── 멀티: 게임 화면 ───────────────────────────────────────────────────
  if (isMultiPlaying) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div />
          <div className={styles.mainActions}>
            {room.isHost && (
              <button className="btn-primary" style={{ padding: '12px 20px', fontSize: '1rem', background: '#efd2ff', color: '#9333ea', borderRadius: '12px' }}
                onClick={room.resetToLobby}>
                다시 하기
              </button>
            )}
            <button className="btn-primary" style={{ padding: '12px 20px', fontSize: '0.9rem', background: '#e5e7eb', color: '#374151', borderRadius: '12px' }}
              onClick={handleLeaveRoom}>
              나가기
            </button>
          </div>
        </header>
        {ladderBoard}
      </div>
    );
  }

  // ── 로컬: 메인 화면 ───────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.controlGroup}>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#e5e7eb', color: '#374151', borderRadius: '12px' }}
            onClick={() => navigate(-1)}>
            ← 돌아가기
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#ccfbf1', color: '#0d9488', borderRadius: '12px' }} onClick={addColumn} disabled={numParticipants >= 8}>인원 +</button>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#cfd9ff', color: '#4158d6', borderRadius: '12px' }} onClick={removeColumn} disabled={numParticipants <= 2}>인원 -</button>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#efd2ff', color: '#9333ea', borderRadius: '12px' }} onClick={generateLines}>다시 섞기</button>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#e0e7ff', color: '#4f46e5', borderRadius: '12px' }} onClick={openBulkEdit} disabled={activePaths.size > 0}>이름 바꾸기</button>
          <button className="btn-primary" style={{ padding: '12px 24px', fontSize: '1.1rem', background: '#4f46e5', color: 'white', borderRadius: '12px' }} onClick={playAll}>전체 시작하기</button>
        </div>
      </header>

      {ladderBoard}

      {isBulkEditing && (
        <div className={styles.modalOverlay} onClick={() => setIsBulkEditing(false)}>
          <div className={`${styles.modalContent} ${styles.bulkEditModal}`} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>참가자 이름 변경</h3>
            <div className={styles.bulkEditList}>
              {tempParticipants.map((name, idx) => (
                <div key={`bulk-${idx}`} className={styles.bulkEditItem}>
                  <div className={styles.bulkEditLabel} style={{ background: COLORS[idx % COLORS.length] }}>{idx + 1}</div>
                  <input className={styles.modalInput} value={name}
                    onChange={e => { const next = [...tempParticipants]; next[idx] = e.target.value; setTempParticipants(next); }}
                    onKeyDown={onModalKeyDown} placeholder={`유저 ${idx + 1} 이름`} maxLength={10} autoFocus={idx === 0} />
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button className={`${styles.modalBtn} ${styles.modalCancel}`} onClick={() => setIsBulkEditing(false)}>취소</button>
              <button className={`${styles.modalBtn} ${styles.modalConfirm}`} onClick={saveBulkNames} style={{ background: '#4f46e5', color: 'white' }}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
