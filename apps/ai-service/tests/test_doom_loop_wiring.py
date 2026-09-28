# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""V3#54 —— 主链路接线源码锁(agent_loop_v2 真的用上了 doom_loop)。

为什么做源码级断言而不是跑整条 AgentLoopV2:
- 构造并驱动完整循环需要 LLM/DB 替身,受共享工作区并行会话影响大;
- "上提到主链路"的可回归契约就是那几条接线字面量(import / 构造 / 两个观测点 /
  三个动作分支),源码锁对它们的保护与端到端等价且零副作用。
真正的行为验证在 test_doom_loop.py(纯内存),跨语言等值验证在
scripts/check-doom-loop-parity.mjs。
"""

from __future__ import annotations

import re
from pathlib import Path

_LOOP_FILE = (
    Path(__file__).resolve().parents[1] / 'app' / 'services' / 'agent_loop_v2.py'
)


def _loop_source() -> str:
    text = _LOOP_FILE.read_text(encoding='utf-8')
    assert text, 'agent_loop_v2.py 读取为空 ⇒ 判据失效,不是"没有接线"'
    return text


def test_导入哨兵与阈值常量() -> None:
    src = _loop_source()
    assert re.search(r'from \.\.core\.doom_loop import', src), '主链路未 import doom_loop'
    assert 'DoomLoopSentinel' in src


def test_每次run重置哨兵() -> None:
    src = _loop_source()
    reset_body = src[src.index('def _reset_run_state'):]
    reset_body = reset_body[: reset_body.index('\n    def ', 10)]
    assert 'DoomLoopSentinel()' in reset_body, '_reset_run_state 未重建哨兵(跨 run 残留计数)'


def test_两个观测点都在主循环体内() -> None:
    src = _loop_source()
    assert '.observe_calls(' in src, '执行前观测点被摘线'
    assert '.observe_results(' in src, '结果侧观测点被摘线'


def test_三个策略动作都有分支() -> None:
    src = _loop_source()
    for action in ('terminate_loop', 'skip_tool_execution', 'inject_reflection'):
        assert f'"{action}" in doom_actions' in src, f'动作 {action} 无消费分支(装饰品)'


def test_终止动作真的return中带doom_loop元数据() -> None:
    src = _loop_source()
    assert '"doom loop detected' in src, '终止路径缺少可诊断的 doom loop 文案'
    assert 'error_type": "doom_loop"' in src, 'checkpoint 元数据未按 doom_loop 归类'


def test_主链路不得二次声明策略数字() -> None:
    src = _loop_source()
    for name in (
        'DOOM_LOOP_WINDOW_SIZE',
        'DOOM_LOOP_REPEAT_THRESHOLD',
        'STUCK_CONSECUTIVE_THRESHOLD',
        'FAILURE_STREAK_STRATEGY_THRESHOLD',
        'DOOM_ALERT_ROUNDS_TO_TERMINATE',
    ):
        assert not re.search(rf'^\s*{name}\s*=\s*\d', src, re.M), f'{name} 在 agent_loop_v2 被重新抄了一份'
