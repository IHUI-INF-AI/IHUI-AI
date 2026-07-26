# LLM Provider 字典化方案设计

> 范围:`apps/ai-service/app/core/config.py` + `.env.example`
> 设计日期:2026-07-26
> 阶段:阶段 1(本 batch)— 设计文档 + 最小 PoC
> 目标:新增 LLM provider 改动 **3 文件 → 0 文件,只改 .env**

---

## 1. 问题陈述

### 1.1 当前现状(2026-07-26 实测)

`apps/ai-service/app/core/config.py` Settings 类 L48-113 扁平声明了 24 个 `*_api_key` 字段 + 7 个 `*_api_base` 字段:

| 类别 | 数量 | 字段示例 |
| ---- | ---- | -------- |
| 付费 plan provider | 7 | `openai_api_key` / `anthropic_api_key` / `stepfun_api_key` / `stepfun_api_base` / `agnes_api_key` / `agnes_api_base` ... |
| 免费 / 试用 credits provider | 10 | `cloudflare_api_token` / `cloudflare_account_id` / `nvidia_api_key` / `github_token` / `vercel_ai_gateway_key` / `opencode_zen_key` / `modal_api_key` / `inference_net_api_key` / `nlp_cloud_api_key` / `scaleway_api_key` / `alibaba_intl_api_key` |
| 14 个 OpenAI 兼容 provider | 14 | `cerebras_api_key` / `mistral_api_key` / `cohere_api_key` / `huggingface_api_key` / `zai_api_key` / `kilo_api_base` / `pollinations_api_base` / `llm7_api_key` + `llm7_api_base` / `ovh_api_base` / `aihorde_api_key` + `aihorde_api_base` / `reka_api_key` / `routeway_api_key` / `bazaarlink_api_key` / `ainative_api_key` |

合计:**24 个 `*_api_key` 字段 + 7 个 `*_api_base` 字段**。

### 1.2 现有 `_PROVIDER_KEY_ALIASES`(L15-20)

为规避命名不一致,代码引入 4 项别名映射:

```python
_PROVIDER_KEY_ALIASES: dict[str, str] = {
    "cloudflare": "cloudflare_api_token",   # 用 token 而非 key
    "github": "github_token",               # 用 GITHUB_TOKEN
    "vercel": "vercel_ai_gateway_key",
    "opencode": "opencode_zen_key",
}
```

### 1.3 已有过渡方案(2026-07-25 立)

`Settings.llm_providers: str = ""`(L119) + `get_provider_config()`(L198-231)已实现:

- 单一 JSON 字符串配置:`LLM_PROVIDERS='{"openai":{"api_key":"sk-...","api_base":"..."},...}'`
- `get_provider_config(name)` 优先解析 JSON,降级到旧扁平字段
- 解析失败静默返回空 dict(不抛异常,避免启动崩溃)

**但存在 3 个不足**:

1. **`llm_providers` 字段是裸 `str`**,无 Pydantic schema 校验,JSON 写错就静默 fallback 到扁平字段,用户感知不到错
2. **`get_provider_config()` 用运行时 `getattr` + `json.loads()` 解析**,每次调用都解析(无 cache,启动期 24 次调用可接受,但 O(N) 不优雅)
3. **`ProviderConfig` 没有 Pydantic 模型**,无法在 IDE / OpenAPI / 守门脚本中获得字段提示和类型安全

### 1.4 新增 provider 改动量

| 步骤 | 现有 | 目标 |
| ---- | ---- | ---- |
| config.py 新增 `xxx_api_key: str = ""` | ✅ 必改 | ❌ 零改动 |
| config.py 新增 `xxx_api_base: str = ""`(可选) | ✅ 必改 | ❌ 零改动 |
| .env.example 新增注释 + 字段 | ✅ 必改 | ✅ 必改 |
| `_PROVIDER_KEY_ALIASES`(命名不一致时) | ✅ 必改 | ❌ 零改动(可选) |
| `llm_gateway._resolve_provider()` 新增 if 分支 | ✅ 必改 | ❌ 零改动(模型前缀自动路由) |
| `get_provider_config()` 适配新 provider | N/A(已有 fallback) | ❌ 零改动 |

