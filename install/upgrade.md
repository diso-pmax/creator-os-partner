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

Container mới từ chối khởi động nếu thiếu biến bắt buộc hoặc còn biến bị cấm — và nó chỉ báo SAU khi container cũ đã bị thay. Chạy lệnh kiểm dưới đây từ chính image mới, với đúng file `.env` container mới sẽ dùng. Lệnh **chỉ in TÊN biến, không in giá trị** (một ngoại lệ: `PLATFORM_BASE_DOMAINS` là danh sách tên miền công khai, không phải bí mật, nên được in cả giá trị để bạn thấy nó sai ở đâu), không mở cổng, không nối cơ sở dữ liệu hay Redis.

```bash
docker run --rm --network none --env-file .env --entrypoint sh <kho ảnh Diso cấp>/creator-os/app:vX.Y.Z -c 'cd /repo && pnpm --filter @app/api preflight:env'; echo "mã thoát: $?"
```

| Mã thoát | Nghĩa | Dòng in ra |
|---|---|---|
| `0` | đạt | `OK: required variables present, no forbidden setting` |
| `1` | thiếu biến phải CÓ | `REQUIRED: <tên> MISSING` cho từng biến thiếu (`JWT_SECRET`, `INTERNAL_API_SECRET`) |
| `2` | còn biến/giá trị bị cấm | `FORBIDDEN: DEV_FIXED_OTP SET` (khi `APP_ENV` khác `develop`), `FORBIDDEN: PARTNER_SANDBOX_ENABLED SET` (khi `APP_ENV` không phải `develop` hay `staging`, tức `release`, `partner` hoặc để trống), hoặc `FORBIDDEN: AUTH_PROVIDER_MODE=mock SET` |
| `3` | cả hai | cả hai loại dòng trên |
| `4` | `PLATFORM_BASE_DOMAINS` đã đặt nhưng không phần tử nào dùng được | `PLATFORM_BASE_DOMAINS: …is set but no entry is a usable base hostname…` kèm cách sửa. Container mới sẽ **từ chối khởi động** với cùng lý do |
| `5`, `6`, `7` | mã `4` cộng với `1` và/hoặc `2` | các loại dòng tương ứng |

Ngoài bảng trên, lệnh còn in dòng `WARN: PLATFORM_BASE_DOMAINS entry '<giá trị gốc>' is used as '<giá trị dùng>' (…)` hoặc `… is not used (…)` cho từng phần tử của `PLATFORM_BASE_DOMAINS` phải sửa hình dạng hoặc bị bỏ. Dòng `WARN` **không** đổi mã thoát, nhưng nên sửa `.env` cho sạch: container mới in đúng các dòng này lúc khởi động.

Mã khác `0` thì **dừng**: sửa `.env` rồi chạy lại, chưa đi tiếp. Lệnh này kiểm ba nhóm luật đó (biến bắt buộc, biến bị cấm, `PLATFORM_BASE_DOMAINS`), không thay lớp chặn lúc khởi động.

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

## 4e. Kiểm chủ sở hữu cơ sở dữ liệu — TRƯỚC khi chạy migration

Migration đổi cấu trúc nên **tài khoản chạy migration phải là CHỦ** của thứ nó đổi: kiểu liệt kê (`enum`), bảng, hàm, schema; và phải có quyền tạo extension trên cơ sở dữ liệu. **Ngoại lệ:** tài khoản là siêu người dùng (superuser) vượt kiểm tra sở hữu, nên lẫn chủ không chặn nó; lỗi `must be owner` chỉ xảy ra với tài khoản thường. Cơ sở dữ liệu do một tài khoản khác dựng, ví dụ khôi phục bản sao lưu bằng tài khoản quản trị, thường **lẫn chủ**: bảng thuộc một tài khoản, kiểu và hàm thuộc tài khoản khác. Khi đó migration dừng giữa chừng với `must be owner of type …` (mã `42501`) hoặc `permission denied to create extension …`, và công cụ migration từ chối chạy tiếp (`P3009`). Kiểm trước thì chỉ mất vài giây; bỏ qua thì dừng ở giữa lần nâng bản.

