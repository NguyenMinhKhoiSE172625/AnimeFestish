import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Layout } from "@/components/layout/Layout.jsx";
import { PageLoader } from "@/components/ui/PageLoader.jsx";

const HomePage = lazy(() => import("@/pages/HomePage.jsx"));
const AnimePage = lazy(() => import("@/pages/AnimePage.jsx"));
const DetailPage = lazy(() => import("@/pages/DetailPage.jsx"));
const WatchPage = lazy(() => import("@/pages/WatchPage.jsx"));
const SearchPage = lazy(() => import("@/pages/SearchPage.jsx"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage.jsx"));
const TermsPage = lazy(() => import("@/pages/TermsPage.jsx"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage.jsx"));

export function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="anime" element={<AnimePage />} />
          <Route path="anime/:slug" element={<DetailPage />} />
          <Route path="watch/:slug/:ep" element={<WatchPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="search/:keyword" element={<SearchPage />} />
          <Route path="category/:category" element={<AnimePage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
