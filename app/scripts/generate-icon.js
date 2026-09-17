#!/usr/bin/env node
// Regenerates build/icon.png (512x512) and build/icon.ico (256x256) from the
// Aperture mark — two concentric C-arcs plus a center accent dot.
//
// MAINTENANCE TOOL, NOT A SETUP STEP. Both outputs are versioned, like
// frontend/dist/: a clone already carries them and the app loads those. Run
// this by hand only when the mark itself changes, then commit the result.
// It needs rsvg-convert, which has no usual Windows package — which is why
// setup.bat no longer calls it.

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const BUILD_DIR = path.join(__dirname, '..', 'build');
if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });

// ── Aperture mark SVG ──────────────────────────────────────────────────────
// Warm paper background, ink arcs, ink-blue accent dot.
// Exported at 512×512 for the app icon tile.
function makeSVG(size) {
  // Scale factor: viewBox is 92×92, tile is `size`×`size`
  const tileSize = size;
  // Icon has 12% padding on each side so the mark has breathing room
  const pad = Math.round(tileSize * 0.12);
  const markSize = tileSize - pad * 2;
  const scale = markSize / 92;
  const tx = pad;
  const ty = pad;

  const bgColor    = '#FAFAF7'; // paper
  const inkColor   = '#19191A'; // ink
  const accentColor = 'oklch(0.48 0.13 258)'; // ink-blue

  // Stroke widths from ApertureMark component formula (at s=92)
  const sw1 = 3.2; // outer arc
  const sw2 = 2.6; // inner arc

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}">
  <!-- Background tile with rounded corners -->
  <rect width="${tileSize}" height="${tileSize}" rx="${Math.round(tileSize * 0.22)}" fill="${bgColor}"/>
  <!-- Aperture mark — scaled and centered -->
  <g transform="translate(${tx}, ${ty}) scale(${scale.toFixed(6)})">
    <!-- Outer arc: open at right (C-shape) -->
    <path d="M46 8 A38 38 0 1 0 78 65"
          stroke="${inkColor}" stroke-width="${sw1}" stroke-linecap="round" fill="none"/>
    <!-- Inner arc -->
    <path d="M46 22 A24 24 0 1 0 66 58"
          stroke="${inkColor}" stroke-width="${sw2}" stroke-linecap="round" fill="none"/>
    <!-- Center accent dot -->
    <circle cx="46" cy="46" r="7.5" fill="${accentColor}"/>
  </g>
</svg>`;
}

// ── PNG helpers (for reading back rsvg output, or reuse old writer) ─────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createICO(pngBuf, size) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([dir, entry, pngBuf]);
}

// ── Render via rsvg-convert ────────────────────────────────────────────────
function renderSVG(svgStr, outputSize) {
  const tmpSvg = path.join(BUILD_DIR, '_tmp_icon.svg');
  fs.writeFileSync(tmpSvg, svgStr, 'utf8');
  try {
    return execSync(
      `rsvg-convert -w ${outputSize} -h ${outputSize} -f png "${tmpSvg}"`,
      { encoding: 'buffer' }
    );
  } finally {
    // Cleanup has to run even when the conversion fails. rsvg-convert is
    // usually absent on Windows, and the throw used to skip the unlink below —
    // leaving _tmp_icon.svg behind as an untracked file in build/, which is a
    // directory git is watching.
    try { fs.unlinkSync(tmpSvg); } catch {}
  }
}

// ── Generate ───────────────────────────────────────────────────────────────
try {
  console.log('Rendering icon at 512×512…');
  const png512 = renderSVG(makeSVG(512), 512);
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.png'), png512);
  console.log('✓ build/icon.png  (512×512)');

  console.log('Rendering icon at 256×256…');
  const png256 = renderSVG(makeSVG(256), 256);
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), createICO(png256, 256));
  console.log('✓ build/icon.ico  (256×256)');

  console.log('\nIcons ready.');
} catch (err) {
  console.error('Icon generation failed:', err.message);
  console.error('');
  console.error('rsvg-convert renders the SVG, and it is not installed:');
  console.error('  Debian/Ubuntu   apt-get install librsvg2-bin');
  console.error('  macOS           brew install librsvg');
  console.error('  Windows         no usual package — run this on Linux or macOS,');
  console.error('                  or in WSL, and commit the two files it writes.');
  console.error('');
  console.error('This is NOT part of setting Clarity up. build/icon.png and');
  console.error('build/icon.ico are versioned, like frontend/dist/ — a clone');
  console.error('already has them, and the app reads those. This script only');
  console.error('regenerates them, for when the Aperture mark itself changes.');
  process.exit(1);
}
