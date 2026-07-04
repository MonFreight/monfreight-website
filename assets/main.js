/* Mon Freight — shared interactions */
(function () {
  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      toggle.classList.toggle('open');
      links.classList.toggle('open');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        toggle.classList.remove('open');
        links.classList.remove('open');
      });
    });
  }

  // Header shadow on scroll
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 10);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Accordion (terms)
  document.querySelectorAll('.acc-head').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.acc-item');
      var panel = item.querySelector('.acc-panel');
      var open = item.classList.toggle('open');
      panel.style.maxHeight = open ? panel.scrollHeight + 'px' : 0;
    });
  });
  // Keep open panels sized correctly (on load + after language change)
  window.recalcAccordions = function () {
    document.querySelectorAll('.acc-item.open .acc-panel').forEach(function (p) {
      p.style.maxHeight = p.scrollHeight + 'px';
    });
  };
  window.recalcAccordions();
  window.addEventListener('resize', window.recalcAccordions);

  // Reveal on scroll
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 0.08 + 's';
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  // Animated stat counters
  var stats = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && stats.length) {
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, target = +el.dataset.count, suffix = el.dataset.suffix || '';
        var start = 0, dur = 1400, t0 = null;
        var step = function (ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / dur, 1);
          el.textContent = Math.floor(p * target) + suffix;
          if (p < 1) requestAnimationFrame(step); else el.textContent = target + suffix;
        };
        requestAnimationFrame(step);
        so.unobserve(el);
      });
    }, { threshold: 0.5 });
    stats.forEach(function (el) { so.observe(el); });
  }

  // Contact form (front-end only demo handler)
  var form = document.querySelector('#enquiry-form');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ok = form.querySelector('.form-success');
      if (ok) ok.style.display = 'block';
      form.reset();
      if (ok) ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // Footer year (also refreshed by i18n after each language switch)
  var y = document.querySelector('#year');
  if (y) y.textContent = new Date().getFullYear();
})();
