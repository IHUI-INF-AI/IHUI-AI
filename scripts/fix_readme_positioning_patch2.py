"""README.md 残留话术补丁(2026-07-23)。

处理 fix_readme_srs_and_positioning.py 遗漏的 3 处:
- L9:   副标题 "一个仓库替代 6 个 SaaS"
- L239: 表头 "一个仓库替代 6 个 SaaS"
- L259: 表格行 "一站式替代 4-6 个 SaaS"(不含 ",月省 $300+",前轮 POS-6 未命中)
"""
import io
import sys
from pathlib import Path

README = Path("g:/IHUI-AI/README.md")

REPLACEMENTS = [
    # L9 副标题 + L239 表头(两处相同子串)
    ("一个仓库替代 6 个 SaaS",
     "一个仓库集成 6 类 SaaS 能力"),
    # L259 表格行(不含 ",月省 $300+")
    ("一站式替代 4-6 个 SaaS",
     "一站式集成 4-6 类 SaaS 能力(实际覆盖度:支付 ~15% / 身份 ~40% / 产品分析 ~5% / 可观测 ~30%)"),
]


def run():
    with io.open(README, "r", encoding="utf-8") as f:
        content = f.read()

    original_len = len(content)
    total = 0
    failures = []

    for i, (old, new) in enumerate(REPLACEMENTS, 1):
        count = content.count(old)
        if count == 0:
            failures.append(f"R-{i}: 未找到 '{old[:40]}'")
            print(f"  [FAIL] R-{i}: 0 处")
            continue
        content = content.replace(old, new)
        total += count
        print(f"  [OK]   R-{i}: {count} 处")

    if failures:
        print(f"[FAIL] {len(failures)} 条未命中", file=sys.stderr)
        sys.exit(1)

    with io.open(README, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[DONE] 共替换 {total} 处,大小 {original_len} → {len(content)} bytes")


if __name__ == "__main__":
    run()
