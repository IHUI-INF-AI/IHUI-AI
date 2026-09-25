// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Rules 服务 — 调用 ai-service 的 HTTP client。
 *
 * 端点对应 ai-service 的 /api/rules/*:
 *  - GET    /rules          → listRules
 *  - POST   /rules          → createRule
 *  - GET    /rules/:id      → getRule
 *  - PATCH  /rules/:id      → updateRule
 *  - DELETE /rules/:id      → deleteRule
 *  - POST   /rules/:id/test → testRule
 *  - POST   /rules/match    → matchRules
 *  - GET    /rules/conflicts  → detectConflicts(转发,失败本地降级)
 *  - GET    /rules/templates  → listTemplates(转发,失败本地静态降级)
 *  - GET    /rules/audit-log  → getAuditLog(转发,失败空降级)
 *
 * 深化端点(2026-07-22,自研 Rules 专业级):
 *  - GET    /rules/resolved       → getResolvedRules(scope 继承链合并)
 *  - GET    /rules/:id/history    → getRuleHistory(版本历史)
 *  - POST   /rules/:id/rollback   → rollbackRule(回滚到指定版本)
 *  - GET    /rules/:id/diff       → diffRuleVersions(unified diff)
 *  - POST   /rules/:id/feedback   → recordFeedback(用户反馈)
 *  - GET    /rules/:id/stats      → getRuleStats(效果统计)
 *  - POST   /rules/ab-test        → abTestRules(A/B 测试)
 *  - GET    /rules/stats          → getGlobalStats(全局统计)
 *
 * 超越创新端点(2026-07-23,行为学习 + LLM 模式提取 + 冲突协商 + 效果预测 + 知识图谱):
 *  - POST   /rules/auto-generate          → autoGenerateRules(行为模式→规则草稿)
 *  - POST   /rules/resolve-conflicts      → resolveConflicts(LLM 仲裁冲突)
 *  - POST   /rules/:id/predict-effect     → predictRuleEffect(效果预测)
 *  - GET    /rules/knowledge-graph        → getRulesKnowledgeGraph(规则知识图谱)
 *  - POST   /rules/:id/learn-feedback     → recordLearnFeedback(学习反馈)
 *
 * 超时 10s,失败降级返回空数组 + warning header(由调用方处理)。
 */

import { logger } from '../utils/logger.js'

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8803'
const TIMEOUT_MS = 10_000

export interface RuleDto {
  id: string
  name: string
  description?: string
  content: string
  scope: 'global' | 'workspace' | 'agent'
  agentId?: string
  priority: number
  enabled: boolean
  matchType: 'always' | 'keyword' | 'regex' | 'semantic'
  matchPattern?: string
  createdAt: string
  updatedAt: string
  /** 命中次数(持久化到 frontmatter,2026-07-22 深化) */
  matchCount?: number
  /** 最后命中时间 ISO(持久化到 frontmatter) */
  lastMatchedAt?: string
  /** 继承来源 scope(scope 继承链合并时标记) */
  inheritedFrom?: string
}

export interface RuleListDto {
  rules: RuleDto[]
  total: number
}

export interface RuleTestResultDto {
  matched: boolean
  reason: string
}

export interface RuleMatchResultDto {
  appliedRules: RuleDto[]
  promptSuffix: string
}

// ── 版本控制 DTO(2026-07-22 深化)──────────────────────────

/** 版本历史条目 */
export interface RuleHistoryEntryDto {
  /** 版本 timestamp(文件名前缀,ISO 格式) */
  timestamp: string
  /** 变更动作:create / update / delete / rollback */
  action: string
  /** 该版本的完整规则内容(markdown,含 frontmatter) */
  content: string
}

export interface RuleHistoryDto {
  history: RuleHistoryEntryDto[]
}

export interface RuleDiffDto {
  diff: string
}

// ── 效果评估 DTO(2026-07-22 深化)──────────────────────────

export type RuleFeedbackType = 'thumbs_up' | 'thumbs_down'

export interface RuleFeedbackResultDto {
  success: boolean
}

