# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-758(2026-10-03):不安全加载标记判据(`find_unsafe_loaded_marks`)的回归钉。

三层断言:
  ① 三种形态的正例各自必须被点名(finally 置真 / try-except 同块尾随或 except 体内
     置真 / 集合 add 记"已加载")—— 尺子先证明抓得住病,零命中才不作数(§22c);
  ② 反例(合法形态)不得误伤:成功路径固化、权威写入(reset)、测试注入、
     局部变量游标、非 loaded 集合;
  ③ **存量回归锁**:对 11 个真实模块的当前源码跑判据必须为 0 —— 新模块再写一遍
     `finally: self._loaded = True` 这类形态时,本条即红(此前的形状锁只在 pytest
     里且只认 `_loaded = True` 字面,集合 add 与尾随置真它结构上看不见)。
"""

from pathlib import Path

import pytest

from app.services._load_lifecycle import find_unsafe_loaded_marks

APP_SERVICES = Path(__file__).resolve().parent.parent / "app" / "services"

# ── ① 正例:三种形态 ──────────────────────────────────────────────

FINALLY_SHAPE = '''
class A:
    def _load(self):
        try:
            self._data = read()
        except Exception as e:
            logger.warning("x: %s", e)
        finally:
            self._loaded = True
'''

TAIL_SHAPE = '''
class B:
    def _load(self):
        try:
            self._data = read()
        except Exception as e:
            logger.warning("x: %s", e)
        self._loaded = True
'''

EXCEPT_BODY_SHAPE = '''
class C:
    def _load(self):
        try:
            self._data = read()
        except Exception:
            self._loaded = True
'''

SET_ADD_SHAPE = '''
class D:
    def _mark(self, user_id):
        self._loaded_users.add(user_id)
'''


@pytest.mark.parametrize(
    ("src", "kind"),
    [
        (FINALLY_SHAPE, "finally-set"),
        (TAIL_SHAPE, "tail-set"),
        (EXCEPT_BODY_SHAPE, "except-set"),
        (SET_ADD_SHAPE, "set-add"),
    ],
)
def test_positive_shapes_are_flagged(src: str, kind: str) -> None:
    marks = find_unsafe_loaded_marks(src)
    assert [m["kind"] for m in marks] == [kind], marks


# ── ② 反例:合法形态不得误伤 ────────────────────────────────────

AUTHORITATIVE_RESET = '''
class E:
    def reset(self):
        self._data = {}
        self._loaded = True
        self._persist()
'''

TUPLE_SUCCESS_FORM = '''
class F:
    def _load(self):
        try:
            self._data = read()
            self._loaded, self._load_failures, self._load_next_attempt_s = _state_after_success()
        except Exception as e:
            self._load_failures, self._load_next_attempt_s = _state_after_failure(
                self._load_failures, now
            )
            logger.warning("x: %s", e)
'''

LOCAL_CURSOR = '''
def handler():
    equivalents_loaded = not quota_hit
    while True:
        if equivalents_loaded:
            break
        equivalents_loaded = True
'''

UNRELATED_SET_ADD = '''
class G:
    def _mark(self, user_id):
        self._seen_users.add(user_id)
'''


@pytest.mark.parametrize(
    "src",
    [AUTHORITATIVE_RESET, TUPLE_SUCCESS_FORM, LOCAL_CURSOR, UNRELATED_SET_ADD],
)
def test_legitimate_shapes_are_not_flagged(src: str) -> None:
    assert find_unsafe_loaded_marks(src) == [], src


# ── ③ 存量回归锁:11 个已收口模块的真实源码必须 0 命中 ────────────

G758_FIXED_MODULES = [
    "agent_step_recorder.py",
    "audit_log.py",
    "agent_longterm_memory.py",
    "browser_trace.py",
    "cloud_run_store.py",
    "cost_ledger.py",
    "hook_engine.py",
    "publish/anti_risk/cookie_health.py",
    "publish/anti_risk/risk_scoring.py",
    "publish/anti_risk/device_graph_guard.py",
    "publish/anti_risk/cooldown_manager.py",
]


@pytest.mark.parametrize("rel", G758_FIXED_MODULES)
def test_fixed_modules_have_no_unsafe_marks(rel: str) -> None:
    src = (APP_SERVICES / rel).read_text(encoding="utf-8")
    marks = find_unsafe_loaded_marks(src)
    assert marks == [], f"{rel} 重新引入了不安全加载形态: {marks}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
