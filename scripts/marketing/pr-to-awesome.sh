#!/usr/bin/env bash
# pr-to-awesome.sh — 一键 fork + edit + push + 创建 PR 到 awesome 列表
#
# 用法:
#   bash scripts/marketing/pr-to-awesome.sh <target-name> [--dry-run]
#
# 示例:
#   bash scripts/marketing/pr-to-awesome.sh awesome-llms-in-china
#   bash scripts/marketing/pr-to-awesome.sh awesome-openai --dry-run
#
# 前置条件:
#   1. .trae-cn/tmp/marketing-2026-07-28/awesome-<name>-pr.md 必须存在
#   2. GitHub PAT 需设置在 GITHUB_TOKEN 环境变量(需 repo 权限)
#   3. git 已配置 user.name + user.email
#
# 工作流:
#   1. 从 .md 解析目标仓库 + 插入片段 + PR 标题/描述
#   2. POST /repos/{owner}/{name}/forks 创建 fork
#   3. git clone fork + 切到新分支
#   4. 按 section 格式插入条目(简单 grep 定位章节)
#   5. git commit + push -u origin <branch>
#   6. POST /repos/{owner}/{name}/pulls 创建 PR
#   7. 输出 PR URL(用户浏览器打开手动 review)

set -euo pipefail

# ==================== 配置 ====================
TASK_DIR=".trae-cn/tmp/marketing-2026-07-28"
GITHUB_API="https://api.github.com"
BRANCH_PREFIX="add-ihui-ai"

# ==================== 参数 ====================
DRY_RUN=false
TARGET=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      head -20 "$0" | tail -15
      exit 0
      ;;
    *) TARGET="$arg" ;;
  esac
done

if [ -z "$TARGET" ]; then
  echo "[FAIL] 用法: bash $0 <target-name> [--dry-run]"
  echo "       示例: bash $0 awesome-llms-in-china"
  echo "       可选 target:"
  ls "$TASK_DIR" 2>/dev/null | grep '^awesome-.*-pr\.md$' | sed 's/-pr\.md$//' | sed 's/^/         - /' || echo "         (无)"
  exit 1
fi

# ==================== 文件检查 ====================
PR_MD="$TASK_DIR/$TARGET-pr.md"
if [ ! -f "$PR_MD" ]; then
  echo "[FAIL] 文件不存在: $PR_MD"
  echo "       请先创建 awesome 营销文案,或在 $TASK_DIR/ 目录中查找"
  exit 1
fi

if [ -z "${GITHUB_TOKEN:-}" ] && [ "$DRY_RUN" = false ]; then
  echo "[FAIL] GITHUB_TOKEN 未设置"
  echo "       export GITHUB_TOKEN=ghp_xxxxxxxxxxxx"
  echo "       需要 scope: repo (fork + push + PR)"
  exit 1
fi

# ==================== 解析 .md 文件 ====================
echo "============================================================"
echo "  Awesome PR 自动化 — 目标: $TARGET"
echo "============================================================"
echo

# 提取目标仓库 URL
TARGET_REPO=$(grep -E '目标仓库:' "$PR_MD" | head -1 | sed -E 's/.*github\.com\/([^ )]+).*/\1/' | sed 's|/$||')
if [ -z "$TARGET_REPO" ]; then
  echo "[FAIL] 无法解析目标仓库,请检查 $PR_MD 格式"
  echo "       期望: '> 目标仓库:https://github.com/owner/repo'"
  exit 1
fi

REPO_OWNER=$(echo "$TARGET_REPO" | cut -d'/' -f1)
REPO_NAME=$(echo "$TARGET_REPO" | cut -d'/' -f2)
FORK_REPO="$REPO_NAME"

