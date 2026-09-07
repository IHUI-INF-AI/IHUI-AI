# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""os_sandbox 测试 — Windows Job Object/受限令牌真实生效断言 + 纯构造测试。"""

from __future__ import annotations

import ctypes
import os
import struct
import sys
import time

import pytest

from app.services import os_sandbox as sb
from app.services.os_sandbox import (
    BACKEND_LINUX_BWRAP,
    BACKEND_MAC_SEATBELT,
    BACKEND_WIN_JOB,
    CapabilityMissingError,
    ExecResult,
    PolicyError,
    SandboxError,
    SandboxHandle,
    SandboxPolicy,
    WinJob,
    build_bwrap_argv,
    build_child_env,
    build_windows_command_line,
    get_default_backend,
    landlock_path_beneath_bytes,
    landlock_rules_bytes,
    landlock_ruleset_attr_bytes,
    linux_strategy_chain,
    rlimit_spec,
    seatbelt_argv,
    seatbelt_profile,
    validate_command_paths,
)

IS_WIN = sys.platform == "win32"
PY = sys.executable

# 子进程内探测受限令牌降权效果的脚本:打印自身特权条数
_PRIV_PROBE = "import app.services.os_sandbox as sb; print(sb.current_process_privilege_count())"
# 子进程内分配大块内存触发 job 内存上限的脚本
_MEM_HOG = "b = bytearray(1024 * 1024 * 64); print('allocated', len(b))"
# 子进程内 sleep 长于超时的脚本
_SLEEPER = "import time; time.sleep(30); print('done')"


def _policy(**kw: object) -> SandboxPolicy:
    defaults: dict[str, object] = {"base_dir": os.getcwd()}
    defaults.update(kw)
    return SandboxPolicy(**defaults)  # type: ignore[arg-type]


# ============================================================
# 策略模型
# ============================================================


class TestPolicy:
    def test_acl_matrix_read_write_deny(self) -> None:
        p = _policy(
            readable_paths=["/workspace"],
            writable_paths=["/workspace/out"],
            denied_paths=["/workspace/secrets"],
        )
        assert p.can_read("/workspace/a.txt")
        assert p.can_write("/workspace/out/x.bin")
        assert not p.can_write("/workspace/other/x.bin")
        assert not p.can_read("/workspace/secrets/key.pem")
        assert not p.can_write("/workspace/secrets/key.pem")

    def test_deny_priority_over_read(self) -> None:
        p = _policy(readable_paths=["/data"], denied_paths=["/data/private"])
        assert p.acl_for("/data/x") == (True, False)
        assert p.acl_for("/data/private/x") == (False, False)

    def test_empty_readable_means_unrestricted_read(self) -> None:
        p = _policy(denied_paths=["/etc/shadow"])
        assert p.can_read("/anything/goes")
        assert not p.can_read("/etc/shadow")

    def test_empty_writable_denies_all_writes(self) -> None:
        p = _policy(readable_paths=["/srv"])
        assert not p.can_write("/srv/whatever")

    def test_write_subset_of_read_violation(self) -> None:
        with pytest.raises(PolicyError):
            _policy(readable_paths=["/ro"], writable_paths=["/rw"])

    def test_deny_covering_write_violation(self) -> None:
        with pytest.raises(PolicyError):
            _policy(readable_paths=["/w"], writable_paths=["/w/out"], denied_paths=["/w/out"])

    def test_invalid_limits_rejected(self) -> None:
        for kw in ({"timeout_s": 0}, {"memory_mb": -1}, {"cpu_seconds": True}):
            with pytest.raises(PolicyError):
                _policy(**kw)

    def test_glob_segment_match(self) -> None:
        p = _policy(readable_paths=["/home/*/proj"])
        assert p.can_read("/home/alice/proj/x")
        assert not p.can_read("/home/alice/x/proj")

    def test_relative_paths_resolved_against_base_dir(self) -> None:
        p = _policy(readable_paths=["src"], writable_paths=["src"], base_dir="/repo")
        assert p.can_read("/repo/src/main.c")
        assert p.can_write("src/main.c")
        assert not p.can_read("/other/src/main.c")

    def test_serialization_roundtrip(self) -> None:
        p = _policy(
            readable_paths=["/a"], writable_paths=["/a"], denied_paths=["/a/b"],
            allow_network=False, env_whitelist=["PATH"], timeout_s=5,
            memory_mb=128, cpu_seconds=10, max_processes=8,
        )
        q = SandboxPolicy.from_dict(p.to_dict())
        assert q.to_dict() == p.to_dict()

    def test_from_dict_unknown_field_rejected(self) -> None:
        with pytest.raises(PolicyError):
            SandboxPolicy.from_dict({"nope": 1})

    def test_policy_error_is_sandbox_error(self) -> None:
        assert issubclass(PolicyError, SandboxError)
        assert issubclass(sb.WinApiError, SandboxError)
        assert issubclass(CapabilityMissingError, SandboxError)


