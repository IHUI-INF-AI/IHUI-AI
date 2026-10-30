// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * workbuddy-login-local 的接线锁(2026-10-28 立)—— 全部离线:
 * 进程面(listMains/close/launch/queryExe)与 inspector 面(readBootstrap)一律注入假实现,
 * 密钥用合成值,落盘走 scratch。绝不碰真客户端 / 真 %LOCALAPPDATA%。
 *   ① 入参面:形状/edition/模板/密封面/凭证/uid 错配逐项点名拒绝
 *   ② 组树面:模板+凭证+expiry → 全密封路径可解回;expiry 单位换算(ms 时刻 + 秒剩余);
 *      路径不可达/非字符串 → template-shape;凭证两路径强制并入密封面
 *   ③ 编排面:关→备份→原子写→自检→拉起;各拒绝码不碰盘;自检失败还原备份;
 *      输出面不回显凭证/密钥明文
 *   ⑤ 冷启动面:没在跑+restartClient ⇒ 拉起→轮询就绪→续跑;拉不起/超时仍 not-running;
 *      多主进程一律 ambiguous;clientWasRunning/coldLaunched 如实回报
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { __test__ as L } from '../workbuddy-login-local.mjs'
import { __test__ as W } from '../lib/workbuddy-auth-extract.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const UID = '7498387516015051794'
const OLD_UID = '340221726063980'
const NOW_MS = 1_780_000_000_000
const SECRET = 'synthetic-at-rest-secret'

const TEMPLATE = {
  auth: {
    uid: UID,
    tokenType: 'Bearer',
    sessionState: 1,
    domain: 'yuanbao.qq.com',
    expiresIn: 86400,
    lastRefreshTime: NOW_MS - 60_000,
  },
  account: { uid: UID, nickname: 'tester', phoneNumber: '13800000000', type: 1 },
  accounts: [{ uid: UID, nickname: 'tester', phoneNumber: '13800000000' }],
}
const SEALED = [
  'auth.accessToken',
  'auth.refreshToken',
  'account.nickname',
  'account.phoneNumber',
  'accounts[0].nickname',
  'accounts[0].phoneNumber',
]
const RAW_PAYLOAD = {
  uid: UID,
  edition: 'workbuddy',
  sessionTemplate: TEMPLATE,
  sealedPaths: SEALED,
  credentials: { accessToken: 'pool-access-token', refreshToken: 'pool-refresh-token' },
  expiry: {
    expiresAt: new Date(NOW_MS + 3_600_000).toISOString(),
    refreshExpiresAt: new Date(NOW_MS + 86_400_000).toISOString(),
  },
  restartClient: true,
}

const keypair = () => W.normalizeAtRestKey(SECRET)

test('① 入参面:形状/edition/模板/密封面/凭证/uid 错配逐项点名拒绝(未判定不写)', () => {
  assert.throws(() => L.normalizePayload(null), (e) => e.code === 'payload-shape')
  assert.throws(() => L.normalizePayload([]), (e) => e.code === 'payload-shape')
  assert.throws(() => L.normalizePayload({ ...RAW_PAYLOAD, uid: '' }), (e) => e.code === 'payload-shape')
  assert.throws(
    () => L.normalizePayload({ ...RAW_PAYLOAD, edition: 'workbuddy-desktop' }),
    (e) => e.code === 'payload-shape',
  )
  assert.throws(
    () => L.normalizePayload({ ...RAW_PAYLOAD, credentials: {} }),
    (e) => e.code === 'payload-shape',
    'accessToken 必填',
  )
  assert.throws(
    () => L.normalizePayload({ ...RAW_PAYLOAD, sessionTemplate: null }),
    (e) => e.code === 'no-template',
  )
  assert.throws(
    () => L.normalizePayload({ ...RAW_PAYLOAD, sealedPaths: [] }),
    (e) => e.code === 'no-sealed-paths',
  )
  assert.throws(
    () => L.normalizePayload({ ...RAW_PAYLOAD, sealedPaths: 'auth.accessToken' }),
    (e) => e.code === 'no-sealed-paths',
  )
  assert.throws(
    () => L.normalizePayload({ ...RAW_PAYLOAD, sealedPaths: ['auth.accessToken', 7] }),
    (e) => e.code === 'no-sealed-paths',
  )
  assert.throws(
    () => L.normalizePayload({ ...RAW_PAYLOAD, sessionTemplate: { ...TEMPLATE, account: { uid: '999' } } }),
    (e) => e.code === 'template-uid-mismatch',
    '模板与账号错配必须拒绝(否则把 A 的资料配 B 的票)',
  )
  assert.throws(
    () => L.normalizePayload({ ...RAW_PAYLOAD, sessionTemplate: { ...TEMPLATE, account: {} } }),
    (e) => e.code === 'template-uid-mismatch',
  )

  const ok = L.normalizePayload({
    ...RAW_PAYLOAD,
    uid: ` ${UID} `,
    expiry: { expiresAt: null, refreshExpiresAt: 'not-a-date' },
  })
  assert.equal(ok.uid, UID, '字符串字段两端空白必须归一')
  assert.equal(ok.expiresAt, '', 'null/非法 ISO 一律归空串')
  assert.equal(ok.restartClient, true)
  assert.equal(L.normalizePayload({ ...RAW_PAYLOAD, restartClient: undefined }).restartClient, false)
  assert.deepEqual(
    L.normalizePayload({ ...RAW_PAYLOAD, sealedPaths: ['account.nickname'] }).sealedPaths,
    ['account.nickname', 'auth.accessToken', 'auth.refreshToken'],
    '凭证两路径必须强制并入密封面(token 绝不明文落盘)',
  )
})

