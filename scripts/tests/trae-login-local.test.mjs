// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/** 空进程面:单测绝不真探测 tasklist(慢且会受本机在跑的真人客户端影响) */
const noProc = () => ({ unknown: false, running: new Set(), pidsByProduct: {} })

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
    const result = L.applyLogin(T, payload, { probe: noProc() })

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
    const again = L.applyLogin(T, payload, { probe: noProc() })
    assert.equal(again.deviceEnvelopePresent, true)
    assert.equal(again.deviceEnvelopeWritten, false)
    assert.equal(again.replacedUid, UID)

    // 本机已有同 deviceId 的另一份材料 ⇒ 绝不覆盖
    store[`iCubeAuthInfo://icube-dc:${DEVICE_ID}`] = T.encryptEnvelope(
      JSON.stringify({ privateKeyPEM: 'LOCAL-PRIV', publicKeyPEM: 'LOCAL-PUB' }),
    )
    fs.writeFileSync(file, JSON.stringify(store))
    L.applyLogin(T, payload, { probe: noProc() })
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
      () => L.applyLogin(T, L.normalizePayload({ ...PAYLOAD, targetStorage: bad }), { probe: noProc() }),
      (e) => e.code === 'storage-shape',
    )
    const arr = path.join(scratch, 'arr.json')
    fs.writeFileSync(arr, '[]')
    assert.throws(
      () => L.applyLogin(T, L.normalizePayload({ ...PAYLOAD, targetStorage: arr }), { probe: noProc() }),
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

/**
 * ⑥/⑦ 覆盖 2026-10-28 实测根因:客户端在跑时写盘必被它退出时的内存态覆写。
 * 关停/拉起一律注入假实现 —— **单测绝不真动本机客户端**(用户正在用)。
 */
const storeFile = (scratch, product) => {
  const file = path.join(scratch, product, 'User', 'globalStorage', 'storage.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(
    file,
    JSON.stringify({
      theme: 'vs-dark',
      [L.SESSION_KEY]: T.encryptEnvelope(JSON.stringify({ userId: '340221726063980' })),
    }),
  )
  return file
}

test('⑥ 进程面:在跑则先优雅关闭→写→自检→自动拉起;关不掉/探测失败一律不写', () => {
  const scratch = mkScratch('trae-login-local-proc')
  try {
    const file = storeFile(scratch, 'Trae CN')
    const running = () => ({
      unknown: false,
      running: new Set(['Trae CN']),
      pidsByProduct: { 'Trae CN': [4242] },
    })

    // 服务端调用(restartClient)但探测不了 ⇒ 拒绝写入,原文件不动
    const beforeProbe = fs.readFileSync(file, 'utf8')
    assert.throws(
      () =>
        L.applyLogin(T, L.normalizePayload({ ...PAYLOAD, restartClient: true, targetStorage: file }), {
          probe: { unknown: true, running: new Set(), pidsByProduct: {} },
        }),
      (e) => e.code === 'process-probe-failed',
    )
    assert.equal(fs.readFileSync(file, 'utf8'), beforeProbe, '探测失败时绝不能盲写')

    // 手工 CLI(无 restartClient)遇到在跑的目标 ⇒ 明确拒绝并指路,不悄悄写一遍
    assert.throws(
      () =>
        L.applyLogin(T, L.normalizePayload({ ...PAYLOAD, targetStorage: file }), { probe: running() }),
      (e) => e.code === 'target-locked',
    )
    assert.equal(fs.readFileSync(file, 'utf8'), beforeProbe)
    assert.equal(L.normalizePayload(PAYLOAD).restartClient, false, '缺省不得动进程')

    // 关不掉(托盘常驻/有未响应窗口)⇒ 不写,如实报错,不强杀丢用户未保存内容
    assert.throws(
      () =>
        L.applyLogin(T, L.normalizePayload({ ...PAYLOAD, restartClient: true, targetStorage: file }), {
          probe: running(),
          resolveExe: () => 'C:/fake/Trae CN.exe',
          closeProduct: () => ({ wasRunning: true, closed: false, pids: [4242] }),
          launchProduct: () => assert.fail('没关成就不能拉起'),
        }),
      (e) => e.code === 'target-locked',
    )
    assert.equal(fs.readFileSync(file, 'utf8'), beforeProbe)

    // 正路:关停 → 写入 → 自检 → 拉起;顺序与参数都要锁
    const calls = []
    const result = L.applyLogin(
      T,
      L.normalizePayload({ ...PAYLOAD, restartClient: true, targetStorage: file }),
      {
        probe: running(),
        resolveExe: () => 'C:/fake/Trae CN.exe',
        closeProduct: (product, o) => {
          calls.push(['close', product, o.pids])
          return { wasRunning: true, closed: true, pids: o.pids }
        },
        launchProduct: (exe) => {
          calls.push(['launch', exe])
          return { launched: true, error: '' }
        },
      },
    )
    assert.deepEqual(calls, [
      ['close', 'Trae CN', [4242]],
      ['launch', 'C:/fake/Trae CN.exe'],
    ])
    assert.equal(result.clientProduct, 'Trae CN')
    assert.equal(result.clientWasRunning, true)
    assert.equal(result.clientClosed, true)
    assert.equal(result.clientRestarted, true)
    assert.match(result.restartHint, /重新打开/)
    const written = JSON.parse(T.decryptEnvelope(JSON.parse(fs.readFileSync(file, 'utf8'))[L.SESSION_KEY]))
    assert.equal(written.userId, UID, '落盘的必须是目标号')
    assert.equal(written.token, PAYLOAD.token)

    // 拉起失败也要落盘成功并如实回报(让用户手动开,而不是报"写入失败")
    const manual = L.applyLogin(
      T,
      L.normalizePayload({ ...PAYLOAD, restartClient: true, targetStorage: file }),
      {
        probe: running(),
        resolveExe: () => 'C:/fake/Trae CN.exe',
        closeProduct: () => ({ wasRunning: true, closed: true, pids: [4242] }),
        launchProduct: () => ({ launched: false, error: '拒绝访问' }),
      },
    )
    assert.equal(manual.ok, true)
    assert.equal(manual.clientRestarted, false)
    assert.equal(manual.clientLaunchError, '拒绝访问')
    assert.match(manual.restartHint, /手动打开/)

    // 写入失败也要把用户客户端拉回来(finally),否则用户会以为客户端"被关掉了"
    const badFile = path.join(scratch, 'Trae', 'User', 'globalStorage', 'storage.json')
    fs.mkdirSync(path.dirname(badFile), { recursive: true })
    fs.writeFileSync(badFile, '{broken')
    let relaunched = false
    assert.throws(
      () =>
        L.applyLogin(T, L.normalizePayload({ ...PAYLOAD, restartClient: true, targetStorage: badFile }), {
          probe: { unknown: false, running: new Set(['Trae']), pidsByProduct: { Trae: [7] } },
          resolveExe: () => 'C:/fake/Trae.exe',
          closeProduct: () => ({ wasRunning: true, closed: true, pids: [7] }),
          launchProduct: () => {
            relaunched = true
            return { launched: true, error: '' }
          },
        }),
      (e) => e.code === 'storage-shape',
    )
    assert.equal(relaunched, true, '写失败也必须重新拉起客户端')

    // 客户端没在跑 ⇒ 不关不拉,直接写
    const idle = L.applyLogin(T, L.normalizePayload({ ...PAYLOAD, restartClient: true, targetStorage: file }), {
      probe: noProc(),
      closeProduct: () => assert.fail('没在跑就不能关'),
      launchProduct: () => assert.fail('没在跑就不该拉起'),
    })
    assert.equal(idle.clientWasRunning, false)
    assert.equal(idle.clientClosed, false)
    assert.match(idle.restartHint, /直接打开/)
  } finally {
    rmScratch(scratch)
  }
})

test('⑦ 落点面:多份客户端同时安装时优先正在运行的那份,其次有登录态的,最后按 mtime', () => {
  const scratch = mkScratch('trae-login-local-pick')
  try {
    const cn = storeFile(scratch, 'Trae CN') // 最新但无信封
    const solo = storeFile(scratch, 'TRAE SOLO CN') // 较旧,有信封
    const plain = storeFile(scratch, 'Trae') // 最旧,有信封
    fs.writeFileSync(cn, JSON.stringify({ theme: 'x' }))
    const now = Date.now() / 1000
    fs.utimesSync(cn, now, now)
    fs.utimesSync(solo, now - 3600, now - 3600)
    fs.utimesSync(plain, now - 7200, now - 7200)
    const extract = { traeUserDataDirs: () => [plain, solo, cn].map((f) => path.dirname(path.dirname(path.dirname(f)))) }

    // 都没在跑:有登录态的优先,同档取最新 ⇒ TRAE SOLO CN
    assert.equal(L.locateStorage(extract, '', { runningProducts: new Set() }).file, solo)
    // 正在用的是最旧且无信封的那份 ⇒ 就写它(旧实现按产品名次序会写错)
    assert.equal(L.locateStorage(extract, '', { runningProducts: new Set(['Trae']) }).file, plain)
    assert.equal(L.locateStorage(extract, '', { runningProducts: new Set(['Trae CN']) }).file, cn)
    // 显式指定永远优先且标记 explicit
    const explicit = L.locateStorage(extract, cn, { runningProducts: new Set(['Trae']) })
    assert.equal(explicit.file, path.resolve(cn))
    assert.equal(explicit.explicit, true)
    assert.equal(explicit.product, 'Trae CN')
  } finally {
    rmScratch(scratch)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
