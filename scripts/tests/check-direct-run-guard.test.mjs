// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-direct-run-guard.mjs`(台账 G-1058651)。
 *
 * 判据一律 **import 门体导出的 `__test__`**,测试里不得再抄一份(§22c:镜像只复读实现就是复读机)。
 * 本文件因此同时是这道门**能不能被 import** 的阳性证明 —— 门体若有裸顶层 `main()`,
 * 这条 import 就会把 CLI 主流程一起拖进测试进程(T0 专门钉这一格,并拿独立子进程复验)。
 *
 * 锁清单:
 *  T0 import 门体不得触发 CLI(§22d 的立身之本,也是这道门存在的理由);
 *  T1 方向锁 —— 读 **HEAD 面** 的 runner(不读磁盘):查不到本门就判"未接线";
 *     注册之后必须读到 **blocking + skipEnv 成套**(缺 skipEnv 的 blocking 门 = 逼人 --no-verify);
 *  T2/T3 三形态守卫并集 + "守卫只写在注释/字符串里不得放过";
 *  T4 `if` 块内的顶层 main() 不算违规;
 *  T5 真实文件锚点(§22c 红线):从 HEAD 现读一枚真违规 blob 复判,不许全用自造夹具;
 *  T6 棘轮成对(存量不判红 / 新增必判红)与台账三红(缺字段·过期·腐烂);
 *  T7 空枚举判死 + 两面旗同给 exit 2 + 取不到面 exit 2(CLI 级,真退出码);
 *  T8 **真 git 临时仓端到端**:裸 main() 进门 ⇒ `--staged` 红;补守卫 ⇒ 绿;
 *     守卫只写进注释 ⇒ 仍红(证明遮罩有牙);同一违规已入库 ⇒ 绿(证明锚点在自己身上)。
 *
 * 派生一律 `stdio:['ignore','pipe','pipe']` + `windowsHide: true`(§12g:本机宿主下不给 stdio
 * 就报 spawnSync EBUSY,而那是环境问题不是业务结论)。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch, gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-direct-run-guard.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-direct-run-guard.mjs')
const SELF = 'check-direct-run-guard.mjs'
const ANSI_RE = /\x1b\[[0-9;]*m/g

function clean(s) {
  return String(s ?? '').replace(ANSI_RE, '')
}

function runGate(args, cwd = REPO) {
  const r = spawnSync(process.execPath, [GATE, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 600_000,
    maxBuffer: 1 << 27,
  })
  return { rc: r.status, out: clean(r.stdout), err: clean(r.stderr), all: clean(r.stdout) + clean(r.stderr) }
}

function runGateJson(args, cwd = REPO) {
  const r = runGate([...args, '--json'], cwd)
  let json = null
  try {
    json = JSON.parse(r.out)
  } catch {
    json = null
  }
  return { ...r, json }
}

function gitIn(root, args) {
  const r = spawnSync(gitBinary(), ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    maxBuffer: 1 << 26,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${clean(r.stderr)}`)
  return String(r.stdout ?? '')
}

/** 临时 git 仓夹具:scratch 落点由共用层保证(仓树外、与仓同盘、无二阶嵌套)。 */
function createRepo() {
  const root = mkScratch('ihui-direct-run-guard-')
  gitIn(root, ['init', '--quiet'])
  gitIn(root, ['config', 'user.email', 'gate-test@example.invalid'])
  gitIn(root, ['config', 'user.name', 'gate-test'])
  return root
}

function putFile(root, rel, text, { add = true } = {}) {
  const abs = join(root, ...rel.split('/'))
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
  if (add) gitIn(root, ['add', '--', rel])
}

const BARE_BODY = `#!/usr/bin/env node
// 一枚故意没有入口守卫的门体:测试一 import 就会跑掉整个 CLI。
async function main() {
  console.log('CLI 主流程跑了数十行')
  process.exit(1)
}
main()
`
const GUARDED_BODY = `#!/usr/bin/env node
import { pathToFileURL } from 'node:url'

async function main() {
  console.log('CLI 主流程')
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch(() => process.exit(2))
}

export const __test__ = { main }
`
const FAKE_GUARD_BODY = `#!/usr/bin/env node
// const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
/* if (fileURLToPath(import.meta.url) === process.argv[1]) { main() } */
async function main() {
  process.exit(1)
}
main()
`

test('T0 import 门体不得触发 CLI 主流程(§22d 的立身之本 —— 本门存在的理由)', () => {
  // 本文件顶部那句 import 就是证明;但"没炸"不能靠本文件自己没炸来断言,
  // 所以再拿一个**独立子进程** import 门体并打一条哨兵:stdout 里出现门的读数行 ⇒ 守卫被摘。
  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(GATE).href)});console.log('__IMPORTED__')`],
    { cwd: REPO, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
  )
  const out = clean(r.stdout)
  assert.match(out, /__IMPORTED__/, `import 门体失败:${out}${clean(r.stderr)}`)
  assert.doesNotMatch(out, /\[direct-run-guard\]/, 'import 门体就打印了门的读数 ⇒ 顶层裸 main() 回来了,§22c 的通道又断了')
})

