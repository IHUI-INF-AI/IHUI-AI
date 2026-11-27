// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 能力目录 v0（2026-11-27）。
 *
 * 这份目录回答一个问题：平台上到底有哪些“可被调用的能力”，而不是有多少个页面。
 * 每条能力必须能回答：输入什么、输出什么、多少钱、谁能用、重复调用怎么幂等、
 * 目标时延、代码归谁、要不要审计、现在能不能被 Agent 调。
 *
 * 口径说明（避免把设计写成现状）：
 * - `status: agent-ready` 仅给已经在 `apps/ai-service/app/tools/__all__` 里导出、
 *   Agent 真能调用的工具；当前 16 条。
 * - `status: ui-only` 表示有页面/接口，但 Agent 还调不动。
 * - `status: planned` 表示只有产品位，尚未落地。
 * - `sla.p95Ms` 是目标值，不是实测值；`price` 只标计费方式，不写具体点数，
 *   点数倍率以 `/api/pricing/models` 为准。
 * - `owner` 写代码路径，不写虚拟团队名，出问题能直接找到模块。
 */

export type CapabilityDomain =
  | 'content'
  | 'publish'
  | 'account'
  | 'media'
  | 'knowledge'
  | 'education'
  | 'tool'

export type CapabilityStatus = 'agent-ready' | 'ui-only' | 'planned'

export type CapabilitySurface = 'web' | 'agent' | 'mobile'

export type CapabilityPriceMode = 'free' | 'metered' | 'unpriced'

export type CapabilityPermissionScope = 'user' | 'org_admin' | 'public'

export type CapabilityAuditLevel = 'none' | 'standard' | 'required'

export interface Capability {
  readonly id: string
  readonly verb: string
  readonly title: string
  readonly description: string
  readonly domain: CapabilityDomain
  readonly inputSchema: Record<string, unknown>
  readonly outputSchema: Record<string, unknown>
  readonly price: {
    readonly mode: CapabilityPriceMode
    readonly note: string
  }
  readonly permissionScope: CapabilityPermissionScope
  readonly idempotencyKey: string
  readonly sla: {
    readonly p95Ms: number
    readonly note: string
  }
  /** 代码归属路径（相对仓库根），必须是真实存在的文件 */
  readonly owner: string
  readonly audit: CapabilityAuditLevel
  readonly status: CapabilityStatus
  readonly surfaces: readonly CapabilitySurface[]
  /** 仅当 status = agent-ready 时非空；名字必须出现在 tools/__init__.py */
  readonly agentTool: string | null
  readonly uiHref: string | null
}

const SLA_NOTE = '目标值，未实测'
const METERED = { mode: 'metered', note: '按模型点数计费，倍率以 /api/pricing/models 为准' } as const
const FREE = { mode: 'free', note: '不扣点数；平台侧限额另计' } as const

const WEB = ['web'] as const
const WEB_AGENT = ['web', 'agent'] as const

function str(description: string): Record<string, unknown> {
  return { type: 'string', description }
}

function strArray(description: string): Record<string, unknown> {
  return { type: 'array', items: { type: 'string' }, description }
}

function inputSchema(
  required: readonly string[],
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return { type: 'object', required: [...required], properties }
}

function outputSchema(properties: Record<string, unknown>): Record<string, unknown> {
  return { type: 'object', properties }
}

