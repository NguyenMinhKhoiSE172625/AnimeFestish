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

// Known ad injection timestamps (in seconds) from upstream providers
// Format: { start, end, label }
const KNOWN_AD_TIMESTAMPS = [
  { start: 895, end: 925, label: "QC ~15:00" },  // 14:55 - 15:25
  { start: 1495, end: 1525, label: "QC ~25:00" }, // 24:55 - 25:25 (if exists)
];

const AD_PATTERNS = /convert|\/v\d+\/[0-9a-f]{20,}\/|adsplay|adserver|preroll|midroll|postroll|\/ads?\//i;

function stripAdSegments(playlist) {
  const lines = playlist.split("\n");
  if (lines.length < 10) return playlist;

  // Collect segment URLs and their path structures to detect anomalies
  const segments = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#EXTINF:") && lines[i + 1] && !lines[i + 1].startsWith("#")) {
      segments.push({ url: lines[i + 1], index: i + 1 });
    }
  }

  // Detect the dominant path pattern (most segments share similar path structure)
  const pathSignatures = new Map();
  segments.forEach((s) => {
    // Signature: strip filename, keep directory structure
    const sig = s.url.replace(/[^/]+$/, "").replace(/\d+/g, "#");
    pathSignatures.set(sig, (pathSignatures.get(sig) || 0) + 1);
  });

  // The signature with the most segments is the content; others are likely ads
  let dominantSig = "";
  let maxCount = 0;
  pathSignatures.forEach((count, sig) => {
    if (count > maxCount) { maxCount = count; dominantSig = sig; }
  });

  const adSegmentIndexes = new Set();
  segments.forEach((s) => {
    const sig = s.url.replace(/[^/]+$/, "").replace(/\d+/g, "#");
    if (AD_PATTERNS.test(s.url) || (sig !== dominantSig && maxCount > segments.length * 0.5)) {
      adSegmentIndexes.add(s.index);
    }
  });

  const out = [];
  let i = 0;
  while (i < lines.length) {
    // Skip ad segments (and their preceding #EXTINF)
    if (adSegmentIndexes.has(i)) {
      // Also remove the #EXTINF line that precedes this segment
      if (out.length && out[out.length - 1].startsWith("#EXTINF:")) out.pop();
      // And drop surrounding DISCONTINUITY markers
      while (out.length && out[out.length - 1] === "#EXT-X-DISCONTINUITY") out.pop();
      i++;
      while (i < lines.length && lines[i] === "#EXT-X-DISCONTINUITY") i++;
      continue;
    }
    out.push(lines[i]);
    i++;
  }
  return out.join("\n");
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
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showAdSkip, setShowAdSkip] = useState(false);
  const lastAdSkipRef = useRef(0);
  const [autoSkipAds, setAutoSkipAds] = useState(() => {
    return localStorage.getItem('autoSkipAds') === 'true';
  });

  // Mobile touch gesture state
  const touchStartRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const lastTapRef = useRef(0);
  const lastTapXRef = useRef(0);
  const osdTimerRef = useRef(null);
  const [osd, setOsd] = useState(null); // { type: 'seek' | 'skip', value: number, x: number }

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
        pLoader: class extends Hls.DefaultConfig.loader {
          load(context, config, callbacks) {
            const origSuccess = callbacks.onSuccess;
            callbacks.onSuccess = (response, stats, ctx, networkDetails) => {
              if (typeof response.data === "string" && response.data.includes("#EXTINF")) {
                response.data = stripAdSegments(response.data);
              }
              origSuccess(response, stats, ctx, networkDetails);
            };
            super.load(context, config, callbacks);
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

      // Check if currently in a known ad segment
      const now = video.currentTime;
      let inAdSegment = false;
      for (const ad of KNOWN_AD_TIMESTAMPS) {
        if (now >= ad.start && now <= ad.end) {
          inAdSegment = true;
          break;
        }
      }

      // Show skip button when entering ad segment (debounce 30s)
      if (inAdSegment && (now - lastAdSkipRef.current) > 30) {
        setShowAdSkip(true);
      } else if (!inAdSegment) {
        setShowAdSkip(false);
      }

      // Auto-skip if user has enabled auto-skip
      if (inAdSegment && autoSkipAds) {
        if ((now - lastAdSkipRef.current) > 30) {
          for (const ad of KNOWN_AD_TIMESTAMPS) {
            if (now >= ad.start && now <= ad.end) {
              video.currentTime = ad.end + 1;
              lastAdSkipRef.current = ad.end + 1;
              setShowAdSkip(false);
              break;
            }
          }
        }
      }
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

  const toggleFullscreen = async () => {
    const wrapper = wrapperRef.current;
    const video = videoRef.current;
    if (!wrapper) return;

    if (document.fullscreenElement || document.webkitFullscreenElement) {
      // Unlock orientation when exiting fullscreen
      if (screen.orientation && screen.orientation.unlock) {
        try { screen.orientation.unlock(); } catch {}
      }
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(
        document
      );
    } else {
      const fn = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen;
      if (fn) {
        try {
          await fn.call(wrapper);
          // Lock to landscape after entering fullscreen
          if (screen.orientation && screen.orientation.lock) {
            try { await screen.orientation.lock('landscape'); } catch {}
          }
        } catch {
          const vfn =
            video?.webkitEnterFullscreen || video?.webkitRequestFullscreen;
          if (vfn) {
            vfn.call(video);
            if (screen.orientation && screen.orientation.lock) {
              try { await screen.orientation.lock('landscape'); } catch {}
            }
          }
        }
      } else {
        // Fallback for iOS Safari: use native video fullscreen
        const vfn = video?.webkitEnterFullscreen;
        if (vfn) {
          vfn.call(video);
          if (screen.orientation && screen.orientation.lock) {
            try { await screen.orientation.lock('landscape'); } catch {}
          }
        }
      }
    }
  };

  // --- Mobile Touch Gestures ---
  // Single tap only reveals controls. Play/pause is handled only by explicit buttons.
  // Seek gestures are limited to the right half of the player to avoid accidental scrubbing.
  const handleTouchStart = useCallback((e) => {
    if (e.target.closest('.player-bottom-controls') ||
        e.target.closest('button') ||
        e.target.tagName === 'INPUT') return;

    const touch = e.touches[0];
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const relX = touch.clientX - rect.left;
    const isRightHalf = relX >= rect.width / 2;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      isRightHalf,
      startTime: videoRef.current?.currentTime || 0,
    };
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartRef.current?.isRightHalf) return;
    if (e.target.closest('.player-bottom-controls')) return;

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartXRef.current);
    const dy = Math.abs(touch.clientY - touchStartYRef.current);

    // Horizontal swipe on right half → relative seek from current playback position
    if (dx > 20 && dx > dy) {
      e.preventDefault();
      const video = videoRef.current;
      const wrapper = wrapperRef.current;
      if (!video || !video.duration || !wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      const signedDx = touch.clientX - touchStartXRef.current;
      // Drag sensitivity: full player width ≈ 90 seconds.
      const deltaSeconds = (signedDx / rect.width) * 90;
      const newTime = Math.max(
        0,
        Math.min(video.duration, (touchStartRef.current.startTime || 0) + deltaSeconds)
      );

      video.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress((newTime / video.duration) * 100);
      showControls();
    }
  }, [showControls]);

  const handleTouchEnd = useCallback((e) => {
    if (!touchStartRef.current) return;

    const start = touchStartRef.current;
    const elapsed = Date.now() - start.time;
    const ct = e.changedTouches?.[0];
    const dx = ct ? Math.abs(ct.clientX - touchStartXRef.current) : 0;
    const dy = ct ? Math.abs(ct.clientY - touchStartYRef.current) : 0;

    // Tap: short duration, minimal movement. Never toggles play/pause.
    if (elapsed < 300 && dx < 15 && dy < 15) {
      const now = Date.now();

      if (start.isRightHalf && now - lastTapRef.current < 350) {
        // Double tap on right half → forward 10s only
        lastTapRef.current = 0;
        seekBy(10);
        clearTimeout(osdTimerRef.current);
        setOsd({ type: 'skip', value: 10, x: 75 });
        osdTimerRef.current = setTimeout(() => setOsd(null), 600);
      } else {
        lastTapRef.current = start.isRightHalf ? now : 0;
        showControls();
      }
    }

    touchStartRef.current = null;
  }, [seekBy, showControls]);

  // ...

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
          setMuted(video.muted);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  // Auto-lock landscape when entering fullscreen on mobile
  useEffect(() => {
    const onFsChange = () => {
      if (screen.orientation && screen.orientation.lock) {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          try { screen.orientation.lock('landscape'); } catch {}
        } else {
          try { screen.orientation.unlock(); } catch {}
        }
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

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
          onMouseLeave={() => {
            if (!videoRef.current?.paused) setControlsVisible(false);
          }}
        >
          {/* Video rendered FIRST so touch layer sits above it */}
          <video ref={videoRef} className="player-video" playsInline />

          {/* Touch capture layer — sits above video, below controls. Handles ALL gestures */}
          <div
            className="player-touch-layer"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />

          {/* OSD feedback for double-tap seek */}
          {osd && (
            <div className={`player-osd player-osd-${osd.type}`} style={{ left: `${osd.x}%` }}>
              {osd.type === 'skip' && (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {osd.value < 0 ? (
                      <>
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </>
                    ) : (
                      <>
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </>
                    )}
                  </svg>
                  <span>{Math.abs(osd.value)}s</span>
                </>
              )}
            </div>
          )}

          {showAdSkip && (
            <button
              className="player-skip-ad active"
              onClick={(e) => {
                e.stopPropagation();
                const video = videoRef.current;
                if (!video) return;
                const now = video.currentTime;
                for (const ad of KNOWN_AD_TIMESTAMPS) {
                  if (now >= ad.start && now <= ad.end) {
                    video.currentTime = ad.end + 1;
                    lastAdSkipRef.current = ad.end + 1;
                    setShowAdSkip(false);
                    break;
                  }
                }
              }}
              title="Bỏ qua quảng cáo"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 4 15 12 5 20 5 4"/>
                <line x1="19" y1="5" x2="19" y2="19"/>
              </svg>
              Bỏ qua QC
            </button>
          )}

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
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo((e.clientX - rect.left) / rect.width);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo(Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width)));
              }}
              onTouchMove={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo(Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width)));
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
              <div className="player-controls-left">
                <div className="player-volume-wrap">
                  <button
                    className="player-ctrl-btn"
                    onClick={() => {
                      const v = videoRef.current;
                      if (v) { v.muted = !v.muted; setMuted(v.muted); }
                    }}
                    title={muted ? "Bật tiếng" : "Tắt tiếng"}
                  >
                    {muted || volume === 0 ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      </svg>
                    )}
                  </button>
                  <input
                    className="player-volume-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={muted ? 0 : volume}
                    onChange={(e) => {
                      const v = videoRef.current;
                      const val = parseFloat(e.target.value);
                      if (v) { v.volume = val; v.muted = val === 0; }
                      setVolume(val);
                      setMuted(val === 0);
                    }}
                  />
                </div>
                <div className="player-time">
                  {fmtTime(currentTime)} / {fmtTime(duration)}
                </div>
              </div>
              <div className="player-controls-right">
                <button
                  className={`player-ctrl-btn ${autoSkipAds ? 'active' : ''}`}
                  onClick={() => {
                    setAutoSkipAds(prev => {
                      localStorage.setItem('autoSkipAds', String(!prev));
                      return !prev;
                    });
                  }}
                  title={autoSkipAds ? 'Tắt tự động bỏ qua QC' : 'Bật tự động bỏ qua QC'}
                  style={autoSkipAds ? { color: '#ff6b35' } : {}}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                </button>
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
