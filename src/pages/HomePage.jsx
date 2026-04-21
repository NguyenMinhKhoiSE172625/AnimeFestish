import { useState, useEffect } from "react";
import {
  fetchJapaneseAnime,
  fetchByCategory,
  fetchTopAnimeMovies,
  fetchTopAnimeSeries,
} from "@/lib/api.js";
import { filterAnimeOnly } from "@/lib/anime-filter.js";
import { getContinueWatching } from "@/lib/watch-history.js";
import { useSEO } from "@/hooks/use-seo.js";
import { Hero, HeroSkeleton } from "@/features/home/components/Hero.jsx";
import { ContinueWatching } from "@/features/home/components/ContinueWatching.jsx";
import { AnimeRow, SkeletonRow } from "@/components/anime/AnimeRow.jsx";
import { Top10Row } from "@/components/anime/Top10Row.jsx";

export default function HomePage() {
  useSEO({
    title: "Trang Chủ - Xem Anime Vietsub HD Miễn Phí",
    url: "/",
  });

  const [heroItems, setHeroItems] = useState(null);
  const [newest, setNewest] = useState(null);
  const [categories, setCategories] = useState(null);
  const [topMovies, setTopMovies] = useState(null);
  const [topSeries, setTopSeries] = useState(null);

  const continueItems = getContinueWatching(10);

  useEffect(() => {
    let cancelled = false;

    fetchJapaneseAnime(1).then((result) => {
      if (cancelled) return;
      const all = filterAnimeOnly(result.items || []).filter((i) =>
        i.country?.some((c) => c.slug === "nhat-ban")
      );
      setHeroItems(all.slice(0, 5));
      setNewest(all.slice(0, 24));
    });

    Promise.allSettled([
      fetchByCategory("hanh-dong", 1),
      fetchByCategory("tinh-cam", 1),
      fetchByCategory("vien-tuong", 1),
      fetchByCategory("bi-an", 1),
    ]).then((results) => {
      if (cancelled) return;
      const filterJP = (r) => {
        if (r.status !== "fulfilled") return [];
        return filterAnimeOnly(r.value.items || [])
          .filter((i) => i.country?.some((c) => c.slug === "nhat-ban"))
          .slice(0, 20);
      };
      setCategories([
        {
          title: "Hành Động",
          items: filterJP(results[0]),
          link: "/category/hanh-dong",
        },
        {
          title: "Tình Cảm",
          items: filterJP(results[1]),
          link: "/category/tinh-cam",
        },
        {
          title: "Viễn Tưởng",
          items: filterJP(results[2]),
          link: "/category/vien-tuong",
        },
        {
          title: "Bí Ẩn",
          items: filterJP(results[3]),
          link: "/category/bi-an",
        },
      ]);
    });

    Promise.allSettled([
      fetchTopAnimeMovies(10),
      fetchTopAnimeSeries(10),
    ]).then(([moviesR, seriesR]) => {
      if (cancelled) return;
      if (moviesR.status === "fulfilled") setTopMovies(moviesR.value);
      if (seriesR.status === "fulfilled") setTopSeries(seriesR.value);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {heroItems ? <Hero items={heroItems} /> : <HeroSkeleton />}

      {continueItems.length > 0 && (
        <ContinueWatching items={continueItems} />
      )}

      {newest ? (
        newest.length > 0 && (
          <AnimeRow title="Mới cập nhật" items={newest} moreLink="/anime" />
        )
      ) : (
        <SkeletonRow title="Mới cập nhật" />
      )}

      {topMovies && topMovies.length > 0 && (
        <Top10Row title="Top Anime Movie" items={topMovies} />
      )}
      {topSeries && topSeries.length > 0 && (
        <Top10Row title="Top Anime Bộ" items={topSeries} />
      )}

      {categories
        ? categories.map(
            (cat) =>
              cat.items.length > 0 && (
                <AnimeRow
                  key={cat.title}
                  title={cat.title}
                  items={cat.items}
                  moreLink={cat.link}
                />
              )
          )
        : [
            <SkeletonRow key="sk1" title="Hành Động" />,
            <SkeletonRow key="sk2" title="Tình Cảm" />,
          ]}
    </>
  );
}
