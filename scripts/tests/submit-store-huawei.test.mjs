// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * submit-store-huawei.test.mjs — 华为 Connect API 客户端的行为锁(全离线,零真实出网)
 *
 * 判据一律 import 源脚本的 `__test__`(§22c:禁止在测试里复制判据)。
 * 网络由 stub fetch 替身承担;`main()` 不在射程内(它是唯一出网点,默认档还是 dry-run)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { createVerify, generateKeyPairSync, constants as cryptoConstants } from 'node:crypto'
import { join } from 'node:path'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as H } from '../submit-store-huawei.mjs'

const SECRET = 'CLIENT-SECRET-DO-NOT-LEAK-0123456789'

function stubFetch(responses) {
  const calls = []
  const impl = async (url, opts = {}) => {
    const body = typeof opts.body === 'string' ? opts.body : Buffer.isBuffer(opts.body) ? `<binary ${opts.body.length}B>` : opts.body === null || opts.body === undefined ? '' : String(opts.body)
    calls.push({ url, method: opts.method ?? 'GET', headers: opts.headers ?? {}, body })
    const r = responses.find((x) => x.match(url, opts.method ?? 'GET')) ?? { status: 200, text: '{}' }
    return { status: r.status, text: async () => r.text }
  }
  return { impl, calls }
}

test('H1 凭据件三形态:connect-api / hms-legacy / none 必须分得开', () => {
  const connect = H.parseCredentialText(`client_id：1234567890\nclient_secret:${SECRET}\n应用ID:98765`)
  assert.equal(connect.kind, 'connect-api')
  assert.equal(connect.clientId, '1234567890')
  assert.equal(connect.appId, '98765')
  const legacy = H.parseCredentialText(`应用ID:100000\n密钥:${SECRET}`)
  assert.equal(legacy.kind, 'hms-legacy', 'Y-3 现场:能签 HMS token 的那一枚不是 Connect API 客户端')
  assert.equal(H.parseCredentialText('乱七八糟一行').kind, 'none')
})

test('H2 resolveCredentials:env 优先且脱敏;文件只有 HMS 枚 ⇒ MISSING 并点名缺哪一枚', () => {
  const env = H.resolveCredentials({ env: { HUAWEI_CONNECT_CLIENT_ID: 'cid', HUAWEI_CONNECT_CLIENT_SECRET: SECRET, HUAWEI_CONNECT_APP_ID: 'aid' } })
  assert.equal(env.status, 'found')
  assert.ok(!env.detail.includes(SECRET), '结论不得含凭据原文')
  assert.ok(env.detail.includes('sha8='), '只能出指纹')
  const dir = mkScratch('hw-cred')
  try {
    writeFileSync(join(dir, '华为appid 密钥.txt'), `应用ID:100000\n密钥:${SECRET}`, 'utf8')
    const legacy = H.resolveCredentials({ root: dir, env: {} })
    assert.equal(legacy.status, 'missing')
    assert.match(legacy.detail, /服务账号凭证|API客户端凭证/, '出路必须点名 AGC 服务账号凭证或 API 客户端凭证')
    assert.equal(legacy.value, null, '类型不对时不得把凭据递下去')
    assert.ok(!JSON.stringify(legacy).includes(SECRET), '脱敏:整条结论不含原文')
    const dir2 = mkScratch('hw-cred2')
    writeFileSync(join(dir2, '华为connect.txt'), `client_id:555\nclient_secret:${SECRET}`, 'utf8')
    const ok = H.resolveCredentials({ root: dir2, env: {} })
    assert.equal(ok.status, 'found')
    assert.equal(ok.value.clientSecret, SECRET, '值只在 value 里走,不进 detail')
    rmScratch(dir2)
  } finally {
    rmScratch(dir)
  }
})

test('H3 buildPaths:端点形态逐字钉住(404 是路径错,不是对方拒绝)', () => {
  const P = H.buildPaths({ clientId: 'cid-1' })
  assert.equal(P.token, 'https://connect-api.cloud.huawei.com/api/oauth2/v1/token')
  assert.equal(P.appInfo('100000'), 'https://connect-api.cloud.huawei.com/api/publish/v2/app-info?appId=100000')
  assert.match(P.uploadUrl({ appId: '1', fileName: 'a.apk', contentLength: '2048' }), /upload-url\/for-obs\?appId=1&fileName=a\.apk&contentLength=2048&releaseType=1$/)
  assert.deepEqual(P.authHeaders('tok'), { Authorization: 'Bearer tok', client_id: 'cid-1' })
  assert.equal(H.ENDPOINTS.submit.verified, true, '提交发布端点已核实才允许有路径')
  assert.equal(H.ENDPOINTS.submit.path, '/api/publish/v2/app-submit', '提交发布路径必须逐字钉住')
})

