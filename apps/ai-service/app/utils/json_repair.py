# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""流式感知的 JSON 修复（逆向-复现-超越，AGENTS §0.12）。

对标：Qoder / Trae 的 ``jsonrepair`` 依赖（在两家的依赖清单里都直接观察到）。
复现：一次性尽力修复 LLM 输出的残缺 JSON（截断尾值、缺失收尾括号、尾随逗号、
未加引号键名、单引号字符串、JS 注释、裸 NaN/Infinity）。
超越：额外提供 *流式* 修复——输入是仍在增长的流前缀时，仍能给出「当前最好可用的
部分值 + 是否已完整」信号，使聊天层可在 SSE 分片到达过程中渐进渲染工具调用入参。
``jsonrepair`` 只能吃完整字符串，做不到这一点。

本文件为纯自研 Python 等价实现（不粘贴任何对照程序专有源码；不依赖第三方 jsonrepair 包）。
行为与 TypeScript 侧 ``packages/api-client/src/json-repair.ts`` 逐一对齐。
"""

from __future__ import annotations

import json
import re
from typing import Any

__all__ = [
    "repair_json",
    "StreamingJsonRepair",
    "create_streaming_json_repair",
    "RepairResult",
]


def repair_json(text: str) -> RepairResult:
    """一次性尽力修复残缺 JSON。

    输入可为：被截断的流、带尾随逗号的对象、裸键名、单引号字符串、含注释或裸
    NaN/Infinity 的文本。能解析则返回 ``ok=True``。
    """
    if not isinstance(text, str):
        return {"ok": False, "value": None, "recovered": False, "error": "input is not a string"}
    trimmed = text.strip()
    if trimmed == "":
        return {"ok": False, "value": None, "recovered": False, "error": "empty input"}

    direct = _try_parse(trimmed)
    if direct is not None:
        return {"ok": True, "value": direct, "recovered": False, "error": None}

    cleaned = _neutralize_non_finite(_strip_trailing_commas(_strip_comments(trimmed)))
    structural = cleaned + _auto_close_suffix(cleaned)
    first_pass = _attempt_candidates(
        [
            cleaned,
            structural,
            _quote_unquoted_keys(structural),
            _single_to_double_quotes(_quote_unquoted_keys(structural)),
        ]
    )
    if first_pass is not None:
        return first_pass

    # 逐层回退尾部半截 token（封顶 4 次，每次必定变短，避免吞掉合法结构）
    cur = cleaned
    for _ in range(4):
        cut = _trim_trailing_partial(cur)
        if cut is None or cut == cur:
            break
        cur = cut
        cut_structural = cur + _auto_close_suffix(cur)
        r = _attempt_candidates(
            [
                cur,
                cut_structural,
                _quote_unquoted_keys(cut_structural),
                _single_to_double_quotes(_quote_unquoted_keys(cut_structural)),
            ]
        )
        if r is not None:
            return r

    return {"ok": False, "value": None, "recovered": False, "error": "unrepairable JSON"}


class RepairResult(dict[str, Any]):
    """修复结果（dict 形态以保持与 TS 侧 ``RepairResult`` 字段一致）。"""


def _reject_constant(token: str) -> Any:
    # JSON.parse 不接受 NaN/Infinity，但 Python json.loads 默认接受(API 非严格)。
    # 为保持与 TS 端 repairJson 完全一致，这里显式拒绝，使其回落到 neutralizeNonFinite 修复成 null。
    raise ValueError(f"invalid JSON constant: {token}")


def _try_parse(text: str) -> Any | None:
    try:
        return json.loads(text, parse_constant=_reject_constant)
    except (ValueError, json.JSONDecodeError):
        return None


def _attempt_candidates(cands: list[str]) -> RepairResult | None:
    for c in cands:
        value = _try_parse(c)
        if value is not None:
            return {"ok": True, "value": value, "recovered": True, "error": None}
    return None


def _auto_close_suffix(text: str) -> str:
    """在字符串之外扫描括号深度，返回让结构闭合所需的后缀（含未闭合字符串的收尾引号）。"""
    open_stack: list[str] = []
    in_string = False
    escape = False
    for ch in text:
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch == "{" or ch == "[":
            open_stack.append(ch)
        elif ch == "}" or ch == "]":
            if open_stack:
                open_stack.pop()
    suffix = '"' if in_string else ""
    for opener in reversed(open_stack):
        suffix += "}" if opener == "{" else "]"
    return suffix


def _strip_comments(text: str) -> str:
    """字符串感知地剥离 // 与 /* */ 注释（不误删字符串内的 //）。"""
    out: list[str] = []
    in_string = False
    escape = False
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if in_string:
            out.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == "/" and i + 1 < n and text[i + 1] == "/":
            while i < n and text[i] != "\n":
                i += 1
            continue
        if ch == "/" and i + 1 < n and text[i + 1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def _strip_trailing_commas(text: str) -> str:
    """字符串感知地删除 } / ] 之前的尾随逗号。"""
    out: list[str] = []
    in_string = False
    escape = False
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if in_string:
            out.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == ",":
            j = i + 1
            while j < n and text[j].isspace():
                j += 1
            if j < n and text[j] in ("}", "]"):
                i = j
                continue
        out.append(ch)
        i += 1
    return "".join(out)


def _quote_unquoted_keys(text: str) -> str:
    """给未加引号的裸键名（{ 或 , 之后的标识符）补上双引号。"""
    return re.sub(r'([{\[,])\s*([A-Za-z_$][\w$]*)\s*:', r'\1"\2":', text)


def _js_unescape(s: str) -> str:
    """把 JS 字符串转义序列翻译为实际字符（\\n \\t \\uXXXX \\' \\" \\\\ …）。"""
    out: list[str] = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c != "\\":
            out.append(c)
            i += 1
            continue
        if i + 1 >= n:
            break
        nxt = s[i + 1]
        if nxt == "n":
            out.append("\n")
            i += 2
        elif nxt == "t":
            out.append("\t")
            i += 2
        elif nxt == "r":
            out.append("\r")
            i += 2
        elif nxt == "b":
            out.append("\b")
            i += 2
        elif nxt == "f":
            out.append("\f")
            i += 2
        elif nxt == "0":
            out.append("\0")
            i += 2
        elif nxt == "u" and i + 6 <= n:
            try:
                out.append(chr(int(s[i + 2 : i + 6], 16)))
            except ValueError:
                pass
            i += 6
        else:
            out.append(nxt)
            i += 2
    return "".join(out)


def _single_to_double_quotes(text: str) -> str:
    """把单引号字符串字面量转成双引号（仅当单引号确实充当字符串定界符时）。

    内部 JS 转义（含 \\' 这类 JSON 不合法的转义）先解码再交给 json.dumps 重新转义，
    词内撇号（如 don't）因找不到成对定界符会被跳过。
    """
    out: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch == "'":
            j = i + 1
            closed = False
            body: list[str] = []
            while j < n:
                c = text[j]
                if c == "\\":
                    body.append(c)
                    if j + 1 < n:
                        body.append(text[j + 1])
                        j += 2
                        continue
                    j += 1
                    break
                if c == "'":
                    closed = True
                    break
                body.append(c)
                j += 1
            if closed:
                out.append(json.dumps(_js_unescape("".join(body))))
                i = j + 1
                continue
            out.append(ch)
            i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def _neutralize_non_finite(text: str) -> str:
    """把裸 NaN / Infinity 字面量替换为 JSON 合法的 null（仅作用于值位）。"""
    text = re.sub(r":\s*(NaN|-?Infinity)\b", ": null", text)
    text = re.sub(r"(\[|,)\s*(NaN|-?Infinity)\b", r"\1null", text)
    return text


def _trim_trailing_partial(text: str) -> str | None:
    """去掉残缺流尾部的半个 token（半截字符串 / 半截键名:值 / 半截值），返回可闭合前缀或 None。"""
    # 1) 末尾在字符串内：回退到最后一个未闭合引号之前
    in_string = False
    escape = False
    last_string_start = -1
    for i, ch in enumerate(text):
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
        elif ch == '"':
            in_string = True
            last_string_start = i
    if in_string and last_string_start >= 0:
        return text[:last_string_start]

    # 2) 末尾是「可选逗号 + 可选键名 + 冒号」（键已写出但值还没来）：回退到该结构符之前
    key_match = re.search(r'(?:^|[,\[{])\s*(?:"[^"]*"\s*:|[A-Za-z_$][\w$]*\s*:)\s*$', text)
    if key_match is not None and key_match.start() is not None:
        if key_match.start() == 0 and len(key_match.group()) == len(text):
            return None
        return text[: key_match.start()]

    # 3) 末尾是「可选逗号/冒号 + 半截值」（已是值槽里的半个 token）：回退到分隔符之前
    val_match = re.search(r'(?:^|[,\[{:])\s*[\w.-]*$', text)
    if val_match is not None and val_match.group() != "":
        if val_match.start() == 0 and len(val_match.group()) == len(text):
            return None
        return text[: val_match.start()]

    return None


class StreamingJsonRepair:
    """流式 JSON 修复器：喂入分片，随时给出「当前最好可用的部分值 + 是否已完整」。

    完整性以「原始缓冲无需修复即可 json.loads 通过」为准，因此不会把修复补出的收尾误判为
    完成；一旦原始缓冲达成完整值即锁定，后续分片若仍合法则更新值、否则沿用锁定值。
    """

    def __init__(self) -> None:
        self._buffer = ""
        self._completed = False
        self._last_complete_value: Any = None

    def push(self, chunk: str) -> dict[str, Any]:
        self._buffer += chunk

        if self._completed:
            try:
                self._last_complete_value = json.loads(self._buffer)
            except (ValueError, json.JSONDecodeError):
                pass  # 后续分片破坏了原完整值（如模型追加了多余文本），沿用锁定值
            return {"complete": True, "partial": False, "value": self._last_complete_value}

        raw_ok = False
        raw_value: Any = None
        try:
            raw_value = json.loads(self._buffer)
            raw_ok = True
        except (ValueError, json.JSONDecodeError):
            raw_ok = False

        if raw_ok:
            self._completed = True
            self._last_complete_value = raw_value
            return {"complete": True, "partial": False, "value": raw_value}

        partial = repair_json(self._buffer)
        if partial.get("ok"):
            return {"complete": False, "partial": True, "value": partial.get("value")}
        return {"complete": False, "partial": False, "value": None}

    @property
    def raw(self) -> str:
        """当前累积的原始缓冲（调试用）。"""
        return self._buffer

    @property
    def is_complete(self) -> bool:
        """流是否已解析出完整值（之后喂入的分片不会改变「已完成」这一事实）。"""
        return self._completed


def create_streaming_json_repair() -> StreamingJsonRepair:
    """工厂：创建一个流式 JSON 修复器。"""
    return StreamingJsonRepair()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
