#!/usr/bin/env bash
set -uo pipefail
ZHS_MINI="/d/历史项目存档/zhs_app-ZZ/Ai-WXMiniVue"
ZHS_H5="/d/历史项目存档/zhs_app-ZZ/share-h5"
IHUI_ADMIN="/d/历史项目存档/ihui-ai-admin-frontend"
OUT="/g/IHUI-AI/docs/H_LEGACY_FULL_SCAN.md"
emit() { printf '%s\n' "$*" >> "$OUT"; }

emit ""
emit "## 6. Ai-WXMiniVue (uniapp 多端: 微信小程序 + H5 + App)"
emit ""
if [ -d "$ZHS_MINI/src" ]; then
  emit "### 6.1 pages 页面清单"
  find "$ZHS_MINI/src/pages" -name "*.vue" 2>/dev/null | sort | while read -r f; do
    rel=${f#$ZHS_MINI/}
    emit "- \`$rel\`"
  done | head -500
  emit ""
  emit "### 6.2 路由配置"
  [ -f "$ZHS_MINI/src/pages.json" ] && emit "- \`src/pages.json\` (存在, $(wc -l < "$ZHS_MINI/src/pages.json") 行)"
  emit ""
  emit "### 6.3 api 调用清单"
  find "$ZHS_MINI/src/api" -name "*.js" -o -name "*.ts" 2>/dev/null | sort | while read -r f; do
    rel=${f#$ZHS_MINI/}
    emit "- \`$rel\`"
  done | head -200
  emit ""
  emit "### 6.4 components 组件清单"
  find "$ZHS_MINI/src/components" -name "*.vue" 2>/dev/null | sort | while read -r f; do
    rel=${f#$ZHS_MINI/}
    emit "- \`$rel\`"
  done | head -200
fi
emit ""

emit "## 7. share-h5 (分享 H5)"
emit ""
if [ -d "$ZHS_H5/src" ]; then
  emit "### 7.1 页面清单"
  find "$ZHS_H5/src" -name "*.vue" 2>/dev/null | sort | while read -r f; do
    rel=${f#$ZHS_H5/}
    emit "- \`$rel\`"
  done | head -100
  emit ""
  emit "### 7.2 路由配置"
  find "$ZHS_H5/src" -name "router*" -o -name "routes*" 2>/dev/null | head -5 | while read -r f; do
    rel=${f#$ZHS_H5/}
    emit "- \`$rel\`"
  done
fi
emit ""

emit "## 5. ihui-ai-admin-frontend (RuoYi 3.6.5 管理端) — 补充"
emit ""
if [ -d "$IHUI_ADMIN/src" ]; then
  emit "### 5.1 views 页面清单"
  find "$IHUI_ADMIN/src/views" -name "*.vue" 2>/dev/null | sort | while read -r f; do
    rel=${f#$IHUI_ADMIN/}
    emit "- \`$rel\`"
  done | head -500
  emit ""
  emit "### 5.2 API 清单"
  find "$IHUI_ADMIN/src/api" -name "*.js" -o -name "*.ts" 2>/dev/null | sort | head -200 | while read -r f; do
    rel=${f#$IHUI_ADMIN/}
    emit "- \`$rel\`"
  done
fi
emit ""
echo "DONE sections 5/6/7"