🔴 **Điều cần đúng:** MỘT chủ duy nhất cho mọi đối tượng, và chủ đó là **chính tài khoản chạy migration** (tài khoản trong `DATABASE_URL_MIGRATE`). Ba extension `citext`, `btree_gist`, `pgcrypto` nằm trong schema `creator_os`: extension nằm ở schema khác (thường `public`) làm migration báo `function digest(…) does not exist`.

**Bước 1, chỉ đọc.** Lưu đoạn sau thành file `kiem-chu-so-huu.sql`, chạy bằng tài khoản quản trị trên cơ sở dữ liệu **chính** (cần `psql` từ phiên bản 10). Thay `<tài khoản migration>` bằng tên tài khoản trong `DATABASE_URL_MIGRATE`:

```sql
\set ON_ERROR_STOP on
\if :{?migrate_role}
\else
  DO $$BEGIN RAISE EXCEPTION 'Thieu -v migrate_role=<tai khoan chay migration>'; END$$;
\endif
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname !~ '^pg_' ORDER BY rolname;
SELECT current_database() AS database, pg_get_userbyid(datdba) AS database_owner, :'migrate_role' AS migrate_role,
       (SELECT rolsuper FROM pg_roles WHERE rolname = :'migrate_role') AS migrate_is_superuser,
       has_database_privilege(:'migrate_role', current_database(), 'CREATE') AS migrate_can_create
  FROM pg_database WHERE datname = current_database();
SELECT usename AS connected_as, application_name, count(*) AS sessions
  FROM pg_stat_activity WHERE datname = current_database() AND usename IS NOT NULL GROUP BY 1, 2 ORDER BY 3 DESC;
SELECT extname, pg_get_userbyid(extowner) AS extension_owner, extnamespace::regnamespace AS in_schema FROM pg_extension ORDER BY 1;
CREATE TEMP VIEW owners AS
  SELECT 'database' AS kind, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = current_database()
  UNION ALL SELECT 'schema', pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'creator_os'
  UNION ALL SELECT 'enum', pg_get_userbyid(t.typowner) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'creator_os' AND t.typtype = 'e' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = t.oid AND d.deptype = 'e')
  UNION ALL SELECT 'table', pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'creator_os' AND c.relkind IN ('r', 'p', 'S', 'v', 'm') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('e', 'a'))
  UNION ALL SELECT 'function', pg_get_userbyid(p.proowner) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'creator_os' AND p.prokind IN ('f', 'p') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e');
SELECT kind, owner, count(*) AS n FROM owners GROUP BY 1, 2 ORDER BY 1, 2;
SELECT count(*) AS objects_not_owned_by_migrate_role, count(DISTINCT owner) AS distinct_owners FROM owners WHERE owner <> :'migrate_role';
SELECT count(*) AS extensions_outside_creator_os FROM pg_extension
  WHERE extname IN ('citext', 'btree_gist', 'pgcrypto') AND extnamespace::regnamespace::text <> 'creator_os';
```

```bash
psql "<kết nối tài khoản quản trị>" -X -q -v migrate_role=<tài khoản migration> -f kiem-chu-so-huu.sql
```

| Kết quả | Nghĩa |
|---|---|
| `objects_not_owned_by_migrate_role` = `0`, `migrate_can_create` = `t`, `extensions_outside_creator_os` = `0` | **đúng**, đi tiếp mục 4 |
| `objects_not_owned_by_migrate_role` lớn hơn `0` và `migrate_is_superuser` = `f` | lẫn chủ và tài khoản migration là tài khoản thường: bảng `kind, owner, n` cho biết loại đối tượng nào do ai sở hữu. Làm bước 2 |
| `objects_not_owned_by_migrate_role` lớn hơn `0` và `migrate_is_superuser` = `t` | lẫn chủ **không chặn** siêu người dùng: bước 2 là tuỳ chọn (chỉ làm nếu muốn gom về một chủ cho gọn). Vẫn xử lý dòng `extensions_outside_creator_os` nếu lớn hơn `0` |
| `migrate_can_create` = `f` và extension `pgcrypto` chưa có | tài khoản migration không tạo được extension: bước 2 (đổi chủ cơ sở dữ liệu) |
| `extensions_outside_creator_os` lớn hơn `0` | `ALTER EXTENSION <tên> SET SCHEMA creator_os;` (cột `in_schema` cho biết extension nào), rồi chạy lại bước 1 |

