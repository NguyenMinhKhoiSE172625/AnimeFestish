import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/lib/auth.jsx";
import { App } from "@/app/App.jsx";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary.jsx";
import "@/styles/index.css";

const root = document.getElementById("app");

const seoFallback = document.getElementById("seo-fallback");
if (seoFallback) seoFallback.remove();

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);

const INTRO_MIN_MS = 300;
const introStart = performance.now();
window.addEventListener("load", () => {
  const elapsed = performance.now() - introStart;
  const remaining = Math.max(0, INTRO_MIN_MS - elapsed);
  setTimeout(() => {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
      overlay.classList.add("hidden");
      setTimeout(() => overlay.remove(), 400);
    }
  }, remaining);
});
