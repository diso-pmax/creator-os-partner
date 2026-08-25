# Kênh LAUNCH — Hợp đồng Campaign Launch

**Bản 1.0 · 2026-08-25** · Bắt đầu từ: [README.md](./README.md). *(bản dịch của
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

- Bạn có `accessKey` và một **LAUNCH** Secret Key (xem [README.md](./README.md)). Đây là secret riêng,
  độc lập với secret EVENT của bạn — xem §3.
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
| Secret | **LAUNCH** channel Secret Key — giá trị khác secret EVENT của bạn, cùng `accessKey` |
| Encoding | hex chữ thường, tiền tố `sha256=` |
| Chuỗi canonical | `<X-Timestamp>` + `"."` + `<thân request thô, đúng byte>` |
| Sai số timestamp | ±5 phút |

```text
canonical_string = timestamp + "." + raw_body
signature        = "sha256=" + hex(HMAC_SHA256(LAUNCH_SECRET, canonical_string))
```

Điều này chỉ áp cho **bước 1** (`POST .../launch`). Bước 2 (`GET /launch`) do WebView gọi, không phải
máy chủ của bạn, và không mang HMAC — xem §5 vì sao điều đó vẫn an toàn.

🔒 LAUNCH Secret Key PHẢI chỉ sống trên máy chủ của bạn — cùng luật với mọi secret channel khác.
🔒 KHÔNG tái dùng secret EVENT ở đây, dù cả hai cùng chung một `accessKey`. Lộ secret LAUNCH chỉ cấp
năng lực yêu cầu launch — không bao giờ cấp quyền bắn event.

## 4. Bước 1 — Tạo Launch Grant

```text
POST https://<host sandbox của chúng tôi>/api/v1/campaigns/:campaignId/launch
Content-Type: application/json
```

🔴 **Endpoint này CHỈ được gọi từ máy chủ của bạn — không bao giờ trực tiếp từ mobile app hay trình
duyệt của đối tác.** Đây là ranh giới hợp đồng (như mọi lượt gọi server-to-server khác trong tích hợp
này), không phải thứ chặn được 100% bằng cơ chế kỹ thuật bạn quan sát được.

### 4.1 Request

| Trường | Ở đâu | Kiểu | Bắt buộc | Mô tả |
|---|---|---|:--:|---|
| `campaignId` | URL path | string | **CÓ** | campaign bạn muốn launch |
| `externalUserId` | JSON body | string | **CÓ** | 🔴 đúng định danh bạn dùng làm `externalUserId` ở kênh EVENT cho người dùng này — xem §7 |

```jsonc
// POST /api/v1/campaigns/camp_01J.../launch
{ "externalUserId": "usr_4471" }
```

### 4.2 Response

**Thành công — `200`:**

```jsonc
{
  "launchUrl": "https://<host sandbox của chúng tôi>/api/v1/launch?code=<code mờ>",
  "expiresAt": "2026-08-25T10:31:00.000Z"
}
```

`launchUrl` chỉ hợp lệ tới `expiresAt` — **60 giây** kể từ lúc tạo ở bản này (tham số v1, không phải bất
biến giao thức — xem §6, mục 4). Mở nó trong WebView của người dùng ngay lập tức — đừng cache hay trì
hoãn.

**Thất bại** — xem bảng đầy đủ ở [error-codes.md](./error-codes.md#kênh-launch--post-apiv1campaignscampaignidlaunch).

## 5. Bước 2 — WebView tiêu thụ code

```text
GET https://<host sandbox của chúng tôi>/api/v1/launch?code=<code mờ>
```

Bạn không tự gọi endpoint này — bạn chỉ mở `launchUrl` (nguyên URL, kèm code) trong WebView của người
dùng. Trình duyệt/WebView làm phần còn lại.

**Việc chúng tôi làm:** tiêu thụ code atomic (đúng một lần thành công dù có nhiều lượt gọi đồng thời —
§6, mục 7), resolve danh tính người dùng và campaign đích **từ chính bản ghi Launch Grant** — không bao
giờ từ bất cứ gì request mang theo — establish một Creator-OS session, set cookie phiên, và redirect tới
campaign.

**Thành công:**

```jsonc
HTTP/1.1 302 Found
Location: https://<reward-portal>/campaigns/<campaignId>
Set-Cookie: __Host-player_session=<JWT>; HttpOnly; Secure; SameSite=Lax   // hết hạn sau 8 giờ
```

Cookie phiên, vòng đời 8 giờ của nó, và economic subject nó resolve tới (**Party**) là cùng cơ chế dùng
ở mọi nơi khác trong tích hợp này — LAUNCH chỉ đổi cách session được establish.

**Thất bại:** `401 INVALID_LAUNCH_CODE` — xem §8. Bản này chưa định nghĩa trang lỗi HTML trung tính;
nếu bạn cần một UX dự phòng cụ thể trong WebView, tự xây phía bạn dựa trên status code này.

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
- [ ] LAUNCH Secret Key sống trên **máy chủ**, khác secret EVENT của bạn, và không dùng chung code ký
      với kênh EVENT (§3)
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
