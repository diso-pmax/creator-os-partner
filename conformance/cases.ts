import { createHmac, randomUUID } from 'node:crypto';
import { dat, truot, type Ca, type CauHinh, type GoiHttp, type PhanHoi } from './contract';

/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * 15 CA BẮT BUỘC
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ```
 * VÀO (8)  gói tin hợp lệ · thiếu eventId · mốc thời gian sai · payload sai lược đồ
 *          · gói tin trùng · chữ ký sai · phát lại · brandCode có mà rỗng
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
 * 🔒 Ca chiều VÀO **là** điều kiện vào cửa: trượt MỘT ca là tích hợp không được bật — xem `ketQuaVaoCua()`
 *    trong `contract.ts`. Chúng vẫn chỉ đo *"gửi vào được không"*, không cấp năng lực nào; và bộ này chỉ
 *    **in ra** — kết quả vào sổ bằng lượt chạy của nền tảng, không bằng lượt chạy trên máy bên đối ứng.
 */

/**
 * Khuôn ký `EventIngressSignatureV1` — `timestamp + "." + thân THÔ`, theo BYTE.
 *
 * ⭐ `export` để công cụ nội bộ dùng LẠI đúng khuôn này thay vì chép công thức sang chỗ thứ hai —
 *    lệch một byte là `401` mà không ai biết vì sao. Bản chép cho bên đối ứng không đổi gì: thêm một
 *    `export` không tạo phụ thuộc mới, ba file cạnh nhau vẫn chạy độc lập.
 */
export function ky(secret: string, ts: string, thanTho: string): string {
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
const chiTiet = (r: PhanHoi): string => String((r.body as { detail?: unknown } | null)?.detail ?? '');

// ── CHIỀU VÀO — 8 ca ────────────────────────────────────────────────────────────────────────────

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
  {
    ma: 'IN-8',
    chieu: 'VAO',
    ten: '`brandCode` có mặt mà RỖNG ⇒ 422 sai NGHĨA (loại đơn hàng)',
    capNangLuc: null,
    async chay(cf, goi) {
      // ⚠️ `brandCode` chỉ có nghĩa với loại đơn hàng. Lượt chạy loại khác mà gửi `ORDER_*` thì cửa
      //    trả `422` vì LOẠI chưa khai cho khoá này — trước khi xét tới `payload` — nên ca không đo
      //    được gì mà vẫn đánh trượt bên đó. Không gửi gì, và nói rõ vì sao.
      if (!cf.loaiSuKien.startsWith('ORDER_')) {
        return dat(`không áp dụng — lượt chạy loại ${cf.loaiSuKien}; ca này chỉ đo được với loại ORDER_*`);
      }
      // 🔴 HAI giá trị là HAI phép kiểm: chặn `""` mà nhận `"   "` là cửa so độ dài thay vì bỏ khoảng
      //    trắng — mà `"   "` lọt vào thì không bao giờ khớp brand nào, im lặng y như `""`.
      // ⚠️ Chỉ đo vế RỖNG của luật. Vế "không phải chuỗi" (`brandCode: 123`) cửa cũng trả `422`, nhưng ca
      //    này cố ý không gửi: tên ca và bảng công bố cho bên đối ứng nói đúng hai giá trị trên.
      for (const brandCode of ['', '   ']) {
        const than = goiTin(cf);
        const r = await ban(cf, goi, { ...than, payload: { ...than.payload, brandCode } });
        const gt = `brandCode ${JSON.stringify(brandCode)}`;
        if (r.status !== 422) return truot(`${gt}: mong 422 (đúng khuôn, sai nghĩa), nhận ${r.status}`);
        if (ma(r) !== 'payload_field_missing') {
          return truot(`${gt}: mong mã payload_field_missing, nhận ${ma(r) || 'không mã'}`);
        }
        // Câu lỗi phải nêu đích danh trường — bên đối ứng sửa được mà không phải đi hỏi.
        if (!chiTiet(r).includes('brandCode')) {
          return truot(`${gt}: câu lỗi phải nêu đích danh \`brandCode\`, nhận "${chiTiet(r)}"`);
        }
      }
      return dat();
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

