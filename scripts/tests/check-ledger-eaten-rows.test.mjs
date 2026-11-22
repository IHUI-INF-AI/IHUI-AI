// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file `scripts/lib/ledger-eaten-rows.mjs`(+ 门体薄壳 `scripts/check-ledger-eaten-rows.mjs`)
 *       的镜像测试 —— 台账「正文被吃掉」两型残行的只读尺子。
 *
 * 判据**不在此复制**(§22c):`emptyBodyOf` / `truncatedTailOf` / `judge` / `verdict` / `run` /
 * `parseArgv` 与连接符字符集 `TRAILING_CONNECTORS` 全部从源文件 import;这里只造**输入夹具**。
 * 两个源文件都带 §22d 的 isDirectRun 守卫,import 不会触发 main(),也就不会派生任何 git 取材。
 *
 * 必须成对存在的四组夹具(缺任何一组,尺子可能只是"没看到东西"而不是"判过了"):
 *  1. 型① 正例(含票面原形与"复选框后不跟空格"那一族)+ 型① 反例(正常登记行不得被判残行);
 *  2. 型② 正例(逐个连接符)+ 型② 反例(完整句 / 收尾是括号或反引号);
 *  3. 取不到被审面 ⇒ exit 2 未判定(三档面各一次,且不落任何文件);
 *  4. 枚举到 0 行 ⇒ 判死(未判定)而有行 0 命中 ⇒ clean —— 两个"看起来都是 0"必须可区分。
 *
 * 夹具唯一落点:`scripts/lib/scratch-dir.mjs`(§15b/§26);全程只读,真仓面只做只读取材。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { parseTaskRows } from '../lib/plan-task-index.mjs'
import { __test__ as L } from '../lib/ledger-eaten-rows.mjs'
import { __test__ as GATE } from '../check-ledger-eaten-rows.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const LIB_FILE = path.join(REPO, 'scripts', 'lib', 'ledger-eaten-rows.mjs')
const GATE_FILE = path.join(REPO, 'scripts', 'check-ledger-eaten-rows.mjs')
const CLI = GATE_FILE

/** 把若干行拼成"文档"再走**同一个** parseTaskRows —— 行识别只有一份实现,测试也不许自带第二条尺。 */
const rowsOf = (...lines) => parseTaskRows(lines.join('\n'))
const judgeLines = (...lines) => L.judge(rowsOf(...lines))

// ─── 1. 型①:空正文行 ───────────────────────────────────────────────
test('型① 正例:复选框后除括注标记外一个字符都不剩 ⇒ 必须判出来(含票面原形)', () => {
  const positives = [
    // 票面原形:代摘器摘牌后只剩释放注记,正文没回来
    '- [ ]（认领已释放@2026-10-23/stale-claim-strip#mvjyuyh8-27）',
    // 同一族写在"复选框后带空格"的位置
    '- [ ] （认领已释放@2026-10-23/stale-claim-strip#mvjyuyh8-28）',
    // 半角括号同形(括号形态两可,与 claimMarkOf 的 ③ 档同口径)
    '- [ ] (认领已释放@2026-10-23/x-1)',
    // 租约牌本身占满整行 = 同样没有可派内容(DECOR_RE 词形档先剥,剥完为空)
    '- [ ] （进行中@2026-10-23/holder-x）',
    // 行内投影标头是**侧车投影**、不是正文,必须先剥再看
    '- [ ] 〔归:—｜等:环境〕（认领已释放@2026-10-23/x-2）',
    // 嵌套括注(扫描原语深度感知)
    '- [ ]【【归并】重复登记副本】',
    // 复选框后什么都没有
    '- [ ]',
    // 星号子弹同样算登记行(CHECKBOX_RE 认 [-*])
    '* [ ]（认领已释放@2026-10-23/x-3）',
  ]
  const v = judgeLines(...positives)
  assert.equal(
    v.scanned,
    positives.length,
    '每一形都必须被识别成登记行(识别复用 parseTaskRows,不是自带正则)',
  )
  assert.equal(
    v.empty.length,
    positives.length,
    `正例应当全被判出,实得 ${v.empty.length}/${positives.length}`,
  )
  assert.equal(v.truncated.length, 0, '空正文行结尾是括号,不得同时被算成型②')
})

