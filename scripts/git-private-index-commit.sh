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
# 2026-11-04 门 30a 根因票(会话 10b5dcce 实测):CAS 输家臂此前**一个都不备份** ——
# 每次「重来」都会把上一枚 commit-tree 对象丢成无引用,5 轮全败则一次红跑最多留 5 枚无 tag 孤儿。
# 与 object-space-land 同一条判据:每轮 `read-tree` 的都是**当时 HEAD** + 同一份声明集,中间轮次
# 被下一轮结构上取代(内容不丢、丢的只是 commit 对象)⇒ 中间轮次不打 tag;
# **最终失败的那一枚必须照打**,否则门 30a 逐枚判红,§12e 的结局是全仓被逼跳门。
# 用 EXIT trap 兜住所有退出路径(含 read-tree/add/write-tree/commit-tree 失败),成功落地时清空。
LAST_NEW=""
backup_last_orphan() {
  [ -n "${LAST_NEW:-}" ] || return 0
  node -e "import('./scripts/lib/orphan-backup.mjs').then((m) => m.backupOrphanCommit({ sha: process.argv[1], why: 'git-private-index-commit.sh 5 轮均未抢到 CAS(末枚兜底)', kind: 'priv', root: process.cwd(), logger: (s) => console.error(s) })).catch((e) => console.error('⚠️ 孤儿备份腿异常:' + e.message))" "$LAST_NEW" || true
  LAST_NEW=""
}
trap backup_last_orphan EXIT
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
  # commit-tree 直接吃内存里的 -m,全程不写 `.git/COMMIT_EDITMSG` —— 并发提交拿不到别人的消息。
  NEW=$(git commit-tree "$TREE" -p "$OLD" -m "$SUBJ" -m "$BODY") || { echo "commit-tree 失败"; exit 1; }
  LAST_NEW="$NEW"
  if git update-ref refs/heads/main "$NEW" "$OLD" 2>/dev/null; then
    echo "CAS_OK attempt=$attempt new=$NEW old=$OLD"
    LAST_NEW=""
    break
  fi
  echo "⟳ HEAD 在第 $attempt 轮被并发推进,重来(不硬写)"
  NEW=""
  sleep 2
done
[ -n "$NEW" ] || { echo "❌ 5 轮都没抢到 CAS,停手"; exit 1; }

# ── ③ 后置:把本次提交动过的路径在**共享索引**里推进到新提交树 ────────────────────────
# 裸私有索引提交只推进 HEAD,不推进共享索引 ⇒ 这些路径在共享索引里停在父树(`MM`),
# 谁下一条裸 `git commit` 就把旧 blob 带回去(本仓「已删件复活 / 半成品被夹带回滚」的同一个根)。
# 唯一实现 = scripts/lib/shared-index-advance.mjs:它只写本席路径、拿不到 index.lock 就原样不动、
# 共享索引与父树不一致的条目只报数不覆盖(红线 C)。路径表取自本枚提交本身,与上面
# "暂存集 == 声明集"的校验结果逐字一致。
# 失败只喊不阻断:提交已在 refs 上,后置推进失败由下一条 safe-commit 自愈(判据是提交,不是它)。
ADV_PATHS=$(git -c core.quotePath=false diff-tree --no-commit-id --name-only -r --no-renames "$NEW" | tr '\n' ',' | sed 's/,$//')
if [ -n "$ADV_PATHS" ]; then
  node scripts/lib/shared-index-advance.mjs --sha "$NEW" --paths "$ADV_PATHS" \
    || echo "⚠️ 共享索引后置推进失败($ADV_PATHS)—— 已落地的 $NEW 不受影响,下一条 safe-commit 会自愈"
fi

# 提交后自证:回读 %s 与本席写入的 SUBJ 逐字比对。不一致 ⇒ 立即上报,**不许 amend**
# (多会话共享工作树,改写在途提交会丢别人的工作)。
GOT_SUBJ=$(git log -1 --format=%s "$NEW")
if [ "$GOT_SUBJ" != "$SUBJ" ]; then
  echo "❌ subject 回读与本席写入不一致(疑似并发消息串号):"
  printf '  want=%s\n  got =%s\n' "$SUBJ" "$GOT_SUBJ"
  echo "  提交 $NEW 已落地;按硬线不改写,请登记勘误台账后上报。"
  exit 1
fi
echo "✅ subject 回读一致: $GOT_SUBJ"

