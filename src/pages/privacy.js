// === Privacy Policy Page ===
import { updateSEO } from '../js/seo.js';

export function renderPrivacyPage() {
  const main = document.getElementById('main-content');

  updateSEO({
    title: 'Chính sách quyền riêng tư',
    description: 'Tìm hiểu cách AnimeFetish thu thập, sử dụng và bảo vệ dữ liệu người dùng.',
    url: '/privacy',
  });

  main.innerHTML = `
    <section class="section policy-page">
      <article class="policy-card">
        <p class="policy-kicker">AnimeFetish</p>
        <h1 class="policy-title">Chính sách quyền riêng tư</h1>
        <p class="policy-updated">Cập nhật lần cuối: 18/03/2026</p>

        <section class="policy-block">
          <h2>1. Dữ liệu chúng tôi thu thập</h2>
          <p>AnimeFetish chỉ thu thập dữ liệu cần thiết để website hoạt động ổn định và cá nhân hoá trải nghiệm xem anime.</p>
          <ul class="policy-list">
            <li>Thông tin tài khoản khi bạn đăng nhập như email, tên hiển thị và ảnh đại diện.</li>
            <li>Lịch sử xem và tiến độ tập phim để hỗ trợ tiếp tục xem.</li>
            <li>Nội dung bình luận bạn gửi trong trang chi tiết hoặc trang xem.</li>
          </ul>
        </section>

        <section class="policy-block">
          <h2>2. Mục đích sử dụng dữ liệu</h2>
          <p>Dữ liệu được dùng để xác thực đăng nhập, đồng bộ bình luận, lưu tiến độ xem và cải thiện tốc độ phản hồi giao diện.</p>
        </section>

        <section class="policy-block">
          <h2>3. Lưu trữ và bảo mật</h2>
          <p>Dữ liệu người dùng được lưu trên hạ tầng Firebase hoặc LocalStorage của trình duyệt, với phạm vi phục vụ trực tiếp cho tính năng hiện có.</p>
        </section>

        <section class="policy-block">
          <h2>4. Quyền của người dùng</h2>
          <p>Bạn có thể xoá bình luận của mình, đăng xuất tài khoản hoặc xoá dữ liệu lưu cục bộ bằng cách dọn dữ liệu trình duyệt.</p>
        </section>

        <section class="policy-block">
          <h2>5. Cập nhật chính sách</h2>
          <p>Nội dung chính sách có thể thay đổi khi website bổ sung tính năng mới. Phiên bản mới luôn hiển thị tại trang này.</p>
        </section>
      </article>
    </section>
  `;
}
