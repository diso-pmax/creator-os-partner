# Kênh LAUNCH — Hợp đồng Campaign Launch

Bắt đầu từ: [README.md](./README.md). *(bản dịch của
[en/campaign-launch.md](../en/campaign-launch.md) — bản tiếng Anh là nguồn chốt, lệch thì bản tiếng Anh
thắng)*

## 1. Tổng quan

Hai lượt gọi, hai bên gọi khác nhau. Lượt đầu là server-to-server; lượt hai đến từ WebView của người
dùng và không mang credential nào của riêng nó ngoài một mã (code) mờ, dùng một lần.

```text
Máy chủ của bạn                          Creator-OS                          WebView người dùng
     │                                       │                                       │
     │  1. POST /campaigns/:campaignId/launch│                                       │
     ├──────────────────────────────────────▶│                                       │
     │                                       ├─ xác thực (HMAC kênh LAUNCH)          │
     │                                       ├─ kiểm campaign: tồn tại, đúng tenant  │
     │                                       │  của bạn, đang active                 │
     │                                       ├─ tạo Launch Grant dùng một lần        │
     │◀──────────────────────────────────────┤                                       │
     │  200 { launchUrl, expiresAt }         │                                       │
     │                                       │                                       │
     │  2. bạn mở launchUrl trong WebView của người dùng                             │
     ├────────────────────────────────────────────────────────────────────────────▶ │
     │                                       │                                       │
     │                                       │  3. GET /launch?code=…                │
     │                                       │◀──────────────────────────────────────┤
     │                                       ├─ tiêu thụ code (atomic, dùng một lần) │
     │                                       ├─ resolve danh tính + campaign từ bản  │
     │                                       │  ghi Launch Grant — KHÔNG từ request  │
     │                                       ├─ establish một Creator-OS session     │
     │                                       │  302 → URL campaign, set cookie phiên │
     │                                       ├──────────────────────────────────────▶│
```

**Việc của bạn:** một lượt gọi server-to-server (bước 1), rồi mở URL nhận được trong WebView của người
dùng (bước 2). Đó là toàn bộ bề mặt tích hợp phía bạn.

**Việc của chúng tôi:** tạo Launch Grant dùng một lần (bước 1), rồi — khi WebView mở URL — tiêu thụ nó
đúng một lần và establish một Creator-OS session cho người dùng đó (bước 3).

⚠️ **Chúng tôi không bao giờ gọi vào máy chủ của bạn trong luồng này.** Không có "callback URL của bạn"
nào chúng tôi gọi tới. Hai việc duy nhất bạn phải làm là lượt gọi POST và mở `launchUrl` trong WebView
của người dùng.

## 2. Điều kiện tiên quyết

- Bạn có `accessKey` và **`masterSecret`**, rồi **tự dẫn xuất** khoá kênh **LAUNCH** từ đó theo
  [credential-derivation.md](./credential-derivation.md):

  ```text
  LAUNCH_KEY = HKDF-SHA256( ikm  = base64url_decode(masterSecret),
                            salt = rỗng,
                            info = "integration:channel:LAUNCH:v<VERSION>",
                            len  = 32 )   → base64url không padding
  ```

  🔴 **Chúng tôi KHÔNG phát riêng một "LAUNCH Secret Key"** — bạn chỉ nhận `masterSecret` một lần, và
  khoá từng kênh do bạn dẫn xuất. Khoá LAUNCH khác khoá EVENT vì chuỗi `info` khác, không phải vì
  chúng tôi gửi hai bí mật.
- Máy chủ của bạn tính được HMAC-SHA256 và biết định danh bạn dùng cho người dùng này ở kênh EVENT
  (`externalUserId`) — xem §7 vì sao giá trị này quan trọng ở đây nữa.
- Campaign bạn định launch đã tồn tại phía chúng tôi và đang ở trạng thái launch được (`active`, trong
  cửa sổ hiển thị).

## 3. Xác thực — cùng khuôn ký EVENT, khác secret

