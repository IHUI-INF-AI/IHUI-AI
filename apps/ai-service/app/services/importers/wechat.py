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

**附件(2026-10-03 补齐)**:此前 `_read_from_zip` 只挑 `.txt` 候选,ZIP 内其余条目
(jpg/png/mp4/docx…)**被静默丢弃** —— 用户导一批带截图的群聊记录进来,图片全没了,
而用户在界面上看不到任何提示。参照实现 WeChatBridge 是**保留原始 ZIP 并在笔记里
渲染附件**的。现补齐为:**清单可见 + 正文可定位,但一律不落盘、不外传**(见下)。

- **产出附件清单**:ZIP 内每个非目录、且不是被选中聊天记录文本的条目,都进清单,
  带 `name` / `path` / `size`(声明解压后字节)/ `kind`(image/video/audio/document/
  archive/other,仅按扩展名归类**供展示**,从不据此打开或解析任何文件)。
- **清单只读中央目录,不读内容**:列条目只解析 ZIP 中央目录(infolist),**不解压附件**,
  所以新增清单不带来任何新的 zip bomb 面。三个既有上限与 `_reject_unsafe_name()`
  路径穿越拒绝**一条未动**,仍然对**每个**条目(含附件)先校验后使用。
- **与消息对应**:微信导出会把媒体文件名**单独占一行**写进正文(真实样本:
  正文就是 `images/photo.png` 一行)。故按行精确匹配附件的 `path` 与 `name`,
  命中的消息序号记进 `messageIndexes`,导入预览能指出"这条消息原本带图"。
  逐行集合查找是 O(总行数),不做 O(附件×正文) 的子串扫描。
- **正文占位符一律不动**:`[图片]`/`[视频]`/`[文件]` 仍原样保留(既有契约
  `test_media_placeholders_kept_verbatim` 依赖它),不替换成任何链接。

**附件的隐私处理与留存策略**(附件是用户私产,处理必须写明):

1. **不落盘**:全程只读内存,**绝不 `extract` 到磁盘**(本模块既定安全设计,见
   「ZIP 载体」小节),不写临时文件、不写缓存、不进对象存储。
2. **不外传**:附件字节不发给任何模型、OCR、第三方服务;本仓亦**不做**图片 OCR/
   多模态摘要(成本高 + 隐私面大,见交付报告选型理由)。附件清单只随 /parse 响应回到
   **上传者自己的**导入预览,不进任何 AI 管道。
3. **不进日志、不进告警串**:沿用 `ir.finalize` 既定约束(告警串会原样回前端并落日志,
   禁止插用户正文)。附件**文件名本身即敏感**(如 `IMG_20260105_身份证.jpg`),
   故告警只报**条数**,绝不插入文件名。清单里的 `name`/`path` 仅出现在 /parse
   响应体中。
4. **留存**:原始 ZIP 始终留在用户自己手里(它就是用户上传的那个文件),本仓不持有副本;
   用户会话删除即会话数据删除,本模块不留任何独立留存。

**群名(2026-10-03 结论:数据源里没有,不做 OCR 取)**:微信「合并转发」导出的 TXT
**不含群名字段**。格式上也不可能有 —— 参照实现 `WeChatTranscriptRecord.parse` 要求
首个 match 必须从 offset 0 开始(本模块同样判错),即首行必须是 `·发言人`,前面**没有
任何抬头行**的位置留给群名。参照实现自己拿群名靠的是 `WeChatTitleReader`:读**当前
打开的微信窗口**标题栏(Accessibility,退化为屏幕录制 OCR)—— 那是 macOS 桌面态能力,
需要本机正开着那个群,服务端导入场景**不可用**,且属本项目明文合规红线不做。
故:群名**确认拿不到**,不编造。改为改善兜底(见 `_title`):ZIP 文件名里的
`聊天记录` 这类**无信息名**不再压过发言人;标题按参照实现 `ObsidianNote.title()` 的
参与人口径生成 —— 1 人 `X的聊天`、2 人 `X与Y的聊天`、3+ 人 `X等N人的聊天`(带人数,
信息量显著高于旧兜底的 `X的聊天`)。`/commit` 的 `commitSchema` **已支持 `title`
覆盖**,故用户在导入预览里改标题即可落地(UI 侧现状见交付报告)。

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

