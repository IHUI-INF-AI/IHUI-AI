"""Phase 13 建议 2: Federation Endpoint 鉴权 + 限流 + IP 白名单.

目的:
  /federate 端点暴露指标, 需保护免受未授权抓取.
  实现:
  1. Bearer Token 鉴权 (多 token 支持, 与 Vault server 共用 secret)
  2. IP allowlist (CIDR/具体 IP)
  3. 令牌桶限流 (每 IP 独立桶)

配置 (环境变量):
  ZHS_FEDERATION_BEARER_TOKEN    逗号分隔的允许 token 列表, 空=不鉴权
  ZHS_FEDERATION_ALLOW_IPS       逗号分隔的 IP/CIDR 列表, 空=不限
  ZHS_FEDERATION_RATE_PER_MIN    每分钟令牌生成速率, 默认 60
  ZHS_FEDERATION_RATE_BURST      桶容量, 默认 60
  ZHS_FEDERATION_RATE_DISABLE    设为 1 禁用限流 (仅测试用)

API:
  configure(bearer_tokens, allow_ips, rate_per_min, rate_burst)  初始化/重置
  reset()                                                         清空所有状态 (测试用)
  verify_bearer(authorization_header) -> bool                     鉴权
  check_ip_allowed(client_ip) -> bool                             IP 白名单
  consume_token(client_ip) -> bool                                令牌桶消费
  enforce(authorization, client_ip) -> None or raise              一站式

错误码:
  401 - bearer 缺失/错误
  403 - IP 不在白名单
  429 - 限流超限
"""

from __future__ import annotations

import ipaddress
import os
import time

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

_bearer_tokens: set[str] = set()
_allow_ips: list[ipaddress._BaseNetwork] = []
_rate_per_min: float = 60.0
_rate_burst: int = 60
_rate_disabled: bool = False

# 令牌桶: {client_ip: (tokens, last_refill_ts)}
_buckets: dict[str, tuple[float, float]] = {}


def configure(
    bearer_tokens: list[str] | None = None,
    allow_ips: list[str] | None = None,
    rate_per_min: float | None = None,
    rate_burst: int | None = None,
    rate_disabled: bool | None = None,
) -> None:
    """初始化 / 覆盖安全配置. 测试或程序启动时调用."""
    global _bearer_tokens, _allow_ips, _rate_per_min, _rate_burst, _rate_disabled
    if bearer_tokens is not None:
        _bearer_tokens = {t.strip() for t in bearer_tokens if t.strip()}
    if allow_ips is not None:
        _allow_ips = []
        for raw in allow_ips:
            s = raw.strip()
            if not s:
                continue
            try:
                if "/" in s:
                    _allow_ips.append(ipaddress.ip_network(s, strict=False))
                else:
                    # 单 IP 转为 /32 (IPv4) 或 /128 (IPv6)
                    ip = ipaddress.ip_address(s)
                    _allow_ips.append(
                        ipaddress.ip_network(
                            f"{ip}/{32 if ip.version == 4 else 128}",
                            strict=False,
                        )
                    )
            except ValueError as e:
                raise ValueError(f"无效的 IP/CIDR: {s!r}: {e}") from e
    if rate_per_min is not None:
        if rate_per_min <= 0:
            raise ValueError(f"rate_per_min 必须 > 0, 实际 {rate_per_min}")
        _rate_per_min = float(rate_per_min)
    if rate_burst is not None:
        if rate_burst < 1:
            raise ValueError(f"rate_burst 必须 >= 1, 实际 {rate_burst}")
        _rate_burst = int(rate_burst)
    if rate_disabled is not None:
        _rate_disabled = bool(rate_disabled)
    # 配置变更时清桶
    _buckets.clear()


def reset() -> None:
    """重置为初始 (未配置) 状态, 测试用."""
    global _bearer_tokens, _allow_ips, _rate_per_min, _rate_burst, _rate_disabled
    _bearer_tokens = set()
    _allow_ips = []
    _rate_per_min = 60.0
    _rate_burst = 60
    _rate_disabled = False
    _buckets.clear()


