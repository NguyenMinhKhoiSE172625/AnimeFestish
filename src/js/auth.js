// === Firebase Auth Module ===
import { auth } from './firebase.js';
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';

const googleProvider = new GoogleAuthProvider();

let currentUser = null;
const listeners = [];

export function getUser() {
  return currentUser;
}

export function onUserChange(callback) {
  listeners.push(callback);
  callback(currentUser);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifyListeners() {
  listeners.forEach(fn => fn(currentUser));
}

export async function loginWithGoogle() {
  await signInWithRedirect(auth, googleProvider);
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function registerWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

getRedirectResult(auth).catch(() => {});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  notifyListeners();
});
