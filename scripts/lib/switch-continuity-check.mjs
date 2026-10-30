// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 切号前后可见性对账 —— Qoder CN / MiniMax Code 桌面端本地会话清单的快照与 diff。
 *
 * 立因(2026-10-30,继 Trae 携对话切号后的两支线):
 *   取证实证两端的对话正库**按工作区/设备组织、不含账号字段**
 *   (Qoder main.sqlite:chat_sessions/chat_session_messages 全库仅 3 表含 account 列,
 *    会话零绑定;MiniMax runtime-state.sqlite:53 会话 record_json 顶层无 user/account 键)
 *   ⇒ 机制上切号"天然随行";真正要答的问题是**产品 UI 登录新号后会不会换列表口径**
 *   (云端同步覆盖/隐藏)。答案不靠猜:切号前后各跑一次 snapshot,compare 给出逐条差集。
 *
 * 纪律:只读输入(对副本 checkpoint WAL,不碰在跑客户端的活库);清单只含 id 哈希与计数,
 * 绝不含消息正文/token;compare 的差集按会话 id 点名,供人工/后续腿判断。
 * 判机器状态 ⇒ 不进提交链(§12e)。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

export const APPS = Object.freeze({
  qoder: {
    label: 'Qoder CN',
    dbCandidates: ['C:/Users/Administrator/AppData/Roaming/com.qodercn.app.stable/main.sqlite'],
    // 会话清单:按 session_id 计数 + FTS 覆盖数
    sessions: { table: 'chat_sessions', idCol: 'session_id', where: 'deleted_at IS NULL' },
    messages: { table: 'chat_session_messages', idCol: 'message_id', sessionCol: 'session_id' },
    accountCols: ['account_profiles.account_id'],
  },
  minimax: {
    label: 'MiniMax Code',
    dbCandidates: ['C:/Users/Administrator/.minimax/v2/sqlite/runtime-state.sqlite'],
    sessions: { table: 'local_runtime_sessions', idCol: 'session_id' },
    messages: { table: 'local_runtime_message_rows', idCol: 'id', sessionCol: 'session_id' },
    accountCols: [],
  },
})

export class CheckError extends Error {
  constructor(message, code = 'switch-check') {
    super(message)
    this.name = 'CheckError'
    this.code = code
  }
}

/**
 * 候选库枚举:沙箱 home / 真账号 profile / APPDATA 重定向各可能持有数据(本机实锤:
 * Loomy 沙箱身份的 .minimax 存在但 0 行,Administrator 的才有 53 场会话)。
 * 绝不"取第一个存在的" —— 那会把"从没登过记的身份"冒充成本机会话面。
 */
export function locateDbAll(appKey, env = process.env) {
  const spec = APPS[appKey]
  if (!spec) throw new CheckError(`不认识的应用:${appKey}(可用 = ${Object.keys(APPS).join('/')})`, 'bad-app')
  const out = []
  const push = (p) => {
    if (p && fs.existsSync(p)) {
      const abs = path.resolve(p)
      if (!out.some((x) => x === abs)) out.push(abs)
    }
  }
  const home = os.homedir().replace(/\\/g, '/')
  for (const c of spec.dbCandidates) {
    push(c.replace('C:/Users/Administrator', home))
    push(c)
    if (env.APPDATA) {
      const rel = c.replace(/^C:\/Users\/[^/]+\/AppData\/Roaming\//, '')
      if (rel !== c) push(path.join(env.APPDATA, rel))
    }
  }
  // 跨 profile 兜底(与 trae-auth-extract 同法,连它的关闭开关也同法:IHUI_TRAE_SCAN_USERS=0 ⇒ 关扫描档)
  const usersRoot = 'C:/Users'
  if (String(env.IHUI_TRAE_SCAN_USERS ?? '').trim() !== '0' && fs.existsSync(usersRoot)) {
    for (const u of fs.readdirSync(usersRoot)) {
      for (const c of spec.dbCandidates) {
        const rel = c.replace(/^C:\/Users\/[^/]+\//, '')
        push(`${usersRoot}/${u}/${rel}`)
      }
    }
  }
  return out
}

/**
 * 定位"本机现役会话面":候选按本应用会话表行数打分,取最大者;
 * 全 0 ⇒ {file:null, cands}(调用方如实报"存在库文件但零会话",不冒充未装)。
 */
export function pickRichestDb(appKey, env = process.env) {
  const spec = APPS[appKey]
  const cands = locateDbAll(appKey, env)
  const scored = []
  for (const f of cands) {
    let n = -1
    let h = null
    try {
      h = new DatabaseSync(f, { readOnly: true })
      const t = h.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => String(r.name))
      if (t.includes(spec.sessions.table)) n = Number(h.prepare(`SELECT COUNT(*) c FROM "${spec.sessions.table}"`).get().c)
    } catch {
      /* 该候选读不成(被占/非 SQLite)⇒ 记 -1 不猜 */
    } finally {
      try {
        h?.close()
      } catch {
        /* ignore */
      }
    }
    scored.push({ file: f, sessions: n })
  }
  scored.sort((a, b) => b.sessions - a.sessions)
  const best = scored[0]
  return { file: best && best.sessions > 0 ? best.file : null, scored }
}

/** 对副本做 WAL checkpoint 后打开(只读输入哲学:绝不锁客户的活库) */
export function openReadOnlyCopy(dbFile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir() || os.homedir(), 'ihui-switch-check-'))
  const copy = path.join(dir, 'snap.sqlite')
  fs.copyFileSync(dbFile, copy)
  for (const ext of ['-wal', '-shm']) {
    if (fs.existsSync(dbFile + ext)) fs.copyFileSync(dbFile + ext, copy + ext)
  }
  let merged = false
  try {
    const rw = new DatabaseSync(copy)
    rw.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    rw.close()
    merged = true
  } catch {
    /* checkpoint 不成 ⇒ 退只读主库,在结果里如实标 wal_unmerged */
  }
  const db = new DatabaseSync(copy, { readOnly: true })
  return { db, dir, merged }
}

