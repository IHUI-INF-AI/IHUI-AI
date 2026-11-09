// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 构建产物陈旧自检(2026-11-09 立;2026-11-09 收薄为判据单源封装)。
//
// 与 `scripts/check-dist-freshness.mjs` 的分工:
//   - 后者是**全仓 CLI 尺**:需主动跑(node scripts/check-dist-freshness.mjs),逐包给读数,
//     供调度侧/票面判定"这次改动进没进执行面";
//   - 本模块是**单包运行时自检**:脚本启动时同步调用一次,给可执行的 rebuildHint、可选 failFast。
// 判据不在此重算(§0.6 单源):入口是否 dist 复用 `entryPointsToDist`,最新源 mtime 复用
// `newestMtime`。本文件只补两处前者没有出口的最小自实现:
//   ① 从 main/exports 解析出**具体产物入口路径**(用于比 mtime、拼修复命令);
//   ② 产物入口自身的 mtime(statSync 一次)。
//
// 为什么存在:dist/ 被 .gitignore 忽略、每个工作树各自增量构建。本地构建（tsc 增量）
// 不重编“导出聚合文件”时，src/index.ts 新增的 re-export 不会出现在 dist 里，消费方
// 只看到 `does not provide an export named X` —— 形态像源码缺陷/他人覆盖，实际只是
// 产物陈旧。本模块把这一形态变成一条可执行的修复命令。
//
// 判据(§0.6 单源):reason='stale' 当且仅当 src/**/*.ts 的最大 mtime > 产物入口 mtime。
// 不能只看入口文件自身 mtime —— 入口没改、被 re-export 的子模块改了才是本轮实证形态。
// 判不出(读不到 package.json / 无 src)一律 fresh=null，未判定不冒充成品(§0.3)。
//
// 纯函数 + 同步 fs(ESM 顶层可直接调用)；除 assertDistFresh 的日志外无副作用。

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { entryPointsToDist, newestMtime } from '../check-dist-freshness.mjs'

const SRC_EXTS = ['.ts', '.tsx', '.mts', '.cts']

export class DistStaleError extends Error {
  constructor(message, detail) {
    super(message)
    this.name = 'DistStaleError'
    this.code = 'DIST_STALE'
    this.detail = detail
  }
}

