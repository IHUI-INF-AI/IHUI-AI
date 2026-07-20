"""多平台发布适配器基类。

定义统一的内容模型(PublishContent)、发布结果(PublishResult)
和所有平台适配器必须实现的接口(BasePlatformAdapter)。

设计原则:
1. 适配器只负责单平台发布逻辑,不处理调度/重试/通知(由 scheduler 统一编排)。
2. verify_credentials 必须真实调用平台 API 验证(不抛异常,返回 (ok, msg) 元组)。
3. publish 失败时返回 PublishResult(success=False, error_message=...),不抛异常。
4. 凭证通过 credentials_crypto 加密后存 DB,适配器拿到的是已解密的 dict。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class PublishResult:
    """单平台发布结果。

    success=True 时,published_url / platform_content_id 至少一个非空。
    success=False 时,error_message 必填。
    """

    success: bool
    platform: str
    published_url: Optional[str] = None
    platform_content_id: Optional[str] = None
    error_message: Optional[str] = None
    duration_ms: int = 0
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class PublishContent:
    """统一内容模型。

    format: 'md' | 'docx' | 'html' | 'pdf' | 'image' | 'video'
    text:   md / html 文本内容(md/docx/html/pdf 解析后会填充)
    file_path: docx/pdf/image/video 原始文件路径
    cover_path: 封面图(可选)
    html:   解析后的 HTML(供发布用,由 content_parser 填充)
    images: 内容中引用的图片路径列表(供上传到平台图床)
    """

    format: str
    title: str
    text: Optional[str] = None
    file_path: Optional[str] = None
    cover_path: Optional[str] = None
    html: Optional[str] = None
    images: list[str] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)


class BasePlatformAdapter(ABC):
    """平台适配器基类。

    每个平台适配器继承本类并实现 verify_credentials + publish。
    类属性 platform_id / platform_name / supported_formats / requires_credentials
    供路由层列出平台元数据。
    """

    platform_id: str = ""
    platform_name: str = ""
    supported_formats: list[str] = []  # ['md', 'html', 'docx', 'pdf', 'image', 'video']
    requires_credentials: list[str] = []  # ['token'] / ['app_id', 'app_secret'] / ['cookie']
    needs_browser: bool = False  # Playwright 适配器为 True

    @abstractmethod
    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        """验证凭证是否有效。

        Returns:
            (是否有效, 结果信息/错误信息)
        """

    @abstractmethod
    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        """发布内容到平台。

        Args:
            content: 已解析的统一内容模型(html 字段已由 content_parser 填充)
            credentials: 已解密的凭证 dict
            platform_config: 平台特定配置(如分类、标签、可见性)

        Returns:
            PublishResult(success=True/False, ...)
        """


def list_all_adapter_classes() -> list[type[BasePlatformAdapter]]:
    """枚举所有已注册的适配器类(供 /platforms 端点使用)。

    通过延迟 import 避免循环依赖,且 Playwright 适配器 import 失败时跳过。
    """
    classes: list[type[BasePlatformAdapter]] = []
    # 真实可调通适配器(基于 HTTP API)
    from .adapters.wordpress import WordPressAdapter
    from .adapters.medium import MediumAdapter
    from .adapters.youtube import YouTubeAdapter
    from .adapters.bilibili import BilibiliAdapter
    from .adapters.wechat import WechatAdapter
    from .adapters.toutiao import ToutiaoAdapter
    from .adapters.douyin import DouyinAdapter
    from .adapters.kuaishou import KuaishouAdapter
    from .adapters.weibo import WeiboAdapter

    classes.extend([
        WordPressAdapter, MediumAdapter, YouTubeAdapter,
        BilibiliAdapter, WechatAdapter, ToutiaoAdapter,
        DouyinAdapter, KuaishouAdapter, WeiboAdapter,
    ])

    # Playwright 适配器(import 失败说明环境缺依赖,跳过注册)
    for mod_name, cls_name in [
        ("zhihu", "ZhihuAdapter"),
        ("csdn", "CsdnAdapter"),
        ("juejin", "JuejinAdapter"),
        ("xiaohongshu", "XiaohongshuAdapter"),
        ("shipinhao", "ShipinhaoAdapter"),
    ]:
        try:
            mod = __import__(f"app.services.publish.adapters.{mod_name}", fromlist=[cls_name])
            cls = getattr(mod, cls_name)
            classes.append(cls)
        except Exception:
            # Playwright 未安装时跳过,不影响其他适配器
            continue

    return classes


def get_adapter(platform_id: str) -> Optional[BasePlatformAdapter]:
    """按 platform_id 获取适配器实例。未找到返回 None。"""
    for cls in list_all_adapter_classes():
        if cls.platform_id == platform_id:
            try:
                return cls()
            except Exception:
                return None
    return None
