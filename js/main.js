// ============================================================================
// js/main.js – Käynnistys ja virhesuojattu (crash-proof) pääsilmukka
// ============================================================================
window.KV = window.KV || {};

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  KV.Render.loadImages(ctx);
  KV.Camera.bindInput(canvas);
  KV.UI.bindUIButtons();
  KV.UI.updateHUD();

  let last = performance.now();

  function loop(now) {
    // Kutsutaan requestAnimationFrame AINA ensimmäisenä, jotta peli ei voi koskaan pysähtyä!
    requestAnimationFrame(loop);

    const rawDt = (now - last) / 1000;
    last = now;
    const dt = Number.isFinite(rawDt) ? Math.max(0, Math.min(0.05, rawDt)) : 0.016;

    try {
      KV.AI.update(dt);
      KV.Render.draw(canvas, ctx);
    } catch (err) {
      console.error('Kotilaakso v8.0 frame recovery:', err);
    }
  }

  requestAnimationFrame(loop);
})();
