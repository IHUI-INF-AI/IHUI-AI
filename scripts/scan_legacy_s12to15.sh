#!/usr/bin/env bash
set -uo pipefail
ARCHIVE="/d/历史项目存档"
ZHS_MINI="/d/历史项目存档/zhs_app-ZZ/Ai-WXMiniVue"
EDU_CLIENT="/d/历史项目存档/edu client"
LJD="/d/历史项目存档/ljd-交接文件"
OUT="/g/IHUI-AI/docs/H_LEGACY_FULL_SCAN.md"
emit() { printf '%s\n' "$*" >> "$OUT"; }

emit ""
emit "## 13. 配置 / 凭证 / 证书清单"
emit ""
emit "### application*.yml / application*.properties"
find "$ARCHIVE" \( -name "application*.yml" -o -name "application*.yaml" -o -name "application*.properties" \) 2>/dev/null | grep -v node_modules | sort | while read -r f; do
  rel=${f#$ARCHIVE/}
  emit "- \`$rel\`"
done | head -100
emit ""
emit "### .env / .env.*"
find "$ARCHIVE" -maxdepth 6 \( -name ".env" -o -name ".env.*" \) 2>/dev/null | grep -v node_modules | grep -v ".git/" | sort | while read -r f; do
  rel=${f#$ARCHIVE/}
  emit "- \`$rel\`"
done | head -50
emit ""
emit "### 证书 (.jks / .p12 / .pem / .crt / .key)"
find "$ARCHIVE" \( -name "*.jks" -o -name "*.p12" -o -name "*.pem" -o -name "*.crt" -o -name "*.key" -o -name "*.cert" \) 2>/dev/null | grep -v node_modules | sort | while read -r f; do
  rel=${f#$ARCHIVE/}
  emit "- \`$rel\`"
done | head -50
emit ""
emit "### 微信 / VAPID / AI 厂商密钥配置文件"
find "$ARCHIVE" \( -iname "*vapid*" -o -iname "*wechat*" -o -iname "*weixin*" -o -iname "*wx*config*" \) 2>/dev/null | grep -v node_modules | grep -v ".git/" | sort | while read -r f; do
  rel=${f#$ARCHIVE/}
  emit "- \`$rel\`"
done | head -50
emit ""

emit "## 14. 资源文件 (data / json / static)"
emit ""
emit "### edu client/data JSON"
find "$EDU_CLIENT/data" -name "*.json" 2>/dev/null | sort | while read -r f; do
  rel=${f#$EDU_CLIENT/}
  emit "- \`$rel\`"
done | head -50
emit ""
emit "### Ai-WXMiniVue static 资源 (目录树前 30)"
find "$ZHS_MINI/src/static" -maxdepth 2 -type d 2>/dev/null | sort | while read -r f; do
  rel=${f#$ZHS_MINI/}
  emit "- \`$rel/\`"
done | head -30
n_static=$(find "$ZHS_MINI/src/static" -type f 2>/dev/null | wc -l)
emit "- 静态资源文件总数: $n_static"
emit ""
emit "### edu client/videos"
ls -d "$EDU_CLIENT/videos" 2>/dev/null && find "$EDU_CLIENT/videos" -maxdepth 2 -type d 2>/dev/null | head -10 | while read -r f; do
  rel=${f#$EDU_CLIENT/}
  emit "- \`$rel/\`"
done
emit ""

emit "## 15. 前端路由配置文件"
emit ""
EDU_WEB="/d/历史项目存档/edu client/web/web"
EDU_ADMIN="/d/历史项目存档/edu client/admin/admin"
emit "### edu client/web"
find "$EDU_WEB/src" -name "router*" -o -name "routes*" 2>/dev/null | head -10 | while read -r f; do
  rel=${f#$EDU_WEB/}
  emit "- \`$rel\`"
done
emit "### edu client/admin"
find "$EDU_ADMIN/src" -name "router*" -o -name "routes*" 2>/dev/null | head -10 | while read -r f; do
  rel=${f#$EDU_ADMIN/}
  emit "- \`$rel\`"
done
emit "### ihui-ai-admin-frontend"
find "/d/历史项目存档/ihui-ai-admin-frontend/src" -name "router*" -o -name "routes*" 2>/dev/null | head -10 | while read -r f; do
  rel=${f#"/d/历史项目存档/ihui-ai-admin-frontend/"}
  emit "- \`$rel\`"
done
emit ""

# Statistics
emit "---"
emit ""
emit "## 摘要统计 (跨所有历史项目)"
emit ""
n_sql=$(find "$ARCHIVE" -name "*.sql" 2>/dev/null | wc -l)
n_yml=$(find "$ARCHIVE" \( -name "application*.yml" -o -name "application*.yaml" -o -name "application*.properties" \) 2>/dev/null | grep -v node_modules | wc -l)
n_env=$(find "$ARCHIVE" -maxdepth 6 \( -name ".env" -o -name ".env.*" \) 2>/dev/null | grep -v node_modules | grep -v ".git/" | wc -l)
n_cert=$(find "$ARCHIVE" \( -name "*.jks" -o -name "*.p12" -o -name "*.pem" -o -name "*.crt" -o -name "*.key" -o -name "*.cert" \) 2>/dev/null | grep -v node_modules | wc -l)
n_tables=$(grep -rh -iE "CREATE TABLE" "$ARCHIVE" --include="*.sql" 2>/dev/null | grep -oiE "CREATE TABLE[[:space:]]+(IF NOT EXISTS[[:space:]]+)?[\`\"]?[a-zA-Z0-9_]+[\`\"]?" | sed -E 's/[`"]//g;s/CREATE TABLE[[:space:]]*//I;s/IF NOT EXISTS[[:space:]]*//I' | tr '[:upper:]' '[:lower:]' | sort -u | wc -l)

emit "| 维度 | 数量 |"
emit "|------|------|"
emit "| SQL 脚本文件总数 | $n_sql |"
emit "| application 配置文件 | $n_yml |"
emit "| .env 文件 | $n_env |"
emit "| 证书 (.jks/.p12/.pem/.crt/.key) | $n_cert |"
emit "| CREATE TABLE 唯一表名 | $n_tables |"
emit ""

# CREATE TABLE 表名清单
emit "## 12. CREATE TABLE 表名清单 (跨所有历史项目)"
emit ""
emit '```'
grep -rh -iE "CREATE TABLE" "$ARCHIVE" --include="*.sql" 2>/dev/null | \
  grep -oiE "CREATE TABLE[[:space:]]+(IF NOT EXISTS[[:space:]]+)?[\`\"]?[a-zA-Z0-9_]+[\`\"]?" | \
  sed -E 's/[`"]//g;s/CREATE TABLE[[:space:]]*//I;s/IF NOT EXISTS[[:space:]]*//I' | \
  tr '[:upper:]' '[:lower:]' | sort -u | head -500
emit '```'
emit ""
echo "DONE sections 12-15"
