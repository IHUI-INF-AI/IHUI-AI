// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * safe-commit 钩子归因判据的镜像测试(AGENTS.md §22c)。
 *
 * 钉三件事:
 *  ① 判据本身 —— 直接 import 源模块跑 `selfTest`(不复制实现,复制就是两份真相);
 *  ② 夹具格式与 runner 的实际打印同源 —— runner 改了措辞而这里没跟上,归因会静默退化成
 *     "永不归因"(表现是照常 --no-verify,只是再也没人说清红是谁的);
 *  ③ 装车证明 —— 判据必须真被 safe-commit 接上。"脚本造好没装车"在本仓至少发生过三次
 *     (守门 64 / 70 / 76 的登记教训),没有这一条,本文件前两条全绿也等于没有这道门。
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { selfTest, __test__ } from '../lib/commit-gate-attribution.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const runnerSource = readFileSync(join(here, '..', 'guardian-runner.mjs'), 'utf8')
const safeCommitSource = readFileSync(join(here, '..', 'safe-commit.mjs'), 'utf8')

test('判据自测:夹具可解析 + A1–A10 十条正反对照(含 mine 必拒跳)', () => {
  const r = selfTest(assert, runnerSource)
  assert.equal(r.parsedFixture.failed[0].id, '29', '阳性对照本身要成立,否则下面全是空断言')
})

test('归因不得反向:同一文本在"点名本次文件"与"不点名"两种复跑结果下必须给出不同结论', () => {
  const { classifyHookFailure, SUMMARY, FAIL_29, MY_FILES } = __test__
  const text = SUMMARY + FAIL_29
  const mine = classifyHookFailure({
    text,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: 'x scripts/foo.mjs:1 违规' }),
  }).kind
  const notMine = classifyHookFailure({
    text,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: 'y apps/web/src/other.tsx:1 违规' }),
  }).kind
  assert.equal(mine, 'mine')
  assert.equal(notMine, 'not-ours')
  assert.notEqual(mine, notMine, '两型必须可分 —— 同判一种就是判据失效')
})