test('H4 classifyRet:0/205524993/HTML/5xx 四态不并桶', () => {
  assert.equal(H.classifyRet(200, '{"ret":{"code":0,"msg":"success"}}').status, 'found')
  const wrong = H.classifyRet(200, '{"ret":{"code":205524993,"msg":"client token auth failed"}}')
  assert.equal(wrong.status, 'missing')
  assert.equal(wrong.verdict, 'endpoint-ok-wrong-credential-type', '通道可达 ≠ 凭据可用(Y-3 ① 的实测分界)')
  assert.equal(H.classifyRet(404, '<html>404</html>').verdict, 'non-json-response')
  assert.equal(H.classifyRet(404, '<html>404</html>').status, 'unjudged', '非 JSON 一律未判定,绝不读成对方拒绝')
  assert.equal(H.classifyRet(500, '{"ret":{"code":1,"msg":"boom"}}').status, 'unjudged')
})

test('H5 status 段行为:先 token 后 app-info,头带 Bearer+client_id,releaseState 读回来', async () => {
  const { impl, calls } = stubFetch([
    { match: (u) => /oauth2\/v1\/token$/.test(u), status: 200, text: '{"access_token":"AT","expires_in":3600}' },
    { match: (u) => /publish\/v2\/app-info/.test(u), status: 200, text: '{"ret":{"code":0},"appInfo":{"releaseState":4,"appGalleryAppInfo":{"packageName":"zh.ai.sq"}}}' },
    { match: (u) => /brief-info\/list/.test(u), status: 200, text: '{"ret":{"code":0},"versionList":[{"versionId":"1","state":0}]}' },
  ])
  const r = await H.phaseStatus({ fetchImpl: impl, creds: { clientId: 'cid', clientSecret: 'sec' }, appId: '100000' })
  assert.equal(r.status, 'found')
  assert.equal(r.releaseState, 4)
  assert.equal(r.versionCount, 1)
  assert.equal(calls.length, 3, '三段:token/app-info/versionList')
  assert.match(calls[0].body, /grant_type":"client_credentials/)
  assert.equal(calls[1].headers.Authorization, 'Bearer AT')
  assert.equal(calls[1].headers.client_id, 'cid')
})

test('H6 token 被拒 ⇒ 只发一次请求就收口,不拿假 token 继续打', async () => {
  const { impl, calls } = stubFetch([{ match: (u) => /token$/.test(u), status: 200, text: '{"ret":{"code":203890688,"msg":"client id or secret error"}}' }])
  const r = await H.phaseStatus({ fetchImpl: impl, creds: { clientId: 'cid', clientSecret: 'sec' }, appId: '100000' })
  assert.equal(r.status, 'missing')
  assert.equal(calls.length, 1, '拒了还继续打 = 把凭据类型问题洗成端点问题')
  assert.equal(r.token, null, 'token 未成立时不得把 token 递下去')
})

test('H7 上传申报单:MD5/字节数算得出;0 字节 MISSING;取不到 UNJUDGED', () => {
  const dir = mkScratch('hw-art')
  try {
    writeFileSync(join(dir, 'app-release.apk'), Buffer.alloc(2048, 7))
    const ok = H.planUpload({ filePath: join(dir, 'app-release.apk') })
    assert.equal(ok.status, 'found')
    assert.equal(ok.plan.contentLength, '2048')
    assert.match(ok.plan.fileMd5, /^[0-9a-f]{32}$/)
    writeFileSync(join(dir, 'empty.apk'), Buffer.alloc(0))
    assert.equal(H.planUpload({ filePath: join(dir, 'empty.apk') }).status, 'missing')
    assert.equal(H.planUpload({ filePath: join(dir, 'nope.apk') }).status, 'unjudged', '取不到 ⇒ 未判定,不冒充"没有产物"')
  } finally {
    rmScratch(dir)
  }
})

