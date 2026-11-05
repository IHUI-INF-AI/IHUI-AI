// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 会话回灌编排器接线锁(2026-10-28 立)。
 * 判据 import 自生产脚本 `__test__`(§22c);真流程依赖本机 Qoder 客户端与数据库,
 * 测试只锁纯函数与契约形状,不 spawn、不连库。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as S } from '../sync-qoder-client-session.mjs'
import { __test__ as T } from '../sync-trae-client-session.mjs'

test('① 参数面:--dry-run/--json 合法;未知参数 ⇒ 未判定;--help 走帮助', () => {
  assert.equal(S.parseArgs(['--dry-run']).dryRun, true)
  assert.equal(S.parseArgs(['--json']).json, true)
  assert.equal(S.parseArgs(['--bogus']).error, '未知参数: --bogus')
  assert.equal(S.parseArgs(['--help']).help, true)
  // pnpm 透传的裸 `--` 不是参数:pnpm x:foo -- --dry-run 必须照样能跑(AGENTS §0.8)
  assert.equal(S.parseArgs(['--', '--dry-run']).error, null)
  assert.equal(S.parseArgs(['--', '--dry-run']).dryRun, true)
})

test('② 载荷形状:providerCode=qoder,Cosy 设备头族随会话带上', () => {
  const payload = S.buildPayload(
    [
      {
        uid: 'u1',
        accessToken: 'dt-1',
        refreshToken: 'drt-1',
        expiresAt: '2026-11-27T14:43:09Z',
        refreshTokenExpiresAt: '2027-10-23T14:43:09Z',
        deviceId: 'dev-1',
        machineId: 'mid-1',
        machineToken: 'mt-1',
        machineCode: 'mc-1',
        machineType: 'x86_64_windows',
        version: '2.1.0',
        appDir: '/tmp/x',
      },
    ],
    { count: 1 },
  )
  assert.equal(payload.providerCode, 'qoder')
  assert.deepEqual(
    Object.keys(payload.accounts[0]).sort(),
    [
      'deviceId',
      'expiresAt',
      'machineCode',
      'machineId',
      'machineToken',
      'machineType',
      'refreshToken',
      'refreshTokenExpiresAt',
      'token',
      'uid',
      'version',
    ].sort(),
  )
  // accessToken 是捕获字段名,载荷里必须是 token(ts 侧判据吃这个键)
  assert.equal(payload.accounts[0].token, 'dt-1')
  assert.equal('accessToken' in payload.accounts[0], false)
  assert.equal('appDir' in payload.accounts[0], false)
  assert.equal(payload.meta.count, 1)
})

test('③ 缺 uid 或 token 的会话被丢弃(不推无名号/空票)', () => {
  const payload = S.buildPayload([
    { uid: 'u1', accessToken: 'dt-1' },
    { uid: '', accessToken: 'dt-2' },
    { uid: 'u2', accessToken: '' },
    null,
  ])
  assert.equal(payload.accounts.length, 1)
  assert.equal(payload.accounts[0].uid, 'u1')
})

test('④ 空/畸形输入 ⇒ accounts 为空数组而不是炸掉(未判定由调用方兜)', () => {
  assert.deepEqual(S.buildPayload(null).accounts, [])
  assert.deepEqual(S.buildPayload({ sessions: [] }).accounts, [])
  assert.deepEqual(S.buildPayload('nope').accounts, [])
})

test('⑤ 可选字段缺失 ⇒ 载荷不带该键(ts 侧据此保留池内列)', () => {
  const payload = S.buildPayload([{ uid: 'u1', accessToken: 'dt-1' }])
  assert.deepEqual(Object.keys(payload.accounts[0]).sort(), ['token', 'uid'])
})

test('⑥ 身份键族:phone/nickname 在场 ⇒ 载荷带上(missing 自动入池的统一名判据用,2026-10-30)', () => {
  const payload = S.buildPayload([
    { uid: 'u1', accessToken: 'dt-1', phone: ' 13800000000 ', nickname: ' 大帅哥 ' },
  ])
  assert.equal(payload.accounts[0].phone, '13800000000')
  assert.equal(payload.accounts[0].nickname, '大帅哥')
})

test('⑦ phone/nickname 空串/纯空白 ⇒ 不带该键(不拿脏名喂导入判据)', () => {
  const payload = S.buildPayload([{ uid: 'u1', accessToken: 'dt-1', phone: '', nickname: '   ' }])
  assert.equal('phone' in payload.accounts[0], false)
  assert.equal('nickname' in payload.accounts[0], false)
})

test('⑧ 心跳折算必须与 Trae 腿是同一个函数引用(不许在这儿写第二份三态判据,§0.6)', () => {
  assert.equal(S.heartbeatOf, T.heartbeatOf)
})

test('⑨ 载荷只在有心跳时带 clientActiveAt 键(键缺席 = ts 侧本轮不写心跳)', () => {
  const at = '2026-11-05T00:00:00.000Z'
  const s = [{ uid: 'u1', accessToken: 'dt-1' }]
  assert.equal(S.buildPayload(s, {}, at).clientActiveAt, at)
  assert.equal('clientActiveAt' in S.buildPayload(s, {}, null), false)
  assert.equal('clientActiveAt' in S.buildPayload(s, {}), false)
  // 心跳时刻不进 accounts:凭据面与探针面各走各的键
  assert.deepEqual(Object.keys(S.buildPayload(s, {}, at).accounts[0]), ['uid', 'token'])
})

test('⑩ 客户端进程探测三态:关掉进程控制落 false,不得伪装成「在跑」', () => {
  // IHUI_TRAE_PROCESS_CONTROL=0 ⇒ 共用器物返回 [](明确无),不是 null(未知)⇒ 本层必须落 false
  assert.equal(S.probeQoderClientActive({ IHUI_TRAE_PROCESS_CONTROL: '0' }), false)
  // 镜像名清单事实(2026-11-05 本机现读 = Qoder CN.exe;国际版一并探测,免得换版后心跳静默断供)
  assert.deepEqual([...S.QODER_PRODUCTS], ['Qoder CN', 'Qoder'])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
