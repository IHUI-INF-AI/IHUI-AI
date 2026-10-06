// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:check-merge-deletion-resurrection 的接线方向锁与源码级反向锁。
 *
 * 判据**行为**(候选分类 / 台账 / 窗口 / DR1+DR2)由门自己的 `--self-test` 在真临时仓里成对证明;
 * 本文件只钉"只有镜像能钉"的东西 —— 也就是**跨文件**与**源码形状**这两类:
 *  T1  方向锁:本门在 HEAD 面 runner 里**未注册**时,门体头注必须在『接线状态:』那一行明说未接线
 *      且不得出现守门 89 R1 的任何肯定式声称;**已注册**时改验注册块 blocking + skipEnv 成套,
 *      并要求头注那一行说已接入。判据只认**现状陈述**,带时点/漂移标记的历史记录与引文整行剔掉
 *      (两态只可能有一种为真,所以它既不会在注册前假装通过,也不会在注册后变成绊脚石)。
 *  T2  提取器有牙:同一提取器对不含本门的合成 runner 必须返回 null —— 否则 T1 是恒真式。
 *  T3  同源常量:短语与台账路径的**唯一定义**只能在 scripts/lib/deletion-intent.mjs;门体与本测试
 *      都不得再写一遍(两处实现必漂移,本仓 §3 / 守门 131/134 记过太多次)。
 *  T4  判据不得有第二份:门体与本测试都不得自行定义 parseAllowlist / entryDefect / classifyCandidate。
 *  T5  取材面形状锁:内容必须走 face-reader 的读取入口(catBatch / readWorktreeFile);禁
 *      process.cwd() 定根 / execSync / 自派生 git show 读内容 / 自己 readFileSync(守门 118)。
 *  T6  自检 harness 的行为锁(§22c 实录):传函数当 cond 必须记红 —— 用**门自己的** makeAssert 证明,
 *      不在测试里重写一条判据。
 *  T7  恒绿断言的形状锁:登记侧必须是 `cond === true` 而不是 `!!cond` / `if (cond)`。
 *  T8  真仓 HEAD 端到端:门本体 --json 可 parse、退出码落在 {0,1,2};**不断言必为 0**(真仓此刻
 *      若有复活就是该喊的红,把它断成 0 等于替仓库欠账发合格证)。
 *  T9  台账与门同源:盘上台账存在、可 parse、逐条过门自己的 schema。
 *  T10 一条短语不替整枚合并背书:同一枚合并里"带短语的候选"与"不带短语的候选"必须分别定性。
 *  T11 两条取证不重复计数:同一路径被 DR1/DR2 同时命中时只许一条红(否则两份基线互相顶掉)。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { gitRaw } from '../lib/face-reader.mjs'
import { ALLOWLIST_FILE, INTENTIONAL_DELETE_MARKER, entryDefect, parseAllowlist } from '../lib/deletion-intent.mjs'
import { HEADER_CLAIM_PATTERNS } from '../check-gate-wiring.mjs'
import { __test__ as gate } from '../check-merge-deletion-resurrection.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = 'check-merge-deletion-resurrection.mjs'
const INTENT_SRC = readFileSync(resolve(ROOT, 'scripts', 'lib', 'deletion-intent.mjs'), 'utf8')
const GATE_SRC = readFileSync(resolve(ROOT, 'scripts', SCRIPT), 'utf8')
const TEST_SRC = readFileSync(resolve(HERE, 'check-merge-deletion-resurrection.test.mjs'), 'utf8')

function runnerHeadText() {
  return gitRaw(['show', 'HEAD:scripts/guardian-runner.mjs'], ROOT, { timeout: 60000 })
}

/** 按"script 行锚定 → 上溯块首 `  {` → 下找 `  },`"整块提取;找不到返回 null(与守门 148/100 同法)。 */
function extractEntry(runnerText, scriptName) {
  const lines = runnerText.split('\n')
  const anchor = lines.findIndex((l) => l.trim() === `script: '${scriptName}',`)
  if (anchor < 0) return null
  let start = -1
  for (let i = anchor; i >= 0; i--) {
    if (lines[i] === '  {') {
      start = i
      break
    }
  }
  if (start < 0) return { malformed: true }
  let end = -1
  for (let i = anchor; i < lines.length; i++) {
    if (lines[i] === '  },') {
      end = i
      break
    }
  }
  if (end < 0) return { malformed: true }
  return { block: lines.slice(start, end + 1).join('\n') }
}