test('H8 upload 段行为:取预签名地址 → PUT 文件流 → 回执 objectId', async () => {
  const dir = mkScratch('hw-up')
  try {
    writeFileSync(join(dir, 'a.apk'), Buffer.alloc(1024, 3))
    const plan = H.planUpload({ filePath: join(dir, 'a.apk') }).plan
    const { impl, calls } = stubFetch([
      { match: (u, _m) => /token$/.test(u), status: 200, text: '{"access_token":"AT"}' },
      { match: (u) => /upload-url\/for-obs/.test(u), status: 200, text: '{"ret":{"code":0},"uploadUrl":"https://obs.example/put?sig=1","uploadHeaders":{"x-obs":"h"}}' },
      { match: (u, m) => m === 'PUT', status: 200, text: '{"ret":{"code":0},"objectId":"OBJ-9"}' },
    ])
    const r = await H.phaseUpload({ fetchImpl: impl, creds: { clientId: 'cid', clientSecret: 'sec' }, appId: '100000', plan, filePath: join(dir, 'a.apk') })
    assert.equal(r.objectId, 'OBJ-9')
    assert.equal(r.fileMd5, plan.fileMd5, 'MD5 必须随回执带走,verify 段要比对它')
    assert.equal(calls.length, 3)
    assert.equal(calls[2].method, 'PUT')
    assert.equal(calls[2].headers['x-obs'], 'h', 'OBS 预签名头必须原样透传')
    assert.match(calls[2].body, /binary 1024B/)
  } finally {
    rmScratch(dir)
  }
})

test('H14 for-obs 真实回体形态 urlInfo{objectId,url,method,headers}:空体 2xx PUT 也认受理;缺 url 仍 no-upload-url', async () => {
  const dir = mkScratch('hw-up-inf')
  try {
    writeFileSync(join(dir, 'a.apk'), Buffer.alloc(512, 5))
    const plan = H.planUpload({ filePath: join(dir, 'a.apk') }).plan
    const { impl, calls } = stubFetch([
      { match: (u) => /token$/.test(u), status: 200, text: '{"access_token":"AT"}' },
      { match: (u) => /upload-url\/for-obs/.test(u), status: 200, text: '{"ret":{"code":0,"msg":"success"},"urlInfo":{"objectId":"CN/OBJ-1.apk","url":"https://obs.example/put?sig=2","method":"PUT","headers":{"Authorization":"AWS4-HMAC-SHA256 X","Content-Type":"application/octet-stream"}}}' },
      { match: (u, m) => m === 'PUT', status: 200, text: '' },
    ])
    const r = await H.phaseUpload({ fetchImpl: impl, creds: { clientId: 'cid', clientSecret: 'sec' }, appId: '100000', plan, filePath: join(dir, 'a.apk') })
    assert.equal(r.objectId, 'CN/OBJ-1.apk', 'objectId 必须从 urlInfo 取回')
    assert.equal(r.status, 'found', 'OBS 空体 2xx PUT 不得读成未判定')
    assert.equal(r.verdict, 'obs-put-accepted')
    assert.equal(calls[2].headers.Authorization, 'AWS4-HMAC-SHA256 X', '预签名头必须原样透传')
    assert.equal(
      Object.keys(calls[2].headers).filter((k) => k.toLowerCase() === 'content-type').length,
      1,
      '不得再叠第二个 Content-Type(urlInfo 的签名头原样使用,重复头会 SignatureDoesNotMatch)',
    )
    const { impl: impl2 } = stubFetch([
      { match: (u) => /token$/.test(u), status: 200, text: '{"access_token":"AT"}' },
      { match: (u) => /upload-url\/for-obs/.test(u), status: 200, text: '{"ret":{"code":0},"urlInfo":{"objectId":"X"}}' },
    ])
    const r2 = await H.phaseUpload({ fetchImpl: impl2, creds: { clientId: 'cid', clientSecret: 'sec' }, appId: '100000', plan, filePath: join(dir, 'a.apk') })
    assert.equal(r2.verdict, 'no-upload-url', '缺 url 不得冒充上传成功')
    assert.equal(r2.objectId, null)
  } finally {
    rmScratch(dir)
  }
})

test('H9 verify 段:四格齐才绿;缺格点名;MD5 不一致 MISSING', () => {
  const plan = { fileName: 'a.apk', contentLength: '1024', fileMd5: 'm1' }
  const up = { status: 'found', objectId: 'OBJ', fileMd5: 'm1' }
  const st = { status: 'found', releaseState: 4 }
  assert.equal(H.mergeVerify({ plan, upload: up, status: st }).status, 'missing', '缺提审回执不得报 found')
  assert.equal(H.mergeVerify({ plan, upload: up, status: st }).submit, 'not-submitted', '校验段缺提审回执必须点名')
  assert.equal(H.mergeVerify({ plan, upload: up, status: st, submit: { status: 'found', detail: 'ok' } }).status, 'found')
  assert.deepEqual(H.mergeVerify({ plan, upload: { status: 'unjudged' }, status: null }).gaps, ['上传回执(objectId)', '回读 releaseState'])
  assert.equal(H.mergeVerify({ plan, upload: { status: 'found', objectId: 'O', fileMd5: 'other' }, status: st }).status, 'missing')
})

