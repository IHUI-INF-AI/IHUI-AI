// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O6 能力开放登记表 —— 「哪条 `/api/*` 路由(方法 + 路径)可对第三方机器凭据开放、
 * 开放到哪个已登记能力」的**唯一事实源**。
 *
 * 与 `packages/types/src/capability-catalog.ts` 的分工:
 * - 能力目录回答「这个 scope 是什么、能不能对机器开放」(全局契约,跨端消费);
 * - 本表回答「`/api` 面上具体哪个 URL 允许机器凭据进来」(逐条开放开关)。
 * 目录说"能开放" ≠ 已开放;**只有写进本表的路由才接受 API Key**,其余 `/api` 路由
 * 即使携带合法 key 也照旧被端点自身的 `authenticate()` 判 401(默认拒绝)。
 *
 * 三道判定,任一不过即启动期抛错(把漂移挡在进程起来之前,而不是运行到该端点才发现):
 * 1. 编译期 —— `OpenableCapabilityScope` 是字面量联合,填 `publish:operate` 之类直接 tsc 报错;
 * 2. 目录存在性 —— `requireCapabilityOrThrow` 拦未登记 scope;
 * 3. 语义 —— `dataClass=platform` / `thirdPartyEligible=false` / `isM2MAllowed=false` 一律拒登记。
 */
import {
  effectiveDataClass,
  getCapability,
  isM2MAllowed,
  requireCapabilityOrThrow,
  type ApiKeyPermission,
  type CapabilityDataClass,
  type CapabilityEntry,
} from '@ihui/types'
// 仅取类型(编译期擦除),不构成 config → utils 的运行时依赖。
import type { CapabilityRule } from '../utils/capability-guard.js'

/**
 * 可对第三方机器凭据开放的能力闭包。
 *
 * 取值必须是 `capability-catalog.ts` 里 `thirdPartyEligible=true` 且
 * `dataClass != platform` 的 scope —— 这个约束由 `buildRegistry()` 在模块加载期
 * 逐条运行期复核(见 `assertScopeOpenable`),本联合只是第一道编译期护栏。
 * 新增条目请先确认目录里该 scope 的 `thirdPartyEligible` 与 `dataClass`。
 */
export type OpenableCapabilityScope =
  | 'tools:read'
  | 'user:read'
  | 'messages:read'
  | 'messages:write'
  | 'codebase:read'
  | 'codebase:write'
  | 'skills:read'
  | 'webhooks:manage'

/** 作者写下的单条开放声明(尚未附加目录派生字段)。 */
interface OpenCapabilityDeclaration {
  /** 人类可读说明(进文档与审计日志)。 */
  description: string
  /** HTTP 方法,大写;`'*'` 表示任意方法。 */
  methods: readonly string[]
  /**
   * 完整 URL 路径模式(Fastify 注册前缀已展开,不含 query)。
   * 匹配语义是**精确匹配 + 显式参数段**:`:name` 占位恰好一个非空、不含 `/` 的段;
   * 禁止 `*` / `**` / 前缀通配(构建期直接抛错)—— 默认拒绝不允许前缀继承,
   * 新增端点必须显式补进 `paths` 才可对机器凭据开放。
   */
  paths: readonly string[]
  scope: OpenableCapabilityScope
}

/** 编译后的登记表条目:声明 + 目录派生的审计字段。 */
export interface OpenCapabilityEntry extends OpenCapabilityDeclaration {
  key: OpenCapabilityKey
  /** 派生自能力目录(不参与判定,仅供审计/文档/数据闸对齐)。 */
  dataClass: CapabilityDataClass
  capability: CapabilityEntry
}

/** 命中登记表后注入 `request.openCapability` 的授权凭据。 */
export interface OpenCapabilityGrant {
  key: OpenCapabilityKey
  scope: ApiKeyPermission
  dataClass: CapabilityDataClass
}

