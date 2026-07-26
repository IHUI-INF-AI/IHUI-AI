# IHUI-AI 项目

> 本文件为项目唯一任务计划文档。规则见 [AGENTS.md](./AGENTS.md)。
> 历史归档:本文件精简前 54.6 KB(2026-07-20 含权限运行时拦截完整内容)已移至 `.trae-cn/archive/PROJECT_PLAN_2026-07-20_pre-permission-runtime.md`;更早快照同目录;详细提交记录见 `git log`。
> 2026-07-20 publish-task 批次归档:16 个已完成大块(自媒体工作台整合 / 侧边栏分组整合 / SiteFooter i18n / M-71 / M-72 / M-65 v2 / 首页 6 UI / 侧边栏折叠 / CLI 配置导入 / 工作区权限运行时拦截 / M-70 / BrandMarquee / 架构迁移整合 / SiteFooter v6 / i18n P1 2_5 / 全站 hover 提示)移至 `.trae-cn/archive/PROJECT_PLAN_2026-07-20_publish-task-archive.md`,本文件从 63.3 KB 缩减至 ~20 KB。

---

> 📌 **2026-07-26 状态**:所有历史任务已完成并归档(109 个标准格式 + 6 个非标准格式执行报告)。本文件目前**无活跃任务**。所有归档内容在 `.trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md` 等归档文件中,可通过 `git log` 或归档目录检索。下方为已归档任务的 HTML 占位注释(按 AGENTS.md §1 规则保留,不可删除)。

---

## 平台独占豁免标注(2026-07-26 立,AGENTS.md §9 配套)

> 以下端因天然属性豁免多端同步开发规则(AGENTS.md §9),`scripts/check-multi-end-sync.mjs` 守门可据此跳过 warn:
>
> - **apps/desktop 平台独占豁免**:Tauri 桌面端,空壳待开发,仅桌面系统托盘/原生菜单等桌面专属能力,不参与 web/api/ai-service 跨端契约同步
> - **apps/ai-service 平台独占豁免**:跨语言 Python 服务(FastAPI + LangGraph + LiteLLM + MCP),与 TS monorepo 共享 schema/types 但独立于前端构建链,不参与 web/api 的 TS typecheck/lint/build 同步

---

## §1 后续任务建议(2026-07-26 维护成本优化批次)

> 2026-07-26 维护成本优化批次(死 key 审计 + LLM 字典化阶段 1)完成后衍生 P2 任务清单。

### P2 维护成本优化后续

- [x] ✅(2026-07-26) i18n 死 key 清理 — 2 轮共清理 36 个死 key(commit 345f3253d 清 19 个 n8nAgentsPage + commit 60a664658 清 17 个 design/modelsBillingPage/modelsGroupsPage/modelsReferralPage),5 语言同步,`scan-dead-i18n-keys.mjs` 复扫死 key=0(0.0%),`--exit 1` 待挂 CI
- [x] ✅(2026-07-26) LLM provider 字典化阶段 2 全量改造 — `ProviderConfig` Pydantic BaseModel + `get_provider_config()` 返回强类型 + 12 个核心测试全绿(commit f9ca34a60 G1 闭环 + commit 60ef869e9 24+7 provider 独立单测),详见 `docs/llm-provider-dict-design.md` §2.2.1 / §6.2
- [x] ✅(2026-07-26) LLM 字典化闭环 PoC(G1+G2)— G1 业务代号字典 51 条 DOMAIN_ALIASES(`apps/ai-service/app/core/prompt_dict.py` + `project_memory.py` 注入 + `persona_registry.py` 集成),G2 LLM 自由输出统一 JSON Schema(`llm_gateway.structured_completion()` + OpenAI `response_format: { type: "json_schema" }` + `spec_generator.split_tasks` 迁移 + 15 个单测);commit `2621e7bff` G2(本地 `26d83555e` 经他 agent rebase),53 个 pytest 全绿,README 字典化三层能力对照表
- [x] ✅(2026-07-26) LLM provider 字典化阶段 3 主体 — **主体已完成**:删除 `config.py` 24 个 `*_api_key` + 7 个 `*_api_base` 扁平字段 + `_PROVIDER_KEY_ALIASES` + `_warned_providers` set,简化 `get_provider_config()` 只走 JSON 路径(失败返回空 `ProviderConfig`);升级 `guardian-runner.mjs` 第 33 项 mode `warn` → `blocking`(LLM_PROVIDERS schema 不合规阻塞 commit);修复下游 7 文件对已删字段引用(`llm_gateway.py` `_is_stub_mode` 改 `get_provider_config` / `mcp_server.py` image_generation tool 改 `get_provider_config` / `conftest.py` autouse fixture / `test_provider_config.py` 删 fallback 测 + 加 JSON 路径测 / `test_config.py` 改 `get_provider_config` 断言 + 重命名 3 函数 / `test_pr_reviewer.py` 改 `LLM_PROVIDERS` env);多 subagent 并行修复 6 测试文件 123 处扁平字段引用(`test_llm_gateway.py` 69 处→41 处 JSON 合并 + 1 处 `partial_done` 断言对齐 / `test_free_providers.py` 35 处含 cloudflare `account_id`→`api_base` URL 内嵌 + 14 个免费 provider / `test_mcp_server.py` 4 处 / `test_image_generation_save.py` 8 处 / `test_vector_memory.py` 6 处 / `test_config.py` 3 处函数重命名);`.env.example` 删 89 行旧扁平字段注释 + 加 32 行 `LLM_PROVIDERS` 配置说明;**前置工作已完成 3/3**:① `scripts/migrate-llm-providers.mjs`(`--backup`/`--strip-flat`/`--redact` flags);② `scripts/check-llm-provider-schema.mjs` 守门(blocking 模式,297 行 / 7 条校验规则 / 31 provider 白名单);③ `docs/llm-provider-stage3-changelog.md` 6 章节发布说明(385 行);验证:本任务 496 pytest 全绿(test_llm_gateway + test_free_providers + test_mcp_server + test_image_generation_save + test_config + test_provider_config + test_pr_reviewer)+ `check-llm-provider-schema.mjs` 0 error + config import OK,详见 `docs/llm-provider-stage3-changelog.md` §3
- [x] ✅(2026-07-26) G4 知识查询统一门面 PoC — `apps/ai-service/app/services/knowledge_lookup.py`(301 行):`knowledge_lookup(query, *, user_id, repo_id, session_id, top_k_per_source, source_priority, api_token)` 并发查 codebase_indexer / RAG / long_term_memory 三源,聚合为 `KnowledgeLookupResult(hits, errors, duration_ms)`,按 `source_priority` 排序,IO 失败降级返回空(`§3` 最小化 PoC:门面 + 单测 + README,**不接入调用点**,迁移留后续 task);25 个单测全绿(三源成功 / 各源失败降级 / 全失败 / 空结果 / priority 自定义 / priority 子集 / 无效源 ValueError / user_id 跳过 LTM / 参数透传 / 格式化函数 / 常量);commit `d28eb442d`,247/247 联合测试全绿(test_knowledge_lookup + test_rag + test_long_term_memory + test_codebase_indexer),README 字典化三层→四层能力对照表(L4 知识查询门面)
- [x] ✅(2026-07-26) G4 完整迁移 — ① `RAGService.retrieve_only()` 公有方法(20 行,委托 `_retrieve`,替代 PoC 私有调用)+ 5 单测;② `knowledge_lookup.py._query_rag` 从 `_retrieve` 迁移到 `retrieve_only()` + 更新模块 docstring + 修测试 mock 路径;③ 新 `app/services/agent_tools.py`(132 行)`make_knowledge_lookup_tool()` 工厂,把 `knowledge_lookup` 包成 `ToolDefinition`,`AgentLoopV2` 调用方一行接入(闭包绑定 user_id/repo_id 等,LLM 只控 query+top_k,空 query/ValueError 降级返回 error dict,hits 不含 raw)+ 14 单测;④ README G4 章节升级 PoC→完整迁移 + L4 状态升级;⑤ 验证 44 个新单测全绿 + 联合 278/278 全绿;commit `bf8e61ade`,多 subagent 并行(Subagent A:retrieve_only + Subagent B:agent_tools 工厂 + 主 agent:迁移整合)
- [x] ✅(2026-07-26) G5 生产调用点接入 — `mcp_server.py` 三处改动:① 新增 `_tool_knowledge_lookup(arguments)` 函数(89 行,包装 `knowledge_lookup`,空 query/ValueError 降级,`top_k_per_source` clamp 1-20,hits 不含 raw);② 注册到 `_TOOLS`(MCPTool schema,query required + top_k_per_source optional 1-20);③ 注册到 `_TOOL_HANDLERS`(handler 调度表)。不在 `_ADMIN_ONLY_TOOLS`(查询类,所有用户可用,类比 search_codebase)。服务端固定 `user_id`/`session_id`/`repo_id`=None(mcp_server `call_tool` 无 session context 注入,跳过 LTM 源,后续架构改动再接入)。`test_mcp_server.py` 新增 20 个测试(注册 4 + 执行 13 + MCPServer 调度 3);验证 35/35 本任务测试全绿 + 联合 313/313 全绿(2 个 image_generation 失败是其他 agent config.py 改动,§12 隔离);commit `9a86814ae`,README G4+G5 章节合并 + L4 状态升级 G4 完整迁移 → G4+G5 完整迁移
- [x] ✅(2026-07-26) G6 LTM 源接入 mcp_server 架构改动 — 扩展 `MCPServer.call_tool(name, arguments, *, user_role, user_id, session_id)` 签名(复用 `__user_role` 注入模式,新增 `__user_id`/`__session_id` 注入到 arguments 副本),`_tool_knowledge_lookup` 从 arguments 提取注入值传给 `knowledge_lookup(user_id=...)`,启用 `long_term_memory` 源(此前固定 None 跳过 LTM)。调用方:`routers/mcp.py` 从 `request.state.user_id` 拿(JWTAuthMiddleware 已注入),`routers/llm.py` 从已提取的 `owner_uuid` 传(`req.metadata.userId`)。service 层(agent_loop/orchestrator/conversation)保持默认 None(非 FastAPI request 上下文,不回归)。把 knowledge_lookup 从"两源(codebase+RAG)"升级为"完整三源(+跨会话历史)",LLM 可查用户历史对话,实现"记忆分离式字典化"完整闭环。验证:6 个 G6 新测试(`TestKnowledgeLookupG6SessionContext`)+ 联合 211/211 全绿(`test_mcp_server` + `test_knowledge_lookup` + `test_agent_tools`)。commit `edc24be2e`(§12 协作事故:其他 agent commit 意外包含 G6 改动 6 文件 +146/-19,git-push-guard exit 0,§20 五条全绿;G6 改动本身已自验 pytest 全绿)

