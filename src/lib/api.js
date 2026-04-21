const M3U8_PROXY_BASE = "https://openapiphim.pathhubphim.workers.dev";
const WEBP_PROXY = "https://phimapi.com/image.php";

const SOURCES_OPHIM = [
  {
    name: "PhimAPI",
    base: "https://phimapi.com",
    imgCdn: "https://phimimg.com/",
    type: "ophim",
  },
];

const SOURCE_NGUONC = {
  name: "NguonC",
  base: "https://phim.nguonc.com",
  imgCdn: "",
  type: "nguonc",
};

const ALL_SOURCES = [...SOURCES_OPHIM, SOURCE_NGUONC];

const apiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_MAX_SIZE = 200;

function evictCache() {
  if (apiCache.size <= CACHE_MAX_SIZE) return;
  const now = Date.now();
  for (const [key, val] of apiCache) {
    if (now - val.time > CACHE_TTL) apiCache.delete(key);
    if (apiCache.size <= CACHE_MAX_SIZE * 0.7) break;
  }
  if (apiCache.size > CACHE_MAX_SIZE) {
    const oldest = [...apiCache.entries()].sort((a, b) => a[1].time - b[1].time);
    for (let i = 0; i < oldest.length - CACHE_MAX_SIZE * 0.7; i++) {
      apiCache.delete(oldest[i][0]);
    }
  }
}