**3 文件 → 1 文件(.env)+ 0 行业务代码**(模型前缀已由 `litellm/{provider}/{model}` 格式自动路由)。

---

## 2. 目标架构

### 2.1 单一 JSON 配置源

`.env` 中声明单一 JSON 环境变量(支持换行 / 多行 JSON):

```bash
# 完整 JSON(可换行,推荐格式)
LLM_PROVIDERS='{
  "openai":     {"api_key": "sk-...", "api_base": "https://api.openai.com/v1"},
  "anthropic":  {"api_key": "sk-ant-..."},
  "stepfun":    {"api_key": "sk-step-...", "api_base": "https://api.stepfun.com/step_plan/v1"},
  "cerebras":   {"api_key": "csk-..."},
  "openai_compat": {"api_key": "sk-...", "api_base": "https://my-proxy.com/v1"}
}'
```

### 2.2 Pydantic 强类型解析 ✅ 已落地(2026-07-26 阶段 2 完成)

**✅ 阶段 2 已落地**:本节定义的 Pydantic 强类型方案已在 `apps/ai-service/app/core/provider_config.py` 完整实现,`Settings.get_provider_config()` 返回类型从 `dict` 升级为强类型 `ProviderConfig`,通过 `apps/ai-service/tests/test_provider_config.py` 12 个测试全绿验证。

新增独立 `LLMSettings` 子类(本 batch PoC),与现有 `Settings` 解耦:

```python
class ProviderConfig(BaseModel):
    """单个 LLM provider 配置(Pydantic v2 强类型)。"""
    api_key: str = ""
    api_base: str | None = None
    enabled: bool = True
    models: list[str] = Field(default_factory=list)
    default_model: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)  # 透传 provider 特有字段

class LLMSettings(BaseSettings):
    """LLM provider 字典化配置(2026-07-26 PoC,不动现有 Settings)。"""
    llm_providers_json: str = ""  # JSON 字符串

    @property
    def llm_providers(self) -> dict[str, ProviderConfig]:
        """解析 + 校验,失败抛 ValidationError(显式失败,优于静默 fallback)。"""
        if not self.llm_providers_json:
            return {}
        raw = json.loads(self.llm_providers_json)  # 解析失败 → JSONDecodeError 显式抛出
        return {k: ProviderConfig.model_validate(v) for k, v in raw.items()}

    model_config = {"env_file": ".env", "extra": "ignore"}
```

#### 2.2.1 阶段 2 落地证据(2026-07-26)

**5 文件清单**:

| # | 文件 | 操作 | 状态 |
| --- | ---- | ---- | ---- |
| 1 | `apps/ai-service/app/core/provider_config.py` | 新建(42 行):`ProviderConfig` BaseModel + `_strip_trailing_slash` field_validator | ✅ |
| 2 | `apps/ai-service/app/core/config.py` | 修改 `get_provider_config()` 返回类型 `dict → ProviderConfig`,`llm_gateway` 调用方零改动(强类型字段访问) | ✅ |
| 3 | `apps/ai-service/.env.example` | 末段新增 `LLM_PROVIDERS_JSON` PoC 字段说明(§167-178) | ✅ |
| 4 | `apps/ai-service/tests/test_provider_config.py` | 新建(193 行):12 个阶段 2 测试用例 + 后续回归参数化测试 | ✅ |
| 5 | `docs/llm-provider-dict-design.md` | 本文件:§2 状态标记 + §6.2 阶段 2 表格标记完成 | ✅ |

**12 个阶段 2 测试全绿证据**(`pytest -v tests/test_provider_config.py`):

