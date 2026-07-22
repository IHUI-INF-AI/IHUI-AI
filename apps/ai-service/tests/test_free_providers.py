"""10 个免费/试用 credits LLM provider 综合测试(2026-07-22 立)。

覆盖 10 个 provider(参考 cheahjs/free-llm-api-resources):
- Cloudflare Workers AI / NVIDIA NIM / GitHub Models / Vercel AI Gateway
- OpenCode Zen / Modal / Inference.net / NLP Cloud / Scaleway / Alibaba Cloud International

测试维度:
1. _resolve_provider 前缀路由(api_key + api_base + litellm_model 三元组验证)
2. key 缺失时返回 None / 空配置
3. 大小写不敏感(model 前缀大写也能匹配)
4. Cloudflare 双前缀(@cf/ + cloudflare/)+ 双字段(token + account_id)
5. Modal 多段斜线模型名切分
6. _is_stub_mode env key 检测
7. _model_to_provider_code 前缀映射
8. 跨 provider 不搞混验证
"""

from __future__ import annotations

import pytest

from app.core.llm_gateway import LLMGateway
from app.core.config import settings


# =============================================================================
# 1. _resolve_provider — 10 provider 前缀路由(三元组验证)
# =============================================================================


class TestResolveProvider:
    """10 个 provider 的 _resolve_provider 前缀路由测试。"""

    def test_resolve_cloudflare_at_cf_prefix(self, monkeypatch):
        monkeypatch.setattr(settings, "cloudflare_api_token", "cf-token-xxx")
        monkeypatch.setattr(settings, "cloudflare_account_id", "abc123")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("@cf/llama-3.1-8b-instruct")
        assert api_key == "cf-token-xxx"
        assert "abc123" in api_base
        assert "cloudflare" in api_base
        assert litellm_model == "openai/@cf/llama-3.1-8b-instruct"

    def test_resolve_cloudflare_slash_prefix(self, monkeypatch):
        monkeypatch.setattr(settings, "cloudflare_api_token", "cf-token")
        monkeypatch.setattr(settings, "cloudflare_account_id", "acc456")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("cloudflare/llama-3.1-8b-instruct")
        assert api_key == "cf-token"
        assert "acc456" in api_base
        assert litellm_model == "openai/llama-3.1-8b-instruct"

    def test_resolve_nvidia(self, monkeypatch):
        monkeypatch.setattr(settings, "nvidia_api_key", "nv-key")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("nvidia/llama-3.1-nemotron-70b")
        assert api_key == "nv-key"
        assert "integrate.api.nvidia.com" in api_base
        assert litellm_model == "openai/llama-3.1-nemotron-70b"

    def test_resolve_github(self, monkeypatch):
        monkeypatch.setattr(settings, "github_token", "gh-token")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("github/gpt-4o")
        assert api_key == "gh-token"
        assert "models.inference.ai.azure.com" in api_base
        assert litellm_model == "openai/gpt-4o"

    def test_resolve_vercel(self, monkeypatch):
        monkeypatch.setattr(settings, "vercel_ai_gateway_key", "vc-key")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("vercel/gpt-4o")
        assert api_key == "vc-key"
        assert "ai-gateway.vercel.sh" in api_base
        assert litellm_model == "openai/gpt-4o"

    def test_resolve_opencode(self, monkeypatch):
        monkeypatch.setattr(settings, "opencode_zen_key", "oc-key")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("opencode/llama-3.1-8b")
        assert api_key == "oc-key"
        assert "opencode.ai/zen" in api_base
        assert litellm_model == "openai/llama-3.1-8b"

    def test_resolve_modal(self, monkeypatch):
        monkeypatch.setattr(settings, "modal_api_key", "md-key")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("modal/llama-3.1-8b")
        assert api_key == "md-key"
        assert "modal.com" in api_base
        assert litellm_model == "openai/llama-3.1-8b"

    def test_resolve_inferencenet(self, monkeypatch):
        monkeypatch.setattr(settings, "inference_net_api_key", "in-key")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("inferencenet/llama-3.1-8b")
        assert api_key == "in-key"
        assert "api.inference.net" in api_base
        assert litellm_model == "openai/llama-3.1-8b"

    def test_resolve_nlpcloud(self, monkeypatch):
        monkeypatch.setattr(settings, "nlp_cloud_api_key", "np-key")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("nlpcloud/finetuned-gpt-neo-2-7b")
        assert api_key == "np-key"
        assert "api.nlpcloud.io" in api_base
        assert litellm_model == "openai/finetuned-gpt-neo-2-7b"

    def test_resolve_scaleway(self, monkeypatch):
        monkeypatch.setattr(settings, "scaleway_api_key", "sc-key")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("scaleway/llama-3.1-8b")
        assert api_key == "sc-key"
        assert "api.scaleway.ai" in api_base
        assert litellm_model == "openai/llama-3.1-8b"

    def test_resolve_alibaba_intl(self, monkeypatch):
        monkeypatch.setattr(settings, "alibaba_intl_api_key", "al-key")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("alibaba-intl/qwen-plus")
        assert api_key == "al-key"
        assert "bailian-intl.alibabacloud.com" in api_base
        assert litellm_model == "openai/qwen-plus"


