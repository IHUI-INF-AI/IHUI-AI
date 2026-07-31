"""反风控基础设施(2026-07-31 新增)。

五层防线让 Playwright 自动化行为与真人操作在统计特征上无法区分:
1. stealth.py        — 反检测脚本注入(隐藏 webdriver/CDP 特征)
2. fingerprint_isolation.py — 浏览器指纹隔离(每账号独立固定指纹)
3. behavior_humanizer.py    — 行为人类化(贝塞尔曲线鼠标 + 逐字符输入)
4. proxy_pool.py     — 代理池(每账号绑定固定住宅 IP)
5. account_profile.py — 账号 profile 持久化(指纹+代理跨会话稳定)
6. browser_factory.py — 统一入口,创建反风控 BrowserContext

设计原则:
- 每账号指纹/代理固定不变(同账号跨会话一致,避免异地登录告警)
- 不同账号零共享(IP/指纹/Cookie/UA/屏幕/时区全差异化)
- 类型严格(AGENTS.md §3 禁 any),mypy 0 错误
- 纯 async 接口(适配器用 async_playwright)

诚实边界:"零风险"技术上不可达(平台风控黑盒且进化),本模块目标是
"工业级低风险"—把风险压到接近真人手动操作水平。
"""
from .browser_factory import create_stealth_browser_context
from .account_profile import AccountProfile, get_account_profile
from .behavior_humanizer import (
    human_move_mouse,
    human_type,
    human_scroll,
    human_pause,
    simulate_reading,
    human_click,
)
from .fingerprint_isolation import BrowserFingerprint, generate_fingerprint
from .proxy_pool import ProxyConfig, ProxyPool, get_proxy_pool
from .stealth import apply_stealth

__all__ = [
    "create_stealth_browser_context",
    "AccountProfile",
    "get_account_profile",
    "BrowserFingerprint",
    "generate_fingerprint",
    "ProxyConfig",
    "ProxyPool",
    "get_proxy_pool",
    "apply_stealth",
    "human_move_mouse",
    "human_type",
    "human_scroll",
    "human_pause",
    "simulate_reading",
    "human_click",
]
