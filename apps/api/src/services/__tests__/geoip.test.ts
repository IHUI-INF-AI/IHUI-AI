import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getGeoIpService } from '../geoip'

/**
 * geoip 服务单元测试。
 *
 * 测试环境无 maxmind 包与 .mmdb 数据库 → loadReader 返回 null,
 * lookup 降级到 ip-api.com;私有/内网 IP 在 lookupViaIpApi 内直接短路返回 null,
 * isSameLocation 因此确定性降级到"IP 前两段比较"(零网络请求)。
 */
describe('geoip — 降级链与判定逻辑', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('isSameLocation', () => {
    it('相同 IP 直接返回 true(短路,零查询)', async () => {
      const svc = getGeoIpService()
      await expect(svc.isSameLocation('10.0.0.1', '10.0.0.1')).resolves.toBe(true)
    })

    it('私有 IP 查询失败 → 降级为前两段比较(同网段 → true)', async () => {
      const svc = getGeoIpService()
      await expect(svc.isSameLocation('10.0.0.1', '10.0.0.99')).resolves.toBe(true)
      await expect(svc.isSameLocation('192.168.1.1', '192.168.2.1')).resolves.toBe(true)
      await expect(svc.isSameLocation('172.16.0.1', '172.16.5.9')).resolves.toBe(true)
    })

    it('私有 IP 前两段不同 → false', async () => {
      const svc = getGeoIpService()
      await expect(svc.isSameLocation('10.0.0.1', '192.168.1.1')).resolves.toBe(false)
      await expect(svc.isSameLocation('172.16.0.1', '172.20.0.1')).resolves.toBe(false)
    })

    it('IPv6 非同一 IP → 字符串兜底比较(非 IPv4 视为同段仅当字符串相等)', async () => {
      const svc = getGeoIpService()
      await expect(svc.isSameLocation('::1', '::2')).resolves.toBe(false)
      await expect(svc.isSameLocation('fc00::1', 'fc00::1')).resolves.toBe(true)
    })

    it('IPv4-mapped IPv6 前缀归一化后参与前两段比较', async () => {
      const svc = getGeoIpService()
      await expect(svc.isSameLocation('::ffff:10.0.0.1', '::ffff:10.0.0.2')).resolves.toBe(true)
      await expect(svc.isSameLocation('::ffff:10.0.0.1', '::ffff:11.0.0.1')).resolves.toBe(false)
    })
  })

  describe('getDistanceKm', () => {
    it('相同 IP 返回 0(短路)', async () => {
      const svc = getGeoIpService()
      await expect(svc.getDistanceKm('10.0.0.1', '10.0.0.1')).resolves.toBe(0)
    })

    it('私有 IP 无坐标数据 → null(不抛错,fail-open)', async () => {
      const svc = getGeoIpService()
      await expect(svc.getDistanceKm('10.0.0.1', '10.0.0.2')).resolves.toBeNull()
    })
  })

  describe('lookup', () => {
    it('空 IP 返回 null', async () => {
      const svc = getGeoIpService()
      await expect(svc.lookup('')).resolves.toBeNull()
    })

    it('私有/内网 IP 返回 null(短路,不打远程)', async () => {
      const svc = getGeoIpService()
      for (const ip of [
        '127.0.0.1',
        '10.1.2.3',
        '192.168.0.1',
        '172.16.0.1',
        '172.31.255.255',
        '::1',
        'fd00::1',
      ]) {
        await expect(svc.lookup(ip)).resolves.toBeNull()
      }
    })

    it('公网 IP 查询失败 → 返回 null(fail-open,不阻塞业务)', async () => {
      const svc = getGeoIpService()
      // 公网 IP 会尝试 ip-api.com;测试环境网络不可用/超时 → null
      // (若 CI 网络可达也可能返回真实定位,两者都允许,断言只验证不抛错)
      const result = await svc.lookup('8.8.8.8')
      expect(result === null || typeof result.country === 'string').toBe(true)
    })
  })
})
