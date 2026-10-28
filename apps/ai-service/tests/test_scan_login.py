# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""scan_login ScanTask 纯逻辑单元测试(2026-08-12 立,补齐 0 覆盖)。

覆盖不依赖浏览器/Redis 的部分:
- ScanTask.is_terminal: 终态判定(状态机)
- ScanTask.snapshot: 可序列化状态(has_qr/cookies_count 计算)
- 2026-09-16 补:_cookie_hits 前缀通配 + 平台配置完整性(38 平台与前端注册表对齐)
- 2026-09-16 补:_parse_raw_cookies 手动导入 Cookie 三格式解析(JSON/cookies.txt/请求头)
- 2026-09-29 补:扫码 tab 顺序点击计划 + qq/sohu/zhihu_daily 死链实证修复 +
  ptlogin2 二维码(#qrlogin_img/ptqrshow)选择器次序
- 2026-09-30 补(出码提速守门):_entry_plan 的预算/短路/回调三态、_sel_clickable_now
  的可点判据与 bounding_box 反向锁、_browser_safe 过滤面、_click_selector_any_page
  的跨页与"新→旧"次序,以及"热路径不得再有固定等待"的源码级反向锁。
"""

from __future__ import annotations

import inspect
import io
import re
import time
import tokenize

from app.services import scan_login as scan_login_mod
from app.services.scan_login import (
    _DEFAULT_QR_READY_SELECTORS,
    _QR_ELEMENT_SELECTORS,
    PLATFORM_SCAN_CONFIG,
    ScanTask,
    _browser_safe,
    _browser_safe_selectors,
    _click_selector_any_page,
    _cookie_hits,
    _entry_plan,
    _extract_qr_image,
    _login_page_open_failure_message,
    _parse_raw_cookies,
    _qr_ready_selectors,
    _ready_probe,
    _sel_clickable_now,
    _task_from_dict,
    _task_to_dict,
    _url_is_login_page,
    _wait_for_page_ready,
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
    """snapshot 必须带全前端契约字段(2026-09-30 增 stage:出码进度阶梯)。"""
    snap = _task("waiting_scan").snapshot()
    for field in (
        "task_id",
        "user_id",
        "platform",
        "status",
        "message",
        "stage",
        "has_qr",
        "qr_updated_at",
        "cookies_count",
        "account_id",
        "created_at",
        "completed_at",
    ):
        assert field in snap, f"snapshot 缺字段 {field}: {sorted(snap)}"
    # 原有用例的取值断言一并保留(字段名对了但值取错同样会坏前端契约)
    loose = _task("pending").snapshot()
    assert loose["task_id"] == "t1"
    assert loose["user_id"] == "u1"
    assert loose["platform"] == "wechat"
    assert loose["status"] == "pending"
    assert loose["has_qr"] is False
    assert loose["cookies_count"] == 0


def test_snapshot_stage_defaults_to_booting_and_round_trips_through_redis():
    """进度阶梯的默认档与 Redis 往返:默认 booting(浏览器还没起来),
    写进 Redis 再读回来必须逐字一致 —— 多实例轮询读的是 Redis 那份,丢了就等于
    前端永远停在第一档(用户看到的还是"没变化")。"""
    task = _task("pending")
    assert task.snapshot()["stage"] == "booting"
    task.stage = "rendering"
    restored = _task_from_dict(_task_to_dict(task))
    assert restored.stage == "rendering"
    # 老版本写下的 Redis 快照没有 stage 字段:读回来必须退到 booting,而不是空串
    legacy = _task_to_dict(task)
    legacy.pop("stage")
    assert _task_from_dict(legacy).stage == "booting"


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


# --- 扫码 tab 选择器 / 二维码 iframe 候选(2026-09-29 回归) ---


def test_segmentfault_scan_tab_selector():
    """思否登录页默认密码表单,扫码入口是"微信登录"按钮 —— 必须按平台前置,否则二维码永远出不来。"""
    sf = PLATFORM_SCAN_CONFIG["segmentfault"]
    tabs = sf.get("scan_tab_selectors")
    assert tabs, "segmentfault 缺 scan_tab_selectors"
    assert any("微信登录" in s for s in tabs), f"segmentfault 的 tab 选择器未指向微信登录: {tabs}"


def test_scan_tab_selectors_shape():
    """所有平台声明的 scan_tab_selectors 必须是合法计划项:
    非空字符串,或"顺序点击计划"(非空元组/列表,元素全为非空字符串)—— 写错了等于没写。"""
    for pid, cfg in PLATFORM_SCAN_CONFIG.items():
        tabs = cfg.get("scan_tab_selectors")
        if tabs is None:
            continue
        assert isinstance(tabs, (tuple, list)) and tabs, f"{pid} scan_tab_selectors 为空"
        for item in tabs:
            if isinstance(item, str):
                assert item, f"{pid} scan_tab_selectors 含空字符串"
            else:
                assert isinstance(item, (tuple, list)) and item, f"{pid} 计划项非法: {item!r}"
                assert all(isinstance(s, str) and s for s in item), f"{pid} 计划项含非法选择器: {item!r}"


def test_qr_element_selectors_cover_wechat_qrconnect_iframe():
    """二维码候选必须含微信 qrconnect 内嵌 iframe(思否实测:主页面 img/canvas 全落空,
    码在 open.weixin.qq.com/connect/qrconnect 的 iframe 里 —— 截图合成像素,clip 外框即可)。"""
    joined = "\n".join(_QR_ELEMENT_SELECTORS)
    assert "iframe[src*=\"qrconnect\"]" in joined, "缺微信 qrconnect iframe 候选"
    # iframe 形态必须排在裸 canvas 之前(canvas 是最后兜底,先命中 iframe 才不会误裁装饰画布)
    assert _QR_ELEMENT_SELECTORS.index('iframe[src*="qrconnect"]') < _QR_ELEMENT_SELECTORS.index(
        "canvas"
    ), "iframe 候选必须先于裸 canvas 兜底"


def test_qr_element_selectors_cover_qq_ptlogin_img():
    """企鹅号 om.qq.com 实测:ptlogin2 快捷登录码是 <img id="qrlogin_img" class="qrImg"
    src=".../ptqrshow?...">,id/class 不含 "qrcode"、src 非 data:image,必须点名;
    且必须排在 img[data:image] 之前 —— 腾讯验证码框有 300×214 data:image 滑块底图,
    跨 frame 找码时先命中它就会误裁验证码。"""
    joined = "\n".join(_QR_ELEMENT_SELECTORS)
    assert "#qrlogin_img" in joined, "缺 ptlogin2 qrlogin_img 点名候选"
    assert 'img[src*="ptqrshow"]' in joined, "缺 ptqrshow 端点候选"
    data_idx = _QR_ELEMENT_SELECTORS.index('img[src^="data:image"]')
    assert _QR_ELEMENT_SELECTORS.index("#qrlogin_img") < data_idx, "qrlogin_img 必须先于 data:image 兜底"
    assert _QR_ELEMENT_SELECTORS.index('img[src*="ptqrshow"]') < data_idx, "ptqrshow 必须先于 data:image 兜底"


# --- 2026-09-29 死链平台实证修复(qq/sohu/zhihu_daily) ---


def test_qq_login_url_live_and_scan_plan():
    """企鹅号:/userAuth/login 已 404(实测),换 /userAuth/index;扫码计划 =
    点 QQ登录 tab → 点协议层"同意"(a.layui-layer-btn0),顺序计划形态。"""
    qq = PLATFORM_SCAN_CONFIG["qq"]
    assert qq["login_url"] == "https://om.qq.com/userAuth/index"
    plans = qq.get("scan_tab_selectors")
    assert plans and isinstance(plans[0], (tuple, list)), f"qq 缺顺序点击计划: {plans!r}"
    joined = " ".join(plans[0])
    assert "QQ登录" in joined, "计划必须点 QQ登录 tab(与 p_skey/ptcz 同源)"
    assert "layui-layer-btn0" in joined, "计划必须点协议层同意按钮"


def test_sohu_login_url_live_and_scan_plan():
    """搜狐号:/mp/login 404(实测),换首页;扫码计划 = 点"登录"弹层 →
    点"其他方式"微信圆标(.third .wx)。"""
    sohu = PLATFORM_SCAN_CONFIG["sohu"]
    assert sohu["login_url"] == "https://mp.sohu.com/"
    plans = sohu.get("scan_tab_selectors")
    assert plans and isinstance(plans[0], (tuple, list)), f"sohu 缺顺序点击计划: {plans!r}"
    joined = " ".join(plans[0])
    assert "navigation-login-wrap" in joined, "计划必须点首页登录入口"
    assert ".third .wx" in joined, "计划必须点其他方式排的微信图标"


def test_zhihu_daily_reuses_zhihu_login():
    """知乎日报:daily.zhihu.com/login 404(实测),日报无独立 Web 登录 ——
    复用知乎主站扫码页;z_c0 种在 .zhihu.com 天然覆盖 daily 子域。"""
    zd = PLATFORM_SCAN_CONFIG["zhihu_daily"]
    zh = PLATFORM_SCAN_CONFIG["zhihu"]
    assert zd["login_url"] == zh["login_url"], "日报必须复用知乎主站登录页"
    assert zd["success_cookies"] == ["z_c0"]
    assert "zhihu\\.com" in zd["success_url_pattern"], "成功 URL 判定须覆盖主站落地页"


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


# --- _parse_raw_cookies(2026-09-16 新增:手动导入三格式解析) ---


def test_parse_raw_cookies_json_object():
    """JSON 对象(DevTools 扩展导出)→ k/v dict,空值剔除。"""
    raw = '{"SESSDATA": "abc123", "buvid3": "xyz", "empty": ""}'
    assert _parse_raw_cookies(raw) == {"SESSDATA": "abc123", "buvid3": "xyz"}


def test_parse_raw_cookies_json_array():
    """JSON 数组([{name, value}, ...])→ 按 name/value 提取。"""
    raw = '[{"name": "SUB", "value": "1"}, {"name": "SUBP", "value": "2"}, {"bad": "x"}]'
    assert _parse_raw_cookies(raw) == {"SUB": "1", "SUBP": "2"}


def test_parse_raw_cookies_netscape_txt():
    """Netscape cookies.txt(Tab 分列):注释行跳过,#HttpOnly_ 前缀剥掉后仍提取。"""
    raw = (
        "# Netscape HTTP Cookie File\n"
        ".zhihu.com\tTRUE\t/\tTRUE\t1800000000\td_c0\tabc\n"
        "#HttpOnly_.zhihu.com\tTRUE\t/\tTRUE\t1800000000\tz_c0\tdef\n"
    )
    assert _parse_raw_cookies(raw) == {"d_c0": "abc", "z_c0": "def"}


def test_parse_raw_cookies_header_format():
    """请求头格式 k=v; k2=v2,容忍换行分隔(DevTools 多行复制)。"""
    raw = 'SESSDATA=abc; buvid3=xyz\n bili_ticket=tkt'
    assert _parse_raw_cookies(raw) == {"SESSDATA": "abc", "buvid3": "xyz", "bili_ticket": "tkt"}


def test_parse_raw_cookies_empty_and_invalid():
    """空输入/无等号垃圾文本 → 空 dict(由路由层报 400)。"""
    assert _parse_raw_cookies("") == {}
    assert _parse_raw_cookies("   ") == {}
    assert _parse_raw_cookies("这不是 cookie 文本") == {}


# --- 2026-09-30 oschina 微信码接入 + 官方码 JPEG 直取 + 站点故障可读化 ---


def test_oschina_login_url_live_and_wechat_plan():
    """开源中国:旧 /action/user/hash_login 已废弃(curl 直连 403,带 referer 404),
    首页「登录/注册」现指向 /home/login;该页有微信登录,但**必须先勾协议**,
    否则前端直接吞掉微信图标点击(实测 0 请求 0 跳转)。"""
    osc = PLATFORM_SCAN_CONFIG["oschina"]
    assert osc["login_url"] == "https://www.oschina.net/home/login", "login_url 仍是废弃的 hash_login"
    plans = osc.get("scan_tab_selectors")
    assert plans and isinstance(plans[0], (tuple, list)), f"oschina 缺顺序点击计划: {plans!r}"
    steps = list(plans[0])
    assert len(steps) == 2, f"oschina 计划须两步(勾协议→点微信),实得 {steps!r}"
    agree, wechat = steps
    # 协议步必须是"视觉盒"那一档:点 input 被 antd 覆盖层挡住(Playwright 命中检测失败),
    # 点整条 label 会落在中心的《服务条例》链接上(clicked=True 而 checked 不变)。
    assert "login-agreement" in agree and "ant-checkbox" in agree, f"协议步选择器不对: {agree!r}"
    assert not agree.startswith("input."), f"协议步不得点裸 input(实测点不中): {agree!r}"
    assert agree.strip() != "label.login-agreement", "协议步不得点整条 label(会命中条款链接)"
    assert "icon-wx" in wechat, f"第二步必须点微信图标 #icon-wx: {wechat!r}"
    # 码图直取:微信码是 img[src*=connect/qrcode],拿到的是官方原图而非登录页截图
    assert any("connect/qrcode" in s for s in osc.get("qr_image_selectors", ())), (
        f"oschina 缺微信官方码 img 选择器: {osc.get('qr_image_selectors')!r}"
    )


class _FakeLoc:
    def __init__(self, src: str, idxs: list[int]) -> None:
        self._src = src
        self._idxs = idxs

    def evaluate_all(self, _expr: str) -> list[int]:
        return self._idxs

    def nth(self, _i: int) -> _FakeLoc:
        return self

    def evaluate(self, _expr: str) -> str:
        return self._src


class _FakePage:
    def __init__(self, src: str) -> None:
        self._src = src

    def locator(self, _sel: str) -> _FakeLoc:
        return _FakeLoc(self._src, [0])


def test_extract_qr_image_accepts_jpeg_official_qr(monkeypatch):
    """微信官方码(connect/qrcode)下发的是 **JPEG**。只认 PNG 魔数会把 oschina 这类
    "能直取官方原图"的平台白退回截图 —— 与用户要的"所有码都直接获取"正相反。"""
    import httpx

    jpeg = b"\xff\xd8\xff\xe0fakejpegbytes"
    calls: list[str] = []

    def fake_get(url: str, **_kw):
        calls.append(url)

        class R:
            status_code = 200
            content = jpeg

            headers = {"content-type": "image/jpeg"}

        return R()

    monkeypatch.setattr(httpx, "get", fake_get)
    src = "https://open.weixin.qq.com/connect/qrcode/001IICD01oGwll2t"
    got = _extract_qr_image(_FakePage(src), ('img[src*="connect/qrcode"]',))
    assert calls == [src], "必须真的去服务端拉官方码,而不是退回截图"
    assert got, "JPEG 官方码必须被接受"
    import base64

    assert base64.b64decode(got) == jpeg


def test_extract_qr_image_still_rejects_non_image(monkeypatch):
    """反向对照:上面那条放宽 JPEG 不得把"根本不是图"的响应也放过来 ——
    否则 WAF 拦截页/错误 JSON 会被当二维码投给用户(比截图更糟的静默失败)。"""
    import httpx

    def fake_get(_url: str, **_kw):
        class R:
            status_code = 200
            content = b"<html>blocked by waf</html>"

        return R()

    monkeypatch.setattr(httpx, "get", fake_get)
    assert _extract_qr_image(_FakePage("https://example.test/qr"), ("img",)) is None


def test_login_page_open_failure_message_marks_site_fault():
    """站点级故障(ERR_CONNECTION_CLOSED / DNS / 超时)要说"平台侧问题,非本系统"。
    实测载体:人民网 login.peopleweb.com.cn 对本机网络完全不可达。"""

    class PageErr(Exception):
        pass

    msg = _login_page_open_failure_message(
        PageErr("Page.goto: net::ERR_CONNECTION_CLOSED at https://login.peopleweb.com.cn/")
    )
    assert "非本系统问题" in msg, msg
    assert "ERR_CONNECTION_CLOSED" not in msg, "站点故障不该把原始错误码丢给用户"
    # TimeoutError 同族(oschina 旧路径被 WAF 挂到 30s 超时即此型)
    assert "非本系统问题" in _login_page_open_failure_message(TimeoutError("Timeout 30000ms exceeded"))


def test_login_page_open_failure_message_keeps_our_own_errors():
    """反向对照:非连接类异常必须保留类型名与原文 —— 那是我们该修的,
    糊成"平台故障"等于替自己的缺陷遮责。"""

    class SelectorErr(Exception):
        pass

    msg = _login_page_open_failure_message(SelectorErr('waiting for locator "#nope"'))
    assert "打开登录页失败" in msg and "SelectorErr" in msg and "#nope" in msg, msg


# ---------------------------------------------------------------------------
# 2026-09-30 出码提速:把"固定等 N 秒"换成"就绪即走"的那套判据。
#
# 立因(本机实测,platform=toutiao_app):sync_playwright+launch+context+goto ≈ 1.25s,
# 而 goto 后固定 3s + 切 tab 后固定 1.5s + 截图前固定 2s = 6.5s ⇒ 首个二维码 7.8s 才可用。
# 下面几条钉住替换后的三个不变量:① 候选全落空时**行为与旧版等价**(等满就走,不抛异常、
# 不把任务判死);② Playwright 专有语法不得被送进 querySelectorAll(白跑往返);
# ③ 就绪即走的短路必须真的短路(不是"看完所有候选才返回")。
# ---------------------------------------------------------------------------
class _ReadyFakePage:
    """只实现被探测用到的两个方法:evaluate(批量选择器)与 wait_for_timeout(等待步进)。"""

    def __init__(self, answers: list[bool] | None = None) -> None:
        self.answers = list(answers or [])
        self.evaluate_calls: list[dict] = []
        self.waits: list[int] = []

    def evaluate(self, _expr: str, arg: dict) -> bool:
        self.evaluate_calls.append(arg)
        if self.answers:
            return self.answers.pop(0)
        return False

    def wait_for_timeout(self, ms: int) -> None:
        self.waits.append(ms)


def test_wait_for_page_ready_returns_false_without_raising_when_nothing_matches():
    """全落空 ⇒ 等满上限后返回 False。旧实现是"固定等满照样往下走",这条保证替换后
    不会把"没等到"变成异常/任务失败(那才是比慢更糟的回归)。"""
    page = _ReadyFakePage()
    ok = _wait_for_page_ready(page, ('[class*="qrcode"] img',), timeout_s=0.3)
    assert ok is False
    assert page.waits, "必须真的等过(轮询步进),不是立刻放弃"
    assert all(ms == 120 for ms in page.waits), page.waits
    assert len(page.evaluate_calls) >= 2, "应当是轮询多次探测,而不是只探一次"


def test_wait_for_page_ready_short_circuits_on_first_hit():
    """就绪即走:第一探没中、第二探命中 ⇒ 立刻返回 True,后续轮询一次都不多余。"""
    page = _ReadyFakePage([False, True])
    ok = _wait_for_page_ready(page, ('[class*="qrcode"] img',), timeout_s=5.0)
    assert ok is True
    assert len(page.evaluate_calls) == 2, page.evaluate_calls
    assert len(page.waits) == 1, f"命中后不该再等: {page.waits}"


def test_ready_probe_filters_playwright_only_selectors():
    """Playwright 专有语法(text= / :has-text())在 document.querySelectorAll 里是
    SyntaxError。送进去只是白跑一次往返(evaluate 必 reject),所以要在 Python 侧滤掉;
    同时保证合法的 CSS 候选一个都不能被误滤。"""
    page = _ReadyFakePage([True])
    _ready_probe(page, ('text=扫码登录', 'div:has-text("扫码")', '[class*="qrcode"] img'))
    assert page.evaluate_calls, "滤完之后仍有合法候选,必须真的探测"
    sels = page.evaluate_calls[0]["sels"]
    assert '[class*="qrcode"] img' in sels
    assert not [s for s in sels if "text=" in s or ":has-text(" in s], sels


def test_ready_probe_skips_evaluate_when_all_candidates_are_playwright_only():
    """反向对照:全是 Playwright 语法时不该发那次注定失败的 evaluate(省下的是往返)。"""
    page = _ReadyFakePage([True])
    assert _ready_probe(page, ('text=扫码登录',)) is False
    assert page.evaluate_calls == []


def test_qr_ready_selectors_put_platform_selectors_first_and_dedupe():
    """平台点名的选择器必须排在通用默认之前(它更准,先命中就少等),且同值不重复问。"""
    cfg = {
        "qr_image_selectors": ('img.qrcode-img',),
        "qr_element_screenshot": "#animate_qrcode_container",
    }
    sels = _qr_ready_selectors(cfg)
    assert sels[0] == "img.qrcode-img" and sels[1] == "#animate_qrcode_container"
    assert '[class*="qrcode"] img' in sels, "通用默认必须仍在(平台没配时的兜底)"
    assert len(sels) == len(set(sels)), "去重保序:同一选择器重复问只是白跑往返"


def test_qr_ready_selectors_accept_string_and_sequence_config_shapes():
    """配置两种写法(字符串 / 序列)都要吃得住 —— 平台表里两种形态都真实存在。"""
    assert _qr_ready_selectors({"qr_element_screenshot": "#x"})[:1] == ("#x",)
    assert _qr_ready_selectors({"qr_image_selectors": ("a", "b")})[:2] == ("a", "b")
    assert _qr_ready_selectors({}) == _DEFAULT_QR_READY_SELECTORS


# ---------------------------------------------------------------------------
# 2026-09-30 出码提速(第二轮)守门:入口轮询 / 可点判据 / 浏览器安全选择器 / 热路径反向锁。
#
# 立因(本机实测,platform=toutiao_app 等):出码慢的那几秒**八成不是页面慢,是代码在
# 固定 sleep** —— 点入口前无条件等(配了点名入口 4s / 没配 1.2s)、点完再固定 1.5s、
# goto 后固定 3s、截图前固定 2s,合计把每个平台钉在 3.5~8s,而实测入口最早 1.5s 就可点。
# 替换成"分段各有上限、命中即走"(`_entry_plan` / `_wait_for_page_ready`)之后,正确性
# 有两个方向都会坏,所以下面每条都按**正例 + 反例**成对写:
#   慢的一侧:轮询没真的短路 ⇒ 白等(用例钉"命中即走、不再等任何一步");
#   乱的一侧:① 点到过却返回 False ⇒ 调用方补点一次,页面被点成另一种形态(码层被点掉);
#             ② 可点判据改用 `bounding_box()` ⇒ 每次判定自带 30s 隐式等待,预算被白等光。
#
# 三次变异取证(每条断言都用"故意改坏实现"验过会翻红,实现随后逐字还原;三次都只改
# scan_login.py 的临时副本,仓库文件一字未动):
#   变异 1 `_sel_clickable_now` 的 `is_visible()` 换成 `bounding_box()` 量尺寸
#          ⇒ test_sel_clickable_now_hit_miss_and_exceptions +
#            test_sel_clickable_now_must_not_use_bounding_box 双红;
#   变异 2 `_entry_plan` 预算尽头的 `return clicked_once` 改成 `return False`
#          ⇒ test_entry_plan_returns_true_when_clicked_but_qr_never_appears 红;
#   变异 3 在热路径 `_pre_wait_sels` 之前插一行 `page.wait_for_timeout(3000)`
#          ⇒ test_hot_path_has_no_unconditional_fixed_wait_around_entry_click 红。
# ---------------------------------------------------------------------------


class _ScanFakeLocator:
    """`_sel_clickable_now` 与 `_click_selector_any_page` 用到的 locator 语义子集。

    只实现被测函数真正会调的三件事:count() / first.is_visible() / first.click()。
    `bounding_box()` 刻意**抛错**:热路径调用它本身就是缺陷(自带 30s 隐式等待),
    让它既报错又记账,改坏实现时两条断言会一起红。
    """

    def __init__(self, page: _ScanFakePage, selector: str, first: bool = False) -> None:
        self._page = page
        self._selector = selector
        self._first = first

    @property
    def first(self) -> _ScanFakeLocator:
        return _ScanFakeLocator(self._page, self._selector, True)

    def count(self) -> int:
        if self._page.count_exc is not None:
            raise self._page.count_exc
        return self._page.counts.get(self._selector, 0)

    def is_visible(self) -> bool:
        exc = self._page.visible_exc.get(self._selector)
        if exc is not None:
            raise exc
        return self._selector in self._page.visible

    def bounding_box(self) -> dict[str, float]:
        self._page.box_calls += 1
        raise AssertionError("热路径不得调用 bounding_box(自带 30s 隐式等待)")

    def click(self, timeout: float | None = None, force: bool = False) -> None:
        if self._page.click_exc is not None:
            raise self._page.click_exc
        self._page.clicks.append(self._selector)


class _ScanFakePage:
    """一个"最小 Playwright 页面":只实现被测函数真正用到的语义。

    - `locator(sel).count()` / `.first.is_visible()`:由 counts / visible 两张表决定 ——
      count 只管"存不存在",visible 只管"看不看得见"(与 Playwright 的语义分工一致);
    - `.first.click()`:记录到 clicks;click_exc 非空则抛(模拟被遮罩拦住,实测头条
      ttp-modal-mask 就这一型);
    - `evaluate(...)`:码是否就绪(`_ready_probe` 的出口);只记次数与最近一次入参,
      不累积 —— 轮询失败路径上它会在一两秒里被调用几十万次;
    - `wait_for_timeout(...)`:只记账不真等(等待由真实时钟在 `_entry_plan` /
      `_wait_for_page_ready` 的 deadline 上推进),同样只留计数与去重值。
    """

    def __init__(
        self,
        *,
        counts: dict[str, int] | None = None,
        visible: set[str] | None = None,
        ready: bool = False,
        ready_after_click: bool = False,
        count_exc: Exception | None = None,
        visible_exc: dict[str, Exception] | None = None,
        click_exc: Exception | None = None,
    ) -> None:
        self.counts = dict(counts or {})
        self.visible = set(visible or ())
        self.ready = ready
        self.ready_after_click = ready_after_click
        self.count_exc = count_exc
        self.visible_exc = dict(visible_exc or {})
        self.click_exc = click_exc
        self.clicks: list[str] = []
        self.wait_count = 0
        self.waited_ms: set[int] = set()
        self.ready_probes = 0
        self.last_probe: dict = {}
        self.box_calls = 0

    def mark_clickable(self, *selectors: str) -> None:
        """把这些选择器标成"现在可点"(count≥1 且 is_visible=True)。"""
        for sel in selectors:
            self.counts[sel] = 1
            self.visible.add(sel)

    def locator(self, selector: str) -> _ScanFakeLocator:
        return _ScanFakeLocator(self, selector)

    def evaluate(self, _expr: str, arg: dict | None = None) -> bool:
        self.ready_probes += 1
        self.last_probe = arg or {}
        return self.ready or bool(self.ready_after_click and self.clicks)

    def wait_for_timeout(self, ms: int) -> None:
        self.wait_count += 1
        self.waited_ms.add(ms)


class _ScanFakeContext:
    """只有 pages 属性的上下文:顺序 = Playwright 的创建序(主页在首位,最新页在末尾)。"""

    def __init__(self, pages: list[_ScanFakePage]) -> None:
        self.pages = pages


# --- _sel_clickable_now(可点判据 + bounding_box 反向锁) ---


def test_sel_clickable_now_hit_miss_and_exceptions():
    """正反例一次钉全:有可见元素 → True;`count()==0` → False;
    `is_visible()` 抛异常 → False(异常绝不能漏出热路径 —— 漏出去就是任务被判 failed);
    选择器语法非法(count() 抛 Playwright 的 Error)→ False。

    立因:入口轮询每一轮都要问一次"现在可点吗",这条判据一旦把异常抛出来,首轮探测
    就会把整个扫码任务打成"扫码登录异常",而它本该只是"还没渲染好,下一轮再问"。
    """
    page = _ScanFakePage()
    page.mark_clickable("a.login-button")
    assert _sel_clickable_now(page, "a.login-button") is True

    # 反例一:页面上根本没有这个元素(SSR 还没渲染出来)
    assert _sel_clickable_now(_ScanFakePage(), "a.login-button") is False

    # 反例二:元素在,但可见性判定抛异常(页面已导航 / execution context destroyed)
    broken = _ScanFakePage(
        counts={"a.login-button": 1},
        visible_exc={"a.login-button": RuntimeError("Execution context was destroyed")},
    )
    assert _sel_clickable_now(broken, "a.login-button") is False

    # 反例三:选择器语法非法 —— Playwright 在 count() 阶段就抛,必须吞掉当"未就绪"
    bad_syntax = _ScanFakePage(count_exc=ValueError("Unexpected token while parsing selector"))
    assert _sel_clickable_now(bad_syntax, "span:has-text(未闭合") is False


def test_sel_clickable_now_must_not_use_bounding_box():
    """判据锁:**可点判定不得改用 `bounding_box()`**(本轮实测踩过的坑)。

    立因:`bounding_box()` 自带 **30s 隐式等待** —— 入口还没渲染出来时它干等满 30s,
    抖音/头条实测因此把整个"点入口 + 等码"的预算(2~2.5s)白等光,任务看起来像卡死。
    本函数要的是**不等待**的即时判定,Playwright 侧就是 `is_visible()`。
    变异取证:把实现换回 bounding_box 量尺寸 ⇒ fake 的 bounding_box 既记账又抛错,
    返回 False 与 `box_calls==0` 两条断言同时翻红。
    """
    page = _ScanFakePage()
    page.mark_clickable("a.login-button")
    assert _sel_clickable_now(page, "a.login-button") is True
    assert page.box_calls == 0, "热路径可点判据碰了 bounding_box(自带 30s 隐式等待)"


# --- _browser_safe(送进 querySelectorAll 前的过滤面) ---


def test_browser_safe_filters_playwright_only_and_keeps_all_css():
    """`text=` / `:has-text(` 必须被滤掉,合法 CSS **一个都不能误滤**。

    立因:这批候选最终由 `document.querySelectorAll` 执行,Playwright 专有语法在那里是
    SyntaxError —— 送进去只是把"一次批量探测"变成"一次必然失败的往返"(每个候选一次)。
    反向同样致命:多滤掉一个合法 CSS 就等于少等一个真实码载体,直接拖慢出码。
    两处入口(`_browser_safe` 与旧名 `_browser_safe_selectors`)必须同形:热路径的
    `_ready_probe` 走的正是旧名那个别名,只改一处的话过滤只在半边生效。

    已知边界(不在此断言,已在审计里登记):`span:text("…")` 这种 `:text(` 形式不在
    当前正则里;它现在只出现在 scan_tab_selectors(喂 Playwright locator),不进本函数的
    输入面,所以今天不触发。
    """
    legit = [
        '[class*="qrcode"] img',
        '[id*="qrcode"]',
        'img[src^="data:image"]',
        'iframe[src*="qrconnect"]',
        "span.btn.wechat",
        ".tip-text.wechat",
        "label.login-agreement span.ant-checkbox",
        "svg:has(use[*|href*='icon-wx'])",  # :has( 不是 :has-text(,必须保留
        "#animate_qrcode_container",
    ]
    pw_only = ['text=立即登录', 'span:has-text("微信登录")', 'a:has-text("扫码")']
    assert _browser_safe([*legit, *pw_only]) == legit
    assert _browser_safe_selectors([*legit, *pw_only]) == legit, "旧名别名过滤面漂了"
    # 空串是"没写选择器",同样不该送进浏览器
    assert _browser_safe(["", *legit]) == legit
    # 全是 Playwright 语法 ⇒ 一个都不剩(调用方据此跳过那次注定失败的探测)
    assert _browser_safe(list(pw_only)) == []


# --- _click_selector_any_page(跨页点掉入口) ---


def test_click_selector_any_page_falls_back_to_other_page():
    """主页不可点 / 点不中 → 必须落到其它页面点掉(sohu 登录层 window.open 新窗形态);
    全部不可点 → False(调用方按计划继续,不抛异常)。

    反例形态:主页上元素**可见但点不中**(被遮罩拦住 → click 抛异常)—— 与"找不到元素"
    必须走同一条兜底,否则新窗里的弹层永远没人点。
    """
    main = _ScanFakePage()
    second = _ScanFakePage()
    second.mark_clickable(".third .wx")
    assert _click_selector_any_page(_ScanFakeContext([main, second]), ".third .wx") is True
    assert second.clicks == [".third .wx"]
    assert main.clicks == [], "主页不可点就不该留下点击记录"

    blocked = _ScanFakePage(click_exc=RuntimeError("element intercepted by mask"))
    blocked.mark_clickable(".third .wx")
    fallback = _ScanFakePage()
    fallback.mark_clickable(".third .wx")
    assert _click_selector_any_page(_ScanFakeContext([blocked, fallback]), ".third .wx") is True
    assert fallback.clicks == [".third .wx"], "主页点不中必须换下一页,而不是放弃"

    assert _click_selector_any_page(_ScanFakeContext([_ScanFakePage()]), ".third .wx") is False
    assert _click_selector_any_page(_ScanFakeContext([]), ".third .wx") is False


def test_click_selector_any_page_prefers_newest_page():
    """主页之后按"新→旧"试(`context.pages` 是创建序,旧在前):新窗通常才是弹层所在那页。

    正反例都在一条里:两页都可点时只看最新的那页、旧页一次都不碰;若实现退回"创建序",
    点中的就会是旧页,本断言翻红。
    """
    main = _ScanFakePage()
    older = _ScanFakePage()
    older.mark_clickable(".third .wx")
    newest = _ScanFakePage()
    newest.mark_clickable(".third .wx")
    assert _click_selector_any_page(_ScanFakeContext([main, older, newest]), ".third .wx") is True
    assert newest.clicks == [".third .wx"]
    assert older.clicks == [], "主页之后应当先试最新的页(context.pages 末尾)"


# --- _entry_plan(预算 / 短路 / 顺序计划 / 回调) ---


def test_entry_plan_returns_true_on_first_hit_without_touching_other_candidates():
    """① 正例:第一轮第一项就可点、点完码立刻就绪 ⇒ 返回 True,且后面的候选**一次都不碰**。

    立因:多点一次入口不只是白花时间 —— 抖音/头条实测会把页面自己弹好的码层点掉,
    所以"命中即返回"是行为要求,不是性能优化。同时断言 `wait_count==0`:
    命中之后不该再等任何一步(这就是省下来的那 3.5~8s 的来源)。
    """
    page = _ScanFakePage(ready_after_click=True)
    page.mark_clickable("a.login-button")
    seen: list[list[str]] = []
    ok = _entry_plan(
        page,
        _ScanFakeContext([page]),
        ["a.login-button", "#never-touched"],
        wait_s=5.0,
        qr_sels=('[class*="qrcode"] img',),
        on_click=seen.append,
    )
    assert ok is True
    assert page.clicks == ["a.login-button"], f"不得再点别的候选: {page.clicks}"
    assert seen == [["a.login-button"]]
    assert page.wait_count == 0, "命中即返回,不该再等任何一步"


def test_entry_plan_spends_full_budget_and_returns_false_when_nothing_clickable():
    """② 反例(与旧版等价的那一半):候选一直不可点 ⇒ 等满 `wait_s` 返回 False,
    不抛异常、不误报成功。返回 False 的语义是"调用方按原兜底继续",不是任务失败。

    正反例对照:同一份 plans,只要其中一个可点,后面那条用例就返回 True —— 两条一起
    才能证明 False 不是"永远返回 False"。
    """
    page = _ScanFakePage()
    started = time.monotonic()
    ok = _entry_plan(
        page,
        _ScanFakeContext([page]),
        ["a.login-button", ("s1", "s2")],
        wait_s=0.05,
        qr_sels=("img.qr",),
    )
    elapsed = time.monotonic() - started
    assert ok is False
    assert page.clicks == []
    assert page.wait_count > 0, "必须真的轮询等待过,而不是立刻放弃"
    assert page.waited_ms == {120}, f"轮询步进应为 120ms: {page.waited_ms}"
    assert elapsed >= 0.05, "必须等满预算(预算耗尽才是调用方兜底的时机)"


def test_entry_plan_sequential_plan_clicks_only_the_ready_step():
    """③ 顺序点击计划(元组):第一步可点、第二步暂不可点 ⇒ 只点第一步,第二步一次不点。

    立因:这类计划是"点 tab → 点协议层同意"(抖手/搜狐/企鹅号)的通用形态,第二步在第一步
    生效前**根本不存在**;若被点中就是点了别的元素(实测 oschina 点整条 label 会命中《服务条例》
    链接)。码始终不出也必须收敛 —— 预算耗尽就返回,不得死循环。
    """
    page = _ScanFakePage()
    page.mark_clickable("span.tab-text")
    calls: list[list[str]] = []
    started = time.monotonic()
    ok = _entry_plan(
        page,
        _ScanFakeContext([page]),
        [("span.tab-text", "a.layui-layer-btn0")],
        wait_s=0.05,
        qr_sels=("img.qr",),
        on_click=calls.append,
    )
    elapsed = time.monotonic() - started
    assert ok is True, "点到过就必须返回 True(返回 False 会诱导调用方补点)"
    assert page.clicks, "前置条件:第一步确实被点到过"
    assert set(page.clicks) == {"span.tab-text"}, f"第二步暂不可点,一次都不该被点: {page.clicks}"
    assert all(c == ["span.tab-text"] for c in calls), calls
    assert elapsed < 5.0, "预算耗尽必须收敛,不得死循环"


def test_entry_plan_on_click_receives_actually_clicked_selectors_in_order():
    """④ `on_click` 必须收到**实际点到**的选择器清单,顺序 = 计划内的点击顺序,
    不含"不存在/不可点/没点中"的项 —— 它是排查"到底点了哪个入口"的唯一证据。"""
    page = _ScanFakePage(ready_after_click=True)
    page.mark_clickable("first-step", "second-step")
    calls: list[list[str]] = []
    ok = _entry_plan(
        page,
        _ScanFakeContext([page]),
        [("first-step", "missing-step", "second-step")],
        wait_s=5.0,
        qr_sels=("img.qr",),
        on_click=calls.append,
    )
    assert ok is True, calls
    assert calls == [["first-step", "second-step"]], f"回调清单必须只含实际点到且保序: {calls}"
    assert page.clicks == ["first-step", "second-step"]


def test_entry_plan_returns_true_when_clicked_but_qr_never_appears():
    """⑤ 关键反例(比慢更糟的那一半):点到了入口、但码始终没出现 ⇒ 预算尽头必须返回
    **True**,绝不是 False。

    立因:False 的语义是"我没点到",调用方会据此再补点一次 —— 页面形态被点乱
    (实测抖音/头条会把已经弹好的码层点掉),用户看到的是永远出不来的码。
    "点到过"与"码出来了"是两件事:前者是**已经发生的副作用**,返回 False 等于把它抹掉。
    变异取证:把预算尽头的 `return clicked_once` 改成 `return False` ⇒ 本用例翻红。
    """
    page = _ScanFakePage()
    page.mark_clickable("a.login-button")  # 可点,但 ready 恒 False(码一直不出来)
    ok = _entry_plan(
        page,
        _ScanFakeContext([page]),
        ["a.login-button"],
        wait_s=0.05,
        qr_sels=("img.qr",),
    )
    assert page.clicks, "前置条件:确实点到过(否则这条测的就不是这个分支)"
    assert ok is True, "点到过就必须返回 True —— 返回 False 会让调用方补点、打乱页面"


# --- 反向锁:热路径不得再有固定等待(源码级) ---


def _entry_path_source() -> str:
    """取 `_run_scan_task` 里"打开登录页 → 出码就绪"这一段(不含后面的扫码轮询循环)。

    边界锚点是进度阶梯的 `task.stage = "rendering"`;它之后才进轮询循环,而循环里那个
    `wait_for_timeout(1500)` 是**检测节奏**(每 1.5s 查一次登录态),不是"点入口前后的
    无条件等",刻意不在本锁范围内 —— 把检测节奏也锁掉会变成一条逼人绕过钩子的恒红门。
    """
    src = inspect.getsource(scan_login_mod._run_scan_task)
    marker = 'task.stage = "rendering"'
    assert marker in src, f"出码路径的进度锚点不见了({marker}),无法定位热路径"
    return src.split(marker)[0]


def _entry_path_code() -> str:
    """把上段源码里的**注释 token** 去掉,只留代码。

    必须这么做:这段解释性注释**本身就会引用被禁的写法**来说明它是怎么被拿掉的
    ("goto 之后的 `wait_for_timeout(3000)` 是第三块大固定等待")。按原文正则扫会把
    "说明"判成"违规",那是一条与真实改动无关的恒红门 —— 唯一结局是逼人删解释或绕过钩子。
    """
    src = _entry_path_source()
    return " ".join(
        tok.string
        for tok in tokenize.generate_tokens(io.StringIO(src).readline)
        if tok.type != tokenize.COMMENT
    )


def test_hot_path_has_no_unconditional_fixed_wait_around_entry_click():
    """反向锁(源码级):出码热路径里不得再出现固定 `wait_for_timeout(3000)` /
    `wait_for_timeout(1500)` 这类"点入口前后无条件等"。

    **为什么锁它**:这正是各平台被钉在 3.5~8s 的**根因** —— 旧写法在点入口前无条件
    sleep(配了点名入口 4s / 没配 1.2s)、点完再固定 1.5s;goto 之后那句固定 3s 同理
    (实测页面渲染完的时刻头条 3.8s、掘金 1.5s,固定值对谁都既不够也不快)。
    替换后的形态是"分段各有上限、命中即走",所以本锁锁的是**回归形态**:有人把固定等待加回来。

    正向对照同时钉住"装车":快路径的两个函数必须在热路径里真的被调用,而不是"写好了没人用"。
    边界:`wait_for_timeout(1000)` / `(800)` 仍允许(预算内的兜底步进,不是无条件等满);
    轮询循环里的 `(1500)` 不在范围内(见 `_entry_path_source`);**注释不算代码**
    (见 `_entry_path_code`:这段的注释会引用被禁写法本身)。
    变异取证:在 `_pre_wait_sels` 之前插一行 `page.wait_for_timeout(3000)` ⇒ 本用例翻红。
    """
    code = _entry_path_code()
    banned = re.findall(r"wait_for_timeout\s*\(\s*(?:3000|1500)\s*\)", code)
    assert banned == [], f"出码热路径又出现固定等待 {banned}:这是各平台 3.5~8s 的根因"
    for fast_path in ("_entry_plan", "_wait_for_page_ready"):
        assert re.search(rf"{fast_path}\s*\(", code), (
            f"热路径必须真的调用 {fast_path}(命中即走 / 就绪即走),不能只是写好了没人用"
        )


# --- 资源减负判据(2026-09-30):拦媒体/字体/第三方埋点,图片与接口类绝不能拦 ---


def test_resource_trim_never_blocks_images_or_api_calls():
    """码本身就是图,码接口就是 xhr —— 判据若把这两类拦了,所有平台直接不出码。

    变异取证:把 `_should_trim_request` 的白名单逻辑改成"除 document 外全拦" ⇒
    本用例翻红(image/xhr/fetch 各有一条断言咬住)。
    """
    f = scan_login_mod._should_trim_request
    # 必须放行:图片(码)、接口(码接口/登录态轮询)、页面本身、脚本、websocket
    for rt in ("image", "xhr", "fetch", "document", "script", "websocket", "stylesheet"):
        assert f(rt, "https://qr.example.com/api/code?token=1") is False, rt
        assert f(rt, "https://hm.example.com/passport/login") is False, rt
    # 必须拦:媒体/字体(对出码零贡献,却和码接口抢慢机带宽)
    for rt in ("media", "font"):
        assert f(rt, "https://www.example.com/assets/a.mp4") is True, rt


def test_resource_trim_blocks_known_trackers_only():
    """埋点域名指纹必须是窄名单:命中业界公认统计域拦,宽泛子串(如含 stat/ad)不拦,
    防止误杀正常静态资源路径。"""
    f = scan_login_mod._should_trim_request
    for needle in ("hm.baidu.com", "google-analytics.com", "googletagmanager.com", "cnzz.com"):
        assert f("xhr", f"https://{needle}/collect") is True, needle
    # 宽泛子串不拦:路径里恰好带 stat/ad 字样的正常资源不受牵连
    assert f("script", "https://www.example.com/static/ads.js") is False
    assert f("image", "https://www.example.com/statistics.png") is False


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


# --- 会话复用(2026-09-30):常驻登录档 + 复用/强制新扫码两档语义 ---


def test_scan_task_reuse_session_default_and_propagation():
    """复用档默认开(前端不下发时行为=尝试复用);create_task 必须把开关带进任务。"""
    t = scan_login_mod.ScanTask(task_id="t", user_id="u", platform="zhihu")
    assert t.reuse_session is True
    task_off = scan_login_mod.create_task("u-test-reuse", "zhihu", reuse_session=False)
    assert task_off.reuse_session is False
    task_on = scan_login_mod.create_task("u-test-reuse", "zhihu")
    assert task_on.reuse_session is True


def test_platform_profile_dir_env_override_and_sanitize(monkeypatch, tmp_path):
    """profile 目录:env 可整体改位;平台名做文件名净化(不许把 / 等带进路径)。"""
    monkeypatch.setenv("SCAN_LOGIN_PROFILE_DIR", str(tmp_path))
    d = scan_login_mod._platform_profile_dir("zhihu")
    assert d == tmp_path / "zhihu"
    monkeypatch.delenv("SCAN_LOGIN_PROFILE_DIR", raising=False)
    d2 = scan_login_mod._platform_profile_dir("toutiao_app")
    assert "scan-profiles" in str(d2) and d2.name == "toutiao_app"
    d3 = scan_login_mod._platform_profile_dir("a/b c")
    assert d3.name == "a_b_c"


class _FakeLeaseContext:
    def __init__(self, tag: str) -> None:
        self.tag = tag

    def close(self) -> None:
        pass


class _FakeLeaseBrowser:
    def new_context(self, **kw: object) -> _FakeLeaseContext:
        return _FakeLeaseContext("ephemeral")

    def close(self) -> None:
        pass


class _FakePlaywright:
    def __init__(self, persistent_raises: bool) -> None:
        self.persistent_raises = persistent_raises

    @property
    def chromium(self) -> _FakePlaywright:
        return self

    def launch_persistent_context(self, user_data_dir: str, **kw: object) -> _FakeLeaseContext:
        if self.persistent_raises:
            raise RuntimeError("profile in use")
        return _FakeLeaseContext("persistent")

    def launch(self, **kw: object) -> _FakeLeaseBrowser:
        return _FakeLeaseBrowser()


def test_open_browser_and_lease_persistent_fallback_and_kill_switch(monkeypatch, tmp_path):
    """常驻档成功→无独立 browser;启动失败(如同平台并发占用)→静默退回临时档;
    SCAN_LOGIN_PERSISTENT_PROFILE=0 → 直接临时档。复用/缓存档绝不能变成故障档。"""
    monkeypatch.setenv("SCAN_LOGIN_PROFILE_DIR", str(tmp_path))
    lease = scan_login_mod._open_browser_and_lease(_FakePlaywright(False), "zhihu", None)
    assert lease._browser is None and lease.context.tag == "persistent"
    assert (tmp_path / "zhihu").is_dir()

    lease2 = scan_login_mod._open_browser_and_lease(_FakePlaywright(True), "zhihu", None)
    assert lease2._browser is not None and lease2.context.tag == "ephemeral"

    monkeypatch.setenv("SCAN_LOGIN_PERSISTENT_PROFILE", "0")
    lease3 = scan_login_mod._open_browser_and_lease(_FakePlaywright(False), "zhihu", None)
    assert lease3._browser is not None and lease3.context.tag == "ephemeral"


def test_start_scan_request_reuse_session_field():
    """API 契约:reuse_session 默认 True(老客户端零改动即得复用语义),可显式关。"""
    from app.routers.scan_login import StartScanRequest

    req = StartScanRequest(platform="zhihu")
    assert req.reuse_session is True
    req2 = StartScanRequest(platform="zhihu", reuse_session=False)
    assert req2.reuse_session is False


def test_session_snapshot_roundtrip_and_empty_guard(monkeypatch, tmp_path):
    """登录态快照往返:storage_state 内存 jar → 盘边 JSON → add_cookies 原样回种。
    钉三件事:① 原子写不留 .tmp 残file;② 空 jar 不写文件;③ 无快照恢复返回 0 不炸。
    这条是 Chromium cookie 落盘惰性(close 即丢)缺陷的行为锁 —— 快照必须显式落盘。"""
    monkeypatch.setenv("SCAN_LOGIN_PROFILE_DIR", str(tmp_path))

    class FakeCtx:
        restored: object = None

        def storage_state(self):
            return {"cookies": [{"name": "SUB", "value": "v", "domain": ".weibo.com", "path": "/"}]}

        def add_cookies(self, cookies):
            self.restored = cookies

    ctx = FakeCtx()
    scan_login_mod._save_session_cookies("weibo", ctx)
    assert (tmp_path / "weibo" / "session-cookies.json").exists()
    assert not (tmp_path / "weibo" / "session-cookies.json.tmp").exists()
    n = scan_login_mod._restore_session_cookies("weibo", ctx)
    assert n == 1 and ctx.restored[0]["name"] == "SUB"
    # 落盘是密文:文件内容不得含 cookie 名明文(凭据卫生口径)
    raw = (tmp_path / "weibo" / "session-cookies.json").read_text(encoding="utf-8")
    assert "SUB" not in raw

    class EmptyCtx:
        def storage_state(self):
            return {"cookies": []}

    scan_login_mod._save_session_cookies("empty", EmptyCtx())
    assert not (tmp_path / "empty" / "session-cookies.json").exists()
    assert scan_login_mod._restore_session_cookies("never-scanned", FakeCtx()) == 0


# --- 2026-09-30 补:任务交互通道(_drain_interactions / request_interaction) ---


class _IxTaskLocator:
    def __init__(self, page: _IxTaskPage, selector: str) -> None:
        self._page = page
        self._selector = selector

    @property
    def first(self) -> _IxTaskLocator:
        return self

    def wait_for(self, state: str | None = None, timeout: int | None = None) -> bool:
        return True

    def fill(self, value: str, timeout: int | None = None) -> None:
        self._page.fills.append((self._selector, value))

    def click(self, timeout: int | None = None) -> None:
        self._page.clicks.append(self._selector)

    def inner_text(self, timeout: int | None = None) -> str:
        return "inner-text-ok"

    def bounding_box(self) -> dict[str, float]:
        return {"x": 10.0, "y": 20.0, "width": 40.0, "height": 20.0}


class _IxTaskMouse:
    def __init__(self, page: _IxTaskPage) -> None:
        self._page = page

    def move(self, x: float, y: float) -> None:
        self._page.moves.append((round(x, 1), round(y, 1)))

    def down(self) -> None:
        self._page.buttons.append("down")

    def up(self) -> None:
        self._page.buttons.append("up")


class _IxTaskFrame:
    def __init__(self, url: str = "") -> None:
        self.url = url
        self.name = ""
        self.evaluated: list[str] = []

    def locator(self, selector: str) -> _IxTaskLocator:
        return _IxTaskLocator(None, selector)  # type: ignore[arg-type]

    def evaluate(self, js: str) -> dict[str, str]:
        self.evaluated.append(js)
        return {"js": js}


class _IxTaskPage:
    def __init__(self) -> None:
        self.url = "https://www.oschina.net/home/login"
        self.fills: list[tuple[str, str]] = []
        self.clicks: list[str] = []
        self.moves: list[tuple[float, float]] = []
        self.buttons: list[str] = []
        self.main_frame = _IxTaskFrame("about:blank")
        self.frames: list[_IxTaskFrame] = [self.main_frame]

    def locator(self, selector: str) -> _IxTaskLocator:
        return _IxTaskLocator(self, selector)

    def screenshot(self, type: str = "png") -> bytes:  # noqa: A002
        return b"\x89PNG-fake-shot"

    def title(self) -> str:
        return "page-title-ok"

    @property
    def mouse(self) -> _IxTaskMouse:
        return _IxTaskMouse(self)


def _interact_task(status: str = "waiting_scan") -> ScanTask:
    t = ScanTask(task_id="it1", user_id="u1", platform="oschina", status=status)
    t._page = _IxTaskPage()
    t._interact_q = __import__("queue").Queue()
    return t


def _queue_action(t: ScanTask, action: str, selector: str | None = None, value: str | None = None) -> str:
    rid = f"rid-{action}-{len(t._interact_q.queue)}"
    t._interact_q.put((rid, action, selector, value))
    return rid


def test_drain_interactions_basic_actions_backfill_results():
    t = _interact_task()
    page = t._page
    rid_shot = _queue_action(t, "screenshot")
    rid_fill = _queue_action(t, "fill", "input#phone", "18643389808")
    rid_click = _queue_action(t, "click", "button.send")
    rid_text = _queue_action(t, "text", ".status")
    rid_title = _queue_action(t, "text")
    rid_eval = _queue_action(t, "eval", None, "1+1")

    scan_login_mod._drain_interactions(t, page)

    res = t._interact_results
    assert res[rid_shot]["ok"] is True
    import base64 as _b64

    assert _b64.b64decode(res[rid_shot]["screenshot_b64"]) == b"\x89PNG-fake-shot"
    assert res[rid_fill]["ok"] is True and page.fills == [("input#phone", "18643389808")]
    assert res[rid_click]["ok"] is True and page.clicks == ["button.send"]
    assert res[rid_text]["ok"] is True and res[rid_text]["text"] == "inner-text-ok"
    assert res[rid_title]["ok"] is True and res[rid_title]["text"] == "page-title-ok"
    assert res[rid_eval]["ok"] is True and res[rid_eval]["eval"] == {"js": "1+1"}
    for rid in (rid_shot, rid_fill, rid_click, rid_text, rid_title, rid_eval):
        assert res[rid]["url"] == page.url


def test_drain_interactions_unknown_action_captures_error_and_continues():
    t = _interact_task()
    rid_bad = _queue_action(t, "hover")
    rid_good = _queue_action(t, "screenshot")

    scan_login_mod._drain_interactions(t, t._page)

    res = t._interact_results
    assert res[rid_bad]["ok"] is False
    assert "未知 action" in res[rid_bad]["error"] and "hover" in res[rid_bad]["error"]
    # 失败不打断队列:后一个动作照常执行
    assert res[rid_good]["ok"] is True


def test_drain_interactions_action_failure_does_not_break_loop():
    t = _interact_task()
    page = t._page
    rid_fill = _queue_action(t, "fill", "input#phone", "123")
    rid_click = _queue_action(t, "click", "button.send")
    # 让第一个动作的目标抛错:fill 走 _resolve_locator.wait_for —— 用"抛错定位器"页
    class _BoomPage(_IxTaskPage):
        def locator(self, selector: str) -> _IxTaskLocator:
            if selector == "input#phone":
                raise RuntimeError("元素未找到(已穿透全部 iframe): input#phone")
            return _IxTaskLocator(self, selector)

    boom = _BoomPage()
    scan_login_mod._drain_interactions(t, boom)
    assert t._interact_results[rid_fill]["ok"] is False
    assert "元素未找到" in t._interact_results[rid_fill]["error"]
    assert t._interact_results[rid_click]["ok"] is True and boom.clicks == ["button.send"]
    assert page.fills == []  # 真 FakePage 未被触碰


def test_drag_hold_move_drop_session_lifecycle():
    t = _interact_task()
    t.task_id = "drag-life"
    rid_hold = _queue_action(t, "drag_hold", "#handle", "80")
    scan_login_mod._drain_interactions(t, t._page)
    res = t._interact_results[rid_hold]
    assert res["ok"] is True
    # 起点(10+20, 20+10) + dx=80 → (110, 30);会话登记且未松开
    assert res["held"] == {"x": 110.0, "y": 30.0}
    assert scan_login_mod._DRAG_SESSIONS["drag-life"] == {"x": 110.0, "y": 30.0}
    assert t._page.buttons == ["down"]

    rid_move = _queue_action(t, "drag_move", None, "10,-5")
    scan_login_mod._drain_interactions(t, t._page)
    assert t._interact_results[rid_move]["ok"] is True
    assert t._interact_results[rid_move]["held"] == {"x": 120.0, "y": 25.0}
    assert scan_login_mod._DRAG_SESSIONS["drag-life"] == {"x": 120.0, "y": 25.0}
    assert "up" not in t._page.buttons

    rid_drop = _queue_action(t, "drop")
    scan_login_mod._drain_interactions(t, t._page)
    assert t._interact_results[rid_drop]["ok"] is True
    assert t._page.buttons[-1] == "up"
    assert "drag-life" not in scan_login_mod._DRAG_SESSIONS
    assert "held" not in t._interact_results[rid_drop]


def test_drag_move_without_session_reports_error():
    t = _interact_task()
    t.task_id = "no-session"
    scan_login_mod._DRAG_SESSIONS.pop("no-session", None)
    rid = _queue_action(t, "drag_move", None, "10")
    scan_login_mod._drain_interactions(t, t._page)
    assert t._interact_results[rid]["ok"] is False
    assert "无按住中的拖拽会话" in t._interact_results[rid]["error"]


def test_request_interaction_rejects_without_queueing():
    import threading as _th

    store = scan_login_mod._TASK_STORE
    # ① 任务不在本实例
    assert scan_login_mod.request_interaction("nope", "screenshot")["ok"] is False
    # ② 终态任务
    dead = _interact_task(status="success")
    store._local["dead"] = dead
    try:
        r = scan_login_mod.request_interaction("dead", "screenshot")
        assert r["ok"] is False and "终态" in r["error"]
    finally:
        store._local.pop("dead", None)
    # ③ 页面句柄未就绪
    nopage = _interact_task()
    nopage._page = None
    store._local["nopage"] = nopage
    try:
        r = scan_login_mod.request_interaction("nopage", "screenshot")
        assert r["ok"] is False and "页面句柄未就绪" in r["error"]
    finally:
        store._local.pop("nopage", None)
    # ④ 未知 action:入队前就拒
    live = _interact_task()
    store._local["live"] = live
    try:
        r = scan_login_mod.request_interaction("live", "bogus", wait_seconds=0.3)
        assert r["ok"] is False and "未知 action" in r["error"]
        assert live._interact_q.qsize() == 0
    finally:
        store._local.pop("live", None)
    assert _th.active_count() >= 0


def test_request_interaction_round_trip_via_drain():
    import threading as _th

    t = _interact_task()
    store = scan_login_mod._TASK_STORE
    store._local["rt1"] = t
    try:
        def _drain_later() -> None:
            time.sleep(0.3)
            scan_login_mod._drain_interactions(t, t._page)

        _th.Thread(target=_drain_later, daemon=True).start()
        r = scan_login_mod.request_interaction("rt1", "screenshot", wait_seconds=6)
        assert r["ok"] is True and "screenshot_b64" in r
    finally:
        store._local.pop("rt1", None)


def test_drag_parse_shapes():
    assert scan_login_mod._drag_parse(None) == (0.0, 0.0)
    assert scan_login_mod._drag_parse("") == (0.0, 0.0)
    assert scan_login_mod._drag_parse("80") == (80.0, 0.0)
    assert scan_login_mod._drag_parse("10,-5") == (10.0, -5.0)
    assert scan_login_mod._drag_parse(" 3 , 4 ") == (3.0, 4.0)
