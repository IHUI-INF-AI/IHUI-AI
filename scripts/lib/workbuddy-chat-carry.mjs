// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 切号携带对话 —— 把旧登录号的本地会话记录重绑到新号名下(2026-11-12 立)。
 *
 * 立因(机主原话):「我发现 workbuddy 切号怎么没法携带对话记录呢,trae 都可以」。
 * 旧口径(scripts/client-oneclick-switch.mjs 的 CHAT_CARRY.workbuddy = kind:'local',
 * "对话由客户端本地管理,切号不致丢")**是错的**,本机现读取证推翻:
 *
 *   1) 会话归属**有账号维度**:`~/.workbuddy/workbuddy.db` 的 `sessions` 表带 `user_id` 列,
 *      本机实读 13 个 uid 各自独立成组(如 14f939c3 102 行 / 0bc1074d 64 行 / 25913b4a 24 行)。
 *   2) 客户端按 uid 过滤(A 档实证,app.asar 内该产品自己的 SQL 逐字):
 *        getVisibleRow:      WHERE id = ? AND transport='local' AND deleted_at IS NULL
 *                            AND (user_id = ? OR user_id = '')
 *        getListVisibleRow:  同上
 *        ensureLocalRowSoftDeleted: WHERE id = ? AND transport='local' AND deleted_at IS NULL
 *                            AND (user_id = ? OR user_id = '')
 *        会话搜索(会话内检索):      WHERE user_id = ? AND transport='local' AND deleted_at IS NULL
 *        buildActiveSpaceLookupSql: WHERE s.user_id = ? AND sp.user_id = s.user_id
 *      ⇒ 切号只换了登录态,旧号会话仍以**旧 uid** 落库,新号登录后查询条件不命中 ⇒ 看不见。
 *      这正是机主说的「带不过来」。
 *   3) 侧边栏快照也按 uid 分片:resolveUidShardPath(userData, uid, 'sidebar-list-snapshot.json')
 *      ⇒ 路径 `~/.workbuddy/<uid>/sidebar-list-snapshot.json`,新号读的是**另一个文件**。
 *   4) **正文与账号无关**:会话正文在 `~/.workbuddy/projects/<项目>/<会话>.jsonl`,
 *      路径里不含 uid;账号只落在 sessions 表那一列 + 快照分片目录。
 *      ⇒ 只要把归属改过去,正文原样可读,不需要复制/搬运任何消息体。
 *
 * 迁移 = 改 4 处归属(与 Trae 的"四处重绑"同思路,但 WorkBuddy 面小得多):
 *   a. sessions.user_id          旧 uid → 新 uid(仅 transport='local' 且属旧号的活行)
 *   b. spaces.user_id            旧 uid → 新 uid(space 是会话的分组容器,同样带账号列)
 *   c. automations.owner_user_id 旧 uid → 新 uid(定时任务的归属;不动会让任务在新号下消失)
 *   d. <uid>/sidebar-list-snapshot.json  旧分片 → 合并进新分片(原子替换 + 备份)
 *
 * 硬边界(照抄 trae-chat-carry 的纪律):
 *  - 只读/只写本机 WorkBuddy 数据目录,**不发任何网络**,不碰号池库;
 *  - 写前逐文件备份(默认 `<file>.pre-carry-<runId>.bak`),失败整组回滚;
 *  - 客户端在跑也能写(WAL 事务实测可写,见 probeWritable),但**写后要客户端重载**才可见:
 *    切号本身已经触发热重载,本模块紧跟写回之后跑,故无需二次重启;
 *  - 任一步取不到输入 ⇒ 抛 CarryError 并带 code,**绝不静默返回 0 条冒绿**(§0.3);
 *  - 只动「归属等于旧 uid」的行:旧号本来就没有的会话不会被新号顺手拿走。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export class CarryError extends Error {
  constructor(message, code = 'carry-failed') {
    super(message)
    this.name = 'CarryError'
    this.code = code
  }
}

/** 会话/空间/自动化三张表的归属列(单源,不在别处再写第二份) */
export const UID_COLS = Object.freeze({
  sessions: 'user_id',
  spaces: 'user_id',
  automations: 'owner_user_id',
})

/** WorkBuddy 用户数据根(可注入,测试零真实目录) */
export function resolveWorkbuddyHome(env = process.env) {
  const home = String(env.USERPROFILE || env.HOME || '').trim() || os.homedir()
  return path.join(home, '.workbuddy')
}

