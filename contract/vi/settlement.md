# Settlement — Chúng tôi báo bạn khi có khoản tất toán ĐIỂM

Bắt đầu từ: [README.md](./README.md). *(bản dịch của
[en/settlement.md](../en/settlement.md) — bản tiếng Anh là nguồn chốt, lệch thì bản tiếng Anh thắng)*

**Settlement là TUỲ CHỌN**, giống [recovery.md](./recovery.md) — bạn vẫn tích hợp đầy đủ mà không cần
nó. Tài liệu này dành cho đối tác nhận thông báo chủ động khi chúng tôi đã chốt một khoản điểm cần
đối tác tự xử lý (ví dụ: quy đổi, ghi sổ nội bộ phía bạn).

> **Phạm vi hôm nay: CHỈ ĐIỂM.** Chưa có hợp đồng tương đương cho tiền.

🔴 **Nếu tham gia, bạn nợ chúng tôi hai việc:** trả lời đúng khi chúng tôi gọi sang (§2.2 và §4), và gửi
sự kiện `POINT_REDEEMED` cho **mọi dòng bạn đã trả** (§5). Thiếu việc thứ hai thì dòng không bao giờ
khép lại ở phía chúng tôi.

## 1. Năng lực này làm gì

Khác [recovery.md](./recovery.md) (chiều đó CHỈ ĐỌC, bạn gọi chúng tôi), đây là chiều **GHI**: ops của
chúng tôi bấm nút trên màn vận hành, chúng tôi **chủ động gọi sang bạn**, báo một khoản điểm của một
người dùng đã **chốt kỳ xong** (điểm đã rời ví tạm, sang trạng thái sẵn sàng bàn giao) và cần bạn xử lý
phía bạn.

🔴 **Đây KHÔNG phải một lệnh chuyển tiền/điểm.** Nó là một THÔNG BÁO — "khoản này đã chốt, xin xử lý
phía bạn". Bạn tự quyết định làm gì với thông báo đó (cộng ví nội bộ, quy đổi, ghi nhận nợ…).

## 2. Chúng tôi gọi bạn — `POST <địa chỉ nhận điểm của bạn>`

### 2.0 Khai địa chỉ

1. **Bạn** đưa cho ops của chúng tôi một URL (địa chỉ nhận `POST` của chúng tôi).
2. **Ops của chúng tôi** nhập nó trên màn tích hợp của bạn, ở tab **Nhận điểm**. Khi chưa nhập, nút
   **Gửi** của ops bị khoá và ghi rõ vì sao — không có cách nào ép gọi.
3. Địa chỉ phải là `https://` trên Internet công khai. Chúng tôi từ chối địa chỉ trỏ vào `localhost`,
   mạng riêng hay địa chỉ link-local, và địa chỉ có `user:mật-khẩu` trong đó (bí mật không nằm trong
   địa chỉ).
4. **Giữ nguyên địa chỉ như bạn đưa**, từng ký tự: đường dẫn và query nằm trong chuỗi ký (§3).

Màn chỉ hiện **Sẵn sàng gửi điểm** khi đủ cả bốn điều kiện:

| Điều kiện | Vì sao |
|---|---|
| đơn vị có **đúng một** tích hợp | chúng tôi không đoán gọi tích hợp nào |
| đã khai địa chỉ | không có gì để gọi nếu thiếu |
| có **khoá SETTLEMENT dùng được** | lượt gọi được ký bằng nó (§3) |
| tích hợp có **đúng một** nhà cấp danh tính ở các nguồn sự kiện `DIRECT` | chúng tôi phải biết `externalUserId` thuộc không gian định danh nào của bạn |

Điều kiện nào thiếu sẽ hiện kèm lý do ngay cạnh nút **Gửi**.

### 2.1 Thân request

```jsonc
{
  "settlementRef":        "…",     // mã đợt (campaign · kỳ · mệnh giá)
  "settlementItemId":     "…",     // mã dòng — gửi lại NGUYÊN VĂN trong sự kiện POINT_REDEEMED của bạn (§5)
  "partyId":              "…",     // người nhận, mã NỘI BỘ của chúng tôi
  "externalUserId":       "…",     // người nhận, mã CỦA BẠN cho người dùng này — chính giá trị bạn đã gửi lúc launch / ở sự kiện
  "denominationCode":     "…",     // mệnh giá điểm
  "pointAmount":          "100",   // điểm — ĐÃ ĐÓNG BĂNG lúc lập đợt, không đổi sau
  "exchangeRateSnapshot": "10",    // tỷ giá của CHÍNH mệnh giá điểm này, đóng dấu lúc lập đợt (chỉ để tham khảo)
  "moneyAmount":          "1000",  // tiền quy đổi theo tỷ giá trên (chỉ để tham khảo)
  "moneyCurrency":        "VND",
  "deliveryNonce":        "…"      // MỚI mỗi lượt GỌI THẬT — xem §4
}
```

