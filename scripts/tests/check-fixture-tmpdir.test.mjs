// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
import { SCRATCH_DIR_NAME, mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
// §22c:台账的两条判据(entryProblem / applyLedger)**直接 import 源门导出的那两个函数**,
// 绝不在测试里复制第二份"什么算合法条目"的规则 —— 复制的那份会跟着实现一起漂绿(本仓记过多次)。
import { __test__ as gate, applyLedger, entryProblem } from '../check-fixture-tmpdir.mjs'

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
      // 不消费 stdin 的子进程一律走这一档(本仓唯一正解,见 EBUSY 那条):
      // 省略 stdio / 写 'pipe' 都会让 Node 给子进程建 stdin 管道 ⇒ 本机交互会话下必 EBUSY。
      // 这四处都不喂 stdin(无 input / 无 --stdin),所以设 ignore 不会静默丢数据。
      stdio: ['ignore', 'pipe', 'pipe'],
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
      stdio: ['ignore', 'pipe', 'pipe'],
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
      stdio: ['ignore', 'pipe', 'pipe'],
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

test('W1 接线锁:run() 必须把 rotations 喂给 decide —— 判据在 self-test 构造面上"存在"不等于提交链上会成立', () => {  // 2026-09-28 实测:死在轮次上限的代理把 rot 判据写进了 decide,并在 --self-test 里给它配了
  // 构造面用例(rotations:1 ⇒ code 1),而 run() 那一侧的 decide(...) 调用**从未传这个键**
  // ⇒ "台账条目指向已无命中文件 = 清单腐烂"这一维在提交链上永不触发,账面却读起来像已看守。
  // 这一型本仓记过多次(守门 70/76/81/115"函数在、自检过、调用点没接"),只有源码锁能防:
  // 加断言会跟着一起漂绿,而"必须有人调它"这件事本身不能被行为用例覆盖(现读 rot=0)。
  const src = CODE
  // 刻意不写 /decide\(\{[^}]*rotations[^}]*\}\)/ 这种"全文任一处"的形状:--self-test 里那些
  // 构造面调用本身就带 rotations,那样本条断言恒真(第一版就是这么绿的 —— 变异拿掉 run() 的
  // 实参后仍报 pass,而"永远绿的断言比没有断言更糟")。要钉的是 run() 那一处。
  const runCall = src.match(/decide\(\{[^}]*listed: scope\.length[^}]*\}\)/)
  assert.ok(
    runCall,
    'run() 里的 decide 调用形状变了 ⇒ 本锁失去对象,先修锁再谈判据(不许直接把本用例删掉)',
  )
  assert.match(
    runCall[0],
    /\brotations\b/,
    'run() 的 decide 调用必须带上 rotations 这一维;漏传即判据半接线(自检恒绿而提交链永不判腐烂)',
  )
})

/* ───────────────── 台账两把防自欺锁(G-284 续票:把 69 处逐条定性) ─────────────────
 * 台账文件 scripts/fixture-tmpdir-exemptions.json 此前**从未存在** ⇒ 全部存量按"零豁免"计违规。
 * 补上它的那一刻,新增的两型风险同时出现:① 有人写一条空 reason / 非法日期的行把自己那一份
 * 豁免掉(那等于给一台门发假合格证);② 修好之后行不删,台账替后来人做出"这一端已被想过"的判断。
 * 两条各配一次变异自证:坏条目喂进去必红、还原必绿;零命中行必判 rot、有命中必不判 rot。
 * 判据一律用源门导出的 entryProblem / applyLedger,不在本文件复制第二份合法性规则(§22c)。
 */

const TODAY = new Date().toISOString().slice(0, 10)
const LEDGER_PATH = join(SCRIPTS_DIR, 'fixture-tmpdir-exemptions.json')
/** 一份**必然产生命中**的夹具文本(它在模板串里,会被本文件自己的遮罩锁抹掉 ⇒ 不触发自家红线)。 */
const HIT_TEXT = `const fs = require('node:fs')\nfs.mkdtempSync('/x')\n`
const RAW_HITS = gate.scanFixtureText(HIT_TEXT).hits

