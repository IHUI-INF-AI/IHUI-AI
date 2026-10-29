// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 多平台「登录本机」写回端接线锁(2026-10-27 立)。
 *
 * 全部用例只碰 scratch 副本(payload.target 显式落点),绝不读写真实的
 * Codex/OpenCode/MiniMax/ZCode/CodeArts/Qoder 登录态 —— 用户正用着号,测试不许顶号。
 *
 * 锁六件事:
 *   ① 补丁面:池内凭证覆盖模板/本机旧凭证,模板只贡献账号资料,旁键不丢
 *   ② 加密面:ZCode enc:v1: / Electron v10 密文能解回,重封后仍是合法密文
 *   ③ 安全面:模板 uid 错配、坏 JSON、多会话不可判定一律拒写,备份逐字节等于写前
 *   ④ 输出面:回报 JSON 不含任何凭证明文
 *   ⑤ 环境面:缺目录/缺 providerID/缺 recordKey 点名原因,不静默冒绿
 *   ⑥ CLI 面:--provider 校验、stdin 通道、JSON 回报形状
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as L } from '../local-login.mjs'
import * as lv from '../lib/leveldb-log.mjs'
import { __test__ as Z } from '../lib/zcode-auth-extract.mjs'
import { __test__ as W } from '../lib/workbuddy-auth-extract.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const require = createRequire(import.meta.url)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.resolve(HERE, '..', 'local-login.mjs')
const extract = await L.loadExtract()
const IS_WINDOWS = process.platform === 'win32'

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function noPlaintext(result, secrets) {
  const text = JSON.stringify(result)
  for (const s of secrets) {
    assert.equal(text.includes(s), false, `回报面不得回显凭据:${s.slice(0, 6)}…`)
  }
}

function assertBackup(result, file, beforeRaw) {
  assert.equal(result.backupFile.startsWith(`${file}.ihui-login-`), true, '备份必须与原文件同目录')
  const expected = Buffer.isBuffer(beforeRaw) ? beforeRaw : Buffer.from(beforeRaw, 'utf8')
  assert.equal(fs.readFileSync(result.backupFile).equals(expected), true, '备份必须逐字节等于写前')
}

/** DPAPI CurrentUser 保护(仅 Windows;返回 null = 本机不可用,用例 skip) */
function dpapiProtect(buf) {
  const b64 = buf.toString('base64')
  const script =
    'Add-Type -AssemblyName System.Security; [Console]::OutputEncoding=[Text.Encoding]::UTF8; ' +
    '[Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect(' +
    `[Convert]::FromBase64String('${b64}'), $null, 'CurrentUser'))`
  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  )
  if (r.error || r.status !== 0) return null
  const out = (r.stdout ?? '').trim()
  return out ? Buffer.from(out, 'base64') : null
}

/** 造一个 Electron Local State(os_crypt.encrypted_key = DPAPI 保护后的 AES-256 密钥) */
function writeLocalState(dir, aesKey) {
  const protectedKey = dpapiProtect(aesKey)
  if (!protectedKey) return false
  fs.writeFileSync(
    path.join(dir, 'Local State'),
    JSON.stringify({
      os_crypt: { encrypted_key: Buffer.concat([Buffer.from('DPAPI'), protectedKey]).toString('base64') },
    }),
  )
  return true
}

// =============================================================================
// ① Codex
// =============================================================================

test('codex:凭证整族以池内为准,模板补账号资料,旧号凭证不残留', () => {
  const scratch = mkScratch('local-login-codex')
  try {
    const file = path.join(scratch, '.codex', 'auth.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const beforeRaw = JSON.stringify({
      auth_mode: 'chatgpt',
      tokens: { id_token: 'old-id', access_token: 'old-access', refresh_token: 'old-refresh', account_id: 'old-uid' },
      last_refresh: '2026-01-01T00:00:00Z',
      local_side_key: 'keep-me',
    })
    fs.writeFileSync(file, beforeRaw)

    const payload = L.normalizePayload({
      uid: 'uid-9',
      token: 'new-access',
      refreshToken: 'new-refresh',
      target: file,
      secrets: {
        accountId: 'uid-9',
        idToken: 'new-id',
        sessionTemplate: { custom_side: 'tpl', tokens: { account_id: 'uid-9', some_noncred: 'v' } },
      },
    })
    const result = L.applyCodex(payload, { extract })
    const out = readJson(file)
    assert.equal(out.auth_mode, 'chatgpt', '模板没写 auth_mode 时保留本机值')
    assert.equal(out.tokens.access_token, 'new-access')
    assert.equal(out.tokens.refresh_token, 'new-refresh')
    assert.equal(out.tokens.id_token, 'new-id', 'id_token 必须换成本批次凭证')
    assert.equal(out.tokens.account_id, 'uid-9')
    assert.equal(out.tokens.some_noncred, 'v', '模板里的非凭证 tokens 旁键要保留')
    assert.equal(out.local_side_key, 'keep-me', '本机非凭证旁键不得丢')
    assert.equal(out.custom_side, 'tpl')
    assert.equal(readJson(file).tokens.access_token.includes('old-access'), false)
    assertBackup(result, file, beforeRaw)
    noPlaintext(result, ['new-access', 'new-refresh', 'new-id'])

    // 不带模板:仍能写,但绝不沿用本机旧号凭证
    const second = L.normalizePayload({ uid: 'uid-9', token: 'third-access', target: file, secrets: {} })
    L.applyCodex(second, { extract })
    const third = readJson(file)
    assert.equal(third.tokens.access_token, 'third-access')
    assert.equal('refresh_token' in third.tokens, false, '池内没有刷新票时不得带回旧票')
    assert.equal('id_token' in third.tokens, false, '池内没有 id_token 时不得带回旧票')
  } finally {
    rmScratch(scratch)
  }
})

test('codex:模板 uid 错配/坏 JSON 一律拒写且原文件不变', () => {
  const scratch = mkScratch('local-login-codex-reject')
  try {
    const file = path.join(scratch, 'auth.json')
    const beforeRaw = JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: 'local-token' } })
    fs.writeFileSync(file, beforeRaw)
    const payload = L.normalizePayload({
      uid: 'uid-9',
      token: 'new-access',
      target: file,
      secrets: { sessionTemplate: { tokens: { account_id: 'someone-else' } } },
    })
    assert.throws(() => L.applyCodex(payload, { extract }), (e) => e.code === 'template-uid-mismatch')
    assert.equal(fs.readFileSync(file, 'utf8'), beforeRaw)

    const bad = path.join(scratch, 'bad.json')
    fs.writeFileSync(bad, '{not json')
    assert.throws(
      () => L.applyCodex(L.normalizePayload({ uid: 'u', token: 't', target: bad }), { extract }),
      (e) => e.code === 'target-shape',
    )
    assert.equal(fs.readFileSync(bad, 'utf8'), '{not json')
  } finally {
    rmScratch(scratch)
  }
})

// =============================================================================
// ② OpenCode
// =============================================================================

