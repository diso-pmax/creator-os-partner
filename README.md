# Tích hợp sự kiện — tài liệu cho bên đối ứng

Kho này chứa **hợp đồng tích hợp sự kiện** của nền tảng và **bộ kiểm hợp chuẩn** chạy được. Đọc hết
là tích hợp được, không cần hỏi thêm tài liệu nào.

> **Đây là ĐẶC TẢ, không phải đề xuất.** Nền tảng quyết và công bố; bên đối ứng làm theo.
> Chỗ nào bạn phải đoán là **lỗi của tài liệu** — [mở một issue](../../issues/new/choose), chúng tôi sửa.

## Bắt đầu ở đâu

| Bạn muốn | Đọc |
|---|---|
| **bắn gói tin đầu tiên trong 30 phút** | [`contract/hop-dong-tich-hop-su-kien.md`](contract/hop-dong-tich-hop-su-kien.md) §2 |
| hiểu toàn bộ hợp đồng | cùng file, đọc từ đầu — có block *"đọc phần nào"* ngay trang đầu |
| **tự kiểm trước khi onboard** | [`conformance/`](conformance/) — 14 ca, bạn tự chạy |
| ví dụ mã ký, chạy được ngay | [`examples/`](examples/) |
| xem một **phụ lục riêng** trông thế nào | [`contract/vi-du-phu-luc-rieng-msht.md`](contract/vi-du-phu-luc-rieng-msht.md) |

## Chạy thử trong 1 phút

```bash
# kiểm hàm ký của bạn với vector cố định — không cần mạng, không cần khoá thật
node examples/node/ky.mjs --tu-kiem
bash examples/shell/ky.sh --tu-kiem
```

Ra `sha256=ae00dc85…` là hàm ký của bạn đúng. Chi tiết ở hợp đồng, Phụ lục B.

## Bộ kiểm hợp chuẩn

```bash
cd conformance
CONF_API=https://<cửa của chúng tôi>/api/v1 \
CONF_ACCESS_KEY=<mã nhận dạng của bạn> \
CONF_EVENT_SECRET=<bí mật kênh sự kiện> \
CONF_EVENT_TYPE=ORDER_COMPLETED \
  npx tsx run.ts
```

Thoát `0` = đạt hết · `1` = có ca trượt · `2` = thiếu cấu hình. Đọc [`conformance/README.md`](conformance/README.md) trước khi chạy — có một cảnh báo về sandbox.

⚠️ Bộ kiểm **không cần cài gì**: chỉ dùng `node:crypto` và `npx` tự tải `tsx`.

## Phiên bản

Hợp đồng phát hành theo **thẻ** (`v1.0.0`, `v1.1.0`…), không theo commit. Trích dẫn thì trích **số bản**,
đừng trích commit — xem [`CHANGELOG.md`](CHANGELOG.md).

Chúng tôi **báo trước** mọi thay đổi phá vỡ tương thích. Những gì đã đóng băng và sẽ không đổi âm thầm:
bảng mã trả lời · nghĩa của `200` · quy tắc chống trùng theo `eventId` · các khuôn ký có tên.

## Kho này là bản SINH RA

Nội dung được sinh từ kho nguồn của chúng tôi và đẩy sang một chiều.

⇒ **Đừng gửi Pull Request sửa nội dung** — nó không về được nguồn. Thấy sai, thấy thiếu, thấy phải đoán:
[mở issue](../../issues/new/choose). Xem [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Giấy phép

**Hai thứ, hai giấy phép khác nhau** — xem [`LICENSE`](LICENSE):

| | |
|---|---|
| `contract/` — văn bản hợp đồng | mọi quyền được bảo lưu · đọc và làm theo được, **không** phát hành bản sửa đổi |
| `conformance/` · `examples/` — mã | **MIT** · chép thẳng vào sản phẩm của bạn, không phải hỏi |
