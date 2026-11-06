// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端级联 rn-color 段的**行为级**零写证明(级联 S11 要求的 previewProof)。
//
// 为什么不能只读码(§0.7 豁免必须验过才免 / 阳性对照要钉出处):
// `fix-rn-color-literals.mjs` 源码里确实存在往共享对象库写字节的腿 —— 第 602 行
// `git hash-object -w --stdin`(`--emit-blobs` 出口)。缺省档 `--json` 结构上到不了那一格,
// 但"我读了一遍码说走不到"不是证明:级联的 argv 一旦被后人改错,那一次就会静默写进共享库。
//
// 量法 = 注入替身(与 land-cross-end-shell-pages-preview 的 P3 同一形态):
// 真起子进程跑级联**自己登记的** preview argv,preload 把 node:fs 写口与 node:child_process
// 派生口换成"记录后转调"的替身 ⇒ 只归因给本器物这一跑。
// ⚠ 不用"数对象库松散对象前后差"那种尺:本仓是多会话共写机,守护/别席每一秒都在造对象,
//   那种读数会被并发写者污染(实测被 +11 枚他人对象判红过一次)——坏尺子比没尺子更糟。
//
// 成对设计(防空转):
//   P1 敏感性对照:同一个替身喂一次真的 `git hash-object -w`(落临时夹具仓,不碰本仓对象库)
//      ⇒ 必须记到 WRITE-git-hash-object-w;记不到就说明替身没接上,后面的"零写"一律作废。
//   P2 行为锁:预演档 ⇒ 零条 WRITE-*,且必须记到 ≥1 条 read-git-*(证明子进程真在跑、替身真在听),
//      同时器物自述"只读档(未写盘)"且机读结论解得出。
//
// argv 取自级联自己登记的 preview 档(import __test__ 的 stageArgv,§22c 零复算):
// 本档证的正是级联缺省档实际会派出去的那一串参数,不是另一份手抄 argv。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as C } from '../sync-cross-end-cascade.mjs'
// 器物本体有 isDirectRun 守卫,import 不触发主流程;判据一律走它自己的 __test__ 出口(§22c)。
import { __test__ as COLOR } from '../fix-rn-color-literals.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const TOOL = join(ROOT, 'scripts', 'fix-rn-color-literals.mjs')

const rnColorStage = C.STAGES.find((s) => s.name === 'rn-color')
assert.ok(rnColorStage, '级联里没有 rn-color 段 ⇒ 本证明失去射程对象,必须与级联同批改')
const PREVIEW_ARGV = C.stageArgv(rnColorStage, C.parseArgs([]))
const APPLY_ARGV = C.stageArgv(rnColorStage, C.parseArgs(['--apply']))

/**
 * preload 替身:fs 写口 + 派生口全部"记录后转调"。
 * 记录落 JSONL,由父进程读回来分桶(WRITE-* / read-git-*)。
 */
const PRELOAD_SRC = `
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const fs = req('node:fs')
const cp = req('node:child_process')
const OUT = __OUT__
const records = []
const flush = () => fs.writeFileSync(OUT, records.map((r) => JSON.stringify(r)).join('\\n') + '\\n', 'utf8')
const GIT_WRITE_CMDS = ['update-ref', 'commit-tree', 'write-tree', 'gc', 'prune', 'apply', 'checkout', 'reset', 'am', 'rebase', 'merge', 'push', 'index-pack', 'clean', 'add']
for (const k of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'rmSync', 'rmdirSync', 'unlinkSync', 'renameSync', 'copyFileSync', 'truncateSync']) {
  const orig = fs[k]
  if (typeof orig !== 'function') continue
  fs[k] = function (...a) {
    const t = String(a[0] ?? '')
    // 替身自己的落账口不算器物动作
    if (!t.includes('probe-records')) records.push({ kind: 'fs.' + k, target: t.slice(0, 160) })
    return orig.apply(fs, a)
  }
}
const classify = (file, args) => {
  const a = (Array.isArray(args) ? args : []).map(String)
  const base = String(file ?? '').split(/[\\\\/]/).pop().toLowerCase()
  if (base === 'git' || base === 'git.exe' || base === 'git.cmd') {
    if (a.includes('hash-object') && (a.includes('-w') || a.includes('--write'))) return 'WRITE-git-hash-object-w'
    const w = a.find((x) => GIT_WRITE_CMDS.includes(x))
    if (w) return 'WRITE-git-' + w
    const cmd = a.find((x) => /^[a-z][a-z-]*$/.test(x) && !x.includes('='))
    return 'read-git-' + (cmd || '?')
  }
  const script = a.find((x) => /[.](mjs|cjs)$/.test(x)) || ''
  if (/watermark[.]mjs$/.test(script)) return 'WRITE-spawn-watermark-' + (a.find((x) => /inject|clean|verify/.test(x)) || '?')
  if (/object-space-land[.]mjs$/.test(script)) return 'WRITE-spawn-object-space-land'
  return 'spawn-other'
}
const wrap = (fn, name) =>
  function (file, args, opts) {
    records.push({ kind: classify(file, args), target: name + ':' + (Array.isArray(args) ? args.join(' ') : String(args ?? '')).slice(0, 160) })
    const r = fn.apply(cp, arguments)
    flush()
    return r
  }
cp.execFileSync = wrap(cp.execFileSync, 'execFileSync')
cp.spawnSync = wrap(cp.spawnSync, 'spawnSync')
cp.spawn = wrap(cp.spawn, 'spawn')
process.on('exit', flush)
flush()
`

