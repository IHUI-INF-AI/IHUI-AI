#!/usr/bin/env bash
# Y-37 runbook 步骤一/三验证判据（动态解析 IP，不写死）。
# 用法:
#   bash scripts/y37-edgeone-origin-ip.sh step1   # 裸域 Host 直击 EdgeOne，验证书是否就位
#   bash scripts/y37-edgeone-origin-ip.sh step3   # 裸域强制走 CF 边缘，验是否 <1s 稳定
# 说明: nslookup 输出里 DNS 服务器行也带 "Address:",须排除服务器自身 IP 与 IPv6(带冒号)。

set -u
DOMAIN="aizhs.top"
DNS="1.1.1.1"

# 解析某域名的 A 记录列表(排除 DNS 服务器自身行 + IPv6)
resolve_a() {
  nslookup "$1" "$DNS" 2>/dev/null | awk '/^Address: /{print $2}' \
    | grep -v "^${DNS}$" | grep -v ':' | sort -u
}

STEP="${1:-}"
case "$STEP" in
  step1)
    echo "[步骤一] 裸域 ${DOMAIN} 直击 EdgeOne 节点(以 www 当前 A 记录为 EdgeOne 入口)"
    EO_IPS=$(resolve_a "www.${DOMAIN}")
    if [ -z "$EO_IPS" ]; then echo "❌ 解析不到 EdgeOne IP"; exit 2; fi
    pass=0; total=0
    for ip in $EO_IPS; do
      out=$(curl -sI --resolve "${DOMAIN}:443:${ip}" "https://${DOMAIN}" --max-time 8 2>&1 | head -1)
      code=$(echo "$out" | awk '{print $2}')
      total=$((total+1))
      # 200/308 且非 000 视为证书就位
      if [ -n "$code" ] && [ "$code" != "000" ]; then
        echo "  ✅ EdgeOne ${ip} → HTTP ${code}"
        pass=$((pass+1))
      else
        echo "  ❌ EdgeOne ${ip} → ${out:-SNI/证书错误或超时}"
      fi
    done
    if [ "$pass" -gt 0 ]; then
      echo "==> 步骤一判据: 通过(${pass}/${total} 节点返回非证书错误)。裸域证书已就位,可进步骤二。"
      exit 0
    else
      echo "==> 步骤一判据: 未通过(全部节点证书错误/超时)。裸域证书未就位,不得进步骤二。"
      exit 1
    fi
    ;;
  step3)
    echo "[步骤三] 裸域 ${DOMAIN} 强制走 CF 边缘,连测 3 次要求全部 <1s 且非 000"
    CF_IPS=$(resolve_a "$DOMAIN")
    if [ -z "$CF_IPS" ]; then echo "❌ 解析不到 CF 边缘 IP"; exit 2; fi
    # 取一个 CF IPv4
    CF_IP=$(echo "$CF_IPS" | tail -1)
    echo "  CF 边缘 IPv4 = $CF_IP"
    pass=0
    for i in 1 2 3; do
      line=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" \
        --resolve "${DOMAIN}:443:${CF_IP}" "https://${DOMAIN}" --max-time 15)
      code=$(echo "$line" | awk '{print $1}')
      t=$(echo "$line" | awk '{print $2}')
      ok=$(awk -v t="$t" 'BEGIN{print (t<1.0)?1:0}')
      if [ "$code" != "000" ] && [ "$ok" = "1" ]; then
        echo "  ✅ 第${i}次 ${code} ${t}s"
        pass=$((pass+1))
      else
        echo "  ❌ 第${i}次 ${code} ${t}s (需非000且<1s)"
      fi
    done
    if [ "$pass" = "3" ]; then
      echo "==> 步骤三判据: 通过(3/3 全部非000且<1s)。裸域已稳定,Y-37 可结清。"
      exit 0
    else
      echo "==> 步骤三判据: 未通过(${pass}/3)。回源未真正切到 EdgeOne,回步骤二现读 Origin Rule。"
      exit 1
    fi
    ;;
  *)
    echo "用法: bash $0 {step1|step3}" >&2
    exit 64
    ;;
esac
