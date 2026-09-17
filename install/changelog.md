# Thay đổi cho người cài đặt

Mỗi bản phát hành có **một mục** ở đây, trả lời đúng câu kỹ sư cài đặt cần trước khi nâng cấp:
*"bản này đổi gì cho người cài?"* — biến môi trường mới hoặc đổi nghĩa, việc phải làm tay, và bản đó
có quay lui được bằng image cũ hay không.

Bản không đổi gì cho người cài **vẫn có mục**, ghi *"không đổi"* — thiếu mục khác với không đổi.

Phần *Chưa phát hành* ở đầu danh sách là của bản **sau** thẻ bạn đang đọc: thay đổi đã xong nhưng chưa
phát hành. Lúc phát hành, phần đó đổi tên thành số bản.

Cách nâng cấp giữa hai bản: [upgrade.md](upgrade.md).

Ký hiệu:

| | Nghĩa |
|---|---|
| 🔴 **PHẢI LÀM** | không làm thì bản mới không chạy, hoặc chạy sai |
| 🟡 **NÊN BIẾT** | không làm thì vẫn chạy, nhưng có thứ khác đi |
| 🟢 **THÊM** | tuỳ chọn mới, bỏ qua được |

## Mỗi mục ghi gì

Đề mục là số bản và ngày phát hành, vd `## v1.0.8 — 2026-09-20`. Bên dưới là đúng ba phần; phần nào không
có gì thì ghi *"không"*, đừng bỏ trống:

- **Biến môi trường** — biến mới, biến đổi nghĩa, biến bỏ đi. Mỗi biến một dòng, kèm giá trị cần điền
  hoặc cách tự sinh. Đối chiếu được với [reward-only.env.example](reward-only.env.example) của cùng thẻ.
- **Việc phải làm tay** — thứ không nằm trong image: cấp thêm quyền cơ sở dữ liệu, mở thêm cổng, đổi cấu
  hình proxy hay tên miền.
- **Quay lui** — *"được bằng image cũ"*, hoặc *"không quay lui được bằng image cũ — chỉ khôi phục bản sao
  lưu"*. Nghĩa của hai câu này nằm ở mục 7 của [upgrade.md](upgrade.md).

---

## Chưa phát hành

Không đổi.

## v1.1.0 — 2026-09-14

**Biến môi trường** — không thêm, không bỏ biến nào. Tên người dùng trong hai chuỗi kết nối nay cố định:
`DATABASE_URL` dùng `creator_os_app`, `DATABASE_URL_WORKER` dùng `creator_os_worker`.

**Việc phải làm tay**

🔴 Bản này tự cấp quyền trên mọi bảng, nhưng **chỉ** cho đúng tên `creator_os_app` (ứng dụng) và
`creator_os_worker` (tác vụ nền) — tên khác thì migration vẫn báo thành công, còn ứng dụng thiếu quyền
ở mọi bảng, và migration không tự cấp quyền dùng schema:

- Đang dùng tên tài khoản khác: đổi tên **trước** khi chạy migration của bản này — mục 4 của
  [upgrade.md](upgrade.md).
- Cấp quyền dùng schema cho hai tài khoản trên: `GRANT USAGE ON SCHEMA creator_os TO creator_os_app, creator_os_worker`.
- *(nâng cấp)* trước khi chạy migration, kiểm mọi bảng trong schema `creator_os` thuộc đúng tài khoản chủ
  sở hữu — câu kiểm ① ở mục 2 của [reward-only-setup.md](reward-only-setup.md) phải ra đúng một dòng.
- *(cài mới)* tài khoản chủ sở hữu cần `BYPASSRLS` — thiếu thì lần chạy migration đầu tiên dừng giữa
  chừng và phải tạo lại cơ sở dữ liệu.

🟡 **NÊN BIẾT** — mọi lần chạy migration phải dùng **cùng** tài khoản chủ sở hữu: bảng mới chỉ tự có
quyền khi do đúng tài khoản đó tạo.

**Quay lui** — được bằng image cũ.

## v1.0.7 — 2026-09-11

Không đổi.