test('装车证明:safe-commit 必须真的 import 并调用本判据', () => {
  assert.match(
    safeCommitSource,
    /from\s+'\.\/lib\/commit-gate-attribution\.mjs'/,
    '未 import 归因判据 ⇒ 本门没有装车',
  )
  assert.match(
    safeCommitSource,
    /classifyHookFailure\(/,
    'import 了却没调用 ⇒ 判据存在而永不执行,等于没有(守门 70/76 同型)',
  )
  // 只有 mine 这一条路径允许"拒绝跳门";缺了它就退回旧的"一律 --no-verify"
  assert.match(
    safeCommitSource,
    /kind\s*===\s*'mine'[\s\S]{0,400}process\.exit\(1\)/,
    'mine 分支必须中止提交,不得继续走 --no-verify',
  )
  assert.match(
    safeCommitSource,
    /留痕|attestation/i,
    '跳门必须留下可事后核查的记录,否则每一次跳过都长得像没跳过',
  )
  // 第二输入源必须真接上:实测 pre-commit 把汇总只写进日志,不接它的归因命中率恒为 0
  assert.match(
    safeCommitSource,
    /fallbackText\s*:\s*hookLogTail/,
    '未接日志尾部第二输入源 ⇒ 真仓里永远只会得到 unattributed',
  )
})

/**
 * 反"造好没装车"的第三层:判据模块自身若不再被使用,本仓库里那三条裸 git 判据
 * (`scripts/tests/face-reader.test.mjs`)就没人跑 —— 归因会悄悄退回"整段 includes"那一型。
 * 这里只钉**不变量**(必须有东西引用它 + 裸 git 判据必须存在),不钉条目,免得合法重构把测试钉死。
 */
test('判据不得变成孤儿模块:必须有生产代码 import 它,且裸 git 反例判据仍在', () => {
  assert.match(safeCommitSource, /lib\/commit-gate-attribution/, '判据已无人引用(孤儿)')
  const faceReaderTest = readFileSync(join(here, 'face-reader.test.mjs'), 'utf8')
  assert.match(
    faceReaderTest,
    /bareGitCount/,
    '裸 git 派生的反例判据不在了 ⇒ "收口成一层"这件事没有哨兵,重复实现会重新长回来',
  )
})

test('反向对照:旧那句未经计算的"因其他 agent 代码"不得再作为唯一措辞出现', () => {
  // 允许在注释/历史说明里提到它,但它不能再是直接抛给用户的那条结论
  const claims = safeCommitSource
    .split(/\r?\n/)
    .filter((l) => l.includes('其他 agent 代码'))
    .filter((l) => /^\s*(log|console)/.test(l))
  assert.equal(claims.length, 0, `仍有把归因当结论直接打印的行:\n${claims.join('\n')}`)
})

/**
 * 真实日志取样(不是夹具):本机每次跳门都会把 runner 的原始输出追加到
 * `.workbuddy/hook-logs/pre-commit.log`,里面就有**实际印出来的**失败门清单。
 * 用它复核解析锚点,才能证明夹具不是我照着自己的想象写的。
 * 该文件属机器运行态且被 gitignore —— 缺席时如实记"未判定",**不计为通过**。
 */
test('真实钩子日志取样:解析结果必须与手工核对一致(缺席则判未判定,不计绿)', (t) => {
  const logPath = join(here, '..', '..', '.workbuddy', 'hook-logs', 'pre-commit.log')
  if (!existsSync(logPath)) {
    t.skip('本机无 .workbuddy/hook-logs/pre-commit.log ⇒ 未判定(不记为通过)')
    return
  }
  const text = readFileSync(logPath, 'utf8')
  const p = __test__.parseGateSummary(text)
  assert.equal(p.batchReported, true, '真实日志里存在汇总块却解析不到 ⇒ 格式锚点已漂')
  assert.ok(p.failed.length > 0, '真实日志含跳门记录,却一条失败门都没解析出来')
  assert.ok(
    p.failed.every((f) => /^[0-9a-z][0-9a-z-]*$/i.test(f.id) && f.script.endsWith('.mjs')),
    `解析出的 id/script 形态异常,说明正则跨行吃错了内容:${JSON.stringify(p.failed.slice(0, 3))}`,
  )
  const ids = p.failed.map((f) => f.id)
  assert.equal(new Set(ids).size, ids.length, '真实日志(多轮追加)取样后仍含重复 ⇒ 去重失效')

  // 顺着**真实**汇总块把"自跑取证"这一支跑一遍:证明新分支吃得下线上形态,不只吃得下我写的夹具
  // (§22c 的教训:镜像测试若只复读实现,它就只是复读机。)
  const block = text.slice(text.lastIndexOf('🛡️ 守门脚本批量检查汇总'))
  const bp = __test__.parseGateSummary(block)
  const d = __test__.decideWithSelfRunBatch({
    verdict: stalledVerdict('❌ 🎨 运行 lint-staged...失败，提交已阻止'),
    stagedFiles: ['scripts/foo.mjs'],
    hookText: '❌ 🎨 运行 lint-staged...失败，提交已阻止',
    runBatch: () => ({ ran: true, status: bp.failed.length ? 1 : 0, output: block, why: null }),
    runGate: () => ({ status: 0, output: '' }),
  })
  assert.notEqual(
    d.kind,
    'unattributed',
    `真实汇总块喂进自跑分流仍判"无结论" ⇒ 自跑等于白跑(块首 120 字:${block.slice(0, 120)})`,
  )
  if (bp.failed.length > 0)
    assert.equal(
      d.failed.length,
      bp.failed.length,
      '自跑分流必须原样带上真实失败门清单,不得在转换中丢条目',
    )
})

test('A12 跳门重试前必须重新暂存(否则"含新文件 + 归因允许跳门"这一整类提交永远落不了地)', () => {
  // 实测成因(2026-09-25)：pre-commit 里 lint-staged 失败会回滚它动过的暂存区 ⇒ Step 2 加进去的
  // **新文件**在重试那一刻已退回未跟踪，而 `git commit -- <pathspec>` 对 git 不认识的路径直接
  // `error: pathspec ... did not match any file(s) known to git` 退出 1。
  // 后果不是"重试慢一点"，而是**这条路对带新文件的提交根本不存在** ——
  // 本次实测 10 个声明文件里 4 个新文件全部 unknown，提交零落地，而归因本身判对了"红不在本次内容里"。
  const retryAt = safeCommitSource.indexOf('commitArgs(true)')
  assert.ok(retryAt > 0, '源码里找不到跳门重试调用(改过结构就得同步改本断言)')
  const window = safeCommitSource.slice(Math.max(0, retryAt - 1800), retryAt)
  // 本断言在 HEAD 上就是红的(实测:未改任何文件时跑本文件,该例 fail 于 `/git add \(retry\)/`
  // 不匹配该窗口)。红因是 `221078310`(跳门兜底按"在场/删除"三态分流)把重暂存的日志标签改成了
  // `git add (retry: 在场文件)` / `(retry: 删除态)` —— **行为还在、断言先红**,属测试侧陈旧而非功能缺陷。
  // 现放宽到前缀:本断言要钉的是"重试前重跑了 Step 2 的 add",不是那条日志的措辞。
  assert.match(window, /git add \(retry/, '重试前必须重跑 Step 2 的 add —— 缺了就等于没有应急路径')
  assert.match(
    window,
    /git diff --cached --name-only --no-renames/,
    '重试前必须重跑 Step 3 的暂存集校验：不校验就重试，等于放弃"只提交自己声明的文件"这条根约束',
  )
  // 收窄的那一半同样要钉住：只拒"缺失"，**不拒"多余"**。
  // 第一版对多余也 exit 1，结果把自己锁死了 —— `git commit -- <pathspec>` 按定义只交声明过的路径，
  // 并发会话在窗口期 staged 的东西本来就进不了本枚提交，拒它等于拿一个不存在的风险卡死应急通道。
  assert.match(window, /if \(reMissing\.length\)/, '缺失必须判死')
  assert.doesNotMatch(
    window,
    /if \(reUnexpected\.length \|\| reMissing\.length\)/,
    '不得再把"多余"也判成中止条件',
  )
  assert.match(window, /不随本枚提交走/, '多余项要如实报一行，而不是静默、也不是中止')
})

/**
 * 「批没跑完 ⇒ safe-commit 自跑取证」这一支(2026-09-26 立)。
 *
 * 全部用**构造输入**证明,不依赖真仓瞬时状态(真仓的 lint/门结论天天在漂,拿它当判据的测试
 * 明天就会红在一个与本次改动无关的原因上)。
 *
 * 立因(实测):`scripts/lib/pre-commit-hook.js` 里 lint-staged(:97)跑在
 * `guardian-runner --staged`(:266)**之前**,任一 lint 失败即 exit 1 ⇒ 整批门一道都没跑
 * ⇒ 归因层只能记 unattributed ⇒ 照旧 --no-verify。一次 lint 错误 = 全部守门被静默跳过。
 */

/** 全绿的批汇总(自跑最常见的产出:155 道门全过,红其实在批外的 lint-staged)。 */
const GREEN_BATCH = `
🛡️ 守门脚本批量检查汇总
  总检查数: 155(已执行 155)
  通过: 154
  警告: 1
  失败: 0
  跳过: 0
`

/** 首轮结论:钩子输出里根本没有汇总块(= lint-staged 把批挡在了前面)。 */
function stalledVerdict(hookText) {
  const { classifyHookFailure, MY_FILES } = __test__
  return classifyHookFailure({
    text: hookText ?? '❌ 🎨 运行 lint-staged...失败，提交已阻止',
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 0, output: '' }),
  })
}

