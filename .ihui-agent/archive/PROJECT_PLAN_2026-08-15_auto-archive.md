<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# PROJECT_PLAN 归档副本(2026-08-15_auto-archive)
<!-- 本文件是 2026-09-25 由 git 历史**逐字找回**的归档副本:每条正文上方保留 `recovered from <提交>` 出处注释,
     复核方法 = 该正文逐字存在于所引提交的父版本 PROJECT_PLAN.md 里(独立脚本核过,无一处编造)。
     它补的是 §1「完整内容在 .ihui-agent/archive/」这句承诺此前落空的格子 —— 原归档文件从未入库。 -->

<!-- recovered from 924a477d155ddfaf3146086a2c33c9c603e45653 , verbatim-in-parent: yes --> (via placeholder-rewrite chain: b129e09482)
<!-- method: label-section-from-parent; needle-line-removed-confirmed -->
<!-- block-bytes: 3009 -->
### [x] ✅(2026-07-31) 模型名自动更新(ModelSyncService,Phase E 增量,用户反馈"模型名应该是自动更新啊 怎么还需要手动去调呢 这要开发好")

> **背景**:用户反馈模型名应自动同步,不应依赖手动改 `default_models.json`。本任务服务化 `scripts/scan-upstream-models.mjs`(一次性 CLI 扫描脚本)为 Python 后台服务,定时从厂商 `/v1/models` 端点拉取最新模型清单,自动注册到 DB(`ai_model_config_models` 表),实现"模型名自动更新,新增 provider 只需在 `free_provider_registry.py` 登记 + 配置 api_key,无需手动改任何文件"。

- [x] `apps/ai-service/app/services/model_sync.py`(新增):`ModelSyncService` 单例,启动后 60s 首次同步 + 每 6h 全量同步;并发信号量限流(5 个 provider 同时拉);DB upsert(新增模型 `is_relay_public=true` 自动上架,移除模型 `is_relay_public=false` 自动下架,不删行保留历史);同步后触发 `model_availability._refresh_all_providers()` 立即刷新健康状态
- [x] Cloudflare Workers AI 适配(非标准 API):`/v1/models` 端点返回 405 → 改用 `/models/search` + 响应 `result` 字段(非 `data`);剥离 trailing `/v1` 后缀避免用户配置 `api_base` 习惯性带 `/v1` 拼出错误端点
- [x] `apps/ai-service/app/main.py`:lifespan startup 调 `model_sync_service.initialize()` 启动后台任务,shutdown 调 `shutdown()` 取消任务
- [x] `apps/ai-service/app/routers/llm.py`:新增 2 个 admin 端点 — `POST /api/llm/models/sync`(手动触发全量同步)+ `GET /api/llm/models/sync/status`(查询同步状态,含每个 provider 的 success/total_models/new_models/removed_models/error/latency_ms)
- [x] `packages/api-client/src/endpoints/llm.ts`(已在 commit `04e5054339` 中):新增 `ModelSyncResult` / `ModelSyncStatus` 接口 + `triggerModelSync()` / `fetchModelSyncStatus()` API 函数
- [x] `apps/web/app/(main)/settings/gateway/ProvidersHealthTab.tsx`:集成 useQuery(10s refetch 同步状态)+ useMutation(触发同步),UI Card 显示最近同步时间 + 5 个 provider 同步结果(Badge 标识总数/+新增/-下架/latency),"立即同步"按钮(spinner + disabled 状态)
- [x] `apps/web/app/(main)/settings/gateway/types.ts`:re-export `ModelSyncResult` / `ModelSyncStatus` 类型
- [x] `apps/ai-service/app/data/default_models.json`:降级为兜底清单(每 provider 1-2 个推荐模型),头部加 `_doc_2026_07_31` 字段说明"实际模型清单由 ModelSyncService 自动同步到 DB,无需手动改本文件"
- [x] 端到端验证:ai-service 启动后 60s 自动触发首次同步,实测 7.4s 同步完成 5 个 provider — stepfun(9) / agnes(6) / openrouter(364) / nvidia_nim(102) / cloudflare_workers_ai(61,修复 405 后);GET `/api/llm/models/sync/status` 返回 200 + 完整 status JSON;前端 DOM 快照验证 "模型自动同步" Card + "立即同步" 按钮可点击 + 无蓝色发光边框
- [x] typecheck 全绿:`pnpm --filter @ihui/web typecheck` exit 0;`python -m py_compile` 全文件 exit 0

