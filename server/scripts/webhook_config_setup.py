"""真实生产 webhook 接入配置脚本.

8 通道配置模板生成 + 校验 + 演练前置检查:
1. 生成 .env.alert.example 模板
2. 校验当前 .env 是否完整
3. 输出缺失项报告
4. 演练前置: 测试每个 URL 可达性 (不实际推送)

用法:
    python scripts/webhook_config_setup.py --generate  # 生成模板
    python scripts/webhook_config_setup.py --check     # 校验
    python scripts/webhook_config_setup.py --probe     # 测试 URL 可达
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = SERVER_ROOT / ".env.alert.example"
PROBE_RESULTS = SERVER_ROOT / "webhook_probe.json"

# 8 通道配置项
CHANNELS = [
    {
        "name": "dingtalk",
        "label": "钉钉",
        "env_var": "DINGTALK_WEBHOOK",
        "url_pattern": r"^https://oapi\.dingtalk\.com/robot/send\?access_token=.+$",
        "required": True,
        "method": "POST",
        "test_payload": {"msgtype": "text", "text": {"content": "webhook 配置测试"}},
    },
    {
        "name": "wechat_work",
        "label": "微信企业版",
        "env_var": "WECHAT_WORK_WEBHOOK",
        "url_pattern": r"^https://qyapi\.weixin\.qq\.com/cgi-bin/webhook/send\?key=.+$",
        "required": True,
        "method": "POST",
        "test_payload": {"msgtype": "text", "text": {"content": "webhook 配置测试"}},
    },
    {
        "name": "feishu",
        "label": "飞书",
        "env_var": "FEISHU_WEBHOOK",
        "url_pattern": r"^https://open\.feishu\.cn/open-apis/bot/v2/hook/.+$",
        "required": True,
        "method": "POST",
        "test_payload": {"msg_type": "text", "content": {"text": "webhook 配置测试"}},
    },
    {
        "name": "slack",
        "label": "Slack",
        "env_var": "SLACK_WEBHOOK",
        "url_pattern": r"^https://hooks\.slack\.com/services/.+$",
        "required": False,
        "method": "POST",
        "test_payload": {"text": "webhook 配置测试"},
    },
    {
        "name": "teams",
        "label": "Teams",
        "env_var": "TEAMS_WEBHOOK",
        "url_pattern": r"^https://.*\.webhook\.office\.com/webhookb2/.+$",
        "required": False,
        "method": "POST",
        "test_payload": {"text": "webhook 配置测试"},
    },
    {
        "name": "pagerduty",
        "label": "PagerDuty",
        "env_var": "PAGERDUTY_INTEGRATION_KEY",
        "url_pattern": r"^[a-f0-9]{32}$",
        "required": False,
        "method": "POST",
        "test_payload": {
            "routing_key": "PLACEHOLDER",
            "event_action": "trigger",
            "payload": {
                "summary": "webhook 配置测试",
                "source": "zhs-prod",
                "severity": "info",
            },
        },
    },
    {
        "name": "email",
        "label": "邮件",
        "env_var": "EMAIL_SMTP_HOST",
        "url_pattern": r"^smtp\..+\..+$",
        "required": False,
        "method": "SMTP",
        "test_payload": None,
    },
    {
        "name": "generic",
        "label": "Generic",
        "env_var": "GENERIC_WEBHOOK_URL",
        "url_pattern": r"^https?://.+$",
        "required": False,
        "method": "POST",
        "test_payload": {"text": "webhook 配置测试"},
    },
]


def generate_template() -> str:
    """生成 .env.alert.example 模板."""
    lines: list[str] = []
    lines.append("# 真实生产告警 webhook 配置模板")
    lines.append(f"# 生成时间: {datetime.now(timezone.utc).isoformat()}")
    lines.append("# 必填项 (required=True) 必须配置, 否则告警无法投递")
    lines.append("# 选填项 (required=False) 可后续按需补齐")
    lines.append("")
    for ch in CHANNELS:
        lines.append(f"# ============ {ch['label']} ({ch['name']}) ============")
        lines.append(f"# 必填: {ch['required']}, 方法: {ch['method']}")
        lines.append(f"# URL 格式: {ch['url_pattern']}")
        lines.append(f"{ch['env_var']}=")
        # 邮件通道额外配置
        if ch["name"] == "email":
            lines.append("EMAIL_SMTP_PORT=465")
            lines.append("EMAIL_SMTP_USER=alert@your-domain.com")
            lines.append("EMAIL_SMTP_PASSWORD=")
            lines.append("EMAIL_FROM=alert@your-domain.com")
        lines.append("")
    return "\n".join(lines)


def check_env() -> dict:
    """检查当前环境变量配置情况."""
    results: dict = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "channels": [],
        "summary": {"total": 0, "configured": 0, "missing_required": 0},
    }
    for ch in CHANNELS:
        value = os.environ.get(ch["env_var"], "").strip()
        is_set = bool(value)
        is_valid = False
        if is_set:
            is_valid = bool(re.match(ch["url_pattern"], value))
        results["channels"].append({
            "name": ch["name"],
            "label": ch["label"],
            "env_var": ch["env_var"],
            "required": ch["required"],
            "configured": is_set,
            "valid": is_valid,
            "masked_value": value[:8] + "***" if is_set and len(value) > 8 else value,
        })
        results["summary"]["total"] += 1
        if is_set:
            results["summary"]["configured"] += 1
        elif ch["required"]:
            results["summary"]["missing_required"] += 1
    return results


def probe_url() -> dict:
    """探测每个 webhook URL 可达性 (不实际发送测试告警)."""
    try:
        import httpx  # type: ignore
    except ImportError:
        return {"error": "需要 httpx, 请 pip install httpx"}

    results: dict = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "probes": [],
    }
    for ch in CHANNELS:
        value = os.environ.get(ch["env_var"], "").strip()
        entry = {
            "name": ch["name"],
            "label": ch["label"],
            "env_var": ch["env_var"],
            "reachable": False,
            "error": None,
        }
        if not value:
            entry["error"] = "未配置"
        else:
            if ch["name"] == "email":
                # SMTP 不做 HTTP 探测
                entry["reachable"] = True
                entry["note"] = "SMTP 通道, 需另行验证"
            else:
                try:
                    with httpx.Client(timeout=8.0) as client:
                        # 仅 HEAD 或 GET, 不发 POST (避免误触发)
                        resp = client.head(value, follow_redirects=True)
                        entry["reachable"] = resp.status_code < 500
                        entry["status"] = resp.status_code
                except Exception as e:
                    entry["error"] = str(e)[:200]
        results["probes"].append(entry)
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="真实生产 webhook 接入配置")
    parser.add_argument("--generate", action="store_true", help="生成 .env 模板")
    parser.add_argument("--check", action="store_true", help="校验当前环境")
    parser.add_argument("--probe", action="store_true", help="探测 URL 可达性")
    parser.add_argument("--output", type=str, help="输出 JSON 报告")
    args = parser.parse_args()

    if args.generate:
        content = generate_template()
        ENV_FILE.write_text(content, encoding="utf-8")
        print(f"已生成模板: {ENV_FILE}")
        print(f"通道数: {len(CHANNELS)}")
        return 0

    if args.check:
        results = check_env()
        print("===== Webhook 配置检查 =====")
        for ch in results["channels"]:
            mark = "✅" if ch["valid"] else ("⚠️" if ch["configured"] else "❌")
            label = ch["label"]
            req = "(必填)" if ch["required"] else "(选填)"
            print(f"  {mark} {label} {req}: {ch['env_var']}={ch['masked_value']}")
        s = results["summary"]
        print(f"\n汇总: {s['configured']}/{s['total']} 已配置, {s['missing_required']} 个必填项缺失")
        if args.output:
            Path(args.output).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"已写入: {args.output}")
        return 0 if s["missing_required"] == 0 else 1

    if args.probe:
        results = probe_url()
        print("===== Webhook URL 可达性探测 =====")
        if "error" in results:
            print(f"错误: {results['error']}")
            return 1
        for p in results["probes"]:
            mark = "✅" if p["reachable"] else "❌"
            print(f"  {mark} {p['label']} ({p['env_var']}): {p.get('error') or p.get('status') or 'OK'}")
        PROBE_RESULTS.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
