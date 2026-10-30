// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * union-converge 旗标闸镜像测试（RP-79 剩余面, 2026-10-31）。
 *
 * 判据一律 import 源文件那两份出口（`scripts/lib/union-converge-flags.mjs` 的清单/闸本体,
 * `scripts/data/union-converge-flags.json` 的出处投影）—— 本文件零复算、不抄第二份清单（§22c）。
 *
 * 为什么这枚测试必须先立再谈"装闸"（票面原话）:本器的旗面按 `argv.includes/indexOf/has/getFlag`
 * 四形态扫只得 7 枚,而按 `scanFlagConsumption` 现读是 17 枚 —— 给清单不全的器装闸,失效方向会翻成
 * **把同步链的正当动作拦停**（`git-sync-converge` 每轮都转发 `--apply/--theirs/--accept-state-growth`
 * 与六条声明旗）。所以本文件的第一枚用例不是"闸有没有拦",而是"清单有没有扫全"。
 *
 * 两向都要证:已知旗放行（且真的走到它们自己的取值校验）、未知旗 rc=2 且**零副作用**。
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const CLI_REAL = join(REPO, 'scripts', 'union-converge.mjs')
const LIB = join(REPO, 'scripts', 'lib', 'union-converge-flags.mjs')
const REGISTRY = join(REPO, 'scripts', 'data', 'union-converge-flags.json')
const SYNC = join(REPO, 'scripts', 'git-sync-converge.mjs')

const {
  UNION_BOOLEAN_FLAGS,
  UNION_VALUE_FLAGS,
  UNION_KNOWN_FLAGS,
  DECLARATION_FLAGS,
  SYNC_FORWARDED_FLAGS,
  scanFlagConsumption,
  judgeFlags,
  unknownFlagEscape,
  UNKNOWN_FLAG_ESCAPE_ENV,
  USAGE,
} = await import(pathToFileURL(LIB).href)

/**
 * 变异探针缝:默认永远打真器;只许指向 scratch 夹具里的一份**被摘掉闸的副本**
 * （探针要证"摘闸 ⇒ 本文件的用例翻红",又不许改动共享工作区里那枚真文件）。
 */
const CLI = (() => {
  const override = process.env.RP79_UNION_CONVERGE_CLI
  if (!override) return CLI_REAL
  if (!resolve(override).includes('ihui-scratch')) {
    throw new Error('RP79_UNION_CONVERGE_CLI 只许指向 scratch 夹具(ihui-scratch)里的副本,不得指向仓内任何文件')
  }
  return resolve(override)
})()

const wrap = (arr) => ['node', CLI, ...arr]
const unionSrc = () => readFileSync(CLI_REAL, 'utf8')
const syncSrc = () => readFileSync(SYNC, 'utf8')

const gitIn = (cwd, args) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    // §12g:本机派生 git 必须显式 stdio(不吃 stdout 也要给管道),否则 EBUSY。
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()

const runCli = (cwd, args) =>
  spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    windowsHide: true,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  })

const out = (r) => `${r.stderr || ''}${r.stdout || ''}`

test('① 清单扫全:源码实际消费的每一枚旗都在清单里,且清单里没有一枚是"幽灵"(两向闭合)', () => {
  const scanned = scanFlagConsumption(unionSrc())
  assert.ok(scanned.size >= 15, `消费点扫描只认出 ${scanned.size} 枚 —— 少于 RP-79 现读的 17 枚,扫描器或本器形状变了`)
  const consumedNotListed = [...scanned].filter((f) => !UNION_KNOWN_FLAGS.includes(f)).sort()
  assert.deepEqual(
    consumedNotListed,
    [],
    `这些旗被本器消费却不在清单里 ⇒ 装闸后正当用法会被自己拦死:${consumedNotListed.join(' ')}`,
  )
  const listedNotConsumed = UNION_KNOWN_FLAGS.filter((f) => !scanned.includes(f)).sort()
  assert.deepEqual(listedNotConsumed, [], `清单里这些旗在源码里找不到消费点(清单腐烂):${listedNotConsumed.join(' ')}`)
  assert.deepEqual(
    [...UNION_KNOWN_FLAGS].sort(),
    [...UNION_BOOLEAN_FLAGS, ...UNION_VALUE_FLAGS].sort(),
    'KNOWN 必须恰等于 动作档 ∪ 带值档(两份各自演进 ⇒ 要么拦死正当用法,要么放过未知旗)',
  )
})

