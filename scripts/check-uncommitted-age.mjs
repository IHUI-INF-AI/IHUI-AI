#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-uncommitted-age.mjs — 未提交源码改动「年龄」守门(B14,2026-09-21 事故配套)
 *
 * 背景(2026-09-21 真实事故,同日两次):
 *   共享工作树里某会话执行了 `git checkout` / reset 类操作,把另一会话
 *   **已验证但尚未 commit** 的未提交改动整体还原 —— 一次要重做,一次连带丢失
 *   两条常驻防漂移测试。stash 侧早有 check-stale-stashes.mjs(guardian 第 30b 项)
 *   兜住「藏进 stash 失联」,但「留在工作树里没提交」这一整类**没有任何机制覆盖**。
 *
 * 防护目标:
 *   让「源码改动长时间停在未提交状态」变得可见 —— 工作树不是暂存区,任何一次
 *   并行的 checkout/reset/clean 都会把它整体抹掉,且不留痕迹。
 *
 * 判据:
 *   `git status --porcelain -z` 取已改动(tracked)+ 未跟踪新文件清单 →
 *   逐个取 mtime → 存在**年龄 > 阈值(默认 45 分钟)的未提交源码文件**即判风险。
 *   源码扩展名:.ts .tsx .js .jsx .mjs .cjs .py .css .sql
 *
 * 输出卫生:只报「文件名 + 年龄 + 建议动作」,**绝不输出文件内容**
 *   (未提交改动里可能含密钥,.env* 亦在豁免清单内)。
 *
 * 豁免(口径与仓库既有守门一致,复用 scripts/lib/exclude-dirs.mjs):
 *   通用排除目录(node_modules / dist / .next / .turbo / 虚拟环境 …)
 *   + 本脚本追加:.ihui-agent、generated、tmp
 *   + 文件级:.env*、*.gen.<源码扩展名>
 *
 * 参数:
 *   --json               机器可读输出(单 JSON 对象)
 *   --threshold-min <n>  阈值分钟数,亦支持 --threshold-min=<n>
 *                        优先级 CLI > 环境变量 IHUI_UNCOMMITTED_AGE_MIN > 默认 45
 *   --strict             存在超龄文件时 exit 1(CI/手动审计用);默认 warn-only exit 0
 *   --self-test          跑内置用例(纯函数,不碰 git/文件系统)
 *
 * 退出码:
 *   0 — 通过,或(warn-only 模式下)仅告警
 *   1 — --strict 且存在超龄源码改动
 *   2 — 脚本自身异常
 *
 * 调用方:
 *   - scripts/guardian-runner.mjs 第 54 项(warn-only)
 *   - 手动:node scripts/check-uncommitted-age.mjs
 *
 * 关于 pre-commit 传入的 --staged:本守门**刻意忽略**该参数并继续全量扫描工作树 ——
 *   风险恰恰在「未暂存的工作树改动」(已 staged 的内容已由 index 保住,不在本判据内)。
 *   因此在 hook 里按工作树全量判级才是正确语义,不做 staged 收窄。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { withExcludes } from './lib/exclude-dirs.mjs'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const DEFAULT_THRESHOLD_MIN = 45
export const THRESHOLD_ENV = 'IHUI_UNCOMMITTED_AGE_MIN'

/** 参与「未提交工作丢失」判定的源码扩展名 */
export const SOURCE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.css', '.sql',
])

/** 本脚本特有的排除目录(在共享 EXCLUDE_DIRS 基础上追加) */
export const EXCLUDED_DIRS = withExcludes(['.ihui-agent', 'generated', 'tmp'])

/** .env / .env.local / apps/api/.env.prod … —— 密钥载体,一律不参与判定也不输出内容 */
const DOTENV_RE = /(^|\/)\.env(\.|$)/
/** 生成物(*.gen.ts / *.gen.tsx / *.gen.css …):mtime 由生成器决定,不构成人为未提交工作 */
const GENERATED_FILE_RE = /\.gen\.(ts|tsx|js|jsx|mjs|cjs|py|css|sql)$/i

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// ─── git 调用:不依赖环境(绝对路径 + -c safe.directory=*),见 AGENTS.md §5b ───
const GIT_BIN = (() => {
  if (process.platform !== 'win32') return 'git'
  try {
    const whereOut = execFileSync('where', ['git'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10_000,
    })
    const found = whereOut.split('\n').map((l) => l.trim()).filter(Boolean)
    // MSYS 的 git shim(.git.exe / usr/bin/git)在 Windows 下有双重陷阱,优先 Git\cmd\git.exe
    return (
      found.find((p) => /\\cmd\\git\.exe$/i.test(p)) ??
      found.find((p) => /git\.exe$/i.test(p) && !/\\usr\\bin\\/i.test(p)) ??
      'git'
    )
  } catch {
    return 'git'
  }
})()