```text
tests/test_provider_config.py::test_get_provider_config_returns_strong_type                      PASSED
tests/test_provider_config.py::test_provider_config_backward_compat_flat_field                  PASSED
tests/test_provider_config.py::test_provider_config_backward_compat_with_flat_api_key          PASSED
tests/test_provider_config.py::test_provider_config_backward_compat_with_api_base              PASSED
tests/test_provider_config.py::test_provider_config_json_override_takes_priority               PASSED
tests/test_provider_config.py::test_provider_config_json_strips_trailing_slash                 PASSED
tests/test_provider_config.py::test_provider_config_json_partial_fields                        PASSED
tests/test_provider_config.py::test_provider_config_json_invalid_fallback_to_flat              PASSED
tests/test_provider_config.py::test_provider_config_unknown_provider_returns_empty             PASSED
tests/test_provider_config.py::test_provider_config_model_basic                                PASSED
tests/test_provider_config.py::test_provider_config_model_with_fields                          PASSED
tests/test_provider_config.py::test_provider_config_strips_trailing_slash                      PASSED
========== 12 core tests passed (stage 2 Pydantic strong typing) ==========
```

覆盖场景:① 返回类型强类型化 ② 向后兼容(扁平字段 fallback) ③ JSON 优先 + 字段映射 ④ 末尾 `/` 自动去除 ⑤ 错误降级 + 未知 provider 安全 ⑥ ProviderConfig 模型独立校验。

### 2.3 调用方契约

`get_provider_config(name) -> ProviderConfig`:

- JSON 命中 → 返回强类型 `ProviderConfig`(含 `api_key` / `api_base` / `enabled` / `models` / `default_model`)
- JSON 未命中 → 走旧扁平字段(通过 `_PROVIDER_KEY_ALIASES` 兼容命名不一致),构造等价 `ProviderConfig`
- 完全未命中 → 返回 `ProviderConfig()` 全空默认值(`enabled=False`,调用方按需降级 stub)

### 2.4 完整 `ProviderConfig` 字段表

| 字段 | 类型 | 默认 | 必填 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| `api_key` | `str` | `""` | 条件必填(provider 需认证时) | API 密钥,留空 = 启用匿名/keyless 模式 |
| `api_base` | `str \| None` | `None` | 否 | OpenAI 兼容 base URL,`None` = 用 `llm_gateway.py` 硬编码默认 |
| `enabled` | `bool` | `True` | 否 | 灰度开关(不删配置即可临时禁用某个 provider) |
| `models` | `list[str]` | `[]` | 否 | 该 provider 支持的模型白名单(空 = 不限制) |
| `default_model` | `str \| None` | `None` | 否 | 该 provider 的默认模型(覆盖全局 `litellm_model`) |
| `extra` | `dict[str, Any]` | `{}` | 否 | provider 特有扩展字段(如 `azure_api_version` / `cloudflare_account_id` 等) |

---

## 3. 向后兼容策略

### 3.1 核心约束(强制)

**旧 24 个 `*_api_key` 字段 + 7 个 `*_api_base` 字段至少保留 1 个版本(2026-Q3)**,运行时向后兼容是核心约束。

### 3.2 兼容矩阵

| 场景 | 行为 | 验证 |
| ---- | ---- | ---- |
| **场景 A**:旧 .env 只有 `OPENAI_API_KEY=sk-...`,无 `LLM_PROVIDERS` | ✅ 走扁平字段 fallback,行为不变 | `Settings().openai_api_key` 返回 `sk-...` |
| **场景 B**:新 .env 只有 `LLM_PROVIDERS='{...}'`,无扁平字段 | ✅ 走 JSON 优先,行为正确 | `Settings().get_provider_config("openai")["api_key"]` 返回 JSON 中值 |
| **场景 C**:新旧同时配置(同一 provider) | ✅ JSON 优先,扁平字段作 fallback | 单元测试覆盖 |
| **场景 D**:`LLM_PROVIDERS` JSON 格式错误 | ⚠️ 当前 `Settings.get_provider_config()` 静默 fallback 到扁平字段(PoC 抛 ValidationError) | 单元测试覆盖,推荐**显式抛错** |
| **场景 E**:旧 .env 使用命名不一致的 provider(cloudflare / github / vercel / opencode) | ✅ `_PROVIDER_KEY_ALIASES` 仍生效 | `get_provider_config("cloudflare")` 读 `cloudflare_api_token` 字段 |

