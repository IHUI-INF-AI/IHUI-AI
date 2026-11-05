#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * check-miniapp-interaction-hygiene.test.mjs — 守门 290 的 §22c 镜像测试
 *
 * 取向:一律 import 源文件的 `__test__` 导出,**不复制判据实现**;夹具现造字符串,
 * 不依赖真仓当前存量(教训:棘轮自测别把存量路径写死);接线对账读 guardian-runner 原文。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { __test__ as G } from '../check-miniapp-interaction-hygiene.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const RUNNER = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
const SELF = readFileSync(join(ROOT, 'scripts/check-miniapp-interaction-hygiene.mjs'), 'utf8')

test('T1 判据夹具:空 handler / 非可调用 / 样式层死点击 ⇒ 三条 blocking', () => {
  const tags = [
    { tag: 'View', attrs: ' onClick={() => {}}', line: 1 },
    { tag: 'Text', attrs: ' onClick={undefined}', line: 2 },
    { tag: 'View', attrs: ' className="pointer-events-none" onClick={() => go()}', line: 3 },
  ]
  const r = G.judgeClickable(tags)
  assert.deepEqual(
    r.blocking.map((v) => v.rule),
    ['A1-empty-handler', 'A1-non-callable', 'A1-pointer-events-none'],
  )
  assert.equal(r.advisory.length, 0, 'A3 不该在这些死可点上重复刷')
})

test('T2 noop 绑定:本文件声明的空函数被当 handler ⇒ 红', () => {
  const src = 'const noop = () => {}\nconst A = () => <View onClick={noop}>x</View>'
  const r = G.scanSource(src)
  assert.ok(r.blocking.some((v) => v.rule === 'A1-empty-handler'), 'noop 绑定未判红')
})

test('T3 端口判据:JSX 属性与对象字面量两种写法都认,正常端口不误报', () => {
  const bad = G.judgePortAssignments('<Shell onNavigate={() => {}} onToast={() => undefined} />')
  assert.equal(bad.length, 2)
  const good = G.judgePortAssignments('<Shell onNavigate={() => Taro.navigateTo({ url: "/x" })} onToast={show} />')
  assert.equal(good.length, 0, '正常端口被误报')
})

test('T4 端口名与端口等价门同源(不造第二套黑名单)', () => {
  assert.ok(G.PORT_NAMES.length >= 8, `端口名过少:${G.PORT_NAMES.length}`)
  assert.ok(G.PORT_NAMES.includes('onNavigate') && G.PORT_NAMES.includes('onToast'))
  assert.ok(G.ALL_PORT_NAMES.includes('onPickFile'), '本票点名的 onPickFile 不在射程')
})

test('T5 A3 是 advisory:View 无 hoverClass 不进 blocking,且导航项放过', () => {
  const noFeedback = G.scanSource('<View onClick={() => open(id)}>x</View>')
  assert.equal(noFeedback.blocking.length, 0, 'A3 侵入了 blocking')
  assert.ok(noFeedback.advisory.some((v) => v.rule === 'A3-no-feedback'))
  const nav = G.scanSource('<View onClick={() => Taro.navigateTo({ url: "/p" })}>x</View>')
  assert.equal(nav.advisory.length, 0, '导航项被误报')
})

test('T6 modal 判据:单按钮提示 ⇒ advisory;带取消语义 ⇒ 不报', () => {
  assert.equal(G.judgeModalMisuse('Taro.showModal({ title: "提示", content: "ok" })').length, 1)
  assert.equal(G.judgeModalMisuse('Taro.showModal({ title: "确认", content: "删?", showCancel: true })').length, 0)
  assert.equal(G.judgeModalMisuse('Taro.showModal({ title: "确认", success: (res) => { if (res.cancel) return } })').length, 0)
})

