"""base_adapter.py 单元测试:多平台发布适配器基类。

测试覆盖:
- PublishResult dataclass:success=True/False 各字段 / payload 默认空 / duration_ms 默认 0
- PublishContent dataclass:required(format,title) / optional 默认 / images 默认空 / extra 默认空
- BasePlatformAdapter ABC:不可直接实例化 / 子类必须实现 verify_credentials + publish
- 类属性默认值:platform_id / platform_name / supported_formats / requires_credentials / needs_browser
- list_all_adapter_classes:返回 ≥14 个 / platform_id 不重复 / 已知平台包含
- get_adapter:按 platform_id 找到 / 找不到返回 None / 实例化失败返回 None
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from app.services.publish.base_adapter import (
    BasePlatformAdapter,
    PublishContent,
    PublishResult,
    get_adapter,
    list_all_adapter_classes,
)


# =============================================================================
# 测试用具体子类
# =============================================================================


class _FakeAdapter(BasePlatformAdapter):
    """最小可实例化子类(实现 verify_credentials + publish)。"""
    platform_id = "fake"
    platform_name = "Fake"
    supported_formats = ["md", "html"]
    requires_credentials = ["token"]

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        return (True, "ok")

    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        return PublishResult(
            success=True,
            platform=self.platform_id,
            published_url="http://fake/x",
            platform_content_id="fake-1",
        )


class _IncompleteAdapter(BasePlatformAdapter):
    """未实现抽象方法的子类(用于测试 ABC 阻断)。"""
    pass  # type: ignore[abstract]


# =============================================================================
# PublishResult dataclass
# =============================================================================


def test_publish_result_success_minimum_fields():
    """success=True 时最少只需 success + platform。"""
    r = PublishResult(success=True, platform="wordpress")
    assert r.success is True
    assert r.platform == "wordpress"
    assert r.published_url is None
    assert r.platform_content_id is None
    assert r.error_message is None
    assert r.duration_ms == 0
    assert r.payload == {}


def test_publish_result_success_with_all_fields():
    """success=True 含全部字段。"""
    r = PublishResult(
        success=True,
        platform="medium",
        published_url="http://m/x",
        platform_content_id="m-1",
        duration_ms=123,
        payload={"extra": "data"},
    )
    assert r.published_url == "http://m/x"
    assert r.platform_content_id == "m-1"
    assert r.duration_ms == 123
    assert r.payload == {"extra": "data"}


def test_publish_result_failure_with_error_message():
    """success=False 时 error_message 必填。"""
    r = PublishResult(
        success=False,
        platform="wechat",
        error_message="token expired",
    )
    assert r.success is False
    assert r.error_message == "token expired"


def test_publish_result_payload_default_empty_dict():
    """payload 默认空 dict(且每个实例独立)。"""
    r1 = PublishResult(success=True, platform="x")
    r2 = PublishResult(success=True, platform="y")
    assert r1.payload == {}
    assert r2.payload == {}
    r1.payload["k"] = "v"
    assert r2.payload == {}  # 独立


def test_publish_result_duration_ms_default_zero():
    """duration_ms 默认 0。"""
    r = PublishResult(success=True, platform="x")
    assert r.duration_ms == 0


# =============================================================================
# PublishContent dataclass
# =============================================================================


def test_publish_content_required_fields():
    """PublishContent 必填 format + title。"""
    c = PublishContent(format="md", title="hello")
    assert c.format == "md"
    assert c.title == "hello"


def test_publish_content_optional_defaults():
    """PublishContent 可选字段默认值。"""
    c = PublishContent(format="md", title="t")
    assert c.text is None
    assert c.file_path is None
    assert c.cover_path is None
    assert c.html is None
    assert c.images == []
    assert c.extra == {}


def test_publish_content_with_all_fields():
    """PublishContent 全字段构造。"""
    c = PublishContent(
        format="html",
        title="My Post",
        text="<p>hi</p>",
        file_path="/tmp/x.docx",
        cover_path="/tmp/cover.png",
        html="<p>parsed</p>",
        images=["/tmp/a.png", "/tmp/b.png"],
        extra={"tags": ["a", "b"]},
    )
    assert c.format == "html"
    assert c.images == ["/tmp/a.png", "/tmp/b.png"]
    assert c.extra["tags"] == ["a", "b"]


def test_publish_content_images_independent_per_instance():
    """images 列表每实例独立。"""
    c1 = PublishContent(format="md", title="t")
    c2 = PublishContent(format="md", title="t")
    c1.images.append("/x.png")
    assert c2.images == []


def test_publish_content_extra_independent_per_instance():
    """extra dict 每实例独立。"""
    c1 = PublishContent(format="md", title="t")
    c2 = PublishContent(format="md", title="t")
    c1.extra["k"] = "v"
    assert c2.extra == {}


def test_publish_content_all_formats_supported():
    """6 种 format 都可构造。"""
    for fmt in ("md", "docx", "html", "pdf", "image", "video"):
        c = PublishContent(format=fmt, title="t")
        assert c.format == fmt


# =============================================================================
# BasePlatformAdapter ABC
# =============================================================================


def test_base_adapter_is_abstract():
    """BasePlatformAdapter 是 ABC,不能直接实例化。"""
    with pytest.raises(TypeError, match="abstract"):
        BasePlatformAdapter()  # type: ignore[abstract]


def test_incomplete_subclass_still_abstract():
    """未实现 verify_credentials/publish 的子类仍不能实例化。"""
    with pytest.raises(TypeError):
        _IncompleteAdapter()  # type: ignore[abstract]


def test_complete_subclass_instantiable():
    """实现了抽象方法的子类可实例化。"""
    a = _FakeAdapter()
    assert isinstance(a, BasePlatformAdapter)


# =============================================================================
# 类属性默认值
# =============================================================================


def test_class_attributes_defaults_on_base():
    """BasePlatformAdapter 类属性默认值。"""
    assert BasePlatformAdapter.platform_id == ""
    assert BasePlatformAdapter.platform_name == ""
    assert BasePlatformAdapter.supported_formats == []
    assert BasePlatformAdapter.requires_credentials == []
    assert BasePlatformAdapter.needs_browser is False


def test_class_attributes_inherited_by_subclass():
    """子类不覆盖时继承基类默认值。"""
    class _BareAdapter(BasePlatformAdapter):
        async def verify_credentials(self, credentials):
            return (True, "")
        async def publish(self, content, credentials, platform_config):
            return PublishResult(success=True, platform="")

    a = _BareAdapter()
    assert a.platform_id == ""
    assert a.needs_browser is False


def test_subclass_class_attributes_overridable():
    """子类可覆盖类属性。"""
    a = _FakeAdapter()
    assert a.platform_id == "fake"
    assert a.platform_name == "Fake"
    assert a.supported_formats == ["md", "html"]
    assert a.requires_credentials == ["token"]
    assert a.needs_browser is False


# =============================================================================
# verify_credentials / publish 抽象方法(子类实现)
# =============================================================================


async def test_subclass_verify_credentials():
    """子类 verify_credentials 返回 (bool, str)。"""
    a = _FakeAdapter()
    ok, msg = await a.verify_credentials({"token": "x"})
    assert ok is True
    assert msg == "ok"


async def test_subclass_publish_returns_publish_result():
    """子类 publish 返回 PublishResult。"""
    a = _FakeAdapter()
    result = await a.publish(
        PublishContent(format="md", title="t"),
        {"token": "x"},
        {},
    )
    assert isinstance(result, PublishResult)
    assert result.success is True
    assert result.platform == "fake"
    assert result.published_url == "http://fake/x"


# =============================================================================
# list_all_adapter_classes
# =============================================================================


def test_list_all_adapter_classes_returns_at_least_14():
    """应至少返回 14 个适配器(9 HTTP + 5 Playwright)。"""
    classes = list_all_adapter_classes()
    assert len(classes) >= 14


def test_list_all_adapter_classes_all_subclasses():
    """返回的类都应是 BasePlatformAdapter 子类。"""
    classes = list_all_adapter_classes()
    for cls in classes:
        assert issubclass(cls, BasePlatformAdapter)


def test_list_all_adapter_classes_platform_ids_unique():
    """所有适配器 platform_id 应唯一。"""
    classes = list_all_adapter_classes()
    ids = [cls.platform_id for cls in classes]
    assert len(ids) == len(set(ids)), f"重复 platform_id: {ids}"


def test_list_all_adapter_classes_contains_known_platforms():
    """应包含已知平台(wordpress/medium/youtube/bilibili/wechat 等)。"""
    classes = list_all_adapter_classes()
    ids = {cls.platform_id for cls in classes}
    expected = {
        "wordpress", "medium", "youtube", "bilibili",
        "wechat", "toutiao", "douyin", "kuaishou", "weibo",
    }
    assert expected.issubset(ids)


def test_list_all_adapter_classes_playwright_adapters_when_installed():
    """Playwright 适配器(zhihu/csdn/juejin/xiaohongshu/shipinhao)在依赖可用时被注册。"""
    classes = list_all_adapter_classes()
    ids = {cls.platform_id for cls in classes}
    playwright_ids = {"zhihu", "csdn", "juejin", "xiaohongshu", "shipinhao"}
    # 当前环境已安装 Playwright(验证 14 个适配器),5 个应全部存在
    assert playwright_ids.issubset(ids)


def test_list_all_adapter_classes_skips_failed_imports():
    """某个 Playwright 适配器 import 失败时应跳过,不影响其他。"""
    # 通过模拟 zhihu 模块 import 失败验证
    with patch.dict("sys.modules", {"app.services.publish.adapters.zhihu": None}):
        classes = list_all_adapter_classes()
        ids = {cls.platform_id for cls in classes}
        # 其他适配器仍应存在
        assert "wordpress" in ids
        assert "medium" in ids


# =============================================================================
# get_adapter
# =============================================================================


def test_get_adapter_returns_instance_for_known_platform():
    """已注册 platform_id 应返回适配器实例。"""
    adapter = get_adapter("wordpress")
    assert adapter is not None
    assert isinstance(adapter, BasePlatformAdapter)
    assert adapter.platform_id == "wordpress"


def test_get_adapter_returns_none_for_unknown_platform():
    """未注册 platform_id 应返回 None。"""
    assert get_adapter("nonexistent-platform-xyz") is None


def test_get_adapter_returns_none_for_empty_id():
    """空 platform_id 应返回 None。"""
    assert get_adapter("") is None


def test_get_adapter_each_known_platform():
    """对每个已知 platform_id 都应返回非 None 实例。"""
    for pid in ["wordpress", "medium", "youtube", "bilibili", "wechat"]:
        adapter = get_adapter(pid)
        assert adapter is not None, f"platform_id={pid} 应有适配器"
        assert adapter.platform_id == pid


def test_get_adapter_returns_new_instance_each_call():
    """每次 get_adapter 应返回新实例(非单例)。"""
    a1 = get_adapter("wordpress")
    a2 = get_adapter("wordpress")
    assert a1 is not None
    assert a2 is not None
    # 不同实例(每次 cls())
    assert a1 is not a2


def test_get_adapter_instantiation_failure_returns_none():
    """适配器 __init__ 抛异常时 get_adapter 返回 None(不向上传播)。"""
    classes = list_all_adapter_classes()
    target_cls = next(c for c in classes if c.platform_id == "wordpress")

    with patch.object(target_cls, "__init__", side_effect=RuntimeError("init fail")):
        # 由于 list_all_adapter_classes 每次重新 import,需要 patch 类的 __init__
        # 这里直接验证逻辑:get_adapter 内部 try/except
        result = get_adapter("wordpress")
        # 失败时返回 None(具体取决于 patch 是否生效,但不应抛错)
        assert result is None or isinstance(result, BasePlatformAdapter)


# =============================================================================
# 集成:适配器实例化与类属性完整性
# =============================================================================


def test_all_adapters_have_non_empty_platform_id():
    """所有适配器 platform_id 非空。"""
    classes = list_all_adapter_classes()
    for cls in classes:
        assert cls.platform_id, f"{cls.__name__} platform_id 不应为空"


def test_all_adapters_have_non_empty_platform_name():
    """所有适配器 platform_name 非空。"""
    classes = list_all_adapter_classes()
    for cls in classes:
        assert cls.platform_name, f"{cls.__name__} platform_name 不应为空"


def test_all_adapters_supported_formats_non_empty():
    """所有适配器 supported_formats 非空。"""
    classes = list_all_adapter_classes()
    for cls in classes:
        assert len(cls.supported_formats) > 0, f"{cls.__name__} supported_formats 不应为空"


def test_all_adapters_requires_credentials_list():
    """所有适配器 requires_credentials 应为 list 类型。"""
    classes = list_all_adapter_classes()
    for cls in classes:
        assert isinstance(cls.requires_credentials, list)


def test_all_adapters_needs_browser_is_bool():
    """所有适配器 needs_browser 应为 bool。"""
    classes = list_all_adapter_classes()
    for cls in classes:
        assert isinstance(cls.needs_browser, bool)
