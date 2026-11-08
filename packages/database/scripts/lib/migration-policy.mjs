// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 手工迁移执行策略（DB-05）。
 *
 * 纯函数，便于不连库单测：
 *  - 跳过判据只认 PostgreSQL SQLSTATE 白名单，且要求语句形态是「建对象」或
 *    「显式 DROP 缺失对象」，绝不按错误消息里的 `already exists` 子串吞错；
 *  - 含 CONCURRENTLY 的迁移不能进单文件事务，必须在执行前拒绝。
 */
import { stripSqlComments } from './split-sql.mjs'

/** 可容忍的 SQLSTATE 全集；是否真的可跳过还要由语句形态二次确认。 */
export const SKIPPABLE_SQLSTATE = new Set(['42P07', '42710', '42701', '42P01', '42703'])

const OBJECT_ALREADY_EXISTS_CODES = new Set(['42P07', '42710', '42701'])
const OBJECT_MISSING_CODES = new Set(['42P01', '42703'])

const CREATE_LIKE = /^(?:CREATE\b|ALTER\s+TABLE[\s\S]+?\s+ADD\b|COMMENT\s+ON\b)/i
const DROP_LIKE =
  /^(?:DROP\b|ALTER\s+TABLE[\s\S]+?\s+DROP\s+(?:COLUMN|CONSTRAINT)\b)/i

const OBJECT_NAME_PATTERNS = [
  /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|[A-Za-z0-9_.]+)/i,
  /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|[A-Za-z0-9_.]+)/i,
  /^ALTER\s+TABLE\s+("[^"]+"|[A-Za-z0-9_.]+)\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|[A-Za-z0-9_.]+)/i,
  /^ALTER\s+TABLE\s+("[^"]+"|[A-Za-z0-9_.]+)\s+ADD\s+CONSTRAINT\s+("[^"]+"|[A-Za-z0-9_.]+)/i,
  /^DROP\s+(?:TABLE|INDEX|VIEW|POLICY|TYPE|SCHEMA)\s+(?:IF\s+EXISTS\s+)?("[^"]+"|[A-Za-z0-9_.]+)/i,
  /^ALTER\s+TABLE\s+("[^"]+"|[A-Za-z0-9_.]+)\s+DROP\s+(?:COLUMN|CONSTRAINT)\s+(?:IF\s+EXISTS\s+)?("[^"]+"|[A-Za-z0-9_.]+)/i,
]

function executableHead(statement) {
  return stripSqlComments(statement).trimStart()
}

function unquote(identifier) {
  return identifier.replace(/^"|"$/g, '')
}

/**
 * 判断某条语句的错误是否属于「可容忍的幂等重放」。
 * @param {{ code?: string, message?: string }} err
 * @param {string} statement
 * @returns {boolean}
 */
export function shouldSkipStatement(err, statement) {
  const code = err && typeof err === 'object' ? err.code : undefined
  if (typeof code !== 'string' || !SKIPPABLE_SQLSTATE.has(code)) return false
  const head = executableHead(statement)
  if (OBJECT_ALREADY_EXISTS_CODES.has(code)) return CREATE_LIKE.test(head)
  if (OBJECT_MISSING_CODES.has(code)) return DROP_LIKE.test(head)
  return false
}

/**
 * 取出被跳过语句的对象名，供日志明示「跳过了谁」。
 * @param {{ table?: string, column_name?: string, constraint_name?: string, schema_name?: string }} err
 * @param {string} statement
 * @returns {string}
 */
export function describeSkippedObject(err, statement) {
  const fromError = [err?.schema_name, err?.table, err?.column_name, err?.constraint_name]
    .filter((v) => typeof v === 'string' && v.length > 0)
  if (fromError.length > 0) return fromError.join('.')
  const head = executableHead(statement)
  for (const pattern of OBJECT_NAME_PATTERNS) {
    const match = pattern.exec(head)
    if (match) {
      return match
        .slice(1)
        .filter((v) => typeof v === 'string' && v.length > 0)
        .map(unquote)
        .join('.')
    }
  }
  return head.slice(0, 60) || '<unknown>'
}

/**
 * 执行前策略：CONCURRENTLY 不能在事务块内执行，必须拒绝而不是降级顺序执行。
 * @param {string[]} statements
 * @param {string} label
 * @returns {{ transactional: true, statements: string[] }}
 */
export function planMigrationExecution(statements, label = '<migration>') {
  const concurrent = statements.find((statement) => /\bCONCURRENTLY\b/i.test(stripSqlComments(statement)))
  if (concurrent) {
    throw new Error(
      `迁移 ${label} 含 CONCURRENTLY：不能在单文件事务执行器内运行，请改走 manual-sql 专用通道（不进入 journal）`,
    )
  }
  return { transactional: true, statements }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
