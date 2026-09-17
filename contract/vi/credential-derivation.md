# Dẫn xuất credential — `IntegrationCredentialDerivationV1`

Điểm vào: [README.md](./README.md).

Creator-OS cấp cho bạn một `accessKey` và một `masterSecret`. Hãy lưu master trên máy chủ như một
credential có giá trị cao. Nó chỉ hiện một lần và không thể đọc lại về sau.

Mỗi bộ credential được cấp một master mới; tuyệt đối không
tái sử dụng master giữa các tích hợp.

Không dùng master trực tiếp để ký HMAC. Hãy dẫn xuất một `channelKey` riêng theo kênh và phiên bản mà
Creator-OS công bố:

| Tham số | Giá trị |
|---|---|
| KDF | HKDF (RFC 5869) |
| Hàm băm | SHA-256 |
| Input key material | 32 byte thu được khi giải mã base64url `masterSecret` |
| Salt | chuỗi byte rỗng |
| Info | UTF-8 `integration:channel:<CHANNEL>:v<VERSION>` |
| Đầu ra | 32 byte, mã hoá base64url không padding |

`CHANNEL` viết hoa: `EVENT`, `LAUNCH`, `RECOVERY` (và `AUTH` với tích hợp cũ). Version là số nguyên
dương Creator-OS trả về; tuyệt đối không tự đoán.

```js
import { hkdfSync } from 'node:crypto';

export function deriveChannelKey(masterSecret, channel, version) {
  const info = `integration:channel:${channel}:v${version}`;
  return Buffer.from(hkdfSync(
    'sha256', Buffer.from(masterSecret, 'base64url'), Buffer.alloc(0), Buffer.from(info, 'utf8'), 32,
  )).toString('base64url');
}
```

Vector máy đọc được nằm ở
[`../integration-credential-derivation-v1.test-vector.json`](../integration-credential-derivation-v1.test-vector.json).
Hãy ghim chúng trong unit test trước khi gọi sandbox.

## Đối chiếu vector trong 10 giây

Chạy đúng đoạn này với file vector. Khớp `4/4` là code dẫn xuất của bạn đúng — khỏi đoán, khỏi thử
bằng cách bắn vào sandbox rồi đọc `401`.

```bash
node -e '
  const { hkdfSync } = require("node:crypto");
  const v = require("./integration-credential-derivation-v1.test-vector.json");
  const ikm = Buffer.from(v.masterSecret, "base64url");
  let ok = 0;
  for (const t of v.vectors) {
    const info = `integration:channel:${t.channel}:v${t.version}`;
    const got  = Buffer.from(
      hkdfSync("sha256", ikm, Buffer.alloc(0), Buffer.from(info, "utf8"), v.outputBytes),
    ).toString("base64url");
    const hit = got === t.channelKey;
    if (hit) ok++;
    console.log(`${hit ? "✓" : "✗"} ${t.channel} v${t.version}`);
  }
  console.log(`${ok}/${v.vectors.length}`);
'
```

## Lấy khoá cho một kênh cụ thể

```bash
MASTER_SECRET='<masterSecret — base64url 43 ký tự>'

derive() {   # derive <CHANNEL> <VERSION>
  node -e '
    const { hkdfSync } = require("node:crypto");
    const ikm  = Buffer.from(process.argv[1], "base64url");
    const info = Buffer.from(`integration:channel:${process.argv[2]}:v${process.argv[3]}`, "utf8");
    process.stdout.write(
      Buffer.from(hkdfSync("sha256", ikm, Buffer.alloc(0), info, 32)).toString("base64url"));
  ' "$MASTER_SECRET" "$1" "$2"
}

EVENT_KEY=$(derive EVENT 1)      # ký sự kiện   → event-ingestion.md
LAUNCH_KEY=$(derive LAUNCH 1)    # ký launch    → campaign-launch.md
RECOVERY_KEY=$(derive RECOVERY 1)  # KIỂM chữ ký chúng tôi gửi sang → recovery.md
```

## Bốn chỗ tích hợp hay sai — đọc trước khi debug `401`

| | |
|---|---|
| **`masterSecret` GIẢI ra byte, `channelKey` thì KHÔNG** | master là *đầu vào* HKDF nên phải `base64url_decode` thành 32 byte. Khoá kênh trả về là *chuỗi* — dùng **nguyên văn** làm khoá HMAC, giải thêm lần nữa là ra khoá khác |
| **base64url ≠ base64** | bảng chữ dùng `-` và `_` thay `+` và `/`, và **không có `=` đệm**. Hàm base64 thường sẽ giải sai |
| **`CHANNEL` viết HOA trong `info`** | `integration:channel:**LAUNCH**:v1`. Chuỗi này phân biệt hoa/thường tuyệt đối |
| **`I` `l` `1` · `O` `0` nhìn giống nhau** | đừng chép `masterSecret` từ ảnh chụp màn hình hay tài liệu đã in. Copy nguyên chuỗi, hoặc đối chiếu bằng `sha256` của chính chuỗi đó |

⚠️ Cả bốn ca đều dẫn tới **cùng một** phản hồi `401` — cửa cố ý nói một câu cho mọi nguyên nhân để
chống dò khoá. Nên `401` **không** nói bạn sai ở đâu; chạy đối chiếu vector ở trên mới nói.

## Xoay khoá

Xoay chỉ đổi version của một kênh. Ví dụ EVENT v1 và v2 cùng hợp lệ trong lúc bạn triển khai v2. Dùng
cùng master để dẫn xuất v2, chuyển mọi máy gửi sang v2, chờ Creator-OS báo v2 đã được dùng, rồi mới yêu
cầu thu hồi v1. Version của các kênh khác không đổi.

Nếu nghi chính `masterSecret` bị lộ, dừng flow xoay từng kênh và yêu cầu cấp lại toàn bộ bộ credential.
