// === Navbar Component ===
import { navigate } from '../js/router.js';
import { getProfiles, getCurrentProfile, setCurrentProfile, addProfile } from '../js/watchHistory.js';

let mobileOpen = false;
let searchOpen = false;

export function renderNavbar() {
  const navbar = document.getElementById('navbar');
  const currentProfile = getCurrentProfile();

  navbar.innerHTML = `
    <div class="navbar" id="nav">
      <div class="navbar-inner">
        <div class="navbar-logo" id="nav-logo">
          <img src="/Gemini_Generated_Image_l00nrdl00nrdl00n-removebg-preview.png" alt="Logo" class="navbar-logo-img" />
          <span>AnimeFetish</span>
        </div>
        <div class="navbar-links" id="nav-links">
          <a href="#/" class="nav-link" data-route="/">Trang chủ</a>
          <a href="#/anime" class="nav-link" data-route="/anime">Anime</a>
          <a href="#/category/hanh-dong" class="nav-link" data-route="/category/hanh-dong">Hành Động</a>
          <a href="#/category/tinh-cam" class="nav-link" data-route="/category/tinh-cam">Tình Cảm</a>
        </div>
        <div class="navbar-search" id="nav-search">
          <button class="navbar-search-btn" id="search-toggle">🔍</button>
          <input type="text" placeholder="Tìm anime..." id="search-input" />
        </div>
        <div class="profile-selector" id="profile-selector">
          <div class="profile-avatar">${currentProfile.charAt(0).toUpperCase()}</div>
          <span>${currentProfile}</span>
          <div class="profile-dropdown" id="profile-dropdown"></div>
        </div>
        <button class="navbar-mobile-btn" id="mobile-toggle">☰</button>
      </div>
    </div>
  `;

  // Logo click
  document.getElementById('nav-logo').addEventListener('click', () => navigate('/'));

  // Search toggle
  const searchContainer = document.getElementById('nav-search');
  const searchInput = document.getElementById('search-input');
  document.getElementById('search-toggle').addEventListener('click', () => {
    searchOpen = !searchOpen;
    searchContainer.classList.toggle('open', searchOpen);
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
  document.getElementById('mobile-toggle').addEventListener('click', () => {
    mobileOpen = !mobileOpen;
    const links = document.getElementById('nav-links');
    links.classList.toggle('mobile-open', mobileOpen);
    document.getElementById('mobile-toggle').textContent = mobileOpen ? '✕' : '☰';
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
    document.getElementById('mobile-toggle').textContent = '☰';
  }

  // Profile selector
  const profileSelector = document.getElementById('profile-selector');
  const profileDropdown = document.getElementById('profile-dropdown');

  profileSelector.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = profileDropdown.classList.toggle('open');
    if (isOpen) {
      renderProfileDropdown();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    profileDropdown.classList.remove('open');
  });

  function renderProfileDropdown() {
    const profiles = getProfiles();
    const current = getCurrentProfile();
    
    profileDropdown.innerHTML = `
      ${profiles.map(p => `
        <button class="profile-item ${p === current ? 'active' : ''}" data-profile="${p}">
          <div class="profile-avatar">${p.charAt(0).toUpperCase()}</div>
          ${p}
        </button>
      `).join('')}
      <div style="border-top:1px solid var(--border-color);margin:4px 0;"></div>
      <input class="profile-add-input" id="new-profile-input" placeholder="+ Thêm người xem..." />
    `;

    // Profile switch
    profileDropdown.querySelectorAll('.profile-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.dataset.profile;
        setCurrentProfile(name);
        profileDropdown.classList.remove('open');
        // Update UI
        profileSelector.querySelector('.profile-avatar').textContent = name.charAt(0).toUpperCase();
        const spanEl = profileSelector.querySelector('span');
        if (spanEl) spanEl.textContent = name;
        // Re-render current page to reflect new profile history
        navigate(window.location.hash.slice(1) || '/');
      });
    });

    // Add new profile
    const input = profileDropdown.querySelector('#new-profile-input');
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        const name = input.value.trim();
        addProfile(name);
        setCurrentProfile(name);
        profileDropdown.classList.remove('open');
        profileSelector.querySelector('.profile-avatar').textContent = name.charAt(0).toUpperCase();
        const spanEl = profileSelector.querySelector('span');
        if (spanEl) spanEl.textContent = name;
        navigate(window.location.hash.slice(1) || '/');
      }
    });
  }

  // Scroll effect
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('nav');
    if (nav) {
      nav.classList.toggle('scrolled', window.scrollY > 50);
    }
  });

  // Active link
  updateActiveLink();
  window.addEventListener('hashchange', updateActiveLink);
}

function updateActiveLink() {
  const hash = window.location.hash.slice(1) || '/';
  document.querySelectorAll('.nav-link').forEach(link => {
    const route = link.getAttribute('data-route');
    link.classList.toggle('active', hash === route || (route !== '/' && hash.startsWith(route)));
  });
}
