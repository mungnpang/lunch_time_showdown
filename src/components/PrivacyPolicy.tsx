import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color-1)' }}>
      <header className="glass-panel animate-fade-in" style={{
        margin: '1rem',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: '16px',
      }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
          개인정보처리방침
        </h2>
        <button
          className="btn-primary"
          style={{ padding: '8px 20px', fontSize: '1rem' }}
          onClick={() => navigate('/')}
        >
          ← 메인으로
        </button>
      </header>

      <main style={{ flex: 1, padding: '1.5rem', maxWidth: '960px', margin: '0 auto', width: '100%' }}>
        <div className="glass-panel animate-fade-in" style={{ padding: '2.5rem', borderRadius: '20px', lineHeight: 1.8 }}>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
            시행일: 2026년 4월 12일 &nbsp;·&nbsp; 최종 수정일: 2026년 5월 6일
          </p>

          <Section title="1. 개요">
            <p>
              Pickaroo(이하 "서비스")는 돌림판, 사다리타기, 제비뽑기, 폭탄돌리기 등 그룹 활동을 지원하는 웹 기반 미니게임 서비스입니다.
              본 방침은 서비스 이용 과정에서 수집·처리되는 정보의 범위와 목적, 보유 기간 등을 안내합니다.
            </p>
          </Section>

          <Section title="2. 수집하는 정보">
            <p>서비스는 회원가입, 로그인, 별도의 개인정보 입력을 요구하지 않습니다. 수집되는 정보는 다음과 같습니다.</p>
            <Table
              headers={['정보', '수집 방식', '내용']}
              rows={[
                ['세션 식별자', '브라우저 sessionStorage', '기기를 식별하는 임의의 UUID (이름·연락처 등 개인정보 미포함)'],
                ['닉네임', '멀티플레이 이용 시 직접 입력', '방 내 표시용으로만 사용, 별도 저장되지 않음'],
                ['게임 데이터', 'Firebase Realtime Database', '방 코드, 게임 진행 상태 등 — 방 종료 시 즉시 삭제'],
                ['접속 로그', 'Vercel / Cloudflare 자동 수집', 'IP 주소, 브라우저 정보, 접속 시각 (서버 운영 목적)'],
              ]}
            />
          </Section>

          <Section title="3. 수집 및 이용 목적">
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>멀티플레이 방 생성·참가 기능 제공</li>
              <li>게임 진행 상태 실시간 동기화</li>
              <li>서비스 장애 대응 및 보안 관리</li>
            </ul>
          </Section>

          <Section title="4. 보유 및 파기">
            <Table
              headers={['정보', '보유 기간']}
              rows={[
                ['세션 식별자', '브라우저 탭 종료 시 자동 삭제 (sessionStorage)'],
                ['닉네임·게임 데이터', '방장이 방을 나가거나 연결이 끊기면 즉시 삭제 (Firebase onDisconnect)'],
                ['접속 로그', 'Vercel 및 Cloudflare 정책에 따름 (통상 30일 이내)'],
              ]}
            />
          </Section>

          <Section title="5. 제3자 서비스">
            <p>서비스는 아래 외부 서비스를 사용합니다. 각 서비스의 개인정보처리방침을 함께 확인하시기 바랍니다.</p>
            <Table
              headers={['서비스', '역할', '개인정보처리방침']}
              rows={[
                ['Google Firebase', '멀티플레이 실시간 데이터베이스', 'firebase.google.com/support/privacy'],
                ['Vercel', '웹 호스팅', 'vercel.com/legal/privacy-policy'],
                ['Cloudflare', 'CDN 및 보안', 'cloudflare.com/privacypolicy'],
              ]}
            />
          </Section>

          <Section title="6. 쿠키 및 추적">
            <p>
              서비스는 별도의 쿠키를 설정하거나 광고 추적 기술을 사용하지 않습니다.
              다만, Cloudflare 및 Vercel이 서비스 운영 목적으로 자체 쿠키를 설정할 수 있습니다.
            </p>
          </Section>

          <Section title="7. 이용자의 권리">
            <p>
              이용자는 언제든지 브라우저 탭을 종료하거나 sessionStorage를 삭제하여 세션 식별자를 제거할 수 있습니다.
              멀티플레이 중 저장된 닉네임 및 게임 데이터는 방을 나가는 즉시 삭제됩니다.
            </p>
          </Section>

          <Section title="8. 어린이 보호">
            <p>
              서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 의도적으로 아동의 개인정보를 수집하지 않습니다.
            </p>
          </Section>

          <Section title="9. 방침 변경">
            <p>
              본 방침이 변경될 경우 서비스 내 공지 또는 본 페이지 상단의 최종 수정일 업데이트를 통해 안내합니다.
            </p>
          </Section>

          <Section title="10. 문의">
            <p>
              개인정보 처리, 서비스에 관한 문의 또는 제안 사항 관련 내용은 아래 이메일로 연락해 주세요.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>이메일:</strong>{' '}
              <a href="mailto:contact@pickaroo.xyz" style={{ color: 'var(--accent-secondary)' }}>
                contact@pickaroo.xyz
              </a>
            </p>
          </Section>

        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        © 2026 Pickaroo
      </footer>
    </div>
  );
}

// ── 헬퍼 컴포넌트 ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
        {title}
      </h3>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
        {children}
      </div>
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const lastCol = headers.length - 1;
  return (
    <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', tableLayout: 'auto' }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', background: 'rgba(var(--accent-primary-rgb), 0.07)', color: 'var(--text-primary)', fontWeight: 700, borderBottom: '2px solid var(--glass-border)', whiteSpace: 'nowrap', width: i === lastCol ? '100%' : undefined }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '10px 14px', color: 'var(--text-secondary)', verticalAlign: 'middle', whiteSpace: j < lastCol ? 'nowrap' : 'normal' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