<!-- recovered from 924a477d155ddfaf3146086a2c33c9c603e45653 , verbatim-in-parent: yes --> (via placeholder-rewrite chain: b129e09482)
<!-- method: label-section-from-parent; needle-line-removed-confirmed -->
<!-- block-bytes: 7616 -->
### [x] ✅(2026-07-31) ModelSyncService 深度优化 v2(15 项,Phase E v2,用户反馈"继续优化 深度优化开发 远远不够",4 subagent 并行)

> **背景**:Phase E v1 上线后深度审视发现 15 个真实不足(无事务 / 无重试 / 无历史 / Cloudflare 字符串匹配 / 无单 provider 同步 / 无 dry-run / 硬编码配置 / display_name 简陋 / pricing 单 schema / context_length 单 fallback / 无分类标签 / 无价格过滤 / 无别名映射 / 前端无 diff 详情 / 前端无单 provider 按钮)。本任务 4 subagent 并行深度优化,4 Phase 一次到位。

#### F1 数据可靠性(4 项)— subagent-1 后端

- [x] F1.1 DB 事务包裹 upsert:`_upsert_models_to_db` 用 `async with conn.transaction():` 包裹整个流程(查 config + 查 existing + INSERT + UPDATE + 下架),中途失败回滚不留脏数据
- [x] F1.2 失败重试机制:`_sync_single_provider` 加重试循环,`_RETRY_BASE_DELAYS = (1.0, 2.0, 4.0)`,只重试 `httpx.TimeoutException`/`httpx.NetworkError`,4xx 不重试(key 无效不重试)
- [x] F1.3 同步历史持久化:新增 `_write_sync_log` + `get_history(limit=20)`,写入 `ai_model_sync_log` 表(由 subagent-2 创建);表不存在时 try/except 静默降级(不影响主流程)
- [x] F1.4 Cloudflare 改用 provider_code 判断:`_fetch_upstream_models` 接收 `provider_code` 参数,用 `provider_code == "cloudflare_workers_ai"` 替代 `if "api.cloudflare.com" in base_url` 字符串匹配

#### F2 同步能力增强(4 项)— subagent-1 后端

- [x] F2.1 单 provider 同步端点:`POST /api/llm/models/sync?provider=stepfun`(query param,可选),`ModelSyncService.sync_single_provider(provider_code)` 新方法
- [x] F2.2 dry-run 预览模式:`sync_all_providers`/`sync_single_provider` 加 `dry_run: bool=False` 参数;返回结构增加 `preview: {new_model_ids, removed_model_ids}` 字段;端点 `POST ?dry_run=true` 触发预览(不写 DB)
- [x] F2.3 调度配置可调:`config.py` 新增 `model_sync_interval_s: int = 21600`(默认 6h,admin 可通过 .env 调整);`_sync_interval_s()` 读取
- [x] F2.4 并发限流可配:`config.py` 新增 `model_sync_concurrency: int = 5`;`_sync_concurrency()` 读取

#### F3 模型元数据增强(6 项)— subagent-1 后端

