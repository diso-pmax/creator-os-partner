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
