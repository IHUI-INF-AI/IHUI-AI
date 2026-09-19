# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""集中式特性开关注册表(2026-09-19 第二十四批,对标 Codex features crate)。

语义忠实移植:
- Stage 分阶段:stable / experimental / dev(实验特性带菜单名与公告文案槽)
- FeatureRegistry:集中注册所有特性 + 元数据,不允许散落硬编码
- resolve_features:生效集解析链 = 默认值 ← 配置覆盖 ← 环境变量
  (IHUI_FEATURE_<NAME>=1/0),与 codex 「config-like inputs 解析顺序」一致
- legacy 别名:旧配置键自动映射到新特性名(对标 codex legacy.rs)
- 未知覆盖/非法取值:显式报错列出合法名字(不静默吞掉,配置错误要可诊断)

取舍:codex 的 Stage 携带 TUI 实验菜单文案;我方保留菜单名/描述/公告三个
文案槽字段,供宿主 UI 直接消费。
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Literal

Stage = Literal["stable", "experimental", "dev"]

_ENV_PREFIX = "IHUI_FEATURE_"
_ENV_RE = re.compile(r"[^A-Z0-9_]+")


@dataclass(frozen=True)
class FeatureSpec:
    """单个特性的注册元数据。"""

    key: str
    stage: Stage
    default: bool
    description: str = ""
    experimental_menu_name: str | None = None
    experimental_menu_description: str | None = None
    experimental_announcement: str | None = None

    def validate(self) -> None:
        if self.stage == "experimental" and self.experimental_menu_name is None:
            raise ValueError(
                f"experimental 特性 {self.key} 必须提供 experimental_menu_name"
            )


class FeatureRegistry:
    """特性注册表:注册 + 生效集解析 + legacy 别名归一。"""

    def __init__(self) -> None:
        self._specs: dict[str, FeatureSpec] = {}
        self._legacy_aliases: dict[str, str] = {}  # 旧键 → 新 key

    def register(self, spec: FeatureSpec, *, legacy_keys: tuple[str, ...] = ()) -> None:
        spec.validate()
        if spec.key in self._specs:
            raise ValueError(f"特性重复注册: {spec.key}")
        self._specs[spec.key] = spec
        for old in legacy_keys:
            self._legacy_aliases[old] = spec.key

    def normalize_override_key(self, key: str) -> str:
        """覆盖键归一:legacy 别名映射;未知键原样返回(由 resolve 报错)。"""
        return self._legacy_aliases.get(key, key)

    def resolve_features(
        self,
        overrides: dict[str, bool] | None = None,
        *,
        env: dict[str, str] | None = None,
        include_disabled: bool = True,
    ) -> dict[str, bool]:
        """解析生效集:默认值 ← overrides ← 环境变量(后写优先)。

        env 缺省读真实环境;键形如 IHUI_FEATURE_<大写名>,值 1/true/on 与
        0/false/off。未知覆盖键、legacy 之外的非法名、非法取值一律 ValueError。
        """
        effective = {k: s.default for k, s in self._specs.items()}
        env_map = dict(os.environ if env is None else env)

        normalized_overrides = (
            {self.normalize_override_key(k): v for k, v in overrides.items()}
            if overrides
            else {}
        )
        for key, value in normalized_overrides.items():
            if key not in self._specs:
                known = ", ".join(sorted(self._specs))
                raise ValueError(f"未知特性覆盖: {key} (可用: {known})")
            effective[key] = bool(value)

        for env_key, raw in env_map.items():
            if not env_key.startswith(_ENV_PREFIX):
                continue
            name = env_key[len(_ENV_PREFIX):].lower()
            if not name:
                continue
            if name not in self._specs:
                known = ", ".join(sorted(self._specs))
                raise ValueError(
                    f"环境变量 {env_key} 指向未注册特性 {name} (可用: {known})"
                )
            effective[name] = _parse_bool_env(env_key, raw)

        if not include_disabled:
            return {k: v for k, v in effective.items() if v}
        return effective

    def spec(self, key: str) -> FeatureSpec:
        return self._specs[key]

    def keys(self) -> list[str]:
        return sorted(self._specs)

    def by_stage(self, stage: Stage) -> list[FeatureSpec]:
        return [s for s in self._specs.values() if s.stage == stage]


def _parse_bool_env(env_key: str, raw: str) -> bool:
    value = raw.strip().lower()
    if value in {"1", "true", "on", "yes"}:
        return True
    if value in {"0", "false", "off", "no", ""}:
        return False
    raise ValueError(f"环境变量 {env_key} 取值非法: {raw!r} (期望 1/0/true/false/on/off)")


def env_key_for(feature_key: str) -> str:
    """特性 key 对应的环境变量名。"""
    return _ENV_PREFIX + _ENV_RE.sub("_", feature_key.upper())
