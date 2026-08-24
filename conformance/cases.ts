import { createHmac, randomUUID } from 'node:crypto';
import { dat, truot, type Ca, type CauHinh, type GoiHttp, type PhanHoi } from './contract';

/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * 14 CA BẮT BUỘC
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ```
 * VÀO (7)  gói tin hợp lệ · thiếu eventId · mốc thời gian sai · payload sai lược đồ
 *          · gói tin trùng · chữ ký sai · phát lại
 * RA  (7)  hỏi theo cửa sổ · phân trang · sự việc thiếu · gửi lại · kéo lại trùng · con trỏ sai
 *          · trạng thái VẬT GỐC
 * ```
 *
 * 🔴 **13 hay 14 — và vì sao bản đầu ghi 13 là NÓI QUÁ.** Bản đầu khai *"đúng danh sách SA ký"*. Đọc
 *    lại nguyên văn thì SA viết **"Ví dụ:"** trước danh sách — nó là **ví dụ**, không phải tập đóng.
 *    Và chính SA đòi năng lực thứ ba ở đoạn trên: *"Resource query… **Cũng phải trả lời được**"*.
 *
 *    Đo được hệ quả của việc thiếu ca thứ 14 *(code-reviewer bắt 2026-08-22)*: `QUERY_RESOURCE` là
 *    giá trị hợp lệ của enum và `suyHang` coi nó là nhánh dự phòng hợp lệ cho vế **phát hiện** — nhưng
 *    **không ca nào cấp nó**, nên `nangLucDaChungMinh()` **không bao giờ** trả nó ra. Một bên đối ứng
 *    chỉ có đường tra vật gốc thì vĩnh viễn không được công nhận, dù hợp đồng nói họ đủ điều kiện.
 *
 * 🔴 **Hai chiều đo hai thứ KHÁC HẲN nhau** — đừng đọc chúng thành một danh sách phẳng:
 *
 *    | | Kiểm ai | Cấp năng lực |
 *    |---|---|---|
 *    | VÀO | cửa của **nền tảng**, dùng khoá của bên đối ứng | **KHÔNG** — nó chứng minh *"bên này gửi vào được"*, không nói gì về năng lực phục hồi |
 *    | RA  | hệ thống của **bên đối ứng** | **CÓ** — đây mới là thứ cấp hạng |
 *
 * ⏸ Bảy ca chiều VÀO có phải **điều kiện vào cửa** không: **CHỜ SA**. Nền tảng KHÔNG tự mở rộng điều
 *    kiện vào cửa — quyết định kiến trúc mới đóng băng rằng *năng lực PHỤC HỒI* không phải điều kiện vào cửa,
 *    nó không nói gì về chiều vào. Tới khi có phán quyết, ca chiều VÀO **in ra** chứ không ghi sổ.
 */

/** Khuôn ký `EventIngressSignatureV1` — `timestamp + "." + thân THÔ`, theo BYTE. */
function ky(secret: string, ts: string, thanTho: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${ts}.${thanTho}`).digest('hex')}`;
}

/** Gói tin hợp lệ tối thiểu. `over` chỉ thay đúng thứ ca đang thử. */
function goiTin(cf: CauHinh, over: Record<string, unknown> = {}) {
  return {
    eventId: `conf-${randomUUID()}`,
    externalUserId: `conf-user-${randomUUID().slice(0, 8)}`,
    type: cf.loaiSuKien,
    occurredAt: new Date().toISOString(),
    payload: { orderId: `CONF-${randomUUID().slice(0, 8)}`, amountMinor: 100000, currency: 'VND' },
    ...over,
  };
}

