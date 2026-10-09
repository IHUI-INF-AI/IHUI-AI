// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(G-286 票一):scripts/check-scratch-root-no-nesting.mjs
//
// §22c:判据一律直接 import 源门的 `__test__`,**不在测试里复制第二份判据**(镜像常量漂移
// 就是"测试只复读实现 ⇒ 它是复读机")。本文件里唯一自写的东西是**源码形状锁** ——
// 那类锁防的正是"函数在、但没人调 / 判据被顺手放宽",行为断言覆盖不到它。
//
// 四条锁各自的理由:
//  L1 三态恒不判红(退出码恒 0):票面硬要求。它是**函数行为**,所以既喂构造面,
//     也端到端跑一次 CLI 取真实退出码(不经管道 —— `| tail` 拿到的是 tail 的码,
//     那是本仓 §"取证包装器"记过的假绿来源)。
//  L2 判定路径零写盘:取 `scanScratchRoot`/`decide`/`formatLines`/`measure` 四个函数体
//     按大括号配对扒出来,逐个断言不含写/删调用。"整份文件里不许出现 rmSync"会把
//     --self-test 的夹具回收一起禁掉,那是把工具做废;只禁判定路径才是票面的意思。
//  L3 不穿重解析点(§26 junction 穿透清空同型):判据里必须有 isSymbolicLink 闸,
//     并且端到端造一个 junction 指向二阶树,断言它**不被计入发现**。
//  L4 单一实现:"什么算二阶"只许住在 scratch-dir 那份 countScratchSegments 里,
//     本门不得再抄一遍名字比较。

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
import {
  SCRATCH_DIR_NAME,
  countScratchSegments,
  mkScratch,
  rmScratch,
} from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-scratch-root-no-nesting.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE_PATH = resolve(HERE, '..', 'check-scratch-root-no-nesting.mjs')
const RAW = readFileSync(GATE_PATH, 'utf8')
/**
 * 两层遮噪,方向**不同**,别混用(守门 118 / 134 各记过一次:混用 Either 让锁恒真或恒假):
 *  · CODE      = 注释与字符串都抹 —— 判"有没有某种**调用**"用它:字符串里写着 rmSync
 *    不算调用,模板串里的说明文字也不该把锁顶红。
 *  · CODE_LINES = 只丢注释行、**保留字符串** —— 判"import 说明符 / 字面量比较"用它:
 *    模块说明符本身就是字符串,连字符串一起抹会让这条锁对它立项要防的那一型直接失明
 *    (守门 118 头注写的正是这一条)。
 */
const CODE = maskCommentsAndStrings(RAW)
const CODE_LINES = RAW.split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join('\n')

/**
 * 按大括号配对扒函数体(含 `export function name(` 与裸 `function name(` 两种写法)。
 *
 * ⚠ 这条解析器本身踩过一次,而且踩法是**最坏的那种**:第一版直接取"匹配名之后的第一个 {",
 * 而本仓多个函数签名带默认参数(`scanScratchRoot(root, opts = {})`、`measure(dir, {…} = {})`)
 * ⇒ 取到的是那个 `{}` 空对象字面量,扒出来的"函数体"是空的 ⇒ 所有基于它的断言**恒真**。
 * L3 恰好因为断言的是"必须含 isSymbolicLink"才翻红现形(L2 那几条"不得含写调用"则一路假绿)。
 * 所以:先跳过参数括号表(只配圆括号,默认参数里的花括号不参与),再配大括号;
 * 并且**扒出来的体太短就当场报错** —— 空体不是"没违规",是"这条锁没牙"。
 */
function extractFnBody(src, name, { minBody = 60 } = {}) {
  const re = new RegExp(`(?:export\\s+)?function\\s+${name}\\s*\\(`)
  const m = re.exec(src)
  assert.ok(m, `源码里找不到函数 ${name} —— 它被改名/摘线了,这条锁就该红`)
  let i = src.indexOf('(', m.index)
  assert.ok(i >= 0, `${name} 的参数表起点找不到`)
  let pd = 0
  for (; i < src.length; i++) {
    const ch = src[i]
    if (ch === '(') pd += 1
    else if (ch === ')') {
      pd -= 1
      if (pd === 0) {
        i += 1
        break
      }
    }
  }
  const start = src.indexOf('{', i)
  assert.ok(start >= 0, `${name} 没有函数体`)
  let depth = 0
  for (let k = start; k < src.length; k++) {
    if (src[k] === '{') depth += 1
    else if (src[k] === '}') {
      depth -= 1
      if (depth === 0) {
        const body = src.slice(start, k + 1)
        assert.ok(
          body.length >= minBody,
          `${name} 扒出来的体只有 ${body.length} 字符 ⇒ 提取式没牙(空体等于断言恒真),先修这条锁`,
        )
        return body
      }
    }
  }
  assert.fail(`${name} 的函数体括号没配平 —— 本锁的解析器需要跟进真形态`)
}

