// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 能力应用 · 只读能力运行时(2026-11-13 立)
 *
 * 这是「插件包运行时」的**服务端执行面**:应用只声明能力名与参数,实现留在这里。
 * 与 DSH 的 `contributes.tools` 的差别,也是我们刻意选择的超越轴:
 *
 *  1) **没有第三方代码进宿主进程**。DSH 的插件包携带可执行实现,安装即获得宿主同等信任;
 *     这里的 handler 全部由我们编写,应用只是"点名 + 传参"。
 *  2) **用户作用域由服务端注入**。handler 签名里的 `userId` 来自鉴权中间件,
 *     请求体里传什么都到不了这一层 —— 应用无法越权读别人的数据。
 *  3) **能力必须被声明才能调用**。`collectDeclaredCalls` 从应用 spec 里扫出声明集,
 *     未声明的名字即使在白名单里也拒绝执行(capability scoping,泄露 app id ≠ 万能通行证)。
 *  4) **可撤销**。删掉本表一项,所有存量应用对该能力的调用立即失效,无需重装任何东西。
 *
 * 新增一项能力的完整改动面(三处,少一处编译期即红):
 *  - `@ihui/types` 的 `CAPABILITY_APP_CALLS`(词表 + 参数元数据)
 *  - 本文件的 `CAPABILITY_APP_ACTION_HANDLERS`(服务端实现)
 *  - 渲染器无需改动:块靠 `from` 绑定消费结果,与具体能力名解耦。
 */

import type { CapabilityAppCallArgs, CapabilityAppCallName, CapabilityJsonValue } from '@ihui/types'
import { parseCapabilityAppCallArgs, CAPABILITY_APP_CALLS } from '@ihui/types'

import { findConversationsByUser } from '../db/chat-queries.js'
import { countUnread, findNotificationsByUser } from '../db/notification-queries.js'
import { getDailyCreditsUsage } from './credits-usage-service.js'

/** 已强转好的参数(数值 / 布尔已不是字符串) */
export interface ResolvedCallArgs {
  [key: string]: string | number | boolean | undefined
}

export interface CapabilityAppCallHandler {
  /** 只读标记:本表禁止出现写操作;service 层不提供任何写能力入口 */
  readOnly: true
  run(userId: string, args: ResolvedCallArgs): Promise<CapabilityJsonValue>
}

