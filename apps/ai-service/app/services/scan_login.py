# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""扫码登录服务(2026-07-30 新增)。

需求:用户希望"在项目内置浏览器(WorkPanel)里扫码登录第三方平台,
自动保存 cookies 到后端账号"。

实现:
- 任务存储:P2 修复(2026-08-06)后 Redis 优先(`scan_login:task:{task_id}`,多实例共享),
  Redis 不可用时降级为进程内 dict;每个扫码任务 = {platform, user_id, status, cookies, qr_image}
- 后台线程:启动 Playwright Chromium → 打开平台登录页 → 持续截图 → 检测登录态
- 登录态判定:cookies 出现目标字段 / URL 跳转 / 出现用户头像
- 登录成功:提取相关 cookies → 调用账号更新 API → 标记任务完成
- 截图接口:前端轮询拉取二维码截图,在 WorkPanel 弹窗中显示

设计:
- 复用 screenshot_service 的单例 sync Browser(避免重复启动)
- 任务用 UUID 管理,默认 5 分钟超时
- 完成后自动关闭 context,保留任务结果 5 分钟供前端拉取
"""
from __future__ import annotations

import asyncio
import base64
import contextlib
import json
import os
import queue
import re
import threading
import time
import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

from ..core.config import settings
from ..core.logging import get_logger
from .publish.credential_history import apply_credentials_update
from .publish.platform_cookie_domains import filter_platform_cookies

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# 平台登录配置:登录 URL + 期望 cookie 字段 + 登录后跳转 URL 特征
# ---------------------------------------------------------------------------
PLATFORM_SCAN_CONFIG: dict[str, dict[str, Any]] = {
    "zhihu": {
        "name": "知乎",
        "login_url": "https://www.zhihu.com/signin",
        "success_cookies": ["z_c0"],
        "success_url_pattern": r"^https?://(www\.)?zhihu\.com/?($|#|\?)|/people/|/follow",
        "fallback_url_pattern": r"^https?://(www\.)?zhihu\.com/?$",
        # 2026-09-30 实测:默认 tab 即「打开知乎App」码,链路本就可用;微信切换合成点击
        # 不触发(监听绑内层节点)留档放弃。码 canvas 画入跨域图被污染(TAINTED,
        # SecurityError)无法直接提取 → 走「网络捕获重绘」:页面 token 接口
        # /api/v3/account/api/login/qrcode 响应含 link(扫码链接,与官方 canvas 码
        # 内容一致),segno 用页面同一 token 重绘干净码,登录检测链路不受影响。
        "qr_capture": {
            "url_substring": "api/v3/account/api/login/qrcode",
            "store_key": "zhihu_link",
            "field_paths": ("link", "data.link"),
        },
    },
    "bilibili": {
        "name": "B站",
        "login_url": "https://passport.bilibili.com/login",
        "success_cookies": ["SESSDATA", "DedeUserID"],
        "success_url_pattern": r"^https?://(www\.)?bilibili\.com/?($|#|\?)|bilibili\.com/index",
        # 2026-09-30 探针实测:登录页有 span.btn.wechat「微信登录」按钮(此前判断有误)
        "scan_tab_selectors": ('span.btn.wechat',),
    },
    "xiaohongshu": {
        "name": "小红书",
        "login_url": "https://www.xiaohongshu.com/explore",
        "success_cookies": ["web_session"],  # 2026-09-15:剔除 webId/a1 登录前游客 cookie,避免误报
        "success_url_pattern": r"^https?://(www\.)?xiaohongshu\.com/explore",
        # 2026-09-30 探针实测:登录层有 .tip-text.wechat 微信入口(图标+文本)
        "scan_tab_selectors": ('.tip-text.wechat',),
    },
    "weibo": {
        "name": "微博",
        "login_url": "https://passport.weibo.com/sso/signin?entry=miniblog&source=miniblog&disp=popup&url=https%3A%2F%2Fweibo.com%2Fu%2F0",
        "success_cookies": ["SUB", "MLOGIN"],
        "success_url_pattern": r"weibo\.com/u/\d+",
        # 2026-09-30 探针实测:登录页有「微信登录」span(cursor-pointer)
        "scan_tab_selectors": ('span:has-text("微信登录")',),
    },
    "douyin": {
        "name": "抖音",
        "login_url": "https://www.douyin.com/",
        "success_cookies": ["sessionid", "uid_tt", "sid_tt"],
        "success_url_pattern": r"douyin\.com/$",
        # 2026-09-30 探针实测:抖音登录页无任何微信入口(全平台唯一),走 App 扫码。
        # 登录弹层自动弹出、默认「扫码登录」tab 即 App 码,链路本就可用。
        # 码是动画合成渲染(#animate_qrcode_container,无独立 img/canvas/bg 载体,
        # iframe/shadow 穿透亦无)→ 对码容器元素级截图,只有码区无页面杂物。
        "qr_element_screenshot": "#animate_qrcode_container",
    },
    "kuaishou": {
        "name": "快手",
        "login_url": "https://www.kuaishou.com/",
        "success_cookies": ["userId", "kuaishou.server.web_st"],
        "success_url_pattern": r"kuaishou\.com/$",
        # 2026-09-30 实测:需先点「立即登录」弹层(默认「快手APP登录」tab 即 App 码);
        # 弹层无微信入口(探针命中的「微信扫码」是页面隐藏元素)→ 走 App 扫码。
        "scan_tab_selectors": ('text=立即登录',),
        # 码图直接获取:弹层内唯一大尺寸 data:PNG img(无类名,提取器带 ≥120px 过滤)
        "qr_image_selectors": ('img[src^="data:image"]',),
    },
    "csdn": {
        "name": "CSDN",
        "login_url": "https://passport.csdn.net/login",
        "success_cookies": ["UserName", "UserToken", "UserSecret"],
        "success_url_pattern": r"^https?://(www\.)?csdn\.net/?($|#|\?)|blog\.csdn\.net",
        # 2026-09-30 探针实测:有「微信登录」tab(实测时已是 tabs-active,点击幂等)
        "scan_tab_selectors": ('span:has-text("微信登录")',),
    },
    "juejin": {
        "name": "掘金",
        "login_url": "https://juejin.cn/login",
        "success_cookies": ["sessionid", "signatureId"],
        "success_url_pattern": r"^https?://(www\.)?juejin\.cn/?($|#|\?)|/dashboard",
        # 2026-09-30 实测:右侧「扫码登录」默认即掘金 App 码(img.qrcode-img,data:PNG),
        # 链路本就可用。第三方「微信」图标是 OAuth 弹窗模式,主页面截图架构拿不到
        # 弹窗里的码 → 不配微信计划。
        "qr_image_selectors": ('img.qrcode-img',),
    },
    "shipinhao": {
        "name": "视频号",
        "login_url": "https://channels.weixin.qq.com/login",
        "success_cookies": ["wxuin", "wxsid", "web_login_channel"],
        "success_url_pattern": r"channels\.weixin\.qq.com/(home|creator)",
    },
    # ===== 第二批:友好 API 平台(2026-08-01 扩展)=====
    "cnblogs": {
        "name": "博客园",
        "login_url": "https://account.cnblogs.com/signin",
        "success_cookies": [".CNBlogsCookie", "CnblogsAdministrator"],
        "success_url_pattern": r"account\.cnblogs\.com/|cnblogs\.com/mvc/news.aspx",
    },
    "segmentfault": {
        "name": "思否",
        "login_url": "https://segmentfault.com/user/login",
        "success_cookies": ["SFSSID"],  # 2026-09-15:剔除 PHPSESSID(登录页即存在的服务端会话)
        "success_url_pattern": r"segmentfault\.com/u/",
        # 2026-09-29:登录页默认是密码表单,扫码入口是"微信登录"按钮 —— 通用文案清单
        # (扫码登录/二维码登录/微信扫码…)在思否页面上一个都匹配不到,二维码永远出不来。
        "scan_tab_selectors": ('button:has-text("微信登录")',),
    },
    "oschina": {
        "name": "开源中国",
        # 2026-09-30 实测:旧 /action/user/hash_login 已废弃(curl 直连 403/带 referer 404),
        # 且 WAF 会把无指纹的 Playwright 请求挂到 30s 超时 —— 这就是该平台"打不开登录页"的真因。
        # 首页「登录/注册」按钮现指向 /home/login,直达它。
        "login_url": "https://www.oschina.net/home/login",
        "success_cookies": ["_user_token", "osc"],
        "success_url_pattern": r"oschina\.net/u/\d+|my\.oschina\.net",
        # 2026-09-30 探针实锤:该页有微信登录(第三方图标行 #icon-wx),但**必须先勾协议**,
        # 否则前端直接吞掉微信图标的点击(0 请求 0 跳转)。顺序点击计划两步:
        #   ① 勾协议 —— 只能点视觉盒 `label.login-agreement span.ant-checkbox`:
        #      点 `input.ant-checkbox-input` 被 antd 覆盖层挡住(Playwright 命中检测失败),
        #      点整条 label 会落在中心的《服务条例》链接上(弹出新页而不翻勾,实测 clicked=True
        #      而 checked 不变)—— 点击"成功"不等于勾上了,判据要验状态。
        #   ② 点微信图标 —— 主页随即整页跳到 open.weixin.qq.com/connect/qrconnect,
        #      码就在主页 DOM 的 img 里(与头条纯 HTTP 通道同一形态)。
        "scan_tab_selectors": (
            ("label.login-agreement span.ant-checkbox", "svg:has(use[*|href*='icon-wx'])"),
        ),
        # 微信官方码原图(服务端拉取,和头条同款"直接获取"),不再给登录页截图。
        "qr_image_selectors": ('img[src*="connect/qrcode"]',),
    },
    "jianshu": {
        "name": "简书",
        "login_url": "https://www.jianshu.com/sign_in",
        "success_cookies": ["remember_user_token", "_jianshu_session"],
        "success_url_pattern": r"jianshu\.com/u/|jianshu\.com/writer",
    },
    # ===== 第三批:六大号平台(2026-08-01 扩展)=====
    "baijiahao": {
        "name": "百家号",
        "login_url": "https://baijiahao.baidu.com",
        "success_cookies": ["BDUSS", "STOKEN"],  # 2026-09-15:剔除 BAIDUID 统计 cookie
        "success_url_pattern": r"baijiahao\.baidu\.com/(ucui|home)",
    },
    "qq": {
        "name": "企鹅号",
        # 2026-09-29 实测:/userAuth/login 已 404;根域 om.qq.com/ 会重定向到 /userAuth/index(真登录页),直达少一跳
        "login_url": "https://om.qq.com/userAuth/index",
        "success_cookies": ["p_skey", "ptcz"],  # 2026-09-15:剔除 pgv_pvid/RK 统计 cookie
        "success_url_pattern": r"om\.qq\.com/(main|companion)",
        # 2026-09-29 实测:默认停在 QQ登录 tab,点 tab 必弹"服务协议"层(layui),
        # 点"同意"(a.layui-layer-btn0)后 ptlogin2 快捷登录二维码才渲染。
        # 顺序点击计划:逐步"有则点、无则跳"。走 QQ扫码(与 success_cookies 的
        # p_skey/ptcz 同源);微信 tab 的码容器实测始终 about:blank 不加载。
        "scan_tab_selectors": (
            ('span.tab-text:has-text("QQ登录")', 'a.layui-layer-btn0'),
        ),
    },
    "dayihao": {
        "name": "大鱼号",
        "login_url": "https://mp.dayu.com",
        "success_cookies": ["_tb_token_", "cookie2", "unb"],
        "success_url_pattern": r"mp\.dayu\.com/(dashboard|home)",
    },
    "netease": {
        "name": "网易号",
        "login_url": "https://mp.163.com/login.html",
        "success_cookies": ["P_INFO", "S_INFO", "NTES_CMT_USER_INFO"],
        "success_url_pattern": r"mp\.163\.com/(media|home)",
    },
    "sohu": {
        "name": "搜狐号",
        # 2026-09-29 实测:/mp/login 与 /login 均 404/跳走;登录弹层挂在首页,
        # 点"登录"(.navigation-login-wrap .login)弹出(极少数情况开新窗,点击跨页兜底)
        "login_url": "https://mp.sohu.com/",
        "success_cookies": ["sct", "_mp_key"],  # 2026-09-15:剔除 SUV/IPLOC 统计/地域 cookie
        "success_url_pattern": r"mp\.sohu\.com/(mp4|home)",
        # 2026-09-29 实测:登录层默认"账号登录"表单,扫码入口是"其他方式"排的
        # 微信圆标(.third .wx),点完 [class*="qrcode"] img 160×160 出现在页面里
        "scan_tab_selectors": (
            ('.navigation-login-wrap .login', '.third .wx'),
        ),
    },
    "sina": {
        "name": "新浪看点",
        "login_url": "https://login.sina.com.cn/signup/signin.php",
        "success_cookies": ["SCF", "SUB", "SUBP", "ALF"],
        "success_url_pattern": r"login\.sina\.com\.cn/cgi|weibo\.com/u/",
        # 2026-09-30 探针实测:登录页 span[微信登录] 点击后出真微信官方码
        # (open.weixin.qq.com/connect/qrcode)→ 接入微信码通道
        "scan_tab_selectors": ('span:text("微信登录")',),
    },
    # ===== 视频平台(2026-08-01 扩展)=====
    "xigua": {
        "name": "西瓜视频",
        "login_url": "https://studio.ixigua.com/login",
        "success_cookies": ["sessionid", "uid_tt", "sid_tt"],
        "success_url_pattern": r"studio\.ixigua\.com/(main|dashboard)",
    },
    "haokan": {
        "name": "好看视频",
        "login_url": "https://haokan.baidu.com",
        "success_cookies": ["BDUSS", "STOKEN"],  # 2026-09-15:剔除 BAIDUID 统计 cookie
        "success_url_pattern": r"haokan\.baidu\.com/(u|creator)",
    },
    # ===== 第四批:SEO/GEO 高权重平台(2026-08-01 扩展)=====
    "baidu_zhidao": {
        "name": "百度知道",
        "login_url": "https://passport.baidu.com/v2/?login",
        "success_cookies": ["BDUSS", "STOKEN"],
        "success_url_pattern": r"passport\.baidu\.com/center|zhidao\.baidu\.com",
        # 2026-09-30 探针实测:百度统一登录层第三方行(.pass-phoenix-btn)微信图标
        # 点击后出微信码(passport.baidu.com/v2/api/qrcode)→ 接入;扫码确认后
        # BDUSS 登录态照常发放,success_cookies 检测不变
        "scan_tab_selectors": ('.pass-phoenix-btn a:has-text("微信")',),
    },
    "baidu_tieba": {
        "name": "百度贴吧",
        "login_url": "https://passport.baidu.com/v2/?login",
        "success_cookies": ["BDUSS", "STOKEN", "TIEBA_USERTYPE"],
        "success_url_pattern": r"tieba\.baidu\.com/(index|home)",
        # 2026-09-30 探针实测:与百度知道同一 passport 登录层,微信图标同款可点出码
        "scan_tab_selectors": ('.pass-phoenix-btn a:has-text("微信")',),
    },
    "douban": {
        "name": "豆瓣",
        "login_url": "https://accounts.douban.com/passport/login",
        "success_cookies": ["dbcl2", "ck"],
        "success_url_pattern": r"accounts\.douban\.com/passport|douban\.com/mine",
        # 2026-09-30 探针实测:登录表单第三方图标 a.link-3rd-wx 点击后出**真微信官方码**
        # (open.weixin.qq.com/connect/qrcode,160px)→ 接入
        "scan_tab_selectors": ('a.link-3rd-wx',),
    },
    "36kr": {
        "name": "36氪",
        "login_url": "https://36kr.com/signin",
        "success_cookies": ["kr_user_id", "kr_security_id"],
        "success_url_pattern": r"36kr\.com/user/|36kr\.com/newsflashes",
    },
    "huxiu": {
        "name": "虎嗅网",
        "login_url": "https://www.huxiu.com/user/login",
        "success_cookies": ["huxiu_user_token"],
        "success_url_pattern": r"huxiu\.com/user/\d+|huxiu\.com/member",
    },
    "tmtmedia": {
        "name": "钛媒体",
        "login_url": "https://www.tmtpost.com/login",
        "success_cookies": ["tmtpost_email", "user_id"],
        "success_url_pattern": r"tmtpost\.com/user/|dao\.tmtpost\.com",
    },
    "acfun": {
        "name": "AcFun",
        "login_url": "https://www.acfun.cn/login",
        "success_cookies": ["acPasstoken", "ac_username"],
        "success_url_pattern": r"acfun\.cn/u/|acfun\.cn/member",
    },
    "lofter": {
        "name": "LOFTER",
        "login_url": "https://www.lofter.com/login",
        "success_cookies": ["LOFTER_PERSISTENT"],
        "success_url_pattern": r"lofter\.com/assign|lofter\.com/home",
    },
    "zhihu_daily": {
        "name": "知乎日报",
        # 2026-09-29 实测:daily.zhihu.com/login 404,日报无独立 Web 登录 —— 复用
        # 知乎主站扫码:z_c0 种在 .zhihu.com,天然覆盖 daily 子域(success_cookies 本就只认 z_c0)
        "login_url": "https://www.zhihu.com/signin",
        "success_cookies": ["z_c0"],  # 2026-09-15:剔除 d_c0 登录前游客 cookie
        "success_url_pattern": r"daily\.zhihu\.com/account|^https?://(www\.)?zhihu\.com/?($|#|\?)|/people/|/follow",
    },
    "people": {
        "name": "人民网",
        "login_url": "https://login.peopleweb.com.cn/login",
        # 2026-09-15 终审修复:JSESSIONID 是 Java 框架通用会话 cookie,登录页一打开就存在,
        # 仅靠 cookie 必然误报 → 必须同时命中登录后 URL 才判定成功
        "success_cookies": ["JSESSIONID"],
        "success_url_pattern": r"login\.peopleweb\.com\.cn/(success|home)",
        "require_url_match": True,
    },
    "china_news": {
        "name": "中国新闻网",
        "login_url": "https://www.chinanews.com.cn/member/login",
        "success_cookies": ["cnUserP"],
        "success_url_pattern": r"chinanews\.com\.cn/member/(center|home)",
    },
    "hupu": {
        "name": "虎扑社区",
        "login_url": "https://passport.hupu.com/iframe/login",
        "success_cookies": ["hupu_username", "hupu_uid"],
        "success_url_pattern": r"passport\.hupu\.com/iframe/loginSuccess|my\.hupu\.com",
    },
    # ===== 第五批:API/OAuth 平台扫码兜底(2026-09-16 补齐)=====
    # 背景:批量扫码队列此前对 wordpress/medium/youtube/toutiao/wechat 报
    # "未找到该平台登录页配置"——这 5 个平台在前端 PLATFORM_SCHEMAS(38 个)中
    # 存在但缺扫码配置。与 douyin/kuaishou(oauth 类型已有扫码配置)同一设计:
    # 扫码捕获浏览器登录态 cookies 保存到账号;API 凭据发布仍走各自的凭据配置。
    "wordpress": {
        "name": "WordPress",
        "login_url": "https://wordpress.com/log-in",
        # WordPress 登录 cookie 名带哈希后缀(wordpress_logged_in_<hash>),
        # 必须用前缀通配;wordpress.com 登录后跳 /home,自建站跳 /wp-admin/
        "success_cookies": ["wordpress_logged_in*"],
        "success_url_pattern": r"wordpress\.com/(home|me)\b|wp-admin/",
    },
    "medium": {
        "name": "Medium",
        "login_url": "https://medium.com/m/signin",
        "success_cookies": ["uid", "sid"],  # Medium 登录后会话 cookie
        "success_url_pattern": r"^https?://(www\.)?medium\.com/?($|#|\?)|medium\.com/me\b",
    },
    "youtube": {
        "name": "YouTube",
        "login_url": "https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fwww.youtube.com%2F",
        # Google 会话 cookie(域名 .google.com/.youtube.com 均可取到)
        "success_cookies": ["SID", "HSID", "SSID", "SAPISID", "__Secure-1PSID"],
        # 登录页在 accounts.google.com(path 含 login → _url_is_login_page 拦住),
        # 登录成功后 continue 跳回 youtube.com 首页
        "success_url_pattern": r"^https?://(www\.)?youtube\.com/?($|#|\?)",
        "require_url_match": True,
    },
    "toutiao": {
        "name": "今日头条",
        "login_url": "https://www.toutiao.com/",
        # 2026-09-29 剔除 tt_scid:它是字节跳动设备追踪 cookie,游客访问首页就带,
        # 曾导致"打开首页 3 秒未扫码即假成功"(任一命中即判登录,_cookie_hits 是 any 语义)。
        # 真正的登录会话 cookie 只有 sid_tt / sessionid(未登录时不存在)。
        "success_cookies": ["sid_tt", "sessionid"],
        "success_url_pattern": r"^https?://(www\.)?toutiao\.com/?($|#|\?)|mp\.toutiao\.com/(dashboard|home|main)",
        # 2026-09-29 微信扫码通道(纯 HTTP,不起浏览器):用户要微信码而非头条 App 码。
        # 链路 = wap_login 302 直出**新鲜 state** 的 qrconnect → 页内 fordevtool 取
        # uuid → /connect/qrcode/{uuid} 即微信官方码 → 长轮询 405 拿 wx_code
        # → login_success 302 链 cookie 落袋。
        # ⚠️ Playwright 点击式 OAuth 已定性死路勿回头:头条前端对 CDP 通道确定性拦截
        # (三轮对照实验 v12-v15,协议勾选/隐身参数/精确 aria 点击全无效,0 微信请求);
        # 直接命中 wap_login 服务端端点则完全绕开前端。state 每任务新鲜生成,
        # 无会话绑定校验(fake code 探针:2h 前的 state 仍走通 callback 链)。
        "http_flow": "toutiao_wechat",
    },
    # 2026-09-29 双通道共存:伪平台,复用通用 Playwright 流走"头条 App 扫码"原生码,
    # 供微信未绑定头条的用户兜底。落库/cookie 归属经 account_platform 归并回 toutiao,
    # 账号不会分裂成两个平台。
    "toutiao_app": {
        "name": "今日头条(App扫码)",
        "login_url": "https://www.toutiao.com/",
        "success_cookies": ["sid_tt", "sessionid"],
        "success_url_pattern": r"^https?://(www\.)?toutiao\.com/?($|#|\?)|mp\.toutiao\.com/(dashboard|home|main)",
        "account_platform": "toutiao",
        # 出码路径 = 点 a.login-button:visible(首个实例藏在 SSR 骨架里 is_visible=False,
        # 必须 :visible 限定)→ 弹层右侧"扫码登录"tab 即真码。⚠️ 勿配右下"扫码下载"推广码。
        # ⚠️ 码有效期 ~140s,过期后码区变"点击刷新"提示(wrapper 多出 qrcode-tip 类),
        # qr_refresh_selectors 守门自动点刷新(ttp-modal-mask 拦普通 click,JS click 可绕)。
        "scan_tab_selectors": (
            ('a.login-button:visible',),
        ),
        "qr_refresh_selectors": (
            (
                '[class*="qrcode-wrapper"][class*="qrcode-tip"]',
                "li.tool-item.refresh",
            ),
        ),
    },
    "wechat": {
        "name": "微信公众号",
        "login_url": "https://mp.weixin.qq.com/",
        "success_cookies": ["slave_sid", "slave_user"],
        "success_url_pattern": r"mp\.weixin\.qq\.com/cgi-bin/",
    },
}


# ---------------------------------------------------------------------------
# URL 判定工具(2026-09-15 终审:登录页判定只看 path,避免 login.* 域名的成功页被误伤)
# ---------------------------------------------------------------------------
def _url_is_login_page(url: str) -> bool:
    """判断 URL 路径是否为登录/注册页。

    仅判定 path:域名含 login/passport(如 login.peopleweb.com.cn/success)不算登录页,
    否则这类平台的登录后跳转页永远无法通过检测。
    """
    try:
        parsed = urlparse(url)
        path = ((parsed.path or "") + "?" + (parsed.query or "")).lower()
    except Exception:
        path = url.lower()
    return any(s in path for s in ("login", "signin", "signup", "sign_in"))


def _url_matches_success(config: dict[str, Any], url: str) -> bool:
    """URL 是否命中登录后特征页(success_url_pattern 且不在登录页)。"""
    if not url:
        return False
    pattern = config.get("success_url_pattern", "")
    return bool(pattern and re.search(pattern, url) and not _url_is_login_page(url))


def _cookie_hits(
    config: dict[str, Any], cookies_dict: dict[str, str], min_len: int = 5
) -> list[str]:
    """success_cookies 命中检测(2026-09-16 新增:支持 `前缀*` 通配)。

    WordPress 等平台的登录 cookie 名带哈希后缀(wordpress_logged_in_<hash>),
    旧版精确匹配永远命中不了 → 条目以 `*` 结尾时按前缀匹配。
    min_len=5:非空且长度足够才视为有效会话;min_len=0:仅判断存在(URL 兜底用)。
    """
    hits: list[str] = []
    for target in config["success_cookies"]:
        if target.endswith("*"):
            prefix = target[:-1]
            hits.extend(
                k
                for k in cookies_dict
                if k.startswith(prefix) and len(cookies_dict[k]) > min_len
            )
        elif target in cookies_dict and len(cookies_dict[target]) > min_len:
            hits.append(target)
    return hits


def _cookie_domain_map(raw_cookies: Sequence[Mapping[str, Any]]) -> dict[str, str]:
    """从 CDP/context 的原始 cookie 条目里取 name → domain(缺 domain 的不进映射)。"""
    out: dict[str, str] = {}
    for c in raw_cookies:
        name = str(c.get("name") or "")
        dom = str(c.get("domain") or "").strip()
        if name and dom:
            out[name] = dom
    return out


def _account_platform_of(platform: str) -> str:
    """伪平台(如 toutiao_app)归并到真实账号平台;未配置 account_platform 时原样返回。"""
    # 表值是 `dict[str, Any]`,直接 return 被 mypy 判 `no-any-return` ⇒ 守门 35(blocking)红在**干净
    # HEAD** 上,而这一型的代价不是"少一次检查",是这台机每次提交都被逼 --no-verify、链上 196 项
    # 对每次提交作废(AGENTS §12f/§12e)。
    # 取 `str(...)` 而不是 `cast`:同仓读 Any 边界的既有写法就是这个形状(`agent_engine.py:2232`
    # `str(payload.get("finalResponse", "") or "")`、`agent_deliverables.py:86` `str(diff.get("path") or "")`),
    # 拿别人的正例比自己发明一个稳妥。**本票不改任何判定、不加兜底**:四个调用点的去处都声明
    # `platform: str`(`_collect_platform_relevant` :427 三处、`_save_account_to_db` :1589 一处),
    # 而这张表的 account_platform 现读只有字符串("toutiao"),所以 str() 在这一格是恒等变换。
    # 反面记录一条:我先试过"标注 `account_platform: str = <Any 表达式>`"——在 `--strict` 下那只是把
    # `no-any-return` 换成 `assignment` 报错,红没消,别照着试第二遍。
    return str(PLATFORM_SCAN_CONFIG.get(platform, {}).get("account_platform", platform))


def _collect_platform_relevant(
    platform: str,
    cookies_dict: dict[str, str],
    raw_cookies: Sequence[Mapping[str, Any]],
    config: dict[str, Any],
) -> dict[str, str]:
    """落库前的**唯一**归属收口:域名优先、名称兜底、判不出即丢弃。

    旧写法是一份 5 项 cookie 名子串黑名单,而 `BDUSS`、
    `.CNBlogsCookie`、`APISID` 这些异站 cookie 的名字压根不含这 5 个子串 ——
    2026-09-27 实测到发布账号里因此落进过 533 字段的整浏览器混包。
    平台未在归属表登记时**退到"只保留命中的登录 cookie"**(安全最小集),
    绝不退回旧黑名单:那是把已被证伪的口径再抄一遍。
    """
    try:
        result = filter_platform_cookies(
            platform=platform,
            cookies=cookies_dict,
            domains_by_name=_cookie_domain_map(raw_cookies),
            login_cookie_patterns=config["success_cookies"],
        )
    except ValueError as e:
        logger.error(f"[scan_login] 平台 {platform} 无 cookie 归属规则,只保留命中的登录 cookie:{e}")
        only_login = _cookie_hits(config, cookies_dict, min_len=0)
        return {k: cookies_dict[k] for k in only_login if k in cookies_dict}
    if result.dropped:
        logger.info(
            f"[scan_login] 平台 {platform} 按归属剔除 {len(result.dropped)} 条非本站 cookie"
            f"(保留 {len(result.kept)})"
        )
    return result.kept


def _parse_raw_cookies(raw: str) -> dict[str, str]:
    """解析用户手动粘贴的 Cookie 文本(2026-09-16 新增,系统默认浏览器 + 手动导入模式)。

    背景:用户日常浏览器的登录态受默认 profile / App-Bound Encryption 保护,
    后端无法自动读取(Chrome 136+ 明确禁止),只能由用户从浏览器复制后手动粘贴。
    支持三种常见格式(自动识别):
    1. JSON 对象 {"name": "value", ...} 或数组 [{"name": ..., "value": ...}, ...]
       (浏览器扩展 / DevTools 导出的格式)
    2. Netscape cookies.txt:每行 Tab 分隔(域名的 HttpOnly cookie 也能带上)
    3. 请求头格式:name1=value1; name2=value2(document.cookie / Copy as cURL)
    """
    raw = (raw or "").strip()
    if not raw:
        return {}

    # 1. JSON(对象或数组)
    if raw.startswith("{") or raw.startswith("["):
        try:
            obj = json.loads(raw)
        except Exception:
            obj = None
        if isinstance(obj, dict):
            return {
                str(k): str(v)
                for k, v in obj.items()
                if v is not None and str(v).strip()
            }
        if isinstance(obj, list):
            parsed: dict[str, str] = {}
            for item in obj:
                if isinstance(item, dict) and item.get("name") and item.get("value"):
                    parsed[str(item["name"])] = str(item["value"])
            if parsed:
                return parsed

    # 2. Netscape cookies.txt(Tab 分隔;以 # 开头的注释行跳过,#HttpOnly_ 前缀行剥掉前缀)
    if "\t" in raw:
        parsed = {}
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("#HttpOnly_"):
                line = line[len("#HttpOnly_"):]
            elif line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) >= 7 and parts[5].strip() and parts[6].strip():
                parsed[parts[5].strip()] = parts[6].strip()
        if parsed:
            return parsed

    # 3. 请求头格式(分号分隔的 k=v;换行也当分隔符,容忍用户从 DevTools 多行复制)
    parsed = {}
    for piece in raw.replace("\n", ";").split(";"):
        piece = piece.strip()
        if not piece or "=" not in piece:
            continue
        name, _, value = piece.partition("=")
        name, value = name.strip(), value.strip()
        if name and value:
            parsed[name] = value
    return parsed


# ---------------------------------------------------------------------------
# 任务状态
# ---------------------------------------------------------------------------
@dataclass
class ScanTask:
    task_id: str
    user_id: str
    platform: str
    status: str = "pending"  # pending | waiting_scan | scanned | success | failed | timeout | cancelled | expired
    message: str = ""
    # 2026-09-30 进度阶梯:让前端能显示"走到哪一步",而不是一个不动的转圈。
    # booting 启动浏览器 → opening 打开登录页 → switching 切到扫码 → rendering 等码渲染
    # → ready 码已就绪。前端按值映射文案,后端只给机器可读的值。
    stage: str = "booting"
    qr_image_b64: str = ""  # base64 PNG 截图
    qr_image_updated_at: float = 0.0
    cookies: dict[str, str] = field(default_factory=dict)
    all_relevant_cookies: dict[str, str] = field(default_factory=dict)
    account_id: int | None = None  # 关联到的后端账号 id
    created_at: float = field(default_factory=time.time)
    completed_at: float | None = None
    _thread: threading.Thread | None = field(default=None, repr=False)
    _stop_event: threading.Event = field(default_factory=threading.Event, repr=False)
    _context: Any = field(default=None, repr=False)
    _page: Any = field(default=None, repr=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    # 2026-09-30 网络层码图捕获:qr_capture 配置的平台,page.on("response") 把官方
    # 码数据(token/link/base64)存在这里,与页面同会话 —— 知乎等页面自己轮询 token
    # 的平台必须复用页面 token 生成码,否则用户扫的是"服务端另取的码",页面轮询不知情
    _net_captured: dict[str, str] = field(default_factory=dict, repr=False)
    # 2026-09-30 任务交互通道:扫码后的多步验证(短信验证码等)由 API 端点投递动作,
    # 任务线程在等待循环里消费执行 —— sync Playwright 非线程安全,只许任务线程摸 page
    _interact_q: queue.Queue | None = field(default=None, repr=False)
    _interact_results: dict[str, dict[str, Any]] = field(default_factory=dict, repr=False)

    def is_terminal(self) -> bool:
        # P2 修复(2026-08-06): 新增 expired 终态
        return self.status in ("success", "failed", "timeout", "cancelled", "expired")

    def snapshot(self) -> dict[str, Any]:
        """返回可序列化的状态(供 API 返回)。"""
        return {
            "task_id": self.task_id,
            "user_id": self.user_id,
            "platform": self.platform,
            "status": self.status,
            "message": self.message,
            "stage": self.stage,
            "has_qr": bool(self.qr_image_b64),
            "qr_updated_at": self.qr_image_updated_at,
            "cookies_count": len(self.all_relevant_cookies),
            "account_id": self.account_id,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
        }


# ---------------------------------------------------------------------------
# 任务交互(2026-09-30):扫码后多步验证(手机号/短信码)的通用出口。
# sync Playwright 非线程安全:API 协程只入队,真正摸 page 的动作在任务线程的
# 等待循环里由 _drain_interactions 执行,结果按关联 id 回填。
# ---------------------------------------------------------------------------
_INTERACT_ACTIONS = ("screenshot", "fill", "click", "text", "drag", "eval")


def _resolve_locator(page: Any, selector: str) -> Any:
    """主框架找不到时自动穿透所有 iframe(验证码类组件普遍 iframe 化)。"""
    loc = page.locator(selector).first
    try:
        loc.wait_for(state="attached", timeout=1200)
        return loc
    except Exception:  # noqa: BLE001
        pass
    for fr in page.frames:
        if fr is page.main_frame:
            continue
        try:
            cand = fr.locator(selector).first
            cand.wait_for(state="attached", timeout=800)
            return cand
        except Exception:  # noqa: BLE001
            continue
    raise RuntimeError(f"元素未找到(已穿透全部 iframe): {selector}")


def _drain_interactions(task: ScanTask, page: Any) -> None:
    """消费交互队列。必须由任务线程调用(创建 page 的同一线程)。"""
    q = task._interact_q
    if q is None:
        return
    while True:
        try:
            rid, action, selector, value = q.get_nowait()
        except queue.Empty:
            break
        result: dict[str, Any] = {"id": rid, "ok": False, "url": ""}
        try:
            result["url"] = page.url
            if action == "screenshot":
                shot = page.screenshot(type="png")
                result["screenshot_b64"] = base64.b64encode(shot).decode("ascii")
                result["ok"] = True
            elif action == "fill":
                _resolve_locator(page, selector or "").fill(value or "", timeout=5000)
                result["ok"] = True
            elif action == "click":
                _resolve_locator(page, selector or "").click(timeout=5000)
                result["ok"] = True
            elif action == "text":
                if selector:
                    result["text"] = _resolve_locator(page, selector).inner_text(timeout=5000)
                else:
                    result["text"] = page.title()
                result["ok"] = True
            elif action == "drag":
                # 滑块验证码:value="dx[,dy]"(像素,相对起点中心);selector 为拖动起点(滑块手柄)。
                # 变速 + 轻微纵向抖动模拟人手轨迹(行为检测),结束在目标点短暂停顿再松开。
                raw = (value or "0").replace(" ", "")
                parts = [float(x) for x in raw.split(",") if x != ""]
                dx = parts[0] if parts else 0.0
                dy = parts[1] if len(parts) > 1 else 0.0
                box = _resolve_locator(page, selector or "").bounding_box()
                if not box:
                    raise RuntimeError(f"拖动起点 bounding_box 为空: {selector}")
                sx = box["x"] + box["width"] / 2
                sy = box["y"] + box["height"] / 2
                page.mouse.move(sx, sy)
                page.mouse.down()
                steps = max(20, min(80, int(abs(dx) / 4) or 20))
                for i in range(1, steps + 1):
                    u = i / steps
                    e = u * u * (3 - 2 * u)  # smoothstep 缓入缓出
                    wobble = ((i % 4) - 1.5) * 0.8
                    page.mouse.move(sx + dx * e, sy + dy * e + wobble)
                    delay = 0.006
                    if i < steps * 0.2:
                        delay += 0.02  # 起手慢
                    elif i > steps * 0.85:
                        delay += 0.012  # 收尾慢
                    time.sleep(delay)
                time.sleep(0.15)
                page.mouse.up()
                result["ok"] = True
                result["drag"] = {"dx": dx, "dy": dy}
            elif action == "eval":
                # 页面内执行 JS(返回须可 JSON 序列化)。selector 可选:指定 frame url/name 子串定位目标 iframe。
                js = value or ""
                target_frame = page.main_frame
                if selector:
                    for fr in page.frames:
                        if selector in (fr.url or "") or selector in (fr.name or ""):
                            target_frame = fr
                            break
                result["eval"] = target_frame.evaluate(js)
                result["ok"] = True
            else:
                result["error"] = f"未知 action: {action}(合法集 {_INTERACT_ACTIONS})"
        except Exception as e:  # noqa: BLE001 —— 交互失败原样回传调用方,不打断扫码线程
            result["error"] = f"{type(e).__name__}: {str(e)[:260]}"
        with task._lock:
            task._interact_results[rid] = result


def list_live_scan_tasks() -> list[dict[str, Any]]:
    """列本实例的进行中任务(供操作端定位 task_id;不含页面句柄)。"""
    items: list[dict[str, Any]] = []
    for tid, t in list(_TASK_STORE._local.items()):
        if not t.is_terminal():
            items.append(
                {
                    "task_id": tid,
                    "platform": t.platform,
                    "status": t.status,
                    "message": t.message,
                    "created_at": t.created_at,
                }
            )
    return items


def request_interaction(
    task_id: str,
    action: str,
    selector: str | None = None,
    value: str | None = None,
    wait_seconds: float = 12.0,
) -> dict[str, Any]:
    """向本实例的活任务投递一次页面交互并等结果。

    页面句柄不可序列化也不可跨实例,故只认本地 dict 里的任务;Redis 快照里的
    远端实例任务在此直接报"不在本实例"。
    """
    task = _TASK_STORE._local.get(task_id)
    if task is None:
        return {"ok": False, "error": "任务不在本实例(页面句柄仅实例内可用)"}
    if task.is_terminal():
        return {"ok": False, "error": f"任务已终态: {task.status}"}
    if task._page is None:
        return {"ok": False, "error": "页面句柄未就绪(任务尚未打开页面)"}
    if action not in _INTERACT_ACTIONS:
        return {"ok": False, "error": f"未知 action: {action}(合法集 {_INTERACT_ACTIONS})"}
    if task._interact_q is None:
        task._interact_q = queue.Queue()
    rid = uuid.uuid4().hex[:12]
    task._interact_q.put((rid, action, selector, value))
    deadline = time.time() + wait_seconds
    while time.time() < deadline:
        with task._lock:
            result = task._interact_results.get(rid)
        if result is not None:
            return result
        time.sleep(0.2)
    return {"ok": False, "error": "交互超时:任务线程未在窗口内处理(任务可能已退出等待循环)"}


# ---------------------------------------------------------------------------
# 任务存储(Redis 优先,多实例共享;Redis 不可用时降级为进程内 dict)
# P2 修复(2026-08-06): 原 _TASKS 为进程内 dict,多实例部署下轮询打到其它实例会 404
# ---------------------------------------------------------------------------
try:
    import redis as _redis_sync
except ImportError:
    _redis_sync = None  # type: ignore[assignment]

_TERMINAL_STATUSES = ("success", "failed", "timeout", "cancelled", "expired")

_TASK_TTL_SECONDS = 5 * 60  # 完成后保留 5 分钟
_QR_VALIDITY_SECONDS = 5 * 60  # 二维码有效/轮询超时窗口(与线程内 5 分钟超时一致)
_REDIS_KEY_TTL_SECONDS = 10 * 60  # Redis key TTL:覆盖二维码有效期 + 结果保留期


class ScanTaskStore:
    """扫码任务存储。

    - Redis 模式:key=`scan_login:task:{task_id}`,value=任务 JSON(含 base64 截图),TTL=10 分钟。
      任意实例创建的任务,其它实例经同一 Redis 也能查到(解决多实例轮询 404)。
    - 内存模式:Redis 未配置 / 未安装 redis 包 / ping 失败时降级为进程内 dict(与 memory.py 同模式)。
    - 本地 dict 始终保留本实例创建任务的工作副本(含线程句柄/浏览器对象,不可序列化),
      Redis 中仅存可序列化快照。
    """

    KEY_PREFIX = "scan_login:task:"

    def __init__(self) -> None:
        self._local: dict[str, ScanTask] = {}
        self._lock = threading.Lock()
        self._redis: Any = None
        self._use_redis = bool(settings.redis_url) and _redis_sync is not None

    # -- Redis 连接 -------------------------------------------------------
    def _get_redis(self) -> Any:
        """获取同步 Redis 客户端;连接失败时降级为内存模式(与 memory.py 同模式)。"""
        if self._redis is None and self._use_redis:
            try:
                self._redis = _redis_sync.Redis.from_url(
                    settings.redis_url, decode_responses=True,
                    # protocol=2 强制 RESP2:redis-py 8.x 默认 RESP3(HELLO 3 协商),
                    # 老 Redis/Memurai 4.x 不支持会 unknown command HELLO(同 im_bridge)
                    protocol=2,
                    socket_connect_timeout=2,
                )
                self._redis.ping()
                logger.info("[scan_login] Redis 存储已启用")
            except Exception as e:
                logger.warning("[scan_login] Redis 连接失败,降级为内存模式: %s", e, exc_info=True)
                self._use_redis = False
                self._redis = None
        return self._redis

    def _key(self, task_id: str) -> str:
        return f"{self.KEY_PREFIX}{task_id}"

    # -- 本地工作副本(含线程句柄/浏览器对象,不可序列化) ---------------------
    def get_local(self, task_id: str) -> ScanTask | None:
        with self._lock:
            return self._local.get(task_id)

    def put_local(self, task: ScanTask) -> None:
        with self._lock:
            self._local[task.task_id] = task

    def pop_local(self, task_id: str) -> ScanTask | None:
        with self._lock:
            return self._local.pop(task_id, None)


_TASK_STORE = ScanTaskStore()


def _task_to_dict(task: ScanTask) -> dict[str, Any]:
    """把任务序列化为 JSON 可存储字典(不包含线程/浏览器等不可序列化字段)。"""
    return {
        "task_id": task.task_id,
        "user_id": task.user_id,
        "platform": task.platform,
        "status": task.status,
        "message": task.message,
        "stage": task.stage,
        "qr_image_b64": task.qr_image_b64,
        "qr_image_updated_at": task.qr_image_updated_at,
        "cookies": dict(task.cookies),
        "all_relevant_cookies": dict(task.all_relevant_cookies),
        "account_id": task.account_id,
        "created_at": task.created_at,
        "completed_at": task.completed_at,
    }


def _task_from_dict(data: dict[str, Any]) -> ScanTask:
    """从 Redis JSON 恢复只读任务副本(无线程句柄,仅用于查询/状态展示)。"""
    return ScanTask(
        task_id=str(data.get("task_id", "")),
        user_id=str(data.get("user_id", "")),
        platform=str(data.get("platform", "")),
        status=str(data.get("status", "pending")),
        message=str(data.get("message", "")),
        stage=str(data.get("stage", "booting") or "booting"),
        qr_image_b64=str(data.get("qr_image_b64", "")),
        qr_image_updated_at=float(data.get("qr_image_updated_at", 0.0) or 0.0),
        cookies=dict(data.get("cookies") or {}),
        all_relevant_cookies=dict(data.get("all_relevant_cookies") or {}),
        account_id=data.get("account_id"),
        created_at=float(data.get("created_at", time.time()) or time.time()),
        completed_at=data.get("completed_at"),
    )


def _persist_task(task: ScanTask) -> bool:
    """把任务快照写入 Redis(带 TTL)。Redis 不可用时静默返回 False,降级内存。"""
    redis = _TASK_STORE._get_redis()
    if not redis:
        return False
    try:
        redis.set(
            _TASK_STORE._key(task.task_id),
            json.dumps(_task_to_dict(task), ensure_ascii=False),
            ex=_REDIS_KEY_TTL_SECONDS,
        )
        return True
    except Exception as e:
        logger.warning("[scan_login] 任务持久化失败,降级为内存模式: %s", e, exc_info=True)
        _TASK_STORE._use_redis = False
        _TASK_STORE._redis = None
        return False


def _cleanup_expired_tasks() -> None:
    """清理超时的已完成任务(> 5 分钟)。内存模式手动遍历;Redis 模式靠 TTL + 兜底扫描。"""
    now = time.time()
    # 本地工作副本:只清理本实例已终态且超保留期的任务(不误删运行中线程的任务)
    expired: list[str] = []
    with _TASK_STORE._lock:
        for tid, task in list(_TASK_STORE._local.items()):
            if task.is_terminal() and task.completed_at and now - task.completed_at > _TASK_TTL_SECONDS:
                expired.append(tid)
        for tid in expired:
            _TASK_STORE._local.pop(tid, None)
            logger.info(f"[scan_login] 清理过期任务 {tid}")

    # Redis 模式:P2 修复(2026-08-06) 兜底扫描 `scan_login:task:*`,删除超保留期的终态 key
    # (正常情况下 TTL 会自动过期,这里防 TTL 未设置的孤儿 key)
    redis = _TASK_STORE._get_redis()
    if redis:
        try:
            keys = redis.keys(f"{_TASK_STORE.KEY_PREFIX}*")
            for k in keys:
                raw = redis.get(k)
                if not raw:
                    continue
                try:
                    data = json.loads(raw)
                except Exception:
                    continue
                if (
                    data.get("status") in _TERMINAL_STATUSES
                    and data.get("completed_at")
                    and now - float(data["completed_at"]) > _TASK_TTL_SECONDS
                ):
                    redis.delete(k)
                    logger.info(f"[scan_login] 清理 Redis 过期任务 {k}")
        except Exception as e:
            logger.warning("[scan_login] Redis 清理任务失败: %s", e, exc_info=True)


def get_task(task_id: str) -> ScanTask | None:
    """按 task_id 查询任务:优先本地工作副本,本地无则读 Redis(支持跨实例轮询)。"""
    # 本地工作副本(含线程句柄)优先
    task = _TASK_STORE.get_local(task_id)
    if task is None:
        # 跨实例:从 Redis 读取只读副本
        redis = _TASK_STORE._get_redis()
        if redis:
            try:
                raw = redis.get(_TASK_STORE._key(task_id))
            except Exception as e:
                logger.warning("[scan_login] 读取 Redis 任务失败: %s", e, exc_info=True)
                raw = None
            if raw:
                try:
                    task = _task_from_dict(json.loads(raw))
                except Exception as e:
                    logger.warning("[scan_login] 反序列化任务失败: %s", e, exc_info=True)
                    task = None
        if task is None:
            return None

    # P2 修复(2026-08-06): 超过二维码有效期且未到终态 → 一次性标记 expired,前端轮询得到明确过期状态
    if not task.is_terminal() and task.completed_at is None and time.time() - task.created_at > _QR_VALIDITY_SECONDS:
        task.status = "expired"
        task.message = "二维码已过期,请重新发起扫码登录"
        task.completed_at = time.time()
        _persist_task(task)
    return task


def list_tasks(user_id: str | None = None) -> list[ScanTask]:
    """列出任务。Redis 模式扫描 `scan_login:task:*` 前缀;内存模式遍历本地 dict。"""
    redis = _TASK_STORE._get_redis()
    if redis:
        tasks: list[ScanTask] = []
        try:
            keys = redis.keys(f"{_TASK_STORE.KEY_PREFIX}*")
            for k in keys:
                raw = redis.get(k)
                if not raw:
                    continue
                try:
                    tasks.append(_task_from_dict(json.loads(raw)))
                except Exception:
                    continue
        except Exception as e:
            logger.warning("[scan_login] 列出 Redis 任务失败: %s", e, exc_info=True)
            return []
        if user_id:
            tasks = [t for t in tasks if t.user_id == user_id]
        return tasks
    with _TASK_STORE._lock:
        tasks = list(_TASK_STORE._local.values())
    if user_id:
        tasks = [t for t in tasks if t.user_id == user_id]
    return tasks


def create_task(user_id: str, platform: str) -> ScanTask:
    """创建任务:写入本地工作副本 + Redis(带 TTL)。"""
    if platform not in PLATFORM_SCAN_CONFIG:
        raise ValueError(f"不支持的平台: {platform},可用: {list(PLATFORM_SCAN_CONFIG.keys())}")
    task = ScanTask(
        task_id=str(uuid.uuid4()),
        user_id=user_id,
        platform=platform,
    )
    _TASK_STORE.put_local(task)
    _persist_task(task)
    return task


def remove_task(task_id: str) -> None:
    """删除任务:本地 + Redis 同时清理,并触发线程停止。"""
    task = _TASK_STORE.pop_local(task_id)
    redis = _TASK_STORE._get_redis()
    if redis:
        try:
            redis.delete(_TASK_STORE._key(task_id))
        except Exception as e:
            logger.warning("[scan_login] 删除 Redis 任务失败: %s", e, exc_info=True)
    if task:
        task._stop_event.set()


# ---------------------------------------------------------------------------
# Chromium 可执行文件查找(2026-07-30 立,解决 PLAYWRIGHT_BROWSERS_PATH 指向 D 盘但浏览器在 C 盘的问题)
# ---------------------------------------------------------------------------
def _find_chromium_executable() -> str | None:
    """查找可用的 Chromium 可执行文件路径。

    优先级:
    1. PLAYWRIGHT_BROWSERS_PATH 环境变量指向的路径(D 盘)
    2. Windows 默认路径(C:\\Users\\<user>\\AppData\\Local\\ms-playwright)
    3. 返回 None(让 Playwright 自己解析)
    """
    from pathlib import Path

    # 1. 检查环境变量指定的路径
    env_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if env_path:
        # chromium (完整版,支持 headless + headed)
        candidate = Path(env_path) / "chromium-1228" / "chrome-win64" / "chrome.exe"
        if candidate.exists():
            return str(candidate)
        # headless shell
        candidate = (
            Path(env_path)
            / "chromium_headless_shell-1228"
            / "chrome-headless-shell-win64"
            / "chrome-headless-shell.exe"
        )
        if candidate.exists():
            return str(candidate)

    # 2. 检查 Windows 默认路径
    home = Path.home()
    candidate = home / "AppData" / "Local" / "ms-playwright" / "chromium-1228" / "chrome-win64" / "chrome.exe"
    if candidate.exists():
        return str(candidate)

    # 3. 让 Playwright 自己找
    return None


# ---------------------------------------------------------------------------
# 头条·微信扫码通道(2026-09-29 新增:纯 HTTP 全链路,不起浏览器)
# ---------------------------------------------------------------------------
_TOUTIAO_WX_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
# wap_login 是头条 SSO 的服务端微信 OAuth 入口:302 直出 open.weixin.qq.com/
# connect/qrconnect(内含**每次请求都新鲜的 state**,同时 Set-Cookie
# passport_csrf_token_wap_state)。state 无会话绑定校验(fake code 探针实证)。
_TOUTIAO_WAP_LOGIN_URL = (
    "https://www.toutiao.com/passport/auth/wap_login/?aid=24&type=sso"
    "&use_local_host=undefined&scopes=user_info"
    "&next=https%3A%2F%2Fsso.toutiao.com%2Fauth%2Flogin_success%2F"
    "%3Fservice%3Dhttps%253A%252F%252Fwww.toutiao.com%252F"
    "&url_params=&platform_app_id=43&platform="
)
_TOUTIAO_WX_QR_URL = "https://open.weixin.qq.com/connect/qrcode/{uuid}"
_TOUTIAO_WX_LONGPOLL_URL = "https://long.open.weixin.qq.com/connect/l/qrconnect"
_TOUTIAO_WX_CALLBACK_URL = "https://api.snssdk.com/auth/login_success"
# 长轮询 errcode:408 等待扫码 / 404 已扫码待确认 / 405 已确认(wx_code 就绪)
# / 402 码过期 / 403 用户手机端拒绝。
_TOUTIAO_WX_POLL_TIMEOUT = 15.0  # 服务端长轮询 ~25s 才放行,客户端 15s 主动断开
                                  # 重连(uuid 不变),保证取消/超时检查延迟 ≤15s。
# 2026-09-29 根治"qrconnect 页面未找到 uuid"抖动:该失败是瞬时风控/降级页类故障
# (同环境 8/8 轮探针全成功,坏变体无法稳定复现),故出码链路做成自愈式 ——
# 手动跟进重定向(主 client 是 follow_redirects=False,3xx 空响应体必致提取失败)、
# 三策略提取 uuid、整链(wap_login→qrconnect→下载码)带新鲜 state 重试、失败落指纹。
_TOUTIAO_WX_MAX_QR_ATTEMPTS = 3
_TOUTIAO_WX_RETRY_DELAYS = (1.0, 2.0)  # 长度 = MAX_QR_ATTEMPTS - 1


def _wx_extract_uuid(html: str) -> str:
    """qrconnect 页面 uuid 提取:三策略兜底,任一命中即返回,全空返回 ''。

    1) fordevtool 属性(常规页);
    2) /connect/qrcode/{uuid} 图 URL(img src 或 JS 模板);
    3) 任意 uuid= 查询参数(长轮询/确认页 URL 片段)。
    """
    for pat in (
        re.compile(r'fordevtool\s*=\s*"[^"]*uuid=([0-9A-Za-z]+)"'),
        re.compile(r"connect/qrcode/([0-9A-Za-z]{10,})"),
        re.compile(r"[?&;]uuid=([0-9A-Za-z]{10,})"),
    ):
        m = pat.search(html)
        if m:
            return m.group(1)
    return ""


def _wx_resp_fingerprint(resp: Any) -> str:
    """响应指纹(状态/类型/长度/重定向目标/正文头),提取失败时落日志可归因。"""
    headers = getattr(resp, "headers", {})
    text = getattr(resp, "text", "") or ""
    ctype = (headers.get("content-type") or "")[:40]
    snippet = re.sub(r"\s+", " ", text[:200]).strip()
    return (
        f"status={getattr(resp, 'status_code', '?')} ctype={ctype} len={len(text)} "
        f"loc={headers.get('location', '-')[:80]} head={snippet[:140]!r}"
    )


def _wx_absolute_url(base: str, loc: str) -> str:
    """Location → 绝对 URL(httpx 关闭自动重定向后需手动拼接)。"""
    if loc.startswith(("http://", "https://")):
        return loc
    if loc.startswith("//"):
        scheme = base.split("://", 1)[0]
        return f"{scheme}:{loc}"
    if loc.startswith("/"):
        m = re.match(r"[a-z]+://[^/]+", base)
        return f"{m.group(0)}{loc}" if m else loc
    return loc


def _wx_get_following_redirects(client: Any, url: str, max_hops: int = 5) -> Any:
    """GET 并手动跟进重定向(≤max_hops)。主 client 保持 follow_redirects=False
    是为了 wap_login 那一发能抓到 302 Location;qrconnect/图 URL 则必须跟进到底,
    否则拿到 3xx 空响应体,uuid 提取必失败 —— 这正是"未找到 uuid"抖动的成因之一。"""
    r = client.get(url)
    for _ in range(max_hops):
        if r.status_code not in (301, 302, 303, 307, 308):
            return r
        loc = r.headers.get("location", "")
        if not loc:
            return r
        r = client.get(_wx_absolute_url(str(getattr(r, "url", url)), loc))
    return r


def _toutiao_wx_fetch_new_qr_once(client: Any, task: Any) -> tuple[str, str]:
    """单次出码尝试:wap_login → qrconnect → 微信官方码写入任务。

    返回 (state, uuid);任一环节失败抛 RuntimeError(带该环节指纹)。
    """
    r = client.get(_TOUTIAO_WAP_LOGIN_URL)
    loc = r.headers.get("location", "")
    if r.status_code not in (301, 302, 303, 307, 308) or "qrconnect" not in loc:
        raise RuntimeError(f"wap_login 未重定向到 qrconnect({_wx_resp_fingerprint(r)})")
    m = re.search(r"[?&]state=([^&#]+)", loc)
    if not m:
        raise RuntimeError(f"qrconnect URL 缺少 state({_wx_resp_fingerprint(r)})")
    state = m.group(1)
    r2 = _wx_get_following_redirects(client, loc)
    qr_uuid = _wx_extract_uuid(r2.text)
    if not qr_uuid:
        raise RuntimeError(f"qrconnect 页面未找到 uuid(三策略落空;{_wx_resp_fingerprint(r2)})")
    r3 = client.get(_TOUTIAO_WX_QR_URL.format(uuid=qr_uuid))
    ctype = (r3.headers.get("content-type") or "").lower()
    if r3.status_code != 200 or "image" not in ctype:
        raise RuntimeError(f"微信码下载失败(status={r3.status_code}, ctype={ctype})")
    with task._lock:
        task.qr_image_b64 = base64.b64encode(r3.content).decode("ascii")
        task.qr_image_updated_at = time.time()
    _persist_task(task)
    return state, qr_uuid


def _toutiao_wx_fetch_new_qr(client: Any, task: Any) -> tuple[str, str]:
    """自愈式出码:整链重试 ≤3 次,每次 wap_login 重发 = 全新 state(与单发语义一致)。

    任次成功即返回;全败抛 RuntimeError(附最后一次指纹),调用方按原样判失败。
    """
    last_detail = ""
    for attempt in range(1, _TOUTIAO_WX_MAX_QR_ATTEMPTS + 1):
        try:
            return _toutiao_wx_fetch_new_qr_once(client, task)
        except RuntimeError as e:
            last_detail = str(e)
            logger.warning(
                f"[scan_login] 任务 {task.task_id} 微信出码第 {attempt}/"
                f"{_TOUTIAO_WX_MAX_QR_ATTEMPTS} 次失败: {last_detail}"
            )
            if attempt < _TOUTIAO_WX_MAX_QR_ATTEMPTS:
                time.sleep(_TOUTIAO_WX_RETRY_DELAYS[attempt - 1])
    raise RuntimeError(f"微信出码连续 {_TOUTIAO_WX_MAX_QR_ATTEMPTS} 次失败;最后指纹: {last_detail}")


def _run_toutiao_wechat_flow(task: ScanTask) -> None:
    """头条微信扫码:wap_login→qrconnect→微信官方码→长轮询→callback 链 cookie 落袋。"""
    config = PLATFORM_SCAN_CONFIG[task.platform]
    logger.info(f"[scan_login] 任务 {task.task_id} 启动(头条微信 HTTP 通道)")
    try:
        import httpx
    except ImportError as e:
        task.status = "failed"
        task.message = f"httpx 未安装:{e}"
        task.completed_at = time.time()
        _persist_task(task)
        return

    task.status = "waiting_scan"
    task.message = "正在获取微信登录二维码..."
    _persist_task(task)

    try:
        with httpx.Client(
            headers={"User-Agent": _TOUTIAO_WX_UA, "Referer": "https://www.toutiao.com/"},
            timeout=30.0,
            follow_redirects=False,
        ) as client:
            state, qr_uuid = _toutiao_wx_fetch_new_qr(client, task)
            task.message = "请用微信扫描二维码登录今日头条"
            _persist_task(task)

            timeout_seconds = 5 * 60
            start_time = time.time()
            while not task._stop_event.is_set():
                # 跨实例取消/过期检测(与通用 Playwright 流同机制)
                _redis = _TASK_STORE._get_redis()
                if _redis:
                    try:
                        _raw = _redis.get(_TASK_STORE._key(task.task_id))
                        if _raw:
                            _remote = json.loads(_raw)
                            _rs = _remote.get("status")
                            if _rs in ("cancelled", "expired"):
                                task.status = _rs
                                task.message = _remote.get("message", "") or (
                                    "用户取消" if _rs == "cancelled"
                                    else "二维码已过期,请重新发起扫码登录"
                                )
                                task.completed_at = time.time()
                                break
                    except Exception:
                        pass

                if time.time() - start_time > timeout_seconds:
                    task.status = "timeout"
                    task.message = f"等待超时(> {timeout_seconds}s)"
                    task.completed_at = time.time()
                    _persist_task(task)
                    break

                # 长轮询微信扫码状态(阻塞 ≤15s)
                try:
                    resp = client.get(
                        _TOUTIAO_WX_LONGPOLL_URL,
                        params={"uuid": qr_uuid},
                        timeout=_TOUTIAO_WX_POLL_TIMEOUT,
                    )
                except Exception:
                    continue  # 客户端超时/网络抖动:uuid 不变直接重连
                err_m = re.search(r"wx_errcode=(\d+)", resp.text)
                code_m = re.search(r"wx_code='([^']*)'", resp.text)
                errcode = err_m.group(1) if err_m else ""
                wx_code = code_m.group(1) if code_m else ""

                if errcode == "405" and wx_code:
                    # 已确认 → 头条 callback 302 链,cookie 全程落同一 jar
                    task.message = "微信已确认,正在获取头条登录状态..."
                    _persist_task(task)
                    cb = client.get(
                        _TOUTIAO_WX_CALLBACK_URL,
                        params={"code": wx_code, "state": state},
                        follow_redirects=True,
                    )
                    cookies_dict: dict[str, str] = {}
                    raw_cookies: list[dict[str, str]] = []
                    for c in client.cookies.jar:
                        dom = c.domain or ""
                        if not c.name or not c.value:
                            continue
                        if "toutiao" not in dom and "snssdk" not in dom:
                            continue
                        cookies_dict[c.name] = c.value
                        raw_cookies.append(
                            {"name": c.name, "value": c.value, "domain": dom, "path": c.path or "/"}
                        )
                    matched = _cookie_hits(config, cookies_dict)
                    if matched:
                        task.cookies = {k: cookies_dict[k] for k in matched}
                        task.all_relevant_cookies = _collect_platform_relevant(
                            _account_platform_of(task.platform), cookies_dict, raw_cookies, config
                        )
                        task.status = "success"
                        task.message = f"登录成功,获取到 {len(task.all_relevant_cookies)} 个 cookies"
                        task.completed_at = time.time()
                        _schedule_account_save(task)
                        _persist_task(task)
                        logger.info(f"[scan_login] 任务 {task.task_id} 微信扫码成功: {matched}")
                        break
                    # 回跳完成但没拿到登录 cookie(微信未绑定头条账号/风控拦截)
                    final_url = str(cb.url)
                    if "need_bind_mobile" in final_url:
                        # 2026-09-29 真机实证:头条 callback 302 到
                        # wap_bind_mobile_index?auth_err=2001:need_bind_mobile(带 profile_key)。
                        # 注意口径:这是"该微信在头条**网页端**首次登录"的强制手机号验证,
                        # 与 App 内是否绑定过微信无关(App 绑定走移动端 openid,网页扫码是
                        # 网页应用 openid,头条不据此放行)——App 已绑微信的用户也会命中。
                        task.status = "failed"
                        task.message = (
                            "头条要求该微信先完成一次网页端手机号验证(与 App 内是否绑定微信无关:"
                            "App 绑定的是移动端身份,网页扫码是网页端身份,头条不互通)。"
                            "推荐改选「今日头条(App扫码)」通道,用头条 App 扫码即全自动登录;"
                            "另请确认扫码的微信就是 App 内绑定的那个微信"
                        )
                        task.completed_at = time.time()
                        _persist_task(task)
                        logger.warning(f"[scan_login] 任务 {task.task_id} 头条要求先绑手机号(need_bind_mobile)")
                        break
                    err_hint = final_url.split("error=")[-1].split("&")[0][:80] if "error=" in final_url else ""
                    task.status = "failed"
                    task.message = "微信确认完成但未获取到头条登录 cookie" + (f"(error:{err_hint})" if err_hint else "")
                    task.completed_at = time.time()
                    _persist_task(task)
                    logger.warning(f"[scan_login] 任务 {task.task_id} callback 未命中: final={final_url[:200]}")
                    break

                if errcode == "404":
                    if task.status != "scanned":
                        task.status = "scanned"
                        task.message = "已扫码,请在手机上确认登录"
                        _persist_task(task)
                    continue

                if errcode in ("402", "403"):
                    # 码过期 / 用户手机端拒绝:重走一遍出全新码(与旧截图流"刷新"等价)
                    logger.info(f"[scan_login] 任务 {task.task_id} 微信码 errcode={errcode},刷新重出")
                    state, qr_uuid = _toutiao_wx_fetch_new_qr(client, task)
                    task.status = "waiting_scan"
                    task.message = "二维码已刷新,请重新扫码"
                    _persist_task(task)
                    continue
                # 408 / 其它:继续等

    except Exception as e:
        logger.exception(f"[scan_login] 任务 {task.task_id} 微信通道异常")
        if not task.is_terminal():
            task.status = "failed"
            task.message = f"微信扫码异常:{type(e).__name__}: {str(e)[:200]}"
            task.completed_at = time.time()
            _persist_task(task)


# 连接类故障指纹(2026-09-30):站点宕机 / DNS 失败 / 地址不可达 / 断网 / 超时。
_NET_UNREACHABLE_RE = re.compile(
    r"ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_ADDRESS_UNREACHABLE"
    r"|ERR_INTERNET_DISCONNECTED|ERR_TIMED_OUT|TimeoutError"
)


def _login_page_open_failure_message(exc: BaseException) -> str:
    """把"打不开登录页"的异常转成用户可读文案。

    立因(2026-09-30 用户要求):人民网登录域对本机网络完全不可达(站点级故障),
    而界面把 `Page.goto: net::ERR_CONNECTION_CLOSED ...` 原样抛给用户 —— 用户
    无从分辨"平台坏了"和"我们坏了",只能来报"程序不好使"。这一类必须明说
    平台侧问题。oschina 旧登录路径废弃 + WAF 挂起到超时同属这一族。
    非连接类(选择器/脚本/渲染异常)保留类型名与原文 —— 那才是我们该修的,
    把它也糊成"平台故障"就是替自己的缺陷遮责。
    """
    raw = f"{type(exc).__name__}: {str(exc)[:200]}"
    if _NET_UNREACHABLE_RE.search(raw):
        return (
            "该平台登录页当前无法访问(平台侧故障或网络受限),非本系统问题,"
            "请稍后重试;若持续不可用请到该平台官网确认登录入口是否变更。"
        )
    return f"打开登录页失败:{raw}"


# ---------------------------------------------------------------------------
# 后台扫码登录任务
# ---------------------------------------------------------------------------
def _run_scan_task(task: ScanTask) -> None:
    """在后台线程中执行扫码登录流程。"""
    config = PLATFORM_SCAN_CONFIG[task.platform]
    # 2026-09-29:配置了 http_flow 的平台走纯 HTTP 专用通道(不起浏览器),
    # 目前仅 toutiao_wechat 一种。
    if config.get("http_flow") == "toutiao_wechat":
        return _run_toutiao_wechat_flow(task)
    logger.info(f"[scan_login] 任务 {task.task_id} 启动: platform={task.platform}, user_id={task.user_id}")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        task.status = "failed"
        task.message = f"Playwright 未安装:{e}"
        task.completed_at = time.time()
        logger.error(f"[scan_login] Playwright 缺失:{e}")
        _persist_task(task)  # P2 修复(2026-08-06): 终态同步到 Redis
        return

    try:
        with sync_playwright() as p:
            # 启动浏览器(2026-07-30:指定 executable_path 解决 PLAYWRIGHT_BROWSERS_PATH 指向 D 盘但浏览器在 C 盘的问题)
            chromium_path = _find_chromium_executable()
            logger.info(f"[scan_login] Chromium 路径: {chromium_path or '(Playwright 默认)'}")
            browser = p.chromium.launch(
                executable_path=chromium_path,  # None 时 Playwright 用默认解析
                headless=True,  # 后端 headless,前端通过截图看
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-blink-features=AutomationControlled",  # 反检测
                ],
            )
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            task._context = context

            page = context.new_page()
            task._page = page

            # 2026-09-30 网络层码图捕获(qr_capture 平台):监听页面自己的码接口响应,
            # 存 task._net_captured。知乎的码 canvas 画入跨域图被污染无法直接提取,
            # 但其 token 接口响应里有 link 字段 —— 用页面同一 token 重绘码,
            # 扫码后页面轮询能感知登录,success_cookies 检测链路不受影响。
            capture_cfg = config.get("qr_capture")
            if capture_cfg:

                def _on_response(resp: Any, _cfg: dict[str, Any] = capture_cfg) -> None:
                    try:
                        if _cfg["url_substring"] in resp.url:
                            data = resp.json()
                            for key_path in _cfg.get("field_paths", []):
                                node: Any = data
                                for part in key_path.split("."):
                                    if not isinstance(node, dict):
                                        node = None
                                        break
                                    node = node.get(part)
                                if node:
                                    with task._lock:
                                        task._net_captured[_cfg["store_key"]] = str(node)
                                    return
                    except Exception:  # noqa: BLE001 — 非 JSON/已消费响应忽略
                        pass

                page.on("response", _on_response)

            # 1. 打开登录页
            task.status = "waiting_scan"
            task.stage = "opening"
            task.message = f"正在打开 {config['name']} 登录页..."
            logger.info(f"[scan_login] 打开 {config['login_url']}")
            _persist_task(task)  # P2 修复(2026-08-06): 状态变更同步到 Redis
            try:
                page.goto(config["login_url"], wait_until="domcontentloaded", timeout=30000)
            except Exception as e:
                task.status = "failed"
                task.message = _login_page_open_failure_message(e)
                task.completed_at = time.time()
                _persist_task(task)  # P2 修复(2026-08-06): 终态同步到 Redis
                return

            page.wait_for_timeout(3000)

            # 2. 尝试切换到扫码登录 tab(2026-09-29:平台可用 scan_tab_selectors 前置
            #    自己的入口;每项可以是选择器串,也可以是"顺序点击计划"(元组/列表:
            #    逐步有则点、无则跳,如企鹅号 点 QQ登录 tab → 点协议层"同意",
            #    搜狐号 点"登录"弹层 → 点"其他方式"微信圆标)。通用文案清单作兜底。
            #    点击跨页兜底:sohu 登录层极少数情况开新窗,主页找不到就到上下文
            #    其它页(新→旧)找同选择器点掉。
            # 2026-09-30 提速:计划的第一项就是"登录入口"选择器,先等它渲染出来再点,
            # 点完立刻等码渲染 —— 省掉原本雷打不动的 3s(点击前)+ 1.5s(点击后)。
            scan_plans: list[Any] = [
                *config.get("scan_tab_selectors", ()),
                'text=扫码登录',
                'text=二维码登录',
                'text=手机扫码登录',
                'text=微信扫码',
                'text=App 扫码',
                'a:has-text("扫码")',
                'a:has-text("二维码")',
                'div:has-text("扫码")',
                'div:has-text("二维码")',
                '[class*="scan"]',
                '[class*="qrcode-tab"]',
            ]
            _first_plan = scan_plans[0] if scan_plans else None
            _is_configured_entry = bool(config.get("scan_tab_selectors"))
            _entry_sels = (
                tuple(str(s) for s in _first_plan)
                if isinstance(_first_plan, (list, tuple))
                else ((str(_first_plan),) if _first_plan else ())
            )
            if _is_configured_entry and _entry_sels:
                _entry_ready = _wait_for_page_ready(
                    page, _entry_sels, timeout_s=4.0, probe=_entry_probe
                )
                if _entry_ready:
                    logger.info(f"[scan_login] 扫码入口已就绪(快路径): {_entry_sels}")
                else:
                    # 入口没在 4s 内出现:可能本来就是默认停在扫码 tab 的页面,或多步计划
                    # 的第一步不是独立可见元素 —— 保留一小段等待兜底。旧值是固定 3s,
                    # 这里更短,是因为上面那条"能快就快"的路已经走完了。
                    page.wait_for_timeout(1200)
            else:
                # 该平台没配点名入口:只能按通用文案清单去点,保留一小段等待兜底。
                page.wait_for_timeout(1200)
            _qr_wait_sels = _qr_ready_selectors(config)
            task.stage = "switching"
            task.message = f"正在切换到 {config['name']} 扫码…"
            _persist_task(task)
            for plan in scan_plans:
                steps = list(plan) if isinstance(plan, (list, tuple)) else [plan]
                clicked_any = False
                for sel in steps:
                    if _click_selector_anywhere(context, sel):
                        clicked_any = True
                        # 2026-09-30 提速:点完不再固定等 1.5s,直接等"码渲染出来";
                        # 等不到就等满这段上限继续走(与旧行为一致,不会把页面判死)。
                        if _wait_for_page_ready(page, _qr_wait_sels, timeout_s=1.5):
                            break
                if clicked_any:
                    logger.info(f"[scan_login] 切换扫码: {steps}")
                    break

            # 3. 截图初始登录页(含二维码)
            # 2026-09-30 提速:码没渲染出来先等到渲染(上限 2s = 旧固定值,命中即走)。
            # 等不到也不影响出码 —— _update_qr_screenshot 自己会按"提取原图 → 码容器截图
            # → 定位裁剪 → 整屏"四级兜底,与旧实现同一出口。
            _wait_for_page_ready(page, _qr_wait_sels, timeout_s=2.0)
            _update_qr_screenshot(task, page)

            task.message = f"请用 {config['name']} App 扫描二维码"
            logger.info(f"[scan_login] 任务 {task.task_id} 进入等待扫码状态")
            _persist_task(task)  # P2 修复(2026-08-06): 状态变更同步到 Redis

            # 4. 轮询检测登录成功
            # 2026-09-30:5→10 分钟。多步验证(扫码后短信码往来)需要余量,5 分钟
            # 实测不够人在环上往返;二维码自身 2 分钟过期与此窗口独立。
            timeout_seconds = 10 * 60
            start_time = time.time()
            # 2026-09-30 提速:旧值 0.0 配合"每 2 秒才更新一次"的节流,会让**刚出好的第一
            # 帧**被最多推迟 2 秒才截(循环第一轮就在节流窗口里)。这里改成"允许立刻截",
            # 首帧紧跟出码,后续仍按 2 秒节流 —— 行为不变,只是不再白等。
            last_screenshot_time = start_time - 2.0
            # 见下方"每 2 秒更新一次截图"处:首轮只截图、不做过期刷新判定
            qr_settled = False

            while not task._stop_event.is_set():
                # 2026-09-30 任务交互:短信验证码等多步验证由 API 端点投递,此处消费。
                # 必须在任务线程内执行 —— sync Playwright 非线程安全。
                _drain_interactions(task, page)
                # P2 修复(2026-08-06): 检测其它实例的状态变更(取消/过期),
                # 避免本线程在跨实例取消后继续运行并覆盖终态
                _redis = _TASK_STORE._get_redis()
                if _redis:
                    try:
                        _raw = _redis.get(_TASK_STORE._key(task.task_id))
                        if _raw:
                            _remote = json.loads(_raw)
                            _rs = _remote.get("status")
                            if _rs in ("cancelled", "expired"):
                                task.status = _rs
                                task.message = _remote.get("message", "") or (
                                    "用户取消" if _rs == "cancelled"
                                    else "二维码已过期,请重新发起扫码登录"
                                )
                                task.completed_at = time.time()
                                logger.info(f"[scan_login] 任务 {task.task_id} 检测到远端终态: {_rs}")
                                break
                    except Exception:
                        pass

                if time.time() - start_time > timeout_seconds:
                    task.status = "timeout"
                    task.message = f"等待超时(> {timeout_seconds}s)"
                    task.completed_at = time.time()
                    logger.warning(f"[scan_login] 任务 {task.task_id} 超时")
                    _persist_task(task)  # P2 修复(2026-08-06): 终态同步到 Redis
                    break

                # 每 2 秒更新一次截图
                if time.time() - last_screenshot_time >= 2.0:
                    # 2026-09-30 提速:第一轮只截图、不做"过期刷新"判定。实测(头条 App 码)
                    # 码区刚进 DOM 时会先挂上 `qrcode-tip` 提示类,此时码并没渲染 ——
                    # 判定这时候跑会**误报过期**,点一次刷新再多等 2s,而这一轮本来就是
                    # 用户等得最久的那一眼。判定从第二轮起照旧。
                    if qr_settled:
                        # 2026-09-29:二维码有有效期(头条 ~140s 实测),过期后码区变
                        # "点击刷新"提示图,弹窗里的截图用户根本没法扫(用户实际踩坑,
                        # 首次扫码失败即此因——码本身是真的,只是过期没人刷)。
                        # 平台可配 qr_refresh_selectors,项为二选一:
                        #   字符串 sel            → 检测+点击同一元素
                        #   (detect_sel, click_sel) → 检测 A(如过期提示覆盖层)、点击 B(刷新按钮,
                        #     可能常驻可见,绝不能凭"可见"就点,必须由 detect 态守门)
                        # 探测轻量(is_visible 立即返回);click 用 JS click 绕弹层 mask
                        # (头条 ttp-modal-mask 会拦普通 click 的 actionability)。
                        _refresh_hit = False
                        for _item in config.get("qr_refresh_selectors", ()):
                            _det, _clk = (
                                _item if isinstance(_item, (tuple, list)) else (_item, _item)
                            )
                            try:
                                _el = page.locator(_det).first
                                if not _el.is_visible():
                                    continue
                                try:
                                    page.evaluate(
                                        "s => document.querySelector(s)?.click()", _clk
                                    )
                                except Exception:
                                    page.locator(_clk).first.click(timeout=2000, force=True)
                                _refresh_hit = True
                                break
                            except Exception:
                                continue
                        if _refresh_hit:
                            logger.info(
                                f"[scan_login] 任务 {task.task_id} 检测到二维码过期,已点击刷新出新码"
                            )
                            # 点完不再固定等 2s:等码重新渲染出来就走(等不到才等满)。
                            if not _wait_for_page_ready(page, _qr_wait_sels, timeout_s=2.0):
                                page.wait_for_timeout(500)
                    _update_qr_screenshot(task, page)
                    last_screenshot_time = time.time()
                    qr_settled = True

                # 检查 cookies
                cookies = context.cookies()
                cookies_dict = {c["name"]: c["value"] for c in cookies if c.get("value")}

                # 2026-09-15 终审修复:people 等平台使用框架通用会话 cookie,
                # 主检测必须同时命中登录后 URL,否则登录页一打开就误报
                _require_url_match = bool(config.get("require_url_match"))
                _url_ok = _url_matches_success(config, page.url)

                # 命中目标 cookie?(2026-09-16:改用 _cookie_hits,支持前缀通配)
                _matched = [
                    t for t in _cookie_hits(config, cookies_dict)
                    if _url_ok or not _require_url_match
                ]
                if _matched:
                    logger.info(f"[scan_login] 任务 {task.task_id} 检测到登录 cookie: {_matched[0]}")
                    task.cookies = {k: v for k, v in cookies_dict.items() if k in _matched}
                    # 落库集按平台归属筛(域名优先),不再用 5 项名字黑名单
                    task.all_relevant_cookies = _collect_platform_relevant(
                        _account_platform_of(task.platform), cookies_dict, cookies, config
                    )
                    task.status = "success"
                    task.message = f"登录成功,获取到 {len(task.all_relevant_cookies)} 个 cookies"
                    task.completed_at = time.time()

                    # 截图最终状态
                    _update_qr_screenshot(task, page)

                    # 异步保存到后端账号
                    _schedule_account_save(task)
                    _persist_task(task)  # P2 修复(2026-08-06): 成功终态同步到 Redis

                if task.status == "success":
                    break

                # 检查 URL 跳转(2026-09-15 终审:改用统一的 _url_matches_success 判定)
                current_url = page.url
                if _url_matches_success(config, current_url):
                    # URL 已跳转,可能已登录
                    logger.info(f"[scan_login] 任务 {task.task_id} URL 跳转: {current_url}")
                    # 再检查一次 cookies(可能还没设置;2026-09-16:通配感知,min_len=0)
                    _present = _cookie_hits(config, cookies_dict, min_len=0) if cookies_dict else []
                    if _present:
                        task.cookies = {k: v for k, v in cookies_dict.items() if k in _present}
                        task.all_relevant_cookies = _collect_platform_relevant(
                            _account_platform_of(task.platform), cookies_dict, cookies, config
                        )
                        task.status = "success"
                        task.message = f"登录成功(URL 跳转),获取到 {len(task.all_relevant_cookies)} 个 cookies"
                        task.completed_at = time.time()
                        _update_qr_screenshot(task, page)
                        _schedule_account_save(task)
                        _persist_task(task)  # P2 修复(2026-08-06): 成功终态同步到 Redis
                        break

                page.wait_for_timeout(1500)

            # 清理
            with contextlib.suppress(Exception):
                context.close()
            with contextlib.suppress(Exception):
                browser.close()

    except Exception as e:
        logger.exception(f"[scan_login] 任务 {task.task_id} 异常")
        task.status = "failed"
        task.message = f"扫码登录异常:{type(e).__name__}: {str(e)[:200]}"
        task.completed_at = time.time()
        _persist_task(task)  # P2 修复(2026-08-06): 终态同步到 Redis


def _pick_qr_clip(
    box: dict[str, Any] | None,
    viewport_w: int,
    viewport_h: int,
    *,
    min_side: int = 120,
    pad: int = 16,
) -> dict[str, float] | None:
    """把"二维码元素的盒子"折成可截的 clip 矩形;不合格返回 None(调用方退回整屏)。

    为什么需要它:`page.screenshot(full_page=False)` 截的是**整个登录页**,二维码只占其中
    一小块 —— 2026-09-29 用户实拍知乎那张,二维码在 1024x720 的画面里不足 200px,
    手机对着屏幕扫很难对上,这正是"扫码不好使"里最直觉的那一层。
    判据保守:盒子必须量得到、边长够大、且裁后仍在视口内(越界就收缩而不是外扩)。
    """
    if not box:
        return None
    try:
        x = float(box.get("x", -1))
        y = float(box.get("y", -1))
        w = float(box.get("width", 0))
        h = float(box.get("height", 0))
    except (TypeError, ValueError):
        return None
    if x < 0 or y < 0 or w < min_side or h < min_side:
        return None
    left = max(0.0, x - pad)
    top = max(0.0, y - pad)
    right = min(float(viewport_w), x + w + pad)
    bottom = min(float(viewport_h), y + h + pad)
    cw = right - left
    ch = bottom - top
    if cw < min_side or ch < min_side:
        return None
    return {"x": left, "y": top, "width": cw, "height": ch}


# 二维码元素候选(顺序即优先级:明确的 qrcode 语义容器 > 通用位图载体)。
# 刻意不写"第一个 img":登录页上 logo 也是 img,截了等于给用户一张扫不了的图。
_QR_ELEMENT_SELECTORS: tuple[str, ...] = (
    '[class*="qrcode"] img',
    '[id*="qrcode"] img',
    '[class*="qr-code"] img',
    '[class*="qrcode"] canvas',
    '[class*="qr-code"] canvas',
    '[class*="qrcode"] svg',
    '[class*="qrcode"]',
    '[id*="qrcode"]',
    # 2026-09-29:QQ 企鹅号 om.qq.com 实测 —— ptlogin2 快捷登录二维码是
    # <img id="qrlogin_img" class="qrImg" src="https://xui.ptlogin2.qq.com/ssl/ptqrshow?...">
    # id/class 都不含 "qrcode",src 是 https 非 data:image,必须点名;
    # 且要排在 img[data:image] 之前 —— 腾讯验证码框(captcha.gtimg)里有 300×214 的
    # data:image 滑块底图,跨 frame 找码时若先扫到它会误裁验证码。
    "#qrlogin_img",
    'img[src*="ptqrshow"]',
    'img[src^="data:image"]',
    # 2026-09-29:跨站内嵌的二维码 iframe —— 截图是合成像素,clip 住 iframe 的
    # bounding_box 即可(不需要进 frame 取内部元素)。思否"微信登录"实测把
    # open.weixin.qq.com/connect/qrconnect 嵌进来,主页面选择器全数落空。
    'iframe[src*="qrconnect"]',
    '[class*="qrCode"] iframe',
    "canvas",
)


def _click_selector_anywhere(context: Any, selector: str) -> bool:
    """在浏览器上下文的任一页面里点掉选择器;主页优先,其余页新→旧。

    2026-09-29:搜狐号登录层极少数情况 window.open 新窗 —— 主页定位不到弹层
    元素时,到上下文其它页找同选择器点掉。找不到/点不中返回 False(调用方
    按计划继续,不影响主流程)。
    """
    pages = list(getattr(context, "pages", []) or [])
    ordered = pages[:1] + list(reversed(pages[1:]))
    for pg in ordered:
        try:
            loc = pg.locator(selector).first
            if loc.count() == 0 or not loc.is_visible():
                continue
            loc.click(timeout=2000)
            return True
        except Exception:  # noqa: BLE001 — 单页失败换下一页
            continue
    return False


def _find_qr_clip(pg: Any, vp_w: int, vp_h: int) -> dict[str, float] | None:
    """在一页里找二维码 clip 盒:先主 DOM,再全部嵌套 frame;两遍尺寸门槛。

    2026-09-29 跨 frame:企鹅号 ptlogin2 的码在 xui.ptlogin2.qq.com 嵌套 iframe
    里,主页面 locator 够不着;locator.bounding_box() 返回主视口坐标,可直接喂
    page.screenshot(clip=...)。选择器优先级与主 DOM 一致(#qrlogin_img 等点名
    选择器排在 data:image/canvas 兜底之前,避免误裁腾讯验证码滑块底图)。
    两遍门槛:同一选择器命中的盒子先按 120px 高标准裁,尺寸不足(80~119px)
    就地降档救援,再轮到下一选择器 —— 选择器优先级(置信度)始终压过尺寸。
    背景:ptlogin2 的码实测只有 87×87,不降档就只能整屏,手机不好扫;而
    sohu 首页 60×60 推广码在两档之下仍然会拒。
    """
    sources: list[Any] = [pg.main_frame, *[f for f in getattr(pg, "frames", []) if f is not pg.main_frame]]
    for sel in _QR_ELEMENT_SELECTORS:
        for fr in sources:
            try:
                loc = fr.locator(sel).first
                if loc.count() == 0 or not loc.is_visible():
                    continue
                box = loc.bounding_box()
                # 同源两档:120 高标准 → 80 救援;都不合格(如 60×60 推广码)才换下一源
                clip = _pick_qr_clip(box, vp_w, vp_h, min_side=120)
                if clip is None:
                    clip = _pick_qr_clip(box, vp_w, vp_h, min_side=80)
                if clip is not None:
                    return clip
            except Exception:  # noqa: BLE001 — 单源读不到就试下一个
                continue
    return None


# ---------------------------------------------------------------------------
# 页面就绪就往下走(2026-09-30 提速):把"固定等 N 秒"换成"条件一到立刻走"。
#
# 起因(本机实测,platform=toutiao_app,同一台机器):
#   sync_playwright + launch + new_context + goto 合计 ≈ 1.25s,
#   而固定等待 goto 后 3s + 切 tab 后 1.5s + 截图前 2s = 6.5s ⇒ 首个二维码 7.8s 才可用。
#   即用户等的那 7.8 秒里**八成是空等** —— 页面早就渲染好了,代码还在 sleep。
#
# 判据与固定等待**不等价但更严**(固定等待失败时照样往下走,这里也不会把任务判失败):
#   选择器全部落空 ⇒ 等满 fallback 秒数后返回,后面照样截图,与旧行为逐字一致;
#   任一落空选择器命中有尺寸元素 ⇒ 立刻返回,省掉的是纯等待。
# 为什么不用 page.wait_for_selector:它只认一个选择器、抛异常,而这里要"多个候选里任一"
# 且失败必须静默降级;批量 evaluate 一次往返就把全部候选问完(逐个 is_visible 是 N 次往返,
# 反而把省下的时间又还回去)。
# ---------------------------------------------------------------------------
_QR_READY_PROBE_JS = """(arg) => {
  const min = arg.min;
  for (const sel of arg.sels) {
    let els;
    try { els = document.querySelectorAll(sel); } catch (e) { continue; }
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const w = r.width || el.width || 0;
      const h = r.height || el.height || 0;
      if (w >= min && h >= min) return true;
    }
  }
  for (const c of document.querySelectorAll('canvas')) {
    const ow = c.width || 0;
    const oh = c.height || 0;
    if (Math.min(ow, oh) < min) continue;
    const r = c.getBoundingClientRect();
    if (r.width >= min && r.height >= min) return true;
  }
  return false;
}"""

# Playwright 专有语法(text=xxx / :has-text())在 document.querySelectorAll 里是 SyntaxError。
# 这一族出现在**通用兜底清单**里,直接丢给浏览器只会白跑往返(每个候选都要 reject 一次),
# 所以送进浏览器前先滤掉;它们仍由 _click_selector_anywhere 按 Playwright 语义去点。
_PW_ONLY_SELECTOR_RE = re.compile(r"text=|:has-text\(")


def _browser_safe_selectors(selectors: Sequence[str]) -> list[str]:
    return [s for s in selectors if s and not _PW_ONLY_SELECTOR_RE.search(str(s))]


# 默认候选:码语义容器 / 通用位图载体 / 码 iframe。刻意不写裸 "img"(登录页 logo 也是 img,
# 等一个必然出现的元素等于没等)。平台配置的 qr_image_selectors 与 qr_element_screenshot
# 由调用方前置拼进来 —— 那是已经过探针实锤的选择器,比这里的通用猜测更早命中。
_DEFAULT_QR_READY_SELECTORS: tuple[str, ...] = (
    '[class*="qrcode"] img',
    '[id*="qrcode"] img',
    '[class*="qr-code"] img',
    '[class*="qrcode"] canvas',
    '[class*="qrCode"] canvas',
    '[class*="qrcode"]',
    '[id*="qrcode"]',
    'img[src^="data:image"]',
    'iframe[src*="qrconnect"]',
)


def _ready_probe(page: Any, selectors: Sequence[str], min_side: int = 120) -> bool:
    """一次往返问完所有候选:页面里是否已有"够大的码载体"。任何异常都当未就绪。"""
    sels = _browser_safe_selectors(selectors)
    if not sels:
        return False
    try:
        return bool(page.evaluate(_QR_READY_PROBE_JS, {"sels": sels, "min": min_side}))
    except Exception:  # noqa: BLE001 — 探测失败绝不能影响主流程
        return False


def _entry_probe(page: Any, selectors: Sequence[str]) -> bool:
    """入口元素就绪(可点位置已量到)。判据是 bounding_box 而非 is_visible,理由同码容器截图。"""
    for sel in selectors:
        try:
            box = page.locator(sel).first.bounding_box()
            if box and box.get("width", 0) >= 4 and box.get("height", 0) >= 4:
                return True
        except Exception:  # noqa: BLE001 — 单个候选失败换下一个
            continue
    return False


def _wait_for_page_ready(
    page: Any,
    selectors: Sequence[str],
    *,
    timeout_s: float,
    poll_ms: int = 120,
    probe: Any = None,
) -> bool:
    """轮询到"至少一个候选就绪"或超时。返回是否命中就绪(仅用于日志)。

    注意不要写 time.sleep:探针/测试要能把等待压缩掉,统一走 page.wait_for_timeout。
    """
    check = probe or _ready_probe
    deadline = time.monotonic() + max(0.0, timeout_s)
    while True:
        if check(page, selectors):
            return True
        if time.monotonic() >= deadline:
            return False
        page.wait_for_timeout(poll_ms)


def _qr_ready_selectors(config: Mapping[str, Any]) -> tuple[str, ...]:
    """等"码渲染出来"的候选集:平台点名的选择器在前(更准),通用默认兜底。"""
    out: list[str] = []
    for key in ("qr_image_selectors", "qr_element_screenshot"):
        v = config.get(key)
        if isinstance(v, str):
            out.append(v)
        elif isinstance(v, (list, tuple)):
            out.extend(str(x) for x in v)
    out.extend(_DEFAULT_QR_READY_SELECTORS)
    # 去重保序(同一选择器重复问一遍只是白跑一次浏览器往返)
    return tuple(dict.fromkeys(out))


def _extract_qr_image(page: Any, selectors: Sequence[str]) -> str | None:
    """2026-09-30 统一「码图直接获取」:按平台配置的选择器定位码载体,提取原图。

    与头条纯 HTTP 通道同一目标 —— 弹窗给用户的是干净的官方二维码原图,而不是
    登录页截图。支持两类载体:
    - <img>:src 为 data:image/* 直接解码;http(s) src 服务端拉取(头条同款手法)
    - <canvas>:toDataURL('image/png') 导出(知乎等 canvas 渲染码)
    任一命中(渲染宽 ≥120px 防误抓图标)即返回 base64 PNG;全败返回 None,
    调用方回退截图兜底 —— 提取不到不影响出码,只是退回旧体验。
    """
    for sel in selectors:
        try:
            loc = page.locator(sel)
            # 浏览器端一次性预筛(可见 + 渲染宽 ≥120px)再逐个提取:
            # 快手等页面存在几十个 16px data:PNG 图标,码 img 排位靠后,
            # 逐个 is_visible 遍历既慢又会被 count 截断漏掉真码
            idxs = loc.evaluate_all(
                "els => els.map((el, i) => { const r = el.getBoundingClientRect();"
                " return { i, w: Math.round(r.width), vis: r.width > 0 && r.height > 0 }; })"
                ".filter(x => x.vis && x.w >= 120).map(x => x.i)"
            )
            for i in idxs[:5]:
                cand = loc.nth(i)
                data_url: str | None = cand.evaluate(
                    "el => el.tagName === 'CANVAS' ? el.toDataURL('image/png') : el.src"
                )
                if not data_url:
                    continue
                if data_url.startswith(("data:image/png", "data:image/jpeg")):
                    _, _, b64 = data_url.partition(",")
                    if b64:
                        return b64
                elif data_url.startswith(("http://", "https://")):
                    import httpx

                    r = httpx.get(data_url, timeout=10.0, follow_redirects=True)
                    # 2026-09-30:微信官方码(connect/qrcode)下发的是 **JPEG**,
                    # 只认 PNG 魔数会把 oschina 这类"能直取原图"的平台白退回截图。
                    if r.status_code == 200 and (
                        r.content[:8].startswith(b"\x89PNG") or r.content[:3] == b"\xff\xd8\xff"
                    ):
                        return base64.b64encode(r.content).decode("ascii")
        except Exception as e:  # noqa: BLE001 — 单个候选失败继续下一个
            logger.debug(f"[scan_login] 码图提取候选失败 {sel}:{e}")
    return None


def _render_qr_png(content: str) -> str | None:
    """2026-09-30 segno 生成码图 PNG(base64)。

    知乎等"码 canvas 画入跨域图被污染"的平台,用页面自己 token 接口响应里的
    link 重绘 —— 扫码内容与官方 canvas 码完全一致,等效官方原图体验。
    """
    try:
        import io

        import segno

        qr = segno.make(content, error="m")
        buf = io.BytesIO()
        qr.save(buf, kind="png", scale=8, border=2, dark="#000000", light="#ffffff")
        return base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception as e:  # noqa: BLE001 — 生成失败回退截图
        logger.debug(f"[scan_login] 码图重绘失败:{e}")
        return None


def _update_qr_screenshot(task: ScanTask, page: Any) -> None:
    """更新任务的二维码图(base64 PNG)。

    2026-09-30 统一「码图直接获取」优先:平台配置 qr_image_selectors 时先尝试
    提取官方码原图(与头条纯 HTTP 通道同一用户体验),失败回退原有截图路径。
    优先只截二维码那一块(见 `_find_qr_clip`);量不到合格盒子时退回整屏 ——
    退回不是失败:整屏至少还能看到页面,比什么都不返回好。
    2026-09-29:主页面全落空时,再试上下文其它页(sohu 登录层开新窗形态)。
    """
    # 2026-09-30 优先级 1「网络捕获重绘」:qr_capture 平台(知乎)从页面自己的码接口
    # 响应拿 link/token,segno 重绘干净码 —— 扫码内容与官方 canvas 码一致
    capture_cfg = PLATFORM_SCAN_CONFIG.get(task.platform, {}).get("qr_capture")
    if capture_cfg:
        with task._lock:
            captured = task._net_captured.get(capture_cfg["store_key"])
        if captured:
            rendered = _render_qr_png(captured)
            if rendered:
                with task._lock:
                    task.qr_image_b64 = rendered
                    task.qr_image_updated_at = time.time()
                _persist_task(task)
                return
        logger.debug(f"[scan_login] {task.platform} 码数据未捕获/重绘失败,降级 DOM 提取或截图")
    # 2026-09-30 优先级 2「DOM 码图直接提取」:平台配置了 qr_image_selectors 就先提取原图
    extract_selectors = PLATFORM_SCAN_CONFIG.get(task.platform, {}).get("qr_image_selectors")
    if extract_selectors:
        extracted = _extract_qr_image(page, extract_selectors)
        if extracted:
            with task._lock:
                task.qr_image_b64 = extracted
                task.qr_image_updated_at = time.time()
            _persist_task(task)
            return
        logger.debug(f"[scan_login] {task.platform} 码图提取落空,回退截图兜底")
    # 2026-09-30 优先级 3「码容器元素截图」:码是动画合成渲染(如抖音
    # #animate_qrcode_container,无独立 img/canvas/bg 载体)的平台,对码容器本身
    # 截图 —— 只有码区没有页面杂物,远优于整页/散点定位截图
    element_shot_sel = PLATFORM_SCAN_CONFIG.get(task.platform, {}).get("qr_element_screenshot")
    if element_shot_sel:
        for p2 in (page, *[q for q in page.context.pages if q is not page]):
            try:
                el = p2.locator(element_shot_sel).first
                # bounding box 判定而非 is_visible:fixed 定位元素 offsetParent=null,
                # is_visible 会误报不可见(抖音弹层实测 180×180 正常可截)
                box = el.bounding_box()
                if box and box["width"] >= 120:
                    png = el.screenshot(type="png", timeout=5_000)
                    with task._lock:
                        task.qr_image_b64 = base64.b64encode(png).decode("ascii")
                        task.qr_image_updated_at = time.time()
                    _persist_task(task)
                    return
            except Exception:  # noqa: BLE001 — 本页没有/未渲染,试下一页
                continue
        logger.debug(f"[scan_login] {task.platform} 码容器未定位到,回退截图兜底")
    clip: dict[str, float] | None = None
    target = page
    try:
        vp = page.viewport_size or {}
        vp_w = int(vp.get("width") or 0)
        vp_h = int(vp.get("height") or 0)
        if vp_w and vp_h:
            clip = _find_qr_clip(page, vp_w, vp_h)
            if clip is None:
                for other in [p for p in page.context.pages if p is not page]:
                    try:
                        ov = other.viewport_size or {}
                        ow = int(ov.get("width") or 0)
                        oh = int(ov.get("height") or 0)
                    except Exception:  # noqa: BLE001 — 页面可能已关
                        continue
                    if not (ow and oh):
                        continue
                    clip = _find_qr_clip(other, ow, oh)
                    if clip is not None:
                        target = other
                        break
    except Exception as e:  # noqa: BLE001 — 定位失败一律退回整屏截图
        logger.debug(f"[scan_login] 二维码元素定位失败(退回整屏):{e}")
        clip = None
    try:
        png_bytes = target.screenshot(type="png", clip=clip) if clip else target.screenshot(
            type="png", full_page=False
        )
        with task._lock:
            task.qr_image_b64 = base64.b64encode(png_bytes).decode("ascii")
            task.qr_image_updated_at = time.time()
    except Exception as e:
        logger.debug(f"[scan_login] 截图失败:{e}")
        return
    # P2 修复(2026-08-06): 截图变更后同步到 Redis,保证跨实例 qr 轮询取到最新截图
    _persist_task(task)


def _schedule_account_save(task: ScanTask) -> None:
    """异步把扫码结果保存到后端账号(独立线程,不阻塞扫码任务)。"""
    def _save() -> None:
        try:
            asyncio.run(_save_account_async(task))
        except Exception as e:
            logger.exception(f"[scan_login] 保存账号失败:{e}")

    threading.Thread(target=_save, daemon=True).start()


# ---------------------------------------------------------------------------
# 覆盖前镜像(把库里那份旧密文压进有界历史)已于 2026-09-27 抽成唯一出口
# `.publish.credential_history` —— 三个写 credentials_enc 的路径(本模块、保活守护
# cookie_refresh_daemon、前台 PUT /publish/accounts/{id})共用一份实现,
# 判据细节与"为什么只许一份"写在该模块头注。
# ---------------------------------------------------------------------------


async def _save_account_to_db(
    user_id: str,
    platform: str,
    credentials_dict: dict[str, str],
    platform_name: str,
    *,
    verify_msg: str = "扫码登录成功",
) -> int:
    """加密保存账号到 DB,返回 account_id(扫码登录 + CDP 检测复用)。

    - 已存在同 user + platform → 走唯一出口 `credential_history.apply_credentials_update`
      —— 覆盖前把库里那份旧密文压进 extra 的有界历史(见该模块),使这一步
      **可回滚**;历史准备失败只喊 error 并退回原写入,**不**让整次导入失败。
    - 不存在 → INSERT 新账号

    `verify_msg` 由调用方传入**当轮真实结论**:此前两处都硬写 `'扫码登录成功'`,而
    「浏览器画像导入」这条路径根本没有走过扫码(2026-09-27 实测:导入后 verify 立即 FAIL,
    账面却写着"扫码登录成功")。账面分叉不是措辞问题 —— 下游按 `last_verify_msg` 判可达,
    而它同时是历史条目里那条 `reason` 的唯一出处。
    """
    from ..core.db import get_db_conn
    from .publish.credentials_crypto import encrypt

    encrypted = encrypt(credentials_dict)
    display_name = f"{platform_name}(扫码登录 {time.strftime('%Y-%m-%d %H:%M')})"

    conn = await get_db_conn()
    try:
        row = await conn.fetchrow(
            "SELECT id FROM publish_accounts WHERE user_id=$1 AND platform=$2 ORDER BY id LIMIT 1",
            user_id, platform,
        )
        if row:
            await apply_credentials_update(
                conn, row["id"], encrypted,
                source_note=verify_msg,
                display_name=display_name,
                mark_verified=True,
            )
            logger.info(f"[scan_login] 更新账号 {row['id']}({platform})")
            return int(row["id"])
        new_id = await conn.fetchval(
            """INSERT INTO publish_accounts(user_id, platform, display_name, credentials_enc, status, last_verified_at, last_verify_msg)
               VALUES($1, $2, $3, $4, 'active', NOW(), $5) RETURNING id""",
            user_id, platform, display_name, encrypted, verify_msg,
        )
        logger.info(f"[scan_login] 创建账号 {new_id}({platform})")
        return int(new_id)
    finally:
        await conn.close()


async def _existing_account_row(user_id: str, platform: str) -> dict[str, Any] | None:
    """该 (user, platform) 里**已有非空凭据**的那一行(取 `id`);没有 ⇒ None。

    同一个出口同时喂两件事,所以只许有一份:
    ① 「覆盖是不是破坏性动作」—— 有这一行才有可毁掉的东西;
    ② 「这一趟校验该用哪个身份锚点」—— 适配器拿 `db_account_id` 算键,不拿它就退到
       「凭证首个值哈希」,而那正是"每次刷新换一张脸"的成因(见 anti_risk/account_identity.py)。
    两处各查一遍 SQL 必然漂开(本仓反复登记的"两处实现必漂移"),故旧版那个只回 bool 的
    `_existing_credentials_present` 被降级成它的投影并最终删掉。
    """
    from ..core.db import get_db_conn

    conn = await get_db_conn()
    try:
        row = await conn.fetchrow(
            """SELECT id FROM publish_accounts
               WHERE user_id=$1 AND platform=$2
                 AND credentials_enc IS NOT NULL AND length(credentials_enc) > 2
               ORDER BY id LIMIT 1""",
            user_id,
            platform,
        )
        return dict(row) if row else None
    finally:
        await conn.close()


def should_overwrite_existing_credentials(existing: bool, verified: bool | None) -> bool:
    """导入路径的唯一裁决点:**已有凭据时,只有"验过且通过"才授权覆盖**。

    判据不是"新值更好"(机器判不了),而是"这次动作有没有破坏性":
    - 库里没有凭据 ⇒ 落不落都是净新增,失败也照落并把真实结论写进 `last_verify_msg`;
    - 库里已有凭据 ⇒ 只有 `verified is True` 才覆盖。`False`(已证伪)与 `None`(判不出)
      都不授权 —— 工具坏了不构成"可以毁掉用户已有登录态"的许可。
      (2026-09-27 的真实代价:csdn id=12 的 38 字段旧集被 11 字段失效集换掉,旧集含
      `UserSecret` 而新集没有。当时密文**完全**无备份;同日补了「旧密文有界历史」那层余料
      那层有界余料 —— 但"事后能恢复"不是"事前可以盖"的理由,两道闸各自成立。)
    """
    if not existing:
        return True
    return verified is True


async def verify_login_candidate(
    platform: str,
    credentials: Mapping[str, str],
    db_account_id: int | str | None = None,
) -> tuple[bool | None, str]:
    """按当前适配器校验一份候选凭据 ⇒ `(结论, 说明)`,结论三态。

    - `True` 通过;
    - `False` **已证伪**(平台明确回了未登录/过期);
    - `None` **判不出**:没有适配器、Playwright 没装、或校验本身抛异常。
      这一档必须与 `False` 分开 —— 机器状态不是用户凭据的证据,拿它当"已证伪"会把
      一次可用导入判死;而破坏性动作(覆盖已有密文)只由 `True` 授权,所以两者都不覆盖。
    """
    from .publish.base_adapter import get_adapter

    adapter = get_adapter(platform)
    if adapter is None:
        return None, "无可用适配器,未做校验"
    # 行 id 是身份锚点:不注入,适配器就会退到「凭证首个值哈希」去起浏览器 ——
    # 那正是"每次刷新换一张脸"的成因,而校验本身就会起一次浏览器、落一次画像。
    adapter.db_account_id = db_account_id
    try:
        ok, msg = await adapter.verify_credentials(dict(credentials))
    except Exception as e:  # noqa: BLE001
        return None, f"校验不可用: {type(e).__name__}: {e}"
    text = str(msg or "")
    if not ok and "playwright" in text.lower():
        return None, f"依赖缺失,未做校验: {text}"
    return bool(ok), text


async def _save_account_async(task: ScanTask) -> None:
    """把扫码结果保存到后端账号(独立线程,不阻塞扫码任务)。"""
    try:
        credentials = dict(task.all_relevant_cookies)
        credentials.update(task.cookies)
        # 伪平台(如 toutiao_app)落库归并到真实平台,账号归属不分裂
        account_platform = _account_platform_of(task.platform)
        task.account_id = await _save_account_to_db(
            task.user_id,
            account_platform,
            credentials,
            PLATFORM_SCAN_CONFIG[account_platform]["name"],
        )
    except Exception as e:
        logger.exception(f"[scan_login] 保存账号失败:{e}")
    finally:
        # P2 修复(2026-08-06): account_id 更新后同步到 Redis,前端可查询到关联账号
        _persist_task(task)


async def detect_login_from_profile(platform: str, user_id: str) -> dict[str, Any]:
    """从"用户自己日常使用的浏览器"检测登录态 + 保存账号(2026-09-16,外部模式)。

    与 detect_login_from_cdp_session 的区别:后者检测的是本服务托管的 CDP 会话;
    本函数检测的是**用户真实 profile**——前端用系统默认浏览器打开平台登录页,用户在自己
    的浏览器里(已登录状态、Google 账号照常可用)完成或确认登录,后端只负责读:

    1. 名称级检测:按平台域名读真实 profile 的 cookie 名(明文,不解密,浏览器照常运行也能读);
    2. 命中后取值:无窗口 headless Chrome 读同一 profile 快照的 cookie 值;
    3. 关键字段校验通过 → 加密入库(与扫码登录同一张表 / 同一套审计)。

    返回结构对齐 CDP 检测:`{"detected", "cookies_count", "account_id", "error", ...}`,
    额外带 `profile_available`(是否成功读到用户 profile,供前端如实提示)。
    """
    if platform not in PLATFORM_SCAN_CONFIG:
        return {
            "detected": False, "cookies_count": 0, "account_id": None,
            "error": f"不支持的平台: {platform}", "profile_available": False,
        }

    from .browser_hub import _domain_suffix, _find_external_browser, hub, read_profile_cookie_names

    config = PLATFORM_SCAN_CONFIG[platform]
    browser = _find_external_browser()
    if not browser:
        return {
            "detected": False, "cookies_count": 0, "account_id": None,
            "error": "未找到可用浏览器(Chrome / Edge),无法读取你的登录状态",
            "profile_available": False,
        }

    domain = _domain_suffix(config["login_url"])
    loop = asyncio.get_running_loop()
    try:
        names = await loop.run_in_executor(
            None, read_profile_cookie_names, browser.user_data, domain
        )
    except Exception as e:  # noqa: BLE001 — 读取失败按"没读到"处理,前端继续轮询
        logger.warning(f"[scan_login] 读取用户浏览器登录态失败: {e}")
        names = None
    if names is None:
        # 没读到(库缺失/被占用):不能断言"未登录",如实回报 profile_available=False
        return {
            "detected": False, "cookies_count": 0, "account_id": None, "error": None,
            "profile_available": False, "cookie_names": [],
            "success_cookies": config["success_cookies"],
        }
    if not names:
        # 读到了,但该域名下没有 cookie → 该平台确实还没登录(profile 可用)
        return {
            "detected": False, "cookies_count": 0, "account_id": None, "error": None,
            "profile_available": True, "cookie_names": [],
            "success_cookies": config["success_cookies"],
        }

    # 名称级命中(只看存在性:min_len=0;真正取值走下面的 headless 读)
    hit_by_name = _cookie_hits(config, dict.fromkeys(names, "1"), min_len=0)
    if not hit_by_name:
        return {
            "detected": False, "cookies_count": 0, "account_id": None, "error": None,
            "profile_available": True, "cookie_names": sorted(names),
            "success_cookies": config["success_cookies"],
        }

    cookies, cookie_domains = await hub.read_profile_cookies_with_domains(browser.user_data)
    cookies_dict = {k: v for k, v in cookies.items() if v}
    # 按平台归属先筛再判:整浏览器 jar 里"名字像"的 cookie 不等于"这一站的登录态"
    # (2026-09-27 实测:旧写法只按 5 个名字子串剔统计项,导致 533 字段混包整包落库)。
    filter_result = filter_platform_cookies(
        platform=platform,
        cookies=cookies_dict,
        domains_by_name=cookie_domains,
        login_cookie_patterns=config["success_cookies"],
    )
    cookies_dict = filter_result.kept
    # 名称级检测已通过,这里的值直接来自真实浏览器 → min_len=1 即可(不要求长度 ≥5)
    hit = _cookie_hits(config, cookies_dict, min_len=1)
    if not hit:
        return {
            "detected": False, "cookies_count": len(cookies_dict), "account_id": None,
            "error": (
                "读到的登录 cookie 不在本平台域名下(可能命中的是别的站同名 cookie),"
                "请在该站已登录的浏览器里重试或改走扫码登录"
            ),
            "profile_available": True,
            "dropped_by_domain": len(filter_result.dropped),
        }

    # cookies_dict 在上面已经按平台归属筛过(filter_platform_cookies 的 kept 集),
    # 这里不得再套一层"名字黑名单" —— 那是把已被证伪的口径再抄一遍。
    all_relevant = cookies_dict

    # 先验后写:库里已有凭据时,一份**没通过校验**的候选集不得覆盖它。
    # 立因(2026-09-27 真实代价):本函数旧顺序是"筛完直接 upsert,再让人去 verify",
    # 于是用户 Chrome 里那份**已过期**的画像 cookie 集把 csdn id=12 仍可连通(verify=True,
    # 'connected as lichunchuan1')的 38 字段密文换成了 11 字段失效集 —— 密文无备份、不可回滚,
    # 且账面还写着 '扫码登录成功'。"探测到名字齐"不等于"登录态可用",覆盖是破坏性动作。
    # 一次读取喂两件事(锚点 + 是否破坏性)—— 查两遍就是在两把尺子之间留竞态窗口。
    existing_row = await _existing_account_row(user_id, platform)
    verify_ok, verify_note = await verify_login_candidate(
        platform, all_relevant, (existing_row or {}).get("id")
    )
    if not should_overwrite_existing_credentials(existing_row is not None, verify_ok):
        return {
            "detected": False, "cookies_count": len(cookies_dict), "account_id": None,
            "error": (
                f"候选登录态校验未通过({verify_note or '无可用适配器,无法校验'}),"
                "而库里已有一份凭据 ⇒ **拒绝覆盖**,原凭据与账面状态一字未动;"
                "请在该站浏览器里重新登录或改走扫码登录"
            ),
            "profile_available": True,
            "dropped_by_domain": len(filter_result.dropped),
            "existing_kept": True,
        }
    if verify_ok:
        msg_to_store = "画像导入并校验通过"
    elif verify_ok is None:
        msg_to_store = "画像导入:无可用适配器,未校验"
    else:
        msg_to_store = f"画像导入(首建,校验未过): {verify_note}"
    try:
        account_id = await _save_account_to_db(
            user_id, platform, all_relevant, config["name"], verify_msg=msg_to_store
        )
    except Exception as e:  # noqa: BLE001
        logger.exception(f"[scan_login] 从用户浏览器保存账号失败:{e}")
        return {
            "detected": False, "cookies_count": len(cookies_dict), "account_id": None,
            "error": f"保存账号失败: {e}", "profile_available": True,
        }
    logger.info(
        f"[scan_login] 用户浏览器检测成功: platform={platform}, "
        f"account_id={account_id}, cookies={len(all_relevant)}, verified={verify_ok}"
    )
    return {
        "detected": True, "cookies_count": len(all_relevant), "account_id": account_id,
        "error": None, "profile_available": True, "matched": hit,
        "verified": verify_ok, "verify_msg": verify_note,
    }


async def detect_login_from_cdp_session(
    session_id: str,
    platform: str,
    user_id: str,
) -> dict[str, Any]:
    """从 BrowserHub CDP 会话检测登录态 + 保存账号(2026-07-31 新增,CDP 扫码登录模式)。

    供前端 WorkPanel CDP 扫码登录轮询调用:
    - 前端 createBrowserSession 打开平台登录页 → 用户在 WorkPanel CDP 画面里扫码
    - 前端每 3s 调本函数 → 检测 success_cookies → 命中则加密保存到 DB
    - 返回 detected=True 时前端关闭会话 + 刷新账号列表

    Returns:
        {"detected": bool, "cookies_count": int, "account_id": int|None, "error": str|None}
    """
    if platform not in PLATFORM_SCAN_CONFIG:
        return {"detected": False, "cookies_count": 0, "account_id": None,
                "error": f"不支持的平台: {platform}"}

    from .browser_hub import hub
    session = hub.get_session(session_id, user_id)
    if not session:
        return {"detected": False, "cookies_count": 0, "account_id": None,
                "error": "浏览器会话不存在或已关闭"}

    config = PLATFORM_SCAN_CONFIG[platform]
    # 2026-09-02:浏览器被用户手动关闭时 CDP 连接断开,返回明确 error 让前端终止轮询
    try:
        cookies = await session.get_cookies()
    except Exception:
        return {"detected": False, "cookies_count": 0, "account_id": None,
                "error": "浏览器已关闭,请重新发起扫码登录"}
    cookies_dict = {c["name"]: c["value"] for c in cookies if c.get("value")}

    # 2026-09-15:获取当前页面 URL(诊断 + URL 跳转兜底检测)
    current_url = ""
    try:
        current_url = await session.get_current_url()
    except Exception:
        pass

    # 2026-09-15 终审修复:people(JSESSIONID 为框架通用会话 cookie)需要 URL 双重确认,
    # 否则登录页一打开就会误报登录成功
    require_url_match = bool(config.get("require_url_match"))
    url_ok = _url_matches_success(config, current_url)

    # 主检测:success_cookies 命中(2026-09-16:改用 _cookie_hits,支持前缀通配)
    hit = _cookie_hits(config, cookies_dict)
    if hit and require_url_match and not url_ok:
        hit = []

    # 2026-09-15 修复:URL 跳转兜底检测(与 _run_scan_task 对齐)。
    # 场景:平台 cookie 名单过时/变更时,主检测永远不命中 → 永远无法保存账号。
    # 条件:URL 命中 success_url_pattern + 不在登录页 + 至少 1 个期望 cookie 存在(通配感知,min_len=0)。
    if not hit and url_ok:
        present = _cookie_hits(config, cookies_dict, min_len=0)
        if present:
            hit = present
            logger.info(f"[scan_login] CDP URL 兜底命中: platform={platform}, url={current_url}, cookies={hit}")

    if not hit:
        return {
            "detected": False, "cookies_count": len(cookies_dict),
            "account_id": None, "error": None,
            # 2026-09-15:诊断字段(未命中时返回,便于排查过时的 success_cookies 名单)
            "current_url": current_url,
            "cookie_names": sorted(cookies_dict.keys()),
            "success_cookies": config["success_cookies"],
        }

    # 命中 → 按平台归属筛(域名优先、名称兜底)后再落库,不再走"剔除统计类"的名字黑名单
    all_relevant = _collect_platform_relevant(platform, cookies_dict, cookies, config)
    try:
        account_id = await _save_account_to_db(
            user_id, platform, all_relevant, config["name"]
        )
        logger.info(
            f"[scan_login] CDP 检测成功: platform={platform}, "
            f"account_id={account_id}, cookies={len(all_relevant)}"
        )
        return {"detected": True, "cookies_count": len(all_relevant),
                "account_id": account_id, "error": None}
    except Exception as e:
        logger.exception(f"[scan_login] CDP 保存账号失败:{e}")
        return {"detected": False, "cookies_count": len(cookies_dict),
                "account_id": None, "error": f"保存账号失败: {e}"}


# ---------------------------------------------------------------------------
# 公共 API
# ---------------------------------------------------------------------------
def start_scan_task(user_id: str, platform: str) -> ScanTask:
    """启动后台扫码登录任务(立即返回 task_id)。"""
    _cleanup_expired_tasks()
    task = create_task(user_id, platform)
    thread = threading.Thread(
        target=_run_scan_task,
        args=(task,),
        daemon=True,
        name=f"scan-login-{task.task_id[:8]}",
    )
    task._thread = thread
    thread.start()
    return task


def cancel_scan_task(task_id: str) -> bool:
    """取消扫码任务。跨实例同样生效:更新 Redis 终态,创建侧线程轮询检测到 cancelled 后自行退出。"""
    task = get_task(task_id)
    if not task:
        return False
    if task.is_terminal():
        return False
    # 本实例若持有工作副本(线程句柄),触发线程立即停止
    local = _TASK_STORE.get_local(task_id)
    if local is not None:
        local._stop_event.set()
    task.status = "cancelled"
    task.message = "用户取消"
    task.completed_at = time.time()
    _persist_task(task)  # P2 修复(2026-08-06): 取消终态同步到 Redis(跨实例可见)
    return True


def get_qr_image(task_id: str) -> bytes | None:
    """获取二维码截图 PNG 字节(供 API 返回)。"""
    task = get_task(task_id)
    if not task or not task.qr_image_b64:
        return None
    return base64.b64decode(task.qr_image_b64)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
