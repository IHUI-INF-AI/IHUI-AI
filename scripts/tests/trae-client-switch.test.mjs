// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 一键切号 lib 接线锁(2026-10-28 立)。
 * 判据 import 自生产模块 `__test__`(§22c 不重写判据);真写回依赖本机 Trae 与号池,
 * 测试只锁纯函数与信封往返,不碰真实 storage.json、不 spawn 进程。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { __test__ as S } from '../lib/trae-client-switch.mjs'
import { decryptEnvelope, encryptEnvelope } from '../lib/trae-auth-extract.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const UID = '256600094542297'
const BASE = {
  uid: UID,
  token: 'AT-xyz',
  refreshToken: 'RT-abc',
  tokenExpiresAt: new Date('2026-11-07T00:00:00.000Z'),
  refreshExpiresAt: '2027-04-21T00:00:00.000Z',
  name: '193******93',
  lastRefreshAt: new Date('2026-10-28T01:00:00.000Z'),
  updatedAt: new Date('2026-10-28T02:00:00.000Z'),
}
const PROFILE = {
  host: 'https://api.trae.example',
  userRegion: 'cn',
  tokenReleaseAt: '2026-10-27T23:00:00.000Z',
  account: { username: 'u1', nonPlainTextMobile: '193******93' },
}

test('① 参数面:三模式互斥;--to 缺参/吃旗报错;无模式未判定;--help 短路', () => {
  assert.equal(S.parseArgs([]).error, '缺少模式:--list | --current | --to <uid|名称>')
  assert.equal(S.parseArgs(['--list']).mode, 'list')
  assert.equal(S.parseArgs(['--current']).mode, 'current')
  const to = S.parseArgs(['--to', '193', '--dry-run', '--force', '--json'])
  assert.equal(to.error, null)
  assert.deepEqual([to.mode, to.target, to.dryRun, to.force, to.json], ['to', '193', true, true, true])
  assert.match(S.parseArgs(['--to']).error, /--to 需要/)
  assert.match(S.parseArgs(['--to', '--force']).error, /--to 需要/)
  assert.equal(S.parseArgs(['--bogus']).error, '未知参数: --bogus')
  assert.match(S.parseArgs(['--list', '--to', 'x']).error, /模式互斥/)
  const h = S.parseArgs(['--help'])
  assert.equal(h.help, true)
  assert.equal(h.error, null)
})

test('② userInfo 重建:profile 快照优先,Date→ISO,userId 钉成字符串', () => {
  const info = S.buildClientUserInfo({ ...BASE, profile: PROFILE })
  assert.equal(info.token, 'AT-xyz')
  assert.equal(info.userId, UID)
  assert.equal(info.host, PROFILE.host)
  assert.deepEqual(info.account, PROFILE.account)
  assert.equal(info.userRegion, 'cn')
  assert.equal(info.tokenReleaseAt, PROFILE.tokenReleaseAt)
  assert.equal(info.expiredAt, '2026-11-07T00:00:00.000Z')
  assert.equal(info.refreshExpiredAt, '2027-04-21T00:00:00.000Z')
  assert.equal(info.refreshToken, 'RT-abc')
})

test('③ userInfo 兜底档:无 profile ⇒ 默认 host/名称账户;tokenReleaseAt 退 lastRefreshAt 再退 updatedAt', () => {
  const noProfile = S.buildClientUserInfo(BASE)
  assert.equal(noProfile.host, 'https://api.trae.cn')
  assert.deepEqual(noProfile.account, { username: '193******93' })
  assert.equal(noProfile.tokenReleaseAt, '2026-10-28T01:00:00.000Z')
  const noRefreshAt = S.buildClientUserInfo({ ...BASE, lastRefreshAt: null })
  assert.equal(noRefreshAt.tokenReleaseAt, '2026-10-28T02:00:00.000Z')
  const noName = S.buildClientUserInfo({ ...BASE, name: '' })
  assert.deepEqual(noName.account, { username: `trae-${UID.slice(0, 8)}` })
})

test('④ 空值纪律:缺 token/uid 抛 SwitchError;无 rt/无到期 ⇒ 不写键', () => {
  assert.throws(() => S.buildClientUserInfo({ ...BASE, token: '' }), (e) => e.code === 'no-token')
  assert.throws(() => S.buildClientUserInfo({ ...BASE, uid: '' }), (e) => e.code === 'no-uid')
  const bare = S.buildClientUserInfo({
    uid: UID,
    token: 'AT',
    refreshToken: null,
    tokenExpiresAt: null,
    refreshExpiresAt: undefined,
  })
  assert.equal('refreshToken' in bare, false)
  assert.equal('expiredAt' in bare, false)
  assert.equal('refreshExpiredAt' in bare, false)
  assert.equal('tokenReleaseAt' in bare, false)
})

