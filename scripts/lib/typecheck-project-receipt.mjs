// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 逐包类型结论回执(2026-11-20 立)。
 *
 * 立因(实测,不是口味):`typecheck:full` 每次强制清 `.tsbuildinfo` 后重跑**全部**包的 tsc
 * (本机一次 267s,占整次推送 292.9s 的 91%)。而推送时绝大多数包的类型输入**一个字都没变** ——
 * 一次合并把别人的改动带进来,只让其中 1~2 个包的结论需要重算。
 *
 * 判据(为什么"内容摘要"比"重跑一遍"可信):
 *   本层的结论只由 tsc 看到的那批输入决定 —— ①该包自己的 TS 输入与 tsconfig;②它依赖的
 *   workspace 包的 TS 输入(依赖包的 `dist/*.d.ts` 由前置重建保证与源码一致,故按源码摘要钉);
 *   ③`tsconfig.base.json` 这类全局基座;④执行面(node 版本 / tsc 版本 / 命令串)。
 *   逐项都进摘要 ⇒ 输入变了摘要必变。**不认** `.tsbuildinfo`(那是 tsc 自己的增量缓存,
 *   本项目历史上吃过"陈旧 tsbuildinfo 掩盖错误"的亏),本层一次都不读它。
 *
 * 失效方向(全部偏"多跑一遍",绝不偏"少判一格"):
 *   - 摘要取不到 / git 不可用 / 项目清单读不到 ⇒ 不跳过,照原路径重跑;
 *   - 任一项目(或其 workspace 依赖)在工作树/索引上有未提交改动 ⇒ 不跳过(推送判的是 HEAD,
 *     但本器在工作树上跑,脏面会让"HEAD 摘要"与"实际编译面"不一致);
 *   - 回执超 TTL(默认 7 天)/ 结构非法 / 显式 `IHUI_TYPECHECK_PROJECT_RECEIPT=0` ⇒ 不跳过。
 *   - 记录只在**本次全量跑通过**(rc=0)之后写:失败时宁可下次再跑,不留下"用失败结论当通过"的坑。
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const RECEIPT_REL = '.ihui-agent/state/typecheck-project-receipts.json'
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000

const isRel = (p) => p.startsWith('.ihui-agent/')

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

/** 回执开关(显式关闭 ⇒ 一律不跳过;取不到环境变量按开)。 */
export function receiptEnabled(env = process.env) {
  const v = String(env.IHUI_TYPECHECK_PROJECT_RECEIPT ?? '').trim()
  if (v === '0' || v === 'false') return false
  return true
}

export function receiptTtlMs(env = process.env) {
  const n = Number(env.IHUI_TYPECHECK_PROJECT_RECEIPT_TTL_HOURS)
  return Number.isFinite(n) && n > 0 ? n * 60 * 60 * 1000 : DEFAULT_TTL_MS
}