test('型① 反例:正常登记行(带正文)一条都不许判成残行——含"标记 + 正文"那一族', () => {
  const negatives = [
    '- [ ] G-1 甲 细节正文',
    // 行首有标记括注、但正文回来了 —— 这正是票面说"不能误伤"的形状
    '- [ ]（认领已释放@2026-10-23/stale-claim-strip#mvjyuyh8-0）**D99 消息串内富文本动作锚点(G-136)**:验收要跑 e2e',
    '- [ ] **G-2. 题面** —— 一句完整的现状',
    '- [ ] 〔归:—｜等:先要定身份模型〕 （认领已释放@2026-10-18/y） **G-954 学费账目这条线尚未投产的剩余格**',
    '- [x] ✅(2026-10-23) **G-3 已结清的一行**',
    // 未配平的行首括注:带正文 ⇒ 不吃括注、不判型①(配平失败不猜)
    '- [ ] （登记,未取号 —— 号池已满,取号器回 pool-exhausted 后面的正文还在',
  ]
  const v = judgeLines(...negatives)
  assert.equal(v.scanned, negatives.length)
  assert.equal(v.empty.length, 0, `反例被误判成空正文:${JSON.stringify(v.empty)}`)
  assert.equal(v.truncated.length, 0)
})

test('型① done 行照判,并在点名行里带 state=done(勾选态不是免判理由)', () => {
  const v = judgeLines('- [x]（认领已释放@2026-10-23/stale-claim-strip#mvjyuyh8-9）')
  assert.equal(v.empty.length, 1, '已勾选但没有正文的行同样是"账面有票、手里没票"')
  assert.match(v.empty[0], /\bdone\b/)
  assert.equal(v.done, 1)
  assert.equal(v.open, 0)
})

// ─── 2. 型②:截断正文行 ─────────────────────────────────────────────
test('型② 正例:逐个连接符收尾都判得出(字符集取自源文件,不在测试里另列一份)', () => {
  const fixtures = L.TRAILING_CONNECTORS.map((c) => `- [ ] G-7 半句被合并吃掉${c}`)
  const v = judgeLines(...fixtures)
  assert.equal(v.empty.length, 0, '带正文的行不得被型① 抢走')
  assert.equal(
    v.truncated.length,
    L.TRAILING_CONNECTORS.length,
    `型② 命中数应等于字符集大小,实得 ${v.truncated.length}/${L.TRAILING_CONNECTORS.length}`,
  )
  for (const c of L.TRAILING_CONNECTORS)
    assert.ok(
      v.truncated.some((l) => l.includes(`以「${c}」收尾`)),
      `连接符 ${c} 的点名行必须原样带出实得字符`,
    )
})

test('型② 正例:票面原形 + 收尾连接符后还挂着 markdown 强调/行内代码记号时仍判得出', () => {
  const v = judgeLines(
    // 票面原形(HEAD 面现读一枚)
    '- [ ] `--allow-dangerous` 确认旁路仍在调用方(`commands/agent.ts:1757`、`server/agent-core.ts:101`),',
    // 逗号后面还有 `**` / 反引号噪音:先剥噪音再看末字符,否则这一族永远隐形
    '- [ ] G-8 半句被切,**',
    '- [ ] G-9 半句被切,`',
  )
  assert.equal(v.scanned, 3)
  assert.equal(
    v.truncated.length,
    3,
    `三形都应判为截断,实得 ${v.truncated.length}:${JSON.stringify(v.truncated)}`,
  )
})

