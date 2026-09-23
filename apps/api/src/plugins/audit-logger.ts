// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 国安级审计日志 Fastify 全局插件。
 *
 * 与现有 plugins/audit.ts(仅记录写操作 + 无防篡改)互补:
 * - 本插件记录所有请求(GET 默认 100% 采样,非 GET 100%;可设 AUDIT_LOG_GET_SAMPLE_RATE 调低)
 * - 自动分类 action(auth.login / user.create / data.read / data.write / admin.op 等)
 * - 敏感字段脱敏:复用 plugins/log-sanitizer.ts 同一套规则(buildSensitiveKeySet + sanitizeData),
 *   不再自带一份 SENSITIVE_KEYS / sanitizeDeep 实现(O5 治理 2026-09-21:两套并存必然漂移)
 * - 参数只落**摘要**(键名 + 类型 + 长度 + 命中脱敏标记),不落 prompt / body 原文 / 密钥
 * - UUID 路径参数截断(前 8 位 + ...)
 * - 通过 recordAuditLog 写入 HMAC 链式审计表(防篡改)
 *
 * O5 归因(2026-09-21):审计行必须能回答"哪把 key、什么能力、哪个端点、多久、什么结果"。
 * - 覆盖范围从「仅 /api/」扩到「/api/ + 对外开放面 /v1/、/v1beta/」——
 *   此前开放面**一条审计都不落**,这才是"无法回答哪把 key 调了哪个端点"的根因。
 * - metadata 增记 apiKeyId / 归属 userId / capability(scope·dataClass·risk·billable)
 *   / method / url / routePattern / statusCode / durationMs。
 * - 归因走**已有**请求上下文(request.apiKey 由 plugins/api-key-auth.ts 注入,
 *   request.capability 由 utils/capability-guard.ts 注入),本插件不改鉴权链路,只读不算。
 * - 未鉴权流量(无 key 无 JWT)仍落审计:userId / apiKeyId 为 null,
 *   带 ip + path,可回答"谁在探测哪个端点"。
 *
 * 跳过健康检查(/api/health、/api/ready),避免噪音。
 * 用 setImmediate 异步落库,失败忽略,绝不阻塞业务响应。
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { recordAuditLog } from '../services/audit-log-service.js'
// 复用 log-sanitizer 插件 Proxy 递归脱敏所用的同一套规则函数(不另起一套)。
import { buildSensitiveKeySet, isSensitiveKey, sanitizeData } from './response-sanitizer.js'

/**
 * 审计用的敏感 key 集合 = 全局规则 + 审计面专属补充。
 *
 * 为什么要 extra:全局 DEFAULT_SENSITIVE_KEYS 是**子串包含**匹配,里面只有 `apikey`
 * 没有 `api_key`,也没有 `authorization` —— 于是 `{"api_key": "sk-..."}` 这种
 * snake_case 载荷不会被既有规则命中(实测:站内写请求审计里 api_key 原值直接落库)。
 * 改造前本文件自带的 SENSITIVE_KEYS 恰好覆盖了这两个,不能因为"复用统一实现"就把
 * 覆盖面缩回去,所以走 buildSensitiveKeySet(extra) 这个官方扩展点补齐。
 * (更彻底的修法是把这两项加进 response-sanitizer 的 DEFAULT_SENSITIVE_KEYS,
 *  但那会同时改变全站响应脱敏面,不在本子任务的文件清单内 → 留给主 agent 决策。)
 */
const AUDIT_EXTRA_SENSITIVE_KEYS = ['api_key', 'authorization', 'client_secret', 'private_key']
const AUDIT_SENSITIVE_KEYS = buildSensitiveKeySet(AUDIT_EXTRA_SENSITIVE_KEYS)

/**
 * 对外开放面路径前缀(2026-09-21 O5)。
 * 与 deploy/nginx/nginx-blue-green.conf 里被限流的 location 一一对应:
 * 边缘限流覆盖到哪条前缀,审计归因就必须覆盖到哪条前缀,否则被 429 挡掉的调用无从对账。
 */
export const OPEN_SURFACE_PREFIXES: readonly string[] = ['/v1/', '/v1beta/']