test('opencode:只改目标 provider,其它 provider 条目与旁键原样保留', () => {
  const scratch = mkScratch('local-login-opencode')
  try {
    const file = path.join(scratch, 'auth.json')
    const before = {
      other: { type: 'api', key: 'other-key', baseUrl: 'http://other' },
      anthropic: { type: 'oauth', access: 'old-access', refresh: 'old-refresh', expires: 1, accountId: 'acc-1', enterpriseUrl: 'e' },
    }
    const beforeRaw = JSON.stringify(before)
    fs.writeFileSync(file, beforeRaw)

    const expiresAt = '2026-12-01T00:00:00.000Z'
    const payload = L.normalizePayload({
      uid: 'acc-1',
      token: 'new-access',
      refreshToken: 'new-refresh',
      expiresAt,
      target: file,
      secrets: {
        providerID: 'anthropic',
        authType: 'oauth',
        accountId: 'acc-1',
        sessionTemplate: { type: 'oauth', accountId: 'acc-1', enterpriseUrl: 'e', region: 'us' },
      },
    })
    const result = L.applyOpencode(payload, { extract })
    const out = readJson(file)
    assert.deepEqual(out.other, before.other, '其它 provider 必须逐字保留')
    assert.equal(out.anthropic.type, 'oauth')
    assert.equal(out.anthropic.access, 'new-access')
    assert.equal(out.anthropic.refresh, 'new-refresh')
    assert.equal(out.anthropic.expires, Date.parse(expiresAt))
    assert.equal(out.anthropic.accountId, 'acc-1')
    assert.equal(out.anthropic.enterpriseUrl, 'e')
    assert.equal(out.anthropic.region, 'us', '模板旁键保留')
    assert.equal('key' in out.anthropic, false, 'oauth 条目不得残留 key')
    assertBackup(result, file, beforeRaw)
    noPlaintext(result, ['new-access', 'new-refresh'])

    // api 型:写 key,清掉 oauth 字段
    const apiPayload = L.normalizePayload({
      uid: 'acc-2',
      token: 'api-key-value',
      target: file,
      secrets: { providerID: 'anthropic', authType: 'api', accountId: 'acc-2' },
    })
    L.applyOpencode(apiPayload, { extract })
    const apiEntry = readJson(file).anthropic
    assert.equal(apiEntry.key, 'api-key-value')
    for (const k of ['access', 'accessToken', 'refresh', 'refreshToken', 'expires', 'expiresAt']) {
      assert.equal(k in apiEntry, false, `api 条目不得残留 ${k}`)
    }
  } finally {
    rmScratch(scratch)
  }
})

test('opencode:缺 providerID 点名拒写', () => {
  const scratch = mkScratch('local-login-opencode-nokey')
  try {
    const file = path.join(scratch, 'auth.json')
    fs.writeFileSync(file, '{}')
    const payload = L.normalizePayload({ uid: 'u', token: 't', target: file, secrets: {} })
    assert.throws(() => L.applyOpencode(payload, { extract }), (e) => e.code === 'no-template')
  } finally {
    rmScratch(scratch)
  }
})

// =============================================================================
// ③ MiniMax
// =============================================================================

test('minimax:按 recordKey 打补丁,其它记录保留,同目录 auth-state 到期同步', () => {
  const scratch = mkScratch('local-login-minimax')
  try {
    const dir = path.join(scratch, 'auth', 'prod', 'cn', 'mcode-public')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'auth.json')
    const key = 'com.minimax.mcode.oauth.prod.cn abc'
    const otherKey = 'com.minimax.mcode.oauth.prod.cn other'
    const record = {
      schemaVersion: 1,
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      tokenType: 'Bearer',
      clientId: 'cid',
      scopes: ['s1'],
      audience: 'aud',
      expiresAtMs: 1,
      generation: 2,
      loginEpoch: 'e1',
    }
    const beforeRaw = JSON.stringify({ schemaVersion: 1, records: { [key]: record, [otherKey]: { accessToken: 'x' } } })
    fs.writeFileSync(file, beforeRaw)
    const stateFile = path.join(dir, 'auth-state.json')
    fs.writeFileSync(stateFile, JSON.stringify({ schemaVersion: 1, expiresAtMs: 1, region: 'cn' }))

    const expiresAt = '2026-12-02T03:04:05.000Z'
    const payload = L.normalizePayload({
      uid: 'minimax-uid',
      token: 'new-access',
      refreshToken: 'new-refresh',
      expiresAt,
      target: file,
      secrets: {
        recordKey: key,
        sessionTemplate: {
          schemaVersion: 1,
          tokenType: 'Bearer',
          clientId: 'cid',
          scopes: ['s1'],
          audience: 'aud',
          generation: 2,
          loginEpoch: 'e1',
        },
      },
    })
    const result = L.applyMinimax(payload, { extract })
    const out = readJson(file)
    assert.equal(out.records[key].accessToken, 'new-access')
    assert.equal(out.records[key].refreshToken, 'new-refresh')
    assert.equal(out.records[key].expiresAtMs, Date.parse(expiresAt))
    assert.equal(out.records[key].tokenType, 'Bearer', '非凭证旁键保留')
    assert.deepEqual(out.records[key].scopes, ['s1'])
    assert.equal(out.records[key].loginEpoch, 'e1')
    assert.deepEqual(out.records[otherKey], { accessToken: 'x' }, '其它会话记录不得被动')
    assert.equal(readJson(stateFile).expiresAtMs, Date.parse(expiresAt), 'auth-state 到期必须同步')
    assert.equal(readJson(stateFile).region, 'cn', 'auth-state 旁键保留')
    assertBackup(result, file, beforeRaw)
    noPlaintext(result, ['new-access', 'new-refresh'])
  } finally {
    rmScratch(scratch)
  }
})

test('minimax:多会话且无 recordKey 时点名拒写', () => {
  const scratch = mkScratch('local-login-minimax-ambiguous')
  try {
    const file = path.join(scratch, 'auth.json')
    fs.writeFileSync(
      file,
      JSON.stringify({ records: { a: { accessToken: 'a' }, b: { accessToken: 'b' } } }),
    )
    const payload = L.normalizePayload({ uid: 'u', token: 't', target: file, secrets: {} })
    assert.throws(() => L.applyMinimax(payload, { extract }), (e) => e.code === 'no-template')
  } finally {
    rmScratch(scratch)
  }
})

// =============================================================================
// ④ ZCode(enc:v1: AES-256-GCM 重封)
// =============================================================================

test('zcode:目标键重封为 enc:v1:,其它键原样加密保留,明文不落盘', () => {
  const scratch = mkScratch('local-login-zcode')
  try {
    const file = path.join(scratch, 'credentials.json')
    const cipherKey = Z.deriveCipherKey()
    const raw = {
      'oauth:bigmodel:access_token': L.encryptZcodeValue('old-access', cipherKey),
      zcodejwttoken: L.encryptZcodeValue('old-jwt', cipherKey),
      'oauth:bigmodel:user_info': L.encryptZcodeValue(JSON.stringify({ name: 'someone' }), cipherKey),
    }
    const beforeRaw = JSON.stringify(raw)
    fs.writeFileSync(file, beforeRaw)

    const payload = L.normalizePayload({
      uid: 'zcode-uid',
      token: 'new-access',
      target: file,
      secrets: {
        credentialMap: { 'oauth:bigmodel:access_token': 'old-access', zcodejwttoken: 'old-jwt' },
      },
    })
    const result = L.applyZcode(payload, { extract })
    const out = readJson(file)
    for (const [k, v] of Object.entries(out)) {
      assert.equal(typeof v, 'string', `${k} 必须是字符串`)
      assert.equal(String(v).startsWith('enc:v1:'), true, `${k} 必须仍是 enc:v1: 密文`)
      assert.equal(String(v).includes('new-access'), false, `${k} 密文里不得出现明文`)
    }
    assert.equal(Z.decryptZcodeValue(out['oauth:bigmodel:access_token'], cipherKey), 'new-access')
    assert.equal(Z.decryptZcodeValue(out.zcodejwttoken, cipherKey), 'old-jwt', '非目标键不得被改')
    assert.equal(
      Z.decryptZcodeValue(out['oauth:bigmodel:user_info'], cipherKey),
      JSON.stringify({ name: 'someone' }),
    )
    assert.equal(fs.readFileSync(file, 'utf8').includes('old-access'), false, '写出文件不得含明文')
    assertBackup(result, file, beforeRaw)
    noPlaintext(result, ['new-access', 'old-jwt'])
  } finally {
    rmScratch(scratch)
  }
})

