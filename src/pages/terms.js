// === Terms Of Service Page ===
import { updateSEO } from '../js/seo.js';

export function renderTermsPage() {
  const main = document.getElementById('main-content');

  updateSEO({
    title: 'Điều khoản sử dụng',
    description: 'Điều khoản sử dụng dịch vụ AnimeFetish dành cho người xem.',
    url: '/terms',
  });

  main.innerHTML = `
    <section class="section policy-page">
      <article class="policy-card">
        <p class="policy-kicker">AnimeFetish</p>
        <h1 class="policy-title">Điều khoản sử dụng</h1>
        <p class="policy-updated">Cập nhật lần cuối: 18/03/2026</p>

        <section class="policy-block">
          <h2>1. Phạm vi áp dụng</h2>
          <p>Khi truy cập AnimeFetish, bạn đồng ý tuân thủ các điều khoản tại trang này và quy định pháp luật hiện hành.</p>
        </section>

        <section class="policy-block">
          <h2>2. Hành vi sử dụng</h2>
          <ul class="policy-list">
            <li>Không đăng nội dung vi phạm pháp luật, spam hoặc xúc phạm người khác.</li>
            <li>Không cố tình can thiệp vào hệ thống, API hoặc cơ chế bảo vệ dịch vụ.</li>
            <li>Không giả mạo danh tính khi tạo tài khoản và bình luận.</li>
          </ul>
        </section>

        <section class="policy-block">
          <h2>3. Tài khoản người dùng</h2>
          <p>Bạn chịu trách nhiệm bảo mật tài khoản đã đăng nhập. AnimeFetish có thể tạm khoá quyền bình luận với tài khoản vi phạm.</p>
        </section>

        <section class="policy-block">
          <h2>4. Tính sẵn sàng dịch vụ</h2>
          <p>Website có thể bảo trì hoặc gián đoạn tạm thời do phụ thuộc nguồn dữ liệu và hạ tầng bên thứ ba.</p>
        </section>

        <section class="policy-block">
          <h2>5. Thay đổi điều khoản</h2>
          <p>Điều khoản có thể được cập nhật để phù hợp với tính năng mới. Bạn nên kiểm tra định kỳ để nắm phiên bản mới nhất.</p>
        </section>
      </article>
    </section>
  `;
}
