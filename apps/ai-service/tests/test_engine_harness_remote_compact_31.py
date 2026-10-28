# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""远端服务端压缩 v2 纯算法移植单测(2026-09-19 第三十一批,对标 compact_remote_v2.rs)。

覆盖:历史分组 / client developer 判定 / 保留过滤 / token 预算截断 / 图像预算扣减 /
图像原子截断 / v2 历史装配 / request 装配内核。断言均为本移植自有的确定性行为(不追求
与 Codex Rust 测试字符串逐字一致,因 token 估算采用轻量启发式)。
"""

from __future__ import annotations

from app.core import remote_compact as rc


# ----------------------- 构造辅助 -----------------------
def msg(role: str, text: str, *, metadata=None) -> dict:
    return {"role": role, "content": [{"type": "text", "text": text}]}


def img_msg(text: str = "", *, image_url: str = "data:image/png;base64,abc") -> dict:
    parts = []
    if text:
        parts.append({"type": "text", "text": text})
    parts.append({"type": "image_url", "image_url": {"url": image_url}})
    return {"role": "user", "content": parts}


def env(item: dict, metadata=None) -> rc.Envelope:
    return rc.Envelope(item=item, metadata=metadata)


def agent_msg(author: str, recipient: str, text: str) -> dict:
    return {
        "role": "assistant",
        "agent_message": {
            "author": author,
            "recipient": recipient,
            "content": [{"type": "text", "text": text}],
        },
    }


# ----------------------- 1. attached notice 判定 -----------------------
def test_is_attached_notice_developer_tag():
    assert rc.is_attached_notice(msg("developer", "<image_resize_notice>gen</image_resize_notice>"))
    assert not rc.is_attached_notice(msg("developer", "plain developer"))
    assert not rc.is_attached_notice(msg("user", "<image_resize_notice>x</image_resize_notice>"))


# ----------------------- 2. history_item_groups 配对 -----------------------
def test_history_item_groups_pairs_notice():
    items = [
        env(msg("user", "u")),
        env(msg("developer", "<image_resize_notice>gen</image_resize_notice>")),
        env(msg("user", "v")),
    ]
    groups = rc.history_item_groups(items)
    assert len(groups) == 2
    assert groups[0].source.item["content"][0]["text"] == "u"
    assert groups[0].attached_notice is not None
    assert groups[1].attached_notice is None
    assert groups[1].source.item["content"][0]["text"] == "v"


# ----------------------- 3. v2 分组拆出 client developer 通告 -----------------------
def test_v2_history_item_groups_splits_client_developer():
    items = [
        env(msg("user", "keep")),
        env(msg("developer", "<image_resize_notice>client</image_resize_notice>"),
            metadata={"client_authored": True}),
    ]
    groups = rc.v2_history_item_groups(items)
    # client developer 通告被拆成独立组
    assert len(groups) == 2
    assert groups[1].source.metadata == {"client_authored": True}
    assert groups[1].attached_notice is None


# ----------------------- 4. client authored developer 判定 -----------------------
def test_is_client_authored_developer_message():
    assert rc.is_client_authored_developer_message(
        env(msg("developer", "d"), metadata={"client_authored": True})
    )
    assert not rc.is_client_authored_developer_message(
        env(msg("developer", "d"), metadata={"client_authored": False})
    )
    assert not rc.is_client_authored_developer_message(
        env(msg("user", "u"), metadata={"client_authored": True})
    )


# ----------------------- 5. 保留过滤 -----------------------
def test_retained_filter_user_and_developer():
    assert rc.is_retained_for_remote_compaction_v2(env(msg("user", "u")), False)
    assert not rc.is_retained_for_remote_compaction_v2(env(msg("assistant", "a")), False)
    assert not rc.is_retained_for_remote_compaction_v2(env(msg("system", "s")), False)
    # developer 非 client → 不保留
    assert not rc.is_retained_for_remote_compaction_v2(
        env(msg("developer", "d"), metadata={"client_authored": False}), True
    )
    # developer client 且 flag=True → 保留
    assert rc.is_retained_for_remote_compaction_v2(
        env(msg("developer", "d"), metadata={"client_authored": True}), True
    )


def test_retained_filter_agent_progress_and_completion():
    # 后代进度(author 以 recipient+/ 开头 + MESSAGE)→ 不保留
    prog = env(agent_msg("parent/sub", "parent", rc.AGENT_DESCENDANT_PROGRESS + "x"))
    assert not rc.is_retained_for_remote_compaction_v2(prog, False)
    # 完成(FINAL_ANSWER)→ 不保留
    done = env(agent_msg("parent", "parent", rc.AGENT_COMPLETION + "y"))
    assert not rc.is_retained_for_remote_compaction_v2(done, False)
    # 普通 agent 消息 → 保留(未超 token 上限)
    normal = env(agent_msg("parent", "parent", "hello world"))
    assert rc.is_retained_for_remote_compaction_v2(normal, False)


def test_retained_filter_agent_over_token_cap():
    huge = "z" * (rc.MAX_RETAINED_AGENT_MESSAGE_TOKENS * 4 + 100)
    big = env(agent_msg("parent", "parent", huge))
    assert not rc.is_retained_for_remote_compaction_v2(big, False)


# ----------------------- 6. token 预算截断(保留最新) -----------------------
def test_truncate_keeps_newest_within_budget():
    items = [
        env(msg("user", "old")),
        env(msg("user", "middle")),
        env(msg("user", "new")),
    ]
    # 预算仅够保留 "new"(1 token) 与边界截断后的 "middle"(截断到 1 token),
    # "old"(1 token) 因预算耗尽被丢弃
    out = rc.truncate_retained_messages_for_remote_compaction(items, max_tokens=2)
    texts = [e.item["content"][0]["text"] for e in out]
    assert "old" not in texts
    assert "new" in texts


# ----------------------- 7. build_v2_compacted_history 装配 -----------------------
def test_build_v2_filters_and_appends_output():
    comp = {"role": "compaction", "content": "summary"}
    input_items = [
        msg("system", "sys"),
        msg("developer", "dev"),
        msg("assistant", "a"),
        msg("user", "u"),
    ]
    meta = [None, None, None, None]
    history, img_count = rc.build_v2_compacted_history(
        input_items, meta, comp, retain_client_developer_messages=False,
        image_budget_enabled=False,
    )
    assert history[-1] == comp
    roles = [m["role"] for m in history]
    assert roles == ["user", "compaction"]
    assert img_count == 0


def test_build_v2_counts_retained_images():
    comp = {"role": "compaction", "content": "summary"}
    input_items = [img_msg("user text", image_url="data:image/png;base64,abc")]
    meta = [None]
    history, img_count = rc.build_v2_compacted_history(
        input_items, meta, comp, retain_client_developer_messages=False,
        image_budget_enabled=True,
    )
    assert img_count == 1
    assert history[-1] == comp
    # 用户消息(含图像)被保留
    assert history[0]["role"] == "user"


# ----------------------- 8. 文本截断到预算 -----------------------
def test_truncate_message_text_to_budget():
    e = env(msg("user", "a" * 200))
    out = rc.truncate_message_text_to_token_budget(e, max_tokens=2)
    assert out is not None
    text = out.item["content"][0]["text"]
    # 保留头部约 max_tokens token,截断标记额外占用少量 token(宽松校验)
    assert rc.approx_token_count(text) <= 2 + 3
    assert rc.TRUNCATE_MARKER in text


def test_truncate_message_text_to_budget_all_dropped():
    # 仅文本且预算为 0 → 无内容 → None
    e = env(msg("user", "a"))
    out = rc.truncate_message_text_to_token_budget(e, max_tokens=0)
    assert out is None


# ----------------------- 9. 图像原子截断 -----------------------
def test_truncate_message_image_atomic_keeps_images():
    e = env(img_msg("keep text", image_url="data:image/png;base64,abc"))
    out = rc.truncate_message_to_token_budget(e, max_tokens=1)
    # 图像成本 >= 1,应整体保留(原子)而非裁掉图像
    assert out is not None
    has_image = any(p.get("type") == "image_url" for p in out.item["content"])
    assert has_image


# ----------------------- 10. 图像预算启用 vs 关闭 -----------------------
def test_image_budget_enabled_charges_images():
    items = [env(img_msg("u", image_url="data:image/png;base64," + "Z" * 8000))]
    # 关闭预算:图像不计费,文本极小 → 保留
    out_off = rc.truncate_retained_messages(items, max_tokens=2, image_budget_enabled=False)
    assert len(out_off) == 1
    # 启用预算:data 图像字节计费(约 6000 token)超预算 → 不保留
    out_on = rc.truncate_retained_messages(items, max_tokens=2, image_budget_enabled=True)
    assert len(out_on) == 0


# ----------------------- 11. request 装配内核 -----------------------
def test_assemble_remote_compaction_prompt_appends_trigger():
    input_items = [msg("user", "u")]
    prompt = rc.assemble_remote_compaction_prompt(
        input_items, tools=[{"name": "x"}], base_instructions="sys"
    )
    assert prompt["input"][-1] == {"type": "compaction_trigger"}
    assert prompt["tools"] == [{"name": "x"}]
    assert prompt["base_instructions"] == "sys"
    assert prompt["output_schema_strict"] is True
    assert prompt["parallel_tool_calls"] is True


# ----------------------- 12. 图像 token 计费为字节近似 -----------------------
def test_image_token_cost_data_vs_file():
    data_cost = rc.image_token_cost("data:image/png;base64," + "A" * 4000)  # ~3000 字节 → 3 token
    assert data_cost >= 1
    file_cost = rc.image_token_cost("file:///tmp/x.png")
    assert file_cost == rc.FILE_IMAGE_TOKEN_COST
