import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  fetchAnimeDetail,
  getCleanM3u8Url,
  getProxiedKeyUrl,
} from "@/lib/api.js";
import { resolveSkipIntroMarker } from "@/lib/skip-intro.js";
import { saveWatchProgress, getWatchProgress } from "@/lib/watch-history.js";
import { useSEO } from "@/hooks/use-seo.js";

function fmtTime(s) {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

// Upstream randomly injects one 30s ad at either 15:00 or 15:30.
const KNOWN_AD_TIMESTAMPS = [
  { start: 900, end: 930 },
  { start: 930, end: 960 },
];

const AD_SKIP_SECONDS = 30;
const PLAYER_VOLUME_KEY = "playerVolume";
const PLAYER_MUTED_KEY = "playerMuted";

function getSavedPlayerAudio() {
  const savedVolume = Number(localStorage.getItem(PLAYER_VOLUME_KEY));
  const volume = Number.isFinite(savedVolume) && savedVolume > 0
    ? Math.max(0, Math.min(1, savedVolume))
    : 0.5;

  return {
    volume,
    muted: localStorage.getItem(PLAYER_MUTED_KEY) === "true",
  };
}

function savePlayerAudio(video) {
  localStorage.setItem(PLAYER_VOLUME_KEY, String(video.volume));
  localStorage.setItem(PLAYER_MUTED_KEY, String(video.muted));
}

function applyPlayerAudio(video, audio) {
  video.volume = audio.volume;
  video.muted = audio.muted;
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

function getActiveAdSegment(time) {
  return KNOWN_AD_TIMESTAMPS.find(
    (ad) => time >= ad.start && time < ad.end
  ) || null;
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
  const progressFillRef = useRef(null);
  const progressHandleRef = useRef(null);
  const timeDisplayRef = useRef(null);
  const brightnessLayerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const movieRef = useRef(null);
  const currentEpRef = useRef(null);
  const fetchIdRef = useRef(0);
  const desiredPlayingRef = useRef(true);
  const lastPlayerUiUpdateRef = useRef(0);
  const showAdSkipRef = useRef(false);
  const showIntroSkipRef = useRef(false);
  const keyHoldTimerRef = useRef(null);
  const activeSpeedKeyRef = useRef(null);
  const lastArrowTapRef = useRef({ time: 0, key: null, total: 0 });
  const reverseSpeedTimerRef = useRef(null);
  const reverseSpeedWasPlayingRef = useRef(false);

  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [currentEp, setCurrentEp] = useState(null);
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(0);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playerError, setPlayerError] = useState(null);
  const [muted, setMuted] = useState(() => getSavedPlayerAudio().muted);
  const [volume, setVolume] = useState(() => getSavedPlayerAudio().volume);
  const [showAdSkip, setShowAdSkip] = useState(false);
  const [introSkip, setIntroSkip] = useState(null);
  const [showIntroSkip, setShowIntroSkip] = useState(false);
  const lastAdSkipRef = useRef(0);
  const [autoSkipAds, setAutoSkipAds] = useState(() => {
    return localStorage.getItem('autoSkipAds') === 'true';
  });

  // Cốc Cốc-like mobile gesture state
  const gestureRef = useRef(null);
  const lastTapRef = useRef({ time: 0, side: null, total: 0 });
  const osdTimerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const clickSuppressUntilRef = useRef(0);
  const brightnessRef = useRef(1);
  const [osd, setOsd] = useState(null);

  movieRef.current = movie;
  currentEpRef.current = currentEp;

  const epDisplay = currentEp ? cleanEpDisplayName(currentEp.name) : ep;

  const renderPlayerClock = useCallback((time, total) => {
    const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
    const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    const pct = safeTotal ? Math.min(100, (safeTime / safeTotal) * 100) : 0;

    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${pct}%`;
    }
    if (progressHandleRef.current) {
      progressHandleRef.current.style.left = `${pct}%`;
    }
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${fmtTime(safeTime)} / ${fmtTime(safeTotal)}`;
    }
  }, []);

  useSEO(
    movie
      ? {
          title: `${movie.name} - Tập ${epDisplay}`,
          url: `/watch/${slug}/${ep}`,
        }
      : { title: "Đang tải..." }
  );

  const destroyHls = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
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
      desiredPlayingRef.current = true;
      setPlayerError(null);
      applyPlayerAudio(video, getSavedPlayerAudio());

      const cleanUrl = getCleanM3u8Url(url);
      const Hls = await loadHls();

      if (!Hls.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = cleanUrl;
          if (desiredPlayingRef.current) video.play().catch(() => {});
        } else {
          setPlayerError("Trình duyệt không hỗ trợ phát video HLS.");
        }
        return;
      }

      const hls = new Hls({
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
        if (desiredPlayingRef.current) {
          video.play().catch(() => {});
        }
      });

      let retryCount = 0;
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (
            data.type === Hls.ErrorTypes.NETWORK_ERROR &&
            retryCount < 3
          ) {
            retryCount++;
            setTimeout(() => {
              if (desiredPlayingRef.current) hls.startLoad();
            }, 1000 * retryCount);
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
    setDuration(0);
    setShowAdSkip(false);
    setIntroSkip(null);
    setShowIntroSkip(false);
    lastPlayerUiUpdateRef.current = 0;
    lastAdSkipRef.current = 0;
    showAdSkipRef.current = false;
    showIntroSkipRef.current = false;
    brightnessRef.current = 1;
    if (brightnessLayerRef.current) brightnessLayerRef.current.style.opacity = "0";
    renderPlayerClock(0, 0);

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
  }, [slug, ep, playM3u8, destroyHls, renderPlayerClock]);

  useEffect(() => {
    let cancelled = false;

    if (!currentEp || !duration) {
      setIntroSkip(null);
      setShowIntroSkip(false);
      return () => {
        cancelled = true;
      };
    }

    resolveSkipIntroMarker({ slug, ep, episode: currentEp, duration }).then((marker) => {
      if (cancelled) return;
      setIntroSkip(marker);
      if (!marker) setShowIntroSkip(false);
    });

    return () => {
      cancelled = true;
    };
  }, [slug, ep, currentEp, duration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncDuration = () => {
      if (!video.duration) return;
      setDuration((prev) => {
        if (Math.abs(prev - video.duration) < 0.2) return prev;
        return video.duration;
      });
      renderPlayerClock(video.currentTime, video.duration);
    };

    const setAdSkipVisible = (visible) => {
      if (showAdSkipRef.current === visible) return;
      showAdSkipRef.current = visible;
      setShowAdSkip(visible);
    };

    const setIntroSkipVisible = (visible) => {
      if (showIntroSkipRef.current === visible) return;
      showIntroSkipRef.current = visible;
      setShowIntroSkip(visible);
    };

    const syncPlayerClock = (force = false) => {
      if (!video.duration) return;
      const nowMs = performance.now();
      if (!force && nowMs - lastPlayerUiUpdateRef.current < 250) return;

      lastPlayerUiUpdateRef.current = nowMs;
      renderPlayerClock(video.currentTime, video.duration);
    };

    const onTimeUpdate = () => {
      if (!video.duration) return;
      syncPlayerClock();

      const now = video.currentTime;
      const activeAd = getActiveAdSegment(now);

      if (activeAd) {
        setAdSkipVisible(true);
      } else {
        setAdSkipVisible(false);
      }

      if (introSkip && now >= introSkip.start && now < introSkip.end - 1) {
        setIntroSkipVisible(true);
      } else {
        setIntroSkipVisible(false);
      }

      if (activeAd && autoSkipAds && now >= lastAdSkipRef.current) {
        const targetTime = Math.min(video.duration, now + AD_SKIP_SECONDS);
        video.currentTime = targetTime;
        lastAdSkipRef.current = targetTime;
        setAdSkipVisible(false);
        syncPlayerClock(true);
      }
    };

    const onSeeked = () => syncPlayerClock(true);

    const onPlay = () => {
      desiredPlayingRef.current = true;
      setPlaying(true);
      syncPlayerClock(true);
    };
    const onPause = () => {
      desiredPlayingRef.current = false;
      setPlaying(false);
      syncPlayerClock(true);
    };
    const onVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
      savePlayerAudio(video);
    };

    applyPlayerAudio(video, getSavedPlayerAudio());
    onVolumeChange();

    video.addEventListener("loadedmetadata", syncDuration);
    video.addEventListener("durationchange", syncDuration);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolumeChange);

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
      video.removeEventListener("loadedmetadata", syncDuration);
      video.removeEventListener("durationchange", syncDuration);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolumeChange);
      clearInterval(saveTimerRef.current);
    };
  }, [slug, ep, autoSkipAds, introSkip, renderPlayerClock]);

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

    if (video.paused) {
      desiredPlayingRef.current = true;
      video.play().catch(() => {});
    } else {
      desiredPlayingRef.current = false;
      video.pause();
      setPlaying(false);
      setControlsVisible(true);
    }
  }, []);

  const seekTo = useCallback((pct) => {
    const video = videoRef.current;
    if (video && video.duration) {
      video.currentTime = Math.max(0, Math.min(1, pct)) * video.duration;
      renderPlayerClock(video.currentTime, video.duration);
    }
  }, [renderPlayerClock]);

  const seekBy = useCallback((sec) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.max(
        0,
        Math.min(video.duration || 0, video.currentTime + sec)
      );
      renderPlayerClock(video.currentTime, video.duration || 0);
    }
  }, [renderPlayerClock]);

  const seekFromClientX = useCallback((target, clientX) => {
    const rect = target.getBoundingClientRect();
    if (!rect.width) return;
    seekTo((clientX - rect.left) / rect.width);
  }, [seekTo]);

  const toggleFullscreen = useCallback(async () => {
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
  }, []);

  const hideOrShowControls = useCallback(() => {
    setControlsVisible((visible) => {
      clearTimeout(controlsTimerRef.current);
      if (!visible) {
        controlsTimerRef.current = setTimeout(() => {
          if (!videoRef.current?.paused) setControlsVisible(false);
        }, 3500);
      }
      return !visible;
    });
  }, []);

  const showGestureOsd = useCallback((next, delay = 700) => {
    clearTimeout(osdTimerRef.current);
    setOsd(next);
    if (delay != null) {
      osdTimerRef.current = setTimeout(() => setOsd(null), delay);
    }
  }, []);

  const stopReverseSpeed = useCallback(() => {
    clearInterval(reverseSpeedTimerRef.current);
    reverseSpeedTimerRef.current = null;

    const video = videoRef.current;
    if (video && reverseSpeedWasPlayingRef.current && video.paused) {
      video.play().catch(() => {});
    }
  }, []);

  const startForwardSpeed = useCallback(() => {
    stopReverseSpeed();
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = 5;
    showGestureOsd({ type: 'speed', value: 5, x: 86 }, null);
  }, [showGestureOsd, stopReverseSpeed]);

  const startReverseSpeed = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    clearInterval(reverseSpeedTimerRef.current);
    reverseSpeedWasPlayingRef.current = !video.paused;
    video.playbackRate = 1;
    video.pause();

    const tickMs = 80;
    reverseSpeedTimerRef.current = setInterval(() => {
      const currentVideo = videoRef.current;
      if (!currentVideo) return;

      currentVideo.currentTime = Math.max(0, currentVideo.currentTime - (5 * tickMs) / 1000);
      renderPlayerClock(currentVideo.currentTime, currentVideo.duration || 0);
    }, tickMs);

    showGestureOsd({ type: 'speed', value: 5, x: 86 }, null);
  }, [renderPlayerClock, showGestureOsd]);

  // --- Cốc Cốc-like Mobile Touch Gestures ---
  // Tap: toggle UI only. Double tap: left -5s, right +5s. Horizontal drag: preview seek, commit on release.
  // Vertical drag: left brightness overlay, right volume. Long press: temporary 5x speed.
  const handleTouchStart = useCallback((e) => {
    if (e.target.closest('.player-bottom-controls') ||
        e.target.closest('button') ||
        e.target.tagName === 'INPUT') return;

    const touch = e.touches[0];
    const wrapper = wrapperRef.current;
    const video = videoRef.current;
    if (!wrapper || !video) return;

    const rect = wrapper.getBoundingClientRect();
    const relX = touch.clientX - rect.left;
    const side = relX < rect.width / 2 ? 'left' : 'right';

    clearTimeout(longPressTimerRef.current);
    gestureRef.current = {
      mode: null,
      side,
      startX: touch.clientX,
      startY: touch.clientY,
      time: Date.now(),
      startVideoTime: video.currentTime || 0,
      previewTime: null,
      startVolume: video.muted ? 0 : video.volume,
      startBrightness: brightnessRef.current,
      longPressActive: false,
    };

    longPressTimerRef.current = setTimeout(() => {
      const g = gestureRef.current;
      const v = videoRef.current;
      if (!g || !v || g.mode) return;
      g.mode = 'speed';
      g.longPressActive = true;
      setControlsVisible(true);
      if (g.side === 'left') {
        startReverseSpeed();
      } else {
        startForwardSpeed();
      }
    }, 450);
  }, [startForwardSpeed, startReverseSpeed]);

  const handleTouchMove = useCallback((e) => {
    const g = gestureRef.current;
    if (!g || e.target.closest('.player-bottom-controls')) return;

    const touch = e.touches[0];
    const dx = touch.clientX - g.startX;
    const dy = touch.clientY - g.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (!g.mode && (absDx > 18 || absDy > 18)) {
      clearTimeout(longPressTimerRef.current);
      g.mode = absDx > absDy ? 'seek' : (g.side === 'right' ? 'volume' : 'brightness');
    }

    const video = videoRef.current;
    const wrapper = wrapperRef.current;
    if (!video || !wrapper) return;

    if (g.mode === 'seek') {
      e.preventDefault();
      if (!video.duration) return;
      const rect = wrapper.getBoundingClientRect();
      const deltaSeconds = (dx / rect.width) * 90;
      const preview = Math.max(0, Math.min(video.duration, g.startVideoTime + deltaSeconds));
      g.previewTime = preview;
      renderPlayerClock(preview, video.duration);
      setControlsVisible(true);
      setOsd({ type: 'seek', value: preview, delta: Math.round(preview - g.startVideoTime), x: 50 });
    } else if (g.mode === 'volume') {
      e.preventDefault();
      const rect = wrapper.getBoundingClientRect();
      const nextVolume = Math.max(0, Math.min(1, g.startVolume - dy / rect.height));
      video.volume = nextVolume;
      video.muted = nextVolume === 0;
      setVolume(nextVolume);
      setMuted(nextVolume === 0);
      setControlsVisible(true);
      setOsd({ type: 'volume', value: Math.round(nextVolume * 100), x: 75 });
    } else if (g.mode === 'brightness') {
      e.preventDefault();
      const rect = wrapper.getBoundingClientRect();
      const nextBrightness = Math.max(0.25, Math.min(1, g.startBrightness - dy / rect.height));
      brightnessRef.current = nextBrightness;
      if (brightnessLayerRef.current) {
        brightnessLayerRef.current.style.opacity = String(Math.max(0, 1 - nextBrightness));
      }
      setControlsVisible(true);
      setOsd({ type: 'brightness', value: Math.round(nextBrightness * 100), x: 25 });
    }
  }, [renderPlayerClock]);

  const finishTouchGesture = useCallback((e) => {
    const g = gestureRef.current;
    if (!g) return;

    clearTimeout(longPressTimerRef.current);
    const video = videoRef.current;

    if (g.mode === 'speed') {
      if (video) video.playbackRate = 1;
      stopReverseSpeed();
      showGestureOsd({ type: 'speed', value: 1, x: 86 }, 350);
      gestureRef.current = null;
      clickSuppressUntilRef.current = Date.now() + 900;
      return;
    }

    if (g.mode === 'seek') {
      if (video && g.previewTime != null) {
        video.currentTime = g.previewTime;
        renderPlayerClock(video.currentTime, video.duration || 0);
      }
      showControls();
      setOsd(null);
      gestureRef.current = null;
      clickSuppressUntilRef.current = Date.now() + 900;
      return;
    }

    if (g.mode === 'volume' || g.mode === 'brightness') {
      clearTimeout(osdTimerRef.current);
      osdTimerRef.current = setTimeout(() => setOsd(null), 650);
      gestureRef.current = null;
      clickSuppressUntilRef.current = Date.now() + 900;
      return;
    }

    const elapsed = Date.now() - g.time;
    const ct = e.changedTouches?.[0];
    const dx = ct ? Math.abs(ct.clientX - g.startX) : 0;
    const dy = ct ? Math.abs(ct.clientY - g.startY) : 0;

    if (elapsed < 300 && dx < 15 && dy < 15) {
      const now = Date.now();
      const last = lastTapRef.current;
      if (last.side === g.side && now - last.time < 350) {
        const delta = g.side === 'left' ? -5 : 5;
        const total = (last.total || 0) + delta;
        lastTapRef.current = { time: now, side: g.side, total };
        clickSuppressUntilRef.current = now + 900;
        seekBy(delta);
        showGestureOsd({ type: 'skip', value: total, x: g.side === 'left' ? 25 : 75 }, 650);
      } else {
        lastTapRef.current = { time: now, side: g.side, total: 0 };
        clickSuppressUntilRef.current = now + 900;
        hideOrShowControls();
      }
    }

    gestureRef.current = null;
  }, [hideOrShowControls, renderPlayerClock, seekBy, showControls, showGestureOsd]);

  const handleTouchEnd = useCallback((e) => {
    finishTouchGesture(e);
  }, [finishTouchGesture]);

  const handleTouchCancel = useCallback(() => {
    const g = gestureRef.current;
    clearTimeout(longPressTimerRef.current);

    if (videoRef.current) videoRef.current.playbackRate = 1;
    stopReverseSpeed();
    if (g?.mode === 'speed') {
      showGestureOsd({ type: 'speed', value: 1, x: 86 }, 350);
    }

    gestureRef.current = null;
    clickSuppressUntilRef.current = Date.now() + 900;
  }, [showGestureOsd, stopReverseSpeed]);

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
    const endKeyboardSpeed = (key) => {
      if (key !== activeSpeedKeyRef.current) return;
      clearTimeout(keyHoldTimerRef.current);
      keyHoldTimerRef.current = null;

      const video = videoRef.current;
      const wasSpeeding = video && (video.playbackRate !== 1 || reverseSpeedTimerRef.current);
      activeSpeedKeyRef.current = null;

      if (wasSpeeding) {
        video.playbackRate = 1;
        stopReverseSpeed();
        showGestureOsd({ type: 'speed', value: 1, x: 86 }, 350);
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const now = Date.now();
        const last = lastArrowTapRef.current;
        const delta = key === 'ArrowLeft' ? -5 : 5;
        const total = last.key === key && now - last.time < 650
          ? (last.total || 0) + delta
          : delta;
        lastArrowTapRef.current = { time: now, key, total };
        seekBy(delta);
        showGestureOsd({ type: 'skip', value: total, x: key === 'ArrowLeft' ? 25 : 75 }, 650);
      }
    };

    const onKey = (e) => {
      const target = e.target;
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          (target.tagName === "INPUT" && target.type !== "range"));

      if (isTypingTarget)
        return;
      const video = videoRef.current;
      if (!video) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft": {
          e.preventDefault();
          if (!e.repeat) {
            clearTimeout(keyHoldTimerRef.current);
            activeSpeedKeyRef.current = e.key;
            keyHoldTimerRef.current = setTimeout(() => {
              if (activeSpeedKeyRef.current !== e.key || !videoRef.current) return;
              startReverseSpeed();
            }, 260);
          } else if (activeSpeedKeyRef.current === e.key && !reverseSpeedTimerRef.current) {
            clearTimeout(keyHoldTimerRef.current);
            startReverseSpeed();
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (!e.repeat) {
            clearTimeout(keyHoldTimerRef.current);
            activeSpeedKeyRef.current = e.key;
            keyHoldTimerRef.current = setTimeout(() => {
              if (activeSpeedKeyRef.current !== e.key || !videoRef.current) return;
              startForwardSpeed();
            }, 260);
          } else if (activeSpeedKeyRef.current === e.key && video.playbackRate !== 5) {
            clearTimeout(keyHoldTimerRef.current);
            startForwardSpeed();
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const nextVolume = Math.min(1, Math.round((video.volume + 0.05) * 100) / 100);
          video.volume = nextVolume;
          video.muted = nextVolume === 0;
          showGestureOsd({ type: 'volume', value: Math.round(nextVolume * 100), x: 75 }, 650);
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const nextVolume = Math.max(0, Math.round((video.volume - 0.05) * 100) / 100);
          video.volume = nextVolume;
          video.muted = nextVolume === 0;
          showGestureOsd({ type: 'volume', value: Math.round(nextVolume * 100), x: 75 }, 650);
          break;
        }
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          video.muted = !video.muted;
          setMuted(video.muted);
          showGestureOsd({ type: 'volume', value: video.muted ? 0 : Math.round(video.volume * 100), x: 75 }, 650);
          break;
      }
    };
    const onKeyUp = (e) => endKeyboardSpeed(e.key);
    const onBlur = () => endKeyboardSpeed(activeSpeedKeyRef.current);

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      endKeyboardSpeed(activeSpeedKeyRef.current);
    };
  }, [seekBy, showGestureOsd, startForwardSpeed, startReverseSpeed, stopReverseSpeed, toggleFullscreen, togglePlay]);

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
          className={`player-wrapper ${controlsVisible ? "controls-visible" : "controls-hidden"} ${playing ? "is-playing" : ""}`}
          ref={wrapperRef}
          onMouseMove={() => {
            if (!window.matchMedia?.('(hover: none)').matches) showControls();
          }}
          onMouseLeave={() => {
            if (!videoRef.current?.paused) setControlsVisible(false);
          }}
        >
          {/* Video rendered FIRST so touch layer sits above it */}
          <video ref={videoRef} className="player-video" playsInline />
          <div ref={brightnessLayerRef} className="player-brightness-layer" />

          {/* Touch capture layer — sits above video, below controls. Handles ALL gestures */}
          <div
            className="player-touch-layer"
            onClick={() => {
              if (Date.now() < clickSuppressUntilRef.current) return;
              hideOrShowControls();
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
          />

          {/* Player gesture and keyboard feedback */}
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
                  <span>{osd.value > 0 ? '+' : ''}{osd.value}s</span>
                </>
              )}
              {osd.type === 'seek' && (
                <>
                  <span>{fmtTime(osd.value)}</span>
                  <span className="player-osd-sub">{osd.delta > 0 ? '+' : ''}{osd.delta}s</span>
                </>
              )}
              {osd.type === 'volume' && (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {osd.value === 0 ? (
                      <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="22" y1="9" x2="16" y2="15" />
                        <line x1="16" y1="9" x2="22" y2="15" />
                      </>
                    ) : (
                      <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                        <path d="M19 5a10 10 0 0 1 0 14" />
                      </>
                    )}
                  </svg>
                  <span className="player-osd-sub">{osd.value}%</span>
                </>
              )}
              {osd.type === 'brightness' && (
                <>
                  <span>Độ sáng</span>
                  <span className="player-osd-sub">{osd.value}%</span>
                </>
              )}
              {osd.type === 'speed' && (
                <span>X{osd.value}</span>
              )}
            </div>
          )}

          {introSkip && (
            <button
              className={`player-skip-intro ${showIntroSkip ? "visible" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                const video = videoRef.current;
                if (!video) return;
                video.currentTime = Math.min(
                  video.duration || introSkip.end,
                  introSkip.end + 0.25
                );
                setShowIntroSkip(false);
              }}
              title="Bỏ qua intro"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 4 15 12 5 20 5 4"/>
                <line x1="19" y1="5" x2="19" y2="19"/>
              </svg>
              Bỏ qua Intro
            </button>
          )}

          {showAdSkip && (
            <button
              className="player-skip-ad active"
              onClick={(e) => {
                e.stopPropagation();
                const video = videoRef.current;
                if (!video) return;
                const activeAd = getActiveAdSegment(video.currentTime);
                if (!activeAd) return;
                const targetTime = Math.min(video.duration, video.currentTime + AD_SKIP_SECONDS);
                video.currentTime = targetTime;
                lastAdSkipRef.current = targetTime;
                setShowAdSkip(false);
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
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                seekFromClientX(e.currentTarget, e.clientX);
                showControls();
              }}
              onPointerMove={(e) => {
                if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
                e.stopPropagation();
                e.preventDefault();
                seekFromClientX(e.currentTarget, e.clientX);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                e.currentTarget.releasePointerCapture?.(e.pointerId);
                seekFromClientX(e.currentTarget, e.clientX);
                showControls();
              }}
              onPointerCancel={(e) => {
                e.currentTarget.releasePointerCapture?.(e.pointerId);
              }}
            >
              <div
                className="player-progress-fill"
                ref={progressFillRef}
              />
              <div
                className="player-progress-handle"
                ref={progressHandleRef}
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
                    }}
                  />
                </div>
                <div className="player-time" ref={timeDisplayRef} />
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