// ── LAUNCH — 8 ca ──────────────────────────────────────────────────────────────────────────────
//
// 🔴 **CỐ Ý tách khỏi `CA_BAT_BUOC`, KHÔNG gộp vào VAO.** `chieu:'VAO'` nuôi thẳng cổng vào cửa
// (`ketQuaVaoCua()`) — gộp LAUNCH vào đó là âm thầm đổi ý nghĩa một cổng đã đóng băng. Xem
// `contract.ts` — `Chieu` đã có nhánh thứ ba riêng cho việc này.

/** Gọi `POST .../campaigns/:id/launch` — HMAC kênh LAUNCH, CÙNG khuôn ký `ky()` ở trên, khác secret. */
export function taoLaunch(
  // Thu hẹp đúng ba trường thật sự dùng — công cụ nội bộ không phải dựng một `CauHinh` giả với
  // `eventSecret`/`loaiSuKien` bịa ra chỉ để gọi được hàm này. `CauHinh` đầy đủ vẫn thoả kiểu này.
  cf: Pick<CauHinh, 'cuaNenTang' | 'accessKey' | 'launchSecret'>,
  goi: GoiHttp,
  campaignId: string,
  externalUserId: string,
  // Optional partner-side name suggestion. Omitted ⇒ the body stays exactly
  // `{"externalUserId":...}`, so every existing caller signs the same bytes as before.
  displayName?: string,
  // Optional player groups. Omitted ⇒ the body stays byte-for-byte what it was. Typed `unknown` on purpose: the
  // conformance case that proves a malformed value is refused has to be able to send one.
  segments?: unknown,
): Promise<PhanHoi> {
  // The signature is computed over this exact string and the same string is sent as the body.
  const raw = JSON.stringify({ externalUserId, ...(displayName === undefined ? {} : { displayName }), ...(segments === undefined ? {} : { segments }) });
  const ts = String(Math.floor(Date.now() / 1000));
  return goi(`${cf.cuaNenTang}/campaigns/${campaignId}/launch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': cf.accessKey,
      'X-Timestamp': ts,
      'X-Signature': ky(cf.launchSecret, ts, raw),
    },
    body: raw,
  });
}

/**
 * `GET /launch` — KHÔNG HMAC, `code` tự nó là credential. `redirect:'manual'` BẮT BUỘC: mặc định
 * `fetch` sẽ tự đi theo redirect sang host cổng thưởng — nơi máy chạy bộ kiểm của đối tác thường
 * không với tới — và ta mất luôn cơ hội đọc `status`/`Location`/`Set-Cookie` của chính lượt consume.
 * `ghiDe` cho ㉔ LAUNCH-7 gắn thêm tham số query rác lên `launchUrl` gốc.
 */
function moLaunch(goi: GoiHttp, launchUrl: string, ghiDe?: Record<string, string>): Promise<PhanHoi> {
  const u = new URL(launchUrl);
  for (const [k, v] of Object.entries(ghiDe ?? {})) u.searchParams.set(k, v);
  return goi(u.toString(), { method: 'GET', headers: {}, redirect: 'manual' });
}

/**
 * Every `Set-Cookie` of a response. Prefers `setCookies` (the real runner fills it from `headers.getSetCookie()`); a hand-made
 * response that only has `headers['set-cookie']` (one string, or several joined by a newline) still works.
 */
function cookiesCua(r: PhanHoi): string[] {
  if (r.setCookies && r.setCookies.length > 0) return r.setCookies;
  const mot = r.headers['set-cookie'];
  return mot ? mot.split('\n') : [];
}

const laLaunchUrl = (b: unknown): b is { launchUrl: string; expiresAt: string } =>
  typeof (b as { launchUrl?: unknown } | null)?.launchUrl === 'string';

const nguoiDungMoi = () => `conf-user-${randomUUID().slice(0, 8)}`;

const LAUNCH: Ca[] = [
  {
    ma: 'LAUNCH-1',
    chieu: 'LAUNCH',
    ten: 'campaign + externalUserId hợp lệ ⇒ 200 + launchUrl',
    capNangLuc: null,
    async chay(cf, goi) {
      const r = await taoLaunch(cf, goi, cf.launchCampaignId, nguoiDungMoi());
      if (r.status !== 200) return truot(`mong 200, nhận ${r.status}`);
      return laLaunchUrl(r.body) ? dat() : truot('thân 200 phải có `launchUrl` dạng chuỗi');
    },
  },
  {
    ma: 'LAUNCH-2',
    chieu: 'LAUNCH',
    ten: 'mở launchUrl thành công ⇒ tạo session',
    capNangLuc: null,
    async chay(cf, goi) {
      const tao = await taoLaunch(cf, goi, cf.launchCampaignId, nguoiDungMoi());
      if (!laLaunchUrl(tao.body)) return truot(`không tạo được launch grant để thử (status ${tao.status})`);
      const r = await moLaunch(goi, tao.body.launchUrl);
      if (r.status !== 302) return truot(`mong 302, nhận ${r.status}`);
      // 🔴 KHÔNG đọc tên/giá trị cookie — đó là chi tiết hiện thực. Chỉ cần MỘT session được cấp.
      return cookiesCua(r).length > 0 ? dat() : truot('302 nhưng thiếu header `Set-Cookie` — không thấy session được cấp');
    },
  },
  {
    ma: 'LAUNCH-3',
    chieu: 'LAUNCH',
    ten: 'dùng lại launchUrl lần 2 ⇒ bị từ chối',
    capNangLuc: null,
    async chay(cf, goi) {
      const tao = await taoLaunch(cf, goi, cf.launchCampaignId, nguoiDungMoi());
      if (!laLaunchUrl(tao.body)) return truot(`không tạo được launch grant để thử (status ${tao.status})`);
      const lan1 = await moLaunch(goi, tao.body.launchUrl);
      if (lan1.status !== 302) return truot(`lượt tiêu thụ ĐẦU phải thành công (302) mới thử được lượt hai, nhận ${lan1.status}`);
      const lan2 = await moLaunch(goi, tao.body.launchUrl);
      return lan2.status === 401 ? dat() : truot(`mong 401 ở lượt dùng lại, nhận ${lan2.status}`);
    },
  },
  {
    ma: 'LAUNCH-4',
    chieu: 'LAUNCH',
    ten: 'launchUrl hết hạn ⇒ bị từ chối',
    capNangLuc: null,
    async chay(cf, goi) {
      const tao = await taoLaunch(cf, goi, cf.launchCampaignId, nguoiDungMoi());
      if (!laLaunchUrl(tao.body)) return truot(`không tạo được launch grant để thử (status ${tao.status})`);
      // 🔴 CHỜ TTL THẬT (~61s) — KHÔNG có cách nào giả lập nhanh hơn ở hộp đen thuần HTTP (không DB).
      //    Hết hạn/đã dùng/chưa từng tồn tại cố ý trả CÙNG một mã (§9 campaign-launch.md) nên đây là
      //    cách trung thực DUY NHẤT để chứng minh riêng nhánh "hết hạn". Khai chi phí ở testing.md §1.5.
      await new Promise((r) => setTimeout(r, 61_000));
      const r = await moLaunch(goi, tao.body.launchUrl);
      return r.status === 401 ? dat() : truot(`mong 401 sau khi hết hạn, nhận ${r.status}`);
    },
  },
  {
    ma: 'LAUNCH-5',
    chieu: 'LAUNCH',
    ten: 'launch code không hợp lệ ⇒ bị từ chối',
    capNangLuc: null,
    async chay(cf, goi) {
      const r = await goi(`${cf.cuaNenTang}/launch?code=conf-khong-ton-tai-${randomUUID()}`, {
        method: 'GET',
        headers: {},
        redirect: 'manual',
      });
      return r.status === 401 ? dat() : truot(`mong 401, nhận ${r.status}`);
    },
  },
  {
    ma: 'LAUNCH-6',
    chieu: 'LAUNCH',
    ten: 'campaign không cho phép tích hợp này ⇒ bị từ chối',
    capNangLuc: null,
    async chay(cf, goi) {
      // Campaign bịa (không tồn tại HOẶC thuộc tenant khác — hai ca cố ý gộp một mã, xem error-codes.md)
      // là phép đo đen thui duy nhất khả thi: bên đối ứng không tự tạo được campaign của tenant khác.
      // 🔴 PHẢI là UUID hợp lệ (chỉ không tồn tại) — chuỗi có tiền tố rớt ở bước kiểm HÌNH DẠNG
      //    tham số (400) trước khi tới được bước "không tồn tại" (404), đo được thật khi chạy.
      const r = await taoLaunch(cf, goi, randomUUID(), nguoiDungMoi());
      return r.status === 404 ? dat() : truot(`mong 404, nhận ${r.status}`);
    },
  },
  {
    ma: 'LAUNCH-7',
    chieu: 'LAUNCH',
    ten: 'code của campaign A không mở được campaign B ⇒ bị từ chối',
    capNangLuc: null,
    async chay(cf, goi) {
      // ── 🔴 SỬA 2026-08-29 — bản trước khoá một HÌNH DẠNG REDIRECT KHÔNG CÒN TỒN TẠI ────────────
      //
      //    Nó đòi `Location` chứa `campaignId` GỐC. **bản sản phẩm sau đó đã cố ý bỏ điều đó**: đích nay là GỐC
      //    webview Thưởng, một hằng số phía máy chủ, và webview tự hỏi chiến dịch nào đang chạy cho
      //    đơn vị trong vé. Tài liệu partner đã nói đúng từ lúc đó — *"Đích không mang `campaignId`"*
      //    (`campaign-launch.md` §6, ngay trên §6.1) — chỉ ca kiểm này là chưa theo.
      //
      // ⇒ Đo lần đầu vào CỬA THẬT ngày 2026-08-29: `Location: http://localhost:4800/`, ca TRƯỢT. Đối
      //   tác chạy `run.ts` sẽ thấy một ❌ ở kênh LAUNCH và tưởng mình bị chặn onboarding, trong khi
      //   cửa làm ĐÚNG hợp đồng đã công bố.
      //
      // ── Bất biến vẫn phải được chứng minh, chỉ đổi cách QUAN SÁT ───────────────────────────────
      //
      //    Bất biến #9: server CHỈ đọc `code`; mọi tham số gắn thêm bị bỏ qua **âm thầm**. Không còn
      //    `campaignId` trong `Location` để soi, nên đo bằng ĐỐI CHỨNG: một lượt tiêu thụ SẠCH và một
      //    lượt tiêu thụ có `campaignId` rác phải cho **cùng mã, cùng đích**. Khác nhau ở bất kỳ vế
      //    nào nghĩa là trường gắn thêm ĐÃ đi vào quyết định — đúng thứ bất biến này cấm.
      //
      // ⚠️ Đây KHÔNG phải nới bài kiểm: bản cũ chỉ đọc được `Location`; bản này so TOÀN BỘ kết quả
      //    quan sát được của hai lượt, nên nó bắt được cả những cách "trường lạ ăn vào" mà bản cũ bỏ
      //    lọt (đổi mã, mất cookie, đích khác).
      const [taoSach, taoRac] = await Promise.all([
        taoLaunch(cf, goi, cf.launchCampaignId, nguoiDungMoi()),
        taoLaunch(cf, goi, cf.launchCampaignId, nguoiDungMoi()),
      ]);
      if (!laLaunchUrl(taoSach.body) || !laLaunchUrl(taoRac.body)) {
        return truot(`không tạo được hai launch grant để đối chứng (status ${taoSach.status}/${taoRac.status})`);
      }
      const sach = await moLaunch(goi, taoSach.body.launchUrl);
      const rac = await moLaunch(goi, taoRac.body.launchUrl, {
        campaignId: `conf-campaign-khac-${randomUUID()}`,
      });
      if (sach.status !== 302) return truot(`lượt ĐỐI CHỨNG phải 302, nhận ${sach.status} — bài không đo được gì`);
      if (rac.status !== 302) {
        return truot(`mong 302 (trường lạ bị bỏ qua, KHÔNG làm hỏng lượt tiêu thụ), nhận ${rac.status}`);
      }
      const dichSach = sach.headers['location'] ?? '';
      const dichRac = rac.headers['location'] ?? '';
      if (dichRac !== dichSach) {
        return truot(
          `gắn \`campaignId\` lạ vào URL ĐÃ ĐỔI đích: sạch "${dichSach}" vs rác "${dichRac}" — ` +
            'server đang đọc một trường mà hợp đồng nói nó phải bỏ qua',
        );
      }
      return cookiesCua(rac).length > 0
        ? dat()
        : truot('lượt có trường lạ không nhận được `Set-Cookie` — trường bị gắn thêm đã phá phiên');
    },
  },
  {
    ma: 'LAUNCH-8',
    chieu: 'LAUNCH',
    ten: 'externalUserId từ launch khớp session tạo ra ⇒ đúng người dùng',
    capNangLuc: null,
    async chay(cf, goi) {
      // ⚠️ Session KHÔNG mang `externalUserId` (chỉ mang id chủ thể NỘI BỘ, cố ý — campaign-launch.md
      //    §6.2), và hợp đồng đã công bố không có endpoint "whoami" nào để tra ngược. Phép đo tương
      //    đương quan sát được bằng HTTP đen thui: 2 externalUserId KHÁC nhau ⇒ 2 session ĐỘC LẬP,
      //    phân biệt được — không phải khẳng định ở mức claim. Xem testing.md §1.5 vì sao giới hạn ở đây.
      const [taoA, taoB] = await Promise.all([
        taoLaunch(cf, goi, cf.launchCampaignId, nguoiDungMoi()),
        taoLaunch(cf, goi, cf.launchCampaignId, nguoiDungMoi()),
      ]);
      if (!laLaunchUrl(taoA.body) || !laLaunchUrl(taoB.body)) return truot('không tạo được cả hai launch grant để thử');
      const [rA, rB] = await Promise.all([moLaunch(goi, taoA.body.launchUrl), moLaunch(goi, taoB.body.launchUrl)]);
      if (rA.status !== 302 || rB.status !== 302) return truot(`cả hai lượt tiêu thụ phải 302, nhận ${rA.status}/${rB.status}`);
      // ALL the cookies of each turn, not the last one: a server may set a display cookie after the session cookie
      // (same value for two users of one campaign), and comparing only that would blame a correct server.
      const cookieA = cookiesCua(rA);
      const cookieB = cookiesCua(rB);
      if (cookieA.length === 0 || cookieB.length === 0) return truot('thiếu header `Set-Cookie` ở một trong hai lượt');
      return cookieA.join('\n') !== cookieB.join('\n') ? dat() : truot('hai externalUserId KHÁC nhau nhưng nhận CÙNG session — nghi lẫn danh tính');
    },
  },
  {
    ma: 'LAUNCH-9',
    chieu: 'LAUNCH',
    ten: '`segments` sai khuôn ⇒ 400 và KHÔNG có launch grant',
    capNangLuc: null,
    async chay(cf, goi) {
      // One wrong element refuses the WHOLE call, even next to a well-formed slug; upper case is refused, never normalised.
      const r = await taoLaunch(cf, goi, cf.launchCampaignId, nguoiDungMoi(), undefined, ['khach-moi', 'Khach-Moi']);
      if (r.status !== 400) return truot(`mong 400 cho một slug sai khuôn, nhận ${r.status}`);
      return laLaunchUrl(r.body) ? truot('lời gọi bị từ chối nhưng thân vẫn có `launchUrl` — một grant đã được tạo') : dat();
    },
  },
  {
    ma: 'LAUNCH-10',
    chieu: 'LAUNCH',
    ten: '`segments` đúng khuôn nhưng chưa khai cho tích hợp ⇒ launch vẫn thành công (nhóm chỉ không được gắn)',
    capNangLuc: null,
    async chay(cf, goi) {
      // A slug nobody declared for this integration. It must NOT fail the launch: "not declared yet" is an operations matter
      // that can be true now and false later, never a reason to lose a player's entry.
      const slug = `conf-chua-khai-${randomUUID().slice(0, 8)}`;
      const r = await taoLaunch(cf, goi, cf.launchCampaignId, nguoiDungMoi(), undefined, [slug]);
      if (r.status !== 200) return truot(`mong 200 (nhóm chưa khai không được làm hỏng launch), nhận ${r.status}`);
      return laLaunchUrl(r.body) ? dat() : truot('thân 200 phải có `launchUrl` dạng chuỗi');
    },
  },
];

