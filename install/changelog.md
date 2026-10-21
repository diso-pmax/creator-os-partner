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
  lưu"*. Nghĩa của hai câu này nằm ở mục 7 của [upgrade.md](upgrade.md). Có thêm ca thứ ba, hiếm: *"được về
  cấu trúc nhưng KHÔNG nên quay lui"* khi image cũ đọc sai dữ liệu mới ghi (hỏng âm thầm); mục đó ghi điều
  kiện và nói **sửa tiến**, xem đoạn *Ngoại lệ* ở mục 7.

---

## Chưa phát hành

Không đổi.

## v1.4.0-rc.5 — 2026-10-21

**Sửa lỗi: quy tắc cấp quyền mặc định trên hàm (`EXECUTE ON FUNCTIONS`) đặt tay cho tài khoản ứng dụng.** Có **1 migration mới**, chạy MỘT lần bằng image mới với tài khoản migration (mục 4 của [upgrade.md](upgrade.md)). Không đổi biến môi trường.

- 🟡 Migration `20261021120000_6194_drop_default_execute_app_roles` gỡ mọi quy tắc `ALTER DEFAULT PRIVILEGES … GRANT EXECUTE ON FUNCTIONS` mà một tài khoản nào đó đang cấp cho tài khoản ứng dụng (`creator_os_app`, `creator_os_dev_app`, `creatoros_dev_app`, `creatoros_test_app`, `creator_os_worker`, `<tên cơ sở dữ liệu>_app`), cả quy tắc riêng schema `creator_os` lẫn quy tắc toàn cục. Quy tắc này thường do người dựng máy gõ tay lúc tạo tài khoản, không migration nào tạo; nó khiến mọi hàm MỚI do tài khoản đó tạo mang sẵn quyền gọi riêng cho tài khoản ứng dụng, mà câu `REVOKE … FROM PUBLIC` không gỡ được (tài khoản ứng dụng gọi được cả hàm SECURITY DEFINER). Bài tự kiểm lúc khởi động báo nó là `default EXECUTE ON FUNCTIONS granted to an app role`. **Không đổi:** quyền `EXECUTE` đã cấp trên các hàm đang có, quy tắc mặc định trên bảng, quy tắc của tài khoản ngoài danh sách. Chạy lại được.
- 🔴 **Việc phải làm tay, chỉ khi cần:** nếu tài khoản chạy migration không đủ quyền đổi quy tắc mặc định của tài khoản kia (không phải siêu người dùng, không phải chính nó, không phải thành viên của nó), migration **không dừng** mà ghi cảnh báo `this account may not change the default privileges of role …; run this as a superuser: ALTER DEFAULT PRIVILEGES FOR ROLE … REVOKE EXECUTE ON FUNCTIONS FROM …;` vào log. Gặp dòng đó thì chạy đúng câu lệnh in ra, bằng siêu người dùng, cho từng dòng cảnh báo.
- **Kiểm sau khi nâng cấp:** log khởi động của API và worker có `[db-grants] OK role=…` cho mọi tài khoản, không còn `default EXECUTE ON FUNCTIONS granted to an app role`.
- **Biến môi trường:** không đổi.
- **Quay lui:** được bằng image cũ; migration chỉ gỡ quy tắc cấp quyền, không đổi dữ liệu.

**Sửa lỗi: tài khoản worker còn giữ quyền trên bảng nhận webhook thô của marketplace.** Có **1 migration mới**, chạy MỘT lần bằng image mới với tài khoản migration (mục 4 của [upgrade.md](upgrade.md)). Không đổi biến môi trường; không có việc phải làm tay.

- 🟡 Migration `20261021090000_6189_revoke_marketplace_webhook_ingress_app_roles` thu lại **mọi quyền** (`REVOKE ALL`) trên bảng `creator_os.marketplace_webhook_ingress` của các tài khoản ứng dụng đang tồn tại: `creator_os_app`, `creator_os_dev_app`, `creatoros_dev_app`, `creatoros_test_app`, `creator_os_worker` và tài khoản `<tên cơ sở dữ liệu>_app`. Bảng này chỉ được đụng tới qua các hàm `marketplace_lifecycle_*` (chạy bằng quyền chủ bảng); mã ứng dụng không đọc hay ghi nó trực tiếp, nên thu quyền không làm mất chức năng nào. Quyền `EXECUTE` trên các hàm đó và mọi bảng khác **không đổi**. Lý do: migration cũ `20260916120000_2517` chỉ thu quyền của tài khoản đã tồn tại lúc nó chạy; tài khoản `creator_os_worker` tạo sau đó rồi được cấp quyền hàng loạt nên giữ nguyên quyền SELECT/INSERT/UPDATE/DELETE (bài tự kiểm quyền bảng lúc khởi động của chính bản này báo đúng điều đó). Chạy lại được, tài khoản không tồn tại thì bị bỏ qua.
- **Kiểm sau khi nâng cấp** (chỉ đọc, bằng tài khoản có quyền đọc catalog): câu sau **không được ra dòng nào**.
  `SELECT rolname FROM pg_roles WHERE rolname IN ('creator_os_app','creator_os_dev_app','creatoros_dev_app','creator_os_worker') AND has_table_privilege(rolname, 'creator_os.marketplace_webhook_ingress', 'SELECT,INSERT,UPDATE,DELETE');`
  Ngoài ra log khởi động của API và worker phải có `[db-grants] OK role=…` cho mọi tài khoản, không có `MISMATCH` nhắc tới `marketplace_webhook_ingress`.
- **Biến môi trường:** không đổi.
- **Quay lui:** được bằng image cũ. Migration chỉ thu quyền; mã cũ cũng không đọc bảng này trực tiếp.

**Mới: API và worker tự kiểm quyền bảng của tài khoản cơ sở dữ liệu lúc khởi động (log + Sentry, không làm sập app).** Không có migration và không đổi biến môi trường; không có việc phải làm tay sau khi nâng cấp.

- 🟢 Mỗi lần API và worker khởi động, mỗi tiến trình so quyền thật của từng tài khoản nó kết nối (tài khoản app qua `DATABASE_URL`, tài khoản worker qua `DATABASE_URL_WORKER`) trên mọi bảng schema `creator_os` với danh sách khai báo trong mã. Việc chạy nền sau khi app đã lên, chỉ đọc catalog, không cấp quyền, không chặn và không làm sập app (kiểm lỗi chỉ ghi cảnh báo `could not run`).
- 🟢 **Sau khi nâng cấp, tìm trong log khởi động của API VÀ worker** (mỗi tài khoản một dòng):
  - `[db-grants] OK role=<tài khoản> process=<api|worker>: <n> tables match the declared list` là ổn;
  - `[db-grants] MISMATCH role=<tài khoản> process=<api|worker>: missing (…)` liệt kê bảng và quyền thiếu (đúng lỗi `permission denied for table …`), `forbidden (…)` là quyền đang giữ dù migration đã thu lại, và `default EXECUTE ON FUNCTIONS granted to an app role` là quy tắc cấp quyền mặc định chạy hàm đang cấp cho tài khoản app. Cùng lúc có một sự kiện Sentry `creator_os table privileges differ from the declared list` (tag `source=db_grants_startup_check`, `role`, `process`).
  - Gặp `MISMATCH`: không cấp tay theo trí nhớ; báo đội phát triển kèm dòng log. Tài khoản superuser được ghi `OK` nhưng chỉ phía "thiếu quyền" có nghĩa.
- **Biến môi trường:** không đổi.
- **Quay lui:** được bằng image cũ; bản mới không ghi gì vào cơ sở dữ liệu.

**Sửa lỗi: màn "Sẵn sàng" của tích hợp trả 500 vì tài khoản chạy API thiếu quyền trên một bảng.** Có **1 migration mới**, chạy MỘT lần bằng image mới với tài khoản migration (mục 4 của [upgrade.md](upgrade.md)). Không đổi biến môi trường.

- 🟡 Migration `20261020130000_6146_regrant_creator_os_tables` cấp `SELECT, INSERT, UPDATE, DELETE` cho `creator_os_app`, `creator_os_dev_app` và `creator_os_worker` trên mọi bảng của schema `creator_os` mà tài khoản đó **chưa có quyền nào**. Triệu chứng đã gặp: màn **Sẵn sàng** của một tích hợp trả 500, log API ghi `permission denied for table integration_segment_unseen` (mã `42501`). Nguyên nhân: quy tắc cấp quyền tự động của bước khởi tạo ban đầu gắn với tài khoản migration lúc đó, nên bảng do một tài khoản migration khác tạo về sau không tự có quyền cho tài khoản chạy API (cùng họ lỗi `identity_namespaces` ngày 7/9). Migration cũng đặt lại quy tắc cấp quyền mặc định cho tài khoản đang chạy migration, để bảng tạo ở các bản sau tự có quyền. Role nào không tồn tại trên máy chủ thì bị bỏ qua; chạy lại được, lần hai không cấp thêm gì.
- 🟡 **Cố ý KHÔNG đụng:** bảng tài khoản đã có một phần quyền (bảng chỉ-thêm `tier_assignment_events`, `tier_catalog_revisions`, `commerce_order_commission_owners`, `commerce_order_commission_conflicts`), bảng bị thu hết quyền có chủ đích `marketplace_webhook_ingress` và sổ lịch sử migration `_prisma_migrations`. Migration tự kiểm lại sau khi cấp: còn bảng nào tài khoản không có quyền nào (ngoài `marketplace_webhook_ingress`) thì **dừng triển khai** và liệt kê tên bảng, không để lỗi nổi lên ở màn hình sau vài tuần.
- 🔴 **Việc phải làm tay (nếu môi trường có tài khoản chạy API tách riêng):** migration chạy MỘT lần mỗi cơ sở dữ liệu, nên không bảo vệ bảng được tạo ở bản sau. Sau mỗi lần nâng cấp, chạy câu kiểm chỉ đọc này (thay `creator_os_app` bằng tên tài khoản chạy API). **Ổn = không có dòng nào.** Chạy câu này TRƯỚC khi nâng cấp (cột `chu_bang` cho biết tài khoản sở hữu bảng; tài khoản chạy migration phải sở hữu các bảng đó, nếu không migration dừng ở bước cấp quyền và Prisma chặn các lần `migrate deploy` sau cho tới khi `migrate resolve`) và chạy lại SAU khi nâng. Có dòng thì tài khoản đó sẽ gặp lỗi `42501` ở đúng bảng ấy: báo đội phát triển, đừng cấp tay trừ khi được dặn.
  `SELECT c.relname, pg_get_userbyid(c.relowner) AS chu_bang FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'creator_os' AND c.relkind IN ('r','p') AND c.relname NOT IN ('marketplace_webhook_ingress', '_prisma_migrations') AND NOT (has_table_privilege('creator_os_app', c.oid, 'SELECT') OR has_table_privilege('creator_os_app', c.oid, 'INSERT') OR has_table_privilege('creator_os_app', c.oid, 'UPDATE') OR has_table_privilege('creator_os_app', c.oid, 'DELETE'));`
- **Biến môi trường:** không đổi.
- **Quay lui:** được bằng image cũ. Migration chỉ cấp thêm quyền, không đổi cấu trúc hay dữ liệu; để nguyên quyền đã cấp thì image cũ vẫn chạy bình thường.

## v1.4.0-rc.4 — 2026-10-19

**Cửa gọi thử riêng của kênh đối tác.** Từ v1.4.0-rc.3 lên có **1 migration mới**, chạy MỘT lần bằng image mới với tài khoản migration (mục 4 của [upgrade.md](upgrade.md)); cộng với các migration đã nêu ở các bản trước, từ v1.3.1 lên là **30 migration**. Migration chỉ thêm một cột, không xoá hay sửa cột và bảng cũ.

- 🟡 Migration `20261019100000_6113_settlement_test_endpoint` thêm cột nullable `settlement_test_endpoint` (text) vào bảng CŨ `integrations` (kênh gửi tất toán). **Không chép địa chỉ nhận điểm sang cột này, cố ý:** mọi kênh đang có đọc `NULL` sau khi nâng cấp. Chạy lại được (`ADD COLUMN IF NOT EXISTS`).
- 🔴 **Việc phải làm tay sau khi nâng cấp:** từ bản này mọi lần "thử" (nút **Gọi thử** ở hộp Chi trả, bước thử đầu của mỗi lượt Chi trả và **Tiếp tục gửi**, nút **Gửi thử thông báo tất toán** ở tab Nhận điểm, tự gọi thử trên sandbox của đối tác) chỉ tới địa chỉ gọi thử riêng của kênh, không bao giờ tới địa chỉ nhận điểm. Kênh chưa khai địa chỉ này trả mã `not_ready_test_endpoint`, không gửi gì; một lượt Chi trả dừng ở bước thử, không dòng nào đi. Người vận hành nền tảng khai địa chỉ cho từng kênh ở ô **Địa chỉ gọi thử của đối tác** (tab Nhận điểm của màn Cửa nhận sự kiện) trước khi cho chạy Chi trả. Đây không phải hồi quy: trước bản này lượt thử gửi gói giả tới địa chỉ nhận điểm nên không bao giờ qua với đối tác thật.
- **Biến môi trường:** không đổi.
- **Quay lui về `v1.4.0-rc.3`: CHƯA kiểm.** Về cấu trúc không có gì chặn (migration chỉ thêm một cột nullable mà image cũ không đọc), nhưng chưa ai chạy `migrate deploy` của rc.3 trên DB đã lên bản này. Image cũ quay về gửi gói giả tới địa chỉ nhận điểm khi thử. SA/DevOps xác nhận trước khi ghi "được".

## v1.4.0 — 2026-10-16

- 🟡 **Link chia sẻ Storefront dùng mã ngắn `/l/{code}` trên domain của đơn vị**: giữ cơ chế chọn custom domain đã xác minh hoặc subdomain của đơn vị như trước; không cần `PROGRAM_LINK_PUBLIC_BASE_URL` cho link Storefront. Proxy cần chuyển `/l/*` tới API (router trong image đã có cấu hình). Sau khi nâng cấp, tạo một link chia sẻ Storefront, mở `/l/…`, kiểm tra chuyển tới `/s/…/r/…` trên domain Storefront kèm consent và cookie. Biến `PROGRAM_LINK_PUBLIC_BASE_URL` tiếp tục dùng cho link tích hợp ngoài.
- 🟢 **Giữ HTTPS của link Storefront qua nginx/Caddy:** bỏ `header_up X-Forwarded-Proto {scheme}` vì nginx kết thúc TLS rồi gọi router bằng HTTP; dòng này ép app thấy HTTP, gây redirect HTTP và bootstrap giới thiệu lỗi Origin/403. Host vẫn ghim theo `{hostport}`. Protocol từ peer ngoài danh sách trust vẫn không được tin.
- **`CADDY_TRUSTED_PROXIES` (tuỳ chọn):** danh sách IP/CIDR cách nhau bằng dấu cách; mặc định `private_ranges`, giữ chính sách trust hiện hành. Deployment nginx trên host qua gateway Docker private không cần thêm env chỉ cho sửa này. Có thể giới hạn tới IP/CIDR nginx thực tế. Cổng router phải chỉ nhận nginx (publish loopback trên host), nginx phải ghi đè `X-Forwarded-Proto` theo `$scheme` và giữ `Host` theo request thật. Compose thật ngoài repo phải truyền biến này nếu muốn override; sửa env/compose mẫu không tự áp lên server.
- **Triển khai/kiểm tra:** merge develop để workflow build image gộp có Caddyfile mới và rollout `app`; không có migration DB cho sửa này. Mở lại link HTTPS: `Location` giữ HTTPS, bootstrap không còn 403 do lệch Origin. Nếu vẫn `referral?failed=1`, cần kiểm mã lỗi upstream còn lại. Quay về Caddyfile cũ tái hiện việc ép protocol HTTP; test router không thay nghiệm thu browser/deploy.

