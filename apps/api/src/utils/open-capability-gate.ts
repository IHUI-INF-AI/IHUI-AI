// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O6 开放能力闸 —— 按 `config/open-capability-registry.ts` 逐条放行 `/api` 业务面。
 *
 * 两个消费形态:
 * 1. {@link openCapabilityGateway} 注册在 `registerRoutes` 顶部的**根级 preHandler**。
 *    它跑在所有路由自身鉴权之前(Fastify 同层级钩子按加入顺序执行,根级先于子级),
 *    因此能在 `authenticate()` 把「只有 API Key」的请求判成 401 之前完成机器鉴权。
 *    - 未携带机器凭据 → 直接 return,一行都不做,**存量 `/api` 行为零变化**;
 *    - 携带 API Key 且命中登记表 → 鉴权 + 授权 + 绑定归属人 + 注入 `request.capability`;
 *    - 携带 API Key 但**不在登记表** → 同样直接 return(默认拒绝),端点自身照旧 401,
 *      不新增任何可达面,也不通过错误码差异泄露"哪些路径已开放"。
 * 2. {@link requireOpenCapability} 端点级 preHandler:机器通道强制 scope,人通道维持原样。
 *    用于收口 `declareCapability` 那类"登记但不强制"的遗留族。
 *
 * 与 O4 数据闸的接缝:本闸只负责"能不能进这道门",进来后 `request.apiKey` +
 * `request.capability` 双双就位,`utils/scoped-guard.ts` 的 `isDataScopeEnforced`
 * (判据 `principal.kind === 'apiKey' && capability`)即自动接管数据面。
 */
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import { requireApiKeyAuth } from '../plugins/api-key-auth.js'
import { hasApiKeyCredential, requireCapability } from './capability-guard.js'
import { hasHumanJwtCredential } from '../plugins/auth.js'
import {
  findOpenCapability,
  grantOf,
  type OpenCapabilityEntry,
  type OpenCapabilityKey,
} from '../config/open-capability-registry.js'

/** scope 强制闸:按条目惰性构造(`requireCapability` 工厂在构造期即校验 scope 已登记)。 */
const capabilityGuards = new Map<OpenCapabilityKey, preHandlerAsyncHookHandler>()

function capabilityGuardOf(entry: OpenCapabilityEntry): preHandlerAsyncHookHandler {
  const cached = capabilityGuards.get(entry.key)
  if (cached) return cached
  const guard = requireCapability(entry.scope)
  capabilityGuards.set(entry.key, guard)
  return guard
}

/** 去掉 query 的请求路径。 */
function urlPath(url: string): string {
  return url.split('?')[0] ?? ''
}

/** 绑定机器凭据的归属人:机器调用不得脱离归属用户持有数据(与 O4 principal.subjectId 同源)。 */
function bindKeyOwner(request: FastifyRequest, entry: OpenCapabilityEntry): void {
  const apiKey = request.apiKey
  if (!apiKey?.userId) return
  request.userId = apiKey.userId
  request.openCapability = grantOf(entry)
}

/**
 * 根级 preHandler:`/api` 面的机器凭据入口闸。见文件头三条行为定义。
 */
export const openCapabilityGateway: preHandlerAsyncHookHandler = async (request, reply) => {
  if (request.openCapability) return
  // 人凭据优先:同时带 JWT 与 key 时按"人"走原路径,存量登录态语义逐字节不变。
  if (hasHumanJwtCredential(request) || !hasApiKeyCredential(request)) return

  const entry = findOpenCapability(request.method, urlPath(request.url))
  if (!entry) return

  // 完整机器鉴权链路(状态/过期/IP ACL/secret/配额/限流窗口),与 /v1 面同源。
  await requireApiKeyAuth.call(request.server, request, reply)
  if (reply.sent) return

  // 目录语义 + key 授予面:platform / thirdPartyEligible=false / 未授予 scope → 403。
  await capabilityGuardOf(entry).call(request.server, request, reply)
  if (reply.sent) return

  bindKeyOwner(request, entry)
}

/**
 * 端点级双通道闸(遗留「只登记不强制」族收口用)。
 *
 * @param apiKeyGate 机器通道闸,传 `requireCapabilityRules(openCapabilityRules('<key>'))`
 *                   —— 规则表由登记表派生,路由文件不再自持 path→scope 映射。
 *
 * 行为:
 * - `request.apiKey` 已注入(机器通道)→ 强制 scope;登记表里没有这条 (方法, 路径)
 *   时 `requireCapabilityRules` 直接 403 `CAPABILITY_UNREGISTERED`(默认拒绝),
 *   所以往这些文件里新增端点而忘记登记,结果是被拒而不是静默开放。
 * - 只有 `request.userId`(人 JWT,上游 `authenticate()` 已放行)→ 补齐
 *   `request.capability` 供审计归因(与收口前 `declareCapability` 的形态一致),
 *   不做任何 scope 强制。
 * - 两者皆无 → 401,与今天一致。
 */
export function requireOpenCapability(
  apiKeyGate: preHandlerAsyncHookHandler,
): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const entry = findOpenCapability(request.method, urlPath(request.url))
    if (request.apiKey) {
      await apiKeyGate.call(request.server, request, reply)
      if (reply.sent) return
      if (entry) request.openCapability = grantOf(entry)
      return
    }
    if (request.userId) {
      if (entry) request.capability = entry.capability
      return
    }
    await reply.status(401).send({ code: 401, message: 'Authentication required' })
  }
}
