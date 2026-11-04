# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""凭据不得进日志(2026-11-01 安全强化)。

判据单源 = ``output_cleaning.redact_secrets``;本文件只验**接线**,不复算"什么算凭据"。

为什么要这么验
--------------
这一族的成因不是某个调用点写错,而是"URL 里有凭据 + 无数条把 URL 打进日志的路"。
所以每条断言都成对:① 装了闸 ⇒ 密文不落盘;② **摘掉闸 ⇒ 同一个输入必须真的漏出明文**
(反向牙口)。少了 ②,任何一次"filter 其实没挂上/handler 换了个形态"都会静默变成假绿。
"""

from __future__ import annotations

import ast
import logging
import re
from pathlib import Path

from app.core.log_redaction import (
    SecretRedactingFilter,
    install_stdlib_secret_redaction,
    structlog_redaction_processor,
)

_DIRTY_URL = "https://api.etherscan.io/api?module=logs&address=0xabc&apikey=Sup3rS3cretEtherscanKey"
_CLEAN_LINE = "GET /health 200 12ms"


class _Capture(logging.Handler):
    """把 emit 到的最终文本收起来 —— 验的是**落盘字节**,不是 record 字段。"""

    def __init__(self) -> None:
        super().__init__()
        self.lines: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.lines.append(self.format(record))


def _make_logger(name: str) -> tuple[logging.Logger, _Capture]:
    logger = logging.getLogger(name)
    logger.handlers.clear()
    logger.propagate = False
    # 显式定档:有效级别若继承到 root 的 WARNING,logger.info() 会在**进入 filter 之前**
    # 就被丢弃 —— 那样"落盘没有密文"是"根本没落盘",三条断言全部变成假绿。
    logger.setLevel(logging.DEBUG)
    cap = _Capture()
    cap.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(cap)
    return logger, cap


def test_filter_redacts_query_credential_before_it_reaches_the_stream() -> None:
    """装了闸:含 apikey 的行落盘只剩 [REDACTED_SECRET]。"""
    logger, cap = _make_logger("ihui.test.redact.on")
    logger.addFilter(SecretRedactingFilter())
    logger.info("upstream call %s end", _DIRTY_URL)
    assert len(cap.lines) == 1
    assert "Sup3rS3cretEtherscanKey" not in cap.lines[0]
    assert "[REDACTED_SECRET]" in cap.lines[0]


def test_without_the_filter_the_same_input_actually_leaks() -> None:
    """反向牙口:同一输入不装 filter 必须**真的**把明文写出去。

    这条不过就说明断言①量错了对象(比如密文从一开始就没进这条流),整门变哑。
    """
    logger, cap = _make_logger("ihui.test.redact.off")
    logger.info("upstream call %s end", _DIRTY_URL)
    assert "Sup3rS3cretEtherscanKey" in cap.lines[0]


def test_clean_lines_are_left_byte_identical() -> None:
    """无凭据的行不得被改写(尺子误伤会毁掉排障现场,也会掩盖真问题)。"""
    logger, cap = _make_logger("ihui.test.redact.clean")
    logger.addFilter(SecretRedactingFilter())
    logger.info(_CLEAN_LINE)
    assert cap.lines == [_CLEAN_LINE]


def test_interpolated_args_are_not_reintroduced_after_redaction() -> None:
    """脱敏后必须清掉 args,否则 handler 二次插值会把原值带回来。"""
    record = logging.LogRecord(
        name="x",
        level=logging.INFO,
        pathname="p",
        lineno=1,
        msg="url=%s",
        args=(_DIRTY_URL,),
        exc_info=None,
    )
    assert SecretRedactingFilter().filter(record) is True
    assert record.args is None
    assert "Sup3rS3cretEtherscanKey" not in record.getMessage()


def test_exception_block_is_redacted_too() -> None:
    """traceback 与 msg 分两段渲染 —— 只盖 msg 是最常见的半截修法。"""
    try:
        raise ValueError(f"request failed for {_DIRTY_URL}")
    except ValueError:
        logger, cap = _make_logger("ihui.test.redact.exc")
        logger.addFilter(SecretRedactingFilter())
        logger.exception("boom")
    joined = "\n".join(cap.lines)
    assert "Traceback" in joined, "异常块必须仍然可见(只脱敏,不吞栈)"
    assert "Sup3rS3cretEtherscanKey" not in joined


def test_install_covers_handlers_created_later_via_second_pass() -> None:
    """install 幂等,且第二趟能把第一趟够不着的 handler 补上(uvicorn 型时序)。"""
    root = logging.getLogger("")
    saved_handlers = list(root.handlers)
    saved_level = root.level
    root.handlers.clear()
    cap = _Capture()
    cap.setFormatter(logging.Formatter("%(message)s"))
    cap.setLevel(logging.DEBUG)
    root.addHandler(cap)
    root.setLevel(logging.DEBUG)
    try:
        first = install_stdlib_secret_redaction()
        assert first >= 1, "第一趟必须真的挂上,否则整门是空的"
        second = install_stdlib_secret_redaction()
        assert second == 0, "重复挂会重复跑尺子,且让'脱敏了几次'无从回答"
        # 挂的是 root handler ⇒ 任何向 root 冒泡的 logger 都受保护
        logging.getLogger("httpx").info("HTTP Request: POST %s", _DIRTY_URL)
        assert "Sup3rS3cretEtherscanKey" not in "\n".join(cap.lines)
    finally:
        # root 是全进程共享面:必须逐条还原,clear() 会把 pytest 自己或别的用例挂上的
        # handler 一起摘掉(那就不再是"我这条测试的事"了)。
        cap.close()
        root.handlers.clear()
        root.handlers.extend(saved_handlers)
        root.setLevel(saved_level)


def test_uvicorn_access_logger_is_in_scope() -> None:
    """uvicorn.access 默认 propagate=False:只挂 root 会整片漏掉它。"""
    access = logging.getLogger("uvicorn.access")
    saved_handlers = list(access.handlers)
    saved_propagate = access.propagate
    saved_level = access.level
    access.handlers.clear()
    cap = _Capture()
    cap.setFormatter(logging.Formatter("%(message)s"))
    access.addHandler(cap)
    access.propagate = False
    access.setLevel(logging.DEBUG)
    try:
        installed = install_stdlib_secret_redaction()
        assert installed >= 1
        access.info("127.0.0.1 - 'GET /x HTTP/1.1' 200 %s", _DIRTY_URL)
        assert "Sup3rS3cretEtherscanKey" not in "\n".join(cap.lines)
    finally:
        cap.close()
        access.handlers.clear()
        access.handlers.extend(saved_handlers)
        access.propagate = saved_propagate
        access.setLevel(saved_level)


def test_structlog_processor_covers_event_and_every_string_value() -> None:
    """structlog 走 PrintLoggerFactory 直写 stderr,不经 stdlib handler ⇒ 另接一条。"""
    out = structlog_redaction_processor(
        None,
        "info",
        {"event": f"calling {_DIRTY_URL}", "url": _DIRTY_URL, "status_code": 500},
    )
    assert "Sup3rS3cretEtherscanKey" not in out["event"]
    assert "Sup3rS3cretEtherscanKey" not in out["url"]
    assert out["status_code"] == 500, "非字符串值不得被动过"


def test_structlog_processor_can_see_the_rendered_exception() -> None:
    """排序即语义:处理器排在 format_exc_info 之后才拿得到 exception 字符串。"""
    out = structlog_redaction_processor(
        None,
        "error",
        {"event": "failed", "exception": f"Traceback...\n{_DIRTY_URL}"},
    )
    assert "Sup3rS3cretEtherscanKey" not in out["exception"]


def _dotted_name(node: ast.AST) -> str | None:
    """把 `name` / `a.b.c` 形态还原成点号字符串;其他形态返回 None。"""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = _dotted_name(node.value)
        return f"{base}.{node.attr}" if base is not None else None
    return None


def test_wiring_is_actually_present() -> None:
    """接线锁:两条链各自真调了闸,而不是只有模块躺着。

    取 structlog.configure(...) 的 processors 实参;**名字引用会解析到模块内的显式列表
    字面量**,按 AST 元素次序判定 —— 注释/字符串里的同名文本不参与,比源码子串
    index() 更严格(后者会把解释文字当判据,是本仓反复踩过的自伤形)。
    """
    core = Path(__file__).resolve().parents[1] / "app" / "core" / "logging.py"
    main = Path(__file__).resolve().parents[1] / "app" / "main.py"
    logging_src = core.read_text(encoding="utf-8")
    main_src = main.read_text(encoding="utf-8")

    assert re.search(r"^install_stdlib_secret_redaction\(\)$", main_src, re.MULTILINE), (
        "import 期那一次调用必须是模块级(缩进 0),写进函数体等于没装"
    )
    assert main_src.count("install_stdlib_secret_redaction(") >= 2, (
        "还缺启动钩子那第二次(uvicorn 的 handler 在应用 import 之后才建)"
    )

    tree = ast.parse(logging_src)
    configure_calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and _dotted_name(node.func) == "structlog.configure"
    ]
    assert configure_calls, "logging.py 必须真的调用 structlog.configure"
    processors_kw = next(
        (kw for kw in configure_calls[0].keywords if kw.arg == "processors"), None
    )
    assert processors_kw is not None, "configure 必须显式传 processors"

    chain_node = processors_kw.value
    if isinstance(chain_node, ast.Name):
        assigned_lists = {
            target.id: node.value
            for node in ast.walk(tree)
            if isinstance(node, ast.Assign) and isinstance(node.value, (ast.List, ast.Tuple))
            for target in node.targets
            if isinstance(target, ast.Name)
        }
        chain_node = assigned_lists.get(chain_node.id)
    assert isinstance(chain_node, (ast.List, ast.Tuple)), (
        "processors 实参必须是显式列表链(名字引用需能解析到列表字面量)"
    )

    chain = [
        _dotted_name(element.func) if isinstance(element, ast.Call) else _dotted_name(element)
        for element in chain_node.elts
    ]
    proc = chain.index("structlog_redaction_processor")
    exc = chain.index("structlog.processors.format_exc_info")
    rend = chain.index("structlog.dev.ConsoleRenderer")
    assert exc < proc < rend, "脱敏必须晚于异常渲染、早于 renderer"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