test('② 清单与 USAGE 成套(双向形状锁):印了就要认识,认识就要印得出来', () => {
  const usageText = USAGE.join('\n')
  const printed = new Set(usageText.match(/--[a-z][a-z0-9-]*/g) || [])
  for (const f of UNION_KNOWN_FLAGS) {
    assert.ok(printed.has(f), `清单里有 ${f} 而 USAGE 没印 ⇒ 文档写了跑不通的出路(§0.8)`)
  }
  for (const f of printed) {
    assert.ok(
      UNION_KNOWN_FLAGS.includes(f) || f === '--help',
      `USAGE 里印了 ${f} 而清单不认识 ⇒ 文档承诺了一个不存在的动作(§0.8)`,
    )
  }
  assert.match(usageText, /退出码:[\s\S]*2 = 用法错/, 'USAGE 必须写明未知旗落 2,而不是让它变成 1(业务失败)')
})

test('③ 转发面:同步链真正推给本器的旗子集 ⊆ 清单(漏一枚 = 每轮自动收敛死在闸上)', () => {
  const outside = SYNC_FORWARDED_FLAGS.filter((f) => !UNION_KNOWN_FLAGS.includes(f))
  assert.deepEqual(outside, [], `git-sync-converge 会转发却不认识:${outside.join(' ')}`)
  for (const d of DECLARATION_FLAGS) {
    assert.ok(SYNC_FORWARDED_FLAGS.includes(d), `声明旗 ${d} 是同步链的透传面,必须登记在转发族里`)
  }
  // 形状锁的第二半:直接读 git-sync-converge 的派生块,把它写死的旗号原文与清单对账
  // （只信 SYNC_FORWARDED_FLAGS 那份手写表是不够的 —— 它自己也会漂)。
  const src = syncSrc()
  const start = src.indexOf("const args = ['scripts/union-converge.mjs'")
  assert.ok(start > 0, 'git-sync-converge 的 union 派生块锚点没找到 ⇒ 本用例失去意义,不得记绿')
  const end = src.indexOf('execFileSync(process.execPath, args', start)
  assert.ok(end > start, '同块尾部锚点没找到')
  const block = src.slice(start, end)
  const literal = new Set(block.match(/'(--[a-z][a-z0-9-]+)'/g)?.map((s) => s.replaceAll("'", '')) ?? [])
  assert.ok(literal.size >= 2, `派生块里一枚旗都没抽到(${block.length} 字节)⇒ 锚点腐烂,不许假绿`)
  const bad = [...literal].filter((f) => !UNION_KNOWN_FLAGS.includes(f))
  assert.deepEqual(bad, [], `同步链派生块里写死却不认识的旗:${bad.join(' ')}`)
  // 正向对照:本票点名的三枚必须真在这块里(抽到的是不是那一段,而不是空转)
  for (const f of ['--apply', '--theirs', '--accept-state-growth']) {
    assert.ok(literal.has(f) || block.includes(f), `派生块里没看到 ${f} ⇒ 切片位置不对,本用例没在判转发面`)
  }
})

test('④ 闸不误杀:清单逐条 + 带值形 + 等号形 + 同步链的真实调用串全部判 ok', () => {
  assert.equal(judgeFlags(wrap([])).verdict, 'ok', '空 argv 走默认档是合法用法')
  for (const f of UNION_BOOLEAN_FLAGS) {
    assert.equal(judgeFlags(wrap([f])).verdict, 'ok', `动作档 ${f} 必须被认识`)
  }
  for (const f of UNION_VALUE_FLAGS) {
    assert.equal(judgeFlags(wrap([f, 'x'])).verdict, 'ok', `带值档 ${f} 必须被认识且吃掉其值`)
    assert.equal(judgeFlags(wrap([`${f}=x`])).verdict, 'ok', `${f}=value 等号形必须被认识`)
  }
  assert.equal(judgeFlags(wrap(['-h'])).verdict, 'ok', '-h 是 --help 的短形,必须放行')
  const real = [
    '--apply',
    '--theirs',
    '0123456789abcdef0123456789abcdef01234567',
    '--accept-state-growth',
    'forks=两台机器各登记一次同一件事,并集天然成对',
    '--accept-state-growth',
    'dupOpenCopies=同一件事两侧各写一条待办',
    '--take-theirs-doc',
    'AGENTS.md',
    '--show-all-bad',
  ]
  const v = judgeFlags(wrap(real))
  assert.equal(v.verdict, 'ok', `同步链真实调用串被判成 ${v.verdict}(${v.flag})⇒ 正当动作被拦停`)
})