test('⑤ iso():Date/字符串 → ISO;空与坏值 → null', () => {
  assert.equal(S.iso(new Date('2026-11-07T00:00:00.000Z')), '2026-11-07T00:00:00.000Z')
  assert.equal(S.iso('2026-11-07T00:00:00.000Z'), '2026-11-07T00:00:00.000Z')
  assert.equal(S.iso('not-a-date'), null)
  assert.equal(S.iso(null), null)
  assert.equal(S.iso(''), null)
})

test('⑥ storage 补丁:AUTH 信封往返自证、设备齐才写 dc 键、入参 store 不被改、其余键保留', () => {
  const store = { 'telemetry.machineId': 'm1', [S.AUTH_KEY]: 'OLD-ENVELOPE', other: 42 }
  const snapshot = JSON.stringify(store)
  const userInfo = S.buildClientUserInfo({ ...BASE, profile: PROFILE })

  const noDevice = S.buildStoragePatch(store, { userInfo, device: null })
  assert.deepEqual(noDevice.changed, [S.AUTH_KEY])
  assert.equal(decryptEnvelope(noDevice.next[S.AUTH_KEY]), JSON.stringify(userInfo))
  assert.equal(noDevice.next.other, 42)
  assert.equal(noDevice.next['telemetry.machineId'], 'm1')
  assert.equal(JSON.stringify(store), snapshot, '入参 store 必须原样(纯函数)')

  const device = { deviceId: '99887766', deviceKeyPem: '-----PRIV-----', devicePubPem: '-----PUB-----' }
  const withDevice = S.buildStoragePatch(store, { userInfo, device })
  assert.deepEqual(withDevice.changed, [S.AUTH_KEY, `${S.DC_KEY_PREFIX}${device.deviceId}`])
  const dev = JSON.parse(decryptEnvelope(withDevice.next[`${S.DC_KEY_PREFIX}${device.deviceId}`]))
  assert.deepEqual(dev, { privateKeyPEM: device.deviceKeyPem, publicKeyPEM: device.devicePubPem })

  const halfDevice = { deviceId: '99887766', deviceKeyPem: '-----PRIV-----', devicePubPem: '' }
  assert.deepEqual(S.buildStoragePatch(store, { userInfo, device: halfDevice }).changed, [S.AUTH_KEY])
})

test('⑦ 信封往返自证:encryptEnvelope → decryptEnvelope 逐字节还原', () => {
  for (const text of ['{}', JSON.stringify(S.buildClientUserInfo(BASE)), '中文 mixed\ne'] ) {
    assert.equal(decryptEnvelope(encryptEnvelope(text)), text)
  }
})

test('⑧ killTrae 按 pid 逐个杀,不按映像名全杀', () => {
  const killed = []
  const r = S.killTrae({
    lister: () => [
      { pid: 11, exePath: 'D:\\a\\Trae CN.exe' },
      { pid: 22, exePath: 'D:\\b\\Trae CN.exe' },
    ],
    kill: (pid) => killed.push(pid),
  })
  assert.deepEqual(r.killed, [11, 22])
  assert.deepEqual(killed, [11, 22])
})

test('⑨ killTrae:没在跑 ⇒ 零动作', () => {
  const killed = []
  const r = S.killTrae({ lister: () => [], kill: (p) => killed.push(p) })
  assert.deepEqual(r, { killed: [], reason: 'not-running' })
  assert.deepEqual(killed, [])
})

test('⑩ killTrae:问不到可执行路径 ⇒ 拒绝,一个都不杀', () => {
  const killed = []
  assert.throws(
    () => S.killTrae({ lister: () => [{ pid: 33, exePath: '' }], kill: (p) => killed.push(p) }),
    (e) => e.code === 'kill-refused',
  )
  assert.deepEqual(killed, [])
})

test('⑪ killTrae:某个停不掉 ⇒ kill-partial,不谎报全成', () => {
  assert.throws(
    () =>
      S.killTrae({
        lister: () => [{ pid: 44, exePath: 'D:\\a\\Trae CN.exe' }],
        kill: () => {
          throw new Error('拒绝访问')
        },
      }),
    (e) => e.code === 'kill-partial' && /44/.test(e.message),
  )
})

