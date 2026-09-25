// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 能力目录(Capability Catalog)—— 对外开放的单一事实源。
 *
 * 解决的问题:此前「哪些端点可被外部机器凭据调用」散落在各路由的 preHandler 里,
 * 导致 /v1 半数端点族只要 active key 即通吃、而 96% 的 /api/* 完全不认机器凭据。
 *
 * 核心语义是 dataClass —— 它把「开放功能」与「开放数据」在运行时切开:
 * - compute       : 只消耗算力,禁止读取任何业务实体表(仅允许写自有运行记录白名单表)。
 * - scoped-read   : 允许读,但必须经 owner/tenant 过滤。
 * - scoped-write  : 允许写自有资源,强制 owner 过滤 + 幂等。
 * - platform      : 平台运营面(账号/计费/发布/管理员),机器凭据一律 403。
 *
 * 新增对外端点或工具必须在此登记;未登记由 scripts/check-capability-catalog.mjs
 * 与运行期断言双重拦截(默认拒绝,而非默认放行)。
 */
import { API_KEY_PERMISSIONS, type ApiKeyPermission } from './api-key'

/** 数据访问类别:决定「功能开放」是否连带「数据开放」。 */
export const CAPABILITY_DATA_CLASSES = [
  'compute',
  'scoped-read',
  'scoped-write',
  'platform',
] as const
export type CapabilityDataClass = (typeof CAPABILITY_DATA_CLASSES)[number]

/** 风险档:驱动默认限流档、审计级别与是否需要人工二次确认。 */
export const CAPABILITY_RISKS = ['low', 'medium', 'high', 'critical'] as const
export type CapabilityRisk = (typeof CAPABILITY_RISKS)[number]

/** 能力域:用于 OpenAPI tag、开发者控制台分组与文档生成。 */
export const CAPABILITY_DOMAINS = [
  'agent',
  'chat',
  'model',
  'multimodal',
  'knowledge',
  'tool',
  'memory',
  'file',
  'codebase',
  'execution',
  'web',
  'workflow',
  'messaging',
  'realtime',
  'protocol',
  'developer',
  'platform',
] as const
export type CapabilityDomain = (typeof CAPABILITY_DOMAINS)[number]

/**
 * 能力归属服务 —— 决定该条目的端点应出现在哪一份契约产物里。
 * - `api`(缺省):apps/api(Fastify)注册,必须能在 `apps/api/openapi.json` 找到。
 * - `ai-service`:apps/ai-service(FastAPI)注册,**不会**出现在 apps/api 的契约里。
 *   `scripts/openapi-check.mjs` 的跨服务比对据此跳过这些条目 —— 这是归属不同,不是漂移。
 */
export const CAPABILITY_HOSTS = ['api', 'ai-service'] as const
export type CapabilityHost = (typeof CAPABILITY_HOSTS)[number]

/**
 * 运行期数据访问模式。compute 上下文里访问非白名单业务表必须抛错,
 * 这是 dataClass 从「文档约定」变成「机械可证」的落点。
 */
export const DB_ACCESS_MODES = [
  'forbidden',
  'self-metadata',
  'read-owned',
  'write-owned',
  'unrestricted',
] as const
export type DbAccessMode = (typeof DB_ACCESS_MODES)[number]

/** dataClass → 默认 DB 访问模式。 */
export const DB_MODE_BY_DATA_CLASS: Record<CapabilityDataClass, DbAccessMode> = {
  compute: 'self-metadata',
  'scoped-read': 'read-owned',
  'scoped-write': 'write-owned',
  platform: 'unrestricted',
}

/**
 * compute 能力仍允许写入的自有运行记录表(不含业务实体)。
 * 审计/计费/运行状态属于「调用行为自身」,不属于用户业务数据。
 */
export const COMPUTE_ALLOWED_TABLES = [
  'llm_call_logs',
  'agent_runs',
  'agent_checkpoints',
  'api_key_usage_windows',
  'webhook_delivery_logs',
  'audit_logs',
  'security_logs',
] as const
export type ComputeAllowedTable = (typeof COMPUTE_ALLOWED_TABLES)[number]

/** 各风险档的默认限流画像(可被 key 级配置收紧,不可放宽)。 */
export interface RateProfile {
  /** 每分钟请求数 */
  rpm: number
  /** 突发桶容量 */
  burst: number
  /** 每日调用数上限 */
  dailyCalls: number
  /** 并发上限(长连接/流式尤其关键) */
  concurrent: number
  /** 单次请求最长占用(毫秒);流式/WS 用于兜底回收 */
  maxDurationMs: number
}

export const RATE_PROFILES: Record<CapabilityRisk, RateProfile> = {
  low: { rpm: 600, burst: 120, dailyCalls: 50_000, concurrent: 8, maxDurationMs: 30_000 },
  medium: { rpm: 120, burst: 40, dailyCalls: 10_000, concurrent: 4, maxDurationMs: 120_000 },
  high: { rpm: 30, burst: 10, dailyCalls: 2_000, concurrent: 2, maxDurationMs: 600_000 },
  critical: { rpm: 5, burst: 2, dailyCalls: 200, concurrent: 1, maxDurationMs: 900_000 },
}

