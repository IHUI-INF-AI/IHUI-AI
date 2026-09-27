# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""POST /publish/scan-login/import-cookies 平台归属过滤回归(2026-09-27 立)。

钉住根因修复:堵掉「整浏览器 cookie 混包写进 publish_accounts」的生产者路径。
- 混包喂进来 ⇒ 只剩目标平台 cookie,kept/dropped 计数如实;
- 过滤后无主登录 cookie ⇒ HTTP 400,detail 可操作(点名缺失 cookie + 重扫入口),不回显任何值;
- 已有合法单站包(2026-09-27 只读扫描本地 dev 库 publish_accounts 得到的真实**字段名**集合,
  未读取任何 cookie 值)⇒ 原样通过、不被判死;
- 有 domain 时按域名判、无 domain 才按名字兜底(两侧都有正反例);
- 源码面锁:cookie 域名/白名单清单全仓只允许有一份(platform_cookie_domains.py)。

测试不连 DB / 不联网 / 不起浏览器:路由层用模块属性替身(monkeypatch 语义,try/finally 还原)。
"""
from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Any

from fastapi import HTTPException

import app.routers.scan_login as scan_router
from app.services.publish.platform_cookie_domains import (
    PLATFORM_COOKIE_RULES,
    domain_matches_rule,
    extract_cookie_domains,
    filter_platform_cookies,
)
from app.services.scan_login import PLATFORM_SCAN_CONFIG, _cookie_hits

# ---------------------------------------------------------------------------
# 夹具:真实字段名集合(名字非秘密;值一律用可识别的假值,供泄漏断言)
# ---------------------------------------------------------------------------

def _fake_jar(names: list[str]) -> dict[str, str]:
    return {n: f"leakcheck-{i}-{'x' * 24}" for i, n in enumerate(names)}


def _jar_raw(names: list[str]) -> str:
    """请求头格式粘贴(无域名信息 ⇒ 走名字兜底路径)。"""
    return "; ".join(f"{k}=leakcheck-{i}-{'x' * 24}" for i, k in enumerate(names))


# 2026-09-27 只读扫描本地 dev 库 publish_accounts(仅字段名,零值外泄)得到的合法单站包。
# zhihu/bilibili/toutiao 的合法行已随混包事故被清空,无实测面可取,用各站登录链路
# 的人工登记集(curated)代替,并另走 Netscape 带域名格式回归域名路径。
REAL_SINGLE_SITE_JARS: dict[str, list[str]] = {
    "xiaohongshu": ["a1", "abRequestId", "acw_tc", "ets", "loadts", "sec_poison_id", "unread",
                    "webBuild", "webId", "web_session", "websectiga", "xsecappid"],
    "weibo": ["ALC", "ALF", "SCF", "SSOLoginState", "SUB", "SUBP", "WBPSESS", "X-CSRF-TOKEN",
              "XSRF-TOKEN"],
    "csdn": ["AU", "BT", "HMACCOUNT", "HMACCOUNT_BFESS",
             "Hm_lpvt_6bcd52f51e9b3dce32bec4a3997715ac",
             "Hm_lvt_6bcd52f51e9b3dce32bec4a3997715ac", "SESSION", "UN", "UserInfo", "UserName",
             "UserNick", "UserToken", "bc_bot_fp", "bc_bot_rules", "bc_bot_score",
             "bc_bot_session", "bc_bot_token", "c_dsid", "c_first_page", "c_first_ref",
             "c_page_id", "c_pref", "c_ref", "c_segment", "creative_btn_mp", "csrfToken",
             "dc_session_id", "dc_sid", "dc_tos", "fid", "hide_login", "https_waf_cookie",
             "log_Id_click", "log_Id_pv", "log_Id_view", "p_uid", "uuid_tt_dd",
             "waf_captcha_marker"],
    "juejin": ["__tea_cookie_tokens_2608", "_gid", "_tea_utm_cache_2608", "csrf_session_id",
               "has_biz_token", "is_staff_user", "n_mh", "passport_csrf_token",
               "passport_csrf_token_default", "passport_csrf_token_wap_state", "s_v_web_id",
               "session_tlb_tag", "sessionid", "sessionid_ss", "sid_guard", "sid_tt",
               "sid_ucp_v1", "ssid_ucp_v1", "uid_tt", "uid_tt_ss"],
    "baijiahao": ["BDUSS", "BDUSS_BFESS", "HOSUPPORT", "HOSUPPORT_BFESS", "PHPSESSID", "PTOKEN",
                  "PTOKEN_BFESS", "RECENT_LOGIN", "RT", "STOKEN", "STOKEN_BFESS", "UBI",
                  "UBI_BFESS", "XFI", "XFS", "XFT", "ppfuid", "pplogid", "pplogid_BFESS",
                  "theme"],
    "qq": ["RK", "TSID", "__aegis_uid", "_qpsvr_localtk", "csrfToken", "p_skey", "p_uin",
           "pgv_info", "pgv_pvid", "pt2gguin", "pt4_token", "pt_clientip", "pt_guid_sig",
           "pt_local_token", "pt_login_sig", "pt_login_type", "pt_oauth_token", "pt_recent_uins",
           "pt_serverip", "ptcz", "ptnick_502319984", "qlogin_uid", "qrsig", "superkey",
           "supertoken", "superuin", "ts_last", "ts_uid", "ui", "uikey"],
    "netease": ["NTES_WEB_FP", "NTES_YD_SESS", "NTESwebSI", "P_INFO", "S_INFO",
                "THE_LAST_LOGIN_MOBILE", "__snaker__id", "_antanalysis_s_id", "_gid",
                "_ntes_nuid", "gdxidpyhxdE", "l_s_subscribehJWZDGT", "l_yd_s_subscribehJWZDGT",
                "l_yd_sign", "utid"],
    "kuaishou": ["clientid", "did", "kpf", "kpn", "ktrace-context", "kuaishou.server.webday7_ph",
                 "kuaishou.server.webday7_st", "kwfv1", "kwpsecproductname", "kwscode",
                 "kwssectoken", "passToken", "userId"],
    "cnblogs": [".CNBlogsCookie", ".Cnblogs.Account.Antiforgery", ".Cnblogs.Account.Session",
                ".Cnblogs.AspNetCore.Cookies", "HMACCOUNT", "HMACCOUNT_BFESS",
                "Hm_lpvt_866c9be12d4a814454792b1fd0fed295",
                "Hm_lvt_866c9be12d4a814454792b1fd0fed295", "SERVERID", "XSRF-TOKEN",
                "_GRECAPTCHA", "_c_WBKFRo"],
    "jianshu": ["HMACCOUNT", "HMACCOUNT_BFESS", "Hm_lpvt_0c0e9d9b1e7d617b3e6842e85b9fb068",
                "Hm_lvt_0c0e9d9b1e7d617b3e6842e85b9fb068", "_m7e_session_core", "default_font",
                "locale", "read_mode", "remember_user_token", "sajssdk_2015_cross_new_user",
                "sensorsdata2015jssdkcross", "web_login_version"],
    "douyin": ["IsDouyinActive", "UIFID", "UIFID_TEMP", "__ac_nonce", "__ac_signature",
               "__security_mc_1_s_sdk_crypt_sdk", "architecture", "bd_sso_hi3jfd",
               "bd_ticket_guard_client_data", "bd_ticket_guard_client_web_domain",
               "bd_ticket_guard_regenerate_keys_time", "bd_ticket_guard_server_data",
               "bd_ticket_guard_web_domain", "bit_env", "biz_trace_id", "device_web_cpu_core",
               "device_web_memory_size", "dy_sheight", "dy_swidth", "enter_pc_once", "fg_uid",
               "fpk1", "fpk2", "gulu_source_res", "has_biz_token", "hevc_supported",
               "home_can_add_dy_2_desktop", "is_dash_user", "is_dbsc", "is_staff_user",
               "is_support_rtm_web_ts", "login_time", "n_mh", "odin_tt", "passport_assist_user",
               "passport_auth_mix_state", "passport_csrf_token", "passport_csrf_token_default",
               "s_v_web_id", "sdk_source_info", "session_tlb_tag", "sessionid", "sessionid_ss",
               "sid_guard", "sid_tt", "sid_ucp_v1", "ssid_ucp_v1", "strategyABtestKey",
               "stream_recommend_feed_params", "ttwid", "uid_tt", "uid_tt_ss",
               "x-web-secsdk-uid", "x_tt_token"],
    "shipinhao": ["sessionid", "wxuin"],
    "wordpress": ["ACCOUNT_CHOOSER", "APISID", "HSID", "LSID", "NID", "OTZ", "SAPISID", "SID",
                  "SIDCC", "SMSV", "SSID", "__Host-1PLSID", "__Host-3PLSID", "__Host-GAPS",
                  "__Host-GAPSTS", "__Host-_bb_c_uid", "__Secure-1PAPISID", "__Secure-1PSID",
                  "__Secure-1PSIDCC", "__Secure-1PSIDRTS", "__Secure-1PSIDTS",
                  "__Secure-3PAPISID", "__Secure-3PSID", "__Secure-3PSIDCC",
                  "__Secure-3PSIDRTS", "__Secure-3PSIDTS", "_hcp", "country_code",
                  "last_used_authentication_method", "recognized_logins", "region", "tk_ai",
                  "wordpress", "wordpress_logged_in", "wordpress_logged_in_525ed659f",
                  "wordpress_sec", "wordpress_test_cookie", "wp_525ed659f", "wp_sec_525ed659f"],
    "medium": ["_cfuvid", "sid", "uid"],
    "youtube": ["ACCOUNT_CHOOSER", "APISID", "HSID", "LSID", "NID", "OTZ", "SAPISID", "SID",
                "SIDCC", "SMSV", "SSID", "VISITOR_INFO1_LIVE", "VISITOR_PRIVACY_METADATA", "YSC",
                "__Host-1PLSID", "__Host-3PLSID", "__Host-GAPS", "__Host-GAPSTS",
                "__Secure-1PAPISID", "__Secure-1PSID", "__Secure-1PSIDCC", "__Secure-1PSIDRTS",
                "__Secure-1PSIDTS", "__Secure-3PAPISID", "__Secure-3PSID", "__Secure-3PSIDCC",
                "__Secure-3PSIDRTS", "__Secure-3PSIDTS", "__Secure-ROLLOUT_TOKEN",
                "__Secure-YNID"],
    # curated(合法行已被清空的平台,名字集来自登录链路登记,非 DB 实测)
    "zhihu": ["z_c0", "d_c0", "capsion_ticket", "_xsrf", "BEC", "Hm_lvt_zhihu_placeholder"],
    "bilibili": ["SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5", "sid", "buvid3",
                 "b_nut"],
}

# 混包污染项:三枚实测跨站登录 cookie(库里 id=5/7/23 混包字段名的代表)
MIXED_POLLUTION = [
    ".CNBlogsCookie", ".Cnblogs.AspNetCore.Cookies", "BDUSS", "BDUSS_BFESS", "STOKEN",
    "APISID", "SAPISID", "HSID", "__Secure-1PSID", "SESSDATA", "DedeUserID", "web_session",
    "SFSSID", "p_skey", "SUB", "SUBP", "PHPSESSID", "SERVERID", "HMACCOUNT", "_gid",
]


def _run_import(platform: str, cookies_raw: str) -> dict[str, Any]:
    """直调路由协程,替换全部 IO 依赖(鉴权 + 校验 + 查存量 + 落库),不落任何真实数据。

    2026-09-27 补两条:路由新增"先验后写"后,**不桩就会真的起浏览器 + 真连生产库**
    (违反 §5 测试隔离铁律);桩子返回"已证伪"是刻意的 —— 只有"库里没有凭据"这一格
    会放行落库,正好覆盖本文件要测的归属过滤路径。
    """

    async def _fake_user(_request: Any) -> str:
        return "u-test-0001"

    async def _fake_verify(
        _platform: str, _creds: Any, _db_account_id: Any = None,
    ) -> tuple[bool | None, str]:
        return False, "stub: 测试环境不联网"

    async def _fake_existing(_user_id: str, _platform: str) -> dict[str, int] | None:
        # 返回 None 而不是 False:裁决判的是 `existing_row is not None`,
        # 把 False 当"没有行"传进去会被读成"有一行",整组用例的语义就反了。
        return None

    saved: dict[str, Any] = {}

    async def _fake_save(user_id: str, platform_id: str, credentials: dict[str, str],
                         _name: str, *, verify_msg: str = "") -> int:
        saved["user_id"] = user_id
        saved["platform"] = platform_id
        saved["credentials"] = dict(credentials)
        saved["verify_msg"] = verify_msg
        return 987654

    patched = (
        "get_current_user_id",
        "_save_account_to_db",
        "verify_login_candidate",
        "_existing_account_row",
    )
    originals = tuple(getattr(scan_router, name) for name in patched)
    scan_router.get_current_user_id = _fake_user  # type: ignore[assignment]
    scan_router._save_account_to_db = _fake_save  # type: ignore[assignment]
    scan_router.verify_login_candidate = _fake_verify  # type: ignore[assignment]
    scan_router._existing_account_row = _fake_existing  # type: ignore[assignment]
    try:
        body = scan_router.ImportCookiesRequest(platform=platform, cookies_raw=cookies_raw)
        result = asyncio.run(scan_router.import_cookies(body, None))  # type: ignore[arg-type]
        result["__saved__"] = saved
        return result
    finally:
        for name, value in zip(patched, originals, strict=True):
            setattr(scan_router, name, value)


# ---------------------------------------------------------------------------
# 1) 混包 ⇒ 只剩该站 cookie,计数如实
# ---------------------------------------------------------------------------

def test_mixed_package_keeps_only_target_platform() -> None:
    jar = _fake_jar(REAL_SINGLE_SITE_JARS["zhihu"] + MIXED_POLLUTION)
    cfg = PLATFORM_SCAN_CONFIG["zhihu"]
    result = filter_platform_cookies("zhihu", jar, {}, cfg["success_cookies"])
    assert set(result.kept) == set(REAL_SINGLE_SITE_JARS["zhihu"])
    assert ".CNBlogsCookie" in result.dropped
    assert "BDUSS" in result.dropped
    assert "APISID" in result.dropped
    assert result.kept_count + result.dropped_count == len(jar)


def test_mixed_package_import_counts() -> None:
    raw = _jar_raw(REAL_SINGLE_SITE_JARS["zhihu"] + MIXED_POLLUTION)
    out = _run_import("zhihu", raw)
    assert out["code"] == 0
    data = out["data"]
    assert data["kept"] == len(REAL_SINGLE_SITE_JARS["zhihu"])
    assert data["dropped"] == len(MIXED_POLLUTION)
    assert data["cookies_count"] == data["kept"]
    assert "z_c0" in data["matched"]
    # 落库的凭证集只含目标平台 cookie
    assert set(out["__saved__"]["credentials"]) == set(REAL_SINGLE_SITE_JARS["zhihu"])


# ---------------------------------------------------------------------------
# 2) 过滤后不含主登录 cookie ⇒ 400 可操作,不回显值
# ---------------------------------------------------------------------------

def test_no_target_login_cookie_returns_actionable_400() -> None:
    jar = _fake_jar(["SESSDATA", "DedeUserID", ".CNBlogsCookie", "BDUSS", "APISID"])
    raw = "; ".join(f"{k}={v}" for k, v in jar.items())
    try:
        _run_import("zhihu", raw)
        raise AssertionError("应抛 HTTPException(400)")
    except HTTPException as exc:
        assert exc.status_code == 400
        detail = exc.detail
        assert isinstance(detail, dict)
        message = str(detail["message"])
        assert "z_c0" in message, "detail 必须点名缺哪一枚主登录 cookie"
        assert "扫码" in message and "/publish/scan-login" in message, "detail 必须点名重扫入口"
        counts = detail["data"]
        assert counts["kept"] == 0
        assert counts["dropped"] == len(jar)
        assert counts["missing_login_cookies"] == PLATFORM_SCAN_CONFIG["zhihu"]["success_cookies"]
        for value in jar.values():
            assert value not in json.dumps(detail, ensure_ascii=False), "detail 不得回显 cookie 值"


def test_wordpress_test_cookie_only_400() -> None:
    """wordpress 前缀通配:只有游客 wordpress_test_cookie ⇒ kept 无 logged_in,400 点名模式。"""
    raw = "wordpress_test_cookie=" + "z" * 24
    try:
        _run_import("wordpress", raw)
        raise AssertionError("应抛 HTTPException(400)")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "wordpress_logged_in*" in str(exc.detail["message"])


def test_cookie_values_never_echoed_on_success_path() -> None:
    jar = _fake_jar(REAL_SINGLE_SITE_JARS["zhihu"] + MIXED_POLLUTION)
    raw = "; ".join(f"{k}={v}" for k, v in jar.items())
    out = _run_import("zhihu", raw)
    envelope = {k: v for k, v in out.items() if k != "__saved__"}  # __saved__ 是测试替身的落库捕获
    # 成功响应体只允许出现计数与命中名,不得出现任何 cookie 值(含被保留的)
    assert all(v not in json.dumps(envelope, ensure_ascii=False) for v in jar.values())


# ---------------------------------------------------------------------------
# 3) 合法单站包原样通过(真实现读字段名集合)
# ---------------------------------------------------------------------------

def test_known_single_site_packages_pass_untouched() -> None:
    for platform, names in REAL_SINGLE_SITE_JARS.items():
        cfg = PLATFORM_SCAN_CONFIG[platform]
        jar = _fake_jar(names)
        result = filter_platform_cookies(platform, jar, {}, cfg["success_cookies"])
        assert set(result.kept) == set(names), f"{platform} 合法单站包被误删: {result.dropped}"
        assert result.dropped == ()
        assert _cookie_hits(cfg, result.kept), f"{platform} 过滤后主登录 cookie 丢失"


def test_known_single_site_packages_import_ok_through_router() -> None:
    for platform, names in REAL_SINGLE_SITE_JARS.items():
        out = _run_import(platform, _jar_raw(names))
        assert out["code"] == 0, platform
        assert out["data"]["kept"] == len(names), platform
        assert out["data"]["dropped"] == 0, platform


# ---------------------------------------------------------------------------
# 4) 有 domain 用 domain 判;无 domain 才允许名字兜底
# ---------------------------------------------------------------------------

def test_domain_present_decides_even_against_name_lists() -> None:
    cfg = PLATFORM_SCAN_CONFIG["zhihu"]
    # 名字在别的平台白名单里(SERVERID/HMACCOUNT 是 cnblogs 实测名),但域名是 zhihu ⇒ 留;
    # 名字是 zhihu 白名单成员,但域名是别的站 ⇒ 丢(有 domain 时名字不再说话)。
    jar = {
        "SERVERID": "a" * 20,
        "HMACCOUNT": "b" * 20,
        "mystery_zh_cookie": "c" * 20,
        "d_c0": "d" * 20,
        "z_c0": "e" * 20,
    }
    domains = {
        "SERVERID": ".zhihu.com",
        "HMACCOUNT": "www.zhihu.com",
        "mystery_zh_cookie": ".zhihu.com",
        "d_c0": ".cnblogs.com",
        "z_c0": ".zhihu.com",
    }
    result = filter_platform_cookies("zhihu", jar, domains, cfg["success_cookies"])
    assert set(result.kept) == {"SERVERID", "HMACCOUNT", "mystery_zh_cookie", "z_c0"}
    assert "d_c0" in result.dropped


def test_domain_suffix_is_dot_bounded() -> None:
    rule = PLATFORM_COOKIE_RULES["zhihu"]
    assert domain_matches_rule(".www.zhihu.com", rule)
    assert not domain_matches_rule("evil-zhihu.com", rule)
    assert not domain_matches_rule("zhihu.com.evil.io", rule)


def test_netscape_and_json_domain_extraction() -> None:
    netscape = (
        "# Netscape HTTP Cookie File\n"
        ".zhihu.com\tTRUE\t/\tTRUE\t1800000000\td_c0\tabc\n"
        "#HttpOnly_.zhihu.com\tTRUE\t/\tTRUE\t1800000000\tz_c0\tdef\n"
        ".google.com\tTRUE\t/\tTRUE\t1800000000\tAPISID\txyz\n"
    )
    assert extract_cookie_domains(netscape) == {"d_c0": "zhihu.com", "z_c0": "zhihu.com",
                                                "APISID": "google.com"}
    arr = json.dumps([
        {"name": "z_c0", "value": "v", "domain": ".zhihu.com"},
        {"name": "x", "value": "v"},
    ])
    assert extract_cookie_domains(arr) == {"z_c0": "zhihu.com"}
    assert extract_cookie_domains("k=v; k2=v2") == {}
    assert extract_cookie_domains('{"z_c0": "v"}') == {}


def test_zhihu_netscape_mixed_domains_import() -> None:
    """Netscape 混域整包上传:域名路径逐条判,kept 只剩 zhihu 域,主 cookie 在 ⇒ 200。"""
    raw = (
        "# Netscape HTTP Cookie File\n"
        ".zhihu.com\tTRUE\t/\tTRUE\t1800000000\tz_c0\t" + "a" * 30 + "\n"
        ".zhihu.com\tTRUE\t/\tTRUE\t1800000000\td_c0\t" + "b" * 30 + "\n"
        ".cnblogs.com\tTRUE\t/\tTRUE\t1800000000\t.CNBlogsCookie\t" + "c" * 30 + "\n"
        ".baidu.com\tTRUE\t/\tTRUE\t1800000000\tBDUSS\t" + "d" * 30 + "\n"
        ".google.com\tTRUE\t/\tTRUE\t1800000000\tAPISID\t" + "e" * 30 + "\n"
    )
    out = _run_import("zhihu", raw)
    assert out["data"]["kept"] == 2
    assert out["data"]["dropped"] == 3
    assert set(out["__saved__"]["credentials"]) == {"z_c0", "d_c0"}


# ---------------------------------------------------------------------------
# 5) 表一致性 + 单一来源源码面锁
# ---------------------------------------------------------------------------

def test_rules_cover_every_scan_platform() -> None:
    assert set(PLATFORM_COOKIE_RULES) == set(PLATFORM_SCAN_CONFIG)
    for pid, rule in PLATFORM_COOKIE_RULES.items():
        assert rule.domains, f"{pid} 缺域名白名单"


def test_login_names_covered_by_fallback_rules() -> None:
    """每条 success_cookies 的精确名必须真的登记进 name_exact(名字兜底集不含登录 cookie
    ⇒ 无域名粘贴永远 400);通配前缀必须能被 name_tokens 命中。"""
    for pid, cfg in PLATFORM_SCAN_CONFIG.items():
        rule = PLATFORM_COOKIE_RULES[pid]
        for pattern in cfg["success_cookies"]:
            if pattern.endswith("*"):
                prefix = pattern[:-1].lower()
                assert any(tok in prefix for tok in rule.name_tokens), \
                    f"{pid}: 通配登录 cookie {pattern} 无 name_token 可兜底"
            else:
                assert pattern in rule.name_exact, \
                    f"{pid}: 登录 cookie {pattern} 未登记进 name_exact"


MODULE_REL = "app/services/publish/platform_cookie_domains.py"
CANARY_DOMAINS = [
    "xhscdn.com", "hdslb.com", "csdnimg.cn", "kwaicdn.com", "gtimg.com", "ytimg.com",
    "acg.tv", "jianshu.io", "wp.com", "medium.io", "bytedance.com", "iesdouyin.com",
    "douyinstatic.com", "bytecdn.cn", "hupucdn.com", "__zse_ck", "capsion_ticket",
]
TABLE_DEF_RE = re.compile(r"^[ \t]*[A-Z_0-9]*COOKIE_(DOMAIN|DOMAINS|RULES|NAMES)[A-Z_0-9]*[ \t]*[:=]",
                          re.MULTILINE)


def test_whitelist_defined_exactly_once() -> None:
    """源码面锁:cookie 域名/名字白名单表只允许有一份。

    别的文件再写一份域名清单(或复刻本模块的表名/canary 域名)⇒ 红。
    login_url/success_url_pattern 里的 "zhihu.com" 类字样属登录判定,不是归属表,
    canary 串刻意选只在归属表出现的域。
    """
    app_root = Path(__file__).resolve().parents[1] / "app"
    owners: list[str] = []
    for path in sorted(app_root.rglob("*.py")):
        rel = path.relative_to(app_root.parent).as_posix()
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = path.read_text(encoding="utf-8", errors="ignore")
        if TABLE_DEF_RE.search(text) or any(c in text for c in CANARY_DOMAINS):
            owners.append(rel)
    assert owners == [MODULE_REL], f"cookie 归属白名单出现第二份定义面: {owners}"


def test_router_no_longer_contains_name_blacklist() -> None:
    """路由 import-cookies 的旧 5 项名字黑名单字面量必须整体退场。"""
    router_src = (Path(__file__).resolve().parents[1] / "app" / "routers" / "scan_login.py"
                  ).read_text(encoding="utf-8")
    for token in ("cnzz", "hm.baidu", '"google", "baidu"'):
        assert token not in router_src, f"import-cookies 路由仍残留旧黑名单字面量: {token}"


def test_unregistered_platform_filter_raises() -> None:
    try:
        filter_platform_cookies("no_such_platform_xyz", {"a": "b"}, {}, ["a"])
        raise AssertionError("未登记平台应抛 ValueError")
    except ValueError:
        pass
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