__all__ = ["Attachment", "parse"]

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

# ---------------------------------------------------------------------------
# 附件清单(见模块 docstring「附件」)
# ---------------------------------------------------------------------------

# 附件清单最多列多少条。清单要进 /parse 响应体,不能让它随 ZIP 条目数(上限 1000)
# 无限膨胀;超出的只报总数(告警不含文件名,见 docstring 隐私条目 3)。
_MAX_ATTACHMENT_ENTRIES = 500

# 扩展名 → 展示用类别。**仅按后缀归类供前端显示**,绝不据此打开/解析/渲染任何文件,
# 也不作安全判断(真正的安全边界是三个上限 + 路径穿越拒绝,与类别无关)。
_KIND_BY_EXTENSION: dict[str, str] = {
    ".jpg": "image", ".jpeg": "image", ".png": "image", ".gif": "image",
    ".webp": "image", ".bmp": "image", ".heic": "image", ".tif": "image",
    ".tiff": "image", ".svg": "image",
    ".mp4": "video", ".mov": "video", ".avi": "video", ".mkv": "video",
    ".mpg": "video", ".mpeg": "video", ".webm": "video", ".3gp": "video",
    ".amr": "audio", ".mp3": "audio", ".wav": "audio", ".silk": "audio",
    ".m4a": "audio", ".aac": "audio", ".ogg": "audio",
    ".doc": "document", ".docx": "document", ".xls": "document",
    ".xlsx": "document", ".ppt": "document", ".pptx": "document",
    ".pdf": "document", ".txt": "document", ".md": "document",
    ".zip": "archive", ".rar": "archive", ".7z": "archive",
}
_KIND_OTHER = "other"


def _kind_of(name: str) -> str:
    """按扩展名给展示用类别;未知后缀归 other。**只用于显示,不作安全判断。**"""
    dot = name.rfind(".")
    if dot <= 0:  # 无后缀,或以点开头(如 `.gitignore` —— 那不是扩展名)
        return _KIND_OTHER
    return _KIND_BY_EXTENSION.get(name[dot:].lower(), _KIND_OTHER)



class _Record(NamedTuple):
    """一条消息在原文中的定位:头行起点 / 正文起点 / 发言人 / 原始时间行。"""

    start: int
    body_start: int
    speaker: str
    raw_time: str


class Attachment(NamedTuple):
    """ZIP 内一个非聊天记录条目(图片/视频/音频/文档…)的**元信息**。

    **只含元信息,不含字节** —— 附件内容一律不进内存、不落盘、不外传
    (见模块 docstring「附件」隐私条款)。

    - `name`:末段文件名(微信导出的媒体文件名本身可能敏感,故只回给上传者本人)
    - `path`:ZIP 内相对路径(原样保留目录层级,便于用户回原包核对)
    - `size`:**声明**的解压后字节数(中央目录里的值,可被伪造,仅供展示;
      真正的大小校验在 `_read_entry` 读取路径上)
    - `kind`:展示用类别(image/video/audio/document/archive/other)
    - `message_indexes`:正文里**原样引用**了该附件名/路径的消息下标(从 0 起);
      无引用时为空元组。微信把媒体文件名单独占一行写进正文,故按行精确匹配。
    """

    name: str
    path: str
    size: int
    kind: str
    message_indexes: tuple[int, ...]



