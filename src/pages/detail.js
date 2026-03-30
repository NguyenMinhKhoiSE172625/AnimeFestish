// === Anime Detail Page ===
import { fetchAnimeDetail, getImageUrl, fetchKitsuPoster, toWebpUrl } from '../js/api.js';
import { navigate } from '../js/router.js';
import { updateSEO } from '../js/seo.js';
import { renderComments } from '../components/comments.js';

function decodeHtml(html) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html || '';
  return txt.value;
}
export async function renderDetailPage({ slug }) {
  const main = document.getElementById('main-content');

  // Loading state
  main.innerHTML = `
    <div class="detail-backdrop">
      <div class="skeleton" style="width:100%;height:100%"></div>
    </div>
    <div class="detail-content" style="margin-top:-200px;position:relative;z-index:2;">
      <div class="detail-main">
        <div class="skeleton" style="width:220px;aspect-ratio:2/3;border-radius:8px;flex-shrink:0"></div>
        <div style="flex:1">
          <div class="skeleton skeleton-text" style="width:60%;height:28px;margin-bottom:16px"></div>
          <div class="skeleton skeleton-text" style="width:40%;height:16px;margin-bottom:12px"></div>
          <div class="skeleton skeleton-text" style="width:100%;height:80px"></div>
        </div>
      </div>
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
          <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>
          <div class="empty-state-text">Kh\u00f4ng t\u00ecm th\u1ea5y anime n\u00e0y</div>
          <a href="/" class="btn btn-primary" style="margin-top:16px">V\u1ec1 trang ch\u1ee7</a>
        </div>
      `;
      return;
    }

    const imgCdn = resp._imgCdn || movie._imgCdn || '';
    function resolveImg(file) {
      if (!file) return '';
      if (file.startsWith('http')) return toWebpUrl(file);
      if (imgCdn) return toWebpUrl(`${imgCdn}${file}`);
      return getImageUrl(file);
    }

    const posterUrl = resolveImg(movie.poster_url || movie.thumb_url);
    const thumbUrl = resolveImg(movie.thumb_url || movie.poster_url);
    const plainDesc = (movie.content || movie.description || '').replace(/<[^>]*>/g, '').trim();
    updateSEO({
      title: `${movie.name}${movie.origin_name ? ' - ' + movie.origin_name : ''} Việtsub HD`,
      description: `Xem ${movie.name} vietsub miễn phí chất lượng cao. ${plainDesc.slice(0, 150)}`,
      image: posterUrl,
      url: `/anime/${slug}`,
      type: 'video.other',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': movie.type === 'single' ? 'Movie' : 'TVSeries',
        name: movie.name,
        alternateName: movie.origin_name || undefined,
        description: plainDesc.slice(0, 300),
        image: posterUrl,
        url: `https://animefetish.id.vn/anime/${slug}`,
        dateModified: movie.modified?.time || undefined,
        inLanguage: 'vi',
        genre: (movie.category || []).map(c => c.name),
        countryOfOrigin: (movie.country || []).map(c => c.name).join(', ') || undefined,
        numberOfEpisodes: movie.episode_total ? parseInt(movie.episode_total) : undefined,
      },
    });
    const categories = movie.category || [];
    const countries = movie.country || [];

    main.innerHTML = `
      <div class="detail-backdrop">
        <img src="${thumbUrl}" alt="${movie.name}" />
        <div class="detail-backdrop-gradient"></div>
      </div>
      <div class="detail-content">
        <div class="detail-main">
          <div class="detail-poster">
            <img src="${posterUrl}" alt="${movie.name}" />
          </div>
          <div class="detail-info">
            <h1 class="detail-title">${movie.name}</h1>
            <p class="detail-origin">${decodeHtml(movie.origin_name) || ''}</p>
            <div class="detail-meta">
              ${movie.quality ? `<span class="detail-meta-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg> ${movie.quality}</span>` : ''}
              ${movie.lang ? `<span class="detail-meta-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> ${movie.lang}</span>` : ''}
              ${movie.year ? `<span class="detail-meta-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg> ${movie.year}</span>` : ''}
              ${movie.time ? `<span class="detail-meta-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ${movie.time}</span>` : ''}
              ${movie.episode_current ? `<span class="detail-meta-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg> ${movie.episode_current}</span>` : ''}
              ${movie.episode_total ? `<span class="detail-meta-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> ${movie.episode_total} t\u1eadp</span>` : ''}
            </div>
            <div class="detail-categories">
              ${categories.map(c => `<span class="detail-cat">${c.name}</span>`).join('')}
              ${countries.map(c => `<span class="detail-cat">${c.name}</span>`).join('')}
            </div>
            <p class="detail-desc">${movie.content || movie.description || 'Chưa có mô tả.'}</p>
            ${episodes.length > 0 && episodes[0].server_data && episodes[0].server_data.length > 0 ? `
              <div class="hero-actions">
                <button class="btn btn-primary" id="watch-first-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> B\u1eaft \u0111\u1ea7u xem</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${episodes.length > 0 ? `
        <div class="episodes-section">
          <h2 class="episodes-title">Danh sách tập</h2>
          ${episodes.map((server, sIdx) => {
            const eps = server.server_data || [];
            const LIMIT = 50;
            const needsExpand = eps.length > LIMIT;
            return `
            <div class="episodes-server">
              <div class="episodes-server-name">${server.server_name || 'Server'}</div>
              <div class="episodes-grid" id="ep-grid-${sIdx}">
                ${eps.slice(0, LIMIT).map(ep => `
                  <button class="episode-btn" data-slug="${slug}" data-ep="${ep.slug || ep.name}" data-server="${server.server_name || ''}">
                    ${ep.name}
                  </button>
                `).join('')}
              </div>
              ${needsExpand ? `<button class="btn btn-outline ep-expand-btn" data-server-idx="${sIdx}" style="margin-top:8px;width:100%">Xem thêm (${eps.length - LIMIT} tập)</button>` : ''}
            </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="episodes-section">
          <div class="empty-state" style="padding:32px 0">
            <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg></div>
            <div class="empty-state-text">Ch\u01b0a c\u00f3 t\u1eadp phim n\u00e0o</div>
          </div>
        </div>
      `}


      <div id="detail-comments"></div>
    `;

    // Episode button clicks
    main.querySelectorAll('.episode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const epSlug = btn.dataset.ep;
        navigate(`/watch/${slug}/${epSlug}`);
      });
    });

    // Expand episode buttons
    main.querySelectorAll('.ep-expand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sIdx = parseInt(btn.dataset.serverIdx);
        const grid = main.querySelector(`#ep-grid-${sIdx}`);
        const eps = episodes[sIdx]?.server_data || [];
        const remaining = eps.slice(50);
        remaining.forEach(ep => {
          const b = document.createElement('button');
          b.className = 'episode-btn';
          b.dataset.slug = slug;
          b.dataset.ep = ep.slug || ep.name;
          b.textContent = ep.name;
          b.addEventListener('click', () => navigate(`/watch/${slug}/${b.dataset.ep}`));
          grid.appendChild(b);
        });
        btn.remove();
      });
    });

    // Watch first button
    const watchFirstBtn = main.querySelector('#watch-first-btn');
    if (watchFirstBtn && episodes[0]?.server_data?.[0]) {
      watchFirstBtn.addEventListener('click', () => {
        const firstEp = episodes[0].server_data[0];
        navigate(`/watch/${slug}/${firstEp.slug || firstEp.name}`);
      });
    }

    // Progressive enhancement: try Kitsu for better poster image only
    const originName = movie.origin_name;
    if (originName) {
      fetchKitsuPoster(originName).then(kitsu => {
        if (!kitsu || !kitsu.poster) return;
        const posterEl = main.querySelector('.detail-poster img');
        if (posterEl) posterEl.src = kitsu.poster;
      });
    }

    // Firestore comments
    let cleanupComments = null;
    const commentsContainer = main.querySelector('#detail-comments');
    if (commentsContainer) {
      cleanupComments = renderComments(commentsContainer, slug);
    }

    return () => {
      if (cleanupComments) cleanupComments();
    };

  } catch (err) {
    console.error('Detail page error:', err);
    main.innerHTML = `
      <div class="empty-state" style="padding-top:120px">
        <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
        <div class="empty-state-text">L\u1ed7i t\u1ea3i d\u1eef li\u1ec7u: ${err.message}</div>
        <a href="/" class="btn btn-primary" style="margin-top:16px">V\u1ec1 trang ch\u1ee7</a>
      </div>
    `;
  }
}
