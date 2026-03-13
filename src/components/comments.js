// === Firestore Comments Component ===
import { getDb, terminateDb } from '../js/firebase.js';
import { getUser, onUserChange } from '../js/auth.js';
import { renderLoginPopup } from './loginPopup.js';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
} from 'firebase/firestore';

let unsubscribe = null;

export function renderComments(container, slug) {
  // Cleanup previous listener
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  container.innerHTML = `
    <div class="comments-section">
      <h2 class="episodes-title">Bình luận</h2>
      <div class="comment-form-area" id="comment-form-area"></div>
      <div class="comment-list" id="comment-list">
        <div class="comment-loading">Đang tải bình luận...</div>
      </div>
    </div>
  `;

  const formArea = container.querySelector('#comment-form-area');
  const listEl = container.querySelector('#comment-list');

  // Auth-aware form
  const renderForm = (user) => {
    if (user) {
      const photo = user.photoURL || '';
      const name = user.displayName || user.email || 'User';
      const initial = name.charAt(0).toUpperCase();
      formArea.innerHTML = `
        <div class="comment-compose">
          ${photo
            ? `<img class="comment-avatar" src="${photo}" alt="${name}" referrerpolicy="no-referrer" />`
            : `<div class="comment-avatar comment-avatar-initial">${initial}</div>`}
          <div class="comment-input-area">
            <textarea class="comment-input" id="comment-input" placeholder="Viết bình luận..." rows="1"></textarea>
            <button class="comment-send" id="comment-send" disabled>Gửi</button>
          </div>
        </div>
      `;

      const input = formArea.querySelector('#comment-input');
      const sendBtn = formArea.querySelector('#comment-send');

      // Auto-resize textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        sendBtn.disabled = !input.value.trim();
      });

      // Submit
      const submit = async () => {
        const text = input.value.trim();
        if (!text) return;
        sendBtn.disabled = true;
        input.value = '';
        input.style.height = 'auto';

        try {
          const db = getDb();
          await addDoc(collection(db, 'comments', slug, 'messages'), {
            uid: user.uid,
            displayName: user.displayName || user.email || 'User',
            photoURL: user.photoURL || '',
            text,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.error('Comment send error:', err);
          input.value = text;
          sendBtn.disabled = false;
        }
      };

      sendBtn.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submit();
        }
      });
    } else {
      formArea.innerHTML = `
        <div class="comment-login-prompt">
          <span>Đăng nhập để bình luận</span>
          <button class="btn-login" id="comment-login-btn">Đăng nhập</button>
        </div>
      `;
      formArea.querySelector('#comment-login-btn').addEventListener('click', () => {
        renderLoginPopup();
      });
    }
  };

  // Listen to auth changes
  const unsubAuth = onUserChange(renderForm);

  // Real-time comments
  try {
    const db = getDb();
    const commentsRef = collection(db, 'comments', slug, 'messages');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        listEl.innerHTML = `
          <div class="comment-empty">
            <span>💬</span>
            <p>Chưa có bình luận nào. Hãy là người đầu tiên!</p>
          </div>
        `;
        return;
      }

      const currentUid = getUser()?.uid;
      listEl.innerHTML = snapshot.docs.map(docSnap => {
        const c = docSnap.data();
        const time = c.createdAt ? formatTime(c.createdAt.toDate()) : 'Vừa xong';
        const initial = (c.displayName || '?').charAt(0).toUpperCase();
        const isOwn = currentUid && c.uid === currentUid;

        return `
          <div class="comment-item" data-id="${docSnap.id}">
            ${c.photoURL
              ? `<img class="comment-avatar" src="${c.photoURL}" alt="${c.displayName}" referrerpolicy="no-referrer" />`
              : `<div class="comment-avatar comment-avatar-initial">${initial}</div>`}
            <div class="comment-body">
              <div class="comment-header">
                <span class="comment-name">${escapeHtml(c.displayName)}</span>
                <span class="comment-time">${time}</span>
                ${isOwn ? `<button class="comment-delete" data-doc-id="${docSnap.id}" title="Xóa">✕</button>` : ''}
              </div>
              <p class="comment-text">${escapeHtml(c.text)}</p>
            </div>
          </div>
        `;
      }).join('');

      // Delete handlers
      listEl.querySelectorAll('.comment-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          const docId = btn.dataset.docId;
          if (confirm('Xóa bình luận này?')) {
            try {
              const db = getDb();
              await deleteDoc(doc(db, 'comments', slug, 'messages', docId));
            } catch (err) {
              console.error('Delete comment error:', err);
            }
          }
        });
      });
    }, (err) => {
      console.error('Comments listener error:', err);
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      terminateDb();
      listEl.innerHTML = `<div class="comment-empty"><p>Lỗi tải bình luận</p></div>`;
    });
  } catch (err) {
    console.error('Firestore init error:', err);
    listEl.innerHTML = `<div class="comment-empty"><p>Không thể tải bình luận</p></div>`;
  }

  // Return cleanup function
  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    unsubAuth();
  };
}

function formatTime(date) {
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
