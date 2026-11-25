// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​​​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍‌​‌‌​‌‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 让模型写一条只读查询，替用户把「怪问题」也答出来。
 *
 * 这里所有的设计都是为了让「模型写的 SQL」不变成一次数据库授权：
 *
 * - **表名不由模型决定**。模型的语句里只允许出现别名 `m`，执行前被前置成
 *   `WITH m AS (SELECT * FROM wechat_hub_messages WHERE account_id = '<本账号>')`。
 *   就算模型写了 `WHERE account_id = '别人'`，它也只能在同一条 CTE 里兜圈，
 *   拿不到跨账号数据。
 * - **只允许一条 SELECT**。分号、注释、DDL/DML 关键字、`INTO`、`FOR UPDATE`、
 *   `pg_*` 系统函数、`generate_series` 一律拒；`from`/`join` 后面必须是 `m`。
 * - **回 50 行封顶**，外面再包一层 `LIMIT`，避免一句 `SELECT *` 把内存打满。
 * - **执行有时限**：5 秒拿不到结果就按超时返回，不让一条慢查询拖住请求线程。
 * - **答话不交给模型润色**：数字直接从结果行里拼，模型只负责写查询，不负责编数字。
 */

import { sql } from 'drizzle-orm'
import type { WechatAskSqlResult } from '@ihui/types'
import { dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { aiServiceSystemFetch } from '../../utils/ai-service-fetch.js'
import { askMessages } from './ask.js'
import { assertAccountForUser } from './guards.js'

/** 单次最多回多少行；再多就说明问法需要收紧，而不是把整库倒出来。 */
export const MAX_SQL_ROWS = 50
/** 执行时限；超时按「查询太慢」返回，不让请求线程耗在一条慢语句上。 */
export const SQL_TIMEOUT_MS = 5_000
const MAX_SQL_LENGTH = 4_000
const ASK_MODEL = process.env.WECHAT_HUB_AGENT_MODEL?.trim() || undefined
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 拒绝清单。任何一项命中就整条拒，不做「部分放行」——半个写权限比全开更危险，
 * 因为维护的人会以为已经关住了。
 */
const FORBIDDEN_PATTERN =
  /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|copy|merge|call|vacuum|analyze|reindex|cluster|comment|refresh|reassign|lock|into|nextval|setval|set_config|pg_sleep|pg_read_file|pg_ls_dir|pg_stat|pg_catalog|pg_terminate_backend|pg_cancel_backend|lo_import|lo_export|dblink|generate_series|current_setting)\b/i

export interface SqlValidationOk {
  ok: true
  /** 可直接执行的最终语句（已注入租户 CTE 与行数上限） */
  statement: string
  /** 模型原始语句（去掉围栏与分号），展示给用户看它到底写了什么 */
  raw: string
}

export interface SqlValidationFail {
  ok: false
  reason: string
}

