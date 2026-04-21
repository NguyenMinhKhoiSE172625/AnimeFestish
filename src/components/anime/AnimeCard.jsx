import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { resolveItemImage } from "@/lib/api.js";

const FALLBACK_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300'%3E%3Crect fill='%231a1a2e' width='200' height='300'/%3E%3Ctext fill='%236b6b7b' x='100' y='150' font-size='14' text-anchor='middle'%3ENo Image%3C/text%3E%3C/svg%3E";

export function AnimeCard({ item, index = 0 }) {
  const navigate = useNavigate();
  const posterUrl = resolveItemImage(item);

  return (
    <motion.div
      className="anime-card"
      data-slug={item.slug}
      onClick={() => navigate(`/anime/${item.slug}`)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.32, 0.72, 0, 1],
      }}
      whileHover={{ y: -6 }}
    >
      <div className="anime-card-poster">
        <img
          src={posterUrl}
          alt={item.name}
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = FALLBACK_SVG;
          }}
        />
        <div className="anime-card-badges">
          {item.quality && (
            <span className="anime-card-badge badge-quality">
              {item.quality}
            </span>
          )}
          {item.lang && (
            <span className="anime-card-badge badge-lang">
              {item.lang === "Vietsub" ? "VS" : item.lang}
            </span>
          )}
        </div>
        {item.episode_current && (
          <span className="badge-ep">{item.episode_current}</span>
        )}
        <div className="anime-card-overlay">
          <div className="anime-card-play">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="anime-card-info">
        <div className="anime-card-title" title={item.name}>
          {item.name}
        </div>
        <div className="anime-card-sub">
          {item.origin_name || item.year || ""}
        </div>
      </div>
    </motion.div>
  );
}

export function SkeletonCard() {
  return (
    <div className="anime-card">
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-text" style={{ width: "80%" }} />
      <div className="skeleton skeleton-text short" />
    </div>
  );
}
