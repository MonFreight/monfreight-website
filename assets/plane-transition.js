/* =========================================================
   Mon Freight — Airplane page transition
   The plane takes off, the new page opens almost instantly,
   and the flight finishes over the new page.
   ========================================================= */
(function () {
  'use strict';

  /* ---------------- Settings ---------------- */
  var CONFIG = {
    enabled: true,          // master switch
    disableOnMobile: false, // set to true to turn the animation off on phones
    mobileBreakpoint: 640,  // px — what counts as "mobile"
    duration: 2000,         // ms — total flight time
    navDelay: 350,          // ms — how soon the next page opens after the click
    planeImage: 'assets/plane.png' // airplane PNG (leave '' to use the built-in SVG jet)
  };

  /* ---------------- Guards ---------------- */
  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animationAllowed() {
    if (!CONFIG.enabled || reducedMotion) return false;
    if (CONFIG.disableOnMobile && window.innerWidth <= CONFIG.mobileBreakpoint) return false;
    if (typeof Element === 'undefined' || !Element.prototype.animate) return false;
    return true;
  }

  /* ---------------- Plane markup ---------------- */
  var PLANE_SVG =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><linearGradient id="mfPlaneG" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#0a6f86"/><stop offset="1" stop-color="#073a45"/>' +
      '</linearGradient></defs>' +
      '<g transform="rotate(90 12 12)">' +
        '<path fill="url(#mfPlaneG)" d="M21.5 15.5v-2l-8-5V3.06c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5V8.5l-8 5v2l8-2.5v5.5l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-5.5l8 2.5z"/>' +
      '</g>' +
    '</svg>';

  /* ---------------- Flight renderer ----------------
     elapsed: how far into the flight we already are (ms).
     0 on the outgoing page; >0 when resuming on the new page. */
  function launchFlight(elapsed, dur, withWash) {
    var w = window.innerWidth;
    var h = window.innerHeight;

    // Climbing curve: enters bottom-left, exits upper-right.
    // The climb is capped at ~30 degrees on any screen: the total rise
    // never exceeds tan(30) x horizontal travel, and the gentle S-bow
    // keeps the local slope close to that average.
    var x0 = -90, x1 = w + 120;
    var dx = x1 - x0;
    var rise = Math.min(h * 0.55, 0.577 * dx); // tan(30deg) = 0.577
    var yMid = h * 0.46;
    var y0 = yMid + rise / 2, y1 = yMid - rise / 2;
    var d = 'M ' + x0 + ' ' + y0 +
            ' C ' + (x0 + dx / 3) + ' ' + (y0 - rise / 3 - rise * 0.08) + ', ' +
                    (x0 + dx * 2 / 3) + ' ' + (y0 - rise * 2 / 3 + rise * 0.08) + ', ' +
                    x1 + ' ' + y1;

    var overlay = document.createElement('div');
    overlay.className = 'mf-plane-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<svg class="mf-route-svg" width="100%" height="100%">' +
        '<defs><mask id="mfReveal">' +
          '<path class="mf-reveal" d="' + d + '" pathLength="100" fill="none" ' +
            'stroke="#fff" stroke-width="8" stroke-dasharray="100" stroke-dashoffset="100"/>' +
        '</mask></defs>' +
        '<path class="mf-route" d="' + d + '" pathLength="100" mask="url(#mfReveal)"/>' +
      '</svg>' +
      '<div class="mf-plane' + (CONFIG.planeImage ? ' mf-plane--img' : '') + '">' +
        (CONFIG.planeImage
          ? '<img src="' + CONFIG.planeImage + '" alt="" style="animation-duration:' + dur +
            'ms;animation-delay:-' + elapsed + 'ms">'
          : PLANE_SVG) +
      '</div>';
    document.body.appendChild(overlay);

    var plane = overlay.querySelector('.mf-plane');
    var reveal = overlay.querySelector('.mf-reveal');
    var easing = 'cubic-bezier(.45,.05,.55,.95)';
    var motionOK = window.CSS && CSS.supports && CSS.supports('offset-path', 'path("M0 0 L10 10")');
    // Negative delay resumes the flight exactly where it left off
    var opts = { duration: dur, delay: -elapsed, easing: easing, fill: 'both' };

    if (motionOK) {
      plane.style.offsetPath = 'path("' + d + '")';
      plane.style.offsetRotate = 'auto';
      plane.animate([{ offsetDistance: '0%' }, { offsetDistance: '100%' }], opts);
    } else {
      plane.style.top = h * 0.45 + 'px';
      plane.animate(
        [
          { transform: 'translate(-90px, 40px) rotate(6deg)' },
          { transform: 'translate(' + (w + 120) + 'px, -40px) rotate(-6deg)' }
        ], opts);
    }

    // Dotted trail revealed behind the plane
    reveal.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], opts);

    // Soft white wash on the outgoing page only, so the handover looks smooth
    if (withWash) {
      overlay.animate(
        [{ backgroundColor: 'rgba(255,255,255,0)' }, { backgroundColor: 'rgba(255,255,255,.5)' }],
        { duration: CONFIG.navDelay + 200, easing: 'ease-in', fill: 'forwards' }
      );
    }

    // Clean up once the plane has left the screen
    var remaining = Math.max(0, dur - elapsed);
    setTimeout(function () {
      overlay.style.transition = 'opacity .25s ease';
      overlay.style.opacity = '0';
      setTimeout(function () { overlay.remove(); }, 300);
    }, remaining + 100);

    return overlay;
  }

  /* ---------------- Resume flight on arrival ---------------- */
  try {
    var saved = sessionStorage.getItem('mf-fly');
    if (saved) {
      sessionStorage.removeItem('mf-fly');
      var info = JSON.parse(saved);
      var elapsed = Date.now() - info.t0;
      // Resume from the last position the user actually saw (no jump)
      elapsed = Math.min(elapsed, (info.nav || 350) + 120);
      if (animationAllowed() && elapsed > 0 && elapsed < info.dur - 100) {
        launchFlight(elapsed, info.dur, false);
      }
      // Gentle page fade-in
      document.documentElement.classList.add('mf-arrive');
      setTimeout(function () {
        document.documentElement.classList.remove('mf-arrive');
      }, 700);
    }
  } catch (e) { /* sessionStorage unavailable — ignore */ }

  /* ---------------- Departure ---------------- */
  var flying = false;

  function fly(href) {
    flying = true;
    var dur = Math.max(400, Math.min(CONFIG.duration, 2500));

    try {
      sessionStorage.setItem('mf-fly', JSON.stringify({ t0: Date.now(), dur: dur, nav: CONFIG.navDelay }));
    } catch (e) { /* ignore */ }

    launchFlight(0, dur, true);

    // Prefetch the next page while the plane is in the air
    try {
      var pre = document.createElement('link');
      pre.rel = 'prefetch';
      pre.href = href;
      document.head.appendChild(pre);
    } catch (e) { /* ignore */ }

    var done = false;
    function go() {
      if (done) return;
      done = true;
      window.location.href = href;
    }
    setTimeout(go, CONFIG.navDelay);       // page opens quickly…
    setTimeout(go, CONFIG.navDelay + 400); // safety net
  }

  /* ---------------- Link interception ---------------- */
  document.addEventListener('click', function (ev) {
    if (flying) { ev.preventDefault(); return; }
    if (ev.defaultPrevented || ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    if (a.getAttribute('data-no-fly') !== null) return; // opt-out per link

    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return;

    var url;
    try { url = new URL(a.href, window.location.href); } catch (e) { return; }
    if (url.origin !== window.location.origin) return;
    if (!/\.html?$/i.test(url.pathname) && url.pathname !== '/' && !/\/$/.test(url.pathname)) return;
    // Same page + hash → let the browser scroll normally
    if (url.pathname === window.location.pathname && url.hash) return;

    if (!animationAllowed()) return; // normal instant navigation

    ev.preventDefault();
    fly(url.href);
  }, true);
})();