/** 单条能力声明。 */
export interface CapabilityEntry {
  scope: ApiKeyPermission
  domain: CapabilityDomain
  dataClass: CapabilityDataClass
  risk: CapabilityRisk
  /** 调用即产生外部成本(付费模型/第三方配额),必须预扣费 */
  billable: boolean
  /** 第三方 key 是否可申请。platform 域与 critical 写操作一律 false */
  thirdPartyEligible: boolean
  /** 写操作是否要求 Idempotency-Key */
  idempotencyRequired: boolean
  /** 人类可读说明(进文档与控制台) */
  description: string
  /**
   * 归属端点模式(Fastify 注册前缀已展开)。
   * 允许为空数组:表示该 scope 目前只有 MCP 工具面、没有对外 HTTP 端点
   * (参见 `billing:read` —— 不实声明一律删除,不得保留"看着像有"的路径)。
   */
  routes: readonly string[]
  /**
   * 该条目由哪个服务提供。**缺省视为 `'api'`**(apps/api Fastify),此时不必显式写,
   * 产物 JSON 里也不会多出 `host` 字段。显式标 `'ai-service'` 的条目走 apps/ai-service
   * (FastAPI),不会出现在 `apps/api/openapi.json` 里 —— `scripts/openapi-check.mjs`
   * 与 `apps/api/scripts/export-openapi.ts` 都据此跳过(归属不同,不是契约漂移)。
   */
  host?: CapabilityHost
  /** 该能力同时以 MCP 工具形态暴露时的工具名清单 */
  tools?: readonly string[]
}

const c = (e: CapabilityEntry) => e

/**
 * 全量能力目录。scope 必须 ∈ API_KEY_PERMISSIONS(编译期 + 运行期双重校验)。
 */
