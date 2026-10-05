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

## 4a. Kiểm cấu hình bằng image mới — TRƯỚC khi chạy migration và đổi container

Container mới từ chối khởi động nếu thiếu biến bắt buộc hoặc còn biến bị cấm — và nó chỉ báo SAU khi container cũ đã bị thay. Chạy lệnh kiểm dưới đây từ chính image mới, với đúng file `.env` container mới sẽ dùng. Lệnh **chỉ in TÊN biến, không in giá trị**, không mở cổng, không nối cơ sở dữ liệu hay Redis.

```bash
docker run --rm --network none --env-file .env --entrypoint sh <kho ảnh Diso cấp>/creator-os/app:vX.Y.Z -c 'cd /repo && pnpm --filter @app/api preflight:env'; echo "mã thoát: $?"
```

| Mã thoát | Nghĩa | Dòng in ra |
|---|---|---|
| `0` | đạt | `OK: required variables present, no forbidden setting` |
| `1` | thiếu biến phải CÓ | `REQUIRED: <tên> MISSING` cho từng biến thiếu (`JWT_SECRET`, `INTERNAL_API_SECRET`) |
| `2` | còn biến/giá trị bị cấm | `FORBIDDEN: DEV_FIXED_OTP SET` (khi `APP_ENV` khác `develop`), `FORBIDDEN: PARTNER_SANDBOX_ENABLED SET` (khi `APP_ENV` không phải `develop` hay `staging`, tức `release`, `partner` hoặc để trống), hoặc `FORBIDDEN: AUTH_PROVIDER_MODE=mock SET` |
| `3` | cả hai | cả hai loại dòng trên |

Mã khác `0` thì **dừng**: sửa `.env` rồi chạy lại, chưa đi tiếp. Lệnh này chỉ kiểm hai nhóm luật đó, không thay lớp chặn lúc khởi động.

**Máy staging (sân thử riêng cho đối tác).** Cửa "gửi thử một thông báo tất toán mẫu" chỉ được bật ở sân thử. Trên máy staging: đặt `APP_ENV=staging` ở **cấu hình chạy** của máy (file compose hoặc file môi trường mà container đọc lúc khởi động) — **không** đổi build-arg của image — rồi đặt `PARTNER_SANDBOX_ENABLED=true`. Chạy lại lệnh kiểm ở trên: phải ra mã thoát `0`. **Production, `release` và `partner` không bao giờ định nghĩa `PARTNER_SANDBOX_ENABLED`**; đặt nó ở đó thì lệnh kiểm báo mã `2` và container từ chối khởi động.

---

## 4b. Đếm đợt đối soát đang mở trùng — TRƯỚC khi chạy migration (khi nâng lên bản có ràng buộc "một đợt đang mở")

Chỉ cần với bản nói rõ điều này ở [changelog.md](changelog.md). Migration của bản đó **từ chối chạy** nếu một (đơn vị, chiến dịch, mệnh giá) đang có từ hai đợt chốt kỳ ở trạng thái `PENDING`, và nó **không tự huỷ đợt nào**. Đếm trước, trên bản sao hoặc trên chính cơ sở dữ liệu; kết quả là **số đếm**, không in dữ liệu người chơi.

🔴 **Chạy bằng tài khoản BỎ QUA bảo mật theo hàng** — tài khoản có `BYPASSRLS` hoặc là superuser, **cùng loại với tài khoản chạy migration** (mục 4). Tài khoản chỉ đọc thông thường bị bảo mật theo hàng che hàng của các đơn vị khác nên trả **0 sai**; bạn đi tiếp, rồi migration (chạy bằng tài khoản có `BYPASSRLS` như mục 4) vẫn dừng lúc nâng bản. Kiểm tài khoản trước khi đếm: `SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user;` phải ra `t`.

```sql
SELECT count(*) AS so_bo_ba_bi_trung
FROM (
  SELECT tenant_id, campaign_id, denomination_code
  FROM creator_os.point_settlement_batches
  WHERE status = 'PENDING'
  GROUP BY tenant_id, campaign_id, denomination_code
  HAVING count(*) > 1
) d;
```

