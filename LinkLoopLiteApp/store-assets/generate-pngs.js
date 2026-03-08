#!/usr/bin/env node
/**
 * LinkLoop T1D — Store Asset PNG Generator v2
 * Full-screen, content-rich mockups matching real app UI.
 *
 * Usage:  node generate-pngs.js
 * Requires: npm install canvas
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// ── Brand Colors ──
const C = {
  bg:      '#0A0A0F',
  bg2:     '#0D0D18',
  accent:  '#4A90D9',
  accent2: '#3A7BC8',
  green:   '#34C759',
  red:     '#FF3B30',
  orange:  '#FFA500',
  yellow:  '#FFD60A',
  cyan:    '#00D4FF',
  pink:    '#FF6B6B',
  purple:  '#9B59B6',
  white:   '#FFFFFF',
  gray:    '#888888',
  dimGray: '#555555',
  card:    'rgba(255,255,255,0.06)',
  cardSolid: '#15151F',
  cardBorder: 'rgba(255,255,255,0.08)',
};

// ════════════════════════════════════════════
// Drawing Primitives
// ════════════════════════════════════════════

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r, color) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRR(ctx, x, y, w, h, r, color, lw) {
  rr(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw || 1;
  ctx.stroke();
}

function circle(ctx, cx, cy, r, color) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function arc(ctx, cx, cy, r, startAngle, endAngle, color, lw) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', ly = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxW && line !== '') {
      ctx.fillText(line.trim(), x, ly);
      line = word + ' ';
      ly += lh;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, ly);
  return ly;
}

function hexA(hex, a) {
  if (hex.startsWith('rgba')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ════════════════════════════════════════════
// Shared UI Components
// ════════════════════════════════════════════

function drawBg(ctx, w, h) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);
}

function drawBloomHero(ctx, w, heroH, s, accentColor, secondaryColor) {
  const g = ctx.createLinearGradient(0, 0, 0, heroH);
  g.addColorStop(0, C.bg2);
  g.addColorStop(1, C.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, heroH);
  const rg1 = ctx.createRadialGradient(w * 0.3, heroH * 0.3, 0, w * 0.3, heroH * 0.3, heroH * 0.8);
  rg1.addColorStop(0, hexA(accentColor, 0.25));
  rg1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg1;
  ctx.fillRect(0, 0, w, heroH);
  const rg2 = ctx.createRadialGradient(w * 0.7, heroH * 0.7, 0, w * 0.7, heroH * 0.7, heroH * 0.6);
  rg2.addColorStop(0, hexA(secondaryColor || accentColor, 0.15));
  rg2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg2;
  ctx.fillRect(0, 0, w, heroH);
  const bf = ctx.createLinearGradient(0, heroH - 60 * s, 0, heroH);
  bf.addColorStop(0, 'rgba(10,10,15,0)');
  bf.addColorStop(1, C.bg);
  ctx.fillStyle = bf;
  ctx.fillRect(0, heroH - 60 * s, w, 60 * s);
}

function drawStatusBar(ctx, w, s) {
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${26 * s}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('9:41', 48 * s, 54 * s);
  fillRR(ctx, w - 72 * s, 38 * s, 48 * s, 20 * s, 4 * s, 'rgba(255,255,255,0.25)');
  fillRR(ctx, w - 70 * s, 40 * s, 36 * s, 16 * s, 3 * s, '#fff');
  for (let i = 0; i < 4; i++) {
    circle(ctx, w - 150 * s + i * 16 * s, 48 * s, 4 * s, '#fff');
  }
  ctx.textAlign = 'left';
}

function drawGlassCard(ctx, x, y, w, h, s, accent, glow) {
  if (glow) {
    ctx.save();
    ctx.shadowColor = accent || C.accent;
    ctx.shadowBlur = 20 * s;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    fillRR(ctx, x, y, w, h, 20 * s, C.cardSolid);
    ctx.restore();
  } else {
    fillRR(ctx, x, y, w, h, 20 * s, C.cardSolid);
  }
  strokeRR(ctx, x, y, w, h, 20 * s, accent ? hexA(accent, 0.15) : C.cardBorder, 1);
}

function drawGlucoseRing(ctx, cx, cy, size, s, value, trend, color) {
  const radius = size / 2 - 6 * s;
  arc(ctx, cx, cy, radius, 0, Math.PI * 2, 'rgba(255,255,255,0.06)', 8 * s);
  const progress = Math.min(1, (value - 40) / 260);
  arc(ctx, cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, color, 8 * s);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${size * 0.35}px sans-serif`;
  ctx.fillText(value + '', cx, cy + size * 0.08);
  ctx.fillStyle = color;
  ctx.font = `bold ${size * 0.16}px sans-serif`;
  ctx.fillText(trend, cx, cy + size * 0.24);
  ctx.fillStyle = '#888';
  ctx.font = `${size * 0.11}px sans-serif`;
  ctx.fillText('mg/dL', cx, cy + size * 0.38);
  ctx.textAlign = 'left';
}

function drawTabBar(ctx, w, h, s, activeIdx) {
  const tH = 90 * s;
  const tY = h - tH;
  fillRR(ctx, 0, tY, w, tH, 0, 'rgba(15,15,22,0.97)');
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, tY);
  ctx.lineTo(w, tY);
  ctx.stroke();
  const tabs = [
    { icon: '⌂', label: 'Home' },
    { icon: '◎', label: 'CGM' },
    { icon: '+', label: 'Log' },
    { icon: '♡', label: 'Circle' },
    { icon: '⚙', label: 'Profile' },
  ];
  tabs.forEach((t, i) => {
    const tx = (w / 5) * i + w / 10;
    const isActive = i === activeIdx;
    ctx.textAlign = 'center';
    ctx.fillStyle = isActive ? C.accent : '#555';
    ctx.font = `${22 * s}px sans-serif`;
    ctx.fillText(t.icon, tx, tY + 35 * s);
    ctx.font = `600 ${16 * s}px sans-serif`;
    ctx.fillText(t.label, tx, tY + 60 * s);
    if (isActive) {
      fillRR(ctx, tx - 15 * s, tY + 4 * s, 30 * s, 3 * s, 2 * s, C.accent);
    }
  });
  ctx.textAlign = 'left';
}

function drawScreenHeader(ctx, w, y, s, title, subtitle) {
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${28 * s}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(title, 24 * s, y);
  if (subtitle) {
    ctx.fillStyle = '#888';
    ctx.font = `${18 * s}px sans-serif`;
    ctx.fillText(subtitle, 24 * s, y + 30 * s);
  }
}

function drawPill(ctx, x, y, text, bgColor, textColor, s) {
  ctx.font = `600 ${16 * s}px sans-serif`;
  const tw = ctx.measureText(text).width + 20 * s;
  fillRR(ctx, x, y, tw, 28 * s, 14 * s, bgColor);
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 10 * s, y + 19 * s);
  return tw;
}

// Caption overlay at top
function drawCaption(ctx, w, h, s, line1, line2) {
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.18);
  g.addColorStop(0, 'rgba(10,10,15,0.97)');
  g.addColorStop(0.7, 'rgba(10,10,15,0.6)');
  g.addColorStop(1, 'rgba(10,10,15,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * 0.18);
  const topY = 44 * s;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${42 * s}px sans-serif`;
  ctx.fillText(line1, w / 2, topY + 40 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `${24 * s}px sans-serif`;
  ctx.fillText(line2, w / 2, topY + 74 * s);
  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════
// Screen: HOME
// ════════════════════════════════════════════
function drawHome(ctx, w, h) {
  const s = w / 1290;
  drawBg(ctx, w, h);

  const heroH = 280 * s;
  drawBloomHero(ctx, w, heroH, s, C.accent, C.green);
  drawStatusBar(ctx, w, s);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${38 * s}px sans-serif`;
  ctx.fillText('∞ LinkLoop', w / 2, 130 * s);
  fillRR(ctx, w / 2 - 180 * s, 150 * s, 360 * s, 40 * s, 20 * s, 'rgba(255,255,255,0.15)');
  ctx.fillStyle = '#fff';
  ctx.font = `${20 * s}px sans-serif`;
  ctx.fillText('Welcome back, Kevin', w / 2, 176 * s);
  ctx.textAlign = 'left';

  const pad = 24 * s;
  let y = heroH + 12 * s;

  // ─── Glucose Ring Card (Glow) ───
  const glucCardH = 220 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, glucCardH, s, C.accent, true);
  ctx.fillStyle = '#999';
  ctx.font = `600 ${14 * s}px sans-serif`;
  ctx.fillText('CURRENT GLUCOSE', pad + 24 * s, y + 30 * s);
  circle(ctx, pad + 200 * s, y + 25 * s, 5 * s, C.green);
  drawGlucoseRing(ctx, pad + 110 * s, y + 130 * s, 160 * s, s, 118, '→', C.accent);
  const rx = pad + 210 * s;
  drawPill(ctx, rx, y + 60 * s, 'IN RANGE', hexA(C.accent, 0.15), C.accent, s);
  ctx.fillStyle = '#888';
  ctx.font = `${20 * s}px sans-serif`;
  ctx.fillText('9:38 AM', rx, y + 120 * s);
  ctx.fillStyle = '#555';
  ctx.font = `${16 * s}px sans-serif`;
  ctx.fillText('Tap for details', rx, y + 150 * s);
  ctx.fillStyle = C.accent;
  ctx.font = `bold ${24 * s}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('Stable →', w - pad - 24 * s, y + 45 * s);
  ctx.textAlign = 'left';
  y += glucCardH + 16 * s;

  // ─── Today's Average Card ───
  const avgH = 110 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, avgH, s);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${22 * s}px sans-serif`;
  ctx.fillText("Today's Average", pad + 24 * s, y + 34 * s);
  ctx.fillStyle = C.accent;
  ctx.font = `bold ${42 * s}px sans-serif`;
  ctx.fillText('118', pad + 24 * s, y + 82 * s);
  ctx.fillStyle = '#888';
  ctx.font = `${20 * s}px sans-serif`;
  ctx.fillText('mg/dL', pad + 110 * s, y + 82 * s);
  fillRR(ctx, w - pad - 170 * s, y + 60 * s, 145 * s, 32 * s, 16 * s, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = '#999';
  ctx.font = `${16 * s}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('12 readings today', w - pad - 97 * s, y + 81 * s);
  ctx.textAlign = 'left';
  y += avgH + 16 * s;

  // ─── Active Alerts Banner ───
  const alertH = 60 * s;
  fillRR(ctx, pad, y, w - pad * 2, alertH, 14 * s, hexA(C.green, 0.08));
  strokeRR(ctx, pad, y, w - pad * 2, alertH, 14 * s, hexA(C.green, 0.2), 1);
  ctx.fillStyle = C.green;
  ctx.font = `bold ${18 * s}px sans-serif`;
  ctx.fillText('All clear — no active alerts', pad + 24 * s, y + 36 * s);
  y += alertH + 16 * s;

  // ─── Quick Actions ───
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${22 * s}px sans-serif`;
  ctx.fillText('Quick Actions', pad, y + 22 * s);
  y += 40 * s;
  const qaW = (w - pad * 2 - 18 * s) / 4;
  const qaH = 90 * s;
  const qaItems = [
    { emoji: '💬', label: 'Messages' },
    { emoji: '✨', label: 'Insights' },
    { emoji: '😊', label: 'Mood' },
    { emoji: '🔔', label: 'Alerts' },
  ];
  qaItems.forEach((qa, i) => {
    const qx = pad + i * (qaW + 6 * s);
    drawGlassCard(ctx, qx, y, qaW, qaH, s);
    ctx.textAlign = 'center';
    ctx.font = `${28 * s}px sans-serif`;
    ctx.fillText(qa.emoji, qx + qaW / 2, y + 38 * s);
    ctx.fillStyle = '#B0B0B0';
    ctx.font = `600 ${14 * s}px sans-serif`;
    ctx.fillText(qa.label, qx + qaW / 2, y + 62 * s);
    ctx.textAlign = 'left';
  });
  y += qaH + 20 * s;

  // ─── Explore Row ───
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${22 * s}px sans-serif`;
  ctx.fillText('Explore', pad, y + 22 * s);
  y += 40 * s;
  const exItems = [
    { emoji: '🤖', label: 'Ask Loop' },
    { emoji: '📖', label: 'Story' },
    { emoji: '📊', label: 'Report' },
    { emoji: '🏆', label: 'Challenges' },
  ];
  exItems.forEach((ex, i) => {
    const qx = pad + i * (qaW + 6 * s);
    drawGlassCard(ctx, qx, y, qaW, qaH, s);
    ctx.textAlign = 'center';
    ctx.font = `${28 * s}px sans-serif`;
    ctx.fillText(ex.emoji, qx + qaW / 2, y + 38 * s);
    ctx.fillStyle = '#B0B0B0';
    ctx.font = `600 ${14 * s}px sans-serif`;
    ctx.fillText(ex.label, qx + qaW / 2, y + 62 * s);
    ctx.textAlign = 'left';
  });
  y += qaH + 20 * s;

  // ─── Recent Activity Card ───
  const raH = 200 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, raH, s);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${20 * s}px sans-serif`;
  ctx.fillText('📋 Recent Activity', pad + 24 * s, y + 34 * s);
  const activities = [
    { text: 'Glucose reading logged: 118 mg/dL', time: '9:38 AM', color: C.accent },
    { text: 'Challenge progress: 5/7 days complete', time: '9:00 AM', color: C.green },
    { text: 'Sarah viewed your glucose', time: '8:45 AM', color: C.pink },
    { text: 'AI Insight: Overnight control strong', time: '8:00 AM', color: C.purple },
  ];
  activities.forEach((a, i) => {
    const ay = y + 56 * s + i * 36 * s;
    circle(ctx, pad + 36 * s, ay, 4 * s, a.color);
    ctx.fillStyle = '#ccc';
    ctx.font = `${16 * s}px sans-serif`;
    ctx.fillText(a.text, pad + 52 * s, ay + 5 * s);
    ctx.fillStyle = '#555';
    ctx.font = `${14 * s}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(a.time, w - pad - 24 * s, ay + 5 * s);
    ctx.textAlign = 'left';
  });
  y += raH + 16 * s;

  // ─── Disclaimer Card ───
  const discH = 80 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, discH, s);
  ctx.fillStyle = '#888';
  ctx.font = `${16 * s}px sans-serif`;
  wrapText(ctx, 'LinkLoop is a wellness companion — not a medical device. Always consult your care team for treatment decisions.', pad + 24 * s, y + 30 * s, w - pad * 2 - 60 * s, 22 * s);

  drawTabBar(ctx, w, h, s, 0);
  drawCaption(ctx, w, h, s, 'Everything in one place', 'Your glucose dashboard at a glance');
}

// ════════════════════════════════════════════
// Screen: CGM / GLUCOSE
// ════════════════════════════════════════════
function drawGlucose(ctx, w, h) {
  const s = w / 1290;
  drawBg(ctx, w, h);

  const heroH = 380 * s;
  drawBloomHero(ctx, w, heroH, s, C.accent, C.accent2);
  drawStatusBar(ctx, w, s);

  drawGlucoseRing(ctx, w / 2, 210 * s, 220 * s, s, 112, '→', C.accent);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  ctx.font = `${18 * s}px sans-serif`;
  ctx.fillText('Dexcom G7 · 9:38 AM', w / 2, 340 * s);
  ctx.textAlign = 'left';

  const pad = 24 * s;
  let y = heroH + 10 * s;

  // ─── Log Reading Button ───
  const btnH = 54 * s;
  const bg = ctx.createLinearGradient(pad, y, w - pad, y);
  bg.addColorStop(0, C.accent);
  bg.addColorStop(1, C.accent2);
  rr(ctx, pad, y, w - pad * 2, btnH, 16 * s);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${20 * s}px sans-serif`;
  ctx.fillText('Log Glucose Reading', w / 2, y + 34 * s);
  ctx.textAlign = 'left';
  y += btnH + 20 * s;

  // ─── Chart Card ───
  const chartH = 280 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, chartH, s, C.accent);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${20 * s}px sans-serif`;
  ctx.fillText("Today's Readings", pad + 24 * s, y + 34 * s);

  const cL = pad + 50 * s;
  const cR = w - pad - 24 * s;
  const cT = y + 60 * s;
  const cB = y + chartH - 30 * s;
  const cW = cR - cL;
  const cH = cB - cT;

  // Range zones
  ctx.fillStyle = 'rgba(255,59,48,0.04)';
  ctx.fillRect(cL, cT, cW, cH * 0.25);
  ctx.fillStyle = 'rgba(52,199,89,0.06)';
  ctx.fillRect(cL, cT + cH * 0.25, cW, cH * 0.5);
  ctx.fillStyle = 'rgba(255,149,0,0.04)';
  ctx.fillRect(cL, cT + cH * 0.75, cW, cH * 0.25);

  ctx.setLineDash([4 * s, 3 * s]);
  ctx.strokeStyle = 'rgba(255,100,100,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cL, cT + cH * 0.25);
  ctx.lineTo(cR, cT + cH * 0.25);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,149,0,0.2)';
  ctx.beginPath();
  ctx.moveTo(cL, cT + cH * 0.75);
  ctx.lineTo(cR, cT + cH * 0.75);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = `${14 * s}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('250', cL - 6 * s, cT + 14 * s);
  ctx.fillText('180', cL - 6 * s, cT + cH * 0.25 + 8 * s);
  ctx.fillText('70', cL - 6 * s, cT + cH * 0.75 + 8 * s);
  ctx.textAlign = 'left';

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = `${12 * s}px sans-serif`;
  ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'].forEach((t, i) => {
    ctx.fillText(t, cL + (cW / 7) * i, cB + 18 * s);
  });
  ctx.textAlign = 'left';

  const pts = [128, 135, 142, 138, 155, 168, 172, 160, 145, 132, 125, 118, 122, 128, 120, 115, 108, 112, 115, 118, 112];
  ctx.beginPath();
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 3 * s;
  ctx.lineJoin = 'round';
  pts.forEach((v, i) => {
    const x = cL + (cW / (pts.length - 1)) * i;
    const py = cT + cH * (1 - (v - 40) / 260);
    if (i === 0) ctx.moveTo(x, py);
    else ctx.lineTo(x, py);
  });
  ctx.stroke();
  ctx.lineTo(cR, cB);
  ctx.lineTo(cL, cB);
  ctx.closePath();
  const fg = ctx.createLinearGradient(0, cT, 0, cB);
  fg.addColorStop(0, hexA(C.accent, 0.12));
  fg.addColorStop(1, hexA(C.accent, 0));
  ctx.fillStyle = fg;
  ctx.fill();
  const lastPt = pts[pts.length - 1];
  const dotX = cR;
  const dotY = cT + cH * (1 - (lastPt - 40) / 260);
  circle(ctx, dotX, dotY, 6 * s, C.accent);
  ctx.beginPath();
  ctx.arc(dotX, dotY, 6 * s, 0, Math.PI * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  y += chartH + 16 * s;

  // ─── Stats Arcs Card ───
  const statsH = 180 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, statsH, s, C.accent);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${20 * s}px sans-serif`;
  ctx.fillText("Today's Stats", pad + 24 * s, y + 34 * s);

  const arcSize = (w - pad * 2 - 80 * s) / 4;
  const arcY = y + 60 * s;
  const arcs = [
    { val: 78, max: 100, label: 'In Range', suf: '%', color: C.accent },
    { val: 118, max: 300, label: 'Avg mg/dL', suf: '', color: C.orange },
    { val: 3, max: 10, label: 'Highs', suf: '', color: C.orange },
    { val: 1, max: 10, label: 'Lows', suf: '', color: C.pink },
  ];
  arcs.forEach((a, i) => {
    const ax = pad + 40 * s + i * (arcSize + 6 * s) + arcSize / 2;
    const ay = arcY + arcSize / 2;
    const ar = arcSize * 0.38;
    arc(ctx, ax, ay, ar, 0, Math.PI * 2, 'rgba(255,255,255,0.06)', 6 * s);
    const prog = Math.min(1, a.val / a.max);
    arc(ctx, ax, ay, ar, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog, a.color, 6 * s);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${20 * s}px sans-serif`;
    ctx.fillText(a.val + a.suf, ax, ay + 7 * s);
    ctx.fillStyle = '#888';
    ctx.font = `${12 * s}px sans-serif`;
    ctx.fillText(a.label, ax, ay + ar + 22 * s);
    ctx.textAlign = 'left';
  });
  y += statsH + 16 * s;

  // ─── Connected Devices Card ───
  const devH = 200 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, devH, s, C.accent);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${20 * s}px sans-serif`;
  ctx.fillText('Connected Devices', pad + 24 * s, y + 34 * s);

  const dy = y + 66 * s;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${18 * s}px sans-serif`;
  ctx.fillText('Dexcom G7', pad + 30 * s, dy);
  ctx.fillStyle = C.accent;
  ctx.font = `${16 * s}px sans-serif`;
  ctx.fillText('Connected · Last sync 2m ago', pad + 30 * s, dy + 24 * s);
  circle(ctx, w - pad - 40 * s, dy + 6 * s, 6 * s, C.green);

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad + 24 * s, dy + 50 * s);
  ctx.lineTo(w - pad - 24 * s, dy + 50 * s);
  ctx.stroke();

  const my = dy + 70 * s;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${18 * s}px sans-serif`;
  ctx.fillText('Manual Entry', pad + 30 * s, my);
  ctx.fillStyle = '#888';
  ctx.font = `${16 * s}px sans-serif`;
  ctx.fillText('Last log: 9:38 AM', pad + 30 * s, my + 24 * s);
  circle(ctx, w - pad - 40 * s, my + 6 * s, 6 * s, C.accent);

  drawTabBar(ctx, w, h, s, 1);
  drawCaption(ctx, w, h, s, 'Real-time glucose tracking', 'Dexcom CGM integration with trend charts');
}

// ════════════════════════════════════════════
// Screen: AI INSIGHTS
// ════════════════════════════════════════════
function drawInsights(ctx, w, h) {
  const s = w / 1290;
  drawBg(ctx, w, h);
  drawStatusBar(ctx, w, s);

  const pad = 24 * s;
  let y = 80 * s;

  drawScreenHeader(ctx, w, y + 10 * s, s, 'AI Insights', 'Pattern analysis powered by AI');
  y += 60 * s;

  // ─── Motivation Card (accent bg) ───
  const motH = 120 * s;
  fillRR(ctx, pad, y, w - pad * 2, motH, 20 * s, C.accent);
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${16 * s}px sans-serif`;
  ctx.fillText('Daily Motivation', pad + 24 * s, y + 30 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `${18 * s}px sans-serif`;
  wrapText(ctx, 'You logged 12 readings today and kept 78% in range. That consistency is building real momentum. Keep going!', pad + 24 * s, y + 58 * s, w - pad * 2 - 50 * s, 26 * s);
  y += motH + 16 * s;

  // ─── Feature buttons row ───
  const fbW = (w - pad * 2 - 12 * s) / 3;
  const fbH = 70 * s;
  const feats = [
    { emoji: '🤖', label: 'Ask Loop' },
    { emoji: '📖', label: 'Your Story' },
    { emoji: '📊', label: 'Report' },
  ];
  feats.forEach((f, i) => {
    const fx = pad + i * (fbW + 6 * s);
    drawGlassCard(ctx, fx, y, fbW, fbH, s);
    ctx.textAlign = 'center';
    ctx.font = `${22 * s}px sans-serif`;
    ctx.fillText(f.emoji, fx + fbW / 2, y + 30 * s);
    ctx.fillStyle = '#B0B0B0';
    ctx.font = `600 ${14 * s}px sans-serif`;
    ctx.fillText(f.label, fx + fbW / 2, y + 52 * s);
    ctx.textAlign = 'left';
  });
  y += fbH + 16 * s;

  // ─── Time range tabs ───
  const ranges = ['24h', '3 Days', '7 Days'];
  const tabW = (w - pad * 2 - 12 * s) / 3;
  ranges.forEach((r, i) => {
    const tx = pad + i * (tabW + 6 * s);
    const isActive = i === 1;
    fillRR(ctx, tx, y, tabW, 38 * s, 10 * s, isActive ? C.accent : 'rgba(255,255,255,0.06)');
    ctx.textAlign = 'center';
    ctx.fillStyle = isActive ? '#fff' : '#888';
    ctx.font = `600 ${16 * s}px sans-serif`;
    ctx.fillText(r, tx + tabW / 2, y + 24 * s);
    ctx.textAlign = 'left';
  });
  y += 54 * s;

  // ─── Summary bar ───
  const sumH = 60 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, sumH, s);
  const sumItems = [
    { label: 'Readings', val: '36' },
    { label: 'Avg', val: '122' },
    { label: 'TIR', val: '78%' },
    { label: 'Range', val: '68-195' },
  ];
  const sumW = (w - pad * 2) / 4;
  sumItems.forEach((si, i) => {
    const sx = pad + i * sumW + sumW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${18 * s}px sans-serif`;
    ctx.fillText(si.val, sx, y + 26 * s);
    ctx.fillStyle = '#666';
    ctx.font = `${12 * s}px sans-serif`;
    ctx.fillText(si.label, sx, y + 44 * s);
  });
  ctx.textAlign = 'left';
  y += sumH + 12 * s;

  // ─── AI Analysis Card ───
  const aiH = 150 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, aiH, s);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${18 * s}px sans-serif`;
  ctx.fillText('AI Analysis', pad + 24 * s, y + 30 * s);
  drawPill(ctx, pad + 160 * s, y + 14 * s, 'Groq AI', hexA(C.accent, 0.15), C.accent, s);
  ctx.fillStyle = '#ccc';
  ctx.font = `${17 * s}px sans-serif`;
  wrapText(ctx, 'Your glucose control has been solid this week. Morning readings are trending 8 mg/dL lower on average, which suggests your overnight settings are dialed in. Post-lunch spikes on weekdays remain a pattern worth watching.', pad + 24 * s, y + 64 * s, w - pad * 2 - 50 * s, 26 * s);
  y += aiH + 12 * s;

  // ─── Insight cards ───
  const insightData = [
    { type: 'success', title: 'Strong overnight control', summary: '5 consecutive nights with 90%+ in range. Your basal settings are working well.', badge: 'Great' },
    { type: 'warning', title: 'Post-lunch spikes on weekdays', summary: 'Glucose rises above 180 within 90 min of lunch on 3 out of 5 weekdays.', badge: 'Watch' },
    { type: 'success', title: 'Morning trend improving', summary: 'Fasting glucose dropped 8 mg/dL on average this week vs last.', badge: 'Great' },
    { type: 'alert', title: 'Two lows after exercise', summary: 'Evening readings dropped below 70 twice following afternoon runs.', badge: 'Notable' },
  ];
  const typeColors = {
    success: { bg: '#1A2E1A', border: '#4CAF50', text: '#4CAF50' },
    warning: { bg: '#2E2A1A', border: '#FFA500', text: '#FFA500' },
    alert: { bg: '#2E1A1A', border: '#D32F2F', text: '#D32F2F' },
  };
  insightData.forEach((ins) => {
    const iH = 100 * s;
    const tc = typeColors[ins.type] || typeColors.success;
    fillRR(ctx, pad, y, w - pad * 2, iH, 16 * s, tc.bg);
    fillRR(ctx, pad, y, 4 * s, iH, 2 * s, tc.border);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${18 * s}px sans-serif`;
    ctx.fillText(ins.title, pad + 20 * s, y + 28 * s);
    drawPill(ctx, w - pad - 100 * s, y + 12 * s, ins.badge, hexA(tc.text, 0.15), tc.text, s);
    ctx.fillStyle = '#aaa';
    ctx.font = `${16 * s}px sans-serif`;
    wrapText(ctx, ins.summary, pad + 20 * s, y + 54 * s, w - pad * 2 - 50 * s, 22 * s);
    y += iH + 10 * s;
  });

  drawCaption(ctx, w, h, s, 'AI-powered insights', 'Personalized pattern analysis and trends');
}

// ════════════════════════════════════════════
// Screen: CARE CIRCLE
// ════════════════════════════════════════════
function drawCareCircle(ctx, w, h) {
  const s = w / 1290;
  drawBg(ctx, w, h);
  drawStatusBar(ctx, w, s);

  const pad = 24 * s;
  let y = 80 * s;

  drawScreenHeader(ctx, w, y + 10 * s, s, 'Care Circle', 'Your support team');
  y += 60 * s;

  // ─── Sharing Settings Card ───
  const setH = 210 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, setH, s, C.accent);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${20 * s}px sans-serif`;
  ctx.fillText('Sharing Settings', pad + 24 * s, y + 34 * s);

  const toggles = [
    { label: 'Share Real-Time Glucose', on: true, color: C.accent },
    { label: 'Low Glucose Alerts', on: true, color: C.pink },
    { label: 'High Glucose Alerts', on: false, color: C.orange },
  ];
  toggles.forEach((t, i) => {
    const ty = y + 62 * s + i * 46 * s;
    ctx.fillStyle = '#ccc';
    ctx.font = `${18 * s}px sans-serif`;
    ctx.fillText(t.label, pad + 30 * s, ty + 8 * s);
    const twX = w - pad - 76 * s;
    const twY = ty - 6 * s;
    fillRR(ctx, twX, twY, 52 * s, 28 * s, 14 * s, t.on ? t.color : '#333');
    circle(ctx, t.on ? twX + 38 * s : twX + 14 * s, twY + 14 * s, 10 * s, '#fff');
  });
  y += setH + 16 * s;

  // ─── Circle Members ───
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${22 * s}px sans-serif`;
  ctx.fillText('Circle Members', pad, y + 22 * s);
  y += 44 * s;

  const members = [
    { name: 'Sarah C.', role: 'Parent', status: 'Viewing now', statusColor: C.green, initials: 'SC' },
    { name: 'Mom', role: 'Parent', status: 'Last seen 2h ago', statusColor: C.orange, initials: 'MC' },
    { name: 'Coach Dave', role: 'Coach', status: 'Active today', statusColor: C.green, initials: 'CD' },
  ];

  members.forEach((m) => {
    const mH = 110 * s;
    drawGlassCard(ctx, pad, y, w - pad * 2, mH, s);
    circle(ctx, pad + 55 * s, y + mH / 2, 32 * s, C.accent);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${20 * s}px sans-serif`;
    ctx.fillText(m.initials, pad + 55 * s, y + mH / 2 + 7 * s);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${20 * s}px sans-serif`;
    ctx.fillText(m.name, pad + 100 * s, y + 32 * s);
    ctx.fillStyle = C.accent;
    ctx.font = `600 ${15 * s}px sans-serif`;
    ctx.fillText(m.role, pad + 100 * s, y + 56 * s);
    circle(ctx, pad + 106 * s, y + 77 * s, 4 * s, m.statusColor);
    ctx.fillStyle = '#888';
    ctx.font = `${14 * s}px sans-serif`;
    ctx.fillText(m.status, pad + 118 * s, y + 81 * s);
    drawPill(ctx, w - pad - 140 * s, y + 24 * s, 'Glucose', hexA(C.accent, 0.1), C.accent, s);
    drawPill(ctx, w - pad - 140 * s, y + 58 * s, 'Alerts', hexA(C.pink, 0.1), C.pink, s);
    y += mH + 4 * s;
  });

  y += 12 * s;

  // ─── Invite Button ───
  const ibtnH = 58 * s;
  const ibg = ctx.createLinearGradient(pad, y, w - pad, y);
  ibg.addColorStop(0, C.accent);
  ibg.addColorStop(1, C.accent2);
  rr(ctx, pad, y, w - pad * 2, ibtnH, 18 * s);
  ctx.fillStyle = ibg;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${20 * s}px sans-serif`;
  ctx.fillText('Invite to Care Circle', w / 2, y + 36 * s);
  ctx.textAlign = 'left';
  y += ibtnH + 20 * s;

  // ─── Messages preview ───
  const msgH = 250 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, msgH, s, C.accent);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${20 * s}px sans-serif`;
  ctx.fillText('Group Chat', pad + 24 * s, y + 34 * s);

  const msgs = [
    { from: 'Sarah', msg: 'Looking great today! Keep it up', time: '2:15 PM', color: C.accent },
    { from: 'Mom', msg: 'Did you eat lunch yet?', time: '1:30 PM', color: C.pink },
    { from: 'Kevin', msg: 'Just checked — 112 and stable', time: '1:28 PM', color: C.green },
    { from: 'Coach Dave', msg: 'Nice job at practice', time: '12:15 PM', color: C.orange },
  ];
  let chatY = y + 58 * s;
  msgs.forEach((m) => {
    fillRR(ctx, pad + 16 * s, chatY, w - pad * 2 - 32 * s, 38 * s, 10 * s, 'rgba(255,255,255,0.03)');
    ctx.fillStyle = m.color;
    ctx.font = `bold ${15 * s}px sans-serif`;
    ctx.fillText(m.from, pad + 28 * s, chatY + 16 * s);
    const nameW = ctx.measureText(m.from + '  ').width;
    ctx.fillStyle = '#ccc';
    ctx.font = `${15 * s}px sans-serif`;
    ctx.fillText(m.msg, pad + 28 * s + nameW, chatY + 16 * s);
    ctx.fillStyle = '#555';
    ctx.font = `${12 * s}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(m.time, w - pad - 28 * s, chatY + 16 * s);
    ctx.textAlign = 'left';
    chatY += 44 * s;
  });

  drawTabBar(ctx, w, h, s, 3);
  drawCaption(ctx, w, h, s, 'Keep your Care Circle close', 'Share glucose data with family in real time');
}

// ════════════════════════════════════════════
// Screen: CHALLENGES
// ════════════════════════════════════════════
function drawChallenges(ctx, w, h) {
  const s = w / 1290;
  drawBg(ctx, w, h);
  drawStatusBar(ctx, w, s);

  const pad = 24 * s;
  let y = 80 * s;

  drawScreenHeader(ctx, w, y + 10 * s, s, 'Challenges', 'Earn streaks and hit goals');
  y += 60 * s;

  // ─── Stats Row ───
  const stH = 90 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, stH, s, C.yellow);
  const stW = (w - pad * 2) / 4;
  const stItems = [
    { val: '5', label: 'Completed', color: C.green },
    { val: '2', label: 'Active', color: C.accent },
    { val: '73%', label: 'Win Rate', color: C.yellow },
    { val: '12', label: 'Day Streak', color: C.orange },
  ];
  stItems.forEach((st, i) => {
    const sx = pad + i * stW + stW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = st.color;
    ctx.font = `bold ${26 * s}px sans-serif`;
    ctx.fillText(st.val, sx, y + 38 * s);
    ctx.fillStyle = '#888';
    ctx.font = `${13 * s}px sans-serif`;
    ctx.fillText(st.label, sx, y + 60 * s);
  });
  ctx.textAlign = 'left';
  y += stH + 16 * s;

  // ─── Active Challenge 1 ───
  const acH = 200 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, acH, s, C.green, true);
  const acg = ctx.createLinearGradient(pad, y, w - pad, y);
  acg.addColorStop(0, C.yellow);
  acg.addColorStop(1, C.orange);
  rr(ctx, pad, y, w - pad * 2, 4 * s, 2 * s);
  ctx.fillStyle = acg;
  ctx.fill();
  drawPill(ctx, pad + 20 * s, y + 20 * s, 'Active', '#1C2E1A', C.green, s);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${22 * s}px sans-serif`;
  ctx.fillText('7-Day In-Range Streak', pad + 24 * s, y + 68 * s);
  ctx.fillStyle = '#888';
  ctx.font = `${17 * s}px sans-serif`;
  ctx.fillText('Keep 70%+ Time in Range for 7 consecutive days', pad + 24 * s, y + 96 * s);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${20 * s}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('5 / 7 days', w - pad - 24 * s, y + 68 * s);
  ctx.textAlign = 'left';

  const pY = y + 120 * s;
  const pW = w - pad * 2 - 48 * s;
  fillRR(ctx, pad + 24 * s, pY, pW, 20 * s, 10 * s, 'rgba(255,255,255,0.06)');
  const pg = ctx.createLinearGradient(pad + 24 * s, pY, pad + 24 * s + pW * 0.71, pY);
  pg.addColorStop(0, C.green);
  pg.addColorStop(1, C.accent);
  rr(ctx, pad + 24 * s, pY, pW * 0.71, 20 * s, 10 * s);
  ctx.fillStyle = pg;
  ctx.fill();

  for (let i = 0; i < 7; i++) {
    const dx = pad + 24 * s + (i + 0.5) * (pW / 7);
    circle(ctx, dx, y + 168 * s, 14 * s, i < 5 ? C.green : 'rgba(255,255,255,0.06)');
    if (i < 5) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${14 * s}px sans-serif`;
      ctx.fillText('✓', dx, y + 173 * s);
      ctx.textAlign = 'left';
    }
  }
  y += acH + 12 * s;

  // ─── Active Challenge 2 ───
  const ac2H = 140 * s;
  drawGlassCard(ctx, pad, y, w - pad * 2, ac2H, s, C.accent);
  drawPill(ctx, pad + 20 * s, y + 16 * s, 'Active', '#1C2E1A', C.green, s);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${20 * s}px sans-serif`;
  ctx.fillText('Mood Master', pad + 24 * s, y + 60 * s);
  ctx.fillStyle = '#888';
  ctx.font = `${16 * s}px sans-serif`;
  ctx.fillText('Log your mood 5 days in a row', pad + 24 * s, y + 84 * s);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${18 * s}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('3 / 5 days', w - pad - 24 * s, y + 60 * s);
  ctx.textAlign = 'left';
  fillRR(ctx, pad + 24 * s, y + 102 * s, w - pad * 2 - 48 * s, 14 * s, 7 * s, 'rgba(255,255,255,0.06)');
  fillRR(ctx, pad + 24 * s, y + 102 * s, (w - pad * 2 - 48 * s) * 0.6, 14 * s, 7 * s, C.accent);
  y += ac2H + 16 * s;

  // ─── Available Challenges ───
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${22 * s}px sans-serif`;
  ctx.fillText('Start a New Challenge', pad, y + 22 * s);
  y += 44 * s;

  const templates = [
    { title: 'Time in Range Pro', desc: 'Keep 80%+ TIR for 3 days', reward: '50 pts', color: C.green },
    { title: 'Night Owl', desc: 'Perfect overnight 5 nights', reward: '75 pts', color: C.cyan },
    { title: 'Community Champion', desc: 'Send 10 Care Circle messages', reward: '25 pts', color: C.accent },
    { title: 'Data Driven', desc: 'Log 5+ readings daily for a week', reward: '60 pts', color: C.orange },
  ];
  templates.forEach((t) => {
    const tH = 90 * s;
    drawGlassCard(ctx, pad, y, w - pad * 2, tH, s);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${18 * s}px sans-serif`;
    ctx.fillText(t.title, pad + 24 * s, y + 28 * s);
    ctx.fillStyle = '#888';
    ctx.font = `${15 * s}px sans-serif`;
    ctx.fillText(t.desc, pad + 24 * s, y + 52 * s);
    ctx.fillStyle = C.yellow;
    ctx.font = `bold ${15 * s}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(t.reward, w - pad - 140 * s, y + 28 * s);
    ctx.textAlign = 'left';
    const sbg = ctx.createLinearGradient(w - pad - 120 * s, y + 44 * s, w - pad - 24 * s, y + 44 * s);
    sbg.addColorStop(0, C.accent);
    sbg.addColorStop(1, C.accent2);
    rr(ctx, w - pad - 120 * s, y + 40 * s, 96 * s, 32 * s, 10 * s);
    ctx.fillStyle = sbg;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${14 * s}px sans-serif`;
    ctx.fillText('Start', w - pad - 72 * s, y + 61 * s);
    ctx.textAlign = 'left';
    y += tH + 4 * s;
  });

  drawCaption(ctx, w, h, s, 'Stay motivated with challenges', 'Earn streaks, track progress, hit goals');
}

// ════════════════════════════════════════════
// Screen: WATCH PROMO
// ════════════════════════════════════════════
function drawWatchPromo(ctx, w, h) {
  const s = w / 1290;
  drawBg(ctx, w, h);

  drawBloomHero(ctx, w, h, s, C.cyan, C.accent);

  // Watch body
  const wW = 380 * s;
  const wH = 470 * s;
  const wX = (w - wW) / 2;
  const wY = h * 0.18;
  fillRR(ctx, wX, wY, wW, wH, 80 * s, '#1a1a1a');
  strokeRR(ctx, wX, wY, wW, wH, 80 * s, '#3a3a3a', 3 * s);
  fillRR(ctx, wX + wW + 2 * s, wY + 130 * s, 12 * s, 50 * s, 5 * s, '#3a3a3a');
  fillRR(ctx, wX + wW, wY + 200 * s, 8 * s, 30 * s, 4 * s, '#333');
  fillRR(ctx, wX + 60 * s, wY - 40 * s, wW - 120 * s, 45 * s, 8 * s, '#222');
  fillRR(ctx, wX + 60 * s, wY + wH - 5 * s, wW - 120 * s, 45 * s, 8 * s, '#222');

  const si = 24 * s;
  const sX = wX + si;
  const sY = wY + si;
  const sW = wW - si * 2;
  const sH = wH - si * 2;
  fillRR(ctx, sX, sY, sW, sH, 58 * s, '#000');

  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  ctx.font = `${16 * s}px sans-serif`;
  ctx.fillText('LINKLOOP', sX + sW / 2, sY + 42 * s);
  ctx.fillStyle = C.green;
  ctx.font = `bold ${90 * s}px sans-serif`;
  ctx.fillText('112', sX + sW / 2, sY + sH / 2 + 10 * s);
  ctx.font = `bold ${28 * s}px sans-serif`;
  ctx.fillText('Flat', sX + sW / 2, sY + sH / 2 + 48 * s);
  ctx.fillStyle = '#888';
  ctx.font = `${18 * s}px sans-serif`;
  ctx.fillText('mg/dL', sX + sW / 2, sY + sH / 2 + 76 * s);
  fillRR(ctx, sX + sW / 2 - 55 * s, sY + sH - 62 * s, 110 * s, 30 * s, 10 * s, hexA(C.green, 0.2));
  ctx.fillStyle = C.green;
  ctx.font = `bold ${14 * s}px sans-serif`;
  ctx.fillText('In Range', sX + sW / 2, sY + sH - 42 * s);
  ctx.textAlign = 'left';

  const bY = wY + wH + 100 * s;
  const bullets = [
    { text: 'Real-time glucose on your wrist', color: C.green },
    { text: 'Background sync every 2 minutes', color: C.accent },
    { text: 'Color-coded watch complications', color: C.cyan },
    { text: 'High and low glucose alerts', color: C.orange },
    { text: 'Works with all Apple Watch faces', color: C.yellow },
  ];
  bullets.forEach((b, i) => {
    const by = bY + i * 56 * s;
    circle(ctx, w / 2 - 300 * s, by, 8 * s, b.color);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${24 * s}px sans-serif`;
    ctx.fillText(b.text, w / 2 - 276 * s, by + 8 * s);
  });

  drawCaption(ctx, w, h, s, 'Apple Watch companion', 'Glucose on your wrist, always updated');
}

// ════════════════════════════════════════════
// Watch screens (410 x 502)
// ════════════════════════════════════════════
function drawWatchGlucose(ctx, w, h) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  ctx.font = '500 14px sans-serif';
  ctx.fillText('LINKLOOP', w / 2, 60);
  ctx.fillStyle = C.green;
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText('112', w / 2, h / 2 + 20);
  ctx.fillStyle = C.green;
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('Flat', w / 2, h / 2 + 60);
  ctx.fillStyle = '#888';
  ctx.font = '18px sans-serif';
  ctx.fillText('mg/dL', w / 2, h / 2 + 90);
  fillRR(ctx, w / 2 - 55, h - 100, 110, 32, 8, hexA(C.green, 0.2));
  ctx.fillStyle = C.green;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('In Range', w / 2, h - 78);
  ctx.textAlign = 'left';
}

function drawWatchComplication(ctx, w, h) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '200 80px sans-serif';
  ctx.fillText('9:41', w / 2, 155);
  ctx.fillStyle = C.orange;
  ctx.font = '600 14px sans-serif';
  ctx.fillText('FRIDAY MAR 8', w / 2, 182);
  ctx.beginPath();
  ctx.arc(w / 2, 275, 45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = C.green;
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('112', w / 2, 283);
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Flat', w / 2, 302);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(80, 275, 20, -Math.PI / 2, Math.PI * 1.2);
  ctx.strokeStyle = '#FF2D55';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(80, 275, 14, -Math.PI / 2, Math.PI * 0.9);
  ctx.strokeStyle = '#34C759';
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#4CC9F0';
  ctx.font = '500 16px sans-serif';
  ctx.fillText('72°', w - 80, 280);
  ctx.fillStyle = '#FF2D55';
  ctx.font = '500 16px sans-serif';
  ctx.fillText('68', 120, h - 80);
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.fillText('BPM', 120, h - 65);
  ctx.textAlign = 'left';
}

function drawWatchHighAlert(ctx, w, h) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const rg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
  rg.addColorStop(0, hexA(C.red, 0.15));
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.red;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('HIGH GLUCOSE', w / 2, 80);
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText('245', w / 2, h / 2 + 20);
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('Rising', w / 2, h / 2 + 60);
  ctx.fillStyle = '#888';
  ctx.font = '18px sans-serif';
  ctx.fillText('mg/dL', w / 2, h / 2 + 90);
  fillRR(ctx, w / 2 - 65, h - 100, 130, 32, 8, hexA(C.red, 0.2));
  ctx.fillStyle = C.red;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Above Range', w / 2, h - 78);
  ctx.textAlign = 'left';
}

function drawWatchLowAlert(ctx, w, h) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const og = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
  og.addColorStop(0, hexA(C.orange, 0.15));
  og.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = og;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.orange;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('LOW GLUCOSE', w / 2, 80);
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText('62', w / 2, h / 2 + 20);
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('Falling', w / 2, h / 2 + 60);
  ctx.fillStyle = '#888';
  ctx.font = '18px sans-serif';
  ctx.fillText('mg/dL', w / 2, h / 2 + 90);
  fillRR(ctx, w / 2 - 65, h - 100, 130, 32, 8, hexA(C.orange, 0.2));
  ctx.fillStyle = C.orange;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Below Range', w / 2, h - 78);
  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════
// Google Play Feature Graphic (1024 x 500)
// ════════════════════════════════════════════
function drawFeatureGraphic(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#0A0A1A');
  g.addColorStop(0.5, '#0D1B2A');
  g.addColorStop(1, '#0A0A1A');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(74,144,217,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y2 = 0; y2 < h; y2 += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y2);
    ctx.lineTo(w, y2);
    ctx.stroke();
  }
  const gl = ctx.createRadialGradient(w * 0.35, h / 2, 0, w * 0.35, h / 2, 300);
  gl.addColorStop(0, hexA(C.accent, 0.2));
  gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('LinkLoop', 80, h / 2 - 30);
  ctx.fillStyle = C.accent;
  ctx.font = '600 28px sans-serif';
  ctx.fillText('T1D Glucose Tracking for Families', 80, h / 2 + 20);

  const pills = ['Real-Time CGM', 'AI Insights', 'Care Circle', 'Apple Watch'];
  let px = 80;
  ctx.font = '600 18px sans-serif';
  pills.forEach((p) => {
    const tw = ctx.measureText(p).width + 30;
    fillRR(ctx, px, h / 2 + 50, tw, 36, 18, hexA(C.accent, 0.2));
    ctx.fillStyle = C.accent;
    ctx.fillText(p, px + 15, h / 2 + 74);
    px += tw + 12;
  });

  const mX = w * 0.66;
  const mY = h * 0.08;
  const mW = 280;
  const mH = h * 0.84;
  fillRR(ctx, mX, mY, mW, mH, 24, 'rgba(20,20,30,0.95)');
  strokeRR(ctx, mX, mY, mW, mH, 24, 'rgba(255,255,255,0.08)');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  ctx.font = '600 10px sans-serif';
  ctx.fillText("TODAY'S AVERAGE", mX + mW / 2, mY + 35);
  ctx.fillStyle = C.green;
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('118', mX + mW / 2, mY + 95);
  ctx.fillStyle = '#888';
  ctx.font = '12px sans-serif';
  ctx.fillText('mg/dL · Stable', mX + mW / 2, mY + 118);
  const cL2 = mX + 16;
  const cR2 = mX + mW - 16;
  const cT2 = mY + 140;
  const cB2 = mY + mH - 20;
  ctx.fillStyle = hexA(C.green, 0.04);
  ctx.fillRect(cL2, cT2, cR2 - cL2, cB2 - cT2);
  const pts2 = [130, 140, 135, 148, 155, 142, 130, 122, 118, 125, 120, 115, 112];
  ctx.beginPath();
  ctx.strokeStyle = C.green;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  pts2.forEach((v, i) => {
    const x = cL2 + ((cR2 - cL2) / (pts2.length - 1)) * i;
    const y2 = cT2 + (cB2 - cT2) * (1 - (v - 70) / 130);
    if (i === 0) ctx.moveTo(x, y2);
    else ctx.lineTo(x, y2);
  });
  ctx.stroke();
  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════
// MAIN — Generate all PNGs
// ════════════════════════════════════════════
const BASE = __dirname;

const PHONE_SCREENS = [
  { id: 'home', fn: drawHome },
  { id: 'glucose', fn: drawGlucose },
  { id: 'insights', fn: drawInsights },
  { id: 'care-circle', fn: drawCareCircle },
  { id: 'challenges', fn: drawChallenges },
  { id: 'watch-promo', fn: drawWatchPromo },
];

const WATCH_LIST = [
  { id: 'watch-glucose', fn: drawWatchGlucose },
  { id: 'watch-complication', fn: drawWatchComplication },
  { id: 'watch-high-alert', fn: drawWatchHighAlert },
  { id: 'watch-low-alert', fn: drawWatchLowAlert },
];

const TARGETS = [
  { dir: 'screenshots/iphone-6.7', w: 1290, h: 2796, screens: PHONE_SCREENS, label: 'iPhone 6.7"' },
  { dir: 'screenshots/iphone-6.5', w: 1284, h: 2778, screens: PHONE_SCREENS, label: 'iPhone 6.5"' },
  { dir: 'screenshots/iphone-6.9', w: 1320, h: 2868, screens: PHONE_SCREENS, label: 'iPhone 6.9"' },
  { dir: 'screenshots/ipad-12.9', w: 2048, h: 2732, screens: PHONE_SCREENS, label: 'iPad 12.9"' },
  { dir: 'screenshots/watch', w: 410, h: 502, screens: WATCH_LIST, label: 'Apple Watch' },
  { dir: 'google-play/phone', w: 1080, h: 1920, screens: PHONE_SCREENS, label: 'Google Play Phone' },
  { dir: 'google-play/tablet-7', w: 1200, h: 1600, screens: PHONE_SCREENS, label: 'Google Play 7" Tablet' },
];

let total = 0;

for (const target of TARGETS) {
  const dir = path.join(BASE, target.dir);
  fs.mkdirSync(dir, { recursive: true });
  for (const scr of target.screens) {
    const canvas = createCanvas(target.w, target.h);
    const ctx = canvas.getContext('2d');
    scr.fn(ctx, target.w, target.h);
    const fp = path.join(dir, `${scr.id}.png`);
    fs.writeFileSync(fp, canvas.toBuffer('image/png'));
    total++;
    console.log(`  ok ${target.label}/${scr.id}.png  (${target.w}x${target.h})`);
  }
}

// Feature Graphic
{
  const dir = path.join(BASE, 'google-play/feature-graphic');
  fs.mkdirSync(dir, { recursive: true });
  const canvas = createCanvas(1024, 500);
  const ctx = canvas.getContext('2d');
  drawFeatureGraphic(ctx, 1024, 500);
  fs.writeFileSync(path.join(dir, 'feature-graphic.png'), canvas.toBuffer('image/png'));
  total++;
  console.log(`  ok Feature Graphic  (1024x500)`);
}

console.log(`\nDone! Generated ${total} PNG files.`);
