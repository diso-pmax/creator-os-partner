# Program Link — hướng dẫn kỹ thuật tích hợp cho đối tác

[Điểm vào](README.md) · [Dẫn xuất khoá](credential-derivation.md) · [Kênh EVENT chung](event-ingestion.md) · [Recovery](recovery.md) · [Bản tiếng Anh chốt contract](../en/program-link.md)

Hướng dẫn mô tả profile PROGRAM_LINK 1.0 đã triển khai: quy công đơn ngoài và hoa hồng SKU. Request thành công không chứng minh attribution, EE phát khoản, Finance xác nhận hay đã trả tiền. Kiểm chứng capture đối tác thật là điều kiện triển khai riêng.

## 1. Endpoint và khách không đăng nhập

Callback từ server đối tác gửi `POST /api/v1/integrations/events`. URL điều hướng ngắn là `GET /l/:linkRef` (có alias `/api/v1/l/:linkRef`): redirect đến đích shop đã cấu hình và thêm tracking. Đích cố định, dán URL và link sản phẩm dùng cùng callback contract. Endpoint `/integrations/link-conversions` đã xoá.

**Campaign LAUNCH không bắt buộc cho Link.** Buyer có thể checkout mà không đăng nhập Creator-OS. Envelope hợp lệ LINK_ORDER_* + PROGRAM_LINK cho phép bỏ `externalUserId`; nếu gửi, đó là ID opaque của buyer/session do đối tác cấp, không là CTV hưởng. Giữ nguyên qua retry; không tạo ID từ click_ref/link_ref/CTV. Legacy Reward vẫn giữ yêu cầu externalUserId/LAUNCH của luồng đó.

## 2. Chuẩn bị cấu hình

1. Nhận origin bản cài, accessKey, masterSecret và version kênh EVENT; dẫn xuất khoá theo credential contract, giữ secret trên server.
2. Operator map từng `LINK_ORDER_*` dùng với credential sang source registry đúng namespace. Source phải active, DISCRETE, ECONOMIC_EVENT, ATTRIBUTED hoặc NONE. Payload không tự chọn tenant/source authority.
3. Operator bật/publish Link trong Program và chọn event-source UUID được phép. Tool đã cấp ghim source set; đổi cấu hình không nâng quyền tool cũ.
4. Cung cấp external order/product/SKU ID chính xác. Để tính hoa hồng, operator cần đúng một NATIVE Commerce source cùng tenant đủ điều kiện, có `CommerceSource.eventSourceCode == EventSourceRegistry.code` và `identityScopeId` khớp, cùng exact Product/SKU external refs. Không match theo CommerceSource.code, tên hiển thị hoặc nhãn shop. Product/SKU aliases phải tồn tại không muộn hơn `transaction.createdAt`; backfill mapping sau anchor không sửa original qualification. Thiếu/ambiguous mapping chặn tiền. Không tự map theo tên/URL/ID giống nhau ở shop khác.
5. Publish Terms hoa hồng SKU trước anchor tạo đơn. Policy ghim ở `transaction.createdAt`, độc lập revision URL tool. Publish muộn không sửa commitment gốc bị thiếu.
6. Chứng minh capture thật xuyên redirect/login/payment/checkout và bind order để platform review SAME_DEVICE_LAST_CLICK. VERIFIED phải có hiệu lực tại click và anchor; chữ ký callback không thay proof. Không có payload flag cho đối tác tự bypass.

Thiếu externalSkuId chỉ fallback khi product có đúng một variant, tính cả inactive, và variant duy nhất ACTIVE/eligible. Một ACTIVE cộng một INACTIVE vẫn ambiguous; nên gửi explicit externalSkuId. Đơn native đã có Sales commitment hoặc đang chờ native acceptance không được tạo Link commission thứ hai; backfill alias native cũng có fence.

## 3. Giữ tracking trên shop

Đọc `source=creatoros`, `link_ref`, `click_ref` từ URL landing; giữ nguyên UUID xuyên checkout và bind click được chọn vào order lúc tạo. Mỗi redirect sinh click_ref mới. Tracking order bất biến qua các snapshot; click sau không ghi đè order trước. `sub1..sub3` là nhãn báo cáo, không identity; không thêm chúng vào object conversion.tracking strict.

