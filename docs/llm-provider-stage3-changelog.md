# LLM Provider 字典化 — 阶段 3 前置工作发布说明 + Changelog 草稿

> 范围:`apps/ai-service` LLM provider 配置体系
> 编写日期:2026-07-26
> 关联设计文档:`docs/llm-provider-dict-design.md`(单一 source of truth)
> 状态:阶段 3 **前置工作已完成**,主体工作待触发条件满足后执行

---

## 1. 概述

### 1.1 阶段 3 是什么

阶段 3 是 LLM provider 字典化改造的**收尾阶段**,目标是**完全删除** `apps/ai-service/app/core/config.py` 中 24 个 `*_api_key` + 7 个 `*_api_base` 扁平字段,只保留基于 `LLM_PROVIDERS_JSON` 的单一 JSON 配置源,实现"新增 provider 改动量 3 文件 → 0 文件业务代码,只改 .env"的最终目标(详见设计文档 §1.4 / §4.1)。

### 1.2 为什么需要阶段 3

阶段 2(2026-07-26 已完成)已经把 `Settings.get_provider_config()` 的返回类型从 `dict` 升级为 Pydantic 强类型 `ProviderConfig`,但**为了向后兼容,24+7 扁平字段仍然保留**(`config.py` L48-113,约 66 行)。这导致:

- 同一份 provider 配置存在两个 source of truth(扁平字段 + JSON),JSON 优先 + 扁平 fallback 容易掩盖配置错误
- `_PROVIDER_KEY_ALIASES`(cloudflare / github / vercel / opencode 命名不一致补丁)需永久维护
- 新增 provider 仍可能在 config.py 写入扁平字段(失去"零代码改动"收益)

阶段 3 通过删除扁平字段,强制所有 provider 走 JSON 路径,彻底收敛配置源。

### 1.3 触发条件

阶段 3 **主体工作不立即执行**,需等待以下条件**全部满足**:

1. 第 N+1 版本(含阶段 2 落地 + 阶段 3 前置工作)已发布
2. 所有生产 / 预发 / 开发环境的 `.env` 已通过迁移脚本升级为 `LLM_PROVIDERS_JSON` 格式
3. 守门脚本 `scripts/check-llm-provider-schema.mjs` 在所有环境运行 exit 0
4. 至少经过 1 个完整版本周期的观察,确认无扁平字段 fallback 路径被命中(可通过日志中 `DeprecationWarning` 计数判断,阶段 3 主体第 N+1 版本会加 warning)

### 1.4 与阶段 1 / 阶段 2 的关系

| 阶段 | 状态 | 范围 | 关键产物 |
| ---- | ---- | ---- | -------- |
| 阶段 1 | ✅ 已完成(2026-07-26) | 设计文档 + 最小 PoC(`LLMSettings` 子类 + `.env.example` 注释) | `docs/llm-provider-dict-design.md` |
| 阶段 2 | ✅ 已完成(2026-07-26) | 全量改造 `Settings` + Pydantic 强类型解析 + 迁移脚本 PoC | `apps/ai-service/app/core/provider_config.py` 新建 `ProviderConfig` BaseModel;`get_provider_config()` 返回类型 `dict → ProviderConfig`;12 核心 + 74 用例全绿(commit `f9ca34a60` / `60ef869e9`);迁移脚本 `scripts/migrate-llm-providers.mjs`(commit `3210dbf01`) |
| 阶段 3 前置(本批次) | ✅ 已完成(2026-07-26) | 守门脚本(warn-only) | `scripts/check-llm-provider-schema.mjs` |
| 阶段 3 主体 | 🟡 待触发 | 删除扁平字段 + fallback 路径 + 守门升级 blocking | 见 §3.2 |

> 注:`migrate-llm-providers.mjs` 已在 **阶段 2**(commit `3210dbf01`)随 `provider_config.py` 一同落地,本文档 §2.1 仅做引用说明,不再重复 CLI 文档。

阶段 1/2 完整设计、行为契约、风险评估请直接阅读 `docs/llm-provider-dict-design.md`,本文档不重复抄写,仅引用其结论。

---

## 2. 阶段 3 前置工作(本次完成)

本批次落地两个脚本,为阶段 3 主体工作铺路:**不修改任何业务代码**,100% 向后兼容。

