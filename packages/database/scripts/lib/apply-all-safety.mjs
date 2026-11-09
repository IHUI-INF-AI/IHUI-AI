// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * apply-all-migrations 的默认安全判据（纯函数，不连库、不读盘）。
 *
 * DB-07 根因：该脚本(a) 硬编码 localhost DSN、(b) 不写 drizzle 账本、
 * (c) 直接重放含非幂等 DML 的迁移、(d) 按文件名 ASCII 排序而 drizzle 按 journal.when。
 * 这里把「能不能跑」的四项判据收敛到纯函数，脚本只负责 `if (!ok) exit`。
 */

export const NON_LEDGER_BANNER = [
  '⚠️⚠️⚠️  apply-all-migrations 不写 drizzle 账本（meta/_journal.json / __drizzle_migrations）',
  '⚠️     仅用于 dev/test 的一次性同步；生产/共享库必须走 drizzle-kit migrate。',
  '⚠️     账本不落盘 ⇒ 重跑本脚本会重复执行非幂等 DML；补账本请走 check-db-migration-gaps.mjs --repair。',
].join('\n')

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'])

/**
 * 目标 DSN 只许来自显式 env：APPLY_ALL_DATABASE_URLS / SYNC_DATABASE_URLS / DATABASE_URL。
 * - 空 ⇒ 拒绝（绝不回落硬编码 localhost）；
 * - 只接受 postgres 协议；
 * - 非 localhost 目标必须 `--allow-remote` 显式确认。
 * 返回值只含 host/db 展示名，永不回显带口令的完整 URL。
 */
export function resolveTargets({ env = process.env, allowRemote = false } = {}) {
  const raw = env.APPLY_ALL_DATABASE_URLS || env.SYNC_DATABASE_URLS || env.DATABASE_URL || ''
  if (!String(raw).trim())
    return {
      ok: false,
      why: '未提供显式 env：请设置 APPLY_ALL_DATABASE_URLS(逗号/空格分隔) 或 DATABASE_URL；拒绝硬编码 localhost 回退',
    }
  const list = String(raw)
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (list.length === 0) return { ok: false, why: 'APPLY_ALL_DATABASE_URLS 解析后为空' }
  const targets = []
  for (const url of list) {
    let u
    try {
      u = new URL(url)
    } catch {
      return { ok: false, why: `第 ${targets.length + 1} 个目标不是合法 URL` }
    }
    if (!/^postgres(ql)?:/.test(u.protocol))
      return { ok: false, why: `第 ${targets.length + 1} 个目标协议是 ${u.protocol}，只接受 postgres:// / postgresql://` }
    if (!LOCAL_HOSTS.has(u.hostname) && !allowRemote)
      return {
        ok: false,
        why: `目标 ${u.hostname} 非 localhost，必须显式 --allow-remote 确认（拒绝静默连远端）`,
      }
    const db = u.pathname.replace(/^\//, '') || 'db'
    targets.push({ url, name: db, display: `${u.hostname}:${u.port || '5432'}/${db}` })
  }
  return { ok: true, targets }
}

/** 抹掉行注释/块注释/单引号字符串，避免把注释或字面量里的 DML 误判为真语句。 */
function maskSql(sql) {
  return String(sql)
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
}

/**
 * 检测「无幂等保护」的 DML（逐条 statement）：
 *   · INSERT 需要 ON CONFLICT 或 WHERE NOT EXISTS；
 *   · UPDATE / DELETE 需要 WHERE。
 * 返回被点名的语句清单；空数组 = 可安全重放。
 */
export function detectNonIdempotentDml(statements) {
  const out = []
  const list = Array.isArray(statements) ? statements : []
  for (let i = 0; i < list.length; i++) {
    const masked = maskSql(list[i])
    const m = /^\s*(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i.exec(masked)
    if (!m) continue
    const kw = m[1].toUpperCase()
    const kind = kw.startsWith('INSERT') ? 'insert' : kw === 'UPDATE' ? 'update' : 'delete'
    const guarded =
      kind === 'insert'
        ? /\bON\s+CONFLICT\b|\bWHERE\s+NOT\s+EXISTS\b/i.test(masked)
        : /\bWHERE\b/i.test(masked)
    if (guarded) continue
    out.push({ index: i, kind, head: String(list[i]).trim().replace(/\s+/g, ' ').slice(0, 90) })
  }
  return out
}

/**
 * 按 journal.when 排序迁移文件（drizzle 的执行顺序），而不是文件名 ASCII 序。
 * journal 里没有的文件排在末尾并单独点名，绝不静默丢弃。
 * @returns {{ordered:string[], unknown:string[]}}
 */
export function orderMigrationsByWhen(files, journal) {
  const whenByTag = new Map()
  for (const e of journal?.entries ?? []) {
    if (typeof e?.tag === 'string' && e.tag) whenByTag.set(e.tag, Number(e.when))
  }
  const tagOf = (f) => String(f).replace(/\.sql$/i, '')
  const known = []
  const unknown = []
  for (const f of files ?? []) {
    const when = whenByTag.get(tagOf(f))
    if (Number.isFinite(when)) known.push(f)
    else unknown.push(f)
  }
  known.sort((a, b) => whenByTag.get(tagOf(a)) - whenByTag.get(tagOf(b)) || a.localeCompare(b))
  unknown.sort()
  return { ordered: [...known, ...unknown], unknown }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
