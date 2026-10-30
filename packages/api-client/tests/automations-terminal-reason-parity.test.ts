// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { AUTOMATION_TERMINAL_REASONS, type UserAutomation } from '../src/endpoints/automations.js'

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../../..')

/** snake_case 枚举值 → i18n camelCase 键名的映射(与 UI 取键口径一致) */
function camelOf(reason: string): string {
  return reason.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

describe('G-241 终态封闭集与三列的读侧契约', () => {
  it('api-client 镜像与 database schema 源真相逐字一致(防漂移成对锁)', () => {
    const schemaSrc = readFileSync(
      path.join(repoRoot, 'packages/database/src/schema/user-automations.ts'),
      'utf8',
    )
    const m = schemaSrc.match(/export const AUTOMATION_TERMINAL_REASONS = \[([\s\S]*?)\] as const/)
    expect(m, 'schema 源真相里的 AUTOMATION_TERMINAL_REASONS 数组应可解析').not.toBeNull()
    const authoritative = [...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1])
    expect(authoritative.length).toBeGreaterThan(0)
    expect([...AUTOMATION_TERMINAL_REASONS].sort()).toEqual([...authoritative].sort())
  })

  it('UserAutomation 契约必须透出三列(claimToken/claimedAt/terminalReason)', () => {
    // 编译期面:类型级断言——三列缺任一枚,下面这两行赋值即 tsc 报错
    const probe: Pick<UserAutomation, 'claimToken' | 'claimedAt' | 'terminalReason'> = {
      claimToken: null,
      claimedAt: null,
      terminalReason: 'manual_pause',
    }
    expect(probe.claimToken).toBeNull()
    // 运行期面:接口文本对照(类型会被 tsc 抹掉,文本锁防"字段被悄悄删掉而镜像测试仍绿")
    const src = readFileSync(
      path.join(repoRoot, 'packages/api-client/src/endpoints/automations.ts'),
      'utf8',
    )
    const iface = src.match(/export interface UserAutomation \{[\s\S]*?\n\}/)
    expect(iface, 'UserAutomation 接口应存在').not.toBeNull()
    for (const field of ['claimToken', 'claimedAt', 'terminalReason']) {
      expect(iface![0], `UserAutomation 缺少字段 ${field}`).toContain(`${field}:`)
    }
    expect(iface![0]).toContain('claimToken: string | null')
    expect(iface![0]).toContain('claimedAt: string | null')
    expect(iface![0]).toContain('terminalReason: AutomationTerminalReason | null')
  })

  it('终态文案五语言×两消费面(web/mobile-rn)同批齐备且逐档非空', () => {
    for (const scope of ['web', 'mobile-rn']) {
      for (const lang of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']) {
        const file = path.join(repoRoot, `packages/i18n/messages/${scope}/${lang}.json`)
        const json = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
        const block = (json as { automations?: { terminalReason?: Record<string, unknown> } })
          .automations?.terminalReason
        expect(block, `${scope}/${lang}.json 缺 automations.terminalReason`).toBeTypeOf('object')
        for (const reason of AUTOMATION_TERMINAL_REASONS) {
          const value = block![camelOf(reason)]
          expect(typeof value, `${scope}/${lang} 缺终态键 ${camelOf(reason)}`).toBe('string')
          expect(
            (value as string).length,
            `${scope}/${lang} 终态键 ${camelOf(reason)} 为空`,
          ).toBeGreaterThan(0)
        }
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
