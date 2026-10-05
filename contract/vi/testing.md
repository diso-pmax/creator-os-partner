# Testing — Bộ kiểm hợp chuẩn, Vector kiểm thử, Xoay khoá, Checklist trước khi lên thật

Bắt đầu từ: [README.md](./README.md). *(bản dịch của
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
CONF_API=https://<host của môi trường thử chúng tôi đã cấp>/api/v1 \
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

8 ca chiều VÀO bắn **sự kiện thật** vào cửa sự kiện — mỗi lượt chạy gửi **8 sự kiện** (**10** khi `CONF_EVENT_TYPE`
là loại đơn hàng — `IN-8` gửi thêm hai) tới bất cứ đâu `CONF_API` trỏ tới. Không tiền hay điểm nào bị động (người dùng giả không khớp hồ sơ thật nào), nhưng
vẫn là dữ liệu thật.

⭐ Mọi thứ bộ kiểm tạo ra đều mang tiền tố **`conf-`** (`eventId`, `externalUserId`) nên lọc và dọn
được. Chạy lại bao nhiêu lần cũng an toàn về đúng/sai — chỉ tích thêm dữ liệu dùng-một-lần.

### 1.3 Mười lăm ca — hai chiều đo hai thứ khác nhau

| | Kiểm gì | Fail nghĩa là |
|---|---|---|
| **CHIỀU VÀO** *(8 ca)* | endpoint **của chúng tôi**, dùng khoá **của bạn** — tức bạn đã ký đúng, dùng đúng khuôn, đăng ký đúng chưa | ⚠️ **ĐIỀU KIỆN LÊN THẬT** — fail ca này nghĩa là tích hợp **không thể bật được** |
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
| `IN-8` | sự kiện đơn hàng có `brandCode` **có mặt nhưng rỗng hoặc toàn khoảng trắng** *(chỉ khi `CONF_EVENT_TYPE` là loại đơn hàng `ORDER_*`)* | **`422`** `payload_field_missing`, câu lỗi nêu đích danh `brandCode` |

⚠️ **`IN-4` là ca đáng chú ý nhất.** `400` và `422` là **hai việc khác nhau** với bạn: `400` nghĩa là
"sai khuôn, sửa rồi gửi lại"; `422` nghĩa là "đúng khuôn, sai nghĩa nghiệp vụ — đọc `code` để biết bên
nào phải hành động" (xem [error-codes.md](./error-codes.md)). Nhận nhầm cái này thành cái kia khiến bạn
đi sửa một hình dạng vốn chưa từng sai, và bạn **không bao giờ tìm ra nguyên nhân thật**.

⚠️ **`IN-8` chỉ đo được với loại đơn hàng.** `brandCode` chỉ có nghĩa với `ORDER_*`. Thiếu nó thì đơn vẫn
hợp lệ (`200`), sai hoa thường cũng `200` — cửa nhận không báo được cho bạn điều nào trong hai; cả hai
chỉ lộ lúc nghiệm thu trên ví. Còn `brandCode` **có mặt nhưng rỗng hoặc toàn khoảng trắng** thì cả sự
kiện bị từ chối, và thứ phải sửa là **sự kiện của bạn**: gửi một chuỗi dùng được, hoặc bỏ hẳn trường
([event-ingestion.md §5.3](./event-ingestion.md#53-payload--theo-từng-loại)). Chạy bộ kiểm với
`CONF_EVENT_TYPE` không phải loại đơn hàng thì ca này ghi **đạt — không áp dụng** và không gửi gì: bắn
`ORDER_*` bằng một khoá chưa khai loại đó chỉ đo được "loại chưa khai".

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

15 ca ở trên (§1.3) chỉ phủ EVENT và RECOVERY. **LAUNCH có 8 ca riêng**, cần thêm hai biến:

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

### 1.6 Kênh SETTLEMENT — 8 ca, chạy riêng

Nếu bạn nhận số điểm đã tất toán ([settlement.md](./settlement.md)), hãy kiểm **bộ nhận của bạn** theo cùng
cách. Bộ kiểm đóng vai nền tảng: nó ký `PartnerSettlementSignatureV1` và gọi vào địa chỉ bạn đưa. Nó không
động điểm của ai, không đụng số dư của ai — số tiền trong gói là số mẫu.

```bash
CONF_SETTLEMENT_URL=https://host-cua-ban.example/settlements \
CONF_SETTLEMENT_SECRET=<secret kênh SETTLEMENT của bạn> \
  npx tsx run.ts
```

| Biến | Bắt buộc | Ghi chú |
|---|:--:|---|
| `CONF_SETTLEMENT_URL` | để chạy trục này | vắng ⇒ các ca SETTLEMENT được báo là **chưa chạy** (không bao giờ là đạt) |
| `CONF_SETTLEMENT_SECRET` | ✅ khi đã đặt URL | hoặc đặt `CONF_MASTER_SECRET` để bộ kiểm tự dẫn xuất khoá SETTLEMENT (`CONF_SETTLEMENT_VERSION` chọn phiên bản, mặc định `1`) |
| `CONF_SETTLEMENT_KEY_ID` | không | gửi trong `X-Platform-Key-Id`; mặc định `conformance-settlement` |
| `CONF_SETTLEMENT_PREVIOUS_SECRET` | không | secret mà lượt xoay thay thế. Khi đặt, bộ kiểm thêm ca **thứ chín**, `SETTLEMENT-9` (bên dưới) |

| Ca | Kịch bản | Kỳ vọng |
|---|---|---|
| `SETTLEMENT-1` | gói hợp lệ | `2xx` |
| `SETTLEMENT-2` | cùng `deliveryNonce` lần nữa, ký lại mới | `409` |
| `SETTLEMENT-3` | "Hỏi lại": đúng yêu cầu đó, cùng nonce | `409` |
| `SETTLEMENT-4` | chữ ký sai | `401` (nhận cả `403`) |
| `SETTLEMENT-5` | timestamp cũ hơn 5 phút, ký đúng | `401` (nhận cả `403`) |
| `SETTLEMENT-6` | cùng `settlementItemId`, nonce mới | `2xx` — đừng chặn theo `settlementItemId` |
| `SETTLEMENT-7` | thời gian trả lời | trong 10 giây |
| `SETTLEMENT-8` | chuyển hướng | không trả `3xx`; khai địa chỉ cuối cùng |
| `SETTLEMENT-9` *(tuỳ chọn)* | ký bằng secret **cũ**, dưới **cùng** `X-Platform-Key-Id` | `2xx` — trong lúc xoay khoá, bộ nhận của bạn phải giữ CẢ HAI secret và thử mới trước |

`SETTLEMENT-9` chỉ chạy khi đặt `CONF_SETTLEMENT_PREVIOUS_SECRET`, nên tám ca trên vẫn là tám. Mã khoá không đổi giữa các phiên bản (xem [settlement.md §3](./settlement.md#3-chúng-tôi-tự-xác-thực-với-bạn--partnersettlementsignaturev1)), nên bộ nhận chỉ chọn một secret cho mỗi mã khoá sẽ rớt ca này.

`SETTLEMENT-3` quan trọng hơn vẻ ngoài: khi ops của chúng tôi bấm **Hỏi lại đối tác**, chúng tôi gửi lại đúng
gói đó với đúng nonce cũ và đọc `409` là "bạn đã nhận rồi". Trả lời khác ở đây có thể khiến chúng tôi gửi
một khoản đã tất toán hai lần.

**Có sẵn bộ nhận tham chiếu**: `examples/node/settlement-receiver.mjs`
(Node, không phụ thuộc, MIT). Nó đạt cả 8 ca, nhớ nonce trong tệp JSON qua các lần khởi động lại, và in
từng gói nhận được. Trong lúc xoay khoá hãy đưa nó cả hai secret, mới trước: `SETTLEMENT_SECRETS=<mới>,<cũ>`. Tự kiểm không cần mạng: `node examples/node/settlement-receiver.mjs --self-test`.

`SETTLEMENT-2` và `SETTLEMENT-3` đòi đúng **`409`** cho nonce lặp lại: nút "Hỏi lại đối tác" của chúng tôi đọc `409` là "đã nhận rồi". Trả `400`, `422` hay một `200` idempotent sẽ làm hai ca này trượt.

Sau reverse proxy, hãy kiểm chữ ký theo đúng đường dẫn và query như chúng tôi đã gửi; proxy viết lại đường dẫn sẽ biến mọi lượt gọi thành `401`.

⚠️ Kết quả SETTLEMENT in ở khối riêng và **không** nằm trong cổng lên-thật tự động ở §1.3. Tiến trình vẫn thoát khác 0 khi có ca SETTLEMENT trượt, nên hãy tính mã thoát đó trong CI của bạn.

### 1.7 Tự gửi thử một thông báo tất toán (chỉ ở sân sandbox)

Thay vì chờ ops của chúng tôi bấm **Gửi**, bạn có thể nhờ sân sandbox gửi **một thông báo tất toán mẫu** tới địa chỉ
bạn đã đưa ([settlement.md §2.0](./settlement.md)). Nó **chỉ tồn tại ở sân sandbox**: ở cụm khác route này
không có và trả `404`.

```bash
BODY='{}'
TS=$(date +%s)
SIG="sha256=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$EVENT_KEY" -r | cut -d' ' -f1)"
curl -sS -X POST "https://<host của môi trường thử chúng tôi đã cấp>/api/v1/integrations/settlement/test" \
  -H "Content-Type: application/json" -H "X-API-Key: $ACCESS_KEY" \
  -H "X-Timestamp: $TS" -H "X-Signature: $SIG" -d "$BODY"
```

Ký như một sự kiện, bằng khoá kênh **EVENT** của bạn ([event-ingestion.md §3](./event-ingestion.md#3-xác-thực)); thân là `{}`.
Bạn không truyền địa chỉ: chúng tôi gửi tới địa chỉ ops của chúng tôi đã khai cho tích hợp của bạn.

| Câu trả lời | Nghĩa |
|---|---|
| `{ "outcome": "SENT_OK", "httpStatus": 200, "code": "sent" }` | bộ nhận của bạn trả `2xx` |
| `PARTNER_REJECTED` · `partner_rejected` | bộ nhận trả `409` hoặc `422`. Ở lần gửi thử đầu nó phải trả `2xx` |
| `SEND_FAILED_HTTP` · `partner_unexpected_status` | mã khác. Chỉ `2xx` là "đã nhận" |
| `SEND_FAILED_TIMEOUT` · `partner_unreachable` | không trả lời trong 10 giây, lỗi kết nối, hoặc chuyển hướng |
| `NOT_CONFIGURED` · `not_ready_integration` · `not_ready_endpoint` · `not_ready_key` · `not_ready_namespace` | tích hợp chưa sẵn sàng gửi điểm: nhờ ops của chúng tôi hoàn tất địa chỉ và khoá |
| `429` | quá 6 lượt gửi thử trong một phút: chờ theo `Retry-After` |

Gói mẫu trông thế nào: cùng gói như [settlement.md §2.1](./settlement.md#21-thân-request), ký bằng khoá SETTLEMENT của bạn,
mã đợt bắt đầu bằng **`SANDBOX-`**, `externalUserId` là `sandbox-user` và một mệnh giá không tồn tại. **Đây không phải
dòng thật: đừng ghi nó vào sổ của bạn.** Nó không mở đợt nào ở phía chúng tôi và không đổi số dư của ai.

Việc cần kiểm ở phía bạn: lần gửi thử đầu được trả `2xx`; cùng một `deliveryNonce` lặp lại thì trả `409` (các ca ở §1.6 kiểm
việc này); chữ ký được kiểm trên thân thô.

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

# Kênh SETTLEMENT (§2.6) — method và đường dẫn cũng được ký
printf '%s.POST.%s.%s' 1786698753 '/hooks/settlement?src=bank-a' '{"settlementRef":"SR-2026-09-camp-01","settlementItemId":"5b0d8e7a-3c41-4f6a-9b52-7a1e0c9d2f64","partyId":"0b8a6f2e-1d34-4c57-8e90-a3b5c7d9e1f2","externalUserId":"12345","denominationCode":"PTS","pointAmount":"100","exchangeRateSnapshot":"10","moneyAmount":"1000","moneyCurrency":"VND","deliveryNonce":"9c1f4a7e-52b8-4d03-a6e9-0f3b8d2c7a15"}' \
  | openssl dgst -sha256 -hmac 'stl_demo_0123456789abcdef' -r | cut -d' ' -f1
```

### 2.6 Kênh SETTLEMENT — `PartnerSettlementSignatureV1`

Chúng tôi gọi **bạn**, nên đây là chữ ký bạn **kiểm**. Cùng dạng với RECOVERY (§2.3) — method và đường dẫn
nằm trong chuỗi ký — nhưng có thân, và dùng secret SETTLEMENT.

```text
secret     :  stl_demo_0123456789abcdef
timestamp  :  1786698753
method     :  POST
path       :  /hooks/settlement?src=bank-a
body       :  {"settlementRef":"SR-2026-09-camp-01","settlementItemId":"5b0d8e7a-3c41-4f6a-9b52-7a1e0c9d2f64","partyId":"0b8a6f2e-1d34-4c57-8e90-a3b5c7d9e1f2","externalUserId":"12345","denominationCode":"PTS","pointAmount":"100","exchangeRateSnapshot":"10","moneyAmount":"1000","moneyCurrency":"VND","deliveryNonce":"9c1f4a7e-52b8-4d03-a6e9-0f3b8d2c7a15"}
             (341 bytes, KHÔNG có xuống dòng cuối)

signing string :  1786698753.POST./hooks/settlement?src=bank-a.{"settlementRef":"SR-2026-09-camp-01",…}

RESULT     :  sha256=8ddc17d7f9971d337114de47b256c2bacd0c1bd333ca0b566eb3569927f1c67b
```

⚠️ **Query string là một phần của đường dẫn được ký** — `?src=bank-a` nằm trong chuỗi ký. Kiểm theo đường dẫn
và query đúng như trên dòng request. ⚠️ **Thân được ký ở dạng byte thô**, gồm cả `externalUserId` và
`deliveryNonce`; đừng parse rồi serialize lại trước khi kiểm.

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

⭐ Chiều ngược ([recovery.md](./recovery.md), [settlement.md](./settlement.md)) **không** cùng cơ chế.
`X-Platform-Key-Id` giữ nguyên qua các phiên bản, và chúng tôi ký bằng khoá **mới** ngay khi một lượt xoay hoàn tất. Hãy
dẫn xuất và nạp phiên bản mới **trước** khi nó hoàn tất (luôn là phiên bản hiện tại cộng một), chấp nhận cả hai secret và
thử mới trước, và chuẩn bị cho một cửa sổ `401` ngắn nếu bạn nạp trễ.

Điều này áp dụng độc lập theo từng kênh — xoay secret kênh EVENT không ảnh hưởng secret kênh LAUNCH, và
ngược lại.

---

## 4. Checklist trước khi lên thật

Checklist lên thật nay nằm ở một nơi: **[go-live.md](./go-live.md)**. Nó gồm EVENT, LAUNCH, web view, SETTLEMENT,
khép vòng và sổ tay xử lý sự cố.
