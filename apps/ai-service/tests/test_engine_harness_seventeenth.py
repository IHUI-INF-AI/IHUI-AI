# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""Harness provider 级韧性与请求头(2026-09-19 第十七批)单测。

对标 Codex ModelProviderInfo:
- request_max_retries:HTTP 失败重试按 provider 声明(此前 llm_gateway 全局
  硬编码 num_retries=2,排队型与低延迟型被一刀切)
- stream_idle_timeout_ms:流式空闲超时
- env_http_headers:请求头的值取自环境变量,未设置/空则整个头不发
另含安全闸门:cap_to_dict 不得把表头字段下发给客户端(/llm/models 会返回)。
"""



from app.core.provider_caps import (
    ProviderCap,
    apply_provider_headers,
    apply_provider_overrides,
    cap_to_dict,
    get_provider_cap,
    resolve_provider_headers,
)


def test_new_knobs_have_safe_defaults():
    """默认 cap:重试沿用历史值 2,流式空闲超时不主动注入。"""
    cap = ProviderCap()
    assert cap.request_max_retries == 2
    assert cap.stream_idle_timeout_s is None
    assert cap.extra_headers is None and cap.env_headers is None


def test_per_provider_knobs_are_differentiated():
    """排队型放宽、低延迟/本地型收紧 —— 不再一刀切。"""
    assert get_provider_cap("nvidia_nim").request_max_retries == 3
    assert get_provider_cap("nvidia_nim").stream_idle_timeout_s == 180
    assert get_provider_cap("groq").request_max_retries == 1
    assert get_provider_cap("ollama").request_max_retries == 0
    assert get_provider_cap("token6688").stream_idle_timeout_s == 180


def test_apply_overrides_fills_and_respects_explicit_values():
    kwargs: dict = {}
    apply_provider_overrides(kwargs, "nvidia_nim")
    assert kwargs["num_retries"] == 3
    assert kwargs["stream_timeout"] == 180

    explicit = {"num_retries": 9, "stream_timeout": 5}
    apply_provider_overrides(explicit, "nvidia_nim")
    assert explicit == {"num_retries": 9, "stream_timeout": 5}

    # 未声明流式空闲超时的 provider 不注入该键(避免给 litellm 传 None)
    groq_kwargs: dict = {}
    apply_provider_overrides(groq_kwargs, "groq")
    assert "stream_timeout" not in groq_kwargs


def test_env_headers_resolved_at_runtime(monkeypatch):
    """env_headers 的值是环境变量名:设置了才发,空值整个头不发。"""
    monkeypatch.delenv("OPENROUTER_HTTP_REFERER", raising=False)
    monkeypatch.delenv("OPENROUTER_APP_TITLE", raising=False)
    assert resolve_provider_headers("openrouter") == {}

    monkeypatch.setenv("OPENROUTER_HTTP_REFERER", "https://aizhs.top")
    monkeypatch.setenv("OPENROUTER_APP_TITLE", "IHUI-AI")
    assert resolve_provider_headers("openrouter") == {
        "HTTP-Referer": "https://aizhs.top",
        "X-Title": "IHUI-AI",
    }

    # 空串视为未配置(不发空头)
    monkeypatch.setenv("OPENROUTER_APP_TITLE", "")
    assert resolve_provider_headers("openrouter") == {
        "HTTP-Referer": "https://aizhs.top",
    }


def test_header_merge_precedence(monkeypatch):
    """固定头 < env 头 < 调用方显式头。"""
    from app.core import provider_caps as pc

    fake = ProviderCap(
        extra_headers={"X-Fixed": "1", "X-Both": "fixed"},
        env_headers={"X-Env": "IHUI_TEST_ENV_HEADER", "X-Both": "IHUI_TEST_ENV_HEADER"},
    )
    monkeypatch.setitem(pc.PROVIDER_CAPS, "unit_test_provider", fake)
    monkeypatch.setenv("IHUI_TEST_ENV_HEADER", "from-env")

    headers = resolve_provider_headers("unit_test_provider")
    assert headers["X-Fixed"] == "1"
    assert headers["X-Env"] == "from-env"
    assert headers["X-Both"] == "from-env"  # env 覆盖固定头

    kwargs = {"extra_headers": {"X-Both": "from-caller"}}
    apply_provider_headers(kwargs, "unit_test_provider")
    assert kwargs["extra_headers"]["X-Both"] == "from-caller"  # 调用方最优先
    assert kwargs["extra_headers"]["X-Fixed"] == "1"  # 其余保留


def test_unknown_provider_is_noop():
    kwargs: dict = {}
    apply_provider_overrides(kwargs, "no_such_provider")
    apply_provider_headers(kwargs, "no_such_provider")
    assert kwargs == {"num_retries": 2}
    assert resolve_provider_headers(None) == {}


def test_cap_to_dict_never_leaks_headers_to_clients(monkeypatch):
    """/llm/models 会把 caps 下发给前端:表头字段必须被剔除。"""
    from app.core import provider_caps as pc

    monkeypatch.setitem(
        pc.PROVIDER_CAPS,
        "leaky_provider",
        ProviderCap(
            extra_headers={"Authorization": "Bearer internal"},
            env_headers={"X-Secret": "IHUI_INTERNAL_SECRET"},
        ),
    )
    data = cap_to_dict(get_provider_cap("leaky_provider"))
    assert "extra_headers" not in data
    assert "env_headers" not in data
    assert "Bearer internal" not in str(data)
    # 公开旋钮仍在(前端可见无害)
    assert "request_max_retries" in data
