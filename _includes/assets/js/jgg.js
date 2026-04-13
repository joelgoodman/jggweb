// Theme toggle
const root = document.documentElement;
const themeToggles = document.querySelectorAll('.theme-toggle');

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
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

// Speaking cover photo stack
(function() {
  var groups = document.querySelectorAll('.event-group[data-cover]');
  if (!groups.length) return;

  var slides = document.querySelectorAll('.speaking-cover-slide');
  var highWater = 0; // highest stack index reached

  function stackTo(index) {
    // Add photos up to this index (they stay once added)
    for (var i = 0; i <= index; i++) {
      if (slides[i]) slides[i].classList.add('is-active');
    }
    // Remove photos above this index when scrolling back up
    for (var j = index + 1; j < slides.length; j++) {
      slides[j].classList.remove('is-active');
    }
    // Mark only the topmost visible for its caption
    slides.forEach(function(s) { s.classList.remove('is-top'); });
    if (slides[index]) slides[index].classList.add('is-top');
    highWater = Math.max(highWater, index);
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        stackTo(parseInt(entry.target.dataset.cover, 10));
      }
    });
  }, { rootMargin: '-30% 0px -50% 0px' });

  groups.forEach(function(g) { observer.observe(g); });

  // Reset to first photo when header is back in view
  var header = document.querySelector('.speaking header');
  if (header) {
    new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) stackTo(0);
    }, { rootMargin: '0px 0px -50% 0px' }).observe(header);
  }
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

  var isMobile = matchMedia('(max-width: 767px)').matches;
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

  function closeAllSlideIns() {
    [letterListPanel].forEach(function(panel) {
      if (panel) {
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function openSlideIn(panel) {
    if (!panel) return;
    closeAllSlideIns();
    shell.classList.remove('detail-collapsed');
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
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
      openSlideIn(letterListPanel);
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
