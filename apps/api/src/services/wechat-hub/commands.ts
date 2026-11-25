// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信指令内核（对齐 AstrBot / LangBot 的「斜杠指令 + 插件注册」形态）。
 *
 * 目的：把「在微信里直接对账号下命令」变成一等能力，而不是散在自动回复关键词里。
 *
 * 设计约束：
 *  - 注册表是进程内单例，新增指令只需 registerWechatCommand，不再改管道代码；
 *  - 指令命中优先于自动回复规则，但仍走 manager.send 的同一套白名单/限流/敏感词/审计；
 *  - 默认关闭，需账号 metadata.commandsEnabled=true 才响应；群聊还要 commandsInGroup=true；
 *  - 指令只读数据 + 复用既有分析/报告/问数能力，不新增写操作。
 */

import { and, eq, gte, lt } from 'drizzle-orm'
import { wechatHubConversations, wechatHubMessages } from '@ihui/database'
import type {
  WechatCommandRunResult,
  WechatCommandView,
  WechatSendInput,
  WechatSendResult,
} from '@ihui/types'
import { dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { runAnalysis } from './analysis-runner.js'
import { askMessages } from './ask.js'
import { dayStartUtc, formatInZone } from './export-formats.js'
import { knowledgeReply } from './knowledge.js'
import { buildReport } from './reports.js'
import type { WechatInboundEvent } from './types.js'
import { assertAccountForUser } from './guards.js'
import { asRecord } from './views.js'

export interface WechatCommandContext {
  userId: string
  accountId: string
  event: WechatInboundEvent
  args: string
  conversationId: string | null
}

export interface WechatCommand {
  name: string
  aliases: string[]
  description: string
  scope: 'all' | 'private' | 'group'
  run: (ctx: WechatCommandContext) => Promise<string>
}

const REGISTRY = new Map<string, WechatCommand>()
const COOLDOWN = new Map<string, number>()
const COOLDOWN_MS = 2_000
const MAX_REPLY_CHARS = 1_200

export function registerWechatCommand(command: WechatCommand): void {
  const key = command.name.trim().toLowerCase()
  if (!key) throw new AppError('指令名不能为空', 400, 'WECHAT_COMMAND_EMPTY_NAME')
  REGISTRY.set(key, {
    ...command,
    name: key,
    aliases: command.aliases.map((alias) => alias.toLowerCase()),
  })
}

export function listRegisteredCommands(): WechatCommand[] {
  return [...REGISTRY.values()]
}

/** 解析「/指令 参数」；全角斜杠与中文指令名都支持。 */
export function parseCommand(text: string): { name: string; args: string } | null {
  const trimmed = text.trim()
  const match = trimmed.match(/^[\/／]([^\s/／]+)(?:\s+(.*))?$/s)
  if (!match) return null
  const name = (match[1] ?? '').trim().toLowerCase()
  if (!name) return null
  return { name, args: (match[2] ?? '').trim() }
}

function findCommand(name: string): WechatCommand | null {
  const direct = REGISTRY.get(name)
  if (direct) return direct
  for (const command of REGISTRY.values()) {
    if (command.aliases.includes(name)) return command
  }
  return null
}

function truncate(text: string): string {
  const clean = text.trim()
  return clean.length > MAX_REPLY_CHARS ? `${clean.slice(0, MAX_REPLY_CHARS)}…` : clean
}

async function conversationIdOf(accountId: string, platformChatId: string): Promise<string | null> {
  const rows = await dbRead
    .select({ id: wechatHubConversations.id })
    .from(wechatHubConversations)
    .where(
      and(
        eq(wechatHubConversations.accountId, accountId),
        eq(wechatHubConversations.platformChatId, platformChatId),
      ),
    )
    .limit(1)
  return rows[0]?.id ?? null
}

async function todayCount(accountId: string): Promise<number> {
  const start = dayStartUtc(0, 'Asia/Shanghai')
  const end = dayStartUtc(1, 'Asia/Shanghai')
  const rows = await dbRead
    .select({ id: wechatHubMessages.id })
    .from(wechatHubMessages)
    .where(
      and(
        eq(wechatHubMessages.accountId, accountId),
        gte(wechatHubMessages.sentAt, start),
        lt(wechatHubMessages.sentAt, end),
      ),
    )
    .limit(2_000)
  return rows.length
}

function analysisText(kind: 'summary' | 'todos', title: string | null, result: unknown): string {
  const record = (result ?? {}) as Record<string, unknown>
  const summary = typeof record.summary === 'string' ? record.summary : ''
  const todos = Array.isArray(record.todos) ? record.todos : []
  const highlights = Array.isArray(record.highlights) ? record.highlights : []
  if (kind === 'todos') {
    if (todos.length === 0) return `${title ?? '当前会话'}没有识别到待办。`
    const lines = todos
      .slice(0, 8)
      .map((item) => {
        const entry = item as Record<string, unknown>
        const owner = typeof entry.owner === 'string' ? ` @${entry.owner}` : ''
        const due = typeof entry.due === 'string' ? `（${entry.due}）` : ''
        return `- ${String(entry.text ?? '')}${owner}${due}`
      })
      .join('\n')
    return `${title ?? '当前会话'}的待办：\n${lines}`
  }
  const parts = [summary || '暂无摘要']
  if (highlights.length > 0) {
    parts.push(
      `要点：\n${highlights
        .slice(0, 5)
        .map((item) => `- ${String(item)}`)
        .join('\n')}`,
    )
  }
  return parts.join('\n\n')
}

function registerBuiltins(): void {
  registerWechatCommand({
    name: 'help',
    aliases: ['帮助', '指令'],
    description: '查看可用指令',
    scope: 'all',
    run: async () => {
      const lines = listRegisteredCommands()
        .filter((command) => command.name !== 'help')
        .map((command) => `/${command.name} ${command.description}`)
      return [`可用指令（发送 /指令 触发）：`, ...lines].join('\n')
    },
  })

  registerWechatCommand({
    name: 'summary',
    aliases: ['摘要', '总结'],
    description: '总结当前会话最近消息',
    scope: 'all',
    run: async (ctx) => {
      const outcome = await runAnalysis(ctx.userId, {
        accountId: ctx.accountId,
        conversationId: ctx.conversationId ?? undefined,
        kind: 'summary',
        limit: 200,
      })
      return analysisText('summary', ctx.event.conversationTitle, outcome.view.result)
    },
  })

  registerWechatCommand({
    name: 'todos',
    aliases: ['待办', 'todo'],
    description: '提取当前会话待办',
    scope: 'all',
    run: async (ctx) => {
      const outcome = await runAnalysis(ctx.userId, {
        accountId: ctx.accountId,
        conversationId: ctx.conversationId ?? undefined,
        kind: 'todos',
        limit: 200,
      })
      return analysisText('todos', ctx.event.conversationTitle, outcome.view.result)
    },
  })

  registerWechatCommand({
    name: 'report',
    aliases: ['报告', '年报'],
    description: '生成年度/双人/群聊报告（/report 2026）',
    scope: 'all',
    run: async (ctx) => {
      const year = Number.parseInt(ctx.args, 10)
      const kind = ctx.event.conversationKind === 'group' ? 'group' : 'pair'
      if (kind === 'group' && !ctx.conversationId) {
        return '当前会话还不是已归档的群聊，先在管理台同步一次历史再生成报告。'
      }
      const report = await buildReport(ctx.userId, ctx.accountId, {
        // 私聊没有会话就退回账号年度报告
        kind: ctx.conversationId ? kind : 'annual',
        conversationId: ctx.conversationId ?? undefined,
        year: Number.isFinite(year) ? year : undefined,
      })
      const head = report.markdown.split('\n').slice(0, 22).join('\n')
      return `${head}\n\n（完整报告在管理台「微信智联 → 报告」下载）`
    },
  })

  registerWechatCommand({
    name: 'ask',
    aliases: ['问', '查'],
    description: '用一句话问聊天记录（/ask 上周预算聊了什么）',
    scope: 'all',
    run: async (ctx) => {
      if (!ctx.args) return '用法：/ask 你的问题，例如 /ask 上周关于预算聊了什么'
      const result = await askMessages(ctx.userId, ctx.accountId, {
        question: ctx.args,
        conversationId: ctx.conversationId ?? undefined,
      })
      const refs =
        result.citations.length > 0
          ? `\n\n参考消息：${result.citations
              .slice(0, 3)
              .map(
                (item) =>
                  `${formatInZone(new Date(item.sentAt), 'Asia/Shanghai', false)} ${item.senderName ?? '对方'}`,
              )
              .join('；')}`
          : ''
      return `${result.answer}${refs}`
    },
  })

  registerWechatCommand({
    name: 'knowledge',
    aliases: ['知识', '知识库'],
    description: '查账号知识库（/knowledge 退款政策）',
    scope: 'all',
    run: async (ctx) => {
      if (!ctx.args) return '用法：/knowledge 要查的内容'
      const text = await knowledgeReply(ctx.userId, ctx.accountId, ctx.args, 3)
      return text || '知识库没有匹配内容。'
    },
  })

  registerWechatCommand({
    name: 'status',
    aliases: ['状态'],
    description: '查看账号今日消息量',
    scope: 'all',
    run: async (ctx) => {
      const count = await todayCount(ctx.accountId)
      return `今日已归档 ${count} 条消息${count >= 2_000 ? '（统计到达单次上限）' : ''}。`
    },
  })

  registerWechatCommand({
    name: 'export',
    aliases: ['导出'],
    description: '获取导出入口说明',
    scope: 'all',
    run: async () =>
      '聊天记录导出在管理台操作：微信智联 → 账号 → 导出，可选 HTML / Markdown / Excel / CSV / JSONL / ChatLab 六种格式。桌面端支持一键下载。',
  })
}

registerBuiltins()

export interface CommandPolicy {
  enabled: boolean
  groupEnabled: boolean
  disabled: string[]
}

function readPolicy(metadata: Record<string, unknown>): CommandPolicy {
  const raw = metadata.commands
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const disabled = Array.isArray(record.disabled)
    ? record.disabled.filter((item): item is string => typeof item === 'string')
    : []
  return {
    enabled: record.enabled === true,
    groupEnabled: record.groupEnabled === true,
    disabled,
  }
}

export function commandPolicyOf(metadata: Record<string, unknown>): CommandPolicy {
  return readPolicy(metadata)
}

export function listCommands(metadata: Record<string, unknown>): WechatCommandView[] {
  const policy = readPolicy(metadata)
  return listRegisteredCommands().map((command) => ({
    name: command.name,
    aliases: command.aliases,
    description: command.description,
    scope: command.scope,
    enabled: policy.enabled && !policy.disabled.includes(command.name),
  }))
}

/** 管理台指令面板：读账号 metadata 的 commands 策略并列出全部已注册指令。 */
export async function listCommandsForAccount(
  userId: string,
  accountId: string,
): Promise<WechatCommandView[]> {
  const row = await assertAccountForUser(userId, accountId)
  return listCommands(asRecord(row.metadata))
}

/**
 * 入站消息 → 指令执行。
 * 返回 null 表示「不是指令 / 策略不允许 / 正在冷却」，调用方继续走自动回复。
 */
export async function runCommand(
  userId: string,
  accountId: string,
  event: WechatInboundEvent,
  metadata: Record<string, unknown>,
  send: (input: WechatSendInput) => Promise<WechatSendResult>,
): Promise<WechatCommandRunResult | null> {
  const parsed = parseCommand(event.content)
  if (!parsed) return null
  const policy = readPolicy(metadata)
  if (!policy.enabled) return null
  if (event.conversationKind === 'group' && !policy.groupEnabled) return null
  if (policy.disabled.includes(parsed.name)) return null
  const command = findCommand(parsed.name)
  if (!command) return null
  if (command.scope !== 'all' && command.scope !== event.conversationKind) return null

  const cooldownKey = `${accountId}:${event.platformChatId}:${command.name}`
  const now = Date.now()
  const last = COOLDOWN.get(cooldownKey) ?? 0
  if (now - last < COOLDOWN_MS) return null
  COOLDOWN.set(cooldownKey, now)

  const conversationId = await conversationIdOf(accountId, event.platformChatId)
  const replyText = truncate(
    await command.run({
      userId,
      accountId,
      event,
      args: parsed.args,
      conversationId,
    }),
  )
  if (replyText.length === 0) return null

  const sent = await send({
    accountId,
    target: event.platformChatId,
    kind: 'text',
    text: replyText,
    mentions: event.conversationKind === 'group' && event.senderId ? [event.senderId] : undefined,
  })
  return {
    command: command.name,
    replyText,
    deliveryStatus: sent.status,
    handledByCommand: true,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
