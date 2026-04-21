import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { searchAnime } from "@/lib/api.js";
import { filterAnimeOnly } from "@/lib/anime-filter.js";
import { useSEO } from "@/hooks/use-seo.js";
import { AnimeCard, SkeletonCard } from "@/components/anime/AnimeCard.jsx";
import { Pagination } from "@/components/ui/Pagination.jsx";

export default function SearchPage() {
  const { keyword } = useParams();
  const navigate = useNavigate();
  const decodedKeyword = keyword ? decodeURIComponent(keyword) : "";
  const [query, setQuery] = useState(decodedKeyword);
  const [items, setItems] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useSEO({
    title: decodedKeyword
      ? `Tim kiem: ${decodedKeyword}`
      : "Tim kiem Anime",
    url: `/search/${keyword || ""}`,
  });

  const doSearch = useCallback(
    async (q, p = 1) => {
      if (!q.trim()) {
        setItems(null);
        return;
      }
      setLoading(true);
      try {
        const data = await searchAnime(q, p);
        const filtered = filterAnimeOnly(data.items || []);
        setItems(filtered);
        setTotalItems(data.params?.pagination?.totalItems || filtered.length);
        setTotalPages(
          data.params?.pagination?.totalPages ||
            Math.ceil(
              (data.params?.pagination?.totalItems || filtered.length) / 24
            ) ||
            1
        );
        setPage(p);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (decodedKeyword) {
      doSearch(decodedKeyword);
    }
  }, [decodedKeyword, doSearch]);

  const handleInput = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = val.trim();
      if (q) {
        window.history.replaceState(null, "", `/search/${encodeURIComponent(q)}`);
        doSearch(q);
      } else {
        setItems(null);
      }
    }, 500);
  };

  return (
    <div className="search-page">
      <div className="search-bar-lg">
        <span className="search-icon">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Tim anime Nhat Ban ban muon xem..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          autoFocus
        />
      </div>

      {items !== null && items.length > 0 && (
        <div className="search-results-info">
          Tim thay {totalItems} ket qua cho &ldquo;{query}&rdquo;
        </div>
      )}

      <div className="anime-grid">
        {loading
          ? Array.from({ length: 12 }, (_, i) => <SkeletonCard key={i} />)
          : items === null
            ? (
                <div className="empty-state" style={{ gridColumn: "1/-1" }}>
                  <div className="empty-state-text">
                    Nhap ten anime de tim kiem...
                  </div>
                </div>
              )
            : items.length === 0
              ? (
                  <div className="empty-state" style={{ gridColumn: "1/-1" }}>
                    <div className="empty-state-text">
                      Khong tim thay ket qua cho &ldquo;{query}&rdquo;
                    </div>
                  </div>
                )
              : items.map((item, i) => (
                  <AnimeCard key={item.slug} item={item} index={i} />
                ))}
      </div>

      {totalPages > 1 && items && items.length > 0 && (
        <Pagination
          current={page}
          total={totalPages}
          onChange={(p) => {
            doSearch(query, p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}
