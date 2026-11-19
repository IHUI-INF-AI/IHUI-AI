# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""流级告警的生产点(2026-11-13 立,D155 收编)。

## 立此模块的因由

D155(2026-09-29)定了三档下行告警 `config-warning` / `deprecation-notice` /
`guardian-warning`。契约段、api-client 的三份解析器、web 的 `stream-alerts.ts` 落点
**全都在位**,唯独**服务端从未落生产点** —— 台账 `no-stream-alert-producer` 记的
「`git grep -lE ... apps/ai-service apps/api` 命中 0 文件」是实测事实。
结果是:三档告警在协议里存在、在客户端有消费声明、**帧永远不来**。
这正是本仓反复禁止的「只加枚举不接线」。

本模块补上生产点,但**只补真正配得上生产的那一档**。三档逐一取证后的结论如下。

## 三档的取证结论(每条都是实测,不是推演)

### ① `deprecation-notice` —— ✅ 已接线(本模块唯一生产的一档)

判据来自**仓内已有的真实数据源**:上游厂商 `/v1/models` 下发的 `deprecation_date`,
由 `ModelSyncService` 每 6 小时落库到 `ai_model_config_models.deprecation_date`
(列定义见 `packages/database/src/schema/ai-config.ts:186`,varchar(32))。

**这个字段此前只写不读** —— `llm.py::build_model_catalog` 的 SELECT 长期没带这一列,
于是"厂商已宣布某模型何时下线"这个事实在服务端完全不可见。用户在用一个厂商已宣布
下线的模型,界面上一切正常,直到某天它突然 404。这是典型的「有用户后果、且没有
别的通道告知」,生产点已经落在 `llm.py` 的流首。

### ② `config-warning` —— ❌ 不接线(缺的不是接线,是判定点)

原本设想的判据是「模型池里有价格未知的模型」。**实测该判据永不触发**:
`data/default_models.json` 的 100 个模型里 `input_price` 缺失数 = **0**。
同理 `classify_model(...).tier is LEGACY`(也曾在候选里)在该清单上命中 = **0**
(清单无 `release_date` 字段,100 个模型全不为 LEGACY)。接上去就是一条永不执行的
死分支 + 一堆没人读的内存键。

真正有用户后果的"配置被覆盖"事故事实上发生在**启动期**(env 覆盖了 DB 里的
base_url),而那一类问题的正确处理是 **fail-fast 拒启**(把安全性换成可见性是错),
不是降级成一条用户看不懂的告警条。

**⇒ 本档缺的是一个配得上告警而非拒启的判定点。在那之前不产帧。**
发一条永不触发的分支,和没有这条分支在用户侧完全等价,却会让台账误以为三档齐备。

### ③ `guardian-warning` —— ❌ 不接线(同一事实已有承载通道)

guardian 复核的"未复核"态(reviewer 不可用 / 超时 / 响应非法)确实有用户后果,
但它**已经有承载通道**:`agent_loop_v2.py:6662` 的 `request_guardian_review` 结果
随 `tool.approval` 事件下发(`GuardianReviewResult.to_event_payload`),用户在审批
弹窗里直接看见 `unavailable_reason`。

再发一条 guardian-warning 是同一事实的**第二条通道** —— 用户会以为发生了两件事。
本仓纪律:同一事实只走一条通道。**⇒ 主对话流不接。**

## 纪律

- **不误报**:条件不成立时**一帧不发**(不是发个"没问题"的帧);
- **不改写主链路**:构造/查询失败一律降级为日志,绝不影响回答本身;
- **措辞归前端**:本模块只给结构化事实(`severity` / `message` / 可选标识),
  界面文案由各端词包取 —— 与 `hook-failures` 同一条分工纪律。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from typing import Any

# 与 packages/api-client 的 AlertSeverity 同值域('info' | 'warning' | 'critical')
ALERT_SEVERITIES = ("info", "warning", "critical")
DEFAULT_SEVERITY = "warning"

