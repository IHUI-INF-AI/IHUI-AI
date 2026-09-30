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
"""

from __future__ import annotations

from app.services.scan_login import (
    _DEFAULT_QR_READY_SELECTORS,
    _QR_ELEMENT_SELECTORS,
    PLATFORM_SCAN_CONFIG,
    ScanTask,
    _cookie_hits,
    _extract_qr_image,
    _login_page_open_failure_message,
    _parse_raw_cookies,
    _qr_ready_selectors,
    _ready_probe,
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


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
