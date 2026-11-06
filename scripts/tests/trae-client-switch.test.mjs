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

// ── 同 uid 多持有者的具名歧义(2026-11-06 立)────────────────────────────────────
// 号池去重键 = (owner_user_id, provider_code, uid) 三元组 ⇒ 同一 uid 的运营池行 + 个人池行
// 是**合法并存**形态(check-pool-isolation.mjs 的 D3 sameUidMultiRow 把它记为 info)。
// 这里钉的是:两腿都不许把"不知道该切哪个持有者"说成"已切 / 本来就是这号(unchanged)"。
// 夹具全合成,零真库、零真写客户端 storage.json。
const OWNER_UUID = '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35'
const OPS_ROW = {
  id: 'r-ops',
  uid: UID,
  name: '193******93',
  ownerUserId: null,
  tempUnschedulable: false,
  updatedAt: new Date('2026-11-01T00:00:00.000Z'),
}
const MINE_ROW = {
  id: 'r-mine',
  uid: UID,
  name: '193******93',
  ownerUserId: OWNER_UUID,
  tempUnschedulable: true,
  updatedAt: new Date('2026-11-05T00:00:00.000Z'),
}

test('多持有者①:同 uid 两行 ⇒ 具名歧义,不许 unchanged、不许自动挑一枚(与行序无关)', () => {
  for (const rows of [
    [OPS_ROW, MINE_ROW],
    [MINE_ROW, OPS_ROW],
  ]) {
    const picked = S.pickPoolCandidates(rows, UID, {})
    assert.equal(picked.decision, 'ambiguous-owner', '两持有者必须具名歧义')
    assert.equal(picked.row, null, '歧义档结构上给不出"选中那一枚"')
    assert.equal(picked.holders, 2)
    // 收窄只能在候选唯一时才算 same-account ⇒ 歧义档原样透传,不可能被洗成 unchanged
    assert.equal(S.narrowByCurrentAccount(picked, UID).decision, 'ambiguous-owner')
  }
  const notice = S.ambiguousOwnerNotice(UID, [OPS_ROW, MINE_ROW], {
    entry: 'node scripts/switch-trae-client-with-chat.mjs',
  })
  assert.match(notice.summary, /2 个持有者/)
  assert.equal(notice.printLines.length, 6, 'summary + 两枚点名 + 定向提示 + 两条可复制命令')
  assert.deepEqual(notice.commands, [
    `node scripts/switch-trae-client-with-chat.mjs --to ${UID} --owner ops`,
    `node scripts/switch-trae-client-with-chat.mjs --to ${UID} --owner ${OWNER_UUID.slice(0, 8)}`,
  ])
  const blob = [
    notice.printLines.join('\n'),
    notice.commands.join('\n'),
    JSON.stringify(notice.holders),
  ].join('|')
  assert.ok(!blob.includes(OWNER_UUID), '输出面绝不含 owner 全值')
  assert.match(blob, /30763d9f\*\*\*/, 'owner 走单源掩码(pool-owner.maskPoolOwner)')
  assert.match(blob, /摘除=是|tempUnschedulable":true/, '个人池那枚的摘除态必须点名(现场即栽在这)')
  assert.ok(!/tokenEnc|secretsEnc/.test(JSON.stringify(notice.holders)), '摘要里不许有密文列')
})

test('多持有者②:候选唯一 ∧ 确为当前在用那枚 ⇒ same-account(unchanged 的唯一合法形)', () => {
  const scoped = S.pickPoolCandidates([OPS_ROW, MINE_ROW], UID, { owner: OWNER_UUID.slice(0, 8) })
  assert.equal(scoped.decision, 'unique')
  assert.equal(scoped.row.id, 'r-mine')
  assert.equal(S.narrowByCurrentAccount(scoped, UID).decision, 'same-account')
  const single = S.pickPoolCandidates([MINE_ROW], UID, {})
  assert.equal(single.decision, 'unique')
  assert.equal(S.narrowByCurrentAccount(single, UID).decision, 'same-account')
})

test('多持有者③:候选唯一 ∧ 非当前在用 ⇒ switch;本机信封读不到也是 switch(不冒充无事可做)', () => {
  const picked = S.pickPoolCandidates([OPS_ROW], UID, {})
  assert.equal(picked.decision, 'unique')
  assert.equal(S.narrowByCurrentAccount(picked, '999999').decision, 'switch')
  assert.equal(S.narrowByCurrentAccount(picked, null).decision, 'switch')
  assert.equal(S.narrowByCurrentAccount(picked, '').decision, 'switch')
})

test('多持有者④:--owner 定向口径(ops/前缀/过短/缺值),坏值一律具名拒绝不静默当"没给"', () => {
  assert.equal(S.pickPoolCandidates([OPS_ROW, MINE_ROW], UID, { owner: 'ops' }).row.id, 'r-ops')
  assert.equal(
    S.pickPoolCandidates([OPS_ROW, MINE_ROW], UID, { owner: OWNER_UUID }).row.id,
    'r-mine',
  )
  const nf = S.pickPoolCandidates([OPS_ROW, MINE_ROW], '查无此号', { owner: 'ops' })
  assert.equal(nf.decision, 'not-found')
  assert.match(nf.scopeNote, /--owner ops/, 'not-found 要点名"已按 --owner 收窄"')
  const short = S.pickPoolCandidates([OPS_ROW, MINE_ROW], UID, { owner: '3076' })
  assert.equal(short.decision, 'bad-owner-selector')
  assert.match(short.error, /前缀太短/)
  assert.match(S.parseArgs(['--to', UID, '--owner']).error, /--owner 需要/)
  assert.equal(S.parseArgs(['--to', UID, '--owner', 'ops']).owner, 'ops')
  assert.equal(S.parseArgs(['--to', UID]).owner, '', '缺省 = 不定向(所以才会走到歧义档)')
})

test('多持有者⑤:既有匹配档不变(uid 精确 > 名称精确 > 名称包含;异 uid 多枚仍是 ambiguous-uid)', () => {
  const other = {
    id: 'r-other',
    uid: '777',
    name: '193副号',
    ownerUserId: null,
    tempUnschedulable: false,
  }
  assert.equal(
    S.pickPoolCandidates([OPS_ROW, other], '193副号', {}).row.id,
    'r-other',
    '名称精确档',
  )
  assert.equal(
    S.pickPoolCandidates([OPS_ROW, other], '777', {}).row.id,
    'r-other',
    'uid 精确档优先',
  )
  const multi = S.pickPoolCandidates([OPS_ROW, other], '193', {})
  assert.equal(multi.decision, 'ambiguous-uid', '两枚不同 uid ⇒ 既有"请用 uid 精确指定"档不丢')
  assert.equal(multi.holders, 2)
  assert.equal(S.pickPoolCandidates([OPS_ROW, MINE_ROW], '193', {}).decision, 'ambiguous-owner')
  assert.deepEqual(S.POOL_PICK_DECISIONS, [
    'unique',
    'not-found',
    'ambiguous-uid',
    'ambiguous-owner',
    'bad-owner-selector',
  ])
  assert.deepEqual(S.POOL_NARROW_DECISIONS, ['same-account', 'switch'])
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
