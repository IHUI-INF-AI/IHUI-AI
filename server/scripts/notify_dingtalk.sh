#!/usr/bin/env bash
# 通过钉钉机器人发送通知 (staging 部署/回滚用)
# 用法: ./scripts/notify_dingtalk.sh "消息内容"

set -euo pipefail

MSG="${1:-ZHS Platform staging event}"
WEBHOOK="${DINGTALK_WEBHOOK:-}"
SECRET="${DINGTALK_SECRET:-}"

if [ -z "$WEBHOOK" ]; then
    echo "DINGTALK_WEBHOOK 未设置, 跳过"
    exit 0
fi

# 加签
if [ -n "$SECRET" ]; then
    TIMESTAMP=$(date +%s%3N)
    STRING_TO_SIGN="${TIMESTAMP}\n${SECRET}"
    SIGN=$(echo -en "$STRING_TO_SIGN" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)
    WEBHOOK="${WEBHOOK}&timestamp=${TIMESTAMP}&sign=$(python3 -c "import urllib.parse; print(urllib.parse.quote_plus('${SIGN}'))")"
fi

PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
    'msgtype': 'markdown',
    'markdown': {
        'title': 'ZHS Platform',
        'text': sys.argv[1]
    }
}))
" "$MSG")

curl -fsS -X POST "$WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" >/dev/null

echo "钉钉通知已发送"