export interface RuleStatsDto {
  ruleId: string
  /** 过去 7 天命中次数 */
  hits7d: number
  /** 过去 30 天命中次数 */
  hits30d: number
  /** 平均 token 增量 */
  avgTokenDelta: number
  /** 反馈总数 */
  totalFeedback: number
  /** 正面反馈数 */
  positiveFeedback: number
  /** 满意度(正面反馈率,0-100) */
  satisfactionRate: number
  /** 累计命中次数 */
  matchCount: number
}

export interface RuleAbTestResultDto {
  ruleA: {
    id: string
    name: string
    matched: boolean
    output: string
  }
  ruleB: {
    id: string
    name: string
    matched: boolean
    output: string
  }
  message: string
  /** ai-service 不支持时为空 */
  error?: string
}

// ── 触发统计 DTO(2026-07-22 深化)──────────────────────────

export interface RuleGlobalStatsDto {
  totalRules: number
  activeRules7d: number
  topRules: Array<{
    id: string
    name: string
    matchCount: number
  }>
}

// ── Scope 继承链 DTO(2026-07-22 深化)──────────────────────

export interface ResolvedRulesDto {
  rules: RuleDto[]
  total: number
}

/** 冲突类型 */
export type RuleConflictType = 'name_conflict' | 'semantic_duplicate' | 'priority_collision'

export interface RuleConflictDto {
  type: RuleConflictType
  ruleIds: string[]
  detail: string
}

export interface RuleConflictsDto {
  conflicts: RuleConflictDto[]
}

/** 规则模板(预置 5 个,与 ai-service rules_engine.py RULE_TEMPLATES 同步) */
export interface RuleTemplateDto {
  name: string
  description: string
  matchType: 'always' | 'keyword' | 'regex' | 'semantic'
  pattern: string
  priority: number
  scope: 'global' | 'workspace' | 'agent'
  content: string
}

export interface RuleTemplatesDto {
  templates: RuleTemplateDto[]
}

/** 审计日志条目 */
export interface RuleAuditLogEntryDto {
  action: 'create' | 'update' | 'delete' | 'test'
  ruleId: string
  ruleName: string
  timestamp: string
  user: string
}

export interface RuleAuditLogDto {
  entries: RuleAuditLogEntryDto[]
  total: number
}

// ── 超越创新 DTO(行为学习 + LLM 模式提取 + 冲突协商 + 效果预测 + 知识图谱)──

/**
 * ai-service `POST /rules/auto-generate` 的**上游原始形状**(引擎逐条草稿)。
 * 注意 `draft_rule` 是下划线形态 —— 旧的 `RuleDraftDto.draftRule` 声明与生产者从来不一致,
 * 而 TS 对 `this.request<T>()` 的返回值不做任何运行时校验,所以这个错配从未暴露。
 */
interface RawAutoGenerateDraft {
  pattern?: unknown
  confidence?: unknown
  draft_rule?: {
    name?: unknown
    description?: unknown
    content?: unknown
    scope?: unknown
    matchType?: unknown
  }
}

/** 自动生成的规则候选(摊平一层,字段名与本端消费者一致) */
export interface RuleCandidateDto {
  /** 行为模式描述 */
  pattern: string
  /** 置信度 0-1 */
  confidence: number
  name: string
  description: string
  content: string
  matchType: 'always' | 'keyword' | 'regex' | 'semantic'
  scope: 'global' | 'workspace' | 'agent'
}

export interface AutoGenerateRulesDto {
  candidates: RuleCandidateDto[]
  /** ai-service 不可用时为 true */
  degraded?: boolean
}

const RULE_SCOPES = ['global', 'workspace', 'agent'] as const
const RULE_MATCH_TYPES = ['always', 'keyword', 'regex', 'semantic'] as const

/** 上游是外部服务:字面量档位对不上就落到与生产者(`RuleCreateBody`)同一档默认值,不猜第三档。 */
function oneOf<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

/**
 * 上游 → 本端候选的**唯一**映射出口。上游是外部服务,字段缺失/类型漂移都不能抛错把
 * 整页打死,但也不得静默造出一个假候选(缺 name 或 content 即整条丢弃)。
 */
