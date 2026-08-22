# Custom accessible media player — design

Status: approved for planning
Date: 2026-08-22

## Goal

Replace the raw YouTube iframe (native controls, native chrome, YouTube's own
"Watch on YouTube" link) currently loaded into the Appearances image panel
with a fully custom-controlled player built on YouTube's public IFrame
Player API. This removes YouTube's native UI entirely (`controls: 0`) and
replaces it with our own accessible control bar, so there's exactly one
"watch on YouTube" affordance (ours), and we can track engagement in
Plausible.

Podcast (Spotify/Apple Podcasts) and book support are coming immediately
after this, not hypothetically later — so this design also defines a
small `MediaController` interface the YouTube player implements, so a
Spotify adapter is additive rather than a rewrite. See **Architecture**
below for why this isn't premature abstraction: we already know the
concrete shape of what's coming next, and we already know one of the two
podcast platforms (Apple Podcasts) can't implement that interface at all,
which the architecture has to account for regardless.

## Non-goals (v1 — this spec covers the YouTube adapter only)

- **No Spotify adapter is built in this pass** — only the `MediaController`
  interface shape is defined now, informed by Spotify's actual documented
  API (verified against Spotify's current developer docs — see
  Architecture), so it slots in without restructuring `video-player.js`.
  Building it is the next spec.
- **No Apple Podcasts custom controls, ever** — confirmed (see
  Architecture) that Apple's embed exposes no public JS API at all. That
  platform gets a documented native-passthrough mode, not a
  not-yet-built adapter.
- No book-cover "player" — books aren't playable media; they're static
  cover image + buy link, no `MediaController` involved at all.
- No playback speed control, quality selection, or picture-in-picture —
  standard baseline controls only (see Controls below).
- No autoplay — clicking a row loads the player paused and ready; a
  dedicated play press is required (per explicit decision — keeps
  "loading" and "watching" as distinct, measurable steps, see Analytics).
- Not rebuilding Vidstack or Plyr from source — those are full player
  frameworks; we're building the specific control set this page needs
  directly against each platform's own API.

## Architecture: the `MediaController` interface

Every media type that supports real programmatic control (confirmed so
far: YouTube video, Spotify podcast episodes) implements the same small
interface. Every type that doesn't (confirmed so far: Apple Podcasts) is
rendered in **native-passthrough mode** instead — their own embed,
their own UI, no custom control bar, no `MediaController` object at all.
This isn't a hypothetical split: it's already forced by what each
platform's public API actually allows.

```js
// Implemented by: YouTubeController (this spec).
// Planned for: SpotifyController (next spec — Spotify's iframe API is
// confirmed to support this shape: createController() → play()/pause()/
// resume()/seek()/playback_update, verified against Spotify's current
// developer docs — but the exact playback_update payload fields need
// confirming against a real embed when that adapter is actually built,
// not assumed from documentation prose alone).
{
  ready,                    // Promise, resolves once the underlying player is usable
  play(),
  pause(),
  togglePlay(),
  seek(seconds),
  getCurrentTime(),          // number, seconds
  getDuration(),             // number, seconds
  isPlaying(),               // boolean
  on(event, handler),        // event: 'statechange' | 'timeupdate'
  destroy()
}
```

`video-player.js` owns this interface and the control-bar UI (which only
ever talks to the interface, never to `YT.Player`/Spotify's controller
directly). A `YouTubeController` factory wraps `YT.Player` to implement
it — mapping is direct (`play()` → `player.playVideo()`, `seek(s)` →
`player.seekTo(s, true)`, state derived from `onStateChange`). Adding
Spotify later means writing a `SpotifyController` factory with the same
shape and a small dispatch by `item.data.type` — the control bar, the
keyboard handling, the accessibility work, and the analytics events
(below) are all written against the interface once and don't change.

Native-passthrough types (Apple Podcasts) skip this file entirely: the
template renders that platform's own embed code as-is, no mount point,
no control bar, no `MediaController`. We can still fire `Appearance
Selected` for those (that's our own row click, nothing to do with their
API) — we cannot fire `Appearance Play` or `Appearance Progress` for
them, since we have no visibility into their internal player state (see
Analytics).

## Player mechanism: the YouTube adapter

YouTube's public **IFrame Player API**
(`https://www.youtube.com/iframe_api`) is the only way to get
programmatic control (play/pause/seek/volume/captions) over an embedded
YouTube video — this is the same underlying API any custom-chrome
YouTube player is built on, library or not. We load this script lazily,
once, the first time any video is selected — not on page load, keeping
with the "nothing loads until needed" approach already established for
this page.

