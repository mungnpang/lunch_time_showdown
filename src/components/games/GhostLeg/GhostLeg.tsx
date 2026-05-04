import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styles from './GhostLeg.module.css';

const ROWS = 12;
const COL_WIDTH = 100;
const ROW_HEIGHT = 40;
const PADDING_Y = 20;
const COLORS = ['#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#6366f1'];

type Step = { row: number; col: number };
type PathMetrics = { d: string; length: number; dest: number };

// ─── 모듈 레벨 순수 함수 ──────────────────────────────────────────────────────

function ensureOneWinner(results: string[]): string[] {
  if (results.some(r => r.includes('💣'))) return results;
  if (results.length === 0) return results;
  const updated = [...results];
  updated[Math.floor(Math.random() * results.length)] = '💣';
  return updated;
}

function buildPath(lines: boolean[][], numParticipants: number, startIndex: number): Step[] {
  if (lines.length === 0) return [];
  const path: Step[] = [{ row: -1, col: startIndex }];
  let col = startIndex;

  for (let r = 0; r < ROWS; r++) {
    path.push({ row: r, col });
    if (col < numParticipants - 1 && lines[r][col]) {
      col++;
      path.push({ row: r, col });
    } else if (col > 0 && lines[r][col - 1]) {
      col--;
      path.push({ row: r, col });
    }
  }
  path.push({ row: ROWS, col });
  return path;
}

