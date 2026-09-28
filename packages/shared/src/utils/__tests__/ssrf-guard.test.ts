// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D113 SSRF 守卫 · IPv6「被包装成内网」那一族的取证(2026-09-27 立)。
//
// 本文件存在的理由不是"再测一遍函数",而是钉住两件事:
//   A. **新增拒绝集真在生效** —— 每条新前缀都要有"该拒"的反例,且反例是本仓真实绕过形态
//      (`64:ff9b::a9fe:a9fe` = 经 NAT64 打 IMDS、`2002:7f00:0001::` = 经 6to4 打回环)。
//   B. **同族必须仍有放行** —— 6to4 / DNS64 是"把 IPv4 嵌进 IPv6",公网目的住在里面
//      (`2002:0808:0808::` = 8.8.8.8)。只按前缀名整段拒也能让 A 全绿,那是一张"全拒"的表,
//      不是判据。所以 B 与 A 同权重,且**逐条成对**。
//
// 断言一律走生产导出的判据(`isPrivateOrReservedIp` / `assertSafeFetchUrl`)与生产导出的名单表。
// 测试里**不写**第二份前缀匹配 / 位移逻辑 —— 否则变异对照测的是测试自己(§22c 那一课)。

import { describe, expect, it } from 'vitest'

import {
  DENIED_CIDRS,
  IPV6_EMBEDDED_V4_PREFIXES,
  assertSafeFetchUrl,
  isPrivateOrReservedIp,
} from '../ssrf-guard'

/**
 * 「带嵌入 IPv4」那两族的成对样本,按生产名单的 cidr 串起来。
 * 这里只写**字面地址**,不做任何位移运算:地址是手算好的十六进制
 * (10.0.0.1 = `0a00:0001`、127.0.0.1 = `7f00:0001`、169.254.169.254 = `a9fe:a9fe`、
 * 8.8.8.8 = `0808:0808`、1.1.1.1 = `0101:0101`、192.168.1.1 = `c0a8:0101`)。
 */
interface EmbeddedV4Sample {
  readonly cidr: string
  /** 嵌进来的那个 v4 落在内网/保留段 ⇒ 必须判不安全 */
  readonly deniedAddresses: readonly string[]
  /** 嵌进来的那个 v4 是公网 ⇒ 必须判安全(误杀即本仓禁止的那类判据) */
  readonly allowedAddresses: readonly string[]
}

const EMBEDDED_V4_SAMPLES: readonly EmbeddedV4Sample[] = [
  {
    cidr: '2002::/16',
    deniedAddresses: [
      '2002:7f00:0001::', // 127.0.0.1 —— 票面点名形态
      '2002:0a00:0001::', // 10.0.0.1
      '2002:c0a8:0101::', // 192.168.1.1
      '2002:a9fe:a9fe::', // 169.254.169.254 —— 经 6to4 打云元数据
      '2002:0000:0000::', // 0.0.0.0 —— 整段基址自身
    ],
    allowedAddresses: [
      '2002:0808:0808::', // 8.8.8.8 —— 票面点名的"必须放行"正例
      '2002:0101:0101::', // 1.1.1.1
      '2002:5db8:dead::', // 93.184.222.222(example.com 一档公网)
    ],
  },
  {
    cidr: '64:ff9b::/96',
    deniedAddresses: [
      '64:ff9b::7f00:1', // 127.0.0.1
      '64:ff9b::0a00:1', // 10.0.0.1 —— 票面写的 `64:ff9b::<内网v4>`
      '64:ff9b::a9fe:a9fe', // 169.254.169.254 —— NAT64 打 IMDS
      '64:ff9b::c0a8:1', // 192.168.0.1
      '64:ff9b::', // 0.0.0.0
    ],
    allowedAddresses: [
      '64:ff9b::808:808', // 8.8.8.8 —— DNS64 后的公网目的,必须放
      '64:ff9b::101:101', // 1.1.1.1
      '64:ff9b::5db8:dead', // 93.184.222.222
    ],
  },
]

