// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 从真实 Fastify 启动图导出 OpenAPI 3.0 契约产物 `apps/api/openapi.json`。
 *
 * 背景(2026-09-20 O8 立):`@fastify/swagger` 早在 `src/server.ts` 注册,但仓库里
 * 从来没有落盘的契约产物,`scripts/openapi-check.mjs` 因此只能"产物不存在→跳过",
 * 形成恒绿的假门禁。本脚本把契约变成**真产物**:由代码生成、可 diff、可被门禁校验。
 *
 * 设计要点:
 * 1. **不监听端口**。走 `buildServer()` → `server.ready()` → `server.swagger()`,
 *    拿到的是与运行时 `/docs/json` **同一份**文档,不存在"导出器另写一套定义"的漂移。
 * 2. **不连基础设施**。CI/干净工作区没有 PG(8810)与 Redis(8811)。用 `node:module`
 *    的 `register()` 注入 ESM resolve 钩子,把 `ioredis` / `bullmq` / `src/db/index.ts`
 *    替换为"立即就绪"的内存桩,其余(路由、插件、Zod→OpenAPI 转换)全部跑真实代码。
 *    钩子源码内联为 data: URL,不落任何临时文件。
 * 3. **securitySchemes 与 scope 注入的单一事实源是
 *    `packages/types/generated/capabilities.json`**(由 `scripts/export-capabilities.ts`
 *    从 `packages/types/src/capability-catalog.ts` 生成)。本脚本只**读取**它的
 *    `capabilities[].routes`(`"METHOD /path"` 形式)映射成 OpenAPI 的 `security`,
 *    绝不另立一份端点清单。
 * 4. **输出确定性**:paths / schemas / 参数全部排序,不写时间戳。两次导出字节一致,
 *    CI 才能用"`export` 后 `git diff --exit-code`"判定产物与代码漂移。
 *
 * 用法:
 *   pnpm --filter @ihui/api exec tsx scripts/export-openapi.ts
 *   pnpm --filter @ihui/api exec tsx scripts/export-openapi.ts --out <path>  # 导出到别处(CI 漂移比对)
 *   pnpm --filter @ihui/api exec tsx scripts/export-openapi.ts --stdout      # 只打印不写盘
 *   pnpm --filter @ihui/api exec tsx scripts/export-openapi.ts --quiet
 *
 * 退出码:0 成功 / 1 生成或写盘失败 / 2 脚本自身异常。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { register } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { FastifyInstance } from 'fastify'

const here = dirname(fileURLToPath(import.meta.url))
const apiRoot = resolve(here, '..')
const repoRoot = resolve(apiRoot, '..', '..')

/** 产物默认落点(相对仓库根)。 */
export const ARTIFACT_REL_PATH = 'apps/api/openapi.json'
/** 能力清单(单一事实源),相对仓库根。 */
export const CAPABILITIES_REL_PATH = 'packages/types/generated/capabilities.json'

// ════════════════════════════════ 基础设施桩 ════════════════════════════════

/** 需要按"解析后的绝对路径"拦截的内部模块(相对路径 specifier 在各目录写法不同)。 */
/**
 * 桩键归一化 —— **装载 needle 的一侧与钩子算 key 的一侧必须共用这一个实现**。
 *
 * `new URL('file:///home/runner/...').pathname` 在 POSIX 上带前导斜杠,钩子必须剥掉它
 * 才等于 `resolve()` 的产物(Windows 上 pathname 是 `/G:/...`,同样要剥)。
 * 若装载 needle 时保留前导斜杠,则 Linux/CI 上两侧永远不相等 ⇒ `src/db/index.ts` 的桩
 * **静默不生效** ⇒ 号称"不监听端口、不连 PG、不连 Redis"的导出脚本真的去连库,并在路由
 * 注册期的幂等建表(`live-gifts.ts:70`)上崩。Windows 本地永远绿,所以这是一条只在 CI
 * 现形的平台性失效(与守门 72/78 "本地全绿、出事的是别人"同族)。
 *
 * 写成无类型标注的普通 function:它要被 `.toString()` 注入 `data:` URL 的钩子模块里,
 * 那里跑的是纯 JS。
 */
function normalizeStubKey(p) {
  return p.replace(/\\/g, '/').replace(/^\//, '').toLowerCase()
}

const STUBBED_INTERNAL_FILES = new Set([
  normalizeStubKey(resolve(apiRoot, 'src', 'db', 'index.ts')),
])

/**
 * 拦截 `src/db/index.ts` 后按真实文件的 export 名单生成同名内存桩。
 *
 * 为什么按源码文本抽名单:桩必须是**同一批导出名**,少一个就在 link 阶段
 * `does not provide an export named`(整条启动链直接断)。从文本抽可随源码自动跟进。
 */
function buildDbStubSource(): string {
  const filePath = resolve(apiRoot, 'src', 'db', 'index.ts')
  const src = readFileSync(filePath, 'utf8')
  const names = new Set<string>()
  for (const m of src.matchAll(
    /^export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm,
  )) {
    names.add(m[1])
  }
  // export { a, b as c } / export { x } from '...'
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}(?!\s*from)/gm)) {
    for (const part of m[1].split(',')) {
      const seg = part.trim()
      if (!seg || seg.startsWith('type ')) continue
      const asName = seg
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (asName && /^[A-Za-z_$][\w$]*$/.test(asName)) names.add(asName)
    }
  }
  names.delete('default')
  const body = [...names].map((n) => `export const ${n} = __make()`).join('\n')
  return `${UNIVERSAL_PROXY_SRC}\n${body}\n`
}

