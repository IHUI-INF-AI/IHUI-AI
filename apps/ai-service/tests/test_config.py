"""config.py 单元测试:Pydantic Settings 环境变量加载 + 默认值 + 类型校验。

测试覆盖:
- 默认值(app_name / port / host / log_level / debug / chat_history_window 等)
- 环境变量覆盖(单字段 / 多字段)
- 类型校验(port int / debug bool)
- 大小写不敏感匹配(UPPERCASE env var → 小写字段)
- extra=ignore(未知 env var 不报错)
- 多实例独立性(新 Settings() 反映当前 env)
- 全局 settings 单例存在
- model_config 含 env_file + extra=ignore
- LLM provider key 默认空字符串
- jwt_public_paths 默认值
- 不破坏 conftest 的 autouse 隔离
"""

from __future__ import annotations

import pytest
from pydantic_settings import BaseSettings

from app.core.config import Settings, settings


# =============================================================================
# 默认值
# =============================================================================


def test_settings_is_basasesettings_instance():
    """Settings 应继承 pydantic_settings.BaseSettings。"""
    assert isinstance(settings, BaseSettings)
    assert isinstance(settings, Settings)


def test_default_app_name():
    """app_name 默认为 'IHUI AI Service'。"""
    assert Settings().app_name == "IHUI AI Service"


def test_default_port():
    """port 默认为 8803。"""
    assert Settings().port == 8803


def test_default_host():
    """host 默认为 '0.0.0.0'。"""
    assert Settings().host == "0.0.0.0"


def test_default_log_level():
    """log_level 默认为 'info'。"""
    assert Settings().log_level == "info"


def test_default_debug():
    """debug 默认为 False。"""
    assert Settings().debug is False


def test_default_node_env():
    """node_env 默认为 'development'。"""
    assert Settings().node_env == "development"


def test_default_cors_origin():
    """cors_origin 默认指向 web 端口 8801。"""
    assert Settings().cors_origin == "http://localhost:8801"


def test_default_database_url(monkeypatch):
    """database_url 默认指向本地 postgres(隔离 .env + env var)。"""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    s = Settings(_env_file=None)
    assert "postgres" in s.database_url
    assert "ihui_ai" in s.database_url


def test_default_redis_url(monkeypatch):
    """redis_url 默认指向本地 redis(隔离 .env + env var)。"""
    monkeypatch.delenv("REDIS_URL", raising=False)
    s = Settings(_env_file=None)
    assert s.redis_url == "redis://localhost:8811"


def test_default_litellm_model():
    """litellm_model 默认为 stepfun/step-router-v1(2026-07-24 从 step-3.7-flash 升级)。"""
    assert Settings().litellm_model == "stepfun/step-router-v1"


def test_default_chat_history_window():
    """chat_history_window 默认为 6(滑窗 N 轮)。"""
    assert Settings().chat_history_window == 6


def test_default_max_agent_iterations():
    """max_agent_iterations 默认为 8(2026-07-24 从硬编码 3 升级,覆盖多步浏览器/电脑操作)。"""
    assert Settings().max_agent_iterations == 8


def test_default_api_service_url():
    """api_service_url 默认指向后端 8802。"""
    assert Settings().api_service_url == "http://localhost:8802"


def test_default_jwt_issuer():
    """jwt_issuer 默认为 'ihui-ai'。"""
    assert Settings().jwt_issuer == "ihui-ai"


def test_default_jwt_public_paths():
    """jwt_public_paths 默认含 /api/health /metrics 等。"""
    paths = Settings().jwt_public_paths
    assert "/api/health" in paths
    assert "/metrics" in paths
    assert "/health" in paths


# =============================================================================
# LLM provider key 默认空字符串
# =============================================================================


def test_default_openai_provider_config_empty(monkeypatch):
    """openai provider 配置默认空(阶段 3 主体:LLM_PROVIDERS 未配置时 api_key 为空字符串)。"""
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    assert Settings().get_provider_config("openai").api_key == ""


def test_default_anthropic_provider_config_empty(monkeypatch):
    """anthropic provider 配置默认空(阶段 3 主体:LLM_PROVIDERS 未配置时 api_key 为空字符串)。"""
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    assert Settings().get_provider_config("anthropic").api_key == ""


