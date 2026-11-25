// ============================================================================
// js/config.js – Pelin vakiot, kartan sijainnit, komentajat ja kuvat (v8.2)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const BRIDGE_Y = 35;

  function getRiverCenter(y) {
    return 195 + Math.sin(y * 0.0024) * 62 + Math.cos(y * 0.0051) * 20;
  }

  function getRiverHalfWidth(y) {
    const bridgePinch = Math.exp(-Math.pow((y - BRIDGE_Y) / 95, 2)) * 12;
    return 76 + Math.sin(y * 0.0048 + 1.1) * 9 - bridgePinch;
  }

  const BRIDGE_X = getRiverCenter(BRIDGE_Y);

  // Aktiiviset v8.2-rakennukset (järjestyksessä)
  const BUILDING_KEYS = ['lodge', 'kitchen', 'sawmill', 'barracks', 'bridge', 'mill', 'bakery'];

  const SITES = {
    // Luoteen oma tähtialusaukio
    ship:          { x: -690, y: -430, rx: 58, ry: 36, label: 'Tähtialus' },
    // Keskustan Iso Kylätalo
    lodge:         { x: -195, y: 25,   rx: 66, ry: 42, label: 'Iso Kylätalo' },
    logPile:       { x: -295, y: -330, rx: 0,  ry: 0,  label: 'Tukkipino' },
    kitchen:       { x: -310, y: 195,  rx: 54, ry: 35, label: 'Kyläkeittiö' },
    starterGarden: { x: -460, y: 240,  rx: 0,  ry: 0,  label: 'Keittiön Kotitarha' },
    turnipFarm:    { x: -485, y: 405,  rx: 0,  ry: 0,  label: 'Suuri Naurispelto' },
    turnipBox:     { x: -330, y: 345,  rx: 0,  ry: 0,  label: 'Nauriskori' },
    sawmill:       { x: -60,  y: -320, rx: 60, ry: 37, label: 'Iso Lautatarha' },
    barracks:      { x: -45,  y: -125, rx: 58, ry: 39, label: 'Kaurakaartin Varuskunta' },
    bridge:        {
      x: BRIDGE_X,
      y: BRIDGE_Y,
      rx: 0, ry: 0,
      workX: BRIDGE_X - 116,
      workY: BRIDGE_Y - 1,
      label: 'Puinen Kaarisilta'
    },
    // Joen itäranta
    mill:          { x: getRiverCenter(-150) + getRiverHalfWidth(-150) + 68, y: -150, rx: 52, ry: 38, label: 'Joen Vesimylly' },
    bakery:        { x: 565,  y: 50,   rx: 56, ry: 38, label: 'Kylän Leipomo' },
    oatFarm:       { x: 525,  y: 285,  rx: 0,  ry: 0,  label: 'Suuri Kaurapelto' },
    oatPile:       { x: 400,  y: 185,  rx: 0,  ry: 0,  label: 'Viljapino' },

    // Piilotetut yhteensopivuuspaikat vanhalle audio.js-moduulille (eivät näy pelissä)
    oxPen:         { x: -9999, y: -9999, rx: 0, ry: 0, hidden: true, label: '' },
    house1:        { x: -9999, y: -9999, rx: 0, ry: 0, hidden: true, label: '' },
    house2:        { x: -9999, y: -9999, rx: 0, ry: 0, hidden: true, label: '' },
    house3:        { x: -9999, y: -9999, rx: 0, ry: 0, hidden: true, label: '' }
  };

  const RESERVED_PLOTS = {};

  function getWorkPoint(key) {
    const s = SITES[key];
    if (!s) return { x: 0, y: 0 };
    if (s.workX !== undefined) return { x: s.workX, y: s.workY };
    const frontOffset = (s.ry && s.ry > 0) ? (s.ry + 16) : 34;
    return { x: s.x, y: s.y + frontOffset };
  }

  const SPEEDS = {
    HUMAN_WALK: 45,
    HUMAN_CARRY: 31,
    COMMANDER_SPEED: 112
  };

  // Naurispadan menekki suoraan suhteessa hahmojen lukumäärään
  const FOOD_CFG = {
    STEW_PER_PERSON_SEC: 0.092,
    VILLAGER_GROW_COST: 8,
    GUARD_STEW_ONLY_COST: 14,
    GUARD_COIN_STEW_COST: 8
  };

  const WORLD_BOUNDS = {
    minX: -1020, maxX: 980,
    minY: -860,  maxY: 820
  };

  // Varuskunnasta avautuvat kaksi kersanttia (molemmilla kersantin natsat rintamuksessa)
  const COMMANDERS = {
    pippuri: {
      id: 'pippuri',
      name: 'Kersantti Pippuri',
      shortName: 'Kers. Pippuri',
      sprite: 'char_sergeant',
      maxHp: 230,
      dmg: 24,
      fireCd: 0.27,
      auraBoost: 1.30
    },
    teras: {
      id: 'teras',
      name: 'Kersantti Teräs',
      shortName: 'Kers. Teräs',
      sprite: 'hero_male',
      maxHp: 300,
      dmg: 34,
      fireCd: 0.37,
      auraBoost: 1.22
    }
  };

  const STATIC_IMAGES = [
    'grass_tile', 'cabin', 'kitchen', 'sawmill', 'bridge', 'starship',
    'watermill', 'bakery', 'barracks', 'scaffolding',
    'pine_tree', 'birch_tree', 'stump', 'logs_flour',
    'field_plowed', 'field_sprouts', 'field_turnip_ripe', 'field_oat_ripe', 'field_frost',
    'river_rocks', 'river_cattails', 'fallen_log', 'flower_bush',
    'supply_crate', 'guard_flag',
    'baby_worker', 'toddler_worker', 'baby_soldier', 'toddler_soldier',
    'icon_turnip', 'item_oat', 'bread_coin', 'item_log', 'item_board', 'item_flour', 'item_bread'
  ];

  const ANIMATED_BASES = [
    'char_woodcutter', 'char_farmer', 'char_builder', 'char_baker', 'char_soldier', 'char_orc',
    'char_sergeant', 'char_soldier_f', 'char_builder_f', 'char_farmer_f', 'char_woodcutter_f', 'char_baker_f',
    'hero_male', 'hero_female'
  ];

  const IMAGE_NAMES = [...STATIC_IMAGES];
  ANIMATED_BASES.forEach(base => {
    ['', '_back'].forEach(dir => {
      IMAGE_NAMES.push(`${base}${dir}`);
      IMAGE_NAMES.push(`${base}${dir}_w1`);
      IMAGE_NAMES.push(`${base}${dir}_w2`);
    });
  });

  KV.CFG = {
    BRIDGE_X,
    BRIDGE_Y,
    BUILDING_KEYS,
    getRiverCenter,
    getRiverHalfWidth,
    SITES,
    RESERVED_PLOTS,
    getWorkPoint,
    SPEEDS,
    FOOD_CFG,
    WORLD_BOUNDS,
    COMMANDERS,
    IMAGE_NAMES
  };
})();