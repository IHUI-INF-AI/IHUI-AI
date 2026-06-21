"""Comprehensive code quality scanner v3 — accurate function length measurement."""

import os
import re
from collections import defaultdict

APP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app")

py_files = []
for root, dirs, files in os.walk(APP_DIR):
    if "__pycache__" in root:
        continue
    for f in files:
        if f.endswith(".py"):
            py_files.append(os.path.join(root, f))

print(f"Scanning {len(py_files)} Python files in {APP_DIR}\n")

# ── 1. Empty except:pass ──
empty_except = []
for fpath in py_files:
    with open(fpath, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.match(r"^except\b", stripped) and ":" in stripped:
            for j in range(i + 1, min(i + 4, len(lines))):
                next_line = lines[j].strip()
                if next_line == "":
                    continue
                if next_line == "pass":
                    empty_except.append((fpath, i + 1, stripped))
                break

print(f"=== 1. EMPTY EXCEPT:PASS ({len(empty_except)} found) ===")
by_file = defaultdict(list)
for fpath, lineno, code in empty_except:
    rel = os.path.relpath(fpath, APP_DIR)
    by_file[rel].append(lineno)
for fpath, lines_list in sorted(by_file.items(), key=lambda x: -len(x[1])):
    print(f"  {fpath}: lines {lines_list}")


# ── 2. Long functions (>50 lines) — accurate measurement ──
def get_func_end(lines, start_idx, base_indent):
    """Find the actual end of a function by looking for next def/class/decorator at same or lesser indent."""
    for j in range(start_idx + 1, len(lines)):
        l = lines[j]
        if l.strip() == "":
            continue
        cur_indent = len(l) - len(l.lstrip())
        if cur_indent <= base_indent:
            stripped = l.strip()
            # Only break on def, async def, class, or decorator at same/higher level
            if re.match(r"^((async\s+)?def |class |@)", stripped):
                return j
            # Also break on non-indented non-comment code at same level
            if cur_indent < base_indent:
                return j
    return len(lines)


long_funcs = []
for fpath in py_files:
    with open(fpath, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        m = re.match(r"^(\s*)(?:async\s+)?def (\w+)\s*\(", line)
        if m:
            base_indent = len(m.group(1))
            end = get_func_end(lines, i, base_indent)
            length = end - i
            if length > 50:
                rel = os.path.relpath(fpath, APP_DIR)
                # Count actual content lines (non-blank, non-comment)
                content = sum(1 for j in range(i, end) if lines[j].strip() and not lines[j].strip().startswith("#"))
                long_funcs.append((rel, m.group(2), i + 1, length, content, base_indent))

long_funcs.sort(key=lambda x: -x[4])  # Sort by content lines
print(f"\n=== 2. LONG FUNCTIONS >50 lines ({len(long_funcs)} found) ===")
print(f"  {'File':<50} {'Function':<30} {'Lines':>6} {'Content':>8} {'Indent':>7}")
print(f"  {'-'*50} {'-'*30} {'-'*6} {'-'*8} {'-'*7}")
for fpath, name, lineno, length, content, indent in long_funcs[:40]:
    ind_label = f"[i={indent}]" if indent > 0 else ""
    print(f"  {fpath:<50} {name:<30} {length:>6} {content:>8} {ind_label:>7}")
if len(long_funcs) > 40:
    print(f"  ... and {len(long_funcs) - 40} more")

# ── 3. Duplicate imports ──
dup_imports = []
for fpath in py_files:
    with open(fpath, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    import_counts = defaultdict(list)
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("import ") or stripped.startswith("from "):
            import_counts[stripped].append(i + 1)
    for imp, line_list in import_counts.items():
        if len(line_list) > 1:
            rel = os.path.relpath(fpath, APP_DIR)
            dup_imports.append((rel, imp, line_list))

print(f"\n=== 3. DUPLICATE IMPORTS ({len(dup_imports)} found) ===")
for fpath, imp, lines_list in dup_imports[:20]:
    print(f"  {fpath}: lines {lines_list}")
    print(f"    {imp[:80]}")

# ── 4. TODO/FIXME/HACK ──
todos = []
for fpath in py_files:
    with open(fpath, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("#") and re.search(r"\b(TODO|FIXME|HACK)\b", stripped, re.IGNORECASE):
            rel = os.path.relpath(fpath, APP_DIR)
            todos.append((rel, i + 1, stripped))

print(f"\n=== 4. TODO/FIXME/HACK ({len(todos)} found) ===")
for fpath, lineno, text in todos:
    print(f"  {fpath}:{lineno} {text[:100]}")

# ── 5. Bare except (no exception type) ──
bare_except = []
for fpath in py_files:
    with open(fpath, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.match(r"^except\s*:", stripped):
            rel = os.path.relpath(fpath, APP_DIR)
            bare_except.append((rel, i + 1))

print(f"\n=== 5. BARE EXCEPT (no exception type) ({len(bare_except)} found) ===")
for fpath, lineno in bare_except[:20]:
    print(f"  {fpath}:{lineno}")
if len(bare_except) > 20:
    print(f"  ... and {len(bare_except) - 20} more")

# ── Summary ──
print(f"\n{'=' * 60}")
print("  SUMMARY")
print(f"  Empty except:pass     : {len(empty_except)}")
print(f"  Long functions (>50)  : {len(long_funcs)}")
print(f"  Duplicate imports     : {len(dup_imports)}")
print(f"  TODO/FIXME/HACK       : {len(todos)}")
print(f"  Bare except           : {len(bare_except)}")
total = len(empty_except) + len(long_funcs) + len(dup_imports) + len(todos) + len(bare_except)
print(f"  Total issues          : {total}")
print(f"{'=' * 60}")
