# Custom Video Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw YouTube iframe in the Appearances image panel with a fully custom-controlled, WCAG 2.2 AA-accessible player built on YouTube's IFrame Player API, tracked in Plausible, structured so a Spotify adapter is additive later.

**Architecture:** A `MediaController` interface (play/pause/seek/mute/volume/getCurrentTime/getDuration/on/destroy) is implemented by a `YouTubeController` factory wrapping `YT.Player`. A single new file, `video-player.js`, owns the interface, the adapter, the control-bar UI, keyboard handling, captions, and analytics — inlined into `base.njk` only on the Appearances page. The existing click-to-reveal `<template>`-clone mechanism (already built) is unchanged; only what's *inside* each video's template changes, from a raw `{% yt %}` iframe to a mount point + control bar.

**Tech Stack:** Vanilla ES5-style JS (matching `jgg.js`'s existing style — `var`, function expressions, no arrow functions/const/let), YouTube IFrame Player API (`https://www.youtube.com/iframe_api`), Plausible custom events, Nunjucks/Eleventy.

**Spec:** [docs/superpowers/specs/2026-08-22-appearances-video-player-design.md](../specs/2026-08-22-appearances-video-player-design.md)

## Global Constraints

- `controls: 0` in `playerVars` — all native YouTube UI is replaced, not supplemented.
- No autoplay — the player loads paused; an explicit play press is required.
- WCAG 2.2 AA is a hard requirement: every icon button needs a real `aria-label`; target size ≥24×24 CSS px; keyboard operable (space/arrows/m/f, scoped to the player, not global); focus-visible on every control; state changes announced through the existing `#page-announcer` live region, not a new one; seek uses a native `<input type="range">` (WCAG 2.5.7 — no custom draggable scrubber).
- Four Plausible events, exact names: `Appearance Selected`, `Appearance Play`, `Appearance Progress`, `Outbound Link: Click`. These are the *first* custom events in this codebase — get the naming right since it's the pattern future events follow.
- One file, `_includes/assets/js/video-player.js` — not split into per-adapter files yet (only one adapter exists).
- This repo has no automated test framework. Verification throughout is: build the site, grep output, and real browser interaction (Claude_Browser tools) — the same pattern used for the original Appearances build.

---

### Task 1: `MediaController` interface, `YouTubeController` adapter, and control bar (core playback)

**Files:**
- Create: `_includes/assets/js/video-player.js`
- Modify: `appearances.njk` (video `<template>` markup)
- Modify: `_includes/layouts/base.njk` (conditional inline)
- Modify: `_includes/assets/scss/_appearances.scss` (remove `.appearance-cta` pill styles, add control-bar styles)

**Interfaces:**
- Produces: `window.JGGVideoPlayer.create(mountEl, videoId)` → a `MediaController` object: `{ ready, play(), pause(), togglePlay(), seek(seconds), getCurrentTime(), getDuration(), isPlaying(), mute(), unmute(), toggleMute(), isMuted(), getVolume(), setVolume(n), on(event, handler), destroy() }`. `event` is `'statechange'` (handler receives `{ playing: boolean }`) or `'timeupdate'` (handler receives `{ currentTime, duration }`, fired every 250ms while playing).
- Consumes: nothing from earlier tasks (this is the first task).
- Later tasks (2-6) all extend this same file and consume the `MediaController` object this task produces — they do not touch `YT.Player` directly.

- [ ] **Step 1: Create `_includes/assets/js/video-player.js`**

```js
// Custom accessible video player for Appearances — built on YouTube's
// IFrame Player API (https://developers.google.com/youtube/iframe_api_reference).
//
// MediaController is the interface every adapter implements (only
// YouTubeController exists today; a SpotifyController is planned —
// see docs/superpowers/specs/2026-08-22-appearances-video-player-design.md).
// The control bar below only ever calls MediaController methods, never
// YT.Player directly, so a second adapter is additive, not a rewrite.
window.JGGVideoPlayer = (function() {

  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (loadYouTubeApi._promise) return loadYouTubeApi._promise;
    loadYouTubeApi._promise = new Promise(function(resolve) {
      var previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function() {
        if (typeof previous === 'function') previous();
        resolve(window.YT);
      };
      var script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    });
    return loadYouTubeApi._promise;
  }

  // Implements MediaController by wrapping YT.Player. This is the only
  // function in this file that touches YT.Player/YT.PlayerState directly.
  function createYouTubeController(mountEl, videoId) {
    var listeners = {};
    var player = null;
    var readyResolve;
    var ready = new Promise(function(resolve) { readyResolve = resolve; });
    var timeUpdateTimer = null;

    function emit(event, detail) {
      (listeners[event] || []).forEach(function(handler) { handler(detail); });
    }

    function startTimeUpdates() {
      stopTimeUpdates();
      timeUpdateTimer = setInterval(function() {
        emit('timeupdate', {
          currentTime: player.getCurrentTime(),
          duration: player.getDuration()
        });
      }, 250);
    }

    function stopTimeUpdates() {
      if (timeUpdateTimer) clearInterval(timeUpdateTimer);
      timeUpdateTimer = null;
    }

    loadYouTubeApi().then(function(YT) {
      player = new YT.Player(mountEl, {
        videoId: videoId,
        playerVars: {
          controls: 0,
          autoplay: 0,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
          fs: 0,
          cc_load_policy: 1,
          origin: window.location.origin
        },
        events: {
          onReady: function() { readyResolve(); },
          onStateChange: function(e) {
            var playing = e.data === YT.PlayerState.PLAYING;
            emit('statechange', { playing: playing });
            if (playing) startTimeUpdates(); else stopTimeUpdates();
          }
        }
      });
    });

    return {
      ready: ready,
      play: function() { if (player) player.playVideo(); },
      pause: function() { if (player) player.pauseVideo(); },
      togglePlay: function() {
        if (!player) return;
        if (this.isPlaying()) this.pause(); else this.play();
      },
      seek: function(seconds) { if (player) player.seekTo(seconds, true); },
      getCurrentTime: function() { return player ? player.getCurrentTime() : 0; },
      getDuration: function() { return player ? player.getDuration() : 0; },
      isPlaying: function() {
        return !!player && !!window.YT && player.getPlayerState() === window.YT.PlayerState.PLAYING;
      },
      mute: function() { if (player) player.mute(); },
      unmute: function() { if (player) player.unMute(); },
      toggleMute: function() {
        if (!player) return;
        if (this.isMuted()) this.unmute(); else this.mute();
      },
      isMuted: function() { return !!player && player.isMuted(); },
      getVolume: function() { return player ? player.getVolume() : 100; },
      setVolume: function(v) { if (player) player.setVolume(Math.max(0, Math.min(100, v))); },
      on: function(event, handler) {
        (listeners[event] = listeners[event] || []).push(handler);
      },
      destroy: function() {
        stopTimeUpdates();
        if (player) player.destroy();
      }
    };
  }

  return {
    create: function(mountEl, videoId) {
      return createYouTubeController(mountEl, videoId);
    }
  };
})();

// Formats seconds as "M:SS" or "H:MM:SS" for the time/duration display.
function jggFormatTime(totalSeconds) {
  var s = Math.max(0, Math.floor(totalSeconds || 0));
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  var secStr = sec < 10 ? '0' + sec : String(sec);
  if (h > 0) {
    var mStr = m < 10 ? '0' + m : String(m);
    return h + ':' + mStr + ':' + secStr;
  }
  return m + ':' + secStr;
}

// Wires one .video-player element's control bar to a MediaController.
// Called once per video, right after its template is cloned into the
// live DOM (see appearances.njk's click handler in jgg.js).
function jggInitVideoPlayer(root) {
  var mount = root.querySelector('.video-player__mount');
  var playBtn = root.querySelector('.video-player__play');
  var muteBtn = root.querySelector('.video-player__mute');
  var fullscreenBtn = root.querySelector('.video-player__fullscreen');
  var seekInput = root.querySelector('.video-player__seek');
  var timeEl = root.querySelector('.video-player__time');
  var durationEl = root.querySelector('.video-player__duration');
  if (!mount || !playBtn || !muteBtn || !fullscreenBtn || !seekInput || !timeEl || !durationEl) return;

  var videoId = root.dataset.videoId;
  var controller = window.JGGVideoPlayer.create(mount, videoId);
  var seeking = false;

  function setPlayIcon(playing) {
    playBtn.querySelector('.video-player__icon-play').hidden = playing;
    playBtn.querySelector('.video-player__icon-pause').hidden = !playing;
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  function setMuteIcon(muted) {
    muteBtn.querySelector('.video-player__icon-unmuted').hidden = muted;
    muteBtn.querySelector('.video-player__icon-muted').hidden = !muted;
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  }

  playBtn.addEventListener('click', function() { controller.togglePlay(); });
  muteBtn.addEventListener('click', function() {
    controller.toggleMute();
    setMuteIcon(controller.isMuted());
  });

  fullscreenBtn.addEventListener('click', function() {
    if (document.fullscreenElement === root) {
      document.exitFullscreen();
    } else if (root.requestFullscreen) {
      root.requestFullscreen();
    }
  });

  seekInput.addEventListener('pointerdown', function() { seeking = true; });
  seekInput.addEventListener('change', function() {
    controller.seek(Number(seekInput.value));
    seeking = false;
  });

  controller.on('statechange', function(state) {
    setPlayIcon(state.playing);
  });

  controller.on('timeupdate', function(t) {
    if (!seeking) seekInput.value = String(t.duration ? (t.currentTime / t.duration) * 100 : 0);
    timeEl.textContent = jggFormatTime(t.currentTime);
    durationEl.textContent = jggFormatTime(t.duration);
  });

  controller.ready.then(function() {
    setMuteIcon(controller.isMuted());
    durationEl.textContent = jggFormatTime(controller.getDuration());
  });

  seekInput.addEventListener('input', function() {
    if (controller.getDuration()) {
      timeEl.textContent = jggFormatTime((Number(seekInput.value) / 100) * controller.getDuration());
    }
  });

  return controller;
}
```

- [ ] **Step 2: Replace the video `<template>`'s content in `appearances.njk`**

Find (the `{% if item.data.type == "video" %}` block inside the `<template>` loop):

```njk
      <div class="image-panel__item">
        {% if item.data.type == "video" %}
          {% yt item.data.source_url, item.data.title %}
        {% endif %}
      </div>
```

Replace with:

```njk
      <div class="image-panel__item">
        {% if item.data.type == "video" %}
          <div class="video-player" data-video-id="{{ item.data.id }}">
            <div class="video-player__mount"></div>
            <div class="video-player__controls">
              <button type="button" class="video-player__play" aria-label="Play">
                <svg class="video-player__icon-play" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" aria-hidden="true"><path d="M5.5 3.5 L14 9 L5.5 14.5 Z" fill="currentColor"/></svg>
                <svg class="video-player__icon-pause" hidden xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" aria-hidden="true"><g fill="currentColor"><rect x="5" y="3.5" width="3" height="11" rx="1"/><rect x="10" y="3.5" width="3" height="11" rx="1"/></g></svg>
              </button>
              <span class="video-player__time">0:00</span>
              <input type="range" class="video-player__seek" min="0" max="100" value="0" step="0.1" aria-label="Seek">
              <span class="video-player__duration">0:00</span>
              <button type="button" class="video-player__mute" aria-label="Mute">
                <svg class="video-player__icon-unmuted" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" stroke="currentColor"><path d="M2.5 6.75h2.25L8.5 3.5v11L4.75 11.25H2.5z" fill="currentColor" stroke="none"/><path d="M11.5 6.5a3.5 3.5 0 0 1 0 5"/><path d="M13.25 4.5a6 6 0 0 1 0 9"/></g></svg>
                <svg class="video-player__icon-muted" hidden xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" stroke="currentColor"><path d="M2.5 6.75h2.25L8.5 3.5v11L4.75 11.25H2.5z" fill="currentColor" stroke="none"/><path d="M11.75 6.75l4 4.5"/><path d="M15.75 6.75l-4 4.5"/></g></svg>
              </button>
              <button type="button" class="video-player__captions" aria-label="Captions" aria-pressed="false" hidden>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" stroke="currentColor"><rect x="1.75" y="3.75" width="14.5" height="10.5" rx="1.5"/><path d="M6.5 8a1.5 1.5 0 0 0-1.5 1.5v0A1.5 1.5 0 0 0 6.5 11"/><path d="M11.5 8a1.5 1.5 0 0 0-1.5 1.5v0a1.5 1.5 0 0 0 1.5 1.5"/></g></svg>
              </button>
              <button type="button" class="video-player__fullscreen" aria-label="Fullscreen">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" stroke="currentColor"><path d="M6 2.5H3a.5.5 0 0 0-.5.5v3"/><path d="M12 2.5h3a.5.5 0 0 1 .5.5v3"/><path d="M6 15.5H3a.5.5 0 0 1-.5-.5v-3"/><path d="M12 15.5h3a.5.5 0 0 0 .5-.5v-3"/></g></svg>
              </button>
              <a class="video-player__external" href="{{ item.data.source_url }}" target="_blank" rel="noopener" aria-label="Watch on YouTube">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" stroke="currentColor"><path d="M7.25 3.75h7v7"></path><path d="M14.25 3.75l-7.5 7.5"></path><path d="M11.25 8.25v4.5a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5v-6a1.5 1.5 0 0 1 1.5-1.5h4.5"></path></g></svg>
              </a>
            </div>
          </div>
        {% endif %}
      </div>
```

- [ ] **Step 3: Wire up initialization in `jgg.js`'s `select()` function**

Find (in `_includes/assets/js/jgg.js`, inside `select(btn)`):

```js
    while (slide.firstChild) slide.removeChild(slide.firstChild);
    slide.appendChild(tpl.content.cloneNode(true));
    collapseDetail();
```

Replace with:

```js
    while (slide.firstChild) slide.removeChild(slide.firstChild);
    var clone = tpl.content.cloneNode(true);
    slide.appendChild(clone);
    var playerRoot = slide.querySelector('.video-player');
    if (playerRoot && typeof jggInitVideoPlayer === 'function') {
      jggInitVideoPlayer(playerRoot);
    }
    collapseDetail();
```

(Note: `clone` and `playerRoot` reference the live nodes now in `#image-slide` — `tpl.content.cloneNode(true)` returns a fragment; querying `slide` after appending finds the real, attached elements, not the detached fragment.)

- [ ] **Step 4: Inline `video-player.js` conditionally in `base.njk`**

Find (in `_includes/layouts/base.njk`, the existing `now-playing.js` inline block):

```njk
  {% set npjs %}
    {% include "assets/js/now-playing.js" %}
  {% endset %}
  <script>
    {{ npjs | jsmin | safe }}
  </script>
```

Add immediately after it:

```njk
  {% if section == "appearances" %}
  {% set vpjs %}
    {% include "assets/js/video-player.js" %}
  {% endset %}
  <script>
    {{ vpjs | jsmin | safe }}
  </script>
  {% endif %}
```

- [ ] **Step 5: Replace `.appearance-cta` CSS with control-bar CSS in `_appearances.scss`**

Find and delete the entire `.appearance-cta` rule block (including its `&::after`, `&:hover`, `&:focus-visible`, `&[hidden]`, and `svg` nested rules — everything from `.appearance-cta {` through its closing `}`).

Add in its place:

```scss
// ── Custom video player — control bar ──────────────────────────────
// Fixed opaque background (not a gradient) so contrast against text/
// icons is guaranteed regardless of what's playing behind it — a
// gradient that fades toward transparent would create an under-
// contrast zone wherever a bright video frame shows through.
.video-player {
  position: relative;
  width: 100%;
  height: 100%;
}

.video-player__mount {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;

  iframe {
    width: 100%;
    height: 100%;
    display: block;
    border: 0;
  }
}

.video-player__controls {
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
}

.video-player__play,
.video-player__mute,
.video-player__captions,
.video-player__fullscreen,
.video-player__external {
  appearance: none;
  background: none;
  border: none;
  padding: 0.375rem;
  min-width: 24px;
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  cursor: pointer;
  border-radius: 6px;
  text-decoration: none;
  transition: background-color var(--t-fast);

  svg {
    width: 18px;
    height: 18px;
  }
  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
  &::after {
    display: none;
  }
}

.video-player__captions[aria-pressed="true"] {
  background: rgba(255, 255, 255, 0.25);
}
.video-player__captions[hidden] {
  display: none;
}

.video-player__seek {
  flex: 1;
  accent-color: var(--g-color--accent);
  cursor: pointer;
  min-height: 24px;
}

.video-player__time,
.video-player__duration {
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
}
```

- [ ] **Step 6: Build and verify**

```bash
npm run build:eleventy
grep -c 'class="video-player"' _site/appearances/index.html
grep -c 'video-player__mount' _site/appearances/index.html
```

Expected: both `20` (one per video appearance).

- [ ] **Step 7: Manual browser verification**

```bash
npm start
```

Open `/appearances/`, click a row, and confirm:
1. The player loads paused (no autoplay) with a visible control bar.
2. Play button starts playback and its icon swaps to pause; clicking again pauses.
3. The seek bar moves during playback and dragging it seeks.
4. Time/duration display update and are formatted correctly (`M:SS`, or `H:MM:SS` for anything over an hour).
5. Mute button toggles and swaps icon.
6. Fullscreen button enters/exits fullscreen, and the control bar is still visible and usable while fullscreen.
7. The external-link button opens the correct video's YouTube URL in a new tab.
8. No native YouTube controls or "Watch on YouTube" link are visible anywhere in the embed itself.

- [ ] **Step 8: Commit**

```bash
git add _includes/assets/js/video-player.js appearances.njk _includes/assets/js/jgg.js _includes/layouts/base.njk _includes/assets/scss/_appearances.scss
git commit -m "$(cat <<'EOF'
feat: replace native YouTube embed with a custom accessible player

Adds a MediaController interface and a YouTubeController adapter
wrapping the YouTube IFrame Player API, plus a custom control bar
(play/pause, seek, time, mute, fullscreen, watch-on-YouTube). controls:0
removes all native YouTube UI so there's exactly one "watch on
YouTube" affordance. video-player.js is only inlined on the
Appearances page.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Own `VideoObject` JSON-LD (fixes a real SEO regression Task 1 introduces)

**Files:**
- Modify: `appearances.njk`

**Interfaces:**
- Consumes: `collections.appearance` (existing, from the original Appearances build) — `item.data.{id, title, source_url, source_name, cover_image}`.
- Produces: nothing consumed by later tasks — this is a self-contained JSON-LD block.

**Why this task exists:** the site's shared `eleventy-plugins/video-schema.js` transform generates `VideoObject` JSON-LD by regex-scanning *rendered HTML* for `<iframe src=".../embed/ID">` at build time. Task 1 removes that literal iframe from the static markup entirely — `YT.Player` constructs it client-side, at runtime, so there's nothing left in the build-time HTML for that scan to find. Without a fix, Task 1 silently drops all 20 `VideoObject` entries that existed before this redesign. Rather than modifying the shared plugin (already touched once for something unrelated during the original build) or trying to keep a dormant iframe around purely for a regex to find, this task emits `VideoObject` JSON-LD directly from `collections.appearance`, the same way `speaking.njk` already emits its own `ItemList`/`Event` JSON-LD from `collections.speaking_event` — this is the established pattern for this kind of page-specific structured data, and it uses richer data (our own `cover_image`, `source_name`) than the oEmbed-based plugin ever had access to.

One design choice worth calling out: this emits one *independent* `<script type="application/ld+json">` block per video, not a single `[...]`-wrapped array with comma-separated entries. Multiple separate JSON-LD blocks on one page are explicitly valid and commonly used — and it sidesteps a real bug an array would introduce: computing "is this the last array entry" via `{% if not loop.last %}` only works cleanly while *every* item in the loop is a video. The moment a `book`/`podcast`/`quote` entry exists in `collections.appearance` (which, per the design spec, is coming right after this), a comma-before-`]`-with-nothing-after or a missing comma becomes possible depending on whether the trailing non-video items come after the last video item in sort order — malformed JSON that would silently break here. Independent blocks per item need no cross-item comma bookkeeping at all, so they don't have this failure mode regardless of what other types get added later.

- [ ] **Step 1: Add a JSON-LD block to `appearances.njk`**

Add near the end of the file, after the closing `</section>` of the image panel:

```njk
{# ── JSON-LD: one independent VideoObject block per video appearance.
   Generated directly from collection data (title/source_url/source_name/
   cover_image), not by regex-scanning rendered iframes — see the plan's
   Task 2 for why: the custom player builds its iframe client-side, so
   there's no iframe in the static HTML for the shared video-schema.js
   transform to find anymore. Independent blocks (not one array) so
   adding non-video types later never risks malformed comma placement. #}
{% for item in collections.appearance %}
{% if item.data.type == "video" %}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": {{ item.data.title | dump | safe }},
  "description": {{ item.data.title | dump | safe }},
  "thumbnailUrl": {{ (metadata.url + "/assets/img/" + item.data.cover_image) | dump | safe }},
  "uploadDate": "{{ item.data.date | htmlDateString }}",
  "contentUrl": {{ item.data.source_url | dump | safe }},
  "embedUrl": {{ ("https://www.youtube-nocookie.com/embed/" + item.data.id) | dump | safe }},
  "author": {
    "@type": "Organization",
    "name": {{ item.data.source_name | dump | safe }}
  }
}
</script>
{% endif %}
{% endfor %}
```

- [ ] **Step 2: Build and verify**

```bash
npm run build:eleventy
grep -c '"@type": "VideoObject"' _site/appearances/index.html
node -e "
const fs = require('fs');
const html = fs.readFileSync('_site/appearances/index.html', 'utf8');
const blocks = [...html.matchAll(/<script type=\"application\/ld\+json\">\s*({[\s\S]*?})\s*<\/script>/g)]
  .map(m => JSON.parse(m[1]))
  .filter(o => o['@type'] === 'VideoObject');
console.log('entries:', blocks.length);
console.log('sample:', JSON.stringify(blocks[0], null, 2));
"
```

Expected: `grep -c` returns `20`; the Node script parses every block without throwing (confirms each is valid, independent JSON, not just present text) and prints 20 `VideoObject` entries with `name`/`thumbnailUrl`/`uploadDate`/`contentUrl`/`embedUrl`/`author` all populated (not empty strings).

- [ ] **Step 3: Commit**

```bash
git add appearances.njk
git commit -m "$(cat <<'EOF'
feat: generate VideoObject JSON-LD directly from appearance data

Task 1 replaced the server-rendered YouTube iframe with a
client-side-constructed custom player, which means the shared
video-schema.js transform (regex-scans rendered HTML for iframe
embeds) no longer finds anything to generate schema from. This emits
VideoObject JSON-LD directly from collections.appearance instead,
matching how speaking.njk already emits its own Event/ItemList
schema — and uses richer data (cover_image, source_name) than the
oEmbed-based plugin had access to.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Keyboard shortcuts and accessible state announcements

**Files:**
- Modify: `_includes/assets/js/video-player.js`

**Interfaces:**
- Consumes: the `MediaController` object and DOM structure from Task 1 (`jggInitVideoPlayer`'s local variables — this task extends that same function).
- Consumes: the site's existing `#page-announcer` element (`layouts/base.njk`, already present site-wide — the same live region used for letter soft-navigation).

- [ ] **Step 1: Add keyboard handling and announcements to `jggInitVideoPlayer`**

Find (in `_includes/assets/js/video-player.js`, the end of `jggInitVideoPlayer`, just before its `return controller;` line):

```js
  seekInput.addEventListener('input', function() {
    if (controller.getDuration()) {
      timeEl.textContent = jggFormatTime((Number(seekInput.value) / 100) * controller.getDuration());
    }
  });

  return controller;
```

Replace with:

```js
  seekInput.addEventListener('input', function() {
    if (controller.getDuration()) {
      timeEl.textContent = jggFormatTime((Number(seekInput.value) / 100) * controller.getDuration());
    }
  });

  var announcer = document.getElementById('page-announcer');
  controller.on('statechange', function(state) {
    if (announcer) announcer.textContent = state.playing ? 'Playing' : 'Paused';
  });

  // Keyboard shortcuts scoped to this player only (not document-wide,
  // so they never collide with typing elsewhere on the page). The
  // range input handles its own left/right arrow keys natively —
  // skip this handler entirely when it's the focused element.
  root.addEventListener('keydown', function(e) {
    if (document.activeElement === seekInput) return;
    switch (e.key) {
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        controller.togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        controller.seek(Math.max(0, controller.getCurrentTime() - 5));
        break;
      case 'ArrowRight':
        e.preventDefault();
        controller.seek(Math.min(controller.getDuration(), controller.getCurrentTime() + 5));
        break;
      case 'ArrowUp':
        e.preventDefault();
        controller.setVolume(controller.getVolume() + 10);
        break;
      case 'ArrowDown':
        e.preventDefault();
        controller.setVolume(controller.getVolume() - 10);
        break;
      case 'm':
      case 'M':
        controller.toggleMute();
        setMuteIcon(controller.isMuted());
        break;
      case 'f':
      case 'F':
        fullscreenBtn.click();
        break;
    }
  });

  return controller;
```

- [ ] **Step 2: Build and verify**

```bash
npm run build:eleventy
grep -c "page-announcer" _site/appearances/index.html
```

Expected: greater than `0` (confirms the announcer element itself is present on this page, inherited from `base.njk` — this task reuses it, doesn't create it).

- [ ] **Step 3: Manual browser verification**

```bash
npm start
```

Open `/appearances/`, click a row to load the player, click somewhere inside `.video-player` to give it focus, then:
1. Press Space — confirm play/pause toggles and doesn't scroll the page (default Space behavior).
2. Press ArrowLeft/ArrowRight — confirm the seek position jumps back/forward ~5 seconds.
3. Press ArrowUp/ArrowDown — confirm volume changes (check via the mute button's state or by listening).
4. Press `m` — confirm mute toggles and the icon updates.
5. Press `f` — confirm fullscreen toggles.
6. Tab to the seek bar specifically and press ArrowLeft/ArrowRight — confirm the *native* range input behavior handles it (moves the slider), not the custom player-wide handler.
7. Check `#page-announcer`'s text content updates to "Playing"/"Paused" on state changes (inspect via DevTools/accessibility tree, or a screen reader if available).

- [ ] **Step 4: Commit**

```bash
git add _includes/assets/js/video-player.js
git commit -m "$(cat <<'EOF'
feat: add keyboard shortcuts and state announcements to video player

Space/arrows/m/f, scoped to the player container so they don't
collide with typing elsewhere on the page. Play/pause state changes
announce through the site's existing #page-announcer live region.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Captions toggle

**Files:**
- Modify: `_includes/assets/js/video-player.js`

**Interfaces:**
- Consumes: the `controller` object from Task 1 — but this task needs the *underlying* `YT.Player` instance for the captions module, which isn't part of the `MediaController` interface (captions are YouTube-specific, not part of the cross-platform shape). Add a `getNativePlayer()` escape hatch to `YouTubeController` for exactly this — a future Spotify adapter would return `null` from its own `getNativePlayer()` if Spotify has no equivalent, and captions-dependent code (this task) already has to be adapter-aware regardless, so this doesn't leak platform specifics into the rest of the control bar.

- [ ] **Step 1: Add `getNativePlayer()` to `createYouTubeController`'s returned object**

Find (in `_includes/assets/js/video-player.js`, inside `createYouTubeController`'s return statement):

```js
      on: function(event, handler) {
        (listeners[event] = listeners[event] || []).push(handler);
      },
      destroy: function() {
```

Replace with:

```js
      on: function(event, handler) {
        (listeners[event] = listeners[event] || []).push(handler);
      },
      // Escape hatch for adapter-specific functionality that doesn't
      // belong in the cross-platform MediaController shape (captions
      // is the only current user of this — see jggInitVideoPlayer).
      getNativePlayer: function() { return player; },
      destroy: function() {
```

- [ ] **Step 2: Wire up the captions button in `jggInitVideoPlayer`**

Find (in `_includes/assets/js/video-player.js`, inside `jggInitVideoPlayer`):

```js
  var mount = root.querySelector('.video-player__mount');
  var playBtn = root.querySelector('.video-player__play');
  var muteBtn = root.querySelector('.video-player__mute');
  var fullscreenBtn = root.querySelector('.video-player__fullscreen');
  var seekInput = root.querySelector('.video-player__seek');
  var timeEl = root.querySelector('.video-player__time');
  var durationEl = root.querySelector('.video-player__duration');
  if (!mount || !playBtn || !muteBtn || !fullscreenBtn || !seekInput || !timeEl || !durationEl) return;
```

Replace with:

```js
  var mount = root.querySelector('.video-player__mount');
  var playBtn = root.querySelector('.video-player__play');
  var muteBtn = root.querySelector('.video-player__mute');
  var captionsBtn = root.querySelector('.video-player__captions');
  var fullscreenBtn = root.querySelector('.video-player__fullscreen');
  var seekInput = root.querySelector('.video-player__seek');
  var timeEl = root.querySelector('.video-player__time');
  var durationEl = root.querySelector('.video-player__duration');
  if (!mount || !playBtn || !muteBtn || !captionsBtn || !fullscreenBtn || !seekInput || !timeEl || !durationEl) return;
```

Find (the `controller.ready.then(...)` block added in Task 1):

```js
  controller.ready.then(function() {
    setMuteIcon(controller.isMuted());
    durationEl.textContent = jggFormatTime(controller.getDuration());
  });
```

Replace with:

```js
  controller.ready.then(function() {
    setMuteIcon(controller.isMuted());
    durationEl.textContent = jggFormatTime(controller.getDuration());
    setupCaptions();
  });

  // Best-effort: the IFrame API's captions module is less consistently
  // documented than core playback (see the design spec's Open Risks).
  // cc_load_policy:1, set at player construction, is the fallback if
  // this doesn't pan out for a given video — captions still show by
  // YouTube's own default behavior even with the button hidden.
  function setupCaptions() {
    var player = controller.getNativePlayer();
    if (!player) return;
    var tracklist;
    try {
      player.loadModule('captions');
      tracklist = player.getOption('captions', 'tracklist');
    } catch (e) {
      tracklist = null;
    }
    if (!tracklist || !tracklist.length) {
      captionsBtn.hidden = true;
      return;
    }
    captionsBtn.hidden = false;
    var on = false;
    captionsBtn.addEventListener('click', function() {
      on = !on;
      try {
        if (on) player.setOption('captions', 'track', tracklist[0]);
        else player.setOption('captions', 'track', {});
      } catch (e) {}
      captionsBtn.setAttribute('aria-pressed', String(on));
    });
  }
```

- [ ] **Step 3: Build and verify**

```bash
npm run build:eleventy
grep -c 'video-player__captions' _site/appearances/index.html
```

Expected: `20` (button markup present on every video, from Task 1 — this task only adds behavior).

- [ ] **Step 4: Manual browser verification — empirical, per the spec's flagged risk**

```bash
npm start
```

Open `/appearances/` and click into at least 3 different videos (mix of channels/ages, e.g. one from GradComm, one from Enrollify, one of the oldest HigherEdLive ones):
1. For each, check whether the captions button appears (`hidden` cleared) or stays hidden.
2. For any video where it appears, click it — confirm captions actually toggle on/off in the video, and `aria-pressed` updates.
3. If the captions module throws or behaves inconsistently for some videos (e.g., `getOption` returns something unexpected), that's fine — this is exactly the documented risk. Note in the commit/report which videos worked and which didn't, rather than treating any failure as a blocker: the `cc_load_policy: 1` fallback (Task 1) means those videos still get default captions from YouTube itself, just without our custom toggle.

- [ ] **Step 5: Commit**

```bash
git add _includes/assets/js/video-player.js
git commit -m "$(cat <<'EOF'
feat: add captions toggle to video player

Best-effort — the IFrame API's captions module is used when a
video has caption tracks available; the button hides itself
otherwise. cc_load_policy:1 (set when the player is constructed)
is the fallback either way, so captions are never worse than before
this player replaced the native embed, even for videos where the
custom toggle doesn't apply.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Analytics (Plausible events)

**Files:**
- Modify: `_includes/assets/js/video-player.js` (`Appearance Play`, `Appearance Progress`, `Outbound Link: Click`)
- Modify: `_includes/assets/js/jgg.js` (`Appearance Selected`, in the existing `select()` function)

**Interfaces:**
- Consumes: `window.plausible` (already loaded site-wide via `_includes/components/head.njk` — present on every page, including Appearances).
- Consumes: `root.dataset.videoId` / the appearance's title (needs to be available where these events fire — see Step 1, which adds `data-video-title` to the markup Task 1 already created, since Task 1's markup only carried `data-video-id`).

- [ ] **Step 1: Add `data-video-title` to the video player markup**

Find (in `appearances.njk`, inside the video `<template>` block added in Task 1):

```njk
          <div class="video-player" data-video-id="{{ item.data.id }}">
```

Replace with:

```njk
          <div class="video-player" data-video-id="{{ item.data.id }}" data-video-title="{{ item.data.title }}">
```

- [ ] **Step 2: Fire `Appearance Play` and `Appearance Progress` in `video-player.js`**

Find (in `_includes/assets/js/video-player.js`, inside `jggInitVideoPlayer`):

```js
  var videoId = root.dataset.videoId;
  var controller = window.JGGVideoPlayer.create(mount, videoId);
  var seeking = false;
```

Replace with:

```js
  var videoId = root.dataset.videoId;
  var videoTitle = root.dataset.videoTitle;
  var controller = window.JGGVideoPlayer.create(mount, videoId);
  var seeking = false;
  var hasFiredPlay = false;
  var firedMilestones = {};

  function track(eventName, props) {
    if (typeof window.plausible === 'function') {
      window.plausible(eventName, { props: props });
    }
  }
```

Find (the `controller.on('statechange', ...)` block from Task 3 — the version with the announcer):

```js
  var announcer = document.getElementById('page-announcer');
  controller.on('statechange', function(state) {
    if (announcer) announcer.textContent = state.playing ? 'Playing' : 'Paused';
  });
```

Replace with:

```js
  var announcer = document.getElementById('page-announcer');
  controller.on('statechange', function(state) {
    if (announcer) announcer.textContent = state.playing ? 'Playing' : 'Paused';
    if (state.playing && !hasFiredPlay) {
      hasFiredPlay = true;
      track('Appearance Play', { title: videoTitle });
    }
  });
```

Find (the `controller.on('timeupdate', ...)` block from Task 1):

```js
  controller.on('timeupdate', function(t) {
    if (!seeking) seekInput.value = String(t.duration ? (t.currentTime / t.duration) * 100 : 0);
    timeEl.textContent = jggFormatTime(t.currentTime);
    durationEl.textContent = jggFormatTime(t.duration);
  });
```

Replace with:

```js
  controller.on('timeupdate', function(t) {
    if (!seeking) seekInput.value = String(t.duration ? (t.currentTime / t.duration) * 100 : 0);
    timeEl.textContent = jggFormatTime(t.currentTime);
    durationEl.textContent = jggFormatTime(t.duration);

    if (!t.duration) return;
    var pct = (t.currentTime / t.duration) * 100;
    [25, 50, 75, 100].forEach(function(milestone) {
      if (pct >= milestone && !firedMilestones[milestone]) {
        firedMilestones[milestone] = true;
        track('Appearance Progress', { title: videoTitle, milestone: milestone + '%' });
      }
    });
  });
```

- [ ] **Step 3: Fire `Outbound Link: Click` on the "Watch on YouTube" button**

Find (in `_includes/assets/js/video-player.js`, inside `jggInitVideoPlayer`, near the other button lookups):

```js
  var fullscreenBtn = root.querySelector('.video-player__fullscreen');
```

(leave that line as-is), and find where controls are wired (after the `fullscreenBtn.addEventListener('click', ...)` block from Task 1):

```js
  fullscreenBtn.addEventListener('click', function() {
    if (document.fullscreenElement === root) {
      document.exitFullscreen();
    } else if (root.requestFullscreen) {
      root.requestFullscreen();
    }
  });
```

Add immediately after it:

```js
  var externalLink = root.querySelector('.video-player__external');
  if (externalLink) {
    externalLink.addEventListener('click', function() {
      track('Outbound Link: Click', { url: externalLink.href });
    });
  }
```

- [ ] **Step 4: Fire `Appearance Selected` in `jgg.js`'s `select()` function**

Find (in `_includes/assets/js/jgg.js`, inside `select(btn)` — the block added/modified in Task 1):

```js
    while (slide.firstChild) slide.removeChild(slide.firstChild);
    var clone = tpl.content.cloneNode(true);
    slide.appendChild(clone);
    var playerRoot = slide.querySelector('.video-player');
    if (playerRoot && typeof jggInitVideoPlayer === 'function') {
      jggInitVideoPlayer(playerRoot);
    }
    collapseDetail();
```

Replace with:

```js
    while (slide.firstChild) slide.removeChild(slide.firstChild);
    var clone = tpl.content.cloneNode(true);
    slide.appendChild(clone);
    var playerRoot = slide.querySelector('.video-player');
    if (playerRoot && typeof jggInitVideoPlayer === 'function') {
      jggInitVideoPlayer(playerRoot);
    }
    if (typeof window.plausible === 'function') {
      window.plausible('Appearance Selected', { props: { title: btn.querySelector('.appearance__title').textContent.trim() } });
    }
    collapseDetail();
```

- [ ] **Step 5: Build and verify**

```bash
npm run build:eleventy
grep -c "Appearance Play\|Appearance Progress\|Outbound Link" _site/appearances/index.html
grep -c "Appearance Selected" _site/appearances/index.html
```

Expected: both greater than `0` (the event-name strings are literal in the inlined JS — Terser minifies identifiers, not string literals, so these greps work post-minification unlike identifier-based checks).

- [ ] **Step 6: Manual browser verification**

```bash
npm start
```

Open `/appearances/` with DevTools Network tab open, filtered to `plausible`:
1. Click a row — confirm one request fires with event name `Appearance Selected` and the correct title in its payload.
2. Press play — confirm `Appearance Play` fires once (and does NOT re-fire if you pause and play again — `hasFiredPlay` should make it a one-time-per-load event).
3. Let (or seek) the video past 25%/50%/75%/100% — confirm `Appearance Progress` fires once per threshold, not repeatedly.
4. Click "Watch on YouTube" — confirm `Outbound Link: Click` fires with the correct URL.

- [ ] **Step 7: Commit**

```bash
git add _includes/assets/js/video-player.js appearances.njk _includes/assets/js/jgg.js
git commit -m "$(cat <<'EOF'
feat: track Appearances engagement in Plausible

Four events: Appearance Selected (row clicked), Appearance Play
(playback actually starts), Appearance Progress (25/50/75/100%
watched, each once per load), and Outbound Link: Click (the
watch-on-YouTube button) — matching Plausible's own naming
convention for outbound links. These are the first custom events in
this codebase.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Accessibility verification and production build check

**Files:** none (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1-5.

- [ ] **Step 1: Target size check**

```bash
npm start
```

In the browser, inspect each control-bar button's computed box size (DevTools → Elements → computed layout, or `getBoundingClientRect()` in the console) — confirm every button is at least 24×24 CSS pixels (WCAG 2.5.8). The CSS in Task 1 sets `min-width`/`min-height: 24px` on each button; confirm padding/icon sizing doesn't accidentally shrink the actual clickable box below that.

- [ ] **Step 2: Contrast check — against real video frames, not assumed**

With a video loaded and playing, use the browser DevTools' contrast checker (or compute manually: `getComputedStyle` for color/background, run through a contrast-ratio formula) on:
1. The control bar's icons/text (`#fff`) against its background (`rgba(0, 0, 0, 0.85)`) — should comfortably clear both 4.5:1 (text) and 3:1 (UI components) given how opaque the background is.
2. Try this against at least one visually bright video (e.g., one with a light/white background thumbnail) to confirm the flat opaque background (not a gradient) holds up regardless of what's playing underneath.

- [ ] **Step 3: Keyboard-only pass**

Using only the keyboard (no mouse):
1. Tab to a row's trigger button, press Enter to select it.
2. Tab into the control bar — confirm every control (play, seek, mute, captions if visible, fullscreen, watch-on-YouTube) is reachable in a sensible order and has a visible focus ring.
3. Confirm Task 3's shortcuts work when focus is anywhere inside `.video-player` (not just on the play button specifically).
4. Confirm the seek `<input type="range">` responds to arrow keys natively (this is inherent to the native element, not custom code — just confirm nothing in Task 3 accidentally intercepts it, per Task 3's own `document.activeElement === seekInput` guard).

- [ ] **Step 4: Full production build**

```bash
npm run build
```

Expected: exit `0`, no errors.

- [ ] **Step 5: Verify production output**

```bash
grep -c '"@type": "VideoObject"' _site/appearances/index.html
grep -c 'video-player__controls' _site/appearances/index.html
grep -c 'video-player.js\|JGGVideoPlayer' _site/index.html
```

Expected: first two return `20` (JSON-LD and control-bar markup both survive minification/PurgeCSS); third returns `0` — confirms `video-player.js` is NOT inlined into the home page (or any other page), matching Task 1's conditional-include design.

- [ ] **Step 6: No commit needed** — this task is verification-only. If any check fails, fix the underlying task and re-run this one.
