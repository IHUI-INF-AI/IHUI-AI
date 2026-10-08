// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-redundant-discriminator-predicate.mjs`(台账 G-790 的只读量算尺子)。
 *
 * 判据一律 **import 门体导出的 `__test__`**,测试里不得再抄一份(§22c:镜像只复读实现就是复读机)。
 * 本文件因此同时是这把尺子**能不能被 import** 的阳性证明 —— 门体若有裸顶层 `main()`,
 * 这句 import 就会把整份清单打印拖进测试进程(T0 专门钉这一格,并拿独立子进程复验)。
 *
 * 锁清单
 *  T0  import 门体不得触发 CLI(§22d 的立身之本);
 *  T1  形状锁:测试不得声明第二份判据,`__test__` 必须真导出各判据;
 *  T2  四态成对(本尺子的全部价值在这一条):**同谓词带独立判别列 ⇒ 放过** 对 **只有 JSON 过滤 ⇒ 命中**;
 *  T3  放过的三个子档(equality / presence / inherited)与"不适用"的三档(投影 / CASE 分档 / 正则字面量)
 *      各自可达 —— 子档不是装饰:developer-relay 的 `IS NOT NULL` 那一档认错就会把合规站点记成债;
 *  T4  **未判定不得折成放过**(§「把没判写成判过了」):集合声明取不到 / 说明性字符串没有执行入口 /
 *      正文根本取不到 / 超大文件整文件不判 —— 四种都要点名,且都不许产出 pass;
 *  T5  逐字取自真实文件(§22c 红线:镜像夹具全部自造 ⇒ 它只证明"实现自洽",不证明"看得见仓库"):
 *      从被审面拿到的站点行必须逐字出现在该文件的 HEAD blob 里,且重跑判据必须复现同一档;
 *  T6  Python 面 ⇒ 整族未判定(构造面 + 真仓面各一次),**不得**被记成放过或不适用;
 *  T7  取材面形状锁(守门 118 的半接线型):门体必须引 `scripts/lib/face-reader.mjs` 的 `catBatch`
 *      读正文,且**不得**出现 `readFileSync` / `execSync` / `spawnSync` / `process.cwd()` / 自派生 `git show`;
 *      判据面走"剥注释、保留字符串"那一台遮罩 —— 门体头注本来就要逐字写出这些词来解释禁令,
 *      不剥注释就是门把自己立项的那一型判成违规(守门 70/131 同课);有牙证明用合成面(T7c)。
 *  T8  装车证明:本尺子**刻意不在提交链** ⇒ 它自己在提交链上跑不得被读成"未接线"(反向),而
 *      `scripts/guardian-runner.mjs` 的 **HEAD 面**必须查不到它 —— 接线属人工裁决,不由测试默认放行;
 *  T9  三面口径(CLI 真退出码):两面旗同给 ⇒ 2;缺省档判 HEAD ⇒ 0;`--strict` 有未判定 ⇒ 2;
 *      `--root` 缺实参 ⇒ 2。**命中再多也不改退出码**这一条同时在 T9 与 T11 各钉一次;
 *  T10 临时 git 仓端到端:**索引里有、HEAD 里没有**的承载文件 ⇒ HEAD 档看不见、`--staged` 档必须点名
 *      (证明"清单与内容同面"不是措辞);只写在磁盘上不 add ⇒ 只有 worktree 档看见;
 *  T11 空枚举判死 + 三态不并桶(纯函数出口 `enumerationVerdict` / `exitCodeOf` / `tally`);
 *  T12 门体自检必须全绿且例数不得掉(构造面证据变薄 = 下一次改动没有尺子接着);
 *  T13 覆盖面自证的排除清单不得腐烂成第二份真相(`OUT_OF_SCOPE` 由门导出的那份判据消费)。
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
import { maskComments } from '../lib/code-mask.mjs'
import { __test__ as gate } from '../check-redundant-discriminator-predicate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-redundant-discriminator-predicate.mjs')
const RUNNER_REV = 'HEAD:scripts/guardian-runner.mjs'
const SELF = 'check-redundant-discriminator-predicate.mjs'
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

