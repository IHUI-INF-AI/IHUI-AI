# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""present_files 显式交付声明契约(2026-11-14 立,对标 DSH dsh-tool-present)。

病灶:自动交付清单只收得到「经由文件工具写入」的 diff 证据,run_command 构建产物 /
office_document 转换产物 / 脚本导出图表都不会出现在 filesChanged 里,模型没有任何
办法点名"这些才是最终交付物"。本工具补这一层声明面。

判据:
① 只登记不读盘:任意路径字符串(含不存在的文件)都被接受,绝不因"服务端看不到
   本地工作区"而误杀;
② 失败闭合:空列表 / 非数组 / 非对象项 / 空路径 / 控制字符 / 超长 / 超过 8 个
   一律整次拒绝,不做半登记、不静默截断;
③ 去重:同路径忽略大小写保首现;描述折叠空白并截断 200 字;
④ 交付清单聚合:presentedFiles 与 filesChanged 分开(不伪造 +n/-n),同路径合并
   stepIds,上限 20,契约形状始终含 presentedFiles 键;
⑤ 工具注册表双射:_TOOLS 与 _TOOL_HANDLERS 同时登记。
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services import mcp_server
from app.services.agent_deliverables import DeliverablesCollector
from app.services.agent_loop_v2 import AgentLoopV2


@pytest.mark.asyncio
async def test_present_files_registers_paths_and_normalizes_description():
    out = await mcp_server._tool_present_files(
        {
            "files": [
                {"path": "dist/report.pdf", "description": "最终 PDF\n报告"},
                {"path": "dist\\chart.png"},
                {"path": "DIST/REPORT.PDF", "description": "重复项"},
            ]
        }
    )
    assert out["ok"] is True
    assert out["count"] == 2
    assert out["presented"] == [
        {"path": "dist/report.pdf", "description": "最终 PDF 报告"},
        {"path": "dist/chart.png"},
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("files", "code"),
    [
        (None, "INVALID_ARGUMENTS"),
        ([], "INVALID_ARGUMENTS"),
        ("dist/a.pdf", "INVALID_ARGUMENTS"),
        ([{"path": "a"}] * 9, "TOO_MANY_FILES"),
        (["a"], "INVALID_ARGUMENTS"),
        ([{"description": "no path"}], "INVALID_PATH"),
        ([{"path": "   "}], "INVALID_PATH"),
        ([{"path": "a\x00b"}], "INVALID_PATH"),
        ([{"path": "x" * 501}], "INVALID_PATH"),
    ],
)
async def test_present_files_rejects_invalid_input_without_partial_registration(files, code):
    out = await mcp_server._tool_present_files({"files": files})
    assert out["ok"] is False
    assert out["errorCode"] == code
    assert out["presented"] == []


@pytest.mark.asyncio
async def test_present_files_is_registered_in_both_registries():
    names = {t.name for t in mcp_server._TOOLS}
    assert "present_files" in names
    assert "present_files" in mcp_server._TOOL_HANDLERS
    assert len(mcp_server._TOOLS) == len(mcp_server._TOOL_HANDLERS)


def test_collector_keeps_presented_files_separate_from_changed_files():
    c = DeliverablesCollector()
    c.record_presented("dist/report.pdf", "最终 PDF", ["s1"])
    c.record_presented("dist/report.pdf", "", ["s2"])
    c.record_presented("DIST/REPORT.PDF", "后到的描述", ["s3"])
    c.record_presented("dist/chart.png")

    payload = c.build("done")
    assert payload["filesChanged"] == []
    assert payload["presentedFiles"] == [
        {"path": "dist/report.pdf", "description": "最终 PDF", "stepIds": ["s1", "s2", "s3"]},
        {"path": "dist/chart.png", "stepIds": []},
    ]


def test_collector_presented_files_capped_at_20():
    c = DeliverablesCollector()
    for i in range(25):
        c.record_presented(f"out/{i}.txt")
    assert len(c.build("")["presentedFiles"]) == 20


def test_agent_loop_records_presented_files_from_dict_and_json_string():
    c = DeliverablesCollector()
    loop = SimpleNamespace(_deliverables=c)
    AgentLoopV2._record_presented_files(
        loop, {"ok": True, "presented": [{"path": "out/a.pdf", "description": "A"}]}, "c1"
    )
    AgentLoopV2._record_presented_files(
        loop, '{"ok": true, "presented": [{"path": "out/b.pdf"}]}', "c2"
    )
    # 失败结果与畸形 JSON 不得登记(声明失败就是没声明)
    AgentLoopV2._record_presented_files(loop, {"ok": False, "presented": [{"path": "x"}]}, "c3")
    AgentLoopV2._record_presented_files(loop, "{not json", "c4")
    # 非字符串/空白 path 必须丢弃(不能把 Any 塞给 record_presented,也不能登记死路径)
    AgentLoopV2._record_presented_files(
        loop,
        {"ok": True, "presented": [{"path": 42}, {"path": "  "}, {"description": "no path"}]},
        "c5",
    )

    assert [p["path"] for p in c.build("")["presentedFiles"]] == ["out/a.pdf", "out/b.pdf"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
