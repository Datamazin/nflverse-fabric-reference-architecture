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

function box({ x, y, w, h, label, title, subtitle, className = "node", icon }) {
  return `
    <g filter="url(#cardShadow)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" class="${className}"/>
    </g>
    ${icon ? `<text x="${x + 34}" y="${y + 50}" class="node-icon">${esc(icon)}</text>` : ""}
    <text x="${x + 34}" y="${y + (icon ? 92 : 50)}" class="node-label">${esc(label)}</text>
    <text x="${x + 34}" y="${y + (icon ? 132 : 90)}" class="node-title">${esc(title)}</text>
    ${textLines(subtitle, x + 34, y + (icon ? 166 : 124), "node-subtitle", 27)}
  `;
}

function medallion(x, y, w, h, title, subtitle, className) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" class="medallion ${className}"/>
    <text x="${x + w / 2}" y="${y + 44}" text-anchor="middle" class="medallion-title">${esc(title)}</text>
    <text x="${x + w / 2}" y="${y + 76}" text-anchor="middle" class="medallion-subtitle">${esc(subtitle)}</text>
  `;
}

function agentCard(x, y, title, subtitle, className) {
  return `
    <g filter="url(#cardShadow)">
      <rect x="${x}" y="${y}" width="344" height="118" rx="26" class="agent-card ${className}"/>
    </g>
    <circle cx="${x + 52}" cy="${y + 58}" r="27" class="agent-dot"/>
    <text x="${x + 52}" y="${y + 67}" text-anchor="middle" class="agent-dot-text">AI</text>
    <text x="${x + 94}" y="${y + 49}" class="agent-title">${esc(title)}</text>
    <text x="${x + 94}" y="${y + 81}" class="agent-subtitle">${esc(subtitle)}</text>
  `;
}

function renderSlide() {
  const rawX = 610;
  const bronzeX = 790;
  const silverX = 970;
  const goldX = 1150;

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
      <linearGradient id="fabricBand" x1="0" x2="1">
        <stop offset="0%" stop-color="rgba(24,196,143,.20)"/>
        <stop offset="100%" stop-color="rgba(126,242,200,.10)"/>
      </linearGradient>
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
      <marker id="arrow" markerWidth="4.5" markerHeight="4.5" refX="3" refY="1.5" orient="auto">
        <path d="M0,0 L3,1.5 L0,3 Z" fill="#83f3c8"/>
      </marker>
      <marker id="arrowDim" markerWidth="4.5" markerHeight="4.5" refX="3" refY="1.5" orient="auto">
        <path d="M0,0 L3,1.5 L0,3 Z" fill="rgba(236,247,255,.52)"/>
      </marker>
      <style>
        .bg { fill: url(#bgA); }
        .glow { fill: url(#glowA); }
        .grid { stroke: rgba(255,255,255,.075); stroke-width: 1; }
        .eyebrow { font: 700 28px Arial, sans-serif; fill: #83f3c8; letter-spacing: 3px; }
        .headline { font: 800 72px Arial, sans-serif; fill: #f8fbff; letter-spacing: 0; }
        .subhead { font: 400 30px Arial, sans-serif; fill: rgba(236,247,255,.78); }
        .fabric-shell { fill: url(#fabricBand); stroke: rgba(131,243,200,.42); stroke-width: 2; }
        .fabric-label { font: 800 30px Arial, sans-serif; fill: #83f3c8; letter-spacing: 2px; }
        .fabric-note { font: 600 21px Arial, sans-serif; fill: rgba(236,247,255,.70); }
        .node { fill: rgba(255,255,255,.12); stroke: rgba(255,255,255,.24); stroke-width: 1.5; }
        .node.source { fill: rgba(255,255,255,.10); stroke: rgba(255,255,255,.28); }
        .node.copilot { fill: rgba(244,197,66,.16); stroke: rgba(244,197,66,.58); }
        .node-icon { font: 800 34px Arial, sans-serif; fill: #83f3c8; }
        .node-label { font: 800 17px Arial, sans-serif; fill: #83f3c8; letter-spacing: 2px; }
        .node-title { font: 800 29px Arial, sans-serif; fill: #ffffff; letter-spacing: 0; }
        .node-subtitle { font: 600 20px Arial, sans-serif; fill: rgba(236,247,255,.72); }
        .arrow-line { stroke: #83f3c8; stroke-width: 5; stroke-linecap: round; marker-end: url(#arrow); }
        .arrow-dim { stroke: rgba(236,247,255,.52); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 8 12; marker-end: url(#arrowDim); }
        .stage-label { font: 800 18px Arial, sans-serif; fill: rgba(236,247,255,.70); letter-spacing: 2px; }
        .medallion { stroke: rgba(255,255,255,.45); stroke-width: 1.4; }
        .medallion.raw { fill: rgba(255,255,255,.13); }
        .medallion.bronze { fill: rgba(205,127,50,.62); }
        .medallion.silver { fill: rgba(195,205,214,.38); }
        .medallion.gold { fill: url(#goldFill); }
        .medallion-title { font: 800 25px Arial, sans-serif; fill: #ffffff; letter-spacing: 0; }
        .medallion-subtitle { font: 600 18px Arial, sans-serif; fill: rgba(255,255,255,.76); }
        .semantic-card { fill: url(#greenFill); stroke: rgba(255,255,255,.62); stroke-width: 1.5; }
        .semantic-title { font: 800 30px Arial, sans-serif; fill: #ffffff; }
        .semantic-subtitle { font: 600 20px Arial, sans-serif; fill: rgba(255,255,255,.80); }
        .agent-card { stroke: rgba(255,255,255,.42); stroke-width: 1.4; }
        .agent-card.semantic { fill: rgba(24,196,143,.68); }
        .agent-card.lakehouse { fill: rgba(255,255,255,.13); }
        .agent-dot { fill: rgba(255,255,255,.92); }
        .agent-dot-text { font: 800 17px Arial, sans-serif; fill: #0d6d55; }
        .agent-title { font: 800 24px Arial, sans-serif; fill: #ffffff; }
        .agent-subtitle { font: 600 18px Arial, sans-serif; fill: rgba(255,255,255,.74); }
        .eval { fill: rgba(4,18,28,.42); stroke: rgba(131,243,200,.34); stroke-width: 1.5; }
        .eval-title { font: 800 25px Arial, sans-serif; fill: #ffffff; }
        .eval-subtitle { font: 600 19px Arial, sans-serif; fill: rgba(236,247,255,.72); }
        .copilot-title { font: 800 30px Arial, sans-serif; fill: #ffe59b; }
        .footer { font: 600 23px Arial, sans-serif; fill: rgba(255,255,255,.68); }
      </style>
    </defs>
    <rect width="1920" height="1080" class="bg"/>
    <rect width="1920" height="1080" class="glow"/>
    ${Array.from({ length: 14 }, (_, i) => `<line x1="${i * 160}" x2="${i * 160 - 520}" y1="0" y2="1080" class="grid"/>`).join("")}

    <text x="102" y="104" class="eyebrow">NFL FABRIC ANALYTICS</text>
    <text x="102" y="178" class="headline">Solution Architecture</text>
    <text x="102" y="226" class="subhead">A simple walkthrough path from NFLVerse files to Copilot-ready data agents</text>

    ${box({
      x: 102,
      y: 400,
      w: 360,
      h: 220,
      label: "SOURCE",
      title: "NFLVerse data",
      subtitle: ["Python downloads play-by-play", "files for the seasons we need"],
      className: "node source",
      icon: "PY",
    })}

    ${arrow(470, 512, 570, 512)}

    <rect x="540" y="294" width="1074" height="472" rx="38" class="fabric-shell"/>
    <text x="584" y="350" class="fabric-label">MICROSOFT FABRIC PLATFORM</text>
    <text x="584" y="386" class="fabric-note">Lakehouse, notebooks, semantic model, data agents, and evaluation all live in the Fabric workspace.</text>

    <text x="610" y="448" class="stage-label">LAKEHOUSE MEDALLION FLOW</text>
    ${medallion(rawX, 478, 142, 106, "Raw", "files", "raw")}
    ${arrow(rawX + 150, 531, bronzeX - 12, 531)}
    ${medallion(bronzeX, 478, 142, 106, "Bronze", "imported", "bronze")}
    ${arrow(bronzeX + 150, 531, silverX - 12, 531)}
    ${medallion(silverX, 478, 142, 106, "Silver", "curated", "silver")}
    ${arrow(silverX + 150, 531, goldX - 12, 531)}
    ${medallion(goldX, 478, 142, 106, "Gold", "analytics", "gold")}

    ${arrow(goldX + 160, 531, 1350, 531)}
    <g filter="url(#cardShadow)">
      <rect x="1352" y="452" width="230" height="158" rx="28" class="semantic-card"/>
    </g>
    <text x="1467" y="506" text-anchor="middle" class="semantic-title">Semantic</text>
    <text x="1467" y="542" text-anchor="middle" class="semantic-title">Model</text>
    <text x="1467" y="578" text-anchor="middle" class="semantic-subtitle">business-friendly</text>
    <text x="1467" y="604" text-anchor="middle" class="semantic-subtitle">layer</text>

    ${agentCard(674, 628, "Semantic Model Agent", "answers governed measures", "semantic")}
    ${agentCard(1062, 628, "Lakehouse Agent", "answers table-level questions", "lakehouse")}

    ${arrow(1466, 618, 940, 658, "arrow-dim")}
    ${arrow(1224, 594, 1224, 626, "arrow-dim")}

    <g filter="url(#cardShadow)">
      <rect x="834" y="826" width="386" height="118" rx="30" class="node copilot"/>
    </g>
    <text x="1027" y="874" text-anchor="middle" class="copilot-title">M365 Copilot</text>
    <text x="1027" y="912" text-anchor="middle" class="node-subtitle">users access the Fabric data agents</text>
    ${arrow(846, 748, 938, 824)}
    ${arrow(1234, 748, 1114, 824)}

  </svg>`;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const svg = renderSlide();
  const svgPath = path.join(outDir, "00-introduction-architecture.svg");
  const pngPath = path.join(outDir, "00-introduction-architecture.png");
  await fs.writeFile(svgPath, svg);
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  console.log(pngPath);
}

await main();
