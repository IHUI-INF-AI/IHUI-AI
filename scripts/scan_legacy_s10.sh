#!/usr/bin/env bash
set -uo pipefail
LJD_COZE_PY="/d/历史项目存档/ljd-交接文件/coze_zhs_py"
OUT="/g/IHUI-AI/docs/H_LEGACY_FULL_SCAN.md"
emit() { printf '%s\n' "$*" >> "$OUT"; }

emit ""
emit "## 10. ljd-交接文件/coze_zhs_py (FastAPI Python)"
emit ""
emit "### 10.1 Python 源文件"
find "$LJD_COZE_PY" -maxdepth 3 -name "*.py" 2>/dev/null | grep -v __pycache__ | sort | while read -r f; do
  rel=${f#$LJD_COZE_PY/}
  emit "- \`$rel\`"
done | head -100
emit ""
emit "### 10.2 路由 (router/app 装饰器)"
grep -rn -E "@(router|app)\.(get|post|put|delete|patch)\(" "$LJD_COZE_PY" --include="*.py" 2>/dev/null | grep -v __pycache__ | while IFS=: read -r f ln rest; do
  rel=${f#$LJD_COZE_PY/}
  emit "- \`$rel:$ln\`  $rest"
done | head -300
emit ""
echo "DONE section 10"