export const CAPABILITY_CATALOG: readonly CapabilityEntry[] = [
  // ===== Agent =====
  c({
    scope: 'agents:read',
    domain: 'agent',
    dataClass: 'scoped-read',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '读取调用者可见的 Agent 清单与详情',
    routes: ['GET /v1/agents', 'GET /v1/agents/:id'],
  }),
  c({
    scope: 'agents:call',
    domain: 'agent',
    dataClass: 'compute',
    risk: 'high',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '执行 Agent 推理(不落业务表,只产运行记录)',
    routes: [
      'POST /v1/agents/execute',
      'POST /v1/agents/:id/call',
      'POST /v1/agents/execute/stream',
    ],
    tools: ['dispatch_subagent'],
  }),
  // ===== Chat / LLM =====
  c({
    scope: 'chat:read',
    domain: 'chat',
    dataClass: 'scoped-read',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '读取自有会话历史',
    routes: ['GET /v1/chat/sessions'],
  }),
  c({
    scope: 'chat:write',
    domain: 'chat',
    dataClass: 'compute',
    risk: 'high',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '对话补全/视觉/MoA(直接产生模型费用)',
    routes: ['POST /v1/chat/completions', 'POST /v1/chat/vision', 'POST /v1/chat/moa'],
    tools: ['vision_analyze', 'proactive_suggestion'],
  }),
  // ===== Models =====
  c({
    scope: 'models:read',
    domain: 'model',
    dataClass: 'compute',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '可用模型清单(公开元数据)',
    routes: ['GET /v1/models', 'GET /v1/models/:id'],
    tools: ['list_models'],
  }),
  c({
    scope: 'models:write',
    domain: 'model',
    dataClass: 'scoped-write',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '自有模型/BYOK 配置管理',
    routes: [
      'GET /v1/user/models',
      'POST /v1/user/models',
      'PUT /v1/user/models/:id',
      'DELETE /v1/user/models/:id',
    ],
  }),
  c({
    scope: 'embeddings:write',
    domain: 'model',
    dataClass: 'compute',
    risk: 'medium',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '向量化(计费)',
    routes: ['POST /v1/embeddings'],
  }),
  // ===== Files =====
  c({
    scope: 'files:read',
    domain: 'file',
    dataClass: 'scoped-read',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '读取自有文件元数据与内容',
    routes: ['GET /v1/files', 'GET /v1/files/:id', 'GET /v1/files/:id/content'],
    tools: [
      'read_file',
      'list_files',
      'file_search',
      'parse_document',
      'document_tables',
      'extract_document_assets',
      'summarize_artifacts',
    ],
  }),
  c({
    scope: 'files:write',
    domain: 'file',
    dataClass: 'scoped-write',
    risk: 'high',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '上传/删除自有文件',
    routes: ['POST /v1/files', 'DELETE /v1/files/:id', 'POST /v1/files/upload-init'],
    tools: ['write_file', 'file_edit', 'resolve_conflict'],
  }),
  // ===== 多模态生成 =====
  c({
    scope: 'audio:read',
    domain: 'multimodal',
    dataClass: 'scoped-read',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '音色/声纹清单',
    routes: ['GET /v1/audio/voices', 'GET /v1/audio/speakers'],
  }),
  c({
    scope: 'audio:write',
    domain: 'multimodal',
    dataClass: 'compute',
    risk: 'medium',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: 'TTS/ASR/声纹注册',
    routes: ['POST /v1/audio/speech', 'POST /v1/audio/transcriptions'],
    tools: [
      'voice_tts',
      'audio_transcription',
      'music_generation',
      'token6688_voice_clone',
      'token6688_upload_file',
      'token6688_cancel_task',
    ],
  }),
  c({
    scope: 'images:write',
    domain: 'multimodal',
    dataClass: 'compute',
    risk: 'medium',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '文生图/编辑/修复/风格迁移',
    routes: ['POST /v1/images/generations', 'POST /v1/images/edits'],
    tools: ['image_generation', 'image_edit', 'generate_chart'],
  }),
  c({
    scope: 'videos:write',
    domain: 'multimodal',
    dataClass: 'compute',
    risk: 'medium',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '视频生成/编排',
    routes: ['POST /v1/videos/generations', 'POST /v1/videos/compose'],
    tools: ['video_generation'],
  }),
  c({
    scope: 'videos:read',
    domain: 'multimodal',
    dataClass: 'compute',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '自有生成任务状态查询',
    routes: ['GET /v1/videos/tasks/:id'],
  }),
  c({
    scope: 'threed:write',
    domain: 'multimodal',
    dataClass: 'compute',
    risk: 'medium',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '3D 资产生成',
    routes: ['POST /v1/3d/generations'],
  }),
  c({
    scope: 'generation:write',
    domain: 'multimodal',
    dataClass: 'scoped-write',
    risk: 'medium',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '生成队列入队/取消/状态',
    routes: [
      'POST /v1/generation/enqueue',
      'GET /v1/generation/status/:id',
      'POST /v1/generation/cancel/:id',
    ],
  }),
  // ===== Knowledge / RAG =====
  c({
    scope: 'knowledge:read',
    domain: 'knowledge',
    dataClass: 'scoped-read',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '自有知识库检索/RAG',
    routes: ['GET /v1/knowledge/documents', 'POST /v1/knowledge/search'],
    tools: ['knowledge_lookup'],
  }),
  c({
    scope: 'knowledge:write',
    domain: 'knowledge',
    dataClass: 'scoped-write',
    risk: 'medium',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '文档入库/删除/知识图谱',
    routes: ['POST /v1/knowledge/documents', 'DELETE /v1/knowledge/documents/:id'],
  }),
  // ===== MCP 工具网关 =====
  c({
    scope: 'tools:read',
    domain: 'tool',
    dataClass: 'compute',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '工具/资源/提示词清单',
    // POST /v1/mcp/resources/read 与 GET /v1/mcp/tools 同属 MCP 网关只读面,
    // 闸口规则在 apps/api/src/routes/v1-mcp-gateway.ts:164-168 要求 tools:read;
    // 此前只登记了清单端点、漏登记读取端点,机器凭据无法从 capabilities 清单发现它。
    routes: [
      'GET /v1/tools',
      'GET /v1/resources',
      'GET /v1/resources/:uri',
      'GET /v1/prompts',
      'GET /v1/mcp/tools',
      'POST /v1/mcp/resources/read',
    ],
    tools: ['list_tools', 'list_resources', 'get_tool_schema'],
  }),
  c({
    scope: 'tools:call',
    domain: 'tool',
    dataClass: 'compute',
    risk: 'high',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: 'MCP 工具调用(逐工具二次授权,见 requiredScopeOfTool)',
    routes: ['POST /v1/tools/call', 'POST /v1/mcp/tools/call', 'POST /v1/sampling'],
  }),
  c({
    scope: 'mcp:connect',
    domain: 'tool',
    dataClass: 'compute',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '作为 MCP server 被外部 agent 长连接接入',
    // 三条端点全部由 apps/ai-service 提供,apps/api 契约里没有:
    //   POST /api/mcp                      ← app/routers/mcp_official.py:587(main.py:698 挂 /api)
    //   POST /api/mcp/export/streamable    ← app/services/mcp_export.py:15(ENABLE_MCP_EXPORT 时挂载)
    //   GET  /api/mcp/export/sse           ← app/services/mcp_export.py:13
    host: 'ai-service',
    routes: ['POST /api/mcp', 'POST /api/mcp/export/streamable', 'GET /api/mcp/export/sse'],
  }),
  // ===== Memory =====
  c({
    scope: 'memory:read',
    domain: 'memory',
    dataClass: 'scoped-read',
    risk: 'high',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '记忆召回(用户长期记忆属敏感数据,需显式授予)',
    routes: ['GET /v1/memory', 'POST /v1/memory/search'],
    tools: ['context_recall'],
  }),
  c({
    scope: 'memory:write',
    domain: 'memory',
    dataClass: 'scoped-write',
    risk: 'high',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '记忆保存/遗忘/Dream',
    routes: ['POST /v1/memory', 'DELETE /v1/memory', 'POST /v1/memory/dream'],
  }),
  // ===== Messages =====
  c({
    scope: 'messages:read',
    domain: 'messaging',
    dataClass: 'scoped-read',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '消息投递状态查询',
    routes: ['GET /v1/messages/:id/status'],
  }),
  c({
    scope: 'messages:write',
    domain: 'messaging',
    dataClass: 'compute',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '平台内消息发布/订阅',
    routes: ['POST /v1/messages', 'POST /v1/messages/subscribe'],
  }),
  c({
    scope: 'im:send',
    domain: 'messaging',
    dataClass: 'compute',
    risk: 'high',
    billable: false,
    thirdPartyEligible: false,
    idempotencyRequired: true,
    description: '以调用者身份向外部渠道(IM/邮件)发送消息 —— 触达真人,不对第三方 key 开放',
    routes: ['POST /api/im-gateway/send', 'POST /api/message-bus/send'],
  }),
  // ===== User / Workspace =====
  c({
    scope: 'user:read',
    domain: 'developer',
    dataClass: 'scoped-read',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '当前凭据归属主体资料',
    routes: ['GET /v1/me'],
  }),
  c({
    scope: 'workspace:read',
    domain: 'codebase',
    dataClass: 'scoped-read',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '工作区项目与文件树',
    routes: ['GET /v1/projects', 'GET /v1/projects/:id/files'],
  }),
  // ===== Workflows =====
  c({
    scope: 'workflows:read',
    domain: 'workflow',
    dataClass: 'scoped-read',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '工作流定义查询',
    routes: ['GET /v1/workflows/:id'],
  }),
  c({
    scope: 'workflows:write',
    domain: 'workflow',
    dataClass: 'compute',
    risk: 'high',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '工作流实例执行(可能触发外部动作)',
    routes: ['POST /v1/workflows/instances', 'POST /v1/workflows/coze/run'],
  }),
  // ===== Stats / Billing =====
  c({
    scope: 'stats:read',
    domain: 'developer',
    dataClass: 'scoped-read',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '自身用量统计',
    routes: ['GET /v1/usage', 'GET /v1/usage/:vendor'],
  }),
  c({
    scope: 'billing:read',
    domain: 'developer',
    dataClass: 'scoped-read',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '自身余额/账单读取',
    // O8b(2026-09-21)删除不实声明:`GET /v1/billing/balance`、`GET /v1/billing/invoices`
    // 在 apps/api/src/routes/** 无任何注册点(/v1 面未落地计费端点,真实余额面是
    // apps/api 的 /api/token/balance、/api/wallet/balance 与 /api/*/invoices —— 均属
    // 用户态平台面,不是本 scope 的对外端点)。scope 与 tools 保留(闸口与 MCP 工具仍引用),
    // 端点待真实开放后再登记。
    routes: [],
    tools: ['token6688_balance', 'token6688_model_info'],
  }),
  // ===== Assistants / Threads / Runs =====
  c({
    scope: 'assistants:read',
    domain: 'protocol',
    dataClass: 'scoped-read',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: 'Assistants 协议:助手读取',
    routes: ['GET /v1/assistants', 'GET /v1/assistants/:id'],
  }),
  c({
    scope: 'assistants:write',
    domain: 'protocol',
    dataClass: 'scoped-write',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: 'Assistants 协议:创建/更新/删除自有助手',
    // 更新走 POST(见 routes/v1-assistants.ts「修改 Assistant(部分字段更新)」),本仓未注册 PATCH。
    routes: ['POST /v1/assistants', 'POST /v1/assistants/:id', 'DELETE /v1/assistants/:id'],
  }),
  c({
    scope: 'threads:read',
    domain: 'protocol',
    dataClass: 'scoped-read',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '会话线程与消息读取(含历史内容)',
    routes: ['GET /v1/threads/:id', 'GET /v1/threads/:id/messages'],
  }),
  c({
    scope: 'threads:write',
    domain: 'protocol',
    dataClass: 'scoped-write',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '线程创建/删除/追加消息',
    routes: ['POST /v1/threads', 'DELETE /v1/threads/:id', 'POST /v1/threads/:id/messages'],
  }),
  c({
    scope: 'runs:read',
    domain: 'protocol',
    dataClass: 'compute',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: 'Run 与 Step 状态查询',
    routes: [
      'GET /v1/threads/:id/runs/:runId',
      'GET /v1/threads/:id/runs/:runId/steps',
      'GET /v1/run-refs/:ref',
      // O10c:第三方自带业务键反查。同一件事(读一个 run 的状态)不换权限位,
      // 归属由 Redis 键名 `run_ext:<userId>:<external_id>` 收口。
      'GET /v1/threads/runs/by-external-id/:externalId',
    ],
  }),
  c({
    scope: 'runs:write',
    domain: 'protocol',
    dataClass: 'compute',
    risk: 'high',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: 'Run 创建(取消/中断回复端点尚未实现)',
    // O8b(2026-09-21)删除不实声明:`POST /v1/threads/:id/runs/:runId/cancel`、
    // `.../submit` 在 routes/v1-assistants.ts 无注册点(该文件只有 runs 的
    // GET/POST 列表、创建、按 id 改 metadata 与 steps 列表)。
    routes: ['POST /v1/threads/:id/runs'],
  }),
  c({
    scope: 'batches:read',
    domain: 'protocol',
    dataClass: 'scoped-read',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '批任务清单与状态',
    // 真实注册面是单数 `/v1/batch*`(routes/v1-batches.ts),列表接口才是复数 `/v1/batches`。
    routes: ['GET /v1/batches', 'GET /v1/batch/:id'],
  }),
  c({
    scope: 'batches:write',
    domain: 'protocol',
    dataClass: 'compute',
    risk: 'high',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '批任务创建/取消(批量模型调用,费用放大风险)',
    // 真实注册面是单数 `/v1/batch*`(routes/v1-batches.ts)。
    routes: ['POST /v1/batch', 'POST /v1/batch/:id/cancel'],
  }),
  c({
    scope: 'responses:write',
    domain: 'protocol',
    dataClass: 'compute',
    risk: 'high',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: 'OpenAI Responses 协议补全',
    routes: ['POST /v1/responses'],
  }),
  c({
    scope: 'realtime:connect',
    domain: 'realtime',
    dataClass: 'compute',
    risk: 'high',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '实时语音/多模态长连接(占用并发槽)',
    // WS 声明:OpenAPI 3.0 不描述 WebSocket,`apps/api/openapi.json` 里必然没有对应项。
    // 真实注册点 apps/api/src/routes/v1-realtime.ts:742(`server.get('/v1/realtime',
    // { websocket: true, ... })`)。判据侧的豁免与导出器同源:
    // apps/api/scripts/export-openapi.ts `unmatchedRouteIsExpected()` + scripts/openapi-check.mjs。
    routes: ['WS /v1/realtime'],
  }),
  c({
    scope: 'rerank:write',
    domain: 'model',
    dataClass: 'compute',
    risk: 'low',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '重排序',
    routes: ['POST /v1/rerank'],
  }),
  c({
    scope: 'moderation:write',
    domain: 'protocol',
    dataClass: 'compute',
    risk: 'low',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '内容审核(上游 moderation 模型)',
    routes: ['POST /v1/moderations'],
  }),
  // ===== Codebase / Diff =====
  c({
    scope: 'codebase:read',
    domain: 'codebase',
    dataClass: 'scoped-read',
    risk: 'medium',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '代码库语义检索(索引内容属调用者)',
    routes: ['POST /api/v1/codebase/search', 'GET /api/v1/codebase/stats'],
    tools: ['search_codebase', 'index_codebase', 'analyze_code', 'generate_test'],
  }),
  c({
    scope: 'codebase:write',
    domain: 'codebase',
    dataClass: 'scoped-write',
    risk: 'medium',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '代码库建索引/删除仓库',
    routes: [
      'POST /api/v1/codebase/index',
      'DELETE /api/v1/codebase/repo/:repoId',
      'DELETE /api/v1/codebase/repo/:repoId/files',
    ],
  }),
  c({
    scope: 'diff:apply',
    domain: 'codebase',
    dataClass: 'scoped-write',
    risk: 'critical',
    billable: false,
    thirdPartyEligible: false,
    idempotencyRequired: true,
    description: '把生成内容全量写入磁盘文件 —— 写文件系统,不对第三方 key 开放',
    routes: ['POST /api/v1/ai/apply-diff'],
  }),
  // ===== 执行类 =====
  c({
    scope: 'sandbox:run',
    domain: 'execution',
    dataClass: 'compute',
    risk: 'critical',
    billable: false,
    thirdPartyEligible: false,
    idempotencyRequired: false,
    description: '沙箱内执行命令;开放前提=强制 docker --network=none 后端 + 管理员显式签发',
    // POST /api/sandbox/run ← app/routers/sandbox_exec.py:47(prefix /sandbox)+ :73(main.py:843 挂 /api)
    host: 'ai-service',
    routes: ['POST /api/sandbox/run'],
    tools: ['run_command', 'run_in_background', 'bg_task_status'],
  }),
  c({
    scope: 'browser:operate',
    domain: 'execution',
    dataClass: 'compute',
    risk: 'high',
    billable: true,
    thirdPartyEligible: false,
    idempotencyRequired: false,
    description: '浏览器自动化(可触达外部站点与真实账号)',
    // O8b(2026-09-21)路径修正 + 归属修正:`/api/browser-hub` 两端都不存在。
    // 真实面是 apps/ai-service 的 browser_hub —— app/routers/browser_hub.py:46 的
    // router prefix 是 `/browser`(不是 `/browser-hub`),经 app/main.py:737 挂在 `/api`
    // 下 ⇒ 实际 `/api/browser/sessions*`(POST /sessions、/sessions/{id}/navigate 等)。
    // 注意:apps/api 契约里另有 `/api/browser/probe|screenshot`(服务端渲染截图面),
    // 与本 scope 的 browser_* 工具面无关,不得混用。
    //
    // 句柄族 `browser_page_*` 于 2026-09-25 登记进 tools —— 同日早先的判定("page_* 两族动词
    // 没有任何服务端 HTTP/MCP 入口,故不登记")当时成立、现已被这张票消除:ai-service 侧现在有
    // 真实工具面(app/services/page_control_bridge.py 注册七个 browser_page_* 工具),而它也有
    // 真实落点(下面两条 agent-control 端点)。登记一条没有落点的工具名 = 对开发者控制台宣称一个
    // 不存在的可调用能力,那正是当时拒绝的理由;理由消失,结论才跟着变。
    //
    // 这一族的三条路由各自的角色(不要把三条读成"三个可调面"):
    //   · POST /api/agent-control/execute  执行面。category='browser' 经 apps/api 的
    //     CATEGORY_ENDPOINT 择到 endpoint='extension',由扩展 content script 执行、
    //     POST /result 回传。**ai-service 没有 DOM**,它的 handler 只转发 —— 把它写成本地
    //     实现会给模型一份永远为真的假回执,那比不登记更糟。
    //   · GET  /api/agent-control/status   授权面。只回**各族动作计数**(不含页面内容),
    //     服务端闸 control_autonomy.filter_unauthorized_page_tools 读它的
    //     browserPageActions>0;查不到即摘工具(fail-closed)。
    //   · POST /api/browser/*              同 scope 的选择器族(上方注释,归属未变)。
    //
    // 数据边界(项目口径"只开放功能不开放数据",三条都是实测而非意图):
    //   · 句柄与页面正文**不进 /v1 机器凭据面**:v1 网关构造上游请求体的字段是白名单
    //     (apps/api/src/routes/v1-messages.ts 的 openaiBody 只放 model/messages/max_tokens/
    //     temperature/top_p/stop/tools/tool_choice/metadata),不含 agent_tools ⇒ 机器凭据
    //     请求不到这一族;且 /api/agent-control/* 不在 config/open-capability-registry.ts 的
    //     paths 清单(该清单是"新增端点必须显式补进来才可对机器凭据开放"的封闭表)⇒ 也打不开
    //     执行通道。反向对照见 apps/ai-service/tests/test_page_control_bridge.py。
    //   · thirdPartyEligible=false 保持不变:这一族读的是用户正在浏览的**任意站点**,
    //     永不对第三方 key 开放。
    //   · 授权 = 双条件:客户端显式携带工具名(web 的 AGENT_TOOLS / 浏览器插件清单)+ 该用户
    //     在线的扩展端申报了 browserPageActions。它**不进** control_autonomy 的词面自动注入
    //     (那张表只覆盖四族应用内 UI,语义是"操作我们自己的站点")。
    //   · 快照正文只在**用户自己的对话流**里出现(与 web_ui_read / browser_extract_dom 同一条
    //     会话通道),没有第二条出口。
    host: 'ai-service',
    routes: [
      'POST /api/browser/*',
      'POST /api/agent-control/execute',
      'GET /api/agent-control/status',
    ],
    tools: [
      'browser_navigate',
      'browser_click',
      'browser_type',
      'browser_screenshot',
      'browser_click_element',
      'browser_close_tab',
      'browser_extract_dom',
      'browser_get_attribute',
      'browser_hover',
      'browser_scroll',
      'browser_select_option',
      'browser_selfcheck',
      'browser_selfcheck_screenshot',
      'browser_switch_tab',
      'browser_type_text',
      'browser_wait_for_element',
      // 句柄族(页内语义快照,执行体在扩展 content script)
      'browser_page_snapshot',
      'browser_page_click',
      'browser_page_type',
      'browser_page_select',
      'browser_page_hover',
      'browser_page_press_key',
      'browser_page_pick_at_point',
    ],
  }),
  c({
    scope: 'computer:operate',
    domain: 'execution',
    dataClass: 'platform',
    risk: 'critical',
    billable: false,
    thirdPartyEligible: false,
    idempotencyRequired: false,
    description: '本机 GUI 控制(键鼠/剪贴板)—— 永不开放给外部 key',
    // POST /api/computer-use/* ← app/routers/computer_use.py:56(prefix /computer-use,
    // 8 个 @router.post)+ app/main.py:819 挂 /api
    host: 'ai-service',
    routes: ['POST /api/computer-use/*'],
    tools: [
      'computer_screenshot_screen',
      'computer_mouse_move',
      'computer_mouse_click',
      'computer_mouse_scroll',
      'computer_keyboard_type',
      'computer_keyboard_press',
      'computer_keyboard_hotkey',
      'computer_active_window',
      'computer_clipboard_get',
      'computer_clipboard_set',
    ],
  }),
  // ===== Web =====
  c({
    scope: 'web:fetch',
    domain: 'web',
    dataClass: 'compute',
    risk: 'high',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: 'URL 抓取(SSRF 面,必须过出口白名单)',
    // O8b(2026-09-21)删除不实声明:`POST /api/web/fetch` 两端源码里都不存在路由
    // (apps/api/src/routes/** 无 /api/web/* 注册点;ai-service 只有
    // app/routers/web_tools.py:49 `POST /api/web-tools/call` —— 按 tool 名分发的统一
    // 入口,不是本 scope 的 REST 端点)。抓取能力当前只以 MCP 工具形态存在。
    // scope 与 tools 保留(闸口与 MCP 工具仍引用),真实 REST 端点落地后再登记。
    routes: [],
    tools: ['fetch_url', 'fetch_readable', 'extract_web', 'screenshot_url'],
  }),
  c({
    scope: 'search:web',
    domain: 'web',
    dataClass: 'compute',
    risk: 'medium',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '联网搜索与整站爬取(资源密集)',
    // O8b(2026-09-21)删除不实声明:`POST /api/web/search`、`POST /api/web/crawl` 两端
    // 均无注册点。真实面是 ai-service 的工具分发口 `app/routers/tools.py:49`
    // `POST /api/tools/search-web`(整站爬取 map_site/crawl_site 当前只有 MCP 工具形态,
    // 无 HTTP 端点)。scope 与 tools 保留,REST 面落地后再登记。
    routes: [],
    tools: ['web_search', 'search_web', 'map_site', 'crawl_site'],
  }),
  // ===== 开发者治理面 =====
  c({
    scope: 'webhooks:manage',
    domain: 'developer',
    dataClass: 'scoped-write',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '自有 webhook 订阅管理与重试',
    routes: [
      'GET /api/developer/webhooks/subscriptions',
      'POST /api/developer/webhooks/subscriptions',
      'POST /api/developer/webhooks/subscriptions/:id/test',
    ],
  }),
  c({
    scope: 'connectors:read',
    domain: 'tool',
    dataClass: 'scoped-read',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '外部连接器/MCP server 清单与能力',
    // GET /api/connectors      ← app/routers/connectors.py:29(prefix /connectors)+ :107(@router.get(""))
    // GET /api/mcp/external/servers ← app/routers/mcp.py:346(main.py:697 挂 /api)
    host: 'ai-service',
    routes: ['GET /api/connectors', 'GET /api/mcp/external/servers'],
  }),
  c({
    scope: 'connectors:write',
    domain: 'tool',
    dataClass: 'scoped-write',
    risk: 'high',
    billable: false,
    thirdPartyEligible: false,
    idempotencyRequired: true,
    description: '注册/启停外部 MCP server —— 等于注入可执行工具,不对第三方 key 开放',
    // POST /api/mcp/external/servers             ← app/routers/mcp.py:362
    // POST /api/mcp/external/servers/{name}/connect ← app/routers/mcp.py:426
    // O8b(2026-09-21)路径修正:原声明 `POST /api/mcp/external/connect` 是臆写的短形式,
    // 两端源码里都不存在(ai-service 的 connect 路由带 {name} 段)。
    host: 'ai-service',
    routes: ['POST /api/mcp/external/servers', 'POST /api/mcp/external/servers/{name}/connect'],
  }),
  c({
    scope: 'skills:read',
    domain: 'tool',
    dataClass: 'scoped-read',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '技能清单与说明',
    routes: ['GET /api/skills', 'GET /v1/skills'],
    tools: ['list_skills'],
  }),
  c({
    scope: 'skills:write',
    domain: 'tool',
    dataClass: 'scoped-write',
    risk: 'high',
    billable: false,
    thirdPartyEligible: false,
    idempotencyRequired: true,
    description: '安装/启停技能(注入 agent 行为)',
    // O8b(2026-09-21)删除不实声明:`POST /api/skills/install` 两端均无注册点 ——
    // ai-service 的 `/install` 是 MCP store(`app/routers/mcp.py:547 POST /api/mcp/store/install`),
    // 属 tools/mcp 面而非技能面。启停面**确实存在**但是**人 JWT 专用**
    // (`apps/api/src/routes/skills.ts:915 POST /api/skills/:name/enable` 走 checkAuth,
    // 不挂能力闸),而 `routes` 字段的语义是"该能力的对外端点";本 scope 又已是
    // thirdPartyEligible=false ⇒ 机器凭据永远拿不到。登记它只会让契约与文档
    // 声称一个机器侧根本调不到的端点,故按"暂无对外端点"处理。
    routes: [],
  }),
  c({
    scope: 'edu:read',
    domain: 'platform',
    dataClass: 'scoped-read',
    risk: 'low',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: false,
    description: '教育内容与题库读取',
    routes: ['GET /api/edu/*'],
    tools: [
      'edu_get_course',
      'edu_list_questions',
      'edu_list_students',
      'edu_list_tuition_fees',
      'edu_list_payment_records',
      'edu_list_refunds',
      'edu_list_arrears',
      'edu_list_fee_reminders',
      'edu_my_bills',
      'edu_payment_summary',
    ],
  }),
  c({
    scope: 'edu:write',
    domain: 'platform',
    dataClass: 'scoped-write',
    risk: 'medium',
    billable: false,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '教育内容维护',
    routes: ['POST /api/edu/*'],
    tools: [
      'edu_create_question',
      'edu_create_payment_record',
      'edu_create_refund',
      'edu_approve_refund',
      'edu_reject_refund',
      'edu_send_fee_reminder',
      'edu_send_fee_reminder_batch',
    ],
  }),
  c({
    scope: 'publish:operate',
    domain: 'platform',
    dataClass: 'platform',
    risk: 'critical',
    billable: false,
    thirdPartyEligible: false,
    idempotencyRequired: true,
    description: '内容发布到第三方社媒 —— 对外可见行为,仅自有账号体系可用',
    routes: ['POST /api/publish/*'],
    tools: ['publish_article'],
  }),
  c({
    scope: 'oauth:manage',
    domain: 'developer',
    dataClass: 'scoped-write',
    risk: 'high',
    billable: false,
    thirdPartyEligible: false,
    idempotencyRequired: true,
    description: 'OAuth 应用注册与密钥轮转(自助 DCR 需另走 /connect/register)',
    routes: ['POST /api/auth/oauth/apps/create', 'DELETE /api/auth/oauth/apps/:clientId'],
  }),
  c({
    scope: 'ops:execute',
    domain: 'platform',
    dataClass: 'platform',
    risk: 'critical',
    billable: false,
    thirdPartyEligible: false,
    idempotencyRequired: false,
    description: '平台内部运维能力(直连数据库/git 写/定时任务/PR 审查)—— 机器凭据永不放行',
    // O8b(2026-09-21)删除不实声明:`POST /api/ops/*` 两端均无 `/api/ops` 前缀的路由
    // (apps/api 无 ops 路由文件;ai-service 的同类能力按面分散在 pr_review.py /
    // self_healing.py 等各自前缀下,不存在统一 `/api/ops` 入口)。本 scope 只以
    // MCP 工具形态存在,且 dataClass=platform ⇒ 机器凭据一律 403,登记为空端点不影响闸口。
    routes: [],
    tools: [
      'db_query',
      'git_operations',
      'configure_automation_task',
      'schedule_task',
      'review_pr',
    ],
  }),
] as const satisfies readonly CapabilityEntry[]