function toRuleCandidate(raw: RawAutoGenerateDraft): RuleCandidateDto | null {
  const d = raw?.draft_rule
  const name = typeof d?.name === 'string' ? d.name : ''
  const content = typeof d?.content === 'string' ? d.content : ''
  if (!name || !content) return null
  return {
    pattern: typeof raw?.pattern === 'string' ? raw.pattern : '',
    confidence: typeof raw?.confidence === 'number' ? raw.confidence : 0,
    name,
    description: typeof d?.description === 'string' ? d.description : '',
    content,
    // 引擎的草稿是"整段提示约束",不带匹配器;ai-service 自身建规端点
    // (`RuleCreateBody.matchType`)的默认档同为 "always",此处与生产者默认一致。
    matchType: oneOf(RULE_MATCH_TYPES, d?.matchType, 'always'),
    scope: oneOf(RULE_SCOPES, d?.scope, 'global'),
  }
}

/** 冲突解决方案类型 */
export type RuleConflictResolution = 'merge' | 'disable' | 'priority_adjust'

export interface RuleConflictResolutionDto {
  /** 冲突索引(对应输入 conflicts 数组下标) */
  conflictId: number
  resolution: RuleConflictResolution
  reason: string
  /** 具体动作描述(如 "keep:rule-a;disable:rule-b") */
  action: string
}

export interface ResolveConflictsDto {
  resolutions: RuleConflictResolutionDto[]
  degraded?: boolean
}

/** 规则效果预测建议类型 */
export type RuleEffectRecommendation = 'apply' | 'review' | 'reject'

export interface RulePredictEffectDto {
  ruleId: string
  predictedMatchRate: number
  falsePositiveRisk: number
  recommendation: RuleEffectRecommendation
  /** ai-service 不可用时为 true(基于历史统计降级) */
  degraded: boolean
}

/** 知识图谱边类型 */
export type RuleGraphEdgeType = 'duplicate' | 'complementary' | 'conflict'

export interface RuleKnowledgeGraphNodeDto {
  id: string
  name: string
  scope: 'global' | 'workspace' | 'agent'
  pattern: string
}

export interface RuleKnowledgeGraphEdgeDto {
  source: string
  target: string
  type: RuleGraphEdgeType
  similarity: number
}

export interface RuleKnowledgeGraphDto {
  nodes: RuleKnowledgeGraphNodeDto[]
  edges: RuleKnowledgeGraphEdgeDto[]
  /** embedding 不可用时为 true(只返回节点,无边) */
  degraded?: boolean
}

/** 学习反馈结果 */
export interface RuleLearnFeedbackResultDto {
  success: boolean
}

interface AiServiceResponse<T> {
  code: number
  message: string
  data: T
}

/**
 * 预置规则模板(与 ai-service rules_engine.py RULE_TEMPLATES 保持一致)。
 *
 * 当 ai-service /api/rules/templates 端点不可用时,本静态列表作为降级返回。
 * 5 个模板:code_review / security_check / commit_convention / i18n_reminder / test_coverage。
 */
const RULE_TEMPLATES_FALLBACK: RuleTemplateDto[] = [
  {
    name: 'code_review',
    description: '代码审查规则 — 触发代码审查场景时注入审查要点',
    matchType: 'keyword',
    pattern: 'review,审查,代码审查',
    priority: 100,
    scope: 'global',
    content:
      '在进行代码审查时,请关注:\n1. 函数复杂度与可读性\n2. 潜在的安全漏洞\n3. 测试覆盖是否充分\n4. 命名规范与一致性\n5. 错误处理是否完善',
  },
  {
    name: 'security_check',
    description: '安全检查规则 — 涉及敏感信息时注入安全约束',
    matchType: 'keyword',
    pattern: 'password,token,secret,密码,密钥',
    priority: 200,
    scope: 'global',
    content:
      '处理敏感信息时必须:\n1. 禁止将密钥/密码硬编码到代码中\n2. 使用环境变量或密钥管理服务\n3. 日志中不得打印敏感字段\n4. 传输层必须使用 HTTPS/TLS\n5. 存储层必须使用加密',
  },
  {
    name: 'commit_convention',
    description: '提交规范规则 — 校验 commit message 格式',
    matchType: 'regex',
    pattern: '^(feat|fix|docs|style|refactor|test|chore|perf|build|ci)(\\(.+\\))?: .{1,100}$',
    priority: 50,
    scope: 'global',
    content:
      '提交信息必须遵循 Conventional Commits 规范:\n- 类型前缀:feat/fix/docs/style/refactor/test/chore/perf/build/ci\n- 可选作用域:(<scope>)\n- 冒号 + 空格分隔\n- 简短描述(≤100 字符)',
  },
  {
    name: 'i18n_reminder',
    description: '国际化提醒规则 — 涉及多语言时注入 i18n 约束',
    matchType: 'keyword',
    pattern: '中文,i18n,国际化,多语言',
    priority: 80,
    scope: 'global',
    content:
      '国际化要求:\n1. 用户可见文案必须走 i18n 资源文件\n2. 禁止硬编码中文字符串到代码\n3. 新增 key 必须同步更新所有 locale 文件\n4. 翻译遵循品牌词典(品牌名优先英文名)',
  },
  {
    name: 'test_coverage',
    description: '测试覆盖规则 — 涉及测试时注入覆盖要求',
    matchType: 'keyword',
    pattern: 'test,测试,单元测试,集成测试',
    priority: 90,
    scope: 'global',
    content:
      '测试要求:\n1. 新增功能必须配套单元测试\n2. 关键路径必须有集成测试\n3. 测试覆盖率不低于 80%\n4. 测试必须可独立运行,不依赖外部服务\n5. mock 必须明确标注,禁止 mock 真实生产逻辑',
  },
]