test('H10 登记腿 argv:store=huawei 恒在,dry-run 不带 --apply', () => {
  const a = H.buildRegisterArgv({ version: '0.0.9', buildNumber: 26102816, downloadUrl: 'https://x/a.apk', apply: false })
  assert.match(a.join(' '), /--platform android --store huawei/)
  assert.ok(!a.includes('--apply'))
  assert.match(H.buildRegisterArgv({ version: '1', apply: true }).join(' '), /--apply$/)
})

test('H11 parseArgs 与 dry-run:未知参数抛错、phase 白名单、默认档零调用', () => {
  assert.throws(() => H.parseArgs(['--nope']), /未知参数/)
  assert.throws(() => H.parseArgs(['--phase', 'nope']), /status\|upload\|submit\|verify\|all/)
  let touched = 0
  const orig = globalThis.fetch
  globalThis.fetch = async () => {
    touched++
    throw new Error('不该出网')
  }
  try {
    const d = H.dryRunPlan({ args: { phase: 'status', appId: '1' }, creds: { status: 'missing', detail: 'x', value: null }, plan: null })
    assert.equal(d.calls.length, 5)
    assert.match(d.calls[1], /app-info\?appId=1$/)
    assert.match(d.calls[4], /app-submit\?appId=1&releaseType=1/)
    assert.match(d.calls[4], /不等于已上架/, 'dry-run 必须带提审边界,不得读成已上架')
  } finally {
    globalThis.fetch = orig
  }
  assert.equal(touched, 0, 'dry-run 结构上不发请求')
})

test('H12 服务账号 JSON 三态:齐字段 service-account;缺字段/非 JSON none', () => {
  const sa = H.parseServiceAccountJson(JSON.stringify({ key_id: 'kid-1', private_key: 'PEM', sub_account: '100000001', token_uri: 'https://oauth-login.cloud.huawei.com/oauth2/v3/token' }))
  assert.equal(sa.kind, 'service-account')
  assert.equal(sa.keyId, 'kid-1')
  assert.equal(sa.subAccount, '100000001')
  assert.equal(H.parseServiceAccountJson('{"key_id":"k"}').kind, 'none', '缺 private_key/sub_account 不得冒充服务账号')
  assert.equal(H.parseServiceAccountJson('client_id:1').kind, 'none', '文本凭据不得被 JSON 解析器截走')
})

test('H13 服务账号优先于 HMS 文本件;JWT 为 PS256 且签名可验', () => {
  const kp = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = kp.privateKey.export({ type: 'pkcs8', format: 'pem' })
  const dir = mkScratch('hw-sa')
  try {
    writeFileSync(join(dir, '华为appid 密钥.txt'), `应用ID:100000\n密钥:${SECRET}`, 'utf8')
    writeFileSync(join(dir, '华为服务账号.json'), JSON.stringify({ key_id: 'kid-1', private_key: pem, sub_account: '100000001' }), 'utf8')
    const r = H.resolveCredentials({ root: dir, env: {} })
    assert.equal(r.status, 'found')
    assert.equal(r.value.kind, 'service-account', '同目录有服务账号件时不得退回 HMS 文本件')
    assert.ok(!r.detail.includes(SECRET), '脱敏:不得含 HMS 原文')
    assert.ok(!r.detail.includes('PRIVATE KEY'), '脱敏:不得含私钥原文')
    const jwt = H.buildServiceAccountJwt(r.value, { now: 1700000000 })
    const [h, p, s] = jwt.split('.')
    const header = JSON.parse(Buffer.from(h, 'base64url'))
    const payload = JSON.parse(Buffer.from(p, 'base64url'))
    assert.equal(header.alg, 'PS256')
    assert.equal(header.kid, 'kid-1')
    assert.equal(payload.iss, '100000001')
    assert.equal(payload.exp, 1700003600)
    assert.equal(createVerify('sha256').update(`${h}.${p}`).verify({ key: kp.publicKey, padding: cryptoConstants.RSA_PKCS1_PSS_PADDING, saltLength: cryptoConstants.RSA_PSS_SALTLEN_DIGEST }, Buffer.from(s, 'base64url')), true)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
