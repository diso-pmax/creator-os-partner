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

Khác [recovery.md](./recovery.md) (chiều đó CHỈ ĐỌC, bạn gọi chúng tôi), đây là chiều **GHI**: sau khi đơn vị
đã xác nhận đối soát và chốt kỳ điểm (điểm chuyển **một lần**, ở bước đó, sang trạng thái chờ chi trả), ops
của chúng tôi tạo một đợt chi trả rồi bấm **Chi trả**. Khi đó chúng tôi **chủ động gọi sang bạn**, mỗi dòng
một thông báo, báo một khoản điểm của một người dùng đã sẵn sàng bàn giao và cần bạn xử lý phía bạn.
**Chi trả chỉ gửi**: không chuyển điểm lần thứ hai.

🔴 **Đây KHÔNG phải một lệnh chuyển tiền/điểm.** Nó là một THÔNG BÁO — "khoản này đã chốt, xin xử lý
phía bạn". Bạn tự quyết định làm gì với thông báo đó (cộng ví nội bộ, quy đổi, ghi nhận nợ…).

## 2. Chúng tôi gọi bạn — `POST <địa chỉ nhận điểm của bạn>`

### 2.0 Khai địa chỉ

1. **Bạn** đưa cho ops của chúng tôi một URL (địa chỉ nhận `POST` của chúng tôi).
2. **Ops của chúng tôi** nhập nó trên màn tích hợp của bạn, ở tab **Nhận điểm**. Khi chưa nhập, nút
   **Chi trả** của ops bị khoá và ghi rõ vì sao — không có cách nào ép gọi.
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

Điều kiện nào thiếu sẽ hiện kèm lý do ngay cạnh nút **Chi trả**.

### 2.1 Thân request