test('T7 台账:到期即红;缺 owner/evidence/expires/rationale 逐条点名', () => {
  const expired = G.judgeLedger(
    [],
    [
      {
        file: 'a.tsx',
        rule: 'A1-empty-handler',
        count: 0,
        owner: 'o',
        expires: '2020-01-01',
        evidence: 'e',
        rationale: 'r',
      },
    ],
    { today: '2026-11-03' },
  )
  assert.equal(expired.expired.length, 1)
  const malformed = G.judgeLedger([], [{ file: 'a.tsx', rule: 'A1-empty-handler' }], { today: '2026-11-03' })
  assert.equal(malformed.malformed.length, 4)
})

test('T8 台账计数配平:新增未挂账红 / 存量减少只 advisory(清单腐烂)', () => {
  const v = [
    { file: 'a.tsx', rule: 'A1-empty-handler' },
    { file: 'a.tsx', rule: 'A1-empty-handler' },
  ]
  const over = G.judgeLedger(
    v,
    [
      {
        file: 'a.tsx',
        rule: 'A1-empty-handler',
        count: 1,
        owner: 'o',
        expires: '2099-01-01',
        evidence: 'e',
        rationale: 'r',
      },
    ],
    { today: '2026-11-03' },
  )
  assert.equal(over.red.length, 1)
  const under = G.judgeLedger(
    [],
    [
      {
        file: 'a.tsx',
        rule: 'A1-empty-handler',
        count: 3,
        owner: 'o',
        expires: '2099-01-01',
        evidence: 'e',
        rationale: 'r',
      },
    ],
    { today: '2026-11-03' },
  )
  assert.equal(under.red.length, 0)
  assert.ok(under.advisory.length >= 1)
})

test('T9 自检全绿(23 例:5 类误报判据各带正反例 + A3 台账)', () => {
  assert.equal(G.runSelfTest(), 23)
})

test('T10 接线对账:gate 290 已注册进 guardian-runner,blocking + staged 触发面 + skip env', () => {
  const block = RUNNER.slice(RUNNER.indexOf("id: '290'"), RUNNER.indexOf("id: '291'"))
  assert.ok(block.length > 0, "guardian-runner 里找不到 id: '290'")
  assert.match(block, /script: 'check-miniapp-interaction-hygiene\.mjs'/)
  assert.match(block, /mode: 'blocking'/)
  assert.match(block, /stagedTriggers:/)
  assert.match(block, /skipEnv: 'HUSKY_SKIP_MINIAPP_INTERACTION_HYGIENE'/)
  assert.match(SELF, /守门 290/)
  assert.match(SELF, /集成位置: .*guardian-runner\.mjs 第 290 项/)
})

test('T11 账本文件在仓且条目形制齐全(A3 豁免须 rationale + expires ≥ 2027-01-31)', () => {
  const raw = JSON.parse(readFileSync(join(ROOT, 'scripts/data/miniapp-interaction-allowlist.json'), 'utf8'))
  assert.ok(Array.isArray(raw.entries))
  for (const e of raw.entries) {
    assert.ok(e.owner && e.expires && e.evidence && e.rationale, `条目缺 owner/expires/evidence/rationale:${JSON.stringify(e)}`)
    assert.match(e.expires, /^\d{4}-\d{2}-\d{2}$/)
    if (/^A3/.test(e.rule)) assert.ok(e.expires >= G.ADVISORY_MIN_EXPIRES, `A3 挂账期过短:${JSON.stringify(e)}`)
  }
})

test('T12 被审面口径:跳过 rn-compat 垫片与测试文件', () => {
  const { files } = G.listSourceFiles()
  assert.ok(files.length > 0)
  assert.ok(!files.some((f) => f.includes('/rn-compat/')), 'rn-compat 垫片进了射程')
  assert.ok(!files.some((f) => /\.(test|spec)\.(ts|tsx)$/.test(f)), '测试文件进了射程')
  assert.ok(files.every((f) => f.startsWith('apps/miniapp-taro/src/')), '射程越界到别端')
})
