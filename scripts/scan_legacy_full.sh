#!/usr/bin/env bash
# Scan all legacy Java controllers + Python routes + frontend routes + SQL + configs + resources.
# Output: docs/H_LEGACY_FULL_SCAN.md

set -uo pipefail

EDU_SERVER="/d/历史项目存档/edu server/edu service/edu service"
EDU_CLIENT_WEB="/d/历史项目存档/edu client/web/web"
EDU_CLIENT_ADMIN="/d/历史项目存档/edu client/admin/admin"
EDU_CLIENT_SERVICE="/d/历史项目存档/edu client/service/service"
IHUI_ADMIN="/d/历史项目存档/ihui-ai-admin-frontend"
ZHS_MINI="/d/历史项目存档/zhs_app-ZZ/Ai-WXMiniVue"
ZHS_H5="/d/历史项目存档/zhs_app-ZZ/share-h5"
LJD_ZHS_JAVA="/d/历史项目存档/ljd-交接文件/ZHS_Server_java"
LJD_AI_SMART="/d/历史项目存档/ljd-交接文件/ai-smart-society-java"
LJD_COZE_PY="/d/历史项目存档/ljd-交接文件/coze_zhs_py"

OUT="/g/IHUI-AI/docs/H_LEGACY_FULL_SCAN.md"
> "$OUT"

emit() { printf '%s\n' "$*" >> "$OUT"; }

emit "# 历史项目全量功能清单 (从零扫描)"
emit ""
emit "> 生成时间: $(date '+%Y-%m-%d %H:%M:%S')"
emit "> 扫描源: D 盘历史项目存档"
emit "> 用途: 与 G 盘整合项目交叉验证, 找出遗漏"
emit ""

# =============== 1. edu service (Java 19 微服务) ===============
emit "## 1. edu service (Java 19 微服务) — 后端控制器与端点"
emit ""
emit "### 1.1 服务清单 (22 个 service 模块)"
emit ""
emit "| # | 服务 | Controller 数 | HTTP 端点数 |"
emit "|---|------|--------------|------------|"
total_ctrl=0
total_ep=0
for d in "$EDU_SERVER"/ihui-ai-edu-*-service; do
  svc=$(basename "$d")
  n_ctrl=$(find "$d" -name "*Controller.java" 2>/dev/null | wc -l)
  n_ep=$(grep -rh -E "@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)" --include="*Controller.java" "$d" 2>/dev/null | wc -l)
  total_ctrl=$((total_ctrl + n_ctrl))
  total_ep=$((total_ep + n_ep))
  emit "| - | \`$svc\` | $n_ctrl | $n_ep |"
done
emit "| **合计** | **22 服务** | **$total_ctrl** | **$total_ep** |"
emit ""

