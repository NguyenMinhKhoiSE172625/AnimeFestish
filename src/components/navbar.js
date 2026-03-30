// === Navbar Component ===
import { navigate } from '../js/router.js';
import { onUserChange, logout } from '../js/auth.js';
import { renderLoginPopup } from './loginPopup.js';
import { searchAnime, getImageUrl, toWebpUrl } from '../js/api.js';
import { filterAnimeOnly } from '../js/animeFilter.js';

let mobileOpen = false;
let searchOpen = false;
let suggestTimeout = null;
let suggestFocusIdx = -1;

export function renderNavbar() {
  const navbar = document.getElementById('navbar');

  navbar.innerHTML = `
    <div class="navbar" id="nav">
      <div class="navbar-inner">
        <div class="navbar-logo" id="nav-logo">
          <span class="navbar-logo-mark" aria-hidden="true">
            <img src="/Gemini_Generated_Image_l00nrdl00nrdl00n-removebg-preview.png" alt="Logo" class="navbar-logo-img" />
          </span>
          <span class="navbar-logo-text">AnimeFetish</span>
        </div>
        <div class="navbar-links" id="nav-links">
          <div class="mobile-search-bar">
            <svg class="mobile-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" class="mobile-search-input" id="mobile-search-input" placeholder="Tìm anime..." autocomplete="off" />
            <div class="search-suggestions mobile-search-suggestions" id="mobile-search-suggestions"></div>
          </div>
          <a href="/" class="nav-link" data-route="/">Trang chủ</a>
          <a href="/anime" class="nav-link" data-route="/anime">Anime</a>
          <a href="/category/hanh-dong" class="nav-link" data-route="/category/hanh-dong">Hành Động</a>
          <a href="/category/tinh-cam" class="nav-link" data-route="/category/tinh-cam">Tình Cảm</a>
          <a href="/category/vien-tuong" class="nav-link" data-route="/category/vien-tuong">Viễn Tưởng</a>
        </div>
        <div class="navbar-actions">
          <div class="navbar-search" id="nav-search">
            <button class="navbar-search-btn" id="search-toggle" aria-label="Mở tìm kiếm" aria-expanded="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
            <input type="text" placeholder="Tìm anime..." id="search-input" aria-label="Tìm kiếm anime" autocomplete="off" />
            <div class="search-suggestions" id="search-suggestions"></div>
          </div>
          <div class="auth-area" id="auth-area">
            <button class="btn-login" id="login-btn">Đăng nhập</button>
          </div>
          <button class="navbar-mobile-btn" id="mobile-toggle" aria-label="Mở menu điều hướng" aria-controls="nav-links" aria-expanded="false">
            <span class="mobile-toggle-line"></span>
            <span class="mobile-toggle-line"></span>
          </button>
        </div>
      </div>
    </div>
    <div class="bottom-nav" id="bottom-nav">
      <button class="bottom-nav-item" data-route="/" id="bnav-home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Trang chủ</span>
      </button>
      <button class="bottom-nav-item" data-route="/anime" id="bnav-anime">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
        <span>Anime</span>
      </button>
      <button class="bottom-nav-item" data-route="/search" id="bnav-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Tìm kiếm</span>
      </button>
    </div>
    <div class="mobile-backdrop" id="mobile-backdrop"></div>
  `;

  // Logo click
  document.getElementById('nav-logo').addEventListener('click', () => navigate('/'));

  // Search toggle
  const searchContainer = document.getElementById('nav-search');
  const searchInput = document.getElementById('search-input');
  const searchToggle = document.getElementById('search-toggle');
  const suggestBox = document.getElementById('search-suggestions');
  searchToggle.addEventListener('click', () => {
    searchOpen = !searchOpen;
    searchContainer.classList.toggle('open', searchOpen);
    searchToggle.setAttribute('aria-expanded', String(searchOpen));
    if (searchOpen) searchInput.focus();
    if (!searchOpen) hideSuggestions(suggestBox);
  });

  // Desktop search autocomplete
  setupSearchAutocomplete(searchInput, suggestBox, () => {
    searchInput.value = '';
    searchOpen = false;
    searchContainer.classList.remove('open');
  });

  // Mobile menu
  const mobileToggle = document.getElementById('mobile-toggle');
  mobileToggle.addEventListener('click', () => {
    mobileOpen = !mobileOpen;
    const links = document.getElementById('nav-links');
    links.classList.toggle('mobile-open', mobileOpen);
    document.getElementById('mobile-backdrop').classList.toggle('active', mobileOpen);
    mobileToggle.classList.toggle('is-open', mobileOpen);
    mobileToggle.setAttribute('aria-expanded', String(mobileOpen));
  });

  // Close mobile menu on link click
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      closeMobileMenu();
    });
  });

  // Close mobile menu when clicking outside (on the overlay itself)
  document.getElementById('nav-links').addEventListener('click', (e) => {
    if (e.target === document.getElementById('nav-links')) {
      closeMobileMenu();
    }
  });

  function closeMobileMenu() {
    mobileOpen = false;
    document.getElementById('nav-links').classList.remove('mobile-open');
    document.getElementById('mobile-backdrop').classList.remove('active');
    mobileToggle.classList.remove('is-open');
    mobileToggle.setAttribute('aria-expanded', 'false');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (mobileOpen) {
      closeMobileMenu();
    }
    if (searchOpen) {
      searchOpen = false;
      searchContainer.classList.remove('open');
      searchToggle.setAttribute('aria-expanded', 'false');
      hideSuggestions(suggestBox);
    }
  });

  // Auth area
  const authArea = document.getElementById('auth-area');

  onUserChange((user) => {
    if (user) {
      const photo = user.photoURL || '';
      const name = user.displayName || user.email || 'User';
      const initial = name.charAt(0).toUpperCase();
      authArea.innerHTML = `
        <div class="profile-selector" id="profile-selector">
          ${photo ? `<img class="auth-avatar" src="${photo}" alt="${name}" referrerpolicy="no-referrer" />` : `<div class="profile-avatar">${initial}</div>`}
          <span class="auth-name">${name.split(' ')[0]}</span>
          <div class="profile-dropdown" id="profile-dropdown"></div>
        </div>
      `;
      const selector = document.getElementById('profile-selector');
      const dropdown = document.getElementById('profile-dropdown');

      selector.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.toggle('open');
        if (isOpen) {
          dropdown.innerHTML = `
            <div class="auth-dropdown-info">
              <div class="auth-dropdown-name">${name}</div>
              <div class="auth-dropdown-email">${user.email || ''}</div>
            </div>
            <div style="border-top:1px solid var(--border-color);margin:4px 0;"></div>
            <button class="profile-item" id="logout-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> \u0110\u0103ng xu\u1ea5t</button>
          `;
          dropdown.querySelector('#logout-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            logout();
            dropdown.classList.remove('open');
          });
        }
      });

      // Use a single named handler to avoid stacking listeners on every auth change
      if (!window._closeProfileDropdown) {
        window._closeProfileDropdown = () => {
          const dd = document.getElementById('profile-dropdown');
          if (dd) dd.classList.remove('open');
        };
        document.addEventListener('click', window._closeProfileDropdown);
      }
    } else {
      authArea.innerHTML = `<button class="btn-login" id="login-btn">Đăng nhập</button>`;
      authArea.querySelector('#login-btn').addEventListener('click', renderLoginPopup);
    }
  });

  // Initial login button
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) loginBtn.addEventListener('click', renderLoginPopup);

  // Scroll effect (passive for better mobile perf)
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('nav');
    if (nav) {
      nav.classList.toggle('scrolled', window.scrollY > 50);
    }
  }, { passive: true });

  // Active link
  updateActiveLink();
  window.addEventListener('popstate', updateActiveLink);
  window.addEventListener('routechange', updateActiveLink);

  // Bottom navigation
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const route = item.dataset.route;
      navigate(route === '/search' ? '/search/' : route);
    });
  });

  // Mobile backdrop — close menu on click
  document.getElementById('mobile-backdrop').addEventListener('click', () => {
    closeMobileMenu();
  });

  // Mobile search input with autocomplete
  const mobileSearchInput = document.getElementById('mobile-search-input');
  const mobileSuggestBox = document.getElementById('mobile-search-suggestions');
  if (mobileSearchInput && mobileSuggestBox) {
    setupSearchAutocomplete(mobileSearchInput, mobileSuggestBox, () => {
      mobileSearchInput.value = '';
      closeMobileMenu();
    });
  }

  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchContainer.contains(e.target)) {
      hideSuggestions(suggestBox);
    }
    if (mobileSuggestBox && mobileSearchInput && !mobileSearchInput.parentElement.contains(e.target)) {
      hideSuggestions(mobileSuggestBox);
    }
  });
}