function createRepo() {
  const root = mkScratch('ihui-redundant-discriminator-')
  gitIn(root, ['init', '--quiet', '--initial-branch=main'])
  gitIn(root, ['config', 'user.email', 'gate-test@example.invalid'])
  gitIn(root, ['config', 'user.name', 'gate-test'])
  return root
}

function putFile(root, rel, text, { add = false, commit = false } = {}) {
  const abs = join(root, ...rel.split('/'))
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
  if (add || commit) gitIn(root, ['add', '--', rel])
  if (commit) gitIn(root, ['commit', '--quiet', '-m', `test: ${rel}`])
}

/** 真仓 HEAD 面只跑一次(analyze 是全仓枚举,每多跑一次就慢十几秒),各用例复用同一份结果。 */
let REAL = null
function realFace() {
  if (!REAL) REAL = gate.analyze({ face: 'head' })
  return REAL
}

const J = (src, rel = 'a.ts') => gate.judgeSource(rel, src)
const st = (src, rel) => J(src, rel).sites.map((s) => s.state)
const ks = (src, rel) => J(src, rel).sites.map((s) => `${s.state}:${s.kind}`)
const passes = (src, rel) => J(src, rel).sites.filter((s) => s.state === 'pass')

test('T0 import 门体不得触发 CLI 主流程(§22d 的立身之本)', () => {
  // "没炸"不能靠本文件自己没炸来断言:再拿一个独立子进程 import 门体并打哨兵。
  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(GATE).href)});console.log('__IMPORTED__')`],
    { cwd: REPO, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
  )
  const out = clean(r.stdout)
  assert.match(out, /__IMPORTED__/, `import 门体失败:${out}${clean(r.stderr)}`)
  assert.doesNotMatch(out, /判定面=|─ 命中\(|redundant-discriminator/, 'import 门体就打印了尺子的读数 ⇒ 顶层裸 main() 回来了,§22c 的通道又断了')
})

test('T1 形状锁:测试不得重写判据,__test__ 必须真导出各判据', () => {
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.match(src, /import \{ __test__ as gate \} from '\.\.\/check-redundant-discriminator-predicate\.mjs'/, '§22c 锚点')
  const REQUIRED = [
    'judgeSource', 'classifyProbeSite', 'columnConditionsIn', 'buildUnit', 'measureAux', 'tally',
    'enumerationVerdict', 'exitCodeOf', 'analyze', 'listInScope', 'listProbeBearing', 'readFace',
    'judgeFace', 'structFace', 'leftColumnOf', 'inScope', 'testFaceOf', 'coverageGapOf', 'selfTest',
  ]
  for (const name of REQUIRED) {
    assert.equal(typeof gate[name], 'function', `__test__ 缺导出 ${name} ⇒ 测试只能另抄一份判据`)
    assert.ok(
      !new RegExp(`^(?:export\\s+)?(?:async\\s+)?function ${name}\\s*\\(`, 'm').test(src),
      `测试里出现了第二份 ${name} ⇒ 镜像从防线变成漂移的掩体(§22c 红线)`,
    )
  }
  // 判据输入一律来自门体,不在测试里抄第二份形态清单(守门 191 的 F2 型)。
  for (const key of ['PROBE_SHAPES', 'OUT_OF_SCOPE', 'SCOPE_DIRS', 'FX']) {
    assert.ok(Array.isArray(gate[key]) || (typeof gate[key] === 'object' && gate[key] !== null), `__test__ 缺导出 ${key}`)
    assert.ok(!new RegExp(`^const ${key}\\s*=`, 'm').test(src), `测试里声明了第二份 ${key}`)
  }
})

test('T2 四态成对(核心):同谓词带独立判别列 ⇒ 放过 / 只有 JSON 过滤 ⇒ 命中', () => {
  const hit = J(gate.FX.only)
  assert.ok(hit.sites.some((s) => s.state === 'hit'), `只有 JSON 过滤必须命中:${JSON.stringify(hit.sites)}`)
  assert.equal(hit.sites.filter((s) => s.state === 'pass').length, 0, '同一构造面不得同时产出放过')
  const pass = J(gate.FX.type)
  assert.ok(pass.sites.some((s) => s.state === 'pass'), `正确写法必须认得出(否则合规站点被报成债):${JSON.stringify(pass.sites)}`)
  assert.ok(!st(gate.FX.type).includes('hit'), '带判别列的那一型不得再被判成命中')
  // 独立列必须逐条带上原文交人读 —— "那一列是不是该类别的判别列"不由本尺裁定
  const withCond = pass.sites.find((s) => s.state === 'pass')
  assert.ok(Array.isArray(withCond.conditions) && withCond.conditions.length > 0, JSON.stringify(withCond))
  assert.ok(withCond.conditions.some((c) => /type/.test(c.column)), JSON.stringify(withCond.conditions))
  // 反证:范围/模糊比较不缩小"行族类别" ⇒ 不算独立列(gte 那一型必须仍是命中)
  assert.ok(st(gate.FX.range).includes('hit'), 'gte 不得被当成独立判别列')
  // 反证:探测列自身的 jsonb_typeof 表达式不得被当成独立列(同一列换个写法蒙过去 = 白放)
  assert.ok(st(gate.FX.same).includes('hit'), '同列的 jsonb_typeof 不得算独立列')
})

test('T3 放过子档与"不适用"各档可达(认错子档 = 把合规站点记成债或反之)', () => {
  assert.ok(ks(gate.FX.nn).includes('pass:presence'), '只有 IS NOT NULL 的那一档必须落 presence(developer-relay 同型)')
  assert.ok(ks(gate.FX.type).includes('pass:equality'), '等值独立列必须落 equality')
  assert.ok(ks(gate.FX.agg).includes('pass:inherited'), '聚合内 FILTER(WHERE) 的行集继承自同条 WHERE ⇒ inherited')
  assert.ok(st(gate.FX.proj).includes('not-applicable'), '投影/聚合里的取用不筛行 ⇒ 不适用')
  assert.ok(st(gate.FX.case).includes('not-applicable'), 'CASE…END 分档取数 ⇒ 不适用(票面点名的区分)')
  assert.ok(ks(gate.FX.regex).includes('not-applicable:regex-literal'), '正则字面量体内的 ->> 图形 ⇒ 不适用')
  assert.ok(st(gate.FX.decl).includes('pass'), '集合声明里有判别列 ⇒ 整条谓词算放过(按 clause 切会把一条谓词拆两半)')
})

test('T4 未判定不得折成放过(把没判写成判过了 = 本仓最高频失效型)', () => {
  for (const [name, src, rel] of [
    ['集合声明取不到', gate.FX.nodecl, 'a.ts'],
    ['字符串里的 SQL 没有执行入口', gate.FX.noExec, 'a.ts'],
    ['正文取不到', null, 'a.ts'],
    ['超大文件整文件不判', 'z'.repeat(gate.MAX_FILE_CHARS + 10), 'a.ts'],
  ]) {
    const j = J(src, rel)
    assert.ok(j.sites.some((s) => s.state === 'undetermined'), `${name} 必须落未判定:${JSON.stringify(j.sites)}`)
    assert.equal(j.sites.filter((s) => s.state === 'pass').length, 0, `${name} 不得产出放过(没判 ≠ 判过)`)
    assert.equal(j.sites.filter((s) => s.state === 'not-applicable').length, 0, `${name} 不得被折成"不适用"`)
  }
  // 注释里逐字写出的 SQL 叙述不得被算成命中(门不得给自己发合格证),但也不得被算成放过
  const c = J(gate.FX.comment)
  assert.ok(!st(gate.FX.comment).includes('hit'), `注释里的 ->> 不得被当站点:${JSON.stringify(c.sites)}`)
  // @> 那一族必须真的被探测到且列名取得出(漏掉主形态 = 尺子对自己立项那一型失明)
  assert.ok(J(gate.FX.contains).sites.some((x) => x.shape === 'jsonb 包含 @>' && x.column === 't.events'), JSON.stringify(J(gate.FX.contains).sites))
  assert.equal(gate.leftColumnOf('sql`${llmCallLogs.metadata}->>\'byokMode\'`', 26), 'llmCallLogs.metadata', '${} 插值左侧的列名必须回取得出')
})

