# Phụ lục MSHT — những gì MSHT phải dựng

**Bản 1.0 · 23/08/2026** · Đọc **cùng** với *Tích hợp sự kiện với Nền tảng* (gọi tắt: **hợp đồng nền**).

> **Tài liệu này KHÔNG lặp lại hợp đồng nền.** Hợp đồng nền đã nói *gói tin hình gì · ký thế nào · mã trả
> lời ra sao · gửi lại thế nào*. Những thứ đó **không đổi** với MSHT.
>
> Phụ lục này chỉ trả lời **một câu**: *chỗ nào hợp đồng nền để cho bên đối ứng **CHỌN**, thì MSHT chọn
> cái gì.* Và câu trả lời gần như luôn là: **theo đúng thiết kế nền tảng công bố.**
>
> ⚠️ **Quy ước tham chiếu — hai tài liệu có hai hệ đánh số, và chúng TRÙNG SỐ nhau.**
> `§2.5` của phụ lục này *(kiểm chữ ký)* không phải `§2.5` của hợp đồng nền *(ba lượt bắn kiểm chứng)*.
>
> ```
> §X                 ⟶  mục của CHÍNH phụ lục này
> hợp đồng nền §X    ⟶  mục của HỢP ĐỒNG NỀN
> ```

---

## 0. Quan hệ này khác gì các bên đối ứng khác

Hợp đồng nền được viết cho **một bên đối ứng bất kỳ**, kể cả bên đã có hệ thống riêng chạy nhiều năm.
Nên nó nhường rất nhiều thứ cho bên kia quyết. **Với MSHT thì không** — MSHT dựng theo thiết kế nền tảng,
không có bản riêng.

| Hợp đồng nền nói | Với MSHT là |
|---|---|
| *"Bạn **không phải** dựng đúng API của chúng tôi — chúng tôi có lớp chuyển đổi cho từng bên"* (hợp đồng nền §6.3) | **MSHT dựng ĐÚNG hình mặc định** ở §2 của phụ lục này. Không có lớp chuyển đổi nào được cắm riêng cho MSHT |
| *"Chính sách gửi lại là của bạn"* (hợp đồng nền §4.7) | **theo khuyến nghị của hợp đồng nền**: lùi dần theo hàm mũ + nhiễu ngẫu nhiên, có hạn tổng, hết hạn thì vào hàng chết |
| *"Bốn khuôn kéo lại — có bất kỳ cái nào là đủ"* (hợp đồng nền §6.5) | **dựng cả ba câu hỏi** theo hợp đồng. Hạng `FULL_RECOVERY` được nền tảng **công bố SAU KHI** bài kiểm tương ứng đạt — xem §1 |
| *"Con trỏ là chuỗi **của bạn**, muốn mã hoá gì bên trong là việc của bạn"* (hợp đồng nền §6.3) | vẫn đúng — **đây là chỗ duy nhất MSHT được tự quyết**, xem §2.6 |
| `payload` — trường ngoài bảng được lưu nguyên văn (hợp đồng nền §3.8) | **đừng gửi trường ngoài bảng.** Cần thêm trường thì đề nghị bổ sung vào hợp đồng nền, để mọi bên cùng có |

⭐ **Đổi lại, MSHT được một thứ các bên khác không có:** bộ kiểm hợp chuẩn chạy **thẳng, không cần cắm
gì**. Bộ kiểm gọi theo hình mặc định; MSHT dựng đúng hình đó nên nó chạy được từ lượt đầu.

---

## 1. Ba việc MSHT phải dựng — và thứ tự

```
① CHIỀU VÀO   bắn sự kiện sang nền tảng           BẮT BUỘC   → hợp đồng nền §2-§4
② XÁC THỰC    kiểm chữ ký khi nền tảng gọi sang   BẮT BUỘC   → §2.5 dưới
③ CHIỀU RA    ba câu hỏi phục hồi                 BẮT BUỘC   → §2 dưới
```

Với một bên đối ứng bất kỳ thì ② và ③ là **tuỳ chọn** và chỉ ảnh hưởng tới hạng. Với MSHT chúng là **bắt
buộc**, vì mục tiêu đã chốt là `FULL_RECOVERY`.

🔴 **Dựng đủ ba câu hỏi KHÔNG tự động thành `FULL_RECOVERY`.** Hai việc khác nhau, và thứ tự là một chiều:

```
MSHT hiện thực cả ba năng lực theo hợp đồng
        ↓
chạy bài kiểm hợp chuẩn — các ca chiều RA ĐẠT
        ↓
nền tảng chạy lượt kiểm của mình rồi ghi nhận
        ↓
nền tảng CÔNG BỐ hạng FULL_RECOVERY
```

