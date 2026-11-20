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
| PostgreSQL | một máy chủ PostgreSQL **trống** (bản 16 đã được thử) và **một tài khoản quản trị** của nó (siêu người dùng). Quý công ty **không cần tạo tài khoản, cơ sở dữ liệu hay schema nào**: lệnh cài ở mục 3 tạo hết. Tài khoản quản trị chỉ đưa cho lệnh cài **một lần**, không đặt vào `.env` |
| Redis | |
| Tên miền + chứng chỉ HTTPS | |
| Khoá ứng dụng đăng nhập mạng xã hội | nếu muốn bật Google / TikTok / Facebook / Zalo |

Diso **không** giữ bản sao của bất kỳ thông tin nào ở nhóm này.

**Không có tài khoản quản trị** (PostgreSQL do bên khác quản lý và không giao quyền quản trị)? Vẫn cài được, xem "Không có tài khoản quản trị" ở mục 3.

---

## 2. Ba tài khoản cơ sở dữ liệu (lệnh cài tự tạo, quý công ty chỉ chọn mật khẩu)

Hệ thống dùng **ba tài khoản PostgreSQL khác nhau**. Đây không phải yêu cầu hình thức: gộp lại sẽ mất lớp cách ly dữ liệu giữa các đơn vị.

| Tài khoản | Tên | Dùng để | Quyền |
|---|---|---|---|
| **ứng dụng** | **`creator_os_app`**, cố định | ứng dụng đọc/ghi dữ liệu | không vượt được quy tắc lọc theo đơn vị |
| **tác vụ nền** | **`creator_os_worker`**, cố định | tác vụ nền cần đọc dữ liệu nhiều đơn vị | vượt quy tắc lọc, không phải siêu người dùng |
| **chủ sở hữu** | `creator_os_migrate` *(tên tuỳ chọn, ví dụ dưới dùng tên này)* | tạo và cập nhật cấu trúc bảng (chạy migration) | sở hữu cơ sở dữ liệu và schema, vượt quy tắc lọc |

🔴 **Tên của tài khoản ứng dụng và tác vụ nền phải đúng từng ký tự**: migration chỉ cấp quyền cho hai tên này. Lệnh cài **từ chối chạy** (mã thoát 2, không làm gì) nếu tên sai, và in cách đổi tên.

Quý công ty chỉ làm một việc: **chọn mật khẩu cho ba tài khoản** và ghi vào ba chuỗi kết nối ở mục 3. Lệnh cài tạo tài khoản từ chính ba chuỗi đó, với đúng thuộc tính, và về sau kiểm lại mỗi lần chạy.

🔴 **Không có tài khoản "tác vụ nền" không gây lỗi gì cả**: hệ thống vẫn chạy nhưng dùng tài khoản chủ sở hữu thay thế, tức một tài khoản vừa vượt quy tắc lọc vừa sửa được cấu trúc bảng. Lệnh cài luôn tạo đủ ba tài khoản, và dừng nếu hai trong ba chuỗi trỏ về cùng một tài khoản.

---

## 3. Cài đặt: điền file cấu hình, rồi chạy MỘT lệnh

### Điền file cấu hình

Chép [`reward-only.env.example`](reward-only.env.example) thành `.env`, điền các chỗ `<…>`.

File đó có ghi chú ngay cạnh từng dòng. Điểm cần chú ý nhất:

| Cấu hình | Lưu ý |
|---|---|
| `DATABASE_URL`, `DATABASE_URL_WORKER`, `DATABASE_URL_MIGRATE` | ba chuỗi kết nối với ba tên tài khoản ở mục 2, cùng máy chủ, cùng cơ sở dữ liệu, mật khẩu do quý công ty chọn. Cả ba kết thúc bằng **`?schema=creator_os`** (ghi `?schema=public` thì khởi tạo dừng giữa chừng). Ký tự đặc biệt trong mật khẩu (`@ : / % ? #`) phải viết dạng `%40 %3A %2F %25 %3F %23` |
| `API_ORIGIN` | gõ đúng **`127.0.0.1`**. Không dùng `localhost`, không dùng tên miền |
| `RUN_WORKER` | phải đặt **`true`** ở đúng **một** máy chủ. Bỏ trống thì các tác vụ nền **không chạy**, và không có thông báo gì |
| `PII_ENCRYPTION_KEY`, `PII_HASH_PEPPER` | **bắt buộc**, quý công ty tự sinh và lưu ở nơi tách khỏi máy chủ. Mất là **mất khả năng đọc lại dữ liệu đã mã hoá**, không ai khôi phục được, kể cả Diso. Đặt `PII_HASH_PEPPER` **khác** `JWT_SECRET` |
| bốn dòng `BREVO_*` | cần cho **mã xác thực đăng nhập** và **khôi phục mật khẩu**. Bỏ trống thì người dùng không đăng nhập được bằng email |
| `NOTIFICATION_MODE` | **không cần khai**: gửi email thật là mặc định. Đây là công tắc **tắt** gửi, chỉ dành cho máy chạy thử, và nó nhận đúng một giá trị có tác dụng: `console`. Đừng chép `.env` từ máy thử sang máy thật |

