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

import ast
import asyncio
import re
from pathlib import Path
from typing import NamedTuple

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


def test_t6_接线格已落地_取数侧唯一生产调用点是llm() -> None:
    """D690(方案 A,2026-10-22)落地登记:取数侧被 routers/llm.py 接线。

    本条原为 diff① 的"零行为"登记锁(断言无生产调用点,票面写明会随 diff②
    落地翻红、届时须就地改成本形态 —— 已按指示改写,不是删断言凑绿)。
    现在钉的是**接线不旁落**:生产面 import 取数侧的文件恰好只有 routers/llm.py
    一处;换面、消失或扩散都判红(取数侧判据本身不许被绕过第二份实现另起炉灶)。
    """
    app_root = LLM_PY.parent.parent
    # 只认 import 语句:正文里提到模块名(如 llm.py 的注记)不构成调用点。
    import_re = re.compile(r'^\s*(?:from\s+\S*approval_replay\s+import|import\s+\S*approval_replay)', re.M)
    importers = [
        p.relative_to(app_root).as_posix() for p in app_root.rglob('*.py')
        if p.name != 'approval_replay.py' and import_re.search(p.read_text(encoding='utf-8', errors='ignore'))
    ]
    assert importers == ['routers/llm.py'], (
        f'取数侧的生产接线面应为唯一一处 routers/llm.py(D690 接线),现读 {importers}'
    )


# ── T7-T9:重放取数侧的**可达性**(量"接了线能不能有对象",不是量"有没有接线") ────
#
# 立项理由:D1047 diff② 的票面口径 A 写的是"服务端在重连时重放仍待决的条目",而
# 取数侧 chat_pending_approval_replays 的输入是 `_approval_sessions[session_id]`。
# 这一格此前无人量过"重连那一刻那张表里还有没有条目" —— 只量过"条目形状对不对"(T1)。
# 形状全对而输入集恒空,接线就是一条永不触发的分支(AGENTS §0.9/§0.3:不得把没判写成判过,
# 也不得用"代码在+用例绿"冒充"生产读面收得到")。
# 判据必须是**源码形状**而非印象:两条腿的差别恰好藏在"等待住在哪儿"。

AGENT_LOOP_PY = Path(__file__).resolve().parents[1] / 'app' / 'services' / 'agent_loop_v2.py'
AGENTS_PY = Path(__file__).resolve().parents[1] / 'app' / 'routers' / 'agents.py'

_CHAT_WRITE_ANCHOR = '_approval_sessions.setdefault(session_id, {})[_approval_id] = {'
_CHAT_TABLE = '_approval_sessions'
_TASK_WRITE_ANCHOR = '_approval_registry[approval_id] = _ApprovalEntry('
_TASK_TABLE = '_approval_registry'


class _EntryReachability(NamedTuple):
    """一条待决审批条目"断线之后还在不在表里"的四格读数。"""

    holder: str
    holder_is_stream_gen: bool
    pop_gated_on_frame_yield: bool
    survives_disconnect: bool