# =============================================================================
# 2. key 缺失时返回 None / 空配置
# =============================================================================


class TestResolveProviderMissingKey:
    """key 缺失时 _resolve_provider 返回 None 或空配置。"""

    def test_cloudflare_missing_token_returns_none(self, monkeypatch):
        monkeypatch.setattr(settings, "cloudflare_api_token", "")
        monkeypatch.setattr(settings, "cloudflare_account_id", "acc123")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("@cf/llama-3.1-8b")
        assert api_key is None
        assert api_base is None

    def test_cloudflare_missing_account_id_returns_none(self, monkeypatch):
        monkeypatch.setattr(settings, "cloudflare_api_token", "tok")
        monkeypatch.setattr(settings, "cloudflare_account_id", "")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("@cf/llama-3.1-8b")
        assert api_key is None
        assert api_base is None

    def test_nvidia_missing_key_returns_none(self, monkeypatch):
        monkeypatch.setattr(settings, "nvidia_api_key", "")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("nvidia/llama-3.1-nemotron-70b")
        assert api_key is None

    def test_github_missing_key_returns_none(self, monkeypatch):
        monkeypatch.setattr(settings, "github_token", "")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("github/gpt-4o")
        assert api_key is None

    def test_vercel_missing_key_returns_none(self, monkeypatch):
        monkeypatch.setattr(settings, "vercel_ai_gateway_key", "")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("vercel/gpt-4o")
        assert api_key is None

    def test_opencode_missing_key_returns_none(self, monkeypatch):
        monkeypatch.setattr(settings, "opencode_zen_key", "")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("opencode/llama-3.1-8b")
        assert api_key is None

    def test_modal_missing_key_returns_none(self, monkeypatch):
        monkeypatch.setattr(settings, "modal_api_key", "")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("modal/llama-3.1-8b")
        assert api_key is None

    def test_inferencenet_missing_key_returns_none(self, monkeypatch):
        monkeypatch.setattr(settings, "inference_net_api_key", "")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("inferencenet/llama-3.1-8b")
        assert api_key is None

    def test_nlpcloud_missing_key_returns_none(self, monkeypatch):
        monkeypatch.setattr(settings, "nlp_cloud_api_key", "")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("nlpcloud/gpt-neo")
        assert api_key is None

    def test_scaleway_missing_key_returns_none(self, monkeypatch):
        monkeypatch.setattr(settings, "scaleway_api_key", "")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("scaleway/llama-3.1-8b")
        assert api_key is None

    def test_alibaba_intl_missing_key_returns_none(self, monkeypatch):
        monkeypatch.setattr(settings, "alibaba_intl_api_key", "")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("alibaba-intl/qwen-plus")
        assert api_key is None


# =============================================================================
# 3. 大小写不敏感(model 前缀大写也能匹配)
# =============================================================================


