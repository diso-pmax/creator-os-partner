/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * BÀI KIỂM HỢP CHUẨN — khuôn chung
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **HỘP ĐEN THUẦN HTTP — và đây là ràng buộc CẤU TRÚC, không phải phong cách.**
 *
 *    Bộ này chạy trên hệ thống của **bên đối ứng**, nơi KHÔNG có cơ sở dữ liệu của nền tảng và KHÔNG
 *    có `AppModule` của nền tảng. Một dòng đọc CSDL lọt vào là bộ kiểm thôi chạy được ở đúng chỗ nó
 *    sinh ra để chạy.
 *
 *    Phần lớn bộ kiểm nội bộ tương đương của chúng tôi đọc thẳng CSDL và dựng app trong tiến trình —
 *    đó là lý do bộ này được viết lại thành hộp đen thuần HTTP, không dùng chung hạ tầng kiểm thử đó.
 *
 * 🔴 **Bộ này KHÔNG ghi được vào sổ của nền tảng, và đó là THIẾT KẾ.** Ghi nhận hạng đi qua một cửa
 *    nội bộ có quyền và có nhật ký — bộ kiểm này không cầm khoá của cửa đó. Bạn chạy bộ này trên máy
 *    mình thì kết quả **không có đường nào** tự vào sổ. Cổng nghiệm thu thành **tính chất cấu trúc**
 *    thay vì một phép kiểm ai đó phải nhớ (xem hợp đồng §8.5).
 */

/** Ba năng lực phục hồi — tập ĐÓNG của nền tảng, khớp enum `RecoveryCapability` ở CSDL. */
export type NangLuc = 'QUERY_WINDOW' | 'REDELIVER_BY_ID' | 'QUERY_RESOURCE';

/** Chiều của một ca. Hai chiều đo hai thứ KHÁC hẳn nhau — xem `README.md`. */
export type Chieu = 'VAO' | 'RA';

export type KetQuaCa = {
  ma: string;
  chieu: Chieu;
  ten: string;
  /** Năng lực mà ca này chứng minh. `null` = ca chiều VÀO, không cấp năng lực nào. */
  capNangLuc: NangLuc | null;
  dat: boolean;
  /** Câu nói vì sao — BẮT BUỘC khi trượt, để bên đối ứng sửa được mà không phải đi hỏi. */
  vi: string;
};

/**
 * Một lượt gọi HTTP đã trừu tượng hoá — để ca kiểm được **không cần dựng máy chủ**.
 *
 * 🔴 Vì sao tách: ca kiểm là **luật**, còn đường truyền là **chi tiết**. Tách ra thì bộ ca tự nó có
 *    bài kiểm của chính nó *(bơm phản hồi giả, khẳng định ca đọc đúng)* — nếu không thì thứ duy nhất
 *    kiểm được bộ kiểm là một máy chủ thật, và lúc đó **không ai kiểm nó cả**.
 */
export type PhanHoi = { status: number; body: unknown; headers: Record<string, string> };
export type GoiHttp = (
  duong: string,
  tuyChon: { method: string; headers: Record<string, string>; body?: string },
) => Promise<PhanHoi>;

export type CauHinh = {
  /** Cửa sự kiện của nền tảng, vd `https://api.example/api/v1`. */
  cuaNenTang: string;
  /** Mã nhận dạng + bí mật KÊNH SỰ KIỆN của bên đối ứng. */
  accessKey: string;
  eventSecret: string;
  /** Loại sự kiện đã được khai cho khoá này — ca "gói tin hợp lệ" cần một loại chạy được. */
  loaiSuKien: string;
  /** Điểm cuối phục hồi CỦA BÊN ĐỐI ỨNG. Vắng ⇒ bỏ toàn bộ chiều RA, và NÓI RA là đã bỏ. */
  diemCuoiPhucHoi?: string;
  /**
   * ⭐ Bí mật KÊNH PHỤC HỒI, để bộ kiểm **KÝ** lượt gọi chiều ra.
   *
   * 🔴 Không có nó thì bảy ca chiều RA gọi tới mà **không chứng minh được mình là ai** — và một bên
   *    thi hành ĐÚNG §5.6 sẽ từ chối chúng, tức bài kiểm **phạt bên làm đúng**.
   *
   * ⚠️ Vắng ⇒ vẫn chạy, chỉ thiếu ba tiêu đề — để bên đang dựng dở không bị chặn đường.
   */
  recoverySecret?: string;
};

