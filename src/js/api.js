// === Multi-Source Anime API Layer ===
// Sources: KKPhim (phimapi.com) + OPhim (ophim1.com) + NguonC (phim.nguonc.com)
// KKPhim + OPhim use compatible formats; NguonC uses a different format and is adapted

// === M3U8 Ad-Cleaning Proxy ===
const M3U8_PROXY_BASE = 'https://openapiphim.pathhubphim.workers.dev';

// === WebP Image Conversion ===
const WEBP_PROXY = '/api2/image.php';

const SOURCES_OPHIM = [
  {
    name: 'PhimAPI',
    base: '/api2', // proxied to phimapi.com (KKPhim)
    imgCdn: 'https://phimimg.com/',
    type: 'ophim',
  },
  {
    name: 'OPhim',
    base: '/api',  // proxied to ophim1.com
    imgCdn: 'https://img.ophim.live/uploads/movies/',
    type: 'ophim',
  },
];

const SOURCE_NGUONC = {
  name: 'NguonC',
  base: '/api3', // proxied to phim.nguonc.com
  imgCdn: '', // NguonC returns full URLs
  type: 'nguonc',
};

const ALL_SOURCES = [...SOURCES_OPHIM, SOURCE_NGUONC];

// === Image URL Builder ===

/**
 * Convert phimimg.com URLs to WebP format for faster loading
 */
