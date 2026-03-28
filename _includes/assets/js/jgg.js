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

// Letters overlay
const toggle = document.querySelector('.letters-toggle');
const overlay = document.getElementById('letters-overlay');

function openLetters() {
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  toggle.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}

function closeLetters() {
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

if (toggle && overlay) {
  toggle.addEventListener('click', () => {
    overlay.classList.contains('is-open') ? closeLetters() : openLetters();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('letters-overlay-backdrop')) {
      closeLetters();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
      closeLetters();
    }
  });
}
