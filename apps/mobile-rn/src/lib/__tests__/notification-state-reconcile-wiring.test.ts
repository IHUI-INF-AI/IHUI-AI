// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 变异锁:RN 重连对账必须在 hook 的 onConnectionState 上真接线。
// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const HOOK = path.resolve(__dirname, '../../hooks/use-user-broadcast-sync.ts')
const ADAPTER = path.resolve(__dirname, '../user-broadcast.ts')

describe('RN 重连对账接线变异锁', () => {
  it('hook 真注入 onConnectionState 并在重连边沿调 reconcileNotificationState', () => {
    const src = readFileSync(HOOK, 'utf8')
    expect(src).toContain('onConnectionState: (state) => {')
    expect(src).toContain("state === 'open' && everConnectedRef.current")
    expect(src).toMatch(/reconcileNotificationState\(\{[\s\S]{0,500}isCancelled/)
    // 反向:抹掉调用后判据不再命中
    const stripped = src.replace('reconcileNotificationState({', 'void ({')
    expect(stripped).not.toMatch(/reconcileNotificationState\(\{[\s\S]{0,500}isCancelled/)
  })

  it('首连不拉对账:只有 reconnect 为真才进入 reconcile', () => {
    const src = readFileSync(HOOK, 'utf8')
    expect(src).toContain('if (!reconnect) return')
    expect(src).toContain("everConnectedRef.current = everConnectedRef.current || state === 'open'")
  })

  it('适配层把共享订阅的 onState 透传到 onConnectionState', () => {
    const src = readFileSync(ADAPTER, 'utf8')
    expect(src).toContain('onState: (state) => deps.onConnectionState?.(state)')
  })

  it('query 走共享 api-client,不自建 HTTP(单一真相源)', () => {
    const src = readFileSync(HOOK, 'utf8')
    expect(src).toContain("queryNotificationStates } from '@ihui/api-client'")
    expect(src).not.toContain("fetch('/api/notifications/state-query'")
  })
})