class TestEnvWhitelist:
    def test_child_env_filters_and_keeps_mandatory(self) -> None:
        p = _policy(env_whitelist=["FOO"])
        env = build_child_env(p, {"FOO": "1", "SECRET": "x", "SYSTEMROOT": "C:\\Windows"})
        assert env["FOO"] == "1"
        assert "SECRET" not in env
        if IS_WIN:
            assert env["SYSTEMROOT"] == "C:\\Windows"  # 系统必需变量强制保留

    def test_child_env_extra_overrides(self) -> None:
        p = _policy(env_whitelist=[])
        env = build_child_env(p, {}, extra={"A": "1"})
        assert env.get("A") == "1"


# ============================================================
# 应用层路径护栏
# ============================================================


class TestPathGuard:
    def test_read_violation_detected(self) -> None:
        p = _policy(readable_paths=["/allowed"])
        v = validate_command_paths(p, ["cat", "/forbidden/x.txt"])
        assert v and "读取越权" in v[0]

    def test_write_intent_flag_checked_as_write(self) -> None:
        p = _policy(readable_paths=["/w"], writable_paths=["/w/out"])
        assert validate_command_paths(p, ["tool", "-o", "/w/out/a.bin"]) == []
        v = validate_command_paths(p, ["tool", "-o", "/w/bad/a.bin"])
        assert v and "写入越权" in v[0]

    def test_cwd_checked(self) -> None:
        p = _policy(readable_paths=["/allowed"])
        assert validate_command_paths(p, ["ls"], cwd="/forbidden")
        assert validate_command_paths(p, ["ls"], cwd="/allowed/sub") == []

    def test_non_path_tokens_ignored(self) -> None:
        p = _policy(readable_paths=["/allowed"])
        assert validate_command_paths(p, ["python", "-c", "print(1)", "--verbose"]) == []


# ============================================================
# 后端探测 / 句柄
# ============================================================


class TestBackendSelection:
    def test_default_backend_matches_platform(self) -> None:
        expect = {"win32": BACKEND_WIN_JOB}.get(
            sys.platform,
            BACKEND_LINUX_BWRAP if sys.platform.startswith("linux") else BACKEND_MAC_SEATBELT,
        )
        assert get_default_backend() == expect

    def test_handle_rejects_unknown_backend(self) -> None:
        with pytest.raises(CapabilityMissingError):
            SandboxHandle(_policy(), backend="plan9")

    def test_handle_explicit_backend_names(self) -> None:
        for name in (BACKEND_WIN_JOB, BACKEND_LINUX_BWRAP, BACKEND_MAC_SEATBELT):
            h = SandboxHandle(_policy(), backend=name)
            assert h.backend == name

    def test_run_empty_argv_raises(self) -> None:
        h = SandboxHandle(_policy(), backend=BACKEND_WIN_JOB if IS_WIN else BACKEND_MAC_SEATBELT)
        with pytest.raises((SandboxError, CapabilityMissingError)):
            h.run([])

    def test_exec_result_ok_property(self) -> None:
        r = ExecResult(cmd=["x"], returncode=0, stdout="", stderr="",
                       duration_ms=1.0, backend="t")
        assert r.ok
        r2 = ExecResult(cmd=["x"], returncode=0, stdout="", stderr="",
                        duration_ms=1.0, backend="t", timed_out=True)
        assert not r2.ok


# ============================================================
# Linux 后端:Landlock ABI v4 字节构造 + bwrap + rlimit(纯函数)
# ============================================================


