# Hướng dẫn cài đặt CreatorOS — bản Reward

> Dành cho kỹ sư cài đặt, dựng CreatorOS trên hạ tầng của quý công ty.
> Đã cài rồi và cần lên bản mới: đọc [upgrade.md](upgrade.md).

---

## 1. Chuẩn bị

### Diso gửi cho quý công ty

| | Dùng để làm gì |
|---|---|
| **Bản cài đặt** *(Docker image)* + thông tin đăng nhập kho ảnh | chạy hệ thống |
| **Mã bản quyền** *(`LICENSE_KEY`)* | mở tính năng Reward |
| **Tên định danh hệ thống** *(`DEPLOYMENT_ID`)* | gắn với mã bản quyền |
| **File cấu hình mẫu** [`reward-only.env.example`](reward-only.env.example) | chép thành `.env` rồi điền |

⚠️ **Mã bản quyền và tên định danh đi thành cặp.** Sửa một cái mà không sửa cái kia thì tính năng Reward ngừng hoạt động, và **không có thông báo lỗi nào**.

### Quý công ty chuẩn bị

| | Ghi chú |
|---|---|
| Máy chủ | Diso gửi kèm bảng cấu hình theo quy mô |
| PostgreSQL | cần **ba tài khoản khác quyền** — xem mục 2 |
| Redis | |
| Tên miền + chứng chỉ HTTPS | |
| Khoá ứng dụng đăng nhập mạng xã hội | nếu muốn bật Google / TikTok / Facebook / Zalo |

Diso **không** giữ bản sao của bất kỳ thông tin nào ở nhóm này.

---

## 2. Ba tài khoản cơ sở dữ liệu

Hệ thống dùng **ba tài khoản PostgreSQL khác nhau**. Đây không phải yêu cầu hình thức — gộp lại sẽ mất lớp cách ly dữ liệu giữa các đơn vị.

| Tài khoản | Tên | Quyền cần có | Quyền KHÔNG được có |
|---|---|---|---|
| **ứng dụng** | **`creator_os_app`** — cố định | đọc/ghi dữ liệu | ❌ không được vượt quy tắc lọc theo đơn vị *(`NOBYPASSRLS`)* |
| **chủ sở hữu** | tuỳ chọn | sở hữu cơ sở dữ liệu và schema `creator_os`; vượt quy tắc lọc *(`BYPASSRLS`)* | |
| **tác vụ nền** | **`creator_os_worker`** — cố định | vượt quy tắc lọc *(`BYPASSRLS`)* | ❌ không được là siêu người dùng *(`NOSUPERUSER`)* |

🔴 **Tên của tài khoản ứng dụng và tác vụ nền phải đúng từng ký tự.** Migration tự cấp quyền trên mọi bảng, nhưng chỉ cho hai tên này. Đặt tên khác thì migration vẫn báo thành công, còn ứng dụng thiếu quyền ở mọi bảng.

Migration còn nhắc tới một tài khoản thứ tư, `creator_os_dev_app`. Đó là tài khoản của môi trường phát triển nội bộ của Diso. Bản cài của quý công ty **không cần tạo** tài khoản này: migration chỉ cấp quyền cho nó khi nó có mặt, và tự bỏ qua khi không có.

🔴 **Tài khoản chủ sở hữu cần `BYPASSRLS`.** Một số migration ghi dữ liệu mặc định vào bảng có quy tắc lọc. Thiếu quyền này thì lần chạy migration đầu tiên dừng giữa chừng với lỗi `new row violates row-level security policy`, và phải xoá cơ sở dữ liệu tạo lại. Quyền này không mở thêm gì: chủ sở hữu vốn tắt được quy tắc lọc trên bảng của chính mình.

🔴 **Thiếu tài khoản "tác vụ nền" không gây lỗi gì cả** — hệ thống vẫn chạy, nhưng sẽ dùng tài khoản "chủ sở hữu" thay thế. Khi đó một tài khoản vừa vượt được quy tắc lọc dữ liệu, vừa có quyền sửa cấu trúc bảng.

### Tạo tài khoản

Chạy bằng tài khoản quản trị PostgreSQL. Thay `<owner>`, `<db>` và các mật khẩu:

```sql
CREATE ROLE <owner>           LOGIN PASSWORD '<mk>' NOSUPERUSER BYPASSRLS;
CREATE ROLE creator_os_app    LOGIN PASSWORD '<mk>' NOSUPERUSER NOBYPASSRLS;
CREATE ROLE creator_os_worker LOGIN PASSWORD '<mk>' NOSUPERUSER BYPASSRLS;
CREATE DATABASE <db> OWNER <owner>;
```

Rồi **đăng nhập bằng `<owner>`** vào `<db>` và chạy:

