import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar.jsx";
import { Footer } from "./Footer.jsx";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current || document;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    const observe = () => {
      root.querySelectorAll(".section:not(.in-view)").forEach((el) => io.observe(el));
    };
    observe();
    const mo = new MutationObserver(observe);
    mo.observe(root, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
  return ref;
}

export function Layout() {
  const location = useLocation();
  const contentRef = useScrollReveal();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1} ref={contentRef}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </>
  );
}
