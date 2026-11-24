// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * publish-stores.test.mjs — 多商店发布编排器的行为锁(全离线,零真实出网、零真实秘密)
 *
 * 判据一律 import 源脚本的 `__test__`(§22c:禁止在测试里复制判据)。
 * 真出网点只有 `--execute` 档;本文件用注入 fetchImpl / stub run 替身,逐跳断言。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { generateKeyPairSync } from 'node:crypto'
import { join } from 'node:path'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { playServiceKey, signingEnvBridge, STATUS } from '../lib/rn-release-credentials.mjs'
import { __test__ as P } from '../publish-stores.mjs'

const SECRET = 'EXPO-TOKEN-DO-NOT-LEAK-0123456789'
const TEST_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
}).privateKey

const found = (value = null, detail = 'stub found') => ({ status: 'found', detail, value })
const missing = (detail = 'stub missing') => ({ status: 'missing', detail, value: null })
const unjudged = (detail = 'stub unjudged') => ({ status: 'unjudged', detail, value: null })

function makeFacts(over = {}) {
  const base = {
    signing: found({ source: 'file', store: '~/.android/ihui-release.keystore' }),
    play: found({ clientEmail: 'ci@example.com', privateKey: TEST_KEY, projectId: 'p', source: 'env-json' }, 'clientEmail=ci@example.com'),
    packageName: 'zh.ai.sq',
    playTrack: 'alpha',
    playReleaseStatus: 'draft',
    huawei: { status: 'found', detail: 'Connect API 客户端在位', appId: '100000', clientId: 'cid' },
    vendors: {
      xiaomi: found({ email: 'dev@example.com' }),
      oppo: found({ clientId: 'cid' }),
      vivo: found({ accessKey: 'ak' }),
      yyb: found({ userId: 'u' }),
      honor: found({ clientId: 'cid' }),
    },
    yybFirstPublished: true,
    apkpureMail: found({ apiKey: 'k', from: 'f' }, 'RESEND_API_KEY sha8=stub;from=f'),
    apkpureDownloadUrl: 'https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk',
    apkpureContact: 'dev@example.com',
    apkpureNotes: 'stub release notes',
    apkpureBundle: found({ listing: {} }),
    artifacts: {
      apk: { kind: 'apk', path: '/out/app-release.apk', bytes: 1234, source: 'default' },
      aab: { kind: 'aab', path: '/out/app-release.aab', bytes: 2345, source: 'default' },
    },
    version: { versionName: '0.0.19', versionCode: '26110713' },
  }
  return { ...base, ...over }
}

function stubFetch({ commit = 200, token = 200 } = {}) {
  const calls = []
  const fetchImpl = async (url, opts = {}) => {
    calls.push(`${opts.method ?? 'GET'} ${url}`)
    if (url === 'https://oauth2.googleapis.com/token') {
      return token >= 200 && token < 300
        ? { status: token, text: async () => '{"access_token":"ACCESS-TOKEN-DO-NOT-LEAK","expires_in":3600}' }
        : { status: token, text: async () => '{"error":"invalid_grant","error_description":"bad key"}' }
    }
    if (url.endsWith('/edits')) return { status: 200, text: async () => '{"id":"E1"}' }
    if (url.includes('/bundles')) return { status: 200, text: async () => '{"versionCode":26110713}' }
    if (url.includes('/tracks/')) return { status: 200, text: async () => '{"track":"alpha"}' }
    if (url.includes(':commit')) {
      return commit >= 200 && commit < 300
        ? { status: commit, text: async () => '{"id":"E1"}' }
        : { status: commit, text: async () => '{"error":{"message":"commit rejected"}}' }
    }
    if (url.includes('?') || url.endsWith('/E1')) return { status: 204, text: async () => '' }
    throw new Error(`unexpected ${url}`)
  }
  return { fetchImpl, calls }
}

test('P1 八家商店齐备:八家都有执行体;能力档位不并桶', () => {
  assert.deepEqual(P.STORE_IDS, ['google-play', 'apkpure', 'huawei', 'xiaomi', 'oppo', 'vivo', 'yyb', 'honor'])
  const modes = Object.fromEntries(P.STORES.map((s) => [s.id, s.mode]))
  assert.equal(modes['google-play'], 'auto')
  assert.equal(modes.huawei, 'auto')
  assert.equal(modes.apkpure, 'auto')
  for (const id of ['xiaomi', 'oppo', 'vivo', 'yyb']) assert.equal(modes[id], 'auto')
  const cap = Object.fromEntries(P.STORES.map((s) => [s.id, s.capability]))
  assert.equal(cap['google-play'], 'direct')
  for (const id of ['huawei', 'xiaomi', 'oppo', 'vivo', 'yyb']) assert.equal(cap[id], 'upload-verified')
  assert.equal(cap.honor, 'unverified', '荣耀上传/提审正文在登录墙内,不许报 upload-verified')
  assert.equal(cap.apkpure, 'mail-verified', 'APKPure 官方邮件通道已机器直发')
})

