// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MiniMax 会话回灌编排器接线锁(2026-10-31 立,第四条腿)。
 * 判据 import 自生产脚本 `__test__`(§22c);真流程依赖本机 mcode 会话与数据库,
 * 测试只锁纯函数与契约形状,不 spawn、不连库、不碰本机客户端。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { __test__ as S } from '../sync-minimax-client-session.mjs'
import { __test__ as E } from '../lib/minimax-auth-extract.mjs'
// 心跳时刻判据与映像名清单的两个真相源(测试直接对账,免得本层测试自成第二份)
import { __test__ as traeSyncTest } from '../sync-trae-client-session.mjs'
import { CLIENT_IMAGES } from '../local-login.mjs'

const RECORD_KEY =
  'com.minimax.mcode.oauth.prod.cn\u0000pn7olbPZk-liTDivJTlyUgyJxgtXvTojk5gKj6qHfMI'

test('① 参数面:--dry-run/--json 合法;未知参数 ⇒ 未判定;--help 走帮助', () => {
  assert.equal(S.parseArgs(['--dry-run']).dryRun, true)
  assert.equal(S.parseArgs(['--json']).json, true)
  assert.equal(S.parseArgs(['--bogus']).error, '未知参数: --bogus')
  assert.equal(S.parseArgs(['--help']).help, true)
  // pnpm 透传的裸 `--` 不是参数(AGENTS §0.8)
  assert.equal(S.parseArgs(['--', '--dry-run']).error, null)
  assert.equal(S.parseArgs(['--', '--dry-run']).dryRun, true)
})

test('② 载荷形状:providerCode=minimax,expiresAtMs 折成 ISO 一并带上', () => {
  const payload = S.buildPayload({
    accounts: [
      {
        accessToken: 'acc-1',
        refreshToken: 'rt-1',
        expiresAtMs: Date.parse('2026-11-30T00:00:00.000Z'),
        tokenType: 'Bearer',
        clientId: 'cid',
        scopes: ['a', 'b'],
        audience: 'aud',
        generation: 405,
        loginEpoch: 'epoch-1',
        region: 'cn',
        recordKey: RECORD_KEY,
        sourceRoot: 'C:/Users/x/.minimax',
        sourcePath: 'C:/Users/x/.minimax/auth/prod/cn/mcode-public/auth.json',
      },
    ],
    meta: { count: 1, skipped: 0, roots: [{ root: 'C:/Users/x/.minimax', authFiles: [] }] },
  })
  assert.equal(payload.providerCode, 'minimax')
  assert.equal(payload.accounts.length, 1)
  const acc = payload.accounts[0]
  assert.deepEqual(
    Object.keys(acc).sort(),
    [
      'accessToken',
      'audience',
      'clientId',
      'expiresAt',
      'expiresAtMs',
      'loginEpoch',
      'recordKey',
      'refreshToken',
      'region',
      'scopes',
      'sourcePath',
      'tokenType',
    ].sort(),
  )
  // ts 侧判据吃 token/accessToken 的任一;本载荷统一用提取器的原生键 accessToken
  assert.equal(acc.accessToken, 'acc-1')
  assert.equal(acc.expiresAt, '2026-11-30T00:00:00.000Z')
  // generation 是无关键,不进载荷;sourceRoot 同理(只要文件路径)
  assert.equal('generation' in acc, false)
  assert.equal('sourceRoot' in acc, false)
  assert.deepEqual(payload.meta, {
    count: 1,
    skipped: 0,
    uid: null,
    uidError: null,
    roots: ['C:/Users/x/.minimax'],
  })
})

test('③ 缺 accessToken 的记录被丢弃(不推空票);双缺记录计数如实带走', () => {
  const payload = S.buildPayload({
    accounts: [
      { accessToken: 'acc-1', recordKey: RECORD_KEY },
      { accessToken: '', refreshToken: 'rt' },
      { refreshToken: 'rt-2' },
      null,
    ],
    meta: { skipped: 2 },
  })
  assert.equal(payload.accounts.length, 1)
  assert.equal(payload.meta.skipped, 2)
})

test('④ 空/畸形输入 ⇒ accounts 为空数组而不是炸掉(未判定由调用方兜)', () => {
  assert.deepEqual(S.buildPayload(null).accounts, [])
  assert.deepEqual(S.buildPayload({ accounts: [] }).accounts, [])
  assert.deepEqual(S.buildPayload('nope').accounts, [])
  assert.deepEqual(S.buildPayload({ accounts: 'nope' }).accounts, [])
})