def test_default_all_provider_keys_empty(monkeypatch):
    """所有 provider key 默认应为空(全空 → stub 模式)。

    阶段 3 主体(2026-07-26):扁平字段已删除,统一走 get_provider_config。
    LLM_PROVIDERS 未配置时,7 个核心 provider 的 api_key 应为空字符串、api_base 应为 None。
    """
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    s = Settings(_env_file=None)
    for name in ("openai", "anthropic", "groq", "gemini", "openrouter", "agnes", "stepfun"):
        cfg = s.get_provider_config(name)
        assert cfg.api_key == "", f"{name} api_key 默认应为空字符串"
        assert cfg.api_base is None, f"{name} api_base 默认应为 None"


def test_default_agnes_api_base(monkeypatch):
    """agnes provider api_base 默认 None(阶段 3 主体:LLM_PROVIDERS 未配置时)。"""
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    assert Settings(_env_file=None).get_provider_config("agnes").api_base is None


def test_default_stepfun_api_base(monkeypatch):
    """stepfun provider api_base 默认 None(阶段 3 主体:LLM_PROVIDERS 未配置时)。"""
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    assert Settings(_env_file=None).get_provider_config("stepfun").api_base is None


# =============================================================================
# 环境变量覆盖
# =============================================================================


def test_env_override_app_name(monkeypatch):
    """APP_NAME 环境变量应覆盖 app_name 字段。"""
    monkeypatch.setenv("APP_NAME", "My Custom Service")
    s = Settings()
    assert s.app_name == "My Custom Service"


def test_env_override_port(monkeypatch):
    """PORT 环境变量应覆盖 port 字段(int 类型)。"""
    monkeypatch.setenv("PORT", "9999")
    s = Settings()
    assert s.port == 9999
    assert isinstance(s.port, int)


def test_env_override_debug_true(monkeypatch):
    """DEBUG=true 应解析为 True。"""
    monkeypatch.setenv("DEBUG", "true")
    assert Settings().debug is True


def test_env_override_debug_false(monkeypatch):
    """DEBUG=false 应解析为 False。"""
    monkeypatch.setenv("DEBUG", "false")
    assert Settings().debug is False


def test_env_override_debug_1(monkeypatch):
    """DEBUG=1 应解析为 True(pydantic bool 解析)。"""
    monkeypatch.setenv("DEBUG", "1")
    assert Settings().debug is True


def test_env_override_debug_0(monkeypatch):
    """DEBUG=0 应解析为 False。"""
    monkeypatch.setenv("DEBUG", "0")
    assert Settings().debug is False


def test_env_override_multiple_fields(monkeypatch):
    """多个 env var 同时设置应同时生效。"""
    monkeypatch.setenv("APP_NAME", "X")
    monkeypatch.setenv("PORT", "1234")
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("LOG_LEVEL", "debug")
    s = Settings()
    assert s.app_name == "X"
    assert s.port == 1234
    assert s.debug is True
    assert s.log_level == "debug"


def test_env_override_openai_provider_via_llm_providers(monkeypatch):
    """LLM_PROVIDERS JSON 应覆盖 openai provider 配置(阶段 3 主体:扁平字段已删除,统一走 llm_providers)。"""
    monkeypatch.setenv("LLM_PROVIDERS", '{"openai":{"api_key":"sk-test-12345"}}')
    s = Settings()
    assert s.get_provider_config("openai").api_key == "sk-test-12345"


def test_env_override_litellm_model(monkeypatch):
    """LITELLM_MODEL 环境变量应覆盖 litellm_model 字段。"""
    monkeypatch.setenv("LITELLM_MODEL", "anthropic/claude-3-opus")
    s = Settings()
    assert s.litellm_model == "anthropic/claude-3-opus"


def test_env_override_chat_history_window(monkeypatch):
    """CHAT_HISTORY_WINDOW 环境变量应覆盖 chat_history_window(int)。"""
    monkeypatch.setenv("CHAT_HISTORY_WINDOW", "12")
    s = Settings()
    assert s.chat_history_window == 12


# =============================================================================
# 大小写不敏感(env var 大写 → 字段小写)
# =============================================================================


def test_case_insensitive_env_matching(monkeypatch):
    """pydantic Settings 默认大小写不敏感:大写 env var 应匹配小写字段。"""
    monkeypatch.setenv("REDIS_URL", "redis://custom:6379")
    s = Settings()
    assert s.redis_url == "redis://custom:6379"


def test_case_insensitive_database_url(monkeypatch):
    """DATABASE_URL 大写 env var 应匹配 database_url 小写字段。"""
    monkeypatch.setenv("DATABASE_URL", "postgres://user:pass@host:5432/db")
    s = Settings()
    assert s.database_url == "postgres://user:pass@host:5432/db"