- [x] F3.1 display_name 智能派生:`_extract_display_name(model_id, raw_name)` — 优先 raw_name,否则从 id 派生(`gpt-4o-mini` → `GPT 4o Mini`,`claude-3-5-sonnet` → `Claude 3.5 Sonnet`,`llama-3.3-70b-instruct` → `Llama 3.3 70B Instruct`)
- [x] F3.2 多 provider pricing schema:`_extract_pricing(provider_code, model)` — OpenRouter(prompt/completion 字符串)、Cloudflare(input/output 浮点数)、NVIDIA NIM(metadata.input_cost_per_token)、其他(0,0)
- [x] F3.3 context_length 多层级 fallback:`_extract_context_length(model)` — 6 级(context_length → context_window → top_provider.context_length → max_input_tokens → metadata.max_input_tokens → 32000)
- [x] F3.4 模型分类标签:`_classify_model(model_id, raw_model)` — vision/tool/reasoning/fast/embedding/chat;`_check_tags_column_exists` 查 information_schema 确认 tags 字段是否存在(带缓存),存在则写入 DB,不存在则只在内存返回
- [x] F3.5 价格上限过滤:`MAX_PRICE_PER_1K_TOKENS = 100`(cents,即 $1/1k tokens),超过跳过 INSERT 并 log warning
- [x] F3.6 模型别名映射:`_apply_alias(model_id, provider_code)` — OpenRouter 剥离 `openai/`/`anthropic/`/`google/`/`meta/` 等前缀(`openai/gpt-4o` → `gpt-4o`);is_aliased=True 时 display_name 加 `(原: xxx)` 备注

#### F4 前端体验增强(4 项)— subagent-3 前端

- [x] F4.1 同步详情可展开:`SyncDiffDetail` 子组件(可折叠),每个 provider 同步行可点击展开,显示 `new_model_ids`(绿色 Badge)+ `removed_model_ids`(红色 Badge),ChevronRight 旋转指示状态
- [x] F4.2 单 provider 同步按钮:`ProviderRow` 子组件右侧加 RefreshCw 按钮,点击触发 `triggerModelSync({ provider })`;`syncingProviders: Set<string>` 跟踪 in-flight,spinner 只显示在对应行
- [x] F4.3 dry-run 预览 UI:"立即同步"旁加"预览同步"按钮(Eye 图标),触发 `triggerModelSync({ dry_run: true })`;返回后弹出 Dialog 显示"将新增 X 个 / 将下架 Y 个"+ 模型清单;用户确认后再点"立即同步"实际执行
- [x] F4.4 同步历史时间轴:`SyncHistoryTimeline` 子组件(默认折叠),展开时调 `fetchModelSyncHistory(10)`;时间轴样式(左侧 absolute span 时间线 + 装饰圆点 + 右侧内容);`Intl.DateTimeFormat` 格式化时间

#### 配套(DB schema + 单测)— subagent-2 + subagent-4

- [x] DB schema(subagent-2):新增 `packages/database/src/schema/ai-model-sync-log.ts`(Drizzle pgTable,11 字段 + 2 索引)+ `index.ts` re-export + migration `20260801010080_add_ai_model_sync_log.sql`(CREATE TABLE IF NOT EXISTS 幂等);migration 已在本地 PostgreSQL 执行成功(11 列 + 3 索引实测可见)
- [x] pytest 单测(subagent-4):`apps/ai-service/tests/test_model_sync.py`(320 行,6 个测试类,50 个测试用例)— `_parse_price`(16)/`_extract_display_name`(6)/`_extract_pricing`(6)/`_extract_context_length`(8)/`_classify_model`(9)/`_apply_alias`(5);50 passed in 0.88s 全绿

#### 端到端验证

- [x] 后端 API 实测:`POST /api/llm/models/sync?provider=stepfun` → 200,`total_models=9, latency=221ms`;`GET /api/llm/models/sync/history?limit=10` → 200,实际返回 1 条 stepfun 同步记录(`{"provider_code":"stepfun","sync_started_at":"2026-07-31T08:18:19Z","success":true,"total_models":9,"latency_ms":221}`);dry-run 预览正确返回 `preview: {new_model_ids:[], removed_model_ids:[]}` 不写 DB
- [x] 全量 dry-run 测试:5 provider 全部成功 — stepfun(9) / agnes(6) / openrouter(364,识别 tags=[chat,fast,reasoning,tool,vision]) / cloudflare_workers_ai(61,F1.4 provider_code 判断生效) / nvidia_nim(102)
- [x] typecheck 全绿:`pnpm --filter @ihui/web typecheck` exit 0(本任务文件零错误);`pnpm --filter @ihui/api-client typecheck` exit 0;`python -m py_compile` 全文件 exit 0;`pytest tests/test_model_sync.py` 50 passed
- [x] Subagent D(AigcPublishScreen 真实文件上传):
  - 安装 expo-image-picker ~8.1.0(与 expo 53 兼容)
  - packages/api-client/src/endpoints/files.ts(新建):uploadFileMultipart/UploadedFile/resolveFileUrl
  - apps/mobile-rn/app.json:配置 expo-image-picker photosPermission/cameraPermission
  - apps/mobile-rn/src/screens/AigcPublishScreen.tsx:接入真实相册选择 + 上传,保留 URL 输入 fallback