test('⑤ 可选字段缺失 ⇒ 载荷不带该键(不拿空值覆盖池内档)', () => {
  const payload = S.buildPayload({ accounts: [{ accessToken: 'acc-1' }] })
  assert.deepEqual(Object.keys(payload.accounts[0]), ['accessToken'])
})

test('⑥ 零凭据回显:meta 与记录键短名都不含令牌', () => {
  const payload = S.buildPayload({
    accounts: [
      {
        accessToken: 'SUPER-SECRET-ACCESS',
        refreshToken: 'SUPER-SECRET-REFRESH',
        region: 'cn',
        recordKey: RECORD_KEY,
      },
    ],
    meta: { count: 1, skipped: 0, roots: [{ root: 'C:/Users/x/.minimax' }] },
  })
  const metaText = JSON.stringify(payload.meta)
  assert.equal(metaText.includes('SUPER-SECRET'), false)
  const label = S.recordKeyLabel(RECORD_KEY)
  assert.equal(label, `rk:…${RECORD_KEY.slice(-8)}`)
  assert.equal(label.includes('SUPER-SECRET'), false)
  assert.equal(S.recordKeyLabel('').includes('minimax'), false)
})

test('⑦ 服务身份:MINIMAX_DATA_DIR 直接指定数据根,不再拼 USERPROFILE', () => {
  // 用仓库内真实存在的目录做夹具(候选根必须 existsSync 才留)。判据 = 优先序,
  // 不是"能不能读到本机 .minimax" —— IHUI-API 以 LocalSystem 运行时 USERPROFILE 是
  // systemprofile,回灌腿因此结构上读不到真实用户会话(2026-10-31 现读 MINIMAX_DIR_MISSING)。
  const real = path.resolve('scripts')
  assert.deepEqual(
    E.candidateRoots({ env: { MINIMAX_DATA_DIR: real, USERPROFILE: 'C:/no-such-home' } }),
    [real],
  )
  const viaHome = E.candidateRoots({ env: { USERPROFILE: 'C:/no-such-home' } })
  assert.deepEqual(viaHome, [])
})

test('⑦b scopes 只留非空字符串;全空 ⇒ 不带该键', () => {
  const withScopes = S.buildPayload({
    accounts: [{ accessToken: 'acc', scopes: ['a', '', 3, null] }],
  })
  assert.deepEqual(withScopes.accounts[0].scopes, ['a'])
  const empty = S.buildPayload({ accounts: [{ accessToken: 'acc', scopes: ['', null] }] })
  assert.equal('scopes' in empty.accounts[0], false)
})

// 2026-11-06 切号实测:recordKey 是「本机会话槽名」,池内三枚 minimax 行共用同一个槽名 ⇒
// 无人值守的回灌只能镜像一个槽;人工切号必须由操作者点名目标行,否则新票会落进别人那一行。
test('⑧ --uid= 点名:恰一条会话才把 uid 写进载荷;空值/未知参数 ⇒ 未判定', () => {
  assert.equal(S.parseArgs(['--uid=auto:aaaa']).uid, 'auto:aaaa')
  assert.equal(S.parseArgs([]).uid, '')
  assert.match(S.parseArgs(['--uid=']).error ?? '', /需要一个池内 uid/)
  // 空格形态不是本腿约定 ⇒ 按未知参数拒(不猜下一个 token 是值)
  assert.equal(S.parseArgs(['--uid', 'auto:aaaa']).error, '未知参数: --uid')

  const one = { accessToken: 'acc-1', recordKey: RECORD_KEY }
  const payload = S.buildPayload({ accounts: [one] }, 'auto:aaaa')
  assert.equal(payload.accounts[0].uid, 'auto:aaaa')
  assert.equal(payload.meta.uid, 'auto:aaaa')
  assert.equal(payload.meta.uidError, null)

  // 不点名 ⇒ 载荷不带 uid 键(认行仍走槽名,规则一份都不在这一层写)
  const plain = S.buildPayload({ accounts: [one] })
  assert.equal('uid' in plain.accounts[0], false)
  assert.equal(plain.meta.uid, null)
  assert.equal(plain.meta.uidError, null)
})

test('⑨ 点名而本机不止一条会话 ⇒ 当场拒(认不出这条属于哪一行,绝不猜)', () => {
  const payload = S.buildPayload(
    { accounts: [{ accessToken: 'a', recordKey: RECORD_KEY }, { accessToken: 'b' }] },
    'auto:aaaa',
  )
  assert.equal(
    payload.accounts.some((a) => 'uid' in a),
    false,
  )
  assert.match(payload.meta.uidError, /本机有 2 条会话/)
  assert.match(payload.meta.uidError, /拒不回灌/)
  // 反向牙:零条会话也算「认不出」(不冒绿:点名了却没有可写的会话 = 未判定)
  const zero = S.buildPayload({ accounts: [] }, 'auto:aaaa')
  assert.match(zero.meta.uidError, /本机有 0 条会话/)
})

