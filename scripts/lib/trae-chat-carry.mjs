// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 切号携带对话 —— 把本机 Trae(AI IDE)登录态从 A 号换到 B 号时,
 * 把 A 号的对话记录(正库 + 工作区/全局状态 + 签到标记)整体重绑到 B 号名下。
 *
 * 立因(2026-10-30,机主强制令"必须解决"):号池一键切号已上线(trae-client-switch),
 * 但切过去后客户端按 userId 前缀读本地态,旧号对话"看不见"。本机取证实证(全部现读,证据):
 *   1) 对话正文在 ModularData\ai-agent\database.db(SQLCipher 4,页级解密见 trae-sqlcipher.mjs,
 *      真实库 112,491 页 HMAC 全过,62 表:chat_message=1134 / history_v2=16,166(server_history_info=34,700);
 *      chat_session/chat_message 行本体 不含 user_id(按 session_id 组织)⇒ 正文可原样保留;
 *   2) 账号绑定只出现在四处:
 *      a. database.db:project.user_id(3 行)、user_configuration.user_id、session_project(0 行)、
 *         server_history_info.user_id(本机实读全 NULL);
 *      b. globalStorage\state.vscdb 的 ItemTable 键前缀 `<uid>:*`(实读 83/196 枚);
 *      c. workspaceStorage\*\state.vscdb 的 ItemTable 键前缀 `<uid>_*`(实读 10/121 枚);
 *      d. storage.json 的 `icube.checkin1024.<uid>.*` 键(2 枚)+ 信封明文里的 userId 字段;
 *      e. conversation-tips\*.json 文件名含 `<uid>.`(3 枚)。
 *   迁移 = 关端 → WAL 落盘 → 解密正库 → 四处重绑 → 重加密回 SQLCipher → 写回(storage/vscdb/文件名) → 开客户端。
 *
 * 分工(§0.6):本模块 = 纯函数 + 本机文件/SQLite 操作,不连号池库不发网络;
 * 号池取数与信封写回复用 trae-client-switch(切号动作本身仍是它那条链,本模块补"对话随行"这一段)。
 *
 * 纪律:客户端在跑绝不动它的数据(与切号同规,由调用方先 close);所有写盘先备份 .pre-carry.bak;
 * 任一环节失败,编排层用备份整组回滚。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { traeUserDataDirs, decryptEnvelope, encryptEnvelope } from './trae-auth-extract.mjs'
import * as SC from './trae-sqlcipher.mjs'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

const UID_RE = /^\d{6,32}$/

export class CarryError extends Error {
  constructor(message, code = 'carry-failed') {
    super(message)
    this.name = 'CarryError'
    this.code = code
  }
}

/** 从解密信封明文里取 userId(顶层或 account.userId;取不到 ⇒ null) */
export function userIdFromUserInfo(parsed) {
  if (!parsed || typeof parsed !== 'object') return null
  const direct = parsed.userId ?? parsed.user_id
  if (direct !== undefined && direct !== null && UID_RE.test(String(direct))) return String(direct)
  const acc = parsed.account
  if (acc && typeof acc === 'object') {
    const v = acc.userId ?? acc.uid
    if (v !== undefined && v !== null && UID_RE.test(String(v))) return String(v)
  }
  return null
}

/**
 * 正库重绑(纯 SQL 计划,入参 = 打开的 DatabaseSync 明文句柄)。
 * 返回逐表改动计数。只认"旧 uid 的行",绝不整表覆写(新号已有行原样保留)。
 */