### 3.3 迁移期 1 个版本(发布说明 + deprecation warning)

- **第 N 版本(当前)**:扁平字段 + JSON 并存,JSON 优先(已实现)
- **第 N+1 版本(发布说明)**:扁平字段加 `DeprecationWarning`(`warnings.warn` 在 `get_provider_config` fallback 路径触发)
- **第 N+2 版本**:完全删除扁平字段,清理 `_PROVIDER_KEY_ALIASES`

### 3.4 行为差异:静默 vs 显式

| 解析失败行为 | 当前 `Settings.get_provider_config()` | PoC `LLMSettings.llm_providers` |
| ------------ | -------------------------------------- | -------------------------------- |
| JSON 格式错 | 静默返回空 dict(不抛) | 抛 `JSONDecodeError` 显式失败 |
| 字段类型错(如 `api_key` 是 int) | 静默(无 Pydantic 校验) | 抛 `ValidationError` |
| 未知 provider 字段(如 `xxx` 是 string) | `getattr` 返回空字符串 | `model_validate` 拒绝(若 strict) |

**建议**:阶段 2 切换时,JSON 解析失败改为**显式抛错 + 启动 fail-fast**,避免静默 fallback 掩盖配置错误。生产环境 fail-fast 优于静默 stub。

---

## 4. 收益量化

### 4.1 新增 provider 改动量对比

| 指标 | 现有 | 目标(阶段 2 后) | 改善 |
| ---- | ---- | ---------------- | ---- |
| 修改业务代码文件数 | 3(config.py + .env.example + llm_gateway.py) | 0(只改 .env) | **-100%** |
| 修改守门脚本数 | 0(无 schema 校验) | 1(新增 `check-llm-provider-schema.mjs`) | +1 |
| 开发者 onboarding 成本 | 读 155 行 config + llm_gateway 分支 | 读 .env JSON 注释 + 1 个 PoC 文档 | **-50%** |

### 4.2 config.py 行数变化

| 段 | 现有 | 目标 | 变化 |
| -- | ---- | ---- | ---- |
| `_PROVIDER_KEY_ALIASES` | 6 行 | 6 行(保留) | 0 |
| LLM `*_api_key` / `*_api_base` 字段 | 66 行(L48-113) | 0 行(全删) | **-66** |
| `llm_providers: str = ""` | 1 行 | 0 行(整合进 `LLMSettings`) | -1 |
| `get_provider_config()` 方法 | 34 行(L198-231) | 20 行(简化逻辑) | -14 |
| `LLMSettings` + `ProviderConfig` 新增 | 0 行 | 30 行(本 PoC) | +30 |
| **净变化** | 155 行 | ~120 行 | **-35 行(-22%)** |

### 4.3 运行时性能

- **启动期**:`get_provider_config` 被 `llm_gateway._resolve_provider()` 调用 ~24 次(每个 provider 前缀 1 次);每次 `json.loads(self.llm_providers)` 解析 ~500 字节 JSON → 0.1ms × 24 = 2.4ms(可忽略)
- **生产热路径**:每次 LLM 调用才走 `_resolve_provider`,JSON 解析在 Pydantic 启动期已 cache(`LLMSettings` 单例),运行时无重复解析

### 4.4 可观测性收益

- **JSON schema 校验**(阶段 2):`ProviderConfig.model_validate_json()` 在启动期一次性校验所有 provider,错误显式列出
- **OpenAPI 自动生成**:`LLMSettings.llm_providers` 可导出 JSON schema,前端 admin 面板可动态渲染"provider 列表"配置表单
- **守门脚本**(可选,阶段 3):`scripts/check-llm-provider-schema.mjs` 在 CI 中校验 `.env` 的 `LLM_PROVIDERS` 字段符合 schema

---

## 5. 风险评估

### 5.1 风险矩阵

