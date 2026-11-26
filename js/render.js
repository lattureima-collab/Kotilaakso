// ============================================================================
// js/render.js – Elävä joki, Kotilaakso, Rahtikontti & Punakiven Linnake (v8.4)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { SITES, MARS_SITES, BUILDING_KEYS, MARS_BUILDING_KEYS, CARGO_LIMITS, IMAGE_NAMES, getRiverCenter, getRiverHalfWidth, BRIDGE_X, BRIDGE_Y } = KV.CFG;

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
    if (KV.S.viewPlanet !== 'valley' || KV.S.buildings.bridge.state !== 'built') return 0;
    if (Math.abs(y - (BRIDGE_Y - 1)) > 24) return 0;
    const rel = (x - BRIDGE_X) / 122;
    return Math.abs(rel) >= 1 ? 0 : Math.cos(rel * Math.PI * 0.5) * 11;
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

    const builtSpan = totalSpan * Math.max(0.14, br.prog);
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
      `${br.state === 'ruined' ? '🔥 Korjaus:' : '🔨'} Kaarisilta ${Math.round(br.prog * 100)}% (👷${br.builders || 0}/1 • 🌲${br.logsIn}/${br.logsNeed} 🪵${br.boardsIn}/${br.boardsNeed})`,
      br.state === 'ruined' ? '#fca5a5' : '#fde047'
    );
  }

  // Täysi, virtaava ja vaahtoava joki rantapenkerineen!
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
    ctx.strokeStyle = 'rgba(224, 247, 255, 0.36)';
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

  function drawLabelPill(ctx, x, y, text, col = '#fefce8', borderCol = 'rgba(134, 239, 172, 0.35)') {
    ctx.font = 'bold 10.5px system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(18, 24, 20, 0.88)';
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

  function drawEarthyYard(ctx, x, y, rx, ry, mars = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = mars ? 'rgba(92, 32, 20, 0.55)' : 'rgba(64, 102, 30, 0.45)';
    ctx.beginPath(); ctx.ellipse(0, 4, rx + 9, ry + 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mars ? '#7c3a27' : '#9e7747';
    ctx.beginPath(); ctx.ellipse(0, 2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mars ? '#9a4d35' : '#c49d68';
    ctx.beginPath(); ctx.ellipse(-2, 0, rx * 0.78, ry * 0.74, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawNaturalTrail(ctx, x1, y1, cx, cy, x2, y2, seed = 1, mars = false) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(10, Math.floor(dist / 12));
    const pts = [];
    const nx = -(y2 - y1) / (dist || 1), ny = (x2 - x1) / (dist || 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, mt = 1 - t;
      const wig = Math.sin(t * Math.PI * 2.0 + seed) * (9 * Math.sin(t * Math.PI));
      pts.push({
        x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2 + nx * wig,
        y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2 + ny * wig,
        r: 11.2 + Math.sin(i * 1.7 + seed) * 1.7
      });
    }
    ctx.fillStyle = mars ? '#521e13' : '#556b28';
    pts.forEach(p => { ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, p.r + 3.8, (p.r + 3.8) * 0.82, 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = mars ? '#7f3724' : '#966f40';
    pts.forEach(p => { ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r + 1.1, (p.r + 1.1) * 0.8, 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = mars ? '#9c4c35' : '#c8a26d';
    pts.forEach(p => { ctx.beginPath(); ctx.ellipse(p.x, p.y - 0.5, p.r * 0.70, p.r * 0.54, 0, 0, Math.PI * 2); ctx.fill(); });
  }

  function drawValleyPathsAndYards(ctx) {
    const S = KV.S;
    const lx = SITES.lodge.x, ly = SITES.lodge.y + 28;

    drawEarthyYard(ctx, SITES.ship.x, SITES.ship.y + 14, 72, 44);
    if (S.crimsonUnlocked) {
      drawEarthyYard(ctx, SITES.cargoPod.x, SITES.cargoPod.y + 8, 46, 28);
      drawNaturalTrail(ctx, SITES.ship.x + 36, SITES.ship.y + 16, -620, -415, SITES.cargoPod.x - 18, SITES.cargoPod.y + 12, 0.8);
    }
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
    if (S.buildings.bridge.state !== 'none' || KV.State.isOutlineVisible('bridge', 'valley')) {
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

  function drawDynamicLogStack(ctx, x, y, count) {
    ctx.fillStyle = '#5c3a1e';
    ctx.fillRect(x - 34, y + 8, 68, 5);
    if (count <= 0) return;
    const capped = Math.min(30, count);
    for (let i = 0; i < capped; i++) {
      const row = Math.floor(i / 6), col = i % 6;
      const lx = x - 26 + col * 10 + (row % 2) * 2.5, ly = y + 4 - row * 7;
      ctx.fillStyle = '#6b3e1b'; ctx.strokeStyle = '#2b1608'; ctx.lineWidth = 1;
      ctx.fillRect(lx - 4, ly - 4, 10, 6.5); ctx.strokeRect(lx - 4, ly - 4, 10, 6.5);
      ctx.fillStyle = '#eab376'; ctx.beginPath(); ctx.arc(lx - 3, ly - 0.8, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawDynamicBoardStack(ctx, x, y, count) {
    if (count <= 0) return;
    const capped = Math.min(24, count);
    for (let i = 0; i < capped; i++) {
      const row = Math.floor(i / 4), col = i % 4;
      const bx = x + col * 9, by = y - row * 4.2;
      ctx.fillStyle = (row % 2 === 0) ? '#eab364' : '#d49546';
      ctx.strokeStyle = '#5c3412'; ctx.lineWidth = 0.9;
      ctx.fillRect(bx, by, 8, 3.5); ctx.strokeRect(bx, by, 8, 3.5);
    }
  }

  function drawCargoPodBox(ctx, x, y, scale = 1.0, highlight = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(0, 12, 34, 14, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.strokeStyle = highlight ? '#facc15' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-30, -18, 60, 30, 5) : ctx.rect(-30, -18, 60, 30);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-26, -6, 52, 5);
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(-10, -14, 20, 6);
    ctx.restore();
  }

  function drawLargeLodgeSprite(ctx, x, y, alpha = 1.0) {
    if (!isReady(IMG.cabin)) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(IMG.cabin, x - 94, y - 48, 108, 100);
    ctx.save(); ctx.translate(x + 94, y - 48); ctx.scale(-1, 1); ctx.drawImage(IMG.cabin, 0, 0, 108, 100); ctx.restore();
    ctx.drawImage(IMG.cabin, x - 80, y - 78, 160, 146);
    ctx.restore();
  }

  // Kunnollinen linnoitettu Örkkien Vartiopesäke (kivijalka, sakarat, piikit & plasmatykki)
  function drawOrcOutpostStructure(ctx, x, y, hp, maxHp, label) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(0, 14, 48, 24, 0, 0, Math.PI * 2); ctx.fill();

    // Ulkopiikit
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.3;
    [-38, -22, 22, 38].forEach(sx => {
      ctx.beginPath();
      ctx.moveTo(sx - 5, 16); ctx.lineTo(sx, -2); ctx.lineTo(sx + 5, 16);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });

    // Tumma rautabunkkerin runko
    ctx.fillStyle = '#27272a';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-36, -26, 72, 40, 4) : ctx.rect(-36, -26, 72, 40);
    ctx.fill(); ctx.stroke();

    // Sakaramuuri katolla
    ctx.fillStyle = '#3f3f46';
    for (let bx = -34; bx <= 22; bx += 18) {
      ctx.fillRect(bx, -35, 12, 10);
      ctx.strokeRect(bx, -35, 12, 10);
    }

    // Hehkuva ampuma-aukko & tykkitorni
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-18, -10, 36, 5);
    ctx.fillStyle = '#18181b';
    ctx.beginPath(); ctx.arc(0, -24, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fb7185';
    ctx.beginPath(); ctx.arc(-5, -24, 4.5, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    ctx.fillStyle = '#090d16'; ctx.fillRect(x - 32, y - 50, 64, 6);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(x - 31, y - 49, 62 * Math.max(0, hp / maxHp), 4);
    drawLabelPill(ctx, x, y - 62, `⚔️ ${label}`, '#fca5a5', '#ef4444');
  }

  // Kaksitorninen Örkkien Päälinnake sakaramuureineen ja suojakenttineen!
  function drawOrcFortressCitadel(ctx, x, y, hp, maxHp, shielded) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 22, 86, 40, 0, 0, Math.PI * 2); ctx.fill();

    // Kaksi raskasta sivutornia
    [-58, 26].forEach(tx => {
      ctx.fillStyle = '#1f2937';
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 2.4;
      ctx.fillRect(tx, -68, 32, 86);
      ctx.strokeRect(tx, -68, 32, 86);
      // Tornin sakarat
      ctx.fillStyle = '#374151';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(tx - 2 + i * 12, -76, 9, 9);
        ctx.strokeRect(tx - 2 + i * 12, -76, 9, 9);
      }
      // Punainen tähystysaukko
      ctx.fillStyle = '#f87171';
      ctx.fillRect(tx + 9, -46, 14, 5);
    });

    // Keskuslinnoitus
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.8;
    ctx.fillRect(-44, -50, 88, 72);
    ctx.strokeRect(-44, -50, 88, 72);

    // Keskusmuurin sakarat
    ctx.fillStyle = '#27272a';
    for (let mx = -40; mx <= 30; mx += 17) {
      ctx.fillRect(mx, -59, 11, 10);
      ctx.strokeRect(mx, -59, 11, 10);
    }

    // Rautaportti ja hehkuva ydin
    ctx.fillStyle = '#450a0a';
    ctx.beginPath();
    ctx.arc(0, 22, 20, Math.PI, 0);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1.6;
    [-10, 0, 10].forEach(gx => {
      ctx.beginPath(); ctx.moveTo(gx, 4); ctx.lineTo(gx, 22); ctx.stroke();
    });

    // Keskuskanuuna
    const pulse = 0.75 + Math.sin(performance.now() * 0.006) * 0.25;
    ctx.fillStyle = `rgba(248, 113, 113, ${pulse})`;
    ctx.beginPath(); ctx.arc(0, -24, 11, 0, Math.PI * 2); ctx.fill();

    // Etupuolen panssaripiikit
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.4;
    [-64, -46, -28, 28, 46, 64].forEach(px => {
      ctx.beginPath();
      ctx.moveTo(px - 6, 26); ctx.lineTo(px, 6); ctx.lineTo(px + 6, 26);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });

    // Energiakupoli jos vartiopesäkkeet ovat vielä pystyssä
    if (shielded) {
      ctx.strokeStyle = `rgba(248, 113, 113, ${0.45 + pulse * 0.35})`;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.09)';
      ctx.lineWidth = 3.2;
      ctx.setLineDash([10, 6]);
      ctx.beginPath(); ctx.ellipse(0, -12, 92, 68, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    ctx.fillStyle = '#090d16'; ctx.fillRect(x - 54, y - 92, 108, 8);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(x - 52, y - 90, 104 * Math.max(0, hp / maxHp), 4.5);
    drawLabelPill(ctx, x, y - 104, `🏰 Örkkien Päälinnake (${Math.ceil(hp)}/${maxHp} HP)`, '#fecaca', '#ef4444');
    if (shielded) {
      drawLabelPill(ctx, x, y + 48, '🛡️ Suojakenttä aktiivinen – tuhoa vartiopesäkkeet ensin!', '#fde047', '#ef4444');
    }
  }

  function drawRedGhostOutline(ctx, key, planet = 'valley') {
    const pulse = 0.68 + Math.sin(performance.now() * 0.005) * 0.24;
    const redStroke = `rgba(252, 165, 165, ${pulse})`;
    const redFill = `rgba(239, 68, 68, ${0.16 * pulse})`;
    const table = planet === 'crimson' ? MARS_SITES : SITES;
    const pos = table[key];

    if (key.includes('Farm')) {
      ctx.save();
      if (isReady(IMG.field_plowed)) {
        ctx.globalAlpha = 0.28;
        ctx.drawImage(IMG.field_plowed, pos.x - 98, pos.y - 54, 196, 108);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = redFill; ctx.strokeStyle = redStroke; ctx.lineWidth = 3; ctx.setLineDash([9, 6]);
      ctx.beginPath(); ctx.ellipse(pos.x, pos.y, 96, 52, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
      drawLabelPill(ctx, pos.x, pos.y, `🌱 ${pos.label} – Napauta raivataksesi!`, '#fecaca', '#ef4444');
      return;
    }

    const b = planet === 'crimson' ? KV.S.mars.buildings[key] : KV.S.buildings[key];
    const reqTxt = `${b.logsNeed}🌲${b.boardsNeed ? ` ${b.boardsNeed}🪵` : ''}`;

    ctx.save();
    if (key === 'bridge') {
      if (isReady(IMG.bridge)) {
        ctx.globalAlpha = 0.28;
        ctx.drawImage(IMG.bridge, BRIDGE_X - 132, BRIDGE_Y - 64, 264, 126);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = redFill; ctx.strokeStyle = redStroke; ctx.lineWidth = 3; ctx.setLineDash([9, 6]);
      ctx.strokeRect(BRIDGE_X - 126, BRIDGE_Y - 28, 252, 56); ctx.fillRect(BRIDGE_X - 126, BRIDGE_Y - 28, 252, 56);
      ctx.setLineDash([]); ctx.restore();
      drawLabelPill(ctx, BRIDGE_X, BRIDGE_Y - 38, `🔨 ${pos.label} (${reqTxt}) – Napauta!`, '#fecaca', '#ef4444');
      return;
    }

    if (key === 'lodge') {
      drawLargeLodgeSprite(ctx, pos.x, pos.y, 0.28);
    } else {
      const sprMap = { sawmill: 'sawmill', barracks: 'barracks', mill: 'watermill', bakery: 'bakery', mKitchen: 'kitchen', mBunker: 'barracks' };
      const spr = IMG[sprMap[key]];
      if (isReady(spr)) {
        ctx.globalAlpha = 0.28;
        ctx.drawImage(spr, pos.x - 68, pos.y - 68, 136, 132);
      }
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = redFill; ctx.strokeStyle = redStroke; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.ellipse(pos.x, pos.y + 10, (pos.rx || 56) + 10, (pos.ry || 36) + 8, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
    drawLabelPill(ctx, pos.x, pos.y - 42, `🔨 ${pos.label} (${reqTxt})`, '#fecaca', '#ef4444');
    drawLabelPill(ctx, pos.x, pos.y + 46, '👆 Napauta rakentaaksesi (1 rakentaja)', '#fde047', '#ef4444');
  }

  function drawCommanderInsigniaAndTraits(ctx, cmdId, hSize, faceBack) {
    if (cmdId === 'teras') {
      ctx.fillStyle = '#1e3a2f'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(1, -hSize + 10, 10.5, 4.8, -0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!faceBack) {
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(4, -hSize + 10, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.ellipse(1.5, -hSize + 24.5, 6.8, 4.2, 0, 0, Math.PI); ctx.fill();
      }
    }
    if (!faceBack) {
      const cx = 3.5, cy = -hSize * 0.42;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.fillRect(cx - 5, cy - 5.5, 10, 11.5);
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.65;
      for (let i = 0; i < 3; i++) {
        const vy = cy - 2.5 + i * 3.1;
        ctx.beginPath(); ctx.moveTo(cx - 3.5, vy + 1.8); ctx.lineTo(cx, vy - 1.1); ctx.lineTo(cx + 3.5, vy + 1.8); ctx.stroke();
      }
    }
  }

  function drawCommanderPortrait(canvas, cmdId) {
    if (!canvas) return null;
    const pctx = canvas.getContext('2d');
    pctx.clearRect(0, 0, canvas.width, canvas.height);
    const spr = IMG[cmdId === 'teras' ? 'hero_male' : 'char_sergeant'];
    if (!isReady(spr)) return null;
    pctx.save();
    pctx.translate(canvas.width / 2, canvas.height - 10);
    pctx.scale(1.55, 1.55);
    pctx.drawImage(spr, -22, -49, 44, 54);
    drawCommanderInsigniaAndTraits(pctx, cmdId, 54, false);
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
      ctx.strokeStyle = ringColor; ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(unit.x, unit.y - lift + 2, 20, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(unit.x, unit.y - lift + 2, wSize * 0.32, 6, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(unit.x, unit.y - lift - bounce);
    if (unit.faceLeft) ctx.scale(-1, 1);
    if (rock !== 0) ctx.rotate(rock);
    if (isReady(spr)) ctx.drawImage(spr, -wSize / 2, -hSize + 5, wSize, hSize);
    if (commanderId) drawCommanderInsigniaAndTraits(ctx, commanderId, hSize, unit.faceBack);
    ctx.restore();

    if (carryItem) {
      if (carryItem === 'ore') {
        ctx.fillStyle = '#22d3ee'; ctx.strokeStyle = '#083344'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(unit.x + 6, unit.y - 26, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        const itemMap = { log: 'item_log', board: 'item_board', turnip: 'icon_turnip', oat: 'item_oat', flour: 'item_flour', bread: 'item_bread' };
        const cSpr = IMG[itemMap[carryItem]];
        if (isReady(cSpr)) ctx.drawImage(cSpr, unit.x - 8, unit.y - lift - bounce - hSize * 0.58 - 9, 24, 19);
      }
    }
  }

  function getWorkerSpriteName(w) {
    const fem = Boolean(w.female);
    if (w.role === 'woodcutter' || w.role === 'mMiner') return fem ? 'char_woodcutter_f' : 'char_woodcutter';
    if (w.role === 'turnipFarmer' || w.role === 'oatFarmer' || w.role === 'mFarmer') return fem ? 'char_farmer_f' : 'char_farmer';
    if (w.role === 'cookGardener' || w.role === 'miller' || w.role === 'baker' || w.role === 'mCook') return fem ? 'char_baker_f' : 'char_baker';
    return fem ? 'char_builder_f' : 'char_builder';
  }

  // --- PUNAKIVI-PLANEETAN PIIRTO ---
  function drawCrimsonWorld(ctx) {
    const { S, world, hero } = KV;
    const M = S.mars, ft = M.fortress;

    ctx.fillStyle = '#6e2c1b';
    ctx.fillRect(-3000, -2600, 6000, 5200);

    // Kivikkokerrostumat ja harjanteet maaperässä
    (world.marsPatches || []).forEach(mp => {
      ctx.fillStyle = mp.dark ? 'rgba(64, 21, 12, 0.42)' : 'rgba(148, 66, 44, 0.32)';
      ctx.beginPath();
      ctx.ellipse(mp.x, mp.y, mp.rx, mp.ry, 0.2, 0, Math.PI * 2);
      ctx.fill();
    });

    world.marsCraters.forEach(cr => {
      ctx.fillStyle = cr.fertile ? '#4d2418' : '#572013';
      ctx.strokeStyle = '#8c3f2b'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(cr.x, cr.y, cr.rx, cr.ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (cr.fertile) {
        ctx.fillStyle = 'rgba(74, 124, 44, 0.38)';
        ctx.beginPath(); ctx.ellipse(cr.x, cr.y, cr.rx * 0.84, cr.ry * 0.82, 0, 0, Math.PI * 2); ctx.fill();
      }
    });

    drawEarthyYard(ctx, MARS_SITES.ship.x, MARS_SITES.ship.y + 10, 68, 42, true);
    drawEarthyYard(ctx, MARS_SITES.depot.x, MARS_SITES.depot.y + 8, 52, 32, true);
    if (M.buildings.mKitchen.state !== 'none') drawEarthyYard(ctx, MARS_SITES.mKitchen.x, MARS_SITES.mKitchen.y + 20, 56, 34, true);
    if (M.buildings.mBunker.state !== 'none') drawEarthyYard(ctx, MARS_SITES.mBunker.x, MARS_SITES.mBunker.y + 22, 60, 36, true);

    drawNaturalTrail(ctx, MARS_SITES.ship.x + 30, MARS_SITES.ship.y + 16, -490, -82, MARS_SITES.depot.x - 16, MARS_SITES.depot.y + 12, 0.6, true);
    drawNaturalTrail(ctx, MARS_SITES.depot.x, MARS_SITES.depot.y + 20, -395, 15, MARS_SITES.mKitchen.x, MARS_SITES.mKitchen.y + 28, 1.9, true);
    drawNaturalTrail(ctx, MARS_SITES.mKitchen.x - 20, MARS_SITES.mKitchen.y + 28, -430, 185, MARS_SITES.mTurnipFarm.x + 50, MARS_SITES.mTurnipFarm.y - 10, 3.1, true);
    drawNaturalTrail(ctx, MARS_SITES.depot.x + 16, MARS_SITES.depot.y + 18, -260, -45, MARS_SITES.mBunker.x, MARS_SITES.mBunker.y + 24, 1.4, true);
    drawNaturalTrail(ctx, MARS_SITES.mBunker.x + 30, MARS_SITES.mBunker.y + 10, 180, -10, MARS_SITES.fortress.x - 70, MARS_SITES.fortress.y + 12, 2.2, true);

    if (M.field.active) {
      let spr = IMG.field_plowed;
      if (M.field.stage === 3) spr = IMG.field_sprouts;
      else if (M.field.stage === 4) spr = IMG.field_turnip_ripe;
      if (isReady(spr)) ctx.drawImage(spr, MARS_SITES.mTurnipFarm.x - 96, MARS_SITES.mTurnipFarm.y - 54, 192, 108);
      const stNames = ['', 'Kuokitaan...', 'Kylvetään...', 'Kasvaa...', 'Sato kypsä!'];
      drawLabelPill(ctx, MARS_SITES.mTurnipFarm.x, MARS_SITES.mTurnipFarm.y + 62, `Kraatterin Naurismaa – ${stNames[M.field.stage] || ''}`, '#fef08a');
    }

    ['mKitchen', 'mTurnipFarm', 'mBunker', 'starMine'].forEach(k => {
      if (KV.State.isOutlineVisible(k, 'crimson')) drawRedGhostOutline(ctx, k, 'crimson');
    });

    ctx.strokeStyle = 'rgba(253, 186, 116, 0.6)'; ctx.lineWidth = 2.2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.ellipse(MARS_SITES.ship.x, MARS_SITES.ship.y + 8, 60, 38, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (S.shipPlanet !== 'crimson') {
      drawLabelPill(ctx, MARS_SITES.ship.x, MARS_SITES.ship.y, '🚀 Tähtialus on nyt Kotilaaksossa', '#fed7aa');
    }

    if (S.commanderChosen && S.shipPlanet === 'crimson' && world.selectedEntity === hero && S.heroMedbayTimer <= 0) {
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.34)'; ctx.lineWidth = 1.8; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.ellipse(hero.x, hero.y, 145, 92, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }

    const renderables = [];

    // Punakiven vartioliput
    const mFlags = [];
    world.marsSoldiers.forEach(s => {
      if (!s.guardPost || mFlags.some(p => Math.hypot(p.x - s.guardPost.x, p.y - s.guardPost.y) < 18)) return;
      mFlags.push(s.guardPost);
      renderables.push({
        y: s.guardPost.y - 4,
        draw: () => { if (isReady(IMG.guard_flag)) ctx.drawImage(IMG.guard_flag, s.guardPost.x - 16, s.guardPost.y - 44, 32, 48); }
      });
    });

    world.marsRocks.forEach(rk => {
      renderables.push({
        y: rk.y,
        draw: () => {
          if (!isReady(IMG.river_rocks)) return;
          ctx.save();
          ctx.translate(rk.x, rk.y);
          if (rk.flip) ctx.scale(-1, 1);
          ctx.filter = 'sepia(0.65) saturate(1.8) hue-rotate(-22deg)';
          ctx.drawImage(IMG.river_rocks, -30 * rk.scale, -24 * rk.scale, 60 * rk.scale, 38 * rk.scale);
          ctx.restore();
        }
      });
    });

    if (M.field.active) {
      renderables.push({
        y: MARS_SITES.mTurnipBox.y + 12,
        draw: () => {
          const n = Math.min(6, M.turnips);
          for (let i = 0; i < n; i++) {
            if (isReady(IMG.icon_turnip)) ctx.drawImage(IMG.icon_turnip, MARS_SITES.mTurnipBox.x - 18 + (i % 3) * 12, MARS_SITES.mTurnipBox.y - 10 - Math.floor(i / 3) * 7, 21, 21);
          }
          drawLabelPill(ctx, MARS_SITES.mTurnipBox.x, MARS_SITES.mTurnipBox.y + 22, `Nauriskori: ${M.turnips}`, '#f3e8ff');
        }
      });
    }

    renderables.push({
      y: MARS_SITES.depot.y + 16,
      draw: () => {
        drawCargoPodBox(ctx, MARS_SITES.depot.x - 18, MARS_SITES.depot.y, 0.88, false);
        drawDynamicLogStack(ctx, MARS_SITES.depot.x + 26, MARS_SITES.depot.y - 2, M.logs);
        drawDynamicBoardStack(ctx, MARS_SITES.depot.x + 10, MARS_SITES.depot.y + 18, M.boards);
        drawLabelPill(ctx, MARS_SITES.depot.x, MARS_SITES.depot.y - 28, `📦 Rahtivarasto: 🌲${M.logs} • 🪵${M.boards}`, '#fde047');
      }
    });

    if (S.shipPlanet === 'crimson') {
      renderables.push({
        y: MARS_SITES.ship.y + 20,
        draw: () => {
          const flyOffset = world.flightAnim ? Math.pow(1 - world.flightAnim.timer / world.flightAnim.dur, 2) * 380 : 0;
          if (flyOffset > 4) drawCargoPodBox(ctx, MARS_SITES.ship.x, MARS_SITES.ship.y + 18 - flyOffset, 0.82, true);
          if (isReady(IMG.starship)) ctx.drawImage(IMG.starship, MARS_SITES.ship.x - 68, MARS_SITES.ship.y - 44 - flyOffset, 136, 92);
          if (S.heroMedbayTimer > 0) {
            drawLabelPill(ctx, MARS_SITES.ship.x, MARS_SITES.ship.y - 50, `🏥 Hoitokapseli (${Math.ceil(S.heroMedbayTimer)}s)`, '#fca5a5');
          }
          drawLabelPill(ctx, MARS_SITES.ship.x, MARS_SITES.ship.y + 48, '🚀 Tähtialus – Napauta (Paluu / Miehistö)', '#bae6fd');
        }
      });
    }

    MARS_BUILDING_KEYS.forEach(k => {
      const mb = M.buildings[k];
      if (!mb || mb.state === 'none') return;
      const ms = MARS_SITES[k];
      renderables.push({
        y: ms.y + 26,
        draw: () => {
          if (mb.state === 'building' || mb.state === 'ruined') {
            if (isReady(IMG.scaffolding)) ctx.drawImage(IMG.scaffolding, ms.x - 68, ms.y - 58, 136, 116);
            drawLabelPill(ctx, ms.x, ms.y - 62, `🔨 ${ms.label} ${Math.round(mb.prog * 100)}% (👷${mb.builders || 0}/1)`, '#fde047');
            drawLabelPill(ctx, ms.x, ms.y + 52, `🌲${mb.logsIn}/${mb.logsNeed} 🪵${mb.boardsIn}/${mb.boardsNeed}`, '#fefce8');
            return;
          }
          if (k === 'mKitchen') {
            if (isReady(IMG.kitchen)) ctx.drawImage(IMG.kitchen, ms.x - 68, ms.y - 62, 136, 120);
            drawLabelPill(ctx, ms.x, ms.y - 64, `🍲 Kenttäkeittiö (Pata: ${Math.ceil(M.stew)})`, '#f3e8ff');
          } else if (k === 'mBunker') {
            if (isReady(IMG.barracks)) ctx.drawImage(IMG.barracks, ms.x - 68, ms.y - 70, 136, 138);
            drawLabelPill(ctx, ms.x, ms.y - 72, '🛡️ Etuvartion Bunkkeri (-45 % osumavahinko)', '#bae6fd');
          } else if (k === 'starMine') {
            ctx.fillStyle = '#083344'; ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(ms.x, ms.y + 8, 54, 32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            for (let c = -2; c <= 2; c++) {
              ctx.fillStyle = c % 2 === 0 ? '#67e8f9' : '#06b6d4';
              ctx.beginPath();
              ctx.moveTo(ms.x + c * 14, ms.y - 34 - Math.abs(c % 2) * 10);
              ctx.lineTo(ms.x + c * 14 - 9, ms.y + 8);
              ctx.lineTo(ms.x + c * 14 + 9, ms.y + 8);
              ctx.closePath(); ctx.fill();
            }
            drawLabelPill(ctx, ms.x, ms.y - 52, `💎 Tähtimalmin Keräyspiste (Louhittu: ${S.starOre})`, '#67e8f9');
          }
        }
      });
    });

    if (!ft.conquered) {
      [
        { hp: ft.outpostNHp, max: ft.outpostNMax, pos: MARS_SITES.outpostN, lbl: 'Pohjoinen Vartiopesäke' },
        { hp: ft.outpostSHp, max: ft.outpostSMax, pos: MARS_SITES.outpostS, lbl: 'Eteläinen Vartiopesäke' }
      ].forEach(op => {
        if (op.hp <= 0) return;
        renderables.push({
          y: op.pos.y + 20,
          draw: () => drawOrcOutpostStructure(ctx, op.pos.x, op.pos.y, op.hp, op.max, op.lbl)
        });
      });

      renderables.push({
        y: MARS_SITES.fortress.y + 30,
        draw: () => drawOrcFortressCitadel(ctx, MARS_SITES.fortress.x, MARS_SITES.fortress.y, ft.mainHp, ft.mainMax, ft.outpostNHp > 0 || ft.outpostSHp > 0)
      });
    } else if (M.buildings.starMine.state === 'none') {
      renderables.push({
        y: MARS_SITES.fortress.y + 10,
        draw: () => {
          ctx.fillStyle = '#083344';
          ctx.beginPath(); ctx.ellipse(MARS_SITES.fortress.x, MARS_SITES.fortress.y + 6, 42, 24, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath(); ctx.arc(MARS_SITES.fortress.x, MARS_SITES.fortress.y, 16, 0, Math.PI * 2); ctx.fill();
        }
      });
    }

    world.marsWorkers.forEach(w => {
      renderables.push({
        y: w.y,
        draw: () => drawUnit4Dir(ctx, w, getWorkerSpriteName(w), (w.carry && w.carry.picked) ? w.carry.item : null, 41, 49, world.selectedEntity === w ? '#facc15' : null, null)
      });
    });

    world.marsSoldiers.forEach(s => {
      renderables.push({
        y: s.y,
        draw: () => {
          drawUnit4Dir(ctx, s, s.female ? 'char_soldier_f' : 'char_soldier', null, 42, 50, world.selectedEntity === s ? '#38bdf8' : null, null);
          if (s.hp < s.maxHp) {
            ctx.fillStyle = '#090d16'; ctx.fillRect(s.x - 13, s.y - 54, 26, 4);
            ctx.fillStyle = '#22c55e'; ctx.fillRect(s.x - 12, s.y - 53, 24 * Math.max(0, s.hp / s.maxHp), 2.2);
          }
        }
      });
    });

    world.marsOrcs.forEach(o => {
      renderables.push({
        y: o.y,
        draw: () => {
          drawUnit4Dir(ctx, o, 'char_orc', null, 48, 55, null, null);
          ctx.fillStyle = '#090d16'; ctx.fillRect(o.x - 14, o.y - 56, 28, 4.5);
          ctx.fillStyle = '#ef4444'; ctx.fillRect(o.x - 13, o.y - 55, 26 * Math.max(0, o.hp / o.maxHp), 2.5);
        }
      });
    });

    if (S.commanderChosen && S.shipPlanet === 'crimson' && S.heroMedbayTimer <= 0 && !world.flightAnim) {
      const cmdSpec = KV.State.getCommanderSpec();
      renderables.push({
        y: hero.y,
        draw: () => {
          drawUnit4Dir(ctx, hero, cmdSpec.sprite, null, 46, 56, world.selectedEntity === hero ? '#fb923c' : null, cmdSpec.id);
          if (hero.hp < hero.maxHp) {
            ctx.fillStyle = '#090d16'; ctx.fillRect(hero.x - 16, hero.y - 62, 32, 4.5);
            ctx.fillStyle = '#fb923c'; ctx.fillRect(hero.x - 15, hero.y - 61, 30 * Math.max(0, hero.hp / hero.maxHp), 2.5);
          }
        }
      });
    }

    renderables.sort((a, b) => a.y - b.y);
    renderables.forEach(r => r.draw());

    world.marsBullets.forEach(bl => {
      ctx.fillStyle = bl.friendly ? '#38bdf8' : '#fb7185';
      ctx.beginPath(); ctx.arc(bl.x, bl.y, 4.2, 0, Math.PI * 2); ctx.fill();
    });
  }

  // --- KOTILAAKSON PIIRTO ---
  function drawValleyWorld(ctx) {
    const { S, world, hero, cam } = KV;

    if (grassPattern) { ctx.fillStyle = grassPattern; ctx.fillRect(-3400, -3000, 6800, 6000); }
    world.meadowFlora.forEach(mf => {
      if (mf.type === 'clover') {
        ctx.fillStyle = '#3f8f29';
        ctx.beginPath();
        ctx.arc(mf.x - 2.4, mf.y, 2.4, 0, Math.PI * 2);
        ctx.arc(mf.x + 2.4, mf.y, 2.4, 0, Math.PI * 2);
        ctx.arc(mf.x, mf.y - 2.4, 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = mf.col;
        ctx.beginPath(); ctx.arc(mf.x, mf.y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    });

    drawValleyPathsAndYards(ctx);
    drawRiverWaterAndBanks(ctx);

    const br = S.buildings.bridge;
    if (br.state === 'built' && isReady(IMG.bridge)) {
      ctx.drawImage(IMG.bridge, BRIDGE_X - 132, BRIDGE_Y - 64, 264, 126);
    } else if (br.state === 'building' || br.state === 'ruined') {
      drawBridgeUnderConstruction(ctx, br);
    }

    const drawVField = (site, f, lbl, isOat, small) => {
      if (!f.active) return;
      const w = small ? 132 : 204, h = small ? 76 : 116;
      let spr = IMG.field_plowed;
      if (f.stage === 3) spr = IMG.field_sprouts;
      else if (f.stage === 4) spr = isOat ? IMG.field_oat_ripe : IMG.field_turnip_ripe;
      else if (f.stage === 5) spr = IMG.field_frost;
      if (isReady(spr)) ctx.drawImage(spr, site.x - w / 2, site.y - h / 2, w, h);
      const stNames = ['', 'Kuokitaan...', 'Kylvetään...', 'Kasvaa...', 'Sato kypsä!', '❄️ PALELTUNUT!'];
      drawLabelPill(ctx, site.x, site.y + h / 2 + 8, `${lbl} – ${stNames[f.stage] || ''}`, f.stage === 5 ? '#bae6fd' : '#fef08a');
    };
    drawVField(SITES.starterGarden, S.fields.starterTurnip, 'Kotitarha', false, true);
    drawVField(SITES.turnipFarm, S.fields.turnip, 'Suuri Naurispelto', false, false);
    drawVField(SITES.oatFarm, S.fields.oat, 'Suuri Kaurapelto', true, false);

    ['lodge', 'sawmill', 'turnipFarm', 'barracks', 'bridge', 'mill', 'bakery', 'oatFarm'].forEach(k => {
      if (KV.State.isOutlineVisible(k, 'valley')) drawRedGhostOutline(ctx, k, 'valley');
    });

    ctx.fillStyle = 'rgba(45, 58, 48, 0.42)';
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)'; ctx.lineWidth = 2.2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.ellipse(SITES.ship.x, SITES.ship.y + 8, 60, 38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    if (S.shipPlanet !== 'valley') drawLabelPill(ctx, SITES.ship.x, SITES.ship.y, '🚀 Tähtialus on Punakivi-planeetalla', '#bae6fd');

    if (S.commanderChosen && S.shipPlanet === 'valley' && world.selectedEntity === hero && S.heroMedbayTimer <= 0) {
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.34)'; ctx.lineWidth = 1.8; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.ellipse(hero.x, hero.y, 145, 92, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }

    const renderables = [];

    // Rantakivet ja osmankäämit takaisin!
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

    // Metsän kaatuneet rungot ja kukkapensaat takaisin!
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

    // Vartioliput
    const drawnFlags = [];
    world.soldiers.forEach(s => {
      if (!s.guardPost || drawnFlags.some(p => Math.hypot(p.x - s.guardPost.x, p.y - s.guardPost.y) < 18)) return;
      drawnFlags.push(s.guardPost);
      renderables.push({
        y: s.guardPost.y - 4,
        draw: () => { if (isReady(IMG.guard_flag)) ctx.drawImage(IMG.guard_flag, s.guardPost.x - 16, s.guardPost.y - 44, 32, 48); }
      });
    });

    world.trees.forEach(t => {
      if (Math.abs(t.x - cam.x) > 1300 || Math.abs(t.y - cam.y) > 1000) return;
      renderables.push({
        y: t.y + 10,
        draw: () => {
          if (t.regrow > 0) { if (isReady(IMG.stump)) ctx.drawImage(IMG.stump, t.x - 19, t.y - 13, 38, 32); }
          else {
            const spr = t.kind === 'birch' ? IMG.birch_tree : IMG.pine_tree;
            if (isReady(spr)) {
              const w = 82 * t.scale, h = 108 * t.scale;
              ctx.fillStyle = 'rgba(15, 38, 12, 0.25)';
              ctx.beginPath(); ctx.ellipse(t.x, t.y + 9, w * 0.35, 10, 0, 0, Math.PI * 2); ctx.fill();
              ctx.drawImage(spr, t.x - w / 2, t.y - h + 16, w, h);
            }
          }
        }
      });
    });

    world.supplyCrates.forEach(cr => {
      renderables.push({
        y: cr.y + 8,
        draw: () => {
          if (isReady(IMG.supply_crate)) ctx.drawImage(IMG.supply_crate, cr.x - 24, cr.y - 28, 48, 45);
          if (Math.hypot(cam.x - cr.x, cam.y - cr.y) < 360) {
            drawLabelPill(ctx, cr.x, cr.y - 34, S.commanderChosen ? '📦 Tarvikelaatikko (Vie Kersantti)' : '📦 Tarvikelaatikko', '#7dd3fc');
          }
        }
      });
    });

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

    if (S.shipPlanet === 'valley') {
      renderables.push({
        y: SITES.ship.y + 20,
        draw: () => {
          const flyOffset = world.flightAnim ? Math.pow(1 - world.flightAnim.timer / world.flightAnim.dur, 2) * 380 : 0;
          if (flyOffset > 4) drawCargoPodBox(ctx, SITES.ship.x, SITES.ship.y + 18 - flyOffset, 0.82, true);
          if (isReady(IMG.starship)) ctx.drawImage(IMG.starship, SITES.ship.x - 68, SITES.ship.y - 44 - flyOffset, 136, 92);
          if (S.heroMedbayTimer > 0) {
            drawLabelPill(ctx, SITES.ship.x, SITES.ship.y - 50, `🏥 Hoitokapseli (${Math.ceil(S.heroMedbayTimer)}s)`, '#fca5a5');
          }
          drawLabelPill(ctx, SITES.ship.x, SITES.ship.y + 48, '🚀 Tähtialus – Napauta (Lento & Miehistö)', '#bae6fd');
        }
      });

      if (S.crimsonUnlocked && !world.flightAnim) {
        renderables.push({
          y: SITES.cargoPod.y + 18,
          draw: () => {
            drawCargoPodBox(ctx, SITES.cargoPod.x, SITES.cargoPod.y, 1.0, S.cargo.fillActive);
            drawLabelPill(
              ctx, SITES.cargoPod.x, SITES.cargoPod.y - 30,
              `📦 Kontti: 🌲${S.cargo.logs}/${CARGO_LIMITS.MAX_LOGS} 🪵${S.cargo.boards}/${CARGO_LIMITS.MAX_BOARDS} 🍲${S.cargo.stew}/${CARGO_LIMITS.MAX_STEW}`,
              S.cargo.fillActive ? '#fde047' : '#e2e8f0'
            );
            drawLabelPill(ctx, SITES.cargoPod.x, SITES.cargoPod.y + 32, S.cargo.fillActive ? '🟢 Täyttö PÄÄLLÄ (Napauta)' : '⚪ Napauta täyttääksesi kontin', '#86efac');
          }
        });
      }
    }

    ['lodge', 'kitchen', 'sawmill', 'barracks', 'mill', 'bakery'].forEach(key => {
      const b = S.buildings[key];
      if (!b || b.state === 'none') return;
      const pos = SITES[key];
      renderables.push({
        y: pos.y + 28,
        draw: () => {
          if (b.state === 'building' || b.state === 'ruined') {
            if (isReady(IMG.scaffolding)) ctx.drawImage(IMG.scaffolding, pos.x - 72, pos.y - 62, 144, 122);
            const prefix = b.state === 'ruined' ? '🔥 PALANUT – Napauta korjataksesi:' : '🔨';
            drawLabelPill(ctx, pos.x, pos.y - 66, `${prefix} ${pos.label} ${Math.round(b.prog * 100)}% (👷${b.builders || 0}/1)`, b.state === 'ruined' ? '#fca5a5' : '#fde047');
            drawLabelPill(ctx, pos.x, pos.y + 54, `🌲${b.logsIn}/${b.logsNeed} ${b.boardsNeed ? `🪵${b.boardsIn}/${b.boardsNeed}` : ''}`, '#fefce8');
            return;
          }
          if (key === 'lodge') {
            drawLargeLodgeSprite(ctx, pos.x, pos.y, 1.0);
            if (b.growing) {
              const bSpr = b.spawnProg < 0.45 ? IMG.baby_worker : IMG.toddler_worker;
              if (isReady(bSpr)) ctx.drawImage(bSpr, pos.x + 8, pos.y + 16, 36, 40);
            }
            drawLabelPill(ctx, pos.x, pos.y - 80, `🏡 Iso Kylätalo (Väki: ${KV.State.getLivingPopulation()}/${KV.State.getMaxSustainablePop()})`, '#fef08a');
            drawLabelPill(ctx, pos.x, pos.y + 60, b.growing ? `👶 Kasvaa: ${Math.round(b.spawnProg * 100)}%` : '👆 Napauta kasvattaaksesi kyläläisen', '#bbf7d0');
          } else if (key === 'kitchen') {
            if (isReady(IMG.kitchen)) ctx.drawImage(IMG.kitchen, pos.x - 70, pos.y - 64, 140, 124);
            drawLabelPill(ctx, pos.x, pos.y - 66, `🍲 Kyläkeittiö (Pata: ${Math.ceil(S.stew)})`, '#f3e8ff');
          } else if (key === 'sawmill') {
            if (isReady(IMG.sawmill)) ctx.drawImage(IMG.sawmill, pos.x - 74, pos.y - 64, 148, 126);
            drawDynamicBoardStack(ctx, pos.x + 48, pos.y + 24, b.outBoards);
            drawLabelPill(ctx, pos.x, pos.y - 66, `🪚 Lautatarha (🌲${b.rawLogs} ➔ 🪵${b.outBoards}/24)`, '#fde047');
          } else if (key === 'barracks') {
            if (isReady(IMG.barracks)) ctx.drawImage(IMG.barracks, pos.x - 70, pos.y - 74, 140, 146);
            if (b.trainQueued) {
              const sSpr = b.trainProg < 0.45 ? IMG.baby_soldier : IMG.toddler_soldier;
              if (isReady(sSpr)) ctx.drawImage(sSpr, pos.x + 10, pos.y + 14, 36, 40);
            }
            drawLabelPill(ctx, pos.x, pos.y - 76, `🥋 Varuskunta (${S.soldierCount} kaartilaista)`, '#bae6fd');
            drawLabelPill(ctx, pos.x, pos.y + 60, b.trainQueued ? `🪖 Koulutus ${Math.round(b.trainProg * 100)}%` : '👆 Napauta kouluttaaksesi kaartilaisen', '#bae6fd');
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
        draw: () => drawUnit4Dir(ctx, w, getWorkerSpriteName(w), (w.carry && w.carry.picked) ? w.carry.item : null, 41, 49, world.selectedEntity === w ? '#facc15' : null, null)
      });
    });

    world.soldiers.forEach(s => {
      renderables.push({
        y: s.y,
        draw: () => {
          drawUnit4Dir(ctx, s, s.female ? 'char_soldier_f' : 'char_soldier', null, 42, 50, world.selectedEntity === s ? '#38bdf8' : null, null);
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

    if (S.commanderChosen && S.shipPlanet === 'valley' && S.heroMedbayTimer <= 0 && !world.flightAnim) {
      const cmdSpec = KV.State.getCommanderSpec();
      renderables.push({
        y: hero.y,
        draw: () => {
          drawUnit4Dir(ctx, hero, cmdSpec.sprite, null, 46, 56, world.selectedEntity === hero ? '#fb923c' : null, cmdSpec.id);
          if (hero.hp < hero.maxHp) {
            const lift = getBridgeArchLift(hero.x, hero.y);
            ctx.fillStyle = '#090d16'; ctx.fillRect(hero.x - 16, hero.y - lift - 62, 32, 4.5);
            ctx.fillStyle = '#fb923c'; ctx.fillRect(hero.x - 15, hero.y - lift - 61, 30 * Math.max(0, hero.hp / hero.maxHp), 2.5);
          }
        }
      });
    }

    if (br.state === 'built') renderables.push({ y: BRIDGE_Y + 24, draw: () => drawBridgeFrontArch(ctx) });

    renderables.sort((a, b) => a.y - b.y);
    renderables.forEach(r => r.draw());

    world.bullets.forEach(bl => {
      ctx.fillStyle = bl.friendly ? '#38bdf8' : '#fb7185';
      ctx.beginPath(); ctx.arc(bl.x, bl.y, 4, 0, Math.PI * 2); ctx.fill();
    });
  }

  function draw(canvas, ctx) {
    const W = canvas.width = window.innerWidth;
    const H = canvas.height = window.innerHeight;
    const { S, world, cam } = KV;

    ctx.fillStyle = S.viewPlanet === 'crimson' ? '#572013' : '#4c8c2b';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(S.zoom || 0.75, S.zoom || 0.75);
    ctx.translate(-cam.x, -cam.y);

    if (S.viewPlanet === 'crimson') drawCrimsonWorld(ctx);
    else drawValleyWorld(ctx);

    world.steamPuffs.forEach(p => {
      ctx.fillStyle = p.fire ? `rgba(251, 113, 133, ${p.a})` : (p.purple ? `rgba(233, 213, 255, ${p.a})` : `rgba(248, 250, 252, ${p.a})`);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });

    world.clickRipples.forEach(rp => {
      ctx.strokeStyle = `rgba(134, 239, 172, ${rp.a})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    });
    world.speech.forEach(s => drawLabelPill(ctx, s.x, s.y, s.text, s.col));

    ctx.restore();
  }

  KV.Render = { loadImages, drawCommanderPortrait, draw };
})();