// ── SOLO/产品面接线锁(2026-10-30 立,携对话切号扩到 TRAE SOLO CN)────────────────
test('findStorageFileForProduct:按产品精确取那份,不回落别的产品', (t2) => {
  mkTmp((dir, env) => {
    for (const p of ['Trae CN', 'TRAE SOLO CN', 'Trae']) {
      fs.mkdirSync(path.join(dir, p, 'User', 'globalStorage'), { recursive: true })
      fs.writeFileSync(path.join(dir, p, 'User', 'globalStorage', 'storage.json'), '{}', 'utf8')
    }
    for (const [want, p] of [
      [path.join(dir, 'TRAE SOLO CN', 'User', 'globalStorage', 'storage.json'), 'TRAE SOLO CN'],
      [path.join(dir, 'Trae CN', 'User', 'globalStorage', 'storage.json'), 'trae cn'],
      [path.join(dir, 'Trae', 'User', 'globalStorage', 'storage.json'), 'TRAE'],
    ])
      assert.equal(S.findStorageFileForProduct(p, env), want, `产品 ${p} 落点错`)
    assert.equal(S.findStorageFileForProduct('Zcode', env), null, '未登记的产品名不得蒙一个')
    assert.equal(S.findStorageFileForProduct('', env), null, '空产品名 ⇒ null(不猜)')
  })
  void t2
})

test('findStorageFileForProduct:只装了一份时,别的产品 ⇒ null(不拿别人的信封顶)', () => {
  mkTmp((dir, env) => {
    fs.mkdirSync(path.join(dir, 'Trae CN', 'User', 'globalStorage'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'Trae CN', 'User', 'globalStorage', 'storage.json'), '{}', 'utf8')
    assert.equal(path.basename(S.findStorageFileForProduct('Trae CN', env)), 'storage.json')
    assert.equal(S.findStorageFileForProduct('TRAE SOLO CN', env), null)
  })
})

test('isProductRunning:返回数组(查询失败面为 null ⇒ 调用方拒写,不冒充"没在跑")', () => {
  const r = S.isProductRunning('NoSuchProduct-IHUI', { ...process.env, IHUI_TRAE_PROCESS_CONTROL: '1' })
  assert.ok(r === null || Array.isArray(r), `既不是 null 也不是数组:${String(r)}`)
  if (Array.isArray(r)) assert.equal(r.length, 0)
  // 关掉进程控制 ⇒ 视为"不在跑"(空数组),写回门仍由 existsSync/备份兜底
  assert.deepEqual(S.isProductRunning('Trae CN', { ...process.env, IHUI_TRAE_PROCESS_CONTROL: '0' }), [])
})

/**
 * 设备档槽位占用关系(2026-11-01 立):同机多号共用一枚 deviceId,槽位被谁占着必须当场点名。
 * 比的是解密后的密钥材料 —— 信封每次随机 session key 重新封装,拿密文比会把"同一份私钥"
 * 读成"覆盖了别人的档"(天天误报的判据等于没有判据)。
 */
test('㉑ deviceDocRelationOf:none / same / other / undetermined 四态分桶', () => {
  // 槽位里存的是客户端自己的形态 {privateKeyPEM, publicKeyPEM}(见 extractDeviceMaterial),
  // device.deviceKeyPem 是池侧/secrets 的键名 —— 两者由 buildStoragePatch 对接,夹具不能混
  const devA = {
    deviceKeyPem: '-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----\n',
    devicePubPem: '-----BEGIN PUBLIC KEY-----\nA\n-----END PUBLIC KEY-----\n',
  }
  const devB = {
    ...devA,
    deviceKeyPem: '-----BEGIN PRIVATE KEY-----\nBBB\n-----END PRIVATE KEY-----\n',
  }
  const slotDoc = (d) => JSON.stringify({ privateKeyPEM: d.deviceKeyPem, publicKeyPEM: d.devicePubPem })
  assert.equal(S.deviceDocRelationOf(undefined, devA), 'none')
  assert.equal(S.deviceDocRelationOf('', devA), 'none')
  // 同一份私钥,两次封装 ⇒ 仍判 same(密文不同不是换号)
  const envA = encryptEnvelope(slotDoc(devA))
  assert.notEqual(encryptEnvelope(slotDoc(devA)), envA, '信封应带随机 session key(前提检查)')
  assert.equal(S.deviceDocRelationOf(envA, devA), 'same')
  assert.equal(S.deviceDocRelationOf(encryptEnvelope(slotDoc(devB)), devA), 'other')
  // 解不开 / 解出来没有私钥 ⇒ 未判定,不猜成 same 也不猜成 other
  assert.equal(S.deviceDocRelationOf('不是信封', devA), 'undetermined')
  assert.equal(S.deviceDocRelationOf(encryptEnvelope(JSON.stringify({ x: 1 })), devA), 'undetermined')
  assert.equal(S.deviceDocRelationOf(envA, { deviceKeyPem: '' }), 'undetermined')
})

