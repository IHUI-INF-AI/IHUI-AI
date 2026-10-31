// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 276 的镜像测试 —— 判据一律 import 门体的 `__test__`,**不复制实现**。
 *
 * 为什么必须有镜像这一层(而不是只靠门体 `--self-test`):`--self-test` 住在门体里,
 * 门体的判据被误改时,自检用的还是被改过的那把尺子 —— 两份用例各自独立写一遍,
 * 改坏一处至少会在另一半红。test 用例里的样例串在 `*.test.*` 里,门自己扫到会走路径豁免,
 * 所以这里可以写明文,不必像门体那样拼接规避自指。
 *
 * 2026-10-31 追加「取材面纪律」一整节:`--all` 曾读磁盘、`--worktree` 曾不存在、未知旗曾被
 * 静默吞成 `--staged`,这三格都属于"判据函数没错、取的面错了"——只有把门当**子进程**派生、
 * 并在临时 git 仓里让 HEAD 与磁盘内容**故意不同**,才能把它钉住(用例数现读:`node --test` 末行)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ } from '../check-relay-queue-db-isolation.mjs'

const {
  extractBalanced,
  scanSource,
  pathExemptReason,
  parseArgv,
  normalizeBlobText,
  faceSpecOf,
  inScanScope,
} = __test__

const VICTIM = `const api = spawn(process.execPath, ['src/index.ts'], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: dsn, PORT: '8809' },
  stdio: 'ignore',
})
`

test('换库不换 Redis ⇒ 命中 1 条,且行号指向 DATABASE_URL 那一行', () => {
  const r = scanSource(VICTIM, { file: 'scripts/fixture.mjs' })
  assert.equal(r.rewritten, 1)
  assert.equal(r.violations.length, 1)
  assert.equal(r.skips.length, 0)
  assert.equal(r.violations[0].line, 3)
  assert.match(r.violations[0].reason, /relay-account-pool-queue/)
  assert.match(r.violations[0].fix, /RELAY_QUEUE_SUFFIX|REDIS_URL/)
})

test('同块换 REDIS_URL ⇒ 0 条(反例锁)', () => {
  const src = VICTIM.replace("DATABASE_URL: dsn", "DATABASE_URL: dsn, REDIS_URL: redisDsn")
  const r = scanSource(src, { file: 'scripts/fixture.mjs' })
  assert.equal(r.rewritten, 1)
  assert.equal(r.violations.length, 0)
})

test('同块设 RELAY_QUEUE_SUFFIX ⇒ 0 条', () => {
  const src = VICTIM.replace("DATABASE_URL: dsn", "DATABASE_URL: dsn, RELAY_QUEUE_SUFFIX: 'e2e'")
  const r = scanSource(src, { file: 'scripts/fixture.mjs' })
  assert.equal(r.violations.length, 0)
})

test('注释里的 REDIS_URL 不算隔离证据(否则一行注释就能洗绿)', () => {
  const src = `spawn(cmd, {
  // 记得换 REDIS_URL
  env: { DATABASE_URL: dsn },
})
`
  const r = scanSource(src, { file: 'scripts/fixture.mjs' })
  assert.equal(r.violations.length, 1)
})

test('process.env.DATABASE_URL = 直赋值形 ⇒ 命中', () => {
  const src = `function boot(dsn) {
  process.env.DATABASE_URL = dsn
  return startWorker()
}
`
  const r = scanSource(src, { file: 'scripts/fixture.mjs' })
  assert.equal(r.rewritten, 1)
  assert.equal(r.violations.length, 1)
  assert.equal(r.violations[0].line, 2)
})

test('READ_ONLY 豁免:记 skip 且不记 violation(不许静默吞)', () => {
  const src = `const r = execSync(cmd, { env: { ...process.env, DATABASE_URL: dsn /* READ_ONLY */ } })
`
  const r = scanSource(src, { file: 'scripts/fixture.mjs' })
  assert.equal(r.violations.length, 0)
  assert.equal(r.skips.length, 1)
  assert.match(r.skips[0].reason, /READ_ONLY/)
})

test('QUEUE_ISOLATION_EXEMPT 标记豁免:记 skip 且点名标记', () => {
  const src = `const r = execSync(cmd, {
  env: {
    ...process.env,
    DATABASE_URL: dsn, // QUEUE_ISOLATION_EXEMPT: 该进程不加载 relay worker
  },
})
`
  const r = scanSource(src, { file: 'scripts/fixture.mjs' })
  assert.equal(r.violations.length, 0)
  assert.equal(r.skips.length, 1)
  assert.match(r.skips[0].reason, /QUEUE_ISOLATION_EXEMPT/)
})

