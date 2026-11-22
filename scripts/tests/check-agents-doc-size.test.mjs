// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-agents-doc-size.mjs(§22c:只 import 生产判据,不在测试里复制阈值/算法)。
//
// 为什么必须有:本门判的是"每轮注入面有多大"这种只有数字的东西,算错的表现不是报错,
// 而是一行看起来正常的 `✅ … 字节(预算 …)` —— 即本仓最高频失效型"数字在、口径错"。
// 三条最容易静默失效的口径在此钉死:①按 UTF-8 字节而不是字符(CJK 1 字符=3 字节,按字符计
// 会把 1.26 MB 的巨型文件量成"四折"预算内);②取不到面必须返回 null 让调用方 exit 2,
// 绝不返回 over:false 冒充判绿(§0.3);③注册条目一旦存在,mode/args/id 必须成套,**且不得声明
// skipEnv** —— 门 207 的跳过口已于 2026-11-05 摘除(RP-5 ③),把变量加回必须被判红,见末条反向例。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const SRC = resolve(fileURLToPath(import.meta.url), '../../check-agents-doc-size.mjs')
const SRC_TEXT = readFileSync(SRC, 'utf8')
const { __test__ } = await import(pathToFileURL(SRC).href)

test('判据出口齐备(镜像只 import,不复制实现)', () => {
  assert.equal(typeof __test__.judgeSize, 'function')
  assert.equal(__test__.FILE, 'AGENTS.md')
  assert.equal(typeof __test__.BUDGET_BYTES, 'number')
  assert.ok(__test__.BUDGET_BYTES > 0)
})

test('预算内判绿 / 超限判红', () => {
  assert.equal(__test__.judgeSize('a'.repeat(10), 'head', 100).over, false)
  assert.equal(__test__.judgeSize('a'.repeat(101), 'head', 100).over, true)
  assert.equal(__test__.judgeSize('a'.repeat(100), 'head', 100).over, false, '恰好等于预算不得算超')
})

test('按 UTF-8 字节量纲,不按字符数(CJK 每字 3 字节)', () => {
  const v = __test__.judgeSize('啊'.repeat(34), 'head', 100)
  assert.equal(v.bytes, 102, '34 个 CJK 字符 = 102 字节,不是 34')
  assert.equal(v.over, true, '若按字符量纲这里会被错判成预算内')
})

test('取不到面 ⇒ null(不冒充"判过",更不记绿)', () => {
  for (const missing of [null, undefined, 0, '']) {
    if (missing === '') continue
    assert.equal(__test__.judgeSize(missing, 'head'), null, `收到 ${String(missing)} 必须判不出`)
  }
  assert.equal(__test__.judgeSize('', 'head').bytes, 0, '空字符串是取得到的面,判 0 字节')
})

/**
 * 装车形态的读取面 = **索引面优先,回退 HEAD**。
 * 为什么不是 HEAD-only:pre-commit 时刻 HEAD 还没含本次注册改动,读 HEAD 会把"刚摘掉跳过口"
 * 读成"还有跳过口",于是本测试在真提交链上假红。索引面才是"这一次要落地的形态",无暂存时与 HEAD 等价。
 * 为什么不是工作树副本:object-space-land 只推进 HEAD+索引、从不写盘,盘上那份会滞后(§22c 形态锁原话)。
 */
function readRunnerFace() {
  const show = (spec) =>
    execFileSync('git', ['show', spec], { encoding: 'utf8', maxBuffer: 2e8, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    return show(':scripts/guardian-runner.mjs')
  } catch {
    return show('HEAD:scripts/guardian-runner.mjs')
  }
}

test('装车形态锁:门 207 注册条目 blocking/args/id 齐备,且不得声明 skipEnv(逃生口已摘)', () => {
  const runnerText = readRunnerFace()
  const registered = runnerText.includes("script: 'check-agents-doc-size.mjs'")
  if (!registered) {
    assert.doesNotMatch(SRC_TEXT, /已接提交链/, '未注册的头注不能宣称已接线(守门 89 R1/R2)')
    assert.doesNotMatch(SRC_TEXT, /跳过 `?HUSKY_SKIP_[A-Z_]+/, '未注册时不得承诺一个 runner 里不存在的跳过变量(假逃生舱)')
  } else {
    const verdict = __test__.judgeRegistration(runnerText)
    assert.equal(verdict.ok, true, `注册形态判红:${verdict.reason}`)
  }
})

test('反向例:把 skipEnv 放回注册条目 ⇒ judgeRegistration 当场判红(摘除不是无人察觉)', () => {
  // 摘除若只是删了一行而无人看守,下一次有人"顺手恢复逃生舱"就会一路绿着落地。
  // 本用例把真实条目里的跳过口原样加回,要求生产判据翻红 —— 这是"摘除有牙"的证明。
  const runnerText = readRunnerFace()
  const anchor = "script: 'check-agents-doc-size.mjs'"
  const i = runnerText.indexOf(anchor)
  assert.ok(i >= 0, '注册条目必须在读取面里,否则本反向例没有对照物')
  const lineStart = runnerText.lastIndexOf('\n', i) + 1
  const lineEnd = runnerText.indexOf('\n', i)
  const line = runnerText.slice(lineStart, lineEnd < 0 ? runnerText.length : lineEnd)
  const reinflated = line.replace("mode: 'blocking'", "mode: 'blocking', skipEnv: 'HUSKY_SKIP_AGENTS_DOC_SIZE'")
  assert.notEqual(reinflated, line, '反向例没插进去(条目结构已变)⇒ 判据与装车形态已漂移,同样判红')
  const verdict = __test__.judgeRegistration(reinflated)
  assert.equal(verdict.ok, false, '把跳过口放回必须判红')
  assert.match(verdict.reason, /skipEnv/, `判红理由必须点名 skipEnv,实际:${verdict.reason}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
