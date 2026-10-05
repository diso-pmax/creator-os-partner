# Bài kiểm HỢP CHUẨN — chạy trước khi tích hợp thật

> Dành cho **bên tích hợp**. Bạn chạy bộ này trên hệ thống của mình, xem mình đã thoả hợp đồng chưa,
> rồi mới onboard. Không cần đợi ai kiểm hộ.

## 🔴 BỘ NÀY KHÔNG ĐO ĐƯỢC VÒNG ĐỜI MỘT ĐƠN — đọc trước khi dùng nó để kiểm ví

Nó kiểm **hợp đồng của cửa vào**: gói tin đúng khuôn chưa, chữ ký đúng chưa, cửa từ chối đúng chưa.
Nó **không** kiểm *"đơn tạo rồi hoàn tất rồi huỷ thì ví chạy thế nào"*, và **không thể** kiểm — theo
thiết kế, không phải do thiếu sót:

| Chỗ | Nó làm gì | Hệ quả |
|---|---|---|
| `cases.ts:49` `goiTin()` | `externalUserId: conf-user-<uuid>` | **người chơi MỚI** mỗi gói tin |
| `cases.ts:55` | `payload.orderId: CONF-<uuid>` | **đơn MỚI** mỗi gói tin |
| `run.ts:201` | `loaiSuKien: CONF_EVENT_TYPE` | **MỘT loại** sự kiện mỗi lượt chạy |

Mỗi ca phải độc lập thì bộ kiểm hợp đồng mới đúng — và đó cũng là lý do mục *"Trỏ vào SANDBOX"* dưới
đây nói **không tiền thưởng nào bị động**: người dùng giả không khớp hồ sơ nào.

⚠️ **Dùng nó để đo vòng đời thì phải chạy BA LƯỢT với ba `CONF_EVENT_TYPE`, và mỗi lượt lại sinh một
`orderId` khác** ⇒ ba nhịp thành **ba đơn khác nhau**:

- lệnh huỷ **không có gì để đảo** ⇒ ví chỉ tăng, không bao giờ giảm
- nhìn từ ngoài đọc ra *"huỷ đơn mà vẫn cộng điểm"* — **một lỗi sản phẩm không hề tồn tại**

Đã xảy ra thật, hai lần. Cả hai lần đều tốn một vòng truy lỗi sản phẩm rồi mới lòi ra là công cụ
dùng sai việc.

### ⇒ Muốn đo vòng đời một đơn

Bắn từ chính hệ thống của bạn, không dùng bộ này:

1. Ba nhịp `ORDER_CREATED` → `ORDER_COMPLETED` → `ORDER_CANCELLED` trên **cùng một `orderId`** và
   **cùng một `externalUserId`** — mỗi nhịp một `eventId` riêng.
2. Chờ vài giây giữa hai nhịp cho hệ thống kịp chấm.
3. In `orderId` của cả ba lượt ra và nhìn: ba lượt, một chuỗi. Đổi mã giữa chừng thì lệnh huỷ không có
   đơn nào để đảo.
4. Đọc ví trên màn của người chơi — đó mới là thứ nghiệm thu hỏi tới, không phải mã `200` của cửa.

Khuôn `payload` của ba loại: hợp đồng, file `event-ingestion.md` §5.3.

## Chạy

```bash
CONF_API=https://api.example/api/v1 \
CONF_ACCESS_KEY=AK-cua-ban \
CONF_EVENT_SECRET=bi-mat-kenh-su-kien \
CONF_EVENT_TYPE=ORDER_COMPLETED \
CONF_RECOVERY_URL=https://he-thong-cua-ban/api/recovery \
CONF_RECOVERY_SECRET=bi-mat-kenh-phuc-hoi \
CONF_LAUNCH_SECRET=bi-mat-kenh-launch \
CONF_LAUNCH_CAMPAIGN_ID=camp-that-dang-active \
  npx tsx run.ts
```

🔑 **`CONF_LAUNCH_SECRET` và `CONF_LAUNCH_CAMPAIGN_ID` là BẮT BUỘC** — khác `CONF_RECOVERY_*`, LAUNCH
không có nhánh "để trống thì bỏ qua". Đây là kênh danh tính/session **hiện hành** (xem
`campaign-launch.md`), ngang hàng EVENT. `CONF_LAUNCH_CAMPAIGN_ID` phải là một campaign **thật**, đang
`active`, thuộc tenant của tích hợp bạn đang thử.