function runGit(args) {
  try {
    return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', ...args], {
      encoding: 'utf8',
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
      timeout: 30_000,
      windowsHide: true,
    })
  } catch {
    return ''
  }
}

// ─── 纯函数(§22c:测试直接 import,不复制实现) ────────────────────

/** 反斜杠归一为 POSIX 分隔符(git 本身输出 /,防御式归一) */
export function normalizePath(p) {
  return String(p).replace(/\\/g, '/')
}

/**
 * 解析 `git status --porcelain -z` 输出。
 * -z 记录以 NUL 分隔,格式 `XY <path>`;rename/copy 后紧跟一条 origin path(跳过)。
 * @returns {{path:string,status:string,untracked:boolean}[]}
 */
export function parsePorcelainZ(raw) {
  const parts = String(raw ?? '').split('\0')
  const out = []
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i]
    if (rec.length < 4) continue
    const xy = rec.slice(0, 2)
    const p = normalizePath(rec.slice(3))
    if (!p) continue
    out.push({ path: p, status: xy, untracked: xy === '??' })
    const isRename = xy[0] === 'R' || xy[0] === 'C' || xy[1] === 'R' || xy[1] === 'C'
    if (isRename) i++ // 下一条是 origin path,不是待判定对象
  }
  return out
}

/** 是否源码文件(按扩展名) */
export function isSourceFile(p) {
  const norm = normalizePath(p)
  const base = norm.slice(norm.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return false
  return SOURCE_EXTS.has(base.slice(dot).toLowerCase())
}

/** 是否命中豁免(目录段命中 EXCLUDED_DIRS / .env* / *.gen.*) */
export function isExemptPath(p, excludedDirs = EXCLUDED_DIRS) {
  const norm = normalizePath(p)
  if (DOTENV_RE.test(norm)) return true
  if (GENERATED_FILE_RE.test(norm)) return true
  const segs = norm.split('/')
  return segs.slice(0, -1).some((seg) => excludedDirs.has(seg))
}

/** 候选 = 源码文件 且 非豁免 且 非目录条目(目录条目以 / 结尾,由 walk 展开) */
export function isCandidatePath(p) {
  const norm = normalizePath(p)
  if (norm.endsWith('/')) return false
  return isSourceFile(norm) && !isExemptPath(norm)
}

/**
 * 把 porcelain 条目整理成待判定文件清单。
 * 未跟踪目录(`?? dir/`)在 porcelain 默认(-untracked-files=normal)下会被折叠,
 * 交由 listFilesInDir 展开;此处只保留文件条目并去重。
 */
export function collectCandidatePaths(entries, listFilesInDir) {
  const seen = new Set()
  for (const e of entries) {
    const norm = normalizePath(e.path)
    if (norm.endsWith('/')) {
      if (isExemptPath(norm + 'x')) continue
      // 二次过滤:注入的 listFilesInDir 若未筛(或直接返回原始 readdir 结果),
      // 也不得让非源码/豁免路径混进判定集。
      for (const f of listFilesInDir(norm)) {
        const child = normalizePath(f)
        if (isCandidatePath(child)) seen.add(child)
      }
      continue
    }
    if (isCandidatePath(norm)) seen.add(norm)
  }
  return [...seen].sort()
}

/** 阈值解析:CLI(--threshold-min n / --threshold-min=n)> env > 默认 */
export function resolveThresholdMin(argv, env) {
  const inline = argv.find((a) => a.startsWith('--threshold-min='))?.split('=')[1]
  const spacedIdx = argv.indexOf('--threshold-min')
  const spaced = spacedIdx >= 0 ? argv[spacedIdx + 1] : undefined
  const cliRaw = inline ?? spaced
  const envRaw = env?.[THRESHOLD_ENV]
  for (const raw of [cliRaw, envRaw]) {
    if (raw === undefined || raw === '') continue
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return DEFAULT_THRESHOLD_MIN
}

/**
 * 核心判定(纯函数):给定带 mtime 的条目,算出扫描数与超龄数。
 * @param {{path:string,mtimeMs:number}[]} statables
 */
export function classifyByAge(statables, thresholdMin, now = Date.now()) {
  const thresholdMs = thresholdMin * 60_000
  const risky = []
  for (const s of statables) {
    if (!Number.isFinite(s.mtimeMs)) continue
    const ageMs = now - s.mtimeMs
    if (ageMs > thresholdMs) risky.push({ file: normalizePath(s.path), ageMs })
  }
  risky.sort((a, b) => b.ageMs - a.ageMs)
  return { scanned: statables.length, risky }
}

/** 人类可读年龄:<60min 用分钟,<48h 用小时,否则天 */
export function formatAge(ms) {
  const min = ms / 60_000
  if (min < 60) return `${Math.max(1, Math.round(min))} 分钟`
  const h = min / 60
  if (h < 48) return `${Math.round(h)} 小时`
  return `${(h / 24).toFixed(1)} 天`
}

// ─── 文件系统侧(仅 CLI 路径使用) ────────────────────────────────

/** 展开未跟踪目录里的候选源码文件(受限递归,防意外深/大目录) */
function walkUntrackedDir(relDir) {
  const files = []
  const abs = join(ROOT, relDir)
  const stack = [{ abs, rel: normalizePath(relDir) }]
  let budget = 5_000
  while (stack.length && budget > 0) {
    const cur = stack.pop()
    let names
    try {
      names = readdirSync(cur.abs)
    } catch {
      continue
    }
    for (const name of names) {
      if (budget-- <= 0) return files
      const childAbs = join(cur.abs, name)
      const childRel = `${cur.rel}${cur.rel.endsWith('/') ? '' : '/'}${name}`
      let st
      try {
        st = statSync(childAbs)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (isExemptPath(childRel + '/x')) continue
        stack.push({ abs: childAbs, rel: childRel })
        continue
      }
      if (isCandidatePath(childRel)) files.push(childRel)
    }
  }
  return files
}

function mtimeMsOf(relPath) {
  try {
    return statSync(join(ROOT, relPath)).mtimeMs
  } catch {
    return Number.NaN
  }
}

// ─── 自检(§self-test:纯函数用例,不依赖 git / 文件系统) ──────────
export function runSelfTest() {
  const results = []
  const now = 1_700_000_000_000
  const ok = (name, cond, extra = '') => results.push({ name, pass: !!cond, extra })
  const stat = (file, ageMin) => ({ path: file, mtimeMs: now - ageMin * 60_000 })

  // 1) 无改动 = pass
  const none = parsePorcelainZ('')
  ok('无改动:porcelain 解析为空', none.length === 0)
  ok('无改动:判定 pass', classifyByAge([], 45, now).risky.length === 0)

  // 2) 新改动 = pass(阈值内)
  const fresh = classifyByAge([stat('apps/web/src/a.ts', 10)], 45, now)
  ok('新改动(10 分钟):不报', fresh.risky.length === 0 && fresh.scanned === 1)

  // 3) 老改动 = fail(超阈值)
  const old = classifyByAge([stat('apps/api/src/routes/x.ts', 120)], 45, now)
  ok('老改动(2 小时):报出', old.risky.length === 1 && old.risky[0].file === 'apps/api/src/routes/x.ts')
  ok('老改动:年龄可读', old.risky[0].ageMs === 120 * 60_000)
  ok('阈值边界:恰好等于阈值不报(严格大于)', classifyByAge([stat('a.ts', 45)], 45, now).risky.length === 0)

  // 4) 豁免目录「不该被报」= fail 不成立
  const exempt = [
    '.ihui-agent/tmp/probe/old-probe.ts',
    'node_modules/pkg/index.ts',
    'apps/web/dist/old.js',
    'apps/web/.next/static/chunk.ts',
    'packages/i18n/generated/remote-locales.gen.ts',
    'apps/api/.env.local',
    'docs/notes.md',
    'node_modules/pkg/dist/a.js',
  ]
  const kept = exempt.filter(isCandidatePath)
  ok('豁免清单:目录/生成物/env/非源码全部不进入判定', kept.length === 0, kept.join(','))
  // 端到端:过滤发生在收集层而非年龄层 —— 豁免文件即便超龄也不会被报出。
  const piped = classifyByAge(
    collectCandidatePaths(
      exempt.map((f) => ({ path: f, status: ' M', untracked: false })),
      () => [],
    ).map((f) => stat(f, 600)),
    45,
    now,
  )
  ok('端到端:豁免路径经收集层后不报(即便年龄超阈)', piped.risky.length === 0 && piped.scanned === 0)
  ok('非豁免:scripts/legacy.cjs 属源码候选(不得被目录口径误伤)', isCandidatePath('scripts/legacy.cjs') === true)
  ok('豁免:.ihui-agent 命中目录豁免', isExemptPath('.ihui-agent/tmp/a.ts') === true)
  ok('豁免:generated 与 *.gen.ts 双重命中', isExemptPath('p/generated/x.ts') && isExemptPath('p/x.gen.ts'))
  ok('豁免:.env* 命中', isExemptPath('apps/api/.env') && isExemptPath('.env.production'))
  ok('非豁免:普通源码文件不误豁免', isCandidatePath('apps/api/src/main.ts') && isCandidatePath('app/styles/globals.css'))

  // 5) porcelain 解析细节
  const parsed = parsePorcelainZ(' M apps/web/src/a.ts\0?? scripts/new.mjs\0R  apps/new.ts\0apps/old.ts\0')
  ok('解析:modified + untracked + rename', parsed.length === 3 && parsed[2].path === 'apps/new.ts', JSON.stringify(parsed.map((p) => p.path)))
  ok('解析:rename 的 origin path 被跳过', !parsed.some((p) => p.path === 'apps/old.ts'))
  ok('解析:untracked 标记正确', parsed[1].untracked === true && parsed[0].untracked === false)
  ok('解析:反斜杠归一', parsePorcelainZ(' M apps\\web\\b.ts\0')[0].path === 'apps/web/b.ts')

  // 6) 未跟踪目录展开走 collectCandidatePaths
  const expanded = collectCandidatePaths(
    [{ path: 'scripts/probe/', status: '??', untracked: true }, { path: 'a.ts', status: ' M', untracked: false }],
    () => ['scripts/probe/old.ts', 'scripts/probe/readme.md'],
  )
  ok('展开:未跟踪目录内源码文件被纳入', expanded.join(',') === 'a.ts,scripts/probe/old.ts', expanded.join(','))
  ok('展开:目录内豁免路径不落单', collectCandidatePaths([{ path: 'node_modules/x/', status: '??' }], () => ['node_modules/x/a.ts']).length === 0)

  // 7) 阈值解析优先级
  ok('阈值:默认 45', resolveThresholdMin([], {}) === DEFAULT_THRESHOLD_MIN)
  ok('阈值:env 覆盖', resolveThresholdMin([], { [THRESHOLD_ENV]: '10' }) === 10)
  ok('阈值:CLI 等号形式优先于 env', resolveThresholdMin(['--threshold-min=5'], { [THRESHOLD_ENV]: '10' }) === 5)
  ok('阈值:CLI 空格形式', resolveThresholdMin(['--threshold-min', '7'], {}) === 7)
  ok('阈值:非法值回落默认', resolveThresholdMin(['--threshold-min=abc'], { [THRESHOLD_ENV]: '-1' }) === DEFAULT_THRESHOLD_MIN)

  // 8) 排序:最老的排前面(报告可读性)
  const sorted = classifyByAge([stat('new.ts', 50), stat('oldest.ts', 500), stat('mid.ts', 100)], 45, now)
  ok('排序:按年龄降序', sorted.risky.map((r) => r.file).join(',') === 'oldest.ts,mid.ts,new.ts')

  // 9) 年龄可读性
  ok('格式:分钟档', /分钟$/.test(formatAge(20 * 60_000)))
  ok('格式:小时档', /小时$/.test(formatAge(5 * 3_600_000)))
  ok('格式:天档', /天$/.test(formatAge(3 * 86_400_000)))

  return results
}

// ─── 报告输出 ───────────────────────────────────────────────────
function printReport({ thresholdMin, risky, scanned, strict }) {
  if (risky.length === 0) {
    console.log(
      `${C.green}✅ 未提交改动年龄守门:${scanned} 个源码改动均在 ${thresholdMin} 分钟内(或无源码改动)${C.reset}`,
    )
    return
  }
  console.log(`${C.yellow}${C.bold}⏳ 未提交源码改动守门(B14,2026-09-21 事故配套)${C.reset}`)
  console.log(
    `  ${C.dim}阈值 ${thresholdMin} 分钟 | 待判定源码改动 ${scanned} 个 | 超龄 ${risky.length} 个${C.reset}`,
  )
  for (const r of risky.slice(0, 20)) {
    console.log(
      `  ${C.yellow}⚠️ ${C.dim}${r.file}${C.reset} ${C.yellow}未提交已 ${C.bold}${formatAge(r.ageMs)}${C.reset}${C.yellow}${C.reset}`,
    )
    console.log(`     ${C.cyan}建议:node scripts/safe-commit.mjs -m "<本次改动说明>" -- ${r.file}${C.reset}`)
  }
  if (risky.length > 20) {
    console.log(`  ${C.dim}…另有 ${risky.length - 20} 个超龄文件(全量见 --json)${C.reset}`)
  }
  console.log(
    `\n${C.yellow}💡 共享工作树里任何一次并行的 git checkout / reset / clean 都会把这些未提交改动整体抹掉,${C.reset}`,
  )
  console.log(`${C.yellow}   且不留痕迹(2026-09-21 同日两次功能丢失即此因)。改完即提交,或按 §12d 用 worktree 隔离。${C.reset}`)
  if (strict) console.log(`${C.red}❌ --strict:存在超龄未提交源码改动,判定失败${C.reset}`)
}

async function main() {
  const argv = process.argv.slice(2)

  if (argv.includes('--self-test')) {
    const results = runSelfTest()
    const failed = results.filter((r) => !r.pass)
    for (const r of results) {
      console.log(`${r.pass ? '  ✅' : `${C.red}  ❌`} ${r.name}${r.extra ? ` ${C.dim}[${r.extra}]${C.reset}` : ''}${C.reset}`)
    }
    console.log(
      failed.length === 0
        ? `${C.green}自检通过:${results.length} 例全绿${C.reset}`
        : `${C.red}自检失败:${failed.length}/${results.length}${C.reset}`,
    )
    process.exit(failed.length === 0 ? 0 : 1)
  }

  const json = argv.includes('--json')
  const strict = argv.includes('--strict')
  const thresholdMin = resolveThresholdMin(argv, process.env)

  const raw = runGit(['status', '--porcelain', '-z'])
  const entries = parsePorcelainZ(raw)
  const candidates = collectCandidatePaths(entries, walkUntrackedDir)
  const statables = candidates
    .map((p) => ({ path: p, mtimeMs: mtimeMsOf(p) }))
    .filter((s) => Number.isFinite(s.mtimeMs))
  const { risky, scanned } = classifyByAge(statables, thresholdMin)

  if (json) {
    console.log(
      JSON.stringify(
        {
          ok: risky.length === 0,
          thresholdMin,
          scanned,
          risky: risky.map((r) => ({ file: r.file, ageMin: Math.round(r.ageMs / 60_000) })),
        },
        null,
        2,
      ),
    )
    process.exit(strict && risky.length > 0 ? 1 : 0)
  }

  if (!existsSync(join(ROOT, '.git'))) {
    console.log(`${C.yellow}⚠ 非 git 工作区,跳过未提交改动年龄守门${C.reset}`)
    process.exit(0)
  }

  printReport({ thresholdMin, risky, scanned, strict })
  process.exit(strict && risky.length > 0 ? 1 : 0)
}

// ─── 入口守护(§22d):被 import 时不得触发 main() 副作用 ───
export const __test__ = {
  parsePorcelainZ,
  normalizePath,
  isSourceFile,
  isExemptPath,
  isCandidatePath,
  collectCandidatePaths,
  resolveThresholdMin,
  classifyByAge,
  formatAge,
  runSelfTest,
  SOURCE_EXTS,
  EXCLUDED_DIRS,
  DEFAULT_THRESHOLD_MIN,
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(`${C.red}❌ check-uncommitted-age 脚本执行异常:${e?.message ?? e}${C.reset}`)
    console.error(e?.stack ?? '(no stack)')
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
