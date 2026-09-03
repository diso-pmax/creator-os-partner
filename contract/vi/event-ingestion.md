# Kênh EVENT — Hợp đồng nhận sự kiện

**Bản 1.0 · 2026-08-25** · Bắt đầu từ: [README.md](./README.md). *(bản dịch của
[en/event-ingestion.md](../en/event-ingestion.md) — bản tiếng Anh là nguồn chốt, lệch thì bản tiếng
Anh thắng)*

> 🔴 Một sự kiện chỉ sinh quyền lợi nếu người dùng đó đã qua kênh LAUNCH ít nhất một lần. Kênh này một
> mình không đủ — xem [README.md § Thứ tự bắt buộc](./README.md).

## 1. Tổng quan

```text
Partner server                          Creator-OS
     │                                       │
     │  POST /api/v1/integrations/events     │
     ├──────────────────────────────────────▶│
     │                                       ├─ authenticate (Access Key)
     │                                       ├─ verify signature (HMAC-SHA256)
     │                                       ├─ verify timestamp freshness (±5 min)
     │                                       ├─ validate envelope + payload shape
     │                                       ├─ deduplicate by eventId
     │                                       ├─ persist (raw storage — always, even if step below fails)
     │                                       └─ resolve subject + credit reward (async, best-effort)
     │◀──────────────────────────────────────┤
     │  200 { eventId, deliveryId, deduplicated }
```

Kênh này một chiều: máy chủ của bạn gọi chúng tôi. Chúng tôi không bao giờ gọi ngược lại máy chủ của
bạn ở kênh này (xem [recovery.md](./recovery.md) cho ngoại lệ duy nhất — chiều ngược dùng cho đối
soát).

## 2. Điều kiện tiên quyết

- Bạn có `accessKey` và Secret Key kênh **EVENT** (xem [README.md](./README.md)).
- Bạn có máy chủ có khả năng tính HMAC-SHA256 và gửi request HTTPS `POST`.
- **Khuyến nghị mạnh**: tích hợp LAUNCH của bạn ([campaign-launch.md](./campaign-launch.md)) đã gửi
  cùng một định danh người dùng làm `externalUserId`. Sự kiện của người dùng chưa từng qua LAUNCH vẫn
  được nhận nhưng không bao giờ sinh quyền lợi — xem [README.md § Thứ tự bắt buộc](./README.md).

## 3. Xác thực

| Mục | Hợp đồng |
|---|---|
| Header Access Key | `X-API-Key` |
| Header timestamp | `X-Timestamp` — **giây** kể từ epoch (không phải mili-giây) |
| Header chữ ký | `X-Signature` |
| Thuật toán | HMAC-SHA256 |
| Secret | Secret Key kênh EVENT |
| Mã hoá | kết quả chữ ký là **hex viết thường**, tiền tố `sha256=` |
| Chuỗi ký chuẩn | `<X-Timestamp>` + `"."` + `<thân request thô, đúng byte>` |
| Độ tươi timestamp | ±5 phút |
| Timestamp sai/hết hạn | `401` |
| Chữ ký sai | `401` |
| Access Key không tồn tại/đã thu hồi | `401` |

**Công thức ký:**

```text
canonical_string = timestamp + "." + raw_body
signature        = "sha256=" + hex(HMAC_SHA256(EVENT_KEY, canonical_string))
```

🔴 **`EVENT_KEY` KHÔNG phải thứ chúng tôi phát cho bạn.** Bạn nhận **một** `masterSecret` *(hiện đúng
một lần lúc chúng tôi cấp credential)* và **tự dẫn xuất** khoá cho từng kênh:

```text
EVENT_KEY = HKDF-SHA256( ikm  = base64url_decode(masterSecret),
                         salt = rỗng,
                         info = "integration:channel:EVENT:v<VERSION>",
                         len  = 32 )   → mã hoá base64url không padding
```

Bản hợp đồng đầy đủ, cách xoay khoá, và **vector kiểm thử để bạn đối chiếu**:
[credential-derivation.md](./credential-derivation.md). Chạy khớp vector là code dẫn xuất của bạn
đúng — khỏi đoán.

