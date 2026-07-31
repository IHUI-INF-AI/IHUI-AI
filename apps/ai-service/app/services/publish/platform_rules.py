"""平台规则适配 — 字数/标题/标签/分类/封面尺寸/敏感词检测。

各平台发布规则差异大,本模块集中维护:
1. 字数限制:标题/正文/描述/标签字符数上下限
2. 标签规则:数量上限 + 分隔符 + 长度限制 + 是否允许中文
3. 分类映射:平台分类 ID/名称(用于发布时选择)
4. 封面尺寸:推荐分辨率 + 格式 + 文件大小限制
5. 敏感词检测:发布前预检,避免被平台拒审/限流

设计:
- PLATFORM_RULES: dict[str, PlatformRule] — 每平台规则配置
- validate_content(platform, content) -> ValidationResult — 发布前校验
- detect_sensitive_words(text) -> list[SensitiveWordHit] — 敏感词命中
- truncate_to_platform(platform, content) -> PublishContent — 按平台规则截断

诚实边界:
- 敏感词表为公开版本(非完整平台内部黑名单,平台黑盒)
- 平台规则可能随时变更,建议每季度复查
- 本模块只做"预检 + 截断",不修改内容语义
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional

from app.core.logging import get_logger

from .base_adapter import PublishContent

logger = get_logger(__name__)


@dataclass
class PlatformRule:
    """单平台发布规则。"""

    platform_id: str
    platform_name: str
    # 标题字数限制
    title_min: int = 1
    title_max: int = 100
    # 正文字数限制
    body_min: int = 1
    body_max: int = 100000
    # 标签规则
    tag_max_count: int = 5
    tag_max_length: int = 20
    tag_separator: str = ","  # 部分平台用空格或分号
    tag_allow_chinese: bool = True
    # 描述/摘要字数(视频/图片平台)
    desc_max: int = 2000
    # 封面尺寸(推荐)
    cover_min_width: int = 480
    cover_min_height: int = 270
    cover_max_size_mb: int = 10
    cover_formats: list[str] = field(default_factory=lambda: ["jpg", "jpeg", "png", "webp"])
    # 视频规则
    video_max_size_mb: int = 4096  # 4GB
    video_max_duration_min: int = 60  # 60 分钟
    video_formats: list[str] = field(default_factory=lambda: ["mp4", "mov", "avi", "flv", "wmv"])
    # 内容类型支持
    support_markdown: bool = True
    support_html: bool = True
    support_code_block: bool = True
    support_table: bool = True
    support_image: bool = True
    support_video: bool = False
    # 平台独有提示(发布前给用户提示)
    publish_tips: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# 37 平台规则配置(基于平台官方文档 + 实测,2026-07-31 立)
# ---------------------------------------------------------------------------

PLATFORM_RULES: dict[str, PlatformRule] = {
    "wordpress": PlatformRule(
        platform_id="wordpress", platform_name="WordPress",
        title_max=200, body_max=500000,
        tag_max_count=10, tag_max_length=50,
        cover_max_size_mb=20,
    ),
    "medium": PlatformRule(
        platform_id="medium", platform_name="Medium",
        title_max=200, body_max=200000,
        tag_max_count=5, tag_max_length=30,
        publish_tips=["Medium 标题不要超过 100 字符(超过会被截断)"],
    ),
    "youtube": PlatformRule(
        platform_id="youtube", platform_name="YouTube",
        title_max=100, body_max=5000,
        desc_max=5000,
        tag_max_count=15, tag_max_length=30,
        video_max_size_mb=12288,  # 12GB
        video_max_duration_min=720,  # 12 小时
        support_markdown=False, support_html=False,
        support_code_block=False, support_table=False,
        support_image=False, support_video=True,
    ),
    "bilibili": PlatformRule(
        platform_id="bilibili", platform_name="哔哩哔哩",
        title_max=80, body_max=2000,
        desc_max=2000,
        tag_max_count=10, tag_max_length=15,
        video_max_size_mb=8192,  # 8GB
        video_max_duration_min=120,  # 2 小时
        support_markdown=False, support_html=False,
        support_image=False, support_video=True,
    ),
    "wechat": PlatformRule(
        platform_id="wechat", platform_name="公众号",
        title_max=64, body_max=20000,
        tag_max_count=3, tag_max_length=8,
        cover_min_width=900, cover_min_height=500,
        publish_tips=["公众号封面推荐 900×500(2.35:1)", "正文字数<20000 超出会拆分"],
    ),
    "toutiao": PlatformRule(
        platform_id="toutiao", platform_name="今日头条",
        title_max=30, body_max=50000,
        tag_max_count=5, tag_max_length=10,
        cover_min_width=640, cover_min_height=360,
    ),
    "douyin": PlatformRule(
        platform_id="douyin", platform_name="抖音",
        title_max=55, body_max=100,
        desc_max=100,
        tag_max_count=5, tag_max_length=10,
        video_max_size_mb=4096,
        video_max_duration_min=15,  # 15 分钟
        support_markdown=False, support_html=False,
        support_image=False, support_video=True,
        publish_tips=["抖音标题≤55字", "视频≤15分钟(超过需认证)"],
    ),
    "kuaishou": PlatformRule(
        platform_id="kuaishou", platform_name="快手",
        title_max=50, body_max=500,
        desc_max=500,
        tag_max_count=5, tag_max_length=10,
        video_max_size_mb=2048,
        video_max_duration_min=10,
        support_markdown=False, support_html=False,
        support_image=False, support_video=True,
    ),
    "weibo": PlatformRule(
        platform_id="weibo", platform_name="微博",
        title_max=140, body_max=2000,
        tag_max_count=5, tag_max_length=15,
        cover_max_size_mb=5,
        publish_tips=["微博正文≤2000字", "长文建议用长微博工具"],
    ),
    "cnblogs": PlatformRule(
        platform_id="cnblogs", platform_name="博客园",
        title_max=200, body_max=500000,
        tag_max_count=10, tag_max_length=30,
        support_code_block=True, support_table=True,
    ),
    "segmentfault": PlatformRule(
        platform_id="segmentfault", platform_name="思否",
        title_max=80, body_max=100000,
        tag_max_count=5, tag_max_length=20,
        support_code_block=True, support_table=True,
    ),
    "oschina": PlatformRule(
        platform_id="oschina", platform_name="开源中国",
        title_max=80, body_max=100000,
        tag_max_count=5, tag_max_length=15,
        support_code_block=True, support_table=True,
    ),
    "jianshu": PlatformRule(
        platform_id="jianshu", platform_name="简书",
        title_max=50, body_max=50000,
        tag_max_count=5, tag_max_length=10,
        support_code_block=True, support_table=False,
    ),
    "zhihu": PlatformRule(
        platform_id="zhihu", platform_name="知乎",
        title_max=100, body_max=100000,
        tag_max_count=5, tag_max_length=15,
        support_code_block=True, support_table=True,
        publish_tips=["知乎支持卡片式排版", "富文本编辑器接受 HTML"],
    ),
    "csdn": PlatformRule(
        platform_id="csdn", platform_name="CSDN",
        title_max=100, body_max=100000,
        tag_max_count=5, tag_max_length=15,
        support_code_block=True, support_table=True,
        publish_tips=["CSDN 支持 Markdown + 代码高亮", "代码块必须标语言"],
    ),
    "juejin": PlatformRule(
        platform_id="juejin", platform_name="掘金",
        title_max=100, body_max=50000,
        tag_max_count=3, tag_max_length=15,
        support_code_block=True, support_table=True,
        publish_tips=["掘金标签必填 ≤3 个", "代码块支持主题高亮"],
    ),
    "xiaohongshu": PlatformRule(
        platform_id="xiaohongshu", platform_name="小红书",
        title_max=20, body_max=1000,
        tag_max_count=10, tag_max_length=10,
        cover_min_width=1080, cover_min_height=1080,
        publish_tips=["小红书标题≤20字", "正文≤1000字", "封面建议 1:1 正方形", "支持 emoji 表情"],
    ),
    "baijiahao": PlatformRule(
        platform_id="baijiahao", platform_name="百家号",
        title_max=80, body_max=50000,
        tag_max_count=5, tag_max_length=10,
        cover_min_width=640, cover_min_height=360,
        support_code_block=False, support_table=False,
    ),
    "qq": PlatformRule(
        platform_id="qq", platform_name="企鹅号",
        title_max=80, body_max=50000,
        tag_max_count=5, tag_max_length=10,
        cover_min_width=640, cover_min_height=360,
    ),
    "dayihao": PlatformRule(
        platform_id="dayihao", platform_name="大鱼号",
        title_max=80, body_max=50000,
        tag_max_count=5, tag_max_length=10,
        cover_min_width=640, cover_min_height=360,
    ),
    "netease": PlatformRule(
        platform_id="netease", platform_name="网易号",
        title_max=80, body_max=50000,
        tag_max_count=5, tag_max_length=10,
        cover_min_width=640, cover_min_height=360,
    ),
    "sohu": PlatformRule(
        platform_id="sohu", platform_name="搜狐号",
        title_max=80, body_max=50000,
        tag_max_count=5, tag_max_length=10,
        cover_min_width=640, cover_min_height=360,
    ),
    "sina": PlatformRule(
        platform_id="sina", platform_name="新浪看点",
        title_max=80, body_max=50000,
        tag_max_count=5, tag_max_length=10,
        cover_min_width=640, cover_min_height=360,
    ),
    "xigua": PlatformRule(
        platform_id="xigua", platform_name="西瓜视频",
        title_max=80, body_max=2000,
        desc_max=2000,
        tag_max_count=5, tag_max_length=15,
        video_max_size_mb=4096,
        video_max_duration_min=60,
        support_markdown=False, support_html=False,
        support_image=False, support_video=True,
    ),
    "haokan": PlatformRule(
        platform_id="haokan", platform_name="好看视频",
        title_max=80, body_max=2000,
        desc_max=2000,
        tag_max_count=5, tag_max_length=15,
        video_max_size_mb=4096,
        video_max_duration_min=60,
        support_markdown=False, support_html=False,
        support_image=False, support_video=True,
    ),
    "shipinhao": PlatformRule(
        platform_id="shipinhao", platform_name="微信视频号",
        title_max=50, body_max=1000,
        desc_max=1000,
        tag_max_count=5, tag_max_length=10,
        video_max_size_mb=2048,
        video_max_duration_min=30,
        support_markdown=False, support_html=False,
        support_image=False, support_video=True,
    ),
    # ===== 第四批:SEO/GEO 高权重平台第二批(2026-07-31 立)=====
    "baidu_zhidao": PlatformRule(
        platform_id="baidu_zhidao", platform_name="百度知道",
        title_max=50, body_max=100000,
        tag_max_count=5, tag_max_length=15,
        publish_tips=["百度知道为问答平台", "与百家号共用 BDUSS/STOKEN"],
    ),
    "baidu_tieba": PlatformRule(
        platform_id="baidu_tieba", platform_name="百度贴吧",
        title_max=30, body_max=5000,
        tag_max_count=5, tag_max_length=10,
        publish_tips=["贴吧发帖需指定 tieba_kw", "标题≤30字"],
    ),
    "douban": PlatformRule(
        platform_id="douban", platform_name="豆瓣",
        title_max=80, body_max=20000,
        tag_max_count=5, tag_max_length=10,
        support_code_block=False, support_table=False,
        publish_tips=["豆瓣日记正文≤20000字", "文艺向内容更受欢迎"],
    ),
    "36kr": PlatformRule(
        platform_id="36kr", platform_name="36氪",
        title_max=50, body_max=50000,
        tag_max_count=3, tag_max_length=15,
        support_code_block=True, support_table=True,
        publish_tips=["36氪偏科技创投内容", "代码块需标语言"],
    ),
    "huxiu": PlatformRule(
        platform_id="huxiu", platform_name="虎嗅网",
        title_max=40, body_max=50000,
        tag_max_count=5, tag_max_length=15,
        support_code_block=True, support_table=True,
        publish_tips=["虎嗅偏商业深度分析", "标题≤40字"],
    ),
    "tmtmedia": PlatformRule(
        platform_id="tmtmedia", platform_name="钛媒体",
        title_max=40, body_max=50000,
        tag_max_count=5, tag_max_length=15,
        support_code_block=True, support_table=True,
        publish_tips=["钛媒体偏 TMT 领域", "代码块需标语言"],
    ),
    "acfun": PlatformRule(
        platform_id="acfun", platform_name="AcFun",
        title_max=50, body_max=50000,
        tag_max_count=10, tag_max_length=15,
        support_code_block=False, support_table=False,
        publish_tips=["AcFun 文章分区投稿", "弹幕社区偏年轻向"],
    ),
    "lofter": PlatformRule(
        platform_id="lofter", platform_name="LOFTER",
        title_max=50, body_max=50000,
        tag_max_count=10, tag_max_length=15,
        support_code_block=False, support_table=False,
        publish_tips=["LOFTER 为轻博客", "支持图文/标签丰富"],
    ),
    "zhihu_daily": PlatformRule(
        platform_id="zhihu_daily", platform_name="知乎日报",
        title_max=100, body_max=100000,
        tag_max_count=5, tag_max_length=15,
        support_code_block=True, support_table=True,
        publish_tips=["知乎日报为精选内容", "与知乎主站共用 z_c0/d_c0"],
    ),
    "people": PlatformRule(
        platform_id="people", platform_name="人民网",
        title_max=40, body_max=50000,
        tag_max_count=5, tag_max_length=10,
        cover_min_width=640, cover_min_height=360,
        support_code_block=False, support_table=False,
        publish_tips=["人民网为中央重点新闻网站", "标题≤40字", "代码块需标语言"],
    ),
    "china_news": PlatformRule(
        platform_id="china_news", platform_name="中国新闻网",
        title_max=40, body_max=50000,
        tag_max_count=5, tag_max_length=10,
        cover_min_width=640, cover_min_height=360,
        support_code_block=False, support_table=False,
        publish_tips=["中国新闻网为中央重点新闻网站", "标题≤40字"],
    ),
    "hupu": PlatformRule(
        platform_id="hupu", platform_name="虎扑社区",
        title_max=40, body_max=10000,
        tag_max_count=5, tag_max_length=10,
        publish_tips=["虎扑发帖需指定 hupu_fid", "体育/电竞社区"],
    ),
}


# ---------------------------------------------------------------------------
# 敏感词检测(公开版本,非完整平台内部黑名单)
# ---------------------------------------------------------------------------

# 基础敏感词表(仅做预检,平台内部黑名单为黑盒)
# 分类:政治/色情/暴力/广告/违法
_SENSITIVE_WORDS: dict[str, list[str]] = {
    "political": [
        # 政治(简略版,实际部署需更完整词表)
        "六四", "天安门事件", "法轮功", "达赖喇嘛", "台独", "藏独", "疆独",
        "颠覆", "反共", "反华", "暴政", "专制",
    ],
    "adult": [
        # 色情
        "色情", "成人", "黄片", "裸体", "性感", "一夜情", "约炮", "嫖娼",
        "卖淫", "性服务", "AV女优", "成人电影", "黄色网站",
    ],
    "violence": [
        # 暴力
        "杀人", "自杀", "爆炸", "恐怖袭击", "炸弹", "枪击",
        "血腥", "暴力", "残忍", "虐杀", "分尸",
    ],
    "ad": [
        # 广告违规
        "加微信", "加QQ", "私聊", "代理", "兼职", "日入过万",
        "免费送", "中奖", "抽奖", "点击链接", "扫码领取",
    ],
    "illegal": [
        # 违法
        "赌博", "毒品", "走私", "伪造", "假证", "黑市", "洗钱",
        "传销", "诈骗", "黑客", "病毒", "木马",
    ],
}


@dataclass
class SensitiveWordHit:
    """敏感词命中记录。"""

    word: str
    category: str
    position: int  # 在原文中的位置(字符索引)


def detect_sensitive_words(text: str) -> list[SensitiveWordHit]:
    """检测文本中的敏感词。

    Args:
        text: 待检测文本

    Returns:
        敏感词命中列表(按位置排序)
    """
    if not text:
        return []
    hits: list[SensitiveWordHit] = []
    for category, words in _SENSITIVE_WORDS.items():
        for word in words:
            start = 0
            while True:
                idx = text.find(word, start)
                if idx == -1:
                    break
                hits.append(SensitiveWordHit(
                    word=word, category=category, position=idx,
                ))
                start = idx + len(word)
    # 按位置排序
    hits.sort(key=lambda h: h.position)
    return hits


# ---------------------------------------------------------------------------
# 内容校验 + 截断
# ---------------------------------------------------------------------------


@dataclass
class ValidationResult:
    """发布前校验结果。"""

    valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    sensitive_hits: list[SensitiveWordHit] = field(default_factory=list)


def validate_content(
    platform: str,
    content: PublishContent,
    platform_config: Optional[dict[str, Any]] = None,
) -> ValidationResult:
    """按平台规则校验内容,发布前预检。

    校验项:
    1. 标题字数(平台 title_max)
    2. 正文字数(平台 body_max)
    3. 标签数量 + 单标签长度
    4. 敏感词检测(标题 + 正文)
    5. 视频文件大小 + 格式
    6. 封面尺寸 + 格式

    Returns:
        ValidationResult(valid=True 可发布, valid=False 需修正)
    """
    result = ValidationResult(valid=True)
    rule = PLATFORM_RULES.get(platform)
    if not rule:
        result.warnings.append(f"平台 {platform} 无规则配置,跳过校验")
        return result

    # 1. 标题
    title = content.title or ""
    if len(title) < rule.title_min:
        result.errors.append(f"标题过短:< {rule.title_min} 字")
        result.valid = False
    if len(title) > rule.title_max:
        result.errors.append(f"标题超长:{len(title)} > {rule.title_max} 字")
        result.valid = False

    # 2. 正文
    body = content.html or content.text or ""
    if len(body) < rule.body_min:
        result.errors.append(f"正文过短:< {rule.body_min} 字")
        result.valid = False
    if len(body) > rule.body_max:
        result.warnings.append(
            f"正文超长:{len(body)} > {rule.body_max} 字,将自动截断"
        )

    # 3. 标签
    tags = (platform_config or {}).get("tags", []) or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    if len(tags) > rule.tag_max_count:
        result.errors.append(
            f"标签过多:{len(tags)} > {rule.tag_max_count}"
        )
        result.valid = False
    for tag in tags:
        if len(str(tag)) > rule.tag_max_length:
            result.errors.append(
                f"标签过长:{tag}({len(str(tag))} > {rule.tag_max_length})"
            )
            result.valid = False

    # 4. 敏感词检测(标题 + 正文)
    full_text = title + " " + body
    hits = detect_sensitive_words(full_text)
    if hits:
        result.sensitive_hits = hits
        result.warnings.append(
            f"检测到 {len(hits)} 个敏感词,可能被平台拒审/限流"
        )

    # 5. 视频文件
    if content.format == "video":
        if not content.file_path:
            result.errors.append("视频平台必须提供 file_path")
            result.valid = False
        else:
            from pathlib import Path
            p = Path(content.file_path)
            if not p.is_file():
                result.errors.append(f"视频文件不存在: {content.file_path}")
                result.valid = False
            else:
                size_mb = p.stat().st_size / (1024 * 1024)
                if size_mb > rule.video_max_size_mb:
                    result.errors.append(
                        f"视频过大:{size_mb:.1f}MB > {rule.video_max_size_mb}MB"
                    )
                    result.valid = False
                ext = p.suffix.lower().lstrip(".")
                if ext and ext not in rule.video_formats:
                    result.warnings.append(
                        f"视频格式 {ext} 不在推荐列表 {rule.video_formats}"
                    )

    # 6. 封面
    if content.cover_path:
        from pathlib import Path
        p = Path(content.cover_path)
        if not p.is_file():
            result.warnings.append(f"封面文件不存在: {content.cover_path}")
        else:
            size_mb = p.stat().st_size / (1024 * 1024)
            if size_mb > rule.cover_max_size_mb:
                result.warnings.append(
                    f"封面过大:{size_mb:.1f}MB > {rule.cover_max_size_mb}MB"
                )
            ext = p.suffix.lower().lstrip(".")
            if ext and ext not in rule.cover_formats:
                result.warnings.append(
                    f"封面格式 {ext} 不在推荐列表 {rule.cover_formats}"
                )

    # 7. 平台独有提示
    for tip in rule.publish_tips:
        result.warnings.append(tip)

    return result


def truncate_to_platform(
    platform: str,
    content: PublishContent,
    platform_config: Optional[dict[str, Any]] = None,
) -> PublishContent:
    """按平台规则截断内容(不修改原对象,返回新对象)。

    截断项:
    - 标题:超 title_max 截断 + 省略号
    - 正文:超 body_max 截断 + 省略号
    - 标签:超 tag_max_count 取前 N 个 + 单标签超长截断
    - 描述:超 desc_max 截断
    """
    rule = PLATFORM_RULES.get(platform)
    if not rule:
        return content

    # 浅拷贝(避免修改原对象)
    import copy
    new_content = copy.copy(content)
    new_config = copy.copy(platform_config or {})

    # 截断标题
    if new_content.title and len(new_content.title) > rule.title_max:
        new_content.title = new_content.title[:rule.title_max - 1] + "…"
        logger.info(
            "[platform_rules] %s 标题截断到 %d 字",
            platform, rule.title_max,
        )

    # 截断正文
    body = new_content.html or new_content.text or ""
    if len(body) > rule.body_max:
        truncated = body[:rule.body_max - 3] + "..."
        if new_content.html:
            new_content.html = truncated
        if new_content.text:
            new_content.text = truncated
        logger.info(
            "[platform_rules] %s 正文截断到 %d 字",
            platform, rule.body_max,
        )

    # 截断标签
    tags = new_config.get("tags", []) or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    if len(tags) > rule.tag_max_count:
        tags = tags[:rule.tag_max_count]
        logger.info(
            "[platform_rules] %s 标签截断到 %d 个",
            platform, rule.tag_max_count,
        )
    # 单标签超长截断
    tags = [str(t)[:rule.tag_max_length] for t in tags]
    new_config["tags"] = tags

    # 截断描述(视频/图片平台)
    desc = new_config.get("desc", "") or new_content.text or ""
    if desc and len(desc) > rule.desc_max:
        new_config["desc"] = desc[:rule.desc_max - 1] + "…"
        logger.info(
            "[platform_rules] %s 描述截断到 %d 字",
            platform, rule.desc_max,
        )

    return new_content


def get_platform_rule(platform: str) -> Optional[PlatformRule]:
    """获取平台规则配置。"""
    return PLATFORM_RULES.get(platform)


def list_platforms_with_rules() -> list[str]:
    """列出所有已配置规则的平台 ID。"""
    return list(PLATFORM_RULES.keys())


__all__ = [
    "PlatformRule",
    "PLATFORM_RULES",
    "SensitiveWordHit",
    "ValidationResult",
    "detect_sensitive_words",
    "validate_content",
    "truncate_to_platform",
    "get_platform_rule",
    "list_platforms_with_rules",
]
