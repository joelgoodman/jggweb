// Reset detail/page scroll containers to top on load — browsers can
// restore prior scroll positions on back-nav or refresh, which is wrong
// for the new shell layout where the scroller is an inner div, not the
// document.
(function() {
  function scrollPanesTop() {
    ['detail-content'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.scrollTop = 0;
    });
    var pageContent = document.querySelector('.page-content');
    if (pageContent) pageContent.scrollTop = 0;
  }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollPanesTop();
  window.addEventListener('pageshow', scrollPanesTop);
})();

// Theme toggle
const root = document.documentElement;
const themeToggles = document.querySelectorAll('.theme-toggle');

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  themeToggles.forEach(function(btn) {
    var isDark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(isDark));
    btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  });
}

const saved = localStorage.getItem('theme');
applyTheme(saved || getSystemTheme());

themeToggles.forEach(btn => {
  btn.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') || getSystemTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
  });
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('theme')) {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});

// Speaking image crossfade — IntersectionObserver watches year-group
// sections in the detail content; fades the matching photo in.
(function() {
  var groups = document.querySelectorAll('.year-group[data-photo]');
  if (!groups.length) return;

  var covers = document.querySelectorAll('.speaking-cover[data-photo]');
  if (!covers.length) return;

  function activate(index) {
    covers.forEach(function(img) {
      var matches = parseInt(img.dataset.photo, 10) === index;
      img.classList.toggle('is-active', matches);
      // Hide non-active images from assistive tech so a screen reader
      // doesn't announce all four photos at once.
      if (matches) img.removeAttribute('aria-hidden');
      else img.setAttribute('aria-hidden', 'true');
    });
  }

  // Use the detail__content scroll container as the IO root — page
  // content lives inside that scroller, not the viewport.
  var root = document.getElementById('detail-content') || null;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        activate(parseInt(entry.target.dataset.photo, 10));
      }
    });
  }, { root: root, rootMargin: '-30% 0px -50% 0px' });

  groups.forEach(function(g) { observer.observe(g); });
})();

// Panel Controller — rail/detail collapse + slide-in panels
(function() {
  var STORAGE_KEY = 'jgg-panel-state';

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { return {}; }
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) {}
  }

  var shell = document.getElementById('shell');
  if (!shell) return;

  var isMobile = matchMedia('(max-width: 1023px)').matches;
  var savedState = loadState();
  if (!isMobile) {
    if (savedState.railCollapsed) shell.classList.add('rail-collapsed');
    if (savedState.detailCollapsed) shell.classList.add('detail-collapsed');
  }

  var railTab = document.getElementById('rail-tab');
  var detailTab = document.getElementById('detail-tab');

  var letterListPanel = document.getElementById('letter-list-panel');
  var letterListClose = document.getElementById('letter-list-close');
  var lettersTrigger = document.querySelector('[data-action="show-letters"]');

  // Track which element opened the active panel so focus can be restored
  // when the panel closes.
  var lastSlideTrigger = null;

  function closeAllSlideIns() {
    [letterListPanel].forEach(function(panel) {
      if (panel) {
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
      }
    });
    if (lastSlideTrigger && typeof lastSlideTrigger.focus === 'function') {
      lastSlideTrigger.focus();
    }
    lastSlideTrigger = null;
  }

  function openSlideIn(panel, trigger) {
    if (!panel) return;
    closeAllSlideIns();
    shell.classList.remove('detail-collapsed');
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    lastSlideTrigger = trigger || document.activeElement;
    // Move focus into the panel — first interactive element (close button).
    var firstFocusable = panel.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable && typeof firstFocusable.focus === 'function') {
      firstFocusable.focus();
    }
  }

  if (railTab) {
    railTab.setAttribute('aria-expanded', String(!shell.classList.contains('rail-collapsed')));
  }
  if (detailTab) {
    detailTab.setAttribute('aria-expanded', String(!shell.classList.contains('detail-collapsed')));
  }

  // Rail tab toggle
  if (railTab) {
    railTab.addEventListener('click', function() {
      var isCollapsed = shell.classList.toggle('rail-collapsed');
      railTab.setAttribute('aria-expanded', String(!isCollapsed));
      var s = loadState();
      s.railCollapsed = isCollapsed;
      saveState(s);
    });
  }

  // Detail tab toggle
  if (detailTab) {
    detailTab.addEventListener('click', function() {
      var isCollapsed = shell.classList.toggle('detail-collapsed');
      detailTab.setAttribute('aria-expanded', String(!isCollapsed));
      if (isCollapsed) closeAllSlideIns();
      var s = loadState();
      s.detailCollapsed = isCollapsed;
      saveState(s);
    });
  }

  // Letters slide-in
  if (lettersTrigger) {
    lettersTrigger.addEventListener('click', function(e) {
      e.preventDefault();
      openSlideIn(letterListPanel, lettersTrigger);
    });
  }

  if (letterListClose) {
    letterListClose.addEventListener('click', function() {
      closeAllSlideIns();
    });
  }

  // Escape closes slide-ins
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var anyOpen = [letterListPanel].some(function(p) {
        return p && p.classList.contains('is-open');
      });
      if (anyOpen) closeAllSlideIns();
    }
  });
})();

