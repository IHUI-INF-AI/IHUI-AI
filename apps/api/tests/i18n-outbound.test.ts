// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 台账号 G-815926 — 服务端 IM 出站/通知文案收进 `apiOutbound` 键族后的判据。
 *
 * 三条硬判据:
 *  ① 行为零变化:zh-CN 渲染值与旧源码硬编码**逐字相同**(原样钉死,改一个字都判红);
 *  ② 取词出口:插值参数替换正确、缺键回退 zh-CN、终极回退 = 键名;
 *  ③ 五语言同枚:api/*.json 的 apiOutbound 键集五端逐键一致(parity 门之外的本仓内对照)。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  OUTBOUND_HARD_CUT_MARK,
  applyFoldToOutcome,
  classifyTransportError,
  interpretPlatformResponse,
  outboundFoldNotice,
} from '../src/services/im-outbound-policy.js'
import { t } from '../src/services/i18n-outbound.js'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

function loadApiMessages(locale: string): Record<string, unknown> {
  const file = fileURLToPath(
    new URL(`../../../packages/i18n/messages/api/${locale}.json`, import.meta.url),
  )
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
}

function flattenKeys(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return [prefix]
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k),
  )
}

describe('G-815926 ① 行为零变化:zh-CN 渲染值与旧硬编码逐字相同', () => {
  it('折叠告知模板(旧:im-outbound-policy.ts 源码常量)', () => {
    expect(outboundFoldNotice(3)).toBe('\n\n【内容过长】剩余 3 段因超出单次上限未发送。')
    expect(OUTBOUND_HARD_CUT_MARK).toBe('……（接下一段）')
  })

  it('折叠结论 reason(旧:applyFoldToOutcome 源码模板)', () => {
    const delivered = {
      ok: true,
      status: 'delivered' as const,
      providerMessageId: 'm1',
      retryable: false,
      attempts: 1,
    }
    expect(applyFoldToOutcome(delivered, 2).reason).toBe(
      '内容超出单次段数上限,剩余 2 段未投递(已在末段告知)',
    )
  })

  it('平台结论 reason(旧:interpretPlatformResponse / classifyTransportError 源码模板)', () => {
    expect(interpretPlatformResponse(500, '').reason).toBe('平台返回 HTTP 500')
    expect(interpretPlatformResponse(500, '{"errcode":42}').reason).toBe(
      '平台返回 HTTP 500 code=42',
    )
    expect(interpretPlatformResponse(200, '{"code":4001,"msg":"bad token"}').reason).toBe(
      '平台业务拒绝 code=4001 bad token',
    )
    expect(classifyTransportError(new Error('boom')).reason).toBe('投递异常: boom')
  })
})

describe('G-815926 ② 取词出口 t():插值与回退', () => {
  it('插值参数替换正确(数字与字符串)', () => {
    expect(t('apiOutbound.adapterMissing', { platform: 'feishu' })).toBe('未配置 feishu 适配器')
    expect(t('apiOutbound.circuitOpen', { seconds: 60 })).toContain('60s 后放行一次探测')
    expect(t('apiOutbound.deliveryError', { message: 'x' })).toBe('投递异常: x')
  })

  it('缺键回退 zh-CN:未知 locale 取不到 ⇒ 落回 zh-CN 同键值', () => {
    const expected = '\n\n【内容过长】剩余 1 段因超出单次上限未发送。'
    expect(t('apiOutbound.foldNotice', { count: 1 }, 'xx-XX')).toBe(expected)
    expect(t('apiOutbound.foldNotice', { count: 1 }, 'zh-CN')).toBe(expected)
  })

  it('终极回退 = 键名(文案缺失不得抛错、不得返回 undefined)', () => {
    expect(t('apiOutbound.__noSuchKey__')).toBe('apiOutbound.__noSuchKey__')
    expect(t('apiOutbound.__noSuchKey__', { a: 1 }, 'ja')).toBe('apiOutbound.__noSuchKey__')
  })
})

describe('G-815926 ③ 五语言同枚', () => {
  it('api/*.json 的 apiOutbound 键集五端逐键一致', () => {
    const keySets = LOCALES.map((locale) =>
      flattenKeys(loadApiMessages(locale).apiOutbound).sort(),
    )
    for (const locale of LOCALES.slice(1)) {
      expect(keySets[0]).toEqual(keySets[LOCALES.indexOf(locale)])
    }
    // 防空扫:键族必须有实质内容(枚举到 0 键 = 判据失明)
    expect(keySets[0].length).toBeGreaterThan(50)
  })
})