/**
 * `self-metadata-implicit`:历史上已存在但 dataClass 归入 compute 的特例(只读自有运行记录)。
 * 目录完整性校验会把它规范到 compute/scoped-read,避免语义漂移。
 */
const LEGACY_DATA_CLASS_ALIASES: Record<string, CapabilityDataClass> = {
  'self-metadata-implicit': 'compute',
}

/** scope → entry 索引(重复 scope 直接抛错,防静默覆盖)。 */
function buildIndex(): Map<ApiKeyPermission, CapabilityEntry> {
  const map = new Map<ApiKeyPermission, CapabilityEntry>()
  for (const entry of CAPABILITY_CATALOG) {
    if (map.has(entry.scope)) {
      throw new Error(`[capability-catalog] 重复登记 scope: ${entry.scope}`)
    }
    if (!API_KEY_PERMISSIONS.includes(entry.scope)) {
      throw new Error(`[capability-catalog] scope ${entry.scope} 不在 API_KEY_PERMISSIONS 枚举内`)
    }
    map.set(entry.scope, entry)
  }
  return map
}

const INDEX = buildIndex()

/** 有效 dataClass(消化历史别名)。 */
export function effectiveDataClass(entry: CapabilityEntry): CapabilityDataClass {
  const raw = entry.dataClass as string
  return LEGACY_DATA_CLASS_ALIASES[raw] ?? entry.dataClass
}

