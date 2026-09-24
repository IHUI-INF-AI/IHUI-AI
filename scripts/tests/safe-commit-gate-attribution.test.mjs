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
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
