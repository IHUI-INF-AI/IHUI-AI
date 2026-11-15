# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""沙箱失败归因分类器(对标 DeepSeek Harness dsh-sandbox-local,2026-11-15 R11 逆向复现)。

为什么要有这一份:IHUI `os_sandbox.py`(1831 行)已有跨平台沙箱链
(`linux_bwrap` Landlock→bwrap→rlimit / `mac_seatbelt` / Windows ACL),
但**判断一条受限命令为什么失败**只靠 exit code + 一处 `MemoryError` 字符串
(`_killed_by_limit`,1424 行)。后果:
    退出码非 0 时,无法区分
      (a) 命令真的被沙箱**拒绝**(denied) —— 预期行为,安全边界生效;
      (b) **launcher 自身崩了**(runner fatal) —— 沙箱没跑起来,是基础设施故障;
      (c) 命令正常跑完只是**返回非 0**(业务失败);
      (d) launcher 只**打印**了某签名但命令其实**跑了**(误判风险)。
这四种对调用方语义完全不同:(a) 是"沙箱正常拦住了越界访问"要如实上报,
(b) 是"沙箱坏了"要 fail-closed 而非静默当业务失败,(c) 是正常业务结果。

对照对象 dsh-sandbox-local 有一张**跨后端归因表**(取证见
.archify/deepseek-agent-core-src/dsh-sandbox-local__index.js:216-256):
  - `DENIAL_SIGNATURES`:每个 runner 内核说的"否认方言"——被拒文件操作产生的
    大小写不敏感 stderr 子串(bwrap "read-only file system" / landlock
    "permission denied" / seatbelt "operation not permitted" / windows-acl 一组)。
  - `RUNNER_FAILURE_RULES`:runner 自身致命诊断 —— exit-gate 在特定退出码上,
    防止"命令 merely PRINTS the signature"被误判成"命令没跑"。
  - `STATIC_ENFORCEMENT`:各后端**声明**的执行完整性(bwrap/seatbelt=full,
    windows-acl=partial,landlock 需 probe 才知道 full/partial)。
本模块用 IHUI 的 Python 栈复刻这套归因。刻意**不做**:
  - 不做 bwrap/seatbelt profile **构造**(os_sandbox.py:1569 已有,不重复);
  - 不做 probe 探测执行(os_sandbox.py 的 check_available 已管);
  - 不碰网络/不 spawn 任何进程(纯字符串分类,零副作用)。

超越点(§0.12 第④步):本仓把"归因"做成**纯函数**(`classify_sandbox_failure`),
策略层可单测、与 FFI/spawn 完全解耦;DSH 的分类嵌在 provider 类里、要 mock 整个
runner 才能测。且本仓显式区分 (a)(b)(c)(d) 四态 + 显式 exit-gate 字段,比 DSH
隐式规则更可读、更可证。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

__all__ = [
    "FailureKind",
    "SandboxBackend",
    "FailureVerdict",
    "DENIAL_SIGNATURES",
    "RUNNER_FAILURE_RULES",
    "STATIC_ENFORCEMENT",
    "classify_sandbox_failure",
    "enforcement_of",
]

# 失败归类(四态 + 未知)。语义见模块 docstring (a)(b)(c)(d)。
FailureKind = Literal[
    "denied",            # (a) 被沙箱拒绝 —— 安全边界生效,预期
    "runner_fatal",      # (b) launcher 自身崩溃 —— 沙箱没跑起来,基础设施故障
    "business_failure",  # (c) 命令正常跑完只是非 0 —— 业务失败,非沙箱
    "unknown",           # 无法归类(既无 denial 签名也无 fatal 规则命中)
]

SandboxBackend = Literal["linux_bwrap", "linux_landlock", "mac_seatbelt", "windows_acl"]

VerdictKind = Literal[FailureKind, "success", "timeout", "oom_killed"]

# 各后端的"否认方言":被拒文件操作产生的 stderr 子串(大小写不敏感)。
# 取证 dsh DENIAL_SIGNATURES(:220-231)。本仓补 runnerCommand 等价物为通用兜底。
DENIAL_SIGNATURES: dict[SandboxBackend, tuple[str, ...]] = {
    "linux_bwrap": ("read-only file system",),
    "linux_landlock": ("permission denied",),
    "mac_seatbelt": ("operation not permitted",),
    "windows_acl": (
        "access is denied",
        "access to the path",
        "permission denied",
        "operation not permitted",
    ),
}
# 通用兜底(任何后端都可命中的跨平台否认词),对齐 dsh runnerCommand(:230)
_GENERIC_DENIAL: tuple[str, ...] = ("read-only file system", "permission denied")