// 心跳生产腿(2026-11-06 第四条同型腿):mcode 的 rt 是轮换型 ⇒ 客户端在跑时必须让位,
// 而让位判据吃的就是 extraMetadata.clientActiveAt。判据单源在 Trae 腿,本层只产时刻。
test('⑩ 心跳面:时刻只在"客户端在跑或未知"时带上,清单派生自 CLIENT_IMAGES 而非自立', () => {
  const acc = [{ accessToken: 'acc-1', recordKey: RECORD_KEY }]
  const withBeat = S.buildPayload({ accounts: acc }, '', '2026-11-06T00:00:00.000Z')
  assert.equal(withBeat.clientActiveAt, '2026-11-06T00:00:00.000Z')
  // 不带时刻 ⇒ 键都不出现(不带 ≠ false:没证据就不是"客户端没在跑")
  const noBeat = S.buildPayload({ accounts: acc }, '', null)
  assert.equal('clientActiveAt' in noBeat, false)

  // 三态收敛判据单源 = Trae 腿的 heartbeatOf(复制一份就当场翻红,§22c)
  assert.equal(S.heartbeatOf, traeSyncTest.heartbeatOf)
  assert.equal(S.heartbeatOf(false, '2026-11-06T00:00:00.000Z'), null)
  assert.equal(S.heartbeatOf(true, '2026-11-06T00:00:00.000Z'), '2026-11-06T00:00:00.000Z')
  assert.equal(S.heartbeatOf(null, '2026-11-06T00:00:00.000Z'), '2026-11-06T00:00:00.000Z')

  // 映像名清单派生自 local-login 的 CLIENT_IMAGES.minimax(换发行版只改那一处)
  assert.deepEqual([...S.MINIMAX_PRODUCTS], [...CLIENT_IMAGES.minimax])
  assert.ok(S.MINIMAX_PRODUCTS.length > 0, '候选映像名不得为空(空清单 = 心跳恒判不到在跑)')
})

// 2026-11-12 机主定案「退出登录也要永久保活」:旧探测只看进程 ⇒ 退出后进程还活着 ⇒
// 恒让位 ⇒ 池永不接管、票到期即死。合判矩阵 = 进程腿 × 登录态腿,这里锁死接管方向。
test('⑪ 合判矩阵:退出登录(死态)后进程还在也必须 false(池接管续票)', () => {
  // 可续态:在跑 ⇒ true(让位);探测未知 ⇒ null(多让);明确没在跑 ⇒ false(无人轮换,接管)
  assert.equal(S.minimaxClientVerdict(true, { status: 'authenticated', hasRecords: true }), true)
  assert.equal(S.minimaxClientVerdict(null, { status: 'authenticated', hasRecords: true }), null)
  assert.equal(S.minimaxClientVerdict(false, { status: 'authenticated', hasRecords: true }), false)
  assert.equal(S.minimaxClientVerdict(true, { status: 'refreshing', hasRecords: true }), true)

  // 死态(退出登录的各阶段):无论进程在否 ⇒ false —— 这是本次改造的核心格
  for (const status of ['anonymous', 'logging_out', 'logout_pending', 'expired', 'error']) {
    assert.equal(S.minimaxClientVerdict(true, { status, hasRecords: true }), false, status)
    assert.equal(S.minimaxClientVerdict(null, { status, hasRecords: true }), false, status)
    assert.equal(S.minimaxClientVerdict(false, { status, hasRecords: false }), false, status)
  }

  // 登录态无证据:明确没在跑 ⇒ false;在跑但无双全票 ⇒ false;
  // 在跑且有票/全无证据 ⇒ 维持三态原值(宁让位不误接管)
  assert.equal(S.minimaxClientVerdict(false, { status: null, hasRecords: true }), false)
  assert.equal(S.minimaxClientVerdict(true, { status: null, hasRecords: false }), false)
  assert.equal(S.minimaxClientVerdict(true, { status: null, hasRecords: true }), null)
  assert.equal(S.minimaxClientVerdict(null, { status: null, hasRecords: null }), null)
  // 空/畸形状态一律当无证据(不猜)
  assert.equal(S.minimaxClientVerdict(true, { status: '', hasRecords: true }), null)
  assert.equal(S.minimaxClientVerdict(true, { status: 'authenticated', hasRecords: null }), true)
})

