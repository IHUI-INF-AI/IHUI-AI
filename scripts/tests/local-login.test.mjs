// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as L } from '../local-login.mjs'
import { __test__ as Z } from '../lib/zcode-auth-extract.mjs'
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
// ⑦ CLI 面
// =============================================================================

test('CLI:--provider 必填且限支持集,stdin JSON 回报不含凭据', () => {
  assert.match(L.parseArgs([]).error ?? '', /--provider/)
  assert.match(L.parseArgs(['--provider', 'loomy', '--stdin']).error ?? '', /不支持/)
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