/** 万能桩:any-object / any-fn / awaitable,行为与 tests/_server-smoke.test.ts 的 db mock 一致。 */
const UNIVERSAL_PROXY_SRC = `
const __make = () => {
  const fn = function () { return proxy }
  const target = typeof Proxy === 'function' ? fn : {}
  const thenFn = (resolve) => Promise.resolve([]).then(resolve)
  const proxy = new Proxy(target, {
    get(t, prop) {
      if (prop === 'then') return thenFn
      if (prop === Symbol.iterator) return function* () {}
      if (prop === 'toString') return () => ''
      if (prop === 'valueOf') return () => undefined
      if (prop === 'toJSON') return () => ({})
      if (typeof prop === 'symbol') return undefined
      return __make()
    },
    set() { return true },
    apply() { return proxy },
    construct() { return __make() },
    has() { return true },
  })
  return proxy
}
`

/** 裸包名桩(ioredis / bullmq / otel):不依赖任何裸 import,只 import node: 内建 → data: URL 安全。 */
const STUBBED_PACKAGES: Record<string, string> = {
  ioredis: `${UNIVERSAL_PROXY_SRC}
import { EventEmitter } from 'node:events'
class FakeRedis extends EventEmitter {
  status = 'ready'
  constructor(..._args) { super() }
  duplicate() { return new FakeRedis() }
  connect() { return Promise.resolve(this) }
  quit() { return Promise.resolve('OK') }
  disconnect() {}
  defineCommand() {}
  on(...args) { return super.on(...args) }
}
const __anyMethod = (target, prop, recv) => {
  if (prop in target) return Reflect.get(target, prop, recv)
  if (prop === 'then') return undefined
  return (..._a) => Promise.resolve(null)
}
const RedisProxy = new Proxy(FakeRedis, {
  construct(T, args) { return new Proxy(new T(...args), { get: __anyMethod }) },
})
export default RedisProxy
export const Redis = RedisProxy
export const Cluster = RedisProxy
export const Pipeline = RedisProxy
`,
  bullmq: `${UNIVERSAL_PROXY_SRC}
import { EventEmitter } from 'node:events'
class BullStub extends EventEmitter {
  constructor(..._args) { super() }
  get name() { return 'stub' }
  close() { return Promise.resolve() }
  on(...args) { return super.on(...args) }
  waitUntilReady() { return Promise.resolve(this) }
}
const __wrap = (T) => new Proxy(T, {
  construct(t, args) { return new Proxy(new t(...args), {
    get(target, prop, recv) {
      if (prop in target) return Reflect.get(target, prop, recv)
      if (prop === 'then') return undefined
      return (..._a) => Promise.resolve(undefined)
    },
  }) },
})
export const Queue = __wrap(BullStub)
export const FlowProducer = __wrap(BullStub)
export const Worker = __wrap(BullStub)
export const QueueEvents = __wrap(BullStub)
export const Job = __wrap(BullStub)
export class UnrecoverableError extends Error {}
export const Backoffs = { exponential: () => 0, stagger: () => 0 }
export const Sandbox = class {}
export const RateLimiter = () => ({})
export const QueueScheduler = __wrap(BullStub)
export const ChildProcessor = __wrap(BullStub)
export const parentProcess = __make()
export const CHILD_OF_CHILD = undefined
export const REMOVE_ON_COMPLETE = undefined
export const REMOVE_ON_FAIL = undefined
`,
  // ── OpenTelemetry:导出契约与追踪无关,而 sdk-node 的 ESM 入口在 Node 24 下
  //    会因 `@opentelemetry/api` 的 CJS 命名导出链接失败(context/trace/…)直接崩。
  //    真实 server 在 OTEL_ENABLED 未开时本来就把 SDK 降级为 no-op,这里同样只保留
  //    "API 可用、SDK 不启动"的形态。
  '@opentelemetry/sdk-node': `${UNIVERSAL_PROXY_SRC}
export class NodeSDK {
  constructor() {}
  async start() {}
  async shutdown() {}
}
export const registerInstrumentations = () => undefined
export const collectDefaultMetrics = () => undefined
`,
  '@opentelemetry/auto-instrumentations-node': `${UNIVERSAL_PROXY_SRC}
export const getNodeAutoInstrumentations = () => []
export default getNodeAutoInstrumentations
`,
  '@opentelemetry/exporter-trace-otlp-http': `${UNIVERSAL_PROXY_SRC}
export class OTLPTraceExporter {
  export() { return Promise.resolve({ code: 0 }) }
  shutdown() { return Promise.resolve() }
  forceFlush() { return Promise.resolve() }
}
export { OTLPTraceExporter as OTLPHTTPTraceExporter }
`,
  '@opentelemetry/resources': `${UNIVERSAL_PROXY_SRC}
export const resourceFromAttributes = (attrs) => ({ attributes: () => attrs })
export class Resource {
  constructor() {}
}
`,
  '@opentelemetry/semantic-conventions': `${UNIVERSAL_PROXY_SRC}
export const ATTR_SERVICE_NAME = 'service.name'
export const ATTR_SERVICE_VERSION = 'service.version'
export const SemanticAttributes = {}
export const Semantics = {}
`,
}

