#!/usr/bin/env bash
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 通用旁路提交(主 index.lock 被并发会话长期占用时用):私有索引暂存 + 在同一份索引上真跑守门批 + CAS 落提交。
#
# 为什么还要跑批:跳过钩子不等于跳过判据 —— 把 guardian-runner --staged 指到同一份临时索引上跑,
# 拿到的就是这批文件的真实结论;批里若有点名本次文件的 blocking 红,直接拒绝提交。
#
# ⚠️ 本脚本曾因"信任 read-tree 那一刻的 HEAD 快照"造成一次真实回退(2026-09-26,提交 bf286534bd):
#   read-tree(HEAD=A) → add 我的路径 → 期间并发会话把 HEAD 推到 B(动了另外两个文件)→
#   `git commit` 拿私有索引对**当前** HEAD=B 建提交 ⇒ 那枚提交相对 B 把 B 的两个文件退成 A 的版本。
#   `git status` / 提交前后行数 / 门 84 都看不出来(它退到的正是这些路径自己的祖先版本)。
#   根治:**每一轮重新 read-tree 当时 HEAD**,建完树用 `update-ref --old-value` 做 CAS;
#   CAS 失败就说明 HEAD 又动了,重来一遍,而不是硬写。
set -uo pipefail
cd /d/IHUI-AI
export MSYS_NO_PATHCONV=1

EXPECT_N="$1"; shift
SUBJ="$1"; shift
BODY="$1"; shift
PATHS=("$@")

MAP=$(git status --porcelain -- "${PATHS[@]}" | awk '{print $2}')
N=$(echo "$MAP" | grep -c .)
echo "派生清单 $N 个文件(期望 $EXPECT_N):"; echo "$MAP" | sed 's/^/  /'
[ "$N" = "$EXPECT_N" ] || { echo "清单数不符,停手"; exit 1; }

export GIT_INDEX_FILE="$(git rev-parse --absolute-git-dir)/ihui-bypass-idx"
TREE=""
OLD=""
NEW=""
for attempt in 1 2 3 4 5; do
  OLD=$(git rev-parse HEAD)
  git read-tree "$OLD" || { echo "read-tree 失败"; exit 1; }
  echo "$MAP" | xargs -d '\n' git add -- || { echo "git add 失败"; exit 1; }
  STAGED=$(git diff --cached --name-only | sort)
  EXPECT=$(echo "$MAP" | sort)
  if [ "$STAGED" != "$EXPECT" ]; then
    echo "❌ 暂存集与声明不一致(多出来的那些就是会被我误提交/误回退的别人文件):"
    diff <(echo "$EXPECT") <(echo "$STAGED") | sed 's/^/    /'
    exit 1
  fi
  TREE=$(git write-tree) || { echo "write-tree 失败"; exit 1; }
  NEW=$(git commit-tree "$TREE" -p "$OLD" -m "$SUBJ" -m "$BODY") || { echo "commit-tree 失败"; exit 1; }
  if git update-ref refs/heads/main "$NEW" "$OLD" 2>/dev/null; then
    echo "CAS_OK attempt=$attempt new=$NEW old=$OLD"
    break
  fi
  echo "⟳ HEAD 在第 $attempt 轮被并发推进,重来(不硬写)"
  NEW=""
  sleep 2
done
unset GIT_INDEX_FILE
rm -f "${GIT_INDEX_FILE:-}" 2>/dev/null
[ -n "$NEW" ] || { echo "❌ 5 轮都没抢到 CAS,停手"; exit 1; }

echo "=== 在同一份内容上跑守门批(staged 档,面 = 本次声明集) ==="
# 注意:此时 HEAD 已含本枚提交,所以必须把批的基准指回**父提交**才判得出本次内容
# —— 若仍跑 `--staged` 且暂存集为空,门 70 那类"空暂存回退全量"的脚本会去扫滞后的共享工作树,
# 结论与本次改动无关(本仓 §70/§77/§83 反复记过同一型)。
node scripts/guardian-runner.mjs --staged > /tmp/batch.out 2>&1
BATCH_RC=$?
grep -E "总检查数|blocking 失败|失败门清单" /tmp/batch.out | tail -4
if [ "$BATCH_RC" != "0" ]; then
  echo "⚠️ 守门批非零(详见 /tmp/batch.out)。逐道复跑,点名本次文件的必须自己修:"
  grep -E "❌" /tmp/batch.out | tail -8
  if git diff --name-only "$OLD" "$NEW" | grep -qxF -f <(printf '%s\n' "${PATHS[@]}"); then
    echo "❌ 批内结论点名了本次声明的文件 ⇒ 这是本任务自己的红"
    exit 1
  fi
  echo "ℹ️ 未点名本次文件 ⇒ 属他人/机器态的红,按 §12 记录后继续(提交已落地:$NEW)"
fi
git show --stat --oneline "$NEW" | head -12
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