test('L1 台账形态锁:缺 reason / reviewBy 非 ISO / file 为空 ⇒ 门必须点名报错,且**不得**顺手整文件放过', () => {
  assert.ok(RAW_HITS.length > 0, '夹具文本必须真产生命中,否则本锁没有对象(空转的断言比没有断言更糟)')
  const BAD = [
    { file: 'scripts/x.mjs', reviewBy: '2099-01-01' },
    { file: 'scripts/x.mjs', reason: '   ', reviewBy: '2099-01-01' },
    { file: 'scripts/x.mjs', reason: '判据对象是运行时 TEMP' },
    { file: 'scripts/x.mjs', reason: '判据对象是运行时 TEMP', reviewBy: '2099/01/01' },
    { file: 'scripts/x.mjs', reason: '判据对象是运行时 TEMP', reviewBy: '' },
    { file: '', reason: '判据对象是运行时 TEMP', reviewBy: '2099-01-01' },
    'not-an-object',
  ]
  for (const entry of BAD) {
    // ① entryProblem 单独问得出问题(它才是"什么算合法"的那把尺子)
    assert.ok(entryProblem(entry, TODAY), `坏条目必须被 entryProblem 点名:${JSON.stringify(entry)}`)
    // ② 更要紧的是**失效方向**:条目坏 ⇒ 不得被当成"没有台账"以外的任何东西。
    // 若实现把坏条目折成"该文件无命中/已豁免",一条随手写的行就能关掉判据 —— 那正是本台账
    // 落地新引入的那一型,所以这里同时断言违规照计、rot=false(坏条目不豁免也不腐烂)。
    const res = applyLedger({ wired: false, rawHits: RAW_HITS, entry, today: TODAY })
    assert.ok(res.problem, `applyLedger 必须把问题带到结论里:${JSON.stringify(entry)}`)
    assert.equal(
      res.violations.length,
      RAW_HITS.length,
      `坏条目不得放过任何违规(否则"随便写一行 reason"就是第二个 SELF_EXEMPT):${JSON.stringify(entry)}`,
    )
  }
  // 「该文件不在台账上」与「台账行坏」必须**同向**:两种都照计违规。
  // 缺席被读成放过 = 只要不写行就能过关;坏行被读成放过 = 随手写一行就能关掉判据。两个方向各配一条。
  const absent = applyLedger({ wired: false, rawHits: RAW_HITS, entry: null, today: TODAY })
  assert.equal(absent.problem, null, '缺席不是坏行,不该报形态问题(那是另一码事,别把报告刷脏)')
  assert.equal(absent.violations.length, RAW_HITS.length, '缺席 ⇒ 违规照计(缺席不等于通过)')
  // 变异自证(还原 ⇒ 必绿):同一 file、补上非空 reason + 合法未过期 reviewBy ⇒ 豁免立即生效
  const good = applyLedger({    wired: false,
    rawHits: RAW_HITS,
    entry: { file: 'scripts/x.mjs', reason: '判据对象是运行时 TEMP', reviewBy: '2099-01-01' },
    today: TODAY,
  })
  assert.equal(good.problem, null, '合法条目不该被挑毛病')
  assert.equal(good.violations.length, 0, '合法条目必须真的放过(否则台账等于没有出路)')
  assert.ok(good.exempted > 0, '放过要计进 exempted —— 报告里"台账豁免 N 处"靠它,静默放过等于没判')
})