### P0 安全与核心架构债清零

- [x] ✅(2026-07-26) 修复 `csdn_publish.py` 中的 `CSDN_APP_SECRET` 硬编码问题,迁移至环境变量 — 实际文件位于 `apps/ai-service/app/skills/content_engine/lib/csdn_publish.py`(非任务描述的 `app/services/`,经 Grep 全仓库确认是唯一含硬编码密钥的文件),将 `CSDN_APP_KEY='203803574'` / `CSDN_APP_SECRET='9znpamsyl2c7cdrr9sas0le9vbc3r6ba'` 改为 `os.getenv('CSDN_APP_KEY', '')` / `os.getenv('CSDN_APP_SECRET', '')`,空字符串 fallback(对齐 `CSDN_COOKIE` 现有风格),`_load_env()` 上移到模块导入时执行;`config.py` 新增 `csdn_app_key: str = ""` / `csdn_app_secret: str = ""` 配置项(小写命名对齐现有字段);`.env.example` 添加 `CSDN_APP_KEY=` / `CSDN_APP_SECRET=` / `CSDN_COOKIE=` 三项及说明;两处 docstring 字面量 `203803574` 改为 `{CSDN_APP_KEY}` 占位符;验证:模块导入 OK + env 变量加载 PASS + 空 fallback PASS + 残留密钥 Grep 0 命中 + py_compile 两文件 PASS
- [x] ✅(2026-07-26) 补全 `admin-missing-routes.ts` 和 `missing-user-routes.ts` 中的 API 空桩 — **勘察发现实际仅 6 条空桩(非任务描述的 51 条)**:① `admin-support-tickets.ts` 3 条(PUT /support/tickets/:id/status + POST /support/tickets/:id/reply + GET /support/tickets/:id/replies);② `admin/stats.ts` 3 条聚合端点数据为空值(/stats/dashboard + /stats/revenue + /stats/users,难度高)。本轮先完成 `admin-support-tickets.ts` 3 条(难度中):复用既有 `customer_service_tickets` / `customer_service_comments` 表与查询函数(`findTicketById` / `updateTicket` / `createComment` / `findCommentsByTicket`,项目审计确认原注释"待 support_tickets 表落地"不准确,真实表已存在),前端 `'processing'` 状态写入时映射为后端 `'open'`,POST reply 走 `createComment`(内部自动 bump updatedAt),GET replies 走 `findCommentsByTicket` 按 created_at ASC + 内存分页(page/pageSize)。`admin/stats.ts` 3 条聚合端点难度高(需真实 DB 聚合查询)留待后续批次。验证:`pnpm --filter @ihui/api typecheck` exit 0

