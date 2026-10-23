#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-format-changed.mjs — 格式门差值棘轮:只判本次改动文件(2026-10-20 立)
 *
 * 【为什么不再全量判】CI 的 `Format check` 原本是全量 `prettier --check`,干净检出 HEAD 实测 1029 枚
 * 不合格式(CI run 39392229065 同一读数)。成因 = 历史存量 + 本仓大量旁路落地(commit-tree)不跑
 * lint-staged;而全仓 `prettier --write` 被 AGENTS §5c 禁止(文本级批量改写会毁掉零宽水印载荷)。
 * ⇒ 全量门是恒红门(§12e),唯一合法出路是差值棘轮(§0.2):只拦本次改动带进来的,存量只报数。
 *
 * 【与提交时同口径】lint-staged 已只对改动文件跑 `prettier --write`,本脚本把 CI 的判定面收成同一个:
 *   CI:FORMAT_BASE_REF(= github.event.before)⇒ `git diff --diff-filter=ACMR <base> HEAD`
 *   本地:工作树 vs HEAD + 未跟踪文件(`git diff HEAD` / `ls-files --others`)
 *
 * 【三档退出码(§0.3)】0 通过(含 0 个改动)/ 1 有不合格式 / 2 未判定(基线取不到、prettier 缺失或
 * 自身异常)。取不到判定面绝不回落成"通过";全量审计能力保留在 `format:check:all`。
 *
 * 用法:node scripts/check-format-changed.mjs [--base <ref>] [--self-test]
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import { gitRaw } from './lib/face-reader.mjs'
// G-322:带值旗标的**唯一取值出口**(值必须存在且不以 `-` 开头,否则判死,绝不折回默认)。
import { requireFlagValue } from './lib/flag-value.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TAG = '[format-ratchet]'
const MAX_BATCH = 200
const PRETTIER_BIN = join(ROOT, 'node_modules', 'prettier', 'bin', 'prettier.cjs')

/** 与根 package.json 全量 format 命令逐字同口径(刻意不含 css/scss/mjs/cjs)。 */
export const FORMAT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml']
/** 全量审计档的 glob,唯一一份:测试断言它与 package.json 的 format:check:all 同口径。 */
export const FORMAT_GLOB = '**/*.{ts,tsx,js,jsx,json,md,yml,yaml}'
const EXT_SET = new Set(FORMAT_EXTENSIONS)

/** 取扩展名(小写,忽略大小写与反斜杠分隔)。 */
export function extOf(file) {
  const normalized = String(file ?? '').replace(/\\/g, '/')
  const base = normalized.slice(normalized.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot).toLowerCase()
}

export function isFormatTarget(file) {
  return EXT_SET.has(extOf(file))
}

/** `git ... -z` 的 NUL 分隔输出 → 路径数组(丢空段与行尾 CR,路径内容原样保留)。 */
export function parseNulList(text) {
  if (typeof text !== 'string' || text.length === 0) return []
  const out = []
  for (const raw of text.split('\0')) {
    const p = raw.replace(/\r$/, '')
    if (p) out.push(p)
  }
  return out
}