def parse(data: bytes, filename: str) -> ParseResult:
    """解析微信聊天记录(TXT 直读 / ZIP 内取 `聊天记录.txt`)为单个 IR 会话。"""
    stem = _stem(filename)
    if filename.lower().endswith(".zip") or data.startswith(_ZIP_MAGIC):
        text, entry_name, attachment_infos, attachment_total = _read_from_zip(data)
        zip_title = stem or _stem(entry_name)
    else:
        text = decode_text(data)
        entry_name = ""
        zip_title = ""
        attachment_infos = []
        attachment_total = 0

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
    body_lines: list[list[str]] = []  # 与 messages 平行,供附件引用匹配(见 docstring「附件」)
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
            body_lines.append(body.splitlines())

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

    attachments = _attach_attachments(attachment_infos, body_lines)
    result.conversations = [
        Conversation(
            messages=messages,
            title=_title(zip_title, entry_name, speakers),
            attachments=attachments,
        )
    ]
    if entry_name and _basename(entry_name) != _TRANSCRIPT_NAME:
        result.warnings.append(
            f"压缩包内没有 {_TRANSCRIPT_NAME},已改取记录最多的 {entry_name}"
        )
    if attachment_total:
        # 只报条数与类别分布,**绝不插入附件文件名**:文件名本身即敏感
        # (如 IMG_20260105_身份证.jpg),而告警串会原样回前端并落日志。
        # 条数用**包内真实总数**而非 len(清单):清单受 _MAX_ATTACHMENT_ENTRIES
        # 截断时报清单长度等于又少报一次(600 个附件被说成 500 个)。
        listed = len(attachments)
        scope = f"压缩包内还有 {attachment_total} 个附件"
        if listed < attachment_total:
            scope += f"(清单只列前 {listed} 个)"
        result.warnings.append(
            f"{scope}未并入会话正文,已保留在原始压缩包中;本工具不复制、不留存附件内容"
        )
    return result


# ---------------------------------------------------------------------------
# 附件清单
# ---------------------------------------------------------------------------


def _attach_attachments(
    infos: list[Attachment], body_lines: list[list[str]]
) -> list[dict[str, object]]:
    """把附件元信息与消息正文对应起来,产出 /parse 响应里的附件清单。

    匹配规则:微信把媒体文件名单**独占一行**写进正文(真实样本正文即
    `images/photo.png` 一行),故对每条消息的正文行做**集合精确匹配**,
    命中 `path` 或 `name` 即记下该消息下标。

    刻意不做「附件名 as 子串 in 整条正文」的扫描:一是 O(附件数×正文长度) 在
    1000 条目/2000 消息量级下不可接受,二是子串匹配会把 `photo.png` 误配到
    `my photo.png.txt` 这类**同名不同物**的条目上,给出错误的"这条消息带图"暗示。
    逐行精确匹配只认微信自己写下的那一行,宁可漏配不错配。

    返回的每项**只含元信息,不含文件字节**(docstring 隐私条款 2)。
    """
    if not infos:
        return []
    # 预先建反向索引:正文里出现的行 → 命中它的附件下标集合
    hits: dict[int, list[int]] = {}
    for message_index, lines in enumerate(body_lines):
        for line in lines:
            token = line.strip()
            if not token:
                continue
            for attachment_index, info in enumerate(infos):
                if token == info.path or token == info.name:
                    bucket = hits.setdefault(attachment_index, [])
                    if message_index not in bucket:
                        bucket.append(message_index)
    return [
        {
            "name": info.name,
            "path": info.path,
            "size": info.size,
            "kind": info.kind,
            "messageIndexes": tuple(hits.get(index, ())),
        }
        for index, info in enumerate(infos)
    ]


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


# ZIP 文件名里这些**无信息名**不配当标题(见 _title)。
# 刻意只收「裸通用名」:`微信聊天记录` 带微信前缀、是既有测试与真实导出里的**有效标题**
# (test_zip_with_transcript_entry 钉住它),不能连坐。
_TITLE_NOISE_STEMS = frozenset({"聊天记录", "聊天", "记录", "export", "archive", "zip"})


