/**
 * Generates the PWA / home-screen icon set from the brand mark.
 *
 * The mark is a wide lockup (1765x593), so it is contained inside a square
 * canvas on the site's ink background rather than resized to a square — a
 * plain resize would squash it, and a transparent square would render as a
 * white blob on an iOS home screen, which composites icons onto white.
 *
 * `maskable` gets extra padding so Android can crop it to a circle/squircle
 * without clipping the wordmark: the spec guarantees only the middle 80% is
 * safe, so the art is inset to ~60% of the canvas.
 *
 * Run with: node scripts/build-app-icons.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'src/assets/elenor-mark.png';
const OUT = 'public/icons';
const INK = { r: 5, g: 6, b: 10, alpha: 1 }; // --bg / themeColor

/** @param {number} size @param {number} inset fraction of canvas the art may use */
async function icon(size, inset, file) {
  const artW = Math.round(size * inset);
  const art = await sharp(SRC).resize({ width: artW, fit: 'inside' }).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: INK },
  })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${file}`);
  console.log(`  ${file}  ${size}x${size}`);
}

await mkdir(OUT, { recursive: true });
// Standard icons: the mark reads best filling most of the tile.
await icon(192, 0.78, 'icon-192.png');
await icon(512, 0.78, 'icon-512.png');
// Maskable: inset so a circular mask never crops the wordmark.
await icon(512, 0.6, 'icon-maskable-512.png');
// iOS home screen. No alpha (iOS composites onto white), already opaque here.
await icon(180, 0.78, 'apple-touch-icon.png');
// Browser tab.
await icon(32, 0.86, 'favicon-32.png');
console.log('done');