/** 归一化 + 扩展名过滤 + 去重 + 排序(确定性输出,供 --self-test 与测试断言)。 */
export function filterFormatTargets(paths) {
  const uniq = new Set()
  for (const p of paths ?? []) {
    const s = typeof p === 'string' ? p.replace(/\\/g, '/').replace(/^\.\//, '') : ''
    if (s && isFormatTarget(s)) uniq.add(s)
  }
  return [...uniq].sort()
}

export function isZeroSha(ref) {
  return typeof ref === 'string' && /^0+$/.test(ref.trim())
}

/**
 * 判定面选择(纯函数):env 给的基线的不可解析/全零 ⇒ 回落 HEAD^;HEAD^ 也没有 ⇒ 未判定。
 * 无 FORMAT_BASE_REF ⇒ 本地默认面(工作树 vs HEAD + 未跟踪)。
 */
export function decideBaseRef({ envRef, canResolve }) {
  const raw = typeof envRef === 'string' ? envRef.trim() : ''
  if (!raw) return { kind: 'worktree', ref: null }
  if (!isZeroSha(raw) && canResolve(raw)) return { kind: 'diff', ref: raw }
  if (canResolve('HEAD^')) return { kind: 'diff', ref: 'HEAD^' }
  return { kind: 'unjudged', ref: null, reason: '取不到 diff 基线' }
}

/** prettier 退出码 → 三态。0=全过;1=有不合格式;其他(含 2、null、被信号打死)=自身异常。 */
export function mapPrettierExitCode(code) {
  if (code === 0) return 'pass'
  if (code === 1) return 'unformatted'
  return 'error'
}

/** 从 prettier 输出里刮 `[warn] <path>`(prettier 3 写 stderr;汇总行不算文件)。 */
export function parsePrettierWarnings(output) {
  const hits = new Set()
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const m = /^\[warn\]\s+(.+?)\s*$/.exec(line)
    if (!m) continue
    const path = m[1]
    if (/Code style issues found/i.test(path)) continue
    hits.add(path.replace(/\\/g, '/'))
  }
  return [...hits].sort()
}

export function chunkList(list, size) {
  const out = []
  if (!Array.isArray(list) || !(size > 0)) return out
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** 结论单源:空集合 = 通过(打印 0 个,不空转);有失败 = 红。 */
export function decideOutcome({ fileCount, failures }) {
  const failed = failures ?? []
  if (!fileCount) return { code: 0, line: '0 个改动文件（未判定面=无改动，按通过）' }
  if (failed.length) return { code: 1, line: `红：${failed.length} 个改动文件不合格式` }
  return { code: 0, line: `通过：检查 ${fileCount} 个改动文件` }
}

function git(args) {
  // 取材统一走层(scripts/lib/face-reader.mjs):绝对 git + 显式 stdio/windowsHide + timeout +
  // GIT_OPTIONAL_LOCKS=0(只读判定不刷新索引 stat 缓存)都由 gitRaw 同源提供,不再自拼派生。
  return gitRaw(args, ROOT, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 })
}

function canResolve(ref) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])
    return true
  } catch {
    return false
  }
}

function collectChangedFiles(decision) {
  if (decision.kind === 'diff') {
    const raw = git(['diff', '--name-only', '-z', '--diff-filter=ACMR', decision.ref, 'HEAD', '--'])
    return { face: `diff ${decision.ref}..HEAD`, files: filterFormatTargets(parseNulList(raw)) }
  }
  const tracked = parseNulList(git(['diff', '--name-only', '-z', 'HEAD', '--']))
  const untracked = parseNulList(git(['ls-files', '-z', '--others', '--exclude-standard']))
  return {
    face: 'worktree vs HEAD + untracked',
    files: filterFormatTargets([...tracked, ...untracked]),
  }
}

function runPrettier(files) {
  const failed = []
  for (const batch of chunkList(files, MAX_BATCH)) {
    let output = ''
    let code = 0
    try {
      output = execFileSync(process.execPath, [PRETTIER_BIN, '--check', '--no-color', ...batch], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 600_000,
        maxBuffer: 32 * 1024 * 1024,
      })
    } catch (e) {
      code = typeof e.status === 'number' ? e.status : 2
      output = `${e.stdout ?? ''}\n${e.stderr ?? ''}`
    }
    const verdict = mapPrettierExitCode(code)
    if (verdict === 'error') return { verdict, failed, detail: `prettier 退出码 ${code}` }
    if (verdict === 'unformatted') {
      const hits = parsePrettierWarnings(output)
      // rc=1 却刮不到路径(输出形态漂移)⇒ 判不了,不记绿也不冒红(§0.3)
      if (hits.length === 0) return { verdict: 'error', failed, detail: '解析不到 [warn] 行' }
      failed.push(...hits)
    }
  }
  return { verdict: failed.length ? 'unformatted' : 'pass', failed, detail: '' }
}