test('zcode:本机密文解不开时拒绝覆盖(密钥派生环境不一致)', () => {
  const scratch = mkScratch('local-login-zcode-key')
  try {
    const file = path.join(scratch, 'credentials.json')
    const wrongKey = crypto.createHash('sha256').update('another-machine').digest()
    fs.writeFileSync(file, JSON.stringify({ 'oauth:bigmodel:access_token': L.encryptZcodeValue('x', wrongKey) }))
    const payload = L.normalizePayload({
      uid: 'u',
      token: 't',
      target: file,
      secrets: { credentialMap: { 'oauth:bigmodel:access_token': 'x' } },
    })
    assert.throws(() => L.applyZcode(payload, { extract }), (e) => e.code === 'cipher-key-mismatch')
  } finally {
    rmScratch(scratch)
  }
})

// =============================================================================
// ⑤ CodeArts(DPAPI + state.vscdb)
// =============================================================================

test(
  'codearts:秘密行按模板重封,dpop/AK/SK 更新,其它行与库内旁键不动',
  { skip: IS_WINDOWS ? false : 'DPAPI 仅 Windows 可用' },
  () => {
    const scratch = mkScratch('local-login-codearts')
    try {
      const roaming = path.join(scratch, 'codearts-agent')
      const globalStorage = path.join(roaming, 'User', 'globalStorage')
      fs.mkdirSync(globalStorage, { recursive: true })
      const aesKey = crypto.randomBytes(32)
      if (!writeLocalState(roaming, aesKey)) {
        return // 本机 DPAPI 不可用(受限会话),已由 skip 兜底非 Windows;此处安静跳过
      }
      const sessionKey = 'secret://{"extensionId":"huaweicloud.authentication","key":"HuaweiCloudSession"}'
      const session = {
        securitytoken: 'old-sts',
        refresh_token: 'old-rt',
        expires_at: '2027-01-01T00:00:00.000Z',
        accessKey: 'OLD-AK',
        secretKey: 'OLD-SK',
        domainId: 'd-1',
        account: { id: 'codearts-uid', label: '某人' },
        loginContext: {
          pkcePair: { codeVerifier: 'old-cv' },
          dpopKeyPair: { privateKeyJwk: { kty: 'EC', crv: 'P-256' } },
        },
      }
      const blob = L.encryptSafeStorageBlob(JSON.stringify(session), aesKey)
      const dbFile = path.join(globalStorage, 'state.vscdb')
      const { DatabaseSync } = require('node:sqlite')
      const db = new DatabaseSync(dbFile)
      db.exec('CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)')
      db.prepare('INSERT INTO ItemTable (key, value) VALUES (?, ?)').run(
        sessionKey,
        JSON.stringify({ type: 'Buffer', data: Array.from(blob) }),
      )
      db.prepare('INSERT INTO ItemTable (key, value) VALUES (?, ?)').run('theme', 'vs-dark')
      db.close()
      const beforeRaw = fs.readFileSync(dbFile)

      const payload = L.normalizePayload({
        uid: 'codearts-uid',
        token: 'new-sts',
        refreshToken: 'new-rt',
        expiresAt: '2027-02-02T00:00:00.000Z',
        target: roaming,
        secrets: {
          accessKeyId: 'NEW-AK',
          secretAccessKey: 'NEW-SK',
          sessionTemplate: {
            domainId: 'd-1',
            account: { id: 'codearts-uid', label: '新名' },
            loginContext: { pkcePair: { codeVerifier: 'old-cv' }, dpopKeyPair: { privateKeyJwk: { kty: 'EC' } } },
          },
        },
      })
      const result = L.applyCodearts(payload, { extract })
      const check = new DatabaseSync(dbFile)
      try {
        const row = check.prepare('SELECT value FROM ItemTable WHERE key = ?').get(sessionKey)
        const bytes =
          typeof row.value === 'string'
            ? Buffer.from(JSON.parse(row.value).data)
            : Buffer.from(row.value)
        const written = extract.decryptSafeStorageBlob(bytes, aesKey)
        assert.equal(written.securitytoken, 'new-sts')
        assert.equal(written.refresh_token, 'new-rt')
        assert.equal(written.expires_at, '2027-02-02T00:00:00.000Z')
        assert.equal(written.accessKey, 'NEW-AK')
        assert.equal(written.secretKey, 'NEW-SK')
        assert.equal(written.account.label, '新名', '模板补账号资料')
        assert.equal(written.account.id, 'codearts-uid')
        assert.equal(written.domainId, 'd-1')
        assert.deepEqual(written.loginContext.dpopKeyPair, { privateKeyJwk: { kty: 'EC' } })
        const theme = check.prepare('SELECT value FROM ItemTable WHERE key = ?').get('theme')
        assert.equal(theme.value, 'vs-dark', '库内其它行不得动')
      } finally {
        check.close()
      }
      assert.equal(fs.readFileSync(result.backupFile).equals(beforeRaw), true, '备份必须逐字节等于写前')
      noPlaintext(result, ['new-sts', 'new-rt', 'NEW-AK', 'NEW-SK'])
    } finally {
      rmScratch(scratch)
    }
  },
)

// =============================================================================
// ⑥ Qoder(auth.v1.dat v10 重封)
// =============================================================================

test(
  'qoder:auth.v1.dat 重封后能解回,凭证换池内票,会话资料保留',
  { skip: IS_WINDOWS ? false : 'DPAPI 仅 Windows 可用' },
  () => {
    const scratch = mkScratch('local-login-qoder')
    try {
      const dir = path.join(scratch, 'com.qoder.app.test')
      fs.mkdirSync(dir, { recursive: true })
      const aesKey = crypto.randomBytes(32)
      if (!writeLocalState(dir, aesKey)) return
      const current = {
        token: 'old-token',
        refreshToken: 'old-refresh',
        expiresAt: '2026-11-01T00:00:00.000Z',
        refreshTokenExpiresAt: '2027-01-01T00:00:00.000Z',
        user: { id: 'qoder-uid', name: '某人' },
        machineId: 'm-1',
      }
      const authFile = path.join(dir, 'auth.v1.dat')
      const beforeRaw = L.encryptSafeStorageBlob(JSON.stringify(current), aesKey)
      fs.writeFileSync(authFile, beforeRaw)

      const payload = L.normalizePayload({
        uid: 'qoder-uid',
        token: 'new-token',
        refreshToken: 'new-refresh',
        expiresAt: '2026-12-12T00:00:00.000Z',
        refreshExpiresAt: '2027-03-03T00:00:00.000Z',
        target: dir,
        secrets: { sessionTemplate: { user: { id: 'qoder-uid', name: '新名' }, machineId: 'm-1' } },
      })
      const result = L.applyQoder(payload, { extract })
      const written = extract.decryptSafeStorageBlob(fs.readFileSync(authFile), aesKey)
      assert.equal(written.token, 'new-token')
      assert.equal(written.refreshToken, 'new-refresh')
      assert.equal(written.expiresAt, '2026-12-12T00:00:00.000Z')
      assert.equal(written.refreshTokenExpiresAt, '2027-03-03T00:00:00.000Z')
      assert.equal(written.user.name, '新名')
      assert.equal(written.user.id, 'qoder-uid')
      assert.equal(written.machineId, 'm-1')
      assert.equal(fs.readFileSync(authFile).equals(beforeRaw), false)
      assert.equal(fs.readFileSync(result.backupFile).equals(beforeRaw), true, '备份必须逐字节等于写前')
      noPlaintext(result, ['new-token', 'new-refresh'])
    } finally {
      rmScratch(scratch)
    }
  },
)

