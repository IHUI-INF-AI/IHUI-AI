# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""OpenAI 文件参数重写 + 连接器暴露纯规则单测(第三十一批,2026-09-19)。

对标 codex-rs/core/src/mcp_openai_file.rs 与 connectors.rs 的纯算法/纯规则部分。
全部为离线纯函数,不触达服务端 API / 文件系统 / 鉴权。
"""

from typing import Any, Optional

import pytest

from app.core.mcp_openai_file import (
    AccessibleConnectorsCache,
    AccessibleConnectorsCacheKey,
    AppInfo,
    ApprovalsReviewer,
    McpToolInfo,
    PluginSourceContext,
    Requirements,
    ToolSuggestDiscoverable,
    UploadedFile,
    accessible_connectors_for_app_list,
    build_accessible_connectors_cache_key,
    build_uploaded_payload,
    check_file_size_limit,
    collect_accessible_connectors,
    compute_tool_suggest_connector_ids,
    infer_upload_file_name,
    is_synthetic_link_tool,
    resolve_approvals_reviewer,
    rewrite_argument_value_for_openai_files,
    rewrite_mcp_tool_arguments_for_openai_files,
    should_include_optional_field,
    with_app_plugin_sources,
)
from app.core.mcp_openai_file import DisabledTool as _DisabledTool
from app.core.mcp_openai_file import (
    _AppsConfig,
    _AppConfig,
    _LinkConfig,
)


# ===========================================================================
# 一、文件名推断
# ===========================================================================


def test_infer_upload_file_name_uses_basename():
    assert infer_upload_file_name("/tmp/codex-smoke-file.txt") == "codex-smoke-file.txt"
    assert infer_upload_file_name("dir/one.csv") == "one.csv"


def test_infer_upload_file_name_falls_back_to_last_segment():
    # 末段为空(以分隔符结尾)时,退到倒数非空段。
    assert infer_upload_file_name("/a/b/c/") == "c"
    assert infer_upload_file_name("a/b/") == "b"


def test_infer_upload_file_name_falls_back_to_file():
    assert infer_upload_file_name("") == "file"
    assert infer_upload_file_name("/") == "file"


def test_infer_upload_file_name_custom_segmenter():
    def seg(p: str) -> list[str]:
        return [s for s in p.split(":") if s]

    # 自定义分段器按 ":" 切分,末非空段即文件名(对标 Rust 可注入路径约定)。
    assert infer_upload_file_name("x:y:z", split_path_segments=seg) == "z"
    assert infer_upload_file_name("only", split_path_segments=seg) == "only"
    # 默认分段器按 / 与 \ 切分。
    assert infer_upload_file_name("a/b/c.txt") == "c.txt"
    assert infer_upload_file_name("dir/one.csv") == "one.csv"
    # 末段空 / 无段 → 兜底 "file"。
    assert infer_upload_file_name("", split_path_segments=seg) == "file"
    assert infer_upload_file_name("/") == "file"
    assert infer_upload_file_name("") == "file"


# ===========================================================================
# 二、大小上限
# ===========================================================================


def test_check_file_size_limit_within():
    assert check_file_size_limit(1000, limit_bytes=2000) is None


def test_check_file_size_limit_over():
    err = check_file_size_limit(2001, limit_bytes=2000)
    assert err is not None
    assert "too large" in err
    assert "2001" in err and "2000" in err


def test_check_file_size_limit_equal_boundary():
    # 等于上限不触发错误。
    assert check_file_size_limit(2000, limit_bytes=2000) is None


# ===========================================================================
# 三、可选字段与载荷构造
# ===========================================================================


def test_should_include_optional_field():
    assert should_include_optional_field(["mime_type", "file_name"], "mime_type")
    assert should_include_optional_field(["mime_type"], "file_name") is False


def test_build_uploaded_payload_minimal():
    uploaded = UploadedFile(download_url="https://x/d", file_id="f1")
    payload = build_uploaded_payload(uploaded, [])
    assert payload == {"download_url": "https://x/d", "file_id": "f1"}


def test_build_uploaded_payload_includes_declared_optionals():
    uploaded = UploadedFile(
        download_url="https://x/d", file_id="f1", mime_type="text/csv",
        file_name="one.csv",
    )
    payload = build_uploaded_payload(uploaded, ["mime_type", "file_name"])
    assert payload == {
        "download_url": "https://x/d",
        "file_id": "f1",
        "mime_type": "text/csv",
        "file_name": "one.csv",
    }


def test_build_uploaded_payload_omits_undeclared_and_none_mime():
    uploaded = UploadedFile(
        download_url="https://x/d", file_id="f1", mime_type="text/csv",
        file_name="one.csv",
    )
    # 未声明 mime_type,即使有值也不纳入;file_name 未声明也不纳入。
    payload = build_uploaded_payload(uploaded, [])
    assert "mime_type" not in payload
    assert "file_name" not in payload
    # 声明 mime_type 但上传结果 mime 为 None → 不纳入。
    uploaded2 = UploadedFile(download_url="u", file_id="f2", mime_type=None,
                             file_name="two.csv")
    payload2 = build_uploaded_payload(uploaded2, ["mime_type", "file_name"])
    assert "mime_type" not in payload2
    assert payload2["file_name"] == "two.csv"


# ===========================================================================
# 四、参数重写(含伪 Uploader)
# ===========================================================================


class _FakeUploader:
    """伪上传器:记录调用并返回确定性 UploadedFile。"""

    def __init__(self) -> None:
        self.calls: list[tuple[str, Optional[int], str]] = []

    async def __call__(
        self, field_name: str, index: Optional[int], file_path: str
    ) -> UploadedFile:
        self.calls.append((field_name, index, file_path))
        return UploadedFile(
            download_url=f"https://dl/{file_path}",
            file_id=f"id-{file_path}",
            mime_type="text/csv",
            file_name=file_path,
        )


async def test_rewrite_argument_value_string():
    up = _FakeUploader()
    out = await rewrite_argument_value_for_openai_files(
        "a.csv", "file", ["mime_type"], up
    )
    assert out == {
        "download_url": "https://dl/a.csv",
        "file_id": "id-a.csv",
        "mime_type": "text/csv",
    }
    assert up.calls == [("file", None, "a.csv")]


async def test_rewrite_argument_value_array():
    up = _FakeUploader()
    out = await rewrite_argument_value_for_openai_files(
        ["one.csv", "two.csv"], "files", [], up
    )
    assert out == [
        {"download_url": "https://dl/one.csv", "file_id": "id-one.csv"},
        {"download_url": "https://dl/two.csv", "file_id": "id-two.csv"},
    ]
    assert up.calls == [
        ("files", 0, "one.csv"),
        ("files", 1, "two.csv"),
    ]


async def test_rewrite_argument_value_non_string_returns_none():
    up = _FakeUploader()
    assert await rewrite_argument_value_for_openai_files(123, "f", [], up) is None
    # 数组内含非字符串 → 整体返回 None(不上传任何一项)。
    assert await rewrite_argument_value_for_openai_files([1, 2], "f", [], up) is None


async def test_rewrite_arguments_no_declared_fields_returns_original():
    args = {"file": "/x/a.csv", "other": 1}
    out = await rewrite_mcp_tool_arguments_for_openai_files(args, None, _FakeUploader())
    assert out is args  # 原样返回(同一引用)


async def test_rewrite_arguments_none_args_returns_none():
    out = await rewrite_mcp_tool_arguments_for_openai_files(
        None, {"file": []}, _FakeUploader()
    )
    assert out is None


async def test_rewrite_arguments_non_dict_returns_original():
    out = await rewrite_mcp_tool_arguments_for_openai_files(
        "not-a-dict", {"file": []}, _FakeUploader()
    )
    assert out == "not-a-dict"


async def test_rewrite_arguments_unchanged_returns_original():
    args = {"unrelated": "value", "num": 5}
    out = await rewrite_mcp_tool_arguments_for_openai_files(
        args, {"file": []}, _FakeUploader()
    )
    assert out is args  # 没有声明字段命中 → 原样返回


async def test_rewrite_arguments_rewrites_declared_field():
    args = {"file": "a.csv", "keep": "x"}
    out = await rewrite_mcp_tool_arguments_for_openai_files(
        args, {"file": ["mime_type", "file_name"]}, _FakeUploader()
    )
    assert out is not args
    assert out["keep"] == "x"
    assert out["file"] == {
        "download_url": "https://dl/a.csv",
        "file_id": "id-a.csv",
        "mime_type": "text/csv",
        "file_name": "a.csv",
    }


# ===========================================================================
# 五、connectors 纯规则
# ===========================================================================


def test_compute_tool_suggest_connector_ids():
    discoverables = [
        ToolSuggestDiscoverable(kind="connector", id="c1"),
        ToolSuggestDiscoverable(kind="connector", id="c2"),
        ToolSuggestDiscoverable(kind="plugin", id="p1"),  # 非 connector 忽略
    ]
    disabled = [
        _DisabledTool(kind="connector", id="c2"),
        _DisabledTool(kind="plugin", id="c1"),  # 非 connector 忽略
    ]
    result = compute_tool_suggest_connector_ids(
        discoverables, disabled, ["c0", "c2"]
    )
    assert result == {"c0", "c1"}


def test_is_synthetic_link_tool():
    synthetic = McpToolInfo(
        server_name="codex-apps", connector_id="c",
        meta={"codex_apps": {"synthetic_link": True}},
    )
    real = McpToolInfo(
        server_name="codex-apps", connector_id="c",
        meta={"codex_apps": {"synthetic_link": False}},
    )
    no_meta = McpToolInfo(server_name="codex-apps", connector_id="c")
    assert is_synthetic_link_tool(synthetic) is True
    assert is_synthetic_link_tool(real) is False
    assert is_synthetic_link_tool(no_meta) is False


def test_collect_accessible_connectors_groups_and_filters():
    tools = [
        McpToolInfo(server_name="other", connector_id="x"),  # 非目标 server 忽略
        McpToolInfo(server_name="codex-apps", connector_id=None),  # 无 connector_id 忽略
        McpToolInfo(
            server_name="codex-apps", connector_id="c1",
            connector_name="App1", namespace_description="desc1",
            plugin_display_names=["P1"],
        ),
        McpToolInfo(
            server_name="codex-apps", connector_id="c1",
            connector_name="App1b", namespace_description="desc1b",
            plugin_display_names=["P2"],
        ),
        McpToolInfo(
            server_name="codex-apps", connector_id="c2",
            connector_name="App2", namespace_description="desc2",
        ),
    ]
    apps = collect_accessible_connectors(tools)
    assert [a.id for a in apps] == ["c1", "c2"]
    c1 = next(a for a in apps if a.id == "c1")
    assert c1.name == "App1"  # 首见优先
    assert c1.description == "desc1"
    assert set(c1.plugin_display_names) == {"P1", "P2"}  # 去重合并


def test_accessible_connectors_for_app_list_excludes_synthetic():
    tools = [
        McpToolInfo(
            server_name="codex-apps", connector_id="c1",
            meta={"codex_apps": {"synthetic_link": True}},
        ),
        McpToolInfo(server_name="codex-apps", connector_id="c2"),
    ]
    apps = accessible_connectors_for_app_list(tools)
    assert [a.id for a in apps] == ["c2"]


def test_resolve_approvals_reviewer_auto_review_model():
    req = Requirements(auto_review_models=frozenset({"gpt-x"}))
    out = resolve_approvals_reviewer(
        req, ApprovalsReviewer.ALWAYS, "gpt-x", None, "codex-apps", "c", None
    )
    assert out == ApprovalsReviewer.AUTO_REVIEW


def test_resolve_approvals_reviewer_link_app_default_chain():
    apps_config = _AppsConfig(
        apps={"c": _AppConfig(approvals_reviewer=ApprovalsReviewer.ALWAYS,
                              links={"L": _LinkConfig(approvals_reviewer=ApprovalsReviewer.NEVER)})},
        default=_AppConfig(approvals_reviewer=ApprovalsReviewer.ALWAYS),
    )
    # link 优先
    out = resolve_approvals_reviewer(
        Requirements(), ApprovalsReviewer.UNSPECIFIED, None, apps_config,
        "codex-apps", "c", "L",
    )
    assert out == ApprovalsReviewer.NEVER
    # 无 link → app
    out = resolve_approvals_reviewer(
        Requirements(), ApprovalsReviewer.UNSPECIFIED, None, apps_config,
        "codex-apps", "c", None,
    )
    assert out == ApprovalsReviewer.ALWAYS
    # 非 codex-apps server → 回退默认
    out = resolve_approvals_reviewer(
        Requirements(), ApprovalsReviewer.ALWAYS, None, apps_config,
        "other-server", "c", None,
    )
    assert out == ApprovalsReviewer.ALWAYS


def test_resolve_approvals_reviewer_can_set_blocked():
    # 配置约束 NEVER 档位上限 → 不允许设置 ALWAYS。
    apps_config = _AppsConfig(
        apps={"c": _AppConfig(approvals_reviewer=ApprovalsReviewer.ALWAYS)},
    )
    req = Requirements(approvals_reviewer=ApprovalsReviewer.NEVER)
    out = resolve_approvals_reviewer(
        req, ApprovalsReviewer.UNSPECIFIED, None, apps_config,
        "codex-apps", "c", None,
    )
    # can_set(ALWAYS) 被 NEVER 约束挡下 → 回退默认
    assert out == ApprovalsReviewer.UNSPECIFIED


def test_resolve_approvals_reviewer_default_fallback():
    # apps 配置为空且非强制模型 → 回退默认
    out = resolve_approvals_reviewer(
        Requirements(), ApprovalsReviewer.ALWAYS, None, None,
        "codex-apps", "c", None,
    )
    assert out == ApprovalsReviewer.ALWAYS


def test_with_app_plugin_sources():
    connectors = [AppInfo(id="c1"), AppInfo(id="c2")]
    ctx = PluginSourceContext(_map={"c1": ["P1", "P2"]})
    result = with_app_plugin_sources(connectors, ctx)
    assert result[0].plugin_display_names == ["P1", "P2"]
    assert result[1].plugin_display_names == []


def test_cache_key_and_ttl():
    key = build_accessible_connectors_cache_key(
        "https://base", {"account_id": "a1", "chatgpt_user_id": "u1",
                         "is_workspace_account": True},
    )
    assert key == AccessibleConnectorsCacheKey(
        chatgpt_base_url="https://base", account_id="a1",
        chatgpt_user_id="u1", is_workspace_account=True,
    )
    # 缺失字段兜底
    key2 = build_accessible_connectors_cache_key("https://base", None)
    assert key2.account_id is None and key2.is_workspace_account is False


def test_accessible_connectors_cache_hit_miss_expiry():
    cache = AccessibleConnectorsCache(ttl_seconds=10)
    key = AccessibleConnectorsCacheKey(chatgpt_base_url="b")
    assert cache.read(key, now=100.0) is None  # 空
    cache.write(key, [AppInfo(id="c1")], now=100.0)
    hit = cache.read(key, now=105.0)
    assert hit is not None and hit[0].id == "c1"
    # 过期
    assert cache.read(key, now=111.0) is None
    # 键不匹配
    cache.write(key, [AppInfo(id="c1")], now=200.0)
    other = AccessibleConnectorsCacheKey(chatgpt_base_url="different")
    assert cache.read(other, now=205.0) is None
    # 命中返回副本:外部修改不影响缓存
    hit2 = cache.read(key, now=205.0)
    assert hit2 is not None
    hit2[0].id = "mutated"
    hit3 = cache.read(key, now=206.0)
    assert hit3 is not None and hit3[0].id == "c1"
