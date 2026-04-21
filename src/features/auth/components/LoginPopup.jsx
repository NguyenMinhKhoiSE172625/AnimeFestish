import { useState } from "react";
import { motion } from "framer-motion";
import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
} from "@/lib/auth.jsx";

export function LoginPopup({ onClose }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await registerWithEmail(email, password, name);
      } else {
        await loginWithEmail(email, password);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Dang nhap that bai");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await loginWithGoogle();
      onClose();
    } catch (err) {
      setError(err.message || "Dang nhap Google that bai");
    }
  };

  return (
    <motion.div
      className="login-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="login-popup"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <button className="login-close" onClick={onClose}>
          &times;
        </button>
        <div className="login-header">
          <img
            src="/Gemini_Generated_Image_l00nrdl00nrdl00n-removebg-preview.png"
            alt="Logo"
            className="login-logo"
          />
          <h2 className="login-title">AnimeFetish</h2>
          <p className="login-subtitle">
            {isRegister
              ? "Tạo tài khoản mới"
              : "Đăng nhập để bình luận & lưu tiến trình"}
          </p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="login-field">
              <label htmlFor="login-name">Tên hiển thị</label>
              <div className="login-input-wrap">
                <input
                  type="text"
                  id="login-name"
                  placeholder="Nhập tên của bạn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>
          )}
          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <div className="login-input-wrap">
              <input
                type="email"
                id="login-email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Mật khẩu</label>
            <div className="login-input-wrap">
              <input
                type="password"
                id="login-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
            </div>
          </div>
          <button className="btn btn-primary login-submit" disabled={loading}>
            {loading
              ? "Đang xử lý..."
              : isRegister
                ? "Tạo tài khoản"
                : "Đăng nhập"}
          </button>
        </form>

        <div className="login-divider">
          <span>hoặc</span>
        </div>

        <button className="btn btn-outline login-google" onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Tiếp tục với Google
        </button>

        <p className="login-toggle">
          {isRegister ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
          <button
            type="button"
            className="login-toggle-btn"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
          >
            {isRegister ? "Đăng nhập" : "Đăng ký"}
          </button>
        </p>
      </motion.div>
    </motion.div>
  );
}