export const CA_LAUNCH: readonly Ca[] = LAUNCH;
export const SO_CA_LAUNCH = LAUNCH.length;

// ── SETTLEMENT — 8 cases ────────────────────────────────────────────────────────────────
//
// 🔴 A THIRD, INDEPENDENT axis, same as LAUNCH: it never feeds the entry gate or the recovery rank.
//
// Direction: the suite plays the PLATFORM. It signs `PartnerSettlementSignatureV1` and calls YOUR receiver
// (`CONF_SETTLEMENT_URL`). It moves no points and changes nobody's balance: the numbers in the packet are
// fixtures.
//
// Signing string (contract/en/settlement.md section 3):
//   <timestamp> "." "POST" "." <path + query exactly as on the request line> "." <raw body>
//
// Inline on purpose, like every other helper in this file: copying three files must keep working.

/** Same freshness window as the platform: +-5 minutes. */
const SETTLEMENT_FRESHNESS_MS = 5 * 60_000;
/** The platform gives up after 10 s. */
const SETTLEMENT_REPLY_BUDGET_MS = 10_000;

/** `PartnerSettlementSignatureV1` — HMAC-SHA256 over `ts.POST.path.rawBody`, `sha256=<hex>`. */
export function kySettlement(secret: string, tsSeconds: number, method: string, pathAndQuery: string, rawBody: string): string {
  const base = Buffer.concat([
    Buffer.from(`${tsSeconds}.${method.toUpperCase()}.${pathAndQuery}.`, 'utf8'),
    Buffer.from(rawBody, 'utf8'),
  ]);
  return `sha256=${createHmac('sha256', secret).update(base).digest('hex')}`;
}