export function toWebpUrl(url) {
  if (!url) return "";
  if (url.includes("phimimg.com")) {
    return `${WEBP_PROXY}?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function getImageUrl(filename, sourceIdx = 0) {
  if (!filename) return "";
  if (filename.startsWith("http")) return toWebpUrl(filename);
  const cdn = SOURCES_OPHIM[sourceIdx]?.imgCdn || SOURCES_OPHIM[0].imgCdn;
  return toWebpUrl(`${cdn}${filename}`);
}

export function getImageUrlForSource(filename, sourceName) {
  if (!filename) return "";
  if (filename.startsWith("http")) return toWebpUrl(filename);
  const source =
    ALL_SOURCES.find((s) => s.name === sourceName) || SOURCES_OPHIM[0];
  return source.imgCdn ? toWebpUrl(`${source.imgCdn}${filename}`) : filename;
}

export function resolveItemImage(item, preferThumb = false) {
  const file = preferThumb
    ? item.thumb_url || item.poster_url
    : item.poster_url || item.thumb_url;
  if (!file) return "";
  if (file.startsWith("http")) return toWebpUrl(file);
  if (item._imgCdn) return toWebpUrl(`${item._imgCdn}${file}`);
  return getImageUrl(file);
}

async function fetchJSON(url) {
  const now = Date.now();
  const cached = apiCache.get(url);
  if (cached && now - cached.time < CACHE_TTL) {
    return cached.data;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  apiCache.set(url, { data, time: now });
  evictCache();
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

function adaptNguoncItem(item, defaultType = "") {
  return {
    name: item.name,
    slug: item.slug,
    origin_name: item.original_name || item.origin_name || "",
    poster_url: item.poster_url || "",
    thumb_url: item.thumb_url || "",
    type: item.type || defaultType,
    year: item.year || new Date().getFullYear(),
    quality: item.quality || "HD",
    lang: item.language || "Vietsub",
    episode_current: item.current_episode || "",
    time: item.time || "",
    category: Array.isArray(item.category) ? item.category : [],
    country: Array.isArray(item.country) ? item.country : [],
    _source: "NguonC",
    _imgCdn: "",
  };
}

function adaptNguoncItems(items, defaultType = "") {
  if (!Array.isArray(items)) return [];
  return items.map((i) => adaptNguoncItem(i, defaultType));
}

function tagItems(items, source) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    _source: source.name,
    _imgCdn: source.imgCdn,
  }));
}

function deduplicateBySlug(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.slug) return false;
    if (seen.has(item.slug)) return false;
    seen.add(item.slug);
    const name = (item.name || "").trim().toLowerCase();
    if (name) {
      if (seen.has("n:" + name)) return false;
      seen.add("n:" + name);
    }
    return true;
  });
}

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

  results.forEach((r) => {
    if (r.status === "fulfilled" && r.value) {
      allItems.push(...r.value.items);
      totalItems += r.value.pagination.totalItems || 0;
      totalPages = Math.max(totalPages, r.value.pagination.totalPages || 1);
    }
  });

  return { items: allItems, totalItems, totalPages };
}

async function fetchNguoncList(path, defaultType = "") {
  const data = await fetchFromNguonc(path);
  if (!data || data.status !== "success")
    return { items: [], totalItems: 0, totalPages: 1 };

  return {
    items: adaptNguoncItems(data.items || [], defaultType),
    totalItems: data.paginate?.total_items || 0,
    totalPages: data.paginate?.total_page || 1,
  };
}

function mergeResults(...results) {
  const allItems = [];
  let totalItems = 0;
  let totalPages = 1;

  results.forEach((r) => {
    if (r.status === "fulfilled" && r.value) {
      allItems.push(...(r.value.items || []));
      totalItems += r.value.totalItems || 0;
      totalPages = Math.max(totalPages, r.value.totalPages || 1);
    }
  });

  return { items: deduplicateBySlug(allItems), totalItems, totalPages };
}

export async function fetchAnimeList(page = 1) {
  const results = await Promise.allSettled([
    fetchAllOphim(
      `/v1/api/danh-sach/hoat-hinh?page=${page}&country=nhat-ban`
    ),
    fetchNguoncList(
      `/api/films/danh-sach/hoat-hinh?page=${page}`,
      "hoathinh"
    ),
  ]);

  const merged = mergeResults(...results);
  return {
    items: merged.items,
    params: {
      pagination: {
        totalItems: merged.totalItems,
        totalPages: merged.totalPages,
        currentPage: page,
      },
    },
  };
}

export async function fetchJapaneseAnime(page = 1) {
  const results = await Promise.allSettled([
    fetchAllOphim(
      `/v1/api/danh-sach/hoat-hinh?page=${page}&country=nhat-ban`
    ),
    fetchNguoncList(
      `/api/films/danh-sach/hoat-hinh?page=${page}`,
      "hoathinh"
    ),
  ]);

  const merged = mergeResults(...results);
  return {
    items: merged.items,
    params: {
      pagination: {
        totalItems: merged.totalItems,
        totalPages: merged.totalPages,
        currentPage: page,
      },
    },
  };
}

export async function searchAnime(keyword, page = 1) {
  const data = await fetchAllOphim(
    `/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`
  );
  return {
    items: data.items || [],
    params: {
      pagination: {
        totalItems: data.totalItems || 0,
        currentPage: page,
        totalPages: data.totalPages || Math.ceil((data.totalItems || 0) / 24) || 1,
      },
    },
  };
}

export async function fetchAnimeDetail(slug) {
  const ophimPromises = SOURCES_OPHIM.map(async (source) => {
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
    throw new Error("no data");
  });

  const nguoncPromise = (async () => {
    const data = await fetchFromNguonc(`/api/film/${slug}`);
    if (data && data.status === "success" && data.movie) {
      const movie = data.movie;
      const cats = [];
      const countries = [];
      if (
        movie.category &&
        typeof movie.category === "object" &&
        !Array.isArray(movie.category)
      ) {
        Object.values(movie.category).forEach((cat) => {
          const groupName = cat.group?.name || "";
          (cat.list || []).forEach((item) => {
            if (groupName === "Thể loại" || groupName === "Định dạng") {
              cats.push({ name: item.name, slug: item.id || "" });
            } else if (groupName === "Quốc gia") {
              countries.push({ name: item.name, slug: item.id || "" });
            }
          });
        });
      }
      return {
        data: {
          item: {
            name: movie.name,
            slug: movie.slug,
            origin_name: movie.original_name || "",
            poster_url: movie.poster_url || "",
            thumb_url: movie.thumb_url || "",
            content: movie.description || "",
            type: "hoathinh",
            year: movie.year || new Date().getFullYear(),
            quality: movie.quality || "HD",
            lang: movie.language || "Vietsub",
            episode_current: movie.current_episode || "",
            episode_total: movie.total_episodes
              ? String(movie.total_episodes)
              : "",
            time: movie.time || "",
            category: Array.isArray(movie.category) ? movie.category : cats,
            country: Array.isArray(movie.country) ? movie.country : countries,
            _source: "NguonC",
            _imgCdn: "",
          },
          episodes: (movie.episodes || []).map((server) => ({
            server_name: server.server_name || "Server",
            server_data: (server.server_data || server.items || []).map(
              (ep) => ({
                name: ep.name,
                slug: ep.slug,
                filename: ep.filename || "",
                link_embed: ep.link_embed || ep.embed || "",
                link_m3u8: ep.link_m3u8 || ep.m3u8 || "",
              })
            ),
          })),
        },
        _source: "NguonC",
        _imgCdn: "",
      };
    }
    throw new Error("no data");
  })();

  try {
    const allResults = await Promise.allSettled([...ophimPromises, nguoncPromise]);
    const fulfilled = allResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);
    if (fulfilled.length === 0) {
      throw new Error("no source");
    }

    const hasEps = (r) => {
      const eps = r.data?.episodes || r.episodes || [];
      return eps.some((s) => (s.server_data || s.items || []).length > 0);
    };
    const getName = (r) =>
      (r.data?.item?.name || r.data?.movie?.name || "").toLowerCase().trim();
    const getOrigin = (r) =>
      (r.data?.item?.origin_name || r.data?.item?.original_name || "").toLowerCase().trim();

    // OPhim results come first, NguonC last
    const ophimResult = fulfilled.find((r) => r._source !== "NguonC");
    const nguoncResult = fulfilled.find((r) => r._source === "NguonC");

    // If OPhim has episodes, use it
    if (ophimResult && hasEps(ophimResult)) return ophimResult;

    // If only NguonC has episodes, verify names match to avoid slug collision
    if (nguoncResult && hasEps(nguoncResult)) {
      if (!ophimResult) return nguoncResult;
      const oName = getName(ophimResult);
      const nName = getName(nguoncResult);
      const oOrigin = getOrigin(ophimResult);
      const nOrigin = getOrigin(nguoncResult);
      // Check both Vietnamese name and origin name match
      const nameMatch = oName === nName || oName.includes(nName) || nName.includes(oName);
      const originMatch = oOrigin && nOrigin && (oOrigin === nOrigin || oOrigin.includes(nOrigin) || nOrigin.includes(oOrigin));
      if (nameMatch && (originMatch || !oOrigin || !nOrigin)) {
        return nguoncResult;
      }
      // Names differ -> slug collision, keep OPhim metadata (correct anime, no eps)
    }

    return ophimResult || fulfilled[0];
  } catch {
    throw new Error("Khong tim thay anime tren bat ky nguon nao");
  }
}

export async function fetchKitsuPoster(originName) {
  if (!originName) return null;
  try {
    const resp = await fetch(
      `https://kitsu.app/api/edge/anime?filter[text]=${encodeURIComponent(originName)}&page[limit]=1`
    );
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

export async function fetchByCategory(category, page = 1) {
  const results = await Promise.allSettled([
    fetchAllOphim(`/v1/api/the-loai/${category}?page=${page}`),
    fetchNguoncList(`/api/films/the-loai/${category}?page=${page}`),
  ]);

  const merged = mergeResults(...results);
  return {
    items: merged.items,
    params: {
      pagination: {
        totalItems: merged.totalItems,
        totalPages: merged.totalPages,
        currentPage: page,
      },
    },
  };
}

export async function fetchByCountry(country, page = 1) {
  const results = await Promise.allSettled([
    fetchAllOphim(`/v1/api/quoc-gia/${country}?page=${page}`),
    fetchNguoncList(`/api/films/quoc-gia/${country}?page=${page}`),
  ]);

  const merged = mergeResults(...results);
  return {
    items: merged.items,
    params: {
      pagination: {
        totalItems: merged.totalItems,
        totalPages: merged.totalPages,
        currentPage: page,
      },
    },
  };
}

export async function fetchTopAnimeMovies(limit = 10) {
  const results = await Promise.allSettled([
    fetchAllOphim(
      `/v1/api/danh-sach/phim-le?page=1&sort_field=modified.time&category=hoat-hinh&country=nhat-ban&limit=${limit}`
    ),
    fetchNguoncList(`/api/films/the-loai/hoat-hinh?page=1`, "hoathinh"),
  ]);

  const allItems = [];
  if (results[0].status === "fulfilled")
    allItems.push(...results[0].value.items);
  if (results[1].status === "fulfilled") {
    const movies = results[1].value.items.filter(
      (i) => i.type === "single" || i.episode_current === "Full"
    );
    allItems.push(...movies);
  }

  return deduplicateBySlug(allItems).slice(0, limit);
}

export async function fetchTopAnimeSeries(limit = 10) {
  const results = await Promise.allSettled([
    fetchAllOphim(
      `/v1/api/danh-sach/hoat-hinh?page=1&sort_field=modified.time&country=nhat-ban&limit=${limit}`
    ),
    fetchNguoncList(`/api/films/danh-sach/hoat-hinh?page=1`, "hoathinh"),
  ]);

  const allItems = [];
  if (results[0].status === "fulfilled")
    allItems.push(...results[0].value.items);
  if (results[1].status === "fulfilled")
    allItems.push(...results[1].value.items);

  return deduplicateBySlug(allItems).slice(0, limit);
}

export function getCleanM3u8Url(m3u8Url) {
  if (!m3u8Url) return "";
  // Play directly from source — no proxy needed (CORS: *)
  return m3u8Url;
}

export function getProxiedKeyUrl(keyUrl) {
  if (!keyUrl) return "";
  return `${M3U8_PROXY_BASE}/key?url=${encodeURIComponent(keyUrl)}`;
}
