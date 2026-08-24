# Tích hợp sự kiện với Nền tảng — tài liệu cho đội kỹ thuật bên đối tác

**Bản 1.0 · 23/08/2026** · Tài liệu này tự chứa: đọc hết là tích hợp được, không cần hỏi thêm tài liệu nào.

> **Đây là đặc tả, không phải đề xuất.** Nền tảng quyết định và công bố; bên đối tác làm theo. Không có
> vòng hỏi–đáp nào chặn việc của bạn.
>
> Tài liệu viết cho **một đội chưa từng đọc mã nguồn của chúng tôi**. Chỗ nào bạn phải đoán là **lỗi của
> tài liệu** — báo lại, chúng tôi sửa.

## Đọc phần nào — chọn một trong hai đường

Tài liệu dài, nhưng **bạn không cần đọc hết để bắn gói tin đầu tiên**.

```
ĐƯỜNG A · CHỈ NHẬN SỰ KIỆN — bắt buộc, đủ để lên thật
   §2 bắt đầu → §3 gói tin → §4 gửi → §5 định danh → §7 xoay khoá
   → §8 CHỈ phần chiều VÀO → §9 danh sách kiểm

ĐƯỜNG B · THÊM PHỤC HỒI — tuỳ chọn, quyết định HẠNG của bạn
   §6 toàn bộ → §8 phần chiều RA
```

| Bạn muốn | Đọc | Bỏ qua được |
|---|---|---|
| bắn được sự kiện, lên thật | **§2 → §5 · §7 · §8 chiều VÀO · §9** | §6 toàn bộ · §8 chiều RA |
| thêm khả năng tự phát hiện và tự lấp chỗ thiếu | thêm **§6 · §8 chiều RA** | — |

⚠️ **Hai chỗ đừng bỏ dù chỉ làm đường A:**
**§8 phần chiều VÀO** là **điều kiện vào cửa** — không đạt thì tích hợp không được bật, dù bạn đã code
xong. Và **§7 xoay khoá** — bí mật sẽ được thay trong lúc bạn đang chạy.

⭐ **§6.4** *(khuôn ký khi chúng tôi gọi sang bạn)* **không cần** cho đường A. Chỉ đọc nó khi bạn thật
sự mở một điểm cuối cho chúng tôi gọi vào.

---

## Mục lục

