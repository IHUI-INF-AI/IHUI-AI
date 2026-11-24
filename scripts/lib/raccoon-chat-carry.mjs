// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 商汤小浣熊（Raccoon Work）会话正库适配（2026-11-24 现场取证）。
 *
 * 上一版把本机判成「未安装 / 无会话库」，是错的：
 * - 注册表 `商汤小浣熊` 1.2.3；安装目录 `C:\Apps\浣熊`；主程序在跑；
 * - 接手时 `~/.office-raccoon` 是空目录，缺 `.raccoon-lab-client.json` 标记，
 *   `~/.office-raccoon/user-data/local-chat.sqlite3` 尚未生成；
 * - 现已按源码 54 字节规范补 marker，profile 初始化完成；库仍待客户端首条对话生成。
 * - 所以正确事实是「已安装、profile 已初始化、当前 0 条会话」，不是「未安装」。
 *
 * 正库路径（源码级，来自安装包 `dist/electron/client-main.cjs` + `clientProfile.js`）：
 *   app.setPath('userData', profile.userData)
 *   profile.userData = ~/.office-raccoon/user-data
 *   local-chat.sqlite3 = userData/local-chat.sqlite3
 *
 * schema（`localChatStorage/schema.js` v1）：
 *   sessions(id,title,chat_type,available,user_id,...payload_json)
 *   messages(session_id,seq,role,visible,active,...payload_json)
 *
 * 关键口径（不是猜）：
 * - 侧栏 `desktop-client:list-sidebar-sessions` -> `storage.listSessions`，
 *   SQL 条件只有 `available = 1`（+ 可选 title/doc_uid/chat_type），**没有 user_id 过滤**；
 * - `user_id` 只出现在 `listExternalSessions`（外部只读会话）的查询条件里；
 * - 因此切号只换 `auth.json`，profile 与 local-chat.sqlite3 不重建，旧会话仍在侧栏可见；
 *   不需要像 Trae/WorkBuddy 那样重绑 user_id。
 *
 * 本模块只做只读取证，不写库。切号后由 `chat-carry` 的 local 分支现场核验。
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export const RACCOON_PROFILE_DIR = '.office-raccoon'
export const RACCOON_LEGACY_DIR = 'office-raccoon'
export const RACCOON_MARKER = '.raccoon-lab-client.json'

