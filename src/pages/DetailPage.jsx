import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  fetchAnimeDetail,
  fetchKitsuPoster,
  toWebpUrl,
  getImageUrl,
} from "@/lib/api.js";
import { sanitizeHtml } from "@/lib/sanitize.js";
import { useSEO } from "@/hooks/use-seo.js";

function decodeHtml(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html || "";
  return txt.value;
}

export default function DetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [posterUrl, setPosterUrl] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  const [error, setError] = useState(null);
  const [expandedServers, setExpandedServers] = useState({});

  const plainDesc = (movie?.content || movie?.description || "")
    .replace(/<[^>]*>/g, "")
    .trim();

  useSEO(
    movie
      ? {
          title: `${movie.name}${movie.origin_name ? " - " + movie.origin_name : ""} Vietsub HD`,
          description: `Xem ${movie.name} vietsub mien phi. ${plainDesc.slice(0, 150)}`,
          image: posterUrl,
          url: `/anime/${slug}`,
          type: "video.other",
        }
      : { title: "Dang tai..." }
  );

  useEffect(() => {
    let cancelled = false;

    setMovie(null);
    setError(null);

    fetchAnimeDetail(slug)
      .then((resp) => {
        if (cancelled) return;
        const data = resp.data || resp;
        const m = data.item || data.movie || data;
        const eps = data.episodes || m.episodes || [];
        const imgCdn = resp._imgCdn || m._imgCdn || "";

        const resolveImg = (file) => {
          if (!file) return "";
          if (file.startsWith("http")) return toWebpUrl(file);
          if (imgCdn) return toWebpUrl(`${imgCdn}${file}`);
          return getImageUrl(file);
        };

        setMovie(m);
        setEpisodes(eps);
        setPosterUrl(resolveImg(m.poster_url || m.thumb_url));
        setThumbUrl(resolveImg(m.thumb_url || m.poster_url));

        if (m.origin_name) {
          fetchKitsuPoster(m.origin_name).then((kitsu) => {
            if (!cancelled && kitsu?.poster) setPosterUrl(kitsu.poster);
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="empty-state" style={{ paddingTop: 120 }}>
        <div className="empty-state-text">Loi tai du lieu: {error}</div>
        <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
          Ve trang chu
        </Link>
      </div>
    );
  }

  if (!movie) {
    return (
      <>
        <div className="detail-backdrop">
          <div className="skeleton" style={{ width: "100%", height: "100%" }} />
        </div>
        <div
          className="detail-content"
          style={{ marginTop: -200, position: "relative", zIndex: 2 }}
        >
          <div className="detail-main">
            <div
              className="skeleton"
              style={{
                width: 220,
                aspectRatio: "2/3",
                borderRadius: 8,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                className="skeleton skeleton-text"
                style={{ width: "60%", height: 28, marginBottom: 16 }}
              />
              <div
                className="skeleton skeleton-text"
                style={{ width: "40%", height: 16, marginBottom: 12 }}
              />
              <div
                className="skeleton skeleton-text"
                style={{ width: "100%", height: 80 }}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  const categories = movie.category || [];
  const countries = movie.country || [];
  const firstEp = episodes[0]?.server_data?.[0];
  const EP_LIMIT = 50;

  return (
    <>
      <div className="detail-backdrop">
        <img src={thumbUrl} alt={movie.name} />
        <div className="detail-backdrop-gradient" />
      </div>
      <motion.div
        className="detail-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="detail-main">
          <div className="detail-poster">
            <img src={posterUrl} alt={movie.name} />
          </div>
          <div className="detail-info">
            <h1 className="detail-title">{movie.name}</h1>
            <p className="detail-origin">
              {decodeHtml(movie.origin_name) || ""}
            </p>
            <div className="detail-meta">
              {movie.quality && (
                <span className="detail-meta-tag">{movie.quality}</span>
              )}
              {movie.lang && (
                <span className="detail-meta-tag">{movie.lang}</span>
              )}
              {movie.year && (
                <span className="detail-meta-tag">{movie.year}</span>
              )}
              {movie.time && (
                <span className="detail-meta-tag">{movie.time}</span>
              )}
              {movie.episode_current && (
                <span className="detail-meta-tag">
                  {movie.episode_current}
                </span>
              )}
              {movie.episode_total && (
                <span className="detail-meta-tag">
                  {movie.episode_total} tap
                </span>
              )}
            </div>
            <div className="detail-categories">
              {categories.map((c) => (
                <span key={c.slug || c.name} className="detail-cat">
                  {c.name}
                </span>
              ))}
              {countries.map((c) => (
                <span key={c.slug || c.name} className="detail-cat">
                  {c.name}
                </span>
              ))}
            </div>
            <p
              className="detail-desc"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(movie.content || movie.description || "Chua co mo ta."),
              }}
            />
            {firstEp && (
              <div className="hero-actions">
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    navigate(
                      `/watch/${slug}/${encodeURIComponent(firstEp.slug || firstEp.name)}`
                    )
                  }
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>{" "}
                  Bat dau xem
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {episodes.length > 0 ? (
        <div className="episodes-section">
          <h2 className="episodes-title">Danh sach tap</h2>
          {episodes.map((server, sIdx) => {
            const eps = server.server_data || [];
            const isExpanded = expandedServers[sIdx];
            const visibleEps = isExpanded ? eps : eps.slice(0, EP_LIMIT);
            const needsExpand = eps.length > EP_LIMIT && !isExpanded;

            return (
              <div key={sIdx} className="episodes-server">
                <div className="episodes-server-name">
                  {server.server_name || "Server"}
                </div>
                <div className="episodes-grid">
                  {visibleEps.map((ep) => (
                    <button
                      key={ep.slug || ep.name}
                      className="episode-btn"
                      onClick={() =>
                        navigate(
                          `/watch/${slug}/${encodeURIComponent(ep.slug || ep.name)}`
                        )
                      }
                    >
                      {ep.name}
                    </button>
                  ))}
                </div>
                {needsExpand && (
                  <button
                    className="btn btn-outline"
                    style={{ marginTop: 8, width: "100%" }}
                    onClick={() =>
                      setExpandedServers((prev) => ({
                        ...prev,
                        [sIdx]: true,
                      }))
                    }
                  >
                    Xem them ({eps.length - EP_LIMIT} tap)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="episodes-section">
          <div className="empty-state" style={{ padding: "32px 0" }}>
            <div className="empty-state-text">Chua co tap phim nao</div>
          </div>
        </div>
      )}
    </>
  );
}
