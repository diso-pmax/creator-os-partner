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