// Rail Tooltip — single shared popover positioned via JS so it escapes
// the rail's overflow:hidden. Reads label from data-tooltip / title /
// aria-label (in that order). Strips the native title attribute on bind
// so we don't get a double tooltip from the browser.
(function() {
  var rail = document.querySelector('.rail');
  if (!rail) return;

  var tip = document.createElement('div');
  tip.id = 'rail-tooltip';
  tip.className = 'rail-tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);

  var current = null;

  function getLabel(el) {
    return el.getAttribute('data-tooltip')
        || el.getAttribute('title')
        || el.getAttribute('aria-label')
        || '';
  }

  function show(el) {
    var label = getLabel(el);
    if (!label) return;
    var rect = el.getBoundingClientRect();
    tip.textContent = label;
    tip.style.left = (rect.right + 12) + 'px';
    tip.style.top = (rect.top + rect.height / 2) + 'px';
    tip.classList.add('is-visible');
    el.setAttribute('aria-describedby', 'rail-tooltip');
    current = el;
  }

  function hide() {
    tip.classList.remove('is-visible');
    if (current) current.removeAttribute('aria-describedby');
    current = null;
  }

  var triggers = rail.querySelectorAll(
    '.rail__links a, .rail__social a, .rail__brand'
  );
  triggers.forEach(function(el) {
    // Stash and strip native title to avoid the browser tooltip racing
    // ours. Keep the value as data-tooltip so getLabel can find it.
    var title = el.getAttribute('title');
    if (title && !el.getAttribute('data-tooltip')) {
      el.setAttribute('data-tooltip', title);
    }
    if (title) el.removeAttribute('title');

    el.addEventListener('mouseenter', function() { show(el); });
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', function() { show(el); });
    el.addEventListener('blur', hide);
  });

  // Reposition or hide if layout changes underneath us
  window.addEventListener('scroll', function() { if (current) hide(); }, true);
  window.addEventListener('resize', hide);

  // Hide when rail collapse state toggles (link positions shift)
  var railTab = document.getElementById('rail-tab');
  if (railTab) railTab.addEventListener('click', hide);
})();

// Image fade-in on load — adds .is-loaded when each cover image finishes
// loading (or immediately if already cached).
function markLoadedImages(root) {
  (root || document).querySelectorAll('.image-panel__cover').forEach(function(img) {
    if (img.complete && img.naturalHeight !== 0) {
      img.classList.add('is-loaded');
    } else {
      img.addEventListener('load', function() { img.classList.add('is-loaded'); }, { once: true });
      img.addEventListener('error', function() { img.classList.add('is-loaded'); }, { once: true });
    }
  });
}
markLoadedImages();

