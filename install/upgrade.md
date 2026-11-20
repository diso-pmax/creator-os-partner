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

Khi nâng nhiều bản một lúc: **dừng ứng dụng trước, rồi mới sao lưu, rồi mới chạy migration (mục 4)** — sao
lưu phải lấy ngay trước migration, lúc không còn gì ghi vào cơ sở dữ liệu. Khôi phục bản này thế nào: mục 7.

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
| `2` | còn biến/giá trị bị cấm | `FORBIDDEN: DEV_FIXED_OTP SET` (khi `APP_ENV` khác `develop`), `FORBIDDEN: PARTNER_SANDBOX_ENABLED SET` (khi `APP_ENV` không phải `develop` hay `staging`, tức `release`, `partner` hoặc để trống), `FORBIDDEN: PARTNER_EGRESS_TEST_ORIGINS SET` (khi `NODE_ENV` không phải `test`/`development` HOẶC `APP_ENV` không phải `local`/`ci`/`test`; xem khung bên dưới), hoặc `FORBIDDEN: AUTH_PROVIDER_MODE=mock SET` |
| `3` | cả hai | cả hai loại dòng trên |
| `4` | `PLATFORM_BASE_DOMAINS` đã đặt nhưng không phần tử nào dùng được | `PLATFORM_BASE_DOMAINS: …is set but no entry is a usable base hostname…` kèm cách sửa. Container mới sẽ **từ chối khởi động** với cùng lý do |
| `5`, `6`, `7` | mã `4` cộng với `1` và/hoặc `2` | các loại dòng tương ứng |

Ngoài bảng trên, lệnh còn in dòng `WARN: PLATFORM_BASE_DOMAINS entry '<giá trị gốc>' is used as '<giá trị dùng>' (…)` hoặc `… is not used (…)` cho từng phần tử của `PLATFORM_BASE_DOMAINS` phải sửa hình dạng hoặc bị bỏ. Dòng `WARN` **không** đổi mã thoát, nhưng nên sửa `.env` cho sạch: container mới in đúng các dòng này lúc khởi động.

🔴 **`PARTNER_EGRESS_TEST_ORIGINS` không bao giờ được đặt ở môi trường thật** (production, staging, develop, và cả image khách tự lưu trữ). Biến này chỉ dành cho sân kiểm thử L4 do `e2e/boot-flow.sh` dựng: nó mở lớp chặn gọi ra địa chỉ nội bộ cho vài origin loopback. Một image khách tự lưu trữ **có thể chạy với `NODE_ENV=development`**, nên `NODE_ENV` một mình không đủ để tin; lớp chặn thật là **`APP_ENV`**: biến chỉ có hiệu lực khi `APP_ENV` là `local`, `ci` hoặc `test` (và `NODE_ENV` là `test` hoặc `development`), còn đặt ở nơi khác thì API và worker **từ chối khởi động** và lệnh trên báo mã `2`. Gặp dòng `FORBIDDEN: PARTNER_EGRESS_TEST_ORIGINS SET` thì **xoá biến khỏi cấu hình chạy**, đừng đổi `APP_ENV` cho qua.

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

## 4d. Thuộc tính của tài khoản chạy migration — lệnh ở mục 4 kiểm và vá, không có câu nào phải gõ tay

Một số migration tạo hàm chạy bằng quyền của người tạo hàm (`SECURITY DEFINER`) và **từ chối chạy** nếu chủ sở hữu hàm không có `BYPASSRLS` (lỗi có chữ `owned by BYPASSRLS role`). Siêu người dùng chưa gán thuộc tính này cũng làm migration dừng.

Lệnh `db:prepare` ở mục 4 đọc thuộc tính của tài khoản migration **trước** khi chạy migration: có tài khoản quản trị thì tự đặt `BYPASSRLS`; không có thì in đúng câu `ALTER ROLE … BYPASSRLS` cho quản trị viên chạy và **không chạy migration** cho tới khi đúng. Chủ của mọi hàm là chính tài khoản migration (mục 4e kiểm điều này), nên các hàm kiểm soát luôn đọc đủ hàng.