Chọn eligible last click của cùng buyer/device, không lấy click mới nhất của khách khác. Cửa sổ hiện tại30 ngày từ click đến anchor tạo đơn, gồm đúng biên30 ngày; anchor không được trước click. Hệ thống còn xét consent, Program lịch sử và source được phép. Không bảo đảm cross-device. Không đặt secret hoặc PII buyer trên URL.

Schema cho phép thiếu refs để lưu unresolved; attribution thành công cần click_ref hợp lệ. Có thể suy link_ref từ click nhưng nên gửi cả hai. UUID ví dụ chỉ đúng syntax, không chứng minh tracking.

## 4. Event nào, gửi lúc nào

| Outer type / inner type | Thời điểm | Snapshot còn lại |
|---|---|---|
| LINK_ORDER_CREATED / ORDER_CREATED | Tạo order, gửi sớm trước state sau | Toàn bộ line gốc, quantity dương, predecessor null |
| LINK_ORDER_COMPLETED / ORDER_COMPLETED | Đạt completion milestone đã đăng ký | Toàn bộ line hiện hành; đủ authority mới có thể ISSUE |
| LINK_ORDER_RETURNED / ORDER_RETURNED | Partial/full return đổi remaining basis | Giữ mọi line gốc, remaining quantity/net gồm line về0 |
| LINK_ORDER_CANCELLED / ORDER_CANCELLED | Huỷ order | Mọi line quantity0 và merchandiseNetMinor "0" |
| LINK_ORDER_CORRECTED / ORDER_CORRECTED | Sửa explicit predecessor ngay trước | Full corrected state + correction evidence |

Completion là milestone chốt khi đăng ký source; hệ thống không đoán paid/delivered/hết cửa sổ return từ status shop. CREATED ghim khoản dự kiến, không là đã trả. Return/correction tính target lũy kế theo rate gốc; Finance xử lý adjustment riêng. Callback không được chọn beneficiary/rate hoặc authoritatively khai PAID/settlement.

## 5. Payload CREATED đầy đủ

Thay UUID tracking bằng giá trị redirect thật, external IDs bằng namespace đã map. Dates ISO-8601 UTC; occurredAt là thời gian việc xảy ra, không phải thời gian gửi. Outer eventId/occurredAt phải bằng inner; outer type bằng `LINK_` + inner type.

```json
{
  "specversion": "1.0",
  "eventId": "order-1001-created",
  "type": "LINK_ORDER_CREATED",
  "occurredAt": "2026-10-03T03:00:00Z",
  "payload": {
    "profile": "PROGRAM_LINK",
    "schemaVersion": "1.0",
    "conversion": {
      "contractVersion": "1.0",
      "snapshotKind": "FULL_STATE",
      "eventId": "order-1001-created",
      "type": "ORDER_CREATED",
      "occurredAt": "2026-10-03T03:00:00Z",
      "transaction": {
        "externalOrderId": "order-1001",
        "sourceRevision": "1",
        "previousSourceRevision": null,
        "createdAt": "2026-10-03T03:00:00Z"
      },
      "tracking": {
        "source": "creatoros",
        "link_ref": "11111111-1111-4111-8111-111111111111",
        "click_ref": "22222222-2222-4222-8222-222222222222"
      },
      "money": { "unit": "MONEY", "denomination": "VND", "scale": 0 },
      "lines": [{
        "externalLineId": "line-1",
        "externalProductId": "product-42",
        "externalSkuId": "sku-42-red",
        "quantity": 2,
        "merchandiseNetMinor": "150001",
        "taxMinor": "15000",
        "shippingMinor": "20000"
      }]
    }
  }
}
```