test('没有 env 块的文件 ⇒ NOT_APPLICABLE(rewritten=0,不记绿也不记红)', () => {
  const r = scanSource('const dsn = process.env.DATABASE_URL\nconsole.log(dsn)\n', { file: 'scripts/x.mjs' })
  assert.equal(r.rewritten, 0)
  assert.equal(r.violations.length, 0)
  assert.equal(r.skips.length, 0)
})

test('路径豁免:apps/api/tests/ 与 *.test.* 各记 1 条 skip', () => {
  assert.match(String(pathExemptReason('apps/api/tests/e2e/stack.ts')), /apps\/api\/tests/)
  assert.match(String(pathExemptReason('scripts/tests/foo.test.mjs')), /test/)
  const a = scanSource(VICTIM, { file: 'apps/api/tests/e2e/stack.ts' })
  const b = scanSource(VICTIM, { file: 'scripts/tests/foo.test.mjs' })
  assert.equal(a.violations.length, 0)
  assert.equal(a.skips.length, 1)
  assert.equal(b.violations.length, 0)
  assert.equal(b.skips.length, 1)
})

test('extractBalanced:嵌套对象', () => {
  const src = 'env: { a: { b: { c: 1 } }, d: 2 }, tail'
  assert.equal(extractBalanced(src, src.indexOf('{')), '{ a: { b: { c: 1 } }, d: 2 }')
})

test('extractBalanced:字符串里含 } 不提前收口', () => {
  assert.equal(extractBalanced(`{ k: '}', j: "a}b", m: 1 } rest`, 0), `{ k: '}', j: "a}b", m: 1 }`)
})

test('extractBalanced:模板串(含 ${} 插值)', () => {
  assert.equal(extractBalanced('{ k: `x${y.z}` , m: `a}b` } tail', 0), '{ k: `x${y.z}` , m: `a}b` }')
})

test('extractBalanced:配不平返回 null,不猜', () => {
  assert.equal(extractBalanced('{ a: 1', 0), null)
  assert.equal(extractBalanced('no brace here', 0), null)
})

// ─── 取材面纪律(AGENTS §0.4)──────────────────────────────────────────────────
//
// 2026-10-31 补这一整节的原因:门体的 `--all` 读的其实是**磁盘**,`--worktree` 根本不存在,
// 未知旗被静默吞成 `--staged` —— 三格都只有"跑一遍真仓"才看得见,而真仓这一轮跑绿了也证明
// 不了另一轮跑的是哪个面。所以现场必须是**临时 git 仓 + HEAD 与磁盘内容不同**,并把门当子进程
// 派生(import 进门内只证明判据函数,证明不了面)。夹具落 scratch(§15b/§15c:不在工作树造嵌套仓)。

const SCRIPT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-relay-queue-db-isolation.mjs')

/** 违规样例:换了库没换队列 ⇒ 门应判红。 */
const BAD_BODY = `const api = spawn(process.execPath, ['src/index.ts'], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: dsn, PORT: '8809' },
  stdio: 'ignore',
})
`

/** 已隔离样例:同块换了 Redis ⇒ 门应判绿。 */
const GOOD_BODY = `const api = spawn(process.execPath, ['src/index.ts'], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: dsn, REDIS_URL: redisDsn, PORT: '8809' },
  stdio: 'ignore',
})
`