### 2.1 迁移脚本 `scripts/migrate-llm-providers.mjs`(阶段 2 已落地,本节仅引用)

**状态**:**阶段 2 已完成**(commit `3210dbf01`,2026-07-26 14:27),随 `provider_config.py` 一同交付。本节不重复 CLI 文档,仅说明与阶段 3 的关系。

**职责**:把 `.env` 中的 24+ 个 `*_API_KEY` + 7 个 `*_API_BASE` 扁平字段(含 cloudflare/github 的 `*_TOKEN` 命名变体)合并为单一 `LLM_PROVIDERS='{...}'` JSON 字符串,生成 `.env.migrated` 文件,便于人工 diff + 替换原 `.env`。

**与阶段 3 的关系**:

- 阶段 3 主体执行时,用户需先运行 `node scripts/migrate-llm-providers.mjs --input apps/ai-service/.env --output apps/ai-service/.env.migrated --apply` 把扁平字段升级到 JSON(详见 §4.2)
- 阶段 2 阶段为了 100% 向后兼容,24+7 扁平字段**仍保留**在 `Settings` 类中(`config.py` L48-113),`get_provider_config()` 优先读 `LLM_PROVIDERS`,缺省 fallback 到扁平字段
- 阶段 3 主体将**删除** 24+7 扁平字段 + fallback 路径,详见 §3.2

**CLI 文档**:`node scripts/migrate-llm-providers.mjs --help`(参数:`--input <file>` / `--output <file>` / `--apply` / `--dry-run` / `--help`)。

### 2.2 守门脚本 `scripts/check-llm-provider-schema.mjs`

**用途**:校验 `.env` 中 `LLM_PROVIDERS` / `LLM_PROVIDERS_JSON` 字段是否符合 `ProviderConfig` schema(对应 `apps/ai-service/app/core/provider_config.py`),在启动前提前发现配置错误,避免运行时 Pydantic `ValidationError`。

**CLI 参数**:

| 参数 | 说明 | 默认 |
| ---- | ---- | ---- |
| `--env-file <path>` | 指定 `.env` 路径 | `apps/ai-service/.env` |
| `--strict` | 严格模式(未知 provider 报 error 而非 warning) | 否 |
| `--json` | JSON 输出(供 CI 解析) | 否 |
| `--help` / `-h` | 显示帮助 | — |

**退出码**:

- `0` — 无 error(允许 warning / info)
- `1` — 有 error(字段类型错 / JSON 解析错 / `--strict` 模式下未知 provider)
- `2` — 参数错误 / `.env` 文件不存在

> **Node.js 22+ 兼容性提示**:Node v22 内置 `--env-file` 参数会与脚本 `--env-file` 冲突。文件存在时 Node 透传参数(正常工作);文件不存在时 Node 直接 `exit 9`。文件不存在场景用 `--` 分隔符让脚本接管:`node scripts/check-llm-provider-schema.mjs -- --env-file <path>`。

**7 条校验规则**:

1. **JSON 解析**:必须是合法 JSON,否则列出错误位置
2. **顶层结构**:必须是对象(dict),key 是 provider name,value 是 config 对象
3. **provider name 白名单**:31 个已知 provider(与 `config.py` 同步);不在白名单 → warning,`--strict` 升级为 error
4. **字段类型校验**(每个 provider config):
   - `api_key`:字符串(空字符串允许)
   - `api_base`:字符串或 null
   - `enabled`:布尔值(禁止 `"true"` 字符串 / `0` / `1`)
   - `models`:字符串数组
   - `default_model`:字符串或 null
5. **未知字段**:允许(透传到 `extra`,如 `cloudflare_account_id`),info 提示
6. **空值检查**:`api_key=""` 且无 `api_base` → info 提示"该 provider 可能未配置"
7. **重复 provider**:`LLM_PROVIDERS` + `LLM_PROVIDERS_JSON` 同时配置时检测冲突

**使用示例**:

```bash
# 1. 默认校验 apps/ai-service/.env(warn-only,无 --strict 时未知 provider 只 warning)
node scripts/check-llm-provider-schema.mjs

# 2. 指定 .env 路径
node scripts/check-llm-provider-schema.mjs --env-file apps/ai-service/.env.migrated

# 3. 严格模式(CI 用,未知 provider 阻塞)
node scripts/check-llm-provider-schema.mjs --strict --json
```