test('⑤ 未知旗必须被点名(近似旗最容易静默掉进默认档),且缺值不当未知旗', () => {
  assert.deepEqual(
    [judgeFlags(wrap(['--helpz'])).verdict, judgeFlags(wrap(['--helpz'])).flag],
    ['unknown', '--helpz'],
  )
  assert.equal(judgeFlags(wrap(['--delete-everything'])).flag, '--delete-everything')
  assert.equal(judgeFlags(wrap(['--apply', '--nope'])).flag, '--nope', '合法旗之后的未知旗也必须抓到')
  assert.equal(judgeFlags(wrap(['--theirs', '--nope'])).flag, '--nope', '带值旗的下一个旗号不得被当成值吞掉')
  assert.equal(judgeFlags(wrap(['--theirs'])).verdict, 'ok', '缺值是"值没给"的用法错出口,不是未知旗')
})

test('⑥ 未判定三态:闸拿不到输入时既不冒绿也不冒红(§0.3)', () => {
  const noArgv = judgeFlags(null)
  assert.equal(noArgv.verdict, 'undetermined')
  assert.ok(noArgv.reason.length > 0, '未判定必须点名原因,不许空口径')
  const emptyList = judgeFlags(['node', 'x'], { known: [] })
  assert.equal(emptyList.verdict, 'undetermined', '清单读不到时放行 = 瞎放行,拦停 = 拿整条同步链押在一份空表上')
})

test('⑦ 放行出路纪律:必须"验过才免"(enable=1 ∧ 理由 ≥10 字),缺一半/过短一律不放行', () => {
  const { enable, reason, minReasonLength } = UNKNOWN_FLAG_ESCAPE_ENV
  assert.equal(unknownFlagEscape({}).allowed, false, '什么都没设 ⇒ 不放行')
  assert.equal(unknownFlagEscape({ [enable]: '1' }).allowed, false, '设了开关却没理由 ⇒ 空理由的放行等于没有判据')
  assert.equal(
    unknownFlagEscape({ [enable]: '1', [reason]: '  ' }).allowed,
    false,
    '只给空格不算理由',
  )
  assert.equal(
    unknownFlagEscape({ [enable]: '1', [reason]: '太短' }).allowed,
    false,
    `理由不足 ${minReasonLength} 字不得放行`,
  )
  const ok = unknownFlagEscape({ [enable]: '1', [reason]: '同步链新增了一枚我还没登记的转发旗,先放本轮' })
  assert.equal(ok.allowed, true)
  assert.ok(ok.reason.length >= minReasonLength, '放行时必须把理由回带,供调用方逐条打印(不许静默放行)')
})

test('⑧ 出处投影锁:scripts/data/union-converge-flags.json 与清单集合逐枚等值,且每条都有 flag/where/why', () => {
  const reg = JSON.parse(readFileSync(REGISTRY, 'utf8'))
  assert.ok(Array.isArray(reg.flags) && reg.flags.length > 0, '投影表为空 ⇒ 这份"权威清单"不成立')
  const listed = reg.flags.map((x) => x.flag).sort()
  assert.deepEqual(listed, [...UNION_KNOWN_FLAGS].sort(), '投影与 lib 清单不一致(表多一枚=承诺了不存在的旗;表少一枚=漏登记)')
  assert.equal(new Set(listed).size, listed.length, '投影里有重复条目')
  for (const item of reg.flags) {
    for (const key of ['flag', 'kind', 'where']) {
      assert.ok(String(item[key] ?? '').length > 0, `${item.flag} 缺 ${key}`)
    }
    assert.ok(
      Array.isArray(item.where) ? item.where.length > 0 : String(item.where).length > 0,
      `${item.flag} 缺出处`,
    )
    assert.ok(String(item.why ?? '').length >= 8, `${item.flag} 的 why 太短,读的人判不出它为什么存在`)
    assert.ok(['boolean', 'value'].includes(item.kind), `${item.flag} 的 kind 只允许 boolean/value`)
    const wantKind = UNION_BOOLEAN_FLAGS.includes(item.flag) ? 'boolean' : 'value'
    assert.equal(item.kind, wantKind, `${item.flag} 的 kind 与 lib 的档位不一致`)
    for (const fwd of item.forwardedBy ?? []) {
      assert.ok(UNION_KNOWN_FLAGS.includes(fwd), `${item.flag} 的 forwardedBy 指向不存在的旗 ${fwd}`)
    }
  }
  assert.equal(reg.dynamicForwarding?.wholeArgvPassthrough, false, '静态清单成立的前提是"没有整段 argv 透传";若哪天有了,本票的结论必须重判')
})