export function rebindDatabase(db, oldUid, newUid) {
  const changed = {}
  const uidCols = {
    project: 'user_id',
    user_configuration: 'user_id',
    server_history_info: 'user_id',
    chat_session: 'user_id',
  }
  // 先量"旧号非空行数"(NULL 归并的前提凭据),再 UPDATE —— 顺序反了归并判据永远读 0
  const ownedBefore = {}
  for (const table of Object.keys(uidCols)) {
    try {
      ownedBefore[table] = Number(db.prepare(`SELECT COUNT(*) c FROM "${table}" WHERE user_id = ?`).get(oldUid).c)
    } catch {
      ownedBefore[table] = 0
    }
  }
  for (const [table, col] of Object.entries(uidCols)) {
    try {
      const r = db.prepare(`UPDATE "${table}" SET "${col}" = ? WHERE "${col}" = ?`).run(newUid, oldUid)
      changed[table] = Number(r.changes)
    } catch {
      changed[table] = 0 // 无该列(SQLCipher 版本差异)⇒ 不判错,记 0 由汇总层报数
    }
  }
  // user_id 为 NULL/'' 且本机确有旧号行(实证 server_history_info user_id 全 NULL 的形态):
  // 这类行属"本机历史",归到收号名下才看得见 —— 只在该表存在旧号非空行时才做 NULL 归并,
  // 避免在共享环境把别人的匿名行错挂(失效方向 = 少并,不少报)。
  for (const table of ['server_history_info', 'chat_session']) {
    if (!(table in changed)) continue
    if (ownedBefore[table] <= 0) continue
    try {
      const r = db.prepare(`UPDATE "${table}" SET user_id = ? WHERE user_id IS NULL OR user_id = ''`).run(newUid)
      changed[`${table}:null-merge`] = Number(r.changes)
    } catch {
      /* 无 user_id 列或表不存在 ⇒ 不动 */
    }
  }
  return changed
}

/** ItemTable 键重绑的纯计划:返回 [{ from, to }]。值不动(实证值不含 uid;编排层另跑 keysInValues 自检)。 */
export function planKeyRenames(keys, oldUid, newUid) {
  const out = []
  for (const k of keys) {
    if (!k.includes(oldUid)) continue
    out.push({ from: k, to: k.split(oldUid).join(newUid) })
  }
  return out
}

/**
 * 对 state.vscdb(global/workspace 同构)执行键重绑。
 * collide = 改名后撞上新号已有键 ⇒ 保新号的值、旧行删除前备份进返回值(不静默吞)。
 */
export function rebindVscdb(file, oldUid, newUid) {
  const db = new DatabaseSync(file)
  try {
    const keys = db.prepare('SELECT key FROM ItemTable').all().map((r) => String(r.key))
    const plan = planKeyRenames(keys, oldUid, newUid)
    const existing = new Set(keys)
    const renamed = []
    const collisions = []
    db.exec('BEGIN')
    try {
      for (const { from, to } of plan) {
        if (existing.has(to)) {
          const oldVal = db.prepare('SELECT value FROM ItemTable WHERE key = ?').get(from)
          collisions.push({ key: to, droppedOldValue: oldVal ? oldVal.value : null })
          db.prepare('DELETE FROM ItemTable WHERE key = ?').run(from)
        } else {
          db.prepare('UPDATE ItemTable SET key = ? WHERE key = ?').run(to, from)
          renamed.push({ from, to })
        }
      }
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
    return { renamed: renamed.length, collisions: collisions.length, details: { renamed, collisions } }
  } finally {
    db.close()
  }
}

/** storage.json:checkin 标记键改名 + 信封内 userId 重封(复用 auth-extract 的信封原/收封函数) */
export function rebindStorageJson(store, oldUid, newUid) {
  const next = { ...store }
  const actions = []
  for (const [k, v] of Object.entries(store ?? {})) {
    if (!k.includes(oldUid)) continue
    const nk = k.split(oldUid).join(newUid)
    delete next[k]
    next[nk] = v
    actions.push({ kind: 'key-rename', from: k, to: nk })
  }
  const { AUTH_KEY } = { AUTH_KEY: 'iCubeAuthInfo://icube.cloudide' }
  if (typeof next[AUTH_KEY] === 'string') {
    try {
      const parsed = JSON.parse(decryptEnvelope(next[AUTH_KEY]))
      const found = userIdFromUserInfo(parsed)
      if (found === oldUid) {
        parsed.userId = newUid
        if (parsed.account && typeof parsed.account === 'object') parsed.account.userId = newUid
        next[AUTH_KEY] = encryptEnvelope(JSON.stringify(parsed))
        actions.push({ kind: 'envelope-uid-rebind' })
      }
    } catch (e) {
      actions.push({ kind: 'envelope-skip', reason: String(e?.message ?? e).slice(0, 80) })
    }
  }
  return { next, actions }
}

/** conversation-tips 文件名含旧 uid 的 ⇒ 返回改名计划(编排层负责执行与备份) */
export function planTipsRenames(userDataDir, oldUid, newUid) {
  const dir = path.join(userDataDir, 'conversation-tips')
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const name of fs.readdirSync(dir)) {
    if (name.includes(oldUid)) {
      out.push({ from: path.join(dir, name), to: path.join(dir, name.split(oldUid).join(newUid)) })
    }
  }
  return out
}

