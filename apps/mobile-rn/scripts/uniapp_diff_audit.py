# -*- coding: utf-8 -*-
"""
Uniapp 原项目 vs mobile-rn 新项目 差异审计脚本
=============================================
1. 页面清单对比(原 pages.json 注册页 vs 新 RootNavigator 路由)
2. 组件清单对比(原 src/components vs 新 src/components)
3. 页面-组件使用矩阵对比(原页面 template 用到的组件 vs 新 screen JSX 用到的组件)
输出: report/uniapp_diff_audit.json + 终端摘要
"""
import os
import re
import json
import sys
from collections import defaultdict

OLD_ROOT = r"D:\历史项目存档\zhs_app-ZZ\Ai-WXMiniVue\src"
NEW_ROOT = r"G:\IHUI-AI\apps\mobile-rn\src"
NEW_APP = r"G:\IHUI-AI\apps\mobile-rn"

PAGES_JSON = os.path.join(OLD_ROOT, "pages.json")


def load_pages_json():
    """解析原项目 pages.json 得到页面路径列表"""
    with open(PAGES_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    pages = []
    for p in data.get("pages", []):
        pages.append(p["path"])
    for sub in data.get("subPackages", []):
        root = sub.get("root", "")
        for p in sub.get("pages", []):
            pages.append(f"{root}/{p['path']}")
    return pages


def scan_vue_pages():
    """扫描原项目所有 .vue 页面文件(pages + pagesA + 主包)"""
    pages = {}
    for base in ["pages", "pagesA"]:
        d = os.path.join(OLD_ROOT, base)
        for dirpath, _, files in os.walk(d):
            for fn in files:
                if fn.endswith(".vue"):
                    full = os.path.join(dirpath, fn)
                    rel = os.path.relpath(full, OLD_ROOT).replace("\\", "/")
                    pages[rel] = full
    # 主包 pages/table 等
    for dirpath, _, files in os.walk(os.path.join(OLD_ROOT, "pages")):
        for fn in files:
            if fn.endswith(".vue"):
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, OLD_ROOT).replace("\\", "/")
                pages[rel] = full
    return pages


def extract_vue_components(filepath):
    """提取 .vue 文件中使用的组件标签(模板内大写/驼峰标签)"""
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    # 模板部分
    tmpl = re.search(r"<template>([\s\S]*?)</template>", content)
    if not tmpl:
        return set()
    t = tmpl.group(1)
    # 匹配组件标签: <Abc / <Abc.D / </Abc / <abc-d(忽略原生)
    tags = set()
    for m in re.finditer(r"<\/?([A-Z][A-Za-z0-9]*)", t):
        tags.add(m.group(1))
    for m in re.finditer(r"<\/?([a-z][a-z0-9-]*-[a-z0-9-]+)", t):
        tags.add(m.group(1))
    # import 的组件
    script = re.search(r"<script[^>]*>([\s\S]*?)</script>", content)
    if script:
        for m in re.finditer(r"import\s+([A-Za-z0-9_]+)\s+from\s+['\"]([^'\"]+)['\"]", script.group(1)):
            comp = m.group(1)
            if comp[0].isupper():
                tags.add(comp)
    return tags


def scan_old_components():
    """扫描原项目 src/components 下的组件目录/文件"""
    comps = {}
    d = os.path.join(OLD_ROOT, "components")
    for name in sorted(os.listdir(d)):
        full = os.path.join(d, name)
        if os.path.isdir(full):
            # 组件目录: 取目录名(index.vue 内含)
            idx = os.path.join(full, "index.vue")
            if os.path.exists(idx):
                comps[name] = idx
            else:
                comps[name] = full
        elif name.endswith(".vue"):
            comps[name[:-4]] = full
    return comps


def scan_new_components():
    """扫描新项目 src/components 下的组件文件"""
    comps = {}
    d = os.path.join(NEW_ROOT, "components")
    for name in sorted(os.listdir(d)):
        full = os.path.join(d, name)
        if os.path.isdir(full):
            comps[name] = full
        elif name.endswith(".tsx"):
            comps[name[:-4]] = full
    return comps


def scan_new_screens():
    """扫描新项目 screens 目录"""
    screens = {}
    d = os.path.join(NEW_ROOT, "screens")
    for name in sorted(os.listdir(d)):
        if name.endswith(".tsx"):
            screens[name[:-4]] = os.path.join(d, name)
    return screens


def extract_tsx_components(filepath):
    """提取 .tsx 中使用的组件标签(首字母大写 JSX 标签)"""
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    tags = set()
    for m in re.finditer(r"<([A-Z][A-Za-z0-9]*)(?=[\s/>])", content):
        tags.add(m.group(1))
    for m in re.finditer(r"</([A-Z][A-Za-z0-9]*)>", content):
        tags.add(m.group(1))
    return tags


def normalize_name(name):
    """规范化组件名用于跨端匹配:去掉通用后缀,统一小写"""
    n = re.sub(r"(Screen|Component|Vue|Dialog|Modal|Popup|PopUp|Panel|Card|Bar|List|Box|Block|Item|Row|Grid|View|Wrap|Wrapper|Container|Overlay|Drawer|Section|Header|Footer|Tab|Tabs|Page|Form|Btn|Button|Icon|Label|Input|Select|Option|Switch|Toggle|Slider|Chip|Tag|Badge|Avatar|Banner|Divider|Spinner|Loader|Empty|Error|Skeleton|Tree|Menu|Nav|NavBar|TopBar|BottomBar|Float|FloatBox|Floating|Global|Panel|Sheet|Layer|Content|Area|Zone|Group|Info|Detail|Header|Footer|Cell|Row|Col|Grid|List|Item)$", "", n, flags=re.IGNORECASE)
    return n.lower()


def main():
    report = {}
    # 1. 页面清单
    registered = load_pages_json()
    old_pages = scan_vue_pages()
    new_screens = scan_new_screens()

    # 路由名从 RootNavigator.tsx 提取
    nav_path = os.path.join(NEW_APP, "src", "navigation", "RootNavigator.tsx")
    with open(nav_path, "r", encoding="utf-8") as f:
        nav_src = f.read()
    routes = set(re.findall(r'name="([A-Za-z0-9]+)"', nav_src))

    # 2. 组件清单
    old_comps = scan_old_components()
    new_comps = scan_new_components()

    report["old_registered_pages"] = registered
    report["new_routes"] = sorted(routes)
    report["old_components"] = sorted(old_comps.keys())
    report["new_components"] = sorted(new_comps.keys())

    # 3. 页面-组件使用矩阵(挑原项目主要页面)
    usage = {}
    for rel, full in sorted(old_pages.items()):
        tags = extract_vue_components(full)
        # 过滤掉新项目组件也有的 / 常见原生
        usage[rel] = sorted(tags)
    report["old_page_component_usage"] = usage

    # 新 screen 组件使用
    new_usage = {}
    for name, full in sorted(new_screens.items()):
        new_usage[name] = sorted(extract_tsx_components(full))
    report["new_screen_component_usage"] = new_usage

    # 4. 汇总统计
    summary = {
        "old_vue_files": len(old_pages),
        "old_registered_pages": len(registered),
        "new_screens": len(new_screens),
        "new_routes": len(routes),
        "old_components": len(old_comps),
        "new_components": len(new_comps),
    }
    report["summary"] = summary

    out_dir = os.path.join(NEW_APP, "report")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "uniapp_diff_audit.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("=== 汇总 ===")
    for k, v in summary.items():
        print(f"  {k}: {v}")
    print(f"\n报告已输出: {out_path}")


if __name__ == "__main__":
    main()