```sql
CREATE SCHEMA creator_os;
CREATE EXTENSION IF NOT EXISTS citext SCHEMA creator_os;
GRANT USAGE ON SCHEMA creator_os TO creator_os_app, creator_os_worker;
```

- Câu `GRANT USAGE` phải tự chạy, và tạo schema trước chính là để chạy được câu này ngay: migration cấp quyền trên bảng nhưng **không** cấp quyền dùng schema. Thiếu nó thì hai tài khoản kia không đọc được bảng nào.
- `citext` phải nằm **trong** schema `creator_os`. Cơ sở dữ liệu đã cài `citext` ở schema khác, thường là `public`, thì câu `CREATE EXTENSION` trên không làm gì, và migration đầu tiên dừng với lỗi `type "citext" does not exist`. Khi đó chuyển nó sang, bằng tài khoản quản trị: `ALTER EXTENSION citext SET SCHEMA creator_os;`
- Để schema `creator_os` **trống** tới lần chạy migration đầu tiên: có sẵn bảng nào thì migration từ chối chạy *(lỗi `P3005`)*. Về sau cũng đừng tạo bảng tay trong schema này bằng tài khoản khác: câu kiểm ① bên dưới sẽ ra hai dòng, và lần nâng cấp mang bước cấp quyền tự động dừng với lỗi `permission denied for table …`.

Bước tiếp theo, chạy migration lần đầu, nằm cuối mục 3 vì cần file cấu hình đã điền.

### Kiểm tra — sau khi chạy migration lần đầu

Chạy bằng tài khoản chủ sở hữu. Hai câu này chỉ đọc:

```sql
-- ① mọi bảng cùng một chủ: đúng 1 dòng, là tài khoản chủ sở hữu
SELECT tableowner, count(*) FROM pg_tables WHERE schemaname = 'creator_os' GROUP BY 1;

-- ② hai tài khoản kia đủ quyền
SELECT r.rolname, r.rolbypassrls, r.rolsuper,
       has_schema_privilege(r.rolname, 'creator_os', 'USAGE') AS dung_schema,
       count(*) FILTER (WHERE NOT (
             has_table_privilege(r.rolname, format('creator_os.%I', t.tablename), 'SELECT')
         AND has_table_privilege(r.rolname, format('creator_os.%I', t.tablename), 'INSERT')
         AND has_table_privilege(r.rolname, format('creator_os.%I', t.tablename), 'UPDATE')
         AND has_table_privilege(r.rolname, format('creator_os.%I', t.tablename), 'DELETE'))) AS bang_thieu_quyen
FROM pg_roles r CROSS JOIN pg_tables t
WHERE r.rolname IN ('creator_os_app', 'creator_os_worker') AND t.schemaname = 'creator_os'
GROUP BY r.rolname, r.rolbypassrls, r.rolsuper
ORDER BY 1;
```

Câu ② phải ra đúng hai dòng:

| rolname | rolbypassrls | rolsuper | dung_schema | bang_thieu_quyen |
|---|---|---|---|---|
| `creator_os_app` | `f` | `f` | `t` | `0` |
| `creator_os_worker` | `t` | `f` | `t` | `0` |

Thiếu một dòng nghĩa là tài khoản đó chưa có, hoặc sai tên.

---

## 3. Điền file cấu hình

Chép [`reward-only.env.example`](reward-only.env.example) thành `.env`, điền các chỗ `<…>`.

File đó có ghi chú ngay cạnh từng dòng. Bốn điểm cần chú ý nhất:

| Cấu hình | Lưu ý |
|---|---|
| `DATABASE_URL` và hai dòng cùng nhóm | phải kết thúc bằng **`?schema=creator_os`**. Ghi `?schema=public` thì quá trình khởi tạo dừng giữa chừng và **phải xoá cơ sở dữ liệu tạo lại từ đầu** |
| `API_ORIGIN` | gõ đúng **`127.0.0.1`**. Không dùng `localhost`, không dùng tên miền |
| `RUN_WORKER` | phải đặt **`true`** ở đúng **một** máy chủ. Bỏ trống thì các tác vụ nền **không chạy**, và không có thông báo gì |
| `PII_ENCRYPTION_KEY`, `PII_HASH_PEPPER` | **bắt buộc**, quý công ty tự sinh và lưu ở nơi tách khỏi máy chủ. Mất là **mất khả năng đọc lại dữ liệu đã mã hoá** — không ai khôi phục được, kể cả Diso. Đặt `PII_HASH_PEPPER` **khác** `JWT_SECRET` |
| bốn dòng `BREVO_*` | cần cho **mã xác thực đăng nhập** và **khôi phục mật khẩu**. Bỏ trống thì người dùng không đăng nhập được bằng email |
| `NOTIFICATION_MODE` | **không cần khai** — gửi email thật là mặc định. Đây là công tắc **tắt** gửi, chỉ dành cho máy chạy thử, và nó nhận đúng một giá trị có tác dụng: `console`. Đừng chép `.env` từ máy thử sang máy thật |