Hợp đồng nền §6.5 nói thẳng: **khai không đủ để lên hạng, phải chứng minh.** Hạng là **giao** của
*(năng lực suy tại chỗ)* và *(bài kiểm đã PASS gì)* — cắm xong mà chưa PASS thì hạng đứng yên, và gỡ
đường phục hồi ra thì **tụt hạng ngay**, không ai phải cập nhật gì.

⚠️ **Làm ① trước, xong hẳn, rồi mới làm ③.** ① là điều kiện vào cửa (7/7 ca chiều VÀO); ③ chỉ quyết định
hạng. Làm song song thì lúc bài kiểm đỏ sẽ không biết đỏ vì chiều nào.

---

## 2. Chiều RA — API phục hồi MSHT phải dựng

Đây là phần chính của phụ lục, vì đây là chỗ hợp đồng nền **cố ý không quy định** cho các bên khác.

### 2.1 Một điểm cuối duy nhất, `POST`, JSON

MSHT khai cho nền tảng **một** URL. Cả ba câu hỏi đi vào **cùng** URL đó.

```
POST <recovery_endpoint>
Content-Type: application/json
X-Platform-Key-Id:    <mã khoá nền tảng đang ký bằng>
X-Platform-Timestamp: <giây, epoch>
X-Platform-Signature: sha256=<hex thường>
```

🔴 **Câu hỏi được phân biệt bằng TRƯỜNG CÓ MẶT trong thân**, không bằng đường dẫn, không bằng một trường
`action`:

| Thân yêu cầu | Là câu hỏi | Trả lời |
|---|---|---|
| `{ tu, den, loai?, conTro? }` | ① *"khoảng này bên anh đã gửi những sự việc nào?"* | `{ suKien: [...], conTroTiep }` |
| `{ eventId }` | ② *"gửi lại sự việc mang mã này"* | `{ suKien: {...} }` hoặc `404` |
| `{ thamChieu }` | ③ *"trạng thái vật gốc"* | `{ trangThai, moc? }` hoặc `404` |

⚠️ **Không có `3xx`.** Nền tảng **không đi theo chuyển hướng** — gói tin đã ký mà bị chuyển hướng là đi
tới một đích nền tảng không chọn. `recovery_endpoint` phải là **đích cuối**, không phải một URL chuyển tiếp.

⏱️ **Hạn giờ 10 giây** cho mỗi lượt gọi. Quá hạn, nền tảng ghi *"không trả lời được"* — **không** ghi
*"không có gì"*. Câu hỏi nào nặng thì trả trang nhỏ hơn, đừng để lượt gọi chạy lâu.

### 2.2 Câu ① — hỏi theo cửa sổ thời gian

```jsonc
// nền tảng gửi
{ "tu": "2026-08-10T00:00:00Z", "den": "2026-08-10T06:00:00Z", "loai": "ORDER_COMPLETED", "conTro": "..." }

// MSHT trả — 200
{
  "suKien": [ { /* ĐÚNG phong bì gói tin sự kiện, xem dưới */ } ],
  "conTroTiep": "eyJvZmZzZXQiOjUwMH0"   // hoặc null khi HẾT
}
```

| Trường gửi sang | Bắt buộc | Nghĩa |
|---|:--:|---|
| `tu` · `den` | ✅ | ISO-8601 UTC. Lọc theo **lúc việc xảy ra**, cùng trục `occurredAt` của chiều vào |
| `loai` | ⬜ | vắng ⇒ **không lọc theo loại** |
| `conTro` | ⬜ | vắng ⇒ **trang đầu** |

🔴 **`suKien[]` chở ĐÚNG phong bì của chiều vào** — cùng các trường `eventId` · `externalUserId` · `type`
· `occurredAt` · `confidence` · `payload` mà MSHT đã gửi lúc đầu. **Không** phải một hình thứ hai, không
phải bản ghi nội bộ của MSHT.

> **Vì sao bắt trùng khít:** nền tảng lấy đúng những sự việc đó rồi **đưa lại vào cửa nhận**. Một hình
> thứ hai nghĩa là MSHT phải dựng một phép chuyển đổi nữa, và phép chuyển đổi đó **không có ai kiểm**.

🔴 **`conTroTiep` phải CÓ MẶT trong mọi phản hồi `200`.** Hết trang thì trả `null` **tường minh** — không
được vắng mặt. Trường vắng và trường `null` là hai câu khác nhau, và nền tảng phải phân biệt được.