const DECLARATIONS = {
  // ===== 遗留 /api/v1 前端桩(O3 已登记 scope,O6 在此收口为强制 + 机器通道)=====
  // 默认拒绝不允许前缀继承:族内路径一律**逐条枚举**(与 routes/** 的真实注册点一一对应),
  // 同前缀下新增端点不会因为"落在族内"被顺手开放 —— 必须显式补条目。
  // 写语义端点单独成条(如 close),方法收窄到实际注册的方法。
  'v1-tools-directory': {
    description: '工具目录:列表 / 分类 / 上传配置(只读,全站已发布工具)',
    methods: ['GET'],
    paths: ['/api/v1/tools/list', '/api/v1/tools/categories', '/api/v1/tools/upload'],
    scope: 'tools:read',
  },
  'v1-content-catalog': {
    description: '内容生成:模板列表 + 当前用户生成历史',
    methods: ['GET'],
    paths: ['/api/v1/content/create', '/api/v1/content/list'],
    scope: 'user:read',
  },
  'v1-customer-service-read': {
    description: '客服:消息列表 / 未读数 / 工单与回复 / 评级 / FAQ',
    methods: ['GET'],
    paths: [
      '/api/v1/customer_service/messages',
      '/api/v1/customer_service/messages/read',
      '/api/v1/customer_service/ticket',
      '/api/v1/customer_service/ticket/:id',
      '/api/v1/customer_service/ticket/:id/replies',
      '/api/v1/customer_service/ticket/:id/rate',
      '/api/v1/customer_service/faqs',
    ],
    scope: 'messages:read',
  },
  'v1-customer-service-close': {
    description: '客服:关闭工单(状态流转,写操作,必须优先于只读族命中)',
    methods: ['GET'],
    paths: ['/api/v1/customer_service/ticket/:id/close'],
    scope: 'messages:write',
  },
  // ===== 代码库语义索引(O3 已在 routes/v1-codebase-search.ts 就地登记,
  //       此处收拢为单一事实源;路由内既有闸幂等,不会二次鉴权)=====
  'codebase-search': {
    description: '代码库语义检索与索引统计',
    methods: ['GET', 'POST'],
    paths: ['/api/v1/codebase/search', '/api/v1/codebase/stats'],
    scope: 'codebase:read',
  },
  'codebase-write': {
    // 仓库维度端点逐条枚举(v1-codebase-search.ts 的 DELETE /repo/:repoId 与
    // /repo/:repoId/files)—— `:repoId` 只占一个非空段,repoId 下再嵌套的
    // 未登记路径(如 /repo/7/tags/batch)不再被前缀通配顺手放行。
    description: '代码库切片批量写入与按仓库删除',
    methods: ['POST', 'DELETE'],
    paths: [
      '/api/v1/codebase/index',
      '/api/v1/codebase/repo/:repoId',
      '/api/v1/codebase/repo/:repoId/files',
    ],
    scope: 'codebase:write',
  },
  // ===== 用户自有资产面(scoped-*,强制 owner 过滤,owner = key 归属人)=====
  'skills-list': {
    description: '当前用户的 Skill 清单(只读)',
    methods: ['GET'],
    paths: ['/api/skills'],
    scope: 'skills:read',
  },
  'webhooks-manage': {
    description: 'Relay Webhook 订阅自助管理:列表 / 建订阅 / 连通性测试',
    methods: ['GET', 'POST'],
    paths: [
      '/api/developer/webhooks/subscriptions',
      '/api/developer/webhooks/subscriptions/:id/test',
    ],
    scope: 'webhooks:manage',
  },
} as const satisfies Record<string, OpenCapabilityDeclaration>

/** 登记表主键(由声明推导,新增条目自动进联合)。 */
export type OpenCapabilityKey = keyof typeof DECLARATIONS

