// ============================================================================
// js/camera.js – Kamera, PC-oikeaklikkaus & Tähtialuksen varma klikkaus (v8.4)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { WORLD_BOUNDS, SITES, MARS_SITES, BUILDING_KEYS, MARS_BUILDING_KEYS, getRiverCenter, getRiverHalfWidth, BRIDGE_Y } = KV.CFG;
  const MIN_ZOOM = 0.48, MAX_ZOOM = 1.25;

  const cam = { x: -245, y: 25 };
  const planetCams = {
    valley:  { x: -245, y: 25 },
    crimson: { x: -340, y: 20 }
  };
  const keys = {};
  const pointers = new Map();

  let gesture = { downTime: 0, downX: 0, downY: 0, movedDist: 0, wasMultiTouch: false, prevPinchDist: 0, prevMidX: 0, prevMidY: 0 };

  function clampCam() {
    cam.x = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, cam.x));
    cam.y = Math.max(WORLD_BOUNDS.minY, Math.min(WORLD_BOUNDS.maxY, cam.y));
  }

  function savePlanetCam(p) {
    planetCams[p] = { x: cam.x, y: cam.y };
  }

  function restorePlanetCam(p) {
    const saved = planetCams[p] || { x: -245, y: 25 };
    cam.x = saved.x; cam.y = saved.y;
    clampCam();
  }

  function screenToWorld(sx, sy) {
    const z = KV.S.zoom || 0.75;
    return { x: cam.x + (sx - window.innerWidth / 2) / z, y: cam.y + (sy - window.innerHeight / 2) / z };
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
    const S = KV.S;
    if (!S.commanderChosen) return;
    if (S.viewPlanet !== S.shipPlanet) KV.State.switchViewPlanet(S.shipPlanet);
    const shipPos = S.shipPlanet === 'crimson' ? MARS_SITES.ship : SITES.ship;
    if (S.heroMedbayTimer > 0) {
      cam.x = shipPos.x; cam.y = shipPos.y; clampCam();
      return;
    }
    cam.x = KV.hero.x; cam.y = KV.hero.y - 10; clampCam();
    if (activate) KV.State.selectUnit(KV.hero);
  }

  function sanitizeDryPoint(wx, wy, planet = 'valley') {
    let tx = Math.max(WORLD_BOUNDS.minX + 30, Math.min(WORLD_BOUNDS.maxX - 30, wx));
    let ty = Math.max(WORLD_BOUNDS.minY + 30, Math.min(WORLD_BOUNDS.maxY - 30, wy));
    if (planet === 'valley') {
      const rc = getRiverCenter(ty), rw = getRiverHalfWidth(ty);
      const onBridge = KV.S.buildings.bridge.state === 'built' && Math.abs(ty - (BRIDGE_Y - 1)) < 24;
      if (!onBridge && Math.abs(tx - rc) < rw + 14) tx = (tx < rc) ? (rc - rw - 20) : (rc + rw + 20);
    }
    return { x: tx, y: ty };
  }

  function findTappedUnit(wx, wy, hitRad) {
    const { S, hero, world } = KV;
    let best = null, bestD = hitRad;
    const consider = (u) => {
      if (!u) return;
      const d = Math.hypot(wx - u.x, wy - (u.y - 18));
      if (d < bestD) { bestD = d; best = u; }
    };
    if (S.commanderChosen && S.heroMedbayTimer <= 0 && S.shipPlanet === S.viewPlanet) consider(hero);
    if (S.viewPlanet === 'crimson') {
      world.marsSoldiers.forEach(consider);
      world.marsWorkers.forEach(consider);
    } else {
      world.soldiers.forEach(consider);
      world.workers.forEach(consider);
    }
    return best;
  }

  function findTappedOutline(wx, wy, planet) {
    const list = planet === 'crimson'
      ? ['mKitchen', 'mTurnipFarm', 'mBunker', 'starMine']
      : ['lodge', 'sawmill', 'turnipFarm', 'barracks', 'bridge', 'mill', 'bakery', 'oatFarm'];
    const table = planet === 'crimson' ? MARS_SITES : SITES;
    for (const key of list) {
      if (!KV.State.isOutlineVisible(key, planet)) continue;
      const pos = table[key];
      const rad = key === 'bridge' ? 115 : (key.includes('Farm') ? 98 : 80);
      if (Math.hypot(wx - pos.x, wy - pos.y) < rad) return key;
    }
    return null;
  }

  function isTapOnStarship(wx, wy, planet) {
    if (KV.S.shipPlanet !== planet) return false;
    const shipSite = planet === 'crimson' ? MARS_SITES.ship : SITES.ship;
    return Math.abs(wx - shipSite.x) < 72 && wy >= (shipSite.y - 48) && wy <= (shipSite.y + 60);
  }

  function isTapOnCargoPod(wx, wy, planet) {
    if (planet !== 'valley' || !KV.S.crimsonUnlocked || KV.S.shipPlanet !== 'valley') return false;
    return Math.abs(wx - SITES.cargoPod.x) < 58 && Math.abs(wy - SITES.cargoPod.y) < 46;
  }

  function handleWorkerCommandTap(worker, wx, wy) {
    const { S, world } = KV;
    const p = S.viewPlanet;

    const outlineKey = findTappedOutline(wx, wy, p);
    if (outlineKey) {
      KV.State.startOutlineFromMap(outlineKey, worker, p);
      KV.State.selectUnit(null);
      return true;
    }

    if (p === 'crimson') {
      const M = S.mars;
      for (const k of MARS_BUILDING_KEYS) {
        const ms = MARS_SITES[k], mb = M.buildings[k];
        if (!mb || mb.state === 'none') continue;
        if (Math.hypot(wx - ms.x, wy - ms.y) < 76) {
          if (mb.state === 'building' || mb.state === 'ruined') {
            if (KV.State.assignSpecificWorker(worker, 'mBuilder', k)) { KV.State.showToast(`🔨 Työläinen määrätty rakentamaan kohdetta ${ms.label}!`); KV.State.selectUnit(null); }
          } else if (k === 'mKitchen' && KV.State.assignSpecificWorker(worker, 'mCook')) {
            KV.State.showToast('🍲 Työläinen määrätty Kenttäkeittiön kokiksi!'); KV.State.selectUnit(null);
          } else if (k === 'starMine' && KV.State.assignSpecificWorker(worker, 'mMiner')) {
            KV.State.showToast('💎 Työläinen määrätty Tähtimalmin louhijaksi!'); KV.State.selectUnit(null);
          }
          return true;
        }
      }
      if (M.field.active && Math.hypot(wx - MARS_SITES.mTurnipFarm.x, wy - MARS_SITES.mTurnipFarm.y) < 95) {
        if (KV.State.assignSpecificWorker(worker, 'mFarmer')) { KV.State.showToast('🌱 Työläinen määrätty Kraatterin Naurismaalle!'); KV.State.selectUnit(null); }
        return true;
      }
      if (Math.hypot(wx - MARS_SITES.depot.x, wy - MARS_SITES.depot.y) < 70) {
        KV.State.assignSpecificWorker(worker, 'mCarrier'); KV.State.showToast('📦 Vapautettu kantajaksi!'); KV.State.selectUnit(null);
        return true;
      }
      return false;
    }

    for (const key of BUILDING_KEYS) {
      const site = SITES[key], b = S.buildings[key];
      if (!b || b.state === 'none') continue;
      if (Math.hypot(wx - site.x, wy - site.y) < (key === 'bridge' ? 115 : 74)) {
        if (b.state === 'building' || b.state === 'ruined') {
          if (KV.State.assignSpecificWorker(worker, 'builder', key)) { KV.State.showToast(`🔨 Työläinen määrätty kohteeseen ${site.label} (1/1)!`); KV.State.selectUnit(null); }
          return true;
        }
        if (key === 'lodge' && KV.State.assignSpecificWorker(worker, 'carrier')) { KV.State.showToast('📦 Vapautettu kantajaksi!'); KV.State.selectUnit(null); return true; }
        if (key === 'sawmill' && S.jobs.sawyers < 2 && KV.State.assignSpecificWorker(worker, 'sawyer')) { KV.State.showToast('🪚 Määrätty sahaajaksi!'); KV.State.selectUnit(null); return true; }
        if (key === 'kitchen' && S.jobs.cookGardeners < 2 && KV.State.assignSpecificWorker(worker, 'cookGardener')) { KV.State.showToast('🍲 Määrätty keittiölle!'); KV.State.selectUnit(null); return true; }
        if (key === 'mill' && S.jobs.millers < 1 && KV.State.assignSpecificWorker(worker, 'miller')) { KV.State.showToast('⚙️ Määrätty mylläriksi!'); KV.State.selectUnit(null); return true; }
        if (key === 'bakery' && S.jobs.bakers < 1 && KV.State.assignSpecificWorker(worker, 'baker')) { KV.State.showToast('🥖 Määrätty leipuriksi!'); KV.State.selectUnit(null); return true; }
      }
    }

    if (S.fields.turnip.active && Math.hypot(wx - SITES.turnipFarm.x, wy - SITES.turnipFarm.y) < 92) {
      if (KV.State.assignSpecificWorker(worker, 'turnipFarmer')) { KV.State.showToast('🌱 Määrätty Suurelle Naurispellolle!'); KV.State.selectUnit(null); }
      return true;
    }
    if (S.fields.oat.active && Math.hypot(wx - SITES.oatFarm.x, wy - SITES.oatFarm.y) < 92) {
      if (KV.State.assignSpecificWorker(worker, 'oatFarmer')) { KV.State.showToast('🌾 Määrätty Kaurapellolle!'); KV.State.selectUnit(null); }
      return true;
    }

    let nearTree = null, minTD = 52;
    for (let i = 0; i < world.trees.length; i++) {
      const t = world.trees[i];
      if (!t.decorative && t.regrow <= 0) {
        const d = Math.hypot(wx - t.x, wy - (t.y - 16));
        if (d < minTD) { minTD = d; nearTree = t; }
      }
    }
    if (nearTree && KV.State.assignSpecificWorker(worker, 'woodcutter', null, nearTree)) {
      KV.Audio.playSfx('chop', 0.34); KV.State.showToast('🌲 Lähetetty kaatamaan puuta!'); KV.State.selectUnit(null);
      return true;
    }
    return false;
  }

  function handleGuardCommandTap(unit, wx, wy) {
    const { S, world } = KV;
    const p = S.viewPlanet;
    const post = sanitizeDryPoint(wx, wy, p);
    unit.guardPost = post;
    if (p === 'crimson') {
      const idx = world.marsSoldiers.indexOf(unit);
      if (idx >= 0) S.mars.soldierPosts[idx] = post;
    } else {
      const idx = world.soldiers.indexOf(unit);
      if (idx >= 0) S.soldierPosts[idx] = post;
    }
    KV.State.showToast('🛡️ Kaartilainen siirtyy uuteen vartiopaikkaan!');
    world.clickRipples.push({ x: post.x, y: post.y, r: 4, a: 1.0 });
    KV.State.saveGame();
    KV.State.selectUnit(null);
  }

  function handleDirectBuildingOrPadTap(wx, wy) {
    const S = KV.S, p = S.viewPlanet;

    if (isTapOnStarship(wx, wy, p)) {
      KV.UI.openSiteModal('ship');
      return true;
    }
    if (isTapOnCargoPod(wx, wy, p)) {
      KV.UI.openSiteModal('cargoPod');
      return true;
    }

    const outlineKey = findTappedOutline(wx, wy, p);
    if (outlineKey) {
      KV.State.startOutlineFromMap(outlineKey, null, p);
      return true;
    }

    if (p === 'crimson') {
      for (const k of MARS_BUILDING_KEYS) {
        const mb = S.mars.buildings[k], ms = MARS_SITES[k];
        if ((mb.state === 'building' || mb.state === 'ruined') && Math.hypot(wx - ms.x, wy - ms.y) < 76) {
          if ((mb.builders || 0) === 0 && KV.State.getFreeCarriersCount('crimson') > 0) {
            mb.builders = 1; KV.State.reassignMarsRoles(); KV.State.saveGame();
            KV.State.showToast(`🔨 Rakentaja liittyi kohteeseen ${ms.label} (1/1)!`);
          } else {
            KV.State.showToast(`🔨 ${ms.label}: ${Math.round(mb.prog * 100)}% (🌲${mb.logsIn}/${mb.logsNeed} 🪵${mb.boardsIn}/${mb.boardsNeed})`);
          }
          return true;
        }
      }
      return false;
    }

    for (const key of BUILDING_KEYS) {
      const b = S.buildings[key], pos = SITES[key];
      if ((b.state === 'building' || b.state === 'ruined') && Math.hypot(wx - pos.x, wy - pos.y) < (key === 'bridge' ? 110 : 76)) {
        if ((b.builders || 0) === 0 && KV.State.getFreeCarriersCount('valley') > 0) {
          b.builders = 1; KV.State.reassignWorkerRoles(); KV.State.saveGame();
          KV.Audio.playSfx('hammer', 0.32);
          KV.State.showToast(`🛠️ Työläinen määrätty kohteeseen ${pos.label} (1/1)!`);
        } else {
          KV.State.showToast(`🔨 ${pos.label}: valmius ${Math.round(b.prog * 100)}% (Rakentajia: ${b.builders || 0}/1).`);
        }
        return true;
      }
    }

    if (S.buildings.lodge.state === 'built' && Math.hypot(wx - SITES.lodge.x, wy - SITES.lodge.y) < 84) {
      KV.UI.openSiteModal('lodge');
      return true;
    }
    if (S.buildings.barracks.state === 'built' && Math.hypot(wx - SITES.barracks.x, wy - SITES.barracks.y) < 76) {
      if (!S.commanderChosen) KV.UI.openCommanderModal();
      else KV.UI.openSiteModal('barracks');
      return true;
    }
    return false;
  }

  function bindInput(canvas) {
    // PC: estetään selaimen kontekstivalikko ja vapautetaan valinta hiiren oikealla napilla!
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') KV.State.selectUnit(null);
      keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => {
      for (const k of Object.keys(keys)) keys[k] = false;
      pointers.clear(); canvas.classList.remove('dragging');
    });

    canvas.addEventListener('pointerdown', e => {
      if (e.button === 2) {
        if (KV.world.selectedEntity) {
          KV.State.selectUnit(null);
          KV.State.showToast('Valinta poistettu.');
        }
        return;
      }

      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        gesture.downTime = performance.now(); gesture.downX = e.clientX; gesture.downY = e.clientY;
        gesture.movedDist = 0; gesture.wasMultiTouch = false;
      } else if (pointers.size === 2) {
        gesture.wasMultiTouch = true;
        const pts = Array.from(pointers.values());
        gesture.prevPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        gesture.prevMidX = (pts[0].x + pts[1].x) * 0.5; gesture.prevMidY = (pts[0].y + pts[1].y) * 0.5;
      }
      try { KV.Audio.updateSpatialAudio(); } catch (err) {}
    });

    canvas.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId), cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);
      if (pointers.size === 1 && !gesture.wasMultiTouch) {
        const dx = cur.x - prev.x, dy = cur.y - prev.y;
        gesture.movedDist += Math.hypot(dx, dy);
        if (gesture.movedDist > 5) {
          canvas.classList.add('dragging');
          const z = KV.S.zoom || 0.75;
          cam.x -= dx / z; cam.y -= dy / z; clampCam();
        }
      } else if (pointers.size === 2) {
        gesture.wasMultiTouch = true;
        const pts = Array.from(pointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const midX = (pts[0].x + pts[1].x) * 0.5, midY = (pts[0].y + pts[1].y) * 0.5;
        const z = KV.S.zoom || 0.75;
        cam.x -= (midX - gesture.prevMidX) / z; cam.y -= (midY - gesture.prevMidY) / z; clampCam();
        if (gesture.prevPinchDist > 12 && dist > 12) setZoomAtScreenPoint(z * (dist / gesture.prevPinchDist), midX, midY);
        gesture.prevPinchDist = dist; gesture.prevMidX = midX; gesture.prevMidY = midY;
      }
    });

    const onPointerEnd = e => {
      if (e.button === 2) return;
      pointers.delete(e.pointerId);
      if (pointers.size === 0) canvas.classList.remove('dragging');
      if (!KV.S.started || KV.world.flightAnim) return;

      const elapsed = performance.now() - gesture.downTime;
      if (!gesture.wasMultiTouch && pointers.size === 0 && gesture.movedDist <= 9 && elapsed < 500) {
        const wPt = screenToWorld(gesture.downX, gesture.downY);
        const z = KV.S.zoom || 0.75;
        const p = KV.S.viewPlanet;

        // Tähtialus ja Rahtikontti aukeavat aina yhdellä napautuksella (myös kyltin kohdalta)!
        if (isTapOnStarship(wPt.x, wPt.y, p)) {
          KV.UI.openSiteModal('ship');
          return;
        }
        if (isTapOnCargoPod(wPt.x, wPt.y, p)) {
          KV.UI.openSiteModal('cargoPod');
          return;
        }

        const tappedUnit = findTappedUnit(wPt.x, wPt.y, Math.max(30, 26 / z));
        const curSel = KV.world.selectedEntity;

        if (tappedUnit) {
          if (curSel === tappedUnit) { KV.State.selectUnit(null); KV.State.showToast('Valinta poistettu.'); }
          else {
            KV.State.selectUnit(tappedUnit);
            KV.Audio.playSfx('born', 0.28);
            if (tappedUnit === KV.hero) KV.State.showToast(`🎖️ ${KV.State.getCommanderSpec().name} aktivoitu! (Oikea klikkaus poistaa valinnan)`);
            else if (tappedUnit.kind === 'worker') KV.State.showToast('👷 Työläinen valittu! Osoita työmaa, pelto tai puu.');
            else if (tappedUnit.kind === 'soldier') KV.State.showToast('🛡️ Kaartilainen valittu! Osoita vartio- tai hyökkäyspaikka.');
          }
          return;
        }

        if (!curSel) { handleDirectBuildingOrPadTap(wPt.x, wPt.y); return; }

        if (curSel === KV.hero) {
          const outlineKey = findTappedOutline(wPt.x, wPt.y, p);
          if (outlineKey) KV.State.startOutlineFromMap(outlineKey, null, p);
          const cleanTgt = sanitizeDryPoint(wPt.x, wPt.y, p);
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
      setZoomAtScreenPoint((KV.S.zoom || 0.75) * (e.deltaY < 0 ? 1.10 : 0.90), e.clientX, e.clientY);
    }, { passive: false });
  }

  KV.cam = cam;
  KV.keys = keys;
  KV.Camera = { MIN_ZOOM, MAX_ZOOM, clampCam, savePlanetCam, restorePlanetCam, screenToWorld, setZoomAtScreenPoint, centerOnHero, bindInput };
})();