function runGate(args) {
  const r = spawnSync(process.execPath, [GATE_PATH, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

/* ───────────────────────── L1 三态 × 退出码恒 0(构造面)───────────────────────── */

const mkRes = (over = {}) => ({
  root: 'R',
  rootExists: true,
  rootIsDir: true,
  findings: [],
  scannedEntries: 10,
  truncated: false,
  unreadable: [],
  skippedReparse: 0,
  maxDepth: gate.DEFAULT_MAX_DEPTH,
  budget: gate.DEFAULT_BUDGET,
  ...over,
})

test('decide:三态各自成立,且互不并桶', () => {
  assert.equal(gate.decide(mkRes()), 'ok')
  assert.equal(gate.decide(mkRes({ findings: [{ kind: 'N1', path: 'x' }] })), 'drift')
  assert.equal(gate.decide(mkRes({ truncated: true })), 'undetermined')
  assert.equal(gate.decide(mkRes({ unreadable: ['p :: EACCES'] })), 'undetermined')
  assert.equal(gate.decide(mkRes({ rootExists: false })), 'undetermined')
  // 反向对照:根不在时,即使"什么都没发现"也**不得**记成 ok(把没问写成判过了)
  assert.notEqual(gate.decide(mkRes({ rootExists: false, scannedEntries: 0 })), 'ok')
})

test('decide:发现 drift 时不因 truncated 降级,但未完备必须另行报出', () => {
  const r = mkRes({ findings: [{ kind: 'N2', path: 'p' }], truncated: true })
  assert.equal(gate.decide(r), 'drift')
  const text = gate.formatLines(r, 'drift').join('\n')
  assert.match(text, /下界|未判完/, '已发现 + 没扫完时,报告必须同时说这两件事')
})

test('L1:退出码恒 0 —— ok / drift / undetermined 三种都不判红(票面硬要求)', () => {
  for (const s of ['ok', 'drift', 'undetermined']) assert.equal(gate.exitCodeFor(s), 0, s)
  // 形状锁:exitCodeFor 的函数体里不得出现 return 1 / return 2 ——
  // "顺手升档成 blocking"必须由这条挡下,而不是靠下一个人记得票面怎么写的。
  // (这个函数本来就只有两行,minBody 按它的真实尺寸给,而不是套默认值把它挡掉。)
  const body = extractFnBody(CODE, 'exitCodeFor', { minBody: 10 })
  assert.doesNotMatch(body, /return\s+[12]\b/, 'exitCodeFor 只许恒 0')
})

/* ───────────────────────── L2 判定路径零写盘 ───────────────────────── */

test('L2:判定路径四个函数体里不得有任何写盘/删除调用(本工具绝不删)', () => {
  const teeth = {
    scanScratchRoot: /readdirSync/,
    measure: /lstatSync/,
    decide: /rootExists/,
    formatLines: /out\.push/,
  }
  for (const fn of ['scanScratchRoot', 'decide', 'formatLines', 'measure', 'exitCodeFor']) {
    const body = extractFnBody(CODE, fn, { minBody: fn === 'exitCodeFor' ? 10 : 60 })
    if (teeth[fn]) assert.match(body, teeth[fn], `${fn} 的体没扒到实质内容 ⇒ 这条锁没牙`)
    gate.WRITE_CALL_RE.lastIndex = 0
    const hit = gate.WRITE_CALL_RE.exec(body)
    assert.equal(hit, null, `${fn} 里出现了写/删调用:${hit && hit[0]} —— 只读门不得动盘`)
  }
})

test('L2b:main 的判定分支(非 --self-test)不得走任何写盘路径', () => {
  const body = extractFnBody(CODE, 'main')
  gate.WRITE_CALL_RE.lastIndex = 0
  assert.equal(gate.WRITE_CALL_RE.exec(body), null, 'main 里不得直接写盘')
  // 并且 selfTest 只能由 --self-test 旗进入(否则提交链上每跑一次就造一次现场)。
  // 这条判的是**字面量**,所以必须走"保留字符串"的那一面(见文件头两层遮噪的说明)。
  const bodyRaw = extractFnBody(CODE_LINES, 'main')
  assert.match(bodyRaw, /if\s*\(argv\.includes\('--self-test'\)\)/, '--self-test 必须是唯一入口')
})

/* ───────────────────────── L3 有界 + 不穿重解析点 ───────────────────────── */

test('L3:scanScratchRoot 必须同时有重解析点闸与深度/预算闸(递归纪律的三条都在)', () => {
  const body = extractFnBody(CODE, 'scanScratchRoot')
  // 提取式自己的有牙证明:没有这条,"扒到空对象 ⇒ 三条断言恒真"就是又一台假绿的锁
  // (本文件头注记的那次踩法正是这一型)。
  assert.match(body, /readdirSync/, '提取式必须真取到函数体,而不是默认参数那个 {}')
  assert.match(body, /isSymbolicLink/, '判递归先判重解析点(§26)')
  assert.match(body, /maxDepth/, '没有深度上限 ⇒ 嵌套可以无限深下去')
  assert.match(body, /truncated\s*=\s*true/, '预算耗尽必须置 truncated,不得静默少扫')
})

test('L3 端到端:junction 指向二阶树时**不得**被穿透计入发现', (t) => {
  const fix = mkScratch('g286-link-')
  const targetParent = join(fix, 'elsewhere')
  const nested = join(targetParent, 'DevEnv', 'Temp', SCRATCH_DIR_NAME)
  let made = false
  try {
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(nested, 'keep.txt'), 'x\n')
    try {
      symlinkSync(join(fix, 'elsewhere'), join(fix, 'DevEnv'), 'junction')
      made = true
    } catch (e) {
      // 建不了链接就是**这台机测不到这一维**,必须点名跳过,不得退化成"没有链接所以通过"
      t.skip(`无法创建 junction(${e.code || e.message})⇒ 重解析点这一维在本机未判定,不计为通过`)
      return
    }
    const r = runGate(['--root', fix, '--json'])
    assert.equal(r.code, 0)
    const j = JSON.parse(r.out)
    // 链接本身被跳过(不穿透),但它指向的真实树在 `elsewhere/DevEnv/...` 这一支仍应被看到:
    // 判据不能因为"有一条链接"就把整族放过 —— 那会把 L3 变成一台可以被绕过的门。
    assert.ok(
      j.findings.some((f) => f.kind === 'N1'),
      '真实落点里的二阶 scratch 根必须被点名',
    )
    assert.ok(
      j.findings.every((f) => !/[\\/]DevEnv$/.test(f.path) || f.kind === 'N1') ||
        !j.findings.some((f) => f.path === join(fix, 'DevEnv')),
      'N2 不得把 junction 当成落点根(穿透判定 = §26 那一型)',
    )
    assert.ok(j.skippedReparse >= 1, '跳过重解析点必须计数并可见,不得静默')
  } finally {
    if (made) {
      try {
        rmSync(join(fix, 'DevEnv'), { force: true })
      } catch {}
    }
    try {
      rmSync(join(fix, 'elsewhere'), { recursive: true, force: true })
    } catch {}
    try {
      rmScratch(fix)
    } catch (e) {
      assert.fail(`夹具未能回收(删除侧守卫拦住了自检自己的现场?):${e.message}`)
    }
  }
})

/* ───────────────────────── L4 单一实现与取材纪律 ───────────────────────── */

test('L4:"什么算二阶"只许有一份实现 —— 本门引 lib 的常量与谓词,不得再抄名字比较', () => {
  // 说明符与字面量比较都在"保留字符串"那一面上判(抹了字符串就等于没判,见文件头)。
  assert.match(CODE_LINES, /from '\.\/lib\/scratch-dir\.mjs'/)
  assert.match(CODE_LINES, /import \{[^}]*SCRATCH_DIR_NAME[^}]*\} from/)
  assert.match(CODE_LINES, /countScratchSegments\(/)
  // 第二份定义长这样:`=== 'ihui-scratch'`。头注里出现这个名字不算(它不带 ===),
  // 所以这条只判比较形态,不判"源码里有没有出现过这个名字"。
  assert.doesNotMatch(CODE_LINES, /===?\s*['"]ihui-scratch['"]/)
  assert.doesNotMatch(CODE_LINES, /['"]DevEnv['"]\s*===?/)
})

test('L5:ROOT 由脚本自身位置推导,禁止 process.cwd() 定根(守门 70 的镜像 13/14 恒红那一型)', () => {
  assert.doesNotMatch(CODE, /process\.cwd\(\)/)
  assert.match(CODE, /fileURLToPath\(import\.meta\.url\)/)
  assert.ok(dirname(gate.ROOT).length > 1, 'ROOT 应指向仓根而不是夹具/临时根')
})

test('L6:本门自己的夹具走 mkScratch,不得绕过落点(§26 唯一落点 —— 它判的正是这一条)', () => {
  assert.match(CODE, /mkScratch\(/)
  assert.doesNotMatch(CODE, /mkdtempSync\(/)
  assert.doesNotMatch(CODE, /tmpdir\(/)
})

/* ───────────────────────── 端到端:三态各有真读数 ───────────────────────── */

test('端到端:注入二阶形态 ⇒ drift 且逐条点名;抹掉 ⇒ ok;根不在 ⇒ undetermined;三者退出码都是 0', () => {
  const fix = mkScratch('g286-e2e-')
  try {
    const a = runGate(['--root', fix])
    assert.equal(a.code, 0, a.out)
    assert.match(a.out, /结论:ok/)

    const nested = join(fix, 'DevEnv', 'Temp', SCRATCH_DIR_NAME, 'victim')
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(nested, 'keep.txt'), '别人的现场\n')
    const b = runGate(['--root', fix])
    assert.equal(b.code, 0, '发现二阶落点也**不得**改退出码(只告警)')
    assert.match(b.out, /结论:drift/)
    assert.match(b.out, /N1/, '二阶 scratch 根必须按型点名')
    assert.match(b.out, /N2/, '二阶盘级落点必须按型点名')
    assert.ok(
      b.out.replace(/\\/g, '/').includes(join(fix, 'DevEnv').replace(/\\/g, '/')),
      '必须报到具体路径',
    )

    // 只读半边:跑完判据之后,被点名的现场必须原样在盘上
    assert.ok(
      existsSync(join(nested, 'keep.txt')),
      '判据把被点名的现场删了 ⇒ 它就是票面禁止的那一步',
    )

    rmSync(join(fix, 'DevEnv'), { recursive: true, force: true })
    const c = runGate(['--root', fix])
    assert.equal(c.code, 0)
    assert.match(c.out, /结论:ok/, '形态抹掉后必须立刻回到 ok(判据认形态不认历史)')

    const d = runGate(['--root', join(fix, 'definitely-not-here')])
    assert.equal(d.code, 0, 'undetermined 同样不改退出码')
    assert.match(d.out, /结论:undetermined/)
    assert.match(d.out, /未判定/)
  } finally {
    try {
      rmScratch(fix)
    } catch (e) {
      assert.fail(`夹具未能回收:${e.message}`)
    }
  }
})

test('端到端:预算闸真的会落下 —— 极小预算把有内容的树判成 undetermined 而不是 ok', () => {
  const fix = mkScratch('g286-budget-')
  try {
    mkdirSync(join(fix, 'a', 'b'), { recursive: true })
    writeFileSync(join(fix, 'a', 'b', 'f.txt'), 'x\n')
    const r = runGate(['--root', fix, '--budget', '1', '--json'])
    assert.equal(r.code, 0)
    const j = JSON.parse(r.out)
    assert.equal(j.state, 'undetermined')
    assert.equal(j.truncated, true)
    assert.ok(countScratchSegments(fix) === 1, '夹具本身只有一层 scratch 段(基准没歪)')
  } finally {
    rmScratch(fix)
  }
})

test('端到端(G-1105304):文件**不吃条目预算** —— 海量文件而无二阶根必须判 ok,不得因预算耗尽停在 undetermined', () => {
  const fix = mkScratch('g286-filebudget-')
  try {
    mkdirSync(join(fix, '夹具甲'), { recursive: true })
    mkdirSync(join(fix, '夹具乙'), { recursive: true })
    // 正常使用量级的夹具:目录很少、文件很多(旧口径下 3795 一级条目 + 派生文件把 20000 预算耗光,
    // 于是这一维恒 undetermined = 零覆盖,而账面看起来"尺子在跑")。
    for (let i = 0; i < 120; i += 1) writeFileSync(join(fix, '夹具甲', `f${i}.txt`), 'x\n')
    const r = runGate(['--root', fix, '--budget', '50', '--json'])
    assert.equal(r.code, 0)
    const j = JSON.parse(r.out)
    assert.equal(j.truncated, false, '文件不得计入预算:只有 2 个目录的树,预算 50 必须扫得完')
    assert.equal(j.state, 'ok', `应为 ok,实得 ${String(j.state)}`)
    // 同一份夹具:目录仍然计预算 —— 预算 1 必须把树判成未判定(证明上面那条不是"预算被删掉了")
    const r2 = runGate(['--root', fix, '--budget', '1', '--json'])
    const j2 = JSON.parse(r2.out)
    assert.equal(j2.truncated, true, '目录仍须吃预算,否则预算闸形同废弃')
    assert.equal(j2.state, 'undetermined')
  } finally {
    rmScratch(fix)
  }
})

test('地平线下限锁(G-1105304):DEFAULT_MAX_DEPTH 不得低于真机制所在深度,否则门判 ok 而东西在射程外', () => {
  // 真机制实测在第 3 层(`<夹具>/DevEnv/Temp/ihui-scratch/victim`),取 4 留一层余量。
  // 这条比"跑一次看看"强:把默认值改回 2 时,端到端注入用例仍然绿(它自己的夹具比地平线浅),
  // 而真实机器上的二阶根会静默不可见 —— 只有钉住常量才能拦住"为了跑得快把地平线收窄"。
  const m = CODE.match(/const DEFAULT_MAX_DEPTH\s*=\s*(\d+)/)
  assert.ok(m, '找不到 DEFAULT_MAX_DEPTH 常量(改名了就要同批改本锁,不得让它静默失配)')
  assert.ok(Number(m[1]) >= 3, `地平线必须 ≥3(真机制所在深度),实得 ${String(m[1])}`)
  // 预算也不许退回"只算文件"的旧口径:那会让正常使用量级直接耗尽 ⇒ 恒 undetermined。
  assert.match(CODE, /res\.scannedFiles \+= 1[\s\S]{0,400}?if \(res\.scannedEntries >= budget\)/)
})

test('--json 必须可 parse 且带 state/code/findings(报告口径不能只活在人读面)', () => {
  const fix = mkScratch('g286-json-')
  try {
    const r = runGate(['--root', fix, '--json'])
    assert.equal(r.code, 0, r.out)
    const j = JSON.parse(r.out)
    assert.ok(['ok', 'drift', 'undetermined'].includes(j.state), `未知状态:${j.state}`)
    assert.equal(j.code, 0)
    assert.ok(Array.isArray(j.findings))
    assert.equal(typeof j.maxDepth, 'number')
    assert.equal(typeof j.budget, 'number')
  } finally {
    rmScratch(fix)
  }
})

test('接线现状锁:本门此刻**不在**提交链里(它是告警档;若被接进 runner,这条必须被改而不是被删)', () => {
  const runner = readFileSync(resolve(HERE, '..', 'guardian-runner.mjs'), 'utf8')
  const wired = /check-scratch-root-no-nesting/.test(runner)
  if (!wired) {
    // 主会话负责接线;本票无权改注册表。这条断言的作用是把"没人调度"变成一条会说话的账,
    // 接线之后它自动转成正向检查(不得反过来判红一次就说门坏了)。
    assert.ok(true, '未接线 —— 由主会话按空闲号补注册后此条自动改判方向')
    return
  }
  const entry = extractRegistryEntry(runner, 'check-scratch-root-no-nesting.mjs')
  assert.match(entry, /mode:\s*'warn'/, '告警档门接进提交链必须是 warn,blocking 就是恒红门(§12e)')
})

/** 从 runner 注册表里按大括号配对取出本门那一条(与"取名字前后 N 字符"不同,那会跨进邻门)。 */
function extractRegistryEntry(src, scriptName) {
  const idx = src.indexOf(scriptName)
  assert.ok(idx >= 0)
  const open = src.lastIndexOf('{', idx)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  assert.fail('注册块括号没配平')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
