// ============================================================================
// js/audio.js – Kierrätettävä äänipooli (estää selaimen jäätymisen & päällekkäisyydet!)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { SITES, getRiverCenter } = KV.CFG;

  // Lyhyet tehosteet: kokeilee automaattisesti .mp3, muuten käyttää valmista .wav-tiedostoa
  const SFX_NAMES = ['chop', 'hammer', 'saw', 'dig', 'bubble', 'build_done', 'born', 'coin', 'ox', 'alarm', 'frost', 'laser'];
  const pools = {};
  const lastPlayedAt = {};

  SFX_NAMES.forEach(name => {
    const channels = [];
    // Kiinteä 3 kanavan pooli per ääni -> ei koskaan ylitä Chromen mediasoitinrajaa!
    for (let i = 0; i < 3; i++) {
      const el = new Audio();
      el.preload = 'auto';
      let fellBack = false;
      el.onerror = () => {
        if (!fellBack) {
          fellBack = true;
          el.src = `audio/${name}.wav`;
        }
      };
      el.src = `audio/${name}.mp3`;
      channels.push(el);
    }
    pools[name] = { channels, idx: 0 };
    lastPlayedAt[name] = 0;
  });

  function makeLoop(fileName, baseVol) {
    const a = new Audio(`audio/${fileName}`);
    a.loop = true;
    a.preload = 'auto';
    a.volume = baseVol;
    return a;
  }

  // Viisi aitoa tunnelma- ja kävelyraitaa!
  const loops = {
    music:     makeLoop('music_loop.mp3', 0.16),
    river:     makeLoop('river_loop.mp3', 0.18),
    birds:     makeLoop('birds_loop.mp3', 0.14),
    fire:      makeLoop('fire_loop.mp3',  0.12),
    footsteps: makeLoop('footsteps.mp3',  0.22)
  };

  function playSfx(name, vol = 0.42) {
    if (!KV.S.soundOn || !pools[name]) return;
    const now = performance.now();
    // Estetään saman äänen liian tiheä päällekkäin liipaisu
    if (now - lastPlayedAt[name] < 130) return;

    const pool = pools[name];
    const firstEl = pool.channels[0];
    const isLongClip = Number.isFinite(firstEl.duration) && firstEl.duration > 1.6;

    // Jos käyttäjä on laittanut pitkän MP3-raidan (> 1.6 s), ei soiteta uutta päälle ennen kuin edellinen loppuu!
    if (isLongClip) {
      if (!firstEl.paused && !firstEl.ended) return;
      lastPlayedAt[name] = now;
      firstEl.volume = Math.max(0, Math.min(1, vol));
      firstEl.currentTime = 0;
      firstEl.play().catch(() => {});
      return;
    }

    const ch = pool.channels[pool.idx];
    pool.idx = (pool.idx + 1) % pool.channels.length;
    lastPlayedAt[name] = now;
    try {
      ch.pause();
      ch.currentTime = 0;
      ch.volume = Math.max(0, Math.min(1, vol));
      ch.play().catch(() => {});
    } catch (e) {}
  }

  function updateSpatialAudio() {
    const S = KV.S;
    if (!S.started || !S.soundOn) {
      Object.values(loops).forEach(a => { if (!a.paused) a.pause(); });
      return;
    }

    const cam = KV.cam || { x: 0, y: 0 };

    // 1. Taustamusiikki
    if (S.musicOn) {
      loops.music.volume = 0.16;
      if (loops.music.paused) loops.music.play().catch(() => {});
    } else if (!loops.music.paused) {
      loops.music.pause();
    }

    // 2. Joen solina (voimistuu kameran lähestyessä jokea)
    const distRiver = Math.abs(cam.x - getRiverCenter(cam.y));
    loops.river.volume = Math.max(0.03, Math.min(0.26, 0.26 * (1 - distRiver / 850)));
    if (loops.river.paused) loops.river.play().catch(() => {});

    // 3. Pohjoismetsän linnunlaulu (voimistuu pohjoisessa y < -150)
    const forestFactor = Math.max(0.03, Math.min(0.20, (-cam.y + 250) / 3800));
    loops.birds.volume = forestFactor;
    if (loops.birds.paused) loops.birds.play().catch(() => {});

    // 4. Kyläkeittiön padan & Leipomon kiviuunin tulen rätinä
    let minFireDist = 9999;
    if (S.buildings.kitchen.state === 'built' && S.stew > 0.1) {
      minFireDist = Math.min(minFireDist, Math.hypot(cam.x - SITES.kitchen.x, cam.y - SITES.kitchen.y));
    }
    if (S.buildings.bakery.state === 'built') {
      minFireDist = Math.min(minFireDist, Math.hypot(cam.x - SITES.bakery.x, cam.y - SITES.bakery.y));
    }
    const fireVol = Math.max(0, Math.min(0.22, 0.22 * (1 - minFireDist / 480)));
    if (fireVol > 0.015) {
      loops.fire.volume = fireVol;
      if (loops.fire.paused) loops.fire.play().catch(() => {});
    } else if (!loops.fire.paused) {
      loops.fire.pause();
    }

    // 5. Sankarin askeleet sorapolulla kävellessä
    if (KV.hero.moving) {
      loops.footsteps.volume = 0.22;
      if (loops.footsteps.paused) loops.footsteps.play().catch(() => {});
    } else if (!loops.footsteps.paused) {
      loops.footsteps.pause();
    }
  }

  KV.Audio = {
    playSfx,
    updateSpatialAudio
  };
})();