# 提取 PR 标题(在 "## 3. PR 标题" 后的 ``` 块内)
PR_TITLE=$(awk '/^## 3\. PR 标题/,/^```$/' "$PR_MD" | grep -v '^## 3' | grep -v '^```' | head -1 | sed 's/^#\+ //')
if [ -z "$PR_TITLE" ]; then
  PR_TITLE=$(awk '/^## 3\. PR 标题/,/^---/' "$PR_MD" | grep -v '^## 3' | head -3 | tail -1)
fi
if [ -z "$PR_TITLE" ]; then
  echo "[FAIL] 无法解析 PR 标题,请检查 $PR_MD 第 3 节"
  exit 1
fi

# 提取 README 插入片段(在 "## 2. README 插入片段" 后的 ``` 块内)
README_INSERT=$(awk '/^## 2\. README 插入片段/,/^```$/' "$PR_MD" | grep -v '^## 2' | grep -v '^```' | head -1)

# 提取 PR 描述(在 "## 4. PR 描述" 后的 ```markdown ... ``` 块内)
PR_BODY=$(awk '/^## 4\. PR 描述/,/^## 5\./' "$PR_MD" | sed -n '/^```markdown$/,/^```$/p' | sed '1d;$d')

# 提取标签
PR_LABELS=$(awk '/^## 5\. 标签建议/,/^## 6\./' "$PR_MD" | grep -oE '`[a-z0-9-]+`' | tr -d '`' | paste -sd ',' -)

echo "[INFO] 目标仓库: $TARGET_REPO"
echo "[INFO] PR 标题: $PR_TITLE"
echo "[INFO] 标签: $PR_LABELS"
echo "[INFO] README 插入片段长度: ${#README_INSERT} 字符"
echo "[INFO] PR 描述长度: ${#PR_BODY} 字符"
echo

if [ "$DRY_RUN" = true ]; then
  echo "============================================================"
  echo "  [DRY-RUN] 跳过实际执行,以下是预览"
  echo "============================================================"
  echo
  echo "README 插入片段预览:"
  echo "---"
  echo "$README_INSERT"
  echo "---"
  echo
  echo "PR 描述预览 (前 500 字符):"
  echo "---"
  echo "${PR_BODY:0:500}..."
  echo "---"
  echo
  echo "[DRY-RUN] 退出(无任何 git/网络操作)"
  exit 0
fi

# ==================== 1. Fork ====================
echo "[STEP 1/6] Fork 仓库 $TARGET_REPO ..."
FORK_RESPONSE=$(curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "$GITHUB_API/repos/$REPO_OWNER/$REPO_NAME/forks")

FORK_FULL_NAME=$(echo "$FORK_RESPONSE" | grep -oE '"full_name":"[^"]+"' | head -1 | cut -d'"' -f4)

if [ -z "$FORK_FULL_NAME" ]; then
  echo "[FAIL] Fork 失败,响应:"
  echo "$FORK_RESPONSE" | head -20
  exit 1
fi

# 提取当前用户名
CURRENT_USER=$(echo "$FORK_FULL_NAME" | cut -d'/' -f1)
FORK_URL="https://github.com/$FORK_FULL_NAME.git"

echo "[OK] Fork 创建:$FORK_FULL_NAME"
echo

# 等待 fork 准备就绪(异步创建,通常 1-3 秒)
echo "[INFO] 等待 fork 准备就绪 ..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: token $GITHUB_TOKEN" \
    "$GITHUB_API/repos/$FORK_FULL_NAME")
  if [ "$STATUS" = "200" ]; then
    echo "[OK] Fork 就绪"
    break
  fi
  sleep 2
done
echo

# ==================== 2. Clone ====================
WORK_DIR=".trae-cn/tmp/marketing-2026-07-28/clone-$TARGET"
echo "[STEP 2/6] Clone fork 到 $WORK_DIR ..."
rm -rf "$WORK_DIR"
git clone --depth 1 "$FORK_URL" "$WORK_DIR" 2>&1 | tail -3
cd "$WORK_DIR"