function num(args: ResolvedCallArgs, key: string, fallback: number): number {
  const raw = args[key]
  if (raw === undefined) return fallback
  const value = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function bool(args: ResolvedCallArgs, key: string): boolean {
  const raw = args[key]
  return raw === true || raw === 'true'
}

function str(args: ResolvedCallArgs, key: string): string | undefined {
  const raw = args[key]
  if (raw === undefined || raw === '') return undefined
  return String(raw)
}

/**
 * 能力名 → 实现。`Record<CapabilityAppCallName, …>` 是刻意的:
 * 词表加一项而这里没跟上,tsc 立刻报缺属性。
 */
export const CAPABILITY_APP_ACTION_HANDLERS: Record<
  CapabilityAppCallName,
  CapabilityAppCallHandler
> = {
  'conversations.recent': {
    readOnly: true,
    async run(userId, args) {
      const limit = Math.min(50, Math.max(1, Math.trunc(num(args, 'limit', 10))))
      const search = str(args, 'search')
      const { list, total } = await findConversationsByUser(userId, {
        page: 1,
        pageSize: limit,
        includeArchived: bool(args, 'includeArchived'),
        ...(search === undefined ? {} : { search }),
      })
      return {
        total,
        items: list.map((row) => ({
          id: row.id,
          title: row.title,
          model: row.model,
          messageCount: row.messageCount,
          updatedAt: (row.lastMessageAt ?? row.updatedAt ?? row.createdAt).toISOString(),
        })),
      }
    },
  },

  'notifications.recent': {
    readOnly: true,
    async run(userId, args) {
      const limit = Math.min(50, Math.max(1, Math.trunc(num(args, 'limit', 10))))
      const [unread, page] = await Promise.all([
        countUnread(userId),
        findNotificationsByUser(userId, {
          page: 1,
          pageSize: limit,
          partition: 'active',
          ...(bool(args, 'unreadOnly') ? { unreadOnly: true } : {}),
        }),
      ])
      return {
        unread,
        total: page.total,
        items: page.list.map((row) => ({
          id: row.id,
          title: row.title,
          content: row.content ?? '',
          type: row.type,
          isRead: row.isRead,
          createdAt: row.createdAt.toISOString(),
        })),
      }
    },
  },

  'usage.daily': {
    readOnly: true,
    async run(userId, args) {
      const days = Math.min(90, Math.max(1, Math.trunc(num(args, 'days', 30))))
      const usage = await getDailyCreditsUsage({ userId, days })
      return {
        days: usage.days,
        startDate: usage.startDate,
        endDate: usage.endDate,
        timezone: usage.timezone,
        buckets: usage.buckets.map((bucket) => ({
          date: bucket.date,
          count: bucket.count,
          points: bucket.points,
          sessions: bucket.sessions,
        })),
      }
    },
  },
}

export type CapabilityAppInvokeFailure =
  | { code: 'unknown_call'; message: string }
  | { code: 'undeclared_call'; message: string }
  | { code: 'invalid_args'; message: string }

export type CapabilityAppInvokeOutcome =
  | { ok: true; result: CapabilityJsonValue; elapsedMs: number }
  | { ok: false; failure: CapabilityAppInvokeFailure }

/** 把字符串参数按元数据强转成 handler 真正想要的类型。 */
export function coerceCallArgs(
  name: CapabilityAppCallName,
  args: CapabilityAppCallArgs,
): ResolvedCallArgs {
  const params = new Map(CAPABILITY_APP_CALLS[name].params.map((param) => [param.key, param]))
  const resolved: ResolvedCallArgs = {}
  for (const [key, value] of Object.entries(args)) {
    const kind = params.get(key)?.kind
    if (kind === 'number') {
      const asNumber = Number(value)
      if (Number.isFinite(asNumber)) {
        resolved[key] = asNumber
        continue
      }
    }
    if (kind === 'boolean') {
      resolved[key] = value === 'true'
      continue
    }
    resolved[key] = value
  }
  return resolved
}

/**
 * 执行一次已声明能力调用。
 *
 * @param declaration 应用 spec 里声明过的能力集合(`collectDeclaredCalls` 的结果)
 */
export async function invokeCapabilityAppCall(input: {
  userId: string
  call: unknown
  args: unknown
  declaration: Set<CapabilityAppCallName>
}): Promise<CapabilityAppInvokeOutcome> {
  const { userId, call, args, declaration } = input
  if (typeof call !== 'string' || !(call in CAPABILITY_APP_ACTION_HANDLERS)) {
    return {
      ok: false,
      failure: { code: 'unknown_call', message: `未知能力 "${String(call)}"` },
    }
  }
  const name = call as CapabilityAppCallName
  if (!declaration.has(name)) {
    return {
      ok: false,
      failure: {
        code: 'undeclared_call',
        message: `应用未声明能力 "${name}",拒绝执行`,
      },
    }
  }
  const parsed = parseCapabilityAppCallArgs(name, args)
  if (!parsed.ok) {
    return {
      ok: false,
      failure: {
        code: 'invalid_args',
        message: parsed.errors
          .map((item) => (item.key === null ? item.message : `${item.key}: ${item.message}`))
          .join('; '),
      },
    }
  }
  const startedAt = Date.now()
  const handler = CAPABILITY_APP_ACTION_HANDLERS[name]
  const result = await handler.run(userId, coerceCallArgs(name, parsed.value))
  return { ok: true, result, elapsedMs: Date.now() - startedAt }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