- 🟢 **Trang bán hàng: trần cửa tải ảnh khách gửi kèm yêu cầu hỗ trợ.** Biến tuỳ chọn `STOREFRONT_EVIDENCE_UPLOAD_MAX_PER_HOUR` [60], đếm theo (trang, IP thật của khách) như hai trần ở mục dưới, nên cũng cần `TRUST_PROXY_HOPS` đúng; `0` là đóng cửa tải ảnh.
- 🟡 **Ảnh khách gửi kèm yêu cầu hỗ trợ ra khỏi thư viện media.** Migration `20261012090000_5387_buyer_evidence_private` đánh dấu mọi ảnh đó là dữ liệu cá nhân và riêng tư (ảnh đã lỡ công khai thì thu về), rồi đọc lại và dừng triển khai nếu còn sót ảnh nào. Chạy tự động lúc triển khai; quay lui bằng image cũ được, nhưng image cũ lại cho người có quyền thư viện xem ảnh đó. TRƯỚC khi triển khai, chạy `scripts/ops/audit-5387-buyer-evidence-exposure.sql` (chỉ đọc) trên CSDL thật để biết ảnh nào đã lộ, rồi dán kết quả vào phiếu (script tự dừng nếu vai DB không phải superuser hay BYPASSRLS, vì khi đó mọi con số đều ra 0). SAU khi mọi pod đã lên image mới: chạy lại migration đó bằng tay một lần (nó idempotent, vai nào cũng chạy được) để thu nốt ảnh mà pod cũ lỡ công khai trong lúc cuốn chiếu: `psql "$DATABASE_URL_MIGRATE" -v ON_ERROR_STOP=1 -f db/prisma/migrations/20261012090000_5387_buyer_evidence_private/migration.sql`; chạy lại script đo, mục ① phải không còn dòng `is_pii = f` hay `public_now > 0`; rồi xoá cache CDN của `/api/v1/files/*` (file công khai được cache 1 giờ). Tài khoản kho (`MINIO_ACCESS_KEY`) phải đọc được object trong bucket PII (HEAD và GET theo khoảng byte) và chép object trong bucket đó; thiếu quyền thì mọi lượt xác nhận ảnh trả 502, log API có dòng `confirm <id>: storage measure failed (AccessDenied)`.
- 🟡 **`GET /api/v1/files/:id` (file công khai) chỉ phát trực tiếp ảnh và video** (JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, QuickTime), kèm `X-Content-Type-Options: nosniff`. File công khai kiểu khác (vd tài liệu chiến dịch PDF, logo lưu `application/octet-stream`) vẫn tải được nhưng trình duyệt tải về như tệp đính kèm thay vì mở ngay: logo như vậy thì tải lại ảnh là xong.

- 🔴 **Trang bán hàng: trần tần suất ở cửa công khai và dọn phiên khách hết hạn.** Ba việc ở cấu hình proxy, không nằm trong image:
  - Đặt `TRUST_PROXY_HOPS` đúng số proxy trước API: image all-in-one sau nginx trên host là `2` (nginx + router trong image). Có CDN hay load balancer trước nginx thì cộng thêm. Bỏ trống thì vẫn chạy, nhưng API chỉ thấy địa chỉ proxy nên trần không đếm (log `[storefront-public-door] … check TRUST_PROXY_HOPS`), trần tra đơn dồn mọi khách vào một bộ đếm, và IP ghi vào audit là địa chỉ ngoài cùng không thuộc dải riêng của chuỗi (có CDN thì là địa chỉ CDN; proxy phía trước ghi `unknown` hay `ip:port` thì là địa chỉ kết nối). Khai thừa thì khách tự chọn được IP.
  - Nginx trên host gửi `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` (như `infra/nginx/creatoros.conf`).
  - Cổng router chỉ mở cho nginx trên host (publish `127.0.0.1:<cổng>`): router nay tin hop thuộc dải mạng riêng.
- 🟡 Router trong image **nối** chuỗi `X-Forwarded-For` thay vì ghi đè (Caddy `trusted_proxies static private_ranges`). `X-Forwarded-Host` vẫn ghim theo `Host` (giữ cả cổng); `X-Forwarded-Proto` giữ protocol do nginx được tin truyền tới (xem sửa HTTPS ở trên). Khi đã khai `TRUST_PROXY_HOPS`, IP ghi vào audit, bằng chứng đồng ý và lượt bấm link tiếp thị là IP thật của người dùng (trước đây là một địa chỉ nội bộ cho mọi người). `caddy run` in cảnh báo "Unnecessary header_up" cho dòng ghim Host: dự kiến.
- 🟡 Migration `20261010140500_4760_storefront_session_purge` và `20261010141500_4760_storefront_purge_hardening` thay hàm trigger chỉ-thêm của `storefront_quote_revisions` (mở một cửa xoá hẹp cho job dọn) và thêm bốn chỉ mục trên `storefront_carts`, `storefront_checkout_sessions`, `storefront_order_bindings`. Chạy tự động lúc triển khai. Quay lui bằng image cũ vẫn được: image cũ không bật cờ của cửa xoá, nên với nó bảng vẫn chỉ-thêm; chỉ mục thừa vô hại.
- 🟢 Bốn biến TUỲ CHỌN, bỏ trống là mặc định: `STOREFRONT_SESSION_ISSUE_MAX_PER_HOUR` [120], `STOREFRONT_CHECKOUT_OPEN_MAX_PER_HOUR` [120, mở phiên đặt hàng và báo giá lại đếm chung], `STOREFRONT_QUOTE_REVISIONS_MAX` [30 trong 24 giờ], `STOREFRONT_SESSION_CLEANUP_INTERVAL_MS` [3600000]. `0` ở ba biến đầu là đóng cửa đó. Job dọn chạy ở tiến trình worker (`WORKER=1`).
- 🟡 Migration `20261011130000_4352_storefront_checkout_payment_method` thêm một cột nullable `payment_method` vào bảng `storefront_checkout_sessions` (phương thức thanh toán khách chọn ở Bước 1 đặt hàng). Cột dùng lại enum `StorefrontPaymentMethod` có sẵn và không điền dữ liệu cho dòng cũ. Chạy tự động lúc triển khai, không cần làm tay. Quay lui bằng image cũ vẫn được: mã cũ không đọc cột này. Khi đó đơn đặt dưới image cũ không mang theo phương thức, khách chọn ở màn hướng dẫn thanh toán như trước.
- 🔴 **Soát chữ đã lưu TRƯỚC khi nâng: ô chữ chỉ gồm ký tự không hiện được giờ tính là rỗng.** Từ bản này, ô chữ người dùng gõ mà chỉ gồm ký tự không hiện được (ví dụ chỉ U+200B, U+3164 hoặc U+00AD) tính là rỗng. Chữ như vậy đã lưu từ trước sẽ bị từ chối khi ứng dụng đọc lại. Không soát thì: link chương trình báo lỗi 500, đơn trang bán hàng mất ghi nhận tiếp thị mà không báo, trang chủ trang bán hàng hiện trống, xuất bản chiến dịch báo `409 revision_invalid`.
  - Trước khi đổi container, chạy đoạn kiểm chỉ đọc ở [upgrade.md, mục 4f](upgrade.md) bằng tài khoản có `BYPASSRLS` hoặc siêu người dùng (đoạn kiểm tự từ chối chạy với tài khoản khác). **Ổn = không có dòng nào.**
  - Có dòng thì dừng nâng: sửa chữ đó trên Console (đổi tên rồi xuất bản bản Link mới, sửa bước hướng dẫn của chiến dịch hoặc khối CMS) rồi chạy lại. Dòng thuộc bản Link hay phiên bản chiến dịch đã xuất bản từ trước (không sửa được), hoặc không xác định được là ô nào, thì gửi kết quả cho đội phát hành trước khi nâng.
  - Không có migration. Quay lui bằng image cũ vẫn được: image cũ đọc được chữ bản mới đã lưu.
- 🟡 **Trang bán hàng: ô ngân hàng nhận tiền chỉ nhận ngân hàng có trong danh mục.** Không có migration, không có biến mới. Từ bản này, lưu chỉ dẫn chuyển khoản với mã ngân hàng không có trong danh mục ngân hàng đang bật bị từ chối. Chỉ dẫn đã lưu trước đó giữ nguyên: khách vẫn thấy chữ, nhưng mã lệch danh mục thì không có mã QR. Sau khi nâng, chạy **một lần** lệnh chỉ đọc sau để biết bao nhiêu trang cần chủ trang chọn lại ngân hàng (in mã trang, không in số tài khoản):
  `docker exec <container api> sh -c 'cd /repo && pnpm --filter @app/api count:storefront-payment-bank-codes'`
  Lệnh dùng khoá PII và chuỗi kết nối của container như API, và đọc trang của mọi đơn vị nên cần chuỗi kết nối quyền quản trị (`DATABASE_URL_WORKER` hoặc `DATABASE_URL_MIGRATE`). Thoát mã 1 thì đừng tin số đếm: dòng `UNREADABLE rows` là khoá PII sai; lỗi nhắc tới `DATABASE_URL_WORKER` là thiếu hai biến trên. Dòng `Pages scanned` phải khớp số trang đang có. Dòng cuối liệt kê ngân hàng trong danh mục có mã sai khuôn: chủ trang không chọn được ngân hàng đó, xử lý bằng cách tạo ngân hàng mới đúng khuôn, chuyển BIN NAPAS sang, rồi tắt ngân hàng cũ. Quay lui bằng image cũ được, cấu trúc dữ liệu không đổi.
- 🟡 Màn quản trị ngân hàng: mã ngân hàng **mới** chỉ gồm chữ in hoa, chữ số và `_` (tối đa 40 ký tự); ngân hàng đã có không bị đụng. Thêm ô BIN NAPAS (6 chữ số) dùng cho mã VietQR của trang bán hàng.
- 🟡 Migration `20261011200000_5388_storefront_support_request_lines_withdraw` thêm bốn cột nullable vào `storefront_support_requests` (`approved_at`, `approved_by_account_id`, `withdrawn_at`, `withdrawn_by_grant_id`), thêm trạng thái `WITHDRAWN` (khách rút yêu cầu) vào ràng buộc kiểm trạng thái, và hai ràng buộc cặp. Yêu cầu đang `APPROVED` được chép mốc duyệt từ `resolved_at`/`resolved_by_account_id`. Chạy tự động lúc triển khai, không cần làm tay. Quay lui bằng image cũ vẫn được: image cũ không đọc bốn cột mới và không ghi `WITHDRAWN`; yêu cầu khách đã rút dưới image mới hiện ở màn cũ như một trạng thái chưa có nhãn.
- 🟢 Biến TUỲ CHỌN `STOREFRONT_SUPPORT_REQUEST_CREATE_MAX_PER_HOUR` [30]: trần số yêu cầu huỷ, trả hàng, kiểm tra thanh toán khách gửi mỗi giờ, tính theo trang bán hàng và IP thật (cần `TRUST_PROXY_HOPS` đúng như các trần cửa công khai ở trên). Chỉ đếm lượt gọi của khách có quyền xem đơn đó, nên lượt gọi rác từ cùng địa chỉ không tiêu hạn mức của khách thật. `0` là đóng cửa đó.
- 🟡 **Đơn vị mới có sẵn trang chủ Đang chạy; đơn vị cũ chạy bù một lần.** Không có migration, không có biến mới. Từ bản này, tạo đơn vị là có luôn trang chủ phiên bản đầu `vYYMMDD-01` (theo giờ Việt Nam) mang bố cục mặc định, đang chạy, không có nháp; xoá tài liệu landing qua API CMS bị từ chối (`409 landing_default_cannot_be_disabled`). Đơn vị đã tạo từ trước vẫn như cũ cho tới khi chạy lệnh bù (an toàn chạy lại, đơn vị đã có landing không bị đụng):
  `docker exec <container api> sh -c 'cd /repo && pnpm --filter @app/api backfill:default-landing'` (chỉ liệt kê, không ghi), rồi thêm `-- --apply` để ghi, hoặc `-- --apply --tenant=<uuid>` cho một đơn vị. Đơn vị mà landing chỉ có nháp chưa đăng (`DRAFT_ONLY`) hoặc landing đã bị xoá (`SOFT_DELETED`) được liệt kê và để nguyên, cần người quyết. Chưa chạy lệnh bù thì đơn vị cũ vẫn hiện bố cục mặc định ở trang công khai như trước. Quay lui bằng image cũ vẫn được: hàng tạo ra là tài liệu landing bình thường.
- 🟢 **Console: tìm đơn bán hàng theo số điện thoại khách và lọc báo đã thanh toán quá hạn.** Không có migration. Biến TUỲ CHỌN `STOREFRONT_PAYMENT_REVIEW_OVERDUE_HOURS` [72]: yêu cầu "khách báo đã thanh toán" còn chờ quá số giờ này thì tính là quá hạn ở danh sách đơn của Console. Nhận số nguyên từ 0 tới 8760; giá trị khác dùng mặc định 72; `0` là mọi yêu cầu còn chờ.
- 🟡 `PII_REVEAL_MAX_PER_DAY` nay giới hạn thêm số lần tìm đơn theo số điện thoại khách mỗi ngày của từng người, ngoài số lần xem thông tin khách. Hai việc đếm riêng nhưng dùng chung con số trần: nâng biến này là nâng cả hai. Mỗi lần tìm ghi một dòng nhật ký `storefront.admin_order_phone_lookup`, không chứa số điện thoại.

**Đối soát reward theo kỳ.** Từ v1.3.1 lên v1.4.0 có **29 migration mới** (22 của phần này, 7 của Chi trả reward ở mục kế), chạy MỘT lần bằng image mới với tài khoản migration (mục 4 của [upgrade.md](upgrade.md)). Trong 22 migration của phần này, năm cái đã nêu ở các mục trên; 17 cái còn lại ở dưới. Tất cả chỉ thêm hoặc nới, không xoá cột hay bảng. Các mục 🔴 và 🟡 dưới đây là chỗ người cài cần kiểm hoặc biết trước khi chạy: có migration tự dừng triển khai khi môi trường không đạt.