Dòng `connected_as` cho biết ứng dụng và tác vụ nền đang kết nối bằng tài khoản nào: kỳ vọng `creator_os_app` và `creator_os_worker`, **không** phải tài khoản chủ sở hữu (tài khoản chủ vượt quy tắc lọc theo đơn vị).

**Bước 2, chỉ khi bước 1 báo lẫn chủ.** Sao lưu cơ sở dữ liệu trước (mục 2). Chạy lúc vắng và **tạm dừng tác vụ nền** (nó giữ giao dịch lâu nhất). Lưu đoạn sau thành file `doi-chu-so-huu.sql`: nó chỉ đổi chủ, không đổi dữ liệu, chỉ đụng schema `creator_os` và cơ sở dữ liệu, chạy lại được, và hoàn tác toàn bộ nếu sau 15 giây không lấy được khoá:

```sql
\set ON_ERROR_STOP on
BEGIN;
-- Moi ALTER lay khoa ACCESS EXCLUSIVE tren doi tuong cho toi COMMIT: sau 15 giay khong lay duoc khoa thi huy ca khoi (khong doi gi), de khong xep hang chan ung dung.
SET LOCAL lock_timeout = '15s';
SELECT format('ALTER DATABASE %I OWNER TO %I', current_database(), :'migrate_role')
 WHERE pg_get_userbyid((SELECT datdba FROM pg_database WHERE datname = current_database())) <> :'migrate_role' \gexec
SELECT format('ALTER SCHEMA creator_os OWNER TO %I', :'migrate_role')
 WHERE pg_get_userbyid((SELECT nspowner FROM pg_namespace WHERE nspname = 'creator_os')) <> :'migrate_role' \gexec
SELECT format('ALTER TYPE %I.%I OWNER TO %I', n.nspname, t.typname, :'migrate_role')
  FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
 WHERE n.nspname = 'creator_os' AND t.typtype = 'e' AND pg_get_userbyid(t.typowner) <> :'migrate_role'
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = t.oid AND d.deptype = 'e') \gexec
SELECT format('ALTER %s %I.%I OWNER TO %I',
              CASE c.relkind WHEN 'S' THEN 'SEQUENCE' WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'TABLE' END,
              n.nspname, c.relname, :'migrate_role')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'creator_os' AND c.relkind IN ('r', 'p', 'S', 'v', 'm') AND pg_get_userbyid(c.relowner) <> :'migrate_role'
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('e', 'a')) \gexec
SELECT format('ALTER FUNCTION %I.%I(%s) OWNER TO %I', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), :'migrate_role')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'creator_os' AND p.prokind IN ('f', 'p') AND pg_get_userbyid(p.proowner) <> :'migrate_role'
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') \gexec
COMMIT;
```

```bash
psql "<kết nối tài khoản quản trị>" -X -v ON_ERROR_STOP=1 -v migrate_role=<tài khoản migration> -f doi-chu-so-huu.sql
```

Chạy lại bước 1: mọi dòng phải đúng. Quyền của `creator_os_app` và `creator_os_worker` trên bảng và hàm **không đổi** khi đổi chủ. Đừng dùng `REASSIGN OWNED BY`: lệnh đó chuyển mọi đối tượng của tài khoản cũ trong cả cơ sở dữ liệu, kể cả schema khác.

**Nếu migration đã dừng** (lỗi `P3009: migrate found failed migrations`): sau khi bước 2 xong, đánh dấu migration hỏng là đã lùi rồi chạy lại. Tên migration hỏng nằm trong thông báo lỗi:

```bash
docker run --rm --env-file .env --entrypoint sh <kho ảnh Diso cấp>/creator-os/app:vX.Y.Z \
  -c 'cd /repo && DATABASE_URL="$DATABASE_URL_MIGRATE" pnpm --filter @app/db exec prisma migrate resolve --rolled-back <tên migration hỏng>'
```

rồi chạy lại lệnh ở mục 4. Sau lần nâng bản đầy đủ, mỗi tài khoản `creator_os_app` và `creator_os_worker` thiếu quyền đọc đúng **một** bảng (bảng nhận gói tin từ sàn, cố ý thu quyền), xem câu ② ở [hướng dẫn cài](reward-only-setup.md).

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

