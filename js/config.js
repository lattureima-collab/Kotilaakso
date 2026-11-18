// ============================================================================
// js/config.js – Pelin vakiot, kartan sijainnit, törmäysalueet ja kuvat (v8.1)
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

  // Rakennusten paikat + kiinteät pohja-ellipsit (rx, ry), joiden läpi hahmot eivät kävele!
  const SITES = {
    ship:          { x: -195, y: 25,   rx: 52, ry: 32, label: 'Tähtialus' },
    logPile:       { x: -295, y: -340, rx: 0,  ry: 0,  label: 'Tukkipino' },
    house1:        { x: -465, y: -135, rx: 52, ry: 35, label: 'Hirsitalo 1' },
    house2:        { x: -625, y: -25,  rx: 52, ry: 35, label: 'Hirsitalo 2' },
    house3:        { x: -535, y: 125,  rx: 52, ry: 35, label: 'Hirsitalo 3' },
    kitchen:       { x: -310, y: 185,  rx: 54, ry: 35, label: 'Kyläkeittiö' },
    starterGarden: { x: -455, y: 235,  rx: 0,  ry: 0,  label: 'Keittiön Kotitarha' },
    turnipFarm:    { x: -485, y: 400,  rx: 0,  ry: 0,  label: 'Suuri Naurispelto' },
    turnipBox:     { x: -330, y: 340,  rx: 0,  ry: 0,  label: 'Nauriskori' },
    sawmill:       { x: -55,  y: -330, rx: 60, ry: 37, label: 'Iso Lautatarha' },
    oxPen:         { x: -55,  y: -135, rx: 60, ry: 36, label: 'Härkäaitaus' },
    barracks:      { x: -255, y: -185, rx: 58, ry: 39, label: 'Kaurakaartin Kasarmi' },
    bridge:        {
      x: BRIDGE_X,
      y: BRIDGE_Y,
      rx: 0, ry: 0,
      workX: BRIDGE_X - 112,
      workY: BRIDGE_Y + 6,
      label: 'Puinen Kaarisilta'
    },
    // JOEN ITÄPUOLI (raivataan esiin itämetsästä!):
    mill:          { x: getRiverCenter(-150) + getRiverHalfWidth(-150) + 68, y: -150, rx: 52, ry: 38, label: 'Joen Vesimylly' },
    bakery:        { x: 565,  y: 50,   rx: 56, ry: 38, label: 'Kylän Leipomo' },
    oatFarm:       { x: 525,  y: 285,  rx: 0,  ry: 0,  label: 'Suuri Kaurapelto' },
    oatPile:       { x: 400,  y: 185,  rx: 0,  ry: 0,  label: 'Viljapino' }
  };

  // Tulevan v8.2-vaiheen valmiiksi mitoitetut tonttipaikat keskustassa ja länsirannalla
  const RESERVED_PLOTS = {
    bakeryShop:   { x: -75,  y: 115, label: 'Leipämyymälä (Varaus)' },
    bank:         { x: -345, y: 30,  label: 'Pankki (Varaus)' },
    catapultWest: { x: getRiverCenter(-70) - getRiverHalfWidth(-70) - 52, y: -70, label: 'Kivilinko (Varaus)' }
  };

  function getWorkPoint(key) {
    const s = SITES[key];
    if (s.workX !== undefined) return { x: s.workX, y: s.workY };
    const frontOffset = (s.ry && s.ry > 0) ? (s.ry + 16) : 34;
    return { x: s.x, y: s.y + frontOffset };
  }

  const SPEEDS = {
    HUMAN_WALK: 42,
    HUMAN_CARRY: 27,
    OX_TROT: 74,
    HERO_SPEED: 114
  };

  const WORLD_BOUNDS = {
    minX: -1020, maxX: 980,
    minY: -860,  maxY: 820
  };

  const AVATARS = [
    {
      id: 'male', sprite: 'hero_male', name: 'Kapteeni Kasper',
      bio: 'Tähtialuksen lentäjä ja kenttäjohtaja: kaataa puita, vauhdittaa rakennuksia ja avaa metsän tarvikelaatikot.',
      quote: '"Vie minut puiden tai työmaan viereen, niin tartun heti toimeen ja kannustan kyläläiset vauhtiin!"'
    },
    {
      id: 'female', sprite: 'hero_female', name: 'Komentaja Kaura-Kerttu',
      bio: 'Tofutarkka-ampuja, tähtilentäjä ja arkkitehti: tukee kylän töitä alusta asti ja johtaa puolustusta.',
      quote: '"Napauta ketä tahansa kyläläistä tai Kersantti Kipinää kartalla ja osoita suoraan minne mennään!"'
    },
    {
      id: 'robot', sprite: 'hero_robot', name: 'Botti B-12 (Vegaanirobotti)',
      bio: 'Leijuva aurinkokenno-pilotti: leikkaa tukkipuita lasersäteellä, vauhdittaa peltotöitä ja avaa tarvikelaatikot.',
      quote: '"Piip-puup! Leijuntamoottorini ei kaipaa saappaita, ja sensorini löytävät jokaisen tarvikelaatikon metsästä!"'
    }
  ];

  const STATIC_IMAGES = [
    'grass_tile', 'cabin', 'kitchen', 'sawmill', 'ox_pen', 'bridge', 'starship',
    'watermill', 'bakery', 'barracks', 'scaffolding',
    'pine_tree', 'birch_tree', 'stump', 'logs_flour',
    'field_plowed', 'field_sprouts', 'field_turnip_ripe', 'field_oat_ripe', 'field_frost',
    'river_rocks', 'river_cattails', 'fallen_log', 'flower_bush',
    'supply_crate', 'guard_flag',
    'hero_robot', 'hero_robot_back',
    'baby_worker', 'toddler_worker', 'baby_soldier', 'toddler_soldier',
    'icon_turnip', 'item_oat', 'bread_coin', 'item_log', 'item_board', 'item_flour', 'item_bread'
  ];

  const ANIMATED_BASES = [
    'char_woodcutter', 'char_farmer', 'char_builder', 'char_baker', 'char_soldier', 'char_orc',
    'char_sergeant', 'char_soldier_f', 'char_builder_f', 'char_farmer_f', 'char_woodcutter_f', 'char_baker_f',
    'hero_male', 'hero_female',
    'ox_idle', 'ox_loaded'
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
    getRiverCenter,
    getRiverHalfWidth,
    SITES,
    RESERVED_PLOTS,
    getWorkPoint,
    SPEEDS,
    WORLD_BOUNDS,
    AVATARS,
    IMAGE_NAMES
  };
})();