🔴 **Đừng thu `BYPASSRLS` lại sau khi nâng bản.** Hàm `SECURITY DEFINER` chạy bằng thuộc tính của chủ sở hữu mỗi lần được gọi. Tài khoản chạy migration chỉ dùng cho `migrate deploy`, không bao giờ đặt làm `DATABASE_URL` của ứng dụng lúc chạy. Lệnh `db:prepare` từ chối chạy nếu ba chuỗi kết nối trùng tài khoản.

---

## 4e. Chủ sở hữu cơ sở dữ liệu — lệnh ở mục 4 kiểm trước khi chạy migration

Thưởng trong Program: hai migration có mốc `20261022042900` và `20261022045900` dùng từng câu `CREATE UNIQUE INDEX CONCURRENTLY`, rồi gắn UNIQUE constraint ở migration kế tiếp. Khi dựng bị hủy, dùng phép kiểm `pg_index.indisvalid` và `pg_constraint` bên dưới, đối chiếu tên chỉ mục trong thông báo lỗi của đúng hai mốc nâng cấp này. Chỉ xóa chỉ mục dở INVALID chưa được gắn constraint sau khi xác minh, rồi làm lại theo quy trình migration hỏng bên dưới; không xóa constraint đang hợp lệ. Chưa có số đo lock trên dữ liệu production.

Migration đổi cấu trúc nên **tài khoản chạy migration phải là CHỦ** của thứ nó đổi: kiểu liệt kê (`enum`), bảng, hàm, schema; và phải tạo được extension. Cơ sở dữ liệu do một tài khoản khác dựng, ví dụ khôi phục bản sao lưu bằng tài khoản quản trị, thường **lẫn chủ**: bảng thuộc một tài khoản, kiểu và hàm thuộc tài khoản khác. Migration chạy trên đó sẽ dừng giữa chừng với `must be owner of type …` (mã `42501`) hoặc `permission denied to create extension …`, và công cụ migration từ chối chạy tiếp (`P3009`).

Lệnh `db:prepare` ở mục 4 kiểm điều này **trước** khi chạy migration. Đúng thì in:

```
ownership: every object of creator_os belongs to the migration account "creator_os_migrate".
```

Lẫn chủ thì nó **không chạy migration**, in số đối tượng theo loại và theo chủ, và in sẵn các câu `ALTER … OWNER TO` cần chạy (nó không tự đổi chủ vì mỗi câu khoá đối tượng). Cách làm: sao lưu (mục 2), dừng ứng dụng và tác vụ nền, chạy các câu được in ra bằng tài khoản quản trị, rồi chạy lại lệnh ở mục 4. Quyền của `creator_os_app` và `creator_os_worker` trên bảng và hàm **không đổi** khi đổi chủ. Đừng dùng `REASSIGN OWNED BY`: lệnh đó chuyển mọi đối tượng của tài khoản cũ trong cả cơ sở dữ liệu, kể cả schema khác.

Ba extension `citext`, `btree_gist`, `pgcrypto` phải nằm trong schema `creator_os`. Nằm ở schema khác (thường `public`) thì migration báo `function digest(…) does not exist`; lệnh `db:prepare` báo `REPORT ONLY: the extension … is in the schema …` kèm câu `ALTER EXTENSION … SET SCHEMA creator_os` để chạy lúc ứng dụng đã dừng.

**Nếu migration đã dừng** (lỗi `P3009: migrate found failed migrations`): sau khi chủ sở hữu đã đúng (lệnh `db:prepare` in dòng `ownership: every object …`), đánh dấu migration hỏng là đã lùi rồi chạy lại. Tên migration hỏng nằm trong thông báo lỗi:

```bash
docker run --rm --env-file .env --entrypoint sh <kho ảnh Diso cấp>/creator-os/app:vX.Y.Z \
  -c 'cd /repo && DATABASE_URL="$DATABASE_URL_MIGRATE" pnpm --filter @app/db exec prisma migrate resolve --rolled-back <tên migration hỏng>'
```

rồi chạy lại lệnh ở mục 4.

---

## 4f. Soát chữ đã lưu không đọc được — TRƯỚC khi đổi container (khi nâng lên bản làm sạch ô chữ tự do)

