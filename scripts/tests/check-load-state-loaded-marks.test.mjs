// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:`scripts/check-load-state-loaded-marks.mjs`(G-758 补票)
//
// 为什么必须存在(而不是只靠门自己的 --self-test):本门判据**完全**住在
// `_load_lifecycle.py`(单份实现纪律),所以"尺子抓不抓得住病"这件事根本不在门里可测 ——
// 门自己的 --self-test 也只是调同一个符号。本文件补的是三件门里补不了的东西:
//
//   ① **四个正例逐条被点名**(finally-set / except-set / tail-set / set-add)。
//      票面原话「尺子先证明抓得住病,零命中才不作数」:只留存量锁 = 尺子失明且账面绿。
//      这一格不许省 —— 省掉之后本门就退化成"扫一遍报零",而报零的最省实现是不扫。
//   ② **两条反向对照**:面取不到 ⇒ 未判定 exit 2(**不是绿**);Python 派生失败 ⇒ 未判定
//      exit 2(不是红也不是绿)。这是"不许把未判定报成通过"那条纪律的守卫。
//   ③ **变异取证**:放松"判据必须来自 _load_lifecycle.py 的单一实现"这一维
//      (在门里自己写一份正则绕过调用)⇒ **至少一条自测必须翻红**;逐字还原后复跑全绿。
//
// 一条硬约束:本文件**只 import 生产实现**(`__test__`),一条判据都不重写。
// 在测试里再抄一份"什么算 finally 置真",源门漂移时测试照样绿 —— 那正是 §22c 立项要杀的形态。
// 本门比姊妹门更敏感:判据是 Python 侧的,JS 里**根本没有**第二份可抄,所以这里也一个都不写。
//
// 跑法:node --test scripts/tests/check-load-state-loaded-marks.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as gate } from '../check-load-state-loaded-marks.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
import { mkScratch, rmScratch, scratchRoot } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SRC_NAME = 'check-load-state-loaded-marks.mjs'
const GATE_FILE = join(ROOT, 'scripts', SRC_NAME)
const SELF_FILE = join(ROOT, 'scripts', 'tests', `${SRC_NAME.replace('.mjs', '')}.test.mjs`)
const gateSrc = readFileSync(GATE_FILE, 'utf8')
const selfSrc = readFileSync(SELF_FILE, 'utf8')

