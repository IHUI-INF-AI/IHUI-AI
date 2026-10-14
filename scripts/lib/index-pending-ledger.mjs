// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/lib/index-pending-ledger.mjs
/**
 * 「索引里悬着一条已暂存未提交的改动」的首观测台账(schema + 读写 + 回收)—— 住在 lib 而不是门体里,
 * 与 `lib/commit-attestation.mjs` 同构:键名形状只由这一处解释,消费方不复制。
 *
 * 为什么需要这份台账:git **不在索引条目里记录 stage 时刻**(实测:索引 v4 条目只有工作区文件的
 * ctime/mtime/size 等 stat;`git reflog` 只记 HEAD 移动;`.husky/` 下没有 `post-index-change`)。
 * 于是"悬了多久"拿不到精确输入。本仓对"量不到的时刻"的一贯正解 = **自己盖一份首观测戳**,
 * 把"精确 stage 时刻"换成"我第一次看见它的时刻",并在拿不到时判「未判定」而不是 0(§0.3)。
 *
 * 两条纪律写死在这里:
 *  - **必须有终态**:`pruneIndexPendingLedger` 把本轮索引面不再出现的 key 一律回收。立因:抑制类
 *    台账没有回收 = 无限增长,本仓已为此付过学费(无期限的"预期现象"抑制把一次崩溃循环掩成没人收信)。
 *  - **key 含暂存 blob sha**:内容被改动 ⇒ sha 变 ⇒ 旧 key 自动失效并重新计龄,不会把"改了但还是
 *    同一条悬留"读成"已经年轻了"。
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LIB_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(LIB_DIR, '..', '..')

/** 台账唯一相对路径(全仓只许这一份) */
export const INDEX_PENDING_LEDGER_REL = '.workbuddy/index-pending-first-seen.json'
export const INDEX_PENDING_LEDGER_VERSION = 1

/** 归一为 POSIX 仓库相对路径(与消费方同一形状;key 稳定性依赖它) */
function normRelPath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '')
}

/** 台账唯一键 = 暂存 blob sha + 归一路径 */
export function firstSeenKeyOf(path, blobOid) {
  return `${String(blobOid ?? 'no-blob')}|${normRelPath(path)}`
}

export function indexPendingLedgerPath(root = REPO_ROOT) {
  return join(root, INDEX_PENDING_LEDGER_REL)
}

/**
 * 纯函数:解析 first-seen 台账文本。state 四档逐字对齐 readLedgerRecords 的口径 ——
 *   read / missing(从未写过,合法)/ unreadable(存在读不到)/ bad-json(解不出)。
 * 坏 JSON **不抛**、当空台账重新开始,但 state 必须带出去:把"读坏了"折成"没有悬留"
 * 就是 AGENTS §0.3 禁的那一格。
 */
export function parseIndexPendingLedger(text) {
  const entries = new Map()
  if (typeof text !== 'string') {
    return { state: 'unreadable', entries, why: '台账内容不是文本(读不到)' }
  }
  let obj
  try {
    obj = JSON.parse(text)
  } catch (e) {
    return { state: 'bad-json', entries, why: String(e?.message ?? e).slice(0, 140) }
  }
  if (
    !obj ||
    typeof obj !== 'object' ||
    Array.isArray(obj) ||
    !obj.entries ||
    typeof obj.entries !== 'object' ||
    Array.isArray(obj.entries)
  ) {
    return {
      state: 'bad-json',
      entries,
      why: `顶层缺 entries 对象(实得 ${Array.isArray(obj) ? 'array' : typeof obj})`,
    }
  }
  const badKeys = []
  for (const [k, v] of Object.entries(obj.entries)) {
    const ms = Number(v?.firstSeenMs)
    if (!Number.isFinite(ms) || ms <= 0) {
      badKeys.push(k)
      continue
    }
    entries.set(k, { firstSeenMs: ms, path: String(v?.path ?? ''), blob: String(v?.blob ?? '') })
  }
  return {
    state: 'read',
    entries,
    why: badKeys.length ? `${badKeys.length} 条 firstSeenMs 不可读,本轮忽略` : null,
  }
}

/** 读台账(ENOENT = missing,不是错误;其余 IO 失败 = unreadable) */
export function readIndexPendingLedger(root = REPO_ROOT) {
  const p = indexPendingLedgerPath(root)
  try {
    return { ...parseIndexPendingLedger(readFileSync(p, 'utf8')), path: p }
  } catch (e) {
    const code = String(e?.code ?? '')
    if (code === 'ENOENT') {
      return { state: 'missing', entries: new Map(), why: '台账尚未建立(本门首次观测时自建)', path: p }
    }
    return {
      state: 'unreadable',
      entries: new Map(),
      why: `${code || '读失败'}:${String(e?.message ?? e).slice(0, 120)}`,
      path: p,
    }
  }
}

/** 序列化(纯函数:输入 Map,输出文本;构造面可直接断言形状) */
export function serializeIndexPendingLedger(entries, nowIso = new Date().toISOString()) {
  const obj = {}
  for (const [k, v] of entries) obj[k] = { path: v.path, blob: v.blob, firstSeenMs: v.firstSeenMs }
  return (
    JSON.stringify(
      { version: INDEX_PENDING_LEDGER_VERSION, writtenAt: nowIso, count: Object.keys(obj).length, entries: obj },
      null,
      2,
    ) + '\n'
  )
}

/**
 * 写台账:先写 temp 再 rename(半截文件不得冒充台账)。**永不抛**,只回 {ok,why}
 * (消费方是 warn 级守门,一次记账写失败不得把提交链变红,但 why 必须被打印出来)。
 */
export function writeIndexPendingLedger(entries, root = REPO_ROOT, nowIso = new Date().toISOString()) {
  const p = indexPendingLedgerPath(root)
  try {
    mkdirSync(dirname(p), { recursive: true })
    const tmp = `${p}.tmp-${process.pid}`
    writeFileSync(tmp, serializeIndexPendingLedger(entries, nowIso))
    renameSync(tmp, p)
    return { ok: true, path: p }
  } catch (e) {
    return {
      ok: false,
      path: p,
      why: `${String(e?.code ?? '')}:${String(e?.message ?? e).slice(0, 140)}`,
    }
  }
}

/**
 * **台账必须有终态**:本轮索引面不再出现的 key 一律回收。
 * 条目在索引里消失(被提交 / 被 restore / sha 变更后旧 key 不再命中)⇒ 下一次运行即回收。
 */
export function pruneIndexPendingLedger(entries, observedKeys) {
  const kept = new Map()
  const recycled = []
  for (const [k, v] of entries) {
    if (observedKeys.has(k)) kept.set(k, v)
    else recycled.push(k)
  }
  return { entries: kept, recycled }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
