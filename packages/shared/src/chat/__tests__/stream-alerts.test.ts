// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D155 告警判据层测试(2026-11-13 立)。
 *
 * 钉的是「一个来路不明的对象要不要上屏」这道闸。四类断言:
 *   ① 三档各自能收,专属字段按表透传;
 *   ② 不该收的一律 null(无 type / 表外 type / 无 message / 空 message / 非对象);
 *   ③ severity 表外回退 warning 而非丢帧(D34/D40 教训);
 *   ④ 去重按主键而非 type(同档多条不能互相挤掉)。
 */

import { describe, expect, it } from 'vitest'

import {
  dedupeStreamAlerts,
  isStreamAlertType,
  readStreamAlert,
  readStreamAlertEvent,
  streamAlertKey,
  STREAM_ALERT_TYPES,
} from '../stream-alerts'

describe('isStreamAlertType', () => {
  it('三档全部认', () => {
    for (const t of STREAM_ALERT_TYPES) expect(isStreamAlertType(t)).toBe(true)
  })

  it('表外值不认', () => {
    for (const t of ['budget', 'config_warning', 'CONFIG-WARNING', '', 'x']) {
      expect(isStreamAlertType(t)).toBe(false)
    }
  })
})

describe('readStreamAlert(收帧判据)', () => {
  it('config-warning 三可选字段全带', () => {
    const rec = readStreamAlert({
      type: 'config-warning',
      severity: 'critical',
      message: 'base URL 被覆盖',
      field: 'baseUrl',
      provider: 'deepseek',
      effectiveValue: 'https://x',
    })
    expect(rec).toEqual({
      type: 'config-warning',
      severity: 'critical',
      message: 'base URL 被覆盖',
      detail: { field: 'baseUrl', provider: 'deepseek', effectiveValue: 'https://x' },
    })
  })

  it('deprecation-notice 专属字段', () => {
    const rec = readStreamAlert({
      type: 'deprecation-notice',
      severity: 'warning',
      message: 'm 将于 7 天后停止服务',
      capability: 'old/model',
      alternative: 'new/model',
      sunsetAt: '2026-11-20',
    })
    expect(rec?.detail).toEqual({
      capability: 'old/model',
      alternative: 'new/model',
      sunsetAt: '2026-11-20',
    })
  })

  it('guardian-warning 专属字段', () => {
    const rec = readStreamAlert({
      type: 'guardian-warning',
      severity: 'warning',
      message: '未复核即放行',
      category: 'guardian_unreviewed',
      reviewId: 'rv-1',
    })
    expect(rec?.detail).toEqual({ category: 'guardian_unreviewed', reviewId: 'rv-1' })
  })

  it('可选字段缺席时 detail 为空对象(不是 undefined)', () => {
    const rec = readStreamAlert({ type: 'config-warning', message: 'x' })
    expect(rec?.detail).toEqual({})
  })

  it('跨档字段不串味:deprecation 帧里的 field 不被收下', () => {
    const rec = readStreamAlert({
      type: 'deprecation-notice',
      message: 'x',
      field: 'baseUrl', // 属 config-warning 的键
    })
    expect(rec?.detail).toEqual({})
  })

  it('空串可选字段不收(避免渲染出空选项)', () => {
    const rec = readStreamAlert({
      type: 'deprecation-notice',
      message: 'x',
      alternative: '',
      capability: 'a/b',
    })
    expect(rec?.detail).toEqual({ capability: 'a/b' })
  })

  it('非串可选字段当缺省(不把数字渲染成文本)', () => {
    const rec = readStreamAlert({ type: 'guardian-warning', message: 'x', reviewId: 42 })
    expect(rec?.detail).toEqual({})
  })

  describe('不收的情形', () => {
    it.each<[unknown, string]>([
      [null, 'null'],
      [undefined, 'undefined'],
      ['str', '字符串'],
      [42, '数字'],
      [[], '数组'],
    ])('%s 不是对象 ⇒ null', (raw) => {
      expect(readStreamAlert(raw)).toBeNull()
    })

    it('无 type ⇒ null', () => {
      expect(readStreamAlert({ message: 'x' })).toBeNull()
    })

    it('表外 type ⇒ null', () => {
      expect(readStreamAlert({ type: 'budget', message: 'x' })).toBeNull()
    })

    it('无 message ⇒ null(只有强度的告警上屏是一行空白)', () => {
      expect(readStreamAlert({ type: 'config-warning', severity: 'info' })).toBeNull()
    })

    it('空 message ⇒ null', () => {
      expect(readStreamAlert({ type: 'config-warning', message: '' })).toBeNull()
    })

    it('非串 message ⇒ null', () => {
      expect(readStreamAlert({ type: 'config-warning', message: 123 })).toBeNull()
    })
  })
})

