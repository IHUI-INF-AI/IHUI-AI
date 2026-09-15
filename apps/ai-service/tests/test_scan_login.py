# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""scan_login ScanTask 纯逻辑单元测试(2026-08-12 立,补齐 0 覆盖)。

覆盖不依赖浏览器/Redis 的部分:
- ScanTask.is_terminal: 终态判定(状态机)
- ScanTask.snapshot: 可序列化状态(has_qr/cookies_count 计算)
- 2026-09-16 补:_cookie_hits 前缀通配 + 平台配置完整性(38 平台与前端注册表对齐)
"""

from __future__ import annotations

from app.services.scan_login import (
    PLATFORM_SCAN_CONFIG,
    ScanTask,
    _cookie_hits,
    _url_is_login_page,
)


def _task(status: str) -> ScanTask:
    return ScanTask(task_id="t1", user_id="u1", platform="wechat", status=status)


# --- is_terminal ---


def test_is_terminal_terminal_statuses():
    """终态(success/failed/timeout/cancelled/expired)返回 True。"""
    for s in ("success", "failed", "timeout", "cancelled", "expired"):
        assert _task(s).is_terminal() is True, f"status={s} 应为终态"


def test_is_terminal_non_terminal_statuses():
    """非终态(pending/waiting_scan/scanned)返回 False。"""
    for s in ("pending", "waiting_scan", "scanned"):
        assert _task(s).is_terminal() is False, f"status={s} 不应为终态"


# --- snapshot ---


def test_snapshot_fields():
    """snapshot 返回完整可序列化字段。"""
    snap = _task("pending").snapshot()
    assert snap["task_id"] == "t1"
    assert snap["user_id"] == "u1"
    assert snap["platform"] == "wechat"
    assert snap["status"] == "pending"
    assert snap["has_qr"] is False
    assert snap["cookies_count"] == 0


def test_snapshot_has_qr_and_cookies():
    """qr_image_b64 非空 → has_qr=True;all_relevant_cookies 计数。"""
    t = ScanTask(
        task_id="t2",
        user_id="u1",
        platform="wechat",
        status="success",
        qr_image_b64="aGVsbG8=",
        all_relevant_cookies={"session": "abc", "token": "def"},
        account_id=42,
    )
    snap = t.snapshot()
    assert snap["has_qr"] is True
    assert snap["cookies_count"] == 2
    assert snap["account_id"] == 42
    # qr_image_b64 不应原样暴露(避免大 base64 撑爆 API 响应)
    assert "qr_image_b64" not in snap


# --- _cookie_hits(2026-09-16 新增:前缀通配支持) ---


def test_cookie_hits_exact_match():
    """精确匹配:min_len 内有效值命中,短值/缺失不命中。"""
    cfg = {"success_cookies": ["SUB", "MLOGIN"]}
    cookies = {"SUB": "abcdefgh", "MLOGIN": "0"}
    assert _cookie_hits(cfg, cookies) == ["SUB"]
    assert _cookie_hits(cfg, cookies, min_len=0) == ["SUB", "MLOGIN"]
    assert _cookie_hits(cfg, {}) == []


def test_cookie_hits_wildcard_prefix():
    """前缀通配:wordpress_logged_in_<hash> 带后缀 cookie 必须能命中(回归 2026-09-16)。"""
    cfg = {"success_cookies": ["wordpress_logged_in*"]}
    cookies = {
        "wordpress_logged_in_5c4e5f7a8b": "admin%7C1760000000%7Cabc123def",
        "wordpress_test_cookie": "WP%20Cookie%20check",
    }
    assert _cookie_hits(cfg, cookies) == ["wordpress_logged_in_5c4e5f7a8b"]
    # 未登录:仅存在游客 test cookie → 不命中
    assert _cookie_hits(cfg, {"wordpress_test_cookie": "WP"}) == []


def test_cookie_hits_wildcard_requires_value_length():
    """前缀通配仍受 min_len 约束(空值后缀不算有效会话)。"""
    cfg = {"success_cookies": ["wordpress_logged_in*"]}
    cookies = {"wordpress_logged_in_x": "ab"}
    assert _cookie_hits(cfg, cookies) == []
    assert _cookie_hits(cfg, cookies, min_len=0) == ["wordpress_logged_in_x"]


# --- 平台配置完整性(2026-09-16:批量扫码不再有"未找到配置"红项) ---

# 与前端 apps/web/src/lib/publish/platform-schemas.ts PLATFORM_SCHEMAS 的
# 38 个 platformId 保持一致(新增平台必须两边同步,否则批量扫码队列报红)
FRONTEND_PLATFORM_IDS = [
    "wordpress", "medium", "youtube", "bilibili", "wechat", "toutiao",
    "douyin", "kuaishou", "weibo", "zhihu", "csdn", "juejin",
    "xiaohongshu", "shipinhao", "cnblogs", "segmentfault", "oschina",
    "jianshu", "baijiahao", "qq", "dayihao", "netease", "sohu", "sina",
    "xigua", "haokan", "baidu_zhidao", "baidu_tieba", "douban", "36kr",
    "huxiu", "tmtmedia", "acfun", "lofter", "zhihu_daily", "people",
    "china_news", "hupu",
]


def test_all_frontend_platforms_have_scan_config():
    """前端注册表 38 个平台必须全部有扫码配置(缺一个批量扫码就报红)。"""
    missing = [pid for pid in FRONTEND_PLATFORM_IDS if pid not in PLATFORM_SCAN_CONFIG]
    assert not missing, f"缺扫码配置的平台: {missing}"


def test_every_scan_config_has_required_fields():
    """每个平台配置必须含 name/login_url/success_cookies 且非空。"""
    for pid, cfg in PLATFORM_SCAN_CONFIG.items():
        assert cfg.get("name"), f"{pid} 缺 name"
        assert (cfg.get("login_url") or "").startswith("https://"), f"{pid} login_url 非法"
        assert cfg.get("success_cookies"), f"{pid} 缺 success_cookies"
        assert cfg.get("success_url_pattern"), f"{pid} 缺 success_url_pattern"


def test_new_batch_platforms_configured():
    """2026-09-16 第五批:5 个 API/OAuth 平台扫码兜底。"""
    for pid in ("wordpress", "medium", "youtube", "toutiao", "wechat"):
        assert pid in PLATFORM_SCAN_CONFIG, f"{pid} 未配置扫码"
    wp = PLATFORM_SCAN_CONFIG["wordpress"]
    assert wp["success_cookies"] == ["wordpress_logged_in*"], "WordPress 必须用前缀通配"
    yt = PLATFORM_SCAN_CONFIG["youtube"]
    assert yt.get("require_url_match") is True, "YouTube 登录页在 Google 域,必须 URL 双重确认"


# --- URL 登录页判定(新平台回归) ---


def test_url_is_login_page_for_new_platforms():
    """youtube 落在 accounts.google.com 登录页 / medium m/signin → 登录页;
    登录成功落地页(wordpress.com/home / youtube.com / mp.weixin cgi-bin)→ 非登录页。"""
    assert _url_is_login_page("https://accounts.google.com/ServiceLogin?continue=...")
    assert _url_is_login_page("https://medium.com/m/signin")
    assert not _url_is_login_page("https://wordpress.com/home")
    assert not _url_is_login_page("https://www.youtube.com/")
    assert not _url_is_login_page("https://mp.weixin.qq.com/cgi-bin/home?t=home")
    # wordpress.com/log-in 连字符不触发 login 判定(现有 _url_is_login_page 的已知边界,记录行为)
    assert not _url_is_login_page("https://wordpress.com/log-in")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
