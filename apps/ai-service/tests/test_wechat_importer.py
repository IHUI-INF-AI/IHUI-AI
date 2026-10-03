# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

r"""微信聊天记录导入解析器测试(D28 第 5 个数据源,2026-10-03 立)。

样本全部按微信「合并转发」真实导出的 `聊天记录.txt` 形态构造:头部是 U+00B7
MIDDLE DOT `·`(不是 U+2022)、时间行月/日不补零。覆盖 TXT/ZIP 双载体、记录数最多
的候选选择、zip bomb 与路径穿越防护、时间戳降级、占位符原样保留,以及
`SOURCES` 契约与 `ir.finalize` 截断。
"""

from __future__ import annotations

import io
import zipfile

import pytest

from app.services.importers import SOURCES, parse_conversation_file
from app.services.importers.ir import MAX_MESSAGES_PER_CONVERSATION
from app.services.importers.wechat import _MAX_ATTACHMENT_ENTRIES

# 真实导出片段:多发言人 + 多行正文 + 系统消息(无 · 头,按参照实现并入上一条正文)
CHAT_TXT = "\n".join(
    [
        "·甲",
        "2026年9月5日 08:05",
        "第一行",
        "第二行",
        "",
        "·乙",
        "2026年9月5日 08:06",
        "再见",
        "",
        "·甲",
        "2026年9月5日 08:07",
        "你撤回了一条消息",
        "",
    ]
)


def _txt(lines: list[str]) -> bytes:
    return ("\n".join(lines) + "\n").encode("utf-8")


def _zip(entries: list[tuple[str, bytes]], **kwargs: object) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, payload in entries:
            archive.writestr(name, payload)
    return buf.getvalue()


def _wechat(text: bytes, filename: str = "聊天记录.txt"):
    return parse_conversation_file("wechat", filename, text)


# ---------------------------------------------------------------------------
# TXT 载体:真实格式
# ---------------------------------------------------------------------------


def test_basic_shape_speaker_prefix_and_utc8_stamps() -> None:
    """基本形态:发言人前缀正确,UTC+8 本地时间归一到 UTC ISO。"""
    parsed, warnings, truncated = _wechat(CHAT_TXT.encode("utf-8"))
    assert truncated is False
    assert warnings == []
    convs = parsed["conversations"]
    assert len(convs) == 1  # 一个微信 TXT 就是一个会话
    assert convs[0]["title"] == "甲的聊天"
    # 2026年9月5日 08:05 (UTC+8) → 00:05Z
    assert convs[0]["sourceCreatedAt"] == "2026-09-05T00:05:00Z"
    assert convs[0]["sourceUpdatedAt"] == "2026-09-05T00:07:00Z"
    assert [(m["role"], m["content"], m.get("createdAt")) for m in convs[0]["messages"]] == [
        ("user", "甲：第一行\n第二行", "2026-09-05T00:05:00Z"),
        ("user", "乙：再见", "2026-09-05T00:06:00Z"),
        # 系统消息无 · 头 → 并入上一条正文,与参照实现一致
        ("user", "甲：你撤回了一条消息", "2026-09-05T00:07:00Z"),
    ]


def test_single_line_body() -> None:
    parsed, _w, _t = _wechat(_txt(["·甲", "2026年9月5日 08:05", "在的"]))
    assert [m["content"] for m in parsed["conversations"][0]["messages"]] == ["甲：在的"]


def test_body_with_blank_lines_preserved() -> None:
    """正文内空行是原文的一部分,必须保留(只 trim 掉消息间分隔的空行)。"""
    parsed, _w, _t = _wechat(
        _txt(["·甲", "2026年9月5日 08:05", "上段", "", "下段"])
    )
    assert parsed["conversations"][0]["messages"][0]["content"] == "甲：上段\n\n下段"


@pytest.mark.parametrize(
    ("stamp_line", "expected"),
    [
        ("2026年1月5日 09:05", "2026-01-05T01:05:00Z"),  # 月/日不补零(真机形态)
        ("2026年01月05日 09:05", "2026-01-05T01:05:00Z"),  # 补零也容忍
        ("2026年12月31日 23:59", "2026-12-31T15:59:00Z"),
    ],
)
def test_month_day_padding(stamp_line: str, expected: str) -> None:
    parsed, warnings, _t = _wechat(_txt(["·甲", stamp_line, "内容"]))
    assert warnings == []
    assert parsed["conversations"][0]["messages"][0]["createdAt"] == expected