/** 去掉 Markdown 围栏与前言；句中的分号刻意保留，交给校验器直接拒，不许悄悄截断。 */
export function stripSqlFences(input: string): string {
  let text = input.trim()
  const fenced = text.match(/```(?:sql)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) text = fenced[1].trim()
  // 模型偶尔会在语句前面补一句中文；从第一个 select/with 起切。
  const start = text.search(/\b(select|with)\b/i)
  if (start > 0) text = text.slice(start)
  // 只吞掉结尾的分号：`select ... from m;` 是正常写法，
  // 但 `select ...; select ...` 必须留在这里被校验器拦下。
  return text.replace(/;+\s*$/, '').trim()
}

/**
 * 校验并重写成可执行语句。纯函数：不碰数据库，便于把「哪些 SQL 能过」钉死在测试里。
 */
export function validateSql(rawSql: string, accountId: string): SqlValidationOk | SqlValidationFail {
  const raw = stripSqlFences(rawSql)
  if (raw.length === 0) return { ok: false, reason: '模型没有给出查询语句' }
  if (raw.length > MAX_SQL_LENGTH) return { ok: false, reason: '查询语句过长' }
  if (!/^(select|with)\b/i.test(raw)) return { ok: false, reason: '只允许 select / with 开头的查询' }
  if (raw.includes(';')) return { ok: false, reason: '只允许单条语句（语句里出现了分号）' }
  if (raw.includes('--') || raw.includes('/*') || raw.includes('*/')) {
    return { ok: false, reason: '查询里不允许出现注释（注释常被用来藏第二条语句）' }
  }
  if (FORBIDDEN_PATTERN.test(raw)) {
    return { ok: false, reason: '查询里出现了写操作或系统函数，已拒绝' }
  }
  if (/\b(wechat_hub_\w+|ihui_\w+|information_schema)\b/i.test(raw)) {
    return { ok: false, reason: '查询不允许直接引用业务表名或系统视图，请只用别名 m' }
  }
  // from / join 后面只允许是别名 m；`from (` 这种子查询写法同样拒掉，
  // 因为它绕过了「只读一张表」的约束。
  if (/\bfrom\s*\(/i.test(raw) || /\bjoin\s*\(/i.test(raw)) {
    return { ok: false, reason: '不从子查询取数，只能 from m' }
  }
  const tableRefs = [...raw.matchAll(/\b(from|join)\s+([A-Za-z_][A-Za-z0-9_.]*)/gi)]
    .map((match) => (match[2] ?? '').toLowerCase())
    .filter((name) => name.length > 0)
  if (tableRefs.length === 0) return { ok: false, reason: '查询里没有 from m' }
  for (const name of tableRefs) {
    if (name !== 'm' && !name.startsWith('m.')) {
      return { ok: false, reason: `查询引用了不允许的表 ${name}（只允许别名 m）` }
    }
  }
  if (!UUID_PATTERN.test(accountId)) {
    return { ok: false, reason: '账号标识异常，已拒绝执行' }
  }

  // 租户隔离由这段 CTE 兜底：模型写什么都只能看到本账号的消息。
  // 外面再包一层 LIMIT，聚合查询同样适用（聚合结果一般只有几行）。
  const statement = [
    `WITH m AS (SELECT * FROM wechat_hub_messages WHERE account_id = '${accountId}')`,
    raw,
  ].join('\n')
  const wrapped = `SELECT * FROM (${statement}) AS __ihui_q LIMIT ${MAX_SQL_ROWS}`

  return { ok: true, statement: wrapped, raw }
}

function toRows(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>
  const rows = (value as { rows?: unknown } | null)?.rows
  if (Array.isArray(rows)) return rows as Array<Record<string, unknown>>
  return []
}

/** 结果行 → 大白话。只拼接真实值，不做任何推断，数字必须能对上库里的行。 */
export function formatSqlAnswer(rows: Array<Record<string, unknown>>, rowCount: number): string {
  if (rowCount === 0) return '这条查询在库里没有命中任何数据。'
  if (rows.length === 1) {
    const entries = Object.entries(rows[0] ?? {})
    if (entries.length === 1) return `结果：${String(entries[0]?.[1] ?? '')}`
    return entries.map(([key, value]) => `${key} = ${String(value ?? '')}`).join('；')
  }
  const lines = rows.slice(0, 10).map((row, index) => {
    const values = Object.entries(row).map(([key, value]) => `${key}=${String(value ?? '')}`)
    return `${index + 1}. ${values.join('，')}`
  })
  const head = `共 ${rowCount} 行（展示前 ${Math.min(rowCount, 10)} 行）：`
  return `${head}\n${lines.join('\n')}`
}

const SCHEMA_PROMPT = [
  '可用数据表只有一个，别名固定为 m，你只能写 m：',
  'm(account_id, conversation_id, direction, kind, content, sender_id, sender_name, sent_at, media_url)',
  '- direction：inbound=对方发来的，outbound=账号主人发的',
  '- kind：text / voice / image / file / video 等',
  '- sent_at：timestamptz，可按天、按小时聚合',
  '- content：文本正文；语音未转写时是空串或 [语音] 这类占位',
  '规则：',
  '只写一条 select（可以是 with + select），不要分号、不要注释、不要解释文字；',
  '禁止任何写操作、系统函数、其他表名；不要用子查询代替 from m；',
  '只输出 SQL 本身，不要 Markdown 代码围栏，不要中文说明。',
].join('\n')

async function askModelForSql(question: string, model?: string): Promise<string> {
  const response = await aiServiceSystemFetch(
    '/api/v1/ai/llm/complete',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(model || ASK_MODEL ? { model: model ?? ASK_MODEL } : {}),
        messages: [
          { role: 'system', content: SCHEMA_PROMPT },
          { role: 'user', content: `问题：${question}` },
        ],
        temperature: 0,
        max_tokens: 500,
      }),
    },
    60_000,
  )
  if (!response.ok) throw new Error(`ai-service HTTP ${response.status}`)
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    content?: string
    text?: string
  }
  const text = payload.choices?.[0]?.message?.content ?? payload.content ?? payload.text ?? ''
  return typeof text === 'string' ? text : ''
}

/**
 * 问一句，让模型写查询，再由我们校验、执行、拼答案。
 *
 * 任何一步不成立（模型不可用、SQL 没过校验、执行报错、超时）都不抛给前端，
 * 而是回落到既有的关键词问数，并用 note 说明「为什么这次没用查询」——
 * 用户看到的是答案，不是一个技术错误。
 */
export async function askWithSql(
  userId: string,
  accountId: string,
  question: string,
  options: { model?: string } = {},
): Promise<WechatAskSqlResult> {
  await assertAccountForUser(userId, accountId)
  const clean = question.trim()
  if (clean.length === 0) throw new AppError('问题不能为空', 400, 'WECHAT_ASK_EMPTY')
  if (clean.length > 500) throw new AppError('问题过长', 400, 'WECHAT_ASK_TOO_LONG')

  const fallback = async (note: string): Promise<WechatAskSqlResult> => {
    const plain = await askMessages(userId, accountId, { question: clean })
    return {
      answer: plain.answer,
      sql: '',
      rowCount: 0,
      rows: [],
      generatedBy: plain.generatedBy,
      note,
    }
  }

  let generated: string
  try {
    generated = await askModelForSql(clean, options.model)
  } catch {
    return fallback('模型不可用，已改用关键词检索回答')
  }

  const validated = validateSql(generated, accountId)
  if (!validated.ok) return fallback(`模型写的查询未通过安全校验：${validated.reason}`)

  let raw: unknown
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    raw = await Promise.race([
      dbRead.execute(sql.raw(validated.statement)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('SQL_TIMEOUT')), SQL_TIMEOUT_MS)
      }),
    ])
  } catch (error) {
    const timedOut = error instanceof Error && error.message === 'SQL_TIMEOUT'
    return fallback(timedOut ? '查询超过 5 秒，已改用关键词检索' : '查询执行失败，已改用关键词检索')
  } finally {
    if (timer) clearTimeout(timer)
  }

  const rows = toRows(raw).slice(0, MAX_SQL_ROWS)
  return {
    answer: formatSqlAnswer(rows, rows.length),
    sql: validated.raw,
    rowCount: rows.length,
    rows,
    generatedBy: 'llm',
    note: null,
  }
}