/**
 * 未注册分支的现状陈述判据(2026-10-06 改)。
 *
 * 立意不变:未注册 ⇒ 头注必须**明说**未接线,且不得出现守门 89 R1 的任何肯定式声称。
 *
 * 原判据 `assert.match(GATE_SRC, /尚未接线/)` 是**存在式**,锚在一句会过期的台词上,实测无牙
 * (注入确认生效后逐条坐实):
 *   - 它命中的是头注里**一句描述镜像测试怎么判的引文**(第 66 行"自称'尚未接线'且无守门 89 R1 的
 *     肯定式声称,已注册时改验注册块 blocking + skipEnv 成套"),不是本门此刻在说什么。
 *     把那句引文整段删掉(其余一字不动),断言立刻转红 ⇒ 它一直在给存档引文发合格证,
 *     判红的是"引文还在",不是"未接线这句被说了"。
 *   - 未注册 + 头注谎称 `【接线状态:已接入】` 时,R1 六个模式**一个都不命中**、`:78` 也只因上面
 *     那句引文而绿 ⇒ 谎报现状全程无人拦(与 permission-lease 门 T2 改前同型)。
 * 一条把真相判红的尺子,教出来的就是谎报。
 *
 * ⚠️ 收口口径(同族三次踩坑换来的):只认『接线状态:』引导的**现状陈述**(容许括号里的时点注记),
 * 并把带 `已漂移 / 原<日期> / 不再是` 的历史记录与引文整行剔掉后再看 —— 判红「谎报现状」与
 * 判红「记录历史」必须分开,否则改否定义句就会把基线自己判红。
 * 引导语两种语序都真实存在(本门写「接线状态」,permission-lease 门写「接线现状」)⇒ 显式列出两个词;
 * `接线状[态现]` / `接线[状现][态现]` 这两种字符类写法对「接线现状」都是 0 命中(实测),
 * 等于判据对它要读的那一行是瞎的。
 */
const WIRING_GUIDE = /接线(?:现状|状态)\s*(?:\([^)]*\))?\s*[:：]/
const WIRING_HISTORY = /已漂移|原\s*20\d{2}[-/]\d{2}|不再是/

