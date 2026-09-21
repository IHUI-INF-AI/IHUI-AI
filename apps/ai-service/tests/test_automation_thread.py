# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D12 automation_thread 单元测试。

覆盖:
1. 注入上下文 —— 有 conversationId 时历史消息注入 prompt 头部
2. 无 conversationId 行为不变 —— 不取历史、不落库,run_agent 收到原始 prompt
3. 落库调用 —— 有 conversationId 时产出落库到同一会话
"""

import app.services.automation_thread as at


async def test_injects_context_from_recent_messages():
    captured: dict = {}

    async def run_agent(prompt, conversation_id):
        captured["prompt"] = prompt
        captured["session"] = conversation_id
        return "ok"

    recent = [
        {"role": "user", "content": "帮我盯一下竞品 A 的定价"},
        {"role": "assistant", "content": "已记录,竞品 A 当前 ¥99/月"},
    ]

    async def get_recent(cid, uid, limit):
        return recent

    out = await at.run_automation_thread(
        prompt="再对比一下竞品 B",
        conversation_id="conv-1",
        user_uuid="u-1",
        get_recent_messages=get_recent,
        run_agent=run_agent,
    )
    assert out == "ok"
    # 上下文头部包含历史,且原 prompt 仍出现
    assert "竞品 A 当前 ¥99/月" in captured["prompt"]
    assert "再对比一下竞品 B" in captured["prompt"]
    assert captured["session"] == "conv-1"


async def test_no_conversation_id_keeps_legacy_behavior():
    called_persist = []
    seen_prompt = {}

    async def run_agent(prompt, conversation_id):
        seen_prompt["prompt"] = prompt
        seen_prompt["session"] = conversation_id
        return "legacy"

    async def persist(conversation_id, user_uuid, output):
        called_persist.append(output)

    out = await at.run_automation_thread(
        prompt="每日简报",
        conversation_id=None,  # 无绑定
        run_agent=run_agent,
        persist_message=persist,  # 提供也应被忽略
    )
    assert out == "legacy"
    assert seen_prompt["prompt"] == "每日简报"  # 原样,未注入上下文
    assert seen_prompt["session"] is None
    assert called_persist == []  # 未落库


async def test_persists_output_to_conversation():
    persisted: list[tuple] = []

    async def run_agent(prompt, conversation_id):
        return "本期简报:大盘平稳"

    async def persist(conversation_id, user_uuid, output):
        persisted.append((conversation_id, user_uuid, output))

    async def get_recent(cid, uid, limit):  # 空历史:async 接口,返回空列表
        return []

    out = await at.run_automation_thread(
        prompt="每日简报",
        conversation_id="conv-9",
        user_uuid="u-9",
        get_recent_messages=get_recent,
        run_agent=run_agent,
        persist_message=persist,
    )
    assert out == "本期简报:大盘平稳"
    assert persisted == [("conv-9", "u-9", "本期简报:大盘平稳")]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