Each video's `<template>` (see the existing click-to-reveal design)
currently contains a `{% yt %}` shortcode call emitting a raw iframe.
That's replaced with a placeholder mount point plus static control-bar
markup:

```njk
<div class="video-player" data-video-id="{{ item.data.id }}" data-video-title="{{ item.data.title }}" data-video-url="{{ item.data.source_url }}">
  <div class="video-player__mount"></div>
  <div class="video-player__controls">
    <!-- play/pause, seek, time, mute, captions, fullscreen, watch-on-YouTube — see Controls -->
  </div>
</div>
```

Once this markup is cloned into `#image-slide` (on row click, same
mechanism as today), JS constructs:

```js
new YT.Player(mountEl, {
  videoId: id,
  playerVars: {
    controls: 0,       // hide all native YouTube UI — we build our own
    autoplay: 0,        // load paused; explicit play press required
    rel: 0,              // related videos limited to same channel
    iv_load_policy: 3,  // no annotation overlays
    playsinline: 1,      // iOS: play inline, don't force native fullscreen takeover
    fs: 0,               // no native fullscreen button (we build our own)
    cc_load_policy: 1,   // default captions on if the source video has them (see Accessibility)
    origin: window.location.origin
  },
  events: { onReady, onStateChange }
});
```

`controls: 0` is a normal, fully-supported, extremely common use of this
public API (this is how essentially every custom-chrome YouTube player,
including Vidstack and Plyr, actually works under the hood) — not an
unsupported hack.

Fullscreen targets the `.video-player` wrapper (mount + control bar
together via the Fullscreen API), not just the video element, so our
controls stay visible and usable in fullscreen too.

`YouTubeController` (the adapter implementing `MediaController`, above)
is the only thing that touches `YT.Player` directly — it translates
`onStateChange`'s `YT.PlayerState` values into the interface's
`'statechange'` event and exposes `getCurrentTime()`/`getDuration()`
pass-through. The control bar, keyboard handling, and analytics hooks
described below are written against `MediaController`, not against
`YT.Player` — this is what makes the Spotify adapter additive later.

## Controls

Play/pause, seek bar, current time / duration, mute toggle, a captions
toggle (see Accessibility — this one is load-bearing, not optional),
fullscreen, and a "Watch on YouTube" icon button folded in as the last
control. One coherent bar — not a separate floating CTA pill anymore.

The seek bar is a real `<input type="range">`, not a hand-rolled
draggable element — this gets keyboard operability (arrow keys, Home/End)
and a non-dragging interaction path for free, which matters for WCAG
2.5.7 (see below).

## Accessibility (WCAG 2.2 AA — required, not aspirational)

**Captions — this is the one genuine open risk in this design.** WCAG
1.2.2 (Level A) requires captions be available for prerecorded video
with audio. The *current* native-controls embed already exposes
YouTube's own CC toggle when a video has captions (creator-added or
auto-generated) — replacing it with `controls: 0` custom controls would
silently **regress** that unless we rebuild equivalent access. Plan:
- Set `cc_load_policy: 1` in `playerVars` as a baseline safety net —
  YouTube shows default captions automatically if the video has them,
  independent of anything else we build.
- Attempt a real captions toggle button using the IFrame API's captions
  module (`player.loadModule('captions')`, `getOption('captions',
  'tracklist')`, `setOption('captions', 'track', ...)`). This part of
  the API is less consistently documented than the core playback
  methods — **verify empirically during implementation** against a
  couple of the actual 20 videos (not all will have captions at all,
  which is a source-content limitation outside our control, same as
  today). If the captions module proves unreliable, the `cc_load_policy`
  fallback still means we haven't made anything worse than the
  pre-redesign baseline.

**Other WCAG 2.2 AA points this design touches directly:**
- **2.5.8 Target Size (Minimum)** — every control bar button ≥24×24 CSS
  px.
- **2.5.7 Dragging Movements** — satisfied by using a native `<input
  type="range">` for seek (see Controls) rather than a custom draggable
  scrubber.
- **2.4.7 Focus Visible** — reuse the site's existing `:focus-visible {
  outline: 2px solid var(--g-color--accent) }` convention, already used
  everywhere else on the site, for every new control.
- **1.4.11 Non-text Contrast** — control bar icons/text against their
  background must hit 3:1 (UI components) / 4.5:1 (text). Verify actual
  computed colors during implementation, not just assumed from existing
  tokens — the control bar sits over a video image, not the site's
  normal background.
- **2.4.11 Focus Not Obscured (Minimum)** — a focused control must not
  be hidden behind other fixed-position page chrome (the now-playing
  widget, which is already hidden once a video is selected — see the
  existing design — helps here).
- **4.1.2 Name, Role, Value** — every icon-only button gets a real
  `aria-label` (no icon-only buttons without a text alternative); the
  play/pause button's label and icon swap with actual state, not just
  visually.
- **Keyboard**: standard media-player shortcuts (space = play/pause,
  left/right arrows = seek back/forward, up/down = volume, `m` = mute,
  `f` = fullscreen), scoped to a `keydown` listener on the player
  container itself — not global document-wide shortcuts that could
  collide with typing elsewhere on the page.
- **State announcements**: reuse the page's existing `#page-announcer`
  `aria-live="polite"` region (already used for letter soft-navigation)
  to announce "Playing" / "Paused" — not a new live region, and not
  continuous time updates (which would be unusably noisy for screen
  reader users).