/** 正库落点定位:userDataDir\ModularData\ai-agent\database.db(不存在 ⇒ null) */
export function locateAgentDatabase(userDataDir) {
  const f = path.join(userDataDir, 'ModularData', 'ai-agent', 'database.db')
  return fs.existsSync(f) ? f : null
}

/**
 * WAL 合并:对 database.db(+ -wal)做 checkpoint,产出"已含 WAL 帧"的单一密文库 Buffer。
 * 手法 = 复制 pair 到 scratch → node:sqlite 开 RW 触发 checkpoint(TRUNCATE)→ 读回。
 * scratch 必清理;合并后原 -wal 不再需要参与解密。
 */
export function readDbWithWal(dbFile) {
  const scratch = path.join(
    os.tmpdir() || os.homedir(),
    `ihui-carry-${process.pid}-${Date.now()}`,
  )
  fs.mkdirSync(scratch, { recursive: true })
  const copy = path.join(scratch, 'database.db')
  try {
    fs.copyFileSync(dbFile, copy)
    const walFile = `${dbFile}-wal`
    if (fs.existsSync(walFile)) fs.copyFileSync(walFile, `${copy}-wal`)
    let merged = null
    try {
      const db = new DatabaseSync(copy)
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      db.close()
      merged = copy
    } catch {
      merged = copy // checkpoint 失败 ⇒ 退化为只读主库(丢在途帧,由调用方知悉)
    }
    const buf = fs.readFileSync(merged)
    const walBytes = fs.existsSync(`${copy}-wal`) ? fs.statSync(`${copy}-wal`).size : 0
    return { buf, walBytesMerged: walBytes > 24 ? walBytes - 24 : 0 }
  } finally {
    try {
      for (const f of fs.readdirSync(scratch)) fs.rmSync(path.join(scratch, f), { force: true })
      fs.rmdirSync(scratch)
    } catch {
      /* 清理失败不掩盖主结果 */
    }
  }
}

/** 备份:目标文件 → `<file>.pre-carry.bak`(存在则覆盖为最新一轮);返回备份路径 */
export function atomicBackupAndWrite(targetFile, contentBuf) {
  const bak = `${targetFile}.pre-carry.bak`
  if (fs.existsSync(targetFile)) fs.copyFileSync(targetFile, bak)
  const tmp = `${targetFile}.carry-tmp`
  fs.writeFileSync(tmp, contentBuf)
  fs.renameSync(tmp, targetFile)
  return bak
}

/**
 * 写回前的自证:新密文库必须(a)逐页 HMAC 可过、(b)解密回明文后关键表行数与重绑后的明文一致。
 * 不过 ⇒ 抛错,绝不让 Trae 面对半损坏库。
 */
export function verifyRebuiltCipher(plainBuf, cipherBuf, encKey) {
  const back = SC.decryptDatabase(encKey, cipherBuf)
  // 用临时文件对拍行数(表清单按 sqlite_master 现算,不硬编码)
  const dir = fs.mkdtempSync(path.join(os.tmpdir() || os.homedir(), 'ihui-carry-verify-'))
  const fa = path.join(dir, 'a.db')
  const fb = path.join(dir, 'b.db')
  try {
    fs.writeFileSync(fa, plainBuf)
    fs.writeFileSync(fb, back)
    const da = new DatabaseSync(fa, { readOnly: true })
    const dbb = new DatabaseSync(fb, { readOnly: true })
    try {
      const tables = da
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all()
        .map((r) => String(r.name))
      const mismatch = []
      for (const t of tables) {
        try {
          const ca = da.prepare(`SELECT COUNT(*) c FROM "${t}"`).get().c
          const cb = dbb.prepare(`SELECT COUNT(*) c FROM "${t}"`).get().c
          if (Number(ca) !== Number(cb)) mismatch.push(`${t}:${ca}!=${cb}`)
        } catch {
          mismatch.push(`${t}:unreadable`)
        }
      }
      if (mismatch.length) throw new CarryError(`重加密自证失败:${mismatch.slice(0, 8).join(', ')}`, 'selfcheck')
      return { tables: tables.length, ok: true }
    } finally {
      da.close()
      dbb.close()
    }
  } finally {
    for (const f of [fa, fb]) {
      try {
        fs.rmSync(f, { force: true })
      } catch {
        /* ignore */
      }
    }
    try {
      fs.rmdirSync(dir)
    } catch {
      /* ignore */
    }
  }
}