export function getCapability(scope: ApiKeyPermission): CapabilityEntry | undefined {
  return INDEX.get(scope)
}

/** 未登记即视为拒绝:授权闸默认走这里。 */
export function requireCapabilityOrThrow(scope: ApiKeyPermission): CapabilityEntry {
  const entry = INDEX.get(scope)
  if (!entry) {
    throw new Error(`[capability-catalog] scope 未登记,拒绝放行: ${scope}`)
  }
  return entry
}

export function allScopes(): ApiKeyPermission[] {
  return [...INDEX.keys()]
}

/** 已登记 scope 之外、枚举里存在的 scope(用于校验目录覆盖度)。 */
export function unregisteredScopes(): ApiKeyPermission[] {
  return API_KEY_PERMISSIONS.filter((s) => !INDEX.has(s))
}

export function scopesByDomain(domain: CapabilityDomain): CapabilityEntry[] {
  return [...INDEX.values()].filter((e) => e.domain === domain)
}

export function thirdPartyEligibleScopes(): ApiKeyPermission[] {
  return [...INDEX.values()]
    .filter((e) => e.thirdPartyEligible)
    .map((e) => e.scope)
    .sort()
}

/** 该 scope 生效的限流画像(取 entry.risk 档)。 */
export function rateProfileOf(scope: ApiKeyPermission): RateProfile {
  const entry = INDEX.get(scope)
  return RATE_PROFILES[entry ? entry.risk : 'critical']
}