⚠️ `<VERSION>` là số version **của chính kênh đó**, chúng tôi báo khi cấp credential *(thường bắt đầu
từ `1`)*. Xoay khoá làm số này tăng, và bạn phải đổi theo — nó không tự suy ra được.

`raw_body` PHẢI là **đúng dãy byte** truyền trên đường dây — không phải bản serialize lại từ object đã
parse. Đây là lỗi tích hợp phổ biến nhất (xem §3.1).

🔒 Secret Key kênh EVENT PHẢI chỉ nằm ở máy chủ của bạn — không bao giờ trong ứng dụng di động, trình
duyệt, hay kho mã nguồn. Ai cầm nó đều ký giả được sự kiện mạo danh bạn.

🔒 Secret Key kênh EVENT KHÔNG ĐƯỢC dùng lại cho kênh LAUNCH, dù cả hai cùng một `accessKey`. Xem
[README.md](./README.md) để biết lý do.

### 3.1 ⚠️ Lỗi hay gặp nhất: serialize lại trước khi ký

Lỗi này gây ra `401` không liên tục trên **một phần** request, trông y hệt sai khoá — nhiều đội mất
hàng giờ kiểm tra lại credential trước khi tìm ra lỗi này.

```text
SAI                                          ĐÚNG
───────────────────────────────────────     ───────────────────────────────────────
body = serialize(obj)                       body = serialize(obj)
sig  = sign(serialize(obj))   ← lần 2!       sig  = sign(body)
send(serialize(obj))          ← lần 3!       send(body)
```

Serialize lại có thể đổi thứ tự khoá, khoảng trắng, hay cách thoát ký tự Unicode. Chữ ký phủ **byte**,
nên chỉ cần lệch một byte là hỏng.

**Luật: serialize đúng MỘT lần, giữ lại chuỗi/mảng byte đó, ký nó, và gửi nó.**

⚠️ Nếu framework của bạn có middleware đọc rồi dựng lại thân request (một số HTTP client, một số lớp
logging), hãy chắc nó không chạm vào thân request sau khi bạn đã ký.

### 3.2 Ví dụ đầy đủ

```bash
API='https://<host của môi trường bạn dùng>/api/v1'   # xem bảng môi trường ở README.md
ACCESS_KEY='<accessKey chúng tôi cấp>'
MASTER_SECRET='<masterSecret — base64url 43 ký tự, hiện MỘT LẦN>'
EVENT_VERSION=1                                       # version kênh EVENT, chúng tôi báo khi cấp

# ⬇️ DẪN XUẤT khoá kênh EVENT từ masterSecret — KHÔNG dùng thẳng masterSecret để ký.
EVENT_KEY=$(node -e '
  const { hkdfSync } = require("node:crypto");
  const ikm  = Buffer.from(process.argv[1], "base64url");     // 43 ký tự → 32 byte
  const info = Buffer.from(`integration:channel:EVENT:v${process.argv[2]}`, "utf8");
  process.stdout.write(
    Buffer.from(hkdfSync("sha256", ikm, Buffer.alloc(0), info, 32)).toString("base64url"));
' "$MASTER_SECRET" "$EVENT_VERSION")

BODY='{"specversion":"1.0","eventId":"evt-88421","externalUserId":"12345","type":"ORDER_COMPLETED","occurredAt":"2026-08-14T09:12:33Z","confidence":"SERVER_OBSERVED","payload":{"orderId":"SO-99881","amountMinor":250000000,"currency":"VND"}}'
TS=$(date +%s)          # epoch GIÂY — không phải mili-giây

# ⚠️ `$EVENT_KEY` là chuỗi base64url. Dùng NGUYÊN VĂN làm khoá HMAC — KHÔNG giải base64 lần nữa.
SIG="sha256=$(printf '%s.%s' "$TS" "$BODY" \
      | openssl dgst -sha256 -hmac "$EVENT_KEY" -r | cut -d' ' -f1)"
# → sha256=ae00dc858385fdb65061fda5da1809772f8f602f5d653052e7672516c4d59176

curl -sS -D- "$API/integrations/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key:   $ACCESS_KEY" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  --data-binary "$BODY"
```

