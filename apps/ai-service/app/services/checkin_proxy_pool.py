# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""免费代理池自动分配(多账号风控三件套之"独立 IP"的免费实现,2026-10-15)。

设计:
- 公开源抓取(TheSpeedX/PROXY-List、proxyscrape)→ 并发测活(对目标 host 发
  HEAD,200/3xx/401/403 都算通——只要 TCP+TLS 通即可,鉴权由引擎层处理)
  → 存活池缓存(进程级,默认 1h 刷新)。
- 粘性分配:按 uid 稳定 hash 固定绑定池中某条代理,同一账号每次同一出口
  (与真人"家庭宽带固定 IP"同构);分配结果写回 device_map.proxy 持久化。
- 回落:代理请求失败(连接 refused/超时)时引擎已有分档归因,调度器下一次
  会重新分配(池刷新后新 IP)。
- **风险如实告知**(启用前必读):
  免费代理全部来自公开互联网的机房/滥用段 IP,IP 信誉差于家庭宽带;
  "登录地突变"(本机宽带 → 陌生机房 IP)本身就是风控信号之一。
  因此默认**关闭**,仅当同平台账号数较多、确需分散出口时开启
  (环境变量 CHECKIN_FREE_PROXY_POOL=1)。HTTPS 请求经 CONNECT 隧道,
  token 本体不会泄露给代理运营者,但元数据(目标域名)可见。
"""

from __future__ import annotations

import asyncio
import hashlib
import time
from typing import Any, Final

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)

PROXY_SOURCES: Final = [
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
    "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000",
]
_PROBE_TARGETS: Final = [
    "https://agent.minimax.cn",
    "https://api.trae.cn",
    "https://www.workbuddy.cn",
]
_REFRESH_SECONDS: Final = 3600.0
_PROBE_CONCURRENCY: Final = 20
_PROBE_TIMEOUT: Final = 8.0
_POOL_MAX: Final = 50  # 池上限(免费源噪点多,留可用性最高的前 N 条)

_pool_cache: list[str] = []
_pool_fetched_at: float = 0.0


def _md5_hex(s: str) -> str:
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def sticky_proxy_for_uid(uid: str, pool: list[str]) -> str | None:
    """纯函数:uid 稳定 hash → 池中固定一条(粘性绑定,同账号同出口)。"""
    if not pool or not uid:
        return None
    idx = int(_md5_hex(uid)[:8], 16) % len(pool)
    return pool[idx]


def parse_proxy_source(text: str) -> list[str]:
    """纯函数:免费源文本 → 去重 ip:port 列表(过滤空行/非法形态)。"""
    out: list[str] = []
    seen: set[str] = set()
    for line in text.splitlines():
        candidate = line.strip()
        if not candidate or candidate in seen:
            continue
        if ":" not in candidate:
            continue
        host, _, port = candidate.rpartition(":")
        if not host or not port.isdigit() or not (1 <= int(port) <= 65535):
            continue
        if len(host) < 7 or not all(c.isdigit() or c == "." for c in host):
            continue
        seen.add(candidate)
        out.append(f"http://{candidate}")
    return out


async def _fetch_source(url: str, client: httpx.AsyncClient) -> str:
    try:
        resp = await client.get(url, timeout=15.0)
        return resp.text if resp.status_code == 200 else ""
    except Exception:
        return ""


async def _probe_alive(proxy: str, client: httpx.AsyncClient) -> str | None:
    """并发测活:对任一目标 host 发 HEAD,连接建立即算活(鉴权由引擎层处理)。"""
    for target in _PROBE_TARGETS:
        try:
            resp = await client.head(target, proxy=proxy, timeout=_PROBE_TIMEOUT)
            if resp.status_code < 600:
                return proxy
        except Exception:
            continue
    return None


async def refresh_pool(client: httpx.AsyncClient | None = None) -> list[str]:
    """抓源 + 并发测活 → 可用代理池(进程级缓存,默认 1h 内不重抓)。"""
    global _pool_cache, _pool_fetched_at
    if time.time() - _pool_fetched_at < _REFRESH_SECONDS and _pool_cache:
        return _pool_cache
    own = client is None
    http = client or httpx.AsyncClient(trust_env=False, timeout=15.0)
    try:
        texts = []
        for src in PROXY_SOURCES:
            texts.append(await _fetch_source(src, http))
        candidates = parse_proxy_source("\n".join(texts))
        logger.info("[proxy-pool] 免费源抓取 %d 条候选,开始测活", len(candidates))
        alive: list[str] = []
        semaphore = asyncio.Semaphore(_PROBE_CONCURRENCY)

        async def probe(p: str) -> None:
            async with semaphore:
                result = await _probe_alive(p, http)
                if result:
                    alive.append(result)

        import asyncio

        for chunk_start in range(0, min(len(candidates), 200), _PROBE_CONCURRENCY):
            chunk = candidates[chunk_start : chunk_start + _PROBE_CONCURRENCY]
            await asyncio.gather(*(probe(c) for c in chunk))
            if len(alive) >= _POOL_MAX:
                break
        alive = alive[:_POOL_MAX]
        _pool_cache = alive
        _pool_fetched_at = time.time()
        logger.info("[proxy-pool] 测活完成: %d 条可用代理入池", len(alive))
        return alive
    finally:
        if own:
            await http.aclose()


def device_map_uid(device_map: dict[str, Any]) -> str | None:
    for key in ("uid", "user_id", "userId"):
        val = device_map.get(key)
        if isinstance(val, (str, int)) and str(val).strip():
            return str(val).strip()
    return None


async def ensure_proxy(device_map: dict[str, Any]) -> str | None:
    """调度入口:device_map 无 proxy 且池可用 → 粘性分配并写回 device_map。

    uid 自 device_map 提取(捕获时写入,四平台同键);已有 proxy 的账号不覆盖
    (用户手动指定优先);池不可用返回 None(直连)。
    """
    uid = device_map_uid(device_map)
    if not uid:
        return None
    existing = str(device_map.get("proxy") or "").strip()
    if existing:
        return existing
    pool = await refresh_pool()
    proxy = sticky_proxy_for_uid(uid, pool)
    if proxy:
        device_map["proxy"] = proxy
        device_map["proxy_source"] = "free-pool"
        logger.info("[proxy-pool] uid=%s 分配免费代理(粘性)", uid[:8])
    return proxy