class RulesService {
  private baseUrl: string
  /**
   * 调用方令牌。`/api/rules` **不在** ai-service 的 `PUBLIC_PATHS`
   * (`apps/ai-service/app/core/config.py` 的 `jwt_public_paths`),而它的中间件对
   * 无 `Bearer` 的请求直接 401(`app/core/jwt_auth.py`)—— 本类此前**所有**方法都不带这个头,
   * 于是每条调用都落进各自的 `catch` 静默降级(listRules 返 `{rules:[],total:0}`),
   * 现象是"页面能打开、零报错、数据永远空"。故令牌按请求绑定,不再有"全局单例裸调"这条路。
   */
  private readonly authHeader?: string

  constructor(baseUrl?: string, authHeader?: string) {
    this.baseUrl = (baseUrl || AI_SERVICE_URL).replace(/\/$/, '')
    this.authHeader = authHeader
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/rules${path}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const resp = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(this.authHeader ? { Authorization: this.authHeader } : {}),
          ...options.headers,
        },
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        throw new Error(`ai-service HTTP ${resp.status}: ${text.slice(0, 200)}`)
      }
      const body = (await resp.json()) as AiServiceResponse<T>
      if (body.code !== 0) {
        throw new Error(body.message || 'ai-service 返回错误')
      }
      return body.data
    } finally {
      clearTimeout(timer)
    }
  }

  async listRules(): Promise<RuleListDto> {
    try {
      return await this.request<RuleListDto>('')
    } catch (e) {
      logger.warn('[rules-service] listRules 降级返回空:', { err: e as Error })
      return { rules: [], total: 0 }
    }
  }

  async createRule(input: Record<string, unknown>): Promise<RuleDto> {
    return this.request<RuleDto>('', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async getRule(id: string): Promise<RuleDto | null> {
    try {
      return await this.request<RuleDto>(`/${encodeURIComponent(id)}`)
    } catch {
      return null
    }
  }

  async updateRule(id: string, patch: Record<string, unknown>): Promise<RuleDto | null> {
    try {
      return await this.request<RuleDto>(`/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
    } catch {
      return null
    }
  }

  async deleteRule(id: string): Promise<boolean> {
    try {
      await this.request<{ id: string; deleted: boolean }>(`/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      return true
    } catch {
      return false
    }
  }

  async testRule(id: string, message: string): Promise<RuleTestResultDto> {
    return this.request<RuleTestResultDto>(`/${encodeURIComponent(id)}/test`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  }

  async matchRules(message: string, scope?: string): Promise<RuleMatchResultDto> {
    try {
      return await this.request<RuleMatchResultDto>('/match', {
        method: 'POST',
        body: JSON.stringify({ message, scope }),
      })
    } catch (e) {
      logger.warn('[rules-service] matchRules 降级返回空:', { err: e as Error })
      return { appliedRules: [], promptSuffix: '' }
    }
  }

  /**
   * 检测规则冲突 — 转发到 ai-service /api/rules/conflicts。
   *
   * 失败(404/超时/ai-service 不可用)时降级为本地计算:
   *  - name_conflict:同名不同 ID
   *  - semantic_duplicate:本地降级为 matchPattern 完全相同
   *  - priority_collision:同 scope + 相同 priority
   */
  async detectConflicts(): Promise<RuleConflictsDto> {
    try {
      return await this.request<RuleConflictsDto>('/conflicts')
    } catch (e) {
      logger.warn('[rules-service] detectConflicts 降级为本地计算:', { err: e as Error })
      return this._detectConflictsLocal()
    }
  }

  /**
   * 列出预置规则模板 — 转发到 ai-service /api/rules/templates。
   *
   * 失败时降级为本地静态模板列表(RULE_TEMPLATES_FALLBACK)。
   */
  async listTemplates(): Promise<RuleTemplatesDto> {
    try {
      return await this.request<RuleTemplatesDto>('/templates')
    } catch (e) {
      logger.warn('[rules-service] listTemplates 降级为本地静态模板:', { err: e as Error })
      return { templates: RULE_TEMPLATES_FALLBACK }
    }
  }

  /**
   * 获取审计日志 — 转发到 ai-service /api/rules/audit-log。
   *
   * 审计日志只存在于 ai-service 内存,失败时降级为空。
   */
  async getAuditLog(): Promise<RuleAuditLogDto> {
    try {
      return await this.request<RuleAuditLogDto>('/audit-log')
    } catch (e) {
      logger.warn('[rules-service] getAuditLog 降级返回空:', { err: e as Error })
      return { entries: [], total: 0 }
    }
  }

  // ── 深化方法(2026-07-22,转发到 ai-service,失败降级)──────

  /**
   * 获取 scope 继承链合并后的最终生效规则集。
   *
   * 转发到 ai-service GET /api/rules/resolved?scope=xxx&agentId=xxx。
   * 失败时降级为本地 listRules 结果(无 inheritedFrom 标记)。
   */
  async getResolvedRules(scope: string, agentId?: string): Promise<ResolvedRulesDto> {
    try {
      const qs = new URLSearchParams({ scope })
      if (agentId) qs.set('agentId', agentId)
      return await this.request<ResolvedRulesDto>(`/resolved?${qs.toString()}`)
    } catch (e) {
      logger.warn('[rules-service] getResolvedRules 降级为 listRules:', { err: e as Error })
      const list = await this.listRules()
      const filtered = list.rules.filter(
        (r) => r.scope === scope || (scope === 'agent' && r.scope !== 'global'),
      )
      return { rules: filtered, total: filtered.length }
    }
  }

  /**
   * 获取规则版本历史列表。
   *
   * 转发到 ai-service GET /api/rules/:id/history。
   * 失败时降级为空列表(版本历史不存在时不阻塞 UI)。
   */
  async getRuleHistory(id: string): Promise<RuleHistoryDto> {
    try {
      return await this.request<RuleHistoryDto>(`/${encodeURIComponent(id)}/history`)
    } catch (e) {
      logger.warn('[rules-service] getRuleHistory 降级返回空:', { err: e as Error })
      return { history: [] }
    }
  }

  /**
   * 回滚规则到指定版本。
   *
   * 转发到 ai-service POST /api/rules/:id/rollback?version=xxx。
   * 失败时返回 null(由调用方返回 502 或 404)。
   */
  async rollbackRule(id: string, version: string): Promise<RuleDto | null> {
    try {
      const qs = new URLSearchParams({ version })
      return await this.request<RuleDto>(`/${encodeURIComponent(id)}/rollback?${qs.toString()}`, {
        method: 'POST',
      })
    } catch (e) {
      logger.warn('[rules-service] rollbackRule 失败:', { err: e as Error })
      return null
    }
  }

  /**
   * 对比两个版本之间的差异(unified diff)。
   *
   * 转发到 ai-service GET /api/rules/:id/diff?from=xxx&to=xxx。
   * 失败时降级为空字符串。
   */
  async diffRuleVersions(id: string, from: string, to: string): Promise<RuleDiffDto> {
    try {
      const qs = new URLSearchParams({ from, to })
      return await this.request<RuleDiffDto>(`/${encodeURIComponent(id)}/diff?${qs.toString()}`)
    } catch (e) {
      logger.warn('[rules-service] diffRuleVersions 降级返回空:', { err: e as Error })
      return { diff: '' }
    }
  }

  /**
   * 记录用户对规则效果的反馈(thumbs_up / thumbs_down)。
   *
   * 转发到 ai-service POST /api/rules/:id/feedback。
   * 失败时返回 { success: false }。
   */
  async recordFeedback(id: string, feedback: RuleFeedbackType): Promise<RuleFeedbackResultDto> {
    try {
      return await this.request<RuleFeedbackResultDto>(`/${encodeURIComponent(id)}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback }),
      })
    } catch (e) {
      logger.warn('[rules-service] recordFeedback 失败:', { err: e as Error })
      return { success: false }
    }
  }

  /**
   * 获取规则效果统计(命中率 / token 增量 / 满意度)。
   *
   * 转发到 ai-service GET /api/rules/:id/stats。
   * 失败时降级为零值统计。
   */
  async getRuleStats(id: string): Promise<RuleStatsDto> {
    try {
      return await this.request<RuleStatsDto>(`/${encodeURIComponent(id)}/stats`)
    } catch (e) {
      logger.warn('[rules-service] getRuleStats 降级返回零值:', { err: e as Error })
      return {
        ruleId: id,
        hits7d: 0,
        hits30d: 0,
        avgTokenDelta: 0,
        totalFeedback: 0,
        positiveFeedback: 0,
        satisfactionRate: 0,
        matchCount: 0,
      }
    }
  }

  /**
   * A/B 测试:两条规则对同一输入分别应用,返回两份输出供对比。
   *
   * 转发到 ai-service POST /api/rules/ab-test。
   * 失败时降级为本地简化实现(仅基于 matchType 做基本匹配)。
   */
  async abTestRules(
    ruleIdA: string,
    ruleIdB: string,
    message: string,
  ): Promise<RuleAbTestResultDto> {
    try {
      return await this.request<RuleAbTestResultDto>('/ab-test', {
        method: 'POST',
        body: JSON.stringify({
          ruleIdA,
          ruleIdB,
          message,
        }),
      })
    } catch (e) {
      logger.warn('[rules-service] abTestRules 降级为本地实现:', { err: e as Error })
      return this._abTestLocal(ruleIdA, ruleIdB, message)
    }
  }

  /**
   * 获取全局规则统计(总规则数 / 活跃规则数 / top 10)。
   *
   * 转发到 ai-service GET /api/rules/stats。
   * 失败时降级为本地计算(基于 listRules 的 matchCount 字段)。
   */
  async getGlobalStats(): Promise<RuleGlobalStatsDto> {
    try {
      return await this.request<RuleGlobalStatsDto>('/stats')
    } catch (e) {
      logger.warn('[rules-service] getGlobalStats 降级为本地计算:', { err: e as Error })
      return this._getGlobalStatsLocal()
    }
  }

  /**
   * 本地 A/B 测试降级实现(不依赖 ai-service)。
   *
   * 基于本地规则数据做基本匹配判断,不计算 token 增量。
   */
  private async _abTestLocal(
    ruleIdA: string,
    ruleIdB: string,
    message: string,
  ): Promise<RuleAbTestResultDto> {
    const { rules } = await this.listRules()
    const ruleA = rules.find((r) => r.id === ruleIdA)
    const ruleB = rules.find((r) => r.id === ruleIdB)
    const matchedA = ruleA ? this._matchSingleLocal(ruleA, message) : false
    const matchedB = ruleB ? this._matchSingleLocal(ruleB, message) : false
    return {
      ruleA: {
        id: ruleIdA,
        name: ruleA?.name ?? ruleIdA,
        matched: matchedA,
        output: matchedA && ruleA ? `## ${ruleA.name}\n${ruleA.content}` : '',
      },
      ruleB: {
        id: ruleIdB,
        name: ruleB?.name ?? ruleIdB,
        matched: matchedB,
        output: matchedB && ruleB ? `## ${ruleB.name}\n${ruleB.content}` : '',
      },
      message,
    }
  }

  /**
   * 本地规则匹配降级(仅 keyword / regex / always,不含 semantic)。
   */
  private _matchSingleLocal(rule: RuleDto, message: string): boolean {
    if (!rule.enabled) return false
    switch (rule.matchType) {
      case 'always':
        return true
      case 'keyword': {
        if (!rule.matchPattern) return false
        return rule.matchPattern.split(',').some((kw) => kw.trim() && message.includes(kw.trim()))
      }
      case 'regex': {
        if (!rule.matchPattern) return false
        try {
          return new RegExp(rule.matchPattern).test(message)
        } catch {
          return false
        }
      }
      default:
        return false
    }
  }

  /**
   * 本地全局统计降级(基于 listRules 的 matchCount 字段)。
   */
  private async _getGlobalStatsLocal(): Promise<RuleGlobalStatsDto> {
    const { rules } = await this.listRules()
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const active7d = rules.filter(
      (r) => r.lastMatchedAt && new Date(r.lastMatchedAt).getTime() >= sevenDaysAgo,
    ).length
    const top = [...rules]
      .sort((a, b) => (b.matchCount ?? 0) - (a.matchCount ?? 0))
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        name: r.name,
        matchCount: r.matchCount ?? 0,
      }))
    return {
      totalRules: rules.length,
      activeRules7d: active7d,
      topRules: top,
    }
  }

  /**
   * 本地冲突检测降级实现(不依赖 ai-service embedding)。
   *
   * 语义冲突检测在本地降级为:两条 semantic 规则 matchPattern 完全相同
   * (避免在没有 embedding 能力时漏检明显的重复)。
   */
  private async _detectConflictsLocal(): Promise<RuleConflictsDto> {
    const { rules } = await this.listRules()
    const conflicts: RuleConflictDto[] = []

    // a) 同名冲突
    const byName = new Map<string, RuleDto[]>()
    for (const r of rules) {
      const arr = byName.get(r.name) ?? []
      arr.push(r)
      byName.set(r.name, arr)
    }
    for (const [name, group] of byName) {
      if (group.length > 1) {
        conflicts.push({
          type: 'name_conflict',
          ruleIds: group.map((r) => r.id),
          detail: `存在 ${group.length} 条名为「${name}」的规则`,
        })
      }
    }

    // b) 语义重复(本地降级:matchPattern 完全相同)
    const semanticRules = rules.filter((r) => r.matchType === 'semantic' && r.matchPattern)
    for (let i = 0; i < semanticRules.length; i++) {
      for (let j = i + 1; j < semanticRules.length; j++) {
        const r1 = semanticRules[i]
        const r2 = semanticRules[j]
        if (!r1 || !r2) continue
        if (r1.id === r2.id) continue
        if (r1.matchPattern === r2.matchPattern) {
          conflicts.push({
            type: 'semantic_duplicate',
            ruleIds: [r1.id, r2.id],
            detail: `语义规则 matchPattern 完全相同(规则「${r1.name}」与「${r2.name}」)`,
          })
        }
      }
    }

    // c) 优先级碰撞(同 scope + 相同 priority)
    const byScopePriority = new Map<string, RuleDto[]>()
    for (const r of rules) {
      const key = `${r.scope}::${r.priority}`
      const arr = byScopePriority.get(key) ?? []
      arr.push(r)
      byScopePriority.set(key, arr)
    }
    for (const [key, group] of byScopePriority) {
      if (group.length > 1) {
        const [scope, priority] = key.split('::')
        conflicts.push({
          type: 'priority_collision',
          ruleIds: group.map((r) => r.id),
          detail: `作用域 ${scope} 下有 ${group.length} 条规则使用相同优先级 ${priority}`,
        })
      }
    }

    return { conflicts }
  }

  // ── 超越创新方法(2026-07-23,行为学习 + LLM 模式提取 + 冲突协商 + 效果预测 + 知识图谱)──

  /**
   * 基于用户行为模式自动生成规则草稿(不自动创建,返回草稿供用户确认)。
   *
   * 转发到 ai-service POST /api/rules/auto-generate。
   * 失败时降级返回空草稿列表(degraded=true)。
   */
  async autoGenerateRules(): Promise<AutoGenerateRulesDto> {
    try {
      const raw = await this.request<unknown>('/auto-generate', {
        method: 'POST',
        // 身份不进请求体:上游端点已改为只认令牌主体(`require_request_user_id`),
        // 旧的 `{ userId }` 驼峰键从来没过校验(上游要的是 user_id)。
        body: JSON.stringify({}),
      })
      const list = Array.isArray(raw) ? (raw as RawAutoGenerateDraft[]) : []
      const candidates = list.map(toRuleCandidate).filter((c): c is RuleCandidateDto => c !== null)
      return { candidates }
    } catch (e) {
      logger.warn('[rules-service] autoGenerateRules 降级返回空:', { err: e as Error })
      return { candidates: [], degraded: true }
    }
  }

  /**
   * LLM 自动协商冲突解决方案(merge / disable / priority_adjust)。
   *
   * 转发到 ai-service POST /api/rules/resolve-conflicts。
   * 失败时降级返回空解决方案列表(degraded=true)。
   */
  async resolveConflicts(conflicts: RuleConflictDto[]): Promise<ResolveConflictsDto> {
    try {
      return await this.request<ResolveConflictsDto>('/resolve-conflicts', {
        method: 'POST',
        body: JSON.stringify({ conflicts }),
      })
    } catch (e) {
      logger.warn('[rules-service] resolveConflicts 降级返回空:', { err: e as Error })
      return { resolutions: [], degraded: true }
    }
  }

  /**
   * 预测规则应用效果(命中率 / 误报风险 / 建议)。
   *
   * 转发到 ai-service POST /api/rules/:id/predict-effect。
   * 失败时降级返回零值预测(degraded=true)。
   */
  async predictRuleEffect(id: string, dryRunMessage?: string): Promise<RulePredictEffectDto> {
    try {
      return await this.request<RulePredictEffectDto>(`/${encodeURIComponent(id)}/predict-effect`, {
        method: 'POST',
        body: JSON.stringify({ dryRunMessage: dryRunMessage ?? '' }),
      })
    } catch (e) {
      logger.warn('[rules-service] predictRuleEffect 降级返回零值:', { err: e as Error })
      return {
        ruleId: id,
        predictedMatchRate: 0,
        falsePositiveRisk: 0,
        recommendation: 'review',
        degraded: true,
      }
    }
  }

  /**
   * 获取规则知识图谱(基于 embedding 相似度的 duplicate/complementary/conflict 边)。
   *
   * 转发到 ai-service GET /api/rules/knowledge-graph?scope=xxx。
   * 失败时降级为空图谱(degraded=true)。
   */
  async getRulesKnowledgeGraph(scope?: string): Promise<RuleKnowledgeGraphDto> {
    try {
      const qs = new URLSearchParams()
      if (scope) qs.set('scope', scope)
      const query = qs.toString()
      const path = query ? `/knowledge-graph?${query}` : '/knowledge-graph'
      return await this.request<RuleKnowledgeGraphDto>(path)
    } catch (e) {
      logger.warn('[rules-service] getRulesKnowledgeGraph 降级返回空:', { err: e as Error })
      return { nodes: [], edges: [], degraded: true }
    }
  }

  /**
   * 记录用户对自动生成规则的反馈(accepted=true 采纳 / false 拒绝)。
   *
   * 转发到 ai-service POST /api/rules/:id/learn-feedback。
   * 失败时返回 { success: false }。
   */
  async recordLearnFeedback(
    id: string,
    feedback: string,
    accepted: boolean,
  ): Promise<RuleLearnFeedbackResultDto> {
    try {
      return await this.request<RuleLearnFeedbackResultDto>(
        `/${encodeURIComponent(id)}/learn-feedback`,
        {
          method: 'POST',
          body: JSON.stringify({ feedback, accepted }),
        },
      )
    } catch (e) {
      logger.warn('[rules-service] recordLearnFeedback 失败:', { err: e as Error })
      return { success: false }
    }
  }
}

/**
 * 按**当次请求**取一个绑好令牌的 Rules 服务实例。
 *
 * 刻意不再导出「裸单例」:没有令牌的实例在本端结构上就不该可能出现 ——
 * 此前 `export const rulesService = new RulesService()` 谁都能调,而 22 个调用点
 * 全都忘了带身份,于是 ai-service 侧那一路端点统一 401 并被各自的 catch 静默降级。
 * 现在由类型层就地拦死(路由必须交出自己的令牌)。
 */
export function rulesServiceFor(authHeader?: string): RulesService {
  return new RulesService(undefined, authHeader)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
