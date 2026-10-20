// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像/形状测试:判据一律 import 源脚本的 __test__(本文件不复制第二份判据)。
// 本票锁三件事:① 纯函数行为(扩展名/NUL/去重排序/全零 sha/三态映射/空集合);
// ② --self-test 真跑得通(不是"写了但跑不了");③ 接线形状(package.json 两条命令 +
// lint 作业的 fetch-depth / FORMAT_BASE_REF / 命令同面),防止"脚本对了但没装车"。
// 不依赖真实 git 仓状态:本文件零 git 调用、零临时仓。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FORMAT_GLOB, __test__ } from '../check-format-changed.mjs'

const {
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
} = __test__

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-format-changed.mjs')

test('T1 扩展名过滤:大小写不敏感、嵌套生效、css/mjs 一律排除', () => {
  assert.equal(isFormatTarget('a.ts'), true)
  assert.equal(isFormatTarget('a.TSX'), true)
  assert.equal(isFormatTarget('src/deep/nested/x.Yml'), true)
  assert.equal(isFormatTarget('apps\\web\\a.json'), true)
  assert.equal(extOf('a.TS'), '.ts')
  assert.equal(isFormatTarget('a.css'), false)
  assert.equal(isFormatTarget('a.scss'), false)
  assert.equal(isFormatTarget('check.mjs'), false)
  assert.equal(isFormatTarget('a.cjs'), false)
  assert.equal(isFormatTarget('a.tsx.bak'), false)
  assert.equal(isFormatTarget('LICENSE'), false)
  assert.equal(isFormatTarget('.gitignore'), false)
  assert.equal(isFormatTarget(''), false)
})

test('T2 NUL 输出解析:含空格与中文路径原样保留,空段丢弃', () => {
  assert.deepEqual(parseNulList('a.ts\0b c.md\0中文 目录/x.json\0'), [
    'a.ts',
    'b c.md',
    '中文 目录/x.json',
  ])
  assert.deepEqual(parseNulList(''), [])
  assert.deepEqual(parseNulList('a.ts\0\0'), ['a.ts'])
  assert.deepEqual(parseNulList('a.ts\0b.md'), ['a.ts', 'b.md'])
})

test('T3 去重 + 排序 + 过滤是确定性的(与输入顺序无关)', () => {
  const a = filterFormatTargets(['b.ts', 'a.TS', 'a.TS', 'c.css', 'd/y.yaml'])
  const b = filterFormatTargets(['d/y.yaml', 'c.css', 'a.TS', 'b.ts'])
  assert.deepEqual(a, ['a.TS', 'b.ts', 'd/y.yaml'])
  assert.deepEqual(a, b)
  assert.deepEqual(filterFormatTargets([]), [])
  assert.deepEqual(filterFormatTargets(['./x.md', 'x.md']), ['x.md'])
})

test('T4 全零 sha 判定 + 判定面四态(可解析/零 sha 回落/不可解析回落/两级都无=未判定)', () => {
  assert.equal(isZeroSha('0'.repeat(40)), true)
  assert.equal(isZeroSha('2b2bd94fae'), false)
  assert.equal(isZeroSha(''), false)

  assert.deepEqual(decideBaseRef({ envRef: 'abc123', canResolve: () => true }), {
    kind: 'diff',
    ref: 'abc123',
  })
  assert.deepEqual(decideBaseRef({ envRef: '0'.repeat(40), canResolve: (r) => r === 'HEAD^' }), {
    kind: 'diff',
    ref: 'HEAD^',
  })
  assert.deepEqual(decideBaseRef({ envRef: 'gone', canResolve: (r) => r === 'HEAD^' }), {
    kind: 'diff',
    ref: 'HEAD^',
  })
  assert.deepEqual(decideBaseRef({ envRef: 'gone', canResolve: () => false }), {
    kind: 'unjudged',
    ref: null,
    reason: '取不到 diff 基线',
  })
  assert.deepEqual(decideBaseRef({ envRef: '', canResolve: () => true }), {
    kind: 'worktree',
    ref: null,
  })
})