test('三支之一 · 自跑点名本次文件 ⇒ 判 mine,并交代取证来源', () => {
  const { decideWithSelfRunBatch, MY_FILES, SUMMARY, FAIL_29 } = __test__
  const v = decideWithSelfRunBatch({
    verdict: stalledVerdict(),
    stagedFiles: MY_FILES,
    hookText: '❌ 🎨 运行 lint-staged...失败，提交已阻止',
    runBatch: () => ({ ran: true, status: 1, output: SUMMARY + FAIL_29, why: null }),
    // 同一把铰链:自跑里那道红门复跑后点名了本次声明的文件
    runGate: () => ({ status: 1, output: '  ✗ scripts/foo.mjs:12 违规' }),
  })
  assert.equal(v.kind, 'mine')
  assert.equal(v.batchSelfRun, true)
  assert.equal(v.selfRunOk, true)
  assert.match(v.reason, /自跑的那一轮守门批/, 'mine 的措辞必须交代取证来源')
  assert.match(v.reason, /禁止 --no-verify/, 'mine 的出口仍然必须是"修",不得被新分支洗软')
  assert.match(
    v.detail.join('\n'),
    /红在守门批\*\*之前\*\*的那一步「🎨 运行 lint-staged\.\.\.」/,
    '必须点名是哪一步把批挡住的(量出来的,不是猜的)',
  )
})

