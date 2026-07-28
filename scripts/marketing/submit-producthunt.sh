#!/usr/bin/env bash
# submit-producthunt.sh — ProductHunt 提交脚本(需 PH_TOKEN)
#
# 用法:
#   bash scripts/marketing/submit-producthunt.sh [--dry-run]
#
# 前置条件:
#   1. PH_TOKEN(ProductHunt API token,需 Maker 权限)
#   2. PH_USER_ID(Maker 的 user ID)
#   3. .trae-cn/tmp/marketing-2026-07-28/producthunt-submission.md 已写
#
# 重要:ProductHunt 提交通常需要人工最终确认,
#       本脚本只完成 API 自动化部分(创建 draft + 提交 maker comment)。

set -euo pipefail

PH_API="https://api.producthunt.com/v2/api"
DRAFT_MD=".trae-cn/tmp/marketing-2026-07-28/producthunt-submission.md"

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

if [ -z "${PH_TOKEN:-}" ] && [ "$DRY_RUN" = false ]; then
  echo "[FAIL] PH_TOKEN 未设置"
  echo "       1. 登录 https://www.producthunt.com/"
  echo "       2. 访问 https://api.producthunt.com/v2/oauth/applications 创建 App"
  echo "       3. 复制 token 到环境变量:export PH_TOKEN=xxx"
  exit 1
fi

if [ ! -f "$DRAFT_MD" ]; then
  echo "[FAIL] 找不到 $DRAFT_MD"
  exit 1
fi

# ==================== 解析 .md ====================
echo "============================================================"
echo "  ProductHunt 提交脚本"
echo "============================================================"

PH_NAME=$(awk '/^### 1\.1 Name/,/^### 1\.2/' "$DRAFT_MD" | grep -v '^### 1\.' | head -1)
PH_TAGLINE=$(awk '/^### 1\.2 Tagline/,/^### 1\.3/' "$DRAFT_MD" | grep -v '^### 1\.' | head -1)
PH_DESCRIPTION=$(awk '/^### 1\.3 Description/,/^### 1\.4/' "$DRAFT_MD" | sed -n '/^```markdown$/,/^```$/p' | sed '1d;$d')
PH_TOPICS=$(awk '/^### 1\.4 Topics/,/^### 1\.5/' "$DRAFT_MD" | grep -E '^\s*[A-Z]' | head -4 | tr '\n' ',' | sed 's/,$//')
PH_MAKER_COMMENT=$(awk '/^### 1\.5 Maker Comment/,/^### 1\.6/' "$DRAFT_MD" | sed -n '/^```markdown$/,/^```$/p' | sed '1d;$d')

echo "[INFO] Name: $PH_NAME"
echo "[INFO] Tagline: $PH_TAGLINE"
echo "[INFO] Topics: $PH_TOPICS"
echo "[INFO] Description 长度: ${#PH_DESCRIPTION} 字符"
echo "[INFO] Maker Comment 长度: ${#PH_MAKER_COMMENT} 字符"
echo

if [ "$DRY_RUN" = true ]; then
  echo "[DRY-RUN] 跳过实际 API 调用"
  echo "  描述预览(前 500 字符):"
  echo "---"
  echo "${PH_DESCRIPTION:0:500}..."
  echo "---"
  exit 0
fi

# ==================== GraphQL 提交 ====================
echo "[STEP] 通过 GraphQL API 创建 PH post ..."
# ProductHunt v2 GraphQL endpoint
# 完整 mutation 文档:https://api.producthunt.com/v2/docs

PAYLOAD=$(python3 -c "
import json
print(json.dumps({
  'query': '''
    mutation PostCreate(\$input: PostCreateInput!) {
      postCreate(input: \$input) {
        post {
          id
          name
          slug
          url
        }
      }
    }
  ''',
  'variables': {
    'input': {
      'name': '''$PH_NAME''',
      'tagline': '''$PH_TAGLINE''',
      'description': '''$PH_DESCRIPTION''',
      'topics': [t.strip() for t in '''$PH_TOPICS'''.split(',') if t.strip()],
      'url': 'https://ihui.ai',
      'media': [],
      'makerUserIds': [int('''${PH_USER_ID:-0}''')],
    }
  }
}, ensure_ascii=False))
")

RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $PH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$PH_API/graphql")

echo "[INFO] API 响应:"
echo "$RESPONSE" | head -20
echo

POST_ID=$(echo "$RESPONSE" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
POST_URL=$(echo "$RESPONSE" | grep -oE '"url":"[^"]+"' | head -1 | cut -d'"' -f4)

if [ -z "$POST_ID" ]; then
  echo "[FAIL] Post 创建失败,请检查:"
  echo "  1. PH_TOKEN 是否有效"
  echo "  2. PH_USER_ID 是否正确(export PH_USER_ID=xxx)"
  echo "  3. 网络是否能访问 api.producthunt.com"
  echo "  4. PH 是否要求当天发布(Maker 每日只能发 1 个 post)"
  exit 1
fi

echo "[OK] Post 创建: $POST_URL"
echo

# ==================== 发布 Maker Comment ====================
echo "[STEP] 发布 Maker Comment ..."

COMMENT_PAYLOAD=$(python3 -c "
import json
print(json.dumps({
  'query': '''
    mutation CommentCreate(\$input: CommentCreateInput!) {
      commentCreate(input: \$input) {
        comment {
          id
          body
        }
      }
    }
  ''',
  'variables': {
    'input': {
      'postId': '$POST_ID',
      'body': '''$PH_MAKER_COMMENT''',
    }
  }
}, ensure_ascii=False))
")

COMMENT_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $PH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$COMMENT_PAYLOAD" \
  "$PH_API/graphql")

if echo "$COMMENT_RESPONSE" | grep -q '"comment"'; then
  echo "[OK] Maker Comment 已发布"
else
  echo "[WARN] Maker Comment 发布失败,响应: $COMMENT_RESPONSE" | head -3
fi

echo
echo "============================================================"
echo "  ✅ 完成!"
echo "============================================================"
echo "  PH Post URL: $POST_URL"
echo
echo "  ⚠️ 重要:"
echo "  1. 立即在浏览器打开 $POST_URL 确认 post 状态"
echo "  2. 如果是 draft,手动点 'Publish'"
echo "  3. 接下来 24 小时密切回复评论(目标 30+ 条)"
echo "  4. 推文 + 微博 + V2EX 同步"
echo "============================================================"