Chỉ cần với bản nói rõ điều này ở [changelog.md](changelog.md). Từ bản đó, ô chữ người dùng gõ mà chỉ gồm ký tự không hiện được (ví dụ chỉ U+200B, U+3164 hoặc U+00AD) thì tính là rỗng. Năm loại tài liệu đã lưu được ứng dụng đọc lại theo khuôn: chính sách link chương trình (bản đã xuất bản và bản nháp), các bước hướng dẫn của chiến dịch, phiên bản cấu hình chiến dịch, phiên bản tài liệu CMS. Một ô chữ trong đó mà chỉ gồm ký tự không hiện được thì bản mới từ chối: link chương trình báo lỗi 500, đơn trang bán hàng mất ghi nhận tiếp thị mà không báo, trang chủ trang bán hàng hiện trống và màn sửa của nó không tải được khối nào (lần lưu sau ghi đè chúng), xuất bản chiến dịch báo `409 revision_invalid`.

🔴 **Chạy bằng tài khoản BỎ QUA bảo mật theo hàng** — tài khoản có `BYPASSRLS` hoặc là siêu người dùng, cùng loại với tài khoản chạy migration (mục 4). Tài khoản thường thấy thiếu dòng, kết quả trông "sạch" mà không sạch; đoạn kiểm tự từ chối chạy nếu tài khoản không thuộc hai loại trên.

Lưu đoạn sau thành file `kiem-chu-khong-doc-duoc.sql`. Nó **chỉ đọc, không đổi dữ liệu nào**.

```sql
\set ON_ERROR_STOP on
\pset footer off
SELECT (rolsuper OR rolbypassrls) AS bypass FROM pg_roles WHERE rolname = current_user \gset
\if :bypass
\else
  DO $$BEGIN RAISE EXCEPTION 'This account does not bypass row-level security: the list would miss rows'; END$$;
\endif
SELECT '^[[:space:]\u0001-\u001F\u007F-\u009F\u00A0\u00AD\u034F\u0600-\u0605\u061C\u06DD\u070F\u0890-\u0891\u08E2\u115F-\u1160\u1680\u17B4-\u17B5\u180B-\u180F\u2000-\u200F\u2028-\u202F\u205F-\u206F\u2800\u3000\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFFB\uFFFD]*$' AS nothing_readable \gset

WITH stored_text AS (
  SELECT 'link revision' AS source, r.tenant_id, r.id AS row_id, v.v AS value
  FROM creator_os.program_link_revisions r, LATERAL jsonb_path_query(r.policy, 'strict $.**', '{}', true) AS v(v)
  UNION ALL
  SELECT 'link draft', c.tenant_id, c.id, v.v
  FROM creator_os.program_link_configs c, LATERAL jsonb_path_query(c.draft, 'strict $.**', '{}', true) AS v(v)
  UNION ALL
  SELECT 'guide steps', m.origin_tenant_id, m.id, v.v
  FROM creator_os.missions m, LATERAL jsonb_path_query(m.display_config, 'strict $.**', '{}', true) AS v(v)
  UNION ALL
  SELECT 'campaign version', cv.tenant_id, cv.id, v.v
  FROM creator_os.campaign_versions cv, LATERAL jsonb_path_query(cv.config, 'strict $.**', '{}', true) AS v(v)
  UNION ALL
  SELECT 'cms document version', d.tenant_id, d.id, v.v
  FROM creator_os.cms_document_versions d, LATERAL jsonb_path_query(d.fields, 'strict $.**', '{}', true) AS v(v)
)
SELECT source, tenant_id, row_id, value #>> '{}' AS value
FROM stored_text
WHERE jsonb_typeof(value) = 'string'
  AND (value #>> '{}') ~ :'nothing_readable'
  AND (value #>> '{}') !~ '^[[:space:]]*$'
ORDER BY source, tenant_id, row_id;
```

Chạy (bỏ phần `?schema=…` khỏi địa chỉ kết nối, vì `psql` không nhận tham số đó):

```bash
psql "${DATABASE_URL_MIGRATE%%\?*}" -X -q -f kiem-chu-khong-doc-duoc.sql
```