- [x] 主 agent RecruitmentScreen 简化:
  - 删除 pickStr/pickStrArr 类型守卫函数(29 行 -> 0 行)
  - 新增 parseCategory 类型守卫(将 string 映射到 TABS category 联合类型)
  - mapCareerToJob 直接用强类型字段(item.company || '—' 替代 pickStr(item.company, '—'))
  - TABS 启用真实 category 筛选(activeTab='all' 显示全部,其他按 job.category 过滤)

技术细节:

- 4 subagent 并行(A+C+D 同时启动,B 依赖 A 完成后主 agent 处理)
- 类型零技术债:无 any,FormData.append 用 as never 绕过 RN 平台特性(非 any 兜底)
- expo-image-picker 8.x API 适配(result.cancelled 英式拼写,result.uri 直接访问,无 assets 数组)
- uploadFileMultipart 直接用 native fetch(fetchApi 不支持 FormData body)
- migration 因预存 drizzle 元数据腐败(_journal.json idx 132-151 snapshot 缺失)跳过,待后续修复

验证: pnpm --filter @ihui/api-client typecheck exit 0 + pnpm --filter @ihui/database build exit 0 + mobile-rn 3 screen(Recruitment/LiveHost/AigcPublish)typecheck 全绿。
阶段7 总降本: 0.2x(3.1x -> 2.9x),累计八阶段 6.8x -> 2.9x(降本 3.9x,57.4%)。

<!-- recovered from 924a477d155ddfaf3146086a2c33c9c603e45653 , verbatim-in-parent: yes --> (via placeholder-rewrite chain: b129e09482)
<!-- method: label-section-from-parent; needle-line-removed-confirmed -->
<!-- block-bytes: 2799 -->
### [x] ✅(2026-07-31) ModelSyncService 深度优化 v4(8 项,Phase E v4,用户反馈"继续按你的建议去做执行，最多agent并行开发最大化效率，要求完美细致完整毫无遗漏")

> **背景**:v3 上线后深度审视发现 8 个运维控制 + 可观测性 + 前端体验 + 文档测试缺口:无重置端点 / 无运行时配置更新 / 无聚合统计 / 无日志清理 / 无重启用 UI / 无配置面板 / 无统计卡片 / 无清理按钮 / README 未同步 / 测试覆盖不足。本任务 4 subagent 并行深度优化。

#### F5 运维控制(4 项)— subagent-A 后端

- [x] F5.1 重置 provider 端点:`POST /api/llm/models/sync/reset?provider=xxx`,reset_provider() 清零失败计数 + 移除永久禁用 + 清除 ETag 缓存
- [x] F5.2 运行时配置更新:`PUT /api/llm/models/sync/config`,update_config() 动态调整 interval_s/concurrency(无需重启,两参数都 None 时 raise ValueError)
- [x] F5.3 聚合统计端点:`GET /api/llm/models/sync/stats?days=7`,get_aggregated_stats() 查 sync_log 表聚合成功率/延迟/新增下架(days 上限 90)
- [x] F5.4 日志清理端点:`DELETE /api/llm/models/sync/history?before_days=30`,cleanup_old_logs() 删除旧日志 + sync_loop 自动清理(每次全量同步后)

#### F6 前端运维 UI(4 项)— subagent-B 前端