test('T5 prettier 退出码三态映射:0/1 之外一律 error(含 null,不把没判写成通过)', () => {
  assert.equal(mapPrettierExitCode(0), 'pass')
  assert.equal(mapPrettierExitCode(1), 'unformatted')
  assert.equal(mapPrettierExitCode(2), 'error')
  assert.equal(mapPrettierExitCode(3), 'error')
  assert.equal(mapPrettierExitCode(null), 'error')
  assert.equal(mapPrettierExitCode(undefined), 'error')
})

test('T6 [warn] 刮取:只认文件行,汇总行不算文件', () => {
  const out =
    'Checking formatting...\n[warn] a.ts\n[warn] 中文/b.md\n' +
    '[warn] Code style issues found in 2 files. Run Prettier with --write to fix.\n'
  assert.deepEqual(parsePrettierWarnings(out), ['a.ts', '中文/b.md'])
  assert.deepEqual(
    parsePrettierWarnings('Checking formatting...\nAll matched files use Prettier code style!'),
    [],
  )
  assert.deepEqual(parsePrettierWarnings(''), [])
})

test('T7 空集合 = 通过(打印 0 个,不空转);有失败 = 红', () => {
  assert.deepEqual(decideOutcome({ fileCount: 0, failures: [] }), {
    code: 0,
    line: '0 个改动文件（未判定面=无改动，按通过）',
  })
  assert.equal(decideOutcome({ fileCount: 2, failures: [] }).code, 0)
  assert.equal(decideOutcome({ fileCount: 2, failures: ['a.ts'] }).code, 1)
  assert.match(
    decideOutcome({ fileCount: 2, failures: ['a.ts'] }).line,
    /^红：1 个改动文件不合格式$/,
  )
})

test('T8 分批:每批不超过 200(Windows 命令行长度上限)', () => {
  const batches = chunkList(
    Array.from({ length: 401 }, (_v, i) => i),
    MAX_BATCH,
  )
  assert.deepEqual(
    batches.map((b) => b.length),
    [200, 200, 1],
  )
  assert.ok(batches.every((b) => b.length <= MAX_BATCH))
  assert.deepEqual(chunkList([], MAX_BATCH), [])
})

test('T9 --self-test 真跑得通且断言数 ≥ 10', () => {
  const res = spawnSync(process.execPath, [SCRIPT, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  })
  assert.equal(res.status, 0, `self-test 非 0:${res.stdout}${res.stderr}`)
  const m = /self-test 通过：(\d+)\/(\d+) 断言/.exec(res.stdout)
  assert.ok(m, `未打印 self-test 结论:${res.stdout}`)
  assert.equal(m[1], m[2])
  assert.ok(Number(m[1]) >= 10, `断言数 ${m[1]} 少于 10`)
})

test('T10 接线形状锁:package.json 两条命令 + lint 作业同面(fetch-depth/基线/命令)', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts['format:check'], 'node scripts/check-format-changed.mjs')
  const full = pkg.scripts['format:check:all']
  assert.ok(full, '缺 format:check:all(全量审计档不许丢)')
  assert.match(full, /prettier --check/)
  assert.ok(
    full.includes(FORMAT_GLOB),
    `format:check:all 的 glob 与脚本 FORMAT_GLOB 不同口径:${full}`,
  )

  const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'ci-monorepo.yml'), 'utf8')
  const jobKeys = [...workflow.matchAll(/\n {2}([a-z][a-z0-9-]*):\n/g)]
  const i = jobKeys.findIndex((m) => m[1] === 'lint')
  assert.ok(i > -1, 'ci-monorepo.yml 里找不到 lint 作业')
  const start = jobKeys[i].index
  const end = i + 1 < jobKeys.length ? jobKeys[i + 1].index : workflow.length
  const lintBlock = workflow.slice(start, end)

  assert.ok(
    lintBlock.includes('fetch-depth: 2'),
    'lint 作业 checkout 缺 fetch-depth: 2(HEAD^ 取不到)',
  )
  assert.ok(lintBlock.includes('FORMAT_BASE_REF'), 'lint 作业缺 FORMAT_BASE_REF env')
  assert.ok(lintBlock.includes('github.event.before'), 'FORMAT_BASE_REF 应取 github.event.before')
  assert.ok(lintBlock.includes('pnpm run format:check'), 'lint 作业未调用 format:check')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
