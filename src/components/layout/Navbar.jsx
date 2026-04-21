import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, logout } from "@/lib/auth.jsx";
import { searchAnime, resolveItemImage } from "@/lib/api.js";
import { LoginPopup } from "@/features/auth/components/LoginPopup.jsx";

const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
  { to: "/anime", label: "Anime" },
  { to: "/category/hanh-dong", label: "Hành Động" },
  { to: "/category/tinh-cam", label: "Tình Cảm" },
  { to: "/category/vien-tuong", label: "Viễn Tưởng" },
];

export function Navbar() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const searchRef = useRef(null);
  const suggestTimer = useRef(null);
  const suggestIdRef = useRef(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setSuggestions([]);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchOpen]);

  const handleSearch = useCallback(
    (e) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (q) {
        navigate(`/search/${encodeURIComponent(q)}`);
        setSearchOpen(false);
        setSuggestions([]);
      }
    },
    [searchQuery, navigate]
  );

  const handleSearchInput = useCallback((val) => {
    setSearchQuery(val);
    clearTimeout(suggestTimer.current);
    if (val.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      const id = ++suggestIdRef.current;
      try {
        const data = await searchAnime(val.trim(), 1);
        if (id !== suggestIdRef.current) return;
        const items = (data.items || []).filter(i => i.type === "hoathinh").slice(0, 6);
        setSuggestions(items);
      } catch {
        if (id === suggestIdRef.current) setSuggestions([]);
      }
    }, 400);
  }, []);

  const isActive = (to) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  };

  return (
    <>
      <nav className={`navbar ${scrolled ? "scrolled" : ""}`} id="nav">
        <div className="navbar-inner">
          <Link to="/" className="navbar-logo">
            <span className="navbar-logo-mark" aria-hidden="true">
              <img
                src="/Gemini_Generated_Image_l00nrdl00nrdl00n-removebg-preview.png"
                alt="Logo"
                className="navbar-logo-img"
              />
            </span>
            <span className="navbar-logo-text">AnimeFetish</span>
          </Link>

          <div className={`navbar-links ${mobileOpen ? "mobile-open" : ""}`}>
            {mobileOpen && (
              <div className="mobile-search-bar">
                <svg
                  className="mobile-search-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <form onSubmit={handleSearch}>
                  <input
                    type="text"
                    className="mobile-search-input"
                    placeholder="Tìm anime..."
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    autoComplete="off"
                  />
                </form>
              </div>
            )}
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link ${isActive(link.to) ? "active" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="navbar-actions">
            <div
              className={`navbar-search ${searchOpen ? "open" : ""}`}
              ref={searchRef}
            >
              <button
                className="navbar-search-btn"
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  if (searchOpen) setSuggestions([]);
                }}
                aria-label="Tim kiem"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </button>
              {searchOpen && (
                <form onSubmit={handleSearch}>
                  <input
                    type="text"
                    placeholder="Tìm anime..."
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    autoFocus
                    autoComplete="off"
                  />
                </form>
              )}
              <AnimatePresence>
                {suggestions.length > 0 && searchOpen && (
                  <motion.div
                    className="search-suggestions"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {suggestions.map((item) => (
                      <button
                        key={item.slug}
                        className="search-suggest-item"
                        onClick={() => {
                          navigate(`/anime/${item.slug}`);
                          setSearchOpen(false);
                          setSuggestions([]);
                          setSearchQuery("");
                        }}
                      >
                        <img
                          src={resolveItemImage(item)}
                          alt={item.name}
                          className="search-suggest-thumb"
                        />
                        <div className="search-suggest-info">
                          <span className="search-suggest-title">{item.name}</span>
                          <span className="search-suggest-meta">
                            {item.year}
                            {item.quality ? ` • ${item.quality}` : ""}
                          </span>
                        </div>
                      </button>
                    ))}
                    <button
                      className="search-suggest-viewall"
                      onClick={() => {
                        navigate(
                          `/search/${encodeURIComponent(searchQuery.trim())}`
                        );
                        setSearchOpen(false);
                        setSuggestions([]);
                      }}
                    >
                      Xem tất cả kết quả
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {user ? (
              <div className="navbar-user">
                <img
                  src={
                    user.photoURL ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "U")}&background=ff2d78&color=fff&size=32`
                  }
                  alt={user.displayName || "User"}
                  className="navbar-avatar"
                />
                <button className="navbar-logout-btn" onClick={logout}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowLogin(true)}
              >
                Đăng nhập
              </button>
            )}

            <button
              className="navbar-mobile-btn"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              <AnimatePresence mode="wait">
                {mobileOpen ? (
                  <motion.svg
                    key="close"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </motion.svg>
                ) : (
                  <motion.svg
                    key="menu"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="18" y2="12" />
                    <line x1="3" y1="18" x2="15" y2="18" />
                  </motion.svg>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="mobile-nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogin && <LoginPopup onClose={() => setShowLogin(false)} />}
      </AnimatePresence>
    </>
  );
}
