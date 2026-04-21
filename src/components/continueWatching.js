// === Continue Watching Component ===
import { getImageUrl } from '../js/api.js';
import { removeFromHistory, formatTime } from '../js/watchHistory.js';
import { navigate } from '../js/router.js';

export function renderContinueWatching(container, items) {
  if (!items || items.length === 0) {
    container.innerHTML = '';
    return;
  }

  const section = document.createElement('div');
  section.className = 'section';
  section.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">Tiếp Tục Xem</h2>
    </div>
    <div class="anime-row">
      <button class="anime-row-arrow left" aria-label="Scroll left">‹</button>
      <div class="anime-row-scroll continue-scroll"></div>
      <button class="anime-row-arrow right" aria-label="Scroll right">›</button>
    </div>
  `;

  const scrollContainer = section.querySelector('.continue-scroll');

  items.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'anime-card continue-card';
    card.style.setProperty('--index', i);
    
    const thumbUrl = item.thumbUrl ? getImageUrl(item.thumbUrl) : '';
    const progressPct = item.progress || 0;
    const timeInfo = item.currentTime > 0 
      ? `${formatTime(item.currentTime)} / ${formatTime(item.duration)}` 
      : '';

    card.innerHTML = `
      <div class="anime-card-poster">
        <img src="${thumbUrl}" alt="${item.animeName}" loading="lazy"
             onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 300%22><rect fill=%22%231a1a2e%22 width=%22200%22 height=%22300%22/><text fill=%22%236b6b7b%22 x=%22100%22 y=%22150%22 font-size=%2214%22 text-anchor=%22middle%22>No Image</text></svg>'" />
        <div class="anime-card-overlay">
          <div class="anime-card-play"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>
        </div>
        <span class="badge-ep">${item.episodeName}</span>
        <div class="continue-progress">
          <div class="continue-progress-bar" style="width:${progressPct}%"></div>
        </div>
        <button class="continue-remove" data-slug="${item.slug}" title="Xóa">✕</button>
      </div>
      <div class="anime-card-info">
        <div class="anime-card-title" title="${item.animeName}">${item.animeName}</div>
        <div class="anime-card-sub">${timeInfo || item.episodeName}</div>
      </div>
    `;

    // Click to continue watching
    card.addEventListener('click', (e) => {
      if (e.target.closest('.continue-remove')) return;
      navigate(`/watch/${item.slug}/${item.episodeSlug}`);
    });

    // Remove button
    card.querySelector('.continue-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromHistory(item.slug);
      card.style.transform = 'scale(0.8)';
      card.style.opacity = '0';
      setTimeout(() => {
        card.remove();
        // If no more items, remove the section
        if (scrollContainer.children.length === 0) {
          section.remove();
        }
      }, 300);
    });

    scrollContainer.appendChild(card);
  });

  // Scroll arrows
  const leftArrow = section.querySelector('.anime-row-arrow.left');
  const rightArrow = section.querySelector('.anime-row-arrow.right');
  leftArrow.addEventListener('click', () => scrollContainer.scrollBy({ left: -600, behavior: 'smooth' }));
  rightArrow.addEventListener('click', () => scrollContainer.scrollBy({ left: 600, behavior: 'smooth' }));

  container.appendChild(section);
}
