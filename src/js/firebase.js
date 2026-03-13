// === Firebase Configuration ===
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: 'AIzaSyB_jCaqK8TwwuzmyumNSQkDdEesz6RryK8',
  authDomain: 'animefetish-6f591.firebaseapp.com',
  projectId: 'animefetish-6f591',
  storageBucket: 'animefetish-6f591.firebasestorage.app',
  messagingSenderId: '394565940756',
  appId: '1:394565940756:web:fbf02e94022aaa0d58d901',
  measurementId: 'G-XDG8LGGGYK',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Lazy-init Firestore — only connect when needed
let _db = null;
export function getDb() {
  if (!_db) {
    _db = getFirestore(app);
  }
  return _db;
}

// Suppress uncatchable Firestore internal assertion errors (SDK bug when rules reject)
window.addEventListener('error', (e) => {
  if (e.message?.includes('FIRESTORE') && e.message?.includes('INTERNAL ASSERTION FAILED')) {
    e.preventDefault();
  }
});
