// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一调用主体(Principal)—— O4「数据作用域机械层」的身份入口。
 *
 * 解决的问题:此前三类凭据(JWT 人 / API Key 机器 / internal service token)
 * 各自把结果散写进 `request.userId` / `request.jwtPayload` / `request.apiKey` /
 * `request.internalUserRoleId`,下游没有任何单一位置能回答两件事:
 *   ①「这次调用是谁」 ②「这次调用被授权做什么(dataClass → DB 访问模式)」。
 * 于是"对第三方开放功能但不开放数据"没有机械支点,只能靠每个路由自觉写 where。
 *
 * 本文件把三者归一为 `request.principal`,并把它放进 AsyncLocalStorage,
 * 供 utils/scoped-guard.ts 的 DB 数据闸消费(`dbScoped()` 出口自动判定)。
 *
 * 关键设计 —— **惰性求值(lazy)**:
 * Fastify 的根级 `preHandler` 钩子跑在路由自身 preHandler(**鉴权**)之前,
 * 而 `onRequest` 更早;因此在钩子里直接读 `request.userId` 必然为空
 * —— 这正是旧 rls-context.ts 的失效根因(见该文件注释)。
 * 这里改为:`onRequest` 只把 `principal` 定义成**取值时才计算**的 getter,
 * 并 `AsyncLocalStorage.run(store, () => next())` 包住后续整条生命周期。
 * 于是任何在鉴权完成之后(路由 preHandler / handler / service)读取
 * `request.principal` 或 `currentPrincipal()` 的地方,拿到的都是**鉴权后真值**,
 * 无需修改 plugins/auth.ts 与 plugins/api-key-auth.ts(二者零改动)。
 *
 * 零回归:未挂 capability 的调用链 `principal` 只是多了一个只读视图,
 * 不产生任何 DB 查询、不改变响应;数据闸只在
 * `capability 已注入 && kind === 'apiKey'` 时才启动(见 scoped-guard.ts)。
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { ApiKeyPermission, CapabilityEntry } from '@ihui/types'

/** 调用主体类别。machine = 第三方/自有机器凭据。 */
export const PRINCIPAL_KINDS = ['jwt', 'apiKey', 'internal'] as const
export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number]

/** 归一后的调用主体。 */
export interface Principal {
  /** apiKey = 机器凭据(受数据闸约束);jwt = 人;internal = 内部服务令牌。 */
  kind: PrincipalKind
  /** 归属用户 ID:apiKey 取其绑定的 userId(机器凭据不得脱离归属用户持有数据)。 */
  subjectId: string
  /** 数值角色(1=管理员)。API Key 无角色概念 → 恒 0(最小权限,不做任何提权)。 */
  roleId: number
  /** 机器凭据 ID(审计与限流窗口维度)。 */
  apiKeyId?: string
  /** 凭据被授予的 scope 清单(人/internal 无此概念 → 空数组)。 */
  scopes: readonly ApiKeyPermission[]
  /** 命中的能力声明(由 utils/capability-guard.ts 注入);缺失 = 不受数据闸约束。 */
  capability?: CapabilityEntry
}

declare module 'fastify' {
  interface FastifyRequest {
    /** 归一调用主体;由本插件在 onRequest 定义为惰性 getter,鉴权完成后读取即为真值。 */
    principal?: Principal
  }
}

/** internal service token 的头名(与 plugins/internal-service-token.ts 保持一致,不 import 以免拉起其 DB 依赖)。 */
const INTERNAL_TOKEN_HEADER = 'x-internal-service-token'

/**
 * 兼容三种 permissions 形态:数组(正常)/ 对象(历史 seed 误用 `{permissions:[...]}`)/ null。
 * 与 capability-guard.ts `grantedPermissions` 同源语义,此处独立实现避免反向依赖路由侧文件。
 */
function normalisePermissions(raw: unknown): readonly ApiKeyPermission[] {
  if (Array.isArray(raw)) return raw as readonly ApiKeyPermission[]
  const nested = (raw as { permissions?: unknown } | undefined)?.permissions
  if (Array.isArray(nested)) return nested as readonly ApiKeyPermission[]
  return []
}

