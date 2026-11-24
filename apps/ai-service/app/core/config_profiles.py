# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""config profiles 读取面(79 号票遗留格,2026-10-25 立)。

票面要求双轴配置**从 config profiles 取**:Codex config.toml 的 ``[profiles.NAME]``
是"顶层键子集覆盖",经 ``--profile`` 或顶层 ``profile=`` 选择;契约层
``core/permission_axis.py`` 只收键名单与取值解析,裁决器
``core/permission_axis_gate.py`` 的优先级第 2 档就是它 —— 但 HEAD 上没有任何读取面,
``config_profiles`` 在本服务零命中,于是"档案"只存在于单元测试的入参里。

本模块是该配置的**唯一读取面**,来源是本仓既有配置通道 ``core/config.py`` 的 Settings
(env ``CONFIG_PROFILES`` / ``CONFIG_PROFILE``),不另造第二份设置仓库/DB 表:
- ``config_profiles``:配置文档原文,JSON 或 TOML 文本,形如
  ``{"profile": "review", "profiles": {"review": {"sandbox_mode": "read-only"}}}``;
- ``config_profile``:选档,非空时优先于文档顶层 ``profile`` 键。

回退口径(与裁决器头注同一份,逐条有测试钉住):
- 未配置 / 文档为空 / ``profiles`` 段缺失 ⇒ 没有档案 ⇒ 返回 None(调用方整段跳过);
- 选中的档案不存在 ⇒ 记 warning 并整段跳过(不猜一个档案顶上);
- 解析失败(JSON/TOML 坏文本)或轴值认不出 ⇒ 记 warning 并整段跳过 —— **fail-closed**,
  绝不把"认不出"补成默认档(那会把用户明确写的 read-only 静默降级成未指定);
- 档案只给了某一轴 ⇒ 另一轴保持 None(未指定),**不补**``SANDBOX_MODE_DEFAULT``。
"""

from __future__ import annotations

import json
import logging
import tomllib
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from .permission_axis import resolve_config_profile_axis

if TYPE_CHECKING:
    from .permission_axis_gate import AxisResolution

__all__ = [
    "ConfigProfiles",
    "configured_axis_resolution",
    "configured_config_profiles",
    "configured_selected_profile",
    "load_config_profiles",
    "resolve_profile_axis",
    "select_profile",
]

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ConfigProfiles:
    """一份 config profiles 文档的读取结果(``profiles`` 为空 = 没有可用档案)。"""

    selected: str | None = None
    profiles: Mapping[str, object] = field(default_factory=dict)
    parse_error: str | None = None


def _profile_name(raw: object) -> str | None:
    """档案名归一:非字符串/空白 ⇒ None(不是空字符串档案)。"""
    if not isinstance(raw, str):
        return None
    name = raw.strip()
    return name or None


def _as_document(raw: object) -> tuple[dict[str, Any] | None, str | None]:
    """原文 → 顶层映射;空值返回 ``(None, None)``,解析失败返回 ``(None, 原因)``。"""
    if raw is None:
        return None, None
    if isinstance(raw, Mapping):
        return {str(k): v for k, v in raw.items()}, None
    if not isinstance(raw, str):
        return None, f"config_profiles 须为 JSON/TOML 文本或映射,实际 {type(raw).__name__}"
    text = raw.strip()
    if not text:
        return None, None
    try:
        # 以可见首字符区分两族:对象 ⇒ JSON,其余按 TOML(``[profiles.NAME]``)。
        parsed: object = json.loads(text) if text.startswith("{") else tomllib.loads(text)
    except (ValueError, TypeError) as exc:
        # json.JSONDecodeError / tomllib.TOMLDecodeError 都是 ValueError 子类。
        return None, f"配置文档解析失败: {exc}"
    if not isinstance(parsed, Mapping):
        return None, "配置文档顶层须为表/对象"
    return {str(k): v for k, v in parsed.items()}, None


def load_config_profiles(raw: object = None, selected: object = None) -> ConfigProfiles:
    """解析 (CONFIG_PROFILES, CONFIG_PROFILE) → :class:`ConfigProfiles`。

    解析失败不抛异常:配置面坏文本不该让请求 500/400,调用方按"没有档案"处理。
    """
    doc, error = _as_document(raw)
    if doc is None:
        if error is not None:
            logger.warning("[config-profiles] %s;按未配置处理", error)
        return ConfigProfiles(parse_error=error)

    profiles: dict[str, object] = {}
    raw_profiles = doc.get("profiles")
    if isinstance(raw_profiles, Mapping):
        for name, profile in raw_profiles.items():
            key = _profile_name(name)
            if key is not None:
                profiles[key] = profile
    elif raw_profiles is not None and error is None:
        error = "profiles 段须为表/对象"

    name = _profile_name(selected) or _profile_name(doc.get("profile"))
    if error is not None:
        logger.warning("[config-profiles] %s;按未配置处理", error)
    return ConfigProfiles(selected=name, profiles=profiles, parse_error=error)


def select_profile(
    config: ConfigProfiles, name: object = None
) -> tuple[str, object] | None:
    """选档:显式 name > 文档顶层 profile > 无;选中但不存在 ⇒ None + warning。"""
    wanted = _profile_name(name) or config.selected
    if wanted is None:
        return None
    if wanted not in config.profiles:
        logger.warning(
            "[config-profiles] 选中的档案 %r 不存在(已配置: %s),按未指定处理",
            wanted,
            sorted(config.profiles) or "无",
        )
        return None
    return wanted, config.profiles[wanted]


def resolve_profile_axis(
    config: ConfigProfiles, name: object = None
) -> tuple[str | None, str | None] | None:
    """选中的档案 → 双轴取值对;无档/非法 ⇒ None(调用方整段跳过)。"""
    picked = select_profile(config, name)
    if picked is None:
        return None
    profile_name, profile = picked
    pair = resolve_config_profile_axis(profile)
    if pair is None:
        logger.warning(
            "[config-profiles] 档案 %r 的轴取值认不出(sandbox_mode/approval_policy),整段丢弃",
            profile_name,
        )
    return pair


def configured_config_profiles() -> ConfigProfiles:
    """读 ``core/config.py`` 的 Settings(唯一配置来源,不另造设置仓库)。

    Settings 是 pydantic 对象且进程内单例;每次现读而不缓存,配置热更新/测试替换
    都能立刻生效(解析成本是一次 JSON/TOML loads,远低于一次工具调用)。
    """
    from .config import settings

    return load_config_profiles(
        getattr(settings, "config_profiles", ""),
        getattr(settings, "config_profile", ""),
    )


def configured_selected_profile() -> tuple[str, object] | None:
    """当前进程配置下的选中档案;没有/不存在 ⇒ None。"""
    return select_profile(configured_config_profiles())


def configured_axis_resolution() -> AxisResolution | None:
    """当前进程配置下的双轴解析结果;无有效档案 ⇒ None(整段跳过,零行为变化)。"""
    from .permission_axis_gate import resolve_axis_resolution

    picked = configured_selected_profile()
    if picked is None:
        return None
    profile_name, profile = picked
    pair = resolve_config_profile_axis(profile)
    if pair is None:
        logger.warning(
            "[config-profiles] 档案 %r 的轴取值认不出(sandbox_mode/approval_policy),整段丢弃",
            profile_name,
        )
        return None
    if pair == (None, None):
        # 只声明 model 等非轴键的档案:没有可生效的轴,不构造一个"两轴皆空"的决议。
        return None
    return resolve_axis_resolution(profile=profile, profile_name=profile_name)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
