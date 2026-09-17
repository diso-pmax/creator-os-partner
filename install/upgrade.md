# Nâng cấp CreatorOS lên bản mới

> Dành cho kỹ sư cài đặt đã có một bản cài đang chạy. Cài lần đầu: [reward-only-setup.md](reward-only-setup.md).

Mỗi bản phát hành mang một số `vX.Y.Z`. Kho này có **một thẻ cùng số** cho mỗi bản: hướng dẫn, file
cấu hình mẫu và danh sách thay đổi của bản nào thì nằm ở đúng thẻ của bản đó.

Thời gian gián đoạn chỉ nằm ở **mục 5** (đổi container). Mọi bước trước đó chạy khi bản cũ vẫn phục vụ.

---

## 1. Trước khi nâng: đọc mục của bản mới

Mở [changelog.md](changelog.md) ở thẻ của **bản mới**. Đọc mục của bản đó **và của mọi bản nằm giữa**
bản đang chạy và bản mới. Mỗi mục trả lời ba câu:

- có biến môi trường mới hoặc đổi nghĩa không — đối chiếu với [reward-only.env.example](reward-only.env.example) của bản mới;
- có việc gì phải làm tay không;
- bản đó có quay lui được bằng image cũ không — xem mục 7.

🔴 Một bản **không có mục** nghĩa là tài liệu thiếu, không phải là không đổi. Dừng lại và liên hệ Diso.

Biết bản đang chạy: đó là tag của image trong lệnh chạy của quý công ty (vd `…/creator-os/app:v1.0.7`).
Image có nhãn phiên bản thì hỏi thẳng image:

```bash
docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.version" }}' <image đang chạy>
```

---

## 2. Sao lưu cơ sở dữ liệu

**Bắt buộc**, kể cả khi bản mới trông như chỉ sửa giao diện. Đây là đường quay lui duy nhất chắc chắn
(mục 7).

```bash
pg_dump --format=custom --file=creatoros-truoc-<ban-moi>.dump "postgresql://<owner>:<mk>@<host>:5432/<db>"
```

⚠️ Bỏ đuôi `?schema=creator_os` khi đưa chuỗi kết nối cho `pg_dump` — công cụ này không nhận tham số đó.
Giữ file sao lưu ở nơi tách khỏi máy chủ.

---

## 3. Kéo image bản mới

```bash
docker pull <kho ảnh Diso cấp>/creator-os/app:vX.Y.Z
```

Dùng thông tin đăng nhập kho ảnh Diso đã gửi. Mỗi bản còn một tag truy vết `vX.Y.Z-<mã commit>` — hai tag
trỏ cùng một image.

---

## 4. Chạy migration — bằng image MỚI, TRƯỚC khi đổi container

Cùng thứ tự Diso dùng cho bản cài của chính mình: cấu trúc cơ sở dữ liệu đi trước, ứng dụng đi sau.
Migration hỏng ở bước này thì container cũ vẫn đang chạy — chưa có gì bị gián đoạn.

🔴 **Ba điều phải đúng TRƯỚC khi chạy** — chi tiết ở mục 2 của [hướng dẫn cài](reward-only-setup.md):

- Tài khoản ứng dụng và tác vụ nền mang **đúng tên** `creator_os_app` và `creator_os_worker`. Migration chỉ
  cấp quyền bảng cho đúng hai tên này. Chạy khi còn tên khác thì migration vẫn báo xong, còn ứng dụng
  thiếu quyền — và đổi tên sau đó **không** làm migration chạy lại.
- Chạy bằng **cùng** tài khoản chủ sở hữu như các lần trước. Bảng mới chỉ tự có quyền khi do đúng tài
  khoản đó tạo.
- Mọi bảng trong schema thuộc tài khoản chủ sở hữu: câu kiểm ① ở mục 2 của hướng dẫn cài ra **đúng một
  dòng**. Có bảng thuộc tài khoản khác, ví dụ do khôi phục bản sao lưu bằng tài khoản khác, thì migration
  dừng với lỗi `permission denied for table …`.

Đang dùng tên khác thì đổi tên trước, bằng tài khoản quản trị PostgreSQL, rồi sửa tên người dùng trong
`DATABASE_URL` và `DATABASE_URL_WORKER` của `.env`:

```sql
ALTER ROLE <tên cũ của tài khoản ứng dụng>  RENAME TO creator_os_app;
ALTER ROLE <tên cũ của tài khoản tác vụ nền> RENAME TO creator_os_worker;
```

⚠️ Tài khoản đặt mật khẩu kiểu `md5` bị **xoá mật khẩu** khi đổi tên. Đặt lại ngay:
`ALTER ROLE creator_os_app PASSWORD '<mk>';`, và tương tự cho `creator_os_worker`.