const fp = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12)

/** 采一枚会话清单:ids 排序后哈希 + 条数(不含正文) */
export function digestSet(db, sql, params = []) {
  const rows = db.prepare(sql).all(...params)
  const ids = rows.map((r) => String(Object.values(r)[0])).sort()
  const h = crypto.createHash('sha1').update(ids.join('\n')).digest('hex')
  return { count: ids.length, digest: h.slice(0, 16), ids }
}

export function snapshotApp(appKey, opts = {}) {
  const env = opts.env ?? process.env
  const picked = opts.dbPath ? { file: opts.dbPath, scored: [{ file: opts.dbPath, sessions: -1 }] } : pickRichestDb(appKey, env)
  if (!picked.file) {
    const exists = picked.scored.length > 0
    return {
      app: appKey,
      state: 'undetermined',
      why: exists
        ? `找到 ${picked.scored.length} 个库文件但会话全为 0 或读不成(可能本机该身份从未用过它):${picked.scored.map((s) => `${s.file}=${s.sessions}`).join(' | ')}`
        : '本机找不到该应用的正库(未装/未登录/路径变了)',
    }
  }
  const dbFile = picked.file
  const spec = APPS[appKey]
  const { db, dir, merged: walMerged } = openReadOnlyCopy(dbFile)
  try {
    const s = spec.sessions
    const where = s.where ? ` WHERE ${s.where}` : ''
    const sess = digestSet(db, `SELECT "${s.idCol}" FROM "${s.table}"${where}`)
    let msgs = null
    if (spec.messages) {
      const m = spec.messages
      msgs = digestSet(db, `SELECT "${m.idCol}" FROM "${m.table}"`)
    }
    const perSession = sess.count > 0 && spec.messages
      ? db.prepare(`SELECT COUNT(DISTINCT "${spec.messages.sessionCol}") c FROM "${spec.messages.table}"`).get()
      : null
    const acc = (spec.accountCols || []).map((ac) => {
      const [t, c] = ac.split('.')
      try {
        return db.prepare(`SELECT DISTINCT "${c}" v FROM "${t}" LIMIT 5`).all().map((r) => fp(String(r.v)))
      } catch {
        return null
      }
    })
    return {
      app: appKey,
      label: spec.label,
      state: 'ok',
      dbFile,
      walMerged,
      takenAt: new Date().toISOString(),
      sessions: { count: sess.count, digest: sess.digest },
      messageRows: msgs ? { count: msgs.count, digest: msgs.digest } : null,
      sessionsWithMessages: perSession ? Number(perSession.c) : null,
      accountDigests: acc.filter(Boolean).flat(),
      sessionIds: sess.ids.map(fp),
    }
  } finally {
    db.close()
    try {
      for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true })
      fs.rmdirSync(dir)
    } catch {
      /* 残留只报不炸 */
    }
  }
}

/** 两份快照对比:新号侧丢了哪些会话(按 fp 点名)、多了哪些 */
export function compareSnapshots(before, after) {
  if (before.state !== 'ok' || after.state !== 'ok') {
    return {
      verdict: 'undetermined',
      why: `一侧快照未判定(before=${before.state} after=${after.state}):${before.why || ''}${after.why || ''}`,
    }
  }
  const b = new Set(before.sessionIds)
  const a = new Set(after.sessionIds)
  const lost = before.sessionIds.filter((x) => !a.has(x))
  const gained = after.sessionIds.filter((x) => !b.has(x))
  return {
    verdict: lost.length === 0 ? 'continuity-ok' : 'continuity-broken',
    beforeSessions: before.sessions.count,
    afterSessions: after.sessions.count,
    lostFp: lost,
    gainedFp: gained,
    messageRowsBefore: before.messageRows?.count ?? null,
    messageRowsAfter: after.messageRows?.count ?? null,
    note:
      lost.length === 0
        ? `切号后本地会话清单完整在位(${before.sessions.count} 场)`
        : `⚠️ 切号后有 ${lost.length} 场会话不在清单 ⇒ 产品 UI 按账号换列表,需做携号迁移腿`,
  }
}

export const __test__ = {
  APPS,
  CheckError,
  locateDbAll,
  pickRichestDb,
  digestSet,
  snapshotApp,
  compareSnapshots,
  openReadOnlyCopy,
  fp,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