// =============================================================================
// ⑦ 服务身份下的落点解析(生产 API 以 LocalSystem 运行)
// =============================================================================

test('codex:服务身份下落到真实用户家目录(IHUI_CLIENT_HOME 显式兜底)', () => {
  const scratch = mkScratch('local-login-codex-home')
  try {
    const file = path.join(scratch, '.codex', 'auth.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: 'local-old', account_id: 'old' } }))
    const systemHome = 'C:\\Windows\\system32\\config\\systemprofile'
    const env = {
      ...process.env,
      USERPROFILE: systemHome,
      HOME: systemHome,
      APPDATA: `${systemHome}\\AppData\\Roaming`,
      IHUI_CLIENT_HOME: scratch,
    }
    const payload = L.normalizePayload({ uid: 'u-new', token: 't-new', secrets: {} })
    const result = L.applyCodex(payload, { extract, env })
    assert.equal(result.targetFile, path.resolve(file), '必须落到真实用户家目录,不是 systemprofile')
    assert.equal(readJson(file).tokens.access_token, 't-new')
  } finally {
    rmScratch(scratch)
  }
})

test('zcode:派生密钥随 env 家目录走,普通环境与旧算法逐字节相同', () => {
  const osApi = {
    platform: () => 'win32',
    homedir: () => 'C:\\Windows\\system32\\config\\systemprofile',
    userInfo: () => ({ username: 'MACHINE$' }),
  }
  const serviceKey = Z.deriveCipherKey(
    { USERPROFILE: 'C:\\Users\\Administrator', USERNAME: 'Administrator' },
    osApi,
  )
  const expected = crypto
    .createHash('sha256')
    .update('zcode-credential-fallback:win32:C:\\Users\\Administrator:Administrator')
    .digest()
  assert.equal(serviceKey.equals(expected), true, '服务身份必须按真实用户家目录派生')

  const legacy = crypto
    .createHash('sha256')
    .update(
      `zcode-credential-fallback:${process.platform}:${os.homedir()}:${os.userInfo().username}`,
    )
    .digest()
  assert.equal(Z.deriveCipherKey().equals(legacy), true, '普通桌面进程的派生串不得变')
})

// =============================================================================
// ⑧ CLI 面
// =============================================================================

test('CLI:--provider 必填且限支持集,stdin JSON 回报不含凭据', () => {
  assert.match(L.parseArgs([]).error ?? '', /--provider/)
  assert.equal(L.parseArgs(['--provider', 'loomy', '--stdin']).error, null, 'loomy 已装车(2026-10-28),不得再报不支持')
  assert.match(L.parseArgs(['--provider', 'lingma', '--stdin']).error ?? '', /不支持/)
  assert.match(L.parseArgs(['--provider', 'codex']).error ?? '', /--stdin/)

  const scratch = mkScratch('local-login-cli')
  try {
    const file = path.join(scratch, 'auth.json')
    fs.writeFileSync(file, JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: 'local-old' } }))
    const r = spawnSync(process.execPath, [SCRIPT, '--provider', 'codex', '--stdin', '--json'], {
      input: JSON.stringify({
        uid: 'cli-uid',
        token: 'cli-access-token',
        refreshToken: 'cli-refresh-token',
        target: file,
        secrets: { accountId: 'cli-uid' },
      }),
      encoding: 'utf8',
      windowsHide: true,
    })
    assert.equal(r.status, 0, r.stderr)
    const result = JSON.parse((r.stdout ?? '').trim().split(/\r?\n/).pop())
    assert.equal(result.ok, true)
    assert.equal(result.providerCode, 'codex')
    assert.equal(result.targetFile, path.resolve(file))
    assert.equal(readJson(file).tokens.access_token, 'cli-access-token')
    assert.equal((r.stdout ?? '').includes('cli-access-token'), false, 'stdout 不得回显凭据')
    assert.equal((r.stdout ?? '').includes('cli-refresh-token'), false)
    assert.equal((r.stderr ?? '').includes('cli-access-token'), false)
  } finally {
    rmScratch(scratch)
  }
})

// =============================================================================
// ⑨ 客户端进程控制面(2026-10-28 与 trae 对齐:运行中 GUI 会覆写落点)
// =============================================================================

test('CLIENT_IMAGES:GUI 平台先关后写,CLI 两平台不动进程,workbuddy 由适配器自控(钥源不能被预关)', () => {
  assert.equal(L.CLIENT_IMAGES.codex, undefined, 'codex 是 CLI,不该去杀进程')
  assert.equal(L.CLIENT_IMAGES.opencode, undefined, 'opencode 是 CLI,不该去杀进程')
  assert.equal(L.CLIENT_IMAGES.workbuddy, undefined, 'workbuddy 的字段密钥只在运行中的主进程里,main() 预关会关掉钥源')
  for (const provider of ['codearts', 'qoder', 'minimax', 'zcode', 'doubao', 'loomy']) {
    assert.equal(Array.isArray(L.CLIENT_IMAGES[provider]), true, `${provider} 必须有进程映像候选`)
    assert.equal(L.CLIENT_IMAGES[provider].length > 0, true, `${provider} 候选不得为空`)
  }
  // 不支持进程控制的平台:探测面直接 null(由适配器原样写)
  assert.equal(L.closeClientForWrite('codex'), null)
  assert.equal(L.closeClientForWrite('opencode'), null)
})

test('进程控制开关与拉起:关掉时不探测;没关过就不拉起(不误启用户没开的客户端)', () => {
  assert.equal(L.closeClientForWrite('qoder', { IHUI_LOCAL_LOGIN_PROC_CONTROL: '0' }), null)
  const idle = { restarted: false, error: '' }
  assert.deepEqual(L.relaunchClient(null), idle)
  assert.deepEqual(L.relaunchClient({ wasRunning: false }), idle)
  assert.deepEqual(
    L.relaunchClient({ wasRunning: true, closed: false, product: 'Qoder CN', exePath: '' }),
    idle,
    '没关闭成功就不该拉起(否则等于给用户多开一个实例)',
  )
})