/**
 * 摘要递归深度上限(与改造前本地 sanitizeDeep 的 `depth > 5` 同等保护,不退化)。
 * 超深嵌套 / 循环引用的正文一律折叠成 `nested(...)`,并且 sanitizeData 与摘要两步共用
 * 同一个上限 —— 任一步抛错(RangeError)都由 buildParamSummary 兜住,只丢摘要不影响请求。
 */
const SUMMARY_MAX_DEPTH = 5

/** 请求归因字段(落 audit_logs_chain.metadata,JSONB,无需改表)。 */
export interface RequestAttribution {
  /** 命中的 API Key id(request.apiKey.id);JWT 会话或匿名探测为 null。 */
  apiKeyId: string | null
  /** Key 归属用户 id(仅 API Key 链路;与 JWT userId 区分开,避免"谁调的"被覆盖)。 */
  apiKeyOwnerId: string | null
  /** 会话用户 id(JWT / authenticate 注入)。 */
  userId: string | null
  /** 能力闸命中的 scope(如 'agent.run');未过能力闸为 null。 */
  capabilityScope: string | null
  /** 能力数据分级(compute / scoped-read / scoped-write / platform)——"功能开放≠数据开放"的落账字段。 */
  capabilityDataClass: string | null
  /** 能力风险档(low / medium / high / critical)。 */
  capabilityRisk: string | null
  /** 该能力是否即产生外部成本(计费归因用)。 */
  capabilityBillable: boolean | null
  /** 归属能力域(agent / chat / model / ... )。 */
  capabilityDomain: string | null
  method: string
  /** 脱敏后的请求路径(UUID 截断)。 */
  url: string
  /** Fastify 路由模板(如 /v1/chat/completions、/api/users/:id);未匹配路由为 null。 */
  routePattern: string | null
  statusCode: number
  /** 端到端耗时(毫秒,保留 1 位小数)。 */
  durationMs: number | null
  /** 是否属于对外开放面。 */
  openSurface: boolean
}

/** 跳过记录的健康检查路径(精确匹配 url path 部分)。 */
const SKIP_PATHS = new Set(['/api/health', '/api/ready'])

// P2 修复(2026-08-06):GET 请求采样率默认 0.1(仅 10% GET 有审计记录)→ 1.0(全量)。
// 审计日志要求完整留痕,原默认 90% GET 审计事件缺失属合规盲区。
// 需要降量时可设 AUDIT_LOG_GET_SAMPLE_RATE(0~1)显式调低,钳制到 [0,1]。
const GET_SAMPLE_RATE = Math.min(
  Math.max(Number(process.env.AUDIT_LOG_GET_SAMPLE_RATE ?? '1'), 0),
  1,
)

declare module 'fastify' {
  interface FastifyRequest {
    auditStartTime?: bigint
  }
}

/**
 * 参数摘要:先过**既有脱敏**(sanitizeData,与 plugins/log-sanitizer.ts 的 Proxy 同一实现),
 * 再把结果降维成"形状描述",从而在结构上不可能落 prompt / body 原文。
 *
 * 输出形如(顶层是对象,值一律降维成字符串描述):
 *   { model: 'str(len=6)', stream: 'bool',
 *     messages: 'arr(len=1,item={"role":"str(len=4)","content":"str(len=19)"})',
 *     nested: { access_token: 'masked', keep: 'str(len=1)' },
 *     api_key: 'masked' }
 * - `masked` = 命中敏感规则(值连同长度一起丢弃,不留"*** 的 len=3"这种可反推信息);
 * - 字符串只留长度,不留内容;对象只留键名;数组只留长度 + 首个元素的形状。
 *
 * 为什么不只用脱敏就完事:sanitizeData 是按**键名**命中的,`messages[].content` 这种
 * "键名不敏感但值是 prompt 原文"的字段它不会掩 —— 开放面的核心载荷恰恰就是这个。
 * 两步叠加:键名敏感的 → masked;键名不敏感但值是正文的 → 只剩长度。
 */