/**
 * 文件级正库重绑:解密 → 重绑 → 往返自证 → 重加密写回(原子 + .pre-carry.bak)。
 * tsx 编排层与离线验收共用这一条(§0.6 判据单源);opts.backupDir 提供时,
 * 原密文库先整件复制过去(回滚凭据)。返回逐表计数与规模读数。
 */
export async function rebindAgentDbFile(dbFile, opts = {}) {
  const oldUid = String(opts.oldUid ?? '')
  const newUid = String(opts.newUid ?? '')
  if (!oldUid || !newUid) throw new CarryError('重绑需要 oldUid/newUid', 'bad-args')
  const dllPath = String(opts.dllPath ?? '')
  if (!dllPath || !fs.existsSync(dllPath)) throw new CarryError('取不到 ai_agent.dll ⇒ 无法按版本核密钥(未判定)', 'no-dll')
  const { readDbWithWal } = await import('./trae-chat-carry.mjs')
  const { buf: cipherBuf } = readDbWithWal(dbFile)
  const keyRes = SC.deriveGlobalKey({ dllBuf: fs.readFileSync(dllPath) })
  if (!SC.probe(keyRes.key, cipherBuf).keyMatches) throw new CarryError('全局密钥与本机正库不匹配(版本变更?)', 'key-mismatch')
  const plain = SC.decryptDatabase(keyRes.key, cipherBuf)
  const scratchFile = path.join(path.dirname(dbFile), `.carry-plain-${process.pid}-${Date.now()}.db`)
  fs.writeFileSync(scratchFile, plain)
  try {
    const { DatabaseSync: DSB } = await import('node:sqlite')
    const pdb = new DSB(scratchFile)
    let reb
    try {
      reb = rebindDatabase(pdb, oldUid, newUid)
      pdb.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    } finally {
      pdb.close()
    }
    const newPlain = fs.readFileSync(scratchFile)
    const enc = SC.encryptDatabase(keyRes.key, newPlain)
    const rt = SC.roundtripSelfCheck(keyRes.key, newPlain)
    if (!rt.ok) throw new CarryError(`重加密往返自证失败(page ${rt.atPage})`, 'selfcheck')
    verifyRebuiltCipher(newPlain, enc, keyRes.key)
    if (opts.write) {
      if (opts.backupDir) {
        fs.mkdirSync(opts.backupDir, { recursive: true })
        const target = path.join(opts.backupDir, 'database.db.orig')
        if (!fs.existsSync(target)) fs.copyFileSync(dbFile, target)
      }
      atomicBackupAndWrite(dbFile, enc)
      for (const ext of ['-wal', '-shm']) {
        try {
          fs.rmSync(dbFile + ext, { force: true })
        } catch {
          /* 客户端会重建 */
        }
      }
    }
    return { write: !!opts.write, pages: Math.floor(enc.length / SC.CIPHER.PAGE), rebound: reb, selfCheck: 'pass' }
  } finally {
    try {
      fs.rmSync(scratchFile, { force: true })
    } catch {
      /* 临时明文残留必须消失:清不掉就点名(它含对话正文,不允许漂在盘上) */
      throw new CarryError(`临时明文未清:${scratchFile} —— 手工删除`, 'plain-leak')
    }
  }
}

export const __test__ = {
  CarryError,
  UID_RE,
  userIdFromUserInfo,
  rebindDatabase,
  planKeyRenames,
  rebindVscdb,
  rebindStorageJson,
  planTipsRenames,
  locateAgentDatabase,
  readDbWithWal,
  atomicBackupAndWrite,
  verifyRebuiltCipher,
  rebindAgentDbFile,
  traeUserDataDirs,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