test('进程探测兜底:精确映像名落空时按 exe 路径关键字认客户端,宿主解释器不算', async () => {
  const P = await import('../lib/trae-client-process.mjs')
  const rows = [
    {
      Name: 'CodeArtsAgent.exe',
      ProcessId: 11,
      ExecutablePath: 'C:\\Users\\u\\AppData\\Local\\Programs\\Huawei\\CodeArts-Agent\\CodeArtsAgent.exe',
      CommandLine: '"C:\\Users\\u\\AppData\\Local\\Programs\\Huawei\\CodeArts-Agent\\CodeArtsAgent.exe"',
    },
    {
      Name: 'CodeArtsAgent.exe',
      ProcessId: 12,
      ExecutablePath: 'C:\\Users\\u\\AppData\\Local\\Programs\\Huawei\\CodeArts-Agent\\CodeArtsAgent.exe',
      CommandLine: '"…\\CodeArtsAgent.exe" --type=renderer',
    },
    // 宿主解释器:路径里带产品关键字(node scripts/codearts-*.mjs),但绝不是客户端本体
    { Name: 'node.exe', ProcessId: 13, ExecutablePath: 'D:\\IHUI-AI\\scripts\\codearts-writer.mjs', CommandLine: 'node …' },
    { Name: 'chrome.exe', ProcessId: 14, ExecutablePath: 'C:\\Program Files\\Google\\Chrome\\chrome.exe', CommandLine: '' },
  ]
  const hit = P.matchProcessesByPath(rows, ['codearts'])
  assert.deepEqual(
    hit.map((h) => h.pid),
    [11, 12],
    '同一映像名的全部进程都要算(主进程 + 渲染子进程),否则关一半等于没关',
  )
  assert.equal(hit[0].image, 'CodeArtsAgent', 'image 去 .exe,供 tasklist 轮询与拉起复核')
  assert.equal(
    P.matchProcessesByPath([{ Name: 'QoDer CN.exe', ProcessId: 1, ExecutablePath: 'C:\\x\\QoDer CN.exe' }], ['qoder'])
      .length,
    1,
    '关键字匹配必须大小写不敏感',
  )
  assert.deepEqual(P.matchProcessesByPath(rows, []), [], '没有关键字就不猜')
  assert.deepEqual(P.matchProcessesByPath([{ Name: 'a.exe', ProcessId: 1 }], ['a']), [], '拿不到路径不认')
  for (const provider of ['codearts', 'qoder', 'minimax', 'zcode', 'doubao', 'loomy']) {
    assert.equal((L.CLIENT_PATH_HINTS[provider] ?? []).length > 0, true, `${provider} 必须有路径兜底关键字`)
  }
  assert.equal(L.CLIENT_PATH_HINTS.codex, undefined)
  assert.equal(L.CLIENT_PATH_HINTS.opencode, undefined)
})

test('写后自检:读回值必须等于刚写入的凭证,读不回/抛错一律 write-verify', () => {
  assert.doesNotThrow(() => L.assertReadBack('x', () => true))
  assert.throws(
    () => L.assertReadBack('x', () => false),
    (e) => e?.code === 'write-verify' && /覆写/.test(e.message),
    '落点被别的进程改回去还报成功,就是用户说的"点了不好使"',
  )
  assert.throws(
    () =>
      L.assertReadBack('x', () => {
        throw new Error('database is locked')
      }),
    (e) => e?.code === 'write-verify' && /读不回来/.test(e.message) && /database is locked/.test(e.message),
    '读不回来(库被占)不得当作成功',
  )
})

test('关不掉就拒写:进程仍在跑/关断未判定一律 target-locked,关干净了才放行', () => {
  assert.doesNotThrow(() => L.assertClientClosed(null))
  assert.doesNotThrow(() => L.assertClientClosed({ wasRunning: false, closed: false }))
  assert.doesNotThrow(() =>
    L.assertClientClosed({ wasRunning: true, closed: true, product: 'Qoder CN' }),
  )
  assert.throws(
    () => L.assertClientClosed({ wasRunning: true, closed: false, product: 'Qoder CN' }),
    (e) => e?.code === 'target-locked' && /仍在运行/.test(e.message),
    '关不掉还继续写,退出时必被客户端内存态覆写 ⇒ 必须拒写而不是冒绿',
  )
})

// =============================================================================
// ⑩ WorkBuddy($wbEncrypted 字段信封重封;进程控制走假 extract + 关断开关)
// =============================================================================

const WB_SECRET = 'wb-test-bootstrap-secret'

/** 造一份带信封的本机会话文件(与真机同形:资料/凭证都是 $wbEncrypted) */
function wbRawTree({ uid, at, rt, nickname }) {
  const { key, keyId } = W.deriveAtRestKey(WB_SECRET)
  return {
    tree: {
      account: { uid, nickname: W.sealField(nickname, key, keyId), type: 'oath' },
      auth: {
        accessToken: W.sealField(at, key, keyId),
        refreshToken: W.sealField(rt, key, keyId),
        expiresIn: 7200,
        tokenType: 'Bearer',
        domain: 'codebuddy.cn',
        lastRefreshTime: '2026-10-01T00:00:00.000Z',
        expiresAt: '2026-10-01T02:00:00.000Z',
      },
      accounts: [{ uid, nickname: W.sealField(nickname, key, keyId) }],
      allAccounts: [],
    },
    key,
    keyId,
  }
}

function wbFakeExtract(mains) {
  return {
    ...extract,
    listWorkbuddyMainProcesses: () => mains,
    readAtRestBootstrap: async () => ({ atRestSecretKey: WB_SECRET }),
  }
}

const WB_ENV_OFF = { IHUI_LOCAL_LOGIN_PROC_CONTROL: '0' }

test('workbuddy:同账号净零 ⇒ 整树原样搬,只重封凭证族,资料信封逐字节保留', async () => {
  const scratch = mkScratch('local-login-wb')
  try {
    const file = path.join(scratch, 'workbuddy-desktop.info')
    const { tree, key, keyId } = wbRawTree({ uid: 'wb-uid', at: 'old-at', rt: 'old-rt', nickname: '张三' })
    const beforeRaw = `${JSON.stringify(tree)}\n`
    fs.writeFileSync(file, beforeRaw)
    const sealedPaths = W.collectSealedPaths(tree)
    const payload = L.normalizePayload({
      uid: 'wb-uid',
      token: 'new-at',
      refreshToken: 'new-rt',
      expiresAt: '2026-12-01T00:00:00.000Z',
      target: file,
      secrets: { edition: 'workbuddy', authFile: file, sealedPaths },
    })
    const result = await L.applyWorkbuddy(payload, { extract: wbFakeExtract([{ pid: 4321, userDataDir: 'C:\\Users\\t\\.workbuddy\\app' }]), env: WB_ENV_OFF })
    const reread = W.decryptSessionTree(readJson(file), key, keyId)
    assert.equal(reread.auth.accessToken, 'new-at')
    assert.equal(reread.auth.refreshToken, 'new-rt')
    assert.equal(reread.auth.expiresAt, '2026-12-01T00:00:00.000Z')
    assert.equal(reread.account.nickname, '张三', '同账号资料信封必须原样保留')
    assert.equal(reread.accounts[0].nickname, '张三')
    assert.equal(reread.account.uid, 'wb-uid')
    // 非凭证信封逐字节不变(净零:没理由动的别动)
    const afterRaw = readJson(file)
    assert.equal(JSON.stringify(afterRaw.account.nickname), JSON.stringify(tree.account.nickname))
    assert.equal(result.replacedUid, 'wb-uid')
    noPlaintext(result, ['new-at', 'new-rt'])
    assert.equal(fs.readFileSync(result.backupFile).equals(Buffer.from(beforeRaw, 'utf8')), true)
  } finally {
    rmScratch(scratch)
  }
})