def load_from_env() -> None:
    """从环境变量加载配置. 启动时调用一次."""
    tokens = os.environ.get("ZHS_FEDERATION_BEARER_TOKEN", "")
    ips = os.environ.get("ZHS_FEDERATION_ALLOW_IPS", "")
    rate = os.environ.get("ZHS_FEDERATION_RATE_PER_MIN", "")
    burst = os.environ.get("ZHS_FEDERATION_RATE_BURST", "")
    disabled = os.environ.get("ZHS_FEDERATION_RATE_DISABLE", "")

    configure(
        bearer_tokens=[t for t in tokens.split(",") if t.strip()] if tokens else None,
        allow_ips=[s for s in ips.split(",") if s.strip()] if ips else None,
        rate_per_min=float(rate) if rate else None,
        rate_burst=int(burst) if burst else None,
        rate_disabled=disabled == "1",
    )


# ---------------------------------------------------------------------------
# 鉴权
# ---------------------------------------------------------------------------


def verify_bearer(authorization_header: str | None) -> bool:
    """检查 Authorization: Bearer <token>.

    规则:
      - 未配置 bearer_tokens 时, 视为放行 (开发模式)
      - 配置了 bearer_tokens 时, 必须有 Bearer 前缀且 token 在白名单
    """
    if not _bearer_tokens:
        return True
    if not authorization_header:
        return False
    parts = authorization_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return False
    token = parts[1].strip()
    return token in _bearer_tokens


# ---------------------------------------------------------------------------
# IP 白名单
# ---------------------------------------------------------------------------


def check_ip_allowed(client_ip: str | None) -> bool:
    """检查 client_ip 是否在 allow_ips 白名单.

    规则:
      - 未配置 allow_ips 时, 视为放行
      - 配置了 allow_ips 时, IP 必须命中至少一个 CIDR
    """
    if not _allow_ips:
        return True
    if not client_ip:
        return False
    try:
        ip = ipaddress.ip_address(client_ip)
    except ValueError:
        return False
    for net in _allow_ips:
        if ip in net:
            return True
    return False


# ---------------------------------------------------------------------------
# 令牌桶限流
# ---------------------------------------------------------------------------


def consume_token(client_ip: str, n: int = 1) -> bool:
    """消费 n 个令牌, 成功返回 True, 失败 (桶空) 返回 False.

    桶以 client_ip 区分, 每 IP 独立计数.
    桶按 _rate_per_min 速率补充, 最大容量 _rate_burst.
    """
    if _rate_disabled:
        return True
    if not client_ip:
        client_ip = "_anon_"
    now = time.time()
    tokens, last_ts = _buckets.get(client_ip, (float(_rate_burst), now))
    # 补充令牌
    elapsed = now - last_ts
    refill = elapsed * (_rate_per_min / 60.0)
    tokens = min(float(_rate_burst), tokens + refill)
    if tokens >= n:
        tokens -= n
        _buckets[client_ip] = (tokens, now)
        return True
    _buckets[client_ip] = (tokens, now)
    return False


def get_bucket_state(client_ip: str) -> dict[str, float]:
    """查看桶状态 (调试/测试)."""
    tokens, last_ts = _buckets.get(client_ip, (float(_rate_burst), time.time()))
    return {"tokens": tokens, "last_ts": last_ts}


# ---------------------------------------------------------------------------
# 一站式
# ---------------------------------------------------------------------------


class SecurityError(Exception):
    """安全检查失败."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def enforce(authorization: str | None, client_ip: str | None) -> None:
    """一站式安全检查, 失败抛 SecurityError.

    顺序: 鉴权 → IP 白名单 → 限流
    """
    if not verify_bearer(authorization):
        raise SecurityError(401, "bearer token 缺失或错误")
    if not check_ip_allowed(client_ip):
        raise SecurityError(403, f"client_ip {client_ip!r} 不在白名单")
    if not consume_token(client_ip or "_anon_"):
        raise SecurityError(429, "请求过于频繁, 请稍后重试")
