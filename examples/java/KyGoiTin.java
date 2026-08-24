// Ký gói tin sự kiện — khuôn `EventIngressSignatureV1`. Java 17+.
//
// Tự kiểm (không cần mạng, không cần khoá thật):
//     java examples/java/KyGoiTin.java --tu-kiem
//
// Luật:  chuỗi ký = <timestamp> + "." + <thân THÔ>

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public class KyGoiTin {

    /**
     * @param biMat   bí mật kênh sự kiện
     * @param than    ĐÚNG mảng byte sẽ đem gửi — giữ byte[], đừng đi qua String hai lần
     * @param tsGiay  giây kể từ epoch
     */
    public static String ky(String biMat, byte[] than, long tsGiay) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(biMat.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        mac.update((tsGiay + ".").getBytes(StandardCharsets.UTF_8));
        mac.update(than);
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal());
    }

    /**
     * Gửi một gói tin.
     *
     * 🔴 `than` vào đây là byte[] đã serialize MỘT LẦN. Ký nó, rồi gửi CHÍNH nó.
     *    Mỗi lần `new String(...)` rồi `getBytes(...)` là một cơ hội đổi byte — và chữ ký
     *    ký trên byte, nên lệch một byte là trượt.
     */
    public static HttpResponse<String> gui(String api, String accessKey, String biMat, byte[] than)
            throws Exception {
        long ts = System.currentTimeMillis() / 1000;
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(api + "/integrations/events"))
                .header("Content-Type", "application/json")
                .header("X-API-Key", accessKey)
                .header("X-Timestamp", String.valueOf(ts))
                .header("X-Signature", ky(biMat, than, ts))
                .POST(HttpRequest.BodyPublishers.ofByteArray(than))
                .build();
        return HttpClient.newHttpClient().send(req, HttpResponse.BodyHandlers.ofString());
    }

    /** So chữ ký theo THỜI GIAN HẰNG SỐ — đừng dùng String.equals cho việc này. */
    public static boolean chuKyKhop(String mongDoi, String nhanDuoc) {
        if (nhanDuoc == null) return false;
        byte[] a = mongDoi.getBytes(StandardCharsets.UTF_8);
        byte[] b = nhanDuoc.getBytes(StandardCharsets.UTF_8);
        if (a.length != b.length) return false;
        int khac = 0;
        for (int i = 0; i < a.length; i++) khac |= a[i] ^ b[i];
        return khac == 0;
    }

    // ── Tự kiểm bằng VECTOR CỐ ĐỊNH (hợp đồng, Phụ lục B.1) ─────────────────────────────────────
    private static final String V_BI_MAT = "whsec_demo_0123456789abcdef";
    private static final long   V_TS     = 1786698753L;
    private static final String V_THAN   =
        "{\"specversion\":\"1.0\",\"eventId\":\"evt-88421\",\"externalUserId\":\"12345\","
      + "\"type\":\"ORDER_COMPLETED\",\"occurredAt\":\"2026-08-14T09:12:33Z\","
      + "\"confidence\":\"SERVER_OBSERVED\",\"payload\":{\"orderId\":\"SO-99881\","
      + "\"amountMinor\":250000000,\"currency\":\"VND\"}}";
    private static final String V_CHU_KY =
        "sha256=ae00dc858385fdb65061fda5da1809772f8f602f5d653052e7672516c4d59176";

    public static void main(String[] args) throws Exception {
        boolean tuKiem = false;
        for (String a : args) if ("--tu-kiem".equals(a)) tuKiem = true;
        if (!tuKiem) {
            System.out.println("Dùng: java KyGoiTin.java --tu-kiem");
            return;
        }
        String ra = ky(V_BI_MAT, V_THAN.getBytes(StandardCharsets.UTF_8), V_TS);
        boolean dat = ra.equals(V_CHU_KY);
        System.out.println((dat ? "✅ ĐẠT" : "❌ TRƯỢT") + "  EventIngressSignatureV1");
        System.out.println("   nhận : " + ra);
        if (!dat) {
            System.out.println("   mong : " + V_CHU_KY);
            System.out.println();
            System.out.println("   Ba chỗ hay sai, kiểm theo thứ tự này:");
            System.out.println("     ① thiếu dấu \".\" giữa timestamp và thân");
            System.out.println("     ② đi qua String rồi getBytes lại (đổi byte)");
            System.out.println("     ③ dùng base64 thay vì hex, hoặc hex viết HOA");
        }
        System.exit(dat ? 0 : 1);
    }
}