test('② 组树面:凭证/expiry 打补丁 + 全密封路径可解回 + 单位换算(ms 时刻/秒剩余)', () => {
  const { key, keyId } = keypair()
  const payload = L.normalizePayload(RAW_PAYLOAD)
  const tree = L.buildSealedTree(payload, { key, keyId, nowMs: NOW_MS })

  for (const p of SEALED) {
    const segs = p.split(/[.[\]]+/).filter(Boolean)
    let cur = tree
    for (const s of segs) cur = cur[s]
    assert.equal(cur?.$wbEncrypted, 1, `密封路径 ${p} 落盘前必须已是信封`)
  }
  const opened = W.decryptSessionTree(tree, key, keyId)
  assert.equal(opened.auth.accessToken, payload.credentials.accessToken)
  assert.equal(opened.auth.refreshToken, payload.credentials.refreshToken)
  assert.equal(opened.account.uid, UID)
  assert.equal(opened.account.nickname, 'tester', '资料字段重封后必须原样解回')
  assert.equal(opened.accounts[0].phoneNumber, '13800000000')
  assert.equal(opened.auth.tokenType, 'Bearer', '明文骨架不得被组树破坏')

  assert.equal(tree.auth.expiresAt, Date.parse(RAW_PAYLOAD.expiry.expiresAt), 'expiresAt = epoch 毫秒')
  assert.equal(tree.auth.expiresIn, 3600, 'expiresIn = 秒剩余 floor((ms-now)/1000)')
  assert.equal(tree.auth.refreshExpiresAt, Date.parse(RAW_PAYLOAD.expiry.refreshExpiresAt))
  assert.equal(tree.auth.refreshExpiresIn, 86400)
  assert.equal(tree.auth.lastRefreshTime, NOW_MS)
  assert.equal(TEMPLATE.auth.accessToken, undefined, '不得回头修改模板原件')

  // expiry 为空 ⇒ 不写 expiresAt/expiresIn 新值(模板旧值原样保留),lastRefreshTime 仍要刷
  const noExp = L.buildSealedTree(
    L.normalizePayload({ ...RAW_PAYLOAD, expiry: { expiresAt: null, refreshExpiresAt: null } }),
    { key, keyId, nowMs: NOW_MS },
  )
  assert.equal(noExp.auth.expiresAt, undefined)
  assert.equal(noExp.auth.refreshExpiresAt, undefined)
  assert.equal(noExp.auth.expiresIn, 86400, '池内没给到期时刻时保留模板原值,不造新键')
  assert.equal(noExp.auth.lastRefreshTime, NOW_MS)

  // 路径不可达 / 值非字符串 / 模板缺 auth ⇒ template-shape
  assert.throws(
    () => L.buildSealedTree(L.normalizePayload({ ...RAW_PAYLOAD, sealedPaths: ['account.email'] }), { key, keyId, nowMs: NOW_MS }),
    (e) => e.code === 'template-shape',
  )
  assert.throws(
    () => L.buildSealedTree(L.normalizePayload({ ...RAW_PAYLOAD, sealedPaths: ['account.type'] }), { key, keyId, nowMs: NOW_MS }),
    (e) => e.code === 'template-shape',
    '密封路径的值必须是非 string 即拒(数值密封=形状不符)',
  )
  assert.throws(
    () => L.buildSealedTree(L.normalizePayload({ ...RAW_PAYLOAD, sealedPaths: ['accounts[9].nickname'] }), { key, keyId, nowMs: NOW_MS }),
    (e) => e.code === 'template-shape',
  )
  assert.throws(
    () => L.buildSealedTree(L.normalizePayload({ ...RAW_PAYLOAD, sessionTemplate: { account: TEMPLATE.account } }), { key, keyId, nowMs: NOW_MS }),
    (e) => e.code === 'template-shape',
    '模板缺 auth 节点时凭证无处安放 ⇒ 拒',
  )
})