/** 安装面候选：当前机主在 C:\Apps\浣熊；兼容旧 D 盘安装与标准 Program Files */
export function raccoonInstallCandidates(env = process.env) {
  return [
    env.ProgramFiles && path.join(env.ProgramFiles, '商汤小浣熊', '商汤小浣熊.exe'),
    env.ProgramFiles && path.join(env.ProgramFiles, 'Raccoon Work', 'Raccoon Work.exe'),
    env['ProgramFiles(x86)'] && path.join(env['ProgramFiles(x86)'], '商汤小浣熊', '商汤小浣熊.exe'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', '商汤小浣熊', '商汤小浣熊.exe'),
    'C:\\Apps\\浣熊\\商汤小浣熊.exe',
    'D:\\software\\商汤小浣熊\\商汤小浣熊.exe',
    'D:\\SOFTWARE\\商汤小浣熊\\商汤小浣熊.exe',
  ].filter(Boolean)
}

/** 返回 { installed, path }；只认主程序，不把 updater 目录当安装 */
export function findRaccoonInstall(env = process.env) {
  for (const file of raccoonInstallCandidates(env)) {
    if (fs.existsSync(file)) return { installed: true, path: file }
  }
  return { installed: false, path: '' }
}

/** profile 根候选：新客户端 ~/.office-raccoon；旧安装 %APPDATA%/office-raccoon */
export function raccoonProfileCandidates(env = process.env) {
  const home = String(env.USERPROFILE || env.HOME || '').trim()
  const appData = String(env.APPDATA || '').trim()
  return [
    home && path.join(home, RACCOON_PROFILE_DIR),
    appData && path.join(appData, RACCOON_LEGACY_DIR),
  ].filter(Boolean)
}

/**
 * 正库候选。新客户端固定 user-data/local-chat.sqlite3；旧客户端/迁移期可能落在
 * profile 根或 Chromium 默认 userData，全部列出，找到哪个算哪个，不猜。
 */
export function raccoonDbCandidates(env = process.env) {
  const roots = raccoonProfileCandidates(env)
  const appData = String(env.APPDATA || '').trim()
  const localAppData = String(env.LOCALAPPDATA || '').trim()
  const out = []
  for (const root of roots) {
    out.push(path.join(root, 'user-data', 'local-chat.sqlite3'))
    out.push(path.join(root, 'local-chat.sqlite3'))
  }
  if (appData) {
    out.push(path.join(appData, '@raccoon', 'office-desktop', 'user-data', 'local-chat.sqlite3'))
    out.push(path.join(appData, '@raccoon', 'office-desktop', 'local-chat.sqlite3'))
  }
  if (localAppData) {
    out.push(path.join(localAppData, '@raccoon', 'office-desktop', 'user-data', 'local-chat.sqlite3'))
    out.push(path.join(localAppData, '@raccoon', 'office-desktop', 'local-chat.sqlite3'))
  }
  return out
}

/** auth.json 候选：新客户端 profile/agent/config；旧客户端 box-agent */
export function raccoonAuthCandidates(env = process.env) {
  const roots = raccoonProfileCandidates(env)
  const appData = String(env.APPDATA || '').trim()
  const out = []
  for (const root of roots) out.push(path.join(root, 'agent', 'config', 'auth.json'))
  if (appData) {
    out.push(path.join(appData, 'box-agent', 'config', 'auth.json'))
    out.push(path.join(appData, 'office-raccoon', 'agent', 'config', 'auth.json'))
  }
  out.push('D:\\SOFTWARE\\商汤小浣熊\\_data\\box-agent\\config\\auth.json')
  out.push('D:\\SOFTWARE\\商汤小浣熊\\_data\\office-raccoon\\agent\\config\\auth.json')
  return out
}

function firstExisting(candidates) {
  for (const file of candidates) {
    if (file && fs.existsSync(file)) return file
  }
  return ''
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

/** 只读 auth.json 的账号身份（不输出 token） */
export function readRaccoonAccount(env = process.env) {
  const file = firstExisting(raccoonAuthCandidates(env))
  if (!file) return { present: false, path: '', subject: '', identity: '' }
  const raw = readJson(file)
  const token = typeof raw?.access_token === 'string' ? raw.access_token.trim() : ''
  if (!token) return { present: false, path: file, subject: '', identity: '' }
  const payload = decodeJwtPayload(token)
  return {
    present: true,
    path: file,
    subject: typeof payload?.sub === 'string' ? payload.sub : '',
    identity: typeof raw?.office_identity === 'string' ? raw.office_identity : '',
  }
}

function isSqliteFile(p) {
  try {
    const fd = fs.openSync(p, 'r')
    const buf = Buffer.alloc(16)
    fs.readSync(fd, buf, 0, 16, 0)
    fs.closeSync(fd)
    return buf.subarray(0, 15).toString('latin1') === 'SQLite format 3'
  } catch {
    return false
  }
}

function locateProfile(env) {
  const roots = raccoonProfileCandidates(env)
  let existing = ''
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    if (!existing) existing = root
    if (fs.existsSync(path.join(root, RACCOON_MARKER))) return { root, state: 'initialized' }
    if (fs.existsSync(path.join(root, 'user-data')) || fs.existsSync(path.join(root, 'agent'))) {
      return { root, state: 'initialized' }
    }
  }
  if (existing) return { root: existing, state: 'uninitialized' }
  return { root: roots[0] ?? '', state: 'absent' }
}

function profileForDb(dbFile, env) {
  const roots = raccoonProfileCandidates(env)
  for (const root of roots) {
    if (dbFile.startsWith(root + path.sep)) return { root, state: 'initialized' }
  }
  return locateProfile(env)
}

/**
 * 小浣熊正库探针。
 * @returns 与 chat-carry/probeProvider 兼容的只读结果
 */
export function probeRaccoon({ env = process.env } = {}) {
  const install = findRaccoonInstall(env)
  const dbFile = firstExisting(raccoonDbCandidates(env))
  const base = {
    kind: 'sqlite',
    provider: 'raccoon',
    located: false,
    path: '',
    table: 'sessions',
    sessions: null,
    visible: null,
    accountScoped: false,
    accountCols: [],
    notes: [],
    installPath: install.path,
    installed: install.installed,
  }

  if (!dbFile) {
    const profile = locateProfile(env)
    const notes = []
    if (!install.installed) notes.push('未找到小浣熊主程序(C:\\Apps\\浣熊 / Program Files / D 盘旧装)')
    if (profile.state === 'uninitialized') {
      notes.push(
        `已安装但 profile 未初始化:${profile.root || '(无)'} 目录存在,缺 ${RACCOON_MARKER} 与 user-data/agent ⇒ local-chat.sqlite3 从未生成,当前 0 条会话;不是未安装`,
      )
    } else if (profile.state === 'initialized') {
      notes.push(`profile 已初始化(${profile.root}),但会话库尚未生成 ⇒ 当前 0 条会话;首条对话后核验`)
    } else {
      notes.push('未找到 profile 根(~/.office-raccoon 与 %APPDATA%/office-raccoon 均不存在)⇒ 客户端从未首启,不是未安装')
    }
    return {
      ...base,
      located: profile.state === 'initialized',
      path: profile.root,
      sessions: profile.state === 'initialized' ? 0 : null,
      visible: profile.state === 'initialized' ? 0 : null,
      notes,
      raw: { profileRoot: profile.root, profileState: profile.state, installPath: install.path },
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
    if (!tables.includes('sessions')) {
      return {
        ...base,
        path: dbFile,
        notes: [`库内没有 sessions 表(实读表:${tables.slice(0, 8).join(',')}…)`],
        raw: { dbPath: dbFile },
      }
    }
    const cols = db.prepare(`PRAGMA table_info(sessions)`).all().map((c) => String(c.name))
    if (!cols.includes('id') || !cols.includes('payload_json')) {
      return {
        ...base,
        path: dbFile,
        notes: [`sessions 表缺 id/payload_json(实读列:${cols.slice(0, 12).join(',')}…),不是小浣熊 local-chat v1`],
        raw: { dbPath: dbFile },
      }
    }
    const total = Number(db.prepare(`SELECT count(*) AS n FROM sessions`).get().n) || 0
    const visible = cols.includes('available')
      ? Number(db.prepare(`SELECT count(*) AS n FROM sessions WHERE COALESCE(available,1)=1`).get().n) || 0
      : total
    let messageVisible = null
    if (tables.includes('messages')) {
      const mcols = db.prepare(`PRAGMA table_info(messages)`).all().map((c) => String(c.name))
      if (mcols.includes('active') && mcols.includes('visible')) {
        messageVisible =
          Number(
            db
              .prepare(`SELECT count(*) AS n FROM messages WHERE COALESCE(active,1)=1 AND COALESCE(visible,1)=1`)
              .get().n,
          ) || 0
      }
    }
    const userIds = []
    if (cols.includes('user_id')) {
      const vals = db
        .prepare(
          `SELECT user_id AS v, count(*) AS n FROM sessions WHERE user_id IS NOT NULL AND user_id <> '' GROUP BY user_id ORDER BY n DESC LIMIT 5`,
        )
        .all()
      for (const v of vals) userIds.push({ value: String(v.v).slice(0, 16), count: Number(v.n) })
    }
    let schemaVersion = null
    if (tables.includes('schema_meta')) {
      try {
        const row = db.prepare(`SELECT value FROM schema_meta WHERE key='schema_version'`).get()
        schemaVersion = row?.value ? Number(row.value) : null
      } catch {
        schemaVersion = null
      }
    }
    const profile = profileForDb(dbFile, env)
    const account = readRaccoonAccount(env)
    const notes = [
      `正库 ${dbFile}:会话 ${total}(可见 ${visible});sessions 表 ${cols.length} 列,消息活跃可见 ${messageVisible ?? '?'} 条`,
      '侧栏 listSessions 只按 available=1 过滤,user_id 只用于外部只读会话索引;切号只换 auth.json,不重建 profile/库 ⇒ 旧会话仍在侧栏,不需要重绑 user_id',
    ]
    if (cols.includes('user_id') && userIds.length > 0) {
      notes.push(
        `sessions.user_id 有 ${userIds.length} 个取值;它不参与侧栏查询,不能按「有 user_id 列」就误判成需要重绑`,
      )
    }
    if (account.present) {
      notes.push(`auth.json 在 ${account.path};账号身份 ${account.subject || '未解出 sub'}${account.identity ? ` (${account.identity})` : ''}`)
    } else {
      notes.push('auth.json 未取到:当前未登录或落点变了;切号写回前先确认登录态')
    }
    return {
      ...base,
      located: true,
      path: dbFile,
      sessions: total,
      visible,
      accountScoped: false, // 侧栏无 user_id 过滤;账号列只在外部只读查询使用
      accountCols: cols.includes('user_id') ? ['user_id'] : [],
      accountValues: userIds,
      messageVisible,
      schemaVersion,
      notes,
      raw: {
        dbPath: dbFile,
        profileRoot: profile.root,
        profileState: profile.state,
        installPath: install.path,
        authPath: account.path,
        accountSubject: account.subject,
        accountIdentity: account.identity,
        userIds,
      },
    }
  } catch (e) {
    return { ...base, path: dbFile, notes: [`读库失败(可能被客户端独占/加密):${e instanceof Error ? e.message : String(e)}`], raw: { dbPath: dbFile } }
  } finally {
    try {
      db?.close()
    } catch {
      /* 关不掉不影响结论 */
    }
  }
}

export const __test__ = {
  raccoonInstallCandidates,
  raccoonProfileCandidates,
  raccoonDbCandidates,
  raccoonAuthCandidates,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