/** 钩子源码:导出顶层 initialize/resolve(Node 要求具名导出,不接受 register({hooks}) 对象形态)。 */
const HOOKS_SOURCE = `
${normalizeStubKey.toString()}
let STUB_PACKAGES = new Map()
let STUB_INTERNAL = new Map()
export async function initialize(data) {
  STUB_PACKAGES = new Map(Object.entries(data?.packages ?? {}))
  STUB_INTERNAL = new Map(Object.entries(data?.internal ?? {}))
}
const asDataUrl = (src) => 'data:text/javascript,' + encodeURIComponent(src)
export async function resolve(specifier, context, nextResolve) {
  const pkg = STUB_PACKAGES.get(specifier)
  if (pkg !== undefined) return { url: asDataUrl(pkg), shortCircuit: true, format: 'module' }
  const resolved = await nextResolve(specifier, context)
  if (resolved?.url && resolved.url.startsWith('file:')) {
    let file = ''
    try { file = decodeURIComponent(new URL(resolved.url).pathname) } catch { return resolved }
    const key = normalizeStubKey(file)
    for (const [needle, src] of STUB_INTERNAL) {
      if (key === needle || key.startsWith(needle + '/')) {
        return { url: asDataUrl(src), shortCircuit: true, format: 'module' }
      }
    }
  }
  return resolved
}
`

/** 装载桩:必须在任何业务模块 import 之前调用。 */
function installInfraStubs(): void {
  const internal: Record<string, string> = {}
  for (const file of STUBBED_INTERNAL_FILES) internal[file] = buildDbStubSource()
  register(
    'data:text/javascript,' + encodeURIComponent(HOOKS_SOURCE),
    pathToFileURL(join(apiRoot, 'scripts', 'export-openapi.ts')).href,
    { data: { packages: STUBBED_PACKAGES, internal } },
  )
}

/** 干净、确定性的环境:不读 .env,CI 与本地同值。 */
function applyDeterministicEnv(): void {
  const defaults: Record<string, string> = {
    NODE_ENV: 'development', // production 会关掉 swagger 注册(server.ts)
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://openapi:openapi@127.0.0.1:5432/openapi_export_unused',
    REDIS_URL: 'redis://127.0.0.1:1/0',
    JWT_SECRET: 'openapi-export-only-secret-please-ignore-32chars',
    CREDENTIALS_ENCRYPTION_KEY: 'openapi-export-only-credential-key-32chars',
    SWAGGER_ENABLED: 'true',
    ENABLE_WORKER: 'false',
    CANARY_ENABLED: 'false',
    MTLS_CLIENT_CERT_REQUIRED: 'false',
  }
  for (const [k, v] of Object.entries(defaults)) if (!process.env[k]) process.env[k] = v
}

// ══════════════════════════ OpenAPI 文档后处理 ══════════════════════════

type JsonObject = Record<string, unknown>

/** capabilities.json 结构(只声明本脚本用到的字段)。 */
interface CapabilityManifest {
  capabilities: Array<{
    scope: string
    description?: string
    thirdPartyEligible?: boolean
    dataClass?: string
    routes?: string[]
    /** 归属服务;`ai-service` 的端点不在本契约内,不参与注入/比对。 */
    host?: string
  }>
}

interface ScopeRoute {
  method: string
  path: string
  scope: string
  /** 声明尾部写 `*`(`"POST /api/publish/*"`)—— 整族端点,按前缀匹配。 */
  prefixMatch: boolean
}

/** `"POST /v1/agents/:id/call"` → `{ method:'post', path:'/v1/agents/{id}/call' }`。 */
export function parseCapabilityRoute(entry: string): ScopeRoute | null {
  const m = /^([A-Za-z]+)\s+(\S+)$/.exec(entry.trim())
  if (!m) return null
  const method = m[1].toLowerCase()
  const raw = m[2].startsWith('/') ? m[2] : `/${m[2]}`
  const prefixMatch = raw.endsWith('/*')
  const path = prefixMatch ? raw.slice(0, -2) : raw
  return { method, path: toOpenApiPath(path), scope: '', prefixMatch }
}

/** Fastify 的 `:param` → OpenAPI 的 `{param}`;尾部裸 `*` → `{*}`(与 @fastify/swagger 同形)。 */
export function toOpenApiPath(p: string): string {
  const withBraces = p.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
  return withBraces.endsWith('/*') ? `${withBraces.slice(0, -2)}/{*}` : withBraces
}

/**
 * 读取 scope → 端点 映射(单一事实源:packages/types/generated/capabilities.json)。
 *
 * `host: 'ai-service'` 的条目由 apps/ai-service(FastAPI)提供,不可能出现在本契约里,
 * 因此既不参与 security 注入,也不计入"未命中"清单 —— 归属不同,不是漂移。
 */
export function loadScopeRoutes(repoRootDir: string): {
  routes: ScopeRoute[]
  scopes: Array<{ scope: string; description: string }>
  aiServiceSkipped: string[]
} {
  const file = join(repoRootDir, CAPABILITIES_REL_PATH)
  const raw = JSON.parse(readFileSync(file, 'utf8')) as CapabilityManifest
  const routes: ScopeRoute[] = []
  const scopes: Array<{ scope: string; description: string }> = []
  const aiServiceSkipped: string[] = []
  for (const cap of raw.capabilities ?? []) {
    if (!cap.scope) continue
    scopes.push({ scope: cap.scope, description: cap.description ?? cap.scope })
    const isOtherService = cap.host === AI_SERVICE_HOST
    for (const entry of cap.routes ?? []) {
      const parsed = parseCapabilityRoute(entry)
      if (!parsed) continue
      if (isOtherService) {
        aiServiceSkipped.push(`${parsed.method} ${parsed.path}`)
        continue
      }
      routes.push({ ...parsed, scope: cap.scope })
    }
  }
  return { routes, scopes, aiServiceSkipped }
}