test('T5 逐字取自真实文件(§22c:夹具全自造 ⇒ 只证明实现自洽,不证明看得见仓库)', () => {
  const A = realFace()
  const hit = A.tally.sites.find((s) => s.state === 'hit')
  const pass = A.tally.sites.find((s) => s.state === 'pass' && s.kind === 'equality')
  assert.ok(hit, '真仓 HEAD 面一处命中都量不出 ⇒ 尺子对这一族失明(看不见存量不算通过,不得读成"已清完");若这一族确已清偿,把这条锁改成"该档由构造面可达"并留出处,而不是删掉它')
  assert.ok(pass, '真仓 HEAD 面一处 equality 放过都量不出 ⇒ 尺子认不出正确写法,那才是真危险(它会把每个合规站点都报成债)')
  for (const site of [hit, pass]) {
    const spec = `HEAD:${site.rel}`
    const blob = catBatch(REPO, [spec]).get(spec)
    assert.equal(typeof blob, 'string', `${site.rel} 的 HEAD blob 取不到 ⇒ 无法判定(不回落磁盘那一面)`)
    const raw = String(blob).split(/\r?\n/)[site.line - 1] ?? ''
    assert.ok(site.text === '' || raw.includes(site.text), `报告行不是逐字取自被审面(第 ${site.line} 行):${JSON.stringify(raw)} VS ${JSON.stringify(site.text)}`)
    const again = gate.judgeSource(site.rel, blob)
    assert.ok(
      again.sites.some((x) => x.line === site.line && x.state === site.state),
      `同一份正文重跑判据必须复现同一档(${site.rel}:${site.line} 期望 ${site.state}):${JSON.stringify(again.sites.filter((x) => x.line === site.line))}`,
    )
  }
  // 汇总行必须把四态分开印(不得把未判定并进放过)
  const line = gate.summaryLine(A)
  assert.match(line, /命中 \d+ \/ 放过 \d+\(equality \d+ · presence \d+ · inherited \d+\) \/ 未判定 \d+ \/ 不适用 \d+/, line)
})