**集成位置**:`.husky/pre-commit` 第 N+1 项,**当前 warn-only**(默认),阶段 3 主体升级为 blocking(详见 §3.2 步骤 3.4)。

### 2.3 验证流程

用户从扁平字段升级到 JSON 格式的完整步骤(顺序不可调换):

```bash
# Step 1: 备份原 .env(脚本不自动备份,需手动 cp)
cp apps/ai-service/.env apps/ai-service/.env.bak.$(date +%Y%m%d_%H%M%S)

# Step 2: dry-run 预览迁移结果(确认匹配到的 provider 数量正确)
node scripts/migrate-llm-providers.mjs --dry-run --input apps/ai-service/.env

# Step 3: 生成迁移后 .env(完整格式,含 LLM_PROVIDERS=... 一行)
node scripts/migrate-llm-providers.mjs --input apps/ai-service/.env \
  --output apps/ai-service/.env.migrated --apply

# Step 4: 守门脚本校验迁移后 .env(必须 exit 0)
node scripts/check-llm-provider-schema.mjs --env-file apps/ai-service/.env.migrated

# Step 5: 替换原 .env(确认 Step 4 通过后再执行)
mv apps/ai-service/.env.migrated apps/ai-service/.env

# Step 6: 启动 ai-service 验证(见 §4.4)
```

---

## 3. 阶段 3 主体工作(待触发条件满足后执行)

### 3.1 触发条件

详见 §1.3。简而言之:**第 N+1 版本发布后,所有用户已升级 .env 格式**。

判定方式(阶段 3 主体启动前需收集的证据):

- `git log --oneline` 确认第 N+1 版本已 tag 发布
- 抽样生产 / 预发 ai-service 日志,连续 7 天无 `DeprecationWarning`(扁平字段 fallback 命中时触发,阶段 3 主体第 N+1 版本会加 warning)
- 守门脚本在所有环境运行 exit 0

### 3.2 代码改动清单

引用设计文档 §6.3(原始表格在 `docs/llm-provider-dict-design.md` L310-318):

| 步骤 | 文件 | 操作 |
| ---- | ---- | ---- |
| 3.1 | `apps/ai-service/app/core/config.py` | 删除 24 个 `*_api_key` + 7 个 `*_api_base` 扁平字段(约 66 行,L48-113) |
| 3.2 | `apps/ai-service/app/core/config.py` | `get_provider_config()` fallback 路径删除,只保留 JSON 路径;同时清理 `_PROVIDER_KEY_ALIASES`(L15-20,6 行) |
| 3.3 | `apps/ai-service/.env.example` | 删除所有旧扁平字段注释(约 80 行) |
| 3.4 | `scripts/check-llm-provider-schema.mjs` | 升级为 blocking(失败阻止部署),集成位置 `.husky/pre-commit` 第 N+1 项 |
| 3.5 | 发布说明 + changelog | "Provider 配置已完全字典化,旧扁平字段已删除" |

**预期收益**(引用设计文档 §4):`config.py` 行数 155 → ~120(-35 行,-22%);新增 provider 改动量 3 文件 → 1 文件(.env)+ 0 行业务代码(-100%);开发者 onboarding 成本 -50%。

### 3.3 风险评估

引用设计文档 §5.1 风险矩阵,阶段 3 主体工作相关的核心风险:

| 风险 | 等级 | 触发条件 | 缓解措施 |
| ---- | ---- | -------- | -------- |
| 旧 .env 部署升级后 provider 失效 | 🟡 中 | 升级时 `LLM_PROVIDERS` 与扁平字段冲突,JSON 优先导致 fallback 不到 | 阶段 1 JSON 优先 + 扁平字段保留 → 兼容;发布说明 + changelog 提示(本文档即承担此角色) |
| `get_provider_config` 全局回归失败 | 🟡 中 | 改动方法签名 / 返回类型 | 阶段 2 已完成强类型改造 + 74 用例全绿;阶段 3 仅删除 fallback,方法签名不变 |
| `_PROVIDER_KEY_ALIASES` 误删导致命名不一致 provider 失败 | 🟡 中 | 阶段 3 清理别名时,cloudflare/github/vercel/opencode 仍依赖别名 | 阶段 3 启动前确认这 4 个 provider 已用 JSON 配置命名(白名单中 `cloudflare` / `github` / `vercel` / `opencode` 均已就位) |
| 多 agent 并行改 config.py 冲突 | 🟡 中 | 阶段 3 多 agent 同步删字段 | 按 `AGENTS.md` §11 多 Subagent 并行模式,每个 subagent 只改自己负责段;或单 agent 顺序执行(阶段 3 改动量小,推荐单 agent) |