/**
 * 与 server.ts 的 PUBLIC_PREFIXES 同源(函数内常量,不可 import,此处按行号回指)。
 * 见 apps/api/src/server.ts 的 PUBLIC_PREFIXES —— 变更需同步。
 */
const PUBLIC_PATH_PREFIXES = [
  '/api/health',
  '/api/landing',
  '/api/public/',
  '/api/oss/public/',
  '/api/metrics',
  '/business-metrics',
  '/api/csrf-token',
  '/docs',
  '/uploads/',
  '/health',
]

/** 登录/注册等"必须先可达"的入口(带凭据鉴权但无会话)。 */
const ANONYMOUS_ENTRY_PATHS = new Set<string>([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/oauth/authorize',
  '/api/auth/oauth/callback',
  '/api/auth/oauth/apps',
  '/api/auth/2fa/verify',
])

export function isPublicPath(path: string): boolean {
  if (ANONYMOUS_ENTRY_PATHS.has(path)) return true
  return PUBLIC_PATH_PREFIXES.some((p) => path === p || path.startsWith(p))
}

const HTTP_METHODS = ['get', 'put', 'post', 'patch', 'delete', 'head', 'options', 'trace'] as const

/**
 * 公开面(对外开放协议面)前缀:这些前缀下的每个 operation 都必须带显式 `security`
 * 声明 —— 与 `scripts/openapi-check.mjs` 的 GUARDED_PREFIXES 同口径,变更需同步。
 */
const GUARDED_PREFIXES = ['/v1/', '/v1beta'] as const

/** 能力条目归属:ai-service 的端点不会出现在本契约里,跨服务比对据此跳过。 */
const AI_SERVICE_HOST = 'ai-service'

/** `isPublicPath` 之外的公开面 operation:未登记能力目录,但确实要求凭据。 */
export const UNGOVERNED_SECURITY = [{ BearerAuth: [] }, { ApiKeyAuth: [] }] as const

/** 真实路由存在性探针(`server.hasRoute` 的窄化封装,便于测试注入)。 */
export type RouteExists = (method: string, path: string) => boolean

/**
 * OpenAPI 写法 → Fastify 注册写法:`{param}` → `:param`,`{*}` → `*`。
 * `server.hasRoute` 只认 Fastify 形态(实测 `{threadId}` 恒 false,`:任意名` 恒 true,
 * 且**参数名无关** —— 路由树按段类型匹配)。
 */
export function toFastifyPath(p: string): string {
  return p.replace(/\{[A-Za-z0-9_]+\}/g, (m) => ':' + m.slice(1, -1)).replace(/\{\*\}/g, '*')
}

/** 声明的端点模式与契约 path key 是否同形(参数段两侧都视为占位,尾部 `*` 覆盖整族)。 */
export function pathPatternMatches(
  declared: string,
  actual: string,
  prefixMatch: boolean,
): boolean {
  const d = declared.split('/').filter(Boolean)
  const a = actual.split('/').filter(Boolean)
  const dyn = (s: string): boolean => s.startsWith(':') || s.startsWith('{') || s === '*'
  const segEq = (x: string, y: string): boolean => x === y || dyn(x) || dyn(y)
  if (prefixMatch) return a.length >= d.length && d.every((s, i) => segEq(s, a[i]))
  return a.length === d.length && d.every((s, i) => segEq(s, a[i]))
}

/**
 * 还原被 `@fastify/swagger` 剥掉的 server 路径前缀。
 *
 * 机制(实测,非推测):server.ts 以 `openapi.servers = [{url:'/api'},{url:'/api/v1'}]`
 * 注册 swagger,而 @fastify/swagger v9 会把 servers[].url 的**路径段当 basePath 从 paths
 * 里剪掉** —— `/api/health` 在文档里变成 `/health`,`/api/admin/x` 变成 `/admin/x`。
 * 后果:① 契约里的路径无法直接调用(与 printRoutes/真实 URL 不一致);
 * ② 根级 `/health` 与 `/api/health` 撞同一个 key,后者静默覆盖前者。
 *
 * 解法:拿 Fastify 自己的权威路由表当真相源,把文档 key 反查回真实路径。
 * 为什么不是 `onRoute` 钩子:`buildServer()` 内部 `await registerPlugins(server)` 会把
 * avvio 队列就地跑完,路由在导出脚本拿到实例**之前**就已注册(实测钩子捕获 0 条),
 * 而 server.ts 不允许为导出器让路。改用 `server.hasRoute({method,url})`(在 close 之前
 * 探测)—— 同样是 Fastify 权威口径,且不依赖钩子时机。
 * 存在多候选(即被撞 key 的那类)时取**带前缀**的那个:direct 路由(如 buildServer 里的
 * `server.get('/health')`)先注册,`registerRoutes` 的 `/api/health` 后注册并覆盖文档条目,
 * 所以幸存的语义就是带前缀那条。绝不凭空造路径 —— 每个候选都由 hasRoute 确认存在。
 */
export interface RestoreResult {
  renamed: number
  collisions: string[]
  unmatched: string[]
}

