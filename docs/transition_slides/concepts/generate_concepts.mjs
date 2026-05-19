import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("/Users/rob/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");

const outDir = path.dirname(new URL(import.meta.url).pathname);
const width = 1920;
const height = 1080;

const steps = [
  ["1", "Set Up Local Python"],
  ["2", "Acquire NFLVerse Data Locally"],
  ["3", "Run Local Tests"],
  ["4", "Create a new Workspace"],
  ["5", "Create a new Lakehouse"],
  ["6", "Upload Raw NFLVerse Files To Fabric"],
  ["7", "Upload notebooks"],
  ["8", "Build Bronze"],
  ["9", "Build Silver And Gold"],
  ["10", "Validate Gold Metrics"],
  ["11a", "Deploy Semantic Model with Python"],
  ["11b", "Build Semantic Model Manually"],
  ["12", "Configure Semantic Model Data Agent"],
  ["13", "Evaluate Semantic Model Data Agent"],
  ["14", "Configure Data Lake Fabric Data Agent"],
  ["15", "Evaluate Data Lake Data Agent"],
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

function cardText(x, y, label, title, theme, maxChars = 20) {
  const lines = wrap(title, maxChars);
  const textLines = lines
    .map(
      (line, i) =>
        `<text x="${x}" y="${y + 48 + i * 25}" class="${theme}-title">${esc(line)}</text>`,
    )
    .join("");

  return `
    <text x="${x}" y="${y}" class="${theme}-label">STEP ${esc(label)}</text>
    ${textLines}
  `;
}

function conceptA() {
  const startX = 102;
  const startY = 224;
  const cardW = 380;
  const cardH = 132;
  const gapX = 54;
  const gapY = 70;
  const cols = 4;

  const cards = steps
    .map(([label, title], i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      const state = label === "1" ? "done" : label === "11b" ? "skipped" : "todo";
      const check = state === "done" ? `<text x="${x + cardW - 61}" y="${y + 57}" class="a-check">✓</text>` : "";
      const skip = state === "skipped" ? `<text x="${x + cardW - 86}" y="${y + 55}" class="a-skip">SKIP</text>` : "";
      return `
        <g filter="url(#cardShadow)">
          <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="30" class="a-card ${state}" />
        </g>
        <circle cx="${x + 48}" cy="${y + 44}" r="23" class="a-num ${state}" />
        <text x="${x + 48}" y="${y + 52}" text-anchor="middle" class="a-num-text ${state}">${esc(label)}</text>
        ${cardText(x + 88, y + 37, label, title, "a", 22)}
        ${check}
        ${skip}
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
        .a-card.skipped { fill: rgba(160,170,178,.18); stroke: rgba(210,220,228,.18); }
        .a-num.done { fill: rgba(255,255,255,.92); }
        .a-num.todo { fill: rgba(255,255,255,.13); }
        .a-num.skipped { fill: rgba(180,188,194,.22); }
        .a-num-text { font: 800 20px Arial, sans-serif; }
        .a-num-text.done { fill: #0d6d55; }
        .a-num-text.todo { fill: rgba(246,251,255,.84); }
        .a-num-text.skipped { fill: rgba(236,241,245,.46); }
        .a-label { font: 800 15px Arial, sans-serif; fill: rgba(255,255,255,.68); letter-spacing: 2.2px; }
        .a-title { font: 700 24px Arial, sans-serif; fill: #ffffff; letter-spacing: 0; }
        .a-check { font: 800 46px Arial, sans-serif; fill: #ffffff; }
        .a-skip { font: 800 22px Arial, sans-serif; fill: rgba(245,248,250,.42); letter-spacing: 2px; }
        .footer { font: 600 23px Arial, sans-serif; fill: rgba(255,255,255,.68); }
      </style>
    </defs>
    <rect width="1920" height="1080" class="bg"/>
    <rect width="1920" height="1080" class="glow"/>
    ${Array.from({ length: 14 }, (_, i) => `<line x1="${i * 160}" x2="${i * 160 - 520}" y1="0" y2="1080" class="grid"/>`).join("")}
    <text x="102" y="104" class="eyebrow">NFL FABRIC ANALYTICS</text>
    <text x="102" y="177" class="headline">Build Progress</text>
    <text x="850" y="157" class="subhead">Step 1 complete: local Python environment is ready</text>
    ${cards}
    <text x="102" y="1016" class="footer">Completed steps fill green. Upcoming steps stay translucent. Manual semantic model path is intentionally skipped.</text>
  </svg>`;
}

function conceptB() {
  const startX = 94;
  const startY = 252;
  const cardW = 334;
  const cardH = 116;
  const gapX = 50;
  const gapY = 56;
  const cols = 4;

  const connectors = [];
  const cards = steps
    .map(([label, title], i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      if (col < cols - 1) {
        connectors.push(`<line x1="${x + cardW + 13}" y1="${y + cardH / 2}" x2="${x + cardW + gapX - 13}" y2="${y + cardH / 2}" class="b-connector"/>`);
      }
      const state = label === "1" ? "done" : label === "11b" ? "skipped" : "todo";
      const pulse = state === "done" ? `<rect x="${x - 8}" y="${y - 8}" width="${cardW + 16}" height="${cardH + 16}" rx="30" class="b-pulse"/>` : "";
      return `
        ${pulse}
        <g filter="url(#panelShadow)">
          <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="20" class="b-card ${state}"/>
        </g>
        <text x="${x + 26}" y="${y + 42}" class="b-step ${state}">${esc(label)}</text>
        ${wrap(title, 18)
          .map(
            (line, lineIndex) =>
              `<text x="${x + 86}" y="${y + 68 + lineIndex * 23}" class="b-title ${state}">${esc(line)}</text>`,
          )
          .join("")}
      `;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bgB" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#101219"/>
        <stop offset="45%" stop-color="#192734"/>
        <stop offset="100%" stop-color="#273b31"/>
      </linearGradient>
      <linearGradient id="doneB" x1="0" x2="1">
        <stop offset="0%" stop-color="#d5fb55"/>
        <stop offset="100%" stop-color="#3ed18c"/>
      </linearGradient>
      <filter id="panelShadow" x="-20%" y="-30%" width="140%" height="170%">
        <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity=".42"/>
      </filter>
      <style>
        .bg { fill: url(#bgB); }
        .yard { stroke: rgba(255,255,255,.075); stroke-width: 2; }
        .yard-strong { stroke: rgba(213,251,85,.18); stroke-width: 3; }
        .title { font: 900 72px Arial, sans-serif; fill: #f6f8ed; letter-spacing: 0; }
        .kicker { font: 800 22px Arial, sans-serif; fill: #d5fb55; letter-spacing: 3px; }
        .progress { font: 700 31px Arial, sans-serif; fill: rgba(246,248,237,.78); }
        .meter-bg { fill: rgba(255,255,255,.10); }
        .meter-fill { fill: url(#doneB); }
        .b-connector { stroke: rgba(255,255,255,.22); stroke-width: 3; stroke-linecap: round; stroke-dasharray: 2 11; }
        .b-pulse { fill: none; stroke: rgba(213,251,85,.55); stroke-width: 3; }
        .b-card.done { fill: url(#doneB); stroke: rgba(255,255,255,.65); }
        .b-card.todo { fill: rgba(247,250,242,.095); stroke: rgba(255,255,255,.18); }
        .b-card.skipped { fill: rgba(164,169,168,.14); stroke: rgba(255,255,255,.12); }
        .b-step { font: 900 38px Arial, sans-serif; letter-spacing: 0; }
        .b-step.done { fill: #121b19; }
        .b-step.todo { fill: rgba(246,248,237,.84); }
        .b-step.skipped { fill: rgba(246,248,237,.36); }
        .b-title { font: 800 20px Arial, sans-serif; letter-spacing: 0; }
        .b-title.done { fill: #121b19; }
        .b-title.todo { fill: rgba(246,248,237,.88); }
        .b-title.skipped { fill: rgba(246,248,237,.34); }
        .caption { font: 600 22px Arial, sans-serif; fill: rgba(246,248,237,.62); }
      </style>
    </defs>
    <rect width="1920" height="1080" class="bg"/>
    ${Array.from({ length: 11 }, (_, i) => `<line x1="${i * 192}" y1="0" x2="${i * 192}" y2="1080" class="${i % 5 === 0 ? "yard-strong" : "yard"}"/>`).join("")}
    <text x="94" y="106" class="kicker">DEPLOYMENT ROADMAP</text>
    <text x="94" y="176" class="title">From Repo to Fabric</text>
    <text x="94" y="222" class="progress">1 of 15 covered</text>
    <rect x="315" y="197" width="500" height="20" rx="10" class="meter-bg"/>
    <rect x="315" y="197" width="33" height="20" rx="10" class="meter-fill"/>
    ${connectors.join("")}
    ${cards}
    <text x="94" y="999" class="caption">Muted node: Step 11b is not covered in this video series.</text>
  </svg>`;
}

async function writeConcept(name, svg) {
  const svgPath = path.join(outDir, `${name}.svg`);
  const pngPath = path.join(outDir, `${name}.png`);
  await fs.writeFile(svgPath, svg);
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  console.log(`${pngPath}`);
}

await writeConcept("concept-a-step-01", conceptA());
await writeConcept("concept-b-step-01", conceptB());
