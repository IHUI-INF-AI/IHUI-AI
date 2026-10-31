// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as auto } from '../auto-commit-quiet.mjs'
import { detectPollution, parseCommitMessage } from '../check-commit-scope-consistency.mjs'

// 2026-10-31 死锁现场(现读日志里的真实形态):收编批同时含 10 枚 i18n messages 与 6 个 apps 端。
const REAL_BATCH = [
  'packages/i18n/messages/web/en.json',
  'packages/i18n/messages/web/ja.json',
  'packages/i18n/messages/web/ko.json',
  'packages/i18n/messages/web/zh-CN.json',
  'packages/i18n/messages/web/zh-TW.json',
  'packages/i18n/messages/shared/en.json',
  'packages/i18n/messages/shared/ja.json',
  'packages/i18n/messages/shared/ko.json',
  'packages/i18n/messages/shared/zh-CN.json',
  'packages/i18n/messages/shared/zh-TW.json',
  'apps/ai-service/app/core/hook_runtime.py',
  'apps/api/src/routes/share-content.ts',
  'apps/cli/src/commands/hooks.ts',
  'apps/miniapp-taro/src/i18n/generated/zh-cn-pack.gen.ts',
  'apps/mobile-rn/src/components/IntroducePopup.tsx',
  'apps/web/app/(main)/admin/error-dashboard/page.tsx',
  'packages/shared/src/chat/tool-display.ts',
  'scripts/check-doc-numbers.mjs',
]

test('partitionI18nBatch: i18n messages 单独成批,其余原序留在 rest', () => {
  const { i18n, rest } = auto.partitionI18nBatch(REAL_BATCH)
  assert.equal(i18n.length, 10)
  assert.equal(rest.length, REAL_BATCH.length - 10)
  assert.ok(i18n.every((p) => p.startsWith('packages/i18n/messages/')))
  assert.ok(rest.every((p) => !p.startsWith('packages/i18n/messages/')))
  // 顺序保持:rest 里第一个仍是 ai-service 那枚
  assert.equal(rest[0], 'apps/ai-service/app/core/hook_runtime.py')
})

test('partitionI18nBatch: 反斜杠路径同判(Windows 形态)', () => {
  const { i18n, rest } = auto.partitionI18nBatch([
    'packages\\i18n\\messages\\web\\zh-CN.json',
    'apps\\web\\page.tsx',
  ])
  assert.deepEqual(i18n, ['packages\\i18n\\messages\\web\\zh-CN.json'])
  assert.deepEqual(rest, ['apps\\web\\page.tsx'])
})

test('partitionI18nBatch: 空输入与无 i18n 批', () => {
  assert.deepEqual(auto.partitionI18nBatch([]), { i18n: [], rest: [] })
  const { i18n, rest } = auto.partitionI18nBatch(['apps/web/page.tsx'])
  assert.equal(i18n.length, 0)
  assert.deepEqual(rest, ['apps/web/page.tsx'])
})

test('死锁形状锁:旧消息 chore(auto) 在真实批上必红 R2+R3', () => {
  const result = detectPollution(REAL_BATCH, 'auto')
  assert.equal(result.block, true)
  assert.ok(result.rules.includes('R2'), 'i18n 文件 + 非 i18n scope ⇒ R2')
  assert.ok(result.rules.includes('R3'), '6 个 apps 端 + 显式 scope ⇒ R3')
})

test('新形态:切批后两枚都不触发任何污染签名', () => {
  const { i18n, rest } = auto.partitionI18nBatch(REAL_BATCH)
  const msgs = auto.autoCommitMessages(3)
  const i18nResult = detectPollution(i18n, parseCommitMessage(msgs.i18n).scope)
  const restResult = detectPollution(rest, parseCommitMessage(msgs.rest).scope)
  assert.equal(i18nResult.block, false)
  assert.equal(restResult.block, false)
})

test('消息 ⇄ 门解析器同源:i18n 消息解析出 scope=i18n,聚合消息解析出 scope=null', () => {
  const msgs = auto.autoCommitMessages(7)
  const i18n = parseCommitMessage(msgs.i18n)
  const rest = parseCommitMessage(msgs.rest)
  assert.equal(i18n.type, 'chore')
  assert.equal(i18n.scope, 'i18n')
  assert.equal(rest.type, 'chore')
  assert.equal(rest.scope, null, '无 scope 是 R3 明文允许的聚合 commit 形态')
  assert.match(msgs.rest, /^chore: 收编停留≥7分钟的未提交改动$/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