/**
 * `restoreRealPaths` 要试的 basePath 清单。
 *
 * **不能**只读 `doc.servers`:@fastify/swagger v9 把 `openapi.servers[].url` 当 basePath
 * 从 paths 里剪掉,并且**不会**把 `servers` 写回 `swagger()` 的产物 —— 于是
 * `doc.servers` 恒空,还原一步都走不到(实测 2026-09-21:改名 0 条 / 未命中 0 条,
 * 产物里 `/api/*` 路径为 0,而 `curl 127.0.0.1:8802/api/health` 真实返回 200)。
 * 与 apps/api/src/server.ts 的 `openapi.servers` 同源 —— 变更需同步
 * (同本文件 PUBLIC_PREFIXES 的处理方式:server.ts 里是函数内常量,不可 import)。
 * 长的排前面,保证 `/api/v1/x` 不会被先按 `/api` 前缀误匹配。
 */
const SWAGGER_BASE_PATHS = ['/api/v1', '/api'] as const

export function restoreRealPaths(doc: JsonObject, routeExists: RouteExists): RestoreResult {
  const paths = (doc.paths ?? {}) as Record<string, JsonObject>
  const docServerPaths = (Array.isArray(doc.servers) ? (doc.servers as JsonObject[]) : [])
    .map((s) => (typeof s?.url === 'string' ? s.url : ''))
    .filter((u) => u.startsWith('/') && u !== '/')
  const serverBasePaths = [...new Set([...docServerPaths, ...SWAGGER_BASE_PATHS])].sort(
    (a, b) => b.length - a.length,
  )

  /** basePath + 文档 key(`/` 直接收敛成 basePath 本身)。 */
  const withBase = (base: string, key: string): string => (key === '/' ? base : `${base}${key}`)

  const collisions: string[] = []
  const unmatched: string[] = []
  const renames: Array<[string, string]> = []
  for (const key of Object.keys(paths)) {
    const item = paths[key] as JsonObject
    const methods = HTTP_METHODS.filter((m) => item?.[m] !== undefined)
    if (methods.length === 0) continue
    const candidates = [key, ...serverBasePaths.map((b) => withBase(b, key))].filter(
      (c, i, arr) => arr.indexOf(c) === i,
    )
    const hits = candidates.filter((c) => methods.some((m) => routeExists(m, toFastifyPath(c))))
    if (hits.length === 0) {
      unmatched.push(key)
      continue
    }
    if (hits.length > 1) collisions.push(`${key} → ${hits.join(' | ')}`)
    const target = hits.find((p) => p !== key) ?? key
    if (target !== key) renames.push([key, target])
  }

  let renamed = 0
  for (const [from, to] of renames) {
    const entry = paths[from]
    if (entry === undefined) continue
    if (paths[to] !== undefined) continue // 目标已存在:不覆盖,保留更权威的那份
    paths[to] = entry
    delete paths[from]
    renamed += 1
  }
  return { renamed, collisions, unmatched }
}

/**
 * 删除 Fastify 自动派生的 HEAD 操作(`exposeHeadRoutes` 默认开启,HEAD 与 GET 同契约)。
 * 只删"path 同时有 GET"的 HEAD —— 显式注册的独立 HEAD 端点保留。
 */
export function dropAutoHeadOperations(doc: JsonObject): number {
  const paths = (doc.paths ?? {}) as Record<string, JsonObject>
  let dropped = 0
  for (const item of Object.values(paths)) {
    if (!item || typeof item !== 'object') continue
    if ((item as JsonObject).get !== undefined && (item as JsonObject).head !== undefined) {
      delete (item as JsonObject).head
      dropped += 1
    }
  }
  return dropped
}

/** servers 归一:paths 已是真实绝对路径后,不能再挂 `/api` 这类 basePath。 */
export function normalizeServers(doc: JsonObject): void {
  doc.servers = [
    {
      url: '/',
      description:
        'same-origin;paths 为 Fastify 真实注册路径(含 /api、/v1、/v1beta 前缀)。运行时文档 /docs/json 因 servers=[{url:"/api"}] 会剪掉 /api 前缀,产物已还原。',
    },
  ]
}

/** 构造 securitySchemes(名称与运行时闸口一致:ihui_ 前缀 API Key / JWT / OAuth2)。 */
export function buildSecuritySchemes(
  scopes: Array<{ scope: string; description: string }>,
): JsonObject {
  const oauthScopes: Record<string, string> = {}
  for (const s of [...scopes].sort((a, b) => a.scope.localeCompare(b.scope))) {
    oauthScopes[s.scope] = s.description
  }
  return {
    ApiKeyAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'ihui_<32hex>',
      description:
        '开发者 API Key:`Authorization: Bearer ihui_xxx`,或 `X-Api-Key: ihui_xxx`。按 key 绑定的 scope 白名单放行。',
    },
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: '用户态访问令牌(JWT),或 `auth_token` Cookie。',
    },
    OAuth2: {
      type: 'oauth2',
      description: 'OAuth2 授权码模式(scope 即能力目录登记的 `scope`)。',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://aizhs.top/oauth/authorize',
          tokenUrl: 'https://aizhs.top/api/auth/oauth/token',
          scopes: oauthScopes,
        },
      },
    },
  }
}

export interface SecurityInjectionResult {
  injected: number
  publicOps: number
  /** 公开面(/v1* /v1beta*)里未登记进能力目录、只声明"要凭据"的 operation。 */
  ungoverned: string[]
  unmatched: string[]
  totalOperations: number
}

