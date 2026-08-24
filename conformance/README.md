# Bài kiểm HỢP CHUẨN — chạy trước khi tích hợp thật

> Dành cho **bên tích hợp**. Bạn chạy bộ này trên hệ thống của mình, xem mình đã thoả hợp đồng chưa,
> rồi mới onboard. Không cần đợi ai kiểm hộ.

## Chạy

```bash
CONF_API=https://api.example/api/v1 \
CONF_ACCESS_KEY=AK-cua-ban \
CONF_EVENT_SECRET=bi-mat-kenh-su-kien \
CONF_EVENT_TYPE=ORDER_COMPLETED \
CONF_RECOVERY_URL=https://he-thong-cua-ban/api/recovery \
CONF_RECOVERY_SECRET=bi-mat-kenh-phuc-hoi \
  npx tsx run.ts
```

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

Bảy ca chiều VÀO **bắn gói tin THẬT** vào cửa sự kiện — mỗi lượt chạy để lại **7–8 sự kiện** trong hệ
thống mà `CONF_API` trỏ tới. Không có tiền hay thưởng nào bị động *(người dùng giả không khớp hồ sơ
nào)*, nhưng đó vẫn là dữ liệu thật.

🔑 Mọi thứ bộ này tạo ra đều mang tiền tố **`conf-`** *(`eventId`, `externalUserId`)* nên lọc và dọn
được. Cứ chạy lại bao nhiêu lần cũng an toàn về mặt đúng/sai — chỉ là tích rác.

## 14 ca bắt buộc — hai chiều, và chúng đo hai thứ khác hẳn nhau

| | Kiểm ai | Cấp hạng |
|---|---|---|
| **VÀO** *(7)* | cửa của **chúng tôi**, bằng khoá của **bạn** — tức bạn đã đăng ký đúng chưa | 🔴 **ĐIỀU KIỆN VÀO CỬA** — không đạt thì tích hợp **không được bật** |
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

🔴 **`IN-4` là ca đáng chú ý nhất.** `400` và `422` là **hai việc khác nhau** cho bạn: `400` nghĩa
*"sửa gói tin của anh"*, `422` nghĩa *"gói tin đúng, thứ phải sửa là cấu hình phía chúng tôi"*. Nhận
nhầm `400` thì bạn đi sửa khuôn — thứ vốn đã đúng — và không bao giờ tìm ra.

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