/** 单条路径模式的编译产物。 */
interface Matcher {
  entry: OpenCapabilityEntry
  methods: ReadonlySet<string>
  pattern: RegExp
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 合法参数段:冒号开头 + 标识符,整段占位(`:id` / `:repoId`);不允许出现在段中间。 */
const PARAM_SEGMENT = /^:[A-Za-z_][A-Za-z0-9_]*$/

/**
 * 编译路径模式为**锚定精确 + 单段参数**正则:`:param` 段匹配一个非空、不含 `/` 的段;
 * 其余按字面量。不支持任何通配(`*` 在 buildRegistry 构建期即被拒绝,不会到这里)。
 */
function compilePath(pattern: string): RegExp {
  const source = pattern
    .split('/')
    .map((segment) => (PARAM_SEGMENT.test(segment) ? '[^/]+' : escapeRegExp(segment)))
    .join('/')
  return new RegExp(`^${source}$`)
}

/**
 * 第三道判定:目录语义。不过即抛错 —— 宁可起不来,不可静默开放。
 * 导出供单测直接喂 `publish:operate` / `ops:execute` 这类 platform scope 验证拒绝路径
 * (`OpenableCapabilityScope` 联合已在编译期挡住,此处证明运行期同样挡得住)。
 */
export function assertScopeOpenable(scope: ApiKeyPermission, key: string): CapabilityEntry {
  const entry = requireCapabilityOrThrow(scope)
  const dataClass = effectiveDataClass(entry)
  if (dataClass === 'platform') {
    throw new Error(`[open-capability-registry] ${key}: dataClass=platform 不可对机器凭据开放`)
  }
  if (!entry.thirdPartyEligible) {
    throw new Error(`[open-capability-registry] ${key}: ${scope} thirdPartyEligible=false`)
  }
  if (!isM2MAllowed(scope)) {
    throw new Error(`[open-capability-registry] ${key}: ${scope} isM2MAllowed=false,目录已收紧`)
  }
  return entry
}

function buildRegistry(): OpenCapabilityEntry[] {
  const entries = (Object.keys(DECLARATIONS) as OpenCapabilityKey[]).map((key) => {
    const declaration = DECLARATIONS[key]
    const methods = declaration.methods.map((m) => m.toUpperCase())
    if (methods.length === 0) throw new Error(`[open-capability-registry] ${key}: methods 为空`)
    if (methods.some((m) => !/^[A-Z]+$|^\*$/.test(m))) {
      throw new Error(`[open-capability-registry] ${key}: methods 必须大写`)
    }
    const paths: readonly string[] = declaration.paths
    if (paths.length === 0) throw new Error(`[open-capability-registry] ${key}: paths 为空`)
    if (paths.some((p) => !p.startsWith('/api/'))) {
      throw new Error(
        `[open-capability-registry] ${key}: 本表只管 /api/* 业务面,/v1 协议面由能力目录就地闸口负责`,
      )
    }
    // 结构性防线:通配一律拒绝(默认拒绝不允许前缀继承,新端点必须逐条显式登记)。
    if (paths.some((p) => p.includes('*'))) {
      throw new Error(
        `[open-capability-registry] ${key}: paths 不得含 "*" —— 请逐条枚举精确路径/参数化路径`,
      )
    }
    for (const p of paths) {
      const badSegment = p.split('/').find((s) => s.includes(':') && !PARAM_SEGMENT.test(s))
      if (badSegment !== undefined) {
        throw new Error(
          `[open-capability-registry] ${key}: ${p} 的参数段 "${badSegment}" 非法(须为 ":name" 且独占整段)`,
        )
      }
    }
    const capability = assertScopeOpenable(declaration.scope, key)
    return {
      ...declaration,
      methods,
      key,
      capability,
      dataClass: effectiveDataClass(capability),
    }
  })

  // 同一 (方法, 路径) 不得被两条条目抢登记 —— 否则"谁先匹配"决定授权面,静默漂移。
  const seen = new Map<string, OpenCapabilityKey>()
  for (const entry of entries) {
    for (const path of entry.paths) {
      for (const method of entry.methods) {
        const id = `${method} ${path}`
        const previous = seen.get(id)
        if (previous) {
          throw new Error(
            `[open-capability-registry] ${id} 同时被 ${previous} 与 ${entry.key} 登记`,
          )
        }
        seen.set(id, entry.key)
      }
    }
  }
  return entries
}

/**
 * 匹配优先级:字面量更长的路径模式先试(参数段按字面 `:name` 计长,排序只为确定性)。
 * 两处判定(findOpenCapability 与派生的 requireCapabilityRules 规则表)必须
 * 给出同一个 scope,否则"根级闸放行、端点级闸按另一 scope 判定"就会错位。
 */
function specificity(entry: OpenCapabilityEntry): number {
  return entry.paths.reduce((max, p) => Math.max(max, p.length), 0)
}

const REGISTRY: readonly OpenCapabilityEntry[] = Object.freeze(buildRegistry())

function buildMatchers(): Matcher[] {
  const ordered = [...REGISTRY].sort(
    (a, b) => specificity(b) - specificity(a) || a.key.localeCompare(b.key),
  )
  return ordered.flatMap((entry) =>
    entry.paths.map((path) => ({
      entry,
      methods: new Set(entry.methods),
      pattern: compilePath(path),
    })),
  )
}

const MATCHERS: readonly Matcher[] = Object.freeze(buildMatchers())

/** 全量开放条目(文档生成 / 自检用)。 */
export function openCapabilityEntries(): readonly OpenCapabilityEntry[] {
  return REGISTRY
}

/** 按主键取条目;未登记立即抛错(路由文件引用了不存在的 key = 登记表与代码漂移)。 */
export function getOpenCapabilityEntry(key: OpenCapabilityKey): OpenCapabilityEntry {
  const entry = REGISTRY.find((e) => e.key === key)
  if (!entry) {
    throw new Error(`[open-capability-registry] 未登记的开放条目: ${String(key)}`)
  }
  return entry
}

/**
 * 默认拒绝的唯一入口:只有命中本表才允许机器凭据进入 `/api` 面。
 * @param method HTTP 方法(大小写不敏感)
 * @param path   不含 query 的 URL 路径
 */
export function findOpenCapability(method: string, path: string): OpenCapabilityEntry | undefined {
  const upper = method.toUpperCase()
  return MATCHERS.find(
    (matcher) =>
      (matcher.methods.has(upper) || matcher.methods.has('*')) && matcher.pattern.test(path),
  )?.entry
}

/** 条目转成的授权凭据(注入 request.openCapability,供 plugins/auth.ts 显式分支消费)。 */
export function grantOf(entry: OpenCapabilityEntry): OpenCapabilityGrant {
  return { key: entry.key, scope: entry.scope, dataClass: entry.dataClass }
}

/**
 * 把登记表片段导出成 `requireCapabilityRules` 的规则表,供遗留 `/api/v1` 族在
 * 文件级 preHandler 里强制 scope —— 路由文件因此**不需要**自己再写一遍
 * path→scope 映射,登记表保持唯一事实源。
 *
 * 未列入 keys 的条目不会进规则表;命中不到规则的机器请求由
 * `requireCapabilityRules` 返回 403 `CAPABILITY_UNREGISTERED`(默认拒绝)。
 */
export function openCapabilityRules(...keys: OpenCapabilityKey[]): CapabilityRule[] {
  const rules = keys.flatMap((key) => {
    const entry = getOpenCapabilityEntry(key)
    return entry.paths.map<CapabilityRule>((path) => ({
      methods: entry.methods.includes('*') ? undefined : entry.methods,
      pattern: compilePath(path),
      scope: entry.scope,
    }))
  })
  // `requireCapabilityRules` 取**首个**命中规则,故按字面量长度降序排列:
  // 更长(更具体)的路径模式先匹配,保证判定确定性。
  // 与 findOpenCapability 的优先级保持一致 —— 两处判定必须给出同一个 scope。
  return rules.sort((a, b) => b.pattern.source.length - a.pattern.source.length)
}

/** 供文档 / 自检核对:scope 与目录是否仍一致(漂移时 getCapability 返回 undefined)。 */
export function isRegistryEntryInCatalog(entry: OpenCapabilityEntry): boolean {
  return getCapability(entry.scope) === entry.capability
}