- **`externalUserId` là trường để bạn cộng điểm theo.** Đó là mã **bạn** đã đưa chúng tôi cho người dùng
  này. Chúng tôi không bao giờ gửi gói thiếu nó: khi không đọc được chính xác cho một dòng (không có,
  hoặc có nhiều hơn một), thao tác **Gửi** bị từ chối ở phía chúng tôi và không có gì tới chỗ bạn.
- `partyId` là mã nội bộ của chúng tôi — giữ cho nhật ký; đừng tra người dùng theo nó.
- **Thứ bạn nhận là điểm.** `exchangeRateSnapshot` / `moneyAmount` / `moneyCurrency` chỉ **để tham khảo**;
  chúng tôi không quy đổi hộ bạn và bạn không phải trả bằng tiền. Bạn làm gì với điểm là việc của bạn.
- ⚠️ `pointAmount`, `exchangeRateSnapshot` và `moneyAmount` là số đã CHỐT, **không phải số để bạn tính
  lại**. Đây là lời khai của chúng tôi, không phải đề nghị thương lượng.
- `exchangeRateSnapshot` là tỷ giá của **chính mệnh giá điểm này** tại lúc đợt được lập (tối đa sáu chữ số lẻ). `moneyAmount` là tỷ giá đó nhân
  `pointAmount`, làm tròn **half-up hai chữ số lẻ theo từng dòng**. Cần tổng thì cộng `moneyAmount` của các dòng trong đợt; đó **không** phải tỷ giá nhân tổng điểm,
  hai số có thể lệch vài xu (ví dụ ở tỷ giá 3,333333). Đổi tỷ giá sau khi đợt đã lập
  không động tới đợt đã có.
- 🔒 **Mọi trường, kể cả `externalUserId`, nằm TRONG thân được ký.** Kiểm chữ ký trên **byte thô** bạn nhận
  được (§3) — đừng dựng lại thân rồi mới kiểm.
- Bỏ qua trường bạn không nhận ra: chúng tôi có thể thêm trường mà không đổi phiên bản hợp đồng.

### 2.2 Bạn trả lời gì

| Bạn trả lời | Chúng tôi hiểu thế nào |
|---|---|
| `2xx` | **đã nhận** — dòng được đánh dấu là đã gửi |
| `409` | **từ chối** — bạn báo đã thấy `deliveryNonce` này rồi (§4). **Chỉ dùng `409` cho đúng việc này** |
| `422` | **từ chối** — bạn không nhận gói vì lý do nghiệp vụ |
| mã khác — `400` · `401` · `403` · `404` · `5xx` | **gửi hỏng** — ops của chúng tôi có thể gửi lại |
| không trả lời trong **10 giây** | **gửi hỏng** — ops của chúng tôi có thể gửi lại |
| chuyển hướng `3xx` | **gửi hỏng** — chúng tôi không bao giờ đi theo chuyển hướng |

- `401`/`403` (kiểm khoá phía bạn thất bại) là một lượt gửi hỏng bình thường ở phía chúng tôi — ops có thể
  gửi lại, nhưng **gửi lại không giúp được gì cho tới khi khoá được sửa.**
- ⚠️ **Đừng trả `409` cho bất cứ việc gì ngoài `deliveryNonce` lặp.** Thao tác **Hỏi lại đối tác** của chúng
  tôi gửi lại *cùng* gói với *cùng* nonce và đọc `409` là "đối tác đã có rồi" (§4). Một `409` vì lý do
  khác sẽ khiến chúng tôi đánh dấu là đã nhận một dòng mà bạn chưa hề xử lý.
- `2xx` nghĩa là "bạn đã nhận" — không phải "bạn đã xử lý xong". Cứ từ từ sau khi trả lời.
- **Khép dòng là việc của bạn:** một dòng chỉ khép khi bạn gửi `POINT_REDEEMED` cho chúng tôi (§5) — hoặc khi
  ops của chúng tôi ghi nhận thanh toán bằng tay.

