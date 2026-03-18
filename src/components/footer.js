// === Footer Component ===

export function renderFooter() {
  const footer = document.getElementById('footer');
  footer.innerHTML = `
    <div class="footer">
      <div class="footer-inner">
        <div class="footer-logo-wrap">
          <div class="footer-logo">AnimeFetish</div>
          <p class="footer-desc">
            Nền tảng xem anime Nhật Bản vietsub miễn phí, tập trung vào tốc độ tải, trải nghiệm mượt và giao diện dễ dùng trên mọi thiết bị.
          </p>
        </div>
        <div class="footer-links" aria-label="Điều hướng nhanh">
          <a href="/">Trang chủ</a>
          <a href="/anime">Thư viện anime</a>
          <a href="/category/hanh-dong">Thể loại hành động</a>
          <a href="/search/">Tìm kiếm</a>
          <a href="/privacy">Quyền riêng tư</a>
          <a href="/terms">Điều khoản</a>
        </div>
        <p class="footer-copy">© ${new Date().getFullYear()} AnimeFetish. Chỉ anime Nhật Bản.</p>
      </div>
    </div>
  `;
}