- 🔴 **Migration `20261013090000_5543_partner_self_tier` dừng nếu chủ của ba hàm đọc hạng không phải vai có `BYPASSRLS` (hoặc siêu người dùng).** Nó thêm ba hàm đọc hạng (Tier) chạy bằng quyền chủ hàm. Chạy bằng đúng tài khoản migration của mục 4d của [upgrade.md](upgrade.md) (đã là yêu cầu từ v1.3.0). Kiểm trước, chỉ đọc, bằng chính tài khoản đó: `psql "host=… user=… dbname=…" -X -c "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user"`. **Ổn = `rolbypassrls` là `t`.**
- 🔴 **Migration `20261013160000_5457_5516_marketing_role_selfcheck` dừng nếu vai hệ thống `tenant_marketing` không có đúng 11 mã quyền.** Nó không cấp thêm gì: sau khi hai migration trước cùng thêm một mã (`cms:read`, `player_segment:read`) nó kiểm cả vai. Chỉ gặp khi vai này từng bị sửa tay trong cơ sở dữ liệu. Kiểm trước, chỉ đọc: `SELECT count(*) FROM creator_os.role_permissions rp JOIN creator_os.roles r ON r.id = rp.role_id WHERE r.tenant_id IS NULL AND r.code = 'tenant_marketing'`. **Ổn = 9 ở bản v1.3.0, 10 ở bản v1.3.1; sau nâng là 11.** Số khác: dừng, báo hỗ trợ trước khi chạy.
- 🟡 **Migration `20261014130000_5497_reward_entries_reverses_entry_idx` dựng chỉ mục bằng `CREATE INDEX CONCURRENTLY`** (không khoá ghi bảng `reward_entries`). Một lần dựng bị huỷ giữa chừng để lại chỉ mục dở dang cùng tên, và lần chạy lại sẽ bỏ qua nó: phải xoá chỉ mục đó rồi chạy lại. Kiểm, chỉ đọc: `SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'creator_os' AND NOT i.indisvalid`. **Ổn = không có dòng nào.**
- 🟡 **Migration `20261014170000_5713_remove_reconciliation_confirmation_flag_rows` xoá hàng cờ `reconciliation-confirmation` ở mọi đơn vị** (chỉ đúng khoá đó), rồi đọc lại và dừng nếu còn. Từ bản này xác nhận đối soát luôn bắt buộc trước *Chốt kỳ điểm* của chiến dịch Reward; cờ không còn được đọc. Quay lui bằng image cũ không khôi phục hàng đã xoá. Đếm trước, chỉ đọc (bảng bật bảo vệ theo hàng nên cần tài khoản có `BYPASSRLS`, tài khoản khác thấy 0): `SELECT count(*) FROM creator_os.tenant_feature_flags WHERE flag_key = 'reconciliation-confirmation'`.
- 🟢 **Quyền mới `player_support:compensate`** (migration `20261014100000_5497_player_support_compensate_permission`): migration gán sẵn cho `superadmin` và `tenant_admin`; không gán cho `tenant_operator` hay vai hỗ trợ. Màn Đối soát reward ở bản này không có thao tác phát bù điểm (xem *Có gì mới*). Kiểm sau nâng, chỉ đọc: `SELECT r.code FROM creator_os.role_permissions rp JOIN creator_os.roles r ON r.id = rp.role_id JOIN creator_os.permissions p ON p.id = rp.permission_id WHERE p.code = 'player_support:compensate' ORDER BY 1`. **Đúng = hai dòng: `superadmin`, `tenant_admin`.**
- 🟢 **Bảng và cột mới cho đối soát reward, chỉ thêm:** bảng `reward_reconciliation_periods` (kỳ đối soát, mỗi chiến dịch chỉ một kỳ đang mở) và `reward_drift_resolutions` (quyết định của người vận hành về từng dòng lệch, chỉ ghi thêm); cột `effective_at` ở bảng giao dịch và cột `chain_effective_at` ở bảng `creditings` (cho phép rỗng, không giá trị mặc định, không điền lại dữ liệu cũ); một chỉ mục duy nhất trên `reward_drift_resolutions` để mỗi dòng chỉ có một quyết định phát bù, và nới giới hạn độ dài mã dòng lên 1000 ký tự. Bảng do chính đợt này tạo nên chưa có dữ liệu cũ để vướng. Migration: `20261013100000_5497_reward_reconciliation_periods`, `20261013100000_5497_reward_drift_resolutions`, `20261014140000` (cột `effective_at`), `20261014150000_5497_creditings_chain_effective_at`, `20261014160000_5497_reward_drift_one_compensate_per_line`.
- 🟡 **Hạng (Tier) thủ công:** migration `20261012190000_5527_manual_tier` tạo các bảng hạng và dựng một chỉ mục duy nhất (không `CONCURRENTLY`) trên `program_memberships`; ghi vào bảng đó chờ trong lúc dựng, nên chạy migration khi ứng dụng đã dừng hoặc ít tải.
- 🟢 **Các migration nhỏ còn lại, chỉ thêm hoặc nới:** `20261010140000_5108_work_status_skipped_not_licensed` (nới ràng buộc trạng thái công việc của chương trình liên kết, thêm `SKIPPED_NOT_LICENSED`); `20261010140000_5264_campaign_redeem_note` (cột `redeem_note` cho phép rỗng); `20261011150000_5329_backfill_default_campaign_leaderboards` (tạo hai bảng xếp hạng mặc định cho mỗi chiến dịch đang chạy, đã kết thúc hoặc đã lên lịch mà chưa có bảng nào; chạy lại không tạo trùng); `20261012210000_5516_cms_version_updated_by_save_seqs` (hai cột của phiên bản CMS); `20261012220000_5516_marketing_cms_read` (cấp `cms:read` cho `tenant_marketing`); `20261013030000_5228_optional_delivery_reference` (thay hàm kiểm bằng chứng giao hàng: số tham chiếu chứng từ không còn bắt buộc).
- 🟢 **Biến môi trường mới, đều TUỲ CHỌN, để trống là dùng mặc định:** `REWARD_PERIOD_LOCK_MAX_HOLDERS` (trần số kỳ đối soát giữ khoá cùng lúc trong một tiến trình API; mặc định một phần ba cỡ pool kết nối, tối thiểu 1, xem mục dưới); `REWARD_PERIOD_LOCK_TIMEOUT_MS` (thời gian chờ khoá kỳ, mặc định 15000); `HONOR_SHARE_MIN_CREATORS` (số creator tối thiểu để bảng vinh danh hiện "Top 3 · trên N creator", mặc định 20); `CONSOLE_ORIGINS` (danh sách origin Console, cách nhau bằng dấu phẩy, mà trang chủ được gọi khi hiện trong khung xem trước của Console; mặc định rỗng = chỉ origin của chính trang; là cấu hình lúc chạy của portal creator, không phải biến lúc build).
- 🔴 **Điều kiện phát hành: `DATABASE_URL` của container API phải khai `connection_limit` tường minh.** Trần số kỳ đối soát giữ khoá cùng lúc bằng một phần ba cỡ pool kết nối. Cỡ pool lấy từ `connection_limit`; không có thì mã **ước lượng thận trọng** bằng `số lõi luận lý + 1`, vì mặc định của Prisma là `2 × số lõi vật lý + 1` còn Node chỉ đếm được lõi luận lý. Trên máy siêu phân luồng (hyper-threading) hai luồng mỗi lõi hoặc không siêu phân luồng, ước lượng này không vượt mặc định của Prisma (trần tính theo ước lượng; máy 4 lõi vật lý, 8 luận lý: pool 9, ước lượng 9, trần 3; máy 4 lõi không siêu phân luồng: pool 9, ước lượng 5, trần 1). Nhưng số lõi vật lý Prisma thấy phụ thuộc phần cứng hoặc máy ảo mà mã không kiểm được: nếu nó thấy ít hơn một nửa số lõi luận lý (máy ảo khai lõi lạ, bộ vi xử lý hơn hai luồng mỗi lõi) thì trần có thể cao hơn một phần ba pool thật, cạn pool và **cả API đứng** (triệu chứng `P2024`). Vì vậy vẫn phải khai `connection_limit` tường minh: pool và trần khi đó không phụ thuộc phần cứng. Thêm `?connection_limit=<N>` (hoặc `&connection_limit=<N>` nếu URL đã có tham số) vào `DATABASE_URL` của container API, với `N` không vượt `max_connections` của PostgreSQL chia cho số tiến trình API và tác vụ nền. Kiểm, chỉ đọc, đã che tài khoản: `docker exec <container api> sh -c 'echo "$DATABASE_URL" | sed -E "s#//[^@]*@#//***@#" | grep -oE "connection_limit=[0-9]+" || echo "KHÔNG có connection_limit"'`. **Đúng = `connection_limit=<N>`.** Ra "KHÔNG có connection_limit": khai rồi tạo lại container API trước khi nâng.

**Chi trả reward theo đợt và theo kênh.** Có **7 migration mới** (nằm trong 29 migration từ v1.3.1 lên v1.4.0; ai đã chạy `v1.4.0-rc.2` thì chỉ còn bảy cái này), chạy MỘT lần bằng image mới với tài khoản migration (mục 4 của [upgrade.md](upgrade.md)). Cả bảy chỉ thêm bảng, thêm cột hoặc thay hàm/ràng buộc của bảng mới; không xoá cột hay bảng cũ.

- 🟡 Migration `20261014180000_5696_point_payout_batches` thêm HAI bảng mới `point_payout_batches` và `point_payout_lines` (đợt chi trả và các dòng trong đợt). Không sửa bảng cũ, không có cột tiền.
- 🟡 Migration `20261014190000_5696_point_payout_runs` thêm bảng mới `point_payout_runs` (mỗi lần bấm "Chi trả" hoặc "Gửi lại" là một lượt chạy nền).
- 🟡 Migration `20261015100000_5732_payout_timeout_not_releasable` thay hàm kiểm `point_payout_lines_guard`: dòng đã gửi mà hết thời gian chờ thì **không** tháo và không huỷ đợt được (đối tác đồng bộ có thể đã trả). Chạy lại được (CREATE OR REPLACE).
- 🟡 Migration `20261015100100_5732_payout_run_pause_reason_refused` nới ràng buộc `pause_reason` của `point_payout_runs` thêm giá trị `REFUSED` (lượt chạy tự dừng khi 20 dòng liên tiếp bị cửa từ chối). Chạy lại được.
- 🟡 Migration `20261015120000_5764_settlement_send_per_minute` thêm cột `settlement_send_per_minute` vào bảng CŨ `integrations` (kênh gửi tất toán): `NOT NULL DEFAULT 60` nên mọi kênh đang có đọc 60, không cần chạy bù; kèm ràng buộc `CHECK (>= 0)`. `0` là tạm dừng kênh chứ không phải không giới hạn.
- 🟡 Migration `20261015130000_5765_payout_batch_channel` thêm cột nullable `settlement_integration_id` vào `point_payout_batches`, kèm **khoá ngoại tới `integrations` (ON DELETE RESTRICT)**: đợt chi trả nhớ kênh nó chi qua và khoá kênh từ khi có lần gửi thật; một kênh đã gắn với đợt thì không xoá được. Đợt đang có để trống (chưa chọn kênh).
- 🟢 Migration `20261016010000_5852_payout_line_refusal` thêm ba cột nullable vào `point_payout_lines` (`refused_code`, `refused_at`, `refused_run_id`): dòng bị cửa từ chối trước khi gói đi là "gửi thất bại" kèm lý do.
- 🔴 **`PARTNER_EGRESS_TEST_ORIGINS` không bao giờ được đặt ở môi trường thật.** Biến chỉ dành cho sân kiểm thử L4; `env:check` nay báo `FORBIDDEN: PARTNER_EGRESS_TEST_ORIGINS SET` (mã `2`) và API cùng worker từ chối khởi động nếu nó được đặt khi `APP_ENV` không phải `local`, `ci` hay `test`. Gặp dòng đó thì xoá biến khỏi cấu hình chạy, đừng đổi `APP_ENV` cho qua (chi tiết ở [upgrade.md](upgrade.md)).
- 🟢 Biến TUỲ CHỌN `POINT_PAYOUT_RUN_INTERVAL_MS` [3000, tối thiểu 500]: nhịp kiểm lượt chi trả của worker; bỏ trống là mặc định.
- **Quay lui về `v1.4.0-rc.2`: được, với ba điều kiện** (SA đánh giá trên mã, DevOps chạy thử `migrate deploy` của rc.2 trên một DB mới đã lên rc.3: báo "No pending migrations to apply", không lỗi). Không có lệnh gỡ nào phải chạy; để nguyên bảng và cột mới.
  1. Dừng hoặc đợi xong mọi lượt gửi nền (trạng thái QUEUED/RUNNING) rồi mới hạ image; lên lại bản mới thì worker nhận lại lượt và gửi tiếp các dòng còn lại.
  2. Trong lúc chạy image cũ, **không bấm Gửi hay Gửi lại** ở màn Chốt kỳ điểm cho người đang nằm trong một đợt chi trả đang MỞ (image cũ không biết đợt, có rủi ro gửi trùng).
  3. `migrate deploy` của image cũ trên DB có bảy migration "lạ" phải thoát 0 với "No pending migrations"; nếu không, dừng và báo.
- **Quay lui về `v1.3.1`: CHƯA kiểm cho phần của v1.4.0.** Bảy migration của mục này vẫn an toàn với image cũ, nhưng hai mươi hai migration của v1.4.0 chưa kiểm hết, và biết chắc migration `20261012190000_5527_manual_tier` chạy `ALTER TYPE AuditAggregateType ADD VALUE 'TIER_SCHEME'`: image v1.3.1 đọc dòng audit mang giá trị đó sẽ lỗi. Đã dùng Tier thì không về v1.3.1 được khi chưa sửa enum.

## v1.4.0-rc.3 — 2026-10-16

**Chi trả reward theo đợt và theo kênh (v1.4.1, nay nằm trong v1.4.0).** Từ v1.4.0-rc.2 lên có **7 migration mới**, chạy MỘT lần bằng image mới với tài khoản migration (mục 4 của [upgrade.md](upgrade.md)); cộng với các migration đã nêu ở v1.4.0-rc.1, từ v1.3.1 lên là **29 migration**. Cả bảy chỉ thêm bảng, thêm cột hoặc thay hàm/ràng buộc của bảng mới; không xoá cột hay bảng cũ.

- 🟡 Migration `20261014180000_5696_point_payout_batches` thêm HAI bảng mới `point_payout_batches` và `point_payout_lines` (đợt chi trả và các dòng trong đợt). Không sửa bảng cũ, không có cột tiền.
- 🟡 Migration `20261014190000_5696_point_payout_runs` thêm bảng mới `point_payout_runs` (mỗi lần bấm "Chi trả" hoặc "Gửi lại" là một lượt chạy nền).
- 🟡 Migration `20261015100000_5732_payout_timeout_not_releasable` thay hàm kiểm `point_payout_lines_guard`: dòng đã gửi mà hết thời gian chờ thì **không** tháo và không huỷ đợt được (đối tác đồng bộ có thể đã trả). Chạy lại được (CREATE OR REPLACE).
- 🟡 Migration `20261015100100_5732_payout_run_pause_reason_refused` nới ràng buộc `pause_reason` của `point_payout_runs` thêm giá trị `REFUSED` (lượt chạy tự dừng khi 20 dòng liên tiếp bị cửa từ chối). Chạy lại được.
- 🟡 Migration `20261015120000_5764_settlement_send_per_minute` thêm cột `settlement_send_per_minute` vào bảng CŨ `integrations` (kênh gửi tất toán): `NOT NULL DEFAULT 60` nên mọi kênh đang có đọc 60, không cần chạy bù; kèm ràng buộc `CHECK (>= 0)`. `0` là tạm dừng kênh chứ không phải không giới hạn.
- 🟡 Migration `20261015130000_5765_payout_batch_channel` thêm cột nullable `settlement_integration_id` vào `point_payout_batches`, kèm **khoá ngoại tới `integrations` (ON DELETE RESTRICT)**: đợt chi trả nhớ kênh nó chi qua và khoá kênh từ khi có lần gửi thật; một kênh đã gắn với đợt thì không xoá được. Đợt đang có để trống (chưa chọn kênh).
- 🟢 Migration `20261016010000_5852_payout_line_refusal` thêm ba cột nullable vào `point_payout_lines` (`refused_code`, `refused_at`, `refused_run_id`): dòng bị cửa từ chối trước khi gói đi là "gửi thất bại" kèm lý do.
- 🔴 **`PARTNER_EGRESS_TEST_ORIGINS` không bao giờ được đặt ở môi trường thật.** Biến chỉ dành cho sân kiểm thử L4; `env:check` nay báo `FORBIDDEN: PARTNER_EGRESS_TEST_ORIGINS SET` (mã `2`) và API cùng worker từ chối khởi động nếu nó được đặt khi `APP_ENV` không phải `local`, `ci` hay `test`. Gặp dòng đó thì xoá biến khỏi cấu hình chạy, đừng đổi `APP_ENV` cho qua (chi tiết ở [upgrade.md](upgrade.md)).
- 🟢 Biến TUỲ CHỌN `POINT_PAYOUT_RUN_INTERVAL_MS` [3000, tối thiểu 500]: nhịp kiểm lượt chi trả của worker; bỏ trống là mặc định.
- **Quay lui về `v1.4.0-rc.2`: được, với ba điều kiện** (SA đánh giá trên mã, DevOps chạy thử `migrate deploy` của rc.2 trên một DB mới đã lên rc.3: báo "No pending migrations to apply", không lỗi). Không có lệnh gỡ nào phải chạy; để nguyên bảng và cột mới.
  1. Dừng hoặc đợi xong mọi lượt gửi nền (trạng thái QUEUED/RUNNING) rồi mới hạ image; lên lại rc.3 thì worker nhận lại lượt và gửi tiếp các dòng còn lại.
  2. Trong lúc chạy image cũ, **không bấm Gửi hay Gửi lại** ở màn Chốt kỳ điểm cho người đang nằm trong một đợt chi trả đang MỞ (image cũ không biết đợt, có rủi ro gửi trùng).
  3. `migrate deploy` của image cũ trên DB có bảy migration "lạ" phải thoát 0 với "No pending migrations"; nếu không, dừng và báo.
- **Quay lui về `v1.3.1`: CHƯA kiểm cho phần của v1.4.0.** Bảy migration của mục này vẫn an toàn với image cũ, nhưng hai mươi hai migration của v1.4.0 chưa kiểm hết, và biết chắc migration `20261012190000_5527_manual_tier` chạy `ALTER TYPE AuditAggregateType ADD VALUE 'TIER_SCHEME'`: image v1.3.1 đọc dòng audit mang giá trị đó sẽ lỗi. Đã dùng Tier thì không về v1.3.1 được khi chưa sửa enum.

## v1.4.0-rc.2 — 2026-10-16

Không đổi.

## v1.4.0-rc.1 — 2026-10-15

- 🟡 **Link chia sẻ Storefront dùng mã ngắn `/l/{code}` trên domain của đơn vị**: giữ cơ chế chọn custom domain đã xác minh hoặc subdomain của đơn vị như trước; không cần `PROGRAM_LINK_PUBLIC_BASE_URL` cho link Storefront. Proxy cần chuyển `/l/*` tới API (router trong image đã có cấu hình). Sau khi nâng cấp, tạo một link chia sẻ Storefront, mở `/l/…`, kiểm tra chuyển tới `/s/…/r/…` trên domain Storefront kèm consent và cookie. Biến `PROGRAM_LINK_PUBLIC_BASE_URL` tiếp tục dùng cho link tích hợp ngoài.
- 🟢 **Giữ HTTPS của link Storefront qua nginx/Caddy:** bỏ `header_up X-Forwarded-Proto {scheme}` vì nginx kết thúc TLS rồi gọi router bằng HTTP; dòng này ép app thấy HTTP, gây redirect HTTP và bootstrap giới thiệu lỗi Origin/403. Host vẫn ghim theo `{hostport}`. Protocol từ peer ngoài danh sách trust vẫn không được tin.
- **`CADDY_TRUSTED_PROXIES` (tuỳ chọn):** danh sách IP/CIDR cách nhau bằng dấu cách; mặc định `private_ranges`, giữ chính sách trust hiện hành. Deployment nginx trên host qua gateway Docker private không cần thêm env chỉ cho sửa này. Có thể giới hạn tới IP/CIDR nginx thực tế. Cổng router phải chỉ nhận nginx (publish loopback trên host), nginx phải ghi đè `X-Forwarded-Proto` theo `$scheme` và giữ `Host` theo request thật. Compose thật ngoài repo phải truyền biến này nếu muốn override; sửa env/compose mẫu không tự áp lên server.
- **Triển khai/kiểm tra:** merge develop để workflow build image gộp có Caddyfile mới và rollout `app`; không có migration DB cho sửa này. Mở lại link HTTPS: `Location` giữ HTTPS, bootstrap không còn 403 do lệch Origin. Nếu vẫn `referral?failed=1`, cần kiểm mã lỗi upstream còn lại. Quay về Caddyfile cũ tái hiện việc ép protocol HTTP; test router không thay nghiệm thu browser/deploy.