- [x] F6.1 重启用按钮:ResetProviderButton 嵌入 SyncHealthPanel 永久禁用列表 + 确认 Dialog + toast + invalidate query
- [x] F6.2 配置面板:SyncConfigPanel(number input 间隔+并发 + Save 按钮 + 客户端预校验 60-86400/1-20 + 友好提示)
- [x] F6.3 聚合统计卡片:SyncStatsCard + SyncStatsGrid(7/30/90 天 Tabs + 8 指标网格 + 成功率三色 + by_provider 5 列明细表)
- [x] F6.4 手动清理按钮:CleanupHistoryButton 嵌入 SyncHistoryTimeline 底部 + 确认 Dialog(含 before_days 输入)+ toast

#### F7 文档 + 测试(2 项)— subagent-C + subagent-D

- [x] F7.1 README 同步:新增"模型自动同步(ModelSyncService)"章节(9 项核心能力 + 8 端点表格 + 2 配置项表格)+ .env.example 配置块
- [x] F7.2 测试覆盖:4 个新测试类 25 个用例(TestResetProvider 5/TestUpdateConfig 10/TestGetAggregatedStats 5/TestCleanupOldLogs 5)+ skipif 守卫

#### 端到端验证

- [x] 后端 API 实测:4 个新端点 py_compile exit 0 + 4 个 service 方法存在性检测通过 + reset_provider/update_config 功能自验通过
- [x] typecheck 全绿:pnpm --filter @ihui/api-client typecheck exit 0 + pnpm --filter @ihui/web typecheck exit 0 + py_compile 双文件 exit 0
- [x] pytest 全绿:test_model_sync.py 173 passed in 0.63s(148 原有 + 25 新增,0 skipped,0 failed)
- [x] 主 agent 集成修复:3 处契约偏差修复(update_config both-None ValueError / reset_provider pop 兼容 / get_aggregated_stats 结构验证)

<!-- recovered from 924a477d155ddfaf3146086a2c33c9c603e45653 , verbatim-in-parent: yes --> (via placeholder-rewrite chain: b129e09482)
<!-- method: label-section-from-parent; needle-line-removed-confirmed -->
<!-- block-bytes: 4750 -->
### [x] ✅(2026-07-31) 用户可输入 `ihui` 全局命令 + 一键启动 dev 栈

用户要求:"本项目的cli端怎么使用 在我的电脑powershell里输入什么啊" + "继续按你的建议去做执行,最多agent并行开发最大化效率,要求完美细致完整毫无遗漏 然后我直接可以输入ihui为止"。**目标:PowerShell / cmd / Git Bash 任意终端输入 `ihui --version` 即可调用本地 @ihui/cli 开发模式**(无需手动 `cd G:\IHUI-AI ; pnpm --filter @ihui/cli dev`)。

- [x] **全局命令注册**(用户主目录,不在仓库内):
  - `C:\Users\Administrator\AppData\Roaming\npm\ihui.cmd` — cmd.exe / Git Bash 入口,`cd /d G:\IHUI-AI` + `pnpm --filter @ihui/cli dev %*`
  - `C:\Users\Administrator\AppData\Roaming\npm\ihui.ps1` — PowerShell 入口,Push-Location + pnpm + Pop-Location 错误时还原
  - 两个文件均做路径校验(`Test-Path package.json`),不存在时 exit 127 + 友好错误信息
- [x] **CLI 持久化配置**:`C:\Users\Administrator\.ihui\settings.json` — 7 字段(`apiUrl / apiKey / defaultModel / locale / maxIterations / auditEnabled`),CLI 启动时 dotenv 读入,免除每次传 `--api-key` `--model`
- [x] **全链路验证通过**:
  - `where.exe ihui` → `C:\Users\Administrator\AppData\Roaming\npm\ihui.cmd` ✅
  - `Get-Command ihui` → `ihui.ps1` ExternalScript ✅
  - `ihui --version` → `1.0.0`(通过 pnpm tsx 启动 src/index.ts)✅
  - `ihui --help` → 完整 25 个选项 + 6 个子命令(chat / agent / init / sessions / mcp / capabilities)✅
  - web 8801: HTTP 200 ✅ / api 8802: `/api/health` → `{"status":"ok","service":"@ihui/api"}` ✅ / ai 8803: `/health` → `{"status":"ok","service":"ihui-ai-service"}` ✅
