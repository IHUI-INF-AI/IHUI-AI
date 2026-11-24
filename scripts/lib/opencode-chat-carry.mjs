// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OpenCode 桌面版（2.2.6）会话正库适配（2026-11-24 现场取证）。
 *
 * 上一版把 OpenCode 判成「drafts.sqlite 索引级」：只数出 18 个 `ses_*` id，
 * `visible` 固定 null，正文是否完整没证据。这个判断不完整：
 * - 2.2.6 的真实数据根由 `XDG_DATA_HOME` 决定，本机 = `C:\caches\xdg\data\opencode`；
 * - 正库不是 drafts.sqlite，而是同目录下的 `opencode.db`；
 * - 正库表：`session_v2`（会话）、`session_message`（正文）、`credential`（凭证）、
 *   `account` / `account_state`（建表但运行时零读写，见 local-login.mjs 头注）；
 * - `drafts.sqlite` 只是 UI 草稿/输入框索引，不能拿来证明历史正文。
 *
 * 账号维度（不是猜）：
 * - `session_v2` 没有 `account_id` / `user_id` 列，只有 project_id / workspace_id；
 * - `credential` 才是登录面，`account` / `account_state` 不参与运行时；
 * - 因此切号只换 credential，库和会话不重建；旧会话在新号仍能打开，续聊由本地
 *   session + 当前 credential 发起，不存在「旧号云端映射」这一层。
 *
 * 本模块只做只读取证，不写库、不读 token 明文。
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** 数据根候选：XDG 优先（本机 2.2.6 实际落点），再兼容 POSIX/Windows 默认 */
export function opencodeDataDirs(env = process.env) {
  const home = String(env.USERPROFILE || env.HOME || '').trim()
  const xdg = String(env.XDG_DATA_HOME || '').trim()
  const localAppData = String(env.LOCALAPPDATA || '').trim()
  return [
    xdg && path.join(xdg, 'opencode'),
    home && path.join(home, '.local', 'share', 'opencode'),
    localAppData && path.join(localAppData, 'opencode'),
  ].filter(Boolean)
}

export function opencodeDbCandidates(env = process.env) {
  return opencodeDataDirs(env).map((dir) => path.join(dir, 'opencode.db'))
}

/** 安装面候选：主程序 OpenCode.exe；不把 opencode-cli.exe 当桌面端主程序 */
export function findOpenCodeInstall(env = process.env) {
  const localAppData = String(env.LOCALAPPDATA || '').trim()
  const programFiles = String(env.ProgramFiles || '').trim()
  const candidates = [
    localAppData && path.join(localAppData, 'Programs', 'ai.opencode.desktop', 'OpenCode.exe'),
    programFiles && path.join(programFiles, 'OpenCode', 'OpenCode.exe'),
    programFiles && path.join(programFiles, 'ai.opencode.desktop', 'OpenCode.exe'),
  ].filter(Boolean)
  for (const file of candidates) {
    if (fs.existsSync(file)) return { installed: true, path: file }
  }
  return { installed: false, path: '' }
}

function firstExisting(candidates) {
  for (const file of candidates) {
    if (file && fs.existsSync(file)) return file
  }
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

/**
 * 只读凭证面：只报条数/启用集成/账号表状态，不输出 token / refresh / 邮箱明文。
 * OpenCode 的 `credential.value` 是 JSON 明文，但本模块刻意不读它。
 */
export function readOpenCodeCredentialState(dbFile) {
  const out = {
    present: false,
    path: dbFile,
    credentialCount: 0,
    activeIntegrations: [],
    accountRows: 0,
    accountStateRows: 0,
    activeAccountId: '',
  }
  if (!dbFile || !isSqliteFile(dbFile)) return out
  const { DatabaseSync } = require('node:sqlite')
  let db
  try {
    db = new DatabaseSync(dbFile, { readOnly: true })
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r) => String(r.name))
    if (tables.includes('credential')) {
      out.credentialCount = Number(db.prepare(`SELECT count(*) AS n FROM credential`).get().n) || 0
      const active = db
        .prepare(
          `SELECT integration_id AS v, count(*) AS n FROM credential WHERE COALESCE(active,0)=1 GROUP BY integration_id ORDER BY n DESC LIMIT 5`,
        )
        .all()
      out.activeIntegrations = active.map((r) => ({ integration: String(r.v ?? ''), count: Number(r.n) || 0 }))
    }
    if (tables.includes('account')) out.accountRows = Number(db.prepare(`SELECT count(*) AS n FROM account`).get().n) || 0
    if (tables.includes('account_state')) {
      out.accountStateRows = Number(db.prepare(`SELECT count(*) AS n FROM account_state`).get().n) || 0
      const row = db.prepare(`SELECT active_account_id AS v FROM account_state LIMIT 1`).get()
      out.activeAccountId = String(row?.v ?? '')
    }
    out.present = out.credentialCount > 0 || out.accountRows > 0
    return out
  } catch {
    return out
  } finally {
    try {
      db?.close()
    } catch {
      /* 关不掉不影响结论 */
    }
  }
}

/**
 * OpenCode 正库探针。
 * @returns 与 chat-carry/probeProvider 兼容的只读结果
 */
