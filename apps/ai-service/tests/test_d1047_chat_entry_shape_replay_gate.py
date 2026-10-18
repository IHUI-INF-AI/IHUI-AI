# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D1047 diff①(条目扩展·零行为)的形状锁 + 闸开/闸关双向用例。

为什么锁在**源码形状**上而不是夹具上:取数侧
``app/core/approval_replay.py::chat_pending_approval_replays`` 早在 2026-10-18
就落库了,但它对"生产条目缺字段"一律判不重放(双闸 fail-closed),而生产条目
``llm.py`` 里根本没有那些格 ⇒ 那批用例只证明过**夹具形状**,从没证明过生产形状。
这正是本仓反复踩的"尺子量的是自己造的东西"型(AGENTS §22c:测试不得复制判据)。
本档把键集**从 llm.py 源码里取出来**再喂给生产函数,夹具改不动结论。

取材口径与 ``scripts/tests/check-head-typecheck.test.mjs`` 同规:**源码写法锁只能读
工作树**(本测试与被测代码同枚提交,读 HEAD 会让它落地前恒红、落地后红在上一版)。
"""

from __future__ import annotations

import asyncio
import re
from pathlib import Path

from app.core.approval_replay import _REPLAY_FIELDS, chat_pending_approval_replays

LLM_PY = Path(__file__).resolve().parents[1] / "app" / "routers" / "llm.py"
_ENTRY_ANCHOR = '_approval_sessions.setdefault(session_id, {})[_approval_id] = {'


def _production_entry_keys() -> set[str]:
    """从 llm.py 的生产条目字面量里取出**顶层键集**(不手写、不复制)。"""
    src = LLM_PY.read_text(encoding='utf-8')
    at = src.index(_ENTRY_ANCHOR)
    # 锚点常量本身不含缩进,故取它在源文件里那一行的真实行首偏移算缩进,
    # 键行 = 锚点缩进 + 4(写死 4 会让本尺恒取到空集 —— 已实测)。
    key_indent = (at - src.rfind('\n', 0, at) - 1) + 4
    body = src[at:]
    keys: set[str] = set()
    depth = 0
    for raw in body.splitlines():
        stripped = raw.strip()
        depth += stripped.count('{') - stripped.count('}')
        if depth == 0 and stripped.startswith('}'):
            break
        if len(raw) - len(raw.lstrip()) == key_indent:
            m = re.match(r'"([A-Za-z_][A-Za-z0-9_]*)"\s*:', stripped)
            if m:
                keys.add(m.group(1))
    return keys


def _entry_from_production_keyset(**overrides: object) -> dict[str, object]:
    """按**现读生产键集**造一条条目:每个键给一个能过闸的值,overrides 只许改现存的键。

    键集缺任何一格 ⇒ 对应断言拿不到值即失败;新增键也不会让本函数静默过关
    (它总是要 ``event`` 与 ``decision`` 两格,故形状被摘掉时第一例就红)。
    """
    keys = _production_entry_keys()
    assert keys, '取不到生产条目键集 ⇒ 本尺失明,不得当"已通过'
    assert {'event', 'decision'} <= keys, f'生产条目缺判定用键,现读={sorted(keys)}'
    entry: dict[str, object] = {
        'event': asyncio.Event(),
        'decision': None,
        'scope': 'once',
        'reason': None,
        'argv': None,
        'tool_name': 'run_command',
        'net_fact': None,
        'tool_call_id': 'call-1',
        'args_preview': '{"argv":["ls"]}',
        'danger_level': 'medium',
        'owner_user_id': 'user-A',
        'created_at': '2026-10-19T00:00:00+00:00',
    }
    unknown = set(overrides) - keys
    assert not unknown, f'overrides 写了生产条目没有的键 {sorted(unknown)} ⇒ 夹具在自造形状'
    unvalued = keys - set(entry)
    assert not unvalued, f'生产条目新增键 {sorted(unvalued)} 而本夹具没给值 ⇒ 形状已漂,先补值再谈通过'
    entry = {k: entry[k] for k in keys}
    entry.update(overrides)
    return entry


def test_t1_生产条目形状必须覆盖取数侧的全部闸读字段() -> None:
    keys = _production_entry_keys()
    required = set(_REPLAY_FIELDS) | {'owner_user_id', 'event', 'decision'}
    missing = required - keys
    assert not missing, (
        f'生产条目缺 {sorted(missing)} ⇒ chat_pending_approval_replays 对现读面恒空,'
        'A 档"重放"仍是只有夹具能过的那把尺(D1047 diff① 未成立)'
    )


def test_t2_按生产形状造出的待决条目过双闸() -> None:
    payloads = chat_pending_approval_replays({'appr_1': _entry_from_production_keyset()}, 'user-A')
    assert len(payloads) == 1, '生产形状仍被判不重放 ⇒ 取数侧与生产面形状分叉'
    one = payloads[0]
    assert one['approval_id'] == 'appr_1'
    assert one['tool_call_id'] == 'call-1' and one['danger_level'] == 'medium'
    assert one['owner_user_id'] == 'user-A' and one['created_at'] == '2026-10-19T00:00:00+00:00'


def test_t3_属主不精确相等一律不重放() -> None:
    assert chat_pending_approval_replays({'a': _entry_from_production_keyset()}, 'user-B') == []
    assert chat_pending_approval_replays({'a': _entry_from_production_keyset()}, None) == []


def test_t4_已决或已唤醒不重放_二次弹窗即副作用() -> None:
    decided = _entry_from_production_keyset(decision='approve')
    assert chat_pending_approval_replays({'a': decided}, 'user-A') == []
    woken = _entry_from_production_keyset()
    woken['event'].set()  # type: ignore[union-attr]
    assert chat_pending_approval_replays({'a': woken}, 'user-A') == []


def test_t5_旧形态条目_摘掉任一格重放字段即回到惰性闸() -> None:
    for field in _REPLAY_FIELDS:
        assert chat_pending_approval_replays({'a': _entry_from_production_keyset(**{field: None})}, 'user-A') == []
    without_owner = {k: v for k, v in _entry_from_production_keyset().items() if k != 'owner_user_id'}
    assert chat_pending_approval_replays({'a': without_owner}, 'user-A') == []


def test_t6_现读生产面无人调用取数侧_接线格尚未落地() -> None:
    """装车状态的诚实登记:本笔只开闸,不接线 ⇒ 断言"没有生产调用点"。

    这一条是**会随 diff② 落地而翻红**的:届时必须连同本行注释一起改成"接线侧
    用例"(不允许只把断言删了凑绿 —— 删断言 = 削弱判据,AGENTS §12e)。
    """
    app_root = LLM_PY.parent.parent
    # 只认 import 语句:正文里提到模块名(如 llm.py 的注记)不构成调用点。
    import_re = re.compile(r'^\s*(?:from\s+\S*approval_replay\s+import|import\s+\S*approval_replay)', re.M)
    importers = [
        p.relative_to(app_root).as_posix() for p in app_root.rglob('*.py')
        if p.name != 'approval_replay.py' and import_re.search(p.read_text(encoding='utf-8', errors='ignore'))
    ]
    assert importers == [], f'取数侧已被 {importers} import,本登记的"零行为"结论需就地改写'
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
