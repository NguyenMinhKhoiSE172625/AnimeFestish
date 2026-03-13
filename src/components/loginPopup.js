// === Login Popup Component ===
import { loginWithGoogle, loginWithEmail, registerWithEmail, onUserChange } from '../js/auth.js';

let isRegisterMode = false;

export function renderLoginPopup() {
  // Avoid duplicate
  if (document.getElementById('login-popup-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'login-popup-overlay';
  overlay.className = 'login-overlay';
  overlay.innerHTML = `
    <div class="login-popup">
      <button class="login-close" id="login-close">&times;</button>
      <div class="login-header">
        <img src="/Gemini_Generated_Image_l00nrdl00nrdl00n-removebg-preview.png" alt="Logo" class="login-logo" />
        <h2 class="login-title">AnimeFetish</h2>
        <p class="login-subtitle" id="login-subtitle">Đăng nhập để bình luận & lưu tiến trình</p>
      </div>

      <div class="login-error" id="login-error"></div>

      <form class="login-form" id="login-form">
        <div class="login-field" id="name-field" style="display:none">
          <label for="login-name">Tên hiển thị</label>
          <div class="login-input-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <input type="text" id="login-name" placeholder="Nhập tên của bạn" autocomplete="name" />
          </div>
        </div>
        <div class="login-field">
          <label for="login-email">Email</label>
          <div class="login-input-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <input type="email" id="login-email" placeholder="your@email.com" autocomplete="email" required />
          </div>
        </div>
        <div class="login-field">
          <label for="login-password">Mật khẩu</label>
          <div class="login-input-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password" required minlength="6" />
          </div>
        </div>
        <button type="submit" class="login-submit" id="login-submit">
          <span id="login-submit-text">Đăng nhập</span>
          <div class="login-spinner" id="login-spinner"></div>
        </button>
      </form>

      <p class="login-toggle">
        <span id="login-toggle-text">Chưa có tài khoản?</span>
        <button type="button" id="login-toggle-btn">Tạo tài khoản</button>
      </p>

      <div class="login-divider">
        <span>hoặc</span>
      </div>

      <button class="login-google" id="login-google-btn">
        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.9 33 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.2-2.7-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.3 16 18.8 13 24 13c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.4 0-9.9-3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.7 39.5 44 34 44 24c0-1.3-.2-2.7-.4-3.9z"/></svg>
        Đăng nhập với Google
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Auto-close when user logs in (covers Google popup + any method)
  const unsubAuth = onUserChange((user) => {
    if (user && document.getElementById('login-popup-overlay')) {
      close();
    }
  });

  // Close handlers
  const close = () => {
    unsubAuth();
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 250);
  };

  document.getElementById('login-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  });

  // Toggle register/login mode
  document.getElementById('login-toggle-btn').addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    const nameField = document.getElementById('name-field');
    const subtitle = document.getElementById('login-subtitle');
    const submitText = document.getElementById('login-submit-text');
    const toggleText = document.getElementById('login-toggle-text');
    const toggleBtn = document.getElementById('login-toggle-btn');

    if (isRegisterMode) {
      nameField.style.display = '';
      subtitle.textContent = 'Tạo tài khoản mới';
      submitText.textContent = 'Đăng ký';
      toggleText.textContent = 'Đã có tài khoản?';
      toggleBtn.textContent = 'Đăng nhập';
    } else {
      nameField.style.display = 'none';
      subtitle.textContent = 'Đăng nhập để bình luận & lưu tiến trình';
      submitText.textContent = 'Đăng nhập';
      toggleText.textContent = 'Chưa có tài khoản?';
      toggleBtn.textContent = 'Tạo tài khoản';
    }
    clearError();
  });

  // Form submit
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const name = document.getElementById('login-name').value.trim();

    if (!email || !password) return;
    if (isRegisterMode && !name) {
      showError('Vui lòng nhập tên hiển thị');
      return;
    }

    setLoading(true);
    clearError();

    try {
      if (isRegisterMode) {
        await registerWithEmail(email, password, name);
      } else {
        await loginWithEmail(email, password);
      }
      close();
    } catch (err) {
      showError(getFirebaseErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  });

  // Google login
  document.getElementById('login-google-btn').addEventListener('click', async () => {
    clearError();
    const googleBtn = document.getElementById('login-google-btn');
    googleBtn.disabled = true;
    googleBtn.style.opacity = '0.6';
    try {
      await loginWithGoogle();
      // close() is handled by onUserChange listener above
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // User closed popup, no error needed
      } else {
        showError(getFirebaseErrorMessage(err.code));
      }
    } finally {
      if (googleBtn) {
        googleBtn.disabled = false;
        googleBtn.style.opacity = '';
      }
    }
  });

  function setLoading(loading) {
    const btn = document.getElementById('login-submit');
    const text = document.getElementById('login-submit-text');
    const spinner = document.getElementById('login-spinner');
    if (!btn || !text || !spinner) return;
    if (loading) {
      btn.disabled = true;
      text.style.display = 'none';
      spinner.style.display = 'block';
    } else {
      btn.disabled = false;
      text.style.display = '';
      spinner.style.display = 'none';
    }
  }

  function showError(msg) {
    const el = document.getElementById('login-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  function clearError() {
    const el = document.getElementById('login-error');
    if (!el) return;
    el.textContent = '';
    el.style.display = 'none';
  }
}

export function closeLoginPopup() {
  const overlay = document.getElementById('login-popup-overlay');
  if (overlay) {
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 250);
  }
}

function getFirebaseErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'Email này đã được sử dụng',
    'auth/invalid-email': 'Email không hợp lệ',
    'auth/user-not-found': 'Không tìm thấy tài khoản với email này',
    'auth/wrong-password': 'Mật khẩu không đúng',
    'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự',
    'auth/too-many-requests': 'Quá nhiều lần thử. Vui lòng thử lại sau',
    'auth/invalid-credential': 'Email hoặc mật khẩu không đúng',
    'auth/network-request-failed': 'Lỗi kết nối mạng',
    'auth/popup-blocked': 'Popup bị chặn. Hãy cho phép popup cho trang này',
    'auth/internal-error': 'Lỗi hệ thống. Vui lòng thử lại sau',
  };
  return messages[code] || 'Đã có lỗi xảy ra. Vui lòng thử lại';
}
