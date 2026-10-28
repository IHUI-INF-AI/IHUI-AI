// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 会话回灌判据锁(2026-10-28 立)。
 *
 * 两件事:
 *   ① 判据单源 —— trae/qoder 两条回灌腿必须 import 同一份 decideSync(§0.6),
 *      本文件用"函数引用相等"钉死,复制一份判据会当场红;
 *   ② 取数侧合并 mergeCosy 的形状锁(cosy 蛇形键 = qoder-adapter COSY_HEADERS 读取口径)。
 */
import { describe, it, expect } from 'vitest'
import { __test__ as qoderTest } from '../scripts/relay-qoder-session-sync.js'
import { __test__ as traeTest } from '../scripts/relay-trae-session-sync.js'
import { decideSync, parseIso } from '../src/services/relay-session-sync-decision.js'

const { mergeCosy, parseArgs } = qoderTest

describe('判据单源(§0.6)', () => {
  it('trae 与 qoder 两条回灌腿共用 src/services 的同一枚 decideSync/parseIso', () => {
    expect(traeTest.decideSync).toBe(decideSync)
    expect(qoderTest.decideSync).toBe(decideSync)
    expect(traeTest.parseIso).toBe(parseIso)
    expect(qoderTest.parseIso).toBe(parseIso)
  })

  it('decideSync:同票/池更新/客户端更新 三态', () => {
    const base = {
      poolToken: 'pool',
      poolTokenExpiresAt: new Date('2026-11-27T13:19:32.000Z'),
      poolRefreshExpiresAt: new Date('2027-10-23T13:19:32.000Z'),
      clientToken: 'client',
      clientRefreshToken: 'client-rt',
      clientExpiresAt: new Date('2026-11-28T00:00:00.000Z'),
      clientRefreshExpiresAt: new Date('2027-10-24T00:00:00.000Z'),
    }
    expect(decideSync({ ...base, clientToken: 'pool' }).reason).toBe('same-token')
    expect(
      decideSync({ ...base, clientExpiresAt: new Date('2026-11-26T00:00:00.000Z') }).reason,
    ).toBe('pool-newer')
    expect(decideSync(base).reason).toBe('client-newer')
  })
})

describe('mergeCosy · 设备头合并', () => {
  it('捕获侧一个设备字段都没有 ⇒ 不写 extraMetadata(null)', () => {
    expect(mergeCosy({}, {})).toBeNull()
    expect(mergeCosy(null, { machineToken: '  ' })).toBeNull()
  })

  it('保留既有键,cosy 写蛇形键并同步扁平键(历史行形态)', () => {
    const merged = mergeCosy(
      { cosy: { machine_token: 'old', extra: 'keep' }, phoneMask: { original: '***' } },
      {
        machineToken: 'mt-new',
        machineCode: 'mc-new',
        machineType: 'qoder-cn',
        version: '0.34.0',
      },
    )
    expect(merged).not.toBeNull()
    expect((merged as Record<string, unknown>).phoneMask).toEqual({ original: '***' })
    const cosy = (merged as Record<string, unknown>).cosy as Record<string, unknown>
    expect(cosy.machine_token).toBe('mt-new')
    expect(cosy.machine_code).toBe('mc-new')
    expect(cosy.machine_type).toBe('qoder-cn')
    expect(cosy.version).toBe('0.34.0')
    expect(cosy.extra).toBe('keep')
    expect((merged as Record<string, unknown>).machineToken).toBe('mt-new')
  })
})

describe('parseArgs', () => {
  it('默认无开关;--json/--dry-run/--help 各自识别', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, json: false, help: false, error: null })
    expect(parseArgs(['--json', '--dry-run']).json).toBe(true)
    expect(parseArgs(['--json', '--dry-run']).dryRun).toBe(true)
    expect(parseArgs(['--help']).help).toBe(true)
  })

  it('未知参数 ⇒ error 点名(不退化成静默忽略)', () => {
    expect(parseArgs(['--bogus']).error).toContain('--bogus')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
