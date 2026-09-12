# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Agent 安全配置单一事实源(2026-09-12 立,P0-3 安全三件套接线)。

职责:集中管理 prompt_guard / exec_policy / guarded_pipeline 三件套在主链路的
运行配置,提供「env 默认 + 进程内可更新」两级来源:

- env(AGENT_SECURITY_*)只读一次,作为默认值;
- 进程内 set_security_config() 经 /api/agent/security-config 端点更新(不落盘,
  重启回 env 默认——生产持久化属后续 P1,先闭环功能)。

字段语义:
- prompt_guard_enabled:    工具入参注入探测总开关(默认 ON)。
- prompt_guard_policy:     flag|sanitize|refuse(默认 sanitize——伪系统提示标签
                           剥离 + base64 段剥离,高命中整体拒绝)。
- exec_policy_mode:        enforce|audit|off(默认 enforce)。
                           enforce = run_command 执行前经 exec_policy 评估,
                                     DENY 拒绝、PROMPT 转真实用户审批;
                           audit   = PROMPT 级仅记录后放行(观察期);
                                     DENY 硬红线仍拒绝,不降级;
                           off     = 完全跳过 exec_policy 评估(危险命令硬门、
                                     黑白名单等其他防线不受影响)。
- input_scan_enabled:      危险工具入参扫描(command_injection/path_traversal/
                           ssrf_loopback/arg_too_long)总开关(默认 ON)。
- pipeline_record_enabled: guarded_pipeline 步骤录制开关(默认 ON;
                           recorder 已注入 loop 时生效)。

线程/协程安全说明:配置对象为不可变 dataclass,更新即整体替换(原子引用切换),
无锁需求;读取端拿到的引用永远自洽。
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, replace

logger = logging.getLogger(__name__)

POLICY_MODES = frozenset({"enforce", "audit", "off"})
GUARD_POLICIES = frozenset({"flag", "sanitize", "refuse"})

_TRUE = frozenset({"1", "true", "yes", "on"})
_FALSE = frozenset({"0", "false", "no", "off"})


def _env_bool(key: str, default: bool) -> bool:
    raw = os.environ.get(key)
    if raw is None or not raw.strip():
        return default
    val = raw.strip().lower()
    if val in _TRUE:
        return True
    if val in _FALSE:
        return False
    return default


@dataclass(frozen=True)
class SecurityConfig:
    """不可变安全配置快照。"""

    prompt_guard_enabled: bool = True
    prompt_guard_policy: str = "sanitize"
    exec_policy_mode: str = "enforce"
    input_scan_enabled: bool = True
    pipeline_record_enabled: bool = True

    def to_dict(self) -> dict[str, object]:
        return {
            "prompt_guard_enabled": self.prompt_guard_enabled,
            "prompt_guard_policy": self.prompt_guard_policy,
            "exec_policy_mode": self.exec_policy_mode,
            "input_scan_enabled": self.input_scan_enabled,
            "pipeline_record_enabled": self.pipeline_record_enabled,
        }

    def validate(self) -> list[str]:
        """返回非法字段错误列表(空 = 合法)。"""
        errs: list[str] = []
        if self.prompt_guard_policy not in GUARD_POLICIES:
            errs.append(
                f"prompt_guard_policy 必须是 {sorted(GUARD_POLICIES)} 之一, 收到 {self.prompt_guard_policy!r}"
            )
        if self.exec_policy_mode not in POLICY_MODES:
            errs.append(
                f"exec_policy_mode 必须是 {sorted(POLICY_MODES)} 之一, 收到 {self.exec_policy_mode!r}"
            )
        return errs


def _config_from_env() -> SecurityConfig:
    return SecurityConfig(
        prompt_guard_enabled=_env_bool("AGENT_SECURITY_PROMPT_GUARD", True),
        prompt_guard_policy=os.environ.get("AGENT_SECURITY_PROMPT_GUARD_POLICY", "sanitize")
        .strip()
        .lower(),
        exec_policy_mode=os.environ.get("AGENT_SECURITY_EXEC_POLICY", "enforce").strip().lower(),
        input_scan_enabled=_env_bool("AGENT_SECURITY_INPUT_SCAN", True),
        pipeline_record_enabled=_env_bool("AGENT_SECURITY_PIPELINE_RECORD", True),
    )


_current: SecurityConfig = _config_from_env()


def get_security_config() -> SecurityConfig:
    """读取当前配置快照(原子,不可变)。"""
    return _current


def set_security_config(**updates: object) -> SecurityConfig:
    """进程内更新配置(整体替换;非法值 raise ValueError)。

    仅允许更新 SecurityConfig 已知字段;未知字段 raise ValueError 防拼写静默丢失。
    """
    global _current
    valid = set(SecurityConfig.__dataclass_fields__)
    unknown = set(updates) - valid
    if unknown:
        raise ValueError(f"未知安全配置字段: {sorted(unknown)}")
    next_cfg = replace(_current, **updates)  # type: ignore[arg-type]
    errs = next_cfg.validate()
    if errs:
        raise ValueError("; ".join(errs))
    _current = next_cfg
    logger.info("安全配置已更新: %s", next_cfg.to_dict())
    return _current


def reset_security_config() -> SecurityConfig:
    """重置为 env 默认(测试用)。"""
    global _current
    _current = _config_from_env()
    return _current


__all__ = [
    "POLICY_MODES",
    "GUARD_POLICIES",
    "SecurityConfig",
    "get_security_config",
    "set_security_config",
    "reset_security_config",
]