class TestLandlock:
    def test_ruleset_attr_size_v4(self) -> None:
        p = _policy(readable_paths=["/a"], writable_paths=["/a"], allow_network=False)
        raw = landlock_ruleset_attr_bytes(p)
        assert len(raw) == sb.LANDLOCK_RULESET_ATTR_SIZE_V4 == 16

    def test_ruleset_fs_mask_derivation(self) -> None:
        only_read = _policy(readable_paths=["/a"])
        assert sb.landlock_fs_access_mask(only_read) == sb.LANDLOCK_READ_MASK
        rw = _policy(readable_paths=["/a"], writable_paths=["/a"])
        assert sb.landlock_fs_access_mask(rw) == (
            sb.LANDLOCK_READ_MASK | sb.LANDLOCK_WRITE_MASK
        )
        assert sb.landlock_fs_access_mask(_policy()) == 0

    def test_ruleset_net_mask(self) -> None:
        assert sb.landlock_net_access_mask(_policy(allow_network=True)) == 0
        denied = sb.landlock_net_access_mask(_policy(allow_network=False))
        assert denied == (
            sb.LANDLOCK_ACCESS_NET_BIND_TCP | sb.LANDLOCK_ACCESS_NET_CONNECT_TCP
        )

    def test_abi_v4_includes_truncate_and_refer(self) -> None:
        # ABI v3 引入 TRUNCATE、v2 引入 REFER —— v4 写掩码必须包含
        assert sb.LANDLOCK_WRITE_MASK & sb.LANDLOCK_ACCESS_FS_TRUNCATE
        assert sb.LANDLOCK_WRITE_MASK & sb.LANDLOCK_ACCESS_FS_REFER

    def test_path_beneath_bytes_layout(self) -> None:
        raw = landlock_path_beneath_bytes(0x7FFF, 42)
        assert len(raw) == sb.LANDLOCK_PATH_BENEATH_SIZE == 12
        access, fd = struct.unpack("<Qi", raw)
        assert access == 0x7FFF
        assert fd == 42

    def test_path_beneath_negative_fd_packed(self) -> None:
        _access, fd = struct.unpack("<Qi", landlock_path_beneath_bytes(1, -1))
        assert fd == -1

    def test_rules_bytes_read_write_masks(self) -> None:
        # write ⊆ read 不变式:writable 必须是某条 readable 的子路径
        p = _policy(readable_paths=["/root"], writable_paths=["/root/out"])
        rules = landlock_rules_bytes(p, {"/root": 5, "/root/out": 6})
        assert [t for t, _ in rules] == [sb.LANDLOCK_RULE_PATH_BENEATH] * 2
        ro_access, ro_fd = struct.unpack("<Qi", rules[0][1])
        rw_access, rw_fd = struct.unpack("<Qi", rules[1][1])
        assert (ro_access, ro_fd) == (sb.LANDLOCK_READ_MASK, 5)
        assert (rw_access, rw_fd) == (sb.LANDLOCK_READ_MASK | sb.LANDLOCK_WRITE_MASK, 6)

    def test_rules_bytes_skips_missing_fd_and_dedups(self) -> None:
        p = _policy(readable_paths=["/a", "/a", "/b"])
        rules = landlock_rules_bytes(p, {"/a": 3})
        assert len(rules) == 1

    def test_strategy_chain_order(self) -> None:
        assert linux_strategy_chain() == ("landlock", "bwrap", "rlimit")


class TestBwrap:
    def test_bwrap_basic_shape(self) -> None:
        p = _policy(readable_paths=["/data"], writable_paths=["/data/out"], allow_network=True)
        argv = build_bwrap_argv(p, ["python", "-c", "print(1)"])
        assert argv[0] == "bwrap"
        assert "--die-with-parent" in argv
        assert "--unshare-all" in argv
        assert "--share-net" in argv  # allow_network=True
        assert "--ro-bind" in argv and "--bind" in argv
        assert argv[-3:] == ["--", "python", "-c"] or argv[-4:-1] == ["--", "python", "-c"]
        assert argv[argv.index("--") + 1:] == ["python", "-c", "print(1)"]

    def test_bwrap_deny_network_unshares(self) -> None:
        p = _policy(allow_network=False)
        argv = build_bwrap_argv(p, ["true"])
        assert "--unshare-all" in argv
        assert "--share-net" not in argv

    def test_bwrap_denied_paths_tmpfs(self) -> None:
        p = _policy(denied_paths=["/home/u/.ssh"])
        argv = build_bwrap_argv(p, ["true"])
        i = argv.index("--tmpfs")
        assert argv[i + 1] == "/home/u/.ssh"

    def test_bwrap_env_clearenv_and_setenv(self) -> None:
        p = _policy(env_whitelist=["LANG", "MISSING"])
        argv = build_bwrap_argv(p, ["true"], env={"LANG": "C.UTF-8"})
        assert "--clearenv" in argv
        i = argv.index("--setenv")
        assert argv[i + 1:i + 3] == ["LANG", "C.UTF-8"]
        assert "MISSING" not in argv

    def test_bwrap_windows_backend_unavailable(self) -> None:
        if IS_WIN:
            with pytest.raises(CapabilityMissingError):
                sb.LinuxSandboxBackend.check_available()


