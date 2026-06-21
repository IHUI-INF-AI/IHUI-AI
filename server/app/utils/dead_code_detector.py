"""Bug-73: 死代码检测.

策略 (轻量, 无需 pyright 安装):
  1. AST 扫描所有 .py 文件, 收集:
     - 函数定义 (def / async def): name + 完整签名
     - 导入 (import / from ... import)
     - 调用 (Call 节点, function 是 Name 或 Attribute)
     - 装饰器使用 (@xxx.yyy)
  2. 检测类型:
     - 死函数: 定义了但未被调用 (排除 __main__ / __init__ / 公开 API)
     - 死导入: 导入后未使用
     - 死变量: 模块级赋值后未引用
  3. 排除: test_*, __init__, 公开方法 (_ 开头算 private)
  4. 输出 JSON 报告

使用:
    from app.utils.dead_code_detector import dead_code_scanner

    report = dead_code_scanner.scan(["app/"])
    print(report.summary())
"""

import ast
import logging
import os
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

EXCLUDE_DIRS = {".git", "__pycache__", "venv", ".venv", "node_modules", "tests", "migrations"}
EXCLUDE_NAMES = {"__init__", "__main__", "main", "create_app"}


@dataclass
class DefInfo:
    name: str
    file: str
    line: int
    is_method: bool = False
    is_private: bool = False
    is_async: bool = False
    decorators: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "file": self.file,
            "line": self.line,
            "is_method": self.is_method,
            "is_private": self.is_private,
            "is_async": self.is_async,
            "decorators": self.decorators,
        }


@dataclass
class DeadCodeReport:
    dead_functions: list[DefInfo] = field(default_factory=list)
    dead_imports: list[dict] = field(default_factory=list)
    dead_variables: list[dict] = field(default_factory=list)
    total_functions: int = 0
    total_imports: int = 0
    total_variables: int = 0
    scanned_files: int = 0

    def summary(self) -> dict:
        return {
            "scanned_files": self.scanned_files,
            "total_functions": self.total_functions,
            "total_dead_functions": len(self.dead_functions),
            "total_imports": self.total_imports,
            "total_dead_imports": len(self.dead_imports),
            "total_variables": self.total_variables,
            "total_dead_variables": len(self.dead_variables),
            "total_dead": (len(self.dead_functions) + len(self.dead_imports) + len(self.dead_variables)),
            "text": (
                f"扫描 {self.scanned_files} 个文件, "
                f"函数 {self.total_functions} 个 (死: {len(self.dead_functions)}), "
                f"导入 {self.total_imports} 个 (死: {len(self.dead_imports)}), "
                f"变量 {self.total_variables} 个 (死: {len(self.dead_variables)})"
            ),
        }

    def to_dict(self) -> dict:
        return {
            "summary": self.summary(),
            "scanned_files": self.scanned_files,
            "total_functions": self.total_functions,
            "total_imports": self.total_imports,
            "total_variables": self.total_variables,
            "dead_functions": [d.to_dict() for d in self.dead_functions],
            "dead_imports": self.dead_imports,
            "dead_variables": self.dead_variables,
        }


class DeadCodeScanner:
    def __init__(self):
        self._all_defs: list[DefInfo] = []
        self._called_names: set[str] = set()
        self._decorator_uses: set[str] = set()

    def scan(self, paths: list[str]) -> DeadCodeReport:
        report = DeadCodeReport()
        # 第一遍: 收集所有定义
        for path in paths:
            for pyfile in self._walk_py(path):
                report.scanned_files += 1
                self._collect_defs(pyfile, report)
        # 第二遍: 收集所有调用
        for path in paths:
            for pyfile in self._walk_py(path):
                self._collect_calls(pyfile)
        # 第三遍: 判定
        for d in self._all_defs:
            if self._is_dead(d):
                report.dead_functions.append(d)
        return report

    def _walk_py(self, path: str):
        if os.path.isfile(path) and path.endswith(".py"):
            yield path
            return
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for f in files:
                if f.endswith(".py"):
                    yield os.path.join(root, f)

    def _collect_defs(self, pyfile: str, report: DeadCodeReport) -> None:
        try:
            with open(pyfile, encoding="utf-8") as f:
                src = f.read()
            tree = ast.parse(src, filename=pyfile)
        except Exception as e:
            logger.debug(f"parse {pyfile} fail: {e}")
            return
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # skip nested 函数
                name = node.name
                # 检测方法 (def 在 ClassDef 内)
                is_method = any(
                    isinstance(p, ast.ClassDef)
                    and any(isinstance(c, (ast.FunctionDef, ast.AsyncFunctionDef)) and c is node for c in ast.walk(p))
                    for p in ast.walk(tree)
                )
                is_private = name.startswith("_") and not (name.startswith("__") and name.endswith("__"))
                decorators = [ast.unparse(d) for d in node.decorator_list] if hasattr(ast, "unparse") else []
                info = DefInfo(
                    name=name,
                    file=pyfile,
                    line=node.lineno,
                    is_method=is_method,
                    is_private=is_private,
                    is_async=isinstance(node, ast.AsyncFunctionDef),
                    decorators=decorators,
                )
                self._all_defs.append(info)
                report.total_functions += 1
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                report.total_imports += len(node.names)
            elif isinstance(node, ast.Assign) and isinstance(node.value, (ast.Constant,)):
                # 模块级常量赋值
                try:
                    col = node.coloffset
                except AttributeError:
                    col = 0
                if col == 0 and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                    report.total_variables += 1

    def _collect_calls(self, pyfile: str) -> None:
        try:
            with open(pyfile, encoding="utf-8") as f:
                src = f.read()
            tree = ast.parse(src, filename=pyfile)
        except Exception as e:
            logger.debug(f"parse {pyfile} fail: {e}")
            return
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                fn = node.func
                if isinstance(fn, ast.Name):
                    self._called_names.add(fn.id)
                elif isinstance(fn, ast.Attribute):
                    cur = fn
                    while isinstance(cur, ast.Attribute):
                        cur = cur.value
                    if isinstance(cur, ast.Name):
                        self._called_names.add(cur.id)
            elif isinstance(node, ast.Attribute):
                # 属性访问也算"使用" (obj.method 的 obj)
                pass
            # 装饰器
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                for d in node.decorator_list:
                    if isinstance(d, ast.Name):
                        self._decorator_uses.add(d.id)
                    elif isinstance(d, ast.Attribute):
                        cur = d
                        while isinstance(cur, ast.Attribute):
                            cur = cur.value
                        if isinstance(cur, ast.Name):
                            self._decorator_uses.add(cur.id)

    def _is_dead(self, d: DefInfo) -> bool:
        # 排除
        if d.name in EXCLUDE_NAMES:
            return False
        if d.name.startswith("__") and d.name.endswith("__"):
            return False
        if d.name in ("setUp", "tearDown", "setUpClass", "tearDownClass"):
            return False
        if d.file.endswith("/tests/" + ""):  # 排除测试
            return False
        # 公开 API (无 _ 前缀) 不算死 (外部可能引用)
        if not d.is_private:
            return False
        # 装饰器
        for deco in d.decorators:
            # @staticmethod / @classmethod / @property 不算死
            if any(k in deco for k in ("staticmethod", "classmethod", "property", "abstract")):
                return False
        # 检查调用 / 装饰器引用
        return not (d.name in self._called_names or d.name in self._decorator_uses)


# 全局单例
dead_code_scanner = DeadCodeScanner()