export function summarizeSanitizedParams(
  value: unknown,
  keys: Set<string> = AUDIT_SENSITIVE_KEYS,
  depth = 0,
): string | unknown {
  // 深度保护:超出即折叠,防超深嵌套正文把审计链路拖爆(与旧 sanitizeDeep 同等保护)
  if (depth > SUMMARY_MAX_DEPTH) return 'nested(...)'
  if (value === null) return 'null'
  if (typeof value === 'string') return `str(len=${value.length})`
  if (typeof value === 'number') return 'num'
  if (typeof value === 'boolean') return 'bool'
  if (typeof value === 'bigint') return 'int'
  if (Array.isArray(value)) {
    const first = value[0]
    if (first === undefined) return `arr(len=0,item=empty)`
    const itemShape = summarizeSanitizedParams(first, keys, depth + 1)
    const item = typeof itemShape === 'string' ? itemShape : JSON.stringify(itemShape)
    return `arr(len=${value.length},item=${item})`
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value)
    // Date / Buffer / Stream / 自定义类实例等一律折叠,不尝试枚举(避免 getter 副作用)
    if (proto !== Object.prototype && proto !== null) return typeof value
    const out: Record<string, string | unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // 与 sanitizeData 同一个 isSensitiveKey 判定:命中即整段丢弃(不递归、也不留长度)
      out[k] = isSensitiveKey(k, keys) ? 'masked' : summarizeSanitizedParams(v, keys, depth + 1)
    }
    return out
  }
  return typeof value
}

/**
 * 生成一次请求的参数摘要(查询串 / 请求体)。
 * @param value 原始对象(通常是 request.body 或解析后的 query)
 * @param opts.rawValues true 时保留"脱敏后的原值"(站内 /api 会话链路,兼容既有读端);
 *                       false 时只保留形状摘要(对外开放面,严禁原文)。
 */
export function buildParamSummary(
  value: unknown,
  opts: { rawValues: boolean },
): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return undefined
  try {
    // 第一步永远是既有脱敏:两条分支都必须先过它,不允许"直接读原值"的旁路
    const sanitized = sanitizeData(value, AUDIT_SENSITIVE_KEYS)
    if (opts.rawValues && typeof sanitized === 'object' && sanitized !== null) {
      return sanitized as Record<string, unknown>
    }
    const shape = summarizeSanitizedParams(sanitized)
    return typeof shape === 'string' ? { value: shape } : (shape as Record<string, unknown>)
  } catch {
    // RangeError(超深嵌套)/ 循环引用等:宁可丢掉摘要,也不让审计链路抛出影响请求
    return { _note: 'param summary failed' }
  }
}

/** 从 URL 提取 path 部分(去掉 query string)。 */
function urlPath(url: string): string {
  const qIdx = url.indexOf('?')
  return qIdx >= 0 ? url.slice(0, qIdx) : url
}

/** 解析 query string 为键值对象(轻量实现,避免依赖 URLSearchParams 边界问题)。 */
function parseQuery(url: string): Record<string, string> {
  const qIdx = url.indexOf('?')
  if (qIdx < 0) return {}
  const qs = url.slice(qIdx + 1)
  const out: Record<string, string> = {}
  for (const pair of qs.split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const k = eq >= 0 ? pair.slice(0, eq) : pair
    const v = eq >= 0 ? pair.slice(eq + 1) : ''
    out[decodeURIComponent(k)] = decodeURIComponent(v)
  }
  return out
}

/**
 * 脱敏 query 值:统一走既有脱敏规则(sanitizeData 内部按 isSensitiveKey + maskValue 处理),
 * 不再自带一份 key 列表。开放面额外降维成形状摘要,不留可反推的查询值。
 */
export function summarizeQuery(
  url: string,
  opts: { rawValues: boolean },
): Record<string, unknown> | undefined {
  const parsed = parseQuery(url)
  if (Object.keys(parsed).length === 0) return undefined
  return buildParamSummary(parsed, opts)
}

/**
 * 脱敏路径参数:数字 ID 保留,UUID 截断为前 8 位 + ...。
 * 例:/api/users/550e8400-e29b-41d4-a716-446655440000 → /api/users/550e8400...
 */
function sanitizePath(path: string): string {
  return path.replace(
    /\/([0-9a-fA-F]{8})-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    '/$1...',
  )
}

/** 路径是否属于对外开放面(/v1/、/v1beta/)。 */
export function isOpenSurfacePath(path: string): boolean {
  return OPEN_SURFACE_PREFIXES.some((p) => path === p || path.startsWith(p))
}