test('workbuddy:本机是别人号 ⇒ 用池内模板重建树并按 sealedPaths 重封资料信封', async () => {
  const scratch = mkScratch('local-login-wb-tpl')
  try {
    const file = path.join(scratch, 'workbuddy-desktop.info')
    const other = wbRawTree({ uid: 'other-uid', at: 'other-at', rt: 'other-rt', nickname: '别人' })
    fs.writeFileSync(file, JSON.stringify(other.tree))
    const mine = wbRawTree({ uid: 'wb-uid', at: 'tpl-at', rt: 'tpl-rt', nickname: '我' })
    const template = W.buildWorkbuddyTemplate(W.decryptSessionTree(mine.tree, mine.key, mine.keyId))
    assert.equal(template.auth.accessToken, undefined, '模板必须剔净凭证')
    const payload = L.normalizePayload({
      uid: 'wb-uid',
      token: 'new-at',
      refreshToken: 'new-rt',
      target: file,
      secrets: {
        edition: 'workbuddy',
        authFile: file,
        sealedPaths: W.collectSealedPaths(mine.tree),
        sessionTemplate: template,
      },
    })
    const result = await L.applyWorkbuddy(payload, { extract: wbFakeExtract([{ pid: 4321, userDataDir: 'C:\\Users\\t\\.workbuddy\\app' }]), env: WB_ENV_OFF })
    const reread = W.decryptSessionTree(readJson(file), mine.key, mine.keyId)
    assert.equal(reread.auth.accessToken, 'new-at')
    assert.equal(reread.account.uid, 'wb-uid', '整树必须换成目标号,别人资料一条不带')
    assert.equal(reread.account.nickname, '我')
    assert.equal(reread.accounts[0].nickname, '我')
    assert.equal(reread.account.type, 'oath', '模板里的明文旁键保留')
    // 重封后的资料字段在盘上仍是信封形态(客户端只认信封)
    assert.equal(readJson(file).account.nickname.$wbEncrypted, 1)
    assert.equal(result.replacedUid, 'other-uid')
    noPlaintext(result, ['new-at', 'new-rt'])
  } finally {
    rmScratch(scratch)
  }
})

test('workbuddy:本机别人号 + 池内无模板 ⇒ no-template 拒写(绝不拿别人的树冒绿)', async () => {
  const scratch = mkScratch('local-login-wb-none')
  try {
    const file = path.join(scratch, 'workbuddy-desktop.info')
    const other = wbRawTree({ uid: 'other-uid', at: 'a', rt: 'r', nickname: '别人' })
    fs.writeFileSync(file, JSON.stringify(other.tree))
    const payload = L.normalizePayload({
      uid: 'wb-uid',
      token: 'new-at',
      target: file,
      secrets: { edition: 'workbuddy', authFile: file },
    })
    await assert.rejects(
      () => L.applyWorkbuddy(payload, { extract: wbFakeExtract([{ pid: 4321, userDataDir: 'C:\\Users\\t\\.workbuddy\\app' }]), env: WB_ENV_OFF }),
      (e) => e?.code === 'no-template',
    )
    assert.equal(fs.readFileSync(file, 'utf8'), JSON.stringify(other.tree), '拒写不得动原文件')
  } finally {
    rmScratch(scratch)
  }
})

test('workbuddy:没有运行中的主进程 ⇒ no-target 点名(取不到钥不猜)', async () => {
  const payload = L.normalizePayload({ uid: 'u', token: 't', secrets: { edition: 'workbuddy' } })
  await assert.rejects(
    () => L.applyWorkbuddy(payload, { extract: wbFakeExtract([]), env: WB_ENV_OFF }),
    (e) => e?.code === 'no-target' && /主进程/.test(e.message),
  )
})

// =============================================================================
// ⑪ 豆包(Chromium Cookies 库 v10 重封;DPAPI 仅 Windows)
// =============================================================================

const DOUBAO_COLS =
  'creation_utc, host_key, top_frame_site_key, name, value, encrypted_value, path, expires_utc,' +
  ' is_secure, is_httponly, last_access_utc, has_expires, is_persistent, priority, samesite,' +
  ' source_scheme, source_port, last_update_utc, source_type, has_cross_site_ancestor'

test(
  'doubao:已有行 UPDATE + 缺行 INSERT(镜像 ttwid 默认值),v10 重封可按豆包读法解回',
  { skip: IS_WINDOWS ? false : 'DPAPI 仅 Windows 可用' },
  () => {
    const scratch = mkScratch('local-login-doubao')
    try {
      const udata = path.join(scratch, 'User Data')
      fs.mkdirSync(path.join(udata, 'Default', 'Network'), { recursive: true })
      const aesKey = crypto.randomBytes(32)
      if (!writeLocalState(udata, aesKey)) return
      const dbFile = path.join(udata, 'Default', 'Network', 'Cookies')
      const { DatabaseSync } = require('node:sqlite')
      const db = new DatabaseSync(dbFile)
      db.exec(
        `CREATE TABLE cookies (creation_utc INTEGER NOT NULL UNIQUE PRIMARY KEY, host_key TEXT NOT NULL,` +
          ` top_frame_site_key TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL,` +
          ` encrypted_value BLOB NOT NULL, path TEXT NOT NULL, expires_utc INTEGER NOT NULL,` +
          ` is_secure INTEGER NOT NULL, is_httponly INTEGER NOT NULL, last_access_utc INTEGER NOT NULL,` +
          ` has_expires INTEGER NOT NULL, is_persistent INTEGER NOT NULL, priority INTEGER NOT NULL,` +
          ` samesite INTEGER NOT NULL, source_scheme INTEGER NOT NULL, source_port INTEGER NOT NULL,` +
          ` last_update_utc INTEGER NOT NULL, source_type INTEGER NOT NULL, has_cross_site_ancestor INTEGER NOT NULL)`,
      )
      // 现役 ttwid 行(旧值 v10 封),sessionid 缺行 ⇒ 覆盖 UPDATE 路径 + 新建 INSERT 路径
      db.prepare(
        `INSERT INTO cookies (${DOUBAO_COLS}) VALUES (1,'.doubao.com','','ttwid','',?,'/',0,1,1,2,0,1,1,0,2,443,2,1,0)`,
      ).run(L.encryptSafeStorageBlob(extract.wrapDoubaoAppPrefix('old-ttwid'), aesKey))
      db.exec("INSERT INTO cookies (creation_utc, host_key, top_frame_site_key, name, value, encrypted_value, path, expires_utc, is_secure, is_httponly, last_access_utc, has_expires, is_persistent, priority, samesite, source_scheme, source_port, last_update_utc, source_type, has_cross_site_ancestor) VALUES (9,'.example.com','','keep','',x'00','/',0,0,0,0,0,0,0,0,0,80,0,0,0)")
      db.close()

      const beforeRaw = fs.readFileSync(dbFile)
      const payload = L.normalizePayload({
        uid: 'auto:bundle',
        token: 'new-sess',
        target: udata,
        cookies: [
          { source: 'cookies', key: 'ttwid', host: '.doubao.com', value: 'new-ttwid' },
          { source: 'cookies', key: 'sessionid', host: '.doubao.com', value: 'new-sess' },
        ],
        secrets: {},
      })
      const result = L.applyDoubao(payload, { extract })
      const ro = new DatabaseSync(dbFile, { readOnly: true })
      try {
        const open = (v) => extract.stripDoubaoAppPrefix(extract.decryptOsCryptString(Buffer.from(v), aesKey, { rawBuffer: true }))
        // 只选小列:creation_utc/last_update_utc 是 Chromium epoch 微秒,SELECT * 会触发
        // node:sqlite 大整数 RangeError(读回大数需 CAST 或 setReadBigInts,断言用不到)
        const small = 'name, host_key, value, encrypted_value, path, is_secure, samesite, source_port'
        const t = ro.prepare(`SELECT ${small} FROM cookies WHERE name='ttwid'`).get()
        assert.equal(t.value, '', '写回后 value 列必须清空(真值只在 encrypted_value)')
        assert.equal(open(t.encrypted_value), 'new-ttwid')
        const s = ro.prepare(`SELECT ${small} FROM cookies WHERE name='sessionid'`).get()
        assert.equal(s.host_key, '.doubao.com')
        assert.equal(open(s.encrypted_value), 'new-sess')
        assert.equal(s.path, '/')
        assert.equal(s.is_secure, 1)
        assert.equal(s.samesite, 0)
        assert.equal(s.source_port, 443)
        const keep = ro.prepare(`SELECT ${small} FROM cookies WHERE name='keep'`).get()
        assert.equal(keep.value, '', '无关行不得动')
        assert.equal(Buffer.from(keep.encrypted_value).equals(Buffer.from([0])), true)
      } finally {
        ro.close()
      }
      assert.equal(result.targetFile, dbFile)
      assert.equal(fs.readFileSync(result.backupFile).equals(beforeRaw), true, '备份必须逐字节等于写前')
      noPlaintext(result, ['new-ttwid', 'new-sess'])
    } finally {
      rmScratch(scratch)
    }
  },
)

