import { describe, it, expect } from 'vitest'
import { AnomalyDetector, type AnomalyContext } from '../anomaly-detector'

/**
 * anomaly-detector 单元测试(redis=null 内存降级模式,零外部依赖)。
 *
 * 覆盖 6 维评分核心判定:
 * 1. 请求频率(>60 次/分钟 → 70+)
 * 2. 时间分布(凌晨 + 无历史活跃 → 70)
 * 3. 地理位置(同 IP 不触发;跨网段由 geoip 降级逻辑覆盖)
 * 4. 设备指纹突变(1 小时 ≥3 新设备 → 80)
 * 5. 请求模式(扫描器路径 → 95)
 * 6. 行为基线(无 userId / 样本不足 → 兜底或 0)
 */

function ctx(overrides: Partial<AnomalyContext> = {}): AnomalyContext {
  return {
    ip: '10.0.0.1',
    url: '/api/users/me',
    method: 'GET',
    timestamp: Date.parse('2026-08-02T12:00:00Z'),
    ...overrides,
  }
}

describe('anomaly-detector — 6 维评分(内存降级模式)', () => {
  describe('正常请求(白天,无 userId,无指纹)', () => {
    it('全部维度 0 分 → allow', async () => {
      const d = new AnomalyDetector(null)
      const result = await d.detectAnomaly(ctx())
      expect(result.recommendation).toBe('allow')
      expect(result.score).toBe(0)
      for (const dim of result.dimensions) {
        expect(dim.score).toBe(0)
      }
    })
  })

  describe('维度 1:请求频率', () => {
    it('1 分钟内 >60 次 → request-frequency 70+', async () => {
      const d = new AnomalyDetector(null)
      const ip = '10.0.0.201'
      for (let i = 0; i < 61; i++) {
        await d.detectAnomaly(ctx({ ip, url: `/api/test/freq/${i}` }))
      }
      const result = await d.detectAnomaly(ctx({ ip, url: '/api/test/freq/61' }))
      const freq = result.dimensions.find((x) => x.name === 'request-frequency')
      expect(freq?.score).toBeGreaterThanOrEqual(70)
    })

    it('频率超过阈值 3 倍(>180 次)→ 100 分', async () => {
      const d = new AnomalyDetector(null)
      const ip = '10.0.0.202'
      for (let i = 0; i < 181; i++) {
        await d.detectAnomaly(ctx({ ip, url: `/api/test/freq3x/${i}` }))
      }
      const result = await d.detectAnomaly(ctx({ ip, url: '/api/test/freq3x/181' }))
      const freq = result.dimensions.find((x) => x.name === 'request-frequency')
      expect(freq?.score).toBe(100)
    })
  })

  describe('维度 2:时间分布', () => {
    it('凌晨 + 无历史活跃记录 → 70 分', async () => {
      const d = new AnomalyDetector(null)
      // 不带 Z 后缀:按本地时区解析 → getHours() ∈ [0,5) 判定凌晨
      const nightTs = Date.parse('2026-08-02T03:00:00')
      const result = await d.detectAnomaly(ctx({ userId: 'u-night', timestamp: nightTs }))
      const dim = result.dimensions.find((x) => x.name === 'time-distribution')
      expect(dim?.score).toBe(70)
    })

    it('白天 → 0 分', async () => {
      const d = new AnomalyDetector(null)
      const result = await d.detectAnomaly(ctx({ userId: 'u-day' }))
      const dim = result.dimensions.find((x) => x.name === 'time-distribution')
      expect(dim?.score).toBe(0)
    })
  })

  describe('维度 3:地理位置', () => {
    it('同一 IP 不触发 geo-anomaly(0 分)', async () => {
      const d = new AnomalyDetector(null)
      const result = await d.detectAnomaly(ctx({ userId: 'u-geo' }))
      const dim = result.dimensions.find((x) => x.name === 'geo-anomaly')
      expect(dim?.score).toBe(0)
    })

    it('无 userId 不触发(0 分)', async () => {
      const d = new AnomalyDetector(null)
      const result = await d.detectAnomaly(ctx())
      const dim = result.dimensions.find((x) => x.name === 'geo-anomaly')
      expect(dim?.score).toBe(0)
    })
  })

  describe('维度 4:设备指纹突变', () => {
    it('1 小时内 ≥3 个新设备 → 80 分', async () => {
      const d = new AnomalyDetector(null)
      const userId = 'u-device'
      const base = ctx({ userId, method: 'GET' })
      // 前 2 个设备:未达阈值
      const r1 = await d.detectAnomaly({ ...base, deviceFingerprint: 'dev-a', url: '/a' })
      expect(r1.dimensions.find((x) => x.name === 'device-fingerprint')?.score).toBe(0)
      const r2 = await d.detectAnomaly({ ...base, deviceFingerprint: 'dev-b', url: '/b' })
      expect(r2.dimensions.find((x) => x.name === 'device-fingerprint')?.score).toBe(0)
      // 第 3 个新设备:set.size=3 ≥ 3 → 80
      const r3 = await d.detectAnomaly({ ...base, deviceFingerprint: 'dev-c', url: '/c' })
      expect(r3.dimensions.find((x) => x.name === 'device-fingerprint')?.score).toBe(80)
    })

    it('无指纹或无 userId → 0 分', async () => {
      const d = new AnomalyDetector(null)
      const r1 = await d.detectAnomaly(ctx({ userId: 'u-x', deviceFingerprint: 'dev-1' }))
      expect(r1.dimensions.find((x) => x.name === 'device-fingerprint')?.score).toBe(0)
      const r2 = await d.detectAnomaly(ctx({ deviceFingerprint: 'dev-1' }))
      expect(r2.dimensions.find((x) => x.name === 'device-fingerprint')?.score).toBe(0)
    })
  })

  describe('维度 5:请求模式(扫描器)', () => {
    it('命中扫描器路径 /.env → 95 分', async () => {
      const d = new AnomalyDetector(null)
      const result = await d.detectAnomaly(ctx({ url: '/.env?x=1' }))
      const dim = result.dimensions.find((x) => x.name === 'request-pattern')
      expect(dim?.score).toBe(95)
    })

    it('命中 /admin → 95 分(单维加权后 <30 → allow,需多维叠加才升级)', async () => {
      const d = new AnomalyDetector(null)
      const result = await d.detectAnomaly(ctx({ url: '/admin/config' }))
      const dim = result.dimensions.find((x) => x.name === 'request-pattern')
      expect(dim?.score).toBe(95)
      // 95*0.2 = 19 → 加权综合分 <30 → allow(单维不足以触发风控)
      expect(result.recommendation).toBe('allow')
      expect(result.score).toBeLessThan(30)
    })

    it('curl 类 UA 访问 /api/* → 60 分', async () => {
      const d = new AnomalyDetector(null)
      const result = await d.detectAnomaly(ctx({ url: '/api/users', userAgent: 'curl/8.0.0' }))
      const dim = result.dimensions.find((x) => x.name === 'request-pattern')
      expect(dim?.score).toBe(60)
    })

    it('正常路径 → 0 分', async () => {
      const d = new AnomalyDetector(null)
      const result = await d.detectAnomaly(ctx())
      const dim = result.dimensions.find((x) => x.name === 'request-pattern')
      expect(dim?.score).toBe(0)
    })
  })

  describe('维度 6:行为基线', () => {
    it('无 userId → 0 分', async () => {
      const d = new AnomalyDetector(null)
      const result = await d.detectAnomaly(ctx())
      const dim = result.dimensions.find((x) => x.name === 'behavior-baseline')
      expect(dim?.score).toBe(0)
    })

    it('基线样本 <10 时用行为指纹兜底(≤50,不抛错)', async () => {
      const d = new AnomalyDetector(null)
      const result = await d.detectAnomaly(ctx({ userId: 'u-baseline-new' }))
      const dim = result.dimensions.find((x) => x.name === 'behavior-baseline')
      expect(dim?.score).toBeLessThanOrEqual(50)
    })
  })

  describe('recommendation 阈值映射', () => {
    it('全部维度 0 → allow', async () => {
      const d = new AnomalyDetector(null)
      const result = await d.detectAnomaly(ctx())
      expect(result.recommendation).toBe('allow')
      expect(result.score).toBe(0)
    })

    it('频率 70 + 凌晨 30 + curl 60 加权 → monitor(30-60)', async () => {
      const d = new AnomalyDetector(null)
      // 本地时区凌晨 4:30(无 Z 后缀,避免 UTC 偏移导致白天判定)
      const night = Date.parse('2026-08-02T04:30:00')
      const ip = '10.0.0.203'
      for (let i = 0; i < 61; i++) {
        await d.detectAnomaly(ctx({ ip, url: `/api/test/ch/${i}`, timestamp: night }))
      }
      const result = await d.detectAnomaly(
        ctx({ ip, url: '/api/test/ch/61', timestamp: night, userAgent: 'curl/8.0.0' }),
      )
      // 70*0.25 + 30*0.1 + 60*0.2 = 17.5 + 3 + 12 = 32.5 → 33
      expect(result.score).toBeGreaterThanOrEqual(30)
      expect(result.score).toBeLessThanOrEqual(60)
      expect(result.recommendation).toBe('monitor')
    })

    it('六维叠加(频率 100 + 设备 80 + 扫描 95 + 凌晨 70 + geo 90 + 基线 75)→ block(>80)', async () => {
      const d = new AnomalyDetector(null)
      // 本地时区凌晨 2:30(无 Z 后缀)
      const night = Date.parse('2026-08-02T02:30:00')
      const userId = 'u-block-e2e'
      const ipA = '10.0.0.210'
      const ipB = '192.168.50.210'
      const ipC = '10.0.0.211'
      // 基线样本 ≥10(recordUserBehavior 独立调用,不污染频率窗口)
      for (let i = 0; i < 11; i++) {
        await d.recordUserBehavior(userId, 'view')
      }
      // 频率 >180 次(→100)+ 首次 IP 记录(lastIp=ipA)
      for (let i = 0; i < 181; i++) {
        await d.detectAnomaly(ctx({ ip: ipA, userId, timestamp: night, url: `/api/block/a/${i}` }))
      }
      // 设备指纹 3 个(dev-a 首次切 ipB 触发 geo 90,后续同 IP 归 0)
      for (const [i, fp] of ['dev-a', 'dev-b', 'dev-c'].entries()) {
        await d.detectAnomaly(
          ctx({
            ip: ipB,
            userId,
            timestamp: night,
            deviceFingerprint: fp,
            url: `/api/block/b/${i}`,
          }),
        )
      }
      // 最终调用:新 IP(ipB→ipC 前两段剧变 → geo 90)+ 第 4 个新设备(→80)+ 扫描路径(→95)
      // 频率窗口 userCount=186(仍 >180 → 100);基线 threshold≈15.5,recentCount=186 → 75
      const result = await d.detectAnomaly(
        ctx({
          ip: ipC,
          userId,
          timestamp: night,
          deviceFingerprint: 'dev-d',
          url: '/.env',
        }),
      )
      // 100*0.25 + 80*0.15 + 95*0.2 + 70*0.1 + 90*0.15 + 75*0.15 = 87.75 → 88
      // (若测试恰好运行在凌晨 2-4 点,markActiveHour 会命中 → time 0 分 → 80.75 → 81,仍 >80)
      expect(result.score).toBeGreaterThan(80)
      expect(result.recommendation).toBe('block')
    })
  })
})