/** 就地注入每个 operation 的 `security`;返回统计供日志/门禁核对。 */
export function injectSecurity(doc: JsonObject, routes: ScopeRoute[]): SecurityInjectionResult {
  const paths = (doc.paths ?? {}) as Record<string, JsonObject>
  /**
   * 声明与契约 key 的匹配一律走 `pathPatternMatches`(参数名无关 + 尾部 `*` 覆盖整族):
   * 能力目录写 `GET /v1/threads/:id/messages`,Fastify 实注册 `/v1/threads/:threadId/messages`,
   * 逐字符比对会把已登记的端点误判成"未命中"(O8b 前的假漂移来源之一)。
   */
  const scopesOf = (method: string, pathKey: string): string[] => {
    const found = new Set<string>()
    for (const r of routes) {
      if (r.method !== method && !(r.method === 'ws' && method === 'get')) continue
      if (pathPatternMatches(r.path, pathKey, r.prefixMatch)) found.add(r.scope)
    }
    return [...found].sort()
  }
  const guarded = (pathKey: string): boolean =>
    pathKey === '/v1' ||
    pathKey === '/v1beta' ||
    GUARDED_PREFIXES.some((p) => pathKey.startsWith(p))

  let injected = 0
  let publicOps = 0
  let totalOperations = 0
  const ungoverned: string[] = []
  const matched = new Set<string>()
  /** 能力清单里登记了、但文档中没有任何端点与之同形匹配的条目(= 真实目录腐化)。 */
  const unmatched: string[] = []

  for (const [pathKey, item] of Object.entries(paths)) {
    if (!item || typeof item !== 'object') continue
    for (const method of HTTP_METHODS) {
      const op = item[method]
      if (!op || typeof op !== 'object') continue
      totalOperations += 1
      if (isPublicPath(pathKey)) {
        ;(op as JsonObject).security = []
        publicOps += 1
        continue
      }
      const scopes = scopesOf(method, pathKey)
      if (scopes.length > 0) {
        ;(op as JsonObject).security = [{ BearerAuth: [] }, { ApiKeyAuth: [] }, { OAuth2: scopes }]
        injected += 1
        for (const r of routes) {
          if (r.method !== method && !(r.method === 'ws' && method === 'get')) continue
          if (pathPatternMatches(r.path, pathKey, r.prefixMatch))
            matched.add(`${r.method} ${r.path}`)
        }
      } else if (guarded(pathKey)) {
        // 公开面上未登记能力目录的端点:仍然要求凭据(/v1* 由 api-key / JWT 闸口把守),
        // 但没有可声明的 scope。显式写出来 + 计入 `ungoverned` 清单打印,不静默。
        ;(op as JsonObject).security = UNGOVERNED_SECURITY.map((s) => ({ ...s }))
        ungoverned.push(`${method} ${pathKey}`)
      }
    }
  }
  for (const r of routes) {
    const key = `${r.method} ${r.path}`
    if (!matched.has(key) && !unmatchedRouteIsExpected(r)) unmatched.push(key)
  }
  return { injected, publicOps, ungoverned: ungoverned.sort(), unmatched, totalOperations }
}

/** `WS` 声明落在 OpenAPI 3.0 里必然无对应(HTTP 契约不描述 WS),不算漂移。 */
function unmatchedRouteIsExpected(r: ScopeRoute): boolean {
  return r.method === 'ws'
}

/** 稳定化:paths / operations / components.schemas 排序,消除生成抖动。 */
export function stabilizeDocument(doc: JsonObject): JsonObject {
  const paths = (doc.paths ?? {}) as Record<string, JsonObject>
  const sortedPaths: JsonObject = {}
  for (const pathKey of Object.keys(paths).sort()) {
    const item = paths[pathKey]
    const sortedItem: JsonObject = {}
    for (const key of Object.keys(item).sort()) {
      if (key === 'parameters') {
        sortedItem[key] = Array.isArray(item[key])
          ? [...(item[key] as JsonObject[])].sort((a, b) =>
              `${a?.name}:${a?.in}`.localeCompare(`${b?.name}:${b?.in}`),
            )
          : item[key]
        continue
      }
      if (!HTTP_METHODS.includes(key as (typeof HTTP_METHODS)[number])) continue
      const op = item[key] as JsonObject
      const orderedOp: JsonObject = {}
      for (const opKey of Object.keys(op).sort()) {
        if (opKey === 'tags' && Array.isArray(op[opKey])) {
          orderedOp[opKey] = [...(op[opKey] as string[])].sort()
          continue
        }
        orderedOp[opKey] = op[opKey]
      }
      sortedItem[key] = orderedOp
    }
    for (const key of Object.keys(item).sort()) {
      if (key === 'parameters' || !HTTP_METHODS.includes(key as (typeof HTTP_METHODS)[number])) {
        sortedItem[key] = item[key]
      }
    }
    sortedPaths[pathKey] = sortedItem
  }

  const components = { ...(doc.components ?? {}) } as JsonObject
  if (components.schemas && typeof components.schemas === 'object') {
    const schemas = components.schemas as Record<string, unknown>
    const sortedSchemas: JsonObject = {}
    for (const k of Object.keys(schemas).sort()) sortedSchemas[k] = schemas[k]
    components.schemas = sortedSchemas
  }

  const out: JsonObject = {}
  out.openapi = typeof doc.openapi === 'string' ? doc.openapi : '3.0.3'
  out.info = doc.info
  if (doc.externalDocs !== undefined) out.externalDocs = doc.externalDocs
  if (doc.servers !== undefined) out.servers = doc.servers
  if (Array.isArray(doc.tags)) out.tags = doc.tags
  out.security = doc.security ?? [{ BearerAuth: [] }]
  out.paths = sortedPaths
  out.components = components
  return out
}