test('T1 方向锁:runner 取 HEAD 面;未注册 ⇒ 判"未接线",注册后必须 blocking + skipEnv 成套', () => {
  const raw = catBatch(REPO, [`HEAD:scripts/guardian-runner.mjs`]).get('HEAD:scripts/guardian-runner.mjs')
  assert.equal(typeof raw, 'string', 'runner 的 HEAD blob 取不到 ⇒ 无法判定(不回落磁盘那一面)')
  const w = gate.wiringState(raw, SELF)
  const doc = gate.wiringState('', SELF)
  assert.equal(doc.wired, false, 'runner 里没有本门时不得读出 wired=true')
  // 这条断言写的是**规则**而不是当下状态,所以它注册前后都得成立:
  const complete = gate.wiringState(
    `  {\n    id: '194',\n    script: '${SELF}',\n    mode: 'blocking',\n    skipEnv: 'HUSKY_SKIP_DIRECT_RUN_GUARD',\n    stagedTriggers: ['scripts/'],\n  },`,
    SELF,
  )
  assert.equal(complete.wired, true)
  assert.deepEqual(complete.missing, [], 'blocking + skipEnv 成套的注册块不该被判成不完整')
  const broken = gate.wiringState(`  {\n    id: '194',\n    script: '${SELF}',\n    mode: 'blocking',\n  },`, SELF)
  assert.deepEqual(broken.missing, ['skipEnv 缺失'], 'blocking 门没有自己的紧急出口 ⇒ 必须点名')
  if (!w.wired) {
    // 当下(本枚不注册)的正确读数:未接线。摘线时这一格会把"已接入提交链"的说法当场拦下。
    assert.match(w.reason || '', /未接线/, JSON.stringify(w))
  } else {
    assert.deepEqual(w.missing, [], `已注册却不成套:${JSON.stringify(w)}`)
    assert.equal(w.triggers, true, '已注册却没有 stagedTriggers ⇒ 每次提交都全量跑,与本次改动无关')
  }
})

test('T2 测试不得重写判据(必须走门体导出的 __test__)', () => {
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.match(
    src,
    /import \{ __test__ as gate \} from '\.\.\/check-direct-run-guard\.mjs'/,
    '§22c 锚点:测试必须 import 门体导出的判据',
  )
  // 判据名在测试里只许被调用,不许被再声明一遍(两处实现一条规则 = 本仓记过最多次的漂移成因)
  for (const name of ['judgeSource', 'topLevelMainCalls', 'decide', 'readLedger', 'enumerationVerdict', 'wiringState'])
    assert.ok(
      !new RegExp(`^(?:export\\s+)?(?:async\\s+)?function ${name}\\s*\\(`, 'm').test(src),
      `测试里出现了第二份 ${name} ⇒ 镜像从防线变成漂移的掩体`,
    )
  for (const k of ['judgeSource', 'topLevelMainCalls', 'decide', 'readLedger', 'enumerationVerdict', 'wiringState', 'analyze', 'selfTest'])
    assert.equal(typeof gate[k], 'function', `__test__ 缺导出 ${k} ⇒ 测试只能另抄一份判据(§22c 红线)`)
})

