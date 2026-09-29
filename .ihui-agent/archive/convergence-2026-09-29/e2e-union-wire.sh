#!/bin/sh
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 端到端证明"已入库那一版"的 union-converge --apply 真会:落合并提交 + 写跳门留痕 + 补跑登记行自愈。
# 在隔离检出树上跑(那份就是 git archive HEAD 的内容 ⇒ 被审面 = 落地面)。
set -e
T="$1"
[ -d "$T" ] || { echo "用法: sh e2e-union-wire.sh <隔离树>"; exit 2; }
cd "$T"
rm -rf .git
git init -q -b main . >/dev/null
git config user.email e2e@e2e
git config user.name e2e
git config core.autocrlf false
git add -A >/dev/null 2>&1
git commit -q -m "base" >/dev/null 2>&1
BASE=$(git rev-parse HEAD)
echo "BASE=$BASE"
# 对侧:在台账上加一行(带一枚唯一编号,模拟并发登记)
git checkout -q -b theirs "$BASE"
printf '\n- [ ] E2E-THEIRS-1 对侧登记行(本行只存在于 theirs)\n' >> PROJECT_PLAN.md
git add PROJECT_PLAN.md >/dev/null
git commit -q -m "theirs: 加对侧登记行" >/dev/null 2>&1
THEIRS=$(git rev-parse HEAD)
# 本侧:同一文件另一处加一行,制造"两侧同改同一活文档"
git checkout -q main
printf '\n- [ ] E2E-MINE-1 本侧登记行(本行只存在于 main)\n' >> PROJECT_PLAN.md
git add PROJECT_PLAN.md >/dev/null
git commit -q -m "ours: 加本侧登记行" >/dev/null 2>&1
HEAD0=$(git rev-parse HEAD)
echo "THEIRS=$THEIRS HEAD0=$HEAD0"
LEDGER=".workbuddy/safe-commit-attestation.jsonl"
B0=$( [ -f "$LEDGER" ] && wc -l < "$LEDGER" || echo 0 )
echo "留痕行数(跑前)=$B0"
set +e
node scripts/union-converge.mjs --theirs "$THEIRS" --apply > /tmp/union-e2e-out.txt 2>&1
RC=$?
set -e
echo "UNION_RC=$RC"
tail -6 /tmp/union-e2e-out.txt
echo "--- 合并结果是否含两侧的行 ---"
git show HEAD:PROJECT_PLAN.md | grep -c "E2E-THEIRS-1\|E2E-MINE-1"
B1=$( [ -f "$LEDGER" ] && wc -l < "$LEDGER" || echo 0 )
echo "留痕行数(跑后)=$B1"
[ -f "$LEDGER" ] && tail -1 "$LEDGER" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('kind=',j.kind,'source=',j.source,'landedSha=',String(j.landedSha).slice(0,11),'gatesRun=',j.gatesRun,'declaredFiles=',(j.declaredFiles||[]).length)})"
echo "E2E_DONE"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
