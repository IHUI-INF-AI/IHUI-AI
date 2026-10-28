# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/turn_timing.py + rollout_budget.py + exec_env.py +
# command_canonicalization.py 第二十六批测试(对标 Codex
# turn_timing_tests.rs / rollout_budget / shell_environment_tests.rs /
# command_canonicalization_tests.rs)。

import threading
import time

import pytest

from app.core.command_canonicalization import (
    CANONICAL_BASH_SCRIPT_PREFIX,
    CANONICAL_POWERSHELL_SCRIPT_PREFIX,
    canonicalize_command_for_approval,
    parse_shell_lc_plain_commands,
)
from app.core.exec_env import (
    CODEX_SESSION_ID_ENV_VAR,
    CODEX_THREAD_ID_ENV_VAR,
    NON_INHERITABLE_ENV_VARS,
    EnvironmentVariablePattern,
    ShellEnvironmentPolicy,
    ShellEnvironmentPolicyInherit,
    create_env_from_vars,
    inject_session_env,
    is_non_inheritable_env_var,
    populate_env,
    scrub_non_inheritable_env_vars,
)
from app.core.rollout_budget import (
    RolloutBudget,
    RolloutBudgetConfig,
    RolloutBudgetError,
    _non_cached_input,
)
from app.core.turn_timing import (
    TurnTimingState,
    records_turn_ttft_for_message_item,
)


# ======================================================================
# turn_timing
# ======================================================================
class TestTurnTimingBasics:
    def test_mark_turn_started_returns_unix_ms(self):
        t = TurnTimingState()
        ms = t.mark_turn_started()
        assert abs(ms - int(time.time() * 1000)) < 2000
        assert t.started_at_unix_secs() is not None

    def test_ttft_first_write_wins(self):
        t = TurnTimingState()
        t.mark_turn_started()
        first = t.record_turn_ttft()
        time.sleep(0.01)
        second = t.record_turn_ttft()
        assert first is not None and second is None
        assert t.time_to_first_token_ms() == first

    def test_ttfm_independent_of_ttft(self):
        t = TurnTimingState()
        t.mark_turn_started()
        assert t.record_turn_ttfm() is not None
        assert t.record_turn_ttfm() is None
        assert t.time_to_first_token_ms() is None

    def test_without_start_all_none(self):
        t = TurnTimingState()
        assert t.record_turn_ttft() is None
        assert t.record_turn_ttfm() is None
        assert t.complete_profile_and_duration_ms()[1] is None

    def test_item_started_take(self):
        t = TurnTimingState()
        t.mark_turn_started()
        ms = t.record_item_started("item-1", 12345)
        assert ms == 12345
        # 重复记录保留首个(or_insert 语义)
        assert t.record_item_started("item-1", 99999) == 12345
        assert t.take_item_started("item-1") == 12345
        assert t.take_item_started("item-1") is None