### Chạy migration lần đầu — trước khi khởi động container

Image **không** tự tạo cấu trúc cơ sở dữ liệu. Chạy bằng image của bản đang cài, với `.env` vừa điền:

```bash
docker run --rm --env-file .env --entrypoint sh <kho ảnh Diso cấp>/creator-os/app:vX.Y.Z \
  -c 'cd /repo && DATABASE_URL="$DATABASE_URL_MIGRATE" pnpm --filter @app/db exec prisma migrate deploy'
```

Đúng khi dòng cuối là `All migrations have been successfully applied.` Sau đó chạy hai câu kiểm ở mục 2, rồi mới khởi động container.

- `DATABASE_URL="$DATABASE_URL_MIGRATE"` là bắt buộc. Lý do nằm ở mục 4 của [upgrade.md](upgrade.md).
- Mọi lần chạy migration về sau, khi nâng cấp, phải dùng **cùng** tài khoản chủ sở hữu này.

---

## 4. Cấu hình do Diso quản

Ba thiết lập sau **không đọc từ file `.env`**:

- bật/tắt kiểm tra bản quyền
- khoá xác thực bản quyền
- thời gian ân hạn sau khi hết hạn *(30 ngày)*

Nếu quý công ty thêm chúng vào `.env`, chúng sẽ **bị bỏ qua** — đây không phải lỗi. Cần thay đổi thì liên hệ Diso.

---

## 5. Kiểm tra sau khi cài

### Bước 1 — bản quyền

```bash
curl -s http://<host>:4700/api/v1/license/status
```

| Kết quả | Nghĩa là | Xử lý |
|---|---|---|
| `ACTIVE` | bình thường | sang bước 2 |
| `ABSENT` | chưa điền mã bản quyền | điền `LICENSE_KEY` vào `.env` |
| `INVALID` | chuỗi mã bị sai hoặc đứt dòng | chép lại nguyên chuỗi, không xuống dòng |
| `WRONG_DEPLOYMENT` | tên định danh không khớp mã bản quyền | kiểm tra `DEPLOYMENT_ID`; vẫn sai thì liên hệ Diso |
| `EXPIRED` | đã hết hạn và hết cả 30 ngày ân hạn | liên hệ Diso gia hạn |

### Bước 2 — tác vụ nền

Kiểm tra tiến trình xử lý nền đang chạy. Nếu không, xem lại `RUN_WORKER`.

### Bước 3 — ba tài khoản cơ sở dữ liệu

Chạy lệnh ở mục 2.

---

## 6. Các lỗi KHÔNG hiện thông báo

Mỗi dòng dưới đây đều **không sinh ra lỗi nào** — hệ thống trông vẫn bình thường.

| Cấu hình sai | Hậu quả |
|---|---|
| thiếu tài khoản "tác vụ nền" | mất một lớp bảo vệ dữ liệu |
| `RUN_WORKER` chưa đặt | các tác vụ nền không chạy |
| `API_ORIGIN` dùng `localhost` | trang trắng, không có dòng log nào |
| thiếu khoá đăng nhập mạng xã hội | nút của nhà cung cấp đó không hiện |
| `PII_HASH_PEPPER` bỏ trống | hệ thống tự dùng `JWT_SECRET` thay thế. Về sau đổi `JWT_SECRET` là **toàn bộ dữ liệu đối soát cũ không khớp nữa** |
| `NOTIFICATION_MODE=console` trên máy chủ thật | email **không được gửi đi**, người dùng không nhận được mã xác thực |
| trùng giá trị `QUEUE_PREFIX` với hệ thống khác dùng chung Redis | xử lý nhầm công việc của hệ thống kia |
| `?schema=public` | khởi tạo dừng giữa chừng, phải làm lại |

---

## 7. Cần hỗ trợ

Liên hệ Diso trong các trường hợp sau — đây là những việc quý công ty không tự xử lý được:

| Tình huống |
|---|
| bản quyền báo `INVALID`, `EXPIRED` hoặc `WRONG_DEPLOYMENT` |
| bản quyền báo `ACTIVE` nhưng tính năng Reward vẫn báo lỗi quyền |
| cần đổi tên định danh hệ thống *(chuyển máy chủ, đổi môi trường)* |
| bản quyền sắp hết hạn |

Khi liên hệ, gửi kèm kết quả của lệnh sau. Lệnh này **không** chứa mã bản quyền hay thông tin nhạy cảm:

```bash
curl -s http://<host>:4700/api/v1/license/status
```
