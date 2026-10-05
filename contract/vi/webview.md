# Nhúng web view — cookie, cầu nối native, phiên

Bắt đầu từ: [README.md](./README.md). Trang này dành cho người dựng **ứng dụng** chứa web view của chúng
tôi. Phần phía máy chủ của việc launch nằm ở [campaign-launch.md](./campaign-launch.md).

## 1. Mở `launchUrl` đúng nguyên văn

Máy chủ của bạn gọi `POST /campaigns/:campaignId/launch` và nhận `launchUrl`
([campaign-launch.md §4.2](./campaign-launch.md#42-response)). Đưa chuỗi đó cho web view **không sửa**:

- không thêm, bớt hay đổi thứ tự tham số query, không mã hoá lại;
- không mở trong tab trình duyệt trong app hay trình duyệt ngoài: cookie phiên phải rơi đúng vào web
  view sẽ hiển thị trò chơi;
- mở **ngay**: URL có hiệu lực 60 giây và dùng **một lần**. Lần mở thứ hai nhận
  `401 INVALID_LAUNCH_CODE`, cố ý là cùng một câu trả lời với "hết hạn" và "chưa từng tồn tại".

`launchUrl` nằm ở **host cổng thưởng** của chúng tôi, không phải host API mà máy chủ bạn vừa gọi. Đó là
cố ý, xem quy tắc cookie bên dưới.

## 2. Web view phải giữ cookie được đặt trên lượt chuyển hướng

Mở `launchUrl` trả `302` và đặt cookie phiên ngay trên phản hồi đó:

```http
HTTP/1.1 302 Found
Location: https://<reward-portal>/
Set-Cookie: __Host-player_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800
```

Điều đó đòi hỏi gì ở app của bạn:

| Yêu cầu | Vì sao |
|---|---|
| Nhận và **lưu cookie đến trên phản hồi `302`** | phiên chỉ tồn tại nhờ `Set-Cookie` đó; web view bỏ cookie ở lượt chuyển hướng sẽ hiện màn hình chưa đăng nhập |
| Để **chính web view tự đi theo** lượt chuyển hướng | đừng chặn `302` rồi gửi lại yêu cầu từ mã native: cookie sẽ đặt nhầm vào client khác |
| Dùng **cùng một web view / cùng kho cookie** trong suốt phiên chơi | cookie thuộc về host cổng thưởng và không dùng chung được với host nào khác (tiền tố `__Host-` cấm thuộc tính `Domain`) |
| Chỉ HTTPS | cookie có `Secure` |
| Đừng chép cookie đi nơi khác | nó là `HttpOnly`, trang của bạn và mã native không có việc đọc nó |

Trên một bản dựng phát triển chạy HTTP thường, cookie tên `player_session`, không có tiền tố `__Host-` và không có `Secure`; môi trường thật luôn dùng HTTPS và tên có tiền tố.

Cookie sống **8 giờ** và không được gia hạn. Hết hạn thì tạo `launchUrl` mới và mở lại, người chơi không
phải làm gì.

### iOS (WKWebView) và Android (WebView)

Cả hai nền tảng không cần gì đặc biệt, chỉ cần cookie không bị tắt:

- **iOS**: dùng `WKWebView` thường với kho dữ liệu web mặc định, bền vững. Kho tạm (không bền) mất cookie
  khi web view bị huỷ, và app dựng lại web view giữa chừng sẽ trông như chưa đăng nhập.
- **Android**: để bật cookie cho web view (`CookieManager.getInstance().setAcceptCookie(true)`, cũng là
  mặc định). Cookie là bên thứ nhất của host cổng thưởng, không cần cài đặt cookie bên thứ ba.

Nếu màn hình mở được nhưng hiện trạng thái chưa đăng nhập, nguyên nhân hay gặp là cookie bị bỏ ở `302`.
Thử bằng bộ Bruno hoặc Postman trước (request *Create a launch URL*), rồi mới thử bằng web view thật.

## 3. Khi mở URL bị lỗi

Mở `launchUrl` có thể lỗi theo hai cách:

| Câu trả lời | Nghĩa là | Làm gì |
|---|---|---|
| `401 INVALID_LAUNCH_CODE` | hết hạn, đã dùng, hoặc chưa từng tồn tại: một mã chung cho cả ba, xem [campaign-launch.md §8](./campaign-launch.md#8-mã-lỗi) | tạo `launchUrl` **mới** và mở ngay |
| `403 feature_disabled` | chiến dịch có thưởng nhưng tính năng loyalty chưa bật cho đơn vị của bạn | đừng thử lại; liên hệ chúng tôi |

Không có trang lỗi HTML nào được định nghĩa cho cả hai: thân là JSON thô. Nếu muốn màn thay thế thân thiện, hãy
dựng nó trong app của bạn quanh các mã trạng thái đó.

## 4. Cầu nối native (web view → app, app → web view)

Trang web của chúng tôi nói chuyện với app chứa nó qua một cầu nối nhỏ. Bạn hiện thực phía nhận.

**Web → app.** Trang gửi một **chuỗi JSON** `{"type": "<tên>"}`:

| Nền tảng | Trang gửi bằng | Bạn đăng ký |
|---|---|---|
| iOS | `window.webkit.messageHandlers.jsMessageHandler.postMessage(<chuỗi json>)` | một `WKScriptMessageHandler` tên **`jsMessageHandler`** |
| Android | `JSBridge.sendMessage(<chuỗi json>)` | một JavaScript interface tên **`JSBridge`** có hàm `sendMessage(String)` |

Nếu không có cái nào (ví dụ trang được mở trong trình duyệt thường) thì trang không làm gì, không lỗi.

| `type` | Nghĩa là | App làm gì |
|---|---|---|
| `close_native_webview` | người chơi xong và xin thoát | đóng web view và quay về màn của bạn |
| `get_user_token` | trang xin app một token người dùng | có trong từ vựng; **hiện không màn nào gửi nó**, và đăng nhập không đi qua cầu nối (launch đã dựng phiên rồi) |
| `get_device_info` | trang xin app thông tin thiết bị | có trong từ vựng; **hiện không màn nào gửi nó** |

Ba tên này là toàn bộ từ vựng. Gặp `type` khác thì coi là lạ và bỏ qua. Các tên này là một phần hợp đồng
với app chứa: chúng tôi không đổi tên.

**App → web.** Gọi hàm toàn cục `window.__rewardNativeReceive(message)` với một chuỗi JSON hoặc một đối
tượng đã parse; trang bỏ qua mọi thứ nó không parse được. Loại thông điệp chiều này để mở (app có thể gửi
nhiều loại trả lời); hiện chưa màn nào phụ thuộc vào loại nào.

## 5. Checklist cho người dựng app

- [ ] `launchUrl` được mở nguyên văn, một lần, trong 60 giây kể từ lúc tạo
- [ ] Web view giữ cookie đặt trên `302` và dùng một kho cookie suốt phiên chơi
- [ ] iOS dùng kho dữ liệu bền vững; Android bật cookie
- [ ] Xử lý `close_native_webview` (người chơi luôn phải có đường ra)
- [ ] Sau 8 giờ, hoặc khi gặp `401 INVALID_LAUNCH_CODE`, app xin máy chủ của bạn một `launchUrl` mới
- [ ] Vòng đi trọn vẹn nằm ở [go-live.md](./go-live.md)
