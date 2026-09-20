# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""推理努力档位钉扎(ReasoningEffortPin)——对标 codex state/session.rs ReasoningEffortPin
+ session/reasoning_effort.rs(2026-09-20 批58十二)。

codex 语义忠实移植:

- 三态枚举:Unset(未建立)/Compacted(压缩退役,允许新基线)/Active{model, effort}(钉扎生效)。
- get(model):仅同模型命中返回 effort;Unset/Compacted/异模型 Active → None。
- pin(model, effort):同模型已钉 → 粘滞返回既有值(不覆盖);否则建立钉扎。
  "Sampling can establish a pin"——采样请求可建立钉扎,压缩请求不得改变活状态。
- 请求档位解析 reasoning_effort_for_request(usage: Sampling|Compaction):
  ①override 未启用 → 直接返回选定档位(透传面与现状逐零差异);
  ②Compaction 且钉扎同模型命中 → 返回钉扎值(压缩/fallback 模型查找不改动活钉扎);
  ③Sampling 无有效档位 → 钉扎重置 Unset,返回选定档位;
  ④Sampling 有档位 → pin() 粘滞建立并返回(压缩成功前活状态不变,由调用方退役)。
- 有效档位判定 effort_for_configuration_update(codex 门槛的 ihui 等价):
  codex 三道门(re override 开关 + use_responses_lite + is_openai)在 ihui 对应
  单一总开关 + 模型白名单;档位须在已知后端模式内(Codex: 持久态归一化为
  "disabled",未知 Custom 值不入持久更新——注入项须有界于已知后端模式)。
