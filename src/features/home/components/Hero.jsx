import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { resolveItemImage } from "@/lib/api.js";

export function Hero({ items }) {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const touchRef = useRef({ startX: 0, startY: 0 });

  const slides = items?.slice(0, 5) || [];

  const goTo = useCallback(
    (idx) => {
      setCurrent(((idx % slides.length) + slides.length) % slides.length);
    },
    [slides.length]
  );

  useEffect(() => {
    if (slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timerRef.current);
  }, [slides.length]);

  const handleTouchStart = (e) => {
    touchRef.current.startX = e.touches[0].clientX;
    touchRef.current.startY = e.touches[0].clientY;
    clearInterval(timerRef.current);
  };

  const handleTouchEnd = (e) => {
    const dx = touchRef.current.startX - e.changedTouches[0].clientX;
    const dy = touchRef.current.startY - e.changedTouches[0].clientY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      goTo(dx > 0 ? current + 1 : current - 1);
    }
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
  };

  if (slides.length === 0) return null;

  const item = slides[current];

  return (
    <div
      className="hero"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="hero-slides">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            className="hero-slide active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          >
            <img
              className="hero-slide-bg"
              src={resolveItemImage(item, true)}
              alt={item.name}
              loading={current === 0 ? "eager" : "lazy"}
            />
            <div className="hero-gradient" />
            <div className="hero-content">
              <motion.div
                className="hero-badge"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span>{item.lang || "Vietsub"}</span>
              </motion.div>
              <motion.h1
                className="hero-title"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
              >
                {item.name.split("(")[0].trim()}
              </motion.h1>
              <motion.div
                className="hero-meta"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                {item.quality && (
                  <span className="quality">{item.quality}</span>
                )}
                {item.year && <span className="year">{item.year}</span>}
                {item.episode_current && (
                  <span className="hero-meta-item">
                    {item.episode_current}
                  </span>
                )}
                {item.time && (
                  <span className="hero-meta-item">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>{" "}
                    {item.time}
                  </span>
                )}
              </motion.div>
              {item.category && (
                <motion.p
                  className="hero-desc"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  {item.category.map((c) => c.name).join(" • ")}
                </motion.p>
              )}
              <motion.div
                className="hero-actions"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <button
                  className="btn btn-primary hero-watch-btn"
                  onClick={() => navigate(`/anime/${item.slug}`)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>{" "}
                  Xem ngay
                </button>
                <button
                  className="btn btn-outline hero-detail-btn"
                  onClick={() => navigate(`/anime/${item.slug}`)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>{" "}
                  Chi tiết
                </button>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      {slides.length > 1 && (
        <div className="hero-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`hero-dot ${i === current ? "active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="hero">
      <div className="hero-slides">
        <div className="hero-slide active">
          <div className="skeleton" style={{ width: "100%", height: "100%" }} />
          <div className="hero-gradient" />
          <div className="hero-content">
            <div
              className="skeleton"
              style={{
                width: 120,
                height: 24,
                borderRadius: 20,
                marginBottom: 16,
              }}
            />
            <div
              className="skeleton"
              style={{
                width: "60%",
                height: 32,
                borderRadius: 6,
                marginBottom: 12,
              }}
            />
            <div
              className="skeleton"
              style={{
                width: "40%",
                height: 16,
                borderRadius: 6,
                marginBottom: 16,
              }}
            />
            <div style={{ display: "flex", gap: 12 }}>
              <div
                className="skeleton"
                style={{ width: 120, height: 44, borderRadius: 10 }}
              />
              <div
                className="skeleton"
                style={{ width: 100, height: 44, borderRadius: 10 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
