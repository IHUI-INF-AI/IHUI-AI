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
  const dirs = T.traeUserDataDirs({ APPDATA: 'C:/Base/AppData', IHUI_TRAE_DIR: 'D:/Custom/Trae' })
  assert.equal(dirs[0], path.resolve('D:/Custom/Trae'))
  assert.ok(dirs.some((d) => d === path.resolve('C:/Base/AppData/Trae CN')))
  const fallback = T.traeUserDataDirs({ APPDATA: 'C:/Base/AppData' })
  assert.equal(fallback[0], path.resolve('C:/Base/AppData/Trae CN'))
  assert.ok(
    fallback.every((d) => path.isAbsolute(d)),
    '候选必须全是绝对路径',
  )
})

test('⑧ 编排器参数面:--from trae 已装车,未知来源仍算未判定', () => {
  assert.deepEqual(Pool.parseArgs(['--from', 'trae']).error, null)
  assert.deepEqual(Pool.parseArgs(['--from', 'trae', '--dry-run']).options.from, 'trae')
  assert.match(Pool.parseArgs(['--from', 'codearts']).error ?? '', /暂不支持/)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
