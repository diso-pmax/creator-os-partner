import { hkdfSync } from 'node:crypto';
import { CA_BAT_BUOC, CA_LAUNCH, SO_CA_LAUNCH, SO_CA_RA, SO_CA_VAO } from './cases';
import { ketQuaVaoCua, nangLucDaChungMinh, type CauHinh, type GoiHttp, type KetQuaCa } from './contract';

/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * BỘ CHẠY bài kiểm hợp chuẩn
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   CONF_API=https://api.example/api/v1 \
 *   CONF_ACCESS_KEY=AK-... CONF_EVENT_SECRET=... CONF_EVENT_TYPE=ORDER_COMPLETED \
 *   CONF_RECOVERY_URL=https://doi-tac.example/api/recovery \
 *     npx tsx run.ts
 *
 * 🔴 **KHÔNG có phụ thuộc nào ngoài hai file cạnh nó.** Không Prisma, không Nest, không biến môi
 *    trường của nền tảng. Bạn sao chép ba file là chạy được — đọc hợp đồng, hiện thực, chạy bộ kiểm
 *    này, rồi onboard.
 *
 * 🔴 **Bộ này KHÔNG ghi vào sổ nào.** Nó in ra. Ghi nhận hạng là việc của một cửa nội bộ có quyền
 *    và có nhật ký — bộ này không cầm khoá của cửa đó. Bạn chạy trên máy mình ⇒ kết quả không có
 *    đường nào tự vào sổ của nền tảng.
 */

/** Đường gọi THẬT. Tách khỏi bộ ca để ca tự nó kiểm được bằng phản hồi bơm tay. */
export const goiThat: GoiHttp = async (duong, tuyChon) => {
  // `redirect` mặc định 'follow' — giữ hành vi cũ cho VAO/RA (không bao giờ nhận 3xx). LAUNCH-2/3/6/7
  // (§ `cases.ts`) truyền `'manual'` để đọc được status/Location/Set-Cookie của chính lượt redirect.
  const r = await fetch(duong, { ...tuyChon, redirect: tuyChon.redirect ?? 'follow' });
  const text = await r.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Thân không phải JSON là một SỰ THẬT về phản hồi, không phải lỗi của bộ chạy — giữ nguyên văn
    // để câu "vì sao" của ca nói được điều gì đó có ích.
    body = { _thanTho: text.slice(0, 500) };
  }
  return { status: r.status, body, headers: Object.fromEntries(r.headers.entries()) };
};

/**
 * Chạy toàn bộ ca. Ca ném ⇒ tính là **TRƯỢT**, không làm rớt cả lượt.
 *
 * 🔴 Một ca ném thường là *"không kết nối được"* — và đó chính là một kết quả hợp chuẩn: bên đối ứng
 *    chưa dựng đường đó. Để ngoại lệ bay ra ngoài thì lượt chạy chết ở ca đầu tiên hỏng, và mười hai
 *    ca còn lại **không ai biết** đúng hay sai.
 */
export async function chayHopChuan(cf: CauHinh, goi: GoiHttp = goiThat): Promise<KetQuaCa[]> {
  const kq: KetQuaCa[] = [];
  for (const ca of CA_BAT_BUOC) {
    if (ca.chieu === 'RA' && !cf.diemCuoiPhucHoi) {
      // ⚠️ BỎ có khai báo. Im lặng bỏ qua thì bảng kết quả nhìn như đã chạy đủ, và một bên đối ứng
      //    chưa khai điểm cuối sẽ trông y hệt một bên đã pass hết chiều ra.
      kq.push({ ...ca, dat: false, vi: 'BỎ — chưa khai điểm cuối phục hồi (CONF_RECOVERY_URL)' });
      continue;
    }
    try {
      const r = await ca.chay(cf, goi);
      kq.push({ ma: ca.ma, chieu: ca.chieu, ten: ca.ten, capNangLuc: ca.capNangLuc, ...r });
    } catch (e) {
      kq.push({
        ma: ca.ma,
        chieu: ca.chieu,
        ten: ca.ten,
        capNangLuc: ca.capNangLuc,
        dat: false,
        vi: `ném: ${String((e as Error)?.message ?? e)}`,
      });
    }
  }
  return kq;
}

/**
 * Chạy 8 ca LAUNCH — TÁCH RIÊNG khỏi `chayHopChuan()` (xem `cases.ts` — cố ý không nằm trong
 * `CA_BAT_BUOC`). Cùng khuôn try/catch-mỗi-ca: một ca ném = TRƯỢT, không làm rớt cả lượt.
 *
 * ⏱️ LAUNCH-4 chờ ~61s thật (TTL) — lượt gọi hàm này tốn hơn một phút, đã khai ở testing.md §1.5.
 */
