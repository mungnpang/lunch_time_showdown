import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const ROUTES = {
  '/roulette': {
    title: '돌림판 | Pickaroo — 무료 온라인 돌림판',
    description: '점심 메뉴, 벌칙, 당번을 공정하게 결정하는 무료 온라인 돌림판. 최대 20항목 설정 가능. 확률 조정 기능 지원.',
    keywords: '돌림판, 온라인 돌림판, 무료 돌림판, 랜덤 뽑기, 점심 메뉴 뽑기',
  },
  '/ghostleg': {
    title: '사다리 타기 | Pickaroo — 무료 온라인 사다리 게임',
    description: '운명의 사다리를 타고 결과를 확인하세요. 최대 8명 멀티플레이 지원. 무료 온라인 사다리 타기 게임.',
    keywords: '사다리 타기, 온라인 사다리, 무료 사다리 타기, 사다리 게임',
  },
  '/drawing': {
    title: '제비 뽑기 | Pickaroo — 무료 온라인 제비뽑기',
    description: '간단하고 공정한 무작위 제비 뽑기. 최대 100항목 설정 가능. 당번 정하기, 벌칙 정하기에 딱.',
    keywords: '제비 뽑기, 온라인 제비뽑기, 무료 뽑기, 랜덤 선택',
  },
  '/bomb': {
    title: '폭탄 돌리기 | Pickaroo — 무료 온라인 폭탄 게임',
    description: '보이지 않는 타이머로 긴장감 넘치는 폭탄 돌리기. 최대 8명 멀티플레이 지원. 모임 분위기를 살려줄 무료 미니게임.',
    keywords: '폭탄 돌리기, 폭탄 게임, 온라인 폭탄, 모임 게임',
  },
  '/privacy': {
    title: '개인정보처리방침 | Pickaroo',
    description: 'Pickaroo 개인정보처리방침. 수집하는 정보와 이용 목적을 안내합니다.',
  },
};

const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

function injectMeta(html, route, meta) {
  const url = `https://pickaroo.xyz${route}`;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`);
  html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*"/, `$1${meta.description}"`);
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*"/, `$1${url}"`);
  html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*"/, `$1${url}"`);
  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${meta.title}"`);
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${meta.description}"`);
  html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*"/, `$1${meta.title}"`);
  html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*"/, `$1${meta.description}"`);
  if (meta.keywords) {
    html = html.replace(/(<meta\s+name="keywords"\s+content=")[^"]*"/, `$1${meta.keywords}"`);
  }
  return html;
}

for (const [route, meta] of Object.entries(ROUTES)) {
  const html = injectMeta(template, route, meta);
  const dir = path.join(distDir, route.slice(1));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`prerendered: ${route}`);
}