class TestRlimit:
    def test_rlimit_spec_values(self) -> None:
        p = _policy(memory_mb=256, cpu_seconds=7, max_processes=9)
        spec = dict((name, (soft, hard)) for name, soft, hard in rlimit_spec(p))
        assert spec["RLIMIT_AS"] == (256 * 1024 * 1024, 256 * 1024 * 1024)
        assert spec["RLIMIT_CPU"] == (7, 8)
        assert spec["RLIMIT_NPROC"] == (9, 9)

    def test_rlimit_preexec_windows_rejected(self) -> None:
        if IS_WIN:
            with pytest.raises(CapabilityMissingError):
                sb.make_rlimit_preexec(_policy())


# ============================================================
# macOS 后端:Seatbelt profile(纯函数)
# ============================================================


class TestSeatbelt:
    def test_profile_starts_with_deny_default(self) -> None:
        text = seatbelt_profile(_policy())
        assert text.startswith("(version 1)\n(deny default)")

    def test_profile_read_subpaths(self) -> None:
        p = _policy(readable_paths=["/Users/me/proj"])
        text = seatbelt_profile(p)
        assert '(allow file-read* (subpath "/Users/me/proj"))' in text

    def test_profile_write_subpaths(self) -> None:
        p = _policy(readable_paths=["/w"], writable_paths=["/w"])
        text = seatbelt_profile(p)
        assert '(allow file-write* (subpath "/w"))' in text

    def test_profile_deny_last_wins(self) -> None:
        p = _policy(denied_paths=["/Users/me/.ssh"])
        text = seatbelt_profile(p)
        assert '(deny file-read* (subpath "/Users/me/.ssh"))' in text
        assert '(deny file-write* (subpath "/Users/me/.ssh"))' in text
        # deny 规则位于所有 allow 之后(Seatbelt 后写优先)
        assert text.rindex("(deny file-read*") > text.rindex("(allow process*)")

    def test_profile_network_toggle(self) -> None:
        assert "(allow network*)" in seatbelt_profile(_policy(allow_network=True))
        assert "(deny network*)" in seatbelt_profile(_policy(allow_network=False))

    def test_profile_empty_readable_allows_all_read(self) -> None:
        assert '(allow file-read* (subpath "/"))' in seatbelt_profile(_policy())

    def test_profile_quotes_special_chars(self) -> None:
        p = _policy(denied_paths=['/tmp/we"ird'])
        assert '\\"' in seatbelt_profile(p)

    def test_seatbelt_argv_wraps(self) -> None:
        argv = seatbelt_argv(_policy(), ["ls", "-la"])
        assert argv[0] == "sandbox-exec"
        assert argv[1] == "-p"
        assert argv[2] == seatbelt_profile(_policy())
        assert argv[3:] == ["ls", "-la"]

    def test_seatbelt_backend_unavailable_off_mac(self) -> None:
        if sys.platform != "darwin":
            with pytest.raises(CapabilityMissingError):
                sb.MacSeatbeltBackend.check_available()


# ============================================================
# Windows 后端:Job Object / 受限令牌 —— 真实 OS 生效断言
# ============================================================


