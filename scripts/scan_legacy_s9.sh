#!/usr/bin/env bash
# Append sections 9-15 to docs/H_LEGACY_FULL_SCAN.md (chunked to avoid 5min timeout)
set -uo pipefail

LJD_AI_SMART="/d/历史项目存档/ljd-交接文件/ai-smart-society-java"
LJD_COZE_PY="/d/历史项目存档/ljd-交接文件/coze_zhs_py"
IHUI_ADMIN="/d/历史项目存档/ihui-ai-admin-frontend"
ZHS_MINI="/d/历史项目存档/zhs_app-ZZ/Ai-WXMiniVue"
ZHS_H5="/d/历史项目存档/zhs_app-ZZ/share-h5"
EDU_SERVER="/d/历史项目存档/edu server/edu service/edu service"
ARCHIVE="/d/历史项目存档"

OUT="/g/IHUI-AI/docs/H_LEGACY_FULL_SCAN.md"
emit() { printf '%s\n' "$*" >> "$OUT"; }

emit ""
emit "## 9. ljd-交接文件/ai-smart-society-java (RuoYi Cloud 微服务)"
emit ""
emit "### 9.1 模块清单"
ls -d "$LJD_AI_SMART"/ruoyi-* 2>/dev/null | while read -r m; do
  emit "- \`$(basename "$m")\`"
done
n_ctrl4=$(find "$LJD_AI_SMART" -name "*Controller.java" 2>/dev/null | wc -l)
emit ""
emit "- Controller 数: $n_ctrl4"
emit ""
emit "### 9.2 Controller 清单"
find "$LJD_AI_SMART" -name "*Controller.java" 2>/dev/null | sort | while read -r f; do
  rel=${f#$LJD_AI_SMART/}
  emit "- \`$rel\`"
done | head -300
emit ""
emit "### 9.3 HTTP 端点"
find "$LJD_AI_SMART" -name "*Controller.java" 2>/dev/null | sort | while read -r f; do
  cls=$(basename "$f" .java)
  n=$(grep -cE "@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\(" "$f" 2>/dev/null)
  emit "  - $cls ($n endpoints)"
done | head -300
emit ""

echo "DONE section 9"