def _own_yield_count(node: ast.AST) -> int:
    """本函数体内**直接**出现的 yield/yield from 处数(遇嵌套 def/lambda 不下钻)。

    不下钻是判据的牙:"生成器里顺手定义一个普通工具方法"若也算进去,任何流函数都会被
    读成"等待由连接驱动",这把尺就恒真了。
    """
    count = 0
    stack: list[ast.AST] = list(ast.iter_child_nodes(node))
    while stack:
        cur = stack.pop()
        if isinstance(cur, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            continue
        if isinstance(cur, (ast.Yield, ast.YieldFrom)):
            count += 1
        stack.extend(ast.iter_child_nodes(cur))
    return count


def _enclosing_func(tree: ast.AST, line: int) -> ast.FunctionDef | ast.AsyncFunctionDef:
    """取包住第 line 行的**最内层**函数(跨度最小者)。"""
    cands = [
        n
        for n in ast.walk(tree)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
        and n.lineno <= line <= (n.end_lineno or n.lineno)
    ]
    if not cands:
        raise AssertionError(f'第 {line} 行不在任何函数体内 ⇒ 本尺失明,不得当"判过"')
    best: ast.FunctionDef | ast.AsyncFunctionDef = min(
        cands, key=lambda n: (n.end_lineno or n.lineno) - n.lineno
    )
    return best


def approval_entry_reachability(src: str, *, write_anchor: str, table: str) -> _EntryReachability:
    """按源码形状量:这条待决条目在客户端断线后是否仍留在待决表里。

    两格合成一个结论:
    ① holder_is_stream_gen —— 写入点所在最内层函数,自己就是"靠被迭代才往下走"的
       异步生成器(本体直接含 yield);
    ② pop_gated_on_frame_yield —— 摘条目的 `finally` 与"等人工应答"住在同一段 try,
       且该 try 的 body 里就有 yield。
    两格同时成立 ⇒ 连接一断,GeneratorExit 必从 body 里那个 yield 抛入、当场走完
    finally 摘掉条目 ⇒ 重连时刻表里没有它(survives_disconnect=False)。
    反之等待住在普通协程里(由后台 task 承载),断线不经过它的 yield ⇒ 条目存续。
    """
    lines = src.splitlines()
    hit = next((i + 1 for i, ln in enumerate(lines) if write_anchor in ln), None)
    if hit is None:
        raise AssertionError(f'写入锚点 {write_anchor!r} 取不到 ⇒ 本尺失明,不得当"没有"处理')
    tree = ast.parse(src)
    holder = _enclosing_func(tree, hit)

    is_stream_gen = isinstance(holder, ast.AsyncFunctionDef) and _own_yield_count(holder) > 0

    gated = False
    for node in ast.walk(holder):
        if not isinstance(node, ast.Try):
            continue
        fin = ' '.join(ast.unparse(s) for s in node.finalbody)
        if table not in fin or 'pop(' not in fin:
            continue
        body = ast.Module(body=node.body, type_ignores=[])
        has_wait = '.wait()' in ' '.join(ast.unparse(s) for s in node.body)
        has_yield = any(isinstance(n, (ast.Yield, ast.YieldFrom)) for n in ast.walk(body))
        if has_wait and has_yield:
            gated = True
            break

    return _EntryReachability(
        holder=holder.name,
        holder_is_stream_gen=is_stream_gen,
        pop_gated_on_frame_yield=gated,
        survives_disconnect=not (is_stream_gen and gated),
    )


def test_t7_主对话腿的待决条目在断线时刻即被摘除_取数侧对重连恒空() -> None:
    """diff② 的承重结论:主对话腿**接了线也不会有对象**,除非先改条目生命周期。

    D690 落地注记(2026-10-22,断言一字未动):diff② 接线已落,取数对象恰是
    **本形状还没摘条目的窗口** —— 干净取消路径(GeneratorExit 从吐帧点抛入)按本尺
    判"不存续"⇒ 条目已被摘 ⇒ 不重放(无活等待者、答复不可兑现,重放即空头支票);
    半开连接窗口(写失败尚未被察觉、等待者仍活)条目在表 ⇒ 重放有对象且可兑现。
    生命周期形状不改正是这个设计的承重件:摘除本身就是"可兑现性"的 fail-closed 闸。
    """
    got = approval_entry_reachability(
        LLM_PY.read_text(encoding='utf-8'), write_anchor=_CHAT_WRITE_ANCHOR, table=_CHAT_TABLE
    )
    assert got.holder_is_stream_gen, f'主对话腿的等待已搬出流生成器({got.holder})⇒ 本结论须就地改写'
    assert got.pop_gated_on_frame_yield, f'摘条目不再与吐帧同 try({got.holder})⇒ 本结论须就地改写'
    assert got.survives_disconnect is False, (
        '条目不再随断线消失 ⇒ A 档"重连时重放"第一次有了取数对象,'
        '须连同 T6 与 test_d131 的否证锁一起重裁,不得只把本断言改了凑绿'
    )


def test_t8_对照_task_流腿的条目跨断线存续_差别只在等待住在哪儿() -> None:
    """成对对照:同一条尺子必须**放过**agents 腿,否则 T7 只是"什么都没判出来"。

    任务流腿的等待住在引擎协程 `_request_approval`(本体 0 处 yield),run 由后台
    `asyncio.create_task` 承载 ⇒ 断线不经过它的挂起点 ⇒ 条目仍在表里,那半边已交付
    的重放是真出口,不是夹具造出来的绿。
    """
    got = approval_entry_reachability(
        AGENT_LOOP_PY.read_text(encoding='utf-8'),
        write_anchor=_TASK_WRITE_ANCHOR,
        table=_TASK_TABLE,
    )
    assert got.holder == '_request_approval', f'承载函数换了名字,先确认生命周期再谈通过: {got}'
    assert got.holder_is_stream_gen is False, f'任务流等待被改写进流生成器 ⇒ 那半边重放也要重新取证: {got}'
    assert got.survives_disconnect is True, f'对照臂必须判"存续",实得 {got}'

    agents_src = AGENTS_PY.read_text(encoding='utf-8')
    assert 'asyncio.create_task(' in agents_src, (
        'agents.py 不再用后台 task 承载 run ⇒ 任务流条目也会随连接一起消失,'
        '已交付的重放半边须重新取证(与本例同一条尺子)'
    )


def test_t9_反证夹具_同一把尺子在两型上判得出两种结论() -> None:
    """尺子有牙的证明:恒真的尺子等于没有尺子(§22c:判据必须能命中它要防的形态)。"""
    in_stream = '''
async def gen():
    reg["a"] = Entry()
    try:
        yield frame()
        await ev.wait()
    finally:
        reg.pop("a", None)
'''
    out_of_band = '''
async def _request_approval():
    reg["a"] = Entry()
    try:
        await ev.wait()
    finally:
        reg.pop("a", None)
'''
    nested_yield_does_not_count = '''
async def gen():
    reg["a"] = Entry()

    def helper():
        yield 1

    try:
        await ev.wait()
    finally:
        reg.pop("a", None)
'''
    a = approval_entry_reachability(in_stream, write_anchor='reg["a"] = Entry(', table='reg')
    b = approval_entry_reachability(out_of_band, write_anchor='reg["a"] = Entry(', table='reg')
    c = approval_entry_reachability(nested_yield_does_not_count, write_anchor='reg["a"] = Entry(', table='reg')

    assert (a.holder_is_stream_gen, a.pop_gated_on_frame_yield, a.survives_disconnect) == (
        True,
        True,
        False,
    ), f'夹具"等待住在吐帧生成器里"必须判不存续,实得 {a}'
    assert (b.holder_is_stream_gen, b.pop_gated_on_frame_yield, b.survives_disconnect) == (
        False,
        False,
        True,
    ), f'夹具"等待住在普通协程里"必须判存续,实得 {b}'
    assert c.holder_is_stream_gen is False, (
        f'嵌套函数里的 yield 不得算成"本函数靠迭代才往下走",实得 {c} ⇒ 尺子会恒真'
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