class TestTurnProfile:
    def test_empty_profile_buckets_sum_to_total(self):
        t = TurnTimingState()
        t.mark_turn_started()
        time.sleep(0.01)
        _, duration_ms, profile = t.complete_profile_and_duration_ms()
        assert profile.sampling_request_count == 0
        assert profile.before_first_sampling_ms > 0
        assert profile.total_classified_ms() <= duration_ms + 5

    def test_sampling_and_tool_blocking_accumulate(self):
        t = TurnTimingState()
        t.mark_turn_started()
        with t.begin_sampling():
            time.sleep(0.02)
        with t.begin_tool_blocking():
            time.sleep(0.02)
        profile = t.complete_profile()
        assert profile.sampling_ms >= 15
        assert profile.tool_blocking_ms >= 15
        assert profile.sampling_request_count == 1

    def test_between_sampling_overhead(self):
        t = TurnTimingState()
        t.mark_turn_started()
        with t.begin_sampling():
            pass
        time.sleep(0.02)  # 采样间隙空闲
        with t.begin_sampling():
            pass
        profile = t.complete_profile()
        assert profile.sampling_request_count == 2
        assert profile.between_sampling_overhead_ms >= 15

    def test_after_last_sampling(self):
        t = TurnTimingState()
        t.mark_turn_started()
        with t.begin_sampling():
            pass
        time.sleep(0.02)
        profile = t.complete_profile()
        assert profile.after_last_sampling_ms >= 15

    def test_nested_or_overlapping_phase_rejected(self):
        t = TurnTimingState()
        t.mark_turn_started()
        with t.begin_sampling() as g1:
            assert g1.active
            g2 = t.begin_compaction()
            assert not g2.active  # 已有活动相位 → 拒绝
            g2.__exit__(None, None, None)  # inactive 守卫退出无副作用
        profile = t.complete_profile()
        assert profile.sampling_ms >= 0
        assert profile.compaction_ms == 0

    def test_complete_is_idempotent(self):
        t = TurnTimingState()
        t.mark_turn_started()
        with t.begin_sampling():
            pass
        p1 = t.complete_profile()
        with t.begin_sampling() as g:
            assert not g.active  # 完成后不再接受新相位
        p2 = t.complete_profile()
        assert p1 is p2

    def test_retry_count(self):
        t = TurnTimingState()
        t.mark_turn_started()
        t.record_sampling_retry()
        t.record_sampling_retry()
        t.complete_profile()
        t.record_sampling_retry()  # 完成后 no-op
        assert t.complete_profile().sampling_retry_count == 2

    def test_concurrent_writes_thread_safe(self):
        t = TurnTimingState()
        t.mark_turn_started()
        errors = []

        def worker():
            try:
                for _ in range(200):
                    t.record_item_started(f"i-{threading.get_ident()}")
                    t.record_turn_ttfm()
            except Exception as e:  # noqa: BLE001
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(8)]
        for th in threads:
            th.start()
        for th in threads:
            th.join()
        assert not errors
        assert t.time_to_first_message_ms() is not None


def test_ttft_message_item_predicate():
    assert records_turn_ttft_for_message_item("hello")
    assert not records_turn_ttft_for_message_item("")
    assert not records_turn_ttft_for_message_item(None)


