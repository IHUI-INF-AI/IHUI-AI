#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * check-web-rn-copy-parity.test.mjs — 守门 291 的 §22c 镜像测试
 *
 * 取向:一律 import 源文件 `__test__`,**不复制判据实现**;夹具现造键值表,
 * 不把真仓存量(68 条账/287 屏)写死进断言;接线对账读 guardian-runner 原文。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { __test__ as G } from '../check-web-rn-copy-parity.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const RUNNER = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
const SELF = readFileSync(join(ROOT, 'scripts/check-web-rn-copy-parity.mjs'), 'utf8')
const MESSAGES = new Map([
  ['wallet.balance', '余额'],
  ['wallet.title', '我的钱包'],
  ['common.save', '保存'],
  ['wallet.save', '保存'],
])

test('T1 aligned 过滤:excluded/portal/gap 一律跳过,坏 JSON 行不炸', () => {
  const text = [
    '{"web":"wallet","rn":"rn/W.tsx","status":"aligned"}',
    '{"web":"a","rn":"rn/A.tsx","status":"excluded"}',
    '{"web":"b","rn":"rn/B.tsx","status":"portal"}',
    '{"web":"c","rn":"rn/C.tsx","status":"gap"}',
    'not-json',
    '{"web":"d","status":"aligned"}',
  ].join('\n')
  const { rows, skipped } = G.loadAlignedRows(text)
  assert.equal(rows.length, 1)
  assert.equal(skipped.excluded, 1)
  assert.equal(skipped.portal, 1)
  assert.equal(skipped.gap, 1)
})

test('T2 同屏同文案硬编码 ⇒ B1 红,并点名 web 键', () => {
  const r = G.judgeScreen(
    {
      web: 'wallet',
      rn: 'rn/W.tsx',
      webKeys: new Set(['wallet.balance']),
      rnKeys: new Set(),
      hardcoded: [{ kind: 'jsx-text', value: '余额', line: 7 }],
    },
    MESSAGES,
  )
  assert.equal(r.blocking.length, 1)
  assert.deepEqual(r.blocking[0].webKeys, ['wallet.balance'])
  assert.equal(r.advisory.length, 0)
})

test('T3 同值异键(同尾段) ⇒ 已裁决的命名约定,不判红', () => {
  const r = G.judgeScreen(
    { web: 'wallet', rn: 'rn/W.tsx', webKeys: new Set(['common.save']), rnKeys: new Set(['wallet.save']), hardcoded: [] },
    MESSAGES,
  )
  assert.equal(r.blocking.length, 0)
  assert.equal(r.advisory.length, 0)
  assert.equal(r.accepted.length, 1)
  assert.equal(r.accepted[0].rule, 'B2-accepted')
})

test('T4 同键不报;RN 自有中文(web 无同值键)不判红', () => {
  const same = G.judgeScreen(
    { web: 'wallet', rn: 'rn/W.tsx', webKeys: new Set(['wallet.title']), rnKeys: new Set(['wallet.title']), hardcoded: [] },
    MESSAGES,
  )
  assert.equal(same.blocking.length + same.advisory.length, 0)
  const own = G.judgeScreen(
    {
      web: 'wallet',
      rn: 'rn/W.tsx',
      webKeys: new Set(['wallet.title']),
      rnKeys: new Set(),
      hardcoded: [{ kind: 'jsx-text', value: 'web 没有这句', line: 3 }],
    },
    MESSAGES,
  )
  assert.equal(own.blocking.length, 0)
})

test('T5 命名空间合成:useTranslations(wallet)+t(balance) ⇒ wallet.balance;动态键不冒充命中', () => {
  const r = G.extractWebKeys("const t = useTranslations('wallet')\nt('balance')\nt(`k.${x}`)", MESSAGES)
  assert.ok(r.keys.has('wallet.balance'))
  assert.equal(r.keys.size, 1)
})

test('T6 注释遮罩:注释里的 t("…") 与 JSX 文本不算', () => {
  const keys = G.extractRnKeys('// t("wallet.balance")\nconst v = t("wallet.title")', MESSAGES)
  assert.deepEqual([...keys.keys], ['wallet.title'])
  const h = G.extractHardcodedChinese('// <Text>余额</Text>\nconst A = () => <Text>ok</Text>')
  assert.equal(h.length, 0)
})

test('T7 属性位硬编码进射程;样式/日志字符串不进', () => {
  const h = G.extractHardcodedChinese('<TextField placeholder="余额" />')
  assert.equal(h.length, 1)
  assert.equal(h[0].kind, 'attr:placeholder')
  const code = G.extractHardcodedChinese('const cls = "text-red-500"\nlog("中文日志")')
  assert.equal(code.length, 0, '代码字符串被当用户可见文案')
})

test('T8 台账:到期即红;count 差额与缺字段点名;scopeFiles 只判本次审过的屏', () => {
  const expired = G.judgeLedger(
    [],
    [{ file: 'wallet', rule: 'B1-hardcoded-cjk', count: 0, owner: 'o', expires: '2020-01-01', evidence: 'e' }],
    { today: '2026-11-03' },
  )
  assert.equal(expired.expired.length, 1)
  const scoped = G.judgeLedger(
    [],
    [{ file: 'wallet', rule: 'B1-hardcoded-cjk', count: 3, owner: 'o', expires: '2099-01-01', evidence: 'e' }],
    { today: '2026-11-03', scopeFiles: new Set(['learn']) },
  )
  assert.equal(scoped.advisory.length, 0, '未审过的屏不该刷清单腐烂')
  const malformed = G.judgeLedger([], [{ file: 'wallet', rule: 'B1-hardcoded-cjk' }], { today: '2026-11-03' })
  assert.equal(malformed.malformed.length, 3)
})

test('T9 自检全绿(15 例)', () => {
  assert.equal(G.runSelfTest(), 15)
})

test('T10 接线对账:gate 291 已注册进 guardian-runner,blocking + staged 触发面 + skip env', () => {
  const block = RUNNER.slice(RUNNER.indexOf("id: '291'"), RUNNER.indexOf("id: '291'") + 1200)
  assert.ok(RUNNER.includes("id: '291'"), "guardian-runner 里找不到 id: '291'")
  assert.match(block, /script: 'check-web-rn-copy-parity\.mjs'/)
  assert.match(block, /mode: 'blocking'/)
  assert.match(block, /stagedTriggers:/)
  assert.match(block, /skipEnv: 'HUSKY_SKIP_WEB_RN_COPY_PARITY'/)
  assert.match(SELF, /守门 291/)
  assert.match(SELF, /集成位置: .*guardian-runner\.mjs 第 291 项/)
})

test('T11 账本文件在仓且条目形制齐全,分母不为零(首读真有差异)', () => {
  const raw = JSON.parse(readFileSync(join(ROOT, 'scripts/data/web-rn-copy-diffs.json'), 'utf8'))
  assert.ok(Array.isArray(raw.entries) && raw.entries.length > 0)
  for (const e of raw.entries) {
    assert.ok(e.file && e.rule && e.owner && e.expires && e.evidence, `条目缺字段:${JSON.stringify(e).slice(0, 120)}`)
    assert.match(e.expires, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(Number.isInteger(e.count) && e.count > 0, `count 非正整数:${e.file}`)
  }
})

test('T12 两面读:staged 面读索引、worktree 面读盘;取不到返回 null 而不是空串', () => {
  assert.equal(typeof G.readFace('scripts/data/web-rn-screen-map.jsonl', 'staged'), 'string')
  assert.equal(G.readFace('apps/miniapp-taro/src/__不存在__.tsx', 'worktree'), null)
})
