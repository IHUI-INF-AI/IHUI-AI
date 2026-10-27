// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 「登录本机」写回端的接线锁(2026-10-27 立)。
 *
 * 锁五件事:
 *   ① 入参面:凭证缺失/模板缺失/模板与 uid 错配一律拒绝,不猜不写
 *   ② 补丁面:模板只贡献账号资料,凭证整族以池内值为准(空票不得把模板旧票带回来)
 *   ③ 写盘面:真写信封能解回、备份逐字节等于写前、原子写不丢旁键
 *   ④ 设备面:池内有材料且本机没有同 deviceId 才补写,绝不覆盖本机现役
 *   ⑤ 输出面:回报里不带任何凭据明文
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { __test__ as L } from '../trae-login-local.mjs'
import { __test__ as T } from '../lib/trae-auth-extract.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const UID = '256600094542297'
const DEVICE_ID = '4355605738307003'

const TEMPLATE = {
  tokenReleaseAt: '2026-10-23T04:33:39.068Z',
  userId: UID,
  host: 'https://api.trae.cn',
  userRegion: { region: 'cn', _aiRegion: 'cn' },
  account: { username: 'someone', email: 'a@b.co', phone: '13800000000', avatar_url: 'x' },
}

const PAYLOAD = {
  uid: UID,
  token: 'new-token-value',
  refreshToken: 'new-refresh-value',
  expiresAt: '2026-11-10T14:19:26.000Z',
  refreshExpiresAt: '2027-04-25T00:00:00.000Z',
  sessionTemplate: TEMPLATE,
}

test('① 入参面:缺证/缺模板/模板错配一律拒绝(未判定不写)', () => {
  assert.throws(() => L.normalizePayload(null), (e) => e.code === 'payload-shape')
  assert.throws(() => L.normalizePayload([]), (e) => e.code === 'payload-shape')
  assert.throws(() => L.normalizePayload({ token: 't' }), (e) => e.code === 'payload-shape')
  assert.throws(() => L.normalizePayload({ uid: UID }), (e) => e.code === 'payload-shape')
  assert.throws(
    () => L.normalizePayload({ uid: UID, token: 't' }),
    (e) => e.code === 'no-template',
    '没有会话模板时不能靠票硬凑登录态',
  )
  assert.throws(
    () => L.normalizePayload({ ...PAYLOAD, sessionTemplate: { ...TEMPLATE, userId: '999' } }),
    (e) => e.code === 'template-uid-mismatch',
    '模板与账号错配必须拒绝(否则把 A 的资料配 B 的票)',
  )
  const ok = L.normalizePayload({ ...PAYLOAD, deviceId: ` ${DEVICE_ID} ` })
  assert.equal(ok.uid, UID)
  assert.equal(ok.deviceId, DEVICE_ID, '字符串字段两端空白必须归一')
  assert.equal(ok.expiresAt, PAYLOAD.expiresAt)
  assert.equal(L.normalizePayload({ ...PAYLOAD, expiresAt: 'not-a-date' }).expiresAt, '')
})

test('② 补丁面:模板只给账号资料,凭证整族以池内值为准(空票不得带回旧票)', () => {
  const dirty = {
    ...TEMPLATE,
    token: 'stale-token',
    refreshToken: 'stale-refresh',
    expiredAt: '2020-01-01T00:00:00.000Z',
    refreshExpiredAt: '2020-01-02T00:00:00.000Z',
  }
  const info = L.buildUserInfo({ ...PAYLOAD, template: dirty })
  assert.equal(info.token, PAYLOAD.token)
  assert.equal(info.refreshToken, PAYLOAD.refreshToken)
  assert.equal(info.expiredAt, PAYLOAD.expiresAt)
  assert.equal(info.refreshExpiredAt, PAYLOAD.refreshExpiresAt)
  assert.equal(info.userId, UID)
  assert.deepEqual(info.account, TEMPLATE.account)
  assert.deepEqual(info.userRegion, TEMPLATE.userRegion)
  assert.equal(dirty.token, 'stale-token', '不得回头修改模板原件')

  const noRt = L.buildUserInfo({ ...PAYLOAD, template: TEMPLATE, refreshToken: '' })
  assert.equal('refreshToken' in noRt, false, '池内没有刷新票时不得写空键或回填旧票')
  const noExp = L.buildUserInfo({ ...PAYLOAD, template: TEMPLATE, expiresAt: '', refreshExpiresAt: '' })
  assert.equal('expiredAt' in noExp, false, '没有到期时刻时不得写空键')
  assert.equal('refreshExpiredAt' in noExp, false)
})

