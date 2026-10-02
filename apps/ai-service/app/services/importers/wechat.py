# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

r"""微信「合并转发」聊天记录解析器(D28 第 5 个数据源,2026-10-03 立)。

**合规红线**:数据来源是用户**自己**从微信「合并转发」导出的 `聊天记录.txt`
(或包含它的 ZIP)。本模块**不读微信本地数据库、不解密任何加密字段、不注入微信
进程、不做协议逆向** —— 只对纯文本做正则切分。格式判据与参照实现
WeChatBridge 的 `WeChatTranscriptRecord.parse` 逐行核对一致。

真实格式(头部是 **U+00B7 MIDDLE DOT `·`**,不是 U+2022 `•` —— 这是最容易搞错的
地方,照 `•` 写正则会一条都匹配不到):

    ·甲
    2026年9月5日 08:05
    第一行
    第二行

    ·乙
    2026年9月5日 08:06
    再见

- 头行:`·` + 发言人昵称 + `\n`
- 时间行:`YYYY年M月D日 HH:MM`(**月/日不补零**,故判据是 `\d{1,2}`)
- 正文:直到下一个 `·` 头行之前,可以多行
- 参照实现正则原文:`(?m)^·([^\n]+)\n(\d{4}年\d{1,2}月\d{1,2}日 \d{2}:\d{2})\n`
- 参照实现要求首个 match 必须从 offset 0 开始,否则判定"无法识别"并报错;本模块一致

**一个 TXT = 一个会话**:微信导出的一份 `聊天记录.txt` 就是一个群/一个好友的聊天
记录(参照实现的 `transcript()` 也只取单个 transcript),所以返回**单个
`Conversation`**,不做多会话切分。

**角色映射决策**:微信聊天没有 user/assistant 的概念,靠"哪方是自己"去猜会 50% 错。
方案是把发言人昵称写进正文前缀(`发言人昵称：正文`),role 一律 `user`:落库后前端
按普通用户消息渲染,发言人信息不丢,且不会凭空造出 assistant 气泡。

**时区**:时间行不带时区,微信客户端只写本地时间。参照实现取 `TimeZone.current`,
本服务没有"用户所在时区"上下文,固定按 **Asia/Shanghai(UTC+8)** 解释,再交给
`ir.to_iso` 换算成 UTC ISO。选 +8 而不是 +00:00:偏 8 小时的时间戳会让会话在列表里
明显排错位置。

**已知行为(与参照实现一致,刻意不修)**:微信系统消息(`你撤回了一条消息`、
`XXX 加入了群聊`、`<红色心形特效>`)没有 `·` 头行,会被并进**上一条**消息的正文。
它们本就属于那个时间窗的上下文,合并比丢弃更接近原始聊天读的观感。

**与参照实现的一处刻意放宽**:头行 `·昵称` 的下一行以数字开头但不是合法时间行
(如 `2026年13月40日 25:99`)时,参照实现的正则匹配不到 → 该条连同正文被并进上一条。
本模块把它降级成"无时间戳的一条消息"并计数告警 —— 丢消息比丢时间戳严重得多。
下一行不以数字开头的 `·` 行(用户在正文里自己打了 `·`)仍按正文续行处理,与参照一致。

**体积**:单个 TXT 可能上万条记录,本模块不重复截断,统一交给 `ir.finalize`
(每会话 2000 条 / 单会话正文 1.5M 字符上限)。
"""

from __future__ import annotations

import io
import os
import re
import zipfile
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

from .ir import Conversation, Message, ParseResult, decode_text, message, to_iso

__all__ = ["parse"]

# 头行:U+00B7 MIDDLE DOT + 昵称(到行尾)。刻意不接受 U+2022,微信不用它
_SPEAKER_RE = re.compile(r"^·([^\n]+)", re.MULTILINE)
# 时间行:月/日不补零。合法性与"能否构造出真实日期"分开判(见 _stamp)
_STAMP_RE = re.compile(r"^(\d{4})年(\d{1,2})月(\d{1,2})日 (\d{2}):(\d{2})$")

# 微信 TXT 无时区信息,按国内统一 UTC+8 解释(见模块 docstring「时区」)
_CST = timezone(timedelta(hours=8))

_TRANSCRIPT_NAME = "聊天记录.txt"
_ZIP_MAGIC = b"PK\x03\x04"

