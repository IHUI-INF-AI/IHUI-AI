// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ReDoS 闸的覆盖面(2026-11-01 安全强化)。
 *
 * 背景:三处"主线程同步编译调用者可控正则"的位置此前只有**长度**闸,而长度拦不住
 * `(a+)+$` 这种 7 字符的病态模式 —— 一枚短 pattern 就能把事件循环钉死(整站停摆)。
 * 仓内早已有一份回溯检测实现 `rules-service.hasNestedQuantifier`(规则编辑面在用),
 * 本文件把它在三处的接线钉住:
 *  - `workspace-ai-service` 的 `/fs/grep`(普通登录用户可调)
 *  - `webhooks-trigger` 的 `regex` 条件(规则作者写 pattern,payload 是外部形状)
 *  - `relay-param-ops` 的 `regex_replace` op
 * 摘掉任意一处的调用,或把它换成端内自造的第二份尺子,本文件即红。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hasNestedQuantifier } from '../src/services/rules-service.js'

const SITES = [
  'src/services/workspace-ai-service.ts',
  'src/routes/webhooks-trigger.ts',
  'src/services/relay-param-ops.ts',
] as const

describe('判据本身', () => {
  it('检出嵌套量词(指数回溯形态)', () => {
    expect(hasNestedQuantifier('(a+)+$')).toBe(true)
    expect(hasNestedQuantifier('(\\d+)*\\s*x')).toBe(true)
  })

  it('正向对照:普通模式不误判(否则等于把正则能力全禁)', () => {
    expect(hasNestedQuantifier('a+')).toBe(false)
    expect(hasNestedQuantifier('^foo|bar$')).toBe(false)
    expect(hasNestedQuantifier('(key|value):\\s*\\S+')).toBe(false)
  })
})

describe('三处调用点都接在同一份实现上', () => {
  it.each(SITES)('%s import 共享判据而不是另造尺子', (file) => {
    const src = readFileSync(file, 'utf-8')
    expect(src, `${file} 未接 hasNestedQuantifier`).toContain('hasNestedQuantifier')
    expect(src).toMatch(/from '\.+(\/services)?\/rules-service\.js'/)
  })

  it('闸排在编译正则之前(排在后面等于摆设)', () => {
    for (const file of SITES) {
      const src = readFileSync(file, 'utf-8')
      const patterns = [
        'new RegExp(params.pattern',
        'new RegExp(String(condition.value)',
        'new RegExp(pattern, flags)',
      ]
      const build = Math.min(...patterns.map((p) => {
        const at = src.indexOf(p)
        return at === -1 ? Number.POSITIVE_INFINITY : at
      }))
      const guard = src.indexOf('hasNestedQuantifier(')
      expect(guard, `${file} 找不到嵌套量词闸`).toBeGreaterThan(0)
      expect(build, `${file} 找不到 new RegExp`).toBeLessThan(Number.POSITIVE_INFINITY)
      expect(guard, `${file}:闸必须排在 new RegExp 之前`).toBeLessThan(build)
    }
  })

  it('rules-service 仍是唯一实现(端内不得复制第二份检测器)', () => {
    for (const file of SITES) {
      const src = readFileSync(file, 'utf-8')
      expect(src, `${file} 里出现了第二份检测实现`).not.toMatch(/function hasNestedQuantifier/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
