// === Watch Page ===
import { fetchAnimeDetail, getImageUrl, getCleanM3u8Url, toWebpUrl } from '../js/api.js';
import { navigate } from '../js/router.js';
import { saveWatchProgress, getWatchProgress } from '../js/watchHistory.js';
import { updateSEO } from '../js/seo.js';
import { renderComments } from '../components/comments.js';

function decodeHtml(html) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html || '';
  return txt.value;
}

let currentHls = null;
let HlsLib = null;
let controlsHideTimer = null;

async function loadHls() {
  if (!HlsLib) {
    const mod = await import('hls.js');
    HlsLib = mod.default;
  }
  return HlsLib;
}

function destroyHls() {
  if (currentHls) {
    currentHls.destroy();
    currentHls = null;
  }
  clearTimeout(controlsHideTimer);
}

// === Player Gesture & Controls System ===

function setupPlayerControls(video) {
  const wrapper = video.closest('.player-wrapper');
  if (!wrapper) return;

  // --- OSD overlay for gesture feedback ---
  const osd = document.createElement('div');
  osd.className = 'player-osd';
  wrapper.appendChild(osd);
  let osdTimer = null;

  function showOSD(icon, text) {
    osd.innerHTML = `<span class="player-osd-icon">${icon}</span><span>${text}</span>`;
    osd.classList.remove('visible');
    void osd.offsetWidth; // force reflow to restart animation
    osd.classList.add('visible');
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => osd.classList.remove('visible'), 800);
  }

  // --- Double-tap ripple effect (YouTube-style) ---
  function showTapRipple(side) {
    const ripple = document.createElement('div');
    ripple.className = `player-tap-ripple ${side}`;
    ripple.innerHTML = side === 'right'
      ? '<svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" opacity="0.9"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>'
      : '<svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" opacity="0.9"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>';
    wrapper.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  // --- Brightness (CSS filter, 0.2–1.5) ---
  let brightness = 1;

  function setBrightness(val) {
    brightness = Math.max(0.2, Math.min(1.5, val));
    video.style.filter = `brightness(${brightness})`;
    const pct = Math.round(brightness * 100);
    const icon = pct > 100
      ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2"/></svg>';
    showOSD(icon, `${pct}%`);
  }

  // --- Volume (0–1) ---
  function setVolume(val) {
    video.volume = Math.max(0, Math.min(1, val));
    video.muted = video.volume === 0;
    const pct = Math.round(video.volume * 100);
    const icon = pct === 0
      ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
      : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
    showOSD(icon, `${pct}%`);
  }

  // --- Seek ---
  function seekBy(sec) {
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + sec));
    const sign = sec > 0 ? '+' : '';
    const icon = sec > 0
      ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
      : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
    showOSD(icon, `${sign}${sec}s`);
  }

  // --- Kill native red controls permanently, use custom system ---
  video.controls = false;

  // Touch capture layer — sits on top of video, below OSD/skip
  const touchLayer = document.createElement('div');
  touchLayer.className = 'player-touch-layer';
  wrapper.appendChild(touchLayer);

  // Center play/pause button
  const playPauseBtn = document.createElement('button');
  playPauseBtn.className = 'player-center-btn';
  playPauseBtn.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  wrapper.appendChild(playPauseBtn);

  playPauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (video.paused) { video.play().catch(() => {}); }
    else { video.pause(); }
  });

  video.addEventListener('play', () => {
    playPauseBtn.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  });
  video.addEventListener('pause', () => {
    playPauseBtn.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  });

  // Fullscreen button
  const fsBtn = document.createElement('button');
  fsBtn.className = 'player-fs-btn';
  fsBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
  wrapper.appendChild(fsBtn);

  fsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (wrapper.requestFullscreen || wrapper.webkitRequestFullscreen).call(wrapper);
    }
  });

  // Custom progress bar (pink, replaces red native one)
  const progressWrap = document.createElement('div');
  progressWrap.className = 'player-progress';
  progressWrap.innerHTML = '<div class="player-progress-fill"></div><div class="player-progress-handle"></div>';
  wrapper.appendChild(progressWrap);
  const progressFill = progressWrap.querySelector('.player-progress-fill');
  const progressHandle = progressWrap.querySelector('.player-progress-handle');

  // Time display
  const timeDisplay = document.createElement('div');
  timeDisplay.className = 'player-time';
  wrapper.appendChild(timeDisplay);

  function fmtTime(s) {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    progressFill.style.width = `${pct}%`;
    progressHandle.style.left = `${pct}%`;
    timeDisplay.textContent = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;
  });

  // Progress bar seek on click/drag
  let progressDragging = false;
  function seekFromProgress(clientX) {
    const rect = progressWrap.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = pct * (video.duration || 0);
  }
  progressWrap.addEventListener('mousedown', (e) => { progressDragging = true; seekFromProgress(e.clientX); });
  document.addEventListener('mousemove', (e) => { if (progressDragging) seekFromProgress(e.clientX); });
  document.addEventListener('mouseup', () => { progressDragging = false; });
  progressWrap.addEventListener('touchstart', (e) => { seekFromProgress(e.touches[0].clientX); }, { passive: true });
  progressWrap.addEventListener('touchmove', (e) => { e.preventDefault(); seekFromProgress(e.touches[0].clientX); }, { passive: false });

  // Controls visibility
  function showControls() {
    wrapper.classList.add('controls-visible');
    wrapper.classList.remove('controls-hidden');
    clearTimeout(controlsHideTimer);
    controlsHideTimer = setTimeout(hideControls, 3500);
  }

  function hideControls(force) {
    if (video.paused && !force) return;
    wrapper.classList.remove('controls-visible');
    wrapper.classList.add('controls-hidden');
  }

  video.addEventListener('pause', () => {
    clearTimeout(controlsHideTimer);
    wrapper.classList.add('controls-visible');
    wrapper.classList.remove('controls-hidden');
  });
  video.addEventListener('play', () => showControls());
  wrapper.addEventListener('mousemove', showControls, { passive: true });
  showControls();

  // Fullscreen rotation handled globally in renderWatchPage

  // --- Skip Intro Button (85s, typical anime OP) ---
  const skipBtn = document.createElement('button');
  skipBtn.className = 'player-skip-intro';
  skipBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg> B\u1ecf qua Intro';
  wrapper.appendChild(skipBtn);

  skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    seekBy(85);
    skipBtn.classList.remove('visible');
  });

  video.addEventListener('timeupdate', () => {
    const t = video.currentTime;
    const show = t >= 5 && t <= 120 && !video.paused;
    skipBtn.classList.toggle('visible', show);
  });

  // --- Touch Gesture Engine (on touch layer, NOT native video) ---
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  let gesture = null; // 'brightness' | 'volume' | 'seek' | null
  let startBrightness = 1, startVolume = 1, startTime = 0;
  const DEAD_ZONE = 15;

  // Double-tap tracking
  let lastTapTime = 0, lastTapX = 0, tapAccum = 0, tapFlushTimer = null;

  touchLayer.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
    gesture = null;
    startBrightness = brightness;
    startVolume = video.volume;
    startTime = video.currentTime;
  }, { passive: true });

  touchLayer.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const rect = wrapper.getBoundingClientRect();

    if (!gesture) {
      if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        gesture = touchStartX < rect.left + rect.width / 2 ? 'brightness' : 'volume';
      } else {
        gesture = 'seek';
      }
      // Hide controls during gesture
      wrapper.classList.remove('controls-visible');
      wrapper.classList.add('controls-hidden');
    }

    e.preventDefault();

    if (gesture === 'brightness') {
      const delta = -dy / (rect.height * 0.7);
      setBrightness(startBrightness + delta);
    } else if (gesture === 'volume') {
      const delta = -dy / (rect.height * 0.7);
      setVolume(startVolume + delta);
    } else if (gesture === 'seek') {
      const duration = video.duration || 1;
      const maxSeek = Math.min(duration * 0.5, 120);
      const delta = (dx / rect.width) * maxSeek;
      video.currentTime = Math.max(0, Math.min(duration, startTime + delta));
      const sec = Math.round(video.currentTime - startTime);
      const sign = sec >= 0 ? '+' : '';
      const icon = sec >= 0
        ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
        : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
      showOSD(icon, `${sign}${sec}s`);
    }
  }, { passive: false });

  touchLayer.addEventListener('touchend', () => {
    const elapsed = Date.now() - touchStartTime;

    if (!gesture && elapsed < 300) {
      const now = Date.now();
      const rect = wrapper.getBoundingClientRect();
      const tapX = touchStartX;
      const isRight = tapX > rect.left + rect.width / 2;

      if (now - lastTapTime < 350 && Math.abs(tapX - lastTapX) < 80) {
        // Double-tap → seek ±5s with ripple
        const seekDir = isRight ? 5 : -5;
        tapAccum += seekDir;
        seekBy(seekDir);
        showTapRipple(isRight ? 'right' : 'left');
        clearTimeout(tapFlushTimer);
        tapFlushTimer = setTimeout(() => { tapAccum = 0; }, 600);
      } else {
        // Single tap → toggle controls visibility
        tapAccum = 0;
        if (wrapper.classList.contains('controls-visible')) {
          hideControls();
        } else {
          showControls();
        }
      }

      lastTapTime = now;
      lastTapX = tapX;
    } else if (gesture) {
      showControls();
    }

    gesture = null;
  }, { passive: true });

  // Desktop: click on touch layer = toggle controls
  touchLayer.addEventListener('click', (e) => {
    if (e.target !== touchLayer) return;
    if (wrapper.classList.contains('controls-visible')) {
      hideControls();
    } else {
      showControls();
    }
  });

  // Desktop: double-click = toggle fullscreen
  touchLayer.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (wrapper.requestFullscreen || wrapper.webkitRequestFullscreen).call(wrapper);
    }
  });
}