describe('severity 归一(D34/D40 教训:不丢帧)', () => {
  it.each(['info', 'warning', 'critical'])('表上值原样保留 %s', (sev) => {
    expect(readStreamAlert({ type: 'config-warning', message: 'x', severity: sev })?.severity).toBe(
      sev,
    )
  })

  it.each([[undefined], [null], [''], ['catastrophic'], [1], [{}]])(
    '表外值 %s 回退 warning 而不是丢帧',
    (sev) => {
      const rec = readStreamAlert({ type: 'config-warning', message: 'x', severity: sev })
      expect(rec).not.toBeNull()
      expect(rec?.severity).toBe('warning')
    },
  )
})

describe('readStreamAlertEvent(类型化载荷)', () => {
  it('保留契约元字段', () => {
    const evt = readStreamAlertEvent({
      type: 'deprecation-notice',
      message: 'x',
      capability: 'a/b',
      traceId: 't-1',
      agentId: 'ag-1',
    })
    expect(evt).toMatchObject({ type: 'deprecation-notice', traceId: 't-1', agentId: 'ag-1' })
  })

  it('不把任意键摊到端上(只透传契约元字段)', () => {
    const evt = readStreamAlertEvent({
      type: 'config-warning',
      message: 'x',
      secretToken: 'should-not-pass',
    }) as unknown as Record<string, unknown>
    expect(evt.secretToken).toBeUndefined()
  })

  it('坏帧 ⇒ null(与 readStreamAlert 同源)', () => {
    expect(readStreamAlertEvent({ type: 'config-warning' })).toBeNull()
  })
})

describe('去重', () => {
  const mk = (capability: string) =>
    readStreamAlert({ type: 'deprecation-notice', message: `x-${capability}`, capability })!

  it('同档不同主键全部保留(否则第二条会把第一条挤掉)', () => {
    const list = [mk('a/1'), mk('b/2')]
    expect(dedupeStreamAlerts(list)).toHaveLength(2)
  })

  it('同档同主键只留一条', () => {
    expect(dedupeStreamAlerts([mk('a/1'), mk('a/1')])).toHaveLength(1)
  })

  it('保序:先到的在前', () => {
    const out = dedupeStreamAlerts([mk('a/1'), mk('b/2'), mk('a/1')])
    expect(out.map((r) => r.detail.capability)).toEqual(['a/1', 'b/2'])
  })

  it('主键缺失时退到 message 逐字比', () => {
    const a = readStreamAlert({ type: 'config-warning', message: 'same' })!
    const b = readStreamAlert({ type: 'config-warning', message: 'same' })!
    const c = readStreamAlert({ type: 'config-warning', message: 'other' })!
    expect(dedupeStreamAlerts([a, b, c])).toHaveLength(2)
  })

  it('streamAlertKey 带 type 前缀:不同档永不互相去重', () => {
    const dep = readStreamAlert({ type: 'deprecation-notice', message: 'same' })!
    const cfg = readStreamAlert({ type: 'config-warning', message: 'same' })!
    expect(streamAlertKey(dep)).not.toBe(streamAlertKey(cfg))
    expect(dedupeStreamAlerts([dep, cfg])).toHaveLength(2)
  })
})

describe('不抛异常(SSE 逐帧路径上的硬要求)', () => {
  it.each([
    { type: 'config-warning', message: 'x', field: Symbol('s') },
    { type: 'deprecation-notice', message: 'x', detail: { nested: true } },
    Object.create(null),
  ])('畸形载荷不抛', (raw) => {
    expect(() => readStreamAlert(raw)).not.toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
