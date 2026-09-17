# Báo vấn đề an toàn

## 🔴 ĐỪNG BAO GIỜ dán bí mật vào issue

Issue ở kho này là **công khai**. Khi đi hỏi một lỗi `401`, rất dễ dán nguyên lượt gọi vào —
và lượt gọi đó chở khoá của bạn.

**Không dán:** bí mật ký (`whsec_…`, `rcv_…`) · header `X-Signature` · thân gói tin thật của khách hàng
· chuỗi kết nối · ảnh chụp màn hình có các thứ trên.

**Dán được:** mã nhận dạng đã che *(`AK-…001` → `AK-…`)* · mốc thời gian · mã trả lời · `code` ·
`deliveryId` · thân gói tin **đã thay bằng dữ liệu giả**.

⚠️ Lỡ dán rồi thì **xoá comment KHÔNG đủ** — lịch sử vẫn còn. Báo chúng tôi ngay để **thu hồi khoá**;
thu hồi có hiệu lực tức thì và bạn xoay sang khoá mới không rớt gói tin nào *(hợp đồng §7)*.

## Báo lỗ hổng ở đâu

Lỗ hổng bảo mật **không** báo qua issue công khai. Gửi riêng cho đầu mối kỹ thuật bạn đang làm việc
cùng, hoặc dùng **Report a vulnerability** ở tab *Security* của kho này.

Nói giúp chúng tôi: tái hiện thế nào · ảnh hưởng tới cái gì · bạn đã thấy nó ở đâu. Không cần bản vá.

## Thứ KHÔNG phải lỗ hổng

| | Vì sao |
|---|---|
| mọi nhánh xác thực hỏng trả **cùng một** `401` và cùng một câu | **cố ý** — tách ra là nói cho người dò biết họ đoán đúng nửa nào *(hợp đồng §4.4)* |
| đối soát trả `200` + `windows: []` cho một nguồn không thuộc về bạn | **cố ý** — chúng tôi không xác nhận nguồn của bên khác có thật hay không *(§6.2)* |
| khuôn ký chiều ra không phủ tên máy chủ đích | lựa chọn **có điều kiện đi kèm**, đã công bố ở §6.4 |

Ba thứ đó đã thành văn trong hợp đồng kèm lý do. Thấy lý do đó **sai**, thì đó mới là thứ đáng báo.
