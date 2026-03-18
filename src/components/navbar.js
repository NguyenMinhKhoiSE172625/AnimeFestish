// === Navbar Component ===
import { navigate } from '../js/router.js';
import { onUserChange, logout } from '../js/auth.js';
import { renderLoginPopup } from './loginPopup.js';

let mobileOpen = false;
let searchOpen = false;

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
            <input type="text" class="mobile-search-input" id="mobile-search-input" placeholder="Tìm anime..." />
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
            <input type="text" placeholder="Tìm anime..." id="search-input" aria-label="Tìm kiếm anime" />
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
  searchToggle.addEventListener('click', () => {
    searchOpen = !searchOpen;
    searchContainer.classList.toggle('open', searchOpen);
    searchToggle.setAttribute('aria-expanded', String(searchOpen));
    if (searchOpen) searchInput.focus();
  });

  // Search submit
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && searchInput.value.trim()) {
      navigate(`/search/${encodeURIComponent(searchInput.value.trim())}`);
      searchInput.value = '';
      searchOpen = false;
      searchContainer.classList.remove('open');
    }
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
            <button class="profile-item" id="logout-btn">🚪 Đăng xuất</button>
          `;
          dropdown.querySelector('#logout-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            logout();
            dropdown.classList.remove('open');
          });
        }
      });

      document.addEventListener('click', () => {
        dropdown.classList.remove('open');
      });
    } else {
      authArea.innerHTML = `<button class="btn-login" id="login-btn">Đăng nhập</button>`;
      authArea.querySelector('#login-btn').addEventListener('click', renderLoginPopup);
    }
  });

  // Initial login button
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) loginBtn.addEventListener('click', renderLoginPopup);

  // Scroll effect
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('nav');
    if (nav) {
      nav.classList.toggle('scrolled', window.scrollY > 50);
    }
  });

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

  // Mobile search input
  const mobileSearchInput = document.getElementById('mobile-search-input');
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && mobileSearchInput.value.trim()) {
        navigate(`/search/${encodeURIComponent(mobileSearchInput.value.trim())}`);
        mobileSearchInput.value = '';
        closeMobileMenu();
      }
    });
  }
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