⚠️ **Dùng `--data-binary`, không phải `-d`.** `curl -d` có thể cắt xuống dòng và đổi dãy byte đang
gửi, khiến nó không khớp với byte bạn đã ký.

**Node.js:**

```js
const crypto = require('node:crypto');

function signEvent(secret, rawBody, timestampSeconds) {
  const base = Buffer.concat([
    Buffer.from(`${timestampSeconds}.`, 'utf8'),
    Buffer.from(rawBody, 'utf8'),   // ĐÚNG chuỗi bạn sẽ gửi
  ]);
  return 'sha256=' + crypto.createHmac('sha256', secret).update(base).digest('hex');
}

// Dẫn xuất MỘT LẦN lúc khởi động, giữ trong bộ nhớ — đừng dẫn xuất lại mỗi request.
function deriveChannelKey(masterSecret, channel, version) {
  const ikm  = Buffer.from(masterSecret, 'base64url');            // 43 ký tự → 32 byte
  const info = Buffer.from(`integration:channel:${channel}:v${version}`, 'utf8');
  return Buffer.from(crypto.hkdfSync('sha256', ikm, Buffer.alloc(0), info, 32)).toString('base64url');
}
const EVENT_KEY = deriveChannelKey(MASTER_SECRET, 'EVENT', EVENT_VERSION);

const body = JSON.stringify(event);            // serialize MỘT LẦN
const ts   = Math.floor(Date.now() / 1000);
const sig  = signEvent(EVENT_KEY, body, ts);   // ⚠️ khoá KÊNH, không phải masterSecret
await fetch(`${API}/integrations/events`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': ACCESS_KEY, 'X-Timestamp': String(ts), 'X-Signature': sig },
  body,                                          // gửi ĐÚNG chuỗi bạn vừa ký
});
```

## 4. Vector kiểm hợp chuẩn — ba lượt bắn theo đúng thứ tự

| # | Bắn gì | Chờ | Chứng minh |
|:--:|---|---|---|
| **1** | sự kiện hợp lệ, `eventId` mới | `200` `deduplicated: false` | chữ ký đúng · khuôn đúng · `type` đã đăng ký |
| **2** | **bắn lại y nguyên request** | `200` `deduplicated: true` | chống trùng chạy — gửi lại an toàn |
| **3** | cùng request, đổi một ký tự trong thân, chữ ký giữ nguyên | `401` | chữ ký thật sự phủ nội dung |

⚠️ **Bước 2 là bước quan trọng nhất trong tài liệu này.** Nó cho phép bạn gửi lại thoải mái khi gặp
`429`, `5xx`, hết giờ mạng, hay khi backfill mà không lo cộng trùng.

**Nếu bước 2 trả `deduplicated: false`**, `eventId` của bạn đang được sinh **theo lần gọi HTTP** thay
vì **theo sự việc kinh doanh** — mọi thứ phía sau sẽ bị cộng trùng. Dừng lại và sửa trước khi tiếp tục
(xem §6).

Hai lượt nữa nếu bạn muốn chắc:

| # | Bắn gì | Chờ |
|:--:|---|---|
| **4** | `X-Timestamp` lệch 10 phút | `401` (cửa sổ ±5 phút) |
| **5** | `type` chưa đăng ký cho khoá của bạn | `422` — **không phải** `401` |

## 5. Schema request

```jsonc
{
  "specversion":    "1.0",                   // phiên bản envelope — TUỲ CHỌN
  "eventId":        "evt-88421",             // định danh sự việc kinh doanh — khoá chống trùng
  "externalUserId": "12345",                 // id người dùng của bạn — PHẢI khớp externalUserId bên LAUNCH
  "type":           "ORDER_COMPLETED",       // danh mục đóng, §5.2
  "occurredAt":     "2026-08-14T09:12:33Z",  // lúc việc XẢY RA, không phải lúc bạn gửi
  "confidence":     "SERVER_OBSERVED",       // §5.1
  "payload":        { "orderId": "SO-99881", "amountMinor": 250000000, "currency": "VND" }
}
```

