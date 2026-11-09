# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 文件夹建库 · 零依赖 PDF 文本抽取。

为什么自己写
------------
``pdfplumber`` / ``pypdf`` 是可选依赖，没装就等于「PDF 全部跳过」——而真实
文件夹里 PDF 往往占比最高。本模块只用标准库（``re``/``zlib``）做**尽力而为**
的文本层抽取，覆盖无加密、未走对象流（或对象流已解压）的常见 PDF；
抽不出来时**具名报失败**，绝不把乱码写进索引。

支持范围（是的，很窄，但边界明确）
----------------------------------
* 流过滤器：``FlateDecode``（含 PNG predictor 的常见情况由 zlib 直接解）、
  无过滤器；``ASCIIHexDecode``；其余（``DCTDecode`` 图片、``LZW``）→ 跳过；
* 文本操作符：``Tj`` / ``TJ`` / ``'`` / ``"``；``Td``/``TD``/``T*``/``TL``
  用于换行推断；
* 字体编码：``/ToUnicode`` CMap（``bfchar`` + ``bfrange``，含数组形式）。
  中文 PDF 通常走 Identity-H + ToUnicode，这是能否抽出中文的关键；
* 不支持：加密文档（``/Encrypt``）、无 ToUnicode 的 CID 字体（抽出必是乱码
  ⇒ 判 ``cid-unsupported``）、扫描件（本来就没文本层 ⇒ ``no-text-layer``）。