function updateActiveLink() {
  const path = window.location.pathname || '/';
  document.querySelectorAll('.nav-link').forEach(link => {
    const route = link.getAttribute('data-route');
    const isActive = path === route || (route !== '/' && path.startsWith(route));
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  // Bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    const route = item.dataset.route;
    let isActive = false;
    if (route === '/search') {
      isActive = path.startsWith('/search');
    } else if (route === '/') {
      isActive = path === '/';
    } else {
      isActive = path === route || path.startsWith(route);
    }
    item.classList.toggle('active', isActive);
    if (isActive) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });
}

// === Search Autocomplete Helpers ===

function resolveSuggestImg(item) {
  const file = item.thumb_url || item.poster_url;
  if (!file) return '';
  if (file.startsWith('http')) return toWebpUrl(file);
  if (item._imgCdn) return toWebpUrl(`${item._imgCdn}${file}`);
  return getImageUrl(file);
}

function hideSuggestions(box) {
  if (box) {
    box.classList.remove('active');
    box.innerHTML = '';
  }
  suggestFocusIdx = -1;
}

function setupSearchAutocomplete(input, suggestBox, onNavigate) {
  let abortCtrl = null;

  input.addEventListener('input', () => {
    clearTimeout(suggestTimeout);
    const q = input.value.trim();

    if (q.length < 2) {
      hideSuggestions(suggestBox);
      return;
    }

    suggestBox.innerHTML = '<div class="search-suggest-loading">Đang tìm...</div>';
    suggestBox.classList.add('active');

    suggestTimeout = setTimeout(async () => {
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = new AbortController();

      try {
        const data = await searchAnime(q, 1);
        const rawItems = data.items || [];
        const items = filterAnimeOnly(rawItems).slice(0, 8);

        if (input.value.trim() !== q) return;

        if (items.length === 0) {
          suggestBox.innerHTML = '<div class="search-suggest-empty">Không tìm thấy anime nào</div>';
          return;
        }

        suggestFocusIdx = -1;
        suggestBox.innerHTML = items.map((item, i) => {
          const img = resolveSuggestImg(item);
          const meta = [item.year, item.quality, item.episode_current].filter(Boolean).join(' • ');
          return `
            <div class="search-suggest-item" data-slug="${item.slug}" data-index="${i}">
              <img src="${img}" alt="${item.name}" loading="lazy" onerror="this.style.display='none'" />
              <div class="search-suggest-info">
                <div class="search-suggest-title">${item.name}</div>
                ${meta ? `<div class="search-suggest-meta">${meta}</div>` : ''}
              </div>
            </div>
          `;
        }).join('');

        suggestBox.innerHTML += `<div class="search-suggest-viewall" data-query="${q}">Xem tất cả kết quả →</div>`;

        suggestBox.querySelectorAll('.search-suggest-item').forEach(el => {
          el.addEventListener('click', () => {
            navigate(`/anime/${el.dataset.slug}`);
            hideSuggestions(suggestBox);
            onNavigate();
          });
        });

        suggestBox.querySelector('.search-suggest-viewall')?.addEventListener('click', () => {
          navigate(`/search/${encodeURIComponent(q)}`);
          hideSuggestions(suggestBox);
          onNavigate();
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          suggestBox.innerHTML = '<div class="search-suggest-empty">Lỗi tìm kiếm</div>';
        }
      }
    }, 300);
  });

  input.addEventListener('keydown', (e) => {
    const items = suggestBox.querySelectorAll('.search-suggest-item');
    if (!items.length) {
      if (e.key === 'Enter' && input.value.trim()) {
        navigate(`/search/${encodeURIComponent(input.value.trim())}`);
        hideSuggestions(suggestBox);
        onNavigate();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      suggestFocusIdx = Math.min(suggestFocusIdx + 1, items.length - 1);
      updateFocus(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      suggestFocusIdx = Math.max(suggestFocusIdx - 1, -1);
      updateFocus(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestFocusIdx >= 0 && items[suggestFocusIdx]) {
        navigate(`/anime/${items[suggestFocusIdx].dataset.slug}`);
        hideSuggestions(suggestBox);
        onNavigate();
      } else if (input.value.trim()) {
        navigate(`/search/${encodeURIComponent(input.value.trim())}`);
        hideSuggestions(suggestBox);
        onNavigate();
      }
    } else if (e.key === 'Escape') {
      hideSuggestions(suggestBox);
    }
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2 && suggestBox.children.length > 0) {
      suggestBox.classList.add('active');
    }
  });
}

function updateFocus(items) {
  items.forEach((el, i) => {
    el.classList.toggle('focused', i === suggestFocusIdx);
    if (i === suggestFocusIdx) {
      el.scrollIntoView({ block: 'nearest' });
    }
  });
}