function computePathMetrics(path: Step[], svgHeight: number): PathMetrics {
  if (!path.length) return { d: '', length: 0, dest: 0 };

  let d = '';
  let length = 0;

  const toY = (row: number) =>
    row === -1 ? 0 : row === ROWS ? svgHeight : row * ROW_HEIGHT + PADDING_Y;

  for (let i = 0; i < path.length; i++) {
    const x = path[i].col * COL_WIDTH;
    const y = toY(path[i].row);
    if (i === 0) {
      d += `M ${x} ${y}`;
    } else {
      d += ` L ${x} ${y}`;
      const prevX = path[i - 1].col * COL_WIDTH;
      const prevY = toY(path[i - 1].row);
      length += Math.abs(x - prevX) + Math.abs(y - prevY);
    }
  }

  return { d, length, dest: path[path.length - 1].col };
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function GhostLeg() {
  const [participants, setParticipants] = useState<string[]>(['유저 A', '유저 B', '유저 C', '유저 D']);
  const [results, setResults]           = useState<string[]>(['생존', '💣', '생존', '생존']);
  const [lines, setLines]               = useState<boolean[][]>([]);
  const [activePaths, setActivePaths]   = useState<Set<number>>(new Set());
  const [destinations, setDestinations] = useState<Map<number, number>>(new Map());
  const [winnerColors, setWinnerColors] = useState<Map<number, string>>(new Map());
  const [isBulkEditing, setIsBulkEditing]       = useState(false);
  const [tempParticipants, setTempParticipants]  = useState<string[]>([]);

  // ref로 activePaths 최신값 추적 (stale closure 방지)
  const activePathsRef = useRef<Set<number>>(new Set());
  useEffect(() => { activePathsRef.current = activePaths; }, [activePaths]);

  // 타이머 ref — 언마운트 시 일괄 정리
  const participantTimersRef = useRef<Map<number, number>>(new Map());
  const staggerTimersRef     = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      participantTimersRef.current.forEach(clearTimeout);
      staggerTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const numParticipants = participants.length;
  const svgWidth  = (numParticipants - 1) * COL_WIDTH;
  const svgHeight = ROWS * ROW_HEIGHT + PADDING_Y * 2;

  // ── 사다리 생성 ─────────────────────────────────────────────────────────────
  const generateLines = useCallback(() => {
    setActivePaths(new Set());
    setDestinations(new Map());
    setWinnerColors(new Map());
    setResults(prev => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return ensureOneWinner(shuffled);
    });

    const newLines: boolean[][] = Array.from({ length: ROWS }, () =>
      Array(numParticipants - 1).fill(false)
    );

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
        const hasLeft  = c > 0                    && newLines[r][c - 1];
        const hasRight = c < numParticipants - 2  && newLines[r][c + 1];
        if (!hasLeft && !hasRight) { newLines[r][c] = true; count++; }
      }
    }
    setLines(newLines);
  }, [numParticipants]);

  useEffect(() => { generateLines(); }, [generateLines]);

  // ── 경로 데이터 메모이제이션 (lines/participants 변경 시에만 재계산) ─────────
  const pathData = useMemo<PathMetrics[]>(
    () => participants.map((_, i) => computePathMetrics(buildPath(lines, numParticipants, i), svgHeight)),
    [lines, numParticipants, svgHeight]
  );

  // 도착 컬럼 → 참가자 인덱스 역방향 조회 (O(1))
  const destColToParticipant = useMemo(() => {
    const map = new Map<number, number>();
    destinations.forEach((destCol, participantIdx) => map.set(destCol, participantIdx));
    return map;
  }, [destinations]);

  // ── 게임 플레이 ─────────────────────────────────────────────────────────────
  const playParticipant = useCallback((idx: number) => {
    if (activePathsRef.current.has(idx)) return;

    setActivePaths(prev => new Set(prev).add(idx));

    const { dest, length } = pathData[idx];
    const durationMs = length * 1.5;

    const timerId = window.setTimeout(() => {
      participantTimersRef.current.delete(idx);
      setDestinations(prev => new Map(prev).set(idx, dest));
      setWinnerColors(prev => new Map(prev).set(dest, COLORS[idx % COLORS.length]));
      setActivePaths(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }, durationMs);
    participantTimersRef.current.set(idx, timerId);
  }, [pathData]);

  const playAll = useCallback(() => {
    staggerTimersRef.current.forEach(clearTimeout);
    staggerTimersRef.current = [];
    participants.forEach((_, i) => {
      const t = window.setTimeout(() => playParticipant(i), i * 400);
      staggerTimersRef.current.push(t);
    });
  }, [participants, playParticipant]);

  // ── 인원 조작 ─────────────────────────────────────────────────────────────
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

  // ── 이름 일괄 수정 모달 ──────────────────────────────────────────────────
  const openBulkEdit = () => {
    if (activePaths.size > 0) return;
    setTempParticipants([...participants]);
    setIsBulkEditing(true);
  };

  const saveBulkNames = () => {
    if (tempParticipants.every(name => name.trim() !== '')) {
      setParticipants([...tempParticipants]);
      setIsBulkEditing(false);
    }
  };

  const handleTempNameChange = (idx: number, name: string) => {
    setTempParticipants(prev => { const next = [...prev]; next[idx] = name; return next; });
  };

  const onModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveBulkNames();
    if (e.key === 'Escape') setIsBulkEditing(false);
  };

  // ── 렌더 ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.controlGroup}>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#ccfbf1', color: '#0d9488', borderRadius: '12px' }} onClick={addColumn} disabled={numParticipants >= 8}>인원 +</button>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#cfd9ff', color: '#4158d6', borderRadius: '12px' }} onClick={removeColumn} disabled={numParticipants <= 2}>인원 -</button>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#efd2ff', color: '#9333ea', borderRadius: '12px' }} onClick={generateLines}>다시 섞기</button>
        </div>
        <div className={styles.mainActions}>
          <button
            className="btn-primary"
            style={{ padding: '12px 20px', fontSize: '1rem', background: '#e0e7ff', color: '#4f46e5', borderRadius: '12px' }}
            onClick={openBulkEdit}
            disabled={activePaths.size > 0}
          >
            이름 바꾸기
          </button>
          <button className="btn-primary" style={{ padding: '12px 24px', fontSize: '1.1rem', background: '#4f46e5', color: 'white', borderRadius: '12px' }} onClick={playAll}>전체 시작하기</button>
        </div>
      </header>

      <div className={styles.gameBoard} style={{ alignItems: 'center' }}>
        {/* 참가자 헤더 */}
        <div className={styles.participantsRow}>
          {participants.map((p, i) => (
            <div key={`p-${i}`} className={styles.playerWrapper} style={{ width: COL_WIDTH }}>
              <div
                className={`${styles.pInput} ${styles.clickableInput}`}
                onClick={() => playParticipant(i)}
                style={{ background: COLORS[i % COLORS.length], color: 'white' }}
                title={activePaths.has(i) ? '진행 중' : '클릭해서 출발!'}
              >
                <span className={styles.userName}>{p}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 사다리 SVG */}
        <div className={styles.svgWrapper} style={{ width: svgWidth, height: svgHeight, marginLeft: COL_WIDTH / 2, marginRight: COL_WIDTH / 2 }}>
          <svg width={svgWidth} height={svgHeight} className={styles.svg}>
            {/* 세로선 */}
            {participants.map((_, i) => (
              <line key={`v-${i}`} x1={i * COL_WIDTH} y1={0} x2={i * COL_WIDTH} y2={svgHeight} stroke="rgba(148,163,184,0.4)" strokeWidth="4" strokeLinecap="round" />
            ))}

            {/* 가로선 (한 명 이상 출발 후 공개) */}
            {activePaths.size > 0 && lines.map((rowArr, r) =>
              rowArr.map((hasLine, c) => hasLine && (
                <line key={`h-${r}-${c}`} x1={c * COL_WIDTH} y1={r * ROW_HEIGHT + PADDING_Y} x2={(c + 1) * COL_WIDTH} y2={r * ROW_HEIGHT + PADDING_Y} stroke="rgba(148,163,184,0.4)" strokeWidth="4" strokeLinecap="round" />
              ))
            )}

            {/* 완료된 경로 (고정) */}
            {Array.from(destinations.keys()).map(idx => (
              <path key={`static-${idx}`} d={pathData[idx]?.d ?? ''} fill="none" stroke={COLORS[idx % COLORS.length]} strokeWidth="6" strokeLinecap="round" style={{ opacity: 0.8 }} />
            ))}

            {/* 진행 중 경로 (애니메이션) */}
            {Array.from(activePaths).map(idx => {
              const { d, length } = pathData[idx] ?? { d: '', length: 0 };
              return (
                <path
                  key={`anim-${idx}`}
                  d={d}
                  fill="none"
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth="6"
                  strokeLinecap="round"
                  className={styles.animatedPath}
                  style={{ strokeDasharray: length, strokeDashoffset: length, animationDuration: `${length * 1.5}ms` }}
                />
              );
            })}
          </svg>
        </div>

        {/* 결과 푸터 */}
        <div className={styles.resultsRow}>
          {results.map((r, i) => {
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
                  onChange={(e) => handleResultChange(i, e.target.value)}
                  disabled={activePaths.size > 0}
                  style={customStyle}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 이름 일괄 수정 모달 */}
      {isBulkEditing && (
        <div className={styles.modalOverlay} onClick={() => setIsBulkEditing(false)}>
          <div className={`${styles.modalContent} ${styles.bulkEditModal}`} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>참가자 이름 변경</h3>
            <div className={styles.bulkEditList}>
              {tempParticipants.map((name, idx) => (
                <div key={`bulk-${idx}`} className={styles.bulkEditItem}>
                  <div className={styles.bulkEditLabel} style={{ background: COLORS[idx % COLORS.length] }}>{idx + 1}</div>
                  <input
                    className={styles.modalInput}
                    value={name}
                    onChange={e => handleTempNameChange(idx, e.target.value)}
                    onKeyDown={onModalKeyDown}
                    placeholder={`유저 ${idx + 1} 이름`}
                    maxLength={10}
                    autoFocus={idx === 0}
                  />
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
