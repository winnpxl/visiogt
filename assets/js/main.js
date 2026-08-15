/* ============================================================
   VISIO — interactions
   1. Inertial smooth scrolling (wheel + anchors + keyboard)
   2. Scroll reveal
   3. Sticky nav state + progress bar
   4. Mobile menu
   5. FAQ accordion
   6. Testimonial carousel
   7. Animated counters
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Signals to CSS that the reveal animations are safe to arm.
  document.documentElement.classList.add('js');

  /* ----------------------------------------------------------
     1. Inertial smooth scrolling
     Intercepts wheel input and eases the real window scroll
     position toward a target. Keeps position:sticky, anchors and
     native scrollbars intact (no transform hijacking).
     ---------------------------------------------------------- */
  var SmoothScroll = (function () {
    var target = window.scrollY;
    var current = window.scrollY;
    var ease = 0.105;
    var running = false;
    var enabled = false;
    var rafId = null;

    function maxScroll() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }

    function clamp(v) {
      return Math.max(0, Math.min(v, maxScroll()));
    }

    function loop() {
      var delta = target - current;

      if (Math.abs(delta) < 0.4) {
        current = target;
        window.scrollTo(0, current);
        running = false;
        rafId = null;
        return;
      }

      current += delta * ease;
      window.scrollTo(0, current);
      rafId = requestAnimationFrame(loop);
    }

    function start() {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(loop);
      }
    }

    function onWheel(e) {
      if (!enabled) return;
      // Let nested scrollable areas (carousel, code blocks) scroll natively.
      if (e.ctrlKey || e.metaKey) return;
      var node = e.target;
      while (node && node !== document.body) {
        if (node.scrollHeight > node.clientHeight + 1) {
          var style = getComputedStyle(node).overflowY;
          if (style === 'auto' || style === 'scroll') return;
        }
        node = node.parentElement;
      }

      e.preventDefault();
      target = clamp(target + e.deltaY * (e.deltaMode === 1 ? 18 : 1));
      start();
    }

    function syncFromNative() {
      if (!running) {
        target = current = window.scrollY;
      }
    }

    /* Programmatic eased scroll (used by anchors) */
    function scrollTo(y, duration) {
      var startY = window.scrollY;
      var endY = clamp(y);
      var dist = endY - startY;
      var t0 = performance.now();
      var dur = duration || Math.min(1250, Math.max(520, Math.abs(dist) * 0.62));

      if (rafId) cancelAnimationFrame(rafId);
      running = true;

      if (reduceMotion) {
        window.scrollTo(0, endY);
        target = current = endY;
        running = false;
        return;
      }

      function step(now) {
        var p = Math.min(1, (now - t0) / dur);
        // easeInOutCubic
        var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        current = startY + dist * e;
        window.scrollTo(0, current);
        if (p < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          target = current = endY;
          running = false;
          rafId = null;
        }
      }
      rafId = requestAnimationFrame(step);
    }

    function enable() {
      if (reduceMotion) return;
      // Pointer-precise devices only — trackpads/touch already feel native.
      enabled = true;
      window.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('scroll', syncFromNative, { passive: true });
      window.addEventListener('resize', syncFromNative);
    }

    return { enable: enable, scrollTo: scrollTo };
  })();

  SmoothScroll.enable();

  /* Anchor links → eased scroll with sticky-nav offset */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var id = link.getAttribute('href');
    if (!id || id === '#') return;
    var el = document.querySelector(id);
    if (!el) return;

    e.preventDefault();
    var nav = document.querySelector('.nav');
    var offset = (nav ? nav.offsetHeight : 0) + 18;
    var y = el.getBoundingClientRect().top + window.scrollY - offset;
    SmoothScroll.scrollTo(y);
    history.replaceState(null, '', id);

    var menu = document.getElementById('mobileMenu');
    if (menu && menu.classList.contains('is-open')) closeMenu();
  });

  /* ----------------------------------------------------------
     2. Scroll reveal
     ---------------------------------------------------------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  function revealAll() {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });

    // Belt and braces: a geometry check covers environments where the observer
    // is throttled (background/hidden tabs), so nothing can stay invisible.
    var pending = false;
    function checkVisible() {
      pending = false;
      var vh = window.innerHeight;
      revealEls.forEach(function (el) {
        if (el.classList.contains('is-in')) return;
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add('is-in');
      });
    }
    function queueCheck() {
      if (!pending) { pending = true; requestAnimationFrame(checkVisible); }
    }
    window.addEventListener('scroll', queueCheck, { passive: true });
    window.addEventListener('resize', queueCheck);
    window.addEventListener('load', queueCheck);
    setTimeout(checkVisible, 400);
  }

  /* ----------------------------------------------------------
     3. Nav state + scroll progress
     ---------------------------------------------------------- */
  var nav = document.querySelector('.nav');
  var progress = document.querySelector('.progress');

  function onScrollFrame() {
    var y = window.scrollY;
    if (nav) nav.classList.toggle('is-stuck', y > 8);
    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    }
  }
  window.addEventListener('scroll', onScrollFrame, { passive: true });
  onScrollFrame();

  /* ----------------------------------------------------------
     4. Mobile menu
     ---------------------------------------------------------- */
  var burger = document.getElementById('burger');
  var mobileMenu = document.getElementById('mobileMenu');

  function closeMenu() {
    if (!burger || !mobileMenu) return;
    burger.classList.remove('is-open');
    mobileMenu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  }

  if (burger && mobileMenu) {
    burger.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('is-open');
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  /* ----------------------------------------------------------
     5. Announcement banner dismiss
     ---------------------------------------------------------- */
  var announce = document.querySelector('.announce');
  var announceClose = document.querySelector('.announce__close');
  if (announceClose && announce) {
    announceClose.addEventListener('click', function () {
      announce.classList.add('is-hidden');
    });
  }

  /* ----------------------------------------------------------
     6. FAQ accordion
     ---------------------------------------------------------- */
  document.querySelectorAll('.faq__q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq__item');
      var open = item.classList.contains('is-open');

      item.parentElement.querySelectorAll('.faq__item.is-open').forEach(function (other) {
        other.classList.remove('is-open');
        other.querySelector('.faq__q').setAttribute('aria-expanded', 'false');
      });

      if (!open) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ----------------------------------------------------------
     7. Testimonial carousel
     ---------------------------------------------------------- */
  var carousel = document.querySelector('[data-carousel]');
  if (carousel) {
    var viewport = carousel.querySelector('.carousel__viewport');
    var track = carousel.querySelector('.carousel__track');
    var slides = Array.prototype.slice.call(track.children);
    var dotsWrap = carousel.querySelector('.dots');
    var prev = carousel.querySelector('[data-prev]');
    var next = carousel.querySelector('[data-next]');

    function perView() {
      var w = window.innerWidth;
      if (w <= 640) return 1;
      if (w <= 1024) return 2;
      return 3;
    }

    function pages() {
      return Math.max(1, slides.length - perView() + 1);
    }

    function buildDots() {
      dotsWrap.innerHTML = '';
      for (var i = 0; i < pages(); i++) {
        var b = document.createElement('button');
        b.className = 'dot-btn' + (i === 0 ? ' is-active' : '');
        b.type = 'button';
        b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        b.dataset.index = String(i);
        dotsWrap.appendChild(b);
      }
    }

    function currentIndex() {
      var step = slides[0].offsetWidth + parseFloat(getComputedStyle(track).gap || '20');
      return Math.round(viewport.scrollLeft / step);
    }

    function goTo(index) {
      var step = slides[0].offsetWidth + parseFloat(getComputedStyle(track).gap || '20');
      viewport.scrollTo({
        left: Math.max(0, index) * step,
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    }

    function syncUI() {
      var i = currentIndex();
      dotsWrap.querySelectorAll('.dot-btn').forEach(function (d, di) {
        d.classList.toggle('is-active', di === i);
      });
      if (prev) prev.disabled = viewport.scrollLeft <= 2;
      if (next) next.disabled = viewport.scrollLeft >= viewport.scrollWidth - viewport.clientWidth - 2;
    }

    buildDots();
    syncUI();

    dotsWrap.addEventListener('click', function (e) {
      var d = e.target.closest('.dot-btn');
      if (d) goTo(parseInt(d.dataset.index, 10));
    });
    if (prev) prev.addEventListener('click', function () { goTo(currentIndex() - 1); });
    if (next) next.addEventListener('click', function () { goTo(currentIndex() + 1); });

    var tick;
    viewport.addEventListener('scroll', function () {
      clearTimeout(tick);
      tick = setTimeout(syncUI, 90);
    }, { passive: true });

    var lastPer = perView();
    window.addEventListener('resize', function () {
      if (perView() !== lastPer) {
        lastPer = perView();
        buildDots();
      }
      syncUI();
    });
  }

  /* ----------------------------------------------------------
     8. Animated counters
     ---------------------------------------------------------- */
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        cio.unobserve(el);

        var to = parseFloat(el.dataset.count);
        var suffix = el.dataset.suffix || '';
        var dur = 1400;
        var t0 = performance.now();

        if (reduceMotion) { el.textContent = to + suffix; return; }

        (function frame(now) {
          var p = Math.min(1, (now - t0) / dur);
          var e = 1 - Math.pow(1 - p, 3);
          var val = to * e;
          el.textContent = (to % 1 === 0 ? Math.round(val) : val.toFixed(1)) + suffix;
          if (p < 1) requestAnimationFrame(frame);
        })(t0);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (c) { cio.observe(c); });
  }
})();
