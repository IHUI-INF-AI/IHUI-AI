// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 各平台本地会话库的统一只读探针(2026-11-22 立)。
 *
 * 立因:机主要求「所有号池平台都要有对话随行能力」。但各平台本地形态差很大:
 *   sqlite(qoder/minimax/zcode/codex)、VS Code 系 state.vscdb(codearts/trae)、
 *   LevelDB(loomy)、按日期分目录的 jsonl(codex 回放面)、云端账号库(doubao)。
 * 统一探针只做三件事,全部只读、零网络:
 *   1) 找到会话库真实落点(候选路径逐个探,找不到如实 unlocated,不猜);
 *   2) 数出会话条数 + 客户端口径下的"可见条数";
 *   3) 判断会话是否带账号维度 —— 这一条决定"切号是否需要重绑":
 *        无账号列 ⇒ 切号后历史天然在(local);有账号列 ⇒ 必须重绑,否则跨号不可见。
 *
 * 纪律(同仓 §0.3/§0.6):任何"取不到"一律返回 unlocated/未判定,绝不把探不到当"没问题"。
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** 账号维度候选列名(单源):命中即需要重绑评估。各平台用词不同,统一在这里认。 */
export const ACCOUNT_COLUMN_RE =
  /^(user_id|userid|uid|account|account_id|accountid|owner|owner_id|owner_user_id|tenant|tenant_id|org_id|team_id|creator_user_id|creator_account_id)$/i

/** 客户端"已归档/已删除"常见列名:只用于算可见数,不参与重绑判据。 */
export const HIDDEN_COLUMN_RE = /^(deleted_at|deletedAt|time_deleted|archived_at|archivedAt)$/i

/** 候选路径里的 ~ / 环境变量展开(测试零真实目录,可注入 env) */
export function expandPath(p, env = process.env) {
  let s = String(p ?? '').trim()
  if (!s) return ''
  if (s.startsWith('~')) {
    const home = String(env.USERPROFILE || env.HOME || '').trim()
    s = home ? path.join(home, s.slice(1)) : s
  }
  return s.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, k) => String(env[k] ?? ''))
}

