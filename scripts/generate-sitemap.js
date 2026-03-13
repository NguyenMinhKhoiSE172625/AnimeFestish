// Generate sitemap.xml from KKPhim API
// Run: node scripts/generate-sitemap.js

const SITE_URL = 'https://animefetish.id.vn';
const API_BASE = 'https://phimapi.com/v1/api/danh-sach/hoat-hinh';
const LIMIT = 64;
const CONCURRENT = 5;
const OUTPUT = 'public/sitemap.xml';

async function fetchPage(page) {
  const url = `${API_BASE}?page=${page}&limit=${LIMIT}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.data?.items || [];
    } catch (err) {
      if (attempt === 2) {
        console.error(`  ✗ Page ${page} failed: ${err.message}`);
        return [];
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

async function fetchAllAnime() {
  // Get total pages
  const res = await fetch(`${API_BASE}?page=1&limit=${LIMIT}`);
  const data = await res.json();
  const totalPages = data.data?.params?.pagination?.totalPages || 1;
  const firstItems = data.data?.items || [];

  console.log(`Total: ${data.data?.params?.pagination?.totalItems} anime, ${totalPages} pages`);

  const allItems = [...firstItems];

  // Fetch remaining pages in batches
  for (let i = 2; i <= totalPages; i += CONCURRENT) {
    const batch = [];
    for (let j = i; j < i + CONCURRENT && j <= totalPages; j++) {
      batch.push(fetchPage(j));
    }
    const results = await Promise.all(batch);
    results.forEach(items => allItems.push(...items));
    process.stdout.write(`  Fetched ${Math.min(i + CONCURRENT - 1, totalPages)}/${totalPages} pages\r`);
  }

  console.log(`\nCollected ${allItems.length} anime slugs`);
  return allItems;
}

function buildSitemap(animeList) {
  const today = new Date().toISOString().split('T')[0];

  // Static pages
  const staticPages = [
    { loc: '/', changefreq: 'daily', priority: '1.0' },
    { loc: '/anime', changefreq: 'daily', priority: '0.9' },
    { loc: '/search', changefreq: 'weekly', priority: '0.8' },
  ];

  // Category pages
  const categories = [
    'hanh-dong', 'tinh-cam', 'vien-tuong', 'phieu-luu',
    'hai-huoc', 'bi-an', 'kinh-di', 'tam-ly',
    'chinh-kich', 'khoa-hoc', 'the-thao', 'am-nhac',
  ];
  categories.forEach(cat => {
    staticPages.push({ loc: `/category/${cat}`, changefreq: 'daily', priority: '0.7' });
  });

  // Anime detail pages
  const seen = new Set();
  const animePages = [];
  for (const item of animeList) {
    if (!item.slug || seen.has(item.slug)) continue;
    seen.add(item.slug);
    const lastmod = item.modified?.time
      ? new Date(item.modified.time).toISOString().split('T')[0]
      : today;
    animePages.push({ loc: `/anime/${item.slug}`, changefreq: 'weekly', priority: '0.6', lastmod });
  }

  const urls = [
    ...staticPages.map(p => `  <url>
    <loc>${SITE_URL}${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`),
    ...animePages.map(p => `  <url>
    <loc>${SITE_URL}${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

async function main() {
  console.log('Generating sitemap...');
  const animeList = await fetchAllAnime();
  const xml = buildSitemap(animeList);

  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.resolve(import.meta.dirname, '..', OUTPUT);
  fs.writeFileSync(outPath, xml, 'utf-8');

  const lineCount = xml.split('\n').length;
  const urlCount = (xml.match(/<url>/g) || []).length;
  console.log(`✓ Sitemap written to ${OUTPUT} (${urlCount} URLs, ${lineCount} lines)`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
