// === History-based SPA Router ===
import { resetSEO } from './seo.js';

const routes = {};
let currentCleanup = null;
let navId = 0;

export function addRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  history.pushState({}, '', path);
  handleRouteChange();
}

export function getCurrentRoute() {
  return window.location.pathname || '/';
}

function matchRoute(path) {
  // Try exact match first
  if (routes[path]) return { handler: routes[path], params: {} };

  // Try pattern matching
  for (const [pattern, handler] of Object.entries(routes)) {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) continue;

    const params = {};
    let match = true;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }

    if (match) return { handler, params };
  }

  return null;
}

export async function handleRouteChange() {
  const thisNav = ++navId;
  const path = getCurrentRoute();
  const matched = matchRoute(path);

  // Cleanup previous page
  if (currentCleanup && typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  const mainContent = document.getElementById('main-content');

  if (matched) {
    // Fade out current content
    mainContent.classList.add('page-leaving');
    await new Promise(r => setTimeout(r, 150));
    // Guard: if user navigated again during fade-out, abort this one
    if (thisNav !== navId) return;
    mainContent.classList.remove('page-leaving');
    window.scrollTo(0, 0);
    mainContent.classList.add('page-entering');
    const cleanup = await matched.handler(matched.params);
    if (thisNav !== navId) return;
    currentCleanup = cleanup;
    setTimeout(() => mainContent.classList.remove('page-entering'), 500);
    window.dispatchEvent(new Event('routechange'));
  } else {
    resetSEO();
    mainContent.innerHTML = `
      <section class="empty-state notfound-state">
        <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>
        <div class="empty-state-text">Không tìm thấy trang bạn đang mở</div>
        <p class="notfound-hint">Liên kết có thể đã thay đổi hoặc nội dung không còn khả dụng.</p>
        <div class="notfound-actions">
          <a href="/" class="btn btn-primary">Về trang chủ</a>
          <a href="/search" class="btn btn-outline">Đi tới tìm kiếm</a>
        </div>
      </section>
    `;
  }
}

export function initRouter() {
  window.addEventListener('popstate', handleRouteChange);

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('#') || link.target === '_blank') return;
    if (href.startsWith('/api')) return;
    e.preventDefault();
    navigate(href);
  });

  handleRouteChange();
}