function toPosix(p) {
  return String(p).replace(/\\/g, '/')
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** 解析产物入口的具体相对路径(仅当 entryPointsToDist 为真时才有意义)。 */
function pickEntryRel(pkg) {
  const exp = pkg?.exports?.['.']
  const candidates = [
    typeof exp === 'string' ? exp : exp?.import,
    exp?.default,
    pkg?.main,
    pkg?.module,
    pkg?.types,
  ]
  for (const raw of candidates) {
    if (typeof raw === 'string' && raw.length > 0) return raw.replace(/^\.\//, '')
  }
  return null
}

/**
 * 按 newestMtime 给出的 mtime 反查具体文件路径。
 * 只做"等值标注"(路径用于告警可读性),不参与陈旧判定 —— 判定值仍以 newestMtime 为唯一来源。
 * 用 readdirSync({recursive}) 平铺一次,不自写递归 walk。
 */
function pathOfMtime(dir, mtime) {
  if (mtime === null) return null
  let rels
  try {
    rels = readdirSync(dir, { recursive: true })
  } catch {
    return null
  }
  for (const rel of rels) {
    const name = String(rel)
    if (!SRC_EXTS.some((x) => name.endsWith(x))) continue
    if (name.split(/[\\/]/).some((seg) => seg === 'node_modules' || seg.startsWith('.'))) continue
    const full = join(dir, name)
    try {
      const st = statSync(full)
      if (st.isFile() && st.mtimeMs === mtime) return full
    } catch {
      /* 单文件取不到 ⇒ 继续找,不因此宣布整包未判定 */
    }
  }
  return null
}

function buildRebuildHint(pkgDir, pkg) {
  const script = typeof pkg?.scripts?.build === 'string' ? pkg.scripts.build.trim() : ''
  const cwd = toPosix(pkgDir)
  if (script.length > 0) return `cd ${cwd} && ${script}`
  return `cd ${cwd} && pnpm run build`
}

function result(over) {
  return {
    fresh: null,
    reason: 'unreadable',
    entryPath: null,
    entryMtime: null,
    newestSrcPath: null,
    newestSrcMtime: null,
    ageMs: 0,
    rebuildHint: '',
    pkgName: null,
    ...over,
  }
}

/**
 * 判定一个 workspace 包的产物是否陈旧(同步、无副作用)。
 * @param {string} pkgDir 包根目录(相对或绝对)
 * @returns {{fresh: boolean|null, reason: 'ok'|'missing-dist'|'stale'|'no-src'|'unreadable',
 *   entryPath: string|null, entryMtime: number|null, newestSrcPath: string|null,
 *   newestSrcMtime: number|null, ageMs: number, rebuildHint: string, pkgName: string|null}}
 */
export function distFreshnessOf(pkgDir) {
  const dir = isAbsolute(pkgDir) ? pkgDir : resolve(pkgDir)
  const pkg = readJson(join(dir, 'package.json'))
  if (!pkg) return result({ reason: 'unreadable', rebuildHint: '' })

  const pkgName = typeof pkg.name === 'string' ? pkg.name : null
  const rebuildHint = buildRebuildHint(dir, pkg)
  const entryRel = pickEntryRel(pkg)
  const entryPath = entryRel ? join(dir, entryRel) : null

  const srcDir = join(dir, 'src')
  const srcMtime = existsSync(srcDir) ? newestMtime(srcDir, SRC_EXTS) : null
  if (srcMtime === null) {
    return result({ reason: 'no-src', entryPath, rebuildHint, pkgName })
  }
  const newestSrcPath = pathOfMtime(srcDir, srcMtime)

  // 入口自述不指 dist ⇒ 该包按源码被消费,没有"产物陈旧"这一形态
  // (与 check-dist-freshness 的 state='ok' 同口径)。
  if (!entryPointsToDist(pkg)) {
    return result({
      fresh: true,
      reason: 'ok',
      entryPath,
      newestSrcPath,
      newestSrcMtime: srcMtime,
      rebuildHint,
      pkgName,
    })
  }

  if (!entryPath || !existsSync(entryPath)) {
    return result({
      fresh: false,
      reason: 'missing-dist',
      entryPath,
      newestSrcPath,
      newestSrcMtime: srcMtime,
      rebuildHint,
      pkgName,
    })
  }

  let entryMtime
  try {
    entryMtime = statSync(entryPath).mtimeMs
  } catch {
    return result({ reason: 'unreadable', entryPath, rebuildHint, pkgName })
  }

  const ageMs = Math.round(srcMtime - entryMtime)
  return result({
    fresh: ageMs <= 0,
    reason: ageMs > 0 ? 'stale' : 'ok',
    entryPath,
    entryMtime,
    newestSrcPath,
    newestSrcMtime: srcMtime,
    ageMs: ageMs > 0 ? ageMs : 0,
    rebuildHint,
    pkgName,
  })
}

function formatAge(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}min`
  return `${Math.round(min / 60)}h`
}

/**
 * 门面:产物陈旧时打印一段人可读告警；failFast 为真则抛 DistStaleError。
 * 默认 failFast=false —— 不改变既有脚本行为，只提示。
 * @param {string} pkgDir 包根目录
 * @param {{failFast?: boolean, logger?: Pick<Console,'warn'|'log'|'error'>}} [options]
 * @returns {ReturnType<typeof distFreshnessOf>}
 */
export function assertDistFresh(pkgDir, { failFast = false, logger = console } = {}) {
  const detail = distFreshnessOf(pkgDir)
  if (detail.fresh !== false) return detail

  const label = detail.pkgName || toPosix(pkgDir)
  const lines = [
    `[dist-freshness] ${label} 的构建产物陈旧(${detail.reason})，@ihui/* 新导出可能解析不到。`,
    `  产物入口: ${toPosix(detail.entryPath || '(未声明)')}`,
    `  最新源文件: ${toPosix(detail.newestSrcPath || '(无)')} (比产物新 ${formatAge(detail.ageMs)})`,
    `  修复: ${detail.rebuildHint}`,
    '  (dist/ 被 .gitignore 忽略，每个工作树需各自构建；此提示不阻止脚本运行)',
  ]
  const emit = typeof logger?.warn === 'function' ? logger.warn.bind(logger) : console.warn
  emit(lines.join('\n'))

  if (failFast) {
    throw new DistStaleError(`${label} 构建产物陈旧: ${detail.reason}`, detail)
  }
  return detail
}