🔴 **Thiếu hẳn mảng `suKien` KHÔNG được đọc thành danh sách rỗng.** Nền tảng đọc nó là *"bên kia trả một
hình tôi không hiểu"*, tức **không trả lời được** — khác hẳn *"khoảng đó thật sự không gửi gì"*.

```
"suKien": []      ⟶  "khoảng đó tôi THẬT SỰ không gửi gì"     ← một câu trả lời hợp lệ
thiếu "suKien"    ⟶  "không trả lời được"                     ← nền tảng KHÔNG kết luận gì
```

⚠️ **Trả sai một trong hai là hỏng theo hướng nguy hiểm nhất:** để nền tảng **yên tâm trong lúc đang mất
sự kiện**.

### 2.3 Câu ② — gửi lại theo định danh

```jsonc
// nền tảng gửi
{ "eventId": "EVT-001" }

// MSHT trả — 200
{ "suKien": { "eventId": "EVT-001", "externalUserId": "…", "type": "…", "occurredAt": "…", "payload": { … } } }

// hoặc — mã đó MSHT không có
404
```

🔴 **`404` là một CÂU TRẢ LỜI, không phải lỗi** — nghĩa *"vật đó bên tôi không có"*. Hỏi một mã không tồn
tại là chuyện **bình thường** lúc đối soát.

⚠️ **Đừng trả `5xx` cho một mã không tồn tại.** Nền tảng đọc `5xx` là *"đường này hỏng"* và sẽ **thử lại
mãi**.

⚠️ `suKien.eventId` trả về phải **đúng bằng** mã đã hỏi. Trả một sự việc khác là bài kiểm `OUT-4` đỏ.

### 2.4 Câu ③ — trạng thái vật gốc

Dành cho lúc nền tảng muốn đối chiếu thẳng với **đơn hàng / giao dịch**, không qua sổ sự kiện.

```jsonc
// nền tảng gửi
{ "thamChieu": "ORD-123" }

// MSHT trả — 200
{ "trangThai": "COMPLETED", "moc": "2026-08-10T04:12:00Z" }   // `moc` tuỳ chọn

// hoặc — không có vật đó
404
```

⚠️ **`200` thì thân bắt buộc có `trangThai`.** Một `200 {}` rỗng không phân biệt được với *"đã dựng đường
nhưng chưa cắm gì"* — bài kiểm `OUT-7` đỏ. Không có vật đó thì trả `404`, hoặc `trangThai: null`.

⭐ **Giá trị của `trangThai` là từ vựng của MSHT** — nền tảng nhận chuỗi và không diễn giải. Chỉ cần
**ổn định**: cùng một vật ở cùng một trạng thái phải luôn ra cùng một chuỗi.

### 2.5 Xác thực lượt gọi vào — MSHT PHẢI kiểm chữ ký

Khuôn ký, mã mẫu và vector kiểm thử nằm ở hợp đồng nền §6.4 và Phụ lục B.2. **Không lặp lại ở đây.**
Ba điều MSHT phải làm đúng:

1. **Tra bí mật theo `X-Platform-Key-Id`** — giữ được **hai** bí mật cùng lúc, vì lúc xoay khoá cả hai
   đều hợp lệ. Ghim cứng một bí mật là ngày xoay khoá đường phục hồi **chết câm**.
2. **Lấy đường dẫn NGUYÊN VĂN** như trên dòng yêu cầu. Kiểm xem reverse proxy / API gateway của MSHT có
   tự chuẩn hoá `%`-encoding hay sắp lại query không — nếu có, chữ ký **đúng vẫn trượt**.
3. **Từ chối thì trả `401` hoặc `403`.** Đừng trả `200` với thân rỗng.

🔴 Nền tảng phân biệt **ba** kết cục, và trả nhầm là để nền tảng kết luận sai:

| MSHT trả | Nền tảng hiểu | Hệ quả |
|---|---|---|
| `401` · `403` | **MSHT từ chối tôi** | dừng, báo người trực — không kết luận về dữ liệu |
| `5xx` · hết giờ · lỗi mạng | **MSHT không trả lời được** | thử lại sau, **không** kết luận gì |
| `200` + `suKien: []` | **MSHT thật sự không gửi gì** | 🔴 **kết luận: không thiếu** |

### 2.6 Con trỏ phân trang — chỗ duy nhất MSHT tự quyết

Nội dung bên trong `conTroTiep` là **của MSHT**. Nền tảng gửi lại **nguyên văn** ở lượt sau và **không
diễn giải** nó. Mã hoá offset, khoá cuối, token — tuỳ MSHT.

