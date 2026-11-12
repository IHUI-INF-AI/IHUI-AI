// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-037 回归钉:遥测默认关闭 + session_start 载荷不含绝对工作区路径。
 *
 * 覆盖:
 *   1. DEFAULT_SETTINGS.telemetry.enabled 为 false(默认不初始化、不上报)
 *   2. buildSessionStartTelemetryProps 只输出 sha256 摘要,不出现用户名/项目名
 *   3. 摘要稳定:同一路径同值、不同路径不同值
 *   4. 显式开启遥测时,真正 flush 出去的请求体同样不含绝对路径
 */
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETTINGS } from '../src/config/defaults.js'
import { buildSessionStartTelemetryProps } from '../src/commands/agent.js'
import { TelemetryClient } from '../src/telemetry/index.js'

const WINDOWS_PATH = 'C:\\Users\\alice\\secret-project'
const POSIX_PATH = '/home/alice/secret-project'

describe('F-037 默认配置遥测关闭', () => {
  it('DEFAULT_SETTINGS.telemetry.enabled 为 false', () => {
    expect(DEFAULT_SETTINGS.telemetry).toBeDefined()
    expect(DEFAULT_SETTINGS.telemetry?.enabled).toBe(false)
  })
})

describe('F-037 session_start 载荷不含绝对路径', () => {
  it('Windows 绝对路径只以 sha256 摘要出现', () => {
    const props = buildSessionStartTelemetryProps(WINDOWS_PATH, 'gpt-x', true)
    const json = JSON.stringify(props)

    expect(props.workspacePath).toBeUndefined()
    expect(json).not.toContain('alice')
    expect(json).not.toContain('secret-project')
    expect(json).not.toContain('Users')
    expect(json).not.toContain(WINDOWS_PATH)
    expect(String(props.workspaceDigest)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('POSIX 绝对路径只以 sha256 摘要出现', () => {
    const props = buildSessionStartTelemetryProps(POSIX_PATH, 'gpt-x', false)
    const json = JSON.stringify(props)

    expect(json).not.toContain('alice')
    expect(json).not.toContain('secret-project')
    expect(json).not.toContain(POSIX_PATH)
  })

  it('摘要稳定:同一路径同值、不同路径不同值', () => {
    const a = buildSessionStartTelemetryProps(WINDOWS_PATH, 'm', true)
    const b = buildSessionStartTelemetryProps(WINDOWS_PATH, 'm', true)
    const c = buildSessionStartTelemetryProps(POSIX_PATH, 'm', true)

    expect(a.workspaceDigest).toBe(b.workspaceDigest)
    expect(a.workspaceDigest).not.toBe(c.workspaceDigest)
    expect(a.workspaceDigest).toBe(
      createHash('sha256').update(WINDOWS_PATH).digest('hex'),
    )
  })

  it('显式开启遥测时,flush 出去的请求体不含绝对路径', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)
    const client = new TelemetryClient({
      enabled: true,
      endpoint: 'https://telemetry.test/ingest',
      fetchImpl,
      setIntervalImpl: () => 0,
      clearIntervalImpl: () => undefined,
    })

    client.trackEvent(
      'session_start',
      buildSessionStartTelemetryProps(WINDOWS_PATH, 'gpt-x', true),
    )
    await client.flush()

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit
    const body = String(init.body)

    expect(body).toContain('workspaceDigest')
    expect(body).not.toContain('alice')
    expect(body).not.toContain('secret-project')
    expect(body).not.toContain('Users')
    expect(body).not.toContain('workspacePath')

    await client.shutdown()
  })
})