/** 剔除 Swagger UI / 静态资源等文档自身的噪音路由。 */
export function dropInternalRoutes(doc: JsonObject): number {
  const paths = (doc.paths ?? {}) as Record<string, unknown>
  let dropped = 0
  for (const key of Object.keys(paths)) {
    if (key === '/documentation' || key.startsWith('/documentation/') || key === '/docs/json') {
      delete paths[key]
      dropped += 1
    }
  }
  return dropped
}

/** 统计 `/v1*` 端点的"契约覆盖率":声明了请求侧或响应侧 schema 才算覆盖。 */
export interface CoverageStats {
  operations: number
  withRequestSchema: number
  withResponseSchema: number
  withAnySchema: number
  coveragePercent: number
}

export function computeCoverage(doc: JsonObject, prefix = '/v1'): CoverageStats {
  const paths = (doc.paths ?? {}) as Record<string, JsonObject>
  let operations = 0
  let withRequestSchema = 0
  let withResponseSchema = 0
  let withAnySchema = 0
  for (const [pathKey, item] of Object.entries(paths)) {
    if (!pathKey.startsWith(prefix)) continue
    for (const method of HTTP_METHODS) {
      const op = item?.[method]
      if (!op || typeof op !== 'object') continue
      operations += 1
      const req = hasSchema((op as JsonObject).requestBody)
      const res = responseHasSchema((op as JsonObject).responses)
      if (req) withRequestSchema += 1
      if (res) withResponseSchema += 1
      if (req || res) withAnySchema += 1
    }
  }
  return {
    operations,
    withRequestSchema,
    withResponseSchema,
    withAnySchema,
    coveragePercent: operations === 0 ? 0 : Math.round((withAnySchema / operations) * 1000) / 10,
  }
}

function hasSchema(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  const content = (node as JsonObject).content
  if (!content || typeof content !== 'object') return false
  return Object.values(content as Record<string, unknown>).some(
    (media) => !!media && typeof media === 'object' && (media as JsonObject).schema !== undefined,
  )
}

function responseHasSchema(responses: unknown): boolean {
  if (!responses || typeof responses !== 'object') return false
  return Object.values(responses as Record<string, unknown>).some((r) => hasSchema(r))
}

// ════════════════════════════════ 主流程 ════════════════════════════════

export interface ExportResult {
  doc: JsonObject
  coverage: CoverageStats
  security: SecurityInjectionResult
  /** 被删掉的 Fastify 自动派生 HEAD 操作数。 */
  autoHeadDropped: number
  /** `/api` 前缀还原统计(改名 / 多候选 / 未命中)。 */
  restored: RestoreResult
  /** 参与本契约比对的能力端点数(不含 ai-service 归属)。 */
  governedRoutes: number
  /** 标了 `host: 'ai-service'` 因而**不属于**本契约的端点(归属不同,不是漂移)。 */
  aiServiceSkipped: string[]
}

/** 生成最终文档(不含写盘),供测试直接断言。 */
export async function generateOpenApiDocument(): Promise<ExportResult> {
  applyDeterministicEnv()
  installInfraStubs()
  // 桩装好后才拉起真实启动图(动态 import,避免钩子未生效)
  const { buildServer } = (await import('../src/server.js')) as {
    buildServer: () => Promise<FastifyInstance>
  }
  const server = await buildServer()
  let raw: unknown
  let restored: RestoreResult = { renamed: 0, collisions: [], unmatched: [] }
  let autoHeadDropped = 0
  const doc: JsonObject = {}
  try {
    await server.ready()
    if (typeof (server as unknown as { swagger?: () => unknown }).swagger !== 'function') {
      throw new Error(
        'server.swagger() 不可用:@fastify/swagger 未注册。请确认 NODE_ENV!=production 或 SWAGGER_ENABLED=true',
      )
    }
    raw = (server as unknown as { swagger: () => unknown }).swagger()
    Object.assign(doc, JSON.parse(JSON.stringify(raw)) as JsonObject)
    dropInternalRoutes(doc)
    autoHeadDropped = dropAutoHeadOperations(doc)
    /**
     * 前缀还原必须在 `close()` 之前做 —— 它要靠 `server.hasRoute` 探真实注册路径。
     * 探针返回 false 只可能是"该 path+method 未注册",绝不会被凭空造出来。
     */
    restored = restoreRealPaths(doc, (method, url) =>
      server.hasRoute({ method: method.toUpperCase(), url }),
    )
    normalizeServers(doc)
  } finally {
    await server.close().catch(() => undefined)
  }

  const components = { ...(doc.components ?? {}) } as JsonObject
  const { routes, scopes, aiServiceSkipped } = loadScopeRoutes(repoRoot)
  components.securitySchemes = buildSecuritySchemes(scopes)
  doc.components = components

  const security = injectSecurity(doc, routes)
  const stable = stabilizeDocument(doc)
  const coverage = computeCoverage(stable, '/v1')
  return {
    doc: stable,
    coverage,
    security,
    autoHeadDropped,
    restored,
    governedRoutes: routes.length,
    aiServiceSkipped,
  }
}