function readFlagValue(argv, flag) {
  const eq = argv.find((a) => a.startsWith(`${flag}=`))
  if (eq) {
    const value = eq.slice(flag.length + 1).trim()
    return value ? { value } : { error: `${flag} 需要一个 ref` }
  }
  // G-322:空格形态走 scripts/lib/flag-value.mjs 单源(本器不再自己算 `argv[i + 1]`)。
  // 旧副本只挡 `--` 前缀 ⇒ 单划线 token(`-x`)被当成合法 ref 往下交给 canResolve,
  // 报的是"ref 解析不了"而不是"你少打了一个值";漏值(`--base` 打在结尾)同理由 lib 点名
  // `(其后没有任何参数)`,调用方一律走 unjudged ⇒ exit 2,不静默退回 env/默认基线。
  const f = requireFlagValue(argv, flag, { noun: 'ref' })
  if (!f.present) return {}
  if (f.error) return { error: f.error }
  const value = f.value.trim()
  if (!value) return { error: `${flag} 需要一个 ref` }
  return { value }
}

function unjudged(reason) {
  console.error(`${TAG} 未判定：${reason}`)
  return 2
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return runSelfTest()

  const baseFlag = readFlagValue(argv, '--base')
  if (baseFlag.error) return unjudged(baseFlag.error)

  let decision
  try {
    decision = decideBaseRef({ envRef: baseFlag.value ?? process.env.FORMAT_BASE_REF, canResolve })
  } catch (e) {
    return unjudged(`git 不可用（${e?.message ?? e}）`)
  }
  if (decision.kind === 'unjudged') return unjudged(decision.reason)

  if (!existsSync(PRETTIER_BIN)) return unjudged('prettier 未安装')

  let collected
  try {
    collected = collectChangedFiles(decision)
  } catch (e) {
    return unjudged(`取不到改动清单（${e?.message ?? e}）`)
  }

  const present = collected.files.filter((f) => existsSync(join(ROOT, f)))
  const missing = collected.files.length - present.length
  console.log(
    `${TAG} 面：${collected.face}；候选 ${collected.files.length} 个，送检 ${present.length} 个`,
  )
  if (missing > 0) console.log(`${TAG} 跳过 ${missing} 个已删除/不在盘上的文件`)

  const result = present.length ? runPrettier(present) : { verdict: 'pass', failed: [], detail: '' }
  if (result.verdict === 'error') return unjudged(`prettier 自身异常（${result.detail}）`)

  for (const f of result.failed) console.log(`  ✗ ${f}`)
  const outcome = decideOutcome({ fileCount: present.length, failures: result.failed })
  console.log(`${TAG} ${outcome.line}`)
  return outcome.code
}

