// === Anime Card Component ===
import { getImageUrl, toWebpUrl } from '../js/api.js';

function resolveImg(item) {
  const file = item.thumb_url || item.poster_url;
  if (!file) return '';
  if (file.startsWith('http')) return toWebpUrl(file);
  if (item._imgCdn) return toWebpUrl(`${item._imgCdn}${file}`);
  return getImageUrl(file);
}

export function createAnimeCard(item) {
  const card = document.createElement('div');
  card.className = 'anime-card';
  card.setAttribute('data-slug', item.slug);

  const posterUrl = resolveImg(item);

  card.innerHTML = `
    <div class="anime-card-poster">
      <img src="${posterUrl}" alt="${item.name}" loading="lazy" 
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 300%22><rect fill=%22%231a1a2e%22 width=%22200%22 height=%22300%22/><text fill=%22%236b6b7b%22 x=%22100%22 y=%22150%22 font-size=%2214%22 text-anchor=%22middle%22>No Image</text></svg>'" />
      <div class="anime-card-badges">
        ${item.quality ? `<span class="anime-card-badge badge-quality">${item.quality}</span>` : ''}
        ${item.lang ? `<span class="anime-card-badge badge-lang">${item.lang === 'Vietsub' ? 'VS' : item.lang}</span>` : ''}
      </div>
      ${item.episode_current ? `<span class="badge-ep">${item.episode_current}</span>` : ''}
      <div class="anime-card-overlay">
        <div class="anime-card-play"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>
      </div>
    </div>
    <div class="anime-card-info">
      <div class="anime-card-title" title="${item.name}">${item.name}</div>
      <div class="anime-card-sub">${item.origin_name || item.year || ''}</div>
    </div>
  `;

  card.addEventListener('click', () => {
    window.location.hash = `#/anime/${item.slug}`;
  });

  return card;
}

export function createSkeletonCard() {
  const card = document.createElement('div');
  card.className = 'anime-card';
  card.innerHTML = `
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-text" style="width:80%"></div>
    <div class="skeleton skeleton-text short"></div>
  `;
  return card;
}
