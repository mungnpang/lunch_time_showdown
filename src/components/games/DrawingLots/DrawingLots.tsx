import { useState } from 'react';
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

  const startGame = () => {
    if (hitCount >= totalCount || hitCount <= 0 || totalCount < 2) {
      alert('설정값이 올바르지 않습니다.');
      return;
    }

    setIsShuffling(true);
    setGameStarted(true);
    
    // 초기 카드 생성
    const newCards: Card[] = [];
    for (let i = 0; i < hitCount; i++) {
      newCards.push({ id: 0, result: hitMessage, isFlipped: false, isHit: true });
    }
    for (let i = hitCount; i < totalCount; i++) {
      newCards.push({ id: 0, result: missMessage, isFlipped: false, isHit: false });
    }

    // Fisher-Yates Shuffle
    for (let i = newCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
    }

    // 고유 ID 할당
    newCards.forEach((c, idx) => c.id = idx);

    // 셔플 애니메이션 연출을 위해 지연 적용
    setTimeout(() => {
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
              <button type="button" onClick={() => setTotalCount(c => Math.max(2, c - 1))}>-</button>
              <input type="number" readOnly value={totalCount} />
              <button type="button" onClick={() => setTotalCount(c => Math.min(100, c + 1))}>+</button>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>당첨(혹은 벌칙) 개수</label>
            <div className={styles.numControl}>
              <button type="button" onClick={() => setHitCount(c => Math.max(1, c - 1))}>-</button>
              <input type="number" readOnly value={hitCount} />
              <button type="button" onClick={() => setHitCount(c => Math.min(totalCount - 1, c + 1))}>+</button>
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

          <button className="btn-primary" style={{ width: '100%', marginTop: '1.5rem', padding: '16px' }} onClick={startGame}>
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