/** Bắn một gói tin vào cửa nền tảng, ký đúng khuôn. `hong` cho phép ca cố ý phá chữ ký. */
async function ban(
  cf: CauHinh,
  goi: GoiHttp,
  than: unknown,
  hong?: { chuKy?: string; ts?: string },
): Promise<PhanHoi> {
  const raw = JSON.stringify(than);
  const ts = hong?.ts ?? String(Math.floor(Date.now() / 1000));
  return goi(`${cf.cuaNenTang}/integrations/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': cf.accessKey,
      'X-Timestamp': ts,
      'X-Signature': hong?.chuKy ?? ky(cf.eventSecret, ts, raw),
    },
    body: raw,
  });
}

const ma = (r: PhanHoi): string => String((r.body as { code?: unknown } | null)?.code ?? '');

// ── CHIỀU VÀO — 7 ca ────────────────────────────────────────────────────────────────────────────

const VAO: Ca[] = [
  {
    ma: 'IN-1',
    chieu: 'VAO',
    ten: 'gói tin hợp lệ ⇒ 200',
    capNangLuc: null,
    async chay(cf, goi) {
      const r = await ban(cf, goi, goiTin(cf));
      // 🔴 ĐỐI CHỨNG DƯƠNG của cả chiều vào. Thiếu ca này thì một cửa "luôn từ chối" làm SÁU ca còn
      //    lại xanh hết — chúng đều mong đợi bị từ chối.
      return r.status === 200 ? dat() : truot(`mong 200, nhận ${r.status} (${ma(r) || 'không mã'})`);
    },
  },
  {
    ma: 'IN-2',
    chieu: 'VAO',
    ten: 'thiếu `eventId` ⇒ 400 sai KHUÔN',
    capNangLuc: null,
    async chay(cf, goi) {
      const { eventId: _bo, ...than } = goiTin(cf);
      const r = await ban(cf, goi, than);
      return r.status === 400 ? dat() : truot(`mong 400, nhận ${r.status}`);
    },
  },
  {
    ma: 'IN-3',
    chieu: 'VAO',
    ten: 'mốc thời gian sai kiểu ⇒ 400',
    capNangLuc: null,
    async chay(cf, goi) {
      const r = await ban(cf, goi, goiTin(cf, { occurredAt: 'khong-phai-thoi-gian' }));
      return r.status === 400 ? dat() : truot(`mong 400, nhận ${r.status}`);
    },
  },
  {
    ma: 'IN-4',
    chieu: 'VAO',
    ten: '`payload` thiếu trường bắt buộc ⇒ 422 sai NGHĨA',
    capNangLuc: null,
    async chay(cf, goi) {
      const r = await ban(cf, goi, goiTin(cf, { payload: {} }));
      // 🔴 **422 chứ KHÔNG 400**, và phân biệt này là thứ bên đối ứng cần nhất: 400 = *"sửa gói tin
      //    của anh"*, 422 = *"gói tin đúng khuôn, sai NGHĨA"*. Nhận 400 ở đây thì họ đi sửa khuôn —
      //    thứ vốn đã đúng — và không bao giờ tìm ra.
      return r.status === 422 ? dat() : truot(`mong 422 (đúng khuôn, sai nghĩa), nhận ${r.status}`);
    },
  },
  {
    ma: 'IN-5',
    chieu: 'VAO',
    ten: 'gói tin TRÙNG ⇒ 200 `deduplicated`, KHÔNG 409',
    capNangLuc: null,
    async chay(cf, goi) {
      const than = goiTin(cf);
      await ban(cf, goi, than);
      const r = await ban(cf, goi, than);
      const j = r.body as { deduplicated?: boolean } | null;
      // Webhook gửi lại là hành vi BÌNH THƯỜNG; trả lỗi biến nguồn thành máy thử lại vô hạn.
      return r.status === 200 && j?.deduplicated === true
        ? dat()
        : truot(`mong 200 + deduplicated:true, nhận ${r.status} ${JSON.stringify(j)}`);
    },
  },
  {
    ma: 'IN-6',
    chieu: 'VAO',
    ten: 'chữ ký SAI ⇒ 401',
    capNangLuc: null,
    async chay(cf, goi) {
      const r = await ban(cf, goi, goiTin(cf), { chuKy: 'sha256=00' });
      return r.status === 401 ? dat() : truot(`mong 401, nhận ${r.status}`);
    },
  },
  {
    ma: 'IN-7',
    chieu: 'VAO',
    ten: 'PHÁT LẠI — mốc thời gian quá cũ ⇒ 401',
    capNangLuc: null,
    async chay(cf, goi) {
      const cu = String(Math.floor(Date.now() / 1000) - 3600);
      const than = goiTin(cf);
      const raw = JSON.stringify(than);
      const r = await ban(cf, goi, than, { ts: cu, chuKy: ky(cf.eventSecret, cu, raw) });
      // ⚠️ Chữ ký ở đây HỢP LỆ cho mốc cũ đó. Ca này đo **cửa sổ độ tươi**, không đo chữ ký — thiếu vế
      //    ký đúng thì nó chỉ lặp lại IN-6.
      return r.status === 401 ? dat() : truot(`mong 401 (ngoài cửa sổ độ tươi), nhận ${r.status}`);
    },
  },
];

// ── CHIỀU RA — 7 ca ─────────────────────────────────────────────────────────────────────────────

/**
 * Khuôn ký `PartnerRecoverySignatureV1` — `ts . METHOD . đường-dẫn+query . thân THÔ`.
 *
 * ⚠️ KHÁC `EventIngressSignatureV1` ở trên, và khác có chủ đích: chiều VÀO có đúng MỘT cửa luôn có
 * thân nên method/đường dẫn là hằng; chiều RA thì cửa là **của bạn**, và nhiều bên sẽ là `GET` không
 * thân — ký `ts + "." + ""` là một chữ ký hợp lệ cho MỌI lượt gọi trong cửa sổ 5 phút.
 */
function kyChieuRa(secret: string, ts: string, duongDan: string, thanTho: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${ts}.POST.${duongDan}.${thanTho}`).digest('hex')}`;
}

/** Đường dẫn + query NGUYÊN VĂN — đúng dãy ký tự nằm trên dòng yêu cầu. */
function duongDanCua(diemCuoi: string): string {
  try {
    const u = new URL(diemCuoi);
    return `${u.pathname}${u.search}`;
  } catch {
    return diemCuoi;
  }
}

/**
 * Gọi điểm cuối phục hồi của bên đối ứng — **CÓ KÝ**.
 *
 * 🔴 **Bản đầu của ㉕ gọi KHÔNG chữ ký, và đó là một lỗ THẬT do thứ tự nhịp.** ㉕ dựng bộ kiểm này
 *    **trước khi** ㉗ công bố khuôn ký chiều ra. Hệ quả ngược đời: một bên đối ứng thi hành **ĐÚNG**
 *    hợp đồng §5.6 *(có kiểm chữ ký nền tảng)* sẽ **TRƯỢT** cả bảy ca chiều RA — vì bộ kiểm gọi tới
 *    mà không chứng minh mình là ai — còn bên **bỏ qua** xác thực thì đạt. Bài kiểm thưởng cho bên
 *    làm sai và phạt bên làm đúng.
 *
 * ⚠️ `CONF_RECOVERY_SECRET` **để trống được**: bên chưa dựng phép kiểm chữ ký vẫn chạy được bộ này,
 *    yêu cầu chỉ thiếu ba tiêu đề. Bắt buộc nó là chặn đường một bên đang dựng dở.
 */
async function hoi(cf: CauHinh, goi: GoiHttp, than: unknown): Promise<PhanHoi> {
  const duong = String(cf.diemCuoiPhucHoi);
  const body = JSON.stringify(than);
  const ts = String(Math.floor(Date.now() / 1000));
  const kyDuoc = cf.recoverySecret && cf.accessKey;
  return goi(duong, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(kyDuoc
        ? {
            'X-Platform-Key-Id': cf.accessKey,
            'X-Platform-Timestamp': ts,
            'X-Platform-Signature': kyChieuRa(String(cf.recoverySecret), ts, duongDanCua(duong), body),
          }
        : {}),
    },
    body,
  });
}

type TrangRa = { suKien?: unknown[]; conTroTiep?: string | null };
const trang = (r: PhanHoi): TrangRa => (r.body ?? {}) as TrangRa;

const RA: Ca[] = [
  {
    ma: 'OUT-1',
    chieu: 'RA',
    ten: 'hỏi theo cửa sổ ⇒ trả DANH SÁCH sự kiện dạng chuẩn',
    capNangLuc: 'QUERY_WINDOW',
    async chay(cf, goi) {
      const den = new Date();
      const tu = new Date(den.getTime() - 6 * 3600_000);
      const r = await hoi(cf, goi, { tu: tu.toISOString(), den: den.toISOString() });
      if (r.status !== 200) return truot(`mong 200, nhận ${r.status}`);
      const t = trang(r);
      if (!Array.isArray(t.suKien)) return truot('thân phải có `suKien` là MẢNG — rỗng là hợp lệ, thiếu thì không');
      // 🔴 Mảng RỖNG là ĐẠT. Rỗng nghĩa *"khoảng đó thật sự không gửi gì"* — một câu trả lời hợp lệ.
      //    Thứ KHÔNG hợp lệ là thiếu hẳn trường, vì lúc đó không phân biệt được với "không tra được".
      return dat(`trả ${t.suKien.length} sự việc`);
    },
  },
  {
    ma: 'OUT-2',
    chieu: 'RA',
    ten: 'PHÂN TRANG — `conTroTiep` có mặt, và `null` khi hết',
    capNangLuc: 'QUERY_WINDOW',
    async chay(cf, goi) {
      const den = new Date();
      const tu = new Date(den.getTime() - 24 * 3600_000);
      const r = await hoi(cf, goi, { tu: tu.toISOString(), den: den.toISOString() });
      if (r.status !== 200) return truot(`mong 200, nhận ${r.status}`);
      const t = trang(r);
      // ⚠️ Khẳng định trường CÓ MẶT, không khẳng định nó khác `null`: khoảng ngắn có thể hết trong một
      //    trang, và bắt phải có trang thứ hai là bắt bên kia bịa dữ liệu.
      return 'conTroTiep' in t
        ? dat(`conTroTiep = ${JSON.stringify(t.conTroTiep)}`)
        : truot('thiếu `conTroTiep`; hết trang phải trả `null` TƯỜNG MINH, không được vắng mặt');
    },
  },
  {
    ma: 'OUT-3',
    chieu: 'RA',
    ten: 'sự việc KHÔNG có thật ⇒ trả rỗng, KHÔNG lỗi',
    capNangLuc: 'REDELIVER_BY_ID',
    async chay(cf, goi) {
      const r = await hoi(cf, goi, { eventId: `khong-co-that-${randomUUID()}` });
      if (r.status >= 500) return truot(`mong không phải lỗi máy chủ, nhận ${r.status}`);
      // Hỏi một mã không tồn tại là chuyện BÌNH THƯỜNG lúc đối soát — nó không phải lỗi của ai.
      return r.status === 200 || r.status === 404 ? dat(`nhận ${r.status}`) : truot(`mong 200 hoặc 404, nhận ${r.status}`);
    },
  },
  {
    ma: 'OUT-4',
    chieu: 'RA',
    ten: 'GỬI LẠI theo định danh ⇒ trả đúng sự việc đó',
    capNangLuc: 'REDELIVER_BY_ID',
    async chay(cf, goi) {
      const den = new Date();
      const tu = new Date(den.getTime() - 24 * 3600_000);
      const ds = trang(await hoi(cf, goi, { tu: tu.toISOString(), den: den.toISOString() }));
      const mau = (ds.suKien ?? [])[0] as { eventId?: string } | undefined;
      if (!mau?.eventId) return truot('không lấy được một `eventId` thật để hỏi lại — cần ít nhất một sự việc trong 24 giờ');
      const r = await hoi(cf, goi, { eventId: mau.eventId });
      const tra = (r.body ?? {}) as { suKien?: { eventId?: string } };
      return r.status === 200 && tra.suKien?.eventId === mau.eventId
        ? dat()
        : truot(`hỏi lại ${mau.eventId} không trả đúng sự việc đó (nhận ${r.status})`);
    },
  },
  {
    ma: 'OUT-5',
    chieu: 'RA',
    ten: 'KÉO LẠI TRÙNG — hỏi hai lần cùng khoảng ⇒ CÙNG kết quả',
    capNangLuc: 'QUERY_WINDOW',
    async chay(cf, goi) {
      const den = new Date();
      const tu = new Date(den.getTime() - 6 * 3600_000);
      const than = { tu: tu.toISOString(), den: den.toISOString() };
      const a = trang(await hoi(cf, goi, than));
      const b = trang(await hoi(cf, goi, than));
      // 🔴 Đối soát chạy LẶP theo lịch. Cùng câu hỏi ra hai câu trả lời khác nhau thì mọi kết luận
      //    *"thiếu cái nào"* đều là kết luận về một sổ đang trôi, không phải về chỗ thiếu thật.
      const idA = JSON.stringify((a.suKien ?? []).map((e) => (e as { eventId?: string }).eventId).sort());
      const idB = JSON.stringify((b.suKien ?? []).map((e) => (e as { eventId?: string }).eventId).sort());
      return idA === idB ? dat() : truot('hai lượt hỏi cùng khoảng ra hai tập định danh KHÁC nhau');
    },
  },
  {
    ma: 'OUT-6',
    chieu: 'RA',
    ten: 'CON TRỎ SAI ⇒ báo lỗi, KHÔNG âm thầm trả trang đầu',
    capNangLuc: 'QUERY_WINDOW',
    async chay(cf, goi) {
      const den = new Date();
      const tu = new Date(den.getTime() - 6 * 3600_000);
      const r = await hoi(cf, goi, { tu: tu.toISOString(), den: den.toISOString(), conTro: 'con-tro-bia-dat' });
      // 🔴 Âm thầm trả trang đầu là hỏng NGUY HIỂM NHẤT của phân trang: vòng lặp kéo lại chạy mãi trên
      //    cùng một trang và **không bao giờ kết thúc**, mà mọi trang đều "hợp lệ" nên không ai thấy.
      return r.status >= 400 && r.status < 500
        ? dat(`nhận ${r.status}`)
        : truot(`con trỏ bịa phải bị TỪ CHỐI (4xx), nhận ${r.status} — âm thầm trả trang đầu là vòng lặp vô hạn`);
    },
  },
];

RA.push({
  ma: 'OUT-7',
  chieu: 'RA',
  ten: 'TRẠNG THÁI VẬT GỐC ⇒ trả trạng thái, cho bên KHÔNG có sổ sự kiện',
  capNangLuc: 'QUERY_RESOURCE',
  async chay(cf, goi) {
    const r = await hoi(cf, goi, { thamChieu: `CONF-PROBE-${randomUUID().slice(0, 8)}` });
    if (r.status >= 500) return truot(`mong không phải lỗi máy chủ, nhận ${r.status}`);
    // 🔴 Hỏi một vật KHÔNG có thật là ca hợp lệ: `404` hoặc `200` + rỗng đều ĐẠT. Thứ KHÔNG đạt là
    //    `5xx` — nó nghĩa là đường này chưa dựng, chứ không phải "vật đó không tồn tại".
    if (r.status === 404) return dat('404 — vật không tồn tại, đường tra CÓ hoạt động');
    if (r.status !== 200) return truot(`mong 200 hoặc 404, nhận ${r.status}`);
    const t = (r.body ?? {}) as { trangThai?: unknown };
    // ⚠️ `200` thì thân phải có hình dạng trả lời được — `{}` rỗng không phân biệt được với
    //    "đã dựng đường nhưng chưa cắm gì".
    return 'trangThai' in t || t === null
      ? dat()
      : truot('200 nhưng thân không có `trangThai`; vật không tồn tại thì trả 404 hoặc `trangThai: null`');
  },
});

export const CA_BAT_BUOC: readonly Ca[] = [...VAO, ...RA];
export const SO_CA_VAO = VAO.length;
export const SO_CA_RA = RA.length;