**回滚方案**:阶段 3 主体如引发生产故障,通过 `git revert` 撤销删除扁平字段的 commit(遵循 `AGENTS.md` §22 禁止 `git reset --hard` / `git push --force`),扁平字段恢复后即恢复向后兼容。同时 `.env.bak.{timestamp}` 可作为兜底(用户侧)。

---

## 4. 用户升级指南

### 4.1 检查当前 .env 格式

打开 `apps/ai-service/.env`,检查是否存在以下任一情况:

- **扁平字段格式**(旧,需迁移):包含 `OPENAI_API_KEY=sk-...` / `ANTHROPIC_API_KEY=...` / `CLOUDFLARE_API_TOKEN=...` 等独立行
- **JSON 格式**(新,无需迁移):包含 `LLM_PROVIDERS='{...}'` 或 `LLM_PROVIDERS_JSON='{...}'` 单行

两者共存也属于"需迁移"(JSON 优先,扁平字段冗余,阶段 3 主体后扁平字段失效)。

### 4.2 运行迁移脚本

```bash
# 1. dry-run 预览(确认匹配到的 provider 数量与预期一致)
node scripts/migrate-llm-providers.mjs --dry-run --input apps/ai-service/.env

# 2. 备份原 .env(必须,脚本不自动备份)
cp apps/ai-service/.env apps/ai-service/.env.bak.$(date +%Y%m%d_%H%M%S)

# 3. 实际迁移:生成完整 .env(原内容 + LLM_PROVIDERS=... 一行)
node scripts/migrate-llm-providers.mjs --input apps/ai-service/.env \
  --output apps/ai-service/.env.migrated --apply

# 4. 人工 diff 确认(JSON 内容正确,扁平字段保留作为 fallback)
diff apps/ai-service/.env apps/ai-service/.env.migrated

# 5. 替换原 .env(确认 Step 4 无异常后)
mv apps/ai-service/.env.migrated apps/ai-service/.env

# 6. 守门脚本校验最终 .env(必须 exit 0)
node scripts/check-llm-provider-schema.mjs --env-file apps/ai-service/.env
```

### 4.3 运行守门脚本验证

```bash
# 校验迁移后 .env(必须 exit 0)
node scripts/check-llm-provider-schema.mjs --env-file apps/ai-service/.env

# 严格模式校验(推荐,捕获未知 provider)
node scripts/check-llm-provider-schema.mjs --env-file apps/ai-service/.env --strict
```

如出现 error:按提示修复 `.env` 中的 JSON 字段类型 / 格式,重跑直到 exit 0。

### 4.4 启动 ai-service 验证

```bash
# 1. 启动 ai-service(端口 8803,详见 docs/port-management.md)
pnpm --filter @ihui/ai-service dev

# 2. 验证 provider 配置已生效(返回 ProviderConfig 强类型对象)
python -c "from app.core.config import settings; print(settings.get_provider_config('openai'))"
# 预期输出:api_key='sk-...' api_base=None enabled=True models=[] default_model=None

# 3. 验证未知 provider 返回空配置(不抛异常)
python -c "from app.core.config import settings; print(settings.get_provider_config('unknown_provider'))"
# 预期输出:api_key='' api_base=None enabled=False models=[] default_model=None
```

### 4.5 回滚方案

如启动失败或 provider 调用异常:

```bash
# 1. 从备份恢复 .env
mv apps/ai-service/.env apps/ai-service/.env.failed
cp apps/ai-service/.env.bak.<timestamp> apps/ai-service/.env

# 2. 重启 ai-service
pnpm --filter @ihui/ai-service dev

# 3. 把失败 .env 提交给开发者排查(脱敏后)
# 提交前用 sed 脱敏 api_key:
# sed -i 's/sk-[a-zA-Z0-9-]*/sk-***/g' apps/ai-service/.env.failed
```

