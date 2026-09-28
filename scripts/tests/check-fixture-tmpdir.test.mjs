// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 镜像测试(G-284):scripts/check-fixture-tmpdir.mjs
//
// §22c:判据一律直接 import 源门的 `__test__`,**不在测试里复制第二份判据**。
// 这里另有三条"只能靠源码锁"的防线,理由各记过一次同型事故:
//  T-face 取材面纪律:清单与内容必须同面同轮,且只能经 lib/face-reader.mjs 读 ——
//        "import 了层却自己拼 git show / 按磁盘判"在守门 118 里叫半接线(它一度整片失明)。
//  T-mask 遮罩只能有一份(守门 131/135 同条):本门判 F1/F2 必须走 code-mask 那一份,
//        自己写一遍剥注释逻辑必然与它漂,漂的结果是"注释里的判据说明"被算成违规。
//  T-strict 默认档永远不判红:这是票面的定级,必须由"decide 的违规分支带 strict"这种
//        结构锁钉住 —— 否则下一次有人"顺手升档",存量 59 处立刻变成每台每次被逼跳门。

import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
import { SCRATCH_DIR_NAME, mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-fixture-tmpdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const GATE = join(SCRIPTS_DIR, 'check-fixture-tmpdir.mjs')
const GATE_TEST = join(HERE, 'check-fixture-tmpdir.test.mjs')
const RAW = readFileSync(GATE, 'utf8')
const CODE = maskCommentsAndStrings(RAW)
/**
 * 只丢注释行、**保留字符串**的那一面。模块说明符本身就是字符串 ⇒ 判 import 必须用它;
 * 判"有没有某种**调用**"用 CODE(字符串一起抹,免得把散文里的字样算成调用)。
 * 两层遮噪方向不同,混用 Either 让锁恒真或恒假 —— 本文件第一版就把说明符锁放在了 CODE 上,
 * 于是它对着一份"import 了但说明符被抹成空格"的源码判红,红了也不是判据的功劳。
 */
const CODE_LINES = RAW.split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join('\n')

function extractFnBody(src, name, minBody = 40) {
  const re = new RegExp(`(?:export\\s+)?function\\s+${name}\\s*\\(`)
  const m = re.exec(src)
  assert.ok(m, `源码里找不到函数 ${name}(改名/摘线即红)`)
  let i = src.indexOf('(', m.index)
  let pd = 0
  for (; i < src.length; i++) {
    if (src[i] === '(') pd += 1
    else if (src[i] === ')') {
      pd -= 1
      if (pd === 0) {
        i += 1
        break
      }
    }
  }
  const start = src.indexOf('{', i)
  let depth = 0
  for (let k = start; k < src.length; k++) {
    if (src[k] === '{') depth += 1
    else if (src[k] === '}') {
      depth -= 1
      if (depth === 0) {
        const body = src.slice(start, k + 1)
        assert.ok(body.length >= minBody, `${name} 扒出的体只有 ${body.length} 字符 ⇒ 提取式没牙`)
        return body
      }
    }
  }
  assert.fail(`${name} 括号没配平`)
}

/** 把门连同它的 import 闭包拷进演练仓后跑 CLI —— ROOT 由脚本自身位置推 ⇒ 必须真拷进去。 */
function installGateIn(fix) {
  const copied = copyScriptWithClosure(
    SCRIPTS_DIR,
    'check-fixture-tmpdir.mjs',
    join(fix, 'scripts'),
    ['check-fixture-tmpdir.mjs', 'lib/code-mask.mjs', 'lib/face-reader.mjs', 'lib/gitdir.mjs'],
  )
  return copied
}

function runGate(args, cwd) {
  return execFileSync(
    process.execPath,
    [join(cwd, 'scripts', 'check-fixture-tmpdir.mjs'), ...args],
    {
      encoding: 'utf8',
      cwd,
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 1 << 26,
    },
  )
}

/** 取退出码:execFileSync 在非零时抛,把 status 取回来而不是把异常当结论。 */
function codeOf(fn) {
  try {
    fn()
    return 0
  } catch (e) {
    return typeof e.status === 'number' ? e.status : -1
  }
}

/* ───────────────── 判据行为:构造面成对正反例 ───────────────── */

test('F1/F2 只在代码面判:同一批字样在注释与字符串里不得计入违规(假阳防线)', () => {
  const bad = gate.scanFixtureText(`const d = mkdtempSync(os.tmpdir())\n`)
  assert.ok(bad.hits.some((h) => h.kind === 'F1'))
  assert.ok(bad.hits.some((h) => h.kind === 'F2'))
  const prose = gate.scanFixtureText(
    `// 禁止 mkdtempSync(os.tmpdir()) 这一型\nconst s = 'mkdtempSync('\n`,
  )
  assert.deepEqual(prose.hits, [], '门把自己的说明文字判成违规 ⇒ 后人只能删说明,判据反而更难维护')
})

test('F3(接线)必须走"保留字符串"那一面 —— 抹掉字符串的面上判 import 等于失明', () => {
  const wired = gate.scanFixtureText(
    `import { mkScratch } from '../lib/scratch-dir.mjs'\nmkdtempSync(x)\n`,
  )
  assert.equal(wired.wired, true)
  const fake = gate.scanFixtureText(`import { x } from '../lib/other.mjs'\nmkdtempSync(x)\n`)
  assert.equal(fake.wired, false)
})

test('N1(仓库树内夹具)只报数,不进红线;两种书写都要认', () => {
  const a = gate.scanFixtureText(`const p = join('.ihui-agent', 'tmp', 'x')\nmkdirSync(p)\n`)
  assert.equal(a.hits.length, 0)
  assert.ok(a.notices.length >= 1)
  const b = gate.scanFixtureText(`const p = '.ihui-agent/tmp/x'\n`)
  assert.ok(b.notices.length >= 1)
  const c = gate.scanFixtureText(`// 以前写的是 '.ihui-agent/tmp'\n`)
  assert.equal(c.notices.length, 0, '注释里的路径不算在仓库树内造夹具')
})

test('退出码四态:空扫/取不到 ⇒ 2,默认档有违规 ⇒ 0,--strict 才 1', () => {
  assert.equal(gate.decide({ listed: 0, unreadable: 0, violations: 5, strict: false }).code, 2)
  assert.equal(gate.decide({ listed: 9, unreadable: 2, violations: 0, strict: false }).code, 2)
  assert.equal(gate.decide({ listed: 9, unreadable: 0, violations: 5, strict: false }).code, 0)
  assert.equal(gate.decide({ listed: 9, unreadable: 0, violations: 5, strict: true }).code, 1)
  assert.equal(gate.decide({ listed: 9, unreadable: 0, violations: 0, strict: true }).code, 0)
})

test('回退判定只认"暂存档 + 射程内零文件"这一种(其余零文件一律判死)', () => {
  assert.equal(
    gate.shouldRetreatToHead({ face: 'staged', scopeCount: 0, hasFilesArg: false }),
    true,
  )
  assert.equal(
    gate.shouldRetreatToHead({ face: 'staged', scopeCount: 2, hasFilesArg: false }),
    false,
  )
  assert.equal(gate.shouldRetreatToHead({ face: 'head', scopeCount: 0, hasFilesArg: false }), false)
  assert.equal(
    gate.shouldRetreatToHead({ face: 'worktree', scopeCount: 0, hasFilesArg: false }),
    false,
  )
  assert.equal(
    gate.shouldRetreatToHead({ face: 'staged', scopeCount: 0, hasFilesArg: true }),
    false,
  )
})

test('射程只含 scripts/tests 的 .mjs,且本门自己的测试文件自豁免(必须大声报出而不是静默少扫)', () => {
  assert.equal(gate.inScope('scripts/tests/a.test.mjs'), true)
  assert.equal(gate.inScope('scripts/tests/__snapshots__/x.mjs'), false)
  assert.equal(
    gate.inScope('scripts/lib/scratch-dir.mjs'),
    false,
    'lib 不是本门射程:落点住在 lib 是**对的**',
  )
  assert.equal(gate.inScope('apps/web/src/x.ts'), false)
  assert.ok(gate.SELF_EXEMPT.includes('scripts/tests/check-fixture-tmpdir.test.mjs'))
})

/* ───────────────── 源码形状锁(行为断言覆盖不到的那一类)───────────────── */

test('T-mask:遮罩只有 code-mask 那一份实现,本门不得自带剥注释逻辑', () => {
  assert.match(CODE_LINES, /from '\.\/lib\/code-mask\.mjs'/)
  assert.match(CODE, /maskCommentsAndStrings\(/)
  // 第二份实现的长相通常是逐行 startsWith('//') 或自己写状态机。
  // 这里允许 inFile 的"丢注释行"筛(它判的是说明符面,与遮罩判的不是同一件事),
  // 但不得出现第二个 mask 函数。
  assert.doesNotMatch(
    CODE,
    /function\s+(stripComments|maskComments|removeComments|blankComments)\s*\(/,
  )
})

test('T-face:内容必须经 face-reader 的读取入口取(catBatch),不得自拼 git show / 按磁盘判被审面', () => {
  assert.match(CODE_LINES, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(CODE, /catBatch\(/)
  const readFace = extractFnBody(CODE, 'readFace')
  assert.match(readFace, /catBatch\(/, 'readFace 没走层 ⇒ 半接线(守门 118 那一型)')
  assert.doesNotMatch(CODE, /gitRaw\(\s*\[?\s*['"]show/, '不得自己拼 git show 取被审内容')
})

test('T-root:定根不得用 process.cwd()(守门 70 的镜像 13/14 恒红那一型)', () => {
  assert.doesNotMatch(CODE, /process\.cwd\(\)/)
  assert.match(CODE, /fileURLToPath\(import\.meta\.url\)/)
})

test('T-strict:默认档不判红是结构而不是措辞', () => {
  const body = extractFnBody(CODE, 'decide')
  assert.match(body, /violations\s*>\s*0\s*&&\s*strict/, '违规分支必须与 strict 同在')
  assert.doesNotMatch(
    body,
    /violations\s*>\s*0\s*\)\s*return\s*\{\s*code:\s*1/,
    '不得存在"不看 strict 就判 1"的分支',
  )
})

test('T-flags:--staged 与 --worktree 必须经 selectFace 判矛盾(两面旗同给 ⇒ 判死)', () => {
  const body = extractFnBody(CODE, 'main')
  assert.match(body, /selectFace\(/)
  assert.match(body, /sel\.error/)
})

/* ───────────────── 端到端:同一棵树在两个面上必须给出不同答案 ───────────────── */

test('面纪律端到端:HEAD 干净 / 索引脏 ⇒ --staged 报出而全量报绿;入库后反过来;仅磁盘脏不算暂存违规', (t) => {
  const fix = mkScratch('g284-face-')
  const git = gitBinary()
  const g = (...a) =>
    execFileSync(git, ['-c', 'safe.directory=*', '-C', fix, ...a], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
    })
  const gc = (...a) => g('-c', 'user.email=t@t', '-c', 'user.name=t', ...a)
  try {
    mkdirSync(join(fix, 'scripts', 'tests'), { recursive: true })
    installGateIn(fix)
    const target = join(fix, 'scripts', 'tests', 'a.test.mjs')
    writeFileSync(
      target,
      `import { mkScratch } from '../lib/scratch-dir.mjs'\nexport const x = 1\n`,
    )
    g('init', '-q', '-b', 'main')
    g('add', '.')
    gc('commit', '-q', '-m', 'init')

    // 索引脏(别人刚 add、尚未提交)
    writeFileSync(target, `const fs = require('node:fs')\nfs.mkdtempSync('x')\n`)
    g('add', '--', 'scripts/tests/a.test.mjs')

    const sj = JSON.parse(runGate(['--staged', '--json'], fix))
    assert.ok(sj.violations >= 1, '索引里的违规必须被 --staged 档看见')
    assert.equal(sj.usedFace, 'staged', '暂存档不得悄悄退回别的面')
    const hj = JSON.parse(runGate(['--json'], fix))
    assert.equal(hj.violations, 0, 'HEAD 面此刻是干净的 ⇒ 全量档必须报绿(拿磁盘判会读成违规)')

    // 入库之后:同一份内容必须被全量档点名(证明判的是内容不是"暂存动作")
    gc('commit', '-q', '-m', 'dirty')
    const hj2 = JSON.parse(runGate(['--json'], fix))
    assert.ok(hj2.violations >= 1, '已入库的违规必须被全量档点名')
    assert.equal(
      codeOf(() => runGate(['--strict'], fix)),
      1,
      '--strict 有违规 ⇒ 1',
    )
    assert.equal(
      codeOf(() => runGate([], fix)),
      0,
      '默认档永远不判红(票面定级)',
    )

    // 提交干净内容后,仅工作区脏 ⇒ --staged 档不得借磁盘凑数;worktree 逃生舱必须看得见
    writeFileSync(target, `export const clean = 1\n`)
    gc('commit', '-qam', 'clean')
    writeFileSync(target, `mkdtempSync('only-worktree')\n`)
    const st2 = JSON.parse(runGate(['--staged', '--json'], fix))
    assert.equal(st2.violations, 0, '仅工作区脏(未 add)不算暂存面的违规')
    const wt = JSON.parse(runGate(['--worktree', '--json'], fix))
    assert.ok(wt.violations >= 1, 'worktree 档必须看得见磁盘现场(它是人工取证通道)')

    // 两面旗同给 ⇒ 判死
    assert.equal(
      codeOf(() => runGate(['--staged', '--worktree'], fix)),
      2,
    )
    // --staged 而本次没碰射程 ⇒ 回退全量并如实报面(不是判死)
    writeFileSync(join(fix, 'README.md'), 'docs only\n')
    g('add', '--', 'README.md')
    const rt = JSON.parse(runGate(['--staged', '--json'], fix))
    assert.equal(rt.usedFace, 'head', '暂存集为空 ⇒ 回退 HEAD 并如实标面')
    assert.equal(rt.retreated, true)
    assert.ok(rt.listed >= 1, '回退后仍要有被审对象,否则判死那条仍然生效')
    if (!rt.listed) t.diagnostic('回退后枚举为空(该夹具应有 a.test.mjs)')
  } finally {
    rmScratch(fix)
  }
})

test('两面旗同给 ⇒ exit 2 —— 拿真仓再验一次(不依赖夹具)', () => {
  let code = 0
  try {
    execFileSync(process.execPath, [GATE, '--staged', '--worktree'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
    })
  } catch (e) {
    code = e.status
  }
  assert.equal(code, 2)
})

test('本门的夹具落点自己也要合规(它判的就是这一条 —— 不能双标)', () => {
  assert.doesNotMatch(CODE, /mkdtempSync\(/, '门自己绕过落点 ⇒ 判据当场失去立场')
  assert.doesNotMatch(CODE, /tmpdir\(/)
  const TEST_CODE = maskCommentsAndStrings(readFileSync(GATE_TEST, 'utf8'))
  assert.doesNotMatch(TEST_CODE, /mkdtempSync\(/, '镜像测试自己绕过落点 ⇒ 判据当场失去立场')
  assert.doesNotMatch(TEST_CODE, /tmpdir\(/)
  assert.match(TEST_CODE, /mkScratch\(/, '夹具必须来自唯一落点')
})

test('SCRATCH_DIR_NAME 与本门射程不冲突:夹具根在 lib 里是合规的(不得把自己人的落点判成违规)', () => {
  assert.equal(SCRATCH_DIR_NAME, 'ihui-scratch')
  assert.equal(gate.inScope('scripts/lib/scratch-dir.mjs'), false)
})

test('接线现状锁:本门此刻**不在**提交链(默认档只报数);若被接进 runner,必须是 warn 或存量清零后的 blocking', () => {
  const runnerRaw = readFileSync(join(SCRIPTS_DIR, 'guardian-runner.mjs'), 'utf8')
  const wired = /check-fixture-tmpdir/.test(runnerRaw)
  if (!wired) {
    assert.ok(true, '未接线:名单(现读数见交付报告)先交主会话统一清,再接线')
    return
  }
  const idx = runnerRaw.indexOf('check-fixture-tmpdir.mjs')
  const open = runnerRaw.lastIndexOf('{', idx)
  let depth = 0
  let end = -1
  for (let i = open; i < runnerRaw.length; i++) {
    if (runnerRaw[i] === '{') depth += 1
    else if (runnerRaw[i] === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const entry = runnerRaw.slice(open, end + 1)
  assert.match(
    entry,
    /mode:\s*'warn'/,
    '存量未清就 blocking ⇒ 恒红门(§12e);接进提交链时必须是 warn',
  )
})