/** A settlement packet as the platform sends it (contract/en/settlement.md section 2.1). Fixture numbers only. */
function goiSettlement(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    settlementRef: `CONF-${randomUUID().slice(0, 8)}`,
    campaignId: randomUUID(),
    settlementItemId: `conf-item-${randomUUID()}`,
    partyId: `conf-party-${randomUUID().slice(0, 8)}`,
    denominationCode: 'CONF_POINT',
    pointAmount: '100',
    exchangeRateSnapshot: '10',
    moneyAmount: '1000',
    moneyCurrency: 'VND',
    deliveryNonce: `conf-nonce-${randomUUID()}`,
    ...over,
  };
}

/** Sign and POST one packet to the partner's receiver. `bad` lets a case break exactly one thing. */
async function banSettlement(
  cf: CauHinh,
  goi: GoiHttp,
  than: Record<string, unknown>,
  bad?: { signature?: string; tsSeconds?: number; redirect?: 'follow' | 'manual'; timeoutMs?: number; secret?: string },
): Promise<PhanHoi> {
  if (!cf.settlementUrl || !cf.settlementSecret) throw new Error('settlementUrl and settlementSecret are required for the SETTLEMENT cases');
  const u = new URL(cf.settlementUrl);
  const pathAndQuery = `${u.pathname}${u.search}`;
  const raw = JSON.stringify(than);
  const ts = bad?.tsSeconds ?? Math.floor(Date.now() / 1000);
  return goi(cf.settlementUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Platform-Key-Id': cf.settlementKeyId ?? 'conformance-settlement',
      'X-Platform-Timestamp': String(ts),
      'X-Platform-Signature': bad?.signature ?? kySettlement(bad?.secret ?? cf.settlementSecret, ts, 'POST', pathAndQuery, raw),
    },
    body: raw,
    redirect: bad?.redirect ?? 'manual',
    timeoutMs: bad?.timeoutMs,
  });
}

