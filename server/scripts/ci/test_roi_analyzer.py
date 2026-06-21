"""测试 ROI 分级与减法候选识别 (Phase 12) - v3 精简版.

基础数据:
  - .tmp_durations.txt: pytest --durations=0 输出 (606 个 call + 1291 个 < 5ms 隐藏)
  - .tmp_nodeids.txt: pytest 收集的 1897 个 test func 名
  - .tmp_meta.json: 文件级 LOC/funcs

只对"文件级"做 ROI 评分, 不再逐 test 算.
"""

from __future__ import annotations

import ast
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

DUR_FILE = Path(".tmp_durations.txt")
NODE_FILE = Path(".tmp_nodeids.txt")
META_FILE = Path(".tmp_meta.json")
OUT_JSON = Path(".tmp_roi.json")
TESTS_DIR = Path("tests")
HIDDEN_FAST_AVG_S = 0.0025


def parse_durations(path: Path) -> dict:
    out = {}
    pat = re.compile(r"^([\d.]+)s\s+(?:call|setup|teardown)\s+(\S+)")
    for line in path.read_text(encoding="utf-8").splitlines():
        m = pat.match(line)
        if m:
            tid = m.group(2)
            # 同一 nodeid 可能出现 call + setup + teardown 三个, 取总和
            out[tid] = out.get(tid, 0.0) + float(m.group(1))
    return out


