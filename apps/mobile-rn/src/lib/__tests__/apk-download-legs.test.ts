// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * APK 下载腿判据取证(2026-11-04 立)。
 *
 * 成对给夹具是刻意的:每一档「允许走国内腿」的条件都必须同时给出「摘掉该条件即退回主腿」
 * 的反例。否则判据可以被人整颗关掉而测试全绿 —— 本仓最高频的失效型(门恒绿两大成因之一)。
 */
import { describe, expect, it } from 'vitest'

import {
  APK_CN_LEG_URL,
  APK_MIN_BYTES,
  APK_PROBE_BYTES,
  DEFAULT_LEG_PROBE_TIMEOUT_MS,
  buildLegCandidates,
  isAllowedLegUrl,
  parseProbeTotal,
  pickLeg,
  resolveApkDownloadUrl,
  type LegProbe,
  type LegProbeTransport,
} from '../apk-download-legs'

const SITE = 'https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk'
const TOTAL = 84915649

function probe(over: Partial<LegProbe> = {}): LegProbe {
  return {
    id: 'site',
    url: SITE,
    status: 206,
    totalBytes: TOTAL,
    receivedBytes: APK_PROBE_BYTES,
    elapsedMs: 5000,
    error: null,
    ...over,
  }
}
function cnProbe(over: Partial<LegProbe> = {}): LegProbe {
  return probe({ id: 'cn', url: APK_CN_LEG_URL, elapsedMs: 300, ...over })
}

describe('允许域(字面量白名单,不许拼变量)', () => {
  it.each([
    SITE,
    APK_CN_LEG_URL,
    'https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/x/ihui-ai-latest.apk',
    'https://objects.githubusercontent.com/x',
  ])('%s ⇒ 放行', (u) => expect(isAllowedLegUrl(u)).toBe(true))

  it.each([
    'http://www.aizhs.top/remote-images/download/ihui-ai-latest.apk',
    'https://evil.com/ihui-ai-latest.apk',
    'https://www.aizhs.top.evil.com/ihui-ai-latest.apk',
    'file:///sdcard/ihui-ai-latest.apk',
    '',
    'not a url',
  ])('%s ⇒ 拒绝', (u) => expect(isAllowedLegUrl(u)).toBe(false))
})

describe('候选腿', () => {
  it('主腿恒在第一位,国内腿追加', () => {
    expect(buildLegCandidates(SITE)).toEqual([
      { id: 'site', url: SITE },
      { id: 'cn', url: APK_CN_LEG_URL },
    ])
  })
  it('主腿就是国内腿时不重复追加', () => {
    expect(buildLegCandidates(APK_CN_LEG_URL)).toEqual([{ id: 'cn', url: APK_CN_LEG_URL }])
  })
  it('主腿非法 ⇒ 空清单(连主腿都不替它猜)', () => {
    expect(buildLegCandidates('https://evil.com/x.apk')).toEqual([])
  })
})

describe('Content-Range 总长', () => {
  it(`bytes 0-${APK_PROBE_BYTES - 1}/${TOTAL} ⇒ ${TOTAL}`, () => {
    expect(parseProbeTotal(`bytes 0-${APK_PROBE_BYTES - 1}/${TOTAL}`)).toBe(TOTAL)
  })
  it.each([null, '', 'bytes 0-1/*', 'bytes 0-1/0', 'bytes 0-1/not-a-number'])(
    '%s ⇒ null,不许拿 Content-Length 猜',
    (v) => expect(parseProbeTotal(v)).toBeNull(),
  )
})

