# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""审批授权归属键与寿命的回归(2026-09-28 把 "session" 档从「本轮」升成「本会话」)。

立因:用户在弹窗里点「本会话总是允许」,下一轮同一个工具**又弹一次**。
成因不是判据写错,而是落点键用了 `session_id`,而 `streamSessionId` 由网关每轮新生成
(`apps/api/src/routes/ai-chat-stream.ts` 的 `randomUUID()`)—— 下一轮换一个 id,
上一轮那格根本读不到。声明的档位与执行的寿命不同形,等于那一档从未实现。

本文件钉四件事:
  ① 归属键 = **令牌主体 + conversationId**;任一缺失 ⇒ 退回本轮桶(不新增放行面);
  ② 会话桶必须**跨轮换 id 仍命中**(这就是本次改动买的东西),而跨主体/跨会话不命中;
  ③ 寿命有界:滑动 TTL 到期即失效、条目就地丢弃,总桶数不越 `_GRANT_MAX_BUCKETS`;
  ④ 收尾只许收本轮桶 —— 会话桶在 finally 里被删,本次改动就当场作废。
另加一条**源码级装车锁**(GT9):判据住在 helper 里而调用点仍走 `session_id` 直取,
是"函数在、没人调"那一型(守门 70/76/81 同族),只有源码锁能防。

全程纯函数 + 手工时钟,不起服务、不碰 DB/Redis(§5 测试隔离铁律)。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.routers import llm

# 与生产常量同源,不在测试里抄第二份数字(抄了就会在常量改动时假绿/假红)。
TTL = llm._GRANT_TTL_SECONDS
MAX_BUCKETS = llm._GRANT_MAX_BUCKETS

OWNER_A = "11111111-1111-1111-1111-111111111111"
OWNER_B = "22222222-2222-2222-2222-222222222222"
CONV_1 = "aaaaaaaa-0000-0000-0000-000000000001"
CONV_2 = "aaaaaaaa-0000-0000-0000-000000000002"
TURN_1 = "turn-one-uuid"
TURN_2 = "turn-two-uuid"


@pytest.fixture(autouse=True)
def _clean_grants() -> Any:
    """每张用例从空表开始 —— 授权表是模块级可变单例,不清就会互相串证据。"""
    llm._tool_approval_grants.clear()
    yield
    llm._tool_approval_grants.clear()


def test_gt1_归属键_主体与会话齐备才走会话桶() -> None:
    assert llm._grant_bucket_key(OWNER_A, CONV_1, TURN_1) == f"conv::{OWNER_A}::{CONV_1}"
    # 三个缺失形态各一例:缺主体 / 缺会话 / 都缺(含空白串) ⇒ 一律退回本轮桶
    for owner, conv in ((None, CONV_1), (OWNER_A, None), (None, None), ("  ", CONV_1), (OWNER_A, "")):
        bucket = llm._grant_bucket_key(owner, conv, TURN_1)
        assert bucket == f"turn::{TURN_1}", f"归属不全时不得进入跨轮桶:owner={owner!r} conv={conv!r}"


def test_gt2_会话桶跨轮换_id_仍命中() -> None:
    now = 1_000.0
    bucket = llm._grant_bucket_key(OWNER_A, CONV_1, TURN_1)
    llm._grant_record(bucket, "write_file", "session", now)
    # 下一轮:同一个主体 + 同一个 conversationId,session_id 已经换了
    next_turn_bucket = llm._grant_bucket_key(OWNER_A, CONV_1, TURN_2)
    assert next_turn_bucket == bucket, "会话桶键必须与本轮 id 无关,否则本次改动没有生效"
    assert llm._grant_lookup(next_turn_bucket, "write_file", now + 1.0) == "session"


def test_gt3_跨主体与跨会话都不得继承授权() -> None:
    now = 1_000.0
    llm._grant_record(llm._grant_bucket_key(OWNER_A, CONV_1, TURN_1), "write_file", "always", now)
    # 另一个用户的同一个 conversationId(uuid 不是权限边界,主体才是)
    assert llm._grant_lookup(llm._grant_bucket_key(OWNER_B, CONV_1, TURN_2), "write_file", now) is None
    # 同一个用户的另一个会话
    assert llm._grant_lookup(llm._grant_bucket_key(OWNER_A, CONV_2, TURN_2), "write_file", now) is None
    # 另一个工具(授权按工具名落,不连带放行)
    assert llm._grant_lookup(llm._grant_bucket_key(OWNER_A, CONV_1, TURN_2), "run_command", now) is None