- 🟢 **Trang bán hàng: trần cửa tải ảnh khách gửi kèm yêu cầu hỗ trợ.** Biến tuỳ chọn `STOREFRONT_EVIDENCE_UPLOAD_MAX_PER_HOUR` [60], đếm theo (trang, IP thật của khách) như hai trần ở mục dưới, nên cũng cần `TRUST_PROXY_HOPS` đúng; `0` là đóng cửa tải ảnh.
- 🟡 **Ảnh khách gửi kèm yêu cầu hỗ trợ ra khỏi thư viện media.** Migration `20261012090000_5387_buyer_evidence_private` đánh dấu mọi ảnh đó là dữ liệu cá nhân và riêng tư (ảnh đã lỡ công khai thì thu về), rồi đọc lại và dừng triển khai nếu còn sót ảnh nào. Chạy tự động lúc triển khai; quay lui bằng image cũ được, nhưng image cũ lại cho người có quyền thư viện xem ảnh đó. TRƯỚC khi triển khai, chạy `scripts/ops/audit-5387-buyer-evidence-exposure.sql` (chỉ đọc) trên CSDL thật để biết ảnh nào đã lộ, rồi dán kết quả vào phiếu (script tự dừng nếu vai DB không phải superuser hay BYPASSRLS, vì khi đó mọi con số đều ra 0). SAU khi mọi pod đã lên image mới: chạy lại migration đó bằng tay một lần (nó idempotent, vai nào cũng chạy được) để thu nốt ảnh mà pod cũ lỡ công khai trong lúc cuốn chiếu: `psql "$DATABASE_URL_MIGRATE" -v ON_ERROR_STOP=1 -f db/prisma/migrations/20261012090000_5387_buyer_evidence_private/migration.sql`; chạy lại script đo, mục ① phải không còn dòng `is_pii = f` hay `public_now > 0`; rồi xoá cache CDN của `/api/v1/files/*` (file công khai được cache 1 giờ). Tài khoản kho (`MINIO_ACCESS_KEY`) phải đọc được object trong bucket PII (HEAD và GET theo khoảng byte) và chép object trong bucket đó; thiếu quyền thì mọi lượt xác nhận ảnh trả 502, log API có dòng `confirm <id>: storage measure failed (AccessDenied)`.
- 🟡 **`GET /api/v1/files/:id` (file công khai) chỉ phát trực tiếp ảnh và video** (JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, QuickTime), kèm `X-Content-Type-Options: nosniff`. File công khai kiểu khác (vd tài liệu chiến dịch PDF, logo lưu `application/octet-stream`) vẫn tải được nhưng trình duyệt tải về như tệp đính kèm thay vì mở ngay: logo như vậy thì tải lại ảnh là xong.

- 🔴 **Trang bán hàng: trần tần suất ở cửa công khai và dọn phiên khách hết hạn.** Ba việc ở cấu hình proxy, không nằm trong image:
  - Đặt `TRUST_PROXY_HOPS` đúng số proxy trước API: image all-in-one sau nginx trên host là `2` (nginx + router trong image). Có CDN hay load balancer trước nginx thì cộng thêm. Bỏ trống thì vẫn chạy, nhưng API chỉ thấy địa chỉ proxy nên trần không đếm (log `[storefront-public-door] … check TRUST_PROXY_HOPS`), trần tra đơn dồn mọi khách vào một bộ đếm, và IP ghi vào audit là địa chỉ ngoài cùng không thuộc dải riêng của chuỗi (có CDN thì là địa chỉ CDN; proxy phía trước ghi `unknown` hay `ip:port` thì là địa chỉ kết nối). Khai thừa thì khách tự chọn được IP.
  - Nginx trên host gửi `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` (như `infra/nginx/creatoros.conf`).
  - Cổng router chỉ mở cho nginx trên host (publish `127.0.0.1:<cổng>`): router nay tin hop thuộc dải mạng riêng.
- 🟡 Router trong image **nối** chuỗi `X-Forwarded-For` thay vì ghi đè (Caddy `trusted_proxies static private_ranges`). `X-Forwarded-Host` vẫn ghim theo `Host` (giữ cả cổng); `X-Forwarded-Proto` giữ protocol do nginx được tin truyền tới (xem sửa HTTPS ở trên). Khi đã khai `TRUST_PROXY_HOPS`, IP ghi vào audit, bằng chứng đồng ý và lượt bấm link tiếp thị là IP thật của người dùng (trước đây là một địa chỉ nội bộ cho mọi người). `caddy run` in cảnh báo "Unnecessary header_up" cho dòng ghim Host: dự kiến.
- 🟡 Migration `20261010140500_4760_storefront_session_purge` và `20261010141500_4760_storefront_purge_hardening` thay hàm trigger chỉ-thêm của `storefront_quote_revisions` (mở một cửa xoá hẹp cho job dọn) và thêm bốn chỉ mục trên `storefront_carts`, `storefront_checkout_sessions`, `storefront_order_bindings`. Chạy tự động lúc triển khai. Quay lui bằng image cũ vẫn được: image cũ không bật cờ của cửa xoá, nên với nó bảng vẫn chỉ-thêm; chỉ mục thừa vô hại.
- 🟢 Bốn biến TUỲ CHỌN, bỏ trống là mặc định: `STOREFRONT_SESSION_ISSUE_MAX_PER_HOUR` [120], `STOREFRONT_CHECKOUT_OPEN_MAX_PER_HOUR` [120, mở phiên đặt hàng và báo giá lại đếm chung], `STOREFRONT_QUOTE_REVISIONS_MAX` [30 trong 24 giờ], `STOREFRONT_SESSION_CLEANUP_INTERVAL_MS` [3600000]. `0` ở ba biến đầu là đóng cửa đó. Job dọn chạy ở tiến trình worker (`WORKER=1`).
- 🟡 Migration `20261011130000_4352_storefront_checkout_payment_method` thêm một cột nullable `payment_method` vào bảng `storefront_checkout_sessions` (phương thức thanh toán khách chọn ở Bước 1 đặt hàng). Cột dùng lại enum `StorefrontPaymentMethod` có sẵn và không điền dữ liệu cho dòng cũ. Chạy tự động lúc triển khai, không cần làm tay. Quay lui bằng image cũ vẫn được: mã cũ không đọc cột này. Khi đó đơn đặt dưới image cũ không mang theo phương thức, khách chọn ở màn hướng dẫn thanh toán như trước.
- 🔴 **Soát chữ đã lưu TRƯỚC khi nâng: ô chữ chỉ gồm ký tự không hiện được giờ tính là rỗng.** Từ bản này, ô chữ người dùng gõ mà chỉ gồm ký tự không hiện được (ví dụ chỉ U+200B, U+3164 hoặc U+00AD) tính là rỗng. Chữ như vậy đã lưu từ trước sẽ bị từ chối khi ứng dụng đọc lại. Không soát thì: link chương trình báo lỗi 500, đơn trang bán hàng mất ghi nhận tiếp thị mà không báo, trang chủ trang bán hàng hiện trống, xuất bản chiến dịch báo `409 revision_invalid`.
  - Trước khi đổi container, chạy đoạn kiểm chỉ đọc ở [upgrade.md, mục 4f](upgrade.md) bằng tài khoản có `BYPASSRLS` hoặc siêu người dùng (đoạn kiểm tự từ chối chạy với tài khoản khác). **Ổn = không có dòng nào.**
  - Có dòng thì dừng nâng: sửa chữ đó trên Console (đổi tên rồi xuất bản bản Link mới, sửa bước hướng dẫn của chiến dịch hoặc khối CMS) rồi chạy lại. Dòng thuộc bản Link hay phiên bản chiến dịch đã xuất bản từ trước (không sửa được), hoặc không xác định được là ô nào, thì gửi kết quả cho đội phát hành trước khi nâng.
  - Không có migration. Quay lui bằng image cũ vẫn được: image cũ đọc được chữ bản mới đã lưu.
- 🟡 **Trang bán hàng: ô ngân hàng nhận tiền chỉ nhận ngân hàng có trong danh mục.** Không có migration, không có biến mới. Từ bản này, lưu chỉ dẫn chuyển khoản với mã ngân hàng không có trong danh mục ngân hàng đang bật bị từ chối. Chỉ dẫn đã lưu trước đó giữ nguyên: khách vẫn thấy chữ, nhưng mã lệch danh mục thì không có mã QR. Sau khi nâng, chạy **một lần** lệnh chỉ đọc sau để biết bao nhiêu trang cần chủ trang chọn lại ngân hàng (in mã trang, không in số tài khoản):
  `docker exec <container api> sh -c 'cd /repo && pnpm --filter @app/api count:storefront-payment-bank-codes'`
  Lệnh dùng khoá PII và chuỗi kết nối của container như API, và đọc trang của mọi đơn vị nên cần chuỗi kết nối quyền quản trị (`DATABASE_URL_WORKER` hoặc `DATABASE_URL_MIGRATE`). Thoát mã 1 thì đừng tin số đếm: dòng `UNREADABLE rows` là khoá PII sai; lỗi nhắc tới `DATABASE_URL_WORKER` là thiếu hai biến trên. Dòng `Pages scanned` phải khớp số trang đang có. Dòng cuối liệt kê ngân hàng trong danh mục có mã sai khuôn: chủ trang không chọn được ngân hàng đó, xử lý bằng cách tạo ngân hàng mới đúng khuôn, chuyển BIN NAPAS sang, rồi tắt ngân hàng cũ. Quay lui bằng image cũ được, cấu trúc dữ liệu không đổi.
- 🟡 Màn quản trị ngân hàng: mã ngân hàng **mới** chỉ gồm chữ in hoa, chữ số và `_` (tối đa 40 ký tự); ngân hàng đã có không bị đụng. Thêm ô BIN NAPAS (6 chữ số) dùng cho mã VietQR của trang bán hàng.
- 🟡 Migration `20261011200000_5388_storefront_support_request_lines_withdraw` thêm bốn cột nullable vào `storefront_support_requests` (`approved_at`, `approved_by_account_id`, `withdrawn_at`, `withdrawn_by_grant_id`), thêm trạng thái `WITHDRAWN` (khách rút yêu cầu) vào ràng buộc kiểm trạng thái, và hai ràng buộc cặp. Yêu cầu đang `APPROVED` được chép mốc duyệt từ `resolved_at`/`resolved_by_account_id`. Chạy tự động lúc triển khai, không cần làm tay. Quay lui bằng image cũ vẫn được: image cũ không đọc bốn cột mới và không ghi `WITHDRAWN`; yêu cầu khách đã rút dưới image mới hiện ở màn cũ như một trạng thái chưa có nhãn.
- 🟢 Biến TUỲ CHỌN `STOREFRONT_SUPPORT_REQUEST_CREATE_MAX_PER_HOUR` [30]: trần số yêu cầu huỷ, trả hàng, kiểm tra thanh toán khách gửi mỗi giờ, tính theo trang bán hàng và IP thật (cần `TRUST_PROXY_HOPS` đúng như các trần cửa công khai ở trên). Chỉ đếm lượt gọi của khách có quyền xem đơn đó, nên lượt gọi rác từ cùng địa chỉ không tiêu hạn mức của khách thật. `0` là đóng cửa đó.
- 🟡 **Đơn vị mới có sẵn trang chủ Đang chạy; đơn vị cũ chạy bù một lần.** Không có migration, không có biến mới. Từ bản này, tạo đơn vị là có luôn trang chủ phiên bản đầu `vYYMMDD-01` (theo giờ Việt Nam) mang bố cục mặc định, đang chạy, không có nháp; xoá tài liệu landing qua API CMS bị từ chối (`409 landing_default_cannot_be_disabled`). Đơn vị đã tạo từ trước vẫn như cũ cho tới khi chạy lệnh bù (an toàn chạy lại, đơn vị đã có landing không bị đụng):
  `docker exec <container api> sh -c 'cd /repo && pnpm --filter @app/api backfill:default-landing'` (chỉ liệt kê, không ghi), rồi thêm `-- --apply` để ghi, hoặc `-- --apply --tenant=<uuid>` cho một đơn vị. Đơn vị mà landing chỉ có nháp chưa đăng (`DRAFT_ONLY`) hoặc landing đã bị xoá (`SOFT_DELETED`) được liệt kê và để nguyên, cần người quyết. Chưa chạy lệnh bù thì đơn vị cũ vẫn hiện bố cục mặc định ở trang công khai như trước. Quay lui bằng image cũ vẫn được: hàng tạo ra là tài liệu landing bình thường.
- 🟢 **Console: tìm đơn bán hàng theo số điện thoại khách và lọc báo đã thanh toán quá hạn.** Không có migration. Biến TUỲ CHỌN `STOREFRONT_PAYMENT_REVIEW_OVERDUE_HOURS` [72]: yêu cầu "khách báo đã thanh toán" còn chờ quá số giờ này thì tính là quá hạn ở danh sách đơn của Console. Nhận số nguyên từ 0 tới 8760; giá trị khác dùng mặc định 72; `0` là mọi yêu cầu còn chờ.
- 🟡 `PII_REVEAL_MAX_PER_DAY` nay giới hạn thêm số lần tìm đơn theo số điện thoại khách mỗi ngày của từng người, ngoài số lần xem thông tin khách. Hai việc đếm riêng nhưng dùng chung con số trần: nâng biến này là nâng cả hai. Mỗi lần tìm ghi một dòng nhật ký `storefront.admin_order_phone_lookup`, không chứa số điện thoại.

**Đối soát reward theo kỳ (v1.4.0).** Từ v1.3.1 lên có **22 migration mới**, chạy MỘT lần bằng image mới với tài khoản migration (mục 4 của [upgrade.md](upgrade.md)). Năm cái đã nêu ở các mục trên; 17 cái còn lại ở dưới. Tất cả chỉ thêm hoặc nới, không xoá cột hay bảng. Các mục 🔴 và 🟡 dưới đây là chỗ người cài cần kiểm hoặc biết trước khi chạy: có migration tự dừng triển khai khi môi trường không đạt.

