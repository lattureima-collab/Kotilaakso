// ============================================================================
// js/ai.js – Tärinätön rakennuskierto, ruokamenekki, työläiset & Kersantit (v8.2)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { SITES, BUILDING_KEYS, getWorkPoint, getRiverCenter, getRiverHalfWidth, BRIDGE_X, BRIDGE_Y, SPEEDS, WORLD_BOUNDS } = KV.CFG;

  const BRIDGE_DECK_Y = BRIDGE_Y - 1;
  const BRIDGE_SPAN_HALF = 132;
  const BRIDGE_APPROACH_OFFSET = 140;

  function getWorkSpot(key, slot = 0) {
    const s = SITES[key];
    if (key === 'bridge')  return { x: BRIDGE_X - 116, y: BRIDGE_DECK_Y };
    if (key === 'lodge')   return { x: s.x,      y: s.y + 60 };
    if (key === 'mill')    return { x: s.x - 8,  y: s.y + 54 };
    if (key === 'bakery')  return { x: s.x + 12, y: s.y + 54 };
    if (key === 'sawmill') return { x: s.x + (slot === 0 ? -18 : 18), y: s.y + 53 };
    if (key === 'kitchen') return { x: s.x - 12 + (slot * 22), y: s.y + 51 };
    const wp = getWorkPoint(key);
    return { x: wp.x, y: wp.y };
  }

  function getLoadSpot(key) {
    const s = SITES[key];
    if (key === 'bridge')  return { x: BRIDGE_X - 138, y: BRIDGE_Y + 20 };
    if (key === 'lodge')   return { x: s.x + 18, y: s.y + 66 };
    if (key === 'mill')    return { x: s.x + 24, y: s.y + 64 };
    if (key === 'bakery')  return { x: s.x - 18, y: s.y + 62 };
    if (key === 'sawmill') return { x: s.x,      y: s.y + 64 };
    if (key === 'kitchen') return { x: s.x + 18, y: s.y + 60 };
    if (key === 'ship')    return { x: s.x,      y: s.y + 56 };
    const wp = getWorkPoint(key);
    return { x: wp.x, y: wp.y + 6 };
  }

  function setFacingFromAngle(ent, ang) {
    ent.ang = ang;
    const cx = Math.cos(ang);
    const sy = Math.sin(ang);
    if (cx < -0.14) ent.faceLeft = true;
    else if (cx > 0.14) ent.faceLeft = false;

    if (sy < -0.22) ent.faceBack = true;
    else if (sy > 0.16) ent.faceBack = false;
  }

  function getSolidObstacles() {
    const obs = [{ id: 'ship', x: SITES.ship.x, y: SITES.ship.y, rx: SITES.ship.rx, ry: SITES.ship.ry }];
    for (const key of BUILDING_KEYS) {
      const b = KV.S.buildings[key];
      if (b && b.state !== 'none') {
        const s = SITES[key];
        if (s && s.rx > 0 && s.ry > 0) {
          obs.push({ id: key, x: s.x, y: s.y, rx: s.rx, ry: s.ry });
        }
      }
    }
    return obs;
  }

  // Lukittu kiertosuunta (bypassDir + bypassLock) estää tärinän rakennuksen takana!
  function steerAroundBuildings(ent, nextX, nextY, goalX, goalY, stepLen, dt) {
    const obs = getSolidObstacles();
    let rxPos = nextX;
    let ryPos = nextY;
    let hitObstacle = false;

    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const arx = o.rx + 9;
      const ary = o.ry + 7;
      const ux = (rxPos - o.x) / arx;
      const uy = (ryPos - o.y) / ary;
      const normSq = ux * ux + uy * uy;

      if (normSq < 1.0) {
        hitObstacle = true;
        const norm = Math.sqrt(normSq) || 0.001;
        const enx = ux / norm;
        const eny = uy / norm;

        const t1x = -eny * arx, t1y =  enx * ary;
        const t2x =  eny * arx, t2y = -enx * ary;

        let pick1;
        if (ent.bypassId === o.id && (ent.bypassLock || 0) > 0) {
          pick1 = (ent.bypassDir > 0);
        } else {
          const toGoalX = goalX - ent.x;
          const toGoalY = goalY - ent.y;
          pick1 = (t1x * toGoalX + t1y * toGoalY) >= (t2x * toGoalX + t2y * toGoalY);
          ent.bypassId = o.id;
          ent.bypassDir = pick1 ? 1 : -1;
        }
        ent.bypassLock = 0.75;

        const tx = pick1 ? t1x : t2x;
        const ty = pick1 ? t1y : t2y;
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

  function rescueIfOutOfBounds(ent) {
    if (
      !Number.isFinite(ent.x) || !Number.isFinite(ent.y) ||
      ent.x < WORLD_BOUNDS.minX - 100 || ent.x > WORLD_BOUNDS.maxX + 100 ||
      ent.y < WORLD_BOUNDS.minY - 100 || ent.y > WORLD_BOUNDS.maxY + 100
    ) {
      ent.x = SITES.lodge.x;
      ent.y = SITES.lodge.y + 72;
    }
  }

  function moveEntitySmart(ent, tx, ty, speed, dt, customArriveDist = null) {
    rescueIfOutOfBounds(ent);

    const wpWestX = BRIDGE_X - BRIDGE_APPROACH_OFFSET;
    const wpEastX = BRIDGE_X + BRIDGE_APPROACH_OFFSET;
    const spanWestX = BRIDGE_X - BRIDGE_SPAN_HALF;
    const spanEastX = BRIDGE_X + BRIDGE_SPAN_HALF;
    const bridgeBuilt = KV.S.buildings.bridge.state === 'built';

    const curRC = getRiverCenter(ent.y);
    const tgtRC = getRiverCenter(ty);
    const entOnWestSide = ent.x < curRC;
    const tgtOnWestSide = tx < tgtRC;

    const eastboundLaneY = BRIDGE_DECK_Y - 3;
    const westboundLaneY = BRIDGE_DECK_Y + 3;

    const onBridgeDeckNow = bridgeBuilt && ent.x > spanWestX && ent.x < spanEastX && Math.abs(ent.y - BRIDGE_DECK_Y) < 22;

    let goalX = tx;
    let goalY = ty;
    let activeBridgeLaneY = null;

    if (entOnWestSide !== tgtOnWestSide || onBridgeDeckNow) {
      if (!bridgeBuilt) {
        goalX = entOnWestSide ? (BRIDGE_X - 116) : wpEastX;
        goalY = BRIDGE_DECK_Y;
        if (Math.hypot(ent.x - goalX, ent.y - goalY) < 12) {
          ent.moving = false;
          return false;
        }
      } else if (!tgtOnWestSide) {
        if (ent.x <= spanWestX && Math.abs(ent.y - eastboundLaneY) > 9) {
          goalX = wpWestX;
          goalY = eastboundLaneY;
        } else if (ent.x < spanEastX) {
          goalX = wpEastX;
          goalY = eastboundLaneY;
          activeBridgeLaneY = eastboundLaneY;
        }
      } else {
        if (ent.x >= spanEastX && Math.abs(ent.y - westboundLaneY) > 9) {
          goalX = wpEastX;
          goalY = westboundLaneY;
        } else if (ent.x > spanWestX) {
          goalX = wpWestX;
          goalY = westboundLaneY;
          activeBridgeLaneY = westboundLaneY;
        }
      }
    }

    const isFinalGoal = (goalX === tx && goalY === ty);
    const arriveDist = isFinalGoal ? (customArriveDist || 15) : 10.0;

    const dx = goalX - ent.x;
    const dy = goalY - ent.y;
    const d = Math.hypot(dx, dy);

    if (d <= arriveDist) {
      if (!isFinalGoal) {
        ent.x = goalX;
        ent.y = goalY;
        return false;
      }
      ent.moving = false;
      return true;
    }

    const stepDist = Math.min(d, speed * dt);
    let rawX = ent.x + (dx / d) * stepDist;
    let rawY = ent.y + (dy / d) * stepDist;

    if (activeBridgeLaneY !== null) {
      rawY = ent.y + (activeBridgeLaneY - ent.y) * Math.min(1, dt * 14);
      rawY = Math.max(BRIDGE_DECK_Y - 4, Math.min(BRIDGE_DECK_Y + 4, rawY));
    }

    const crossingBridge = activeBridgeLaneY !== null || (bridgeBuilt && Math.abs(rawY - BRIDGE_DECK_Y) < 22 && rawX > spanWestX - 10 && rawX < spanEastX + 10);
    const steered = crossingBridge
      ? { x: rawX, y: rawY }
      : steerAroundBuildings(ent, rawX, rawY, goalX, goalY, stepDist, dt);

    const actualDx = steered.x - ent.x;
    const actualDy = steered.y - ent.y;
    ent.x = steered.x;
    ent.y = steered.y;
    if (Math.hypot(actualDx, actualDy) > 0.05) {
      setFacingFromAngle(ent, Math.atan2(actualDy, actualDx));
    } else {
      setFacingFromAngle(ent, Math.atan2(dy, dx));
    }
    ent.step = (ent.step || 0) + dt * (speed * 0.15);
    ent.moving = true;
    return false;
  }

  function applyUnitSeparation(dt) {
    const { S, world, hero } = KV;
    const all = [...world.workers, ...world.soldiers, ...world.orcs];
    if (S.commanderChosen && S.heroMedbayTimer <= 0) all.push(hero);

    const bridgeBuilt = S.buildings.bridge.state === 'built';

    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        const minD = 16;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= minD) continue;

        const aNearBridge = bridgeBuilt && Math.abs(a.x - BRIDGE_X) < BRIDGE_APPROACH_OFFSET + 25 && Math.abs(a.y - BRIDGE_DECK_Y) < 26;
        const bNearBridge = bridgeBuilt && Math.abs(b.x - BRIDGE_X) < BRIDGE_APPROACH_OFFSET + 25 && Math.abs(b.y - BRIDGE_DECK_Y) < 26;
        if (aNearBridge || bNearBridge) continue;

        if (dist < 0.01) {
          dx = (i % 2 === 0 ? 1 : -1);
          dy = 0.5;
          dist = 1.12;
        }
        const overlap = (minD - dist) * Math.min(1, dt * 8);

        const tryMove = (u, sx, sy) => {
          if (u.working) return;
          const nx = u.x + sx;
          const ny = u.y + sy;
          const rc = getRiverCenter(ny);
          const rw = getRiverHalfWidth(ny);
          const inRiv = Math.abs(nx - rc) < rw + 6;
          if (!inRiv) {
            u.x = nx; u.y = ny;
          }
        };

        if (a.moving && b.moving && Math.cos((a.ang || 0) - (b.ang || 0)) < -0.15) {
          const stepSide = overlap * 0.55;
          tryMove(a, -Math.sin(a.ang || 0) * stepSide, Math.cos(a.ang || 0) * stepSide);
          tryMove(b, -Math.sin(b.ang || 0) * stepSide, Math.cos(b.ang || 0) * stepSide);
        } else {
          const scale = (a.moving || b.moving) ? 0.25 : 0.5;
          const px = (dx / dist) * overlap * scale;
          const py = (dy / dist) * overlap * scale;
          tryMove(a, -px, -py);
          tryMove(b,  px,  py);
        }
      }
    }

    const obs = getSolidObstacles();
    for (let i = 0; i < all.length; i++) {
      const u = all[i];
      for (let k = 0; k < obs.length; k++) {
        const o = obs[k];
        const arx = o.rx + 6, ary = o.ry + 5;
        const ux = (u.x - o.x) / arx;
        const uy = (u.y - o.y) / ary;
        const nSq = ux * ux + uy * uy;
        if (nSq < 1.0) {
          const n = Math.sqrt(nSq) || 0.001;
          u.x = o.x + (ux / n) * (arx + 1);
          u.y = o.y + (uy / n) * (ary + 1);
        }
      }
    }
  }

  function pickNearestTreeToVillage(worker) {
    const { S, world } = KV;
    const bridgeBuilt = S.buildings.bridge.state === 'built';
    const avail = world.trees.filter(t => {
      if (t.decorative || t.regrow > 0) return false;
      const onEast = t.x > getRiverCenter(t.y);
      if (onEast && !bridgeBuilt) return false;
      return true;
    });
    if (!avail.length) return null;

    const refX = (SITES.logPile.x + SITES.lodge.x) * 0.5;
    const refY = (SITES.logPile.y + SITES.lodge.y) * 0.5;
    avail.sort((a, b) => Math.hypot(a.x - refX, a.y - refY) - Math.hypot(b.x - refX, b.y - refY));
    const poolSize = Math.min(5, avail.length);
    return avail[(worker.slot + Math.floor(Math.random() * poolSize)) % poolSize];
  }

  function countIncoming(destKey, itemType) {
    let sum = 0;
    const { workers } = KV.world;
    for (let i = 0; i < workers.length; i++) {
      const c = workers[i].carry;
      if (c && c.destKey === destKey && c.item === itemType) sum += c.qty;
    }
    return sum;
  }

  function isReachableFromWest(key) {
    if (key === 'mill' || key === 'bakery') return KV.S.buildings.bridge.state === 'built';
    return true;
  }

  function anySiteNeedsBoards() {
    for (const key of BUILDING_KEYS) {
      const b = KV.S.buildings[key];
      if ((b.state === 'building' || b.state === 'ruined') && isReachableFromWest(key)) {
        if (b.boardsIn < b.boardsNeed) return true;
      }
    }
    return false;
  }

  function findMaterialForSite(key, maxPack = 1) {
    const S = KV.S;
    const b = S.buildings[key];
    if (!b || (b.state !== 'building' && b.state !== 'ruined') || !isReachableFromWest(key)) return null;
    const wp = getLoadSpot(key);

    const needBoards = b.boardsNeed - b.boardsIn - countIncoming(key, 'board');
    if (needBoards > 0 && S.buildings.sawmill.outBoards > 0) {
      const qty = Math.min(maxPack, needBoards, S.buildings.sawmill.outBoards);
      S.buildings.sawmill.outBoards -= qty;
      return { item: 'board', qty, pickup: getLoadSpot('sawmill'), destKey: key, dest: wp, picked: false };
    }

    const needLogs = b.logsNeed - b.logsIn - countIncoming(key, 'log');
    if (needLogs > 0 && S.piles.logsAtForest > 0) {
      const qty = Math.min(maxPack, needLogs, S.piles.logsAtForest);
      S.piles.logsAtForest -= qty;
      return { item: 'log', qty, pickup: SITES.logPile, destKey: key, dest: wp, picked: false };
    }

    return null;
  }

  function findCarrierJob(maxPack = 2, onlyEmergencyFood = false) {
    const S = KV.S;
    const saw = S.buildings.sawmill;

    if (S.buildings.kitchen.state === 'built' && S.piles.turnipsAtField > 0 && S.stew < 70) {
      const qty = Math.min(maxPack, S.piles.turnipsAtField);
      S.piles.turnipsAtField -= qty;
      return { item: 'turnip', qty, pickup: SITES.turnipBox, destKey: 'kitchen', dest: getLoadSpot('kitchen'), picked: false };
    }
    if (onlyEmergencyFood) return findMaterialForSite('kitchen', maxPack);

    if (
      saw.state === 'built' &&
      anySiteNeedsBoards() &&
      saw.outBoards < 4 &&
      (saw.rawLogs + countIncoming('sawmill', 'log')) < 2 &&
      S.piles.logsAtForest > 0
    ) {
      const qty = Math.min(maxPack, 2, S.piles.logsAtForest);
      S.piles.logsAtForest -= qty;
      return { item: 'log', qty, pickup: SITES.logPile, destKey: 'sawmill', dest: getLoadSpot('sawmill'), picked: false };
    }

    if (S.buildings.bridge.state === 'building' || S.buildings.bridge.state === 'ruined') {
      const bridgeInFlight = countIncoming('bridge', 'log') + countIncoming('bridge', 'board');
      if (bridgeInFlight < 2) {
        const bridgeJob = findMaterialForSite('bridge', 1);
        if (bridgeJob) return bridgeJob;
      }
    }

    for (const key of BUILDING_KEYS) {
      if (key === 'bridge') continue;
      const matJob = findMaterialForSite(key, 1);
      if (matJob) return matJob;
    }

    const bridgeReady = S.buildings.bridge.state === 'built';
    const bak = S.buildings.bakery;
    const mil = S.buildings.mill;

    // Leipäkorit Leipomosta sillan yli keskustan Isoon Kylätaloon (+1 Space Coin / 5 leipää)
    if (bridgeReady && bak.state === 'built' && bak.outBreads > 0) {
      const qty = Math.min(5, bak.outBreads);
      bak.outBreads -= qty;
      return { item: 'bread', qty, pickup: getLoadSpot('bakery'), destKey: 'lodge', dest: getLoadSpot('lodge'), picked: false };
    }

    if (bridgeReady && bak.state === 'built' && mil.outFlour > 0 && (bak.rawFlour + countIncoming('bakery', 'flour')) < 5) {
      const qty = Math.min(maxPack, mil.outFlour);
      mil.outFlour -= qty;
      return { item: 'flour', qty, pickup: getLoadSpot('mill'), destKey: 'bakery', dest: getLoadSpot('bakery'), picked: false };
    }

    if (bridgeReady && mil.state === 'built' && S.piles.oatsAtField > 0 && (mil.rawOats + countIncoming('mill', 'oat')) < 6) {
      const qty = Math.min(maxPack, S.piles.oatsAtField);
      S.piles.oatsAtField -= qty;
      return { item: 'oat', qty, pickup: SITES.oatPile, destKey: 'mill', dest: getLoadSpot('mill'), picked: false };
    }

    if (saw.state === 'built' && S.piles.logsAtForest > 0 && (saw.rawLogs + countIncoming('sawmill', 'log')) < 5 && saw.outBoards < 24) {
      const qty = Math.min(maxPack, S.piles.logsAtForest);
      S.piles.logsAtForest -= qty;
      return { item: 'log', qty, pickup: SITES.logPile, destKey: 'sawmill', dest: getLoadSpot('sawmill'), picked: false };
    }

    return null;
  }

  function deliverItem(carry) {
    const S = KV.S;
    if ((carry.destKey === 'lodge' || carry.destKey === 'ship') && carry.item === 'bread') {
      S.breads += carry.qty;
      KV.State.addSpeech(SITES.lodge.x, SITES.lodge.y - 62, `🥖 +${carry.qty} leipää Kylätalolle!`, '#fde047');
      while (S.breads >= 5) {
        S.breads -= 5;
        S.coins += 1;
        S.totalCoinsEarned = (S.totalCoinsEarned || 0) + 1;
        KV.Audio.playSfx('coin', 0.50);
        KV.State.showToast('🥖 Leipäkori tuotu sillan yli Kylätalolle ➔ +1 Space Coin (🪙)!');
      }
      return;
    }

    const b = S.buildings[carry.destKey];
    if (!b) return;

    if (b.state === 'building' || b.state === 'ruined') {
      if (carry.item === 'log') b.logsIn += carry.qty;
      if (carry.item === 'board') b.boardsIn += carry.qty;
    } else if (carry.destKey === 'kitchen' && carry.item === 'turnip') {
      const added = carry.qty * 6;
      S.stew = Math.min(95, S.stew + added);
      KV.Audio.playSfx('bubble', 0.42);
      KV.State.addSpeech(SITES.kitchen.x, SITES.kitchen.y - 50, `🍲 +${added} Naurispataa!`, '#e9d5ff');
    } else if (carry.destKey === 'sawmill' && carry.item === 'log') {
      b.rawLogs += carry.qty;
    } else if (carry.destKey === 'mill' && carry.item === 'oat') {
      b.rawOats += carry.qty;
    } else if (carry.destKey === 'bakery' && carry.item === 'flour') {
      b.rawFlour += carry.qty;
    }
  }

  function canHeroStandAt(nx, ny) {
    const rc = getRiverCenter(ny);
    const rw = getRiverHalfWidth(ny);
    const inRiver = Math.abs(nx - rc) < (rw - 2);
    const onBridge = KV.S.buildings.bridge.state === 'built' && Math.abs(ny - BRIDGE_DECK_Y) < 12;
    if (inRiver && !onBridge) return false;

    const obs = getSolidObstacles();
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const dx = (nx - o.x) / (o.rx + 6);
      const dy = (ny - o.y) / (o.ry + 5);
      if (dx * dx + dy * dy < 1.0) return false;
    }
    return true;
  }

  function updateCommander(dt) {
    const { hero, keys, world, S } = KV;
    hero.working = false;
    if (!S.commanderChosen) return;

    const cmdSpec = KV.State.getCommanderSpec();

    if (S.heroMedbayTimer > 0) {
      S.heroMedbayTimer = Math.max(0, S.heroMedbayTimer - dt);
      hero.x = SITES.ship.x;
      hero.y = SITES.ship.y + 48;
      hero.moving = false;
      hero.hp = Math.max(5, Math.min(hero.maxHp, ((60 - S.heroMedbayTimer) / 60) * hero.maxHp));
      if (S.heroMedbayTimer <= 0) {
        hero.hp = hero.maxHp;
        KV.Audio.playSfx('build_done', 0.55);
        KV.State.showToast(`🎖️ ${cmdSpec.name} toipui täyteen kuntoon ja palasi rintamalle!`);
      }
      return;
    }

    let ix = 0, iy = 0;
    if (keys['w'] || keys['arrowup']) iy -= 1;
    if (keys['s'] || keys['arrowdown']) iy += 1;
    if (keys['a'] || keys['arrowleft']) ix -= 1;
    if (keys['d'] || keys['arrowright']) ix += 1;

    if (ix !== 0 || iy !== 0) {
      hero.target = null;
      hero.targetTree = null;
      const len = Math.hypot(ix, iy);
      ix /= len; iy /= len;
      const stepX = ix * SPEEDS.COMMANDER_SPEED * dt;
      const stepY = iy * SPEEDS.COMMANDER_SPEED * dt;
      const nx = Math.max(WORLD_BOUNDS.minX + 20, Math.min(WORLD_BOUNDS.maxX - 20, hero.x + stepX));
      const ny = Math.max(WORLD_BOUNDS.minY + 20, Math.min(WORLD_BOUNDS.maxY - 20, hero.y + stepY));

      if (canHeroStandAt(nx, ny)) {
        hero.x = nx; hero.y = ny;
      } else if (canHeroStandAt(hero.x, ny)) {
        hero.y = ny;
      } else if (canHeroStandAt(nx, hero.y)) {
        hero.x = nx;
      }
      setFacingFromAngle(hero, Math.atan2(iy, ix));
      hero.step += dt * 8.5;
      hero.moving = true;
    } else if (hero.target) {
      const arrived = moveEntitySmart(hero, hero.target.x, hero.target.y, SPEEDS.COMMANDER_SPEED, dt, 10);
      if (arrived) {
        hero.target = null;
        hero.moving = false;
      } else if (!hero.moving && S.buildings.bridge.state !== 'built') {
        KV.State.addSpeech(hero.x, hero.y - 44, 'Rakennetaan Kaarisilta ensin! 🌉', '#fde047');
        hero.target = null;
      }
    } else {
      hero.moving = false;
    }

    // Metsän tarvikelaatikoiden avaaminen
    for (let i = world.supplyCrates.length - 1; i >= 0; i--) {
      const cr = world.supplyCrates[i];
      if (Math.hypot(hero.x - cr.x, hero.y - cr.y) < 48) {
        S.cratesOpened[cr.id] = true;
        if (cr.reward === 'boards') S.buildings.sawmill.outBoards += cr.qty;
        else if (cr.reward === 'stew') S.stew = Math.min(95, S.stew + cr.qty);
        else if (cr.reward === 'coins') {
          S.coins += cr.qty;
          S.totalCoinsEarned = (S.totalCoinsEarned || 0) + cr.qty;
        }
        world.supplyCrates.splice(i, 1);
        KV.Audio.playSfx('coin', 0.55);
        KV.State.addSpeech(hero.x, hero.y - 48, '📦 Tarvikelaatikko avattu!', '#7dd3fc');
        KV.State.showToast(cr.msg);
        KV.State.saveGame();
      }
    }

    if (hero.hp < hero.maxHp && world.orcs.length === 0) {
      hero.hp = Math.min(hero.maxHp, hero.hp + dt * 3.2);
    }

    // Kersantin pulssitulitus örkkejä vastaan
    hero.fireCd -= dt;
    let nearOrc = null, minOD = 310;
    world.orcs.forEach(o => {
      const d = Math.hypot(o.x - hero.x, o.y - hero.y);
      if (d < minOD) { minOD = d; nearOrc = o; }
    });
    if (nearOrc) {
      if (hero.fireCd <= 0) {
        hero.fireCd = cmdSpec.fireCd;
        const a = Math.atan2(nearOrc.y - hero.y, nearOrc.x - hero.x);
        setFacingFromAngle(hero, a);
        KV.Audio.playSfx('laser', 0.34);
        world.bullets.push({
          x: hero.x, y: hero.y - 14,
          vx: Math.cos(a) * 475, vy: Math.sin(a) * 475,
          dmg: cmdSpec.dmg, friendly: true, life: 0.88
        });
      }
      return;
    }

    // Kersantti voi myös auttaa työmaalla tai puunkaadossa seistessään kohteen vieressä
    if (!hero.moving) {
      for (const key of BUILDING_KEYS) {
        const b = S.buildings[key];
        if (b.state === 'building' || b.state === 'ruined') {
          const s = SITES[key];
          const buildReach = key === 'bridge' ? 128 : 96;
          if (Math.hypot(hero.x - s.x, hero.y - s.y) < buildReach) {
            const totalReq = Math.max(1, b.logsNeed + b.boardsNeed);
            const deliv = b.logsIn + b.boardsIn;
            const allIn = (b.logsIn >= b.logsNeed && b.boardsIn >= b.boardsNeed);
            const maxAllowed = allIn ? 1.0 : Math.min(0.88, 0.14 + (deliv / totalReq) * 0.74);
            if (b.prog < maxAllowed) {
              setFacingFromAngle(hero, Math.atan2(s.y - hero.y, s.x - hero.x));
              hero.working = true; hero.toolPhase += dt * 8.5;
              if (Math.random() < 0.03) KV.Audio.playSfx('hammer', 0.28);
              b.prog = Math.min(maxAllowed, b.prog + dt * (1 / 28));
              if (allIn && b.prog >= 1) {
                b.prog = 1; b.state = 'built'; b.hp = b.maxHp; b.builders = 0;
                KV.State.clearReservedZones(false);
                KV.State.reassignWorkerRoles();
                KV.Audio.playSfx('build_done', 0.55);
                KV.State.showToast(`🎉 ${s.label} valmistui!`);
                KV.State.checkUnlocks();
              }
              return;
            }
          }
        }
      }

      if (S.piles.logsAtForest < 30) {
        let treeToCut = (hero.targetTree && hero.targetTree.regrow <= 0 && !hero.targetTree.decorative)
          ? hero.targetTree : null;
        if (treeToCut && Math.hypot(hero.x - treeToCut.x, hero.y - treeToCut.y) > 56) treeToCut = null;
        if (treeToCut) {
          setFacingFromAngle(hero, Math.atan2(treeToCut.y - hero.y, treeToCut.x - hero.x));
          hero.working = true; hero.toolPhase += dt * 7.5;
          treeToCut.cutProg += dt * (1 / 5.5);
          if (Math.random() < 0.04) KV.Audio.playSfx('chop', 0.34);
          if (treeToCut.cutProg >= 1) {
            treeToCut.cutProg = 0; treeToCut.regrow = 110; hero.targetTree = null;
            S.piles.logsAtForest = Math.min(30, S.piles.logsAtForest + 1);
            KV.State.addSpeech(hero.x, hero.y - 44, '🌲 +1 Tukki pinoon!', '#bbf7d0');
          }
        }
      }
    }
  }

  function update(dt) {
    const { S, world, hero } = KV;
    if (!S.started) return;

    // 1. Naurispadan menekki suoraan suhteessa kaikkien hahmojen määrään!
    const stewBurn = KV.State.getStewBurnPerSec() * dt;
    S.stew = Math.max(0, S.stew - stewBurn);
    const isHungry = S.stew <= 0.02;

    if (Math.random() < 0.22) {
      ['lodge', 'bakery', 'kitchen'].forEach(k => {
        if (S.buildings[k].state === 'built' && Math.random() < 0.35) {
          if (k === 'kitchen' && isHungry) return;
          world.steamPuffs.push({
            x: SITES[k].x + (k === 'kitchen' ? -15 : 22),
            y: SITES[k].y - (k === 'kitchen' ? 16 : 58),
            r: 3.5, a: 0.55, purple: k === 'kitchen'
          });
        }
      });
    }
    world.steamPuffs.forEach(p => { p.y -= 13 * dt; p.x += 3.5 * dt; p.r += 3.2 * dt; p.a -= 0.22 * dt; });
    world.steamPuffs = world.steamPuffs.filter(p => p.a > 0);

    world.clickRipples.forEach(rp => { rp.r += 48 * dt; rp.a -= 1.8 * dt; });
    world.clickRipples = world.clickRipples.filter(rp => rp.a > 0);

    // 2. Päivitetään Komentaja (jos Varuskunta on valmis ja komentaja valittu)
    updateCommander(dt);

    // 3. Puiden takaisinkasvu & Ison Kylätalon asukkaan kasvu
    world.trees.forEach(t => { if (t.regrow > 0) t.regrow = Math.max(0, t.regrow - dt); });

    const lodge = S.buildings.lodge;
    if (lodge.state === 'built' && lodge.growing) {
      if (!isHungry && world.orcs.length === 0) {
        lodge.spawnProg += dt * (1 / 32);
        if (lodge.spawnProg >= 1) {
          lodge.spawnProg = 0;
          lodge.growing = false;
          lodge.residents = (lodge.residents || 0) + 1;
          S.workerCount++;
          KV.State.syncEntitiesFromSave();
          KV.Audio.playSfx('born', 0.52);
          KV.State.addSpeech(SITES.lodge.x, SITES.lodge.y - 68, '👷 Uusi kyläläinen valmiina työhön!', '#86efac');
          KV.State.showToast(`🏡 Uusi kyläläinen kasvoi aikuiseksi Isossa Kylätalossa! (${S.workerCount} työläistä)`);
        }
      }
    }

    // 4. Varuskunnan kaartilaisten koulutus
    const bar = S.buildings.barracks;
    if (bar.state === 'built' && bar.trainQueued) {
      if (!isHungry && world.orcs.length === 0) {
        bar.trainProg += dt * (1 / 32);
        if (bar.trainProg >= 1) {
          bar.trainProg = 0;
          bar.trainQueued = false;
          S.soldierCount++;
          KV.State.syncEntitiesFromSave();
          KV.Audio.playSfx('born', 0.50);
          KV.State.showToast(`🛡️ Kaurakaartilainen astui riviin Varuskunnasta! (${S.soldierCount} kaartilaista)`);
        }
      }
    }

    // 5. Peltojen kypsyminen & Halla
    if (S.fields.starterTurnip.stage === 3) {
      S.fields.starterTurnip.prog += dt * (1 / 8.5);
      if (S.fields.starterTurnip.prog >= 1) { S.fields.starterTurnip.prog = 0; S.fields.starterTurnip.stage = 4; }
    }
    ['turnip', 'oat'].forEach(fk => {
      const f = S.fields[fk];
      if (f.active && f.stage === 3) {
        f.prog += dt * (1 / 25);
        if (f.prog >= 1) { f.prog = 0; f.stage = 4; }
      }
    });

    if (S.everBakedBread) {
      world.frostTimer -= dt;
      if (world.frostTimer <= 0) {
        world.frostTimer = 140 + Math.random() * 60;
        world.frostActive = 12;
        let hit = false;
        ['turnip', 'oat'].forEach(fk => {
          const f = S.fields[fk];
          if (f.active && (f.stage === 3 || f.stage === 4)) { f.stage = 5; f.prog = 0; hit = true; }
        });
        if (hit) {
          KV.Audio.playSfx('frost', 0.48);
          KV.State.showToast('❄️ HALLA ISKI LAAKSOON! Isot pellot paleltuivat – viljelijät siivoavat sadon!');
        }
      }
    }
    if (world.frostActive > 0) {
      world.frostActive -= dt;
      if (world.snowParticles.length < 65) {
        world.snowParticles.push({ x: Math.random(), y: -0.05, s: 0.16 + Math.random() * 0.2 });
      }
    }
    world.snowParticles.forEach(sp => { sp.y += sp.s * dt; sp.x += Math.sin(sp.y * 10) * 0.04 * dt; });
    world.snowParticles = world.snowParticles.filter(sp => sp.y < 1.05);

    // 6. TYÖLÄISTEN TEKOÄLY (+ Kersantin johtaja-aura)
    const cmdActive = S.commanderChosen && S.heroMedbayTimer <= 0;
    const cmdSpec = KV.State.getCommanderSpec();

    world.workers.forEach((w, wIdx) => {
      w.working = false;

      const isFoodSaver =
        w.role === 'cookGardener' ||
        w.role === 'turnipFarmer' ||
        (w.role === 'builder' && w.siteKey === 'kitchen') ||
        w.role === 'carrier';

      if (isHungry && !isFoodSaver) {
        const sx = SITES.kitchen.x - 42 + (wIdx % 5) * 22;
        const sy = SITES.kitchen.y + 56 + Math.floor(wIdx / 5) * 18;
        moveEntitySmart(w, sx, sy, SPEEDS.HUMAN_WALK * 0.75, dt, 16);
        if (Math.random() < 0.005) KV.State.addSpeech(w.x, w.y - 34, 'Naurispata on tyhjä! 🍲', '#fca5a5');
        return;
      }

      const auraBoost = (cmdActive && Math.hypot(w.x - hero.x, w.y - hero.y) < 145) ? cmdSpec.auraBoost : 1.0;
      const speedMul = (isHungry ? 0.72 : 1.0) * auraBoost;

      if (w.role === 'cookGardener') {
        const sg = S.fields.starterTurnip;
        const kitPos = getWorkSpot('kitchen', w.slot);

        if (w.cookTimer > 0) {
          if (moveEntitySmart(w, kitPos.x, kitPos.y, SPEEDS.HUMAN_WALK * speedMul, dt, 12)) {
            setFacingFromAngle(w, -Math.PI * 0.5);
            w.working = true; w.toolPhase += dt * 6;
            w.cookTimer -= dt * auraBoost;
            if (w.cookTimer <= 0) {
              S.stew = Math.min(95, S.stew + 13.5);
              KV.Audio.playSfx('bubble', 0.38);
              KV.State.addSpeech(SITES.kitchen.x, SITES.kitchen.y - 50, '🍲 Tuoretta Naurispataa!', '#e9d5ff');
            }
          }
        } else if (w.carry) {
          if (moveEntitySmart(w, kitPos.x, kitPos.y, SPEEDS.HUMAN_CARRY * 1.15 * speedMul, dt, 14)) {
            w.carry = null;
            w.cookTimer = 3.8;
          }
        } else {
          const gx = SITES.starterGarden.x + Math.sin(w.step * 0.2 + w.slot) * 22;
          const gy = SITES.starterGarden.y + Math.cos(w.step * 0.18 + w.slot) * 12;
          if (moveEntitySmart(w, gx, gy, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
            if (sg.stage === 2) {
              w.working = true; w.toolPhase += dt * 6;
              if (Math.random() < 0.03) KV.Audio.playSfx('dig', 0.32);
              sg.prog += dt * (1 / 5.2) * speedMul;
              if (sg.prog >= 1) { sg.prog = 0; sg.stage = 3; }
            } else if (sg.stage === 3) {
              w.working = true; w.toolPhase += dt * 3.5;
            } else if (sg.stage === 4) {
              w.working = true; w.toolPhase += dt * 6.5;
              sg.prog += dt * (1 / 4.2) * speedMul;
              if (sg.prog >= 1) {
                sg.prog = 0; sg.stage = 2;
                w.carry = { item: 'turnip', qty: 2, picked: true, fromStarter: true };
              }
            } else {
              sg.stage = 2;
            }
          }
        }

      } else if (w.role === 'woodcutter') {
        if (w.carry) {
          if (moveEntitySmart(w, SITES.logPile.x, SITES.logPile.y + 18, SPEEDS.HUMAN_CARRY * speedMul, dt, 18)) {
            S.piles.logsAtForest = Math.min(30, S.piles.logsAtForest + w.carry.qty);
            w.carry = null;
          }
        } else if (S.piles.logsAtForest >= 30) {
          moveEntitySmart(w, SITES.logPile.x - 24 + (w.slot % 3) * 20, SITES.logPile.y + 26, SPEEDS.HUMAN_WALK * speedMul, dt, 16);
        } else {
          if (!w.targetTree || w.targetTree.regrow > 0 || w.targetTree.decorative) {
            w.targetTree = pickNearestTreeToVillage(w);
          }
          if (w.targetTree && moveEntitySmart(w, w.targetTree.x - 16, w.targetTree.y + 10, SPEEDS.HUMAN_WALK * speedMul, dt, 12)) {
            setFacingFromAngle(w, Math.atan2(w.targetTree.y - w.y, w.targetTree.x - w.x));
            w.working = true; w.toolPhase += dt * 7;
            w.targetTree.cutProg += dt * (1 / 6.5) * speedMul;
            if (Math.random() < 0.045) KV.Audio.playSfx('chop', 0.38);
            if (w.targetTree.cutProg >= 1) {
              w.targetTree.cutProg = 0; w.targetTree.regrow = 110;
              w.carry = { item: 'log', qty: 1, picked: true };
              w.targetTree = null;
            }
          }
        }

      } else if (w.role === 'builder' && w.siteKey) {
        const b = S.buildings[w.siteKey];
        if (!b || (b.state !== 'building' && b.state !== 'ruined')) {
          KV.State.reassignWorkerRoles();
          return;
        }
        const wp = getWorkSpot(w.siteKey, 0);

        if (w.carry) {
          if (!w.carry.picked) {
            if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * speedMul, dt, 18)) {
              w.carry.picked = true;
            }
          } else if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_CARRY * speedMul, dt, 18)) {
            deliverItem(w.carry); w.carry = null;
          }
        } else {
          const matJob = findMaterialForSite(w.siteKey, 1);
          if (matJob) {
            w.carry = matJob;
          } else if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
            const totalReq = Math.max(1, b.logsNeed + b.boardsNeed);
            const deliv = b.logsIn + b.boardsIn;
            const allIn = (b.logsIn >= b.logsNeed && b.boardsIn >= b.boardsNeed);
            const maxAllowedProg = allIn ? 1.0 : Math.min(0.88, 0.14 + (deliv / totalReq) * 0.74);

            if (b.prog < maxAllowedProg) {
              setFacingFromAngle(w, Math.atan2(SITES[w.siteKey].y - w.y, SITES[w.siteKey].x - w.x));
              w.working = true; w.toolPhase += dt * 8;
              if (Math.random() < 0.04) KV.Audio.playSfx('hammer', 0.35);
              b.prog = Math.min(maxAllowedProg, b.prog + dt * (1 / 20) * speedMul);
              if (allIn && b.prog >= 1) {
                b.prog = 1; b.state = 'built'; b.hp = b.maxHp;
                b.builders = 0;
                KV.State.clearReservedZones(false);
                KV.State.reassignWorkerRoles();
                KV.Audio.playSfx('build_done', 0.55);
                KV.State.showToast(`🎉 ${SITES[w.siteKey].label} valmistui! Rakentaja vapautui.`);
                KV.State.checkUnlocks();
              }
            } else if (Math.random() < 0.006) {
              const missMsg = (b.boardsIn < b.boardsNeed)
                ? 'Odotan lautoja sahalta... 🪵'
                : 'Odotan tukkeja metsästä... 🌲';
              KV.State.addSpeech(w.x, w.y - 34, missMsg, '#fde047');
            }
          }
        }

      } else if (w.role === 'turnipFarmer' || w.role === 'oatFarmer') {
        const isOat = w.role === 'oatFarmer';
        const f = isOat ? S.fields.oat : S.fields.turnip;
        const fSite = isOat ? SITES.oatFarm : SITES.turnipFarm;
        const boxSite = isOat ? SITES.oatPile : SITES.turnipBox;

        if (w.carry) {
          if (moveEntitySmart(w, boxSite.x, boxSite.y + 12, SPEEDS.HUMAN_CARRY * speedMul, dt, 18)) {
            if (isOat) S.piles.oatsAtField += w.carry.qty;
            else S.piles.turnipsAtField += w.carry.qty;
            w.carry = null;
          }
        } else if (f.active) {
          const wx = fSite.x + Math.sin(w.step * 0.15 + w.slot * 2) * 34;
          const wy = fSite.y + Math.cos(w.step * 0.12 + w.slot * 2) * 18;
          if (moveEntitySmart(w, wx, wy, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
            if (f.stage === 1) {
              w.working = true; w.toolPhase += dt * 6;
              if (Math.random() < 0.035) KV.Audio.playSfx('dig', 0.34);
              f.prog += dt * (1 / 14) * speedMul;
              if (f.prog >= 1) { f.prog = 0; f.stage = 2; }
            } else if (f.stage === 2) {
              w.working = true; w.toolPhase += dt * 6;
              f.prog += dt * (1 / 7.5) * speedMul;
              if (f.prog >= 1) { f.prog = 0; f.stage = 3; }
            } else if (f.stage === 4) {
              w.working = true; w.toolPhase += dt * 6;
              f.prog += dt * (1 / 7.5) * speedMul;
              if (f.prog >= 1) {
                f.prog = 0; f.stage = 2;
                w.carry = { item: isOat ? 'oat' : 'turnip', qty: 3, picked: true };
              }
            } else if (f.stage === 5) {
              w.working = true; w.toolPhase += dt * 6;
              if (Math.random() < 0.035) KV.Audio.playSfx('dig', 0.32);
              f.prog += dt * (1 / 11) * speedMul;
              if (f.prog >= 1) { f.prog = 0; f.stage = 2; KV.State.addSpeech(w.x, w.y - 34, 'Halla siivottu!', '#86efac'); }
            }
          }
        }

      } else if (w.role === 'sawyer') {
        const saw = S.buildings.sawmill;
        const spot = getWorkSpot('sawmill', w.slot);
        if (saw.state !== 'built') return;

        if (w.carry) {
          if (!w.carry.picked) {
            if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * speedMul, dt, 18)) w.carry.picked = true;
          } else if (moveEntitySmart(w, spot.x, spot.y, SPEEDS.HUMAN_CARRY * speedMul, dt, 16)) {
            deliverItem(w.carry); w.carry = null;
          }
        } else if (saw.outBoards >= 24) {
          if (moveEntitySmart(w, spot.x, spot.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14) && Math.random() < 0.004) {
            KV.State.addSpeech(SITES.sawmill.x, SITES.sawmill.y - 50, 'Lautapino täynnä (24)! 🪵', '#fde047');
          }
        } else if (saw.rawLogs > 0) {
          if (moveEntitySmart(w, spot.x, spot.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
            setFacingFromAngle(w, -Math.PI * 0.5);
            w.working = true; w.toolPhase += dt * 8.5;
            if (Math.random() < 0.038) KV.Audio.playSfx('saw', 0.24);
            saw.workProg += dt * (1 / 7.5) * speedMul;
            if (saw.workProg >= 1) {
              saw.workProg = 0;
              saw.rawLogs = Math.max(0, saw.rawLogs - 1);
              saw.outBoards = Math.min(24, saw.outBoards + 2);
              KV.State.addSpeech(SITES.sawmill.x, SITES.sawmill.y - 50, '+2 Lautaa! 🪵', '#fde047');
            }
          }
        } else if (S.piles.logsAtForest > 0 && countIncoming('sawmill', 'log') <= w.slot) {
          S.piles.logsAtForest -= 1;
          w.carry = { item: 'log', qty: 1, pickup: SITES.logPile, destKey: 'sawmill', dest: spot, picked: false };
        } else if (moveEntitySmart(w, spot.x, spot.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
          if (S.piles.logsAtForest === 0 && countIncoming('sawmill', 'log') === 0 && Math.random() < 0.005) {
            KV.State.addSpeech(SITES.sawmill.x, SITES.sawmill.y - 50, 'Tukkipino tyhjä – kaada puita! 🌲', '#fca5a5');
          }
        }

      } else if (w.role === 'miller') {
        const mil = S.buildings.mill;
        const wp = getWorkSpot('mill', 0);
        if (mil.state !== 'built') return;

        if (w.carry) {
          if (!w.carry.picked) {
            if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * speedMul, dt, 18)) w.carry.picked = true;
          } else if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_CARRY * speedMul, dt, 16)) {
            deliverItem(w.carry); w.carry = null;
          }
        } else if (mil.rawOats > 0 && mil.outFlour < 12) {
          if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
            setFacingFromAngle(w, -Math.PI * 0.5);
            w.working = true; w.toolPhase += dt * 6;
            mil.workProg += dt * (1 / 9.0) * speedMul;
            if (mil.workProg >= 1) {
              mil.workProg = 0; mil.rawOats--; mil.outFlour += 1;
              KV.State.addSpeech(SITES.mill.x, SITES.mill.y - 52, '+1 Jauhosäkki!', '#ffffff');
            }
          }
        } else if (mil.outFlour < 12 && S.piles.oatsAtField > 0 && countIncoming('mill', 'oat') === 0) {
          const qty = Math.min(2, S.piles.oatsAtField);
          S.piles.oatsAtField -= qty;
          w.carry = { item: 'oat', qty, pickup: SITES.oatPile, destKey: 'mill', dest: wp, picked: false };
        } else if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14) && mil.rawOats === 0 && Math.random() < 0.005) {
          KV.State.addSpeech(SITES.mill.x, SITES.mill.y - 52, 'Odotan kauraa pellolta! 🌾', '#fca5a5');
        }

      } else if (w.role === 'baker') {
        const bak = S.buildings.bakery;
        const mil = S.buildings.mill;
        const wp = getWorkSpot('bakery', 0);
        if (bak.state !== 'built') return;

        if (w.carry) {
          if (!w.carry.picked) {
            if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * speedMul, dt, 18)) w.carry.picked = true;
          } else if (moveEntitySmart(w, w.carry.dest.x, w.carry.dest.y, SPEEDS.HUMAN_CARRY * speedMul, dt, 16)) {
            deliverItem(w.carry); w.carry = null;
          }
        } else if (bak.outBreads >= 10 && S.buildings.bridge.state === 'built' && countIncoming('lodge', 'bread') === 0) {
          const qty = Math.min(5, bak.outBreads);
          bak.outBreads -= qty;
          w.carry = { item: 'bread', qty, pickup: wp, destKey: 'lodge', dest: getLoadSpot('lodge'), picked: true };
        } else if (bak.rawFlour > 0 && bak.outBreads < 20) {
          if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14)) {
            setFacingFromAngle(w, -Math.PI * 0.5);
            w.working = true; w.toolPhase += dt * 6;
            bak.workProg += dt * (1 / 9.5) * speedMul;
            if (bak.workProg >= 1) {
              bak.workProg = 0; bak.rawFlour--;
              bak.outBreads += 5;
              S.everBakedBread = true;
              KV.State.addSpeech(SITES.bakery.x, SITES.bakery.y - 52, '🥖 +5 tuoretta leipää koriin!', '#fde047');
            }
          }
        } else if (mil.state === 'built' && mil.outFlour > 0 && countIncoming('bakery', 'flour') === 0) {
          mil.outFlour -= 1;
          w.carry = { item: 'flour', qty: 1, pickup: getLoadSpot('mill'), destKey: 'bakery', dest: wp, picked: false };
        } else if (moveEntitySmart(w, wp.x, wp.y, SPEEDS.HUMAN_WALK * speedMul, dt, 14) && Math.random() < 0.005) {
          KV.State.addSpeech(SITES.bakery.x, SITES.bakery.y - 52, 'Jauhot loppu leipomosta!', '#fca5a5');
        }

      } else {
        if (w.carry) {
          if (!w.carry.picked) {
            if (moveEntitySmart(w, w.carry.pickup.x, w.carry.pickup.y, SPEEDS.HUMAN_WALK * speedMul, dt, 18)) w.carry.picked = true;
          } else if (moveEntitySmart(w, w.carry.dest.x, w.carry.dest.y, SPEEDS.HUMAN_CARRY * speedMul, dt, 18)) {
            deliverItem(w.carry); w.carry = null;
          }
        } else {
          const job = findCarrierJob(2, isHungry);
          if (job) w.carry = job;
          else moveEntitySmart(w, SITES.lodge.x - 42 + (w.slot % 4) * 26, SITES.lodge.y + 76, SPEEDS.HUMAN_WALK * 0.78 * speedMul, dt, 16);
        }
      }
    });

    // 7. KAURAKAARTILAISET
    world.soldiers.forEach((s, idx) => {
      let targetOrc = null, minD = 350;
      world.orcs.forEach(o => {
        const d = Math.hypot(o.x - s.x, o.y - s.y);
        if (d < minD) { minD = d; targetOrc = o; }
      });
      const nearCmd = Boolean(cmdActive && Math.hypot(s.x - hero.x, s.y - hero.y) < 155);

      if (targetOrc) {
        moveEntitySmart(s, targetOrc.x - 58, targetOrc.y + ((idx % 3) - 1) * 18, SPEEDS.HUMAN_WALK * 1.48, dt, 14);
        s.fireCd -= dt * (nearCmd ? 1.30 : 1.0);
        if (s.fireCd <= 0) {
          s.fireCd = 0.54;
          const a = Math.atan2(targetOrc.y - s.y, targetOrc.x - s.x);
          setFacingFromAngle(s, a);
          KV.Audio.playSfx('laser', 0.28);
          world.bullets.push({
            x: s.x, y: s.y - 12,
            vx: Math.cos(a) * 450, vy: Math.sin(a) * 450,
            dmg: 22, friendly: true, life: 0.85
          });
        }
      } else {
        if (s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + dt * 2.0);
        const postX = s.guardPost ? s.guardPost.x : (S.buildings.bridge.state === 'built' ? BRIDGE_X + 145 : BRIDGE_X - 125);
        const postY = s.guardPost ? s.guardPost.y : (BRIDGE_DECK_Y - 26 + idx * 28);
        moveEntitySmart(s, postX, postY, SPEEDS.HUMAN_WALK * 1.1, dt, 14);
      }
    });

    // 8. ÖRKKIHYÖKKÄYKSET (käynnistyvät VASTA kun Varuskunta on valmis ja Kersantti valittu!)
    if (S.buildings.barracks.state === 'built' && S.commanderChosen) {
      world.orcRaidTimer -= dt;
      if (world.orcRaidTimer <= 0) {
        world.orcRaidTimer = 145 + Math.random() * 40;
        const count = Math.min(4, 2 + Math.floor(S.soldierCount * 0.7));
        const bridgeReady = S.buildings.bridge.state === 'built';
        for (let i = 0; i < count; i++) {
          world.orcs.push({
            kind: 'orc',
            x: bridgeReady ? (920 + Math.random() * 40) : (BRIDGE_X + 95 + Math.random() * 25),
            y: bridgeReady ? (-110 + i * 64) : (BRIDGE_DECK_Y - 30 + i * 28),
            step: i, ang: Math.PI, faceLeft: true, faceBack: false,
            moving: true,
            hp: 65, maxHp: 65, fireCd: 1.4
          });
        }
        KV.Audio.playSfx('alarm', 0.48);
        KV.State.showToast(`🚨 HÄLYTYS! Örkit hyökkäävät itärannalta – ${cmdSpec.name} puolustukseen!`);
      }
    }

    for (let idx = world.orcs.length - 1; idx >= 0; idx--) {
      const o = world.orcs[idx];
      let tx = null, ty = null, bKey = null;
      if (S.buildings.bakery.state === 'built') { tx = SITES.bakery.x; ty = SITES.bakery.y; bKey = 'bakery'; }
      else if (S.buildings.mill.state === 'built') { tx = SITES.mill.x; ty = SITES.mill.y; bKey = 'mill'; }
      else if (S.buildings.bridge.state === 'built') { tx = BRIDGE_X + 65; ty = BRIDGE_DECK_Y; bKey = 'bridge'; }

      let targetUnit = null, minUD = 270;
      if (cmdActive) {
        const dh = Math.hypot(hero.x - o.x, hero.y - o.y);
        if (dh < minUD) { minUD = dh; targetUnit = hero; }
      }
      world.soldiers.forEach(s => {
        const d = Math.hypot(s.x - o.x, o.y - o.y);
        if (d < minUD) { minUD = d; targetUnit = s; }
      });
      if (targetUnit) { tx = targetUnit.x; ty = targetUnit.y; bKey = null; }

      if (tx === null) {
        tx = 1040; ty = o.y;
        if (o.x > 990) { world.orcs.splice(idx, 1); continue; }
      }

      const dx = tx - o.x, dy = ty - o.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 60) {
        const nextOx = o.x + (dx / dist) * 42 * dt;
        const rc = getRiverCenter(o.y);
        const rw = getRiverHalfWidth(o.y);
        const inRiv = Math.abs(nextOx - rc) < rw + 4 && !(S.buildings.bridge.state === 'built' && Math.abs(o.y - BRIDGE_DECK_Y) < 18);
        if (!inRiv) o.x = nextOx;
        o.y += (dy / dist) * 42 * dt;
        o.step += dt * 6;
        o.moving = true;
        setFacingFromAngle(o, Math.atan2(dy, dx));
      } else {
        o.moving = false;
      }
      o.fireCd -= dt;
      if (tx < 990 && dist < 245 && o.fireCd <= 0) {
        o.fireCd = 1.5;
        const a = Math.atan2(dy, dx);
        setFacingFromAngle(o, a);
        world.bullets.push({
          x: o.x, y: o.y - 12,
          vx: Math.cos(a) * 235, vy: Math.sin(a) * 235,
          dmg: 12, friendly: false, bKey, life: 1.4
        });
      }
    }

    // 9. AMMUKSET & HAAVOITTUMISET
    for (let i = world.bullets.length - 1; i >= 0; i--) {
      const bl = world.bullets[i];
      bl.x += bl.vx * dt; bl.y += bl.vy * dt; bl.life -= dt;
      if (bl.life <= 0) { world.bullets.splice(i, 1); continue; }

      if (bl.friendly) {
        for (let j = world.orcs.length - 1; j >= 0; j--) {
          if (Math.hypot(bl.x - world.orcs[j].x, bl.y - world.orcs[j].y) < 22) {
            world.orcs[j].hp -= bl.dmg;
            world.bullets.splice(i, 1);
            if (world.orcs[j].hp <= 0) {
              KV.Audio.playSfx('chop', 0.32);
              world.orcs.splice(j, 1);
            }
            break;
          }
        }
      } else {
        let hit = false;
        for (let j = world.soldiers.length - 1; j >= 0; j--) {
          if (Math.hypot(bl.x - world.soldiers[j].x, bl.y - world.soldiers[j].y) < 17) {
            world.soldiers[j].hp -= bl.dmg;
            hit = true;
            if (world.soldiers[j].hp <= 0) {
              if (world.selectedEntity === world.soldiers[j]) KV.State.selectUnit(null);
              world.soldiers.splice(j, 1);
              S.soldierPosts.splice(j, 1);
              S.soldierCount = Math.max(0, S.soldierCount - 1);
              KV.State.showToast('⚠️ Kaurakaartilainen vetäytyi Varuskuntaan toipumaan!');
            }
            break;
          }
        }
        if (!hit && cmdActive && Math.hypot(bl.x - hero.x, bl.y - hero.y) < 18) {
          hero.hp -= bl.dmg;
          hit = true;
          if (hero.hp <= 0) {
            hero.hp = 0;
            S.heroMedbayTimer = 60;
            hero.target = null;
            hero.targetTree = null;
            if (world.selectedEntity === hero) KV.State.selectUnit(null);
            KV.Audio.playSfx('alarm', 0.55);
            KV.State.showToast(`🚨 ${cmdSpec.name} haavoittui ja evakuoitiin Tähtialuksen hoitokapseliin (60 s)!`);
          }
        }
        if (!hit && bl.bKey && S.buildings[bl.bKey] && S.buildings[bl.bKey].state === 'built') {
          const site = SITES[bl.bKey];
          if (Math.hypot(bl.x - site.x, bl.y - site.y) < 52) {
            const b = S.buildings[bl.bKey];
            b.hp -= bl.dmg; hit = true;
            if (b.hp <= 0) {
              b.state = 'ruined'; b.prog = 0; b.builders = 0;
              b.logsIn = Math.floor(b.logsNeed / 2);
              b.boardsIn = Math.floor(b.boardsNeed / 2);
              KV.Audio.playSfx('alarm', 0.48);
              KV.State.showToast(`🔥 Örkit vaurioittivat kohdetta ${site.label}! Napauta työmaata korjataksesi sen.`);
            }
          }
        }
        if (hit) world.bullets.splice(i, 1);
      }
    }

    applyUnitSeparation(dt);

    world.speech.forEach(s => { s.y -= dt * 11; s.life -= dt; });
    world.speech = world.speech.filter(s => s.life > 0);

    KV.State.checkUnlocks();
    try { KV.Audio.updateSpatialAudio(); } catch (e) {}
    if (KV.UI) KV.UI.updateHUD();
  }

  KV.AI = {
    moveEntitySmart,
    countIncoming,
    update
  };
})();