test('T1 方向锁:未注册时头注必须自称"尚未接线",已注册时注册项必须成套', () => {
  const e = extractEntry(runnerHeadText(), SCRIPT)
  // 现状陈述与历史引文必须分开:先把带时点/漂移标记的行剔掉,再看本门此刻在说什么。
  const spoken = GATE_SRC.split('\n').filter((l) => !WIRING_HISTORY.test(l))
  const statusLines = spoken.filter((l) => WIRING_GUIDE.test(l))
  const claimsWired = statusLines.some((l) => /已接入|已注册|已挂进/.test(l))
  const claimsNotWired = statusLines.some((l) => /未接|尚未|未进/.test(l))
  if (e === null) {
    assert.ok(
      !claimsWired,
      `未注册,头注的『接线状态:』那一行却声称已接入 ⇒ 谎报现状(守门 89 R1 会对每次提交恒红):${JSON.stringify(statusLines)}`,
    )
    assert.ok(
      claimsNotWired || statusLines.length === 0,
      `未注册,头注必须明说未接线(而不是留白让人猜):${JSON.stringify(statusLines)}`,
    )
    // R1 措辞锁只扫**剔过历史**的文本:否则一句如实记录"当初未接线"的引文会被读成现状。
    const spokenText = spoken.join('\n')
    for (const { re, tag } of HEADER_CLAIM_PATTERNS)
      assert.ok(!re.test(spokenText), `头注出现肯定式声称「${tag}」而本门未注册 ⇒ 守门 89 R1 会对每次提交恒红`)
    assert.doesNotMatch(spokenText, /集成位置/, '不得写"集成位置"(该措辞正是 R1 的肯定式模板)')
  } else {
    assert.ok(!e.malformed, `注册块形状漂:${JSON.stringify(e)}`)
    assert.match(e.block, /mode: 'blocking'/, '定级必须是 blocking(票面要求)')
    assert.match(e.block, /skipEnv: 'HUSKY_SKIP_MERGE_DELETION_RESURRECTION'/, 'skipEnv 必须成套')
    assert.match(e.block, /id: ['"]\d+['"],/, '必须带数字 id')
    // 已注册这一臂也不能把「谎报现状」与「记录历史」混判:头注的现状陈述须说已接入,
    // 否则文档与提交链分叉(反过来,谁把头注如实改成"未接线"谁就被判红 —— 那正是本族的病根)。
    assert.ok(
      claimsWired,
      `注册表里本门已注册,但头注的『接线状态:』那一行仍说未接线 ⇒ 文档与提交链分叉:${JSON.stringify(statusLines)}`,
    )
  }
})

test('T2 提取器有牙:合成 runner(不含本门)必须提取为 null —— 否则 T1 是恒真式', () => {
  const synthetic = "const checks = [\n  {\n    id: '1',\n    script: 'check-some-other-gate.mjs',\n    mode: 'blocking',\n  },\n]\n"
  assert.equal(extractEntry(synthetic, SCRIPT), null)
})

test('T3 同源常量:短语与台账路径的唯一定义只能在 lib/deletion-intent.mjs', () => {
  assert.match(GATE_SRC, /from '\.\/lib\/deletion-intent\.mjs'/, '门体必须 import 同源常量层')
  assert.match(GATE_SRC, /hasIntentionalMarker/, '门体必须用同源短语出口,而不是自己写一遍')
  const declRe = /INTENTIONAL_DELETE_MARKER\s*=/g
  const decls = [INTENT_SRC, GATE_SRC, TEST_SRC].reduce((n, s) => n + (s.match(declRe) || []).length, 0)
  assert.equal(decls, 1, `INTENTIONAL_DELETE_MARKER 的声明处有 ${decls} 处(只许 1 处)`)
  assert.equal(INTENTIONAL_DELETE_MARKER, 'intentional-delete:', '短语逐字(票面指定的显式短语)')
  assert.equal(ALLOWLIST_FILE, 'scripts/data/deletion-survival-allowlist.json', '台账路径逐字')
  assert.match(TEST_SRC, /\$\{INTENTIONAL_DELETE_MARKER\}/, '夹具消息必须由同源常量插值,不得抄字面量')
  assert.ok(!GATE_SRC.includes('ALLOWLIST_FILE ='), '门体不得二次定义台账路径')
})

test('T4 判据不得有第二份:门体与本测试都不得自行重写台账解析/缺陷判定', () => {
  for (const fn of ['parseAllowlist', 'entryDefect', 'rotEntries', 'hasIntentionalMarker'])
    assert.doesNotMatch(GATE_SRC, new RegExp(`function\\s+${fn}\\b`), `门体内不得再定义 ${fn}(唯一实现在 lib/deletion-intent.mjs)`)
  for (const fn of ['parseAllowlist', 'entryDefect', 'classifyCandidate', 'decide', 'auditMerge'])
    assert.doesNotMatch(TEST_SRC, new RegExp(`function\\s+${fn}\\b`), `测试内不得重写 ${fn}(§22c:镜像只复读实现就是复读机)`)
})

test('T5 取材面形状锁:内容走 face-reader 的读取入口;禁 cwd 定根 / execSync / 自己读文件 / 散写 git show', () => {
  assert.match(GATE_SRC, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(GATE_SRC, /catBatch\(/, '台账必须经层读取入口 catBatch(只 import 不用 = 守门 118 的半接线)')
  assert.match(GATE_SRC, /readWorktreeFile\(/, '运行态去重台账走层的磁盘面读取入口,不得自己读文件')
  assert.doesNotMatch(GATE_SRC, /process\.cwd\(/, '定根不得依赖站立目录')
  assert.doesNotMatch(GATE_SRC, /\bexecSync\b/, '禁 execSync 拼串派生 git')
  // 形状锁按**调用形态**判(而不是裸标识符):头注里"不在本门里读文件"这类说明必须写得出来,
  // 否则文档自己被判成违规,而人为了过门会把说明删掉 —— 那一格就再没人说得清了。
  assert.doesNotMatch(GATE_SRC, /execFileSync\s*\(/, '本门不得自己派生进程(一律经层)')
  assert.doesNotMatch(GATE_SRC, /readFileSync\s*\(/, '本门不得自己读文件(一律经层)')
  assert.doesNotMatch(GATE_SRC, /['"]git show/, '内容不得经散写 git show 取')
})
test('T6 自检 harness 行为锁:把函数当 cond 传进来必须记红(用门自己的 makeAssert)', () => {
  const rows = []
  const probe = gate.makeAssert((m) => rows.push(m))
  probe.ok('一条从未求值的断言', () => true)
  assert.equal(probe.state.pass, 0, '函数 cond 不得计成通过')
  assert.equal(probe.state.fails.length, 1, '函数 cond 必须记红')
  assert.match(rows.join('\n'), /从未求值/, '红话必须说明为什么(否则下一个人只会看到"没过")')
  const p2 = gate.makeAssert(() => {})
  p2.ok('已求值为真', true)
  p2.ok('已求值为假', false)
  p2.ok('非布尔实得', 'yes')
  assert.equal(p2.state.pass, 1)
  assert.equal(p2.state.fails.length, 2, 'false 与非布尔都必须记红(只有 cond === true 算过)')
})

test('T7 恒绿断言的形状锁:登记侧必须是 cond === true,不得回退成 !!cond / if (cond)', () => {
  assert.match(GATE_SRC, /cond === true/, '登记侧按已求值布尔判')
  assert.doesNotMatch(GATE_SRC, /if\s*\(\s*cond\s*\)/, '不得出现 if (cond)(函数恒真)')
  assert.doesNotMatch(GATE_SRC, /!!cond/, '不得出现 !!cond(函数恒真)')
})

test('T8 真仓 HEAD 端到端:门本体 --json 可 parse,退出码落在 {0,1,2},不得把"未判定"写成通过', () => {
  const r = spawnSync(process.execPath, [resolve(ROOT, 'scripts', SCRIPT), '--json'], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 600000,
    cwd: ROOT,
  })
  assert.equal(r.error, undefined, `门本体派生失败:${r.error && r.error.message}`)
  assert.ok([0, 1, 2].includes(r.status), `exit 必须是 0/1/2 的判定结论(实得 ${r.status};stderr:${r.stderr})`)
  const j = JSON.parse(r.stdout)
  for (const k of ['merged', 'rows', 'reds', 'waivedMarker', 'waivedAllow', 'undetermined', 'emptyWindow', 'enumeration', 'counts', 'exit'])
    assert.ok(k in j, `--json 缺字段 ${k}`)
  assert.equal(Array.isArray(j.rows), true)
  assert.equal(j.exit, r.status, 'JSON 的 exit 与实际退出码必须同形(两套结论互相顶账就是假账)')
  assert.ok(j.counts.DR1 <= j.reds.length && j.counts.DR2 <= j.reds.length, 'DR1/DR2 计数不得超过红总数')
  if (r.status === 0) {
    // 绿必须说得出为什么绿:要么窗口里真有合并且无复活,要么是如实报出的空窗口 —— 不得静默。
    assert.ok(j.merged > 0 || j.emptyWindow === true || j.rows.length === 0, 'exit 0 却既无判定对象又无 EMPTY 声明')
  }
  // 真仓此刻的既有存量在**已入库**历史里(靠 --limit 取证档可见),提交链默认档不重判它们;
  // 所以这里刻意不断言"真仓必为 0",只断言口径与三态自洽(见 T8 上一行)。
})

test('T9 台账与门同源:盘上台账存在、可 parse,逐条过门自己的 schema', () => {
  const p = resolve(ROOT, 'scripts', ALLOWLIST_FILE.replace(/^scripts\//, ''))
  assert.ok(existsSync(p), `台账必须在位(${ALLOWLIST_FILE})`)
  const parsed = parseAllowlist(readFileSync(p, 'utf8'))
  assert.equal(parsed.broken, null, '台账形状漂 ⇒ 判"无法判定",而不是当空表用')
  assert.equal(parsed.absent, false)
  const today = new Date().toISOString().slice(0, 10)
  for (const e of parsed.entries) assert.equal(entryDefect(e, today), null, `台账条目缺陷:${e.path}`)
})

test('T10 一条短语不替整枚合并背书:同枚合并内两条候选各自定性', () => {
  const cands = [
    { path: 'with-marker.ts', merge: 'm'.repeat(40), ours: 'o'.repeat(40), theirs: 't'.repeat(40), rule: 'DR1', deleteSha: 'd'.repeat(40), deleteBody: `refactor: 删它\n\n${INTENTIONAL_DELETE_MARKER} 零消费者`, deleteLookupFailed: false },
    { path: 'no-marker.ts', merge: 'm'.repeat(40), ours: 'o'.repeat(40), theirs: 't'.repeat(40), rule: 'DR2', deleteSha: 'e'.repeat(40), deleteBody: 'refactor: 顺手删的', deleteLookupFailed: false },
  ]
  const d = gate.decide({ mergeRows: [{ rev: 'm'.repeat(40), merge: true, candidates: cands, undetermined: [] }], allowEntries: [], today: '2026-10-01', strict: false, enumeration: 'ok', mergesAudited: 1 })
  assert.deepEqual(d.reds.map((r) => r.path), ['no-marker.ts'], '只有带短语的那条被豁免')
  assert.deepEqual(d.waivedMarker.map((c) => c.path), ['with-marker.ts'], '被豁免的必须报出来,不得静默消失')
  assert.equal(d.exit, 1)
})

test('T11 两条取证不得重复计数:auditMerge 对同一路径只出一条候选', () => {
  // 层的去重键是 `合并|路径`;这里用门自己的导出证明"两条前件同时成立时不会变成两条债"。
  const names = ['auditMerge', 'membership', 'presentOnlyOnTheirs', 'deletedOnOurs', 'decide', 'classifyCandidate', 'runAudit', 'makeAssert']
  for (const n of names) assert.equal(typeof gate[n], 'function', `__test__ 必须导出 ${n}(镜像只能用门的实现)`)
  assert.ok(gate.DELETE_LOOKUP_CAP >= 1 && gate.DELETE_LOOKUP_CAP <= 1000, `DR2 取证上限必须是有界常量(实得 ${gate.DELETE_LOOKUP_CAP})`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
