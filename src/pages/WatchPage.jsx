import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  fetchAnimeDetail,
  getCleanM3u8Url,
  getProxiedKeyUrl,
} from "@/lib/api.js";
import { saveWatchProgress, getWatchProgress } from "@/lib/watch-history.js";
import { useSEO } from "@/hooks/use-seo.js";

function fmtTime(s) {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

let HlsLib = null;
async function loadHls() {
  if (!HlsLib) {
    const mod = await import("hls.js");
    HlsLib = mod.default;
  }
  return HlsLib;
}

function isKeyUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("/key") ||
    lower.includes("enc.key") ||
    lower.includes(".key") ||
    lower.includes("drm") ||
    lower.includes("license") ||
    /\/keys?\//i.test(url)
  );
}

/**
 * Normalize an episode identifier for comparison.
 * Strips "tap-", "tap ", "tập ", leading zeros, and lowercases.
 * "Tập 1" -> "1", "tap-01" -> "1", "01" -> "1", "full" -> "full"
 */
function normalizeEpId(val) {
  if (!val) return "";
  let s = decodeURIComponent(String(val)).trim().toLowerCase();
  s = s.replace(/^tập[\s-]*/i, "").replace(/^tap[\s-]*/i, "");
  s = s.replace(/^0+(\d)/, "$1");
  return s;
}

/**
 * Match an episode object against a URL ep param.
 */
function epMatches(epObj, epParam) {
  const norm = normalizeEpId(epParam);
  return (
    normalizeEpId(epObj.slug) === norm ||
    normalizeEpId(epObj.name) === norm ||
    epObj.slug === epParam ||
    epObj.name === epParam ||
    epObj.slug === decodeURIComponent(epParam) ||
    epObj.name === decodeURIComponent(epParam)
  );
}

/**
 * Get a clean display name for an episode.
 * If the API already returns "Tập 1", just show "1".
 * We always prepend "Tập" in the UI, so strip it from the data.
 */
function cleanEpDisplayName(name) {
  if (!name) return "";
  let s = name.trim();
  s = s.replace(/^Tập\s*/i, "").replace(/^Tap\s*/i, "");
  return s;
}

/**
 * Build a stable URL-safe identifier for an episode.
 * Prefer slug, fall back to normalized name.
 */
function epUrlId(epObj) {
  return epObj.slug || epObj.name || "";
}