### P1 深度代码质量治理
- [x] ✅(2026-07-26) 清理测试环境硬编码密钥（`tbox.test.ts`, `embedding-provider.test.ts` 等），迁移至 Mock 或环境变量 — `tbox.test.ts` 2 处(line 17 `TBOX_WEBHOOK_SECRET` + line 33 `const SECRET` 同步,否则 HMAC 签名与 config 不同源导致 2 测试 401)+ `embedding-provider.test.ts` 4 处(line 28 DASHSCOPE_API_KEY + line 35 OPENAI_API_KEY + line 49 MINIMAX_API_KEY + line 57 MINIMAX_EMBEDDING_URL),全部改为 `process.env.X || 'fallback'` 形式,保留 fallback 确保 CI 无 env 时仍可跑通;关键发现:`apps/api/.env.test:11` 设了 `TBOX_WEBHOOK_SECRET=test-webhook-secret`,vitest 通过 `setupFiles: ['./tests/setup-env.ts']` 自动加载到 `process.env`,所以仅改 line 17 会导致 mocked config 读到 `test-webhook-secret` 而 line 33 的 `const SECRET = 'test-secret'` 仍硬编码 → HMAC 不同源 → 401,必须同步 line 33;embedding-provider.test.ts 的 `beforeEach` 会 `delete process.env.X`,所以改动是形式上的规范化(消除硬编码密钥代码异味),功能上是 no-op。验证:`pnpm test -- tbox.test.ts embedding-provider.test.ts` 28/28 passed(3 files:embedding-provider 8 + outbox 17 + tbox 3)
- [x] ✅(2026-07-26) 修复代码库中的 149 处 `@ts-ignore` / `eslint-disable`(Top 5 高频文件批次)— **2026-07-26 重新精确统计**:实际 145 处(非 149),分布 100 文件。本轮处理 Top 5 高频文件共 42 处(占 29%):① `apps/web/tests/visual/sidebar-height-verify.spec.ts` 16 处全部移除(`eslint-disable-next-line no-console` + `console.log` → `console.info` 白名单内,packages/eslint-config `no-console` allow `['warn','error','info']`);② `apps/web/src/components/ui/dropdown-menu.tsx` 9 处全部移除(8 处是 `React.forwardRef` 泛型参数内的无效 `@ts-ignore` 只抑制下一行对泛型无效,1 处改为 `React.ComponentType<any>` 显式类型标注替代 `: any`);③ `apps/web/src/components/rules/rules-manager.tsx` 9 处全部保留并添加 ESLint 8+ 官方 `--` 原因注释(`jsx-a11y/click-events-have-key-events` + `jsx-a11y/no-static-element-interactions`,模态遮罩点击外部关闭,键盘用户通过关闭按钮 X 提供等价交互,符合 WAI-ARIA 等价交互原则);④ `apps/web/app/(main)/admin/ai-metrics/page.tsx` 5 处全部直接删除(过期兜底注释,所有依赖 next/link + next-intl + lucide-react + @ihui/ui-react + @/lib/date-utils 均自带类型);⑤ `apps/web/app/(main)/registry/page.tsx` 3 处全部直接删除(`@ihui/types` 的 RegistryItem/RegistryInstallStatus 等类型正常导出,抑制冗余)。统计:移除 32 处 + 保留文档化 9 处 + 类型标注替代 1 处 = 42 处。验证:`pnpm --filter @ihui/web typecheck` exit 0(全绿)。剩余 103 处分布 95 文件,后续按目录分批处理(scripts/ 守门脚本合法抑制 + apps/extension/sidepanel/pages/ + apps/web/ 散落文件)
- [x] ✅(2026-07-26) P1-2 第二批次 apps/extension/sidepanel/pages/ 25 文件 eslint-disable 文档化 — 25 个页面文件(AiNewsPage/AiSkillsPage/AnnouncementsPage/ArticlesPage/AsksPage/ChatFavoritesPage/ChatHistoryPage/ChatTemplatesPage/CirclesPage/DashboardPage/DistributionPage/FansPage/FavoritesPage/FollowingPage/InvitationsPage/MemberPage/MemoryPage/MessagesPage/ModelsPage/NewsPage/NotificationsPage/PlazaPage/PointsPage/TopicsPage/VipPage)每个 1 处 `eslint-disable-next-line react-hooks/exhaustive-deps`,全部采用方案 B(ESLint 8+ 官方 `--` 语法文档化:`// eslint-disable-next-line react-hooks/exhaustive-deps -- 挂载时加载一次,load 依赖 t/setState 但无需重跑`)。方案 A(内联到 useEffect)不适用:每个文件的 `load` 函数都在多处调用(useEffect 内挂载时 + 错误状态 retry 按钮 `onClick={() => void load()}`,PointsPage 还在 `onSignIn` 中 `await load()`),无法内联。验证:`pnpm --filter @ihui/extension typecheck` exit 0 + `pnpm --filter @ihui/extension lint` exit 0(ESLint 8+ `--` 语法被正确识别,无 warning/error)。累计 P1-2 进度:42 + 25 = 67 处(占 145 处总量 46%),剩余 78 处分布 70 文件(scripts/ 守门脚本合法抑制 + apps/web/ 散落文件 + apps/api/ + packages/)
- [x] ✅(2026-07-26) 补充 `mcp_server.py` 及其他核心模块的缺失测试用例 — 新建 `apps/ai-service/tests/test_mcp_server_coverage.py`(945 行,33 个测试,6 个测试类),覆盖 6 个真实覆盖率缺口:① `_tool_agent_control`(fail-closed 密钥 + httpx 转发 + Timeout + 通用异常 + success=False 透传,5 测试);② `_tool_screenshot_url`(MCP 入口 + SSRF 入口 + 缺 url + 异常降级 + 默认尺寸,4 测试);③ `_tool_file_edit`(INVALID_ARGUMENT / PATH_NOT_ALLOWED / FILE_NOT_FOUND / AMBIGUOUS_MATCH / NOT_FOUND / happy path .bak 副作用 / replace_all / BINARY_FILE,8 测试);④ `SamplingHandler` 类(默认护栏 + 自定义覆盖 + rate_limit + model_whitelist + max_tool_rounds + 成功调用+审计 + 超时+审计 + 通用异常 + 空 model 跳过白名单,9 测试);⑤ `SamplingHandler` API(list_sampling_capabilities / call_sampling 委托 / read_resource sampling://handler / 独立实例,4 测试);⑥ admin 权限矩阵(file_edit + screenshot_url 普通用户拒绝 + admin 通过,3 测试)。每个测试 3 维度断言(返回值结构 + 错误处理 + 副作用);Windows 换行符陷阱:文件写入用 `write_bytes` 避免 `\n → \r\n` 翻译污染 raw 备份断言。验证:`pytest tests/test_mcp_server_coverage.py tests/test_mcp_server.py` 205/205 passed + `ruff check` All checks passed;未发现源码 bug

### P2 工程卫生与维护成本优化

- [x] ✅(2026-07-26) 清理 `apps/api` 与 `scripts` 中的僵尸代码（如 `webhooks-trigger.ts` 中的注释代码）— `apps/api/src/routes/webhooks-trigger.ts` `executeAgentAsync` 移除 `simulateAgentCall` 模拟函数（25 行含 5% 随机失败 + 注释掉的"真实集成"占位代码）与 12 行顶部导入级 TODO,替换为真实 ai-service fetch 调用（`config.AI_SERVICE_URL` + AbortController 30s 超时 + `resp.ok` 错误透传 + JSON.stringify payload）,`triggeredBy: 'webhook'` 标识来源
- [x] ✅(2026-07-26) 修复 `apps/extension/lib/config.ts` 等文件中的弃用 API 调用 — **任务前提不成立**:经全量扫描,`apps/extension` 已是 Manifest V3(WXT 框架,无 `manifest.json` 源文件,由 `wxt.config.ts` 构建时生成,`manifest_version: 3` + `action` + `scripting` 权限 + `side_panel` + MV3 `web_accessible_resources` 对象数组格式);Grep `chrome.extension.*` / `chrome.tabs.executeScript` / `chrome.tabs.insertCSS` / `chrome.browserAction.*` / `chrome.pageAction.*` / `manifest_version: 2` / `browser_action` / `page_action` 全部 0 命中;源码 `chrome.*` 调用均为合法 MV3 API(`runtime.*` / `storage.*` / `tabs.*` / `action.onClicked` / `sidePanel.*` / `contextMenus.*` / `alarms.*`);`@ts-ignore` 0 处;`eslint-disable` 27 处(25 react-hooks/exhaustive-deps + 2 测试文件)与本任务无关;`browser.*` 调用是 WXT 官方推荐 polyfill 模式非弃用;`lib/config.ts:34,36` `@deprecated` 标记的是内部常量(API_BASE_URL / BRIDGE_BASE_URL)已被 getter 替代,非 chrome.* 弃用 API;验证:`pnpm --filter @ihui/extension typecheck` exit 0
- [x] ✅(2026-07-26) 全局清理生产环境无关的 `console.log` 残留 — 7 个高命中业务文件 console → 结构化 logger 共 41 处替换：`apps/api/src/index.ts` 3 console.error → `logger.error`（生产环境微信支付配置校验）;`apps/api/src/services/codebase-index-service.ts` 2 console.warn → `logger.warn`（pgvector/batch embedding 失败降级）;`apps/api/src/services/crew-role-loader.ts` 4 console.warn → `logger.warn`（JSON 解析/角色字段校验/内置加载失败）;`apps/api/src/services/pdf-service.ts` 3 console.error → `logger.error`（certificate/invoice/report PDF 失败 stub 降级）;`apps/api/src/services/rules-service.ts` 18 console.warn → `logger.warn`（listRules/matchRules/audit/feedback/abTest 等降级路径）;`apps/web/src/hooks/use-permission-auto-revert.ts` 10 console.log + 1 console.warn → `logger.info/warn`（hydration/mode-effect/auto-switch 调试轨迹）;`apps/web/src/stores/ide-workspace.ts` 5 console.error → `logger.error`（fetchFolderChildren/File/Diff/GitLog/GitBranches 错误）;统一走 `apps/{api,web}/src/utils/logger.ts` / `@/lib/logger` 已存在的 pino/winston 通道,保留 `pdf-service` 2 处 `console.info` 调试（用户要求保留）
- [x] ✅(2026-07-26) 消除脚本中的绝对路径硬编码（如 `C:\`, `D:\`, `G:\`），改用项目相对路径或动态推导 — `scripts/` 目录下 `.mjs`/`.ts`/`.js` 文件扫描绝对路径硬编码,真实命中 2 处:① `scripts/cert-expiry-check.mjs:5` docstring `检查 g:\IHUI-AI\cert\ 下所有证书文件` → `检查项目根目录下 cert/ 下所有证书文件`(代码本就用 `resolve(PROJECT_ROOT, 'cert')`,注释跟代码对齐);② `scripts/check-api-migration-completeness.mjs:469` 错误提示 `参考 G:\IHUI-AI\audit_*.md` → `参考 ${path.join(ROOT, 'audit_*.md')}`(用文件已有 `ROOT = path.resolve(__dirname, '..')` 动态推导)。其余命中依法豁免:守门规则本身的硬编码(`check-parent-pollution.mjs` / `check-workspace-hygiene.mjs` 内部黑名单正则)、`check-input-border-var.mjs:81` 路径剥离正则、`fix-i18n-deep.mjs:419` i18n 翻译词条、`fetch-wechat-platform-cert.mjs:144` User-Agent 产品名、`setup-mirror-repos.mjs` 仓库名 + git remote URL、`.ps1`/`.py`/`.json`/`.vbs`/`.sh` 文件不在受影响清单(其中 `g-root-guardian.ps1` 等系统级脚本受 §15 豁免)、`http://localhost:*`/`https://*.weixin.qq.com`/`postgresql://...` URL/DB 连接串非文件路径。验证:`node --check` 两文件 exit 0 + `check-workspace-hygiene.mjs` 扫描 17061 个文件无违规 + `check-parent-pollution.mjs --quiet` exit 0
- [x] ✅(2026-07-26) G6 端到端集成测试补强 — 新建 `apps/ai-service/tests/test_knowledge_lookup_g6_e2e.py`(327 行,10 个测试 `TestKnowledgeLookupG6EndToEnd`),验证完整链路 `mcp_server.call_tool("knowledge_lookup", ..., user_id="u1")` → `_tool_knowledge_lookup`(提取 `__user_id`)→ `knowledge_lookup(user_id="u1")` → `_query_ltm` → `long_term_memory.recall_cross_session`(mock)→ 真实 LTM hits 返回。mock 策略:patch `app.services.knowledge_lookup.{codebase_indexer.search, rag_service.retrieve_only, long_term_memory.recall_cross_session}` 三源,codebase/RAG 默认返回 `[]` 聚焦 LTM。LTM mock 数据对齐 `session_summarizer._row_to_summary_dict` + 显式 `score` 字段(`_query_ltm` 用 `item.get("score")` 读取)。覆盖 10 场景:LTM 真实 hits / user_id=None 跳过 LTM(`assert_not_awaited`)/ LTM 失败降级 / 三源聚合按 priority 排序 / hit content 格式(`[long_term_memory]`+summary+关键事实+关键决策)/ user_id 透传 / top_k 透传 / 返回不含 raw / 空 query 错误 / 完整 MCP 返回结构(8 必需字段)。验证:10/10 新测试全绿 + 联合 137/137 全绿(`test_knowledge_lookup_g6_e2e` + `TestKnowledgeLookupG6SessionContext` + `test_knowledge_lookup` + `test_long_term_memory`)。多 subagent 并行:Subagent A 写测试文件 + 主 agent 同时跑回归(31/31 全绿),§11 拆分单文件测试任务
- [x] ✅(2026-07-26) P0.5 web API 调用共享层收敛 + P3 PROJECT_PLAN 平台独占豁免标注(/goal 模式)— **P0.5**:删除 `apps/web/src/lib/*-api.ts` 中 26 个纯 re-export 桥接文件(admin/agent/ai/auth/business/category/chat/community/course/crew/developer/distribution/exam/knowledge-rag/learn/live/misc/notification/order/payment/resource/share/system/token/user/vip/wallet/workspace-api.ts),业务代码 import 路径从 `@/lib/*-api` 改为 `@ihui/api-client` 直接 import;保留 9 个有 web 特有包装的文件(ai-news/models/subagents/spec/memory/context/skills-market/agent-kanban/openclaw-api.ts,含本地类型/mock fallback/常量定义),文件数从 ~30 → 9(减少 70%+)。**P3**:`PROJECT_PLAN.md` 显式标注 `apps/desktop`(Tauri 空壳待开发)和 `apps/ai-service`(跨语言 Python)平台独占豁免,避免 §9 多端同步守门 warn 噪音。验证:typecheck exit 0 + build exit 0 + grep 无残留引用已删除桥接文件的 import(40 个引用全部指向保留的 9 个文件);commit `d92f9560d`,§20 五条全绿(local HEAD == remote HEAD == `d92f9560d`,git-push-guard exit 0)
- [x] ✅(2026-07-26) P2 i18n 域去重优化 — 审计 5 域(web/extension/miniapp-taro/mobile-rn/shared)× 5 语言 = 25 份文件,发现 4 端间重复 leaf key 44 个,经 5 语言一致性校验后识别 12 个可安全提升的 key(nav.live/exam.result.correct/exam.result.wrong/live.empty/common.loading/auth.login/course.free/order.empty/nav.courses/course.rating/order.status.refunded/order.orderNo),提升到 shared 域 5 语言文件(60 处更新),从各端域删除重复 key 130 处(web -20/extension -20/miniapp-taro -45/mobile-rn -45)。`common.loading` 修正 shared 旧值 "加载中..."(3 ASCII 点)→ 各端统一 "加载中…"(Unicode 省略号)。验证:`check-i18n-keys.mjs` 5 语言 parity OK + 11229 keys + `scan-i18n-zh-residue.mjs` zh-TW 无残留(ko 1 处品牌名警告属预存) + 4 端 typecheck exit 0 + web build exit 0;各端 loader 用 `mergeMessages(shared, endSpecific)` 自动 fallback
- [x] ✅(2026-07-26) P2 后续 i18n 死 key 清理 + 扫描器增强(/goal 模式收尾) — **扫描器增强**:`scripts/_i18n-scan-helpers.mjs` STATIC_T_RE 正则增加 `(?:,[^)]*)?` 可选组,支持 `t('key', { args })` / `t('key', count)` 带参数调用形式(原正则要求引号后紧跟 `)`,导致带参数时漏报死 key)。**新测试**:`scripts/tests/scan-{web,extension,miniapp-taro,mobile-rn}-dead-i18n-keys.test.mjs` 4 个端到端集成测试文件(各 7-8 场景,共 76 tests pass),覆盖所有 key 引用 exit 0 / 部分 key 死 exit 1 / 带参数 t() 识别 / dryRun 不写报告 / 报告写入 / zh-CN 不存在跳过 / 翻译不完整章节。**死 key 清理**:extension 域 5 语言 -12 key(`auth.loginRequired`/`auth.phoneOrEmail`/`login.*` 8 key);mobile-rn 域 5 语言 -42 key(`profile.myOrders/logout/nickname/editProfile`/`wallet.points`/`community.follow/follower`/`settings.account/notification/version/notif*/changePassword/oldPassword/newPassword/confirmPassword/pwd*/logoutConfirm` 16 key/`about.*` 7 key,共 24 key × 5 语言 - 3 已恢复 order.status.*)。**误删恢复**:`order.status.*` namespace(pending/paid/cancelled/refunding/completed/failed 6 key × 5 语言)因 `OrderScreen.tsx:90` 用 `t(\`order.status.${item.status}\`)`动态拼接被扫描器误判,已手动恢复(§7 删除安全规则)。**verify-*.mjs 清理**:删除`apps/web/verify-dangerous-command.mjs`/`verify-permission-auto-revert.mjs`/`verify-permission-edge-cases.mjs`/`verify-permission-history.mjs`/`verify-permission-modals.mjs` 5 个临时验证文件(§25 守门规则)。验证:`check-i18n-keys.mjs`11229 keys parity OK +`scan-i18n-zh-residue.mjs` zh-TW 无残留 + 4 端 typecheck exit 0 + 76 新测试全绿
- [x] ✅(2026-07-26) 协作事故防范守门 — commit message scope 与 staged 文件领域一致性检查。**背景**:commit `c3c864131` message 是 `feat(seo): IndexNow key 文件`,但 staged 文件包含 `packages/i18n/` 改动 + `apps/web/verify-*.mjs` 删除 + 4 个 i18n 测试文件,明显是 i18n 任务被其他 agent 用 `git add -A` 混入 seo commit(AGENTS.md §16 协作事故)。**现有工具 gap**:`check-staged-pollution.mjs` 只检测"跨 ≥4 目录",阈值太高(seo+i18n+web 只有 3 个目录不触发);`guard-push-other-agent-changes.mjs` 需手动传入白名单;两者都不检查 commit message scope。**新脚本**:`scripts/check-commit-scope-consistency.mjs`(281 行)在 commit-msg hook 阶段检测:① 解析 commit message `<type>(<scope>):` 提取 scope;② 根据 staged 文件路径推断"业务领域"集合(19 项映射:packages/i18n→i18n / apps/web→web / apps/api→api / apps/ai-service→ai-service / scripts→scripts / .github→ci 等);③ 如果领域集合 size ≥2 且 scope 不在集合中(且不在白名单 11 项:seo/security/deps/chore/config/ci/build/release/hotfix/monorepo/infra)→ warn-only 警告"可能是 git add -A 污染"。**集成**:`.husky/commit-msg` 添加 `node scripts/check-commit-scope-consistency.mjs "$1"`(在 check-style-verification.mjs 之后)。**测试**:`scripts/tests/check-commit-scope-consistency.test.mjs` 35 tests pass(inferArea 17 + parseCommitMessage 10 + 场景 8,覆盖 c3c864131 事故场景 + i18n 跨端正常场景 + 单领域场景 + 白名单跳过场景)。**设计决策**:warn-only 起步(不阻塞 commit),因为跨端开发可能合法涉及多领域(如 i18n 改动天然跨端);1 周观察期后评估升级 blocking。跳过方法:`HUSKY_SKIP_SCOPE_CHECK=1 git commit ...`
- [x] ✅(2026-07-26) 协作事故防范守门 v2 重构 — warn-only → blocking + scope 匹配 → 污染特征签名(3 条规则)。**背景**:v1 上线后 Subagent A 分析最近 30 commit 发现 100% 误报率(scope 语义与文件领域假设不成立,如 `feat(p2)` / `docs(wikidata)` / `chore(geo)` 等主题 scope 不对应 apps 子目录)+ 0% 召回率(`seo` 在白名单放过 c3c864131 事故)。**v2 重构**:① 移除 `seo` 白名单(c3c864131 事故证明 seo scope 可被滥用);② 检测逻辑从"scope 与文件领域匹配"重构为"3 条污染特征签名":**R1**(§25 硬违规)staged 含 `apps 下 verify-*.mjs`(`scripts/verify-*.mjs` 豁免)→ block;**R2**(i18n 污染签名)staged 含 `packages/i18n/messages/` + scope != 'i18n' → block;**R3**(跨端污染签名)staged 涉及 ≥3 个不同 `apps/<subdir>` + scope 显式声明 + scope 不在其中 + scope 非跨切关注点(security/deps/chore/config/ci/build/release/hotfix/monorepo/infra)→ block;③ warn-only → blocking(exit 1 阻塞 commit);④ 新增 `detectPollution(staged, scope)` 可测试纯函数 + `isForbiddenVerifyFile(file)` §25 白名单豁免函数。**R3 优化**:增加 `scope === null` 前置条件跳过,消除 `eebf68c92` (chore 技术债批次 + 3 apps 无 scope) 误报 — 无 scope 的聚合 commit 通常是合法的多 subagent 并行交付。**30 commit 回归验证**:0 误报 0 漏检,c3c864131 被 R1+R2 双重拦截,82084554e (refactor(i18n) 跨 5 端) + bb53bec93 (chore(i18n)) + eebf68c92 (chore 3 apps 无 scope) + 5aa784215 (feat(seo)+web 单端) 全部正确 pass。**测试**:`scripts/tests/check-commit-scope-consistency.test.mjs` 63 tests pass(inferArea 17 + parseCommitMessage 11 + R1 7 + R2 5 + R3 10 + 规则优先级 2 + 历史 commit 回归 8 + 边界 4)。**端到端验证**:模拟 c3c864131 场景(verify-*.mjs + i18n + scope=seo)→ exit 1 + 完整诊断信息(规则编号 + 原因 + 文件领域分布 + 修复方法)。跳过方法:`HUSKY_SKIP_SCOPE_CHECK=1 git commit ...`
- [x] ✅(2026-07-26) pre-commit staging area 快照还原机制 — 防 lint-staged/IDE 副作用导致非本任务文件被 commit。**背景**:曾出现 commit 包含未显式 staged 的 `scripts/_i18n-scan-helpers.mjs` 和 `scripts/tests/i18n-scan-helpers.test.mjs` 的事故,根因为 IDE 自动 stage / 未察觉的 `git add` / lint-staged 副作用(已确认 lint-staged 不会 stage 完全 unstaged 的文件,但作为防御措施)。**机制**:① pre-commit 入口调用 `takeStagingSnapshot()` 记录初始 staged 文件清单;② hook 执行期间正常跑 lint-staged / guardian-runner / typecheck 等检查;③ hook 退出前(注册 `process.on('exit')`,无论成功失败)调用 `restoreStaging()` 对比当前 staged 与快照,自动 `git restore --staged` unstage 快照之外的新增文件,确保 commit 仅包含用户显式 staged 的文件。**实现**:`scripts/lib/staging-snapshot.js`(126 行)导出 `takeStagingSnapshot(options)` + `restoreStaging(snapshot, options)` 两个纯函数,支持 `cwd`/`skip`/`silent` 参数(测试友好),路径归一化为 POSIX,非 git 环境返回 null 安全跳过;`.husky/pre-commit` 顶部 require 模块 + 入口快照 + 注册 exit 还原。**与现有守门互补**:`check-commit-scope-consistency.mjs` 检测 hook 执行前已 staged 的非本任务文件(通过 commit scope 与文件领域匹配),本机制检测 hook 执行期间新增的 staged 文件,两者互补。**关键设计**:lint-staged 对已 staged 文件的 `eslint --fix`/`prettier --write` 修改不受影响(文件 PATH 仍在快照中,只是内容更新);还原使用 `git restore --staged`(git 2.23+,非破坏性,working tree 保留)。**测试**:`scripts/tests/staging-snapshot.test.mjs` 17 tests pass(takeStagingSnapshot 5 + restoreStaging 9 + E2E 3),覆盖空快照/多文件/Windows 路径归一化/非 git 环境/null 跳过/skip 跳过/lint-staged 内容修改不影响/c3c864131 事故模拟/正常 commit 流程不受影响/还原后 commit 不含被 unstage 的文件。跳过方法:`HUSKY_SKIP_STAGING_RESTORE=1 git commit ...`

---

## 历史归档占位(2026-07-26 批次)

<!-- 已归档(2026-07-26):[x] ✅(2026-07-26) D 盘历史项目迁移完整性审计 — 5 维度对照 + 缺失项识别(/goal 模式),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-26) D 盘历史项目迁移 100% 达成 — 11 项缺失修复复核(/goal 模式轮 3,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-26) 小程序兼容路由 53 个 stub 真实化 — 接入 packages/databa,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-26) 小程序联调 P0 阻碍修复 + /study/* 鉴权路由补全 — 端到端真实数据验,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-26) /study/* JWT 全流程 P0 bug 修复 + miniapp-taro ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-26) Commit 丢失防护机制强化 — 文档 + 脚本 + 钩子三件套(AGENTS.m,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-26) GEO/SEO 内容层 + 5 语言 i18n parity 完成,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-26) i18n 死 key 审计(commit 73197f3e1)— scripts/scan-dead-i18n-keys.mjs 305 行 + 报告 10255 leaf key / 4415 死 key 43.1% 写入 .trae-cn/tmp/i18n-dead-keys-2026-07-26.md(143KB),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-26) LLM provider 字典化阶段 1(commit d7d0b9c40)— docs/llm-provider-dict-design.md 277 行 7 章节 + LLMSettings PoC(+20 行,100% 向后兼容)+ LLM_PROVIDERS_JSON 注释示例,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

## 历史归档占位(2026-07-25 批次)

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) AI 对话/编程体验优化 goal 模式执行 — P0 安全/性能 8 项 + P1,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26 手动):Git 同步证据(commit 7cd90f2ca8 — AI 对话/编程体验优化 P0+P1,2026-07-25),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) AI 对话 P2/P3 遗留项执行 — SSE retry-after + Prom,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26 手动):P3-3 admin 看板 UI 接入 + SSE retry-after e2e 测试(2026-07-25),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

<!-- 已归档(2026-07-26 手动):P3-4 DB migration 补全 + retryAfter 传递链路修复(2026-07-25),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) i18n 治理阶段 13 — audit 脚本 6 类误判修复 + web 端 5 ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) P0 安全债收尾 — IDOR 防护集成测试 + payment-gateway 全,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) AI 输入框「添加」下拉菜单整合修复 — 9e90351d3 patch 重建时丢失,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 切换会话 LRU 缓存 + store messages 持久化 — 无闪烁体验(跨,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 桌面端顶栏终极简化 + Popover 受控模式 — 消除视觉噪音(平台独占:des,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 桌面端移除 Rust 原生菜单 — 根治"两层菜单割裂"(平台独占:desktop ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) P0 安全债并行修复 — 3 条 IDOR/支付金额漏洞收口(跨端:仅 api,平台,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) i18n 治理阶段 12 — adminGroup.* 嵌套化 + download,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) i18n 治理阶段 11 — 侧边栏 nav.* 158 key + marketi,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 业务层共享启动阶段 11 — useAgents/useArticles/useCh,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 业务层共享启动阶段 10 — extension + miniapp-taro 端 ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 业务层共享启动阶段 9(收尾)— shared parity 升级 blocking,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 业务层共享启动阶段 8 — 三端接入 bindTokenStoreToApiClie,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 业务层共享启动阶段 7 — useAuth 跨端集成测试(mobile-rn 端 1,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 业务层共享启动阶段 6 — 三端 token.ts 类型层接入 TokenStore,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 业务层共享启动阶段 5 — mobile-rn TokenStore 适配器接入试点,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 业务层共享启动阶段 4 — useAuth 跨端共享 hook 落地(@ihui/s,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 业务层共享启动阶段 3 — token-store 通用契约 + i18n shar,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 业务层共享启动阶段 2 — formatTokenCount 从 @ihui/api,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 业务层共享启动阶段 1 — extension 14 页面 fmtDate 迁移到 ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) AI 输入框权限按钮深化(第二批) — 高风险模式 1h 自动撤销 + 首启确认弹窗,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) AI 输入框权限按钮深化(第三批) — 快到期双提醒(5min/1min) + 撤销,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) i18n 治理 phase 2 收尾 — mobile-rn 34 处动态拼接全面静,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 维护成本优化第七轮 — web i18n 动态拼接第三批治理 status.* 遗漏,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 维护成本优化第八轮 — web i18n 动态拼接第四批治理(clean 模式 5 ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 维护成本优化第九轮 — web i18n 动态拼接第五至第八批治理 misc 模式收,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 维护成本优化第十轮 — i18n 阶段 4 无引用 key 清理完成(跨端:仅 we,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 维护成本优化第十一轮 — extension 端 i18n 4 语言翻译补齐(跨端:,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 维护成本优化第十二轮 — audit 脚本误判修复 + extension/mobi,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 维护成本优化第六轮 — web i18n 动态拼接第二批治理 Top 10 命名空间,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 维护成本优化第五轮 — P0 删 jsonwebtoken + P1 统一 zod ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) i18n 动态拼接全面治理收尾 — web 260→2 + miniapp-taro,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 维护成本优化第四轮 — 守门脚本精简 93→78 + web i18n status,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 维护成本优化第三轮 — miniapp-taro i18n 13 处动态拼接静态化 ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) i18n 治理阶段 1 — miniapp-taro 13 处动态拼接改静态映射(跨,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) i18n 治理阶段 2 — web 动态拼接静态化(多 agent 并行协同,部分完,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) P2-2 续: @ihui/app 卡片 Props 扩展 + mobile-rn ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 维护成本优化第二轮 — reports 清理 + 守门脚本索引 + docs 一致性,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) i18n 命名空间统一执行 + mobile-rn 卡片接入评估 — web age,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 架构优化 4 项 + P3 评估 — api-client 共享层扩展 + ui-n,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 维护成本优化 5 项 — 端口 docs 统一 + audit-migration ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) /goal 阶段 1 统一 i18n 单一来源 — 4 端翻译合并到 package,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) /goal P2 直播主播端迁移补齐 — miniapp-taro 补建主播端页面(,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) /goal P0+P1 旧项目迁移补齐 — 11 项页面/组件两端同步(跨端:min,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) /goal P3 全端统一迁移 — miniapp-taro API/类型迁移到 @,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) /goal P0+P1 架构优化 8 项 — 类型契约包 + i18n 清理 + l,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) 登录弹窗自动弹出回归深度根治 — 共享决策中心 + 统一去重 guard(跨端:we,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) /goal D 盘旧项目迁移完整性补齐 — 11 项 P0+P1 任务 + 4 模块,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) miniapp-taro API 契约对齐 Round 2 — 补建 24 个 P0,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) /goal 资源上游自动同步中心 — MCP/Skill/Plugin/Provid,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) /goal 3 项技术债彻底清零 — 主题切换 DarkTheme + AsyncS,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) /goal 架构终极验证修复 — 8 缺口收敛 + 6 路审计 + 4 路并行修复(,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) i18n AI 翻译流水线(零 LLM API 调用,开发成本降 70%+)(跨端:,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) miniapp-taro Round17:i18n 5 语言补全 387 key(z,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) AI 对话框体验对标 Trae Work + Codex 第一轮 — 6 工具 + ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) AI 对话框体验对标 Trae Work + Codex 第二轮 — 9 大缺口并行,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) Wave 21 Phase 2 SSR 消除静态导出收尾 — robots/site,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) Wave 24e 跨范围 UTF-8 编码修复 — api-client resou,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) miniapp-taro Round16:深化 8 个 97-99 行边界页面(pa,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) miniapp-taro Round15:5 subagent 并行深化 23 个空,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) miniapp-taro Round15 P1 批次:5 subagent 并行深化,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26 手动):Round15 总结(P0 + P1 批次,2026-07-24),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) miniapp-taro Round14:distribution/team + n,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) 共享层生产版接入 — RN 三屏 wrapper 重构使用共享组件 + i18n 5,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) 共享层 packages/app 生产版升级 — props 注入式跨端共享组件 +,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) Wave 24c 测试覆盖深化 — 35 API 测试修复 + 7 ai-servi,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) Wave 24d 桌面架构 Option A 配套 — web build OOM ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) /goal 对标 TRAE Work 三大工作台体验缺口补齐:Skills 技能市场,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) 三端联动调度 P1 设备寻址闭环 — 设备在线注册表 + 心跳保活 + toDevi,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) 三大缺口深度补齐 — API 11 端点 32 单元测试 + Design 模式撤销,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) /goal 架构方案第一阶段:NativeWind + Solito + 共享层 —,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) NativeWind + Solito RN bundle 闭环 — metro 解,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) miniapp-taro Round6:对标原 uniapp 项目 6 项深度页补齐,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) miniapp-taro Round6 后续:developer 提现链路 404 ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) admin 路由深化 P0 批次 — orders/refund/wallet/us,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) admin 路由深化 P0 批次单元测试 — wallet/batch/stats ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) miniapp-taro Round7:P0 缺口全量扫描 + 12 项 P0 修复,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) miniapp-taro Round9:5 subagent 并行修复 P1 缺口 ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) miniapp-taro Round10:5 subagent 并行深化 24 个空,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) miniapp-taro Round11:5 subagent 并行深化 5 个核心,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) miniapp-taro Round12:5 subagent 并行深化 P1 级 ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) miniapp-taro Round13:多 subagent 并行深化 9 域页面,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) Wave 23:web ↔ extension 前端统一改造(跨端:web + ex,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) A 套壳方案迁移:Desktop 端 Vite React 页面全部删除,统一由 w,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) 14 个免费 LLM provider 内化到 LLMGateway(平台独占:仅 ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) Wave 21:桌面端架构收敛 + 安装更新链路闭环(跨端:web + deskto,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) /goal 深度开发:巨型路由文件拆分 + stub 清除 + 业务域深化(平台独占,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) Wave 22:desktop typecheck 3 errors → 0(Mar,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) Wave 24:web 包体积优化 — hls.js 动态导入 + 移除 9 个冗余,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) Wave 24b:全端测试覆盖深化 + web lint 清零(平台独占:多端独立),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-23):Wave 20:ai-service pytest 覆盖强化 — 10 模块 275 用例(平台独占:仅 apps/ai-service),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v7.md -->
<!-- 已归档(2026-07-23):AI Skills TOP 19 个 skill 集成 + 19 真集成(全部实装,无占位),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v7.md -->

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) AI Skills 系列后续增强:SkillLibrary 弹窗动态变量 + 详情页,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) (main) 目录页面整合 P0/P1:ask/article 重复路由改重定向 +,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-23):桌面端 Tauri 2 自动更新链路代码层(平台独占:仅 desktop),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v6.md -->
<!-- 已归档(2026-07-23):桌面端 4 大核心能力深度开发(平台独占:仅 desktop),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v6.md -->
<!-- 已归档(2026-07-23):桌面端 3 项增强能力深度开发(平台独占:仅 desktop),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v6.md -->
<!-- 已归档(2026-07-23):桌面端本地文件访问 + 拖拽粘贴附件深度开发(平台独占:仅 desktop),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v6.md -->
<!-- 已归档(2026-07-23):桌面端窗口状态持久化深度开发(平台独占:仅 desktop),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v6.md -->
<!-- 已归档(2026-07-23):桌面端会话历史持久化深度开发(平台独占:仅 desktop),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v6.md -->
<!-- 已归档(2026-07-23):桌面端 Markdown 渲染 + 代码高亮 + 消息复制深度开发(平台独占:仅 desktop),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v6.md -->
<!-- 已归档(2026-07-23):桌面端对话导出 + 主题持久化深度开发(平台独占:仅 desktop),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v6.md -->
<!-- 已归档(2026-07-23):桌面端对话搜索 + 消息重新生成深度开发(平台独占:仅 desktop),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v6.md -->

---

<!-- 已归档(2026-07-23):桌面端模型持久化代码块主题快捷短语(平台独占),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v7.md -->

---

<!-- 已归档(2026-07-23):桌面端消息时间戳会话重命名快捷键帮助(平台独占),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v7.md -->

---

<!-- 已归档(2026-07-23):桌面端字号缩放快捷键持久化(平台独占),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v7.md -->

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) 前端冗余页面整合 P0(平台独占:仅 web 端),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-23):ai-news 组件深度优化七轮:TrendChartDialog 无障碍闭环 + EmptyState 统一组件(平台独占:仅 apps/web),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v2.md -->

---

<!-- 已归档(2026-07-23):ai-news 组件深度优化八轮:AiFeedTimeline 搜索防抖 + URL query 同步(平台独占:仅 apps/web),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v4.md -->
<!-- 已归档(2026-07-23):ai-news 组件深度优化九轮:封面图占位 + TrendBanner closed 持久化 + formatRelativeTime 公共化(平台独占:仅 apps/web),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v4.md -->
<!-- 已归档(2026-07-23):ai-news 组件深度优化十轮:HotRanking/FundingSection hover 微动画 + TrendChartDialog 小屏响应式(平台独占:仅 apps/web),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v4.md -->
<!-- 已归档(2026-07-23):ai-news 组件深度优化十一轮:loading.tsx 骨架屏(平台独占:仅 apps/web),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v4.md -->
<!-- 已归档(2026-07-23):大模型排行榜深度优化五轮:highlight 共享重构 + ApiRelaysSection 高亮复用 + browser 验证(平台独占:仅 apps/web),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v2.md -->

---

<!-- 已归档(2026-07-23):大模型排行榜深度优化四轮:搜索关键词高亮 + 空状态优化 + i18n 5 语言同步(平台独占:仅 apps/web),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-23):大模型排行榜深度优化三轮:搜索+厂商筛选 + 能力标签 + 排序功能 + i18n 5 语言同步(平台独占:仅 apps...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-23):大模型排行榜深度优化二轮:排序偏好记忆 + chip 数量显示 + 复制并导入按钮(平台独占:仅 apps/web),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-23):大模型排行榜深度优化:列排序 + Copy Base URL + 中转站计费筛选 + i18n 5 语言同步(平台独占:...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-23):ai-news 入口梳理 + ai-world ?tab= query param 支持(平台独占:仅 apps/web...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-22):email_logs schema drift 修复 + clawdbot 4 service 持久化,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_archive.md -->
<!-- 已归档(2026-07-22):@ihui/ui-react TabsTrigger 选中态描边框消除,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_archive.md -->
<!-- 已归档(2026-07-23):ai-world "AI 对话" tab 重复入口统一化(平台独占:仅 apps/web),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-23):ai-service 测试覆盖补齐:10 免费 provider + 5 middleware 安全模块共 160 用例(平台独占:仅 apps/ai-service),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v3.md -->
<!-- 已归档(2026-07-23):ai-service 测试覆盖补齐:P3 记忆系统三件套 136 用例(衰减+提取+四层服务)(平台独占:仅 apps/ai-service),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v3.md -->

<!-- 已归档(2026-07-23):ai-service 测试覆盖补齐:P3 规则引擎 91 用例(平台独占:仅 apps/ai-service),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v3.md -->

<!-- 已归档(2026-07-23):ai-service 测试覆盖补齐:P3 Hook 引擎 140 用例 + 修复 4 个 bug(平台独占:仅 apps/ai-service),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v3.md -->

<!-- 已归档(2026-07-23):补齐 P3 spec_generator 零覆盖核心模块 122 cases(平台独占:仅 ai-service),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v3.md -->

<!-- 已归档(2026-07-23):补齐 P3 context_engine 零覆盖核心模块 162 cases + 修复 7 bug(平台独占:仅 ai-service),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v3.md -->

<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 旧架构 edu-web 函数名桥接层 + 8 模块类型补齐(承接 /goal 继续推进到极致,平台独占:仅 types/ap...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) i18n 5 语言 parity 修复(3 缺失键补齐,平台独占:仅 apps/web/messages)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 国内镜像同步方案落地(Gitee + GitCode 双镜像,平台独占:CI/基础设施)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 开发者 API Key 统一接入系统深度补齐(跨端:packages/types + api + web 全端同步,2026...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 对标 Hermes Agent 深度层 P3:三大核心壁垒真正超越(跨端:packages/types + ai-servi...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) P3 深化:§22 README 同步规则机制守门集成(平台独占:仅守门脚本 + 文档,2026-07-22 立)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 对标 Hermes Agent 深度升级:11 项差距分 P0/P1/P2 开发(跨端:packages/types + a...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 全项目对外开放 API 接入系统深度开发 — 105 端点 + TS/Python SDK 双语言(commit ba347294,跨端:packages/types + api + sdk + web 文档) -->
<!-- 已归档(2026-07-22):Java SDK 补齐 — ihui-ai-java 三语言 SDK 平级(平台独占:仅 SDK 新增),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_archive.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) Go + .NET/C# SDK 补齐 — 五语言 SDK 全覆盖(commit 04122a8f,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_sdk-multi-language.md -->

<!-- 已归档(2026-07-23):浏览器插件使用界面深度修复 — i18n/bridge/manifest/dedupe/守门(平台独占:仅 apps/e...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-23):浏览器插件界面样式与 web 端统一 — Tailwind 4 启用 + design token 对齐 + 深色模式修...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-23):深度鲁棒性加固 P0+P1+P2 — 85/85 完美收官,STATE.md=achieved;P2 Batch 3(1...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 旧架构迁移类型定义补齐:28 组类型迁移到 packages/types(平台独占:共享包 only/跨端共享)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) P1 旧架构迁移 MISSING 补齐:5 个查询功能从 edu/web 子模块迁移到新架构(跨端:api+api-clie...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 原生浏览器控制 + 电脑控制 MCP tool 全链路开发(跨端:web+api+ai-service+extension+...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 深度代码质量治理:P1(3项)+ P2(6项)技术债清理 + 隐藏 bug 修复(跨端:web+api,平台独占:仅 web...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 深度代码质量治理 Round 2:packages/* + ai-service + mobile-rn + web/api...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) AI 对话内嵌浏览器工作展示区 P0+P1+P2+P3(全 4 阶段完成:8 端同步 + Playwright 截图降级 +...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) AI 对话内嵌浏览器工作展示区 P3+ 增强:收藏 + 历史 dropdown 面板(平台独占:仅 web)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) P4 WorkPanel 全量加固 — closeTab 边界 + i18n 键补齐 + Drop Indicator 视觉...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) AI 对话内嵌浏览器工作展示区 P3++ Tab 拖拽排序 + Playwright E2E 补证据(平台独占:仅 web)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G1 认证安全加固:oauth-keys RSA/EC 真实密钥生成 + /rotate 事务(平台独占:仅 api,/go...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G2 计费资金安全核心:wallet/finance 充值漏洞 + token_flows 幂等 + 事务(平台独占:仅 a...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G3 LLM 扣费链路接通:ai-callback-worker 补 deductTokens+recordAiCost 联...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G4 智能体编排异常处理:conversation 顶层 catch + SSE 断连检测 + openai_provide...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G5 数据库 FK 与审计字段补齐:agent_tasks FK + 4 表 CASCADE→SET NULL(平台独占:仅...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G6 jsonb 预留字段填充:13 个 P0 字段加 default + 回填 NULL(平台独占:仅 database,...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G7 LLM 扣费收口:CrewAI 绕过扣费修复 + 全局 LLM 入口审计(平台独占:仅 api,已完成)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G8 rechargeToken 订单状态校验:补 JOIN orders 验证 status='paid'(平台独占:仅 ...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G9 SSE 断连检测补齐:三端断连资源收口(全端连通:ai-service + api,已完成)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G10 审计追溯字段补齐:4 表加 updatedBy + commission_flows 补 updatedAt(平台独...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G12 API 层 updatedBy 自动注入:`withAudit` 助手 + operatorId 显式传递(平台独占...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G13 API 层 createdBy+updatedBy 联合注入:`withAuditBoth` 助手 + 4 表 cr...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G11 snapshot/journal drift 修复 — drizzle-kit generate 同步 schema...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 多端流式 agentId 分流"最后一公里"接通(api token chunk 注入 + api-client onAge...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 多端流式输出极致化(packages/ui 共享折叠组件 + api 多路复用 + web feed 流式 token 改造...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-21) 深度代码比对 + 7 项遗漏补全(跨端:web+api+database,补全遗漏项涉及新文件)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) AI 资讯自动采集 cron + 17 信源 seed + ai-news 页面改接(2026-07-22)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) AI 世界板块升级:工具集 + 应用集 + 资讯/论文/项目 + 12h 自动同步原始数据源(平台独占:仅 web+api)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) AI 世界五次打磨:SuperCLUE Gradio 数据源接通 + GITHUB_TOKEN 环境变量文档 + 4 大榜单...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) AI 世界六次打磨:OpenCompass Playwright headless 渲染接通 + 5 大榜单全生产可用(跨端...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) AI 世界四次打磨:5 大抓取器改真实数据源 + GitHub Token + --rankings-only 实测验证(平...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) AI 世界三次打磨:5 大权威模型排行榜 + 工具热度实时更新 + dry-run 模式(平台独占:仅 web+api)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) G5+ 知识图谱 DrizzleGraphStore 持久化后端(2026-07-22)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 模型市场 nav 样式重构 + 厂商 SVG 图标(2026-07-21)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) P0 分域 SSO 架构落地:主域 aizhs.top + 认证子域 bsm.aizhs.top(2026-07-21)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):SaaS 托管服务架构(2026-07-21)— P0 阶段 1:多租户基础设施 PoC(Traefik 多租户路由 + 通配符证书 + 客户编排 + 创建/销毁脚本 + 1 个示例客户 PoC),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_archive.md -->
<!-- 已归档(2026-07-23):学生学习报告 + 每日多格式日志全链路补全(2026-07-21 立),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) 任务拆分(P0 → P3)— P0/P1/P2/P3 全完成...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-23):飞书 OAuth 扫码登录接入 + 生产环境配置(2026-07-21 立,平台独占),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-21) 修复飞书 OIDC v2 协议实现 bug(用户扫码后报 20014)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-21) 生成生产环境配置文件(平台独占,部署配置不涉业务代码)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):第三方登录 e2e 测试补强 + Mock 平台验证(已完成 ✅ 2026-07-21,commit e5605f1,18 用例全绿 + 8 平台 Mock 验证),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_archive.md -->
<!-- 已归档(2026-07-22):SaaS 托管服务架构(2026-07-21)— P1 阶段 2.1:部署层管理增强 + admin-api(已完成 ✅,commit a400e8ff,19 文件 + admin-api 9 端点 + 5 脚本 + cron 证书续期),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_archive.md -->
<!-- 已归档(2026-07-22):架构迁移完整性深度审计(已完成 ✅ 2026-07-21,只读未改代码)— 6 subagent + 1 验证,覆盖前端/后端/数据库/移动端/AI 服务层/D 盘历史项目;整体完整度 ~95%,真实遗漏 8 项(3 前端 + 5 API 端点)已全部补齐(commit 3ed1186d6 1:1 复刻 + DB schema 同步),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_archive.md -->
<!-- 已归档(2026-07-23):PDF 学习报告真实内容生成(2026-07-21)— P1 任务(P0 链路补全),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-21):综合安全审计 9 轮加固(已完成 ✅ 2026-07-21)— 配置/秘密泄露 + SQL 注入 + XSS + RCE + CSRF + SSRF + 依赖漏洞 + 安全头 + 加密失败 + token 持久化 全部深度修复,9 个 fix(security) commit 已合入 origin/main。完整审计归档见 `.trae-cn/goal-runtime/SECURITY-AUDIT-2026-07-21.md` -->
<!-- 已归档(2026-07-23):接入所有可直接免费调用的 LLM provider(平台独占:仅 ai-service),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-22):插件市场多端同步 + 测试覆盖 + ai-service 豁免标注(已完成 ✅ 2026-07-22)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):插件市场热度监测:事件埋点 + admin 统计聚合 + 监测页面(已完成 ✅ 2026-07-22)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) IDE 工作区复刻:编辑器分类页面 + 代码比对 + 多视图面板(平台独占:仅 web,2026-07-22 立)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
<!-- 已归档(2026-07-23):赶超 OpenClaw + OpenCode 深度开发计划(2026-07-22 立),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-23):miniapp-taro 深色赛博朋克风样式迁移恢复(已完成 ✅ 2026-07-22,平台独占:仅 miniapp-t...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-23):miniapp-taro 全端页面深度样式迁移(已完成 ✅ 2026-07-22,平台独占:仅 miniapp-t...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive.md -->
<!-- 已归档(2026-07-24):audit-chain.ts 死代码清理(auditChainEntries 表 + audit-chain.ts 文件,已被 audit-log-service.ts 替代),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-24_audit-chain-cleanup.md -->

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) G:\ 根目录实时守门服务 v2.0 白名单优先模式 — 彻底消除 v1.0 黑名单,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26 手动):i18n 深化:Payment 重复键修复 + aiNews 缺失键补齐 + 守门脚本白名单(2026-07-23),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

<!-- 已归档(2026-07-23):miniapp-taro 页面功能对标原 uniapp 项目:tabBar 5 tab + 智汇社区页 + ranking/detail + setting/privacy + profile 身份标签(平台独占:仅 miniapp-taro),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v2.md -->

<!-- 已归档(2026-07-23):miniapp-taro ChatMessageItem 增强:对标原 ai_assistant.vue 渲染层核心功能(平台独占:仅 miniapp-taro),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v2.md -->

<!-- 已归档(2026-07-23):miniapp-taro 智能体引导说明:对标原 ai_assistant.vue tishi_block + tishi_box(平台独占:仅 miniapp-taro),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v2.md -->

<!-- 已归档(2026-07-23):WorkerPool 资源隔离与超时处理 22 项缺陷修复(跨端:cli+ai-service),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v2.md -->

<!-- 已归档(2026-07-23):ai-service 测试覆盖补齐:P3 沙箱执行器 6 后端 150 用例(平台独占:仅 apps/ai-service),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v4.md -->

<!-- 已归档(2026-07-23):ai-service 测试覆盖补齐:P3 codebase_indexer 107 用例(平台独占:仅 apps/ai-service),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v5.md -->

<!-- 已归档(2026-07-23):ai-service 测试覆盖补齐:P3 Skill 系统 155 用例(平台独占:仅 apps/ai-service),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v7.md -->

<!-- 已归档(2026-07-23):ai-service Skill Tester 59 用例(平台独占),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v7.md -->

---

<!-- 已归档(2026-07-23):ai-service Skill Feedback 58 用例(平台独占),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v7.md -->

---

<!-- 已归档(2026-07-23):ai-service Skill Iterator 68 用例(平台独占),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-23_archive_v7.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) Wave 21:ai-service 5 P3 大模块零覆盖补齐 651 用例(平台,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-23) Wave 23:ai-service 12 P3 中小模块 + publish 全链,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) 进程僵尸守护者 v1.0:根治开发期内存占用 96%(僵尸 pip + dev se,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-24) 进程僵尸守护者 v2.0 实时 daemon 升级 — 30 分钟定时 → 60 秒,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) 自主记忆更新优化强化 L1 接入激活 + L2-1 语义去重深度(跨端:ai-ser,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
<!-- 已归档(2026-07-26 手动):Git 同步证据 + L2-2~L9 遗留项(全部 ✅,2026-07-25),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-25) P4 系列:AI 对话体验深度优化(L4 自进化闭环 + SSE fallback ,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->

---

<!-- 已归档(2026-07-26):[x] ✅(2026-07-26) i18n 多语言 parity 修复 + git stash 冲突标记清理 + ho,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-26_auto-archive.md -->
