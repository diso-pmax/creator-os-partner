# Testing — Bộ kiểm hợp chuẩn, Vector kiểm thử, Xoay khoá, Checklist trước khi lên thật

**Bản 1.0 · 2026-08-25** · Bắt đầu từ: [README.md](./README.md). *(bản dịch của
[en/testing.md](../en/testing.md) — bản tiếng Anh là nguồn chốt, lệch thì bản tiếng Anh thắng)*

Tài liệu và bộ kiểm chạy được đều là một phần của hợp đồng:

```text
Tài liệu
   +
Bộ kiểm hợp chuẩn chạy được
   =
Hợp đồng tích hợp đối tác
```

Đọc tài liệu → dựng → chạy bộ kiểm → biết mình xong chưa. Đừng coi bộ kiểm là công cụ tuỳ chọn.

---

## 1. Bộ kiểm hợp chuẩn tự động (kênh EVENT + RECOVERY)

Chúng tôi gửi kèm tài liệu này một **bộ kiểm chạy được**. Chạy nó **trên hệ thống của chính bạn**, xem
bạn đã thoả hợp đồng chưa, rồi mới onboard. **Bạn không cần chờ chúng tôi kiểm hộ.**

### 1.1 Chạy

```bash
CONF_API=https://<host của môi trường bạn dùng>/api/v1 \
CONF_ACCESS_KEY=<accessKey của bạn> \
CONF_MASTER_SECRET=<masterSecret — base64url 43 ký tự> \
CONF_EVENT_TYPE=ORDER_COMPLETED \
CONF_LAUNCH_CAMPAIGN_ID=<campaignId chúng tôi cấp> \
CONF_RECOVERY_URL=https://<hệ thống của bạn>/api/recovery \
  npx tsx run.ts
```

Dòng đầu output in ra **nguồn của từng khoá kênh** — ví dụ
`▶ khoá kênh: EVENT=dẫn xuất từ master, v1 · LAUNCH=dẫn xuất từ master, v1 · RECOVERY=không có`.
Đọc dòng đó trước khi debug `401`: nó loại ngay hai nguyên nhân *(sai nguồn khoá, sai version)* mà
bản thân mã `401` không phân biệt được.

Mã thoát: **`0`** = mọi ca pass · **`1`** = có ít nhất một ca fail · **`2`** = không chạy được *(thiếu
cấu hình)*.

| Biến | Bắt buộc | Ghi chú |
|---|:--:|---|
| `CONF_API` · `CONF_ACCESS_KEY` · `CONF_EVENT_TYPE` · `CONF_LAUNCH_CAMPAIGN_ID` | ✅ | thiếu ⇒ thoát `2` |
| **`CONF_MASTER_SECRET`** | ✅ | bộ kiểm **tự dẫn xuất** khoá từng kênh từ đây theo [credential-derivation.md](./credential-derivation.md) |
| `CONF_EVENT_VERSION` · `CONF_LAUNCH_VERSION` · `CONF_RECOVERY_VERSION` | ⬜ | mặc định `1`. Sau khi **xoay khoá** thì PHẢI đặt — quên là bộ kiểm ký bằng khoá cũ và ăn `401` trông y hệt "chữ ký sai" |
| `CONF_EVENT_SECRET` · `CONF_LAUNCH_SECRET` · `CONF_RECOVERY_SECRET` | ⬜ | **đường cũ** — bí mật rời cho từng kênh. Chỉ dùng nếu tích hợp của bạn chưa được cấp lại credential. Khai tường minh thì nó **thắng** `CONF_MASTER_SECRET` |
| `CONF_RECOVERY_URL` | ⬜ | để trống ⇒ 7 ca chiều RA báo **SKIPPED** — **không phải** "passed" |
| `CONF_RECOVERY_SECRET` | ⬜ | để trống ⇒ chạy không ký, dùng khi bạn đang dựng dở |

