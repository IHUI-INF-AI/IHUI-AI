#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * index 烂尾(unmerged 条目)滞留哨兵(2026-10-24 立)
 * ============================================================
 * 立因:凌晨一次违规 stash + rebase + stash pop 冲突会话逃逸,index 挂着 2 枚
 * unmerged 条目 + 91 个被删文件 12 小时无人察觉(最终靠 guardian 的 foreign-work
 * 对账间接发现)。本尺子把「index 里有未合并条目」这一格变成专职判据:
 *   - clean          exit 0  index 无 unmerged 条目
 *   - fresh          exit 0  有条目但未超龄(正常 merge 进行中,几秒到几分钟就该解掉)
 *   - stale          exit 1  同一批条目持续超龄(默认 15 分钟)= 烂尾现场,到人
 *   - undetermined   exit 2  取不到输入(§0.3:不记绿也不冒红)
 *
 * 判机器状态 ⇒ 绝不进提交链/runner(§12e 恒红门禁令);唯一调度器 =
 * scripts/git-guardian.mjs 的 auditIndexUnmerged()。
 *
 * 身份稳定性(§5e):同一场烂尾的判据 = unmerged 路径集合的指纹;集合一变即视为
 * 新现场(firstSeen 重置),不拿抖动量当身份。
 *
 * 状态文件:.ihui-agent/state/index-unmerged-state.json(存 firstSeen + key)。
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
// 禁 process.cwd() 定根(§15):由脚本自身位置推导。派生已统一走 face-reader 的 gitRaw(出口唯一);
// 但本尺子判的是「此刻 index 的 unmerged 元数据」而非仓库内容,故仍不走 listFaceFiles/catBatch
// 那条取材面(门 118 头注钦定出路:判的不是仓库内容 ⇒ 不以仓库锚点形态读文件)。
const REPO_TOP = join(SCRIPT_DIR, '..')
const STATE_DIR = join(REPO_TOP, '.ihui-agent', 'state')

const STATE_FILE = join(STATE_DIR, 'index-unmerged-state.json')
const DEFAULT_STALE_MIN = Number(process.env.IHUI_INDEX_UNMERGED_STALE_MIN || 15)

/** ls-files -u 原始输出 → 去重路径集合。兼容 -z(NUL 分隔)与默认换行;记录内 mode sha stage\tpath。 */
export function parseUnmergedPaths(raw) {
  const text = String(raw ?? '')
  const parts = text.includes('\0') ? text.split('\0') : text.split('\n')
  const out = []
  for (const rec of parts) {
    const t = rec.indexOf('\t')
    if (t < 0) continue
    const p = rec.slice(t + 1).trim()
    if (p) out.push(p)
  }
  return [...new Set(out)].sort()
}

/** 路径集合 → 稳定指纹(先排序:身份必须与枚举序无关,否则同批条目换序即被误判新现场、
 *  firstSeen 永远重置,烂尾到不了 stale 档)。集合一变即新现场。 */
export function unmergedKey(paths) {
  const list = [...(Array.isArray(paths) ? paths : [])].sort()
  return createHash('sha1').update(list.join('\n')).digest('hex').slice(0, 16)
}

/**
 * 纯判据(零 IO):unmerged 条目集 + 既有状态 → 四态结论。
 *   clean   无条目(调用方应清状态)
 *   fresh   有条目,且(key 与状态不符 → 视为新现场,重置 firstSeen=now)| 未超龄
 *   stale   同 key 持续且超龄
 */
export function classifyUnmerged({ paths, state, now, staleMin = DEFAULT_STALE_MIN }) {
  const list = Array.isArray(paths) ? paths : []
  if (list.length === 0) return { overall: 'clean', nextState: null }
  const key = unmergedKey(list)
  const firstSeen = state && state.key === key && Number.isFinite(state.firstSeen) ? state.firstSeen : now
  const ageMin = (now - firstSeen) / 60000
  const nextState = { key, firstSeen }
  if (state && state.key === key && ageMin >= staleMin) {
    return { overall: 'stale', ageMin: Math.round(ageMin), count: list.length, nextState }
  }
  return { overall: 'fresh', ageMin: Math.round(ageMin), count: list.length, nextState }
}

function runGitLsUnmerged() {
  try {
    // §12g:派生 git 一律走 face-reader 出口;stdio 两态与 windowsHide 由 gitRaw 层写死(本机不写稳定 EBUSY)。
    const out = gitRaw(['ls-files', '-u', '-z'], REPO_TOP, {
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 1 << 22,
    })
    return { ok: true, raw: String(out ?? '') }
  } catch (e) {
    return { ok: false, err: String(e?.message ?? e) }
  }
}

function readState() {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    return { key: String(s.key ?? ''), firstSeen: Number(s.firstSeen) }
  } catch {
    return null
  }
}

function writeState(next, logger) {
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true })
    if (next) writeFileSync(STATE_FILE, JSON.stringify(next), 'utf8')
    else if (existsSync(STATE_FILE)) writeFileSync(STATE_FILE, JSON.stringify({ key: '', firstSeen: 0, clearedAt: Date.now() }), 'utf8')
  } catch (e) {
    logger(`⚠️ index 烂尾哨兵:状态文件写入失败(${String(e?.message ?? e).slice(0, 80)})—— 下轮重估`)
  }
}

export function main(argv = process.argv.slice(2)) {
  const asJson = argv.includes('--json')
  const log = (s) => {
    if (!asJson) console.log(s)
  }
  const now = Date.now()
  const g = runGitLsUnmerged()
  if (!g.ok) {
    const payload = { overall: 'undetermined', why: `git ls-files -u 不可用:${g.err.slice(0, 120)}` }
    if (asJson) console.log(JSON.stringify(payload))
    else console.log(`❓ index 烂尾哨兵:未判定 —— ${payload.why}`)
    return 2
  }
  const paths = parseUnmergedPaths(g.raw)
  const verdict = classifyUnmerged({ paths, state: readState(), now })
  writeState(verdict.nextState, log)
  const detail =
    verdict.overall === 'stale'
      ? `index 未合并条目 ${verdict.count} 枚已滞留 ${verdict.ageMin} 分钟(≥${DEFAULT_STALE_MIN} 阈值)= 烂尾现场。` +
        `典型成因:stash pop 冲突(AGENTS.md §12 禁 stash)或 merge/cherry-pick 中断逃逸。` +
        `下一步:确认无会话正在合并(git ls-files -u 现读),确认为烂尾后以 HEAD 面为底清偿:` +
        `git reset(仅 index)→ git checkout -- <缺失路径> → 活文档取 HEAD 面;全程留档快照。`
      : verdict.overall === 'fresh'
        ? `index 有 ${verdict.count} 枚未合并条目(出现 ${verdict.ageMin} 分钟,未超龄)—— 若确有合并进行中属正常,超 ${DEFAULT_STALE_MIN} 分钟将到人。`
        : 'index 无未合并条目。'
  if (asJson) {
    console.log(JSON.stringify({ overall: verdict.overall, count: verdict.count ?? 0, ageMin: verdict.ageMin ?? null, staleMin: DEFAULT_STALE_MIN, detail }))
  } else {
    const icon = verdict.overall === 'stale' ? '❌' : verdict.overall === 'fresh' ? 'ℹ️' : '✅'
    console.log(`${icon} index 烂尾哨兵:${detail}`)
  }
  return verdict.overall === 'stale' ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main())
}

export const __test__ = { parseUnmergedPaths, unmergedKey, classifyUnmerged, STATE_FILE, DEFAULT_STALE_MIN: () => DEFAULT_STALE_MIN }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