```jsonc
{
  "settlementRef":        "…",     // mã đợt — MỐC CUỐI KỲ đã chốt, dạng ISO 8601 UTC (ví dụ "2026-09-30T16:59:59.999Z"); KHÔNG phải mã ghi rõ chiến dịch hay mệnh giá
  "campaignId":           "…",     // chiến dịch mà đợt này tất toán — xem bên dưới
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
  hoặc có nhiều hơn một), thao tác **Chi trả** từ chối dòng đó ở phía chúng tôi và không có gì tới chỗ bạn.
- **`campaignId` cho bạn biết khoản tiền thuộc chiến dịch nào.** Một đợt chỉ tất toán đúng một chiến dịch,
  nên mọi dòng của một đợt mang cùng `campaignId`: mã của chiến dịch đó phía chúng tôi (cùng mã bạn dùng
  trong đường dẫn launch, `POST /campaigns/:campaignId/launch`). Chúng tôi gửi nó ở mọi gói. Trong schema
  công bố nó không nằm trong `required`, và schema là schema MỞ (`additionalProperties: true`), đúng như
  gạch đầu dòng cuối của danh sách này: bỏ qua trường bạn không nhận ra. Trước bản phát hành thêm
  `campaignId`, schema công bố là schema ĐÓNG, nên bộ kiểm dựng từ một BẢN SAO schema cũ đó sẽ từ chối
  gói của chúng tôi: hãy cập nhật bản sao `SettlementPacket.json` (hoặc bỏ qua trường lạ) trước khi bản
  phát hành này tới bạn. Hai chiến dịch tất toán cùng một kỳ có cùng `settlementRef` nhưng khác `campaignId`:
  **đừng bao giờ lấy riêng `settlementRef` làm khoá**.
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
| không trả lời trong **10 giây** | **gửi hỏng, chưa biết câu trả lời** — chúng tôi không gửi thông báo mới cho dòng này; ops của chúng tôi hỏi lại với cùng `deliveryNonce` (§4) |
| chuyển hướng `3xx` | **gửi hỏng** — chúng tôi không bao giờ đi theo chuyển hướng |

- `401`/`403` (kiểm khoá phía bạn thất bại) là một lượt gửi hỏng bình thường ở phía chúng tôi — ops có thể
  gửi lại, nhưng **gửi lại không giúp được gì cho tới khi khoá được sửa.**
- ⚠️ **Đừng trả `409` cho bất cứ việc gì ngoài `deliveryNonce` lặp.** Thao tác **Hỏi lại đối tác** của chúng
  tôi gửi lại *cùng* gói với *cùng* nonce và đọc `409` là "đối tác đã có rồi" (§4). Một `409` vì lý do
  khác sẽ khiến chúng tôi đánh dấu là đã nhận một dòng mà bạn chưa hề xử lý.
- `2xx` nghĩa là "bạn đã nhận" — không phải "bạn đã xử lý xong". Cứ từ từ sau khi trả lời.
- **Khép dòng là việc của bạn:** một dòng khép khi bạn báo đã trả — bằng `POINT_REDEEMED` (§5), hoặc, nếu bạn đã biết kết quả lúc trả lời, ngay trong câu trả lời (§2.2a). Đó là cùng một cổng: chỉ ghi một lần theo `redemptionRef`.
- Một dòng cũng có thể được **đóng mà không có báo cáo của bạn**: khi đơn vị đã ghi nhận khoản đó được chi trả bằng một kênh khác, chúng tôi đóng dòng và không gửi lại gói cho dòng đó nữa. Một dòng chỉ được trả một lần, nên báo cáo đến sau cho dòng đã đóng không làm trừ điểm lần hai.
- Kết quả cũng có thể về ngay trong câu trả lời: xem §2.2a. `200` trơn **không** phải kết quả.

### 2.2a Kết quả ngay trong câu trả lời (tuỳ chọn) — `settlement-result.v1`

Nếu bạn đã biết kết quả lúc trả lời, bạn có thể nói **ngay trong câu trả lời**, để dòng khép mà không cần lần
gọi thứ hai. Nó chỉ được tính khi câu trả lời **đúng khuôn này**. Riêng mã `200` thì không: `200` trơn, thân
rỗng, thân khác khuôn hoặc thân quá 4 KB chỉ là **"đã nhận"** (§2.2), và kết quả vẫn về bằng
`POINT_REDEEMED` (§5), đúng như trước.

```jsonc
// HTTP 200, Content-Type: application/json, thân ≤ 4 KB
{
  "schemaVersion":    "settlement-result.v1",
  "result":           "PAID",                       // v1 chỉ có giá trị này
  "deliveryNonce":    "…",                          // CHÉP NGUYÊN VĂN từ gói bạn vừa nhận
  "settlementItemId": "…",                          // CHÉP NGUYÊN VĂN từ gói
  "redemptionRef":    "PAYOUT-88213",               // mã lượt trả CỦA BẠN, 1–128 ký tự, duy nhất
  "amountMinor":      1000,                         // số nguyên, số bạn đã trả theo đơn vị nhỏ nhất (VND × 1)
  "currency":         "VND",                        // 3 chữ cái, tiền tệ của gói
  "paidAt":           "2026-11-05T07:30:12.000Z"    // ISO 8601 UTC, lúc bạn trả; không muộn hơn 5 phút so với lúc chúng tôi nhận
}
```

**Chỉ chính thức khi ĐỦ TẤT CẢ** (thiếu một điều thì chỉ là "đã nhận"):

1. mã trả lời đúng `200`, kiểu nội dung `application/json`, thân tối đa **4 KB** và là JSON hợp lệ;
2. đủ bảy trường, đúng kiểu (`amountMinor` số nguyên, `paidAt` là giờ UTC ISO 8601 kết thúc bằng `Z`, `redemptionRef` 1–128 ký tự). Trường chúng tôi không biết thì bỏ qua;
3. `schemaVersion` là `settlement-result.v1` và `result` là `PAID`;
4. `deliveryNonce` và `settlementItemId` là **của đúng gói chúng tôi vừa gửi** (buộc câu trả lời vào lượt gửi này; câu trả lời cũ không dùng lại được cho dòng khác).

**Rồi chúng tôi so số**, bằng đúng phép kiểm áp cho `POINT_REDEEMED`:

| Bạn trả lời | Chúng tôi làm gì |
|---|---|
| đúng khuôn, `amountMinor` và `currency` **bằng** số đã đóng dấu của dòng, dòng còn nhận được | dòng **khớp** ngay và điểm được đánh dấu đã trả, **một lần**, theo `redemptionRef` |
| đúng khuôn, nhưng số tiền hoặc tiền tệ **lệch** | dòng hiện **"đối tác báo lệch"**. Không ghi gì; ops của chúng tôi và bạn đối chiếu |
| đúng khuôn, nhưng dòng không còn nhận kết quả (đã xác nhận bằng mã khác, đã bị loại, đợt chưa xác nhận) | dòng không đổi; chỉ là "đã nhận" |
| mọi trường hợp khác (xem trên) | chỉ **"đã nhận"**; chờ `POINT_REDEEMED` |

- **Một lượt trả, một bản ghi.** Nếu bạn trả lời có kết quả **và** sau đó gửi `POINT_REDEEMED` với **cùng**
  `redemptionRef`, nó chỉ được ghi một lần; lần sau nhận câu "đã ghi rồi". `redemptionRef` **khác** cho cùng
  một dòng thì bị từ chối: một dòng chỉ được trả một lần.
- **Hỏi lại.** Thao tác *Hỏi lại đối tác* gửi lại cùng gói với cùng `deliveryNonce`. Nếu bạn đã thấy nó,
  trả `409` (§4); **thân của `409` bị bỏ qua**, kết quả về bằng `POINT_REDEEMED`.
- **Câu trả lời không có chữ ký riêng.** Chúng tôi bảo vệ bằng cách chỉ gọi tới địa chỉ `https://` bạn đã
  khai, không bao giờ đi theo chuyển hướng, và buộc câu trả lời vào gói qua `deliveryNonce` và
  `settlementItemId`. Chúng tôi giữ mã băm SHA-256 của thân và `redemptionRef` của bạn trong nhật ký kiểm
  toán, không giữ chính thân.
