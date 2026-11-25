// ============================================================================
// js/state.js – Pelitila, Iso Kylätalo, ruokaraja, tonttiääriviivat & yksiköt (v8.2)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { SITES, BUILDING_KEYS, COMMANDERS, FOOD_CFG, getRiverCenter, getRiverHalfWidth, BRIDGE_X, BRIDGE_Y } = KV.CFG;
  const SAVE_KEY = 'vegan_space_v8_2';

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
    commanderChosen: false,
    commanderId: 'pippuri',
    heroMedbayTimer: 0,
    coins: 0,
    totalCoinsEarned: 0,
    breads: 0,
    stew: 34,
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
      kitchen:  { state: 'built', builders: 0, prog: 1, logsIn: 4, logsNeed: 4, boardsIn: 0, boardsNeed: 0, hp: 240, maxHp: 240 },
      sawmill:  { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 6, boardsIn: 0, boardsNeed: 0, rawLogs: 0, outBoards: 0, workProg: 0, hp: 220, maxHp: 220 },
      barracks: { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 6, boardsIn: 0, boardsNeed: 6, trainQueued: false, trainProg: 0, hp: 320, maxHp: 320 },
      bridge:   { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 6, boardsIn: 0, boardsNeed: 6, hp: 280, maxHp: 280 },
      mill:     { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 5, boardsIn: 0, boardsNeed: 7, rawOats: 0, outFlour: 0, workProg: 0, hp: 220, maxHp: 220 },
      bakery:   { state: 'none',  builders: 0, prog: 0, logsIn: 0, logsNeed: 6, boardsIn: 0, boardsNeed: 8, rawFlour: 0, outBreads: 0, workProg: 0, hp: 220, maxHp: 220 },
      // Piilotetut tyngät audio.js-yhteensopivuutta varten
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
    soldierPosts: []
  };

  let loaded = null;
  try { loaded = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { loaded = null; }

  const S = (loaded && loaded.buildings && loaded.buildings.lodge && loaded.fields)
    ? loaded
    : JSON.parse(JSON.stringify(defaultState));

  if (!S.zoom || !Number.isFinite(S.zoom)) S.zoom = getRecommendedZoom();
  if (!S.cratesOpened) S.cratesOpened = {};
  if (!Array.isArray(S.soldierPosts)) S.soldierPosts = [];
  if (typeof S.heroMedbayTimer !== 'number') S.heroMedbayTimer = 0;
  if (typeof S.totalCoinsEarned !== 'number') S.totalCoinsEarned = S.coins || 0;
  // Varmistetaan audio.js-yhteensopivuus myös ladatussa tallennuksessa
  ['oxPen', 'house1', 'house2', 'house3'].forEach(k => {
    if (!S.buildings[k]) S.buildings[k] = { state: 'none', builders: 0 };
  });

  function saveGame() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  function resetSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  }

  function getCommanderSpec() {
    return COMMANDERS[S.commanderId] || COMMANDERS.pippuri;
  }

  const initCmd = getCommanderSpec();
  const hero = {
    kind: 'hero',
    x: SITES.barracks.x,
    y: SITES.barracks.y + 62,
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
    hp: initCmd.maxHp,
    maxHp: initCmd.maxHp,
    fireCd: 0,
    bypassId: null,
    bypassDir: 1,
    bypassLock: 0
  };

  const world = {
    selectedEntity: null,
    trees: [],
    supplyCrates: [],
    forestProps: [],
    meadowFlora: [],
    riverBankProps: [],
    workers: [],
    oxen: [], // pidetään tyhjänä taulukkona audio.js:ää varten
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
    orcRaidTimer: 115
  };

  // Väestön ja Naurispadan kantokyvyn laskenta
  function getTotalPopulation() {
    const trainReserve = S.buildings.barracks.trainQueued ? 1 : 0;
    const growReserve = S.buildings.lodge.growing ? 1 : 0;
    return S.workerCount + S.soldierCount + (S.commanderChosen ? 1 : 0) + trainReserve + growReserve;
  }

  function getLivingPopulation() {
    return S.workerCount + S.soldierCount + (S.commanderChosen ? 1 : 0);
  }

  function getMaxSustainablePop() {
    let cap = 0;
    if ((S.jobs.cookGardeners || 0) >= 1) cap += 6;
    if ((S.jobs.cookGardeners || 0) >= 2) cap += 2;
    if (S.fields.turnip.active && (S.jobs.turnipFarmers || 0) >= 1) cap += 4;
    if (S.fields.turnip.active && (S.jobs.turnipFarmers || 0) >= 2) cap += 3;
    return Math.max(4, Math.min(16, cap));
  }

  function getStewBurnPerSec() {
    return getLivingPopulation() * FOOD_CFG.STEW_PER_PERSON_SEC;
  }

  // Kertoo näkyykö rakennus tai pelto punaisena ääriviivana kartalla juuri nyt
  function isOutlineVisible(key) {
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
    if (unit === hero && !S.commanderChosen) return;
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
    const lx = SITES.lodge.x, ly = SITES.lodge.y + 28;
    // Tähtialuksen luoteisaukio + polku kylään
    if (Math.hypot(x - SITES.ship.x, y - SITES.ship.y) < 118) return true;
    if (distToTrailCurve(x, y, SITES.ship.x + 25, SITES.ship.y + 30, -470, -240, lx, ly) < 46) return true;

    // Keskustan Iso Kylätalo, Kyläkeittiö, Kotitarha ja Tukkipino
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
    const westBridgeMouth = BRIDGE_X - 134;
    const eastBridgeMouth = BRIDGE_X + 134;

    // Raivataan tontit heti kun rakennus TAI sen punainen ääriviiva on näkyvissä, jotta ääriviiva erottuu selvästi!
    for (const key of BUILDING_KEYS) {
      const b = S.buildings[key];
      if (b.state !== 'none' || isOutlineVisible(key)) {
        const pos = SITES[key];
        const rad = key === 'bridge' ? 96 : (key === 'lodge' ? 120 : 104);
        if (Math.hypot(x - pos.x, y - pos.y) < rad) return true;
      }
    }

    if (S.fields.turnip.active || isOutlineVisible('turnipFarm')) {
      if (Math.hypot((x - SITES.turnipFarm.x) / 1.35, y - SITES.turnipFarm.y) < 104) return true;
      if (Math.hypot(x - SITES.turnipBox.x, y - SITES.turnipBox.y) < 60) return true;
      if (distToTrailCurve(x, y, SITES.kitchen.x, SITES.kitchen.y + 32, -335, 275, SITES.turnipBox.x, SITES.turnipBox.y + 6) < 48) return true;
    }

    if (S.fields.oat.active || isOutlineVisible('oatFarm')) {
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
      { id: 'w',  x: -765, y: -115, reward: 'boards', qty: 4,  msg: '📦 Tarvikelaatikko avattu: +4 valmista lautaa (🪵)!' },
      { id: 'sw', x: -740, y: 310,  reward: 'stew',   qty: 16, msg: '📦 Muonalaatikko avattu: +16 annosta Naurispataa (🍲)!' },
      { id: 'n',  x: -155, y: -590, reward: 'coins',  qty: 1,  msg: '📦 Tähtilaatikko avattu: +1 Space Coin (🪙)!' },
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
        if (world.supplyCrates.some(cr => Math.hypot(tx - cr.x, ty - cr.y) < 44)) continue;

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

  // Jokaisessa rakennuskohteessa saa olla AINA KORKEINTAAN 1 rakentaja!
  function getActiveBuilderSum() {
    let sum = 0;
    for (const key of BUILDING_KEYS) {
      const b = S.buildings[key];
      if (b.state === 'building' || b.state === 'ruined') {
        b.builders = Math.max(0, Math.min(1, b.builders || 0));
        sum += b.builders;
      } else {
        b.builders = 0;
      }
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
      for (const key of BUILDING_KEYS) {
        const b = S.buildings[key];
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

    for (const key of BUILDING_KEYS) {
      const b = S.buildings[key];
      if ((b.state === 'building' || b.state === 'ruined') && b.builders > 0) {
        roleList.push({ role: 'builder', siteKey: key, slot: 0 });
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

    // Jos kohteessa on jo 1 rakentaja, ei lisätä toista!
    if (newRole === 'builder' && newSiteKey && S.buildings[newSiteKey]) {
      if ((S.buildings[newSiteKey].builders || 0) >= 1 && !(worker.role === 'builder' && worker.siteKey === newSiteKey)) {
        showToast('🔨 Tällä työmaalla on jo 1 rakentaja (max 1 rakentaja / kohde)!');
        return false;
      }
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
      S.buildings[worker.siteKey].builders = 0;
    } else if (roleToJobKey[worker.role]) {
      const jk = roleToJobKey[worker.role];
      S.jobs[jk] = Math.max(0, (S.jobs[jk] || 1) - 1);
    }

    if (newRole === 'builder' && newSiteKey && S.buildings[newSiteKey]) {
      S.buildings[newSiteKey].builders = 1;
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

  // Käynnistää rakennuksen tai pellon suoraan kartan punaisesta ääriviivasta (aina max 1 rakentaja)
  function startOutlineFromMap(key, preferredWorker = null) {
    if (key === 'turnipFarm' || key === 'oatFarm') {
      const isOat = (key === 'oatFarm');
      const f = isOat ? S.fields.oat : S.fields.turnip;
      if (f.active) return false;
      f.active = true;
      f.stage = 1;
      f.prog = 0;
      clearReservedZones(true);
      if (KV.Audio) KV.Audio.playSfx('dig', 0.38);

      const farmerRole = isOat ? 'oatFarmer' : 'turnipFarmer';
      const jobKey = isOat ? 'oatFarmers' : 'turnipFarmers';
      if (preferredWorker) {
        assignSpecificWorker(preferredWorker, farmerRole);
      } else if (getFreeCarriersCount() > 0) {
        S.jobs[jobKey] = 1;
        reassignWorkerRoles();
      } else if ((S.jobs.woodcutters || 0) > 1) {
        S.jobs.woodcutters--;
        S.jobs[jobKey] = 1;
        reassignWorkerRoles();
      }
      showToast(`🌱 ${isOat ? 'Suuri Kaurapelto' : 'Suuri Naurispelto'} avattu viljelyyn!`);
      saveGame();
      if (KV.UI) KV.UI.updateHUD();
      return true;
    }

    const b = S.buildings[key];
    if (!b || b.state !== 'none') return false;

    b.state = 'building';
    b.builders = 0;
    clearReservedZones(true);
    if (KV.Audio) KV.Audio.playSfx('chop', 0.38);

    if (preferredWorker) {
      if (!assignSpecificWorker(preferredWorker, 'builder', key)) {
        reassignWorkerRoles();
      }
    } else if (getFreeCarriersCount() > 0) {
      b.builders = 1;
      reassignWorkerRoles();
    } else if ((S.jobs.woodcutters || 0) > 1) {
      S.jobs.woodcutters--;
      b.builders = 1;
      reassignWorkerRoles();
    }

    if (b.builders === 1) {
      showToast(`🔨 ${SITES[key].label} aloitettu! 1 rakentaja siirtyy työmaalle.`);
    } else {
      showToast(`🔨 ${SITES[key].label} tilattu! Napauta työläistä ja työmaata määrätäksesi rakentajan.`);
    }
    saveGame();
    if (KV.UI) KV.UI.updateHUD();
    return true;
  }

  function chooseCommander(cmdId) {
    S.commanderId = (cmdId === 'teras') ? 'teras' : 'pippuri';
    S.commanderChosen = true;
    const spec = getCommanderSpec();
    hero.maxHp = spec.maxHp;
    hero.hp = spec.maxHp;
    hero.x = SITES.barracks.x;
    hero.y = SITES.barracks.y + 62;
    hero.target = null;
    hero.targetTree = null;
    world.orcRaidTimer = 115;

    checkUnlocks();
    clearReservedZones(false);
    saveGame();
    if (KV.Audio) KV.Audio.playSfx('build_done', 0.60);
    showToast(`🎖️ ${spec.name} otti komennon! Puinen Kaarisilta avautui ja örkkivaroitus on aktiivinen!`);
    if (KV.UI) {
      KV.UI.refreshCommanderVisuals();
      KV.UI.updateHUD();
    }
  }

  function syncEntitiesFromSave() {
    const spec = getCommanderSpec();
    hero.maxHp = spec.maxHp;
    if (hero.hp > hero.maxHp) hero.hp = hero.maxHp;

    while (world.workers.length < S.workerCount) {
      const idx = world.workers.length;
      const isFirstCook = idx === 0;
      world.workers.push({
        kind: 'worker',
        female: (idx % 2 === 1),
        x: isFirstCook ? SITES.kitchen.x - 16 : SITES.lodge.x - 36 + (idx % 4) * 24,
        y: isFirstCook ? SITES.kitchen.y + 52 : SITES.lodge.y + 68 + Math.floor(idx / 4) * 18,
        role: 'carrier', siteKey: null, slot: 0,
        step: Math.random() * 6, ang: Math.PI * 0.5,
        faceLeft: false, faceBack: false,
        moving: false, working: false, toolPhase: 0,
        carry: null, targetTree: null, cookTimer: 0,
        bypassId: null, bypassDir: 1, bypassLock: 0
      });
    }
    while (world.workers.length > S.workerCount) world.workers.pop();

    while (world.soldiers.length < S.soldierCount) {
      const idx = world.soldiers.length;
      const savedPost = S.soldierPosts[idx] || null;
      world.soldiers.push({
        kind: 'soldier',
        female: (idx % 2 === 1),
        x: SITES.barracks.x - 20 + idx * 22,
        y: SITES.barracks.y + 58,
        hp: 140, maxHp: 140, fireCd: 0.5,
        guardPost: savedPost,
        step: 0, ang: 0, faceLeft: false, faceBack: false, moving: false,
        bypassId: null, bypassDir: 1, bypassLock: 0
      });
    }
    while (world.soldiers.length > S.soldierCount) world.soldiers.pop();

    reassignWorkerRoles();
  }

  function checkUnlocks() {
    let u = false;
    if (!S.unlocks.sawmill && S.buildings.lodge.state === 'built') {
      S.unlocks.sawmill = true;
      S.unlocks.bigTurnip = true;
      u = true;
      clearReservedZones(false);
      showToast('🪚 Iso Lautatarha & Suuri Naurispelto ilmestyivät punaisina ääriviivoina kartalle!');
    }
    if (!S.unlocks.barracks && S.buildings.sawmill.state === 'built') {
      S.unlocks.barracks = true;
      u = true;
      clearReservedZones(false);
      showToast('🥋 Kaurakaartin Varuskunta ilmestyi kartalle! Rakenna se saadaksesi komentajan!');
    }
    if (!S.unlocks.bridgeChain && S.buildings.barracks.state === 'built' && S.commanderChosen) {
      S.unlocks.bridgeChain = true;
      u = true;
      clearReservedZones(false);
    }

    // Jos Varuskunta on valmis mutta komentajaa ei ole vielä valittu, avataan valintaikkuna!
    if (S.started && S.buildings.barracks.state === 'built' && !S.commanderChosen) {
      if (KV.UI) KV.UI.openCommanderModal();
    }

    if (u) {
      if (KV.Audio) KV.Audio.playSfx('build_done', 0.5);
      saveGame();
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
    getCommanderSpec,
    getTotalPopulation,
    getLivingPopulation,
    getMaxSustainablePop,
    getStewBurnPerSec,
    isOutlineVisible,
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
    startOutlineFromMap,
    chooseCommander,
    syncEntitiesFromSave,
    checkUnlocks
  };
})();