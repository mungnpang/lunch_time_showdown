import { useState, useMemo, useRef, useEffect } from 'react';
import styles from './Roulette.module.css';

const DEFAULT_OPTIONS = ['👑 팀장님이 쏜다', '🐣 막내 차례', '✂️ 가위바위보 진 사람', '⏰ 오늘 늦은 사람', '😇 패스', '🤝 더치페이'];
const COLORS = ['#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#6366f1', '#eab308', '#2dd4bf', '#d946ef', '#64748b'];

const getCoordinatesForPercent = (percent: number): [number, number] => [
  Math.cos(2 * Math.PI * percent) * 100,
  Math.sin(2 * Math.PI * percent) * 100,
];

export default function Roulette() {
  const [options, setOptions]       = useState<string[]>(DEFAULT_OPTIONS);
  const [newOption, setNewOption]   = useState('');
  const [rotation, setRotation]     = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult]         = useState<string | null>(null);

  const spinTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (spinTimerRef.current) clearTimeout(spinTimerRef.current); };
  }, []);

  const spin = () => {
    if (isSpinning || options.length < 2) return;
    setIsSpinning(true);
    setResult(null);

    const randomDegree = 5 * 360 + Math.floor(Math.random() * 360);
    const newRotation  = rotation + randomDegree;
    setRotation(newRotation);

    spinTimerRef.current = window.setTimeout(() => {
      spinTimerRef.current = null;
      setIsSpinning(false);
      const finalRotation = newRotation % 360;
      const itemAngle     = 360 / options.length;

      let closestDistance = Infinity;
      let winner = 0;

      for (let i = 0; i < options.length; i++) {
        let distance = Math.abs((i + 0.5) * itemAngle + finalRotation - 270) % 360;
        if (distance > 180) distance = 360 - distance;
        if (distance < closestDistance) { closestDistance = distance; winner = i; }
      }
      setResult(options[winner]);
    }, 5000);
  };

  const addOption = (e: React.FormEvent) => {
    e.preventDefault();
    if (newOption.trim() && options.length < 20) {
      setOptions(prev => [...prev, newOption.trim()]);
      setNewOption('');
      setResult(null);
    }
  };

  const removeOption = (index: number) => {
    if (isSpinning) return;
    setOptions(prev => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  // 슬라이스 SVG를 options 변경 시에만 재계산
  const renderedSlices = useMemo(() => {
    if (options.length === 0) return null;

    if (options.length === 1) {
      return (
        <g>
          <circle cx="100" cy="100" r="100" fill={COLORS[0]} />
          <text x="100" y="100" fill="white" fontSize="20" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">
            {options[0]}
          </text>
        </g>
      );
    }

    const percentPerSlice = 1 / options.length;
    let cumulativePercent = 0;

    return options.map((option, i) => {
      const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
      cumulativePercent += percentPerSlice;
      const [endX, endY] = getCoordinatesForPercent(cumulativePercent);

      const largeArcFlag = percentPerSlice > 0.5 ? 1 : 0;
      const pathData = `M 100 100 L ${100 + startX} ${100 + startY} A 100 100 0 ${largeArcFlag} 1 ${100 + endX} ${100 + endY} Z`;
      const textAngle = (i + 0.5) * (360 / options.length);
      const label = option.length > 7 ? option.substring(0, 7) + '..' : option;

      return (
        <g key={i}>
          <path d={pathData} fill={COLORS[i % COLORS.length]} />
          <text
            x="150" y="100"
            fill="white"
            fontSize={options.length > 8 ? '8' : '10'}
            fontWeight="bold"
            textAnchor="middle"
            alignmentBaseline="middle"
            transform={`rotate(${textAngle}, 100, 100)`}
          >
            {label}
          </text>
        </g>
      );
    });
  }, [options]);

  return (
    <div className={styles.container}>
      <div className={styles.topSection}>
        <div className={styles.wheelWrapper}>
          <div className={styles.pointer}>
            <svg viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 2h20c3 0 4 1 3 4L17 36c-1 3-3 3-4 0L2 6c-1-3 0-4 3-4z" fill="#ffffff" />
              <path d="M7 4h16c2 0 3 1 2 3L16 33c-1 2-2 2-2 0L5 7c-1-2 0-3 2-3z" fill="#ff5252" />
            </svg>
          </div>
          <div className={styles.wheel} style={{ transform: `rotate(${rotation}deg)` }}>
            <svg viewBox="0 0 200 200" className={styles.svgWheel}>
              {renderedSlices}
            </svg>
          </div>
        </div>

        <div className={styles.resultContainer}>
          {result ? (
            <div className={`animate-fade-in ${styles.resultBox}`}>
              <h3 className={styles.resultTitle}>🎉 당첨 🎉</h3>
              <div className={styles.resultText}>{result}</div>
            </div>
          ) : (
            <div className={styles.resultBoxEmpty}>결과가 이곳에 표시됩니다</div>
          )}
        </div>
      </div>

      <div className={`glass-panel ${styles.controlsPanel}`}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>항목 설정 (클릭 시 삭제)</h3>
        <div className={styles.optionsList}>
          {options.map((opt, i) => (
            <div key={i} className={styles.optionChip} onClick={() => removeOption(i)}>
              <div className={styles.colorDot} style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span>{opt}</span>
              <button type="button" className={styles.removeBtn}>×</button>
            </div>
          ))}
        </div>

        <form onSubmit={addOption} className={styles.inputGroup}>
          <input
            type="text"
            className={styles.input}
            placeholder="새로운 항목 입력 (최대 20개)"
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            disabled={isSpinning || options.length >= 20}
          />
          <button
            type="submit"
            className="btn-primary"
            style={{ padding: '20px 24px', borderRadius: '20px' }}
            disabled={isSpinning || !newOption.trim() || options.length >= 20}
          >
            추가
          </button>
        </form>

        <button
          className={`btn-primary ${styles.spinBtn}`}
          onClick={spin}
          disabled={isSpinning || options.length < 2}
        >
          {isSpinning ? '도는 중...' : '돌리기!'}
        </button>
      </div>
    </div>
  );
}