| Kết quả | Việc làm |
|---|---|
| Không có dòng nào | xong, nâng tiếp |
| Có dòng | **dừng nâng**. Cột `source` cho biết loại tài liệu, `row_id` là dòng chứa nó; cột `value` thường trông trống vì chữ đó toàn ký tự không hiện được. Sửa chữ đó trên Console: đổi tên rồi xuất bản bản Link mới, sửa bước hướng dẫn của chiến dịch hoặc khối CMS. Rồi chạy lại đoạn kiểm. Dòng thuộc bản đã xuất bản từ trước (`link revision`, `campaign version`), không sửa được, hoặc dòng không xác định được là ô nào, thì gửi kết quả cho đội phát hành trước khi nâng. |

---

## 4. Chạy migration — bằng image MỚI, TRƯỚC khi đổi container

Cùng thứ tự Diso dùng cho bản cài của chính mình: cấu trúc cơ sở dữ liệu đi trước, ứng dụng đi sau.
Migration hỏng ở bước này thì container cũ vẫn đang chạy — chưa có gì bị gián đoạn.

Một lệnh làm cả hai việc, theo thứ tự: kiểm và vá tài khoản, quyền, chủ sở hữu; **rồi** chạy migration bằng tài khoản chủ sở hữu (không bao giờ bằng tài khoản quản trị); rồi đối chiếu quyền. Nó dừng **trước** migration nếu có gì chưa đúng, để cơ sở dữ liệu không bị bỏ dở nửa chừng. Chi tiết cách đọc kết quả: mục 3 của [hướng dẫn cài](reward-only-setup.md).

**Ứng dụng và tác vụ nền đang chạy hay đã dừng?** Lệnh đặt quyền mặc định cho bảng tương lai **trước** khi chạy migration, rồi mới đối chiếu và thu quyền thừa. Nếu ứng dụng và tác vụ nền đang chạy thì có một cửa sổ ngắn (vài giây) bảng mới mang quyền rộng hơn danh sách khai báo; chấp nhận được vì bản đang chạy chưa biết các bảng đó. Cần danh sách quyền đúng từng giây thì dừng ứng dụng và tác vụ nền trước khi chạy (khi nâng nhiều bản một lúc thì luôn dừng, mục 2).

🔴 **Đừng chạy hai lệnh `db:prepare` cùng lúc.** Phần tạo tài khoản không có khoá; chỉ phần chạy migration tự khoá.

Nhập chuỗi kết nối quản trị bằng biến môi trường, **không gõ thẳng vào dòng lệnh** (lịch sử shell và danh sách tiến trình của máy sẽ giữ lại mật khẩu của tài khoản siêu người dùng). Chuỗi có dạng `postgresql://<tài-khoản-quản-trị>:<mật-khẩu>@<host>:5432/postgres`; ký tự đặc biệt trong mật khẩu viết dạng `%40 %3A %2F %25 %3F %23`:

```bash
printf 'Chuỗi kết nối quản trị: '; read -rs DATABASE_URL_ADMIN; echo; export DATABASE_URL_ADMIN
```

Rồi chạy lệnh (`-e DATABASE_URL_ADMIN` không kèm giá trị):

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

Lệnh dừng và in việc cần làm (mã thoát 1) trong các trường hợp sau; làm đúng các câu được in, rồi chạy lại lệnh y như cũ:

- **Tên tài khoản ứng dụng hoặc tác vụ nền sai** (khác `creator_os_app` / `creator_os_worker`): lệnh in câu `ALTER ROLE … RENAME TO …`. Chạy câu đó bằng tài khoản quản trị, sửa tên người dùng trong `DATABASE_URL` và `DATABASE_URL_WORKER` của `.env`, rồi chạy lại lệnh kèm `--reset-passwords` (cuối dòng `db:prepare`): tài khoản đặt mật khẩu kiểu `md5` bị **xoá mật khẩu** khi đổi tên.
- **Lẫn chủ sở hữu**: mục 4e.
- **Tài khoản migration thiếu `BYPASSRLS`**: mục 4d.

Lỡ chạy migration khi tên còn sai (bản cũ): đổi tên như trên rồi chạy lệnh này, nó tự cấp lại quyền trên mọi bảng và đặt lại quy tắc cấp quyền mặc định.

**Không có tài khoản quản trị** (PostgreSQL do bên khác quản lý): bỏ dòng `-e DATABASE_URL_ADMIN=…`. Lệnh chỉ kiểm, không đổi gì, in các câu SQL cho quản trị viên chạy, và thoát mã 0 khi mọi thứ đã đúng. Khi đã đúng, chạy migration bằng lệnh sau, rồi chạy lại lệnh kiểm để thấy hai dòng `OK`:

```bash
docker run --rm --env-file .env --entrypoint sh <kho ảnh Diso cấp>/creator-os/app:vX.Y.Z \
  -c 'cd /repo && DATABASE_URL="$DATABASE_URL_MIGRATE" pnpm --filter @app/db exec prisma migrate deploy'
```

🔴 **`DATABASE_URL="$DATABASE_URL_MIGRATE"` là bắt buộc trong lệnh này.** Công cụ migration đọc `DATABASE_URL`, mà trong `.env` biến đó là tài khoản **ứng dụng** — không có quyền sửa cấu trúc bảng. (Lệnh `db:prepare` tự gán đúng biến, nên có tài khoản quản trị thì không phải nhớ điều này.)

- `.env` là file cấu hình của bản cài đang chạy, đã bổ sung biến mới theo mục 1.
- Chạy lại lệnh này là an toàn: migration nào đã chạy thì được bỏ qua.
- Lệnh `db:prepare` không in đầu ra của Prisma khi migrate thành công; thấy dòng `done. Every account is right.` là đủ. Nhánh không có tài khoản quản trị (lệnh `prisma migrate deploy` tay): dòng `No pending migrations to apply` nghĩa là bản mới không đổi cấu trúc — vẫn đi tiếp mục 5.
- Xong thì xoá biến khỏi phiên làm việc: `unset DATABASE_URL_ADMIN`.

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
| quyền bảng | `docker logs <container mới> 2>&1 \| grep '\[db-grants\]'` | chỉ có `[db-grants] OK role=creator_os_app …` và `[db-grants] OK role=creator_os_worker …` (mỗi tiến trình một cặp). Dòng `MISMATCH` liệt kê bảng và quyền sai: chạy lại lệnh ở mục 4 |

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

🔴 **Khôi phục vào cơ sở dữ liệu MỚI rồi đổi tên. KHÔNG dùng `pg_restore --clean` đè lên cơ sở dữ liệu đã
migrate.** Đo trên bản sao dữ liệu thật khi nhảy nhiều bản một lúc: `--clean --if-exists` không xoá hết đối
tượng của bản mới (kiểu liệt kê và ràng buộc đã tồn tại, bảng mới còn sót), nên khôi phục báo lỗi giữa chừng
và **các bảng tiền, điểm bị nạp thêm một lần nữa** (bảng giao dịch điểm từ 52.465 lên 104.930 dòng). Kết quả
là cơ sở dữ liệu vừa lệch cấu trúc vừa nhân đôi số liệu mà không có gì báo.

Làm đúng thứ tự, mỗi lệnh một dòng (đổi `<…>` theo máy của bạn):

