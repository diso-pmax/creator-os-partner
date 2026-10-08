# Kênh EVENT — Hợp đồng nhận sự kiện

Bắt đầu từ: [README.md](./README.md). *(bản dịch của
[en/event-ingestion.md](../en/event-ingestion.md) — bản tiếng Anh là nguồn chốt, lệch thì bản tiếng
Anh thắng)*

**Phạm vi profile:** trang này mô tả transport chung và ví dụ legacy Reward. PROGRAM_LINK dùng cùng endpoint ký, payload strict riêng và externalUserId buyer tuỳ chọn; không áp Campaign LAUNCH. Đọc [program-link.md](program-link.md) cho contract Link đầy đủ. Các câu về Reward/session bên dưới chỉ áp legacy Reward.

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

> **Gửi nhiều sự kiện cùng lúc?** Xem [§14 Gửi theo lô](#14-gửi-theo-lô): `POST /api/v1/integrations/events/batch`.
> Đó chỉ là một cách *chuyên chở* khác — mọi sự kiện bên trong vẫn giữ đúng hình dạng và luật mô tả ở trang này.

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
API='https://<host của môi trường bạn đang dùng>/api/v1'   # xem bảng môi trường ở README.md
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
| `externalUserId` | chuỗi | **CÓ legacy Reward; tuỳ chọn PROGRAM_LINK hợp lệ** | Định danh người dùng của bạn | 🔴 PHẢI bằng `externalUserId` ở kênh LAUNCH, cùng định dạng/hoa-thường, cho cùng một người dùng (README) |
| `type` | chuỗi | **CÓ** | Loại sự kiện | PHẢI là một giá trị trong danh mục đóng §5.2; phân biệt hoa/thường |
| `occurredAt` | RFC 3339 / ISO-8601 | **CÓ** | Lúc sự việc kinh doanh xảy ra | múi giờ PHẢI là UTC (`Z`); và phải nằm trong hạn độ tươi, §5.4 |
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

#### 5.2a Gửi đơn nào — bạn lọc TRƯỚC khi gửi

Chúng tôi **không kiểm được năm điều kiện dưới đây**, vì dữ liệu nằm phía bạn (giỏ hàng, bước thanh toán, danh mục
hàng của bạn). Nên **bạn** quyết định, và chỉ gửi sự kiện đơn cho một đơn thoả **đủ cả năm**. Mọi sự kiện đơn bạn đã
gửi sẽ được tính, miễn là nó cũng thoả điều kiện của chính chương trình (giá trị tối thiểu, thương hiệu hoặc ngành,
cửa sổ thời gian, người mua đã tham gia):

1. **Đơn không nằm sẵn trong giỏ hàng từ trước khi người mua sang từ chúng tôi.** Đơn dựng từ một giỏ đã có
   trước đó thì không thuộc phần chúng tôi tính.
2. **Đó là đơn ĐẦU TIÊN sau khi chuyển hướng trực tiếp từ chúng tôi — sau MỖI lần chuyển hướng.** Người mua sang
   chỗ bạn qua đường chuyển hướng của chúng tôi (liên kết hoặc tiện ích đưa họ từ sản phẩm của chúng tôi sang trang
   của bạn); chỉ đơn đầu tiên sau lần chuyển hướng đó được gửi. Đây KHÔNG phải "mỗi người một đơn": khi cùng người
   mua đó sang chỗ bạn bằng một lần chuyển hướng khác từ chúng tôi, đơn đầu tiên sau lần ĐÓ lại được gửi. Hãy
   tiếp tục gửi các đơn này, vì chương trình có thể thưởng theo nhiều đơn (ví dụ mốc theo số đơn).
3. **Đơn đi đúng luồng, không ngắt quãng** — từ lúc chuyển hướng tới lúc thanh toán, liền một mạch, không bị cắt
   giữa chừng rồi nối lại bằng đường khác.
4. **Đơn thành công.** Đơn lỗi hoặc không bao giờ hoàn tất thì không gửi. Đơn bị **huỷ** sau khi bạn đã gửi: gửi
   `ORDER_CANCELLED` với **cùng `orderId`**, chúng tôi sẽ đảo phần đơn đó đã được tính. Đơn bạn nhận định là
   **gian lận**: đừng gửi; còn nếu bạn chỉ phát hiện **sau khi** đã gửi thì cũng gửi `ORDER_CANCELLED` cho đơn đó.
   Hoàn tiền một phần hay trả hàng có tính là huỷ hay không do từng chương trình quy định, không quy định ở đây.
5. **Đơn thuộc ngành hàng có hoa hồng.** Đơn thuộc ngành không có hoa hồng thì không gửi.

Hai điều nữa về thời điểm:

- Chúng tôi ghi nhận đơn **ngay khi nhận `ORDER_CREATED`**. Muốn đơn chỉ được tính **sau khi đã giao hàng** (chương
  trình có thể quy định đơn hợp lệ là đơn đã giao tới người mua) thì đừng gửi `ORDER_CREATED`: chỉ gửi
  `ORDER_COMPLETED`, vào lúc đơn đã giao.
- ⚠️ **Cái giá của việc chỉ gửi `ORDER_COMPLETED`:** với đơn như vậy, thời điểm chúng tôi ghi nhận CHÍNH LÀ lúc
  `ORDER_COMPLETED`. Nếu `occurredAt` của nó (lúc giao) rơi **sau khi chương trình đã kết thúc** thì đơn **không được
  tính**, dù đơn được đặt khi chương trình còn chạy. Đơn đặt vào những ngày cuối của chương trình rồi giao sau khi
  kết thúc sẽ mất điểm theo cách này. Nếu điều đó quan trọng với bạn, hãy gửi `ORDER_CREATED` ngay lúc đặt đơn.
- Cái gì bạn gửi thì được tính. Một đơn lẽ ra phải lọc mà vẫn gửi sẽ bị tính, và gửi huỷ là cách duy nhất để lấy lại.

### 5.3 `payload` — theo từng loại

`ORDER_CREATED` / `ORDER_COMPLETED` / `ORDER_CANCELLED`:

```jsonc
{ "orderId": "SO-99881", "amountMinor": 250000000, "currency": "VND", "brandCode": "SHOPEE" }
```

🔴 **`brandCode` cho biết một đơn thuộc brand tài trợ nào.** Một số chiến dịch chỉ trao quyền lợi cho đơn
đặt tại một danh sách brand tài trợ cố định *(ví dụ quyền lợi cho đơn đầu tại một brand tài trợ, hoặc cho
đơn tại nhiều brand tài trợ khác nhau)*. Đơn **được tính** cho quyền lợi đó **khi và chỉ khi** `brandCode`
của nó **khớp CHÍNH XÁC** một trong các mã brand mà chiến dịch đã khai. **Bên chúng tôi định nghĩa các mã
brand** *(ví dụ `SHOPEE`, `LAZADA`)*; bạn gửi đúng chuỗi đó — cùng luật với `actionKey` bên dưới.

⚠️ **Phân biệt hoa/thường, so chuỗi THÔ.** `SHOPEE` ≠ `Shopee` ≠ `shopee`. Sai hoa/thường — hoặc thiếu
`brandCode` — thì đơn **vẫn được nhận và vẫn trả `200`**, nhưng **KHÔNG bao giờ được tính** cho bất kỳ
quyền lợi gắn brand nào, và **không có lỗi nào báo cho bạn biết**. `brandCode` **không bắt buộc ở cổng**:
đơn thiếu nó vẫn là đơn hợp lệ *(vẫn được tính cho các quyền lợi không gắn với brand cụ thể)*, chỉ là
không được tính cho quyền lợi gắn brand.

⚠️ **Nếu CÓ gửi `brandCode` thì gửi một chuỗi dùng được.** Bỏ trống hẳn thì không sao (`200`), sai
hoa/thường vẫn được nhận (`200`, chỉ là không bao giờ được chấm). Nhưng một `brandCode` **có mặt nhưng
rỗng, toàn khoảng trắng, hay không phải chuỗi** là ca KHÁC: cả sự kiện bị **từ chối `422
payload_field_missing`** (xem [error-codes.md](./error-codes.md)) — không lưu gì, không chấm gì. Mã
canonical bên chúng tôi **tối đa 64 ký tự**, nên giá trị dài hơn không bao giờ khớp một brand đã khai.

🔴 **Lặp lại `brandCode` ở mọi nhịp của đơn gắn brand, kể cả `ORDER_CANCELLED`.** Gửi ở mọi nhịp là luật
an toàn — thừa cũng không sao, và với một số quyền lợi gắn brand thì đơn huỷ thiếu `brandCode` sẽ không
đảo lại đúng.

🔴 **`ORDER_CANCELLED` phải mang CÙNG `orderId` với đơn nó huỷ** — và đến từ cùng `externalUserId`. Đó
là cách chúng tôi tìm thứ cần đảo: các quyền lợi tính theo từng đơn *(mốc số đơn, đơn đầu tại một brand
tài trợ)* được đảo bằng cách khớp `orderId`. Lệnh huỷ mang `orderId` khác vẫn được nhận `200`, không có
lỗi nào, nhưng không khớp với đơn gốc — các quyền lợi đó vẫn còn nguyên. Một đơn, một `orderId`, xuyên
suốt `ORDER_CREATED` → `ORDER_COMPLETED` → `ORDER_CANCELLED`, mỗi nhịp một `eventId` riêng.

`UI_ACTION` — **`actionKey` là BẮT BUỘC**:

```jsonc
{ "actionKey": "<canonical-action-key-assigned-to-you>" }
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

**Người dùng nào.** `externalUserId` ở cấp trên cùng của phong bì là người bạn đã trả — chính giá trị bạn nhận
trong gói settlement ([settlement.md §2.1](./settlement.md#21-thân-request)) hoặc ở cột `Mã người chơi (đối tác)`
của bảng kê. **Chúng tôi tìm dòng bằng `settlementItemId`, không bằng `externalUserId`:** `externalUserId` sai không
chuyển khoản trả sang dòng khác, và `externalUserId` đúng cũng không cứu được một `settlementItemId` sai.

**Bắt buộc nếu bạn nhận gói settlement.** Nếu bạn đã khai địa chỉ nhận điểm
([settlement.md §5](./settlement.md#5-sau-khi-bạn-trả--báo-lại-bằng-point_redeemed)), gửi sự kiện này cho mọi dòng
bạn đã trả là **bắt buộc**: đó là thứ duy nhất khép dòng. Dòng chưa báo sẽ vào danh sách quá hạn của ops chúng tôi
sau 7 ngày (mặc định).

🔴 **Số tiền phải KHỚP số trên bảng kê.** Lệch một đồng là chúng tôi **từ chối dòng đó và không ghi
gì**. `200` chỉ cho bạn biết chúng tôi đã lưu sự kiện; kết quả ghi sổ đến sau, và bạn đọc nó bằng
`POST /integrations/deliveries` ([§15](#15-đọc-kết-quả-sau-200)). Bảng kê là chứng từ đã đóng dấu, còn tiền thì đã rời
tay bạn, nên đây là chuyện hai bên nói với nhau chứ không phải chuyện một cái máy quyết.

| Mã lỗi *(đọc ở `processing[].errorCode`, §15)* | Nghĩa | Bạn làm gì |
|---|---|---|
| `external_payment_amount_missing` | sự kiện thiếu `amountMinor` (số nguyên, VND ×1) hoặc `currency` | gửi đủ bốn trường rồi gửi lại với `eventId` mới |
| `settlement_item_not_found` | mã dòng không có thật | chép lại từ đúng cột `Mã dòng` |
| `settlement_batch_not_confirmed` | đợt chưa được chốt bên chúng tôi | **gửi lại sau** — không phải lỗi của bạn |
| `settlement_item_already_confirmed` | dòng này đã được trả bằng một mã khác | dừng, đối chiếu với chúng tôi |
| `external_payment_amount_drifted` | số tiền lệch bảng kê | đối chiếu rồi gửi lại |

⚠️ **Thiếu `settlementItemId` hoặc `redemptionRef` thì cửa từ chối ngay** *(`422 payload_field_missing`)*.
Thiếu `amountMinor` thì cửa **nhận** — nhưng lượt đó **không được ghi**, vì không có gì để đối chiếu.
Luôn gửi đủ bốn trường.

🔴 **`actionKey` do chúng tôi đặt, bạn gửi đúng chuỗi đó.** Nó là thứ duy nhất phân biệt các hành vi
giao diện với nhau — `UI_ACTION` là **một** loại dùng chung cho mọi hành vi, nên thiếu `actionKey` thì
không ai biết bạn vừa báo hành vi nào. `actionKey` là **định danh ngữ nghĩa canonical do nền tảng định
nghĩa** — bạn ánh xạ biểu diễn nội bộ của mình sang đúng chuỗi đó ở biên của bạn, không tự đặt rồi báo
lại cho chúng tôi.

Chúng tôi không công bố một danh sách cố định toàn cục ở đây — chuỗi cụ thể phụ thuộc tích hợp của bạn
đang cấu hình cho hành vi nào, và tập đó đổi mỗi khi một chiến dịch được cấu hình. Đọc tập mã hiện tại
cho chính chiến dịch của bạn ở màn chiến dịch trên console, hoặc hỏi đầu mối onboarding. Đừng chép lại một `actionKey`
thấy ở một tích hợp hay một chiến dịch khác — nó có thể không còn là giá trị chiến dịch đó đang chờ.

⚠️ **Phân biệt hoa/thường, so chuỗi thô.** Sai hoa
thường thì sự kiện **vẫn được nhận, vẫn trả `200`**, nhưng quyền lợi gắn với hành vi đó **không bao giờ
được tính** — và không có lỗi nào bật lên để bạn biết.

⚠️ **Thiếu hẳn `actionKey`** ⇒ `422 payload_field_missing` (xem [error-codes.md](./error-codes.md)).

Ngoài `actionKey`, hình dạng là mở — trường thừa được lưu nguyên văn và bị bỏ qua, không bao giờ gây lỗi.

Ba trường bạn KHÔNG ĐƯỢC gửi bên trong `payload`: một alias nội bộ của `eventId`/`deliveryId`, bất cứ
gì tên `subject`, và bất kỳ trường nào định danh người dùng ngoài `externalUserId` ở tầng ngoài.

### 5.4 `occurredAt` — hai cái hạn

`occurredAt` được đối chiếu với **đồng hồ của chúng tôi tại lúc request tới**. Lệch khỏi một trong hai
hạn là `422`: không lưu gì, không tính gì.

| Mã | Chúng tôi từ chối vì | Hạn mặc định | Bạn làm gì |
|---|---|:--:|---|
| `event_too_late` | sự kiện **cũ hơn** hạn trễ của bạn | **30 ngày** | gửi sớm hơn — hoặc báo chúng tôi nới hạn cho tích hợp của bạn |
| `event_from_future` | `occurredAt` **vượt trước đồng hồ chúng tôi** quá hạn lệch của bạn | **300 giây** | 🔴 **sửa đồng hồ máy gửi.** Xin nới hạn này là sai hướng — nới là chính bạn mất hàng rào |

Cả hai mã đều có trong [error-codes.md](./error-codes.md), cạnh mọi mã `422` khác mà kênh này có thể
trả về.

**Đúng bằng hạn thì VẪN NHẬN.** Luật là *"quá hạn"*, không phải *"bằng hạn"*: với hạn trễ 60 phút, trễ
60 phút trả `200`, trễ 61 phút trả `422`.

**Câu lỗi nêu cả hai con số**, để bạn tự đối chiếu mà không phải hỏi chúng tôi:

```text
occurredAt trễ 61 phút, quá hạn 60 phút của tích hợp này
```

**Hai hạn khai theo TỪNG TÍCH HỢP, không phải một số chung.** Chúng tôi báo hai giá trị của bạn lúc bàn
giao; chưa đặt thì bạn dùng mặc định ở bảng trên. Cố ý không dùng một số chung: một đối tác gom lô chạy
đêm và một đối tác bắn realtime không cần cùng một cửa sổ, mà trần chung thì phải rộng đủ cho bên chậm
nhất — lúc đó nó thành trang trí với mọi bên còn lại.

🔴 **Hạn `0` nghĩa là CẤM, không phải "vô hạn".** Hạn lệch tương lai `0` thì `occurredAt` vượt trước
đồng hồ chúng tôi **một giây** cũng bị từ chối.

⭐ **Gửi lại một sự kiện chúng tôi ĐÃ nhận thì không bao giờ bị từ chối vì trễ.** Hạn chỉ áp cho sự
kiện mới hoàn toàn với chúng tôi. Sự kiện kẹt trong outbox của bạn một tuần vẫn trả `200` kèm
`deduplicated: true`, y như lúc chưa quá hạn. Hàng đợi xả ra luôn an toàn — nên **đừng bao giờ cấp
`eventId` MỚI vì sợ `422`.** Làm vậy là biến một sự kiện trễ thành hai sự kiện kinh tế, tệ hơn hẳn.

⚠️ **Hạn này KHÔNG phải cửa sổ chiến dịch.** Nó so `occurredAt` với **hiện tại**, không so với ngày bắt
đầu, ngày kết thúc, hay ân hạn của bất kỳ chiến dịch nào. Một sự kiện qua được cổng này vẫn có thể
không sinh quyền lợi vì chiến dịch nó thuộc về đã đóng — kết cục đó là `200`, giống hệt ca `confidence`
ở [§5.1](#51-confidence--mức-độ-chắc-chắn-không-phải-phán-quyết). `422` ở đây chỉ nói đúng một điều:
**bản thân cái mốc thời gian không đáng tin.**

🔴 **Đừng "chữa" `event_too_late` bằng cách đẩy `occurredAt` tiến lên.** Trường này chọn version điều
khoản thưởng, nên xê dịch nó là đổi luôn giá trị của sự kiện — với người dùng của bạn, và trên hoá đơn
của chúng ta. Gửi đúng mốc thật. Nếu độ trễ thật của bạn quá hạn, thì cái phải xê dịch là **cái hạn** —
báo chúng tôi.

## 6. `eventId`, `deliveryId`, `batchId` — ba định danh, ba cấp

```text
eventId     = một sự việc nghiệp vụ                  · BẠN phát   · dùng để CHỐNG TRÙNG
deliveryId  = biên nhận của chúng tôi cho MỘT sự kiện · CHÚNG TÔI phát · dùng để TRUY VẾT
batchId     = MỘT lượt gọi HTTP (chỉ tuyến lô)        · CHÚNG TÔI phát · dùng để TƯƠNG QUAN (không lưu)
```

> **`eventId` định danh sự việc kinh doanh.** Bạn sinh ra nó. PHẢI KHÔNG đổi qua các lượt gửi lại của
> cùng một sự việc thật.
>
> **`deliveryId` định danh biên nhận của chúng tôi cho một sự kiện.** Chúng tôi sinh ra nó. Mỗi lượt gửi
> lại CÓ THỂ nhận một giá trị mới.
>
> **`batchId` định danh một lượt gọi tuyến lô.** Chúng tôi sinh ra và trả trong chính response đó để hai bên
> cùng chỉ được vào một lượt gọi khi đọc log. Nó **không được lưu**, **không bao giờ** là khoá chống trùng, và
> bạn **không được gửi** nó — thân request có `batchId` bị từ chối `400`.

Một lượt gọi `POST /integrations/events` mang một sự kiện nên ra một `deliveryId`. Một lượt gọi tuyến lô mang N
sự kiện nên ra N `deliveryId` (mỗi sự kiện một) cộng một `batchId`.

```text
eventId = evt-123
   ├── biên nhận #1   deliveryId = del-001   →  deduplicated: false
   └── biên nhận #2   deliveryId = del-002   →  deduplicated: true
```

⭐ **Ghi lại `deliveryId` ở phía bạn.** Khi có sự cố, đó là thuật ngữ duy nhất hai bên cùng dùng được để
gọi tên đúng một biên nhận — thay vì mô tả "cái lượt lúc 9 giờ sáng".

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
| `413` | Thân request vượt trần **100 KB** — xem [§10b](#10b-trần-kích-thước-thân-request) | ✗ | **đừng gửi lại nguyên gói** — chia nhỏ hoặc rút gọn `payload` |
| `429` | Vượt giới hạn tần suất | — | đọc `Retry-After`, chờ rồi gửi lại |
| `5xx` | Lỗi nền tảng | — | gửi lại có backoff |

> Tuyến lô có hợp đồng riêng — gồm những lỗi nào từ chối cả lô — ở [§14](#14-gửi-theo-lô).

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

**Cái gì đổi qua các lượt gửi lại?** `deliveryId` — chúng tôi cấp một giá trị mới cho mỗi biên nhận
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

## 10b. Trần kích thước thân request

Thân một request ở tuyến một-sự-kiện (`POST /integrations/events`) tối đa **100 KB** *(102 400 byte; nếu gói được nén gzip thì đo sau khi giải nén)*. Vượt trần,
cửa trả `413` với thân **JSON** cùng khuôn mọi lỗi khác — không phải trang HTML:

```json
{ "code": "payload_too_large", "title": "payload_too_large", "status": 413,
  "detail": "Thân request vượt trần cho phép.", "details": { "maxBytes": 102400 } }
```

`413` là lỗi phía **gói tin**, không phải lỗi tạm thời: gửi lại y nguyên sẽ nhận lại `413`. Một sự kiện thông
thường nhỏ hơn trần này nhiều lần; nếu `payload` của bạn chạm trần, hãy liên hệ để trao đổi thay vì tách tuỳ tiện.
Thân JSON hỏng trả `400` với `code: "invalid_json"` (cũng là JSON, không kèm nội dung thân bạn gửi).

Tuyến lô có trần lớn hơn, cấu hình được — xem [§14.5](#145-ba-lớp-trần).

## 11. Phục hồi (recovery)

Phục hồi (đối soát, backfill, replay) là năng lực **tuỳ chọn**, mô tả đầy đủ ở
[recovery.md](./recovery.md). Bạn vẫn tích hợp đầy đủ mà không cần nó — xem [README.md](./README.md).

## 12. Thuật ngữ

| Từ | Nghĩa trong tài liệu này |
|---|---|
| **event (sự kiện)** | một việc đã xảy ra trong hệ thống của bạn — đơn hoàn tất, đơn huỷ. Một sự kiện = một `eventId` |
| **delivery (lượt giao)** | biên nhận của chúng tôi cho MỘT sự kiện (mang một `deliveryId`). Lượt gọi một-sự-kiện ra một biên nhận; lượt gọi lô ra một biên nhận cho mỗi sự kiện. Một sự kiện CÓ THỂ có nhiều lượt giao |
| **batch (lô)** | một lượt gọi HTTP tới tuyến lô mang N sự kiện. Chỉ là tiện ích vận chuyển — không phải đối tượng nghiệp vụ, không lưu, không có chống trùng riêng |
| **ingest disposition (kết cục nhận)** | câu trả lời của cửa cho một sự kiện: `accepted` · `deduplicated` · `rejected`. Tập đóng |
| **economic outcome (kết cục kinh tế)** | chuyện xảy ra với sự kiện *sau khi* được nhận (đánh giá, cấp quyền lợi). Cửa nhận không nói gì về nó |
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

**`accepted` trong lô có nghĩa là đã cấp quyền lợi không?**
Không. `accepted` ≠ đã đánh giá ≠ đã cấp quyền lợi. Xem §14.3.

**Có giới hạn kích thước payload không?**
Trường thừa được lưu nguyên văn và không gây vấn đề gì, nhưng đừng nhét cả một bản ghi nghiệp vụ vào
`payload`. Báo chúng tôi trước nếu bạn cần gửi một khối dữ liệu lớn.

## 14. Gửi theo lô

`POST /api/v1/integrations/events/batch` mang **N sự kiện trong một lượt gọi** và trả lời **theo từng sự kiện**. Đây là
tiện ích vận chuyển cho đối tác có đợt sự kiện dồn. Không gì về từng sự kiện thay đổi: cùng envelope (§5), cùng chống
trùng theo `eventId` (§7), cùng chữ ký (§3), cùng luật `payload`.

> ⚠️ Tuyến lô **mặc định TẮT** theo từng tích hợp. Hãy nhờ chúng tôi bật cho khoá của bạn; cùng lúc đó chúng tôi báo các
> trần (§14.5) áp cho bạn. Khi còn tắt, tuyến trả `422` với `code: "batch_not_enabled"` và không xử lý gì.

### 14.1 Request

Cùng header như §3. Chữ ký phủ **byte thô của toàn bộ thân**, đúng như §3.1.

```json
{ "events": [
  { "eventId": "evt-1", "type": "ORDER_COMPLETED", "occurredAt": "2026-09-19T08:00:00Z", "…": "…" },
  { "eventId": "evt-2", "type": "ORDER_COMPLETED", "occurredAt": "2026-09-19T08:00:05Z", "…": "…" }
] }
```

`events` là bắt buộc và không được rỗng. **Mọi khoá cấp cao khác bị từ chối `400`** (kể cả `batchId`). Mỗi phần tử là một
envelope sự kiện đầy đủ, y hệt tuyến một-sự-kiện.

### 14.2 Response — `200` kể cả khi có sự kiện hỏng

```json
{
  "batchId": "bat_9c1f…",
  "errors": true,
  "accepted": 1, "deduplicated": 1, "failed": 1,
  "results": [
    { "eventId": "evt-1", "status": "accepted",     "deliveryId": "del-001" },
    { "eventId": "evt-2", "status": "deduplicated", "deliveryId": "del-002" },
    { "eventId": "evt-3", "status": "rejected", "code": "event_type_not_registered", "retryable": false, "detail": "…" }
  ]
}
```

Tương ứng — bạn dựa được vào cả ba dòng, luôn luôn, mỗi khi lượt gọi tới bước xử lý (`200`):

```text
results.length      === events.length
results[i].eventId  === events[i].eventId      (null nếu phần tử đó không có eventId dùng được)
accepted + deduplicated + failed === events.length
```

Mỗi kết quả có một `status`:

| `status` | Nghĩa | Kèm | Bạn làm gì |
|---|---|---|---|
| `accepted` | đã nhận và lưu bền | `deliveryId` | không làm gì — dừng gửi lại sự kiện đó |
| `deduplicated` | chúng tôi đã có `eventId` này | `deliveryId` | không làm gì — chỉ được tính một lần |
| `rejected` | sự kiện này không được nhận | `code`, `retryable`, `detail` | `retryable: true` thì gửi lại **riêng sự kiện này** sau; `false` thì sửa trước |

`retryable` suy ra từ lỗi: `false` cho lỗi khuôn/nghĩa, gồm `validation_error`, `event_type_not_registered`,
`unknown_event_type`, `payload_field_missing`, `derived_event_not_accepted`, `event_id_conflict`, `invalid_occurred_at`,
`event_too_late`, `event_from_future` — xem [error-codes.md](./error-codes.md); `true` cho `internal_error`, là lỗi phía
nền tảng ở đúng sự kiện đó. Các sự kiện được xử lý **lần lượt từng cái**; một sự kiện hỏng không chặn các sự kiện khác.

**Gửi lại cả lô là an toàn.** Lô mới nhận `batchId` **mới**, và mọi sự kiện chúng tôi đã có trả về `deduplicated`. Không có
khái niệm "lô này đã xử lý rồi" — chống trùng làm theo từng `eventId` (§7). Trùng ngay trong một lô cũng hợp lệ:
`[E1, E2, E1]` trả `accepted · accepted · deduplicated`.

### 14.3 `accepted` không có nghĩa là đã cấp quyền lợi

```text
accepted  ≠  đã đánh giá  ≠  đã cấp quyền lợi
```

`accepted` chỉ nói: *"sự kiện này đã được ghi nhận."* Nó **không** nói sự kiện đã được
đánh giá với chiến dịch, và **không** nói quyền lợi đã được cấp (các lý do ở §13 và README vẫn áp dụng). Một `200` cho 500
sự kiện không phải bảo đảm hàng loạt 500 quyền lợi — nó là 500 biên nhận. Đừng hứa quyền lợi với người dùng của bạn chỉ vì
`accepted`.

### 14.4 Thứ tự mảng không phải thứ tự thời gian

```text
✅ CÓ bảo đảm:     results[i] ↔ events[i]
🔴 KHÔNG bảo đảm:  events[0] xảy ra TRƯỚC events[1]
```

Thứ tự mảng chỉ cho bạn biết kết quả nào thuộc sự kiện nào. **Việc gì xảy ra lúc nào do `occurredAt` quyết định** (và
`supersedes` nếu bạn dùng), không bao giờ do vị trí. Gửi `[E2, E1]` cho cùng kết quả như `[E1, E2]`.

Hai từ vựng được tách riêng: **kết cục nhận** (`accepted` / `deduplicated` / `rejected`) là điều cửa nhận trả lời, và là tập
đóng. **Kết cục kinh tế** xảy ra ở phía sau, và cửa nhận không nói gì về nó.

### 14.5 Ba lớp trần

Ba trần độc lập bảo vệ cửa nhận. Chúng được kiểm **sau** xác thực và **trước** khi xử lý sự kiện đầu tiên. Vượt **bất kỳ**
trần nào thì **cả lô bị từ chối**: không sự kiện nào được xử lý, response **không có `results`**, và không trừ gì khỏi hạn
mức tần suất của bạn.

| # | Trần | Vượt thì | Ghi chú |
|:-:|---|---|---|
| ① | kích thước request (byte) | `413`, `code: "payload_too_large"`, `details.maxBytes` | mặc định **5 MiB**; chúng tôi có thể đặt giá trị khác cho khoá của bạn; không bao giờ quá **10 MiB**. ⚠️ Trần cứng 10 MiB được áp lúc đọc thân — **trước** xác thực, khác với ② và ③ |
| ② | số sự kiện mỗi lô | `413`, `code: "batch_too_large"`, `details.maxEventsPerBatch` | mặc định **500**; `0` nghĩa là không cho gửi lô |
| ③ | số sự kiện mỗi phút | `429`, `code: "rate_limit_exceeded"`, `Retry-After` | đếm **theo sự kiện**, không theo lượt gọi |

**③ đếm theo sự kiện.** Lô N sự kiện dùng N đơn vị của cùng hạn mức mỗi phút như tuyến một-sự-kiện (§10) — một bộ đếm
chung cho mỗi Access Key, dù bạn đi tuyến nào. `RateLimit-Remaining` cho biết bạn còn gửi được bao nhiêu sự kiện trong cửa
sổ hiện tại; nếu nhỏ hơn lô của bạn, hãy gửi lô nhỏ hơn hoặc chờ `RateLimit-Reset`. ⚠️ Lô lớn hơn **cả** hạn mức mỗi phút
của bạn thì không bao giờ được nhận — hãy chia nhỏ. Hãy hỏi chúng tôi hạn mức của bạn khi tuyến lô được bật.

Lỗi cấp lô (không có `results`): `400` thân sai khuôn · `401` sai khoá/chữ ký/timestamp · `413` (①, ②) ·
`422 batch_not_enabled` · `429` (③) · `5xx` lỗi nền tảng (gửi lại cả lô có backoff; an toàn, theo §14.2).

## 15. Đọc kết quả sau `200`

Với một số loại sự kiện, `200` mới chỉ là nửa đầu câu chuyện: chúng tôi **lưu** sự kiện ngay và **xử lý** nó ít lâu sau. Nếu xử lý
hỏng vì một lý do nghiệp vụ, cái `200` bạn đã nhận không đổi. Bạn biết kết quả bằng cách hỏi.

`POST /api/v1/integrations/deliveries` là cửa tra. Ký đúng như cửa gửi sự kiện (§3), và gửi **đúng một** trong hai khoá:

```jsonc
{ "deliveryId": "5b0e…" }      // giá trị chúng tôi trả ở lượt 200
{ "externalId": "evt-123" }    // eventId của bạn; có thể khớp nhiều lượt giao
```

```jsonc
// theo deliveryId
{ "delivery": {
    "deliveryId": "5b0e…", "externalId": "evt-123", "eventSource": "…",
    "outcome": "ACCEPTED",                       // CỬA đã quyết gì: ACCEPTED | DEDUPLICATED | REJECTED_SEMANTIC | REJECTED_STALE
    "receivedAt": "2026-10-04T10:00:00.000Z",
    "processing": [                              // điều xảy ra SAU lượt 200
      { "consumer": "reward-payout", "status": "FAILED",
        "errorCode": "settlement_item_not_found", "updatedAt": "2026-10-04T10:00:05.000Z" }
    ] } }
// theo externalId: { "deliveries": [ { …cùng hình dạng… } ] }   (tối đa 50, mới nhất trước)
```

| `processing[].status` | Nghĩa | Bạn làm gì |
|---|---|---|
| `PENDING` | chưa xử lý | đợi; hỏi lại sau vài giây |
| `SUCCEEDED` | đã xử lý | không làm gì |
| `FAILED` | hỏng, và chúng tôi tự thử lại vài lần | đọc `errorCode` |
| `DEAD` | hỏng và chúng tôi đã ngừng thử lại | đọc `errorCode`; liên hệ chúng tôi nếu là mã bạn không tự sửa được |

- **Hôm nay chỉ `POINT_REDEEMED` có danh sách `processing`** (một phần tử, `consumer: "reward-payout"`). Với mọi loại sự kiện khác, và với lượt
  giao bị cửa từ chối, `processing` là danh sách rỗng: không hứa gì ở đó.
- **`errorCode` là một mã, không bao giờ là một câu.** Nó là `null` trừ khi trạng thái là `FAILED` hoặc `DEAD`. Các mã nằm ở
  [error-codes.md](./error-codes.md#mã-xử-lý-bất-đồng-bộ--processingerrorcode); lỗi nào chúng tôi chưa công bố mã thì báo là `processing_error`.
- **Bạn chỉ thấy lượt giao của chính mình.** Lượt giao của người khác trả lời y hệt lượt không tồn tại: `{ "delivery": null }`.
- **Gửi lại cùng `eventId` không chạy lại việc.** Sau khi sửa nguyên nhân, gửi sự kiện với `eventId` **mới**; giữ nguyên `redemptionRef` cho cùng một khoản trả
  để nó chỉ được ghi đúng một lần.
- Danh sách rỗng khi tra theo `externalId` nghĩa là "chúng tôi không giữ lượt giao nào mang mã đó", không phải "bạn chưa từng gửi".