质量门（比"能不能抽"更重要）
----------------------------
抽出结果必须通过三条检查，否则一律判失败并说明原因：
1. 可打印字符占比 ≥ 0.85；
2. 私有区码位（U+E000–U+F8FF）占比 < 0.02 —— 这是 CID 未映射的典型指纹；
3. 去掉空白后长度 ≥ 8 —— 少于这个长度说明只有页码之类的碎片。
"""

from __future__ import annotations

import re
import zlib
from typing import Final

__all__ = ["extract_pdf_text", "parse_tounicode"]

#: 单个 PDF 最多解压多少字节（防压缩炸弹：一个 1MB 文件解出 2GB）。
MAX_INFLATE_BYTES: Final = 64 * 1024 * 1024
#: 文本操作符与字符串的最小词法器（只覆盖内容流里出现的形态）。
_WHITESPACE: Final = b" \t\r\n\f\x00"
_DELIMS: Final = b"()<>[]{}/%"


def _inflate(data: bytes, limit: int = MAX_INFLATE_BYTES) -> bytes | None:
    """zlib 解压，带输出上限；失败返回 None（不抛）。"""
    try:
        engine = zlib.decompressobj()
        out = engine.decompress(data, limit)
        return out
    except zlib.error:
        return None


def _decode_stream(raw: bytes, head: bytes) -> bytes | None:
    """按流字典声明解出明文；不支持的过滤器返回 None。"""
    if b"FlateDecode" in head or b"Fl " in head:
        return _inflate(raw)
    if b"ASCIIHexDecode" in head:
        cleaned = re.sub(rb"[^0-9A-Fa-f>]", b"", raw).replace(b">", b"")
        if len(cleaned) % 2:
            cleaned += b"0"
        try:
            return bytes.fromhex(cleaned.decode("ascii"))
        except (ValueError, UnicodeDecodeError):
            return None
    if b"DCTDecode" in head or b"JPXDecode" in head or b"LZWDecode" in head:
        return None
    if b"Filter" in head:
        # 声明了过滤器但不是我们认识的 ⇒ 不要当成明文（那会是二进制垃圾）。
        return None
    return raw


def parse_tounicode(data: bytes) -> dict[int, str]:
    """解析 ToUnicode CMap：``<src> <dst>`` 与 ``<lo> <hi> <dst>`` 两种形式。

    ``dst`` 是 UTF-16BE 十六进制串；数组形式 ``<lo> <hi> [<d1> <d2> ...]``
    表示从 lo 起逐个递增映射。返回 ``{字符码: 目标字符}``。
    """
    mapping: dict[int, str] = {}
    for block in re.finditer(rb"beginbfchar(.*?)endbfchar", data, re.S):
        for src, dst in re.findall(
            rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block.group(1)
        ):
            mapping[int(src, 16)] = _utf16_be(dst)
    for block in re.finditer(rb"beginbfrange(.*?)endbfrange", data, re.S):
        body = block.group(1)
        # 先处理数组形式，避免被下面的单值正则误吃。
        for lo, hi, items in re.findall(
            rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.*?)\]", body, re.S
        ):
            start, end = int(lo, 16), int(hi, 16)
            entries = re.findall(rb"<([0-9A-Fa-f]+)>", items)
            for offset, entry in enumerate(entries):
                if start + offset > end:
                    break
                mapping[start + offset] = _utf16_be(entry)
        for lo, hi, dst in re.findall(
            rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", body
        ):
            start, end = int(lo, 16), int(hi, 16)
            base = _utf16_be(dst)
            if not base or end < start or end - start > 65535:
                continue
            head = ord(base[0])
            for offset in range(end - start + 1):
                mapping[start + offset] = chr(head + offset) + base[1:]
    return mapping


def _utf16_be(hexdigits: bytes) -> str:
    if len(hexdigits) % 4 != 0:
        # 单字节目的串（少见）按 Latin-1 兜底，不让整条 CMap 失效。
        try:
            return bytes.fromhex(hexdigits.decode("ascii")).decode("latin-1")
        except (ValueError, UnicodeDecodeError):
            return ""
    try:
        return bytes.fromhex(hexdigits.decode("ascii")).decode("utf-16-be", "ignore")
    except (ValueError, UnicodeDecodeError):
        return ""


def _read_literal(data: bytes, start: int) -> tuple[bytes, int]:
    """读 ``( ... )`` 字面量串，处理转义与嵌套括号；返回 (内容, 结束下标)。"""
    out = bytearray()
    depth = 0
    i = start
    n = len(data)
    while i < n:
        ch = data[i : i + 1]
        if ch == b"\\":
            nxt = data[i + 1 : i + 2]
            if nxt in (b"n", b"r", b"t", b"b", b"f"):
                out += {b"n": b"\n", b"r": b"\r", b"t": b"\t", b"b": b"\b", b"f": b"\f"}[nxt]
                i += 2
                continue
            if nxt.isdigit():
                octal = data[i + 1 : i + 4]
                take = 0
                while take < 3 and take < len(octal) and octal[take : take + 1].isdigit():
                    take += 1
                try:
                    out.append(int(octal[:take], 8) & 0xFF)
                except ValueError:
                    pass
                i += 1 + take
                continue
            out += nxt
            i += 2
            continue
        if ch == b"(":
            depth += 1
            if depth > 1:
                out += ch
            i += 1
            continue
        if ch == b")":
            depth -= 1
            if depth == 0:
                return bytes(out), i + 1
            out += ch
            i += 1
            continue
        out += ch
        i += 1
    return bytes(out), n


def _read_hex_string(data: bytes, start: int) -> tuple[bytes, int]:
    end = data.find(b">", start)
    if end < 0:
        return b"", len(data)
    digits = re.sub(rb"[^0-9A-Fa-f]", b"", data[start + 1 : end])
    if len(digits) % 2:
        digits += b"0"
    try:
        return bytes.fromhex(digits.decode("ascii")), end + 1
    except (ValueError, UnicodeDecodeError):
        return b"", end + 1


def _decode_string(raw: bytes, cmap: dict[int, str]) -> str:
    """把字符串按 CMap 解成文本；无 CMap 时按 1 字节 Latin-1 处理。

    有 CMap 的多字节字体（中文常见 Identity-H）必须两位一组查表；
    查不到就**丢弃该码位**并留空（调用方的质量门会发现"抽空了"）。
    """
    if cmap:
        out: list[str] = []
        for i in range(0, len(raw) - 1, 2):
            code = (raw[i] << 8) | raw[i + 1]
            mapped = cmap.get(code)
            if mapped is not None:
                out.append(mapped)
        if out:
            return "".join(out)
    return raw.decode("latin-1", "ignore")


def _iter_streams(data: bytes) -> list[tuple[bytes, bytes]]:
    """顺序扫描 ``stream ... endstream``，返回 (明文流, 流字典头部)。"""
    streams: list[tuple[bytes, bytes]] = []
    for match in re.finditer(rb"stream\r?\n", data):
        begin = match.end()
        end = data.find(b"endstream", begin)
        if end < 0:
            break
        # 流字典在关键字 ``stream`` 之前，向前找到最近的 ``<<``。
        head_start = data.rfind(b"<<", max(0, match.start() - 2000), match.start())
        head = data[head_start : match.start()] if head_start >= 0 else b""
        payload = data[begin:end].rstrip(b"\r\n")
        decoded = _decode_stream(payload, head)
        if decoded is not None:
            streams.append((decoded, head))
    return streams


def _extract_cmap_from(streams: list[tuple[bytes, bytes]]) -> dict[int, str]:
    """在所有流里找 ToUnicode CMap（以 ``beginbfchar``/``beginbfrange`` 为指纹）。"""
    mapping: dict[int, str] = {}
    for content, _head in streams:
        if b"beginbfchar" not in content and b"beginbfrange" not in content:
            continue
        mapping.update(parse_tounicode(content))
    return mapping


def _content_text(content: bytes, cmap: dict[int, str]) -> str:
    """从内容流里抽出文本，按 Td/TD/T*/TL/'/" 推断换行。"""
    pieces: list[str] = []
    pending: list[str] = []
    newline_pending = False
    i = 0
    n = len(content)
    array_depth = 0
    array_buf: list[str] = []
    last_token: bytes | None = None
    while i < n:
        ch = content[i : i + 1]
        if ch in (b"(", b"<"):
            if last_token is not None and not last_token.isalpha() and last_token not in (
                b"[",
            ):
                # 同一行里两个字符串相邻：补一个空格（PDF 靠 TJ 的间距表达断词）。
                pass
            if ch == b"(":
                raw, i = _read_literal(content, i)
            else:
                if content[i : i + 2] == b"<<":
                    # 内联字典（如 BDC 的属性）：跳过到匹配的 >>。
                    depth = 0
                    j = i
                    while j < n:
                        if content[j : j + 2] == b"<<":
                            depth += 1
                            j += 2
                            continue
                        if content[j : j + 2] == b">>":
                            depth -= 1
                            j += 2
                            if depth == 0:
                                break
                            continue
                        j += 1
                    i = j
                    last_token = b">>"
                    continue
                raw, i = _read_hex_string(content, i)
            text = _decode_string(raw, cmap)
            if array_depth:
                array_buf.append(text)
            else:
                pending.append(text)
            last_token = b"()"
            continue
        if ch == b"[":
            array_depth += 1
            array_buf = []
            i += 1
            last_token = b"["
            continue
        if ch == b"]":
            array_depth = max(0, array_depth - 1)
            if array_depth == 0:
                pending.append("".join(array_buf))
                array_buf = []
            i += 1
            last_token = b"]"
            continue
        if ch == b"%":
            nl = content.find(b"\n", i)
            i = n if nl < 0 else nl + 1
            continue
        if ch in b"0123456789+-.":
            # 数字：TJ 数组里的字距调整（负值=靠近，正值=可能断词）。
            j = i
            while j < n and content[j : j + 1] in b"0123456789+-.":
                j += 1
            token = content[i:j]
            if array_depth and token.startswith(b"-"):
                array_buf.append("")
            i = j
            last_token = token
            continue
        if ch in _WHITESPACE:
            i += 1
            continue
        if ch == b"'" or ch == b'"':
            if pending:
                pieces.append("".join(pending))
                pending = []
            pieces.append("\n")
            i += 1
            last_token = ch
            continue
        if ch.isalpha() or ch == b"*":
            j = i
            while j < n and (content[j : j + 1].isalpha() or content[j : j + 1] == b"*"):
                j += 1
            op = content[i:j]
            if op == b"Tj" or op == b"TJ":
                if pending:
                    pieces.append("".join(pending))
                    pending = []
                if newline_pending:
                    pieces.append("\n")
                    newline_pending = False
            elif op in (b"Td", b"TD", b"T*"):
                newline_pending = True
            elif op == b"ET":
                if pieces and pieces[-1] != "\n":
                    pieces.append("\n")
            i = j
            last_token = op
            continue
        i += 1
    if pending:
        pieces.append("".join(pending))
    return "".join(pieces)