export function probeOpenCode({ env = process.env } = {}) {
  const install = findOpenCodeInstall(env)
  const dbFile = firstExisting(opencodeDbCandidates(env))
  const base = {
    kind: 'sqlite',
    provider: 'opencode',
    located: false,
    path: '',
    table: 'session_v2',
    sessions: null,
    visible: null,
    messageCount: null,
    messageVisible: null,
    accountScoped: false,
    accountCols: [],
    notes: [],
    installPath: install.path,
    installed: install.installed,
  }

  if (!dbFile) {
    const dirs = opencodeDataDirs(env)
    return {
      ...base,
      notes: [
        install.installed
          ? `已安装 OpenCode,但数据根没有 opencode.db(候选:${dirs.join(' / ')});客户端还没建库或落点变了,当前不能报历史仍在`
          : `未找到 OpenCode 主程序,也没有 opencode.db;本机没有可核验的 OpenCode 会话面`,
      ],
      raw: { dataDirs: dirs, installPath: install.path },
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
    if (!tables.includes('session_v2')) {
      return {
        ...base,
        path: dbFile,
        notes: [`库内没有 session_v2 表(实读表:${tables.slice(0, 10).join(',')}…)`],
        raw: { dbPath: dbFile },
      }
    }
    const cols = tableCols(db, 'session_v2')
    if (!cols.includes('id')) {
      return {
        ...base,
        path: dbFile,
        notes: [`session_v2 缺 id 列(实读列:${cols.slice(0, 12).join(',')}…)`],
        raw: { dbPath: dbFile },
      }
    }
    const accountCols = cols.filter((c) => /(^|_)(user|account|uid|owner)(_id)?$/i.test(c) || /^(user|account|uid|owner)_?id$/i.test(c))
    const hasParent = cols.includes('parent_id')
    const hasArchived = cols.includes('time_archived')
    const rootWhere = hasParent ? "COALESCE(parent_id,'') = ''" : '1=1'
    const visibleWhere = hasArchived ? `${rootWhere} AND COALESCE(time_archived,0)=0` : rootWhere
    const total = Number(db.prepare(`SELECT count(*) AS n FROM session_v2 WHERE ${rootWhere}`).get().n) || 0
    const visible = Number(db.prepare(`SELECT count(*) AS n FROM session_v2 WHERE ${visibleWhere}`).get().n) || 0
    const allSessions = Number(db.prepare(`SELECT count(*) AS n FROM session_v2`).get().n) || 0
    let messageCount = null
    let messageVisible = null
    if (tables.includes('session_message')) {
      messageCount = Number(db.prepare(`SELECT count(*) AS n FROM session_message`).get().n) || 0
      try {
        messageVisible =
          Number(
            db
              .prepare(
                `SELECT count(*) AS n FROM session_message m JOIN session_v2 s ON s.id=m.session_id WHERE ${visibleWhere.replaceAll('parent_id', 's.parent_id').replaceAll('time_archived', 's.time_archived')}`,
              )
              .get().n,
          ) || 0
      } catch {
        messageVisible = null
      }
    }
    const credential = readOpenCodeCredentialState(dbFile)
    const notes = [
      `正库 ${dbFile}:顶层会话 ${total}(未归档可见 ${visible}),全部 session_v2 ${allSessions} 条;正文 session_message ${messageCount ?? '?'} 条(${messageVisible ?? '?'} 条属于未归档顶层会话)`,
      'session_v2 无 account_id/user_id 列;credential 才是登录面,account/account_state 运行时零读写 ⇒ 切号只换 credential,不重建库,旧会话在新号仍在',
    ]
    if (accountCols.length > 0) notes.push(`session_v2 出现账号列 ${accountCols.join(',')},与源码结论冲突,需按重绑处理`)
    if (hasArchived) notes.push('可见口径 = 顶层会话且 time_archived 为空/0;归档会话仍计入总数,不计入可见')
    if (credential.present) {
      notes.push(
        `凭证表 credential ${credential.credentialCount} 条,启用集成 ${credential.activeIntegrations.map((x) => x.integration || '(空)').join(',') || '(无)'};account 表 ${credential.accountRows} 行,account_state ${credential.accountStateRows} 行(不参与运行时)`,
      )
    } else {
      notes.push('credential 表为空:当前未登录,切号写回前先确认登录态')
    }
    return {
      ...base,
      located: true,
      path: dbFile,
      sessions: total,
      visible,
      messageCount,
      messageVisible,
      accountScoped: accountCols.length > 0,
      accountCols,
      schema: 'session_v2',
      notes,
      raw: {
        dbPath: dbFile,
        table: 'session_v2',
        rootSessions: total,
        allSessions,
        visible,
        messageCount,
        messageVisible,
        credential,
        installPath: install.path,
        dataDirs: opencodeDataDirs(env),
      },
    }
  } catch (e) {
    return { ...base, path: dbFile, notes: [`读库失败(可能被客户端独占):${e instanceof Error ? e.message : String(e)}`], raw: { dbPath: dbFile } }
  } finally {
    try {
      db?.close()
    } catch {
      /* 关不掉不影响结论 */
    }
  }
}

export const __test__ = {
  opencodeDataDirs,
  opencodeDbCandidates,
  findOpenCodeInstall,
  readOpenCodeCredentialState,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