# =============================================================================
# extra=ignore(未知 env var 不报错)
# =============================================================================


def test_unknown_env_var_ignored(monkeypatch):
    """model_config extra=ignore:未知 env var 不应导致实例化失败。"""
    monkeypatch.setenv("UNKNOWN_FIELD_XYZ", "whatever")
    monkeypatch.setenv("ANOTHER_UNKNOWN", "value")
    s = Settings()  # 不应抛错
    assert s.app_name == "IHUI AI Service"


# =============================================================================
# model_config
# =============================================================================


def test_model_config_has_env_file():
    """model_config 应含 env_file='.env'。"""
    cfg = Settings.model_config
    assert cfg.get("env_file") == ".env"


def test_model_config_extra_ignore():
    """model_config 应含 extra='ignore'。"""
    cfg = Settings.model_config
    assert cfg.get("extra") == "ignore"


# =============================================================================
# 多实例独立性
# =============================================================================


def test_new_instance_reflects_current_env(monkeypatch):
    """新建 Settings() 实例应反映当前 env(不影响全局 settings 单例)。"""
    monkeypatch.setenv("PORT", "7777")
    new_s = Settings()
    assert new_s.port == 7777


def test_global_settings_singleton_exists():
    """全局 settings 应为 Settings 实例。"""
    assert settings is not None
    assert isinstance(settings, Settings)


def test_global_settings_field_types():
    """全局 settings 字段类型应正确(str/int/bool)。"""
    assert isinstance(settings.app_name, str)
    assert isinstance(settings.port, int)
    assert isinstance(settings.debug, bool)
    assert isinstance(settings.chat_history_window, int)


# =============================================================================
# JWT / 凭据相关默认值
# =============================================================================


def test_default_jwt_secret_empty(monkeypatch):
    """jwt_secret 默认空(开发态,隔离 .env)。"""
    monkeypatch.delenv("JWT_SECRET", raising=False)
    assert Settings(_env_file=None).jwt_secret == ""


def test_default_ai_callback_secret_empty(monkeypatch):
    """ai_callback_secret 默认空(隔离 .env)。"""
    monkeypatch.delenv("AI_CALLBACK_SECRET", raising=False)
    assert Settings(_env_file=None).ai_callback_secret == ""


def test_default_credentials_encryption_key_empty(monkeypatch):
    """credentials_encryption_key 默认空(隔离 .env)。"""
    monkeypatch.delenv("CREDENTIALS_ENCRYPTION_KEY", raising=False)
    assert Settings(_env_file=None).credentials_encryption_key == ""


def test_default_agent_control_internal_secret_empty(monkeypatch):
    """agent_control_internal_secret 默认空(隔离 .env)。"""
    monkeypatch.delenv("AGENT_CONTROL_INTERNAL_SECRET", raising=False)
    assert Settings(_env_file=None).agent_control_internal_secret == ""


# =============================================================================
# conftest 隔离兼容性(autouse 不被破坏)
# =============================================================================


def test_conftest_isolation_keeps_settings_keys_empty(monkeypatch):
    """conftest._isolate_llm_env 应已清空 os.environ vendor key,确保 LLM_PROVIDERS 未配置时返回空。

    阶段 3 主体(2026-07-26):扁平字段已删除,改为验证 get_provider_config 返回空 ProviderConfig。
    注意:全局 settings 在 import 时从 .env 加载 llm_providers,需 monkeypatch 清空以模拟"未配置"。
    """
    # conftest autouse 已清空 os.environ vendor keys
    # 全局 settings.llm_providers 在 import 时已从 .env 加载,需 monkeypatch 清空以模拟"未配置"
    monkeypatch.setattr(settings, "llm_providers", "")
    for name in ("openai", "anthropic", "groq", "gemini", "openrouter", "agnes", "stepfun"):
        cfg = settings.get_provider_config(name)
        assert cfg.api_key == "", f"{name} api_key 应为空"
        assert cfg.api_base is None, f"{name} api_base 应为 None"


def test_conftest_isolation_does_not_affect_new_instance(monkeypatch):
    """新建 Settings() 实例默认 provider 配置为空(conftest 不破坏新实例化路径)。

    阶段 3 主体(2026-07-26):扁平字段已删除,统一走 get_provider_config。
    LLM_PROVIDERS 未配置时,新 Settings() 实例的 provider 配置应为空。
    """
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    s = Settings(_env_file=None)
    assert s.get_provider_config("openai").api_key == ""
    assert s.get_provider_config("stepfun").api_key == ""
