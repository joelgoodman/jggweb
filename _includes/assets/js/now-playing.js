(function () {
  var API_KEY = '64f0124b6b641c344297106bcdf822d6';
  var USER = 'asilentthing';
  var POLL_MS = 300000; // 5 minutes
  var el = document.getElementById('nowPlaying');
  if (!el) return;

  var linkEl = document.getElementById('nowPlayingLink');
  var artEl = document.getElementById('nowPlayingArt');
  var statusEl = document.getElementById('nowPlayingStatus');
  var trackEl = document.getElementById('nowPlayingTrack');
  var artistEl = document.getElementById('nowPlayingArtist');
  var pollTimer = null;
  var lastTrackUrl = '';

  function fetchNowPlaying() {
    var url = 'https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks'
      + '&user=' + USER
      + '&api_key=' + API_KEY
      + '&format=json&limit=1';

    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var tracks = data.recenttracks && data.recenttracks.track;
        if (!tracks || !tracks.length) return;

        var track = tracks[0];
        var isNowPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';
        var name = track.name || '';
        var artist = (track.artist && (track.artist['#text'] || track.artist.name)) || '';
        var trackUrl = track.url || 'https://www.last.fm/user/' + USER;
        var images = track.image || [];
        var artSrc = '';

        // Get the medium or small image
        for (var i = 0; i < images.length; i++) {
          if (images[i].size === 'medium' || images[i].size === 'small') {
            artSrc = images[i]['#text'];
            if (images[i].size === 'medium') break;
          }
        }

        // Only update DOM if track changed
        if (trackUrl !== lastTrackUrl) {
          lastTrackUrl = trackUrl;
          trackEl.textContent = name;
          artistEl.textContent = artist;
          linkEl.href = trackUrl;

          if (artSrc) {
            artEl.innerHTML = '<img src="' + artSrc + '" alt="" width="40" height="40" loading="lazy">';
          } else {
            artEl.innerHTML = '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><rect width="40" height="40" fill="none"/><path d="M20 12v10M16 18l4-6 4 6" stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.3"/></svg>';
          }
        }

        if (isNowPlaying) {
          statusEl.innerHTML = '<span class="np-eq" aria-hidden="true"><span></span><span></span><span></span></span> Now playing';
          el.setAttribute('aria-label', 'Now playing: ' + name + ' by ' + artist);
          startPolling();
        } else {
          statusEl.textContent = 'Last scrobble';
          el.setAttribute('aria-label', 'Last scrobble: ' + name + ' by ' + artist);
          stopPolling();
        }

        // Show the toast
        el.hidden = false;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            el.classList.add('is-visible');
          });
        });
      })
      .catch(function () {
        // Silently fail — widget just doesn't show
      });
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(fetchNowPlaying, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // Wait for the page to fully load, then schedule the first fetch during
  // browser idle time. Keeps the Last.fm API call off the initial critical
  // request chain so LCP and the network-dependency-tree audit stay clean.
  // Falls back to a 2s timeout on Safari <16.4 where requestIdleCallback
  // isn't available.
  function kickoff() {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fetchNowPlaying, { timeout: 3000 });
    } else {
      setTimeout(fetchNowPlaying, 2000);
    }
  }
  if (document.readyState === 'complete') {
    kickoff();
  } else {
    window.addEventListener('load', kickoff, { once: true });
  }
})();