/** 全假进程面:applyLoginWb 的编排测试绝不真动进程/inspector */
const fakeProcs = (overrides = {}) => {
  const calls = []
  const procs = {
    calls,
    listMains: () => [{ pid: 4321, userDataDir: 'C:/Users/tester/.workbuddy/UserData' }],
    readBootstrap: async () => ({ atRestSecretKey: SECRET }),
    queryMainExePath: () => 'G:/workbuddy/WorkBuddy.exe',
    /** 默认给不出 exe ⇒ 冷启动探路立刻失败,既保证"绝不真拉起",也让未注入的旧用例不挂 25s 预算 */
    resolveProductExe: () => '',
    resolveWorkbuddyExeRegistry: () => '',
    closeProduct: (product, o) => {
      calls.push(['close', product, o.waitMs])
      return { wasRunning: true, closed: true, pids: [4321] }
    },
    launchProduct: (exe, o) => {
      calls.push(['launch', exe, o.product])
      return { launched: true, error: '' }
    },
    ...overrides,
  }
  return procs
}

test('③ 编排面:关→备份→原子写→自检→拉起;落盘可解回;输出不回显凭证', async () => {
  const scratch = mkScratch('wb-login-local')
  try {
    const { key, keyId } = keypair()
    const targetFile = path.join(scratch, 'workbuddy-desktop.info')
    const beforeRaw = JSON.stringify({
      auth: { uid: OLD_UID, accessToken: W.sealFieldForTest('old-token', key, keyId) },
      account: { uid: OLD_UID, nickname: 'old-user' },
    })
    fs.writeFileSync(targetFile, beforeRaw)

    const procs = fakeProcs()
    const payload = L.normalizePayload(RAW_PAYLOAD)
    const result = await L.applyLoginWb(payload, { ...procs, authDir: scratch, nowMs: NOW_MS })

    assert.equal(result.ok, true)
    assert.equal(result.uid, UID)
    assert.equal(result.edition, 'workbuddy')
    assert.equal(result.targetFile, targetFile)
    assert.equal(result.replacedUid, OLD_UID, '必须回报替换前的 uid(回滚线索)')
    assert.equal(result.clientWasRunning, true)
    assert.equal(result.clientClosed, true)
    assert.equal(result.clientForced, false)
    assert.equal(result.clientRestarted, true)
    assert.equal(result.clientLaunchError, '')
    assert.equal(result.restartHint, 'WorkBuddy 已自动重启;若未自动打开请手动启动 WorkBuddy')
    assert.deepEqual(procs.calls, [
      ['close', 'WorkBuddy', 20_000],
      ['launch', 'G:/workbuddy/WorkBuddy.exe', 'WorkBuddy'],
    ])
    assert.match(result.backupFile, /workbuddy-desktop\.info\.ihui-login-\d+\.bak$/)
    assert.equal(fs.readFileSync(result.backupFile, 'utf8'), beforeRaw, '备份必须逐字节等于写前')

    const opened = W.decryptSessionTree(JSON.parse(fs.readFileSync(targetFile, 'utf8')), key, keyId)
    assert.equal(opened.auth.accessToken, 'pool-access-token', '落盘的必须是池内新票')
    assert.equal(opened.account.uid, UID)
    const reported = JSON.stringify(result)
    for (const secret of ['pool-access-token', 'pool-refresh-token', 'old-token', SECRET]) {
      assert.equal(reported.includes(secret), false, `回报面不得回显 ${secret === SECRET ? '密钥' : '凭证'}明文`)
    }

    // 拉起失败:写入照旧成功,只记 clientLaunchError(不翻成功)
    const flaky = fakeProcs({ launchProduct: () => ({ launched: false, error: '拒绝访问' }) })
    const manual = await L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), { ...flaky, authDir: scratch, nowMs: NOW_MS })
    assert.equal(manual.ok, true)
    assert.equal(manual.clientRestarted, false)
    assert.equal(manual.clientLaunchError, '拒绝访问')
  } finally {
    rmScratch(scratch)
  }
})

