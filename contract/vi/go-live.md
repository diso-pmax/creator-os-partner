# Lên thật — checklist và sổ tay xử lý sự cố

Bắt đầu từ: [README.md](./README.md). Đây là checklist lên thật **duy nhất** và là trang để mở khi có gì hỏng
sau khi chạy thật. [testing.md](./testing.md) nói cách kiểm; trang này nói khi nào bạn xong và phải làm gì khi nó hỏng.

## Phần A — Checklist trước khi có người dùng thật

Tick hết mọi mục trước khi bật tích hợp này cho người dùng thật. Mục có 🔒 là bắt buộc về an toàn.

### A.1 Kênh EVENT

**Ký và xác thực**

- [ ] Hàm ký của bạn cho ra **đúng** kết quả ở [testing.md §2.1](./testing.md#21-kênh-event--eventingresssignaturev1) — có unit test khoá vector này
- [ ] Serialize **đúng một lần**: chuỗi bạn ký **chính là** chuỗi bạn gửi ([event-ingestion.md § Lỗi hay gặp nhất](./event-ingestion.md))
- [ ] 🔒 Secret ký nằm ở **máy chủ**, không phải ứng dụng di động, trình duyệt, hay kho mã nguồn
- [ ] 🔒 Secret kênh EVENT **khác** secret kênh LAUNCH — không dùng chung hàm ký
- [ ] Đồng hồ máy chủ đồng bộ NTP, lệch dưới 1 phút

**Đúng payload**

- [ ] `eventId` được sinh theo **sự việc kinh doanh**, không theo lần gọi HTTP — vector kiểm hợp chuẩn #2 ([event-ingestion.md §4](./event-ingestion.md#4-vector-kiểm-hợp-chuẩn--ba-lượt-bắn-theo-đúng-thứ-tự)) trả về `deduplicated: true`
- [ ] `orderId` là **chuỗi**, không phải số
- [ ] `occurredAt` là **lúc việc xảy ra**, không phải lúc bạn gửi
- [ ] Bạn biết hai hạn `occurredAt` của mình — hạn trễ và hạn lệch tương lai — và độ trễ giao hàng **tệ nhất** của bạn (hàng đợi dồn, lô chạy đêm, một lần sự cố đã từng xảy ra thật) vẫn nằm trong hạn trễ ([event-ingestion.md §5.4](./event-ingestion.md#54-occurredat--hai-cái-hạn))
- [ ] 🔒 Một `422 event_too_late` hay `event_from_future` **không bao giờ** khiến code của bạn cấp `eventId` mới rồi gửi lại — làm vậy là biến một sự kiện trễ thành hai sự kiện kinh tế
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

- [ ] Bộ kiểm hợp chuẩn **chiều VÀO đạt 8/8** ([testing.md §1.3](./testing.md#13-mười-lăm-ca--hai-chiều-đo-hai-thứ-khác-nhau)) — đây là điều kiện lên thật
- [ ] Ba vector kiểm hợp chuẩn ([event-ingestion.md §4](./event-ingestion.md#4-vector-kiểm-hợp-chuẩn--ba-lượt-bắn-theo-đúng-thứ-tự)) đã chạy trên **sandbox** trước

### A.2 Kênh LAUNCH

Xem checklist đầy đủ ở [campaign-launch.md §9](./campaign-launch.md#9-yêu-cầu-bảo-mật) — không lặp
lại ở đây.

### A.3 Xuyên kênh

- [ ] `externalUserId` **chứng minh được** là cùng giá trị ở cả EVENT lẫn LAUNCH cho cùng một người
      dùng — kiểm với một người dùng thật, từ đầu tới cuối, không chỉ unit test
- [ ] Bạn đã tích hợp **cả hai** kênh, hoặc bạn cố ý chỉ chọn EVENT cho mục đích lưu vết/đối soát,
      hiểu rằng nó không sinh quyền lợi ([README.md](./README.md))

### A.4 Web view

- [ ] Web view mở `launchUrl` nguyên văn và giữ cookie phiên đặt trên `302` ([webview.md](./webview.md))
- [ ] Người chơi luôn có đường ra: đã xử lý `close_native_webview`
- [ ] Sau 8 giờ, hoặc khi gặp `401 INVALID_LAUNCH_CODE`, máy chủ của bạn tạo `launchUrl` mới
- [ ] Web view không có trang nào cho `403 feature_disabled` (JSON thô): app của bạn dựng màn cho trường hợp này

### A.5 Kênh SETTLEMENT *(chỉ khi bạn nhận tất toán điểm)*

- [ ] 🔒 Bộ nhận của bạn kiểm `PartnerSettlementSignatureV1` trên thân **thô**, trong ±5 phút ([settlement.md](./settlement.md))
- [ ] 🔒 Bộ nhận từ chối `deliveryNonce` đã thấy bằng **`409`**, và nhớ nonce qua các lần khởi động lại
- [ ] Khoá khử trùng là `deliveryNonce`, không bao giờ là `settlementItemId`
- [ ] Các ca SETTLEMENT của bộ kiểm hợp chuẩn đạt **8/8** với bộ nhận của bạn (xem testing.md)
- [ ] Bạn trả lời trong 10 giây và không bao giờ bằng chuyển hướng; địa chỉ đã khai là địa chỉ cuối cùng
- [ ] 🔒 Secret SETTLEMENT khác mọi secret kênh khác và chỉ nằm ở máy chủ nhận

### A.6 Khép vòng

- [ ] Với mỗi dòng đã tất toán mà bạn đã chi, bạn gửi cho chúng tôi một sự kiện `POINT_REDEEMED` để dòng đó đóng được
- [ ] Bạn đã nhờ chúng tôi mở `POINT_REDEEMED` cho nguồn sự kiện của bạn; chưa mở thì sự kiện bị trả `422 event_type_not_registered` (khoảng trống cấu hình phía chúng tôi). Thử với một dòng trên sandbox trước
- [ ] Bạn đối chiếu được từng `settlementItemId` nhận được với bản ghi chi trả của chính bạn

## Phần B — Khi có gì hỏng

Hai quy tắc trước: **không bao giờ dán secret** (`masterSecret` hay khoá kênh) vào phiếu, chat hay email, và
**không bao giờ gửi lại `422` một cách mù quáng**.

### B.1 Tất toán không tới, hoặc tới rồi lỗi

| Bạn thấy | Nguyên nhân thường gặp | Làm gì |
|---|---|---|
| không có gì tới điểm cuối của bạn | phía chúng tôi chưa khai địa chỉ, hoặc ops chưa bấm Gửi | hỏi đầu mối của bạn xem địa chỉ đã khai và đợt đã chốt chưa |
| bạn trả `401` cho chúng tôi | sai secret cho `X-Platform-Key-Id` đó, đồng hồ lệch (±5 phút), hoặc proxy viết lại đường dẫn | kiểm theo đường dẫn đúng như đã gửi, kiểm NTP; chúng tôi không gửi lại khi `401` |
| bạn trả `5xx` hoặc hết giờ | phía bạn sập hoặc chậm (>10 giây) | sửa rồi báo chúng tôi: ops gửi lại dòng đó với nonce **mới**. Trước khi xử lý một gói, kiểm sổ của bạn theo `settlementItemId`: nếu đã trả dòng đó rồi thì đừng trả lại, báo chúng tôi để ghi nhận bằng `POINT_REDEEMED` |
| bạn trả `409` cho một lượt **lặp** (ops của chúng tôi bấm "Hỏi lại đối tác": cùng gói, cùng nonce) | bạn đã nhận rồi | không cần làm gì, chúng tôi ghi dòng là đã nhận |
| bạn trả `409` hoặc `422` cho lượt gửi **đầu** | với lượt gửi thường chúng tôi ghi là "đối tác từ chối" | trả `2xx` cho lượt đầu; nếu kho nonce của bạn tự va chạm thì sửa và báo chúng tôi, ops gửi lại với nonce mới |
| bạn trả mã không phải `2xx`, cũng không phải `409`/`422` | mọi mã khác bị coi là "ngoài hợp đồng" | trả `2xx`, hoặc `409` cho lượt lặp |

### B.2 Số tiền có vẻ sai

Các số trong một gói (`pointAmount`, `exchangeRateSnapshot`, `moneyAmount`) bị đóng băng khi đợt được lập và không
bao giờ tính lại. **Đừng** tính lại ở phía bạn. Gửi đầu mối của bạn `settlementItemId` và `deliveryNonce` đã nhận,
cùng hai con số của bạn.

### B.3 Bạn cần đổi địa chỉ nhận tất toán

Nhờ đầu mối đổi giúp; nó có hiệu lực cho lượt gửi **kế tiếp**. Dòng đã gửi không được gửi lại sang địa chỉ mới.
Giữ bộ nhận cũ chạy cho tới khi đầu mối xác nhận đã đổi.

### B.4 Secret có thể đã lộ (kể cả `masterSecret`)

Coi cả bộ là đã lộ, kể cả khi nó chỉ đi qua chat, phiếu hay log.

1. Nhờ chúng tôi **cấp lại cả bộ** (một `masterSecret` mới). Hai bộ cùng dùng được trong khoảng chồng lấn bạn thoả thuận với chúng tôi.
2. Dẫn xuất khoá kênh mới và triển khai lên mọi máy chủ ký hoặc kiểm.
3. Khi máy chủ của bạn đã dùng bộ mới, nhờ chúng tôi **thu hồi bộ cũ**. Xem [credential-derivation.md](./credential-derivation.md).
4. Chạy lại bộ kiểm hợp chuẩn, và nếu có nguồn chưa mở thưởng thì chạy lại trước khi mở.
5. Không bao giờ ghi secret cũ hay mới vào phiếu: mô tả tình huống, chúng tôi sẽ không hỏi giá trị.

### B.5 Liên hệ ai

Dùng đầu mối mà đợt onboarding đã giao cho bạn. Luôn kèm: `accessKey` của bạn (không bao giờ là secret), thời điểm
sự cố theo UTC, `deliveryId` / `settlementItemId` liên quan, và những gì bạn đã gửi và nhận.
