// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​​‌​‌‍‍​‌​​​​​‌‍‍​‌​​​‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  BUILTIN_TELEMETRY_PROVIDER_IDS,
  MAX_TRACKED_EVENT_KEYS,
  TELEMETRY_PROVIDER_CUSTOM,
  TELEMETRY_PROVIDER_UNKNOWN,
  createEventKeyDeduper,
  hasReportableProvider,
  logProviderValue,
  projectTelemetryProvider,
  sanitizeModelDimension,
} from './telemetry-provider-scope'

/**
 * 遥测 provider 投影白名单 + 事件 key 去重验收测试(2026-09-30 立,吸收批次 74 票 G-977969)。
 * 锁定验收:自定义命名 provider 不泄漏私有名 / 白名单保留原 id / unknown 独立兜底 /
 * 同 eventKey 二次被吞 / 第 2001 个 key 后最旧被淘汰(FIFO)。
 */

describe('projectTelemetryProvider 投影', () => {
  it('自定义命名 provider 上报只见 custom,不泄漏私有名(id 与模型名都不透传)', () => {
    const projection = projectTelemetryProvider('my-private-provider-4f2a', '我的私有模型 v3')
    expect(projection.providerId).toBe(TELEMETRY_PROVIDER_CUSTOM)
    expect(projection.providerScope).toBe(TELEMETRY_PROVIDER_CUSTOM)
    expect(projection.modelName).toBeUndefined()
    expect(JSON.stringify(projection)).not.toContain('my-private-provider-4f2a')
    expect(JSON.stringify(projection)).not.toContain('我的私有模型')
  })

  it('白名单内的内置 provider 保留稳定 id 与模型名', () => {
    for (const builtin of BUILTIN_TELEMETRY_PROVIDER_IDS) {
      const projection = projectTelemetryProvider(builtin, 'some-model')
      expect(projection.providerId).toBe(builtin)
      expect(projection.providerScope).toBe(builtin)
      expect(projection.modelName).toBe('some-model')
    }
  })

  it('空/空白 provider 落 unknown 独立口径,不并入 custom', () => {
    for (const empty of [undefined, null, '', '   ']) {
      const projection = projectTelemetryProvider(empty, '  some-model  ')
      expect(projection.providerId).toBe(TELEMETRY_PROVIDER_UNKNOWN)
      expect(projection.providerScope).toBe(TELEMETRY_PROVIDER_UNKNOWN)
      // unknown 口径下模型名按自身判据保留(卫生化后)
      expect(projection.modelName).toBe('some-model')
    }
    expect(projectTelemetryProvider('', 'x').providerId).not.toBe(TELEMETRY_PROVIDER_CUSTOM)
  })

  it('unknown 口径下空白模型名不下发(防空串维度)', () => {
    const projection = projectTelemetryProvider('', '   ')
    expect(projection.modelName).toBeUndefined()
  })

  it('provider id 先 trim 再比对白名单', () => {
    const projection = projectTelemetryProvider('  zhipu  ', 'glm-x')
    expect(projection.providerId).toBe('zhipu')
    expect(projection.modelName).toBe('glm-x')
  })
})

describe('上报值与发送闸门分离', () => {
  it('闸门用原始值判断;本地日志保留原值', () => {
    const raw = 'my-private-provider-4f2a'
    // 投影值是 custom,但发送决策由原始 provider 是否存在决定
    expect(hasReportableProvider(raw)).toBe(true)
    expect(hasReportableProvider('   ')).toBe(false)
    expect(hasReportableProvider(null)).toBe(false)
    // 本地日志看到的是原始配置,不是投影
    expect(logProviderValue(raw)).toBe(raw)
    expect(logProviderValue('  zhipu ')).toBe('zhipu')
    expect(logProviderValue(undefined)).toBe('')
    // 投影不影响闸门语义
    expect(projectTelemetryProvider(raw).providerId).toBe(TELEMETRY_PROVIDER_CUSTOM)
    expect(hasReportableProvider(raw)).toBe(true)
  })
})

describe('sanitizeModelDimension', () => {
  it('trim 后空值不下发,非空保留', () => {
    expect(sanitizeModelDimension('  m1  ')).toBe('m1')
    expect(sanitizeModelDimension('   ')).toBeUndefined()
    expect(sanitizeModelDimension(undefined)).toBeUndefined()
    expect(sanitizeModelDimension(null)).toBeUndefined()
  })
})

describe('createEventKeyDeduper 事件 key 去重', () => {
  it('同一 eventKey 二次上报被吞', () => {
    const deduper = createEventKeyDeduper()
    expect(deduper.tryClaim('evt-1')).toBe(true)
    expect(deduper.tryClaim('evt-1')).toBe(false)
    expect(deduper.tryClaim('evt-2')).toBe(true)
    expect(deduper.size()).toBe(2)
  })

  it(`第 ${MAX_TRACKED_EVENT_KEYS + 1} 个 key 后最旧被淘汰(FIFO,非 LRU)`, () => {
    const deduper = createEventKeyDeduper()
    for (let i = 1; i <= MAX_TRACKED_EVENT_KEYS; i += 1) {
      expect(deduper.tryClaim(`key-${i}`)).toBe(true)
    }
    expect(deduper.size()).toBe(MAX_TRACKED_EVENT_KEYS)

    // 第 2001 个进入 → 最旧的 key-1 被淘汰
    expect(deduper.tryClaim('key-2001')).toBe(true)
    expect(deduper.size()).toBe(MAX_TRACKED_EVENT_KEYS)

    // key-2 仍在登记 → 被吞;key-1 已被淘汰 → 可再次上报
    expect(deduper.tryClaim('key-2')).toBe(false)
    expect(deduper.tryClaim('key-1')).toBe(true)
  })

  it('支持小容量注入,便于域内独立去重器', () => {
    const deduper = createEventKeyDeduper(2)
    expect(deduper.tryClaim('a')).toBe(true)
    expect(deduper.tryClaim('b')).toBe(true)
    expect(deduper.tryClaim('c')).toBe(true) // a 被淘汰
    expect(deduper.size()).toBe(2)
    expect(deduper.tryClaim('b')).toBe(false) // b 仍在登记
    expect(deduper.tryClaim('a')).toBe(true) // a 已被淘汰,可再次上报
  })
})