回滚后系统恢复扁平字段模式,阶段 2/3 的 JSON 路径不影响扁平字段读取(`get_provider_config()` 优先 JSON,JSON 未配置时自动 fallback 到扁平字段)。

---

## 5. 开发者指南

### 5.1 新增 provider 流程(阶段 3 后)

阶段 3 主体完成后,新增 LLM provider **零代码改动**,只需改 `.env`:

```bash
# 1. 在 apps/ai-service/.env 的 LLM_PROVIDERS JSON 中追加新 provider
# 例如新增 "my_new_provider":
LLM_PROVIDERS='{
  "openai":     {"api_key": "sk-...", "api_base": "https://api.openai.com/v1"},
  "my_new_provider": {"api_key": "sk-my-key", "api_base": "https://api.my-new.com/v1"}
}'

# 2. 守门脚本校验(若 provider name 不在 31 白名单,会 warning;--strict 会 error)
# 阶段 3 主体后,白名单需同步更新(scripts/check-llm-provider-schema.mjs PROVIDER_WHITELIST)
node scripts/check-llm-provider-schema.mjs --env-file apps/ai-service/.env

# 3. 重启 ai-service,通过 litellm 路由调用(模型前缀自动路由)
# 调用示例:litellm.completion(model="my_new_provider/my-model", ...)
```

**唯一需要改代码的场景**:新增 provider name 不在守门脚本白名单 → 需在 `scripts/check-llm-provider-schema.mjs` 的 `PROVIDER_WHITELIST` 追加(1 行)。这是守门需要,非业务代码。

### 5.2 调试技巧

- **看 ProviderConfig 强类型**:`get_provider_config('openai')` 返回 `ProviderConfig` 对象,IDE 有字段提示,可直接 `settings.get_provider_config('openai').api_key` 访问(无需 dict 取值)
- **启用 logging**:`config.py` 中 `get_provider_config()` 在 JSON 解析失败时会记录 warning;在 `llm_gateway.py` 调用点设置 `logging.getLogger('app.core.config').setLevel('DEBUG')` 可看完整 fallback 路径
- **本地复现**:复制生产 `.env` 到本地(注意脱敏 api_key),用 `--dry-run` 预览迁移结果,比对预期 provider 列表
- **守门脚本 JSON 输出**:`--json` 参数输出机器可读格式,可管道给 `jq` 解析,定位具体 error 字段

### 5.3 常见问题(FAQ)

**Q1:迁移后 `get_provider_config('cloudflare')` 返回空,但 `CLOUDFLARE_API_TOKEN` 已配置?**

A:检查迁移脚本生成的 JSON 中 `cloudflare` 的 `api_key` 字段是否为空。`cloudflare` 用 `*_TOKEN` 而非 `*_API_KEY`,迁移脚本已处理(`PROVIDER_KEY_FIELDS.cloudflare = 'CLOUDFLARE_API_TOKEN'`,脚本会读 `CLOUDFLARE_API_TOKEN` 而非 `CLOUDFLARE_API_KEY`)。若仍为空,确认 `.env` 中字段名是 `CLOUDFLARE_API_TOKEN`(全大写)而非 `cloudflare_api_token`。

**Q2:守门脚本 warning "provider 'xxx' not in whitelist",但该 provider 确实是我新加的?**

A:31 个白名单 provider 是从 `config.py` 扁平字段 + `_PROVIDER_KEY_ALIASES` 同步而来。新增 provider 需手动在 `scripts/check-llm-provider-schema.mjs` 的 `PROVIDER_WHITELIST` 追加(1 行)。阶段 3 主体后,白名单维护成本是新增 provider 唯一的代码改动。

**Q3:阶段 3 主体后,旧扁平字段 `.env` 还能用吗?**

A:**不能**。阶段 3 主体删除扁平字段后,`OPENAI_API_KEY=sk-...` 等独立行将被 Pydantic 忽略(`Settings` 类不再声明这些字段)。必须先运行迁移脚本升级为 `LLM_PROVIDERS_JSON` 格式,否则所有 provider 调用将返回空配置。这就是为什么阶段 3 主体需要等触发条件满足后才执行(§1.3)。

**Q4:迁移脚本 `--dry-run` 输出的 JSON 包含明文 api_key,安全吗?**

