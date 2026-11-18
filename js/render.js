// ============================================================================
// js/render.js – Kaareva sillan etukaidekerros, luonnolliset pellot & askelanimaatio (v8.1)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { SITES, RESERVED_PLOTS, IMAGE_NAMES, AVATARS, getRiverCenter, getRiverHalfWidth, BRIDGE_X, BRIDGE_Y } = KV.CFG;

  const IMG = {};
  let grassPattern = null;

  function loadImages(ctx) {
    IMAGE_NAMES.forEach(name => {
      const im = new Image();
      im.onload = () => {
        if (name === 'grass_tile') {
          try { grassPattern = ctx.createPattern(im, 'repeat'); } catch (e) {}
        }
      };
      im.src = `assets/${name}.png`;
      IMG[name] = im;
    });
  }

  function isReady(im) {
    return Boolean(im && im.complete && im.naturalWidth > 0);
  }

  // 11 pikselin kaarinosto pitää molemmat kaistat tarkasti puulankkujen päällä!
  function getBridgeArchLift(x, y) {
    if (KV.S.buildings.bridge.state !== 'built') return 0;
    if (Math.abs(y - (BRIDGE_Y - 1)) > 24) return 0;
    const span = 122;
    const rel = (x - BRIDGE_X) / span;
    if (Math.abs(rel) >= 1) return 0;
    return Math.cos(rel * Math.PI * 0.5) * 11;
  }

  // Kaareva etukaiteen leikkaus: huippu keskellä kohdassa BRIDGE_Y - 6 (ohjauspiste BRIDGE_Y - 22)
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

  function drawLabelPill(ctx, x, y, text, col = '#fefce8') {
    ctx.font = 'bold 10.5px system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(18, 28, 19, 0.84)';
    ctx.strokeStyle = 'rgba(134, 239, 172, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - tw / 2 - 6, y - 10, tw + 12, 16, 6);
    else ctx.rect(x - tw / 2 - 6, y - 10, tw + 12, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 1.5);
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

    for (let i = 2; i < pts.length - 2; i += 4) {
      const p = pts[i];
      const side = (i % 8 === 2 ? 1 : -1) * (p.r + 1.4);
      ctx.fillStyle = '#78716c';
      ctx.beginPath(); ctx.ellipse(p.x + side, p.y + side * 0.35, 3.2, 2.1, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawVillagePathsAndYards(ctx) {
    const S = KV.S;
    const sx = SITES.ship.x, sy = SITES.ship.y + 22;
    drawEarthyYard(ctx, sx, sy - 6, 62, 40);
    drawEarthyYard(ctx, SITES.logPile.x, SITES.logPile.y + 14, 42, 26);
    drawEarthyYard(ctx, SITES.kitchen.x, SITES.kitchen.y + 24, 58, 35);

    drawNaturalTrail(ctx, sx, sy, -255, -160, SITES.logPile.x, SITES.logPile.y + 16, 1.1);
    drawNaturalTrail(ctx, sx, sy, -245, 115, SITES.kitchen.x, SITES.kitchen.y + 30, 2.4);
    drawNaturalTrail(ctx, SITES.kitchen.x - 18, SITES.kitchen.y + 30, -385, 215, SITES.starterGarden.x + 38, SITES.starterGarden.y, 3.7);

    if (S.buildings.house1.state !== 'none') {
      drawEarthyYard(ctx, SITES.house1.x, SITES.house1.y + 24, 56, 33);
      drawNaturalTrail(ctx, sx, sy, -335, -55, SITES.house1.x, SITES.house1.y + 32, 4.2);
    }
    if (S.buildings.house2.state !== 'none') {
      drawEarthyYard(ctx, SITES.house2.x, SITES.house2.y + 24, 56, 33);
      drawNaturalTrail(ctx, SITES.house1.x, SITES.house1.y + 32, -555, -80, SITES.house2.x, SITES.house2.y + 32, 5.1);
    }
    if (S.buildings.house3.state !== 'none') {
      drawEarthyYard(ctx, SITES.house3.x, SITES.house3.y + 24, 56, 33);
      drawNaturalTrail(ctx, SITES.house1.x, SITES.house1.y + 32, -515, 10, SITES.house3.x, SITES.house3.y + 32, 6.3);
    }
    if (S.fields.turnip.active) {
      drawEarthyYard(ctx, SITES.turnipBox.x, SITES.turnipBox.y + 6, 34, 21);
      drawNaturalTrail(ctx, SITES.kitchen.x, SITES.kitchen.y + 32, -335, 265, SITES.turnipBox.x, SITES.turnipBox.y + 6, 2.9);
    }
    if (S.buildings.sawmill.state !== 'none') {
      drawEarthyYard(ctx, SITES.sawmill.x, SITES.sawmill.y + 24, 64, 36);
      drawNaturalTrail(ctx, SITES.logPile.x, SITES.logPile.y + 16, -175, -355, SITES.sawmill.x, SITES.sawmill.y + 32, 1.8);
    }
    if (S.buildings.oxPen.state !== 'none') {
      drawEarthyYard(ctx, SITES.oxPen.x, SITES.oxPen.y + 22, 64, 36);
      drawNaturalTrail(ctx, sx, sy, -120, -55, SITES.oxPen.x, SITES.oxPen.y + 30, 4.8);
    }
    if (S.buildings.barracks.state !== 'none') {
      drawEarthyYard(ctx, SITES.barracks.x, SITES.barracks.y + 26, 64, 38);
      drawNaturalTrail(ctx, sx, sy, -230, -75, SITES.barracks.x, SITES.barracks.y + 36, 3.2);
    }

    const westBridgeMouth = BRIDGE_X - 134;
    const eastBridgeMouth = BRIDGE_X + 134;
    if (S.buildings.bridge.state !== 'none') {
      drawNaturalTrail(ctx, sx, sy, -40, 38, westBridgeMouth, BRIDGE_Y + 6, 1.5);
    }
    if (S.buildings.bridge.state === 'built') {
      if (S.buildings.mill.state !== 'none') {
        drawEarthyYard(ctx, SITES.mill.x, SITES.mill.y + 30, 58, 36);
        drawNaturalTrail(ctx, eastBridgeMouth, BRIDGE_Y + 6, eastBridgeMouth + 32, -45, SITES.mill.x + 12, SITES.mill.y + 52, 3.9);
      }
      if (S.buildings.bakery.state !== 'none') {
        drawEarthyYard(ctx, SITES.bakery.x, SITES.bakery.y + 26, 62, 36);
        drawNaturalTrail(ctx, eastBridgeMouth, BRIDGE_Y + 6, 435, 58, SITES.bakery.x, SITES.bakery.y + 32, 4.6);
      }
      if (S.fields.oat.active) {
        drawEarthyYard(ctx, SITES.oatPile.x, SITES.oatPile.y + 6, 36, 22);
        drawNaturalTrail(ctx, eastBridgeMouth, BRIDGE_Y + 6, 365, 115, SITES.oatPile.x, SITES.oatPile.y + 6, 5.4);
        drawNaturalTrail(ctx, SITES.oatPile.x, SITES.oatPile.y + 6, 460, 235, SITES.oatFarm.x - 28, SITES.oatFarm.y - 12, 2.7);
      }
      if (S.buildings.mill.state !== 'none' && S.buildings.bakery.state !== 'none') {
        drawNaturalTrail(ctx, SITES.mill.x + 12, SITES.mill.y + 52, 455, -45, SITES.bakery.x, SITES.bakery.y + 32, 1.3);
      }
    }
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
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(px + 3, BRIDGE_Y - 18, 12, 10);
      ctx.fillRect(px + 3, BRIDGE_Y + 8, 12, 10);
      ctx.fillStyle = '#64748b';
    });

    ctx.fillStyle = '#5c3415';
    [-0.45, 0, 0.45].forEach(rel => {
      const px = BRIDGE_X + rel * bw;
      ctx.fillRect(px - 4, BRIDGE_Y - 17, 8, 34);
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
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, BRIDGE_Y - 16 - lift * 0.4, 6, 32);
    }

    drawLabelPill(
      ctx, BRIDGE_X, BRIDGE_Y - 38,
      `${br.state === 'ruined' ? '🔥' : '🔨'} Kaarisilta ${Math.round(br.prog * 100)}% (👷${br.builders || 0} • 🌲${br.logsIn}/${br.logsNeed} 🪵${br.boardsIn}/${br.boardsNeed})`,
      '#fde047'
    );
  }

  function drawOxPenUnderConstruction(ctx, pos, b) {
    ctx.save();
    ctx.translate(pos.x, pos.y + 6);
    const rx = 62, ry = 36;
    const totalPosts = 10;
    const builtPosts = Math.max(2, Math.ceil(totalPosts * Math.max(0.18, b.prog)));

    const postCoords = [];
    for (let i = 0; i < totalPosts; i++) {
      const a = (i / totalPosts) * Math.PI * 2;
      postCoords.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry });
    }

    if (b.prog > 0.15) {
      ctx.strokeStyle = '#b4692c';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let i = 0; i < builtPosts - 1; i++) {
        ctx.moveTo(postCoords[i].x, postCoords[i].y - 8);
        ctx.lineTo(postCoords[i + 1].x, postCoords[i + 1].y - 8);
      }
      ctx.stroke();
    }

    for (let i = 0; i < totalPosts; i++) {
      const p = postCoords[i];
      if (i < builtPosts) {
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#291507';
        ctx.lineWidth = 1.5;
        ctx.fillRect(p.x - 3.5, p.y - 15, 7, 17);
        ctx.strokeRect(p.x - 3.5, p.y - 15, 7, 17);
      } else {
        ctx.fillStyle = 'rgba(120, 53, 15, 0.35)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    drawLabelPill(ctx, pos.x, pos.y - 54, `🔨 ${pos.label} ${Math.round(b.prog * 100)}% (👷${b.builders || 0})`, '#fde047');
    drawLabelPill(ctx, pos.x, pos.y + 52, `🌲${b.logsIn}/${b.logsNeed} 🪵${b.boardsIn}/${b.boardsNeed}`, '#fefce8');
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

    ctx.strokeStyle = 'rgba(186, 230, 253, 0.42)';
    ctx.lineWidth = 2.0;
    traceRiverPoly(-6.5 - foamPulse * 0.4);
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

      ctx.beginPath();
      ctx.moveTo(rc - 2, y + 42);
      ctx.quadraticCurveTo(rc + 6, y + 56, rc - 3, y + 70);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    for (let i = 0; i < 65; i++) {
      const sy = -2200 + ((i * 71 + now * 0.025) % 4400);
      const rc = getRiverCenter(sy);
      const rw = getRiverHalfWidth(sy) - 18;
      const sx = rc + Math.sin(i * 19.7) * rw;
      const twinkle = 1.2 + Math.max(0, Math.sin(now * 0.005 + i * 2.1)) * 1.8;
      ctx.beginPath();
      ctx.arc(sx, sy, twinkle, 0, Math.PI * 2);
      ctx.fill();
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

    if (isReady(spr)) {
      ctx.drawImage(spr, site.x - w / 2, site.y - h / 2, w, h);
    }

    const stNames = ['', 'Kuokitaan...', 'Kylvetään...', 'Kasvaa...', 'Sato kypsä!', '❄️ PALELTUNUT!'];
    drawLabelPill(ctx, site.x, site.y + h / 2 + 8, `${label} – ${stNames[f.stage]}`, f.stage === 5 ? '#bae6fd' : '#fef08a');
  }

  function drawUnit4Dir(ctx, unit, baseSprName, carryItem, wSize = 41, hSize = 49, ringColor = null) {
    const lift = getBridgeArchLift(unit.x, unit.y);
    const isRobot = (baseSprName === 'hero_robot');
    const stepVal = unit.step || 0;

    const bounce = unit.moving
      ? (isRobot ? (2.2 + Math.sin(performance.now() * 0.006) * 1.6) : Math.abs(Math.sin(stepVal * 2.1 * Math.PI * 0.5)) * 1.8)
      : (isRobot ? (1.5 + Math.sin(performance.now() * 0.004) * 1.2) : 0);

    const rock = (!unit.moving && unit.working) ? Math.sin(unit.toolPhase || 0) * 0.13 : 0;

    const backKey = `${baseSprName}_back`;
    const dirKey = (unit.faceBack && isReady(IMG[backKey])) ? backKey : baseSprName;

    let frameKey = dirKey;
    if (unit.moving && !isRobot) {
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

    if (isRobot) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
      ctx.beginPath();
      ctx.ellipse(unit.x, unit.y - lift + 2, 14, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(unit.x, unit.y - lift + 2, wSize * 0.32, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(unit.x, unit.y - lift - bounce);
    if (unit.faceLeft) ctx.scale(-1, 1);
    if (rock !== 0) ctx.rotate(rock);
    if (isReady(spr)) {
      ctx.drawImage(spr, -wSize / 2, -hSize + 5, wSize, hSize);
    }
    ctx.restore();

    // Kantamus luonnollisesti olalla tai sylissä (ei ilmassa pään yläpuolella!)
    if (carryItem && unit.kind !== 'ox') {
      const itemMap = {
        log: 'item_log',
        board: 'item_board',
        turnip: 'icon_turnip',
        oat: 'item_oat',
        flour: 'item_flour',
        bread: 'item_bread'
      };
      const cSpr = IMG[itemMap[carryItem]];
      if (isReady(cSpr)) {
        const sideX = unit.faceLeft ? -6 : 6;
        const carryY = (carryItem === 'log' || carryItem === 'board')
          ? (unit.y - lift - bounce - hSize * 0.62)
          : (unit.y - lift - bounce - hSize * 0.50);
        ctx.drawImage(cSpr, unit.x + sideX - 12, carryY - 9, 24, 19);
      }
    } else if (carryItem && unit.kind === 'ox') {
      const itemMap = {
        log: 'item_log', board: 'item_board', turnip: 'icon_turnip',
        oat: 'item_oat', flour: 'item_flour', bread: 'item_bread'
      };
      const cSpr = IMG[itemMap[carryItem]];
      if (isReady(cSpr)) {
        ctx.drawImage(cSpr, unit.x - 12, unit.y - lift - bounce - hSize * 0.72, 24, 19);
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

    // Sillan pohja ja takakaide
    const br = S.buildings.bridge;
    if (br.state === 'built' && isReady(IMG.bridge)) {
      ctx.drawImage(IMG.bridge, BRIDGE_X - 132, BRIDGE_Y - 64, 264, 126);
    } else if (br.state === 'building' || br.state === 'ruined') {
      drawBridgeUnderConstruction(ctx, br);
    } else if (S.unlocks.oatChain) {
      drawLabelPill(ctx, BRIDGE_X, BRIDGE_Y, '🌉 Kaarisillan paikka', '#e0f2fe');
    }

    drawFieldPlot(ctx, SITES.starterGarden, S.fields.starterTurnip, 'Kotitarha', false, true);
    drawFieldPlot(ctx, SITES.turnipFarm, S.fields.turnip, 'Suuri Naurispelto', false, false);
    drawFieldPlot(ctx, SITES.oatFarm, S.fields.oat, 'Suuri Kaurapelto', true, false);

    ctx.fillStyle = 'rgba(45, 58, 48, 0.45)';
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)'; ctx.lineWidth = 2.2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.ellipse(SITES.ship.x, SITES.ship.y + 8, 56, 36, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);

    if (world.selectedEntity === hero && S.heroMedbayTimer <= 0) {
      ctx.strokeStyle = 'rgba(134, 239, 172, 0.28)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.ellipse(hero.x, hero.y, 135, 88, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    if (hero.target && S.heroMedbayTimer <= 0) {
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

    ['mill', 'bakery'].forEach(k => {
      if (S.buildings[k].state === 'none' && S.unlocks.oatChain) {
        const pos = SITES[k];
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.65)'; ctx.lineWidth = 2.2; ctx.setLineDash([6, 5]);
        ctx.strokeRect(pos.x - 42, pos.y - 25, 84, 50); ctx.setLineDash([]);
        drawLabelPill(ctx, pos.x, pos.y, `${pos.label} (Tontti)`, '#fde047');
      }
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
          if (rp.kind === 'river_cattails') {
            ctx.rotate(Math.sin(performance.now() * 0.002 + rp.y * 0.02) * 0.045);
          }
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
          if (isReady(IMG.supply_crate)) {
            ctx.drawImage(IMG.supply_crate, cr.x - 24, cr.y - 28, 48, 45);
          }
          if (Math.hypot(cam.x - cr.x, cam.y - cr.y) < 380) {
            drawLabelPill(ctx, cr.x, cr.y - 34, '📦 Tarvikelaatikko (Vie Sankari)', '#7dd3fc');
          }
        }
      });
    });

    const drawnFlags = [];
    const pushGuardFlag = (post, isSgt) => {
      if (!post) return;
      if (drawnFlags.some(p => Math.hypot(p.x - post.x, p.y - post.y) < 18)) return;
      drawnFlags.push(post);
      renderables.push({
        y: post.y - 4,
        draw: () => {
          if (isReady(IMG.guard_flag)) {
            ctx.drawImage(IMG.guard_flag, post.x - 16, post.y - 44, 32, 48);
          }
        }
      });
    };
    if (world.sergeant && world.sergeant.guardPost) pushGuardFlag(world.sergeant.guardPost, true);
    world.soldiers.forEach(s => { if (s.guardPost) pushGuardFlag(s.guardPost, false); });

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

    renderables.push({
      y: SITES.logPile.y + 18,
      draw: () => {
        if (S.piles.logsAtForest > 0 && isReady(IMG.logs_flour)) {
          ctx.drawImage(IMG.logs_flour, SITES.logPile.x - 36, SITES.logPile.y - 28, 72, 58);
        }
        drawLabelPill(ctx, SITES.logPile.x, SITES.logPile.y + 30, `🌲 Tukit: ${S.piles.logsAtForest}/30`, '#fef08a');
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

    renderables.push({
      y: SITES.ship.y + 20,
      draw: () => {
        if (isReady(IMG.starship)) ctx.drawImage(IMG.starship, SITES.ship.x - 64, SITES.ship.y - 42, 128, 86);
        if (S.heroMedbayTimer > 0) {
          drawLabelPill(ctx, SITES.ship.x, SITES.ship.y - 48, `🏥 Hoitokapseli: Lentäjä toipuu (${Math.ceil(S.heroMedbayTimer)}s)`, '#fca5a5');
        }
        drawLabelPill(ctx, SITES.ship.x, SITES.ship.y + 46, '🚀 Tähtialus', '#bae6fd');
      }
    });

    ['house1', 'house2', 'house3', 'kitchen', 'sawmill', 'oxPen', 'mill', 'bakery', 'barracks'].forEach(key => {
      const b = S.buildings[key];
      if (b.state === 'none') return;
      const pos = SITES[key];
      renderables.push({
        y: pos.y + 28,
        draw: () => {
          if (b.state === 'building' || b.state === 'ruined') {
            if (key === 'oxPen') {
              drawOxPenUnderConstruction(ctx, pos, b);
              return;
            }
            if (isReady(IMG.scaffolding)) ctx.drawImage(IMG.scaffolding, pos.x - 68, pos.y - 60, 136, 118);
            drawLabelPill(ctx, pos.x, pos.y - 64, `${b.state === 'ruined' ? '🔥' : '🔨'} ${pos.label} ${Math.round(b.prog * 100)}% (👷${b.builders || 0})`, '#fde047');
            drawLabelPill(ctx, pos.x, pos.y + 52, `🌲${b.logsIn}/${b.logsNeed} ${b.boardsNeed ? `🪵${b.boardsIn}/${b.boardsNeed}` : ''}`, '#fefce8');
            return;
          }

          if (key.startsWith('house')) {
            if (isReady(IMG.cabin)) ctx.drawImage(IMG.cabin, pos.x - 68, pos.y - 66, 136, 126);
            if (b.residents < b.maxRes) {
              if (world.orcs.length > 0) {
                drawLabelPill(ctx, pos.x, pos.y + 52, '🏠 Vauva turvassa sisällä!', '#86efac');
              } else {
                const spr = b.spawnProg < 0.45 ? IMG.baby_worker : IMG.toddler_worker;
                if (isReady(spr)) ctx.drawImage(spr, pos.x + 6, pos.y + 6, 34, 38);
                const stTxt = S.stew < 3 ? '🍲 Odottaa pataa!' : (b.spawnProg < 0.45 ? `🍼 Vauva ${Math.round(b.spawnProg * 100)}%` : `👶 Syö naurista ${Math.round(b.spawnProg * 100)}%`);
                drawLabelPill(ctx, pos.x, pos.y + 56, stTxt, S.stew < 3 ? '#fca5a5' : '#bbf7d0');
              }
            }
            drawLabelPill(ctx, pos.x, pos.y - 68, `${pos.label} (${b.residents}/${b.maxRes})`, '#fef08a');

          } else if (key === 'kitchen') {
            if (isReady(IMG.kitchen)) ctx.drawImage(IMG.kitchen, pos.x - 70, pos.y - 64, 140, 124);
            drawLabelPill(ctx, pos.x, pos.y - 66, `🍲 Kyläkeittiö (Pata: ${Math.ceil(S.stew)})`, S.stew <= 0.1 ? '#fca5a5' : '#f3e8ff');

          } else if (key === 'sawmill') {
            if (isReady(IMG.sawmill)) ctx.drawImage(IMG.sawmill, pos.x - 74, pos.y - 64, 148, 126);
            drawLabelPill(ctx, pos.x, pos.y - 66, `🪚 Lautatarha (🌲${b.rawLogs} ➔ 🪵${b.outBoards})`, '#fde047');

          } else if (key === 'oxPen') {
            if (isReady(IMG.ox_pen)) ctx.drawImage(IMG.ox_pen, pos.x - 74, pos.y - 60, 148, 120);
            drawLabelPill(ctx, pos.x, pos.y - 62, `🐂 Härkäaitaus (${S.oxCount} härkää)`, '#fde68a');

          } else if (key === 'mill') {
            if (isReady(IMG.watermill)) ctx.drawImage(IMG.watermill, pos.x - 66, pos.y - 72, 132, 144);
            const spR = 2.6 + Math.sin(performance.now() * 0.01) * 1.2;
            ctx.fillStyle = 'rgba(224, 242, 254, 0.75)';
            ctx.beginPath(); ctx.arc(pos.x - 42, pos.y + 50, spR, 0, Math.PI * 2); ctx.arc(pos.x - 30, pos.y + 54, spR * 0.8, 0, Math.PI * 2); ctx.fill();
            drawLabelPill(ctx, pos.x, pos.y - 74, `⚙️ Vesimylly (🌾${b.rawOats} ➔ Jauho:${b.outFlour})`, '#ffffff');

          } else if (key === 'bakery') {
            if (isReady(IMG.bakery)) ctx.drawImage(IMG.bakery, pos.x - 68, pos.y - 66, 136, 132);
            drawLabelPill(ctx, pos.x, pos.y - 68, `🥖 Leipomo (Jauho:${b.rawFlour} ➔ 🥖${b.outBreads || 0})`, '#fed7aa');

          } else if (key === 'barracks') {
            if (isReady(IMG.barracks)) ctx.drawImage(IMG.barracks, pos.x - 70, pos.y - 74, 140, 146);
            if (b.trainQueued && world.orcs.length === 0) {
              const spr = b.trainProg < 0.45 ? IMG.baby_soldier : IMG.toddler_soldier;
              if (isReady(spr)) ctx.drawImage(spr, pos.x + 10, pos.y + 14, 36, 40);
              const tLbl = b.trainType === 'sergeant' ? '🔥 Kersantti' : '🪖 Alokas';
              drawLabelPill(ctx, pos.x, pos.y + 62, `${tLbl} ${Math.round(b.trainProg * 100)}%`, '#bbf7d0');
            }
            const totGuard = S.soldierCount + (S.hasSergeant ? 1 : 0);
            drawLabelPill(ctx, pos.x, pos.y - 76, `🥋 Kasarmi (${totGuard} 🛡️)`, '#bae6fd');
          }
        }
      });
    });

    world.oxen.forEach(ox => {
      renderables.push({
        y: ox.y,
        draw: () => {
          const loaded = Boolean(ox.carry && ox.carry.picked);
          drawUnit4Dir(ctx, ox, loaded ? 'ox_loaded' : 'ox_idle', loaded ? ox.carry.item : null, 64, 56, null);
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
          world.selectedEntity === w ? '#facc15' : null
        )
      });
    });

    world.soldiers.forEach(s => {
      renderables.push({
        y: s.y,
        draw: () => {
          const sprKey = s.female ? 'char_soldier_f' : 'char_soldier';
          drawUnit4Dir(ctx, s, sprKey, null, 42, 50, world.selectedEntity === s ? '#38bdf8' : null);
          if (s.hp < s.maxHp) {
            ctx.fillStyle = '#090d16'; ctx.fillRect(s.x - 13, s.y - 54, 26, 4);
            ctx.fillStyle = '#22c55e'; ctx.fillRect(s.x - 12, s.y - 53, 24 * Math.max(0, s.hp / s.maxHp), 2.2);
          }
        }
      });
    });

    if (world.sergeant) {
      const sgt = world.sergeant;
      renderables.push({
        y: sgt.y,
        draw: () => {
          drawUnit4Dir(ctx, sgt, 'char_sergeant', null, 46, 55, world.selectedEntity === sgt ? '#fb923c' : null);
          ctx.fillStyle = '#090d16'; ctx.fillRect(sgt.x - 15, sgt.y - 60, 30, 4.5);
          ctx.fillStyle = '#f97316'; ctx.fillRect(sgt.x - 14, sgt.y - 59, 28 * Math.max(0, sgt.hp / sgt.maxHp), 2.5);
        }
      });
    }

    world.orcs.forEach(o => {
      renderables.push({
        y: o.y,
        draw: () => {
          drawUnit4Dir(ctx, o, 'char_orc', null, 48, 55, null);
          ctx.fillStyle = '#090d16'; ctx.fillRect(o.x - 14, o.y - 56, 28, 4.5);
          ctx.fillStyle = '#ef4444'; ctx.fillRect(o.x - 13, o.y - 55, 26 * Math.max(0, o.hp / o.maxHp), 2.5);
        }
      });
    });

    if (S.heroMedbayTimer <= 0) {
      const av = AVATARS[S.avatarIdx || 0];
      renderables.push({
        y: hero.y,
        draw: () => drawUnit4Dir(
          ctx, hero, av.sprite, null, 43, 52,
          world.selectedEntity === hero ? '#4ade80' : null
        )
      });
    }

    // Sillan kaareva etukaide ja etutolpat osana Y-lajittelua (peittää vain sillalla kävelijät, ei etualan maastoa)
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
    draw
  };
})();