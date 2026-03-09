// === AnimeFetish — Main Entry Point ===
import './index.css';
import { addRoute, initRouter } from './js/router.js';
import { renderNavbar } from './components/navbar.js';
import { renderFooter } from './components/footer.js';
import { renderHomePage } from './pages/home.js';
import { renderDetailPage } from './pages/detail.js';
import { renderWatchPage } from './pages/watch.js';
import { renderSearchPage } from './pages/search.js';
import { renderAnimePage } from './pages/anime.js';

// Initialize components
renderNavbar();
renderFooter();

// Register routes
addRoute('/', renderHomePage);
addRoute('/anime', () => renderAnimePage({ category: 'anime' }));
addRoute('/anime/:slug', renderDetailPage);
addRoute('/watch/:slug/:ep', renderWatchPage);
addRoute('/search', () => renderSearchPage({ keyword: '' }));
addRoute('/search/:keyword', renderSearchPage);
addRoute('/category/:category', (params) => renderAnimePage(params));

// Start router
initRouter();

// Scroll-reveal: animate elements as they enter viewport
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

// Observe sections as they are added to the DOM
const mainContent = document.getElementById('main-content');
const contentObserver = new MutationObserver(() => {
  mainContent.querySelectorAll('.section, .category-header, .episodes-section, .detail-content').forEach(el => {
    if (!el.dataset.observed) {
      el.classList.add('reveal-on-scroll');
      el.dataset.observed = 'true';
      revealObserver.observe(el);
    }
  });
});
contentObserver.observe(mainContent, { childList: true, subtree: true });

// Intro animation — show briefly then fade out
const INTRO_MIN_MS = 600;
const introStart = performance.now();

window.addEventListener('load', () => {
  const elapsed = performance.now() - introStart;
  const remaining = Math.max(0, INTRO_MIN_MS - elapsed);

  setTimeout(() => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      setTimeout(() => overlay.remove(), 400);
    }
  }, remaining);
});