- [x] **修复 cli 循环依赖 TDZ**(commit 包含):
  - `apps/cli/src/tools/git-shared.ts`(新建):抽离 `execGit / formatGitResult / GitExecResult` 三个共享定义,打破 git.ts ↔ git-advanced.ts 循环引用(原 `ReferenceError: Cannot access 'GIT_ADVANCED_TOOLS' before initialization`)
  - `apps/cli/src/tools/git.ts`:删本地重复实现 34 行,改 import 自 git-shared
  - `apps/cli/src/tools/git-advanced.ts`:execGit/formatGitResult 改 import 自 git-shared(不再 import git.ts)
- [x] **一键启动 dev 栈**:`scripts/start-ihui-stack.ps1`(新建,本任务含 2 轮修复):
  - 派生 web(8801) + api(8802) + ai-service(8803) 三个 Start-Process 后台进程,日志重定向 `.trae-cn/tmp/ihui-stack-<svc>-<timestamp>.log`,Start-Job tail 实时三色输出到终端,Ctrl+C 优雅全停
  - 支持 `-Skip <web|api|ai>` / `-Only <web|api|ai>` / `-WhatIf` / `-Status` / `-Help` 五种参数
  - PID 文件 `.trae-cn/tmp/ihui-stack-pids.json` 记录每个服务的 PID/cwd/cmd/args/started_at
  - **修复 1(IPv6 检测)**:Next.js dev server / uvicorn 在 Windows 默认只绑 IPv6 `[::1]`,而 `Get-NetTCPConnection` 在 PS 5.1 上默认只查 IPv4 → `-Status` 误报 DOWN。增加 netstat 兜底 + `Test-NetConnection` 主动连接双兜底
  - **修复 2(UTF-8 BOM)**:PowerShell 5.1 中文 Windows 默认按 GBK 解析无 BOM UTF-8,中文乱码导致 "String is missing the terminator" 语法错误。`[System.IO.File]::WriteAllText` + `UTF8Encoding($true)` 重写加 BOM,中文正常解析
  - **验证**:`-Status` 实际跑出 `WEB-8801 UP (PID=19016) / API-8802 UP / AI-8803 UP (PID=26204)` ✅

关键设计:

- `ihui.cmd` + `ihui.ps1` 路径用环境变量 `$env:APPDATA`(Windows) / `$HOME/.local/bin`(POSIX) 标准位置,无需修改 PATH(`%APPDATA%\npm` 已在 PATH 中)
- settings.json 用 dotenv 风格(CLI 启动时 `loadSettings()` 合并到 process.env),不污染全局环境变量
- start-ihui-stack.ps1 不替代 `pnpm dev`,只包装"前台聚合日志 + 优雅停止",CI / 后台用 `pnpm turbo run dev` 仍走标准路径
- IPv6 修复兼容 PS 5.1 + PS 7(PowerShell 7+ `Get-NetTCPConnection -AddressFamily` 也支持,但兜底逻辑同时兼容)

Git 同步证据(§20 硬定义 5 条全绿,1 commit + 隐式 0 净增 + 1 后续 push 自动同步):

- `b4cd463987` fix(cli): 打破 git.ts <-> git-advanced.ts 循环依赖,新增 start-ihui-stack.ps1(后续被其他 agent 自动 merge 同步到 origin/main,含 IPv6 修复 + UTF-8 BOM)
- local HEAD == origin HEAD: `2b783a4579` ✅
- `node scripts/git-push-guard.mjs` 隐式通过(HEAD == origin/main)
- 工作区 22 个 M/D 改动属其他 agent(ai-service + miniapp-taro + web 多个组件),按 §12 多 agent 规则不动

影响文件:1 commit / 4 files changed(start-ihui-stack.ps1 新建 640 行 / git-shared.ts 新建 60 行 / git.ts 改 19 行 / git-advanced.ts 改 4 行);用户主目录 2 个包装脚本(不参与 git track);settings.json 1 个配置文件(不参与 git track)。

后续用法(用户已可立即使用):

```powershell

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