⚠️ **Nếu bạn đã dựng verify chữ ký nhưng quên đặt `CONF_RECOVERY_SECRET`, cả 7 ca chiều RA sẽ fail với
`401`** — và đó là bộ kiểm **đang chạy đúng**: bạn vừa từ chối đúng một lượt gọi không có chữ ký. Đặt
secret rồi chạy lại.

⚠️ **SKIPPED không giống PASSED.** Bỏ qua **không** nâng hạng của bạn — nó chỉ có nghĩa là chưa ai hỏi.

### 1.2 ⚠️ Trỏ vào sandbox, đừng trỏ hệ thống production

7 ca chiều VÀO bắn **sự kiện thật** vào cửa sự kiện — mỗi lượt chạy để lại **7–8 sự kiện** ở bất cứ đâu
`CONF_API` trỏ tới. Không tiền hay điểm nào bị động (người dùng giả không khớp hồ sơ thật nào), nhưng
vẫn là dữ liệu thật.

⭐ Mọi thứ bộ kiểm tạo ra đều mang tiền tố **`conf-`** (`eventId`, `externalUserId`) nên lọc và dọn
được. Chạy lại bao nhiêu lần cũng an toàn về đúng/sai — chỉ tích thêm dữ liệu dùng-một-lần.

### 1.3 Mười bốn ca — hai chiều đo hai thứ khác nhau

