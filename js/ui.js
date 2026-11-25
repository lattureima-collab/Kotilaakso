// ============================================================================
// js/ui.js – Yläpalkki, Kersantin valinta, Kylätalon & Varuskunnan pikavalikot (v8.2)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { SITES, BUILDING_KEYS, FOOD_CFG } = KV.CFG;
  let activeSiteModalKey = null;

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
      btn.classList.remove('hero-active');
      txt.textContent = `${spec.shortName} Hoitokapselissa (${Math.ceil(S.heroMedbayTimer)}s)`;
      return;
    }
    const isSel = (KV.world.selectedEntity === KV.hero);
    btn.classList.toggle('hero-active', isSel);
    txt.textContent = isSel ? `${spec.name} Aktiivinen` : `Aktivoi ${spec.name}`;
  }

  function updateHUD() {
    const { S, hero, world } = KV;
    const cmdSpec = KV.State.getCommanderSpec();

    if (S.commanderChosen) {
      const hpPct = Math.round((hero.hp / hero.maxHp) * 100);
      document.getElementById('suitTxt').textContent = S.heroMedbayTimer > 0
        ? `🏥 ${Math.ceil(S.heroMedbayTimer)}s`
        : `${hpPct}%`;
      document.getElementById('suitBar').style.width = `${hpPct}%`;
      document.getElementById('suitBar').style.background = S.heroMedbayTimer > 0 ? '#ef4444' : 'var(--green)';
    }

    document.getElementById('popTxt').textContent = `${KV.State.getFreeCarriersCount()}/${S.workerCount}`;
    const stewRounded = Math.ceil(S.stew);
    const livPop = KV.State.getLivingPopulation();
    const maxCap = KV.State.getMaxSustainablePop();
    document.getElementById('stewTxt').textContent = stewRounded <= 0 ? 'TYHJÄ!' : stewRounded;
    document.getElementById('foodCapTxt').textContent = `Väki ${livPop}/${maxCap}`;
    document.getElementById('stewPill').classList.toggle('hungry', stewRounded <= 0 || livPop > maxCap);

    document.getElementById('logTxt').textContent = S.piles.logsAtForest;
    document.getElementById('boardTxt').textContent = S.buildings.sawmill.outBoards;
    document.getElementById('oatTxt').textContent = S.piles.oatsAtField;
    document.getElementById('flourTxt').textContent = S.buildings.mill.outFlour;
    document.getElementById('breadTxt').textContent = `${S.breads}/5`;
    document.getElementById('coinTxt').textContent = S.coins;
    document.getElementById('solTxt').textContent = S.soldierCount + (S.commanderChosen ? 1 : 0);

    if (world.frostActive > 0) {
      document.getElementById('weatherTxt').innerHTML = '<strong style="color:#bae6fd">❄️ HALLA!</strong>';
    } else if (S.commanderChosen && world.orcs.length === 0 && world.orcRaidTimer < 45) {
      document.getElementById('weatherTxt').innerHTML = `<strong style="color:#fca5a5">⚔️ Örkit: ${Math.ceil(world.orcRaidTimer)}s</strong>`;
    } else {
      document.getElementById('weatherTxt').textContent = '☀️ Kirkas';
    }

    let goal = '';
    if (S.stew <= 0.05) goal = '🚨 NÄLKÄ! Varmista että Kokki-Puutarhuri on keittiöllä tai laajenna naurisviljelyä!';
    else if (S.buildings.lodge.state !== 'built') goal = `⭐ Napauta Ison Kylätalon punaista ääriviivaa keskustassa (Tarve: ${S.buildings.lodge.logsIn}/5🌲)!`;
    else if (S.buildings.sawmill.state !== 'built') goal = '⭐ Kasvata 5. kyläläinen Kylätalosta ja rakenna Iso Lautatarha (punainen ääriviiva)!';
    else if (S.buildings.barracks.state !== 'built') goal = `⭐ Sahaa lautoja ja rakenna Kaurakaartin Varuskunta (${S.buildings.barracks.boardsIn}/6🪵), jotta saat oman Kersantin!`;
    else if (!S.commanderChosen) goal = '🎖️ Varuskunta on valmis – valitse Kersantti Pippuri tai Kersantti Teräs!';
    else if (S.buildings.bridge.state !== 'built') goal = '⭐ Rakenna Puinen Kaarisilta ja kouluta kaartilaisia Varuskunnasta ennen örkkien iskua!';
    else if (!S.everBakedBread) goal = '⭐ Raivaa itärannalle Suuri Kaurapelto, Vesimylly ja Leipomo (punaiset ääriviivat)!';
    else if (S.soldierCount < 2 || S.coins < 2) goal = `⭐ Kerää leipäkoreilla vähintään 2 🪙 (${S.coins}/2) ja kouluta 2 kaartilaista (${S.soldierCount}/2) lentoonlähtöä varten!`;
    else goal = `🏆 Laakso on turvattu! ${cmdSpec.name} voi nyt viedä miehistön luoteen Tähtialuksella kohti uutta planeettaa!`;
    document.getElementById('nextGoalTxt').textContent = goal;

    syncHeroButton();
    const readyToLaunch = S.commanderChosen && S.heroMedbayTimer <= 0 && S.everBakedBread && S.soldierCount >= 2 && S.coins >= 2;
    const launchBtn = document.getElementById('spaceLaunchBtn');
    launchBtn.classList.toggle('hidden', !readyToLaunch);
    if (readyToLaunch) launchBtn.textContent = `🚀 Tähtialukseen (${cmdSpec.shortName})!`;

    // Päivitetään avoinna olevan ikkunan lukemat tuhoamatta painiketta!
    const sModal = document.getElementById('siteModal');
    if (activeSiteModalKey && sModal && !sModal.classList.contains('hidden')) {
      updateSiteModalLiveState();
    }
  }

  // Luo ikkunan rakenteen VAIN KERRAN avattaessa, jotta painallus menee aina perille
  function openSiteModal(siteKey) {
    activeSiteModalKey = siteKey;
    const bodyEl = document.getElementById('siteModalBody');
    if (!bodyEl) return;

    const thumbMap = {
      lodge: 'baby_worker',
      barracks: 'char_soldier_f',
      ship: 'starship'
    };

    bodyEl.innerHTML = `
      <p id="siteModalSummary" style="margin-bottom:8px;"></p>
      <div class="build-card">
        <div class="job-info">
          <img id="siteModalThumb" src="assets/${thumbMap[siteKey] || 'cabin'}.png" class="card-thumb" alt="">
          <div>
            <strong id="siteModalCardTitle"></strong>
            <span id="siteModalCardDesc"></span>
          </div>
        </div>
        <button class="buy-btn green" id="siteModalActionBtn"></button>
      </div>
    `;

    const actionBtn = document.getElementById('siteModalActionBtn');
    actionBtn.onclick = () => {
      handleSiteModalActionClick();
    };

    updateSiteModalLiveState();
    document.getElementById('siteModal').classList.remove('hidden');
  }

  function handleSiteModalActionClick() {
    const S = KV.S;
    const curPop = KV.State.getTotalPopulation();
    const maxCap = KV.State.getMaxSustainablePop();

    if (activeSiteModalKey === 'lodge') {
      const lodge = S.buildings.lodge;
      const stewCost = FOOD_CFG.VILLAGER_GROW_COST;
      if (lodge.growing || curPop >= maxCap || S.stew < stewCost + 3) return;

      S.stew = Math.max(0, S.stew - stewCost);
      lodge.growing = true;
      lodge.spawnProg = 0;
      KV.Audio.playSfx('born', 0.48);
      KV.State.showToast('👶 Uusi kyläläinen alkoi kasvaa Isossa Kylätalossa!');
      KV.State.saveGame();
      updateSiteModalLiveState();

    } else if (activeSiteModalKey === 'barracks') {
      const brk = S.buildings.barracks;
      const useCoin = S.coins >= 1;
      const stewCost = useCoin ? FOOD_CFG.GUARD_COIN_STEW_COST : FOOD_CFG.GUARD_STEW_ONLY_COST;
      if (brk.trainQueued || curPop >= maxCap || S.stew < stewCost + 3) return;

      if (useCoin) S.coins -= 1;
      S.stew = Math.max(0, S.stew - stewCost);
      brk.trainQueued = true;
      brk.trainProg = 0;
      KV.Audio.playSfx('born', 0.48);
      KV.State.showToast('🛡️ Alokas aloitti koulutuksen Varuskunnassa!');
      KV.State.saveGame();
      updateSiteModalLiveState();

    } else if (activeSiteModalKey === 'ship') {
      const ready = S.commanderChosen && S.heroMedbayTimer <= 0 && S.everBakedBread && S.soldierCount >= 2 && S.coins >= 2;
      if (!ready) return;
      activeSiteModalKey = null;
      document.getElementById('siteModal').classList.add('hidden');
      triggerVictoryLaunch();
    }
  }

  function updateSiteModalLiveState() {
    const S = KV.S;
    const titleEl = document.getElementById('siteModalTitle');
    const sumEl = document.getElementById('siteModalSummary');
    const cTitle = document.getElementById('siteModalCardTitle');
    const cDesc = document.getElementById('siteModalCardDesc');
    const btn = document.getElementById('siteModalActionBtn');
    if (!titleEl || !sumEl || !cTitle || !cDesc || !btn) return;

    const curPop = KV.State.getTotalPopulation();
    const maxCap = KV.State.getMaxSustainablePop();
    const burnPerMin = (KV.State.getStewBurnPerSec() * 60).toFixed(1);

    if (activeSiteModalKey === 'lodge') {
      const lodge = S.buildings.lodge;
      titleEl.textContent = '🏡 Iso Kylätalo – Väestö & Muonitus';
      sumEl.innerHTML = `Nykyinen väkiluku kuluttaa Naurispataa <strong>${burnPerMin} annosta / min</strong>. Nykyinen naurisviljely elättää turvallisesti <strong>${maxCap} hahmoa</strong>.`;
      cTitle.textContent = `Uusi Kyläläinen (Väki nyt: ${curPop}/${maxCap})`;

      const stewCost = FOOD_CFG.VILLAGER_GROW_COST;
      const foodFull = curPop >= maxCap;
      const lowStew = S.stew < stewCost + 3;
      const canGrow = !lodge.growing && !foodFull && !lowStew;

      let btnLabel = `👶 Kasvata kyläläinen (-${stewCost} 🍲)`;
      let reasonTxt = 'Uusi kyläläinen kasvaa kuistilla valmiiksi auttamaan kylän töissä.';
      if (lodge.growing) {
        btnLabel = `Kasvamassa (${Math.round(lodge.spawnProg * 100)}%)...`;
        reasonTxt = 'Lapsi kasvaa parhaillaan Kylätalon kuistilla aikuiseksi!';
      } else if (foodFull) {
        btnLabel = `Ruokaraja täynnä (${curPop}/${maxCap})`;
        reasonTxt = !S.fields.turnip.active
          ? '⚠️ Naurispadan tuotanto ei riitä isommalle väelle! Raivaa etelään Suuri Naurispelto ja laita sinne viljelijä.'
          : '⚠️ Lisää toinen Naurisviljelijä tai Kokki-Puutarhuri elättääksesi vielä enemmän väkeä!';
      } else if (lowStew) {
        btnLabel = `Odottaa pataa (${Math.floor(S.stew)}/${stewCost + 3} 🍲)`;
        reasonTxt = '⚠️ Padassa on oltava riittävästi ruokaa ennen uuden kyläläisen kasvatusta.';
      }

      cDesc.textContent = reasonTxt;
      btn.className = 'buy-btn green';
      btn.textContent = btnLabel;
      btn.disabled = !canGrow;

    } else if (activeSiteModalKey === 'barracks') {
      const brk = S.buildings.barracks;
      const cmdSpec = KV.State.getCommanderSpec();
      titleEl.textContent = '🥋 Kaurakaartin Varuskunta';
      sumEl.innerHTML = `Komentaja: <strong>${cmdSpec.name}</strong> • Kaartilaisia rivissä: <strong>${S.soldierCount}</strong> (Ruokakatto: ${curPop}/${maxCap}).`;
      cTitle.textContent = 'Kouluta Kaurakaartilainen';

      const useCoin = S.coins >= 1;
      const stewCost = useCoin ? FOOD_CFG.GUARD_COIN_STEW_COST : FOOD_CFG.GUARD_STEW_ONLY_COST;
      const costLabel = useCoin ? `1 🪙 + ${stewCost} 🍲` : `${stewCost} 🍲`;
      const foodFull = curPop >= maxCap;
      const lowStew = S.stew < stewCost + 3;
      const canTrain = !brk.trainQueued && !foodFull && !lowStew;

      let btnLabel = `🛡️ Kouluta kaartilainen (${costLabel})`;
      let subDesc = 'Puolustaa siltaa ja itärantaa yhdessä Kersantin kanssa. Jokainen kaartilainen syö myös Naurispataa!';
      if (brk.trainQueued) {
        btnLabel = `Koulutuksessa (${Math.round(brk.trainProg * 100)}%)...`;
        subDesc = 'Alokas harjoittelee parhaillaan Varuskunnan pihalla!';
      } else if (foodFull) {
        btnLabel = `Ruokaraja täynnä (${curPop}/${maxCap})`;
        subDesc = '⚠️ Laajenna ensin Suuren Naurispellon viljelyä, jotta ruoka riittää uudelle sotilaalle!';
      } else if (lowStew) {
        btnLabel = `Liian vähän pataa (${Math.floor(S.stew)} 🍲)`;
      }

      cDesc.textContent = subDesc;
      btn.className = 'buy-btn amber';
      btn.textContent = btnLabel;
      btn.disabled = !canTrain;

    } else if (activeSiteModalKey === 'ship') {
      const cmdSpec = KV.State.getCommanderSpec();
      titleEl.textContent = '🚀 Tähtialus (Luoteisaukio)';
      sumEl.innerHTML = !S.commanderChosen
        ? 'Alus odottaa lentäjäänsä! Rakenna ensin Varuskunta ja valitse Kersantti.'
        : `Aluksen kapteeni ja lentäjä: <strong>${cmdSpec.name}</strong>.`;
      cTitle.textContent = 'Uuden planeetan valloituslento';
      cDesc.textContent = `Vaatimukset: Kersantti valittu (${S.commanderChosen ? '✅' : '❌'}), leipää leivottu (${S.everBakedBread ? '✅' : '❌'}), vähintään 2 kaartilaista (${S.soldierCount}/2) ja 2 Space Coinia (${S.coins}/2 🪙).`;

      const ready = S.commanderChosen && S.heroMedbayTimer <= 0 && S.everBakedBread && S.soldierCount >= 2 && S.coins >= 2;
      btn.className = 'buy-btn green';
      btn.textContent = ready ? '🚀 Lähde matkaan!' : 'Valmistele kylä';
      btn.disabled = !ready;
    }
  }

  function renderManageModal() {
    const S = KV.S;
    const cmdSpec = KV.State.getCommanderSpec();
    document.getElementById('freeCarriersHdr').textContent = KV.State.getFreeCarriersCount();

    const livPop = KV.State.getLivingPopulation();
    const maxCap = KV.State.getMaxSustainablePop();
    const burnMin = (KV.State.getStewBurnPerSec() * 60).toFixed(1);
    document.getElementById('foodRateHdr').textContent =
      `🍲 Naurispadan menekki: ${burnMin} annosta/min • Ruokahuolto elättää nyt: ${livPop}/${maxCap} hahmoa.`;

    const medBanner = document.getElementById('medbayBanner');
    if (S.commanderChosen && S.heroMedbayTimer > 0) {
      medBanner.classList.remove('hidden');
      const canHeal = S.stew >= 14;
      medBanner.innerHTML = `
        <div class="job-info">
          <img src="assets/starship.png" class="card-thumb" alt="">
          <div>
            <strong>🏥 Hoitokapseli: ${cmdSpec.name} (${Math.ceil(S.heroMedbayTimer)} s)</strong>
            <span>Toipuu automaattisesti Tähtialuksella, tai pikakorjaa varusteet heti (12 🍲).</span>
          </div>
        </div>
        <button class="buy-btn green" id="instantHealBtn" ${!canHeal ? 'disabled' : ''}>Pikakorjaa (12 🍲)</button>
      `;
      const hBtn = document.getElementById('instantHealBtn');
      if (hBtn && canHeal) {
        hBtn.onclick = () => {
          S.stew = Math.max(0, S.stew - 12);
          S.heroMedbayTimer = 0;
          KV.hero.hp = KV.hero.maxHp;
          KV.Audio.playSfx('build_done', 0.55);
          KV.State.showToast(`⚡ ${cmdSpec.name} palasi täydessä kunnossa kentälle!`);
          KV.State.saveGame();
          renderManageModal();
          updateHUD();
        };
      }
    } else {
      medBanner.classList.add('hidden');
    }

    const jobsBox = document.getElementById('jobsContainer');
    const sitesBox = document.getElementById('activeSitesContainer');
    jobsBox.innerHTML = '';
    sitesBox.innerHTML = '';

    const addJobRow = (key, thumb, title, desc, maxAllowed = 99, minAllowed = 0) => {
      const cur = S.jobs[key] || 0;
      const canAdd = KV.State.getFreeCarriersCount() > 0 && cur < maxAllowed;
      const canSub = cur > minAllowed;
      const row = document.createElement('div');
      row.className = 'job-card' + (cur > 0 ? ' highlight' : '');
      row.innerHTML = `
        <div class="job-info">
          <img src="assets/${thumb}.png" class="card-thumb" alt="">
          <div><strong>${title}</strong><span>${desc}</span></div>
        </div>
        <div class="stepper">
          <button class="step-btn" data-dir="-1" ${!canSub ? 'disabled' : ''}>−</button>
          <span class="step-val">${cur}</span>
          <button class="step-btn" data-dir="1" ${!canAdd ? 'disabled' : ''}>+</button>
        </div>
      `;
      row.querySelectorAll('.step-btn').forEach(btn => {
        btn.onclick = () => {
          S.jobs[key] = Math.max(minAllowed, (S.jobs[key] || 0) + Number(btn.dataset.dir));
          KV.State.reassignWorkerRoles();
          KV.State.saveGame();
          renderManageModal();
          updateHUD();
        };
      });
      jobsBox.appendChild(row);
    };

    const minCook = (S.fields.turnip.active && S.jobs.turnipFarmers > 0) ? 0 : 1;
    addJobRow('cookGardeners', 'kitchen', '🍲 Kyläkeittiön Kokki-Puutarhuri (Max 2)', 'Hoitaa Kotitarhaa ja keittää Naurispataa (+6/+8 ruokakatto).', 2, minCook);
    addJobRow('woodcutters', 'char_woodcutter_f', '🌲 Metsurit', 'Kaatavat lähimmät tukkipuut Tukkipinoon (max 30).');
    if (S.fields.turnip.active) addJobRow('turnipFarmers', 'char_farmer_f', '🌱 Suuren Naurispellon viljelijät (Max 2)', 'Nostaa kylän ruokakattoa (+4 / +7 asukasta)!', 2);
    if (S.buildings.sawmill.state === 'built') addJobRow('sawyers', 'sawmill', '🪚 Lautatarhan Sahaaja (Max 2)', 'Sahaa tukeista lautoja (1 tukki = 2 lautaa).', 2);
    if (S.fields.oat.active) addJobRow('oatFarmers', 'item_oat', '🌾 Kauraviljelijät', 'Kasvattaa kauraa itärannan Vesimyllylle.');
    if (S.buildings.mill.state === 'built') addJobRow('millers', 'watermill', '⚙️ Vesimyllyn Mylläri (Max 1)', 'Jauhaa kaurasta jauhosäkkejä Leipomoon.', 1);
    if (S.buildings.bakery.state === 'built') addJobRow('bakers', 'char_baker_f', '🥖 Leipomon Leipuri (Max 1)', 'Paistaa leipäkoreja Kylätalolle (+1 🪙 / 5 leipää).', 1);

    let anySite = false;
    for (const key of BUILDING_KEYS) {
      const b = S.buildings[key];
      if (b.state !== 'building' && b.state !== 'ruined') continue;
      anySite = true;
      const canAdd = (b.builders || 0) < 1 && KV.State.getFreeCarriersCount() > 0;
      const card = document.createElement('div');
      card.className = 'build-card active-site';
      card.innerHTML = `
        <div class="job-info">
          <img src="assets/scaffolding.png" class="card-thumb" alt="">
          <div>
            <strong>🔨 ${SITES[key].label} (${Math.round(b.prog * 100)}%)</strong>
            <span>Tarvikkeet: 🌲${b.logsIn}/${b.logsNeed} ${b.boardsNeed ? `• 🪵${b.boardsIn}/${b.boardsNeed}` : ''}</span>
          </div>
        </div>
        <div class="stepper">
          <button class="step-btn" data-b="-1" ${(b.builders || 0) <= 0 ? 'disabled' : ''}>−</button>
          <span class="step-val">${b.builders || 0}/1</span>
          <button class="step-btn" data-b="1" ${!canAdd ? 'disabled' : ''}>+</button>
        </div>
      `;
      card.querySelectorAll('.step-btn').forEach(btn => {
        btn.onclick = () => {
          b.builders = Math.max(0, Math.min(1, (b.builders || 0) + Number(btn.dataset.b)));
          KV.State.reassignWorkerRoles();
          KV.State.saveGame();
          renderManageModal();
          updateHUD();
        };
      });
      sitesBox.appendChild(card);
    }

    if (!anySite) {
      sitesBox.innerHTML = '<p style="font-size:0.82rem;color:#cbd5e1;padding:4px 2px;">Ei aktiivisia työmaita. Napauta kartalla näkyvää punaista ääriviivaa aloittaaksesi rakentamisen!</p>';
    }
  }

  function triggerVictoryLaunch() {
    const cmdSpec = KV.State.getCommanderSpec();
    KV.Audio.playSfx('build_done', 0.65);
    KV.cam.x = SITES.ship.x;
    KV.cam.y = SITES.ship.y;
    KV.Camera.clampCam();
    KV.State.showToast(`🚀 ${cmdSpec.name} käynnisti Tähtialuksen moottorit! Kotilaakson tukikohta on valmis ja matka kohti uutta planeettaa alkaa!`);
  }

  function bindUIButtons() {
    const S = KV.S;

    document.getElementById('startBtn').onclick = () => {
      S.started = true;
      KV.State.saveGame();
      document.getElementById('introModal').classList.add('hidden');
      KV.State.checkUnlocks();
      try { KV.Audio.updateSpatialAudio(); } catch (e) {}
    };

    document.getElementById('helpBtn').onclick = () => {
      document.getElementById('introModal').classList.remove('hidden');
    };

    document.getElementById('pickPippuriBtn').onclick = () => {
      document.getElementById('commanderModal').classList.add('hidden');
      KV.State.chooseCommander('pippuri');
      KV.Camera.centerOnHero(true);
    };
    document.getElementById('pickTerasBtn').onclick = () => {
      document.getElementById('commanderModal').classList.add('hidden');
      KV.State.chooseCommander('teras');
      KV.Camera.centerOnHero(true);
    };

    document.getElementById('closeSiteModalBtn').onclick = () => {
      activeSiteModalKey = null;
      document.getElementById('siteModal').classList.add('hidden');
    };

    document.getElementById('heroFocusBtn').onclick = () => {
      if (!S.commanderChosen) return;
      const cmdSpec = KV.State.getCommanderSpec();
      if (S.heroMedbayTimer > 0) {
        KV.Camera.centerOnHero(false);
        return;
      }
      if (KV.world.selectedEntity === KV.hero) {
        const dCam = Math.hypot(KV.cam.x - KV.hero.x, KV.cam.y - KV.hero.y);
        if (dCam > 120) {
          KV.Camera.centerOnHero(true);
        } else {
          KV.State.selectUnit(null);
          KV.hero.target = null;
        }
      } else {
        KV.Camera.centerOnHero(true);
        KV.Audio.playSfx('born', 0.30);
        KV.State.showToast(`🎖️ ${cmdSpec.name} valmiina käskyihin!`);
      }
    };

    document.getElementById('manageBtn').onclick = () => {
      document.getElementById('unlockBadge').classList.add('hidden');
      renderManageModal();
      document.getElementById('manageModal').classList.remove('hidden');
    };
    document.getElementById('closeManageBtn').onclick = () => {
      document.getElementById('manageModal').classList.add('hidden');
    };

    document.getElementById('zoomBtn').onclick = () => {
      const presets = [0.54, 0.72, 0.92];
      let nextIdx = 0;
      for (let i = 0; i < presets.length; i++) {
        if ((S.zoom || 0.72) < presets[i] - 0.04) { nextIdx = i; break; }
      }
      KV.Camera.setZoomAtScreenPoint(presets[nextIdx], window.innerWidth / 2, window.innerHeight / 2);
      KV.State.saveGame();
    };

    const syncAudioBtns = () => {
      document.getElementById('musicBtn').textContent = S.musicOn ? '🎵' : '🎵🚫';
      document.getElementById('soundBtn').textContent = S.soundOn ? '🔊' : '🔇';
    };

    document.getElementById('musicBtn').onclick = () => {
      S.musicOn = !S.musicOn;
      syncAudioBtns();
      try { KV.Audio.updateSpatialAudio(); } catch (e) {}
      KV.State.saveGame();
    };

    document.getElementById('soundBtn').onclick = () => {
      S.soundOn = !S.soundOn;
      syncAudioBtns();
      try { KV.Audio.updateSpatialAudio(); } catch (e) {}
      KV.State.saveGame();
    };

    document.getElementById('spaceLaunchBtn').onclick = triggerVictoryLaunch;

    document.getElementById('resetSaveBtn').onclick = () => {
      if (confirm('Nollataanko Kotilaakso v8.2 ja aloitetaan puhtaalta pöydältä?')) {
        KV.State.resetSave();
      }
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
    refreshCommanderVisuals,
    openCommanderModal,
    openSiteModal,
    syncZoomButton,
    syncHeroButton,
    updateHUD,
    renderManageModal,
    bindUIButtons
  };
})();