# ZIP 防护上限(参照项目在这块很严;我们只读不落盘,风险较低但仍设限防 zip bomb)
_MAX_ZIP_ENTRIES = 1000
_MAX_ZIP_TOTAL_BYTES = 200 * 1024 * 1024
_MAX_ZIP_ENTRY_BYTES = 20 * 1024 * 1024
# ZIP 条目标志位:0x1 = 加密。加密条目读不了,给明确中文错误而不是让 zipfile 抛 RuntimeError 变 500
_ZIP_ENCRYPTED_FLAG = 0x1


class _Record(NamedTuple):
    """一条消息在原文中的定位:头行起点 / 正文起点 / 发言人 / 原始时间行。"""

    start: int
    body_start: int
    speaker: str
    raw_time: str


def parse(data: bytes, filename: str) -> ParseResult:
    """解析微信聊天记录(TXT 直读 / ZIP 内取 `聊天记录.txt`)为单个 IR 会话。"""
    stem = _stem(filename)
    if filename.lower().endswith(".zip") or data.startswith(_ZIP_MAGIC):
        text, entry_name = _read_from_zip(data)
        zip_title = stem or _stem(entry_name)
    else:
        text = decode_text(data)
        entry_name = ""
        zip_title = ""

    result = ParseResult()
    records = _scan(text)
    # 参照实现要求首个 match 从 offset 0 开始:文件头上有别的东西(说明不是微信导出)
    # 或整篇一条记录都识别不出,都判为无法识别
    if not records or records[0].start != 0:
        raise ValueError(
            "这个文件不像微信导出的聊天记录:未找到以「·昵称 + 年月日 时间」开头的记录"
            "(微信「合并转发」导出的 聊天记录.txt 第一行应为「·发言人昵称」)"
        )

    broken_stamps = 0
    empty_bodies = 0
    speakers: list[str] = []
    messages: list[Message] = []
    for index, record in enumerate(records):
        end = records[index + 1].start if index + 1 < len(records) else len(text)
        body = text[record.body_start : end].strip()
        if not body:
            empty_bodies += 1
            continue
        stamp = _stamp(record.raw_time)
        if stamp is None:
            broken_stamps += 1
        if record.speaker:
            speakers.append(record.speaker)
        # role 一律 user + 昵称前缀:见模块 docstring「角色映射决策」
        msg = message("user", f"{record.speaker}：{body}", stamp)
        if msg is not None:
            messages.append(msg)

    if broken_stamps:
        result.warnings.append(
            f"{broken_stamps} 条消息的时间行格式异常(应为「YYYY年M月D日 HH:MM」),"
            "已按无时间戳导入"
        )
    if empty_bodies:
        result.warnings.append(f"{empty_bodies} 条消息正文为空已跳过")
    if not messages:
        raise ValueError(
            "这个文件不像微信导出的聊天记录:识别到 "
            f"{len(records)} 条记录头,但没有一条带正文"
        )

    result.conversations = [
        Conversation(messages=messages, title=_title(zip_title, entry_name, speakers))
    ]
    if entry_name and _basename(entry_name) != _TRANSCRIPT_NAME:
        result.warnings.append(
            f"压缩包内没有 {_TRANSCRIPT_NAME},已改取记录最多的 {entry_name}"
        )
    return result


# ---------------------------------------------------------------------------
# 记录切分
# ---------------------------------------------------------------------------


def _scan(text: str) -> list[_Record]:
    """扫出全部消息头。头行下一行必须以数字开头,否则按正文续行(同参照实现)。"""
    records: list[_Record] = []
    for match in _SPEAKER_RE.finditer(text):
        line_start = match.end() + 1  # 跳过头行换行
        if line_start >= len(text) or not text[line_start : line_start + 1].isdigit():
            continue  # 正文里自己打的 `·`,不是消息头
        line_end = text.find("\n", line_start)
        if line_end == -1:
            line_end = len(text)
        records.append(
            _Record(
                start=match.start(),
                body_start=line_end + 1,
                speaker=match.group(1).strip(),
                raw_time=text[line_start:line_end],
            )
        )
    return records


def _stamp(raw: str) -> str | None:
    """`2026年9月5日 08:05`(UTC+8)→ UTC ISO;格式或日期非法返回 None(降级不丢弃)。"""
    found = _STAMP_RE.match(raw.strip())
    if found is None:
        return None
    year, month, day, hour, minute = (int(part) for part in found.groups())
    try:
        moment = datetime(year, month, day, hour, minute, tzinfo=_CST)
    except ValueError:  # 2026年13月40日 这类:正则过了但日期不存在
        return None
    return to_iso(moment.isoformat())


