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
 * 纪律:客户端在跑绝不动它的数据(与切号同规,由调用方先 close);所有写盘先备份;
 * 任一环节失败,编排层用备份整组回滚。
 *
 * 备份纪律(2026-11-10 实测缺陷后改):固定后缀 `<file>.pre-carry.bak` 会被下一轮覆盖
 * (本机 conversation-tips 已出现 `.pre-carry.bak.pre-carry.bak` 套娃),且 vscdb 与正库原件
 * 从不进回滚清单 —— 现改为 `carry-backups/<runId>/` 目录式日志(createCarryJournal),
 * 每个被改文件(含 SQLite 伴生 -wal/-shm/-journal)写前入账,改名另记 from→to,
 * 回滚时除 copy 回旧名还要删掉我们造出的新名。
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

/**
 * 正库账号绑定列清单(单源):表 → 列。
 * server_history_info 也在册(旧号非空行按值改),但它的 NULL 行是否归并不由本清单决定,
 * 见 rebindDatabase 的 ownedBefore 门与 describeServerHistoryInfo()。
 */
export const UID_COLS = Object.freeze({
  project: 'user_id',
  user_configuration: 'user_id',
  server_history_info: 'user_id',
  chat_session: 'user_id',
})

/** SQLite 伴生文件:备份/回滚必须与主文件同进同出,否则"还原主库 + 留一截新 WAL"= 坏库 */
const SQLITE_SIBLINGS = ['-wal', '-shm', '-journal']

let __runSeq = 0

/**
 * 备份轮次号:ISO 时间戳(文件系统安全,冒号/点换成连字符)+ 进程内序号。
 * 序号是为了同毫秒内两轮不撞目录(测试与连跑都要确定性,不用随机数)。
 */
export function newRunId(now = Date.now()) {
  __runSeq += 1
  const iso = new Date(now).toISOString().replace(/[:.]/g, '-')
  return `${iso}-${__runSeq}`
}

/** 目录内展平名:<userDataDir>/User/globalStorage/state.vscdb → User__globalStorage__state.vscdb */
function flattenInto(file, root) {
  let rel = root ? path.relative(root, file) : ''
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) rel = path.basename(file)
  return rel.replace(/[:\\/]+/g, '__')
}

/**
 * 目录式备份日志(2026-11-10 修缺陷 1/2/4 的落点)。
 *
 * 与固定后缀的区别:
 *   1. 每轮一个 `carry-backups/<runId>/` 目录 ⇒ 第二轮失败不会把第一轮的"切前态"覆盖掉;
 *   2. 同一轮内同一文件只留**第一次**的副本(写前态),重复 backup 幂等;
 *   3. 记录改名 from→to,回滚时才能删掉我们造出的新名(缺陷 3);
 *   4. 外部产出的备份(如正库 database.db.orig)可用 adopt() 入账(缺陷 4)。
 */
