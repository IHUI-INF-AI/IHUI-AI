# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""本地 LLM provider 健康探针(票85 第一片:离线/边缘优先降级的地基)。

背景(2026-10-18 现读):本地 provider(ollama/lmstudio/llamacpp/vllm/xinference)
在本仓有两处"近似判定"长期并存——

1. `model_availability.is_model_available` 对 LOCAL **直接返回 True**(仅 UI 显示用):
   本地服务根本没在跑时,模型照常出现在 /llm/models 列表里,用户选中才报错;
2. `llm_gateway._resolve_auto_model` 因此把 LOCAL **整体排除**出 auto 路由:
   自托管/边缘实例即使 ollama 正在跑,auto 也永远用不上本地免费算力。

两格合起来 = 「没在跑的装作可用,在跑的进不了自动路由」。本模块把第三态补上:
**探针实证**(HTTP 2xx = available;连接拒绝/HTTP 错 = unavailable;超时/判不了 =
undetermined),结果带 TTL 缓存,供上面两处消费——

- 显示侧:available/unavailable 按实证,False/True 走诚实格;undetermined 维持旧态
  (显示,不冒充实证);
- auto 侧:只纳用 **available** 的本地 provider;unavailable/undetermined 一律不选
  (与 2026-08-06 移除 LOCAL 出 auto 的理由同源:选了判不了的东西,失败的账单是用户付)。

三态纪律:probe 永不抛错,"判不了"必须能被表达,不得折叠成"没在跑"或"在跑"。
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from enum import StrEnum

import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)

# 探针预算:本地服务要么秒回要么没在跑,给 1.5s 足够;拖长只会拖慢 auto 路由。
PROBE_TIMEOUT_S = 1.5
# 结果缓存 TTL:本地服务启停是分钟级事件,30s 内复用上次结论,避免每请求都探测。
CACHE_TTL_S = 30.0


class LocalProbeVerdict(StrEnum):
    """探针三态(与仓内 Facts/CommandFailed/Undetermined 纪律同族)。"""

    AVAILABLE = "available"        # 2xx,本地服务在跑
    UNAVAILABLE = "unavailable"    # 连接拒绝 / HTTP 4xx/5xx:服务确实不在或不可用
    UNDETERMINED = "undetermined"  # 超时/其他异常:判不了,不冒充两态


@dataclass
class LocalProbeResult:
    """一次探针的结论。detail 装人话诊断,model_count 只在 AVAILABLE 时可信。"""

    verdict: LocalProbeVerdict
    detail: str = ""
    model_count: int | None = None
    latency_ms: int = 0
    probed_at: float = field(default_factory=time.time)


def _provider_base(provider_code: str) -> str:
    """本地 provider 的 base:优先 settings 显式配置,降级注册表默认。

    返回空串表示"连 base 都没有" ⇒ undetermined(没有可探测的东西,不是"不在跑")。
    """
    if provider_code == "ollama":
        return settings.ollama_api_base or "http://localhost:11434"
    if provider_code == "lmstudio":
        return settings.lmstudio_api_base or "http://localhost:1234"
    if provider_code == "llamacpp":
        return settings.llamacpp_api_base or "http://localhost:8080"
    # vllm / xinference 等没有 settings 字段的:注册表默认即唯一真源,由调用方传入
    return ""


def _probe_url(provider_code: str, base: str) -> str:
    """按 provider 形态拼模型列表端点。base 已含 /v1 的不再叠加。"""
    base = base.rstrip("/")
    if provider_code == "ollama":
        return f"{base}/api/tags"  # {"models":[...]}
    # OpenAI 兼容族(lmstudio/llamacpp-server/vllm/xinference):GET /v1/models → {"data":[...]}
    if base.endswith("/v1"):
        return f"{base}/models"
    return f"{base}/v1/models"


def _classify(resp: httpx.Response | None, exc: Exception | None) -> LocalProbeResult:
    """把一次 HTTP 尝试折叠成三态。纯函数,单测不碰网络。"""
    now = time.time()
    if exc is not None:
        # ConnectError/Refused 与 ConnectTimeout = TCP 握手都没完成,这是**可下结论**
        # 的 unavailable(本机直连下端口没监听只有这两种表现;本仓 httpx 0.28 里
        # ConnectTimeout 不继承 ConnectError,必须显式列出,否则会被误判成
        # undetermined → 显示侧照常显示,就是 2026-10-21 的"没跑也显示"事故);
        # ReadTimeout 及其它异常判不了,进 undetermined(见模块头:判不了不得折叠)。
        if isinstance(exc, (httpx.ConnectError, httpx.ConnectTimeout)):
            return LocalProbeResult(
                verdict=LocalProbeVerdict.UNAVAILABLE,
                detail=f"connection refused: {exc}",
                probed_at=now,
            )
        return LocalProbeResult(
            verdict=LocalProbeVerdict.UNDETERMINED,
            detail=f"probe error: {type(exc).__name__}: {exc}",
            probed_at=now,
        )
    assert resp is not None
    if 200 <= resp.status_code < 300:
        count: int | None = None
        try:
            body = resp.json()
            items = body.get("models") if isinstance(body, dict) else None
            if items is None and isinstance(body, dict):
                items = body.get("data")
            if isinstance(items, list):
                count = len(items)
        except Exception:  # noqa: BLE001 - 列不出模型数不影响"服务在跑"的结论
            pass
        return LocalProbeResult(
            verdict=LocalProbeVerdict.AVAILABLE,
            detail=f"HTTP {resp.status_code}",
            model_count=count,
            latency_ms=0,
            probed_at=now,
        )
    return LocalProbeResult(
        verdict=LocalProbeVerdict.UNAVAILABLE,
        detail=f"HTTP {resp.status_code}",
        probed_at=now,
    )