def test_gt4_本轮桶在流收尾时被收回而会话桶不() -> None:
    now = 1_000.0
    turn_bucket = llm._grant_bucket_key(None, None, TURN_1)
    conv_bucket = llm._grant_bucket_key(OWNER_A, CONV_1, TURN_1)
    llm._grant_record(turn_bucket, "write_file", "session", now)
    llm._grant_record(conv_bucket, "write_file", "session", now)
    assert llm._grant_drop_if_turn_scoped(turn_bucket) is True
    assert turn_bucket not in llm._tool_approval_grants
    # 会话桶:收尾不得删 —— 它的定义就是"活过本轮"
    assert llm._grant_drop_if_turn_scoped(conv_bucket) is False
    assert llm._grant_lookup(conv_bucket, "write_file", now + 5.0) == "session"


def test_gt5_到期即失效且条目被就地丢弃() -> None:
    now = 2_000.0
    bucket = llm._grant_bucket_key(OWNER_A, CONV_1, TURN_1)
    llm._grant_record(bucket, "write_file", "session", now)
    assert llm._grant_lookup(bucket, "write_file", now + TTL - 1) == "session"
    assert llm._grant_lookup(bucket, "write_file", now + TTL * 2) is None
    # 过期条目不得继续占格(空桶必须收掉,否则"有界"只是句空话)
    assert bucket not in llm._tool_approval_grants


def test_gt6_命中即滑动续期() -> None:
    now = 3_000.0
    bucket = llm._grant_bucket_key(OWNER_A, CONV_1, TURN_1)
    llm._grant_record(bucket, "write_file", "session", now)
    # 在快到期时读一次 ⇒ 到期时刻被推后,再过一个 TTL 仍然有效
    assert llm._grant_lookup(bucket, "write_file", now + TTL - 10) == "session"
    assert llm._grant_lookup(bucket, "write_file", now + TTL + 5) == "session"


def test_gt7_总桶数有界且按最近使用淘汰() -> None:
    now = 4_000.0
    first = f"conv::o::{0}"
    llm._grant_record(first, "write_file", "session", now)
    for i in range(MAX_BUCKETS + 5):
        llm._grant_record(f"conv::o::{i + 1}", "write_file", "session", now)
    assert len(llm._tool_approval_grants) <= MAX_BUCKETS, "授权表不得无界增长"
    assert llm._grant_lookup(first, "write_file", now) is None, "最久未触碰的桶应被淘汰"


def test_gt8_evict_不清空未到期内容() -> None:
    now = 5_000.0
    alive = llm._grant_bucket_key(OWNER_A, CONV_1, TURN_1)
    dead = "conv::dead::x"
    llm._grant_record(alive, "write_file", "session", now)
    llm._tool_approval_grants[dead] = {"read_file": ("session", now - 1)}
    llm._grant_evict(now)
    assert dead not in llm._tool_approval_grants, "整桶到期必须被扫掉"
    assert alive in llm._tool_approval_grants, "未到期的桶不得被顺手清掉(反向对照)"


def test_gt9_装车锁_调用点必须走那三个出口() -> None:
    """判据住在 helper 而调用点仍用 session_id 直取 = 函数在、没人调(守门 70/76/81 同族)。

    用 ast 划"允许直接摸授权表"的行区间(那四个出口函数的体内),区间之外任何一处
    出现 `_tool_approval_grants` 都算绕过出口 —— 按行文本猜"这行像不像在 helper 里"
    会被自己的措辞骗过去(注释里也写着这些名字)。
    """
    import ast as _ast

    with open(llm.__file__ or "", encoding="utf-8") as _f:
        src = _f.read()
    tree = _ast.parse(src)
    allowed_names = {
        "_grant_bucket_key",
        "_grant_lookup",
        "_grant_record",
        "_grant_evict",
        "_grant_drop_if_turn_scoped",
    }
    allowed_lines: set[int] = set()
    for node in _ast.walk(tree):
        if isinstance(node, (_ast.FunctionDef, _ast.AsyncFunctionDef)) and node.name in allowed_names:
            allowed_lines.update(range(node.lineno, node.end_lineno + 1))
    # 模块级声明那一行(带类型标注)同样允许
    for i, line in enumerate(src.splitlines(), start=1):
        if line.startswith("_tool_approval_grants: dict"):
            allowed_lines.add(i)

    offenders = [
        (i, line.strip())
        for i, line in enumerate(src.splitlines(), start=1)
        if "_tool_approval_grants" in line and i not in allowed_lines and not line.strip().startswith("#")
    ]
    assert not offenders, f"绕过出口直接操作授权表:{offenders[:3]}"

    # 三个调用点必须真的在链路上(只在测试里调用 helper 不构成装车)
    assert "_grant_lookup(" in src and "_grant_record(" in src
    assert "_grant_drop_if_turn_scoped(_grants_bucket())" in src, "收尾清理没接到会话级归属的新形态"
    # 反向锁:改前那句"无条件按本轮 session_id 清桶"不得回来(它会把会话档又降成本轮档)
    assert "_tool_approval_grants.pop(session_id" not in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