### Chạy lệnh cài (một lệnh, trước khi khởi động container)

Image **không** tự tạo cơ sở dữ liệu. Lệnh sau tạo ba tài khoản, cơ sở dữ liệu, schema, extension, chạy migration bằng tài khoản chủ sở hữu và kiểm quyền. Chạy bằng image của bản đang cài, với `.env` vừa điền. Địa chỉ máy chủ trong chuỗi quản trị giữ nguyên như trong `.env`, cơ sở dữ liệu ghi `postgres`.

Nhập chuỗi kết nối quản trị bằng biến môi trường, **không gõ thẳng vào dòng lệnh** (lịch sử shell và danh sách tiến trình của máy sẽ giữ lại mật khẩu của tài khoản siêu người dùng). Chuỗi có dạng `postgresql://<tài-khoản-quản-trị>:<mật-khẩu>@<host>:5432/postgres`; ký tự đặc biệt trong mật khẩu viết dạng `%40 %3A %2F %25 %3F %23`:

```bash
printf 'Chuỗi kết nối quản trị: '; read -rs DATABASE_URL_ADMIN; echo; export DATABASE_URL_ADMIN
```

Rồi chạy lệnh (`-e DATABASE_URL_ADMIN` không kèm giá trị: Docker lấy từ môi trường hiện tại):

```bash
docker run --rm --env-file .env \
  -e DATABASE_URL_ADMIN \
  --entrypoint sh <kho ảnh Diso cấp>/creator-os/app:vX.Y.Z \
  -c 'cd /repo && pnpm --filter @app/api db:prepare'
```

Đúng khi lệnh **thoát với mã 0** và các dòng cuối là:

```
[db-grants] OK role=creator_os_app process=db:prepare: … tables match the declared list
[db-grants] OK role=creator_os_worker process=db:prepare: … tables match the declared list
db:prepare: done. Every account is right.
```

PostgreSQL chạy trong một container Docker khác thì thêm `--network <mạng của container đó>` ngay sau `docker run --rm`, và dùng tên container làm `<host>` (cả trong `.env` lẫn `DATABASE_URL_ADMIN`).

Giữa chừng nó in từng việc đã làm (`ran: CREATE ROLE …`, `ran: CREATE DATABASE …`, `running prisma migrate deploy as "creator_os_migrate"…`). Mật khẩu **không bao giờ** được in ra. Chuỗi kết nối quản trị chỉ có mặt trong lệnh này: lệnh cài là nơi duy nhất đọc nó, ứng dụng không bao giờ thấy.

- **Chạy lại bao nhiêu lần cũng được**: không đổi gì nếu đã đúng; lệch thì tự vá về đúng. Mọi lần nâng cấp về sau cũng dùng đúng lệnh này (xem [upgrade.md](upgrade.md), mục 4).
- 🔴 **Đừng chạy hai lệnh này cùng lúc** (hai cửa sổ, hai máy, hoặc một lệnh còn chạy khi bắt đầu lệnh kia). Phần tạo tài khoản không có khoá; chỉ phần chạy migration tự khoá.
- Trong schema `creator_os`, **đừng tạo bảng bằng tay** trước lần chạy đầu: migration gặp schema đã có bảng mà chưa có lịch sử migration thì dừng với lỗi `P3005`.
- Xong thì xoá biến khỏi phiên làm việc: `unset DATABASE_URL_ADMIN`.
- Mật khẩu của ba tài khoản chỉ được đặt lúc **tạo** tài khoản. Muốn đặt lại theo `.env`: thêm `--reset-passwords` vào cuối lệnh (`… db:prepare --reset-passwords`).
- Lệnh **dừng trước khi chạy migration** (mã thoát 1, in sẵn việc cần làm) nếu có gì phía trước chưa đúng, để cơ sở dữ liệu không bị bỏ dở nửa chừng.