def _quality(text: str) -> tuple[bool, str]:
    """三条质量门；返回 (是否可用, 原因)。"""
    stripped = "".join(text.split())
    if len(stripped) < 8:
        return False, "no-text-layer:抽出内容过短(可能只有页码或本就没有文本层)"
    # 私有区优先于「可打印占比」：U+E000–U+F8FF 是 Co 类，本身就算不可打印，
    # 先判 printable 会把「字体缺 ToUnicode」误报成笼统的 garbled —— 而那恰恰是
    # 用户最需要知道的原因（该 PDF 需要 OCR 或换解析器，不是文件损坏）。
    private = sum(1 for ch in text if 0xE000 <= ord(ch) <= 0xF8FF)
    if len(text) and private / len(text) >= 0.02:
        return False, "cid-unsupported:字体缺 ToUnicode 映射(抽出为私有区乱码)"
    printable = sum(1 for ch in text if ch.isprintable() or ch in "\n\t ")
    if len(text) and printable / len(text) < 0.85:
        return False, "garbled:可打印字符占比过低"
    return True, ""


def extract_pdf_text(path: str) -> tuple[str | None, str]:
    """抽取 PDF 文本层。返回 ``(文本, 原因)``；失败时文本为 None 且原因具名。"""
    try:
        with open(path, "rb") as handle:
            data = handle.read()
    except OSError as exc:
        return None, f"io-error:{exc.errno}"
    if b"/Encrypt" in data:
        return None, "encrypted:文档已加密(本抽取器不处理加密)"
    streams = _iter_streams(data)
    if not streams:
        return None, "no-text-layer:没有可解码的内容流"
    cmap = _extract_cmap_from(streams)
    chunks: list[str] = []
    for content, head in streams:
        # 只处理「看起来像内容流」的流：含 BT/ET 或 Tj 关键词。
        if b"BT" not in content and b"Tj" not in content:
            continue
        if b"/Subtype/Image" in head.replace(b" ", b""):
            continue
        chunks.append(_content_text(content, cmap))
    text = "\n".join(chunk.strip() for chunk in chunks if chunk.strip())
    if not text.strip():
        return None, "no-text-layer:内容流里没有文本操作符"
    ok, reason = _quality(text)
    if not ok:
        return None, reason
    return text, ""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