async function initHlsPlayer(m3u8Url, embedFallbackUrl) {
  const wrapper = document.getElementById('player-wrapper');
  if (!wrapper) return;

  destroyHls();

  const cleanUrl = getCleanM3u8Url(m3u8Url);
  wrapper.innerHTML = `<video id="hls-player" playsinline crossorigin="anonymous" style="width:100%;height:100%;background:#000"></video>`;
  const video = document.getElementById('hls-player');

  try {
    const Hls = await loadHls();

    if (Hls.isSupported()) {
      const hls = new Hls();
      currentHls = hls;
      hls.loadSource(cleanUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          destroyHls();
          const fallback = embedFallbackUrl || m3u8Url;
          wrapper.innerHTML = `<iframe id="player-iframe" src="${fallback}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture; fullscreen" loading="lazy" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>`;
        }
      });
      setupPlayerControls(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = cleanUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      });
      setupPlayerControls(video);
    }
  } catch (err) {
    console.warn('HLS.js load failed, falling back to iframe:', err);
    const fallback = embedFallbackUrl || m3u8Url;
    wrapper.innerHTML = `<iframe id="player-iframe" src="${fallback}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture; fullscreen" loading="lazy" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>`;
  }
}

function initIframePlayer(embedUrl) {
  const wrapper = document.getElementById('player-wrapper');
  if (!wrapper) return;

  destroyHls();
  wrapper.innerHTML = `<iframe id="player-iframe" src="${embedUrl}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture; fullscreen" loading="lazy" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>`;
  addIframeFullscreenBtn(wrapper);
}

