#!/usr/bin/env bash
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 在"HEAD ⊕ 本票改动"那份隔离检出上跑 selfTest + 镜像测试 —— 磁盘那份含别人未入库的实现,
# 在它上面跑出来的绿不能当落地判据(§12f:绿必须在被审那份上)。
set -u
ROOT=D:/IHUI-AI
DIR=$ROOT/.ihui-agent/tmp/o81-resume/headcheck
BLOB_SRC=3408290bda
BLOB_TST=bc74116d93
if [ -z "$BLOB_SRC" ] || [ -z "$BLOB_TST" ]; then echo "❌ blob 变量为空,拒绝继续(重定向会先把目标清成 0 字节)"; exit 2; fi
rm -rf "$DIR"; mkdir -p "$DIR"
git -c safe.directory=* -C "$ROOT" archive HEAD | tar -x -C "$DIR"
if [ ! -f "$DIR/scripts/union-converge.mjs" ]; then echo "❌ 隔离检出没拿到 scripts/"; exit 2; fi
HS=$(git -c safe.directory=* -C "$ROOT" rev-parse "$BLOB_SRC")
HT=$(git -c safe.directory=* -C "$ROOT" rev-parse "$BLOB_TST")
echo "全 sha: $HS / $HT"
git -c safe.directory=* -C "$ROOT" cat-file blob "$HS" > "$DIR/scripts/union-converge.mjs"
git -c safe.directory=* -C "$ROOT" cat-file blob "$HT" > "$DIR/scripts/tests/union-converge.test.mjs"
# 物化后必须比哈希:重定向失败会留下 0 字节文件而看起来"跑通了"
for f in scripts/union-converge.mjs scripts/tests/union-converge.test.mjs; do
  want=$([ "$f" = "scripts/union-converge.mjs" ] && echo "$HS" || echo "$HT")
  got=$(git -c safe.directory=* hash-object "$DIR/$f")
  if [ "$want" != "$got" ]; then echo "❌ 物化哈希不符 $f want=$want got=$got"; exit 2; fi
done
echo "✅ 隔离检出已就位(两份 blob 哈希逐一对上)"
cd "$DIR"
node --check scripts/union-converge.mjs; echo "CHK_SRC=$?"
node scripts/union-converge.mjs --self-test > st.txt 2>&1; echo "SELFTEST_EXIT=$?"; tail -2 st.txt
node --test scripts/tests/union-converge.test.mjs > mirror.txt 2>&1; echo "MIRROR_EXIT=$?"
grep -E "^# (pass|fail)" mirror.txt
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