| | |
|---|---|
| **[0. Đọc thế nào](#0-đọc-thế-nào)** | bản đồ tài liệu · ba tầng · quy ước ký hiệu |
| **[1. Tổng quan](#1-tổng-quan)** | bạn làm gì · nhận được gì · cái gì đã chạy thật |
| **[2. Bắt đầu — 30 phút](#2-bắt-đầu--gói-tin-đầu-tiên-trong-30-phút)** | ví dụ chạy được ngay · ba lượt bắn kiểm chứng |
| **[3. Tầng A — gói tin](#3-tầng-a--gói-tin)** | hình dạng · từng trường · danh mục loại · `payload` |
| **[4. Tầng B — gửi](#4-tầng-b--gửi-cho-chúng-tôi)** | cửa · ký · mã trả lời · tần suất · gửi lại |
| **[5. Hai định danh](#5-hai-định-danh--đừng-gộp)** | `eventId` · `deliveryId` · và vì sao không được gộp |
| **[6. Tầng C — mất thì sao](#6-tầng-c--mất-sự-kiện-thì-sao)** | đối soát · chiều ngược · hạng tích hợp |
| **[7. Xoay khoá](#7-xoay-khoá)** | nhiều bí mật cùng sống · thu hồi |
| **[8. Bài kiểm hợp chuẩn](#8-bài-kiểm-hợp-chuẩn--bạn-tự-chạy)** | 14 ca · điều kiện vào cửa |
| **[9. Danh sách kiểm trước khi lên thật](#9-danh-sách-kiểm-trước-khi-lên-thật)** | 18 mục, tick hết mới mở |
| **[Phụ lục A — bảng mã lỗi](#phụ-lục-a--bảng-mã-lỗi-đầy-đủ)** | mã · nghĩa · bạn làm gì |
| **[Phụ lục B — vector kiểm thử](#phụ-lục-b--vector-kiểm-thử)** | số cố định để bạn tự kiểm hàm ký |
| **[Phụ lục C — thuật ngữ](#phụ-lục-c--thuật-ngữ)** | |
| **[Phụ lục D — câu hỏi thường gặp](#phụ-lục-d--câu-hỏi-thường-gặp)** | |

---

## 0. Đọc thế nào

### Ba tầng, và chúng hỏng theo ba kiểu khác nhau

Hợp đồng chia ba tầng. Đó không phải cách trình bày cho đẹp — ba tầng **hỏng theo ba kiểu khác nhau**,
nên được đóng băng riêng và bạn có thể làm chúng ở ba thời điểm khác nhau.

```
TẦNG A · GÓI TIN      hình dạng dữ liệu       hỏng ⇒ hai bên hiểu khác nhau về NỘI DUNG
TẦNG B · GIAO NHẬN    ký · gửi · mã trả lời   hỏng ⇒ gói tin không tới, hoặc tới hai lần
TẦNG C · PHỤC HỒI     mất rồi thì sao         hỏng ⇒ mất câm, không ai biết
```

**Tầng A + B là đủ để chạy.** Làm xong hai tầng đó là bạn tích hợp được, lên thật được.

**Tầng C quyết định *"khi có sự cố thì ai chứng minh được điều gì"*.** Không bắt buộc — nhưng nó quyết
định **hạng tích hợp** của bạn, và hạng đó có hệ quả thật khi đối soát lệch. Đọc §6.

### Lộ trình gợi ý

| Tuần | Làm gì | Xong thì |
|:--:|---|---|
| 1 | §2 → §4 · dựng hàm ký, bắn được ba lượt kiểm chứng | ký đúng, chống trùng đúng |
| 2 | §3 · ánh xạ nghiệp vụ của bạn sang danh mục loại sự kiện | gửi được sự kiện thật |
| 3 | §8 · chạy bài kiểm hợp chuẩn, chiều VÀO phải đạt 7/7 | **đủ điều kiện lên thật** |
| sau | §6 · dựng đường phục hồi nếu muốn lên hạng | tự phát hiện và tự lấp chỗ thiếu |

### Quy ước ký hiệu

| | |
|---|---|
| ⚠️ | chỗ hay hỏng — đọc kỹ |
| 🔒 | liên quan an toàn |
| ⭐ | mẹo tiết kiệm thời gian |
| **KHÔNG** | cấm, không phải khuyến nghị |

Mọi mốc thời gian trong tài liệu là **ISO-8601, múi giờ UTC** (`Z`). Mọi số tiền là **số nguyên đơn vị
nhỏ nhất**.

---

## 1. Tổng quan

### 1.1 Bạn sẽ làm gì

Bạn gửi cho chúng tôi các **sự việc đã xảy ra trong hệ thống của bạn** — đơn hàng hoàn tất, đơn bị huỷ,
một hành vi trên giao diện của bạn. Chúng tôi quy đổi chúng thành **quyền lợi cho người dùng cuối** —
điểm thưởng, phần thưởng — theo cấu hình chương trình đang chạy.

```
   hệ thống của BẠN                    NỀN TẢNG
  ┌──────────────────┐               ┌─────────────────────────┐
  │  đơn hàng xong   │──── ① ───────▶│  cửa nhận sự kiện       │
  │                  │               │  ↓                      │
  │  sổ sự kiện      │◀─── ② ────────│  cửa đối soát           │
  │                  │               │  ↓                      │
  │  đường phục hồi  │◀─── ③ ────────│  chúng tôi hỏi ngược    │
  └──────────────────┘               └─────────────────────────┘

  ① BẮT BUỘC   bạn bắn sự kiện sang chúng tôi                     (§3, §4)
  ② TUỲ CHỌN   bạn hỏi "các anh đã nhận những gì"                 (§6.2)
  ③ TUỲ CHỌN   chúng tôi hỏi "bên anh đã gửi những gì"            (§6.3)
```

Chỉ ① là bắt buộc. ② và ③ là thứ nâng **hạng tích hợp** của bạn (§6.5).

### 1.2 Khi onboard bạn nhận được gì

| | Là gì | Lưu ý |
|---|---|---|
| **Mã nhận dạng** (`accessKey`) | trả lời *"ai đang gửi"* | ⚠️ **KHÔNG phân biệt hoa/thường** — `AK-1` và `ak-1` là **cùng một khoá**, chung một hạn mức |
| **Bí mật kênh SỰ KIỆN** | để ký gói tin sự kiện | 🔒 **khác** bí mật kênh đăng nhập, dù cùng một mã nhận dạng |
| **Bí mật kênh ĐĂNG NHẬP** | để ký lượt bàn giao danh tính | 🔒 kênh riêng, tài liệu riêng — không dùng trong tài liệu này |
| **Bí mật kênh PHỤC HỒI** | để **chúng tôi** ký khi gọi sang bạn | chỉ cấp khi bạn dựng đường phục hồi (§6.3) |
| **Mã nguồn sự kiện** | ánh xạ `type` của bạn sang sổ nghiệp vụ bên chúng tôi | do chúng tôi khai; bạn chỉ gửi `type` |

🔒 **Vì sao một mã nhận dạng nhưng nhiều bí mật.** Mã trả lời *"bên nào"* — mọi kênh cùng một câu trả
lời, nên một mã là đủ. Bí mật trả lời *"được phép làm việc NÀY"* — mà bí mật đăng nhập nằm ở hệ thống
đăng nhập của bạn, bí mật sự kiện nằm ở hệ thống đơn hàng: **khác người chạm, khác nhịp xoay**. Dùng
chung thì một lần rò ở đường đăng nhập là **đúc được điểm thưởng**.

⚠️ **Mỗi đơn vị của bạn một mã riêng.** Dùng chung mã giữa các đơn vị nghĩa là đơn vị này ký được cho
đơn vị kia — và chúng tôi **không có cách nào phát hiện**.

### 1.3 Cái gì đã chạy thật

Nguyên tắc của bảng này: **chúng tôi thà nói "chưa có" hơn để bạn phát hiện lúc có sự cố.** Viết mã chờ
một thứ chưa tồn tại thì nhánh đó không bao giờ chạy, và bạn sẽ tin là nó đang bảo vệ mình.

| Thứ | Trạng thái |
|---|---|
| Cửa nhận sự kiện `POST /api/v1/integrations/events` | ✅ chạy |
| Xác thực: khoá + chữ ký + độ tươi | ✅ chạy |
| Chống trùng theo `(khoang danh tính, nguồn, mã sự kiện)` | ✅ chạy |
| Xoay khoá không rớt gói tin | ✅ chạy |
| `429` + `Retry-After` + ba tiêu đề `RateLimit-*` | ✅ chạy |
| `X-Response-Time-Ms` — thời gian phía máy chủ, đo được | ✅ chạy |
| `deliveryId` — biên nhận mỗi lượt giao | ✅ chạy |
| Danh mục loại sự kiện + lược đồ `payload` | ✅ chốt |
| `type` được kiểm ở cửa theo danh sách đăng ký cho khoá của bạn | ✅ chạy — loại chưa đăng ký ⇒ `422` |
| Kiểm nội dung `payload` ở cửa | ✅ chạy — thiếu trường bắt buộc ⇒ `422` ngay |
| Cửa đối soát `POST /api/v1/integrations/reconciliation` | ✅ chạy |
| Bài kiểm hợp chuẩn — bạn tự chạy trước khi onboard | ✅ chạy — 14 ca |
| Chúng tôi gọi sang bạn để kéo lại (chiều ra) | ✅ chạy — ký `PartnerRecoverySignatureV1` |
| **Đường kéo lại phía bạn** | ⏳ **tuỳ bạn có gì** — xem §6.5 |

⏳ Dòng cuối phụ thuộc **bạn** có gì, không phải chúng tôi chưa làm.

---

## 2. Bắt đầu — gói tin đầu tiên trong 30 phút

### 2.1 Bạn cần gì

Ba thứ, chúng tôi cấp khi onboard:

```
CỬA          https://<máy chủ chúng tôi>/api/v1
MÃ NHẬN DẠNG AK-…            → đi ở tiêu đề X-API-Key
BÍ MẬT SỰ KIỆN whsec_…       → KHÔNG bao giờ rời máy chủ của bạn
```

⚠️ **Bí mật ký nằm ở máy chủ, không nằm ở ứng dụng di động hay trình duyệt.** Bất cứ ai cầm nó là ký
được một sự kiện khai mình là bạn.

### 2.2 Một ví dụ đầy đủ, chạy được

Đây là ví dụ **hoàn chỉnh**: cùng các con số này, hàm ký của bạn phải ra **đúng** chữ ký dưới. Dùng nó
làm ca kiểm thử đơn vị đầu tiên (xem thêm [Phụ lục B](#phụ-lục-b--vector-kiểm-thử)).

```bash
API='https://<máy chủ chúng tôi>/api/v1'
ACCESS_KEY='AK-DEMO-001'
EVENT_SECRET='whsec_demo_0123456789abcdef'

# ① Thân gói tin — GIỮ NGUYÊN chuỗi này, đây là thứ vừa được ký vừa được gửi
BODY='{"specversion":"1.0","eventId":"evt-88421","externalUserId":"12345","type":"ORDER_COMPLETED","occurredAt":"2026-08-14T09:12:33Z","confidence":"SERVER_OBSERVED","payload":{"orderId":"SO-99881","amountMinor":250000000,"currency":"VND"}}'

# ② Mốc thời gian — GIÂY kể từ epoch (thật thì dùng: TS=$(date +%s))
TS=1786698753

# ③ Ký:  chuỗi ký = <TS> + "." + <thân THÔ>
SIG="sha256=$(printf '%s.%s' "$TS" "$BODY" \
      | openssl dgst -sha256 -hmac "$EVENT_SECRET" -r | cut -d' ' -f1)"

echo "$SIG"
# → sha256=ae00dc858385fdb65061fda5da1809772f8f602f5d653052e7672516c4d59176

# ④ Gửi
curl -sS -D- "$API/integrations/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key:   $ACCESS_KEY" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  --data-binary "$BODY"
```

**Phản hồi mong đợi:**

```jsonc
HTTP/1.1 200 OK
X-Response-Time-Ms: 41
RateLimit-Limit: 600
RateLimit-Remaining: 599
RateLimit-Reset: 47

{ "eventId": "evt-88421", "deliveryId": "del_01J…", "deduplicated": false }
```

⚠️ **`--data-binary`, không phải `-d`.** `curl -d` cắt xuống dòng và có thể đổi dãy byte — chữ ký ký
trên byte, nên gói tin sẽ trượt chữ ký với một triệu chứng rất khó tìm.

### 2.3 Mã ký — ba ngôn ngữ

Luật chỉ có một dòng: **chuỗi ký = `<timestamp>` + `"."` + `<thân THÔ>`**, HMAC-SHA256, in hex thường,
gắn tiền tố `sha256=`.

**Node.js**

```js
const crypto = require('node:crypto');

function kyGoiTin(bimat, thanChuoi, timestampGiay) {
  const chuoiKy = Buffer.concat([
    Buffer.from(`${timestampGiay}.`, 'utf8'),
    Buffer.from(thanChuoi, 'utf8'),        // ĐÚNG chuỗi sẽ đem gửi
  ]);
  return 'sha256=' + crypto.createHmac('sha256', bimat).update(chuoiKy).digest('hex');
}

// Dùng:
const than = JSON.stringify(suKien);       // serialize MỘT LẦN
const ts   = Math.floor(Date.now() / 1000);
const sig  = kyGoiTin(EVENT_SECRET, than, ts);
await fetch(`${API}/integrations/events`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key':   ACCESS_KEY,
    'X-Timestamp': String(ts),
    'X-Signature': sig,
  },
  body: than,                              // GỬI ĐÚNG chuỗi vừa ký
});
```

**Java 17+**

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

static String kyGoiTin(String biMat, byte[] than, long timestampGiay) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(biMat.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    mac.update((timestampGiay + ".").getBytes(StandardCharsets.UTF_8));
    mac.update(than);                       // ĐÚNG mảng byte sẽ đem gửi
    return "sha256=" + HexFormat.of().formatHex(mac.doFinal());
}
```

⚠️ **Java: giữ `byte[]`, đừng đi qua `String` hai lần.** Serialize một lần ra `byte[]`, ký trên nó, gửi
chính nó. Mỗi lần `new String(...)` rồi `getBytes(...)` là một cơ hội đổi byte.

**Shell / kiểm nhanh**

```bash
SIG="sha256=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d' ' -f1)"
```

### 2.4 ⚠️ Lỗi số một: serialize lại trước khi ký

Đây là lỗi làm mất nhiều thời gian nhất của mọi đợt tích hợp, vì triệu chứng của nó **trông giống hệt
sai khoá**: `401` lác đác, chỉ với **một số** gói tin, và bạn sẽ đi tìm lỗi ở khoá.

```
SAI                                        ĐÚNG
──────────────────────────────────────     ──────────────────────────────────────
than = serialize(obj)                      than = serialize(obj)
sig  = ky(serialize(obj))   ← lần 2!       sig  = ky(than)
gui(serialize(obj))         ← lần 3!       gui(than)
```

Serialize lại có thể đổi **thứ tự khoá**, **khoảng trắng**, cách thoát ký tự Unicode. Chữ ký ký trên
byte, nên chỉ cần lệch một byte là trượt.

**Luật:** serialize **đúng một lần**, giữ lại chuỗi/mảng byte đó, **ký nó và gửi nó**.

⚠️ Cùng lý do: nếu framework của bạn có middleware tự đọc-và-dựng-lại JSON (một số HTTP client, một số
lớp logging), hãy chắc nó **không** chạm vào thân sau khi bạn ký.

### 2.5 Ba lượt bắn kiểm chứng — làm đúng thứ tự

Mỗi bước chứng minh **một** thứ. Đừng bỏ bước 2.

| # | Bắn gì | Chờ | Chứng minh |
|:--:|---|---|---|
| **1** | gói tin hợp lệ, `eventId` mới | `200` `deduplicated: false` | ký đúng · khuôn đúng · ánh xạ `type` đúng |
| **2** | **gửi lại y nguyên** gói tin bước 1 | `200` `deduplicated: true` | chống trùng chạy — gửi lại **vô hại** |
| **3** | sửa **một ký tự** trong thân, giữ nguyên chữ ký | `401` | chữ ký thật sự phủ nội dung |

⚠️ **Bước 2 là bước quan trọng nhất của cả tài liệu này.** Nó là thứ cho phép bạn gửi lại thoải mái ở
mọi tình huống sau này — `429`, `5xx`, hết giờ mạng, chạy bù.

**Nếu bước 2 trả `deduplicated: false`** thì `eventId` của bạn đang sinh theo **lần gọi HTTP** chứ không
theo **sự việc** — và mọi thứ phía sau sẽ **cộng hai lần**. Dừng lại, đọc §3.3, sửa trước khi đi tiếp.

Hai lượt nữa nếu bạn muốn chắc:

| # | Bắn gì | Chờ |
|:--:|---|---|
| **4** | `X-Timestamp` lệch **10 phút** | `401` (cửa sổ ±5 phút) |
| **5** | `type` chưa được đăng ký cho khoá của bạn | `422` — **không** phải `401` |

---

## 3. Tầng A — gói tin

### 3.1 Hình dạng

```jsonc
{
  "specversion":    "1.0",                   // phiên bản PHONG BÌ — tuỳ chọn, §3.2
  "eventId":        "evt-88421",             // định danh SỰ VIỆC — khoá chống trùng
  "externalUserId": "12345",                 // id người dùng CỦA BẠN
  "type":           "ORDER_COMPLETED",       // danh mục đóng, §3.4
  "occurredAt":     "2026-08-14T09:12:33Z",  // lúc việc XẢY RA, không phải lúc gửi
  "confidence":     "SERVER_OBSERVED",       // độ chắc, §3.2
  "payload":        { "orderId": "SO-99881", "amountMinor": 250000000, "currency": "VND" }
}
```

### 3.2 Từng trường

| Trường | Bắt buộc | Kiểu | Nghĩa |
|---|:--:|---|---|
| `eventId` | ✅ | chuỗi | định danh **sự việc**. Xem §3.3 — đây là chỗ hỏng nhiều nhất |
| `externalUserId` | ✅ | chuỗi | id người dùng **trong hệ thống của bạn** |
| `type` | ✅ | chuỗi | một giá trị trong danh mục đóng §3.4. **Phân biệt hoa/thường** |
| `occurredAt` | ✅ | ISO-8601 | **lúc việc xảy ra** |
| `payload` | ✅ | đối tượng | nội dung nghiệp vụ, theo từng loại — §3.5 |
| `confidence` | ⬜ | chuỗi | độ chắc — xem dưới |
| `specversion` | ⬜ | chuỗi | hằng `"1.0"` — xem dưới |

**`occurredAt` — lúc việc XẢY RA, không phải lúc gửi.** Chúng tôi dùng nó để quyết định sự việc có nằm
trong kỳ hiệu lực của một chương trình hay không, và để xếp nó vào cửa sổ đối soát. Điền lúc gửi thì
một đơn hàng cũ gửi bù sẽ bị tính vào **hôm nay** — sai kỳ hiệu lực, và người dùng nhận sai quyền lợi.

**`confidence` — độ chắc, không phải phán quyết.** Ba mức tăng dần:

```
CLIENT_ASSERTED   <   SERVER_OBSERVED   <   SETTLED
(máy khách khai)      (máy chủ bạn thấy)    (đã quyết toán)
```

Mức thấp hơn mức một phần thưởng đòi thì sự kiện **vẫn `200`, vẫn được lưu**, chỉ **không được tính
cho phần thưởng đó**. Đây **không phải lỗi — đừng gửi lại.**

⚠️ Ba thứ **KHÔNG** nâng độ chắc: bạn là ai · đi bằng đường nào · gửi lại mấy lần.

**`specversion` — một hằng, và nó tuỳ chọn.**

| Bạn gửi | Chúng tôi làm gì |
|---|---|
| `"1.0"` | ✅ giá trị hợp lệ **duy nhất** hôm nay |
| **không gửi** trường này, hoặc `null` | ✅ nhận bình thường, hiểu là `"1.0"`. **Không** phải lỗi |
| bất cứ giá trị nào khác — `"2.0"` · `"banana"` · chuỗi rỗng · số `1.0` (không phải chuỗi) | ❌ **`400`** |

⚠️ **`400`, không phải `422` — và khác biệt đó có nghĩa cho bạn.** `400` nghĩa *"gói tin sai khuôn,
sửa rồi gửi lại"*; `422` nghĩa *"gói tin đúng khuôn nhưng không được chấp nhận về nghiệp vụ"*, và ở
`422` thì **`code` mới nói bên nào phải hành động** (§4.4). `specversion` là một hằng nên nó rơi vào
`400`: bạn tự sửa được một mình, không phải chờ ai.

⚠️ **Lượt `400` không sinh `deliveryId`** — nó bị chặn **trước** phần xử lý, cùng hạng với JSON hỏng.
Đừng đi tra mã lượt giao cho một lượt `400`; không có mã nào.

Hệ thống của bạn đang chạy mà không gửi trường này thì **không phải đi thêm nó vào**. Ý nghĩa của nó là
tương lai: chúng tôi phân biệt *"chưa khai"* với *"khai đúng 1.0"* để ngày đổi phiên bản còn biết bên
nào đã chuyển. Chưa có phiên bản thứ hai, và bạn sẽ được báo trước nếu có.

⚠️ Đây là phiên bản của **phong bì**, không phải của **loại sự kiện**. Đừng gói phiên bản nghiệp vụ vào đây.

### 3.3 ⚠️ `eventId` là định danh của SỰ VIỆC, không phải của lần gọi HTTP

Đây là chỗ hỏng nhiều nhất của cả hợp đồng, và nó hỏng **im lặng** — không mã lỗi nào báo cho bạn.

```
ĐÚNG   một đơn hàng hoàn thành  ⟶  một eventId, dùng lại ở MỌI lượt gửi lại
SAI    mỗi lần gọi HTTP         ⟶  một eventId mới
```

Sinh `eventId` theo từng lần gọi thì chống trùng **vô hiệu**: gửi lại một đơn hàng sẽ đẻ hàng thứ hai,
và **một sự việc được tính hai lần**. Cả hai lượt đều `200`.

#### Mỗi sự việc một `eventId` — mã đơn KHÔNG dùng làm `eventId`

Một đơn `ORD-123` hoàn tất, rồi bị huỷ. Đó là **hai sự việc**, bạn gửi **hai gói tin, hai `eventId`**:

```jsonc
{ "eventId": "EVT-001", "type": "ORDER_COMPLETED", "payload": { "orderId": "ORD-123", … } }
{ "eventId": "EVT-002", "type": "ORDER_CANCELLED", "payload": { "orderId": "ORD-123", … } }
```

| | Trả lời câu hỏi |
|---|---|
| `orderId` (trong `payload`) | *"việc này thuộc đơn nào"* — **lặp lại** ở mọi lượt của cùng một đơn |
| `eventId` | *"đây là sự việc nào"* — **không bao giờ** lặp |

Chúng tôi **cưỡng chế** điều này, không chỉ khuyến nghị:

| Bạn gửi | Chúng tôi trả |
|---|---|
| `eventId` mới | `200` — nhận, kèm `deliveryId` |
| **cùng** `eventId`, **cùng** `type` | `200` `deduplicated: true` — đây là **gửi lại**, và gửi lại là bình thường |
| **cùng** `eventId`, **khác** `type` | `422` **`event_id_conflict`** — câu lỗi nói rõ mã đó đang thuộc loại nào |

⚠️ **Vì sao chúng tôi từ chối thay vì cho qua.** Nếu cho qua, `eventId` thôi còn là danh tính — khi đối
soát lệch, không bên nào tra ngược được một lượt cụ thể. Nếu chúng tôi im lặng coi nó là *"gửi lại"*,
bạn sẽ đọc thành *"đã tới nơi"* và **không gửi lại nữa**, trong khi sự việc đó chúng tôi **chưa từng
nhận**. Từ chối thì bạn thấy ngay, và chỉ tốn một mã mới.

⭐ `eventId` **không cần mang ý nghĩa gì** — một `uuid` là đủ. Nó chỉ cần **duy nhất trong hệ của bạn**.

### 3.4 Danh mục loại sự kiện — danh mục ĐÓNG

`type` nhận **đúng** các giá trị dưới.

| `type` | Bạn gửi? | Nghĩa |
|---|:--:|---|
| `ORDER_CREATED` | ✅ | đơn **vừa tạo**, chưa hoàn tất — điều kiện của đơn được ghi nhận từ lúc này |
| `ORDER_COMPLETED` | ✅ | đơn đã hoàn tất |
| `ORDER_CANCELLED` | ✅ | đơn **huỷ hoặc hoàn** |
| `UI_ACTION` | ✅ | một hành vi trên giao diện của bạn, bạn chứng thực rồi gửi về |
| `CHECKIN` | KHÔNG | xảy ra trong sản phẩm của chúng tôi, chúng tôi tự ghi |
| `STREAK_REACHED` | KHÔNG | chúng tôi **suy ra** từ chuỗi điểm danh, không nhận từ ngoài |

⚠️ **Huỷ và hoàn là MỘT loại, không phải hai.** Hai việc đó có cùng hệ quả: đảo phần đã ghi. Đừng đợi
một `ORDER_REFUNDED` — nó không tồn tại.

⚠️ **Phân biệt hoa/thường.** `checkin` không phải `CHECKIN`. Chúng tôi cố ý không nhận cả hai: hai chuỗi
cùng nghĩa đi vào cùng một cột thì về sau đếm ra hai loại.

Mỗi tình huống một mã **khác nhau, vì việc bạn phải làm khác nhau**:

| Bạn gửi | Mã | Bạn làm gì |
|---|---|---|
| giá trị ngoài bảng trên (vd `order`, `order.v2.created`) | `unknown_event_type` | **đổi giá trị** — câu lỗi liệt kê sẵn các loại hợp lệ |
| `STREAK_REACHED` | `derived_event_not_accepted` | **thôi gửi** — chúng tôi tự suy ra |
| loại đúng nhưng chưa khai cho khoá của bạn | `event_type_not_registered` | **báo chúng tôi** — lỗi cấu hình phía chúng tôi, gói tin bạn đúng |
| `eventId` đã dùng cho một loại khác | `event_id_conflict` | **cấp mã mới cho lượt này** |

#### `ORDER_CREATED` — gửi khi nào

**Đơn vừa được tạo.** Gửi loại này khi bạn muốn nền tảng **ghi nhận điều kiện của đơn ngay từ thời điểm
tạo**, thay vì chờ tới lúc đơn hoàn tất.

- **Cần làm gì để dùng:** báo chúng tôi khai loại này cho khoá của bạn. Chưa khai thì nhận `422
  event_type_not_registered`, như mọi loại khác.
- **Đơn không hoàn tất hoặc bị huỷ:** nền tảng **tự xử lý theo quy tắc nghiệp vụ tương ứng**. Bạn
  **không** phải gửi một sự kiện để *"huỷ phần thưởng"* — chỉ gửi `ORDER_CANCELLED` khi việc huỷ hoặc
  hoàn **thật sự xảy ra** ở phía bạn.

⚠️ Vẫn là **ba gói tin, ba `eventId` riêng** cho một đơn: tạo · hoàn tất · huỷ.

⭐ **Không gửi `ORDER_CREATED` cũng không sao.** Chỉ gửi `ORDER_COMPLETED` là một cách tích hợp hợp lệ
và đầy đủ; `ORDER_CREATED` chỉ làm thời điểm ghi nhận sớm hơn.

### 3.5 `payload` chở gì — theo từng loại

#### `ORDER_CREATED` · `ORDER_COMPLETED` · `ORDER_CANCELLED`

| Trường | Bắt buộc | Nếu thiếu |
|---|:--:|---|
| `orderId` | ✅ | **`422` `payload_field_missing`**. Đây là khoá **ổn định xuyên mọi chuyển trạng thái của cùng một đơn** — thiếu nó thì lệnh huỷ không tìm ra đơn đã cộng |
| `amountMinor` | ⬜ — ✅ nếu phần thưởng có **ngưỡng giá trị đơn** | phần thưởng theo ngưỡng **không chạy**. Chúng tôi **không** đoán bằng 0 |
| `currency` | ✅ **khi có** `amountMinor` | **`422` `payload_field_missing`**. Chúng tôi không mặc định `VND` — mặc định là cách một đơn vị dùng đồng tiền khác âm thầm hiện sai |
| `category` | ⬜ | phần thưởng khai `category` sẽ **không khớp**. Đây là *không khớp*, không phải lỗi |

⚠️ `amountMinor` là **số nguyên đơn vị nhỏ nhất** — `250000000` là 2.500.000,00 VND. **Đừng gửi số thập phân.**

#### `UI_ACTION`

| Trường | Bắt buộc | Nếu thiếu |
|---|:--:|---|
| `actionKey` | ✅ | **`422` `payload_field_missing`** |

`actionKey` là mã hành vi hai bên thống nhất trước; chúng tôi so nó với cấu hình của từng phần thưởng.

### 3.6 Cửa từ chối NGAY khi thiếu — và trường bắt buộc phải là CHUỖI

Gói tin thiếu trường ở §3.5 nhận **`422` ngay tại cửa**, **không** được lưu vào sổ nghiệp vụ, và câu lỗi
**nêu đích danh trường thiếu**:

```jsonc
{
  "code":    "payload_field_missing",
  "status":  422,
  "detail":  "payload thiếu trường bắt buộc cho loại 'ORDER_COMPLETED': orderId",
  "details": { "deliveryId": "del_01J…" }
}
```

⚠️ **Trường bắt buộc phải là CHUỖI không rỗng — số không được tính là có.** `"orderId": 12345` bị từ
chối; `"orderId": "12345"` thì được. Đây không phải khắt khe cho vui: bên trong chúng tôi so khớp đơn
bằng chuỗi, nên một `orderId` dạng số sẽ **lọt vào rồi không khớp được với gì cả** — và bạn sẽ không
thấy lỗi nào. Thà chặn ở cửa.

⚠️ Khoảng trắng cũng không tính: `"orderId": "  "` bị từ chối.

**`422` không phải `400`.** Gói tin của bạn **đúng khuôn**; thứ sai là **nội dung**. Đừng gửi lại y
nguyên — sửa nội dung rồi gửi.

⭐ **Lượt bị `422` VẪN có `deliveryId`**, nằm trong `details`, và tra được ở cửa đối soát (§6.2). Chúng
tôi ghi nhận là **đã nhận và đã từ chối** — nên khi đối soát ra chênh lệch, hai bên nhìn được cùng một
lượt thay vì cãi nhau xem nó có tới hay không.

### 3.7 Ba trường bạn KHÔNG được gửi

`partnerCode` · `identityScopeId` · `tenantId`. Gửi kèm thì **bị bỏ qua** (không phải bị từ chối).

🔒 **Vì sao.** Ba trường đó quyết định gói tin rơi vào **sổ nghiệp vụ nào**. Đọc chúng từ thân gói tin là
cho bên gửi **tự chọn ghi vào sổ của ai** — và một bên dùng khoá thật của chính mình sẽ ký được một gói
tin khai mình là bên khác, chữ ký **hợp lệ**, cửa nhận **không có cách nào biết**. Suy từ khoá đã xác
thực thì lớp tấn công này **không tồn tại**, thay vì phải đi canh.

### 3.8 Trường thừa, và một trường đã bỏ

**Trường thừa** không có trong bảng §3.5 được **lưu nguyên văn** cùng gói tin và không ảnh hưởng gì.
Chúng tôi giữ lại để đối soát. Bạn **không cần** cắt bớt.

**`payload.state` KHÔNG còn được đọc.** Bản trao đổi trước có nhắc một trường `state` trong `payload` để
phân biệt đơn hoàn tất với đơn huỷ. Bỏ đi — chuyển trạng thái nay nằm ở `type`. Bạn vẫn gửi kèm cũng
được, nó nằm im như mọi trường chúng tôi không đọc; nhưng **đừng dựa vào nó**: một gói tin
`type: "ORDER_COMPLETED"` kèm `payload.state: "cancelled"` sẽ được xử lý là **hoàn tất**.

### 3.9 Đối chiếu CloudEvents

Chúng tôi **ánh xạ ngữ nghĩa** sang CloudEvents v1.0 và **không tuyên bố tuân thủ** một chế độ nào của
nó. Bảng này để đội đã quen CloudEvents đọc nhanh:

| CloudEvents v1.0 | Ở đây | |
|---|---|---|
| `id` | `eventId` | cùng vai |
| `source` | *(không có trong thân)* | **cố ý lệch** — suy từ khoá, xem §3.7 |
| `specversion` | `specversion` | phiên bản phong bì **của nền tảng này** — hằng `"1.0"`, tuỳ chọn |
| `type` | `type` | ánh xạ qua cấu hình |
| `time` | `occurredAt` | khớp nghĩa — *lúc việc xảy ra* |
| `data` | `payload` | cùng vai |
| `subject` | *(không ánh xạ 1:1)* | `externalUserId` là **trường nghiệp vụ**, không phải `subject` |
| `datacontenttype` | *(không có)* | tiêu đề `Content-Type` đã trả lời |

⭐ Quy tắc duy nhất của CloudEvents về tính duy nhất là *"`source` + `id` phải duy nhất"*. Khoá chống
trùng của chúng tôi — `(khoang danh tính, nguồn, mã sự kiện)` — là ràng buộc nghiệp vụ **đặt trên** quy
tắc đó, chặt hơn nó, không mâu thuẫn.

---

## 4. Tầng B — gửi cho chúng tôi

### 4.1 Cửa và tiêu đề

```
POST /api/v1/integrations/events
Content-Type: application/json
```

| Tiêu đề | Bắt buộc | Nghĩa |
|---|:--:|---|
| `X-API-Key` | ✅ | mã nhận dạng của bạn |
| `X-Timestamp` | ✅ | **giây** kể từ epoch (không phải mili-giây) |
| `X-Signature` | ✅ | `sha256=<hex thường>` — §4.2 |

⚠️ **Không có `X-Delivery-Id`.** Bạn có định danh lượt gửi riêng thì giữ ở phía bạn; chúng tôi tự phát
biên nhận (§5).

### 4.2 Khuôn ký — `EventIngressSignatureV1`

```
chuỗi ký  =  <X-Timestamp>  +  "."  +  <thân gói tin THÔ, theo BYTE>
chữ ký    =  "sha256=" + hex_thường( HMAC-SHA256( bí_mật_kênh_sự_kiện, chuỗi ký ) )
```

Mã mẫu ba ngôn ngữ ở §2.3. Vector kiểm thử ở [Phụ lục B](#phụ-lục-b--vector-kiểm-thử).

⚠️ **Ký trên thân THÔ — đúng dãy byte bạn gửi đi.** Xem §2.4, đây là lỗi số một.

⚠️ **Dấu `.` ngăn giữa là bắt buộc, và nó có lý do.** Không có nó thì `ts=1` + thân `23…` và `ts=12` +
thân `3…` ký ra **cùng một chuỗi** — tức phát lại được một gói tin cũ dưới một mốc thời gian khác.

🔒 **Khuôn này CÓ TÊN, và tên đó có nghĩa.** Kênh bàn giao danh tính dùng khuôn **khác**
(`IdentityHandoffSignatureV1`, nối bằng `|`); chiều chúng tôi gọi sang bạn dùng khuôn **thứ ba**
(`PartnerRecoverySignatureV1`, §6.4). Ba kênh **không cùng một hợp đồng thuật toán** — **đừng viết một
hàm ký dùng chung cho cả ba.**

### 4.3 Độ tươi — cửa sổ ±5 phút

Chặn **cả hai phía**. Gói tin từ **tương lai** cũng bị chặn: đó là dấu hiệu đồng hồ bạn sai, và tin nó
thì cửa sổ chống phát lại bị **kéo dài đúng bằng khoảng lệch** — bạn tự nới hàng rào của chính mình.

⇒ **Đồng bộ đồng hồ máy chủ của bạn (NTP).** Đây là nguyên nhân số một của `401` không giải thích được.

### 4.4 Mã trả lời — ĐÓNG BĂNG

| Mã | Nghĩa | Bạn làm gì |
|:--:|---|---|
| `200` | đã nhận và **lưu bền** — **kể cả trùng** | **dừng gửi lại** |
| `400` | thân sai khuôn | sửa gói tin |
| `401` | khoá · chữ ký · độ tươi | sửa cấu hình xác thực |
| `404` | tuyến không tồn tại | lỗi cấu hình |
| `409` | **KHÔNG dùng cho sự kiện trùng** | — |
| `422` | đúng khuôn, **sai nghĩa** | **đừng gửi lại mù** — sửa nội dung hoặc báo chúng tôi |
| `429` | vượt trần tần suất **của khoá bạn** | đợi `Retry-After` giây rồi gửi lại **y nguyên** |
| `5xx` | bên chúng tôi hỏng | gửi lại, lùi dần |

#### ⚠️ `422` KHÔNG đồng nghĩa "lỗi phía chúng tôi" — đọc `code` mới biết bên nào phải làm gì

`422` chỉ nói **một** điều: gói tin **đúng khuôn**, nhưng **không được chấp nhận về nghiệp vụ hoặc cấu
hình**. Nó **không** cho biết bên nào phải sửa — `code` mới cho biết, và **bốn trên năm mã là việc của
bạn**:

| `code` | Ai phải hành động | Làm gì |
|---|:--:|---|
| `payload_field_missing` | **bạn** | sửa `payload` — câu lỗi nêu đích danh trường thiếu |
| `unknown_event_type` | **bạn** | đổi `type` — câu lỗi liệt kê các loại hợp lệ |
| `event_id_conflict` | **bạn** | cấp `eventId` mới cho lượt này |
| `derived_event_not_accepted` | **bạn** | thôi gửi loại đó — chúng tôi tự suy ra |
| `event_type_not_registered` | **chúng tôi** | báo chúng tôi khai loại đó cho khoá của bạn |

⇒ Gặp `422`, **rẽ nhánh theo `code`** rồi mới quyết định chờ chúng tôi hay tự sửa. Chỉ đúng một mã —
`event_type_not_registered` — là thứ bạn không tự giải quyết được.

⭐ **Trùng là THÀNH CÔNG.** `200` kèm `deduplicated: true`. Trả `409` sẽ biến bên gửi thành máy gửi lại
vô hạn — nên chúng tôi không làm thế.

⚠️ **`200` KHÔNG hứa sự kiện được TÍNH.** Nó hứa **đã nhận và lưu bền**. Một sự kiện xảy ra trước mốc
tham gia, hoặc có `confidence` thấp hơn mức phần thưởng đòi, vẫn `200` và vẫn **không sinh điểm** —
đúng thiết kế, không phải lỗi.

⚠️ **Mọi nhánh xác thực hỏng trả CÙNG một mã và CÙNG một câu** — khoá sai, chữ ký sai, quá hạn đều `401`
với một thông báo. Đây là **chủ đích**: tách ra là nói cho người dò biết họ đã đoán đúng nửa nào. Gặp
`401` thì kiểm **cả ba** thứ, đừng suy ra thứ nào đúng.

**Thứ tự tự kiểm khi gặp `401`:**

```
① Đồng hồ máy chủ lệch quá 5 phút?          → phổ biến nhất
② Có serialize lại trước khi ký?  (§2.4)     → phổ biến thứ hai
③ Ký bằng bí mật của kênh khác?              → xem §1.2
④ Mã nhận dạng đúng nhưng bí mật vừa bị thu? → xem §7
```

### 4.5 Thân lỗi

```jsonc
{
  "code":       "INTEGRATION_KEY_ALREADY_REVOKED",   // rẽ nhánh theo cái này
  "detail":     "Khoá này đã bị thu hồi trước đó.",  // câu dự phòng, để hiện tạm
  "messageKey": "error.keyAlreadyRevoked",           // khoá để BẠN tự dựng câu theo ngôn ngữ của mình
  "details":    { "revokedAt": "2026-08-22T14:54:16.401Z" }   // dữ liệu, ISO-8601 UTC
}
```

| Trường | Dùng để |
|---|---|
| `code` | **rẽ nhánh trong mã của bạn**. Đây là thứ duy nhất được đóng băng |
| `detail` | câu tiếng Việt để hiện tạm khi bạn chưa dựng bảng dịch |
| `messageKey` | khoá để bạn tra bảng dịch của mình, nếu bạn muốn hiện theo ngôn ngữ/định dạng của mình |
| `details` | **dữ liệu có cấu trúc** — mốc thời gian, mã tra cứu |

⚠️ **Mốc thời gian chỉ nằm trong `details`, không nằm trong câu.** Lý do rất thực tế: máy chủ chúng tôi
không biết bạn đang ở múi giờ nào, nên một mốc đã định dạng sẵn trong câu sẽ **lệch** với mốc bạn tự
hiện ở màn của mình — cùng một sự việc, hai con số, và người vận hành đọc thành **hai sự việc**. Cứ lấy
mốc ở `details` rồi định dạng theo người đang xem.

⭐ **Đang đọc `code` thì bạn không phải sửa gì cả** — `messageKey` và `details` là thuần cộng thêm.

### 4.6 Tần suất

| Tiêu đề trả về | Nghĩa |
|---|---|
| `RateLimit-Limit` | trần của khoá bạn trong một cửa sổ |
| `RateLimit-Remaining` | còn bao nhiêu lượt |
| `RateLimit-Reset` | ⚠️ **SỐ GIÂY còn lại** — **KHÔNG** phải mốc epoch |
| `Retry-After` | *(chỉ ở `429`)* số giây nên đợi |

⚠️ **Đọc kỹ `RateLimit-Reset`.** Ngoài đời có hai họ tiêu đề trùng tên mà khác nghĩa — một họ trả mốc
epoch, một họ trả số giây. **Ở đây là số giây.** Hiểu nhầm thành epoch thì bạn tính ra một mốc ở năm
1970, tức gửi lại **ngay lập tức** — đúng lúc đang quá tải.

⚠️ Ba tiêu đề `RateLimit-*` **vắng mặt** khi bộ đếm phía chúng tôi tạm không trả lời được. Lúc đó cửa
**vẫn phục vụ** — chúng tôi cho qua chứ không chặn, chỉ là lượt đó không được đếm. **Vắng là thành
thật:** phát một con số bịa còn tệ hơn.

### 4.7 Gửi lại — chúng tôi chuẩn hoá NGHĨA, không chuẩn hoá CHÍNH SÁCH

```
HỢP ĐỒNG BÊN NHẬN (đóng băng)        KHUYẾN NGHỊ CHO BÊN GỬI (không ép)
  2xx     = đã nhận                    gửi lại khi 429 / 5xx / hết giờ mạng
  non-2xx = chưa nhận                  lùi dần theo hàm mũ + nhiễu ngẫu nhiên
                                       có hạn tổng; hết hạn thì vào hàng chết
```

Chúng tôi **không** viết *"chuẩn ngành là gửi lại N lần trong M giờ"*. Rà sáu nền tảng lớn thì mỗi bên
một chính sách; ép một con số là bịa ra một chuẩn không tồn tại. **Chính sách gửi lại là của bạn.**

⭐ Điều duy nhất bạn cần chắc trước khi bật gửi lại: **bước 2 ở §2.5 đã ra `deduplicated: true`.** Có nó
rồi thì gửi lại bao nhiêu lần cũng an toàn.

### 4.8 Thời gian phản hồi

Mục tiêu **< 500ms** cho cửa sự kiện.

⭐ Mỗi phản hồi mang **`X-Response-Time-Ms`** — thời gian **phía máy chủ chúng tôi**, đã bỏ phần mạng.
Lấy tổng bạn đo được **trừ đi** số này thì ra phần mạng.

Nó ở đây vì một lý do cụ thể: khi một lượt gọi chậm, hai bên luôn có đúng hai giả thuyết — *"mạng chậm"*
và *"máy chủ bên kia chậm"* — và **không bên nào tự chứng minh được**. Con số này chấm dứt cuộc cãi đó.

---

## 5. Hai định danh — đừng gộp

| | Ai phát | Đổi khi gửi lại? | Dùng để |
|---|---|:--:|---|
| **`eventId`** | **bạn** | **KHÔNG** — giữ nguyên | **chống trùng** |
| **`deliveryId`** | **chúng tôi** | ✅ **mỗi lượt một giá trị mới** | **truy vết** |

```
eventId = evt_123
   ├── lượt giao #1   deliveryId = del_001   →  deduplicated: false
   └── lượt giao #2   deliveryId = del_002   →  deduplicated: true
```

```jsonc
// lượt đầu
{ "eventId": "evt_123", "deliveryId": "del_456", "deduplicated": false }
// gửi lại ĐÚNG gói tin đó
{ "eventId": "evt_123", "deliveryId": "del_789", "deduplicated": true  }
```

⚠️ **`deliveryId` KHÔNG phải khoá chống trùng.** Gộp hai thứ này lại thì mỗi lượt gửi lại đẻ một hàng
mới ⇒ **cộng điểm nhiều lần**.

⭐ **Ghi lại `deliveryId` ở phía bạn.** Khi có sự cố, đó là **từ duy nhất hai bên cùng dùng được** để
gọi tên đúng một lượt giao — thay vì mô tả *"cái lượt lúc 9 giờ sáng"*.

⚠️ **`deliveryId` có thể VẮNG** trong một phản hồi. Nghĩa là kho truy vết của chúng tôi tạm không ghi
được — gói tin của bạn **vẫn được nhận và lưu bền như thường**. Vắng là **thành thật**: phát một mã
không tra ngược được thì bạn cầm nó đi hỏi và không ai tìm thấy gì. **Đừng coi là lỗi, đừng gửi lại.**

⚠️ Lượt **`422`** cũng mang `deliveryId` (trong `details`) — và đó là lượt bạn cần tra **nhất**: nó
không vào sổ nghiệp vụ nên **không có dấu vết nào khác**.

---

## 6. Tầng C — mất sự kiện thì sao

> Tầng này **không bắt buộc** để tích hợp. Nó quyết định **hạng** của bạn (§6.5), và hạng quyết định
> câu *"khi đối soát lệch, ai chứng minh được điều gì"*.

### 6.1 Nguyên lý: vòng chỉ khép được ở bên CHỊU THIỆT

Khép được vòng nghĩa là làm được **cả hai** vế:

| Vế | Cần gì | Ai có |
|---|---|---|
| **phát hiện** — *"đáng lẽ tôi phải có cái nào"* | sổ của **bên GỬI** | chỉ bạn |
| **sửa** — *"cho tôi lại cái đó"* | nội dung gói tin | chỉ bạn |

**Giới hạn cấu trúc** — chúng tôi viết ra để không hứa quá:

```
sổ của chúng tôi chứng minh được :  "tôi ĐANG GIỮ cái này"        ✅
              KHÔNG bao giờ được :  "anh CHƯA TỪNG GỬI cái kia"   ✗
```

⇒ Cửa sổ đối soát phía chúng tôi là **một nửa**. Nửa còn lại **bắt buộc** lấy từ sổ của bạn. Đây không
phải thiếu sót có thể vá — nó là **giới hạn của thông tin**.

**Và vì sao số đếm không đủ.** Một câu *"ngày D tôi nhận N sự kiện"* nói được *"có lệch"*, và **không
nói được lệch cái nào**. Biết thiếu 3 mà không biết là 3 cái nào thì không sửa được gì. ⇒ Bề mặt đối
soát của chúng tôi so theo **định danh**, không chỉ theo số đếm.

### 6.2 Cửa đối soát — `POST /api/v1/integrations/reconciliation`

Ký **y hệt** cửa sự kiện (`EventIngressSignatureV1`, §4.2) — bạn không phải học gì thêm.

```jsonc
// gửi
{ "eventSource": "<nguồn CỦA BẠN>", "from": "2026-08-10T00:00:00Z", "to": "2026-08-11T00:00:00Z" }

// nhận
{
  "eventSource": "…",
  "digestAlgorithm": "v1: sha256(hex) trên các eventId sắp xếp tăng dần, nối bằng \"\\n\"",
  "windows": [ {                          // MỚI → CŨ
    "windowStart": "2026-08-10T18:00:00Z",
    "windowEnd":   "2026-08-11T00:00:00Z",
    "status":      "CLOSED",
    "eventCount":  3,
    "digest":      "v1:8d3f182a…",
    "eventIds":    ["evt-1", "evt-2", "evt-3"]
  } ],
  "capability": { "tier": "INGEST_ONLY", "meaning": "…", "closesLoop": false }
}
```

⭐ **`eventIds` là thứ bạn thật sự cần.** So `eventCount` chỉ cho biết *"có lệch"*; so **tập `eventIds`**
với sổ của bạn cho biết **lệch cái nào** — rồi bạn bắn lại đúng những cái đó qua **cửa sự kiện đã có**.
Bắn thừa **vô hại**: chống trùng theo `eventId` bảo đảm không cộng hai lần.

#### Tự tính lại mã tổng để kiểm — nên làm ít nhất một lần lúc đấu nối

```
loại trùng  →  sắp xếp tăng dần  →  nối bằng "\n"  →  sha256  →  hex thường  →  thêm tiền tố "v1:"
```

Ví dụ kiểm được: tập `["evt-1","evt-2","evt-3"]` cho

```
v1:8d3f182a04c6d2bcb51a2e6f0201039af53aa777c6aa18236b3c6eae53083b44
```

⚠️ **Sắp xếp là bắt buộc.** Hai bên **không bao giờ** có cùng thứ tự: bạn xếp theo sổ của bạn, chúng tôi
xếp theo lúc gói tin tới. Không sắp thì cùng một tập vẫn ra hai mã khác nhau và **mọi** cửa sổ báo lệch.

⚠️ **Trần 10.000 định danh một cửa sổ.** Tràn thì phản hồi thêm `"eventIdsTruncated": true` — còn
`eventCount` và `digest` **vẫn phủ toàn bộ** cửa sổ. Nghĩa là bạn **vẫn biết chắc có lệch hay không**;
chỉ vế *"lệch cái nào"* là chưa đủ danh sách. **Đừng đọc một danh sách bị cắt thành *"bên kia thiếu"*.**

⚠️ **Cửa sổ neo theo `occurredAt`** (lúc việc **xảy ra**), không theo lúc chúng tôi nhận. Một sự kiện
xảy ra lúc 07:00 mà tới chúng tôi lúc 15:00 vẫn nằm ở cửa sổ **06:00–12:00**. Đó là lý do có ân hạn, và
là lý do hai bên so được với nhau: **lúc việc xảy ra là trục duy nhất cả hai cùng có.**

| Nhận về | Nghĩa |
|---|---|
| `200` + `windows: []` | 🔒 nguồn **không thuộc về bạn**, **hoặc** nguồn không tồn tại — **cố ý không phân biệt được**. Chúng tôi không xác nhận một nguồn của bên khác có thật hay không |
| `400` | `to` không sau `from`, hoặc khoảng **quá 30 ngày** một lượt |
| `401` | khoá · chữ ký · độ tươi — cùng một câu như cửa sự kiện |

⚠️ **Đọc đối soát KHÔNG tính là "dùng khoá".** Cửa này không đánh dấu khoá của bạn là đang hoạt động —
soi sổ không phải là bắn sự kiện.

#### Trạng thái cửa sổ

```
OPEN → RECONCILED[_WITH_GAPS] → CLOSED
              └── bạn bắn bù → đối soát lại → RESOLVED
```

| Trạng thái | Còn nhận vào cửa sổ? | Kết luận "thiếu" được chưa? | Bắn bù còn tính? |
|---|:--:|:--:|:--:|
| `OPEN` | ✅ | ✗ cửa sổ chưa hết | ✅ |
| `RECONCILED` | ✅ *(còn ân hạn)* | tạm | ✅ |
| `RECONCILED_WITH_GAPS` | ✅ *(còn ân hạn)* | thấy lệch, **chưa kết tội** | ✅ **đây là cả điểm của ân hạn** |
| `RESOLVED` | ✅ | ✗ hết lệch | ✅ |
| `CLOSED` | ✗ | ✅ **chốt** | vẫn nhận sự kiện, nhưng **không đổi kết luận** của cửa sổ đã đóng |

#### Nhịp vận hành

| | |
|---|---|
| Nhận sự kiện | **thời gian thực** |
| Nhịp đối soát · độ dài cửa sổ | **6 giờ** |
| Ân hạn đến trễ | **24 giờ** |
| Đóng cửa sổ | **24 giờ sau khi cửa sổ kết thúc** |
| Giữ bằng chứng đối soát | kết thúc chương trình + 30 ngày, sàn **30 ngày** |
| Chân trời phục hồi mong đợi ở phía bạn | **≥ 7 ngày** *(chỉ khi bạn khai có năng lực phục hồi)* |

⚠️ Đây là **mặc định vận hành của nền tảng, không phải "chuẩn ngành"** — đừng trích con số 6 giờ như một
chuẩn. Và **6 giờ là lịch chạy, không phải cam kết độ trễ phát hiện tối đa**: bạn có năng lực tốt hơn
thì phát hiện sớm hơn, và hợp đồng không đổi.

**Vì sao có ân hạn:** *lúc việc xảy ra* **≠** *lúc chúng tôi nhận được*. Không có ân hạn thì chúng tôi
kết luận *"mất rồi"* cho một gói tin chỉ đang **đến trễ**.

### 6.3 Chiều ngược — khi chúng tôi gọi sang bạn

Tới đây mọi thứ đều là **bạn gọi chúng tôi**. Mục này là chiều còn lại.

**Vì sao phải có.** §6.1 đã nói: sổ của chúng tôi không bao giờ chứng minh được *"anh chưa từng gửi cái
kia"*. §6.2 cho bạn một cửa để **tự** so — nhưng cửa đó chỉ chạy **khi bạn chủ động**. Nếu bạn không
hỏi, chúng tôi **không bao giờ tự biết mình đang thiếu**. ⇒ Chúng tôi cần một **đường hỏi ngược**.

#### Chúng tôi hỏi ba câu — bạn khai câu nào bạn trả lời được

| | Câu hỏi | Dùng để |
|:--:|---|---|
| **1** | *"Trong khoảng từ X đến Y, bên anh đã gửi những sự việc nào?"* | **phát hiện** chỗ thiếu |
| **2** | *"Gửi lại cho tôi sự việc mang mã Z."* | **lấp** chỗ thiếu |
| **3** | *"Cho tôi trạng thái của vật gốc — đơn hàng, giao dịch."* | phát hiện, **khi bên anh không có sổ sự kiện** |

**Câu 3 tồn tại vì bạn có quyền KHÔNG có khái niệm *"sự kiện"*.** Sổ của bạn có thể chỉ có đơn hàng. Nếu
hợp đồng bắt buộc phải trả lời câu 1 thì nó ngầm bắt bạn **dựng một kho sự kiện chỉ để tích hợp** —
chúng tôi không làm thế.

#### 🔒 Bạn KHÔNG phải dựng đúng API của chúng tôi

Đây là điểm quan trọng nhất của mục này, và nó có thể ngược với chờ đợi của bạn:

```
CHUẨN HOÁ    :  ba CÂU HỎI trên, và NGHĨA của câu trả lời
KHÔNG chuẩn  :  đường dẫn · hình dạng HTTP · tên trường · cách bạn lưu bên trong
```

Bạn đã có `GET /orders?from=…&to=…`? Dùng nó. Có `POST /transactions/search`? Dùng nó. Chỉ có **tệp đối
soát cuối ngày qua SFTP**? Cũng được. Phía chúng tôi có một **lớp chuyển đổi** cho từng bên đối ứng;
việc của bạn là **trả lời được ba câu**, không phải bắt chước hình dạng của chúng tôi.

Thứ chúng tôi **không** quy định và sẽ không bao giờ: kho dữ liệu bạn dùng · mô hình đơn hàng nội bộ ·
hàng đợi · thiết kế API nội bộ của bạn.

#### Ba câu trả lời phải PHÂN BIỆT ĐƯỢC với nhau

| Bạn trả | Chúng tôi hiểu |
|---|---|
| **không trả lời được** *(chưa hỗ trợ · lỗi · hết giờ)* | **không kết luận gì cả** |
| danh sách **RỖNG** | *"khoảng đó bên anh THẬT SỰ không gửi gì"* |
| danh sách có phần tử **+ con trỏ tiếp** | còn nữa, chúng tôi sẽ hỏi tiếp |

⚠️ **Đừng trả danh sách rỗng khi ý bạn là *"tôi không tra được"*.** Hai thứ đó ra hai kết luận ngược
nhau: một cái nói *"không thiếu gì"*, cái kia nói *"chưa biết"*. Trả nhầm là để chúng tôi **yên tâm
trong lúc đang mất sự kiện** — hỏng theo hướng nguy hiểm nhất.

⚠️ **Bạn từ chối chúng tôi thì trả `401` hoặc `403`. Đừng trả `200` với thân rỗng.** Chúng tôi phân biệt
*"bạn CHẶN chúng tôi"* với *"bạn KHÔNG TRẢ LỜI ĐƯỢC"* với *"bạn thật sự không có gì trong khoảng đó"* —
ba câu dẫn tới ba hành động khác nhau.

#### Phân trang bằng con trỏ, và con trỏ là của bạn

Khoảng nào dài thì trả từng trang kèm một **con trỏ tiếp**; chúng tôi gửi lại **nguyên văn** con trỏ đó
ở lượt sau, tới khi bạn báo hết. Chúng tôi **không diễn giải** nó — nó là chuỗi của bạn, muốn mã hoá gì
bên trong là việc của bạn.

#### Lấp chỗ thiếu bằng cửa sự kiện đã có, không phải cửa mới

Khi so ra chênh lệch, bạn **bắn lại** đúng những sự việc đó qua `POST /api/v1/integrations/events` —
cửa bạn vẫn đang dùng. **Không có cửa thứ hai để học.**

⭐ Bắn lại **an toàn khi giữ NGUYÊN `eventId`**: cái đã có trả `200 deduplicated`, cái thiếu vào sổ.
Bạn **không cần** biết chính xác cái nào thiếu — **bắn lại cả khoảng cũng đúng**.

⚠️ Phép bảo vệ này chỉ phủ **cùng một `eventId`**. Sinh mã mới cho một sự việc đã gửi thì chống trùng
**không thấy gì để so** và sự việc đó được tính lần thứ hai — xem §3.3.

### 6.4 🔒 Chúng tôi xác thực CHÍNH MÌNH với bạn — `PartnerRecoverySignatureV1`

Bạn sẽ không bao giờ phải mở một đường cho một bên gọi **không chứng minh được mình là ai**. Đây là
khuôn ký chúng tôi dùng khi gọi sang bạn, công bố **trước** mọi lượt gọi thật để bạn dựng phép kiểm
xong rồi mới mở cửa.

```
chuỗi ký  =  <X-Platform-Timestamp>  +  "."
          +  <METHOD viết HOA>       +  "."
          +  <đường dẫn + query, NGUYÊN VĂN như trên dòng yêu cầu>  +  "."
          +  <thân THÔ theo BYTE — chuỗi RỖNG nếu yêu cầu không có thân>

chữ ký    =  "sha256=" + hex_thường( HMAC-SHA256( bí_mật_kênh_PHỤC_HỒI, chuỗi ký ) )
```

| Tiêu đề | Chở gì |
|---|---|
| `X-Platform-Key-Id` | mã nhận dạng khoá chúng tôi đang ký bằng — **bạn dùng nó để tra bí mật**, và nó là thứ làm việc xoay khoá không cắt đường |
| `X-Platform-Timestamp` | giây, epoch |
| `X-Platform-Signature` | `sha256=<hex viết thường>` |

⚠️ **Khuôn này KHÁC `EventIngressSignatureV1`, và khác có chủ đích.** Chiều bạn gọi chúng tôi chỉ có
**một** cửa, luôn có thân — nên ký `timestamp + thân` là đủ. Chiều này thì cửa là **của bạn**, và rất
nhiều bên sẽ là `GET /orders?from=…&to=…` **không có thân**. Nếu chỉ ký `timestamp + thân rỗng` thì một
chữ ký hợp lệ dùng được cho **mọi** lượt `GET` trong cửa sổ 5 phút — ai chặn được một lượt gọi là trỏ nó
sang tài nguyên khác của bạn, và phép kiểm của bạn **vẫn báo hợp lệ**.

⇒ Chuỗi ký phủ **method + đường dẫn + query + thân**. Hàm băm thì **y hệt** — bạn dùng lại đúng đoạn mã
HMAC-SHA256 đã viết cho chiều kia, chỉ đổi chuỗi đem ký.

**Mã kiểm mẫu (Node.js):**

```js
const crypto = require('node:crypto');

function kiemChuKyNenTang(req, biMatTheoKeyId) {
  const keyId = req.header('X-Platform-Key-Id');
  const ts    = Number(req.header('X-Platform-Timestamp'));
  const nhan  = req.header('X-Platform-Signature') || '';

  // ① Độ tươi ±5 phút, chặn CẢ HAI phía
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts * 1000) > 5 * 60_000) return false;

  // ② Bí mật tra theo keyId — giữ ĐƯỢC HAI bí mật trong lúc xoay khoá (§7)
  const biMat = biMatTheoKeyId[keyId];
  if (!biMat) return false;

  // ③ req.originalUrl = đường dẫn + query NGUYÊN VĂN. req.rawBody = byte thô, chưa qua JSON parser
  const chuoiKy = Buffer.concat([
    Buffer.from(`${ts}.${req.method.toUpperCase()}.${req.originalUrl}.`, 'utf8'),
    req.rawBody ?? Buffer.alloc(0),
  ]);
  const mong = 'sha256=' + crypto.createHmac('sha256', biMat).update(chuoiKy).digest('hex');

  // ④ So sánh theo thời gian hằng số — KHÔNG dùng ===
  const a = Buffer.from(mong), b = Buffer.from(nhan);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

⚠️ **Lấy đường dẫn NGUYÊN VĂN, đừng chuẩn hoá lại.** Đúng dãy ký tự trên dòng yêu cầu — không sắp xếp
lại query, không mã hoá lại `%`. Chuẩn hoá lại là **chữ ký đúng vẫn trượt**, lác đác.

⚠️ **Ở chiều này có một nguồn sai NGOÀI mã của bạn — hãy kiểm nó TRƯỚC.** Nhiều reverse proxy · API
gateway · CDN **tự chuẩn hoá `%`-encoding, gộp `//`, hoặc sắp lại tham số query** trước khi yêu cầu tới
được đoạn mã kiểm chữ ký. Khi đó **code bạn hoàn toàn đúng mà chữ ký vẫn trượt**.

⇒ Nghi ngờ thì **log lại đúng dòng yêu cầu mà tầng kiểm chữ ký NHÌN THẤY** và so với dòng chúng tôi
gửi. Lệch ở đó là lệch ở tầng hạ tầng, không phải ở khoá — và đó là chỗ mất thời gian nhất nếu đi tìm
nhầm hướng.

**Độ tươi ±5 phút**, cùng con số §4.3, chặn cả hai phía.

🔒 **Bí mật này tách hẳn bí mật kênh sự kiện của bạn** — chúng tôi cấp riêng, đúng lý do §1.2: khác
người chạm, khác nhịp xoay. Dùng lại bí mật kênh sự kiện là để một chỗ rò làm hỏng **cả hai chiều** cùng
lúc.

**Xoay khoá không cắt đường** (§7): có lúc **hai** bí mật cùng hợp lệ. Bạn kiểm theo `X-Platform-Key-Id`
để biết chúng tôi đang ký bằng cái nào, và giữ cả hai tới khi chúng tôi báo thu cái cũ.

#### 🔒 Hai giới hạn của khuôn này — nói ra để bạn không dựa vào thứ nó không hứa

Chữ ký **không** phủ tên máy chủ đích, và **không** có `nonce`. Cả hai là lựa chọn **có điều kiện đi kèm**:

| Không có | Thay bằng gì | Điều kiện để nó đủ |
|---|---|---|
| ký **tên máy chủ** | **một tích hợp = một điểm cuối phục hồi = một bí mật** | Bạn có nhiều máy chủ (thử nghiệm ↔ chạy thật, nhiều vùng) thì **đừng dùng chung bí mật** giữa chúng. Mỗi máy chủ là một tích hợp riêng, khoá riêng. Dùng chung là để một yêu cầu ký cho máy này verify được ở máy kia |
| **`nonce`** | cửa sổ tươi **±5 phút** | Ba câu hỏi ở §6.3 đều **CHỈ ĐỌC** và lặp lại vô hại. Phát lại trong 5 phút chỉ là một lượt đọc lặp — không có tác dụng phụ nào để khai thác |

⚠️ **Ngày nào kênh phục hồi có thao tác GHI thì `nonce` phải vào TRƯỚC, không phải sau.** Cửa sổ thời
gian một mình không chặn được phát lại; nó chỉ giới hạn *bao lâu* phát lại được. Với một thao tác chỉ
đọc, khác biệt đó không quan trọng; với một thao tác đổi trạng thái thì nó là cả lỗ hổng.

⚙️ Điều kiện vận hành phía chúng tôi tự giữ: **lượt gọi chiều ra KHÔNG đi theo chuyển hướng (`3xx`)**.
Đi theo là để một cấu hình chuyển hướng đưa gói tin đã ký của chúng tôi tới một đích chúng tôi không
chọn — đúng cái mà việc không ký tên máy chủ để hở.

### 6.5 Hạng tích hợp của bạn

| Hạng | Bạn có | Mất gì khi sự cố |
|---|---|---|
| `FULL_RECOVERY` | nhận + biên nhận + **một** đường kéo lại | — |
| `INGEST_PLUS_DETECTION` | nhận + biên nhận + đối soát, **chưa** kéo lại | **phát hiện được, không tự sửa được** |
| `INGEST_PLUS_REPLAY` | nhận + bạn bắn lại được, **chưa** đối soát | lấp được nhưng **không tự biết** lấp cái nào |
| `INGEST_ONLY` | chỉ nhận | mất là **mất câm** |

**Hạng nằm TRONG phản hồi đối soát**, không phải một dòng trong tài liệu này. Mỗi lượt gọi
`POST /api/v1/integrations/reconciliation` trả kèm:

```jsonc
"capability": {
  "tier":       "INGEST_ONLY",
  "meaning":    "mất là mất câm — câu \"lỗi của ai\" hệ thống không trả lời được",
  "closesLoop": false          // khép được vòng đối soát chưa — cần CẢ phát hiện LẪN lấp lại
}
```

#### ⚠️ KHAI KHÔNG ĐỦ ĐỂ LÊN HẠNG — phải CHỨNG MINH

Hạng của bạn là **GIAO** của hai thứ:

```
  chúng tôi gọi sang bạn LÀM ĐƯỢC gì   (suy tại chỗ, mỗi lượt gọi, không phải một cột ai đó set từ lâu)
∩ bài kiểm HỢP CHUẨN của bạn ĐÃ PASS gì   (§8)
────────────────────────────────────────
  hạng công bố cho bạn
```

**Khai là bạn nói bạn làm được; hạng chỉ lên khi bạn chạy bài kiểm và nó PASS.** Khai mà không chạy thì
hạng đứng yên, và bạn sẽ chờ một thứ không tới.

🔒 Vì sao là GIAO chứ không phải một trong hai — mỗi vế một mình để hở đúng một lỗ:

| Chỉ đọc kết quả bài kiểm | Chỉ suy tại chỗ |
|---|---|
| bạn đổi hệ thống sau khi kiểm ⇒ kết quả cũ **nói dối** | cắm xong là lên hạng **không qua bài kiểm nào** |

⇒ Gỡ đường kéo lại của bạn ⇒ **tụt hạng ngay**, không ai phải cập nhật gì. Chưa PASS ⇒ **không lên
hạng** dù bạn đã dựng đủ.

⚠️ **Mặc định hôm nay của mọi bên là `INGEST_ONLY`** — đây là **fail-closed có chủ đích**, không phải
đánh giá thấp bạn. Khai dương một năng lực chưa ai kiểm thì bạn sẽ **tin là mình đang được bảo vệ** —
đúng thứ §1.3 nói chúng tôi thà tránh.

⭐ **Cả bốn hạng đều tích hợp được.** Chúng tôi **không** từ chối ai vì thiếu năng lực phục hồi — làm vậy
là biến nền tảng thành *"chỉ nhận bên nào có hệ thống đủ mạnh"*. Nhưng chúng tôi **bắt buộc phải biết và
công bố** hạng của bạn: ở `INGEST_ONLY`, câu *"lỗi của ai"* là câu hệ thống **không trả lời được** — và
đó là sự thật **được khai ra**, không phải một lỗ giấu đi.

**Bốn khuôn kéo lại — bạn có BẤT KỲ cái nào là đủ, không cần dựng mới:**

| Bạn đã có | Khuôn |
|---|---|
| đường liệt kê sự kiện theo khoảng thời gian | truy vấn theo cửa sổ |
| đường gửi lại một lượt giao | phát lại theo định danh |
| đường đọc trạng thái vật nghiệp vụ | truy vấn vật thật |
| tệp đối soát cuối kỳ | tệp lô |
| **chưa có gì** | hạng `INGEST_ONLY` — vẫn tích hợp được |

---

## 7. Xoay khoá

Nhiều bí mật **cùng sống** trong lúc xoay. Bạn đổi sang bí mật mới lúc nào cũng được, **không rớt gói
tin nào**, không phải hẹn giờ cắt dịch vụ.

| Việc | Bạn thấy |
|---|---|
| chúng tôi cấp bí mật mới | cả bí mật cũ lẫn mới đều ký được |
| bạn chuyển sang bí mật mới | không có gì thay đổi ở phía bạn |
| chúng tôi thu hồi bí mật cũ | hiệu lực **NGAY**, không đợi hết hạn |

⚠️ **Thu hồi có hiệu lực ngay lập tức.** Còn máy chủ nào của bạn đang giữ bí mật cũ thì nó bắt đầu nhận
`401` từ giây đó. ⇒ Chuyển **hết** các máy chủ sang bí mật mới **trước khi** báo chúng tôi thu cái cũ.

⭐ Ở chiều ngược (§6.4), bạn giữ **hai** bí mật cùng lúc và tra theo `X-Platform-Key-Id` — cùng cơ chế,
đảo vai.

---

## 8. Bài kiểm hợp chuẩn — bạn tự chạy

Chúng tôi gửi kèm tài liệu này một **bộ kiểm chạy được**. Bạn chạy nó **trên hệ thống của mình**, xem đã
thoả hợp đồng chưa, rồi mới onboard. **Không cần đợi ai kiểm hộ.**

### 8.1 Chạy

```bash
CONF_API=https://<cửa của chúng tôi>/api/v1 \
CONF_ACCESS_KEY=<mã nhận dạng của bạn> \
CONF_EVENT_SECRET=<bí mật kênh sự kiện> \
CONF_EVENT_TYPE=ORDER_COMPLETED \
CONF_RECOVERY_URL=https://<hệ thống của bạn>/api/recovery \
CONF_RECOVERY_SECRET=<bí mật kênh phục hồi> \
  npx tsx run.ts
```

Mã thoát: **`0`** = đạt hết · **`1`** = có ca trượt · **`2`** = không chạy được *(thiếu cấu hình)*.

| Biến | Bắt buộc | Ghi chú |
|---|:--:|---|
| `CONF_API` · `CONF_ACCESS_KEY` · `CONF_EVENT_SECRET` · `CONF_EVENT_TYPE` | ✅ | thiếu ⇒ thoát `2` |
| `CONF_RECOVERY_URL` | ⬜ | để trống ⇒ bảy ca chiều RA khai **BỎ** — **không phải "đạt"** |
| `CONF_RECOVERY_SECRET` | ⬜ | để trống ⇒ chạy không ký, dành cho lúc bạn đang dựng dở |

⚠️ **Đã dựng phép kiểm chữ ký mà quên đặt `CONF_RECOVERY_SECRET` thì bảy ca chiều RA trượt với `401`** —
và đó là bộ kiểm **nói đúng**: bạn vừa từ chối một lượt gọi không ký. Đặt bí mật vào rồi chạy lại.

⚠️ **Phân biệt BỎ với ĐẠT.** Bỏ thì **không lên hạng** — chứ không phải lên hạng vì không ai hỏi.

### 8.2 ⚠️ Trỏ vào SANDBOX, đừng trỏ hệ thống thật

Bảy ca chiều VÀO **bắn gói tin THẬT** vào cửa sự kiện — mỗi lượt chạy để lại **7–8 sự kiện** ở nơi
`CONF_API` trỏ tới. Không đồng tiền hay điểm thưởng nào bị động (người dùng giả không khớp hồ sơ nào),
nhưng đó vẫn là dữ liệu thật.

⭐ Mọi thứ bộ kiểm tạo ra đều mang tiền tố **`conf-`** (`eventId`, `externalUserId`) nên **lọc và dọn
được**. Chạy lại bao nhiêu lần cũng an toàn về đúng/sai — chỉ là tích rác.

### 8.3 Mười bốn ca — hai chiều đo hai thứ khác hẳn nhau

| | Kiểm ai | Không đạt thì sao |
|---|---|---|
| **CHIỀU VÀO** *(7 ca)* | cửa của **chúng tôi**, bằng khoá của **bạn** — tức bạn đã ký đúng, gửi đúng khuôn, đăng ký đúng chưa | ⚠️ **ĐIỀU KIỆN VÀO CỬA** — không đạt thì tích hợp **không được bật** |
| **CHIỀU RA** *(7 ca)* | **hệ thống của bạn** — bạn trả lời được ba câu hỏi phục hồi chưa | vẫn onboard bình thường, chỉ ở **hạng thấp hơn** (§6.5) |

**Chiều VÀO**

| Mã | Ca | Mong đợi |
|---|---|---|
| `IN-1` | gói tin hợp lệ | `200` |
| `IN-2` | thiếu `eventId` | `400` — sai **khuôn** |
| `IN-3` | mốc thời gian sai kiểu | `400` |
| `IN-4` | `payload` thiếu trường bắt buộc | **`422`** — đúng khuôn, sai **nghĩa** |
| `IN-5` | gửi lại đúng gói tin cũ | `200` + `deduplicated: true`, **không** `409` |
| `IN-6` | chữ ký sai | `401` |
| `IN-7` | mốc thời gian quá cũ *(phát lại)* | `401` |

⚠️ **`IN-4` là ca đáng chú ý nhất.** `400` và `422` là **hai việc khác nhau** cho bạn: `400` nghĩa
*"gói tin sai khuôn, sửa rồi gửi lại"*; `422` nghĩa *"gói tin đúng khuôn, sai về nghiệp vụ — đọc `code`
để biết bên nào phải hành động"* (§4.4). Nhận nhầm `400` thì bạn đi sửa khuôn — thứ vốn đã đúng — và
**không bao giờ tìm ra**.

**Chiều RA**

| Mã | Ca | Chứng minh năng lực |
|---|---|---|
| `OUT-1` | hỏi theo cửa sổ thời gian ⇒ trả danh sách sự kiện | `QUERY_WINDOW` |
| `OUT-2` | phân trang — con trỏ tiếp có mặt, `null` khi hết | `QUERY_WINDOW` |
| `OUT-3` | hỏi một mã **không có thật** ⇒ trả rỗng, **không lỗi** | `REDELIVER_BY_ID` |
| `OUT-4` | gửi lại theo định danh ⇒ trả **đúng** sự việc đó | `REDELIVER_BY_ID` |
| `OUT-5` | hỏi hai lần cùng khoảng ⇒ **cùng** kết quả | `QUERY_WINDOW` |
| `OUT-6` | con trỏ bịa ⇒ **báo lỗi**, không âm thầm trả trang đầu | `QUERY_WINDOW` |
| `OUT-7` | hỏi **trạng thái vật gốc** ⇒ trả trạng thái (hoặc `404`) | `QUERY_RESOURCE` |

⚠️ **`OUT-6` bắt lỗi im lặng nhất của phân trang.** Con trỏ sai mà bạn âm thầm trả trang đầu thì vòng
kéo lại của chúng tôi chạy **mãi trên cùng một trang** và không bao giờ kết thúc — mà mọi trang đều
trông hợp lệ, nên **không bên nào thấy**.

⚠️ **`OUT-5` — hai lượt hỏi cùng khoảng phải ra cùng tập.** Đối soát chạy lặp theo lịch; cùng câu hỏi ra
hai câu trả lời khác nhau thì mọi kết luận *"thiếu cái nào"* là kết luận về một sổ đang trôi.

### 8.4 Ba năng lực suy ra hạng thế nào

**Ba năng lực là ba VAI khác nhau — đừng đọc `QUERY_WINDOW` thành "gửi lại".**

| Năng lực | Vai | Là gì |
|---|---|---|
| `QUERY_WINDOW` | **PHÁT HIỆN** | bạn cho chúng tôi **đọc sổ nguồn** của bạn theo khoảng thời gian |
| `QUERY_RESOURCE` | **PHÁT HIỆN** | bạn cho chúng tôi đọc **trạng thái vật gốc** |
| `REDELIVER_BY_ID` | **GỬI LẠI** | bạn gửi lại **đúng một sự việc** theo mã |

⭐ **`QUERY_WINDOW` KHÔNG phải là "gửi lại"** — nó là *đọc nguồn sự thật*. Nhưng vì nó trả về **đủ
phong bì gói tin**, chúng tôi lấy luôn dữ liệu đó đưa lại vào cửa nhận. Nói cách khác: **phần "gửi
lại" do CHÚNG TÔI làm, bằng dữ liệu bạn cho đọc** — bạn không phải dựng thêm đường nào.

⇒ Hai vế của phép suy hạng dưới đây nhận được gì từ mỗi năng lực:

```
                 PHÁT HIỆN   LẤP LẠI ĐƯỢC
QUERY_WINDOW         ✅          ✅   ← trả đủ nội dung, nền tảng tự lấp
QUERY_RESOURCE       ✅          ✗
REDELIVER_BY_ID      ✗           ✅   ← phải biết thiếu MÃ NÀO mới dùng được
```

⚠️ **Cột thứ hai là *"lấp lại được"*, không phải *"bạn có API gửi lại"*.** `QUERY_WINDOW` một mình đã
đủ cho **cả hai** cột ⇒ một mình nó đã cho `FULL_RECOVERY`. Đừng đọc bảng này thành *"phải có
`REDELIVER_BY_ID` mới lên hạng cao nhất"*.

| | sửa được | KHÔNG sửa được |
|---|---|---|
| **phát hiện được** | `FULL_RECOVERY` | `INGEST_PLUS_DETECTION` |
| **KHÔNG phát hiện được** | `INGEST_PLUS_REPLAY` | `INGEST_ONLY` |

🔒 **Một năng lực được công nhận chỉ khi MỌI ca cấp nó đều đạt.** Một ca trượt là năng lực đó rớt —
không có ô *"gần đạt"*.

### 8.5 Kết quả bạn tự chạy KHÔNG tự vào sổ của chúng tôi

Bộ kiểm **in ra**, nó **không ghi**. Nó là hộp đen thuần HTTP, không cầm khoá nội bộ nào của chúng tôi.

Hạng công bố chỉ đổi khi **chúng tôi** chạy lượt kiểm của mình, trỏ vào hệ thống bạn, rồi ghi qua một
cửa nội bộ có quyền và có dấu vết.

⚠️ Đây **không phải** sự thiếu tin tưởng — đó là điều làm cái hạng **có nghĩa**. Một cổng nghiệm thu tin
bằng chứng do chính bên được xét nộp thì không còn là cổng, và hạng lại thành lời khai.

⇒ Bạn dùng bộ này để **tự soi và sửa cho xong trước**; lượt của chúng tôi chỉ còn là xác nhận.

⭐ Bộ kiểm gọi theo hình **mặc định**. Hệ thống bạn khác hình thì **báo chúng tôi** để cắm lớp chuyển
đổi tương ứng, và bộ kiểm chạy qua lớp đó — bạn **không** phải đổi API của mình.

---

## 9. Danh sách kiểm trước khi lên thật

Tick hết 18 mục này là bạn sẵn sàng. Mục có dấu 🔒 là bắt buộc về an toàn.

**Ký và xác thực**

- [ ] Hàm ký ra **đúng** chữ ký của [Phụ lục B](#phụ-lục-b--vector-kiểm-thử) — có ca kiểm thử đơn vị khoá lại
- [ ] Serialize **đúng một lần**: chuỗi đem ký **chính là** chuỗi đem gửi (§2.4)
- [ ] 🔒 Bí mật ký nằm ở **máy chủ**, không ở ứng dụng di động / trình duyệt / kho mã nguồn
- [ ] 🔒 Bí mật kênh sự kiện **khác** bí mật kênh đăng nhập — không dùng chung hàm ký (§4.2)
- [ ] Đồng hồ máy chủ đồng bộ NTP; lệch < 1 phút (§4.3)

**Gói tin**

- [ ] `eventId` sinh theo **sự việc**, không theo lần gọi HTTP — bước 2 §2.5 đã ra `deduplicated: true`
- [ ] `orderId` là **chuỗi**, không phải số (§3.6)
- [ ] `occurredAt` là **lúc việc xảy ra**, không phải lúc gửi (§3.2)
- [ ] `amountMinor` là **số nguyên đơn vị nhỏ nhất**, kèm `currency` (§3.5)
- [ ] Một đơn qua nhiều trạng thái ⇒ **nhiều `eventId`**, cùng một `orderId` (§3.3)

**Vận hành**

- [ ] Có nhánh xử lý `429`: đọc `Retry-After`, **đợi rồi gửi lại y nguyên** (§4.6)
- [ ] `RateLimit-Reset` được hiểu là **số giây**, không phải mốc epoch (§4.6)
- [ ] Có nhánh lùi dần theo hàm mũ cho `5xx` và hết giờ mạng (§4.7)
- [ ] `422` **không** bị gửi lại mù — có hàng chết hoặc cảnh báo cho người trực (§4.4)
- [ ] Ghi lại `deliveryId` mỗi lượt, kể cả lượt `422` (§5)
- [ ] Có cảnh báo khi tỉ lệ `401` tăng đột ngột — đó là dấu hiệu khoá bị thu hoặc đồng hồ trôi

**Nghiệm thu**

- [ ] Bài kiểm hợp chuẩn **chiều VÀO 7/7 đạt** (§8) — đây là điều kiện vào cửa
- [ ] Đã chạy ba lượt bắn kiểm chứng §2.5 trên **môi trường thử nghiệm** trước

---

## Phụ lục A — bảng mã lỗi đầy đủ

### Theo mã HTTP

| HTTP | Khi nào | `deliveryId`? | Gửi lại? |
|:--:|---|:--:|:--:|
| `200` | đã nhận và lưu bền — **kể cả trùng** | ✅ | **không** |
| `400` | thân sai khuôn · JSON hỏng · `specversion` sai · thiếu trường phong bì | ✗ | sau khi sửa gói tin |
| `401` | khoá sai · chữ ký sai · quá hạn *(một câu cho cả ba)* | ✗ | sau khi sửa cấu hình |
| `404` | tuyến không tồn tại | ✗ | sau khi sửa cấu hình |
| `422` | đúng khuôn, **sai nghĩa** | ✅ *(trong `details`)* | **không gửi lại mù** |
| `429` | vượt trần tần suất của khoá bạn | ✅ | ✅ sau `Retry-After` giây |
| `5xx` | bên chúng tôi hỏng | tuỳ | ✅ lùi dần |

`409` **không được dùng** cho sự kiện trùng — trùng là `200`.

### Mã nghiệp vụ trong trường `code` của thân `422`

⚠️ **`422` không nói bên nào phải sửa — `code` nói.** Bốn trên năm mã dưới là việc của **bạn**; chỉ
`event_type_not_registered` là việc của chúng tôi.

| `code` | Nghĩa | Bạn làm gì |
|---|---|---|
| `payload_field_missing` | thiếu trường bắt buộc của loại đó, hoặc trường đó không phải chuỗi không rỗng | **sửa `payload`** — câu lỗi nêu đích danh trường |
| `unknown_event_type` | `type` ngoài danh mục đóng §3.4 | **đổi `type`** — câu lỗi liệt kê các loại hợp lệ |
| `derived_event_not_accepted` | gửi một loại chúng tôi **tự suy ra** (`STREAK_REACHED`) | **thôi gửi loại đó** |
| `event_type_not_registered` | loại đúng nhưng **chưa khai cho khoá của bạn** | **báo chúng tôi** — gói tin bạn đúng, cấu hình phía chúng tôi thiếu |
| `event_id_conflict` | `eventId` đã dùng cho một **loại khác** | **cấp `eventId` mới cho lượt này** (§3.3) |

⭐ **Rẽ nhánh theo `code`, đừng rẽ theo `detail`.** `code` được đóng băng; `detail` là câu người đọc và
có thể đổi câu chữ.

---

## Phụ lục B — vector kiểm thử

Dùng các con số cố định này làm **ca kiểm thử đơn vị** cho hàm ký của bạn. Không cần mạng, không cần
khoá thật. Hàm của bạn ra khác một ký tự là sai.

### B.1 `EventIngressSignatureV1` — chiều bạn gọi chúng tôi

```
bí mật     :  whsec_demo_0123456789abcdef
timestamp  :  1786698753
thân       :  {"specversion":"1.0","eventId":"evt-88421","externalUserId":"12345","type":"ORDER_COMPLETED","occurredAt":"2026-08-14T09:12:33Z","confidence":"SERVER_OBSERVED","payload":{"orderId":"SO-99881","amountMinor":250000000,"currency":"VND"}}
             (234 byte, KHÔNG có xuống dòng cuối)

chuỗi ký   :  1786698753.{"specversion":"1.0",…}

KẾT QUẢ    :  sha256=ae00dc858385fdb65061fda5da1809772f8f602f5d653052e7672516c4d59176
```

### B.2 `PartnerRecoverySignatureV1` — chiều chúng tôi gọi bạn

```
bí mật     :  rcv_demo_fedcba9876543210
timestamp  :  1786698753
method     :  GET
đường dẫn  :  /api/recovery/orders?from=2026-08-10T00%3A00%3A00Z&to=2026-08-11T00%3A00%3A00Z
thân       :  (rỗng)

chuỗi ký   :  1786698753.GET./api/recovery/orders?from=2026-08-10T00%3A00%3A00Z&to=2026-08-11T00%3A00%3A00Z.

KẾT QUẢ    :  sha256=9b136e1a47b2b5232b085a081a3c3ee9bbcfc541a7a74b2abde919ee93d71b84
```

⚠️ **Chú ý dấu `.` cuối cùng** trong chuỗi ký ở B.2. Thân rỗng nghĩa là **chuỗi rỗng nối vào sau dấu
chấm thứ ba**, **không phải** bỏ đoạn đó đi. Đây là chỗ hay sai nhất khi dựng phép kiểm cho các lượt
`GET`.

⚠️ **Chú ý `%3A` trong đường dẫn ở B.2.** Chuỗi ký lấy đường dẫn **nguyên văn như trên dòng yêu cầu** —
giải mã `%3A` thành `:` trước khi ký là ra chữ ký khác. Xem cảnh báo về reverse proxy ở §6.4.

### B.3 Mã tổng đối soát

```
tập eventId :  ["evt-1", "evt-2", "evt-3"]
thuật toán  :  loại trùng → sắp xếp tăng dần → nối bằng "\n" → sha256 → hex thường → tiền tố "v1:"
chuỗi băm   :  evt-1\nevt-2\nevt-3

KẾT QUẢ     :  v1:8d3f182a04c6d2bcb51a2e6f0201039af53aa777c6aa18236b3c6eae53083b44
```

### B.4 Tự kiểm nhanh bằng shell

```bash
# B.1
printf '%s.%s' 1786698753 '{"specversion":"1.0","eventId":"evt-88421","externalUserId":"12345","type":"ORDER_COMPLETED","occurredAt":"2026-08-14T09:12:33Z","confidence":"SERVER_OBSERVED","payload":{"orderId":"SO-99881","amountMinor":250000000,"currency":"VND"}}' \
  | openssl dgst -sha256 -hmac 'whsec_demo_0123456789abcdef' -r | cut -d' ' -f1

# B.3
printf 'evt-1\nevt-2\nevt-3' | openssl dgst -sha256 -r | cut -d' ' -f1
```

---

## Phụ lục C — thuật ngữ

| Từ | Nghĩa trong tài liệu này |
|---|---|
| **sự việc** | một việc đã xảy ra trong hệ thống của bạn — đơn hoàn tất, đơn huỷ. Một sự việc = một `eventId` |
| **lượt giao** | một lần gọi HTTP mang một gói tin sang chúng tôi. Một sự việc có thể có nhiều lượt giao |
| **gói tin / phong bì** | JSON bạn gửi. "Phong bì" là phần vỏ (`eventId`, `type`, `occurredAt`…), phân biệt với `payload` bên trong |
| **chống trùng** | cơ chế bảo đảm cùng một `eventId` chỉ được tính **một** lần, dù bạn gửi bao nhiêu lượt |
| **độ tươi** | phép kiểm mốc thời gian nằm trong ±5 phút so với đồng hồ chúng tôi — chống phát lại |
| **cửa sổ đối soát** | một khoảng 6 giờ, neo theo `occurredAt`, để hai bên so sổ với nhau |
| **ân hạn** | 24 giờ sau khi cửa sổ kết thúc, còn nhận gói tin đến trễ trước khi chốt kết luận |
| **mã tổng (digest)** | một chuỗi băm đại diện cho cả tập `eventId` của một cửa sổ — so nhanh xem hai bên có cùng tập không |
| **hạng tích hợp** | mức năng lực phục hồi của bạn, quyết định khi sự cố thì ai chứng minh được gì (§6.5) |
| **chiều VÀO / chiều RA** | vào = bạn gọi chúng tôi · ra = chúng tôi gọi sang bạn |

---

## Phụ lục D — câu hỏi thường gặp

**Chúng tôi gửi lại một sự kiện nhiều lần thì có bị cộng điểm nhiều lần không?**
Không, miễn là `eventId` giữ nguyên. Đó chính là điều bước 2 §2.5 chứng minh. Nếu bạn chưa chạy bước đó
thì hãy chạy trước khi bật gửi lại.

**Nhận `200` là người dùng đã có điểm chưa?**
Chưa chắc. `200` hứa **đã nhận và lưu bền**. Sự kiện xảy ra ngoài kỳ hiệu lực, hoặc `confidence` thấp
hơn mức phần thưởng đòi, vẫn `200` mà không sinh điểm — đúng thiết kế (§4.4).

**`401` mà chúng tôi chắc chắn khoá đúng thì sao?**
Theo đúng thứ tự ở §4.4: ① đồng hồ lệch quá 5 phút ② serialize lại trước khi ký ③ ký nhầm bí mật kênh
khác ④ bí mật vừa bị thu hồi. Đồng hồ là nguyên nhân phổ biến nhất.

**Chúng tôi có phải dựng API mới cho chiều phục hồi không?**
Không. Chúng tôi chuẩn hoá **ba câu hỏi** và **nghĩa của câu trả lời**, không chuẩn hoá hình dạng HTTP.
Có sẵn `GET /orders?from=…&to=…` thì dùng nó; chỉ có tệp đối soát cuối ngày cũng được (§6.3).

**Không dựng đường phục hồi thì có bị từ chối tích hợp không?**
Không. Cả bốn hạng đều tích hợp được. Bạn ở `INGEST_ONLY`, và chúng tôi **công bố** hạng đó cho bạn biết
(§6.5).

**Chúng tôi khai đã dựng đủ đường phục hồi rồi, sao hạng chưa lên?**
Khai không đủ. Hạng là **giao** của *(chúng tôi gọi sang bạn làm được gì)* và *(bài kiểm hợp chuẩn đã
PASS gì)*. Chạy bài kiểm, đạt các ca chiều RA, rồi chúng tôi chạy lượt kiểm của mình và ghi nhận (§6.5,
§8.5).

**`eventId` phải theo định dạng nào?**
Không có định dạng bắt buộc. Một `uuid` là đủ. Nó chỉ cần **duy nhất trong hệ của bạn** và **không đổi**
giữa các lượt gửi lại của cùng một sự việc.

**Chúng tôi có nhiều môi trường (thử nghiệm, chạy thật). Dùng chung khoá được không?**
Không nên, và với **kênh phục hồi** thì **không được** — mỗi máy chủ là một tích hợp riêng, khoá riêng.
Dùng chung là để một yêu cầu ký cho máy này verify được ở máy kia (§6.4).

**Đối soát trả `windows: []` nghĩa là chúng tôi chưa gửi gì?**
Không suy ra được. `200` + `windows: []` nghĩa là nguồn **không thuộc về bạn** *hoặc* nguồn không tồn
tại — chúng tôi cố ý không phân biệt hai trường hợp. Kiểm lại giá trị `eventSource` bạn gửi (§6.2).

**Có giới hạn kích thước gói tin không?**
Trường thừa được lưu nguyên văn và không ảnh hưởng gì, nhưng đừng nhét cả bản ghi nghiệp vụ vào
`payload`. Cần đưa một khối lớn thì báo chúng tôi trước.

---

## Liên hệ và thay đổi

Chỗ nào trong tài liệu này bạn **phải đoán** là **lỗi của tài liệu** — báo lại, chúng tôi sửa và phát
hành bản mới.

Mọi thay đổi phá vỡ tương thích sẽ được **báo trước**. Những gì đã đóng băng và sẽ không đổi âm thầm:
bảng mã trả lời (§4.4) · nghĩa của `200` · quy tắc chống trùng theo `eventId` · hai khuôn ký có tên.

| | |
|---|---|
| **Bản** | 1.0 |
| **Ngày** | 23/08/2026 |
| **Kèm theo** | bộ kiểm hợp chuẩn — `run.ts` · `cases.ts` · `contract.ts` · `README.md` |