function git(root, args, { maxBuffer = 64 * 1024 * 1024 } = {}) {
  return execFileSync('git', ['-c', 'safe.directory=*', '-C', root, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * 一次性取出本仓 HEAD 面的文件清单(路径 → blob 摘要)。
 * 取不到 ⇒ null(调用方整层放弃跳过,回原路径)。
 */
export function headBlobMap(root) {
  try {
    const raw = git(root, ['ls-tree', '-r', '-z', 'HEAD'])
    const map = new Map()
    for (const rec of String(raw).split('\0')) {
      if (!rec) continue
      // 形如 `100644 blob <sha>\t<path>`
      const tab = rec.indexOf('\t')
      if (tab < 0) continue
      const meta = rec.slice(0, tab).split(' ')
      const path = rec.slice(tab + 1).replace(/\\/g, '/')
      if (meta[1] !== 'blob') continue
      map.set(path, meta[2])
    }
    return map
  } catch {
    return null
  }
}

/** 脏面(工作树 + 索引)路径集合;取不到 ⇒ null(不跳过)。 */
export function dirtyPaths(root) {
  try {
    const raw = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
    const out = new Set()
    for (const rec of String(raw).split('\0')) {
      if (!rec) continue
      // 形态: `XY <path>`;重命名是 `XY <old>\0<new>`,两端都算脏
      const path = rec.slice(3)
      if (path) out.add(path.replace(/\\/g, '/'))
    }
    return out
  } catch {
    return null
  }
}

/**
 * 一个项目的类型输入摘要。
 *
 * @param {object} o
 * @param {string} o.root
 * @param {{name:string, dir:string, command:string}} o.project
 * @param {Map<string,string>} o.blobs HEAD 面 path→blob
 * @param {string[]} o.depDirs 该项目的 workspace 依赖目录(仓库相对,如 `packages/types`)
 * @param {{node:string, ts:string, base:string}} o.envNode 执行面
 */
export function projectInputDigest({ root, project, blobs, depDirs = [], envNode }) {
  const unitRel = resolve(project.dir)
    .slice(resolve(root).length + 1)
    .replace(/\\/g, '/')
  if (!unitRel) return null
  const ownPrefix = `${unitRel}/`
  const own = []
  for (const [p, blob] of blobs) if (p.startsWith(ownPrefix)) own.push(`${p}:${blob}`)
  own.sort()
  const depParts = []
  for (const d of depDirs) {
    const depPrefix = `${d.replace(/\\/g, '/')}/`
    const dep = []
    for (const [p, blob] of blobs) if (p.startsWith(depPrefix)) dep.push(`${p}:${blob}`)
    dep.sort()
    depParts.push(`${d}::${sha256(dep.join('\n'))}`)
  }
  depParts.sort()
  return sha256(
    JSON.stringify({
      v: 'v1',
      unit: unitRel,
      cmd: project.command,
      node: envNode.node,
      ts: envNode.ts,
      base: envNode.base,
      own: sha256(own.join('\n')),
      ownCount: own.length,
      deps: depParts,
    }),
  )
}

/** 读回执文件;坏结构/不存在 ⇒ 空表(不抛,调用方按"无不命中"处理)。 */
export function readReceipts(root) {
  try {
    const abs = join(root, RECEIPT_REL)
    if (!existsSync(abs)) return { ok: true, map: new Map(), at: null }
    const j = JSON.parse(readFileSync(abs, 'utf8'))
    const map = new Map()
    for (const [k, v] of Object.entries(j?.projects ?? {})) {
      if (typeof v?.digest === 'string' && typeof v?.at === 'number') map.set(k, v)
    }
    return { ok: true, map, at: j?.at ?? null }
  } catch {
    return { ok: false, map: new Map(), at: null }
  }
}

/** 写回执(调用方只在 rc=0 之后调)。失败不抛:回执是加速件,写不进去只是下次再跑。 */
export function writeReceipts(root, entries, nowMs = Date.now()) {
  try {
    const abs = join(root, RECEIPT_REL)
    mkdirSync(dirname(abs), { recursive: true })
    const projects = {}
    for (const [name, e] of entries) projects[name] = { digest: e.digest, at: nowMs, ms: e.ms ?? null }
    writeFileSync(abs, JSON.stringify({ v: 1, at: nowMs, projects }, null, 2))
    return true
  } catch {
    return false
  }
}

/**
 * 决定哪些项目可以跳过。
 *
 * @returns {{skip:Array<{name:string,why:string}>, run:Array<object>, digests:Map<string,string>, blocked:string|null}}
 *   `blocked` 非空 = 整层不跳过(git 面取不到 / 脏面取不到),原因写进去。
 */
export function planProjectReceipts({
  root,
  projects,
  depDirsOf = () => [],
  blobs,
  dirty,
  receipts,
  envNode,
  nowMs = Date.now(),
  ttlMs = DEFAULT_TTL_MS,
}) {
  const skip = []
  const run = []
  const digests = new Map()
  if (!blobs) return { skip, run: projects, digests, blocked: 'HEAD 面文件清单取不到' }
  if (!dirty) return { skip, run: projects, digests, blocked: '工作树脏面取不到' }
  for (const p of projects) {
    const deps = depDirsOf(p) || []
    const digest = projectInputDigest({ root, project: p, blobs, depDirs: deps, envNode })
    if (!digest) {
      run.push(p)
      continue
    }
    digests.set(p.name, digest)
    const unitRel = resolve(p.dir)
      .slice(resolve(root).length + 1)
      .replace(/\\/g, '/')
    const watch = [unitRel, ...deps.map((d) => d.replace(/\\/g, '/'))]
    // 只有"会进 tsc program 的脏文件"才作废跳过(2026-11-20 收紧):README.md / i18n json /
    // css 这些不进任何 program,把它们当脏面让整批重跑 = 用 4 分钟买一个不可能变的结论。
    // 判据与「无 TS 输入面档」同一条:TS 扩展名,或 tsconfig*/package.json(program 边界)。
    const TS_DIRTY_RE = /\.(ts|tsx|mts|cts)$/i
    const CFG_DIRTY_RE = /(^|\/)(tsconfig[^/]*\.json|package\.json)$/i
    const isDirty = (rel) =>
      [...dirty].some((dpath) => {
        const dp = dpath
        return (dp === rel || dp.startsWith(`${rel}/`)) && (TS_DIRTY_RE.test(dp) || CFG_DIRTY_RE.test(dp))
      })
    // `scripts/` 下的改动不影响任何项目单元;只判本项目与其依赖目录
    const dirtyHit = watch.find((w) => isDirty(w))
    if (dirtyHit) {
      run.push(p)
      continue
    }
    const rec = receipts.get(p.name)
    if (!rec || rec.digest !== digest) {
      run.push(p)
      continue
    }
    if (nowMs - Number(rec.at) > ttlMs) {
      run.push(p)
      continue
    }
    skip.push({ name: p.name, why: `输入摘要未变(${digest.slice(0, 12)}…)` })
  }
  return { skip, run, digests, blocked: null }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
