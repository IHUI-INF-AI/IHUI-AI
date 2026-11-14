// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mcp-status-projection 单元测试 — J3:复现 WorkBuddy projectMcpServerStatus 状态机。
 *
 * 覆盖 6 条状态机分支 + 2 条超越项(actionRequired / consecutiveFailures 透传):
 *   dead → failed/checkConfig
 *   !alive → starting/retryLater
 *   alive∧!connected → starting/retryLater
 *   connected∧notLoggedIn → authenticationRequired/loginRequired
 *   connected∧bearerToken → connected/none
 *   connected∧auth 缺省(unknown) → connected/none(不臆断需登录)
 */

import { describe, it, expect } from 'vitest'
import { projectMcpServerStatus } from '../src/acp/mcp-status-projection.js'

describe('projectMcpServerStatus 状态机(对齐 WorkBuddy)', () => {
  it('dead → failed + checkConfig', () => {
    const p = projectMcpServerStatus('srv', {
      alive: false, dead: true, connected: false, consecutiveFailures: 5,
    })
    expect(p.runtimeStatus).toBe('failed')
    expect(p.actionRequired).toBe('checkConfig')
    expect(p.authStatus).toBe('unknown')
  })

  it('!alive(未死,退避重连中) → starting + retryLater', () => {
    const p = projectMcpServerStatus('srv', {
      alive: false, dead: false, connected: false, consecutiveFailures: 2,
    })
    expect(p.runtimeStatus).toBe('starting')
    expect(p.actionRequired).toBe('retryLater')
  })

  it('alive 但 !connected → starting + retryLater', () => {
    const p = projectMcpServerStatus('srv', {
      alive: true, dead: false, connected: false, consecutiveFailures: 0,
    })
    expect(p.runtimeStatus).toBe('starting')
    expect(p.actionRequired).toBe('retryLater')
  })

  it('connected ∧ notLoggedIn → authenticationRequired + loginRequired', () => {
    const p = projectMcpServerStatus('srv', {
      alive: true, dead: false, connected: true, consecutiveFailures: 0,
      authStatus: 'notLoggedIn',
    })
    expect(p.runtimeStatus).toBe('authenticationRequired')
    expect(p.actionRequired).toBe('loginRequired')
  })

  it('connected ∧ bearerToken → connected + none', () => {
    const p = projectMcpServerStatus('srv', {
      alive: true, dead: false, connected: true, consecutiveFailures: 0,
      authStatus: 'bearerToken',
    })
    expect(p.runtimeStatus).toBe('connected')
    expect(p.actionRequired).toBe('none')
  })

  it('connected ∧ auth 缺省(unknown) → connected(不臆断需登录)', () => {
    const p = projectMcpServerStatus('srv', {
      alive: true, dead: false, connected: true, consecutiveFailures: 0,
    })
    expect(p.runtimeStatus).toBe('connected')
    expect(p.authStatus).toBe('unknown')
    expect(p.actionRequired).toBe('none')
  })

  it('超越项:consecutiveFailures 透传进投影(可解释)', () => {
    const p = projectMcpServerStatus('srv', {
      alive: false, dead: true, connected: false, consecutiveFailures: 7,
    })
    expect(p.consecutiveFailures).toBe(7)
    expect(p.detail).toContain('7')
  })

  it('serverName 原样透传', () => {
    const p = projectMcpServerStatus('my-mcp', {
      alive: true, dead: false, connected: true, consecutiveFailures: 0,
    })
    expect(p.serverName).toBe('my-mcp')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
