# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D115(G-229):review 模式 `<review-findings>` 投影的三条纪律。

覆盖:
- JSON 块优先 / 代码围栏容错 / Markdown 兜底(`### P1 Blocking` + `path:line`)
- 失效方向 = 丢该条,不猜补:严重度表外、缺 file/title、无锚点项目符号一律不产出
- 点文件路径不被剥成裸名(`./.gitignore` 必须仍是 `.gitignore`,回归 `lstrip("./")` 那型)
- 帧形状与 `app/core/sse_contract.py` 登记的 payload_fields 逐字对账(不在测试里抄第二份键集)
"""

from __future__ import annotations

from app.core.review_findings import (
    MAX_FINDINGS,
    REVIEW_FINDING_EVENT,
    build_review_finding_frames,
    group_findings_by_severity,
    normalize_severity,
    parse_review_findings,
)
from app.core.sse_contract import SSE_EVENT_CONTRACTS


def _contract_fields() -> tuple[str, ...]:
    """取契约登记表里的字段集(判据单源:不在这里另抄一份键名)。"""
    for contract in SSE_EVENT_CONTRACTS:
        if contract.name == REVIEW_FINDING_EVENT:
            return tuple(contract.payload_fields)
    raise AssertionError("review-finding 未在 SSE_EVENT_CONTRACTS 登记")


def test_json_block_is_primary_source():
    text = (
        "## Review\n\n### P1 Blocking\n- src/a.py:3 有个空 except(不该从这里被采纳)\n\n"
        '<review-findings>\n[{"severity":"P1","file":"src/a.py","line":3,'
        '"title":"空 except","detail":"吞异常","suggestion":"至少记日志"}]\n'
        "</review-findings>\n"
    )
    findings = parse_review_findings(text)
    assert len(findings) == 1
    assert findings[0] == {
        "severity": "P1",
        "file": "src/a.py",
        "line": 3,
        "title": "空 except",
        "detail": "吞异常",
        "suggestion": "至少记日志",
    }


def test_json_block_tolerates_code_fence():
    text = (
        "<review-findings>\n```json\n"
        '[{"severity":"Nit","file":"b.ts","line":7,"title":"命名"}]\n'
        "```\n</review-findings>"
    )
    findings = parse_review_findings(text)
    assert [(f["severity"], f["file"], f["line"]) for f in findings] == [("Nit", "b.ts", 7)]
    # 缺 detail/suggestion:键恒在但为空串(端上不做"缺字段=没说过"的二次猜)
    assert findings[0]["detail"] == ""
    assert findings[0]["suggestion"] == ""


def test_severity_aliases_and_unknown_dropped():
    assert normalize_severity("p1") == "P1"
    assert normalize_severity(" BLOCKING ") == "P1"
    assert normalize_severity("Nitpick") == "Nit"
    assert normalize_severity("p3") == "Nit"
    assert normalize_severity("超高") is None
    assert normalize_severity(None) is None

    text = (
        "<review-findings>\n"
        '[{"severity":"超高","file":"a.py","line":1,"title":"猜不出的档位"},'
        '{"severity":"P2","title":"缺 file"},'
        '{"severity":"P2","file":"a.py"},'
        '{"severity":"P2","file":"a.py","line":2,"title":"合法"}]\n'
        "</review-findings>"
    )
    findings = parse_review_findings(text)
    assert [f["title"] for f in findings] == ["合法"]


def test_line_normalization():
    text = (
        "<review-findings>\n"
        '[{"severity":"P2","file":"a.py","line":"abc","title":"t1"},'
        '{"severity":"P2","file":"a.py","line":-5,"title":"t2"},'
        '{"severity":"P2","file":"a.py","title":"t3"}]\n'
        "</review-findings>"
    )
    # 非数字 / 负数 / 缺席 ⇒ 0(整文件级),不造行号
    assert [f["line"] for f in parse_review_findings(text)] == [0, 0, 0]


def test_markdown_fallback_keeps_dotfile_path():
    text = (
        "### P1 Blocking\n"
        "- `./.gitignore:12` 缺少 env 模板;建议补一行\n"
        "- 没有锚点的这一条不该产出\n"
        "\n### Nits\n"
        "- src/b.py:41 命名可更具体 — 建议 rename\n"
    )
    findings = parse_review_findings(text)
    assert [(f["severity"], f["file"], f["line"]) for f in findings] == [
        ("P1", ".gitignore", 12),
        ("Nit", "src/b.py", 41),
    ]
    # 标题里已剥掉锚点,不重复展示路径
    assert ".gitignore" not in findings[0]["title"]
    assert findings[0]["suggestion"] == ""


def test_empty_and_unrecognized_yield_nothing():
    assert parse_review_findings("") == []
    assert parse_review_findings("   \n") == []
    assert parse_review_findings("审查通过,没有问题。") == []
    assert parse_review_findings("<review-findings>[]</review-findings>") == []
    assert parse_review_findings("<review-findings>{bad json}</review-findings>") == []


def test_dedupe_and_cap():
    item = '{"severity":"P2","file":"a.py","line":1,"title":"同一处"}'
    assert len(parse_review_findings(f"<review-findings>[{item},{item}]</review-findings>")) == 1

    many = ",".join(
        f'{{"severity":"P2","file":"a{i}.py","line":1,"title":"t"}}' for i in range(MAX_FINDINGS + 5)
    )
    assert len(parse_review_findings(f"<review-findings>[{many}]</review-findings>")) == MAX_FINDINGS


def test_frame_shape_matches_contract():
    text = (
        "<review-findings>\n"
        '[{"severity":"P1","file":"a.py","line":2,"title":"t1"},'
        '{"severity":"P2","file":"b.py","line":0,"title":"t2"}]\n'
        "</review-findings>"
    )
    frames = build_review_finding_frames(text, target="uncommitted")
    assert [f["findingId"] for f in frames] == ["rf-1", "rf-2"]
    assert [f["index"] for f in frames] == [1, 2]
    assert {f["total"] for f in frames} == {2}
    assert all(f["type"] == REVIEW_FINDING_EVENT for f in frames)
    # 契约字段一个不少(只判"登记的都产出",允许多带 target)
    fields = _contract_fields()
    for frame in frames:
        assert set(fields) <= set(frame), fields
    assert frames[0]["target"] == "uncommitted"
    # 不给 target ⇒ 键不出现(缺席=未说明,不写空串)
    assert "target" not in build_review_finding_frames(text)[0]


def test_frames_empty_when_no_findings():
    assert build_review_finding_frames("没有 <review-findings> 块") == []


def test_group_by_severity_always_three_buckets():
    groups = group_findings_by_severity(
        [
            {"severity": "P2", "file": "a.py", "line": 1, "title": "t"},
            {"severity": "表外", "file": "a.py", "line": 1, "title": "被丢弃"},
        ]
    )
    assert list(groups) == ["P1", "P2", "Nit"]
    assert [len(groups[s]) for s in ("P1", "P2", "Nit")] == [0, 1, 0]


# =============================================================================
# 接线:review 模式的流收尾包装(llm.py 的 _with_review_findings)
# =============================================================================


async def _drain(source):
    return [frame async for frame in source]


async def test_stream_wrapper_emits_findings_right_before_done():
    """帧必须落在 `event: done` 之前(且只一轮),正文 chunk 原样透传。"""
    from app.routers.llm import _with_review_findings

    text = (
        '<review-findings>[{"severity":"P1","file":"a.py","line":3,"title":"t"}]'
        "</review-findings>"
    )

    async def source():
        yield "event: chunk\ndata: {}\n\n"
        yield "event: done\ndata: {}\n\n"

    frames = await _drain(_with_review_findings(source(), {"content": text}, "uncommitted"))
    assert frames[0].startswith("event: chunk\n")
    assert frames[-1].startswith("event: done\n")
    finding_frames = [f for f in frames if f.startswith("event: review-finding\n")]
    assert len(finding_frames) == 1
    assert frames.index(finding_frames[0]) == len(frames) - 2  # 紧邻 done 之前
    assert '"target": "uncommitted"' in finding_frames[0]


async def test_stream_wrapper_is_noop_without_findings():
    """取不到/解析不出 finding ⇒ 一帧都不发(绝不为了"看起来有数据"补造)。"""
    from app.routers.llm import _with_review_findings

    async def source():
        yield "event: chunk\ndata: {}\n\n"
        yield "event: done\ndata: {}\n\n"

    for content in ("", "审查通过,没有 finding。", "<review-findings>[]</review-findings>"):
        frames = await _drain(_with_review_findings(source(), {"content": content}))
        assert not any(f.startswith("event: review-finding\n") for f in frames)
        assert frames[-1].startswith("event: done\n")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