## 6b. Kiểm tên miền cũ nằm dưới tên miền gốc của nền tảng — làm SAU mục 6, khi bản có chặn giành tên miền con đã chạy

Chỉ cần với bản nói rõ điều này ở [changelog.md](changelog.md). Trước bản đó, một đơn vị có thể đã thêm làm tên miền riêng một tên **bằng hoặc nằm dưới tên miền gốc của nền tảng** (ví dụ `ten-don-vi-khac.portal.example.com`) mà không cần chứng minh gì. Bản mới chặn việc thêm mới; các dòng đã có từ trước vẫn nằm trong cơ sở dữ liệu và phải được xem lại một lần.

🔴 **Điều kiện:** biến `PLATFORM_BASE_DOMAINS` của container `api` phải đúng khuôn — danh sách **tên máy chủ trần**, cách nhau bằng dấu phẩy, ví dụ `portal.example.com`. **Không** có `https://`, **không** dấu chấm ở đầu hoặc cuối, **không** `*.`, **không** `:cổng`, không khoảng trắng. Sai khuôn thì lớp chặn tắt mà không báo gì. Đoạn kiểm dưới đây tự cắt dấu chấm đầu/cuối nên **chạy xong không báo lỗi không chứng minh biến đúng khuôn**: hãy sao đúng chuỗi từ môi trường của container `api` và đối chiếu từng ký tự với quy tắc trên.

🔴 **Chạy bằng tài khoản BỎ QUA bảo mật theo hàng** — tài khoản có `BYPASSRLS` hoặc là siêu người dùng, cùng loại với tài khoản chạy migration (mục 4). Tài khoản thường thấy thiếu dòng, danh sách trông "sạch" mà không sạch; đoạn kiểm tự từ chối chạy nếu tài khoản không thuộc hai loại trên.

Lưu đoạn sau thành file `kiem-ten-mien.sql`. Nó **không đổi dữ liệu nào** (chỉ tạo một khung nhìn tạm rồi huỷ giao dịch), nên phải chạy trên cơ sở dữ liệu **chính**: một bản sao chỉ đọc sẽ từ chối lệnh tạo khung nhìn tạm. Cần `psql` từ phiên bản 10 trở lên.