- 🔴 **Migration `20261013090000_5543_partner_self_tier` dừng nếu chủ của ba hàm đọc hạng không phải vai có `BYPASSRLS` (hoặc siêu người dùng).** Nó thêm ba hàm đọc hạng (Tier) chạy bằng quyền chủ hàm. Chạy bằng đúng tài khoản migration của mục 4d của [upgrade.md](upgrade.md) (đã là yêu cầu từ v1.3.0). Kiểm trước, chỉ đọc, bằng chính tài khoản đó: `psql "host=… user=… dbname=…" -X -c "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user"`. **Ổn = `rolbypassrls` là `t`.**
- 🔴 **Migration `20261013160000_5457_5516_marketing_role_selfcheck` dừng nếu vai hệ thống `tenant_marketing` không có đúng 11 mã quyền.** Nó không cấp thêm gì: sau khi hai migration trước cùng thêm một mã (`cms:read`, `player_segment:read`) nó kiểm cả vai. Chỉ gặp khi vai này từng bị sửa tay trong cơ sở dữ liệu. Kiểm trước, chỉ đọc: `SELECT count(*) FROM creator_os.role_permissions rp JOIN creator_os.roles r ON r.id = rp.role_id WHERE r.tenant_id IS NULL AND r.code = 'tenant_marketing'`. **Ổn = 9 ở bản v1.3.0, 10 ở bản v1.3.1; sau nâng là 11.** Số khác: dừng, báo hỗ trợ trước khi chạy.
- 🟡 **Migration `20261014130000_5497_reward_entries_reverses_entry_idx` dựng chỉ mục bằng `CREATE INDEX CONCURRENTLY`** (không khoá ghi bảng `reward_entries`). Một lần dựng bị huỷ giữa chừng để lại chỉ mục dở dang cùng tên, và lần chạy lại sẽ bỏ qua nó: phải xoá chỉ mục đó rồi chạy lại. Kiểm, chỉ đọc: `SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'creator_os' AND NOT i.indisvalid`. **Ổn = không có dòng nào.**
- 🟡 **Migration `20261014170000_5713_remove_reconciliation_confirmation_flag_rows` xoá hàng cờ `reconciliation-confirmation` ở mọi đơn vị** (chỉ đúng khoá đó), rồi đọc lại và dừng nếu còn. Từ bản này xác nhận đối soát luôn bắt buộc trước *Chốt kỳ điểm* của chiến dịch Reward; cờ không còn được đọc. Quay lui bằng image cũ không khôi phục hàng đã xoá. Đếm trước, chỉ đọc (bảng bật bảo vệ theo hàng nên cần tài khoản có `BYPASSRLS`, tài khoản khác thấy 0): `SELECT count(*) FROM creator_os.tenant_feature_flags WHERE flag_key = 'reconciliation-confirmation'`.
- 🟢 **Quyền mới `player_support:compensate`** (migration `20261014100000_5497_player_support_compensate_permission`): migration gán sẵn cho `superadmin` và `tenant_admin`; không gán cho `tenant_operator` hay vai hỗ trợ. Màn Đối soát reward ở bản này không có thao tác phát bù điểm (xem *Có gì mới*). Kiểm sau nâng, chỉ đọc: `SELECT r.code FROM creator_os.role_permissions rp JOIN creator_os.roles r ON r.id = rp.role_id JOIN creator_os.permissions p ON p.id = rp.permission_id WHERE p.code = 'player_support:compensate' ORDER BY 1`. **Đúng = hai dòng: `superadmin`, `tenant_admin`.**
- 🟢 **Bảng và cột mới cho đối soát reward, chỉ thêm:** bảng `reward_reconciliation_periods` (kỳ đối soát, mỗi chiến dịch chỉ một kỳ đang mở) và `reward_drift_resolutions` (quyết định của người vận hành về từng dòng lệch, chỉ ghi thêm); cột `effective_at` ở bảng giao dịch và cột `chain_effective_at` ở bảng `creditings` (cho phép rỗng, không giá trị mặc định, không điền lại dữ liệu cũ); một chỉ mục duy nhất trên `reward_drift_resolutions` để mỗi dòng chỉ có một quyết định phát bù, và nới giới hạn độ dài mã dòng lên 1000 ký tự. Bảng do chính đợt này tạo nên chưa có dữ liệu cũ để vướng. Migration: `20261013100000_5497_reward_reconciliation_periods`, `20261013100000_5497_reward_drift_resolutions`, `20261014140000` (cột `effective_at`), `20261014150000_5497_creditings_chain_effective_at`, `20261014160000_5497_reward_drift_one_compensate_per_line`.
- 🟡 **Hạng (Tier) thủ công:** migration `20261012190000_5527_manual_tier` tạo các bảng hạng và dựng một chỉ mục duy nhất (không `CONCURRENTLY`) trên `program_memberships`; ghi vào bảng đó chờ trong lúc dựng, nên chạy migration khi ứng dụng đã dừng hoặc ít tải.
- 🟢 **Các migration nhỏ còn lại, chỉ thêm hoặc nới:** `20261010140000_5108_work_status_skipped_not_licensed` (nới ràng buộc trạng thái công việc của chương trình liên kết, thêm `SKIPPED_NOT_LICENSED`); `20261010140000_5264_campaign_redeem_note` (cột `redeem_note` cho phép rỗng); `20261011150000_5329_backfill_default_campaign_leaderboards` (tạo hai bảng xếp hạng mặc định cho mỗi chiến dịch đang chạy, đã kết thúc hoặc đã lên lịch mà chưa có bảng nào; chạy lại không tạo trùng); `20261012210000_5516_cms_version_updated_by_save_seqs` (hai cột của phiên bản CMS); `20261012220000_5516_marketing_cms_read` (cấp `cms:read` cho `tenant_marketing`); `20261013030000_5228_optional_delivery_reference` (thay hàm kiểm bằng chứng giao hàng: số tham chiếu chứng từ không còn bắt buộc).
- 🟢 **Biến môi trường mới, đều TUỲ CHỌN, để trống là dùng mặc định:** `REWARD_PERIOD_LOCK_MAX_HOLDERS` (trần số kỳ đối soát giữ khoá cùng lúc trong một tiến trình API; mặc định một phần ba cỡ pool kết nối, tối thiểu 1, xem mục dưới); `REWARD_PERIOD_LOCK_TIMEOUT_MS` (thời gian chờ khoá kỳ, mặc định 15000); `HONOR_SHARE_MIN_CREATORS` (số creator tối thiểu để bảng vinh danh hiện "Top 3 · trên N creator", mặc định 20); `CONSOLE_ORIGINS` (danh sách origin Console, cách nhau bằng dấu phẩy, mà trang chủ được gọi khi hiện trong khung xem trước của Console; mặc định rỗng = chỉ origin của chính trang; là cấu hình lúc chạy của portal creator, không phải biến lúc build).
- 🔴 **Điều kiện phát hành: `DATABASE_URL` của container API phải khai `connection_limit` tường minh.** Trần số kỳ đối soát giữ khoá cùng lúc bằng một phần ba cỡ pool kết nối. Cỡ pool lấy từ `connection_limit`; không có thì mã **ước lượng thận trọng** bằng `số lõi luận lý + 1`, vì mặc định của Prisma là `2 × số lõi vật lý + 1` còn Node chỉ đếm được lõi luận lý. Trên máy siêu phân luồng (hyper-threading) hai luồng mỗi lõi hoặc không siêu phân luồng, ước lượng này không vượt mặc định của Prisma (trần tính theo ước lượng; máy 4 lõi vật lý, 8 luận lý: pool 9, ước lượng 9, trần 3; máy 4 lõi không siêu phân luồng: pool 9, ước lượng 5, trần 1). Nhưng số lõi vật lý Prisma thấy phụ thuộc phần cứng hoặc máy ảo mà mã không kiểm được: nếu nó thấy ít hơn một nửa số lõi luận lý (máy ảo khai lõi lạ, bộ vi xử lý hơn hai luồng mỗi lõi) thì trần có thể cao hơn một phần ba pool thật, cạn pool và **cả API đứng** (triệu chứng `P2024`). Vì vậy vẫn phải khai `connection_limit` tường minh: pool và trần khi đó không phụ thuộc phần cứng. Thêm `?connection_limit=<N>` (hoặc `&connection_limit=<N>` nếu URL đã có tham số) vào `DATABASE_URL` của container API, với `N` không vượt `max_connections` của PostgreSQL chia cho số tiến trình API và tác vụ nền. Kiểm, chỉ đọc, đã che tài khoản: `docker exec <container api> sh -c 'echo "$DATABASE_URL" | sed -E "s#//[^@]*@#//***@#" | grep -oE "connection_limit=[0-9]+" || echo "KHÔNG có connection_limit"'`. **Đúng = `connection_limit=<N>`.** Ra "KHÔNG có connection_limit": khai rồi tạo lại container API trước khi nâng.

## v1.3.1 — 2026-10-15

Bản **v1.3.1** gom các thay đổi của `v1.3.1-rc.1` và `v1.3.1-rc.2`; `v1.3.1-rc.2` không đổi gì cho người cài. Từng mục rc nằm bên dưới, giữ nguyên.

**v1.3.1: nhóm người chơi do ĐƠN VỊ tự khai.** Nâng từ v1.3.0 lên, không cần đổi biến môi trường.

- 🔴 **Ba migration mới, trong đó MỘT có đổi cấu trúc và sao chép dữ liệu**, chạy MỘT lần bằng image mới với tài khoản migration (mục 4 của [upgrade.md](upgrade.md)): `20261013140000_5457_player_segment_permissions` và `20261013140100_5457_marketing_player_segment_read` (chỉ thêm hai mã quyền và gán vai, chạy lại vô hại), `20261013150000_5457_player_segment_catalog` (bảng mới `player_segment_catalog` + **sao chép** nhóm người chơi đã khai sang bảng mới).
- 🔴 **Tài khoản migration phải có `BYPASSRLS`** (mục 4d của [upgrade.md](upgrade.md); đã là yêu cầu từ v1.3.0, nên đã nâng v1.3.0 đúng thì có sẵn). Lý do riêng của lần này: migration `…150000` đọc nhóm của MỌI đơn vị từ bảng có bảo mật theo hàng; tài khoản thiếu thuộc tính này đọc về 0 hàng và **khối tự kiểm cuối dừng triển khai** với lỗi `5457 player_segment_catalog: N (unit, slug) pairs were not copied`. Kiểm trước bằng lệnh ở mục 4d: `rolbypassrls` phải là `t`. Là `f` thì dừng, không chạy migration.
- 🟡 **Quay lui về v1.3.0 bằng image cũ vẫn được**: bảng cũ `integration_segment_catalog` và `integration_segment_unseen` **giữ nguyên, không ghi nữa**. Điều mất: nhóm khai MỚI sau khi lên v1.3.1 chỉ nằm ở bảng mới, image cũ không biết, các mã đó thành "nhóm lạ" (không gắn cho người chơi, vẫn không làm hỏng lượt vào game). Muốn image cũ vẫn áp các nhóm đó thì **trước khi quay lui** chạy đoạn sao chép ngược ở mục 7b của [upgrade.md](upgrade.md). **Lên lại v1.3.1 sau khi đã quay lui thì PHẢI làm mục 7c** (`migrate deploy` không chạy lại migration đã ghi, nên nhóm khai trong thời gian chạy v1.3.0 không tự vào bảng mới). Nhóm đã gắn trên người chơi không đổi (bảng xếp hạng lọc theo chuỗi mã nhóm), mọi mùa đã chạy không đổi kết quả.
- 🟡 **Danh mục nhóm giờ là của đơn vị, không còn của từng tích hợp.** Nhóm khai qua cổng nền tảng của một tích hợp dùng được ở mọi tích hợp của cùng đơn vị; trần 50 nhóm đang dùng và 200 hàng tính cho cả đơn vị (đơn vị mỗi cổng một tích hợp thì số thực tế không đổi). Khai một mã mà nhóm cũ đã **lưu trữ** nay trả `409 SEGMENT_ARCHIVED` (trước là `SEGMENT_SLUG_EXISTS`); trùng nhóm đang dùng vẫn `SEGMENT_SLUG_EXISTS`. Hợp đồng gọi API của ứng dụng gửi nhóm **không đổi**.
- 🟡 **Nhật ký đổi tên sự kiện:** thao tác khai, sửa, lưu trữ, khôi phục nhóm ghi `player_segment.declared`, `…updated`, `…archived`, `…restored` (đối tượng là đơn vị; qua cổng nền tảng payload có `viaIntegrationId`). Các dòng cũ `integration.segment_*` giữ trong lịch sử: **truy vấn nhật ký phải tìm cả hai tiền tố**.
- 🟢 **Hai mã quyền mới** `player_segment:read` và `player_segment:manage` (migration gán sẵn: quản trị đơn vị và vận hành đơn vị có cả hai, Marketing đơn vị chỉ `read`; vai tuỳ biến do đơn vị tự cấp).
- 🟡 **`GET /api/v1/license/status` gọi thẳng được, không cần đăng nhập và không cần đơn vị**: trả `status` (`ACTIVE`, `GRACE`, `EXPIRED`, `INVALID`, `ABSENT`, `WRONG_DEPLOYMENT`), `expiresAt`, `graceEndsAt`, `features`, `deploymentId` và `publicKeyFingerprint`. Không trả `LICENSE_KEY`, khoá công khai hay `iss`. Ở v1.3.0 đường này đòi đăng nhập, nên lệnh `curl -s http://<host>:4700/api/v1/license/status` trong [upgrade.md](upgrade.md) ăn 400/401; từ bản này chạy được không token. Không có biến môi trường mới.

## v1.3.1-rc.2 — 2026-10-15

Không đổi.

## v1.3.1-rc.1 — 2026-10-15

**v1.3.1-rc.1: nhóm người chơi do ĐƠN VỊ tự khai.** Nâng từ v1.3.0 lên, không cần đổi biến môi trường.

- 🔴 **Ba migration mới, trong đó MỘT có đổi cấu trúc và sao chép dữ liệu**, chạy MỘT lần bằng image mới với tài khoản migration (mục 4 của [upgrade.md](upgrade.md)): `20261013140000_5457_player_segment_permissions` và `20261013140100_5457_marketing_player_segment_read` (chỉ thêm hai mã quyền và gán vai, chạy lại vô hại), `20261013150000_5457_player_segment_catalog` (bảng mới `player_segment_catalog` + **sao chép** nhóm người chơi đã khai sang bảng mới).
- 🔴 **Tài khoản migration phải có `BYPASSRLS`** (mục 4d của [upgrade.md](upgrade.md); đã là yêu cầu từ v1.3.0, nên đã nâng v1.3.0 đúng thì có sẵn). Lý do riêng của lần này: migration `…150000` đọc nhóm của MỌI đơn vị từ bảng có bảo mật theo hàng; tài khoản thiếu thuộc tính này đọc về 0 hàng và **khối tự kiểm cuối dừng triển khai** với lỗi `5457 player_segment_catalog: N (unit, slug) pairs were not copied`. Kiểm trước bằng lệnh ở mục 4d: `rolbypassrls` phải là `t`. Là `f` thì dừng, không chạy migration.
- 🟡 **Quay lui về v1.3.0 bằng image cũ vẫn được**: bảng cũ `integration_segment_catalog` và `integration_segment_unseen` **giữ nguyên, không ghi nữa**. Điều mất: nhóm khai MỚI sau khi lên v1.3.1 chỉ nằm ở bảng mới, image cũ không biết, các mã đó thành "nhóm lạ" (không gắn cho người chơi, vẫn không làm hỏng lượt vào game). Muốn image cũ vẫn áp các nhóm đó thì **trước khi quay lui** chạy đoạn sao chép ngược ở mục 7b của [upgrade.md](upgrade.md). **Lên lại v1.3.1 sau khi đã quay lui thì PHẢI làm mục 7c** (`migrate deploy` không chạy lại migration đã ghi, nên nhóm khai trong thời gian chạy v1.3.0 không tự vào bảng mới). Nhóm đã gắn trên người chơi không đổi (bảng xếp hạng lọc theo chuỗi mã nhóm), mọi mùa đã chạy không đổi kết quả.
- 🟡 **Danh mục nhóm giờ là của đơn vị, không còn của từng tích hợp.** Nhóm khai qua cổng nền tảng của một tích hợp dùng được ở mọi tích hợp của cùng đơn vị; trần 50 nhóm đang dùng và 200 hàng tính cho cả đơn vị (đơn vị mỗi cổng một tích hợp thì số thực tế không đổi). Khai một mã mà nhóm cũ đã **lưu trữ** nay trả `409 SEGMENT_ARCHIVED` (trước là `SEGMENT_SLUG_EXISTS`); trùng nhóm đang dùng vẫn `SEGMENT_SLUG_EXISTS`. Hợp đồng gọi API của ứng dụng gửi nhóm **không đổi**.
- 🟡 **Nhật ký đổi tên sự kiện:** thao tác khai, sửa, lưu trữ, khôi phục nhóm ghi `player_segment.declared`, `…updated`, `…archived`, `…restored` (đối tượng là đơn vị; qua cổng nền tảng payload có `viaIntegrationId`). Các dòng cũ `integration.segment_*` giữ trong lịch sử: **truy vấn nhật ký phải tìm cả hai tiền tố**.
- 🟢 **Hai mã quyền mới** `player_segment:read` và `player_segment:manage` (migration gán sẵn: quản trị đơn vị và vận hành đơn vị có cả hai, Marketing đơn vị chỉ `read`; vai tuỳ biến do đơn vị tự cấp).
- 🟡 **`GET /api/v1/license/status` gọi thẳng được, không cần đăng nhập và không cần đơn vị**: trả `status` (`ACTIVE`, `GRACE`, `EXPIRED`, `INVALID`, `ABSENT`, `WRONG_DEPLOYMENT`), `expiresAt`, `graceEndsAt`, `features`, `deploymentId` và `publicKeyFingerprint`. Không trả `LICENSE_KEY`, khoá công khai hay `iss`. Ở v1.3.0 đường này đòi đăng nhập, nên lệnh `curl -s http://<host>:4700/api/v1/license/status` trong [upgrade.md](upgrade.md) ăn 400/401; từ bản này chạy được không token. Không có biến môi trường mới.

## v1.3.0 — 2026-10-12

**Nâng THẲNG từ v1.0.6 lên v1.3.0.** Mục này **cộng dồn** mọi việc người nâng từ v1.0.6 phải làm: bỏ qua v1.0.7, v1.1.0, v1.2.0 và các bản `-rc` đã phát hành trước đó, làm theo một mục này là đủ. Các mục `v1.3.0-rc.*`, `v1.2.0-rc.*`, `v1.1.0`, `v1.0.7` bên dưới giữ nguyên để tra từng thay đổi.

- **229 migration mới** (218 ở v1.0.6, 447 sau khi nâng), chạy MỘT lần bằng image v1.3.0 với tài khoản migration, xem mục 4 và 4e của [upgrade.md](upgrade.md).
- **Không quay lui được bằng image cũ** một khi migration đã chạy: đường quay lui duy nhất là khôi phục bản sao lưu vào một cơ sở dữ liệu MỚI (mục *Quay lui* cuối mục này).
- Có **một biến môi trường mới bắt buộc** (`INTERNAL_API_SECRET`), **hai biến phải bỏ** (`DEV_FIXED_OTP`, `PARTNER_SANDBOX_ENABLED`), **sáu biến URL phải đổi đuôi** và một biến đổi cách đọc (`PLATFORM_BASE_DOMAINS`): bảng đầy đủ ở *Biến môi trường* bên dưới.