test('doubao:池号没有 cookie 捆绑包 ⇒ no-template 点名(不猜不落笔)', () => {
  const payload = L.normalizePayload({ uid: 'auto:x', token: 't', secrets: {} })
  assert.throws(() => L.applyDoubao(payload, { extract }), (e) => e?.code === 'no-template')
})

// =============================================================================
// ⑫ Loomy(Chromium DOM Storage leveldb 活日志 WriteBatch 追加;2026-10-28 装车)
// =============================================================================

test('leveldb-log:WriteBatch 编解码往返 + put/delete 条目格式(判据 write_batch.cc)', () => {
  const key = lv.lsValueKey('loomy-auth-session')
  const val = lv.encodeStoredValue('{"session":"t-1"}')
  const payload = lv.buildBatch(7n, [
    { key, value: val },
    { key: Buffer.from('_file://\x00\x01del', 'latin1'), value: null },
  ])
  const b = lv.parseBatch(payload)
  assert.equal(b.seq, 7n)
  assert.equal(b.count, 2)
  assert.equal(b.entries[0].type, 1)
  assert.equal(b.entries[0].key.equals(key), true)
  assert.equal(b.entries[0].value.equals(val), true)
  assert.equal(b.entries[1].type, 0)
  assert.equal(b.entries[1].value, null)
  // 解不成合法批次 ⇒ null(读不出不猜)
  assert.equal(lv.parseBatch(Buffer.from([1, 2, 3])), null)
})

// 2026-10-28 改正:Chromium DOM Storage 的值是 **0x01 + 原文**,不是 varint 长度前缀。
// 证据来自本机真实库(classic-level 直读 47 条键):`loomy:thinking-level` → 01 68 69 67 68
// ("high")、`theme-mode` → 01 6C 69 67 68 74("light")、`loomy:ui:sidebar-width` → 01 32 35 36("256")。
// 旧实现按 varint 写,单元测试"自证自读"全绿而对真客户端是坏的 ⇒ 这条用例改成钉真实字节。
test('leveldb-log:存储值 = 0x01 类型标记 + utf8 原文(真实库字节口径)', () => {
  assert.deepEqual([...lv.encodeStoredValue('high')], [0x01, 0x68, 0x69, 0x67, 0x68])
  assert.equal(lv.decodeStoredValue(Buffer.from([0x01, 0x68, 0x69, 0x67, 0x68])), 'high')

  const s = '张三138****0000'
  const enc = lv.encodeStoredValue(s)
  assert.equal(enc[0], 0x01, '首位恒为类型标记,不带长度')
  assert.deepEqual([...enc.subarray(1)], [...Buffer.from(s, 'utf8')], '标记之后逐字节就是 UTF-8 原文')
  assert.equal(lv.decodeStoredValue(enc), s, '多字节 UTF-8 不得被截断')

  assert.equal(lv.decodeStoredValue(lv.encodeStoredValue('')), '', '空串也是合法的:只剩标记')
  assert.equal(lv.decodeStoredValue(Buffer.alloc(0)), null, '空缓冲 ⇒ 未判定')
  assert.equal(lv.decodeStoredValue(Buffer.from([0x02, 0x41])), null, '未知类型标记 ⇒ 不猜内容')
})

// CRC 掩码常数锁:leveldb-1.20 `util/crc32c.h` 的 kMaskDelta = 0xa282ead8。
// 2026-10-28 实测:写成 0xa282ead3(差 5)时,本机 74 条真实日志记录**全部**校验不过 ——
// 读:解析出 0 条;写:我写的记录真客户端必拒收。这条用例把常数与一条真实向量一起钉死。
test('leveldb-log:CRC 掩码常数 = 0xa282ead8(leveldb-1.20 口径)', () => {
  assert.equal(lv.CRC_MASK_DELTA, 0xa282ead8)
  assert.equal(lv.maskCrc(0), 0xa282ead8, 'mask(0) 就是常数本身')
  assert.equal(lv.crc32c(Buffer.from('123456789', 'ascii')), 0xe3069283, 'CRC32C 标准向量')
  assert.equal(lv.maskCrc(0xe3069283), 0xc78ab0e5, '掩码后的定值:改常数这里必红')
})

test('leveldb-log:块边界零填充 / 跨块拆片重组 / LWW 后写为准 / maxBatchSeq', () => {
  const k1 = lv.lsValueKey('a')
  const b1 = lv.buildBatch(1n, [{ key: k1, value: lv.encodeStoredValue('first') }])
  const b2 = lv.buildBatch(2n, [{ key: k1, value: lv.encodeStoredValue('second') }])

  assert.equal(lv.maxBatchSeq(Buffer.alloc(0)), 0n)
  assert.equal(lv.latestStoredValue(Buffer.alloc(0), k1), null)

  // 常规追加两条批次:后写为准,LWW 取 seq 更高(键相同,追加序即 seq 序)
  let log = lv.appendRecords(Buffer.alloc(0), [b1, b2])
  assert.equal(lv.parseLogRecords(log).length, 2)
  assert.equal(lv.decodeStoredValue(lv.latestStoredValue(log, k1)), 'second')
  assert.equal(lv.maxBatchSeq(log), 2n)

  // 块尾不足 7B ⇒ 零填充换块,记录仍可读
  const pad = Buffer.alloc(lv.BLOCK_SIZE - 5)
  log = lv.appendRecords(pad, [b1])
  assert.equal(log.length > lv.BLOCK_SIZE, true)
  assert.equal(lv.parseLogRecords(log).length, 1)
  assert.equal(lv.decodeStoredValue(lv.latestStoredValue(log, k1)), 'first')

  // 大记录跨块拆片 ⇒ 重组逐字节一致
  const big = lv.buildBatch(9n, [{ key: k1, value: Buffer.alloc(40000, 0x41) }])
  log = lv.appendRecords(Buffer.alloc(0), [big])
  const recs = lv.parseLogRecords(log)
  assert.equal(recs.length, 1)
  assert.equal(recs[0].payload.equals(big), true)

  // delete 条目 ⇒ 键清空
  const del = lv.buildBatch(10n, [{ key: k1, value: null }])
  log = lv.appendRecords(log, [del])
  assert.equal(lv.latestStoredValue(log, k1), null)
})

