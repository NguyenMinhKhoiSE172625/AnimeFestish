import { useSEO } from "@/hooks/use-seo.js";

export default function TermsPage() {
  useSEO({ title: "Dieu khoan su dung", url: "/terms" });

  return (
    <div className="static-page">
      <h1>Dieu khoan su dung</h1>
      <p>
        Khi su dung AnimeFetish, ban dong y tuan thu cac dieu khoan sau day.
      </p>
      <h2>Noi dung</h2>
      <p>
        AnimeFetish khong luu tru bat ky noi dung video nao. Tat ca noi dung duoc
        lay tu cac nguon cong khai tren internet. Chung toi khong chiu trach nhiem
        ve noi dung tu cac nguon ben thu ba.
      </p>
      <h2>Tai khoan</h2>
      <p>
        Ban chiu trach nhiem bao mat tai khoan cua minh. Khong chia se thong tin
        dang nhap voi nguoi khac.
      </p>
      <h2>Binh luan</h2>
      <p>
        Binh luan phai ton trong cong dong. Noi dung vi pham se bi xoa ma khong
        can thong bao truoc.
      </p>
    </div>
  );
}