### Làm theo thứ tự

**A. Trước khi nâng (dịch vụ còn chạy)**

1. 🔴 **Hai vai cơ sở dữ liệu đúng tên** (từ v1.1.0): `creator_os_app` cho `DATABASE_URL`, `creator_os_worker` cho `DATABASE_URL_WORKER`, không phải tài khoản superuser. Migration chỉ cấp quyền cho đúng hai tên này; tên khác thì migration vẫn báo xong mà ứng dụng thiếu quyền ở mọi bảng, và đổi tên sau không làm migration chạy lại. Kiểm bằng tài khoản migration: `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('creator_os_app','creator_os_worker') ORDER BY 1` phải ra đúng 2 dòng, `rolsuper = f`. Cấp quyền dùng schema: `GRANT USAGE ON SCHEMA creator_os TO creator_os_app, creator_os_worker`. Đang dùng tên khác thì đổi tên **trước** khi migrate (mục 4 của [upgrade.md](upgrade.md)).
2. 🔴 **Tài khoản migration có `BYPASSRLS` và là CHỦ của mọi bảng trong schema `creator_os`** (mục 4d và 4e của [upgrade.md](upgrade.md)). Thiếu `BYPASSRLS` thì migration dừng giữa chừng ở migration `3540` khi cơ sở dữ liệu đã chạy dở. Kiểm: `SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user` ra `t`, và `SELECT tableowner, count(*) FROM pg_tables WHERE schemaname='creator_os' GROUP BY 1` ra đúng MỘT dòng, là tài khoản migration. Mọi lần chạy migration phải dùng cùng tài khoản này.
3. 🔴 **Không có hai đợt chốt kỳ `PENDING` cho cùng (đơn vị, chiến dịch, mệnh giá)** (migration `20261004100000_4645_one_pending_batch_per_pair` từ chối chạy, lúc đó ứng dụng đã dừng). Đếm bằng tài khoản `BYPASSRLS` (tài khoản thường bị che, ra `0` sai): `SELECT count(*) FROM (SELECT tenant_id, campaign_id, denomination_code FROM creator_os.point_settlement_batches WHERE status = 'PENDING' GROUP BY 1,2,3 HAVING count(*) > 1) d` phải ra `0`. Lớn hơn 0: vận hành huỷ hoặc xác nhận đợt thừa trên màn Chốt kỳ điểm (quyết định nghiệp vụ), rồi đếm lại.
4. 🔴 **Không có dòng chốt kỳ vi phạm ràng buộc mới** (migration `20261010120000_5114_settlement_kind` từ chối chạy): `SELECT count(*) FROM creator_os.point_settlement_items WHERE exchange_rate_snapshot <= 0 OR money_amount < 0 OR money_currency !~ '^[A-Z]{3}$'` phải ra `0`. Khác 0: **dừng**, báo hỗ trợ, không tự `UPDATE`.
5. 🔴 **Không có tích hợp nào mang từ 2 namespace DIRECT khác nhau**: Launch nay từ chối tích hợp như vậy. Có thì liên hệ hỗ trợ (mục 8 của [upgrade.md](upgrade.md)) **trước** khi nâng.
6. 🔴 **`.env` qua được kiểm của image v1.3.0**, sau khi sửa theo bảng *Biến môi trường* bên dưới: `docker run --rm --network none --env-file .env --entrypoint sh <registry>:v1.3.0 -c 'cd /repo && pnpm --filter @app/api preflight:env'; echo $?` phải ra mã `0` kèm dòng `OK: required variables present, no forbidden setting`. Mã `1`: thiếu `JWT_SECRET` hoặc `INTERNAL_API_SECRET`; mã `2` hoặc `3`: còn `DEV_FIXED_OTP`, `AUTH_PROVIDER_MODE=mock` hoặc `PARTNER_SANDBOX_ENABLED`; mã `4` đến `7`: `PLATFORM_BASE_DOMAINS` sai khuôn.
7. 🔴 **Triển khai:** image chỉ mở **một cổng**, router `8080`: đổi cổng publish trong compose sang `8080`, proxy phía trước chỉ còn **một** `proxy_pass`. **Nếu trước đây mỗi portal một tên miền, không tiền tố** (Reward ở một tên miền, Console ở tên miền khác): mọi portal nay chạy dưới đường dẫn con (`/reward`, `/console`, `/creator`, hằng số trong mã, không cấu hình được), nên nginx ngoài phải `proxy_pass` về router `8080` **và** 308 đường dẫn cũ sang tiền tố theo TỪNG tên miền, giữ query (`return 308 /reward$request_uri;`), loại trừ `/.well-known/acme-challenge/` khỏi 308. Router trong image KHÔNG phân biệt tên miền: đường dẫn trần bị nó đẩy sang `/creator`, sai portal. `RUN_WORKER=true` ở **đúng MỘT** container (thiếu thì không ai chạy job mà không báo gì; thừa thì job chạy đôi). API và worker dùng chung nguồn giờ NTP.
8. 🔴 **License giữ nguyên:** `LICENSE_KEY` và `DEPLOYMENT_ID` không đổi và còn hiệu lực với bản mới (image bản phát hành kiểm license; license hỏng thì cụm Reward tắt, không có lỗi nào báo).
9. 🟡 `pg_dump` và `pg_restore` cùng bậc chính với PostgreSQL đang chạy (khác bậc thì bản sao lưu không khôi phục được). Lệch thì dùng công cụ trong image `postgres:<bậc chính>`.

**B. Trong lúc nâng**

10. **Dừng API và worker** TRƯỚC khi sao lưu và migrate (không để ghi xen giữa; sau migrate image cũ không chạy được).
11. **Sao lưu NGAY trước migrate, cất ngoài máy chủ ứng dụng:** `pg_dump --format=custom --file=<thư mục>/creatoros-truoc-v1.3.0-<ngày-giờ>.dump "<chuỗi kết nối migrate>"` (bỏ đuôi `?schema=creator_os`). Ghi lại số migration đã chạy: `SELECT count(*) FROM creator_os._prisma_migrations WHERE finished_at IS NOT NULL` (v1.0.6 ra `218`). Giữ tệp ít nhất một tuần sau khi v1.3.0 chạy ổn.
12. **Migrate bằng image v1.3.0:** `docker run --rm --env-file .env --entrypoint sh <registry>:v1.3.0 -c 'cd /repo && DATABASE_URL="$DATABASE_URL_MIGRATE" pnpm --filter @app/db exec prisma migrate deploy'` phải in `All migrations have been successfully applied`, không dòng `Error`; tổng **447** migration. Lỗi giữa chừng: **dừng**, giữ nguyên output, không chạy lại bừa; muốn lùi thì theo mục *Quay lui*.
13. Khởi động API và worker bằng image v1.3.0.

**C. Sau khi nâng**

14. **Đúng bản, sẵn sàng, worker chạy:** `GET /api/v1/version` ra `gitBranch` là `v1.3.0`; `GET /api/v1/health/ready` ra `200` trong 3 phút; tiến trình worker chạy. Quá 3 phút không `200` thì theo mục *Quay lui*.
15. **Cờ theo đơn vị:** `reconciliation-confirmation` **mặc định BẬT** (ops phải tích *đã đối chiếu bảng kê* trước khi Xác nhận chốt kỳ; đợt lập trước khi nâng không bị đòi). Bảng xếp hạng người chơi Reward **luôn bật** ở mọi đơn vị: không còn cờ `leaderboard-reward-player`, không phải bật gì trong bước nâng.
16. **Quyền mới `point_settlement:confirm_reconciliation`** chỉ được gán tự động cho vai đang giữ quyền xác nhận chốt kỳ lúc nâng. Vai tạo **sau** nâng bản, hoặc được cấp quyền chốt kỳ sau đó, **không tự có**: quản trị đơn vị cấp thêm, nếu không người đó kẹt ở bước chốt.
17. **Nhóm người chơi do đội nền tảng khai hộ ở v1.3.0.** Vai của đơn vị chưa tự khai được nhóm người chơi; nhóm mà đối tác gửi lúc launch (ví dụ cho một mùa chạy) phải được người có quyền nền tảng khai cho đúng cổng nhận sự kiện của đối tác **trước** khi ops đơn vị dựng bảng xếp hạng dùng nhóm đó. Ô Phân khúc ở màn tạo bảng xếp hạng chỉ liệt kê nhóm đã khai.
18. 🔴 **Kiểm tên miền riêng cũ nằm dưới tên miền gốc** (`PLATFORM_BASE_DOMAINS`) theo mục 6b của [upgrade.md](upgrade.md), SAU khi bản này đã chạy: bản trước v1.2.0-rc.2 cho một đơn vị thêm tên miền riêng bằng hoặc dưới tên miền gốc mà không cần chứng minh. Chỉ đọc; gặp `HIJACK_TENANT_ROW_ON_OTHER_TENANT_SLUG` thì người quản trị nền tảng gỡ dòng đó, và chỉ gỡ SAU khi bản này đã chạy.
19. **Kiểm khói phía người dùng:** ops đăng nhập Console; người chơi mở portal reward, ví và lịch sử điểm hiện đúng, số dư khớp lúc trước khi nâng.

### Biến môi trường (cộng dồn từ v1.0.6)

| | Biến | Việc phải làm |
|---|---|---|
| 🔴 | `INTERNAL_API_SECRET` | **MỚI, bắt buộc.** Thiếu thì API từ chối khởi động. Tự sinh: `openssl rand -hex 32`. Đặt cho container `api`; nếu dùng tên miền riêng, thêm header `X-Internal-Secret: <cùng giá trị>` vào lệnh `--deploy-hook` của certbot |
| 🔴 | `DEV_FIXED_OTP` | **Cấm ngoài develop**: còn đặt mà `APP_ENV` khác `develop` thì API từ chối khởi động. Production để trống hoặc gỡ |
| 🔴 | `PARTNER_SANDBOX_ENABLED` | Chỉ dùng ở sân thử (`APP_ENV` là `develop` hoặc `staging`); bản phát hành **cấm**: container từ chối khởi động nếu đặt |
| 🔴 | `REWARD_PORTAL_URL` | Phải kết thúc `/reward` |
| 🔴 | `CONSOLE_PORTAL_URL` · `APP_ORIGIN` · `OAUTH_PLATFORM_LANDING_ORIGIN` | Phải kết thúc `/console` |
| 🔴 | `CREATOR_PORTAL_URL` · `CREATOR_PORTAL_ORIGIN` | Phải kết thúc `/creator` |
| 🔴 | `PLATFORM_BASE_DOMAINS` | Danh sách **tên máy chủ trần** (từ hai nhãn trở lên) cách nhau bằng dấu phẩy, ví dụ `portal.example.com`; không `https://`, không dấu chấm đầu hoặc cuối, không `*.`, không `:cổng`, không đường dẫn. Giá trị chỉ cần dọn nay được tự chuẩn hoá và in cảnh báo lúc khởi động; **ở production, đặt mà không còn phần tử dùng được thì ứng dụng KHÔNG khởi động** (để trống hoặc không đặt vẫn hợp lệ). Hai tên miền gốc chồng nhau thì host khớp tên **dài nhất** |
| 🔴 | `REWARD_DRIFT_SWEEP_INTERVAL_MS` | **Không còn được đọc**: gỡ khỏi cấu hình. Thay bằng `REWARD_DRIFT_SWEEP_HOUR_VN` (giờ Việt Nam trong ngày, mặc định `2`) và `REWARD_DRIFT_CHECK_INTERVAL_MS` (nhịp kiểm, mặc định 5 phút): mỗi ngày MỘT lượt quét đối soát vào giờ cố định |
| 🔴 | `NOTIFICATION_MODE` | Không để `console` ở production (thông báo thật bị tắt mà không báo) |
| 🟡 | `PROGRAM_LINK_PUBLIC_BASE_URL` | **MỚI.** Địa chỉ công khai của API (https), dùng để tạo link chia sẻ chương trình và link chia sẻ Storefront. Thiếu thì tạo link trả `503` mã `LINK_PUBLIC_URL_UNAVAILABLE`; API vẫn khởi động. Đặt nếu dùng tính năng link |
| 🟡 | `RUN_PARTNER_SALE` · `RUN_STOREFRONT` · `RUN_ROUTER` | **Mặc định BẬT.** Bản chỉ chạy Reward có thể cần tắt nếu không dùng các phần đó |
| 🟡 | `PII_REVEAL_MAX_PER_DAY` | Hạn mức xem thông tin cá nhân mỗi ngày. Không đặt hoặc để trống thì dùng mặc định 30; đã đặt thì phải là số nguyên từ 0 trở lên, giá trị sai khuôn rơi về 30 và ghi một dòng cảnh báo vào log (trước đây có thể tắt hạn mức hoặc khoá hết) |
| 🟡 | `STOREFRONT_HOSTS` | Rỗng nghĩa là không chặn host nào (cố ý). Môi trường thật khai danh sách tên miền, phân cách bằng dấu phẩy |
| 🟡 | `STOREFRONT_REFERRAL_COOKIE_SECRET` | Tuỳ chọn: khoá ký cookie giới thiệu từ Storefront, tối thiểu 32 ký tự. Không đặt thì dùng `JWT_SECRET` nếu đủ 32 ký tự. Đã đặt mà để rỗng hoặc ngắn hơn 32 thì `JWT_SECRET` KHÔNG được dùng thay và ghi nhận giới thiệu bị tắt (ứng dụng vẫn khởi động): hoặc xoá hẳn dòng, hoặc đặt đủ 32 ký tự |
| 🟢 | `RECONCILIATION_RERUN_INTERVAL_MS` · `RECONCILIATION_RUN_LEASE_SEC` | **MỚI**, của worker: chu kỳ xem yêu cầu *Chạy lại đối soát* (mặc định `15000`) và thời gian giữ một lượt đối soát trước khi coi là chết (mặc định `1800`, tối thiểu `60`) |
| 🟢 | `OPSHUB_WEBHOOK_API_KEY` · `GUIDE_ORIGIN` · `QUOTA_CHANNEL_ENRICH_PER_DAY` · `QUOTA_CHANNEL_ENRICH_TENANT_PER_DAY` · `QUOTA_CHANNEL_ENRICH_OPS_PER_DAY` | **MỚI, không bắt buộc.** Khoá nhận webhook từ OpsHub; nguồn sổ tay cho cổng bán hàng đối tác; ba hạn mức ngày có mặc định trong mã |
| 🟢 | `AUDIENCE_GOOGLE_SA_KEY` · `EKYC_GOOGLE_SA_KEY` · `NOTIFICATION_GOOGLE_SA_KEY` · `PII_KEY_GOOGLE_SA_KEY` · `SECRETS_GOOGLE_SA_KEY` (và `*_GOOGLE_PROJECT_ID` tương ứng) | **MỚI, không bắt buộc.** Mỗi cụm có khoá riêng; thiếu thì dùng `GOOGLE_SERVICE_ACCOUNT_KEY` như v1.0.6. Cấu hình chỉ đặt biến cũ vẫn chạy |
| 🟢 | `REWARD_SUPPORT_URL` · `REWARD_TERMS_URL` | **MỚI, tuỳ chọn**, cho webview thưởng: đường dẫn Hỗ trợ / Liên hệ và Điều khoản và quyền riêng tư. Chỉ nhận `https:`, `tel:` hoặc `mailto:`; không đặt thì mục tương ứng ở màn Cài đặt của người chơi ẩn |
| 🟢 | Nhóm `MARKETPLACE_*` và `TIKTOK_*` | Chỉ cần khi bật kết nối sàn (mặc định tắt, `MARKETPLACE_SYNC_ENABLED`). Bật thì ở production phải đặt `MARKETPLACE_HMAC_SECRET_NAME`; `TIKTOK_SHOP_REDIRECT_URI` mặc định trỏ `http://localhost:3001/...` nên **phải đặt** lại; `TIKTOK_APP_ID`, `TIKTOK_APP_KEY`, `TIKTOK_APP_SECRET` lấy từ ứng dụng của sàn; các biến `TIKTOK_LIFECYCLE_WEBHOOK_FIXTURE_*` chỉ dành cho sân thử, để trống ở production |
| · | `STOREFRONT_LOCAL_HTTP` | Chỉ dành cho máy phát triển; production bỏ qua, không cần đặt |

Đối chiếu `.env` của bạn với `.env.example` và [reward-only.env.example](reward-only.env.example) của thẻ v1.3.0 để bắt nốt các biến không nằm trong bảng.

### Quay lui

