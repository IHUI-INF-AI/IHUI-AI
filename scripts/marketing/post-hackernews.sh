#!/usr/bin/env bash
# post-hackernews.sh — HackerNews "Show HN" 提交脚本(需 HN_API_TOKEN)
#
# 用法:
#   bash scripts/marketing/post-hackernews.sh [--dry-run]
#
# 前置条件:
#   1. HN_API_TOKEN 或 HN_COOKIE(HN 不公开 API,需用 cookie 或 Algolia API)
#   2. .trae-cn/tmp/marketing-2026-07-28/hackernews-show-hn.md 已写
#
# 重要:HN 反对营销/自我推销,本脚本只完成"技术内容"部分;
#       URL 必须指向 GitHub repo 或 live demo,而非营销页。

set -euo pipefail

# HN 没有官方 API,实际提交用 https://news.ycombinator.com/submit
# 自动化通过 Playwright / Puppeteer 模拟表单提交
# 这里用 Algolia HN Search API 做提交前的内容预检

ALGOLIA_API="https://hn.algolia.com/api/v1"
DRAFT_MD=".trae-cn/tmp/marketing-2026-07-28/hackernews-show-hn.md"

# ==================== 参数 ====================
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      head -15 "$0" | tail -10
      exit 0
      ;;
  esac
done

if [ ! -f "$DRAFT_MD" ]; then
  echo "[FAIL] 找不到 $DRAFT_MD"
  exit 1
fi

# ==================== 解析 .md ====================
echo "============================================================"
echo "  HackerNews Show HN 提交"
echo "============================================================"

HN_TITLE=$(awk '/^### 1\.1 Title/,/^### 1\.2/' "$DRAFT_MD" | grep -v '^### 1\.' | head -1)
HN_URL=$(awk '/^### 1\.2 URL/,/^### 1\.3/' "$DRAFT_MD" | grep -v '^### 1\.' | head -1)
HN_TEXT=$(awk '/^### 1\.3 Text/,/^## 2\./' "$DRAFT_MD" | sed -n '/^```markdown$/,/^```$/p' | sed '1d;$d')

# 字符长度检查
TITLE_LEN=${#HN_TITLE}
TEXT_LEN=${#HN_TEXT}
echo "[INFO] Title: $HN_TITLE"
echo "[INFO] URL: $HN_URL"
echo "[INFO] Title 长度: $TITLE_LEN 字符(HN 限制 80)"
echo "[INFO] Text 长度: $TEXT_LEN 字符"
echo

if [ $TITLE_LEN -gt 80 ]; then
  echo "[WARN] Title 超过 80 字符,HN 会截断"
fi

# ==================== 预检 1:检查 URL 是否已被提交 ====================
echo "[PRECHECK] 检查 URL 是否已被 HN 收录 ..."
HN_SEARCH=$(curl -s "$ALGOLIA_API/search?query=ihui-ai" | head -50)
EXISTING=$(echo "$HN_SEARCH" | grep -oE '"objectID":"[^"]+"' | head -3)

if [ -n "$EXISTING" ]; then
  echo "[INFO] HN 上已有 IHUI-AI 相关讨论:"
  echo "$EXISTING" | sed 's/^/         /'
  echo
  echo "[建议] 复用现有讨论或在评论区补充新内容,避免重复发帖被 down vote"
  echo
fi

# ==================== 预检 2:检查最佳提交时间 ====================
echo "[PRECHECK] 最佳提交时间分析 ..."
# HN 流量峰值:美东 8-10 AM / 12-14 PM / 20-22 PM
# 当前 UTC 时间
UTC_HOUR=$(date -u +%H)
ET_HOUR=$(( (10#$UTC_HOUR - 4 + 24) % 24 ))

if [ $ET_HOUR -ge 8 ] && [ $ET_HOUR -lt 22 ]; then
  echo "[OK] 当前美东时间 $ET_HOUR:00,流量高峰期,适合提交"
elif [ $ET_HOUR -ge 0 ] && [ $ET_HOUR -lt 6 ]; then
  echo "[WARN] 当前美东时间 $ET_HOUR:00,深夜低峰期,建议 8 AM ET 再提交"
else
  echo "[INFO] 当前美东时间 $ET_HOUR:00,中等流量"
fi
echo

# ==================== 预检 3:检查 marketing 关键词 ====================
echo "[PRECHECK] 检查文案中的 marketing 关键词(HN 反感)..."
BAD_WORDS=("best" "amazing" "revolutionary" "incredible" "must-have" "killer" "awesome" "ultimate" "perfect")
HAS_BAD=0
for word in "${BAD_WORDS[@]}"; do
  if echo "$HN_TEXT" | grep -qi "\b$word\b"; then
    echo "  [WARN] 发现 marketing 关键词: $word"
    HAS_BAD=1
  fi
done
if [ $HAS_BAD -eq 0 ]; then
  echo "  [OK] 无 marketing 关键词"
fi
echo

# ==================== DRY RUN ====================
if [ "$DRY_RUN" = true ]; then
  echo "============================================================"
  echo "  [DRY-RUN] 跳过实际提交,以下是预览"
  echo "============================================================"
  echo
  echo "Title: $HN_TITLE"
  echo "URL: $HN_URL"
  echo
  echo "Text 预览(前 800 字符):"
  echo "---"
  echo "${HN_TEXT:0:800}..."
  echo "---"
  echo
  echo "提交步骤(HN 无 API,需手动或 Playwright):"
  echo "  1. 登录 https://news.ycombinator.com/"
  echo "  2. 访问 https://news.ycombinator.com/submit"
  echo "  3. 填入 Title: $HN_TITLE"
  echo "  4. 填入 URL: $HN_URL"
  echo "  5. 点击 'Submit'"
  echo
  exit 0
fi

# ==================== 实际提交 ====================
# HN 没有公开 POST API,提供两种方案:
# 方案 A:手动浏览器提交(推荐,简单可靠)
# 方案 B:Playwright 自动化(高级用户)

echo "[STEP] HN 无公开 API,提供两种提交方式:"
echo
echo "方案 A:手动提交(推荐)"
echo "  1. 登录 https://news.ycombinator.com/"
echo "  2. 访问 https://news.ycombinator.com/submit"
echo "  3. 填入以下信息:"
echo
echo "     Title: $HN_TITLE"
echo "     URL:   $HN_URL"
echo
echo "方案 B:Playwright 自动化(高级)"
echo "  设置 HN_COOKIE 环境变量,运行:node scripts/marketing/post-hn-playwright.mjs"
echo

# 输出到 .env 文件供 Playwright 使用
ENV_FILE=".trae-cn/tmp/marketing-2026-07-28/hn-submit.env"
cat > "$ENV_FILE" <<EOF
HN_TITLE='$HN_TITLE'
HN_URL='$HN_URL'
HN_TEXT='$HN_TEXT'
EOF

echo "[OK] 提交参数已写入 $ENV_FILE"
echo "     Playwright 脚本可读取此文件完成自动化提交"
echo
echo "============================================================"
echo "  提交后 24 小时关注:"
echo "  - 每 30 分钟回复新评论(关键期)"
echo "  - 4 小时后评估 points,调整回复策略"
echo "  - 24 小时后写 .trae-cn/tmp/marketing-2026-07-28/hackernews-results.md"
echo "============================================================"
