"""检测 OpenAPI duplicate operation_id — 考虑 router prefix。"""
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(r"g:\1\server\app")
ROUTER_FILE = ROOT / "api" / "v1" / "router.py"

text = ROUTER_FILE.read_text(encoding="utf-8", errors="ignore")
IMP_RE = re.compile(
    r'from\s+app\.api\.v1\.([\w.]+)\s+import\s+router\s+as\s+(\w+)'
)
# 必须同一行匹配（避免跨行）
INCLUDE_RE = re.compile(
    r'include_router\(\s*(\w+)\s*,\s*prefix\s*=\s*["\']([^"\']*)["\']'
)
INCLUDE_RE_NO_PREFIX = re.compile(
    r'include_router\(\s*(\w+)\s*\)'
)

VAR_TO_PREFIX = {}
for line in text.split("\n"):
    m = INCLUDE_RE.search(line)
    if m:
        VAR_TO_PREFIX[m.group(1)] = m.group(2)
        continue
    m2 = INCLUDE_RE_NO_PREFIX.search(line)
    if m2:
        VAR_TO_PREFIX[m2.group(1)] = ""

MODULE_TO_VAR = {}
for m in IMP_RE.finditer(text):
    MODULE_TO_VAR[m.group(1)] = m.group(2)

MODULE_TO_PREFIX = {mod: VAR_TO_PREFIX.get(var, "") for mod, var in MODULE_TO_VAR.items()}

METHOD_RE = re.compile(r'@router\.(get|post|put|delete|patch)\(\s*["\']([^"\']*)["\']')
DEF_RE = re.compile(r'(?:async\s+)?def\s+(\w+)\s*\(')
collisions = defaultdict(list)

for py in (ROOT / "api" / "v1").rglob("*.py"):
    if py.name in ("__init__.py", "router.py"):
        continue
    rel = py.relative_to(ROOT / "api" / "v1")
    module_path = ".".join(rel.with_suffix("").parts)
    prefix = MODULE_TO_PREFIX.get(module_path)
    if prefix is None:
        try:
            txt = py.read_text(encoding="utf-8", errors="ignore")
            pm = re.search(r'APIRouter\(\s*[^)]*prefix\s*=\s*["\']([^"\']*)["\']', txt)
            prefix = pm.group(1) if pm else ""
        except Exception:
            prefix = ""

    txt = py.read_text(encoding="utf-8", errors="ignore")
    lines = txt.split("\n")
    for i, line in enumerate(lines):
        m = METHOD_RE.search(line)
        if not m:
            continue
        method = m.group(1).upper()
        path = m.group(2)
        for j in range(i + 1, min(i + 5, len(lines))):
            dm = DEF_RE.search(lines[j])
            if dm:
                func = dm.group(1)
                op_id_match = re.search(r'operation_id\s*=\s*["\']([^"\']+)["\']', line)
                op_id = op_id_match.group(1) if op_id_match else f"{func}_{method.lower()}_{path}"
                full_path = (prefix or "") + path
                key = (full_path, method, op_id)
                collisions[key].append((str(py), func, i + 1, prefix, path))
                break

true_collisions = {k: v for k, v in collisions.items() if len(v) > 1}
print(f"\n=== 扫描: {sum(len(v) for v in collisions.values())} endpoints ===")
print(f"=== 真实重复 (考虑 prefix): {len(true_collisions)} 组 ===\n")

if true_collisions:
    for key, locs in true_collisions.items():
        full, method, op_id = key
        print(f"DUPLICATE: {method} {full}  operation_id={op_id}")
        for f, fn, ln, pref, p in locs:
            print(f"  - {f}:{ln}  func={fn}  (prefix={pref!r}, path={p!r})")
        print()
else:
    print("OK 没有发现重复 operation_id")