| Trường | Kiểu | Bắt buộc | Mô tả | Ràng buộc |
|---|---|:--:|---|---|
| `eventId` | chuỗi | **CÓ** | Định danh sự việc kinh doanh — khoá chống trùng | PHẢI duy nhất trong hệ thống của bạn; PHẢI KHÔNG đổi qua các lượt gửi lại của cùng sự việc; xem §6 |
| `externalUserId` | chuỗi | **CÓ** | Định danh người dùng của bạn | 🔴 PHẢI bằng `externalUserId` ở kênh LAUNCH, cùng định dạng/hoa-thường, cho cùng một người dùng (README) |
| `type` | chuỗi | **CÓ** | Loại sự kiện | PHẢI là một giá trị trong danh mục đóng §5.2; phân biệt hoa/thường |
| `occurredAt` | RFC 3339 / ISO-8601 | **CÓ** | Lúc sự việc kinh doanh xảy ra | múi giờ PHẢI là UTC (`Z`) |
| `payload` | object | **CÓ** | Dữ liệu nghiệp vụ theo từng loại | hình dạng thay đổi theo `type`, §5.3 |
| `confidence` | chuỗi | TUỲ CHỌN | Mức độ chắc chắn, §5.1 | một trong `CLIENT_ASSERTED` / `SERVER_OBSERVED` / `SETTLED` |
| `specversion` | chuỗi | TUỲ CHỌN | Phiên bản envelope | nếu có, PHẢI đúng là `"1.0"` — bỏ qua thì vẫn ổn (`200`); gửi giá trị khác bị từ chối (`400`) |

### 5.1 `confidence` — mức độ chắc chắn, không phải phán quyết

```text
CLIENT_ASSERTED   <   SERVER_OBSERVED   <   SETTLED
(client tự khai)      (máy chủ bạn thấy)    (đã quyết toán/đối soát)
```

Một sự kiện dưới mức `confidence` mà một quyền lợi yêu cầu vẫn `200`, vẫn được lưu — chỉ **không được
tính cho quyền lợi đó**. Đây **không phải lỗi — đừng gửi lại.**

### 5.2 `type` — danh mục đóng

| `type` | Bạn gửi? | Nghĩa |
|---|:--:|---|
| `ORDER_CREATED` | ✅ | đơn vừa tạo, chưa hoàn tất |
| `ORDER_COMPLETED` | ✅ | đơn đã hoàn tất |
| `ORDER_CANCELLED` | ✅ | đơn huỷ **hoặc hoàn** — một loại cho cả hai |
| `UI_ACTION` | ✅ | hành vi giao diện phía bạn, do bạn chứng thực |
| `POINT_REDEEMED` | ✅ | **bạn đã trả tiền cho người chơi** theo bảng kê chúng tôi bàn giao *(mở 2026-09-03)* |
| `CHECKIN` | ❌ | xảy ra trong sản phẩm của chúng tôi, chúng tôi tự ghi |
| `STREAK_REACHED` | ❌ | chúng tôi tự suy ra từ chuỗi điểm danh, không nhận từ bạn |

⚠️ **Huỷ và hoàn là MỘT loại, không phải hai.** Cả hai đều đảo ngược một sự kiện đã được tính trước đó.
Không có `ORDER_REFUNDED`.

⚠️ **Phân biệt hoa/thường.** `checkin` không phải `CHECKIN`. Gửi giá trị chưa đăng ký sẽ trả về `422
unknown_event_type` (xem [error-codes.md](./error-codes.md)), kèm danh sách giá trị hợp lệ.

⭐ **Bạn không bắt buộc phải gửi `ORDER_CREATED`.** Chỉ gửi `ORDER_COMPLETED` đã là một tích hợp đầy đủ,
hợp lệ. `ORDER_CREATED` chỉ đẩy thời điểm ghi nhận sớm hơn.

### 5.3 `payload` — theo từng loại

`ORDER_CREATED` / `ORDER_COMPLETED` / `ORDER_CANCELLED`:

```jsonc
{ "orderId": "SO-99881", "amountMinor": 250000000, "currency": "VND" }
```