🔴 **Nhưng một luật là bắt buộc: con trỏ SAI phải bị TỪ CHỐI bằng `4xx`.**

Âm thầm trả trang đầu là **lỗi im lặng nguy hiểm nhất của phân trang**: vòng kéo lại của nền tảng chạy
**mãi trên cùng một trang** và không bao giờ kết thúc — mà mọi trang đều trông hợp lệ, nên **không bên
nào thấy**.

### 2.7 Mã trả lời chiều RA — bảng đầy đủ

| Mã | Khi nào | Nền tảng đọc là |
|:--:|---|---|
| `200` | trả lời được | dữ liệu — **có kết luận** |
| `404` | câu ② / ③, vật không tồn tại | *"bên anh không có vật đó"* — **là câu trả lời** |
| `4xx` khác | con trỏ sai, thân sai khuôn | từ chối yêu cầu — nền tảng không thử lại y nguyên |
| `401` · `403` | chữ ký sai, khoá sai, quá hạn | **MSHT chặn nền tảng** |
| `5xx` | MSHT hỏng | **không trả lời được** — thử lại sau |
| `3xx` | — | **KHÔNG dùng.** Nền tảng không đi theo chuyển hướng |

---

## 3. Bảy ca bài kiểm chiều RA soi đúng cái gì

Bảy ca này quyết định hạng. Bảng dưới nối **từng ca** với **mục MSHT phải làm đúng** ở trên, để lúc một
ca đỏ thì biết đi sửa chỗ nào.

| Ca | Soi gì | Sửa ở |
|---|---|---|
| `OUT-1` | câu ① trả `200` và có mảng `suKien` | §2.2 |
| `OUT-2` | `conTroTiep` **có mặt** — kể cả khi `null` | §2.2 |
| `OUT-3` | mã không có thật ⇒ `200` hoặc `404`, **không `5xx`** | §2.3 |
| `OUT-4` | hỏi lại một mã THẬT ⇒ trả **đúng** sự việc đó | §2.3 |
| `OUT-5` | hai lượt hỏi cùng khoảng ⇒ **cùng tập định danh** | §2.2 |
| `OUT-6` | con trỏ bịa ⇒ **`4xx`**, không âm thầm trả trang đầu | §2.6 |
| `OUT-7` | câu ③ ⇒ `200` có `trangThai`, hoặc `404` | §2.4 |

⚠️ **`OUT-4` cần dữ liệu thật.** Nó lấy một `eventId` từ kết quả câu ① rồi hỏi lại. Khoảng 24 giờ trước
lúc chạy mà **không có sự việc nào** thì ca này trượt vì thiếu dữ liệu, không phải vì mã sai. ⇒ Bắn vài
sự kiện thật trước khi chạy bài kiểm.

🔒 **Một năng lực chỉ được công nhận khi MỌI ca cấp nó đều đạt.** `QUERY_WINDOW` cần cả `OUT-1` `OUT-2`
`OUT-5` `OUT-6`; `REDELIVER_BY_ID` cần `OUT-3` `OUT-4`; `QUERY_RESOURCE` cần `OUT-7`. Không có ô *"gần đạt"*.

---

## 4. Ánh xạ nghiệp vụ MSHT ⟶ loại sự kiện

Danh mục loại là **danh mục đóng** của nền tảng (hợp đồng nền §3.4). MSHT **không** đặt loại mới; việc
của MSHT là ánh xạ nghiệp vụ của mình vào danh mục đó.

| Việc xảy ra ở MSHT | Gửi `type` | `payload` bắt buộc |
|---|---|---|
| đơn vừa được tạo | `ORDER_CREATED` | `orderId` |
| đơn hoàn tất | `ORDER_COMPLETED` | `orderId` *(+ `amountMinor` + `currency` nếu phần thưởng có ngưỡng giá trị)* |
| đơn huỷ **hoặc hoàn** | `ORDER_CANCELLED` | `orderId` |
| hành vi trên giao diện MSHT | `UI_ACTION` | `actionKey` |

⚠️ **Một đơn đi qua nhiều trạng thái ⇒ nhiều gói tin, mỗi gói một `eventId` riêng**, cùng một `orderId`
trong `payload`. Đây là chỗ hiểu nhầm tốn kém nhất — đọc hợp đồng nền §3.3 trước khi viết dòng mã đầu tiên.

⚠️ **`orderId` phải là CHUỖI**, và phải là **cùng một khoá** MSHT dùng để tra đơn ở câu ② / ③. Lệch nhau
thì lượt kéo lại tra không ra đơn.