- ⚠️ `2xx` vẫn chỉ nghĩa là "đã nhận". Chỉ khuôn trên mới nghĩa là "đã trả". Đừng ghi `result: "PAID"` trong
  câu trả lời cho một dòng bạn chưa trả.

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
dẫn xuất và nạp phiên bản mới **trước** khi lượt xoay hoàn tất, và dù sao cũng trước khi ops của chúng tôi bấm **Chi trả** hoặc **Gửi lại** lần kế (luôn là phiên bản hiện tại cộng một); chấp nhận **cả hai**
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
| **Chi trả** (lần đầu) hoặc **Gửi lại** (sau một lượt gửi hỏng có câu trả lời HTTP, không phải sau khi quá 10 giây) | nonce **MỚI** | một thông báo mới. Cùng `settlementItemId` có thể xuất hiện trong nhiều request, mỗi cái một nonce |
| **Hỏi lại đối tác** (trên dòng còn đang dở, ví dụ hệ thống chúng tôi dừng trước khi nghe được câu trả lời của bạn) | **CÙNG** nonce với lượt gọi gốc, cùng gói | để biết bạn đã có chưa. Nếu bạn **chưa từng thấy**, bạn xử lý ngay và trả `2xx`. Nếu bạn **đã có**, bạn trả `409` và chúng tôi khép dòng là đã gửi |

Vì vậy `409` là **bắt buộc** (không phải "khuyến nghị") và phải nghĩa đúng là "tôi đã thấy `deliveryNonce`
này rồi": đó là cách duy nhất để "Hỏi lại đối tác" phân biệt *đã nhận* với *bị từ chối*.

⚠️ **Đừng nhầm `deliveryNonce` với `settlementItemId`.** Khoá chống trùng của bạn đặt trên `deliveryNonce`.
Chống trùng theo `settlementItemId` sẽ từ chối nhầm một lượt **Gửi lại** hợp lệ.

🔒 **Lớp tự chặn của chúng tôi.** Một khi một dòng tất toán đã CHỐT ở phía chúng tôi — bạn đã xác nhận
khớp, hoặc bạn báo lệch mà chúng tôi chưa xử lý xong — hệ thống từ chối gửi lại dòng đó: việc gửi hỏng ở phía chúng tôi TRƯỚC khi có bất kỳ lượt
gọi mạng nào chạm tới bạn. Bạn sẽ không nhận hai thông báo độc lập cho cùng một sự kiện kinh tế qua kênh
này, trừ khi ops chủ động mở lại dòng đó trước.

Nếu bạn còn giữ một gói chưa xử lý đã lâu, hãy hỏi đơn vị trước khi chi trả: dòng đó có thể đã được đóng bằng kênh khác. Chi trả thêm lúc đó là chi trả hai lần ở phía bạn, và chúng tôi không ghi thêm điểm nào cho dòng đã đóng.

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
  danh sách **quá hạn** của ops chúng tôi, và ops sẽ nhắc bạn.
- Dùng `POINT_REDEEMED` đòi tích hợp của bạn được phép gửi loại sự kiện đó trên nguồn đơn hàng — nhờ ops
  của chúng tôi bật khi bạn khai địa chỉ nhận điểm.

## 6. Vận hành

