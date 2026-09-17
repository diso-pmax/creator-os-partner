# Góp ý cho hợp đồng

## Kho này là bản SINH RA — đừng gửi Pull Request sửa nội dung

Nội dung ở đây được sinh từ kho nguồn của chúng tôi và đẩy sang **một chiều**. Một PR sửa
`contract/` hay `conformance/` **không có đường về nguồn**, nên nó sẽ bị đóng dù nội dung đúng — và
đó là lãng phí thời gian của bạn.

## Cách góp ý có tác dụng

**[Mở một issue](../../issues/new/choose).** Hai mẫu có sẵn:

| Mẫu | Dùng khi |
|---|---|
| **Chỗ này tôi phải đoán** | tài liệu không nói rõ, bạn phải suy hoặc thử mới biết |
| **Bộ kiểm báo sai** | một ca đạt/trượt không đúng với thứ hệ thống bạn thật sự làm |

Ở đầu hợp đồng có một lời hứa: *"chỗ nào bạn phải đoán là lỗi của tài liệu"*. Mẫu thứ nhất là chỗ
để thu lời hứa đó.

## Cái gì làm issue của bạn được xử lý nhanh

- **Số bản** bạn đang đọc *(xem `CHANGELOG.md`)* — hợp đồng đổi theo bản
- **Mục** — `§4.4`, `Phụ lục B.2`… thay vì *"phần chữ ký"*
- **Bạn đã hiểu thế nào** và **thứ thật sự xảy ra**
- `deliveryId` nếu có — đó là từ duy nhất hai bên cùng dùng được để gọi tên một lượt giao

**Đừng gửi kèm bí mật.** Đọc [`SECURITY.md`](SECURITY.md) trước.

## Chúng tôi làm gì với nó

Sửa ở bản gốc → phát hành bản mới → **mọi** bên cùng nhận.

Không có chuyện thoả thuận riêng qua email rồi hai bên nhớ khác nhau: một câu chỉ sống trong hộp thư
thì không ai đọc lại khi người làm đổi chỗ, và nó cũng không có bài kiểm nào canh.