test('型② 反例:完整句 / 括号或标头收尾 / 连接符在句中 都不算截断', () => {
  const negatives = [
    '- [ ] G-10 这是一句写完了的话。',
    '- [ ] G-11 句中带逗号,以及分号;都不断行',
    '- [ ] G-12 收尾是括号(commands/agent.ts:101)',
    '- [ ] G-13 收尾是行内代码 `--staged`',
    '- [ ] G-14 收尾是尾注〔进展@2026-10-23:已复核〕',
    '- [ ] G-15 收尾是句号.',
  ]
  const v = judgeLines(...negatives)
  assert.equal(v.scanned, negatives.length)
  assert.equal(v.truncated.length, 0, `反例被误判成截断:${JSON.stringify(v.truncated)}`)
  assert.equal(v.empty.length, 0)
})

// ─── 3. 枚举视野:0 行 vs 有行 0 命中,两者必须可区分 ────────────────
test('枚举到 0 个登记行 ⇒ 判死(未判定),且末行不许把 empty/truncated 谎报成 0 枚', () => {
  const v = judgeLines('这是一段普通叙述,没有复选框。', '# 标题', '')
  assert.equal(v.scanned, 0, '夹具里本就没有登记行')
  const r = L.verdict(v, 'head')
  assert.equal(r.state, 'undetermined')
  assert.equal(r.code, 2, '尺子失明不得记绿(§0.3)')
  assert.match(r.line, /state=undetermined/, '末行必须是未判定')
  assert.match(r.line, /empty=NA/, `不得把"没看到"写成 0:${r.line}`)
  assert.match(r.line, /truncated=NA/, r.line)
  assert.match(r.line, /rows=0/, '但视野条数必须如实带出 0,与"命中 0"可区分')
})

test('有登记行而两型 0 命中 ⇒ state=clean 且 rows= 报出视野条数(0 命中 ≠ 没判)', () => {
  const v = judgeLines('- [ ] G-16 正常的一行', '- [x] ✅(2026-10-23) **G-17 结清的一行**')
  assert.equal(v.scanned, 2)
  assert.equal(v.empty.length, 0)
  assert.equal(v.truncated.length, 0)
  const r = L.verdict(v, 'head')
  assert.equal(r.state, 'clean')
  assert.equal(r.code, 0)
  assert.match(r.line, /rows=2/, r.line)
})

test('只读尺子:命中再多也只 exit 0(绝不判红,§12e 恒红门禁令)', () => {
  const v = judgeLines(
    '- [ ]（认领已释放@2026-10-23/a）',
    '- [ ] G-18 半句,',
    '- [ ] G-19 半句;',
    '- [ ] G-20 半句、',
  )
  assert.equal(v.empty.length + v.truncated.length, 4)
  const r = L.verdict(v, 'head')
  assert.equal(r.state, 'warn', '有命中 ⇒ warn(不是 red)')
  assert.equal(r.code, 0, `warn 档退出码必须是 0,实得 ${r.code}`)
  assert.ok(!/state=red/.test(r.line), r.line)
})