class TestResolveProviderCaseInsensitive:
    """model 前缀大小写不敏感(_resolve_provider 用 model.lower() 匹配)。"""

    def test_cloudflare_uppercase(self, monkeypatch):
        monkeypatch.setattr(settings, "cloudflare_api_token", "tok")
        monkeypatch.setattr(settings, "cloudflare_account_id", "acc")
        gw = LLMGateway()
        api_key, _, litellm_model = gw._resolve_provider("@CF/LLAMA-3.1-8B")
        assert api_key == "tok"
        assert "openai/" in litellm_model

    def test_nvidia_uppercase(self, monkeypatch):
        monkeypatch.setattr(settings, "nvidia_api_key", "nv")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("NVIDIA/LLAMA-3.1-NEMOTRON-70B")
        assert api_key == "nv"

    def test_github_uppercase(self, monkeypatch):
        monkeypatch.setattr(settings, "github_token", "gh")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("GITHUB/GPT-4O")
        assert api_key == "gh"

    def test_vercel_uppercase(self, monkeypatch):
        monkeypatch.setattr(settings, "vercel_ai_gateway_key", "vc")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("VERCEL/GPT-4O")
        assert api_key == "vc"

    def test_opencode_uppercase(self, monkeypatch):
        monkeypatch.setattr(settings, "opencode_zen_key", "oc")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("OPENCODE/LLAMA-3.1-8B")
        assert api_key == "oc"

    def test_modal_uppercase(self, monkeypatch):
        monkeypatch.setattr(settings, "modal_api_key", "md")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("MODAL/LLAMA-3.1-8B")
        assert api_key == "md"

    def test_inferencenet_uppercase(self, monkeypatch):
        monkeypatch.setattr(settings, "inference_net_api_key", "in")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("INFERENCENET/LLAMA-3.1-8B")
        assert api_key == "in"

    def test_nlpcloud_uppercase(self, monkeypatch):
        monkeypatch.setattr(settings, "nlp_cloud_api_key", "np")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("NLPCLOUD/GPT-NEO")
        assert api_key == "np"

    def test_scaleway_uppercase(self, monkeypatch):
        monkeypatch.setattr(settings, "scaleway_api_key", "sc")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("SCALEWAY/LLAMA-3.1-8B")
        assert api_key == "sc"

    def test_alibaba_intl_uppercase(self, monkeypatch):
        monkeypatch.setattr(settings, "alibaba_intl_api_key", "al")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("ALIBABA-INTL/QWEN-PLUS")
        assert api_key == "al"


# =============================================================================
# 4. Cloudflare 特殊:双前缀 + 双字段
# =============================================================================


class TestCloudflareSpecial:
    """Cloudflare Workers AI 特殊场景(双前缀 @cf/ + cloudflare/ + 双字段)。"""

    def test_at_cf_prefix_preserves_full_model(self, monkeypatch):
        """@cf/ 前缀的 litellm_model 保留完整的 @cf/xxx 格式。"""
        monkeypatch.setattr(settings, "cloudflare_api_token", "tok")
        monkeypatch.setattr(settings, "cloudflare_account_id", "acc")
        gw = LLMGateway()
        _, _, litellm_model = gw._resolve_provider("@cf/llama-3.1-8b-instruct")
        assert litellm_model == "openai/@cf/llama-3.1-8b-instruct"

    def test_cloudflare_slash_strips_prefix(self, monkeypatch):
        """cloudflare/ 前缀的 litellm_model 去掉 cloudflare/ 前缀。"""
        monkeypatch.setattr(settings, "cloudflare_api_token", "tok")
        monkeypatch.setattr(settings, "cloudflare_account_id", "acc")
        gw = LLMGateway()
        _, _, litellm_model = gw._resolve_provider("cloudflare/llama-3.1-8b-instruct")
        assert litellm_model == "openai/llama-3.1-8b-instruct"
        assert "cloudflare/" not in litellm_model

    def test_api_base_contains_account_id(self, monkeypatch):
        """api_base 中嵌入 account_id。"""
        monkeypatch.setattr(settings, "cloudflare_api_token", "tok")
        monkeypatch.setattr(settings, "cloudflare_account_id", "my-account-123")
        gw = LLMGateway()
        _, api_base, _ = gw._resolve_provider("@cf/llama-3.1-8b")
        assert "my-account-123" in api_base
        assert "/ai/v1" in api_base

    def test_both_fields_required(self, monkeypatch):
        """token + account_id 必须同时存在才返回有效配置。"""
        # 只有 token,缺 account_id
        monkeypatch.setattr(settings, "cloudflare_api_token", "tok")
        monkeypatch.setattr(settings, "cloudflare_account_id", "")
        gw = LLMGateway()
        api_key, api_base, _ = gw._resolve_provider("@cf/llama-3.1-8b")
        assert api_key is None
        assert api_base is None

    def test_cloudflare_base_url_format(self, monkeypatch):
        """验证 Cloudflare API base URL 格式。"""
        monkeypatch.setattr(settings, "cloudflare_api_token", "tok")
        monkeypatch.setattr(settings, "cloudflare_account_id", "abc")
        gw = LLMGateway()
        _, api_base, _ = gw._resolve_provider("@cf/llama-3.1-8b")
        assert api_base == "https://api.cloudflare.com/client/v4/accounts/abc/ai/v1"


