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
import { readFileSync } from 'node:fs'

import { __test__ as S } from '../lib/trae-client-switch.mjs'
import { decryptEnvelope, encryptEnvelope } from '../lib/trae-auth-extract.mjs'

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

/**
 * ⑧–⑪ 强杀面的归属判据(2026-10-29 立,守门 52 name-kill 那一型)。
 *
 * 旧写法 `taskkill /IM "Trae CN.exe"` 只接受裸文件名 ⇒ 连全机同名进程一起杀。改成按可执行路径划归属后,
 * 必须成对锁住两件事:**归属命中时真逐个杀**(⑩ 正控)与**筛不出归属时一个都不发**(⑨⑪ 反向对照)——
 * 只测后者会放行"永远不杀"的实现,只测前者会放行"照旧乱杀"的实现。
 */
const ROOT_OK = 'C:/Users/me/AppData/Local/Programs/Trae CN'

test('⑧ selectTraeVictims:安装根之下才算 mine,路径问不到/根外一律 foreign', () => {
  const rows = `123|${ROOT_OK}/Trae CN.exe\n456|C:/Portable/Trae CN.exe\n789|\nnot-a-row\n234|${ROOT_OK}\\sub\\Trae.exe\n`
  const r = S.selectTraeVictims(rows, [ROOT_OK])
  assert.deepEqual(r.mine, ['123', '234'], `反斜杠与正斜杠必须同判,实测 ${JSON.stringify(r.mine)}`)
  assert.equal(r.foreign.length, 2, `根外 1 枚 + 路径问不到 1 枚要报名,实测 ${JSON.stringify(r.foreign)}`)
  // 前缀相似不等于子路径:只差一个字符的兄弟目录不算归属内
  const near = S.selectTraeVictims('999|C:/Users/me/AppData/Local/Programs/Trae CN2/Trae CN.exe\n', [ROOT_OK])
  assert.deepEqual(near.mine, [], '…/Trae CN2/… 不是 …/Trae CN/ 的子路径')
})

test('⑨ killTrae 归属不命中 ⇒ 一个 kill 都不发并抛错(反向对照)', () => {
  const killed = []
  assert.throws(
    () =>
      S.killTrae({
        rows: '456|C:/Portable/Trae CN.exe\n',
        roots: [ROOT_OK],
        killer: (p) => killed.push(p),
      }),
    (e) => e instanceof S.SwitchError && e.code === 'TRAE_NOT_OWNED',
  )
  assert.deepEqual(killed, [], '非归属时绝不能发出任何 kill —— 少停可诊断,误杀是用户事故')
})

test('⑩ killTrae 正控:归属命中的逐个杀(大小写不敏感),根外那枚必须报名', () => {
  const killed = []
  const res = S.killTrae({
    rows: `123|${ROOT_OK}/Trae CN.exe\n234|${ROOT_OK.toLowerCase()}/trae cn.exe\n456|C:/Other/Trae CN.exe\n`,
    roots: [ROOT_OK],
    killer: (p) => killed.push(String(p)),
  })
  assert.deepEqual(res.killed, ['123', '234'])
  assert.deepEqual(killed, ['123', '234'], '只杀归属内那两枚,顺序按枚举序')
  assert.equal(res.foreign.length, 1, '根外那枚必须报出来,不能被静默丢弃')
})

test('⑪ 枚举失败 ⇒ 未判定:一个都不杀并抛 TRAE_ENUM_FAILED;并锁死按镜像名杀不得回潮', () => {
  const killed = []
  assert.throws(
    () =>
      S.killTrae({
        roots: [ROOT_OK],
        spawn: () => ({ status: 1, stdout: '', stderr: 'boom' }),
        killer: (p) => killed.push(p),
      }),
    (e) => e instanceof S.SwitchError && e.code === 'TRAE_ENUM_FAILED',
  )
  assert.deepEqual(killed, [])
  const src = readFileSync(new URL('../lib/trae-client-switch.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /taskkill['"]?\s*,\s*\[\s*['"]\/IM/, "源码里又出现按镜像名 taskkill ⇒ 那一型回潮")
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
