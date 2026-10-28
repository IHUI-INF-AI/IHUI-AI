// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 会话回灌判据锁(2026-10-28 立)。
 * 复灌决策本身走 relay-trae-session-sync.ts 的 decideSync(单一判据源,已由其测试覆盖);
 * 本文件只钉 Qoder 专属的 Cosy 设备头合并与 CLI 形状。不连库,不 spawn 真流程。
 */
import { describe, it, expect } from 'vitest'
import { __test__ } from '../scripts/relay-qoder-session-sync.js'

const { buildCosyPatch, parseArgs } = __test__

describe('buildCosyPatch · Cosy 设备头合并', () => {
  it('客户端没给设备头 ⇒ null(不写,保留池内档)', () => {
    expect(buildCosyPatch(null, {})).toBeNull()
    expect(buildCosyPatch({ cosy: { machine_token: 'old' } }, { machineToken: '  ' })).toBeNull()
  })

  it('同值 ⇒ null(幂等,不产生无意义写)', () => {
    expect(
      buildCosyPatch(
        { cosy: { machine_token: 'mt', version: '1.0' } },
        { machineToken: 'mt', version: '1.0' },
      ),
    ).toBeNull()
  })

  it('新值 ⇒ 合并进旧档(旧键一个不丢)', () => {
    expect(
      buildCosyPatch(
        { cosy: { machine_token: 'old', machine_code: 'mc' }, other: 1 },
        { machineToken: 'new', machineType: 'x86_64_windows' },
      ),
    ).toEqual({ machine_token: 'new', machine_code: 'mc', machine_type: 'x86_64_windows' })
  })

  it('池内没有 cosy 档 ⇒ 以本次入参建整档(蛇形键,对齐 adapter 读取口径)', () => {
    expect(buildCosyPatch({}, { machineToken: 'mt', machineCode: 'mc' })).toEqual({
      machine_token: 'mt',
      machine_code: 'mc',
    })
  })

  it('池内 cosy 是坏形状(数组/字符串)⇒ 当作空档重建,不崩', () => {
    expect(buildCosyPatch({ cosy: ['bad'] }, { machineToken: 'mt' })).toEqual({
      machine_token: 'mt',
    })
    expect(buildCosyPatch({ cosy: 'bad' }, { machineToken: 'mt' })).toEqual({
      machine_token: 'mt',
    })
  })
})

describe('CLI 参数面(未判定不猜)', () => {
  it('缺 --stdin ⇒ 报错(凭据必须走标准输入,不落盘)', () => {
    expect(parseArgs([]).error).toContain('--stdin')
  })

  it('未知参数 ⇒ 报错;--stdin/--dry-run/--json 合法', () => {
    expect(parseArgs(['--bogus']).error).toBe('未知参数: --bogus')
    const ok = parseArgs(['--stdin', '--dry-run', '--json'])
    expect(ok.error).toBeNull()
    expect(ok.dryRun).toBe(true)
    expect(ok.json).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
