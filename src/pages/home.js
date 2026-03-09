// === Home Page — Japanese Anime Focused ===
import { fetchAnimeList, fetchJapaneseAnime, fetchByCategory, fetchTopAnimeMovies, fetchTopAnimeSeries } from '../js/api.js';
import { filterAnimeOnly, filterJapaneseAnime } from '../js/animeFilter.js';
import { getContinueWatching } from '../js/watchHistory.js';
import { renderHero, stopHero } from '../components/hero.js';
import { renderAnimeRow, renderSkeletonRow } from '../components/animeRow.js';
import { renderContinueWatching } from '../components/continueWatching.js';
import { renderTop10Row } from '../components/top10Row.js';

export async function renderHomePage() {
  const main = document.getElementById('main-content');
  main.innerHTML = '';

  // Hero container
  const heroContainer = document.createElement('div');
  main.appendChild(heroContainer);

  // Continue watching container
  const continueContainer = document.createElement('div');
  main.appendChild(continueContainer);

  // Content container
  const content = document.createElement('div');
  main.appendChild(content);

  // Show skeletons
  renderSkeletonRow(content, 'Anime Mới Nhất');
  renderSkeletonRow(content, 'Hành Động');

  try {
    // Fetch Japanese anime (main focus)
    const [japanData, japanPage2, japanPage3] = await Promise.all([
      fetchJapaneseAnime(1),
      fetchJapaneseAnime(2),
      fetchJapaneseAnime(3),
    ]);

    const allJapanAnime = filterAnimeOnly([
      ...(japanData.items || []),
      ...(japanPage2.items || []),
      ...(japanPage3.items || []),
    ]).filter(i => i.country?.some(c => c.slug === 'nhat-ban'));

    // Hero: Japanese anime only
    renderHero(heroContainer, allJapanAnime.slice(0, 5));

    // Continue Watching
    const continueItems = getContinueWatching(10);
    if (continueItems.length > 0) {
      renderContinueWatching(continueContainer, continueItems);
    }

    // Clear skeletons and render actual rows
    content.innerHTML = '';

    // 1. Newest Japanese Anime
    const newest = allJapanAnime.slice(0, 24);
    if (newest.length > 0) {
      renderAnimeRow(content, 'Mới Cập Nhật 🔥', newest, '#/anime');
    }

    // 2. Top 10 Anime (fetch in background, don't block)
    const top10Container = document.createElement('div');
    content.appendChild(top10Container);
    Promise.allSettled([fetchTopAnimeMovies(10), fetchTopAnimeSeries(10)]).then(([moviesResult, seriesResult]) => {
      if (moviesResult.status === 'fulfilled' && moviesResult.value.length > 0) {
        renderTop10Row(top10Container, 'Top Anime Movie 🎬', moviesResult.value);
      }
      if (seriesResult.status === 'fulfilled' && seriesResult.value.length > 0) {
        renderTop10Row(top10Container, 'Top Anime Bộ 📺', seriesResult.value);
      }
    });

    // 2. Fetch genre-specific Japanese anime
    try {
      const [actionData, romanceData, fantasyData, mysteryData] = await Promise.all([
        fetchByCategory('hanh-dong', 1),
        fetchByCategory('tinh-cam', 1),
        fetchByCategory('vien-tuong', 1),
        fetchByCategory('bi-an', 1),
      ]);

      const filterJP = (items) => {
        const anime = filterAnimeOnly(items || []);
        const jp = anime.filter(i => i.country?.some(c => c.slug === 'nhat-ban'));
        return jp.slice(0, 20);
      };

      const actionItems = filterJP(actionData.items);
      const romanceItems = filterJP(romanceData.items);
      const fantasyItems = filterJP(fantasyData.items);
      const mysteryItems = filterJP(mysteryData.items);

      if (actionItems.length > 0) {
        renderAnimeRow(content, 'Hành Động ⚔️', actionItems, '#/category/hanh-dong');
      }
      if (romanceItems.length > 0) {
        renderAnimeRow(content, 'Tình Cảm 💕', romanceItems, '#/category/tinh-cam');
      }
      if (fantasyItems.length > 0) {
        renderAnimeRow(content, 'Viễn Tưởng 🌌', fantasyItems, '#/category/vien-tuong');
      }
      if (mysteryItems.length > 0) {
        renderAnimeRow(content, 'Bí Ẩn 🔮', mysteryItems, '#/category/bi-an');
      }
    } catch (e) {
      console.warn('Failed to load genre rows:', e);
    }

  } catch (err) {
    console.error('Home page error:', err);
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Không thể tải dữ liệu. Vui lòng thử lại sau.</div>
      </div>
    `;
  }

  return () => {
    stopHero();
  };
}