test('③b 编排面:写前拒绝族一律不碰盘不关进程;dry-run 只到内存重封', async () => {
  const scratch = mkScratch('wb-login-local-deny')
  try {
    const targetFile = path.join(scratch, 'workbuddy-desktop.info')
    const beforeRaw = JSON.stringify({ auth: { uid: OLD_UID }, account: { uid: OLD_UID } })
    fs.writeFileSync(targetFile, beforeRaw)

    // 没有主进程 ⇒ not-running(不碰文件)
    await assert.rejects(
      () => L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), { ...fakeProcs({ listMains: () => [] }), authDir: scratch }),
      (e) => e.code === 'not-running' && L.exitCodeFor(e) === 2,
    )
    // 多开 ⇒ ambiguous-process
    await assert.rejects(
      () =>
        L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), {
          ...fakeProcs({ listMains: () => [{ pid: 1, userDataDir: 'C:/a/.workbuddy' }, { pid: 2, userDataDir: 'C:/b/.workbuddy' }] }),
          authDir: scratch,
        }),
      (e) => e.code === 'ambiguous-process' && L.exitCodeFor(e) === 2,
    )
    // 在跑的是国际版、载荷是国内版 ⇒ edition-mismatch
    await assert.rejects(
      () =>
        L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), {
          ...fakeProcs({ listMains: () => [{ pid: 1, userDataDir: 'C:/Users/x/.workbuddy-ai' }] }),
          authDir: scratch,
        }),
      (e) => e.code === 'edition-mismatch' && L.exitCodeFor(e) === 2,
    )
    // 手工 CLI(无 restartClient)遇到在跑的客户端 ⇒ target-locked,不关不写
    const locked = fakeProcs({ closeProduct: () => assert.fail('未授权重启绝不能关客户端') })
    await assert.rejects(
      () =>
        L.applyLoginWb(L.normalizePayload({ ...RAW_PAYLOAD, restartClient: false }), {
          ...locked,
          authDir: scratch,
          nowMs: NOW_MS,
        }),
      (e) => e.code === 'target-locked' && L.exitCodeFor(e) === 2,
    )
    assert.equal(fs.readFileSync(targetFile, 'utf8'), beforeRaw, '写前拒绝不得碰盘')

    // 目标文件不存在、另一 edition 文件存在 ⇒ edition-mismatch(提示换 edition)
    fs.rmSync(targetFile)
    fs.writeFileSync(path.join(scratch, 'workbuddy-desktop-ai.info'), '{}')
    await assert.rejects(
      () => L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), { ...fakeProcs(), authDir: scratch }),
      (e) => e.code === 'edition-mismatch',
    )

    // dry-run:组树+重封+内存自检都做完,但不关进程、不写盘
    fs.rmSync(path.join(scratch, 'workbuddy-desktop-ai.info'))
    const dry = fakeProcs({ closeProduct: () => assert.fail('dry-run 绝不能关客户端') })
    const result = await L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), {
      ...dry,
      authDir: scratch,
      nowMs: NOW_MS,
      dryRun: true,
    })
    assert.equal(result.ok, true)
    assert.equal(result.dryRun, true)
    assert.equal(result.targetFile, targetFile)
    assert.equal(result.backupFile, '')
    assert.equal(fs.existsSync(targetFile), false, 'dry-run 不得造出目标文件')
    assert.deepEqual(dry.calls, [])
  } finally {
    rmScratch(scratch)
  }
})

