import { useState, useRef, useEffect } from 'react';
import styles from './DrawingLots.module.css';

type Card = {
  id: number;
  result: string;
  isFlipped: boolean;
  isHit: boolean;
};

export default function DrawingLots() {
  const [totalCount, setTotalCount] = useState(10);
  const [hitCount, setHitCount] = useState(2);
  const [hitMessage, setHitMessage] = useState('당첨 ✨');
  const [missMessage, setMissMessage] = useState('통과');
  const [cards, setCards] = useState<Card[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [error, setError] = useState('');

  const shuffleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (shuffleTimerRef.current) clearTimeout(shuffleTimerRef.current); };
  }, []);

  const startGame = () => {
    if (hitCount >= totalCount || hitCount <= 0 || totalCount < 2) {
      setError('설정값이 올바르지 않습니다.');
      return;
    }

    setError('');
    setIsShuffling(true);
    setGameStarted(true);

    const newCards: Card[] = Array.from({ length: totalCount }, (_, i) => ({
      id: i,
      result: i < hitCount ? hitMessage : missMessage,
      isFlipped: false,
      isHit: i < hitCount,
    }));

    // Fisher-Yates Shuffle
    for (let i = newCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
    }

    // 셔플 애니메이션 연출을 위해 지연 적용
    shuffleTimerRef.current = window.setTimeout(() => {
      shuffleTimerRef.current = null;
      setCards(newCards);
      setIsShuffling(false);
    }, 800);
  };

  const handleCardClick = (index: number) => {
    if (!gameStarted || isShuffling || cards[index].isFlipped) return;

    setCards(prev => {
      const next = [...prev];
      next[index] = { ...next[index], isFlipped: true };
      return next;
    });
  };

  const resetGame = () => {
    setError('');
    setGameStarted(false);
    setCards([]);
  };

  return (
    <div className={styles.container}>
      {!gameStarted ? (
        <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
          <h2 style={{ marginBottom: '2rem', textAlign: 'center' }}>제비 뽑기 설정</h2>

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

          <div className={styles.divider}></div>

          <div className={styles.textInputGroup}>
            <label>당첨 결과 텍스트</label>
            <input
              type="text"
              value={hitMessage}
              onChange={(e) => setHitMessage(e.target.value)}
              className={styles.textInput}
            />
          </div>

          <div className={styles.textInputGroup}>
            <label>통과 결과 텍스트</label>
            <input
              type="text"
              value={missMessage}
              onChange={(e) => setMissMessage(e.target.value)}
              className={styles.textInput}
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>
              {error}
            </p>
          )}
          <button className="btn-primary" style={{ width: '100%', padding: '16px' }} onClick={startGame}>
            게임 시작!
          </button>
        </div>
      ) : (
        <div className={`${styles.gamePanel} animate-fade-in`}>
          <div className={styles.gameHeader}>
            <div>
              <h3>총 {totalCount}개 중 당첨 {hitCount}개</h3>
              <p style={{ color: 'var(--text-secondary)' }}>카드를 클릭하여 결과를 확인하세요</p>
            </div>
            <button className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.9rem' }} onClick={resetGame}>
              다시 설정하기
            </button>
          </div>

          {isShuffling ? (
            <div className={styles.shufflingDisplay}>
              <div className={styles.spinner}></div>
              <p>제비 섞는 중...</p>
            </div>
          ) : (
            <div className={styles.cardsGrid}>
              {cards.map((card, idx) => (
                <div
                  key={card.id}
                  className={`${styles.card} ${card.isFlipped ? styles.flipped : ''}`}
                  onClick={() => handleCardClick(idx)}
                >
                  <div className={styles.cardInner}>
                    <div className={styles.cardFront}>
                      <span className={styles.cardNumber}>{idx + 1}</span>
                    </div>
                    <div className={`${styles.cardBack} ${card.isHit ? styles.cardHit : styles.cardMiss}`}>
                      {card.result}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
