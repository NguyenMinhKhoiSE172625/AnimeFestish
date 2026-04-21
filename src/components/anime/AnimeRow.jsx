import { useRef } from "react";
import { Link } from "react-router-dom";
import { AnimeCard, SkeletonCard } from "./AnimeCard.jsx";

export function AnimeRow({ title, items, moreLink }) {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    const dist = Math.min(600, window.innerWidth * 0.8);
    scrollRef.current?.scrollBy({ left: dir * dist, behavior: "smooth" });
  };

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        {moreLink && (
          <Link to={moreLink} className="section-more">
            Xem thêm &rarr;
          </Link>
        )}
      </div>
      <div className="anime-row">
        <button
          className="anime-row-arrow left"
          onClick={() => scroll(-1)}
          aria-label="Scroll left"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="anime-row-scroll" ref={scrollRef}>
          {items.map((item, i) => (
            <AnimeCard key={item.slug} item={item} index={i} />
          ))}
        </div>
        <button
          className="anime-row-arrow right"
          onClick={() => scroll(1)}
          aria-label="Scroll right"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </section>
  );
}

export function SkeletonRow({ title }) {
  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
      </div>
      <div className="anime-row">
        <div className="anime-row-scroll">
          {Array.from({ length: 8 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
