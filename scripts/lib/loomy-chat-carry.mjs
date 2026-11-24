// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Loomy 会话正库适配（2026-11-24 现场取证）。
 *
 * 上一版把 Loomy 判成「Local Storage/IndexedDB 索引级」：只数到 19 个 `ses_*` id，
 * `visible` 固定 null。这个判断不完整。Loomy 的正文不在 IndexedDB 里，而在它自带
 * OpenCode 服务端的本地库里：
 *
 *   C:\Users\Public\Loomy\<tenant-id>\share\opencode\opencode.db
 *
 * 取证方法：
 * - Loomy 主进程 `C:\Loomy\Loomy.exe`；
 * - 子进程 `C:\Loomy\resources\opencode\win32-x64\opencode.exe serve --port=4627`；
 * - `GET /path` 返回 `state=C:\Users\Public\Loomy\<tenant>\state\opencode`，
 *   `config=C:\Users\Public\Loomy\<tenant>\opencode\opencode`；
 * - 真库 143,257,600 字节，表 `session` / `message` / `part` / `account` / `account_state`；
 * - 本机实读：`session` 2 行（1 顶层 + 1 子会话）、`message` 307 行、`part` 1545 行；
 *   `account` / `account_state` 均 0 行；`session` 无 account_id/user_id 列。
 *
 * 账号维度：
 * - Loomy 登录态不在这个库里，在 `%APPDATA%\Loomy\Local Storage\leveldb` 的
 *   `loomy-auth-session`（local-login.mjs 的 applyLoomy 已按这个落点写回）；
 * - 正库 `session` 无账号列，`account` / `account_state` 运行时零写入；
 * - 所以切号只换 Local Storage 的登录票，不重建 OpenCode 库；旧会话在新号仍在，
 *   续聊由本地 session/message + 当前登录票发起。
 *
 * 本模块只读，不写库、不读 token 明文。
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** Loomy 多租户根：C:\Users\Public\Loomy\<tenant>\share\opencode */
export function loomyTenantDirs(env = process.env) {
  const publicRoot = String(env.PUBLIC || env.PUBLIC_DIR || 'C:\\Users\\Public').trim()
  const loomyRoot = path.join(publicRoot, 'Loomy')
  const dirs = []
  try {
    for (const entry of fs.readdirSync(loomyRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) dirs.push(path.join(loomyRoot, entry.name, 'share', 'opencode'))
    }
  } catch {
    /* 没装/没首启就没有这个根 */
  }
  const appData = String(env.APPDATA || '').trim()
  if (appData) dirs.push(path.join(appData, 'Loomy', 'share', 'opencode'))
  return dirs
}

export function loomyDbCandidates(env = process.env) {
  return loomyTenantDirs(env).map((dir) => path.join(dir, 'opencode.db'))
}

export function findLoomyInstall(env = process.env) {
  const localAppData = String(env.LOCALAPPDATA || '').trim()
  const programFiles = String(env.ProgramFiles || '').trim()
  const candidates = [
    'C:\\Loomy\\Loomy.exe',
    localAppData && path.join(localAppData, 'Programs', 'Loomy', 'Loomy.exe'),
    programFiles && path.join(programFiles, 'Loomy', 'Loomy.exe'),
  ].filter(Boolean)
  for (const file of candidates) {
    if (file && fs.existsSync(file)) return { installed: true, path: file }
  }
  return { installed: false, path: '' }
}

function firstExisting(candidates) {
  for (const file of candidates) if (file && fs.existsSync(file)) return file
  return ''
}

function isSqliteFile(file) {
  try {
    const fd = fs.openSync(file, 'r')
    const buf = Buffer.alloc(16)
    fs.readSync(fd, buf, 0, 16, 0)
    fs.closeSync(fd)
    return buf.subarray(0, 15).toString('latin1') === 'SQLite format 3'
  } catch {
    return false
  }
}

function tableCols(db, table) {
  try {
    return db.prepare(`PRAGMA table_info(\`${table}\`)`).all().map((c) => String(c.name))
  } catch {
    return []
  }
}

function count(db, sql) {
  try {
    return Number(db.prepare(sql).get().n) || 0
  } catch {
    return null
  }
}

/**
 * Loomy 正库探针（同时兼容它自带的 OpenCode v1 schema 和未来 v2 schema）。
 * @returns 与 chat-carry/probeProvider 兼容的只读结果
 */