| | Kiểm gì | Fail nghĩa là |
|---|---|---|
| **CHIỀU VÀO** *(7 ca)* | endpoint **của chúng tôi**, dùng khoá **của bạn** — tức bạn đã ký đúng, dùng đúng khuôn, đăng ký đúng chưa | ⚠️ **ĐIỀU KIỆN LÊN THẬT** — fail ca này nghĩa là tích hợp **không thể bật được** |
| **CHIỀU RA** *(7 ca)* | **hệ thống của bạn** — bạn trả lời được ba câu hỏi phục hồi chưa | bạn vẫn onboard bình thường, chỉ ở **hạng thấp hơn** ([recovery.md §5](./recovery.md#5-hạng-tích-hợp-của-bạn)) |

**Chiều VÀO**

| Ca | Kịch bản | Kỳ vọng |
|---|---|---|
| `IN-1` | sự kiện hợp lệ | `200` |
| `IN-2` | thiếu `eventId` | `400` — sai **khuôn** |
| `IN-3` | timestamp sai kiểu | `400` |
| `IN-4` | `payload` thiếu trường bắt buộc | **`422`** — đúng khuôn, sai **nghĩa** |
| `IN-5` | gửi lại y nguyên sự kiện | `200` + `deduplicated: true`, **không phải** `409` |
| `IN-6` | chữ ký sai | `401` |
| `IN-7` | timestamp cũ *(phát lại)* | `401` |

⚠️ **`IN-4` là ca đáng chú ý nhất.** `400` và `422` là **hai việc khác nhau** với bạn: `400` nghĩa là
"sai khuôn, sửa rồi gửi lại"; `422` nghĩa là "đúng khuôn, sai nghĩa nghiệp vụ — đọc `code` để biết bên
nào phải hành động" (xem [error-codes.md](./error-codes.md)). Nhận nhầm cái này thành cái kia khiến bạn
đi sửa một hình dạng vốn chưa từng sai, và bạn **không bao giờ tìm ra nguyên nhân thật**.

**Chiều RA**

| Ca | Kịch bản | Chứng minh capability |
|---|---|---|
| `OUT-1` | truy vấn theo cửa sổ thời gian ⇒ trả về danh sách sự kiện | `QUERY_WINDOW` |
| `OUT-2` | phân trang — có con trỏ tiếp, `null` khi hết | `QUERY_WINDOW` |
| `OUT-3` | truy vấn một id **không tồn tại** ⇒ trả rỗng, **không lỗi** | `REDELIVER_BY_ID` |
| `OUT-4` | replay theo định danh ⇒ trả về **đúng** sự kiện đó | `REDELIVER_BY_ID` |
| `OUT-5` | truy vấn cùng cửa sổ hai lần ⇒ kết quả **giống hệt** | `QUERY_WINDOW` |
| `OUT-6` | một con trỏ giả ⇒ **báo lỗi**, không âm thầm trả trang 1 | `QUERY_WINDOW` |
| `OUT-7` | truy vấn trạng thái **tài nguyên gốc** ⇒ trả trạng thái (hoặc `404`) | `QUERY_RESOURCE` |

⚠️ **`OUT-6` bắt được lỗi phân trang câm nhất có thể có.** Một con trỏ hỏng mà âm thầm trả về trang 1
khiến vòng lặp replay của chúng tôi chạy **mãi mãi trên cùng một trang** — trang nào cũng trông hợp lệ,
nên **không bên nào nhận ra**.

⚠️ **`OUT-5` — hai lượt truy vấn cùng cửa sổ phải trả về cùng một tập.** Đối soát chạy theo lịch; cùng
một câu hỏi ra hai câu trả lời khác nhau nghĩa là mọi kết luận "thiếu cái gì" là kết luận về một mục
tiêu đang di chuyển.

Cách suy hạng từ capability được tài liệu hoá ở [recovery.md §5](./recovery.md#5-hạng-tích-hợp-của-bạn).

### 1.4 Tự kiểm không phải là chấp thuận lên thật

**Tự kiểm chỉ để xác minh trong lúc phát triển. Nó không đổi hạng tích hợp đã công bố của bạn và không
phải là chấp thuận cho production. Đội của chúng tôi thực hiện xác minh hợp chuẩn cuối cùng trước khi
bật tích hợp.**

⭐ Bộ kiểm gọi theo hình dạng **mặc định**. Nếu hệ thống của bạn dùng hình dạng khác, báo chúng tôi và
chúng tôi sẽ cắm lớp adapter tương ứng — bộ kiểm chạy qua lớp đó. **Bạn không cần đổi API của mình.**

### 1.5 Kênh LAUNCH — 8 ca, chạy riêng

14 ca ở trên (§1.3) chỉ phủ EVENT và RECOVERY. **LAUNCH có 8 ca riêng**, cần thêm hai biến:

```bash
CONF_LAUNCH_SECRET=<secret kênh LAUNCH của bạn> \
CONF_LAUNCH_CAMPAIGN_ID=<một campaign THẬT, đang active, tích hợp của bạn launch được> \
  npx tsx run.ts
```

| Biến | Bắt buộc | Ghi chú |
|---|:--:|---|
| `CONF_LAUNCH_SECRET` | ✅ | thiếu ⇒ thoát `2`, giống các biến bắt buộc khác |
| `CONF_LAUNCH_CAMPAIGN_ID` | ✅ | phải đang `active`, trong cửa sổ hiển thị, và thuộc tenant của bạn — xem [campaign-launch.md §7](./campaign-launch.md#7-phạm-vi-partner--campaign--accesskey-của-bạn-được-launch-cái-gì) |

| Ca | Kịch bản | Kỳ vọng |
|---|---|---|
| `LAUNCH-1` | campaign + `externalUserId` hợp lệ | `200` + `launchUrl` |
| `LAUNCH-2` | mở `launchUrl` | session được establish |
| `LAUNCH-3` | dùng lại đúng `launchUrl` lần 2 | bị từ chối |
| `LAUNCH-4` | `launchUrl` đã hết hạn | bị từ chối |
| `LAUNCH-5` | launch code không hợp lệ | bị từ chối |
| `LAUNCH-6` | campaign không cho phép tích hợp này | bị từ chối |
| `LAUNCH-7` | code của campaign A không mở được campaign B | bị từ chối |
| `LAUNCH-8` | `externalUserId` từ launch khớp session tạo ra | đúng người dùng |

⏱️ **`LAUNCH-4` tốn khoảng một phút để chạy** — nó chờ hết TTL 60 giây thật của Launch Grant. Không có
cách nào nhanh hơn để kiểm điều này ở dạng hộp đen thuần: code hết hạn, đã tiêu thụ, và chưa từng tồn
tại **cố ý không phân biệt được**, cùng trả `401 INVALID_LAUNCH_CODE` (xem
[campaign-launch.md §8](./campaign-launch.md#8-mã-lỗi)) — nên cách trung thực duy nhất để chứng minh
riêng chuyện hết hạn là chờ nó hết hạn thật.

⚠️ **`LAUNCH-8` không thể "giải mã xem đây là phiên của ai" theo nghĩa đen** — session mang một id chủ
thể nội bộ, không bao giờ mang `externalUserId` của bạn (đây là cố ý — xem
[campaign-launch.md §6.2](./campaign-launch.md#62-launchurl-không-phải-credential-vĩnh-viễn)). Điều ca
này thực sự chứng minh: launch hai giá trị `externalUserId` **khác nhau** ra hai session **độc lập,
phân biệt được** — một phép đo gián tiếp cho "danh tính không bị lẫn giữa hai người dùng".

⚠️ **Kết quả LAUNCH được báo cáo giống chiều VÀO, nhưng CHƯA được nối vào cổng lên-thật tự động ở
§1.3** — cổng đó hiện chỉ đánh giá hợp chuẩn EVENT. Chúng tôi vẫn xác nhận tích hợp LAUNCH của bạn ở
lượt review onboarding. Cứ chạy bộ kiểm này — đây là cách nhanh nhất để tự bắt lỗi của mình trước lượt
review đó.

---

## 2. Vector kiểm thử

Con số cố định để **viết unit test cho hàm ký của bạn** — không cần mạng, không cần khoá thật. Lệch
một ký tự nghĩa là implementation của bạn sai.

⚠️ **`secret` trong các vector dưới là giá trị TUỲ Ý**, chỉ để kiểm hàm **ký**. Trong thực tế nó là
**khoá kênh bạn dẫn xuất** từ `masterSecret` — xem [credential-derivation.md](./credential-derivation.md),
nơi có bộ vector riêng cho phần **dẫn xuất**. Hai bộ vector kiểm hai việc khác nhau:
*dẫn xuất đúng khoá chưa* và *ký đúng chưa*. Sai ở bước nào cũng ra cùng một `401`.

### 2.1 Kênh EVENT — `EventIngressSignatureV1`

```text
secret     :  whsec_demo_0123456789abcdef
timestamp  :  1786698753
body       :  {"specversion":"1.0","eventId":"evt-88421","externalUserId":"12345","type":"ORDER_COMPLETED","occurredAt":"2026-08-14T09:12:33Z","confidence":"SERVER_OBSERVED","payload":{"orderId":"SO-99881","amountMinor":250000000,"currency":"VND"}}
             (234 byte, KHÔNG có xuống dòng cuối)

signing string :  1786698753.{"specversion":"1.0",…}

KẾT QUẢ    :  sha256=ae00dc858385fdb65061fda5da1809772f8f602f5d653052e7672516c4d59176
```

### 2.2 Kênh LAUNCH — tái dùng `EventIngressSignatureV1`

**Không phải giao thức ký thứ tư.** LAUNCH ký y hệt EVENT (§2.1) — cùng chuỗi canonical, cùng thuật
toán — chỉ khác secret. Hàm ký EVENT của bạn đã qua §2.1 thì chỉ cần trỏ nó vào secret + thân dưới đây;
lẽ ra **không cần** sửa gì thêm ngoài đó.

```text
secret     :  launchsec_demo_0123456789abcdef
timestamp  :  1786701000
body       :  {"externalUserId":"ext-user-000001"}
             (36 byte, KHÔNG có xuống dòng cuối)

signing string :  1786701000.{"externalUserId":"ext-user-000001"}

KẾT QUẢ    :  sha256=aa1844c56dfff66d53577aa4e35db6963ddd7a4425906782faa35f75119906bc
```

Đây là thân cho `POST /campaigns/:campaignId/launch` — xem
[campaign-launch.md §4](./campaign-launch.md#4-bước-1--tạo-launch-grant). `GET /launch` (bước 2) không
mang chữ ký nào cả — `code` mờ trong URL chính là credential (§9 của tài liệu đó).

### 2.3 Kênh RECOVERY — `PartnerRecoverySignatureV1`

```text
secret     :  rcv_demo_fedcba9876543210
timestamp  :  1786698753
method     :  GET
path       :  /api/recovery/orders?from=2026-08-10T00%3A00%3A00Z&to=2026-08-11T00%3A00%3A00Z
body       :  (rỗng)

signing string :  1786698753.GET./api/recovery/orders?from=2026-08-10T00%3A00%3A00Z&to=2026-08-11T00%3A00%3A00Z.

KẾT QUẢ    :  sha256=9b136e1a47b2b5232b085a081a3c3ee9bbcfc541a7a74b2abde919ee93d71b84
```

⚠️ **Chú ý dấu `.` cuối cùng** trong signing string. Thân rỗng nghĩa là **chuỗi rỗng nối vào sau dấu
chấm thứ ba**, **không phải** bỏ đoạn đó đi. Đây là lỗi hay gặp nhất khi dựng verify cho các lượt `GET`.

⚠️ **Chú ý `%3A` trong đường dẫn.** Signing string dùng đường dẫn **đúng như nó xuất hiện trên dòng
request** — giải mã `%3A` thành `:` trước khi ký sẽ ra chữ ký khác. Xem cảnh báo về reverse proxy ở
[recovery.md § Chúng tôi tự xác thực với bạn](./recovery.md).

### 2.4 Mã tổng đối soát

```text
tập eventId :  ["evt-1", "evt-2", "evt-3"]
thuật toán  :  loại trùng → sắp xếp tăng dần → nối bằng "\n" → sha256 → hex viết thường → tiền tố "v1:"
chuỗi băm   :  evt-1\nevt-2\nevt-3

KẾT QUẢ     :  v1:8d3f182a04c6d2bcb51a2e6f0201039af53aa777c6aa18236b3c6eae53083b44
```

### 2.5 Tự kiểm nhanh bằng shell

```bash
# Kênh EVENT (§2.1)
printf '%s.%s' 1786698753 '{"specversion":"1.0","eventId":"evt-88421","externalUserId":"12345","type":"ORDER_COMPLETED","occurredAt":"2026-08-14T09:12:33Z","confidence":"SERVER_OBSERVED","payload":{"orderId":"SO-99881","amountMinor":250000000,"currency":"VND"}}' \
  | openssl dgst -sha256 -hmac 'whsec_demo_0123456789abcdef' -r | cut -d' ' -f1

# Kênh LAUNCH (§2.2) — cùng khuôn EVENT, khác secret
printf '%s.%s' 1786701000 '{"externalUserId":"ext-user-000001"}' \
  | openssl dgst -sha256 -hmac 'launchsec_demo_0123456789abcdef' -r | cut -d' ' -f1

# mã tổng đối soát (§2.4)
printf 'evt-1\nevt-2\nevt-3' | openssl dgst -sha256 -r | cut -d' ' -f1
```

---

## 3. Xoay khoá

Dẫn xuất khoá kênh mới từ cùng master và đúng version Creator-OS trả về; xem
[credential-derivation.md](./credential-derivation.md). Nhiều version **cùng hợp lệ** trong lúc xoay. Bạn đổi sang secret mới lúc nào cũng được, **không rớt
request nào** — đây không phải một lượt cutover theo lịch.

| Sự kiện | Bạn thấy |
|---|---|
| chúng tôi trả version `v` mới | khoá dẫn xuất bằng cả version cũ lẫn mới đều verify thành công |
| bạn chuyển sang secret mới | không có gì đổi phía chúng tôi |
| chúng tôi thu hồi secret cũ | có hiệu lực **NGAY LẬP TỨC**, không có ân hạn |

⚠️ **Thu hồi có hiệu lực ngay lập tức.** Máy chủ nào của bạn còn giữ secret cũ sẽ bắt đầu nhận `401`
ngay khi nó bị thu hồi. ⇒ Chuyển **mọi** máy chủ sang secret mới **trước khi** báo chúng tôi thu hồi
secret cũ.

⭐ Ở chiều ngược ([recovery.md § Chúng tôi tự xác thực với bạn](./recovery.md)), bạn chấp nhận **hai**
secret cùng hợp lệ một lúc và tra theo `X-Platform-Key-Id` — cùng cơ chế, đổi vai.

Điều này áp dụng độc lập theo từng kênh — xoay secret kênh EVENT không ảnh hưởng secret kênh LAUNCH, và
ngược lại.

---

## 4. Checklist trước khi lên thật

Tick hết mọi mục trước khi bật tích hợp này cho người dùng thật. Mục có 🔒 là bắt buộc về an toàn.

### 4.1 Kênh EVENT

**Ký và xác thực**

- [ ] Hàm ký của bạn cho ra **đúng** kết quả ở [§2.1](#21-kênh-event--eventingresssignaturev1) — có unit test khoá vector này
- [ ] Serialize **đúng một lần**: chuỗi bạn ký **chính là** chuỗi bạn gửi ([event-ingestion.md § Lỗi hay gặp nhất](./event-ingestion.md))
- [ ] 🔒 Secret ký nằm ở **máy chủ**, không phải ứng dụng di động, trình duyệt, hay kho mã nguồn
- [ ] 🔒 Secret kênh EVENT **khác** secret kênh LAUNCH — không dùng chung hàm ký
- [ ] Đồng hồ máy chủ đồng bộ NTP, lệch dưới 1 phút

**Đúng payload**

- [ ] `eventId` được sinh theo **sự việc kinh doanh**, không theo lần gọi HTTP — vector kiểm hợp chuẩn #2 ([event-ingestion.md §4](./event-ingestion.md#4-vector-kiểm-hợp-chuẩn--ba-lượt-bắn-theo-đúng-thứ-tự)) trả về `deduplicated: true`
- [ ] `orderId` là **chuỗi**, không phải số
- [ ] `occurredAt` là **lúc việc xảy ra**, không phải lúc bạn gửi
- [ ] `amountMinor` là **số nguyên ở đơn vị nhỏ nhất**, đi kèm `currency`
- [ ] Một đơn hàng qua nhiều trạng thái sinh ra **nhiều `eventId`**, dùng chung một `orderId`

**Vận hành**

- [ ] Bạn xử lý `429`: đọc `Retry-After`, **chờ rồi gửi lại nguyên văn**
- [ ] `RateLimit-Reset` được hiểu là **số giây**, không phải mốc epoch
- [ ] Có backoff luỹ thừa cho `5xx` và hết giờ mạng
- [ ] `422` **không** bị gửi lại mù — nó đi vào hàng chết hoặc báo cho người trực
- [ ] `deliveryId` được ghi lại mỗi lượt, kể cả lượt `422`
- [ ] Có cảnh báo khi tỉ lệ `401` tăng đột biến — dấu hiệu khoá bị thu hồi hoặc đồng hồ trôi

**Lên thật**

- [ ] Bộ kiểm hợp chuẩn **chiều VÀO đạt 7/7** ([§1.3](#13-mười-bốn-ca--hai-chiều-đo-hai-thứ-khác-nhau)) — đây là điều kiện lên thật
- [ ] Ba vector kiểm hợp chuẩn ([event-ingestion.md §4](./event-ingestion.md#4-vector-kiểm-hợp-chuẩn--ba-lượt-bắn-theo-đúng-thứ-tự)) đã chạy trên **sandbox** trước

### 4.2 Kênh LAUNCH

Xem checklist đầy đủ ở [campaign-launch.md §9](./campaign-launch.md#9-yêu-cầu-bảo-mật) — không lặp
lại ở đây.

### 4.3 Xuyên kênh

- [ ] `externalUserId` **chứng minh được** là cùng giá trị ở cả EVENT lẫn LAUNCH cho cùng một người
      dùng — kiểm với một người dùng thật, từ đầu tới cuối, không chỉ unit test
- [ ] Bạn đã tích hợp **cả hai** kênh, hoặc bạn cố ý chỉ chọn EVENT cho mục đích lưu vết/đối soát,
      hiểu rằng nó không sinh quyền lợi ([README.md](./README.md))