🔑 **`CONF_RECOVERY_SECRET` là bí mật KÊNH PHỤC HỒI** — thứ chúng tôi cấp riêng để **chúng tôi ký** khi
gọi sang bạn *(khuôn `PartnerRecoverySignatureV1`, hợp đồng §5.6)*. Đặt nó thì bảy ca chiều RA gửi kèm
ba tiêu đề `X-Platform-*`, tức bạn thử được **chính phép kiểm chữ ký** của mình. Để trống cũng chạy,
chỉ là không ký — dành cho lúc bạn đang dựng dở.

`CONF_RECOVERY_URL` **để trống được** — khi đó bảy ca chiều RA được khai **BỎ** *(không phải "đạt")*,
và bạn vẫn tích hợp bình thường ở hạng thấp hơn.

⚠️ **Đã dựng phép kiểm chữ ký mà KHÔNG đặt `CONF_RECOVERY_SECRET` thì bảy ca chiều RA sẽ trượt với
`401`** — và đó là bộ kiểm nói đúng: bạn vừa từ chối một lượt gọi không ký. Đặt bí mật vào rồi chạy lại.

Thoát `0` = đạt hết · `1` = có ca trượt · `2` = không chạy được *(thiếu cấu hình)*.

## ⚠️ Trỏ vào SANDBOX, đừng trỏ production

Tám ca chiều VÀO **bắn gói tin THẬT** vào cửa sự kiện — mỗi lượt chạy gửi **8 gói tin** (**10** khi
`CONF_EVENT_TYPE` là loại đơn hàng — `IN-8` gửi thêm hai) vào hệ thống mà `CONF_API` trỏ tới. Không có tiền hay thưởng nào bị động *(người dùng giả không khớp hồ sơ
nào)*, nhưng đó vẫn là dữ liệu thật.

🔑 Mọi thứ bộ này tạo ra đều mang tiền tố **`conf-`** *(`eventId`, `externalUserId`)* nên lọc và dọn
được. Cứ chạy lại bao nhiêu lần cũng an toàn về mặt đúng/sai — chỉ là tích rác.

### ⚠️ Trừ MỘT trường hợp: lượt chạy để MỞ CỬA cho tích hợp thật của bạn

Lời khuyên trên dành cho lúc bạn **tự thử**. Lượt chạy mà Diso dùng làm **điều kiện vào cửa** thì
**bắt buộc** trỏ vào chính hệ thống thật, và không có đường vòng:

Kết quả hợp chuẩn được đóng dấu **kèm cấu hình mà nó đã kiểm** — khoá, tên miền, điểm cuối phục hồi,
bản đồ loại sự kiện. Lúc mở cửa, Diso so lại dấu đó với cấu hình đang chạy. Một lượt `PASS` chạy trên
môi trường khác *(khoá khác, cấu hình khác)* là `PASS` **của một cấu hình khác** ⇒ nó **không mở được**
cửa cho tích hợp thật của bạn.

✅ **Chạy lúc nguồn còn ở chế độ chưa mở van là an toàn** — gói tin được nhận và ghi lại, **không sinh
đồng điểm nào**. Đó chính là lý do bước này nằm **trước** lúc mở van chứ không phải sau.

⚠️ **Sau khi Diso báo đã mở van, khoá bạn dùng cho lượt kiểm sẽ được cho nghỉ** và Diso báo bạn **số
phiên bản mới** của kênh `EVENT`. Bạn tự dẫn xuất lại khoá theo số đó — Diso **không** gửi khoá.

## 15 ca bắt buộc — hai chiều, và chúng đo hai thứ khác hẳn nhau

| | Kiểm ai | Cấp hạng |
|---|---|---|
| **VÀO** *(8)* | cửa của **chúng tôi**, bằng khoá của **bạn** — tức bạn đã đăng ký đúng chưa | 🔴 **ĐIỀU KIỆN VÀO CỬA** — không đạt thì tích hợp **không được bật** |
| **RA** *(7)* | hệ thống của **bạn** — bạn trả lời được ba câu hỏi phục hồi chưa | cấp **hạng**; không đạt vẫn onboard |

### Chiều VÀO

| Mã | Ca | Mong đợi |
|---|---|---|
| `IN-1` | gói tin hợp lệ | `200` |
| `IN-2` | thiếu `eventId` | `400` — sai **khuôn** |
| `IN-3` | mốc thời gian sai kiểu | `400` |
| `IN-4` | `payload` thiếu trường bắt buộc | **`422`** — đúng khuôn, sai **nghĩa** |
| `IN-5` | gửi lại đúng gói tin cũ | `200` + `deduplicated: true`, **không** `409` |
| `IN-6` | chữ ký sai | `401` |
| `IN-7` | mốc thời gian quá cũ *(phát lại)* | `401` |
| `IN-8` | `brandCode` có mặt mà **rỗng** hoặc toàn khoảng trắng *(chỉ khi `CONF_EVENT_TYPE` là loại đơn hàng `ORDER_*`)* | **`422`** `payload_field_missing`, câu lỗi nêu đích danh `brandCode` |

