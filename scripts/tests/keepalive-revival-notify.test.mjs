// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 复活通知判据镜像测试(2026-11-16 立,§22c:判据 import 生产端 __test__,测试零复制)。
 * 钉的是这一族的失效形态(全部是"安静"型):
 *  R1 摘除/down → healthy/未摘 ⇒ 出一枚跃迁,两侧读数随行;
 *  R2 仍在喊人集合 ⇒ 不得算复活(否则告警+复活同轮双发,身份再不同也是自相矛盾);
 *  R3 行从 after 消失(取消登记/出池)⇒ 不算复活 —— 取消登记不是起死回生;
 *  R4 任一侧快照取不到 ⇒ null(未判定),严禁把"缺读数"写成"本轮无复活"(§0.3);
 *  R5 before 本来就不在喊人集合 ⇒ 零枚(不给一直健康的号发"复活"噪音);
 *  R6 身份稳定性:同一行两次调用逐字相等,且与告警身份不同前缀(守门 224:身份里零抖动量)。
 *  R9 重复节奏按终态分层(2026-11-21 立,治"同一枚判死号每天一封"):判死留痕 ⇒ 30 天;
 *     无留痕/留痕坏/旧产物不带此字段 ⇒ 7 天(fail-open 到"多提醒一次",不是跳门)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as keepalive } from '../relay-account-keepalive.mjs'

const { alertTargetsOf, alertIdOf, repeatHoursOf, revivalTransitionsOf, revivalAlertIdOf } =
  keepalive

function row(over = {}) {
  return {
    id: 'row-1',
    providerCode: 'trae',
    uid: '533740363190089',
    name: '151******30',
    isEnabled: true,
    tempUnschedulable: true,
    healthStatus: 'down',
    lastErrorMessage: 'token 刷新失败(3/3)⇒ 已自动摘除',
    credVersion: 5,
    ...over,
  }
}

test('R1 摘除+down → 未摘+healthy ⇒ 复活跃迁一枚,两侧随行', () => {
  const before = [row()]
  const after = [
    row({
      tempUnschedulable: false,
      healthStatus: 'healthy',
      lastErrorMessage: null,
      credVersion: 8,
    }),
  ]
  const got = revivalTransitionsOf(before, after)
  assert.equal(got.length, 1)
  assert.equal(got[0].before.credVersion, 5)
  assert.equal(got[0].after.credVersion, 8)
})

test('R2 两侧都还在喊人集合 ⇒ 不算复活(告警照常,不双发)', () => {
  const before = [row()]
  const after = [row({ lastErrorMessage: '还是 refresh invalid' })]
  assert.deepEqual(revivalTransitionsOf(before, after), [])
  // 反向锁:after 确实在 alertTargetsOf 集合内,否则本用例测的是哑判据
  assert.equal(alertTargetsOf([after[0]]).length, 1)
})

test('R3 行在 after 消失(取消登记/出池)⇒ 不得算复活', () => {
  const before = [row()]
  assert.deepEqual(revivalTransitionsOf(before, []), [])
})

test('R4 任一侧缺快照 ⇒ null 未判定,数组 0 枚是两件事', () => {
  assert.equal(revivalTransitionsOf(null, [row()]), null)
  assert.equal(revivalTransitionsOf([row()], null), null)
  assert.equal(revivalTransitionsOf(undefined, undefined), null)
  // 旧版 ts 产物(无 keepAliveBefore)混跑期:判"未判定",绝不冒充"无复活"
  const legacyOut = { ok: true, keepAlive: [row()] }
  assert.equal(revivalTransitionsOf(legacyOut.keepAliveBefore ?? null, legacyOut.keepAlive), null)
})

test('R5 一直健康的号 ⇒ 零枚,不发"复活"噪音', () => {
  const before = [row({ tempUnschedulable: false, healthStatus: 'healthy' })]
  const after = [row({ tempUnschedulable: false, healthStatus: 'healthy', credVersion: 6 })]
  assert.deepEqual(revivalTransitionsOf(before, after), [])
})

test('R6 复活身份稳定、与告警身份不同前缀、不含抖动量', () => {
  const a = row()
  const b = row({ lastErrorMessage: '另一句错误', credVersion: 99 })
  assert.equal(revivalAlertIdOf(a), revivalAlertIdOf(b), '同一 provider/uid ⇒ 身份必逐字相等')
  assert.ok(revivalAlertIdOf(a).startsWith('relay-keepalive-revival-'))
  assert.notEqual(revivalAlertIdOf(a), alertIdOf(a), '两件事两种修法:身份前缀必须不同')
  assert.equal(/[A-Za-z0-9-]+/.test(revivalAlertIdOf(a)), true)
})

test('R7 商店号(设计性摘除)被排除:7 个应用上架号不再误报保活掉线', () => {
  const STORES = [
    'google-play', 'honor-store', 'huawei-agc', 'oppo-store',
    'vivo-store', 'xiaomi-store', 'yyb-store',
  ]
  const storeRows = STORES.map((p, i) =>
    row({ id: `store-${i}`, providerCode: p, healthStatus: 'unknown', tempUnschedulable: true }),
  )
  const realDown = row({ id: 'codearts-1', providerCode: 'codearts', tempUnschedulable: true, healthStatus: 'down' })
  // 不传排除清单 = 旧口径(向后兼容):商店号仍被算进去
  assert.equal(alertTargetsOf([...storeRows, realDown]).length, 8)
  // 传商店号清单 = 新口径:只剩 codearts 真故障
  const after = alertTargetsOf([...storeRows, realDown], STORES)
  assert.equal(after.length, 1)
  assert.equal(after[0].providerCode, 'codearts')
})

test('R8 复活判据也排除商店号:设计态摘除不产生"复活"噪音', () => {
  const storeBefore = row({ id: 'store-1', providerCode: 'yyb-store', tempUnschedulable: true, healthStatus: 'unknown' })
  const storeAfter = row({ id: 'store-1', providerCode: 'yyb-store', tempUnschedulable: false, healthStatus: 'unknown' })
  // 未排除时它会被当成"复活"
  assert.equal(revivalTransitionsOf([storeBefore], [storeAfter]).length, 1)
  // 排除后无复活通知
  assert.equal(revivalTransitionsOf([storeBefore], [storeAfter], ['yyb-store']).length, 0)
})

test('R9 判死态 30 天、自救态 7 天;留痕缺失/坏掉一律回落自救态', () => {
  const terminal = row({
    terminalVerdict: { id: 'trae-refresh-invalid', credVersion: 87, at: '2026-11-18T09:00:00.000Z' },
  })
  assert.equal(repeatHoursOf(terminal), 720, '判死 = 上游不可逆、永不重试 ⇒ 终态低频')
  // 自救态:有摘除/掉线但没有判死留痕 ⇒ 6h 后会被自动解摘重试
  assert.equal(repeatHoursOf(row({ terminalVerdict: null })), 168)
  assert.equal(repeatHoursOf(row({ terminalVerdict: undefined })), 168)
  // 留痕坏(无 id / id 空 / 不是对象)⇒ fail-open 到"多提醒一次",绝不静默成"终态"
  assert.equal(repeatHoursOf(row({ terminalVerdict: {} })), 168)
  assert.equal(repeatHoursOf(row({ terminalVerdict: { id: '' } })), 168)
  assert.equal(repeatHoursOf(row({ terminalVerdict: 'yes' })), 168)
  // 结构锁:终态窗口必须远长于自救窗口(两者写反就是"判死号按周轰炸")
  assert.ok(repeatHoursOf(terminal) > repeatHoursOf(row({ terminalVerdict: null })))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