test('三支之二 · 自跑一个都没点名 ⇒ 可跳,但措辞只能说量到的话并交代来源', () => {
  const { decideWithSelfRunBatch, verdictLine, MY_FILES, SUMMARY, FAIL_29 } = __test__
  // A) 批全绿(blocking 失败 0)—— 这是"没有一门点名本次文件"的**结构性**证据
  const green = decideWithSelfRunBatch({
    verdict: stalledVerdict(),
    stagedFiles: MY_FILES,
    hookText: '❌ 🎨 运行 lint-staged...失败，提交已阻止',
    runBatch: () => ({ ran: true, status: 0, output: GREEN_BATCH, why: null }),
    runGate: () => ({ status: 0, output: '' }),
  })
  assert.equal(green.kind, 'not-ours')
  assert.equal(green.ranFullBatch, true, '自跑确实跑完整批 ⇒ 不得记成"批未跑完"')
  assert.match(green.reason, /blocking 失败 0/, '理由必须是量到的数字')
  assert.match(green.reason, /红不在守门批/)
  const line = verdictLine(green)
  assert.match(line, /safe-commit 自跑/, '措辞必须点名取证来源,否则与"钩子里跑过了"同形')
  assert.match(line, /钩子内那一轮从未跑到批量检查/)
  assert.match(line, /不得把这行读成"守门没跑"/)
  // B) 批有红、但复跑未点名本次文件 ⇒ 仍是 not-ours(旧铰链的原样结论 + 来源标注)
  const otherRed = decideWithSelfRunBatch({
    verdict: stalledVerdict(),
    stagedFiles: MY_FILES,
    hookText: '❌ 🎨 运行 lint-staged...失败，提交已阻止',
    runBatch: () => ({ ran: true, status: 1, output: SUMMARY + FAIL_29, why: null }),
    runGate: () => ({ status: 1, output: '  ✗ apps/web/src/other.tsx:3 类型错误' }),
  })
  assert.equal(otherRed.kind, 'not-ours')
  assert.match(otherRed.detail.join('\n'), /未点名本次任何文件/, '仍要如实记录"该门复跑仍红"')
})

test('三支之三 · 自跑本身也没成功 ⇒ 仍按应急路径落地,但 unattributed 必带具体原因', () => {
  const { decideWithSelfRunBatch, verdictLine, MY_FILES } = __test__
  // A) 派生失败(runner 不可用 / 超时)
  const spawnFail = decideWithSelfRunBatch({
    verdict: stalledVerdict(),
    stagedFiles: MY_FILES,
    hookText: '❌ 🎨 运行 lint-staged...失败，提交已阻止',
    runBatch: () => ({ ran: false, status: null, output: '', why: '派生失败 ENOENT' }),
    runGate: () => ({ status: 0, output: '' }),
  })
  assert.equal(spawnFail.kind, 'unattributed', '自跑失败不得被洗成 not-ours')
  assert.equal(spawnFail.selfRunOk, false)
  assert.match(spawnFail.reason, /自跑 guardian-runner 同样未成功\(派生失败 ENOENT\)/)
  assert.match(verdictLine(spawnFail), /自跑取证也未取得门级结论/)
  assert.match(verdictLine(spawnFail), /^\s*⚠️/, '未归因必须仍是警示口吻')
  assert.match(verdictLine(spawnFail), /请勿/, '未归因必须自带"不得当成已通过"的警示')
  // B) 跑了但解析不出汇总(格式漂了)⇒ 同一条要求:带上"自跑也未成功"
  const unparseable = decideWithSelfRunBatch({
    verdict: stalledVerdict(),
    stagedFiles: MY_FILES,
    hookText: '',
    runBatch: () => ({ ran: true, status: 1, output: 'fatal: runner 启动失败', why: null }),
    runGate: () => ({ status: 0, output: '' }),
  })
  assert.equal(unparseable.kind, 'unattributed')
  assert.match(unparseable.reason, /自跑也未成功/, '这一支的措辞必须显式承认自跑也没拿到结论')
  // C) runBatch 抛异常 ⇒ 不得把整条提交流程炸掉,仍落 unattributed
  const threw = decideWithSelfRunBatch({
    verdict: stalledVerdict(),
    stagedFiles: MY_FILES,
    hookText: '',
    runBatch: () => {
      throw new Error('spawn 崩了')
    },
    runGate: () => ({ status: 0, output: '' }),
  })
  assert.equal(threw.kind, 'unattributed')
  assert.match(threw.reason, /自跑抛异常:spawn 崩了/)
})

