#!/usr/bin/env bash
# Ký gói tin sự kiện bằng openssl — để kiểm nhanh, không cần dựng gì.
#
#   bash examples/shell/ky.sh --tu-kiem
#
# Luật:  chuỗi ký = <timestamp> + "." + <thân THÔ>
set -euo pipefail

ky() {  # ky <bí mật> <timestamp> <thân>
  printf '%s.%s' "$2" "$3" | openssl dgst -sha256 -hmac "$1" -r | cut -d' ' -f1
}

# ⚠️ `--data-binary`, KHÔNG phải `-d`: `curl -d` cắt xuống dòng và có thể đổi dãy byte —
#    mà chữ ký ký trên BYTE.
gui() {  # gui <api> <accessKey> <bí mật> <thân>
  local ts sig
  ts=$(date +%s)
  sig="sha256=$(ky "$3" "$ts" "$4")"
  curl -sS -D- "$1/integrations/events" \
    -H 'Content-Type: application/json' \
    -H "X-API-Key: $2" -H "X-Timestamp: $ts" -H "X-Signature: $sig" \
    --data-binary "$4"
}

if [ "${1:-}" = "--tu-kiem" ]; then
  BI_MAT='whsec_demo_0123456789abcdef'
  TS=1786698753
  THAN='{"specversion":"1.0","eventId":"evt-88421","externalUserId":"12345","type":"ORDER_COMPLETED","occurredAt":"2026-08-14T09:12:33Z","confidence":"SERVER_OBSERVED","payload":{"orderId":"SO-99881","amountMinor":250000000,"currency":"VND"}}'
  MONG='ae00dc858385fdb65061fda5da1809772f8f602f5d653052e7672516c4d59176'
  RA=$(ky "$BI_MAT" "$TS" "$THAN")
  if [ "$RA" = "$MONG" ]; then
    echo "✅ ĐẠT  EventIngressSignatureV1"; echo "   nhận : sha256=$RA"; exit 0
  fi
  echo "❌ TRƯỢT  EventIngressSignatureV1"; echo "   nhận : sha256=$RA"; echo "   mong : sha256=$MONG"
  exit 1
fi
