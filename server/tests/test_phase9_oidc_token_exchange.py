"""Phase 9 建议 3: OIDC token 兑换验证 + workflow YAML 解析校验.

验证点:
  1. issue_token 签发 + verify_token 验签 通过
  2. 篡改签名 → 验签失败
  3. 过期 token → 验签失败
  4. workflow YAML 含 permissions: id-token: write
  5. workflow YAML 含 auth_mode dispatch input
  6. workflow YAML 含 OIDC 兑换步骤 (oidc_token_exchange.py 调用)
  7. workflow YAML legacy 模式分支保留
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.ci.oidc_token_exchange import (  # noqa: E402
    DEV_KEY,
    PROVIDER_REGISTRY,
    exchange_github_oidc_to_vault,
    issue_token,
    verify_token,
)


def test_issue_and_verify_roundtrip():
    """正常 token 签发 + 验签通过."""
    tok = issue_token("grafana", "github-actions", 30, DEV_KEY)
    payload = verify_token(tok, DEV_KEY)
    assert payload is not None
    assert payload["iss"] == "github-actions-oidc"
    assert payload["aud"] == "grafana"
    assert payload["sub"] == "github-actions"
    assert payload["scope"] == "phase8-drill-ci"
    assert payload["exp"] > int(time.time())


def test_tampered_signature_fails():
    """篡改 token 最后一字节, 验签应失败."""
    tok = issue_token("dingtalk", "github-actions", 30, DEV_KEY)
    h, p, s = tok.split(".")
    # 把 s 最后一字符改一下
    tampered = f"{h}.{p}.{s[:-1]}X"
    assert verify_token(tampered, DEV_KEY) is None


def test_expired_token_fails():
    """exp 设为已过期, 验签应失败."""
    tok = issue_token("grafana", "github-actions", ttl_min=0, key=DEV_KEY)
    # ttl_min=0 会让 exp == iat, 立即过期
    time.sleep(1)
    assert verify_token(tok, DEV_KEY) is None


def test_wrong_key_fails():
    """用错误 key 验签, 应失败."""
    tok = issue_token("grafana", "github-actions", 30, DEV_KEY)
    assert verify_token(tok, "wrong-key") is None


def test_exchange_github_oidc_mock_mode():
    """未注入 GitHub Actions env 时, 自动回退 mock 模式."""
    result = exchange_github_oidc_to_vault("grafana", 30)
    assert result["mode"] == "mock"
    assert result["provider"] == "grafana"
    assert result["ttl_min"] == 30
    # 拿到的 token 必须可验签
    payload = verify_token(result["access_token"], DEV_KEY)
    assert payload is not None
    assert payload["aud"] == "grafana"


def test_exchange_three_providers():
    """3 个 provider 都能成功兑换."""
    for prov in ("grafana", "dingtalk", "alertmanager"):
        result = exchange_github_oidc_to_vault(prov, 15)
        assert result["mode"] == "mock"
        assert result["provider"] == prov
        assert result["vault_url"] == PROVIDER_REGISTRY[prov]["url"]


def test_workflow_has_oidc_permissions():
    """weekly-phase8-drill.yml workflow 级 permissions 含 id-token: write."""
    wf_path = ROOT / ".github" / "workflows" / "weekly-phase8-drill.yml"
    data = yaml.safe_load(wf_path.read_text(encoding="utf-8"))
    perms = data.get("permissions", {})
    assert perms.get("id-token") == "write", f"workflow permissions 缺 id-token: write, 实际 {perms}"


def test_workflow_has_auth_mode_input():
    """workflow_dispatch inputs 含 auth_mode."""
    wf_path = ROOT / ".github" / "workflows" / "weekly-phase8-drill.yml"
    data = yaml.safe_load(wf_path.read_text(encoding="utf-8"))
    # yaml 1.1 把 "on" 解析为 True, 需要兼容
    on_key = True if True in data else "on"
    inputs = data[on_key]["workflow_dispatch"]["inputs"]
    assert "auth_mode" in inputs
    assert inputs["auth_mode"]["default"] == "oidc"
    assert "oidc" in inputs["auth_mode"]["description"].lower()


def test_workflow_calls_oidc_token_exchange():
    """workflow 至少 2 处调 oidc_token_exchange.py (dingtalk + grafana)."""
    wf_text = (ROOT / ".github" / "workflows" / "weekly-phase8-drill.yml").read_text(encoding="utf-8")
    assert wf_text.count("oidc_token_exchange.py") >= 2
    assert "--provider grafana" in wf_text
    assert "--provider dingtalk" in wf_text


def test_workflow_legacy_mode_preserved():
    """legacy 模式分支保留, 兼容老 secret."""
    wf_text = (ROOT / ".github" / "workflows" / "weekly-phase8-drill.yml").read_text(encoding="utf-8")
    assert "auth_mode == 'legacy'" in wf_text
    assert "PHASE8_DRILL_DINGTALK_WEBHOOK" in wf_text
    assert "PHASE8_DRILL_GRAFANA_TOKEN" in wf_text


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