**Cần một loại chưa có trong danh mục?** Đề nghị bổ sung vào **hợp đồng nền**, không mở một loại riêng
cho MSHT. Một loại chỉ MSHT hiểu là một từ vựng riêng — đúng thứ thiết kế này bỏ đi.

---

## 5. Trình tự onboard

| # | Việc | Xong khi |
|:--:|---|---|
| 1 | Nền tảng cấp mã nhận dạng + bí mật **kênh sự kiện** | MSHT nhận đủ, cất ở máy chủ |
| 2 | MSHT dựng hàm ký, kiểm bằng **vector Phụ lục B.1** của hợp đồng nền | ca kiểm thử đơn vị xanh, chưa cần mạng |
| 3 | MSHT bắn **ba lượt kiểm chứng** (hợp đồng nền §2.5) lên sandbox | lượt 2 trả `deduplicated: true` |
| 4 | Nền tảng khai danh mục loại cho khoá của MSHT | hết `422 event_type_not_registered` |
| 5 | MSHT chạy **bài kiểm hợp chuẩn**, chiều VÀO | **7/7 đạt** — điều kiện vào cửa |
| 6 | Nền tảng cấp bí mật **kênh phục hồi**; MSHT khai `recovery_endpoint` | nền tảng gọi sang được |
| 7 | MSHT dựng ba câu hỏi §2 + phép kiểm chữ ký §2.5 | bài kiểm chiều RA **7/7 đạt** |
| 8 | Nền tảng chạy lượt kiểm của mình, ghi nhận | hạng công bố = `FULL_RECOVERY` |

🔴 **Bước 8 do nền tảng chạy, không phải MSHT.** Kết quả MSHT tự chạy **in ra** để MSHT tự sửa, nó
**không** vào sổ nền tảng. Đây không phải thiếu tin tưởng — một cổng nghiệm thu tin bằng chứng do chính
bên được xét nộp thì không còn là cổng.

⚠️ **Bước 5 chặn bước 6.** Chưa qua điều kiện vào cửa thì chưa cấp bí mật kênh phục hồi.

---

## 6. Danh sách kiểm dành riêng cho MSHT

Phần chiều VÀO dùng danh sách 18 mục của hợp đồng nền §9. Dưới đây là phần **thêm** cho chiều RA:

- [ ] `recovery_endpoint` là **đích cuối**, không chuyển hướng, không đứng sau một URL rút gọn
- [ ] Kiểm chữ ký `PartnerRecoverySignatureV1` — khớp **vector Phụ lục B.2** của hợp đồng nền
- [ ] Tra bí mật theo `X-Platform-Key-Id`, **giữ được hai bí mật** cùng lúc
- [ ] Đã log lại **đúng dòng yêu cầu mà tầng kiểm chữ ký nhìn thấy** — để lúc lệch còn tìm ra ở đâu
- [ ] Kiểm độ tươi ±5 phút, chặn **cả hai phía** (mốc từ tương lai cũng chặn)
- [ ] Từ chối ⇒ `401`/`403`, **không** `200` thân rỗng
- [ ] Câu ① trả `suKien` **đúng phong bì gói tin**, không phải bản ghi nội bộ
- [ ] `conTroTiep` **luôn có mặt**, `null` khi hết
- [ ] Con trỏ sai ⇒ **`4xx`**, có ca kiểm thử khoá lại
- [ ] Hai lượt hỏi cùng khoảng ⇒ **cùng tập** `eventId`
- [ ] Câu ② mã không có thật ⇒ `404`, **không** `5xx`
- [ ] Câu ③ `200` luôn kèm `trangThai`
- [ ] Mỗi lượt gọi trả lời **dưới 10 giây**; khoảng dài thì chia trang nhỏ hơn
- [ ] Đã bắn vài sự kiện thật trong 24 giờ trước khi chạy bài kiểm *(ca `OUT-4` cần dữ liệu)*

---

## 7. Chỗ nào MSHT thấy hợp đồng nền chưa đủ rõ

MSHT theo thiết kế nền tảng, nên khi có chỗ mơ hồ thì **đường sửa là sửa hợp đồng nền**, không phải thoả
thuận riêng một câu cho MSHT.

```
thấy mơ hồ  ⟶  báo nền tảng  ⟶  sửa HỢP ĐỒNG NỀN  ⟶  mọi bên cùng nhận bản mới
              KHÔNG:  thoả thuận riêng qua email, rồi hai bên nhớ khác nhau
```

Lý do rất thực tế: một câu chỉ tồn tại trong hộp thư sẽ **không ai đọc lại** khi người làm đổi chỗ, và
nó cũng không có bài kiểm nào canh.