export function probeLoomy({ env = process.env } = {}) {
  const install = findLoomyInstall(env)
  const dbFile = firstExisting(loomyDbCandidates(env))
  const base = {
    kind: 'sqlite',
    provider: 'loomy',
    located: false,
    path: '',
    table: 'session',
    sessions: null,
    visible: null,
    messageCount: null,
    partCount: null,
    accountScoped: false,
    accountCols: [],
    notes: [],
    installPath: install.path,
    installed: install.installed,
  }

  if (!dbFile) {
    return {
      ...base,
      notes: [
        install.installed
          ? `已安装 Loomy,但未找到 share/opencode/opencode.db(候选:${loomyDbCandidates(env).join(' / ')});Local Storage/IndexedDB 只是登录票和 UI 索引,不能冒充正文`
          : '未找到 Loomy 主程序,也没有 share/opencode/opencode.db;本机没有可核验的 Loomy 正库',
      ],
      raw: { dataDirs: loomyTenantDirs(env), installPath: install.path },
    }
  }

  if (!isSqliteFile(dbFile)) {
    return { ...base, path: dbFile, notes: [`候选文件不是 SQLite(落点可能已换形态):${dbFile}`], raw: { dbPath: dbFile } }
  }

  const { DatabaseSync } = require('node:sqlite')
  let db
  try {
    db = new DatabaseSync(dbFile, { readOnly: true })
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r) => String(r.name))
    // Loomy 1.14.22 的 OpenCode v1 schema 用 session/message/part；v2 若升级则回退到 session_v2。
    const v1 = tables.includes('session') && tables.includes('message')
    const v2 = tables.includes('session_v2') && tables.includes('session_message')
    if (!v1 && !v2) {
      return {
        ...base,
        path: dbFile,
        notes: [`库内没有 session/message(v1) 或 session_v2/session_message(v2);实读表:${tables.slice(0, 12).join(',')}…`],
        raw: { dbPath: dbFile },
      }
    }
    const table = v1 ? 'session' : 'session_v2'
    const messageTable = v1 ? 'message' : 'session_message'
    const partTable = v1 && tables.includes('part') ? 'part' : ''
    const cols = tableCols(db, table)
    const messageCols = tableCols(db, messageTable)
    if (!cols.includes('id') || !messageCols.includes('session_id')) {
      return {
        ...base,
        path: dbFile,
        notes: [`${table}/${messageTable} 列面不符合预期(session:${cols.slice(0, 10).join(',')};message:${messageCols.slice(0, 10).join(',')})`],
        raw: { dbPath: dbFile },
      }
    }
    const accountCols = cols.filter((c) => /(^|_)(user|account|uid|owner)(_id)?$/i.test(c) || /^(user|account|uid|owner)_?id$/i.test(c))
    const hasParent = cols.includes('parent_id')
    const hasArchived = cols.includes('time_archived')
    const rootWhere = hasParent ? "COALESCE(parent_id,'') = ''" : '1=1'
    const visibleWhere = hasArchived ? `${rootWhere} AND COALESCE(time_archived,0)=0` : rootWhere
    const total = count(db, `SELECT count(*) AS n FROM ${table} WHERE ${rootWhere}`)
    const visible = count(db, `SELECT count(*) AS n FROM ${table} WHERE ${visibleWhere}`)
    const allSessions = count(db, `SELECT count(*) AS n FROM ${table}`)
    const messageCount = count(db, `SELECT count(*) AS n FROM ${messageTable}`)
    const partCount = partTable ? count(db, `SELECT count(*) AS n FROM ${partTable}`) : null
    const accountRows = tables.includes('account') ? count(db, 'SELECT count(*) AS n FROM account') : 0
    const accountStateRows = tables.includes('account_state') ? count(db, 'SELECT count(*) AS n FROM account_state') : 0
    let activeAccountId = ''
    if (tables.includes('account_state')) {
      try {
        activeAccountId = String(db.prepare('SELECT active_account_id AS v FROM account_state LIMIT 1').get()?.v ?? '')
      } catch {
        /* 列名可能变;不猜 */
      }
    }
    const notes = [
      `正库 ${dbFile}:${v1 ? 'OpenCode v1' : 'OpenCode v2'} schema,顶层会话 ${total}(未归档可见 ${visible}),全部 session ${allSessions} 条;正文 ${messageCount} 条、part ${partCount ?? '?'} 条`,
      `${table} 无 account_id/user_id 列;account 表 ${accountRows} 行,account_state ${accountStateRows} 行 ⇒ 登录票只放 Local Storage,切号不重建库,旧会话在新号仍在`,
    ]
    if (accountCols.length > 0) notes.push(`${table} 出现账号列 ${accountCols.join(',')},与源码/现场结论冲突,需按重绑处理`)
    if (hasArchived) notes.push('可见口径 = 顶层会话且 time_archived 为空/0;子会话和归档会话仍计入总数/正文,不计入顶层可见')
    if (accountRows > 0 || accountStateRows > 0) notes.push('account/account_state 有行,需复核是否被新版本启用;但 session 无账号列,仍不支持按号过滤')
    return {
      ...base,
      located: true,
      path: dbFile,
      table,
      sessions: total,
      visible,
      messageCount,
      partCount,
      accountScoped: accountCols.length > 0,
      accountCols,
      schema: v1 ? 'session/message/part' : 'session_v2/session_message',
      notes,
      raw: {
        dbPath: dbFile,
        table,
        messageTable,
        partTable,
        rootSessions: total,
        allSessions,
        visible,
        messageCount,
        partCount,
        accountRows,
        accountStateRows,
        activeAccountId,
        schema: v1 ? 'v1' : 'v2',
        installPath: install.path,
        dataDirs: loomyTenantDirs(env),
      },
    }
  } catch (e) {
    return {
      ...base,
      path: dbFile,
      notes: [`读库失败(可能被 Loomy 独占):${e instanceof Error ? e.message : String(e)}`],
      raw: { dbPath: dbFile },
    }
  } finally {
    try {
      db?.close()
    } catch {
      /* 关不掉不影响结论 */
    }
  }
}

export const __test__ = {
  loomyTenantDirs,
  loomyDbCandidates,
  findLoomyInstall,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