test('③c 编排面:关不掉不写;自检失败还原备份仍拉回客户端;无现役文件写新号', async () => {
  const scratch = mkScratch('wb-login-local-verify')
  try {
    const { key, keyId } = keypair()
    const targetFile = path.join(scratch, 'workbuddy-desktop.info')
    const beforeRaw = JSON.stringify({ auth: { uid: OLD_UID }, account: { uid: OLD_UID } })
    fs.writeFileSync(targetFile, beforeRaw)

    // 强杀都没退 ⇒ target-locked,不写不拉(它本来就还在跑)
    await assert.rejects(
      () =>
        L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), {
          ...fakeProcs({
            closeProduct: () => ({ wasRunning: true, closed: false, pids: [4321], forced: true }),
            launchProduct: () => assert.fail('没关成就不能拉起'),
          }),
          authDir: scratch,
          nowMs: NOW_MS,
        }),
      (e) => e.code === 'target-locked' && L.exitCodeFor(e) === 2,
    )
    assert.equal(fs.readFileSync(targetFile, 'utf8'), beforeRaw)

    // 写后自检解不回 ⇒ 还原备份、退出码 1、客户端仍被拉回(第 1 次 decrypt=内存自检,第 2 次=写后自检)
    let n = 0
    const corrupt = fakeProcs({
      decryptSessionTree: (tree, k, kid) => {
        n += 1
        return n === 1 ? W.decryptSessionTree(tree, k, kid) : {}
      },
    })
    await assert.rejects(
      () => L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), { ...corrupt, authDir: scratch, nowMs: NOW_MS }),
      (e) => e.code === 'write-verify' && L.exitCodeFor(e) === 1,
    )
    assert.equal(fs.readFileSync(targetFile, 'utf8'), beforeRaw, '自检失败必须还原备份')
    assert.deepEqual(corrupt.calls.map((c) => c[0]), ['close', 'launch'], '写失败也要把用户客户端拉回来')

    // 现役文件不存在(本机从没登录过)⇒ 允许写新文件,backupFile 记空
    fs.rmSync(targetFile)
    const fresh = await L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), {
      ...fakeProcs(),
      authDir: scratch,
      nowMs: NOW_MS,
    })
    assert.equal(fresh.ok, true)
    assert.equal(fresh.backupFile, '')
    assert.equal(fresh.replacedUid, null)
    const opened = W.decryptSessionTree(JSON.parse(fs.readFileSync(targetFile, 'utf8')), key, keyId)
    assert.equal(opened.auth.accessToken, 'pool-access-token')
    assert.equal(opened.account.uid, UID)
  } finally {
    rmScratch(scratch)
  }
})

test('④ 参数面与退出码面:必须 --stdin;--dry-run 可解析;未判定=2 写失败=1', () => {
  assert.equal(L.parseArgs(['--stdin']).error, null)
  assert.equal(L.parseArgs(['--stdin', '--json', '--dry-run']).dryRun, true)
  assert.match(L.parseArgs([]).error ?? '', /--stdin/)
  assert.equal(L.parseArgs(['--help']).help, true)
  assert.match(L.parseArgs(['--stdin', '--bogus']).error ?? '', /未知参数/)

  assert.equal(L.exitCodeFor(new L.WriteError('x', 'not-running')), 2)
  assert.equal(L.exitCodeFor(new L.WriteError('x', 'template-shape')), 2)
  assert.equal(L.exitCodeFor(new L.WriteError('x', 'write-verify')), 1)
  assert.equal(L.exitCodeFor(new L.WriteError('x')), 1)
  assert.equal(L.exitCodeFor({ name: 'ExtractError', code: 'inspector-attach' }), 2, '取密钥失败=未判定')
})