1. Dừng container ứng dụng và worker (nếu chưa dừng): `docker stop <ten-container-api> <ten-container-worker>`
2. Tạo cơ sở dữ liệu trống mới: `psql "postgresql://<owner>:<mk>@<host>:5432/postgres" -c "CREATE DATABASE creatoros_khoiphuc"`
3. Khôi phục bản sao lưu vào cơ sở dữ liệu mới, **không** có `--clean`, dừng ngay khi có lỗi: `pg_restore --exit-on-error --dbname="postgresql://<owner>:<mk>@<host>:5432/creatoros_khoiphuc" creatoros-truoc-<ban-moi>.dump`. Mã thoát khác `0` hoặc có dòng `error:` ⇒ **DỪNG, không đổi tên**: bỏ bản nạp dở bằng `psql "postgresql://<owner>:<mk>@<host>:5432/postgres" -c "DROP DATABASE creatoros_khoiphuc"`, tìm nguyên nhân, làm lại từ bước 2. Cơ sở dữ liệu cũ chưa bị đụng. Nếu lỗi duy nhất là `COMMENT ON EXTENSION …` (khôi phục bằng tài khoản không đủ quyền trên extension), lập danh sách bỏ mục đó: `pg_restore -l creatoros-truoc-<ban-moi>.dump > ds.txt`, xoá các dòng có `COMMENT - EXTENSION`, rồi chạy lại bước 3 với thêm `-L ds.txt`. (Đo trên PG16 với tài khoản không phải superuser: không gặp lỗi này.)
4. **Kiểm chủ sở hữu và quyền trên bản khôi phục, TRƯỚC khi đổi tên** (chỉ đọc; bỏ được bản khôi phục mà chưa đụng cơ sở dữ liệu cũ). Tạo file cấu hình trỏ vào bản khôi phục, rồi chạy `db:prepare` **không có** `DATABASE_URL_ADMIN` (chế độ chỉ kiểm: nó không bao giờ chạy migration, nên không đẩy bản khôi phục lên cấu trúc mới). Dùng image **mới** cũng được, kể cả khi bản cũ chưa có lệnh này:
   - `(umask 077; sed 's#/<db>?#/creatoros_khoiphuc?#' .env > .env.khoiphuc)` (file này chép toàn bộ bí mật của `.env`, nên chỉ chủ file đọc được)
   - `docker run --rm --env-file .env.khoiphuc --entrypoint sh <kho ảnh Diso cấp>/creator-os/app:vX.Y.Z -c 'cd /repo && pnpm --filter @app/api db:prepare'`
   - đúng khi có dòng `ownership: every object of creator_os belongs to the migration account` và hai dòng `[db-grants] OK role=creator_os_app` / `role=creator_os_worker`. Bảng chỉ có ở bản mới thì không bị đếm vào bản khôi phục;
   - có dòng `ownership: … NOT changed automatically` hoặc `MISMATCH`: **không đổi tên**. Bản sao lưu thật phải mang chủ sở hữu và quyền như cũ. Chạy các câu lệnh in ra bằng tài khoản quản trị trên `creatoros_khoiphuc` rồi kiểm lại. **Không** dùng `--no-owner --no-privileges` trên bản sao lưu thật; hai cờ đó chỉ dùng khi diễn tập trên bản sao đã che quyền;
   - xong thì xoá file tạm: `rm .env.khoiphuc`.
5. Ngắt mọi kết nối còn lại vào cơ sở dữ liệu hiện tại: `psql "postgresql://<owner>:<mk>@<host>:5432/postgres" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('<db>','creatoros_khoiphuc') AND pid <> pg_backend_pid()"`
6. Giữ cơ sở dữ liệu hỏng để điều tra: `psql "postgresql://<owner>:<mk>@<host>:5432/postgres" -c "ALTER DATABASE <db> RENAME TO <db>_loi"`
7. Đưa bản khôi phục vào đúng tên cũ: `psql "postgresql://<owner>:<mk>@<host>:5432/postgres" -c "ALTER DATABASE creatoros_khoiphuc RENAME TO <db>"`
8. Chạy lại container với tag **cũ** (mục 5).

Kiểm sau cùng: số migration đã chạy phải về đúng số trước khi nâng, và các bảng mới của bản vừa lùi không còn.
Đo trên bản sao dữ liệu thật: khôi phục vào cơ sở dữ liệu mới mất khoảng 9 giây, đổi tên chưa tới 1 giây
(sao lưu trước đó khoảng 4 giây). Số này đo trên một bản sao cỡ vài chục MB; thời gian khôi phục tăng theo cỡ
cơ sở dữ liệu của bạn. Thời gian ngắt dịch vụ tính **từ lúc dừng ứng dụng** tới lúc container cũ lên lại.

⚠️ Bản sao lưu **phải** được lấy ngay trước khi chạy migration, lúc ứng dụng đã dừng (mục 2 và 4). Sao lưu
lấy lúc ứng dụng còn ghi thì khôi phục lại sẽ thiếu những gì ghi giữa chừng.

Không có lệnh "migration ngược". Đừng tự xoá bảng hay cột để "trả lại như cũ" — cấu trúc lệch khỏi lịch sử
migration thì lần nâng cấp sau sẽ hỏng.