/** 该产品当前是否在跑(只探测,绝不关端 —— WorkBuddy 是会话宿主,wb-switch 也寄生在它的进程树里) */
export function probeRunning() {
  // 只判库文件是否被独占:WAL 模式下客户端在跑不会独占,故一律返回可写探针结果
  return { checked: false, reason: 'not-probed' }
}

/**
 * 只读探针:该库当前能不能拿写锁。拿不到 ⇒ 未判定(不猜"客户端没在跑")。
 * 事务内只做一次 count 再 rollback,不落任何改动。
 */
export function probeWritable(dbPath) {
  const { DatabaseSync } = require('node:sqlite')
  let db
  try {
    db = new DatabaseSync(dbPath)
    db.exec('BEGIN IMMEDIATE')
    db.prepare('SELECT count(*) AS n FROM sessions').get()
    db.exec('ROLLBACK')
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  } finally {
    try {
      db?.close()
    } catch {
      /* 关不掉不影响结论 */
    }
  }
}

/** uid 形状校验:该产品 uid 是 UUID;空串是客户端的"无归属哨兵",不作为迁移源 */
export function isUid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

/**
 * 该 uid 名下的会话条数(按 transport 分组,给计划面读数)。
 *
 * 2026-11-22 改口径(机主实报"切完看不见"后回读客户端 SQL 定的):
 *   - 客户端列表/详情硬性 `deleted_at IS NULL` ⇒ **可见只数 NULL**;
 *   - `deleted_at = -1` 是旧版软删哨兵,**不是可见**,单列 localLegacyNegOne 报出来;
 *   - localVisible 是该 uid 的 local 行里客户端真能列出的条数。
 */
export function countByOwner(db, uid) {
  const rows = db
    .prepare(
      `SELECT transport,
              sum(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS visible,
              sum(CASE WHEN deleted_at = -1 THEN 1 ELSE 0 END) AS legacy_neg_one,
              count(*) AS n
       FROM sessions WHERE user_id = ? GROUP BY transport`,
    )
    .all(uid)
  const out = {
    local: 0,
    cloud: 0,
    total: 0,
    localVisible: 0,
    localLegacyNegOne: 0,
    /** @deprecated 旧字段名,等价 localVisible;保留仅为不打断既有调用方 */
    localAlive: 0,
  }
  for (const r of rows) {
    const k = r.transport === 'cloud' ? 'cloud' : 'local'
    out[k] += Number(r.n) || 0
    out.total += Number(r.n) || 0
    if (k === 'local') {
      out.localVisible += Number(r.visible) || 0
      out.localLegacyNegOne += Number(r.legacy_neg_one) || 0
      out.localAlive = out.localVisible
    }
  }
  return out
}

/** 该 uid 下客户端此刻真能列出的本地会话 id(与 countByOwner.localVisible 同口径) */
export function listVisibleSessionIds(db, uid) {
  return db
    .prepare(`SELECT id FROM sessions WHERE user_id = ? AND transport = 'local' AND deleted_at IS NULL`)
    .all(uid)
    .map((r) => String(r.id))
}

/**
 * WorkBuddy 桌面端登录态文件(明文 JSON,`account.uid`)。只读,不改写。
 */
export function resolveWorkbuddyAuthFile(env = process.env) {
  const base = String(env.LOCALAPPDATA || '').trim() || path.join(os.homedir(), 'AppData', 'Local')
  return path.join(base, 'CodeBuddyExtension', 'Data', 'Public', 'auth', 'workbuddy-desktop.info')
}

/** 从登录态文件取当前 uid;文件不存在/形状不对 ⇒ ''(未判定) */
export function currentUid(authFile = resolveWorkbuddyAuthFile()) {
  try {
    const obj = JSON.parse(fs.readFileSync(authFile, 'utf8'))
    const uid = String(obj?.account?.uid ?? obj?.uid ?? '').trim()
    return isUid(uid) ? uid : ''
  } catch {
    return ''
  }
}

/**
 * 切号**前**必须调一次:把"此刻客户端列表里看得见的会话 id"存下来。
 *
 * 切号瞬间 auth 落盘、客户端 watcher 热重载会把旧号当前可见会话打上 deleted_at;
 * 切完再抓就只剩 0 条 ⇒ 复活名单为空、搬过去的会话仍不可见。只读,不写库。
 */