- 覆盖项记录(record_reasoning_effort_override,可选 attach 通道):
  钉扎尾更新与既有尾更新一致 → 跳过(不追加相邻重复更新);Compacted 态允许
  无更新重钉(codex: "Only successful compaction allows the request baseline
  to establish the selection without another update")。
- 压缩成功退役:retire_on_compaction() → 状态置 Compacted(允许新窗新基线);
  codex 在 replace_annotated_history(HistoryReplacement::Compaction) 内联执行。

红线的忠实映射:
- "Failed compaction and fallback-model lookups must not mutate the live pin"——
  Compaction 分支永不写状态。
- "Recovery adds no user message; reuse a matching trusted tail update"——
  覆盖项判定看尾项一致性,不盲目追加。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

__all__ = [
    "RequestEffortUsage",
    "ReasoningEffortPin",
    "ReasoningEffortPinState",
    "reasoning_effort_for_request",
]


class RequestEffortUsage(Enum):
    """Sampling 可建立钉扎;Compaction 不得在成功前改变活状态(codex 语义)。"""

    SAMPLING = "sampling"
    COMPACTION = "compaction"


@dataclass
class ReasoningEffortPinState:
    """三态钉扎状态机(Unset/Compacted/Active{model, effort})。

    对标 codex ReasoningEffortPin 枚举:Active 携带 model+effort,其余两态无载荷。
    """

    model: str | None = None
    effort: str | None = None
    compacted: bool = False

    def get(self, model: str) -> str | None:
        """仅同模型命中返回钉扎值;Unset/Compacted/异模型 → None。"""
        if self.compacted or self.model is None or self.effort is None:
            return None
        return self.effort if self.model == model else None

    def pin(self, model: str, effort: str) -> str:
        """粘滞建立:同模型已钉返回既有值;否则(含 Compacted/异模型/Unset)建立。"""
        pinned = self.get(model)
        if pinned is not None:
            return pinned
        self.model = model
        self.effort = effort
        self.compacted = False
        return effort

    def reset_unset(self) -> None:
        """Sampling 无有效档位 → Unset(codex reasoning_effort.rs L120)。"""
        self.model = None
        self.effort = None
        self.compacted = False

    def retire_to_compacted(self) -> None:
        """压缩成功退役 → Compacted:允许新窗请求基线重建(codex mod.rs L4070)。"""
        self.model = None
        self.effort = None
        self.compacted = True


@dataclass
class ReasoningEffortPin:
    """请求档位解析器:总开关 + 模型白名单 + 已知档位集 + 钉扎状态。

    对标 codex effort_for_configuration_update 三道门:
    - override_enabled ← services.model_client.reasoning_effort_override_enabled()
    - 模型门 ← model_info.use_responses_lite && provider.is_openai()(ihui: 白名单)
    - 档位门 ← 已知后端模式(未知 Custom 值不入持久更新,注入项有界)
    """

    override_enabled: bool = False
    allowed_models: frozenset[str] = frozenset()
    known_efforts: frozenset[str] = frozenset({"minimal", "low", "medium", "high"})
    state: ReasoningEffortPinState = field(default_factory=ReasoningEffortPinState)

    def effort_for_configuration_update(self, model: str, selected_effort: str | None) -> str | None:
        """有效档位判定:三道门任一不满足 → None(不建立覆盖/不参与钉扎)。"""
        if not self.override_enabled:
            return None
        if model not in self.allowed_models:
            return None
        if selected_effort is None:
            return None
        if selected_effort not in self.known_efforts:
            # codex: Persistent normalizes to "disabled"; keep unknown custom
            # values out of durable updates (injected items stay bounded).
            return None
        return selected_effort

    def reasoning_effort_for_request(
        self,
        model: str,
        selected_effort: str | None,
        usage: RequestEffortUsage,
    ) -> str | None:
        """Sampling 与 Compaction 共享本上下文窗的请求档位(codex 逐语义)。

        - override 未启用:返回选定档位(透传面零差异)。
        - Compaction 且钉扎同模型命中:返回钉扎值,fallback 模型查找不改活钉扎。
        - Sampling 无有效档位:钉扎重置 Unset。
        - Sampling 有有效档位:pin() 粘滞建立并返回。
        - Compaction 无钉扎命中:仅解析有效档位返回,**绝不写状态**。
        """
        if not self.override_enabled:
            return selected_effort
        pinned = self.state.get(model)
        if usage is RequestEffortUsage.COMPACTION and pinned is not None:
            return pinned
        effort = self.effort_for_configuration_update(model, selected_effort)
        if effort is None:
            if usage is RequestEffortUsage.SAMPLING:
                self.state.reset_unset()
            return selected_effort
        if usage is RequestEffortUsage.SAMPLING:
            return self.state.pin(model, effort)
        # Compaction: failed compaction / fallback lookups must not mutate the pin.
        return effort

    def record_reasoning_effort_override(
        self,
        model: str,
        selected_effort: str | None,
        latest_override: tuple[int, str] | None,
    ) -> str | None:
        """覆盖项记录判定(codex record_reasoning_effort_override 的纯判定面)。

        - Compacted 态:请求基线可无更新直接重钉(codex L34-40)。
        - 尾项一致跳过:index==0 且档位一致(恢复重放复用,不追加相邻重复)——或
          钉扎值与最近覆盖一致。
        - 否则返回应记录的档位(调用方负责写入带 harness_authored_configuration
          标注的历史项;ihui 侧以 developer 配置项承载)。
        """
        effort = self.effort_for_configuration_update(model, selected_effort)
        if effort is None:
            return None
        if self.state.compacted:
            self.state.pin(model, effort)
        established = latest_override[1] if latest_override is not None else None
        if latest_override is not None and latest_override[0] == 0 and established == effort:
            return None
        pinned = self.state.get(model)
        reference = established if established is not None else pinned
        if reference == effort and pinned is not None:
            return None
        self.state.pin(model, effort)
        return effort

    def retire_on_compaction(self) -> None:
        """压缩成功 → 退役为 Compacted(对标 mod.rs 压缩落账内联执行点)。"""
        self.state.retire_to_compacted()


def reasoning_effort_for_request(
    pin: ReasoningEffortPin,
    model: str,
    selected_effort: str | None,
    usage: RequestEffortUsage | str,
) -> str | None:
    """模块级便捷入口;usage 接受枚举或 "sampling"/"compaction" 字符串。"""
    resolved = (
        usage
        if isinstance(usage, RequestEffortUsage)
        else RequestEffortUsage(str(usage).lower())
    )
    return pin.reasoning_effort_for_request(model, selected_effort, resolved)