/**
 * 组装一次请求的归因字段(纯读 request/reply,不做任何鉴权判定)。
 * 单独导出便于 plugins/audit.ts 复用与单测直接构造。
 */
export function buildRequestAttribution(
  request: FastifyRequest,
  reply: FastifyReply,
  durationMs: number | null,
): RequestAttribution {
  const rawPath = urlPath(request.url)
  const capability = request.capability
  // 只取身份字段。**绝不**读 request.apiKey.key(那是凭据原文,落库即等同密钥泄露)。
  const apiKey = request.apiKey
  // Fastify 5: routeOptions.url 为注册模板(/v1/chat/completions、/api/users/:id)。
  // 未匹配到路由(404 探测)时 Fastify 给出的是 404 路由模板,故再加一次 path 兜底判断。
  const routePattern = request.routeOptions?.url ?? null
  return {
    apiKeyId: apiKey?.id ?? null,
    apiKeyOwnerId: apiKey?.userId ?? null,
    userId: request.userId ?? request.jwtPayload?.userId ?? null,
    capabilityScope: capability?.scope ?? null,
    capabilityDataClass: capability?.dataClass ?? null,
    capabilityRisk: capability?.risk ?? null,
    capabilityBillable: capability ? capability.billable : null,
    capabilityDomain: capability?.domain ?? null,
    method: request.method.toUpperCase(),
    url: sanitizePath(rawPath),
    routePattern,
    statusCode: reply.statusCode,
    durationMs: durationMs === null ? null : Math.round(durationMs * 10) / 10,
    openSurface: isOpenSurfacePath(rawPath),
  }
}