test('L2 rot 锁:台账行指向面上已无命中的文件 ⇒ 判清单腐烂且**不看 strict**;过期而有命中是另一桶', () => {
  const valid = { file: 'scripts/gone.mjs', reason: '早已迁完', reviewBy: '2099-01-01' }
  // ① 零命中 + 合法条目 ⇒ rot(挂着 = 替后来人做出"这一端已被想过"的判断)
  const rotRes = applyLedger({ wired: false, rawHits: [], entry: valid, today: TODAY })
  assert.equal(rotRes.rot, true)
  assert.equal(
    gate.decide({ listed: 5, unreadable: 0, violations: 0, rotations: 1, strict: false }).code,
    1,
    'rot 不是存量:任何档都要判红,否则默认档会把它读成"只是报数"',
  )
  // ② 变异自证(还原 ⇒ 必绿):同一行、同一 today,只要该文件在面上还有命中 ⇒ 是豁免不是腐烂
  const withHit = applyLedger({ wired: false, rawHits: RAW_HITS, entry: valid, today: TODAY })
  assert.equal(withHit.rot, false, '有命中而判腐烂 ⇒ 修好了不能留行、留着又红,这道门就没有合法状态')
  assert.equal(withHit.violations.length, 0)
  // ③ 第三桶:过期**而有**命中 ⇒ problem 点名 + 违规照计 + 不得算 rot(两桶一混就看不出谁欠账)
  const expired = applyLedger({
    wired: false,
    rawHits: RAW_HITS,
    entry: { ...valid, reviewBy: '2020-01-01' },
    today: TODAY,
  })
  assert.match(expired.problem || '', /过期/, '过期要说明是过期,而不是笼统一句"条目坏"')
  assert.ok(expired.violations.length > 0, '过期 ⇒ 豁免失效,账回到该文件头上')
  assert.equal(expired.rot, false, '"过期而有命中"是待清偿的账,不是清单腐烂')
  // ④ 结构锁:decide 的 rot 分支必须存在、判 1、且不吃 strict(有人"顺手加个 strict"即红)
  const decideBody = extractFnBody(CODE, 'decide')
  const rotLine = decideBody.split('\n').find((l) => l.includes('rotations'))
  assert.ok(rotLine, 'decide 里再也找不到 rotations 那一支 ⇒ 本锁失去对象,先修锁再谈判据')
  assert.match(rotLine, /code:\s*1/)
  assert.doesNotMatch(rotLine, /strict/, 'rot 一旦挂到 strict 上,默认档就把腐烂读成"只是报数"')
})

test('L3 台账文件自身必须合法可 parse:坏 JSON / 空 reason / 过期行 / 重复 file 都不许入库', () => {
  // 这条不测判据,测**我落地的那份数据**:台账一旦带着坏行入库,门在哪个档读它都会得出
  // 与作者机相反的结论(本仓"作者机常绿、别的检出上每次提交都被逼 --no-verify"那一型,
  // 见 gate-wiring 台账 P5 与 §12 的活文档纪律)。
  const raw = readFileSync(LEDGER_PATH, 'utf8')
  const parsed = JSON.parse(raw) // 坏 JSON 在这里就抛 —— 不得被 loader 静默折成"空清单"
  assert.ok(Array.isArray(parsed.exemptions), '台账必须是 { exemptions: [...] } 形态')
  assert.ok(parsed.$comment, '台账必须自带一句它是谁的豁免通道、以及**接线现状**')
  const seen = new Set()
  for (const e of parsed.exemptions) {
    const p = entryProblem(e, TODAY)
    assert.equal(p, null, `台账行形态坏/已过期:${e && e.file} —— ${p}`)
    assert.ok(!seen.has(e.file), `同一 file 登记两行 ⇒ 按 file 建映射时静默顶掉一条:${e.file}`)
    seen.add(e.file)
    assert.ok(
      gate.inScope(e.file),
      `台账行指向不在射程的文件 ⇒ 它永远不会有任何命中,入库即 rot:${e.file}`,
    )
  }
})

test('L4 台账文件名与门体常量必须同值(改名/搬位不许只改一边)', () => {
  assert.match(
    CODE_LINES,
    /const LEDGER_FILE = 'scripts\/fixture-tmpdir-exemptions\.json'/,
    '门体里的台账路径常量漂了而本测试仍读旧文件 ⇒ 门读不到 ⇒ 按"零豁免"判,而账面像已收口',
  )
  assert.ok(existsSync(LEDGER_PATH), `工作树缺 ${LEDGER_PATH}:台账文件不入库就没法被任何面读到`)
})