## 3. Chúng tôi tự xác thực với bạn — `PartnerSettlementSignatureV1`

🔒 **Khuôn ký RIÊNG, khác `PartnerRecoverySignatureV1`** ([recovery.md §4](./recovery.md#4-chúng-tôi-tự-xác-thực-với-bạn--partnerrecoverysignaturev1))
dù dùng chung cơ chế HMAC-SHA256 bên dưới — vì đây là **GHI**, không phải đọc vô hại. Bí mật kênh
RECOVERY và kênh SETTLEMENT **tách riêng** — đừng dùng chung, một chỗ rò sẽ hỏng cả hai chiều.

```text
signing_string = <X-Platform-Timestamp>  +  "."
               + <METHOD, viết HOA — luôn "POST">  +  "."
               + <đường dẫn + query, ĐÚNG NHƯ trên dòng request>  +  "."
               + <byte thân request thô>

signature      = "sha256=" + hex_viết_thường( HMAC-SHA256( SETTLEMENT_SECRET, signing_string ) )
```

| Header | Chở gì |
|---|---|
| `X-Platform-Key-Id` | mã khoá. Nó **giống nhau ở mọi phiên bản** của khoá nên **không** cho biết secret nào đã ký: hãy thử lần lượt các secret bạn đang giữ, mới trước (xem *Xoay khoá* bên dưới) |
| `X-Platform-Timestamp` | Unix giây |
| `X-Platform-Signature` | `sha256=<hex viết thường>` |

**Độ tươi ±5 phút**, cùng con số với các khuôn ký khác trong bộ tài liệu này.

**Xoay khoá.** Khoá SETTLEMENT là khoá dẫn xuất ([credential-derivation.md](./credential-derivation.md)). `X-Platform-Key-Id` **không đổi**
khi chúng tôi xoay, và ngay khi một lượt xoay xong thì **chúng tôi ký bằng khoá mới**. Vì vậy: hẹn ngày với ops của chúng tôi;
dẫn xuất và nạp phiên bản mới **trước** khi lượt xoay hoàn tất, và dù sao cũng trước khi ops của chúng tôi bấm **Gửi** lần kế (luôn là phiên bản hiện tại cộng một); chấp nhận **cả hai**
secret và thử mới trước; chỉ bỏ cái cũ sau khi chúng tôi báo nó đã bị thu hồi. Nếu khoá mới chưa kịp nạp, lượt gửi của chúng tôi
trả `401` trong một lúc ngắn: hãy nạp khoá mới rồi nhờ ops của chúng tôi gửi lại — đó là một lượt gửi hỏng, không mất khoản tất toán nào.
Bộ nhận tham chiếu nhận nhiều secret cho một mã khoá (`SETTLEMENT_SECRETS=<mới>,<cũ>`, xem [testing.md §1.6](./testing.md#16-kênh-settlement--8-ca-chạy-riêng)).

Có một ví dụ có số cố định (secret, timestamp, thân) ở [testing.md §2.6](./testing.md#26-kênh-settlement--partnersettlementsignaturev1).

**Mã verify tham khảo (Node.js)** — giống hệt [recovery.md §4](./recovery.md#4-chúng-tôi-tự-xác-thực-với-bạn--partnerrecoverysignaturev1),
chỉ đổi secret tra theo kênh SETTLEMENT:

```js
function verifySettlementSignature(req, settlementSecrets) {
  // settlementSecrets: mọi secret bạn đang giữ cho kênh này, mới trước. `X-Platform-Key-Id` giống nhau ở mọi phiên bản nên không chọn được secret
  const ts    = Number(req.header('X-Platform-Timestamp'));
  const given = req.header('X-Platform-Signature') || '';

  // 1. độ tươi ±5 phút, chặn cả hai chiều
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts * 1000) > 5 * 60_000) return false;

  // 2. req.originalUrl = đường dẫn + query ĐÚNG NHƯ nhận được. req.rawBody = byte thô, trước khi parse JSON
  const base = Buffer.concat([
    Buffer.from(`${ts}.${req.method.toUpperCase()}.${req.originalUrl}.`, 'utf8'),
    req.rawBody ?? Buffer.alloc(0),
  ]);

  // 3. Thử lần lượt từng secret; so sánh thời gian hằng — KHÔNG dùng ===
  const b = Buffer.from(given);
  return settlementSecrets.some((secret) => {
    const a = Buffer.from('sha256=' + crypto.createHmac('sha256', secret).update(base).digest('hex'));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
```

Một bộ nhận tham chiếu chạy được và sửa được là `examples/node/settlement-receiver.mjs` trong kho công
khai; [testing.md §1.6](./testing.md#16-kênh-settlement--8-ca-chạy-riêng) liệt kê tám ca kiểm nó.

## 4. Chống phát lại — HAI nghĩa vụ, không phải một

🔴 **Chữ ký + cửa sổ tươi KHÔNG ĐỦ cho một thao tác GHI.** Khác RECOVERY (chỉ đọc — phát lại trong 5
phút vô hại), đây là thao tác có tác dụng phụ thật (bạn có thể cộng ví/ghi sổ). `deliveryNonce` trong
thân request (§2.1) là cơ chế bù cho khoảng trống đó, và nó đòi **cả hai phía**:

- **Nghĩa vụ CỦA BẠN**: **PHẢI** từ chối một `deliveryNonce` đã thấy trước đó cho cùng khoá — không chỉ
  dựa vào cửa sổ ±5 phút — **và PHẢI trả `409`**. Giữ một sổ các nonce đã thấy (một nhật ký bạn tra trước
  khi xử lý).
- **Nghĩa vụ CỦA CHÚNG TÔI**: một nonce không bao giờ được dùng lại cho một lượt gửi *mới*. Chúng tôi gửi
  theo **hai cách**, và chúng khác nhau có chủ ý:

| Ops của chúng tôi bấm | Nonce | Để làm gì |
|---|---|---|
| **Gửi** (lần đầu) hoặc **Gửi lại** (sau một lượt gửi hỏng) | nonce **MỚI** | một thông báo mới. Cùng `settlementItemId` có thể xuất hiện trong nhiều request, mỗi cái một nonce |
| **Hỏi lại đối tác** (trên dòng còn đang dở, ví dụ hệ thống chúng tôi dừng trước khi nghe được câu trả lời của bạn) | **CÙNG** nonce với lượt gọi gốc, cùng gói | để biết bạn đã có chưa. Nếu bạn **chưa từng thấy**, bạn xử lý ngay và trả `2xx`. Nếu bạn **đã có**, bạn trả `409` và chúng tôi khép dòng là đã gửi |

Vì vậy `409` là **bắt buộc** (không phải "khuyến nghị") và phải nghĩa đúng là "tôi đã thấy `deliveryNonce`
này rồi": đó là cách duy nhất để "Hỏi lại đối tác" phân biệt *đã nhận* với *bị từ chối*.

⚠️ **Đừng nhầm `deliveryNonce` với `settlementItemId`.** Khoá chống trùng của bạn đặt trên `deliveryNonce`.
Chống trùng theo `settlementItemId` sẽ từ chối nhầm một lượt **Gửi lại** hợp lệ.

🔒 **Lớp tự chặn của chúng tôi.** Một khi một dòng tất toán đã CHỐT ở phía chúng tôi — bạn đã xác nhận
khớp, bạn báo lệch mà chúng tôi chưa xử lý xong, hoặc ops của chúng tôi đã ghi nhận đã trả qua kênh
khác — hệ thống từ chối gửi lại dòng đó: thao tác **Gửi** hỏng ở phía chúng tôi TRƯỚC khi có bất kỳ lượt
gọi mạng nào chạm tới bạn. Bạn sẽ không nhận hai thông báo độc lập cho cùng một sự kiện kinh tế qua kênh
này, trừ khi ops chủ động mở lại dòng đó trước.

⚙️ Cùng cam kết vận hành phía chúng tôi như RECOVERY: **không đi theo chuyển hướng `3xx`**, endpoint
của bạn phải là **`https://`** trên Internet công khai (không loopback/mạng riêng), hạn **10 giây** mỗi
lượt gọi.

## 5. Sau khi bạn trả — báo lại bằng `POINT_REDEEMED`

Với **mọi dòng bạn đã trả**, hãy gửi cho chúng tôi một sự kiện `POINT_REDEEMED` qua cửa sự kiện thường, như
mô tả ở mục `POINT_REDEEMED` trong [event-ingestion.md §5.3](./event-ingestion.md#53-payload--theo-từng-loại).
Gửi khi bạn đã thực sự trả; đó là thứ khép dòng ở phía chúng tôi.

- Chúng tôi khớp sự kiện với dòng bằng **`settlementItemId`** — chép **nguyên văn** từ gói. Chúng tôi
  **không** khớp theo `externalUserId`.
- Gửi `externalUserId` ở phong bì như bình thường: đó chính là giá trị bạn nhận trong gói.
- 🔴 **Nếu bạn không bao giờ gửi**, không có gì hỏng, nhưng dòng vẫn mở: sau **7 ngày** (mặc định) nó vào
  danh sách **quá hạn** của ops chúng tôi, và ops sẽ nhắc bạn hoặc ghi nhận thanh toán bằng tay.
- Dùng `POINT_REDEEMED` đòi tích hợp của bạn được phép gửi loại sự kiện đó trên nguồn đơn hàng — nhờ ops
  của chúng tôi bật khi bạn khai địa chỉ nhận điểm.

## 6. Vận hành

| | |
|---|---|
| Ai kích hoạt | **ops của chúng tôi**, bấm nút trên màn — KHÔNG có job nền tự động gửi |
| Gửi hàng loạt | **tuần tự**, không song song (**Gửi tất cả**) |
| Gửi lại sau lỗi | ops bấm **Gửi lại** — nonce mới, cùng `settlementItemId` |
| Dòng còn đang dở | ops bấm **Hỏi lại đối tác** — cùng gói, cùng nonce (§4) |
| Trạng thái gửi | đọc được qua màn vận hành của chúng tôi, **tách biệt** với việc bạn đã trả lời gì về khoản đó qua kênh khác |

> Thao tác **Xếp lại** trên màn của chúng tôi là chuyện khác: nó xếp lại hàng đợi một gói *bạn gửi cho
> chúng tôi* mà bị kẹt khi chúng tôi xử lý. Nó không bao giờ gửi lại gì sang bạn.

### Bảng kê (`.xlsx`)

Ops của chúng tôi cũng tải được bảng kê của đợt dưới dạng bảng tính để giao cho bạn. Các cột, **theo thứ
tự này**:

| # | Tiêu đề cột | Nghĩa |
|---|---|---|
| 1 | Mã đợt | mã đợt — `settlementRef` |
| 2 | Mã dòng | mã dòng — `settlementItemId`; **chép vào sự kiện `POINT_REDEEMED` của bạn** |
| 3 | Mã người chơi | mã nội bộ của chúng tôi — `partyId` |
| 4 | Mã người chơi (đối tác) | mã **của bạn** cho người dùng — `externalUserId`; **để trống** khi chúng tôi không đọc được chính xác (trạng thái dòng nói vì sao) |
| 5 | Mệnh giá điểm | mệnh giá điểm |
| 6 | Số điểm | số điểm |
| 7 | Tỷ giá đã đóng dấu | tỷ giá đã đóng dấu (chỉ để tham khảo) |
| 8 | Thành tiền | tiền quy đổi (chỉ để tham khảo) |
| 9 | Đơn vị tiền | đơn vị tiền |
| 10 | Trạng thái dòng | trạng thái dòng |
| 11 | Lý do loại | lý do, với dòng bị loại khỏi kỳ này |

Đọc cột **theo tiêu đề**, đừng theo vị trí: cột 4 là cột mới và mọi cột sau nó dịch sang phải một ô
(xem [changelog.md](./changelog.md)).

## 7. Checklist

```text
[ ] Đưa ops của chúng tôi một địa chỉ https:// nhận thông báo (§2.0)
[ ] Nhờ ops của chúng tôi bật loại sự kiện POINT_REDEEMED cho tích hợp của bạn (§5)
[ ] Dẫn xuất khoá kênh SETTLEMENT từ masterSecret (xem credential-derivation.md) — RIÊNG khoá RECOVERY
[ ] Dựng verify chữ ký PartnerSettlementSignatureV1 trên thân THÔ (§3)
[ ] Cộng điểm theo externalUserId, không theo partyId (§2.1)
[ ] Lưu sổ deliveryNonce đã thấy và trả 409 khi trùng — 409 cho không việc gì khác (§4)
[ ] Trả 2xx khi đã nhận — không cần xử lý xong mới trả 2xx
[ ] Gửi POINT_REDEEMED cho mọi dòng bạn đã trả, chép settlementItemId nguyên văn (§5)
[ ] Chạy các ca conformance settlement với endpoint của bạn (testing.md §1.6)
```