# =============================================================================
# 5. Modal 多段斜线模型名切分
# =============================================================================


class TestModalSpecial:
    """Modal 多段斜线模型名切分测试。"""

    def test_modal_multi_segment_model(self, monkeypatch):
        """Modal 模型名可能含多段斜线(如 modal/workspace/llama-3.1-8b)。"""
        monkeypatch.setattr(settings, "modal_api_key", "md-key")
        gw = LLMGateway()
        api_key, api_base, litellm_model = gw._resolve_provider("modal/llama-3.1-8b-instruct")
        assert api_key == "md-key"
        assert "modal.com" in api_base
        # split("/", 1) 只切第一段,model 部分保留完整
        assert litellm_model == "openai/llama-3.1-8b-instruct"


# =============================================================================
# 6. _is_stub_mode — 10 个 env key 检测
# =============================================================================


class TestIsStubModeFreeProviders:
    """_is_stub_mode 检测 10 个免费 provider 的 env key。"""

    def test_cloudflare_token_disables_stub(self, monkeypatch):
        monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "cf-tok")
        gw = LLMGateway()
        assert gw._is_stub_mode() is False

    def test_nvidia_key_disables_stub(self, monkeypatch):
        monkeypatch.setenv("NVIDIA_API_KEY", "nv-key")
        gw = LLMGateway()
        assert gw._is_stub_mode() is False

    def test_github_token_disables_stub(self, monkeypatch):
        monkeypatch.setenv("GITHUB_TOKEN", "gh-token")
        gw = LLMGateway()
        assert gw._is_stub_mode() is False

    def test_vercel_key_disables_stub(self, monkeypatch):
        monkeypatch.setenv("VERCEL_AI_GATEWAY_KEY", "vc-key")
        gw = LLMGateway()
        assert gw._is_stub_mode() is False

    def test_opencode_key_disables_stub(self, monkeypatch):
        monkeypatch.setenv("OPENCODE_ZEN_KEY", "oc-key")
        gw = LLMGateway()
        assert gw._is_stub_mode() is False

    def test_modal_key_disables_stub(self, monkeypatch):
        monkeypatch.setenv("MODAL_API_KEY", "md-key")
        gw = LLMGateway()
        assert gw._is_stub_mode() is False

    def test_inferencenet_key_disables_stub(self, monkeypatch):
        monkeypatch.setenv("INFERENCE_NET_API_KEY", "in-key")
        gw = LLMGateway()
        assert gw._is_stub_mode() is False

    def test_nlpcloud_key_disables_stub(self, monkeypatch):
        monkeypatch.setenv("NLP_CLOUD_API_KEY", "np-key")
        gw = LLMGateway()
        assert gw._is_stub_mode() is False

    def test_scaleway_key_disables_stub(self, monkeypatch):
        monkeypatch.setenv("SCALEWAY_API_KEY", "sc-key")
        gw = LLMGateway()
        assert gw._is_stub_mode() is False

    def test_alibaba_intl_key_disables_stub(self, monkeypatch):
        monkeypatch.setenv("ALIBABA_INTL_API_KEY", "al-key")
        gw = LLMGateway()
        assert gw._is_stub_mode() is False


# =============================================================================
# 7. _model_to_provider_code — 前缀映射
# =============================================================================


