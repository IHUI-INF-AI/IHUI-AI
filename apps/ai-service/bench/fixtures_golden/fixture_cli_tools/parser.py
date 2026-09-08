"""参数解析模块(golden 参考实现:从 cli.py 迁移的 argv 解析逻辑)。"""


def parse_args(argv: list[str]) -> tuple[str | None, list[str]]:
    """解析 argv:返回 (名字或 None, 其余参数)。"""
    if not argv:
        return None, []
    return argv[0], argv[1:]
