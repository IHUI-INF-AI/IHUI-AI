# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""交付物与文件引用指导契约(2026-11-14 立,对标 DSH dsh-deliverable-file-references)。

判据:
① 静态段落覆盖 DSH 的每条可观察规则:内联图片、尖括号目标、#L 行号、标签只用别名、
   只发布定稿交付物、不罗列源码、1-2 个最重要、上限与"不复制内容";
② 注入落在首条 system 消息尾部(没有 system 就新建),不改动任何用户消息;
③ 幂等:同一段只进一次,resume/重入不重复膨胀;
④ 接线锁:run() 入口必须调用注入方法;present_files 描述必须保留"轮次结束后展示"
   与"不要只为罗列源码调用"两条时序约束。
"""

from __future__ import annotations

import pathlib

from app.core.deliverable_guidance import (
    DELIVERABLE_FILE_REFERENCES,
    DELIVERABLE_GUIDANCE_OPEN,
)
from app.services.agent_loop_v2 import AgentLoopV2
from app.services.mcp_server import _TOOLS


def _loop() -> AgentLoopV2:
    # 注入方法只吃 messages,不碰实例状态:绕开重构造,保持测试只测行为。
    return AgentLoopV2.__new__(AgentLoopV2)


def _present_files_description() -> str:
    for tool in _TOOLS:
        if tool.name == "present_files":
            return tool.description
    raise AssertionError("present_files 未注册")


def test_guidance_covers_every_dsh_rule():
    text = DELIVERABLE_FILE_REFERENCES
    assert text.startswith(DELIVERABLE_GUIDANCE_OPEN)
    assert text.rstrip().endswith("</deliverable_file_references>")
    for fragment in (
        "![说明](<路径>)",
        "[说明](<路径>)",
        "尖括号",
        "#L24-L30",
        ":24-30",
        "不要把完整路径塞进标签",
        "present_files 只用于发布最终交付物",
        "轮次结束后才向用户展示",
        "不要为了罗列刚编辑过的源码文件",
        "1-2 个最重要的交付物",
        "最多 8 个",
        "文件内容不会被复制",
    ):
        assert fragment in text, fragment


def test_inject_appends_to_existing_system_message():
    messages = [
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "帮我做一份报告"},
    ]
    _loop()._inject_deliverable_guidance(messages)
    assert len(messages) == 2
    assert messages[0]["content"].startswith("你是助手")
    assert DELIVERABLE_FILE_REFERENCES in messages[0]["content"]
    assert messages[1] == {"role": "user", "content": "帮我做一份报告"}


def test_inject_creates_system_message_when_absent():
    messages = [{"role": "user", "content": "hi"}]
    _loop()._inject_deliverable_guidance(messages)
    assert messages[0] == {"role": "system", "content": DELIVERABLE_FILE_REFERENCES}
    assert messages[1]["role"] == "user"


def test_inject_is_idempotent_across_reentry():
    messages = [{"role": "system", "content": "base"}, {"role": "user", "content": "hi"}]
    loop = _loop()
    loop._inject_deliverable_guidance(messages)
    once = messages[0]["content"]
    loop._inject_deliverable_guidance(messages)
    assert messages[0]["content"] == once
    assert messages[0]["content"].count(DELIVERABLE_GUIDANCE_OPEN) == 1


def test_run_entry_calls_guidance_injection():
    src = pathlib.Path(__file__).resolve().parents[1].joinpath(
        "app", "services", "agent_loop_v2.py"
    ).read_text(encoding="utf-8")
    assert "self._inject_deliverable_guidance(messages)" in src


def test_present_files_description_keeps_timing_contract():
    desc = _present_files_description()
    for fragment in ("轮次结束后才会在交付清单里展示", "不要只为罗列刚编辑过的源码文件", "最多 8 个"):
        assert fragment in desc, fragment
