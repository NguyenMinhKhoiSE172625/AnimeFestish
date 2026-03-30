// === Anime Row (Horizontal Scroll) ===
import { createAnimeCard, createSkeletonCard } from './animeCard.js';

export function renderAnimeRow(container, title, items, moreLink = null) {
  const section = document.createElement('div');
  section.className = 'section';

  section.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">${title}</h2>
      ${moreLink ? `<a href="${moreLink}" class="section-more">Xem thêm →</a>` : ''}
    </div>
    <div class="anime-row">
      <button class="anime-row-arrow left" aria-label="Scroll left"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="anime-row-scroll"></div>
      <button class="anime-row-arrow right" aria-label="Scroll right"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>
    </div>
  `;

  const scrollContainer = section.querySelector('.anime-row-scroll');

  if (items && items.length > 0) {
    items.forEach((item, i) => {
      const card = createAnimeCard(item);
      card.style.setProperty('--index', i);
      scrollContainer.appendChild(card);
    });
  }

  // Scroll arrows
  const leftArrow = section.querySelector('.anime-row-arrow.left');
  const rightArrow = section.querySelector('.anime-row-arrow.right');

  // Adaptive scroll distance based on viewport
  const getScrollDistance = () => Math.min(600, window.innerWidth * 0.8);

  leftArrow.addEventListener('click', () => {
    scrollContainer.scrollBy({ left: -getScrollDistance(), behavior: 'smooth' });
  });

  rightArrow.addEventListener('click', () => {
    scrollContainer.scrollBy({ left: getScrollDistance(), behavior: 'smooth' });
  });

  // Scroll fade indicator — hide when scrolled to end
  scrollContainer.addEventListener('scroll', () => {
    const row = section.querySelector('.anime-row');
    const atEnd = scrollContainer.scrollLeft + scrollContainer.clientWidth >= scrollContainer.scrollWidth - 10;
    row.classList.toggle('scrolled-end', atEnd);
  }, { passive: true });

  container.appendChild(section);
}

export function renderSkeletonRow(container, title) {
  const section = document.createElement('div');
  section.className = 'section';

  section.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">${title}</h2>
    </div>
    <div class="anime-row">
      <div class="anime-row-scroll"></div>
    </div>
  `;

  const scrollContainer = section.querySelector('.anime-row-scroll');
  for (let i = 0; i < 8; i++) {
    scrollContainer.appendChild(createSkeletonCard());
  }

  container.appendChild(section);
}
