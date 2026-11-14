# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""代码符号索引 ``CodeSymbolGraph`` —— 轻量跨语言符号图(2026-11-15 立)。

来源(四程序逆向 T3§D / T4§D)
------------------------------
- Qoder Knowledge Graph:Claude Code 无索引,需人工 grep;Qoder 自动构建、增量维护。
- Cursor codebase indexing:语义检索"代码库中做 X 的地方"。
- Trae CODE_INDEXING:跨文件代码索引与导航(含 @codebase/@Doc)。
- Augment context engine:检索"哪个文件/符号处理此请求"。

复用 vs 新增(单一真相源,不重复造)
-----------------------------------
- **搜索预算**:``services/tool_surface_budget.py`` 已有(按 schema 字节分层)。
  本模块**不复述**它;符号索引产出的候选列表可交给它排预算。
- **通用知识图**:``services/knowledge_graph.py`` 是 NER 实体关系(自然语言),
  不是代码符号;两者用途不同,不合并。
- 本模块补的是**代码符号级**索引:`symbol_index / callers / references / impact`。

范围与诚实边界
--------------
- 纯 Python 正则实现,轻量(不引入 tree-sitter / LSP)。支持 TS/TSX/JS/JSX/Py
  的函数/类/导入/调用粗粒度抽取。这是**近似**,不是编译器级;复杂场景(宏、
  重载、动态属性)会漏,已在返回里带 ``approximate=True`` 标注。
- 不做嵌入向量语义检索(那需模型);只做符号名/引用的**精确/正则**图。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# 跨语言符号抽取(轻量正则;approximate)
_SYMBOL_PATTERNS: tuple[tuple[str, str], ...] = (
    # TS/JS: export function foo / function foo / export const foo = (...) =>
    ("function", r"\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)"),
    ("class", r"\b(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)"),
    ("const", r"\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*="),
    # Python
    ("def", r"^\s*def\s+([A-Za-z_]\w*)\s*\("),
    ("class", r"^\s*class\s+([A-Za-z_]\w*)\s*[:\(]"),
    ("import", r"^\s*(?:from\s+[\w.]+\s+)?import\s+([\w.,\s]+)"),
)

_CALL_RE = re.compile(r"\b([A-Za-z_$][\w$]*)\s*\(")


@dataclass
class Symbol:
    """一个被索引的符号。"""

    name: str
    kind: str  # function / class / const / def / import
    file: str
    line: int

    def to_dict(self) -> dict[str, object]:
        return {"name": self.name, "kind": self.kind, "file": self.file, "line": self.line}


@dataclass
class SymbolGraph:
    """一次索引的产物。"""

    symbols: list[Symbol] = field(default_factory=list)
    # 调用边:name -> {(caller_file, caller_symbol)}
    call_edges: dict[str, set[tuple[str, str]]] = field(default_factory=dict)
    files_indexed: int = 0
    approximate: bool = True  # 正则近似,非编译器级

    def to_dict(self) -> dict[str, object]:
        return {
            "symbols": [s.to_dict() for s in self.symbols],
            "call_edges": {k: sorted(f"{f}:{s}" for f, s in v) for k, v in self.call_edges.items()},
            "files_indexed": self.files_indexed,
            "approximate": self.approximate,
        }


def index_code(files: dict[str, str]) -> SymbolGraph:
    """索引若干源文件,产出符号图。

    Args:
        files: {相对路径: 源码文本}。调用方负责收集文件;本函数不碰磁盘。

    Returns:
        ``SymbolGraph``。``approximate=True`` 常置(正则近似)。
    """
    graph = SymbolGraph(files_indexed=len(files))
    for path, text in files.items():
        lines = text.split("\n")
        # 当前文件里定义过的符号名(用于把裸调用归到"最近定义的符号"作 caller)
        local_defs: list[tuple[int, str]] = []  # (line, name)
        for lineno, raw in enumerate(lines, start=1):
            line = raw
            stripped = line.strip()
            for kind, pat in _SYMBOL_PATTERNS:
                m = re.search(pat, line)
                if m:
                    for name in _extract_names(kind, m):
                        sym = Symbol(name=name, kind=kind, file=path, line=lineno)
                        graph.symbols.append(sym)
                        if kind in ("function", "class", "def", "const"):
                            local_defs.append((lineno, name))
            # 调用边:该行出现的 foo( 调用
            for cm in _CALL_RE.finditer(line):
                callee = cm.group(1)
                if callee in ("if", "for", "while", "switch", "catch", "return", "function"):
                    continue
                caller = _nearest_def(local_defs, lineno)
                graph.call_edges.setdefault(callee, set()).add((path, caller or "<module>"))
    return graph


