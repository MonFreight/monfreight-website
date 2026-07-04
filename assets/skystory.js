/* =========================================================
   Mon Freight — Sky story (scroll-driven plane section)
   The section pins to the viewport; scroll progress drives
   the plane's banking, parallax clouds and statement slides.
   ========================================================= */
(function () {
  'use strict';

  var section = document.querySelector('.skystory');
  if (!section) return;

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('requestAnimationFrame' in window)) {
    section.classList.add('static');
    return;
  }

  var plane = section.querySelector('.sky-plane');
  var slides = [].slice.call(section.querySelectorAll('.sky-slide'));
  var far = [].slice.call(section.querySelectorAll('.cloud--far'));
  var mid = [].slice.call(section.querySelectorAll('.cloud--mid'));
  var near = [].slice.call(section.querySelectorAll('.cloud--near'));

  /* Each slide owns a window of scroll progress [start, end] */
  var windows = [
    [0.00, 0.30],
    [0.28, 0.58],
    [0.56, 0.84],
    [0.80, 1.00]
  ];

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* opacity envelope: fade in over first 25% of the window, out over last 25% */
  function envelope(p, s, e) {
    var t = (p - s) / (e - s);
    if (t <= 0 || t >= 1) return 0;
    if (t < 0.25) return t / 0.25;
    if (t > 0.75) return (1 - t) / 0.25;
    return 1;
  }

  var ticking = false;

  function update() {
    ticking = false;
    var rect = section.getBoundingClientRect();
    var vh = window.innerHeight;
    var total = rect.height - vh;
    if (total <= 0) return;
    var p = clamp01(-rect.top / total);

    // Only animate while the section is on screen
    if (rect.bottom < 0 || rect.top > vh) return;

    // Plane: gentle bob, banking and breathing scale
    var bob = Math.sin(p * Math.PI * 3) * 2.2;          // vh
    var bank = Math.sin(p * Math.PI * 2) * 4;           // deg
    var scale = 0.92 + Math.sin(p * Math.PI) * 0.14;    // 0.92 → 1.06 → 0.92
    plane.style.transform =
      'translate(-50%, calc(-50% + ' + bob + 'vh)) rotate(' + bank + 'deg) scale(' + scale + ')';

    // Clouds: three parallax speeds, drifting right-to-left as we "fly"
    var i;
    for (i = 0; i < far.length; i++)
      far[i].style.transform = 'translateX(' + (-p * 22) + 'vw)';
    for (i = 0; i < mid.length; i++)
      mid[i].style.transform = 'translateX(' + (-p * 55) + 'vw)';
    for (i = 0; i < near.length; i++)
      near[i].style.transform = 'translateX(' + (-p * 105) + 'vw)';

    // Statement slides
    for (i = 0; i < slides.length; i++) {
      var wdw = windows[i] || [0, 1];
      var o = envelope(p, wdw[0], wdw[1]);
      slides[i].style.opacity = o;
      var t = clamp01((p - wdw[0]) / (wdw[1] - wdw[0]));
      slides[i].style.transform = 'translateY(' + ((1 - t) * 4 - 2) + 'vh)';
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();

/* =========================================================
   Parcel route — a parcel travels down a dotted route on
   every inner page as you scroll.
   ========================================================= */
(function () {
  'use strict';

  // All inner pages (they have a page-hero); the homepage has its sky story
  var hero = document.querySelector('.page-hero');
  var footer = document.querySelector('.footer');
  if (!hero || !footer || document.querySelector('.skystory')) return;

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  var wrap = document.createElement('div');
  wrap.className = 'svc-flight';
  wrap.setAttribute('aria-hidden', 'true');
  document.body.appendChild(wrap);

  // Winged parcel: navy box, amber tape, light-teal wings with winglets
  var plane = document.createElement('div');
  plane.className = 'svc-parcel';
  plane.innerHTML =
    '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M15 25 L 3 34 L 6 36 L 15 32 Z" fill="#34aecb"/>' +
      '<path d="M3 34 L 1 28 L 4 31 Z" fill="#0a6f86"/>' +
      '<path d="M49 25 L 61 34 L 58 36 L 49 32 Z" fill="#34aecb"/>' +
      '<path d="M61 34 L 63 28 L 60 31 Z" fill="#0a6f86"/>' +
      '<rect x="13" y="13" width="38" height="29" rx="5" fill="#073a45"/>' +
      '<path d="M13 22 L32 13 L51 22" fill="none" stroke="#0a5563" stroke-width="2"/>' +
      '<rect x="29" y="13" width="6" height="29" rx="1" fill="#f6a821"/>' +
      '<rect x="13" y="13" width="38" height="29" rx="5" fill="none" stroke="rgba(7,58,69,.5)" stroke-width="1.5"/>' +
    '</svg>';

  var svg = null, route = null, reveal = null, pathEl = null, totalLen = 0;

  function build() {
    var top = hero.getBoundingClientRect().bottom + window.pageYOffset + 40;
    var bottom = footer.getBoundingClientRect().top + window.pageYOffset - 40;
    var H = Math.max(200, bottom - top);
    var vw = document.documentElement.clientWidth;

    // Right-hand gutter if there is one, otherwise hug the edge
    var gutter = (vw - 1180) / 2;
    var x = gutter > 110 ? (vw + 1180) / 2 + gutter / 2 : vw - (vw < 640 ? 34 : 56);

    wrap.style.top = top + 'px';
    wrap.style.left = (x - 40) + 'px';
    wrap.style.width = '80px';
    wrap.style.height = H + 'px';

    var d = 'M 40 0' +
            ' C 85 ' + (H * 0.30) + ', -5 ' + (H * 0.60) + ', 40 ' + H;
    wrap.innerHTML =
      '<svg width="80" height="' + H + '">' +
        '<defs><mask id="svcReveal">' +
          '<path class="svc-reveal" d="' + d + '" pathLength="100" fill="none" ' +
            'stroke="#fff" stroke-width="8" stroke-dasharray="100" stroke-dashoffset="100"/>' +
        '</mask></defs>' +
        '<path class="svc-route" d="' + d + '" pathLength="100" mask="url(#svcReveal)"/>' +
      '</svg>';
    wrap.appendChild(plane);

    svg = wrap.querySelector('svg');
    route = wrap.querySelector('.svc-route');
    reveal = wrap.querySelector('.svc-reveal');
    pathEl = route;
    totalLen = (pathEl.getTotalLength) ? pathEl.getTotalLength() : 0;
    return { top: top, H: H };
  }

  var geo = build();

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  var ticking = false;

  function update() {
    ticking = false;
    var vh = window.innerHeight;

    // Rebuild if the page height changed (e.g. accordions opened/closed)
    var footTop = footer.getBoundingClientRect().top + window.pageYOffset - 40;
    if (Math.abs(footTop - (geo.top + geo.H)) > 8) geo = build();

    var start = geo.top - vh * 0.75;
    var end = geo.top + geo.H - vh * 0.45;
    // Never demand more scroll than the page actually has,
    // so the parcel always reaches the end of the route
    var maxScroll = Math.max(0,
      document.documentElement.scrollHeight - vh);
    if (end > maxScroll) end = maxScroll;
    if (end <= start) end = start + 1;
    var p = clamp01((window.pageYOffset - start) / (end - start));

    reveal.style.strokeDashoffset = 100 - p * 100;

    var x = 40, y = p * geo.H;
    if (totalLen) {
      var pt = pathEl.getPointAtLength(p * totalLen);
      x = pt.x; y = pt.y;
    }
    var ang = Math.sin(p * Math.PI * 4) * 10; // gentle tumble
    var hw = (plane.offsetWidth || 56) / 2;
    var hh = (plane.offsetHeight || 42) / 2;
    plane.style.transform =
      'translate(' + (x - hw) + 'px, ' + (y - hh) + 'px) rotate(' + ang + 'deg)';
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { geo = build(); onScroll(); }, { passive: true });
  update();
})();