### Khi lệnh cài dừng và in việc cần làm

Các trường hợp sau không tự sửa, vì sửa có thể khoá cả cơ sở dữ liệu; lệnh cài **in sẵn câu lệnh cần chạy**, quý công ty (hoặc quản trị viên PostgreSQL) chạy đúng các câu đó bằng tài khoản quản trị, rồi chạy lại lệnh cài:

| Lệnh cài báo | Nghĩa là | Việc làm |
|---|---|---|
| `STOP: the configuration cannot be used` kèm `it must be one of …` hoặc `it must be named creator_os_worker` *(mã thoát 2)* | tên tài khoản trong `.env` sai, hoặc hai chuỗi trùng tài khoản, hoặc ba chuỗi không cùng máy chủ/cơ sở dữ liệu | sửa `.env` theo dòng được in. Tên sai: chạy câu `ALTER ROLE … RENAME TO …` được in ra, rồi chạy lại lệnh cài kèm `--reset-passwords` *(PostgreSQL xoá mật khẩu kiểu md5 khi đổi tên)* |
| `ownership: … NOT changed automatically …` | có đối tượng thuộc tài khoản khác tài khoản chủ sở hữu | sao lưu, dừng ứng dụng và tác vụ nền, chạy các câu được in ra (đổi chủ khoá mọi đối tượng nên không chạy lúc đang phục vụ) |
| `REPORT ONLY: the extension … is in the schema …` | extension nằm ở schema khác, mà cơ sở dữ liệu đã có bảng | lúc dừng ứng dụng và có bản sao lưu, chạy câu `ALTER EXTENSION … SET SCHEMA creator_os` được in ra |
| `… is a member of the role …` | tài khoản ứng dụng/tác vụ nền là thành viên của một role khác | chạy câu `REVOKE … FROM …` được in ra |
| `could not run (…)` / `needs an administrator: …` | tài khoản quản trị không đủ quyền cho bước đó | chạy câu được in ra bằng siêu người dùng |

### Không có tài khoản quản trị

Bỏ dòng `-e DATABASE_URL_ADMIN` đi (và không nhập biến đó). Lệnh chạy ở chế độ **chỉ kiểm**: không đổi gì, in ra **từng câu SQL** mà quản trị viên PostgreSQL của quý công ty cần chạy (kèm chỗ điền mật khẩu), và thoát mã 1 cho tới khi mọi thứ đã đúng. Cách làm: chạy lệnh → đưa các dòng `needs an administrator: …` cho quản trị viên → họ chạy → chạy lại lệnh, cho tới khi thấy `done. Every account is right.` Với cơ sở dữ liệu trống, quản trị viên chạy xong thì **chạy migration** bằng lệnh tương ứng với dòng cuối của kế hoạch được in ra (`prisma migrate deploy`, bằng tài khoản chủ sở hữu):

```bash
docker run --rm --env-file .env --entrypoint sh <kho ảnh Diso cấp>/creator-os/app:vX.Y.Z \
  -c 'cd /repo && DATABASE_URL="$DATABASE_URL_MIGRATE" pnpm --filter @app/db exec prisma migrate deploy'
```

rồi chạy lại lệnh cài (không `DATABASE_URL_ADMIN`) để thấy hai dòng `OK`.

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

Ứng dụng tự kiểm quyền của hai tài khoản lúc khởi động và ghi vào log (API và tác vụ nền, mỗi tiến trình một dòng cho mỗi tài khoản). Không có câu SQL nào phải chạy:

```bash
docker logs <tên container> 2>&1 | grep '\[db-grants\]'
```

Đúng khi chỉ có dòng `[db-grants] OK role=creator_os_app …` và `[db-grants] OK role=creator_os_worker …`. Dòng `[db-grants] MISMATCH role=…` liệt kê bảng và quyền sai; nó đi kèm một sự kiện báo lỗi nếu có hệ thống giám sát. Ứng dụng **không dừng** vì dòng này. Cách xử: chạy lại lệnh cài ở mục 3 (nó tự vá phần lệch, hoặc in việc cần làm).

---

## 6. Các lỗi KHÔNG hiện thông báo

Mỗi dòng dưới đây đều **không sinh ra lỗi nào** — hệ thống trông vẫn bình thường.

| Cấu hình sai | Hậu quả |
|---|---|
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