🔴 **`IN-4` là ca đáng chú ý nhất.** `400` và `422` là **hai việc khác nhau** cho bạn: `400` nghĩa
*"sai khuôn, sửa gói tin rồi gửi lại"*; `422` nghĩa *"đúng khuôn, sai nghĩa nghiệp vụ — đọc `code` để biết
bên nào phải hành động"* (xem `error-codes.md` của bộ tài liệu đối tác). Chính `IN-8` là một ví
dụ: `422 payload_field_missing` ở đó là việc của bên gửi. Nhận nhầm `400` thì bạn đi sửa khuôn — thứ vốn đã
đúng — và không bao giờ tìm ra.

⚠️ **`IN-8` chỉ đo được với loại đơn hàng.** `brandCode` chỉ có nghĩa với `ORDER_*`. Thiếu nó thì đơn vẫn
hợp lệ (`200`); sai hoa thường cũng `200` — hai điều đó cửa không nói ra được, chúng chỉ lộ lúc nghiệm
thu trên ví. Còn **có mà rỗng** thì cả gói tin bị từ chối, và chỗ phải sửa là **gói tin của bạn**: gửi
một chuỗi dùng được, hoặc bỏ hẳn trường. Chạy với `CONF_EVENT_TYPE` không phải `ORDER_*` thì ca này ghi
**đạt — không áp dụng** và không gửi gì: bắn `ORDER_*` bằng một khoá chưa khai loại đó chỉ đo được
*"loại chưa khai"*, không đo được `brandCode`.

### Chiều RA

| Mã | Ca | Chứng minh năng lực |
|---|---|---|
| `OUT-1` | hỏi theo cửa sổ thời gian ⇒ trả danh sách sự kiện | `QUERY_WINDOW` |
| `OUT-2` | phân trang — `conTroTiep` có mặt, `null` khi hết | `QUERY_WINDOW` |
| `OUT-3` | hỏi một mã **không có thật** ⇒ trả rỗng, không lỗi | `REDELIVER_BY_ID` |
| `OUT-4` | gửi lại theo định danh ⇒ trả **đúng** sự việc đó | `REDELIVER_BY_ID` |
| `OUT-5` | hỏi hai lần cùng khoảng ⇒ **cùng** kết quả | `QUERY_WINDOW` |
| `OUT-6` | con trỏ bịa ⇒ **báo lỗi**, không âm thầm trả trang đầu | `QUERY_WINDOW` |
| `OUT-7` | hỏi **trạng thái vật gốc** ⇒ trả trạng thái *(hoặc `404`)* | `QUERY_RESOURCE` |

🔴 **`OUT-6` bắt lỗi im lặng nhất của phân trang.** Con trỏ sai mà bạn âm thầm trả trang đầu thì vòng
kéo lại của chúng tôi chạy **mãi trên cùng một trang** và không bao giờ kết thúc — mà mọi trang đều
trông hợp lệ, nên không bên nào thấy.

🔴 **`OUT-5` — hai lượt hỏi cùng khoảng phải ra cùng tập.** Đối soát chạy lặp theo lịch; cùng câu hỏi
ra hai câu trả lời khác nhau thì mọi kết luận *"thiếu cái nào"* là kết luận về một sổ đang trôi.

## Hạng của bạn suy ra thế nào

```
                 VAI          PHÁT HIỆN   LẤP LẠI ĐƯỢC
QUERY_WINDOW     phát hiện        ✅           ✅     ← ĐỌC nguồn sự thật; trả đủ nội dung
                                                        nên NỀN TẢNG tự lấp, KHÔNG phải "gửi lại"
QUERY_RESOURCE   phát hiện        ✅           ❌
REDELIVER_BY_ID  gửi lại          ❌           ✅     ← phải biết thiếu MÃ NÀO mới dùng được
```

⚠️ Cột *"lấp lại được"* nghĩa là **nền tảng lấp được**, không phải *"bạn có API gửi lại"*.
`QUERY_WINDOW` một mình đã đủ cả hai cột ⇒ một mình nó cho `FULL_RECOVERY`.

| | sửa được | KHÔNG sửa được |
|---|---|---|
| **phát hiện được** | `FULL_RECOVERY` | `INGEST_PLUS_DETECTION` |
| **KHÔNG phát hiện được** | `INGEST_PLUS_REPLAY` | `INGEST_ONLY` |