def test_media_placeholders_kept_verbatim() -> None:
    """[图片]/[视频]/[文件]/[动画表情]/[语音] 一律原样保留,不替换不删除。"""
    placeholders = ["[图片]", "[视频]", "[文件]", "[动画表情]", "[语音]"]
    body = "\n".join(placeholders)
    parsed, _w, _t = _wechat(_txt(["·乙", "2026年9月5日 08:05", body]))
    content = parsed["conversations"][0]["messages"][0]["content"]
    assert content == "乙：" + body
    for token in placeholders:
        assert token in content


def test_bullet_u2022_is_not_a_header() -> None:
    """头部是 U+00B7;用 U+2022 圆点的文件不是微信导出 → 明确报错。"""
    with pytest.raises(ValueError, match="不像微信导出的聊天记录"):
        _wechat(_txt(["•甲", "2026年9月5日 08:05", "在的"]))


def test_plain_text_rejected() -> None:
    with pytest.raises(ValueError, match="不像微信导出的聊天记录"):
        _wechat(b"Dear Bob,\n\nThis is a plain English letter.\nRegards,\nAlice\n")


def test_leading_noise_rejected() -> None:
    """头部有前导内容 → 首个记录不在 offset 0,判为无法识别(同参照实现)。"""
    with pytest.raises(ValueError, match="不像微信导出的聊天记录"):
        _wechat(_txt(["导出时间：2026-09-05", "·甲", "2026年9月5日 08:05", "在的"]))


def test_empty_file_rejected() -> None:
    with pytest.raises(ValueError, match="为空"):
        _wechat(b"   \n  \n")


def test_broken_time_line_degrades_without_dropping_message() -> None:
    """时间行损坏 → 该条降级为无时间戳并告警,消息本身不能丢。

    两种损坏形态分别覆盖:日期/时刻越界(仍以数字开头,判为消息头但无时间戳)与时间行
    整行缺失(下一行不是数字,按参照实现并入上一条正文,同样不丢内容)。
    """
    parsed, warnings, _t = _wechat(
        _txt(
            [
                "·甲",
                "2026年9月5日 08:05",
                "第一条",
                "·乙",
                "2026年13月40日 99:99",
                "时间坏了也要留下",
                "·丙",
                "2026年9月5日",
                "缺了时刻",
                "·丁",
                "这不是时间行",
                "",
            ]
        )
    )
    messages = parsed["conversations"][0]["messages"]
    assert [m["content"] for m in messages] == [
        "甲：第一条",
        "乙：时间坏了也要留下",
        # `·丁` 后面那行不是数字 → 不算消息头,连正文一起并入上一条(同参照实现)
        "丙：缺了时刻\n·丁\n这不是时间行",
    ]
    assert messages[0]["createdAt"] == "2026-09-05T00:05:00Z"
    assert "createdAt" not in messages[1]  # 13月40日:正则过了但日期不存在
    assert "createdAt" not in messages[2]  # 缺 HH:MM
    assert sum("时间行格式异常" in w for w in warnings) == 1


def test_empty_body_skipped_with_warning() -> None:
    parsed, warnings, _t = _wechat(
        _txt(
            [
                "·甲",
                "2026年9月5日 08:05",
                "",
                "·乙",
                "2026年9月5日 08:06",
                "有内容",
                "",
            ]
        )
    )
    assert [m["content"] for m in parsed["conversations"][0]["messages"]] == ["乙：有内容"]
    assert any("正文为空已跳过" in w for w in warnings)


def test_all_empty_bodies_rejected() -> None:
    with pytest.raises(ValueError, match="没有一条带正文"):
        _wechat(_txt(["·甲", "2026年9月5日 08:05", ""]))


def test_utf8_bom_tolerated() -> None:
    parsed, _w, _t = _wechat(b"\xef\xbb\xbf" + _txt(["·甲", "2026年9月5日 08:05", "在的"]))
    assert parsed["conversations"][0]["messages"][0]["content"] == "甲：在的"


# ---------------------------------------------------------------------------
# ZIP 载体
# ---------------------------------------------------------------------------


