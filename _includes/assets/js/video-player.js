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
      // Escape hatch for adapter-specific functionality that doesn't
      // belong in the cross-platform MediaController shape (captions
      // is the only current user of this — see jggInitVideoPlayer).
      getNativePlayer: function() { return player; },
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
  var captionsBtn = root.querySelector('.video-player__captions');
  var fullscreenBtn = root.querySelector('.video-player__fullscreen');
  var seekInput = root.querySelector('.video-player__seek');
  var timeEl = root.querySelector('.video-player__time');
  var durationEl = root.querySelector('.video-player__duration');
  if (!mount || !playBtn || !muteBtn || !captionsBtn || !fullscreenBtn || !seekInput || !timeEl || !durationEl) return;

  var videoId = root.dataset.videoId;
  var controller = window.JGGVideoPlayer.create(mount, videoId);
  var seeking = false;

  function setPlayIcon(playing) {
    playBtn.querySelector('.video-player__icon-play').toggleAttribute('hidden', playing);
    playBtn.querySelector('.video-player__icon-pause').toggleAttribute('hidden', !playing);
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  function setMuteIcon(muted) {
    muteBtn.querySelector('.video-player__icon-unmuted').toggleAttribute('hidden', muted);
    muteBtn.querySelector('.video-player__icon-muted').toggleAttribute('hidden', !muted);
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
    if (controller.getDuration()) {
      controller.seek((Number(seekInput.value) / 100) * controller.getDuration());
    }
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
}
