import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/use-seo.js";

export default function NotFoundPage() {
  useSEO({ title: "Khong tim thay trang" });

  return (
    <section className="empty-state notfound-state">
      <div className="empty-state-icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.5"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <div className="empty-state-text">
        Khong tim thay trang ban dang mo
      </div>
      <p className="notfound-hint">
        Lien ket co the da thay doi hoac noi dung khong con kha dung.
      </p>
      <div className="notfound-actions">
        <Link to="/" className="btn btn-primary">
          Ve trang chu
        </Link>
        <Link to="/search" className="btn btn-outline">
          Di toi tim kiem
        </Link>
      </div>
    </section>
  );
}
