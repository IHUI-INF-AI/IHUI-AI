// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OpenCode 本机会话提取器行为单测(2026-10-27 自 apps/api/tests/relay-opencode-adapter.test.ts 迁入)。
 *
 * 迁移立因:架构契约门(门 103)判 D1/D2 —— apps/api(端应用,exported:false,rank 40)
 * 不得依赖 repo-tooling(scripts/,rank 90)。提取器测试的真家在 scripts/tests/
 * (与 codearts/qoder/trae 三个兄弟提取器同一布局);apps/api 侧只留适配器行为单测。
 *
 * 覆盖点(原样迁移,判据零改):
 * - OPENCODE_AUTH_CONTENT 优先、多 provider 数组形态、auth 对象 raw 直通、指纹、零回显
 * - 走注入(env/authContent),不碰本机真实 auth.json
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import {
  extractOpencodeAccounts,
  summarizeProvider,
} from '../lib/opencode-auth-extract.mjs'

const AUTH_FIXTURE = JSON.stringify({
  opencode: { type: 'api', key: 'oc-key-test-1' },
  anthropic: {
    type: 'oauth',
    access: 'anthropic-access-token-test',
    refresh: 'anthropic-refresh-token-test',
    expires: 1795356026000,
    accountId: 'acc-ant-1',
  },
})

describe('opencode 提取器 extractOpencodeAccounts', () => {
  it('有会话:每 provider 一账号,auth raw 直通 + 来源标记 + 指纹', async () => {
    const out = await extractOpencodeAccounts({ authContent: AUTH_FIXTURE })
    assert.strictEqual(out.providerCode, 'opencode')
    assert.strictEqual(out.accounts.length, 2)
    const first = out.accounts.find((a) => a.providerID === 'opencode')
    const second = out.accounts.find((a) => a.providerID === 'anthropic')
    assert.strictEqual(first?.source, 'opencode')
    // raw 直通(§0.6):auth 对象键名零改动
    assert.deepStrictEqual(first?.auth, { type: 'api', key: 'oc-key-test-1' })
    assert.match(JSON.stringify(second?.auth), /"type":"oauth"/)
    assert.ok((second?.auth ?? {}).access === 'anthropic-access-token-test')
    assert.strictEqual(
      first?.fingerprint,
      crypto.createHash('sha256').update('oc-key-test-1', 'utf8').digest('hex').slice(0, 12),
    )
    assert.strictEqual(
      second?.fingerprint,
      crypto
        .createHash('sha256')
        .update('anthropic-access-token-test', 'utf8')
        .digest('hex')
        .slice(0, 12),
    )
  })

  it('meta 摘要零回显:不含任何 token 明文', async () => {
    const out = await extractOpencodeAccounts({ authContent: AUTH_FIXTURE })
    const metaText = JSON.stringify(out.meta)
    assert.ok(!metaText.includes('oc-key-test-1'))
    assert.ok(!metaText.includes('anthropic-access-token-test'))
    assert.ok(!metaText.includes('anthropic-refresh-token-test'))
    const s = summarizeProvider('opencode', { type: 'api', key: 'oc-key-test-1' })
    assert.strictEqual(s.hasKey, true)
    assert.strictEqual(s.tokenFingerprint.length, 12)
  })

  it('无会话:无注入无文件 → OPENCODE_NO_SESSION(点名出路)', async () => {
    const err = await extractOpencodeAccounts({ env: {} }).catch((e) => e)
    assert.strictEqual(err.code, 'OPENCODE_NO_SESSION')
    assert.ok(err.message.includes('auth.json'))
  })

  it('注入内容解析失败 → OPENCODE_BAD_AUTH_JSON(未判定,不猜字段)', async () => {
    await assert.rejects(
      () => extractOpencodeAccounts({ authContent: '{bad' }),
      (e) => e.code === 'OPENCODE_BAD_AUTH_JSON',
    )
  })

  it('注入空对象 / 全键形状不符 → OPENCODE_NO_SESSION / OPENCODE_BAD_AUTH_JSON', async () => {
    await assert.rejects(
      () => extractOpencodeAccounts({ authContent: '{}' }),
      (e) => e.code === 'OPENCODE_NO_SESSION',
    )
    await assert.rejects(
      () => extractOpencodeAccounts({ authContent: '{"a":1,"b":[2]}' }),
      (e) => e.code === 'OPENCODE_BAD_AUTH_JSON',
    )
  })

  it('dataDir 显式注入时读该目录 auth.json(文件路径优先级在注入之后)', async () => {
    const out = await extractOpencodeAccounts({
      authContent: '',
      env: {},
      dataDir: undefined,
    }).catch((e) => e)
    // 空注入回落文件查找;无文件 ⇒ NO_SESSION(不为编造路径冒绿)
    assert.strictEqual(out.code, 'OPENCODE_NO_SESSION')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
