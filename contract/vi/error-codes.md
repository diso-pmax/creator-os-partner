# Tra cứu mã lỗi

Bắt đầu từ: [README.md](./README.md). *(bản dịch của
[en/error-codes.md](../en/error-codes.md) — bản tiếng Anh là nguồn chốt, lệch thì bản tiếng Anh
thắng)*

Tra cứu hợp nhất cho mọi kênh. Mỗi tài liệu kênh trỏ về đây; trang này là nguồn sự thật duy nhất — nếu
một tài liệu kênh và trang này có ngày nào đó mâu thuẫn nhau, đó là một báo lỗi tài liệu đang chờ xảy
ra, hãy báo cho chúng tôi.

## Ngữ nghĩa HTTP chung

Mỗi mã trạng thái dưới đây có nghĩa **đúng một điều**, nhất quán, trên mọi endpoint của tích hợp này.
Bạn không bao giờ phải đoán xem `200` là "thành công thật" hay "thành công nhưng bỏ qua" — đọc ghi chú
riêng của từng kênh nếu có.

| Status | Nghĩa | Bạn làm gì |
|:--:|---|---|
| `200` | Đã nhận / bản trùng đã xử lý trước đó | dừng gửi lại |
| `400` | Request sai khuôn — sai hình dạng, JSON hỏng, tham số không hợp lệ | sửa request rồi gửi lại |
| `401` | Xác thực thất bại — sai khoá, sai chữ ký, hoặc timestamp hết hạn | kiểm credential và đồng hồ rồi gửi lại |
| `403` | Đã xác thực, nhưng không được phép cho hành động/tài nguyên này | sửa cấu hình, hoặc báo chúng tôi |
| `404` | Route không tồn tại | sửa URL |
| `409` | Xung đột — phát lại một định danh phải duy nhất mỗi lượt | sinh định danh mới rồi thử lại |
| `422` | Đúng khuôn, sai nghĩa nghiệp vụ | **đừng gửi lại mù** — đọc trường `code` |
| `429` | Vượt giới hạn tần suất | đọc `Retry-After`, chờ rồi gửi lại |
| `502` | Chúng tôi không hoàn tất được một bước phụ thuộc | báo chúng tôi |
| `503` | Lỗi cấu hình phía chúng tôi | báo chúng tôi |
| `5xx` (khác) | Lỗi nền tảng | gửi lại có backoff |

## Hình dạng thân response

🔴 **Không có MỘT hình dạng lỗi chung cho mọi mã trạng thái.** Hình dạng phụ thuộc vào **tầng nào** từ
chối request. Đừng viết một parser giả định `code` và `details` luôn có mặt.

**Lỗi nghiệp vụ (`422`, hầu hết `409`) — hình dạng bạn nên thiết kế parser theo:**

```jsonc
{
  "code": "event_id_conflict",
  "title": "event_id_conflict",
  "status": 422,
  "detail": "giải thích đọc được cho người",
  "details": { "deliveryId": "del_01J…", "...": "trường riêng của từng lỗi" }
}
```

`code` là định danh máy đọc ổn định (khớp các bảng dưới đây). `details` (số nhiều) là một object lồng
mang dữ liệu riêng của lỗi. `deliveryId` bên trong `details` **CÓ THỂ vắng mặt** — nó bị bỏ qua bất cứ
khi nào lượt ghi delivery-tracking của chúng tôi không hoàn tất kịp giờ, không phụ thuộc `code` nào
được ném ra; đừng coi việc nó vắng mặt tự nó là một lỗi.

**Lỗi xác thực (`401`) — một hình dạng khác, đơn giản hơn, KHÔNG có trường `code`:**

```jsonc
{ "statusCode": 401, "message": "giải thích đọc được cho người", "error": "Unauthorized" }
```

⚠️ Đừng tìm `code` hay `details` ở một `401` — chúng không có ở đó. Một `401` luôn có nghĩa là một
trong ba nguyên nhân giống nhau (sai khoá, sai chữ ký, timestamp hết hạn) bất kể kênh nào; văn bản
`message` không liệt kê cụ thể nguyên nhân nào.

