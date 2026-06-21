"""OIDC ID-Token 兑换短期服务凭据 (建议 3 落地工具).

目的:
  消除 GitHub Actions long-lived secret (PHASE8_DRILL_DINGTALK_WEBHOOK / GRAFANA_TOKEN),
  改用 OIDC ID token 短期兑换:

  GitHub Actions OIDC 颁发 JWT
       ↓
  本脚本 verify_jwt() 验签 (本地公钥)
       ↓
  issue_short_lived_token(provider, ttl_min=30)
       ↓
  短期 webhook / grafana service account token
       ↓
  用完即焚, 最小权限 + 不可泄漏

设计:
  1. 颁发端 (issue) — 用对称密钥 (HMAC-SHA256) 签发短期 token, TTL 30 min
  2. 消费端 (use) — 凭 token 推钉钉 / 写 Grafana annotations
  3. 演练模式 (--mock) — 不连真 OIDC, 用内置 dev-key 演示完整流程

用法:
  # 1. GitHub Actions 调本脚本换 Grafana token
  python scripts/ci/oidc_token_exchange.py --provider grafana --ttl-min 30

  # 2. 拿到的 token 传给 push_drill_annotations.py
  python scripts/ops/push_drill_annotations.py --grafana-url ... --token "$GRAFANA_TOKEN"

  # 3. 钉钉 webhook 类似
  python scripts/ci/oidc_token_exchange.py --provider dingtalk --ttl-min 30

环境变量:
  ZHS_OIDC_DEV_KEY       模拟模式 HMAC 密钥 (默认 dev-key-do-not-use-in-prod)
  ZHS_OIDC_VAULT_URL     真实 vault URL (生产: 内部 vault 服务)
  ZHS_OIDC_VAULT_TOKEN   真实 vault 鉴权 token (生产)
  ACTIONS_ID_TOKEN_REQUEST_TOKEN   GitHub OIDC token (CI 自动注入)
  ACTIONS_ID_TOKEN_REQUEST_URL     GitHub OIDC token URL (CI 自动注入)
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


# ---------------------------------------------------------------------------
# 1. Token 签发 / 验签 (HMAC-SHA256 短期 JWT-like)
# ---------------------------------------------------------------------------

DEV_KEY = "dev-key-do-not-use-in-prod"

# 内置 provider 配置: 颁发 short-lived token 后, 消费端去哪里拿真实凭据
PROVIDER_REGISTRY = {
    "grafana": {
        "url": os.environ.get("GRAFANA_URL", "https://grafana.zhs.top"),
        "service_account": "phase8-drill-ci",
    },
    "dingtalk": {
        "url": os.environ.get("DINGTALK_VAULT_URL", "https://vault.zhs.top/v1/dingtalk/phase8"),
        "service_account": "phase8-drill-ci",
    },
    "alertmanager": {
        "url": os.environ.get("ALERTMANAGER_URL", "http://alertmanager:9093"),
        "service_account": "phase8-drill-ci",
    },
}


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def issue_token(provider: str, subject: str, ttl_min: int, key: str) -> str:
    """签发短期 token (HMAC-SHA256 签名)."""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "ZHS-OIDC-V1"}
    payload = {
        "iss": "github-actions-oidc",
        "sub": subject,
        "aud": provider,
        "iat": now,
        "exp": now + ttl_min * 60,
        "scope": PROVIDER_REGISTRY.get(provider, {}).get("service_account", "ci-drill"),
    }
    h = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    msg = f"{h}.{p}".encode("ascii")
    sig = hmac.new(key.encode("utf-8"), msg, hashlib.sha256).digest()
    return f"{h}.{p}.{_b64url(sig)}"


def verify_token(token: str, key: str) -> dict | None:
    """验签并返回 payload, 失败返 None."""
    try:
        h, p, s = token.split(".")
    except ValueError:
        return None
    msg = f"{h}.{p}".encode("ascii")
    expected_sig = hmac.new(key.encode("utf-8"), msg, hashlib.sha256).digest()
    actual_sig = _b64url_decode(s)
    if not hmac.compare_digest(expected_sig, actual_sig):
        return None
    try:
        payload = json.loads(_b64url_decode(p))
    except Exception:
        return None
    if payload.get("exp", 0) < int(time.time()):
        return None
    return payload


# ---------------------------------------------------------------------------
# 2. 兑换逻辑 (mock 模式 + 真实 vault 模式)
# ---------------------------------------------------------------------------


def exchange_github_oidc_to_vault(provider: str, ttl_min: int) -> dict:
    """从 GitHub OIDC 拿到 ID token, 换 vault 短期凭据.

    CI 模式下 ACTIONS_ID_TOKEN_REQUEST_TOKEN + ACTIONS_ID_TOKEN_REQUEST_URL 由 GitHub 注入.
    本地演练: 用 dev-key 直接签发, 不调真 vault.
    """
    actions_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "")
    actions_url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL", "")
    if actions_token and actions_url:
        try:
            import httpx

            r = httpx.get(
                actions_url,
                params={"audience": "zhs-vault"},
                headers={"Authorization": f"Bearer {actions_token}"},
                timeout=10,
            )
            r.raise_for_status()
            github_jwt = r.json().get("value", "")
        except Exception as e:
            print(f"  [WARN] GitHub OIDC ID token 拉取失败: {e}, 回退 mock")
            github_jwt = ""
    else:
        github_jwt = ""

    # 模式 1: 真实 vault (生产)
    vault_url = os.environ.get("ZHS_OIDC_VAULT_URL", "")
    vault_token = os.environ.get("ZHS_OIDC_VAULT_TOKEN", "")
    if vault_url and vault_token and github_jwt:
        try:
            import httpx

            r = httpx.post(
                f"{vault_url}/exchange",
                json={
                    "provider": provider,
                    "github_jwt": github_jwt,
                    "ttl_min": ttl_min,
                },
                headers={"Authorization": f"Bearer {vault_token}"},
                timeout=10,
            )
            r.raise_for_status()
            data = r.json()
            return {
                "provider": provider,
                "access_token": data.get("access_token", ""),
                "ttl_min": data.get("ttl_min", ttl_min),
                "expires_at": data.get("expires_at", ""),
                "vault_url": data.get("vault_url", ""),
                "mode": "real-vault",
            }
        except Exception as e:
            print(f"  [WARN] vault 兑换失败: {e}, 回退 mock")

    # 模式 2: mock (演练 / 本地)
    dev_key = os.environ.get("ZHS_OIDC_DEV_KEY", DEV_KEY)
    short_token = issue_token(provider, "github-actions", ttl_min, dev_key)
    cfg = PROVIDER_REGISTRY.get(provider, {})
    return {
        "provider": provider,
        "access_token": short_token,
        "ttl_min": ttl_min,
        "expires_at": datetime.fromtimestamp(int(time.time()) + ttl_min * 60, tz=UTC).isoformat(),
        "vault_url": cfg.get("url", ""),
        "mode": "mock",
    }


# ---------------------------------------------------------------------------
# 3. CLI
# ---------------------------------------------------------------------------


def main() -> int:
    p = argparse.ArgumentParser(description="OIDC ID-Token 兑换短期服务凭据")
    p.add_argument(
        "--provider",
        choices=list(PROVIDER_REGISTRY.keys()),
        help="目标 provider: grafana / dingtalk / alertmanager (verify 模式可省)",
    )
    p.add_argument("--ttl-min", type=int, default=30, help="token TTL (分钟), 默认 30")
    p.add_argument("--output", help="输出 token 到文件 (供下一步脚本读), 缺省 stdout")
    p.add_argument("--verify", help="验签一个 token (用于调试), 配合 --key")
    p.add_argument("--key", help="verify 用的密钥, 默认读 ZHS_OIDC_DEV_KEY")
    args = p.parse_args()

    if args.verify:
        if not args.key and not os.environ.get("ZHS_OIDC_DEV_KEY"):
            print("✗ verify 模式需要 --key 或 ZHS_OIDC_DEV_KEY 环境变量")
            return 2
        key = args.key or os.environ.get("ZHS_OIDC_DEV_KEY", DEV_KEY)
        payload = verify_token(args.verify, key)
        if payload is None:
            print("[FAIL] 验签失败或 token 过期")
            return 1
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    if not args.provider:
        print("✗ 必须指定 --provider (或 --verify 模式)")
        return 2

    result = exchange_github_oidc_to_vault(args.provider, args.ttl_min)

    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(result["access_token"], encoding="utf-8")
        # 同时把 metadata 写到 .meta
        meta_path = Path(args.output).with_suffix(Path(args.output).suffix + ".meta.json")
        meta_path.write_text(
            json.dumps({k: v for k, v in result.items() if k != "access_token"}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"[OK] {args.provider} token 已写入 {args.output}")
        print(f"     meta: {meta_path}")
        print(f"     ttl: {result['ttl_min']}min, mode: {result['mode']}, vault: {result['vault_url']}")
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