# 弃用预告的提前量:距 sunset 还有这么久以内才提醒。
# 为什么不是"只要填了 deprecation_date 就报":厂商可能在元数据里预填一年后的日期,
# 那对当下毫无意义,天天弹一条只会让人忽略全部告警(告警疲劳 = 等于没有告警)。
# 30 天是"还来得及换模型"的量级:足够做一次迁移,又不至于提前半年打扰。
DEPRECATION_LEAD_DAYS = 30


@dataclass(frozen=True)
class StreamAlert:
    """一档告警的载荷(**不含** type 字段,由调用方的 `_sse()` 按帧名补齐)。"""

    severity: str
    message: str
    # 该档的专属可选项
    extras: dict[str, Any] = field(default_factory=dict)

    def payload(self) -> dict[str, Any]:
        """展开成 wire 载荷:severity + message + 该档可选项。"""
        out: dict[str, Any] = {
            "severity": self.severity if self.severity in ALERT_SEVERITIES else DEFAULT_SEVERITY,
            "message": self.message,
        }
        out.update(self.extras)
        return out


def _clip(text: str, limit: int = 200) -> str:
    """告警文案要能进一行提示条;超长截断并标省略号(不静默截半句)。"""
    s = str(text or "").strip()
    return s if len(s) <= limit else s[: limit - 1] + "…"


def _parse_deprecation_date(raw: Any) -> date | None:
    """解析厂商下发的 deprecation_date。

    实测该列是 varchar(32),上游形态不统一,已见过的写法都要能认:
    `2026-12-01`(ISO 日期)、`2026-12-01T00:00:00Z`(带时刻)、`2026/12/01`。
    认不出 ⇒ 返回 None 且**不告警** —— 解析失败不等于"没有弃用计划",
    但也不等于"即将弃用";在没有事实的情况下发告警就是误报。
    """
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    s = str(raw).strip()
    if not s:
        return None
    # 先剥掉时刻部分(含 'T' 或空格分隔),只看日期
    head = s.replace("/", "-").split("T", 1)[0].split(" ", 1)[0]
    try:
        return date.fromisoformat(head)
    except ValueError:
        return None


def build_deprecation_notice(
    model_id: str,
    *,
    deprecation_date: Any = None,
    alternative: str | None = None,
    now: date | None = None,
) -> StreamAlert | None:
    """厂商已宣布下线、且已进入提醒窗口 ⇒ 一条弃用预告;否则 None(一帧不发)。

    三档判定逐条收紧,**任一条不成立都静默**:
      ① `deprecation_date` 能解析(认不出 ⇒ 无事实,不报);
      ② 尚未过期(`sunset >= today`;已过期说明该模型当下就该 404,属另一个问题);
      ③ 距 sunset ≤ `DEPRECATION_LEAD_DAYS`(太远提醒 = 噪音)。

    `model_id` 为空 ⇒ None。载荷的 `capability` 字段沿用契约里的命名
    (api-client 的 `DeprecationNoticeEvent.capability`),值即模型 id ——
    三档共用这套可选键,不新增字段名(改契约要两端同批,不在本票射程)。
    """
    mid = str(model_id or "").strip()
    if not mid:
        return None
    sunset = _parse_deprecation_date(deprecation_date)
    if sunset is None:
        return None
    today = now or datetime.now(UTC).date()
    remaining = (sunset - today).days
    if remaining < 0:
        # 已过期:该模型现在就该不可用,属"能力缺失"而非"预告",不在这里报。
        return None
    if remaining > DEPRECATION_LEAD_DAYS:
        return None
    extras: dict[str, Any] = {
        "capability": mid,
        # 契约里 sunsetAt 是字符串,原样给 ISO 日期,前端自己决定怎么显示
        "sunsetAt": sunset.isoformat(),
    }
    if alternative:
        alt = str(alternative).strip()
        if alt:
            extras["alternative"] = alt
    when = "今天" if remaining == 0 else f"{remaining} 天后"
    return StreamAlert(
        severity=DEFAULT_SEVERITY,
        message=_clip(f"当前模型 {mid} 将于{when}({sunset.isoformat()})停止服务"),
        extras=extras,
    )


__all__ = [
    "ALERT_SEVERITIES",
    "DEFAULT_SEVERITY",
    "DEPRECATION_LEAD_DAYS",
    "StreamAlert",
    "build_deprecation_notice",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