def _extract_names(kind: str, m: re.Match) -> list[str]:
    if kind == "import":
        # import a, b / from x import y —— 取每个名字
        return [p.strip().split(" as ")[0].strip() for p in m.group(1).split(",") if p.strip()]
    return [m.group(1)]


def _nearest_def(local_defs: list[tuple[int, str]], lineno: int) -> str | None:
    best: tuple[int, str] | None = None
    for ln, name in local_defs:
        if ln <= lineno:
            best = (ln, name)
        else:
            break
    return best[1] if best else None


def find_references(graph: SymbolGraph, name: str) -> list[tuple[str, str]]:
    """返回所有引用 name 的 (file, caller_symbol)。"""
    return sorted(graph.call_edges.get(name, set()))


def impact_set(graph: SymbolGraph, name: str, max_depth: int = 3) -> set[str]:
    """name 被改动的影响面:从 name 出发做反向可达(BFS,深度受限)。

    注意:call_edges 是 callee -> callers,故从 name 做"被谁调用"的扩散即影响面。
    """
    reached: set[str] = {name}
    frontier = {name}
    for _ in range(max_depth):
        nxt: set[str] = set()
        for node in frontier:
            for f, caller in graph.call_edges.get(node, set()):
                if caller not in reached and caller != "<module>":
                    nxt.add(caller)
        reached |= nxt
        frontier = nxt
        if not frontier:
            break
    reached.discard(name)
    return reached


def search_with_budget(
    graph: SymbolGraph,
    query: str,
    *,
    max_results: int = 20,
) -> dict[str, object]:
    """按符号名精确/子串检索,并给每条带 token 级预算提示。

    预算仅按结果条数估(不做 schema 字节,那是 tool_surface_budget 的活)。
    """
    q = query.strip()
    ql = q.lower()
    exact = [s for s in graph.symbols if s.name == q]
    fuzzy = [s for s in graph.symbols if s.name != q and ql in s.name.lower()]
    hits = exact + fuzzy
    hits = hits[:max_results]
    exact = [s for s in hits if s.name == q]
    fuzzy = [s for s in hits if s.name != q]
    return {
        "query": q,
        "exact": [s.to_dict() for s in exact],
        "fuzzy": [s.to_dict() for s in fuzzy],
        "count": len(hits),
        "budget_hint_tokens": len(hits) * 12,  # 粗估:每符号 ~12 token
        "approximate": True,
    }


# ---------------------------------------------------------------------------
# 单元测试(纯逻辑)
# ---------------------------------------------------------------------------


def test_index_symbols_and_references() -> None:
    files = {
        "a.ts": "export function foo() { return 1; }\nfunction bar() { foo(); }",
        "b.py": "def helper():\n    return 2\n\ndef main():\n    helper()",
    }
    g = index_code(files)
    names = {s.name for s in g.symbols}
    assert "foo" in names and "bar" in names
    assert "helper" in names and "main" in names
    # foo 被 a.ts 调用
    refs = find_references(g, "foo")
    assert any(caller == "bar" for _f, caller in refs)


def test_impact_set_spreads_to_callers() -> None:
    files = {
        "x.ts": "function leaf() { return 1; }\nfunction mid() { leaf(); }\nfunction top() { mid(); }",
    }
    g = index_code(files)
    imp = impact_set(g, "leaf", max_depth=3)
    assert "mid" in imp
    assert "top" in imp  # 二跳可达


def test_search_exact_and_fuzzy() -> None:
    files = {"a.ts": "export function renderHeader() {}\nfunction render() {}"}
    g = index_code(files)
    out = search_with_budget(g, "render")
    assert out["count"] >= 2
    assert any(s["name"] == "render" for s in out["exact"])  # 精确同名命中
    assert any(s["name"] == "renderHeader" for s in out["fuzzy"])  # 子串命中进 fuzzy


def test_search_budget_hint_positive() -> None:
    files = {"a.ts": "function a() {}\nfunction b() {}"}
    g = index_code(files)
    out = search_with_budget(g, "a")
    assert out["budget_hint_tokens"] > 0


def test_to_dict_shape() -> None:
    g = index_code({"a.ts": "function f() {}"})
    d = g.to_dict()
    assert {"symbols", "call_edges", "files_indexed", "approximate"} <= set(d)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