| | |
|---|---|
| Ai kích hoạt | **ops của chúng tôi**, bấm **Chi trả** trên màn — KHÔNG có job nào tự bắt đầu gửi |
| Gửi hàng loạt | **tuần tự**, không song song (**Gửi tất cả**). **Từ bản v1.4.1**, chiến dịch Reward được chi trả bằng MỘT nút (**Chi trả**) chạy nền: chỉ gửi, mỗi người chơi một thông báo (điểm đã chuyển một lần ở bước chốt kỳ điểm; **Chi trả** không chuyển lần nữa), **với nhịp mặc định 10 thông báo mỗi giây cho mỗi tích hợp** (chỉnh được theo từng đơn vị). Ở nhịp đó 6.642 dòng mất khoảng **11 phút** khi bạn trả lời dưới 100 ms mỗi dòng; bạn trả lời chậm hơn thì thời gian gửi ≈ *số dòng × thời gian bạn trả lời mỗi dòng* (ví dụ 200 ms mỗi dòng thì khoảng 22 phút) |
| Khi bạn ngừng trả lời | **Từ v1.4.1:** sau **20 lần gửi lỗi liên tiếp** (không trả lời trong 10 giây, hoặc trả mã khác `2xx`/`409`/`422`) lượt chạy **tự tạm dừng** và hiện cho ops *"đối tác không trả lời"*; ops bấm **Tiếp tục** khi bạn sẵn sàng và chúng tôi chỉ gửi các dòng chưa gửi. Lỗi cấu hình bên chúng tôi (chưa có địa chỉ, chưa có khoá) thì dừng cả lượt ngay |
| Gửi lại sau lỗi | ops bấm **Gửi lại** (từ v1.4.1 còn có **Gửi lại phần lỗi** cho cả một lượt chạy) — nonce mới, cùng `settlementItemId` — trừ sau "không trả lời trong 10 giây": khi đó chỉ có **Hỏi lại đối tác** (cùng nonce) |
| Địa chỉ đổi sau khi đợt đã tạo | đúng lúc ops bấm **Chi trả**, chúng tôi kiểm kênh còn dùng được và gửi tới địa chỉ **hiện tại** (từ v1.4.1) |
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

## 7. Từng bước: dựng bộ nhận và lên chính thức

Lối đi cho lập trình viên bắt đầu từ con số không. Mỗi bước nêu mục chứa chi tiết.

