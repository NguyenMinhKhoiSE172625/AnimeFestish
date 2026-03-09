// === Watch Page ===
import { fetchAnimeDetail, getImageUrl, getCleanM3u8Url, toWebpUrl } from '../js/api.js';
import { navigate } from '../js/router.js';
import { saveWatchProgress, getWatchProgress } from '../js/watchHistory.js';

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

  // Loading
  main.innerHTML = `
    <div class="watch-container">
      <div class="skeleton" style="width:100%;aspect-ratio:16/9;border-radius:8px"></div>
    </div>
  `;

  try {
    const resp = await fetchAnimeDetail(slug);
    const data = resp.data || resp;
    const movie = data.item || data.movie || data;
    const episodes = data.episodes || movie.episodes || [];

    if (!movie || !movie.name) {
      main.innerHTML = `
        <div class="empty-state" style="padding-top:120px">
          <div class="empty-state-icon">😔</div>
          <div class="empty-state-text">Không tìm thấy anime này</div>
          <a href="#/" class="btn btn-primary" style="margin-top:16px">Về trang chủ</a>
        </div>
      `;
      return;
    }

    // Find the episode
    let currentEp = null;
    let currentServerIdx = 0;
    let allEpsFlat = [];

    episodes.forEach((server, sIdx) => {
      (server.server_data || []).forEach((episode, eIdx) => {
        allEpsFlat.push({ ...episode, serverIdx: sIdx, epIdx: eIdx, serverName: server.server_name });
        if ((episode.slug === ep || episode.name === ep) && !currentEp) {
          currentEp = episode;
          currentServerIdx = sIdx;
        }
      });
    });

    if (!currentEp) {
      for (const server of episodes) {
        for (const episode of (server.server_data || [])) {
          if (episode.name === ep || episode.slug === ep) {
            currentEp = episode;
            break;
          }
        }
        if (currentEp) break;
      }
    }

    if (!currentEp) {
      main.innerHTML = `
        <div class="empty-state" style="padding-top:120px">
          <div class="empty-state-icon">📺</div>
          <div class="empty-state-text">Không tìm thấy tập phim này</div>
          <a href="#/anime/${slug}" class="btn btn-primary" style="margin-top:16px">Quay lại</a>
        </div>
      `;
      return;
    }

    // Save to watch history immediately
    saveWatchProgress(
      slug,
      currentEp.name,
      currentEp.slug || currentEp.name,
      movie.name,
      movie.thumb_url || movie.poster_url,
      0, 0
    );

    // Determine player mode
    const m3u8Url = currentEp.link_m3u8 || '';
    const embedUrl = currentEp.link_embed || '';

    // Find prev/next episodes
    const currentFlatIdx = allEpsFlat.findIndex(e => (e.slug === ep || e.name === ep));
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
                <div style="font-size:2rem;margin-bottom:8px">📺</div>
                <div>Không có link phát. Vui lòng thử server khác.</div>
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
                ⬅ Tập trước
              </button>
            ` : ''}
            <a href="#/anime/${slug}" class="btn btn-outline">📋 Danh sách tập</a>
            ${nextEp ? `
              <button class="btn btn-primary" id="next-ep-btn" data-ep="${nextEp.slug || nextEp.name}">
                Tập tiếp ➡
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
              <button class="episode-btn ${(episode.slug === ep || episode.name === ep) ? 'active' : ''}" 
                      data-ep="${episode.slug || episode.name}">
                ${episode.name}
              </button>
            `).join('')}
          </div>
        </div>
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

  } catch (err) {
    console.error('Watch page error:', err);
    main.innerHTML = `
      <div class="empty-state" style="padding-top:120px">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Lỗi tải phim: ${err.message}</div>
        <a href="#/anime/${slug}" class="btn btn-primary" style="margin-top:16px">Quay lại</a>
      </div>
    `;
  }

  return () => destroyHls();
}