`UI_ACTION` — **`actionKey` là BẮT BUỘC**:

```jsonc
{ "actionKey": "BRAND_CLICK" }
```

`POINT_REDEEMED` — **bạn đã trả tiền, báo về** *(mở 2026-09-03)*:

```jsonc
{
  "settlementItemId": "3f6a1c22-9d40-4b7e-8a11-2c5e77d09b41",
  "redemptionRef": "PAYOUT-88213",
  "amountMinor": 5000,
  "currency": "VND"
}
```

Chúng tôi bàn giao cho bạn một **bảng kê**: mỗi dòng là một người chơi, số điểm, tỷ giá đã đóng dấu, và
số tiền phải trả. Bạn trả tiền, rồi gửi về **một sự kiện cho mỗi dòng đã trả**.

| Trường | Là gì |
|---|---|
| `settlementItemId` | **chép NGUYÊN VĂN từ cột `Mã dòng`** của bảng kê — nó nói chúng tôi biết bạn vừa trả cho dòng nào |
| `redemptionRef` | mã lượt trả **của bạn**. Gửi lại cùng mã ⇒ chúng tôi ghi **đúng một lần**, nên retry luôn an toàn |
| `amountMinor` | số tiền bạn đã trả, **VND ×1** *(100.000đ ⇒ `100000`)* |
| `currency` | đồng tiền của số trên |

`occurredAt` của phong bì là **mốc bạn đã trả**, không phải lúc bạn gửi tin.

🔴 **Số tiền phải KHỚP số trên bảng kê.** Lệch một đồng là chúng tôi **từ chối dòng đó và không ghi
gì** — câu lỗi nêu cả hai số để hai bên đối chiếu. Bảng kê là chứng từ đã đóng dấu, còn tiền thì đã rời
tay bạn, nên đây là chuyện hai bên nói với nhau chứ không phải chuyện một cái máy quyết.

| Mã lỗi | Nghĩa | Bạn làm gì |
|---|---|---|
| `settlement_item_not_found` | mã dòng không có thật | chép lại từ đúng cột `Mã dòng` |
| `settlement_batch_not_confirmed` | đợt chưa được chốt bên chúng tôi | **gửi lại sau** — không phải lỗi của bạn |
| `settlement_item_already_confirmed` | dòng này đã được trả bằng một mã khác | dừng, đối chiếu với chúng tôi |
| `external_payment_amount_drifted` | số tiền lệch bảng kê | đối chiếu rồi gửi lại |

⚠️ **Thiếu `settlementItemId` hoặc `redemptionRef` thì cửa từ chối ngay** *(`422 payload_field_missing`)*.
Thiếu `amountMinor` thì cửa **nhận** — nhưng lượt đó **không được ghi**, vì không có gì để đối chiếu.
Luôn gửi đủ bốn trường.

🔴 **`actionKey` do chúng tôi đặt, bạn gửi đúng chuỗi đó.** Nó là thứ duy nhất phân biệt các hành vi
giao diện với nhau — `UI_ACTION` là **một** loại dùng chung cho mọi hành vi, nên thiếu `actionKey` thì
không ai biết bạn vừa báo hành vi nào.

| Hành vi | `actionKey` gửi lên |
|---|---|
| người dùng click vào một brand trên Mua sắm hoàn tiền | `BRAND_CLICK` |

⚠️ **Phân biệt hoa/thường, so chuỗi thô.** `BRAND_CLICK` ≠ `brand_click` ≠ `Brand_Click`. Sai hoa
thường thì sự kiện **vẫn được nhận, vẫn trả `200`**, nhưng quyền lợi gắn với hành vi đó **không bao giờ
được tính** — và không có lỗi nào bật lên để bạn biết.

⚠️ **Thiếu hẳn `actionKey`** ⇒ `422 payload_field_missing` (xem [error-codes.md](./error-codes.md)).

Ngoài `actionKey`, hình dạng là mở — trường thừa được lưu nguyên văn và bị bỏ qua, không bao giờ gây lỗi.