A:`--dry-run` 仅供本地调试,**禁止在公共 CI / 共享终端运行**。生产环境迁移应直接用 `--output` 写文件(不打印到 stdout),并对输出文件 `chmod 600`。

**Q5:阶段 2 已落地,为什么还需要阶段 3?不能一直保留扁平字段?**

A:保留扁平字段意味着两套配置源长期共存,1)新增 provider 仍可能被写到扁平字段(失去"零代码改动"收益);2)`_PROVIDER_KEY_ALIASES` 需永久维护;3)JSON 解析失败静默 fallback 容易掩盖配置错误。阶段 3 删除扁平字段强制收敛,是设计文档 §1.4 "3 文件 → 0 文件"目标的最终实现。

---

## 6. Changelog(发布说明草稿)

### [Unreleased] - 阶段 3 前置工作(2026-07-26)

#### Added
- `scripts/check-llm-provider-schema.mjs`:LLM_PROVIDERS JSON schema 守门脚本(本批次新建)
  - 支持 `--env-file` / `--strict` / `--json` 参数
  - 校验 7 条规则(JSON 解析 / 顶层结构 / provider name 白名单 / 字段类型 / 未知字段 / 空值 / 重复)
  - 退出码 0/1/2 三态,适合 CI 集成
  - 当前 warn-only,阶段 3 主体升级为 blocking
- `docs/llm-provider-stage3-changelog.md`:阶段 3 发布说明 + changelog 草稿(本文档,本批次新建)

#### Changed
- 无(阶段 3 前置工作不动现有代码,只新建守门脚本和文档)

#### Deprecated
- 无(扁平字段在阶段 3 主体才标记 Deprecated)

#### Removed
- 无(扁平字段在阶段 3 主体才删除)

#### Fixed
- 无

#### Security
- 守门脚本不读取 api_key 内容,仅校验字段类型

#### References
- `scripts/migrate-llm-providers.mjs`:阶段 2 已落地(commit `3210dbf01`),本批次引用不修改
  - CLI:`--input <file>` / `--output <file>` / `--apply` / `--dry-run` / `--help`
  - **安全提示**:`--dry-run` 会打印明文 JSON 到 stdout(含 api_key),仅本地调试,禁止公共 CI 运行
  - **功能边界**:不自动备份(需手动 `cp`)/ 不删除原扁平字段(`--apply` 追加 `LLM_PROVIDERS=...` 一行)/ 不脱敏 api_key
  - 阶段 3 主体可考虑增强:自动备份 / 删除原字段 / api_key 脱敏日志

### [Planned] - 阶段 3 主体(待触发条件满足后执行)

#### Removed
- `apps/ai-service/app/core/config.py`:删除 24 个 `*_api_key` + 7 个 `*_api_base` 扁平字段(约 66 行,L48-113)
- `apps/ai-service/app/core/config.py`:删除 `_PROVIDER_KEY_ALIASES` 字典(L15-20,6 行)
- `apps/ai-service/.env.example`:删除所有旧扁平字段注释(约 80 行)

#### Changed
- `apps/ai-service/app/core/config.py`:`get_provider_config()` fallback 路径删除,只保留 JSON 路径
- `scripts/check-llm-provider-schema.mjs`:升级为 blocking(失败阻止部署),集成位置 `.husky/pre-commit` 第 N+1 项

#### Deprecated
- 无(扁平字段已删除,无需 deprecation)

#### Migration Required
- 所有用户必须先运行 `scripts/migrate-llm-providers.mjs` 升级 `.env` 格式(详见 §4.2 用户升级指南)
- 升级后运行 `scripts/check-llm-provider-schema.mjs --strict` 校验 exit 0
- 未迁移的 `.env` 在阶段 3 主体部署后会导致所有 provider 调用返回空配置

---

## 附录:相关文档

| 文档 | 路径 | 说明 |
| ---- | ---- | ---- |
| 设计文档(source of truth) | `docs/llm-provider-dict-design.md` | 阶段 1/2/3 完整设计、行为契约、风险评估 |
| LLM 配置说明 | `docs/LLM_SETUP.md` | 现有 LLM provider 配置用户文档 |
| ai-service 架构 | `docs/AI_SERVICE.md` | ai-service 整体架构 |
| 项目 Agent 规则 | `AGENTS.md` | §22 commit 丢失防护 / §20 push 同步 / §11 多 Subagent 并行 |
