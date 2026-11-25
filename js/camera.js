// ============================================================================
// js/camera.js – Kamera, nipistyszoom, punaisten ääriviivojen & rakennusten napautus (v8.2)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { WORLD_BOUNDS, SITES, BUILDING_KEYS, getWorkPoint, getRiverCenter, getRiverHalfWidth, BRIDGE_X, BRIDGE_Y } = KV.CFG;
  const MIN_ZOOM = 0.48;
  const MAX_ZOOM = 1.25;

  const cam = { x: -245, y: 25 };
  const keys = {};
  const pointers = new Map();

  let gesture = {
    downTime: 0,
    downX: 0,
    downY: 0,
    movedDist: 0,
    wasMultiTouch: false,
    prevPinchDist: 0,
    prevMidX: 0,
    prevMidY: 0
  };

  function clampCam() {
    cam.x = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, cam.x));
    cam.y = Math.max(WORLD_BOUNDS.minY, Math.min(WORLD_BOUNDS.maxY, cam.y));
  }

  function screenToWorld(sx, sy) {
    const z = KV.S.zoom || 0.75;
    return {
      x: cam.x + (sx - window.innerWidth / 2) / z,
      y: cam.y + (sy - window.innerHeight / 2) / z
    };
  }

  function setZoomAtScreenPoint(newZoom, sx, sy) {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    const before = screenToWorld(sx, sy);
    KV.S.zoom = clamped;
    cam.x = before.x - (sx - window.innerWidth / 2) / clamped;
    cam.y = before.y - (sy - window.innerHeight / 2) / clamped;
    clampCam();
    if (KV.UI) KV.UI.syncZoomButton();
  }

  function centerOnHero(activate = true) {
    if (!KV.S.commanderChosen) return;
    const cmdSpec = KV.State.getCommanderSpec();
    if (KV.S.heroMedbayTimer > 0) {
      cam.x = SITES.ship.x;
      cam.y = SITES.ship.y;
      clampCam();
      KV.State.showToast(`🏥 ${cmdSpec.name} toipuu Tähtialuksen hoitokapselissa (${Math.ceil(KV.S.heroMedbayTimer)} s)!`);
      return;
    }
    cam.x = KV.hero.x;
    cam.y = KV.hero.y - 10;
    clampCam();
    if (activate) KV.State.selectUnit(KV.hero);
  }

  function sanitizeDryPoint(wx, wy) {
    let tx = Math.max(WORLD_BOUNDS.minX + 30, Math.min(WORLD_BOUNDS.maxX - 30, wx));
    let ty = Math.max(WORLD_BOUNDS.minY + 30, Math.min(WORLD_BOUNDS.maxY - 30, wy));
    const rc = getRiverCenter(ty);
    const rw = getRiverHalfWidth(ty);
    const onBridge = KV.S.buildings.bridge.state === 'built' && Math.abs(ty - (BRIDGE_Y - 1)) < 24;
    if (!onBridge && Math.abs(tx - rc) < rw + 14) {
      tx = (tx < rc) ? (rc - rw - 20) : (rc + rw + 20);
    }
    return { x: tx, y: ty };
  }

  function findTappedUnit(wx, wy, hitRad) {
    const { S, hero, world } = KV;
    let best = null;
    let bestD = hitRad;

    const consider = (u) => {
      if (!u) return;
      const d = Math.hypot(wx - u.x, wy - (u.y - 18));
      if (d < bestD) { bestD = d; best = u; }
    };

    if (S.commanderChosen && S.heroMedbayTimer <= 0) consider(hero);
    world.soldiers.forEach(consider);
    world.workers.forEach(consider);
    return best;
  }

  function findTappedOutline(wx, wy) {
    const candidates = ['lodge', 'sawmill', 'turnipFarm', 'barracks', 'bridge', 'mill', 'bakery', 'oatFarm'];
    for (const key of candidates) {
      if (!KV.State.isOutlineVisible(key)) continue;
      const pos = SITES[key];
      const rad = key === 'bridge' ? 115 : (key.endsWith('Farm') ? 96 : 78);
      if (Math.hypot(wx - pos.x, wy - pos.y) < rad) return key;
    }
    return null;
  }

  const ROLE_NAMES_FI = {
    cookGardener: 'Kokki-Puutarhuri',
    woodcutter:   'Metsuri',
    turnipFarmer: 'Naurisviljelijä',
    oatFarmer:    'Kauraviljelijä',
    sawyer:       'Sahaaja',
    miller:       'Mylläri',
    baker:        'Leipuri',
    builder:      'Rakentaja',
    carrier:      'Vapaa kantaja'
  };

  function handleWorkerCommandTap(worker, wx, wy) {
    const { S, world } = KV;

    // 1. Jos napautetaan punaista tonttiääriviivaa työläinen valittuna -> aloitetaan ja tämä työläinen = 1 rakentaja!
    const outlineKey = findTappedOutline(wx, wy);
    if (outlineKey) {
      KV.State.startOutlineFromMap(outlineKey, worker);
      KV.State.selectUnit(null);
      return true;
    }

    // 2. Käynnissä olevat työmaat tai valmiit tuotantorakennukset
    for (const key of BUILDING_KEYS) {
      const site = SITES[key];
      const b = S.buildings[key];
      if (!b || b.state === 'none') continue;
      const hitR = key === 'bridge' ? 115 : 74;
      if (Math.hypot(wx - site.x, wy - site.y) < hitR) {
        if (b.state === 'building' || b.state === 'ruined') {
          if (KV.State.assignSpecificWorker(worker, 'builder', key)) {
            KV.Audio.playSfx('hammer', 0.32);
            KV.State.showToast(`🔨 Työläinen määrätty rakentamaan kohdetta ${site.label} (1/1)!`);
            KV.State.selectUnit(null);
          }
          return true;
        }
        if (key === 'lodge' && b.state === 'built') {
          if (KV.State.assignSpecificWorker(worker, 'carrier')) {
            KV.State.showToast('📦 Työläinen vapautettu yleiseksi kantajaksi!');
            KV.State.selectUnit(null);
          }
          return true;
        }
        if (key === 'sawmill' && b.state === 'built') {
          if (S.jobs.sawyers >= 2 && worker.role !== 'sawyer') {
            KV.State.showToast('🪚 Lautatarhalla on jo maksimimäärä (2) sahaajaa!');
            return true;
          }
          if (KV.State.assignSpecificWorker(worker, 'sawyer')) {
            KV.State.showToast('🪚 Työläinen määrätty Lautatarhan sahaajaksi!');
            KV.State.selectUnit(null);
          }
          return true;
        }
        if (key === 'kitchen' && b.state === 'built') {
          if ((S.jobs.cookGardeners || 0) >= 2 && worker.role !== 'cookGardener') {
            KV.State.showToast('🍲 Keittiöllä on jo 2 Kokki-Puutarhuria!');
            return true;
          }
          if (KV.State.assignSpecificWorker(worker, 'cookGardener')) {
            KV.State.showToast('🍲 Työläinen määrätty Kyläkeittiön Kokki-Puutarhuriksi!');
            KV.State.selectUnit(null);
          }
          return true;
        }
        if (key === 'mill' && b.state === 'built') {
          if (S.jobs.millers >= 1 && worker.role !== 'miller') {
            KV.State.showToast('⚙️ Vesimyllyssä on jo mylläri!');
            return true;
          }
          if (KV.State.assignSpecificWorker(worker, 'miller')) {
            KV.State.showToast('⚙️ Työläinen määrätty Vesimyllyn mylläriksi!');
            KV.State.selectUnit(null);
          }
          return true;
        }
        if (key === 'bakery' && b.state === 'built') {
          if (S.jobs.bakers >= 1 && worker.role !== 'baker') {
            KV.State.showToast('🥖 Leipomossa on jo leipuri!');
            return true;
          }
          if (KV.State.assignSpecificWorker(worker, 'baker')) {
            KV.State.showToast('🥖 Työläinen määrätty Leipomon leipuriksi!');
            KV.State.selectUnit(null);
          }
          return true;
        }
      }
    }

    if (Math.hypot(wx - SITES.starterGarden.x, wy - SITES.starterGarden.y) < 68) {
      if ((S.jobs.cookGardeners || 0) < 2 && KV.State.assignSpecificWorker(worker, 'cookGardener')) {
        KV.State.showToast('🍲 Työläinen määrätty Kotitarhan ja keittiön hoitajaksi!');
        KV.State.selectUnit(null);
      }
      return true;
    }
    if (S.fields.turnip.active && Math.hypot(wx - SITES.turnipFarm.x, wy - SITES.turnipFarm.y) < 92) {
      if (KV.State.assignSpecificWorker(worker, 'turnipFarmer')) {
        KV.Audio.playSfx('dig', 0.32);
        KV.State.showToast('🌱 Työläinen määrätty Suuren Naurispellon viljelijäksi!');
        KV.State.selectUnit(null);
      }
      return true;
    }
    if (S.fields.oat.active && Math.hypot(wx - SITES.oatFarm.x, wy - SITES.oatFarm.y) < 92) {
      if (KV.State.assignSpecificWorker(worker, 'oatFarmer')) {
        KV.Audio.playSfx('dig', 0.32);
        KV.State.showToast('🌾 Työläinen määrätty Suuren Kaurapellon viljelijäksi!');
        KV.State.selectUnit(null);
      }
      return true;
    }

    if (Math.hypot(wx - SITES.logPile.x, wy - SITES.logPile.y) < 62) {
      if (KV.State.assignSpecificWorker(worker, 'woodcutter')) {
        KV.State.showToast('🌲 Työläinen määrätty metsuriksi!');
        KV.State.selectUnit(null);
      }
      return true;
    }

    let nearTree = null;
    let minTD = 52;
    for (let i = 0; i < world.trees.length; i++) {
      const t = world.trees[i];
      if (t.decorative || t.regrow > 0) continue;
      const d = Math.hypot(wx - t.x, wy - (t.y - 16));
      if (d < minTD) { minTD = d; nearTree = t; }
    }
    if (nearTree) {
      if (KV.State.assignSpecificWorker(worker, 'woodcutter', null, nearTree)) {
        KV.Audio.playSfx('chop', 0.34);
        KV.State.showToast('🌲 Työläinen lähetetty kaatamaan valittua puuta!');
        KV.State.selectUnit(null);
      }
      return true;
    }

    KV.State.showToast('💡 Napauta puuta, punaista ääriviivaa, työmaata, sahaa, peltoa tai Kylätaloa!');
    return false;
  }

  function handleGuardCommandTap(unit, wx, wy) {
    const { S, world } = KV;
    let post = sanitizeDryPoint(wx, wy);
    let postName = 'valittuun vartiopaikkaan';

    for (const key of BUILDING_KEYS) {
      const s = SITES[key];
      if (Math.hypot(wx - s.x, wy - s.y) < 70) {
        const wp = getWorkPoint(key);
        post = { x: wp.x, y: wp.y + 8, label: s.label };
        postName = `kohteen ${s.label} suojaksi`;
        break;
      }
    }

    unit.guardPost = post;
    const idx = world.soldiers.indexOf(unit);
    if (idx >= 0) S.soldierPosts[idx] = post;
    KV.State.showToast(`🛡️ Kaartilainen määrätty vartioon ${postName}!`);
    world.clickRipples.push({ x: post.x, y: post.y, r: 4, a: 1.0 });
    KV.Audio.playSfx('born', 0.30);
    KV.State.saveGame();
    KV.State.selectUnit(null);
  }

  function handleDirectMapBuildingTap(wx, wy) {
    const S = KV.S;

    // 1. Punaiset tonttiääriviivat (aloittaa rakennuksen / pellon yhdellä napautuksella!)
    const outlineKey = findTappedOutline(wx, wy);
    if (outlineKey) {
      KV.State.startOutlineFromMap(outlineKey, null);
      return true;
    }

    // 2. Käynnissä oleva työmaa ilman rakentajaa -> liittää vapaan työläisen jos saatavilla
    for (const key of BUILDING_KEYS) {
      const b = S.buildings[key];
      const pos = SITES[key];
      const hitR = key === 'bridge' ? 110 : 76;
      if ((b.state === 'building' || b.state === 'ruined') && Math.hypot(wx - pos.x, wy - pos.y) < hitR) {
        if ((b.builders || 0) === 0 && KV.State.getFreeCarriersCount() > 0) {
          b.builders = 1;
          KV.State.reassignWorkerRoles();
          KV.State.saveGame();
          KV.Audio.playSfx('hammer', 0.32);
          KV.State.showToast(`🔨 Vapaa työläinen liittyi rakentamaan kohdetta ${pos.label} (1/1)!`);
        } else {
          KV.State.showToast(`🔨 ${pos.label}: valmius ${Math.round(b.prog * 100)}% (Rakentajia: ${b.builders || 0}/1).`);
        }
        return true;
      }
    }

    // 3. Valmiin Ison Kylätalon, Varuskunnan tai Tähtialuksen napautus -> avaa suoran toimintoikkunan
    if (S.buildings.lodge.state === 'built' && Math.hypot(wx - SITES.lodge.x, wy - SITES.lodge.y) < 84) {
      if (KV.UI) KV.UI.openSiteModal('lodge');
      return true;
    }
    if (S.buildings.barracks.state === 'built' && Math.hypot(wx - SITES.barracks.x, wy - SITES.barracks.y) < 76) {
      if (!S.commanderChosen) {
        if (KV.UI) KV.UI.openCommanderModal();
      } else if (KV.UI) {
        KV.UI.openSiteModal('barracks');
      }
      return true;
    }
    if (Math.hypot(wx - SITES.ship.x, wy - SITES.ship.y) < 78) {
      if (KV.UI) KV.UI.openSiteModal('ship');
      return true;
    }

    return false;
  }

  function bindInput(canvas) {
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') KV.State.selectUnit(null);
      keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => {
      for (const k of Object.keys(keys)) keys[k] = false;
      pointers.clear();
      canvas.classList.remove('dragging');
    });

    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1) {
        gesture.downTime = performance.now();
        gesture.downX = e.clientX;
        gesture.downY = e.clientY;
        gesture.movedDist = 0;
        gesture.wasMultiTouch = false;
      } else if (pointers.size === 2) {
        gesture.wasMultiTouch = true;
        const pts = Array.from(pointers.values());
        gesture.prevPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        gesture.prevMidX = (pts[0].x + pts[1].x) * 0.5;
        gesture.prevMidY = (pts[0].y + pts[1].y) * 0.5;
      }
      try { KV.Audio.updateSpatialAudio(); } catch (err) {}
    });

    canvas.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);

      if (pointers.size === 1 && !gesture.wasMultiTouch) {
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        gesture.movedDist += Math.hypot(dx, dy);
        if (gesture.movedDist > 5) {
          canvas.classList.add('dragging');
          const z = KV.S.zoom || 0.75;
          cam.x -= dx / z;
          cam.y -= dy / z;
          clampCam();
        }
      } else if (pointers.size === 2) {
        gesture.wasMultiTouch = true;
        const pts = Array.from(pointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const midX = (pts[0].x + pts[1].x) * 0.5;
        const midY = (pts[0].y + pts[1].y) * 0.5;

        const z = KV.S.zoom || 0.75;
        cam.x -= (midX - gesture.prevMidX) / z;
        cam.y -= (midY - gesture.prevMidY) / z;
        clampCam();

        if (gesture.prevPinchDist > 12 && dist > 12) {
          setZoomAtScreenPoint(z * (dist / gesture.prevPinchDist), midX, midY);
        }
        gesture.prevPinchDist = dist;
        gesture.prevMidX = midX;
        gesture.prevMidY = midY;
      }
    });

    const onPointerEnd = e => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) canvas.classList.remove('dragging');
      if (!KV.S.started) return;

      const elapsed = performance.now() - gesture.downTime;
      if (!gesture.wasMultiTouch && pointers.size === 0 && gesture.movedDist <= 9 && elapsed < 500) {
        const wPt = screenToWorld(gesture.downX, gesture.downY);
        const z = KV.S.zoom || 0.75;
        const hitRad = Math.max(30, 26 / z);
        const tappedUnit = findTappedUnit(wPt.x, wPt.y, hitRad);
        const curSel = KV.world.selectedEntity;

        if (tappedUnit) {
          if (curSel === tappedUnit) {
            KV.State.selectUnit(null);
            KV.State.showToast('Valinta poistettu.');
          } else {
            KV.State.selectUnit(tappedUnit);
            KV.Audio.playSfx('born', 0.28);
            if (tappedUnit === KV.hero) {
              const cmdSpec = KV.State.getCommanderSpec();
              KV.State.showToast(`🎖️ ${cmdSpec.name} aktivoitu! Napauta maata, työmaata, puuta tai tarvikelaatikkoa.`);
            } else if (tappedUnit.kind === 'worker') {
              const rName = ROLE_NAMES_FI[tappedUnit.role] || 'Työläinen';
              KV.State.showToast(`👷 ${rName} valittu! Osoita puuta, punaista ääriviivaa, sahaa, peltoa tai keittiötä.`);
            } else if (tappedUnit.kind === 'soldier') {
              KV.State.showToast('🛡️ Kaartilainen valittu! Napauta karttaa asettaaksesi vartiopaikan.');
            }
          }
          return;
        }

        if (!curSel) {
          handleDirectMapBuildingTap(wPt.x, wPt.y);
          return;
        }

        if (curSel === KV.hero) {
          if (!KV.S.commanderChosen || KV.S.heroMedbayTimer > 0) {
            KV.State.selectUnit(null);
            return;
          }
          // Myös Kersantti aktiivisena voi napauttaa suoraan punaista ääriviivaa rakennuksen aloittamiseksi!
          const outlineKey = findTappedOutline(wPt.x, wPt.y);
          if (outlineKey) {
            KV.State.startOutlineFromMap(outlineKey, null);
          }
          let clickedTree = null;
          for (let i = 0; i < KV.world.trees.length; i++) {
            const t = KV.world.trees[i];
            if (!t.decorative && t.regrow <= 0 && Math.hypot(wPt.x - t.x, wPt.y - (t.y - 14)) < 44) {
              clickedTree = t; break;
            }
          }
          KV.hero.targetTree = clickedTree;
          const cleanTgt = clickedTree
            ? sanitizeDryPoint(clickedTree.x - 18, clickedTree.y + 10)
            : sanitizeDryPoint(wPt.x, wPt.y);
          KV.hero.target = cleanTgt;
          KV.world.clickRipples.push({ x: cleanTgt.x, y: cleanTgt.y, r: 4, a: 1.0 });
        } else if (curSel.kind === 'worker') {
          handleWorkerCommandTap(curSel, wPt.x, wPt.y);
        } else if (curSel.kind === 'soldier') {
          handleGuardCommandTap(curSel, wPt.x, wPt.y);
        }
      }
    };

    canvas.addEventListener('pointerup', onPointerEnd);
    canvas.addEventListener('pointercancel', onPointerEnd);

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.10 : 0.90;
      setZoomAtScreenPoint((KV.S.zoom || 0.75) * factor, e.clientX, e.clientY);
    }, { passive: false });
  }

  KV.cam = cam;
  KV.keys = keys;
  KV.Camera = {
    MIN_ZOOM,
    MAX_ZOOM,
    clampCam,
    screenToWorld,
    setZoomAtScreenPoint,
    centerOnHero,
    bindInput
  };
})();