async function run(argv: string[]): Promise<number> {
  const outIdx = argv.indexOf('--out')
  // 相对 --out 一律按仓库根解析:本脚本由 `pnpm --filter @ihui/api exec` 调起时 cwd 是 apps/api,
  // 若按 cwd 解析,CI 的 openapi:check-drift 会把产物写进 apps/api/.ihui-agent/ 而第二步从仓库根去找它,门禁用不起来。
  const outFile = outIdx >= 0 && argv[outIdx + 1] ? resolve(repoRoot, argv[outIdx + 1]!) : null
  const toStdout = argv.includes('--stdout')
  const quiet = argv.includes('--quiet')
  const log = (...args: unknown[]): void => {
    if (!quiet) console.log(...args)
  }

  if (outIdx >= 0 && !outFile) {
    console.error('[openapi:export] ✗ --out 需要一个路径参数')
    return 1
  }

  const target = outFile ?? join(repoRoot, ARTIFACT_REL_PATH)
  log(`[openapi:export] 启动真实 Fastify 图(不监听端口、不连 PG、不连 Redis)…`)

  const { doc, coverage, security, autoHeadDropped, restored } = await generateOpenApiDocument()
  const json = `${JSON.stringify(doc, null, 2)}\n`
  const paths = Object.keys((doc.paths ?? {}) as Record<string, unknown>).length
  if (paths === 0) {
    console.error('[openapi:export] ✗ 生成的 paths 为空,判定失败')
    return 1
  }
  /**
   * 还原未生效的**签名**就一条:产物里没有任何 `/api/*` 路径(而 `/api/*` 是真实注册的)。
   * 历史上正是因为 `doc.servers` 恒空(见 SWAGGER_BASE_PATHS 注释)导致这一步静默变成
   * no-op,产出一份"路径没法直接调用"的契约还全绿。宁可失败也不要静默产出错的契约。
   */
  if (
    restored.renamed === 0 &&
    !Object.keys((doc.paths ?? {}) as object).some((p) => p.startsWith('/api'))
  ) {
    console.error(
      '[openapi:export] ✗ 前缀还原未生效:0 条改名且产物里没有 /api/* 路径。' +
        '多半是 basePath 清单与 apps/api/src/server.ts 的 openapi.servers 脱节 —— 检查 SWAGGER_BASE_PATHS。',
    )
    return 1
  }
  if (toStdout) {
    process.stdout.write(json)
  } else {
    /** `--out` 可以指向尚不存在的目录(CI 里 `.ihui-agent/tmp/` 就是干净的),
     *  否则 writeFileSync 直接 ENOENT,漂移门禁在 CI 上永远跑不到比对那一步。 */
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, json, 'utf8')
  }
  const bytes = Buffer.byteLength(json, 'utf8')
  log(`[openapi:export] path ${paths} 个 / operation ${security.totalOperations} 个`)
  log(
    `[openapi:export] 路径还原:改名 ${restored.renamed} 条,多候选展开 ${restored.collisions.length} 条,未捕获保留 ${restored.unmatched.length} 条;删除自动 HEAD ${autoHeadDropped} 条`,
  )
  log(
    `[openapi:export] security 注入:${security.injected} 个 operation 带 scope,${security.publicOps} 个显式公开` +
      (security.unmatched.length > 0
        ? `,${security.unmatched.length} 个能力清单端点在文档中未命中`
        : ''),
  )
  for (const u of security.unmatched.slice(0, 20)) log(`[openapi:export]   · 未命中 ${u}`)
  if (security.unmatched.length > 20) {
    log(`[openapi:export]   · 其余 ${security.unmatched.length - 20} 条省略`)
  }
  log(
    `[openapi:export] /v1* schema 覆盖率:${coverage.withAnySchema}/${coverage.operations} (${coverage.coveragePercent}%)`,
  )
  if (!toStdout) {
    log(`[openapi:export] ✓ 已写出 ${target}(${(bytes / 1024).toFixed(1)} KB)`)
    injectWatermark(target)
  }
  return 0
}

/** 溯源水印注入(JSON 属 skip-type,失败不阻断产物生成)。 */
function injectWatermark(file: string): void {
  if (!existsSync(file)) return
  try {
    execFileSync(process.execPath, [join(repoRoot, 'scripts', 'watermark.mjs'), 'inject', file], {
      stdio: 'pipe',
      windowsHide: true,
    })
  } catch {
    console.log('[openapi:export] 提示:产物为 JSON,水印工具按类型跳过(非覆盖范围)')
  }
}

export const __test__ = {
  normalizeStubKey,
  buildDbStubSource,
  applyDeterministicEnv,
  installInfraStubs,
  parseCapabilityRoute,
  toOpenApiPath,
  loadScopeRoutes,
  buildSecuritySchemes,
  injectSecurity,
  stabilizeDocument,
  dropInternalRoutes,
  computeCoverage,
  isPublicPath,
  ARTIFACT_REL_PATH,
  CAPABILITIES_REL_PATH,
}

// AGENTS.md §22d:CLI 直跑与测试 import 双形态隔离,避免 import 即拉起整个启动图。
const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  // 启动图里仍可能有 unref 不掉的定时器(响应缓存 / 保活探针等),跑完必须显式退出,
  // 否则脚本拿到结果也不落终态,CI 会挂到 timeout。
  run(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[openapi:export] ✗ 生成失败: ${message}`)
      if (err instanceof Error && err.stack) console.error(err.stack)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
