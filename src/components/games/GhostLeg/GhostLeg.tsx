import { useState, useEffect } from 'react';
import styles from './GhostLeg.module.css';

const ROWS = 12;
const COLORS = ['#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#6366f1'];

type Step = { row: number, col: number };
type Path = Step[];

export default function GhostLeg() {
  const [participants, setParticipants] = useState<string[]>(['유저 A', '유저 B', '유저 C', '유저 D']);
  // 기본값을 생존과 벌칙/당첨(폭탄 1개)으로 세팅
  const [results, setResults] = useState<string[]>(['생존', '💣', '생존', '생존']);
  
  const [lines, setLines] = useState<boolean[][]>([]);
  const [activePaths, setActivePaths] = useState<Set<number>>(new Set());
  const [destinations, setDestinations] = useState<Map<number, number>>(new Map());
  // 결과 인덱스별 도달한 유저의 색상 저장
  const [winnerColors, setWinnerColors] = useState<Map<number, string>>(new Map());
  
  // 벌크 이름 수정 모달 상태
  const [isBulkEditing, setIsBulkEditing] = useState<boolean>(false);
  const [tempParticipants, setTempParticipants] = useState<string[]>([]);
  
  // 결과 배열에 최소 한 개의 당첨이 있는지 확인하고 없으면 무작위로 하나를 당첨으로 설정하는 함수
  const ensureOneWinner = (currentResults: string[]) => {
    const hasWinner = currentResults.some(r => r.includes('💣'));
    if (!hasWinner && currentResults.length > 0) {
      const randomIndex = Math.floor(Math.random() * currentResults.length);
      const updated = [...currentResults];
      updated[randomIndex] = '💣';
      return updated;
    }
    return currentResults;
  };

  const generateLines = () => {
    setActivePaths(new Set());
    setDestinations(new Map());
    setWinnerColors(new Map());
    
    // 사다리를 새로 그릴 때마다 기존 결과값("당첨", "통과" 등)의 배열 위치를 섞어서 당첨 칸을 랜덤화함.
    setResults(prevR => {
      let shuffled = [...prevR];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      // 섞은 후에도 당첨이 사라졌는지 체크 (인원 감소 직후 등)
      return ensureOneWinner(shuffled);
    });
    
    const count = participants.length;
    const newLines: boolean[][] = Array.from({ length: ROWS }, () => Array(count - 1).fill(false));
    
    // 1단계: 무작위 생성
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < count - 1; c++) {
        if (c > 0 && newLines[r][c - 1]) continue;
        if (Math.random() > 0.5) {
          newLines[r][c] = true;
        }
      }
    }

    // 2단계: 각 구간별 최소 3개 연결 보장
    for (let c = 0; c < count - 1; c++) {
      let rungsInCol = 0;
      for (let r = 0; r < ROWS; r++) {
        if (newLines[r][c]) rungsInCol++;
      }

      let attempts = 0;
      while (rungsInCol < 3 && attempts < 100) {
        attempts++;
        const r = Math.floor(Math.random() * ROWS);
        if (newLines[r][c]) continue;
        
        // 사다리 규칙: 한 노드에서 한쪽으로만 가로선이 있어야 함
        const hasLeft = c > 0 && newLines[r][c - 1];
        const hasRight = c < count - 2 && newLines[r][c + 1];
        
        if (!hasLeft && !hasRight) {
          newLines[r][c] = true;
          rungsInCol++;
        }
      }
    }
    setLines(newLines);
  };

  useEffect(() => {
    generateLines();
  }, [participants.length]);

  const handleResultChange = (index: number, val: string) => {
    const newR = [...results];
    newR[index] = val;
    setResults(newR);
  };

  const addColumn = () => {
    if (participants.length >= 8) return;
    setParticipants(p => [...p, `유저 ${String.fromCharCode(65 + p.length)}`]);
    setResults(r => [...r, '생존']); 
  };

  const removeColumn = () => {
    if (participants.length <= 2) return;
    setParticipants(p => p.slice(0, -1));
    setResults(r => {
      const newR = r.slice(0, -1);
      return ensureOneWinner(newR);
    });
  };

  const getPath = (startIndex: number): Path => {
    if (lines.length === 0) return [];
    const path: Path = [];
    let currentCol = startIndex;
    
    path.push({ row: -1, col: currentCol }); // 시작점
    
    for (let r = 0; r < ROWS; r++) {
      path.push({ row: r, col: currentCol });
      
      if (currentCol < participants.length - 1 && lines[r][currentCol]) {
        currentCol++;
        path.push({ row: r, col: currentCol });
      } 
      else if (currentCol > 0 && lines[r][currentCol - 1]) {
        currentCol--;
        path.push({ row: r, col: currentCol });
      }
    }
    
    path.push({ row: ROWS, col: currentCol }); // 끝점
    return path;
  };

  // 유저 텍스트 버튼 클릭 핸들러 (즉시 사다리 타기 시작)
  const handleUserClick = (idx: number) => {
    playParticipant(idx);
  };
  
  // 벌크 이름 수정 모달 열기
  const openBulkEdit = () => {
    if (activePaths.size > 0) return; // 게임 시작 후엔 수정 불가
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
    const next = [...tempParticipants];
    next[idx] = name;
    setTempParticipants(next);
  };

  const onModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveBulkNames();
    if (e.key === 'Escape') setIsBulkEditing(false);
  };

  const playParticipant = (idx: number) => {
    if (activePaths.has(idx)) return; // 이미 진행 중
    
    const path = getPath(idx);
    if (!path.length) return;
    
    const dest = path[path.length - 1].col;
    
    // 경로의 물리적 길이 측정 및 비례 애니메이션 타임(ms) 계산 (1px당 1.5ms 속도)
    const { length } = getPathMetrics(idx);
    const durationMs = length * 1.5;
    
    setActivePaths(prev => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });

    // 완벽한 애니메이션 동기화 타이밍에 결과 덮어쓰기
    setTimeout(() => {
      setDestinations(prev => {
        const next = new Map(prev);
        next.set(idx, dest);
        return next;
      });
      setWinnerColors(prev => {
        const next = new Map(prev);
        next.set(dest, COLORS[idx % COLORS.length]);
        return next;
      });
      setActivePaths(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }, durationMs);
  };

  const playAll = () => {
    for (let i = 0; i < participants.length; i++) {
      setTimeout(() => playParticipant(i), i * 400);
    }
  };

  const colWidth = 100;
  const rowHeight = 40;
  const paddingY = 20;
  const svgWidth = (participants.length - 1) * colWidth;
  const svgHeight = ROWS * rowHeight + paddingY * 2;

  const getPathMetrics = (startIndex: number) => {
    const p = getPath(startIndex);
    if (!p.length) return { d: '', length: 0 };
    
    let d = '';
    let length = 0;
    
    for (let i = 0; i < p.length; i++) {
      const point = p[i];
      const x = point.col * colWidth;
      const y = point.row === -1 ? 0 : point.row === ROWS ? svgHeight : point.row * rowHeight + paddingY;
      
      if (i === 0) {
        d += `M ${x} ${y}`;
      } else {
        d += ` L ${x} ${y}`;
        const prevPoint = p[i-1];
        const prevX = prevPoint.col * colWidth;
        const prevY = prevPoint.row === -1 ? 0 : prevPoint.row === ROWS ? svgHeight : prevPoint.row * rowHeight + paddingY;
        length += Math.abs(x - prevX) + Math.abs(y - prevY);
      }
    }
    
    return { d, length };
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.controlGroup}>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#ccfbf1', color: '#0d9488', borderRadius: '12px' }} onClick={addColumn} disabled={participants.length >= 8}>인원 +</button>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#cfd9ff', color: '#4158d6', borderRadius: '12px' }} onClick={removeColumn} disabled={participants.length <= 2}>인원 -</button>
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

      {/* 게임 전체를 중앙에 배치하기 위해 wrapper의 align 스타일 변경 (css로 처리하기도 하나 직관적 인라인 추가) */}
      <div className={styles.gameBoard} style={{ alignItems: 'center' }}>
        {/* 참가자 헤더 영역 */}
        <div className={styles.participantsRow}>
          {participants.map((p, i) => (
            <div key={`p-${i}`} className={styles.playerWrapper} style={{ width: colWidth }}>
              <div 
                className={`${styles.pInput} ${styles.clickableInput}`} 
                onClick={() => handleUserClick(i)}
                style={{ background: COLORS[i % COLORS.length], color: 'white' }}
                title={activePaths.has(i) ? "진행 중" : "클릭해서 출발!"}
              >
                <span className={styles.userName}>{p}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 사다리 SVG 영역 */}
        <div className={styles.svgWrapper} style={{ width: svgWidth, height: svgHeight, marginLeft: colWidth / 2, marginRight: colWidth / 2 }}>
          <svg width={svgWidth} height={svgHeight} className={styles.svg}>
            {/* 기본 세로선 */}
            {participants.map((_, i) => (
              <line key={`v-${i}`} x1={i * colWidth} y1={0} x2={i * colWidth} y2={svgHeight} stroke="rgba(148, 163, 184, 0.4)" strokeWidth="4" strokeLinecap="round" />
            ))}
            
            {/* 기본 가로선 (스포일러 방지를 위해 한 명이라도 출발하면 보임) */}
            {activePaths.size > 0 && lines.map((rowArr, r) => 
              rowArr.map((hasLine, c) => hasLine && (
                <line 
                  key={`h-${r}-${c}`} 
                  x1={c * colWidth} 
                  y1={r * rowHeight + paddingY} 
                  x2={(c + 1) * colWidth} 
                  y2={r * rowHeight + paddingY} 
                  stroke="rgba(148, 163, 184, 0.4)" 
                  strokeWidth="4" 
                  strokeLinecap="round"
                />
              ))
            )}

            {/* 완료된 패스 고정 표시 (누적) */}
            {Array.from(destinations.keys()).map((participantIndex) => {
              const { d } = getPathMetrics(participantIndex);
              return (
                <path 
                  key={`static-path-${participantIndex}`} 
                  d={d} 
                  fill="none" 
                  stroke={COLORS[participantIndex % COLORS.length]} 
                  strokeWidth="6"
                  strokeLinecap="round"
                  style={{ opacity: 0.8 }}
                />
              );
            })}

            {/* 활성화된 패스 애니메이션 */}
            {Array.from(activePaths).map((participantIndex) => {
              const { d, length } = getPathMetrics(participantIndex);
              const durationMs = length * 1.5;
              
              return (
                <path 
                  key={`path-${participantIndex}`} 
                  d={d} 
                  fill="none" 
                  stroke={COLORS[participantIndex % COLORS.length]} 
                  strokeWidth="6"
                  strokeLinecap="round"
                  className={styles.animatedPath}
                  style={{
                    strokeDasharray: length,
                    strokeDashoffset: length,
                    animationDuration: `${durationMs}ms`
                  }}
                />
              );
            })}
          </svg>
        </div>

        {/* 결과 푸터 영역 */}
        <div className={styles.resultsRow}>
          {results.map((r, i) => {
            // 이 결과 위치에 도달한 참가자 찾기 (사다리는 1:1 매핑)
            const winnerEntry = Array.from(destinations.entries()).find(([_, destCol]) => destCol === i);
            const winnerIndex = winnerEntry ? winnerEntry[0] : null;
            const isHit = r.includes('💣') || r.includes('벌칙');
            
            // 승자가 있으면 해당 유저 컬러, 없으면 디폴트 컬러 매칭
            const customStyle = winnerColors.has(i) ? {
              background: winnerColors.get(i),
              color: 'white',
              borderColor: 'transparent',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)',
              zIndex: 10
            } : {};

            return (
              <div key={`r-${i}`} className={styles.resultWrapper} style={{ width: colWidth }}>
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

      {/* 벌크 이름 수정 모달 */}
      {isBulkEditing && (
        <div className={styles.modalOverlay} onClick={() => setIsBulkEditing(false)}>
          <div className={`${styles.modalContent} ${styles.bulkEditModal}`} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>참가자 이름 일괄 변경</h3>
            <div className={styles.bulkEditList}>
              {tempParticipants.map((name, idx) => (
                <div key={`bulk-edit-${idx}`} className={styles.bulkEditItem}>
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
              <button 
                className={`${styles.modalBtn} ${styles.modalCancel}`} 
                onClick={() => setIsBulkEditing(false)}
              >
                취소
              </button>
              <button 
                className={`${styles.modalBtn} ${styles.modalConfirm}`} 
                onClick={saveBulkNames}
                style={{ background: '#4f46e5', color: 'white' }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