/** 特殊用途前缀(整段按前缀拒):票面点名的 discard-only 与文档段 + RFC 8215 本地使用 DNS64。 */
const SPECIAL_PREFIX_ROWS: readonly {
  cidr: string
  denied: readonly string[]
  allowed: readonly string[]
}[] = [
  {
    cidr: '100::/64', // RFC 6666 Discard-Only
    denied: ['100::', '100::1', '100::dead:beef'],
    allowed: ['101::', '100:0:0:1::'], // 第 4 组一动就出 /64
  },
  {
    cidr: '2001:db8::/32', // RFC 3849 文档段
    denied: ['2001:db8::', '2001:db8::1', '2001:db8:ffff::1'],
    allowed: ['2001:db9::1', '2001:4860:4860::8888'], // Google DNS v6(既有公网正例)
  },
  {
    cidr: '64:ff9b:1::/48', // RFC 8215 本地使用 DNS64(非全局可路由,故整段拒)
    denied: ['64:ff9b:1::', '64:ff9b:1::abcd', '64:ff9b:1:808:808::'],
    allowed: ['64:ff9b::808:808', '64:ff9b:2::1'],
  },
]

describe('SSRF · 带嵌入 IPv4 的 IPv6 族(6to4 / 全局 DNS64)', () => {
  it('生产名单与样本表逐条对齐(名单被摘线 ⇒ 红;样本表多出条目 ⇒ 红)', () => {
    const declared = IPV6_EMBEDDED_V4_PREFIXES.map((row) => row.cidr)
    const sampled = EMBEDDED_V4_SAMPLES.map((row) => row.cidr)
    expect(declared).toEqual(expect.arrayContaining(sampled))
    expect(sampled).toEqual(expect.arrayContaining(declared))
    expect(declared.length).toBeGreaterThan(0)
  })

  it('嵌入的 v4 是内网/保留 ⇒ 逐条判不安全(名单不是死表)', () => {
    for (const sample of EMBEDDED_V4_SAMPLES) {
      for (const address of sample.deniedAddresses) {
        expect(
          isPrivateOrReservedIp(address),
          `${sample.cidr} 形态下 ${address}(嵌入内网 v4)未拦住`,
        ).toBe(true)
      }
    }
  })

  it('嵌入的 v4 是公网 ⇒ 逐条判安全(禁止误杀真实公网地址)', () => {
    for (const sample of EMBEDDED_V4_SAMPLES) {
      for (const address of sample.allowedAddresses) {
        expect(
          isPrivateOrReservedIp(address),
          `${sample.cidr} 形态下 ${address}(嵌入公网 v4)被误拒`,
        ).toBe(false)
      }
    }
  })

  it('票面点名的那条正例:`2002:0808:0808::` = 8.8.8.8 必须放行', () => {
    expect(isPrivateOrReservedIp('2002:0808:0808::')).toBe(false)
  })

  it('票面点名的那条反例:`2002:7f00:0001::` = 127.0.0.1 必须拦住', () => {
    expect(isPrivateOrReservedIp('2002:7f00:0001::')).toBe(true)
  })

  it('嵌入族不得与既有 v4 名单打架:同一个 v4 的裸写与嵌入写结论必须一致', () => {
    // 8.8.8.8:裸 v4 / IPv4 映射 / 6to4 / DNS64 四种写法一律放行
    for (const form of ['8.8.8.8', '::ffff:8.8.8.8', '2002:0808:0808::', '64:ff9b::808:808']) {
      expect(isPrivateOrReservedIp(form), `公网 8.8.8.8 的写法 ${form} 被误拒`).toBe(false)
    }
    // 127.0.0.1:同样四种写法一律拦
    for (const form of ['127.0.0.1', '::ffff:127.0.0.1', '2002:7f00:0001::', '64:ff9b::7f00:1']) {
      expect(isPrivateOrReservedIp(form), `回环 127.0.0.1 的写法 ${form} 未拦住`).toBe(true)
    }
  })

  it('URL 层面:直连带嵌入 v4 的 IPv6 主机即拒,且结构化字段点名', async () => {
    // 注意 `new URL()` 会把 IPv6 主机规范化(`2002:0a00:0001::` → `2002:a00:1::`),
    // 守卫拿到的是规范化后的那一份 —— 规范化不改前缀与嵌入段,故结论不变。
    // 把规范化形态钉在这里,是为了"下一次有人改了规范化路径"能当场红,而不是静默换值。
    const verdict = await assertSafeFetchUrl('http://[2002:0a00:0001::]/x')
    expect(verdict.safe).toBe(false)
    expect(verdict.code).toBe('direct-ip-denied')
    expect(verdict.host).toBe('2002:a00:1::')
    expect(verdict.deniedTarget).toBe('2002:a00:1::')
    expect(verdict.resolvedIps).toEqual(['2002:a00:1::'])

    const publicVia6to4 = await assertSafeFetchUrl('http://[2002:0808:0808::]/')
    expect(publicVia6to4.safe).toBe(true)
    const publicViaDns64 = await assertSafeFetchUrl('http://[64:ff9b::808:808]/')
    expect(publicViaDns64.safe).toBe(true)
  })
})

