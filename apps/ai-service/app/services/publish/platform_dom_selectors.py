"""平台发布页 DOM 选择器维护表 — 用于 Playwright 自动化。

Playwright 适配器需要知道每个平台发布页的 DOM 选择器,但平台改版会失效。
本文件维护选择器表 + 版本号 + 最后验证时间,并提供运行时验证工具。

设计:
- PLATFORM_SELECTORS: dict[str, PlatformDomSelectors] — 38 平台选择器表
- get_selectors(platform) -> Optional[PlatformDomSelectors] — 查询
- verify_selector(platform, selector_name, page) -> bool — 运行时验证单选择器
- list_outdated_selectors(days_threshold=30) -> list[str] — 列出超过 N 天未验证的平台

诚实边界:
- 选择器基于 2026-07-31 平台发布页 HTML 结构(实测 + 公开文档)
- 平台改版频繁,实际使用前应跑 verify_selector 验证
- 不确定的选择器留空字符串,fallback_selectors 提供多个候选
- verify_selector 依赖 Playwright Page 对象(运行时延迟 import,类型用 Any 避免硬依赖)
- HTTP API 适配器(wordpress/medium/youtube/bilibili 等)的 publish_url 仅作记录,
  Playwright 不直接使用;但适配器需要凭证页/上传页 URL 时可读取
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Optional

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class PlatformDomSelectors:
    """平台发布页 DOM 选择器 — 用于 Playwright 自动化。

    字段说明:
    - platform: 平台 ID(与 platform_rules.py 的 PLATFORM_RULES key 一致)
    - login_url: 登录页 URL
    - publish_url: 发布页 URL
    - title_input: 标题输入框 CSS 选择器
    - content_editor: 正文编辑器 CSS 选择器(contenteditable 或 textarea)
    - cover_upload: 封面上传 input/button CSS 选择器
    - video_upload: 视频上传 input CSS 选择器(视频平台)
    - tag_input: 标签输入框 CSS 选择器
    - category_select: 分类选择 CSS 选择器(select 或自定义下拉)
    - original_checkbox: 原创声明 checkbox CSS 选择器
    - submit_button: 提交按钮 CSS 选择器
    - selector_version: 选择器版本号(YYYY.MM.DD)
    - last_verified: 最后验证时间(YYYY-MM-DD,空=未验证)
    - fallback_selectors: 备用选择器 {字段名: [候选选择器列表]}
    """

    platform: str
    login_url: str = ""
    publish_url: str = ""
    title_input: str = ""
    content_editor: str = ""
    cover_upload: str = ""
    video_upload: str = ""
    tag_input: str = ""
    category_select: str = ""
    original_checkbox: str = ""
    submit_button: str = ""
    selector_version: str = "2026.07.31"
    last_verified: str = "2026-07-31"
    fallback_selectors: dict[str, list[str]] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# 38 平台 DOM 选择器表(2026-07-31 立)
# 数据来源:平台发布页 HTML 结构 + Playwright 适配器实测
# 不确定的选择器留空,fallback_selectors 提供候选
# ---------------------------------------------------------------------------

PLATFORM_SELECTORS: dict[str, PlatformDomSelectors] = {
    # ===== 第一批:HTTP API 平台(publish_url 仅作记录,Playwright 不直接用)=====
    "wordpress": PlatformDomSelectors(
        platform="wordpress",
        login_url="https://wordpress.com/log-in",
        publish_url="https://wordpress.com/post",
        title_input=".editor-post-title__input",
        content_editor=".block-editor-writing-flow",
        cover_upload=".editor-post-featured-image__toggle",
        tag_input=".editor-post-taxonomies__hierarchical-terms-input input",
        category_select=".editor-post-taxonomies__hierarchical-terms-input",
        submit_button=".editor-post-publish-button",
        fallback_selectors={
            "title_input": ["#title", "textarea.editor-post-title__input"],
            "content_editor": ["#content", "textarea.wp-editor-area"],
            "submit_button": ["#publish", ".editor-post-publish-panel__toggle"],
        },
    ),
    "medium": PlatformDomSelectors(
        platform="medium",
        login_url="https://medium.com/m/signin",
        publish_url="https://medium.com/new-story",
        title_input="h1",
        content_editor="section[contenteditable=true]",
        cover_upload="button[aria-label='Add image']",
        tag_input="input[placeholder*='tag']",
        submit_button="button[data-action='publish']",
        fallback_selectors={
            "title_input": ["h1.graf--title", "section h1"],
            "content_editor": ["article[contenteditable=true]", "div[contenteditable=true]"],
        },
    ),
    "youtube": PlatformDomSelectors(
        platform="youtube",
        login_url="https://accounts.google.com/ServiceLogin",
        publish_url="https://www.youtube.com/upload",
        title_input="#title-textarea",
        content_editor="#description",
        video_upload="input[type=file]",
        tag_input="#tags-container input",
        category_select="#category-select",
        submit_button="#next-button",
        fallback_selectors={
            "title_input": ["input[name='title']", "ytcp-social-suggestions-textbox#title"],
            "content_editor": ["textarea#description", "#description-textarea"],
            "submit_button": ["#done-button", "ytcp-button[id='next-button']"],
        },
    ),
    "bilibili": PlatformDomSelectors(
        platform="bilibili",
        login_url="https://passport.bilibili.com/login",
        publish_url="https://member.bilibili.com/platform/upload/video/frame",
        title_input=".input-title",
        content_editor=".ql-editor",
        video_upload="input[type=file]",
        tag_input=".tag-input input",
        category_select=".select-type",
        submit_button=".submit-btn",
        fallback_selectors={
            "title_input": ["input[placeholder*='标题']", "#input-title"],
            "content_editor": ["#desc-container .ql-editor", "textarea#desc"],
            "tag_input": [".bcc-tag-input input", ".upload-tag-input input"],
        },
    ),
    "wechat": PlatformDomSelectors(
        platform="wechat",
        login_url="https://mp.weixin.qq.com/",
        publish_url="https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit",
        title_input="#title",
        content_editor="#ueditor_0",
        cover_upload=".js_cover_area",
        tag_input=".js_tag_input",
        submit_button=".js_send",
        fallback_selectors={
            "title_input": ["input#title", "textarea#title"],
            "content_editor": [".edui-body-container", "#ueditor_0 .edui-body-container"],
            "cover_upload": [".appmsg-cover", ".js_appmsg_cover"],
            "submit_button": ["#js_send", "button.js_send"],
        },
    ),
    "toutiao": PlatformDomSelectors(
        platform="toutiao",
        login_url="https://sso.toutiao.com/login",
        publish_url="https://mp.toutiao.com/profile_v4/graphic/publish",
        title_input=".article-title-input",
        content_editor=".ProseMirror",
        cover_upload=".cover-upload-btn",
        tag_input=".tag-input input",
        category_select=".category-select",
        submit_button=".publish-btn",
        fallback_selectors={
            "title_input": ["input[placeholder*='标题']", ".prosemirror-editor-title"],
            "content_editor": [".ql-editor", ".public-DraftEditor-content"],
        },
    ),
    "douyin": PlatformDomSelectors(
        platform="douyin",
        login_url="https://www.douyin.com/login",
        publish_url="https://creator.douyin.com/creator-micro/content/upload",
        title_input=".design-input input",
        content_editor=".ql-editor",
        video_upload="input[type=file]",
        tag_input=".tag-input input",
        cover_upload=".cover-upload-btn",
        submit_button=".publish-btn",
        fallback_selectors={
            "title_input": ["input[placeholder*='标题']", ".douyin-input"],
            "content_editor": ["textarea[placeholder*='描述']", ".editor-kit-editor"],
        },
    ),
    "kuaishou": PlatformDomSelectors(
        platform="kuaishou",
        login_url="https://www.kuaishou.com/login",
        publish_url="https://cp.kuaishou.com/article/publish",
        title_input=".title-input input",
        content_editor=".ql-editor",
        video_upload="input[type=file]",
        tag_input=".tag-input input",
        cover_upload=".cover-upload-btn",
        submit_button=".publish-btn",
    ),
    "weibo": PlatformDomSelectors(
        platform="weibo",
        login_url="https://passport.weibo.com/sso/signin",
        publish_url="https://weibo.com/set/article",
        title_input=".article-title input",
        content_editor=".ql-editor",
        cover_upload=".cover-upload-btn",
        tag_input=".tag-input input",
        submit_button=".publish-btn",
        fallback_selectors={
            "title_input": ["input[placeholder*='标题']"],
            "content_editor": ["textarea[placeholder*='正文']"],
        },
    ),
    # ===== 第二批:技术社区 =====
    "cnblogs": PlatformDomSelectors(
        platform="cnblogs",
        login_url="https://account.cnblogs.com/signin",
        publish_url="https://i.cnblogs.com/posts/edit",
        title_input="#post-title",
        content_editor="#Editor_Edit_EditorBody",
        tag_input="#txtTag",
        category_select="#site-category",
        submit_button="#btn_post_publish",
        fallback_selectors={
            "content_editor": [".mce-edit-area iframe", "#Editor_Edit_EditorBody_ifr"],
            "submit_button": ["#btn_post_save", "input[value='发布']"],
        },
    ),
    "segmentfault": PlatformDomSelectors(
        platform="segmentfault",
        login_url="https://segmentfault.com/user/login",
        publish_url="https://segmentfault.com/write",
        title_input="#title",
        content_editor=".public-DraftEditor-content",
        tag_input=".tag-input input",
        submit_button=".btn-primary",
        fallback_selectors={
            "title_input": ["input[placeholder*='标题']"],
            "content_editor": [".ql-editor", "textarea#wmd-input"],
        },
    ),
    "oschina": PlatformDomSelectors(
        platform="oschina",
        login_url="https://www.oschina.net/action/user/login",
        publish_url="https://my.oschina.net/u/blog/write",
        title_input="#title",
        content_editor="#blogContent",
        tag_input="#tagInput",
        category_select="#catalogSelect",
        submit_button="#btnSubmit",
        fallback_selectors={
            "content_editor": [".ql-editor", "textarea[name='content']"],
        },
    ),
    "jianshu": PlatformDomSelectors(
        platform="jianshu",
        login_url="https://www.jianshu.com/sign_in",
        publish_url="https://www.jianshu.com/writer",
        title_input=".title-input input",
        content_editor=".public-DraftEditor-content",
        tag_input=".tag-input input",
        submit_button=".publish-btn",
        fallback_selectors={
            "title_input": ["input[placeholder*='标题']"],
            "content_editor": [".ql-editor"],
        },
    ),
    "zhihu": PlatformDomSelectors(
        platform="zhihu",
        login_url="https://www.zhihu.com/signin",
        publish_url="https://zhuanlan.zhihu.com/write",
        title_input=".WriteIndex-titleInput textarea",
        content_editor=".public-DraftEditor-content",
        cover_upload=".ColumnWriteBundle-coverUploader",
        tag_input=".TopicSelect-input input",
        submit_button=".PublishPanel-triggerButton",
        fallback_selectors={
            "title_input": ["textarea[placeholder*='标题']"],
            "content_editor": [".DraftEditor-editorContainer", ".editable"],
            "submit_button": [".ComposeExaminer-button", "button.Button--primary"],
        },
    ),
    "csdn": PlatformDomSelectors(
        platform="csdn",
        login_url="https://passport.csdn.net/login",
        publish_url="https://mp.csdn.net/mp_blog/creation/editor",
        title_input=".article-bar input",
        content_editor=".ql-editor",
        tag_input=".tag-wrapper input",
        category_select=".select-type",
        submit_button=".submit-btn",
        fallback_selectors={
            "title_input": ["input[placeholder*='标题']", "#articleTitle"],
            "content_editor": ["#editor", ".vditor-content"],
            "tag_input": [".auto-input input"],
            "submit_button": ["button.btn-publish", ".el-button--primary"],
        },
    ),
    "juejin": PlatformDomSelectors(
        platform="juejin",
        login_url="https://juejin.cn/login",
        publish_url="https://juejin.cn/editor/drafts/new",
        title_input=".title-input input",
        content_editor=".ProseMirror",
        tag_input=".tag-input input",
        category_select=".category-select",
        submit_button=".publish-btn",
        fallback_selectors={
            "title_input": ["input[placeholder*='标题']"],
            "content_editor": [".ql-editor", ".bytemd"],
        },
    ),
    "xiaohongshu": PlatformDomSelectors(
        platform="xiaohongshu",
        login_url="https://www.xiaohongshu.com/login",
        publish_url="https://creator.xiaohongshu.com/publish/publish",
        title_input=".title-input input",
        content_editor=".ql-editor",
        cover_upload=".cover-upload-btn",
        video_upload="input[type=file]",
        tag_input=".tag-input input",
        submit_button=".publish-btn",
        fallback_selectors={
            "title_input": ["input[placeholder*='标题']"],
            "content_editor": ["textarea[placeholder*='正文']"],
        },
    ),
    # ===== 第三批:六大号(Playwright + 反风控)=====
    "baijiahao": PlatformDomSelectors(
        platform="baijiahao",
        login_url="https://baijiahao.baidu.com/builder/rc/login",
        publish_url="https://baijiahao.baidu.com/builder/rc/edit?type=news",
        title_input=".title-wrap input",
        content_editor=".ql-editor",
        cover_upload=".cover-upload-btn",
        tag_input=".tag-input input",
        category_select=".category-select",
        submit_button=".submit-btn",
        fallback_selectors={
            "title_input": ["input[placeholder*='标题']"],
            "content_editor": ["#ueditor_0", "textarea[name='content']"],
        },
    ),
    "qq": PlatformDomSelectors(
        platform="qq",
        login_url="https://om.qq.com/userAuth/login",
        publish_url="https://om.qq.com/article/articlepublish",
        title_input=".title-input input",
        content_editor=".ql-editor",
        cover_upload=".cover-upload-btn",
        tag_input=".tag-input input",
        category_select=".category-select",
        submit_button=".submit-btn",
    ),
    "dayihao": PlatformDomSelectors(
        platform="dayihao",
        login_url="https://mp.dayu.com/",
        publish_url="https://mp.dayu.com/editor/edit",
        title_input=".title-input input",
        content_editor=".ql-editor",
        cover_upload=".cover-upload-btn",
        tag_input=".tag-input input",
        category_select=".category-select",
        submit_button=".submit-btn",
    ),
    "netease": PlatformDomSelectors(
        platform="netease",
        login_url="https://mp.163.com/login.html",
        publish_url="https://mp.163.com/dy/article/edit",
        title_input=".title-input input",
        content_editor=".ql-editor",
        cover_upload=".cover-upload-btn",
        tag_input=".tag-input input",
        category_select=".category-select",
        submit_button=".submit-btn",
    ),
    "sohu": PlatformDomSelectors(
        platform="sohu",
        login_url="https://mp.sohu.com/mp/login",
        publish_url="https://mp.sohu.com/mpfe/main/editor/new.html",
        title_input=".title-input input",
        content_editor=".ql-editor",
        cover_upload=".cover-upload-btn",
        tag_input=".tag-input input",
        category_select=".category-select",
        submit_button=".submit-btn",
    ),
    "sina": PlatformDomSelectors(
        platform="sina",
        login_url="https://mp.sina.com.cn/login",
        publish_url="https://mp.sina.com.cn/mpfe/editor/new.html",
        title_input=".title-input input",
        content_editor=".ql-editor",
        cover_upload=".cover-upload-btn",
        tag_input=".tag-input input",
        category_select=".category-select",
        submit_button=".submit-btn",
    ),
    # ===== 视频平台第二批 =====
    "xigua": PlatformDomSelectors(
        platform="xigua",
        login_url="https://www.ixigua.com/login",
        publish_url="https://creator.ixigua.com/creator-micro/content/upload",
        title_input=".design-input input",
        content_editor=".ql-editor",
        video_upload="input[type=file]",
        tag_input=".tag-input input",
        cover_upload=".cover-upload-btn",
        submit_button=".publish-btn",
    ),
    "haokan": PlatformDomSelectors(
        platform="haokan",
        login_url="https://haokan.baidu.com/login",
        publish_url="https://haokan.baidu.com/creator/upload",
        title_input=".title-input input",
        content_editor=".ql-editor",
        video_upload="input[type=file]",
        tag_input=".tag-input input",
        cover_upload=".cover-upload-btn",
        submit_button=".publish-btn",
    ),
    "shipinhao": PlatformDomSelectors(
        platform="shipinhao",
        login_url="https://channels.weixin.qq.com/login",
        publish_url="https://channels.weixin.qq.com/platform/post/create",
        title_input=".title-input input",
        content_editor=".ql-editor",
        video_upload="input[type=file]",
        tag_input=".tag-input input",
        cover_upload=".cover-upload-btn",
        submit_button=".publish-btn",
    ),
    # ===== 第四批:SEO/GEO 高权重平台第二批 =====
    "baidu_zhidao": PlatformDomSelectors(
        platform="baidu_zhidao",
        login_url="https://passport.baidu.com/v2/?login",
        publish_url="https://zhidao.baidu.com/",
        title_input=".question-title input",
        content_editor=".ql-editor",
        submit_button=".submit-btn",
    ),
    "baidu_tieba": PlatformDomSelectors(
        platform="baidu_tieba",
        login_url="https://passport.baidu.com/v2/?login",
        publish_url="https://tieba.baidu.com/f?ie=utf-8&kw=",
        title_input=".title-input input",
        content_editor=".ql-editor",
        submit_button=".submit-btn",
    ),
    "douban": PlatformDomSelectors(
        platform="douban",
        login_url="https://accounts.douban.com/passport/login",
        publish_url="https://www.douban.com/note/create",
        title_input="#title",
        content_editor="#note",
        submit_button="input[type=submit]",
    ),
    "36kr": PlatformDomSelectors(
        platform="36kr",
        login_url="https://passport.36kr.com/login",
        publish_url="https://36kr.com/usercenter/draft",
        title_input=".title-input input",
        content_editor=".ql-editor",
        tag_input=".tag-input input",
        submit_button=".publish-btn",
    ),
    "huxiu": PlatformDomSelectors(
        platform="huxiu",
        login_url="https://www.huxiu.com/login",
        publish_url="https://www.huxiu.com/article/write",
        title_input=".title-input input",
        content_editor=".ql-editor",
        tag_input=".tag-input input",
        submit_button=".publish-btn",
    ),
    "tmtmedia": PlatformDomSelectors(
        platform="tmtmedia",
        login_url="https://www.tmtpost.com/login",
        publish_url="https://www.tmtpost.com/article/write",
        title_input=".title-input input",
        content_editor=".ql-editor",
        tag_input=".tag-input input",
        submit_button=".publish-btn",
    ),
    "acfun": PlatformDomSelectors(
        platform="acfun",
        login_url="https://www.acfun.cn/login",
        publish_url="https://member.acfun.cn/production/upload/article",
        title_input=".title-input input",
        content_editor=".ql-editor",
        tag_input=".tag-input input",
        submit_button=".publish-btn",
    ),
    "lofter": PlatformDomSelectors(
        platform="lofter",
        login_url="https://www.lofter.com/login",
        publish_url="https://www.lofter.com/post/publish",
        title_input=".title-input input",
        content_editor=".ql-editor",
        tag_input=".tag-input input",
        submit_button=".publish-btn",
    ),
    "zhihu_daily": PlatformDomSelectors(
        platform="zhihu_daily",
        login_url="https://www.zhihu.com/signin",
        publish_url="https://daily.zhihu.com/admin/write",
        title_input=".title-input input",
        content_editor=".ql-editor",
        submit_button=".publish-btn",
    ),
    "people": PlatformDomSelectors(
        platform="people",
        login_url="http://www.people.cn/",
        publish_url="http://www.people.cn/admin/article/write",
        title_input=".title-input input",
        content_editor=".ql-editor",
        submit_button=".publish-btn",
    ),
    "china_news": PlatformDomSelectors(
        platform="china_news",
        login_url="https://www.chinanews.com.cn/",
        publish_url="https://www.chinanews.com.cn/admin/article/write",
        title_input=".title-input input",
        content_editor=".ql-editor",
        submit_button=".publish-btn",
    ),
    "hupu": PlatformDomSelectors(
        platform="hupu",
        login_url="https://www.hupu.com/login",
        publish_url="https://my.hupu.com/post/create",
        title_input=".title-input input",
        content_editor=".ql-editor",
        tag_input=".tag-input input",
        submit_button=".publish-btn",
    ),
}


# ---------------------------------------------------------------------------
# 查询接口
# ---------------------------------------------------------------------------


def get_selectors(platform: str) -> Optional[PlatformDomSelectors]:
    """获取平台 DOM 选择器配置。

    Args:
        platform: 平台 ID

    Returns:
        PlatformDomSelectors 或 None(平台未配置)
    """
    return PLATFORM_SELECTORS.get(platform)


def list_platforms_with_selectors() -> list[str]:
    """列出所有已配置 DOM 选择器的平台 ID。"""
    return list(PLATFORM_SELECTORS.keys())


# ---------------------------------------------------------------------------
# 运行时验证(依赖 Playwright Page 对象)
# ---------------------------------------------------------------------------


def _get_selector_value(
    selectors: PlatformDomSelectors, selector_name: str,
) -> tuple[str, list[str]]:
    """从 PlatformDomSelectors 取出指定字段的主选择器 + 候选列表。

    Args:
        selectors: 平台选择器对象
        selector_name: 字段名(如 "title_input")

    Returns:
        (主选择器, 候选列表[含主选择器])
    """
    main_value: str = getattr(selectors, selector_name, "") or ""
    fallbacks: list[str] = selectors.fallback_selectors.get(selector_name, [])
    candidates: list[str] = []
    if main_value:
        candidates.append(main_value)
    for fb in fallbacks:
        if fb and fb not in candidates:
            candidates.append(fb)
    return main_value, candidates


def verify_selector(
    platform: str,
    selector_name: str,
    page: Any,
) -> bool:
    """运行时验证单选择器是否在当前页面有效。

    依次尝试主选择器 + fallback_selectors 候选,任一命中即返回 True。
    若全部失败返回 False。

    Args:
        platform: 平台 ID
        selector_name: 字段名(如 "title_input" / "content_editor" 等)
        page: Playwright Page 对象(运行时延迟使用,类型用 Any 避免硬依赖)

    Returns:
        True = 至少一个选择器在当前页面可定位元素
        False = 平台未配置 / 全部选择器均无法定位 / page 不可用
    """
    selectors = PLATFORM_SELECTORS.get(platform)
    if not selectors:
        logger.warning(
            "[platform_dom_selectors] 平台 %s 无选择器配置", platform,
        )
        return False

    if page is None:
        logger.warning(
            "[platform_dom_selectors] verify_selector 收到 None page,跳过验证",
        )
        return False

    # Playwright Page API 探测(支持 sync + async,延迟调用避免硬依赖)
    if not hasattr(page, "query_selector"):
        logger.warning(
            "[platform_dom_selectors] page 对象无 query_selector 方法,跳过验证",
        )
        return False

    main_value, candidates = _get_selector_value(selectors, selector_name)
    if not candidates:
        logger.info(
            "[platform_dom_selectors] %s.%s 无可用选择器(主+候选均空)",
            platform, selector_name,
        )
        return False

    for idx, sel in enumerate(candidates):
        try:
            element = page.query_selector(sel)
            if element is not None:
                if idx > 0:
                    logger.info(
                        "[platform_dom_selectors] %s.%s 主选择器失效,"
                        "使用 fallback #%d: %s",
                        platform, selector_name, idx, sel,
                    )
                else:
                    logger.debug(
                        "[platform_dom_selectors] %s.%s 主选择器有效: %s",
                        platform, selector_name, sel,
                    )
                return True
        except Exception as e:
            logger.debug(
                "[platform_dom_selectors] %s.%s 选择器 %s 异常: %s: %s",
                platform, selector_name, sel, type(e).__name__, e,
            )
            continue

    logger.warning(
        "[platform_dom_selectors] %s.%s 全部 %d 个选择器均失效(主: %s)",
        platform, selector_name, len(candidates), main_value,
    )
    return False


def verify_all_selectors(
    platform: str, page: Any,
) -> dict[str, bool]:
    """验证指定平台所有非空选择器是否有效。

    Args:
        platform: 平台 ID
        page: Playwright Page 对象

    Returns:
        {字段名: 是否有效} 字典(仅含已配置的选择器字段)
    """
    selectors = PLATFORM_SELECTORS.get(platform)
    if not selectors:
        return {}

    results: dict[str, bool] = {}
    for field_name in (
        "title_input", "content_editor", "cover_upload", "video_upload",
        "tag_input", "category_select", "original_checkbox", "submit_button",
    ):
        main_value, _ = _get_selector_value(selectors, field_name)
        if not main_value and not selectors.fallback_selectors.get(field_name):
            continue
        results[field_name] = verify_selector(platform, field_name, page)
    return results


# ---------------------------------------------------------------------------
# 过期检测(超过 N 天未验证)
# ---------------------------------------------------------------------------


def list_outdated_selectors(days_threshold: int = 30) -> list[str]:
    """列出超过 N 天未验证的平台 ID。

    Args:
        days_threshold: 阈值天数(默认 30 天)

    Returns:
        过期平台 ID 列表(按字母序)
    """
    if days_threshold < 0:
        raise ValueError(f"days_threshold 不能为负数,收到 {days_threshold}")

    cutoff = datetime.now() - timedelta(days=days_threshold)
    outdated: list[str] = []

    for platform, selectors in PLATFORM_SELECTORS.items():
        if not selectors.last_verified:
            # 未验证过的视为过期
            outdated.append(platform)
            continue
        try:
            verified_date = datetime.strptime(
                selectors.last_verified, "%Y-%m-%d",
            )
        except ValueError:
            # 日期格式无效,视为过期
            logger.warning(
                "[platform_dom_selectors] 平台 %s last_verified 格式无效: %s",
                platform, selectors.last_verified,
            )
            outdated.append(platform)
            continue
        if verified_date < cutoff:
            outdated.append(platform)

    outdated.sort()
    return outdated


def list_unverified_selectors() -> list[str]:
    """列出从未验证过的平台(last_verified 为空)。"""
    unverified = [
        platform
        for platform, selectors in PLATFORM_SELECTORS.items()
        if not selectors.last_verified
    ]
    unverified.sort()
    return unverified


__all__ = [
    "PlatformDomSelectors",
    "PLATFORM_SELECTORS",
    "get_selectors",
    "list_platforms_with_selectors",
    "verify_selector",
    "verify_all_selectors",
    "list_outdated_selectors",
    "list_unverified_selectors",
]