test('P2 全绿事实:八家到 ready/scaffold;APKPure 走邮件腿;无人自称已发布', () => {
  const results = P.planStores(makeFacts())
  const by = Object.fromEntries(results.map((r) => [r.id, r]))
  assert.equal(by['google-play'].status, 'ready')
  assert.match(by['google-play'].detail, /track=alpha/, 'Play 轨道口径必须可读')
  assert.match(by['google-play'].detail, /androidpublisher/, 'Play 必须走直连,不再写 EAS')
  assert.ok(!/EAS/.test(by['google-play'].detail), 'EAS 已退出 Play 腿')
  assert.equal(by.huawei.status, 'ready')
  assert.match(by.huawei.detail, /app-submit/, '华为提审段已进链路')
  for (const id of ['xiaomi', 'oppo', 'vivo', 'yyb']) assert.equal(by[id].status, 'ready', `${id} 上传/提审端点已证 ⇒ 应进 ready`)
  assert.equal(by.honor.status, 'scaffold')
  assert.equal(by.apkpure.status, 'ready', 'APKPure 邮件腿材料齐 ⇒ 应进 ready')
  assert.match(by.apkpure.detail, /--send --execute/, 'APKPure 必须走发送腿,不是人工控制台')
  assert.ok(!results.some((r) => r.ok), 'dry-run 阶段任何一家都不许自称已发布')
})

test('P3 缺 Play SA:dry-run 点名 blocked;被点名 required ⇒ exit 1;未点名 ⇒ exit 0', () => {
  const facts = makeFacts({ play: missing('密钥根下无 service_account JSON') })
  const results = P.planStores(facts)
  const g = results.find((r) => r.id === 'google-play')
  assert.equal(g.status, 'blocked')
  assert.match(g.detail, /Play 服务账号/)
  assert.equal(P.foldExit(results, ['google-play'], { execute: false }), 1)
  assert.equal(P.foldExit(results, ['huawei'], { execute: false }), 0, 'Play 缺件不连坐华为')
})
test('P3b 未点名的商店不判红', () => {
  const results = P.planStores(makeFacts())
  assert.equal(P.foldExit(results, ['huawei'], { execute: false }), 0)
  assert.equal(P.foldExit(results, ['google-play'], { execute: false }), 0)
})

test('P4 未判定优先于缺前置;execute 档只把 submitted 算达成,uploaded-partial 仍判 1', () => {
  const results = P.planStores(makeFacts({ play: unjudged('SA 内容形态认不出') }))
  assert.equal(P.foldExit(results, ['google-play'], { execute: false }), 2)
  const hw = { ...P.planStores(makeFacts()).find((r) => r.id === 'huawei'), status: 'uploaded-partial' }
  assert.equal(P.foldExit([hw], ['huawei'], { execute: true }), 1, '上传成功 ≠ 自动发布完成')
  assert.equal(P.foldExit([hw], ['huawei'], { execute: false }), 1, '无论哪档,非达成状态都不许读成绿')
})

test('P5 秘密脱敏:redact 抹掉 token;规划结果整体不含秘密原文', () => {
  assert.equal(P.redact(`boom ${SECRET} boom`, [SECRET]), 'boom *** boom')
  const results = P.planStores(makeFacts())
  assert.ok(!JSON.stringify(results).includes(SECRET), '结论不得携带 EXPO_TOKEN 原文')
  assert.ok(!JSON.stringify(results).includes(TEST_KEY), '结论不得携带私钥原文')
})