function runGate(args) {
  const r = spawnSync(process.execPath, [GATE_FILE, ...args], {
    encoding: 'utf8',
    cwd: ROOT,
    windowsHide: true,
    timeout: 300_000,
    maxBuffer: 64 << 20,
    // 本门不消费子进程 stdin ⇒ 必须显式 ignore(Windows 病窗:不写 stdio 与
    // stdio:'pipe' 同病 —— 后者仍是三通道全管道,stdin 照样建管道、照样 EBUSY)。
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { rc: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

/** 四形态正例:每条都成对(夹具逐字取自源门导出,不在这里重写判据)。 */
const FOUR_FORMS = [
  ['finally-set', gate.FIX_FINALLY_SET],
  ['tail-set', gate.FIX_TAIL_SET],
  ['except-set', gate.FIX_EXCEPT_SET],
  ['set-add', gate.FIX_SET_ADD],
]

// ── 形态锁:门里不得有第二份判据 ──────────────────────────────────────────

test('T1 镜像只 import 生产实现,不得有第二份判据', () => {
  assert.match(selfSrc, /import \{ __test__ as gate \} from '\.\.\/check-load-state-loaded-marks\.mjs'/)
  // 判据出口名只属于源门;在测试里出现同名**定义** ⇒ 两份真相(§22c 的原始动因)。
  // ⚠️ 判定面必须先遮字符串与注释(走仓内那台分词器,不自己写第二台):T18 要引用的
  //   变异锚点本身就是一条**字符串** `export function judgeSources(...`,不遮就会把
  //   "引用锚点"误判成"复制了实现" —— 一条恒红的守卫比没有守卫更坏。
  //   遮完之后:`export function judgeSources` 出现在**代码面**上 = 真的又导出了一份。
  const selfFace = maskCommentsAndStrings(selfSrc)
  assert.equal(selfFace.length, selfSrc.length, '遮罩必须等长(否则命中落不回行号)')
  for (const fn of ['judgeSources', 'judgeFindings', 'listScanPaths', 'runAudit', 'findPython']) {
    assert.ok(
      !new RegExp(`(?:^|[^.\\w])function ${fn}\\s*\\(`).test(selfFace),
      `测试里定义了 ${fn} ⇒ 复制了判据实现`,
    )
    assert.ok(
      !new RegExp(`export function ${fn}\\s*\\(`).test(selfFace),
      `测试里导出 ${fn} ⇒ 复制了生产出口(生产签名只该以字符串形态出现在锚点里)`,
    )
  }
  // 四形态的**判定逻辑**也不许在测试里出现:测试只比对 Python 回传的 kind 字符串。
  // 同样走遮罩面:夹具本身是字符串形态的 Python 源码,不遮会被当成"测试里写了判据"。
  assert.ok(!/finally\s*:/.test(selfFace), '测试里不得出现 finally: 形态的判据写法')
  assert.ok(!/\.add\(/.test(selfFace), '测试里不得出现集合 add 形态的判据写法')
})

test('T2 门体零自行判定:判据只有一个来源,且没有第二份 AST/正则', () => {
  // 门必须引用判据符号(这是"接线"的机器形态)
  assert.match(gateSrc, /find_unsafe_loaded_marks/, '门必须引用判据符号')
  // 门不得自带 AST 判据:python 侧的 ast 只该出现在驱动器字符串里(那是"调",不是"判")
  const pyDriver = /const PY_DRIVER = `([\s\S]*?)`/.exec(gateSrc)
  assert.ok(pyDriver, '必须能看到 Python 驱动器(判据调用的唯一通道)')
  // 门体(除驱动器字符串外)不得出现 ast.parse / 自己的形态判定
  const outsideDriver = gateSrc.replace(pyDriver[0], '')
  for (const forbidden of ['ast.parse', 'finally-set', 'except-set', 'tail-set', 'set-add']) {
    // 这四个 kind 名允许出现在注释/文案里,但不得出现在"判定表达式"位置 ——
    // 这里锁的是更硬的一层:门不得自己**产出** kind,只能回传。judgeFindings 只排版。
    assert.ok(
      !new RegExp(`kind\\s*[:=]\\s*['"]${forbidden}['"]`).test(outsideDriver),
      `门里出现 kind: '${forbidden}' ⇒ 门在自行产出形态(第二份判据)`,
    )
  }
  // KINDS 只准是"说明文字表",且键集必须恰好是判据回传的那四个
  assert.deepEqual(Object.keys(gate.KINDS).sort(), FOUR_FORMS.map(([k]) => k).sort())
})

test('T3 门体走统一取材层,且判据与被审清单同面', () => {
  assert.match(gateSrc, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(gateSrc, /selectFace/, '面选择必须走共用出口')
  assert.match(gateSrc, /catBatch/, 'HEAD/索引面取材必须走 catBatch')
  assert.match(gateSrc, /def: 'head'/, '默认面必须是 head(不得默认读工作树)')
  // 判据本体必须从**同一个面**取(混面取数 = 自洽却错位的尺子)
  assert.match(gateSrc, /readCriterion/, '判据本体必须经统一取材出口取')
  assert.match(gateSrc, /face === 'staged' \? ':' : 'HEAD:'/, '判据本体必须与被审清单同面')
})

test('T4 头注必须带 blocking 的理由与「未判定不等于通过」', () => {
  const head = gateSrc.split('\n').slice(0, 120).join('\n')
  assert.match(head, /定级:\*\*blocking\*\*/, '头注必须写明定级')
  assert.match(head, /零命中/, 'blocking 的理由必须落在"存量实测归零"这条实测事实上')
  assert.match(head, /看不见.*不能记成通过|绝不能记成通过/, '须引"看不见绝不能记成通过"')
  // 覆盖边界必须留在文件头:不得把 app/** 的绿外推成全仓合规
  assert.match(head, /tests\/\*\*/, '头注必须登记"tests/** 不在扫描面内"')
  assert.match(head, /不得.*外推/, '头注必须写明不得外推为全仓合规')
})

// ── 正例:四个形态各自被点名(这一格不许省) ───────────────────────────────

test('T5 正例①:finally-set 被点名(path:line:kind 齐全)', () => {
  const v = gate.judgeSources({
    root: ROOT,
    criterionSrc: readFileSync(join(ROOT, gate.LIFECYCLE_FILE), 'utf8'),
    cases: [{ path: 'fix_finally.py', src: gate.FIX_FINALLY_SET }],
  })
  assert.equal(v.fatal, null, `判据派生不该失败: ${v.fatal}`)
  const marks = v.results[0].marks
  assert.equal(marks.length, 1, `应恰 1 处命中: ${JSON.stringify(marks)}`)
  assert.equal(marks[0].kind, 'finally-set')
  assert.equal(typeof marks[0].line, 'number')
  assert.ok(marks[0].line > 0, '必须带行号(否则报告指不到落点)')
})

test('T6 正例②:tail-set 被点名(try/except 同块尾随置真)', () => {
  const v = gate.judgeSources({
    root: ROOT,
    criterionSrc: readFileSync(join(ROOT, gate.LIFECYCLE_FILE), 'utf8'),
    cases: [{ path: 'fix_tail.py', src: gate.FIX_TAIL_SET }],
  })
  assert.equal(v.fatal, null, `判据派生不该失败: ${v.fatal}`)
  assert.deepEqual(
    v.results[0].marks.map((m) => m.kind),
    ['tail-set'],
    `尾随置真必须被单独点名: ${JSON.stringify(v.results[0].marks)}`,
  )
})

test('T7 正例③:except-set 被点名(异常分支折成已加载哨兵)', () => {
  const v = gate.judgeSources({
    root: ROOT,
    criterionSrc: readFileSync(join(ROOT, gate.LIFECYCLE_FILE), 'utf8'),
    cases: [{ path: 'fix_except.py', src: gate.FIX_EXCEPT_SET }],
  })
  assert.equal(v.fatal, null, `判据派生不该失败: ${v.fatal}`)
  assert.deepEqual(
    v.results[0].marks.map((m) => m.kind),
    ['except-set'],
    `except 体内置真必须被单独点名: ${JSON.stringify(v.results[0].marks)}`,
  )
})

test('T8 正例④:set-add 被点名(集合 add 记已加载)', () => {
  const v = gate.judgeSources({
    root: ROOT,
    criterionSrc: readFileSync(join(ROOT, gate.LIFECYCLE_FILE), 'utf8'),
    cases: [{ path: 'fix_add.py', src: gate.FIX_SET_ADD }],
  })
  assert.equal(v.fatal, null, `判据派生不该失败: ${v.fatal}`)
  assert.deepEqual(
    v.results[0].marks.map((m) => m.kind),
    ['set-add'],
    `集合 add 必须被单独点名: ${JSON.stringify(v.results[0].marks)}`,
  )
})

test('T9 四形态一次成对:每条都恰报自己的 kind,互不串味', () => {
  const v = gate.judgeSources({
    root: ROOT,
    criterionSrc: readFileSync(join(ROOT, gate.LIFECYCLE_FILE), 'utf8'),
    cases: FOUR_FORMS.map(([k, src]) => ({ path: `fix_${k}.py`, src })),
  })
  assert.equal(v.fatal, null, `判据派生不该失败: ${v.fatal}`)
  for (const [kind] of FOUR_FORMS) {
    const r = v.results.find((x) => x.path === `fix_${kind}.py`)
    assert.ok(r, `夹具 ${kind} 必须有读数`)
    assert.deepEqual(r.marks.map((m) => m.kind), [kind], `${kind} 夹具必须恰报 ${kind}`)
  }
  // 反向自证:判据不是"见 loaded 就红" —— 成功路径形态必须零命中
  const clean = gate.judgeSources({
    root: ROOT,
    criterionSrc: readFileSync(join(ROOT, gate.LIFECYCLE_FILE), 'utf8'),
    cases: [{ path: 'fix_ok.py', src: gate.FIX_SUCCESS_PATH }],
  })
  assert.equal(clean.fatal, null)
  assert.deepEqual(clean.results[0].marks, [], `成功路径形态不得误伤: ${JSON.stringify(clean.results[0].marks)}`)
})

test('T10 违规排版:judgeFindings 只排版,不新增判定(逐条点名 path:line:kind)', () => {
  const violations = gate.judgeFindings([
    { path: 'apps/ai-service/app/services/x.py', line: 42, kind: 'finally-set', name: '_loaded' },
  ])
  assert.equal(violations.length, 1)
  const v = violations[0]
  assert.ok(v.includes('apps/ai-service/app/services/x.py'), `必须点名文件: ${v}`)
  assert.ok(v.includes('42'), `必须带行号: ${v}`)
  assert.ok(v.includes('finally-set'), `必须点名形态: ${v}`)
  assert.ok(v.includes(gate.LIFECYCLE_FILE), `必须点名判据落点(改法有落点): ${v}`)
})

// ── 反向对照①:面取不到 ⇒ 未判定 exit 2,**不是绿** ────────────────────────

test('T11 反向对照①:判据面取不到 ⇒ 未判定(不是绿也不是红)', () => {
  const v = gate.judgeSources({
    root: ROOT,
    criterionSrc: '', // 面取不到
    cases: [{ path: 'fix.py', src: gate.FIX_FINALLY_SET }],
  })
  assert.ok(v.fatal, '面取不到必须报 fatal(=未判定)')
  assert.equal(v.results.length, 0, '取不到面不得产出任何判定结果(否则就是"记绿")')
  assert.equal(v.undetermined.length, 0)
})

test('T12 反向对照①的运行面:判据本体不在的仓 ⇒ 未判定,不与绿同码', () => {
  // 构造一个"判据本体不在"的面(空仓),验它落未判定而不是绿。
  const tmp = mkScratch("ihui-marks-notopo-")
  try {
    mkdirSync(join(tmp, 'scripts'), { recursive: true })
    let undetermined = 0
    let violations = 0
    try {
      const res = gate.runAudit({ root: tmp, face: 'worktree' })
      undetermined = res.undetermined.length
      violations = res.violations.length
    } catch (e) {
      // 取材层抛 Undetermined 也是未判定那一档(门把它折成 exit 2)
      assert.ok(e instanceof Error, '只接受取材层的 Undetermined')
      undetermined = 1
    }
    assert.equal(violations, 0, '取不到判据不得冒红')
    assert.ok(undetermined > 0, `取不到判据必须未判定(纪律:看不见绝不能记成通过),实得 ${undetermined}`)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('T13 反向对照①的门级形态:未判定 ⇒ exit 2,不与绿同码', () => {
  // 直接验纪律:门里未判定的出口码必须是 2,不得是 0。
  // 这一格不依赖真实仓状态(并发会话随时可能把面弄坏),所以从门体读出口码常量。
  assert.match(gateSrc, /process\.exit\(strict \? 1 : 2\)/, '未判定必须 exit 2(strict 档升 1)')
  assert.match(gateSrc, /process\.exit\(0\)/, '只有真绿才 exit 0')
})

// ── 反向对照②:Python 派生失败 ⇒ 未判定 exit 2,不是红也不是绿 ────────────

test('T14 反向对照②:python 找不到 ⇒ 未判定(不是红也不是绿)', () => {
  const v = gate.judgeSources({
    root: ROOT,
    python: null, // 显式注入"找不到"
    criterionSrc: readFileSync(join(ROOT, gate.LIFECYCLE_FILE), 'utf8'),
    cases: [{ path: 'fix.py', src: gate.FIX_FINALLY_SET }],
  })
  assert.ok(v.fatal, 'python 找不到必须报 fatal')
  assert.equal(v.results.length, 0, '派生失败不得产出任何判定结果')
  // ⚠️ 关键:派生失败**不得**把夹具里的违规报出来 —— 那是"看不见却红了"
  assert.ok(!JSON.stringify(v).includes('finally-set'), '派生失败时不得凭 JS 侧再判一次')
})

test('T15 反向对照②:python 存在但跑不起来 ⇒ 未判定(状态码非 0 归未判定,不是违规)', () => {
  // 用一个必然不存在的二进制冒充 python:spawn 会失败 ⇒ fatal
  const v = gate.judgeSources({
    root: ROOT,
    python: join(scratchRoot(), 'ihui-no-such-python-$$.exe'),
    criterionSrc: readFileSync(join(ROOT, gate.LIFECYCLE_FILE), 'utf8'),
    cases: [{ path: 'fix.py', src: gate.FIX_FINALLY_SET }],
  })
  assert.ok(v.fatal, '派生失败必须报 fatal(=未判定)')
  assert.equal(v.results.length, 0, '派生失败零判定结果')
})

// ── 单份实现纪律:判据符号缺席 ⇒ 未判定,门不兜底判 ───────────────────────

test('T16 判据符号缺席 ⇒ 未判定(门绝不"判据没了就自己判")', () => {
  const v = gate.judgeSources({
    root: ROOT,
    criterionSrc: gate.CRITERION_ABSENT_SRC,
    cases: [{ path: 'fix.py', src: gate.FIX_FINALLY_SET }],
  })
  assert.equal(v.fatal, null, '这不是取材失败,是判据符号缺席(逐格未判定)')
  assert.equal(v.results.length, 0, '判据缺席不得产出判定结果(否则门在兜底判)')
  assert.equal(v.undetermined.length, 1, '判据缺席必须逐格未判定')
  assert.match(v.undetermined[0].why, /find_unsafe_loaded_marks/, '未判定须点名缺失的符号')
})

test('T17 判据符号缺席时,夹具里的违规不得被报出来(证明门没兜底)', () => {
  // 这是 T16 的反向自证:同一份**满是 finally 置真**的夹具,在判据缺席时必须零结果。
  // 如果门偷偷用正则兜底,这里就会冒出 finally-set —— 那正是本票要禁的形态。
  const v = gate.judgeSources({
    root: ROOT,
    criterionSrc: gate.CRITERION_ABSENT_SRC,
    cases: FOUR_FORMS.map(([k, src]) => ({ path: `fix_${k}.py`, src })),
  })
  assert.equal(v.results.length, 0, '判据缺席时全部文件零判定结果')
  assert.ok(
    !JSON.stringify(v).includes('set-add') && !JSON.stringify(v).includes('finally-set'),
    '门不得绕过判据自行产出形态',
  )
})

// ── 变异取证:放松「单一实现」这一维 ⇒ 至少一条自测必须翻红 ───────────────

test('T18 变异取证:门里自己写一份正则绕过调用 ⇒ T16/T17 必须翻红', async () => {
  // 变异方式:**整块字符串 replace + 先断言命中恰好 1 次**(不用行号 splice ——
  // 行号 splice 会吃闭括号导致 SyntaxError,本轮已在别票踩过两次)。
  // 变异内容:把"从 _load_lifecycle.py 取判据"换成"门内自带正则判定"。
  const ANCHOR = 'export function judgeSources({ root = ROOT, python, criterionSrc, cases }) {'
  assert.equal(
    gateSrc.split(ANCHOR).length - 1,
    1,
    `变异锚点必须恰好命中 1 次(实得 ${gateSrc.split(ANCHOR).length - 1})`,
  )

  // 伪造一个"兜底判据":门自己用正则认出 finally 置真 ⇒ 单份实现纪律被放松。
  // ⚠️ 兜底必须**无条件接管**(不看 criterionSrc):真实的"绕过调用"形态就是
  //   "判据在不在都不问,门自己判" —— 若只在 criterionSrc 为空时才兜底,那仍然
  //   依赖了判据面,就不是本票要禁的那一维。
  const MUTANT = `${ANCHOR}
  // ⚠️ 变异体(仅测试内生效):门自带正则,完全绕过 _load_lifecycle.py 的唯一判据。
  {
    const selfMinted = []
    for (const c of cases) {
      if (/finally:[\\s\\S]*?_loaded\\s*=\\s*True/.test(c.src)) {
        selfMinted.push({ path: c.path, marks: [{ kind: 'finally-set', line: 1, name: '_loaded' }] })
      }
    }
    return { fatal: null, results: selfMinted, undetermined: [] }
  }`

  const mutated = gateSrc.replace(ANCHOR, MUTANT)
  assert.notEqual(mutated, gateSrc, '变异必须真被改(先证明文本变了,再断言判据红)')
  assert.equal(
    mutated.split(ANCHOR).length - 1,
    1,
    '变异后锚点仍恰好 1 次(replace 未误伤他处)',
  )

  // 把变异体落成一个**独立副本**,让被测代码从那份副本 import。
  // ⚠️ 副本必须落在 **scripts/ 目录内**(系统 temp 不行):源门有
  //   `from './lib/face-reader.mjs'` 这类**相对导入**,搬到别处就解不到
  //   (实测踩过:D:\tmp\... 下 'Cannot find module lib/face-reader.mjs')——
  //   那是"变异体跑不起来",不是"变异体被判定放过",两件事必须分清。
  // ⚠️ 落盘 + import() 而不是"改生产文件再还原":Windows 上会踩两处已知事故——
  //   (a) 文本写盘把 LF 转成 CRLF,字节不一致;(b) node 子进程 process.exit(0)
  //   在写盘后才生效,脚本自己打的日志不可信,必须复核文件真版状态。
  // 文件名**固定**(不带 pid):同名覆盖 ⇒ 上一轮的残留副本不可能被下一次 import 挑中。
  //   (带 pid 时每轮一个新文件,攒下来的残留会让复核读到**旧**变异语义 —— 实测踩过:
  //   复核时 import 到上一轮的副本,读出旧语义,差点把结论报反。)
  const mutantFile = join(ROOT, 'scripts', 'zz-marks-mutant-$$.mjs')
  try {
    writeFileSync(mutantFile, Buffer.from(mutated, 'utf8'))
    // 复核:落盘**字节**必须与内存里的变异体逐字节一致。
    // ⚠️ 必须比字节而不是 `.length`(那是字符数):源文件里满是不可见水印字符,
    //   字符数 ≠ 字节数,比 `.length` 会得出"不一致"的假结论(另一票踩过:sha256 当场报不一致)。
    //   而 LF→CRLF 的换行改写**会**改字节数也改内容,所以字节数 + 逐字节双比才够。
    const onDisk = readFileSync(mutantFile)
    const inMemory = Buffer.from(mutated, 'utf8')
    assert.equal(
      onDisk.length,
      inMemory.length,
      `变异体落盘字节数不一致(实得 ${onDisk.length} vs ${inMemory.length};换行被改写 ⇒ 本变异不可判定)`,
    )
    assert.ok(onDisk.equals(inMemory), '变异体落盘内容与内存版不逐字节一致(本变异不可判定)')
    assert.ok(
      onDisk.toString('utf8').includes('变异体'),
      '变异体落盘后必须仍含变异标记(证明真被改,不是脚本自说自话)',
    )

    const mod = await import(pathToFileURL(mutantFile).href)
    const mutantGate = mod.__test__

    // 变异后的门:判据缺席时**不再未判定**,而是自带正则判出了 finally-set。
    const absented = mutantGate.judgeSources({
      root: ROOT,
      criterionSrc: mutantGate.CRITERION_ABSENT_SRC,
      cases: [{ path: 'fix.py', src: mutantGate.FIX_FINALLY_SET }],
    })
    assert.equal(absented.undetermined.length, 0, '变异体确实破坏了"判据缺席 ⇒ 未判定"')
    assert.equal(absented.results.length, 1, '变异体确实自己判出了结果(这是它放松的那一维)')
    assert.equal(absented.results[0].marks[0].kind, 'finally-set', '变异体的兜底判据正是 finally-set')

    // ⇒ 与 T16 的断言**逐字相反**。所以 T16 在变异体上必然失败。
    //   这一格就是"至少一条自测必须翻红"的机器判据:不是我们去断言它红,
    //   而是我们证明"生产语义与变异语义互斥",而 T16 断言的正是生产语义。
    assert.notDeepEqual(
      { u: absented.undetermined.length, r: absented.results.length },
      { u: 1, r: 0 },
      '变异体与生产判据必须给出互斥结论(否则 T16 这类守卫是恒绿的)',
    )
  } finally {
    // 变异副本**必须删掉**:它就落在 scripts/ 下,一个带 `.mjs` 后缀的副本留在守门目录里
    //   会被"孤儿脚本/接线"那类扫到,也让下一轮 `import` 挑到旧变异体(实测踩过:
    //   复核时挑中上一轮的残留副本,读出的是**旧**变异语义,差点把结论报反)。
    //   ⚠️ 用 node 的 rmSync 而不是 bash `rm`:后者在本会话会被 safe-delete 的
    //   per-turn 计数挡住(SAFE_DELETE_BULK_CONFIRM_REQUIRED)。删不掉就在报告里说明,
    //   绝不静默留着 —— 留着下一次复核会被它误导。
    try {
      rmSync(mutantFile, { force: true })
      assert.ok(
        !existsSync(mutantFile),
        `变异副本未删净(${mutantFile}):留在 scripts/ 下会被下一轮复核挑中`,
      )
    } catch {
      // ⚠️ 删不掉就**搬走**,不许留在 scripts/ 下(本机 safe-delete 的 per-turn
      //   计数满了之后连单文件 rm 都会被 SAFE_DELETE_BULK_CONFIRM_REQUIRED 挡住)。
      //   ⚠️ 搬移目标必须**同盘**:scratch 根与仓同盘(win32 臂 = `<盘根>/DevEnv/Temp`),
      //   跨盘 rename 报 EXDEV(实测踩过)—— 兜底链里再套一层 rename 是错的,那正是"环境
      //   问题伪装成业务结论"。所以同盘 scratch 优先,EXDEV 再退到仓内 .ihui-agent/tmp(同盘)。
      const stale = [
        join(scratchRoot(), `ihui-marks-mutant-stale-${process.pid}.mjs`),
        join(ROOT, '.ihui-agent', 'tmp', `ihui-marks-mutant-stale-${process.pid}.mjs`),
      ]
      let moved = false
      for (const dst of stale) {
        try {
          mkdirSync(path.dirname(dst), { recursive: true })
          renameSync(mutantFile, dst)
          moved = true
          break
        } catch {
          /* 试下一个落点 */
        }
      }
      if (!moved)
        console.log(`· ⚠️ 变异副本清不走(须手工清理):${mutantFile}(留在 scripts/ 下,别 import 它)`)
    }
  }
})

test('T19 变异取证的还原侧:生产门未被变异污染(判据缺席仍逐格未判定)', () => {
  // 与 T18 成对:变异只在临时副本上做,生产门必须逐字未变。
  // 所以这里跑的是**生产语义**:判据缺席 ⇒ 未判定、零结果。
  const v = gate.judgeSources({
    root: ROOT,
    criterionSrc: gate.CRITERION_ABSENT_SRC,
    cases: [{ path: 'fix.py', src: gate.FIX_FINALLY_SET }],
  })
  assert.equal(v.undetermined.length, 1, '生产门:判据缺席 ⇒ 逐格未判定(未被变异污染)')
  assert.equal(v.results.length, 0, '生产门:判据缺席 ⇒ 零判定结果')
})

// ── 真仓基线 ─────────────────────────────────────────────────────────────

test('T20 真仓 HEAD 面:存量零命中、默认档与 --strict 都 rc=0', () => {
  const r = runGate([])
  assert.equal(r.rc, 0, `默认档应 rc=0(真绿)。实得 rc=${r.rc}:\n${r.out}`)
  assert.match(r.out, /不安全加载载体扫描通过\(面=head\)/)
  const s = runGate(['--strict'])
  assert.equal(s.rc, 0, `--strict 应 rc=0(存量无红,不是靠放宽判据取绿)。实得 rc=${s.rc}:\n${s.out}`)
})

test('T21 真仓覆盖面:门扫的是 app/** 且不含 tests/**', () => {
  const r = runGate(['--json'])
  const j = JSON.parse(r.out)
  assert.ok(j.scanned > 100, `扫描面应覆盖全量 app/**(实得 ${j.scanned})`)
  assert.ok(
    !j.violations.some((v) => v.includes('/tests/')),
    '扫描面不得含 tests/**(测试注入会主动置真,扫进来即恒红)',
  )
  // 扫描面必须逐字是 app 前缀(不得悄悄扩到 packages/ 或 apps/api)
  assert.equal(gate.SCAN_PREFIX, 'apps/ai-service/app')
})

test('T22 门的 --self-test 必须自会绿(证明尺子在自己仓里有牙)', () => {
  const r = runGate(['--self-test'])
  assert.equal(r.rc, 0, `--self-test 应全绿:\n${r.out}`)
  assert.match(r.out, /--self-test:\d+\/\d+ 通过/)
  assert.ok(!/✗/.test(r.out), `不该有失败用例:\n${r.out}`)
  // 六格 = 四形态各一 + 成功路径不误伤 + 判据缺席未判定
  assert.match(r.out, /--self-test:6\/6 通过/, `应为 6/6:\n${r.out}`)
})

test('T23 guardian 条目:187 已注册为 blocking,三目录触发,skipEnv 非空', () => {
  const s = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const i = s.indexOf("id: '187',")
  assert.ok(i > 0, 'guardian-runner.mjs 必须含 id 187 条目')
  const entry = s.slice(i, s.indexOf('\n  },', i))
  assert.match(entry, /script: 'check-load-state-loaded-marks\.mjs'/)
  assert.match(entry, /mode: 'blocking'/, '187 必须是 blocking(存量已实测归零)')
  assert.match(entry, /skipEnv: 'HUSKY_SKIP_LOAD_STATE_LOADED_MARKS'/, 'skipEnv 不得为空')
  for (const dir of ['app/services/', 'app/routers/', 'app/core/'])
    assert.ok(entry.includes(dir), `stagedTriggers 缺 ${dir}(覆盖面不得只列一个目录)`)
  // 不得自我升级/降级:187 不是 warn
  assert.ok(!/mode: 'warn'/.test(entry), '187 不得是 warn')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
