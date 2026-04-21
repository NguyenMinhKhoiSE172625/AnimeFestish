import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB_jCaqK8TwwuzmyumNSQkDdEesz6RryK8",
  authDomain: "animefetish-6f591.firebaseapp.com",
  projectId: "animefetish-6f591",
  storageBucket: "animefetish-6f591.firebasestorage.app",
  messagingSenderId: "394565940756",
  appId: "1:394565940756:web:fbf02e94022aaa0d58d901",
  measurementId: "G-XDG8LGGGYK",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const PROJECT_ID = firebaseConfig.projectId;