export function createCarryJournal({ backupRoot, runId, root = '' } = {}) {
  if (!backupRoot) throw new CarryError('createCarryJournal 需要 backupRoot', 'bad-args')
  const id = String(runId || newRunId())
  const dir = path.join(backupRoot, id)
  const entries = [] // { kind:'file', target, backup }
  const renames = [] // { kind:'rename', from, to, preExisted }
  const absent = [] // 备份时不存在 ⇒ 回滚时若被我们造出来就删掉
  const byTarget = new Map() // target → backup(同轮首次为准)
  const usedNames = new Set()

  const uniqueName = (base) => {
    let name = base
    let i = 1
    while (usedNames.has(name.toLowerCase())) name = `${base}.${(i += 1)}`
    usedNames.add(name.toLowerCase())
    return name
  }

  const journal = {
    runId: id,
    dir,
    count: () => entries.length,
    backupPaths: () => entries.map((e) => e.backup),
    renames: () => renames.map((r) => ({ from: r.from, to: r.to, preExisted: r.preExisted })),

    /** 写前入账:文件不存在 ⇒ 只记"回滚时删掉";存在 ⇒ 复制一份(含 SQLite 伴生文件) */
    backup(file) {
      if (!file) return null
      if (byTarget.has(file)) return byTarget.get(file)
      if (!fs.existsSync(file)) {
        absent.push(file)
        return null
      }
      // 目录/FIFO 之类不能按文件备份 ⇒ 明说,绝不"改名了却回滚不回来"
      let st = null
      try {
        st = fs.statSync(file)
      } catch {
        st = null
      }
      if (!st || !st.isFile()) {
        throw new CarryError(`备份目标不是普通文件(${file})⇒ 不做无法回滚的改写`, 'not-a-file')
      }
      fs.mkdirSync(dir, { recursive: true })
      const bak = path.join(dir, uniqueName(flattenInto(file, root)))
      fs.copyFileSync(file, bak)
      entries.push({ kind: 'file', target: file, backup: bak })
      byTarget.set(file, bak)
      for (const ext of SQLITE_SIBLINGS) {
        const sib = `${file}${ext}`
        if (fs.existsSync(sib)) {
          const sb = path.join(dir, uniqueName(flattenInto(sib, root)))
          fs.copyFileSync(sib, sb)
          entries.push({ kind: 'file', target: sib, backup: sb })
          byTarget.set(sib, sb)
        } else {
          absent.push(sib)
        }
      }
      return bak
    },

    /** 把外部已产出的备份纳入回滚清单(同一 target 已有更早副本时不再顶替) */
    adopt(backupFile, target) {
      if (!backupFile || !target || byTarget.has(target)) return false
      if (!fs.existsSync(backupFile)) return false
      entries.push({ kind: 'file', target, backup: backupFile, external: true })
      byTarget.set(target, backupFile)
      return true
    },

    /** 记录一次"我们做的"改名:回滚要 copy 回 from,并（仅当新名是我们造的）删掉 to */
    recordRename(from, to, { preExisted = false } = {}) {
      if (!from || !to || from === to) return
      renames.push({ kind: 'rename', from, to, preExisted: !!preExisted })
    },

    /** 整组还原:先逐件 copy 回,再收拾伴生/改名残留 */
    restore() {
      const restored = []
      const removed = []
      const failed = []
      for (const e of entries) {
        try {
          fs.copyFileSync(e.backup, e.target)
          restored.push(e.target)
        } catch {
          failed.push(e.target)
        }
      }
      for (const r of renames) {
        if (r.preExisted) continue // 新名切前就在 ⇒ 已由上面的 file 备份还原,不许删
        try {
          if (fs.existsSync(r.to)) {
            fs.rmSync(r.to, { force: true })
            removed.push(r.to)
          }
        } catch {
          failed.push(r.to)
        }
      }
      for (const f of absent) {
        if (byTarget.has(f)) continue // 已被备份过的目标不在此列
        try {
          if (fs.existsSync(f)) {
            fs.rmSync(f, { force: true })
            removed.push(f)
          }
        } catch {
          failed.push(f)
        }
      }
      return { restored, removed, failed }
    },
  }
  return journal
}

/**
 * 写后断言(缺陷 5):uidCols 里**确有非空值**的表,旧 uid 行数必须为 0。
 * 全 NULL 的表(本机 server_history_info 6,921/6,921)按判据不参与该断言 ——
 * 它属"客户端从不填写"的列,不是"改漏了"。
 */
export function checkUidLeftovers(db, oldUid, uidCols = UID_COLS) {
  const checked = []
  const leftovers = []
  for (const [table, col] of Object.entries(uidCols)) {
    try {
      const nonNull = Number(
        db.prepare(`SELECT COUNT(*) c FROM "${table}" WHERE "${col}" IS NOT NULL AND "${col}" <> ''`).get().c,
      )
      if (nonNull <= 0) {
        checked.push({ table, column: col, nonNull: 0, leftover: 0, skipped: 'all-null' })
        continue
      }
      const leftover = Number(db.prepare(`SELECT COUNT(*) c FROM "${table}" WHERE "${col}" = ?`).get(oldUid).c)
      checked.push({ table, column: col, nonNull, leftover })
      if (leftover > 0) leftovers.push({ table, column: col, leftover })
    } catch {
      checked.push({ table, column: col, skipped: 'no-column' })
    }
  }
  return { checked, leftovers }
}