export const CAPABILITY_CATALOG: readonly Capability[] = [
  // ── 内容 ──────────────────────────────────────────────────────────────
  {
    id: 'content.generate',
    verb: 'generate',
    title: 'AI 出稿',
    description: '一句需求出成稿，按目标平台改写语气与结构',
    domain: 'content',
    inputSchema: inputSchema(['brief'], {
      brief: str('一句话需求'),
      platform: str('目标平台，可空'),
      tone: str('语气，可空'),
      min_chars: { type: 'integer', description: '正文最少字符数' },
      max_chars: { type: 'integer', description: '正文最多字符数' },
      title_chars: { type: 'integer', description: '标题精确字数，0=不约束' },
      hashtag_count: { type: 'integer', description: '话题词精确个数，0=不约束' },
    }),
    outputSchema: outputSchema({
      title: str('标题'),
      content: str('成稿正文'),
      hashtags: strArray('话题词数组'),
      charCount: { type: 'integer', description: '正文字符数' },
      withinRange: { type: 'boolean', description: '是否落在字数区间' },
      titleLength: { type: 'integer', description: '标题字符数' },
      titleWithinRange: { type: 'boolean', description: '标题是否落在指定字数' },
      hashtagCount: { type: 'integer', description: '话题词个数' },
    }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'content.generate:{conversationId}:{turnId}',
    sla: { p95Ms: 30000, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/content_tools.py',
    audit: 'standard',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'generate_content',
    uiHref: '/ai-generation',
  },
  {
    id: 'content.compliance',
    verb: 'check',
    title: '合规自检',
    description: '发布前检查标题、字数、话题词、绝对化承诺与硬引导，给出阻断项与风险项',
    domain: 'content',
    inputSchema: inputSchema(['content'], {
      content: str('待检查正文'),
      title: str('标题，可空'),
      hashtags: {
        anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        description: '话题词，空格/逗号分隔字符串或数组',
      },
      platform: str('目标平台，可空'),
      profile: {
        type: 'string',
        enum: ['generic', 'ihui_koubo'],
        description: '预设档：generic 通用；ihui_koubo=470-490字/标题16字/5话题词',
      },
      min_chars: { type: 'integer', description: '正文最少字符数，0=不查' },
      max_chars: { type: 'integer', description: '正文最多字符数，0=不查' },
      title_length: { type: 'integer', description: '标题精确字数，0=不查' },
      hashtag_count: { type: 'integer', description: '话题词精确个数，0=不查' },
      require_title: { type: 'boolean', description: '是否必须有标题，默认 true' },
      require_ai_disclosure: { type: 'boolean', description: '是否要求 AI 生成标识，默认 false' },
    }),
    outputSchema: outputSchema({
      ok: { type: 'boolean', description: '是否无阻断项' },
      score: { type: 'integer', description: '0-100 自检分' },
      blocking: { type: 'integer', description: '阻断项数' },
      warnings: { type: 'integer', description: '风险项数' },
      profile: str('生效的预设档'),
      stats: { type: 'object', description: 'charCount/titleLength/hashtagCount' },
      contentHash: str('标题+话题词+正文的哈希，可当幂等键'),
      checks: { type: 'array', items: { type: 'object' }, description: '阻断/风险明细' },
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'content.compliance:{contentHash}',
    sla: { p95Ms: 80, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/content_compliance_tools.py',
    audit: 'standard',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'precheck_content',
    uiHref: '/ai-generation',
  },
  {
    id: 'content.rewrite',
    verb: 'rewrite',
    title: '按平台改写',
    description: '同一份稿改成口播、图文、长文等不同平台形态',
    domain: 'content',
    inputSchema: inputSchema(['source', 'platform'], {
      source: str('原稿'),
      platform: str('目标平台'),
      maxChars: { type: 'integer', description: '字数上限' },
    }),
    outputSchema: outputSchema({ content: str('改写稿') }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'content.rewrite:{sourceId}:{platform}',
    sla: { p95Ms: 20000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/content-extended.ts',
    audit: 'standard',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/ai-generation',
  },
  {
    id: 'content.title',
    verb: 'title',
    title: '标题与话题词',
    description: '按选题生成标题与话题词组合，含大流量词与精准词',
    domain: 'content',
    inputSchema: inputSchema(['brief'], {
      brief: str('选题或正文'),
      platform: str('目标平台，可空'),
      count: { type: 'integer', description: '生成条数' },
    }),
    outputSchema: outputSchema({
      titles: strArray('候选标题'),
      topics: strArray('话题词'),
    }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'content.title:{sourceId}:{count}',
    sla: { p95Ms: 10000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/content.ts',
    audit: 'standard',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/ai-generation',
  },
  {
    id: 'content.script',
    verb: 'script',
    title: '口播稿',
    description: '按“痛点-方案-价值-互动”结构出口播稿，控制字数',
    domain: 'content',
    inputSchema: inputSchema(['brief'], {
      brief: str('主题与目标人群'),
      durationSec: { type: 'integer', description: '目标时长（秒）' },
      minChars: { type: 'integer', description: '最少字数' },
      maxChars: { type: 'integer', description: '最多字数' },
    }),
    outputSchema: outputSchema({
      script: str('口播正文'),
      hook: str('开头钩子'),
      wordCount: { type: 'integer', description: '字数' },
    }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'content.script:{conversationId}:{turnId}',
    sla: { p95Ms: 30000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/content.ts',
    audit: 'standard',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/ai-generation',
  },
  {
    id: 'content.translate',
    verb: 'translate',
    title: '多语翻译',
    description: '中英日韩等语种互译，保留段落与术语',
    domain: 'content',
    inputSchema: inputSchema(['text', 'targetLang'], {
      text: str('原文'),
      targetLang: str('目标语种'),
    }),
    outputSchema: outputSchema({ text: str('译文') }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'content.translate:{sourceId}:{targetLang}',
    sla: { p95Ms: 15000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/content-extended.ts',
    audit: 'none',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/tools',
  },

  // ── 发布 ──────────────────────────────────────────────────────────────
  {
    id: 'publish.preflight',
    verb: 'preflight',
    title: '发布预检',
    description: '发布前先查内容合规、账号状态、适配器与格式，不创建任务',
    domain: 'publish',
    inputSchema: inputSchema(['title', 'format', 'targets'], {
      title: str('发布标题'),
      format: str('md/docx/html/pdf/image/video'),
      text: str('md/html 正文，可空'),
      file_path: str('docx/pdf/image/video 文件路径，可空'),
      images: strArray('正文图片路径'),
      targets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: { type: 'string', description: '平台 id' },
            account_id: { type: 'integer', description: '账号 id' },
          },
          required: ['platform'],
        },
        description: '平台/账号组合',
      },
      profile: {
        type: 'string',
        enum: ['generic', 'ihui_koubo'],
        description: '内容自检预设档',
      },
    }),
    outputSchema: outputSchema({
      ok: { type: 'boolean', description: '内容与目标是否都通过' },
      contentOk: { type: 'boolean', description: '内容合规是否通过' },
      targetsOk: { type: 'boolean', description: '账号/适配器是否通过' },
      blocked: { type: 'integer', description: '阻断项数' },
      contentCheck: { type: 'object', description: 'precheck_content 原始结果' },
      targets: { type: 'array', items: { type: 'object' }, description: '逐账号预检明细' },
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'publish.preflight:{contentHash}:{targets}',
    sla: { p95Ms: 800, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/publish_tools.py',
    audit: 'standard',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'publish_preflight',
    uiHref: '/publish/new',
  },
  {
    id: 'publish.draft',
    verb: 'draft',
    title: '发布草稿',
    description: '先预检内容与账号，通过后落草稿；必须人工确认后才进调度',
    domain: 'publish',
    inputSchema: inputSchema(['title', 'format', 'targets'], {
      title: str('发布标题'),
      format: str('md/docx/html/pdf/image/video'),
      text: str('md/html 正文，可空'),
      file_path: str('docx/pdf/image/video 文件路径，可空'),
      images: strArray('正文图片路径'),
      targets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: { type: 'string', description: '平台 id' },
            account_id: { type: 'integer', description: '账号 id，必填' },
          },
          required: ['platform', 'account_id'],
        },
        description: '平台/账号组合',
      },
      profile: {
        type: 'string',
        enum: ['generic', 'ihui_koubo'],
        description: '内容自检预设档',
      },
    }),
    outputSchema: outputSchema({
      taskId: str('草稿任务 id'),
      status: str('状态，正常为 draft'),
      confirm: { type: 'object', description: '人工确认入口' },
      blocked: { type: 'integer', description: '阻断项数，正常为 0' },
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'publish.draft:{contentHash}:{targets}',
    sla: { p95Ms: 1200, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/publish_tools.py',
    audit: 'standard',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'create_publish_draft',
    uiHref: '/publish/history',
  },
  {
    id: 'publish.edit',
    verb: 'edit',
    title: '编辑草稿',
    description: '原地改草稿的标题/正文/文件/目标，重新预检，仍保持草稿等人工确认',
    domain: 'publish',
    inputSchema: inputSchema(['task_id'], {
      task_id: str('草稿任务 id'),
      title: str('新标题，可空=保留'),
      format: str('新格式，可空=保留'),
      text: str('新正文，可空=保留'),
      file_path: str('新文件路径，可空=保留'),
      images: strArray('新正文图片，可空=保留'),
      targets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: { type: 'string', description: '平台 id' },
            account_id: { type: 'integer', description: '账号 id，必填' },
          },
          required: ['platform', 'account_id'],
        },
        description: '新平台/账号组合，可空=保留',
      },
      profile: {
        type: 'string',
        enum: ['generic', 'ihui_koubo'],
        description: '重新预检的内容预设档',
      },
    }),
    outputSchema: outputSchema({
      taskId: str('草稿任务 id'),
      status: str('状态，正常仍为 draft'),
      contentHash: str('更新后的内容哈希，可空'),
      changedFields: strArray('本次实际改动的字段'),
      confirm: { type: 'object', description: '人工确认入口' },
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'publish.edit:{taskId}:{contentHash}',
    sla: { p95Ms: 1200, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/publish_tools.py',
    audit: 'standard',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'update_publish_draft',
    uiHref: '/publish/history',
  },
  {
    id: 'publish.task',
    verb: 'get',
    title: '发布任务详情',
    description: '按任务 id 查状态、逐平台结果、失败原因与指标快照，供 Agent 诊断和下一步建议',
    domain: 'publish',
    inputSchema: inputSchema(['task_id'], {
      task_id: str('发布任务 id，从草稿或发布历史取'),
    }),
    outputSchema: outputSchema({
      taskId: str('任务 id'),
      status: str('任务状态'),
      content: { type: 'object', description: '正文/文件路径/图片' },
      targets: { type: 'array', items: { type: 'object' }, description: '目标账号' },
      platforms: { type: 'array', items: { type: 'object' }, description: '逐平台结果与指标' },
      nextActions: { type: 'array', items: { type: 'object' }, description: '下一步建议' },
      metricsAvailable: { type: 'boolean', description: '指标快照是否可读' },
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'publish.task:{taskId}',
    sla: { p95Ms: 300, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/publish_tools.py',
    audit: 'standard',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'get_publish_task',
    uiHref: '/publish/history',
  },
  {
    id: 'publish.queue',
    verb: 'list',
    title: '发布任务队列',
    description: '按状态列出草稿、定时、运行、失败任务摘要，供 Agent 回答“有哪些待确认/失败了”',
    domain: 'publish',
    inputSchema: inputSchema([], {
      status: str('只看一种状态，可空'),
      days: { type: 'integer', description: '最近多少天，默认 30' },
      limit: { type: 'integer', description: '最多返回多少条，默认 50' },
    }),
    outputSchema: outputSchema({
      items: { type: 'array', items: { type: 'object' }, description: '任务摘要（不含完整正文/凭据）' },
      count: { type: 'integer', description: '返回条数' },
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'none',
    sla: { p95Ms: 500, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/publish_tools.py',
    audit: 'none',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'list_publish_tasks',
    uiHref: '/publish/history',
  },
  {
    id: 'publish.dispatch',
    verb: 'dispatch',
    title: '多平台发布',
    description: '一次编排，把同一条内容分发到多个已登录平台账号',
    domain: 'publish',
    inputSchema: inputSchema(['draftId', 'accountIds'], {
      draftId: str('待发布内容 id'),
      accountIds: strArray('目标账号 id'),
      publishAt: str('定时时间，可空'),
    }),
    outputSchema: outputSchema({
      taskIds: strArray('发布任务 id'),
      failed: strArray('失败账号与原因'),
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'publish.dispatch:{draftId}:{accountId}',
    sla: { p95Ms: 60000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/publish-routes.ts',
    audit: 'required',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/publish/new',
  },
  {
    id: 'publish.schedule',
    verb: 'schedule',
    title: '定时发布',
    description: '按时间表排队发布，失败可重排',
    domain: 'publish',
    inputSchema: inputSchema(['draftId', 'accountId', 'publishAt'], {
      draftId: str('内容 id'),
      accountId: str('账号 id'),
      publishAt: str('ISO 时间'),
    }),
    outputSchema: outputSchema({ taskId: str('任务 id'), scheduledAt: str('计划时间') }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'publish.schedule:{draftId}:{accountId}:{publishAt}',
    sla: { p95Ms: 10000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/schedule.ts',
    audit: 'standard',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/publish/new',
  },
  {
    id: 'publish.platforms',
    verb: 'list',
    title: '平台能力清单',
    description: '列出已接平台、账号绑定状态、登录态与真实发布证据，回答为什么发不出去',
    domain: 'publish',
    inputSchema: inputSchema([], {
      platform: str('只看一个平台，可空'),
    }),
    outputSchema: outputSchema({
      platforms: strArray('平台验收明细'),
      verified: { type: 'integer', description: '有公开证据的真实发布平台数' },
      nextAction: str('每个平台还缺什么'),
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'none',
    sla: { p95Ms: 5000, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/publish_tools.py',
    audit: 'none',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'get_publish_acceptance',
    uiHref: '/account-pool',
  },
  {
    id: 'publish.analytics',
    verb: 'analytics',
    title: '发布数据',
    description: '回收发布成功率、播放/互动与平台耗时，按平台汇总',
    domain: 'publish',
    inputSchema: inputSchema([], {
      days: { type: 'integer', description: '统计最近多少天，默认 30' },
    }),
    outputSchema: outputSchema({
      tasks: { type: 'object', description: '任务状态汇总' },
      platforms: { type: 'array', items: { type: 'object' }, description: '按平台的成功率与耗时' },
      engagement: { type: 'object', description: '播放/点赞/评论/转发汇总' },
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'none',
    sla: { p95Ms: 500, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/publish_tools.py',
    audit: 'standard',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'get_publish_stats',
    uiHref: '/publish/analytics',
  },
  {
    id: 'publish.review',
    verb: 'review',
    title: '发布复盘',
    description: '按篇生成复盘：哪里掉量、下一篇怎么改',
    domain: 'publish',
    inputSchema: inputSchema(['messageId'], {
      messageId: str('发布记录 id'),
    }),
    outputSchema: outputSchema({ review: str('复盘正文'), suggestions: strArray('改法') }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'publish.review:{messageId}',
    sla: { p95Ms: 20000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/publish-analytics.ts',
    audit: 'none',
    status: 'planned',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/publish/analytics',
  },

  // ── 账号 ──────────────────────────────────────────────────────────────
  {
    id: 'account.connect',
    verb: 'connect',
    title: '账号接入',
    description: '扫码或账密接入平台账号，登录态落库',
    domain: 'account',
    inputSchema: inputSchema(['platform'], {
      platform: str('平台标识'),
      credential: str('凭据，扫码时为空'),
    }),
    outputSchema: outputSchema({ accountId: str('账号 id'), status: str('登录态') }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'account.connect:{platform}:{accountId}',
    sla: { p95Ms: 120000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/account-pool.ts',
    audit: 'required',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/account-pool',
  },
  {
    id: 'account.list',
    verb: 'list',
    title: '账号清单',
    description: '列出已接入账号、启用状态与登录态，不读取凭据',
    domain: 'account',
    inputSchema: inputSchema([], {
      platform: str('只看某个平台，可空'),
      status: str('只看某个状态，可空'),
      include_disabled: { type: 'boolean', description: '是否包含禁用账号，默认 true' },
      limit: { type: 'integer', description: '最多返回多少个，默认 100' },
    }),
    outputSchema: outputSchema({
      count: { type: 'integer', description: '账号数' },
      items: { type: 'array', items: { type: 'object' }, description: '账号明细（无凭据）' },
      summary: { type: 'object', description: '按平台/状态汇总' },
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'account.list:{userId}:{platform}:{status}',
    sla: { p95Ms: 150, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/publish_tools.py',
    audit: 'standard',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'list_publish_accounts',
    uiHref: '/account-pool',
  },
  {
    id: 'account.health',
    verb: 'check',
    title: '登录态体检',
    description: '批量检查账号登录态是否有效，标出掉线账号',
    domain: 'account',
    inputSchema: inputSchema([], { accountIds: strArray('账号 id，可空') }),
    outputSchema: outputSchema({
      valid: strArray('有效账号'),
      invalid: strArray('掉线账号'),
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'none',
    sla: { p95Ms: 10000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/account-pool.ts',
    audit: 'none',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/account-pool',
  },
  {
    id: 'account.renew',
    verb: 'renew',
    title: '自动保活',
    description: '按周期续期登录态，失败进重试队列',
    domain: 'account',
    inputSchema: inputSchema(['accountId'], { accountId: str('账号 id') }),
    outputSchema: outputSchema({ renewed: { type: 'boolean' }, nextAt: str('下次续期时间') }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'account.renew:{accountId}:{date}',
    sla: { p95Ms: 30000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/account-pool.ts',
    audit: 'standard',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/account-pool',
  },

  // ── 素材 ──────────────────────────────────────────────────────────────
  {
    id: 'media.image',
    verb: 'image',
    title: '配图与封面',
    description: '按文案生成封面、配图，支持多种比例',
    domain: 'media',
    inputSchema: inputSchema(['prompt'], {
      prompt: str('画面描述'),
      ratio: str('比例，如 3:4'),
      count: { type: 'integer', description: '张数' },
    }),
    outputSchema: outputSchema({ urls: strArray('图片地址') }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'media.image:{conversationId}:{turnId}',
    sla: { p95Ms: 60000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/ai-image-edit.ts',
    audit: 'standard',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/image-gen',
  },
  {
    id: 'media.edit',
    verb: 'edit',
    title: '图片编辑',
    description: '改字、换元素、扩图，保留主体',
    domain: 'media',
    inputSchema: inputSchema(['imageUrl', 'instruction'], {
      imageUrl: str('原图地址'),
      instruction: str('编辑指令'),
    }),
    outputSchema: outputSchema({ url: str('结果图地址') }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'media.edit:{imageHash}:{instructionHash}',
    sla: { p95Ms: 60000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/ai-image-edit.ts',
    audit: 'standard',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/image-gen',
  },
  {
    id: 'media.video',
    verb: 'video',
    title: '短视频合成',
    description: '图/文/配音合成竖版短视频',
    domain: 'media',
    inputSchema: inputSchema(['script'], {
      script: str('口播稿'),
      assets: strArray('素材地址'),
      ratio: str('比例，默认 9:16'),
    }),
    outputSchema: outputSchema({ taskId: str('合成任务 id'), url: str('成片地址') }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'media.video:{conversationId}:{turnId}',
    sla: { p95Ms: 600000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/ai-video-compose.ts',
    audit: 'standard',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/image-gen',
  },

  // ── 知识 ──────────────────────────────────────────────────────────────
  {
    id: 'knowledge.ingest',
    verb: 'ingest',
    title: '资料入库',
    description: '文档、网页、历史稿切分入向量库',
    domain: 'knowledge',
    inputSchema: inputSchema(['source'], {
      source: str('文件地址或文本'),
      title: str('资料标题，可空'),
    }),
    outputSchema: outputSchema({ documentId: str('资料 id'), chunks: { type: 'integer' } }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'knowledge.ingest:{documentHash}',
    sla: { p95Ms: 120000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/knowledge-rag.ts',
    audit: 'none',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/knowledge-base',
  },
  {
    id: 'knowledge.ask',
    verb: 'ask',
    title: '知识库问答',
    description: '只基于已入库资料回答，带引用',
    domain: 'knowledge',
    inputSchema: inputSchema(['question'], {
      question: str('问题'),
      topK: { type: 'integer', description: '召回条数' },
    }),
    outputSchema: outputSchema({
      answer: str('回答'),
      citations: strArray('引用片段 id'),
    }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'knowledge.ask:{conversationId}:{turnId}',
    sla: { p95Ms: 20000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/knowledge-rag.ts',
    audit: 'standard',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/knowledge-base',
  },
  {
    id: 'knowledge.card',
    verb: 'card',
    title: '知识卡提取',
    description: '从对话或文档抽知识卡，去重后入库',
    domain: 'knowledge',
    inputSchema: inputSchema(['source'], {
      source: str('对话 id 或文档 id'),
      count: { type: 'integer', description: '最多条数' },
    }),
    outputSchema: outputSchema({
      cards: { type: 'array', items: { type: 'object' }, description: '知识卡' },
    }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'knowledge.card:{sourceId}:{count}',
    sla: { p95Ms: 30000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/knowledge-card.ts',
    audit: 'standard',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/knowledge-base',
  },
  {
    id: 'knowledge.export',
    verb: 'export',
    title: '知识导出',
    description: '把知识库导出为 Markdown/JSON，供外部复用',
    domain: 'knowledge',
    inputSchema: inputSchema(['format'], {
      format: str('导出格式'),
      scope: str('范围，可空'),
    }),
    outputSchema: outputSchema({ url: str('导出文件地址') }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'knowledge.export:{scope}:{format}',
    sla: { p95Ms: 10000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/knowledge-rag.ts',
    audit: 'none',
    status: 'planned',
    surfaces: WEB,
    agentTool: null,
    uiHref: null,
  },

  // ── 教育 ──────────────────────────────────────────────────────────────
  {
    id: 'edu.lesson',
    verb: 'lesson',
    title: '课程与教案',
    description: '按学段与主题生成课程、教案与课件大纲',
    domain: 'education',
    inputSchema: inputSchema(['topic', 'grade'], {
      topic: str('主题'),
      grade: str('学段/年级'),
      durationMin: { type: 'integer', description: '课时长度' },
    }),
    outputSchema: outputSchema({ outline: str('教案'), slides: strArray('课件页') }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'edu.lesson:{topic}:{grade}:{durationMin}',
    sla: { p95Ms: 60000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/ai-education.ts',
    audit: 'standard',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/edu-ai',
  },
  {
    id: 'edu.practice',
    verb: 'practice',
    title: '练习与批改',
    description: '按知识点出题、收作答、给讲解',
    domain: 'education',
    inputSchema: inputSchema(['topic', 'count'], {
      topic: str('知识点'),
      count: { type: 'integer', description: '题量' },
      answers: strArray('作答，可空'),
    }),
    outputSchema: outputSchema({
      questions: { type: 'array', items: { type: 'object' } },
      score: { type: 'number' },
    }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'edu.practice:{topic}:{count}:{attemptId}',
    sla: { p95Ms: 30000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/education-platform.ts',
    audit: 'standard',
    status: 'ui-only',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/edu-ai',
  },
  {
    id: 'edu.report',
    verb: 'report',
    title: '学情报告',
    description: '按周汇总练习与错题，给家长看进步与薄弱点',
    domain: 'education',
    inputSchema: inputSchema(['studentId', 'from', 'to'], {
      studentId: str('学生 id'),
      from: str('开始日期'),
      to: str('结束日期'),
    }),
    outputSchema: outputSchema({ report: str('报告正文'), weakPoints: strArray('薄弱点') }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'edu.report:{studentId}:{from}:{to}',
    sla: { p95Ms: 60000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/ai-education.ts',
    audit: 'standard',
    status: 'planned',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/edu-ai',
  },
  {
    id: 'edu.parent',
    verb: 'progress',
    title: '家长进度',
    description: '家长端查看孩子本周学习与练习完成度',
    domain: 'education',
    inputSchema: inputSchema(['studentId'], { studentId: str('学生 id') }),
    outputSchema: outputSchema({
      progress: { type: 'number', description: '完成度 0-1' },
      next: str('下一步建议'),
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'none',
    sla: { p95Ms: 5000, note: SLA_NOTE },
    owner: 'apps/api/src/routes/ai-education.ts',
    audit: 'none',
    status: 'planned',
    surfaces: WEB,
    agentTool: null,
    uiHref: '/edu-ai',
  },

  // ── 工具（Agent 已可调用）───────────────────────────────────────────────
  {
    id: 'tool.doc.parse',
    verb: 'parse',
    title: '文档解析',
    description: '从 PDF/Word/图片提取正文、表格与结构',
    domain: 'tool',
    inputSchema: inputSchema(['fileUrl'], {
      fileUrl: str('文件地址'),
      format: str('格式提示，可空'),
    }),
    outputSchema: outputSchema({
      text: str('正文'),
      tables: { type: 'array', items: { type: 'object' }, description: '表格' },
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'tool.doc.parse:{fileHash}',
    sla: { p95Ms: 20000, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/document_tools.py',
    audit: 'none',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'parse_document',
    uiHref: '/tools',
  },
  {
    id: 'tool.chart.generate',
    verb: 'chart',
    title: '图表生成',
    description: '把表格数据生成可嵌入的图表',
    domain: 'tool',
    inputSchema: inputSchema(['data'], {
      data: str('CSV/Markdown 表格'),
      chartType: str('图表类型，可空'),
      title: str('标题，可空'),
    }),
    outputSchema: outputSchema({ html: str('图表 HTML'), imageUrl: str('图片地址，可空') }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'tool.chart.generate:{conversationId}:{turnId}',
    sla: { p95Ms: 15000, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/chart_tools.py',
    audit: 'none',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'generate_chart',
    uiHref: '/tools',
  },
  {
    id: 'tool.artifact.create',
    verb: 'artifact',
    title: '交付物生成',
    description: '生成 HTML 报告、幻灯片、表格、文档等交付物',
    domain: 'tool',
    inputSchema: inputSchema(['kind', 'title', 'content'], {
      kind: str('交付物类型'),
      title: str('标题'),
      content: str('正文'),
    }),
    outputSchema: outputSchema({ artifactId: str('交付物 id'), url: str('访问地址') }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'tool.artifact.create:{conversationId}:{turnId}:{kind}',
    sla: { p95Ms: 20000, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/artifact_tools.py',
    audit: 'none',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'create_artifact',
    uiHref: '/tools',
  },
  {
    id: 'tool.report.generate',
    verb: 'report',
    title: '报表生成',
    description: '按章节生成报表/汇报文档',
    domain: 'tool',
    inputSchema: inputSchema(['title'], {
      title: str('报表标题'),
      sections: strArray('章节标题'),
    }),
    outputSchema: outputSchema({ documentUrl: str('文档地址') }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'tool.report.generate:{conversationId}:{turnId}',
    sla: { p95Ms: 30000, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/report_tools.py',
    audit: 'none',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'generate_report',
    uiHref: '/tools',
  },
  {
    id: 'tool.automation.create',
    verb: 'automation',
    title: '自动化创建',
    description: '用一句话创建定时/触发式自动化任务',
    domain: 'tool',
    inputSchema: inputSchema(['brief'], {
      brief: str('要自动化的事'),
      schedule: str('触发规则，可空'),
    }),
    outputSchema: outputSchema({ automationId: str('任务 id'), status: str('状态') }),
    price: METERED,
    permissionScope: 'user',
    idempotencyKey: 'tool.automation.create:{conversationId}:{turnId}',
    sla: { p95Ms: 10000, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/automation_tools.py',
    audit: 'standard',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'create_automation',
    uiHref: '/tools',
  },
  {
    id: 'tool.web.fetch',
    verb: 'fetch',
    title: '网页读取',
    description: '抓网页正文、站点地图与批量抽取',
    domain: 'tool',
    inputSchema: inputSchema(['url'], {
      url: str('目标网址'),
      mode: str('readable/map/crawl，默认 readable'),
    }),
    outputSchema: outputSchema({
      markdown: str('正文'),
      links: strArray('链接，可空'),
    }),
    price: FREE,
    permissionScope: 'user',
    idempotencyKey: 'tool.web.fetch:{urlHash}',
    sla: { p95Ms: 15000, note: SLA_NOTE },
    owner: 'apps/ai-service/app/tools/web_crawl_tools.py',
    audit: 'none',
    status: 'agent-ready',
    surfaces: WEB_AGENT,
    agentTool: 'fetch_readable',
    uiHref: '/tools',
  },
]

export const CAPABILITY_COUNT = CAPABILITY_CATALOG.length

export const AGENT_READY_CAPABILITIES: readonly Capability[] = CAPABILITY_CATALOG.filter(
  (capability) => capability.status === 'agent-ready',
)

const BY_ID = new Map(CAPABILITY_CATALOG.map((capability) => [capability.id, capability]))

export function getCapability(id: string): Capability | undefined {
  return BY_ID.get(id)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
