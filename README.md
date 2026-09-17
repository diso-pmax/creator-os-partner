# CreatorOS — tài liệu công khai

Kho này chứa tài liệu công khai của CreatorOS cho **hai người đọc**. Chọn đúng chỗ của bạn, không phải
đọc chỗ còn lại.

> Chỗ nào bạn phải đoán là **lỗi của tài liệu** — [mở một issue](../../issues/new/choose), chúng tôi sửa.

## Bạn là ai?

| Bạn là | Việc của bạn | Đọc ở đây |
|---|---|---|
| **Dev tích hợp** | viết mã gửi sự kiện, mở phiên cho người chơi, đối soát | [`contract/`](contract/vi/README.md) · [`conformance/`](conformance/) · [`examples/`](examples/) |
| **Kỹ sư cài đặt** | dựng hệ thống trên hạ tầng của quý công ty: image, tên miền, cấu hình | [`install/`](install/reward-only-setup.md) |

---

## Dev tích hợp

Hợp đồng tích hợp là **ĐẶC TẢ, không phải đề xuất**: nền tảng quyết và công bố, bên tích hợp làm theo.

| Bạn muốn | Đọc |
|---|---|
| bắt đầu | [`contract/vi/README.md`](contract/vi/README.md) · English: [`contract/en/README.md`](contract/en/README.md) |
| **tự kiểm trước khi kết nối** | [`conformance/`](conformance/) — bộ ca bạn tự chạy |
| ví dụ mã ký, chạy được ngay | [`examples/`](examples/) |

### Chạy thử trong 1 phút

```bash
# kiểm hàm ký của bạn với vector cố định — không cần mạng, không cần khoá thật
node examples/node/ky.mjs --tu-kiem
bash examples/shell/ky.sh --tu-kiem
```

Ra `sha256=ae00dc85…` là hàm ký của bạn đúng. Chi tiết ở hợp đồng.

### Bộ kiểm hợp chuẩn

```bash
cd conformance
CONF_API=https://<cửa của chúng tôi>/api/v1 \
CONF_ACCESS_KEY=<mã nhận dạng của bạn> \
CONF_EVENT_SECRET=<bí mật kênh sự kiện> \
CONF_EVENT_TYPE=ORDER_COMPLETED \
  npx tsx run.ts
```

Thoát `0` = đạt hết · `1` = có ca trượt · `2` = thiếu cấu hình. Đọc [`conformance/README.md`](conformance/README.md)
trước khi chạy — có một cảnh báo về sandbox.

⚠️ Bộ kiểm **không cần cài gì**: chỉ dùng `node:crypto` và `npx` tự tải `tsx`.

---

## Kỹ sư cài đặt

| Bạn cần | Đọc |
|---|---|
| cài lần đầu | [`install/reward-only-setup.md`](install/reward-only-setup.md) |
| điền file cấu hình | [`install/reward-only.env.example`](install/reward-only.env.example) — chép thành `.env` rồi điền |
| nâng cấp lên bản mới | [`install/upgrade.md`](install/upgrade.md) |
| bản mới đổi gì cho người cài | [`install/changelog.md`](install/changelog.md) |

---

## Phiên bản

Kho này đi theo **bản phát hành của sản phẩm**: mỗi bản `vX.Y.Z` có **một thẻ cùng số** ở đây, kèm một
release ghi thay đổi hợp đồng của bản đó. Biết bản mình đang chạy thì mở đúng thẻ đó — không cần bảng tra.

Toàn bộ lịch sử thay đổi hợp đồng: [`contract/vi/changelog.md`](contract/vi/changelog.md) ·
[`contract/en/changelog.md`](contract/en/changelog.md). Trích dẫn thì trích **số bản**, đừng trích commit.

Chúng tôi **báo trước** mọi thay đổi phá vỡ tương thích. Những gì đã đóng băng và sẽ không đổi âm thầm:
bảng mã trả lời · nghĩa của `200` · quy tắc chống trùng theo `eventId` · các khuôn ký có tên.

## Kho này là bản SINH RA

Nội dung được sinh từ kho nguồn của chúng tôi và đẩy sang một chiều — kể cả chính trang này.

⇒ **Đừng gửi Pull Request sửa nội dung** — nó không về được nguồn. Thấy sai, thấy thiếu, thấy phải đoán:
[mở issue](../../issues/new/choose). Xem [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Giấy phép

**Hai thứ, hai giấy phép khác nhau** — xem [`LICENSE`](LICENSE):

| | |
|---|---|
| `contract/` — văn bản hợp đồng | mọi quyền được bảo lưu · đọc và làm theo được, **không** phát hành bản sửa đổi |
| `conformance/` · `examples/` — mã | **MIT** · chép thẳng vào sản phẩm của bạn, không phải hỏi |
