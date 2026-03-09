// === Hero Banner Carousel ===
import { getImageUrl, toWebpUrl } from '../js/api.js';
import { navigate } from '../js/router.js';

let heroInterval = null;
let currentSlide = 0;

function resolveImg(item) {
  const file = item.poster_url || item.thumb_url;
  if (!file) return '';
  if (file.startsWith('http')) return toWebpUrl(file);
  if (item._imgCdn) return toWebpUrl(`${item._imgCdn}${file}`);
  return getImageUrl(file);
}

export function renderHero(container, items) {
  if (!items || items.length === 0) return;

  // Pick top 5 items with poster images
  const slides = items.slice(0, 5);

  container.innerHTML = `
    <div class="hero">
      <div class="hero-slides">
        ${slides.map((item, i) => `
          <div class="hero-slide ${i === 0 ? 'active' : ''}" data-index="${i}">
            <img class="hero-slide-bg" src="${resolveImg(item)}" alt="${item.name}" loading="${i === 0 ? 'eager' : 'lazy'}" />
            <div class="hero-gradient"></div>
            <div class="hero-content">
              <div class="hero-badge">
                <span>★</span>
                <span>${item.lang || 'Vietsub'}</span>
              </div>
              <h1 class="hero-title">${item.name.split('(')[0].trim()}</h1>
              <div class="hero-meta">
                ${item.tmdb?.vote_average ? `<span class="hero-rating">★ ${item.tmdb.vote_average.toFixed(1)}</span>` : ''}
                ${item.quality ? `<span class="quality">${item.quality}</span>` : ''}
                ${item.year ? `<span class="year">${item.year}</span>` : ''}
                ${item.episode_current ? `<span class="hero-meta-item">${item.episode_current}</span>` : ''}
                ${item.time ? `<span class="hero-meta-item">⏱ ${item.time}</span>` : ''}
              </div>
              ${item.category ? `
                <p class="hero-desc">${item.category.map(c => c.name).join(' • ')}</p>
              ` : ''}
              <div class="hero-actions">
                <button class="btn btn-primary hero-watch-btn" data-slug="${item.slug}">
                  ▶ Xem ngay
                </button>
                <button class="btn btn-outline hero-detail-btn" data-slug="${item.slug}">
                  ℹ Chi tiết
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="hero-dots">
        ${slides.map((_, i) => `
          <div class="hero-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>
        `).join('')}
      </div>
    </div>
  `;

  // Event listeners
  container.querySelectorAll('.hero-watch-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(`/anime/${btn.dataset.slug}`));
  });

  container.querySelectorAll('.hero-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(`/anime/${btn.dataset.slug}`));
  });

  // Dots
  container.querySelectorAll('.hero-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      goToSlide(container, parseInt(dot.dataset.index), slides.length);
    });
  });

  // Touch swipe support for mobile
  setupSwipe(container, slides.length);

  // Auto-rotate
  startAutoRotate(container, slides.length);
}

function setupSwipe(container, total) {
  const slidesEl = container.querySelector('.hero-slides');
  if (!slidesEl) return;

  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;

  slidesEl.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = true;
    // Pause auto-rotate while touching
    clearInterval(heroInterval);
  }, { passive: true });

  slidesEl.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;

    // Only swipe if horizontal movement is dominant and > 50px threshold
    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        // Swipe left → next slide
        const next = (currentSlide + 1) % total;
        goToSlide(container, next, total);
      } else {
        // Swipe right → prev slide
        const prev = (currentSlide - 1 + total) % total;
        goToSlide(container, prev, total);
      }
    }

    // Resume auto-rotate
    startAutoRotate(container, total);
  }, { passive: true });
}

function goToSlide(container, index, total) {
  currentSlide = index;
  container.querySelectorAll('.hero-slide').forEach((slide, i) => {
    slide.classList.toggle('active', i === index);
  });
  container.querySelectorAll('.hero-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

function startAutoRotate(container, total) {
  clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    const next = (currentSlide + 1) % total;
    goToSlide(container, next, total);
  }, 6000);
}

export function stopHero() {
  clearInterval(heroInterval);
  heroInterval = null;
  currentSlide = 0;
}
