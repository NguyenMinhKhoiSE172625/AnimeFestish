// === Firestore Comments Component (REST API) ===
import { auth } from '../js/firebase.js';
import { getUser, onUserChange } from '../js/auth.js';
import { renderLoginPopup } from './loginPopup.js';

const PROJECT_ID = 'animefetish-6f591';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

async function fetchComments(slug) {
  const url = `${BASE_URL}/comments/${slug}/messages?orderBy=createdAt%20desc`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Firestore read failed: ${res.status}`);
  }
  const data = await res.json();
  if (!data.documents) return [];
  return data.documents.map(doc => {
    const fields = doc.fields || {};
    const docId = doc.name.split('/').pop();
    return {
      id: docId,
      uid: fields.uid?.stringValue || '',
      displayName: fields.displayName?.stringValue || '',
      photoURL: fields.photoURL?.stringValue || '',
      text: fields.text?.stringValue || '',
      createdAt: fields.createdAt?.timestampValue ? new Date(fields.createdAt.timestampValue) : null,
    };
  });
}

async function postComment(slug, comment) {
  const token = await getIdToken();
  if (!token) throw new Error('Not authenticated');
  const url = `${BASE_URL}/comments/${slug}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        uid: { stringValue: comment.uid },
        displayName: { stringValue: comment.displayName },
        photoURL: { stringValue: comment.photoURL },
        text: { stringValue: comment.text },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Write failed: ${res.status}`);
  }
}

async function removeComment(slug, docId) {
  const token = await getIdToken();
  if (!token) throw new Error('Not authenticated');
  const url = `${BASE_URL}/comments/${slug}/messages/${docId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export function renderComments(container, slug) {
  container.innerHTML = `
    <div class="comments-section">
      <h2 class="episodes-title">B\u00ecnh lu\u1eadn</h2>
      <div class="comment-form-area" id="comment-form-area"></div>
      <div class="comment-list" id="comment-list">
        <div class="comment-loading">\u0110ang t\u1ea3i b\u00ecnh lu\u1eadn...</div>
      </div>
    </div>
  `;

  const formArea = container.querySelector('#comment-form-area');
  const listEl = container.querySelector('#comment-list');

  async function loadComments() {
    try {
      const comments = await fetchComments(slug);

      if (comments.length === 0) {
        listEl.innerHTML = `
          <div class="comment-empty">
            <span>\ud83d\udcac</span>
            <p>Ch\u01b0a c\u00f3 b\u00ecnh lu\u1eadn n\u00e0o. H\u00e3y l\u00e0 ng\u01b0\u1eddi \u0111\u1ea7u ti\u00ean!</p>
          </div>
        `;
        return;
      }

      const currentUid = getUser()?.uid;
      listEl.innerHTML = comments.map(c => {
        const time = c.createdAt ? formatTime(c.createdAt) : 'V\u1eeba xong';
        const initial = (c.displayName || '?').charAt(0).toUpperCase();
        const isOwn = currentUid && c.uid === currentUid;

        return `
          <div class="comment-item" data-id="${c.id}">
            ${c.photoURL
              ? `<img class="comment-avatar" src="${c.photoURL}" alt="${c.displayName}" referrerpolicy="no-referrer" />`
              : `<div class="comment-avatar comment-avatar-initial">${initial}</div>`}
            <div class="comment-body">
              <div class="comment-header">
                <span class="comment-name">${escapeHtml(c.displayName)}</span>
                <span class="comment-time">${time}</span>
                ${isOwn ? `<button class="comment-delete" data-doc-id="${c.id}" title="X\u00f3a">\u2715</button>` : ''}
              </div>
              <p class="comment-text">${escapeHtml(c.text)}</p>
            </div>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.comment-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          const docId = btn.dataset.docId;
          if (confirm('X\u00f3a b\u00ecnh lu\u1eadn n\u00e0y?')) {
            try {
              await removeComment(slug, docId);
              await loadComments();
            } catch (err) {
              console.error('Delete comment error:', err);
            }
          }
        });
      });
    } catch (err) {
      console.error('Load comments error:', err);
      listEl.innerHTML = `<div class="comment-empty"><p>L\u1ed7i t\u1ea3i b\u00ecnh lu\u1eadn</p></div>`;
    }
  }

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
            <textarea class="comment-input" id="comment-input" placeholder="Vi\u1ebft b\u00ecnh lu\u1eadn..." rows="1"></textarea>
            <button class="comment-send" id="comment-send" disabled>G\u1eedi</button>
          </div>
        </div>
      `;

      const input = formArea.querySelector('#comment-input');
      const sendBtn = formArea.querySelector('#comment-send');

      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        sendBtn.disabled = !input.value.trim();
      });

      const submit = async () => {
        const text = input.value.trim();
        if (!text) return;
        sendBtn.disabled = true;
        input.value = '';
        input.style.height = 'auto';

        try {
          await postComment(slug, {
            uid: user.uid,
            displayName: user.displayName || user.email || 'User',
            photoURL: user.photoURL || '',
            text,
          });
          await loadComments();
        } catch (err) {
          console.error('Comment send error:', err);
          input.value = text;
          sendBtn.disabled = false;
          alert('G\u1eedi b\u00ecnh lu\u1eadn th\u1ea5t b\u1ea1i: ' + err.message);
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
          <span>\u0110\u0103ng nh\u1eadp \u0111\u1ec3 b\u00ecnh lu\u1eadn</span>
          <button class="btn-login" id="comment-login-btn">\u0110\u0103ng nh\u1eadp</button>
        </div>
      `;
      formArea.querySelector('#comment-login-btn').addEventListener('click', () => {
        renderLoginPopup();
      });
    }
  };

  const unsubAuth = onUserChange(renderForm);
  loadComments();

  return () => {
    unsubAuth();
  };
}

function formatTime(date) {
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return 'V\u1eeba xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} ph\u00fat tr\u01b0\u1edbc`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} gi\u1edd tr\u01b0\u1edbc`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ng\u00e0y tr\u01b0\u1edbc`;
  return date.toLocaleDateString('vi-VN');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