test('applyLoomy:追加更高 seq 批次(主键+companions),写后按客户端读法全等,备份逐字节', () => {
  const scratch = mkScratch('local-login-loomy')
  try {
    const dir = path.join(scratch, 'Local Storage', 'leveldb')
    fs.mkdirSync(dir, { recursive: true })
    const logFile = path.join(dir, '000004.log')
    // 本机现值:seq=3 的旧号会话
    const oldJson = JSON.stringify({
      phone: '13800000000',
      maskedPhone: '138****0000',
      session: 'old-ticket',
      userid: 'u-old',
      loggedInAt: '2026-10-01T00:00:00.000Z',
    })
    const seed = lv.buildBatch(3n, [
      { key: lv.lsValueKey('loomy-auth-session'), value: lv.encodeStoredValue(oldJson) },
    ])
    const beforeRaw = lv.appendRecords(Buffer.alloc(0), [seed])
    fs.writeFileSync(logFile, beforeRaw)

    const template = {
      phone: '13900000000',
      maskedPhone: '139****0000',
      userid: 'u-new',
      loggedInAt: '2026-10-28T00:00:00.000Z',
    }
    const payload = L.normalizePayload({
      uid: 'u-new',
      token: 'new-ticket',
      target: logFile,
      secrets: { sessionTemplate: template, companions: { 'loomy-last-login-phone': '"13900000000"' } },
    })
    const result = L.applyLoomy(payload, { extract, clientProbe: () => false })
    assert.equal(result.providerCode, 'loomy')
    assert.equal(result.replacedUid, 'u-old', '写前现值的 userid 必须如实回报')
    /**
     * 备份必须落在**库目录之外**:2026-10-28 实测同目录的 `000004.log.ihui-login-*.bak`
     * 十几分钟后被客户端自己清掉了 —— 放在库里的备份等于没留。
     */
    assert.equal(
      result.backupFile.startsWith(path.join(scratch, '.ihui-login-backups')),
      true,
      `备份必须落在库目录外的 .ihui-login-backups/,实得 ${result.backupFile}`,
    )
    assert.equal(
      fs.readFileSync(result.backupFile).equals(beforeRaw),
      true,
      '备份必须逐字节等于写前',
    )

    const after = fs.readFileSync(logFile)
    assert.equal(lv.maxBatchSeq(after), 4n, '新批次 seq = 旧最大 + 1')
    const back = JSON.parse(
      lv.decodeStoredValue(lv.latestStoredValue(after, lv.lsValueKey('loomy-auth-session'))),
    )
    assert.equal(back.session, 'new-ticket')
    assert.equal(back.userid, 'u-new')
    assert.equal(back.phone, '13900000000', '资料字段来自池内模板')
    assert.equal(
      lv.decodeStoredValue(lv.latestStoredValue(after, lv.lsValueKey('loomy-last-login-phone'))),
      '"13900000000"',
      'companions 命中键必须同批落',
    )
    noPlaintext(result, ['new-ticket'])
  } finally {
    rmScratch(scratch)
  }
})

test('applyLoomy:模板 userid 错配 ⇒ template-uid-mismatch 拒写(文件不动,不留备份)', () => {
  const scratch = mkScratch('local-login-loomy-mismatch')
  try {
    const logFile = path.join(scratch, '000004.log')
    const seed = lv.buildBatch(1n, [
      { key: lv.lsValueKey('loomy-auth-session'), value: lv.encodeStoredValue('{"userid":"u-local","session":"x"}') },
    ])
    const before = lv.appendRecords(Buffer.alloc(0), [seed])
    fs.writeFileSync(logFile, before)
    const payload = L.normalizePayload({
      uid: 'u-target',
      token: 't',
      target: logFile,
      secrets: { sessionTemplate: { userid: 'u-other' } },
    })
    assert.throws(() => L.applyLoomy(payload, { extract }), (e) => e?.code === 'template-uid-mismatch')
    assert.equal(fs.readFileSync(logFile).equals(before), true, '拒写不得动原文件')
    assert.equal(
      fs.readdirSync(scratch).filter((f) => f.startsWith('000004.log.ihui-login-')).length,
      0,
      '拒写不得留备份',
    )
  } finally {
    rmScratch(scratch)
  }
})

test('applyLoomy:落点找不到 ⇒ no-target 点名(活日志缺失/无候选目录都不猜)', () => {
  const payload = L.normalizePayload({
    uid: 'u',
    token: 't',
    target: 'Z:/no/such/ihui-loomy/000009.log',
    secrets: {},
  })
  assert.throws(() => L.applyLoomy(payload, { extract }), (e) => e?.code === 'no-target')
  const payload2 = L.normalizePayload({ uid: 'u', token: 't', secrets: {} })
  assert.throws(
    () => L.applyLoomy(payload2, { extract: { loomyCandidateRoamingDirs: () => [] } }),
    (e) => e?.code === 'no-target' && /请先安装并登录/.test(e.message),
  )
})

// 2026-10-28 实测事故:客户端正在跑对话时,有人直调 applyLoomy(绕过 main 的"先关端")把会话
// 追加进了活日志 —— 运行中的客户端不会重读该记录,退出时还会用内存态覆掉。不变量必须住在落笔点。
test('applyLoomy:客户端仍在运行 ⇒ client-running 拒写(文件逐字节不动,不留备份)', () => {
  const scratch = mkScratch('local-login-loomy-live')
  try {
    const logFile = path.join(scratch, '000004.log')
    const seed = lv.buildBatch(1n, [
      { key: lv.lsValueKey('loomy-auth-session'), value: lv.encodeStoredValue('{"userid":"u-local","session":"x"}') },
    ])
    const before = lv.appendRecords(Buffer.alloc(0), [seed])
    fs.writeFileSync(logFile, before)
    const payload = L.normalizePayload({
      uid: 'u-local',
      token: 't-new',
      target: logFile,
      secrets: { sessionTemplate: { userid: 'u-local' } },
    })
    assert.throws(
      () => L.applyLoomy(payload, { extract, clientProbe: () => true }),
      (e) => e?.code === 'client-running' && /一键登录/.test(e.message),
      '在跑必须拒写,并把正当出路(走会先关端的入口)说清楚',
    )
    assert.equal(fs.readFileSync(logFile).equals(before), true, '拒写不得动原文件')
    assert.equal(fs.readdirSync(scratch).filter((f) => f.includes('.ihui-login-')).length, 0, '拒写不得留备份')
    // 探测未判定 ⇒ 同样拒写(§0.3),且报的是 target-locked 而不是"没在跑"
    assert.throws(
      () => L.applyLoomy(payload, { extract, clientProbe: () => null }),
      (e) => e?.code === 'target-locked',
    )
  } finally {
    rmScratch(scratch)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