**Ngoại lệ: quay lui "được" về cấu trúc nhưng hỏng dữ liệu âm thầm.** Image cũ chạy được trên cơ sở dữ liệu mới,
nhưng đọc sai thứ mới ghi, và khôi phục bản sao lưu cũng không phải lối ra (mất mọi dữ liệu sau lúc sao lưu).
Ví dụ v1.5.0: bản này thêm trường `saleDayAmountMinor` vào cửa `DAY` của `earningCaps.windows[]` (ô *Trần điểm ngày sale* trong Console). **Không có migration**, nên image v1.4.x chạy được trên cơ sở dữ liệu của v1.5.0 và không sập, nhưng 🔴 **KHÔNG được lùi API về v1.4.x khi phiên bản đang chạy của bất kỳ chiến dịch nào còn ô đó**: image cũ bỏ qua ô một cách lặng lẽ (trần ngày sale 600 thành 900, **trả dư tối đa 300 điểm cho mỗi người, mỗi ô đã khai, mỗi ngày sale**), và lưu cấu hình còn ô trả 400, xuất bản chiến dịch trả 409 nên cả chiến dịch kẹt. Muốn lùi: gỡ ô ở mọi chỗ đã khai (Console, hộp Sửa, xoá trống ô, Lưu), **xuất bản lại chiến dịch**, rồi mới đổi image; gỡ giữa ngày sale cũng nâng trần, nên gỡ ngoài ngày sale. Còn không thì sửa tiến. Thứ tự, số đo và phần chưa đo ở mục v1.5.0 của [changelog.md](changelog.md).

Ví dụ v1.3: sau khi có chiến dịch khai brand tài trợ theo hình `{code, name}`, image cũ bỏ hết bản ghi ⇒ người
chơi mất điểm mà không có lỗi nào. Với những mục như vậy changelog ghi rõ điều kiện, và cách xử là **sửa tiến**
(vá, phát hành bản sau), không quay lui.

### 7b. Quay lui v1.3.1 về v1.3.0: sao chép ngược nhóm người chơi (tuỳ chọn)

Chỉ cần khi đơn vị đã khai nhóm **sau khi lên v1.3.1** và bạn muốn image v1.3.0 vẫn áp các nhóm đó ở lần vào game. Image cũ chỉ đọc bảng cũ `integration_segment_catalog`, nên đoạn dưới chép nhóm của bảng mới `player_segment_catalog` về bảng cũ, cho **mọi tích hợp** của đơn vị. Chạy **sau khi dừng ứng dụng và worker, TRƯỚC khi đổi sang image cũ**, bằng tài khoản migration (có `BYPASSRLS`, mục 4d). Chạy lại vô hại; nhóm đã có ở bảng cũ bị **ghi đè theo bản mới** (bảng mới là bản đúng sau khi lên v1.3.1).

**Trước khi chạy đoạn dưới, kiểm vai:** tài khoản migration phải có `BYPASSRLS` (mục 4d; lệnh `db:prepare` ở mục 4 đảm bảo điều này, chưa chạy nó ở lần nâng này thì chạy chế độ chỉ kiểm trước). Thiếu thì **dừng**: bảng cách ly dữ liệu theo đơn vị ngay trong cơ sở dữ liệu, vai không được phép bỏ qua cơ chế đó sẽ chép 0 hàng mà không báo lỗi, và câu kiểm sau đó cũng đọc 0 hàng nên ra "đạt" giả.

```sql
INSERT INTO creator_os.integration_segment_catalog
  (tenant_id, integration_id, slug, display_name, condition_note, state, created_by, created_at, archived_by, archived_at, updated_at)
SELECT s.tenant_id, i.id, s.slug, s.display_name, s.condition_note, s.state, s.created_by, s.created_at, s.archived_by, s.archived_at, s.updated_at
  FROM creator_os.player_segment_catalog s
  JOIN creator_os.integrations i ON i.tenant_id = s.tenant_id
ON CONFLICT (integration_id, slug) DO UPDATE SET
  display_name = EXCLUDED.display_name, condition_note = EXCLUDED.condition_note, state = EXCLUDED.state,
  created_by = EXCLUDED.created_by, created_at = EXCLUDED.created_at,
  archived_by = EXCLUDED.archived_by, archived_at = EXCLUDED.archived_at, updated_at = EXCLUDED.updated_at;
```

Nhớ: sau khi quay lui, mỗi tích hợp chỉ gửi được nhóm khai cho **chính nó** (đúng v1.3.0); đoạn trên chép nhóm của đơn vị cho từng tích hợp của đơn vị để việc đó không làm mất nhóm. Đoạn này có bài kiểm tự động chạy thật SQL trên cơ sở dữ liệu thử (`player-segment-reverse-copy-runbook.test.ts`), nên không thể trôi khỏi bảng. **Quay lui là đường hai chiều chỉ khi bạn làm cả mục 7c lúc lên lại.**