- **Focus behavior**: clicking a row to load a video does not move
  focus into the player — focus stays on the clicked row, same as
  today's behavior. Users tab into the control bar deliberately if they
  want it.

## Analytics (Plausible)

Plausible is already wired into every page via `_includes/components/
head.njk` (a per-site obfuscated script path, no `data-domain` attribute
needed — site identity is baked into that URL). No custom events exist
anywhere in the codebase yet — this introduces the first ones, so the
naming chosen here is the pattern future custom events should follow.

Four events, all fired via `window.plausible(name, { props: {...} })`:

| Event | Fires when | Props |
|---|---|---|
| `Appearance Selected` | A row is clicked and the player loads (paused) | `{ title }` |
| `Appearance Play` | The custom play button transitions the player to actually playing (`onStateChange` → `PLAYING`) | `{ title }` |
| `Appearance Progress` | Playback crosses 25% / 50% / 75% / 100% of duration, each threshold firing once per video per page view | `{ title, milestone }` (`milestone` ∈ `"25%"`, `"50%"`, `"75%"`, `"100%"`) |
| `Outbound Link: Click` | The "Watch on YouTube" control-bar button is clicked | `{ url }` |

`Outbound Link: Click` deliberately reuses Plausible's own naming
convention for its outbound-links extension (rather than inventing a new
name), so it lands in the same report Plausible already has UI for,
whether or not that extension happens to also be active on the proxied
script.

Progress milestones are computed from the polling loop the seek bar
already needs (`getCurrentTime()` / `getDuration()`), not a separate
timer — check current-fraction against the next unfired threshold each
tick.

This is the concrete "play time and clicks" tracking asked for: the
funnel is selected → played → progress → (optionally) left for YouTube,
all attributable to a specific appearance by title.

All four events are written against `MediaController`
(`getCurrentTime()`/`getDuration()`/`'statechange'`), so they work
unchanged for a future Spotify adapter. For native-passthrough types
(Apple Podcasts) only `Appearance Selected` and `Outbound Link: Click`
are possible — there's no `MediaController` object to read play state
or progress from, since that platform never exposes one.

## File organization

New dedicated file, `_includes/assets/js/video-player.js` — this is
substantial, self-contained functionality (the `MediaController`
interface, the `YouTubeController` adapter, the control-bar UI, keyboard
handling, captions, analytics hooks), not a few lines to bolt onto the
existing Appearances click-handler IIFE in `jgg.js`. Inlined into
`base.njk` the same way `now-playing.js` already is, but conditionally —
only when `section == "appearances"` — so no other page's inline JS
payload grows because of this.

One file for now, not one-file-per-adapter — with a single concrete
adapter (YouTube) implemented, splitting into multiple files would be
speculative structure with nothing yet to justify the split. When the
Spotify adapter is actually built, revisit whether the file has grown
enough to warrant separating the interface/control-bar/UI from the
per-platform adapters.

New CSS in `_includes/assets/scss/_appearances.scss` (or a split-out
`_video-player.scss` if it grows large enough to warrant its own file —
decide during implementation based on actual size) for the control bar,
replacing the now-removed `.appearance-cta` floating-pill styles.

## Open risks / verify during implementation

- Captions module reliability (see Accessibility) — has a documented
  fallback either way.
- Actual contrast ratios of the control bar against real video frames —
  verify computed colors, don't assume.
- `getOptions()`/caption track availability varies per video — some of
  the 20 existing videos likely have no captions at all (creator never
  added them, auto-captions can be spotty for older/niche content) —
  that's a source-content limitation, not something this design can fix.
- (Next spec, not this one) Spotify's `playback_update` event payload
  shape needs confirming against a real embed — Spotify's docs confirm
  the event exists and podcast episodes are supported, but not the
  exact fields it carries. Community reports also mention past
  reliability issues with `play()`/`pause()` not responding, which
  Spotify says a migration addressed — worth a quick empirical check
  before committing to the adapter design, not just trusting the docs.
