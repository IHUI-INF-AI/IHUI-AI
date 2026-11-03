#!/usr/bin/env bash
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 建本地恢复源(§5b 兜底恢复用)—— 适配 **shallow 主仓**的正解。
#
# 为什么不直接 `git clone --bare`(2026-10-03 四轮失败后才对,每轮都有明确报错):
#   ① clone ⇒ `git upload-pack died` / `possible repository corruption`
#      —— 主仓历史含**不可达损坏树**(`git fsck` 40 条 broken link;抽样三条全部「不可达自 HEAD」
#      ⇒ 历史垃圾,HEAD 面完好),而 clone 必须遍历全历史。
#   ② `core.alternates` + `git fetch` ⇒ 报 OK 但 refs 0 条。
#   ③ 同上 + 足超时 ⇒ `warning: rejected refs/heads/main because shallow roots are not allowed
#      to be updated` —— **真因**:主仓 `.git/shallow` 存在(1 条深度边界),shallow 仓的根提交
#      不允许被普通 fetch 更新。
#   ④ 逐条 `cat-file -e` 验 5186 条 ref ⇒ 起 5186 个进程,必然超时。
#
# 正解(本脚本):shallow 仓的恢复源**不该靠 fetch 拿 ref**。
#   ① `objects/info/alternates` 指向主仓对象库(零拷贝,不占额外 14G);
#   ② `packed-refs` 从主仓 `for-each-ref` 逐条搬,**并用 `cat-file --batch-check` 一次验完**;
#      对象缺失的 ref 逐条报名后跳过(宁可少几条 ref,不可让备份整体不可用);
#   ③ `HEAD` 指向 `refs/heads/main`。
#
# 为什么是 bash 而不是 node(2026-10-03 实测):本机交互会话有 EBUSY 病窗,
# node 的 `spawnSync`/`execSync` 调 git、以及**连 stdin 管道都会静默丢数据**
# (`cat-file --batch-check` 喂 input 返回 0 行、exit 0)⇒ node 写的同类脚本一律不可靠。
# **本仓铁律:Git Bash 直跑 git 才是可信通道**(见 memory「临时探测纪律」)。
#
# 用法:bash scripts/build-local-recovery-source.sh
set -euo pipefail

REPO="${1:-G:/IHUI-AI}"
MAIN="$REPO/.git"
DST="$REPO/.DevEnv/backups/git/IHUI-AI.git-backup-20260912"

[ -d "$MAIN" ] || { echo "❌ 不是 git 仓库:$MAIN" >&2; exit 1; }

if [ ! -f "$DST/HEAD" ]; then
  git init --bare "$DST" >/dev/null
  echo "init --bare ok"
fi

# ① 零拷贝:裸仓的 alternates 是**文件**不是 config 项(只写 config 那一处不生效,
#    for-each-ref 会报 missing object —— 本轮踩过)
mkdir -p "$DST/objects/info"
printf '%s\n' "$MAIN/objects" > "$DST/objects/info/alternates"
git --git-dir="$DST" config core.alternates "$MAIN/objects"
echo "alternates 已配(零拷贝,不占额外 14G)"

# ② 中断残留的 shallow_<tmp> 临时件:它们不是备份内容,只会让 git 误判仓形态
for f in "$DST"/shallow_*; do
  [ -e "$f" ] || continue
  rm -f "$f" && echo "清残留:$(basename "$f")" || true
done

# ③ refs 逐条搬 + 批量验对象可达
TMP_ALL="$REPO/.ihui-agent/tmp/recovery-all-refs.txt"
TMP_CHK="$REPO/.ihui-agent/tmp/recovery-shacheck.txt"
mkdir -p "$(dirname "$TMP_ALL")"
git --git-dir="$MAIN" for-each-ref --format='%(objectname) %(refname)' > "$TMP_ALL"
awk '{print $1}' "$TMP_ALL" > "$TMP_ALL.sha"
git cat-file --batch-check < "$TMP_ALL.sha" > "$TMP_CHK" 2>/dev/null || true

TOTAL=$(wc -l < "$TMP_ALL")
ALIVE=$(grep -cE '^[0-9a-f]{40,64} ' "$TMP_CHK" || true)
echo "ref 总数 $TOTAL / 对象可达 $ALIVE"

# 只写可达的那些(sha + refname 同行对齐:batch-check 输出第 i 行对应输入第 i 个 sha)
awk 'NR==FNR{ok[$1]=1;next} ($1 in ok)' "$TMP_CHK" "$TMP_ALL" > "$DST/packed-refs"
SKIPPED=$(( TOTAL - $(wc -l < "$DST/packed-refs") ))
echo "packed-refs 写入 $(wc -l < "$DST/packed-refs") 条 | 跳过(对象缺失)$SKIPPED 条"
[ "$SKIPPED" -gt 0 ] && grep -vxFf "$TMP_CHK" "$TMP_ALL" | head -10 | sed 's/^/  跳过: /' || true

# ④ HEAD 指向主分支(shallow 仓的 HEAD 若指向 .invalid 就是这个形态坏了)
git --git-dir="$DST" symbolic-ref HEAD refs/heads/main

MAIN_SHA=$(git --git-dir="$DST" rev-parse refs/heads/main)
SRC_HEAD=$(git --git-dir="$MAIN" rev-parse HEAD)
echo "HEAD -> refs/heads/main = $MAIN_SHA"
echo "主仓 HEAD              = $SRC_HEAD"
[ "$MAIN_SHA" = "$SRC_HEAD" ] && echo "(一致 ✓ 恢复源可用)" || { echo "★不一致" >&2; exit 1; }

# ⑤ 尺子自证:恢复源必须真的能被 refresh 认成"已追平"
node "$REPO/scripts/git-backup-refresh.mjs" --check
