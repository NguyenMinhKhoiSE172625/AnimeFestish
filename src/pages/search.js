// === Search Page ===
import { searchAnime } from '../js/api.js';
import { filterAnimeOnly } from '../js/animeFilter.js';
import { createAnimeCard, createSkeletonCard } from '../components/animeCard.js';
import { updateSEO } from '../js/seo.js';

let searchTimeout = null;

export async function renderSearchPage({ keyword }) {
  const main = document.getElementById('main-content');
  const decodedKeyword = keyword ? decodeURIComponent(keyword) : '';
  updateSEO({ title: decodedKeyword ? `Tìm kiếm: ${decodedKeyword}` : 'Tìm kiếm Anime', description: decodedKeyword ? `Kết quả tìm kiếm anime "${decodedKeyword}" vietsub miễn phí trên AnimeFetish.` : 'Tìm kiếm anime Nhật Bản vietsub miễn phí trên AnimeFetish.', url: `/search/${keyword || ''}` });

  main.innerHTML = `
    <div class="search-page">
      <div class="search-bar-lg">
        <span class="search-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
        <input type="text" id="search-input-lg" placeholder="Tìm anime Nhật Bản bạn muốn xem..." value="${decodedKeyword}" autofocus />
      </div>
      <div id="search-results-info" class="search-results-info"></div>
      <div id="search-results" class="anime-grid"></div>
      <div id="search-pagination" class="pagination"></div>
    </div>
  `;

  const input = document.getElementById('search-input-lg');
  const resultsContainer = document.getElementById('search-results');
  const resultsInfo = document.getElementById('search-results-info');
  const paginationContainer = document.getElementById('search-pagination');

  // Search function
  async function doSearch(query, page = 1) {
    if (!query.trim()) {
      resultsContainer.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>
          <div class="empty-state-text">Nhập tên anime để tìm kiếm...</div>
        </div>
      `;
      resultsInfo.textContent = '';
      paginationContainer.innerHTML = '';
      return;
    }

    // Show loading skeletons
    resultsContainer.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      resultsContainer.appendChild(createSkeletonCard());
    }
    resultsInfo.textContent = 'Đang tìm kiếm...';

    try {
      const data = await searchAnime(query, page);
      const rawItems = data.items || [];
      const items = filterAnimeOnly(rawItems);
      const pagination = data.params?.pagination || {};

      resultsContainer.innerHTML = '';

      if (items.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1">
            <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>
            <div class="empty-state-text">Không tìm thấy kết quả cho "${query}"</div>
          </div>
        `;
        resultsInfo.textContent = '';
        paginationContainer.innerHTML = '';
        return;
      }

      resultsInfo.textContent = `Tìm thấy ${pagination.totalItems || items.length} kết quả cho "${query}"`;

      items.forEach((item, i) => {
        const card = createAnimeCard(item);
        card.style.setProperty('--index', i);
        resultsContainer.appendChild(card);
      });

      // Pagination
      const totalPages = pagination.totalPages || Math.ceil((pagination.totalItems || items.length) / 24);
      const currentPage = pagination.currentPage || page;

      if (totalPages > 1) {
        renderPagination(paginationContainer, currentPage, totalPages, (p) => {
          doSearch(query, p);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      } else {
        paginationContainer.innerHTML = '';
      }

    } catch (err) {
      console.error('Search error:', err);
      resultsContainer.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div class="empty-state-text">Lỗi tìm kiếm: ${err.message}</div>
        </div>
      `;
    }
  }

  // Debounced input
  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const q = input.value.trim();
      if (q) {
        window.history.replaceState(null, '', `/search/${encodeURIComponent(q)}`);
      }
      doSearch(q);
    }, 500);
  });

  // Initial search
  if (decodedKeyword) {
    doSearch(decodedKeyword);
  } else {
    resultsContainer.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>
        <div class="empty-state-text">Nhập tên anime để tìm kiếm...</div>
      </div>
    `;
  }

  return () => {
    clearTimeout(searchTimeout);
  };
}

function renderPagination(container, current, total, onChange) {
  container.innerHTML = '';

  const maxVisible = 5;
  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end = Math.min(total, start + maxVisible - 1);
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  // Prev button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.textContent = '‹';
  prevBtn.disabled = current === 1;
  prevBtn.addEventListener('click', () => onChange(current - 1));
  container.appendChild(prevBtn);

  for (let i = start; i <= end; i++) {
    const btn = document.createElement('button');
    btn.className = `page-btn ${i === current ? 'active' : ''}`;
    btn.textContent = i;
    btn.addEventListener('click', () => onChange(i));
    container.appendChild(btn);
  }

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.textContent = '›';
  nextBtn.disabled = current === total;
  nextBtn.addEventListener('click', () => onChange(current + 1));
  container.appendChild(nextBtn);
}
