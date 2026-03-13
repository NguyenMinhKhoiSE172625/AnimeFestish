// === SEO Helper — Dynamic Meta Tag Management ===

const SITE_NAME = 'AnimeFetish';
const SITE_URL = 'https://animefetish.id.vn';
const DEFAULT_IMAGE = `${SITE_URL}/Gemini_Generated_Image_l00nrdl00nrdl00n-removebg-preview.png`;

const DEFAULTS = {
  title: `${SITE_NAME} — Xem Anime Vietsub HD Miễn Phí | Kho Anime Nhật Bản Lớn Nhất`,
  description: 'AnimeFetish - Xem anime Nhật Bản vietsub miễn phí chất lượng cao Full HD. Kho anime phá đạo với hàng nghìn bộ phim, cập nhật nhanh nhất, giao diện hiện đại, mượt mà.',
  image: DEFAULT_IMAGE,
  url: SITE_URL,
};

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    if (name.startsWith('og:') || name.startsWith('article:')) {
      el.setAttribute('property', name);
    } else {
      el.setAttribute('name', name);
    }
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

/**
 * Update all SEO meta tags. Call from each page handler.
 * @param {Object} opts
 * @param {string} opts.title - Page title (SITE_NAME will be appended)
 * @param {string} opts.description - Page description
 * @param {string} [opts.image] - OG image URL
 * @param {string} [opts.url] - Canonical URL path (e.g. '/#/anime/one-piece')
 * @param {string} [opts.type] - OG type (default: 'website')
 */
export function updateSEO({ title, description, image, url, type, jsonLd } = {}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULTS.title;
  const desc = description || DEFAULTS.description;
  const img = image || DEFAULTS.image;
  const fullUrl = url ? `${SITE_URL}${url}` : DEFAULTS.url;
  const ogType = type || 'website';

  // Basic
  document.title = fullTitle;
  setMeta('description', desc);

  // Open Graph
  setMeta('og:title', fullTitle);
  setMeta('og:description', desc);
  setMeta('og:image', img);
  setMeta('og:url', fullUrl);
  setMeta('og:type', ogType);
  setMeta('og:site_name', SITE_NAME);

  // Twitter
  setMeta('twitter:title', fullTitle);
  setMeta('twitter:description', desc);
  setMeta('twitter:image', img);
  setMeta('twitter:url', fullUrl);

  // Canonical
  setCanonical(fullUrl);

  // JSON-LD Structured Data
  let ldEl = document.getElementById('dynamic-ld-json');
  if (jsonLd) {
    if (!ldEl) {
      ldEl = document.createElement('script');
      ldEl.id = 'dynamic-ld-json';
      ldEl.type = 'application/ld+json';
      document.head.appendChild(ldEl);
    }
    ldEl.textContent = JSON.stringify(jsonLd);
  } else if (ldEl) {
    ldEl.remove();
  }
}

/**
 * Reset SEO to defaults (call on home page or unknown routes)
 */
export function resetSEO() {
  updateSEO({});
}