test('⑨ 未知旗 CLI:rc=2、点名、零副作用(HEAD 与索引逐字节不变)', () => {
  const headBefore = gitIn(REPO, ['rev-parse', 'HEAD'])
  const idxBefore = gitIn(REPO, ['status', '--porcelain'])
  const dir = mkScratch('union-flag-gate')
  try {
    gitIn(dir, ['init', '-q', '-b', 'main'])
    gitIn(dir, ['config', 'user.email', 'guard@example.invalid'])
    gitIn(dir, ['config', 'user.name', 'guard'])
    writeFileSync(join(dir, 'a.txt'), 'one\n', 'utf8')
    gitIn(dir, ['add', 'a.txt'])
    gitIn(dir, ['commit', '-q', '-m', 'seed'])
    const fxHead = gitIn(dir, ['rev-parse', 'HEAD'])
    const fxIdx = gitIn(dir, ['ls-files', '-s'])

    const r = runCli(dir, ['--definitely-not-a-flag'])
    assert.equal(r.status, 2, `未知旗必须 rc=2(实得 ${r.status});输出:${out(r).slice(0, 200)}`)
    assert.match(out(r), /未认识|用法错/, '必须点名是用法错,不许裸栈或静默')
    assert.match(out(r), /--definitely-not-a-flag/, '必须点名是哪一枚旗')
    assert.match(out(r), /用法:/, '用法错必须给出用法(唯一出路不许跑不通)')
    assert.doesNotMatch(out(r), /\[union-converge\]|第 \d\/\d 轮|索引层合并/, '未知旗这一趟绝不许开跑收敛')

    assert.equal(gitIn(REPO, ['rev-parse', 'HEAD']), headBefore, '零副作用:真仓 HEAD 不许动')
    assert.equal(gitIn(REPO, ['status', '--porcelain']), idxBefore, '零副作用:真仓索引/工作区不许动')
    assert.equal(gitIn(dir, ['rev-parse', 'HEAD']), fxHead, '夹具仓 HEAD 不许动')
    assert.equal(gitIn(dir, ['ls-files', '-s']), fxIdx, '夹具仓索引 sha 不许动')
  } finally {
    rmScratch(dir)
  }
})

test('⑩ --help 是纯查询:rc=0、印用法、不动仓里任何东西', () => {
  const headBefore = gitIn(REPO, ['rev-parse', 'HEAD'])
  const dir = mkScratch('union-flag-help')
  try {
    const r = runCli(dir, ['--help'])
    assert.equal(r.status, 0, `--help 必须 rc=0(实得 ${r.status});输出:${out(r).slice(0, 200)}`)
    assert.match(r.stdout, /用法:/, '--help 必须打印用法')
    assert.doesNotMatch(out(r), /\[union-converge\]/, '--help 绝不允许开跑收敛')
    assert.equal(gitIn(REPO, ['rev-parse', 'HEAD']), headBefore, '--help 不得推进 HEAD')
  } finally {
    rmScratch(dir)
  }
})

test('⑪ 装车锁:闸排在 main 的一切动作之前,且清单/闸体全仓只有一份', () => {
  const src = unionSrc()
  const iGate = src.indexOf('judgeFlags(process.argv)')
  assert.ok(iGate > 0, 'main 里没接闸 ⇒ 清单只是注释(§0.9 造好没装车 = 没有)')
  for (const [name, needle] of [
    ['--self-test', "argv.includes('--self-test')"],
    ['--help', "argv.includes('--help')"],
    ['--theirs', "requireFlagValue(argv, '--theirs'"],
    ['--apply', "argv.includes('--apply')"],
  ]) {
    const i = src.indexOf(needle)
    assert.ok(i > 0, `找不到 ${name} 的消费点 ⇒ 本用例锚点腐烂`)
    assert.ok(iGate < i, `闸必须排在 ${name} 之前(先跑了再报用法错 = 副作用已经发生)`)
  }
  assert.equal([...src.matchAll(/judgeFlags\(process\.argv\)/g)].length, 1, '闸只许接一次')
  assert.equal(
    [...src.matchAll(/from '\.\/lib\/union-converge-flags\.mjs'/g)].length,
    1,
    '清单出口只许 import 一次',
  )
  assert.equal([...src.matchAll(/export const (KNOWN_FLAGS|UNION_KNOWN_FLAGS)\b/g)].length, 0, '旗清单不得在本器再立第二份')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
