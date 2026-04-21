import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchAnimeList, fetchByCategory, fetchByCountry } from "@/lib/api.js";
import { filterAnimeOnly } from "@/lib/anime-filter.js";
import { useSEO } from "@/hooks/use-seo.js";
import { AnimeCard, SkeletonCard } from "@/components/anime/AnimeCard.jsx";
import { Pagination } from "@/components/ui/Pagination.jsx";

const CATEGORY_TITLES = {
  anime: "Tất cả Anime",
  "hanh-dong": "Hành Động",
  "tinh-cam": "Tình Cảm",
  "vien-tuong": "Viễn Tưởng",
  "phieu-luu": "Phiêu Lưu",
  "hai-huoc": "Hài Hước",
  "bi-an": "Bí Ẩn",
  "khoa-hoc": "Khoa Học",
  "chinh-kich": "Chính Kịch",
  "tam-ly": "Tâm Lý",
  "nhat-ban": "Anime Nhật Bản",
};

const COUNTRY_SLUGS = ["nhat-ban"];

const FILTER_CHIPS = [
  { slug: "anime", label: "Tất cả" },
  { slug: "hanh-dong", label: "Hành Động" },
  { slug: "tinh-cam", label: "Tình Cảm" },
  { slug: "vien-tuong", label: "Viễn Tưởng" },
  { slug: "phieu-luu", label: "Phiêu Lưu" },
  { slug: "hai-huoc", label: "Hài Hước" },
  { slug: "bi-an", label: "Bí Ẩn" },
  { slug: "tam-ly", label: "Tâm Lý" },
];

export default function AnimePage() {
  const { category } = useParams();
  const slug = category || "anime";
  const title = CATEGORY_TITLES[slug] || slug;
  const isCountry = COUNTRY_SLUGS.includes(slug);

  useSEO({
    title: `${title} - Anime Vietsub Miễn Phí`,
    url: slug === "anime" ? "/anime" : `/category/${slug}`,
  });

  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setItems(null);
    setPage(1);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    const fetchFn =
      slug === "anime"
        ? fetchAnimeList
        : isCountry
          ? (p) => fetchByCountry(slug, p)
          : (p) => fetchByCategory(slug, p);

    fetchFn(page).then((data) => {
      if (cancelled) return;
      const filtered = filterAnimeOnly(data.items || []);
      setItems(filtered);
      setTotalPages(data.params?.pagination?.totalPages || 1);
    });

    return () => {
      cancelled = true;
    };
  }, [slug, page, isCountry]);

  return (
    <div className="browse-page">
      <div className="category-header">
        <h1 className="category-title">{title}</h1>
        <div className="category-filters">
          {FILTER_CHIPS.map((chip) => (
            <Link
              key={chip.slug}
              to={chip.slug === "anime" ? "/anime" : `/category/${chip.slug}`}
              className={`filter-chip ${slug === chip.slug ? "active" : ""}`}
            >
              {chip.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="anime-grid">
        {items === null
          ? Array.from({ length: 18 }, (_, i) => <SkeletonCard key={i} />)
          : items.length === 0
            ? (
                <div className="empty-state" style={{ gridColumn: "1/-1" }}>
                  <div className="empty-state-text">
                    Không tìm thấy anime trong danh mục này
                  </div>
                </div>
              )
            : items.map((item, i) => (
                <AnimeCard key={item.slug} item={item} index={i} />
              ))}
      </div>

      {totalPages > 1 && (
        <Pagination
          current={page}
          total={totalPages}
          onChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}