def parse_nodeids(path: Path) -> list:
    return [l.strip() for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def parse_test_file(path: Path) -> dict:
    """返回 { functions: [...], imports: set, classes: [...] }"""
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return {"functions": [], "imports": set(), "classes": []}
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return {"functions": [], "imports": set(), "classes": []}
    funcs, classes, imports = [], set(), set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith("app"):
            imports.add(node.module.split(".")[1] if "." in node.module else node.module)
        elif isinstance(node, ast.Import):
            for n in node.names:
                if n.name.startswith("app"):
                    imports.add(n.name.split(".")[1] if "." in n.name else n.name)
        if isinstance(node, ast.ClassDef) and node.name.startswith("Test"):
            classes.add(node.name)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test_"):
            # 包含 assert / pytest.raises / with raises / raises( 都算"有断言"
            n_raises = 0
            for sub in ast.walk(node):
                if isinstance(sub, ast.Call):
                    func = sub.func
                    if (isinstance(func, ast.Attribute) and func.attr == "raises") or (
                        isinstance(func, ast.Name) and func.id == "raises"
                    ):
                        n_raises += 1
            n_assert = sum(isinstance(n, ast.Assert) for n in ast.walk(node))
            has_parametrize = any(
                (isinstance(d, ast.Call) and getattr(getattr(d.func, "value", None), "attr", "") == "parametrize")
                or (isinstance(d, ast.Attribute) and d.attr == "parametrize")
                for d in node.decorator_list
            )
            funcs.append(
                {
                    "name": node.name,
                    "loc": (node.end_lineno or 0) - (node.lineno or 0) + 1,
                    "assert_count": n_assert,
                    "raises_count": n_raises,
                    "has_parametrize": has_parametrize,
                }
            )
    return {"functions": funcs, "imports": imports, "classes": list(classes)}


HIGH_VALUE_KEYS = {
    "e2e": 1.5,
    "drill": 1.5,
    "real": 1.0,
    "production": 1.5,
    "critical": 1.0,
    "alert": 1.0,
    "canary": 1.0,
    "rollback": 1.0,
    "migration": 0.5,
    "tenant": 0.5,
    "pagerduty": 1.0,
    "webhook": 0.5,
    "shadow": 0.5,
    "openapi": 1.0,
    "inhibition": 1.0,
    "billing": 1.0,
    "payment": 1.0,
    "reconcile": 1.0,
    "alembic": 0.5,
    "pydantic": 0.5,
    "smoke": -0.5,
    "ffmpeg": 0,
    "video": 0,
    "check_": 0.5,  # 通用 "检查脚本" 测试
}
LOW_VALUE_KEYS = {
    "placeholder": -2,
    "wip": -2,
    "tmp": -2,
    "skeleton": -1.5,
    "noop": -1.5,
}
HIGH_COST_KEYS = {
    "real_redis": 2,
    "real_db": 2,
    "real_video": 3,
    "ffmpeg": 2,
    "smoke_bench": 3,
    "locust": 3,
    "drill": 1,
    "e2e_full": 1,
    "loadtest": 2,
}


def calc_value(fname: str, funcs: list, app_mod_count: int) -> float:
    """文件级价值分 1-5."""
    low = fname.lower()
    score = 3.0
    for k, v in HIGH_VALUE_KEYS.items():
        if k in low:
            score += v
    for k, v in LOW_VALUE_KEYS.items():
        if k in low:
            score += v
    # 真实断言加分
    total_asserts = sum(f["assert_count"] + f["raises_count"] for f in funcs)
    avg_asserts = total_asserts / max(1, len(funcs))
    if avg_asserts >= 3:
        score += 0.5
    if avg_asserts < 0.5:
        score -= 0.5
    # 集成测试 (覆盖 2+ 模块)
    if app_mod_count >= 2:
        score += 0.5
    return max(1.0, min(5.0, score))


def calc_cost(fname: str, avg_dur_s: float) -> float:
    low = fname.lower()
    score = 1.0
    if avg_dur_s > 0.05:
        score = 2.0
    if avg_dur_s > 0.3:
        score = 3.0
    if avg_dur_s > 1.0:
        score = 4.0
    if avg_dur_s > 5.0:
        score = 5.0
    for k, v in HIGH_COST_KEYS.items():
        if k in low:
            score = min(5.0, score + v)
    return max(1.0, score)


def main():
    print("[1] 加载数据 ...")
    durations = parse_durations(DUR_FILE)
    nodeids = parse_nodeids(NODE_FILE)
    print(f"    nodeids: {len(nodeids)}, durations: {len(durations)}")

    # 按文件聚合 nodeids
    file_nodeids = defaultdict(list)
    for nid in nodeids:
        # 形式: tests/test_xxx.py::test_yyy 或 tests/test_xxx.py::TestCls::test_yyy
        # pytest collect-only 给我的是 func 名列表, 不是 nodeid, 我得用 durations
        pass

    # 用 durations 当主基础 (因为它带 file path)
    file_tests = defaultdict(list)  # file -> [(nodeid, dur_s)]
    for nid, dur in durations.items():
        if "::" not in nid:
            continue
        file_part = nid.split("::")[0]
        fname = file_part.split("/")[-1] if "/" in file_part else file_part.split("\\")[-1]
        file_tests[fname].append((nid, dur))

    # 加 < 5ms 隐藏的估算
    for nid in nodeids:
        # 把 func name 反推文件
        for f in TESTS_DIR.glob("test_*.py"):
            if f.stem.replace("test_", "") in nid:
                if not any(nid == nt[0] for nt in file_tests[f.name]):
                    file_tests[f.name].append((nid, HIDDEN_FAST_AVG_S))
                break

    # 解析每个测试文件
    print("[2] 解析测试文件 AST ...")
    file_ast = {}
    for f in sorted(TESTS_DIR.glob("test_*.py")):
        file_ast[f.name] = parse_test_file(f)

    # 计算 ROI
    print("[3] 计算 ROI ...")
    file_roi = {}
    for fname, tests in file_tests.items():
        if not tests:
            continue
        n = len(tests)
        total_s = sum(d for _, d in tests)
        max_s = max(d for _, d in tests)
        avg_dur_s = total_s / n
        ast_info = file_ast.get(fname, {"functions": [], "imports": set()})
        n_funcs = len(ast_info["functions"])
        avg_v = calc_value(fname, ast_info["functions"], len(ast_info["imports"]))
        avg_c = calc_cost(fname, avg_dur_s)
        # 零断言率
        zero_assert = sum(1 for f in ast_info["functions"] if f["assert_count"] + f["raises_count"] == 0)
        zero_assert_ratio = zero_assert / max(1, n_funcs)
        # ROI
        roi = (avg_v / max(1, avg_c)) * (1 - 0.4 * zero_assert_ratio)
        # grade
        if roi >= 1.5 and avg_v >= 3.5 and zero_assert_ratio < 0.2:
            grade = "A"
        elif roi >= 0.9 and avg_v >= 2.5:
            grade = "B"
        elif roi >= 0.5 and avg_v >= 2.0:
            grade = "C"
        else:
            grade = "D"
        file_roi[fname] = {
            "tests": n,
            "src_funcs": n_funcs,
            "total_s": round(total_s, 2),
            "max_s": round(max_s, 3),
            "avg_dur_ms": round(avg_dur_s * 1000, 1),
            "avg_value": round(avg_v, 2),
            "avg_cost": round(avg_c, 2),
            "zero_assert": zero_assert,
            "zero_assert_ratio": round(zero_assert_ratio, 2),
            "roi": round(roi, 2),
            "grade": grade,
            "imports": sorted(ast_info["imports"]),
        }

    OUT_JSON.write_text(json.dumps(file_roi, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[4] 写入 {OUT_JSON}")

    # 汇总
    grade_n = Counter(s["grade"] for s in file_roi.values())
    grade_tests = Counter()
    grade_time = defaultdict(float)
    for f, s in file_roi.items():
        grade_tests[s["grade"]] += s["tests"]
        grade_time[s["grade"]] += s["total_s"]

    print("\n=== 总览 ===")
    print(f"测试文件: {len(file_roi)}, 测试数: {sum(s['tests'] for s in file_roi.values())}")
    print(f"总耗时:   {sum(s['total_s'] for s in file_roi.values()):.1f}s")
    print("\n分级:")
    for g in "ABCD":
        n = grade_n[g]
        t = grade_tests[g]
        tm = grade_time[g]
        print(f"  {g}: {n:3d} 文件 / {t:4d} 测试 / {tm:6.1f}s")

    print(f"\n=== D 级 (强烈建议删/合并): {grade_n['D']} 文件 ===")
    for f, s in sorted(file_roi.items(), key=lambda x: x[1]["roi"]):
        if s["grade"] == "D":
            print(
                f"  {f:45s} tests={s['tests']:3d}  V={s['avg_value']:.1f}  C={s['avg_cost']:.1f}  "
                f"zeroAssert={s['zero_assert_ratio']:.0%}  roi={s['roi']:.2f}"
            )

    print(f"\n=== C 级 (可裁): {grade_n['C']} 文件 ===")
    for f, s in sorted(file_roi.items(), key=lambda x: x[1]["roi"]):
        if s["grade"] == "C":
            print(
                f"  {f:45s} tests={s['tests']:3d}  V={s['avg_value']:.1f}  C={s['avg_cost']:.1f}  "
                f"zeroAssert={s['zero_assert_ratio']:.0%}  roi={s['roi']:.2f}"
            )


if __name__ == "__main__":
    main()
