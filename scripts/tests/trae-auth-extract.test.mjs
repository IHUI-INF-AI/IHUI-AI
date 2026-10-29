// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 会话提取器的接线锁(2026-10-24 立)。
 *
 * 判据 import 自生产模块的 `__test__`(§22c),本文件不重写判定。
 *
 * 锁五件事:
 *   ① 信封加解密往返 + 阳性对照(不能只判"失败",要证明正例真能打穿)
 *   ② 魔数/长度/MAC 三档破坏一律抛错,绝不静默返回半成品
 *   ③ storage.json 的凭据键挑选顺序(icube.cloudide 优先)与非凭据键排除
 *   ④ userInfo → 号池账号 JSON 的字段映射(展示名优先级、空 refreshToken 不写键)
 *   ⑤ 任何输出面不含凭据明文(提取信息只给长度/到期/指纹)
 *   另:⑥ 落点候选不吃 cwd;⑦ 编排器 --from trae 已装车;⑧ 夹具全链取号
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { __test__ as T, extractTraeAccount } from '../lib/trae-auth-extract.mjs'
import { __test__ as Pool } from '../relay-account-pool.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SESSION = {
  token: 'eyJhbGciOiJIUzI1NiJ9.eyJkYXRhIjp7ImlkIjoiNDIifX0. sig'.replace(' ', ''),
  refreshToken: 'rt-example-value-0123456789',
  expiredAt: '2026-11-06T04:33:38.157Z',
  refreshExpiredAt: '2027-04-21T04:33:38.157Z',
  tokenReleaseAt: '2026-10-23T04:33:39.068Z',
  userId: '256600094542297',
  host: 'https://api.trae.cn',
  account: { phone: '13800000000', email: 'a@b.co', username: 'someone' },
}

test('① 信封加解密往返(正例必须打得穿,否则后面所有失败断言都不算数)', () => {
  const plain = JSON.stringify(SESSION)
  const env = T.encryptEnvelope(plain)
  assert.equal(typeof env, 'string')
  assert.equal(T.decryptEnvelope(env), plain, '往返必须逐字节等值')
  // 同一明文两次加密应因随机会话密钥而不同形(不是固定填充式伪加密)
  assert.notEqual(T.encryptEnvelope(plain), env)
})

test('② 魔数/长度/MAC 三档破坏一律抛错(不允许返回半成品或空串)', () => {
  const good = Buffer.from(T.encryptEnvelope(JSON.stringify(SESSION)), 'base64')
  const cases = [
    ['magic', (b) => (b[2] = 9)],
    ['mac', (b) => (b[100] ^= 1)],
  ]
  for (const [name, mutate] of cases) {
    const broken = Buffer.from(good)
    mutate(broken)
    assert.throws(
      () => T.decryptEnvelope(broken.toString('base64')),
      (e) => e instanceof T.ExtractError && /^envelope-/.test(e.code),
      `${name} 档必须被判坏`,
    )
  }
  assert.throws(
    () => T.decryptEnvelope(good.subarray(0, 20).toString('base64')),
    (e) => e.code === 'envelope-shape',
    '过短信封必须被判坏',
  )
})

test('③ 派生只认会话密钥:同 key 同形、异 key 异形、长度恒 16+16', () => {
  const key = Buffer.alloc(32, 7)
  const a = T.deriveKeyIv(key)
  const b = T.deriveKeyIv(Buffer.alloc(32, 8))
  assert.equal(a.aesKey.length, 16)
  assert.equal(a.iv.length, 16)
  assert.deepEqual([...T.deriveKeyIv(Buffer.alloc(32, 7)).aesKey], [...a.aesKey])
  assert.notDeepEqual([...b.aesKey], [...a.aesKey])
})

test('④ 凭据键挑选:icube.cloudide 优先,非该族与非 base64 一律不收', () => {
  const store = {
    'iCubeAuthInfo://icube-dc:1338580922808328': 'QUJDRA==',
    'iCubeAuthInfo://icube.cloudide': 'QUJDRA==',
    'iCubeAuthInfo://usertag': 'QUJDRA==',
    'iCubeServerData://icube.cloudide': 'QUJDRA==',
    theme: 'vs',
    'iCubeAuthInfo://empty': '',
  }
  assert.deepEqual(T.pickAuthEnvelopeKeys(store), [
    'iCubeAuthInfo://icube.cloudide',
    'iCubeAuthInfo://icube-dc:1338580922808328',
    'iCubeAuthInfo://usertag',
  ])
})

