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
import path from 'node:path'

import { __test__ as S } from '../sync-minimax-client-session.mjs'
import { __test__ as E } from '../lib/minimax-auth-extract.mjs'

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
  assert.deepEqual(E.candidateRoots({ env: { MINIMAX_DATA_DIR: real, USERPROFILE: 'C:/no-such-home' } }), [real])
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