| Kết quả | Việc làm |
|---|---|
| `0` | đi tiếp mục 4 |
| lớn hơn `0` | **dừng**: bộ phận vận hành huỷ hoặc xác nhận đợt thừa trên màn Chốt kỳ điểm (quyết định nghiệp vụ), rồi đếm lại tới khi ra `0` |

---

## 4c. Biến tuỳ chọn mới của màn đối soát điểm (đều có mặc định — không đặt cũng chạy)

Bốn biến giới hạn kích thước danh sách chi tiết và file xuất của màn đối soát. Giá trị không phải số nguyên dương thì hệ thống dùng lại mặc định. Các mặc định là **ước lượng, chưa đo** trên dữ liệu thật; nếu bạn có chiến dịch rất lớn và gặp lỗi "quá lớn", tăng giá trị rồi báo lại số liệu thật cho Diso.

| Biến | Mặc định | Giới hạn gì |
|---|---|---|
| `RECONCILIATION_LINES_MAX_EVENTS` | `100000` | số sự kiện tối đa trong danh sách chi tiết đối soát |
| `RECONCILIATION_LINES_MAX_ENTRIES` | `500000` | số dòng ghi điểm tối đa trong danh sách chi tiết đối soát |
| `RECONCILIATION_EXPORT_MAX_ROWS_XLSX` | `50000` | số dòng tối đa của file xuất Excel |
| `RECONCILIATION_EXPORT_MAX_ROWS_CSV` | `200000` | số dòng tối đa của file xuất CSV |

Chạm trần là **lỗi báo rõ**, không bao giờ cắt lặng lẽ: danh sách hoặc file không bao giờ dừng ở N dòng mà trông như đã đủ.

---

## 4d. Kiểm tài khoản chạy migration có quyền bỏ qua bảo mật theo hàng — TRƯỚC khi chạy migration

Một số migration tạo hàm chạy bằng quyền của người tạo hàm (`SECURITY DEFINER`) và **từ chối chạy** nếu chủ sở hữu hàm không có `BYPASSRLS` (lỗi có chữ `owned by BYPASSRLS role`). Thiếu thuộc tính này, nâng bản dừng giữa chừng, các migration đã chạy không tự hoàn lại, bạn phải khôi phục bản chụp cơ sở dữ liệu. Kiểm trước, chỉ đọc, bằng chính tài khoản chạy migration (mục 4):

```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user;
```

| Kết quả | Việc làm |
|---|---|
| `rolbypassrls` là `t` | đi tiếp mục 4 |
| `rolbypassrls` là `f` | **dừng** (kể cả khi tài khoản là siêu người dùng: các migration chỉ đọc thuộc tính `rolbypassrls`, siêu người dùng chưa gán thuộc tính này vẫn làm migration dừng): quản trị cơ sở dữ liệu (siêu người dùng) chạy `ALTER ROLE <tài khoản chạy migration> BYPASSRLS;`, ghi giờ và người chạy vào nhật ký nâng bản, rồi chạy lại câu trên |

Kiểm thêm các hàm `SECURITY DEFINER` đã có mà chủ sở hữu không bỏ qua bảo mật theo hàng. Kết quả phải là **không dòng nào**:

```sql
SELECT p.proname, o.rolname AS chu_so_huu
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles o ON o.oid = p.proowner
WHERE n.nspname = 'creator_os' AND p.prosecdef AND NOT o.rolbypassrls;
```

Có dòng thì chủ sở hữu hàm đó đã mất `BYPASSRLS` (ví dụ ai đó thu lại sau lần nâng bản trước): hàm kiểm soát sẽ đọc thiếu hàng. Cấp lại thuộc tính cho chủ sở hữu, hoặc báo Diso.

🔴 **Đừng thu `BYPASSRLS` lại sau khi nâng bản.** Hàm `SECURITY DEFINER` chạy bằng thuộc tính của chủ sở hữu mỗi lần được gọi. Tài khoản chạy migration chỉ dùng cho `migrate deploy`, không bao giờ đặt làm `DATABASE_URL` của ứng dụng lúc chạy.

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