**Kênh LAUNCH KHÔNG định nghĩa một giao thức xác thực mới.** Nó tái dùng đúng khuôn ký đã tả ở
[event-ingestion.md §3](./event-ingestion.md#3-xác-thực) — `EventIngressSignatureV1` — chỉ khác
mỗi secret.

| | Hợp đồng |
|---|---|
| Header Access Key | `X-API-Key` |
| Header Timestamp | `X-Timestamp` — **giây** kể từ epoch |
| Header Signature | `X-Signature` |
| Thuật toán | HMAC-SHA256 |
| Secret | khoá kênh **LAUNCH** bạn **tự dẫn xuất** từ `masterSecret` (§2). Khác khoá EVENT vì chuỗi `info` khác, cùng `accessKey` |
| Encoding | hex chữ thường, tiền tố `sha256=` |
| Chuỗi canonical | `<X-Timestamp>` + `"."` + `<thân request thô, đúng byte>` |
| Sai số timestamp | ±5 phút |

```text
canonical_string = timestamp + "." + raw_body
signature        = "sha256=" + hex(HMAC_SHA256(LAUNCH_KEY, canonical_string))
```

Điều này chỉ áp cho **bước 1** (`POST .../launch`). Bước 2 (`GET /launch`) do WebView gọi, không phải
máy chủ của bạn, và không mang HMAC — xem §5 vì sao điều đó vẫn an toàn.

**Ví dụ chạy được:**

```bash
API='https://<host của môi trường bạn đang dùng>/api/v1'   # xem bảng môi trường ở README.md
ACCESS_KEY='<accessKey chúng tôi cấp>'
MASTER_SECRET='<masterSecret — base64url 43 ký tự>'
LAUNCH_VERSION=1
CAMPAIGN_ID='<campaignId chúng tôi cấp>'

LAUNCH_KEY=$(node -e '
  const { hkdfSync } = require("node:crypto");
  const ikm  = Buffer.from(process.argv[1], "base64url");
  const info = Buffer.from(`integration:channel:LAUNCH:v${process.argv[2]}`, "utf8");
  process.stdout.write(
    Buffer.from(hkdfSync("sha256", ikm, Buffer.alloc(0), info, 32)).toString("base64url"));
' "$MASTER_SECRET" "$LAUNCH_VERSION")

BODY='{"externalUserId":"usr_4471"}'
TS=$(date +%s)                                        # epoch GIÂY
SIG="sha256=$(printf '%s.%s' "$TS" "$BODY" \
      | openssl dgst -sha256 -hmac "$LAUNCH_KEY" -r | cut -d' ' -f1)"

curl -sS -X POST "$API/campaigns/$CAMPAIGN_ID/launch" \
  -H 'Content-Type: application/json' \
  -H "X-API-Key:   $ACCESS_KEY" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  --data-raw "$BODY"
```

⚠️ `$LAUNCH_KEY` là chuỗi base64url — dùng **nguyên văn** làm khoá HMAC, KHÔNG giải base64 lần nữa.

🔒 `masterSecret` và mọi khoá dẫn xuất PHẢI chỉ sống trên máy chủ của bạn — không bao giờ trong ứng
dụng di động, trình duyệt, hay kho mã nguồn.
🔒 KHÔNG dùng khoá EVENT để ký lượt launch, dù cả hai dẫn xuất từ cùng một `masterSecret`. Chúng khác
nhau là **có chủ ý**: lộ khoá LAUNCH chỉ cấp năng lực yêu cầu launch — không bao giờ cấp quyền bắn
event.

## 4. Bước 1 — Tạo Launch Grant

```text
POST https://<host của môi trường bạn đang dùng>/api/v1/campaigns/:campaignId/launch
Content-Type: application/json
```

🔴 **Endpoint này CHỈ được gọi từ máy chủ của bạn — không bao giờ trực tiếp từ mobile app hay trình
duyệt của đối tác.** Đây là ranh giới hợp đồng (như mọi lượt gọi server-to-server khác trong tích hợp
này), không phải thứ chặn được 100% bằng cơ chế kỹ thuật bạn quan sát được.

### 4.1 Request

| Trường | Ở đâu | Kiểu | Bắt buộc | Mô tả |
|---|---|---|:--:|---|
| `campaignId` | URL path | string | **CÓ** | campaign bạn muốn launch |
| `externalUserId` | JSON body | string | **CÓ** | 🔴 đúng định danh bạn dùng làm `externalUserId` ở kênh EVENT cho người dùng này — xem §7. Không được chứa ký tự điều khiển (NUL, tab, xuống dòng, DEL…): giá trị có chúng bị từ chối bằng `400 validation_error` và không tạo launch nào |
| `displayName` | JSON body | string hoặc `null` | không | tên hiển thị **gợi ý** cho người chơi này, tối đa 256 ký tự. Chỉ là gợi ý: nếu không qua chính sách đặt tên của chúng tôi thì bị bỏ và launch vẫn thành công. Sai kiểu hoặc quá độ dài là `400` |
| `segments` | JSON body | mảng string, hoặc `null` | không | **nhóm người chơi** bạn gắn cho người này, ví dụ `["khach-moi-261013"]`. Chỉ gửi **sau khi Diso báo đã bật** cho bạn và **đã khai nhóm đó** cho tích hợp của bạn — xem §4.1a |

```jsonc
// POST /api/v1/campaigns/camp_01J.../launch
{ "externalUserId": "usr_4471", "displayName": "Alex" }   // displayName là tuỳ chọn
```

### 4.1a Nhóm người chơi (`segments`)

Nhóm là một **thoả thuận giữa Diso và bạn**: Diso khai trước, trên tích hợp của bạn, những nhóm nào được phép (ví dụ `khach-moi-261013`, "khách mới, chưa có đơn trước 13/10, do bạn tính"). Lượt launch chỉ **gắn** các nhóm đó lên người chơi; nó không tạo nhóm mới. Bảng xếp hạng lọc theo nhóm sẽ chỉ xếp những người **đang mang** nhóm.

```jsonc
{ "externalUserId": "usr_4471", "segments": ["khach-moi-261013"] }
```

| Luật | Ý nghĩa với bạn |
|---|---|
| **Chỉ gửi sau khi Diso báo đã bật** | Trước lúc đó, một lời gọi có `segments` bị `400` vì thân lời gọi chặt. Đó là hành vi đúng, không phải lỗi của bạn. |
| **Mỗi slug đúng khuôn** | Chữ thường và số, nối nhau bằng **một** dấu gạch ngang (`a`, `a-b`, `khach-moi-261013`); tối đa **40** ký tự. Chữ hoa, khoảng trắng, dấu, gạch dưới, ký tự điều khiển, chuỗi rỗng đều **không hợp lệ**. Chúng tôi **không tự chuẩn hoá**: `Khach-Moi` là `400`, không thành `khach-moi`. |
| **Một phần tử sai ⇒ từ chối cả lời gọi** | `400 validation_error`, **chưa có vé nào được tạo**, kể cả khi các slug còn lại đều hợp lệ. `segments` không phải mảng, hoặc có phần tử không phải chuỗi, cũng là `400`. |
| **Tối đa 10 slug khác nhau mỗi lần gọi** | Slug trùng nhau trong cùng lần gọi được bỏ trùng **trước khi đếm**: 11 phần tử mà chỉ có 10 slug khác nhau vẫn qua. Từ 11 slug khác nhau trở lên là `400`. |
| **Slug đúng khuôn nhưng Diso chưa khai cho tích hợp của bạn (hoặc đã lưu trữ)** | **Không phải lỗi.** Launch vẫn thành công, nhóm đó **không được gắn**, các nhóm đã khai trong cùng lời gọi vẫn được gắn. Diso thấy slug đó trong danh sách "chưa khai" để khai nếu hợp lý. Nhóm đã khai cho đối tác khác **không dùng được** cho bạn. |
| **`segments` vắng, `null` hoặc `[]`** | **Không đổi gì** về nhóm của người chơi. `[]` **không** có nghĩa "xoá hết". |
| **Chỉ cộng, không bớt** | Người chơi đã có nhóm A, bạn gửi nhóm B ⇒ họ có **cả A và B**. Không có cách nào bớt nhóm qua launch. |
| **Trần 30 nhóm mỗi người chơi, tất cả hoặc không** | Nếu gắn thêm sẽ vượt **30** nhóm tích luỹ, lượt launch đó **không thêm nhóm mới nào** (không thêm "vài nhóm đầu"), nhưng vẫn thành công. Kết quả không phụ thuộc thứ tự bạn liệt kê. |
| **Nhóm được gắn lúc người chơi mở `launchUrl`** | Không phải lúc bạn gọi POST: vé hết hạn mà không ai mở thì nhóm **không được gắn**. |
| **Gửi nhóm ở MỌI lần launch** | Nếu bước gắn nhóm gặp lỗi sau khi vé đã dùng, người chơi vẫn vào được nhưng nhóm **không được áp bù**; nhóm sẽ được gắn ở lần launch sau, **khi bạn gửi lại**. Vì vậy hãy gửi nhóm ở mọi lần launch của người đó. |
| **Chữ ký phủ cả `segments`** | `segments` nằm trong thân đã ký, nên đổi một ký tự sau khi ký là `401`. Chúng tôi chỉ đọc nhóm từ thân này, **không** từ URL, cookie hay trình duyệt người chơi. |

**Ví dụ thân lời gọi và cách ký.** `segments` nằm trong thân JSON, nên **chuỗi byte bạn ký phải đúng là chuỗi byte bạn gửi** (cùng khuôn ký ở §3, không có gì thêm):

```bash
BODY='{"externalUserId":"usr_4471","segments":["khach-moi-261013"]}'
TS=$(date +%s)
SIG="sha256=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$LAUNCH_KEY" -r | cut -d' ' -f1)"
curl -sS -X POST "$API/campaigns/$CAMPAIGN_ID/launch" \
  -H 'Content-Type: application/json' -H "X-API-Key: $ACCESS_KEY" \
  -H "X-Timestamp: $TS" -H "X-Signature: $SIG" --data-raw "$BODY"
```

**Lỗi `400` trông thế này** (cùng hình dạng `validation_error` ở [error-codes.md](./error-codes.md#kênh-launch--post-apiv1campaignscampaignidlaunch); trường `errors` là **số nhiều**, khoá theo vị trí phần tử sai):

```jsonc
// segments: ["khach-moi", "Khach-Moi"]  → một phần tử sai ⇒ từ chối CẢ lời gọi, chưa có vé
{ "status": 400, "title": "validation_error", "code": "validation_error",
  "detail": "segments.1: Invalid", "errors": { "segments.1": ["Invalid"] } }
```

⚠️ **Phản hồi `200` không cho biết nhóm nào được gắn.** Nó chỉ trả `launchUrl`/`expiresAt`, kể cả khi một slug chưa được khai cho tích hợp của bạn (khi đó slug đó âm thầm không được gắn, đúng thiết kế). Muốn biết một nhóm đã khai hay chưa, hãy hỏi chúng tôi **trước khi** gửi lần đầu; đừng suy ra từ phản hồi.

🔴 **Bảng xếp hạng "khách mới" đếm từ lúc người chơi tham gia.** Đơn đặt **trước lần launch đầu tiên** của người chơi **không được đếm**. Với nhóm kiểu "khách mới", hãy launch người đó **trước hoặc cùng lúc** với đơn đầu tiên của họ. Nhóm tới muộn (sau khi đã có đơn) thì các đơn từ lúc họ tham gia **vẫn được đếm**.

### 4.2 Response

**Thành công — `200`:**

```jsonc
{
  "launchUrl": "https://<host CỔNG THƯỞNG của chúng tôi>/api/v1/launch?code=<code mờ>",
  "expiresAt": "2026-08-25T10:31:00.000Z"
}
```

⚠️ **`launchUrl` nằm trên host CỔNG THƯỞNG, KHÔNG phải host API bạn vừa gọi POST**. Hai host
khác nhau là **cố ý**: cookie phiên phải rơi đúng nơi trang game đọc nó, và tiền tố `__Host-` mà chúng
tôi dùng **cấm** thuộc tính `Domain` — nên không có cách nào chia cookie giữa hai host.

⇒ Bạn **không phải làm gì thêm** *(vẫn chỉ mở nguyên `launchUrl` trong WebView)*, nhưng nếu bạn chạy
**bộ kiểm hợp chuẩn** thì máy chạy nó phải **với tới được host cổng thưởng**, không chỉ host API.

Bạn dựng app chứa web view? Đọc [webview.md](./webview.md): cookie đặt trên lượt chuyển hướng, và cầu nối native.

`launchUrl` chỉ hợp lệ tới `expiresAt` — **60 giây** kể từ lúc tạo ở bản này (tham số v1, không phải bất
biến giao thức — xem §6, mục 4). Mở nó trong WebView của người dùng ngay lập tức — đừng cache hay trì
hoãn.

**Thất bại** — xem bảng đầy đủ ở [error-codes.md](./error-codes.md#kênh-launch--post-apiv1campaignscampaignidlaunch).

## 5. Bước 2 — WebView tiêu thụ code

```text
GET https://<host CỔNG THƯỞNG của chúng tôi>/api/v1/launch?code=<code mờ>
```

Bạn không tự gọi endpoint này — bạn chỉ mở `launchUrl` (nguyên URL, kèm code) trong WebView của người
dùng. Trình duyệt/WebView làm phần còn lại.

**Việc chúng tôi làm:** tiêu thụ code atomic (đúng một lần thành công dù có nhiều lượt gọi đồng thời —
§6, mục 7), resolve danh tính người dùng và campaign đích **từ chính bản ghi Launch Grant** — không bao
giờ từ bất cứ gì request mang theo — establish một Creator-OS session, set cookie phiên, và redirect tới
**gốc webview Thưởng**. Đích không mang `campaignId`: webview tự hỏi máy chủ chiến dịch nào đang chạy
cho đơn vị trong vé.

**Thành công:**

```jsonc
HTTP/1.1 302 Found
Location: https://<reward-portal>/
Set-Cookie: __Host-player_session=<JWT>; HttpOnly; Secure; SameSite=Lax   // hết hạn sau 8 giờ
```

Cookie phiên, vòng đời 8 giờ của nó, và economic subject nó resolve tới (**Party**) là cùng cơ chế dùng
ở mọi nơi khác trong tích hợp này — LAUNCH chỉ đổi cách session được establish.

**Thất bại:** `401 INVALID_LAUNCH_CODE` — xem §8. Khi link được mở bằng trình duyệt của người chơi (điều hướng trang
bình thường), người chơi được chuyển (`302`) sang màn "link không còn dùng được" của chính game, kèm nút quay lại
ứng dụng của bạn, nên không bao giờ thấy lỗi thô. Các lệnh gọi từ máy chủ của bạn vẫn nhận `401`.
Client gửi header `Accept` có `text/html` được xem là trình duyệt; một số thư viện HTTP (ví dụ `HttpURLConnection` của
Java) mặc định gửi `text/html`, nên hãy đặt rõ `Accept: application/json` nếu bạn tự gọi URL này. **Máy chủ của bạn
không được gọi `GET /launch`**: lệnh gọi đó tiêu thụ vé một lần, khiến trình duyệt của người chơi thấy vé đã dùng.
Phản hồi mang `Vary: Accept` và `Cache-Control: no-store`.

⚠️ **Lượt gọi này KHÔNG cần — và không kiểm — HMAC.** Đây là cố ý, không phải thiếu sót: `code` mờ trong
URL **tự nó là credential dùng một lần**. Xem §6 để biết đầy đủ các bảo đảm khiến điều đó an toàn.

## 6. Launch Grant — bất biến bảo mật (đã đóng băng, đừng tìm cách lách)

Mười bất biến dưới đây là phần lõi bảo mật của cơ chế này — mỗi cái đã được review và đóng băng trước
khi kênh này được xây. Nếu tích hợp của bạn có vẻ cần lách một trong số này, dừng lại và liên hệ chúng
tôi thay vì tìm cách vòng qua.

```text
1.  launchCode PHẢI được sinh ngẫu nhiên bằng mật mã học (cryptographically random).
2.  launchCode PHẢI mờ (opaque) — KHÔNG được mã hoá externalUserId hay campaignId bên trong.
3.  launchCode PHẢI dùng một lần (single-use).
4.  launchCode PHẢI có hạn ngắn (60 giây ở bản v1 — bất biến này nói về SỰ TỒN TẠI của một hạn ngắn,
    không phải về con số 60 cụ thể).
5.  launchCode PHẢI gắn với: partner + campaign + externalUserId (cả ba).
6.  Launch API (POST .../launch) PHẢI xác thực server-to-server — KHÔNG được nhận gọi trực tiếp từ
    mobile app hay trình duyệt của đối tác.
7.  Tiêu thụ cùng một launchCode đồng thời PHẢI cho phép TỐI ĐA một lượt establish session thành công
    (atomic consume).
8.  Launch URL PHẢI dùng HTTPS.
9.  🔴 Creator-OS KHÔNG được tin campaignId hay externalUserId do trình duyệt/WebView tự cung cấp tại
    thời điểm GET /launch — xem §6.1.
10. Trình duyệt/WebView chỉ trình ra launchCode; danh tính và phạm vi campaign luôn đến từ bản ghi
    Launch Grant phía server, resolve bằng cách tra code — không bao giờ từ request.
```

### 6.1 Vì sao bất biến #9 quan trọng — một kịch bản tấn công cụ thể

```text
Bạn gọi:          POST .../launch  { campaignId: A, externalUserId: X }
Chúng tôi trả:     { launchUrl: "https://creator-os.example/api/v1/launch?code=ABC" }
WebView mở:        GET /launch?code=ABC&campaignId=B     ← campaignId bị thêm/sửa trên URL
```

Chúng tôi chỉ đọc `code` từ query string ở endpoint này — mọi tham số khác, nếu có, bị bỏ qua âm thầm.
`campaignId` và `externalUserId` quyết định điều gì xảy ra tiếp theo luôn đến từ bản ghi Launch Grant đã
tạo ở bước 1, không bao giờ từ bất cứ gì gắn thêm vào `launchUrl` sau khi chúng tôi phát nó. Thêm hay
sửa tham số query trên `launchUrl` không có tác dụng gì.

### 6.2 `launchUrl` không phải credential vĩnh viễn

```text
launchUrl  ≠  URL campaign
           ≠  API credential
           ≠  session token
```

Nó là **credential khởi tạo dùng một lần (one-time bootstrap credential)** dùng để establish một
Creator-OS session. Ngay khi nó được tiêu thụ (thành công hay không), `launchCode` bên dưới trở nên
không hợp lệ — từ đó về sau, cookie phiên set ở bước 2, không phải `launchUrl`, mới là thứ mang xác thực
của người dùng.

Đừng lưu, log, bookmark, hay gửi lại một `launchUrl`. Đừng xây tính năng "gửi lại đúng link launch" —
gọi lại bước 1 để lấy cái mới.

## 7. Phạm vi partner ↔ campaign — `accessKey` của bạn được launch cái gì

Năng lực gọi kênh này của tích hợp bạn là một **ranh giới cấp tenant**, không phải một allowlist theo
từng campaign: một khi `accessKey` của bạn được cấp cho kênh LAUNCH, nó launch được **mọi** campaign
thuộc tenant của bạn — không có quyền riêng theo từng campaign để xin.

Một campaign **cụ thể** có launch được ngay bây giờ hay không là một kiểm tra **riêng, bổ sung** — trạng
thái của chính nó (`active`) và cửa sổ hiển thị, đánh giá độc lập tại bước 1. Một request nhắm vào
campaign ngoài trạng thái đó thất bại với `422 CAMPAIGN_NOT_LAUNCHABLE` (§8) dù `accessKey` của bạn vẫn
được phép nói chung.

🔴 **`externalUserId` PHẢI là cùng giá trị bạn dùng ở kênh EVENT cho người dùng này** (xem
[README.md](./README.md) § Ngữ nghĩa định danh). Lệch giá trị không thất bại rõ ràng: session vẫn
establish, nhưng gán quyền lợi cho người dùng đó có thể âm thầm lệch khỏi lịch sử event của họ.

## 8. Mã lỗi

Bối cảnh đầy đủ + bảng HTTP status chung:
[error-codes.md](./error-codes.md#kênh-launch--post-apiv1campaignscampaignidlaunch).

**`POST /campaigns/:campaignId/launch`** (server-to-server, bắt buộc HMAC):

| Code | HTTP | Khi nào |
|---|:--:|---|
| — *(lỗi xác thực chuẩn, xem [error-codes.md](./error-codes.md#ngữ-nghĩa-http-chung))* | `401` | sai key, sai chữ ký, hoặc timestamp hết hạn |
| `validation_error` | `400` | thân sai khuôn: `externalUserId` rỗng hoặc có ký tự điều khiển, `displayName` sai kiểu hoặc quá dài, **`segments` sai khuôn** (một phần tử sai ⇒ từ chối cả lời gọi, xem §4.1a), hoặc có trường lạ. Chưa có vé nào được tạo |
| `CAMPAIGN_NOT_FOUND` | `404` | campaign không tồn tại, **hoặc** thuộc tenant khác với tích hợp của bạn — cố ý không phân biệt, cùng lý lẽ với mọi ca cross-tenant khác trong tích hợp này |
| `CAMPAIGN_NOT_LAUNCHABLE` | `422` | campaign tồn tại và là của bạn, nhưng hiện không `active` / ngoài cửa sổ hiển thị |

**`GET /launch`** (hướng tới WebView, không HMAC):

| Code | HTTP | Khi nào |
|---|:--:|---|
| `INVALID_LAUNCH_CODE` | `401` | code không tồn tại, đã hết hạn, hoặc đã bị tiêu thụ — **một mã phủ cả ba nguyên nhân, cố ý** |

⚠️ **Đừng cố phân biệt "hết hạn" với "đã dùng" với "chưa từng tồn tại" trên response của `GET /launch`.**
Tách thành các mã riêng (vd `410` cho hết hạn, `403` cho đã dùng) sẽ cho phép ai đó dò endpoint này biết
được lượt đoán nào gần đúng hơn. Nếu một người dùng báo bị kẹt ở đây, hãy trace Launch Grant tương ứng
phía chúng tôi thay vì suy ra nguyên nhân từ response HTTP.

## 9. Yêu cầu bảo mật

- [ ] Chữ ký trên `POST .../launch` khớp [testing.md](./testing.md) khi bộ vector hợp chuẩn kênh LAUNCH
      được công bố
- [ ] `masterSecret` sống trên **máy chủ**; khoá LAUNCH được **dẫn xuất** từ nó (§2), và **không** dùng
      chung code ký với kênh EVENT (§3)
- [ ] `POST .../launch` chỉ được gọi từ backend của bạn — không bao giờ từ mobile app hay trình duyệt
- [ ] `externalUserId` bạn gửi là **đúng giá trị** bạn dùng ở kênh EVENT cho người dùng này
- [ ] Bạn mở `launchUrl` trong WebView **ngay lập tức** — nó hết hạn 60 giây sau khi phát
- [ ] Bạn không bao giờ lưu, log, hay hiển thị lại một `launchUrl` sau khi đã dùng một lần
- [ ] Bạn không thêm, đọc, hay dựa vào bất kỳ tham số query nào trên `launchUrl` ngoài `code` chúng tôi
      phát ra
- [ ] Đồng hồ máy chủ đồng bộ NTP, lệch dưới 1 phút

## 10. FAQ

**Chúng tôi có thể yêu cầu launch trước khi người dùng làm bất cứ gì trong app của mình không?**
Có — không có gì ở kênh này đòi hỏi một lượt handoff nào trước đó. `externalUserId` chỉ cần là định
danh ổn định của riêng bạn cho người dùng đó; bản thân danh tính được resolve, và nếu cần, provision
bởi chúng tôi khi WebView tiêu thụ code.

**Chúng tôi có dùng lại được một `launchUrl` nếu người dùng đóng WebView trước khi nó tải xong không?**
Không. Gọi lại bước 1. Một `launchCode` dùng một lần bất kể lượt trước có thực sự tới được chúng tôi hay
chưa — kể cả một WebView chưa tải xong cũng có thể đã tiêu thụ nó rồi.

**Điều gì xảy ra nếu campaign đổi trạng thái (vd bị tạm dừng) giữa bước 1 và bước 2?**
Launch Grant đã tồn tại và bước 2 không kiểm lại eligibility của campaign — nó chỉ kiểm hạn và trạng
thái dùng-một-lần của chính grant. Eligibility (§7) chỉ đánh giá một lần, ở bước 1.

**Chúng tôi có cần xây UI đăng nhập nào phía mình không?**
Không. Toàn bộ luồng là hai lượt gọi — một request server và mở một URL. Người dùng không thấy gì của
chúng tôi cho tới khi chính trang campaign tải xong.

**Secret LAUNCH có xoay cùng EVENT không?**
Không — mọi secret theo kênh đều độc lập; xoay hay thu hồi một cái không ảnh hưởng cái khác (xem
[testing.md § Xoay khoá](./testing.md#3-xoay-khoá)).

**Tôi gửi một nhóm mà chúng tôi chưa khai cho tích hợp của bạn thì sao?**
Lời gọi vẫn `200`, người chơi vẫn vào được, nhóm đó **không** được gắn (§4.1a). Sau khi chúng tôi khai nhóm đó, **lần launch kế tiếp** của người chơi sẽ gắn nó; chúng tôi **không** chạy bù cho người chơi không launch lại.

**Tôi cần làm gì để một người chơi mới được xếp vào bảng "khách mới"?**
Launch người đó **kèm** `segments` **trước hoặc cùng lúc** với đơn đầu tiên của họ (§4.1a). Đơn đặt trước lần launch đầu tiên không được đếm.