Ba trường bạn KHÔNG ĐƯỢC gửi bên trong `payload`: một alias nội bộ của `eventId`/`deliveryId`, bất cứ
gì tên `subject`, và bất kỳ trường nào định danh người dùng ngoài `externalUserId` ở tầng ngoài.

## 6. `eventId` và `deliveryId` — đừng nhầm lẫn

> **`eventId` định danh sự việc kinh doanh.** Bạn sinh ra nó. PHẢI KHÔNG đổi qua các lượt gửi lại của
> cùng một sự việc thật.
>
> **`deliveryId` định danh một lượt giao.** Chúng tôi sinh ra nó. Mỗi lượt gửi lại CÓ THỂ nhận một
> giá trị mới.

```text
eventId = evt-123
   ├── lượt giao #1   deliveryId = del-001   →  deduplicated: false
   └── lượt giao #2   deliveryId = del-002   →  deduplicated: true
```

⭐ **Ghi lại `deliveryId` ở phía bạn.** Khi có sự cố, đó là thuật ngữ duy nhất hai bên cùng dùng được để
gọi tên đúng một lượt giao — thay vì mô tả "cái lượt lúc 9 giờ sáng".

⚠️ **`deliveryId` CÓ THỂ vắng mặt** trong response. Nghĩa là kho trace của chúng tôi không ghi được cho
lượt đó — sự kiện của bạn vẫn được nhận và lưu bền như thường. Vắng mặt không phải lỗi; đừng gửi lại vì
lý do đó.

⚠️ Response `422` CÓ THỂ cũng mang `deliveryId` (bên trong `details`) — cùng quy tắc "CÓ THỂ vắng mặt"
như trên, không phải đảm bảo. Khi có, đó là response bạn cần trace nhất, vì `422` không bao giờ đi vào
xử lý nghiệp vụ và không để lại dấu vết nào khác. Khi vắng mặt, trace theo `eventId` và timestamp.

## 7. Hành vi chống trùng

```text
Request đầu tiên với eventId = "order-123"
  → được chấp nhận
  → xử lý / lưu bền

Cùng eventId gửi lại (bao nhiêu lần cũng vậy)
  → 200, deduplicated: true
  → PHẢI KHÔNG tạo ra hệ quả kinh tế lần thứ hai
```

**Luật normative: bên gửi PHẢI giữ nguyên `eventId` khi gửi lại cùng một sự việc kinh doanh.**

### Đúng

```jsonc
// lượt giao đầu
{ "eventId": "order-123", "type": "ORDER_COMPLETED", ... }
// gửi lại sau khi hết giờ — CÙNG eventId
{ "eventId": "order-123", "type": "ORDER_COMPLETED", ... }
```

### Sai

```jsonc
// cùng sự việc kinh doanh, nhưng sinh id MỚI cho lượt gửi lại
{ "eventId": "retry-456", "type": "ORDER_COMPLETED", ... }
```

Trường hợp này bị coi là một sự kiện **khác**, KHÔNG được chống trùng bảo vệ — nó sinh ra một quyền
lợi trùng lần thứ hai.

`eventId` **CÓ THỂ** dùng bất kỳ định dạng chuỗi nào (một UUID là đủ). Nó **PHẢI** duy nhất trong tích
hợp của bạn và **PHẢI KHÔNG** đổi qua các lượt gửi lại của cùng một sự việc kinh doanh.

🔴 **Chống trùng chỉ khớp theo `(eventId, type)` — nội dung `payload` không bao giờ được so sánh.** Nếu
bạn gửi lại cùng `eventId` với cùng `type` nhưng `payload` **khác**, response vẫn là `200
deduplicated: true`, và **`payload` mới bị âm thầm bỏ qua** — nền tảng giữ nguyên `payload` đã đến ở
lượt giao **đầu tiên**. Đây là first-write-wins, không phải last-write-wins, và không có lỗi nào báo
cho bạn biết điều này xảy ra.

```jsonc
// lượt giao đầu — payload NÀY được giữ lại
{ "eventId": "order-123", "type": "ORDER_COMPLETED", "payload": { "amountMinor": 10000, ... } }

// gửi lại với payload KHÁC, cùng eventId + type
{ "eventId": "order-123", "type": "ORDER_COMPLETED", "payload": { "amountMinor": 20000, ... } }
// → 200 { "deduplicated": true }  — amountMinor vẫn là 10000, giá trị 20000 bị bỏ
```

