"""Phase 11 建议 4: LLM 告警摘要 (OpenAI 兼容 API).

目的:
  把 alertmanager 大量告警压缩为 1-2 句中文摘要,
  通过 OpenAI 兼容 API (gpt-4o / claude-3.5 / qwen / deepseek) 实现.

用法:
  from alert_llm_summary import summarize_alert
  summary = summarize_alert({
      "alertname": "HighErrorRate",
      "severity": "critical",
      "service": "zhs-platform-api",
      "summary": "5xx 错误率 12% (>5% 阈值)",
      "labels": {"region": "cn-east-1", "tenant": "tenant_alpha"},
  })
  # → "cn-east-1 region 的 zhs-platform-api 5xx 错误率突增至 12%, 触发严重告警..."

环境变量:
  ZHS_LLM_API_BASE   OpenAI 兼容 endpoint, 如 https://api.openai.com/v1
  ZHS_LLM_API_KEY    API key
  ZHS_LLM_MODEL      模型名, 默认 gpt-4o-mini
  ZHS_LLM_MOCK=1     强制 mock 模式, 不调真 API

支持 mock 模式 (无 API key 时自动启用):
  返回固定模板生成的摘要, 用于本地测试/CI.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

# ---------------------------------------------------------------------------
# 1. Prompt 模板
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """你是 ZHS-Platform 的告警摘要助手.
你的任务: 把 1 条告警压缩成 1 句 30 字以内的中文摘要, 包含:
1. 哪个服务/region 出问题
2. 出了什么问题 (一句话讲清楚)
3. 严重程度 (critical/warning/info)

要求:
- 简洁直接, 不要废话
- 用中文
- 30 字以内
- 不要复述 labels, 只说关键信息
- 末尾标注建议处理方向 (排查/扩容/回滚)
"""


def build_user_prompt(alert: dict[str, Any]) -> str:
    """构造 user prompt."""
    parts = [f"alertname: {alert.get('alertname', 'unknown')}"]
    if "severity" in alert:
        parts.append(f"severity: {alert['severity']}")
    if "service" in alert:
        parts.append(f"service: {alert['service']}")
    if "summary" in alert:
        parts.append(f"summary: {alert['summary']}")
    if "region" in alert.get("labels", {}):
        parts.append(f"region: {alert['labels']['region']}")
    if "tenant" in alert.get("labels", {}):
        parts.append(f"tenant: {alert['labels']['tenant']}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# 2. Mock 摘要器
# ---------------------------------------------------------------------------

MOCK_TEMPLATES = {
    "HighErrorRate": "{service} 5xx 错误率 {severity}, region={region}, 建议排查上游依赖",
    "HighLatency": "{service} P99 延迟突增, region={region}, 建议排查慢查询/下游",
    "DiskSpaceLow": "{service} 磁盘空间不足, region={region}, 建议扩容或清理",
    "PodCrashLooping": "{service} Pod 反复重启, region={region}, 建议查看 logs",
    "Default": "{alertname} 触发 {severity} 告警, service={service} region={region}, 建议排查",
}


def _mock_summary(alert: dict[str, Any]) -> str:
    """Mock 模式: 用模板生成摘要."""
    alertname = alert.get("alertname", "Unknown")
    template = MOCK_TEMPLATES.get(alertname, MOCK_TEMPLATES["Default"])
    labels = alert.get("labels", {})
    return template.format(
        alertname=alertname,
        service=alert.get("service", labels.get("service", "unknown")),
        severity=alert.get("severity", "warning"),
        region=labels.get("region", "unknown"),
    )


# ---------------------------------------------------------------------------
# 3. 真 LLM 调用
# ---------------------------------------------------------------------------


def _call_openai_compatible(api_base: str, api_key: str, model: str, system: str, user: str, timeout: int = 10) -> str:
    """调用 OpenAI 兼容 /chat/completions 端点."""
    url = api_base.rstrip("/") + "/chat/completions"
    payload = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": 100,
            "temperature": 0.3,
        }
    ).encode("utf-8")
    req = urlrequest.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urlrequest.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError) as e:
        raise RuntimeError(f"LLM API 调用失败: {e}") from e
    choices = body.get("choices", [])
    if not choices:
        raise RuntimeError(f"LLM 返回空 choices: {body}")
    return str(choices[0].get("message", {}).get("content", "")).strip()


# ---------------------------------------------------------------------------
# 4. 公开 API
# ---------------------------------------------------------------------------


def summarize_alert(alert: dict[str, Any], *, force_mock: bool = False) -> str:
    """生成告警摘要.

    Args:
        alert: 告警 dict, 必含 alertname, 推荐含 severity/service/summary/labels
        force_mock: 强制 mock (测试用)

    Returns:
        中文摘要字符串
    """
    user_prompt = build_user_prompt(alert)
    use_mock = force_mock or os.environ.get("ZHS_LLM_MOCK") == "1" or not os.environ.get("ZHS_LLM_API_KEY")
    if use_mock:
        return _mock_summary(alert)
    api_base = os.environ.get("ZHS_LLM_API_BASE", "https://api.openai.com/v1")
    api_key = os.environ["ZHS_LLM_API_KEY"]
    model = os.environ.get("ZHS_LLM_MODEL", "gpt-4o-mini")
    return _call_openai_compatible(api_base, api_key, model, SYSTEM_PROMPT, user_prompt)


def summarize_batch(alerts: list[dict[str, Any]], *, force_mock: bool = False) -> list[str]:
    """批量生成摘要, 按输入顺序返回."""
    return [summarize_alert(a, force_mock=force_mock) for a in alerts]


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def main() -> int:
    """CLI 入口: 从 stdin 读 JSON 数组, 输出每行一个 {alertname, summary}.

    无 stdin / 解析失败 → 用 demo 数据演示.
    """
    p = None
    if not sys.stdin.isatty():
        raw = sys.stdin.read() or ""
        raw = raw.strip()
        if raw:
            try:
                p = json.loads(raw)
            except json.JSONDecodeError:
                p = None
    if p is None:
        # demo
        p = [
            {
                "alertname": "HighErrorRate",
                "severity": "critical",
                "service": "zhs-platform-api",
                "summary": "5xx 错误率 12%",
                "labels": {"region": "cn-east-1", "tenant": "tenant_alpha"},
            }
        ]
    for alert in p:
        s = summarize_alert(alert)
        print(json.dumps({"alertname": alert.get("alertname"), "summary": s}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