test('⑤ userInfo → 号池账号 JSON:展示名优先级与空 refreshToken 不写键', () => {
  const acct = T.toPoolAccount(SESSION)
  assert.equal(acct.providerCode, 'trae')
  assert.equal(acct.accounts[0].uid, '256600094542297')
  assert.equal(acct.accounts[0].name, '13800000000', '手机优先于邮箱/账户名')
  assert.equal(acct.accounts[0].expiresAt, SESSION.expiredAt)
  assert.equal(
    acct.accounts[0].refreshTokenExpiresAt,
    SESSION.refreshExpiredAt,
    '刷新票到期必须进账号对象(此前只进 meta,导入器丢弃 ⇒ 库里 refresh_expires_at 恒 NULL)',
  )
  assert.equal(acct.meta.refreshExpiresAt, SESSION.refreshExpiredAt)
  assert.equal(acct.meta.hasRefreshToken, true)

  const noRtExp = T.toPoolAccount({ ...SESSION, refreshExpiredAt: undefined })
  assert.equal(
    'refreshTokenExpiresAt' in noRtExp.accounts[0],
    false,
    '上游没给刷新票到期时不得写空键',
  )

  const noRt = T.toPoolAccount({ ...SESSION, refreshToken: '' })
  assert.equal('refreshToken' in noRt.accounts[0], false, '空 refreshToken 不得写成空串键')
  assert.equal(noRt.meta.hasRefreshToken, false)

  const named = T.toPoolAccount({
    ...SESSION,
    account: { email: 'a@b.co', username: 'someone' },
  })
  assert.equal(named.accounts[0].name, 'a@b.co', '无手机时退邮箱')
  assert.throws(() => T.toPoolAccount({ userId: '1' }), T.ExtractError)
  assert.throws(() => T.toPoolAccount({ token: 't' }), T.ExtractError)
})

test('⑥ 任何输出面不得回显凭据明文(指纹只给 sha256 前缀,meta 不含 token 串)', () => {
  const acct = T.toPoolAccount(SESSION)
  const metaText = JSON.stringify(acct.meta)
  assert.equal(metaText.includes(SESSION.token), false)
  assert.equal(metaText.includes(SESSION.refreshToken), false)
  assert.equal(T.fingerprintOf(SESSION.token).length, 12)
  const err = new T.ExtractError('信封魔数不符', 'envelope-shape')
  assert.equal(String(err).includes(SESSION.token), false)
})

test('⑦ 落点候选:显式覆盖排在最前,且不从 cwd 推导', () => {
  const dirs = T.traeUserDataDirs({
    APPDATA: 'C:/Base/AppData',
    IHUI_TRAE_DIR: 'D:/Custom/Trae',
    IHUI_TRAE_SCAN_USERS: '0',
  })
  assert.equal(dirs[0], path.resolve('D:/Custom/Trae'))
  assert.ok(dirs.some((d) => d === path.resolve('C:/Base/AppData/Trae CN')))
  const fallback = T.traeUserDataDirs({ APPDATA: 'C:/Base/AppData', IHUI_TRAE_SCAN_USERS: '0' })
  assert.equal(fallback[0], path.resolve('C:/Base/AppData/Trae CN'))
  assert.ok(
    fallback.every((d) => path.isAbsolute(d)),
    '候选必须全是绝对路径',
  )
})