test('⑤a 冷启动面:没在跑+授权重启 ⇒ 拉起→轮询就绪→续跑原流程;clientWasRunning=false/coldLaunched=true', async () => {
  const scratch = mkScratch('wb-login-local-cold')
  try {
    const { key, keyId } = keypair()
    const targetFile = path.join(scratch, 'workbuddy-desktop.info')
    let probes = 0
    let bootstrapReads = 0
    const launchOpts = []
    const cold = fakeProcs({
      listMains: () => {
        probes += 1
        return probes === 1 ? [] : [{ pid: 9999, userDataDir: 'C:/Users/tester/.workbuddy/UserData' }]
      },
      readBootstrap: async () => {
        bootstrapReads += 1
        return { atRestSecretKey: SECRET }
      },
      resolveProductExe: () => 'G:/workbuddy/WorkBuddy.exe',
      launchProduct: (exe, o) => {
        cold.calls.push(['launch', exe, o.product])
        launchOpts.push(o)
        return { launched: true, error: '' }
      },
    })
    const result = await L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), {
      ...cold,
      authDir: scratch,
      nowMs: NOW_MS,
      coldLaunchBudgetMs: 2_000,
      coldLaunchPollMs: 10,
    })
    assert.equal(result.ok, true)
    assert.equal(result.clientWasRunning, false, '进入时没在跑 ⇒ 如实回报')
    assert.equal(result.coldLaunched, true, '本次是脚本自己冷启动拉起的')
    assert.equal(result.clientClosed, true)
    assert.equal(result.clientRestarted, true)
    assert.equal(bootstrapReads, 1, '冷启动轮询拿到的 bootstrap 必须复用,不得二次开 inspector')
    assert.equal(launchOpts.length, 2, '冷启动拉起一次 + finally 重开一次')
    assert.deepEqual(
      [launchOpts[0].product, typeof launchOpts[0].helperPath, launchOpts[0].verifyWaitMs > 0],
      ['WorkBuddy', 'string', true],
      '冷启动拉起要带产品名/换身份 helper/就绪校验等待',
    )
    assert.deepEqual(cold.calls, [
      ['launch', 'G:/workbuddy/WorkBuddy.exe', 'WorkBuddy'],
      ['close', 'WorkBuddy', 20_000],
      ['launch', 'G:/workbuddy/WorkBuddy.exe', 'WorkBuddy'],
    ], '冷启动 → 关 → 写 → finally 拉回')

    const opened = W.decryptSessionTree(JSON.parse(fs.readFileSync(targetFile, 'utf8')), key, keyId)
    assert.equal(opened.auth.accessToken, 'pool-access-token', '冷启动续跑后落盘的必须是池内新票')
    assert.equal(opened.account.uid, UID)
    const reported = JSON.stringify(result)
    for (const secret of ['pool-access-token', 'pool-refresh-token', SECRET]) {
      assert.equal(reported.includes(secret), false, '回报面不得回显凭证/密钥明文')
    }
  } finally {
    rmScratch(scratch)
  }
})

test('⑤d 冷启动面:标准安装根找不到 exe ⇒ 注册表卸载项 DisplayIcon 兜底接管冷启动', async () => {
  const scratch = mkScratch('wb-login-local-cold-reg')
  try {
    const launches = []
    let probes = 0
    const cold = fakeProcs({
      listMains: () => {
        probes += 1
        return probes === 1 ? [] : [{ pid: 9999, userDataDir: 'C:/Users/tester/.workbuddy/UserData' }]
      },
      resolveProductExe: () => '',
      resolveWorkbuddyExeRegistry: () => 'G:/workbuddy/WorkBuddy.exe',
      launchProduct: (exe, o) => {
        launches.push(exe)
        cold.calls.push(['launch', exe, o.product])
        return { launched: true, error: '' }
      },
    })
    const result = await L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), {
      ...cold,
      authDir: scratch,
      nowMs: NOW_MS,
      coldLaunchBudgetMs: 2_000,
      coldLaunchPollMs: 10,
    })
    assert.equal(result.ok, true)
    assert.equal(result.coldLaunched, true)
    assert.ok(launches.length > 0 && launches.every((e) => e === 'G:/workbuddy/WorkBuddy.exe'), '注册表兜底后所有拉起都走该路径')
  } finally {
    rmScratch(scratch)
  }
})

