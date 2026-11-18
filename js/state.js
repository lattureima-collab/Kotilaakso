// ============================================================================
// js/state.js – Pelitila, koko laakson metsä, tonttien raivaus ja yksiköt (v8.1)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { SITES, getRiverCenter, getRiverHalfWidth, BRIDGE_X, BRIDGE_Y } = KV.CFG;
  const SAVE_KEY = 'vegan_space_v8_1';

  function getRecommendedZoom() {
    const w = window.innerWidth || 1024;
    const h = window.innerHeight || 768;
    const shortSide = Math.min(w, h);
    if (w < 520) return 0.58;
    if (shortSide < 520) return 0.64;
    if (w < 1024) return 0.75;
    return 0.85;
  }

  const defaultState = {
    avatarIdx: 0,
    started: false,
    soundOn: true,
    musicOn: true,
    zoom: null,
    coins: 0,
    breads: 0,
    stew: 32,
    heroMedbayTimer: 0,
    unlocks: {
      house: false,
      bigTurnip: false,
      sawmill: false,
      oxPen: false,
      oatChain: false,
      barracks: false
    },
    everBakedBread: false,
    jobs: {
      cookGardeners: 1,
      woodcutters: 0,
      turnipFarmers: 0,
      sawyers: 0,
      oatFarmers: 0,
      millers: 0,
      bakers: 0
    },
    piles: { logsAtForest: 0, turnipsAtField: 0, oatsAtField: 0 },
    buildings: {
      house1:   { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 5, boardsIn: 0, boardsNeed: 0, spawnProg: 0, residents: 0, maxRes: 2, hp: 200, maxHp: 200 },
      house2:   { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 7, boardsIn: 0, boardsNeed: 4, spawnProg: 0, residents: 0, maxRes: 2, hp: 220, maxHp: 220 },
      house3:   { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 8, boardsIn: 0, boardsNeed: 6, spawnProg: 0, residents: 0, maxRes: 3, hp: 240, maxHp: 240 },
      kitchen:  { state: 'built', builders: 0, prog: 1, logsIn: 4, logsNeed: 4, boardsIn: 0, boardsNeed: 0, hp: 240, maxHp: 240 },
      sawmill:  { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 7, boardsIn: 0, boardsNeed: 0, rawLogs: 0, outBoards: 0, workProg: 0, hp: 220, maxHp: 220 },
      oxPen:    { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 4, boardsIn: 0, boardsNeed: 4, hp: 200, maxHp: 200 },
      bridge:   { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 6, boardsIn: 0, boardsNeed: 6, hp: 280, maxHp: 280 },
      mill:     { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 5, boardsIn: 0, boardsNeed: 8, rawOats: 0, outFlour: 0, workProg: 0, hp: 220, maxHp: 220 },
      bakery:   { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 6, boardsIn: 0, boardsNeed: 9, rawFlour: 0, outBreads: 0, workProg: 0, hp: 220, maxHp: 220 },
      barracks: { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 7, boardsIn: 0, boardsNeed: 10, trainQueued: false, trainType: 'soldier', trainProg: 0, hp: 300, maxHp: 300 }
    },
    fields: {
      starterTurnip: { active: true,  stage: 4, prog: 0 },
      turnip:        { active: false, stage: 0, prog: 0 },
      oat:           { active: false, stage: 0, prog: 0 }
    },
    cratesOpened: {},
    workerCount: 4,
    oxCount: 0,
    soldierCount: 0,
    hasSergeant: false,
    sergeantPost: null,
    soldierPosts: []
  };

  let loaded = null;
  try { loaded = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { loaded = null; }

  const S = (loaded && loaded.buildings && loaded.fields && loaded.buildings.bakery.outBreads !== undefined)
    ? loaded
    : JSON.parse(JSON.stringify(defaultState));

  if (!S.zoom || !Number.isFinite(S.zoom)) S.zoom = getRecommendedZoom();
  if (!S.cratesOpened) S.cratesOpened = {};
  if (!Array.isArray(S.soldierPosts)) S.soldierPosts = [];
  if (typeof S.heroMedbayTimer !== 'number') S.heroMedbayTimer = 0;

  function saveGame() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  function resetSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  }

  const hero = {
    kind: 'hero',
    x: SITES.ship.x,
    y: SITES.ship.y + 66,
    ang: Math.PI * 0.5,
    faceLeft: false,
    faceBack: false,
    step: 0,
    moving: false,
    working: false,
    toolPhase: 0,
    selected: false,
    target: null,
    targetTree: null,
    hp: 100,
    maxHp: 100,
    fireCd: 0
  };

  const world = {
    selectedEntity: null,
    trees: [],
    supplyCrates: [],
    forestProps: [],
    meadowFlora: [],
    riverBankProps: [],
    workers: [],
    oxen: [],
    soldiers: [],
    sergeant: null,
    orcs: [],
    bullets: [],
    steamPuffs: [],
    speech: [],
    snowParticles: [],
    clickRipples: [],
    frostTimer: 135,
    frostActive: 0,
    orcRaidTimer: 150
  };

  function selectUnit(unit) {
    world.selectedEntity = unit;
    hero.selected = (unit === hero);
    if (KV.UI) KV.UI.syncHeroButton();
  }

  function addSpeech(x, y, text, col = '#fefce8') {
    if (world.speech.length > 8) return;
    world.speech.push({ x, y, text, col, life: 3.1 });
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._tm);
    t._tm = setTimeout(() => { t.style.opacity = '0'; }, 4500);
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  // Tarkistaa etäisyyden myös kaarevaan polkuun, jotta mutkiin ei jää yhtäkään puuta
  function distToTrailCurve(px, py, x1, y1, cx, cy, x2, y2) {
    let minD = distToSegment(px, py, x1, y1, x2, y2);
    let prevX = x1, prevY = y1;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const mt = 1 - t;
      const curX = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
      const curY = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
      minD = Math.min(minD, distToSegment(px, py, prevX, prevY, curX, curY));
      prevX = curX;
      prevY = curY;
    }
    return minD;
  }

  function isInsideInitialClearing(x, y) {
    const sx = SITES.ship.x, sy = SITES.ship.y + 22;
    if (Math.hypot(x - SITES.ship.x, y - SITES.ship.y) < 118) return true;
    if (Math.hypot(x - SITES.kitchen.x, y - SITES.kitchen.y) < 104) return true;
    if (Math.hypot((x - SITES.starterGarden.x) / 1.25, y - SITES.starterGarden.y) < 84) return true;
    if (Math.hypot(x - SITES.logPile.x, y - SITES.logPile.y) < 76) return true;
    if (distToTrailCurve(x, y, sx, sy, -255, -160, SITES.logPile.x, SITES.logPile.y + 16) < 48) return true;
    if (distToTrailCurve(x, y, sx, sy, -245, 115, SITES.kitchen.x, SITES.kitchen.y + 30) < 48) return true;
    if (distToTrailCurve(x, y, SITES.kitchen.x - 18, SITES.kitchen.y + 30, -385, 215, SITES.starterGarden.x + 38, SITES.starterGarden.y) < 48) return true;
    return false;
  }

  function isInsideReservedZone(x, y) {
    if (isInsideInitialClearing(x, y)) return true;

    for (const [key, b] of Object.entries(S.buildings)) {
      if (b.state !== 'none') {
        const pos = SITES[key];
        const rad = key === 'bridge' ? 96 : 102;
        if (Math.hypot(x - pos.x, y - pos.y) < rad) return true;
      }
    }

    if (S.fields.turnip.active) {
      if (Math.hypot((x - SITES.turnipFarm.x) / 1.35, y - SITES.turnipFarm.y) < 102) return true;
      if (Math.hypot(x - SITES.turnipBox.x, y - SITES.turnipBox.y) < 60) return true;
      if (distToTrailCurve(x, y, SITES.kitchen.x, SITES.kitchen.y + 32, -335, 265, SITES.turnipBox.x, SITES.turnipBox.y + 6) < 48) return true;
    }

    const westBridgeMouth = BRIDGE_X - 134;
    const eastBridgeMouth = BRIDGE_X + 134;

    if (S.fields.oat.active) {
      if (Math.hypot((x - SITES.oatFarm.x) / 1.35, y - SITES.oatFarm.y) < 102) return true;
      if (Math.hypot(x - SITES.oatPile.x, y - SITES.oatPile.y) < 60) return true;
      if (distToTrailCurve(x, y, eastBridgeMouth, BRIDGE_Y + 6, 365, 115, SITES.oatPile.x, SITES.oatPile.y + 6) < 48) return true;
      if (distToTrailCurve(x, y, SITES.oatPile.x, SITES.oatPile.y + 6, 460, 235, SITES.oatFarm.x - 28, SITES.oatFarm.y - 12) < 48) return true;
    }

    const sx = SITES.ship.x, sy = SITES.ship.y + 22;
    if (S.buildings.house1.state !== 'none' && distToTrailCurve(x, y, sx, sy, -335, -55, SITES.house1.x, SITES.house1.y + 32) < 48) return true;
    if (S.buildings.house2.state !== 'none' && distToTrailCurve(x, y, SITES.house1.x, SITES.house1.y + 32, -555, -80, SITES.house2.x, SITES.house2.y + 32) < 48) return true;
    if (S.buildings.house3.state !== 'none' && distToTrailCurve(x, y, SITES.house1.x, SITES.house1.y + 32, -515, 10, SITES.house3.x, SITES.house3.y + 32) < 48) return true;
    if (S.buildings.sawmill.state !== 'none' && distToTrailCurve(x, y, SITES.logPile.x, SITES.logPile.y + 16, -175, -355, SITES.sawmill.x, SITES.sawmill.y + 32) < 48) return true;
    if (S.buildings.oxPen.state !== 'none' && distToTrailCurve(x, y, sx, sy, -120, -55, SITES.oxPen.x, SITES.oxPen.y + 30) < 48) return true;
    if (S.buildings.barracks.state !== 'none' && distToTrailCurve(x, y, sx, sy, -230, -75, SITES.barracks.x, SITES.barracks.y + 36) < 48) return true;
    if (S.buildings.bridge.state !== 'none' && distToTrailCurve(x, y, sx, sy, -40, 38, westBridgeMouth, BRIDGE_Y + 6) < 48) return true;
    if (S.buildings.bridge.state === 'built') {
      if (S.buildings.mill.state !== 'none' && distToTrailCurve(x, y, eastBridgeMouth, BRIDGE_Y + 6, eastBridgeMouth + 32, -45, SITES.mill.x + 12, SITES.mill.y + 52) < 48) return true;
      if (S.buildings.bakery.state !== 'none' && distToTrailCurve(x, y, eastBridgeMouth, BRIDGE_Y + 6, 435, 58, SITES.bakery.x, SITES.bakery.y + 32) < 48) return true;
      if (S.buildings.mill.state !== 'none' && S.buildings.bakery.state !== 'none' && distToTrailCurve(x, y, SITES.mill.x + 12, SITES.mill.y + 52, 455, -45, SITES.bakery.x, SITES.bakery.y + 32) < 48) return true;
    }

    return false;
  }

  function clearReservedZones(giveBonusLogs = false) {
    let felledBonus = 0;
    for (let i = world.trees.length - 1; i >= 0; i--) {
      const t = world.trees[i];
      if (isInsideReservedZone(t.x, t.y)) {
        if (giveBonusLogs && t.regrow <= 0 && !t.decorative && felledBonus < 2) {
          felledBonus++;
          S.piles.logsAtForest = Math.min(30, S.piles.logsAtForest + 1);
        }
        world.trees.splice(i, 1);
      }
    }
    for (let i = world.forestProps.length - 1; i >= 0; i--) {
      const fp = world.forestProps[i];
      if (isInsideReservedZone(fp.x, fp.y)) world.forestProps.splice(i, 1);
    }
  }

  function initValleyNature() {
    world.trees = [];
    world.forestProps = [];

    const crateSpecs = [
      { id: 'nw', x: -735, y: -440, reward: 'boards', qty: 4,  msg: '📦 Tarvikelaatikko avattu: +4 valmista lautaa (🪵)!' },
      { id: 'sw', x: -740, y: 310,  reward: 'stew',   qty: 15, msg: '📦 Muonalaatikko avattu: +15 annosta Naurispataa (🍲)!' },
      { id: 'n',  x: -145, y: -595, reward: 'coins',  qty: 1,  msg: '📦 Tähtilaatikko avattu: +1 Space Coin (🪙)!' },
      { id: 'ne', x: 580,  y: -360, reward: 'coins',  qty: 2,  msg: '📦 Itämetsän aarrelaatikko: +2 Space Coinia (🪙)!' },
      { id: 'se', x: 745,  y: 260,  reward: 'boards', qty: 6,  msg: '📦 Itämetsän tarvikelaatikko: +6 valmista lautaa (🪵)!' }
    ];
    world.supplyCrates = crateSpecs.filter(c => !S.cratesOpened[c.id]);

    let seed = 1;
    for (let gy = -1520; gy <= 1520; gy += 92) {
      for (let gx = -1680; gx <= 1680; gx += 96) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const jx = ((seed & 0xff) / 255 - 0.5) * 62;
        const jy = (((seed >> 8) & 0xff) / 255 - 0.5) * 58;
        const tx = gx + jx;
        const ty = gy + jy;

        const rc = getRiverCenter(ty);
        const rw = getRiverHalfWidth(ty);
        if (Math.abs(tx - rc) < rw + 38) continue;
        if (((seed >> 16) & 0xff) < 34) continue;
        if (isInsideReservedZone(tx, ty)) continue;
        if (world.supplyCrates.some(cr => Math.hypot(tx - cr.x, ty - cr.y) < 42)) continue;

        const isOuterBorder = (Math.abs(tx) > 940 || Math.abs(ty) > 800);
        world.trees.push({
          x: tx,
          y: ty,
          kind: ((seed >> 4) % 3 === 0) ? 'birch' : 'pine',
          scale: 0.84 + ((seed >> 10) % 5) * 0.055,
          regrow: 0,
          cutProg: 0,
          decorative: isOuterBorder
        });
      }
    }

    for (let i = 0; i < 85; i++) {
      const fx = Math.sin(i * 61.7 + 0.4) * 1280;
      const fy = Math.cos(i * 37.9 + 1.1) * 1080;
      if (Math.abs(fx - getRiverCenter(fy)) < getRiverHalfWidth(fy) + 46) continue;
      if (isInsideReservedZone(fx, fy)) continue;
      world.forestProps.push({
        x: fx, y: fy,
        kind: (i % 3 === 0) ? 'fallen_log' : 'flower_bush',
        scale: 0.80 + (i % 4) * 0.07
      });
    }

    world.meadowFlora = [];
    for (let i = 0; i < 360; i++) {
      const fx = Math.sin(i * 79.3) * 1550;
      const fy = Math.cos(i * 43.1) * 1350;
      if (Math.abs(fx - getRiverCenter(fy)) < getRiverHalfWidth(fy) + 28) continue;
      world.meadowFlora.push({
        x: fx, y: fy,
        type: (i % 4 === 0) ? 'clover' : 'flower',
        col: i % 3 === 0 ? '#fde047' : (i % 3 === 1 ? '#ffffff' : '#f9a8d4')
      });
    }

    world.riverBankProps = [];
    for (let y = -2200; y <= 2200; y += 64) {
      if (Math.abs(y - BRIDGE_Y) < 68) continue;
      const rc = getRiverCenter(y);
      const rw = getRiverHalfWidth(y);
      const hash = Math.abs(Math.round(y * 13));
      if (hash % 3 !== 0) {
        const isRock = (hash % 2 === 0);
        world.riverBankProps.push({
          x: isRock ? (rc - rw + 18) : (rc - rw - 6),
          y,
          kind: isRock ? 'river_rocks' : 'river_cattails',
          scale: 0.72 + (hash % 4) * 0.08,
          flip: false
        });
      }
      if ((hash + 1) % 3 !== 0) {
        const isRockE = ((hash + 1) % 2 === 0);
        world.riverBankProps.push({
          x: isRockE ? (rc + rw - 18) : (rc + rw + 6),
          y: y + 28,
          kind: isRockE ? 'river_rocks' : 'river_cattails',
          scale: 0.72 + ((hash + 2) % 4) * 0.08,
          flip: true
        });
      }
    }
  }

  function getActiveBuilderSum() {
    let sum = 0;
    for (const b of Object.values(S.buildings)) {
      if (b.state === 'building' || b.state === 'ruined') sum += (b.builders || 0);
      else b.builders = 0;
    }
    return sum;
  }

  function getAssignedTotal() {
    const j = S.jobs;
    return (j.cookGardeners || 0) + (j.woodcutters || 0) + (j.turnipFarmers || 0) +
           (j.sawyers || 0) + (j.oatFarmers || 0) + (j.millers || 0) + (j.bakers || 0) +
           getActiveBuilderSum();
  }

  function getFreeCarriersCount() {
    return Math.max(0, S.workerCount - getAssignedTotal());
  }

  function refundCarriedItem(c) {
    if (!c || !c.picked) return;
    if (c.item === 'log') S.piles.logsAtForest += c.qty;
    else if (c.item === 'board') S.buildings.sawmill.outBoards += c.qty;
    else if (c.item === 'turnip' && !c.fromStarter) S.piles.turnipsAtField += c.qty;
    else if (c.item === 'oat') S.piles.oatsAtField += c.qty;
    else if (c.item === 'flour') S.buildings.mill.outFlour += c.qty;
    else if (c.item === 'bread') S.buildings.bakery.outBreads += c.qty;
  }

  function reassignWorkerRoles() {
    let safety = 0;
    while (getAssignedTotal() > S.workerCount && safety++ < 100) {
      let reduced = false;
      for (const b of Object.values(S.buildings)) {
        if (b.builders > 0) { b.builders--; reduced = true; break; }
      }
      if (!reduced) {
        for (const k of ['bakers', 'millers', 'oatFarmers', 'sawyers', 'woodcutters', 'turnipFarmers', 'cookGardeners']) {
          if (S.jobs[k] > 0) { S.jobs[k]--; reduced = true; break; }
        }
      }
      if (!reduced) break;
    }

    const roleList = [];
    for (let i = 0; i < (S.jobs.cookGardeners || 0); i++) roleList.push({ role: 'cookGardener', siteKey: null, slot: i });
    for (let i = 0; i < (S.jobs.woodcutters || 0); i++) roleList.push({ role: 'woodcutter', siteKey: null, slot: i });
    for (let i = 0; i < (S.jobs.turnipFarmers || 0); i++) roleList.push({ role: 'turnipFarmer', siteKey: null, slot: i });
    for (let i = 0; i < (S.jobs.sawyers || 0); i++) roleList.push({ role: 'sawyer', siteKey: null, slot: i });
    for (let i = 0; i < (S.jobs.oatFarmers || 0); i++) roleList.push({ role: 'oatFarmer', siteKey: null, slot: i });
    for (let i = 0; i < (S.jobs.millers || 0); i++) roleList.push({ role: 'miller', siteKey: null, slot: i });
    for (let i = 0; i < (S.jobs.bakers || 0); i++) roleList.push({ role: 'baker', siteKey: null, slot: i });

    for (const [key, b] of Object.entries(S.buildings)) {
      if (b.state === 'building' || b.state === 'ruined') {
        for (let i = 0; i < (b.builders || 0); i++) {
          roleList.push({ role: 'builder', siteKey: key, slot: i });
        }
      }
    }

    let cSlot = 0;
    while (roleList.length < world.workers.length) {
      roleList.push({ role: 'carrier', siteKey: null, slot: cSlot++ });
    }

    world.workers.forEach((w, idx) => {
      const spec = roleList[idx];
      w.slot = spec.slot || 0;
      if (w.role !== spec.role || w.siteKey !== spec.siteKey) {
        if (w.carry) refundCarriedItem(w.carry);
        w.carry = null;
        w.targetTree = null;
        w.working = false;
        w.cookTimer = 0;
        w.role = spec.role;
        w.siteKey = spec.siteKey;
      }
    });
  }

  function assignSpecificWorker(worker, newRole, newSiteKey = null, specificTree = null) {
    if (!worker) return false;
    const minCook = (S.fields.turnip.active && S.jobs.turnipFarmers > 0) ? 0 : 1;
    if (worker.role === 'cookGardener' && (S.jobs.cookGardeners || 0) <= minCook && newRole !== 'cookGardener') {
      showToast('🍲 Kyläkeittiöllä on oltava vähintään 1 Kokki-Puutarhuri, jotta kylä saa ruokaa!');
      return false;
    }

    const roleToJobKey = {
      cookGardener: 'cookGardeners',
      woodcutter:   'woodcutters',
      turnipFarmer: 'turnipFarmers',
      sawyer:       'sawyers',
      oatFarmer:    'oatFarmers',
      miller:       'millers',
      baker:        'bakers'
    };

    if (worker.role === 'builder' && worker.siteKey && S.buildings[worker.siteKey]) {
      S.buildings[worker.siteKey].builders = Math.max(0, (S.buildings[worker.siteKey].builders || 1) - 1);
    } else if (roleToJobKey[worker.role]) {
      const jk = roleToJobKey[worker.role];
      S.jobs[jk] = Math.max(0, (S.jobs[jk] || 1) - 1);
    }

    if (newRole === 'builder' && newSiteKey && S.buildings[newSiteKey]) {
      S.buildings[newSiteKey].builders = (S.buildings[newSiteKey].builders || 0) + 1;
    } else if (roleToJobKey[newRole]) {
      const jk = roleToJobKey[newRole];
      S.jobs[jk] = (S.jobs[jk] || 0) + 1;
    }

    if (worker.carry) refundCarriedItem(worker.carry);
    worker.carry = null;
    worker.working = false;
    worker.cookTimer = 0;
    worker.role = newRole;
    worker.siteKey = newSiteKey;
    worker.targetTree = specificTree || null;

    saveGame();
    if (KV.UI) KV.UI.updateHUD();
    return true;
  }

  function syncEntitiesFromSave() {
    while (world.workers.length < S.workerCount) {
      const idx = world.workers.length;
      const isFirstCook = idx === 0;
      world.workers.push({
        kind: 'worker',
        female: (idx % 2 === 1),
        x: isFirstCook ? SITES.kitchen.x - 16 : SITES.ship.x - 36 + (idx % 4) * 24,
        y: isFirstCook ? SITES.kitchen.y + 52 : SITES.ship.y + 68 + Math.floor(idx / 4) * 18,
        role: 'carrier', siteKey: null, slot: 0,
        step: Math.random() * 6, ang: Math.PI * 0.5,
        faceLeft: false, faceBack: false,
        moving: false, working: false, toolPhase: 0,
        carry: null, targetTree: null, cookTimer: 0
      });
    }
    while (world.workers.length > S.workerCount) world.workers.pop();

    while (world.oxen.length < S.oxCount) {
      const idx = world.oxen.length;
      world.oxen.push({
        kind: 'ox',
        x: SITES.oxPen.x - 24 + idx * 24,
        y: SITES.oxPen.y + 54,
        step: 0, ang: 0, faceLeft: false, faceBack: false,
        moving: false, carry: null
      });
    }

    while (world.soldiers.length < S.soldierCount) {
      const idx = world.soldiers.length;
      const savedPost = S.soldierPosts[idx] || null;
      world.soldiers.push({
        kind: 'soldier',
        female: (idx % 2 === 1),
        x: SITES.barracks.x - 20 + idx * 22,
        y: SITES.barracks.y + 58,
        hp: 130, maxHp: 130, fireCd: 0.5,
        guardPost: savedPost,
        step: 0, ang: 0, faceLeft: false, faceBack: false, moving: false
      });
    }
    while (world.soldiers.length > S.soldierCount) world.soldiers.pop();

    if (S.hasSergeant && !world.sergeant) {
      world.sergeant = {
        kind: 'sergeant',
        female: true,
        x: SITES.barracks.x + 12,
        y: SITES.barracks.y + 62,
        hp: 260, maxHp: 260, fireCd: 0.34,
        guardPost: S.sergeantPost || null,
        step: 0, ang: 0, faceLeft: false, faceBack: false, moving: false
      };
    } else if (!S.hasSergeant) {
      world.sergeant = null;
    }

    reassignWorkerRoles();
  }

  function checkUnlocks() {
    let u = false;
    if (!S.unlocks.house && S.piles.logsAtForest >= 4) {
      S.unlocks.house = true; u = true;
      showToast('🏡 Hirsitalo 1 avattu! Tilaa talo – tontti raivataan metsän reunaan.');
    }
    if (!S.unlocks.bigTurnip && S.workerCount >= 5) {
      S.unlocks.bigTurnip = true; S.unlocks.sawmill = true; u = true;
      showToast('🌱 Kylä kasvaa (5 työläistä)! Iso Lautatarha sekä Suuri Naurispelto avautuivat!');
    }
    if (!S.unlocks.oxPen && S.buildings.sawmill.outBoards >= 4) {
      S.unlocks.oxPen = true; u = true;
      showToast('🐂 Härkäaitaus avattu! Kesytä Juhta-Härkä nauriilla kantoavuksi ENNEN siltaurakkaa!');
    }
    if (!S.unlocks.oatChain && S.buildings.sawmill.outBoards >= 6) {
      S.unlocks.oatChain = true; u = true;
      showToast('🌉 Puinen Kaarisilta sekä itärannan Kaurapelto, Vesimylly ja Leipomo avautuivat!');
    }
    if (!S.unlocks.barracks && (S.coins >= 1 || (S.buildings.sawmill.outBoards >= 12 && S.workerCount >= 6))) {
      S.unlocks.barracks = true; u = true;
      showToast('🥋 Kaurakaartin Kasarmi avattu! Voit kouluttaa kaartilaisia ja Kersantti Kipinän!');
    }
    if (u) {
      if (KV.Audio) KV.Audio.playSfx('build_done', 0.5);
      const badge = document.getElementById('unlockBadge');
      if (badge) badge.classList.remove('hidden');
      const modal = document.getElementById('manageModal');
      if (modal && !modal.classList.contains('hidden') && KV.UI) KV.UI.renderManageModal();
    }
  }

  initValleyNature();
  clearReservedZones(false);
  syncEntitiesFromSave();
  setInterval(saveGame, 5000);

  KV.S = S;
  KV.hero = hero;
  KV.world = world;
  KV.State = {
    getRecommendedZoom,
    saveGame,
    resetSave,
    selectUnit,
    addSpeech,
    showToast,
    isInsideReservedZone,
    clearReservedZones,
    getAssignedTotal,
    getFreeCarriersCount,
    reassignWorkerRoles,
    assignSpecificWorker,
    syncEntitiesFromSave,
    checkUnlocks
  };
})();