**Lỗi validation request (`400`) — hình dạng thứ ba, dùng `errors` (số nhiều), KHÔNG phải `details`:**

```jsonc
{
  "status": 400,
  "title": "validation_error",
  "code": "validation_error",
  "detail": "specversion: Invalid enum value. Expected '1.0', received 'banana'",
  "errors": { "specversion": ["Invalid enum value. Expected '1.0', received 'banana'"] }
}
```

⚠️ **Trường này là `errors`, số nhiều, không phải `details`.** Hai trường này không thể thay thế cho
nhau và xuất hiện ở hai mã trạng thái khác nhau — một parser chỉ kiểm `details` sẽ âm thầm bỏ sót
thông tin validation của `400`.

## Kênh EVENT — `POST /api/v1/integrations/events`

Ngữ cảnh đầy đủ: [event-ingestion.md](./event-ingestion.md).

| Status | Khi nào | `deliveryId`? |
|:--:|---|:--:|
| `200` | đã nhận và lưu bền — **kể cả bản trùng** | ✅ |
| `400` | envelope sai khuôn: JSON hỏng, giá trị `specversion` **không hợp lệ**, hoặc thiếu trường envelope **bắt buộc** — bỏ qua `specversion` thì vẫn ổn, xem [event-ingestion.md §5](./event-ingestion.md#5-schema-request) | ✗ |
| `401` | sai khoá, sai chữ ký, hoặc timestamp hết hạn — một thông báo chung cho cả ba | ✗ |
| `404` | route không tồn tại | ✗ |
| `422` | đúng khuôn, sai nghĩa nghiệp vụ — xem các mã nghiệp vụ dưới đây | CÓ THỂ có mặt (trong `details`) |
| `429` | vượt giới hạn tần suất | — |

### Mã của gửi theo lô — `POST /api/v1/integrations/events/batch`

Bối cảnh đầy đủ: [event-ingestion.md §14](./event-ingestion.md#14-gửi-theo-lô). Từ chối cả yêu cầu dùng các dạng ở trên;
mỗi phần tử của một lô đã nhận được trả lời riêng, và `code` theo từng phần tử cũng lấy từ bảng này.

| Status | `code` | Khi nào | Bạn làm gì |
|:--:|---|---|---|
| `422` | `batch_not_enabled` | gửi theo lô chưa được bật cho khoá của bạn | nhờ chúng tôi bật — chưa xử lý gì |
| `413` | `batch_too_large` | nhiều sự kiện hơn hạn mỗi lô của bạn | tách lô (hạn nằm ở `details.maxEventsPerBatch`) |
| `413` | `payload_too_large` | thân yêu cầu lớn hơn hạn byte của bạn | tách lô (hạn nằm ở `details.maxBytes`) |
| `400` | `validation_error` | theo từng phần tử: phần tử này sai khuôn | sửa đúng phần tử đó và chỉ gửi lại nó |
| `500` | `internal_error` | theo từng phần tử: nền tảng lỗi khi xử lý phần tử này | gửi lại — khử trùng giữ cho việc này an toàn |

### Mã nghiệp vụ của `422`

| Bạn gửi | Mã | Bạn làm gì |
|---|---|---|
| một `type` ngoài danh mục đóng (vd `order`, `order.v2.created`) | `unknown_event_type` | đổi giá trị — lỗi liệt kê sẵn giá trị hợp lệ |
| `type: STREAK_REACHED` | `derived_event_not_accepted` | thôi gửi — chúng tôi tự suy ra |
| một `type` hợp lệ nhưng chưa đăng ký cho khoá của bạn | `event_type_not_registered` | báo chúng tôi — đây là lỗ cấu hình phía chúng tôi, payload của bạn đúng |
| một `eventId` đã dùng cho `type` **khác** | `event_id_conflict` | sinh id mới cho lượt này |
| `type: UI_ACTION` mà `payload` thiếu `actionKey` | `payload_field_missing` | bổ sung `actionKey` — lỗi nêu tên trường còn thiếu |
| một loại đơn hàng mà `payload` thiếu `orderId`, hoặc có `amountMinor` mà thiếu `currency` | `payload_field_missing` | bổ sung trường lỗi nêu tên |
| một loại đơn hàng mà `payload` mang `brandCode` **có mặt nhưng rỗng, toàn khoảng trắng, hay không phải chuỗi** | `payload_field_missing` | gửi một chuỗi dùng được *(không rỗng, không toàn khoảng trắng)*, hoặc bỏ hẳn `brandCode` — giá trị chỉ sai-khớp thì trả `200`, không phải lỗi này |
| `occurredAt` **cũ hơn** hạn trễ của bạn *(mặc định 30 ngày)* | `event_too_late` | gửi sớm hơn, hoặc báo chúng tôi nới hạn — **đừng** xê dịch `occurredAt`, xem [event-ingestion.md §5.4](./event-ingestion.md#54-occurredat--hai-cái-hạn) |
| `occurredAt` **vượt trước đồng hồ chúng tôi** quá hạn lệch của bạn *(mặc định 300 giây)* | `event_from_future` | sửa đồng hồ máy gửi — nới hạn này là chính bạn mất hàng rào |
| sự kiện `LINK_*` mà khoá của bạn chưa có nguồn quy kết đang hoạt động | `LINK_SOURCE_UNAVAILABLE` | liên hệ chúng tôi — đây là khoảng trống cấu hình phía chúng tôi, gói tin của bạn đúng |
| sự kiện `LINK_*` có phong bì hoặc `payload` không đạt hồ sơ chuyển đổi Program Link | `LINK_CONVERSION_INVALID` | sửa phong bì để `eventId`, `type`, `occurredAt` khớp với chuyển đổi nằm trong `payload` |

⭐ **Hai mã `occurredAt` là hai mã DUY NHẤT ở bảng này mà gửi lại có thể thoát.** Chúng chỉ áp cho sự
kiện mới hoàn toàn với chúng tôi — gửi lại một sự kiện chúng tôi đã nhận thì trả `200 deduplicated:
true`, dù muộn tới đâu. Mọi mã còn lại là thuộc tính của payload, gửi lại y nguyên thì đời nào cũng
nhận đúng câu trả lời đó, nên gửi lại mà không đổi gì là vô ích.

⚠️ Một `422` mang `code: invalid_occurred_at` nghĩa là cái mốc không phân giải được. Ca đó lẽ ra bạn
phải nhận `400` — mã này là lưới chặn cuối, đáng lẽ không tới được từ kênh này, nên nếu thấy nó thì
báo chúng tôi.

⚠️ **`400` và `422` có nghĩa khác nhau — đừng gộp chung.** `400` nghĩa là "sai khuôn, sửa hình dạng rồi
gửi lại"; `422` nghĩa là "đúng khuôn, sai nghĩa — đọc `code` để biết bên nào phải hành động." Coi một
`422` là `400` khiến bạn đi sửa một hình dạng vốn chưa từng sai, và bạn không bao giờ tìm ra nguyên
nhân thật.

## Kênh LAUNCH — `POST /api/v1/campaigns/:campaignId/launch`

Ngữ cảnh đầy đủ: [campaign-launch.md](./campaign-launch.md). Đây là kênh danh tính/session **hiện
hành** — xem [README.md § Thứ tự bắt buộc](./README.md#-thứ-tự-bắt-buộc-launch-trước-event-mới-có-ý-nghĩa).

| Status | Khi nào | có `code`? |
|:--:|---|:--:|
| `200` | Launch Grant đã tạo | — (trả `launchUrl`/`expiresAt`, không có trường `code`) |
| `400` | `validation_error` — thân sai khuôn (kể cả `segments` sai khuôn: một phần tử sai ⇒ từ chối cả lời gọi, chưa có vé); dùng trường `errors` số nhiều, xem hình dạng ở trên | ✅ |
| `401` | sai key, sai chữ ký, hoặc timestamp hết hạn — cùng hình dạng với `401` của mọi kênh khác (không có trường `code`) | ✗ |
| `404` | `CAMPAIGN_NOT_FOUND` — campaign không tồn tại, **hoặc** thuộc tenant khác với tích hợp của bạn (cố ý không phân biệt, cùng lý lẽ với mọi ca cross-tenant khác trong tích hợp này) | ✅ |
| `422` | `CAMPAIGN_NOT_LAUNCHABLE` — campaign tồn tại và là của bạn, nhưng hiện không `active` / ngoài cửa sổ hiển thị | ✅ |

### `GET /api/v1/launch?code=` — hướng tới WebView, không HMAC

| Status | Khi nào | có `code`? |
|:--:|---|:--:|
| `200` | tiêu thụ thành công, session đã establish, `302` redirect tới campaign | — |
| `401` | `INVALID_LAUNCH_CODE` — code không tồn tại, đã hết hạn, hoặc đã bị tiêu thụ; **một mã phủ cả ba nguyên nhân, cố ý** (xem [campaign-launch.md §8](./campaign-launch.md#8-mã-lỗi)) | ✅ |
| `403` | `feature_disabled` — chiến dịch có thưởng nhưng tính năng loyalty chưa bật cho đơn vị của bạn. Thân là JSON thô, không có trang: app của bạn tự dựng màn. Đừng thử lại, hãy liên hệ chúng tôi | ✅ |

⚠️ **Đừng cố phân biệt "hết hạn" với "đã dùng" với "chưa từng tồn tại" trên response này.** Tách thành
các status riêng sẽ cho phép kẻ dò biết được lượt đoán nào gần đúng hơn — xem
[campaign-launch.md §8](./campaign-launch.md#8-mã-lỗi) để biết đầy đủ lý lẽ.

## Kênh RECOVERY — `POST /api/v1/integrations/reconciliation`

Ngữ cảnh đầy đủ: [recovery.md](./recovery.md).

| Response | Nghĩa |
|---|---|
| `200` + `windows: []` | nguồn **không thuộc về bạn**, **hoặc** không tồn tại — cố ý không phân biệt được |
| `400` | `to` không sau `from`, hoặc khoảng vượt quá 30 ngày một lượt |
| `401` | khoá, chữ ký, hoặc độ tươi — cùng thông báo như kênh EVENT |

Cho chiều **ngược lại** (chúng tôi gọi bạn): bạn tự chọn hình dạng HTTP của mình, nhưng ba câu trả lời
có thể có (không trả lời được / rỗng / danh sách kèm con trỏ) phải ánh xạ tương ứng thành
`401`/`403` (từ chối chúng tôi), một response rỗng thật (không có gì trong khoảng), và một danh sách
phân trang. Xem
[recovery.md §3.3](./recovery.md#33-ba-câu-trả-lời-phải-phân-biệt-được-với-nhau) — đừng tự chế mã mới
ở đây; dùng quy ước lỗi bình thường của API bạn.

## Kênh SETTLEMENT — chúng tôi gọi BẠN (`POST <địa chỉ nhận điểm của bạn>`)

Chiều này đảo ngược: **bạn** trả lời, và các mã dưới đây là cách **chúng tôi đọc câu trả lời của bạn**. Hợp đồng
đầy đủ: [settlement.md](./settlement.md).

| Bạn trả lời | Chúng tôi hiểu thế nào | Ops của chúng tôi gửi lại được? |
|:--:|---|:--:|
| `2xx` | đã nhận | — (dòng được đánh dấu là đã gửi) |
| `409` | bạn **đã thấy `deliveryNonce` này** — không dùng cho việc gì khác ([settlement.md §4](./settlement.md#4-chống-phát-lại--hai-nghĩa-vụ-không-phải-một)) | ở lần gửi đầu đó là một lần từ chối và ops gửi lại được bằng nonce mới; ở **Hỏi lại đối tác** nó khép dòng là đã gửi |
| `422` | bạn từ chối gói vì lý do nghiệp vụ | được |
| `400` · `401` · `403` · `404` · `5xx` · mã khác | gửi hỏng — *"mã trả lời ngoài hợp đồng"* | được, nhưng sửa nguyên nhân trước (`401`/`403`: khoá) |
| không trả lời trong 10 giây · lỗi kết nối | gửi hỏng | được |
| chuyển hướng `3xx` | gửi hỏng — chúng tôi không bao giờ đi theo chuyển hướng | được |

### Khi chúng tôi từ chối gửi (bạn không nhận gì)

Trước mọi lượt gọi sang bạn, thao tác **Gửi** của chúng tôi bị từ chối bằng `409` ở phía chúng tôi nếu không gọi
tên chính xác được người nhận. Bạn không thấy request nào; các mã này giải thích vì sao không có gì tới:

| Mã (trên màn ops của chúng tôi) | Nghĩa | Ai sửa |
|---|---|---|
| `settlement_item_partner_ref_missing` | chúng tôi không có `externalUserId` nào của bạn cho người chơi này (chưa launch hay gửi sự kiện dưới tích hợp này) | bạn — gửi launch hoặc sự kiện của người chơi trước; rồi ops gửi lại |
| `settlement_item_partner_ref_ambiguous` | có hơn một mã của bạn cho cùng một người chơi — chúng tôi không đoán | chúng tôi — xử lý định danh trùng, rồi gửi lại |
| `settlement_item_partner_namespace_unresolved` | tích hợp không có đúng một nhà cấp danh tính ở các nguồn sự kiện `DIRECT` | chúng tôi — sửa tích hợp, rồi gửi lại |

## Ghi chú xuyên kênh

- Một `401` ở **bất kỳ** kênh nào đều có nghĩa là một trong ba nguyên nhân giống nhau: sai khoá, sai
  chữ ký, hoặc đồng hồ lệch quá cửa sổ độ tươi. Nó không bao giờ có nghĩa "quy tắc nghiệp vụ cụ thể
  này thất bại" — điều đó luôn là một `4xx` khác `401` (`403`, `409`, `422`) kèm mã phân biệt.
- `deliveryId` (kênh EVENT) và `launchCode` (kênh LAUNCH) là hai khái niệm không liên quan dù đều là
  token mờ — đừng gộp chung chúng. Xem mục thuật ngữ của từng kênh.

## Mã xử lý bất đồng bộ — `processing[].errorCode`

Đây không phải mã HTTP. Cửa đã trả `200` rồi; mã xuất hiện sau đó trong câu trả lời của `POST /integrations/deliveries`
([event-ingestion.md §15](./event-ingestion.md#15-đọc-kết-quả-sau-200)) khi việc xử lý một sự kiện `POINT_REDEEMED` hỏng. Sau khi sửa nguyên nhân, gửi lại
sự kiện với `eventId` **mới**.

| `errorCode` | Nghĩa | Bạn sửa hay bạn đợi? |
|---|---|---|
| `external_payment_amount_missing` | sự kiện thiếu `amountMinor` (số nguyên, VND ×1) hoặc `currency` | **bạn sửa**: gửi đủ bốn trường; sự kiện cũ giữ trạng thái lỗi, nên hãy gửi bản đã sửa với `eventId` **mới** |
| `settlement_item_not_found` | `settlementItemId` không phải một dòng chúng tôi biết | **bạn sửa**: chép lại từ cột `Mã dòng` của bảng kê |
| `settlement_item_already_confirmed` | dòng đã được trả bằng một mã khác | **không bên nào**: dừng và đối chiếu với chúng tôi |
| `settlement_batch_not_confirmed` | đợt chưa được chốt bên chúng tôi | **bạn đợi**: gửi lại sau khi chúng tôi chốt đợt |
| `external_payment_amount_drifted` | số tiền lệch bảng kê | **cả hai bên**: dòng chờ ops của chúng tôi đối chiếu với bạn, rồi gửi lại số đã thống nhất |
| `processing_error` | mọi lỗi khác; chúng tôi không công bố mã | **bạn đợi**: chúng tôi tự thử lại; liên hệ chúng tôi nếu trạng thái thành `DEAD` |

