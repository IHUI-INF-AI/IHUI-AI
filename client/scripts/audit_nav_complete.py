#!/usr/bin/env python3
"""
前端页面-入口 完整度分析 v3
核心思路：从路由表的 component import 路径直接提取真实 view 文件，
建立 100% 精确的 view ↔ route 映射。
"""
import os
import re
import json
from pathlib import Path
from collections import defaultdict

CLIENT_DIR = r"g:\IHUI-AI\client\src"
ROUTER_DIR = os.path.join(CLIENT_DIR, "router")
VIEWS_DIR = os.path.join(CLIENT_DIR, "views")
COMPONENTS_DIR = os.path.join(CLIENT_DIR, "components")


# ========== 1. 提取所有路由 + 真实 view 文件路径 ==========
def extract_routes():
    """
    从路由模块提取路由表，每条记录:
    - path: 完整路径（含 children 拼接）
    - name: 路由名
    - component_path: 真实 view 文件相对路径（从 @/views/xxx 提取）
    - module: 所在模块文件
    """
    routes = []
    modules_dir = os.path.join(ROUTER_DIR, "modules")
    if not os.path.isdir(modules_dir):
        return routes

# 匹配 path 字段（允许行首出现 '{' 之类的标点，避免漏掉嵌套 children）
    path_re = re.compile(r"^(\s*[\{,\[]?\s*)path:\s*['\"`]([^'\"`]+)['\"`]")
    # 单行匹配 import 路径（不考虑跨行）
    import_re = re.compile(
        r"""import\(\s*(?:/\*[^*]*\*/\s*)?['"`]([^'"`]+)['"`]"""
    )
    name_re = re.compile(r"name:\s*['\"`]([^'\"`]+)['\"`]")

    for fn in sorted(os.listdir(modules_dir)):
        if not fn.endswith(".ts"):
            continue
        fp = os.path.join(modules_dir, fn)
        try:
            text = Path(fp).read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        lines = text.splitlines()
        parent_stack = []  # [(indent, full_path)]

        for i, line in enumerate(lines):
            pm = path_re.match(line)
            if not pm:
                continue
            indent = len(pm.group(1))
            p = pm.group(2)
            if p in ("*", ""):
                continue
            if not p.startswith("/"):
                p = "/" + p
            # 父路径
            while parent_stack and parent_stack[-1][0] >= indent:
                parent_stack.pop()
            if parent_stack:
                full = parent_stack[-1][1] + p
            else:
                full = p
            full = re.sub(r"//+", "/", full)
            # 找 name
            name = ""
            for j in range(i, min(i + 5, len(lines))):
                nm = name_re.search(lines[j])
                if nm:
                    name = nm.group(1)
                    break
            # 找 component 路径 - 搜索后续 30 行
            comp_path = ""
            comp_field = ""  # component: <xxx> 中 xxx 字段
            for j in range(i, min(i + 30, len(lines))):
                # 优先匹配 component: ... 字段
                cm = re.search(r"component:\s*([A-Za-z_][A-Za-z0-9_]*)", lines[j])
                if cm:
                    comp_field = cm.group(1)
                im = import_re.search(lines[j])
                if im:
                    candidate = im.group(1)
                    # 必须是相对路径或别名路径
                    if candidate.startswith("@/") or candidate.startswith("./") or candidate.startswith("/"):
                        comp_path = candidate
                        break
            # 转换 @/xxx/yyy.vue → 标准化 view_file 路径
            # 规则：原 @/views/ 路径 → "views/xxx.vue"
            # 原 @/components/ 路径 → "components/xxx.vue"
            # 其它 @/xxx/ 路径 → 保留为 "xxx/..."
            view_file = ""
            if comp_path:
                if comp_path.startswith("@/views/"):
                    view_file = "views/" + comp_path[len("@/views/"):]
                elif comp_path.startswith("@/components/"):
                    view_file = "components/" + comp_path[len("@/components/"):]
                elif comp_path.startswith("@/"):
                    view_file = comp_path[len("@/"):]
                else:
                    view_file = comp_path
            routes.append({
                "path": full,
                "name": name,
                "component_path": comp_path,
                "component_field": comp_field,
                "view_file": view_file,
                "module": fn,
            })
            parent_stack.append((indent, full))

    return routes


