const STORAGE_KEY = "aniviet_watch_history";
const PROFILE_KEY = "aniviet_current_profile";

export function getProfiles() {
  try {
    return JSON.parse(localStorage.getItem("aniviet_profiles")) || [
      "Mặc định",
    ];
  } catch {
    return ["Mặc định"];
  }
}

export function addProfile(name) {
  const profiles = getProfiles();
  if (!profiles.includes(name)) {
    profiles.push(name);
    localStorage.setItem("aniviet_profiles", JSON.stringify(profiles));
  }
}

export function getCurrentProfile() {
  return localStorage.getItem(PROFILE_KEY) || "Mặc định";
}

export function setCurrentProfile(name) {
  localStorage.setItem(PROFILE_KEY, name);
}

function getKey() {
  return `${STORAGE_KEY}_${getCurrentProfile()}`;
}

function getAllHistory() {
  try {
    return JSON.parse(localStorage.getItem(getKey())) || {};
  } catch {
    return {};
  }
}

function saveAllHistory(history) {
  localStorage.setItem(getKey(), JSON.stringify(history));
}

export function saveWatchProgress(
  slug,
  episodeName,
  episodeSlug,
  animeName,
  thumbUrl,
  currentTime = 0,
  duration = 0
) {
  const history = getAllHistory();
  history[slug] = {
    slug,
    animeName,
    thumbUrl,
    episodeName,
    episodeSlug,
    currentTime,
    duration,
    progress: duration > 0 ? Math.round((currentTime / duration) * 100) : 0,
    updatedAt: Date.now(),
  };
  saveAllHistory(history);
}

export function getWatchProgress(slug) {
  const history = getAllHistory();
  return history[slug] || null;
}

export function getWatchHistory() {
  const history = getAllHistory();
  return Object.values(history).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getContinueWatching(max = 20) {
  return getWatchHistory().slice(0, max);
}

export function removeFromHistory(slug) {
  const history = getAllHistory();
  delete history[slug];
  saveAllHistory(history);
}

export function clearHistory() {
  localStorage.removeItem(getKey());
}

export function formatTime(seconds) {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
