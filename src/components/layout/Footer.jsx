import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-logo-wrap">
          <div className="footer-logo">AnimeFetish</div>
          <p className="footer-desc">
            Nền tảng xem anime Nhật Bản vietsub miễn phí, tập trung vào tốc độ tải, trải nghiệm mượt và giao diện dễ dùng trên mọi thiết bị.
          </p>
        </div>
        <div className="footer-links" aria-label="Dieu huong nhanh">
          <Link to="/">Trang chủ</Link>
          <Link to="/anime">Thư viện anime</Link>
          <Link to="/category/hanh-dong">Thể loại hành động</Link>
          <Link to="/search">Tìm kiếm</Link>
          <Link to="/privacy">Quyền riêng tư</Link>
          <Link to="/terms">Điều khoản</Link>
        </div>
        <p className="footer-copy">
          &copy; {new Date().getFullYear()} AnimeFetish. Chỉ anime Nhật Bản.
        </p>
      </div>
    </footer>
  );
}