export async function chayLaunch(cf: CauHinh, goi: GoiHttp = goiThat): Promise<KetQuaCa[]> {
  const kq: KetQuaCa[] = [];
  for (const ca of CA_LAUNCH) {
    try {
      const r = await ca.chay(cf, goi);
      kq.push({ ma: ca.ma, chieu: ca.chieu, ten: ca.ten, capNangLuc: ca.capNangLuc, ...r });
    } catch (e) {
      kq.push({
        ma: ca.ma,
        chieu: ca.chieu,
        ten: ca.ten,
        capNangLuc: ca.capNangLuc,
        dat: false,
        vi: `ném: ${String((e as Error)?.message ?? e)}`,
      });
    }
  }
  return kq;
}

export function inBaoCaoLaunch(kq: readonly KetQuaCa[]): string {
  const dong = (c: KetQuaCa) => `  ${c.dat ? '✅' : '❌'} [${c.ma}] ${c.ten}${c.dat ? '' : ` — ${c.vi}`}`;
  const launch = kq.filter((c) => c.chieu === 'LAUNCH');
  return [
    `KÊNH LAUNCH — ${launch.filter((c) => c.dat).length}/${SO_CA_LAUNCH}`,
    ...launch.map(dong),
    '',
    // ⚠️ Cố ý KHÔNG gọi đây là "cổng vào cửa" — cổng đó (ketQuaVaoCua) hiện chỉ đọc chiều VAO
    //    (EVENT). Xem testing.md §1.5 vì sao LAUNCH chưa nối vào đó.
    'Kết quả LAUNCH được báo cáo NHƯ chiều VÀO, nhưng CHƯA nối vào cổng lên-thật tự động ở trên.',
  ].join('\n');
}

export function inBaoCao(kq: readonly KetQuaCa[]): string {
  const dong = (c: KetQuaCa) => `  ${c.dat ? '✅' : '❌'} [${c.ma}] ${c.ten}${c.dat ? '' : ` — ${c.vi}`}`;
  const vao = kq.filter((c) => c.chieu === 'VAO');
  const ra = kq.filter((c) => c.chieu === 'RA');
  const nl = nangLucDaChungMinh(kq);
  const vaoCua = ketQuaVaoCua(kq);
  return [
    `CỔNG VÀO CỬA — ${vaoCua}   (${vao.filter((c) => c.dat).length}/${SO_CA_VAO})`,
    ...vao.map(dong),
    vaoCua === 'FAIL' ? '  🔴 KHÔNG đạt cổng vào cửa ⇒ tích hợp KHÔNG được bật. Sửa rồi chạy lại.' : '',
    '',
    `CỔNG CẤP HẠNG — ${ra.filter((c) => c.dat).length}/${SO_CA_RA}`,
    ...ra.map(dong),
    '',
    `NĂNG LỰC CHỨNG MINH ĐƯỢC: ${nl.length ? nl.join(', ') : '(không có)'}`,
    // ⚠️ Hai cổng ĐỘC LẬP: trượt cổng vào cửa thì không được bật, nhưng hạng vẫn là phép đo riêng —
    //    SA bắt tách tên đích danh để hai thứ này không bị đọc lẫn vào nhau.
    '',
    'Kết quả này CHƯA vào sổ của nền tảng — nó chỉ IN RA để bạn tự sửa.',
    'Chỉ lượt chạy CỦA NỀN TẢNG (trỏ vào hệ thống bạn) mới ghi được hạng.',
  ].join('\n');
}

type Kenh = 'AUTH' | 'EVENT' | 'RECOVERY' | 'LAUNCH';

/**
 * `IntegrationCredentialDerivationV1` — HKDF-SHA256 · salt RỖNG · 32 byte · base64url không padding.
 *
 * 🔴 CỐ Ý viết nội tuyến, KHÔNG import từ đâu cả. Docstring đầu file hứa *"không phụ thuộc nào ngoài
 *    hai file cạnh nó… bạn sao chép ba file là chạy được"* — thêm một `import` là phá đúng lời hứa đó,
 *    và bộ kiểm thôi chạy được trên máy bạn.
 *
 * ⚠️ Bản này AN TOÀN vì `integration-credential-derivation-v1.test-vector.json` là vector CHUNG cho cả
 *    hai phía: lệch một ký tự thì vector không khớp. Bản sao nguy hiểm là bản không ai đối chiếu.
 */
/** ⭐ `export` để công cụ nội bộ dẫn xuất khoá kênh bằng CÙNG một hàm — xem chú ở `ky()`. */
export function danXuatKhoaKenh(masterSecret: string, kenh: Kenh, version: number): string {
  const ikm = Buffer.from(masterSecret, 'base64url');
  if (ikm.length !== 32 || ikm.toString('base64url') !== masterSecret) {
    throw new Error('CONF_MASTER_SECRET phải là 32 byte mã hoá base64url không padding (43 ký tự)');
  }
  const info = Buffer.from(`integration:channel:${kenh}:v${version}`, 'utf8');
  return Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), info, 32)).toString('base64url');
}