def _title(zip_title: str, entry_name: str, speakers: list[str]) -> str | None:
    """标题优先级:ZIP 文件名(去后缀) > 首个发言人 +「的聊天」> ZIP 内条目名。"""
    if zip_title:
        return zip_title
    if speakers:
        return f"{speakers[0]}的聊天"
    return _stem(entry_name) or None


# ---------------------------------------------------------------------------
# ZIP 载体(只读内存,绝不 extract 到磁盘)
# ---------------------------------------------------------------------------


def _read_from_zip(data: bytes) -> tuple[str, str]:
    """从内存里的 ZIP 取出聊天记录文本,返回(文本, 条目名)。

    条目选择与参照实现 `transcript()` 一致:优先末段为 `聊天记录.txt` 的条目,否则取
    `.txt` 里**记录数最多**的那个。
    """
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except (zipfile.BadZipFile, OSError) as exc:
        raise ValueError(f"压缩包无法打开(不是有效的 ZIP 或已损坏):{exc}") from None

    with archive:
        entries = archive.infolist()
        if len(entries) > _MAX_ZIP_ENTRIES:
            raise ValueError(
                f"压缩包内条目数 {len(entries)} 超过上限 {_MAX_ZIP_ENTRIES},已拒绝解析"
            )
        declared = sum(info.file_size for info in entries)
        if declared > _MAX_ZIP_TOTAL_BYTES:
            raise ValueError(
                f"压缩包声明解压后共 {declared} 字节,超过上限 "
                f"{_MAX_ZIP_TOTAL_BYTES} 字节,已拒绝解析"
            )
        for info in entries:
            _reject_unsafe_name(info.filename)

        named = [
            info
            for info in entries
            if not info.is_dir()
            and _basename(info.filename) == _TRANSCRIPT_NAME
            and not info.flag_bits & _ZIP_ENCRYPTED_FLAG
        ]
        candidates = named or [
            info
            for info in entries
            if not info.is_dir()
            and info.filename.lower().endswith(".txt")
            and not info.flag_bits & _ZIP_ENCRYPTED_FLAG
        ]
        if not candidates:
            raise ValueError(
                f"压缩包内没有可用的 {_TRANSCRIPT_NAME}(也没有其他 .txt 聊天记录文件)"
            )

        # 无 聊天记录.txt 时取记录数最多的候选(参照实现 candidates.max { records.count })
        chosen_name = candidates[0].filename
        chosen_text = decode_text(_read_entry(archive, candidates[0]))
        chosen_records = len(_scan(chosen_text))
        for info in candidates[1:]:
            text = decode_text(_read_entry(archive, info))
            count = len(_scan(text))
            if count > chosen_records:
                chosen_name, chosen_text, chosen_records = info.filename, text, count
        return chosen_text, chosen_name


def _reject_unsafe_name(name: str) -> None:
    """条目名含路径穿越/绝对路径/反斜杠 → 拒绝。"""
    if ".." in name or "\\" in name or name.startswith("/") or (
        len(name) > 1 and name[1] == ":"
    ):
        raise ValueError(f"压缩包内含非法条目路径(疑似路径穿越):{name!r},已拒绝解析")


def _read_entry(archive: zipfile.ZipFile, info: zipfile.ZipInfo) -> bytes:
    """在内存里读一个条目,声明大小与实际读取量双头上限(声明值可被伪造)。"""
    if info.file_size > _MAX_ZIP_ENTRY_BYTES:
        raise ValueError(
            f"压缩包条目 {_basename(info.filename)} 声明解压后 {info.file_size} 字节,"
            f"超过单条目上限 {_MAX_ZIP_ENTRY_BYTES} 字节,已拒绝解析"
        )
    with archive.open(info) as handle:
        payload = handle.read(_MAX_ZIP_ENTRY_BYTES + 1)
    if len(payload) > _MAX_ZIP_ENTRY_BYTES:
        raise ValueError(
            f"压缩包条目 {_basename(info.filename)} 实际解压超过单条目上限 "
            f"{_MAX_ZIP_ENTRY_BYTES} 字节(声明值不可信),已拒绝解析"
        )
    return payload


# ---------------------------------------------------------------------------
# 文件名
# ---------------------------------------------------------------------------


def _basename(name: str) -> str:
    """取末段文件名;ZIP 规范用 `/`,但恶意包会用 `\\`,一并归一。"""
    return name.replace("\\", "/").rsplit("/", 1)[-1]


def _stem(filename: str) -> str:
    """上传文件名去目录去后缀(前端可能传 `C:\\fakepath\\xxx.zip`)。"""
    return os.path.splitext(_basename(filename))[0]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
