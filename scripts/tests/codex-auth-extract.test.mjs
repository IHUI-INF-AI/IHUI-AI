// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Codex 本机会话提取器行为单测(2026-10-27 自 apps/api/tests/relay-codex-adapter.test.ts 迁入)。
 *
 * 迁移立因:架构契约门(门 103)判 D1/D2 —— apps/api(端应用,exported:false,rank 40)
 * 不得依赖 repo-tooling(scripts/,rank 90),策略表也明文"不得把 apps/api 写进
 * repo-tooling.requires"。提取器测试的真家在 scripts/tests/(与 codearts/qoder/trae
 * 三个兄弟提取器同一布局);apps/api 侧只留适配器行为单测。
 *
 * 覆盖点(原样迁移,判据零改):
 * - 有/无会话两态:auth.json raw 直通、指纹、keyring 模式真实出路文案、零回显
 * - 走临时目录,不碰本机真实 .codex
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { extractCodexAccounts, summarizeSession } from '../lib/codex-auth-extract.mjs'

function makeTempCodexHome(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-codex-test-'))
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content, 'utf8')
  }
  return dir
}

const AUTH_JSON_FIXTURE = JSON.stringify({
  auth_mode: 'chatgpt',
  tokens: {
    id_token: 'id-token-test',
    access_token: 'codex-access-token-test',
    refresh_token: 'codex-refresh-token-test',
    account_id: 'acc-test-1',
  },
  last_refresh: '2026-10-27T00:00:00.000Z',
})

describe('codex 提取器 extractCodexAccounts', () => {
  it('有会话:tokens raw 直通 + 来源标记 + 指纹(sha256 前 12 位)', async () => {
    const home = makeTempCodexHome({ 'auth.json': AUTH_JSON_FIXTURE })
    const out = await extractCodexAccounts({ codexHome: home })
    assert.strictEqual(out.providerCode, 'codex')
    assert.strictEqual(out.accounts.length, 1)
    const acc = out.accounts[0]
    assert.strictEqual(acc.source, 'codex')
    assert.strictEqual(acc.authMode, 'chatgpt')
    // raw 直通(§0.6):tokens 对象键名零改动
    assert.deepStrictEqual(acc.tokens, {
      id_token: 'id-token-test',
      access_token: 'codex-access-token-test',
      refresh_token: 'codex-refresh-token-test',
      account_id: 'acc-test-1',
    })
    assert.strictEqual(acc.lastRefresh, '2026-10-27T00:00:00.000Z')
    assert.strictEqual(
      acc.fingerprint,
      crypto.createHash('sha256').update('codex-access-token-test', 'utf8').digest('hex').slice(0, 12),
    )
  })

  it('meta 摘要零回显:不含任何 token 明文,只有布尔/长度/指纹', async () => {
    const home = makeTempCodexHome({ 'auth.json': AUTH_JSON_FIXTURE })
    const out = await extractCodexAccounts({ codexHome: home })
    const metaText = JSON.stringify(out.meta)
    assert.ok(!metaText.includes('codex-access-token-test'))
    assert.ok(!metaText.includes('codex-refresh-token-test'))
    assert.ok(!metaText.includes('id-token-test'))
    const s = summarizeSession(JSON.parse(AUTH_JSON_FIXTURE))
    assert.strictEqual(s.hasAccessToken, true)
    assert.strictEqual(s.hasRefreshToken, true)
    assert.strictEqual(s.tokenFingerprint.length, 12)
    assert.strictEqual(s.tokenLength, 'codex-access-token-test'.length)
  })

  it('无会话:目录缺 auth.json → CODEX_NO_SESSION(点名真实出路)', async () => {
    const home = makeTempCodexHome({})
    await assert.rejects(
      () => extractCodexAccounts({ codexHome: home }),
      (e) => e.code === 'CODEX_NO_SESSION',
    )
  })

  it('无会话:keyring 模式 → CODEX_NO_SESSION + 凭据管理器真实出路文案', async () => {
    const home = makeTempCodexHome({
      'config.toml': 'cli_auth_credentials_store = "keyring"\nmodel = "gpt-5.1"\n',
    })
    const err = await extractCodexAccounts({ codexHome: home }).catch((e) => e)
    assert.strictEqual(err.code, 'CODEX_NO_SESSION')
    assert.ok(err.message.includes('keyring'))
    assert.ok(err.message.includes('凭据管理器'))
  })

  it('auth.json 解析失败 → CODEX_BAD_AUTH_JSON(未判定,不猜字段)', async () => {
    const home = makeTempCodexHome({ 'auth.json': '{not-json' })
    await assert.rejects(
      () => extractCodexAccounts({ codexHome: home }),
      (e) => e.code === 'CODEX_BAD_AUTH_JSON',
    )
  })

  it('auth_mode 非 chatgpt(API key 登录)→ CODEX_NO_SESSION 点名原因', async () => {
    const home = makeTempCodexHome({
      'auth.json': JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: null }),
    })
    const err = await extractCodexAccounts({ codexHome: home }).catch((e) => e)
    assert.strictEqual(err.code, 'CODEX_NO_SESSION')
    assert.ok(err.message.includes('apikey'))
  })

  it('缺 tokens.access_token → CODEX_BAD_AUTH_JSON(形状不符 ⇒ 未判定)', async () => {
    const home = makeTempCodexHome({
      'auth.json': JSON.stringify({ auth_mode: 'chatgpt', tokens: { account_id: 'x' } }),
    })
    await assert.rejects(
      () => extractCodexAccounts({ codexHome: home }),
      (e) => e.code === 'CODEX_BAD_AUTH_JSON',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