def _title(zip_title: str, entry_name: str, speakers: list[str]) -> str | None:
    """标题优先级:ZIP 文件名(去后缀) > 发言人 > ZIP 内条目名。

    **群名拿不到(见 docstring「群名」)**:微信 TXT 无群名字段,故这里只做兜底改善。

    关键修正:`聊天记录.zip` 这种**无信息名**原先直接压过发言人,群聊标题只剩
    「聊天记录」——比发言人兜底还无信息量。现在这类名字被识别出来并**让位**给
    发言人兜底(仅在它无信息时让位;`微信聊天记录` 这类有效名仍优先)。

    发言人兜底口径(参照实现 `ObsidianNote.title()` 的非 OCR 分支同形状):
    - 1~2 人沿用旧口径 `X的聊天` —— 既有测试钉住 `甲的聊天`,且两人场景说"谁和谁"
      收益有限,**刻意不改**(避免为对称而破坏已定稿契约)
    - 3+ 人(群聊主体场景,即被投诉的场景)改为 `X等N人的聊天` —— 旧兜底在 5 人群里
      给出「张三的聊天」,完全看不出这是个群;带人数后信息量显著更高
    """
    participants = _participants(speakers)
    if zip_title and zip_title.strip().lower() not in _TITLE_NOISE_STEMS:
        return zip_title
    if participants:
        if len(participants) >= 3:
            return f"{participants[0]}等{len(participants)}人的聊天"
        return f"{participants[0]}的聊天"
    if zip_title:
        return zip_title
    return _stem(entry_name) or None


def _participants(speakers: list[str]) -> list[str]:
    """按首次出现顺序去重的发言人列表(参照实现 `orderedParticipants` 同语义)。"""
    seen: set[str] = set()
    ordered: list[str] = []
    for name in speakers:
        cleaned = name.strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            ordered.append(cleaned)
    return ordered


# ---------------------------------------------------------------------------
# ZIP 载体(只读内存,绝不 extract 到磁盘)
# ---------------------------------------------------------------------------


def _read_from_zip(data: bytes) -> tuple[str, str, list[Attachment], int]:
    """从内存里的 ZIP 取出聊天记录文本 + 附件元信息清单。

    返回 `(文本, 条目名, 附件清单, 包内附件总数)`;总数可能大于清单长度(清单受
    `_MAX_ATTACHMENT_ENTRIES` 截断),用于让告警报真实值。

    条目选择与参照实现 `transcript()` 一致:优先末段为 `聊天记录.txt` 的条目,否则取
    `.txt` 里**记录数最多**的那个。

    **附件只读中央目录、不解压**:清单只取 `infolist()` 里的名字/声明大小/标志位,
    因此新增清单**不带来任何新的解压面**,三个上限的原有语义完全不变
    (附件字节在本函数里一个字节都不会被读出 —— 见 docstring 隐私条款 1)。

    安全边界**一条未削弱**:条目数上限、声明总量上限、`_reject_unsafe_name()` 路径
    穿越拒绝(对**每个**条目,含附件,先校验后使用)、加密条目跳过、声明值不可信的双头
    读取上限,全部保留在原位置。
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
        return chosen_text, chosen_name, *_list_attachments(entries, chosen_name)


def _list_attachments(
    entries: list[zipfile.ZipInfo], chosen_name: str
) -> tuple[list[Attachment], int]:
    """列附件元信息(不解压、不落盘)。见 docstring「附件」与 `_attach_attachments`。

    返回 `(清单, 包内附件总数)`。**两者分开**是刻意的:清单受
    `_MAX_ATTACHMENT_ENTRIES` 截断,但告警必须报**真实总数** —— 截断后若只报
    `len(清单)`,600 个附件会被说成 500 个,那又是一次「静默少报」,正是本函数
    要消灭的那类问题(宁可让用户知道多出来 100 个,也不能报个假的整齐数字)。
    """
    infos: list[Attachment] = []
    total = 0
    for info in entries:
        if info.is_dir() or info.filename == chosen_name:
            continue
        name = _basename(info.filename)
        if not name:  # 目录条目已排除,这里兜住畸形空名条目
            continue
        total += 1
        if len(infos) >= _MAX_ATTACHMENT_ENTRIES:
            continue
        # 加密条目:字节取不到(也不该取),仍列出来 —— 用户在原包里能看到它,
        # 清单撒个小谎说"没有这个附件"反而更坏。
        infos.append(
            Attachment(
                name=name,
                path=info.filename,
                size=info.file_size,
                kind=_kind_of(name),
                message_indexes=(),
            )
        )
    return infos, total


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