/** Một ca: thuần hàm, nhận cấu hình + đường gọi, trả kết quả. Không trạng thái toàn cục. */
export type Ca = {
  ma: string;
  chieu: Chieu;
  ten: string;
  capNangLuc: NangLuc | null;
  chay(cf: CauHinh, goi: GoiHttp): Promise<{ dat: boolean; vi: string }>;
};

/** Tiện ích dựng kết quả — giữ câu "vì sao" luôn có mặt khi trượt. */
export const dat = (vi = 'đạt'): { dat: boolean; vi: string } => ({ dat: true, vi });
export const truot = (vi: string): { dat: boolean; vi: string } => ({ dat: false, vi });

/**
 * ⭐ SA chốt 2026-08-22 — **HAI CỔNG, HAI KHÁI NIỆM. Đừng gọi ca chiều VÀO là "năng lực".**
 *
 * ```
 * Cổng VÀO CỬA        7/7 ca chiều VÀO  ⟶  integration_conformance = PASS | FAIL
 *                     không đạt ⇒ KHÔNG được onboard / bật tích hợp
 *
 * Cổng CẤP HẠNG       ca chiều RA       ⟶  recovery_capability
 *                     không đạt ⇒ VẪN onboard, chỉ không được `FULL_RECOVERY`
 * ```
 *
 * 🔴 **Vì sao SA bắt tách tên.** Gọi cả hai là *"capability"* thì `integration_conformance` và
 *    `FULL_RECOVERY` nhập nhằng — và lúc đó một bên **chưa gửi nổi gói tin nào** vẫn có thể được đọc
 *    thành *"đang ở hạng thấp"*, trong khi sự thật là họ **chưa được vào cửa**.
 *
 * ⚠️ `FAIL` khi có **bất kỳ** ca chiều vào nào không đạt — kể cả ca bị BỎ. Không có ô *"gần đạt"*, và
 *    *"chưa chạy"* KHÔNG phải `PASS`: nơi tiêu thụ phải fail-closed khi chưa có kết quả nào.
 */
export function ketQuaVaoCua(kq: readonly KetQuaCa[]): 'PASS' | 'FAIL' {
  const vao = kq.filter((c) => c.chieu === 'VAO');
  // 🔴 Vế `length > 0`: `every()` trên mảng RỖNG trả `true` — không có ca nào mà báo PASS là đúng cái
  //    "chân lý rỗng" mà `sanSangCuaBenKia` đã phải chặn một lần ở module tích hợp.
  return vao.length > 0 && vao.every((c) => c.dat) ? 'PASS' : 'FAIL';
}

/**
 * Năng lực SUY từ kết quả — chỉ tính ca chiều RA, và chỉ ca ĐẠT.
 *
 * 🔴 **THAY THẾ, không cộng dồn** Hàm này trả tập của **đúng lượt chạy này**; người gọi
 *    ghi đè cột, không hợp với giá trị cũ: *"không pass đủ thì hạng HẠ
 *    XUỐNG, không có ô gần đạt"* — cộng dồn thì hạng chỉ đi lên được, và một bên vừa hỏng đường phục
 *    hồi vẫn giữ `FULL_RECOVERY` mãi.
 *
 * ⚠️ Một năng lực được công nhận chỉ khi **MỌI** ca cấp nó đều đạt. Một ca trượt là năng lực đó rớt —
 *    *"không có ô gần đạt"* áp cho **từng năng lực**, không chỉ cho tổng thể.
 */
export function nangLucDaChungMinh(kq: readonly KetQuaCa[]): NangLuc[] {
  const theoNangLuc = new Map<NangLuc, boolean>();
  for (const c of kq) {
    if (c.chieu !== 'RA' || c.capNangLuc === null) continue;
    theoNangLuc.set(c.capNangLuc, (theoNangLuc.get(c.capNangLuc) ?? true) && c.dat);
  }
  return [...theoNangLuc.entries()].filter(([, ok]) => ok).map(([n]) => n);
}
