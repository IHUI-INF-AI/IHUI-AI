#!/usr/bin/env bash
# create-releases.sh — 一键创建 5 端 GitHub Release
#
# 用法:
#   bash scripts/marketing/create-releases.sh <version> [--only <app>] [--dry-run]
#
# 示例:
#   bash scripts/marketing/create-releases.sh v1.1.0
#   bash scripts/marketing/create-releases.sh v1.1.0 --only desktop
#   bash scripts/marketing/create-releases.sh v1.1.0 --dry-run
#
# 前置条件:
#   1. GITHUB_TOKEN(需 repo 权限)
#   2. 各端 CI 全绿(否则 release 会失败)
#   3. .trae-cn/tmp/marketing-2026-07-28/github-release-draft.md 已写

set -euo pipefail

GITHUB_API="https://api.github.com"
REPO="IHUI-INF-AI/IHUI-AI"

# ==================== 参数 ====================
VERSION=""
ONLY=""
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --only) shift; ONLY="${1:-}" ;;
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      head -20 "$0" | tail -15
      exit 0
      ;;
    *) VERSION="$arg" ;;
  esac
done

if [ -z "$VERSION" ]; then
  echo "[FAIL] 用法: bash $0 <version> [--only <app>] [--dry-run]"
  echo "       示例: bash $0 v1.1.0"
  exit 1
fi

if [ -z "${GITHUB_TOKEN:-}" ] && [ "$DRY_RUN" = false ]; then
  echo "[FAIL] GITHUB_TOKEN 未设置"
  echo "       export GITHUB_TOKEN=ghp_xxxxxxxxxxxx"
  exit 1
fi

# ==================== 配置 ====================
APPS=(
  "web:apps/web"
  "api:apps/api"
  "extension:apps/extension"
  "desktop:apps/desktop"
  "ai-service:apps/ai-service"
)

if [ -n "$ONLY" ]; then
  APPS=()
  for app in "${ORIG_APPS[@]}"; do
    [ "${app%%:*}" = "$ONLY" ] && APPS+=("$app")
  done
  if [ ${#APPS[@]} -eq 0 ]; then
    echo "[FAIL] --only $ONLY 无效,可选: web / api / extension / desktop / ai-service"
    exit 1
  fi
fi

# ==================== 读取 release notes ====================
DRAFT_MD=".trae-cn/tmp/marketing-2026-07-28/github-release-draft.md"
if [ ! -f "$DRAFT_MD" ]; then
  echo "[FAIL] 找不到 $DRAFT_MD"
  exit 1
fi

RELEASE_BODY=$(awk '/^### 1\.1 Release Notes/,/^### 1\.2/' "$DRAFT_MD" | sed -n '/^```markdown$/,/^```$/p' | sed '1d;$d')
RELEASE_TITLE=$(awk '/^### 1\.2 Release Title/,/^### 1\.3/' "$DRAFT_MD" | grep -v '^### 1\.' | head -1)

if [ -z "$RELEASE_BODY" ]; then
  echo "[FAIL] 无法从 $DRAFT_MD 解析 Release Notes"
  exit 1
fi

echo "============================================================"
echo "  GitHub Release 自动化"
echo "============================================================"
echo "  版本: $VERSION"
echo "  仓库: $REPO"
echo "  Release 标题: $RELEASE_TITLE"
echo "  Release Body 长度: ${#RELEASE_BODY} 字符"
echo "  目标端: ${APPS[@]}"
echo

if [ "$DRY_RUN" = true ]; then
  echo "[DRY-RUN] 跳过实际执行"
  echo "  Release Body 预览(前 500 字符):"
  echo "---"
  echo "${RELEASE_BODY:0:500}..."
  echo "---"
  exit 0
fi

# ==================== 主流程 ====================
for app_def in "${APPS[@]}"; do
  APP_NAME="${app_def%%:*}"
  APP_PATH="${app_def##*:}"

  echo "[STEP] 创建 $APP_NAME ($VERSION) release ..."

  # 1. 检查 tag 是否已存在
  TAG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: token $GITHUB_TOKEN" \
    "$GITHUB_API/repos/$REPO/git/refs/tags/$VERSION")
  if [ "$TAG_STATUS" = "200" ]; then
    echo "[INFO] Tag $VERSION 已存在,跳过创建"
  else
    # 2. 创建 annotated tag(指向 main HEAD)
    MAIN_SHA=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
      "$GITHUB_API/repos/$REPO/git/refs/heads/main" | grep -oE '"sha":"[^"]+"' | head -1 | cut -d'"' -f4)

    if [ -z "$MAIN_SHA" ]; then
      echo "[FAIL] 无法获取 main 分支 HEAD"
      exit 1
    fi

    TAG_PAYLOAD=$(python3 -c "
import json
print(json.dumps({
  'ref': 'refs/tags/$VERSION',
  'sha': '$MAIN_SHA',
}, ensure_ascii=False))
")

    TAG_RESPONSE=$(curl -s -X POST \
      -H "Authorization: token $GITHUB_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$TAG_PAYLOAD" \
      "$GITHUB_API/repos/$REPO/git/refs")

    if echo "$TAG_RESPONSE" | grep -q '"ref"'; then
      echo "[OK] Tag $VERSION 已创建"
    else
      echo "[FAIL] Tag 创建失败: $TAG_RESPONSE"
      exit 1
    fi
  fi

  # 3. 创建 release
  RELEASE_PAYLOAD=$(python3 -c "
import json
print(json.dumps({
  'tag_name': '$VERSION',
  'name': '$RELEASE_TITLE [$APP_NAME]',
  'body': '''$RELEASE_BODY''',
  'draft': False,
  'prerelease': False,
  'target_commitish': 'main',
}, ensure_ascii=False))
")

  RELEASE_RESPONSE=$(curl -s -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept: application/vnd.github.v3+json" \
    -d "$RELEASE_PAYLOAD" \
    "$GITHUB_API/repos/$REPO/releases")

  RELEASE_URL=$(echo "$RELEASE_RESPONSE" | grep -oE '"html_url":"[^"]+"' | head -1 | cut -d'"' -f4)

  if [ -n "$RELEASE_URL" ]; then
    echo "[OK] $APP_NAME release 创建: $RELEASE_URL"
  else
    # 可能是 release 已存在,尝试更新
    if echo "$RELEASE_RESPONSE" | grep -q "already_exists"; then
      echo "[INFO] Release $VERSION 已存在,跳过"
    else
      echo "[WARN] Release 创建失败,响应: $RELEASE_RESPONSE" | head -3
    fi
  fi
  echo
done

echo "============================================================"
echo "  ✅ 完成!"
echo "============================================================"
echo "  请在以下页面验证:"
echo "  https://github.com/$REPO/releases/tag/$VERSION"
echo
echo "  下一步:"
echo "  1. 浏览器访问 release 页面"
echo "  2. 检查 release notes 渲染"
echo "  3. 检查资产文件(若有)"
echo "  4. 推文 + 微博 + V2EX 同步"
echo "============================================================"