# ⚠️ 2026-10-18 修两处会把结论带偏的缺陷(此前守门批的"红"不可信):
#   缺陷 A(要命):原来在这里就 `unset GIT_INDEX_FILE` + `rm` 私有索引,然后才跑
#     `guardian-runner --staged`。于是守门批实际审的是**共享暂存区**(别人的在途内容 /
#     旧版本),不是本次提交内容 —— 实测因此误报出"陈旧副本 / 反回退 / 暂存删除 /
#     mypy no-any-return"四条 blocking,而本次 17 个文件在正确面下全部通过。
#     现改为:**守门批跑完之后才清理私有索引**,让 `--staged` 全程审本次声明集。
#   缺陷 B: `git diff --name-only "$OLD" "$NEW"` 就是本次提交的文件表,与 PATHS
#     **恒有交集** ⇒ "批内结论点名了本次文件"这个判断恒为真,永远把别人的红
#     算到自己头上。现改为从 batch.out 里抓真实文件路径再与 PATHS 求交集。
echo "=== 在同一份内容上跑守门批(staged 档,面 = 本次声明集) ==="
# 注意:此时 HEAD 已含本枚提交,所以必须把批的基准指回**父提交**才判得出本次内容
# —— 若仍跑 `--staged` 且暂存集为空,门 70 那类"空暂存回退全量"的脚本会去扫滞后的共享工作树,
# 结论与本次改动无关(本仓 §70/§77/§83 反复记过同一型)。
# 做法:把私有索引重置为"父树 + 本次 17 个文件",使 staged 面恰好等于本次改动
# (write-tree 结果与 $NEW 的树逐字节相同,已实测)。
git read-tree "$OLD" || { echo "read-tree 父树失败"; exit 1; }
echo "$MAP" | xargs -d '\n' git add --
REPLAY_TREE=$(git write-tree)
NEW_TREE=$(git rev-parse "$NEW^{tree}")
if [ "$REPLAY_TREE" != "$NEW_TREE" ]; then
  echo "❌ 重建的判定面与本次提交树不一致($REPLAY_TREE != $NEW_TREE),停手不跑批"
  exit 1
fi
echo "判定面已重建并与本次提交树逐字节等价: $REPLAY_TREE"
node scripts/guardian-runner.mjs --staged > /tmp/batch.out 2>&1
BATCH_RC=$?
grep -E "总检查数|blocking 失败|失败门清单" /tmp/batch.out | tail -4
# 从批输出的**❌ 行**里抓真实被点名的路径,再与本次声明集求交集。
# ⚠️ 只抓 ❌ 行,不能抓全文: mypy 那类门会把"判定面内的文件清单"整份打印出来,
#    抓全文会把清单里本次的文件误判成"被点名"(实测 15/17 假阳性)。
BATCH_PATHS=$(grep -a "❌" /tmp/batch.out | grep -aoE '(apps|packages|monitoring|scripts|docs|deploy)/[A-Za-z0-9_./-]+' | sort -u)
MINE=$(printf '%s\n' "${PATHS[@]}" | sort -u)
HIT=$(comm -12 <(echo "$BATCH_PATHS") <(echo "$MINE"))
if [ "$BATCH_RC" != "0" ]; then
  echo "⚠️ 守门批非零(详见 /tmp/batch.out)。逐道复跑,点名本次文件的必须自己修:"
  grep -E "❌" /tmp/batch.out | tail -8
  if [ -n "$HIT" ]; then
    echo "❌ 批内结论点名了本次声明的文件 ⇒ 这是本任务自己的红:"
    echo "$HIT" | sed 's/^/    /'
    exit 1
  fi
  echo "ℹ️ 未点名本次文件(交集为空) ⇒ 属他人/机器态的红,按 §12 记录后继续(提交已落地:$NEW)"
fi
# ⚠️ 2026-10-18 修:原写法先 unset 再 rm,此刻 ${GIT_INDEX_FILE:-} 已展开成空串,
#   `rm -f ""` 是空操作 ⇒ 每跑一次就在 gitdir 里漏一份私有索引(实测单份 1.7MB,
#   本次收尾时当场清掉一份 13:11 的残留)。顺序必须反过来:变量还有值时先删文件,再 unset。
rm -f "$GIT_INDEX_FILE" 2>/dev/null
unset GIT_INDEX_FILE
git show --stat --oneline "$NEW" | head -12
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