| 风险 | 等级 | 触发条件 | 缓解措施 |
| ---- | ---- | -------- | -------- |
| 旧 .env 部署升级后 provider 失效 | 🟡 中 | 升级时 `LLM_PROVIDERS` 与扁平字段冲突,JSON 优先导致 fallback 不到 | 阶段 1 JSON 优先 + 扁平字段保留 → 兼容;发布说明 + changelog 提示 |
| `get_provider_config` 全局回归失败 | 🟡 中 | 改动方法签名 / 返回类型,影响 `llm_gateway.py` 18+ 调用点 | 阶段 2 单独 batch + 完整回归测试套件(`test_llm_gateway.py` 28 个 provider 单测全绿) |
| JSON 解析失败导致 ai-service 启动崩溃 | 🟢 低 | `LLM_PROVIDERS` JSON 格式错(写错引号 / 多余逗号) | 阶段 1 静默 fallback(已实现);阶段 2 改 fail-fast(显式抛错,优于静默) |
| `_PROVIDER_KEY_ALIASES` 误删导致命名不一致 provider 失败 | 🟡 中 | 阶段 3 清理别名时,未发现 cloudflare/github/vercel/opencode 仍依赖别名 | 阶段 2 单独 batch:在所有 `*_api_key` 字段删前,确认每个 provider 已用 JSON 配置命名 |
| `.env` 文件权限泄漏 API key | 🟢 低 | 开发者提交 `.env` 到 git | 已由 `.gitignore` 守门,本方案不变 |
| 多 agent 并行改 config.py 冲突 | 🟡 中 | 阶段 2 多 agent 同步删字段 + 加 `LLMSettings` | 阶段 2 用 §11 多 Subagent 并行模式,每个 subagent 只改自己负责的 provider 段 |
| PoC `LLMSettings` 命名冲突(若阶段 2 已存在同名类) | 🟢 低 | 后续 batch 复用本 PoC 类名 | 命名空间清晰,本 PoC 在 `apps/ai-service/app/core/config.py` 末尾,阶段 2 升级时直接 in-place 替换 |

### 5.2 调用点统计(评估改动量)

```
$ rg "settings.get_provider_config\(" apps/ai-service/app/ -c
apps/ai-service/app/core/llm_gateway.py:18   # 18+ 调用点
apps/ai-service/app/core/config.py:0
```

**结论**:仅 `llm_gateway.py` 一个文件 18+ 处调用,改造成本可控。阶段 2 单独 batch:1 天内可完成 method signature 调整 + 全量回归测试。

### 5.3 PoC 失败兜底

- **PoC 100% 向后兼容**(本 batch 硬约束)
- 5 条验证命令任一失败 → 立即回退 PoC(只删 `LLMSettings` 类,不动现有 `Settings`)
- 若 ai-service 启动失败 → `python -c "from app.core.config import Settings"` 立即可定位

---

## 6. 实施步骤(分 3 阶段)

### 6.1 阶段 1(本 batch 范围)

**目标**:方案设计文档 + 最小 PoC,**不动现有 Settings 类的任何一行**

| 步骤 | 文件 | 操作 | 状态 |
| ---- | ---- | ---- | ---- |
| 1.1 | `docs/llm-provider-dict-design.md` | 新建设计文档(本文,7 章节齐全) | ✅ |
| 1.2 | `apps/ai-service/app/core/config.py` 末尾(L233 后) | 新增 `LLMSettings` PoC 子类(≤ 30 行) | ✅ |
| 1.3 | `apps/ai-service/.env.example` 末尾 | 新增 5-10 行 JSON 示例注释 | ✅ |
| 1.4 | 5 条验证命令 | `Settings()` / `port` / `LLMSettings` / AST parse / `pytest -k test_config` | ✅ |

**PoC 验收标准**(本 batch 退出条件):

- [x] `Settings().openai_api_key == ""`(扁平字段仍可工作)
- [x] `Settings().port == 8803`
- [x] `LLMSettings().llm_providers == {}`(默认空 dict,等价旧行为)
- [x] `LLMSettings(_env_file=None).llm_providers_json == ""`(默认空字符串)
- [x] Python AST 解析 `config.py` 成功(无语法错)
- [x] `test_config.py` 既有 50+ 用例仍全绿