⚠️ **Nếu payload của sự việc kinh doanh có thể hợp lệ thay đổi trước khi bạn có giá trị cuối** (ví dụ
một khoản tiền được điều chỉnh), đừng dựa vào việc gửi lại cùng `eventId` để cập nhật nó. Thay vào đó
hãy chờ tới khi có giá trị cuối rồi mới gửi, hoặc mô hình hoá điều chỉnh thành một sự kiện riêng bằng
`ORDER_CANCELLED` + một `ORDER_COMPLETED` mới với `eventId` mới.

Gửi cùng `eventId` với **`type` khác** là một trường hợp khác — xem `event_id_conflict` trong
[error-codes.md](./error-codes.md).

## 8. Hợp đồng response

| Status | Nghĩa | `deliveryId`? | Bạn làm gì |
|:--:|---|:--:|---|
| `200` | Đã nhận và lưu bền — **kể cả bản trùng** | ✅ | không làm gì — dừng gửi lại |
| `400` | Envelope sai khuôn: JSON hỏng, giá trị `specversion` **không hợp lệ** (có mặt nhưng không phải `"1.0"`), hoặc thiếu trường envelope **bắt buộc** | ✗ | sửa request rồi gửi lại |
| `401` | Sai khoá, sai chữ ký, hoặc timestamp hết hạn — một thông báo chung cho cả ba | ✗ | kiểm credential/đồng hồ rồi gửi lại |
| `404` | Route không tồn tại | ✗ | sửa URL |
| `422` | Đúng khuôn, sai nghĩa **nghiệp vụ** — xem [error-codes.md](./error-codes.md) | CÓ THỂ có mặt (trong `details`) | **đừng gửi lại mù** — đọc trường `code` |
| `429` | Vượt giới hạn tần suất | — | đọc `Retry-After`, chờ rồi gửi lại |
| `5xx` | Lỗi nền tảng | — | gửi lại có backoff |

**`200` không hứa quyền lợi đã được cấp** — xem §5.1 và [README.md § Thứ tự bắt buộc](./README.md) để
biết ba lý do một sự kiện được chấp nhận vẫn có thể sinh ra quyền lợi bằng không.

## 9. Chính sách gửi lại

**Khi nào gửi lại:**

```text
429              → gửi lại
5xx              → gửi lại
lỗi mạng         → gửi lại
4xx (validation) → ĐỪNG gửi lại khi chưa sửa request
```

**Gửi lại bao nhiêu lần?** Creator-OS không yêu cầu số lần hay lịch gửi lại cụ thể. **Bên gửi tự kiểm
soát chính sách gửi lại của mình.** Backoff luỹ thừa kèm jitter là **khuyến nghị, không bắt buộc**.

**Cái gì phải giữ nguyên qua các lượt gửi lại?**

```text
eventId → PHẢI giữ nguyên
payload → PHẢI giữ nguyên về mặt ngữ nghĩa
```

**Cái gì đổi qua các lượt gửi lại?** `deliveryId` — chúng tôi cấp một giá trị mới cho mỗi lượt giao
(§6).

## 10. Giới hạn tần suất

| Header | Nghĩa |
|---|---|
| `RateLimit-Limit` | số request cho phép mỗi cửa sổ |
| `RateLimit-Remaining` | số request còn lại trong cửa sổ hiện tại |
| `RateLimit-Reset` | **số giây** tới khi cửa sổ reset — **không phải** mốc epoch Unix |
| `Retry-After` | có mặt ở `429` — số giây phải chờ trước khi gửi lại |

Giới hạn: 600 request/phút cho mỗi Access Key.

Nếu các header này vắng mặt trong response: coi như **không có thông tin giới hạn tần suất** cho
request đó — đừng suy ra là bạn có hạn mức vô hạn.

## 11. Phục hồi (recovery)