/**
 * uidCols 之外、同样带 user_id 列的表里残留的旧 uid(只报不改)。
 * 本机实读:model_config_cache 7 行仍是旧号 —— 它是"缓存"面(新号查不到就回源),
 * 不属于对话正文,故不在本链的迁移/断言范围内,但必须让上层看得见。
 */
export function scanOtherUidTables(db, oldUid, covered = UID_COLS) {
  const out = []
  let names = []
  try {
    names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((r) => String(r.name))
  } catch {
    return out
  }
  for (const table of names) {
    if (Object.prototype.hasOwnProperty.call(covered, table)) continue
    let cols = []
    try {
      cols = db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => String(c.name))
    } catch {
      continue
    }
    if (!cols.includes('user_id')) continue
    try {
      const leftover = Number(db.prepare(`SELECT COUNT(*) c FROM "${table}" WHERE "user_id" = ?`).get(oldUid).c)
      if (leftover > 0) out.push({ table, column: 'user_id', leftover })
    } catch {
      /* 表读不出 ⇒ 不报(不猜) */
    }
  }
  return out
}

/**
 * vscdb 侧的残留判据(缺陷 5):改完后 ItemTable 里仍含旧 uid 的键必须为 0。
 * produced = 本轮 rename 的 to 集合 —— 万一新 uid 里含旧 uid 子串(号段巧合),
 * 我们自己造出来的键不能被算成"残留"。
 */
export function leftoverKeys(keys, oldUid, produced = new Set()) {
  return keys.filter((k) => String(k).includes(oldUid) && !produced.has(k))
}

/**
 * server_history_info.user_id 的判定(2026-11-10 由库内数据 + dll 内 SQL 面推定,不许猜):
 *   - 本机 6,921/6,921 行该列全 NULL,而这些行是客户端自己写的本地历史逐消息镜像;
 *   - chat_session 与 history_v2 **没有 user_id 列**,会话列表按 chat_session.project_id → project.user_id 收窄;
 *   - dll 内直接操作该表的 SQL 只有 `DELETE FROM server_history_info WHERE client_history_id IN (...)`,
 *     索引只有 history_id / client_history_id,没有 user_id 索引。
 * ⇒ 客户端不据该列过滤本地历史 ⇒ 保持 NULL、不归并;结论与依据随报告一起输出。
 */
export const SERVER_HISTORY_USER_ID_EVIDENCE = Object.freeze([
  '本机实读:server_history_info 6,921/6,921 行 user_id 全 NULL(客户端连续写入亦不填)',
  'client_history_id → history_v2.history_v2_id 1:1 命中 6,921/6,921 ⇒ 该表是本地历史逐消息镜像',
  'chat_session / history_v2 均无 user_id 列;按 user_id 收窄的 SQL 只出现在 project(model_config_cache/local_artifact/core_memory 同族)',
  'ai_agent.dll 内 direct SQL 仅 DELETE ... WHERE client_history_id IN (...);索引 idx_server_history_info_history_id / _client_history_id,无 user_id 索引',
])

