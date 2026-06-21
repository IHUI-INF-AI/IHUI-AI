"""抑制规则 Playground API (建议 150) - app/api/v1/monitor/inhibition_playground.py.

端点:
  POST /monitor/inhibition/dry-run  - 接收任意告警 + 任意抑制规则, 模拟应用并返回结果

设计:
  - 让运维在生产前临时修改抑制规则, 先 dry-run 验证效果
  - 规则 / 告警均接受 JSON (alertmanager YAML 的 JSON 等价格式)
  - 不修改全局默认 inhibitor, 纯函数计算
  - 接收 use_default_presets=true 时叠加 ZHS 平台预设规则

请求格式:
    {
      "alerts": [
        {"status": "firing", "labels": {"alertname": "X", "severity": "critical"}},
        ...
      ],
      "rules": [
        {
          "name": "my-rule",
          "source_match": {"alertname": "X", "severity": "critical"},
          "target_match": {"severity": "warning"},
          "equal": ["service"]
        }
      ],
      "use_default_presets": false
    }

响应格式:
    {
      "ok": true,
      "data": {
        "total_alerts": N,
        "surviving_count": K,
        "suppressed_count": M,
        "surviving": [...],
        "suppressed": [{"alert": {...}, "inhibited_by_rule": "my-rule"}],
        "rules_used": N,
        "rules_source": "custom" | "presets" | "custom+presets"
      }
    }
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.alert_inhibition import (
    ZHS_INHIBITION_PRESETS,
    AlertInhibitor,
    InhibitionRule,
)
from app.security import require_login

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class AlertIn(BaseModel):
    """输入告警 (简化: 只要 status + labels)."""

    status: str = Field("firing", description="firing / resolved")
    labels: dict = Field(default_factory=dict, description="告警 labels")
    annotations: dict | None = Field(None, description="可选 annotations")


class RuleSpec(BaseModel):
    """单条抑制规则 (alertmanager YAML JSON 等价)."""

    name: str = Field("", description="规则名 (可空, 便于日志)")
    source_match: dict = Field(default_factory=dict, description="source 侧 matchers (AND)")
    target_match: dict = Field(default_factory=dict, description="target 侧 matchers (AND)")
    equal: list[str] | None = Field(None, description="equal 字段列表, None=alertname")


class PlaygroundRequest(BaseModel):
    alerts: list[AlertIn] = Field(..., description="待测告警列表")
    rules: list[RuleSpec] = Field(default_factory=list, description="自定义规则 (可选)")
    use_default_presets: bool = Field(False, description="叠加 ZHS 平台预设规则")


class ApiResponse(BaseModel):
    ok: bool = True
    data: dict = {}


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def _rule_from_spec(spec: RuleSpec) -> InhibitionRule:
    """把 RuleSpec 转 InhibitionRule."""
    return InhibitionRule(
        name=spec.name or "",
        source_matchers=dict(spec.source_match),
        target_matchers=dict(spec.target_match),
        equal=list(spec.equal) if spec.equal is not None else None,
    )


def _build_inhibitor(req: PlaygroundRequest) -> tuple[AlertInhibitor, str]:
    """根据请求构造 inhibitor, 返回 (inhibitor, rules_source)."""
    rules: list[InhibitionRule] = []
    sources: list[str] = []
    if req.use_default_presets:
        rules.extend(ZHS_INHIBITION_PRESETS)
        sources.append("presets")
    if req.rules:
        rules.extend(_rule_from_spec(r) for r in req.rules)
        sources.append("custom")
    if not rules:
        # 空规则: 仍用空 inhibitor, 不会抑制
        return AlertInhibitor([]), "none"
    return AlertInhibitor(rules), "+".join(sources) if sources else "none"


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.post("/inhibition/dry-run", response_model=ApiResponse, tags=["Monitor: Inhibition Playground"])
def inhibition_dry_run(req: PlaygroundRequest, _user: str = Depends(require_login)):
    """抑制规则 playground (建议 150).

    给定任意告警 + 任意抑制规则, 返回哪些会被抑制 / 命中哪条规则.
    不修改全局默认 inhibitor, 不影响生产告警通路.
    """
    inhibitor, source = _build_inhibitor(req)
    alerts_list = [a.model_dump() for a in req.alerts]
    # classify 返回完整信息 (surviving + suppressed + 命中规则)
    result = inhibitor.classify(alerts_list)
    return ApiResponse(
        ok=True,
        data={
            "total_alerts": len(alerts_list),
            "surviving_count": len(result["surviving"]),
            "suppressed_count": result["suppressed_count"],
            "surviving": result["surviving"],
            "suppressed": result["suppressed"],
            "rules_used": len(inhibitor.rules),
            "rules_source": source,
        },
    )


@router.get("/inhibition/presets", response_model=ApiResponse, tags=["Monitor: Inhibition Playground"])
def list_presets(_user: str = Depends(require_login)):
    """列出 ZHS 平台预设抑制规则 (用于 playground 调试参考)."""

    items = [
        {
            "name": r.name,
            "source_match": r.source_matchers,
            "target_match": r.target_matchers,
            "equal": r.equal,
        }
        for r in ZHS_INHIBITION_PRESETS
    ]
    return ApiResponse(ok=True, data={"count": len(items), "presets": items})