/**
 * 机器凭据能否触达该 scope:
 * platform 域 / 未登记 / 显式不可对第三方 → false。
 * 'all' 通配不在此判定,由调用方先做 key 级校验。
 */
export function isM2MAllowed(scope: ApiKeyPermission): boolean {
  const entry = INDEX.get(scope)
  if (!entry) return false
  if (effectiveDataClass(entry) === 'platform') return false
  return entry.thirdPartyEligible
}

/** 校验用:端点模式前缀(用于 check-capability-catalog 比对实际路由清单)。 */
export function declaredRoutePatterns(): string[] {
  return [...INDEX.values()].flatMap((e) => e.routes.map((r) => `${e.scope}\t${r}`))
}

/** 导出的清单形态(capabilities.json / ai-service 启动期消费)。 */
export interface CapabilityManifest {
  version: string
  generatedAt: string
  dataClasses: readonly string[]
  risks: readonly string[]
  rateProfiles: Record<CapabilityRisk, RateProfile>
  computeAllowedTables: readonly string[]
  capabilities: Array<{
    scope: string
    domain: string
    dataClass: CapabilityDataClass
    risk: CapabilityRisk
    billable: boolean
    thirdPartyEligible: boolean
    idempotencyRequired: boolean
    description: string
    routes: readonly string[]
    /** 缺省即 `'api'`;生成器只在源码显式声明时写出该键,避免 62 条噪声。 */
    host?: CapabilityHost
    tools: readonly string[]
    rate: RateProfile
  }>
  /** MCP 工具名 → 所需 scope(未列出的工具默认拒绝外部调用)。 */
  toolScopeMap: Record<string, ApiKeyPermission>
}