export function toWebpUrl(url) {
  if (!url) return '';
  if (url.includes('phimimg.com')) {
    return `${WEBP_PROXY}?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function getImageUrl(filename, sourceIdx = 0) {
  if (!filename) return '';
  if (filename.startsWith('http')) return toWebpUrl(filename);
  const cdn = SOURCES_OPHIM[sourceIdx]?.imgCdn || SOURCES_OPHIM[0].imgCdn;
  return toWebpUrl(`${cdn}${filename}`);
}

export function getImageUrlForSource(filename, sourceName) {
  if (!filename) return '';
  if (filename.startsWith('http')) return toWebpUrl(filename);
  const source = ALL_SOURCES.find(s => s.name === sourceName) || SOURCES_OPHIM[0];
  return source.imgCdn ? toWebpUrl(`${source.imgCdn}${filename}`) : filename;
}

// === API Response Cache ===
const apiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// === Low-level Fetch Helpers ===
async function fetchJSON(url) {
  const now = Date.now();
  const cached = apiCache.get(url);
  if (cached && (now - cached.time) < CACHE_TTL) {
    return cached.data;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  apiCache.set(url, { data, time: now });
  return data;
}

async function fetchFromOphim(source, path) {
  try {
    return await fetchJSON(`${source.base}${path}`);
  } catch (err) {
    console.warn(`[${source.name}] Failed: ${path}`, err.message);
    return null;
  }
}

async function fetchFromNguonc(path) {
  try {
    return await fetchJSON(`${SOURCE_NGUONC.base}${path}`);
  } catch (err) {
    console.warn(`[NguonC] Failed: ${path}`, err.message);
    return null;
  }
}

// === NguonC Format Adapter ===
// Converts NguonC items to OPhim-compatible format
function adaptNguoncItem(item, defaultType = '') {
  return {
    name: item.name,
    slug: item.slug,
    origin_name: item.original_name || item.origin_name || '',
    poster_url: item.poster_url || '',
    thumb_url: item.thumb_url || '',
    type: item.type || defaultType,
    year: item.year || new Date().getFullYear(),
    quality: item.quality || 'HD',
    lang: item.language || 'Vietsub',
    episode_current: item.current_episode || '',
    time: item.time || '',
    category: item.category || [],
    country: item.country || [],
    _source: 'NguonC',
    _imgCdn: '',
  };
}

function adaptNguoncItems(items, defaultType = '') {
  if (!Array.isArray(items)) return [];
  return items.map(i => adaptNguoncItem(i, defaultType));
}

// Tag items with their source for correct image URL resolution
function tagItems(items, source) {
  if (!Array.isArray(items)) return [];
  return items.map(item => ({
    ...item,
    _source: source.name,
    _imgCdn: source.imgCdn,
  }));
}

// Deduplicate items by slug (prefer first occurrence)
function deduplicateBySlug(items) {
  const seen = new Set();
  return items.filter(item => {
    if (!item?.slug || seen.has(item.slug)) return false;
    seen.add(item.slug);
    return true;
  });
}

// === Multi-Source Fetch Helpers ===
// Fetch from all OPhim-compatible sources + NguonC in parallel

async function fetchAllOphim(path) {
  const results = await Promise.allSettled(
    SOURCES_OPHIM.map(async (source) => {
      const data = await fetchFromOphim(source, path);
      const parsed = data?.data || data;
      return {
        items: tagItems(parsed?.items || [], source),
        pagination: parsed?.params?.pagination || {},
      };
    })
  );

  const allItems = [];
  let totalItems = 0;
  let totalPages = 1;

  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) {
      allItems.push(...r.value.items);
      totalItems += r.value.pagination.totalItems || 0;
      totalPages = Math.max(totalPages, r.value.pagination.totalPages || 1);
    }
  });

  return { items: allItems, totalItems, totalPages };
}

async function fetchNguoncList(path, defaultType = '') {
  const data = await fetchFromNguonc(path);
  if (!data || data.status !== 'success') return { items: [], totalItems: 0, totalPages: 1 };
  
  return {
    items: adaptNguoncItems(data.items || [], defaultType),
    totalItems: data.paginate?.total_items || 0,
    totalPages: data.paginate?.total_page || 1,
  };
}

// === Public API: Multi-Source ===

/**
 * Fetch anime list from ALL sources and merge
 */
export async function fetchAnimeList(page = 1) {
  const [ophimResult, nguoncResult] = await Promise.allSettled([
    fetchAllOphim(`/v1/api/danh-sach/hoat-hinh?page=${page}&country=nhat-ban`),
    fetchNguoncList(`/api/films/danh-sach/hoat-hinh?page=${page}`, 'hoathinh'),
  ]);

  const allItems = [];
  let totalItems = 0;
  let totalPages = 1;

  if (ophimResult.status === 'fulfilled') {
    allItems.push(...ophimResult.value.items);
    totalItems += ophimResult.value.totalItems;
    totalPages = Math.max(totalPages, ophimResult.value.totalPages);
  }
  if (nguoncResult.status === 'fulfilled') {
    allItems.push(...nguoncResult.value.items);
    totalItems += nguoncResult.value.totalItems;
    totalPages = Math.max(totalPages, nguoncResult.value.totalPages);
  }

  const rawCount = allItems.length;
  const items = deduplicateBySlug(allItems);

  return {
    items,
    rawCount,
    params: {
      pagination: { totalItems, totalPages, currentPage: page },
    },
  };
}

/**
 * Fetch Japanese anime specifically — use anime endpoint + filter by country
 * (The country endpoint returns ALL Japanese content including dramas)
 */
export async function fetchJapaneseAnime(page = 1) {
  // For OPhim, use country endpoint (OPhim items already have type=hoathinh for anime)
  // For NguonC, use hoat-hinh endpoint (which is anime-only) — we filter by Japan later
  const [ophimResult, nguoncResult] = await Promise.allSettled([
    fetchAllOphim(`/v1/api/danh-sach/hoat-hinh?page=${page}&country=nhat-ban`),
    fetchNguoncList(`/api/films/danh-sach/hoat-hinh?page=${page}`, 'hoathinh'),
  ]);

  const allItems = [];
  let totalItems = 0;
  let totalPages = 1;

  if (ophimResult.status === 'fulfilled') {
    allItems.push(...ophimResult.value.items);
    totalItems += ophimResult.value.totalItems;
    totalPages = Math.max(totalPages, ophimResult.value.totalPages);
  }
  if (nguoncResult.status === 'fulfilled') {
    allItems.push(...nguoncResult.value.items);
    totalItems += nguoncResult.value.totalItems;
    totalPages = Math.max(totalPages, nguoncResult.value.totalPages);
  }

  return {
    items: deduplicateBySlug(allItems),
    params: {
      pagination: { totalItems, totalPages, currentPage: page },
    },
  };
}

/**
 * Search anime across all sources
 */
export async function searchAnime(keyword, page = 1) {
  const [ophimResult, nguoncResult] = await Promise.allSettled([
    fetchAllOphim(`/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`),
    fetchNguoncList(`/api/films/search?keyword=${encodeURIComponent(keyword)}&page=${page}`),
  ]);

  const allItems = [];
  let totalItems = 0;

  if (ophimResult.status === 'fulfilled') {
    allItems.push(...ophimResult.value.items);
    totalItems += ophimResult.value.totalItems;
  }
  if (nguoncResult.status === 'fulfilled') {
    allItems.push(...nguoncResult.value.items);
    totalItems += nguoncResult.value.totalItems;
  }

  return {
    items: deduplicateBySlug(allItems),
    params: {
      pagination: { totalItems, currentPage: page, totalPages: Math.ceil(totalItems / 24) || 1 },
    },
  };
}

/**
 * Fetch anime detail — try each source until one succeeds
 */
export async function fetchAnimeDetail(slug) {
  // Try OPhim-compatible sources first
  for (const source of SOURCES_OPHIM) {
    try {
      const data = await fetchFromOphim(source, `/v1/api/phim/${slug}`);
      if (data && (data.data || data.movie || data.item)) {
        const result = data;
        if (result.data?.item) {
          result.data.item._source = source.name;
          result.data.item._imgCdn = source.imgCdn;
        }
        result._source = source.name;
        result._imgCdn = source.imgCdn;
        return result;
      }
    } catch (e) {
      continue;
    }
  }

  // Try NguonC
  try {
    const data = await fetchFromNguonc(`/api/film/${slug}`);
    if (data && data.status === 'success' && data.movie) {
      const movie = data.movie;
      const adapted = {
        data: {
          item: {
            name: movie.name,
            slug: movie.slug,
            origin_name: movie.original_name || '',
            poster_url: movie.poster_url || '',
            thumb_url: movie.thumb_url || '',
            content: movie.description || '',
            type: 'hoathinh',
            year: movie.year || new Date().getFullYear(),
            quality: movie.quality || 'HD',
            lang: movie.language || 'Vietsub',
            episode_current: movie.current_episode || '',
            episode_total: movie.total_episodes ? String(movie.total_episodes) : '',
            time: movie.time || '',
            category: movie.category || [],
            country: movie.country || [],
            _source: 'NguonC',
            _imgCdn: '',
          },
          episodes: movie.episodes || [],
        },
        _source: 'NguonC',
        _imgCdn: '',
      };
      return adapted;
    }
  } catch (e) {
    console.warn('[NguonC] Detail failed:', e.message);
  }

  throw new Error('Không tìm thấy anime trên bất kỳ nguồn nào');
}

/**
 * Fetch high-quality poster from Kitsu (free, no API key)
 * Uses origin_name to search; returns poster URLs or null
 */
export async function fetchKitsuPoster(originName) {
  if (!originName) return null;
  try {
    const resp = await fetch(`https://kitsu.app/api/edge/anime?filter[text]=${encodeURIComponent(originName)}&page[limit]=1`);
    if (!resp.ok) return null;
    const json = await resp.json();
    const anime = json.data?.[0];
    if (!anime) return null;
    const poster = anime.attributes?.posterImage;
    const cover = anime.attributes?.coverImage;
    return {
      poster: poster?.large || poster?.medium || poster?.original || null,
      cover: cover?.large || cover?.original || null,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch by country from all sources
 */
export async function fetchByCountry(country, page = 1) {
  const [ophimResult, nguoncResult] = await Promise.allSettled([
    fetchAllOphim(`/v1/api/quoc-gia/${country}?page=${page}`),
    fetchNguoncList(`/api/films/quoc-gia/${country}?page=${page}`),
  ]);

  const allItems = [];
  let totalItems = 0;
  let totalPages = 1;

  if (ophimResult.status === 'fulfilled') {
    allItems.push(...ophimResult.value.items);
    totalItems += ophimResult.value.totalItems;
    totalPages = Math.max(totalPages, ophimResult.value.totalPages);
  }
  if (nguoncResult.status === 'fulfilled') {
    allItems.push(...nguoncResult.value.items);
    totalItems += nguoncResult.value.totalItems;
    totalPages = Math.max(totalPages, nguoncResult.value.totalPages);
  }

  return {
    items: deduplicateBySlug(allItems),
    params: {
      pagination: { totalItems, totalPages, currentPage: page },
    },
  };
}

/**
 * Fetch by category from all sources
 */
export async function fetchByCategory(category, page = 1) {
  const [ophimResult, nguoncResult] = await Promise.allSettled([
    fetchAllOphim(`/v1/api/the-loai/${category}?page=${page}`),
    fetchNguoncList(`/api/films/the-loai/${category}?page=${page}`),
  ]);

  const allItems = [];
  let totalItems = 0;
  let totalPages = 1;

  if (ophimResult.status === 'fulfilled') {
    allItems.push(...ophimResult.value.items);
    totalItems += ophimResult.value.totalItems;
    totalPages = Math.max(totalPages, ophimResult.value.totalPages);
  }
  if (nguoncResult.status === 'fulfilled') {
    allItems.push(...nguoncResult.value.items);
    totalItems += nguoncResult.value.totalItems;
    totalPages = Math.max(totalPages, nguoncResult.value.totalPages);
  }

  return {
    items: deduplicateBySlug(allItems),
    params: {
      pagination: { totalItems, totalPages, currentPage: page },
    },
  };
}

/**
 * Fetch anime list by type slug from all sources
 */
export async function fetchAnimeByType(type, page = 1) {
  const [ophimResult, nguoncResult] = await Promise.allSettled([
    fetchAllOphim(`/v1/api/danh-sach/${type}?page=${page}`),
    fetchNguoncList(`/api/films/danh-sach/${type}?page=${page}`, type === 'hoat-hinh' ? 'hoathinh' : ''),
  ]);

  const allItems = [];
  if (ophimResult.status === 'fulfilled') {
    allItems.push(...ophimResult.value.items);
  }
  if (nguoncResult.status === 'fulfilled') {
    allItems.push(...nguoncResult.value.items);
  }

  return {
    items: deduplicateBySlug(allItems),
  };
}

/**
 * Fetch new updates from all sources
 */
export async function fetchNewUpdates(page = 1) {
  const [ophimResult, nguoncResult] = await Promise.allSettled([
    (async () => {
      const results = await Promise.allSettled(
        SOURCES_OPHIM.map(async (source) => {
          const data = await fetchFromOphim(source, `/danh-sach/phim-moi-cap-nhat?page=${page}`);
          return tagItems(data?.items || [], source);
        })
      );
      return results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
    })(),
    fetchNguoncList(`/api/films/phim-moi-cap-nhat?page=${page}`),
  ]);

  const allItems = [];
  if (ophimResult.status === 'fulfilled') {
    allItems.push(...ophimResult.value);
  }
  if (nguoncResult.status === 'fulfilled') {
    allItems.push(...nguoncResult.value.items);
  }

  // Filter to Japanese anime only
  const japanItems = allItems.filter(item => 
    item.type === 'hoathinh' && 
    item.country?.some(c => c.slug === 'nhat-ban')
  );
  return { items: deduplicateBySlug(japanItems.length > 0 ? japanItems : allItems) };
}


/**
 * Get ad-free M3U8 URL via proxy
 */
export function getCleanM3u8Url(m3u8Url) {
  if (!m3u8Url) return '';
  return `${M3U8_PROXY_BASE}/clean?url=${encodeURIComponent(m3u8Url)}`;
}

/**
 * Get proxied encryption key URL (CORS bypass)
 */
export function getProxiedKeyUrl(keyUrl) {
  if (!keyUrl) return '';
  return `${M3U8_PROXY_BASE}/key?url=${encodeURIComponent(keyUrl)}`;
}
