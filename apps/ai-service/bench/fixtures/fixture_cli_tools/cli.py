"""命令行小工具(含坏 import 与死代码,供 IHUI-Bench 修复任务使用)。"""

import sys

# 注:此处为故意埋设的 bug —— 该模块不存在,会导致 ImportError,
# 任何 `from cli import ...` 都会失败。应删除此行。
import nonexistent_fake_module  # noqa: F401


def dead_code_helper() -> int:
    """注:此处为故意埋设的死代码,从未被调用,应删除。"""
    x = 1
    for i in range(10):
        x += i
    return x


def greet(name: str) -> str:
    """返回问候语。"""
    return f"Hello, {name}!"


def main(argv=None) -> int:
    """CLI 入口:接收单个名字参数并打印问候语。"""
    argv = argv if argv is not None else sys.argv[1:]
    if not argv:
        print("usage: cli <name>")
        return 1
    print(greet(argv[0]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
