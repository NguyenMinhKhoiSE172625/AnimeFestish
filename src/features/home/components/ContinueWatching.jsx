import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getImageUrl } from "@/lib/api.js";
import { removeFromHistory, formatTime } from "@/lib/watch-history.js";
import { motion, AnimatePresence } from "framer-motion";

export function ContinueWatching({ items: initialItems }) {
  const [items, setItems] = useState(initialItems);
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  const scroll = (dir) => {
    const dist = Math.min(600, window.innerWidth * 0.8);
    scrollRef.current?.scrollBy({ left: dir * dist, behavior: "smooth" });
  };

  const handleRemove = (slug) => {
    removeFromHistory(slug);
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">Tiếp tục xem</h2>
      </div>
      <div className="anime-row">
        <button
          className="anime-row-arrow left"
          onClick={() => scroll(-1)}
          aria-label="Scroll left"
        >
          &#8249;
        </button>
        <div className="anime-row-scroll continue-scroll" ref={scrollRef}>
          <AnimatePresence>
            {items.map((item, i) => {
              const thumbUrl = item.thumbUrl
                ? getImageUrl(item.thumbUrl)
                : "";
              const progressPct = item.progress || 0;
              const timeInfo =
                item.currentTime > 0
                  ? `${formatTime(item.currentTime)} / ${formatTime(item.duration)}`
                  : "";

              return (
                <motion.div
                  key={item.slug}
                  className="anime-card continue-card"
                  layout
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  onClick={() =>
                    navigate(`/watch/${item.slug}/${item.episodeSlug}`)
                  }
                  style={{ "--index": i }}
                >
                  <div className="anime-card-poster">
                    <img src={thumbUrl} alt={item.animeName} loading="lazy" />
                    <div className="anime-card-overlay">
                      <div className="anime-card-play">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="white"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    <span className="badge-ep">{item.episodeName}</span>
                    <div className="continue-progress">
                      <div
                        className="continue-progress-bar"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <button
                      className="continue-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(item.slug);
                      }}
                      title="Xoa"
                    >
                      &#10005;
                    </button>
                  </div>
                  <div className="anime-card-info">
                    <div className="anime-card-title" title={item.animeName}>
                      {item.animeName}
                    </div>
                    <div className="anime-card-sub">
                      {timeInfo || item.episodeName}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <button
          className="anime-row-arrow right"
          onClick={() => scroll(1)}
          aria-label="Scroll right"
        >
          &#8250;
        </button>
      </div>
    </section>
  );
}
