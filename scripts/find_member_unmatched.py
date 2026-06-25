"""详细列出 member service 缺失的端点."""
import re
import json
from collections import defaultdict
from pathlib import Path

H_DRIVE = Path(r"H:\历史项目存档\code\edu\service\service")
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")

# 收集 Java 端点 (ihui-ai-edu-member-service)
svc_path = H_DRIVE / "ihui-ai-edu-member-service" / "src" / "main" / "java"
java_eps = []
for f in svc_path.rglob("*Controller.java"):
    if f.name in ("BaseController.java",):
        continue
    content = f.read_text(encoding="utf-8", errors="ignore")
    class_prefix = ""
    for pat in [r'@RequestMapping\s*\(\s*value\s*=\s*"([^"]+)"', r'@RequestMapping\s*\(\s*"([^"]+)"']:
        m = re.search(pat, content)
        if m:
            class_prefix = m.group(1)
            break
    methods = re.findall(r'@(Get|Post|Put|Delete)Mapping[^)]*?["\']([^"\']+)["\']', content)
    if not methods:
        methods = re.findall(r'@(Get|Post|Put|Delete)Mapping\s*\(\s*\)', content)
        methods = [(m, "") for m in methods]
    seen = set()
    for http, path in methods:
        full = (class_prefix + path).rstrip("/") if path else class_prefix.rstrip("/")
        key = (http, full)
        if key in seen:
            continue
        seen.add(key)
        norm = full
        for prefix in ["/auth-api/", "/public-api/"]:
            if norm.startswith(prefix):
                norm = norm[len(prefix):]
        java_eps.append({"controller": f.stem, "http": http, "path": full, "norm": norm})

# 收集 Python 端点 (含 legacy_compat, member_legacy)
py_eps = []
for py_file in G_DRIVE_API.rglob("*.py"):
    if py_file.name == "__init__.py" or "__pycache__" in str(py_file):
        continue
    try:
        content = py_file.read_text(encoding="utf-8")
    except:
        continue
    rel = str(py_file.relative_to(G_DRIVE_API)).replace("\\", "/")
    for m in re.finditer(r'@router\.(get|post|put|delete)\s*\(\s*["\']([^"\']+)["\']', content):
        py_eps.append({"file": rel, "http": m.group(1).upper(), "path": m.group(2)})

# 对每个 Java 端点, 找出是否有匹配
def match(je, py_eps):
    http = je["http"].upper()
    norm = je["norm"].lstrip("/")
    segs = [s for s in re.split(r'[/\{\}]', norm) if s]
    last1 = segs[-1] if segs else ""
    last2 = "/".join(segs[-2:]) if len(segs) >= 2 else last1
    for py in py_eps:
        if py["http"] != http:
            continue
        py_path = py["path"].lstrip("/")
        py_segs = [s for s in re.split(r'[/\{\}]', py_path) if s]
        py_last1 = py_segs[-1] if py_segs else ""
        py_last2 = "/".join(py_segs[-2:]) if len(py_segs) >= 2 else py_last1
        if last2 and last2 == py_last2:
            return py
        if last1 and last1 == py_last1 and last1 not in ["list", "info", "page", "tree", "all", "count"]:
            return py
        if last1 and py_last1 and last1 == py_last1 and len(last1) >= 4:
            return py
    return None

# 找出未匹配
unmatched = []
for je in java_eps:
    m = match(je, py_eps)
    if not m:
        unmatched.append(je)

# 按 Controller 分组
by_ctrl = defaultdict(list)
for je in unmatched:
    by_ctrl[je["controller"]].append(je)

print("=" * 80)
print("未匹配的 Member 端点 (8 个):")
print("=" * 80)
for ctrl, eps in sorted(by_ctrl.items()):
    print(f"\n{ctrl}:")
    for je in eps:
        print(f"  {je['http']:6s} {je['path']}")
