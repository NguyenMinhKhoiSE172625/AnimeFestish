import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { resolveItemImage } from "@/lib/api.js";
import { motion } from "framer-motion";

export function Top10Row({ title, items, moreLink }) {
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  const scroll = (dir) => {
    const dist = Math.min(600, window.innerWidth * 0.8);
    scrollRef.current?.scrollBy({ left: dir * dist, behavior: "smooth" });
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
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
        <div className="anime-row-scroll top10-scroll" ref={scrollRef}>
          {items.slice(0, 10).map((item, index) => (
            <motion.div
              key={item.slug}
              className="top10-card"
              onClick={() => navigate(`/anime/${item.slug}`)}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.4,
                delay: index * 0.06,
                ease: [0.32, 0.72, 0, 1],
              }}
              whileHover={{ scale: 1.04 }}
            >
              <div className="top10-rank">{index + 1}</div>
              <div className="top10-poster">
                <img
                  src={resolveItemImage(item)}
                  alt={item.name}
                  loading="lazy"
                />
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
              </div>
              <div className="top10-info">
                <div className="anime-card-title" title={item.name}>
                  {item.name}
                </div>
              </div>
            </motion.div>
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