- 🔴 **Từ v1.3.0 về v1.0.6: KHÔNG quay lui bằng image cũ.** Chạy `pg_restore --clean` đè lên cơ sở dữ liệu đã migrate làm bảng giao dịch điểm **nhân đôi** mà không báo lỗi, và image v1.0.6 không chạy trên schema mới. Đường duy nhất là **khôi phục bản sao lưu bước 11 vào một cơ sở dữ liệu MỚI rồi đổi tên**: (1) `CREATE DATABASE <db>_khoiphuc`; (2) `pg_restore --exit-on-error --dbname="<chuỗi kết nối migrate>/<db>_khoiphuc" <tệp bước 11>` (KHÔNG `--clean`); (3) kiểm chủ sở hữu bảng theo mục 4e của [upgrade.md](upgrade.md); (4) ngắt kết nối cả hai cơ sở dữ liệu; (5) `ALTER DATABASE <db> RENAME TO <db>_loi`; (6) `ALTER DATABASE <db>_khoiphuc RENAME TO <db>`; (7) chạy lại image v1.0.6. Số migration sau khi khôi phục phải bằng đúng giá trị ghi ở bước 11. Dữ liệu ghi sau lúc sao lưu mất.
- 🟡 **Từ v1.3.0 về v1.3.0-rc.3 (một bước): được bằng image cũ**, vì v1.3.0 không thêm migration so với rc.3. **Bật lại cờ `leaderboard-reward-player` cho các đơn vị đang dùng bảng xếp hạng người chơi Reward TRƯỚC khi đổi image** (Hệ thống → Tính năng của đơn vị, hoặc ghi hàng `tenant_feature_flags` khoá `leaderboard-reward-player`, `enabled = true`): image cũ vẫn đòi cờ này, không bật lại thì đơn vị chưa có hàng cờ không tạo được bảng mới và bảng đang có hiển thị rỗng.
- 🔴 **Đã có chiến dịch khai brand tài trợ theo hình bản ghi `{code, name}` (hai ô Mã và Tên) thì không lùi bằng image cũ**: image cũ chỉ đọc brand dạng chuỗi nên mọi đơn bị coi là "không thuộc brand tài trợ" và người chơi mất điểm âm thầm. Sửa tiến (vá và phát hành bản sau), đừng lùi. Chi tiết ở mục `v1.3.0-rc.2` bên dưới.
- Quay lui xa hơn rc.3 (về rc.2 trở xuống) bằng image cũ cũng bị chặn bởi migration `20261009120000_5130_link_public_code` (cột `public_code` `NOT NULL` không giá trị mặc định): xem *Quay lui từ v1.3.0-rc.3* bên dưới.

## v1.3.0-rc.4 — 2026-10-11

Nâng từ v1.3.0-rc.3. **Không có migration mới** và không có biến môi trường mới: bản này không đổi cấu trúc dữ liệu.

- **Mã sản phẩm: vài thay đổi nhỏ, không đổi cấu trúc dữ liệu.**
  - Nhãn đơn vị điểm ở trang ví người chơi đổi từ vàng 300 sang vàng 100 để đủ tương phản (chuẩn AA) trên nền gradient của thẻ.
  - Danh sách đầy đủ của bảng xếp hạng công khai chỉ mở cho người thuộc đúng đơn vị; người khác chỉ thấy phần đã đồng ý hiển thị công khai.
  - Thông báo và email của chiến dịch trả điểm in số kèm tên đơn vị điểm đã đặt; chiến dịch trả tiền giữ nguyên "đ".
  - Biến `PII_REVEAL_MAX_PER_DAY` có giá trị sai khuôn (không phải số nguyên từ 0 trở lên) **không còn tắt hạn mức xem thông tin cá nhân**: hệ thống dùng mặc định 30 lượt mỗi ngày và ghi một dòng cảnh báo vào log. Giá trị hợp lệ (kể cả `0`) hoạt động như cũ. Các lượt xuất lô (mã điểm, đợt quà vật lý) có thêm thời gian chờ riêng và báo rõ khi hết hạn mức.
- **Kho bí mật gián đoạn ngắn không còn làm cấp, cấp lại hay xoay khoá tích hợp trả lỗi 500.** Các thao tác này trả `503` mã `secret_store_unavailable` kèm `Retry-After`; không để lại hàng khoá dở, thử lại là cấp được. Lỗi quyền truy cập kho vẫn giữ nguyên lỗi kho bí mật như trước. Cổng nhận sự kiện của đối tác không đổi câu trả lời. Không đổi cấu hình, không migration.
- **Tài liệu và ảnh hướng dẫn:** trang hướng dẫn "Reward — người chơi" có thêm ảnh ví sau đối soát và ảnh trang chủ chụp lại, và một số ảnh hướng dẫn khác được chụp lại.
- 🟡 **Cờ theo đơn vị `leaderboard-reward-player` đã bỏ.** Bảng xếp hạng người chơi Reward nay luôn bật cho mọi đơn vị: không còn phải bật cờ này ở **Hệ thống → Tính năng** hay trong bước nâng bản. Hàng cờ đã có sẵn (bật hay tắt) vẫn nằm trong dữ liệu, vô hại, mã không đọc nó nữa. Bảng loại này đọc được công khai qua `GET /leaderboards/:defId/entries` ở mọi đơn vị. Người chưa đăng nhập và người đăng nhập đơn vị khác chỉ thấy hạng và giá trị, không có mã định danh. Dòng ở bản v1.3.0-rc.1 ghi *"mặc định không có, bật trong bước nâng bản"* không còn đúng từ bản này.
- Phần còn lại chỉ là kiểm thử nội bộ, không nằm trong image.
- Biến môi trường: không đổi.
- Việc phải làm tay: không (không còn phải bật cờ trong bước nâng bản).
- 🟡 **Quay lui từ v1.3.0-rc.4 về v1.3.0-rc.3 (hoặc cũ hơn): được bằng image cũ, nhưng image cũ vẫn đòi cờ `leaderboard-reward-player`.** Đơn vị chưa có hàng cờ bật sẽ không tạo được bảng xếp hạng người chơi Reward, và bảng đang có hiển thị rỗng cho tới khi cờ được bật lại. **Trước khi quay lui, bật lại cờ ở các đơn vị đang dùng bảng này** (Hệ thống → Tính năng của đơn vị, hoặc ghi hàng `tenant_feature_flags` với khoá `leaderboard-reward-player`, `enabled = true`).
- **Quay lui từ v1.3.0-rc.4 về v1.3.0-rc.3: được bằng image cũ**, vì rc.4 không thêm migration. Các điều kiện quay lui xa hơn (về rc.2 hay cũ hơn) nằm ở mục *Quay lui từ v1.3.0-rc.3* ngay dưới và vẫn giữ nguyên.

**Quay lui từ v1.3.0-rc.3** (ghi thêm sau khi cắt rc.3; áp dụng cho image rc.3 và các bản sau)

- 🔴 **KHÔNG quay lui về v1.3.0-rc.2 (hay cũ hơn) bằng image cũ một khi rc.3 đã chạy.** Migration `20261009120000_5130_link_public_code` thêm cột `public_code` của bảng `program_link_public_refs` và đặt `NOT NULL`, không có giá trị mặc định; mỗi dòng cũ được điền sẵn một mã NGẪU NHIÊN 12 ký tự. Image rc.2 không biết cột này, nên khi tạo liên kết chương trình MỚI, cơ sở dữ liệu từ chối bản ghi. Các chức năng khác của rc.2 vẫn chạy; chỉ việc tạo liên kết chương trình mới là hỏng. Cần quay lui thì báo đội phát hành trước khi đổi image.
- 🟡 **Cột tiền của dòng trong đợt chốt điểm** (migration `20261010120000_5114_settlement_kind`). Migration thêm cột `settlement_kind` (mặc định `MONEY`) cho đợt và cho dòng, và cho phép ba cột tiền của dòng (`exchange_rate_snapshot`, `money_amount`, `money_currency`) để trống ở dòng chỉ tính điểm (`POINT_ONLY`). Ở rc.3 chưa có đường nào tạo đợt `POINT_ONLY`, nên quay lui bằng image cũ vẫn an toàn: mọi dòng hiện có là `MONEY` và đủ cột tiền. **Từ bản có đường tạo đợt `POINT_ONLY` thì không còn như vậy**; xem mục quay lui của bản đó.
- 🟡 **Ràng buộc mới trên bảng chủ hoa hồng của đơn** (migration `20261008111100_4784_native_commission_owner`). Migration thêm hai cột nguồn (`sales_commitment_id`, `native_commitment_id`) và ràng buộc kiểm `commission_typed_lineage` trên bảng `commerce_order_commission_owners`. **Chưa kiểm** image cũ có ghi qua được ràng buộc này hay không; nếu cần quay lui, báo đội phát hành trước khi nâng.
- Biến môi trường: không đổi.
- 🔴 **PHẢI LÀM — Cài đặt, mục *Quay lui* ([upgrade.md](upgrade.md) mục 7):** lệnh `pg_restore --clean --if-exists` ghi ở các bản trước **không dùng được** để quay lui sau khi đã nâng nhiều bản một lúc: nó không xoá hết đối tượng của bản mới, báo lỗi giữa chừng và nạp thêm một lần nữa vào các bảng tiền, điểm (dữ liệu bị nhân đôi). Cách đúng: **khôi phục bản sao lưu vào cơ sở dữ liệu MỚI rồi đổi tên** (từng bước ở mục 7). Bản sao lưu phải lấy ngay trước migration, lúc ứng dụng đã dừng.

## v1.3.0-rc.3 — 2026-10-10

Nâng từ v1.3.0-rc.2. **Có migration mới** (mười sáu, chạy bằng tài khoản migration như mọi lần; xem mục 4 và 4e của [upgrade.md](upgrade.md)). Tên thư mục trong `db/prisma/migrations/`, theo thứ tự chạy:

- `20261008111000_4784_native_request_accept`
- `20261008111100_4784_native_commission_owner`
- `20261008111200_4784_native_request_guard_without_click`
- `20261008111300_4784_own_native_link_results_projection`
- `20261008112000_4780_native_partial_earnings`
- `20261008112100_4780_native_link_earnings_projection`
- `20261008113000_4785_native_source_corrections`
- `20261008113100_4785_native_correction_projection`
- `20261008114000_4786_native_source_finance_cases`
- `20261008120000_4912_leaderboard_exclusions`
- `20261008130000_5000_campaign_skin_schedule`
- `20261009120000_5130_link_public_code`
- `20261009150000_5152_public_display_consent`
- `20261009150100_5152_creator_consent_revoke_permission`
- `20261010120000_5114_settlement_kind`
- `20261010130000_5089_reward_entries_…_txn_idx` *(tên thư mục đầy đủ có một từ nội bộ nên rút gọn ở đây; nhận ra bằng mốc thời gian `20261010130000`; thêm một chỉ mục cho bảng khoản thưởng)*

Hai migration `20261008120000_4912_leaderboard_exclusions` và `20261008130000_5000_campaign_skin_schedule` có ghi riêng bên dưới, kèm cách quay lui. **Mười bốn migration còn lại chưa được kiểm quay lui bằng image cũ**: các migration đã chạy thì quay lui image cần xét từng migration; nếu cần, báo đội phát hành trước khi nâng.

- 🟡 Migration `20261008120000_4912_leaderboard_exclusions` thêm hai bảng (`leaderboard_exclusion_scopes`, `leaderboard_award_exclusions`). Chạy tự động lúc triển khai, không cần làm tay. Quay lui bằng image cũ vẫn được: image cũ không đọc hai bảng này, và chúng rỗng cho tới khi có người dùng tính năng loại khỏi giải.
- 🟡 Migration `20261008130000_5000_campaign_skin_schedule` thêm một cột nullable `skin_schedule` vào bảng `campaign_presentation` (lịch mùa của chiến dịch, HW26.3). Chạy tự động lúc triển khai, không cần làm tay. Quay lui bằng image cũ vẫn được: cột thừa không ảnh hưởng mã cũ.
- Biến môi trường: không đổi.

## v1.3.0-rc.2 — 2026-10-10

- 🔴 **Quay lui — v1.3 KHÔNG quay lui được bằng image cũ một khi đã có chiến dịch khai brand tài trợ theo hình bản ghi `{code, name}`** (Console có hai ô Mã và Tên). Image cũ chỉ đọc brand tài trợ dạng chuỗi và bỏ hết bản ghi, nên mọi đơn hàng bị coi là "không thuộc brand tài trợ" và người chơi **mất điểm âm thầm**, không có lỗi nào báo. Cấu trúc cơ sở dữ liệu thì vẫn tương thích, nên không có gì chặn việc quay lui: người vận hành phải tự biết. Việc cần làm: nếu đã có chiến dịch dùng hình mới thì **sửa tiến** (vá và phát hành bản sau), đừng quay lui. Chưa có chiến dịch nào dùng hình mới thì quay lui bằng image cũ vẫn được như mục 7 của [upgrade.md](upgrade.md). **Tự kiểm "đã dùng hình mới chưa":** chiến dịch nào có brand tài trợ được nhập ở hai ô **Mã** và **Tên** (hoặc đã lưu lại danh sách brand) **sau khi lên v1.3** thì coi là đã dùng hình mới; chiến dịch chưa ai sửa phần brand tài trợ từ lúc lên v1.3 thì chưa. Không chắc chiến dịch nào ở bên nào thì **hỏi Diso trước khi quay lui**. Danh sách cũ dạng chuỗi chạy bình thường ở bản mới (đọc thành `{code, name = code}`).
- Biến môi trường: không đổi.

## v1.2.0-rc.7 — 2026-10-09

Không đổi.

## v1.3.0-rc.1 — 2026-10-08

Nâng từ v1.2.0-rc.6. **Có migration mới** (mười bốn, chạy bằng tài khoản migration như mọi lần; xem mục 4 và 4e của [upgrade.md](upgrade.md)). Có ba biến môi trường TUỲ CHỌN mới hoặc đổi cách đọc (xem bên dưới).

**Migration mới (chỉ thêm, trừ một chuẩn hoá dữ liệu)**

- Thêm cột **giao diện mùa** cho chiến dịch Thưởng.
- Thêm bảng **danh mục bán chung** của Storefront và Partner Sale; giữ đúng tập lựa chọn ban đầu của từng đơn vị (danh mục rỗng cũng được ghi rõ).
- Ba migration cho công cụ **Chuẩn bị link** của Program Link: thêm cột nguồn Storefront vào bản sửa và công cụ của Link, cấp quyền chạy hàm kiểm cho các tài khoản ghi của ứng dụng đang có, và sửa một hàm kiểm để đọc đúng tên cột quan hệ khi xuất bản.
- Hai migration cho **chủ hoa hồng của đơn hàng**: thêm bảng ghi chủ hoa hồng đã chứng minh và sửa hàm kiểm cho đúng thành phần hoa hồng của đối tác.
- Một migration thêm hai bảng **danh mục nhóm người chơi** của tích hợp (chỉ thêm, không backfill dữ liệu có sẵn).
- Một migration thêm bảng **chứng cứ giao hàng** của đơn trang bán hàng (thời điểm giao thực tế, hạn trả hàng, chứng từ; chỉ thêm).
- Một migration **đổi tên chính sách cách ly theo đơn vị** của ba bảng mới (chủ hoa hồng, xung đột hoa hồng, chứng cứ giao hàng) về tên chuẩn mà bộ kiểm quyền yêu cầu; không đổi biểu thức, không đổi quyền ai thấy gì.
- Một migration thêm cột lưu tạm **nhóm người chơi đối tác gửi lúc vào game** trên vé một lần (chỉ thêm; xoá ngay sau khi nhóm được áp cho người chơi).
- Hai migration cho **giới thiệu từ Storefront**: thêm các bảng ghi ngữ cảnh giới thiệu và sự đồng ý của khách, và sửa hàm kiểm quyền nguồn Storefront để chấp nhận kiểu chạy cục bộ qua HTTP trên máy phát triển.
- Một migration **chuẩn hoá giá trị mặc định** của đúng hai hồ sơ kế toán nền, để Finance nâng từ bản cũ lên không còn tạo điều chỉnh trả `UNKNOWN`. Đây là bước duy nhất sửa dữ liệu có sẵn; nó chỉ chạm hai hồ sơ đó.

**Biến môi trường**

