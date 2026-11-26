// ============================================================================
// js/ui.js – Planeetanvaihto, Rahtikontin kytkin & Tähtialuksen lentovalikko (v8.3)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { SITES, MARS_SITES, BUILDING_KEYS, MARS_BUILDING_KEYS, FOOD_CFG, CARGO_LIMITS } = KV.CFG;
  let activeSiteModalKey = null;
  let boardingWorkers = 1;
  let boardingSoldiers = 2;

  function refreshCommanderVisuals() {
    if (!KV.Render || !KV.Render.drawCommanderPortrait) return;
    KV.Render.drawCommanderPortrait(document.getElementById('cmdCanvasPippuri'), 'pippuri');
    KV.Render.drawCommanderPortrait(document.getElementById('cmdCanvasTeras'), 'teras');
    if (KV.S.commanderChosen) {
      const off = document.createElement('canvas');
      off.width = 64; off.height = 64;
      const url = KV.Render.drawCommanderPortrait(off, KV.S.commanderId);
      const ico = document.getElementById('heroHudIcon');
      if (url && ico) ico.src = url;
    }
  }

  function openCommanderModal() {
    const modal = document.getElementById('commanderModal');
    if (!modal || !modal.classList.contains('hidden')) return;
    refreshCommanderVisuals();
    modal.classList.remove('hidden');
  }

  function syncZoomButton() {
    const btn = document.getElementById('zoomBtn');
    if (btn) btn.textContent = `🔍 ${Math.round((KV.S.zoom || 0.75) * 100)}%`;
  }

  function syncHeroButton() {
    const S = KV.S;
    const btn = document.getElementById('heroFocusBtn');
    const txt = document.getElementById('heroBtnTxt');
    const pill = document.getElementById('heroPill');
    if (!btn || !txt || !pill) return;

    if (!S.commanderChosen) {
      btn.classList.add('hidden');
      pill.classList.add('hidden');
      return;
    }
    btn.classList.remove('hidden');
    pill.classList.remove('hidden');
    const spec = KV.State.getCommanderSpec();
    document.getElementById('heroNameHud').textContent = spec.shortName;

    if (S.heroMedbayTimer > 0) {
      txt.textContent = `${spec.shortName} Hoitokapselissa (${Math.ceil(S.heroMedbayTimer)}s)`;
      return;
    }
    const locTag = S.shipPlanet !== S.viewPlanet ? (S.shipPlanet === 'crimson' ? ' [Punakivellä]' : ' [Kotilaaksossa]') : '';
    const isSel = (KV.world.selectedEntity === KV.hero);
    btn.classList.toggle('hero-active', isSel);
    txt.textContent = isSel ? `${spec.name} Aktiivinen` : `Aktivoi ${spec.shortName}${locTag}`;
  }

  function updateHUD() {
    const { S, hero, world } = KV;
    const onMars = S.viewPlanet === 'crimson';
    const M = S.mars;

    // Planeetanvaihtonappi + hälytys jos toisella planeetalla on örkki-isku!
    const pBtn = document.getElementById('planetSwitchBtn');
    if (pBtn) {
      pBtn.classList.toggle('hidden', !M.visited);
      if (M.visited) {
        const valleyDanger = onMars && (world.orcs.length > 0 || world.orcRaidTimer < 30);
        pBtn.style.background = valleyDanger ? '#dc2626' : (onMars ? '#14532d' : '#7c2d12');
        pBtn.textContent = valleyDanger
          ? '🚨 HÄLYTYS KOTILAAKSOSSA! (Vaihda)'
          : (onMars ? '🌍 Kurkista Kotilaaksoon' : '🔴 Kurkista Punakivelle');
      }
    }

    if (S.commanderChosen) {
      const hpPct = Math.round((hero.hp / hero.maxHp) * 100);
      document.getElementById('suitTxt').textContent = S.heroMedbayTimer > 0 ? `🏥 ${Math.ceil(S.heroMedbayTimer)}s` : `${hpPct}%`;
      document.getElementById('suitBar').style.width = `${hpPct}%`;
    }

    if (onMars) {
      document.getElementById('popTxt').textContent = `${KV.State.getFreeCarriersCount('crimson')}/${M.workerCount}`;
      const mStew = Math.ceil(M.stew);
      document.getElementById('stewTxt').textContent = mStew <= 0 ? 'TYHJÄ!' : mStew;
      document.getElementById('foodCapTxt').textContent = `Väki ${KV.State.getMarsLivingPop()}/${KV.State.getMarsMaxPop()}`;
      document.getElementById('logTxt').textContent = M.logs;
      document.getElementById('boardTxt').textContent = M.boards;
      document.getElementById('solTxt').textContent = M.soldierCount + (S.shipPlanet === 'crimson' ? 1 : 0);
    } else {
      document.getElementById('popTxt').textContent = `${KV.State.getFreeCarriersCount('valley')}/${S.workerCount}`;
      const vStew = Math.ceil(S.stew);
      document.getElementById('stewTxt').textContent = vStew <= 0 ? 'TYHJÄ!' : vStew;
      document.getElementById('foodCapTxt').textContent = `Väki ${KV.State.getLivingPopulation()}/${KV.State.getMaxSustainablePop()}`;
      document.getElementById('logTxt').textContent = S.piles.logsAtForest;
      document.getElementById('boardTxt').textContent = S.buildings.sawmill.outBoards;
      document.getElementById('solTxt').textContent = S.soldierCount + (S.shipPlanet === 'valley' ? 1 : 0);
    }

    document.getElementById('oatTxt').textContent = S.piles.oatsAtField;
    document.getElementById('flourTxt').textContent = S.buildings.mill.outFlour;
    document.getElementById('breadTxt').textContent = `${S.breads}/5`;
    document.getElementById('coinTxt').textContent = S.coins;
    document.getElementById('oreTxt').textContent = S.starOre;

    // Sää & ennakkovaroitus Kotilaakson suurhyökkäyksestä myös Punakivellä oltaessa!
    if (world.orcs.length > 0) {
      document.getElementById('weatherTxt').innerHTML = '<strong style="color:#fca5a5">🔥 KOTILAAKSO HYÖKKÄYKSEN ALLA!</strong>';
    } else if (S.commanderChosen && !M.fortress.conquered && world.orcRaidTimer < 45) {
      document.getElementById('weatherTxt').innerHTML = `<strong style="color:#fde047">⚠️ Kotilaakson isku: ${Math.ceil(world.orcRaidTimer)}s</strong>`;
    } else {
      document.getElementById('weatherTxt').textContent = onMars ? '🔴 Punakivi' : '☀️ Kirkas';
    }

    let goal = '';
    if (!S.commanderChosen) {
      goal = '⭐ Rakenna Iso Kylätalo, Iso Lautatarha ja Varuskunta saadaksesi oman Kersantin!';
    } else if (!S.crimsonUnlocked) {
      goal = '⭐ Rakenna Kaarisilta ja paista ensimmäiset leivät avataksesi Tähtialuksen Rahtikontin!';
    } else if (!M.visited) {
      goal = '🚀 Napauta Tähtialuksen Rahtikonttia täyttääksesi sen puulla, ja napauta Tähtialusta lentääksesi Punakivelle!';
    } else if (!M.fortress.conquered) {
      goal = '⚔️ Rakenna Punakivelle Kenttäkeittiö & Bunkkeri, tuo kaartilaisia ja valloita Örkkien Päälinnake!';
    } else if (M.buildings.starMine.state !== 'built') {
      goal = '💎 Linnake valloitettu! Rakenna kraatteriin Tähtimalmin Keräyspiste!';
    } else {
      goal = `🏆 VOITTO! Tähtimalmia kerätty ${S.starOre} kpl ja molemmat planeetat ovat hallinnassasi!`;
    }
    document.getElementById('nextGoalTxt').textContent = goal;

    syncHeroButton();
    const launchBtn = document.getElementById('spaceLaunchBtn');
    launchBtn.classList.toggle('hidden', !S.crimsonUnlocked);
    if (S.crimsonUnlocked) {
      launchBtn.textContent = S.shipPlanet === 'valley' ? '🚀 Tähtialus & Rahti (Kotilaakso)' : '🚀 Tähtialus (Punakivi)';
    }

    const sModal = document.getElementById('siteModal');
    if (activeSiteModalKey && sModal && !sModal.classList.contains('hidden')) {
      updateSiteModalLiveState();
    }
  }

  // Rakennetaan modaalin DOM VAIN KERRAN avattaessa, jotta jokainen painallus toimii välittömästi!
  function openSiteModal(siteKey) {
    activeSiteModalKey = siteKey;
    const S = KV.S;
    const bodyEl = document.getElementById('siteModalBody');
    if (!bodyEl) return;

    if (siteKey === 'ship') {
      const maxW = S.shipPlanet === 'valley' ? Math.max(0, S.workerCount - 2) : S.mars.workerCount;
      const maxS = S.shipPlanet === 'valley' ? S.soldierCount : S.mars.soldierCount;
      boardingWorkers = Math.min(boardingWorkers, maxW);
      boardingSoldiers = Math.min(boardingSoldiers, maxS);

      bodyEl.innerHTML = `
        <p id="shipModalSummary" style="margin-bottom:8px;"></p>
        <div class="job-card">
          <div class="job-info">
            <img src="assets/char_builder_f.png" class="card-thumb" alt="">
            <div><strong>Kyytiin lähtevät työläiset</strong><span id="shipWorkerHint"></span></div>
          </div>
          <div class="stepper">
            <button class="step-btn" id="wSubBtn">−</button>
            <span class="step-val" id="wValTxt">0</span>
            <button class="step-btn" id="wAddBtn">+</button>
          </div>
        </div>
        <div class="job-card">
          <div class="job-info">
            <img src="assets/char_soldier_f.png" class="card-thumb" alt="">
            <div><strong>Kyytiin lähtevät kaartilaiset</strong><span id="shipSoldierHint"></span></div>
          </div>
          <div class="stepper">
            <button class="step-btn" id="sSubBtn">−</button>
            <span class="step-val" id="sValTxt">0</span>
            <button class="step-btn" id="sAddBtn">+</button>
          </div>
        </div>
        <div class="build-card" style="margin-top:8px;">
          <div class="job-info">
            <img src="assets/starship.png" class="card-thumb" alt="">
            <div><strong id="shipCargoHdr">Rahtikontti mukana</strong><span id="shipCargoDesc"></span></div>
          </div>
          <button class="buy-btn green" id="launchNowBtn">🚀 Lähde lentoon!</button>
        </div>
      `;

      document.getElementById('wSubBtn').onclick = () => { boardingWorkers = Math.max(0, boardingWorkers - 1); updateSiteModalLiveState(); };
      document.getElementById('wAddBtn').onclick = () => { boardingWorkers++; updateSiteModalLiveState(); };
      document.getElementById('sSubBtn').onclick = () => { boardingSoldiers = Math.max(0, boardingSoldiers - 1); updateSiteModalLiveState(); };
      document.getElementById('sAddBtn').onclick = () => { boardingSoldiers++; updateSiteModalLiveState(); };
      document.getElementById('launchNowBtn').onclick = () => {
        if (KV.State.launchStarship(boardingWorkers, boardingSoldiers)) {
          activeSiteModalKey = null;
          document.getElementById('siteModal').classList.add('hidden');
        }
      };

      updateSiteModalLiveState();
      document.getElementById('siteModal').classList.remove('hidden');
      return;
    }

    const thumbMap = { lodge: 'baby_worker', barracks: 'char_soldier_f', cargoPod: 'supply_crate' };
    bodyEl.innerHTML = `
      <p id="siteModalSummary" style="margin-bottom:8px;"></p>
      <div class="build-card">
        <div class="job-info">
          <img src="assets/${thumbMap[siteKey] || 'cabin'}.png" class="card-thumb" alt="">
          <div><strong id="siteModalCardTitle"></strong><span id="siteModalCardDesc"></span></div>
        </div>
        <button class="buy-btn green" id="siteModalActionBtn"></button>
      </div>
    `;

    document.getElementById('siteModalActionBtn').onclick = () => {
      if (activeSiteModalKey === 'cargoPod') {
        S.cargo.fillActive = !S.cargo.fillActive;
        KV.Audio.playSfx('hammer', 0.35);
        KV.State.showToast(S.cargo.fillActive
          ? '📦 Kontin täyttö PÄÄLLÄ! Vapaat kantajat tuovat konttiin tukkeja, lautoja ja muonaa.'
          : '⏸️ Kontin täyttö keskeytetty – puutavara jää Kotilaakson omaan käyttöön.');
        KV.State.saveGame();
        updateSiteModalLiveState();
      } else if (activeSiteModalKey === 'lodge') {
        const lodge = S.buildings.lodge;
        if (lodge.growing || KV.State.getTotalPopulation() >= KV.State.getMaxSustainablePop() || S.stew < FOOD_CFG.VILLAGER_GROW_COST + 3) return;
        S.stew -= FOOD_CFG.VILLAGER_GROW_COST;
        lodge.growing = true; lodge.spawnProg = 0;
        KV.Audio.playSfx('born', 0.48);
        KV.State.saveGame();
        updateSiteModalLiveState();
      } else if (activeSiteModalKey === 'barracks') {
        const brk = S.buildings.barracks;
        const useCoin = S.coins >= 1;
        const stewCost = useCoin ? FOOD_CFG.GUARD_COIN_STEW_COST : FOOD_CFG.GUARD_STEW_ONLY_COST;
        if (brk.trainQueued || KV.State.getTotalPopulation() >= KV.State.getMaxSustainablePop() || S.stew < stewCost + 3) return;
        if (useCoin) S.coins -= 1;
        S.stew -= stewCost;
        brk.trainQueued = true; brk.trainProg = 0;
        KV.Audio.playSfx('born', 0.48);
        KV.State.saveGame();
        updateSiteModalLiveState();
      }
    };

    updateSiteModalLiveState();
    document.getElementById('siteModal').classList.remove('hidden');
  }

  function updateSiteModalLiveState() {
    const S = KV.S;
    const titleEl = document.getElementById('siteModalTitle');

    if (activeSiteModalKey === 'ship') {
      const cmdSpec = KV.State.getCommanderSpec();
      const fromValley = S.shipPlanet === 'valley';
      titleEl.textContent = fromValley ? '🚀 Tähtialus – Lento Punakivelle' : '🚀 Tähtialus – Paluu Kotilaaksoon';

      const maxW = fromValley ? Math.max(0, S.workerCount - 2) : S.mars.workerCount;
      const maxS = fromValley ? S.soldierCount : S.mars.soldierCount;
      boardingWorkers = Math.max(0, Math.min(boardingWorkers, maxW));
      boardingSoldiers = Math.max(0, Math.min(boardingSoldiers, maxS));
      while (boardingWorkers + boardingSoldiers > CARGO_LIMITS.MAX_PASSENGERS) {
        if (boardingSoldiers > 0) boardingSoldiers--; else boardingWorkers--;
      }
      const roomLeft = CARGO_LIMITS.MAX_PASSENGERS - (boardingWorkers + boardingSoldiers);

      document.getElementById('shipModalSummary').innerHTML = !S.crimsonUnlocked
        ? '🔒 Rakenna ensin Kaarisilta ja paista ensimmäinen erä leipää avataksesi planeettalennot!'
        : `Lentäjä: <strong>${cmdSpec.name}</strong> • Matkustajakapasiteetti: <strong>${boardingWorkers + boardingSoldiers}/${CARGO_LIMITS.MAX_PASSENGERS}</strong>.`;
      document.getElementById('shipWorkerHint').textContent = fromValley ? `Kotilaaksoon jää aina vähintään 2 työläistä (Saatavilla: ${maxW}).` : `Punakivellä nyt: ${maxW} työläistä.`;
      document.getElementById('shipSoldierHint').textContent = fromValley ? `Jätä kaartilaisia myös Kotilaakson suojaksi! (Saatavilla: ${maxS}).` : `Punakivellä nyt: ${maxS} kaartilaista.`;

      document.getElementById('wValTxt').textContent = boardingWorkers;
      document.getElementById('sValTxt').textContent = boardingSoldiers;
      document.getElementById('wSubBtn').disabled = boardingWorkers <= 0;
      document.getElementById('wAddBtn').disabled = boardingWorkers >= maxW || roomLeft <= 0;
      document.getElementById('sSubBtn').disabled = boardingSoldiers <= 0;
      document.getElementById('sAddBtn').disabled = boardingSoldiers >= maxS || roomLeft <= 0;

      document.getElementById('shipCargoHdr').textContent = fromValley ? '📦 Rahtikontti kiinnittyy runkoon' : '💎 Tähtimalmi mukana paluulennolla';
      document.getElementById('shipCargoDesc').textContent = fromValley
        ? `Kontissa nyt: 🌲 ${S.cargo.logs} tukkia • 🪵 ${S.cargo.boards} lautaa • 🍲 ${S.cargo.stew} Naurispataa.`
        : 'Voit hakea Kotilaaksosta lisää puutavaraa, ruokaa tai täydennysjoukkoja!';

      const lBtn = document.getElementById('launchNowBtn');
      lBtn.disabled = !S.crimsonUnlocked || S.heroMedbayTimer > 0;
      lBtn.textContent = fromValley ? '🚀 Lennä Punakivelle!' : '🚀 Lennä Kotilaaksoon!';
      return;
    }

    const sumEl = document.getElementById('siteModalSummary');
    const cTitle = document.getElementById('siteModalCardTitle');
    const cDesc = document.getElementById('siteModalCardDesc');
    const btn = document.getElementById('siteModalActionBtn');
    if (!sumEl || !cTitle || !cDesc || !btn) return;

    if (activeSiteModalKey === 'cargoPod') {
      titleEl.textContent = '📦 Tähtialuksen Rahtikontti';
      sumEl.innerHTML = 'Punakivi-planeetalla ei kasva puita! Kun täyttö on päällä, vapaat kantajat kantavat ylimääräiset tukit, laudat ja muonan valmiiksi konttiin.';
      cTitle.textContent = `Sisältö nyt: 🌲 ${S.cargo.logs}/${CARGO_LIMITS.MAX_LOGS} • 🪵 ${S.cargo.boards}/${CARGO_LIMITS.MAX_BOARDS} • 🍲 ${S.cargo.stew}/${CARGO_LIMITS.MAX_STEW}`;
      cDesc.textContent = S.cargo.fillActive
        ? '🟢 Kantajat täyttävät konttia (jättää aina pienen hätävaran Kotilaaksoon).'
        : '⚪ Täyttö on pois päältä.';
      btn.className = S.cargo.fillActive ? 'buy-btn amber' : 'buy-btn green';
      btn.textContent = S.cargo.fillActive ? '⏸️ Lopeta täyttö' : '▶️ Kytke täyttö päälle';
      btn.disabled = false;
      return;
    }

    const curPop = KV.State.getTotalPopulation();
    const maxCap = KV.State.getMaxSustainablePop();

    if (activeSiteModalKey === 'lodge') {
      const lodge = S.buildings.lodge;
      titleEl.textContent = '🏡 Iso Kylätalo – Väestö & Muonitus';
      sumEl.innerHTML = `Kotilaakson ruokahuolto elättää nyt <strong>${curPop}/${maxCap} hahmoa</strong>. (Punakivelle siirretyt joukot vapauttavat tilaa Kotilaaksosta!)`;
      cTitle.textContent = `Kasvata Kyläläinen (Kotilaakson väki: ${curPop}/${maxCap})`;
      const canGrow = !lodge.growing && curPop < maxCap && S.stew >= FOOD_CFG.VILLAGER_GROW_COST + 3;
      cDesc.textContent = lodge.growing
        ? `Kasvaa parhaillaan kuistilla: ${Math.round(lodge.spawnProg * 100)}%`
        : (curPop >= maxCap ? '⚠️ Ruokakatto täynnä! Laajenna Naurispeltoa tai siirrä väkeä Punakivelle.' : 'Valmistuu auttamaan puunkaadossa, sahauksessa ja rahtikontin täytössä.');
      btn.textContent = lodge.growing ? `Kasvaa (${Math.round(lodge.spawnProg * 100)}%)` : `👶 Kasvata (-${FOOD_CFG.VILLAGER_GROW_COST} 🍲)`;
      btn.disabled = !canGrow;

    } else if (activeSiteModalKey === 'barracks') {
      const brk = S.buildings.barracks;
      titleEl.textContent = '🥋 Kaurakaartin Varuskunta';
      const useCoin = S.coins >= 1;
      const stewCost = useCoin ? FOOD_CFG.GUARD_COIN_STEW_COST : FOOD_CFG.GUARD_STEW_ONLY_COST;
      sumEl.innerHTML = `Kotilaaksossa kaartilaisia: <strong>${S.soldierCount}</strong> • Punakivellä: <strong>${S.mars.soldierCount}</strong>.`;
      cTitle.textContent = 'Kouluta Kaurakaartilainen';
      const canTrain = !brk.trainQueued && curPop < maxCap && S.stew >= stewCost + 3;
      cDesc.textContent = 'Puolustaa Kotilaakson rakennuksia polttoiskuilta ja lähtee mukaan Punakiven linnakkeen valtaukseen!';
      btn.className = 'buy-btn amber';
      btn.textContent = brk.trainQueued ? `Koulutus (${Math.round(brk.trainProg * 100)}%)` : `🛡️ Kouluta (${useCoin ? `1🪙+${stewCost}🍲` : `${stewCost}🍲`})`;
      btn.disabled = !canTrain;
    }
  }

  function renderManageModal() {
    const S = KV.S;
    const onMars = S.viewPlanet === 'crimson';
    document.getElementById('manageTitleHdr').textContent = onMars ? '🔴 Punakiven Etutukikohta' : '🏡 Kotilaakson Työnjako';
    document.getElementById('freeCarriersHdr').textContent = KV.State.getFreeCarriersCount(S.viewPlanet);

    const jobsBox = document.getElementById('jobsContainer');
    const sitesBox = document.getElementById('activeSitesContainer');
    jobsBox.innerHTML = '';
    sitesBox.innerHTML = '';

    if (onMars) {
      const M = S.mars;
      document.getElementById('foodRateHdr').textContent = `🍲 Kenttämuona: ${Math.ceil(M.stew)} • Kantokyky: ${KV.State.getMarsLivingPop()}/${KV.State.getMarsMaxPop()} hahmoa.`;

      const addMarsJob = (jk, thumb, title, desc, maxA) => {
        const cur = M.jobs[jk] || 0;
        const canAdd = KV.State.getFreeCarriersCount('crimson') > 0 && cur < maxA;
        const row = document.createElement('div');
        row.className = 'job-card' + (cur > 0 ? ' highlight' : '');
        row.innerHTML = `
          <div class="job-info"><img src="assets/${thumb}.png" class="card-thumb" alt=""><div><strong>${title}</strong><span>${desc}</span></div></div>
          <div class="stepper">
            <button class="step-btn" data-d="-1" ${cur <= 0 ? 'disabled' : ''}>−</button>
            <span class="step-val">${cur}</span>
            <button class="step-btn" data-d="1" ${!canAdd ? 'disabled' : ''}>+</button>
          </div>`;
        row.querySelectorAll('.step-btn').forEach(b => {
          b.onclick = () => {
            M.jobs[jk] = Math.max(0, cur + Number(b.dataset.d));
            KV.State.reassignMarsRoles(); KV.State.saveGame(); renderManageModal();
          };
        });
        jobsBox.appendChild(row);
      };

      if (M.buildings.mKitchen.state === 'built') addMarsJob('cooks', 'kitchen', '🍲 Kenttäkokki (Max 1)', 'Keittää pataa Punakiven joukoille.', 1);
      if (M.field.active) addMarsJob('farmers', 'char_farmer_f', '🌱 Kraatteriviljelijä (Max 2)', 'Kasvattaa nauriita kraatterin pohjalla.', 2);
      if (M.buildings.starMine.state === 'built') addMarsJob('miners', 'char_woodcutter', '💎 Tähtimalmin louhija (Max 2)', 'Louhii Tähtimalmia vallatusta kraatterista!', 2);
      return;
    }

    document.getElementById('foodRateHdr').textContent = `🍲 Kotilaakson ruokakatto: ${KV.State.getLivingPopulation()}/${KV.State.getMaxSustainablePop()} hahmoa.`;

    const addValleyJob = (key, thumb, title, desc, maxA = 99, minA = 0) => {
      const cur = S.jobs[key] || 0;
      const canAdd = KV.State.getFreeCarriersCount('valley') > 0 && cur < maxA;
      const row = document.createElement('div');
      row.className = 'job-card' + (cur > 0 ? ' highlight' : '');
      row.innerHTML = `
        <div class="job-info"><img src="assets/${thumb}.png" class="card-thumb" alt=""><div><strong>${title}</strong><span>${desc}</span></div></div>
        <div class="stepper">
          <button class="step-btn" data-d="-1" ${cur <= minA ? 'disabled' : ''}>−</button>
          <span class="step-val">${cur}</span>
          <button class="step-btn" data-d="1" ${!canAdd ? 'disabled' : ''}>+</button>
        </div>`;
      row.querySelectorAll('.step-btn').forEach(b => {
        b.onclick = () => {
          S.jobs[key] = Math.max(minA, cur + Number(b.dataset.d));
          KV.State.reassignWorkerRoles(); KV.State.saveGame(); renderManageModal();
        };
      });
      jobsBox.appendChild(row);
    };

    const minCook = (S.fields.turnip.active && S.jobs.turnipFarmers > 0) ? 0 : 1;
    addValleyJob('cookGardeners', 'kitchen', '🍲 Kokki-Puutarhuri (Max 2)', 'Hoitaa Kotitarhaa ja Naurispataa.', 2, minCook);
    addValleyJob('woodcutters', 'char_woodcutter_f', '🌲 Metsurit', 'Kaatavat tukkeja kylän ja Rahtikontin tarpeisiin.');
    if (S.fields.turnip.active) addValleyJob('turnipFarmers', 'char_farmer_f', '🌱 Naurisviljelijät (Max 2)', 'Nostaa Kotilaakson ruokakattoa.', 2);
    if (S.buildings.sawmill.state === 'built') addValleyJob('sawyers', 'sawmill', '🪚 Sahaajat (Max 2)', 'Sahaavat lautoja.', 2);
    if (S.fields.oat.active) addValleyJob('oatFarmers', 'item_oat', '🌾 Kauraviljelijät', 'Kasvattaa kauraa Vesimyllylle.');
    if (S.buildings.mill.state === 'built') addValleyJob('millers', 'watermill', '⚙️ Mylläri (Max 1)', 'Jauhaa jauhosäkkejä.', 1);
    if (S.buildings.bakery.state === 'built') addValleyJob('bakers', 'char_baker_f', '🥖 Leipuri (Max 1)', 'Paistaa leipäkoreja (+1 🪙 / 5 leipää).', 1);
  }

  function bindUIButtons() {
    const S = KV.S;

    document.getElementById('startBtn').onclick = () => {
      S.started = true; KV.State.saveGame();
      document.getElementById('introModal').classList.add('hidden');
      KV.State.checkUnlocks();
      try { KV.Audio.updateSpatialAudio(); } catch (e) {}
    };

    document.getElementById('planetSwitchBtn').onclick = () => {
      KV.State.switchViewPlanet();
    };

    document.getElementById('helpBtn').onclick = () => document.getElementById('introModal').classList.remove('hidden');

    document.getElementById('pickPippuriBtn').onclick = () => {
      document.getElementById('commanderModal').classList.add('hidden');
      KV.State.chooseCommander('pippuri'); KV.Camera.centerOnHero(true);
    };
    document.getElementById('pickTerasBtn').onclick = () => {
      document.getElementById('commanderModal').classList.add('hidden');
      KV.State.chooseCommander('teras'); KV.Camera.centerOnHero(true);
    };

    document.getElementById('closeSiteModalBtn').onclick = () => {
      activeSiteModalKey = null;
      document.getElementById('siteModal').classList.add('hidden');
    };

    document.getElementById('heroFocusBtn').onclick = () => {
      if (!S.commanderChosen) return;
      KV.Camera.centerOnHero(true);
    };

    document.getElementById('manageBtn').onclick = () => {
      renderManageModal();
      document.getElementById('manageModal').classList.remove('hidden');
    };
    document.getElementById('closeManageBtn').onclick = () => document.getElementById('manageModal').classList.add('hidden');

    document.getElementById('spaceLaunchBtn').onclick = () => {
      if (S.viewPlanet !== S.shipPlanet) KV.State.switchViewPlanet(S.shipPlanet);
      const sp = S.shipPlanet === 'crimson' ? MARS_SITES.ship : SITES.ship;
      KV.cam.x = sp.x; KV.cam.y = sp.y; KV.Camera.clampCam();
      openSiteModal('ship');
    };

    document.getElementById('zoomBtn').onclick = () => {
      const presets = [0.54, 0.72, 0.92];
      let nextIdx = 0;
      for (let i = 0; i < presets.length; i++) { if ((S.zoom || 0.72) < presets[i] - 0.04) { nextIdx = i; break; } }
      KV.Camera.setZoomAtScreenPoint(presets[nextIdx], window.innerWidth / 2, window.innerHeight / 2);
      KV.State.saveGame();
    };

    const syncAudioBtns = () => {
      document.getElementById('musicBtn').textContent = S.musicOn ? '🎵' : '🎵🚫';
      document.getElementById('soundBtn').textContent = S.soundOn ? '🔊' : '🔇';
    };
    document.getElementById('musicBtn').onclick = () => { S.musicOn = !S.musicOn; syncAudioBtns(); KV.State.saveGame(); };
    document.getElementById('soundBtn').onclick = () => { S.soundOn = !S.soundOn; syncAudioBtns(); KV.State.saveGame(); };

    document.getElementById('resetSaveBtn').onclick = () => {
      if (confirm('Nollataanko koko peli ja aloitetaan alusta?')) KV.State.resetSave();
    };

    syncZoomButton();
    syncHeroButton();
    syncAudioBtns();
    refreshCommanderVisuals();
    if (S.started) {
      document.getElementById('introModal').classList.add('hidden');
      KV.State.checkUnlocks();
    }
  }

  KV.UI = {
    refreshCommanderVisuals, openCommanderModal, openSiteModal,
    syncZoomButton, syncHeroButton, updateHUD, renderManageModal, bindUIButtons
  };
})();