```sql
\set ON_ERROR_STOP on
\if :{?bases}
\else
  DO $$BEGIN RAISE EXCEPTION 'Thieu -v bases=<PLATFORM_BASE_DOMAINS>'; END$$;
\endif
SELECT count(*) > 0 AS has_bases,
       string_agg(lower(btrim(b, E' \t\r\n.')), ', ') AS bases_read,
       coalesce(bool_or(lower(btrim(b, E' \t\r\n.')) !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'), false) AS has_bad_base
FROM unnest(string_to_array(:'bases', ',')) AS b WHERE btrim(b, E' \t\r\n.') <> '' \gset
\if :has_bases
  \echo 'bases read:' :bases_read
\else
  DO $$BEGIN RAISE EXCEPTION 'Khong doc duoc ten mien goc nao tu -v bases'; END$$;
\endif
\if :has_bad_base
  DO $$BEGIN RAISE EXCEPTION 'Mot ten mien goc khong phai ten may chu hop le; chi dung dau phay de ngan cach'; END$$;
\endif
SELECT (rolsuper OR rolbypassrls) AS bypass FROM pg_roles WHERE rolname = current_user \gset
\if :bypass
\else
  DO $$BEGIN RAISE EXCEPTION 'Tai khoan khong bo qua duoc bao mat theo hang: danh sach se thieu dong'; END$$;
\endif
BEGIN;
CREATE TEMP VIEW kiem_ten_mien AS
WITH bases AS (
  SELECT DISTINCT lower(btrim(b, E' \t\r\n.')) AS base
  FROM unnest(string_to_array(:'bases', ',')) AS b
  WHERE btrim(b, E' \t\r\n.') <> ''
),
in_zone AS (
  SELECT DISTINCT ON (d.id) d.id, d.hostname, d.tenant_id, d.scope, d.status, d.is_primary, d.created_at,
         lower(rtrim(btrim(d.hostname), '.')) AS h, b.base
  FROM creator_os.domains d
  JOIN bases b
    ON lower(rtrim(btrim(d.hostname), '.')) = b.base
    OR right(lower(rtrim(btrim(d.hostname), '.')), length(b.base) + 1) = '.' || b.base
  ORDER BY d.id, length(b.base) DESC
),
labelled AS (
  SELECT z.*, CASE WHEN z.h = z.base THEN NULL ELSE left(z.h, length(z.h) - length(z.base) - 1) END AS label
  FROM in_zone z
)
SELECT
  CASE
    WHEN l.scope = 'PLATFORM' AND owner.id IS NOT NULL THEN 'REVIEW_PLATFORM_ROW_ON_LIVE_SLUG'
    WHEN l.scope = 'PLATFORM'                          THEN 'OK_PLATFORM_ROW'
    WHEN l.label IS NULL                               THEN 'BAD_TENANT_ROW_ON_BASE'
    WHEN owner.id IS NULL                              THEN 'BAD_TENANT_ROW_NO_LIVE_SLUG_OWNER'
    WHEN owner.id <> l.tenant_id                       THEN 'HIJACK_TENANT_ROW_ON_OTHER_TENANT_SLUG'
    ELSE                                                    'REDUNDANT_OWN_SLUG'
  END AS verdict,
  l.hostname, l.scope, l.status, l.is_primary, l.created_at,
  l.tenant_id AS row_tenant_id, rt.slug AS row_tenant_slug,
  owner.id AS slug_owner_id, owner.slug AS slug_owner_slug, l.id AS domain_id
FROM labelled l
LEFT JOIN creator_os.tenants rt    ON rt.id = l.tenant_id
LEFT JOIN creator_os.tenants owner ON owner.slug = l.label AND owner.deleted_at IS NULL;

SELECT verdict, count(*) AS n, count(*) FILTER (WHERE status = 'ACTIVE') AS active
FROM kiem_ten_mien GROUP BY verdict ORDER BY verdict;
SELECT * FROM kiem_ten_mien ORDER BY verdict, hostname;
ROLLBACK;
```

Chạy (bỏ phần `?schema=…` khỏi địa chỉ kết nối, vì `psql` không nhận tham số đó):

```bash
psql "${DATABASE_URL_MIGRATE%%\?*}" -X -q -v bases='portal.example.com' -f kiem-ten-mien.sql
```

Thay `portal.example.com` bằng **đúng** giá trị `PLATFORM_BASE_DOMAINS` đang chạy.

| `verdict` | Nghĩa | Việc làm |
|---|---|---|
| Không có dòng nào **và dòng `bases read:` ở đầu kết quả hiện đúng tên miền gốc của bạn** | không có tên miền riêng nào nằm dưới tên miền gốc | xong |
| `HIJACK_TENANT_ROW_ON_OTHER_TENANT_SLUG` | **một đơn vị đang giữ tên miền con của đơn vị khác** | nặng nhất — gỡ dòng đó (xem *Ai gỡ, ở đâu* dưới), rồi báo đơn vị bị ảnh hưởng nếu cần |
| `BAD_TENANT_ROW_ON_BASE` · `BAD_TENANT_ROW_NO_LIVE_SLUG_OWNER` | một đơn vị giữ chính tên miền gốc, một tên được dành riêng hoặc một tên chưa đơn vị nào dùng | gỡ |
| `REVIEW_PLATFORM_ROW_ON_LIVE_SLUG` | dòng do nền tảng tạo, nằm trên tên miền con của một đơn vị đang hoạt động | xem lại từng dòng |
| `REDUNDANT_OWN_SLUG` · `OK_PLATFORM_ROW` | vô hại | để nguyên |

**Ai gỡ, ở đâu.** Dòng của đơn vị khác thì đơn vị đó không tự gỡ giúp bạn được: người **quản trị nền tảng** gỡ. Trong Console, vào chế độ nền tảng, nhóm **Đơn vị**, mở đơn vị có tên ở cột `row_tenant_slug`, chọn thẻ **Tên miền**, bấm **Gỡ** ở dòng có đúng tên máy chủ trong cột `hostname`, rồi xác nhận **Gỡ tên miền?**.