const is2xx = (r: PhanHoi): boolean => r.status >= 200 && r.status < 300;
/** The contract lists `401`/`403` for a bad signature; both are an honest refusal. */
const isAuthRefusal = (r: PhanHoi): boolean => r.status === 401 || r.status === 403;

const SETTLEMENT: Ca[] = [
  {
    ma: 'SETTLEMENT-1',
    chieu: 'SETTLEMENT',
    ten: 'valid packet => 2xx',
    capNangLuc: null,
    async chay(cf, goi) {
      // Positive control of the whole axis: without it, a receiver that refuses everything passes the other seven.
      const r = await banSettlement(cf, goi, goiSettlement());
      return is2xx(r) ? dat() : truot(`expected 2xx, got ${r.status}`);
    },
  },
  {
    ma: 'SETTLEMENT-2',
    chieu: 'SETTLEMENT',
    ten: 'same deliveryNonce, freshly signed => 409',
    capNangLuc: null,
    async chay(cf, goi) {
      const than = goiSettlement();
      const first = await banSettlement(cf, goi, than);
      if (!is2xx(first)) return truot(`could not deliver the first packet (got ${first.status}), nothing to replay`);
      // A new timestamp changes the signature bytes: the receiver must dedupe on the NONCE, not on the signature.
      const replay = await banSettlement(cf, goi, than, { tsSeconds: Math.floor(Date.now() / 1000) + 1 });
      return replay.status === 409
        ? dat()
        : truot(`expected 409 for a nonce already seen, got ${replay.status}; dedupe on deliveryNonce, not on signature or timestamp`);
    },
  },
  {
    ma: 'SETTLEMENT-3',
    chieu: 'SETTLEMENT',
    ten: 'ask again: identical request, same nonce => 409 (read as "already received")',
    capNangLuc: null,
    async chay(cf, goi) {
      // The platform's "Ask the partner again" resends the SAME packet with the SAME nonce and reads 409 as
      // "you already have it". A receiver that answers anything else there makes ops resend a settled amount.
      const than = goiSettlement();
      const ts = Math.floor(Date.now() / 1000);
      const first = await banSettlement(cf, goi, than, { tsSeconds: ts });
      if (!is2xx(first)) return truot(`could not deliver the first packet (got ${first.status}), nothing to ask about`);
      const again = await banSettlement(cf, goi, than, { tsSeconds: ts });
      return again.status === 409
        ? dat()
        : truot(`expected 409 when the very same packet arrives again, got ${again.status}; "ask again" depends on it`);
    },
  },
  {
    ma: 'SETTLEMENT-4',
    chieu: 'SETTLEMENT',
    ten: 'wrong signature => 401',
    capNangLuc: null,
    async chay(cf, goi) {
      const r = await banSettlement(cf, goi, goiSettlement(), { signature: `sha256=${'0'.repeat(64)}` });
      return isAuthRefusal(r) ? dat() : truot(`expected 401 (403 accepted), got ${r.status}; a packet with a bad signature must never be processed`);
    },
  },
  {
    ma: 'SETTLEMENT-5',
    chieu: 'SETTLEMENT',
    ten: 'timestamp older than 5 minutes (correctly signed) => 401',
    capNangLuc: null,
    async chay(cf, goi) {
      const stale = Math.floor((Date.now() - 2 * SETTLEMENT_FRESHNESS_MS) / 1000);
      // Signed with the stale timestamp, so ONLY the freshness window can reject it.
      const r = await banSettlement(cf, goi, goiSettlement(), { tsSeconds: stale });
      return isAuthRefusal(r) ? dat() : truot(`expected 401 (403 accepted) for a stale timestamp, got ${r.status}; enforce the +-5 minute window`);
    },
  },
  {
    ma: 'SETTLEMENT-6',
    chieu: 'SETTLEMENT',
    ten: 'same settlementItemId, new nonce => 2xx (do not dedupe on settlementItemId)',
    capNangLuc: null,
    async chay(cf, goi) {
      const itemId = `conf-item-${randomUUID()}`;
      const first = await banSettlement(cf, goi, goiSettlement({ settlementItemId: itemId }));
      if (!is2xx(first)) return truot(`could not deliver the first packet (got ${first.status})`);
      // Our ops pressing "Retry" sends the same item with a NEW nonce; refusing it blocks a legitimate retry.
      const retry = await banSettlement(cf, goi, goiSettlement({ settlementItemId: itemId }));
      return is2xx(retry)
        ? dat()
        : truot(`expected 2xx for the same settlementItemId with a new nonce, got ${retry.status}; your dedupe key must be deliveryNonce`);
    },
  },
  {
    ma: 'SETTLEMENT-7',
    chieu: 'SETTLEMENT',
    ten: 'replies within 10 seconds',
    capNangLuc: null,
    async chay(cf, goi) {
      const t0 = Date.now();
      const r = await banSettlement(cf, goi, goiSettlement(), { timeoutMs: SETTLEMENT_REPLY_BUDGET_MS });
      const ms = Date.now() - t0;
      if (!is2xx(r)) return truot(`expected 2xx, got ${r.status}`);
      return ms <= SETTLEMENT_REPLY_BUDGET_MS ? dat(`${ms} ms`) : truot(`took ${ms} ms; the platform gives up after ${SETTLEMENT_REPLY_BUDGET_MS} ms`);
    },
  },
  {
    ma: 'SETTLEMENT-8',
    chieu: 'SETTLEMENT',
    ten: 'does not answer with a redirect (3xx)',
    capNangLuc: null,
    async chay(cf, goi) {
      // The platform never follows 3xx. A receiver behind a redirect (http->https, trailing slash) looks dead to it.
      const r = await banSettlement(cf, goi, goiSettlement(), { redirect: 'manual' });
      if (r.status >= 300 && r.status < 400) {
        return truot(`got ${r.status}${r.headers['location'] ? ` to ${r.headers['location']}` : ''}; declare the FINAL url as your settlement endpoint`);
      }
      return is2xx(r) ? dat() : truot(`expected 2xx, got ${r.status}`);
    },
  },
];