# runner 自身致命规则:exit-gate 在特定退出码 + stderr 前缀签名。
# 取证 dsh RUNNER_FAILURE_RULES(:245-256)。exit-gate 是关键:命令"打印"签名
# 但退出码不符 ⇒ 不算 runner fatal(防误判,见 classify 的 exit-gated 分支)。
# allowedExitCodes=None 表示任何非 0 都算命中;否则只有列出的退出码才算。
@dataclass(frozen=True)
class RunnerFailureRule:
    fatal_signatures: tuple[str, ...]
    allowed_exit_codes: tuple[int, ...] | None = None  # None=任意非 0
    informational_lines: tuple[str, ...] = ()  # 打印了也不算 fatal 的提示行


RUNNER_FAILURE_RULES: dict[SandboxBackend, RunnerFailureRule] = {
    "linux_bwrap": RunnerFailureRule(fatal_signatures=("bwrap: ",)),
    # landlock launcher 有版本化 exit-125 + 致命行契约(dsh LAUNCHER_FAILURE_EXIT)
    "linux_landlock": RunnerFailureRule(
        fatal_signatures=("landlock-run: ",),
        allowed_exit_codes=(125,),
        informational_lines=("landlock-run: partial enforcement (older Landlock ABI)",),
    ),
    "mac_seatbelt": RunnerFailureRule(fatal_signatures=("sandbox-exec: ",)),
    # windows-acl runner 打印 `windows-acl-run: <detail>` 且 exit 127(dsh :253-256)
    "windows_acl": RunnerFailureRule(
        fatal_signatures=("windows-acl-run: ",),
        allowed_exit_codes=(127,),
    ),
}

# 各后端**声明**的执行完整性(取证 dsh STATIC_ENFORCEMENT :201-206)。
# bwrap/seatbelt 靠 profile 构造即管住全部承诺的文件效果 ⇒ full(profile fact);
# windows-acl 因 NTFS 硬链接跨路径别名同一文件对象、读不设限 ⇒ partial;
# landlock 不经 probe 不可达(Linux 链有两个 rung),静态标 full 但实际由 probe 决定。
STATIC_ENFORCEMENT: dict[SandboxBackend, Literal["full", "partial"]] = {
    "linux_bwrap": "full",
    "linux_landlock": "full",  # 实际 full/partial 由 probe 报告,见 enforcement_of
    "mac_seatbelt": "full",
    "windows_acl": "partial",
}


def enforcement_of(backend: SandboxBackend, *, probed: Literal["full", "partial", "unusable"] | None = None) -> str:
    """返回某后端的执行完整性。

    probe 优先:Linux 链有两个 rung,landlock 只能经 probe 选出,probe 的报告
    (full / per-ABI-partial)才区分完整性(dsh :539-542 语义)。单 rung 平台
    (darwin seatbelt / win32 acl)无替代品、不经 probe,直接用静态声明。
    """
    if probed is not None:
        if probed == "unusable":
            return "unusable"  # 探测不可用 ⇒ 该 rung 不可选
        return probed
    return STATIC_ENFORCEMENT[backend]


@dataclass(frozen=True)
class FailureVerdict:
    """一条受限命令的归因结论。"""

    kind: VerdictKind
    backend: SandboxBackend
    exit_code: int | None
    matched_denial: str | None = None  # 命中的否认签名(便于上报定位)
    matched_fatal: str | None = None  # 命中的 runner 致命签名
    exit_gated: bool = False  # 是否靠退出码 gate 才判 fatal(防误判证据)
    enforcement: str = "full"  # 该后端声明/探测的执行完整性
    notes: tuple[str, ...] = field(default_factory=tuple)


def _contains_any(haystack_lower: str, needles: tuple[str, ...]) -> str | None:
    """大小写不敏感子串匹配,返回命中的 needle(取最早出现者)。"""
    best: tuple[int, str] | None = None
    for needle in needles:
        idx = haystack_lower.find(needle.lower())
        if idx >= 0 and (best is None or idx < best[0]):
            best = (idx, needle)
    return best[1] if best else None