emit "### 1.2 全部 Controller 类清单 (类路径 + 文件)"
emit ""
find "$EDU_SERVER" -name "*Controller.java" 2>/dev/null | sort | while read -r f; do
  rel=${f#$EDU_SERVER/}
  emit "- \`$rel\`"
done
emit ""

emit "### 1.3 HTTP 端点清单 (类 → 路径 → 方法)"
emit ""
emit '```'
find "$EDU_SERVER" -name "*Controller.java" 2>/dev/null | sort | while read -r f; do
  cls=$(basename "$f" .java)
  # extract class-level @RequestMapping
  cls_path=$(grep -m1 -E "^@RequestMapping" "$f" 2>/dev/null | grep -oE '"[^"]+"' | head -1 | tr -d '"')
  emit "### $cls  (class-path: ${cls_path:-<none>})"
  # extract method-level mappings
  grep -nE "@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\(" "$f" 2>/dev/null | while IFS=: read -r ln rest; do
    method=$(echo "$rest" | grep -oE "@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)" | head -1 | sed 's/@//;s/Mapping//')
    path=$(echo "$rest" | grep -oE '"[^"]+"' | head -1 | tr -d '"')
    emit "  L$ln  $method  ${path:-<none>}"
  done
  emit ""
done | head -5000 >> "$OUT"
emit '```'
emit ""

# =============== 2. edu client/service (Java 服务层) ===============
emit "## 2. edu client/service (Java 微服务源码副本)"
emit ""
if [ -d "$EDU_CLIENT_SERVICE" ]; then
  n_ctrl2=$(find "$EDU_CLIENT_SERVICE" -name "*Controller.java" 2>/dev/null | wc -l)
  n_ep2=$(grep -rh -E "@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)" --include="*Controller.java" "$EDU_CLIENT_SERVICE" 2>/dev/null | wc -l)
  emit "- Controller 数: $n_ctrl2"
  emit "- HTTP 端点数: $n_ep2"
  emit ""
  emit "### Controller 清单"
  find "$EDU_CLIENT_SERVICE" -name "*Controller.java" 2>/dev/null | sort | while read -r f; do
    rel=${f#$EDU_CLIENT_SERVICE/}
    emit "- \`$rel\`"
  done
fi
emit ""

# =============== 3. edu client/web (Vue 3 学习端 PC 前端) ===============
emit "## 3. edu client/web (Vue 3 学习端 PC 前端)"
emit ""
if [ -d "$EDU_CLIENT_WEB/src" ]; then
  emit "### 3.1 路由文件"
  find "$EDU_CLIENT_WEB/src" -name "router*" -o -name "routes*" 2>/dev/null | head -20 | while read -r f; do
    emit "- \`$f\`"
  done
  emit ""
  emit "### 3.2 views 页面清单"
  find "$EDU_CLIENT_WEB/src/views" -name "*.vue" 2>/dev/null | sort | while read -r f; do
    rel=${f#$EDU_CLIENT_WEB/}
    emit "- \`$rel\`"
  done | head -300
  emit ""
  emit "### 3.3 components 组件清单 (前 200)"
  find "$EDU_CLIENT_WEB/src/components" -name "*.vue" 2>/dev/null | sort | head -200 | while read -r f; do
    rel=${f#$EDU_CLIENT_WEB/}
    emit "- \`$rel\`"
  done
  emit ""
  emit "### 3.4 API 调用清单"
  find "$EDU_CLIENT_WEB/src" -name "api*" -o -name "*api*.js" -o -name "*api*.ts" 2>/dev/null | head -50 | while read -r f; do
    rel=${f#$EDU_CLIENT_WEB/}
    emit "- \`$rel\`"
  done
fi
emit ""

# =============== 4. edu client/admin (Vue 3 学习端 Admin 前端) ===============
emit "## 4. edu client/admin (Vue 3 Admin 前端)"
emit ""
if [ -d "$EDU_CLIENT_ADMIN/src" ]; then
  emit "### 4.1 views 页面清单"
  find "$EDU_CLIENT_ADMIN/src/views" -name "*.vue" 2>/dev/null | sort | while read -r f; do
    rel=${f#$EDU_CLIENT_ADMIN/}
    emit "- \`$rel\`"
  done | head -300
  emit ""
  emit "### 4.2 components 组件清单"
  find "$EDU_CLIENT_ADMIN/src/components" -name "*.vue" 2>/dev/null | sort | head -200 | while read -r f; do
    rel=${f#$EDU_CLIENT_ADMIN/}
    emit "- \`$rel\`"
  done
fi
emit ""

# =============== 5. ihui-ai-admin-frontend (RuoYi 管理端) ===============
emit "## 5. ihui-ai-admin-frontend (RuoYi 3.6.5 管理端)"
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

# =============== 6. Ai-WXMiniVue (uniapp 多端) ===============
emit "## 6. Ai-WXMiniVue (uniapp 多端: 微信小程序 + H5 + App)"
emit ""
if [ -d "$ZHS_MINI/src" ]; then
  emit "### 6.1 pages 页面清单"
  find "$ZHS_MINI/src/pages" -name "*.vue" 2>/dev/null | sort | while read -r f; do
    rel=${f#$ZHS_MINI/}
    emit "- \`$rel\`"
  done | head -500
  emit ""
  emit "### 6.2 pages.json (路由配置)"
  [ -f "$ZHS_MINI/src/pages.json" ] && emit "- \`src/pages.json\` (存在)"
  emit ""
  emit "### 6.3 api 调用清单"
  find "$ZHS_MINI/src/api" -name "*.js" -o -name "*.ts" 2>/dev/null | sort | head -200 | while read -r f; do
    rel=${f#$ZHS_MINI/}
    emit "- \`$rel\`"
  done
fi
emit ""

# =============== 7. share-h5 (分享 H5) ===============
emit "## 7. share-h5 (分享 H5)"
emit ""
if [ -d "$ZHS_H5/src" ]; then
  emit "### 7.1 页面清单"
  find "$ZHS_H5/src" -name "*.vue" 2>/dev/null | sort | while read -r f; do
    rel=${f#$ZHS_H5/}
    emit "- \`$rel\`"
  done | head -100
fi
emit ""

# =============== 8. ljd ZHS_Server_java (Spring Boot) ===============
emit "## 8. ljd-交接文件/ZHS_Server_java (Spring Boot 单体)"
emit ""
if [ -d "$LJD_ZHS_JAVA/src/main/java" ]; then
  n_ctrl3=$(find "$LJD_ZHS_JAVA" -name "*Controller.java" 2>/dev/null | wc -l)
  emit "- Controller 数: $n_ctrl3"
  emit ""
  emit "### 8.1 Controller 清单"
  find "$LJD_ZHS_JAVA" -name "*Controller.java" 2>/dev/null | sort | while read -r f; do
    rel=${f#$LJD_ZHS_JAVA/}
    emit "- \`$rel\`"
  done
  emit ""
  emit "### 8.2 HTTP 端点"
  find "$LJD_ZHS_JAVA" -name "*Controller.java" 2>/dev/null | sort | while read -r f; do
    cls=$(basename "$f" .java)
    emit "### $cls"
    grep -nE "@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\(" "$f" 2>/dev/null | while IFS=: read -r ln rest; do
      method=$(echo "$rest" | grep -oE "@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)" | head -1 | sed 's/@//;s/Mapping//')
      path=$(echo "$rest" | grep -oE '"[^"]+"' | head -1 | tr -d '"')
      emit "  L$ln  $method  ${path:-<none>}"
    done
  done
fi
emit ""

# =============== 9. ljd ai-smart-society-java (RuoYi Cloud 微服务) ===============
emit "## 9. ljd-交接文件/ai-smart-society-java (RuoYi Cloud 微服务)"
emit ""
if [ -d "$LJD_AI_SMART" ]; then
  emit "### 9.1 模块清单"
  ls -d "$LJD_AI_SMART"/ruoyi-* 2>/dev/null | while read -r m; do
    emit "- \`$(basename "$m")\`"
  done
  emit ""
  n_ctrl4=$(find "$LJD_AI_SMART" -name "*Controller.java" 2>/dev/null | wc -l)
  emit "- Controller 数: $n_ctrl4"
  emit ""
  emit "### 9.2 Controller 清单"
  find "$LJD_AI_SMART" -name "*Controller.java" 2>/dev/null | sort | while read -r f; do
    rel=${f#$LJD_AI_SMART/}
    emit "- \`$rel\`"
  done | head -300
fi
emit ""

# =============== 10. ljd coze_zhs_py (FastAPI Python 服务) ===============
emit "## 10. ljd-交接文件/coze_zhs_py (FastAPI Python)"
emit ""
if [ -d "$LJD_COZE_PY" ]; then
  emit "### 10.1 Python 源文件"
  find "$LJD_COZE_PY" -maxdepth 2 -name "*.py" 2>/dev/null | grep -v __pycache__ | sort | while read -r f; do
    rel=${f#$LJD_COZE_PY/}
    emit "- \`$rel\`"
  done | head -100
  emit ""
  emit "### 10.2 路由 (router 装饰器)"
  grep -rn -E "@(router|app)\.(get|post|put|delete|patch)\(" "$LJD_COZE_PY" --include="*.py" 2>/dev/null | grep -v __pycache__ | while IFS=: read -r f ln rest; do
    rel=${f#$LJD_COZE_PY/}
    emit "- \`$rel:$ln\`  $rest"
  done | head -300
fi
emit ""

# =============== 11. SQL 建表脚本汇总 ===============
emit "## 11. SQL 建表脚本汇总"
emit ""
emit "### edu service"
find "$EDU_SERVER" -name "*.sql" 2>/dev/null | sort | while read -r f; do
  rel=${f#$EDU_SERVER/}
  emit "- \`$rel\`"
done | head -100
emit ""
emit "### edu client"
find "/d/历史项目存档/edu client" -name "*.sql" 2>/dev/null | sort | while read -r f; do
  rel=${f#"/d/历史项目存档/edu client/"}
  emit "- \`$rel\`"
done | head -50
emit ""
emit "### ljd"
find "/d/历史项目存档/ljd-交接文件" -name "*.sql" 2>/dev/null | sort | while read -r f; do
  rel=${f#"/d/历史项目存档/ljd-交接文件/"}
  emit "- \`$rel\`"
done | head -50
emit ""
emit "### Ai-WXMiniVue"
find "$ZHS_MINI" -name "*.sql" 2>/dev/null | sort | while read -r f; do
  rel=${f#$ZHS_MINI/}
  emit "- \`$rel\`"
done | head -20
emit ""

# =============== 12. CREATE TABLE 表名清单 ===============
emit "## 12. CREATE TABLE 表名清单 (跨所有历史项目)"
emit ""
emit '```'
grep -rh -iE "CREATE TABLE" "/d/历史项目存档" --include="*.sql" 2>/dev/null | \
  grep -oiE "CREATE TABLE[[:space:]]+(IF NOT EXISTS[[:space:]]+)?[\`\"]?[a-zA-Z0-9_]+[\`\"]?" | \
  sed -E 's/[`"]//g; s/CREATE TABLE[[:space:]]*//I; s/IF NOT EXISTS[[:space:]]*//I' | \
  tr '[:upper:]' '[:lower:]' | sort -u | head -500
emit '```'
emit ""

# =============== 13. 配置 / 凭证 / 证书清单 ===============
emit "## 13. 配置 / 凭证 / 证书清单"
emit ""
emit "### application*.yml / application*.properties"
find "/d/历史项目存档" -name "application*.yml" -o -name "application*.yaml" -o -name "application*.properties" 2>/dev/null | grep -v node_modules | sort | while read -r f; do
  rel=${f#"/d/历史项目存档/"}
  emit "- \`$rel\`"
done | head -100
emit ""
emit "### .env / .env.*"
find "/d/历史项目存档" -maxdepth 5 \( -name ".env" -o -name ".env.*" \) 2>/dev/null | grep -v node_modules | sort | while read -r f; do
  rel=${f#"/d/历史项目存档/"}
  emit "- \`$rel\`"
done | head -50
emit ""
emit "### 证书 (.jks / .p12 / .pem / .crt / .key)"
find "/d/历史项目存档" \( -name "*.jks" -o -name "*.p12" -o -name "*.pem" -o -name "*.crt" -o -name "*.key" -o -name "*.cert" \) 2>/dev/null | grep -v node_modules | sort | while read -r f; do
  rel=${f#"/d/历史项目存档/"}
  emit "- \`$rel\`"
done | head -50
emit ""
emit "### 微信 / VAPID / AI 厂商密钥配置"
find "/d/历史项目存档" \( -name "*vapid*" -o -name "*wechat*" -o -name "*weixin*" -o -name "*wx*config*" \) 2>/dev/null | grep -v node_modules | grep -v ".git/" | sort | while read -r f; do
  rel=${f#"/d/历史项目存档/"}
  emit "- \`$rel\`"
done | head -50
emit ""

# =============== 14. 资源文件 (data/json/videos) ===============
emit "## 14. 资源文件 (data / json / videos)"
emit ""
emit "### edu client/data JSON"
find "/d/历史项目存档/edu client/data" -name "*.json" 2>/dev/null | sort | while read -r f; do
  rel=${f#"/d/历史项目存档/edu client/"}
  emit "- \`$rel\`"
done | head -50
emit ""
emit "### Ai-WXMiniVue static 资源"
find "$ZHS_MINI/src/static" -type f 2>/dev/null | wc -l | xargs -I{} emit "- 静态资源文件数: {}"
find "$ZHS_MINI/src/static" -maxdepth 2 -type d 2>/dev/null | sort | while read -r f; do
  rel=${f#$ZHS_MINI/}
  emit "- \`$rel/\`"
done | head -30
emit ""

# =============== 15. 前端路由配置文件 ===============
emit "## 15. 前端路由配置文件"
emit ""
emit "### edu client/web"
find "$EDU_CLIENT_WEB/src" -name "router*" -o -name "routes*" -o -name "index.js" -path "*/router/*" 2>/dev/null | head -10 | while read -r f; do
  rel=${f#$EDU_CLIENT_WEB/}
  emit "- \`$rel\`"
done
emit "### edu client/admin"
find "$EDU_CLIENT_ADMIN/src" -name "router*" -o -name "routes*" -o -name "index.js" -path "*/router/*" 2>/dev/null | head -10 | while read -r f; do
  rel=${f#$EDU_CLIENT_ADMIN/}
  emit "- \`$rel\`"
done
emit "### ihui-ai-admin-frontend"
find "$IHUI_ADMIN/src" -name "router*" -o -name "routes*" 2>/dev/null | head -10 | while read -r f; do
  rel=${f#$IHUI_ADMIN/}
  emit "- \`$rel\`"
done
emit ""

emit "---"
emit ""
emit "## 摘要统计"
emit ""
emit "| 维度 | 数量 |"
emit "|------|------|"
emit "| edu service 服务 | 22 |"
emit "| edu service Controller | $total_ctrl |"
emit "| edu service HTTP 端点 | $total_ep |"
emit "| edu client/service Controller | $n_ctrl2 |"
emit "| ZHS_Server_java Controller | $n_ctrl3 |"
emit "| ai-smart-society-java Controller | $n_ctrl4 |"
emit ""

echo "DONE: $OUT"
wc -l "$OUT"