# ======================================================================
# rollout_budget
# ======================================================================
class TestRolloutBudget:
    def test_configure_is_once(self):
        b = RolloutBudget()
        b.configure(RolloutBudgetConfig(limit_tokens=1000))
        b.configure(RolloutBudgetConfig(limit_tokens=999999))  # 忽略
        b.record_usage({"output_tokens": 1500})
        assert b.weighted_tokens_used() >= 1000

    def test_unconfigured_noop(self):
        b = RolloutBudget()
        assert b.record_usage({"output_tokens": 10}) is False
        assert b.pending_reminder("t", "w") is None
        assert b.weighted_tokens_used() == 0.0

    def test_weighted_units(self):
        b = RolloutBudget()
        b.configure(
            RolloutBudgetConfig(limit_tokens=100, sampling_token_weight=2.0, prefill_token_weight=0.5)
        )
        exhausted = b.record_usage(
            {"output_tokens": 30, "input_tokens": 60, "cached_input_tokens": 20}
        )
        # 30*2.0 + (60-20)*0.5 = 60 + 20 = 80 < 100
        assert exhausted is False
        exhausted = b.record_usage({"output_tokens": 15, "input_tokens": 0})
        # +30 → 110 ≥ 100
        assert exhausted is True
        assert b.record_usage({"output_tokens": 0}) is True  # 恒真

    def test_custom_budget_units_field(self):
        b = RolloutBudget()
        b.configure(RolloutBudgetConfig(limit_tokens=50))
        assert b.record_usage({"codex_rollout_budget_units": 49.9}) is False
        assert b.record_usage({"codex_rollout_budget_units": 0.2}) is True

    def test_invalid_budget_units_fatal(self):
        b = RolloutBudget()
        b.configure(RolloutBudgetConfig(limit_tokens=100))
        with pytest.raises(RolloutBudgetError):
            b.record_usage({"codex_rollout_budget_units": -1})
        with pytest.raises(RolloutBudgetError):
            b.record_usage({"codex_rollout_budget_units": float("nan")})

    def test_invalid_config_rejected(self):
        with pytest.raises(RolloutBudgetError):
            RolloutBudgetConfig(limit_tokens=0)
        with pytest.raises(RolloutBudgetError):
            RolloutBudgetConfig(limit_tokens=10, sampling_token_weight=-1)

    def test_reminder_threshold_levels_and_dedup(self):
        b = RolloutBudget()
        b.configure(
            RolloutBudgetConfig(
                limit_tokens=1000, reminder_at_remaining_tokens=(500, 200, 100)
            )
        )
        # 未用 → 剩余 1000:级别 0 提醒(新窗口"预算激活"提醒,Codex 同款)
        r0 = b.pending_reminder("t1", "w1")
        assert r0 is not None and r0.reminder_index == 0 and r0.remaining_tokens == 1000
        b.mark_reminder_delivered("t1", "w1", r0)
        b.record_usage({"output_tokens": 400})  # 剩余 600,仍未越阈值 → 已送达级别 0 → 去重
        assert b.pending_reminder("t1", "w1") is None
        b.record_usage({"output_tokens": 150})  # 剩余 450 → 越过 500 一档
        r1 = b.pending_reminder("t1", "w1")
        assert r1 is not None and r1.reminder_index == 1
        b.mark_reminder_delivered("t1", "w1", r1)
        # 同窗口已送达同级别 → 去重
        assert b.pending_reminder("t1", "w1") is None
        # 消费更多 → 越过 200、100 → 级别 3
        b.record_usage({"output_tokens": 350})  # 剩余 100
        r2 = b.pending_reminder("t1", "w1")
        assert r2 is not None and r2.reminder_index == 3
        assert r2.remaining_tokens == 100
        # 新窗口(新上下文)→ 重新提醒
        r3 = b.pending_reminder("t1", "w2")
        assert r3 is not None and r3.reminder_index == 3
        # 不同线程 → 独立去重
        r4 = b.pending_reminder("t2", "w1")
        assert r4 is not None

    def test_non_cached_input_helper(self):
        assert _non_cached_input({"input_tokens": 100, "cached_input_tokens": 30}) == 70
        assert _non_cached_input({"inputTokens": 100}) == 100
        assert _non_cached_input({"input_tokens": 10, "cached_input_tokens": 99}) == 0
        assert _non_cached_input({}) == 0
        assert _non_cached_input({"input_tokens": "bad"}) == 0


# ======================================================================
# exec_env(shell_environment_tests.rs 移植)
# ======================================================================
def _pairs(*items):
    return list(items)


