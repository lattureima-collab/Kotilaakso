// ============================================================================
// js/render.js – Kotilaakson, Rahtikontin, Punakiven & Linnakkeen piirto (v8.3)
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
    const steps = Math.max(10, Math.floor(dist / 13));
    const pts = [];
    const nx = -(y2 - y1) / (dist || 1), ny = (x2 - x1) / (dist || 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, mt = 1 - t;
      const wig = Math.sin(t * Math.PI * 2.0 + seed) * (8 * Math.sin(t * Math.PI));
      pts.push({
        x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2 + nx * wig,
        y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2 + ny * wig,
        r: 11 + Math.sin(i * 1.7 + seed) * 1.6
      });
    }
    ctx.fillStyle = mars ? '#5c2418' : '#556b28';
    pts.forEach(p => { ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, p.r + 3.5, (p.r + 3.5) * 0.8, 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = mars ? '#853c29' : '#966f40';
    pts.forEach(p => { ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r + 1, (p.r + 1) * 0.78, 0, 0, Math.PI * 2); ctx.fill(); });
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

  // Metallinen Rahtikontti (laskeutumisalustalla tai kiinnitettynä aluksen alle)
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

  function drawRedGhostOutline(ctx, key, planet = 'valley') {
    const pulse = 0.68 + Math.sin(performance.now() * 0.005) * 0.24;
    const redStroke = `rgba(252, 165, 165, ${pulse})`;
    const redFill = `rgba(239, 68, 68, ${0.16 * pulse})`;
    const table = planet === 'crimson' ? MARS_SITES : SITES;
    const pos = table[key];

    if (key.includes('Farm')) {
      ctx.save();
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
      ctx.fillStyle = redFill; ctx.strokeStyle = redStroke; ctx.lineWidth = 3; ctx.setLineDash([9, 6]);
      ctx.strokeRect(BRIDGE_X - 126, BRIDGE_Y - 28, 252, 56); ctx.fillRect(BRIDGE_X - 126, BRIDGE_Y - 28, 252, 56);
      ctx.setLineDash([]); ctx.restore();
      drawLabelPill(ctx, BRIDGE_X, BRIDGE_Y - 38, `🔨 ${pos.label} (${reqTxt}) – Napauta!`, '#fecaca', '#ef4444');
      return;
    }

    ctx.fillStyle = redFill; ctx.strokeStyle = redStroke; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.ellipse(pos.x, pos.y + 10, (pos.rx || 56) + 10, (pos.ry || 36) + 8, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
    drawLabelPill(ctx, pos.x, pos.y - 38, `🔨 ${pos.label} (${reqTxt})`, '#fecaca', '#ef4444');
    drawLabelPill(ctx, pos.x, pos.y + 44, '👆 Napauta rakentaaksesi (1 rakentaja)', '#fde047', '#ef4444');
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

    // Punertava kallioperä ja kraatterit
    ctx.fillStyle = '#6e2c1b';
    ctx.fillRect(-3000, -2600, 6000, 5200);

    world.marsCraters.forEach(cr => {
      ctx.fillStyle = cr.fertile ? '#4d2418' : '#572013';
      ctx.strokeStyle = '#8c3f2b'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(cr.x, cr.y, cr.rx, cr.ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (cr.fertile) {
        ctx.fillStyle = 'rgba(74, 124, 44, 0.35)';
        ctx.beginPath(); ctx.ellipse(cr.x, cr.y, cr.rx * 0.82, cr.ry * 0.80, 0, 0, Math.PI * 2); ctx.fill();
      }
    });

    drawEarthyYard(ctx, MARS_SITES.ship.x, MARS_SITES.ship.y + 10, 68, 42, true);
    drawEarthyYard(ctx, MARS_SITES.depot.x, MARS_SITES.depot.y + 8, 52, 32, true);
    drawNaturalTrail(ctx, MARS_SITES.depot.x, MARS_SITES.depot.y + 20, -260, -45, MARS_SITES.mBunker.x, MARS_SITES.mBunker.y + 24, 1.4, true);
    drawNaturalTrail(ctx, MARS_SITES.mBunker.x + 30, MARS_SITES.mBunker.y + 10, 180, -10, MARS_SITES.fortress.x - 65, MARS_SITES.fortress.y + 10, 2.2, true);

    // Kraatterin Naurismaa
    if (M.field.active) {
      let spr = IMG.field_plowed;
      if (M.field.stage === 3) spr = IMG.field_sprouts;
      else if (M.field.stage === 4) spr = IMG.field_turnip_ripe;
      if (isReady(spr)) ctx.drawImage(spr, MARS_SITES.mTurnipFarm.x - 96, MARS_SITES.mTurnipFarm.y - 54, 192, 108);
      drawLabelPill(ctx, MARS_SITES.mTurnipFarm.x, MARS_SITES.mTurnipFarm.y + 62, 'Kraatterin Naurismaa', '#fef08a');
    }

    ['mKitchen', 'mTurnipFarm', 'mBunker', 'starMine'].forEach(k => {
      if (KV.State.isOutlineVisible(k, 'crimson')) drawRedGhostOutline(ctx, k, 'crimson');
    });

    // Laskeutumisalustan ympyrä
    ctx.strokeStyle = 'rgba(253, 186, 116, 0.6)'; ctx.lineWidth = 2.2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.ellipse(MARS_SITES.ship.x, MARS_SITES.ship.y + 8, 60, 38, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (S.shipPlanet !== 'crimson') {
      drawLabelPill(ctx, MARS_SITES.ship.x, MARS_SITES.ship.y, '🚀 Tähtialus on nyt Kotilaaksossa', '#fed7aa');
    }

    const renderables = [];

    // Punertavat kivimuodostelmat
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

    // Rahtivarasto (puretut tukit & laudat)
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
          drawLabelPill(ctx, MARS_SITES.ship.x, MARS_SITES.ship.y + 48, '🚀 Tähtialus – Napauta (Paluu / Miehistö)', '#bae6fd');
        }
      });
    }

    // Punakiven omat rakennukset
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
            // Hohtava Tähtimalmin keräyspiste!
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

    // Örkkien Vartiopesäkkeet & Päälinnake (tai hehkuva malmisuoni valloituksen jälkeen!)
    if (!ft.conquered) {
      [
        { hp: ft.outpostNHp, max: ft.outpostNMax, pos: MARS_SITES.outpostN, lbl: 'Pohjoinen Vartiopesäke' },
        { hp: ft.outpostSHp, max: ft.outpostSMax, pos: MARS_SITES.outpostS, lbl: 'Eteläinen Vartiopesäke' }
      ].forEach(op => {
        if (op.hp <= 0) return;
        renderables.push({
          y: op.pos.y + 20,
          draw: () => {
            ctx.fillStyle = '#27272a'; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5;
            ctx.fillRect(op.pos.x - 36, op.pos.y - 34, 72, 52); ctx.strokeRect(op.pos.x - 36, op.pos.y - 34, 72, 52);
            ctx.fillStyle = '#090d16'; ctx.fillRect(op.pos.x - 30, op.pos.y - 46, 60, 6);
            ctx.fillStyle = '#ef4444'; ctx.fillRect(op.pos.x - 29, op.pos.y - 45, 58 * (op.hp / op.max), 4);
            drawLabelPill(ctx, op.pos.x, op.pos.y - 56, `⚔️ ${op.lbl}`, '#fca5a5', '#ef4444');
          }
        });
      });

      renderables.push({
        y: MARS_SITES.fortress.y + 30,
        draw: () => {
          const fp = MARS_SITES.fortress;
          const shielded = ft.outpostNHp > 0 || ft.outpostSHp > 0;
          ctx.fillStyle = '#18181b'; ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3.5;
          ctx.fillRect(fp.x - 64, fp.y - 58, 128, 92); ctx.strokeRect(fp.x - 64, fp.y - 58, 128, 92);
          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(fp.x - 72, fp.y - 72, 32, 42);
          ctx.fillRect(fp.x + 40, fp.y - 72, 32, 42);
          if (shielded) {
            ctx.strokeStyle = 'rgba(248, 113, 113, 0.55)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(fp.x, fp.y - 8, 86, 64, 0, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.fillStyle = '#090d16'; ctx.fillRect(fp.x - 52, fp.y - 84, 104, 8);
          ctx.fillStyle = '#ef4444'; ctx.fillRect(fp.x - 50, fp.y - 82, 100 * (ft.mainHp / ft.mainMax), 4.5);
          drawLabelPill(ctx, fp.x, fp.y - 96, `🏰 Örkkien Päälinnake (${Math.ceil(ft.mainHp)}/${ft.mainMax} HP)`, '#fecaca', '#ef4444');
          if (shielded) drawLabelPill(ctx, fp.x, fp.y + 48, '🛡️ Suojakenttä aktiivinen – tuhoa vartiopesäkkeet ensin!', '#fde047', '#ef4444');
        }
      });
    } else if (M.buildings.starMine.state === 'none') {
      renderables.push({
        y: MARS_SITES.fortress.y + 10,
        draw: () => {
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath(); ctx.arc(MARS_SITES.fortress.x, MARS_SITES.fortress.y, 18, 0, Math.PI * 2); ctx.fill();
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
      ctx.fillStyle = mf.type === 'clover' ? '#3f8f29' : mf.col;
      ctx.beginPath(); ctx.arc(mf.x, mf.y, 2.3, 0, Math.PI * 2); ctx.fill();
    });

    const lx = SITES.lodge.x, ly = SITES.lodge.y + 28;
    drawEarthyYard(ctx, SITES.ship.x, SITES.ship.y + 14, 72, 44);
    if (S.crimsonUnlocked) drawEarthyYard(ctx, SITES.cargoPod.x, SITES.cargoPod.y + 8, 44, 26);
    drawNaturalTrail(ctx, SITES.ship.x + 25, SITES.ship.y + 30, -470, -240, lx, ly, 2.1);
    drawEarthyYard(ctx, lx, ly - 4, 76, 46);
    drawEarthyYard(ctx, SITES.logPile.x, SITES.logPile.y + 14, 46, 28);
    drawEarthyYard(ctx, SITES.kitchen.x, SITES.kitchen.y + 24, 58, 35);
    drawNaturalTrail(ctx, lx, ly, -255, -160, SITES.logPile.x, SITES.logPile.y + 16, 1.1);
    drawNaturalTrail(ctx, lx, ly, -250, 120, SITES.kitchen.x, SITES.kitchen.y + 30, 2.4);

    // Joki
    const traceRiver = (pad) => {
      ctx.beginPath();
      for (let y = -2600; y <= 2600; y += 32) ctx.lineTo(getRiverCenter(y) - getRiverHalfWidth(y) - pad, y);
      for (let y = 2600; y >= -2600; y -= 32) ctx.lineTo(getRiverCenter(y) + getRiverHalfWidth(y) + pad, y);
      ctx.closePath();
    };
    ctx.fillStyle = '#4c9c2a'; traceRiver(14); ctx.fill();
    ctx.fillStyle = '#bca06b'; traceRiver(7);  ctx.fill();
    ctx.fillStyle = '#16a6eb'; traceRiver(0);  ctx.fill();
    ctx.fillStyle = '#0369a1'; traceRiver(-28); ctx.fill();

    const br = S.buildings.bridge;
    if (br.state === 'built' && isReady(IMG.bridge)) {
      ctx.drawImage(IMG.bridge, BRIDGE_X - 132, BRIDGE_Y - 64, 264, 126);
    } else if (br.state === 'building' || br.state === 'ruined') {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(BRIDGE_X - 90, BRIDGE_Y - 14, 180 * Math.max(0.2, br.prog), 28);
      drawLabelPill(ctx, BRIDGE_X, BRIDGE_Y - 36, `${br.state === 'ruined' ? '🔥 Korjaus:' : '🔨'} Kaarisilta ${Math.round(br.prog * 100)}% (👷${br.builders || 0}/1)`, '#fde047');
    }

    // Pellot
    const drawVField = (site, f, lbl, isOat, small) => {
      if (!f.active) return;
      const w = small ? 132 : 204, h = small ? 76 : 116;
      let spr = f.stage === 3 ? IMG.field_sprouts : (f.stage === 4 ? (isOat ? IMG.field_oat_ripe : IMG.field_turnip_ripe) : IMG.field_plowed);
      if (isReady(spr)) ctx.drawImage(spr, site.x - w / 2, site.y - h / 2, w, h);
      drawLabelPill(ctx, site.x, site.y + h / 2 + 8, lbl, '#fef08a');
    };
    drawVField(SITES.starterGarden, S.fields.starterTurnip, 'Kotitarha', false, true);
    drawVField(SITES.turnipFarm, S.fields.turnip, 'Suuri Naurispelto', false, false);
    drawVField(SITES.oatFarm, S.fields.oat, 'Suuri Kaurapelto', true, false);

    ['lodge', 'sawmill', 'turnipFarm', 'barracks', 'bridge', 'mill', 'bakery', 'oatFarm'].forEach(k => {
      if (KV.State.isOutlineVisible(k, 'valley')) drawRedGhostOutline(ctx, k, 'valley');
    });

    ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)'; ctx.lineWidth = 2.2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.ellipse(SITES.ship.x, SITES.ship.y + 8, 60, 38, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (S.shipPlanet !== 'valley') drawLabelPill(ctx, SITES.ship.x, SITES.ship.y, '🚀 Tähtialus on Punakivi-planeetalla', '#bae6fd');

    const renderables = [];

    world.trees.forEach(t => {
      if (Math.abs(t.x - cam.x) > 1300 || Math.abs(t.y - cam.y) > 1000) return;
      renderables.push({
        y: t.y + 10,
        draw: () => {
          if (t.regrow > 0) { if (isReady(IMG.stump)) ctx.drawImage(IMG.stump, t.x - 19, t.y - 13, 38, 32); }
          else {
            const spr = t.kind === 'birch' ? IMG.birch_tree : IMG.pine_tree;
            if (isReady(spr)) ctx.drawImage(spr, t.x - 41 * t.scale, t.y - 92 * t.scale, 82 * t.scale, 108 * t.scale);
          }
        }
      });
    });

    world.supplyCrates.forEach(cr => {
      renderables.push({
        y: cr.y + 8,
        draw: () => { if (isReady(IMG.supply_crate)) ctx.drawImage(IMG.supply_crate, cr.x - 24, cr.y - 28, 48, 45); }
      });
    });

    renderables.push({
      y: SITES.logPile.y + 18,
      draw: () => {
        drawDynamicLogStack(ctx, SITES.logPile.x, SITES.logPile.y, S.piles.logsAtForest);
        drawLabelPill(ctx, SITES.logPile.x, SITES.logPile.y + 30, `🌲 Tukkipino: ${S.piles.logsAtForest}/30`, '#fef08a');
      }
    });

    // Tähtialus + Rahtikontti Kotilaaksossa
    if (S.shipPlanet === 'valley') {
      renderables.push({
        y: SITES.ship.y + 20,
        draw: () => {
          const flyOffset = world.flightAnim ? Math.pow(1 - world.flightAnim.timer / world.flightAnim.dur, 2) * 380 : 0;
          if (flyOffset > 4) drawCargoPodBox(ctx, SITES.ship.x, SITES.ship.y + 18 - flyOffset, 0.82, true);
          if (isReady(IMG.starship)) ctx.drawImage(IMG.starship, SITES.ship.x - 68, SITES.ship.y - 44 - flyOffset, 136, 92);
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
            drawLabelPill(ctx, pos.x, pos.y - 80, `🏡 Iso Kylätalo (Väki: ${KV.State.getLivingPopulation()}/${KV.State.getMaxSustainablePop()})`, '#fef08a');
            drawLabelPill(ctx, pos.x, pos.y + 60, b.growing ? `👶 Kasvaa: ${Math.round(b.spawnProg * 100)}%` : '👆 Napauta kasvattaaksesi kyläläisen', '#bbf7d0');
          } else if (key === 'kitchen') {
            if (isReady(IMG.kitchen)) ctx.drawImage(IMG.kitchen, pos.x - 70, pos.y - 64, 140, 124);
            drawLabelPill(ctx, pos.x, pos.y - 66, `🍲 Kyläkeittiö (Pata: ${Math.ceil(S.stew)})`, '#f3e8ff');
          } else if (key === 'sawmill') {
            if (isReady(IMG.sawmill)) ctx.drawImage(IMG.sawmill, pos.x - 74, pos.y - 64, 148, 126);
            drawDynamicBoardStack(ctx, pos.x + 48, pos.y + 24, b.outBoards);
            drawLabelPill(ctx, pos.x, pos.y - 66, `🪚 Lautatarha (🪵${b.outBoards}/24)`, '#fde047');
          } else if (key === 'barracks') {
            if (isReady(IMG.barracks)) ctx.drawImage(IMG.barracks, pos.x - 70, pos.y - 74, 140, 146);
            drawLabelPill(ctx, pos.x, pos.y - 76, `🥋 Varuskunta (${S.soldierCount} kaartilaista)`, '#bae6fd');
            drawLabelPill(ctx, pos.x, pos.y + 60, b.trainQueued ? `🪖 Koulutus ${Math.round(b.trainProg * 100)}%` : '👆 Napauta kouluttaaksesi kaartilaisen', '#bae6fd');
          } else if (key === 'mill') {
            if (isReady(IMG.watermill)) ctx.drawImage(IMG.watermill, pos.x - 66, pos.y - 72, 132, 144);
            drawLabelPill(ctx, pos.x, pos.y - 74, `⚙️ Vesimylly (Jauho:${b.outFlour})`, '#ffffff');
          } else if (key === 'bakery') {
            if (isReady(IMG.bakery)) ctx.drawImage(IMG.bakery, pos.x - 68, pos.y - 66, 136, 132);
            drawLabelPill(ctx, pos.x, pos.y - 68, `🥖 Leipomo (🥖${b.outBreads || 0})`, '#fed7aa');
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
            ctx.fillStyle = '#090d16'; ctx.fillRect(hero.x - 16, hero.y - 62, 32, 4.5);
            ctx.fillStyle = '#fb923c'; ctx.fillRect(hero.x - 15, hero.y - 61, 30 * Math.max(0, hero.hp / hero.maxHp), 2.5);
          }
        }
      });
    }

    if (br.state === 'built') renderables.push({ y: BRIDGE_Y + 24, draw: () => drawBridgeFrontArch(ctx) });

    renderables.sort((a, b) => a.y - b.y);
    renderables.forEach(r => r.draw());

    world.steamPuffs.forEach(p => {
      ctx.fillStyle = p.fire ? `rgba(251, 113, 133, ${p.a})` : (p.purple ? `rgba(233, 213, 255, ${p.a})` : `rgba(248, 250, 252, ${p.a})`);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });

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

    world.clickRipples.forEach(rp => {
      ctx.strokeStyle = `rgba(134, 239, 172, ${rp.a})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    });
    world.speech.forEach(s => drawLabelPill(ctx, s.x, s.y, s.text, s.col));

    ctx.restore();
  }

  KV.Render = { loadImages, drawCommanderPortrait, draw };
})();