🔒 **Một năng lực được công nhận chỉ khi MỌI ca cấp nó đều đạt.** Một ca trượt là năng lực đó rớt —
không có ô *"gần đạt"*.

## 8 ca LAUNCH — chạy riêng, báo cáo riêng

`LAUNCH-1..8` kiểm kênh Campaign Launch (`campaign-launch.md`) — hai lượt gọi `POST
.../campaigns/:id/launch` + `GET /launch`. Khác VÀO/RA, chúng **không** đếm vào `15 ca bắt buộc` ở
trên và không ảnh hưởng cổng vào cửa `integration_conformance` — kết quả in ở một mục báo cáo riêng.

| Mã | Ca | Mong đợi |
|---|---|---|
| `LAUNCH-1` | campaign + externalUserId hợp lệ | `200` + `launchUrl` |
| `LAUNCH-2` | mở launchUrl thành công | tạo session |
| `LAUNCH-3` | dùng lại launchUrl lần 2 | bị từ chối |
| `LAUNCH-4` | launchUrl hết hạn | bị từ chối |
| `LAUNCH-5` | launch code không hợp lệ | bị từ chối |
| `LAUNCH-6` | campaign không cho phép tích hợp này | bị từ chối |
| `LAUNCH-7` | code của campaign A không mở được campaign B | bị từ chối |
| `LAUNCH-8` | externalUserId từ launch khớp session tạo ra | đúng người dùng |

⏱️ **`LAUNCH-4` chờ ~61 giây thật** (TTL của Launch Grant) — hết hạn/đã dùng/không tồn tại cố ý trả
cùng một mã lỗi (§9, `campaign-launch.md`), nên không có cách nào giả lập nhanh hơn ở hộp đen HTTP.

## 8 ca SETTLEMENT — chạy riêng, báo cáo riêng

`SETTLEMENT-1..8` kiểm **bộ nhận của bạn** (kênh `PartnerSettlementSignatureV1`, `settlement.md`): bộ kiểm đóng vai
nền tảng, ký và gọi vào `CONF_SETTLEMENT_URL`. Giống LAUNCH, trục này độc lập: không vào cổng vào cửa, không cấp hạng.

```bash
CONF_SETTLEMENT_URL=https://host-cua-ban.example/settlements CONF_SETTLEMENT_SECRET=... npx tsx run.ts
```

Không đặt `CONF_SETTLEMENT_URL` ⇒ các ca được báo là CHƯA CHẠY, không bao giờ là đạt. Có sẵn bộ nhận tham chiếu để chạy thử:
`node ../examples/node/settlement-receiver.mjs --self-test`. Bảng ca đầy đủ: `testing.md` §1.6.

Xoay khoá: đặt thêm `CONF_SETTLEMENT_PREVIOUS_SECRET` (secret cũ mà lượt xoay thay) để bộ kiểm chạy thêm ca `SETTLEMENT-9` — ký bằng
secret cũ dưới CÙNG `X-Platform-Key-Id`, mong `2xx`. Bộ nhận tham chiếu nhận nhiều secret: `SETTLEMENT_SECRETS=<mới>,<cũ>`.

## Kết quả của bạn KHÔNG tự vào sổ của chúng tôi

Bộ này **in ra**, nó không ghi. Hạng công bố chỉ đổi khi **chúng tôi** chạy lượt kiểm của mình, trỏ vào
hệ thống bạn, rồi ghi qua một cửa nội bộ có quyền và có dấu vết.

⚠️ Đây **không phải** sự thiếu tin tưởng — đó là điều làm cái hạng có nghĩa. Một cổng nghiệm thu tin
bằng chứng do chính bên được xét nộp thì không còn là cổng, và hạng lại thành lời khai.

⇒ Bạn dùng bộ này để **tự soi và sửa cho xong trước**; lượt của chúng tôi chỉ còn là xác nhận.

## Bạn KHÔNG phải dựng đúng API của chúng tôi

Chúng tôi chuẩn hoá **ba câu hỏi** và **nghĩa của câu trả lời**, không chuẩn hoá đường dẫn, hình dạng
HTTP, tên trường, hay cách bạn lưu bên trong. Có sẵn `GET /orders?from=…&to=…` thì dùng nó; chỉ có tệp
đối soát cuối ngày cũng được — phía chúng tôi có lớp chuyển đổi cho từng bên.

Bộ kiểm này gọi theo hình **mặc định**. Hệ thống bạn khác hình thì báo để chúng tôi cắm lớp chuyển đổi
tương ứng, và bộ kiểm chạy qua lớp đó.
