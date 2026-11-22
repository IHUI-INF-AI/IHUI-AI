// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 端内能力应用路由(2026-11-13 立)
 *
 * 定位:AI 生成的应用 = 一份声明式 AppSpec,落库即生效;Web 端直接把它渲染进真实界面。
 *  - 零迁移:复用 user_preferences(group='capability_app',key=应用 id,value=记录 JSON)
 *  - 校验在服务端**重跑一次**共享校验器(客户端直连会绕过前端校验,不能只信前端)
 *  - 只做 CRUD;运行时渲染在 Web 侧,本路由不执行任何应用内容
 *
 * 端点:
 *  - GET    /            当前用户全部应用(未登录返回空 + authenticated=false)
 *  - GET    /:id         单个应用
 *  - PUT    /:id         新建/覆盖(先校验,再按用户配额判新增)
 *  - DELETE /:id         删除
 *  - POST   /:id/invoke  执行一次**只读**白名单能力(应用必须已在 spec 里声明该能力)
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  CAPABILITY_APP_ID_RE,
  CAPABILITY_APP_LIMITS,
  collectDeclaredCalls,
  parseCapabilityAppRecord,
  validateCapabilityApp,
  type CapabilityAppInvokeResult,
  type CapabilityAppListResponse,
  type CapabilityAppRecord,
} from '@ihui/types'
import { authenticate, checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  findUserPreferences,
  upsertUserPreference,
  deleteUserPreference,
  USER_PREFERENCE_GROUPS,
} from '../db/user-preferences-queries.js'
import { invokeCapabilityAppCall } from '../services/capability-app-actions.js'

const APP_GROUP = USER_PREFERENCE_GROUPS.capabilityApp

const appIdParam = z.object({
  id: z.string().regex(CAPABILITY_APP_ID_RE, 'Invalid app id'),
})

const invokeBody = z.object({
  call: z.string().min(1).max(64),
  args: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

export const capabilityAppsRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // GET / — 当前用户全部应用
  // -------------------------------------------------------------------------
  server.get('/', async (request, reply) => {
    let userId: string | undefined
    try {
      await authenticate(request)
      userId = request.userId
    } catch {
      // 未登录:返回空清单,前端据此隐藏操作
    }
    if (!userId) {
      const body: CapabilityAppListResponse = { apps: [], authenticated: false }
      return reply.send(success(body))
    }

    const { list } = await findUserPreferences(userId, APP_GROUP)
    const apps: CapabilityAppRecord[] = []
    for (const row of list) {
      const record = parseCapabilityAppRecord(row.value)
      if (record) apps.push(record)
    }
    apps.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const body: CapabilityAppListResponse = { apps, authenticated: true }
    return reply.send(success(body))
  })

  // -------------------------------------------------------------------------
  // GET /:id — 单个应用
  // -------------------------------------------------------------------------
  server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const params = appIdParam.safeParse(request.params)
    if (!params.success) return reply.status(400).send(error(400, 'Invalid app id'))

    const { list } = await findUserPreferences(userId, APP_GROUP)
    const row = list.find((item) => item.key === params.data.id)
    const record = parseCapabilityAppRecord(row?.value ?? null)
    if (!record) return reply.status(404).send(error(404, 'App not found'))
    return reply.send(success({ app: record }))
  })

  // -------------------------------------------------------------------------
  // PUT /:id — 新建/覆盖
  // -------------------------------------------------------------------------
  server.put<{ Params: { id: string }; Body: unknown }>(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
      if (!(await checkAuth(request, reply))) return
      const userId = request.userId!
      const params = appIdParam.safeParse(request.params)
      if (!params.success) return reply.status(400).send(error(400, 'Invalid app id'))

      const validation = validateCapabilityApp(request.body, { expectedId: params.data.id })
      if (!validation.ok) {
        // 逐字段问题在客户端用共享校验器先行展示;服务端回执带上前 3 条,便于直连调试定位。
        const summary = validation.errors
          .slice(0, 3)
          .map((item) => `${item.path}: ${item.message}`)
          .join('; ')
        return reply
          .status(400)
          .send(error(400, `应用定义校验失败 — ${summary}`, 'INVALID_CAPABILITY_APP'))
      }

      const { list } = await findUserPreferences(userId, APP_GROUP)
      const existing = list.find((item) => item.key === params.data.id)
      if (!existing && list.length >= CAPABILITY_APP_LIMITS.maxAppsPerUser) {
        return reply
          .status(409)
          .send(
            error(
              409,
              `应用数量已达上限(${CAPABILITY_APP_LIMITS.maxAppsPerUser} 个),请先删除不再使用的应用`,
            ),
          )
      }

      const now = new Date().toISOString()
      const previous = parseCapabilityAppRecord(existing?.value ?? null)
      const record: CapabilityAppRecord = {
        ...validation.value,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      }

      await upsertUserPreference(userId, APP_GROUP, record.id, JSON.stringify(record))
      return reply.send(success({ app: record }))
    },
  )

  // -------------------------------------------------------------------------
  // DELETE /:id
  // -------------------------------------------------------------------------
  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const params = appIdParam.safeParse(request.params)
    if (!params.success) return reply.status(400).send(error(400, 'Invalid app id'))

    await deleteUserPreference(userId, APP_GROUP, params.data.id)
    return reply.send(success({ id: params.data.id, removed: true as const }))
  })

  // -------------------------------------------------------------------------
  // POST /:id/invoke — 执行一次只读白名单能力
  //
  // 三道闸门,缺一不可:
  //  1) 登录 + 应用归属本人(userId 来自鉴权,不来自请求体)
  //  2) 应用已声明该能力(capability scoping):白名单里有 ≠ 这个应用能用
  //  3) 参数按共享元数据强校验(客户端可绕过,所以服务端必跑)
  // 每次执行落一条结构化日志,供审计与慢调用排查。
  // -------------------------------------------------------------------------
  server.post<{ Params: { id: string }; Body: unknown }>(
    '/:id/invoke',
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
      if (!(await checkAuth(request, reply))) return
      const userId = request.userId!
      const params = appIdParam.safeParse(request.params)
      if (!params.success) return reply.status(400).send(error(400, 'Invalid app id'))
      const body = invokeBody.safeParse(request.body)
      if (!body.success) {
        return reply
          .status(400)
          .send(error(400, '调用请求体不合法(call 必填,args 只接受标量)', 'INVALID_INVOKE_BODY'))
      }

      const { list } = await findUserPreferences(userId, APP_GROUP)
      const row = list.find((item) => item.key === params.data.id)
      const record = parseCapabilityAppRecord(row?.value ?? null)
      if (!record) return reply.status(404).send(error(404, 'App not found'))

      const outcome = await invokeCapabilityAppCall({
        userId,
        call: body.data.call,
        args: body.data.args,
        declaration: collectDeclaredCalls(record.spec),
      })

      if (!outcome.ok) {
        request.log.warn(
          {
            appId: record.id,
            call: body.data.call,
            code: outcome.failure.code,
          },
          'capability-app invoke rejected',
        )
        const status = outcome.failure.code === 'invalid_args' ? 400 : 403
        return reply
          .status(status)
          .send(error(status, outcome.failure.message, outcome.failure.code.toUpperCase()))
      }

      request.log.info(
        {
          appId: record.id,
          call: body.data.call,
          elapsedMs: outcome.elapsedMs,
        },
        'capability-app invoke',
      )

      const payload: CapabilityAppInvokeResult = {
        call: body.data.call as CapabilityAppInvokeResult['call'],
        result: outcome.result,
        elapsedMs: outcome.elapsedMs,
      }
      return reply.send(success(payload))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
