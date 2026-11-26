// ============================================================================
// js/ai.js – Kahden planeetan tekoäly, nopeutettu kuljetus & savupiiput (v8.4)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const {
    SITES, MARS_SITES, BUILDING_KEYS, MARS_BUILDING_KEYS, CARGO_LIMITS,
    getWorkPoint, getRiverCenter, getRiverHalfWidth, BRIDGE_X, BRIDGE_Y, SPEEDS, WORLD_BOUNDS
  } = KV.CFG;

  const BRIDGE_DECK_Y = BRIDGE_Y - 1;
  const BRIDGE_SPAN_HALF = 132;
  const BRIDGE_APPROACH_OFFSET = 140;

  function getWorkSpot(key, slot = 0, planet = 'valley') {
    if (planet === 'crimson') {
      const ms = MARS_SITES[key];
      return { x: ms.x + ((slot % 2) * 18 - 9), y: ms.y + (ms.ry || 34) + 16 };
    }
    const s = SITES[key];
    if (key === 'bridge')  return { x: BRIDGE_X - 116, y: BRIDGE_DECK_Y };
    if (key === 'lodge')   return { x: s.x,      y: s.y + 60 };
    if (key === 'mill')    return { x: s.x - 8,  y: s.y + 54 };
    if (key === 'bakery')  return { x: s.x + 12, y: s.y + 54 };
    if (key === 'sawmill') return { x: s.x + (slot === 0 ? -18 : 18), y: s.y + 53 };
    if (key === 'kitchen') return { x: s.x - 12 + (slot * 22), y: s.y + 51 };
    const wp = getWorkPoint(key, 'valley');
    return { x: wp.x, y: wp.y };
  }

  function getLoadSpot(key, planet = 'valley') {
    if (planet === 'crimson') {
      const ms = MARS_SITES[key];
      return { x: ms.x, y: ms.y + (ms.ry || 28) + 18 };
    }
    const s = SITES[key];
    if (key === 'bridge')   return { x: BRIDGE_X - 138, y: BRIDGE_Y + 20 };
    if (key === 'cargoPod') return { x: s.x,      y: s.y + 42 };
    if (key === 'lodge')    return { x: s.x + 18, y: s.y + 66 };
    if (key === 'mill')     return { x: s.x + 24, y: s.y + 64 };
    if (key === 'bakery')   return { x: s.x - 18, y: s.y + 62 };
    if (key === 'sawmill')  return { x: s.x,      y: s.y + 64 };
    if (key === 'kitchen')  return { x: s.x + 18, y: s.y + 60 };
    if (key === 'ship')     return { x: s.x,      y: s.y + 56 };
    const wp = getWorkPoint(key, 'valley');
    return { x: wp.x, y: wp.y + 6 };
  }

  function setFacingFromAngle(ent, ang) {
    ent.ang = ang;
    const cx = Math.cos(ang), sy = Math.sin(ang);
    if (cx < -0.14) ent.faceLeft = true;
    else if (cx > 0.14) ent.faceLeft = false;
    if (sy < -0.22) ent.faceBack = true;
    else if (sy > 0.16) ent.faceBack = false;
  }

  function getSolidObstacles(planet = 'valley') {
    const obs = [];
    if (planet === 'crimson') {
      if (KV.S.shipPlanet === 'crimson') {
        obs.push({ id: 'mship', x: MARS_SITES.ship.x, y: MARS_SITES.ship.y, rx: MARS_SITES.ship.rx, ry: MARS_SITES.ship.ry });
      }
      obs.push({ id: 'depot', x: MARS_SITES.depot.x, y: MARS_SITES.depot.y, rx: 36, ry: 22 });
      for (const k of MARS_BUILDING_KEYS) {
        const mb = KV.S.mars.buildings[k];
        if (mb && mb.state !== 'none') {
          const ms = MARS_SITES[k];
          obs.push({ id: k, x: ms.x, y: ms.y, rx: ms.rx, ry: ms.ry });
        }
      }
      const ft = KV.S.mars.fortress;
      if (!ft.conquered) {
        obs.push({ id: 'fort', x: MARS_SITES.fortress.x, y: MARS_SITES.fortress.y, rx: 68, ry: 45 });
        if (ft.outpostNHp > 0) obs.push({ id: 'outN', x: MARS_SITES.outpostN.x, y: MARS_SITES.outpostN.y, rx: 42, ry: 28 });
        if (ft.outpostSHp > 0) obs.push({ id: 'outS', x: MARS_SITES.outpostS.x, y: MARS_SITES.outpostS.y, rx: 42, ry: 28 });
      }
      return obs;
    }

    if (KV.S.shipPlanet === 'valley') {
      obs.push({ id: 'ship', x: SITES.ship.x, y: SITES.ship.y, rx: SITES.ship.rx, ry: SITES.ship.ry });
      if (KV.S.crimsonUnlocked) {
        obs.push({ id: 'pod', x: SITES.cargoPod.x, y: SITES.cargoPod.y, rx: 34, ry: 22 });
      }
    }
    for (const key of BUILDING_KEYS) {
      const b = KV.S.buildings[key];
      if (b && b.state !== 'none') {
        const s = SITES[key];
        if (s && s.rx > 0 && s.ry > 0) obs.push({ id: key, x: s.x, y: s.y, rx: s.rx, ry: s.ry });
      }
    }
    return obs;
  }

  function steerAroundBuildings(ent, nextX, nextY, goalX, goalY, stepLen, dt, planet = 'valley') {
    const obs = getSolidObstacles(planet);
    let rxPos = nextX, ryPos = nextY, hitObstacle = false;

    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const arx = o.rx + 9, ary = o.ry + 7;
      const ux = (rxPos - o.x) / arx, uy = (ryPos - o.y) / ary;
      const normSq = ux * ux + uy * uy;

      if (normSq < 1.0) {
        hitObstacle = true;
        const norm = Math.sqrt(normSq) || 0.001;
        const enx = ux / norm, eny = uy / norm;
        const t1x = -eny * arx, t1y = enx * ary;
        const t2x = eny * arx,  t2y = -enx * ary;

        let pick1;
        if (ent.bypassId === o.id && (ent.bypassLock || 0) > 0) {
          pick1 = (ent.bypassDir > 0);
        } else {
          const toGoalX = goalX - ent.x, toGoalY = goalY - ent.y;
          pick1 = (t1x * toGoalX + t1y * toGoalY) >= (t2x * toGoalX + t2y * toGoalY);
          ent.bypassId = o.id;
          ent.bypassDir = pick1 ? 1 : -1;
        }
        ent.bypassLock = 0.75;

        const tx = pick1 ? t1x : t2x, ty = pick1 ? t1y : t2y;
        const tLen = Math.hypot(tx, ty) || 1;
        rxPos = o.x + enx * (arx + 1.2) + (tx / tLen) * stepLen * 0.95;
        ryPos = o.y + eny * (ary + 1.2) + (ty / tLen) * stepLen * 0.95;
      }
    }

    if (!hitObstacle && (ent.bypassLock || 0) > 0) {
      ent.bypassLock = Math.max(0, ent.bypassLock - dt);
      if (ent.bypassLock <= 0) ent.bypassId = null;
    }
    return { x: rxPos, y: ryPos };
  }

  function moveEntitySmart(ent, tx, ty, speed, dt, customArriveDist = null) {
    const planet = ent.planet || 'valley';
    if (!Number.isFinite(ent.x) || !Number.isFinite(ent.y)) {
      ent.x = planet === 'crimson' ? MARS_SITES.depot.x : SITES.lodge.x;
      ent.y = planet === 'crimson' ? MARS_SITES.depot.y + 48 : SITES.lodge.y + 72;
    }

    let goalX = tx, goalY = ty, activeBridgeLaneY = null;

    if (planet === 'valley') {
      const wpWestX = BRIDGE_X - BRIDGE_APPROACH_OFFSET, wpEastX = BRIDGE_X + BRIDGE_APPROACH_OFFSET;
      const spanWestX = BRIDGE_X - BRIDGE_SPAN_HALF, spanEastX = BRIDGE_X + BRIDGE_SPAN_HALF;
      const bridgeBuilt = KV.S.buildings.bridge.state === 'built';
      const entOnWest = ent.x < getRiverCenter(ent.y);
      const tgtOnWest = tx < getRiverCenter(ty);
      const eastLane = BRIDGE_DECK_Y - 3, westLane = BRIDGE_DECK_Y + 3;
      const onDeck = bridgeBuilt && ent.x > spanWestX && ent.x < spanEastX && Math.abs(ent.y - BRIDGE_DECK_Y) < 22;

      if (entOnWest !== tgtOnWest || onDeck) {
        if (!bridgeBuilt) {
          goalX = entOnWest ? (BRIDGE_X - 116) : wpEastX;
          goalY = BRIDGE_DECK_Y;
          if (Math.hypot(ent.x - goalX, ent.y - goalY) < 12) { ent.moving = false; return false; }
        } else if (!tgtOnWest) {
          if (ent.x <= spanWestX && Math.abs(ent.y - eastLane) > 9) { goalX = wpWestX; goalY = eastLane; }
          else if (ent.x < spanEastX) { goalX = wpEastX; goalY = eastLane; activeBridgeLaneY = eastLane; }
        } else {
          if (ent.x >= spanEastX && Math.abs(ent.y - westLane) > 9) { goalX = wpEastX; goalY = westLane; }
          else if (ent.x > spanWestX) { goalX = wpWestX; goalY = westLane; activeBridgeLaneY = westLane; }
        }
      }
    }

    const isFinal = (goalX === tx && goalY === ty);
    const arriveDist = isFinal ? (customArriveDist || 15) : 10.0;
    const dx = goalX - ent.x, dy = goalY - ent.y, d = Math.hypot(dx, dy);

    if (d <= arriveDist) {
      if (!isFinal) { ent.x = goalX; ent.y = goalY; return false; }
      ent.moving = false;
      return true;
    }

    const stepDist = Math.min(d, speed * dt);
    let rawX = ent.x + (dx / d) * stepDist;
    let rawY = ent.y + (dy / d) * stepDist;

    if (activeBridgeLaneY !== null) {
      rawY = Math.max(BRIDGE_DECK_Y - 4, Math.min(BRIDGE_DECK_Y + 4, ent.y + (activeBridgeLaneY - ent.y) * Math.min(1, dt * 14)));
    }

    const crossingBridge = planet === 'valley' && (activeBridgeLaneY !== null || (KV.S.buildings.bridge.state === 'built' && Math.abs(rawY - BRIDGE_DECK_Y) < 22 && Math.abs(rawX - BRIDGE_X) < BRIDGE_SPAN_HALF + 10));
    const steered = crossingBridge ? { x: rawX, y: rawY } : steerAroundBuildings(ent, rawX, rawY, goalX, goalY, stepDist, dt, planet);

    const adx = steered.x - ent.x, ady = steered.y - ent.y;
    ent.x = steered.x; ent.y = steered.y;
    setFacingFromAngle(ent, Math.hypot(adx, ady) > 0.05 ? Math.atan2(ady, adx) : Math.atan2(dy, dx));
    ent.step = (ent.step || 0) + dt * (speed * 0.15);
    ent.moving = true;
    return false;
  }

  function separateGroup(list, dt, planet) {
    const bridgeBuilt = KV.S.buildings.bridge.state === 'built';
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        let dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
        if (dist >= 16) continue;
        if (planet === 'valley' && bridgeBuilt && Math.abs(a.x - BRIDGE_X) < 165 && Math.abs(a.y - BRIDGE_DECK_Y) < 26) continue;
        if (dist < 0.01) { dx = 1; dy = 0.5; dist = 1.12; }
        const overlap = (16 - dist) * Math.min(1, dt * 8) * 0.35;
        const px = (dx / dist) * overlap, py = (dy / dist) * overlap;
        if (!a.working && (planet !== 'valley' || Math.abs((a.x - px) - getRiverCenter(a.y - py)) > getRiverHalfWidth(a.y - py) + 6)) { a.x -= px; a.y -= py; }
        if (!b.working && (planet !== 'valley' || Math.abs((b.x + px) - getRiverCenter(b.y + py)) > getRiverHalfWidth(b.y + py) + 6)) { b.x += px; b.y += py; }
      }
    }
  }

  function countIncoming(destKey, itemType, workerArr) {
    let sum = 0;
    for (let i = 0; i < workerArr.length; i++) {
      const c = workerArr[i].carry;
      if (c && c.destKey === destKey && c.item === itemType) sum += c.qty;
    }
    return sum;
  }

  function pickNearestTreeToVillage(worker) {
    const { S, world } = KV;
    const bridgeBuilt = S.buildings.bridge.state === 'built';
    const avail = world.trees.filter(t => !t.decorative && t.regrow <= 0 && (t.x <= getRiverCenter(t.y) || bridgeBuilt));
    if (!avail.length) return null;
    const refX = (SITES.logPile.x + SITES.lodge.x) * 0.5, refY = (SITES.logPile.y + SITES.lodge.y) * 0.5;
    avail.sort((a, b) => Math.hypot(a.x - refX, a.y - refY) - Math.hypot(b.x - refX, b.y - refY));
    return avail[(worker.slot + Math.floor(Math.random() * Math.min(5, avail.length))) % Math.min(5, avail.length)];
  }

  // Rakentajat ja kantajat kantavat nyt jopa 2 tarviketta kerralla!
  function findValleyMaterial(key, maxPack = 2) {
    const S = KV.S, b = S.buildings[key];
    if (!b || (b.state !== 'building' && b.state !== 'ruined')) return null;
    if ((key === 'mill' || key === 'bakery') && S.buildings.bridge.state !== 'built') return null;
    const wp = getLoadSpot(key, 'valley');

    const needB = b.boardsNeed - b.boardsIn - countIncoming(key, 'board', KV.world.workers);
    if (needB > 0 && S.buildings.sawmill.outBoards > 0) {
      const qty = Math.min(maxPack, needB, S.buildings.sawmill.outBoards);
      S.buildings.sawmill.outBoards -= qty;
      return { item: 'board', qty, pickup: getLoadSpot('sawmill'), destKey: key, dest: wp, picked: false };
    }
    const needL = b.logsNeed - b.logsIn - countIncoming(key, 'log', KV.world.workers);
    if (needL > 0 && S.piles.logsAtForest > 0) {
      const qty = Math.min(maxPack, needL, S.piles.logsAtForest);
      S.piles.logsAtForest -= qty;
      return { item: 'log', qty, pickup: SITES.logPile, destKey: key, dest: wp, picked: false };
    }
    return null;
  }

  function findValleyCarrierJob(maxPack = 2, onlyFood = false) {
    const S = KV.S, W = KV.world.workers, saw = S.buildings.sawmill;
    if (S.piles.turnipsAtField > 0 && S.stew < 75) {
      const qty = Math.min(maxPack, S.piles.turnipsAtField);
      S.piles.turnipsAtField -= qty;
      return { item: 'turnip', qty, pickup: SITES.turnipBox, destKey: 'kitchen', dest: getLoadSpot('kitchen'), picked: false };
    }
    if (onlyFood) return null;

    // 1. Työmaat ja korjaukset ensin (2 tarviketta per reissu)
    for (const key of BUILDING_KEYS) {
      if (key === 'bridge' && (countIncoming('bridge', 'log', W) + countIncoming('bridge', 'board', W)) >= 3) continue;
      const mj = findValleyMaterial(key, 2);
      if (mj) return mj;
    }

    // 2. Rahtikontin täyttö (madallettu pataraja 18 annokseen ja 2 tavaraa/reissu!)
    if (S.crimsonUnlocked && S.shipPlanet === 'valley' && S.cargo.fillActive) {
      const podSpot = getLoadSpot('cargoPod', 'valley');
      const incLogs = countIncoming('cargoPod', 'log', W);
      if (S.cargo.logs + incLogs < CARGO_LIMITS.MAX_LOGS && S.piles.logsAtForest > 2) {
        const qty = Math.min(maxPack, CARGO_LIMITS.MAX_LOGS - (S.cargo.logs + incLogs), S.piles.logsAtForest - 2);
        S.piles.logsAtForest -= qty;
        return { item: 'log', qty, pickup: SITES.logPile, destKey: 'cargoPod', dest: podSpot, picked: false };
      }
      const incBoards = countIncoming('cargoPod', 'board', W);
      if (S.cargo.boards + incBoards < CARGO_LIMITS.MAX_BOARDS && saw.outBoards > 2) {
        const qty = Math.min(maxPack, CARGO_LIMITS.MAX_BOARDS - (S.cargo.boards + incBoards), saw.outBoards - 2);
        saw.outBoards -= qty;
        return { item: 'board', qty, pickup: getLoadSpot('sawmill'), destKey: 'cargoPod', dest: podSpot, picked: false };
      }
      const incStew = countIncoming('cargoPod', 'turnip', W) * 5;
      if (S.cargo.stew + incStew < CARGO_LIMITS.MAX_STEW && S.stew >= 18) {
        S.stew -= 5;
        return { item: 'turnip', qty: 1, pickup: getLoadSpot('kitchen'), destKey: 'cargoPod', dest: podSpot, picked: false };
      }
    }

    // 3. Leipä-, jauho-, kaura- ja sahaketjut
    const brOk = S.buildings.bridge.state === 'built', bak = S.buildings.bakery, mil = S.buildings.mill;
    if (brOk && bak.state === 'built' && bak.outBreads > 0) {
      const qty = Math.min(5, bak.outBreads); bak.outBreads -= qty;
      return { item: 'bread', qty, pickup: getLoadSpot('bakery'), destKey: 'lodge', dest: getLoadSpot('lodge'), picked: false };
    }
    if (brOk && bak.state === 'built' && mil.outFlour > 0 && (bak.rawFlour + countIncoming('bakery', 'flour', W)) < 5) {
      const qty = Math.min(maxPack, mil.outFlour); mil.outFlour -= qty;
      return { item: 'flour', qty, pickup: getLoadSpot('mill'), destKey: 'bakery', dest: getLoadSpot('bakery'), picked: false };
    }
    if (brOk && mil.state === 'built' && S.piles.oatsAtField > 0 && (mil.rawOats + countIncoming('mill', 'oat', W)) < 6) {
      const qty = Math.min(maxPack, S.piles.oatsAtField); S.piles.oatsAtField -= qty;
      return { item: 'oat', qty, pickup: SITES.oatPile, destKey: 'mill', dest: getLoadSpot('mill'), picked: false };
    }
    if (saw.state === 'built' && S.piles.logsAtForest > 0 && (saw.rawLogs + countIncoming('sawmill', 'log', W)) < 6 && saw.outBoards < 24) {
      const qty = Math.min(maxPack, S.piles.logsAtForest); S.piles.logsAtForest -= qty;
      return { item: 'log', qty, pickup: SITES.logPile, destKey: 'sawmill', dest: getLoadSpot('sawmill'), picked: false };
    }
    return null;
  }

  function deliverValleyItem(carry) {
    const S = KV.S;
    if (carry.destKey === 'cargoPod') {
      if (carry.item === 'log') S.cargo.logs = Math.min(CARGO_LIMITS.MAX_LOGS, S.cargo.logs + carry.qty);
      else if (carry.item === 'board') S.cargo.boards = Math.min(CARGO_LIMITS.MAX_BOARDS, S.cargo.boards + carry.qty);
      else if (carry.item === 'turnip') S.cargo.stew = Math.min(CARGO_LIMITS.MAX_STEW, S.cargo.stew + carry.qty * 5);
      KV.State.addSpeech(SITES.cargoPod.x, SITES.cargoPod.y - 36, '📦 Lastattu konttiin!', '#fde047', 'valley');
      return;
    }
    if (carry.destKey === 'lodge' && carry.item === 'bread') {
      S.breads += carry.qty;
      KV.State.addSpeech(SITES.lodge.x, SITES.lodge.y - 62, `🥖 +${carry.qty} leipää!`, '#fde047', 'valley');
      while (S.breads >= 5) {
        S.breads -= 5; S.coins += 1; S.totalCoinsEarned = (S.totalCoinsEarned || 0) + 1;
        KV.Audio.playSfx('coin', 0.50);
        KV.State.showToast('🥖 Leipäkori tuotu Kylätalolle ➔ +1 Space Coin (🪙)!');
      }
      return;
    }
    const b = S.buildings[carry.destKey];
    if (!b) return;
    if (b.state === 'building' || b.state === 'ruined') {
      if (carry.item === 'log') b.logsIn += carry.qty;
      if (carry.item === 'board') b.boardsIn += carry.qty;
    } else if (carry.destKey === 'kitchen' && carry.item === 'turnip') {
      S.stew = Math.min(95, S.stew + carry.qty * 6);
      KV.State.addSpeech(SITES.kitchen.x, SITES.kitchen.y - 50, `🍲 +${carry.qty * 6} Pataa!`, '#e9d5ff', 'valley');
    } else if (carry.destKey === 'sawmill' && carry.item === 'log') b.rawLogs += carry.qty;
    else if (carry.destKey === 'mill' && carry.item === 'oat') b.rawOats += carry.qty;
    else if (carry.destKey === 'bakery' && carry.item === 'flour') b.rawFlour += carry.qty;
  }

  function updateCommander(dt) {
    const { hero, keys, world, S } = KV;
    hero.working = false;
    if (!S.commanderChosen || world.flightAnim) return;

    const p = S.shipPlanet;
    hero.planet = p;
    const cmdSpec = KV.State.getCommanderSpec();
    const shipPos = p === 'crimson' ? MARS_SITES.ship : SITES.ship;

    if (S.heroMedbayTimer > 0) {
      S.heroMedbayTimer = Math.max(0, S.heroMedbayTimer - dt);
      hero.x = shipPos.x - 66; hero.y = shipPos.y + 42; hero.moving = false;
      hero.hp = Math.max(5, Math.min(hero.maxHp, ((55 - S.heroMedbayTimer) / 55) * hero.maxHp));
      if (S.heroMedbayTimer <= 0) {
        hero.hp = hero.maxHp;
        KV.Audio.playSfx('build_done', 0.55);
        KV.State.showToast(`🎖️ ${cmdSpec.name} toipui täyteen kuntoon!`);
      }
      return;
    }

    let ix = 0, iy = 0;
    if (S.viewPlanet === p) {
      if (keys['w'] || keys['arrowup']) iy -= 1;
      if (keys['s'] || keys['arrowdown']) iy += 1;
      if (keys['a'] || keys['arrowleft']) ix -= 1;
      if (keys['d'] || keys['arrowright']) ix += 1;
    }

    const canStand = (nx, ny) => {
      if (p === 'valley') {
        const inRiv = Math.abs(nx - getRiverCenter(ny)) < (getRiverHalfWidth(ny) - 2);
        const onBr = S.buildings.bridge.state === 'built' && Math.abs(ny - BRIDGE_DECK_Y) < 12;
        if (inRiv && !onBr) return false;
      }
      return !getSolidObstacles(p).some(o => Math.pow((nx - o.x) / (o.rx + 6), 2) + Math.pow((ny - o.y) / (o.ry + 5), 2) < 1.0);
    };

    if (ix !== 0 || iy !== 0) {
      hero.target = null; hero.targetTree = null;
      const len = Math.hypot(ix, iy); ix /= len; iy /= len;
      const nx = Math.max(WORLD_BOUNDS.minX + 20, Math.min(WORLD_BOUNDS.maxX - 20, hero.x + ix * SPEEDS.COMMANDER_SPEED * dt));
      const ny = Math.max(WORLD_BOUNDS.minY + 20, Math.min(WORLD_BOUNDS.maxY - 20, hero.y + iy * SPEEDS.COMMANDER_SPEED * dt));
      if (canStand(nx, ny)) { hero.x = nx; hero.y = ny; }
      else if (canStand(hero.x, ny)) hero.y = ny;
      else if (canStand(nx, hero.y)) hero.x = nx;
      setFacingFromAngle(hero, Math.atan2(iy, ix));
      hero.step += dt * 8.5; hero.moving = true;
    } else if (hero.target) {
      if (moveEntitySmart(hero, hero.target.x, hero.target.y, SPEEDS.COMMANDER_SPEED, dt, 10)) {
        hero.target = null; hero.moving = false;
      } else if (!hero.moving && p === 'valley' && S.buildings.bridge.state !== 'built') {
        KV.State.addSpeech(hero.x, hero.y - 44, 'Kaarisilta puuttuu vielä! 🌉', '#fde047', 'valley');
        hero.target = null;
      }
    } else hero.moving = false;

    if (p === 'valley') {
      for (let i = world.supplyCrates.length - 1; i >= 0; i--) {
        const cr = world.supplyCrates[i];
        if (Math.hypot(hero.x - cr.x, hero.y - cr.y) < 48) {
          S.cratesOpened[cr.id] = true;
          if (cr.reward === 'boards') S.buildings.sawmill.outBoards = Math.min(24, S.buildings.sawmill.outBoards + cr.qty);
          else if (cr.reward === 'stew') S.stew = Math.min(95, S.stew + cr.qty);
          else if (cr.reward === 'coins') S.coins += cr.qty;
          world.supplyCrates.splice(i, 1);
          KV.Audio.playSfx('coin', 0.55);
          KV.State.showToast(cr.msg);
        }
      }
    }

    const orcList = p === 'crimson' ? world.marsOrcs : world.orcs;
    const bulletList = p === 'crimson' ? world.marsBullets : world.bullets;

    hero.fireCd -= dt;
    let tgt = null, minD = 310;
    orcList.forEach(o => { const d = Math.hypot(o.x - hero.x, o.y - hero.y); if (d < minD) { minD = d; tgt = { x: o.x, y: o.y }; } });

    if (!tgt && p === 'crimson' && !S.mars.fortress.conquered) {
      const ft = S.mars.fortress;
      const cand = [];
      if (ft.outpostNHp > 0) cand.push(MARS_SITES.outpostN);
      if (ft.outpostSHp > 0) cand.push(MARS_SITES.outpostS);
      cand.push(MARS_SITES.fortress);
      cand.forEach(st => {
        const d = Math.hypot(st.x - hero.x, st.y - hero.y);
        if (d < 295 && d < minD) { minD = d; tgt = { x: st.x, y: st.y }; }
      });
    }

    if (tgt) {
      if (hero.fireCd <= 0) {
        hero.fireCd = cmdSpec.fireCd;
        const a = Math.atan2(tgt.y - hero.y, tgt.x - hero.x);
        setFacingFromAngle(hero, a);
        if (S.viewPlanet === p) KV.Audio.playSfx('laser', 0.32);
        bulletList.push({ x: hero.x, y: hero.y - 14, vx: Math.cos(a) * 475, vy: Math.sin(a) * 475, dmg: cmdSpec.dmg, friendly: true, life: 0.88 });
      }
      return;
    }

    // Kersantti auttaa myös lähellä olevalla työmaalla molemmilla planeetoilla!
    if (!hero.moving) {
      const keysToCheck = p === 'crimson' ? MARS_BUILDING_KEYS : BUILDING_KEYS;
      const siteTable = p === 'crimson' ? MARS_SITES : SITES;
      const bTable = p === 'crimson' ? S.mars.buildings : S.buildings;
      for (const key of keysToCheck) {
        const b = bTable[key];
        if (b && (b.state === 'building' || b.state === 'ruined')) {
          const s = siteTable[key];
          if (Math.hypot(hero.x - s.x, hero.y - s.y) < (key === 'bridge' ? 128 : 98)) {
            const allIn = (b.logsIn >= b.logsNeed && b.boardsIn >= b.boardsNeed);
            const maxAllowed = allIn ? 1.0 : Math.min(0.88, 0.14 + ((b.logsIn + b.boardsIn) / Math.max(1, b.logsNeed + b.boardsNeed)) * 0.74);
            if (b.prog < maxAllowed) {
              setFacingFromAngle(hero, Math.atan2(s.y - hero.y, s.x - hero.x));
              hero.working = true; hero.toolPhase += dt * 8.5;
              b.prog = Math.min(maxAllowed, b.prog + dt * (1 / 24));
              if (allIn && b.prog >= 1) {
                b.prog = 1; b.state = 'built'; b.hp = b.maxHp; b.builders = 0;
                if (p === 'crimson') {
                  if (key === 'mKitchen' && S.mars.jobs.cooks === 0) S.mars.jobs.cooks = 1;
                  if (key === 'starMine' && S.mars.jobs.miners === 0) S.mars.jobs.miners = 1;
                  KV.State.reassignMarsRoles();
                } else {
                  KV.State.clearReservedZones(false);
                  KV.State.reassignWorkerRoles();
                  KV.State.checkUnlocks();
                }
                KV.Audio.playSfx('build_done', 0.55);
                KV.State.showToast(`🎉 ${s.label} valmistui!`);
              }
              break;
            }
          }
        }
      }
    }

    if (hero.hp < hero.maxHp && orcList.length === 0) hero.hp = Math.min(hero.maxHp, hero.hp + dt * 3.5);
  }

  function updateCrimsonPlanet(dt) {
    const { S, world, hero } = KV;
    const M = S.mars;
    if (!M.visited) return;

    M.stew = Math.max(0, M.stew - KV.State.getMarsStewBurnPerSec() * dt);
    const hungry = M.stew <= 0.02;
    const cmdHere = S.commanderChosen && S.shipPlanet === 'crimson' && S.heroMedbayTimer <= 0;
    const cmdSpec = KV.State.getCommanderSpec();

    if (M.field.active && M.field.stage === 3) {
      M.field.prog += dt * (1 / 20);
      if (M.field.prog >= 1) { M.field.prog = 0; M.field.stage = 4; }
    }

    world.marsWorkers.forEach(w => {
      w.working = false;
      const boost = (cmdHere && Math.hypot(w.x - hero.x, w.y - hero.y) < 145) ? cmdSpec.auraBoost : 1.0;
      const spd = (hungry && w.role !== 'mCook' && w.role !== 'mFarmer' ? 0.72 : 1.0) * boost;

      const findMarsMat = (bKey, maxPack = 2) => {
        const mb = M.buildings[bKey];
        if (!mb || (mb.state !== 'building' && mb.state !== 'ruined')) return null;
        const dest = getLoadSpot(bKey, 'crimson');
        const needB = mb.boardsNeed - mb.boardsIn - countIncoming(bKey, 'board', world.marsWorkers);
        if (needB > 0 && M.boards > 0) {
          const qty = Math.min(maxPack, needB, M.boards);
          M.boards -= qty;
          return { item: 'board', qty, pickup: getLoadSpot('depot', 'crimson'), destKey: bKey, dest, picked: false };
        }
        const needL = mb.logsNeed - mb.logsIn - countIncoming(bKey, 'log', world.marsWorkers);
        if (needL > 0 && M.logs > 0) {
          const qty = Math.min(maxPack, needL, M.logs);
          M.logs -= qty;
          return { item: 'log', qty, pickup: getLoadSpot('depot', 'crimson'), destKey: bKey, dest, picked: false };
        }
        return null;
      };

      if (w.role === 'mBuilder' && w.siteKey) {
        const mb = M.buildings[w.siteKey];
        if (!mb || (mb.state !== 'building' && mb.state !== 'ruined')) { KV.State.reassignMarsRoles(); return; }
        const wp = getWorkSpot(w.siteKey, 0, 'crimson');
        if (w.carry) {
          if (!w.carry.picked) {
            if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * spd, dt, 18)) w.carry.picked = true;
          } else if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_CARRY * spd, dt, 18)) {
            if (w.carry.item === 'log') mb.logsIn += w.carry.qty;
            if (w.carry.item === 'board') mb.boardsIn += w.carry.qty;
            w.carry = null;
          }
        } else {
          const mj = findMarsMat(w.siteKey, 2);
          if (mj) w.carry = mj;
          else if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_WALK * spd, dt, 14)) {
            const allIn = (mb.logsIn >= mb.logsNeed && mb.boardsIn >= mb.boardsNeed);
            const maxP = allIn ? 1.0 : Math.min(0.86, 0.15 + ((mb.logsIn + mb.boardsIn) / Math.max(1, mb.logsNeed + mb.boardsNeed)) * 0.70);
            if (mb.prog < maxP) {
              w.working = true; w.toolPhase += dt * 8;
              mb.prog = Math.min(maxP, mb.prog + dt * (1 / 16) * spd);
              if (allIn && mb.prog >= 1) {
                mb.prog = 1; mb.state = 'built'; mb.hp = mb.maxHp; mb.builders = 0;
                if (w.siteKey === 'mKitchen' && M.jobs.cooks === 0) M.jobs.cooks = 1;
                if (w.siteKey === 'starMine' && M.jobs.miners === 0) M.jobs.miners = 1;
                KV.State.reassignMarsRoles();
                KV.Audio.playSfx('build_done', 0.55);
                KV.State.showToast(`🎉 ${MARS_SITES[w.siteKey].label} valmistui Punakivellä!`);
              }
            } else if (Math.random() < 0.006) {
              KV.State.addSpeech(w.x, w.y - 34, 'Tuo hirsiä/lautoja Kotilaaksosta! 📦', '#fde047', 'crimson');
            }
          }
        }
      } else if (w.role === 'mFarmer') {
        const f = M.field;
        if (w.carry) {
          if (moveEntitySmart(w, MARS_SITES.mTurnipBox.x, MARS_SITES.mTurnipBox.y + 12, SPEEDS.HUMAN_CARRY * spd, dt, 18)) {
            M.turnips += w.carry.qty; w.carry = null;
          }
        } else if (f.active) {
          const fx = MARS_SITES.mTurnipFarm.x + Math.sin(w.step * 0.15 + w.slot) * 32;
          const fy = MARS_SITES.mTurnipFarm.y + Math.cos(w.step * 0.14 + w.slot) * 16;
          if (moveEntitySmart(w, fx, fy, SPEEDS.HUMAN_WALK * spd, dt, 14)) {
            if (f.stage === 1 || f.stage === 2 || f.stage === 4) {
              w.working = true; w.toolPhase += dt * 6;
              f.prog += dt * (1 / 8.0) * spd;
              if (f.prog >= 1) {
                f.prog = 0;
                if (f.stage === 4) { f.stage = 2; w.carry = { item: 'turnip', qty: 3, picked: true }; }
                else f.stage = (f.stage === 1 ? 2 : 3);
              }
            }
          }
        }
      } else if (w.role === 'mCook') {
        const kp = getWorkSpot('mKitchen', 0, 'crimson');
        if (w.cookTimer > 0) {
          if (moveEntitySmart(w, kp.x, kp.y, SPEEDS.HUMAN_WALK * spd, dt, 12)) {
            w.working = true; w.toolPhase += dt * 6; w.cookTimer -= dt * spd;
            if (w.cookTimer <= 0) {
              M.stew = Math.min(110, M.stew + 15);
              KV.State.addSpeech(MARS_SITES.mKitchen.x, MARS_SITES.mKitchen.y - 48, '🍲 +15 Kenttäpataa!', '#e9d5ff', 'crimson');
            }
          }
        } else if (w.carry) {
          if (!w.carry.picked) {
            if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * spd, dt, 18)) w.carry.picked = true;
          } else if (moveEntitySmart(w, kp.x, kp.y, SPEEDS.HUMAN_CARRY * spd, dt, 16)) {
            w.carry = null; w.cookTimer = 3.5;
          }
        } else if (M.turnips > 0 && M.stew < 95) {
          M.turnips--;
          w.carry = { item: 'turnip', qty: 1, pickup: MARS_SITES.mTurnipBox, dest: kp, picked: false };
        } else if (moveEntitySmart(w, kp.x, kp.y, SPEEDS.HUMAN_WALK * spd, dt, 14)) {
          w.working = true; w.toolPhase += dt * 4;
          if (M.stew < 20) M.stew += dt * 0.65;
        }
      } else if (w.role === 'mMiner') {
        const sm = M.buildings.starMine;
        const mp = getWorkSpot('starMine', w.slot, 'crimson');
        if (sm.state !== 'built') return;
        if (w.carry) {
          if (moveEntitySmart(w, MARS_SITES.depot.x, MARS_SITES.depot.y + 32, SPEEDS.HUMAN_CARRY * spd, dt, 18)) {
            S.starOre += w.carry.qty;
            w.carry = null;
            KV.Audio.playSfx('coin', 0.45);
            KV.State.addSpeech(MARS_SITES.depot.x, MARS_SITES.depot.y - 36, '💎 +1 Tähtimalmi!', '#67e8f9', 'crimson');
          }
        } else if (moveEntitySmart(w, mp.x, mp.y, SPEEDS.HUMAN_WALK * spd, dt, 14)) {
          w.working = true; w.toolPhase += dt * 7;
          sm.workProg = (sm.workProg || 0) + dt * (1 / 11) * spd;
          if (sm.workProg >= 1) {
            sm.workProg = 0;
            w.carry = { item: 'ore', qty: 1, picked: true };
          }
        }
      } else {
        if (w.carry) {
          if (!w.carry.picked) {
            if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * spd, dt, 18)) w.carry.picked = true;
          } else if (moveEntitySmart(w, w.carry.dest.x, w.carry.dest.y, SPEEDS.HUMAN_CARRY * spd, dt, 18)) {
            if (w.carry.destKey === 'mKitchen') M.stew = Math.min(110, M.stew + w.carry.qty * 12);
            else {
              const mb = M.buildings[w.carry.destKey];
              if (mb) { if (w.carry.item === 'log') mb.logsIn += w.carry.qty; if (w.carry.item === 'board') mb.boardsIn += w.carry.qty; }
            }
            w.carry = null;
          }
        } else {
          let job = null;
          if (M.buildings.mKitchen.state === 'built' && M.turnips > 0 && M.stew < 85) {
            M.turnips--;
            job = { item: 'turnip', qty: 1, pickup: MARS_SITES.mTurnipBox, destKey: 'mKitchen', dest: getLoadSpot('mKitchen', 'crimson'), picked: false };
          }
          if (!job) {
            for (const bk of MARS_BUILDING_KEYS) { job = findMarsMat(bk, 2); if (job) break; }
          }
          if (job) w.carry = job;
          else moveEntitySmart(w, MARS_SITES.depot.x - 24 + (w.slot % 3) * 20, MARS_SITES.depot.y + 44, SPEEDS.HUMAN_WALK * 0.8, dt, 16);
        }
      }
    });

    const ft = M.fortress;
    world.marsSoldiers.forEach((s, idx) => {
      let tgt = null, minD = 330;
      world.marsOrcs.forEach(o => { const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < minD) { minD = d; tgt = { x: o.x, y: o.y }; } });
      if (!tgt && !ft.conquered) {
        const structs = [];
        if (ft.outpostNHp > 0) structs.push(MARS_SITES.outpostN);
        if (ft.outpostSHp > 0) structs.push(MARS_SITES.outpostS);
        structs.push(MARS_SITES.fortress);
        structs.forEach(st => { const d = Math.hypot(st.x - s.x, st.y - s.y); if (d < 290 && d < minD) { minD = d; tgt = { x: st.x, y: st.y }; } });
      }

      const nearCmd = Boolean(cmdHere && Math.hypot(s.x - hero.x, s.y - hero.y) < 155);
      if (tgt) {
        moveEntitySmart(s, tgt.x - 78, tgt.y + ((idx % 3) - 1) * 20, SPEEDS.HUMAN_WALK * 1.4, dt, 16);
        s.fireCd -= dt * (nearCmd ? 1.3 : 1.0);
        if (s.fireCd <= 0) {
          s.fireCd = 0.52;
          const a = Math.atan2(tgt.y - s.y, tgt.x - s.x);
          setFacingFromAngle(s, a);
          if (S.viewPlanet === 'crimson') KV.Audio.playSfx('laser', 0.25);
          world.marsBullets.push({ x: s.x, y: s.y - 12, vx: Math.cos(a) * 445, vy: Math.sin(a) * 445, dmg: 22, friendly: true, life: 0.85 });
        }
      } else {
        if (s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + dt * 2.5);
        const defX = s.guardPost ? s.guardPost.x : (M.buildings.mBunker.state === 'built' ? MARS_SITES.mBunker.x + 65 : MARS_SITES.depot.x + 80);
        const defY = s.guardPost ? s.guardPost.y : (-30 + idx * 24);
        moveEntitySmart(s, defX, defY, SPEEDS.HUMAN_WALK * 1.15, dt, 14);
      }
    });

    if (!ft.conquered) {
      const regen = (ft.outpostNHp > 0 || ft.outpostSHp > 0) ? 14 : 4.5;
      if (ft.mainHp < ft.mainMax) ft.mainHp = Math.min(ft.mainMax, ft.mainHp + regen * dt);

      const fireTurret = (turretSite, cdKey, dmg, range) => {
        world[cdKey] = (world[cdKey] || 0) - dt;
        if (world[cdKey] > 0) return;
        let uTgt = null, bestD = range;
        if (cmdHere) { const d = Math.hypot(hero.x - turretSite.x, hero.y - turretSite.y); if (d < bestD) { bestD = d; uTgt = hero; } }
        world.marsSoldiers.forEach(s => { const d = Math.hypot(s.x - turretSite.x, s.y - turretSite.y); if (d < bestD) { bestD = d; uTgt = s; } });
        if (uTgt) {
          world[cdKey] = 1.25;
          const a = Math.atan2(uTgt.y - turretSite.y, uTgt.x - turretSite.x);
          world.marsBullets.push({ x: turretSite.x, y: turretSite.y - 18, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, dmg, friendly: false, life: 1.4 });
        }
      };
      if (ft.outpostNHp > 0) fireTurret(MARS_SITES.outpostN, '_cdOutN', 15, 275);
      if (ft.outpostSHp > 0) fireTurret(MARS_SITES.outpostS, '_cdOutS', 15, 275);
      fireTurret(MARS_SITES.fortress, '_cdFort', 22, 305);

      world.marsWaveTimer -= dt;
      if (world.marsWaveTimer <= 0 && (world.marsSoldiers.length > 0 || cmdHere)) {
        world.marsWaveTimer = 95;
        const n = 2 + (ft.outpostNHp > 0 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          world.marsOrcs.push({ kind: 'orc', planet: 'crimson', x: MARS_SITES.fortress.x - 75, y: -35 + i * 36, step: i, ang: Math.PI, faceLeft: true, faceBack: false, moving: true, hp: 80, maxHp: 80, fireCd: 1.3 });
        }
        if (S.viewPlanet === 'crimson') KV.Audio.playSfx('alarm', 0.45);
        KV.State.showToast('⚔️ Punakiven linnakkeesta ryntää örkkipartio!');
      }
    }

    for (let i = world.marsOrcs.length - 1; i >= 0; i--) {
      const o = world.marsOrcs[i];
      let tx = MARS_SITES.mBunker.x, ty = MARS_SITES.mBunker.y, bKey = M.buildings.mBunker.state === 'built' ? 'mBunker' : null;
      if (!bKey && M.buildings.mKitchen.state === 'built') { tx = MARS_SITES.mKitchen.x; ty = MARS_SITES.mKitchen.y; bKey = 'mKitchen'; }
      let uTgt = null, minUD = 260;
      if (cmdHere) { const d = Math.hypot(hero.x - o.x, hero.y - o.y); if (d < minUD) { minUD = d; uTgt = hero; } }
      world.marsSoldiers.forEach(s => { const d = Math.hypot(s.x - o.x, s.y - o.y); if (d < minUD) { minUD = d; uTgt = s; } });
      if (uTgt) { tx = uTgt.x; ty = uTgt.y; bKey = null; }

      const dx = tx - o.x, dy = ty - o.y, dist = Math.hypot(dx, dy);
      if (dist > 58) { o.x += (dx / dist) * 44 * dt; o.y += (dy / dist) * 44 * dt; o.step += dt * 6; o.moving = true; setFacingFromAngle(o, Math.atan2(dy, dx)); }
      else o.moving = false;
      o.fireCd -= dt;
      if (dist < 240 && o.fireCd <= 0) {
        o.fireCd = 1.4;
        const a = Math.atan2(dy, dx);
        world.marsBullets.push({ x: o.x, y: o.y - 12, vx: Math.cos(a) * 245, vy: Math.sin(a) * 245, dmg: 14, friendly: false, bKey, life: 1.4 });
      }
    }

    for (let i = world.marsBullets.length - 1; i >= 0; i--) {
      const bl = world.marsBullets[i];
      bl.x += bl.vx * dt; bl.y += bl.vy * dt; bl.life -= dt;
      if (bl.life <= 0) { world.marsBullets.splice(i, 1); continue; }

      if (bl.friendly) {
        let hit = false;
        for (let j = world.marsOrcs.length - 1; j >= 0; j--) {
          if (Math.hypot(bl.x - world.marsOrcs[j].x, bl.y - world.marsOrcs[j].y) < 22) {
            world.marsOrcs[j].hp -= bl.dmg; hit = true;
            if (world.marsOrcs[j].hp <= 0) world.marsOrcs.splice(j, 1);
            break;
          }
        }
        if (!hit && !ft.conquered) {
          if (ft.outpostNHp > 0 && Math.hypot(bl.x - MARS_SITES.outpostN.x, bl.y - MARS_SITES.outpostN.y) < 44) {
            ft.outpostNHp = Math.max(0, ft.outpostNHp - bl.dmg); hit = true;
            if (ft.outpostNHp === 0) KV.State.showToast('💥 Pohjoinen Vartiopesäke tuhottu!');
          } else if (ft.outpostSHp > 0 && Math.hypot(bl.x - MARS_SITES.outpostS.x, bl.y - MARS_SITES.outpostS.y) < 44) {
            ft.outpostSHp = Math.max(0, ft.outpostSHp - bl.dmg); hit = true;
            if (ft.outpostSHp === 0) KV.State.showToast('💥 Eteläinen Vartiopesäke tuhottu!');
          } else if (Math.hypot(bl.x - MARS_SITES.fortress.x, bl.y - MARS_SITES.fortress.y) < 66) {
            const shieldMul = (ft.outpostNHp > 0 || ft.outpostSHp > 0) ? 0.35 : 1.0;
            ft.mainHp = Math.max(0, ft.mainHp - bl.dmg * shieldMul); hit = true;
            if (ft.mainHp <= 0) {
              ft.conquered = true;
              world.marsOrcs = [];
              KV.Audio.playSfx('build_done', 0.70);
              KV.State.showToast('🏆 ÖRKKIEN PÄÄLINNAKE VALLOITETTU! Voit nyt rakentaa kraatteriin Tähtimalmin Keräyspisteen!');
              KV.State.saveGame();
            }
          }
        }
        if (hit) world.marsBullets.splice(i, 1);
      } else {
        const bunkerOk = M.buildings.mBunker.state === 'built';
        let hit = false;
        for (let j = world.marsSoldiers.length - 1; j >= 0; j--) {
          const s = world.marsSoldiers[j];
          if (Math.hypot(bl.x - s.x, bl.y - s.y) < 17) {
            const mult = (bunkerOk && Math.hypot(s.x - MARS_SITES.mBunker.x, s.y - MARS_SITES.mBunker.y) < 160) ? 0.55 : 1.0;
            s.hp -= bl.dmg * mult; hit = true;
            if (s.hp <= 0) {
              if (world.selectedEntity === s) KV.State.selectUnit(null);
              world.marsSoldiers.splice(j, 1);
              M.soldierPosts.splice(j, 1);
              M.soldierCount = Math.max(0, M.soldierCount - 1);
              KV.State.showToast('⚠️ Kaartilainen kaatui Punakiven rintamalla!');
            }
            break;
          }
        }
        if (!hit && cmdHere && Math.hypot(bl.x - hero.x, bl.y - hero.y) < 18) {
          hero.hp -= bl.dmg; hit = true;
          if (hero.hp <= 0) {
            hero.hp = 0; S.heroMedbayTimer = 55; hero.target = null;
            if (world.selectedEntity === hero) KV.State.selectUnit(null);
            KV.Audio.playSfx('alarm', 0.55);
            KV.State.showToast(`🚨 ${cmdSpec.name} evakuoitiin Tähtialuksen hoitokapseliin (55 s)!`);
          }
        }
        if (hit) world.marsBullets.splice(i, 1);
      }
    }

    const marsUnits = [...world.marsWorkers, ...world.marsSoldiers, ...world.marsOrcs];
    if (cmdHere) marsUnits.push(hero);
    separateGroup(marsUnits, dt, 'crimson');
  }

  function update(dt) {
    const { S, world, hero } = KV;
    if (!S.started) return;

    if (world.flightAnim) {
      world.flightAnim.timer += dt;
      if (world.flightAnim.timer >= world.flightAnim.dur) world.flightAnim = null;
    }

    S.stew = Math.max(0, S.stew - KV.State.getStewBurnPerSec() * dt);
    const isHungry = S.stew <= 0.02;

    // Savupiippujen täsmälliset paikat (Kylätalon vasen savupiippu korjattu!)
    if (S.viewPlanet === 'valley' && Math.random() < 0.25) {
      BUILDING_KEYS.forEach(k => {
        const b = S.buildings[k];
        if (b.state === 'ruined') {
          world.steamPuffs.push({ x: SITES[k].x + (Math.random() - 0.5) * 34, y: SITES[k].y - 18, r: 5, a: 0.75, fire: true });
        } else if (b.state === 'built' && (k === 'lodge' || k === 'bakery' || k === 'kitchen') && Math.random() < 0.36) {
          if (k === 'kitchen' && isHungry) return;
          const sx = k === 'lodge' ? (SITES.lodge.x - 35) : (k === 'kitchen' ? (SITES.kitchen.x - 15) : (SITES.bakery.x + 22));
          const sy = k === 'lodge' ? (SITES.lodge.y - 68) : (k === 'kitchen' ? (SITES.kitchen.y - 16) : (SITES.bakery.y - 58));
          world.steamPuffs.push({ x: sx, y: sy, r: 3.5, a: 0.55, purple: k === 'kitchen' });
        }
      });
    } else if (S.viewPlanet === 'crimson' && Math.random() < 0.22) {
      if (S.mars.buildings.mKitchen.state === 'built' && S.mars.stew > 0.1) {
        world.steamPuffs.push({ x: MARS_SITES.mKitchen.x - 15, y: MARS_SITES.mKitchen.y - 16, r: 3.5, a: 0.55, purple: true });
      }
    }

    world.steamPuffs.forEach(p => { p.y -= 15 * dt; p.x += 3.5 * dt; p.r += 3.2 * dt; p.a -= 0.25 * dt; });
    world.steamPuffs = world.steamPuffs.filter(p => p.a > 0);
    world.clickRipples.forEach(rp => { rp.r += 48 * dt; rp.a -= 1.8 * dt; });
    world.clickRipples = world.clickRipples.filter(rp => rp.a > 0);

    updateCommander(dt);

    world.trees.forEach(t => { if (t.regrow > 0) t.regrow = Math.max(0, t.regrow - dt); });
    const lodge = S.buildings.lodge;
    if (lodge.state === 'built' && lodge.growing && !isHungry && world.orcs.length === 0) {
      lodge.spawnProg += dt * (1 / 30);
      if (lodge.spawnProg >= 1) {
        lodge.spawnProg = 0; lodge.growing = false; lodge.residents++; S.workerCount++;
        KV.State.syncEntitiesFromSave();
        KV.Audio.playSfx('born', 0.50);
        KV.State.showToast(`🏡 Uusi kyläläinen valmistui Kotilaaksossa! (${S.workerCount} työläistä)`);
      }
    }
    const bar = S.buildings.barracks;
    if (bar.state === 'built' && bar.trainQueued && !isHungry) {
      bar.trainProg += dt * (1 / 30);
      if (bar.trainProg >= 1) {
        bar.trainProg = 0; bar.trainQueued = false; S.soldierCount++;
        KV.State.syncEntitiesFromSave();
        KV.Audio.playSfx('born', 0.50);
        KV.State.showToast(`🛡️ Kaurakaartilainen astui riviin Kotilaaksossa! (${S.soldierCount} kaartilaista)`);
      }
    }
    if (S.fields.starterTurnip.stage === 3) {
      S.fields.starterTurnip.prog += dt * (1 / 8.5);
      if (S.fields.starterTurnip.prog >= 1) { S.fields.starterTurnip.prog = 0; S.fields.starterTurnip.stage = 4; }
    }
    ['turnip', 'oat'].forEach(fk => {
      const f = S.fields[fk];
      if (f.active && f.stage === 3) { f.prog += dt * (1 / 24); if (f.prog >= 1) { f.prog = 0; f.stage = 4; } }
    });

    const cmdInValley = S.commanderChosen && S.shipPlanet === 'valley' && S.heroMedbayTimer <= 0;
    const cmdSpec = KV.State.getCommanderSpec();

    world.workers.forEach((w, wIdx) => {
      w.working = false;
      const isSaver = w.role === 'cookGardener' || w.role === 'turnipFarmer' || w.role === 'carrier';
      if (isHungry && !isSaver) {
        moveEntitySmart(w, SITES.kitchen.x - 42 + (wIdx % 5) * 22, SITES.kitchen.y + 56, SPEEDS.HUMAN_WALK * 0.75, dt, 16);
        return;
      }
      const boost = (cmdInValley && Math.hypot(w.x - hero.x, w.y - hero.y) < 145) ? cmdSpec.auraBoost : 1.0;
      const speedMul = (isHungry ? 0.72 : 1.0) * boost;

      if (w.role === 'cookGardener') {
        const sg = S.fields.starterTurnip, kp = getWorkSpot('kitchen', w.slot);
        if (w.cookTimer > 0) {
          if (moveEntitySmart(w, kp.x, kp.y, SPEEDS.HUMAN_WALK * speedMul, dt, 12)) {
            w.working = true; w.toolPhase += dt * 6; w.cookTimer -= dt * boost;
            if (w.cookTimer <= 0) { S.stew = Math.min(95, S.stew + 14); KV.State.addSpeech(SITES.kitchen.x, SITES.kitchen.y - 50, '🍲 Tuoretta Pataa!', '#e9d5ff', 'valley'); }
          }
        } else if (w.carry) {
          if (moveEntitySmart(w, kp.x, kp.y, SPEEDS.HUMAN_CARRY * 1.15 * speedMul, dt, 14)) { w.carry = null; w.cookTimer = 3.8; }
        } else if (moveEntitySmart(w, SITES.starterGarden.x + Math.sin(w.step * 0.2 + w.slot) * 20, SITES.starterGarden.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
          if (sg.stage === 2 || sg.stage === 4) {
            w.working = true; w.toolPhase += dt * 6;
            sg.prog += dt * (1 / 4.8) * speedMul;
            if (sg.prog >= 1) { sg.prog = 0; if (sg.stage === 4) { sg.stage = 2; w.carry = { item: 'turnip', qty: 2, picked: true, fromStarter: true }; } else sg.stage = 3; }
          } else if (sg.stage !== 3) sg.stage = 2;
        }
      } else if (w.role === 'woodcutter') {
        if (w.carry) {
          if (moveEntitySmart(w, SITES.logPile.x, SITES.logPile.y + 18, SPEEDS.HUMAN_CARRY * speedMul, dt, 18)) { S.piles.logsAtForest = Math.min(30, S.piles.logsAtForest + w.carry.qty); w.carry = null; }
        } else if (S.piles.logsAtForest >= 30) {
          moveEntitySmart(w, SITES.logPile.x - 20 + (w.slot % 3) * 18, SITES.logPile.y + 26, SPEEDS.HUMAN_WALK * speedMul, dt, 16);
        } else {
          if (!w.targetTree || w.targetTree.regrow > 0 || w.targetTree.decorative) w.targetTree = pickNearestTreeToVillage(w);
          if (w.targetTree && moveEntitySmart(w, w.targetTree.x - 16, w.targetTree.y + 10, SPEEDS.HUMAN_WALK * speedMul, dt, 12)) {
            w.working = true; w.toolPhase += dt * 7; w.targetTree.cutProg += dt * (1 / 6.0) * speedMul;
            if (w.targetTree.cutProg >= 1) { w.targetTree.cutProg = 0; w.targetTree.regrow = 110; w.carry = { item: 'log', qty: 1, picked: true }; w.targetTree = null; }
          }
        }
      } else if (w.role === 'builder' && w.siteKey) {
        const b = S.buildings[w.siteKey];
        if (!b || (b.state !== 'building' && b.state !== 'ruined')) { KV.State.reassignWorkerRoles(); return; }
        const wp = getWorkSpot(w.siteKey, 0);
        if (w.carry) {
          if (!w.carry.picked) { if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * speedMul, dt, 18)) w.carry.picked = true; }
          else if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_CARRY * speedMul, dt, 18)) { deliverValleyItem(w.carry); w.carry = null; }
        } else {
          const mj = findValleyMaterial(w.siteKey, 2);
          if (mj) w.carry = mj;
          else if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
            const allIn = (b.logsIn >= b.logsNeed && b.boardsIn >= b.boardsNeed);
            const maxP = allIn ? 1.0 : Math.min(0.88, 0.14 + ((b.logsIn + b.boardsIn) / Math.max(1, b.logsNeed + b.boardsNeed)) * 0.74);
            if (b.prog < maxP) {
              w.working = true; w.toolPhase += dt * 8;
              b.prog = Math.min(maxP, b.prog + dt * (1 / 16) * speedMul);
              if (allIn && b.prog >= 1) {
                const wasRuined = (b.state === 'ruined');
                b.prog = 1; b.state = 'built'; b.hp = b.maxHp; b.builders = 0;
                KV.State.clearReservedZones(false); KV.State.reassignWorkerRoles();
                KV.Audio.playSfx('build_done', 0.55);
                KV.State.showToast(wasRuined ? `🛠️ ${SITES[w.siteKey].label} sammutettu ja korjattu!` : `🎉 ${SITES[w.siteKey].label} valmistui!`);
                KV.State.checkUnlocks();
              }
            }
          }
        }
      } else if (w.role === 'turnipFarmer' || w.role === 'oatFarmer') {
        const isOat = w.role === 'oatFarmer', f = isOat ? S.fields.oat : S.fields.turnip;
        const fSite = isOat ? SITES.oatFarm : SITES.turnipFarm, boxSite = isOat ? SITES.oatPile : SITES.turnipBox;
        if (w.carry) {
          if (moveEntitySmart(w, boxSite.x, boxSite.y + 12, SPEEDS.HUMAN_CARRY * speedMul, dt, 18)) {
            if (isOat) S.piles.oatsAtField += w.carry.qty; else S.piles.turnipsAtField += w.carry.qty;
            w.carry = null;
          }
        } else if (f.active && moveEntitySmart(w, fSite.x + Math.sin(w.step * 0.15 + w.slot) * 30, fSite.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
          if (f.stage !== 3) {
            w.working = true; w.toolPhase += dt * 6; f.prog += dt * (1 / 8.5) * speedMul;
            if (f.prog >= 1) { f.prog = 0; if (f.stage === 4) { f.stage = 2; w.carry = { item: isOat ? 'oat' : 'turnip', qty: 3, picked: true }; } else f.stage = (f.stage === 1 || f.stage === 5) ? 2 : 3; }
          }
        }
      } else if (w.role === 'sawyer') {
        const saw = S.buildings.sawmill, spot = getWorkSpot('sawmill', w.slot);
        if (saw.state !== 'built') return;
        if (w.carry) {
          if (!w.carry.picked) { if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * speedMul, dt, 18)) w.carry.picked = true; }
          else if (moveEntitySmart(w, spot.x, spot.y, SPEEDS.HUMAN_CARRY * speedMul, dt, 16)) { deliverValleyItem(w.carry); w.carry = null; }
        } else if (saw.rawLogs > 0 && saw.outBoards < 24) {
          if (moveEntitySmart(w, spot.x, spot.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
            w.working = true; w.toolPhase += dt * 8.5; saw.workProg += dt * (1 / 5.8) * speedMul;
            if (saw.workProg >= 1) { saw.workProg = 0; saw.rawLogs--; saw.outBoards = Math.min(24, saw.outBoards + 2); }
          }
        } else if (S.piles.logsAtForest > 0 && saw.outBoards < 24 && countIncoming('sawmill', 'log', world.workers) <= w.slot) {
          const qty = Math.min(2, S.piles.logsAtForest);
          S.piles.logsAtForest -= qty;
          w.carry = { item: 'log', qty, pickup: SITES.logPile, destKey: 'sawmill', dest: spot, picked: false };
        } else moveEntitySmart(w, spot.x, spot.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14);
      } else if (w.role === 'miller') {
        const mil = S.buildings.mill, wp = getWorkSpot('mill', 0);
        if (mil.state !== 'built') return;
        if (w.carry) {
          if (!w.carry.picked) { if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * speedMul, dt, 18)) w.carry.picked = true; }
          else if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_CARRY * speedMul, dt, 16)) { deliverValleyItem(w.carry); w.carry = null; }
        } else if (mil.rawOats > 0 && mil.outFlour < 12) {
          if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
            w.working = true; w.toolPhase += dt * 6; mil.workProg += dt * (1 / 8.2) * speedMul;
            if (mil.workProg >= 1) { mil.workProg = 0; mil.rawOats--; mil.outFlour++; }
          }
        } else if (mil.outFlour < 12 && S.piles.oatsAtField > 0 && countIncoming('mill', 'oat', world.workers) === 0) {
          const qty = Math.min(2, S.piles.oatsAtField); S.piles.oatsAtField -= qty;
          w.carry = { item: 'oat', qty, pickup: SITES.oatPile, destKey: 'mill', dest: wp, picked: false };
        } else moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14);
      } else if (w.role === 'baker') {
        const bak = S.buildings.bakery, mil = S.buildings.mill, wp = getWorkSpot('bakery', 0);
        if (bak.state !== 'built') return;
        if (w.carry) {
          if (!w.carry.picked) { if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * speedMul, dt, 18)) w.carry.picked = true; }
          else if (moveEntitySmart(w, w.carry.dest.x, w.carry.dest.y, SPEEDS.HUMAN_CARRY * speedMul, dt, 16)) { deliverValleyItem(w.carry); w.carry = null; }
        } else if (bak.outBreads >= 5 && S.buildings.bridge.state === 'built' && countIncoming('lodge', 'bread', world.workers) === 0 && KV.State.getFreeCarriersCount('valley') === 0) {
          const qty = Math.min(5, bak.outBreads); bak.outBreads -= qty;
          w.carry = { item: 'bread', qty, pickup: wp, destKey: 'lodge', dest: getLoadSpot('lodge'), picked: true };
        } else if (bak.rawFlour > 0 && bak.outBreads < 20) {
          if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
            w.working = true; w.toolPhase += dt * 6; bak.workProg += dt * (1 / 8.8) * speedMul;
            if (bak.workProg >= 1) { bak.workProg = 0; bak.rawFlour--; bak.outBreads += 5; S.everBakedBread = true; }
          }
        } else if (mil.state === 'built' && mil.outFlour > 0 && countIncoming('bakery', 'flour', world.workers) === 0) {
          mil.outFlour--; w.carry = { item: 'flour', qty: 1, pickup: getLoadSpot('mill'), destKey: 'bakery', dest: wp, picked: false };
        } else moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14);
      } else {
        if (w.carry) {
          if (!w.carry.picked) { if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * speedMul, dt, 18)) w.carry.picked = true; }
          else if (moveEntitySmart(w, w.carry.dest.x, w.carry.dest.y, SPEEDS.HUMAN_CARRY * speedMul, dt, 18)) { deliverValleyItem(w.carry); w.carry = null; }
        } else {
          const job = findValleyCarrierJob(2, isHungry);
          if (job) w.carry = job;
          else moveEntitySmart(w, SITES.lodge.x - 42 + (w.slot % 4) * 26, SITES.lodge.y + 76, SPEEDS.HUMAN_WALK * 0.78 * speedMul, dt, 16);
        }
      }
    });

    world.soldiers.forEach((s, idx) => {
      let targetOrc = null, minD = 350;
      world.orcs.forEach(o => { const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < minD) { minD = d; targetOrc = o; } });
      const nearCmd = Boolean(cmdInValley && Math.hypot(s.x - hero.x, s.y - hero.y) < 155);
      if (targetOrc) {
        moveEntitySmart(s, targetOrc.x - 58, targetOrc.y + ((idx % 3) - 1) * 18, SPEEDS.HUMAN_WALK * 1.48, dt, 14);
        s.fireCd -= dt * (nearCmd ? 1.30 : 1.0);
        if (s.fireCd <= 0) {
          s.fireCd = 0.54;
          const a = Math.atan2(targetOrc.y - s.y, targetOrc.x - s.x);
          setFacingFromAngle(s, a);
          if (S.viewPlanet === 'valley') KV.Audio.playSfx('laser', 0.26);
          world.bullets.push({ x: s.x, y: s.y - 12, vx: Math.cos(a) * 450, vy: Math.sin(a) * 450, dmg: 22, friendly: true, life: 0.85 });
        }
      } else {
        if (s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + dt * 2.0);
        const px = s.guardPost ? s.guardPost.x : (S.buildings.bridge.state === 'built' ? BRIDGE_X + 145 : BRIDGE_X - 125);
        const py = s.guardPost ? s.guardPost.y : (BRIDGE_DECK_Y - 26 + idx * 28);
        moveEntitySmart(s, px, py, SPEEDS.HUMAN_WALK * 1.1, dt, 14);
      }
    });

    if (S.buildings.barracks.state === 'built' && S.commanderChosen && !S.mars.fortress.conquered) {
      world.orcRaidTimer -= dt;
      if (world.orcRaidTimer <= 0) {
        const heavyRaid = S.mars.visited || S.crimsonUnlocked;
        world.orcRaidTimer = heavyRaid ? 125 : 145;
        const count = heavyRaid ? 4 : Math.min(3, 2 + Math.floor(S.soldierCount * 0.5));
        const orcHp = heavyRaid ? 90 : 65;
        const brReady = S.buildings.bridge.state === 'built';
        for (let i = 0; i < count; i++) {
          world.orcs.push({
            kind: 'orc', planet: 'valley',
            x: brReady ? (910 + Math.random() * 40) : (BRIDGE_X + 95 + Math.random() * 25),
            y: brReady ? (-120 + i * 62) : (BRIDGE_DECK_Y - 30 + i * 28),
            step: i, ang: Math.PI, faceLeft: true, faceBack: false, moving: true,
            hp: orcHp, maxHp: orcHp, fireCd: 1.35
          });
        }
        KV.Audio.playSfx('alarm', 0.52);
        KV.State.showToast(heavyRaid
          ? '🔥 SUURHYÖKKÄYS KOTILAAKSOON! Örkkien polttoryhmä yrittää tuhota myllyn, leipomon ja kylän rakennukset!'
          : '🚨 HÄLYTYS! Örkit hyökkäävät Kotilaakson itärannalta!');
      }
    }

    for (let idx = world.orcs.length - 1; idx >= 0; idx--) {
      const o = world.orcs[idx];
      let tx = null, ty = null, bKey = null;
      const raidTargets = ['bakery', 'mill', 'bridge', 'sawmill', 'barracks', 'lodge'];
      for (const rk of raidTargets) {
        if (S.buildings[rk].state === 'built') {
          if ((rk === 'sawmill' || rk === 'barracks' || rk === 'lodge') && S.buildings.bridge.state !== 'built') continue;
          tx = rk === 'bridge' ? (BRIDGE_X + 45) : SITES[rk].x;
          ty = rk === 'bridge' ? BRIDGE_DECK_Y : SITES[rk].y;
          bKey = rk;
          break;
        }
      }

      let targetUnit = null, minUD = 265;
      if (cmdInValley) { const d = Math.hypot(hero.x - o.x, hero.y - o.y); if (d < minUD) { minUD = d; targetUnit = hero; } }
      world.soldiers.forEach(s => { const d = Math.hypot(s.x - o.x, s.y - o.y); if (d < minUD) { minUD = d; targetUnit = s; } });
      if (targetUnit) { tx = targetUnit.x; ty = targetUnit.y; bKey = null; }

      if (tx === null) {
        tx = 1040; ty = o.y;
        if (o.x > 990) { world.orcs.splice(idx, 1); continue; }
      }

      moveEntitySmart(o, tx, ty, 43, dt, 58);
      o.fireCd -= dt;
      const dist = Math.hypot(tx - o.x, ty - o.y);
      if (tx < 990 && dist < 240 && o.fireCd <= 0) {
        o.fireCd = 1.4;
        const a = Math.atan2(ty - o.y, tx - o.x);
        setFacingFromAngle(o, a);
        world.bullets.push({ x: o.x, y: o.y - 12, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, dmg: S.mars.visited ? 16 : 12, friendly: false, bKey, life: 1.4 });
      }
    }

    for (let i = world.bullets.length - 1; i >= 0; i--) {
      const bl = world.bullets[i];
      bl.x += bl.vx * dt; bl.y += bl.vy * dt; bl.life -= dt;
      if (bl.life <= 0) { world.bullets.splice(i, 1); continue; }

      if (bl.friendly) {
        for (let j = world.orcs.length - 1; j >= 0; j--) {
          if (Math.hypot(bl.x - world.orcs[j].x, bl.y - world.orcs[j].y) < 22) {
            world.orcs[j].hp -= bl.dmg; world.bullets.splice(i, 1);
            if (world.orcs[j].hp <= 0) world.orcs.splice(j, 1);
            break;
          }
        }
      } else {
        let hit = false;
        for (let j = world.soldiers.length - 1; j >= 0; j--) {
          if (Math.hypot(bl.x - world.soldiers[j].x, bl.y - world.soldiers[j].y) < 17) {
            world.soldiers[j].hp -= bl.dmg; hit = true;
            if (world.soldiers[j].hp <= 0) {
              if (world.selectedEntity === world.soldiers[j]) KV.State.selectUnit(null);
              world.soldiers.splice(j, 1); S.soldierPosts.splice(j, 1); S.soldierCount = Math.max(0, S.soldierCount - 1);
              KV.State.showToast('⚠️ Kotilaakson kaartilainen kaatui puolustuksessa!');
            }
            break;
          }
        }
        if (!hit && cmdInValley && Math.hypot(bl.x - hero.x, bl.y - hero.y) < 18) {
          hero.hp -= bl.dmg; hit = true;
          if (hero.hp <= 0) {
            hero.hp = 0; S.heroMedbayTimer = 55; hero.target = null;
            if (world.selectedEntity === hero) KV.State.selectUnit(null);
            KV.Audio.playSfx('alarm', 0.55);
            KV.State.showToast(`🚨 ${cmdSpec.name} evakuoitiin hoitokapseliin!`);
          }
        }
        if (!hit && bl.bKey && S.buildings[bl.bKey] && S.buildings[bl.bKey].state === 'built') {
          const site = SITES[bl.bKey];
          if (Math.hypot(bl.x - site.x, bl.y - site.y) < 62) {
            const b = S.buildings[bl.bKey];
            b.hp -= bl.dmg; hit = true;
            if (b.hp <= 0) {
              b.state = 'ruined'; b.prog = 0; b.builders = 0;
              b.logsIn = Math.floor(b.logsNeed / 2);
              b.boardsIn = Math.floor(b.boardsNeed / 2);
              KV.Audio.playSfx('alarm', 0.55);
              KV.State.showToast(`🔥 Örkit sytyttivät kohteen ${site.label} tuleen! Napauta rauniota määrätäksesi korjaajan!`);
            }
          }
        }
        if (hit) world.bullets.splice(i, 1);
      }
    }

    const valleyUnits = [...world.workers, ...world.soldiers, ...world.orcs];
    if (cmdInValley) valleyUnits.push(hero);
    separateGroup(valleyUnits, dt, 'valley');

    updateCrimsonPlanet(dt);

    world.speech.forEach(s => { s.y -= dt * 11; s.life -= dt; });
    world.speech = world.speech.filter(s => s.life > 0);

    KV.State.checkUnlocks();
    try { KV.Audio.updateSpatialAudio(); } catch (e) {}
    if (KV.UI) KV.UI.updateHUD();
  }

  KV.AI = { moveEntitySmart, countIncoming, update };
})();