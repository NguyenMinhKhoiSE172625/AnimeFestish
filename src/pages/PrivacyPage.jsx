import { useSEO } from "@/hooks/use-seo.js";

export default function PrivacyPage() {
  useSEO({ title: "Chinh sach quyen rieng tu", url: "/privacy" });

  return (
    <div className="static-page">
      <h1>Chinh sach quyen rieng tu</h1>
      <p>
        AnimeFetish cam ket bao ve quyen rieng tu cua ban. Chung toi chi thu thap
        thong tin can thiet de cung cap dich vu xem anime tot nhat.
      </p>
      <h2>Thong tin thu thap</h2>
      <p>
        Khi ban dang ky tai khoan, chung toi thu thap email va ten hien thi.
        Lich su xem duoc luu tren trinh duyet cua ban (localStorage) va khong
        duoc gui ve server.
      </p>
      <h2>Cookie</h2>
      <p>
        Chung toi su dung cookie de duy tri phien dang nhap va cai thien trai
        nghiem nguoi dung.
      </p>
      <h2>Lien he</h2>
      <p>
        Neu ban co bat ky cau hoi nao ve chinh sach quyen rieng tu, vui long lien
        he qua email.
      </p>
    </div>
  );
}