function runSelfTest() {
  const results = []
  const eq = (label, actual, expected) => {
    results.push({ label, ok: isDeepStrictEqual(actual, expected), actual, expected })
  }

  // 扩展名过滤(大小写 / 嵌套 / 排除)
  eq('扩展名 .ts', isFormatTarget('a.ts'), true)
  eq('扩展名 .TSX 大小写不敏感', isFormatTarget('a.TSX'), true)
  eq('扩展名嵌套 .Yml', isFormatTarget('src/deep/x.Yml'), true)
  eq('反斜杠路径', isFormatTarget('apps\\web\\a.json'), true)
  eq('排除 .css', isFormatTarget('a.css'), false)
  eq('排除 .mjs', isFormatTarget('check.mjs'), false)
  eq('无扩展名', isFormatTarget('LICENSE'), false)
  eq('点开头无扩展名', isFormatTarget('.gitignore'), false)

  // NUL 解析(含空格与中文)
  eq('NUL 解析(空格/中文)', parseNulList('a.ts\0b c.md\0中文 目录/x.json\0'), [
    'a.ts',
    'b c.md',
    '中文 目录/x.json',
  ])
  eq('NUL 空串', parseNulList(''), [])
  eq('NUL 尾段空值丢弃', parseNulList('a.ts\0\0'), ['a.ts'])

  // 去重 + 排序 + 过滤
  eq('去重排序过滤', filterFormatTargets(['b.ts', 'a.TS', 'a.TS', 'c.css', 'd/y.yaml']), [
    'a.TS',
    'b.ts',
    'd/y.yaml',
  ])
  eq('全空输入', filterFormatTargets([]), [])

  // 全零 sha(新分支 push 的 before)
  eq('全零 sha', isZeroSha('0'.repeat(40)), true)
  eq('非零 sha', isZeroSha('2b2bd94fae'), false)
  eq('空串不算全零', isZeroSha(''), false)

  // 判定面四态
  eq('基线可解析', decideBaseRef({ envRef: 'abc123', canResolve: () => true }), {
    kind: 'diff',
    ref: 'abc123',
  })
  eq(
    '全零 sha 回落 HEAD^',
    decideBaseRef({ envRef: '0'.repeat(40), canResolve: (r) => r === 'HEAD^' }),
    {
      kind: 'diff',
      ref: 'HEAD^',
    },
  )
  eq('不可解析回落 HEAD^', decideBaseRef({ envRef: 'gone', canResolve: (r) => r === 'HEAD^' }), {
    kind: 'diff',
    ref: 'HEAD^',
  })
  eq('两级都取不到 = 未判定', decideBaseRef({ envRef: 'gone', canResolve: () => false }), {
    kind: 'unjudged',
    ref: null,
    reason: '取不到 diff 基线',
  })
  eq('无 env = 本地面', decideBaseRef({ envRef: '', canResolve: () => true }), {
    kind: 'worktree',
    ref: null,
  })

  // prettier 退出码映射
  eq('rc 0 = pass', mapPrettierExitCode(0), 'pass')
  eq('rc 1 = unformatted', mapPrettierExitCode(1), 'unformatted')
  eq('rc 2 = error', mapPrettierExitCode(2), 'error')
  eq('rc null = error', mapPrettierExitCode(null), 'error')

  // [warn] 刮取(汇总行不算文件)
  eq(
    'warn 刮取',
    parsePrettierWarnings(
      'Checking formatting...\n[warn] a.ts\n[warn] 中文/b.md\n' +
        '[warn] Code style issues found in 2 files. Run Prettier with --write to fix.\n',
    ),
    ['a.ts', '中文/b.md'],
  )

  // 批上限
  eq(
    '批 200 上限',
    chunkList(
      Array.from({ length: 401 }, (_v, i) => i),
      MAX_BATCH,
    ).map((b) => b.length),
    [200, 200, 1],
  )

  // 空集合 = 通过(不空转)
  eq('空集合通过', decideOutcome({ fileCount: 0, failures: [] }), {
    code: 0,
    line: '0 个改动文件（未判定面=无改动，按通过）',
  })
  eq('有失败 = 红', decideOutcome({ fileCount: 3, failures: ['a.ts'] }).code, 1)
  eq('全过 = 绿', decideOutcome({ fileCount: 3, failures: [] }).code, 0)

  const failed = results.filter((r) => !r.ok)
  for (const r of failed) {
    console.error(
      `  ✗ ${r.label}:实得 ${JSON.stringify(r.actual)}；期望 ${JSON.stringify(r.expected)}`,
    )
  }
  if (failed.length) {
    console.error(`${TAG} self-test 红：${failed.length}/${results.length} 断言失败`)
    return 1
  }
  console.log(`${TAG} self-test 通过：${results.length}/${results.length} 断言`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().then(
    (code) => {
      process.exitCode = code
    },
    (e) => {
      console.error(`${TAG} 未判定：脚本自身异常(${e?.message ?? e})`)
      process.exit(2)
    },
  )
}

export const __test__ = {
  extOf,
  isFormatTarget,
  parseNulList,
  filterFormatTargets,
  isZeroSha,
  decideBaseRef,
  mapPrettierExitCode,
  parsePrettierWarnings,
  chunkList,
  decideOutcome,
  MAX_BATCH,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
