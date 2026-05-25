import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("/Users/rob/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");

const width = 1920;
const height = 1080;
const outDir = path.join(path.dirname(new URL(import.meta.url).pathname), "slides");

function esc(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function textLines(lines, x, y, className, lineHeight = 30) {
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" class="${className}">${esc(line)}</text>`)
    .join("");
}

function arrow(x1, y1, x2, y2, className = "arrow-line") {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${className}"/>`;
}

function processCard(x, y, w, h, label, title, subtitle, className = "process-card") {
  return `
    <g filter="url(#cardShadow)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" class="${className}"/>
    </g>
    <text x="${x + 34}" y="${y + 45}" class="card-label">${esc(label)}</text>
    <text x="${x + 34}" y="${y + 88}" class="card-title">${esc(title)}</text>
    ${textLines(subtitle, x + 34, y + 124, "card-subtitle", 27)}
  `;
}

function pill(x, y, w, label, className = "pill") {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="50" rx="25" class="${className}"/>
    <text x="${x + w / 2}" y="${y + 33}" text-anchor="middle" class="${className}-text">${esc(label)}</text>
  `;
}

function renderSlide() {
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
      <linearGradient id="greenFill" x1="0" x2="1">
        <stop offset="0%" stop-color="#18c48f"/>
        <stop offset="100%" stop-color="#1bc6a8"/>
      </linearGradient>
      <linearGradient id="goldFill" x1="0" x2="1">
        <stop offset="0%" stop-color="#f4c542"/>
        <stop offset="100%" stop-color="#e7a83f"/>
      </linearGradient>
      <filter id="cardShadow" x="-20%" y="-30%" width="140%" height="170%">
        <feDropShadow dx="0" dy="18" stdDeviation="17" flood-color="#020d13" flood-opacity=".36"/>
      </filter>
      <marker id="arrow" markerWidth="5" markerHeight="5" refX="3.4" refY="1.7" orient="auto">
        <path d="M0,0 L3.4,1.7 L0,3.4 Z" fill="#83f3c8"/>
      </marker>
      <marker id="arrowDim" markerWidth="5" markerHeight="5" refX="3.4" refY="1.7" orient="auto">
        <path d="M0,0 L3.4,1.7 L0,3.4 Z" fill="rgba(236,247,255,.56)"/>
      </marker>
      <style>
        .bg { fill: url(#bgA); }
        .glow { fill: url(#glowA); }
        .grid { stroke: rgba(255,255,255,.075); stroke-width: 1; }
        .eyebrow { font: 700 28px Arial, sans-serif; fill: #83f3c8; letter-spacing: 3px; }
        .headline { font: 800 72px Arial, sans-serif; fill: #f8fbff; letter-spacing: 0; }
        .subhead { font: 400 30px Arial, sans-serif; fill: rgba(236,247,255,.78); }
        .loop-shell { fill: rgba(4,18,28,.26); stroke: rgba(131,243,200,.32); stroke-width: 2; }
        .process-card { fill: rgba(255,255,255,.12); stroke: rgba(255,255,255,.24); stroke-width: 1.5; }
        .process-card.primary { fill: url(#greenFill); stroke: rgba(255,255,255,.68); }
        .process-card.gold { fill: rgba(244,197,66,.18); stroke: rgba(244,197,66,.58); }
        .card-label { font: 800 17px Arial, sans-serif; fill: #83f3c8; letter-spacing: 2px; }
        .primary .card-label { fill: rgba(255,255,255,.74); }
        .gold .card-label { fill: #ffe59b; }
        .card-title { font: 800 30px Arial, sans-serif; fill: #ffffff; letter-spacing: 0; }
        .card-subtitle { font: 600 20px Arial, sans-serif; fill: rgba(236,247,255,.72); }
        .primary .card-subtitle { fill: rgba(255,255,255,.78); }
        .arrow-line { stroke: #83f3c8; stroke-width: 5; stroke-linecap: round; marker-end: url(#arrow); }
        .arrow-dim { stroke: rgba(236,247,255,.56); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 8 12; marker-end: url(#arrowDim); }
        .loop-arrow { fill: none; stroke: #83f3c8; stroke-width: 6; stroke-linecap: round; stroke-dasharray: 1 13; marker-end: url(#arrow); }
        .pill { fill: rgba(255,255,255,.14); stroke: rgba(255,255,255,.26); stroke-width: 1; }
        .pill-text { font: 800 22px Arial, sans-serif; fill: #ffffff; }
        .agent-dot { fill: rgba(255,255,255,.92); }
        .agent-dot-text { font: 800 20px Arial, sans-serif; fill: #0d6d55; }
        .bottom-note { font: 800 28px Arial, sans-serif; fill: rgba(236,247,255,.76); letter-spacing: 0; }
      </style>
    </defs>
    <rect width="1920" height="1080" class="bg"/>
    <rect width="1920" height="1080" class="glow"/>
    ${Array.from({ length: 14 }, (_, i) => `<line x1="${i * 160}" x2="${i * 160 - 520}" y1="0" y2="1080" class="grid"/>`).join("")}

    <text x="102" y="104" class="eyebrow">NFL FABRIC ANALYTICS</text>
    <text x="102" y="178" class="headline">Data Agent Improvement Loop</text>
    <text x="102" y="226" class="subhead">Accuracy improves by iterating on instructions, examples, and evaluation results</text>

    <rect x="108" y="294" width="1704" height="598" rx="44" class="loop-shell"/>

    ${processCard(154, 390, 330, 168, "START", "Data source", ["Lakehouse tables or", "semantic model measures"])}
    ${arrow(502, 474, 602, 474)}

    ${processCard(628, 390, 330, 168, "BUILD", "Data agent", ["Connect the source and", "define the agent boundary"], "process-card primary")}
    <circle cx="880" cy="430" r="30" class="agent-dot"/>
    <text x="880" y="438" text-anchor="middle" class="agent-dot-text">AI</text>
    ${arrow(976, 474, 1076, 474)}

    ${processCard(1102, 334, 330, 150, "REFINE", "Instructions", ["Terms, business rules,", "guardrails, and intent"])}
    ${arrow(1267, 500, 1267, 574)}

    ${processCard(1102, 604, 330, 150, "EXAMPLES", "Sample queries", ["Expected questions and", "good answer patterns"])}
    ${arrow(1448, 679, 1548, 679)}

    ${processCard(1570, 492, 206, 188, "CHECK", "Evaluate", ["Run tests,", "review misses,", "score quality"], "process-card gold")}

    <path d="M1572,492 C1536,302 1138,252 946,352" class="loop-arrow"/>
    <path d="M1572,680 C1484,870 1194,872 952,744" class="loop-arrow"/>

    ${pill(192, 630, 232, "Semantic model")}
    ${pill(192, 694, 232, "Data lake")}

    <text x="958" y="958" text-anchor="middle" class="bottom-note">Evaluate results, tune guidance and examples, then run the checks again.</text>
  </svg>`;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const svg = renderSlide();
  const svgPath = path.join(outDir, "18-data-agent-improvement-loop.svg");
  const pngPath = path.join(outDir, "18-data-agent-improvement-loop.png");
  await fs.writeFile(svgPath, svg);
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  console.log(pngPath);
}

await main();