// Letter Navigation — slot-machine soft-nav between letters
(function() {
  var detail = document.querySelector('.detail');
  var imagePanel = document.getElementById('image-panel');
  var prevBtn = document.getElementById('prev-btn');
  var nextBtn = document.getElementById('next-btn');

  if (!detail || !prevBtn || !nextBtn) return;

  var animating = false;

  // Build letter index from the slide panel links, oldest-first.
  // .letter-list-panel is rendered newest-first, so reverse for chronological index.
  var letterLinks = Array.prototype.slice
    .call(document.querySelectorAll('.letter-list-panel__item'))
    .map(function(a) { return a.getAttribute('href'); })
    .reverse();

  var currentPath = window.location.pathname;
  var currentIndex = letterLinks.indexOf(currentPath);

  // Don't activate on non-letter pages (home, page-layout, etc.)
  if (currentIndex === -1) return;

  updateButtons();

  function updateButtons() {
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= letterLinks.length - 1;
  }

  // Cache parsed page documents to avoid re-fetching on repeated navigation
  // and to make adjacent prefetches reusable.
  var pageCache = {};

  function fetchPage(url) {
    if (pageCache[url]) return Promise.resolve(pageCache[url]);
    return fetch(url).then(function(res) {
      if (!res.ok) throw new Error('Failed to fetch ' + url);
      return res.text();
    }).then(function(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      pageCache[url] = doc;
      return doc;
    });
  }

  // Warm the browser image cache for an adjacent letter's cover. Uses
  // <link rel="preload" as="image"> with imagesrcset/imagesizes — the
  // standard browser mechanism that's reliable and matches what the
  // browser does for in-document <picture> sources. Prefers the AVIF
  // <source> srcset when available so we preload the same variant the
  // browser will display.
  var preloadedHrefs = {};
  function preloadCoverFromDoc(doc) {
    var img = doc.querySelector('.image-panel__cover');
    if (!img) return;
    var picture = img.closest('picture');
    var avif = picture && picture.querySelector('source[type="image/avif"]');
    var webp = picture && picture.querySelector('source[type="image/webp"]');
    var pickedSource = avif || webp;

    var href = img.getAttribute('src') || '';
    if (preloadedHrefs[href]) return;
    preloadedHrefs[href] = true;

    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    var srcset = (pickedSource && pickedSource.getAttribute('srcset')) || img.getAttribute('srcset');
    var sizes = (pickedSource && pickedSource.getAttribute('sizes')) || img.getAttribute('sizes');
    if (srcset) link.setAttribute('imagesrcset', srcset);
    if (sizes) link.setAttribute('imagesizes', sizes);
    if (pickedSource) link.type = pickedSource.getAttribute('type') || '';
    document.head.appendChild(link);
  }

  function prefetchAdjacent() {
    [currentIndex - 1, currentIndex + 1].forEach(function(idx) {
      if (idx < 0 || idx >= letterLinks.length) return;
      fetchPage(letterLinks[idx]).then(preloadCoverFromDoc).catch(function() {});
    });
  }

  function schedulePrefetch() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(prefetchAdjacent, { timeout: 2000 });
    } else {
      setTimeout(prefetchAdjacent, 1000);
    }
  }

  // Initial prefetch of neighbors after page settles
  schedulePrefetch();

  function extractDetailContent(doc) {
    var c = doc.querySelector('.detail__content');
    return c ? c.innerHTML : '';
  }

  function extractImageSlide(doc) {
    var s = doc.querySelector('.image-panel__slide');
    return s ? s.innerHTML : '';
  }

  function extractTitle(doc) {
    var t = doc.querySelector('.detail__title');
    return t ? t.textContent.trim() : document.title;
  }

  function swapContent(detailHtml, imageHtml, url, title) {
    var detailContent = detail.querySelector('.detail__content');
    var imageSlide = document.getElementById('image-slide');

    if (detailContent) detailContent.innerHTML = detailHtml;
    if (imageSlide) {
      imageSlide.innerHTML = imageHtml;
      markLoadedImages(imageSlide);
    }

    history.pushState({ letterUrl: url }, '', url);
    document.title = title + ' / Joel G Goodman';

    if (detailContent) detailContent.scrollTop = 0;

    // Announce the new page to screen readers and shift focus into the
    // new content so the reading cursor follows. The detail article has
    // tabindex="-1" so it can receive programmatic focus.
    var announcer = document.getElementById('page-announcer');
    if (announcer) announcer.textContent = 'Loaded: ' + title;
    if (detail && typeof detail.focus === 'function') {
      detail.focus({ preventScroll: true });
    }
  }

  function animateTransition(direction, newDetailHtml, newImageHtml, targetUrl, newTitle) {
    var dur = 700;
    var stagger = 120;
    var exitY = direction > 0 ? '-100%' : '100%';
    var enterY = direction > 0 ? '100%' : '-100%';
    var ease = 'cubic-bezier(0.4, 0, 0.2, 1)';

    // ── Image reel ────────────────────────────────────────
    var imageSlide = document.getElementById('image-slide');
    var imageClone = null;
    var imageCurrentAnim = null;

    if (imageSlide && imagePanel) {
      imageClone = imageSlide.cloneNode(false);
      imageClone.innerHTML = newImageHtml;
      imageClone.style.position = 'absolute';
      imageClone.style.inset = '0';
      imageClone.style.transform = 'translateY(' + enterY + ')';
      imageClone.id = '';
      imagePanel.appendChild(imageClone);
      markLoadedImages(imageClone);

      imageCurrentAnim = imageSlide.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(' + exitY + ')' }],
        { duration: dur, easing: ease, fill: 'forwards' }
      );
      imageClone.animate(
        [{ transform: 'translateY(' + enterY + ')' }, { transform: 'translateY(0)' }],
        { duration: dur, easing: ease, fill: 'forwards' }
      );
    }

    // ── Detail reel (staggered) ───────────────────────────
    var detailContent = detail.querySelector('.detail__content');
    var detailClone = document.createElement('div');
    detailClone.className = detailContent.className;
    detailClone.innerHTML = newDetailHtml;
    detailClone.style.position = 'absolute';
    detailClone.style.inset = '0';
    detailClone.style.transform = 'translateY(' + enterY + ')';
    detail.appendChild(detailClone);

    detailContent.style.position = 'absolute';
    detailContent.style.inset = '0';

    return new Promise(function(resolve) {
      setTimeout(function() {
        var detailCurrentAnim = detailContent.animate(
          [{ transform: 'translateY(0)' }, { transform: 'translateY(' + exitY + ')' }],
          { duration: dur, easing: ease, fill: 'forwards' }
        );
        detailClone.animate(
          [{ transform: 'translateY(' + enterY + ')' }, { transform: 'translateY(0)' }],
          { duration: dur, easing: ease, fill: 'forwards' }
        );

        var pending = [detailCurrentAnim.finished];
        if (imageCurrentAnim) pending.push(imageCurrentAnim.finished);

        Promise.all(pending).then(function() {
          // Swap content while originals are still off-screen, then cancel
          // animations and remove clones in the same frame to avoid flicker.
          swapContent(newDetailHtml, newImageHtml, targetUrl, newTitle);

          if (imageSlide) {
            imageSlide.getAnimations().forEach(function(a) { a.cancel(); });
            imageSlide.style.transform = '';
          }
          detailContent.getAnimations().forEach(function(a) { a.cancel(); });
          detailContent.style.position = '';
          detailContent.style.inset = '';
          detailContent.style.transform = '';

          if (imageClone) imageClone.remove();
          detailClone.remove();
          resolve();
        });
      }, stagger);
    });
  }

  function navigate(direction) {
    if (animating) return;
    var targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= letterLinks.length) return;

    var targetUrl = letterLinks[targetIndex];
    animating = true;
    var reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    fetchPage(targetUrl).then(function(doc) {
      var newDetailHtml = extractDetailContent(doc);
      var newImageHtml = extractImageSlide(doc);
      var newTitle = extractTitle(doc);

      if (reducedMotion) {
        swapContent(newDetailHtml, newImageHtml, targetUrl, newTitle);
        currentIndex = targetIndex;
        updateButtons();
        animating = false;
        schedulePrefetch();
        return;
      }

      animateTransition(direction, newDetailHtml, newImageHtml, targetUrl, newTitle).then(function() {
        currentIndex = targetIndex;
        updateButtons();
        animating = false;
        schedulePrefetch();
      });
    }).catch(function(err) {
      console.error('[letter-nav] Navigation failed:', err);
      window.location.href = targetUrl;
    });
  }

  // Buttons
  nextBtn.addEventListener('click', function() { navigate(1); });
  prevBtn.addEventListener('click', function() { navigate(-1); });

  // Keyboard
  document.addEventListener('keydown', function(e) {
    if (animating) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' && !nextBtn.disabled) navigate(1);
    if (e.key === 'ArrowLeft' && !prevBtn.disabled) navigate(-1);
  });

  // Browser back/forward
  window.addEventListener('popstate', function(e) {
    if (e.state && e.state.letterUrl) {
      var idx = letterLinks.indexOf(e.state.letterUrl);
      if (idx !== -1 && idx !== currentIndex) {
        currentIndex = idx;
        fetchPage(e.state.letterUrl).then(function(doc) {
          swapContent(
            extractDetailContent(doc),
            extractImageSlide(doc),
            e.state.letterUrl,
            extractTitle(doc)
          );
          updateButtons();
          schedulePrefetch();
        });
      }
    }
  });

  // Letters list panel — soft-nav clicks
  document.querySelectorAll('.letter-list-panel__item').forEach(function(link) {
    link.addEventListener('click', function(e) {
      var href = link.getAttribute('href');
      var idx = letterLinks.indexOf(href);
      if (idx === -1) return; // let it hard-navigate

      e.preventDefault();

      var panel = document.getElementById('letter-list-panel');
      if (panel) {
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
      }

      if (idx === currentIndex) return;
      var direction = idx > currentIndex ? 1 : -1;
      currentIndex = idx - direction;
      navigate(direction);
    });
  });
})();