test('P6 parseArgv:拼错开关/商店/轨道一律抛错,不静默回落', () => {
  const o = P.parseArgv(['--execute', '--required', 'google-play,huawei', '--json', '--track', 'beta', '--release-status', 'completed'])
  assert.equal(o.execute, true)
  assert.deepEqual(o.required, ['google-play', 'huawei'])
  assert.equal(o.track, 'beta')
  assert.equal(o.releaseStatus, 'completed')
  assert.throws(() => P.parseArgv(['--required', 'google-play,unknown']), /无此商店/)
  assert.throws(() => P.parseArgv(['--nope']), /未知开关/)
  assert.throws(() => P.parseArgv(['--apk']), /缺参数/)
  assert.throws(() => P.parseArgv(['--track', 'prod']), /--track/)
  assert.throws(() => P.parseArgv(['--release-status', 'live']), /--release-status/)
})

test('P7 argv 形态:国内五家同形 --phase all;华为多 app-id;yyb 多首包声明;不再出现 EAS', () => {
  const google = P.STORES.find((s) => s.id === 'google-play')
  assert.equal(google.cli, null, 'Play 走进程内直连,不 spawn 客户端')
  const hw = P.buildStoreArgv(P.STORES.find((s) => s.id === 'huawei'), { file: '/out/a.apk', appId: '100000' })
  assert.deepEqual(hw.slice(0, 5), ['scripts/submit-store-huawei.mjs', '--phase', 'all', '--file', '/out/a.apk'])
  assert.ok(hw.includes('--app-id'))
  const yyb = P.buildStoreArgv(P.STORES.find((s) => s.id === 'yyb'), { file: '/out/a.apk' })
  assert.ok(yyb.includes('--assume-first-published'))
  assert.ok(!hw.some((a) => /eas/i.test(a)), 'EAS 已退出')
})

test('P8 Play 执行腿:直连五跳、私钥不落盘、无 EAS/EXPO_TOKEN、结论不含 access_token', async () => {
  const dir = mkScratch('publish-stores-direct')
  try {
    const aab = join(dir, 'app-release.aab')
    writeFileSync(aab, 'AAB-BYTES', 'utf8')
    const facts = makeFacts({ artifacts: { apk: { kind: 'apk', path: '/out/app-release.apk', bytes: 1234, source: 'default' }, aab: { kind: 'aab', path: aab, bytes: 9, source: 'default' } } })
    const plan = P.planStores(facts)
    const { fetchImpl, calls } = stubFetch()
    const out = await P.executeStores(plan, facts, { fetchImpl, root: dir, run: () => ({ code: 0, out: '', err: '' }) })
    const g = out.find((r) => r.id === 'google-play')
    assert.equal(g.status, 'submitted')
    assert.equal(g.versionCode, '26110713')
    assert.deepEqual(calls.map((c) => c.split(' ')[0]), ['POST', 'POST', 'POST', 'PATCH', 'POST'], 'token→edit→upload→track→commit 五跳(upload 走 POST,PUT 无 handler)')
    assert.ok(calls[2].includes('/bundles?uploadType=media'))
    assert.ok(!JSON.stringify(g).includes('ACCESS-TOKEN-DO-NOT-LEAK'), 'access_token 不得进结论')
    assert.deepEqual(readdirSync(dir), ['app-release.aab'], '直连腿除测试产物外不得写任何文件(含旧 SA 槽位)')
    assert.ok(!existsSync(join(dir, 'credentials', 'google-play-service-account.json')), '旧 SA 槽位不得复活')
  } finally {
    rmScratch(dir)
  }
})

test('P9 Play 执行腿:commit 5xx ⇒ unjudged(不冒充失败/成功),且失败步骤可读', async () => {
  const dir = mkScratch('publish-stores-commit')
  try {
    const aab = join(dir, 'app-release.aab')
    writeFileSync(aab, 'AAB-BYTES', 'utf8')
    const facts = makeFacts({ artifacts: { apk: { kind: 'apk', path: '/out/app-release.apk', bytes: 1234, source: 'default' }, aab: { kind: 'aab', path: aab, bytes: 9, source: 'default' } } })
    const { fetchImpl } = stubFetch({ commit: 503 })
    const out = await P.executeStores(P.planStores(facts), facts, { fetchImpl, root: dir, run: () => ({ code: 0, out: '', err: '' }) })
    const g = out.find((r) => r.id === 'google-play')
    assert.equal(g.status, 'unjudged')
    assert.match(g.detail, /commit/)
    assert.equal(P.foldExit(out, ['google-play'], { execute: true }), 2)
  } finally {
    rmScratch(dir)
  }
})

