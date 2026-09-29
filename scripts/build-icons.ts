// Build all PWA PNG icons from /public/icon.svg.
// Run with: bun run scripts/build-icons.ts
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, "public", "icon.svg");
const OUT = path.join(ROOT, "public", "icons");

// SVG with a fully-opaque background so it qualifies as a "maskable" icon
// (Android Adaptive Icons require full bleed — no transparent corners).
// Ethereum-purple accent variant for the maskable icon.
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#15171f"/>
      <stop offset="1" stop-color="#000000"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#3a4f9d"/>
      <stop offset="1" stop-color="#8a92ff"/>
    </linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#a996ff"/>
      <stop offset="1" stop-color="#627EEA"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="0" y="0" width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(64 64) scale(0.75)" filter="url(#glow)">
    <rect x="40" y="288" width="56" height="120" rx="14" fill="url(#bar)" opacity="0.55"/>
    <rect x="120" y="232" width="56" height="176" rx="14" fill="url(#bar)" opacity="0.7"/>
    <rect x="200" y="168" width="56" height="240" rx="14" fill="url(#bar)" opacity="0.85"/>
    <rect x="280" y="112" width="56" height="296" rx="14" fill="url(#bar)"/>
    <polyline points="40,300 120,260 200,200 280,150 360,90"
              fill="none" stroke="url(#line)" stroke-width="16"
              stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="360,72 388,108 336,108" fill="#a996ff"/>
  </g>
</svg>`;

async function main() {
  if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });
  const srcBuf = await sharp(SRC).toBuffer();

  const sizes = [
    { size: 192, file: "icon-192.png" },
    { size: 512, file: "icon-512.png" },
    { size: 180, file: "apple-touch-icon.png" },
    { size: 32, file: "favicon-32.png" },
    { size: 16, file: "favicon-16.png" },
  ];

  for (const { size, file } of sizes) {
    const out = path.join(OUT, file);
    await sharp(srcBuf).resize(size, size).png().toFile(out);
    console.log("✓", file, `${size}x${size}`);
  }

  // Maskable icon (full-bleed opaque background for Android adaptive icon).
  const maskable = path.join(OUT, "maskable-512.png");
  await sharp(Buffer.from(MASKABLE_SVG)).resize(512, 512).png().toFile(maskable);
  console.log("✓ maskable-512.png 512x512 (opaque background)");

  // ICO favicon (multi-resolution).
  const png32 = await sharp(srcBuf).resize(32, 32).png().toBuffer();
  const png16 = await sharp(srcBuf).resize(16, 16).png().toBuffer();
  const png48 = await sharp(srcBuf).resize(48, 48).png().toBuffer();
  const png64 = await sharp(srcBuf).resize(64, 64).png().toBuffer();
  const ico = buildIco([png16, png32, png48, png64]);
  await writeFile(path.join(ROOT, "public", "favicon.ico"), ico);
  console.log("✓ favicon.ico (16,32,48,64)");

  console.log("\nAll PWA icons generated in /public/icons");
}

function buildIco(pngs: Buffer[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const entries: Buffer[] = [];
  let offset = 6 + 16 * pngs.length;
  for (const png of pngs) {
    const entry = Buffer.alloc(16);
    const size = png.readUInt32BE(16);
    const w = size > 256 ? 0 : size;
    const h = w;
    entry.writeUInt8(w, 0);
    entry.writeUInt8(h, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...pngs]);
}

main().catch((err) => {
  console.error("Failed to build icons:", err);
  process.exit(1);
});