/** 读一次 server_history_info.user_id 的现状,给报告留凭据(不参与迁移判定) */
export function describeServerHistoryInfo(db) {
  const out = {
    field: 'server_history_info.user_id',
    rows: null,
    nonNull: null,
    decision: 'unknown',
    note: '',
    evidence: SERVER_HISTORY_USER_ID_EVIDENCE,
  }
  try {
    out.rows = Number(db.prepare('SELECT COUNT(*) c FROM "server_history_info"').get().c)
    out.nonNull = Number(
      db.prepare(`SELECT COUNT(*) c FROM "server_history_info" WHERE "user_id" IS NOT NULL AND "user_id" <> ''`).get().c,
    )
    out.decision = out.nonNull === 0 ? 'left-untouched' : 'rebound-or-preowned'
    out.note =
      out.nonNull === 0
        ? `server_history_info.user_id 全 NULL(${out.rows} 行),客户端不据此过滤本地历史,未动`
        : `server_history_info.user_id 有 ${out.nonNull} 行非空(旧号非空行已按值改;NULL 行是否归并见 null-merge 计数)`
  } catch {
    out.decision = 'no-table'
    out.note = '本机正库无 server_history_info 表 ⇒ 不涉及'
  }
  return out
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
  const uidCols = UID_COLS
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
  // user_id 为 NULL/'' 且本机确有旧号行:只在该表存在旧号非空行时才做 NULL 归并,
  // 避免在共享环境把别人的匿名行错挂(失效方向 = 少并,不少报)。
  // 2026-11-10 判定:server_history_info.user_id 是**客户端从不填写**的列(本机 6,921/6,921 全 NULL,
  // 而 chat_session/history_v2 根本没有 user_id 列,dll 内也没有按该列过滤的 SQL)⇒
  // 真实数据下 ownedBefore 恒 0,这段归并**不会触发**,保持现状(见 describeServerHistoryInfo 的依据)。
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
 * 改完立即复检:仍含旧 uid 的键(且不是我们造出来的)= leftover-uid ⇒ 抛错进回滚
 * (2026-11-10 缺陷 5:此前写完全绿,从未证明库里真的没有旧号残留)。
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
    const produced = new Set(plan.map((p) => p.to))
    const after = db.prepare('SELECT key FROM ItemTable').all().map((r) => String(r.key))
    const left = leftoverKeys(after, oldUid, produced)
    if (left.length) {
      throw new CarryError(
        `leftover-uid: ${path.basename(file)} 改完仍有 ${left.length} 个键含旧 uid(${left
          .slice(0, 3)
          .join(' / ')})`,
        'leftover-uid',
      )
    }
    return {
      renamed: renamed.length,
      collisions: collisions.length,
      leftoverOldKeys: 0,
      details: { renamed, collisions },
    }
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
 * 定位 Trae 的 `ai_agent.dll`(SQLCipher 密钥常数族所在)。
 *
 * 为什么不能只靠 resolveProductExe(2026-11-10 实证):
 * 那条路要查**运行中进程**的 ExecutablePath,而正库段恰恰在客户端已关闭之后才跑
 * ⇒ 一关就查不到 exe ⇒ dll 候选全空 ⇒ `no-dll` ⇒ 整条链回滚:
 *   本机实测 resolveProductExe('Trae CN') === ''(装在 G:\Trae CN 非标准盘,
 *   LOCALAPPDATA\Programs 那条同样落空)⇒ 对话随行在本机**必然失败**。
 *
 * 改为**从数据目录反推安装根**(与进程无关,客户端关着也能定位):
 *   <installRoot>\UserData\ModularData\ai-agent\database.db ⇒ installRoot = userDataDir 的父目录
 * 逐级向上最多 3 层找 `resources\app\modules\ai-agent\ai_agent.dll`,
 * 再叠加 exe 目录与 LOCALAPPDATA 两条老候选,取第一个真实存在的。
 */
export function locateAgentDll({ product, userDataDir, exePath, env = process.env } = {}) {
  const rel = path.join('resources', 'app', 'modules', 'ai-agent', 'ai_agent.dll')
  const candidates = []
  if (exePath) candidates.push(path.join(path.dirname(exePath), rel))
  let dir = userDataDir ? path.resolve(userDataDir) : ''
  /**
   * 本机 `%APPDATA%\Trae CN` 是指向 `G:\Trae CN\UserData` 的符号链接(客户端装 G 盘)。
   * 不解析 realpath 就会从 AppData 往上翻,永远找不到 resources 目录。
   */
  if (dir) {
    try {
      dir = fs.realpathSync.native(dir)
    } catch {
      /* 路径不存在时保持原样,由下面逐级探测给出空结果 */
    }
  }
  for (let i = 0; i < 4 && dir; i += 1) {
    candidates.push(path.join(dir, rel))
    const up = path.dirname(dir)
    if (up === dir) break
    dir = up
  }
  const localAppData = String(env.LOCALAPPDATA ?? '').trim()
  if (localAppData && product) {
    candidates.push(path.join(localAppData, 'Programs', product, rel))
    candidates.push(path.join(localAppData, product, rel))
  }
  return candidates.find((f) => f && fs.existsSync(f)) ?? ''
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

/**
 * 备份 + 原子写。默认备份落 `${file}.pre-carry.bak`(老调用面);
 * opts.backupPath 提供时**只往那里写一次**(由 carry journal 在写前统一入账),
 * 不再留固定后缀 —— 固定后缀会被下一轮覆盖,是 2026-11-10 缺陷 2 的现场。
 */
export function atomicBackupAndWrite(targetFile, contentBuf, opts = {}) {
  const bak = opts.backupPath || `${targetFile}.pre-carry.bak`
  if (!opts.backupPath && fs.existsSync(targetFile)) fs.copyFileSync(targetFile, bak)
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
 * 文件级正库重绑:解密 → 重绑 → 残留断言 → 往返自证 → 重加密写回(原子)。
 * tsx 编排层与离线验收共用这一条(§0.6 判据单源)。
 *
 * 回滚凭据(2026-11-10 修缺陷 4):opts.journal 提供时,原密文库(含伴生 -wal/-shm)在**写前**
 * 由 journal 入账,失败时与 storage.json / vscdb 一起还原;未给 journal 时退回
 * opts.backupDir/database.db.orig(老调用面,孤立备份 = 失败时救不回来,故编排层必须传 journal)。
 */
export async function rebindAgentDbFile(dbFile, opts = {}) {
  const oldUid = String(opts.oldUid ?? '')
  const newUid = String(opts.newUid ?? '')
  if (!oldUid || !newUid) throw new CarryError('重绑需要 oldUid/newUid', 'bad-args')
  const dllPath = String(opts.dllPath ?? '')
  if (!dllPath || !fs.existsSync(dllPath)) throw new CarryError('取不到 ai_agent.dll ⇒ 无法按版本核密钥(未判定)', 'no-dll')
  const journal = opts.journal ?? null
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
    let leftovers
    let otherUidTables
    let serverHistoryInfo
    try {
      reb = rebindDatabase(pdb, oldUid, newUid)
      pdb.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      // 缺陷 5:写完全绿不算数 —— 必须当场证明库里没有旧 uid 残留(否则抛 leftover-uid 进回滚)
      serverHistoryInfo = describeServerHistoryInfo(pdb)
      leftovers = checkUidLeftovers(pdb, oldUid)
      otherUidTables = scanOtherUidTables(pdb, oldUid)
      if (leftovers.leftovers.length) {
        throw new CarryError(
          `leftover-uid: 重绑后仍有旧 uid 行 ${leftovers.leftovers
            .map((l) => `${l.table}.${l.column}=${l.leftover}`)
            .join(' / ')}`,
          'leftover-uid',
        )
      }
    } finally {
      pdb.close()
    }
    const newPlain = fs.readFileSync(scratchFile)
    const enc = SC.encryptDatabase(keyRes.key, newPlain)
    const rt = SC.roundtripSelfCheck(keyRes.key, newPlain)
    if (!rt.ok) throw new CarryError(`重加密往返自证失败(page ${rt.atPage})`, 'selfcheck')
    verifyRebuiltCipher(newPlain, enc, keyRes.key)
    let backupFile = null
    if (opts.write) {
      if (journal) {
        backupFile = journal.backup(dbFile) // 写前入账:原密文库 + -wal/-shm
      } else if (opts.backupDir) {
        fs.mkdirSync(opts.backupDir, { recursive: true })
        const target = path.join(opts.backupDir, 'database.db.orig')
        if (!fs.existsSync(target)) fs.copyFileSync(dbFile, target)
        backupFile = target
      }
      atomicBackupAndWrite(dbFile, enc, backupFile ? { backupPath: backupFile } : {})
      for (const ext of ['-wal', '-shm']) {
        try {
          fs.rmSync(dbFile + ext, { force: true })
        } catch {
          /* 客户端会重建 */
        }
      }
    }
    return {
      write: !!opts.write,
      pages: Math.floor(enc.length / SC.CIPHER.PAGE),
      rebound: reb,
      selfCheck: 'pass',
      leftovers,
      otherUidTables,
      serverHistoryInfo,
      backup: backupFile,
    }
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
  UID_COLS,
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
  newRunId,
  createCarryJournal,
  checkUidLeftovers,
  scanOtherUidTables,
  leftoverKeys,
  describeServerHistoryInfo,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
