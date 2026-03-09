// === Home Page — Japanese Anime Focused ===
import { fetchJapaneseAnime, fetchByCategory, fetchTopAnimeMovies, fetchTopAnimeSeries } from '../js/api.js';
import { filterAnimeOnly } from '../js/animeFilter.js';
import { getContinueWatching } from '../js/watchHistory.js';
import { renderHero, stopHero } from '../components/hero.js';
import { renderAnimeRow, renderSkeletonRow } from '../components/animeRow.js';
import { renderContinueWatching } from '../components/continueWatching.js';
import { renderTop10Row } from '../components/top10Row.js';

export async function renderHomePage() {
  const main = document.getElementById('main-content');
  main.innerHTML = '';

  // Containers
  const heroContainer = document.createElement('div');
  const continueContainer = document.createElement('div');
  const content = document.createElement('div');
  main.appendChild(heroContainer);
  main.appendChild(continueContainer);
  main.appendChild(content);

  // Skeleton placeholders
  renderSkeletonRow(content, 'Anime Mới Nhất');
  renderSkeletonRow(content, 'Hành Động');

  // Continue Watching (local, instant)
  const continueItems = getContinueWatching(10);
  if (continueItems.length > 0) {
    renderContinueWatching(continueContainer, continueItems);
  }

  // Fetch EVERYTHING in parallel — 1 page is enough for hero + newest row
  const [mainResult, actionResult, romanceResult, fantasyResult, mysteryResult] = await Promise.allSettled([
    fetchJapaneseAnime(1),
    fetchByCategory('hanh-dong', 1),
    fetchByCategory('tinh-cam', 1),
    fetchByCategory('vien-tuong', 1),
    fetchByCategory('bi-an', 1),
  ]);

  // — Render hero + newest immediately —
  const allJapanAnime = mainResult.status === 'fulfilled'
    ? filterAnimeOnly(mainResult.value.items || []).filter(i => i.country?.some(c => c.slug === 'nhat-ban'))
    : [];

  renderHero(heroContainer, allJapanAnime.slice(0, 5));
  content.innerHTML = '';

  const newest = allJapanAnime.slice(0, 24);
  if (newest.length > 0) {
    renderAnimeRow(content, 'Mới Cập Nhật 🔥', newest, '#/anime');
  }

  // — Top 10 (background, doesn’t block) —
  const top10Container = document.createElement('div');
  content.appendChild(top10Container);
  Promise.allSettled([fetchTopAnimeMovies(10), fetchTopAnimeSeries(10)]).then(([moviesR, seriesR]) => {
    if (moviesR.status === 'fulfilled' && moviesR.value.length > 0) {
      renderTop10Row(top10Container, 'Top Anime Movie 🎬', moviesR.value);
    }
    if (seriesR.status === 'fulfilled' && seriesR.value.length > 0) {
      renderTop10Row(top10Container, 'Top Anime Bộ 📺', seriesR.value);
    }
  });

  // — Genre rows (already fetched, render immediately) —
  const filterJP = (result) => {
    if (result.status !== 'fulfilled') return [];
    const anime = filterAnimeOnly(result.value.items || []);
    return anime.filter(i => i.country?.some(c => c.slug === 'nhat-ban')).slice(0, 20);
  };

  const rows = [
    { title: 'Hành Động ⚔️', items: filterJP(actionResult), link: '#/category/hanh-dong' },
    { title: 'Tình Cảm 💕', items: filterJP(romanceResult), link: '#/category/tinh-cam' },
    { title: 'Viễn Tưởng 🌌', items: filterJP(fantasyResult), link: '#/category/vien-tuong' },
    { title: 'Bí Ẩn 🔮', items: filterJP(mysteryResult), link: '#/category/bi-an' },
  ];

  for (const row of rows) {
    if (row.items.length > 0) {
      renderAnimeRow(content, row.title, row.items, row.link);
    }
  }

  return () => stopHero();
}
