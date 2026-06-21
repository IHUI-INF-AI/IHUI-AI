"""Phase 10 建议 2: OIDC Vault 服务 (200 行 FastAPI 落地).

提供端点:
  GET  /healthz                            健康检查
  GET  /.well-known/openid-configuration    OIDC discovery (给 GitHub Actions 看)
  GET  /.well-known/jwks.json               JWKS 公钥
  POST /v1/exchange                        GitHub OIDC JWT → 短期 service token

运行:
  # 开发模式 (mock 凭据库)
  python scripts/ci/oidc_vault_server.py --port 9100 --mock

  # 生产模式 (从 env 读真实凭据)
  GRAFANA_ADMIN_TOKEN=glsa_xxx \\
  DINGTALK_VAULT_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx \\
  ALERTMANAGER_VAULT_BASIC=user:pass \\
  python scripts/ci/oidc_vault_server.py --port 9100

GitHub OIDC 配置:
  Settings → Security → Secrets and variables → Actions
  → New organization variable: ZHS_VAULT_AUDIENCE=zhs-vault
  → Workflow:
        vault_token=$(curl -H "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \\
                       "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=zhs-vault" | jq -r .value)
        resp=$(curl -X POST https://vault.zhs.top/v1/exchange \\
                -H "Authorization: Bearer $vault_token" \\
                -H "Content-Type: application/json" \\
                -d '{"provider":"grafana","ttl_min":30}')
        token=$(echo "$resp" | jq -r .access_token)
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

# 用 FastAPI (项目已有依赖) 落地
try:
    import uvicorn
    from fastapi import FastAPI, Header, HTTPException, Request
    from fastapi.responses import JSONResponse
except ImportError:
    print("✗ 需要 fastapi + uvicorn: pip install fastapi uvicorn")
    sys.exit(2)

# ---------------------------------------------------------------------------
# 1. HMAC 签名 / 验签 (vault 颁发短期 token)
# ---------------------------------------------------------------------------

# 生产模式: 用强随机密钥 (32 字节)
# 开发模式: 用固定 dev key
SIGN_KEY = os.environ.get("ZHS_VAULT_SIGN_KEY", "vault-dev-key-do-not-use-in-prod").encode("utf-8")

# Provider 注册表: 每个 provider 对应一个真实凭据来源
PROVIDER_REGISTRY = {
    "grafana": {
        "vault_secret_env": "GRAFANA_ADMIN_TOKEN",
        "default_url": "https://grafana.zhs.top",
        "scope": "annotations:write",
    },
    "dingtalk": {
        "vault_secret_env": "DINGTALK_VAULT_WEBHOOK",
        "default_url": "https://oapi.dingtalk.com/robot/send",
        "scope": "webhook:send",
    },
    "alertmanager": {
        "vault_secret_env": "ALERTMANAGER_VAULT_BASIC",
        "default_url": "http://alertmanager:9093",
        "scope": "alerts:read,silences:write",
    },
}

# 颁发/验签后的短期 token 缓存在内存 (生产应放 Redis)
_ISSUED_TOKENS: dict[str, dict] = {}

# 审计日志 (供后续归档/合规)
_AUDIT_LOG: list[dict] = []

# 持久化审计存储 (Phase 11 建议 1: SQLite 后端)
# 通过环境变量 ZHS_VAULT_AUDIT_DB 启用, 不设则退化为内存
_audit_db_path = os.environ.get("ZHS_VAULT_AUDIT_DB", "")
audit_store = None
if _audit_db_path:
    try:
        from oidc_vault_audit import AuditStore  # type: ignore

        audit_store = AuditStore(_audit_db_path)
    except Exception as _exc:
        print(f"[warn] 审计持久化未启用: {_exc}")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def issue_service_token(provider: str, github_sub: str, ttl_min: int) -> dict:
    """颁发 provider-specific 短期 service token.

    token 内部含 (provider, github_sub, exp, scope), HMAC-SHA256 签名.
    消费端调 vault /v1/validate 验签后, vault 解封 provider 凭据.
    """
    if provider not in PROVIDER_REGISTRY:
        raise HTTPException(400, f"unknown provider: {provider}")
    if ttl_min < 1 or ttl_min > 60:
        raise HTTPException(400, "ttl_min 必须在 1-60 之间")

    cfg = PROVIDER_REGISTRY[provider]
    now = int(time.time())
    payload = {
        "iss": "zhs-vault",
        "sub": github_sub,
        "aud": provider,
        "iat": now,
        "exp": now + ttl_min * 60,
        "scope": cfg["scope"],
    }
    h = _b64url(json.dumps({"alg": "HS256", "typ": "ZHS-VAULT-V1"}, separators=(",", ":")).encode("utf-8"))
    p = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    msg = f"{h}.{p}".encode("ascii")
    sig = hmac.new(SIGN_KEY, msg, hashlib.sha256).digest()
    token = f"{h}.{p}.{_b64url(sig)}"

    _ISSUED_TOKENS[token] = payload
    return {
        "access_token": token,
        "provider": provider,
        "ttl_min": ttl_min,
        "expires_at": datetime.fromtimestamp(payload["exp"], tz=UTC).isoformat(),
        "scope": payload["scope"],
    }


def validate_service_token(token: str) -> dict | None:
    """验签 + 检查过期, 返回 payload 或 None."""
    try:
        h, p, s = token.split(".")
    except ValueError:
        return None
    msg = f"{h}.{p}".encode("ascii")
    expected = hmac.new(SIGN_KEY, msg, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, _b64url_decode(s)):
        return None
    try:
        payload = json.loads(_b64url_decode(p))
    except Exception:
        return None
    if payload.get("exp", 0) < int(time.time()):
        return None
    return payload


# ---------------------------------------------------------------------------
# 2. GitHub OIDC JWT 验签 (简化版, 实际生产用 PyJWT + GitHub JWKS)
# ---------------------------------------------------------------------------


def verify_github_oidc_jwt(jwt_str: str, expected_audience: str = "zhs-vault") -> dict:
    """验签 GitHub Actions OIDC JWT.

    生产实现:
      import jwt
      from jwt import PyJWKClient
      jwks = PyJWKClient("https://token.actions.githubusercontent.com/.well-known/jwks")
      signing_key = jwks.get_signing_key_from_jwt(jwt_str)
      payload = jwt.decode(
          jwt_str, signing_key.key,
          algorithms=["RS256"],
          audience=expected_audience,
          issuer="https://token.actions.githubusercontent.com",
      )
      # payload['sub'] 形如: repo:owner/zhs-platform:ref:refs/heads/main
      return payload

    本地 mock 模式: 直接解析 payload (不验签), 用于端到端测试
    """
    if os.environ.get("ZHS_VAULT_MOCK") == "1":
        # mock 模式: 不验签, 直接解 base64
        try:
            h, p, s = jwt_str.split(".")
            payload = json.loads(_b64url_decode(p))
            if payload.get("aud") != expected_audience:
                raise HTTPException(401, f"OIDC aud 不匹配, 期望 {expected_audience}")
            return payload
        except Exception as e:
            raise HTTPException(401, f"mock OIDC 解析失败: {e}")

    # 生产模式: 调用真实 GitHub JWKS 验签
    try:
        import jwt
        from jwt import PyJWKClient
    except ImportError:
        raise HTTPException(500, "生产模式需安装 PyJWT: pip install pyjwt cryptography")

    try:
        jwks = PyJWKClient("https://token.actions.githubusercontent.com/.well-known/jwks")
        signing_key = jwks.get_signing_key_from_jwt(jwt_str)
        payload = jwt.decode(
            jwt_str,
            signing_key.key,
            algorithms=["RS256"],
            audience=expected_audience,
            issuer="https://token.actions.githubusercontent.com",
        )
        return payload
    except Exception as e:
        raise HTTPException(401, f"GitHub OIDC 验签失败: {e}")


# ---------------------------------------------------------------------------
# 3. FastAPI 端点
# ---------------------------------------------------------------------------

app = FastAPI(
    title="ZHS OIDC Vault",
    version="1.0.0",
    description="Phase 10 建议 2: GitHub OIDC → provider-specific 短期 token 兑换",
)


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok", "ts": int(time.time()), "providers": list(PROVIDER_REGISTRY.keys())}


@app.get("/.well-known/openid-configuration")
async def oidc_discovery() -> dict:
    """OIDC discovery - 告诉 GitHub Actions vault 的端点信息."""
    base = os.environ.get("ZHS_VAULT_BASE_URL", "https://vault.zhs.top")
    return {
        "issuer": "zhs-vault",
        "jwks_uri": f"{base}/.well-known/jwks.json",
        "token_endpoint": f"{base}/v1/exchange",
        "id_token_signing_alg_values_supported": ["HS256"],
    }


@app.get("/.well-known/jwks.json")
async def jwks() -> dict:
    """JWKS - 生产用非对称密钥, 这里给空 keyset 走 mock 流程."""
    return {"keys": []}


@app.post("/v1/exchange")
async def exchange(
    request: Request,
    authorization: str = Header(...),
    body: dict = None,
) -> JSONResponse:
    """GitHub OIDC JWT → provider-specific 短期 token.

    Headers:
      Authorization: Bearer <github_oidc_jwt>

    Body:
      {"provider": "grafana|dingtalk|alertmanager", "ttl_min": 30}
    """
    body = body or {}
    provider = body.get("provider")
    ttl_min = int(body.get("ttl_min", 30))

    if not provider:
        raise HTTPException(400, "body.provider 必填")
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authorization 必为 Bearer 格式")
    github_jwt = authorization[7:]

    # 1. 验签 GitHub OIDC JWT
    oidc_payload = verify_github_oidc_jwt(github_jwt, "zhs-vault")
    github_sub = oidc_payload.get("sub", "unknown")

    # 2. 颁发 provider-specific 短期 token
    result = issue_service_token(provider, github_sub, ttl_min)

    # 3. 审计 (Phase 11: 持久化到 SQLite, 同时保留内存副本供快速查询)
    audit_entry = {
        "ts": datetime.now(UTC).isoformat(),
        "github_sub": github_sub,
        "provider": provider,
        "ttl_min": ttl_min,
        "client_ip": request.client.host if request.client else "unknown",
    }
    _AUDIT_LOG.append(audit_entry)
    if audit_store is not None:
        try:
            audit_store.append(audit_entry)
        except Exception:
            pass  # 持久化失败不影响主流程
    if len(_AUDIT_LOG) > 10000:
        _AUDIT_LOG.pop(0)

    return JSONResponse(result)


@app.post("/v1/validate")
async def validate(body: dict) -> JSONResponse:
    """消费端验签 service token (调试用)."""
    tok = body.get("access_token", "")
    payload = validate_service_token(tok)
    if payload is None:
        raise HTTPException(401, "token 无效或过期")
    return JSONResponse({"valid": True, **payload})


@app.post("/v1/redeem")
async def redeem(body: dict) -> JSONResponse:
    """service token → 真实凭据 (核心兑换).

    GitHub Actions 拿 service_token 来 vault 这取真凭据, 写入环境变量.
    """
    tok = body.get("access_token", "")
    payload = validate_service_token(tok)
    if payload is None:
        raise HTTPException(401, "token 无效或过期")
    provider = payload["aud"]
    cfg = PROVIDER_REGISTRY[provider]
    real_secret = os.environ.get(cfg["vault_secret_env"], "")
    if not real_secret and os.environ.get("ZHS_VAULT_MOCK") != "1":
        raise HTTPException(500, f"vault 未配置 {cfg['vault_secret_env']}")
    return JSONResponse(
        {
            "provider": provider,
            "credential": real_secret or f"mock-{provider}-credential",
            "url": cfg["default_url"],
            "scope": payload["scope"],
            "exp": payload["exp"],
        }
    )


@app.get("/v1/audit")
async def audit(
    provider: str | None = None,
    since: str | None = None,
    limit: int = 100,
) -> dict:
    """审计日志查询 (内部用).

    支持过滤:
      ?provider=grafana        按 provider 过滤
      ?since=2026-06-16T00:00:00Z  按时间过滤
      ?limit=100                返回行数 (最大 1000)

    优先返回持久化存储, 无则回退内存副本.
    """
    if limit > 1000:
        limit = 1000
    if audit_store is not None:
        try:
            rows = audit_store.query(provider=provider, since=since, limit=limit)
            return {"source": "sqlite", "count": len(rows), "rows": rows}
        except Exception:
            pass
    rows = list(reversed(_AUDIT_LOG[-limit:]))
    if provider:
        rows = [r for r in rows if r.get("provider") == provider]
    if since:
        rows = [r for r in rows if r.get("ts", "") >= since]
    return {"source": "memory", "count": len(rows), "rows": rows}


# ---------------------------------------------------------------------------
# 4. CLI 启动
# ---------------------------------------------------------------------------


def main() -> int:
    p = argparse.ArgumentParser(description="ZHS OIDC Vault 服务")
    p.add_argument("--host", default="0.0.0.0", help="监听 host")
    p.add_argument("--port", type=int, default=9100, help="监听 port")
    p.add_argument("--mock", action="store_true", help="mock 模式 (本地开发)")
    args = p.parse_args()

    if args.mock:
        os.environ["ZHS_VAULT_MOCK"] = "1"
        print("[MOCK] vault 跑在 mock 模式, 不验签 GitHub OIDC")

    print(f"ZHS OIDC Vault 启动: http://{args.host}:{args.port}")
    print(f"  providers: {list(PROVIDER_REGISTRY.keys())}")
    print(f"  discovery: http://{args.host}:{args.port}/.well-known/openid-configuration")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