test('T3 三形态守卫各算一次放过;只写在注释/字符串里的一律不得放过', () => {
  const cases = [
    ['isDirectRun 标识符', `const isDirectRun = true\nif (isDirectRun) main()\n`],
    ['import.meta.url === pathToFileURL', `if (import.meta.url === pathToFileURL(process.argv[1]).href) {\n  main()\n}\n`],
    ['fileURLToPath 等值形', `if (fileURLToPath(import.meta.url) === process.argv[1]) main()\n`],
  ]
  for (const [name, src] of cases) {
    const j = gate.judgeSource('a.mjs', src)
    assert.equal(j.state, 'pass', `${name} 应算一次放过:${JSON.stringify(j)}`)
    assert.equal(j.hits.length, 0)
  }
  const all = gate.judgeSource('a.mjs', cases.map(([, s]) => s).join('\n') + '\nfunction main(){}\n')
  assert.equal(all.forms.length, 3, '三形态并集必须各算一次(缺一个就漏一类)')
  for (const fake of [
    `// if (isDirectRun) main()\nfunction main(){}\nmain()\n`,
    `/* if (import.meta.url === pathToFileURL(process.argv[1]).href) main() */\nfunction main(){}\nmain()\n`,
    `const doc = 'if (isDirectRun) main()'\nfunction main(){}\nmain()\n`,
  ]) {
    const j = gate.judgeSource('a.mjs', fake)
    assert.equal(j.state, 'hit', `守卫写在注释/字符串里不得被读成放过:${JSON.stringify(j)}`)
  }
})

test('T4 if 块内的顶层 main() 不算违规(守卫块是合规写法)', () => {
  for (const src of [
    `async function main(){}\nif (isDirectRun) {\n  main().catch(()=>{})\n}\n`,
    `async function main(){}\nif (isDirectRun) main()\n`,
    `async function main(){}\nif (a) {\n  x()\n}\nelse main()\n`,
    `async function main(){}\nconst run = () => main()\n`,
  ]) {
    const j = gate.judgeSource('a.mjs', src)
    assert.equal(j.hits.length, 0, `不该命中:${JSON.stringify(j)}`)
  }
  const bare = gate.judgeSource('a.mjs', `async function main(){}\nmain().catch((e) => process.exit(2))\n`)
  assert.equal(bare.state, 'hit', JSON.stringify(bare))
})