### 7c. Lên lại v1.3.1 sau khi đã quay lui (đọc kỹ trước khi lên lại)

`migrate deploy` chỉ chạy migration **chưa ghi**. Migration `20261013150000_5457_player_segment_catalog` đã được ghi ở lần lên đầu, nên khi lên lại **nó không chạy lại và không sao chép lại**. Trong lúc image v1.3.0 chạy, nhóm người chơi được khai ở bảng cũ `integration_segment_catalog`; những nhóm đó (và những sửa tên, lưu trữ, khôi phục) **không tự vào** bảng mới `player_segment_catalog`. Lên lại mà bỏ qua mục này thì nhóm khai trong thời gian v1.3.0 hiện là "nhóm lạ" ở v1.3.1 và bảng xếp hạng không chọn được.

Làm sau khi dừng ứng dụng và worker, **TRƯỚC khi chạy image v1.3.1**, bằng tài khoản migration (có `BYPASSRLS`, mục 4d). Chạy lại vô hại. Nhóm đã có ở bảng mới chỉ bị cập nhật khi hàng ở bảng cũ **mới hơn** (`updated_at` lớn hơn); khi một nhóm có ở nhiều tích hợp thì chọn hàng theo đúng luật của migration: ACTIVE trước, rồi hàng mới nhất.

**Trước khi chạy đoạn dưới, kiểm vai:** tài khoản migration phải có `BYPASSRLS` (mục 4d; lệnh `db:prepare` ở mục 4 đảm bảo điều này, chưa chạy nó ở lần nâng này thì chạy chế độ chỉ kiểm trước). Thiếu thì **dừng**: bảng cách ly dữ liệu theo đơn vị ngay trong cơ sở dữ liệu, vai không được phép bỏ qua cơ chế đó sẽ chép 0 hàng mà không báo lỗi, và câu kiểm sau đó cũng đọc 0 hàng nên ra "đạt" giả.

```sql
INSERT INTO creator_os.player_segment_catalog
  (tenant_id, slug, display_name, condition_note, state, created_by, created_at, archived_by, archived_at, updated_at)
SELECT DISTINCT ON (tenant_id, slug)
       tenant_id, slug, display_name, condition_note, state, created_by, created_at, archived_by, archived_at, updated_at
  FROM creator_os.integration_segment_catalog
 ORDER BY tenant_id, slug, (state = 'ACTIVE') DESC, updated_at DESC
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  display_name = EXCLUDED.display_name, condition_note = EXCLUDED.condition_note, state = EXCLUDED.state,
  archived_by = EXCLUDED.archived_by, archived_at = EXCLUDED.archived_at, updated_at = EXCLUDED.updated_at
  WHERE EXCLUDED.updated_at > creator_os.player_segment_catalog.updated_at;
```

Kiểm: câu dưới phải ra **0** (không có cặp đơn vị, nhóm nào của bảng cũ mà bảng mới thiếu). Ra khác 0 thì dừng, không chạy image mới, báo hỗ trợ (mục 8).

```sql
SELECT count(*) AS thieu
  FROM (SELECT DISTINCT tenant_id, slug FROM creator_os.integration_segment_catalog) o
 WHERE NOT EXISTS (SELECT 1 FROM creator_os.player_segment_catalog n WHERE n.tenant_id = o.tenant_id AND n.slug = o.slug);
```

Rồi đối chiếu số dòng: `SELECT (SELECT count(*) FROM creator_os.player_segment_catalog) AS bang_moi, (SELECT count(*) FROM (SELECT DISTINCT tenant_id, slug FROM creator_os.integration_segment_catalog) x) AS cap_o_bang_cu;` thì `bang_moi` phải **lớn hơn hoặc bằng** `cap_o_bang_cu` (bảng mới còn giữ nhóm khai ở v1.3.1 mà bảng cũ không có). Nhóm đã gắn trên người chơi không đổi; hai bài kiểm tự động (`player-segment-reverse-copy-runbook.test.ts`) chạy thật cả hai đoạn SQL này.

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