test('L5 台账必须被 run() 真加载:一份从没被读过的台账与一份生效的台账,在输出里不得长得一样', () => {
  // 2026-09-28 摘掉 todo:接线已落地(门体新增 loadLedger + 逐行 applyLedger,并在 --json 里
  // 报 exemptionsLoaded)。留 todo 的那一晚,台账里 5 条 B 堆对现读读数**零影响**,
  // 而账面读起来像"豁免已生效"—— 那正是本仓记过多次的半接线(函数在、自检过、调用点没接)。
  // 用 --worktree 档而非默认档:台账与本测试同枚提交,提交前 HEAD 面上它当然不存在,
  // 那种情形门必须走"缺席⇒零豁免并大声报出"那一支(另有 L1 钉住)。
  const expiredEntry = {
    file: 'scripts/check-c-drive-pollution.mjs',
    reason: '判据对象是活 TEMP',
    reviewBy: '2020-01-01',
  }
  const res = applyLedger({ wired: false, rawHits: RAW_HITS, entry: expiredEntry, today: TODAY })
  assert.ok(res.violations.length > 0, '过期条目必须不再放过')
  const cli = JSON.parse(runGateReal(['--worktree', '--json']))
  assert.equal(
    cli.exemptionsLoaded,
    true,
    'CLI 必须报告"台账已加载"这一维:没有它,一份从没被读过的台账与一份生效的台账在输出里长得一模一样',
  )
  const row = cli.perFile.find((f) => f.path === expiredEntry.file)
  assert.ok(row, `被审面上应能枚举到台账点名的这个文件(${expiredEntry.file})`)
  assert.ok(
    (row.rawHits || []).length > 0,
    '该行必须真有原始命中,否则"被放过 N 处"是拿空集凑出来的(条目还在而命中没了走 rot,由 L2 钉)',
  )
  assert.equal(
    row.hits.length,
    0,
    `合法且未过期的台账应把该文件剩余违规全部放过,实得 ${JSON.stringify(row.hits)}`,
  )
  assert.equal(row.exempted, row.rawHits.length, 'exempted 必须等于被放过的原始命中数(少算 = 静默丢账)')
  assert.equal(row.problem, null, '该行台账合法未过期 ⇒ 不得报 problem')

  // 成对的另一臂走**构造面**(不在测试里 shell 出去读别的文件 —— 那会把两个文件耦合成
  // "任一改名本测试即红",而改名本身不是缺陷):**台账在被审面上不存在** ⇒ 报告必须大声喊出来,
  // 不得打"射程内没有 F1/F2 ⇒ 这一维已闭合"那种结论。
  const absentReport = gate.formatReport(
    [{ path: 'scripts/x.mjs', hits: [], rawHits: [], notices: [], wired: false, exempted: 0, problem: null, rot: false }],
    { code: 0, kind: 'clean' },
    { face: 'head', ledgerAbsent: true },
  )
  const absentText = absentReport.join('\n')
  assert.match(absentText, /不存在|零豁免/, '台账缺席必须被点名(缺席不等于通过)')
  assert.doesNotMatch(
    absentText,
    /这一维已闭合/,
    '台账从没被读过时不得打"已闭合" —— 那一支要说"只证明没扫到违规,不证明豁免口径已复核"',
  )
  assert.match(absentText, /未加载/, '缺席档必须明写台账未加载,否则与已加载档在输出里同形')
  const loadedText = gate
    .formatReport(
      [
        {
          path: 'scripts/x.mjs',
          hits: [],
          rawHits: [],
          notices: [],
          wired: false,
          exempted: 0,
          problem: null,
          rot: false,
        },
      ],
      { code: 0, kind: 'clean' },
      { face: 'head', ledgerAbsent: false },
    )
    .join('\n')
  assert.match(loadedText, /已闭合/, '加载过台账且确无命中时才允许打"已闭合"(两档不得同形,也不得同严)')
})

