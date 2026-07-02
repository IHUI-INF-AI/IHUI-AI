#!/usr/bin/env python3
"""检查 app/models 与 app/schemas 的 import 边界，防止 Pydantic/SQLAlchemy 混用。

架构约定：
- app/models/*.py  —— SQLAlchemy ORM 模型层，禁止 `from pydantic import ...`
  （Pydantic BaseModel 属于 schemas 层，混入 models 会导致职责模糊，
   如已迁移的 tbox_models.py 改为 re-export shim）
- app/schemas/*.py —— Pydantic 响应模型层，禁止 `from sqlalchemy import ...`
  （SQLAlchemy 属于 models 层，schemas 不应直接依赖 ORM）

使用 AST 解析，可靠识别多行 import、注释中的 import 不会误报。

用法：
    cd server && python scripts/check_import_boundaries.py
    # CI: python scripts/check_import_boundaries.py --strict

参数：
    --strict  显式严格模式（默认即严格，任何违规都返回 exit 1，便于 CI 使用）

退出码：
    0 = 无违规
    1 = 存在违规
"""

from __future__ import annotations

import ast
import sys
from dataclasses import dataclass
from pathlib import Path

# ── 规则定义 ────────────────────────────────────────────────

@dataclass
class BoundaryRule:
    """单条边界规则。"""
    directory: str          # 目标目录（相对 server/）
    forbidden_module: str   # 禁止导入的顶层模块名
    description: str        # 规则说明
    allowlist: tuple[str, ...] = ()  # 豁免文件名（不含目录）


RULES = [
    BoundaryRule(
        directory="app/models",
        forbidden_module="pydantic",
        description="models 层应为纯 SQLAlchemy ORM，禁止导入 pydantic（BaseModel 属于 schemas 层）",
    ),
    BoundaryRule(
        directory="app/schemas",
        forbidden_module="sqlalchemy",
        description="schemas 层应为纯 Pydantic 模型，禁止导入 sqlalchemy（ORM 属于 models 层）",
    ),
]


# ── AST 检查 ────────────────────────────────────────────────

def _is_import_of(node: ast.AST, target: str) -> bool:
    """判断 AST 节点是否导入了 target 模块。

    覆盖：
    - import pydantic
    - from pydantic import BaseModel
    - from pydantic.v1 import BaseModel  （兼容 v1 命名空间）
    - import sqlalchemy
    - from sqlalchemy import Column
    - from sqlalchemy.orm import relationship
    """
    if isinstance(node, ast.Import):
        for alias in node.names:
            top = alias.name.split(".")[0]
            if top == target:
                return True
    elif isinstance(node, ast.ImportFrom):
        if node.module:
            top = node.module.split(".")[0]
            if top == target:
                return True
    return False


def check_file(path: Path, rule: BoundaryRule) -> list[str]:
    """检查单个文件是否违反规则，返回违规描述列表。"""
    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        return [f"  ⚠ 无法读取 {path}: {exc}"]

    # 文件名豁免（如 __init__.py 可能需要 re-export）
    if path.name in rule.allowlist:
        return []

    try:
        tree = ast.parse(source, filename=str(path))
    except SyntaxError as exc:
        return [f"  ⚠ 语法错误 {path}:{exc.lineno}: {exc.msg}"]

    violations: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)) and _is_import_of(node, rule.forbidden_module):
            lineno = getattr(node, "lineno", 0)
            # 取 import 语句的源码片段，便于定位
            line_src = source.splitlines()[lineno - 1].strip() if lineno <= len(source.splitlines()) else ""
            violations.append(
                f"  ✗ {path.relative_to(Path.cwd())}:{lineno}  {line_src}"
            )
    return violations


# ── 主流程 ──────────────────────────────────────────────────

def main() -> int:
    # Windows 控制台默认 GBK，强制 UTF-8 以输出 ✓/✗ 等 Unicode 字符
    # 必须在 argparse 之前执行，否则 --help 输出会乱码
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except AttributeError:
        pass  # 非 Windows 或不支持 reconfigure，忽略

    import argparse

    parser = argparse.ArgumentParser(description="检查 app/models 与 app/schemas 的 import 边界")
    parser.add_argument(
        "--strict",
        action="store_true",
        default=True,
        help="显式严格模式（默认即严格，任何违规都返回 exit 1）",
    )
    args = parser.parse_args()

    cwd = Path.cwd()
    total_violations = 0

    for rule in RULES:
        target_dir = cwd / rule.directory
        print(f"\n=== 检查 {rule.directory}/ 禁止导入 {rule.forbidden_module} ===")
        print(f"    规则: {rule.description}")

        if not target_dir.is_dir():
            print(f"    ⚠ 目录不存在: {target_dir}")
            continue

        py_files = sorted(target_dir.rglob("*.py"))
        all_violations: list[str] = []

        for py_file in py_files:
            # 跳过 __pycache__
            if "__pycache__" in py_file.parts:
                continue
            all_violations.extend(check_file(py_file, rule))

        if all_violations:
            print(f"    发现 {len(all_violations)} 处违规:")
            for v in all_violations:
                print(v)
            total_violations += len(all_violations)
        else:
            print(f"    ✓ 通过（扫描 {len(py_files)} 个 .py 文件，无 {rule.forbidden_module} 导入）")

    print("\n" + "=" * 60)
    if total_violations == 0:
        print("✓ import 边界检查全部通过")
        return 0
    print(f"✗ import 边界检查失败：{total_violations} 处违规")
    print("  修复指引：")
    print("  - models/*.py 中的 Pydantic BaseModel 应迁移到 schemas/*.py")
    print("  - schemas/*.py 中的 SQLAlchemy 导入应改为从 models 引用或用 Pydantic 重新建模")
    return 1


if __name__ == "__main__":
    sys.exit(main())