- 🟢 **`STOREFRONT_REFERRAL_COOKIE_SECRET` (tuỳ chọn):** khoá ký cookie giới thiệu từ Storefront, tối thiểu 32 ký tự. Không đặt biến này thì hệ thống dùng `JWT_SECRET` nếu nó đủ 32 ký tự. Đã đặt mà để rỗng (dòng `STOREFRONT_REFERRAL_COOKIE_SECRET=`) hoặc ngắn hơn 32 ký tự thì `JWT_SECRET` **không** được dùng thay, và ghi nhận giới thiệu báo không dùng được. Hoặc xoá hẳn dòng, hoặc đặt đủ 32 ký tự. Ứng dụng vẫn khởi động bình thường; chỉ riêng ghi nhận giới thiệu bị tắt.
- `STOREFRONT_LOCAL_HTTP` chỉ dành cho máy phát triển; production bỏ qua biến này, không cần đặt.
- 🟢 **Hai biến TUỲ CHỌN mới cho webview thưởng:** `REWARD_SUPPORT_URL` (đường dẫn Hỗ trợ / Liên hệ) và `REWARD_TERMS_URL` (đường dẫn Điều khoản và quyền riêng tư). Chỉ nhận `https:`, `tel:` hoặc `mailto:`; không đặt (hoặc giá trị khác) thì mục tương ứng ở màn Cài đặt của người chơi **ẩn**. Không có giá trị mặc định, không cần đặt để chạy.
- 🔴 `PLATFORM_BASE_DOMAINS` — **không thêm mới, nhưng cách đọc đã đổi.** Giá trị chỉ cần dọn (scheme `https://`, dấu chấm ở đầu hoặc cuối, `*.`, viết hoa, trùng) nay được **tự chuẩn hoá** và mỗi phần tử bị sửa hay bị loại in một dòng cảnh báo lúc khởi động. Phần tử không phải tên miền từ hai nhãn trở lên (có cổng, có đường dẫn, một nhãn) bị **loại, không đoán**.
- 🔴 **Ở production, nếu biến được đặt nhưng không còn phần tử nào dùng được thì ứng dụng KHÔNG khởi động** (trước đây lớp chặn tên miền tắt im lặng). Biến để trống hoặc không đặt vẫn hợp lệ. Kiểm trước khi nâng bằng `preflight:env` ở bước 4a của [upgrade.md](upgrade.md): mã thoát `4` đến `7` là báo biến này.
- 🟡 Hai tên miền gốc **chồng nhau** (ví dụ `example.com` và `portal.example.com`): host nay khớp tên miền gốc **dài nhất**, không còn phụ thuộc thứ tự khai; host đúng bằng một tên miền gốc thì không còn sinh ra mã đơn vị. Nếu trước đây bạn dựa vào thứ tự khai thì kiểm lại địa chỉ của các đơn vị.

**Quay lui**

- Chưa kiểm quay lui bằng image cũ cho bản này. Các migration trên đã chạy thì quay lui image cần xét từng migration; nếu cần, báo đội phát hành trước khi nâng.

**Tài liệu (không đổi hành vi của hệ thống)**

- 🔴 Mục mới **4e** của [upgrade.md](upgrade.md): kiểm **chủ sở hữu** cơ sở dữ liệu trước khi chạy migration. Cơ sở dữ liệu do tài khoản khác dựng (ví dụ khôi phục bản sao lưu bằng tài khoản quản trị) có thể lẫn chủ, khi đó migration dừng giữa chừng với `must be owner of type …` hoặc `permission denied to create extension …`. Mục 4e có đoạn SQL kiểm, đoạn SQL đổi chủ và cách chạy tiếp sau khi migration đã dừng. Ba extension `citext`, `btree_gist`, `pgcrypto` phải nằm trong schema `creator_os`.
- Câu kiểm ② của [hướng dẫn cài](reward-only-setup.md): kỳ vọng nay là **`1`** cho cả hai tài khoản (không phải `0`), vì một bảng nhận gói tin từ sàn bị thu quyền có chủ đích.

## v1.2.0-rc.6 — 2026-10-07

Không đổi.

## v1.2.0-rc.5 — 2026-10-07

Không đổi.

## v1.2.0-rc.4 — 2026-10-07

Không đổi.

## v1.2.0-rc.3 — 2026-10-07

Không đổi.

## v1.2.0-rc.2 — 2026-10-06

Nâng từ v1.2.0-rc.1. Không có biến môi trường mới, không có migration mới, không đổi `reward-only.env.example`.

**Biến môi trường**

- 🔴 `PLATFORM_BASE_DOMAINS` (tên miền gốc của nền tảng) — **không thêm mới, nhưng nay là điều kiện của một lớp chặn.** Bản này không cho đơn vị nào
  thêm làm tên miền riêng một tên bằng hoặc nằm dưới tên miền gốc, và khi gỡ một tên miền thì biến này quyết có xếp việc xoá chứng chỉ hay không.
  Cả hai chỉ đúng khi biến **được đặt và đúng khuôn**: danh sách **tên máy chủ trần**, cách nhau bằng dấu phẩy, ví dụ `portal.example.com`.
  **Không** `https://`, **không** dấu chấm ở đầu hoặc cuối, **không** `*.`, **không** `:cổng`, không khoảng trắng. Sai khuôn hoặc để trống thì lớp chặn tắt
  mà không báo gì, và việc gỡ tên miền vẫn có thể xoá chứng chỉ wildcard. Giá trị phải là CHÍNH chuỗi đang chạy trong container `api`.

**Việc phải làm tay**

- 🔴 **Sau khi bản này đã chạy**, kiểm các tên miền riêng cũ nằm dưới tên miền gốc theo [upgrade.md, mục 6b](upgrade.md) (đoạn SQL đi kèm tài liệu, chạy bằng tài khoản có
  `BYPASSRLS` **hoặc** siêu người dùng) và dọn các dòng nó báo. Trước bản này, hai cửa thêm tên miền tạo dòng đang hoạt động mà không cần chứng minh gì,
  nên có thể một đơn vị đang giữ tên miền con của đơn vị khác (`HIJACK_TENANT_ROW_ON_OTHER_TENANT_SLUG`).
- 🔴 **Chỉ dọn bằng chức năng "gỡ tên miền" SAU KHI bản này đã chạy.** Trên bản cũ, gỡ một dòng nằm dưới tên miền gốc sẽ xếp việc
  xoá chứng chỉ và có thể xoá chứng chỉ wildcard của nền tảng. Từ bản này gỡ dòng dưới tên miền gốc không còn thu hồi chứng chỉ.
- 🟡 Định bỏ một tên khỏi `PLATFORM_BASE_DOMAINS`: chạy lại mục 6b cho tên đó và dọn TRƯỚC khi bỏ.

**Quay lui**

- Được bằng image cũ (`v1.2.0-rc.1`): bản này không có migration. Quay lui là **mở lại** lỗ giành tên miền con, và sau khi quay lui **không dùng**
  "gỡ tên miền" cho dòng nằm dưới tên miền gốc (bản cũ sẽ xếp việc xoá chứng chỉ).

## v1.2.0-rc.1 — 2026-10-06

Nâng từ v1.0.6.

**Biến môi trường**

- 🔴 `INTERNAL_API_SECRET` — **mới, bắt buộc.** Thiếu thì API **từ chối khởi động**. Tự sinh: `openssl rand -hex 32`.
  Đặt cho container `api`, và thêm header `X-Internal-Secret: <cùng giá trị>` vào lệnh `--deploy-hook` của certbot
  (nếu dùng tên miền riêng). Hai nơi phải cùng giá trị.
- 🔴 `DEV_FIXED_OTP` — **cấm ngoài develop.** Còn đặt mà `APP_ENV` khác `develop` thì API từ chối khởi động.
- 🔴 Mọi portal nay chạy dưới **đường dẫn con**, nên các biến URL phải **kết thúc đúng tiền tố**:

  | Biến | Kết thúc bằng |
  |---|---|
  | `REWARD_PORTAL_URL` | `/reward` |
  | `CONSOLE_PORTAL_URL` · `APP_ORIGIN` · `OAUTH_PLATFORM_LANDING_ORIGIN` | `/console` |
  | `CREATOR_PORTAL_URL` · `CREATOR_PORTAL_ORIGIN` | `/creator` |

  Đối chiếu [reward-only.env.example](reward-only.env.example) của cùng thẻ.
- 🟡 `RUN_PARTNER_SALE` · `RUN_STOREFRONT` · `RUN_ROUTER` — **mặc định BẬT**. Bản chỉ chạy Reward có thể cần tắt
  nếu không dùng các phần đó 
- 🟡 **Cờ theo đơn vị `reconciliation-confirmation`**: **mặc định BẬT**: cổng chốt kỳ của Reward đòi một bước **ops xác nhận đối soát đúng** (có tích *đã đối chiếu với bảng kê đối tác ở ngoài hệ thống*) trước khi `Xác nhận chốt kỳ`. Không phải biến môi trường — bật hoặc tắt theo từng đơn vị. Đợt chốt kỳ đã lập trước khi nâng bản không bị đòi xác nhận.
- 🟡 **Cờ theo đơn vị `leaderboard-reward-player`**: cờ bảng xếp hạng người chơi Reward, **mặc định không có**. Bật cho đơn vị cần dùng **trong bước nâng bản**; sau đó cờ hiện ở **Hệ thống → Tính năng** của đơn vị (nhãn là chính khoá), và quản trị đơn vị tự tắt hoặc bật được. Không phải biến môi trường.
- 🟢 `RECONCILIATION_RERUN_INTERVAL_MS` — **mới**, của tác vụ nền (worker). Chu kỳ worker xem có yêu cầu *Chạy lại đối soát* nào đang chờ. Mặc định `15000` (15 giây).
- 🟢 `RECONCILIATION_RUN_LEASE_SEC` — **mới**, của tác vụ nền. Thời gian một lượt đối soát được dành riêng trước khi coi là chết. Mặc định `1800` (30 phút), tối thiểu `60`.
- 🟢 `OPSHUB_WEBHOOK_API_KEY` · `GUIDE_ORIGIN` · `QUOTA_CHANNEL_ENRICH_PER_DAY` · `QUOTA_CHANNEL_ENRICH_TENANT_PER_DAY` · `QUOTA_CHANNEL_ENRICH_OPS_PER_DAY` — **mới, không bắt buộc.** `OPSHUB_WEBHOOK_API_KEY` là khoá nhận webhook từ OpsHub (thiếu thì không có khoá vào); `GUIDE_ORIGIN` là nguồn sổ tay cho cổng bán hàng đối tác; ba biến `QUOTA_*` là hạn mức ngày, có mặc định trong mã.
- 🟡 `PROGRAM_LINK_PUBLIC_BASE_URL` — **mới.** Địa chỉ công khai của API (https), dùng để tạo link chia sẻ chương trình. Thiếu thì tạo link chia sẻ trả lỗi 503 `LINK_PUBLIC_URL_UNAVAILABLE`; API vẫn khởi động. Nên đặt nếu dùng tính năng link.
- 🟢 `AUDIENCE_GOOGLE_SA_KEY` · `EKYC_GOOGLE_SA_KEY` · `NOTIFICATION_GOOGLE_SA_KEY` · `PII_KEY_GOOGLE_SA_KEY` · `SECRETS_GOOGLE_SA_KEY` (và `*_GOOGLE_PROJECT_ID` tương ứng) — **mới, không bắt buộc.** Mỗi cụm có khoá riêng; thiếu thì dùng `GOOGLE_SERVICE_ACCOUNT_KEY` như v1.0.6. Cấu hình chỉ đặt biến cũ vẫn chạy.
- 🟢 **Nhóm `MARKETPLACE_*` và `TIKTOK_*` — chỉ cần khi bật kết nối sàn.** Mặc định tắt (`MARKETPLACE_SYNC_ENABLED`); không bật thì bỏ qua cả nhóm. Bật thì: ở production phải đặt `MARKETPLACE_HMAC_SECRET_NAME` (không có khoá dự phòng như môi trường dev); `TIKTOK_SHOP_REDIRECT_URI` mặc định trỏ `http://localhost:3001/...` nên **phải đặt** lại; `TIKTOK_APP_ID`, `TIKTOK_APP_KEY`, `TIKTOK_APP_SECRET` lấy từ ứng dụng của sàn. Các biến `TIKTOK_LIFECYCLE_WEBHOOK_FIXTURE_*` chỉ dành cho sân thử — để trống ở production.
- 🟡 `STOREFRONT_HOSTS` — rỗng nghĩa là không chặn host nào (cố ý). Môi trường thật khai danh sách tên miền, phân cách bằng dấu phẩy.

**Việc phải làm tay**

- 🔴 Image chỉ mở **một cổng** — router, `8080`. Đổi cổng publish trong compose sang `8080`; proxy phía trước chỉ còn **một** `proxy_pass`.
- 🔴 **Tài khoản chạy migration phải có thuộc tính `BYPASSRLS`** — kiểm **trước** khi nâng bản (mục 4d của upgrade.md). Thiếu thì nâng bản **dừng giữa chừng** ở migration 3540, khi cơ sở dữ liệu đã chạy dở.
- 🔴 **Kiểm trước khi nâng:** Launch nay **từ chối** tích hợp có từ **2 namespace DIRECT khác nhau** (trước đây lấy nguồn đầu tiên theo thứ tự tuỳ ý). Có tích hợp như vậy thì liên hệ hỗ trợ (mục 8 của [upgrade.md](upgrade.md)) **trước** khi nâng.
- 🔴 **Đếm đợt đối soát đang mở trùng — TRƯỚC khi chạy migration.** Bản này thêm ràng buộc *mỗi (đơn vị, chiến dịch, mệnh giá) tối đa MỘT đợt chốt kỳ đang mở (`PENDING`)*. Migration **không tự huỷ đợt nào**: nếu cơ sở dữ liệu đang có từ hai đợt `PENDING` trở lên cho cùng một bộ ba, migration dừng. Việc huỷ hay xác nhận đợt thừa là quyết định nghiệp vụ của vận hành, làm **trước** khi nâng. Đếm bằng tài khoản **có quyền bỏ qua phân quyền theo đơn vị** (như tài khoản chạy migration; xem [upgrade.md](upgrade.md)), chỉ đọc. Tài khoản thường sẽ ra kết quả **0 sai**:

  ```sql
  SELECT tenant_id, campaign_id, denomination_code, count(*) AS pending_batches
    FROM creator_os.point_settlement_batches
   WHERE status = 'PENDING'
   GROUP BY 1, 2, 3 HAVING count(*) > 1;
  ```

  Có dòng nào thì vận hành chọn đợt giữ, huỷ phần còn lại bằng màn Chốt kỳ, rồi mới nâng.
- 🟡 **Quyền mới `point_settlement:confirm_reconciliation`**: migration cấp cho **mọi vai đang giữ quyền xác nhận chốt kỳ lúc nâng bản**, kể cả vai tuỳ biến. Vai tạo **sau** nâng bản, hoặc được cấp quyền chốt kỳ sau đó, **không tự có** và phải cấp thêm; ai có quyền chốt kỳ mà thiếu quyền này sẽ kẹt ở bước chốt. Có thêm migration (bảng lưu xác nhận, cột đánh dấu đợt) chạy trong bước migration thường lệ.
- 🟢 **File đối soát Excel hai sheet**: tổng hợp theo loại sự kiện và chi tiết từng dòng; tải cần quyền xem chốt kỳ (`point_settlement:read`) **cộng** hai quyền xuất file (`export:create`, `export:read`). Không cần cấu hình thêm.
- 🟡 **Giờ quét đối soát tự động cố định**: mỗi ngày **một lượt** vào giờ Việt Nam cố định thay cho "24 giờ kể từ lúc worker khởi động". Biến mới của worker: `REWARD_DRIFT_SWEEP_HOUR_VN` (giờ trong ngày, mặc định `2`) và `REWARD_DRIFT_CHECK_INTERVAL_MS` (nhịp kiểm, mặc định 5 phút). **`REWARD_DRIFT_SWEEP_INTERVAL_MS` không còn được đọc** — gỡ khỏi cấu hình nếu có.
- 🔴 **`PARTNER_SANDBOX_ENABLED=true` chỉ dùng ở sân thử.** Cửa "gửi thử một thông báo tất toán mẫu" chỉ bật được khi `APP_ENV` là `develop` hoặc `staging`; bản release và bản đối tác **cấm** — container từ chối khởi động nếu đặt. Production **không** đặt biến này.
- 🟡 **Chạy đúng MỘT worker** (`RUN_WORKER=true` ở đúng một container, như `upgrade.md` mục 5): hai worker cùng tick thì một chiến dịch có thể nhận hai báo cáo đối soát tự động — báo cáo trùng, số liệu không sai.
- 🟡 **Ba migration mới** (nút *Chạy lại đối soát*): bảng yêu cầu chạy lại, cột giờ bắt đầu của báo cáo lệch, quyền mới gán vào vai. Chạy trong bước migration thường lệ ở mục 4 của [upgrade.md](upgrade.md); không cần làm tay thêm.
- 🔴 **API và worker phải dùng chung nguồn giờ NTP**: lượt đối soát so giờ giữa hai tiến trình, lệch giờ thì lượt chạy bị coi là cũ hoặc đã chết.
- 🟡 Chỉ khi bật **tên miền riêng + chứng chỉ tự động**: các mount `CERT_ANSIBLE_*` trên máy chạy compose.

**Quay lui** — 🔴 **không quay lui được bằng image cũ** — chỉ khôi phục bản sao lưu. Xem mục 7 của [upgrade.md](upgrade.md).

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