# ========== 2. 提取所有 view 文件（实际目录中的） ==========
def extract_view_files():
    """扫描 src/views 下所有 .vue，路径带 'views/' 前缀与 view_file 字段保持一致"""
    pages = []
    for root, dirs, files in os.walk(VIEWS_DIR):
        dirs[:] = [d for d in dirs if d not in ("__tests__", "node_modules")]
        for f in files:
            if f.endswith(".vue") and not f.endswith(".styles.scss"):
                rel = os.path.relpath(os.path.join(root, f), VIEWS_DIR)
                rel = rel.replace("\\", "/")
                # 加上 'views/' 前缀以与 view_file 字段对齐
                pages.append("views/" + rel)
    return pages


def extract_all_vue_files():
    """扫描 src 下所有 .vue，用于补充 view_file 存在性校验（处理 components/xxx.vue 等场景）"""
    pages = []
    src_root = r"g:\IHUI-AI\client\src"
    for root, dirs, files in os.walk(src_root):
        dirs[:] = [d for d in dirs if d not in ("__tests__", "node_modules", ".git")]
        for f in files:
            if f.endswith(".vue") and not f.endswith(".styles.scss"):
                rel = os.path.relpath(os.path.join(root, f), src_root)
                rel = rel.replace("\\", "/")
                pages.append(rel)
    return pages


# ========== 3. 提取文件中的导航入口 ==========
def line_of(text, pos):
    return text.count("\n", 0, pos) + 1


def extract_entries_from_text(text):
    entries = []
    # 1. router-link :to="..."
    for m in re.finditer(r"<(?:router-link|nuxt-link)\b[^>]*?\b(?:to|:to)\s*=\s*['\"]([^'\"]+)['\"]", text):
        entries.append(("router-link:to", m.group(1), line_of(text, m.start())))
    # 2. router-link :to="`...`"
    for m in re.finditer(r"<(?:router-link|nuxt-link)\b[^>]*?\b(?:to|:to)\s*=\s*[`]([^`]+)[`]", text):
        entries.append(("router-link:to-tpl", m.group(1), line_of(text, m.start())))
    # 3. router.push("...") router.push('...')
    for m in re.finditer(r"router\.push\(\s*['\"`]([^'\"`]+)['\"`]\s*\)", text):
        entries.append(("router.push(str)", m.group(1), line_of(text, m.start())))
    # 4. router.push({path: "/x"})
    for m in re.finditer(r"router\.push\(\s*\{[^}]*?path:\s*['\"`]([^'\"`]+)['\"`]", text):
        entries.append(("router.push(path)", m.group(1), line_of(text, m.start())))
    # 5. router.push({name: "x"})
    for m in re.finditer(r"router\.push\(\s*\{[^}]*?name:\s*['\"`]([^'\"`]+)['\"`]", text):
        entries.append(("router.push(name)", m.group(1), line_of(text, m.start())))
    # 6. router.replace
    for m in re.finditer(r"router\.replace\(\s*['\"`]([^'\"`]+)['\"`]\s*\)", text):
        entries.append(("router.replace", m.group(1), line_of(text, m.start())))
    # 7. location.href
    for m in re.finditer(r"location\.href\s*=\s*['\"`]([^'\"`]+)['\"`]", text):
        entries.append(("location.href", m.group(1), line_of(text, m.start())))
    # 8. window.open
    for m in re.finditer(r"window\.open\(\s*['\"`]([^'\"`]+)['\"`]", text):
        entries.append(("window.open", m.group(1), line_of(text, m.start())))
    # 9. <a href="/x">
    for m in re.finditer(r"<(?:a|el-link)\b[^>]*?\bhref\s*=\s*['\"]([/a-zA-Z][^'\"]*)['\"]", text):
        path = m.group(1)
        if path.startswith("/") and not path.startswith("//"):
            entries.append(("href", path, line_of(text, m.start())))
    # 10. path: '/admin/xxx' (Menu.vue items)
    for m in re.finditer(r"\bpath:\s*['\"`](/[^'\"`]+)['\"`]", text):
        entries.append(("path-literal", m.group(1), line_of(text, m.start())))
    # 11. url: '/x'
    for m in re.finditer(r"\burl:\s*['\"`](/[^'\"`]+)['\"`]", text):
        entries.append(("url-literal", m.group(1), line_of(text, m.start())))
    # 12. goToPath('/xxx', 'key') - HeaderNavigation 模式
    for m in re.finditer(r"\bgoToPath\(\s*['\"`]([^'\"`]+)['\"`]", text):
        entries.append(("goToPath", m.group(1), line_of(text, m.start())))
    # 13. goToXxx('/xxx') - 自定义跳转函数（需带字符串字面量参数）
    for m in re.finditer(r"\bgoTo[A-Z][A-Za-z]*\(\s*['\"`]([^'\"`]+)['\"`]", text):
        entries.append(("goToCustom", m.group(1), line_of(text, m.start())))
    # 14. handleGoXxx('/xxx') - handle 前缀
    for m in re.finditer(r"\bhandleGo[A-Z][A-Za-z]*\(\s*['\"`]([^'\"`]+)['\"`]", text):
        entries.append(("handleGo", m.group(1), line_of(text, m.start())))
    # 14b. safeNavigate('/xxx', ...) / navigateTo('/xxx', ...) - 通用封装
    for m in re.finditer(r"\b(safeNavigate|navigateTo|navigate)\(\s*['\"`]([^'\"`]+)['\"`]", text):
        entries.append(("navigate", m.group(2), line_of(text, m.start())))
    # 15. to: '/x' (vue-router 路由配置中的 redirect / alias)
    for m in re.finditer(r"\b(?:to|redirect|alias)\s*:\s*['\"`](/[^'\"`]+)['\"`]", text):
        entries.append(("to/redirect", m.group(1), line_of(text, m.start())))
    # 16. resolvePath('/x') 动态路径解析
    for m in re.finditer(r"\bresolvePath\(\s*['\"`]([^'\"`]+)['\"`]", text):
        entries.append(("resolvePath", m.group(1), line_of(text, m.start())))
    # 17. redirect: 'admin/xxx' (省略前导斜杠) - admin.ts 里的 redirect 配置
    for m in re.finditer(r"\bredirect:\s*['\"`](/[^'\"`]+)['\"`]", text):
        entries.append(("redirect", m.group(1), line_of(text, m.start())))
    # 18. routesName/name: 'login' -> 不展开（需要查表）
    return entries


