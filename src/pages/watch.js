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
}

async function initHlsPlayer(m3u8Url, embedFallbackUrl) {
  const wrapper = document.getElementById('player-wrapper');
  if (!wrapper) return;

  destroyHls();

  const cleanUrl = getCleanM3u8Url(m3u8Url);
  wrapper.innerHTML = `<video id="hls-player" controls playsinline crossorigin="anonymous" style="width:100%;height:100%;background:#000"></video>`;
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
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = cleanUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      });
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
            <video id="hls-player" controls playsinline crossorigin="anonymous" style="width:100%;height:100%;background:#000"></video>
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

    // Initialize HLS player if m3u8 available
    if (m3u8Url) {
      initHlsPlayer(m3u8Url, embedUrl);
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
  };
}