class TestExecEnv:
    def test_inherit_all(self):
        policy = ShellEnvironmentPolicy(inherit=ShellEnvironmentPolicyInherit.ALL)
        result = populate_env(_pairs(("PATH", "/usr/bin"), ("FOO", "bar")), policy)
        assert result == {"PATH": "/usr/bin", "FOO": "bar"}

    def test_inherit_none(self):
        policy = ShellEnvironmentPolicy(inherit=ShellEnvironmentPolicyInherit.NONE)
        result = populate_env(_pairs(("PATH", "/usr/bin")), policy)
        assert result == {}

    def test_core_inherit_case_insensitive(self, monkeypatch):
        # Windows 白名单(本机):path/TmpDir 命中,home 不在 Windows 核心表
        monkeypatch.setattr("app.core.exec_env.sys.platform", "win32")
        policy = ShellEnvironmentPolicy(
            inherit=ShellEnvironmentPolicyInherit.CORE, ignore_default_excludes=True
        )
        result = populate_env(
            _pairs(
                ("path", "/usr/bin"),
                ("home", "/home/u"),
                ("TmpDir", "/tmp/custom"),
                ("OPENAI_API_KEY", "secret"),
                ("AWS_REGION", "us-east-1"),
            ),
            policy,
        )
        assert result == {
            "path": "/usr/bin",
            "TmpDir": "/tmp/custom",
        }
        # Unix 白名单:home 命中,USERPROFILE 不在
        monkeypatch.setattr("app.core.exec_env.sys.platform", "linux")
        result2 = populate_env(
            _pairs(("path", "/usr/bin"), ("home", "/home/u"), ("USERPROFILE", "C:\\Users\\u")),
            policy,
        )
        assert result2 == {"path": "/usr/bin", "home": "/home/u"}

    def test_default_excludes_key_secret_token(self):
        policy = ShellEnvironmentPolicy(
            inherit=ShellEnvironmentPolicyInherit.ALL, ignore_default_excludes=False
        )
        result = populate_env(
            _pairs(
                ("OPENAI_API_KEY", "k"),
                ("MY_SECRET", "s"),
                ("GITHUB_TOKEN", "t"),
                ("SAFE_VAR", "v"),
            ),
            policy,
        )
        assert result == {"SAFE_VAR": "v"}

    def test_ignore_default_excludes_keeps_secrets(self):
        policy = ShellEnvironmentPolicy(
            inherit=ShellEnvironmentPolicyInherit.ALL, ignore_default_excludes=True
        )
        result = populate_env(_pairs(("OPENAI_API_KEY", "k")), policy)
        assert result == {"OPENAI_API_KEY": "k"}

    def test_custom_exclude_glob(self):
        policy = ShellEnvironmentPolicy(
            inherit=ShellEnvironmentPolicyInherit.ALL,
            ignore_default_excludes=True,
            exclude=[EnvironmentVariablePattern("AWS_*")],
        )
        result = populate_env(
            _pairs(("AWS_SECRET_ACCESS_KEY", "x"), ("AWS_REGION", "r"), ("HOME", "/h")),
            policy,
        )
        assert result == {"HOME": "/h"}

    def test_set_overrides_and_windows_case_fold(self, monkeypatch):
        monkeypatch.setattr("app.core.exec_env.sys.platform", "win32")
        policy = ShellEnvironmentPolicy(
            inherit=ShellEnvironmentPolicyInherit.ALL,
            ignore_default_excludes=True,
            set={"gh_host": "trusted.example"},
        )
        result = populate_env(_pairs(("GH_HOST", "stale.example")), policy)
        assert result == {"gh_host": "trusted.example"}

    def test_include_only(self):
        policy = ShellEnvironmentPolicy(
            inherit=ShellEnvironmentPolicyInherit.ALL,
            ignore_default_excludes=True,
            include_only=[EnvironmentVariablePattern("PATH"), EnvironmentVariablePattern("HOME*")],
        )
        result = populate_env(
            _pairs(("PATH", "/bin"), ("HOME", "/h"), ("HOMEDRIVE", "C:"), ("FOO", "x")),
            policy,
        )
        assert result == {"PATH": "/bin", "HOME": "/h", "HOMEDRIVE": "C:"}

    def test_thread_id_injected_even_with_include_only(self):
        # Codex 语义:thread_id 在 include_only 过滤之后注入 → 即使 inherit NONE
        # 也会出现(inject"even when include_only is set")
        policy = ShellEnvironmentPolicy(
            inherit=ShellEnvironmentPolicyInherit.NONE,
            include_only=[EnvironmentVariablePattern("PATH")],
        )
        result = populate_env(_pairs(("PATH", "/bin")), policy, thread_id="th-1")
        assert result == {CODEX_THREAD_ID_ENV_VAR: "th-1"}

    def test_non_inheritable_stripped_even_if_set(self):
        policy = ShellEnvironmentPolicy(
            inherit=ShellEnvironmentPolicyInherit.ALL,
            ignore_default_excludes=True,
            set={"NODE_REPL_AUTH_TOKEN": "sneaky"},
        )
        result = populate_env(_pairs(("IHUI_ADMIN_PASSWORD", "p")), policy)
        assert result == {}
        assert is_non_inheritable_env_var("node_repl_auth_token")
        assert scrub_non_inheritable_env_vars({"A": "1", "OPENAI_IDENTITY_TOKEN_FILE": "f"}) == {"A": "1"}
        assert "IHUI_ADMIN_PASSWORD" in NON_INHERITABLE_ENV_VARS

    def test_create_env_pathext_fallback_on_windows(self, monkeypatch):
        monkeypatch.setattr("app.core.exec_env.sys.platform", "win32")
        policy = ShellEnvironmentPolicy(
            inherit=ShellEnvironmentPolicyInherit.NONE, ignore_default_excludes=True
        )
        result = create_env_from_vars([], policy)
        assert result == {"PATHEXT": ".COM;.EXE;.BAT;.CMD"}

    def test_create_env_pathext_preserved(self, monkeypatch):
        monkeypatch.setattr("app.core.exec_env.sys.platform", "win32")
        policy = ShellEnvironmentPolicy(
            inherit=ShellEnvironmentPolicyInherit.ALL, ignore_default_excludes=True
        )
        result = create_env_from_vars([("PathExt", ".PY;.EXE")], policy)
        assert result == {"PathExt": ".PY;.EXE"}

    def test_inject_session_env(self):
        env = {}
        inject_session_env(env, "sess-9", "1.2.3")
        assert env[CODEX_SESSION_ID_ENV_VAR] == "sess-9"
        assert env["IHUI_VERSION"] == "1.2.3"