test('⑬ 跨 profile 兜底:非登录用户 shell 下能在 <UsersRoot>\\<他席>\\AppData\\Roaming 命中真信封', () => {
  const scratch = mkScratch('trae-auth-extract-userscan')
  try {
    // 造一个假 Users 根:sandbox(当前进程)里没信封,Administrator 席才有
    const usersRoot = path.join(scratch, 'Users')
    const other = path.join(usersRoot, 'Administrator', 'AppData', 'Roaming', 'Trae CN')
    const file = path.join(other, 'User', 'globalStorage', 'storage.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(
      file,
      JSON.stringify({
        'iCubeAuthInfo://icube.cloudide': T.encryptEnvelope(JSON.stringify(SESSION)),
      }),
    )
    const env = {
      APPDATA: path.join(scratch, 'Sandbox', 'AppData', 'Roaming'), // 沙箱身份:此路无信封
      SystemDrive: scratch,
      USERPROFILE: path.join(usersRoot, 'Sandbox'),
      IHUI_TRAE_DIR: '',
    }
    const homedir = path.join(usersRoot, 'Sandbox')
    const roots = T.traeUsersRoots(env, homedir)
    assert.ok(
      roots.includes(path.resolve(usersRoot)),
      'Users 根必须由 SystemDrive 给出(扫描面的输入)',
    )
    const dirs = T.traeUserDataDirs(env, homedir)
    assert.ok(
      dirs.includes(path.resolve(file.replace(/[\\/]User[\\/].*$/, ''))),
      '扫描档必须把 Administrator/Trae CN 列进候选',
    )
    // 优先级锁:当前 %APPDATA% 档必须排在扫描档之前(永远不会拿别人 profile 压本机现役)
    const appdataTrae = path.resolve(path.join(env.APPDATA, 'Trae CN'))
    assert.ok(dirs.indexOf(appdataTrae) < dirs.indexOf(path.resolve(other)))
    // 真提取:全链在默认候选(含扫描)下能打穿 —— 这正是 2026-10-26 首跑栽掉的那型
    const out = extractTraeAccount({ dirs: dirs.filter((d) => d.startsWith(path.resolve(other))) })
    assert.equal(out.accounts[0].uid, SESSION.userId)
    // 关扫描档 ⇒ 只剩沙箱候选,该型按"未判定不猜"处理
    const noScan = T.traeUserDataDirs({ ...env, IHUI_TRAE_SCAN_USERS: '0' }, homedir)
    assert.equal(
      noScan.some((d) => d.startsWith(path.resolve(usersRoot))),
      false,
      'IHUI_TRAE_SCAN_USERS=0 必须整体绕开扫描档',
    )
  } finally {
    rmScratch(scratch)
  }
})

test('⑧ 编排器参数面:登记面与未装车面分开点名(不再是笼统「暂不支持」)', () => {
  assert.deepEqual(Pool.parseArgs(['--from', 'trae']).error, null)
  assert.deepEqual(Pool.parseArgs(['--from', 'trae', '--dry-run']).options.from, 'trae')
  // 号池认的平台 parse 必须过,"未装车"的事实由 main() 运行期落 exit 2(未判定,不冒绿也不冒红)
  assert.deepEqual(Pool.parseArgs(['--from', 'codearts']).error, null)
  assert.deepEqual(Pool.parseArgs(['--from', 'qoder']).error, null)
  assert.match(Pool.parseArgs(['--from', 'nosuch']).error ?? '', /未知来源/)
  const R = Pool.FROM_PROVIDERS
  assert.ok(R.trae?.module && R.workbuddy?.module, '已装车的两平台必须登记适配器模块')
  assert.equal(
    R.qoder?.module,
    'qoder-auth-extract.mjs',
    'qoder 提取器已装车(2026-10-27):必须登记适配器模块,不得再挂 null 口头账',
  )
  assert.equal(
    R.codearts?.module,
    'codearts-auth-extract.mjs',
    'codearts 提取器已装车(2026-10-27):必须登记适配器模块,不得再挂 null 口头账',
  )
})

test('⑨ 全链取号:夹具目录里的信封能被真提取出来', () => {
  const scratch = mkScratch('trae-auth-extract')
  try {
    const file = path.join(scratch, 'User', 'globalStorage', 'storage.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(
      file,
      JSON.stringify({
        theme: 'vs',
        'iCubeAuthInfo://usertag': T.encryptEnvelope('{"irrelevant":true}'),
        'iCubeAuthInfo://icube.cloudide': T.encryptEnvelope(JSON.stringify(SESSION)),
      }),
    )
    const out = extractTraeAccount({ dirs: [scratch] })
    assert.equal(out.providerCode, 'trae')
    assert.equal(out.accounts[0].uid, SESSION.userId)
    assert.equal(out.meta.storageKey, 'iCubeAuthInfo://icube.cloudide')
    assert.equal(out.meta.refreshTokenLength, SESSION.refreshToken.length)
    assert.equal(JSON.stringify(out.meta).includes(SESSION.token), false)
  } finally {
    rmScratch(scratch)
  }
})

test('⑩ 取不到信封 ⇒ 抛错点名落点,不返回半成品(§0.3 未判定不猜)', () => {
  const scratch = mkScratch('trae-auth-extract-empty')
  try {
    assert.throws(
      () => extractTraeAccount({ dirs: [scratch] }),
      (e) => e.code === 'no-envelope' && e.message.includes(scratch),
    )
  } finally {
    rmScratch(scratch)
  }
})