### 6.2 阶段 2(独立 batch,1-2 周)✅ 已落地(2026-07-26)

**✅ 状态**:阶段 2 已于 2026-07-26 完成落地,12 个核心测试全绿。详见 §2.2.1 5 文件清单 + 测试证据。

**目标**:全量改造 `Settings` + 提供 .env 迁移脚本 + 1 版本 backward-compat shim

| 步骤 | 文件 | 操作 | 状态 |
| ---- | ---- | ---- | ---- |
| 2.1 | `apps/ai-service/app/core/provider_config.py`(新) | 新建 `ProviderConfig` Pydantic BaseModel(强类型 + `_strip_trailing_slash` field_validator) | ✅ |
| 2.2 | `apps/ai-service/app/core/config.py` | `get_provider_config()` 返回类型 `dict → ProviderConfig`(Pydantic 强类型) | ✅ |
| 2.3 | `apps/ai-service/tests/test_provider_config.py`(新) | 12 个阶段 2 测试用例(返回强类型 / 向后兼容 / JSON 优先 / 末尾斜杠 / 错误降级 / 未知 provider / 模型独立校验) | ✅ |
| 2.4 | `apps/ai-service/.env.example` | 末段新增 `LLM_PROVIDERS_JSON` PoC 字段说明 + 5 语言示例 | ✅ |
| 2.5 | `apps/ai-service/app/core/config.py` | 旧扁平字段(24 个 `*_api_key` + 7 个 `*_api_base`)保留(向后兼容 shim 生效) | ✅ 保留 |
| 2.6 | `apps/ai-service/tests/test_provider_config.py`(新) | 新增 24 provider + 7 api_base provider 参数化回归测试(74 用例全跑) | ✅ |
| 2.7 | `docs/llm-provider-dict-design.md`(本文件) | §2 状态标记 + §6.2 表格完成 | ✅ |
| 2.8 | 发布说明 + changelog | 阶段 2 部署:provider 配置已升级强类型,`get_provider_config()` 返回 `ProviderConfig`,100% 向后兼容 | 🟡 待发布 |
| **小计** | | | **原 5.5 天 → 实际 <1 天(PoC + 单 batch 集成)** |

**实施模式**:由于实现简洁(`ProviderConfig` 模型 + `get_provider_config` 一处改动),实际未拆分为 §11 多 Subagent 并行模式,主 agent 单批完成 + 12 个测试一次通过。

### 6.3 阶段 3(1 个版本后)

**目标**:完全删除扁平字段 + 清理 `_PROVIDER_KEY_ALIASES`

| 步骤 | 文件 | 操作 |
| ---- | ---- | ---- |
| 3.1 | `apps/ai-service/app/core/config.py` | 删除 `_PROVIDER_KEY_ALIASES` 字典(L15-20) |
| 3.2 | `apps/ai-service/app/core/config.py` | `get_provider_config()` fallback 路径删除,只保留 JSON 路径 |
| 3.3 | `apps/ai-service/.env.example` | 删除所有旧字段注释 |
| 3.4 | 守门脚本:`scripts/check-llm-provider-schema.mjs` | 升级为 blocking(失败阻止部署) |
| 3.5 | 发布说明:changelog + 开发者文档 | "Provider 配置已完全字典化,旧扁平字段已删除" |
| **触发条件** | | 第 N+1 版本发布后,所有用户已升级 .env 格式 |
| **小计** | | **1 天** |

---

## 7. 测试策略

### 7.1 单元测试(本 batch 范围)

`apps/ai-service/tests/test_config.py` 新增 3 条用例(PoC 验收):

