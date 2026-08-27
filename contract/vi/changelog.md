# Changelog

*(bản dịch của [en/changelog.md](../en/changelog.md) — bản tiếng Anh là nguồn chốt, lệch thì bản tiếng
Anh thắng)*

## 1.3 — 2026-08-26

- Đối tác nay giữ một `masterSecret` và dẫn xuất khoá riêng từng kênh theo
  [`IntegrationCredentialDerivationV1`](./credential-derivation.md).
- Xoay từng kênh công bố tường minh version mới; version cũ và mới chồng lấn tới lúc thu hồi.
- Thêm vector HKDF máy đọc được, dùng chung với bộ test backend Creator-OS.

## 1.2 — 2026-08-25

**Đã gỡ bỏ kênh AUTH.** Chưa partner nào từng tích hợp nó trong production, nên việc này chi phí
migration = 0. `identity-transfer.md` đã bị xóa; mọi cross-reference tới nó trong bộ tài liệu này đã
được gỡ hoặc viết lại để mô tả LAUNCH.

- [README.md](./README.md), [error-codes.md](./error-codes.md), [testing.md](./testing.md),
  [event-ingestion.md](./event-ingestion.md) — mọi mục/dòng riêng cho AUTH đã bị gỡ.
- Access Key nay đi cùng **ba** Secret Key (EVENT, LAUNCH, RECOVERY), không phải bốn.
- `IdentityHandoffSignatureV1` không còn tồn tại như một khuôn ký đang sống — xem `1.1` bên dưới để
  biết bối cảnh lịch sử lúc AUTH còn hoạt động.

## 1.1 — 2026-08-25

**Kênh mới: LAUNCH (Campaign Launch)** — xem [campaign-launch.md](./campaign-launch.md). Đây là một
thay đổi hợp đồng thật, không phải tái cấu trúc: một kênh mới, Secret Key thứ tư, hai endpoint mới
(`POST /api/v1/campaigns/:campaignId/launch`, `GET /api/v1/launch`).

- **AUTH nay đã deprecated.** `identity-transfer.md` mang thông báo deprecation ở đầu. Tích hợp AUTH
  hiện có tiếp tục chạy không đổi; tích hợp mới được yêu cầu dựng trên LAUNCH thay vào đó. *(AUTH đã bị
  gỡ bỏ hoàn toàn ở `1.2` — tài liệu này không còn tồn tại.)*
- [README.md](./README.md) — bảng kênh, mục thứ tự bắt buộc, và bảng ngữ nghĩa định danh đã cập nhật để
  tả LAUNCH là kênh danh tính/session hiện hành.
- [error-codes.md](./error-codes.md) — thêm tra cứu mã lỗi kênh LAUNCH.
- LAUNCH tái dùng khuôn ký của kênh EVENT (`EventIngressSignatureV1`) với secret riêng — nó **không**
  đưa vào một giao thức xác thực mới.

## 1.0 — 2026-08-25

Phát hành lần đầu bộ tài liệu contract dành cho developer, gồm bản tiếng Anh (`en/`) và bản dịch tiếng
Việt này (`vi/`):

- [README.md](./README.md) — điểm vào, luật thứ tự bắt buộc giữa các kênh
- [event-ingestion.md](./event-ingestion.md) — hợp đồng kênh EVENT
- `identity-transfer.md` — hợp đồng kênh AUTH *(đã gỡ bỏ ở `1.2`; tài liệu này không còn tồn tại)*
- [recovery.md](./recovery.md) — năng lực đối soát/backfill/replay tuỳ chọn
- [error-codes.md](./error-codes.md) — tra cứu mã lỗi hợp nhất
- [testing.md](./testing.md) — bộ kiểm hợp chuẩn, vector kiểm thử, xoay khoá, checklist trước khi lên thật

Bộ này thay thế hai tài liệu tiếng Việt trước đó (`hop-dong-tich-hop-su-kien.md`,
`hop-dong-ban-giao-danh-tinh.md`). Không có protocol, endpoint, field, hay khuôn ký nào đổi — đây là
việc tái cấu trúc tài liệu, không phải đổi hợp đồng. Hành vi đã đóng băng giữ nguyên: bảng mã HTTP,
nghĩa của `200`, chống trùng dựa trên `eventId`, và ba khuôn ký có tên (`EventIngressSignatureV1`,
`IdentityHandoffSignatureV1`, `PartnerRecoverySignatureV1`).

Thay đổi phá vỡ tương thích của hợp đồng nền sẽ được công bố ở đây trước khi có hiệu lực.