export function capturePreSwitchVisibleIds({ env = process.env, home = resolveWorkbuddyHome(env) } = {}) {
  const uid = currentUid(resolveWorkbuddyAuthFile(env))
  if (!uid) return { uid: '', ids: [], why: '登录态文件读不到 uid' }
  const dbPath = path.join(home, 'workbuddy.db')
  if (!fs.existsSync(dbPath)) return { uid, ids: [], why: `没有会话库:${dbPath}` }
  const { DatabaseSync } = require('node:sqlite')
  let db
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
    const ids = listVisibleSessionIds(db, uid)
    const snapIds = readSnapshotItemIds(path.join(home, uid, 'sidebar-list-snapshot.json'))
    return { uid, ids: [...new Set([...ids, ...snapIds])], dbVisible: ids.length, snapshot: snapIds.length, why: '' }
  } catch (e) {
    return { uid, ids: [], why: e instanceof Error ? e.message : String(e) }
  } finally {
    try {
      db?.close()
    } catch {
      /* 关不掉不影响结论 */
    }
  }
}

/** 快照文件的条目 id 列表(不存在/坏形状 ⇒ 空,不抛) */
export function readSnapshotItemIds(file) {
  try {
    if (!fs.existsSync(file)) return []
    const obj = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!Array.isArray(obj?.items)) return []
    return obj.items.map((it) => (it && typeof it.id === 'string' ? it.id : '')).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * 计划面(纯只读,不给 --dry-run 之外的任何写):算出这次要动多少行。
 * 返回 { from, to, sessions, spaces, automations, snapshotFrom, snapshotTo }
 */
export function planCarry(db, { fromUid, toUid, home = resolveWorkbuddyHome() }) {
  if (!isUid(fromUid)) throw new CarryError(`旧 uid 形状不合法:${fromUid}`, 'bad-from-uid')
  if (!isUid(toUid)) throw new CarryError(`新 uid 形状不合法:${toUid}`, 'bad-to-uid')
  if (fromUid === toUid) throw new CarryError('新旧 uid 相同,无需迁移(不猜)', 'same-uid')
  const n = (table, col) =>
    Number(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${col} = ?`).get(fromUid).n) || 0
  const vis = db
    .prepare(
      `SELECT sum(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS visible,
              sum(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS soft_deleted
       FROM sessions WHERE user_id = ? AND transport = 'local'`,
    )
    .get(fromUid)
  return {
    from: fromUid,
    to: toUid,
    sessions: n('sessions', UID_COLS.sessions),
    spaces: n('spaces', UID_COLS.spaces),
    automations: n('automations', UID_COLS.automations),
    visible: Number(vis?.visible) || 0,
    softDeleted: Number(vis?.soft_deleted) || 0,
    snapshotFrom: path.join(home, fromUid, 'sidebar-list-snapshot.json'),
    snapshotTo: path.join(home, toUid, 'sidebar-list-snapshot.json'),
  }
}

/** 某表是否有某列(列不存在就跳过,避免旧库/测试库形状差异把主链炸掉) */
function hasColumn(db, table, column) {
  try {
    return db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .some((c) => String(c.name).toLowerCase() === column.toLowerCase())
  } catch {
    return false
  }
}

/** 备份单文件;不存在返回 null(不造空备份冒充) */
function backupFile(file, runId) {
  if (!fs.existsSync(file)) return null
  const bak = `${file}.pre-carry-${runId}.bak`
  fs.copyFileSync(file, bak)
  return bak
}

/**
 * 侧边栏快照合并:旧分片的 items 并入新分片。
 *
 * 语义(照客户端 writeNormalizedSidebarListSnapshot 的形状):
 *   { version: 3, savedAt: <ms>, items: [...] }
 * - 目标不存在 ⇒ 直接以源为底写目标(保留 version,刷新 savedAt);
 * - 目标存在 ⇒ 按 item.id 去重合并(目标优先:新号自己已有的条目不被旧号覆盖),
 *   savedAt 取两者较大值,避免把新号的快照时间戳改早。
 * 解析失败一律抛 CarryError(不猜、不覆盖成空快照)。
 */
export function mergeSidebarSnapshot({ fromFile, toFile, runId = Date.now().toString(36) }) {
  const readOne = (f) => {
    if (!fs.existsSync(f)) return null
    const txt = fs.readFileSync(f, 'utf8')
    let obj
    try {
      obj = JSON.parse(txt)
    } catch (e) {
      throw new CarryError(
        `侧边栏快照解析失败(拒绝覆盖):${f}(${e instanceof Error ? e.message : String(e)})`,
        'snapshot-shape',
      )
    }
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.items)) {
      throw new CarryError(`侧边栏快照形状不是 {items:[]}:${f}`, 'snapshot-shape')
    }
    return obj
  }
  const src = readOne(fromFile)
  const dst = readOne(toFile)
  if (!src && !dst) return { changed: false, merged: 0, mergedIds: [], backups: [] }
  if (!src) return { changed: false, merged: 0, mergedIds: [], backups: [] }

  const backups = []
  const byId = new Map()
  for (const it of Array.isArray(dst?.items) ? dst.items : []) {
    if (it && typeof it.id === 'string') byId.set(it.id, it)
  }
  const mergedIds = []
  for (const it of src.items) {
    if (!it || typeof it.id !== 'string') continue
    if (byId.has(it.id)) continue
    byId.set(it.id, it)
    mergedIds.push(it.id)
  }
  const merged = mergedIds.length
  if (merged === 0) return { changed: false, merged: 0, mergedIds: [], backups: [] }

  const out = {
    version: typeof dst?.version === 'number' ? dst.version : src.version,
    savedAt: Math.max(Number(dst?.savedAt) || 0, Number(src?.savedAt) || 0, Date.now()),
    items: [...byId.values()],
  }
  if (dst) {
    const b = backupFile(toFile, runId)
    if (b) backups.push(b)
  } else {
    fs.mkdirSync(path.dirname(toFile), { recursive: true })
    // 目标原本不存在 ⇒ 从源分片"搬",源文件本身也留一份备份(改完要清空源 items)
    const b = backupFile(fromFile, runId)
    if (b) backups.push(b)
  }
  const tmp = `${toFile}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(out), 'utf8')
  fs.renameSync(tmp, toFile)
  return { changed: true, merged, mergedIds, backups }
}

/**
 * 执行迁移(事务内改三张表 + 事务外合并快照)。
 *
 * @param {object} opts
 * @param {string} opts.fromUid 旧登录号(切号前本机在登的那枚)
 * @param {string} opts.toUid   新登录号(刚写回的那枚)
 * @param {string} [opts.home]  WorkBuddy 用户数据根
 * @param {boolean} [opts.dryRun] 只读计划,不落任何改动
 * @param {string[]} [opts.reviveSessionIds] 切号前抓到的可见会话 id(capturePreSwitchVisibleIds)
 * @param {boolean} [opts.reviveHistory] 复活旧号全部软删本地会话(补搬历史,默认关)
 * @param {number} [opts.reviveWindowMs] >0 ⇒ 额外复活「最近 N 毫秒内被软删」的本地行(默认关)
 * @returns {{ok:boolean, dryRun:boolean, from:string, to:string, moved:object, revive:object,
 *            snapshot:object, backups:string[], notes:string[]}}
 */
export function runCarry({
  fromUid,
  toUid,
  home = resolveWorkbuddyHome(),
  dryRun = false,
  runId = `${Date.now().toString(36)}-${process.pid}`,
  reviveSessionIds = [],
  reviveHistory = false,
  reviveWindowMs = 0,
} = {}) {
  const ids = Array.isArray(reviveSessionIds)
    ? [...new Set(reviveSessionIds.map((x) => String(x ?? '').trim()).filter(Boolean))]
    : []
  const dbPath = path.join(home, 'workbuddy.db')
  if (!fs.existsSync(dbPath)) {
    throw new CarryError(`本机没有 WorkBuddy 会话库:${dbPath}(未判定)`, 'no-db')
  }
  const { DatabaseSync } = require('node:sqlite')
  const db = new DatabaseSync(dbPath)
  const notes = []
  let backups = []
  try {
    const plan = planCarry(db, { fromUid, toUid, home })
    if (dryRun) {
      let plannedRevive = reviveHistory ? plan.softDeleted : 0
      if (!reviveHistory && ids.length) {
        const q = db.prepare(
          `SELECT count(*) AS n FROM sessions
           WHERE user_id = ? AND transport = 'local' AND deleted_at IS NOT NULL AND id = ?`,
        )
        plannedRevive = 0
        for (const id of ids) plannedRevive += Number(q.get(fromUid, id)?.n) || 0
      }
      if (Number(reviveWindowMs) > 0) {
        const cutoff = Date.now() - Number(reviveWindowMs)
        plannedRevive +=
          Number(
            db
              .prepare(
                `SELECT count(*) AS n FROM sessions
                 WHERE user_id = ? AND transport = 'local' AND deleted_at IS NOT NULL AND deleted_at >= ?`,
              )
              .get(toUid, cutoff)?.n,
          ) || 0
      }
      return {
        ok: true,
        dryRun: true,
        from: fromUid,
        to: toUid,
        moved: {
          sessions: plan.sessions,
          spaces: plan.spaces,
          automations: plan.automations,
          visible: plan.visible,
          softDeleted: plan.softDeleted,
          revived: 0,
        },
        revive: { ids: ids.length, history: reviveHistory, windowMs: Number(reviveWindowMs) || 0, plannedRevive },
        snapshot: { from: plan.snapshotFrom, to: plan.snapshotTo, dryRun: true },
        backups: [],
        notes: [
          'dry-run:未写库、未动快照',
          `旧号可见 ${plan.visible} 条 / 软删 ${plan.softDeleted} 条 ⇒ 实跑可复活 ${plannedRevive} 条${
            ids.length ? `(名单 ${ids.length} 条)` : ''
          }`,
        ],
      }
    }

    // 先备份库文件(整库级回滚点),再进事务。WAL 模式下只备主文件不够 ⇒ 有 -wal/-shm 一并备
    const dbBak = backupFile(dbPath, runId)
    if (!dbBak) throw new CarryError('会话库备份失败(拒绝无备份写入)', 'backup-failed')
    backups.push(dbBak)
    for (const ext of ['-wal', '-shm']) {
      const b = backupFile(`${dbPath}${ext}`, runId)
      if (b) backups.push(b)
    }

    const moved = { sessions: 0, spaces: 0, automations: 0, revived: 0 }
    const canRevive = hasColumn(db, 'sessions', 'deleted_at')
    db.exec('BEGIN IMMEDIATE')
    try {
      // ① reviveHistory:旧号名下所有软删本地行先清回可见(补搬历史)
      if (canRevive && reviveHistory) {
        moved.revived +=
          Number(
            db
              .prepare(
                `UPDATE sessions SET deleted_at = NULL
                 WHERE user_id = ? AND transport = 'local' AND deleted_at IS NOT NULL`,
              )
              .run(fromUid).changes,
          ) || 0
        if (hasColumn(db, 'spaces', 'deleted_at')) {
          // spaces.deleted_at NOT NULL DEFAULT -1(-1 = 未删,非 NULL)
          db.prepare(`UPDATE spaces SET deleted_at = -1 WHERE user_id = ? AND deleted_at <> -1`).run(fromUid)
        }
      }

      // 只搬 transport='local' 且归属等于旧号的活行/软删行(cloud 行不碰)
      moved.sessions =
        Number(
          db
            .prepare(
              `UPDATE sessions SET user_id = ?
               WHERE user_id = ? AND transport = 'local'`,
            )
            .run(toUid, fromUid).changes,
        ) || 0
      moved.spaces =
        Number(
          db.prepare(`UPDATE spaces SET user_id = ? WHERE user_id = ?`).run(toUid, fromUid).changes,
        ) || 0
      moved.automations =
        Number(
          db
            .prepare(`UPDATE automations SET owner_user_id = ? WHERE owner_user_id = ?`)
            .run(toUid, fromUid).changes,
        ) || 0

      // ② 名单复活:切前抓到"此刻客户端看得见"的 id,搬完逐条清 deleted_at。
      //    只改 user_id 不清软删 ⇒ 新号列表仍 0 条,这正是"搬了却看不见"的真因。
      if (canRevive && ids.length) {
        const reviveOne = db.prepare(
          `UPDATE sessions SET deleted_at = NULL
           WHERE id = ? AND transport = 'local' AND user_id = ? AND deleted_at IS NOT NULL`,
        )
        const spaceStmt = hasColumn(db, 'spaces', 'deleted_at')
          ? db.prepare(`UPDATE spaces SET deleted_at = -1 WHERE id = ? AND deleted_at <> -1`)
          : null
        const spaceOf = hasColumn(db, 'sessions', 'space_id')
          ? db.prepare(`SELECT space_id FROM sessions WHERE id = ? AND user_id = ?`)
          : null
        for (const id of ids) {
          moved.revived += Number(reviveOne.run(id, toUid).changes) || 0
          if (spaceStmt && spaceOf) {
            const sid = spaceOf.get(id, toUid)?.space_id
            if (sid) spaceStmt.run(sid)
          }
        }
      }

      // ③ 时间窗复活:切号瞬间被打软删、但没进名单的那条(时间戳即证据)。窗口外的软删一行不碰。
      if (canRevive && Number(reviveWindowMs) > 0) {
        const cutoff = Date.now() - Number(reviveWindowMs)
        moved.revived +=
          Number(
            db
              .prepare(
                `UPDATE sessions SET deleted_at = NULL
                 WHERE user_id = ? AND transport = 'local' AND deleted_at IS NOT NULL AND deleted_at >= ?`,
              )
              .run(toUid, cutoff).changes,
          ) || 0
        if (hasColumn(db, 'spaces', 'deleted_at')) {
          db.prepare(`UPDATE spaces SET deleted_at = -1 WHERE user_id = ? AND deleted_at <> -1`).run(toUid)
        }
      }
      db.exec('COMMIT')
    } catch (e) {
      try {
        db.exec('ROLLBACK')
      } catch {
        /* 已回滚 */
      }
      throw new CarryError(
        `迁移事务失败(已回滚):${e instanceof Error ? e.message : String(e)}`,
        'tx-failed',
      )
    }

    // 快照在库改完之后合并:库是权威,快照丢了客户端下次会重建,顺序反了会让新号先看到旧列表
    const snap = mergeSidebarSnapshot({
      fromFile: plan.snapshotFrom,
      toFile: plan.snapshotTo,
      runId,
    })
    backups = backups.concat(snap.backups)

    // 快照条目本身也可能对应被软删的行(切号瞬间被打软删的那条就在这):并进名单再补一轮
    const extraIds = (snap.mergedIds ?? []).filter((id) => !ids.includes(id))
    if (canRevive && extraIds.length) {
      db.exec('BEGIN IMMEDIATE')
      try {
        const reviveOne = db.prepare(
          `UPDATE sessions SET deleted_at = NULL
           WHERE id = ? AND transport = 'local' AND user_id = ? AND deleted_at IS NOT NULL`,
        )
        for (const id of extraIds) moved.revived += Number(reviveOne.run(id, toUid).changes) || 0
        db.exec('COMMIT')
      } catch (e) {
        try {
          db.exec('ROLLBACK')
        } catch {
          /* 已回滚 */
        }
        throw new CarryError(
          `快照条目复活失败(已回滚):${e instanceof Error ? e.message : String(e)}`,
          'revive-failed',
        )
      }
    }

    if (moved.revived > 0) {
      notes.push(`可见性复活 ✓ ${moved.revived} 条(切号瞬间被打 deleted_at 的会话已清回可见)`)
    } else if (ids.length || extraIds.length || Number(reviveWindowMs) > 0) {
      notes.push(
        `可见性复活 0 条(名单/窗口 ${extraIds.length + ids.length} 条均已可见或不在范围内,不是漏搬)`,
      )
    }

    if (moved.sessions === 0) {
      notes.push(
        `旧号 ${fromUid.slice(0, 8)} 名下没有本地会话可搬(可能本来就没聊过,或已被客户端清理)`,
      )
    }
    // 旧分片清空:否则旧号再登回来还会读到这批条目的残影
    if (snap.changed) {
      try {
        const cur = JSON.parse(fs.readFileSync(plan.snapshotFrom, 'utf8'))
        const remain = {
          ...cur,
          items: [],
          savedAt: Date.now(),
        }
        const tmp = `${plan.snapshotFrom}.${process.pid}.tmp`
        fs.writeFileSync(tmp, JSON.stringify(remain), 'utf8')
        fs.renameSync(tmp, plan.snapshotFrom)
        notes.push('旧号侧边栏分片已清空(避免旧号再登时读到残影)')
      } catch (e) {
        notes.push(
          `旧号分片清空失败(不影响已搬走的会话):${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }

    return {
      ok: true,
      dryRun: false,
      from: fromUid,
      to: toUid,
      moved,
      revive: {
        ids: ids.length,
        snapshotIds: extraIds.length,
        history: reviveHistory,
        windowMs: Number(reviveWindowMs) || 0,
        revived: moved.revived,
      },
      snapshot: { merged: snap.merged, changed: snap.changed, mergedIds: snap.mergedIds },
      backups,
      notes,
    }
  } finally {
    try {
      db.close()
    } catch {
      /* 关不掉不影响结论 */
    }
  }
}

export const __test__ = {
  resolveWorkbuddyHome,
  resolveWorkbuddyAuthFile,
  currentUid,
  listVisibleSessionIds,
  capturePreSwitchVisibleIds,
  readSnapshotItemIds,
  probeWritable,
  isUid,
  countByOwner,
  planCarry,
  mergeSidebarSnapshot,
  runCarry,
  UID_COLS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
