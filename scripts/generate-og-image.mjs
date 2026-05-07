import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const W = 1200, H = 630;
const THUMB_SIZE = 160;
const GAP = 24;
const GRID_W = THUMB_SIZE * 2 + GAP;
const GRID_H = THUMB_SIZE * 2 + GAP;

// 배경: 앱과 동일한 그라디언트 느낌 (SVG로 생성)
const bgSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#fdf6f0"/>
      <stop offset="100%" stop-color="#fce7f3"/>
    </linearGradient>
    <!-- 장식 원 -->
    <radialGradient id="c1" cx="50%" cy="50%">
      <stop offset="0%" stop-color="#f9a8d4" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#f9a8d4" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="c2" cx="50%" cy="50%">
      <stop offset="0%" stop-color="#c4b5fd" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#c4b5fd" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <ellipse cx="200" cy="150" rx="260" ry="200" fill="url(#c1)"/>
  <ellipse cx="1050" cy="500" rx="220" ry="180" fill="url(#c2)"/>

  <!-- 제목 -->
  <text x="${W / 2}" y="118"
    font-family="Arial Black, Arial, sans-serif"
    font-size="88"
    font-weight="900"
    text-anchor="middle"
    fill="url(#title-grad)"
    letter-spacing="-3">Pickaroo</text>
  <defs>
    <linearGradient id="title-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>

  <!-- 부제 -->
  <text x="${W / 2}" y="162"
    font-family="Arial, sans-serif"
    font-size="24"
    font-weight="400"
    text-anchor="middle"
    fill="#9ca3af"
    letter-spacing="1">무료 미니게임 모음 · 돌림판 · 사다리타기 · 제비뽑기 · 폭탄돌리기</text>

  <!-- 썸네일 배경 카드 -->
  ${[0, 1, 2, 3].map(i => {
    const col = i % 2, row = Math.floor(i / 2);
    const gridStartX = (W - GRID_W) / 2;
    const gridStartY = 200;
    const x = gridStartX + col * (THUMB_SIZE + GAP);
    const y = gridStartY + row * (THUMB_SIZE + GAP);
    return `<rect x="${x - 12}" y="${y - 12}" width="${THUMB_SIZE + 24}" height="${THUMB_SIZE + 24}"
      rx="20" ry="20"
      fill="white" fill-opacity="0.7"
      stroke="rgba(236,72,153,0.15)" stroke-width="1.5"/>`;
  }).join('\n  ')}
</svg>`;

const thumbFiles = ['roulette', 'ghostleg', 'drawing', 'bomb'];

async function main() {
  const bg = await sharp(Buffer.from(bgSvg)).png().toBuffer();

  const composites = await Promise.all(
    thumbFiles.map(async (name, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const gridStartX = Math.round((W - GRID_W) / 2);
      const gridStartY = 200;
      const x = gridStartX + col * (THUMB_SIZE + GAP);
      const y = gridStartY + row * (THUMB_SIZE + GAP);

      const input = await sharp(path.join(ROOT, 'src/assets/thumbnails', `${name}.png`))
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      return { input, left: x, top: y };
    })
  );

  await sharp(bg)
    .composite(composites)
    .png()
    .toFile(path.join(ROOT, 'public/og-image.png'));

  console.log('✓ public/og-image.png 생성 완료 (1200×630)');
}

main().catch(err => { console.error(err); process.exit(1); });