def extract_entries_from_file(fp):
    try:
        text = Path(fp).read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []
    return extract_entries_from_text(text)


# ========== 4. 路径归一化 ==========
def normalize_path(p):
    if not p or not isinstance(p, str):
        return None
    p = p.strip()
    # 模板字符串保留静态前缀
    if "${" in p or "{" in p:
        prefix = re.split(r"\$\{|\{", p)[0].rstrip("/")
        if prefix and prefix.startswith("/"):
            return prefix
    p = p.split("?")[0].split("#")[0]
    if not p or not p.startswith("/") or p.startswith("//"):
        return None
    return p


# ========== 主流程 ==========
def main():
    print("=" * 80)
    print("前端页面-入口 完整度分析 v3")
    print("=" * 80)

    # 1. 路由
    print("\n[1/5] 提取路由表...")
    routes = extract_routes()
    print(f"  - 共 {len(routes)} 个路由")

    # 2. view 页面
    print("\n[2/5] 扫描 views 目录...")
    pages_raw = extract_view_files()
    pages = ["views/" + p if not p.startswith("views/") else p for p in pages_raw]
    all_vue = set(extract_all_vue_files())
    print(f"  - views 下 .vue: {len(pages)} 个")
    print(f"  - src 下 .vue（用于 view_file 跨目录校验）: {len(all_vue)} 个")

    # 路由分类
    is_dynamic = lambda p: (":" in p) or ("*" in p) or ("(.*)" in p) or ("(\\d+)" in p)
    static_routes = [r for r in routes if not is_dynamic(r["path"])]
    dynamic_routes = [r for r in routes if is_dynamic(r["path"])]
    static_paths = {r["path"] for r in static_routes}
    print(f"  - 静态路由: {len(static_routes)}, 动态路由: {len(dynamic_routes)}")

    # 路由的 view_file 集合（实际被路由引用的 view）
    routed_view_files = {r["view_file"] for r in routes if r["view_file"]}
    # 反向索引：view_file -> [routes]
    view_to_routes = defaultdict(list)
    for r in routes:
        if r["view_file"]:
            view_to_routes[r["view_file"]].append(r)
    # name -> path 反查（用于解析 router.push({name: 'xxx'})）
    name_to_path = {}
    for r in routes:
        if r.get("name") and r.get("path"):
            name_to_path[r["name"]] = r["path"]
    # 识别占位组件（NotFound / notFoundComponent / NotImplemented 等）路由
    PLACEHOLDER_TOKENS = [
        "NotFound",
        "notFoundComponent",
        "NotImplemented",
        "Placeholder",
        "PagePending",
        "EduLayout",  # edu.ts 中使用的占位变量
    ]
    placeholder_routes = []
    for r in routes:
        cp = r.get("component_path", "") or ""
        cf = r.get("component_field", "") or ""
        vf = r.get("view_file", "") or ""
        # 1) 引用了 @/views/NotFound.vue
        # 2) component_path 含有 notFoundComponent / Placeholder 等占位变量名
        # 3) component_field 是占位变量名（处理 component: notFoundComponent 的写法）
        is_placeholder = (
            vf == "NotFound.vue" or
            any(tok in cp for tok in PLACEHOLDER_TOKENS) or
            any(tok in cf for tok in PLACEHOLDER_TOKENS)
        )
        if is_placeholder:
            placeholder_routes.append(r)
    print(f"  - 占位组件路由（Phase C 等）: {len(placeholder_routes)}")

    # 3. 提取每个 view 的入口
    print("\n[3/5] 提取每个 view 的入口...")
    page_entries = {}
    for p in pages_raw:
        fp = os.path.join(VIEWS_DIR, p)
        page_entries[p] = extract_entries_from_file(fp)

    # 4. 提取 nav 组件 + composables（导航函数）
    print("\n[4/5] 提取导航组件入口...")
    nav_files = []
    # 4a. 组件下包含 header/footer/menu/nav/sidebar/tabbar/mobile 关键词
    for root, dirs, files in os.walk(COMPONENTS_DIR):
        dirs[:] = [d for d in dirs if d != "node_modules"]
        for f in files:
            if not f.endswith(".vue"):
                continue
            rel = os.path.relpath(os.path.join(root, f), COMPONENTS_DIR).replace("\\", "/")
            keywords = ["header", "footer", "menu", "nav", "sidebar", "tabbar", "mobile"]
            if any(k in rel.lower() for k in keywords):
                nav_files.append("components/" + rel)
    # 4b. composables 下包含 navigation / route / router / nav 关键词（.ts）
    composables_dir = os.path.join(CLIENT_DIR, "composables")
    nav_keyword_re = re.compile(r"(navigation|navigate|router|route|nav\b)", re.IGNORECASE)
    if os.path.isdir(composables_dir):
        for root, dirs, files in os.walk(composables_dir):
            dirs[:] = [d for d in dirs if d != "node_modules"]
            for f in files:
                if not f.endswith(".ts"):
                    continue
                if not nav_keyword_re.search(f):
                    continue
                rel = os.path.relpath(os.path.join(root, f), CLIENT_DIR).replace("\\", "/")
                nav_files.append(rel)
    # 4c. utils 下跟路由跳转相关的（如 path helpers）
    utils_dir = os.path.join(CLIENT_DIR, "utils")
    if os.path.isdir(utils_dir):
        for root, dirs, files in os.walk(utils_dir):
            dirs[:] = [d for d in dirs if d != "node_modules"]
            for f in files:
                if not f.endswith(".ts"):
                    continue
                if not nav_keyword_re.search(f):
                    continue
                rel = os.path.relpath(os.path.join(root, f), CLIENT_DIR).replace("\\", "/")
                nav_files.append(rel)
    nav_entries = {}
    for nf in nav_files:
        # 拼接实际文件路径
        if nf.startswith("components/"):
            fp = os.path.join(COMPONENTS_DIR, nf[len("components/"):])
        else:
            fp = os.path.join(CLIENT_DIR, nf)
        if not os.path.exists(fp):
            continue
        nav_entries[nf] = extract_entries_from_file(fp)
    print(f"  - 共 {len(nav_files)} 个 nav 文件（components + composables + utils）")

    # 5. 归一化 + 索引
    print("\n[5/5] 归一化与对比...")

    # 所有入口目标
    inbound = defaultdict(list)  # target -> [(kind, src, type, line)]
    for src, entries in page_entries.items():
        for kind, t, line in entries:
            nt = normalize_path(t)
            if nt:
                inbound[nt].append(("page", src, kind, line))
            # 处理 router.push({name: 'xxx}) 等：反查 name -> path
            if kind == "router.push(name)":
                resolved = name_to_path.get(t)
                if resolved:
                    inbound[resolved].append(("page", src, kind + "[by-name]", line))
    for src, entries in nav_entries.items():
        for kind, t, line in entries:
            nt = normalize_path(t)
            if nt:
                inbound[nt].append(("nav", src, kind, line))
            if kind == "router.push(name)":
                resolved = name_to_path.get(t)
                if resolved:
                    inbound[resolved].append(("nav", src, kind + "[by-name]", line))

    all_targets = set(inbound.keys())

    # ===== 分析 =====

    # A. 死链入口：target 不在 static_paths 中（且不匹配动态）
    # 这些是允许作为"非路由目标"出现的路径：API 文档示例、图片资源、登录跳转等
    SAFE_TARGETS = {
        # API 文档示例（BusinessDocs.vue）
        "/api/v1/auth/login", "/api/v1/auth/logout", "/api/v1/auth/refresh",
        "/api/v1/auth/register", "/api/v1/auth/info", "/api/ai/chat",
        "/api/ai/generate", "/api/ai/models", "/api/agents/create",
        "/api/order/create", "/api/fund/ali/pay", "/api/fund/ali/pay/notify",
        "/api/fund/ali/pay/success", "/api/fund/wx/pay", "/api/user/profile",
        "/api/vip/levels", "/api/orders", "/api/admin/login", "/api/admin/users",
        "/api/admin/roles", "/api/admin/menus", "/api/data",
        # 用户文档示例图片（User.vue）
        "/images/study/api-example.png", "/images/study/architecture.png",
        "/images/study/deploy.png", "/images/study/model-compare.png",
        "/images/study/performance.png", "/images/study/workflow.png",
        # 内部跳转（带 query 的路由）
        "/login?source=", "/payment?orderId=",
    }
    SAFE_PATHS = {"/", "/login", "/register", "/403", "/404", "/500",
                  "/forgot-password", "/index", "/home", "/docs",
                  "/home-v2", "/webview", "/messages", "/notifications",
                  "/points", "/search", "/ranking", "/profile",
                  "/support/terms-and-policies", "/payment-terms",
                  "/messages", "/support/document-center", "/support/terms-and-policies"}
    # 进一步过滤的"豁免入口"模板
    SAFE_PATH_PATTERNS = [
        r"^/api/",            # API 路径
        r"^/images/",         # 图片资源
        r"^/static/",         # 静态资源
        r"^/assets/",         # 资产
        r"^/public/",         # 公共资源
        r"^https?://",        # 外部链接
        r"^mailto:",          # 邮件
    ]
    dead_links = []
    safe_pattern_re = re.compile("|".join(SAFE_PATH_PATTERNS))
    for t in sorted(all_targets):
        if t in SAFE_PATHS or t in SAFE_TARGETS:
            continue
        if t in static_paths:
            continue
        # 豁免模式
        if safe_pattern_re.match(t):
            continue
        # 动态匹配
        matched = False
        for dr in dynamic_routes:
            pat = dr["path"]
            pat = re.sub(r":[a-zA-Z_]+", r"[^/]+", pat)
            pat = re.sub(r"\(\\\\d\+\)", r"\\d+", pat)
            pat = re.sub(r"\(\.\*\)", r".*", pat)
            pat = "^" + re.escape(pat).replace(r"\*", ".*") + "$"
            if re.match(pat, t):
                matched = True
                break
        if matched:
            continue
        # 动态前缀
        if "${" in t:
            continue
        # /x/:id 类型前缀匹配：/agents/123 可视为有 /agents/:id 入口（由父列表）
        prefix = re.sub(r"/[^/]+$", "", t)
        if prefix and prefix in static_paths:
            # 父级静态路由存在
            continue
        dead_links.append(t)

    # B. View 路由映射
    print(f"\n  路由表中 view_file 数量: {len(routed_view_files)}")
    print(f"  实际 views 目录文件数: {len(pages)}")
    # 哪些 view 被路由引用了（views/xxx.vue 或 components/xxx.vue 等）
    used_views_in_pages = routed_view_files & set(pages)
    used_views_in_src = routed_view_files & all_vue
    used_views = used_views_in_pages | used_views_in_src
    # 哪些 view 文件存在但路由未引用（孤儿 view）—— 仅在 views 目录里才算
    orphan_views = sorted(set(pages) - routed_view_files)
    # 哪些路由 view 引用了 src 下都不存在的文件（路由无 view）
    missing_views = sorted(routed_view_files - all_vue)

    # C. 路由无入口：静态路由无 inbound
    placeholder_paths = {r["path"] for r in placeholder_routes}
    routes_no_inbound = []
    for r in static_routes:
        p = r["path"]
        if p in SAFE_PATHS:
            continue
        if "*" in p or ":" in p:
            continue
        if p in placeholder_paths:
            # Phase C 等占位路由，不算作真实无入口
            continue
        if p not in inbound:
            routes_no_inbound.append(r)

    # D. 路由有 view 但该 view 文件本身没有被任何入口引用（双向孤儿）
    # 简化：view 自身有 path-literal 入口即可
    view_has_entry = set()
    for vf, entries in page_entries.items():
        if entries:
            view_has_entry.add(vf)

    # ========== 输出 ==========
    print("\n\n" + "=" * 80)
    print("完整度分析报告 v3")
    print("=" * 80)

    print(f"\n## 1. 概况")
    print(f"  - 静态路由: {len(static_routes)}")
    print(f"  - 动态路由: {len(dynamic_routes)}")
    print(f"  - View 文件总数: {len(pages)}")
    print(f"  - 被路由引用的 view: {len(routed_view_files & set(pages))}")
    print(f"  - 唯一跳转目标: {len(all_targets)}")

    print(f"\n## 2. 死链入口（target 不在路由表，{len(dead_links)} 个）")
    for t in dead_links:
        sources = inbound.get(t, [])
        src_list = ", ".join(f"{k}:{Path(s).name}:L{line}({typ})" for k, s, typ, line in sources)
        print(f"  {t}")
        print(f"    <- [{src_list}]")

    print(f"\n## 3. 路由有 view 但 view 文件不存在（{len(missing_views)} 个）")
    for vf in missing_views:
        rs = view_to_routes[vf]
        paths = ", ".join(r["path"] for r in rs)
        print(f"  {vf}  <-  路由 {paths}")

    print(f"\n## 4. View 文件存在但无任何路由引用（{len(orphan_views)} 个）")
    for vf in orphan_views:
        print(f"  {vf}")

    print(f"\n## 5. 已注册静态路由无任何入口引用（{len(routes_no_inbound)} 个）")
    for r in routes_no_inbound:
        vf = r["view_file"] or "(无view)"
        v_in_inbound = "有入口" if r["path"] in inbound else "无入口"
        flag = " ⚠️" if r["path"] not in inbound else ""
        print(f"  {r['path']}  [name={r['name']}, view={Path(vf).name if vf else '无'}]{flag}")

    print(f"\n## 6. 死链入口详细来源（按来源文件分组）")
    by_source = defaultdict(list)
    for t in dead_links:
        for k, s, typ, line in inbound.get(t, []):
            by_source[s].append((t, typ, line))
    for src, items in sorted(by_source.items()):
        print(f"  {src}:")
        for t, typ, line in items:
            print(f"    L{line}  {typ}  ->  {t}")

    # 保存 JSON
    output = {
        "static_routes": [{"path": r["path"], "name": r["name"], "view_file": r["view_file"]} for r in static_routes],
        "dynamic_routes": [{"path": r["path"], "name": r["name"]} for r in dynamic_routes],
        "pages": pages,
        "routed_view_files": sorted(routed_view_files),
        "orphan_views": orphan_views,
        "missing_views": missing_views,
        "dead_links": [{"target": t, "sources": inbound[t]} for t in dead_links],
        "routes_no_inbound": [{"path": r["path"], "name": r["name"], "view_file": r["view_file"], "module": r["module"]} for r in routes_no_inbound],
        "inbound": {t: inbound[t] for t in sorted(inbound.keys())},
    }
    out_path = r"g:\IHUI-AI\client\nav_audit.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2, default=str)
    print(f"\n\n详细数据已保存: {out_path}")


if __name__ == "__main__":
    main()