function gitIn(root, args) {
  const r = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'safe.directory=*', ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr}`)
  return r.stdout
}

/** 真 git 临时仓:门要判的就是真 git 面,构造面只能证明判据、证明不了取材。 */
function makeRepo(prefix) {
  const root = mkScratch(prefix)
  gitIn(root, ['init', '--quiet', '--initial-branch=main'])
  gitIn(root, ['config', 'user.email', 'gate276@example.invalid'])
  gitIn(root, ['config', 'user.name', 'gate276'])
  mkdirSync(join(root, 'scripts'), { recursive: true })
  return root
}

function putVictim(root, body) {
  writeFileSync(join(root, 'scripts', 'victim.mjs'), body)
}

function commitAll(root, message) {
  gitIn(root, ['add', '-A'])
  gitIn(root, ['commit', '--quiet', '-m', message])
}

/** 把门当子进程派生(带 --root 换仓),返回带 all 文本的结果。 */
function runGate(args, cwd) {
  const r = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 << 20,
    timeout: 180000,
  })
  r.all = `${r.stdout ?? ''}\n${r.stderr ?? ''}`
  return r
}

const ESC = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('全量档(--all)判 HEAD blob:HEAD 脏 + 磁盘已改好 ⇒ 仍判红(旧实现读磁盘就是假绿)', () => {
  const root = makeRepo('gate276-head-')
  try {
    putVictim(root, BAD_BODY)
    commitAll(root, 'gate276 夹具:HEAD 里躺着未隔离的换库启动器')
    putVictim(root, GOOD_BODY) // 只改磁盘、不提交 —— 这一格正是"盘上随后改对"的诱饵

    const all = runGate(['--all', '--root', root], root)
    assert.equal(all.status, 1, `HEAD 面应判红,实得:${all.all}`)
    assert.match(all.stdout, /扫描面 --all · 正文取自 HEAD blob/)
    assert.match(all.stdout, /scripts\/victim\.mjs/)

    // 同一份夹具换逃生舱档:读的是磁盘那份"已经改好"的字节 ⇒ 0 违规 ——
    // 两面结论不同,恰恰证明清单与内容各取各的面(结论相同才是混面)。
    const wt = runGate(['--worktree', '--root', root], root)
    assert.equal(wt.status, 0, `磁盘面应判绿,实得:${wt.all}`)
    assert.match(wt.stdout, /扫描面 --worktree · 正文取自 工作树\(磁盘\)/)
    assert.match(wt.stdout, /violations: 0/)
  } finally {
    rmScratch(root)
  }
})

test('提交档(--staged)判索引 blob:索引脏 + 磁盘干净 ⇒ 仍判红(盘上随后改对不算修好)', () => {
  const root = makeRepo('gate276-staged-')
  try {
    putVictim(root, GOOD_BODY)
    commitAll(root, 'gate276 夹具:HEAD 干净')
    putVictim(root, BAD_BODY)
    gitIn(root, ['add', '-A']) // 索引 = 脏
    putVictim(root, GOOD_BODY) // 磁盘 = 干净(随后改对的诱饵)

    const staged = runGate(['--staged', '--root', root], root)
    assert.equal(staged.status, 1, `索引面应判红,实得:${staged.all}`)
    assert.match(staged.stdout, /扫描面 --staged · 正文取自 索引 blob/)

    const wt = runGate(['--worktree', '--root', root], root)
    assert.equal(wt.status, 0, `磁盘面应判绿,实得:${wt.all}`)
  } finally {
    rmScratch(root)
  }
})

test('含 NUL 的候选按不可读处理:本轮一个正文都没读到 ⇒ 未判定 exit 2,不冒充绿', () => {
  const root = makeRepo('gate276-nul-')
  try {
    // 违规样例被 NUL 切开:字节读得出、正文读不出 ⇒ 必须落在不可读那一档
    writeFileSync(
      join(root, 'scripts', 'nul-binary.mjs'),
      Buffer.concat([Buffer.from(BAD_BODY, 'utf8'), Buffer.from([0x00]), Buffer.from(BAD_BODY, 'utf8')]),
    )
    commitAll(root, 'gate276 夹具:唯一候选带 NUL')

    const all = runGate(['--all', '--root', root], root)
    assert.equal(all.status, 2, `应落未判定,实得:${all.all}`)
    assert.match(all.all, /unreadable=1/)
    assert.match(all.all, /本轮候选一个正文都没读到/)
    // 反向锁:不得把"没读到"报成结论行 `violations: 0` / NOT_APPLICABLE 那一类绿
    // (行首锚定:门自己的"未判定"文案里会引用那句绿话作为反例,逐字匹配会打到自己)
    assert.doesNotMatch(all.all, /^violations: 0$/m)
    assert.doesNotMatch(all.all, /^NOT_APPLICABLE/m)
  } finally {
    rmScratch(root)
  }
})

test('未知旗 ⇒ exit 2 并点名(旧实现静默落进索引档,抬头照打 --staged)', () => {
  const root = makeRepo('gate276-flag-')
  try {
    putVictim(root, GOOD_BODY)
    commitAll(root, 'gate276 夹具:旗标用法错的现场')
    for (const bad of ['--nope', '--workttee', '--staged=all']) {
      const r = runGate([bad, '--root', root], root)
      assert.equal(r.status, 2, `${bad} 应 exit 2,实得:${r.all}`)
      assert.match(r.stderr, /未知旗标/)
      assert.match(r.stderr, new RegExp(ESC(bad)))
    }
    const pure = parseArgv(['--nope'])
    assert.equal(pure.errors.length, 1)
    assert.match(pure.errors[0], /--nope/)
  } finally {
    rmScratch(root)
  }
})

test('面旗两枚同给 ⇒ exit 2 且逐枚点名(§0.4:两面旗同给)', () => {
  const root = makeRepo('gate276-two-')
  try {
    putVictim(root, GOOD_BODY)
    commitAll(root, 'gate276 夹具:面旗同给')
    for (const pair of [
      ['--all', '--worktree'],
      ['--staged', '--all'],
      ['--worktree', '--files', 'scripts/victim.mjs'],
    ]) {
      const r = runGate([...pair, '--root', root], root)
      assert.equal(r.status, 2, `${pair.join(' ')} 应 exit 2,实得:${r.all}`)
      assert.match(r.stderr, /面旗同给/)
      assert.match(r.stderr, new RegExp(ESC(pair[0])))
      assert.match(r.stderr, new RegExp(ESC(pair[1])))
    }
  } finally {
    rmScratch(root)
  }
})

test('--root 用法错与指向非仓库根 ⇒ 未判定(不得静默回落默认根、不得混基准)', () => {
  const root = makeRepo('gate276-root-')
  try {
    putVictim(root, GOOD_BODY)
    commitAll(root, 'gate276 夹具:--root 现场')

    const noValue = runGate(['--all', '--root'], root)
    assert.equal(noValue.status, 2, `--root 无值应 exit 2,实得:${noValue.all}`)
    assert.match(noValue.stderr, /--root 需要一个目录参数/)

    const sub = join(root, 'scripts') // 仓的子目录:基准会错位 ⇒ 必须停手
    const wrong = runGate(['--all', '--root', sub], root)
    assert.equal(wrong.status, 2, `--root 指子目录应 exit 2,实得:${wrong.all}`)
    assert.match(wrong.stderr, /未判定:--root/)
  } finally {
    rmScratch(root)
  }
})

test('默认档(不给面旗)= HEAD 全量档;--files 点名读磁盘', () => {
  const bare = parseArgv([])
  assert.equal(bare.errors.length, 0)
  assert.equal(bare.face, 'head')
  const parsed = parseArgv(['--files', 'a.mjs', 'b\\c.ts'])
  assert.equal(parsed.face, 'files')
  assert.deepEqual(parsed.files, ['a.mjs', 'b/c.ts'])

  const root = makeRepo('gate276-default-')
  try {
    putVictim(root, BAD_BODY)
    commitAll(root, 'gate276 夹具:默认档')
    const r = runGate(['--root', root], root)
    assert.equal(r.status, 1, `默认档应判 HEAD 面,实得:${r.all}`)
    assert.match(r.stdout, /扫描面 --all\(默认\) · 正文取自 HEAD blob/)

    const pointed = runGate(['--files', 'scripts/victim.mjs', '--root', root], root)
    assert.equal(pointed.status, 1, `--files 应读到磁盘那份违规样例,实得:${pointed.all}`)
    assert.match(pointed.stdout, /正文取自 工作树\(磁盘\)/)
  } finally {
    rmScratch(root)
  }
})

test('纯函数面:NUL/空值判不可读、规格形状、启动器目录形状(判据只在门体一份,不在此复算)', () => {
  assert.equal(normalizeBlobText('ok\n'), 'ok\n')
  assert.equal(normalizeBlobText(null), null)
  assert.equal(normalizeBlobText(undefined), null)
  assert.equal(normalizeBlobText('a\u0000b'), null)
  assert.equal(faceSpecOf('head', 'scripts/a.mjs'), 'HEAD:scripts/a.mjs')
  assert.equal(faceSpecOf('staged', 'scripts/a.mjs'), ':scripts/a.mjs')
  assert.throws(() => faceSpecOf('worktree', 'scripts/a.mjs'))
  assert.equal(inScanScope('apps/desktop/scripts/boot.mjs'), true)
  assert.equal(inScanScope('scripts/boot.mjs'), true)
  assert.equal(inScanScope('docs/boot.mjs'), false)
  assert.equal(inScanScope('packages/shared/src/x.ts'), false)
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
