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
 * 超时 10s,失败降级返回空数组 + warning header(由调用方处理)。
 */

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || 'http://localhost:8000'
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

/** 冲突类型 */
export type RuleConflictType =
  | 'name_conflict'
  | 'semantic_duplicate'
  | 'priority_collision'

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
    pattern:
      '^(feat|fix|docs|style|refactor|test|chore|perf|build|ci)(\\(.+\\))?: .{1,100}$',
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

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || AI_SERVICE_URL).replace(/\/$/, '')
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}/api/rules${path}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const resp = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
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
      console.warn('[rules-service] listRules 降级返回空:', (e as Error).message)
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

  async updateRule(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<RuleDto | null> {
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
      await this.request<{ id: string; deleted: boolean }>(
        `/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      )
      return true
    } catch {
      return false
    }
  }

  async testRule(
    id: string,
    message: string,
  ): Promise<RuleTestResultDto> {
    return this.request<RuleTestResultDto>(
      `/${encodeURIComponent(id)}/test`,
      { method: 'POST', body: JSON.stringify({ message }) },
    )
  }

  async matchRules(
    message: string,
    scope?: string,
  ): Promise<RuleMatchResultDto> {
    try {
      return await this.request<RuleMatchResultDto>('/match', {
        method: 'POST',
        body: JSON.stringify({ message, scope }),
      })
    } catch (e) {
      console.warn('[rules-service] matchRules 降级返回空:', (e as Error).message)
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
      console.warn(
        '[rules-service] detectConflicts 降级为本地计算:',
        (e as Error).message,
      )
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
      console.warn(
        '[rules-service] listTemplates 降级为本地静态模板:',
        (e as Error).message,
      )
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
      console.warn(
        '[rules-service] getAuditLog 降级返回空:',
        (e as Error).message,
      )
      return { entries: [], total: 0 }
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
    const semanticRules = rules.filter(
      (r) => r.matchType === 'semantic' && r.matchPattern,
    )
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
}

export const rulesService = new RulesService()
