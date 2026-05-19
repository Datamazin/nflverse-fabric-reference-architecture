import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("/Users/rob/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");

const width = 1920;
const height = 1080;
const outDir = path.join(path.dirname(new URL(import.meta.url).pathname), "slides");

const steps = [
  ["1", "Set up local python"],
  ["2", "Acquire Data Locally"],
  ["3", "Run Local Tests"],
  ["4", "Create Workspace"],
  ["5", "Create Lakehouse"],
  ["6", "Upload Notebooks"],
  ["7", "Upload Raw Data"],
  ["8", "Load data to Bronze"],
  ["9", "Build Silver and Gold"],
  ["10", "Validate Gold Metrics"],
  ["11", "Deploy Semantic Model"],
  ["12", "Run Prep for AI"],
  ["13", "Create Semantic Model Data Agent"],
  ["14", "Create Data Lake Data Agent"],
  ["15", "Test Data Agents with M365 Copilot"],
  ["16", "Run Data Agent Evaluations"],
];

function esc(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function wrap(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function completedCount(currentIndex) {
  return currentIndex + 1;
}

function cardText(x, y, label, title, state, maxChars = 22) {
  const titleLines = wrap(title, maxChars)
    .map(
      (line, i) =>
        `<text x="${x}" y="${y + 48 + i * 25}" class="a-title ${state}">${esc(line)}</text>`,
    )
    .join("");

  return `
    <text x="${x}" y="${y}" class="a-label ${state}">STEP ${esc(label)}</text>
    ${titleLines}
  `;
}

function slideSubtitle(currentIndex) {
  const [label, title] = steps[currentIndex];
  return `Step ${label} complete: ${title}`;
}

function renderSlide(currentIndex) {
  const startX = 102;
  const startY = 224;
  const cardW = 380;
  const cardH = 132;
  const gapX = 54;
  const gapY = 70;
  const cols = 4;
  const covered = completedCount(currentIndex);

  const cards = steps
    .map(([label, title], i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      const state = i <= currentIndex ? "done" : "todo";
      const check =
        state === "done"
          ? `<text x="${x + cardW - 61}" y="${y + 57}" class="a-check">✓</text>`
          : "";

      return `
        <g filter="url(#cardShadow)">
          <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="30" class="a-card ${state}" />
        </g>
        <circle cx="${x + 48}" cy="${y + 44}" r="23" class="a-num ${state}" />
        <text x="${x + 48}" y="${y + 52}" text-anchor="middle" class="a-num-text ${state}">${esc(label)}</text>
        ${cardText(x + 88, y + 37, label, title, state)}
        ${check}
      `;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bgA" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#071a2b"/>
        <stop offset="42%" stop-color="#15354a"/>
        <stop offset="100%" stop-color="#0e5f55"/>
      </linearGradient>
      <radialGradient id="glowA" cx="72%" cy="18%" r="55%">
        <stop offset="0%" stop-color="#7ef2c8" stop-opacity=".30"/>
        <stop offset="100%" stop-color="#7ef2c8" stop-opacity="0"/>
      </radialGradient>
      <filter id="cardShadow" x="-20%" y="-30%" width="140%" height="170%">
        <feDropShadow dx="0" dy="18" stdDeviation="17" flood-color="#020d13" flood-opacity=".36"/>
      </filter>
      <style>
        .bg { fill: url(#bgA); }
        .glow { fill: url(#glowA); }
        .grid { stroke: rgba(255,255,255,.075); stroke-width: 1; }
        .eyebrow { font: 700 28px Arial, sans-serif; fill: #83f3c8; letter-spacing: 3px; }
        .headline { font: 800 78px Arial, sans-serif; fill: #f8fbff; letter-spacing: 0; }
        .subhead { font: 400 31px Arial, sans-serif; fill: rgba(236,247,255,.78); }
        .a-card { stroke-width: 1.5; }
        .a-card.done { fill: #18c48f; stroke: rgba(255,255,255,.72); }
        .a-card.todo { fill: rgba(255,255,255,.12); stroke: rgba(255,255,255,.20); }
        .a-num.done { fill: rgba(255,255,255,.92); }
        .a-num.todo { fill: rgba(255,255,255,.13); }
        .a-num-text { font: 800 20px Arial, sans-serif; }
        .a-num-text.done { fill: #0d6d55; }
        .a-num-text.todo { fill: rgba(246,251,255,.84); }
        .a-label { font: 800 15px Arial, sans-serif; letter-spacing: 2.2px; }
        .a-label.done, .a-label.todo { fill: rgba(255,255,255,.68); }
        .a-title { font: 700 24px Arial, sans-serif; letter-spacing: 0; }
        .a-title.done, .a-title.todo { fill: #ffffff; }
        .a-check { font: 800 46px Arial, sans-serif; fill: #ffffff; }
        .footer { font: 600 23px Arial, sans-serif; fill: rgba(255,255,255,.68); }
        .counter { font: 800 31px Arial, sans-serif; fill: #83f3c8; }
      </style>
    </defs>
    <rect width="1920" height="1080" class="bg"/>
    <rect width="1920" height="1080" class="glow"/>
    ${Array.from({ length: 14 }, (_, i) => `<line x1="${i * 160}" x2="${i * 160 - 520}" y1="0" y2="1080" class="grid"/>`).join("")}
    <text x="102" y="104" class="eyebrow">NFL FABRIC ANALYTICS</text>
    <text x="102" y="177" class="headline">Build Progress</text>
    <text x="850" y="157" class="subhead">${esc(slideSubtitle(currentIndex))}</text>
    <text x="850" y="205" class="counter">${covered} of ${steps.length} covered</text>
    ${cards}
    <text x="102" y="1016" class="footer">Completed steps fill green. Upcoming steps stay translucent.</text>
  </svg>`;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  await Promise.all(
    steps.map(async ([label], index) => {
      const order = String(index + 1).padStart(2, "0");
      const fileSafeLabel = label.replaceAll(/[^a-zA-Z0-9]/g, "");
      const baseName = `${order}-step-${fileSafeLabel}`;
      const svg = renderSlide(index);
      const svgPath = path.join(outDir, `${baseName}.svg`);
      const pngPath = path.join(outDir, `${baseName}.png`);

      await fs.writeFile(svgPath, svg);
      await sharp(Buffer.from(svg)).png().toFile(pngPath);
      console.log(pngPath);
    }),
  );
}

await main();