// Add a landscape-fullscreen button on top of iframe players
function addIframeFullscreenBtn(wrapper) {
  const btn = document.createElement('button');
  btn.className = 'player-iframe-fs-btn';
  btn.title = 'Xem to\u00e0n m\u00e0n h\u00ecnh ngang';
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
  wrapper.appendChild(btn);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const el = wrapper;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  });
}

export async function renderWatchPage({ slug, ep }) {
  const main = document.getElementById('main-content');
  // Hide bottom nav while watching
  document.body.classList.add('watching');


  // Loading
  main.innerHTML = `
    <div class="watch-container">
      <div class="skeleton" style="width:100%;aspect-ratio:16/9;border-radius:8px"></div>
    </div>
  `;

  // Global fullscreen orientation lock — works for BOTH <video> and <iframe>
  function onGlobalFullscreenChange() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (isFs) {
      try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
    } else {
      try { screen.orientation.unlock(); } catch (e) {}
    }
  }
  document.addEventListener('fullscreenchange', onGlobalFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onGlobalFullscreenChange);

  let cleanupComments = null;
  try {
    const resp = await fetchAnimeDetail(slug);
    const data = resp.data || resp;
    const movie = data.item || data.movie || data;
    const episodes = data.episodes || movie.episodes || [];

    updateSEO({
      title: `Xem ${movie.name} - Tập ${ep} Việtsub HD`,
      description: `Xem ${movie.name} tập ${ep} vietsub miễn phí chất lượng cao trên AnimeFetish.`,
      url: `/watch/${slug}/${ep}`,
      type: 'video.episode',
    });

    if (!movie || !movie.name) {
      main.innerHTML = `
        <div class="empty-state" style="padding-top:120px">
          <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>
          <div class="empty-state-text">Kh\u00f4ng t\u00ecm th\u1ea5y anime n\u00e0y</div>
          <a href="/" class="btn btn-primary" style="margin-top:16px">V\u1ec1 trang ch\u1ee7</a>
        </div>
      `;
      return;
    }

    // Find the episode — flexible matching for NguonC ("1", "tap-1") vs KKPhim ("Tập 01", "tap-01")
    let currentEp = null;
    let currentServerIdx = 0;
    let allEpsFlat = [];

    function epMatches(episode, target) {
      if (episode.slug === target || episode.name === target) return true;
      const num = parseInt(target.replace(/\D/g, ''), 10);
      if (isNaN(num)) return false;
      const eSlugNum = parseInt((episode.slug || '').replace(/\D/g, ''), 10);
      const eNameNum = parseInt((episode.name || '').replace(/\D/g, ''), 10);
      return eSlugNum === num || eNameNum === num;
    }

    episodes.forEach((server, sIdx) => {
      (server.server_data || []).forEach((episode, eIdx) => {
        allEpsFlat.push({ ...episode, serverIdx: sIdx, epIdx: eIdx, serverName: server.server_name });
        if (epMatches(episode, ep) && !currentEp) {
          currentEp = episode;
          currentServerIdx = sIdx;
        }
      });
    });

    if (!currentEp) {
      main.innerHTML = `
        <div class="empty-state" style="padding-top:120px">
          <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg></div>
          <div class="empty-state-text">Kh\u00f4ng t\u00ecm th\u1ea5y t\u1eadp phim n\u00e0y</div>
          <a href="/anime/${slug}" class="btn btn-primary" style="margin-top:16px">Quay l\u1ea1i</a>
        </div>
      `;
      return;
    }

    // Resolve thumb URL with correct CDN before saving
    const imgCdn = resp._imgCdn || movie._imgCdn || '';
    function resolveThumb(file) {
      if (!file) return '';
      if (file.startsWith('http')) return file;
      if (imgCdn) return `${imgCdn}${file}`;
      return getImageUrl(file);
    }
    const resolvedThumb = resolveThumb(movie.thumb_url || movie.poster_url);

    // Save to watch history immediately
    saveWatchProgress(
      slug,
      currentEp.name,
      currentEp.slug || currentEp.name,
      movie.name,
      resolvedThumb,
      0, 0
    );

    // Determine player mode
    const m3u8Url = currentEp.link_m3u8 || '';
    const embedUrl = currentEp.link_embed || '';

    // Find prev/next episodes
    const currentFlatIdx = allEpsFlat.findIndex(e => epMatches(e, ep));
    const prevEp = currentFlatIdx > 0 ? allEpsFlat[currentFlatIdx - 1] : null;
    const nextEp = currentFlatIdx < allEpsFlat.length - 1 ? allEpsFlat[currentFlatIdx + 1] : null;

    main.innerHTML = `
      <div class="watch-container">
        <div class="player-wrapper" id="player-wrapper">
          ${m3u8Url ? `
            <video id="hls-player" playsinline crossorigin="anonymous" style="width:100%;height:100%;background:#000"></video>
          ` : embedUrl ? `
            <iframe 
              id="player-iframe"
              src="${embedUrl}" 
              allowfullscreen 
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              loading="lazy"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            ></iframe>
          ` : `
            <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);">
              <div style="text-align:center">
                <div style="margin-bottom:8px"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg></div>
                <div>Kh\u00f4ng c\u00f3 link ph\u00e1t. Vui l\u00f2ng th\u1eed server kh\u00e1c.</div>
              </div>
            </div>
          `}
        </div>

        <div class="watch-info">
          <h1 class="watch-title">${movie.name}</h1>
          <p class="watch-ep-title">Đang xem: Tập ${currentEp.name}</p>

          <div class="watch-nav">
            ${prevEp ? `
              <button class="btn btn-outline" id="prev-ep-btn" data-ep="${prevEp.slug || prevEp.name}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> T\u1eadp tr\u01b0\u1edbc
              </button>
            ` : ''}
            <a href="/anime/${slug}" class="btn btn-outline"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg> Danh s\u00e1ch t\u1eadp</a>
            ${nextEp ? `
              <button class="btn btn-primary" id="next-ep-btn" data-ep="${nextEp.slug || nextEp.name}">
                T\u1eadp ti\u1ebfp <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Server tabs -->
        ${episodes.length > 1 ? `
          <div>
            <h3 style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:8px;">Chọn server:</h3>
            <div class="server-tabs">
              ${episodes.map((server, idx) => {
                const epInServer = (server.server_data || []).find(e => e.slug === ep || e.name === ep);
                return `
                  <button class="server-tab ${idx === currentServerIdx ? 'active' : ''}" 
                          data-server-idx="${idx}"
                          data-ep-m3u8="${epInServer ? (epInServer.link_m3u8 || '') : ''}"
                          data-ep-embed="${epInServer ? (epInServer.link_embed || '') : ''}">
                    ${server.server_name || `Server ${idx + 1}`}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Episode list -->
        <div class="episodes-section" style="margin-top:16px;padding:0;">
          <h2 class="episodes-title">Chọn tập</h2>
          <div class="episodes-grid">
            ${(episodes[currentServerIdx]?.server_data || []).map(episode => `
              <button class="episode-btn ${epMatches(episode, ep) ? 'active' : ''}" 
                      data-ep="${episode.slug || episode.name}">
                ${episode.name}
              </button>
            `).join('')}
          </div>
        </div>

        <div id="watch-comments"></div>
      </div>
    `;

    // Initialize player
    if (m3u8Url) {
      initHlsPlayer(m3u8Url, embedUrl);
    } else if (embedUrl) {
      // Iframe already in HTML, just add fullscreen button
      const playerWrapper = main.querySelector('#player-wrapper');
      if (playerWrapper) addIframeFullscreenBtn(playerWrapper);
    }

    // Event listeners
    const prevBtn = main.querySelector('#prev-ep-btn');
    const nextBtn = main.querySelector('#next-ep-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        destroyHls();
        navigate(`/watch/${slug}/${prevBtn.dataset.ep}`);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        destroyHls();
        navigate(`/watch/${slug}/${nextBtn.dataset.ep}`);
      });
    }

    // Episode buttons
    main.querySelectorAll('.episode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        destroyHls();
        navigate(`/watch/${slug}/${btn.dataset.ep}`);
      });
    });

    // Server tabs
    main.querySelectorAll('.server-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabM3u8 = tab.dataset.epM3u8;
        const tabEmbed = tab.dataset.epEmbed;
        if (tabM3u8) {
          initHlsPlayer(tabM3u8, tabEmbed);
        } else if (tabEmbed) {
          initIframePlayer(tabEmbed);
        }
        main.querySelectorAll('.server-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });

    // Firestore comments
    const commentsContainer = main.querySelector('#watch-comments');
    if (commentsContainer) {
      cleanupComments = renderComments(commentsContainer, slug);
    }

  } catch (err) {
    console.error('Watch page error:', err);
    main.innerHTML = `
      <div class="empty-state" style="padding-top:120px">
        <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
        <div class="empty-state-text">L\u1ed7i t\u1ea3i phim: ${err.message}</div>
        <a href="/anime/${slug}" class="btn btn-primary" style="margin-top:16px">Quay l\u1ea1i</a>
      </div>
    `;
  }

  return () => {
    destroyHls();
    if (cleanupComments) cleanupComments();
    document.body.classList.remove('watching');
    document.removeEventListener('fullscreenchange', onGlobalFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', onGlobalFullscreenChange);
    try { screen.orientation.unlock(); } catch (e) {}
  };
}
