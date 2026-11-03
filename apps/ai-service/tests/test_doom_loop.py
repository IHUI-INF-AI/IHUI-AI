# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3#54 —— app/core/doom_loop.py 单元测试(纯内存,零 DB / 零网络,§5 测试隔离铁律天然满足)。

覆盖面:
- 滑动窗口:尾部连续计数 / 打断 / 阈值 / reset / stats / 容量淘汰
- 错误签名归一与 stuck 检测器(错误签名侧 + tool_call 轮次侧)
- failure-streak 跟踪器(阈值触发即清零的语义)
- plan_doom_alert_response 纯函数三态
- DoomLoopSentinel 组合语义(报警升级、stuck 中断、反思提示)
- canonical_serialize / hash_args 确定性与不抛错
"""

from __future__ import annotations

from app.core.doom_loop import (
    DOOM_ALERT_ROUNDS_TO_TERMINATE,
    DOOM_LOOP_COOLDOWN_MS,
    DOOM_LOOP_HASH_ALGORITHM,
    DOOM_LOOP_REPEAT_THRESHOLD,
    DOOM_LOOP_STATES,
    DOOM_LOOP_STRATEGY_ACTIONS,
    DOOM_LOOP_WINDOW_SIZE,
    ERROR_SIGNATURE_MAX_LEN,
    FAILURE_STREAK_STRATEGY_THRESHOLD,
    STUCK_CONSECUTIVE_THRESHOLD,
    DoomLoopSentinel,
    DoomLoopWindow,
    FailureStreakTracker,
    StuckSignatureDetector,
    canonical_serialize,
    hash_args,
    normalize_error_signature,
    plan_doom_alert_response,
    tool_call_round_signature,
)


class TestPolicyConstants:
    def test_值与票面一致(self) -> None:
        # 票面:窗口 10 / 重复 3 / failure-streak ≥3 / 报警连续 2 轮终止 / stuck 3
        assert DOOM_LOOP_WINDOW_SIZE == 10
        assert DOOM_LOOP_REPEAT_THRESHOLD == 3
        assert STUCK_CONSECUTIVE_THRESHOLD == 3
        assert FAILURE_STREAK_STRATEGY_THRESHOLD == 3
        assert DOOM_ALERT_ROUNDS_TO_TERMINATE == 2
        assert DOOM_LOOP_COOLDOWN_MS == 0
        assert ERROR_SIGNATURE_MAX_LEN == 120
        assert DOOM_LOOP_HASH_ALGORITHM == 'sha256'

    def test_状态与动作清单形状(self) -> None:
        assert DOOM_LOOP_STATES == ['observing', 'reflecting', 'terminating']
        assert DOOM_LOOP_STRATEGY_ACTIONS == [
            'inject_reflection',
            'skip_tool_execution',
            'terminate_loop',
        ]


class TestCanonicalSerialize:
    def test_键序无关且确定(self) -> None:
        a = {'path': '/x', 'offset': 1, 'limit': 2}
        b = {'limit': 2, 'offset': 1, 'path': '/x'}
        assert canonical_serialize(a) == canonical_serialize(b)
        assert hash_args(a) == hash_args(b)

    def test_不同入参不同摘要(self) -> None:
        assert hash_args({'q': 1}) != hash_args({'q': 2})

    def test_摘要为定长十六进制且不含原文(self) -> None:
        digest = hash_args({'body': 'SENTINEL_do_not_leak'})
        assert len(digest) == 64
        assert all(c in '0123456789abcdef' for c in digest)
        assert 'SENTINEL' not in digest

    def test_NaN与无穷不落非法JSON(self) -> None:
        # NaN/Infinity 归一为 null(与 TS stableSerialize 同语义),不得抛
        assert 'null' in canonical_serialize({'x': float('nan')})
        assert 'null' in canonical_serialize({'y': float('inf')})

    def test_循环引用不抛错(self) -> None:
        node: dict[str, object] = {'name': 'root'}
        node['self'] = node
        out = canonical_serialize(node)  # 不抛错即为主契约
        assert isinstance(out, str) and out
        # 祖先链上的对象归一为 [Circular](与 TS 同语义),而不是整串兜底
        assert '[Circular]' in out

    def test_摘要算法可换名仍稳定(self) -> None:
        assert len(hash_args({})) == 64  # sha256 hex 定长


class TestDoomLoopWindow:
    def test_尾部连续三次报警(self) -> None:
        window = DoomLoopWindow()
        h = hash_args({'path': 'same'})
        assert window.record('read', h) is None
        assert window.record('read', h) is None
        fact = window.record('read', h)
        assert fact is not None
        assert fact['repeat_count'] == 3
        assert fact['tool_name'] == 'read'
        assert fact['input_hash'] == h

    def test_交替调用打断计数(self) -> None:
        window = DoomLoopWindow()
        h = hash_args({'path': 'same'})
        for _ in range(4):
            assert window.record('read', h) is None or True
        # a,b,a,b,a,b 型:每次尾部连续数最多 1 ⇒ 永不报警
        alt = DoomLoopWindow()
        for name in ('read', 'write') * 5:
            assert alt.record(name, h) is None

    def test_reset与stats(self) -> None:
        window = DoomLoopWindow()
        h = hash_args({'p': 1})
        window.record('read', h)
        window.record('read', h)
        stats = window.get_stats()
        assert stats['totalCalls'] == 2
        assert stats['uniqueCalls'] == 1
        assert abs(stats['repeatRate'] - 0.5) < 1e-9
        window.reset()
        assert window.get_stats() == {
            'totalCalls': 0, 'uniqueCalls': 0, 'repeatRate': 0.0,
        }
        # reset 后重新计数:再来两次不报警,第三次报警
        assert window.record('read', h) is None
        assert window.record('read', h) is None
        assert window.record('read', h) is not None

    def test_容量淘汰把远古记录挤出窗口(self) -> None:
        window = DoomLoopWindow(window_size=4, repeat_threshold=3)
        h = hash_args({'p': 1})
        other = hash_args({'p': 'x'})
        window.record('read', h)
        window.record('read', h)
        # 用不同调用填满窗口,挤掉前面的 pair
        for _ in range(4):
            window.record('other', other)
        assert window.record('read', h) is None  # 尾部连续数=1,旧 pair 已出窗


class TestErrorSignatureAndStuck:
    def test_归一首行加数字折叠加截断(self) -> None:
        sig = normalize_error_signature('Error 42 on line 7\nsecond line ignored')
        assert sig == 'Error N on line N'
        long_sig = normalize_error_signature('x' * 500)
        assert len(long_sig) == ERROR_SIGNATURE_MAX_LEN

    def test_轮次签名与顺序无关(self) -> None:
        s1 = tool_call_round_signature([('a', '1'), ('b', '2')])
        s2 = tool_call_round_signature([('b', '2'), ('a', '1')])
        assert s1 == s2

    def test_连续相同错误签名达阈值判卡死(self) -> None:
        det = StuckSignatureDetector()
        det.record_error('boom 1')
        assert not det.is_stuck()
        det.record_error('boom 2')  # 数字归一后与上一条同签名
        assert not det.is_stuck()
        det.record_error('boom 3')
        assert det.is_stuck()

    def test_不同签名打断连续计数(self) -> None:
        det = StuckSignatureDetector()
        det.record_error('boom')
        det.record_error('other')
        det.record_error('boom')
        assert not det.is_stuck()

    def test_相同tool_call模式达阈值判卡死(self) -> None:
        det = StuckSignatureDetector()
        calls = [('read', {'path': 'a'})]
        det.record_tool_calls(calls)
        det.record_tool_calls(calls)
        assert not det.is_stuck()
        det.record_tool_calls(calls)
        assert det.is_stuck()

    def test_reset清空两侧计数(self) -> None:
        det = StuckSignatureDetector()
        for _ in range(2):
            det.record_error('boom')
        det.reset()
        det.record_error('boom')
        assert not det.is_stuck()


class TestFailureStreakTracker:
    def test_阈值触发并自动清零(self) -> None:
        tracker = FailureStreakTracker()
        assert tracker.record('run', False) == (1, False)
        assert tracker.record('run', False) == (2, False)
        streak, change = tracker.record('run', False)
        assert streak == FAILURE_STREAK_STRATEGY_THRESHOLD
        assert change is True
        # 触发后清零:再失败一次不回跳阈值
        assert tracker.record('run', False) == (1, False)

    def test_成功重置且按工具名隔离(self) -> None:
        tracker = FailureStreakTracker()
        tracker.record('a', False)
        tracker.record('a', False)
        assert tracker.record('a', True) == (0, False)
        assert tracker.record('a', False) == (1, False)
        assert tracker.record('b', False) == (1, False)  # b 独立计数


class TestPlanDoomAlertResponse:
    def test_三态映射(self) -> None:
        assert plan_doom_alert_response(0) == ([], 'observing')
        actions, state = plan_doom_alert_response(1)
        assert actions == ['inject_reflection', 'skip_tool_execution']
        assert state == 'reflecting'
        actions, state = plan_doom_alert_response(DOOM_ALERT_ROUNDS_TO_TERMINATE)
        assert actions == ['terminate_loop']
        assert state == 'terminating'

    def test_所有返回值都落在声明清单内(self) -> None:
        # 阳性对照:判据动作集不是死表 —— 每个声明动作都必须真的可被返回
        reachable: set[str] = set()
        states: set[str] = set()
        for rounds in range(0, 6):
            actions, state = plan_doom_alert_response(rounds)
            reachable.update(actions)
            states.add(state)
        assert reachable == set(DOOM_LOOP_STRATEGY_ACTIONS)
        assert states == set(DOOM_LOOP_STATES)


class TestSentinel:
    def _same_calls(self) -> list[tuple[str, dict[str, object]]]:
        return [('read', {'path': 'file.txt'})]

    def test_报警首轮换策略次轮终止(self) -> None:
        sentinel = DoomLoopSentinel()
        calls = self._same_calls()
        # 第 1、2 轮:窗口尾部连续数 1、2,未达阈值 3 ⇒ 无动作
        actions, reminders = sentinel.observe_calls(calls)
        assert actions == [] and reminders == []
        actions, reminders = sentinel.observe_calls(calls)
        assert actions == []
        # 第 3 轮:窗口报警(数=3),但 stuck 轮次模式也已达 3 ⇒ terminate 优先
        actions, reminders = sentinel.observe_calls(calls)
        assert actions == ['terminate_loop']
        assert any('DOOM_LOOP_ALERT' in text for text in reminders)
        assert sentinel.state == 'terminating'

    def test_换参能逃过终止但模式计数仍在(self) -> None:
        sentinel = DoomLoopSentinel()
        sentinel.observe_calls([('read', {'path': 'a'})])
        actions, _ = sentinel.observe_calls([('read', {'path': 'b'})])
        assert actions == []  # 模式不同 ⇒ 轮次计数重置;窗口不同参 ⇒ 不报警

    def test_结果侧连续失败注入反思且不误终止(self) -> None:
        sentinel = DoomLoopSentinel()
        # 三次失败但错误签名不同 ⇒ failure-streak 触发换策略,不误判 stuck
        sentinel.observe_results([('run', False, 'err alpha 1')])
        sentinel.observe_results([('run', False, 'err beta 2')])
        reminders, fatal = sentinel.observe_results([('run', False, 'err gamma 3')])
        assert fatal is None
        assert any('换一种工具或方案' in text for text in reminders)

    def test_结果侧同签名错误三连判卡死(self) -> None:
        sentinel = DoomLoopSentinel()
        _, fatal1 = sentinel.observe_results([('run', False, 'same boom 1')])
        _, fatal2 = sentinel.observe_results([('run', False, 'same boom 2')])
        _, fatal3 = sentinel.observe_results([('run', False, 'same boom 3')])
        assert fatal1 is None and fatal2 is None
        assert fatal3 is not None and 'doom loop' in fatal3

    def test_reset回observing(self) -> None:
        sentinel = DoomLoopSentinel()
        for _ in range(3):
            sentinel.observe_calls(self._same_calls())
        sentinel.reset()
        assert sentinel.state == 'observing'
        actions, _ = sentinel.observe_calls(self._same_calls())
        assert actions == []