// ─── 4. 取不到被审面 ⇒ 未判定(三档面各一次,且零写入) ──────────────
test('取不到被审面 ⇒ 三档面各自 exit 2 并点名原因,不回落另一个面、不在盘上留东西', () => {
  const dir = mkScratch('ihui-ledger-eaten-rows')
  try {
    for (const face of ['head', 'staged', 'worktree']) {
      const got = L.run({ root: dir, face })
      assert.equal(got.code, 2, `${face} 面取不到必须落未判定(exit 2),实得 ${got.code}`)
      assert.match(got.lines[0], /未判定/, `${face} 面必须显式写「未判定」:${got.lines[0]}`)
      assert.match(got.lines[0], /取不到/, `${face} 面必须点名原因:${got.lines[0]}`)
      const last = got.lines[got.lines.length - 1]
      assert.match(last, new RegExp(`state=undetermined.*face=${face}`), last)
      assert.match(last, /rows=NA/, `取不到面不得报出任何视野数:${last}`)
      assert.ok(!/state=clean/.test(last), '未判定绝不被写成 clean')
      assert.ok(!/state=red/.test(last), '未判定也不冒红')
    }
    assert.deepEqual(readdirSync(dir), [], `只读尺子不得在被审根里落任何文件:${readdirSync(dir)}`)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('judge([])(空行集)与 verdict 的未判定臂同形:不得把"没扫到行"报成"零残行"', () => {
  const v = L.judge([])
  assert.equal(
    L.verdict(v, 'staged').code,
    2,
    '空行集 ⇒ 未判定(空文本面那一臂见 judgeText 的构造面用例)',
  )
})

// ─── 5. 构造面走**同一条**判定+出报通道(judgeText)───────────────────
test('构造面 judgeText:1 枚型① + 1 枚型② ⇒ exit 0、逐条点名带被审面行号、末行齐件', () => {
  const text = [
    '# 计划',
    '正文说明一段。',
    '- [ ]（认领已释放@2026-10-23/stale-claim-strip#fixture-1）',
    '- [ ] G-7002 半句被合并吃掉,',
    '- [ ] G-7003 正常的一行,收尾是完整的。',
    '- [x] ✅(2026-10-23) G-7004 结清的一行',
  ].join('\n')
  const got = L.judgeText(text, 'head')
  assert.equal(got.code, 0, `有命中的构造面也必须 exit 0:${got.lines.join('\n')}`)
  assert.equal(got.judged.scanned, 4, '四条登记行都须被看见(含不跟空格那一族)')
  assert.equal(got.judged.empty.length, 1)
  assert.equal(got.judged.truncated.length, 1)
  const report = got.lines.join('\n')
  assert.match(
    report,
    /型① L3 open \(无主键\)｜- \[ \]（认领已释放@2026-10-23\/stale-claim-strip#fixture-1）/,
  )
  assert.match(report, /型② L4 open .*以「,」收尾/)
  assert.match(report, /只读尺子/, '有命中必须带"不判红、不代改"的定性行')
  assert.match(
    got.verdict.line,
    /^LEDGER-EATEN-ROWS-RESULT state=warn empty=1 truncated=1 open=3 rows=4 face=head$/,
    got.verdict.line,
  )
})

test('构造面 judgeText:两型 0 命中 ⇒ clean,且报告明写这是"扫过 rows 条之后的 0"', () => {
  const got = L.judgeText(
    '- [ ] G-7005 正常的一行。\n- [x] ✅(2026-10-23) G-7006 结清的一行\n',
    'head',
  )
  assert.equal(got.code, 0)
  assert.equal(got.verdict.state, 'clean')
  assert.match(got.lines.join('\n'), /两型均 0 命中/)
})

test('构造面 judgeText:空文本与"有文本但一行登记行都没有"都落未判定(两种 0 不许混读)', () => {
  const blank = L.judgeText('', 'staged')
  assert.equal(blank.code, 2)
  assert.match(blank.lines[0], /空文本/, blank.lines[0])
  assert.match(blank.lines[1], /state=undetermined.*face=staged$/, blank.lines[1])

  const noRows = L.judgeText('# 标题\n这一段叙述里没有复选框。\n', 'head')
  assert.equal(noRows.code, 2, '枚举到 0 个登记行 = 判死,不得记绿')
  assert.match(noRows.lines.join('\n'), /state=undetermined empty=NA.*rows=0/)
  assert.ok(
    !noRows.lines.join('\n').includes('两型均 0 命中'),
    '判死的一档不得同时打出"扫过后为 0"的报告',
  )
})

// ─── 6. 用法面:两面旗同给 / --root 吞旗标 / 未知旗标,一律 exit 2 且点名 ───
test('parseArgv:两面旗同给与未知旗标都判死;--root 给了旗标没给值绝不静默退回默认根(G-322)', () => {
  const both = L.parseArgv(['--staged', '--worktree'], REPO)
  assert.match(both.error ?? '', /不得同用/, '两面旗同给 = 自相矛盾 ⇒ 判死')
  assert.equal(both.face, null)

  const unknown = L.parseArgv(['--strict'], REPO)
  assert.match(
    unknown.error ?? '',
    /不认得的旗标/,
    '静默忽略未知旗标 = 把"没判这一维"读成"这一维过了"',
  )

  const noValue = L.parseArgv(['--root'], REPO)
  assert.match(noValue.error ?? '', /--root 需要一个目录/, noValue.error ?? '')
  assert.equal(noValue.root, null, '不得把缺值折回默认根后照常出具结论')

  const eaten = L.parseArgv(['--root', '--staged'], REPO)
  assert.match(eaten.error ?? '', /--root/, '紧邻的另一个旗标不是值(G-322 立项形态)')

  const okDefault = L.parseArgv([], REPO)
  assert.equal(okDefault.error, null)
  assert.equal(okDefault.face, 'head', '默认档 = HEAD blob')
  assert.equal(okDefault.root, REPO)
  assert.equal(L.parseArgv(['--staged'], REPO).face, 'staged', '索引档')
  assert.equal(L.parseArgv(['--worktree'], REPO).face, 'worktree', '人工逃生舱')
  assert.equal(L.parseArgv(['--root', REPO, '--staged'], REPO).root, REPO, '带值旗标 + 面旗标共存')
})

// ─── 7. 端到面:CLI 真跑(默认档量真仓;--root 指空目录量未判定) ──────
const cli = (args) =>
  spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

test('CLI 默认档跑真仓 HEAD 面:exit 0 + 视野非零(尺子没瞎)+ 机读末行齐件', () => {
  const got = cli([])
  assert.equal(got.status, 0, `只读尺子不判红,退出码必须 0;实得 ${got.status}\n${got.stderr}`)
  const last = got.stdout.trim().split(/\r?\n/).pop()
  assert.match(last, /^LEDGER-EATEN-ROWS-RESULT state=(clean|warn) /, last)
  assert.match(last, /face=head$/, last)
  const rows = Number(/rows=(\d+)/.exec(last)?.[1] ?? '0')
  assert.ok(
    rows > 100,
    `真仓 HEAD 面登记行视野应远大于 0(读成 0 就是尺子失明),实得 rows=${rows}\n${got.stdout}`,
  )
  const empty = Number(/empty=(\d+)/.exec(last)?.[1])
  const truncated = Number(/truncated=(\d+)/.exec(last)?.[1])
  if (empty + truncated > 0)
    assert.match(got.stdout, /只读尺子/, '有命中必须带"不判红、不代改"的定性行')
})

test('CLI --root <无仓空目录> ⇒ exit 2 未判定(未判定臂在 CLI 面上真通,不是文档里的假出路)', () => {
  const dir = mkScratch('ihui-ledger-eaten-rows-cli')
  try {
    const got = cli(['--root', dir])
    assert.equal(got.status, 2, `实得 ${got.status}\n${got.stdout}${got.stderr}`)
    assert.match(got.stdout, /未判定/, got.stdout)
    assert.match(got.stdout.trim().split(/\r?\n/).pop(), /state=undetermined.*face=head$/)
    assert.ok(!/state=clean/.test(got.stdout), '取不到面不得冒绿')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('CLI --staged --worktree ⇒ exit 2 并在同一轮打出 NA 末行(不挑一面顶绿)', () => {
  const got = cli(['--staged', '--worktree'])
  assert.equal(got.status, 2, `实得 ${got.status}\n${got.stdout}`)
  assert.match(got.stdout, /不得同用/, got.stdout)
  assert.match(got.stdout.trim().split(/\r?\n/).pop(), /state=undetermined.*face=none$/)
})

// ─── 8. 形状锁:只读承诺 + 判据单源(失效是安静的,所以钉在源码面上) ──
test('形状锁:两个源文件里不得出现任何写盘/写 git 的动作(本尺的"只读"是被钉住的)', () => {
  const FORBIDDEN = [
    'writeFileSync',
    'appendFileSync',
    'mkdirSync',
    'rmSync',
    'unlinkSync',
    'renameSync',
    'copyFileSync',
    'spawnSync',
    'execSync',
    'execFileSync',
    'git add',
    'git commit',
    'git push',
    'commit-tree',
    'update-index',
    'update-ref',
    '--apply',
  ]
  const fnBodies = [
    ['emptyBodyOf', L.emptyBodyOf],
    ['truncatedTailOf', L.truncatedTailOf],
    ['judge', L.judge],
    ['verdict', L.verdict],
    ['judgeText', L.judgeText],
    ['run', L.run],
    ['parseArgv', L.parseArgv],
  ].map(([name, fn]) => `${name}:\n${Function.prototype.toString.call(fn)}`)
  const src = fnBodies.join('\n')
  for (const f of FORBIDDEN)
    assert.ok(!src.includes(f), `判据函数体里出现了 ${f} —— 这把尺子必须只读`)
  assert.match(src, /readPlan/, '取材必须走 readPlan(面纪律的唯一出口),不是自己拼 git show')
})

test('形状锁:行识别与括注扫描都不许有第二份实现(§0.6/§22c)', () => {
  const libSrc = readFileSync(LIB_FILE, 'utf8')
  const gateSrc = readFileSync(GATE_FILE, 'utf8')
  assert.match(
    libSrc,
    /import \{[^}]*parseTaskRows[^}]*\} from '\.\/plan-task-index\.mjs'/,
    '登记行识别必须 import parseTaskRows',
  )
  assert.match(libSrc, /matchBalancedGroupAt/, '括注扫描必须用既有原语,不写第二台分词器')
  for (const [name, src] of [
    ['lib', libSrc],
    ['gate', gateSrc],
  ]) {
    assert.ok(
      !src.includes('[ xX]'),
      `${name} 里出现了复选框正则字面量形状 [ xX] —— 那就是第二份行识别(plan-line-age 头注记过 308→229 的失明事故)`,
    )
    assert.ok(!/\[\s*-\s*\*\s*\]\\s\\\[\s/.test(src), `${name} 里疑似自带一条复选框正则`)
  }
  assert.ok(
    !/CHECKBOX_RE/.test(libSrc) && !/CHECKBOX_RE/.test(gateSrc),
    'CHECKBOX_RE 未导出也不该被复制:识别只走 parseTaskRows',
  )
  assert.ok(
    !/import\s*\{[^}]*parseTaskRows[^}]*\}\s*from/.test(gateSrc),
    '门体薄壳不得自己 import 解析器(判据与取材住 lib,门体只吃 parseArgv/run/USAGE)',
  )
})

test('形状锁:§22d 入口守卫齐备 —— import 不触发 main(),测试才敢直接用生产判据', () => {
  for (const [file, src] of [
    [GATE_FILE, readFileSync(GATE_FILE, 'utf8')],
    [LIB_FILE, readFileSync(LIB_FILE, 'utf8')],
  ]) {
    if (!src.includes('main()')) continue
    assert.match(
      src,
      /pathToFileURL\(process\.argv\[1\]\)\.href/,
      `${file} 的守卫必须用 pathToFileURL(手拼 file:/// 在 Windows 永不成立)`,
    )
    assert.match(src, /const isDirectRun/, `${file} 缺 isDirectRun 守卫`)
    assert.ok(!/'file:\/\/\/' \+/.test(src), `${file} 不得手拼 file:///`)
  }
  assert.equal(typeof GATE.main, 'function', '门体出口供问责复用(本测试不调它:它会读 process.argv)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