Lỡ chạy migration khi tên còn sai: đổi tên như trên, rồi tự cấp quyền bằng tài khoản chủ sở hữu:

```sql
GRANT USAGE ON SCHEMA creator_os TO creator_os_app, creator_os_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA creator_os TO creator_os_app, creator_os_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA creator_os
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO creator_os_app, creator_os_worker;
```

Lệnh chạy migration:

```bash
docker run --rm --env-file .env --entrypoint sh <kho ảnh Diso cấp>/creator-os/app:vX.Y.Z \
  -c 'cd /repo && DATABASE_URL="$DATABASE_URL_MIGRATE" pnpm --filter @app/db exec prisma migrate deploy'
```

🔴 **`DATABASE_URL="$DATABASE_URL_MIGRATE"` là bắt buộc.** Công cụ migration đọc `DATABASE_URL`, mà trong
`.env` biến đó là tài khoản **ứng dụng** — không có quyền sửa cấu trúc bảng (mục 2 của hướng dẫn cài).
Thiếu phần gán này thì migration dừng vì thiếu quyền.

- `.env` là file cấu hình của bản cài đang chạy, đã bổ sung biến mới theo mục 1.
- Chạy lại lệnh này là an toàn: migration nào đã chạy thì được bỏ qua.
- Lệnh báo `No pending migrations to apply` nghĩa là bản mới không đổi cấu trúc — vẫn đi tiếp mục 5.

---

## 5. Đổi container sang image mới

Dừng container cũ, chạy container mới với **cùng** `.env` và cùng cách chạy như trước — chỉ đổi tag image.
Ví dụ với compose: sửa tag image trong file compose thành `vX.Y.Z`, rồi:

```bash
docker compose up -d
```

`RUN_WORKER=true` vẫn phải ở **đúng một** container — nâng cấp không đổi điều này.

---

## 6. Kiểm sau khi nâng

| Kiểm | Lệnh | Đúng khi |
|---|---|---|
| đúng bản | `curl -s http://<host>:4700/api/v1/version` | `gitSha` khớp nhãn `org.opencontainers.image.revision` của image mới |
| ứng dụng sẵn sàng | `curl -s -o /dev/null -w '%{http_code}\n' http://<host>:4700/api/v1/health/ready` | `200` |
| bản quyền | `curl -s http://<host>:4700/api/v1/license/status` | `ACTIVE` |
| tác vụ nền | `docker exec <container có RUN_WORKER=true> s6-svstat -o up /run/service/worker` | `true` |
| quyền bảng | câu kiểm ở mục 2 của [hướng dẫn cài](reward-only-setup.md) | `bang_thieu_quyen` = `0` ở cả hai dòng |

Xem nhãn `revision` của image mới:

```bash
docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' <kho ảnh Diso cấp>/creator-os/app:vX.Y.Z
```

---

## 7. Quay lui được không?

**Được — về đúng MỘT bản trước, bằng image cũ, không động vào cơ sở dữ liệu.** Diso viết migration theo
luật *chỉ mở rộng*: thêm bảng, thêm cột cho phép trống hoặc có giá trị mặc định, thêm chỉ mục. Thay đổi phá
— đổi tên hay xoá một cột đang dùng — luôn tách qua hai bản phát hành. Vì vậy image của bản trước vẫn
chạy được trên cấu trúc của bản mới: chạy lại container với tag cũ (mục 5) là xong.

**Không được bằng image cũ** trong hai trường hợp:

- lùi xa hơn một bản;
- mục của bản mới trong [changelog.md](changelog.md) ghi *"không quay lui được bằng image cũ"* — bản nào
  không giữ được luật trên thì mục của bản đó nói rõ.

Khi đó chỉ còn một cách: khôi phục bản sao lưu ở mục 2, rồi chạy image cũ. **Mọi dữ liệu phát sinh sau lúc
sao lưu sẽ mất.**

```bash
pg_restore --clean --if-exists --dbname="postgresql://<owner>:<mk>@<host>:5432/<db>" creatoros-truoc-<ban-moi>.dump
```

Không có lệnh "migration ngược". Đừng tự xoá bảng hay cột để "trả lại như cũ" — cấu trúc lệch khỏi lịch sử
migration thì lần nâng cấp sau sẽ hỏng.

---

## 8. Cần hỗ trợ

Liên hệ Diso, gửi kèm: bản đang chạy · bản muốn lên · đầu ra của lệnh ở mục 4 · kết quả bốn dòng kiểm ở
mục 6. Các đầu ra đó **không** chứa mã bản quyền hay mật khẩu.
