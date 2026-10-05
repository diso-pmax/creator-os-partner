# Changelog

*(bản dịch của [en/changelog.md](../en/changelog.md) — bản tiếng Anh là nguồn chốt, lệch thì bản tiếng
Anh thắng)*

Mỗi mục mang tên **bản phát hành sản phẩm** chứa nó — đúng thẻ mà image bản cài của bạn mang, ví dụ
`v1.0.3`. Tìm thẻ bản cài của bạn đang chạy và đọc mục cùng tên ở đây; khi nâng bản, đọc mọi mục nằm giữa
bản bạn đang chạy và bản bạn nâng lên. Từ `v1.0.7` trở đi, kho này có thẻ cùng tên. Không cần bảng tra.

Mục nào tả **hành vi của cửa nhận** thì nằm dưới bản đầu tiên **có hành vi đó** — hành vi có thể ra trước
tài liệu. Mục nào chỉ sửa chữ trong tài liệu thì nằm dưới bản đầu tiên mang câu chữ đã sửa. Bản nào
**không có mục ở đây thì không đổi hợp đồng**: nó mang đúng hợp đồng của mục ngay dưới nó. Thay đổi hợp
đồng chưa vào bản phát hành nào thì nằm dưới **Chưa phát hành**.

Mỗi mục giữ số hợp đồng cũ *(`1.0` … `1.6.0`)* làm đề mục con, nên ai đã trích *"hợp đồng 1.4.0"* vẫn
tìm ra.

| Ký hiệu | Nghĩa | Chúng tôi làm gì |
|---|---|---|
| 🔴 **PHÁ VỠ** | bản cài đang chạy có thể hỏng | **báo trước**, có thời gian chuyển đổi |
| 🟡 **ĐỔI NGHĨA** | không hỏng mã, nhưng câu trả lời khác đi | báo trước |
| 🟢 **CỘNG THÊM** | thuần thêm, mã đang chạy không phải sửa | phát hành luôn |

## Chưa phát hành

Không đổi.

## v1.2.0-rc.1 — 2026-10-06