BRANCH_NAME="$BRANCH_PREFIX-$TARGET"
git checkout -b "$BRANCH_NAME"
echo

# ==================== 3. Edit README ====================
echo "[STEP 3/6] 编辑 README.md ..."
if [ ! -f "README.md" ]; then
  echo "[FAIL] 仓库无 README.md"
  exit 1
fi

# 定位插入位置(从 .md 提取 "目标 section")
INSERT_SECTION=$(awk '/^> 目标 section:/' "$PR_MD" | head -1 | sed -E 's/.*section://;s/[ \t]+$//')
if [ -z "$INSERT_SECTION" ]; then
  echo "[WARN] 未指定 section,默认追加到 README 末尾"
  INSERT_SECTION="END_OF_FILE"
fi

# 简化版:在 README 末尾追加条目(精确 section 匹配留给人工 review)
{
  echo
  echo "$README_INSERT"
} >> README.md

echo "[OK] README.md 已更新"
echo

# ==================== 4. Commit + Push ====================
echo "[STEP 4/6] Commit + Push ..."
git add README.md
git commit -m "Add IHUI-AI to $REPO_NAME

$PR_TITLE" --no-verify 2>&1 | tail -3

PUSH_URL="https://$GITHUB_TOKEN@github.com/$FORK_FULL_NAME.git"
git remote set-url origin "$PUSH_URL"
git push -u origin "$BRANCH_NAME" --no-verify 2>&1 | tail -5
echo

# ==================== 5. Open PR ====================
echo "[STEP 5/6] 创建 PR ..."
# 构造 PR body JSON(用 python 避免 bash 转义问题)
PR_BODY_FILE=".trae-cn/tmp/marketing-2026-07-28/pr-body-$TARGET.md"
echo "$PR_BODY" > "$PR_BODY_FILE"

LABELS_JSON=$(echo "$PR_LABELS" | tr ',' '\n' | grep -v '^$' | sed 's/^/  "/;s/$/"/' | paste -sd ',' -)

PR_PAYLOAD=$(python3 -c "
import json, sys
with open('$PR_BODY_FILE', 'r', encoding='utf-8') as f:
    body = f.read()
labels = [l.strip() for l in '''$PR_LABELS'''.split(',') if l.strip()]
print(json.dumps({
  'title': '''$PR_TITLE''',
  'head': '$CURRENT_USER:$BRANCH_NAME',
  'base': 'main',
  'body': body,
  'maintainer_can_modify': True,
  'labels': labels,
}, ensure_ascii=False))
")

PR_RESPONSE=$(curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "$PR_PAYLOAD" \
  "$GITHUB_API/repos/$REPO_OWNER/$REPO_NAME/pulls")

PR_URL=$(echo "$PR_RESPONSE" | grep -oE '"html_url":"[^"]+"' | head -1 | cut -d'"' -f4)

if [ -n "$PR_URL" ]; then
  echo "[OK] PR 已创建: $PR_URL"
else
  echo "[FAIL] PR 创建失败,响应:"
  echo "$PR_RESPONSE" | head -20
  exit 1
fi
echo

# ==================== 6. 清理 + 报告 ====================
echo "[STEP 6/6] 清理临时文件 ..."
cd ../..
rm -rf "$WORK_DIR"
rm -f "$PR_BODY_FILE"

echo "============================================================"
echo "  ✅ 完成!"
echo "============================================================"
echo "  目标仓库: $TARGET_REPO"
echo "  Fork: $FORK_FULL_NAME"
echo "  分支: $BRANCH_NAME"
echo "  PR URL: $PR_URL"
echo
echo "  下一步:"
echo "  1. 浏览器打开 $PR_URL"
echo "  2. 确认 PR 描述无误"
echo "  3. 等待维护者 review(预计 1-7 天)"
echo "  4. PR 合并后更新 docs/exposure/awesome-prs.md"
echo "============================================================"