Các trường envelope `externalUserId`, `seq`, `confidence` tuỳ chọn. seq là thứ tự stream sender, không là order revision/predecessor. Profile/conversion/transaction/line strict, không thêm custom fields. IDs order/line dài1–200 ký tự;1–100 line có externalLineId duy nhất; quantity integer0–10000. Amount minor là chuỗi số nguyên không âm tối đa24 chữ số, không dấu/thập phân/zero đầu trừ "0". Transport nhận unit MONEY, denomination uppercase identifier, scale0–18; commission hiện chỉ VND/scale0 và chặn money ngoài phạm vi EE. merchandiseNetMinor là tổng giá trị merchandise còn lại của line sau discount, loại tax/shipping, không là giá một đơn vị và không lấy giá catalog hiện tại thay tiền hàng ngoài.

## 6. Revision, return và correction

sourceRevision là chuỗi số nguyên dương tăng dần, tối đa20 chữ số; previousSourceRevision trỏ exact snapshot ngay trước đã accepted. Không bắt buộc số liên tiếp. CREATED đầu tiên predecessor null. Việc mới dùng eventId mới; transport retry giữ eventId/body cũ. Luôn gửi FULL_STATE, giữ mọi line gốc/product/SKU ID kể cả đã full return. createdAt/tracking/money/line identities bất biến. Quantity/net không vượt gốc; non-correction không tăng so snapshot trước. occurredAt không lùi.

Từ body CREATED trên, mỗi dòng sau thay outer và inner eventId/type/occurredAt; các field không đổi vẫn phải gửi đầy đủ:

| EventId | Outer type | occurredAt | Revision / predecessor | quantity / merchandiseNetMinor |
|---|---|---|---|---|
| order-1001-completed | LINK_ORDER_COMPLETED | 2026-10-03T04:00:00Z | "2" / "1" |2 / "150001" |
| order-1001-returned | LINK_ORDER_RETURNED | 2026-10-04T04:00:00Z | "3" / "2" |1 / "75001" |
| order-1001-corrected | LINK_ORDER_CORRECTED | 2026-10-04T05:00:00Z | "4" / "3" |2 / "150001" |
| order-1001-cancelled | LINK_ORDER_CANCELLED | 2026-10-04T06:00:00Z | "5" / "4" |0 / "0" |

Revision4 thêm vào conversion:

```json
{ "correction": { "reason": "Return record entered in error", "correctsSourceRevision": "3", "resultingState": "COMPLETED" } }
```

Correction chỉ có và bắt buộc ở ORDER_CORRECTED; correctsSourceRevision bằng previousSourceRevision. Có thể tăng remaining trong ceiling gốc và chọn resultingState CREATED/COMPLETED/RETURNED/CANCELLED. Corrected cancellation vẫn phải zero. Transition thường: CREATED→COMPLETED/CANCELLED; COMPLETED→COMPLETED/RETURNED/CANCELLED; RETURNED→RETURNED/CANCELLED; CANCELLED không có successor thường. Reopen cần correction evidence.

Partial return gửi cumulative remaining, không gửi refund delta làm remaining net. Tax/shipping vẫn nonnegative explicit; cancelled phải quantity/net0 (tax/shipping là giá trị còn lại thực, thường0). Không bỏ line hoặc đổi SKU/product qua correction.

## 7. Ký và gửi

HMAC-SHA256 trên bytes chính xác `X-Timestamp + "." + rawBody`. X-Timestamp là Unix **seconds**, trong ±5 phút. X-API-Key là accessKey; X-Signature hex lowercase, có thể prefix sha256=. EVENT key là chuỗi base64url đã dẫn xuất từ masterSecret, dùng nguyên chuỗi làm HMAC key. Đồng bộ clock, dùng HTTPS.

```js
// Node.js. Keep credentials on your server. Read body.json once; send these bytes.
const { readFileSync } = require('node:fs');
const { hkdfSync, createHmac } = require('node:crypto');
const eventKey = Buffer.from(hkdfSync(
  'sha256', Buffer.from(process.env.MASTER_SECRET, 'base64url'), Buffer.alloc(0),
  Buffer.from(`integration:channel:EVENT:v${process.env.EVENT_VERSION}`, 'utf8'), 32,
)).toString('base64url'); // use this STRING as HMAC key; do not decode it again
const rawBody = readFileSync('body.json');
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = 'sha256=' + createHmac('sha256', eventKey)
  .update(Buffer.concat([Buffer.from(timestamp + '.', 'utf8'), rawBody])).digest('hex');
fetch(process.env.CREATOROS_ORIGIN + '/api/v1/integrations/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.ACCESS_KEY,
    'X-Timestamp': timestamp, 'X-Signature': signature },
  body: rawBody,
}).then(async response => console.log(response.status, await response.text()));
```