/**
 * 🔴 `CONF_MASTER_SECRET` là đường CHÍNH — bạn nhận **một** master và **tự dẫn xuất** khoá từng kênh;
 *    chúng tôi không phát bí mật rời cho mỗi kênh nữa (xem `credential-derivation.md`).
 *
 * Vẫn nhận `CONF_*_SECRET` rời: tích hợp cũ chưa cấp lại credential vẫn đang cầm bí mật rời, và bắt
 * họ đổi mới chạy được bộ kiểm là dựng một hàng rào ngay trước cái cửa dùng để **chứng minh mình
 * đúng**. Rời **thắng** master khi có cả hai — người khai tường minh thì đang cố ý.
 *
 * ⚠️ Version mặc định `1`. Xoay khoá lên `v2` mà quên đặt `CONF_*_VERSION` thì bộ kiểm ký bằng khoá
 *    `v1` và ăn `401` — trông y hệt "chữ ký sai". Vì thế báo cáo IN RA version đang dùng.
 */
function tuMoiTruong(): CauHinh {
  const can = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`thiếu biến môi trường ${k}`);
    return v;
  };
  const master = process.env.CONF_MASTER_SECRET || undefined;
  const ver = (k: string) => {
    const raw = process.env[k];
    if (!raw) return 1;
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < 1) throw new Error(`${k} phải là số nguyên dương, nhận "${raw}"`);
    return n;
  };
  /** Khoá kênh: ưu tiên bí mật rời nếu người chạy khai tường minh, không thì dẫn xuất từ master. */
  const khoaKenh = (kenh: Kenh, bienRoi: string, bienVer: string, batBuoc: boolean): string | undefined => {
    const roi = process.env[bienRoi];
    if (roi) return roi;
    if (!master) {
      if (!batBuoc) return undefined;
      throw new Error(
        `thiếu ${bienRoi} — hoặc đặt CONF_MASTER_SECRET để bộ kiểm tự dẫn xuất khoá kênh ${kenh} ` +
          `(xem docs/guide/partner/vi/credential-derivation.md)`,
      );
    }
    return danXuatKhoaKenh(master, kenh, ver(bienVer));
  };

  const cf: CauHinh = {
    cuaNenTang: can('CONF_API').replace(/\/$/, ''),
    accessKey: can('CONF_ACCESS_KEY'),
    eventSecret: khoaKenh('EVENT', 'CONF_EVENT_SECRET', 'CONF_EVENT_VERSION', true)!,
    loaiSuKien: can('CONF_EVENT_TYPE'),
    diemCuoiPhucHoi: process.env.CONF_RECOVERY_URL || undefined,
    // Bí mật kênh PHỤC HỒI. Vắng ⇒ chiều RA gọi không ký (xem `hoi()` ở `cases.ts`).
    recoverySecret: khoaKenh('RECOVERY', 'CONF_RECOVERY_SECRET', 'CONF_RECOVERY_VERSION', false),
    // LAUNCH là kênh danh tính HIỆN HÀNH (README § Required order) — BẮT BUỘC như EVENT, không có
    // nhánh "để trống thì bỏ qua" như RECOVERY.
    launchSecret: khoaKenh('LAUNCH', 'CONF_LAUNCH_SECRET', 'CONF_LAUNCH_VERSION', true)!,
    launchCampaignId: can('CONF_LAUNCH_CAMPAIGN_ID'),
  };

  // Nguồn khoá phải NHÌN THẤY ĐƯỢC: cùng một `401` có thể do sai secret, sai version, hoặc dẫn xuất
  // nhầm kênh — in ra thì người đọc log tự loại được hai nguyên nhân mà không phải đoán.
  const nguon = (bienRoi: string, bienVer: string) =>
    process.env[bienRoi] ? 'bí mật rời' : `dẫn xuất từ master, v${ver(bienVer)}`;
  console.log(
    `▶ khoá kênh: EVENT=${nguon('CONF_EVENT_SECRET', 'CONF_EVENT_VERSION')} · ` +
      `LAUNCH=${nguon('CONF_LAUNCH_SECRET', 'CONF_LAUNCH_VERSION')} · ` +
      `RECOVERY=${cf.recoverySecret ? nguon('CONF_RECOVERY_SECRET', 'CONF_RECOVERY_VERSION') : 'không có (7 ca chiều RA sẽ SKIPPED)'}`,
  );
  return cf;
}

// Chạy trực tiếp thì thi hành; `import` thì không. Giữ file vừa là thư viện vừa là lệnh.
if (process.argv[1] && process.argv[1].endsWith('run.ts')) {
  const cf = tuMoiTruong();
  Promise.all([chayHopChuan(cf), chayLaunch(cf)])
    .then(([kq, kqLaunch]) => {
      console.log(inBaoCao(kq));
      console.log('');
      console.log(inBaoCaoLaunch(kqLaunch));
      // 🔴 Mã thoát KHÁC 0 khi có ca trượt Ở BẤT KỲ bộ nào — "không có ô gần đạt" áp cho CẢ HAI.
      const tatCa = [...kq, ...kqLaunch];
      process.exit(tatCa.every((c) => c.dat) ? 0 : 1);
    })
    .catch((e) => {
      console.error(`KHÔNG chạy được: ${String((e as Error)?.message ?? e)}`);
      process.exit(2);
    });
}
