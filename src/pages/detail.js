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
          <div class="empty-state-icon">😔</div>
          <div class="empty-state-text">Không tìm thấy anime này</div>
          <a href="/" class="btn btn-primary" style="margin-top:16px">Về trang chủ</a>
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
    updateSEO({
      title: `${movie.name}${movie.origin_name ? ' - ' + movie.origin_name : ''} Việtsub HD`,
      description: `Xem ${movie.name} vietsub miễn phí chất lượng cao. ${(movie.content || movie.description || '').replace(/<[^>]*>/g, '').slice(0, 150)}`,
      image: posterUrl || thumbUrl,
      url: `/anime/${slug}`,
      type: 'video.other',
    });
    const thumbUrl = resolveImg(movie.thumb_url || movie.poster_url);
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
              ${movie.quality ? `<span class="detail-meta-tag">📺 ${movie.quality}</span>` : ''}
              ${movie.lang ? `<span class="detail-meta-tag">🌐 ${movie.lang}</span>` : ''}
              ${movie.year ? `<span class="detail-meta-tag">📅 ${movie.year}</span>` : ''}
              ${movie.time ? `<span class="detail-meta-tag">⏱ ${movie.time}</span>` : ''}
              ${movie.episode_current ? `<span class="detail-meta-tag">📋 ${movie.episode_current}</span>` : ''}
              ${movie.episode_total ? `<span class="detail-meta-tag">📦 ${movie.episode_total} tập</span>` : ''}
            </div>
            <div class="detail-categories">
              ${categories.map(c => `<span class="detail-cat">${c.name}</span>`).join('')}
              ${countries.map(c => `<span class="detail-cat">🌍 ${c.name}</span>`).join('')}
            </div>
            <p class="detail-desc">${movie.content || movie.description || 'Chưa có mô tả.'}</p>
            ${episodes.length > 0 && episodes[0].server_data && episodes[0].server_data.length > 0 ? `
              <div class="hero-actions">
                <button class="btn btn-primary" id="watch-first-btn">▶ Bắt đầu xem</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${episodes.length > 0 ? `
        <div class="episodes-section">
          <h2 class="episodes-title">Danh sách tập</h2>
          ${episodes.map(server => `
            <div class="episodes-server">
              <div class="episodes-server-name">${server.server_name || 'Server'}</div>
              <div class="episodes-grid">
                ${(server.server_data || []).map(ep => `
                  <button class="episode-btn" data-slug="${slug}" data-ep="${ep.slug || ep.name}" data-server="${server.server_name || ''}">
                    ${ep.name}
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="episodes-section">
          <div class="empty-state" style="padding:32px 0">
            <div class="empty-state-icon">📺</div>
            <div class="empty-state-text">Chưa có tập phim nào</div>
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

    // Watch first button
    const watchFirstBtn = main.querySelector('#watch-first-btn');
    if (watchFirstBtn && episodes[0]?.server_data?.[0]) {
      watchFirstBtn.addEventListener('click', () => {
        const firstEp = episodes[0].server_data[0];
        navigate(`/watch/${slug}/${firstEp.slug || firstEp.name}`);
      });
    }

    // Progressive enhancement: try Kitsu for better poster images
    const originName = movie.origin_name;
    if (originName) {
      fetchKitsuPoster(originName).then(kitsu => {
        if (!kitsu) return;
        if (kitsu.poster) {
          const posterEl = main.querySelector('.detail-poster img');
          if (posterEl) posterEl.src = kitsu.poster;
        }
        if (kitsu.cover || kitsu.poster) {
          const backdropEl = main.querySelector('.detail-backdrop img');
          if (backdropEl) backdropEl.src = kitsu.cover || kitsu.poster;
        }
      });
    }

    // Firestore comments
    const commentsContainer = main.querySelector('#detail-comments');
    if (commentsContainer) {
      renderComments(commentsContainer, slug);
    }

  } catch (err) {
    console.error('Detail page error:', err);
    main.innerHTML = `
      <div class="empty-state" style="padding-top:120px">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Lỗi tải dữ liệu: ${err.message}</div>
        <a href="/" class="btn btn-primary" style="margin-top:16px">Về trang chủ</a>
      </div>
    `;
  }
}