test('T5 真实文件锚点(§22c 红线:不得全用自造夹具)—— 从 HEAD 现读一枚真违规 blob 复判', () => {
  const a = gate.analyze({ face: 'head', root: REPO })
  assert.ok(a.counts.listed > 100, `射程内只枚举到 ${a.counts.listed} 个文件 ⇒ 扫描面失效`)
  assert.ok(a.counts.candidates > 0, '枚举到文件却判不出任何候选 ⇒ 尺子失明')
  const real = a.judged.find((j) => j.state === 'hit')
  assert.ok(real, 'HEAD 面一枚命中都没有:要么账已还清,要么判据失明 —— 用 --self-test ST38 分这两格')
  const blob = catBatch(REPO, [`HEAD:${real.rel}`]).get(`HEAD:${real.rel}`)
  const again = gate.judgeSource(real.rel, blob)
  assert.equal(again.state, 'hit', `同一枚真实 blob 复判换了态:${JSON.stringify(again)}`)
  const line = blob.split(/\r?\n/)[again.hits[0].line - 1]
  assert.match(line, /^\s*(await\s+)?main\s*\(/, `点名的行不是顶层 main() 调用:${JSON.stringify(line)}`)
  assert.ok(!/isDirectRun/.test(gate.mask(blob)), '这一枚其实有守卫 ⇒ 命中判据站不住')
})

test('T6 棘轮与台账:存量不判红 · 新增判红 · 台账三红都判红', () => {
  const hit = (rel, n) => ({
    rel,
    state: 'hit',
    hits: Array.from({ length: n }, (_, k) => ({ line: k + 1, text: 'main()', forms: 0 })),
    forms: [],
  })
  const ledger = (arr) => gate.readLedger(JSON.stringify(arr))
  const today = '2026-12-31'
  const stock = gate.decide({
    judged: [hit('scripts/check-old.mjs', 1)],
    anchor: new Map([['scripts/check-old.mjs', 1]]),
    ledger: gate.readLedger('[]'),
    today,
    face: 'staged',
  })
  assert.equal(stock.violations.length, 0, '存量(HEAD 已有)不该算在本次头上')
  assert.equal(stock.stock.length, 1)
  const fresh = gate.decide({
    judged: [hit('scripts/check-new.mjs', 1)],
    anchor: new Map(),
    ledger: gate.readLedger('[]'),
    today,
    face: 'staged',
  })
  assert.equal(fresh.violations.length, 1, '新增必须判红')
  const bad = [
    [{ path: 'scripts/check-a.mjs', reason: '', reviewBy: '' }, '缺字段'],
    [{ path: 'scripts/check-a.mjs', reason: 'x', reviewBy: '2020-01-01' }, '过期'],
  ]
  for (const [entry, name] of bad) {
    const r = gate.decide({
      judged: [hit('scripts/check-a.mjs', 1)],
      anchor: new Map(),
      ledger: ledger([entry]),
      today,
      face: 'staged',
    })
    const red = r.violations.length + r.expired.length + r.brokenLedger.length
    assert.ok(red > 0, `${name}的台账条目必须判红:${JSON.stringify(r)}`)
    assert.equal(r.exempted.length, 0, `${name}的条目不得成为豁免`)
  }
  const rot = gate.decide({
    judged: [{ rel: 'scripts/check-a.mjs', state: 'pass', hits: [], forms: ['isDirectRun 标识符'] }],
    anchor: new Map(),
    ledger: ledger([{ path: 'scripts/check-a.mjs', reason: 'x', reviewBy: '2027-01-31' }]),
    today,
    face: 'staged',
  })
  assert.equal(rot.stale.length, 1, '登记了而被审面没命中 ⇒ 清单腐烂')
  assert.ok(gate.readLedger('{"path":"a"}').broken, '非数组台账必须 broken(exit 2 档)')
  assert.ok(gate.readLedger('{ 坏 JSON').broken, '坏 JSON 台账不得被当成空台账放行')
})

test('T7 空枚举判死 / 两面旗同给 / 取不到面 —— 都是 exit 2,不记绿', () => {
  assert.ok(gate.enumerationVerdict({ listed: 0, candidates: 0 }), '空枚举必须判死')
  const root = createRepo()
  try {
    putFile(root, 'README.md', '# 没有 scripts/ 的仓\n')
    const dead = runGateJson(['--staged', '--root', root], root)
    assert.equal(dead.rc, 2, `空枚举该 exit 2,实得 ${dead.rc}:${dead.all}`)
    assert.ok(dead.json && dead.json.dead, `JSON.dead 必须写明判死原因:${dead.out}`)
  } finally {
    rmScratch(root, { bestEffort: true })
  }
  const both = runGate(['--staged', '--worktree'])
  assert.equal(both.rc, 2, `两面旗同给必须 exit 2:${both.all}`)
  assert.match(both.err, /不得同用/)
  const outside = mkScratch('ihui-direct-run-guard-nogit-')
  try {
    const bad = runGate(['--root', outside], REPO)
    assert.equal(bad.rc, 2, `取不到面必须 exit 2(不回落、不记绿),实得 ${bad.rc}:${bad.all}`)
    assert.match(bad.err, /无法判定/)
  } finally {
    rmScratch(outside, { bestEffort: true })
  }
})

test('T8 真 git 临时仓端到端:裸 main() 进门必红 / 补守卫必绿 / 守卫只写注释仍红 / 已入库只报数', () => {
  const root = createRepo()
  try {
    // ① 索引里注入一枚顶层裸 main() 的门体 ⇒ --staged 必红
    putFile(root, 'scripts/check-probe.mjs', BARE_BODY)
    const inj = runGateJson(['--staged', '--root', root], root)
    assert.equal(inj.rc, 1, `注入裸 main() 必须判红,实得 ${inj.rc}:${inj.all}`)
    assert.equal(inj.json.violations.length, 1, JSON.stringify(inj.json && inj.json.violations))
    assert.match(inj.json.violations[0].rel, /check-probe\.mjs$/)

    // ② 补上 §22d 守卫 ⇒ 必绿
    putFile(root, 'scripts/check-probe.mjs', GUARDED_BODY)
    const fixed = runGateJson(['--staged', '--root', root], root)
    assert.equal(fixed.rc, 0, `补守卫后必须绿,实得 ${fixed.rc}:${fixed.all}`)
    assert.equal(fixed.json.violations.length, 0)

    // ③ 守卫**只写在注释里** ⇒ 仍红(证明遮罩有牙,而不是门在判自己的散文)
    putFile(root, 'scripts/check-probe.mjs', FAKE_GUARD_BODY)
    const faked = runGateJson(['--staged', '--root', root], root)
    assert.equal(faked.rc, 1, `注释里的守卫不得当豁免,实得 ${faked.rc}:${faked.all}`)
    assert.equal(faked.json.violations.length, 1)

    // ④ 同一枚违规**已经入库** ⇒ 差值棘轮只报存量(不是恒红门,§12e)
    gitIn(root, ['commit', '--quiet', '-m', 'gate-test: 存量违规先入库'])
    const stock = runGateJson(['--staged', '--root', root], root)
    assert.equal(stock.rc, 0, `存量不该算在本次头上(否则就是逼人 --no-verify),实得 ${stock.rc}:${stock.all}`)
    assert.equal(stock.json.violations.length, 0, JSON.stringify(stock.json.violations))
    assert.equal(stock.json.counts.hit, 1, `存量必须仍被数到:${JSON.stringify(stock.json.counts)}`)

    // ⑤ 在存量之上再带一枚新的 ⇒ 只有新的判红
    putFile(root, 'scripts/check-probe2.mjs', BARE_BODY)
    const second = runGateJson(['--staged', '--root', root], root)
    assert.equal(second.rc, 1, `新增必须判红:${second.all}`)
    assert.equal(second.json.violations.length, 1, JSON.stringify(second.json.violations))
    assert.match(second.json.violations[0].rel, /check-probe2\.mjs$/)
    assert.equal(second.json.counts.hit, 2, '两枚命中都要数到,存量那枚不折算成本次的债')
  } finally {
    rmScratch(root, { bestEffort: true })
  }
})

test('T9 --json 必须可 JSON.parse,且末行读数在 JSON.summary 里', () => {
  const r = runGateJson([])
  assert.ok(r.json, `--json 打不出可解析的 JSON:${r.out.slice(0, 400)}`)
  for (const k of ['face', 'counts', 'violations', 'undetermined', 'summary', 'rc'])
    assert.ok(k in r.json, `--json 缺字段 ${k}`)
  assert.match(r.json.summary, /命中 \d+.*放过 \d+.*未判定 \d+/s, r.json.summary)
})

test('T10 台账出口在真仓面上有牙:过期条目判红,有效条目判绿(同一枚违规)', () => {
  const root = createRepo()
  try {
    putFile(root, 'scripts/check-probe.mjs', BARE_BODY)
    putFile(
      root,
      'scripts/data/direct-run-guard-exemptions.json',
      JSON.stringify([{ path: 'scripts/check-probe.mjs', reason: '待清偿', reviewBy: '2020-01-01' }], null, 2) + '\n',
    )
    const expired = runGateJson(['--staged', '--root', root], root)
    assert.equal(expired.rc, 1, `过期豁免必须判红:${expired.all}`)
    assert.equal(expired.json.expired.length, 1, JSON.stringify(expired.json))
    putFile(
      root,
      'scripts/data/direct-run-guard-exemptions.json',
      JSON.stringify([{ path: 'scripts/check-probe.mjs', reason: '待清偿', reviewBy: '2099-01-01' }], null, 2) + '\n',
    )
    const ok = runGateJson(['--staged', '--root', root], root)
    assert.equal(ok.rc, 0, `有效豁免应当放行:${ok.all}`)
    assert.deepEqual(ok.json.exempted, ['scripts/check-probe.mjs'])
    // 腐烂:同一枚台账,而门体补了守卫 ⇒ 登记了却没命中
    putFile(root, 'scripts/check-probe.mjs', GUARDED_BODY)
    const rot = runGateJson(['--staged', '--root', root], root)
    assert.equal(rot.rc, 1, `清单腐烂必须判红:${rot.all}`)
    assert.deepEqual(rot.json.stale, ['scripts/check-probe.mjs'])
  } finally {
    rmScratch(root, { bestEffort: true })
  }
})

test('T11 门体自检必须真跑过(现读 rc 与例数,不写死数字)', () => {
  const r = runGate(['--self-test'])
  assert.equal(r.rc, 0, `--self-test 应 exit 0:${r.all}`)
  const m = /自检 例数 (\d+) 通过 (\d+) 失败 (\d+)/.exec(r.out)
  assert.ok(m, `末行读数换了形状:${r.out}`)
  assert.equal(m[1], m[2], `自检有失败例:${r.out}`)
  assert.ok(Number(m[1]) >= 40, `自检例数低于 40 说明判据被摘:${m[1]}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