Phục hồi (đối soát, backfill, replay) là năng lực **tuỳ chọn**, mô tả đầy đủ ở
[recovery.md](./recovery.md). Bạn vẫn tích hợp đầy đủ mà không cần nó — xem [README.md](./README.md).

## 12. Thuật ngữ

| Từ | Nghĩa trong tài liệu này |
|---|---|
| **event (sự kiện)** | một việc đã xảy ra trong hệ thống của bạn — đơn hoàn tất, đơn huỷ. Một sự kiện = một `eventId` |
| **delivery (lượt giao)** | một lượt gọi HTTP mang một sự kiện sang chúng tôi. Một sự kiện CÓ THỂ có nhiều lượt giao |
| **envelope (phong bì)** | hình dạng JSON bên ngoài (`eventId`, `type`, `occurredAt`, …), phân biệt với `payload` |
| **deduplication (chống trùng)** | bảo đảm một `eventId` cho trước chỉ được tính đúng một lần, dù bao nhiêu lượt giao mang nó |
| **freshness (độ tươi)** | phép kiểm timestamp ±5 phút từ chối các request bị phát lại |
| **reconciliation window (cửa sổ đối soát)** | cửa sổ 6 giờ, neo theo `occurredAt`, dùng để so sổ hai bên — xem recovery.md |

## 13. Câu hỏi thường gặp

**Nếu chúng tôi gửi cùng một sự kiện nhiều lần, có bị cộng trùng không?**
Không, miễn `eventId` giữ nguyên. Đó chính là điều vector kiểm hợp chuẩn #2 (§4) chứng minh. Nếu bạn
chưa chạy vector đó, hãy chạy trước khi bật gửi lại.

**`200` có nghĩa là người dùng đã có quyền lợi chưa?**
Chưa chắc. `200` chỉ hứa **đã nhận và lưu bền**. Ba lý do một sự kiện `200` vẫn có thể sinh quyền lợi
bằng không: ① xảy ra ngoài cửa sổ hoạt động của chương trình ② `confidence` thấp hơn mức quyền lợi yêu
cầu (§5.1) ③ **người dùng chưa từng qua kênh LAUNCH** — lý do ③ là lý do duy nhất
**vĩnh viễn và không bao giờ tự sửa về sau**; xem [README.md § Thứ tự bắt buộc](./README.md).

**Chúng tôi nhận `401` và chắc chắn khoá đúng — còn có thể là gì?**
Theo thứ tự phổ biến giảm dần: ① đồng hồ lệch quá 5 phút ② serialize lại trước khi ký (§3.1) ③ ký nhầm
secret của kênh khác ④ secret vừa bị thu hồi.

**Chúng tôi có cần dựng API mới cho phục hồi không?**
Không. Chúng tôi chuẩn hoá **ba câu hỏi và nghĩa của câu trả lời**, không chuẩn hoá hình dạng HTTP. Nếu
bạn đã có `GET /orders?from=…&to=…`, dùng nó; một tệp đối soát cuối ngày cũng được. Xem
[recovery.md](./recovery.md).

**Không dựng phục hồi thì có bị từ chối tích hợp không?**
Không. Cả bốn hạng tích hợp đều hợp lệ. Bạn ở hạng `INGEST_ONLY`, và chúng tôi công bố hạng đó lại cho
bạn. Xem [recovery.md](./recovery.md).

**`eventId` có cần định dạng cụ thể không?**
Không có định dạng bắt buộc. Một UUID là đủ. Nó chỉ cần **duy nhất trong hệ thống của bạn** và
**không đổi** qua các lượt gửi lại của cùng một sự việc kinh doanh.

**Chúng tôi có thể dùng chung một khoá giữa sandbox và production không?**
Không khuyến khích, và riêng kênh **recovery** thì **không được phép** — mỗi máy chủ là một tích hợp
riêng với khoá riêng. Dùng chung nghĩa là một request ký cho máy này verify được ở máy kia.

**Có giới hạn kích thước payload không?**
Trường thừa được lưu nguyên văn và không gây vấn đề gì, nhưng đừng nhét cả một bản ghi nghiệp vụ vào
`payload`. Báo chúng tôi trước nếu bạn cần gửi một khối dữ liệu lớn.
