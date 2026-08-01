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

终极强化层(2026-08-01 新增)— 从 37 类扩展到 50+ 类深度检测点对抗:
16. device_graph_guard.py       — 设备关联图谱防护(4 维关联检测:指纹/IP/UA/Canvas)
17. canvas_noise.py             — Canvas 指纹噪声增强(getImageData/toDataURL/toBlob/readPixels)
18. audio_fingerprint.py        — AudioContext 指纹防护(getChannelData/getFloatFrequencyData)
19. webrtc_guard.py             — WebRTC IP 泄漏防护(RTCPeerConnection relay-only + verify_no_leak)
20. tls_fingerprint.py          — TLS 指纹(JA3)伪装咨询层(5 浏览器配置库,UA-TLS 一致性)
21. timezone_geo_consistency.py — 时区地理位置一致性校验(ip-api.com + 5 预设城市)
22. behavior_entropy.py         — 行为序列熵值检测对抗(香农熵/KL 散度/diversify 扰动)
23. font_enum_guard.py          — 字体枚举防护(document.fonts.check + Canvas 文本测量噪声)
24. media_devices_guard.py      — 多媒体设备指纹防护(enumerateDevices/getUserMedia/usb)
25. hardware_concurrency_guard.py — Hardware Concurrency/内存伪装(CPU/内存/connection/memory)
26. plugin_enum_guard.py        — 插件枚举防护(plugins/mimeTypes/permissions)
27. language_consistency.py     — 语言偏好一致性(language/languages/Intl.DateTimeFormat)
28. navigator_integrity.py      — 导航器属性完整性校验(webdriver/platform/vendor/chrome/defineProperty)

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
# 终极强化层(2026-08-01 新增)— 13 个反风控深度模块
from .device_graph_guard import DeviceGraphGuard, LinkageReport, get_device_graph_guard
from .canvas_noise import inject_canvas_noise
from .audio_fingerprint import inject_audio_fingerprint_guard
from .webrtc_guard import inject_webrtc_guard, verify_no_leak
from .tls_fingerprint import TLSProfile, get_tls_recommendation, apply_tls_recommendation_to_context
from .timezone_geo_consistency import (
    TimezoneGeoValidator,
    ConsistencyReport,
    GeoInfo,
    get_timezone_geo_validator,
    apply_consistency,
)
from .behavior_entropy import (
    BehaviorEntropyAnalyzer,
    EntropyReport,
    get_entropy_analyzer,
    BEHAVIOR_MOUSE,
    BEHAVIOR_CLICK,
    BEHAVIOR_TYPE,
)
from .font_enum_guard import inject_font_enum_guard
from .media_devices_guard import inject_media_devices_guard
from .hardware_concurrency_guard import inject_hardware_guard
from .plugin_enum_guard import inject_plugin_guard
from .language_consistency import inject_language_guard, validate_language_consistency
from .navigator_integrity import inject_navigator_integrity_guard

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
    # 终极强化层(2026-08-01 新增)— 13 个反风控深度模块
    "DeviceGraphGuard",
    "LinkageReport",
    "get_device_graph_guard",
    "inject_canvas_noise",
    "inject_audio_fingerprint_guard",
    "inject_webrtc_guard",
    "verify_no_leak",
    "TLSProfile",
    "get_tls_recommendation",
    "apply_tls_recommendation_to_context",
    "TimezoneGeoValidator",
    "ConsistencyReport",
    "GeoInfo",
    "get_timezone_geo_validator",
    "apply_consistency",
    "BehaviorEntropyAnalyzer",
    "EntropyReport",
    "get_entropy_analyzer",
    "BEHAVIOR_MOUSE",
    "BEHAVIOR_CLICK",
    "BEHAVIOR_TYPE",
    "inject_font_enum_guard",
    "inject_media_devices_guard",
    "inject_hardware_guard",
    "inject_plugin_guard",
    "inject_language_guard",
    "validate_language_consistency",
    "inject_navigator_integrity_guard",
]