test('P10 Step Summary:表格可读且不含秘密;版本读数现读产物元数据优先', () => {
  const results = P.planStores(makeFacts())
  const md = P.renderStepSummary({ results, required: ['google-play'], execute: false, version: { versionName: '0.0.19', versionCode: '26110713' }, build: null })
  assert.match(md, /Android 商店发布矩阵/)
  assert.match(md, /26110713/)
  assert.ok(!md.includes(SECRET))
  assert.equal(md.split('\n').filter((l) => l.startsWith('| ')).length, 2 + results.length, '表头 + 分隔行 + 每店一行')

  const dir = mkScratch('publish-stores-version')
  try {
    mkdirSync(join(dir, 'android', 'app', 'build', 'outputs', 'apk', 'release'), { recursive: true })
    writeFileSync(
      join(dir, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'output-metadata.json'),
      JSON.stringify({ elements: [{ versionName: '0.0.20', versionCode: 26110714 }] }),
      'utf8',
    )
    assert.deepEqual(P.readReleaseVersion({ rnDir: dir }), { versionName: '0.0.20', versionCode: '26110714' })
  } finally {
    rmScratch(dir)
  }
})

test('P11 产物覆盖:显式给了不存在的路径 ⇒ 带 missing,不静默回退默认产物', () => {
  const dir = mkScratch('publish-stores-artifacts')
  try {
    const a = P.resolveArtifacts({ dir, apk: join(dir, 'nope.apk'), aab: null })
    assert.equal(a.apk.missing, true)
    assert.equal(a.aab, null)
  } finally {
    rmScratch(dir)
  }
})

test('P12 runBuild 在非 Windows 上是未判定(不假装构建过)', () => {
  const r = P.runBuild({ platform: 'linux' })
  assert.equal(r.ok, false)
  assert.equal(r.status, 'unjudged')
  assert.match(r.detail, /Windows/)
})

test('P13 CI 凭据桥:SA 认 env 原文/坏 JSON 落未判定;签名四键认 ORG_GRADLE_PROJECT_ 前缀', () => {
  const sa = JSON.stringify({ type: 'service_account', private_key: 'K', client_email: 'ci@example.com', project_id: 'p' })
  const ok = playServiceKey({ env: { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: sa }, root: null })
  assert.equal(ok.status, STATUS.FOUND)
  assert.equal(ok.value.source, 'env-json')
  const bad = playServiceKey({ env: { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: '{"type":"other"}' }, root: null })
  assert.equal(bad.status, STATUS.UNJUDGED, '形态认不出 ≠ 无凭据')

  const full = signingEnvBridge({
    env: {
      ORG_GRADLE_PROJECT_IHUI_RELEASE_STORE_FILE: '/tmp/k.keystore',
      ORG_GRADLE_PROJECT_IHUI_RELEASE_STORE_PASSWORD: 'p',
      ORG_GRADLE_PROJECT_IHUI_RELEASE_KEY_ALIAS: 'a',
      ORG_GRADLE_PROJECT_IHUI_RELEASE_KEY_PASSWORD: 'q',
    },
  })
  assert.equal(full.complete, true)
  const half = signingEnvBridge({ env: { IHUI_RELEASE_STORE_FILE: '/tmp/k.keystore' } })
  assert.equal(half.complete, false)
  assert.deepEqual(half.missing, ['IHUI_RELEASE_STORE_PASSWORD', 'IHUI_RELEASE_KEY_ALIAS', 'IHUI_RELEASE_KEY_PASSWORD'])
})

test('P14 执行腿:五家国内 ready 腿逐家 spawn,-phase all 同形;APKPure 走邮件腿;exit 0 记 submitted', async () => {
  const facts = makeFacts()
  const calls = []
  const run = (file, args, opts = {}) => {
    calls.push({ file, args, cwd: opts.cwd })
    return { code: 0, out: '绿', err: '' }
  }
  const out = await P.executeStores(P.planStores(facts), facts, { run, root: '/repo' })
  for (const id of ['huawei', 'xiaomi', 'oppo', 'vivo', 'yyb']) {
    const r = out.find((x) => x.id === id)
    assert.equal(r.status, 'submitted', `${id} 执行 exit=0 ⇒ submitted(仍不等于已上架)`)
  }
  assert.equal(out.find((x) => x.id === 'apkpure').status, 'submitted', 'APKPure 邮件腿 exit=0 ⇒ submitted(以 Resend 回执为准)')
  const domestic = calls.filter((c) => c.args.includes('--phase'))
  assert.equal(domestic.length, 5, '五家国内 ready 腿各 spawn 一次')
  for (const c of domestic) {
    assert.equal(c.file, process.execPath)
    assert.equal(c.args[1], '--phase')
    assert.equal(c.args[2], 'all')
    assert.equal(c.args[4], '/out/app-release.apk')
    assert.ok(c.args.includes('--execute'))
  }
  const yyb = calls.find((c) => /submit-store-yyb/.test(c.args[0]))
  assert.ok(yyb.args.includes('--assume-first-published'), '应用宝必须显式声明首包已上线')

  const mail = calls.filter((c) => /submit-store-apkpure/.test(c.args[0]))
  assert.equal(mail.length, 1, 'APKPure 邮件腿只 spawn 一次')
  assert.ok(mail[0].args.includes('--send') && mail[0].args.includes('--execute'), '邮件腿必须同时带 --send 与 --execute')
  assert.ok(mail[0].args.includes('--url') && mail[0].args.includes(facts.apkpureDownloadUrl), '直链必须显式传给邮件腿')
  assert.equal(mail[0].cwd, '/repo')
})