test('③ 写盘面:信封能解回、备份逐字节等、旁键与设备信封按需补写', () => {
  const scratch = mkScratch('trae-login-local')
  try {
    const file = path.join(scratch, 'User', 'globalStorage', 'storage.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const before = {
      theme: 'vs-dark',
      'telemetry.machineId': 'mid-1',
      'iCubeAuthInfo://icube.cloudide': T.encryptEnvelope(
        JSON.stringify({ userId: '340221726063980', token: 'old-token' }),
      ),
    }
    const beforeRaw = JSON.stringify(before)
    fs.writeFileSync(file, beforeRaw)

    const payload = L.normalizePayload({
      ...PAYLOAD,
      deviceId: DEVICE_ID,
      deviceKeyPem: 'PEM-PRIV',
      devicePubPem: 'PEM-PUB',
      targetStorage: file,
    })
    const result = L.applyLogin(T, payload)

    assert.equal(result.ok, true)
    assert.equal(result.storageFile, path.resolve(file))
    assert.equal(result.replacedUid, '340221726063980', '必须回报替换前的 uid(回滚线索)')
    assert.equal(result.deviceEnvelopeWritten, true)
    assert.equal(result.deviceEnvelopePresent, false)
    assert.equal(fs.readFileSync(result.backupFile, 'utf8'), beforeRaw, '备份必须逐字节等于写前')

    const store = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.equal(store.theme, 'vs-dark', '同一文件里的旁键不得丢')
    assert.equal(store['telemetry.machineId'], 'mid-1')
    const written = JSON.parse(T.decryptEnvelope(store[L.SESSION_KEY]))
    assert.equal(written.token, PAYLOAD.token)
    assert.equal(written.userId, UID)
    assert.deepEqual(written.account, TEMPLATE.account)
    const dev = JSON.parse(T.decryptEnvelope(store[`iCubeAuthInfo://icube-dc:${DEVICE_ID}`]))
    assert.deepEqual(dev, { privateKeyPEM: 'PEM-PRIV', publicKeyPEM: 'PEM-PUB' })
    assert.equal(JSON.stringify(result).includes(PAYLOAD.token), false, '回报面不得回显凭据')
    assert.equal(JSON.stringify(result).includes(PAYLOAD.refreshToken), false)

    // 二次写:设备信封已在 ⇒ 只报 present,不重写(本机现役材料优先)
    const again = L.applyLogin(T, payload)
    assert.equal(again.deviceEnvelopePresent, true)
    assert.equal(again.deviceEnvelopeWritten, false)
    assert.equal(again.replacedUid, UID)

    // 本机已有同 deviceId 的另一份材料 ⇒ 绝不覆盖
    store[`iCubeAuthInfo://icube-dc:${DEVICE_ID}`] = T.encryptEnvelope(
      JSON.stringify({ privateKeyPEM: 'LOCAL-PRIV', publicKeyPEM: 'LOCAL-PUB' }),
    )
    fs.writeFileSync(file, JSON.stringify(store))
    L.applyLogin(T, payload)
    const after = JSON.parse(fs.readFileSync(file, 'utf8'))
    const kept = JSON.parse(T.decryptEnvelope(after[`iCubeAuthInfo://icube-dc:${DEVICE_ID}`]))
    assert.equal(kept.privateKeyPEM, 'LOCAL-PRIV', '本机现役设备信封不得被池内材料顶掉')
  } finally {
    rmScratch(scratch)
  }
})

test('④ 落点面:显式路径优先且不存在即拒;坏 JSON/非对象顶库一律拒写', () => {
  const scratch = mkScratch('trae-login-local-miss')
  try {
    assert.throws(
      () => L.locateStorage(T, path.join(scratch, 'nope', 'storage.json')),
      (e) => e.code === 'no-storage',
    )
    const bad = path.join(scratch, 'bad.json')
    fs.writeFileSync(bad, '{not json')
    assert.throws(
      () => L.applyLogin(T, L.normalizePayload({ ...PAYLOAD, targetStorage: bad })),
      (e) => e.code === 'storage-shape',
    )
    const arr = path.join(scratch, 'arr.json')
    fs.writeFileSync(arr, '[]')
    assert.throws(
      () => L.applyLogin(T, L.normalizePayload({ ...PAYLOAD, targetStorage: arr })),
      (e) => e.code === 'storage-shape',
    )
  } finally {
    rmScratch(scratch)
  }
})

test('⑤ 参数面:必须 --stdin(凭证走管道不落盘),未知参数点名', () => {
  assert.equal(L.parseArgs(['--stdin']).error, null)
  assert.equal(L.parseArgs(['--stdin', '--json']).json, true)
  assert.match(L.parseArgs([]).error ?? '', /--stdin/)
  assert.equal(L.parseArgs(['--help']).help, true)
  assert.match(L.parseArgs(['--stdin', '--bogus']).error ?? '', /未知参数/)
})