def classify_sandbox_failure(
    *,
    backend: SandboxBackend,
    exit_code: int | None,
    stderr: str,
    timed_out: bool = False,
    probed: Literal["full", "partial", "unusable"] | None = None,
) -> FailureVerdict:
    """把一条受限命令的 (exit_code, stderr) 归因为四态之一。纯函数,不 spawn。

    判定顺序(每一步都对齐 dsh 取证语义):
      0. 超时/成功先短路(非失败,归因无意义)。
      1. OOM:exit≠0 且 stderr 含 MemoryError ⇒ oom_killed(IHUI _killed_by_limit
         :1424 已有此判断,本仓显式独立成一种,便于上报区分)。
      2. runner fatal(**exit-gated**):stderr 命中该后端的 fatal 前缀,且
         (allowed_exit_codes 为 None 或 exit_code 在其中) ⇒ runner_fatal。
         关键防误判(dsh :237-240):命令"merely PRINTS the signature"但退出码不符
         ⇒ **不算** runner fatal,继续往下判(可能只是业务失败打印了相似文本)。
      3. denied:stderr 命中该后端否认方言(或通用兜底)⇒ denied(安全边界生效)。
      4. 其余非 0 ⇒ business_failure(正常业务失败)。
      5. 全无命中且 exit=0 但又走到这里(理论上不会)⇒ unknown。
    """
    enforcement = enforcement_of(backend, probed=probed)
    stderr_lower = (stderr or "").lower()

    # 0. 短路:成功 / 超时
    if exit_code == 0 and not timed_out:
        return FailureVerdict(
            kind="success", backend=backend, exit_code=exit_code, enforcement=enforcement
        )
    if timed_out:
        return FailureVerdict(
            kind="timeout", backend=backend, exit_code=exit_code, enforcement=enforcement
        )

    # 1. OOM(对齐 IHUI _killed_by_limit:MemoryError + 非 0)
    if exit_code != 0 and "MemoryError" in (stderr or ""):
        return FailureVerdict(
            kind="oom_killed",
            backend=backend,
            exit_code=exit_code,
            enforcement=enforcement,
            notes=("stderr 含 MemoryError,判定 OOM 终止",),
        )

    # 2. runner fatal(exit-gated)
    rule = RUNNER_FAILURE_RULES[backend]
    fatal_hit = _contains_any(stderr_lower, rule.fatal_signatures)
    if fatal_hit:
        gate_ok = rule.allowed_exit_codes is None or exit_code in rule.allowed_exit_codes
        # 排除 informational 行(打印了也不算 fatal,如 landlock partial enforcement)
        is_info = bool(_contains_any(stderr_lower, rule.informational_lines))
        if gate_ok and not is_info:
            return FailureVerdict(
                kind="runner_fatal",
                backend=backend,
                exit_code=exit_code,
                matched_fatal=fatal_hit,
                exit_gated=rule.allowed_exit_codes is not None,
                enforcement=enforcement,
                notes=(
                    f"runner 致命签名 {fatal_hit!r} 命中"
                    + (f",退出码 {exit_code} 在 gate {rule.allowed_exit_codes}" if rule.allowed_exit_codes else ""),
                ),
            )
        if is_info:
            # informational 行:打印了但语义是"部分执行"提示,不是致命
            return FailureVerdict(
                kind="denied" if _contains_any(stderr_lower, DENIAL_SIGNATURES[backend] + _GENERIC_DENIAL) else "business_failure",
                backend=backend,
                exit_code=exit_code,
                matched_denial=_contains_any(stderr_lower, DENIAL_SIGNATURES[backend]),
                matched_fatal=None,
                enforcement=enforcement,
                notes=("命中 informational 行(partial enforcement 提示),不算 runner fatal",),
            )
        # 签名命中但退出码不在 gate ⇒ 防误判,不当 runner fatal

    # 3. denied(后端方言 + 通用兜底)
    denial_hit = _contains_any(stderr_lower, DENIAL_SIGNATURES[backend] + _GENERIC_DENIAL)
    if denial_hit:
        return FailureVerdict(
            kind="denied",
            backend=backend,
            exit_code=exit_code,
            matched_denial=denial_hit,
            enforcement=enforcement,
            notes=(f"否认方言 {denial_hit!r} 命中,安全边界生效",),
        )

    # 4. 其余非 0 ⇒ 业务失败
    if exit_code not in (0, None):
        return FailureVerdict(
            kind="business_failure",
            backend=backend,
            exit_code=exit_code,
            enforcement=enforcement,
        )

    return FailureVerdict(kind="unknown", backend=backend, exit_code=exit_code, enforcement=enforcement)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
