# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""自愈用例改为子进程隔离执行(2026-10-31 立)。

现读缺陷:`StaticRunner` 在主进程里 `exec/eval` 由 LLM 生成的 setup/assertion。
`while True:` 会永久占住线程池里的一根线程;`SystemExit` 这类 BaseException 直接掀掉工作线程;
两者都不是"测试失败",是服务端被输入拖死。

钉五档:
  ① 契约不变:通过 / falsy / setup 抛错 / assertion 抛错 四型仍映射成原来的
     passed/failures 形状与文案前缀(下游 classify_failure 的归因依赖它们);
  ② 死循环:超时后抛 SandboxUnavailable,且**本测试进程仍然活着**(隔离的真正意义);
  ③ SystemExit 打不到宿主:子进程内 raise SystemExit(3) 只作为一条失败记录回来;
  ④ 执行器不可用 ⇒ run_and_diagnose 落 runner_error(全红),
     并且**没有发生进程内执行**(副作用标记文件不存在)—— 这是"绝不回落裸跑"的行为证。
  ⑤ 反向对照:同一份 setup 在"有执行器"时确实会写文件 ⇒ ④里那个"文件不存在"
     不是因为用例本身不写,而是因为没在宿主里执行。
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

from app.services.self_healing import StaticRunner, TestCase, run_and_diagnose
from app.services.self_healing_sandbox import SandboxUnavailable, run_cases_isolated


def _cases() -> list[TestCase]:
    return [
        TestCase(id="c1", description="pass", setup="x = 1", assertion="x == 1"),
        TestCase(id="c2", description="falsy", setup="x = 2", assertion="x == 1"),
        TestCase(id="c3", description="setup boom", setup="raise ValueError('setup bad')",
                 assertion="True"),
        TestCase(id="c4", description="assert boom", setup="x = 3",
                 assertion="x.nonexistent()"),
    ]


def test_01_contract_preserved() -> None:
    out = StaticRunner().run(_cases())

    assert out["passed"] == ["c1"]
    failures = {f["test_id"]: f for f in out["failures"]}
    assert failures["c2"]["message"] == "assertion returned a falsy value"
    assert failures["c2"]["exception_type"] == "AssertionError"
    assert failures["c3"]["message"].startswith("setup error:")
    assert failures["c3"]["exception_type"] == "ValueError"
    assert failures["c4"]["message"].startswith("assertion error:")
    assert failures["c4"]["exception_type"] == "AttributeError"


def test_02_infinite_loop_times_out_and_host_survives() -> None:
    started = time.monotonic()
    with pytest.raises(SandboxUnavailable) as ei:
        run_cases_isolated([{"id": "c1", "setup": "while True:\n    pass", "assertion": "1"}],
                           timeout_s=1.5)
    elapsed = time.monotonic() - started

    assert "超时" in str(ei.value)
    assert elapsed < 30, f"超时没有生效,耗时 {elapsed:.1f}s"
    # 本测试进程当然还活着(能跑到这里就是证据);再断言一次解释器完好
    assert sys.executable


def test_03_system_exit_cannot_reach_host() -> None:
    out = run_cases_isolated(
        [{"id": "sd", "setup": "raise SystemExit(3)", "assertion": "True"}], timeout_s=10
    )

    assert len(out) == 1
    assert out[0]["errorType"] == "SystemExit"
    assert out[0]["ok"] is False


def test_04_executor_unavailable_degrades_and_never_runs_in_process(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    marker = "should_not_exist.txt"

    def _boom(_cases_, _timeout):  # noqa: ANN001, ANN202
        raise SandboxUnavailable("executor down")

    result = run_and_diagnose(
        [{"id": "c1", "description": "d", "setup": f"open({marker!r},'w').write('x')",
          "assertion": "1 == 1"}],
        runner=StaticRunner(executor=_boom),
    )

    categories = [f.category for f in result.failures]
    assert categories == ["runner_error"]
    assert not (tmp_path / marker).exists(), "执行器不可用时仍发生了进程内执行"


def test_05_control_same_setup_does_execute_when_executor_works(tmp_path: Path,
                                                                monkeypatch: pytest.MonkeyPatch) -> None:
    """反向对照:同一个 setup 在正常执行器下确实会写文件 ⇒ 04 的"不存在"不是假阴性。"""
    monkeypatch.chdir(tmp_path)
    marker = "marker.txt"

    out = StaticRunner().run(
        [TestCase(id="c1", description="d",
                  setup=f"open({marker!r},'w',encoding='utf-8').write('x')",
                  assertion="True")]
    )

    assert out["passed"] == ["c1"]
    assert (tmp_path / marker).exists()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