export default function WatchPage() {
  const { slug, ep } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const wrapperRef = useRef(null);
  const saveTimerRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const movieRef = useRef(null);
  const currentEpRef = useRef(null);
  const fetchIdRef = useRef(0);

  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [currentEp, setCurrentEp] = useState(null);
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(0);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playerError, setPlayerError] = useState(null);

  movieRef.current = movie;
  currentEpRef.current = currentEp;

  const epDisplay = currentEp ? cleanEpDisplayName(currentEp.name) : ep;

  useSEO(
    movie
      ? {
          title: `${movie.name} - Tập ${epDisplay}`,
          url: `/watch/${slug}/${ep}`,
        }
      : { title: "Đang tải..." }
  );

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const playM3u8 = useCallback(
    async (url) => {
      const video = videoRef.current;
      if (!video || !url) return;

      destroyHls();
      setPlayerError(null);

      const cleanUrl = getCleanM3u8Url(url);
      const Hls = await loadHls();

      if (!Hls.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = cleanUrl;
          video.play().catch(() => {});
        } else {
          setPlayerError("Trình duyệt không hỗ trợ phát video HLS.");
        }
        return;
      }

      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        enableWorker: true,
        lowLatencyMode: false,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
        xhrSetup: (xhr, xhrUrl) => {
          if (isKeyUrl(xhrUrl)) {
            xhr.open("GET", getProxiedKeyUrl(xhrUrl), true);
          }
        },
      });

      hls.loadSource(cleanUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const saved = getWatchProgress(slug);
        if (saved && saved.episodeSlug === ep && saved.currentTime > 5) {
          video.currentTime = saved.currentTime - 3;
        }
        video.play().catch(() => {});
      });

      let retryCount = 0;
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (
            data.type === Hls.ErrorTypes.NETWORK_ERROR &&
            retryCount < 3
          ) {
            retryCount++;
            setTimeout(() => hls.startLoad(), 1000 * retryCount);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setPlayerError("Không thể phát video. Thử đổi server.");
            hls.destroy();
          }
        }
      });

      hlsRef.current = hls;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug, ep]
  );

  useEffect(() => {
    const thisId = ++fetchIdRef.current;

    setMovie(null);
    setEpisodes([]);
    setCurrentEp(null);
    setError(null);
    setPlayerError(null);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);

    fetchAnimeDetail(slug)
      .then((resp) => {
        if (thisId !== fetchIdRef.current) return;
        const data = resp.data || resp;
        const m = data.item || data.movie || data;
        const eps = data.episodes || m.episodes || [];

        setMovie(m);
        setEpisodes(eps);
        setServers(eps.map((s) => s.server_name || "Server"));

        let foundEp = null;
        let foundServerIdx = 0;
        for (let i = 0; i < eps.length; i++) {
          const found = (eps[i].server_data || []).find((e) =>
            epMatches(e, ep)
          );
          if (found) {
            foundEp = found;
            foundServerIdx = i;
            break;
          }
        }

        if (foundEp) {
          setCurrentEp(foundEp);
          setActiveServer(foundServerIdx);
          if (foundEp.link_m3u8) {
            playM3u8(foundEp.link_m3u8);
          } else if (foundEp.link_embed) {
            setPlayerError(null);
          } else {
            setPlayerError("Không tìm thấy link phát cho tập này.");
          }
        } else {
          setPlayerError("Không tìm thấy tập phim này.");
        }
      })
      .catch((err) => {
        if (thisId === fetchIdRef.current) setError(err.message);
      });

    return () => {
      destroyHls();
    };
  }, [slug, ep, playM3u8, destroyHls]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (!video.duration) return;
      setCurrentTime(video.currentTime);
      setDuration(video.duration);
      setProgress((video.currentTime / video.duration) * 100);
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    saveTimerRef.current = setInterval(() => {
      const m = movieRef.current;
      const cep = currentEpRef.current;
      if (video.currentTime > 0 && m) {
        const imgCdn = m._imgCdn || "";
        const thumb = m.thumb_url || m.poster_url || "";
        const thumbUrl = thumb.startsWith("http")
          ? thumb
          : imgCdn
            ? `${imgCdn}${thumb}`
            : thumb;
        saveWatchProgress(
          slug,
          cep?.name || ep,
          ep,
          m.name,
          thumbUrl,
          video.currentTime,
          video.duration
        );
      }
    }, 5000);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      clearInterval(saveTimerRef.current);
    };
  }, [slug, ep]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (!videoRef.current?.paused) setControlsVisible(false);
    }, 3500);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const seekTo = (pct) => {
    const video = videoRef.current;
    if (video && video.duration) {
      video.currentTime = Math.max(0, Math.min(1, pct)) * video.duration;
    }
  };

  const seekBy = (sec) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.max(
        0,
        Math.min(video.duration || 0, video.currentTime + sec)
      );
    }
  };

  const toggleFullscreen = () => {
    const wrapper = wrapperRef.current;
    const video = videoRef.current;
    if (!wrapper) return;

    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(
        document
      );
    } else {
      const fn = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen;
      if (fn) {
        fn.call(wrapper).catch(() => {
          const vfn =
            video?.webkitEnterFullscreen || video?.webkitRequestFullscreen;
          if (vfn) vfn.call(video);
        });
      }
    }
  };

  const allEps = useMemo(
    () =>
      episodes[activeServer]?.server_data ||
      episodes[0]?.server_data ||
      [],
    [episodes, activeServer]
  );

  const currentIdx = useMemo(
    () => allEps.findIndex((e) => epMatches(e, ep)),
    [allEps, ep]
  );

  const prevEp = currentIdx > 0 ? allEps[currentIdx - 1] : null;
  const nextEp =
    currentIdx >= 0 && currentIdx < allEps.length - 1
      ? allEps[currentIdx + 1]
      : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !nextEp) return;
    const onEnded = () => {
      navigate(
        `/watch/${slug}/${encodeURIComponent(epUrlId(nextEp))}`
      );
    };
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [nextEp, slug, navigate]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      const video = videoRef.current;
      if (!video) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(10);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          video.muted = !video.muted;
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  if (error) {
    return (
      <div className="empty-state" style={{ paddingTop: 120 }}>
        <div className="empty-state-text">Lỗi: {error}</div>
        <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
          Về trang chủ
        </Link>
      </div>
    );
  }

  const useEmbed = currentEp && !currentEp.link_m3u8 && currentEp.link_embed;

  return (
    <div className="watch-page">
      {useEmbed ? (
        <div className="player-wrapper" ref={wrapperRef}>
          <iframe
            src={currentEp.link_embed}
            className="player-embed"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture"
            title={`${movie?.name || ""} - Tập ${epDisplay}`}
          />
        </div>
      ) : (
        <div
          className={`player-wrapper ${controlsVisible ? "controls-visible" : "controls-hidden"}`}
          ref={wrapperRef}
          onMouseMove={showControls}
          onTouchStart={showControls}
        >
          <video ref={videoRef} className="player-video" playsInline />

          <div className="player-touch-layer" onClick={togglePlay} />

          <button
            className="player-center-btn"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
          >
            {playing ? (
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {playerError && (
            <div className="player-error">
              <p>{playerError}</p>
              {servers.length > 1 && (
                <p className="player-error-hint">
                  Thử chọn server khác bên dưới.
                </p>
              )}
            </div>
          )}

          <div className="player-bottom-controls">
            <div
              className="player-progress"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo((e.clientX - rect.left) / rect.width);
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo(
                  (e.touches[0].clientX - rect.left) / rect.width
                );
              }}
            >
              <div
                className="player-progress-fill"
                style={{ width: `${progress}%` }}
              />
              <div
                className="player-progress-handle"
                style={{ left: `${progress}%` }}
              />
            </div>
            <div className="player-controls-row">
              <div className="player-time">
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </div>
              <div className="player-controls-right">
                <button
                  className="player-ctrl-btn"
                  onClick={() => seekBy(-10)}
                  title="-10s"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </button>
                <button
                  className="player-ctrl-btn"
                  onClick={() => seekBy(10)}
                  title="+10s"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
                <button
                  className="player-ctrl-btn"
                  onClick={toggleFullscreen}
                  title="Fullscreen"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <motion.div
        className="watch-info"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      >
        {movie && (
          <>
            <h1 className="watch-title">{movie.name}</h1>
            <p className="watch-ep-name">
              Tập {epDisplay}
              {movie.quality && (
                <span className="detail-meta-tag">{movie.quality}</span>
              )}
              {movie.lang && (
                <span className="detail-meta-tag">{movie.lang}</span>
              )}
            </p>
          </>
        )}

        <div className="watch-nav">
          {prevEp ? (
            <button
              className="btn btn-outline"
              onClick={() =>
                navigate(
                  `/watch/${slug}/${encodeURIComponent(epUrlId(prevEp))}`
                )
              }
            >
              &larr; Tập trước
            </button>
          ) : (
            <span />
          )}
          <Link to={`/anime/${slug}`} className="btn btn-outline">
            Danh sách tập
          </Link>
          {nextEp ? (
            <button
              className="btn btn-primary"
              onClick={() =>
                navigate(
                  `/watch/${slug}/${encodeURIComponent(epUrlId(nextEp))}`
                )
              }
            >
              Tập tiếp &rarr;
            </button>
          ) : (
            <span />
          )}
        </div>

        {servers.length > 1 && (
          <div className="watch-servers">
            {servers.map((name, i) => (
              <button
                key={i}
                className={`filter-chip ${i === activeServer ? "active" : ""}`}
                onClick={() => {
                  setActiveServer(i);
                  const serverEps = episodes[i]?.server_data || [];
                  const found = serverEps.find((e) => epMatches(e, ep));
                  if (found?.link_m3u8) playM3u8(found.link_m3u8);
                  else if (found?.link_embed) {
                    destroyHls();
                    setCurrentEp(found);
                    setPlayerError(null);
                  }
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {allEps.length > 0 && (
          <div className="episodes-section">
            <h2 className="episodes-title">Danh sách tập</h2>
            <div className="episodes-grid">
              {allEps.map((epItem) => (
                <button
                  key={epUrlId(epItem)}
                  className={`episode-btn ${epMatches(epItem, ep) ? "active" : ""}`}
                  onClick={() =>
                    navigate(
                      `/watch/${slug}/${encodeURIComponent(epUrlId(epItem))}`
                    )
                  }
                >
                  {epItem.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