🟢 **Mới: tự gửi thử một thông báo tất toán (chỉ ở sân sandbox).** `POST /api/v1/integrations/settlement/test`, ký như một sự
kiện bằng khoá EVENT của bạn với thân `{}`, nhờ sân sandbox gửi **một** thông báo tất toán **mẫu** tới địa chỉ ops của chúng tôi
đã khai cho tích hợp của bạn, và trả `{ outcome, httpStatus, code }`. Gói mẫu có mã đợt bắt đầu `SANDBOX-` và không phải dòng
thật. Chỉ có ở sân sandbox (nơi khác `404`); tối đa 6 lượt mỗi phút. Chi tiết:
[testing.md §1.7](./testing.md#17-tự-gửi-thử-một-thông-báo-tất-toán-chỉ-ở-sân-sandbox).

🟢 **Mới: bộ nhận settlement và bộ kiểm hợp chuẩn xử lý được lượt xoay khoá.** `examples/node/settlement-receiver.mjs` nay nhận
NHIỀU secret cho một mã khoá và thử mới trước (`SETTLEMENT_SECRETS=<mới>,<cũ>`, hoặc một danh sách cho mỗi mã khoá trong
`SETTLEMENT_SECRETS_JSON`), vì `X-Platform-Key-Id` giữ nguyên qua các phiên bản. Bộ kiểm thêm ca thứ chín tuỳ chọn, `SETTLEMENT-9`,
chạy khi bạn đặt `CONF_SETTLEMENT_PREVIOUS_SECRET`. Chi tiết: [testing.md §1.6](./testing.md#16-kênh-settlement--8-ca-chạy-riêng).

🟡 **Đính chính: xoay khoá khi CHÚNG TÔI là bên ký (RECOVERY và SETTLEMENT).** Bản tài liệu trước viết `X-Platform-Key-Id` cho bạn biết
secret nào trong hai cái đã ký và xoay khoá không bao giờ làm gián đoạn các lượt gọi này. Khoá dẫn xuất không chạy như vậy:
`X-Platform-Key-Id` **giống nhau ở mọi phiên bản**, và ngay khi một lượt xoay xong chúng tôi ký bằng khoá **mới**. Hãy dẫn xuất và nạp
phiên bản mới **trước** khi lượt xoay hoàn tất (luôn là phiên bản hiện tại cộng một), chấp nhận cả hai secret và thử mới trước; bộ nhận
nạp trễ sẽ thấy `401` trong một lúc ngắn, và lượt gửi lặp lại được. Mã verify tham khảo ở [settlement.md](./settlement.md#3-chúng-tôi-tự-xác-thực-với-bạn--partnersettlementsignaturev1)
và [recovery.md](./recovery.md#4-chúng-tôi-tự-xác-thực-với-bạn--partnerrecoverysignaturev1) nay nhận một danh sách secret.

🔴 **PHÁ VỠ — bảng kê (`.xlsx`): có một cột được chèn vào.** Bảng kê tất toán chúng tôi giao bạn có thêm
**`Mã người chơi (đối tác)`** (`externalUserId` của bạn cho người chơi) làm **cột 4**, ngay sau `Mã người chơi`. Mọi
cột sau nó dịch sang phải một ô. Nếu bạn đọc file **theo vị trí**, hãy cập nhật bộ đọc; nếu bạn đọc theo tiêu đề thì
không có gì đổi. Thứ tự trước → sau:

| Trước (10 cột) | Sau (11 cột) |
|---|---|
| 1 Mã đợt · 2 Mã dòng · 3 Mã người chơi · 4 Mệnh giá điểm · 5 Số điểm · 6 Tỷ giá đã đóng dấu · 7 Thành tiền · 8 Đơn vị tiền · 9 Trạng thái dòng · 10 Lý do loại | 1 Mã đợt · 2 Mã dòng · 3 Mã người chơi · **4 Mã người chơi (đối tác)** · 5 Mệnh giá điểm · 6 Số điểm · 7 Tỷ giá đã đóng dấu · 8 Thành tiền · 9 Đơn vị tiền · 10 Trạng thái dòng · 11 Lý do loại |

Ô để trống khi chúng tôi không đọc được chính xác mã của bạn (trạng thái dòng nói vì sao). Chi tiết: [settlement.md §6](./settlement.md#bảng-kê-xlsx).

🟢 **Mới: tài liệu tất toán điểm (lần công khai đầu tiên).** [settlement.md](./settlement.md) mô tả cách chúng tôi báo địa chỉ
của bạn khi một khoản điểm đã chốt: thân request nay mang **`externalUserId`** (mã của bạn cho người chơi; nó nằm trong thân
được ký), các mã trả lời chúng tôi xử lý (`2xx` đã nhận · `409` / `422` từ chối · còn lại là gửi hỏng), **`409` là bắt buộc cho
`deliveryNonce` lặp** (và cho không việc gì khác), khác biệt giữa **Gửi / Gửi lại** (nonce mới) và **Hỏi lại đối tác** (cùng nonce),
và việc **báo lại bằng `POINT_REDEEMED` cho mọi dòng bạn đã trả**. Khoá kênh SETTLEMENT nay có trong
[credential-derivation.md](./credential-derivation.md) kèm vector, và chữ ký có vector kiểm thử ở
[testing.md §2.6](./testing.md#26-kênh-settlement--partnersettlementsignaturev1). Hành vi truyền dây của `EVENT` và `LAUNCH` không đổi.

🟢 **Mới: `external_payment_amount_missing` trong `processing[].errorCode`.** Sự kiện `POINT_REDEEMED` thiếu `amountMinor`
(số nguyên, VND ×1) hoặc `currency` vẫn được cửa nhận `200`, nhưng sau đó luôn thất bại. Nay bạn đọc được đúng lý do đó qua
`POST /integrations/deliveries` thay vì `processing_error` chung: gửi đủ bốn trường rồi gửi lại với `eventId` mới.
Chi tiết: [error-codes.md](./error-codes.md#mã-xử-lý-bất-đồng-bộ--processingerrorcode).

🟡 **Đổi nghĩa: `externalUserId` khi launch không được chứa ký tự điều khiển.** Giá trị có NUL từng làm lượt launch lỗi `500`; các ký tự điều khiển khác
(tab, xuống dòng, DEL…) từng được nhận. Nay tất cả bị từ chối ngay bằng `400 validation_error` và không tạo launch nào. Mã thường, mã có dấu và mã có dấu cách
bên trong không bị ảnh hưởng. Chi tiết: [campaign-launch.md §4.1](./campaign-launch.md#41-request).

🟢 **Mới: tự kiểm bộ nhận tất toán của bạn.** Bộ kiểm hợp chuẩn có thêm tám ca `SETTLEMENT-*` (phát lại `409`,
"Hỏi lại" `409`, chữ ký sai, timestamp cũ, nonce mới cho cùng một dòng, thời gian trả lời, không chuyển hướng),
và kho công khai có thêm một bộ nhận tham chiếu không phụ thuộc, `examples/node/settlement-receiver.mjs`.
Hợp đồng tất toán không đổi. Chi tiết: [testing.md §1.6](./testing.md#16-kênh-settlement--8-ca-chạy-riêng).

- 🟢 **CỘNG THÊM — Program Link 1.0:** [guide kỹ thuật](program-link.md) về tracking, guest checkout, LINK_ORDER_* FULL_STATE, SKU mapping, ký EVENT, retry/ACK và gap recovery. Làm rõ LAUNCH/externalUserId subject chỉ áp legacy Reward; buyer ID Link tuỳ chọn, không là CTV hưởng. Không hứa endpoint intake Link riêng hoặc public partner status/payout API.

🟢 **Mới: đọc kết quả sau `200`.** `POST /integrations/deliveries` nay trả thêm danh sách `processing`: với `POINT_REDEEMED`, đã ghi sổ chưa, và
**mã lỗi** khi hỏng (`settlement_item_not_found`, `settlement_batch_not_confirmed`, `settlement_item_already_confirmed`,
`external_payment_amount_drifted`). Trước đây bạn chỉ thấy cái `200` của cửa. Chính cửa tra được ghi tài liệu lần đầu ở đây. Chi tiết:
[event-ingestion.md §15](./event-ingestion.md#15-đọc-kết-quả-sau-200) · [error-codes.md](./error-codes.md#mã-xử-lý-bất-đồng-bộ--processingerrorcode).

🟢 **Mới: đặc tả máy đọc và bộ request làm sẵn.** `openapi.yaml` (OpenAPI 3.1) và một JSON Schema cho mỗi thân yêu cầu,
sinh ra từ chính bộ kiểm hợp lệ mà máy chủ chạy; một bộ Bruno và một bộ Postman tự ký mọi request; bảng mã lỗi nay liệt
kê mọi mã mà các cửa có thể trả (dòng mới: `feature_disabled`, `LINK_SOURCE_UNAVAILABLE`, `LINK_CONVERSION_INVALID`,
`batch_not_enabled`, `batch_too_large`, `payload_too_large`, `internal_error`). Hành vi trên dây không đổi. Chi tiết:
[README.md](./README.md#đặc-tả-máy-đọc) · [error-codes.md](./error-codes.md).

🟢 **Lần đầu được ghi: `displayName` khi launch, cửa tra biên nhận, web view.** Launch nhận `displayName` tuỳ chọn (chỉ là gợi ý,
[campaign-launch.md §4.1](./campaign-launch.md#41-request)). Cửa tra biên nhận `POST /integrations/deliveries` có trong
`openapi.yaml`. Cách nhúng web view (cookie, cầu nối native) nằm ở [webview.md](./webview.md).

🟡 **Ghi lại: cửa gửi một sự kiện từ chối thân lớn hơn 100 KB** bằng `413 payload_too_large` dạng JSON, và `400 invalid_json` cho
JSON hỏng. Cổng đã cư xử như vậy từ trước. Chi tiết: [event-ingestion.md §10b](./event-ingestion.md#10b-trần-kích-thước-thân-request).

🟡 **Đổi câu chữ: `actionKey` là định danh chuẩn do nền tảng định nghĩa.** Bảng ví dụ cũ đã bỏ; đọc giá trị hiện hành của
chiến dịch bạn trên console hoặc hỏi đầu mối. Chi tiết: [event-ingestion.md §5](./event-ingestion.md#5-schema-request).

🟢 **Checklist lên thật đã chuyển chỗ.** Checklist trước khi lên thật từng nằm ở `testing.md` mục 4 nay là [go-live.md](./go-live.md),
kèm các mục tất toán, web view và một sổ tay xử lý sự cố. `testing.md` giữ một dòng trỏ sang đó.

🟢 **Mới: gửi theo lô, `POST /integrations/events/batch`.** Gửi N sự kiện trong một lượt gọi và nhận câu trả lời theo
từng sự kiện. Mặc định TẮT theo từng tích hợp — hãy nhờ chúng tôi bật cho khoá của bạn. Không gì về từng sự kiện thay đổi.
Lần đầu nói rõ: ba định danh ở ba cấp (`eventId` · `deliveryId` · `batchId`), `accepted` không có nghĩa là đã cấp quyền
lợi, và thứ tự mảng không phải thứ tự thời gian. *Delivery* nay được định nghĩa là biên nhận của chúng tôi cho một sự kiện, không còn là một lượt gọi HTTP. Chi tiết:
[event-ingestion.md §6](./event-ingestion.md#6-eventid-deliveryid-batchid--ba-định-danh-ba-cấp) ·
[§14](./event-ingestion.md#14-gửi-theo-lô).

## v1.1.0 — 2026-09-14

🟡 **Endpoint recovery nay bắt buộc là HTTPS công khai.** Địa chỉ `http://`, hoặc máy trong mạng riêng/
loopback/link-local, đều bị từ chối. Chi tiết: [recovery.md](./recovery.md).

🟢 **Bộ kiểm hợp chuẩn: thêm một ca, nói rõ một luật.** Ca mới `IN-8` kiểm rằng sự kiện đơn hàng mang
`brandCode` rỗng bị từ chối — khớp đúng hành vi cửa nhận đã có sẵn, bạn không cần sửa gì. Cũng nói rõ:
`ORDER_CANCELLED` phải mang cùng `orderId` với đơn nó huỷ. Chi tiết:
[testing.md §1.3](./testing.md#13-mười-lăm-ca--hai-chiều-đo-hai-thứ-khác-nhau) ·
[event-ingestion.md §5.3](./event-ingestion.md#53-payload--theo-từng-loại).

🔴 **Hai quyền lợi mới cho đơn tại brand tài trợ.** Một quyền lợi tính đơn đầu tiên của người chơi tại
một brand tài trợ; quyền lợi kia tính đơn trải trên nhiều brand tài trợ khác nhau. Cả hai đọc field
`brandCode` trên sự kiện `ORDER_*` — chiến dịch nào của bạn dùng brand tài trợ thì nhớ gửi field này.
Chi tiết: [event-ingestion.md §5.3](./event-ingestion.md#53-payload--theo-từng-loại).

## v1.0.7 — 2026-09-11

### Số hiệu hợp đồng nay theo bản phát hành sản phẩm

🟡 **Hợp đồng không còn số hiệu riêng.** Mỗi mục của changelog này nay mang tên bản phát hành sản phẩm
chứa nó — đúng thẻ mà image bản cài của bạn mang.

- Các số cũ `1.0` … `1.6.0` để nguyên làm đề mục con, nên chỗ nào đã trích số cũ vẫn tìm về đây. Từ
  nay hãy trích tên thẻ bản phát hành.
- Bản nào không có mục ở đây thì không đổi hợp đồng.
- **Kho này bắt đầu từ `v1.0.7`.** Các bản trước không có thẻ ở kho này — các mục bên dưới ghi lại mỗi bản
  mang gì. Thẻ `v1.0.0` cũ của kho này không còn nữa; nếu bạn đã ghim nó, hãy ghim một thẻ bản phát hành.

Mục này không đổi giao thức, trường, endpoint hay khuôn ký nào.

## v1.0.6 — gồm 1.6.0

### 1.6.0 — 2026-09-11

🔴 **`brandCode` trên sự kiện `ORDER_*` — một đơn thuộc brand tài trợ nào.**

Một số chiến dịch chỉ tính đơn thuộc danh sách brand tài trợ của chính chiến dịch đó. Đơn được tính cho
quyền lợi đó chỉ khi `brandCode` của nó **khớp CHÍNH XÁC** *(phân biệt hoa/thường, so chuỗi thô)* một trong
các mã brand chiến dịch đã khai — bên chúng tôi định nghĩa các mã đó *(ví dụ `SHOPEE`, `LAZADA`)*, bạn gửi
đúng chuỗi đó.

⚠️ **Mục này ghi lại một yêu cầu đã áp dụng sẵn, KHÔNG phải một cửa kiểm mới ở gateway.** `brandCode`
**không bắt buộc ở cổng** — đơn thiếu nó vẫn hợp lệ và vẫn trả `200`, chỉ là không được tính cho quyền lợi
gắn brand, và không có lỗi nào báo. Nếu chiến dịch nào của bạn trao quyền lợi cho đơn tại brand tài trợ cụ
thể, hãy bắt đầu gửi `brandCode` ngay — lặp lại ở **mọi** nhịp của đơn, kể cả `ORDER_CANCELLED`, đó là
luật an toàn cho mọi loại.

⚠️ **Với quyền lợi gắn brand thì đây là bắt buộc, không chỉ là an toàn:** `ORDER_CANCELLED` thiếu
`brandCode` không khớp được với quyền lợi đó, nên phần đơn đã được tính **không bị đảo lại**.

- `event-ingestion.md` [§5.3](./event-ingestion.md#53-payload--theo-từng-loại) — thêm `brandCode` vào
  payload `ORDER_*`: luật khớp chính xác, việc nó không bắt buộc ở cổng nhưng bị bỏ đếm lặng lẽ khi sai
  hoặc thiếu, và luật "gửi ở mọi nhịp" cho huỷ đơn.
- **Ngoại lệ duy nhất của "không có lỗi nào báo":** một `brandCode` **có mặt nhưng rỗng, toàn khoảng
  trắng, hay không phải chuỗi** bị từ chối `422 payload_field_missing`. Bỏ trống thì không sao; gửi một
  giá trị hỏng thì có.

## v1.0.3 — gồm 1.4.0

### 1.4.0 — 2026-09-06

🔴 **ĐỔI GIÁ TRỊ `actionKey` — có phá tương thích, hai bên phải đổi cùng lúc.**

`actionKey` của hành vi *"người dùng click vào một brand trên ứng dụng đối tác"* đổi từ
**`BRAND_CLICK`** sang **`brand`**.

- `event-ingestion.md` §5.3 — ví dụ payload và bảng mã hành vi nay ghi `brand`.
- Vẫn **phân biệt hoa/thường, so chuỗi thô**: `brand` ≠ `Brand` ≠ `BRAND`.

⚠️ **Vì sao phải nói rõ là PHÁ TƯƠNG THÍCH.** Gửi mã cũ sau khi hai bên đã đổi thì cửa **vẫn trả
`200`** — gói tin đúng khuôn nên vẫn được nhận, nhưng **không được tính cho ai**. Không `422`, không
cảnh báo, chỉ là **không ai được điểm**. Nên tích hợp của bạn và cấu hình chiến dịch phải đổi **cùng
một lúc**, và kiểm bằng cách bấm thử một brand rồi soi ví, chứ đừng trông vào mã lỗi.

📌 **Nâng bản cài lên `v1.0.3` không đổi giá trị nào được tính.** `actionKey` nào được tính là do cấu
hình chiến dịch đặt, không nằm sẵn trong bản phát hành. Nó đổi khi chiến dịch được cấu hình lại — đổi
phía bạn đúng lúc đó, đừng đợi lúc nâng bản cài.

📌 Mục 1.3.2 công bố `BRAND_CLICK`; mục đó **giữ nguyên** như một ghi chép lịch sử.

## v1.0.2 — gồm 1.5.0

### 1.5.0 — 2026-09-06

🔴 **`occurredAt` nay có hai cái hạn. Lệch khỏi một trong hai là `422`.**

| Mã | Khi nào | Hạn mặc định |
|---|---|:--:|
| `event_too_late` | `occurredAt` **cũ hơn** hạn trễ của bạn | **30 ngày** |
| `event_from_future` | `occurredAt` **vượt trước đồng hồ chúng tôi** quá hạn lệch của bạn | **300 giây** |

⚠️ **Mục này là tài liệu chạy theo sau thay đổi, không phải thông báo trước.** Cửa nhận đã áp cả hai
hạn rồi. Kiểm mốc thời gian của bạn ngay bây giờ, đừng đợi tới lần phát hành sau — và nếu tích hợp của
bạn có nạp lại lịch sử thì kiểm **trước** lượt chạy kế tiếp.

- `event-ingestion.md` [§5.4](./event-ingestion.md#54-occurredat--hai-cái-hạn) — mục mới: hai cái hạn,
  quy ước biên *(đúng bằng hạn thì vẫn nhận)*, cách khai riêng theo từng tích hợp, và vì sao
  `event_from_future` phải sửa ở đồng hồ của bạn chứ không phải bằng cách nới hạn.
- `error-codes.md` — thêm hai mã vào bảng nghiệp vụ `422`, kèm điểm DUY NHẤT tách chúng khỏi mọi mã
  còn lại ở đó: **gửi lại có thể thoát.**
- `testing.md` §4.1 — thêm hai dòng checklist: biết hai hạn của mình, và không bao giờ trả lời một
  `422` bằng cách cấp `eventId` mới.

⭐ **Không có gì đổi với lượt gửi lại một sự kiện chúng tôi đã nhận.** Hai hạn chỉ áp cho sự kiện mới
hoàn toàn với chúng tôi, nên hàng đợi xả ra sau một tuần sự cố vẫn trả `200 deduplicated: true`. Nếu
bạn vốn đã xử lý `422` theo hướng "không gửi lại, không cấp id mới" thì bạn không phải sửa gì.

📌 Trước đây chưa có hạn riêng theo đối tác, nên tới khi chúng tôi đặt cho bạn thì bạn dùng mặc định ở
bảng trên. Báo chúng tôi độ trễ tệ nhất của bạn để chúng tôi đặt đúng — đó mới là con số hợp đồng này
nên dựa vào, không phải một con số đoán.

## v1.0.1-release-05-09-26

### Trạng thái và kỳ chiến dịch quyết định sự kiện đã nhận có được tính — 2026-09-04

🟡 **Ở cửa nhận không có gì đổi, nhưng sự kiện đã nhận có thể không còn được tính.** Sự kiện vẫn được
nhận với `200`, không có mã lỗi mới. Chỉ là nó **không được tính** khi chiến dịch:

- đang tạm dừng, đã lưu trữ, chưa mở, hoặc đã quá hạn đóng;
- với chiến dịch có áp kỳ hợp lệ — nằm ngoài kỳ đó.

Sau khi chiến dịch kết thúc, nó vẫn tính sự kiện thêm một thời gian ân hạn — nhưng chỉ sự kiện có
`occurredAt` **nằm trong kỳ chiến dịch**, và chỉ khi được **xử lý trước hạn ân hạn**. Đơn xảy ra sau khi
kỳ chiến dịch đã hết thì không bao giờ được tính, dù bạn gửi sớm tới đâu. Sự kiện trễ nên gửi càng sớm
càng tốt, đừng để sát hạn: hạn được so lúc chúng tôi xử lý sự kiện — sau khi đã trả `200` — chứ không
phải lúc nó tới cửa.

Huỷ đơn được miễn: `ORDER_CANCELLED` vẫn đảo phần đơn đó đã được tính, kể cả khi chiến dịch đã đóng.

Trước bản này hợp đồng chưa ghi điều trên. Kiểm bằng cách soi ví, đừng trông vào mã lỗi — cùng luật với
`actionKey` và `brandCode`.

## v1.0.0-demo — gồm 1.0 · 1.1 · 1.2 · 1.3 · 1.3.1 · 1.3.2

### 1.3.2 — 2026-08-29

`event-ingestion.md` §5.3 nói `UI_ACTION` có **hình dạng payload mở**. Câu đó SAI: cửa nhận luôn đòi
`actionKey` cho `UI_ACTION` và từ chối sự kiện thiếu nó. **Không đổi giao thức, chỉ đổi tài liệu** —
nhưng nếu bạn đã code theo bản cũ thì kiểm lại payload `UI_ACTION` của mình.

- `event-ingestion.md` §5.3 — `actionKey` nay ghi rõ là **BẮT BUỘC** với `UI_ACTION`, kèm giá trị cụ
  thể phải gửi. Nó **phân biệt hoa/thường và so chuỗi thô**: sai hoa thường vẫn trả `200`, và quyền
  lợi **âm thầm không bao giờ được tính**.
- **`BRAND_CLICK`** — `actionKey` của hành vi "người dùng click vào một brand trên ứng dụng đối tác".
  Các giá trị này do chúng tôi đặt, bạn gửi nguyên văn.
- `error-codes.md` — thêm `payload_field_missing` vào bảng mã nghiệp vụ của `422`. Mã này cửa nhận có
  trả, mà không tài liệu nào liệt kê.

### 1.3.1 — 2026-08-27

Mục 1.3 công bố mô hình `masterSecret` ở `README` và `changelog`, nhưng **hai tài liệu bạn thật sự
code theo** thì chưa đổi: `event-ingestion.md` và `campaign-launch.md` vẫn còn ví dụ dùng một bí mật
rời (`whsec_…`) và không trỏ sang [credential-derivation.md](./credential-derivation.md). Đợt này vá
đúng chỗ đó — **không đổi giao thức, chỉ đổi tài liệu**.

- `event-ingestion.md` · `campaign-launch.md` — ví dụ nay **dẫn xuất khoá kênh từ `masterSecret`**,
  cả bản `bash` lẫn `node`. Bỏ mọi ví dụ dùng bí mật rời.
- `campaign-launch.md` §2 — nói thẳng: **chúng tôi KHÔNG phát riêng "LAUNCH Secret Key"**. Khoá
  LAUNCH khác khoá EVENT vì chuỗi `info` khác, không phải vì có hai bí mật được gửi.
- `credential-derivation.md` — thêm đoạn **đối chiếu vector trong 10 giây**, đoạn lấy khoá cho từng
  kênh, và bảng **bốn lỗi tích hợp hay gặp** *(giải nhầm `channelKey` · nhầm base64 với base64url ·
  `CHANNEL` viết thường · nhầm `I`/`l`/`1` khi chép tay)*. Cả bốn đều ra **cùng một `401`**.
- `README.md` — sửa câu *"mỗi kênh một secret riêng"* thành *"mỗi kênh một khoá riêng, **do bạn dẫn
  xuất**"*, và nói rõ host của môi trường là thứ chúng tôi báo khi bàn giao.
- `testing.md` + bộ kiểm hợp chuẩn — nhận **`CONF_MASTER_SECRET`** và tự dẫn xuất khoá từng kênh.
  Thêm `CONF_*_VERSION` *(mặc định `1`)*. Vẫn nhận `CONF_*_SECRET` rời cho tích hợp chưa cấp lại
  credential; khai tường minh thì rời **thắng**. Bộ kiểm nay **in ra nguồn của từng khoá** ở dòng
  đầu — đọc dòng đó loại được hai nguyên nhân mà mã `401` không phân biệt.

### 1.3 — 2026-08-26

- Đối tác nay giữ một `masterSecret` và dẫn xuất khoá riêng từng kênh theo
  [`IntegrationCredentialDerivationV1`](./credential-derivation.md).
- Xoay từng kênh công bố tường minh version mới; version cũ và mới chồng lấn tới lúc thu hồi.
- Thêm vector HKDF máy đọc được, dùng chung với bộ test backend Creator-OS.

### 1.2 — 2026-08-25

**Đã gỡ bỏ kênh AUTH.** Chưa partner nào từng tích hợp nó trong production, nên việc này chi phí
migration = 0. `identity-transfer.md` đã bị xóa; mọi cross-reference tới nó trong bộ tài liệu này đã
được gỡ hoặc viết lại để mô tả LAUNCH.

- [README.md](./README.md), [error-codes.md](./error-codes.md), [testing.md](./testing.md),
  [event-ingestion.md](./event-ingestion.md) — mọi mục/dòng riêng cho AUTH đã bị gỡ.
- Access Key nay đi cùng **ba** Secret Key (EVENT, LAUNCH, RECOVERY), không phải bốn.
- `IdentityHandoffSignatureV1` không còn tồn tại như một khuôn ký đang sống — xem `1.1` bên dưới để
  biết bối cảnh lịch sử lúc AUTH còn hoạt động.

### 1.1 — 2026-08-25

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

### 1.0 — 2026-08-25

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