🔴 **Chỉ gỡ bằng chức năng "gỡ tên miền" SAU KHI bản có chặn đã chạy.** Trên bản cũ, gỡ một dòng nằm dưới tên miền gốc sẽ xếp việc xoá chứng chỉ và có thể xoá chứng chỉ wildcard của nền tảng.

⚠️ Định bỏ một tên khỏi `PLATFORM_BASE_DOMAINS`: chạy lại đoạn kiểm cho tên đó và dọn **trước** khi bỏ. Bỏ rồi thì các dòng còn sót quay lại chỗ quyết định tên máy chủ bằng khớp đúng tên.

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

**Ngoại lệ: quay lui "được" về cấu trúc nhưng hỏng dữ liệu âm thầm.** Image cũ chạy được trên cơ sở dữ liệu mới,
nhưng đọc sai thứ mới ghi, và khôi phục bản sao lưu cũng không phải lối ra (mất mọi dữ liệu sau lúc sao lưu).
Ví dụ v1.3: sau khi có chiến dịch khai brand tài trợ theo hình `{code, name}`, image cũ bỏ hết bản ghi ⇒ người
chơi mất điểm mà không có lỗi nào. Với những mục như vậy changelog ghi rõ điều kiện, và cách xử là **sửa tiến**
(vá, phát hành bản sau), không quay lui.

---

## 8. Cần hỗ trợ

Liên hệ Diso, gửi kèm: bản đang chạy · bản muốn lên · đầu ra của lệnh ở mục 4 · kết quả bốn dòng kiểm ở
mục 6. Các đầu ra đó **không** chứa mã bản quyền hay mật khẩu.

### Khuôn đúng của `PLATFORM_BASE_DOMAINS`

Biến này là danh sách tên miền gốc của nền tảng, **phẩy phân cách**, mỗi phần tử là một tên miền trần có **ít nhất hai nhãn**: `portal.example.com` hoặc `portal.example.com,creator.example.org`. Phần tử **đầu tiên** là tên miền mà người dùng được đưa về sau khi đăng nhập, nên thứ tự là do bạn chọn. Hai tên miền lồng nhau (`example.com,portal.example.com`) thì tên **dài hơn** được dùng cho host khớp nó, bất kể thứ tự khai.

| Bạn viết | Hệ thống dùng | Khởi động |
|---|---|---|
| `portal.example.com` | `portal.example.com` | im lặng |
| `https://portal.example.com`, `.portal.example.com`, `portal.example.com.`, `*.portal.example.com`, `PORTAL.example.com` | `portal.example.com` | chạy, in một cảnh báo cho phần tử đó (viết hoa và khoảng trắng thì không cảnh báo) |
| `portal.example.com:443`, `portal.example.com/console`, `localhost`, ký tự lạ | **bỏ phần tử đó**, không đoán | chạy nếu còn phần tử khác dùng được, in cảnh báo nêu lý do |
| đã đặt nhưng **không còn** phần tử nào dùng được | không có tên miền gốc nào | **từ chối khởi động** ở production (ngoài production chỉ cảnh báo) |
| không đặt, hoặc để trống | không có tên miền con của nền tảng | chạy, không cảnh báo: đây là cài đặt hợp lệ khi bạn không dùng `{slug}.<tên miền gốc>` |

Cảnh báo trông như sau (nêu giá trị gốc → giá trị dùng):

```
[api-runtime] WARNING: PLATFORM_BASE_DOMAINS entry 'https://portal.example.com.' is used as 'portal.example.com' (scheme removed, leading/trailing dot removed)
[api-runtime] WARNING: PLATFORM_BASE_DOMAINS entry 'portal.example.com:443' is not used (not a base hostname: a port)
```

Vì sao phải đúng: biến này quyết định địa chỉ `{slug}.<tên miền gốc>` của từng đơn vị **và** hàng rào chặn đơn vị này chiếm tên miền con của đơn vị khác. Giá trị sai hình dạng từng làm hàng rào tắt mà không báo. **Nâng bản từ phiên bản cũ lên bản có phép kiểm này:** nếu `.env` đang có giá trị mà không phần tử nào dùng được (ví dụ chỉ `localhost`), container mới sẽ không lên và `preflight:env` ở bước 4a trả mã `4`. Sửa `.env` trước khi đổi container.