test('⑤b 冷启动面:拉不起/超时未就绪 ⇒ 仍 not-running(退出码 2)话术指手动打开;不碰盘不关进程', async () => {
  const scratch = mkScratch('wb-login-local-cold-fail')
  try {
    const targetFile = path.join(scratch, 'workbuddy-desktop.info')
    const beforeRaw = JSON.stringify({ auth: { uid: OLD_UID }, account: { uid: OLD_UID } })
    fs.writeFileSync(targetFile, beforeRaw)

    // 找不到 exe ⇒ 连拉起都不发起
    const noExe = fakeProcs({ listMains: () => [] })
    await assert.rejects(
      () => L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), { ...noExe, authDir: scratch, nowMs: NOW_MS }),
      (e) =>
        e.code === 'not-running' &&
        L.exitCodeFor(e) === 2 &&
        /自动拉起 WorkBuddy 失败.*请手动打开 WorkBuddy 后重试/.test(e.message),
    )
    assert.deepEqual(noExe.calls, [], 'exe 都找不到时绝不能盲拉起')

    // 拉起命令本身失败 ⇒ not-running,带上失败原因
    const refused = fakeProcs({
      listMains: () => [],
      resolveProductExe: () => 'G:/workbuddy/WorkBuddy.exe',
      launchProduct: (exe, o) => {
        refused.calls.push(['launch', exe, o.product])
        return { launched: false, error: '拒绝访问' }
      },
    })
    await assert.rejects(
      () => L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), { ...refused, authDir: scratch, nowMs: NOW_MS }),
      (e) => e.code === 'not-running' && L.exitCodeFor(e) === 2 && /拒绝访问/.test(e.message),
    )
    assert.deepEqual(refused.calls, [['launch', 'G:/workbuddy/WorkBuddy.exe', 'WorkBuddy']], '没起效就不轮询不再拉')

    // 起了但主进程始终不出现 ⇒ 预算内轮询超时后 not-running
    const never = fakeProcs({
      listMains: () => [],
      resolveProductExe: () => 'G:/workbuddy/WorkBuddy.exe',
    })
    await assert.rejects(
      () =>
        L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), {
          ...never,
          authDir: scratch,
          nowMs: NOW_MS,
          coldLaunchBudgetMs: 60,
          coldLaunchPollMs: 10,
        }),
      (e) => e.code === 'not-running' && L.exitCodeFor(e) === 2 && /未就绪/.test(e.message),
    )

    // 手工 CLI(restartClient:false)⇒ 不冷启动,维持原"请先启动"话术
    const manual = fakeProcs({ listMains: () => [] })
    await assert.rejects(
      () =>
        L.applyLoginWb(L.normalizePayload({ ...RAW_PAYLOAD, restartClient: false }), {
          ...manual,
          authDir: scratch,
          nowMs: NOW_MS,
        }),
      (e) => e.code === 'not-running' && /请先启动 WorkBuddy/.test(e.message),
    )
    assert.deepEqual(manual.calls, [], '未授权重启绝不冷启动')
    assert.equal(fs.readFileSync(targetFile, 'utf8'), beforeRaw, '冷启动失败一律不得碰盘')
  } finally {
    rmScratch(scratch)
  }
})

test('⑤c 冷启动面:多主进程仍 ambiguous —— 进入时多开不拉起;冷启动后冒出多个照样拒', async () => {
  const scratch = mkScratch('wb-login-local-cold-amb')
  try {
    const targetFile = path.join(scratch, 'workbuddy-desktop.info')
    const twoMains = [
      { pid: 1, userDataDir: 'C:/a/.workbuddy' },
      { pid: 2, userDataDir: 'C:/b/.workbuddy' },
    ]
    // 进入时就多开 ⇒ ambiguous,压根不该走冷启动
    const amb = fakeProcs({ listMains: () => twoMains })
    await assert.rejects(
      () => L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), { ...amb, authDir: scratch, nowMs: NOW_MS }),
      (e) => e.code === 'ambiguous-process' && L.exitCodeFor(e) === 2,
    )
    assert.deepEqual(amb.calls, [], '进入时已多开绝不能拉起')

    // 冷启动轮询拉出两个主进程 ⇒ 同样 ambiguous,不写盘
    let probes = 0
    const ambCold = fakeProcs({
      listMains: () => {
        probes += 1
        return probes === 1 ? [] : twoMains
      },
      resolveProductExe: () => 'G:/workbuddy/WorkBuddy.exe',
    })
    await assert.rejects(
      () =>
        L.applyLoginWb(L.normalizePayload(RAW_PAYLOAD), {
          ...ambCold,
          authDir: scratch,
          nowMs: NOW_MS,
          coldLaunchBudgetMs: 2_000,
        }),
      (e) => e.code === 'ambiguous-process' && L.exitCodeFor(e) === 2,
    )
    assert.equal(fs.existsSync(targetFile), false, 'ambiguous 不得碰盘')
  } finally {
    rmScratch(scratch)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