test('⑪ 设备材料:icube-dc 信封解出密钥对与 machineId,缺件一律 null', () => {
  const store = {
    'iCubeAuthInfo://icube-dc:4355605738307003': T.encryptEnvelope(
      JSON.stringify({ privateKeyPEM: 'PEM-PRIV', publicKeyPEM: 'PEM-PUB' }),
    ),
    'telemetry.machineId': 'mid-1',
  }
  assert.deepEqual(T.extractDeviceMaterial(store), {
    deviceId: '4355605738307003',
    machineId: 'mid-1',
    privateKeyPem: 'PEM-PRIV',
    publicKeyPem: 'PEM-PUB',
  })
  // 缺公钥 → null(不返回半个材料,adapter 据此退回旧通道)
  const half = {
    'iCubeAuthInfo://icube-dc:4355605738307003': T.encryptEnvelope(
      JSON.stringify({ privateKeyPEM: 'PEM-PRIV' }),
    ),
  }
  assert.equal(T.extractDeviceMaterial(half), null)
  // 设备号不是数字串 → 不认
  const badId = {
    'iCubeAuthInfo://icube-dc:not-a-number': T.encryptEnvelope(
      JSON.stringify({ privateKeyPEM: 'a', publicKeyPEM: 'b' }),
    ),
  }
  assert.equal(T.extractDeviceMaterial(badId), null)
  assert.equal(T.extractDeviceMaterial(null), null)
})

test('⑫ 全链取号带设备材料:账号对象带 deviceId/密钥对,meta 只报有无不回显', () => {
  const scratch = mkScratch('trae-auth-extract-dev')
  try {
    const file = path.join(scratch, 'User', 'globalStorage', 'storage.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(
      file,
      JSON.stringify({
        'iCubeAuthInfo://icube.cloudide': T.encryptEnvelope(JSON.stringify(SESSION)),
        'iCubeAuthInfo://icube-dc:4355605738307003': T.encryptEnvelope(
          JSON.stringify({ privateKeyPEM: 'PEM-PRIV', publicKeyPEM: 'PEM-PUB' }),
        ),
        'telemetry.machineId': 'mid-1',
      }),
    )
    const out = extractTraeAccount({ dirs: [scratch] })
    const acc = out.accounts[0]
    assert.equal(acc.deviceId, '4355605738307003')
    assert.equal(acc.machineId, 'mid-1')
    assert.equal(acc.deviceKeyPem, 'PEM-PRIV')
    assert.equal(acc.devicePubPem, 'PEM-PUB')
    assert.equal(out.meta.hasDeviceMaterial, true)
    // 输出面纪律:meta 不带密钥明文
    assert.equal(JSON.stringify(out.meta).includes('PEM-PRIV'), false)
  } finally {
    rmScratch(scratch)
  }
})

test('⑭ 会话模板:凭证整族剔除、账号资料原样、深拷贝(登录本机的重建底稿)', () => {
  const session = {
    ...SESSION,
    userRegion: { region: 'cn', _aiRegion: 'cn' },
    account: { username: 'someone', email: 'a@b.co', phone: '13800000000', avatar_url: 'x' },
  }
  const tpl = T.buildSessionTemplate(session)
  for (const k of ['token', 'refreshToken', 'expiredAt', 'refreshExpiredAt']) {
    assert.equal(k in tpl, false, `${k} 不得进模板(否则密文里躺着可被直接用的票)`)
  }
  for (const k of ['tokenReleaseAt', 'userId', 'host', 'userRegion', 'account']) {
    assert.ok(k in tpl, `${k} 必须保留(重建整份登录态所需)`)
  }
  assert.deepEqual(tpl.account, session.account, '账号资料必须原样(头像/邮箱/组织靠它)')
  assert.equal(JSON.stringify(tpl).includes(session.token), false)
  // 深拷贝:改模板不得回头改上游 userInfo(否则同步回灌会把原件弄脏)
  tpl.account.username = 'tampered'
  assert.equal(session.account.username, 'someone')
  // 非对象输入 ⇒ null(不抛错,调用方据 null 不写键)
  assert.equal(T.buildSessionTemplate(null), null)
  assert.equal(T.buildSessionTemplate([]), null)
  assert.equal(T.buildSessionTemplate('nope'), null)
  // 全链:toPoolAccount 必须带模板,且模板自身不含凭证
  const acct = T.toPoolAccount(session)
  assert.deepEqual(acct.accounts[0].sessionTemplate, T.buildSessionTemplate(session))
  assert.equal('token' in acct.accounts[0].sessionTemplate, false)
  assert.equal('refreshToken' in acct.accounts[0].sessionTemplate, false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
