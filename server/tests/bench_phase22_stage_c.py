"""
Stage C 性能 Benchmark — 真实数据, 不用 mock。

测量:
1. PersonaRegistry 启动加载耗时 (151 内置)
2. PersonaRegistry 检索 (加权 fuzzy) 1000 次
3. Codebase 索引构建 (1K 文件 mock 工作区)
4. Codebase 语义检索 (TF-IDF) 100 次
5. Codebase 增量更新 (git 模式) 50 次
"""
import asyncio
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# 允许 server 包导入 (从 server 目录运行)
sys.path.insert(0, ".")

from app.api.v1.workspace import codebase_incremental, persona_registry  # noqa: E402


def bench(label: str, fn, iters: int = 1):
    """跑 fn iters 次, 打印总耗时/平均/吞吐"""
    start = time.perf_counter()
    for _ in range(iters):
        result = fn()
    elapsed = time.perf_counter() - start
    avg_ms = elapsed * 1000 / iters
    if isinstance(result, list):
        print(f"  {label}: {avg_ms:.2f}ms/次 (总 {elapsed*1000:.0f}ms, 吞吐 {iters/elapsed:.0f} ops/s, 返回 {len(result)} 条)")
    else:
        print(f"  {label}: {avg_ms:.2f}ms/次 (总 {elapsed*1000:.0f}ms, 吞吐 {iters/elapsed:.0f} ops/s)")
    return elapsed


def main():
    print("\n=== Stage C 性能 Benchmark ===\n")

    # 隔离 personas
    tmp_personas = Path(tempfile.mkdtemp())
    os.environ["IHUI_PERSONAS_DIR"] = str(tmp_personas)
    persona_registry._registry = None

    try:
        # 1. PersonaRegistry 启动加载
        def load_registry():
            persona_registry._registry = None
            return persona_registry.get_persona_registry()
        reg = bench("PersonaRegistry 启动加载 (151 内置)", load_registry)
        personas = persona_registry.get_persona_registry().list_all()
        print(f"     实际加载数: {len(personas)}, 分类: {len(persona_registry.get_persona_registry().list_categories())}")

        # 2. Persona 检索 (加权)
        queries = ["code review", "frontend", "database", "test", "security",
                   "API design", "性能优化", "架构", "重构", "DevOps"]
        def search_persona():
            reg = persona_registry.get_persona_registry()
            return reg.search(queries[hash(str(id(reg))) % len(queries)], limit=10)
        bench("Persona 检索 (模糊加权)", search_persona, iters=1000)

        # 3. Persona CRUD
        def crud_ops():
            from app.api.v1.workspace.persona_registry import Persona
            reg = persona_registry.get_persona_registry()
            pid = f"bench-{time.time_ns()}"
            p = Persona(
                id=pid, name="Bench", category="engineering",
                description="bench test", system_prompt="x",
                tools=[], examples=[], tags=[],
            )
            reg.add(p)
            reg.disable(pid)
            reg.enable(pid)
            reg.delete(pid)
            return p
        bench("Persona CRUD (add + disable + enable + delete)", crud_ops, iters=100)

        # 4. Codebase 索引构建 (100 个 mock 文件)
        tmp_workspace = Path(tempfile.mkdtemp())
        # 创建 100 个 Python 文件
        for i in range(100):
            (tmp_workspace / f"file_{i}.py").write_text(
                f"def func_{i}():\n    return {i}\n\nclass Class_{i}:\n    pass\n"
            )
        # 设置阈值
        def build_index():
            return codebase_incremental.incremental_update(str(tmp_workspace))
        result = build_index()
        print(f"\n  Codebase 100 文件索引构建: sym={result.get('symbols_changed')}, sem={result.get('semantic_changed')}")

        # 5. 增量更新 (git 模式)
        subprocess.run(["git", "init", "-q"], cwd=str(tmp_workspace), check=True)
        subprocess.run(["git", "add", "-A"], cwd=str(tmp_workspace), check=True)
        subprocess.run(["git", "commit", "-q", "-m", "init"], cwd=str(tmp_workspace), check=True)
        # 后续更新
        def incremental():
            (tmp_workspace / f"file_extra_{time.time_ns()}.py").write_text("def x(): pass\n")
            return codebase_incremental.incremental_update(str(tmp_workspace))
        bench("Codebase 增量更新 (git + 1 文件)", incremental, iters=20)

        # 6. Codebase 检索 (semantic) — 用真实存在的 token
        def search_semantic():
            return codebase_incremental.search_codebase(str(tmp_workspace), "file_1", mode="semantic", limit=10)
        bench("Codebase 检索 (semantic 模式)", search_semantic, iters=50)

        def search_fuzzy():
            return codebase_incremental.search_codebase(str(tmp_workspace), "file_1", mode="fuzzy", limit=10)
        bench("Codebase 检索 (fuzzy 模式)", search_fuzzy, iters=50)

        def search_symbols():
            return codebase_incremental.search_codebase(str(tmp_workspace), "func_5", mode="symbols", limit=10)
        bench("Codebase 检索 (symbols 模式)", search_symbols, iters=50)

        shutil.rmtree(tmp_workspace, ignore_errors=True)

    finally:
        if "IHUI_PERSONAS_DIR" in os.environ:
            del os.environ["IHUI_PERSONAS_DIR"]
        persona_registry._registry = None
        shutil.rmtree(tmp_personas, ignore_errors=True)

    print("\n=== Benchmark 完成 ===\n")


if __name__ == "__main__":
    main()