def test_zip_with_transcript_entry() -> None:
    """微信实际导出的是 ZIP:内含 聊天记录.txt 时直接取,标题取 ZIP 文件名。"""
    blob = _zip([("聊天记录.txt", CHAT_TXT.encode("utf-8"))])
    parsed, warnings, truncated = _wechat(blob, "微信聊天记录.zip")
    assert truncated is False and warnings == []
    conv = parsed["conversations"][0]
    assert conv["title"] == "微信聊天记录"  # ZIP 文件名去后缀优先
    assert [m["content"] for m in conv["messages"]] == [
        "甲：第一行\n第二行",
        "乙：再见",
        "甲：你撤回了一条消息",
    ]


def test_zip_magic_without_zip_suffix() -> None:
    """后缀不可信时按 ZIP 魔数兜底识别。"""
    blob = _zip([("聊天记录.txt", CHAT_TXT.encode("utf-8"))])
    parsed, _w, _t = _wechat(blob, "export.dat")
    assert len(parsed["conversations"][0]["messages"]) == 3


def test_zip_falls_back_to_txt_with_most_records() -> None:
    """无 聊天记录.txt → 取记录数最多的 .txt,并出告警说明换了文件。"""
    richer = _txt(
        [
            "·甲",
            "2026年9月5日 08:05",
            "一",
            "·乙",
            "2026年9月5日 08:06",
            "二",
            "·甲",
            "2026年9月5日 08:07",
            "三",
        ]
    )
    blob = _zip(
        [
            ("readme.txt", b"not a transcript"),
            ("会话甲.txt", _txt(["·甲", "2026年9月5日 08:05", "只有一条"])),
            ("会话乙.txt", richer),
        ]
    )
    parsed, warnings, _t = _wechat(blob, "export.zip")
    assert [m["content"] for m in parsed["conversations"][0]["messages"]] == [
        "甲：一",
        "乙：二",
        "甲：三",
    ]
    assert any("没有 聊天记录.txt" in w for w in warnings)


def test_zip_named_entry_wins_over_richer_txt() -> None:
    """同时存在 聊天记录.txt 与更多记录的 txt → 仍按名字取(同参照实现优先级)。"""
    blob = _zip(
        [
            ("聊天记录.txt", _txt(["·甲", "2026年9月5日 08:05", "指定项"])),
            (
                "其他.txt",
                _txt(
                    [
                        "·甲",
                        "2026年9月5日 08:05",
                        "一",
                        "·乙",
                        "2026年9月5日 08:06",
                        "二",
                    ]
                ),
            ),
        ]
    )
    parsed, _w, _t = _wechat(blob, "export.zip")
    assert [m["content"] for m in parsed["conversations"][0]["messages"]] == ["甲：指定项"]


def test_zip_without_txt_rejected() -> None:
    with pytest.raises(ValueError, match="没有可用的"):
        _wechat(_zip([("图片.png", b"\x89PNG\r\n\x1a\n")]), "export.zip")


def test_zip_bomb_entry_rejected() -> None:
    """单条目解压后超 20MiB 上限 → 读取前就拒绝,不能 OOM。

    这是真实可构造的 zip bomb 形态:ZIP 本身很小(deflate 全同字节),解压后 21MiB。
    """
    payload = "z" * (21 * 1024 * 1024)
    blob = _zip([("聊天记录.txt", _txt(["·甲", "2026年9月5日 08:05", payload]))])
    assert len(blob) < 30 * 1024  # 压缩包本身很小,确实是个 bomb
    with pytest.raises(ValueError, match="超过单条目上限"):
        _wechat(blob, "bomb.zip")


def test_zip_entry_count_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    """条目数超上限 → 拒绝,不逐条读。"""
    monkeypatch.setattr("app.services.importers.wechat._MAX_ZIP_ENTRIES", 2)
    blob = _zip([(f"f{i}.txt", b"x") for i in range(5)])
    with pytest.raises(ValueError, match="条目数 5 超过上限 2"):
        _wechat(blob, "many.zip")


def test_zip_total_size_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    """解压总量超上限 → 拒绝(zip bomb 的主要形态:多个条目各自不超限、合计爆)。"""
    monkeypatch.setattr("app.services.importers.wechat._MAX_ZIP_TOTAL_BYTES", 32)
    blob = _zip([("聊天记录.txt", CHAT_TXT.encode("utf-8"))])
    with pytest.raises(ValueError, match="超过上限 32 字节"):
        _wechat(blob, "bomb.zip")