/** 从 method + URL 自动分类 action。 */
function classifyAction(method: string, path: string): string {
  const m = method.toUpperCase()
  const p = path.toLowerCase()

  // 对外开放面(中转站网关):与站内会话链路区分,便于按 action 聚合审计
  if (isOpenSurfacePath(p)) {
    return m === 'GET' ? 'gateway.read' : 'gateway.invoke'
  }

  // auth 相关
  if (p.includes('/auth/login') || p.includes('/auth/sso') || p.includes('/login')) {
    return m === 'POST' ? 'auth.login' : 'auth.access'
  }
  if (p.includes('/auth/logout') || p.includes('/logout')) return 'auth.logout'
  if (p.includes('/auth/') || p.includes('/mfa')) return 'auth.operation'

  // admin 相关(优先级高)
  if (p.includes('/admin/') || p.startsWith('/api/admin')) return 'admin.op'

  // users 资源
  if (p.includes('/users')) {
    if (m === 'POST') return 'user.create'
    if (m === 'PUT' || m === 'PATCH') return 'user.update'
    if (m === 'DELETE') return 'user.delete'
    return 'user.read'
  }

  // 通用读写
  if (m === 'GET') return 'data.read'
  if (m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE') return 'data.write'
  return 'data.access'
}

/** 从 request 提取设备指纹(从 header 读取,若存在)。 */
function extractDeviceFingerprint(request: FastifyRequest): string | undefined {
  const h = request.headers['x-device-fingerprint']
  if (typeof h === 'string' && h.length > 0) return h.slice(0, 128)
  return undefined
}

const auditLoggerPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 记录请求开始时间(用于计算响应耗时)
  server.addHook('onRequest', async (request: FastifyRequest) => {
    request.auditStartTime = process.hrtime.bigint()
  })

  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase()
    const rawUrl = request.url
    const path = urlPath(rawUrl)

    // 跳过健康检查
    if (SKIP_PATHS.has(path)) return
    // 记录范围:/api 会话链路 + 对外开放面(/v1/、/v1beta/)。
    // 后者是 O5 补的洞 —— 开放面此前完全不落审计,才导致"哪把 key 调了哪个端点"无从回答。
    const openSurface = isOpenSurfacePath(path)
    if (!openSurface && !path.startsWith('/api/')) return

    // GET 采样(默认 100%,可设 AUDIT_LOG_GET_SAMPLE_RATE 调低);非 GET 100%。
    // 开放面的 GET(/v1/models 等)同样受采样约束,超限时(4xx)则强制全量记录以便复盘。
    if (method === 'GET' && reply.statusCode < 400 && Math.random() >= GET_SAMPLE_RATE) return

    // 计算响应耗时(ms)
    const start = request.auditStartTime
    const responseTimeMs =
      start !== null && start !== undefined
        ? Number(process.hrtime.bigint() - start) / 1e6
        : undefined

    const action = classifyAction(method, path)
    const attribution = buildRequestAttribution(request, reply, responseTimeMs ?? null)
    const deviceFingerprint = extractDeviceFingerprint(request)
    const userAgent = request.headers['user-agent']

    // 参数摘要:先过既有脱敏(sanitizeData),再决定是否降维。
    // - 开放面:rawValues=false → 只留形状摘要,结构上不可能带出 prompt 正文;
    // - 站内 /api:rawValues=true → 保持改造前"脱敏后的对象"形态,不破坏既有读端。
    const hasBody =
      method !== 'GET' &&
      method !== 'HEAD' &&
      request.body !== null &&
      request.body !== undefined &&
      typeof request.body === 'object'
    const params = hasBody
      ? buildParamSummary(request.body, { rawValues: !openSurface })
      : undefined
    const querySummary = summarizeQuery(rawUrl, { rawValues: !openSurface })

    // 异步落库,绝不阻塞响应
    setImmediate(() => {
      recordAuditLog({
        // 开放面可能只有 key(无 JWT userId):userId 仍取会话用户,
        // key 归属人由 attribution.apiKeyOwnerId 承载,两者不互相覆盖。
        userId: attribution.userId ?? undefined,
        action,
        resourceType: extractResourceType(path),
        resourceId: extractResourceId(path),
        ip: request.ip,
        userAgent: userAgent ? userAgent.slice(0, 512) : undefined,
        result: reply.statusCode < 400 ? 'success' : 'failure',
        metadata: {
          // ── O5 归因字段 ──
          apiKeyId: attribution.apiKeyId,
          apiKeyOwnerId: attribution.apiKeyOwnerId,
          capabilityScope: attribution.capabilityScope,
          capabilityDataClass: attribution.capabilityDataClass,
          capabilityRisk: attribution.capabilityRisk,
          capabilityBillable: attribution.capabilityBillable,
          capabilityDomain: attribution.capabilityDomain,
          openSurface: attribution.openSurface,
          method: attribution.method,
          url: attribution.url,
          routePattern: attribution.routePattern,
          statusCode: attribution.statusCode,
          durationMs: attribution.durationMs,
          // 兼容改造前的字段名(读端可能按 responseTimeMs 取耗时)
          responseTimeMs,
          query: querySummary,
          // 注意:不再写 `body`。开放面严禁原文;站内改为 params(脱敏后或形状摘要)。
          params,
          deviceFingerprint,
        },
      }).catch(() => {
        /* 审计写入失败不影响业务 */
      })
    })
  })
}

/** 从 URL path 提取资源类型(/api/users/123 → users;/v1/chat/completions → chat)。 */
function extractResourceType(path: string): string | undefined {
  const segs = path.split('/').filter(Boolean)
  // 跳过 'api' / 'admin' 前缀
  const idx = segs[0] === 'api' ? 1 : 0
  // 开放面是版本前缀(/v1、/v1beta),它不是资源;真正资源在下一段(chat / models / ...)
  const start = isOpenSurfacePath(path) ? 1 : segs[idx] === 'admin' ? idx + 1 : idx
  return segs[start]
}

/** 从 URL path 提取资源 ID(最后一个路径段,若是数字或 UUID)。 */
function extractResourceId(path: string): string | undefined {
  const segs = path.split('/').filter(Boolean)
  if (segs.length < 2) return undefined
  const last = segs[segs.length - 1]
  if (!last) return undefined
  // 纯数字 ID
  if (/^\d+$/.test(last)) return last
  // UUID 截断(前 8 位)
  const uuidMatch = last.match(/^([0-9a-fA-F]{8})-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}/)
  if (uuidMatch && uuidMatch[1]) return uuidMatch[1] + '...'
  return undefined
}

export default fp(auditLoggerPlugin, {
  name: 'audit-logger-plugin',
  fastify: '5.x',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