/**
 * The rotation case. It is NOT one of the eight: it only runs when `settlementPreviousSecret` is set, because it needs the
 * OLD secret, which only the integrator has. Signed with the previous secret under the SAME `X-Platform-Key-Id` as the
 * other cases (the platform keeps the key id across rotations), so a receiver that picks ONE secret per key id fails here.
 */
export const CA_SETTLEMENT_ROTATION: Ca = {
  ma: 'SETTLEMENT-9',
  chieu: 'SETTLEMENT',
  ten: 'signed with the PREVIOUS secret under the same key id => 2xx (rotation overlap)',
  capNangLuc: null,
  async chay(cf, goi) {
    if (!cf.settlementPreviousSecret) return truot('CONF_SETTLEMENT_PREVIOUS_SECRET is not set');
    const r = await banSettlement(cf, goi, goiSettlement(), { secret: cf.settlementPreviousSecret });
    return is2xx(r)
      ? dat()
      : truot(
          `expected 2xx for a packet signed with the previous secret, got ${r.status}; while a rotation is in flight keep BOTH ` +
            'secrets under the same X-Platform-Key-Id and try them newest first',
        );
  },
};

export const CA_SETTLEMENT: readonly Ca[] = SETTLEMENT;
export const SO_CA_SETTLEMENT = SETTLEMENT.length;