test('㉒ buildStoragePatch 回报 deviceDoc 关系,且写的是这一号的私钥', () => {
  const device = {
    deviceId: '1338580922808328',
    deviceKeyPem: '-----BEGIN PRIVATE KEY-----\nMINE\n-----END PRIVATE KEY-----\n',
    devicePubPem: '-----BEGIN PUBLIC KEY-----\nM\n-----END PUBLIC KEY-----\n',
  }
  const otherDoc = { ...device, deviceKeyPem: '-----BEGIN PRIVATE KEY-----\nTHEIRS\n-----END PRIVATE KEY-----\n' }
  const store = {
    [`${S.DC_KEY_PREFIX}${device.deviceId}`]: encryptEnvelope(
      JSON.stringify({ privateKeyPEM: otherDoc.deviceKeyPem, publicKeyPEM: otherDoc.devicePubPem }),
    ),
    untouched: 'keep-me',
  }
  const userInfo = S.buildClientUserInfo({ ...BASE, profile: PROFILE })
  const r = S.buildStoragePatch(store, { userInfo, device })
  assert.equal(r.deviceDoc.relation, 'other')
  assert.equal(r.deviceDoc.key, `${S.DC_KEY_PREFIX}${device.deviceId}`)
  assert.ok(r.changed.includes(r.deviceDoc.key), '设备档键必须进 changed 清单')
  // 真写进去的必须解得出这一号的私钥(不是另一号的,也不是空)
  const written = JSON.parse(decryptEnvelope(r.next[r.deviceDoc.key]))
  assert.equal(written.privateKeyPEM, device.deviceKeyPem)
  assert.equal(r.next.untouched, 'keep-me', '补丁只动声明过的那两枚键')
  // 槽位原本空的 ⇒ none(首次装机形态,不是覆盖)
  assert.equal(
    S.buildStoragePatch({}, { userInfo, device }).deviceDoc.relation,
    'none',
    '空槽位不得报成覆盖',
  )
  // 缺设备材料 ⇒ 不写 dc 键、不回报关系
  const noDev = S.buildStoragePatch(store, { userInfo, device: null })
  assert.equal(noDev.deviceDoc, null)
  assert.deepEqual(noDev.changed, [S.AUTH_KEY])
})

/**
 * 还原口:备份不等于能回。逐字节写回 + 写后自证 + 还原前当前态另存,
 * 三条都在 lib 里,这里连夹具真跑一遍(夹具落唯一出口 mkScratch,不落 os.tmpdir)。
 */
test('㉓ restoreStorage:逐字节还原、当前态另存、坏件拒绝、缺件点名', () => {
  const scratch = mkScratch('sw-restore')
  try {
    const file = path.join(scratch, 'storage.json')
    const bak = `${file}.pre-switch.bak`
    const original = '{"a":1,"nested":{"k":"中文不重排"}}'
    const current = '{"a":2}'
    fs.writeFileSync(bak, original, 'utf8')
    fs.writeFileSync(file, current, 'utf8')

    const r = S.restoreStorage(file)
    assert.equal(r.ok, true, `还原失败:${r.reason}`)
    assert.equal(fs.readFileSync(file, 'utf8'), original, '必须逐字节回到原样(不做 JSON 往返)')
    assert.equal(fs.readFileSync(r.kept, 'utf8'), current, '还原前的当前态也要留得住')

    // 缺还原件 ⇒ 未判定并点名落点,不静默成功
    fs.rmSync(bak)
    const miss = S.restoreStorage(file)
    assert.equal(miss.ok, false)
    assert.match(String(miss.reason), /不在位/)

    // 坏还原件 ⇒ 拒绝写回(不敢把坏档铺到客户端现役盘上)
    fs.writeFileSync(bak, '{坏了', 'utf8')
    const broken = S.restoreStorage(file)
    assert.equal(broken.ok, false)
    assert.match(String(broken.reason), /不是合法 JSON/)
    assert.equal(fs.readFileSync(file, 'utf8'), original, '拒绝还原时盘上一个字节都不该动')
  } finally {
    rmScratch(scratch)
  }
})

test('㉔ --restore 是一个模式,且与其余模式互斥', () => {
  assert.deepEqual(S.parseArgs(['--restore']).mode, 'restore')
  assert.equal(S.parseArgs(['--restore', '--list']).error.includes('模式互斥'), true)
  // --restore 不吃参数:把下一个旗标当值吞掉就是坏形态
  assert.equal(S.parseArgs(['--restore', '--json']).json, true)
  assert.equal(S.parseArgs(['--restore', '--json']).mode, 'restore')
})

/** 造临时 APPDATA 形态目录树并把跨 profile 扫描关掉(测试确定性) */
function mkTmp(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir() || os.homedir(), 'ihui-sw-prod-'))
  try {
    fn(root, { APPDATA: root.replace(/\\/g, '/'), IHUI_TRAE_SCAN_USERS: '0' })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
