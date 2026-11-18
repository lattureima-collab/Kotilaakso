// ============================================================================
// js/ui.js – Yläpalkin, hahmonvalinnan, hoitokapselin ja hallintavalikon päivitys (v8.1)
// ============================================================================
window.KV = window.KV || {};

(() => {
  const { AVATARS } = KV.CFG;

  function renderAvatarPicker(playSound = false) {
    const av = AVATARS[KV.S.avatarIdx || 0];
    document.getElementById('avatarShowcaseImg').src = `assets/${av.sprite}.png`;
    document.getElementById('heroHudIcon').src = `assets/${av.sprite}.png`;
    document.getElementById('avatarName').textContent = av.name;
    document.getElementById('avatarBio').textContent = av.bio;
    document.getElementById('avatarQuote').textContent = av.quote;
    if (playSound) KV.Audio.playSfx('born', 0.35);
  }

  function syncZoomButton() {
    const btn = document.getElementById('zoomBtn');
    if (btn) btn.textContent = `🔍 ${Math.round((KV.S.zoom || 0.75) * 100)}%`;
  }

  function syncHeroButton() {
    const btn = document.getElementById('heroFocusBtn');
    const txt = document.getElementById('heroBtnTxt');
    if (!btn || !txt) return;
    if (KV.S.heroMedbayTimer > 0) {
      btn.classList.remove('hero-active');
      txt.textContent = `Hoitokapseli (${Math.ceil(KV.S.heroMedbayTimer)}s)`;
      return;
    }
    const isSel = (KV.world.selectedEntity === KV.hero);
    btn.classList.toggle('hero-active', isSel);
    txt.textContent = isSel ? 'Sankari Aktiivinen' : 'Aktivoi Sankari';
  }

  function updateHUD() {
    const { S, hero, world } = KV;
    const hpPct = Math.round((hero.hp / hero.maxHp) * 100);
    document.getElementById('suitTxt').textContent = S.heroMedbayTimer > 0
      ? `🏥 ${Math.ceil(S.heroMedbayTimer)}s`
      : `${hpPct}%`;
    document.getElementById('suitBar').style.width = `${hpPct}%`;
    document.getElementById('suitBar').style.background = S.heroMedbayTimer > 0 ? '#ef4444' : 'var(--green)';

    document.getElementById('popTxt').textContent = `${KV.State.getFreeCarriersCount()}/${S.workerCount}`;
    const stewRounded = Math.ceil(S.stew);
    document.getElementById('stewTxt').textContent = stewRounded <= 0 ? 'TYHJÄ!' : stewRounded;
    document.getElementById('stewPill').classList.toggle('hungry', stewRounded <= 0);
    document.getElementById('turnipTxt').textContent = S.piles.turnipsAtField;

    document.getElementById('logTxt').textContent = S.piles.logsAtForest;
    document.getElementById('boardTxt').textContent = S.buildings.sawmill.outBoards;
    document.getElementById('oatTxt').textContent = S.piles.oatsAtField;
    document.getElementById('flourTxt').textContent = S.buildings.mill.outFlour;
    document.getElementById('breadTxt').textContent = `${S.breads}/5`;
    document.getElementById('coinTxt').textContent = S.coins;
    document.getElementById('oxTxt').textContent = S.oxCount;
    document.getElementById('solTxt').textContent = S.soldierCount + (S.hasSergeant ? 1 : 0);

    if (world.frostActive > 0) {
      document.getElementById('weatherTxt').innerHTML = '<strong style="color:#bae6fd">❄️ HALLA!</strong>';
    } else {
      document.getElementById('weatherTxt').textContent = '☀️ Kirkas';
    }

    let goal = '';
    if (S.heroMedbayTimer > 0) goal = `🏥 Lentäjä toipuu Tähtialuksen hoitokapselissa (${Math.ceil(S.heroMedbayTimer)}s) – voit myös pikakorjata puvun valikosta!`;
    else if (S.stew <= 0.05) goal = '🚨 NÄLKÄLAKKO! Pidä Kokki-Puutarhuri keittiöllä, jotta pata täyttyy!';
    else if (!S.unlocks.house) goal = `⭐ Raivaa puita metsän reunasta (${S.piles.logsAtForest}/4 tukkia) – myös Sankari voi auttaa!`;
    else if (S.buildings.house1.state !== 'built') goal = '⭐ Tilaa Hirsitalo 1 ja vie Sankari tai rakentaja työmaalle!';
    else if (!S.unlocks.sawmill) goal = '⭐ Seuraa kuistilla vauvan kasvua 5. työläiseksi (tai etsi Sankarilla metsän tarvikelaatikko)!';
    else if (S.buildings.sawmill.state !== 'built') goal = '⭐ Rakenna Iso Lautatarha (ja raivaa tarvittaessa Suuri Naurispelto)!';
    else if (!S.unlocks.oxPen) goal = `⭐ Laita sahaaja Lautatarhalle sahaamaan lautoja (${S.buildings.sawmill.outBoards}/4)!`;
    else if (S.oxCount === 0) goal = '⭐ Rakenna Härkäaitaus ja kesytä Juhta-Härkä nauriilla kantoavuksi!';
    else if (S.buildings.bridge.state !== 'built') goal = '⭐ Rakenna Puinen Kaarisilta joen yli itämetsään!';
    else if (!S.everBakedBread) goal = '⭐ Raivaa itämetsään Kaurapelto, Vesimylly ja Leipomo!';
    else if ((S.soldierCount + (S.hasSergeant ? 1 : 0)) < 2) goal = '⭐ Rakenna Kasarmi ja kouluta Kersantti Kipinä sekä kaartilaisia!';
    else goal = '🏆 Kotilaakso kukoistaa! Lentäjä ja miehistö ovat valmiina Tähtialukseen!';
    document.getElementById('nextGoalTxt').textContent = goal;

    syncHeroButton();
    const milReady = (S.soldierCount + (S.hasSergeant ? 1 : 0)) >= 2;
    const ready = S.heroMedbayTimer <= 0 && S.buildings.barracks.state === 'built' && milReady && S.workerCount >= 6;
    document.getElementById('spaceLaunchBtn').classList.toggle('hidden', !ready);
  }

  function renderManageModal() {
    const S = KV.S;
    document.getElementById('freeCarriersHdr').textContent = KV.State.getFreeCarriersCount();

    // Hoitokapselin pikakorjauskortti, jos Sankari on evakuoituna
    const medBanner = document.getElementById('medbayBanner');
    if (S.heroMedbayTimer > 0) {
      medBanner.classList.remove('hidden');
      const useCoin = S.coins >= 1;
      const stewReq = useCoin ? 8 : 14;
      const canHeal = S.stew >= stewReq + 2;
      const costTxt = useCoin ? '1 🪙 + 8 🍲' : '14 🍲';
      medBanner.innerHTML = `
        <div class="job-info">
          <img src="assets/starship.png" class="card-thumb" alt="">
          <div>
            <strong>🏥 Tähtialuksen Hoitokapseli (${Math.ceil(S.heroMedbayTimer)} s)</strong>
            <span>Lentäjän suojapuku korjautuu automaattisesti, tai voit pikakorjata sen heti (${costTxt}).</span>
          </div>
        </div>
        <button class="buy-btn green" id="instantHealBtn" ${!canHeal ? 'disabled' : ''}>Pikakorjaa (${costTxt})</button>
      `;
      const hBtn = document.getElementById('instantHealBtn');
      if (hBtn && canHeal) {
        hBtn.onclick = () => {
          if (useCoin) S.coins -= 1;
          S.stew = Math.max(0, S.stew - stewReq);
          S.heroMedbayTimer = 0;
          KV.hero.hp = KV.hero.maxHp;
          KV.Audio.playSfx('build_done', 0.55);
          KV.State.showToast('⚡ Suojapuku pikakorjattu! Lentäjä on jälleen valmiina kentällä!');
          KV.State.saveGame();
          renderManageModal();
          updateHUD();
        };
      }
    } else {
      medBanner.classList.add('hidden');
    }

    const jobsBox = document.getElementById('jobsContainer');
    const buildBox = document.getElementById('buildContainer');
    jobsBox.innerHTML = '';
    buildBox.innerHTML = '';

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
    addJobRow('cookGardeners', 'kitchen', '🍲 Kyläkeittiön Kokki-Puutarhuri (Max 2)', 'Hoitaa Kotitarhaa, kantaa nauriit ja keittää Naurispataa!', 2, minCook);
    addJobRow('woodcutters', 'char_woodcutter_f', '🌲 Metsurit (Metsän raivaus)', 'Kaatavat lähimmät tukkipuut kylän ympäriltä (max 30 tukkia pinossa).');
    if (S.fields.turnip.active) addJobRow('turnipFarmers', 'char_farmer_f', '🌱 Suuren Naurispellon viljelijät', 'Tuottaa nauriskoreja kasvavan kylän ja Juhta-Härkien tarpeisiin.');
    if (S.buildings.sawmill.state === 'built') addJobRow('sawyers', 'sawmill', '🪚 Lautatarhan Sahaaja (Max 2)', 'Hakee tukit tarvittaessa itse ja sahaa lautoja (1 tukki = 2 lautaa).', 2);
    if (S.fields.oat.active) addJobRow('oatFarmers', 'item_oat', '🌾 Itärannan Kauraviljelijät', 'Kasvattaa kauraa itämetsän pellolla Vesimyllyä varten.');
    if (S.buildings.mill.state === 'built') addJobRow('millers', 'watermill', '⚙️ Vesimyllyn Mylläri (Max 1)', 'Jauhaa kaurasta jauhosäkkejä Leipomolle.', 1);
    if (S.buildings.bakery.state === 'built') addJobRow('bakers', 'char_baker_f', '🥖 Leipomon Leipuri (Max 1)', 'Paistaa leipäkoreja sillan yli keskustaan kuljetettavaksi!', 1);

    const addSiteCard = (key, thumb, title, idleDesc, builtDesc, unlockCond = true, extraOrderCheck = true, onOrderExtra = null) => {
      if (!unlockCond) return;
      const b = S.buildings[key];
      const card = document.createElement('div');
      const underWork = (b.state === 'building' || b.state === 'ruined');
      card.className = 'build-card' + (underWork ? ' active-site' : '');

      if (b.state === 'none') {
        const req = `${b.logsNeed}🌲${b.boardsNeed ? ` ${b.boardsNeed}🪵` : ''}`;
        card.innerHTML = `
          <div class="job-info">
            <img src="assets/${thumb}.png" class="card-thumb" alt="">
            <div><strong>${title}</strong><span>${idleDesc} (Tarve: ${req})</span></div>
          </div>
          <button class="buy-btn green" ${!extraOrderCheck ? 'disabled' : ''}>Raivaa & Tilaa</button>
        `;
        if (extraOrderCheck) {
          card.querySelector('button').onclick = () => {
            if (onOrderExtra) onOrderExtra();
            b.state = 'building';
            KV.State.clearReservedZones(true);
            KV.Audio.playSfx('chop', 0.36);
            if (KV.State.getFreeCarriersCount() > 0) {
              b.builders = 1;
              KV.State.reassignWorkerRoles();
              KV.State.showToast(`🔨 Tontti raivattu metsästä: ${title} aloitettu!`);
            } else {
              KV.State.showToast(`🔨 Tontti raivattu: ${title} tilattu! Lisää rakentaja (+) tai napauta kyläläistä kartalla.`);
            }
            KV.State.saveGame();
            renderManageModal();
            updateHUD();
          };
        }
      } else if (underWork) {
        const canAddB = KV.State.getFreeCarriersCount() > 0 && (b.builders || 0) < 3;
        const matTxt = `Materiaalit: 🌲${b.logsIn}/${b.logsNeed}${b.boardsNeed ? ` • 🪵${b.boardsIn}/${b.boardsNeed}` : ''} • Valmius: ${Math.round(b.prog * 100)}%`;
        const workThumb = (key === 'bridge' || key === 'oxPen') ? thumb : 'scaffolding';
        card.innerHTML = `
          <div class="job-info">
            <img src="assets/${workThumb}.png" class="card-thumb" alt="">
            <div>
              <strong>${b.state === 'ruined' ? '🔥 Korjaus:' : '🔨 Rakenteilla:'} ${title}</strong>
              <span>${matTxt}<br><strong style="color:#fde047">Rakentajia kohteessa:</strong></span>
            </div>
          </div>
          <div class="stepper">
            <button class="step-btn" data-bdir="-1" ${(b.builders || 0) <= 0 ? 'disabled' : ''}>−</button>
            <span class="step-val">${b.builders || 0}</span>
            <button class="step-btn" data-bdir="1" ${!canAddB ? 'disabled' : ''}>+</button>
          </div>
        `;
        card.querySelectorAll('.step-btn').forEach(btn => {
          btn.onclick = () => {
            b.builders = Math.max(0, (b.builders || 0) + Number(btn.dataset.bdir));
            KV.State.reassignWorkerRoles();
            KV.State.saveGame();
            renderManageModal();
            updateHUD();
          };
        });
      } else {
        card.innerHTML = `
          <div class="job-info">
            <img src="assets/${thumb}.png" class="card-thumb" alt="">
            <div><strong>✅ ${title}</strong><span>${builtDesc}</span></div>
          </div>
          <button class="buy-btn" disabled>VALMIS</button>
        `;
      }
      buildBox.appendChild(card);
    };

    const addActionCard = (thumb, title, desc, btnTxt, disabled, onClick, style = 'amber') => {
      const card = document.createElement('div');
      card.className = 'build-card';
      card.innerHTML = `
        <div class="job-info">
          <img src="assets/${thumb}.png" class="card-thumb" alt="">
          <div><strong>${title}</strong><span>${desc}</span></div>
        </div>
        <button class="buy-btn ${style}" ${disabled ? 'disabled' : ''}>${btnTxt}</button>
      `;
      if (!disabled) {
        card.querySelector('button').onclick = () => {
          onClick();
          KV.State.saveGame();
          renderManageModal();
          updateHUD();
        };
      }
      buildBox.appendChild(card);
    };

    if (S.unlocks.house) {
      ['house1', 'house2', 'house3'].forEach((hk, i) => {
        if (i > 0 && S.buildings[`house${i}`].state !== 'built') return;
        const h = S.buildings[hk];
        addSiteCard(
          hk, 'cabin', `Hirsitalo ${i + 1}`,
          `Kasvattaa ${h.maxRes} uutta kyläläistä haalarivauvasta aikuisiksi!`,
          `Asukkaita kasvanut: ${h.residents}/${h.maxRes} ${h.residents < h.maxRes ? `• Kasvu nyt: ${Math.round(h.spawnProg * 100)}%` : '(Täynnä)'}`
        );
      });
    }

    if (S.unlocks.bigTurnip) {
      const tf = S.fields.turnip;
      addActionCard(
        'field_turnip_ripe', 'Suuri Naurispelto (Etelämetsän raivaus)',
        tf.active ? 'Käytössä! Kantajat ja Juhta-Härät vievät nauriit Kyläkeittiöön.' : 'Raivaa luonnollinen naurispelto etelämetsään kasvavalle kylälle ja Juhta-Härille!',
        tf.active ? 'KÄYTÖSSÄ' : 'Raivaa pelto',
        tf.active,
        () => {
          tf.active = true; tf.stage = 1; tf.prog = 0;
          KV.State.clearReservedZones(true);
          KV.Audio.playSfx('dig', 0.36);
          if (KV.State.getFreeCarriersCount() > 0 && S.jobs.turnipFarmers === 0) {
            S.jobs.turnipFarmers = 1; KV.State.reassignWorkerRoles();
          }
        }, 'green'
      );
    }

    if (S.unlocks.sawmill) {
      addSiteCard(
        'sawmill', 'sawmill', 'Iso Lautatarha',
        'Sahaa tukeista lautoja Härkäaitausta, Kaarisiltaa ja itärannan rakennuksia varten.',
        `Valmiita lautoja pinossa: ${S.buildings.sawmill.outBoards}/24 🪵`
      );
    }

    if (S.unlocks.oxPen) {
      addSiteCard(
        'oxPen', 'ox_pen', 'Härkäaitaus (Juhta-laidun)',
        'Houkuttele Juhta-Härkiä Naurispadalla ennen silta- ja itärantaurakkaa!',
        `Aitauksessa ${S.oxCount} Juhta-Härkää (4x kantokyky ja ravaavat sorkat!).`
      );
      if (S.buildings.oxPen.state === 'built') {
        const stewCost = 10 + S.oxCount * 4;
        addActionCard(
          'ox_loaded', `Kesytä Juhta-Härkä nauriilla (${S.oxCount}/4)`,
          `Ei vaadi kolikoita! Vaatii ${stewCost} annosta Naurispataa (padassa nyt ${Math.floor(S.stew)}).`,
          S.oxCount >= 4 ? 'MAX 4 HÄRKÄÄ' : `Kesytä (${stewCost} 🍲)`,
          S.oxCount >= 4 || S.stew < stewCost + 4,
          () => {
            S.stew -= stewCost; S.oxCount++;
            KV.State.syncEntitiesFromSave();
            KV.Audio.playSfx('ox', 0.50);
            KV.State.showToast('🐂 Vahva Juhta-Härkä liittyi kylään kantamaan kuormia!');
          }, 'amber'
        );
      }
    }

    if (S.unlocks.oatChain) {
      addSiteCard(
        'bridge', 'bridge', 'Puinen Kaarisilta (Joen ylitys)',
        'Avaa tien joen itäpuolen tiheään metsään kaurapellolle, myllylle ja leipomolle!',
        `Kunnossa (${Math.round(S.buildings.bridge.hp)}/${S.buildings.bridge.maxHp} HP)`
      );

      const bridgeDone = S.buildings.bridge.state === 'built';
      const of = S.fields.oat;
      addActionCard(
        'field_oat_ripe', 'Suuri Kaurapelto (Itärannan metsäaukio)',
        of.active
          ? 'Käytössä itärannalla! Vilja jauhetaan Vesimyllyssä ja leivät tuodaan sillan yli.'
          : (bridgeDone ? 'Raivaa kultainen kaurapelto joen itäpuolen metsään!' : '🔒 Rakenna ensin Puinen Kaarisilta valmiiksi!'),
        of.active ? 'KÄYTÖSSÄ' : 'Raivaa Kaurapelto',
        of.active || !bridgeDone,
        () => {
          of.active = true; of.stage = 1; of.prog = 0;
          KV.State.clearReservedZones(true);
          KV.Audio.playSfx('dig', 0.36);
          if (KV.State.getFreeCarriersCount() > 0 && S.jobs.oatFarmers === 0) {
            S.jobs.oatFarmers = 1; KV.State.reassignWorkerRoles();
          }
        }, 'green'
      );

      addSiteCard(
        'mill', 'watermill', 'Joen Vesimylly (Itäranta)',
        bridgeDone ? 'Jauhaa itärannan kaurasta jauhosäkkejä Leipomoon.' : '🔒 Rakenna ensin Puinen Kaarisilta valmiiksi!',
        `Jauhosäkkejä valmiina: ${S.buildings.mill.outFlour}`,
        true, bridgeDone
      );
      addSiteCard(
        'bakery', 'bakery', 'Kylän Leipomo (Itäranta)',
        bridgeDone ? 'Paistaa leipäkoreja, jotka härät ja kantajat tuovat sillan yli (+1 🪙 / 5 leipää)!' : '🔒 Rakenna ensin Puinen Kaarisilta valmiiksi!',
        `Kiviuuni lämpimänä – leipiä korissa nyt: ${S.buildings.bakery.outBreads || 0}`,
        true, bridgeDone
      );
    }

    if (S.unlocks.barracks) {
      const brk = S.buildings.barracks;
      addSiteCard(
        'barracks', 'barracks', 'Kaurakaartin Kasarmi (2 🪙)',
        'Vaatii tilatessa 2 🪙 sekä tukkeja ja lautoja.',
        `Kouluttaa kaartilaisia ja Kersantti Kipinän! Vahvuus: ${S.soldierCount + (S.hasSergeant ? 1 : 0)}`,
        true, S.coins >= 2 && S.workerCount >= 5,
        () => { S.coins -= 2; }
      );
      if (brk.state === 'built') {
        // Punatukkainen Kersantti Kipinä!
        addActionCard(
          'char_sergeant', 'Kersantti Kipinä (Punatukkainen Ryhmänjohtaja)',
          S.hasSergeant
            ? 'Kentällä! Napauta Kersanttia kartalla määrätäksesi vartiopaikan (+30 % tulinopeus ryhmälle).'
            : (brk.trainQueued && brk.trainType === 'sergeant'
              ? `Varustautuu Kasarmilla: ${Math.round(brk.trainProg * 100)}%`
              : '2x kestävyys, sarjatuli-pulssikivääri ja etulinjan johtaja-aura! Vaatii 3 🪙 + 10 🍲.'),
          S.hasSergeant ? 'KENTÄLLÄ' : (brk.trainQueued ? 'Koulutuksessa...' : 'Värvää (3 🪙 + 10 🍲)'),
          S.hasSergeant || brk.trainQueued || S.coins < 3 || S.stew < 13,
          () => {
            S.coins -= 3; S.stew -= 10;
            brk.trainQueued = true; brk.trainType = 'sergeant'; brk.trainProg = 0;
            KV.Audio.playSfx('born', 0.48);
            KV.State.showToast('🔥 Kersantti Kipinän varustelu aloitettu Kasarmilla!');
          }, 'amber'
        );

        addActionCard(
          'char_soldier_f', `Kouluta Kaurakaartilainen (${S.soldierCount} rivissä)`,
          brk.trainQueued && brk.trainType === 'soldier'
            ? `Kasvamassa Kasarmin pihalla: ${Math.round(brk.trainProg * 100)}%`
            : 'Vaatii 2 🪙 ja 8 annosta Naurispataa. Napauta kartalla määrätäksesi vartiopaikan!',
          brk.trainQueued ? 'Koulutuksessa...' : 'Kouluta (2 🪙 + 8 🍲)',
          brk.trainQueued || S.coins < 2 || S.stew < 12,
          () => {
            S.coins -= 2; S.stew -= 8;
            brk.trainQueued = true; brk.trainType = 'soldier'; brk.trainProg = 0;
            KV.Audio.playSfx('born', 0.45);
            KV.State.showToast('🛡️ Alokas saapui Kasarmille kasvamaan kaartilaiseksi!');
          }, 'amber'
        );
      }
    }
  }

  function bindUIButtons() {
    const S = KV.S;

    document.getElementById('prevAvatarBtn').onclick = () => {
      S.avatarIdx = ((S.avatarIdx || 0) - 1 + AVATARS.length) % AVATARS.length;
      renderAvatarPicker(true);
      KV.State.saveGame();
    };
    document.getElementById('nextAvatarBtn').onclick = () => {
      S.avatarIdx = ((S.avatarIdx || 0) + 1) % AVATARS.length;
      renderAvatarPicker(true);
      KV.State.saveGame();
    };

    document.getElementById('startBtn').onclick = () => {
      S.started = true;
      KV.State.saveGame();
      document.getElementById('introModal').classList.add('hidden');
      KV.Audio.updateSpatialAudio();
    };

    document.getElementById('helpBtn').onclick = () => {
      document.getElementById('introModal').classList.remove('hidden');
    };

    document.getElementById('heroFocusBtn').onclick = () => {
      if (S.heroMedbayTimer > 0) {
        KV.Camera.centerOnHero(false);
        return;
      }
      if (KV.world.selectedEntity === KV.hero) {
        const dCam = Math.hypot(KV.cam.x - KV.hero.x, KV.cam.y - KV.hero.y);
        if (dCam > 120) {
          KV.Camera.centerOnHero(true);
          KV.State.showToast('👨‍🚀 Kamera keskitetty Sankariin!');
        } else {
          KV.State.selectUnit(null);
          KV.hero.target = null;
        }
      } else {
        KV.Camera.centerOnHero(true);
        KV.Audio.playSfx('born', 0.30);
        KV.State.showToast('👨‍🚀 Sankari aktivoitu! Napauta maata, puuta, työmaata tai tarvikelaatikkoa.');
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
      KV.Audio.updateSpatialAudio();
      KV.State.saveGame();
    };

    document.getElementById('soundBtn').onclick = () => {
      S.soundOn = !S.soundOn;
      syncAudioBtns();
      KV.Audio.updateSpatialAudio();
      KV.State.saveGame();
    };

    document.getElementById('spaceLaunchBtn').onclick = () => {
      KV.Audio.playSfx('build_done', 0.6);
      KV.State.showToast('🚀 Kotilaakso v8.1 valmis! Seuraavassa portaassa (v8.2) nousevat Leipämyymälä, Pankki ja Länsirannan Kivilinko!');
    };

    document.getElementById('resetSaveBtn').onclick = () => {
      if (confirm('Nollataanko Kotilaakso v8.1 ja aloitetaan puhtaalta pöydältä?')) {
        KV.State.resetSave();
      }
    };

    renderAvatarPicker(false);
    syncZoomButton();
    syncHeroButton();
    syncAudioBtns();
    if (S.started) document.getElementById('introModal').classList.add('hidden');
  }

  KV.UI = {
    renderAvatarPicker,
    syncZoomButton,
    syncHeroButton,
    updateHUD,
    renderManageModal,
    bindUIButtons
  };
})();