describe('pickLeg:国内腿要同时满足「更快 ∧ 体积对账 ∧ 真读到字节」', () => {
  it('两条腿同包、国内腿更快 ⇒ 走国内腿', () => {
    const out = pickLeg([probe({ elapsedMs: 5000 }), cnProbe()], SITE)
    expect(out.leg).toBe('cn')
    expect(out.url).toBe(APK_CN_LEG_URL)
    expect(out.reason).toContain('体积对账 same')
  })
  it('反向①:两条腿体积不等 ⇒ 只用权威腿(冒名旧包防线)', () => {
    const out = pickLeg([probe({ elapsedMs: 9000 }), cnProbe({ totalBytes: TOTAL + 4096 })], SITE)
    expect(out.leg).toBe('site')
    expect(out.url).toBe(SITE)
    expect(out.reason).toContain('different')
  })
  it('反向②:国内腿没真读到字节 ⇒ 淘汰', () => {
    const out = pickLeg([probe({ elapsedMs: 9000 }), cnProbe({ receivedBytes: 0 })], SITE)
    expect(out.leg).toBe('site')
  })
  it('反向③:包体积小于下限 ⇒ 淘汰(不许拿一个 HTML 错误页当安装包)', () => {
    const out = pickLeg([probe({ elapsedMs: 9000 }), cnProbe({ totalBytes: 4096 })], SITE)
    expect(out.leg).toBe('site')
  })
  it('反向④:HTTP 404 / XHR 报错 ⇒ 淘汰', () => {
    expect(pickLeg([probe({ elapsedMs: 9000 }), cnProbe({ status: 404 })], SITE).leg).toBe('site')
    expect(
      pickLeg([probe({ elapsedMs: 9000 }), cnProbe({ error: '探针 8000ms 超时' })], SITE).leg,
    ).toBe('site')
  })
  it('主腿更快 ⇒ 保持主腿(不选国内腿不是失败)', () => {
    const out = pickLeg([probe({ elapsedMs: 200 }), cnProbe({ elapsedMs: 4000 })], SITE)
    expect(out.leg).toBe('site')
  })
  it('主腿超时、只有国内腿可用 ⇒ 单边降级,并如实记原因', () => {
    const out = pickLeg([probe({ status: 0, receivedBytes: 0, error: '超时' }), cnProbe()], SITE)
    expect(out.leg).toBe('cn')
    expect(out.reason).toContain('单边降级')
  })
  it('全灭 ⇒ 保持服务端主腿,绝不抛', () => {
    const out = pickLeg(
      [
        probe({ status: 0, receivedBytes: 0, error: '超时' }),
        cnProbe({ status: 404, receivedBytes: 0 }),
      ],
      SITE,
    )
    expect(out.url).toBe(SITE)
    expect(out.leg).toBe('site')
    expect(out.probed).toBe(true)
  })
})

describe('resolveApkDownloadUrl:选腿失败不能把更新入口弄坏', () => {
  const fastCn: LegProbeTransport = async (leg) => ({
    status: leg.id === 'cn' ? 206 : 0,
    totalBytes: leg.id === 'cn' ? TOTAL : null,
    receivedBytes: leg.id === 'cn' ? APK_PROBE_BYTES : 0,
    elapsedMs: leg.id === 'cn' ? 300 : DEFAULT_LEG_PROBE_TIMEOUT_MS,
    error: leg.id === 'cn' ? null : '探针超时',
  })

  it('国内腿可用 ⇒ 真的返回国内腿 URL', async () => {
    const out = await resolveApkDownloadUrl(SITE, { transport: fastCn })
    expect(out.url).toBe(APK_CN_LEG_URL)
    expect(out.leg).toBe('cn')
    expect(out.probed).toBe(true)
  })
  it('反向:两条腿都抛 ⇒ 保持主腿,不抛异常', async () => {
    const out = await resolveApkDownloadUrl(SITE, {
      transport: async () => {
        throw new Error('网络栈炸了')
      },
    })
    expect(out.url).toBe(SITE)
    expect(out.leg).toBe('site')
  })
  it('主腿非法 ⇒ 不探测,保持原样', async () => {
    const transport: LegProbeTransport = async () => {
      throw new Error('不该被调用')
    }
    const out = await resolveApkDownloadUrl('https://evil.com/x.apk', {
      transport,
    })
    expect(out.url).toBe('https://evil.com/x.apk')
    expect(out.probed).toBe(false)
  })
  it(`体积下限读数 = ${APK_MIN_BYTES}B(与单源 JSON 同值)`, () => {
    expect(APK_MIN_BYTES).toBe(52428800)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