function runWithProbe(childArgv, { cwd = ROOT, env = {}, timeout = 9 * 60 * 1000 } = {}) {
  const dir = mkScratch('rn-color-preview-probe-')
  const preload = join(dir, 'probe-preload.mjs')
  const out = join(dir, 'probe-records.json')
  try {
    writeFileSync(preload, PRELOAD_SRC.replace('__OUT__', JSON.stringify(out)), 'utf8')
    const r = spawnSync(process.execPath, ['--import', `file:${preload.replace(/\\/g, '/')}`, ...childArgv], {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout,
      maxBuffer: 1 << 24,
      stdio: ['ignore', 'pipe', 'pipe'], // §12g 显式接管 stdio
      env: { ...process.env, ...env, NODE_OPTIONS: '' },
    })
    const rows = (() => {
      try {
        return readFileSync(out, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l))
      } catch {
        return null
      }
    })()
    return { rc: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? ''), rows, dir }
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
}

const writesOf = (rows) => rows.filter((x) => String(x.kind).startsWith('WRITE-') || String(x.kind).startsWith('fs.'))
const readsOf = (rows) => rows.filter((x) => String(x.kind).startsWith('read-git-'))

test('P0 形状锁(成对):缺省档 argv 一条写旗都没有,而写盘档确有写旗 —— 两形都得量到', () => {
  const WRITE_FLAGS = ['--apply', '--write', '--land', '--emit-blobs']
  assert.ok(PREVIEW_ARGV.length > 0, '缺省档 argv 取空 ⇒ 本档什么都没派到,零写读数不成立')
  assert.deepEqual(
    PREVIEW_ARGV.filter((a) => WRITE_FLAGS.includes(a)),
    [],
    `级联给 rn-color 登记的 preview argv 含写旗:${PREVIEW_ARGV.join(' ')}`,
  )
  assert.ok(APPLY_ARGV.includes('--apply'), '写盘档必须确有 --apply(否则"预演档无写旗"是空话)')
})