describe('SSRF · IPv6 特殊用途前缀(整段拒)', () => {
  it('三条新前缀都在 `DENIED_CIDRS` 里(数据在名单内,不是藏在函数体里)', () => {
    for (const row of SPECIAL_PREFIX_ROWS) {
      expect(DENIED_CIDRS as readonly string[]).toContain(row.cidr)
    }
  })

  it('逐条前缀的段内地址判不安全(正向证明)', () => {
    for (const row of SPECIAL_PREFIX_ROWS) {
      for (const address of row.denied) {
        expect(isPrivateOrReservedIp(address), `${row.cidr} 段内 ${address} 未拦住`).toBe(true)
      }
    }
  })

  it('逐条前缀紧邻段外的公网地址判安全(反向锁:边界不得外扩)', () => {
    for (const row of SPECIAL_PREFIX_ROWS) {
      for (const address of row.allowed) {
        expect(isPrivateOrReservedIp(address), `段外 ${address}(应放行)被误拒`).toBe(false)
      }
    }
  })
})

describe('SSRF · 既有结论一字未动(回归锁)', () => {
  it('本票之前已在名单里的 IPv6 档继续判不安全', () => {
    for (const cidr of ['::/128', '::1/128', 'fe80::/10', 'fc00::/7', 'ff00::/8']) {
      expect(DENIED_CIDRS as readonly string[]).toContain(cidr)
    }
    for (const address of ['::', '::1', 'fe80::1', 'fd12:3456::1', 'ff02::1']) {
      expect(isPrivateOrReservedIp(address), `${address} 必须仍判不安全`).toBe(true)
    }
  })

  it('IPv4 映射档(`::ffff:0:0/96` 折回 v4)既有行为不变,本票不重复加行', () => {
    expect(DENIED_CIDRS as readonly string[]).not.toContain('::ffff:0:0/96')
    expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivateOrReservedIp('::ffff:8.8.8.8')).toBe(false)
  })

  it('公网 IPv6 样本一律判安全(正向对照:判据不是一句"全部拒绝")', () => {
    for (const address of [
      '2001:4860:4860::8888',
      '2606:2800:220:1:248:1893:25c8:1946',
      '2620:0:2d0:200::10',
    ]) {
      expect(isPrivateOrReservedIp(address), `公网 ${address} 被误拒`).toBe(false)
    }
  })

  it('不可解析形态仍 fail-closed', () => {
    for (const junk of ['not-an-ip', '1.2.3', '999.1.1.1', '2002:0g00::', '64:ff9b:::1']) {
      expect(isPrivateOrReservedIp(junk), `${junk} 解析不出必须按不安全处理`).toBe(true)
    }
  })
})

describe('SSRF · 自托管信任不得被"嵌进 IPv6 的内网"绕过', () => {
  const trust = (configuredEndpoint: string) => ({
    source: 'user-settings' as const,
    settingsKey: 'mcpServers[].url',
    configuredEndpoint,
  })

  it('经 DNS64/6to4 打到 169.254.169.254:即使端点逐字匹配也永不放行', async () => {
    for (const imds of [
      'http://[64:ff9b::a9fe:a9fe]/latest/meta-data/',
      'http://[2002:a9fe:a9fe::]/x',
    ]) {
      const verdict = await assertSafeFetchUrl(imds, { selfHosted: trust(imds) })
      expect(verdict.safe, `${imds} 被信任层放行`).toBe(false)
      expect(verdict.code).toBe('direct-ip-denied')
    }
  })

  it('对照:链路本地整段的既有信任结论不变(既有的"永不放行"仍生效)', async () => {
    const imds = 'http://169.254.169.254/latest/meta-data/'
    expect((await assertSafeFetchUrl(imds, { selfHosted: trust(imds) })).safe).toBe(false)
    const v6LinkLocal = 'http://[fe80::1]/mcp'
    expect((await assertSafeFetchUrl(v6LinkLocal, { selfHosted: trust(v6LinkLocal) })).safe).toBe(
      false,
    )
  })

  it('信任层未被顺手放宽:公网 127.0.0.1 的自配端点仍然放行(既有能力)', async () => {
    const url = 'http://127.0.0.1:8803/mcp'
    expect((await assertSafeFetchUrl(url)).safe).toBe(false)
    expect((await assertSafeFetchUrl(url, { selfHosted: trust(url) })).safe).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