# ======================================================================
# command_canonicalization(command_canonicalization_tests.rs 移植)
# ======================================================================
class TestCommandCanonicalization:
    def test_plain_script_unwrapped_to_argv(self):
        # bash -lc 'git status' 与直接执行 git status 命中同一审批缓存
        assert canonicalize_command_for_approval(["bash", "-lc", "git status"]) == ["git", "status"]
        assert canonicalize_command_for_approval(["/bin/bash", "-c", "ls -la /tmp"]) == ["ls", "-la", "/tmp"]
        assert canonicalize_command_for_approval(["bash", "-lc", "  git   status  "]) == ["git", "status"]

    def test_login_wrapper_mode_recorded(self):
        out = canonicalize_command_for_approval(["bash", "-l", "-c", "echo a && echo b"])
        assert out[0] == CANONICAL_BASH_SCRIPT_PREFIX
        assert out[1] == "login"
        assert out[2] == "echo a && echo b"

    def test_complex_script_conservative(self):
        script = "cd /a && rm -rf b"
        out = canonicalize_command_for_approval(["bash", "-c", script])
        assert out == [CANONICAL_BASH_SCRIPT_PREFIX, "shell", script]

    def test_redirect_is_not_plain(self):
        assert parse_shell_lc_plain_commands(["bash", "-c", "echo hi > f"]) is None

    def test_powershell_command(self):
        script = "Get-ChildItem -Force"
        out = canonicalize_command_for_approval(["pwsh", "-Command", script])
        assert out == [CANONICAL_POWERSHELL_SCRIPT_PREFIX, script]

    def test_passthrough_argv(self):
        argv = ["git", "status", "--short"]
        assert canonicalize_command_for_approval(argv) == argv

    def test_empty_and_degenerate(self):
        assert canonicalize_command_for_approval([]) == []
        # -c 缺脚本 → 空脚本 → 保守路径
        out = canonicalize_command_for_approval(["bash", "-c"])
        assert out[0] == CANONICAL_BASH_SCRIPT_PREFIX

    def test_non_option_args_abort_extraction(self):
        # bash -e 之类的未支持选项 → 原样返回
        argv = ["bash", "-e", "script.sh"]
        assert canonicalize_command_for_approval(argv) == argv

    def test_wrapper_paths_hit_same_cache_key(self):
        a = canonicalize_command_for_approval(["/bin/bash", "-lc", "git push origin main"])
        b = canonicalize_command_for_approval(["bash", "-c", "git push origin main"])
        assert a == b == ["git", "push", "origin", "main"]
