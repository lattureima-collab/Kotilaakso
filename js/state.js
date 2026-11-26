// ============================================================================
// js/state.js – Kahden planeetan pelitila, tavaranpalautus & luonto (v8.4)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { SITES, MARS_SITES, BUILDING_KEYS, MARS_BUILDING_KEYS, COMMANDERS, FOOD_CFG, CARGO_LIMITS, getRiverCenter, getRiverHalfWidth, BRIDGE_X, BRIDGE_Y } = KV.CFG;
  const SAVE_KEY = 'vegan_space_v8_3';

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
    started: false,
    soundOn: true,
    musicOn: true,
    zoom: null,
    viewPlanet: 'valley',
    shipPlanet: 'valley',
    crimsonUnlocked: false,
    commanderChosen: false,
    commanderId: 'pippuri',
    heroMedbayTimer: 0,
    coins: 0,
    totalCoinsEarned: 0,
    starOre: 0,
    breads: 0,
    stew: 34,
    cargo: {
      fillActive: false,
      logs: 0,
      boards: 0,
      stew: 0
    },
    unlocks: {
      lodge: true,
      sawmill: false,
      bigTurnip: false,
      barracks: false,
      bridgeChain: false
    },
    everBakedBread: false,
    jobs: {
      cookGardeners: 1,
      woodcutters: 1,
      turnipFarmers: 0,
      sawyers: 0,
      oatFarmers: 0,
      millers: 0,
      bakers: 0
    },
    piles: { logsAtForest: 0, turnipsAtField: 0, oatsAtField: 0 },
    buildings: {
      lodge:    { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 5, boardsIn: 0, boardsNeed: 0, growing: false, spawnProg: 0, residents: 0, hp: 320, maxHp: 320 },
      kitchen:  { state: 'built', builders: 0, prog: 1, logsIn: 4, logsNeed: 4, boardsIn: 0, boardsNeed: 0, hp: 260, maxHp: 260 },
      sawmill:  { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 6, boardsIn: 0, boardsNeed: 0, rawLogs: 0, outBoards: 0, workProg: 0, hp: 220, maxHp: 220 },
      barracks: { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 6, boardsIn: 0, boardsNeed: 6, trainQueued: false, trainProg: 0, hp: 320, maxHp: 320 },
      bridge:   { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 6, boardsIn: 0, boardsNeed: 6, hp: 280, maxHp: 280 },
      mill:     { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 5, boardsIn: 0, boardsNeed: 7, rawOats: 0, outFlour: 0, workProg: 0, hp: 220, maxHp: 220 },
      bakery:   { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 6, boardsIn: 0, boardsNeed: 8, rawFlour: 0, outBreads: 0, workProg: 0, hp: 220, maxHp: 220 },
      oxPen:    { state: 'none', builders: 0 },
      house1:   { state: 'none', builders: 0 },
      house2:   { state: 'none', builders: 0 },
      house3:   { state: 'none', builders: 0 }
    },
    fields: {
      starterTurnip: { active: true,  stage: 4, prog: 0 },
      turnip:        { active: false, stage: 0, prog: 0 },
      oat:           { active: false, stage: 0, prog: 0 }
    },
    cratesOpened: {},
    workerCount: 4,
    soldierCount: 0,
    soldierPosts: [],

    mars: {
      visited: false,
      logs: 0,
      boards: 0,
      stew: 24,
      turnips: 0,
      oreAtMine: 0,
      workerCount: 0,
      soldierCount: 0,
      soldierPosts: [],
      jobs: { cooks: 0, farmers: 0, miners: 0 },
      buildings: {
        mKitchen: { state: 'none', builders: 0, prog: 0, logsIn: 0, logsNeed: 4, boardsIn: 0, boardsNeed: 4, hp: 250, maxHp: 250 },
        mBunker:  { state: 'none', builders: 0, prog: 0, logsIn: 0, logsNeed: 4, boardsIn: 0, boardsNeed: 6, hp: 360, maxHp: 360 },
        starMine: { state: 'none', builders: 0, prog: 0, logsIn: 0, logsNeed: 4, boardsIn: 0, boardsNeed: 6, workProg: 0, hp: 300, maxHp: 300 }
      },
      field: { active: false, stage: 0, prog: 0 },
      fortress: {
        outpostNHp: 260, outpostNMax: 260,
        outpostSHp: 260, outpostSMax: 260,
        mainHp: 680,     mainMax: 680,
        conquered: false
      }
    }
  };

  let loaded = null;
  try {
    loaded = JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem('vegan_space_v8_2') || 'null');
  } catch (e) { loaded = null; }

  const S = (loaded && loaded.buildings && loaded.buildings.lodge)
    ? Object.assign(JSON.parse(JSON.stringify(defaultState)), loaded)
    : JSON.parse(JSON.stringify(defaultState));

  if (!S.zoom || !Number.isFinite(S.zoom)) S.zoom = getRecommendedZoom();
  if (!S.cargo) S.cargo = { fillActive: false, logs: 0, boards: 0, stew: 0 };
  if (!S.mars) S.mars = JSON.parse(JSON.stringify(defaultState.mars));
  if (!S.viewPlanet) S.viewPlanet = 'valley';
  if (!S.shipPlanet) S.shipPlanet = 'valley';
  if (typeof S.starOre !== 'number') S.starOre = 0;
  ['oxPen', 'house1', 'house2', 'house3'].forEach(k => {
    if (!S.buildings[k]) S.buildings[k] = { state: 'none', builders: 0 };
  });

  function saveGame() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  function resetSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem('vegan_space_v8_2');
    } catch (e) {}
    location.reload();
  }

  function getCommanderSpec() {
    return COMMANDERS[S.commanderId] || COMMANDERS.pippuri;
  }

  const initCmd = getCommanderSpec();
  const hero = {
    kind: 'hero',
    planet: S.shipPlanet,
    x: S.shipPlanet === 'crimson' ? (MARS_SITES.ship.x - 66) : SITES.barracks.x,
    y: S.shipPlanet === 'crimson' ? (MARS_SITES.ship.y + 42) : (SITES.barracks.y + 62),
    ang: Math.PI * 0.5,
    faceLeft: false, faceBack: false,
    step: 0, moving: false, working: false, toolPhase: 0,
    selected: false, target: null, targetTree: null,
    hp: initCmd.maxHp, maxHp: initCmd.maxHp, fireCd: 0,
    bypassId: null, bypassDir: 1, bypassLock: 0
  };

  const world = {
    selectedEntity: null,
    flightAnim: null,
    trees: [],
    supplyCrates: [],
    forestProps: [],
    meadowFlora: [],
    riverBankProps: [],
    workers: [],
    oxen: [],
    soldiers: [],
    orcs: [],
    bullets: [],
    steamPuffs: [],
    speech: [],
    snowParticles: [],
    clickRipples: [],
    frostTimer: 140,
    frostActive: 0,
    orcRaidTimer: 110,

    marsRocks: [],
    marsCraters: [],
    marsPatches: [],
    marsWorkers: [],
    marsSoldiers: [],
    marsOrcs: [],
    marsBullets: [],
    marsWaveTimer: 45
  };

  function getLivingPopulation() {
    const cmdHere = (S.commanderChosen && S.shipPlanet === 'valley') ? 1 : 0;
    return S.workerCount + S.soldierCount + cmdHere;
  }

  function getTotalPopulation() {
    const trainRes = S.buildings.barracks.trainQueued ? 1 : 0;
    const growRes = S.buildings.lodge.growing ? 1 : 0;
    return getLivingPopulation() + trainRes + growRes;
  }

  function getMaxSustainablePop() {
    let cap = 0;
    if ((S.jobs.cookGardeners || 0) >= 1) cap += 6;
    if ((S.jobs.cookGardeners || 0) >= 2) cap += 2;
    if (S.fields.turnip.active && (S.jobs.turnipFarmers || 0) >= 1) cap += 4;
    if (S.fields.turnip.active && (S.jobs.turnipFarmers || 0) >= 2) cap += 4;
    return Math.max(4, Math.min(18, cap));
  }

  function getStewBurnPerSec() {
    return getLivingPopulation() * FOOD_CFG.STEW_PER_PERSON_SEC;
  }

  function getMarsLivingPop() {
    const cmdHere = (S.commanderChosen && S.shipPlanet === 'crimson') ? 1 : 0;
    return S.mars.workerCount + S.mars.soldierCount + cmdHere;
  }

  function getMarsMaxPop() {
    let cap = 3;
    if (S.mars.buildings.mKitchen.state === 'built' && (S.mars.jobs.cooks || 0) >= 1) cap += 5;
    if (S.mars.field.active && (S.mars.jobs.farmers || 0) >= 1) cap += 5;
    return cap;
  }

  function getMarsStewBurnPerSec() {
    return getMarsLivingPop() * (FOOD_CFG.STEW_PER_PERSON_SEC * 0.85);
  }

  function isOutlineVisible(key, planet = 'valley') {
    if (planet === 'crimson') {
      if (key === 'mKitchen') return S.mars.buildings.mKitchen.state === 'none';
      if (key === 'mTurnipFarm') return S.mars.buildings.mKitchen.state === 'built' && !S.mars.field.active;
      if (key === 'mBunker') return S.mars.buildings.mBunker.state === 'none';
      if (key === 'starMine') return S.mars.fortress.conquered && S.mars.buildings.starMine.state === 'none';
      return false;
    }
    if (key === 'turnipFarm') return Boolean(S.unlocks.bigTurnip && !S.fields.turnip.active);
    if (key === 'oatFarm') return Boolean(S.buildings.bridge.state === 'built' && !S.fields.oat.active);
    const b = S.buildings[key];
    if (!b || b.state !== 'none') return false;
    if (key === 'lodge') return Boolean(S.unlocks.lodge);
    if (key === 'sawmill') return Boolean(S.unlocks.sawmill);
    if (key === 'barracks') return Boolean(S.unlocks.barracks);
    if (key === 'bridge') return Boolean(S.unlocks.bridgeChain);
    if (key === 'mill' || key === 'bakery') return Boolean(S.buildings.bridge.state === 'built');
    return false;
  }

  function selectUnit(unit) {
    if (unit === hero && (!S.commanderChosen || S.shipPlanet !== S.viewPlanet)) return;
    world.selectedEntity = unit;
    hero.selected = (unit === hero);
    if (KV.UI) KV.UI.syncHeroButton();
  }

  function switchViewPlanet(targetPlanet) {
    const nextP = targetPlanet || (S.viewPlanet === 'valley' ? 'crimson' : 'valley');
    if (nextP === 'crimson' && !S.mars.visited) return;
    if (KV.Camera && KV.Camera.savePlanetCam) KV.Camera.savePlanetCam(S.viewPlanet);
    S.viewPlanet = nextP;
    selectUnit(null);
    if (KV.Camera && KV.Camera.restorePlanetCam) KV.Camera.restorePlanetCam(nextP);
    saveGame();
    if (KV.UI) KV.UI.updateHUD();
  }

  function addSpeech(x, y, text, col = '#fefce8', planet = 'valley') {
    if (planet !== S.viewPlanet || world.speech.length > 8) return;
    world.speech.push({ x, y, text, col, life: 3.0 });
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._tm);
    t._tm = setTimeout(() => { t.style.opacity = '0'; }, 4500);
  }

  // Palauttaa varatun tai kannossa olevan tavaran takaisin varastoon roolin vaihtuessa!
  function refundCarriedItem(c, planet = 'valley') {
    if (!c) return;
    if (planet === 'crimson') {
      if (c.item === 'log') S.mars.logs += c.qty;
      else if (c.item === 'board') S.mars.boards += c.qty;
      else if (c.item === 'turnip') S.mars.turnips += c.qty;
      else if (c.item === 'ore') S.starOre += c.qty;
      return;
    }
    if (c.item === 'log') S.piles.logsAtForest = Math.min(30, S.piles.logsAtForest + c.qty);
    else if (c.item === 'board') S.buildings.sawmill.outBoards = Math.min(24, S.buildings.sawmill.outBoards + c.qty);
    else if (c.item === 'turnip') {
      if (c.destKey === 'cargoPod') S.stew = Math.min(95, S.stew + c.qty * 5);
      else if (!c.fromStarter) S.piles.turnipsAtField += c.qty;
    } else if (c.item === 'oat') S.piles.oatsAtField += c.qty;
    else if (c.item === 'flour') S.buildings.mill.outFlour += c.qty;
    else if (c.item === 'bread') S.buildings.bakery.outBreads += c.qty;
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function distToTrailCurve(px, py, x1, y1, cx, cy, x2, y2) {
    let minD = distToSegment(px, py, x1, y1, x2, y2);
    let prevX = x1, prevY = y1;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8, mt = 1 - t;
      const curX = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
      const curY = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
      minD = Math.min(minD, distToSegment(px, py, prevX, prevY, curX, curY));
      prevX = curX; prevY = curY;
    }
    return minD;
  }

  function isInsideInitialClearing(x, y) {
    const lx = SITES.lodge.x, ly = SITES.lodge.y + 28;
    if (Math.hypot(x - SITES.ship.x, y - SITES.ship.y) < 122) return true;
    if (Math.hypot(x - SITES.cargoPod.x, y - SITES.cargoPod.y) < 88) return true;
    if (distToTrailCurve(x, y, SITES.ship.x + 25, SITES.ship.y + 30, -470, -240, lx, ly) < 48) return true;
    if (Math.hypot(x - SITES.lodge.x, y - SITES.lodge.y) < 122) return true;
    if (Math.hypot(x - SITES.kitchen.x, y - SITES.kitchen.y) < 104) return true;
    if (Math.hypot((x - SITES.starterGarden.x) / 1.25, y - SITES.starterGarden.y) < 84) return true;
    if (Math.hypot(x - SITES.logPile.x, y - SITES.logPile.y) < 78) return true;
    if (distToTrailCurve(x, y, lx, ly, -255, -160, SITES.logPile.x, SITES.logPile.y + 16) < 48) return true;
    if (distToTrailCurve(x, y, lx, ly, -250, 120, SITES.kitchen.x, SITES.kitchen.y + 30) < 48) return true;
    if (distToTrailCurve(x, y, SITES.kitchen.x - 18, SITES.kitchen.y + 30, -390, 225, SITES.starterGarden.x + 38, SITES.starterGarden.y) < 48) return true;
    return false;
  }

  function isInsideReservedZone(x, y) {
    if (isInsideInitialClearing(x, y)) return true;
    const lx = SITES.lodge.x, ly = SITES.lodge.y + 28;
    const westBridgeMouth = BRIDGE_X - 134, eastBridgeMouth = BRIDGE_X + 134;

    for (const key of BUILDING_KEYS) {
      const b = S.buildings[key];
      if (b.state !== 'none' || isOutlineVisible(key, 'valley')) {
        const pos = SITES[key];
        const rad = key === 'bridge' ? 96 : (key === 'lodge' ? 120 : 104);
        if (Math.hypot(x - pos.x, y - pos.y) < rad) return true;
      }
    }
    if (S.fields.turnip.active || isOutlineVisible('turnipFarm', 'valley')) {
      if (Math.hypot((x - SITES.turnipFarm.x) / 1.35, y - SITES.turnipFarm.y) < 104) return true;
      if (Math.hypot(x - SITES.turnipBox.x, y - SITES.turnipBox.y) < 60) return true;
      if (distToTrailCurve(x, y, SITES.kitchen.x, SITES.kitchen.y + 32, -335, 275, SITES.turnipBox.x, SITES.turnipBox.y + 6) < 48) return true;
    }
    if (S.fields.oat.active || isOutlineVisible('oatFarm', 'valley')) {
      if (Math.hypot((x - SITES.oatFarm.x) / 1.35, y - SITES.oatFarm.y) < 104) return true;
      if (Math.hypot(x - SITES.oatPile.x, y - SITES.oatPile.y) < 60) return true;
      if (distToTrailCurve(x, y, eastBridgeMouth, BRIDGE_Y + 2, 365, 115, SITES.oatPile.x, SITES.oatPile.y + 6) < 48) return true;
      if (distToTrailCurve(x, y, SITES.oatPile.x, SITES.oatPile.y + 6, 460, 235, SITES.oatFarm.x - 28, SITES.oatFarm.y - 12) < 48) return true;
    }
    if (S.buildings.sawmill.state !== 'none' && distToTrailCurve(x, y, SITES.logPile.x, SITES.logPile.y + 16, -175, -345, SITES.sawmill.x, SITES.sawmill.y + 32) < 48) return true;
    if (S.buildings.barracks.state !== 'none' && distToTrailCurve(x, y, lx, ly, -120, -55, SITES.barracks.x, SITES.barracks.y + 36) < 48) return true;
    if (S.buildings.bridge.state !== 'none' && distToTrailCurve(x, y, lx, ly, -40, 38, westBridgeMouth, BRIDGE_Y + 2) < 48) return true;
    if (S.buildings.bridge.state === 'built') {
      if (S.buildings.mill.state !== 'none' && distToTrailCurve(x, y, eastBridgeMouth, BRIDGE_Y + 2, eastBridgeMouth + 32, -45, SITES.mill.x + 12, SITES.mill.y + 52) < 48) return true;
      if (S.buildings.bakery.state !== 'none' && distToTrailCurve(x, y, eastBridgeMouth, BRIDGE_Y + 2, 435, 58, SITES.bakery.x, SITES.bakery.y + 32) < 48) return true;
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
      if (isInsideReservedZone(world.forestProps[i].x, world.forestProps[i].y)) world.forestProps.splice(i, 1);
    }
  }

  function initWorldsNature() {
    world.trees = [];
    world.forestProps = [];
    const crateSpecs = [
      { id: 'w',  x: -765, y: -115, reward: 'boards', qty: 4,  msg: '📦 Tarvikelaatikko: +4 lautaa (🪵)!' },
      { id: 'sw', x: -740, y: 310,  reward: 'stew',   qty: 16, msg: '📦 Muonalaatikko: +16 Naurispataa (🍲)!' },
      { id: 'n',  x: -155, y: -590, reward: 'coins',  qty: 1,  msg: '📦 Tähtilaatikko: +1 Space Coin (🪙)!' },
      { id: 'ne', x: 580,  y: -360, reward: 'coins',  qty: 2,  msg: '📦 Itämetsän arkku: +2 Space Coinia (🪙)!' },
      { id: 'se', x: 745,  y: 260,  reward: 'boards', qty: 6,  msg: '📦 Itämetsän laatikko: +6 lautaa (🪵)!' }
    ];
    world.supplyCrates = crateSpecs.filter(c => !S.cratesOpened[c.id]);

    let seed = 1;
    for (let gy = -1520; gy <= 1520; gy += 92) {
      for (let gx = -1680; gx <= 1680; gx += 96) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const tx = gx + (((seed & 0xff) / 255 - 0.5) * 62);
        const ty = gy + ((((seed >> 8) & 0xff) / 255 - 0.5) * 58);
        if (Math.abs(tx - getRiverCenter(ty)) < getRiverHalfWidth(ty) + 38) continue;
        if (((seed >> 16) & 0xff) < 34 || isInsideReservedZone(tx, ty)) continue;
        if (world.supplyCrates.some(cr => Math.hypot(tx - cr.x, ty - cr.y) < 44)) continue;
        world.trees.push({
          x: tx, y: ty,
          kind: ((seed >> 4) % 3 === 0) ? 'birch' : 'pine',
          scale: 0.84 + ((seed >> 10) % 5) * 0.055,
          regrow: 0, cutProg: 0,
          decorative: (Math.abs(tx) > 940 || Math.abs(ty) > 800)
        });
      }
    }

    // Metsän kaatuneet rungot ja kukkapensaat takaisin!
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
      const fx = Math.sin(i * 79.3) * 1550, fy = Math.cos(i * 43.1) * 1350;
      if (Math.abs(fx - getRiverCenter(fy)) < getRiverHalfWidth(fy) + 28) continue;
      world.meadowFlora.push({ x: fx, y: fy, type: (i % 4 === 0) ? 'clover' : 'flower', col: i % 3 === 0 ? '#fde047' : (i % 3 === 1 ? '#ffffff' : '#f9a8d4') });
    }

    world.riverBankProps = [];
    for (let y = -2200; y <= 2200; y += 64) {
      if (Math.abs(y - BRIDGE_Y) < 68) continue;
      const rc = getRiverCenter(y), rw = getRiverHalfWidth(y), hash = Math.abs(Math.round(y * 13));
      if (hash % 3 !== 0) {
        const isRock = (hash % 2 === 0);
        world.riverBankProps.push({
          x: isRock ? (rc - rw + 18) : (rc - rw - 6), y,
          kind: isRock ? 'river_rocks' : 'river_cattails',
          scale: 0.72 + (hash % 4) * 0.08, flip: false
        });
      }
      if ((hash + 1) % 3 !== 0) {
        const isRockE = ((hash + 1) % 2 === 0);
        world.riverBankProps.push({
          x: isRockE ? (rc + rw - 18) : (rc + rw + 6), y: y + 28,
          kind: isRockE ? 'river_rocks' : 'river_cattails',
          scale: 0.72 + ((hash + 2) % 4) * 0.08, flip: true
        });
      }
    }

    // Punakiven kraatterit, kivikerrostumat ja lohkareet
    world.marsCraters = [
      { x: MARS_SITES.mTurnipFarm.x, y: MARS_SITES.mTurnipFarm.y, rx: 135, ry: 78, fertile: true },
      { x: -180, y: -270, rx: 85, ry: 52 },
      { x: 60,   y: 270,  rx: 95, ry: 56 },
      { x: -690, y: 120,  rx: 72, ry: 44 },
      { x: 430,  y: -300, rx: 88, ry: 50 }
    ];
    world.marsPatches = [];
    for (let i = 0; i < 160; i++) {
      world.marsPatches.push({
        x: Math.sin(i * 41.3 + 0.5) * 1450,
        y: Math.cos(i * 29.7 + 1.2) * 1150,
        rx: 28 + (i % 6) * 16,
        ry: 16 + (i % 5) * 9,
        dark: (i % 2 === 0)
      });
    }
    world.marsRocks = [];
    for (let i = 0; i < 115; i++) {
      const rx = Math.sin(i * 53.1 + 0.7) * 1180;
      const ry = Math.cos(i * 31.7 + 1.9) * 880;
      const nearSite = Object.values(MARS_SITES).some(ms => Math.hypot(rx - ms.x, ry - ms.y) < 115);
      if (nearSite) continue;
      world.marsRocks.push({ x: rx, y: ry, scale: 0.75 + (i % 5) * 0.14, flip: (i % 2 === 0) });
    }
  }

  function getActiveBuilderSum() {
    let sum = 0;
    for (const key of BUILDING_KEYS) {
      const b = S.buildings[key];
      if (b.state === 'building' || b.state === 'ruined') {
        b.builders = Math.max(0, Math.min(1, b.builders || 0));
        sum += b.builders;
      } else b.builders = 0;
    }
    return sum;
  }

  function getAssignedTotal() {
    const j = S.jobs;
    return (j.cookGardeners || 0) + (j.woodcutters || 0) + (j.turnipFarmers || 0) +
           (j.sawyers || 0) + (j.oatFarmers || 0) + (j.millers || 0) + (j.bakers || 0) + getActiveBuilderSum();
  }

  function getFreeCarriersCount(planet = 'valley') {
    if (planet === 'crimson') {
      let bSum = 0;
      for (const k of MARS_BUILDING_KEYS) {
        const mb = S.mars.buildings[k];
        if (mb.state === 'building' || mb.state === 'ruined') bSum += (mb.builders || 0);
      }
      const mj = S.mars.jobs;
      return Math.max(0, S.mars.workerCount - ((mj.cooks || 0) + (mj.farmers || 0) + (mj.miners || 0) + bSum));
    }
    return Math.max(0, S.workerCount - getAssignedTotal());
  }

  function reassignWorkerRoles() {
    let safety = 0;
    while (getAssignedTotal() > S.workerCount && safety++ < 100) {
      let reduced = false;
      for (const key of BUILDING_KEYS) {
        if (S.buildings[key].builders > 0) { S.buildings[key].builders--; reduced = true; break; }
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
    for (const key of BUILDING_KEYS) {
      const b = S.buildings[key];
      if ((b.state === 'building' || b.state === 'ruined') && b.builders > 0) roleList.push({ role: 'builder', siteKey: key, slot: 0 });
    }
    let cSlot = 0;
    while (roleList.length < world.workers.length) roleList.push({ role: 'carrier', siteKey: null, slot: cSlot++ });

    world.workers.forEach((w, idx) => {
      const spec = roleList[idx];
      w.slot = spec.slot || 0;
      if (w.role !== spec.role || w.siteKey !== spec.siteKey) {
        if (w.carry) refundCarriedItem(w.carry, 'valley');
        w.carry = null; w.targetTree = null; w.working = false; w.cookTimer = 0;
        w.role = spec.role; w.siteKey = spec.siteKey;
      }
    });
  }

  function reassignMarsRoles() {
    const M = S.mars;
    let safety = 0;
    const totalMarsAssigned = () => {
      let bSum = 0;
      for (const k of MARS_BUILDING_KEYS) {
        const mb = M.buildings[k];
        if (mb.state === 'building' || mb.state === 'ruined') {
          mb.builders = Math.max(0, Math.min(1, mb.builders || 0));
          bSum += mb.builders;
        } else mb.builders = 0;
      }
      return (M.jobs.cooks || 0) + (M.jobs.farmers || 0) + (M.jobs.miners || 0) + bSum;
    };

    while (totalMarsAssigned() > M.workerCount && safety++ < 60) {
      let red = false;
      for (const k of MARS_BUILDING_KEYS) { if (M.buildings[k].builders > 0) { M.buildings[k].builders--; red = true; break; } }
      if (!red) {
        for (const jk of ['miners', 'farmers', 'cooks']) { if (M.jobs[jk] > 0) { M.jobs[jk]--; red = true; break; } }
      }
      if (!red) break;
    }

    const rList = [];
    for (let i = 0; i < (M.jobs.cooks || 0); i++) rList.push({ role: 'mCook', siteKey: null, slot: i });
    for (let i = 0; i < (M.jobs.farmers || 0); i++) rList.push({ role: 'mFarmer', siteKey: null, slot: i });
    for (let i = 0; i < (M.jobs.miners || 0); i++) rList.push({ role: 'mMiner', siteKey: null, slot: i });
    for (const k of MARS_BUILDING_KEYS) {
      if ((M.buildings[k].state === 'building' || M.buildings[k].state === 'ruined') && M.buildings[k].builders > 0) {
        rList.push({ role: 'mBuilder', siteKey: k, slot: 0 });
      }
    }
    let cs = 0;
    while (rList.length < world.marsWorkers.length) rList.push({ role: 'mCarrier', siteKey: null, slot: cs++ });

    world.marsWorkers.forEach((w, idx) => {
      const spec = rList[idx];
      w.slot = spec.slot || 0;
      if (w.role !== spec.role || w.siteKey !== spec.siteKey) {
        if (w.carry) refundCarriedItem(w.carry, 'crimson');
        w.carry = null; w.working = false; w.cookTimer = 0;
        w.role = spec.role; w.siteKey = spec.siteKey;
      }
    });
  }

  function assignSpecificWorker(worker, newRole, newSiteKey = null, specificTree = null) {
    if (!worker) return false;
    if (worker.planet === 'crimson') {
      const M = S.mars;
      if (newRole === 'mBuilder' && newSiteKey && M.buildings[newSiteKey]) {
        if ((M.buildings[newSiteKey].builders || 0) >= 1 && !(worker.role === 'mBuilder' && worker.siteKey === newSiteKey)) {
          showToast('🔨 Tällä työmaalla on jo 1 rakentaja!');
          return false;
        }
      }
      const mapM = { mCook: 'cooks', mFarmer: 'farmers', mMiner: 'miners' };
      if (worker.role === 'mBuilder' && worker.siteKey && M.buildings[worker.siteKey]) M.buildings[worker.siteKey].builders = 0;
      else if (mapM[worker.role]) M.jobs[mapM[worker.role]] = Math.max(0, (M.jobs[mapM[worker.role]] || 1) - 1);

      if (newRole === 'mBuilder' && newSiteKey && M.buildings[newSiteKey]) M.buildings[newSiteKey].builders = 1;
      else if (mapM[newRole]) M.jobs[mapM[newRole]] = (M.jobs[mapM[newRole]] || 0) + 1;

      if (worker.carry) refundCarriedItem(worker.carry, 'crimson');
      worker.carry = null; worker.working = false; worker.role = newRole; worker.siteKey = newSiteKey;
      saveGame();
      return true;
    }

    const minCook = (S.fields.turnip.active && S.jobs.turnipFarmers > 0) ? 0 : 1;
    if (worker.role === 'cookGardener' && (S.jobs.cookGardeners || 0) <= minCook && newRole !== 'cookGardener') {
      showToast('🍲 Kyläkeittiöllä on oltava vähintään 1 Kokki-Puutarhuri!');
      return false;
    }
    if (newRole === 'builder' && newSiteKey && S.buildings[newSiteKey]) {
      if ((S.buildings[newSiteKey].builders || 0) >= 1 && !(worker.role === 'builder' && worker.siteKey === newSiteKey)) {
        showToast('🔨 Tällä työmaalla on jo 1 rakentaja!');
        return false;
      }
    }
    const roleToJobKey = { cookGardener: 'cookGardeners', woodcutter: 'woodcutters', turnipFarmer: 'turnipFarmers', sawyer: 'sawyers', oatFarmer: 'oatFarmers', miller: 'millers', baker: 'bakers' };
    if (worker.role === 'builder' && worker.siteKey && S.buildings[worker.siteKey]) S.buildings[worker.siteKey].builders = 0;
    else if (roleToJobKey[worker.role]) S.jobs[roleToJobKey[worker.role]] = Math.max(0, (S.jobs[roleToJobKey[worker.role]] || 1) - 1);

    if (newRole === 'builder' && newSiteKey && S.buildings[newSiteKey]) S.buildings[newSiteKey].builders = 1;
    else if (roleToJobKey[newRole]) S.jobs[roleToJobKey[newRole]] = (S.jobs[roleToJobKey[newRole]] || 0) + 1;

    if (worker.carry) refundCarriedItem(worker.carry, 'valley');
    worker.carry = null; worker.working = false; worker.cookTimer = 0;
    worker.role = newRole; worker.siteKey = newSiteKey; worker.targetTree = specificTree || null;
    saveGame();
    return true;
  }

  function startOutlineFromMap(key, preferredWorker = null, planet = 'valley') {
    if (planet === 'crimson') {
      const M = S.mars;
      if (key === 'mTurnipFarm') {
        if (M.field.active) return false;
        M.field.active = true; M.field.stage = 1; M.field.prog = 0;
        if (KV.Audio) KV.Audio.playSfx('dig', 0.38);
        if (preferredWorker) assignSpecificWorker(preferredWorker, 'mFarmer');
        else if (getFreeCarriersCount('crimson') > 0) { M.jobs.farmers = 1; reassignMarsRoles(); }
        showToast('🌱 Kraatterin Naurismaa otettu viljelyyn Punakivellä!');
        saveGame();
        return true;
      }
      const mb = M.buildings[key];
      if (!mb || mb.state !== 'none') return false;
      mb.state = 'building'; mb.builders = 0;
      if (KV.Audio) KV.Audio.playSfx('hammer', 0.38);
      if (preferredWorker) assignSpecificWorker(preferredWorker, 'mBuilder', key);
      else if (getFreeCarriersCount('crimson') > 0) { mb.builders = 1; reassignMarsRoles(); }
      showToast(`🔨 ${MARS_SITES[key].label} aloitettu! Rakentaja hakee tarvikkeet Rahtivarastosta.`);
      saveGame();
      return true;
    }

    if (key === 'turnipFarm' || key === 'oatFarm') {
      const isOat = (key === 'oatFarm');
      const f = isOat ? S.fields.oat : S.fields.turnip;
      if (f.active) return false;
      f.active = true; f.stage = 1; f.prog = 0;
      clearReservedZones(true);
      if (KV.Audio) KV.Audio.playSfx('dig', 0.38);
      const farmerRole = isOat ? 'oatFarmer' : 'turnipFarmer';
      const jobKey = isOat ? 'oatFarmers' : 'turnipFarmers';
      if (preferredWorker) assignSpecificWorker(preferredWorker, farmerRole);
      else if (getFreeCarriersCount('valley') > 0) { S.jobs[jobKey] = 1; reassignWorkerRoles(); }
      showToast(`🌱 ${isOat ? 'Suuri Kaurapelto' : 'Suuri Naurispelto'} avattu viljelyyn!`);
      saveGame();
      return true;
    }

    const b = S.buildings[key];
    if (!b || b.state !== 'none') return false;
    b.state = 'building'; b.builders = 0;
    clearReservedZones(true);
    if (KV.Audio) KV.Audio.playSfx('chop', 0.38);
    if (preferredWorker) assignSpecificWorker(preferredWorker, 'builder', key);
    else if (getFreeCarriersCount('valley') > 0) { b.builders = 1; reassignWorkerRoles(); }
    else if ((S.jobs.woodcutters || 0) > 1) { S.jobs.woodcutters--; b.builders = 1; reassignWorkerRoles(); }
    showToast(`🔨 ${SITES[key].label} aloitettu (1 rakentaja)!`);
    saveGame();
    return true;
  }

  function launchStarship(moveWorkers = 0, moveSoldiers = 0) {
    if (!S.commanderChosen || S.heroMedbayTimer > 0 || world.flightAnim) return false;

    const fromP = S.shipPlanet;
    const toP = fromP === 'valley' ? 'crimson' : 'valley';

    // Palautetaan lähtevien työläisten mahdolliset kantamukset varastoon ennen nousua
    if (fromP === 'valley') {
      const wTake = Math.max(0, Math.min(moveWorkers, Math.max(0, S.workerCount - 2)));
      const sTake = Math.max(0, Math.min(moveSoldiers, S.soldierCount));
      for (let i = world.workers.length - 1; i >= world.workers.length - wTake && i >= 0; i--) {
        if (world.workers[i].carry) refundCarriedItem(world.workers[i].carry, 'valley');
        world.workers[i].carry = null;
      }
      S.workerCount -= wTake;
      S.soldierCount -= sTake;
      S.mars.workerCount += wTake;
      S.mars.soldierCount += sTake;

      S.mars.logs += S.cargo.logs;
      S.mars.boards += S.cargo.boards;
      S.mars.stew = Math.min(110, S.mars.stew + S.cargo.stew);
      S.cargo.logs = 0; S.cargo.boards = 0; S.cargo.stew = 0;
      S.cargo.fillActive = false;
      S.mars.visited = true;
      S.crimsonUnlocked = true;
    } else {
      const wBack = Math.max(0, Math.min(moveWorkers, S.mars.workerCount));
      const sBack = Math.max(0, Math.min(moveSoldiers, S.mars.soldierCount));
      for (let i = world.marsWorkers.length - 1; i >= world.marsWorkers.length - wBack && i >= 0; i--) {
        if (world.marsWorkers[i].carry) refundCarriedItem(world.marsWorkers[i].carry, 'crimson');
        world.marsWorkers[i].carry = null;
      }
      S.mars.workerCount -= wBack;
      S.mars.soldierCount -= sBack;
      S.workerCount += wBack;
      S.soldierCount += sBack;

      if (S.mars.oreAtMine > 0) {
        S.starOre += S.mars.oreAtMine;
        S.mars.oreAtMine = 0;
      }
    }

    world.flightAnim = { timer: 0, dur: 2.4, from: fromP, to: toP };
    S.shipPlanet = toP;
    hero.planet = toP;
    hero.target = null;
    hero.targetTree = null;
    // Asetetaan Kersantti aluksen sivuun, jotta hän ei peitä Tähtialuksen klikkausta!
    if (toP === 'crimson') {
      hero.x = MARS_SITES.ship.x - 68; hero.y = MARS_SITES.ship.y + 42;
    } else {
      hero.x = SITES.ship.x - 68; hero.y = SITES.ship.y + 42;
    }

    syncEntitiesFromSave();
    switchViewPlanet(toP);
    if (KV.Audio) KV.Audio.playSfx('build_done', 0.65);
    const cmdSpec = getCommanderSpec();
    showToast(toP === 'crimson'
      ? `🚀 ${cmdSpec.name} laskeutui Rahtikontin kanssa Punakivi-planeetalle!`
      : `🚀 ${cmdSpec.name} palasi Tähtialuksella Kotilaaksoon!`);
    saveGame();
    return true;
  }

  function chooseCommander(cmdId) {
    S.commanderId = (cmdId === 'teras') ? 'teras' : 'pippuri';
    S.commanderChosen = true;
    const spec = getCommanderSpec();
    hero.maxHp = spec.maxHp; hero.hp = spec.maxHp;
    hero.planet = 'valley';
    hero.x = SITES.barracks.x; hero.y = SITES.barracks.y + 62;
    world.orcRaidTimer = 110;
    checkUnlocks();
    clearReservedZones(false);
    saveGame();
    if (KV.Audio) KV.Audio.playSfx('build_done', 0.60);
    showToast(`🎖️ ${spec.name} otti komennon!`);
    if (KV.UI) { KV.UI.refreshCommanderVisuals(); KV.UI.updateHUD(); }
  }

  function syncEntitiesFromSave() {
    const spec = getCommanderSpec();
    hero.maxHp = spec.maxHp;
    hero.planet = S.shipPlanet;
    if (hero.hp > hero.maxHp) hero.hp = hero.maxHp;

    while (world.workers.length < S.workerCount) {
      const idx = world.workers.length;
      world.workers.push({
        kind: 'worker', planet: 'valley', female: (idx % 2 === 1),
        x: idx === 0 ? SITES.kitchen.x - 16 : SITES.lodge.x - 36 + (idx % 4) * 24,
        y: idx === 0 ? SITES.kitchen.y + 52 : SITES.lodge.y + 68,
        role: 'carrier', siteKey: null, slot: 0,
        step: Math.random() * 6, ang: 1.5, faceLeft: false, faceBack: false,
        moving: false, working: false, toolPhase: 0, carry: null, targetTree: null, cookTimer: 0,
        bypassId: null, bypassDir: 1, bypassLock: 0
      });
    }
    while (world.workers.length > S.workerCount) {
      const rem = world.workers.pop();
      if (rem && rem.carry) refundCarriedItem(rem.carry, 'valley');
    }

    while (world.soldiers.length < S.soldierCount) {
      const idx = world.soldiers.length;
      world.soldiers.push({
        kind: 'soldier', planet: 'valley', female: (idx % 2 === 1),
        x: SITES.barracks.x - 20 + (idx % 4) * 20, y: SITES.barracks.y + 58,
        hp: 145, maxHp: 145, fireCd: 0.5, guardPost: S.soldierPosts[idx] || null,
        step: 0, ang: 0, faceLeft: false, faceBack: false, moving: false,
        bypassId: null, bypassDir: 1, bypassLock: 0
      });
    }
    while (world.soldiers.length > S.soldierCount) world.soldiers.pop();

    while (world.marsWorkers.length < S.mars.workerCount) {
      const idx = world.marsWorkers.length;
      world.marsWorkers.push({
        kind: 'worker', planet: 'crimson', female: (idx % 2 === 0),
        x: MARS_SITES.depot.x - 20 + (idx % 4) * 22, y: MARS_SITES.depot.y + 48,
        role: 'mCarrier', siteKey: null, slot: 0,
        step: Math.random() * 6, ang: 1.5, faceLeft: false, faceBack: false,
        moving: false, working: false, toolPhase: 0, carry: null, cookTimer: 0,
        bypassId: null, bypassDir: 1, bypassLock: 0
      });
    }
    while (world.marsWorkers.length > S.mars.workerCount) {
      const rem = world.marsWorkers.pop();
      if (rem && rem.carry) refundCarriedItem(rem.carry, 'crimson');
    }

    while (world.marsSoldiers.length < S.mars.soldierCount) {
      const idx = world.marsSoldiers.length;
      world.marsSoldiers.push({
        kind: 'soldier', planet: 'crimson', female: (idx % 2 === 1),
        x: MARS_SITES.depot.x + 25 + (idx % 4) * 18, y: MARS_SITES.depot.y + 52,
        hp: 150, maxHp: 150, fireCd: 0.5, guardPost: S.mars.soldierPosts[idx] || null,
        step: 0, ang: 0, faceLeft: false, faceBack: false, moving: false,
        bypassId: null, bypassDir: 1, bypassLock: 0
      });
    }
    while (world.marsSoldiers.length > S.mars.soldierCount) world.marsSoldiers.pop();

    reassignWorkerRoles();
    reassignMarsRoles();
  }

  function checkUnlocks() {
    let u = false;
    if (!S.unlocks.sawmill && S.buildings.lodge.state === 'built') {
      S.unlocks.sawmill = true; S.unlocks.bigTurnip = true; u = true;
      clearReservedZones(false);
    }
    if (!S.unlocks.barracks && S.buildings.sawmill.state === 'built') {
      S.unlocks.barracks = true; u = true;
      clearReservedZones(false);
    }
    if (!S.unlocks.bridgeChain && S.buildings.barracks.state === 'built' && S.commanderChosen) {
      S.unlocks.bridgeChain = true; u = true;
      clearReservedZones(false);
    }
    if (!S.crimsonUnlocked && S.commanderChosen && S.everBakedBread) {
      S.crimsonUnlocked = true; u = true;
      showToast('📦 Rahtikontti aktivoitu Tähtialuksen viereen! Voit nyt lastata puuta ja muonaa Punakiven lentoa varten!');
    }
    if (S.started && S.buildings.barracks.state === 'built' && !S.commanderChosen) {
      if (KV.UI) KV.UI.openCommanderModal();
    }
    if (u) saveGame();
  }

  initWorldsNature();
  clearReservedZones(false);
  syncEntitiesFromSave();
  setInterval(saveGame, 5000);

  KV.S = S;
  KV.hero = hero;
  KV.world = world;
  KV.State = {
    getRecommendedZoom, getCommanderSpec,
    getTotalPopulation, getLivingPopulation, getMaxSustainablePop, getStewBurnPerSec,
    getMarsLivingPop, getMarsMaxPop, getMarsStewBurnPerSec,
    isOutlineVisible, switchViewPlanet, launchStarship,
    saveGame, resetSave, selectUnit, addSpeech, showToast, refundCarriedItem,
    isInsideReservedZone, clearReservedZones,
    getAssignedTotal, getFreeCarriersCount,
    reassignWorkerRoles, reassignMarsRoles,
    assignSpecificWorker, startOutlineFromMap,
    chooseCommander, syncEntitiesFromSave, checkUnlocks
  };
})();