def _disabled_codes() -> set[str]:
    """settings.local_providers_disabled(逗号分隔)⇒ 小写集合(2026-10-19)。"""
    raw = getattr(settings, "local_providers_disabled", "") or ""
    return {c.strip().lower() for c in raw.split(",") if c.strip()}


class LocalProviderHealth:
    """本地 provider 探针(TTL 缓存单例)。

    transport 可注入(httpx.MockTransport),单测不碰真网络。
    """

    def __init__(self, ttl_s: float = CACHE_TTL_S) -> None:
        self._ttl_s = ttl_s
        self._cache: dict[str, LocalProbeResult] = {}

    def _fresh(self, code: str) -> LocalProbeResult | None:
        hit = self._cache.get(code)
        if hit is None:
            return None
        if time.time() - hit.probed_at > self._ttl_s:
            return None
        return hit

    def snapshot(self, provider_code: str) -> LocalProbeResult | None:
        """同步读缓存;None = 还没探过或已过期(**不是**"不在跑")。"""
        return self._fresh(provider_code)

    async def probe(
        self,
        provider_code: str,
        *,
        base_override: str = "",
        transport: httpx.AsyncBaseTransport | None = None,
        force: bool = False,
    ) -> LocalProbeResult:
        """探测单个本地 provider;永不抛错,三态可判。force=True 绕过缓存。"""
        # 禁用清单短路(2026-10-19):LOCAL_PROVIDERS_DISABLED 列过的 provider
        # 直接判 undetermined(detail=disabled),不发 HTTP、不写缓存 ——
        # 未部署的本地 provider 每 30s 一次 ConnectTimeout 是纯噪音(实测 1205 次/天)。
        # 消费侧只认 AVAILABLE,行为不变;差异仅是"不探测"而非"探测了说不可用"。
        if provider_code.lower() in _disabled_codes():
            return LocalProbeResult(
                verdict=LocalProbeVerdict.UNDETERMINED,
                detail="disabled by config (local_providers_disabled)",
            )
        if not force:
            fresh = self._fresh(provider_code)
            if fresh is not None:
                return fresh
        base = base_override or _provider_base(provider_code)
        if not base:
            # 无 base 可探(vllm/xinference 走 base_override):判不了,不冒充
            result = LocalProbeResult(
                verdict=LocalProbeVerdict.UNDETERMINED,
                detail="no api_base configured for this local provider",
            )
            self._cache[provider_code] = result
            return result
        url = _probe_url(provider_code, base)
        started = time.perf_counter()
        try:
            # trust_env=False:探针目标是 localhost,系统代理(Clash 等)不监听它,
            # 走代理会把"连接拒绝"变质成 ReadTimeout → undetermined → 没跑的
            # 本地模型照样显示(2026-10-21 实测事故);localhost 探针必须直连。
            async with httpx.AsyncClient(
                timeout=PROBE_TIMEOUT_S, transport=transport, trust_env=False
            ) as client:
                resp = await client.get(url)
            result = _classify(resp, None)
        except httpx.ConnectError as exc:
            result = _classify(None, exc)
        except Exception as exc:  # noqa: BLE001 - 探针永不抛错,异常全部折叠进三态
            result = _classify(None, exc)
        result.latency_ms = int((time.perf_counter() - started) * 1000)
        self._cache[provider_code] = result
        logger.info(
            "[local-health] %s → %s (%s, %dms)",
            provider_code,
            result.verdict.value,
            result.detail,
            result.latency_ms,
        )
        return result

    def is_available(self, provider_code: str) -> bool:
        """消费方便捷:仅 **AVAILABLE** 为 True;没探过/判不了/不在跑都是 False。

        auto 路由与"纳用"语义用这一格——选不选的判据必须实证;
        显示语义请用 snapshot() 自己分格,别用本方法冒充显示判据。
        """
        snap = self._fresh(provider_code)
        return snap is not None and snap.verdict == LocalProbeVerdict.AVAILABLE

    async def ensure_probed(self, codes: list[str]) -> None:
        """批量补探(缓存过期/没探过的才发真请求);auto 路由前调用一次。"""
        for code in codes:
            if self._fresh(code) is None:
                await self.probe(code)


local_provider_health = LocalProviderHealth()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