| # | Bạn làm | Xong khi |
|---|---|---|
| 1 | Đọc [credential-derivation.md](./credential-derivation.md) và dẫn xuất khoá **SETTLEMENT** từ `masterSecret` (khác khoá RECOVERY và EVENT) | bạn tái tạo được test vector |
| 2 | Dựng một endpoint **HTTPS** nhận `POST` với thân JSON ([§2](#2-chúng-tôi-gọi-bạn--post-địa-chỉ-nhận-điểm-của-bạn)) và đưa địa chỉ cho ops của chúng tôi ([§2.0](#20-khai-địa-chỉ)). Giữ địa chỉ đúng từng ký tự | ops của chúng tôi thấy **Sẵn sàng gửi điểm** |
| 3 | Trong handler, **theo đúng thứ tự**: (a) verify chữ ký trên **byte thô** và cửa sổ ±5 phút, sai thì trả `401` ([§3](#3-chúng-tôi-tự-xác-thực-với-bạn--partnersettlementsignaturev1)); (b) đọc `deliveryNonce`: đã thấy rồi thì trả `409` và dừng ([§4](#4-chống-phát-lại--hai-nghĩa-vụ-không-phải-một)); (c) kiểm thân, từ chối vì lý do nghiệp vụ thì trả `422`; (d) lưu dòng (`settlementItemId`, `externalUserId`, `pointAmount`, `deliveryNonce`) **trước khi** trả lời; (e) trả `2xx` | các ca conformance ([testing.md §1.6](./testing.md#16-kênh-settlement--8-ca-chạy-riêng)) qua |
| 4 | Cộng điểm cho người chơi theo **`externalUserId`**, tối đa **một lần cho mỗi `settlementItemId`** trong sổ của bạn: lần **Gửi lại** mang cùng `settlementItemId` với `deliveryNonce` mới, nên nếu đã cộng dòng đó thì trả `2xx` và **không** cộng lại. (Chỉ từ chối theo `deliveryNonce`; không bao giờ trả `409` vì `settlementItemId` lặp) | dòng bị phát lại không bao giờ áp hai lần |
| 5 | Trả lời nhanh (dưới 10 giây, tốt nhất vài trăm mili giây) và **làm việc thật sau khi trả lời**. Trả lời chậm bị tính là gửi lỗi, và 20 lần liên tiếp tạm dừng cả lượt ([§6](#6-vận-hành)) | thời gian trả lời p99 chỉ vài trăm mili giây |
| 6 | Sau khi **thật sự đã trả** một dòng, gửi sự kiện `POINT_REDEEMED` với `settlementItemId` của dòng đó chép nguyên văn và **đúng số tiền** của bảng kê ([§5](#5-sau-khi-bạn-trả--báo-lại-bằng-point_redeemed), [event-ingestion.md](./event-ingestion.md)) | dòng hiện **Khớp** ở ops của chúng tôi |
| 7 | Trên **sandbox**, tự gửi cho mình một thông báo thử (`POST /api/v1/integrations/settlement/test`, [testing.md §1.7](./testing.md)); lần đầu phải trả `2xx`, cùng nonce lặp lại phải trả `409`. Mẫu **không** phải dòng thật: đừng ghi vào sổ | lần thử trả `SENT_OK` |
| 8 | Nhờ ops của chúng tôi bật loại sự kiện `POINT_REDEEMED` cho tích hợp của bạn và hẹn ngày lên chính thức ([go-live.md](./go-live.md)); rồi họ chi trả **một đợt nhỏ đầu tiên** và xem những dòng đầu đóng lại | dòng thật đầu tiên **Khớp** |

**Ops của chúng tôi thấy gì cho mỗi câu trả lời của bạn** (để bạn biết phía bên kia chuyện gì xảy ra):

| Bạn trả lời | Ops của chúng tôi thấy ở dòng |
|---|---|
| `2xx` | *Đang chờ đối tác* (đã nhận, chưa báo đã trả) |
| `200` đúng khuôn `settlement-result.v1` (§2.2a), cùng số tiền | *Đối tác đã xác nhận* (**Khớp**) ngay: dòng đóng lại |
| `200` đúng khuôn `settlement-result.v1`, số tiền khác | *Đối tác báo lệch*: **không cộng gì**, ops liên hệ bạn |
| `2xx`, rồi `POINT_REDEEMED` đúng số tiền | *Đối tác đã xác nhận* (**Khớp**): dòng đóng lại |
| `2xx`, rồi `POINT_REDEEMED` số tiền khác | *Đối tác báo lệch*: **không cộng gì**, ops liên hệ bạn |
| `409` ở lần gửi đầu | *Đối tác từ chối* |
| `422` | *Đối tác từ chối*, kèm lý do hiện bằng nhãn |
| mã khác | *Gửi lỗi* (ops bấm được **Gửi lại**) |
| không trả lời trong 10 giây | *Gửi lỗi, chưa biết câu trả lời* (chúng tôi **hỏi lại**, cùng nonce) |
| không có `POINT_REDEEMED` sau 7 ngày | dòng bị gắn cờ **Quá hạn**; ops hỏi bạn |

**Hãy báo chúng tôi ngay khi** endpoint đổi địa chỉ ([go-live.md B.3](./go-live.md)), bạn xoay khoá ([§3](#3-chúng-tôi-tự-xác-thực-với-bạn--partnersettlementsignaturev1)), hoặc bạn sẽ ngừng hoạt động một thời gian: sự cố dài làm một lượt chạy tạm dừng (ở trên), và các dòng còn mở cho tới khi bạn báo.

## 8. Checklist

```text
[ ] Đưa ops của chúng tôi một địa chỉ https:// nhận thông báo (§2.0)
[ ] Nhờ ops của chúng tôi bật loại sự kiện POINT_REDEEMED cho tích hợp của bạn (§5)
[ ] Dẫn xuất khoá kênh SETTLEMENT từ masterSecret (xem credential-derivation.md) — RIÊNG khoá RECOVERY
[ ] Dựng verify chữ ký PartnerSettlementSignatureV1 trên thân THÔ (§3)
[ ] Cộng điểm theo externalUserId, không theo partyId (§2.1)
[ ] Lưu sổ deliveryNonce đã thấy và trả 409 khi trùng — 409 cho không việc gì khác (§4)
[ ] Cộng tối đa một lần cho mỗi settlementItemId trong sổ của bạn; trả 2xx (không phải 409) cho lần Gửi lại của dòng đã cộng (§7 bước 4)
[ ] Trả 2xx khi đã nhận, dưới 10 giây — không cần xử lý xong mới trả 2xx; 20 lần gửi lỗi liên tiếp tạm dừng cả lượt (§6)
[ ] Gửi POINT_REDEEMED cho mọi dòng bạn đã trả, chép settlementItemId nguyên văn (§5)
[ ] Chạy các ca conformance settlement với endpoint của bạn (testing.md §1.6) và tự gửi một thông báo thử trên sandbox (testing.md §1.7)
```