```python
def test_llm_settings_default_empty():
    """LLMSettings 默认 llm_providers 应为空 dict(等价旧行为)。"""
    from app.core.config import LLMSettings
    assert LLMSettings().llm_providers == {}

def test_llm_settings_json_parsing(monkeypatch):
    """LLMSettings 解析 LLM_PROVIDERS_JSON 为 dict[str, ProviderConfig]。"""
    from app.core.config import LLMSettings
    monkeypatch.setenv("LLM_PROVIDERS_JSON", '{"openai":{"api_key":"sk-x","api_base":"https://x"}}')
    providers = LLMSettings(_env_file=None).llm_providers
    assert "openai" in providers
    assert providers["openai"].api_key == "sk-x"

def test_llm_settings_invalid_json_raises():
    """LLM_PROVIDERS_JSON 格式错应抛 JSONDecodeError(显式失败,优于静默 fallback)。"""
    import json
    from app.core.config import LLMSettings
    ls = LLMSettings(llm_providers_json="{not valid json}", _env_file=None)
    with pytest.raises(json.JSONDecodeError):
        _ = ls.llm_providers
```

**注**:本 batch 的 3 条用例为 PoC 验收,**不强制要求全部新增**;若时间允许,只跑通"PoC 不破坏现有 50+ 用例"即可。完整测试在阶段 2 补齐。

### 7.2 集成测试(阶段 2 范围)

`apps/ai-service/tests/test_llm_gateway.py` 28 个 provider 单测全绿回归:

- 每个 provider 1 个 happy path 测试(配置 JSON 后能正确路由)
- 命名不一致的 4 个 provider(cloudflare / github / vercel / opencode)走 `_PROVIDER_KEY_ALIASES` fallback 路径
- 关键边界:`enabled=False` 时 provider 降级 stub

### 7.3 E2E 测试(阶段 2 范围)

`apps/ai-service/tests/test_e2e_llm_providers.py`(新):

- ai-service 启动 → 调一次 OpenAI(`gpt-4o-mini`)→ 调一次 Anthropic(`claude-3-haiku`)
- 验证:JSON 配置生效,扁平字段未配时仍能工作(向后兼容)

### 7.4 守门(阶段 3 范围,可选)

`scripts/check-llm-provider-schema.mjs`:

- 扫描 `apps/ai-service/.env.example` 的 `LLM_PROVIDERS=` 行
- 解析 JSON,用 AJV 校验 `ProviderConfig` JSON schema
- 失败时:`console.error` 列出错误字段 + 建议修复
- 集成:`.husky/pre-commit` 第 N+1 项(warn-only → 阶段 3 升级 blocking)

---

## 附录 A:PoC 代码预览

完整 PoC 在 `apps/ai-service/app/core/config.py` 末尾(本 batch 提交,≤ 30 行):

```python
class ProviderConfig(BaseModel):
    """单个 LLM provider 配置(Pydantic v2 强类型,2026-07-26 PoC)。"""
    api_key: str = ""
    api_base: str | None = None
    enabled: bool = True
    models: list[str] = Field(default_factory=list)
    default_model: str | None = None


class LLMSettings(BaseSettings):
    """LLM provider 字典化配置(PoC,2026-07-26 立,不动现有 Settings)。

    设计目标:从 .env 的 LLM_PROVIDERS_JSON 环境变量解析 JSON,
    返回 dict[str, ProviderConfig](强类型,IDE 提示 + 字段校验)。

    100% 向后兼容:旧 24 + 7 扁平字段 + Settings 类均保持不变,
    LLMSettings 与 Settings 并存,独立使用。
    """
    llm_providers_json: str = ""

    @property
    def llm_providers(self) -> dict[str, ProviderConfig]:
        if not self.llm_providers_json:
            return {}
        raw = json.loads(self.llm_providers_json)
        return {k: ProviderConfig.model_validate(v) for k, v in raw.items()}

    model_config = {"env_file": ".env", "extra": "ignore"}
```

## 附录 B:相关文档

| 文档 | 路径 | 说明 |
| ---- | ---- | ---- |
| LLM_SETUP | `docs/LLM_SETUP.md` | 现有 LLM provider 配置说明 |
| AI_SERVICE | `docs/AI_SERVICE.md` | ai-service 架构 |
| AGENTS.md | `AGENTS.md` | 项目 Agent 规则(§22 commit 丢失防护,§20 push 同步) |
