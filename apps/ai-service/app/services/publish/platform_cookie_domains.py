# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

# -*- coding:  utf-8 -*-
"""平台 cookie 归属规则单一来源(2026-09-27 立,堵 /import-cookies 整浏览器混包写入 publish_accounts)。

背景(根因):
- `app/routers/scan_login.py` 的 POST /import-cookies 旧"过滤"只是对 **cookie 名**
  做 5 项子串黑名单(google/baidu/cnzz/_ga/hm.baidu),既不认域名也不分平台;
  而 `_parse_raw_cookies` 把 Netscape/JSON 里的 domain 列整个丢弃,导致
  "有 domain 用 domain 判"根本没有输入。结果:整浏览器 cookie 包(实测 533/537 字段,
  同包内出现 .CNBlogsCookie + BDUSS + APISID)只要有目标平台的一枚登录 cookie 就整包入库
  (库中 id=5/7/23,已于 2026-09-27 清空并置 disabled,但生产者路径必须在本模块收口)。

规矩(本文件是 **唯一** 一张 cookie 归属表,别处不得再写第二份域名/白名单清单):
- 有 domain 信息(Netscape cookies.txt / JSON 数组导出)⇒ 只按 `domains` 后缀判归属;
- 无 domain(请求头 k=v;k2=v2 / JSON 对象粘贴)⇒ 才允许按名字兜底:
  命中 `name_exact`(该站实测出现过的 cookie 名)或 `name_tokens`(品牌子串)或
  目标平台登录 cookie 模式(含 `前缀*` 通配)才保留;
- 判不出归属 ⇒ 丢弃并计数(宁缺勿滥),绝不"猜着留"。

name_exact 取证口径(2026-09-27,只读扫描本地 dev 库 publish_accounts 解密后的 **字段名**,
全程未读取/未记录任何 cookie 值):zhihu/bilibili/toutiao 三行的合法单站集已随混包事故被清空,
无实测面可取,故按各站登录链路人工登记(success_cookies ⊆ name_exact 由测试钉死);
其余 16 平台的 name_exact 即当次实测单站包字段名集合。

与相邻表的关系:`PLATFORM_SCAN_CONFIG`(app/services/scan_login.py)拥有 login_url 与
success_cookies(登录判定);本模块只拥有 **cookie 归属** 维度(domains/名字白名单)。
两表平台键集必须一致(测试 `test_rules_cover_every_scan_platform` 钉死),
每条 success_cookies 的精确名必须落在对应 name_exact、通配前缀必须能被 name_tokens 命中
(测试 `test_login_names_covered_by_fallback_rules` 钉死),避免两处各写一份而漂移。
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Mapping, Sequence

__all__ = [
    "PlatformCookieRule",
    "PLATFORM_COOKIE_RULES",
    "PlatformCookieFilterResult",
    "normalize_cookie_domain",
    "domain_matches_rule",
    "name_matches_rule",
    "extract_cookie_domains",
    "filter_platform_cookies",
]


@dataclass(frozen=True)
class PlatformCookieRule:
    """单平台 cookie 归属规则。

    domains:     可注册域后缀(小写、无前导点),如 "zhihu.com" 覆盖 ".www.zhihu.com"。
    name_tokens: 小写子串,cookie 名含其一即归属该平台(品牌串,刻意不收泛用短词)。
    name_exact:  区分大小写的精确 cookie 名(实测单站包字段名 / 该平台登录 cookie 名)。
    """

    domains: tuple[str, ...]
    name_tokens: tuple[str, ...]
    name_exact: frozenset[str]


def _rule(domains: Sequence[str], name_tokens: Sequence[str], name_exact: Sequence[str]) -> PlatformCookieRule:
    return PlatformCookieRule(
        domains=tuple(d.lower().lstrip(".").strip(".") for d in domains),
        name_tokens=tuple(t.lower() for t in name_tokens),
        name_exact=frozenset(name_exact),
    )


# ---------------------------------------------------------------------------
# 唯一归属表。键与 PLATFORM_SCAN_CONFIG 一一对应(测试锁)。
# ---------------------------------------------------------------------------
PLATFORM_COOKIE_RULES: dict[str, PlatformCookieRule] = {
    # ===== 社区/资讯 =====
    "zhihu": _rule(
        ("zhihu.com", "zhimg.com"),
        ("zhihu", "zhimg"),
        ("z_c0", "d_c0", "capsion_ticket", "capsion_ticket_v2", "_xsrf", "BEC", "BELT", "__zse_ck", "JOIN"),
    ),
    "bilibili": _rule(
        ("bilibili.com", "bilibili.cn", "hdslb.com"),
        ("bili",),
        ("SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5", "sid", "buvid3", "buvid4",
         "b_nut", "fts", "CURRENT_FN", "bili_keep_login"),
    ),
    "xiaohongshu": _rule(
        ("xiaohongshu.com", "xhscdn.com", "xhslink.com"),
        ("xiaohongshu", "xhs", "rednote"),
        ("a1", "abRequestId", "acw_tc", "ets", "loadts", "sec_poison_id", "unread", "webBuild",
         "webId", "web_session", "websectiga", "xsecappid"),
    ),
    "weibo": _rule(
        ("weibo.com", "weibo.cn"),
        ("weibo",),
        ("ALC", "ALF", "SCF", "SSOLoginState", "SUB", "SUBP", "SUB", "MLOGIN", "WBPSESS",
         "X-CSRF-TOKEN", "XSRF-TOKEN"),
    ),
    "douyin": _rule(
        ("douyin.com", "iesdouyin.com", "snssdk.com", "bytedance.com", "douyinstatic.com", "bytecdn.cn"),
        ("douyin", "snssdk", "bytedance"),
        ("IsDouyinActive", "UIFID", "UIFID_TEMP", "__ac_nonce", "__ac_signature",
         "__security_mc_1_s_sdk_crypt_sdk", "architecture", "bd_sso_hi3jfd", "bd_ticket_guard_client_data",
         "bd_ticket_guard_client_web_domain", "bd_ticket_guard_regenerate_keys_time",
         "bd_ticket_guard_server_data", "bd_ticket_guard_web_domain", "bit_env", "biz_trace_id",
         "device_web_cpu_core", "device_web_memory_size", "dy_sheight", "dy_swidth", "enter_pc_once",
         "fg_uid", "fpk1", "fpk2", "gulu_source_res", "has_biz_token", "hevc_supported",
         "home_can_add_dy_2_desktop", "is_dash_user", "is_dbsc", "is_staff_user", "is_support_rtm_web_ts",
         "login_time", "n_mh", "odin_tt", "passport_assist_user", "passport_auth_mix_state",
         "passport_csrf_token", "passport_csrf_token_default", "s_v_web_id", "sdk_source_info",
         "session_tlb_tag", "sessionid", "sessionid_ss", "sid_guard", "sid_tt", "sid_ucp_v1",
         "ssid_ucp_v1", "strategyABtestKey", "stream_recommend_feed_params", "ttwid", "uid_tt",
         "uid_tt_ss", "x-web-secsdk-uid", "x_tt_token"),
    ),
    "kuaishou": _rule(
        ("kuaishou.com", "kwaicdn.com"),
        ("kuaishou", "kwaicdn"),
        ("clientid", "did", "kpf", "kpn", "ktrace-context", "kuaishou.server.web_st",
         "kuaishou.server.webday7_ph",
         "kuaishou.server.webday7_st", "kwfv1", "kwpsecproductname", "kwscode", "kwssectoken",
         "passToken", "userId"),
    ),
    "csdn": _rule(
        ("csdn.net", "csdnimg.cn"),
        ("csdn",),
        ("AU", "BT", "HMACCOUNT", "HMACCOUNT_BFESS",
         "Hm_lpvt_6bcd52f51e9b3dce32bec4a3997715ac", "Hm_lvt_6bcd52f51e9b3dce32bec4a3997715ac",
         "SESSION", "UN", "UserInfo", "UserName", "UserNick", "UserToken", "UserSecret",
         "bc_bot_fp", "bc_bot_rules",
         "bc_bot_score", "bc_bot_session", "bc_bot_token", "c_dsid", "c_first_page", "c_first_ref",
         "c_page_id", "c_pref", "c_ref", "c_segment", "creative_btn_mp", "csrfToken", "dc_session_id",
         "dc_sid", "dc_tos", "fid", "hide_login", "https_waf_cookie", "log_Id_click", "log_Id_pv",
         "log_Id_view", "p_uid", "uuid_tt_dd", "waf_captcha_marker"),
    ),
    "juejin": _rule(
        ("juejin.cn", "juejin.im"),
        ("juejin", "_tea"),
        ("__tea_cookie_tokens_2608", "_gid", "_tea_utm_cache_2608", "csrf_session_id", "has_biz_token",
         "is_staff_user", "n_mh", "passport_csrf_token", "passport_csrf_token_default",
         "passport_csrf_token_wap_state", "s_v_web_id", "session_tlb_tag", "sessionid", "sessionid_ss",
         "sid_guard", "sid_tt", "sid_ucp_v1", "ssid_ucp_v1", "uid_tt", "uid_tt_ss", "signatureId"),
    ),
    "shipinhao": _rule(
        ("weixin.qq.com", "qq.com"),
        ("weixin", "channels"),
        ("sessionid", "wxuin", "wxsid", "web_login_channel"),
    ),
    "cnblogs": _rule(
        ("cnblogs.com",),
        ("cnblogs",),
        (".CNBlogsCookie", ".Cnblogs.Account.Antiforgery", ".Cnblogs.Account.Session",
         ".Cnblogs.AspNetCore.Cookies", "HMACCOUNT", "HMACCOUNT_BFESS",
         "Hm_lpvt_866c9be12d4a814454792b1fd0fed295", "Hm_lvt_866c9be12d4a814454792b1fd0fed295",
         "SERVERID", "XSRF-TOKEN", "_GRECAPTCHA", "_c_WBKFRo", "CnblogsAdministrator"),
    ),
    "segmentfault": _rule(("segmentfault.com",), ("segmentfault",), ("SFSSID",)),
    "oschina": _rule(("oschina.net",), ("oschina",), ("_user_token", "osc")),
    "jianshu": _rule(
        ("jianshu.com", "jianshu.io"),
        ("jianshu",),
        ("HMACCOUNT", "HMACCOUNT_BFESS", "Hm_lpvt_0c0e9d9b1e7d617b3e6842e85b9fb068",
         "Hm_lvt_0c0e9d9b1e7d617b3e6842e85b9fb068", "_m7e_session_core", "default_font", "locale",
         "read_mode", "remember_user_token", "sajssdk_2015_cross_new_user", "sensorsdata2015jssdkcross",
         "web_login_version", "_jianshu_session"),
    ),
    # ===== 自媒体号平台 =====
    "baijiahao": _rule(
        ("baijiahao.baidu.com", "baidu.com"),
        ("baijiahao", "ppf"),
        ("BDUSS", "BDUSS_BFESS", "HOSUPPORT", "HOSUPPORT_BFESS", "PHPSESSID", "PTOKEN", "PTOKEN_BFESS",
         "RECENT_LOGIN", "RT", "STOKEN", "STOKEN_BFESS", "UBI", "UBI_BFESS", "XFI", "XFS", "XFT",
         "ppfuid", "pplogid", "pplogid_BFESS", "theme"),
    ),
    "qq": _rule(
        ("qq.com", "gtimg.com"),
        ("pt_", "pgv_", "qz_", "aegis", "ptnick_"),
        ("RK", "TSID", "__aegis_uid", "_qpsvr_localtk", "csrfToken", "p_skey", "p_uin", "pgv_info",
         "pgv_pvid", "pt2gguin", "pt4_token", "pt_clientip", "pt_guid_sig", "pt_local_token",
         "pt_login_sig", "pt_login_type", "pt_oauth_token", "pt_recent_uins", "pt_serverip", "ptcz",
         "ptnick_502319984", "qlogin_uid", "qrsig", "superkey", "supertoken", "superuin", "ts_last",
         "ts_uid", "ui", "uikey"),
    ),
    "dayihao": _rule(
        ("mp.dayu.com", "dayu.com", "taobao.com"),
        ("dayu",),
        ("_tb_token_", "cookie2", "unb"),
    ),
    "netease": _rule(
        ("mp.163.com", "163.com", "netease.com"),
        ("ntes", "163"),
        ("NTES_WEB_FP", "NTES_YD_SESS", "NTESwebSI", "P_INFO", "S_INFO", "THE_LAST_LOGIN_MOBILE",
         "__snaker__id", "_antanalysis_s_id", "_gid", "_ntes_nuid", "gdxidpyhxdE",
         "l_s_subscribehJWZDGT", "l_yd_s_subscribehJWZDGT", "l_yd_sign", "utid", "NTES_CMT_USER_INFO"),
    ),
    "sohu": _rule(("mp.sohu.com", "sohu.com"), ("sohu",), ("sct", "_mp_key")),
    "sina": _rule(
        ("sina.com.cn", "sina.cn", "weibo.com"),
        ("sina",),
        ("SCF", "SUB", "SUBP", "ALF", "SSOLoginState", "ALC", "WBPSESS"),
    ),
    # ===== 视频平台 =====
    "xigua": _rule(
        ("studio.ixigua.com", "ixigua.com", "snssdk.com", "bytedance.com"),
        ("ixigua", "snssdk", "bytedance"),
        ("sessionid", "uid_tt", "sid_tt", "sid_guard", "sid_ucp_v1", "uid_tt_ss", "sessionid_ss"),
    ),
    "haokan": _rule(("haokan.baidu.com", "baidu.com"), ("haokan",), ("BDUSS", "STOKEN")),
    # ===== SEO/GEO 高权重平台 =====
    "baidu_zhidao": _rule(("zhidao.baidu.com", "baidu.com"), ("zhidao",), ("BDUSS", "STOKEN")),
    "baidu_tieba": _rule(
        ("tieba.baidu.com", "baidu.com"),
        ("tieba",),
        ("BDUSS", "STOKEN", "TIEBA_USERTYPE"),
    ),
    "douban": _rule(("douban.com", "douban.co"), ("douban",), ("dbcl2", "ck")),
    "36kr": _rule(("36kr.com",), ("36kr",), ("kr_user_id", "kr_security_id")),
    "huxiu": _rule(("huxiu.com",), ("huxiu",), ("huxiu_user_token",)),
    "tmtmedia": _rule(("tmtpost.com",), ("tmtpost",), ("tmtpost_email", "user_id")),
    "acfun": _rule(("acfun.cn", "acg.tv"), ("acfun", "acpass"), ("acPasstoken", "ac_username")),
    "lofter": _rule(("lofter.com",), ("lofter",), ("LOFTER_PERSISTENT",)),
    "zhihu_daily": _rule(("daily.zhihu.com", "zhihu.com"), ("zhihu",), ("z_c0", "d_c0")),
    "people": _rule(
        ("login.peopleweb.com.cn", "peopleweb.com.cn", "people.com.cn"),
        ("people",),
        ("JSESSIONID",),
    ),
    "china_news": _rule(("chinanews.com.cn", "chinanews.com"), ("chinanews",), ("cnUserP",)),
    "hupu": _rule(("passport.hupu.com", "hupu.com", "hupucdn.com"), ("hupu",), ("hupu_username", "hupu_uid")),
    # ===== API/OAuth 平台扫码兜底 =====
    "wordpress": _rule(
        ("wordpress.com", "wp.com"),
        ("wordpress", "wp_"),
        ("ACCOUNT_CHOOSER", "APISID", "HSID", "LSID", "NID", "OTZ", "SAPISID", "SID", "SIDCC", "SMSV",
         "SSID", "__Host-1PLSID", "__Host-3PLSID", "__Host-GAPS", "__Host-GAPSTS", "__Host-_bb_c_uid",
         "__Secure-1PAPISID", "__Secure-1PSID", "__Secure-1PSIDCC", "__Secure-1PSIDRTS",
         "__Secure-1PSIDTS", "__Secure-3PAPISID", "__Secure-3PSID", "__Secure-3PSIDCC",
         "__Secure-3PSIDRTS", "__Secure-3PSIDTS", "_hcp", "country_code",
         "last_used_authentication_method", "recognized_logins", "region", "tk_ai", "wordpress",
         "wordpress_logged_in", "wordpress_logged_in_525ed659f", "wordpress_sec",
         "wordpress_test_cookie", "wp_525ed659f", "wp_sec_525ed659f"),
    ),
    "medium": _rule(("medium.com", "medium.io"), ("medium",), ("uid", "sid", "_cfuvid")),
    "youtube": _rule(
        ("youtube.com", "google.com", "ytimg.com", "googleusercontent.com"),
        ("youtube", "__secure-", "__host-"),
        ("ACCOUNT_CHOOSER", "APISID", "HSID", "LSID", "NID", "OTZ", "SAPISID", "SID", "SIDCC", "SMSV",
         "SSID", "VISITOR_INFO1_LIVE", "VISITOR_PRIVACY_METADATA", "YSC", "__Host-1PLSID",
         "__Host-3PLSID", "__Host-GAPS", "__Host-GAPSTS", "__Secure-1PAPISID", "__Secure-1PSID",
         "__Secure-1PSIDCC", "__Secure-1PSIDRTS", "__Secure-1PSIDTS", "__Secure-3PAPISID",
         "__Secure-3PSID", "__Secure-3PSIDCC", "__Secure-3PSIDRTS", "__Secure-3PSIDTS",
         "__Secure-ROLLOUT_TOKEN", "__Secure-YNID"),
    ),
    "toutiao": _rule(
        ("toutiao.com", "mp.toutiao.com", "snssdk.com", "bytedance.com"),
        ("toutiao", "snssdk", "bytedance"),
        ("sid_tt", "sessionid", "tt_scid", "uid_tt", "sid_guard", "sid_ucp_v1", "uid_tt_ss",
         "sessionid_ss", "tt_webid", "sso_ticket", "passport_csrf_token",
         "passport_csrf_token_default", "ttwid", "s_v_web_id", "n_mh", "has_biz_token",
         "is_staff_user", "odin_tt"),
    ),
    "wechat": _rule(
        ("mp.weixin.qq.com", "weixin.qq.com", "qq.com"),
        ("weixin", "slave_",),
        ("slave_sid", "slave_user"),
    ),
}


# ---------------------------------------------------------------------------
# 判据实现(纯函数,无 IO / 无网络 / 不读环境变量)
# ---------------------------------------------------------------------------
def normalize_cookie_domain(domain: str) -> str:
    """归一化 cookie 域名:小写、去前导点与首尾空白。返回空串表示无域名信息。"""
    return (domain or "").strip().lower().lstrip(".")


def domain_matches_rule(domain: str, rule: PlatformCookieRule) -> bool:
    """域名(有域名信息时)是否落在平台白名单内。按点边界后缀匹配,防 evilzhihu.com。"""
    d = normalize_cookie_domain(domain)
    if not d:
        return False
    for allowed in rule.domains:
        if d == allowed or d.endswith("." + allowed):
            return True
    return False


def _login_pattern_matches(pattern: str, name: str) -> bool:
    """登录 cookie 模式匹配(与 _cookie_hits 的 `前缀*` 通配语义一致)。"""
    if pattern.endswith("*"):
        return name.startswith(pattern[:-1])
    return name == pattern


def name_matches_rule(
    name: str,
    rule: PlatformCookieRule,
    login_cookie_patterns: Sequence[str] = (),
) -> bool:
    """无域名信息时的名字兜底归属判定(精确名 / 品牌 token / 该平台登录 cookie 模式)。"""
    if not name:
        return False
    if name in rule.name_exact:
        return True
    lowered = name.lower()
    if any(tok and tok in lowered for tok in rule.name_tokens):
        return True
    return any(_login_pattern_matches(p, name) for p in login_cookie_patterns)


def extract_cookie_domains(raw: str) -> dict[str, str]:
    """从用户粘贴的原始 cookie 文本里尽力抽取 name→domain 侧信息(2026-09-27 新增)。

    `_parse_raw_cookies` 返回的是 name→value 且按设计不携带 domain,归属判定需要的
    domain 只能从原始文本另取一路:
    - JSON 数组导出([{name, value, domain}]):逐条取 domain;
    - Netscape cookies.txt(Tab 分列,含 #HttpOnly_ 前缀行):取第 1 列;
    - JSON 对象 / 请求头格式:结构上没有域名 ⇒ 返回 {}(该 cookie 走名字兜底)。
    值只回名称与域名字符串,绝不接触 cookie 值以外的内容。
    """
    raw = (raw or "").strip()
    if not raw:
        return {}

    domains: dict[str, str] = {}
    if raw.startswith("["):
        try:
            obj = json.loads(raw)
        except Exception:
            obj = None
        if isinstance(obj, list):
            for item in obj:
                if not isinstance(item, dict):
                    continue
                name = item.get("name")
                domain = item.get("domain")
                if isinstance(name, str) and isinstance(domain, str):
                    norm = normalize_cookie_domain(domain)
                    if name and norm:
                        domains[name] = norm
        return domains

    if "\t" in raw:
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("#HttpOnly_"):
                line = line[len("#HttpOnly_"):].strip()
            elif line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) >= 7 and parts[5].strip():
                norm = normalize_cookie_domain(parts[0])
                if norm:
                    domains[parts[5].strip()] = norm
        return domains

    return {}


@dataclass(frozen=True)
class PlatformCookieFilterResult:
    """过滤结果:kept 为可入库子集,dropped 为丢弃的 cookie 名(不含值)。"""

    kept: dict[str, str]
    dropped: tuple[str, ...]

    @property
    def kept_count(self) -> int:
        return len(self.kept)

    @property
    def dropped_count(self) -> int:
        return len(self.dropped)


def filter_platform_cookies(
    platform: str,
    cookies: Mapping[str, str],
    domains_by_name: Mapping[str, str],
    login_cookie_patterns: Sequence[str],
) -> PlatformCookieFilterResult:
    """按平台归属规则逐条过滤 cookie。

    判序(不可颠倒):
    1. 该 cookie 携带 domain ⇒ 只按 domains 判(在名单内留,否则丢);
    2. 无 domain ⇒ 才允许名字兜底(name_exact / name_tokens / 登录 cookie 模式);
    3. 判不出 ⇒ 丢弃并计数(宁缺勿滥)。
    平台未在归属表登记 ⇒ ValueError(调用方应先按 PLATFORM_SCAN_CONFIG 校验平台;
    两表键集一致性另有测试钉死,正常链路不会走到这里)。
    """
    rule = PLATFORM_COOKIE_RULES.get(platform)
    if rule is None:
        raise ValueError(f"平台 {platform} 未登记 cookie 归属规则(platform_cookie_domains.PLATFORM_COOKIE_RULES)")

    kept: dict[str, str] = {}
    dropped: list[str] = []
    for name, value in cookies.items():
        domain = normalize_cookie_domain(domains_by_name.get(name, ""))
        if domain:
            ok = domain_matches_rule(domain, rule)
        else:
            ok = bool(name) and name_matches_rule(name, rule, login_cookie_patterns)
        if ok:
            kept[name] = value
        else:
            dropped.append(name)
    return PlatformCookieFilterResult(kept=kept, dropped=tuple(dropped))
