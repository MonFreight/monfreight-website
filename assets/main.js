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

  // Contact form — sends enquiry via FormSubmit.co to info@monfreight.com.au
  var form = document.querySelector('#enquiry-form');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var card = form.closest('.form-card') || document;
      var ok = card.querySelector('.form-success');
      var err = card.querySelector('.form-error');
      var btn = form.querySelector('button[type="submit"]');
      var btnText = btn ? btn.textContent : '';
      if (ok) ok.style.display = 'none';
      if (err) err.style.display = 'none';
      if (btn) { btn.disabled = true; btn.textContent = '...'; }

      fetch('https://formsubmit.co/ajax/info@monfreight.com.au', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: form.name.value,
          email: form.email.value,
          phone: form.phone.value,
          message: form.message.value,
          _subject: 'Website enquiry — ' + form.name.value,
          _template: 'table',
          _captcha: 'false'
        })
      })
      .then(function (res) { if (!res.ok) throw new Error('send failed'); return res.json(); })
      .then(function () {
        if (ok) { ok.style.display = 'block'; ok.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        form.reset();
      })
      .catch(function () {
        if (err) { err.style.display = 'block'; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = btnText; }
      });
    });
  }

  // Footer year (also refreshed by i18n after each language switch)
  var y = document.querySelector('#year');
  if (y) y.textContent = new Date().getFullYear();
})();
