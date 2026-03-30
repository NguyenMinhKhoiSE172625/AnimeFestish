// === Top 10 Ranking Row Component ===
import { navigate } from '../js/router.js';
import { getImageUrl, toWebpUrl } from '../js/api.js';

function resolveImg(item) {
  const file = item.poster_url || item.thumb_url;
  if (!file) return '';
  if (file.startsWith('http')) return toWebpUrl(file);
  if (item._imgCdn) return toWebpUrl(`${item._imgCdn}${file}`);
  return getImageUrl(file);
}

export function renderTop10Row(container, title, items, moreLink = null) {
  if (!items || items.length === 0) return;

  const section = document.createElement('div');
  section.className = 'section';

  section.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">${title}</h2>
      ${moreLink ? `<a href="${moreLink}" class="section-more">Xem thêm →</a>` : ''}
    </div>
    <div class="anime-row">
      <button class="anime-row-arrow left" aria-label="Scroll left"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="anime-row-scroll top10-scroll"></div>
      <button class="anime-row-arrow right" aria-label="Scroll right"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>
    </div>
  `;

  const scrollContainer = section.querySelector('.top10-scroll');

  items.slice(0, 10).forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'top10-card';
    card.style.setProperty('--index', index);
    card.setAttribute('data-slug', item.slug);

    const posterUrl = resolveImg(item);

    card.innerHTML = `
      <div class="top10-rank">${index + 1}</div>
      <div class="top10-poster">
        <img src="${posterUrl}" alt="${item.name}" loading="lazy"
             onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 300%22><rect fill=%22%231a1a2e%22 width=%22200%22 height=%22300%22/><text fill=%22%236b6b7b%22 x=%22100%22 y=%22150%22 font-size=%2214%22 text-anchor=%22middle%22>No Image</text></svg>'" />
        <div class="anime-card-overlay">
          <div class="anime-card-play"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>
        </div>
      </div>
      <div class="top10-info">
        <div class="anime-card-title" title="${item.name}">${item.name}</div>
      </div>
    `;

    card.addEventListener('click', () => {
      navigate(`/anime/${item.slug}`);
    });

    scrollContainer.appendChild(card);
  });

  // Scroll arrows
  const leftArrow = section.querySelector('.anime-row-arrow.left');
  const rightArrow = section.querySelector('.anime-row-arrow.right');
  const getScrollDistance = () => Math.min(600, window.innerWidth * 0.8);

  leftArrow.addEventListener('click', () => {
    scrollContainer.scrollBy({ left: -getScrollDistance(), behavior: 'smooth' });
  });
  rightArrow.addEventListener('click', () => {
    scrollContainer.scrollBy({ left: getScrollDistance(), behavior: 'smooth' });
  });

  // Scroll fade indicator
  scrollContainer.addEventListener('scroll', () => {
    const row = section.querySelector('.anime-row');
    const atEnd = scrollContainer.scrollLeft + scrollContainer.clientWidth >= scrollContainer.scrollWidth - 10;
    row.classList.toggle('scrolled-end', atEnd);
  }, { passive: true });

  container.appendChild(section);
}