test('⑪b probe 接线:进程腿注入与登录态合判走同一纯函数(缺省读本机)', () => {
  // IHUI_TRAE_PROCESS_CONTROL=0 ⇒ listProductPids 恒 [] ⇒ 进程腿「明确没在跑」
  const envOff = { IHUI_TRAE_PROCESS_CONTROL: '0' }
  assert.equal(S.probeMinimaxClientActive(envOff, { status: 'authenticated' }), false)
  assert.equal(S.probeMinimaxClientActive(envOff, { status: 'anonymous' }), false)
  assert.equal(S.probeMinimaxClientActive(envOff, { status: null, hasRecords: null }), false)
})

// 退出后 auth.json 可能被客户端删掉而 auth-state.json 还在 —— 只扫 auth.json 的
// discoverAuthFiles 会把「明确退出」误读成「无证据」,readMinimaxAuthState 必须分扫两文件。
test('⑫ readMinimaxAuthState:state 与 auth 分扫,三态如实,零凭据回显', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcode-auth-state-'))
  try {
    const dir = path.join(tmp, 'auth', 'prod', 'cn', 'mcode-public')
    fs.mkdirSync(dir, { recursive: true })

    // 两文件都无 ⇒ 全无证据
    let r = E.readMinimaxAuthState({ roots: [tmp] })
    assert.deepEqual(r, { status: null, hasRecords: null, stateFiles: [] })

    // auth.json 在但 records 空 ⇒ hasRecords=false(有形状没票)
    fs.writeFileSync(path.join(dir, 'auth.json'), JSON.stringify({ records: {} }))
    r = E.readMinimaxAuthState({ roots: [tmp] })
    assert.equal(r.status, null)
    assert.equal(r.hasRecords, false)

    // 双全记录 ⇒ hasRecords=true;state 死态 ⇒ status 如实
    fs.writeFileSync(
      path.join(dir, 'auth.json'),
      JSON.stringify({ records: { k: { accessToken: 'SECRET-ACC', refreshToken: 'SECRET-RT' } } }),
    )
    fs.writeFileSync(path.join(dir, 'auth-state.json'), JSON.stringify({ status: 'anonymous' }))
    r = E.readMinimaxAuthState({ roots: [tmp] })
    assert.equal(r.status, 'anonymous')
    assert.equal(r.hasRecords, true)
    assert.equal(r.stateFiles.length, 1)
    // 零凭据:结果里绝无令牌明文
    assert.equal(JSON.stringify(r).includes('SECRET'), false)

    // 可续态优先(多区域时任一 authenticated/refreshing 即算)
    fs.writeFileSync(path.join(dir, 'auth-state.json'), JSON.stringify({ status: 'authenticated' }))
    assert.equal(E.readMinimaxAuthState({ roots: [tmp] }).status, 'authenticated')

    // 真实退出形:auth.json 已删、state 还在 ⇒ status 保留、hasRecords 回无证据
    fs.rmSync(path.join(dir, 'auth.json'))
    r = E.readMinimaxAuthState({ roots: [tmp] })
    assert.equal(r.status, 'authenticated')
    assert.equal(r.hasRecords, null)

    // 根不存在(candidateRoots 过滤)⇒ 全无证据,不炸
    assert.deepEqual(E.readMinimaxAuthState({ roots: ['C:/no-such-mcode-root'] }), {
      status: null,
      hasRecords: null,
      stateFiles: [],
    })
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('⑬ 载荷带 clientAuthStatus(缺省不带);非认证 ⇒ 合判 false ⇒ 心跳不带(不写心跳)', () => {
  const acc = [{ accessToken: 'acc-1', recordKey: RECORD_KEY }]
  const withStatus = S.buildPayload({ accounts: acc }, '', null, 'anonymous')
  assert.equal(withStatus.clientAuthStatus, 'anonymous')
  const noStatus = S.buildPayload({ accounts: acc }, '', null, null)
  assert.equal('clientAuthStatus' in noStatus, false)

  // 非认证链锁:死态即使进程在跑 ⇒ 合判 false ⇒ heartbeatOf(false) = null ⇒ 载荷不带
  // clientActiveAt ⇒ ts 侧 touchClientHeartbeat 收 null 不写 ⇒ 30 分钟后 C 档接管
  const verdict = S.minimaxClientVerdict(true, { status: 'anonymous', hasRecords: true })
  assert.equal(verdict, false)
  const beat = S.heartbeatOf(verdict, '2026-11-12T00:00:00.000Z')
  assert.equal(beat, null)
  const payload = S.buildPayload({ accounts: acc }, '', beat, 'anonymous')
  assert.equal('clientActiveAt' in payload, false)
  assert.equal(payload.clientAuthStatus, 'anonymous')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