/**
 * 从请求当前状态组装 principal。可在任意生命周期阶段调用:
 * 鉴权前调用返回 undefined(没有任何凭据字段),鉴权后调用返回完整主体。
 *
 * 优先级:apiKey > jwt > internal。
 * 同时持有 JWT 与 API Key 时按 **apiKey** 计 —— 取更严格的一侧,
 * 防止"人带着 key 打同一个端点"绕过机器侧数据闸。
 */
export function buildPrincipal(request: FastifyRequest): Principal | undefined {
  const capability = request.capability
  const apiKey = request.apiKey

  if (apiKey?.userId) {
    return {
      kind: 'apiKey',
      subjectId: apiKey.userId,
      roleId: 0,
      apiKeyId: apiKey.id,
      scopes: normalisePermissions(apiKey.permissions),
      ...(capability ? { capability } : {}),
    }
  }

  const jwtPayload = request.jwtPayload
  if (jwtPayload?.userId) {
    return {
      kind: 'jwt',
      subjectId: jwtPayload.userId,
      roleId: jwtPayload.roleId ?? 0,
      scopes: [],
      ...(capability ? { capability } : {}),
    }
  }

  const userId = request.userId
  if (!userId) return undefined

  // userId 已注入但无 jwtPayload:internal service token 链路(或自定义鉴权中间件)。
  const viaInternalHeader = typeof request.headers[INTERNAL_TOKEN_HEADER] === 'string'
  return {
    kind: viaInternalHeader ? 'internal' : 'jwt',
    subjectId: userId,
    roleId: request.internalUserRoleId ?? 0,
    scopes: [],
    ...(capability ? { capability } : {}),
  }
}

// ============================================================================
// AsyncLocalStorage:把"当前请求的调用主体"透传到无 request 参数的深层调用
// (service / repository 层的 dbScoped() 查询)。
// ============================================================================

/** ALS 载体:优先持有 request(惰性求值),也允许直接注入 principal(测试/后台任务)。 */
export interface PrincipalScopeStore {
  request?: FastifyRequest
  principal?: Principal
}

const principalScope = new AsyncLocalStorage<PrincipalScopeStore>()

/** 当前请求主体上下文(未进入钩子/未 runWith 时为 undefined)。 */
export function currentPrincipalScope(): PrincipalScopeStore | undefined {
  return principalScope.getStore()
}

/** 当前调用主体;不在上下文内返回 undefined。 */
export function currentPrincipal(): Principal | undefined {
  const store = principalScope.getStore()
  if (!store) return undefined
  return store.principal ?? store.request?.principal
}

/**
 * 在指定主体上下文内执行 `fn`(同步进入,`await` 与否皆可)。
 * 供非 HTTP 入口(MCP 工具执行器、worker、测试)显式声明"这次查询代表谁"。
 */
export function runWithPrincipal<T>(principal: Principal, fn: () => T): T {
  return principalScope.run({ principal }, fn)
}

/** 在指定请求上下文内执行 `fn`(等价于插件钩子行为,测试用)。 */
export function runWithRequestScope<T>(request: FastifyRequest, fn: () => T): T {
  return principalScope.run({ request }, fn)
}

/**
 * 把 `request.principal` 换成惰性 getter(可写:setter 允许显式覆盖)。
 * 每个请求只做一次属性定义,零 DB 开销。
 */
function defineLazyPrincipal(request: FastifyRequest): void {
  let explicit: Principal | undefined
  let computed: Principal | undefined
  let computedOnce = false
  Object.defineProperty(request, 'principal', {
    configurable: true,
    enumerable: true,
    get(): Principal | undefined {
      if (explicit !== undefined) return explicit
      // 鉴权完成前算出的 undefined 不缓存:preHandler/handler 阶段才是有效读数时机
      if (!computedOnce) {
        computed = buildPrincipal(request)
        if (computed) computedOnce = true
      }
      return computed
    },
    set(value: Principal | undefined) {
      explicit = value
      computedOnce = false
    },
  })
}

const principalPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.decorateRequest('principal', undefined)

  // 回调式钩子:必须在 run(...) 内部调用 next(),否则 ALS 上下文不会
  // 延续到后续 preHandler/handler(Fastify 官方 AsyncLocalStorage 范式)。
  server.addHook('onRequest', (request: FastifyRequest, _reply, next) => {
    defineLazyPrincipal(request)
    principalScope.run({ request }, () => next())
  })
}

export default fp(principalPlugin, {
  name: 'principal-plugin',
  fastify: '5.x',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
