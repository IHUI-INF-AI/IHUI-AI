"""反风控基础设施(2026-07-31 新增,2026-08-01 深度强化反风控)。

五层防线让 Playwright 自动化行为与真人操作在统计特征上无法区分:
1. stealth.py        — 反检测脚本注入(隐藏 webdriver/CDP 特征)
2. fingerprint_isolation.py — 浏览器指纹隔离(每账号独立固定指纹)
3. behavior_humanizer.py    — 行为人类化(贝塞尔曲线鼠标 + 逐字符输入)
4. proxy_pool.py     — 代理池(每账号绑定固定住宅 IP)
5. account_profile.py — 账号 profile 持久化(指纹+代理跨会话稳定)
6. browser_factory.py — 统一入口,创建反风控 BrowserContext

强化层(2026-07-31 新增)— 调度器集成反风控:
7. risk_scoring.py       — 风险评分引擎(6 维度评分,触发自动冷却)
8. cooldown_manager.py   — 账号冷却管理器(平台风控触发后自动冷却)
9. cross_account_guard.py — 跨账号关联防护(防指纹/IP/UA 关联封号)
10. audit_logger.py       — 风控审计日志(可观测性,事后追溯)

深度强化层(2026-08-01 新增)— 从 17 类检测点扩展到 37+ 类:
11. stealth_advanced.py  — 高级反检测脚本(20 类深度检测点:字体/WebGL/Battery/Sensor 等)
12. behavior_samples.py  — 真人行为样本库(马尔可夫链 + 长尾分布,犹豫/修正/突发)
13. captcha_solver.py    — 验证码处理(滑块/点选/行为 + 第三方服务)
14. cookie_health.py     — Cookie 健康度监控(过期预警/自动刷新/失效检测)
15. content_dedup.py     — 内容指纹去重(SimHash + 同义词改写,多平台差异化)

设计原则:
- 每账号指纹/代理固定不变(同账号跨会话一致,避免异地登录告警)
- 不同账号零共享(IP/指纹/Cookie/UA/屏幕/时区全差异化)
- 类型严格(AGENTS.md §3 禁 any),mypy 0 错误
- 纯 async 接口(适配器用 async_playwright)
- 单例模式(多适配器共享同一管理器)

诚实边界:"零风险"技术上不可达(平台风控黑盒且进化),本模块目标是
"工业级低风险"—把风险压到接近真人手动操作水平。
"""
from .browser_factory import close_stealth_context, create_stealth_browser_context
from .account_profile import AccountProfile, get_account_profile
from .behavior_humanizer import (
    human_move_mouse,
    human_type,
    human_scroll,
    human_pause,
    simulate_reading,
    human_click,
    simulate_pre_publish_behavior,
    human_type_title,
    human_type_content,
    pre_submit_warmup,
    post_publish_dwell,
)
from .fingerprint_isolation import BrowserFingerprint, generate_fingerprint
from .proxy_pool import ProxyConfig, ProxyPool, ProxyPoolStats, get_proxy_pool
from .stealth import apply_stealth
from .risk_scoring import RiskScore, RiskScorer
from .cooldown_manager import CooldownState, CooldownManager, cooldown_duration_for_error
from .cross_account_guard import IsolationReport, BatchValidation, CrossAccountGuard
from .audit_logger import AuditEvent, AuditLogger
# 深度强化层(2026-08-01 新增)
from .stealth_advanced import apply_advanced_stealth
from .behavior_samples import HumanBehaviorSampler, ScrollStep, TypingEvent, get_sampler
from .captcha_solver import CaptchaSolver, CaptchaInfo, get_solver
from .cookie_health import CookieHealthMonitor, CookieHealth, ExpiryAlert, get_monitor
from .content_dedup import ContentDeduplicator, SimilarityReport, get_deduplicator

__all__ = [
    # 五层防线基础
    "create_stealth_browser_context",
    "close_stealth_context",
    "AccountProfile",
    "get_account_profile",
    "BrowserFingerprint",
    "generate_fingerprint",
    "ProxyConfig",
    "ProxyPool",
    "ProxyPoolStats",
    "get_proxy_pool",
    "apply_stealth",
    "human_move_mouse",
    "human_type",
    "human_scroll",
    "human_pause",
    "simulate_reading",
    "human_click",
    "simulate_pre_publish_behavior",
    "human_type_title",
    "human_type_content",
    "pre_submit_warmup",
    "post_publish_dwell",
    # 强化层(2026-07-31 新增)
    "RiskScore",
    "RiskScorer",
    "CooldownState",
    "CooldownManager",
    "cooldown_duration_for_error",
    "IsolationReport",
    "BatchValidation",
    "CrossAccountGuard",
    "AuditEvent",
    "AuditLogger",
    # 深度强化层(2026-08-01 新增)
    "apply_advanced_stealth",
    "HumanBehaviorSampler",
    "ScrollStep",
    "TypingEvent",
    "get_sampler",
    "CaptchaSolver",
    "CaptchaInfo",
    "get_solver",
    "CookieHealthMonitor",
    "CookieHealth",
    "ExpiryAlert",
    "get_monitor",
    "ContentDeduplicator",
    "SimilarityReport",
    "get_deduplicator",
]
