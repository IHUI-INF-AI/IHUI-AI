// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 异地提醒收敛回归锁(2026-11-27)。
 *
 * 锁住三件事:
 *  ① 回环/内网 IP 永不参与"异地"判定(此前 127.0.0.1 被当成异地,7 天贡献 11 条假告警);
 *  ② 判据是"最近 N 天有没有在该地区登录过",不是"和上一次登录比";
 *  ③ 没有历史记忆(新账号 / Redis 不可用 / 首次上线)时判为 unknown,不提醒。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type * as ConfigModule from '../src/config/index.js'
import type { Redis } from 'ioredis'

import {
  evaluateLoginRegion,
  isLoginAlertIgnoredIp,
  matchesCidrList,
  rememberLoginRegion,
  __test__ as regionMemoryTest,
} from '../src/services/login-region-memory.js'
import { ipRegionKey } from '../src/utils/ip-region.js'

vi.mock('../src/config/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigModule>()
  return {
    ...actual,
    config: {
      ...actual.config,
      LOGIN_REGION_MEMORY_DAYS: 90,
      LOGIN_REGION_ALERT_IGNORE_CIDRS: '142.91.108.0/24',
    },
  }
})

/** 最小 Redis 假件:只实现本模块用到的 4 个命令。 */
function fakeRedis(initial: Record<string, string[]> = {}) {
  const sets = new Map<string, Set<string>>(
    Object.entries(initial).map(([k, v]) => [k, new Set(v)]),
  )
  const ttl = new Map<string, number>()
  return {
    sets,
    ttl,
    exists: async (key: string): Promise<number> => (sets.has(key) ? 1 : 0),
    sadd: async (key: string, ...members: string[]): Promise<number> => {
      let added = 0
      const set = sets.get(key) ?? new Set<string>()
      for (const m of members) {
        if (!set.has(m)) {
          set.add(m)
          added++
        }
      }
      sets.set(key, set)
      return added
    },
    sismember: async (key: string, member: string): Promise<number> =>
      sets.get(key)?.has(member) ? 1 : 0,
    expire: async (key: string, seconds: number): Promise<number> => {
      ttl.set(key, seconds)
      return 1
    },
  } as unknown as Redis
}

beforeEach(() => {
  regionMemoryTest.clearMemory()
  regionMemoryTest.clearCidrCache()
})

describe('ipRegionKey', () => {
  it('IPv4 折到前两段', () => {
    expect(ipRegionKey('123.173.26.28')).toBe('123.173')
    expect(ipRegionKey('175.17.193.167')).toBe('175.17')
  })

  it('IPv6 折到前两组', () => {
    expect(ipRegionKey('240E:312:E56:E300:B028:932D:195:D7AC')).toBe('240e:312')
  })

  it('非法/空值原样返回', () => {
    expect(ipRegionKey('')).toBe('')
    expect(ipRegionKey('not-an-ip')).toBe('not-an-ip')
  })
})

describe('isLoginAlertIgnoredIp', () => {
  it('回环与私网恒跳过', () => {
    expect(isLoginAlertIgnoredIp('127.0.0.1')).toBe(true)
    expect(isLoginAlertIgnoredIp('127.0.0.53')).toBe(true)
    expect(isLoginAlertIgnoredIp('::1')).toBe(true)
    expect(isLoginAlertIgnoredIp('10.1.2.3')).toBe(true)
    expect(isLoginAlertIgnoredIp('172.20.0.9')).toBe(true)
    expect(isLoginAlertIgnoredIp('192.168.1.8')).toBe(true)
  })

  it('配置的自动化出口 CIDR 跳过', () => {
    expect(isLoginAlertIgnoredIp('142.91.108.35')).toBe(true)
    expect(isLoginAlertIgnoredIp('142.91.108.7')).toBe(true)
  })

  it('普通公网 IP 不跳过', () => {
    expect(isLoginAlertIgnoredIp('123.173.26.28')).toBe(false)
    expect(isLoginAlertIgnoredIp('8.8.8.8')).toBe(false)
  })

  it('CIDR 解析对非法输入 fail-open(不误判为命中)', () => {
    expect(matchesCidrList('123.173.26.28', '')).toBe(false)
    expect(matchesCidrList('123.173.26.28', 'not-a-cidr')).toBe(false)
    expect(matchesCidrList('240e:312::1', '240e:312::/32')).toBe(true)
  })
})

describe('evaluateLoginRegion', () => {
  it('没有任何历史记忆时判 unknown(不提醒)', async () => {
    const verdict = await evaluateLoginRegion(null, 'u-1', '123.173')
    expect(verdict).toBe('unknown')
  })

  it('首次判定用历史设备补齐:常用地 known、新地区 novel', async () => {
    const seed = async () => ['123.173', '175.17']
    expect(await evaluateLoginRegion(null, 'u-2', '123.173', seed)).toBe('known')
    expect(await evaluateLoginRegion(null, 'u-2', '142.91', async () => ['123.173'])).toBe('novel')
  })

  it('Redis:空集合先 seed,再判已知/未知', async () => {
    const redis = fakeRedis()
    const seed = async () => ['123.173']
    expect(await evaluateLoginRegion(redis, 'u-3', '123.173', seed)).toBe('known')
    expect(redis.sets.get(regionMemoryTest.regionKeyOf('u-3'))?.has('123.173')).toBe(true)

    expect(await evaluateLoginRegion(redis, 'u-3', '142.91', async () => [])).toBe('novel')
  })

  it('已有集合时不再 seed,直接按成员判断', async () => {
    const redis = fakeRedis({ 'login:regions:u-4': ['123.173'] })
    const seed = vi.fn(async () => ['175.17'])
    expect(await evaluateLoginRegion(redis, 'u-4', '175.17', seed)).toBe('novel')
    expect(seed).not.toHaveBeenCalled()
  })

  it('seed 抛错不影响判定,只是回到 unknown', async () => {
    const verdict = await evaluateLoginRegion(null, 'u-5', '123.173', async () => {
      throw new Error('db down')
    })
    expect(verdict).toBe('unknown')
  })

  it('记住地区后,同地区不再判为新', async () => {
    const redis = fakeRedis()
    await rememberLoginRegion(redis, 'u-6', '123.173')
    expect(await evaluateLoginRegion(redis, 'u-6', '123.173')).toBe('known')
    expect(redis.ttl.get('login:regions:u-6')).toBe(90 * 24 * 60 * 60)
  })

  it('Redis 故障时降级为 unknown,不误报', async () => {
    const broken = {
      exists: async () => {
        throw new Error('redis down')
      },
    } as unknown as Redis
    expect(await evaluateLoginRegion(broken, 'u-7', '123.173')).toBe('unknown')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