Retry giữ semantic content/eventId/business dates/buyer ID; tạo timestamp/signature mới. Serialize một lần, ký và gửi cùng bytes. Không giữ secret ở browser/mobile. Rotation dùng version được cấp và credential contract, không tự đoán version.

Độ tươi occurredAt business của event mới được kiểm riêng với signing headers. Thứ tự ưu tiên: integration `maxDeliveryLatenessMin` / `maxFutureSkewSec`, rồi env bản cài `PARTNER_MAX_DELIVERY_LATENESS_MIN` / `PARTNER_MAX_FUTURE_SKEW_SEC`, rồi mặc định delivery lateness từ `ACCRUAL_GRACE_DAYS` (30 ngày nếu chưa đặt) và future skew300 giây. Quá cũ/tương lai trả422 event_too_late/event_from_future; hỏi operator limit/recovery, không đổi business dates để làm event cũ thành mới. Duplicate đã accepted bỏ qua phép kiểm freshness event mới. Đây không là cửa sổ attribution30 ngày hoặc bảo đảm đủ điều kiện tiền lịch sử.

## 8. ACK, lỗi và recovery

Response single-event thành công:

```json
{ "eventId": "order-1001-created", "deduplicated": false, "deliveryId": "optional-attempt-reference" }
```

200 nghĩa common intake đã durable accepted/deduplicated để xử lý async. deliveryId tuỳ chọn; không mong receiptRef/conversionRef, attribution hoặc amount đồng bộ. Lưu response cùng outbound event. deduplicated true là success, không tạo ID mới. Worker có thể sau đó ghi GAP/ORIGINAL_MISSING/CONFLICT/STALE hoặc unresolved quy công/hoa hồng. Receipt/case replay là workflow operator, chưa có public partner status/payout callback riêng.

| Kết quả | Bên gửi làm gì |
|---|---|
|400 | Sửa envelope/profile/schema hoặc inner/outer mismatch, không retry mù |
|401/403 | Sửa credential/signature/clock/quyền trước retry |
|422 | Làm rõ registered type/source/schema config hoặc identity collision; giữ code/delivery reference |
|429 | Theo Retry-After nếu có, backoff |
|5xx/timeout/mất response | Retry cùng eventId/body với signing headers mới, exponential backoff có giới hạn |

Cùng source eventId khác conversion/buyer identity là collision. Canonical order là namespace+externalOrderId; các channel cùng namespace phải mô tả cùng history. Gap accepted không advance head: gửi missing original/predecessor qua intake rồi nhờ operator replay pending receipt đã lưu. Chỉ gửi lại event đã dedup không bảo đảm projection replay. Không reset revision/đổi eventId để giấu conflict.

Giữ outbound log durable: eventId/order/revision/predecessor/body hash/business dates/responses. Chốt optional sender manifest/query/replay theo recovery guide; Link không mở recovery endpoint mới hay bảo đảm mọi partner có backfill. Receiver không biết event chưa từng gửi nếu thiếu sender evidence. Operator có quyền xem source receipt/case và replay; close case chỉ ghi nhận xử lý, không tạo attribution/tiền/Finance approval.

## 9. Checklist tích hợp

- Map đủ năm type và exact source/product/SKU namespace; kiểm không collision giữa shop.
- Capture redirect thật xuyên guest checkout/login/payment; ghim cả refs lúc tạo order; platform review có hiệu lực prospectively.
- Kiểm CREATED→COMPLETED→partial return→correction→cancel, full immutable lines và rate lịch sử.
- Kiểm lost ACK/retry, eventId collision, original/predecessor đảo thứ tự, tracking/SKU thiếu.
- Phân biệt200 intake với accepted fact/attributed order/qualified commission/official EE/Finance readiness; không suy PAID.
- Tách live capture verification khỏi sandbox synthetic; authority mới không adopt hồi tố click/order gốc chưa verified.