/**
 * 反向锁(硬要求 ① / 取证 ③):"批跑完了且解析到汇总"那一支**不得**被新分支截走。
 * 证明形式是**spy 计数** —— 汇总块存在时 runBatch 必须一次都没被调用,
 * 且返回的结论除 batchSelfRun:false 外与首轮**逐字段等值**(新分支不得改写字段)。
 */
test('反向锁 · 汇总块在位时绝不自跑,且旧分支结论逐字段不变', () => {
  const {
    classifyHookFailure,
    decideWithSelfRunBatch,
    needsBatchSelfRun,
    MY_FILES,
    SUMMARY,
    FAIL_29,
  } = __test__
  const old = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 0, output: '已通过' }),
  })
  assert.equal(old.kind, 'not-ours', '前提:旧分支本身要给 not-ours')
  assert.equal(old.ranFullBatch, true)
  assert.equal(needsBatchSelfRun(old), false, '批跑完且解析到汇总 ⇒ 不该自跑')
  let calls = 0
  const passed = decideWithSelfRunBatch({
    verdict: old,
    stagedFiles: MY_FILES,
    hookText: SUMMARY + FAIL_29,
    runBatch: () => {
      calls++
      return { ran: true, status: 0, output: GREEN_BATCH, why: null }
    },
    runGate: () => ({ status: 0, output: '已通过' }),
  })
  assert.equal(calls, 0, '汇总块在位却调了自跑 ⇒ 新分支截走了旧分支(C0–C3 那条链的行为被改了)')
  assert.equal(passed.batchSelfRun, false)
  const rest = { ...passed }
  delete rest.batchSelfRun
  assert.deepEqual(rest, old, '旧分支的每个字段都必须原样保留')
  // mine 同样不该自跑:它的出口已是"拒绝跳门",再跑只多花几分钟
  const mine = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: '  ✗ scripts/foo.mjs:1 违规' }),
  })
  assert.equal(mine.kind, 'mine')
  assert.equal(needsBatchSelfRun(mine), false, '已判 mine 不该再自跑')
  // 提前中止(批未跑完)必须触发自跑 —— 这一型是"其后各门从未跑过"
  const aborted = classifyHookFailure({
    text: SUMMARY.replace('(已执行 134)', '(已执行 3 ← 提前中止)') + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 0, output: '' }),
  })
  assert.equal(aborted.ranFullBatch, false, '前提:提前中止要标出来')
  assert.equal(needsBatchSelfRun(aborted), true, '批未跑完 ⇒ 必须触发自跑取证')
})

test('批前拦截步骤的点名:形态必须与 run() 的打印同形,且不得认错批本身', () => {
  const { blockedBeforeBatch } = __test__
  // 阳性:实测那一行的原文
  assert.equal(
    blockedBeforeBatch('❌ 🎨 运行 lint-staged...失败，提交已阻止'),
    '🎨 运行 lint-staged...',
    '认不出 lint-staged 这一步 = 新分支又退回"中性事实"的措辞',
  )
  // 阴性:批自己红了(有汇总块)⇒ 不该把批说成"批之前"
  assert.equal(
    blockedBeforeBatch(GREEN_BATCH + '❌ 🛡️ 运行守门脚本批量检查...失败，提交已阻止'),
    null,
  )
  assert.equal(blockedBeforeBatch('❌ 🛡️ 运行守门脚本批量检查...失败，提交已阻止'), null)
  assert.equal(blockedBeforeBatch(''), null, '无输出时判不出就返回 null,不得编一个步骤名')
})