// ── 跳过出口必须**真的能跳**(2026-10-06 补)─────────────────────────────────
// 背景: 本门在注册块里声明的 `skipEnv: 'HUSKY_SKIP_FIXTURE_TMPDIR'` 此前**零真实读点**
// (全仓 grep 只命中注册块那一行), 而代码只读建门时的旧名 `..._GUARD`
// ⇒ 照注册表设变量的人会被 runner 放行、门却照跑不误 = **一条写出来跑不通的出路**。
// 这正是 `check-service-binary-paths.mjs` 头注点名的那一型。
//
// 为什么测在 CLI 层: 这个缺陷的本质是"进程真的认不认这个环境变量",
// 纯函数层测不到 —— 必须起真子进程、真的把变量灌进去、看它是否 exit 0 且说明跳过。

/** 起真子进程跑本门, 返回 { code, out }。env 用来灌跳过变量。 */
function runGateEnv(args, env) {
  const r = spawnSync(process.execPath, [GATE, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 1 << 26,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }
}

/** 从注册块里取本门声明的 skipEnv 名字(不硬编码 —— 注册表才是真值源)。 */
function declaredSkipEnv() {
  const raw = readFileSync(join(SCRIPTS_DIR, 'guardian-runner.mjs'), 'utf8')
  const idx = raw.indexOf('check-fixture-tmpdir.mjs')
  if (idx < 0) return null
  const open = raw.lastIndexOf('{', idx)
  let depth = 0
  let end = -1
  for (let i = open; i < raw.length; i++) {
    if (raw[i] === '{') depth += 1
    else if (raw[i] === '}') {
      depth -= 1
      if (depth === 0) { end = i; break }
    }
  }
  const m = /skipEnv:\s*'([^']+)'/.exec(raw.slice(open, end < 0 ? undefined : end))
  return m ? m[1] : null
}

test('注册块声明的 skipEnv 名字必须真能跳过本门(不得是写出来跑不通的出路)', () => {
  const declared = declaredSkipEnv()
  assert.ok(declared, '本门已注册, 注册块里必须有 skipEnv —— 取不到就是另一类缺陷,本条不适用')
  const r = runGateEnv(['--worktree'], { [declared]: '1' })
  assert.equal(r.code, 0, `按注册表声明的 ${declared}=1 应能跳过, 实得 exit ${r.code}:\n${r.out.slice(-400)}`)
  assert.match(r.out, /⏭/, '跳过时必须说明它跳过了, 不能静默 exit 0(否则与"判绿"不可区分)')
})

test('旧的 _GUARD 名字仍可用(向后兼容:建门起的变量名不能因为修新名而失效)', () => {
  const r = runGateEnv(['--worktree'], { HUSKY_SKIP_FIXTURE_TMPDIR_GUARD: '1' })
  assert.equal(r.code, 0, `旧名 HUSKY_SKIP_FIXTURE_TMPDIR_GUARD=1 仍应能跳过:\n${r.out.slice(-400)}`)
})

test('两个名字都未设时不得进入跳过分支(防"恒真"的跳过判据)', () => {
  // 反向防线: 跳过必须由环境变量驱动, 不是无脑 exit 0。
  // ⚠️ 第一版写的是 `assert.notEqual(code, 0)` —— **我自己写错了**:
  // 该门 `--self-test` 全绿时 exit 本来就是 0, 于是这条断言恒红。
  // 改判据为看**输出内容**: 跳过分支会打 `⏭`, 真跑自检会打 "self-test 全绿"。
  // **exit 码在这个门上区分不了"跑了"与"跳过了", 只能看输��。**
  const r = runGateEnv(['--self-test'], { HUSKY_SKIP_FIXTURE_TMPDIR: '', HUSKY_SKIP_FIXTURE_TMPDIR_GUARD: '' })
  assert.doesNotMatch(r.out, /⏭/, '未设跳过变量时不得进入跳过分支 —— 跳过判据恒真')
  assert.match(r.out, /self-test/, '未设跳过变量时应真的跑出自检(输出里应有 self-test 结论)')
})

function runGateReal(args) {
  return execFileSync(process.execPath, [GATE, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 1 << 26,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