test('T6 Python 面 ⇒ 整族未判定,不得被记成放过或不适用', () => {
  const py = J(gate.FX.py, 'a.py')
  assert.ok(py.sites.length > 0, 'Python 面必须逐条点名(一条都不产出就是静默)')
  assert.ok(py.sites.every((s) => s.state === 'undetermined'), JSON.stringify(py.sites))
  assert.ok(py.sites.every((s) => /SCRIPT_COMMENT_DIALECTS|遮噪/.test(s.why)), '未判定必须写明原因(遮罩层没有 py 档),不能只报状态')
  const A = realFace()
  const pyJudged = A.judged.filter((j) => /\.py$/i.test(j.rel))
  assert.ok(pyJudged.length > 0, '真仓 Python 面一个文件都没扫到 ⇒ 射程漂了')
  for (const j of pyJudged) {
    assert.ok(j.sites.every((s) => s.state === 'undetermined'), `${j.rel} 的 Python 站点出现了非未判定档:${JSON.stringify(j.sites.map((s) => s.state))}`)
  }
})

test('T7 取材面形状锁(守门 118 的半接线型):引层且不自己派生 git / 不读磁盘', () => {
  const raw = readFileSync(GATE, 'utf8')
  // 遮噪只引那一份实现,判据面 = 剥注释、保留字符串(门体头注本来就要逐字写出被禁的词)
  const face = maskComments(raw)
  assert.match(raw, /from '\.\/lib\/face-reader\.mjs'/, '必须引 face-reader 那层')
  assert.match(face, /catBatch\s*\(/, '正文必须经层的 catBatch(引了层却自己取 = half-wired,守门 118 那一型)')
  assert.match(face, /readWorktreeFile\s*\(/, 'worktree 逃生舱也必须走层出口')
  assert.match(face, /gitRaw\s*\(/, '枚举走层的派生出口(带 timeout 与显式 stdio)')
  // 禁令按**形态**判而不是按词判:`show` 只认它作为 git 动词出现的那一档( `'show'` ),
  // 否则任何叫 showAll / setShow 的合法标识符都会把这条锁变成误红(假阳比漏报更贵)。
  const BANNED = [
    ['readFileSync', /readFileSync/],
    ['execSync', /execSync/],
    ['spawnSync', /spawnSync/],
    ['child_process', /child_process/],
    ['process.cwd()', /process\.cwd/],
    ["自派生 git 读内容('show')", /['"]show['"]/],
  ]
  for (const [name, re] of BANNED) {
    assert.doesNotMatch(face, re, `门体出现了被禁的取材形态 ${name}(枚举不得读正文、正文不得读磁盘)`)
  }
  assert.doesNotMatch(raw, /readFileSync\s*\(\s*join\s*\(\s*ROOT/, '不得出现裸 readFileSync(join(ROOT…) 取被审内容')
  // T7c 有牙证明:同一把锁喂合成面必须逐条命中,否则"当前干净"与"锁根本没跑"在账面上同形。
  // 合成面刻意长成 half-wired 的样子 —— 引了层、却仍自己派生 git / 自己读磁盘。
  const synthetic = "import { catBatch } from './lib/face-reader.mjs'\nconst t = readFileSync(join(ROOT, rel), 'utf8')\nconst u = gitRaw(['show', `HEAD:${rel}`], root)\n"
  const sface = maskComments(synthetic)
  assert.match(sface, /readFileSync/, '合成面必须被这把锁抓到(抓不到 ⇒ 锁无牙)')
  assert.match(sface, /['"]show['"]/, '自派生 git 读正文的形态必须被抓到')
  assert.doesNotMatch(sface, /catBatch\s*\(/, '合成面没有层读取入口 ⇒ half-wired 判据的另一半')
})

test('T8 装车证明:本尺刻意不在提交链 —— runner 的 HEAD 面必须查不到它', () => {
  const raw = readFileSync(GATE, 'utf8')
  const header = raw.slice(0, raw.indexOf('*/', raw.indexOf('/**')))
  assert.match(header, /不接提交链|不在提交链上/, '头注必须自己讲清这把尺子的定性(否则后人会当门接)')
  assert.doesNotMatch(header, /HUSKY_SKIP_[A-Z0-9_]+/, '不在钩子链上的尺子不得声明应急跳过变量')
  assert.doesNotMatch(header, /集成位置/, '不得写"集成位置"字样(守门 89 的 R1 判的就是这一形态)')
  const runner = catBatch(REPO, [RUNNER_REV]).get(RUNNER_REV)
  assert.equal(typeof runner, 'string', 'runner 的 HEAD blob 取不到 ⇒ 无法判定(不回落磁盘那一面)')
  assert.ok(!runner.includes(SELF), `本尺已被接进提交链(${SELF}) ⇒ 与本尺头注相反:接线属人工裁决,要接先改头注与这条锁,不得悄悄接线`)
  // T8c 锁本身有牙:同一条判据喂"真被注册"的合成 runner 面必须翻红
  const synthetic = `    {\n      id: '999',\n      label: '冗余判别列',\n      script: 'node scripts/${SELF} --staged',\n      mode: 'blocking',\n    },`
  assert.ok(synthetic.includes(SELF), '合成注册条目必须含本尺文件名 ⇒ 上一条断言对真 runner 判绿才是结论而不是空转')
})

test('T9 三面口径(CLI 真退出码):两旗同给=2,缺省 HEAD=0,--strict 有未判定=2,--root 缺实参=2', () => {
  const both = runGate(['--staged', '--worktree'])
  assert.equal(both.rc, 2, both.all)
  assert.match(both.err, /不得同用/)
  const head = runGate([])
  assert.equal(head.rc, 0, `缺省档命中再多也不得改退出码:${head.all}`)
  assert.match(head.out, /判定面=head/)
  assert.match(head.out, /\(本尺子不判红\)/)
  const strict = runGate(['--strict'])
  assert.equal(strict.rc, 2, '真仓 HEAD 面有未判定(Python 整族)⇒ --strict 必须拒绝出具合格证')
  assert.match(strict.out, /rc=2 来自--strict 的未判定或覆盖面未闭合/)
  const noRoot = runGate(['--root'])
  assert.equal(noRoot.rc, 2, noRoot.all)
  assert.match(noRoot.err, /--root 需要一个目录实参/)
})

test('T10 临时仓端到端:清单与内容同面(索引有而 HEAD 没有 ⇒ 只有 --staged 档看得见)', () => {
  const root = createRepo()
  const HIT = 'const x = db.select().from(t).where(and(sql`${t.metadata}->>\'byokMode\' = \'true\'`))\n'
  const PASS = 'const y = db.select().from(t).where(and(eq(t.type, \'report\'), sql`${t.metadata}->>\'byokMode\' = \'true\'`))\n'
  try {
    putFile(root, 'README.md', '# fixture\n', { commit: true })
    const seen = (face, want) => {
      const a = gate.analyze({ face, root })
      return a.tally.sites.some((s) => s.state === want && s.rel === 'apps/api/src/r.ts')
    }
    putFile(root, 'apps/api/src/r.ts', HIT, { add: true }) // 只 add 不 commit ⇒ 在索引、不在 HEAD
    assert.equal(seen('head', 'hit'), false, 'HEAD 档不该看见未入库的那份')
    assert.equal(seen('staged', 'hit'), true, '索引档必须点名它(清单来自索引、内容也必须来自索引)')
    gitIn(root, ['commit', '--quiet', '-m', 'add carrier'])
    assert.equal(seen('head', 'hit'), true, '入库之后 HEAD 档必须看得见 —— 否则"HEAD 档"是句空话')
    putFile(root, 'apps/api/src/r.ts', PASS) // 只在磁盘上改成带判别列的版本(不 add)
    assert.equal(seen('head', 'hit'), true, '磁盘副本被改回去不得让 HEAD 档换结论')
    assert.equal(seen('staged', 'hit'), true, '索引仍是那份 ⇒ staged 档结论不随磁盘漂')
    assert.equal(seen('head', 'pass'), false)
    assert.equal(seen('worktree', 'pass'), true, 'worktree 档(仅人工逃生舱)必须看得见磁盘那一版')
    putFile(root, 'apps/y/untracked.ts', HIT) // 未跟踪 ⇒ 三面都不覆盖(射程边界,如实登记)
    assert.equal(gate.analyze({ face: 'worktree', root }).tally.sites.some((s) => s.rel === 'apps/y/untracked.ts'), false, '未跟踪文件连 worktree 档也不覆盖 ⇒ 边界要写进报告而不是当"没有"')
  } finally {
    rmScratch(root)
  }
})

test('T11 空枚举判死 + 三态不并桶(纯函数出口,不靠仓库瞬时状态)', () => {
  const A = realFace()
  assert.equal(A.dead, null, `真仓面不得被判死:${A.dead}`)
  assert.ok(A.listed.length > 0, '真仓射程枚举为 0 ⇒ 尺子没在工作')
  assert.ok(!!gate.enumerationVerdict({ listed: 0, withProbe: 0 }), '枚举 0 必须判死')
  assert.ok(!!gate.enumerationVerdict({ listed: 9, withProbe: 0 }), '枚举 9 却零站点 ⇒ 判死(预筛与判据不同形)')
  assert.equal(gate.enumerationVerdict({ listed: 9, withProbe: 3 }), null)
  // 命中再多都不判红;未判定默认不判红、--strict 才拒绝出合格证;"分类没走完"永远判死
  const many = gate.tally([J(gate.FX.only), J(gate.FX.only), J(gate.FX.only)])
  assert.equal(many.hit, 3, JSON.stringify(many))
  assert.equal(gate.exitCodeOf({ t: many, dead: null, coverageGaps: 0, strict: false }), 0, '命中不改退出码 —— 本尺只量算不判红')
  assert.equal(gate.exitCodeOf({ t: many, dead: null, coverageGaps: 0, strict: true }), 0, '纯命中的面即便 --strict 也不该判红(strict 只管未判定与覆盖面)')
  const und = gate.tally([J(gate.FX.nodecl)])
  assert.equal(und.undetermined > 0, true)
  assert.equal(gate.exitCodeOf({ t: und, dead: null, coverageGaps: 0, strict: false }), 0, '默认档:未判定只点名,不冒充违规')
  assert.equal(gate.exitCodeOf({ t: und, dead: null, coverageGaps: 0, strict: true }), 2, '--strict 下有未判定 ⇒ 拒绝出具合格证')
  assert.equal(gate.exitCodeOf({ t: und, dead: 'dead:x', coverageGaps: 0, strict: false }), 2, '判死优先于一切')
  // 四态之和必须等于站点数(并桶 = 读数不可信)
  const four = gate.tally([J(`${gate.FX.only}\n${gate.FX.type}\n${gate.FX.nodecl}\n${gate.FX.proj}`)])
  assert.equal(
    four.hit + four.pass + four.undetermined + four.notApplicable + four.todo,
    four.sites.length,
    JSON.stringify(four),
  )
  // O1/O2 两维永不参与退出码(票面明写只报数)
  const aux = gate.tally([J(gate.FX.o1Hit), J(gate.FX.o2Sql)])
  assert.ok(aux.candidatesO1 > 0 && aux.reportedO2 > 0, JSON.stringify(aux))
  assert.equal(gate.exitCodeOf({ t: aux, dead: null, coverageGaps: 0, strict: false }), 0)
})

test('T12 门体自检必须全绿且构造面例数不得掉(证据变薄 = 下一次改动没有尺子接着)', () => {
  const r = gate.selfTest()
  assert.equal(r.fail, 0, `门体自检未全绿:${r.failed.map((c) => c.name).join(' | ')}`)
  assert.ok(r.total >= 40, `自检例数掉了(${r.total}),这把尺子的构造面证据太薄`)
  // harness 必须在登记时就求值:本门的 t() 把 cond 立刻过 !!,存的是布尔而不是函数
  const src = readFileSync(GATE, 'utf8')
  const body = src.slice(src.indexOf('export function selfTest'))
  assert.match(body, /ok:\s*\(\(\)\s*=>\s*!!cond\)\s*\(\)/, 't() 必须在登记那一刻求值,裸存 cond / 存函数都会让"N/N 通过"变成零条判过')
  assert.doesNotMatch(body, /cases\.push\(\{\s*name,\s*ok:\s*cond\s*\}\)/, '不得把未求值的 cond 直接记账')
})

test('T13 覆盖面自证的排除清单不得腐烂成第二份真相(由门导出的那份判据消费)', () => {
  assert.ok(Array.isArray(gate.OUT_OF_SCOPE) && gate.OUT_OF_SCOPE.length > 0, '排除清单空 = 覆盖面自证没有对照物')
  for (const e of gate.OUT_OF_SCOPE) {
    assert.ok(e && typeof e.glob === 'string' && typeof e.why === 'string' && e.why.trim() !== '', `排除项必须带实测出处:${JSON.stringify(e)}`)
    assert.equal(gate.coverageGapOf(`${e.glob}sample.ts`), false, `${e.glob} 已声明排除却仍算缺口 ⇒ 清单与判据不同形`)
  }
  assert.equal(gate.coverageGapOf('apps/some-brand-new-app/src/a.ts'), true, '没声明的新面必须算缺口(扩面时忘了同步排除表就是这一格)')
  assert.equal(gate.coverageGapOf('apps/api/src/routes/__tests__/x.test.ts'), false, '测试面是刻意不看的那一格,不是覆盖面缺口')
  assert.equal(gate.inScope('scripts/lib/face-reader.mjs'), false, 'scripts 只取顶层,lib 不在射程')
  assert.equal(gate.inScope('scripts/verify-byok-e2e.mjs'), true)
  const A = realFace()
  assert.equal(A.coverageGaps.length, 0, `覆盖面未闭合必须被点名(扩面忘改排除表的唯一现读证据):${JSON.stringify(A.coverageGaps)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