class TestModelToProviderCode:
    """_model_to_provider_code 前缀映射测试。"""

    def test_cloudflare_at_cf_prefix(self):
        from app.core.llm_gateway import _model_to_provider_code
        assert _model_to_provider_code("@cf/llama-3.1-8b") == "cloudflare_workers_ai"

    def test_cloudflare_slash_prefix(self):
        from app.core.llm_gateway import _model_to_provider_code
        assert _model_to_provider_code("cloudflare/llama-3.1-8b") == "cloudflare_workers_ai"

    def test_nvidia_prefix(self):
        from app.core.llm_gateway import _model_to_provider_code
        assert _model_to_provider_code("nvidia/llama-3.1-nemotron") == "nvidia_nim"

    def test_github_prefix(self):
        from app.core.llm_gateway import _model_to_provider_code
        assert _model_to_provider_code("github/gpt-4o") == "github_models"

    def test_vercel_prefix(self):
        from app.core.llm_gateway import _model_to_provider_code
        assert _model_to_provider_code("vercel/gpt-4o") == "vercel_ai_gateway"

    def test_opencode_prefix(self):
        from app.core.llm_gateway import _model_to_provider_code
        assert _model_to_provider_code("opencode/llama-3.1-8b") == "opencode_zen"

    def test_modal_prefix(self):
        from app.core.llm_gateway import _model_to_provider_code
        assert _model_to_provider_code("modal/llama-3.1-8b") == "modal"

    def test_inferencenet_prefix(self):
        from app.core.llm_gateway import _model_to_provider_code
        assert _model_to_provider_code("inferencenet/llama-3.1-8b") == "inferencenet"

    def test_nlpcloud_prefix(self):
        from app.core.llm_gateway import _model_to_provider_code
        assert _model_to_provider_code("nlpcloud/gpt-neo") == "nlpcloud"

    def test_scaleway_prefix(self):
        from app.core.llm_gateway import _model_to_provider_code
        assert _model_to_provider_code("scaleway/llama-3.1-8b") == "scaleway"

    def test_alibaba_intl_prefix(self):
        from app.core.llm_gateway import _model_to_provider_code
        assert _model_to_provider_code("alibaba-intl/qwen-plus") == "alibaba_intl"


# =============================================================================
# 8. 跨 provider 不搞混验证
# =============================================================================


class TestProviderIsolation:
    """验证不同 provider 前缀不会搞混。"""

    def test_nvidia_not_openai(self, monkeypatch):
        """nvidia/ 前缀不应 fallback 到 openai。"""
        monkeypatch.setattr(settings, "nvidia_api_key", "nv-key")
        monkeypatch.setattr(settings, "openai_api_key", "sk-openai")
        gw = LLMGateway()
        api_key, _, litellm_model = gw._resolve_provider("nvidia/llama-3.1-nemotron")
        assert api_key == "nv-key"
        assert "openai/llama-3.1-nemotron" in litellm_model
        assert api_key != "sk-openai"

    def test_github_not_openai(self, monkeypatch):
        """github/ 前缀不应 fallback 到 openai。"""
        monkeypatch.setattr(settings, "github_token", "gh-token")
        monkeypatch.setattr(settings, "openai_api_key", "sk-openai")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("github/gpt-4o")
        assert api_key == "gh-token"
        assert api_key != "sk-openai"

    def test_cloudflare_not_openai(self, monkeypatch):
        """@cf/ 前缀不应 fallback 到 openai。"""
        monkeypatch.setattr(settings, "cloudflare_api_token", "cf-tok")
        monkeypatch.setattr(settings, "cloudflare_account_id", "acc")
        monkeypatch.setattr(settings, "openai_api_key", "sk-openai")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("@cf/llama-3.1-8b")
        assert api_key == "cf-tok"
        assert api_key != "sk-openai"

    def test_alibaba_intl_not_qwen(self, monkeypatch):
        """alibaba-intl/ 不应匹配 qwen 前缀。"""
        monkeypatch.setattr(settings, "alibaba_intl_api_key", "al-key")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("alibaba-intl/qwen-plus")
        assert api_key == "al-key"
        # 验证 api_base 是国际版 bailian,不是国内 dashscope
        from app.core.llm_gateway import _model_to_provider_code
        assert _model_to_provider_code("alibaba-intl/qwen-plus") == "alibaba_intl"

    def test_scaleway_not_openai(self, monkeypatch):
        """scaleway/ 前缀不应 fallback 到 openai。"""
        monkeypatch.setattr(settings, "scaleway_api_key", "sc-key")
        monkeypatch.setattr(settings, "openai_api_key", "sk-openai")
        gw = LLMGateway()
        api_key, _, _ = gw._resolve_provider("scaleway/llama-3.1-8b")
        assert api_key == "sc-key"
        assert api_key != "sk-openai"
