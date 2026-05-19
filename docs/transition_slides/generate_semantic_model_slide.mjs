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

function textLines(lines, x, y, className, lineHeight = 28) {
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" class="${className}">${esc(line)}</text>`)
    .join("");
}

function pill(x, y, w, h, label, className = "dim-pill") {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" class="${className}"/>
    <text x="${x + w / 2}" y="${y + h / 2 + 8}" text-anchor="middle" class="${className}-text">${esc(label)}</text>
  `;
}

function factCard(x, y, w, h, title, subtitle, accentClass) {
  return `
    <g filter="url(#cardShadow)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" class="fact-card ${accentClass}"/>
    </g>
    <text x="${x + 28}" y="${y + 47}" class="fact-title">${esc(title)}</text>
    <text x="${x + 28}" y="${y + 81}" class="fact-subtitle">${esc(subtitle)}</text>
  `;
}

function miniFact(x, y, title, subtitle) {
  return `
    <rect x="${x}" y="${y}" width="254" height="76" rx="18" class="mini-card"/>
    <text x="${x + 22}" y="${y + 32}" class="mini-title">${esc(title)}</text>
    <text x="${x + 22}" y="${y + 58}" class="mini-subtitle">${esc(subtitle)}</text>
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
      <marker id="arrow" markerWidth="18" markerHeight="18" refX="12" refY="6" orient="auto">
        <path d="M0,0 L12,6 L0,12 Z" fill="#83f3c8"/>
      </marker>
      <style>
        .bg { fill: url(#bgA); }
        .glow { fill: url(#glowA); }
        .grid { stroke: rgba(255,255,255,.075); stroke-width: 1; }
        .eyebrow { font: 700 28px Arial, sans-serif; fill: #83f3c8; letter-spacing: 3px; }
        .headline { font: 800 64px Arial, sans-serif; fill: #f8fbff; letter-spacing: 0; }
        .subhead { font: 400 30px Arial, sans-serif; fill: rgba(236,247,255,.78); }
        .section-label { font: 800 18px Arial, sans-serif; fill: #83f3c8; letter-spacing: 2px; }
        .source-card { fill: rgba(255,255,255,.12); stroke: rgba(255,255,255,.24); stroke-width: 1.5; }
        .source-title { font: 800 30px Arial, sans-serif; fill: #ffffff; letter-spacing: 0; }
        .source-subtitle { font: 600 22px Arial, sans-serif; fill: rgba(236,247,255,.72); }
        .source-line { stroke: rgba(255,255,255,.16); stroke-width: 3; stroke-linecap: round; }
        .arrow-line { stroke: #83f3c8; stroke-width: 5; stroke-linecap: round; marker-end: url(#arrow); }
        .arrow-label { font: 800 20px Arial, sans-serif; fill: #83f3c8; letter-spacing: 1.4px; }
        .dim-band { fill: rgba(4,18,28,.38); stroke: rgba(131,243,200,.34); stroke-width: 1.5; }
        .dim-pill { fill: rgba(255,255,255,.14); stroke: rgba(255,255,255,.24); stroke-width: 1; }
        .dim-pill-text { font: 800 23px Arial, sans-serif; fill: #ffffff; letter-spacing: 0; }
        .dim-note { font: 600 21px Arial, sans-serif; fill: rgba(236,247,255,.72); }
        .dim-line { stroke: rgba(131,243,200,.28); stroke-width: 3; stroke-linecap: round; stroke-dasharray: 2 12; }
        .star-shell { fill: rgba(255,255,255,.07); stroke: rgba(255,255,255,.18); stroke-width: 1.5; }
        .fact-card { stroke: rgba(255,255,255,.55); stroke-width: 1.5; }
        .fact-card.primary { fill: url(#greenFill); }
        .fact-card.secondary { fill: rgba(24,196,143,.72); }
        .fact-card.special { fill: rgba(27,198,168,.58); }
        .fact-title { font: 800 26px Arial, sans-serif; fill: #ffffff; letter-spacing: 0; }
        .fact-subtitle { font: 600 19px Arial, sans-serif; fill: rgba(255,255,255,.78); }
        .mini-card { fill: rgba(255,255,255,.12); stroke: rgba(255,255,255,.22); stroke-width: 1.2; }
        .mini-title { font: 800 19px Arial, sans-serif; fill: #ffffff; letter-spacing: 0; }
        .mini-subtitle { font: 600 16px Arial, sans-serif; fill: rgba(236,247,255,.68); }
        .callout { fill: rgba(244,197,66,.16); stroke: rgba(244,197,66,.56); stroke-width: 1.5; }
        .callout-title { font: 800 27px Arial, sans-serif; fill: #ffe59b; letter-spacing: 0; }
        .callout-copy { font: 600 20px Arial, sans-serif; fill: rgba(255,246,218,.78); }
        .footer { font: 600 23px Arial, sans-serif; fill: rgba(255,255,255,.68); }
      </style>
    </defs>
    <rect width="1920" height="1080" class="bg"/>
    <rect width="1920" height="1080" class="glow"/>
    ${Array.from({ length: 14 }, (_, i) => `<line x1="${i * 160}" x2="${i * 160 - 520}" y1="0" y2="1080" class="grid"/>`).join("")}

    <text x="102" y="104" class="eyebrow">NFL FABRIC ANALYTICS</text>
    <text x="102" y="176" class="headline">Semantic Model Design</text>
    <text x="102" y="220" class="subhead">Wide play-by-play data becomes focused stars over shared dimensions</text>

    <text x="102" y="258" class="section-label">SOURCE GRAIN</text>
    <g filter="url(#cardShadow)">
      <rect x="102" y="284" width="330" height="542" rx="34" class="source-card"/>
    </g>
    <text x="142" y="346" class="source-title">Bronze PBP</text>
    <text x="142" y="382" class="source-subtitle">one very wide table</text>
    ${Array.from({ length: 15 }, (_, i) => `<line x1="142" x2="${392 - (i % 3) * 28}" y1="${428 + i * 23}" y2="${428 + i * 23}" class="source-line"/>`).join("")}
    <rect x="142" y="724" width="250" height="48" rx="24" class="mini-card"/>
    <text x="267" y="756" text-anchor="middle" class="mini-title">many columns, many meanings</text>

    <line x1="470" y1="555" x2="620" y2="555" class="arrow-line"/>
    <text x="475" y="523" class="arrow-label">CURATE BY GRAIN</text>

    <text x="650" y="258" class="section-label">CONFORMED DIMENSIONS</text>
    <rect x="650" y="284" width="1084" height="106" rx="30" class="dim-band"/>
    ${pill(690, 314, 200, 48, "Team")}
    ${pill(920, 314, 200, 48, "Game")}
    ${pill(1150, 314, 200, 48, "Player")}
    ${pill(1380, 314, 260, 48, "Season Week")}
    <text x="650" y="426" class="dim-note">The same dimensions filter each focused fact table, so users get consistent seasons, teams, games, and players.</text>
    <line x1="790" y1="390" x2="790" y2="819" class="dim-line"/>
    <line x1="1020" y1="390" x2="1020" y2="819" class="dim-line"/>
    <line x1="1250" y1="390" x2="1250" y2="819" class="dim-line"/>
    <line x1="1510" y1="390" x2="1510" y2="819" class="dim-line"/>

    <text x="650" y="490" class="section-label">FOCUSED FACT STARS</text>
    <rect x="650" y="514" width="1084" height="312" rx="36" class="star-shell"/>
    ${factCard(690, 550, 314, 106, "Team Play", "offense / defense play view", "primary")}
    ${factCard(1032, 550, 314, 106, "Play Detail", "core play context", "secondary")}
    ${factCard(1374, 550, 314, 106, "Player Play Role", "players attached to plays", "special")}
    ${miniFact(690, 692, "Passing Play", "dropbacks, yards, EPA")}
    ${miniFact(974, 692, "Rushing Play", "attempts, yards, EPA")}
    ${miniFact(1258, 692, "Penalty", "accepted flags and yards")}
    ${miniFact(1542, 692, "Special Teams", "kicks, punts, returns")}

    <g filter="url(#cardShadow)">
      <rect x="102" y="852" width="760" height="122" rx="28" class="callout"/>
    </g>
    <text x="140" y="898" class="callout-title">Performance pattern</text>
    ${textLines(["Power BI scans narrower facts instead of one wide play table.", "Measures stay closer to the grain they are meant to answer."], 140, 934, "callout-copy", 27)}

    <g filter="url(#cardShadow)">
      <rect x="900" y="852" width="834" height="122" rx="28" class="source-card"/>
    </g>
    <text x="938" y="898" class="callout-title">Aggregates for common questions</text>
    ${textLines(["Team Game, Team Season, Team Situation, and Player Season summaries", "serve leaderboard and trend questions without replaying every snap."], 938, 934, "callout-copy", 27)}

    <text x="102" y="1030" class="footer">Design goal: multiple smaller stars, shared dimensions, faster import-mode reporting, and clearer Data Agent semantics.</text>
  </svg>`;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const svg = renderSlide();
  const svgPath = path.join(outDir, "17-semantic-model-design.svg");
  const pngPath = path.join(outDir, "17-semantic-model-design.png");
  await fs.writeFile(svgPath, svg);
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  console.log(pngPath);
}

await main();
