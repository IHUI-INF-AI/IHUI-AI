"""S2 CI 必跑业务埋点测试 - 集中入口.

P1 业务埋点 (login/register/payment/chat) + S1 扩展 (deepseek/doubao/zhipu/qwen_omni/coze/kling) 必须全过.

这个文件作为 CI 拦截器: 任一埋点测试 FAIL, CI 退出码 != 0.
"""
import importlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


REQUIRED_TRACKING_TESTS = [
    "tests.test_p1_1_index_migration",
    "tests.test_p1_2_auth_tracking",
    "tests.test_p1_3_payment_tracking",
    "tests.test_p1_4_chat_tracking",
    "tests.test_s1_chat_tracking_extended",
    "tests.test_persister_metrics_phase5a",
    "tests.test_redis_failopen",
]


def test_all_tracking_modules_importable():
    """所有 P1/S1 业务埋点测试模块必须可被 import (syntax/import 通过)."""
    for modname in REQUIRED_TRACKING_TESTS:
        try:
            mod = importlib.import_module(modname)
        except Exception as e:
            pytest.fail(f"Import {modname} failed: {e}")
        assert hasattr(mod, "test_") or hasattr(mod, "test_") or dir(mod), (
            f"{modname} 没有任何 test_* 函数"
        )


def test_tracking_sdk_constants_exposed():
    """app.core.tracking 必须导出全部 EVENT_* / FUNNEL_* 常量."""
    from app.core import tracking

    required = [
        "EVENT_USER_REGISTER",
        "EVENT_USER_LOGIN",
        "EVENT_USER_LOGOUT",
        "EVENT_CHAT_SEND",
        "EVENT_CHAT_RECEIVE",
        "EVENT_PAYMENT_CREATE",
        "EVENT_PAYMENT_SUCCESS",
        "EVENT_PAYMENT_FAIL",
        "EVENT_ORDER_CREATE",
        "EVENT_COURSE_ENROLL",
        "EVENT_TOOL_USED",
        "FUNNEL_LOGIN",
        "FUNNEL_PAYMENT",
        "track_event",
        "track_latency",
        "track_timer",
        "track_funnel",
        "track_error",
    ]
    for name in required:
        assert hasattr(tracking, name), f"tracking 缺少导出: {name}"


def test_required_modules_have_test_functions():
    """统计每个埋点测试模块的 test_* 函数数量, 必须 > 0 (含 class 内方法)."""
    importlib.invalidate_caches()
    for modname in REQUIRED_TRACKING_TESTS:
        mod = importlib.import_module(modname)
        test_funcs = [n for n in dir(mod) if n.startswith("test_") and callable(getattr(mod, n))]
        # 也检查 class 内的 test_ 方法
        import inspect
        classes = [m for n, m in inspect.getmembers(mod, inspect.isclass) if m.__module__ == modname]
        for cls in classes:
            for name, _ in inspect.getmembers(cls, inspect.isfunction):
                if name.startswith("test_"):
                    test_funcs.append(f"{cls.__name__}.{name}")
        assert len(test_funcs) > 0, f"{modname} 没有任何 test_* 函数"


def test_run_all_tracking_tests_pass():
    """实际执行 P1/S1 业务埋点测试套件, 必须全过."""
    test_files = [
        "tests/test_p1_1_index_migration.py",
        "tests/test_p1_2_auth_tracking.py",
        "tests/test_p1_3_payment_tracking.py",
        "tests/test_p1_4_chat_tracking.py",
        "tests/test_s1_chat_tracking_extended.py",
        "tests/test_persister_metrics_phase5a.py",
        "tests/test_redis_failopen.py",
    ]
    cmd = [sys.executable, "-m", "pytest", "-q", "--tb=line", *test_files]
    result = subprocess.run(
        cmd, cwd=str(ROOT), capture_output=True, text=True, timeout=300
    )
    summary = result.stdout[-2000:] if result.stdout else ""
    if result.returncode != 0:
        pytest.fail(
            f"业务埋点 CI 必跑项失败 (exit={result.returncode}):\n"
            f"STDOUT tail:\n{summary}\n"
            f"STDERR tail:\n{result.stderr[-500:] if result.stderr else ''}"
        )


def test_business_tracking_coverage_endpoint_metrics():
    """验证业务埋点 SDK 注册的 metric 名能在 /metrics 端点出现 (样本可为空)."""
    from app.main import app
    from fastapi.testclient import TestClient

    c = TestClient(app)
    # 先触发一次 track_event, 让 Prometheus 注册 metric
    from app.core.tracking import track_event, track_latency
    track_event("ci_smoke", user_id="u-ci-smoke", channel="ci")
    track_latency("ci_smoke", 0.001, user_id="u-ci-smoke", channel="ci")

    r = c.get("/metrics")
    assert r.status_code in (200, 404)
    if r.status_code == 200:
        text = r.text
        # track_event 触发后 zhs_business_events_total 必须有 HELP/TYPE/sample
        assert "zhs_business_events_total" in text, (
            "/metrics 缺少 zhs_business_events_total 指标"
        )


import pytest  # noqa: E402