test('P1 敏感性对照:同一个替身必须记到一次真 hash-object -w(记不到 ⇒ 尺子是瞎的)', () => {
  const dir = mkScratch('rn-color-canary-')
  const canary = join(dir, 'canary.mjs')
  // 金丝雀落在**临时夹具仓**里写对象,不碰本仓共享对象库(别席正在用它)。
  writeFileSync(
    canary,
    "import { execFileSync } from 'node:child_process'\n" +
      "const d = process.argv[2]\n" +
      "const so = { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }\n" +
      "execFileSync('git', ['init', '-q', d], so)\n" +
      "execFileSync('git', ['-C', d, 'hash-object', '-w', '--stdin'], { ...so, input: 'canary-here' })\n",
    'utf8',
  )
  const probe = runWithProbe([canary, dir], { cwd: dir })
  try {
    assert.equal(probe.rc, 0, `金丝雀自己就跑不起来(rc=${probe.rc}):${probe.stderr.slice(0, 200)}`)
    assert.ok(Array.isArray(probe.rows), `替身记录取不到:${probe.stderr.slice(0, 160)}`)
    const hit = probe.rows.filter((x) => x.kind === 'WRITE-git-hash-object-w')
    assert.ok(
      hit.length >= 1,
      `阳性对照失效:真派了一次 hash-object -w 而替身没记到 ⇒ "零写"读数无意义(记下:${probe.rows.map((r) => r.kind).join(',')})`,
    )
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('P2 行为锁:级联缺省档真跑 ⇒ 替身记到零条写动作,且记到读动作与器物自述只读档', () => {
  const run = runWithProbe([TOOL, ...PREVIEW_ARGV])
  assert.ok(Array.isArray(run.rows), `替身记录取不到 rc=${run.rc}:${run.stderr.slice(0, 200)}`)
  assert.equal(run.rc, 0, `预演档退出码非 0(rc=${run.rc}):${run.stderr.slice(0, 200)}`)
  // 先证"真派了 + 替身真在听":必须量到器物自己的只读 git 取材
  assert.ok(readsOf(run.rows).length >= 1, `一条 read-git-* 都没记到 ⇒ 替身没接上,"零写"不能读成零写(${run.rows.map((r) => r.kind).join(',')})`)
  // 器物自述:只读档 + 机读结论解得出(级联的正文探针吃的就是这一行)
  assert.match(run.stdout, /\{"summary":\{[^\n]*"face":"head"/, '缺省档必须真跑出机读结论')
  assert.match(run.stdout, /只读档\(未写盘\)/, '器物自述必须是只读档')
  const writes = writesOf(run.rows)
  assert.deepEqual(
    writes.map((w) => `${w.kind} → ${w.target}`),
    [],
    `预演档有 ${writes.length} 条写动作 ⇒ 级联缺省档不再是只读,必须改登记为 noPreview 或修器物`,
  )
})

test('P4 写盘档退出码契约:没活 ≠ 失败,真败(写失败/落账未成)才非 0', () => {
  // 立因(2026-11-05 实测):旧写法 `changed > 0 ? 0 : 1` 把"本轮 0 处可写"报成失败 ——
  // 守护每轮都记一次假失败,级联 --apply 也把该列判成 failed(落盘 0 枚 / held 2 ⇒ rc=1)。
  // 恒非 0 的自动腿与恒红门是同一件事(§12e)。三枚 land-* 的契约是 0 正常(含改 0 处)/
  // 1 verify 失败已回滚 / 2 用法错或取不到输入。本器按 applyExitCode 对齐,判据本体在此钉住。
  const f = COLOR.applyExitCode
  assert.equal(f({ changed: 0, failed: [], landingErr: '' }), 0, '没活 ⇒ 0(旧写法在这里退 1,就是那枚假失败)')
  assert.equal(f({ changed: 3, failed: [], landingErr: '' }), 0, '写了 3 枚且无失败 ⇒ 0')
  assert.equal(f({ changed: 2, failed: ['a.tsx:verify 失败'], landingErr: '' }), 1, '有文件写失败 ⇒ 1')
  assert.equal(f({ changed: 1, failed: [], landingErr: '账本不可写:EACCES' }), 1, '落账未成功 ⇒ 1,绝不冒成功')
  // 反向对照:把"没活"重新判成失败的同一条尺必须翻得出红(证明断言不是空转)
  assert.notEqual(f({ changed: 0, failed: [], landingErr: '' }), 1, '裁决被写坏了:没活仍被判失败')
  assert.equal(typeof f, 'function', 'applyExitCode 必须从器物 __test__ 出口取到(§22c 禁测试复制判据)')
})

test('P3 归属锁(静态):器物唯一的 hash-object -w 腿必须住在 --emit-blobs 分支内,且全器只此一处', () => {
  // 为什么不做"真跑一次写档"的反向对照:--emit-blobs 会往**共享对象库**灌十几枚孤儿 blob,
  // CI/守护每轮跑一次就是每轮涨一遍(§29 GC 归人工)。敏感性已由 P1 用替身动态证明,
  // 这一格只需要钉住"那唯一一处 -w 被 --emit-blobs 档管着"这个结构事实。
  const src = readFileSync(TOOL, 'utf8')
  const lines = src.split(/\r?\n/)
  const wLines = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /'hash-object'/.test(l) && /'-w'|'--write'/.test(l) && !/^\s*(\/\/|\*\/?)/.test(l))
  assert.equal(wLines.length, 1, `器物里 hash-object -w 的写形态应恰 1 处,现读 ${wLines.length} 处:${wLines.map((x) => x.i + 1).join(',')}`)
  const emit = lines.findIndex((l) => /'--emit-blobs'/.test(l))
  assert.ok(emit >= 0, '--emit-blobs 档标识取不到 ⇒ 归属判不出(未判定,不算绿)')
  assert.ok(
    wLines[0].i > emit,
    `-w 那行(${wLines[0].i + 1})排在 --emit-blobs 分支(${emit + 1})之前 ⇒ 它不在该档管辖内,零写身份不成立`,
  )
  // 成对反控:同一把尺喂给"只带 --json 的行"必须量到 0 处(证明数的确实是 -w 这个形态)
  const previewOnly = wLines.filter(({ l }) => /'--json'/.test(l))
  assert.deepEqual(previewOnly, [], '-w 那行不得同时带 --json(那等于说缺省档自己就写库)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