test('P15 未证端点零调用:荣耀即使凭据齐备也仍是 scaffold,执行阶段不 spawn', async () => {
  const facts = makeFacts()
  const plan = P.planStores(facts)
  assert.equal(plan.find((r) => r.id === 'honor').status, 'scaffold')
  const calls = []
  const out = await P.executeStores(plan, facts, { run: (file, args) => (calls.push(args[0]), { code: 0, out: '', err: '' }) })
  assert.ok(!calls.some((a) => /submit-store-honor/.test(String(a))), '未证端点不许被 spawn')
  assert.equal(out.find((r) => r.id === 'honor').status, 'scaffold')
  assert.equal(out.find((r) => r.id === 'yyb').status, 'submitted')
})

test('P17 APKPure 邮件腿:凭据/直链/材料包任一缺 ⇒ blocked 点名,不越级 submitted', () => {
  const pick = (facts) => P.planStores(facts).find((r) => r.id === 'apkpure')
  const noMail = pick(makeFacts({ apkpureMail: missing('缺 RESEND_API_KEY') }))
  assert.equal(noMail.status, 'blocked')
  assert.match(noMail.detail, /RESEND_API_KEY/)
  const noUrl = pick(makeFacts({ apkpureDownloadUrl: null }))
  assert.equal(noUrl.status, 'blocked')
  assert.match(noUrl.detail, /公网直链/)
  const noBundle = pick(makeFacts({ apkpureBundle: missing('材料包目录不存在') }))
  assert.equal(noBundle.status, 'blocked')
  assert.match(noBundle.detail, /材料包/)
  // 邮件腿的必填内容(联系邮箱/更新说明)缺了也必须在规划期点名,不能等真发送时才发现
  const noContact = pick(makeFacts({ apkpureContact: null }))
  assert.equal(noContact.status, 'blocked')
  assert.match(noContact.detail, /APKPURE_CONTACT/)
  // What's new 官方公开页未列为必填:缺省不阻塞,邮件里省略该行(不编造更新内容)
  const noNotes = pick(makeFacts({ apkpureNotes: null }))
  assert.equal(noNotes.status, 'ready')
  const ok = pick(makeFacts())
  assert.equal(ok.status, 'ready')
  assert.ok(!ok.ok, '规划阶段不得自称已发布')
})

test('P16 Play token 被拒 ⇒ failed;网络不可达 ⇒ unjudged(两档不并桶)', async () => {
  const dir = mkScratch('publish-stores-token')
  const aab = join(dir, 'app-release.aab')
  writeFileSync(aab, 'AAB-BYTES', 'utf8')
  const facts = makeFacts({ artifacts: { apk: { kind: 'apk', path: '/out/app-release.apk', bytes: 1234, source: 'default' }, aab: { kind: 'aab', path: aab, bytes: 9, source: 'default' } } })
  const plan = P.planStores(facts)
  const rejected = await P.executeStores(plan, facts, {
    fetchImpl: async () => ({ status: 401, text: async () => '{"error":"invalid_grant"}' }),
    run: () => ({ code: 0, out: '', err: '' }),
  })
  assert.equal(rejected.find((r) => r.id === 'google-play').status, 'failed')

  const unreachable = await P.executeStores(plan, facts, {
    fetchImpl: async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    },
    run: () => ({ code: 0, out: '', err: '' }),
  })
  const g = unreachable.find((r) => r.id === 'google-play')
  assert.equal(g.status, 'unjudged')
  assert.match(g.detail, /token/)
  rmScratch(dir)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
