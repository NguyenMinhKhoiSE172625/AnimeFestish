// === Footer Component ===

export function renderFooter() {
  const footer = document.getElementById('footer');
  footer.innerHTML = `
    <div class="footer">
      <div class="footer-inner">
        <div class="footer-logo">AnimeFetish</div>
        <p class="footer-desc">
          Website xem anime Nhật Bản vietsub miễn phí. Kho anime phong phú, cập nhật nhanh. Chỉ phục vụ anime chất lượng cao.
        </p>
        <div class="footer-links">
          <a href="#/">Trang chủ</a>
          <a href="#/anime">Danh sách</a>
          <a href="#/category/hanh-dong">Hành Động</a>
          <a href="#/category/tinh-cam">Tình Cảm</a>
          <a href="#/search/">Tìm kiếm</a>
        </div>
        <p class="footer-copy">© ${new Date().getFullYear()} AnimeFetish. Chỉ anime Nhật Bản.</p>
      </div>
    </div>
  `;
}