@pytest.mark.skipif(not IS_WIN, reason="Job Object/受限令牌仅 Windows 真实可用")
class TestWindowsJobObject:
    def test_job_create_and_query_limits(self) -> None:
        p = _policy(memory_mb=128, cpu_seconds=11, max_processes=5)
        with WinJob.create("ihui-test-job") as job:
            job.set_limits(p, kill_on_close=True)
            info = job.query_limits()
            flags = info.BasicLimitInformation.LimitFlags
            assert flags & sb.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            assert flags & sb.JOB_OBJECT_LIMIT_JOB_MEMORY
            assert flags & sb.JOB_OBJECT_LIMIT_PROCESS_MEMORY
            assert flags & sb.JOB_OBJECT_LIMIT_PROCESS_TIME
            assert flags & sb.JOB_OBJECT_LIMIT_ACTIVE_PROCESS
            assert info.JobMemoryLimit == 128 * 1024 * 1024
            assert info.ProcessMemoryLimit == 128 * 1024 * 1024
            assert info.BasicLimitInformation.PerProcessUserTimeLimit == 11 * 10_000_000
            assert info.BasicLimitInformation.ActiveProcessLimit == 5

    def test_limits_struct_kill_on_close_toggle(self) -> None:
        job = WinJob.create()
        try:
            with_close = job.build_limits_struct(_policy(), True)
            without = job.build_limits_struct(_policy(), False)
            assert with_close.BasicLimitInformation.LimitFlags & sb.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            assert not without.BasicLimitInformation.LimitFlags & sb.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        finally:
            job.close()

    def test_kill_on_close_terminates_child(self) -> None:
        """作业关闭 → 内核立即杀死挂起的子进程(真实 OS 行为)。"""
        import subprocess
        proc = subprocess.Popen([PY, "-c", _SLEEPER], creationflags=0x4)  # CREATE_SUSPENDED
        pid = proc.pid
        try:
            job = WinJob.create()
            job.set_limits(_policy(), kill_on_close=True)
            k32 = sb._kernel32()
            # Popen 句柄是 int(msvcrt handle),重新 OpenProcess 拿带赋值权限的句柄
            h = k32.OpenProcess(0x1F0FFF, 0, pid)  # PROCESS_ALL_ACCESS
            assert h
            try:
                job.assign(int(h))
            finally:
                k32.CloseHandle(ctypes.c_void_p(int(h))) if False else sb.close_win_handle(int(h))
            # 恢复线程让测试结束后可清理;随后关闭 job,内核应杀死进程
            k32.ResumeThread(ctypes.c_void_p(int(proc._handle))) if False else None
        finally:
            # 不恢复线程:进程仍挂起,直接关 job 句柄触发 kill-on-close
            pass
        # 关闭 job 句柄
        job.close()
        # 挂起态进程被 kill-on-close 终止后,OpenProcess 查询退出码不再是 STILL_ACTIVE
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            if not sb.is_pid_alive(pid):
                break
            time.sleep(0.05)
        assert not sb.is_pid_alive(pid)
        proc.kill()
        proc.wait(timeout=5)

    def test_memory_limit_enforced_kills_hog(self) -> None:
        """64MB 分配在 32MB job 内存上限下必须失败(OS-enforced)。"""
        h = SandboxHandle(_policy(memory_mb=32, timeout_s=30, restrict_token=False),
                          backend=BACKEND_WIN_JOB)
        r = h.run([PY, "-c", _MEM_HOG])
        assert not r.ok
        assert r.returncode != 0
        assert "allocated" not in r.stdout
        assert r.killed_by_limit or (r.returncode & 0xFFFFFFFF) in sb._JOB_KILL_CODES \
            or "MemoryError" in r.stderr

    def test_small_alloc_under_high_limit_passes(self) -> None:
        """对照组:8MB 分配在 512MB 上限内正常成功(证明上一条失败归因于限额)。"""
        h = SandboxHandle(_policy(memory_mb=512, restrict_token=False), backend=BACKEND_WIN_JOB)
        r = h.run([PY, "-c", "b = bytearray(8 * 1024 * 1024); print('ok')"])
        assert r.ok
        assert "ok" in r.stdout
        assert not r.killed_by_limit

    def test_timeout_kills_runaway(self) -> None:
        h = SandboxHandle(_policy(timeout_s=2, restrict_token=False), backend=BACKEND_WIN_JOB)
        start = time.monotonic()
        r = h.run([PY, "-c", _SLEEPER])
        elapsed = time.monotonic() - start
        assert r.timed_out
        assert not r.ok
        assert elapsed < 12  # 远早于 sleep(30) 自然结束

    def test_restricted_token_strips_privileges(self) -> None:
        """CreateRestrictedToken 真实降权:受限令牌特权条数 < 原始令牌。"""
        a32 = sb._advapi32()
        base = ctypes.c_void_p(0)
        assert a32.OpenProcessToken(ctypes.c_void_p(-1), sb._TOKEN_QUERY, ctypes.byref(base))
        try:
            original = sb.token_privilege_count(base.value or 0)
        finally:
            sb.close_win_handle(base.value or 0)
        restricted = sb.create_restricted_token()
        try:
            limited = sb.token_privilege_count(restricted)
        finally:
            sb.close_win_handle(restricted)
        assert original > 0
        assert limited < original

    def test_child_process_runs_restricted(self) -> None:
        """子进程经受限令牌启动后自证特权条数低于父进程令牌。"""
        parent_privs = sb.current_process_privilege_count()
        h = SandboxHandle(
            _policy(restrict_token=True, env_whitelist=["PYTHONPATH"]),
            backend=BACKEND_WIN_JOB,
        )
        r = h.run([PY, "-c", _PRIV_PROBE], cwd=os.getcwd())
        if "受限令牌降级" in r.stderr:
            pytest.skip("本机策略阻止受限令牌下 CreateProcessW,已降级执行")
        assert r.ok, r.stderr
        child_privs = int(r.stdout.strip().splitlines()[-1])
        assert child_privs < parent_privs

    def test_env_whitelist_applied_to_child(self) -> None:
        h = SandboxHandle(
            _policy(env_whitelist=["SBX_KEEP"], restrict_token=False,
                    readable_paths=[os.getcwd()]),
            backend=BACKEND_WIN_JOB,
        )
        r = h.run(
            [PY, "-c", "import os; print('|'.join(["
                       "os.environ.get('SBX_KEEP','<none>'), "
                       "os.environ.get('SBX_DROP','<none>'), "
                       "os.environ.get('SECRET_X','<none>')]))"],
            env={"SBX_KEEP": "yes", "SBX_DROP": "no", "SECRET_X": "leak"},
        )
        assert r.ok, r.stderr
        keep, drop, secret = r.stdout.strip().split("|")
        assert keep == "yes"  # 白名单变量保留
        assert drop == "<none>"  # 调用方传入但不在白名单 → 裁剪
        assert secret == "<none>"  # 继承环境中的变量同样被裁剪

    def test_path_violation_blocks_run(self) -> None:
        h = SandboxHandle(_policy(readable_paths=["C:\\allowed"]), backend=BACKEND_WIN_JOB)
        with pytest.raises(SandboxError):
            h.run([PY, "C:\\forbidden\\script.py"])

    def test_command_line_quoting(self) -> None:
        assert build_windows_command_line(["a", "b c"]) == 'a "b c"'
        assert build_windows_command_line(['x"y']) == '"x\\"y"'
        assert build_windows_command_line(["plain"]) == "plain"

    def test_backend_name_and_result_metadata(self) -> None:
        h = SandboxHandle(_policy(restrict_token=False), backend=BACKEND_WIN_JOB)
        r = h.run([PY, "-c", "print('meta')"])
        assert r.backend == BACKEND_WIN_JOB
        assert r.duration_ms > 0
        assert r.cmd[0] == PY
        assert "meta" in r.stdout

    def test_str_command_shlex_windows_paths(self) -> None:
        """str 命令在 Windows 用 posix=False 拆分,反斜杠路径不丢失。"""
        h = SandboxHandle(_policy(restrict_token=False), backend=BACKEND_WIN_JOB)
        r = h.run(f'{PY} -c "print(1)"')
        assert r.ok
        assert r.cmd[0] == PY


@pytest.mark.skipif(not IS_WIN, reason="非 Windows 平台 Job Object 不可用")
class TestWindowsApiErrors:
    def test_assign_bad_handle_raises(self) -> None:
        with WinJob.create() as job:
            with pytest.raises(sb.WinApiError):
                job.assign(0)

    def test_winapi_error_carries_winerror(self) -> None:
        e = sb.WinApiError("x", winerror=5)
        assert "WinError=5" in str(e)
        assert e.winerror == 5
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