/** 工具名 → scope 的反向索引(同一工具不得映射到两个 scope)。 */
export function toolScopeMap(): Record<string, ApiKeyPermission> {
  const map: Record<string, ApiKeyPermission> = {}
  for (const entry of INDEX.values()) {
    for (const tool of entry.tools ?? []) {
      if (map[tool] && map[tool] !== entry.scope) {
        throw new Error(
          `[capability-catalog] 工具 ${tool} 被映射到两个 scope: ${map[tool]} / ${entry.scope}`,
        )
      }
      map[tool] = entry.scope
    }
  }
  return map
}

export function scopeOfTool(toolName: string): ApiKeyPermission | undefined {
  return toolScopeMap()[toolName]
}

export function buildManifest(
  version: string,
  generatedAt = new Date().toISOString(),
): CapabilityManifest {
  const capabilities = [...INDEX.values()].map((e): CapabilityManifest['capabilities'][number] => ({
    scope: e.scope as string,
    domain: e.domain as string,
    dataClass: effectiveDataClass(e),
    risk: e.risk,
    billable: e.billable,
    thirdPartyEligible: e.thirdPartyEligible,
    idempotencyRequired: e.idempotencyRequired,
    description: e.description,
    routes: e.routes,
    // 键位固定放在 routes 之后 / tools 之前,且仅在显式声明时写出 —— 保证
    // `export-capabilities.ts --check` 的 JSON.stringify 逐字节幂等。
    ...(e.host === undefined ? {} : { host: e.host }),
    tools: e.tools ?? [],
    rate: RATE_PROFILES[e.risk],
  }))
  return {
    version,
    generatedAt,
    dataClasses: CAPABILITY_DATA_CLASSES,
    risks: CAPABILITY_RISKS,
    rateProfiles: RATE_PROFILES,
    computeAllowedTables: COMPUTE_ALLOWED_TABLES,
    capabilities,
    toolScopeMap: toolScopeMap(),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