def test_zip_path_traversal_rejected() -> None:
    """条目名含 `../` → 拒绝,绝不 extract(本模块只读内存,不落盘)。"""
    blob = _zip([("../../evil.txt", b"pwned")])
    with pytest.raises(ValueError, match="非法条目路径"):
        _wechat(blob, "evil.zip")


def test_zip_absolute_and_backslash_names_rejected() -> None:
    with pytest.raises(ValueError, match="非法条目路径"):
        _wechat(_zip([("/etc/聊天记录.txt", b"x")]), "abs.zip")
    with pytest.raises(ValueError, match="非法条目路径"):
        _wechat(_zip([("..\\..\\win.txt", b"x")]), "win.zip")


def test_zip_broken_archive_rejected() -> None:
    with pytest.raises(ValueError, match="压缩包无法打开"):
        _wechat(b"PK\x03\x04 definitely not a zip", "broken.zip")


# ---------------------------------------------------------------------------
# 契约与收口
# ---------------------------------------------------------------------------


def test_sources_contract_includes_wechat() -> None:
    assert "wechat" in SOURCES
    assert SOURCES[-1] == "wechat"


def test_oversized_records_truncated_by_finalize() -> None:
    """超量记录交给 ir.finalize 截断,parser 不自己截。"""
    lines: list[str] = []
    for i in range(MAX_MESSAGES_PER_CONVERSATION + 5):
        lines += ["·甲", "2026年9月5日 08:05", f"第 {i} 条"]
    parsed, warnings, truncated = _wechat(_txt(lines))
    assert truncated is True
    assert len(parsed["conversations"][0]["messages"]) == MAX_MESSAGES_PER_CONVERSATION
    assert any("消息数超过上限" in w for w in warnings)


