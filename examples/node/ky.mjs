#!/usr/bin/env node
// Ký gói tin sự kiện — khuôn `EventIngressSignatureV1`.
//
// Chạy tự kiểm (không cần mạng, không cần khoá thật):
//     node examples/node/ky.mjs --tu-kiem
//
// Luật chỉ có một dòng:  chuỗi ký = <timestamp> + "." + <thân THÔ>
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * @param {string} biMat        bí mật kênh sự kiện
 * @param {string|Buffer} than  ĐÚNG chuỗi/byte sẽ đem gửi — KHÔNG serialize lại
 * @param {number} tsGiay       giây kể từ epoch
 */
export function kyGoiTin(biMat, than, tsGiay) {
  const chuoiKy = Buffer.concat([
    Buffer.from(`${tsGiay}.`, 'utf8'),
    Buffer.isBuffer(than) ? than : Buffer.from(than, 'utf8'),
  ]);
  return 'sha256=' + createHmac('sha256', biMat).update(chuoiKy).digest('hex');
}

/** Gửi một gói tin. Trả nguyên phản hồi để bạn tự rẽ nhánh theo `code`. */
export async function guiSuKien({ api, accessKey, eventSecret, suKien }) {
  // 🔴 Serialize ĐÚNG MỘT LẦN. Ký chuỗi này, rồi gửi CHÍNH chuỗi này.
  //    Serialize lại trước khi ký là lỗi số một của mọi đợt tích hợp: chữ ký đúng vẫn trượt,
  //    lác đác, và trông y hệt sai khoá.
  const than = JSON.stringify(suKien);
  const ts = Math.floor(Date.now() / 1000);

  const r = await fetch(`${api}/integrations/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': accessKey,
      'X-Timestamp': String(ts),
      'X-Signature': kyGoiTin(eventSecret, than, ts),
    },
    body: than, // gửi ĐÚNG chuỗi vừa ký
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

/** Kiểm chữ ký người khác gửi tới — so theo THỜI GIAN HẰNG SỐ, đừng dùng `===`. */
export function chuKyKhop(mongDoi, nhanDuoc) {
  const a = Buffer.from(mongDoi);
  const b = Buffer.from(nhanDuoc ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Tự kiểm bằng VECTOR CỐ ĐỊNH (hợp đồng, Phụ lục B.1) ─────────────────────────────────────────
// Không cần mạng, không cần khoá thật. Đây nên là ca kiểm thử đơn vị ĐẦU TIÊN bạn viết.
const VECTOR = {
  biMat: 'whsec_demo_0123456789abcdef',
  ts: 1786698753,
  than:
    '{"specversion":"1.0","eventId":"evt-88421","externalUserId":"12345","type":"ORDER_COMPLETED",' +
    '"occurredAt":"2026-08-14T09:12:33Z","confidence":"SERVER_OBSERVED",' +
    '"payload":{"orderId":"SO-99881","amountMinor":250000000,"currency":"VND"}}',
  chuKy: 'sha256=ae00dc858385fdb65061fda5da1809772f8f602f5d653052e7672516c4d59176',
};

if (process.argv.includes('--tu-kiem')) {
  const ra = kyGoiTin(VECTOR.biMat, VECTOR.than, VECTOR.ts);
  const dat = ra === VECTOR.chuKy;
  console.log(`${dat ? '✅ ĐẠT' : '❌ TRƯỢT'}  EventIngressSignatureV1`);
  console.log(`   nhận : ${ra}`);
  if (!dat) {
    console.log(`   mong : ${VECTOR.chuKy}`);
    console.log('\n   Ba chỗ hay sai, kiểm theo thứ tự này:');
    console.log('     ① thiếu dấu "." giữa timestamp và thân');
    console.log('     ② serialize lại thân trước khi ký (đổi thứ tự khoá / khoảng trắng)');
    console.log('     ③ dùng base64 thay vì hex, hoặc hex viết HOA');
  }
  process.exit(dat ? 0 : 1);
}