test('装车证明(2026-09-26 新增支):批没跑完 ⇒ safe-commit 必须真自跑并用同一铰链分流', () => {
  // ① 判"该不该自跑"与"分流"都必须被真的调用 —— 函数在、自检过、主流程没调它,是本仓最高频失效型
  assert.match(
    safeCommitSource,
    /needsBatchSelfRun\(/,
    '未引用 needsBatchSelfRun ⇒ 触达条件没人判,自跑要么恒触发要么永不触发',
  )
  assert.match(
    safeCommitSource,
    /decideWithSelfRunBatch\(\{[\s\S]{0,600}runBatch:\s*runBatchSelf[\s\S]{0,120}runGate,[\s\S]{0,120}hookText/,
    '分流出口没接自跑闭包或没共用 runGate ⇒ 铰链就不是"同一把"了(守门 70/76/81/102 同型)',
  )
  // ② 自跑那一条 spawn 的三条硬约束(守门 52 windowsHide / 守门 80 数字超时 / 绝对路径 node)
  const at = safeCommitSource.indexOf('const runBatchSelf')
  assert.ok(at > 0, '找不到自跑出口 runBatchSelf ⇒ 新分支没有落点')
  const block = safeCommitSource.slice(at, at + 1800)
  // 判**代码面**:注释里写"不用 shell:true"是解释,不该被自己的判据当成违规(否则门只拦得住
  // 忘记写注释的人)。剥掉行注释与块注释后再核 options。
  const code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\S\n]*\/\/.*$/gm, '')
  assert.match(code, /guardian-runner\.mjs/, '自跑必须跑真正的守门批,不是某一道单门')
  assert.match(code, /process\.execPath/, 'node 必须走绝对路径(process.execPath),裸 node 依赖 PATH')
  assert.match(code, /windowsHide:\s*true/, '漏 windowsHide ⇒ Windows 下必弹控制台窗口(守门 52)')
  assert.match(code, /timeout:\s*timeoutMs/, '漏数字 timeout ⇒ 无界挂起会把提交钉死(守门 80)')
  assert.doesNotMatch(
    code,
    /shell:\s*true/,
    'shell:true 会为每条子命令拉起可见 cmd.exe(§5b 事故同型)',
  )
  // ③ 自跑出口全仓只能有一处(第二处 = 第二份取证形态,必然与这一处漂移)
  // 只数**取路径那一处**:给人类看的提示行里也会写命令原文,那不算调用点。
  const pathSites = (safeCommitSource.match(/'guardian-runner\.mjs'/g) || []).length
  assert.equal(
    pathSites,
    1,
    `出现 ${pathSites} 处 guardian-runner 取路径 ⇒ 调用点分叉(取证面开始有两份)`,
  )
  assert.equal(
    (code.match(/spawnSync\(/g) || []).length,
    1,
    '自跑闭包里不止一次 spawn ⇒ 同一轮取证被跑两遍会得出两份互相矛盾的汇总',
  )
  // ④ 结论与原因必须落进**既有**记录,不得另立平行落盘文件
  const attestAt = safeCommitSource.indexOf('safe-commit-attestation.jsonl')
  assert.ok(attestAt > 0)
  const attestBlock = safeCommitSource.slice(attestAt, attestAt + 1200)
  assert.match(attestBlock, /batchSelfRun/, '自跑结论没进既有的 jsonl 记录 ⇒ 事后无从核查这一支')
  assert.match(attestBlock, /selfRunOk/, '自跑成败没进记录 ⇒ "跑过但没结论"与"没跑"无法区分')
  assert.equal(
    (safeCommitSource.match(/appendFileSync\(/g) || []).length,
    1,
    '出现了第二个落盘点 ⇒ 第二份真相(硬要求③)',
  )
})


test('反向回归锁:没有汇总块时,必须先试"那一步有没有点名我",再落到未归因', () => {
  // 立因是实测:提交 9bd6748ba 里 lint-staged 报的是**我自己刚写出来的** eslint 错误
  // ('Undetermined' is defined but never used),但它跑在守门批之前 ⇒ 没有汇总块 ⇒
  // 旧实现直接落 unattributed ⇒ 照样 --no-verify 落地。那是 48ac2c03e 那条事故路径的第二个入口:
  // 第一个入口"借了别人那轮汇总"已被轮次绑定关掉,这个入口是"根本没有汇总,于是连尝试归因都没有"。
  const src = readFileSync(join(here, '..', 'lib', 'commit-gate-attribution.mjs'), 'utf8')
  const region = src.slice(
    src.indexOf('if (parsed.batchReported && parsed.failed.length === 0)'),
    src.indexOf('let mine = 0'),
  )
  assert.ok(region.length > 100, '没切到归因分支 ⇒ 本锁变成空判据')
  const blame = region.indexOf('blameFromFailedStep(')
  const unattr = region.indexOf("kind: 'unattributed'")
  assert.ok(blame >= 0, '未归因出口前必须再做一次"报错正文有没有点名本次文件"的尝试')
  assert.ok(unattr >= 0 && blame < unattr, '定责尝试必须排在未归因出口之前,顺序反了等于没有')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
