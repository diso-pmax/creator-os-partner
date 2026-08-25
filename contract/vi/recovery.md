# Recovery — Đối soát, Backfill, và Replay

**Bản 1.0 · 2026-08-25** · Bắt đầu từ: [README.md](./README.md). *(bản dịch của
[en/recovery.md](../en/recovery.md) — bản tiếng Anh là nguồn chốt, lệch thì bản tiếng Anh thắng)*

**Recovery là TUỲ CHỌN.** Bạn vẫn tích hợp đầy đủ mà không cần nó, ở hạng `INGEST_ONLY` (§5). Tài liệu
này dành cho đối tác muốn phát hiện và tự lấp chỗ thiếu trong việc giao sự kiện.

## 1. Năng lực này làm gì

Lấp một chỗ thiếu cần hai việc, và chỉ phía bạn có cả hai: **phát hiện** ("đáng lẽ tôi phải nhận cái
nào?") cần sổ của chính bạn; **sửa** (gửi lại đúng nội dung) cần dữ liệu của chính bạn. Chúng tôi có
thể nói cho bạn biết chúng tôi **đang có** cái gì; chúng tôi không thể nói bạn **chưa từng gửi** cái
gì — phép so sánh đó chỉ chạy được khi có sổ của bạn làm nửa còn lại. Đây là lý do đối soát so theo
**tập định danh** (`eventIds`), không chỉ theo số đếm: một con số chỉ cho biết "có lệch", không cho
biết lệch cái nào.

## 2. Cửa đối soát — `POST /api/v1/integrations/reconciliation`

Ký **y hệt** cửa sự kiện (`EventIngressSignatureV1`, xem
[event-ingestion.md](./event-ingestion.md#3-xác-thực)) — không có gì mới phải học.

```jsonc
// request
{ "eventSource": "<nguồn của bạn>", "from": "2026-08-10T00:00:00Z", "to": "2026-08-11T00:00:00Z" }

// response
{
  "eventSource": "…",
  "digestAlgorithm": "v1: sha256(hex) trên eventIds sắp xếp tăng dần, nối bằng \"\\n\"",
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

⭐ **`eventIds` là thứ bạn thật sự cần.** So `eventCount` chỉ cho biết "có gì đó khác"; so **tập
`eventIds`** với sổ của bạn cho biết **lệch cái nào** — rồi bạn gửi lại đúng những cái đó qua
[cửa sự kiện bạn đã đang dùng](./event-ingestion.md). Gửi thừa vô hại: chống trùng theo `eventId` bảo
đảm không cộng hai lần.

### 2.1 Tự tính lại mã tổng — nên làm ít nhất một lần lúc tích hợp

```text
loại trùng → sắp xếp tăng dần → nối bằng "\n" → sha256 → hex viết thường → tiền tố "v1:"
```

Ví dụ tính được: tập `["evt-1","evt-2","evt-3"]` cho ra

```text
v1:8d3f182a04c6d2bcb51a2e6f0201039af53aa777c6aa18236b3c6eae53083b44
```

⚠️ **Sắp xếp là bắt buộc.** Hai bên **không bao giờ** tự nhiên đồng ý về thứ tự: bạn sắp theo sổ của
bạn, chúng tôi sắp theo lúc tới. Không sắp xếp thì cùng một tập ra hai mã tổng khác nhau và **mọi** cửa
sổ đều báo lệch.

⚠️ **Trần 10.000 định danh mỗi cửa sổ.** Tràn thì thêm `"eventIdsTruncated": true` — nhưng
`eventCount` và `digest` vẫn phủ **toàn bộ** cửa sổ. Bạn vẫn biết chắc có lệch hay không; chỉ danh sách
"lệch cái nào" là chưa đủ. **Đừng đọc một danh sách bị cắt thành "bên kia đang thiếu."**

⚠️ **Cửa sổ neo theo `occurredAt`** (lúc việc xảy ra), không theo lúc chúng tôi nhận. Một sự kiện xảy
ra lúc 07:00 nhưng tới lúc 15:00 vẫn thuộc cửa sổ **06:00–12:00**. Đây là lý do có ân hạn, và là lý do
hai bên so sánh được với nhau: **lúc việc xảy ra là trục duy nhất cả hai bên cùng có.**

| Response | Nghĩa |
|---|---|
| `200` + `windows: []` | 🔒 nguồn **không thuộc về bạn**, **hoặc** không tồn tại — **cố ý không phân biệt được**. Chúng tôi không xác nhận nguồn của đối tác khác có thật hay không |
| `400` | `to` không sau `from`, hoặc khoảng vượt quá **30 ngày** một lượt |
| `401` | khoá, chữ ký, hoặc độ tươi — cùng thông báo như cửa sự kiện |

⚠️ **Đọc dữ liệu đối soát KHÔNG tính là "dùng khoá."** Cửa này không đánh dấu khoá của bạn là đang hoạt
động — đọc sổ không phải gửi sự kiện.

### 2.2 Vòng đời cửa sổ

```text
OPEN → RECONCILED[_WITH_GAPS] → CLOSED
              └── bạn backfill → đối soát lại → RESOLVED
```

| Trạng thái | Còn nhận sự kiện? | Kết luận "thiếu" được chưa? | Backfill còn tính? |
|---|:--:|:--:|:--:|
| `OPEN` | ✅ | ✗ cửa sổ chưa hết | ✅ |
| `RECONCILED` | ✅ *(còn ân hạn)* | tạm thời | ✅ |
| `RECONCILED_WITH_GAPS` | ✅ *(còn ân hạn)* | thấy lệch, **chưa kết luận cuối** | ✅ **đây chính là mục đích của ân hạn** |
| `RESOLVED` | ✅ | ✗ hết lệch | ✅ |
| `CLOSED` | ✗ | ✅ **cuối cùng** | vẫn nhận sự kiện, nhưng **không đổi** kết luận của cửa sổ đã đóng |

### 2.3 Nhịp vận hành

| | |
|---|---|
| Nhận sự kiện | **thời gian thực** |
| Nhịp đối soát / độ dài cửa sổ | **6 giờ** |
| Ân hạn cho gói tin tới trễ | **24 giờ** |
| Đóng cửa sổ | **24 giờ sau khi cửa sổ kết thúc** |
| Giữ bằng chứng đối soát | kết thúc chương trình + 30 ngày, sàn **30 ngày** |
| Chân trời phục hồi mong đợi phía bạn | **≥ 7 ngày** *(chỉ khi bạn khai có năng lực phục hồi)* |

⚠️ Đây là **mặc định vận hành của nền tảng này, không phải chuẩn ngành** — đừng trích con số 6 giờ như
một chuẩn. Và **6 giờ là lịch chạy, không phải cam kết độ trễ phát hiện tối đa**: năng lực tốt hơn phía
bạn phát hiện gap sớm hơn, bản thân hợp đồng không đổi.

**Vì sao có ân hạn:** *lúc xảy ra* **≠** *lúc chúng tôi nhận được*. Không có ân hạn thì chúng tôi sẽ
kết luận "mất" cho một sự kiện chỉ đang **đến trễ**.

## 3. Chiều ngược — khi chúng tôi gọi sang bạn

Mọi thứ ở trên là **bạn gọi chúng tôi**. Mục này là chiều còn lại.

**Vì sao nó tồn tại.** §1 đã xác lập: sổ của chúng tôi không bao giờ chứng minh được "bạn chưa từng gửi
cái kia." §2 cho bạn một cửa để **tự** so sánh — nhưng cửa đó chỉ chạy **khi bạn chủ động**. Nếu bạn
không bao giờ hỏi, chúng tôi **không bao giờ tự biết** mình đang thiếu gì. ⇒ Chúng tôi cần một cách để
hỏi bạn.

### 3.1 Chúng tôi hỏi ba câu — bạn khai câu nào bạn trả lời được

| # | Câu hỏi | Dùng để |
|:--:|---|---|
| **1** | "Từ X đến Y, bên bạn đã gửi những sự việc kinh doanh nào?" | **phát hiện** chỗ thiếu |
| **2** | "Gửi lại sự việc mang id Z." | **lấp** chỗ thiếu |
| **3** | "Cho tôi trạng thái của tài nguyên gốc" (một đơn hàng, một giao dịch) | phát hiện, **khi bạn không có khái niệm "sự kiện"** |

**Câu 3 tồn tại vì bạn có thể hợp lệ không có khái niệm "sự kiện" nào cả.** Sổ của bạn có thể chỉ có
đơn hàng. Nếu hợp đồng bắt bạn phải trả lời được câu 1, nó ngầm ép bạn **dựng một kho sự kiện chỉ để
tích hợp** — chúng tôi không làm vậy.

### 3.2 🔒 Bạn không phải dựng đúng hình dạng API của chúng tôi

Điểm quan trọng nhất trong mục này, và có thể ngược với kỳ vọng của bạn:

```text
CHUẨN HOÁ    :  BA CÂU HỎI ở trên, và NGHĨA của câu trả lời
KHÔNG chuẩn  :  đường dẫn · hình dạng HTTP · tên trường · cách bạn lưu dữ liệu bên trong
```

Đã có `GET /orders?from=…&to=…`? Dùng nó. Có `POST /transactions/search`? Dùng nó. Chỉ có **tệp đối
soát cuối ngày qua SFTP**? Cũng được. Chúng tôi giữ một **lớp chuyển đổi (adapter)** riêng cho từng đối
tác; việc của bạn là **trả lời được ba câu**, không phải bắt chước hình dạng của chúng tôi.

Những thứ chúng tôi **không** quy định, và sẽ không bao giờ quy định: kho dữ liệu của bạn, mô hình đơn
hàng nội bộ, hệ thống hàng đợi, thiết kế API nội bộ của bạn.

### 3.3 Ba câu trả lời phải phân biệt được với nhau

| Bạn trả về | Chúng tôi hiểu |
|---|---|
| **không trả lời được** *(chưa hỗ trợ / lỗi / hết giờ)* | **không kết luận gì cả** |
| danh sách **rỗng** | "trong khoảng đó, bạn thật sự không gửi gì" |
| danh sách có phần tử **+ con trỏ tiếp** | còn nữa, chúng tôi sẽ hỏi tiếp |

⚠️ **Đừng trả danh sách rỗng khi ý bạn là "tôi không tra được."** Hai thứ đó ra hai kết luận ngược
nhau: một cái nói "không thiếu gì", cái kia nói "chưa biết." Trả sai làm chúng tôi **yên tâm trong lúc
đang thật sự mất sự kiện** — kiểu hỏng nguy hiểm nhất.

⚠️ **Nếu bạn từ chối chúng tôi, trả `401` hoặc `403`. Đừng trả `200` với thân rỗng.** Chúng tôi phân
biệt "bạn đang CHẶN chúng tôi" với "bạn KHÔNG TRẢ LỜI ĐƯỢC" với "bạn thật sự không có gì trong khoảng
đó" — ba response khác nhau dẫn tới ba hành động khác nhau phía chúng tôi.

### 3.4 Phân trang bằng con trỏ — con trỏ là của bạn

Với một khoảng dài, trả về từng trang kèm **con trỏ tiếp**; chúng tôi gửi lại nó **nguyên văn** ở lượt
sau, tới khi bạn báo hết. Chúng tôi **không diễn giải** nó — đó là chuỗi của bạn, mã hoá gì bên trong
là việc của bạn.

### 3.5 Lấp chỗ thiếu qua cửa bạn đã có — không phải cửa mới

Khi đã xác định chênh lệch, bạn **gửi lại** những sự kiện đó qua `POST /api/v1/integrations/events` —
đúng cửa bạn đang dùng. **Không có cửa thứ hai để học.**

⭐ Gửi lại an toàn **miễn là bạn giữ nguyên `eventId`**: sự kiện đã có trả `200 deduplicated`; sự kiện
thiếu thì được ghi nhận. Bạn **không cần** biết chính xác cái nào thiếu — **gửi lại cả khoảng cũng
đúng.**

⚠️ Phép bảo vệ này chỉ phủ **cùng một `eventId`**. Sinh id mới cho một sự kiện đã gửi khiến chống trùng
không có gì để so, và sự kiện đó bị tính lần thứ hai — xem
[event-ingestion.md § Chống trùng](./event-ingestion.md#7-hành-vi-chống-trùng).

## 4. 🔒 Chúng tôi tự xác thực với bạn — `PartnerRecoverySignatureV1`

Bạn sẽ không bao giờ phải mở một cửa cho một bên gọi mà **không chứng minh được mình là ai**. Đây là
khuôn ký chúng tôi dùng khi gọi sang bạn, công bố **trước** mọi lượt gọi thật để bạn dựng và kiểm thử
verify trước khi mở cửa.

```text
signing_string = <X-Platform-Timestamp>  +  "."
               + <METHOD, viết HOA>      +  "."
               + <đường dẫn + query, ĐÚNG NHƯ trên dòng request>  +  "."
               + <byte thân request thô — chuỗi rỗng nếu không có thân>

signature      = "sha256=" + hex_viết_thường( HMAC-SHA256( RECOVERY_SECRET, signing_string ) )
```

| Header | Chở gì |
|---|---|
| `X-Platform-Key-Id` | khoá nào của chúng tôi đã ký cái này — **dùng nó để tra đúng secret**, và đây là thứ giúp xoay khoá không gây gián đoạn |
| `X-Platform-Timestamp` | Unix giây |
| `X-Platform-Signature` | `sha256=<hex viết thường>` |

⚠️ **Khuôn này khác `EventIngressSignatureV1`, có chủ đích.** Chiều bạn gọi chúng tôi chỉ có đúng
**một** endpoint, luôn có thân — nên ký `timestamp + thân` là đủ. Endpoint của chiều này là **của
bạn**, và nhiều đối tác sẽ expose một `GET /orders?from=…&to=…` không có thân. Nếu chúng tôi chỉ ký
`timestamp + thân rỗng`, một chữ ký hợp lệ sẽ dùng được cho **mọi** lượt `GET` trong cửa sổ 5 phút — ai
chặn được một lượt gọi có thể trỏ nó sang tài nguyên khác của bạn, và phép verify của bạn **vẫn báo hợp
lệ**.

⇒ Chuỗi ký phủ **method + đường dẫn + query + thân**. Hàm băm dùng **y hệt** — dùng lại đúng mã
HMAC-SHA256 bạn đã viết cho chiều kia, chỉ đổi chuỗi đem ký.

**Mã verify tham khảo (Node.js):**

```js
const crypto = require('node:crypto');

function verifyPlatformSignature(req, secretsByKeyId) {
  const keyId = req.header('X-Platform-Key-Id');
  const ts    = Number(req.header('X-Platform-Timestamp'));
  const given = req.header('X-Platform-Signature') || '';

  // 1. Độ tươi ±5 phút, chặn cả hai chiều
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts * 1000) > 5 * 60_000) return false;

  // 2. Secret tra theo keyId — cho phép CẢ HAI secret cùng hợp lệ lúc xoay khoá (§5)
  const secret = secretsByKeyId[keyId];
  if (!secret) return false;

  // 3. req.originalUrl = đường dẫn + query ĐÚNG NHƯ nhận được. req.rawBody = byte thô, trước khi parse JSON
  const base = Buffer.concat([
    Buffer.from(`${ts}.${req.method.toUpperCase()}.${req.originalUrl}.`, 'utf8'),
    req.rawBody ?? Buffer.alloc(0),
  ]);
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(base).digest('hex');

  // 4. So sánh theo thời gian hằng số — ĐỪNG dùng ===
  const a = Buffer.from(expected), b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

⚠️ **Dùng đúng đường dẫn như đã nhận — đừng chuẩn hoá lại.** Đúng dãy ký tự trên dòng request — đừng
sắp lại query, đừng mã hoá lại `%`. Chuẩn hoá lại khiến một chữ ký **đúng** trượt không liên tục.

⚠️ **Có một nguồn lỗi nằm NGOÀI mã của bạn ở chiều này — kiểm nó trước.** Nhiều reverse proxy, API
gateway, và CDN **tự chuẩn hoá mã hoá `%`, gộp `//`, hoặc sắp lại tham số query** trước khi request tới
được mã kiểm chữ ký của bạn. Khi đó, **mã của bạn hoàn toàn đúng mà chữ ký vẫn trượt.**

⇒ Nếu nghi ngờ, **log đúng dòng request mà tầng verify của bạn thực sự thấy** rồi so với thứ chúng tôi
gửi. Lệch ở đó là lỗi tầng hạ tầng, không phải lỗi khoá — và đây là chỗ dễ tốn thời gian tìm sai hướng
nhất.

**Độ tươi ±5 phút**, cùng con số với
[event-ingestion.md §3](./event-ingestion.md#3-xác-thực), chặn cả hai chiều.

🔒 **Secret Key này hoàn toàn tách biệt với khoá kênh EVENT của bạn** — cấp riêng, cùng lý do như
[README.md](./README.md): người chạm khác nhau, nhịp xoay khác nhau. Dùng lại khoá EVENT ở đây nghĩa
là một chỗ rò làm hỏng **cả hai** chiều cùng lúc.

**Xoay khoá không làm gián đoạn endpoint này**
([testing.md § Xoay khoá](./testing.md#3-xoay-khoá)): có một cửa sổ mà **hai** secret cùng hợp lệ.
Kiểm `X-Platform-Key-Id` để biết chúng tôi đang ký bằng cái nào, và chấp nhận cả hai tới khi chúng tôi
báo cái cũ đã bị thu hồi.

### 4.1 🔒 Hai giới hạn của khuôn này — nói rõ để bạn không dựa vào thứ nó không hứa

Chữ ký **không** phủ tên máy chủ đích, và **không có** `nonce`. Cả hai đều là lựa chọn có điều kiện:

| Thiếu | Thay bằng gì | Điều kiện để đủ an toàn |
|---|---|---|
| ký **tên máy chủ** | **một tích hợp = một endpoint recovery = một secret** | Nếu bạn chạy nhiều máy chủ (sandbox và production, nhiều vùng), **đừng dùng chung secret** giữa chúng. Mỗi máy chủ là một tích hợp riêng với khoá riêng. Dùng chung nghĩa là một request ký cho máy này verify được ở máy kia |
| **`nonce`** | riêng cửa sổ độ tươi ±5 phút | Ba câu hỏi ở §3.1 đều **chỉ đọc** và vô hại khi lặp lại. Phát lại trong 5 phút chỉ là một lượt đọc lặp — không có tác dụng phụ nào để khai thác |

⚠️ **Ngày nào kênh recovery này có thao tác GHI, `nonce` phải được thêm TRƯỚC, không phải sau.** Một
cửa sổ thời gian một mình không chặn được phát lại; nó chỉ giới hạn *bao lâu* thì phát lại được. Với
thao tác chỉ đọc, khác biệt đó không quan trọng; với thao tác đổi trạng thái, đó là một lỗ hổng thật.

⚙️ Một cam kết vận hành phía chúng tôi tự giữ: **lượt gọi ra ngoài KHÔNG đi theo chuyển hướng
(`3xx`)**. Đi theo sẽ để một cấu hình chuyển hướng lái gói tin đã ký của chúng tôi tới một đích chúng
tôi không chọn — đúng thứ mà việc không ký tên máy chủ để hở.

## 5. Hạng tích hợp của bạn

| Hạng | Bạn có | Mất gì khi có sự cố |
|---|---|---|
| `FULL_RECOVERY` | nhận + biên nhận + **một** đường replay | — |
| `INGEST_PLUS_DETECTION` | nhận + biên nhận + đối soát, **không** replay | **phát hiện được, không tự sửa được** |
| `INGEST_PLUS_REPLAY` | nhận + bạn replay được, **không** đối soát | lấp được nhưng **không biết** lấp cái nào |
| `INGEST_ONLY` | chỉ nhận | mất là mất **câm** |

### 5.0 Mapping Capability → Hạng — hai bộ từ vựng duy nhất trong tài liệu này, nối lại với nhau

Có hai bộ từ vựng khác nhau xuất hiện xuyên suốt bộ tài liệu này. Đây là mapping normative DUY NHẤT
giữa chúng — đừng tự suy cái này từ cái kia bằng cách đoán.

- **Capability** (`QUERY_WINDOW`, `QUERY_RESOURCE`, `REDELIVER_BY_ID`) — ba nguyên thuỷ mà hệ thống
  của bạn có hoặc không có, được chứng minh bởi các ca kiểm chiều RA của bộ kiểm hợp chuẩn (§1.3 của
  [testing.md](./testing.md)).
- **Hạng** (`FULL_RECOVERY`, `INGEST_PLUS_DETECTION`, `INGEST_PLUS_REPLAY`, `INGEST_ONLY`) — **kết quả
  công bố** khi kết hợp các capability bạn đã chứng minh, theo hai vế của §1 (phát hiện / sửa).

| Capability | Vế nào (§1) | Chứng minh bởi ca kiểm |
|---|---|---|
| `QUERY_WINDOW` | **cả** phát hiện lẫn sửa | `OUT-1`, `OUT-2`, `OUT-5`, `OUT-6` |
| `QUERY_RESOURCE` | chỉ phát hiện | `OUT-7` |
| `REDELIVER_BY_ID` | chỉ sửa — nhưng chỉ dùng được khi đã có nguồn khác báo **id nào** đang thiếu | `OUT-3`, `OUT-4` |

🔴 **`QUERY_WINDOW` phủ được cả hai vế CHỈ VÌ response của nó PHẢI mang đủ phong bì sự kiện có thể gửi
lại cho mỗi phần tử — không chỉ một id.** Response `OUT-1`/`OUT-2` của bạn được đọc lại vào đúng schema
bạn gửi **vào** kênh EVENT (§5 của [event-ingestion.md](./event-ingestion.md)); chúng tôi lấy nội dung
đó và gửi thẳng qua đường ingest của chính mình, không cần thêm lượt gọi nào tới bạn. Nếu endpoint của
bạn chỉ trả được `{ eventId, type, occurredAt }` cho mỗi phần tử — không phải phong bì đầy đủ — bạn có
mức phát hiện `QUERY_RESOURCE`, không phải `QUERY_WINDOW`: khai đúng như vậy, nếu không bộ kiểm hợp
chuẩn sẽ fail khi nó thử gửi lại thứ bạn trả về.

⚠️ **Đừng nhầm cái này với field `eventIds` trong response §2** (`POST
/api/v1/integrations/reconciliation`, chiều **bạn** gọi **chúng tôi**). Field đó chỉ là danh sách id
thuần, không có nội dung phong bì — khi dùng nó, **chính bạn** là người gửi lại qua
[event-ingestion.md](./event-ingestion.md), chúng tôi không tự gửi lại từ đó. `QUERY_WINDOW` là chiều
ngược lại (§3): một endpoint **bạn** expose, mà **chúng tôi** gọi.

| Capability bạn đã chứng minh | Hạng công bố |
|---|---|
| `QUERY_WINDOW` (một mình đã đủ cho cả hai vế) | `FULL_RECOVERY` |
| `QUERY_RESOURCE` + `REDELIVER_BY_ID` (phát hiện + sửa, qua hai nguyên thuỷ riêng) | `FULL_RECOVERY` |
| chỉ `QUERY_RESOURCE` | `INGEST_PLUS_DETECTION` |
| chỉ `REDELIVER_BY_ID` | `INGEST_PLUS_REPLAY` |
| không có gì | `INGEST_ONLY` |

**Hạng của bạn nằm TRONG response đối soát**, không phải một dòng trong tài liệu này. Mỗi lượt gọi
`POST /api/v1/integrations/reconciliation` trả về:

```jsonc
"capability": {
  "tier":       "INGEST_ONLY",
  "meaning":    "mất là mất câm — hệ thống không trả lời được câu \"lỗi của ai\"",
  "closesLoop": false          // vòng đối soát có khép được không — cần CẢ phát hiện LẪN replay
}
```

### 5.1 ⚠️ Khai một capability là chưa đủ — phải được chứng minh

Hạng của bạn là **giao** của hai thứ:

```text
  gọi bạn THẬT SỰ làm được gì   (đo trực tiếp, mỗi lượt gọi — không phải một cờ ai đó đặt một lần)
∩ BÀI KIỂM HỢP CHUẨN của bạn đã PASS gì   (testing.md)
────────────────────────────────────────
  hạng công bố cho bạn
```

**Khai nghĩa là bạn nói bạn làm được; hạng chỉ tăng khi bạn chạy bài kiểm hợp chuẩn và nó PASS.** Khai
mà không chạy để hạng đứng yên, và bạn sẽ chờ một thứ không bao giờ tới.

🔒 Vì sao là giao chứ không phải một trong hai — mỗi vế một mình để hở đúng một lỗ:

| Chỉ tin kết quả bài kiểm | Chỉ tin đo trực tiếp |
|---|---|
| bạn đổi hệ thống sau khi kiểm ⇒ kết quả cũ **nói dối** | cắm xong là hạng tăng **mà chưa từng pass bài kiểm nào** |

⇒ Gỡ đường replay của bạn ⇒ hạng **tụt ngay**, không ai phải cập nhật gì. Chưa pass ⇒ **không tăng
hạng**, dù bạn đã dựng xong hết.

⚠️ **Mặc định hôm nay của mọi đối tác là `INGEST_ONLY`** — đây là hành vi **fail-closed có chủ đích**,
không phải đánh giá thấp bạn. Khai một capability chưa ai kiểm sẽ khiến bạn **tin rằng mình đang được
bảo vệ** trong khi không phải — đúng kiểu hỏng mà toàn bộ hệ thống hạng này sinh ra để tránh.

⭐ **Cả bốn hạng đều là tích hợp hợp lệ.** Chúng tôi **không** từ chối ai vì thiếu năng lực phục hồi —
làm vậy sẽ biến nền tảng thành "chỉ nhận đối tác có hệ thống đủ mạnh." Nhưng chúng tôi **phải biết và
công bố** hạng của bạn: ở `INGEST_ONLY`, "lỗi của ai" là câu hỏi hệ thống **không trả lời được** — và
đó là một sự thật **được khai ra**, không phải một lỗ giấu đi.

**Bốn hình dạng replay được chấp nhận — có BẤT KỲ cái nào là đủ, bạn không cần dựng thêm cái mới:**

| Bạn đã có | Hình dạng |
|---|---|
| một endpoint liệt kê sự kiện theo khoảng thời gian | truy vấn cửa sổ |
| một endpoint gửi lại một lượt giao | replay theo định danh |
| một endpoint đọc trạng thái của tài nguyên kinh doanh | truy vấn tài nguyên |
| một tệp đối soát cuối kỳ | tệp lô (batch) |
| **không có gì trong số trên** | hạng `INGEST_ONLY` — bạn vẫn tích hợp đầy đủ |