/** 首个存在的候选(全部不存在 ⇒ '');候选本身可为函数(env) => 路径 */
export function pickExisting(candidates, env = process.env) {
  for (const c of candidates ?? []) {
    const raw = typeof c === 'function' ? c(env) : c
    const p = expandPath(raw, env)
    if (p && fs.existsSync(p)) return p
  }
  return ''
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

/**
 * SQLite 会话库探针。
 *
 * @param {object} spec
 * @param {Array<string|Function>} spec.candidates 候选文件
 * @param {string} spec.table 会话表
 * @param {string} [spec.idCol] 主键列
 * @param {string} [spec.titleCol] 标题列(只用于样本展示,不参与判定)
 * @param {string} [spec.deletedCol] 显式软删列(缺省自动认 HIDDEN_COLUMN_RE 命中的第一个)
 * @param {Array<string>} [spec.accountCols] 已知账号列(缺省按 ACCOUNT_COLUMN_RE 自动认)
 * @param {Function} [spec.env]
 */
export function probeSqlite(spec = {}) {
  const env = spec.env ?? process.env
  const file = pickExisting(spec.candidates, env)
  const base = {
    kind: 'sqlite',
    provider: spec.provider ?? '',
    located: false,
    path: '',
    table: spec.table ?? '',
    sessions: null,
    visible: null,
    accountScoped: false,
    accountCols: [],
    notes: [],
  }
  if (!file) return { ...base, notes: ['未找到会话库(该平台可能未安装/未登录/落点变更)'] }
  if (!isSqliteFile(file)) return { ...base, path: file, notes: ['候选文件不是 SQLite(落点可能已换形态)'] }

  const { DatabaseSync } = require('node:sqlite')
  let db
  try {
    db = new DatabaseSync(file, { readOnly: true })
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all()
      .map((r) => String(r.name))
    if (!tables.includes(spec.table)) {
      return { ...base, path: file, notes: [`库内没有 ${spec.table} 表(实读表:${tables.slice(0, 8).join(',')}…)`] }
    }
    const cols = db.prepare(`PRAGMA table_info(${spec.table})`).all().map((c) => String(c.name))
    const accountCols = (
      Array.isArray(spec.accountCols) && spec.accountCols.length > 0
        ? cols.filter((c) => spec.accountCols.includes(c))
        : cols.filter((c) => ACCOUNT_COLUMN_RE.test(c))
    )
    const hiddenCol =
      spec.deletedCol && cols.includes(spec.deletedCol)
        ? spec.deletedCol
        : cols.find((c) => HIDDEN_COLUMN_RE.test(c)) ?? ''
    const total = Number(db.prepare(`SELECT count(*) AS n FROM ${spec.table}`).get().n) || 0
    const visible = hiddenCol
      ? Number(
          db
            .prepare(`SELECT count(*) AS n FROM ${spec.table} WHERE ${hiddenCol} IS NULL`)
            .get().n,
        ) || 0
      : total
    // 有账号列 ≠ 真有账号维度:列在场但全 NULL/单值 ⇒ 实际不分账号;多值 ⇒ 切号会按值过滤
    const accountValues = []
    let accountScoped = false
    for (const c of accountCols) {
      try {
        const vals = db
          .prepare(
            `SELECT ${c} AS v, count(*) AS n FROM ${spec.table} WHERE ${c} IS NOT NULL AND ${c} <> '' GROUP BY ${c} ORDER BY n DESC LIMIT 5`,
          )
          .all()
        if (vals.length > 0) {
          accountValues.push({ column: c, distinct: vals.length, sample: vals.map((x) => String(x.v).slice(0, 12)) })
          if (vals.length > 1) accountScoped = true
        }
      } catch {
        /* 列类型不支持分组(如 BLOB):按"有值"处理,宁可报需要重绑 */
        accountScoped = true
      }
    }
    const notes = []
    if (accountScoped) notes.push(`检测到账号维度(${accountCols.join('/')}),切号必须重绑归属`)
    else if (accountCols.length > 0) notes.push(`账号列在场但无多值(${accountCols.join('/')}),实际不分账号`)
    return {
      ...base,
      located: true,
      path: file,
      sessions: total,
      visible,
      hiddenCol,
      accountCols,
      accountScoped,
      accountValues,
      notes,
    }
  } catch (e) {
    return { ...base, path: file, notes: [`读库失败(可能被客户端独占/加密):${e instanceof Error ? e.message : String(e)}`] }
  } finally {
    try {
      db?.close()
    } catch {
      /* 关不掉不影响结论 */
    }
  }
}

/**
 * VS Code 系 state.vscdb 探针(ItemTable 键值库)。
 * 账号维度证据 = 键前缀带 uid(`<uid>:*` / `<uid>_*`)。数不出"会话条数"(键值面含全量状态),
 * 只报键总数与带 uid 前缀的键数,由上层如实标注"按键面核对,不冒充会话条数"。
 */
export function probeVscdb(spec = {}) {
  const env = spec.env ?? process.env
  const file = pickExisting(spec.candidates, env)
  const base = {
    kind: 'vscdb',
    provider: spec.provider ?? '',
    located: false,
    path: '',
    sessions: null,
    visible: null,
    accountScoped: false,
    notes: [],
  }
  if (!file) return { ...base, notes: ['未找到 state.vscdb(该平台可能未安装/未登录)'] }
  if (!isSqliteFile(file)) return { ...base, path: file, notes: ['state.vscdb 不是 SQLite(形态已换)'] }
  const { DatabaseSync } = require('node:sqlite')
  let db
  try {
    db = new DatabaseSync(file, { readOnly: true })
    const keys = db.prepare(`SELECT key FROM ItemTable`).all().map((r) => String(r.key))
    const uidKeys = keys.filter((k) => /^[0-9a-f]{6,32}[:_.]/i.test(k))
    return {
      ...base,
      located: true,
      path: file,
      sessions: keys.length,
      visible: keys.length,
      keyCount: keys.length,
      accountScoped: uidKeys.length > 0,
      notes: [
        uidKeys.length > 0
          ? `键面有 ${uidKeys.length} 个 uid 前缀键 ⇒ 切号需重绑键前缀`
          : '键面无 uid 前缀 ⇒ 切号后历史天然在',
        '该平台会话条数以键面计,不等同于客户端侧边栏行数',
      ],
    }
  } catch (e) {
    return { ...base, path: file, notes: [`读库失败:${e instanceof Error ? e.message : String(e)}`] }
  } finally {
    try {
      db?.close()
    } catch {
      /* 关不掉不影响结论 */
    }
  }
}

/** LevelDB/IndexedDB 目录探针:只报文件面,不解析内容(解析器随客户端版本变,不冒充条数) */
export function probeLeveldb(spec = {}) {
  const env = spec.env ?? process.env
  const dir = pickExisting(spec.candidates, env)
  const base = {
    kind: 'leveldb',
    provider: spec.provider ?? '',
    located: false,
    path: '',
    sessions: null,
    visible: null,
    accountScoped: false,
    notes: [],
  }
  if (!dir) return { ...base, notes: ['未找到 LevelDB 目录(该平台可能未安装)'] }
  let entries = []
  try {
    entries = fs.readdirSync(dir).filter((n) => /\.(log|ldb|sst)$/i.test(n))
  } catch {
    return { ...base, path: dir, notes: ['目录不可读'] }
  }
  return {
    ...base,
    located: true,
    path: dir,
    entries: entries.length,
    notes: ['LevelDB 面只核对目录在场;DOM Storage 无账号键(见 CHAT_CARRY 矩阵),条数以客户端为准'],
  }
}

/** 按日期/项目分目录的会话文件面探针(codex/opencode 一类):数文件,不解析正文 */
export function probeJsonl(spec = {}) {
  const env = spec.env ?? process.env
  const dir = pickExisting(spec.candidates, env)
  const ext = String(spec.ext ?? 'jsonl').replace(/^\./, '')
  const re = new RegExp(`\\.${ext}$`, 'i')
  const base = {
    kind: 'files',
    provider: spec.provider ?? '',
    located: false,
    path: '',
    sessions: null,
    visible: null,
    accountScoped: false,
    notes: [],
  }
  if (!dir) return { ...base, notes: ['未找到会话目录(该平台可能未安装)'] }
  let count = 0
  const walk = (d, depth) => {
    if (depth < 0) return
    let ents
    try {
      ents = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p, depth - 1)
      else if (re.test(e.name)) count += 1
    }
  }
  walk(dir, 5)
  return {
    ...base,
    located: true,
    path: dir,
    sessions: count,
    visible: count,
    notes: [`按 .${ext} 文件数计会话,不解析正文`],
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
