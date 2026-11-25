// ============================================================================
// js/render.js – Iso Kylätalo, punaiset tonttiääriviivat, elävät pinot & kersantin natsat (v8.2)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { SITES, BUILDING_KEYS, IMAGE_NAMES, getRiverCenter, getRiverHalfWidth, BRIDGE_X, BRIDGE_Y } = KV.CFG;

  const IMG = {};
  let grassPattern = null;

  function loadImages(ctx) {
    IMAGE_NAMES.forEach(name => {
      const im = new Image();
      im.onload = () => {
        if (name === 'grass_tile') {
          try { grassPattern = ctx.createPattern(im, 'repeat'); } catch (e) {}
        }
        if ((name === 'char_sergeant' || name === 'hero_male') && KV.UI && KV.UI.refreshCommanderVisuals) {
          KV.UI.refreshCommanderVisuals();
        }
      };
      im.src = `assets/${name}.png`;
      IMG[name] = im;
    });
  }

  function isReady(im) {
    return Boolean(im && im.complete && im.naturalWidth > 0);
  }

  function getBridgeArchLift(x, y) {
    if (KV.S.buildings.bridge.state !== 'built') return 0;
    if (Math.abs(y - (BRIDGE_Y - 1)) > 24) return 0;
    const span = 122;
    const rel = (x - BRIDGE_X) / span;
    if (Math.abs(rel) >= 1) return 0;
    return Math.cos(rel * Math.PI * 0.5) * 11;
  }

  function drawBridgeFrontArch(ctx) {
    if (!isReady(IMG.bridge)) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(BRIDGE_X - 134, BRIDGE_Y + 66);
    ctx.lineTo(BRIDGE_X - 134, BRIDGE_Y - 6);
    ctx.lineTo(BRIDGE_X - 96,  BRIDGE_Y - 6);
    ctx.lineTo(BRIDGE_X - 96,  BRIDGE_Y + 10);
    ctx.quadraticCurveTo(BRIDGE_X, BRIDGE_Y - 22, BRIDGE_X + 96, BRIDGE_Y + 10);
    ctx.lineTo(BRIDGE_X + 96,  BRIDGE_Y - 6);
    ctx.lineTo(BRIDGE_X + 134, BRIDGE_Y - 6);
    ctx.lineTo(BRIDGE_X + 134, BRIDGE_Y + 66);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(IMG.bridge, BRIDGE_X - 132, BRIDGE_Y - 64, 264, 126);
    ctx.restore();
  }

  function drawLabelPill(ctx, x, y, text, col = '#fefce8', borderCol = 'rgba(134, 239, 172, 0.35)') {
    ctx.font = 'bold 10.5px system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(18, 28, 19, 0.88)';
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - tw / 2 - 7, y - 10, tw + 14, 17, 6);
    else ctx.rect(x - tw / 2 - 7, y - 10, tw + 14, 17);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 2);
  }

  function drawEarthyYard(ctx, x, y, rx, ry) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(64, 102, 30, 0.45)';
    ctx.beginPath(); ctx.ellipse(0, 4, rx + 9, ry + 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9e7747';
    ctx.beginPath(); ctx.ellipse(0, 2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c49d68';
    ctx.beginPath(); ctx.ellipse(-2, 0, rx * 0.78, ry * 0.74, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawNaturalTrail(ctx, x1, y1, cx, cy, x2, y2, seed = 1) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(12, Math.floor(dist / 12));
    const pts = [];
    const nx = -(y2 - y1) / (dist || 1);
    const ny = (x2 - x1) / (dist || 1);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const wiggle = Math.sin(t * Math.PI * 2.0 + seed) * (10 * Math.sin(t * Math.PI));
      const px = mt * mt * x1 + 2 * mt * t * cx + t * t * x2 + nx * wiggle;
      const py = mt * mt * y1 + 2 * mt * t * cy + t * t * y2 + ny * wiggle;
      const rad = 11.5 + Math.sin(i * 1.7 + seed) * 1.8;
      pts.push({ x: px, y: py, r: rad });
    }

    ctx.fillStyle = '#556b28';
    pts.forEach(p => { ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, p.r + 4, (p.r + 4) * 0.82, 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#966f40';
    pts.forEach(p => { ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r + 1.2, (p.r + 1.2) * 0.8, 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#c8a26d';
    pts.forEach(p => { ctx.beginPath(); ctx.ellipse(p.x, p.y - 0.5, p.r * 0.72, p.r * 0.56, 0, 0, Math.PI * 2); ctx.fill(); });
  }

  function drawVillagePathsAndYards(ctx) {
    const S = KV.S;
    const lx = SITES.lodge.x, ly = SITES.lodge.y + 28;

    drawEarthyYard(ctx, SITES.ship.x, SITES.ship.y + 14, 68, 42);
    drawNaturalTrail(ctx, SITES.ship.x + 25, SITES.ship.y + 30, -470, -240, lx, ly, 2.1);

    drawEarthyYard(ctx, lx, ly - 4, 76, 46);
    drawEarthyYard(ctx, SITES.logPile.x, SITES.logPile.y + 14, 46, 28);
    drawEarthyYard(ctx, SITES.kitchen.x, SITES.kitchen.y + 24, 58, 35);

    drawNaturalTrail(ctx, lx, ly, -255, -160, SITES.logPile.x, SITES.logPile.y + 16, 1.1);
    drawNaturalTrail(ctx, lx, ly, -250, 120, SITES.kitchen.x, SITES.kitchen.y + 30, 2.4);
    drawNaturalTrail(ctx, SITES.kitchen.x - 18, SITES.kitchen.y + 30, -390, 225, SITES.starterGarden.x + 38, SITES.starterGarden.y, 3.7);

    if (S.fields.turnip.active) {
      drawEarthyYard(ctx, SITES.turnipBox.x, SITES.turnipBox.y + 6, 34, 21);
      drawNaturalTrail(ctx, SITES.kitchen.x, SITES.kitchen.y + 32, -335, 275, SITES.turnipBox.x, SITES.turnipBox.y + 6, 2.9);
    }
    if (S.buildings.sawmill.state !== 'none') {
      drawEarthyYard(ctx, SITES.sawmill.x, SITES.sawmill.y + 24, 68, 38);
      drawNaturalTrail(ctx, SITES.logPile.x, SITES.logPile.y + 16, -175, -345, SITES.sawmill.x, SITES.sawmill.y + 32, 1.8);
    }
    if (S.buildings.barracks.state !== 'none') {
      drawEarthyYard(ctx, SITES.barracks.x, SITES.barracks.y + 26, 64, 38);
      drawNaturalTrail(ctx, lx, ly, -120, -55, SITES.barracks.x, SITES.barracks.y + 36, 3.2);
    }

    const westBridgeMouth = BRIDGE_X - 134;
    const eastBridgeMouth = BRIDGE_X + 134;
    if (S.buildings.bridge.state !== 'none' || KV.State.isOutlineVisible('bridge')) {
      drawNaturalTrail(ctx, lx, ly, -40, 38, westBridgeMouth, BRIDGE_Y + 2, 1.5);
    }
    if (S.buildings.bridge.state === 'built') {
      if (S.buildings.mill.state !== 'none') {
        drawEarthyYard(ctx, SITES.mill.x, SITES.mill.y + 30, 58, 36);
        drawNaturalTrail(ctx, eastBridgeMouth, BRIDGE_Y + 2, eastBridgeMouth + 32, -45, SITES.mill.x + 12, SITES.mill.y + 52, 3.9);
      }
      if (S.buildings.bakery.state !== 'none') {
        drawEarthyYard(ctx, SITES.bakery.x, SITES.bakery.y + 26, 62, 36);
        drawNaturalTrail(ctx, eastBridgeMouth, BRIDGE_Y + 2, 435, 58, SITES.bakery.x, SITES.bakery.y + 32, 4.6);
      }
      if (S.fields.oat.active) {
        drawEarthyYard(ctx, SITES.oatPile.x, SITES.oatPile.y + 6, 36, 22);
        drawNaturalTrail(ctx, eastBridgeMouth, BRIDGE_Y + 2, 365, 115, SITES.oatPile.x, SITES.oatPile.y + 6, 5.4);
        drawNaturalTrail(ctx, SITES.oatPile.x, SITES.oatPile.y + 6, 460, 235, SITES.oatFarm.x - 28, SITES.oatFarm.y - 12, 2.7);
      }
      if (S.buildings.mill.state !== 'none' && S.buildings.bakery.state !== 'none') {
        drawNaturalTrail(ctx, SITES.mill.x + 12, SITES.mill.y + 52, 455, -45, SITES.bakery.x, SITES.bakery.y + 32, 1.3);
      }
    }
  }

  // Elävä tukkipino: piirtää täsmälleen varastossa olevan tukkimäärän (0..30)
  function drawDynamicLogStack(ctx, x, y, count) {
    ctx.fillStyle = '#5c3a1e';
    ctx.fillRect(x - 36, y + 8, 72, 5);
    if (count <= 0) return;

    const capped = Math.min(30, count);
    const cols = 6;
    for (let i = 0; i < capped; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const lx = x - 28 + col * 10.5 + (row % 2) * 2.5;
      const ly = y + 4 - row * 7;

      ctx.fillStyle = '#6b3e1b';
      ctx.strokeStyle = '#2b1608';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(lx - 4, ly - 4, 11, 7, 3) : ctx.rect(lx - 4, ly - 4, 11, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#eab376';
      ctx.beginPath();
      ctx.arc(lx - 3, ly - 0.5, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Elävä lautapino Lautatarhan vieressä (0..24 lautaa)
  function drawDynamicBoardStack(ctx, x, y, count) {
    if (count <= 0) return;
    const capped = Math.min(24, count);
    const cols = 4;
    for (let i = 0; i < capped; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const bx = x + col * 9;
      const by = y - row * 4.2;
      ctx.fillStyle = (row % 2 === 0) ? '#eab364' : '#d49546';
      ctx.strokeStyle = '#5c3412';
      ctx.lineWidth = 0.9;
      ctx.fillRect(bx, by, 8, 3.5);
      ctx.strokeRect(bx, by, 8, 3.5);
    }
  }

  // Iso Kylätalo koostettuna olemassa olevasta hirsimökistä juhlavan kokoiseksi päärakennukseksi
  function drawLargeLodgeSprite(ctx, x, y, alpha = 1.0) {
    if (!isReady(IMG.cabin)) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Sivusiivet
    ctx.drawImage(IMG.cabin, x - 94, y - 48, 108, 100);
    ctx.save();
    ctx.translate(x + 94, y - 48);
    ctx.scale(-1, 1);
    ctx.drawImage(IMG.cabin, 0, 0, 108, 100);
    ctx.restore();
    // Korkea keskushalli
    ctx.drawImage(IMG.cabin, x - 80, y - 78, 160, 146);
    ctx.restore();
  }

  // Punainen tonttiääriviiva + läpikuultava haamukuva tulevalle rakennukselle tai pellolle
  function drawRedGhostOutline(ctx, key) {
    const pulse = 0.68 + Math.sin(performance.now() * 0.005) * 0.24;
    const redStroke = `rgba(248, 113, 113, ${pulse})`;
    const redFill = `rgba(239, 68, 68, ${0.13 * pulse})`;

    if (key === 'turnipFarm' || key === 'oatFarm') {
      const site = SITES[key];
      ctx.save();
      if (isReady(IMG.field_plowed)) {
        ctx.globalAlpha = 0.28;
        ctx.drawImage(IMG.field_plowed, site.x - 102, site.y - 58, 204, 116);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = redFill;
      ctx.strokeStyle = redStroke;
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 6]);
      ctx.beginPath();
      ctx.ellipse(site.x, site.y, 98, 54, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      drawLabelPill(ctx, site.x, site.y, `🌱 ${site.label} – Napauta raivataksesi!`, '#fecaca', '#ef4444');
      return;
    }

    const b = KV.S.buildings[key];
    const pos = SITES[key];
    const reqTxt = `${b.logsNeed}🌲${b.boardsNeed ? ` ${b.boardsNeed}🪵` : ''}`;

    ctx.save();
    if (key === 'bridge') {
      if (isReady(IMG.bridge)) {
        ctx.globalAlpha = 0.30;
        ctx.drawImage(IMG.bridge, BRIDGE_X - 132, BRIDGE_Y - 64, 264, 126);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = redFill;
      ctx.strokeStyle = redStroke;
      ctx.lineWidth = 3.2;
      ctx.setLineDash([9, 6]);
      ctx.strokeRect(BRIDGE_X - 126, BRIDGE_Y - 30, 252, 60);
      ctx.fillRect(BRIDGE_X - 126, BRIDGE_Y - 30, 252, 60);
      ctx.setLineDash([]);
      ctx.restore();
      drawLabelPill(ctx, BRIDGE_X, BRIDGE_Y - 40, `🔨 ${pos.label} (${reqTxt}) – Napauta!`, '#fecaca', '#ef4444');
      return;
    }

    if (key === 'lodge') {
      drawLargeLodgeSprite(ctx, pos.x, pos.y, 0.28);
    } else {
      const sprMap = { sawmill: 'sawmill', barracks: 'barracks', mill: 'watermill', bakery: 'bakery' };
      const spr = IMG[sprMap[key]];
      if (isReady(spr)) {
        ctx.globalAlpha = 0.28;
        ctx.drawImage(spr, pos.x - 68, pos.y - 68, 136, 132);
      }
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = redFill;
    ctx.strokeStyle = redStroke;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y + 12, (pos.rx || 56) + 10, (pos.ry || 36) + 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    drawLabelPill(ctx, pos.x, pos.y - 46, `🔨 ${pos.label} (${reqTxt})`, '#fecaca', '#ef4444');
    drawLabelPill(ctx, pos.x, pos.y + 48, '👆 Napauta rakentaaksesi (1 rakentaja)', '#fde047', '#ef4444');
  }

  function drawBridgeUnderConstruction(ctx, br) {
    const bw = getRiverHalfWidth(BRIDGE_Y);
    const leftBank = BRIDGE_X - bw - 14;
    const rightBank = BRIDGE_X + bw + 14;
    const totalSpan = rightBank - leftBank;

    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    [leftBank - 10, rightBank - 8].forEach(px => {
      ctx.fillRect(px, BRIDGE_Y - 22, 18, 44);
      ctx.strokeRect(px, BRIDGE_Y - 22, 18, 44);
    });

    const builtSpan = totalSpan * Math.max(0.12, br.prog);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(leftBank, BRIDGE_Y - 13);
    ctx.lineTo(leftBank + builtSpan, BRIDGE_Y - 13);
    ctx.moveTo(leftBank, BRIDGE_Y + 13);
    ctx.lineTo(leftBank + builtSpan, BRIDGE_Y + 13);
    ctx.stroke();

    for (let x = leftBank + 4; x < leftBank + builtSpan - 4; x += 9) {
      const rel = (x - BRIDGE_X) / (bw + 16);
      const lift = Math.cos(rel * Math.PI * 0.5) * 8;
      ctx.fillStyle = '#c27832';
      ctx.fillRect(x, BRIDGE_Y - 16 - lift * 0.4, 6, 32);
    }

    drawLabelPill(
      ctx, BRIDGE_X, BRIDGE_Y - 38,
      `${br.state === 'ruined' ? '🔥' : '🔨'} Kaarisilta ${Math.round(br.prog * 100)}% (👷${br.builders || 0}/1 • 🌲${br.logsIn}/${br.logsNeed} 🪵${br.boardsIn}/${br.boardsNeed})`,
      '#fde047'
    );
  }

  function drawRiverWaterAndBanks(ctx) {
    const traceRiverPoly = (pad) => {
      ctx.beginPath();
      for (let y = -2800; y <= 2800; y += 28) ctx.lineTo(getRiverCenter(y) - getRiverHalfWidth(y) - pad, y);
      for (let y = 2800; y >= -2800; y -= 28) ctx.lineTo(getRiverCenter(y) + getRiverHalfWidth(y) + pad, y);
      ctx.closePath();
    };

    ctx.fillStyle = '#295e1a'; traceRiverPoly(22); ctx.fill();
    ctx.fillStyle = '#4c9c2a'; traceRiverPoly(14); ctx.fill();
    ctx.fillStyle = '#bca06b'; traceRiverPoly(7);  ctx.fill();

    ctx.fillStyle = '#38bdf8'; traceRiverPoly(0);   ctx.fill();
    ctx.fillStyle = '#16a6eb'; traceRiverPoly(-10); ctx.fill();
    ctx.fillStyle = '#0584c7'; traceRiverPoly(-26); ctx.fill();
    ctx.fillStyle = '#0369a1'; traceRiverPoly(-46); ctx.fill();

    const now = performance.now();
    const foamPulse = Math.sin(now * 0.003) * 1.2;
    ctx.strokeStyle = 'rgba(240, 249, 255, 0.86)';
    ctx.lineWidth = 3.2;
    traceRiverPoly(-1.5 + foamPulse * 0.3);
    ctx.stroke();

    const flow = (now * 0.032) % 96;
    ctx.strokeStyle = 'rgba(224, 247, 255, 0.34)';
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    for (let y = -2600 + flow; y < 2600; y += 96) {
      const rc = getRiverCenter(y);
      ctx.beginPath();
      ctx.moveTo(rc - 28, y);
      ctx.bezierCurveTo(rc - 18, y + 20, rc - 34, y + 38, rc - 22, y + 58);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rc + 20, y + 26);
      ctx.bezierCurveTo(rc + 32, y + 44, rc + 14, y + 62, rc + 26, y + 82);
      ctx.stroke();
    }
  }

  function drawFieldPlot(ctx, site, f, label, isOat, isCompact = false) {
    if (!f.active) return;
    const w = isCompact ? 132 : 204;
    const h = isCompact ? 76  : 116;

    let spr = IMG.field_plowed;
    if (f.stage === 3) spr = IMG.field_sprouts;
    else if (f.stage === 4) spr = isOat ? IMG.field_oat_ripe : IMG.field_turnip_ripe;
    else if (f.stage === 5) spr = IMG.field_frost;

    ctx.fillStyle = 'rgba(34, 68, 20, 0.34)';
    ctx.beginPath();
    ctx.ellipse(site.x, site.y + 3, w * 0.49, h * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isReady(spr)) ctx.drawImage(spr, site.x - w / 2, site.y - h / 2, w, h);

    const stNames = ['', 'Kuokitaan...', 'Kylvetään...', 'Kasvaa...', 'Sato kypsä!', '❄️ PALELTUNUT!'];
    drawLabelPill(ctx, site.x, site.y + h / 2 + 8, `${label} – ${stNames[f.stage]}`, f.stage === 5 ? '#bae6fd' : '#fef08a');
  }

  // Piirtää kersantin kultaiset natsat rintamukseen + Kersantti Teräksen veteraaniparran ja baretin!
  function drawCommanderInsigniaAndTraits(ctx, cmdId, hSize, faceBack) {
    if (cmdId === 'teras') {
      // Tummanvihreä/teräksinen baretti päälaelle (näkyy myös takaa)
      ctx.fillStyle = '#1e3a2f';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(1, -hSize + 10, 10.5, 4.8, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (!faceBack) {
        // Baretin kultakokardi
        ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.arc(4, -hSize + 10, 1.8, 0, Math.PI * 2); ctx.fill();

        // Erottuva tummanharmaa/ruskea veteraaniparta & arpi
        ctx.strokeStyle = 'rgba(254, 202, 202, 0.85)';
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(-3, -hSize + 17); ctx.lineTo(-1, -hSize + 22); ctx.stroke();

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.ellipse(1.5, -hSize + 24.5, 6.8, 4.2, 0, 0, Math.PI);
        ctx.fill();
      }
    }

    // Kultaiset kolminkertaiset kersantin natsat (^^^) takin rintamukseen!
    if (!faceBack) {
      const cx = 3.5;
      const cy = -hSize * 0.42;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(cx - 5.2, cy - 5.5, 10.4, 11.5, 2.5) : ctx.rect(cx - 5.2, cy - 5.5, 10.4, 11.5);
      ctx.fill();

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.65;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        const vy = cy - 2.5 + i * 3.1;
        ctx.beginPath();
        ctx.moveTo(cx - 3.6, vy + 1.8);
        ctx.lineTo(cx,       vy - 1.1);
        ctx.lineTo(cx + 3.6, vy + 1.8);
        ctx.stroke();
      }
    }
  }

  // Piirtää muotokuvan valintaikkunaan (#commanderModal) ja palauttaa haluttaessa kuvan HUD-ikoniin
  function drawCommanderPortrait(canvas, cmdId) {
    if (!canvas) return null;
    const pctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    pctx.clearRect(0, 0, w, h);

    const sprName = cmdId === 'teras' ? 'hero_male' : 'char_sergeant';
    const spr = IMG[sprName];
    if (!isReady(spr)) return null;

    pctx.save();
    pctx.translate(w / 2, h - 10);
    pctx.scale(1.55, 1.55);
    const wSize = 44, hSize = 54;
    pctx.drawImage(spr, -wSize / 2, -hSize + 5, wSize, hSize);
    drawCommanderInsigniaAndTraits(pctx, cmdId, hSize, false);
    pctx.restore();
    try { return canvas.toDataURL(); } catch (e) { return null; }
  }

  function drawUnit4Dir(ctx, unit, baseSprName, carryItem, wSize = 41, hSize = 49, ringColor = null, commanderId = null) {
    const lift = getBridgeArchLift(unit.x, unit.y);
    const stepVal = unit.step || 0;

    const bounce = unit.moving ? Math.abs(Math.sin(stepVal * 2.1 * Math.PI * 0.5)) * 1.8 : 0;
    const rock = (!unit.moving && unit.working) ? Math.sin(unit.toolPhase || 0) * 0.13 : 0;

    const backKey = `${baseSprName}_back`;
    const dirKey = (unit.faceBack && isReady(IMG[backKey])) ? backKey : baseSprName;

    let frameKey = dirKey;
    if (unit.moving) {
      const phase = Math.floor(stepVal * 2.1) % 4;
      if (phase === 0 && isReady(IMG[`${dirKey}_w1`])) frameKey = `${dirKey}_w1`;
      else if (phase === 2 && isReady(IMG[`${dirKey}_w2`])) frameKey = `${dirKey}_w2`;
    }
    const spr = IMG[frameKey] || IMG[dirKey];

    if (ringColor) {
      const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.08;
      ctx.strokeStyle = ringColor;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(unit.x, unit.y - lift + 2, 20 * pulse, 9 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(unit.x, unit.y - lift + 2, wSize * 0.32, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(unit.x, unit.y - lift - bounce);
    if (unit.faceLeft) ctx.scale(-1, 1);
    if (rock !== 0) ctx.rotate(rock);
    if (isReady(spr)) {
      ctx.drawImage(spr, -wSize / 2, -hSize + 5, wSize, hSize);
    }
    if (commanderId) {
      drawCommanderInsigniaAndTraits(ctx, commanderId, hSize, unit.faceBack);
    }
    ctx.restore();

    if (carryItem) {
      const itemMap = {
        log: 'item_log', board: 'item_board', turnip: 'icon_turnip',
        oat: 'item_oat', flour: 'item_flour', bread: 'item_bread'
      };
      const cSpr = IMG[itemMap[carryItem]];
      if (isReady(cSpr)) {
        const sideX = unit.faceLeft ? -6 : 6;
        const carryY = (carryItem === 'log' || carryItem === 'board')
          ? (unit.y - lift - bounce - hSize * 0.62)
          : (unit.y - lift - bounce - hSize * 0.50);
        ctx.drawImage(cSpr, unit.x + sideX - 12, carryY - 9, 24, 19);
      }
    }
  }

  function getWorkerSpriteName(w) {
    const fem = Boolean(w.female);
    if (w.role === 'woodcutter') return fem ? 'char_woodcutter_f' : 'char_woodcutter';
    if (w.role === 'turnipFarmer' || w.role === 'oatFarmer') return fem ? 'char_farmer_f' : 'char_farmer';
    if (w.role === 'cookGardener' || w.role === 'miller' || w.role === 'baker') return fem ? 'char_baker_f' : 'char_baker';
    return fem ? 'char_builder_f' : 'char_builder';
  }

  function draw(canvas, ctx) {
    const W = canvas.width = window.innerWidth;
    const H = canvas.height = window.innerHeight;
    const { S, world, hero, cam } = KV;

    ctx.fillStyle = '#4c8c2b';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(S.zoom || 0.75, S.zoom || 0.75);
    ctx.translate(-cam.x, -cam.y);

    if (grassPattern) {
      ctx.fillStyle = grassPattern;
      ctx.fillRect(-3400, -3000, 6800, 6000);
    }

    world.meadowFlora.forEach(mf => {
      if (mf.type === 'clover') {
        ctx.fillStyle = '#3f8f29';
        ctx.beginPath();
        ctx.arc(mf.x - 2.5, mf.y, 2.5, 0, Math.PI * 2);
        ctx.arc(mf.x + 2.5, mf.y, 2.5, 0, Math.PI * 2);
        ctx.arc(mf.x, mf.y - 2.5, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = mf.col;
        ctx.beginPath(); ctx.arc(mf.x, mf.y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    });

    drawVillagePathsAndYards(ctx);
    drawRiverWaterAndBanks(ctx);

    const br = S.buildings.bridge;
    if (br.state === 'built' && isReady(IMG.bridge)) {
      ctx.drawImage(IMG.bridge, BRIDGE_X - 132, BRIDGE_Y - 64, 264, 126);
    } else if (br.state === 'building' || br.state === 'ruined') {
      drawBridgeUnderConstruction(ctx, br);
    }

    drawFieldPlot(ctx, SITES.starterGarden, S.fields.starterTurnip, 'Kotitarha', false, true);
    drawFieldPlot(ctx, SITES.turnipFarm, S.fields.turnip, 'Suuri Naurispelto', false, false);
    drawFieldPlot(ctx, SITES.oatFarm, S.fields.oat, 'Suuri Kaurapelto', true, false);

    // Punaiset tonttiääriviivat kaikille avoinna oleville seuraaville kohteille!
    ['lodge', 'sawmill', 'turnipFarm', 'barracks', 'bridge', 'mill', 'bakery', 'oatFarm'].forEach(key => {
      if (KV.State.isOutlineVisible(key)) {
        drawRedGhostOutline(ctx, key);
      }
    });

    // Tähtialuksen laskeutumisalusta luoteessa
    ctx.fillStyle = 'rgba(45, 58, 48, 0.45)';
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)'; ctx.lineWidth = 2.2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.ellipse(SITES.ship.x, SITES.ship.y + 8, 60, 38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);

    if (S.commanderChosen && world.selectedEntity === hero && S.heroMedbayTimer <= 0) {
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.34)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.ellipse(hero.x, hero.y, 145, 92, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    if (S.commanderChosen && hero.target && S.heroMedbayTimer <= 0) {
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.ellipse(hero.target.x, hero.target.y, 12, 6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    world.clickRipples.forEach(rp => {
      ctx.strokeStyle = `rgba(134, 239, 172, ${rp.a})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    });

    const renderables = [];

    world.riverBankProps.forEach(rp => {
      renderables.push({
        y: rp.y,
        draw: () => {
          const spr = IMG[rp.kind];
          if (!isReady(spr)) return;
          const w = (rp.kind === 'river_rocks' ? 56 : 48) * rp.scale;
          const h = (rp.kind === 'river_rocks' ? 34 : 42) * rp.scale;
          ctx.save();
          ctx.translate(rp.x, rp.y);
          if (rp.flip) ctx.scale(-1, 1);
          ctx.drawImage(spr, -w / 2, -h + 6, w, h);
          ctx.restore();
        }
      });
    });

    world.forestProps.forEach(fp => {
      renderables.push({
        y: fp.y + 4,
        draw: () => {
          const spr = IMG[fp.kind];
          if (!isReady(spr)) return;
          const w = (fp.kind === 'fallen_log' ? 60 : 52) * fp.scale;
          const h = (fp.kind === 'fallen_log' ? 38 : 40) * fp.scale;
          ctx.drawImage(spr, fp.x - w / 2, fp.y - h + 10, w, h);
        }
      });
    });

    world.supplyCrates.forEach(cr => {
      renderables.push({
        y: cr.y + 8,
        draw: () => {
          if (isReady(IMG.supply_crate)) ctx.drawImage(IMG.supply_crate, cr.x - 24, cr.y - 28, 48, 45);
          if (Math.hypot(cam.x - cr.x, cam.y - cr.y) < 380) {
            const lbl = S.commanderChosen ? '📦 Tarvikelaatikko (Vie Kersantti)' : '📦 Tarvikelaatikko (Odottaa Kersanttia)';
            drawLabelPill(ctx, cr.x, cr.y - 34, lbl, '#7dd3fc');
          }
        }
      });
    });

    const drawnFlags = [];
    world.soldiers.forEach(s => {
      if (!s.guardPost) return;
      if (drawnFlags.some(p => Math.hypot(p.x - s.guardPost.x, p.y - s.guardPost.y) < 18)) return;
      drawnFlags.push(s.guardPost);
      renderables.push({
        y: s.guardPost.y - 4,
        draw: () => { if (isReady(IMG.guard_flag)) ctx.drawImage(IMG.guard_flag, s.guardPost.x - 16, s.guardPost.y - 44, 32, 48); }
      });
    });

    world.trees.forEach(t => {
      if (Math.abs(t.x - cam.x) > 1350 || Math.abs(t.y - cam.y) > 1050) return;
      renderables.push({
        y: t.y + 10,
        draw: () => {
          if (t.regrow > 0) {
            if (isReady(IMG.stump)) ctx.drawImage(IMG.stump, t.x - 19, t.y - 13, 38, 32);
          } else {
            const spr = t.kind === 'birch' ? IMG.birch_tree : IMG.pine_tree;
            if (isReady(spr)) {
              const w = 82 * t.scale, h = 108 * t.scale;
              ctx.fillStyle = 'rgba(15, 38, 12, 0.26)';
              ctx.beginPath(); ctx.ellipse(t.x, t.y + 9, w * 0.35, 10, 0, 0, Math.PI * 2); ctx.fill();
              ctx.drawImage(spr, t.x - w / 2, t.y - h + 16, w, h);
            }
          }
        }
      });
    });

    // Elävä Tukkipino
    renderables.push({
      y: SITES.logPile.y + 18,
      draw: () => {
        drawDynamicLogStack(ctx, SITES.logPile.x, SITES.logPile.y, S.piles.logsAtForest);
        drawLabelPill(ctx, SITES.logPile.x, SITES.logPile.y + 30, `🌲 Tukkipino: ${S.piles.logsAtForest}/30`, '#fef08a');
      }
    });

    if (S.fields.turnip.active) {
      renderables.push({
        y: SITES.turnipBox.y + 12,
        draw: () => {
          const n = Math.min(6, S.piles.turnipsAtField);
          for (let i = 0; i < n; i++) {
            if (isReady(IMG.icon_turnip)) ctx.drawImage(IMG.icon_turnip, SITES.turnipBox.x - 18 + (i % 3) * 12, SITES.turnipBox.y - 10 - Math.floor(i / 3) * 7, 21, 21);
          }
          drawLabelPill(ctx, SITES.turnipBox.x, SITES.turnipBox.y + 22, `Nauriskori: ${S.piles.turnipsAtField}`, '#f3e8ff');
        }
      });
    }

    if (S.fields.oat.active) {
      renderables.push({
        y: SITES.oatPile.y + 12,
        draw: () => {
          const n = Math.min(6, S.piles.oatsAtField);
          for (let i = 0; i < n; i++) {
            if (isReady(IMG.item_oat)) ctx.drawImage(IMG.item_oat, SITES.oatPile.x - 19 + (i % 3) * 12, SITES.oatPile.y - 12 - Math.floor(i / 3) * 7, 22, 22);
          }
          drawLabelPill(ctx, SITES.oatPile.x, SITES.oatPile.y + 22, `🌾 Viljapino: ${S.piles.oatsAtField}`, '#fef08a');
        }
      });
    }

    // Tähtialus luoteessa
    renderables.push({
      y: SITES.ship.y + 20,
      draw: () => {
        if (isReady(IMG.starship)) ctx.drawImage(IMG.starship, SITES.ship.x - 68, SITES.ship.y - 44, 136, 92);
        if (S.heroMedbayTimer > 0) {
          const cmdSpec = KV.State.getCommanderSpec();
          drawLabelPill(ctx, SITES.ship.x, SITES.ship.y - 50, `🏥 Hoitokapseli: ${cmdSpec.shortName} (${Math.ceil(S.heroMedbayTimer)}s)`, '#fca5a5');
        }
        drawLabelPill(ctx, SITES.ship.x, SITES.ship.y + 48, '🚀 Tähtialus (Napauta)', '#bae6fd');
      }
    });

    // Rakennukset
    ['lodge', 'kitchen', 'sawmill', 'barracks', 'mill', 'bakery'].forEach(key => {
      const b = S.buildings[key];
      if (!b || b.state === 'none') return;
      const pos = SITES[key];
      renderables.push({
        y: pos.y + 28,
        draw: () => {
          if (b.state === 'building' || b.state === 'ruined') {
            if (isReady(IMG.scaffolding)) ctx.drawImage(IMG.scaffolding, pos.x - 72, pos.y - 62, 144, 122);
            drawLabelPill(ctx, pos.x, pos.y - 66, `${b.state === 'ruined' ? '🔥' : '🔨'} ${pos.label} ${Math.round(b.prog * 100)}% (👷${b.builders || 0}/1)`, '#fde047');
            drawLabelPill(ctx, pos.x, pos.y + 54, `🌲${b.logsIn}/${b.logsNeed} ${b.boardsNeed ? `🪵${b.boardsIn}/${b.boardsNeed}` : ''}`, '#fefce8');
            return;
          }

          if (key === 'lodge') {
            drawLargeLodgeSprite(ctx, pos.x, pos.y, 1.0);
            if (b.growing) {
              const spr = b.spawnProg < 0.45 ? IMG.baby_worker : IMG.toddler_worker;
              if (isReady(spr)) ctx.drawImage(spr, pos.x + 8, pos.y + 16, 36, 40);
              drawLabelPill(ctx, pos.x, pos.y + 62, `👶 Kasvaa kyläläiseksi: ${Math.round(b.spawnProg * 100)}%`, '#86efac');
            } else {
              drawLabelPill(ctx, pos.x, pos.y + 60, '👆 Napauta kasvattaaksesi kyläläisen', '#bbf7d0');
            }
            drawLabelPill(ctx, pos.x, pos.y - 80, `🏡 Iso Kylätalo (Väki: ${KV.State.getLivingPopulation()}/${KV.State.getMaxSustainablePop()})`, '#fef08a');

          } else if (key === 'kitchen') {
            if (isReady(IMG.kitchen)) ctx.drawImage(IMG.kitchen, pos.x - 70, pos.y - 64, 140, 124);
            drawLabelPill(ctx, pos.x, pos.y - 66, `🍲 Kyläkeittiö (Pata: ${Math.ceil(S.stew)})`, S.stew <= 0.1 ? '#fca5a5' : '#f3e8ff');

          } else if (key === 'sawmill') {
            if (isReady(IMG.sawmill)) ctx.drawImage(IMG.sawmill, pos.x - 74, pos.y - 64, 148, 126);
            drawDynamicBoardStack(ctx, pos.x + 48, pos.y + 24, b.outBoards);
            drawLabelPill(ctx, pos.x, pos.y - 66, `🪚 Lautatarha (🌲${b.rawLogs} ➔ 🪵${b.outBoards}/24)`, '#fde047');

          } else if (key === 'barracks') {
            if (isReady(IMG.barracks)) ctx.drawImage(IMG.barracks, pos.x - 70, pos.y - 74, 140, 146);
            if (b.trainQueued && world.orcs.length === 0) {
              const spr = b.trainProg < 0.45 ? IMG.baby_soldier : IMG.toddler_soldier;
              if (isReady(spr)) ctx.drawImage(spr, pos.x + 10, pos.y + 14, 36, 40);
              drawLabelPill(ctx, pos.x, pos.y + 62, `🪖 Alokas ${Math.round(b.trainProg * 100)}%`, '#bbf7d0');
            } else {
              drawLabelPill(ctx, pos.x, pos.y + 60, '👆 Napauta kouluttaaksesi kaartilaisen', '#bae6fd');
            }
            drawLabelPill(ctx, pos.x, pos.y - 76, `🥋 Varuskunta (${S.soldierCount} kaartilaista)`, '#bae6fd');

          } else if (key === 'mill') {
            if (isReady(IMG.watermill)) ctx.drawImage(IMG.watermill, pos.x - 66, pos.y - 72, 132, 144);
            drawLabelPill(ctx, pos.x, pos.y - 74, `⚙️ Vesimylly (🌾${b.rawOats} ➔ Jauho:${b.outFlour})`, '#ffffff');

          } else if (key === 'bakery') {
            if (isReady(IMG.bakery)) ctx.drawImage(IMG.bakery, pos.x - 68, pos.y - 66, 136, 132);
            drawLabelPill(ctx, pos.x, pos.y - 68, `🥖 Leipomo (Jauho:${b.rawFlour} ➔ 🥖${b.outBreads || 0})`, '#fed7aa');
          }
        }
      });
    });

    world.workers.forEach(w => {
      renderables.push({
        y: w.y,
        draw: () => drawUnit4Dir(
          ctx, w,
          getWorkerSpriteName(w),
          (w.carry && w.carry.picked) ? w.carry.item : null,
          41, 49,
          world.selectedEntity === w ? '#facc15' : null,
          null
        )
      });
    });

    world.soldiers.forEach(s => {
      renderables.push({
        y: s.y,
        draw: () => {
          const sprKey = s.female ? 'char_soldier_f' : 'char_soldier';
          drawUnit4Dir(ctx, s, sprKey, null, 42, 50, world.selectedEntity === s ? '#38bdf8' : null, null);
          if (s.hp < s.maxHp) {
            ctx.fillStyle = '#090d16'; ctx.fillRect(s.x - 13, s.y - 54, 26, 4);
            ctx.fillStyle = '#22c55e'; ctx.fillRect(s.x - 12, s.y - 53, 24 * Math.max(0, s.hp / s.maxHp), 2.2);
          }
        }
      });
    });

    world.orcs.forEach(o => {
      renderables.push({
        y: o.y,
        draw: () => {
          drawUnit4Dir(ctx, o, 'char_orc', null, 48, 55, null, null);
          ctx.fillStyle = '#090d16'; ctx.fillRect(o.x - 14, o.y - 56, 28, 4.5);
          ctx.fillStyle = '#ef4444'; ctx.fillRect(o.x - 13, o.y - 55, 26 * Math.max(0, o.hp / o.maxHp), 2.5);
        }
      });
    });

    // Valittu Kersantti (Pippuri tai Teräs) kersantin natsoilla!
    if (S.commanderChosen && S.heroMedbayTimer <= 0) {
      const cmdSpec = KV.State.getCommanderSpec();
      renderables.push({
        y: hero.y,
        draw: () => {
          drawUnit4Dir(
            ctx, hero, cmdSpec.sprite, null, 46, 56,
            world.selectedEntity === hero ? '#fb923c' : null,
            cmdSpec.id
          );
          if (hero.hp < hero.maxHp) {
            const lift = getBridgeArchLift(hero.x, hero.y);
            ctx.fillStyle = '#090d16'; ctx.fillRect(hero.x - 16, hero.y - lift - 62, 32, 4.5);
            ctx.fillStyle = '#fb923c'; ctx.fillRect(hero.x - 15, hero.y - lift - 61, 30 * Math.max(0, hero.hp / hero.maxHp), 2.5);
          }
        }
      });
    }

    if (br.state === 'built') {
      renderables.push({
        y: BRIDGE_Y + 24,
        draw: () => drawBridgeFrontArch(ctx)
      });
    }

    renderables.sort((a, b) => a.y - b.y);
    for (let i = 0; i < renderables.length; i++) {
      renderables[i].draw();
    }

    world.steamPuffs.forEach(p => {
      ctx.fillStyle = p.purple ? `rgba(233, 213, 255, ${p.a})` : `rgba(248, 250, 252, ${p.a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });

    world.bullets.forEach(bl => {
      ctx.fillStyle = bl.friendly ? '#38bdf8' : '#fb7185';
      ctx.beginPath(); ctx.arc(bl.x, bl.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    world.speech.forEach(s => drawLabelPill(ctx, s.x, s.y, s.text, s.col));

    ctx.restore();

    if (world.frostActive > 0) {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.16)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      world.snowParticles.forEach(sp => {
        ctx.beginPath(); ctx.arc(sp.x * W, sp.y * H, 2.4, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  KV.Render = {
    loadImages,
    drawCommanderPortrait,
    draw
  };
})();