async def test_route_accepts_zip_and_wechat_source(client) -> None:
    """端到端:白名单放行 .zip,source=wechat 走真实解析器。"""
    blob = _zip([("聊天记录.txt", _txt(["·甲", "2026年9月5日 08:05", "在的"]))])
    resp = await client.post(
        "/api/session-import/parse",
        files={"file": ("微信聊天记录.zip", blob, "application/zip")},
        data={"source": "wechat"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["truncated"] is False
    assert body["conversations"][0]["title"] == "微信聊天记录"
    assert [m["content"] for m in body["conversations"][0]["messages"]] == ["甲：在的"]


# ---------------------------------------------------------------------------
# 附件保留(2026-10-03):ZIP 内非 txt 条目不再被静默丢弃
# ---------------------------------------------------------------------------


def test_zip_attachments_listed_with_kind_and_size() -> None:
    """图片/视频/文档条目全部进清单:带 name/path/size/kind,且不丢任何一类。"""
    blob = _zip(
        [
            ("聊天记录.txt", CHAT_TXT.encode("utf-8")),
            ("images/photo.png", b"\x89PNG\r\n\x1a\n" + b"x" * 100),
            ("video/clip.mp4", b"\x00" * 50),
            ("docs/方案.docx", b"PK\x03\x04" + b"y" * 20),
            ("images/表情.gif", b"GIF89a" + b"z" * 10),
        ]
    )
    parsed, warnings, _t = _wechat(blob, "微信聊天记录.zip")
    attachments = parsed["conversations"][0]["attachments"]
    assert {a["name"] for a in attachments} == {"photo.png", "clip.mp4", "方案.docx", "表情.gif"}
    kinds = {a["name"]: a["kind"] for a in attachments}
    assert kinds == {
        "photo.png": "image",
        "clip.mp4": "video",
        "方案.docx": "document",
        "表情.gif": "image",
    }
    # 保留目录层级,用户能回原包核对
    paths = {a["path"] for a in attachments}
    assert "images/photo.png" in paths and "video/clip.mp4" in paths
    # size 是中央目录的声明解压大小
    assert next(a for a in attachments if a["name"] == "photo.png")["size"] == 108
    assert any("4 个附件" in w for w in warnings)


def test_zip_attachment_warning_never_leaks_filenames() -> None:
    """附件文件名本身敏感(身份证/私密照),告警串只报条数与类别,绝不插文件名。

    告警串会原样回前端并落日志(ir.finalize 既定约束),文件名进日志即等于外泄。
    """
    secret = "IMG_20260105_身份证.jpg"
    blob = _zip(
        [
            ("聊天记录.txt", CHAT_TXT.encode("utf-8")),
            (f"images/{secret}", b"\xff\xd8\xff" + b"q" * 30),
        ]
    )
    _parsed, warnings, _t = _wechat(blob, "群聊.zip")
    assert warnings, "有附件必须出告警(不能静默丢弃)"
    joined = " ".join(warnings)
    assert secret not in joined
    assert "身份证" not in joined
    assert "images/" not in joined
    assert "1 个附件" in joined


def test_attachment_referenced_by_message_body_is_located() -> None:
    """正文里原样写出媒体文件名的消息,附件清单能定位到该消息下标。

    真实样本形态:微信把媒体文件名单独占一行写进正文。
    """
    blob = _zip(
        [
            (
                "聊天记录.txt",
                _txt(
                    [
                        "·甲",
                        "2026年9月5日 08:05",
                        "看这个",
                        "images/photo.png",
                        "·乙",
                        "2026年9月5日 08:06",
                        "收到",
                    ]
                ),
            ),
            ("images/photo.png", b"\x89PNG\r\n\x1a\n"),
            ("images/other.png", b"\x89PNG\r\n\x1a\n"),
        ]
    )
    parsed, _w, _t = _wechat(blob, "群聊.zip")
    attachments = {a["name"]: a for a in parsed["conversations"][0]["attachments"]}
    assert attachments["photo.png"]["messageIndexes"] == (0,)
    # 正文没引用的附件不谎报关联
    assert attachments["other.png"]["messageIndexes"] == ()


def test_attachment_matching_is_line_exact_not_substring() -> None:
    """子串不算引用:正文里 photo.png 出现在别的行内不得误报。

    防的是把 photo.png 误配到 my photo.png.txt 这类同名不同物的条目,
    给出错误的「这条消息带图」暗示。宁可漏配不错配。
    """
    blob = _zip(
        [
            (
                "聊天记录.txt",
                _txt(["·甲", "2026年9月5日 08:05", "文件名是 photo.png 这样的"]),
            ),
            ("images/photo.png", b"\x89PNG\r\n\x1a\n"),
        ]
    )
    parsed, _w, _t = _wechat(blob, "群聊.zip")
    assert parsed["conversations"][0]["attachments"][0]["messageIndexes"] == ()


def test_attachments_absent_key_for_txt_and_attachmentless_zip() -> None:
    """TXT 直读 / 无附件的 ZIP:响应体里**不出现** attachments 键(不留空壳)。"""
    parsed, warnings, _t = _wechat(CHAT_TXT.encode("utf-8"), "聊天记录.txt")
    assert "attachments" not in parsed["conversations"][0]
    assert warnings == []

    blob = _zip([("聊天记录.txt", CHAT_TXT.encode("utf-8"))])
    parsed2, warnings2, _t2 = _wechat(blob, "微信聊天记录.zip")
    assert "attachments" not in parsed2["conversations"][0]
    assert warnings2 == []


def test_chosen_transcript_not_listed_as_attachment() -> None:
    """被选中的聊天记录文本本身不算附件;落选的其它 txt 算(它也在包里)。"""
    blob = _zip(
        [
            ("聊天记录.txt", _txt(["·甲", "2026年9月5日 08:05", "一"])),
            ("其他.txt", _txt(["·乙", "2026年9月5日 08:06", "二"])),
        ]
    )
    parsed, _w, _t = _wechat(blob, "微信聊天记录.zip")
    names = {a["name"] for a in parsed["conversations"][0]["attachments"]}
    assert names == {"其他.txt"}


def test_attachment_listing_does_not_weaken_entry_limits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """**安全边界未被削弱**:附件条目同样计入三个上限,且路径穿越照样拒绝。"""
    # 条目数上限对附件生效(附件不是防护豁免区)
    monkeypatch.setattr("app.services.importers.wechat._MAX_ZIP_ENTRIES", 3)
    blob = _zip(
        [
            ("聊天记录.txt", CHAT_TXT.encode("utf-8")),
            ("a.png", b"a"),
            ("b.png", b"b"),
            ("c.png", b"c"),
        ]
    )
    with pytest.raises(ValueError, match="条目数"):
        _wechat(blob, "many.zip")

    # 声明总量上限对附件生效
    monkeypatch.undo()
    monkeypatch.setattr("app.services.importers.wechat._MAX_ZIP_TOTAL_BYTES", 64)
    blob2 = _zip(
        [
            ("聊天记录.txt", CHAT_TXT.encode("utf-8")),
            ("big.mp4", b"q" * 4096),
        ]
    )
    with pytest.raises(ValueError, match="超过上限"):
        _wechat(blob2, "bomb.zip")

    # 附件条目里的路径穿越照样拒绝
    monkeypatch.undo()
    with pytest.raises(ValueError, match="路径穿越"):
        _wechat(_zip([("../../evil.png", b"x")]), "evil.zip")


def test_attachment_bytes_never_reach_the_response() -> None:
    """清单只带元信息,不带字节:响应体里不得出现附件二进制内容。"""
    marker = b"SECRETBINARYMARKER" * 4
    blob = _zip(
        [
            ("聊天记录.txt", CHAT_TXT.encode("utf-8")),
            ("images/photo.png", marker),
        ]
    )
    parsed, _w, _t = _wechat(blob, "群聊.zip")
    attachment = parsed["conversations"][0]["attachments"][0]
    # 每项只应有这五个元信息键,没有任何字节字段
    assert set(attachment) == {"name", "path", "size", "kind", "messageIndexes"}
    assert all(not isinstance(v, (bytes, bytearray)) for v in attachment.values()), (
        "附件字节绝不能进 /parse 响应体"
    )


# ---------------------------------------------------------------------------
# 群名兜底(2026-10-03):确认 TXT 内无群名,改为按参与人数改善兜底
# ---------------------------------------------------------------------------


def test_title_noise_zip_name_yields_to_participants() -> None:
    """`聊天记录.zip` 这种无信息名不再压过发言人 —— 这正是群名丢失的现场。"""
    blob = _zip([("聊天记录.txt", CHAT_TXT.encode("utf-8"))])
    parsed, _w, _t = _wechat(blob, "聊天记录.zip")
    # 旧行为:title == "聊天记录"(完全无信息);新行为:落到发言人兜底
    assert parsed["conversations"][0]["title"] != "聊天记录"
    assert parsed["conversations"][0]["title"] == "甲的聊天"


def test_group_title_carries_participant_count() -> None:
    """群聊(3+ 人)兜底带人数:`X等N人的聊天`,比旧兜底「X的聊天」信息量高。"""
    lines: list[str] = []
    for speaker in ("张三", "李四", "王五", "赵六"):
        lines += [f"·{speaker}", "2026年9月5日 08:05", "在"]
    parsed, _w, _t = _wechat(_txt(lines), "聊天记录.txt")
    assert parsed["conversations"][0]["title"] == "张三等4人的聊天"


def test_participant_count_deduplicates_repeat_speakers() -> None:
    """人数按**去重后的发言人**算,不是按消息条数(否则一人自聊会算成群)。"""
    lines: list[str] = []
    for _ in range(5):
        lines += ["·独白", "2026年9月5日 08:05", "记"]
    parsed, _w, _t = _wechat(_txt(lines), "聊天记录.txt")
    assert parsed["conversations"][0]["title"] == "独白的聊天"


def test_meaningful_zip_name_still_wins_over_participants() -> None:
    """有效 ZIP 文件名仍是最高优先级(不能为了改兜底把好标题降级)。"""
    blob = _zip([("聊天记录.txt", CHAT_TXT.encode("utf-8"))])
    parsed, _w, _t = _wechat(blob, "产品发布群.zip")
    assert parsed["conversations"][0]["title"] == "产品发布群"


def test_attachment_manifest_truncation_reports_true_total() -> None:
    """清单被 _MAX_ATTACHMENT_ENTRIES 截断时,告警必须报**真实总数**而非清单长度。

    防的是「又少报一次」:600 个附件被说成 500 个,用户以为包底干净了。
    """
    entries = [("聊天记录.txt", CHAT_TXT.encode("utf-8"))]
    entries += [(f"i{index}.png", b"x") for index in range(_MAX_ATTACHMENT_ENTRIES + 100)]
    parsed, warnings, _t = _wechat(_zip(entries), "群聊.zip")
    listed = parsed["conversations"][0]["attachments"]
    assert len(listed) == _MAX_ATTACHMENT_ENTRIES  # 清单确实被截断
    joined = " ".join(warnings)
    assert f"{_MAX_ATTACHMENT_ENTRIES + 100} 个附件" in joined  # 报真实总数
    assert f"清单只列前 {_MAX_ATTACHMENT_ENTRIES} 个" in joined  # 并说明截断
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
