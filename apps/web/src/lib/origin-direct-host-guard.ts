// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 源站直连守卫(2026-10-21 立)。
 *
 * 立因(全部当次现读):EdgeOne 回源从"绕美国 Cloudflare 隧道"改为直填家宽公网
 * IPv4 `218.27.70.129:8801` 后,穿透回源从 10~45 秒降到 0.28~0.34 秒;代价是
 * `netsh interface portproxy` 把 0.0.0.0:8801 暴露到公网 —— 任何知道 IP 的人
 * 直连它就绕过 EdgeOne 的 WAF/频控。
 *
 * 判据刻意取**极窄的黑名单**方向(失败方向 = 多放一次,绝不"多拦一次",§0.3 精神):
 * 只拒绝「Host 头是裸公网 IP 字面量」这一类请求 —— 除绕过 CDN 打源站的人以外
 * 没有合法使用者。其余一律放行:任何 `*.aizhs.top` 域名、`localhost`、`127.0.0.1`、
 * `[::1]`、`0.0.0.0`、全部私网/保留段(192.168/10/172.16-31/169.254/100.64-127…)、
 * 空 Host、解析不出来的畸形 Host。按白名单只放已知域名会把健康检查
 * (`http://127.0.0.1:8801`,见 deploy/win/ihui-deploy.ps1)、局域网访问、将来新增
 * 域名全打挂 —— 那是错的方向。
 *
 * 地址解析与网段归类**不含第二份实现**:一律复用
 * `packages/shared/src/utils/ip-literal.ts` 的 `parseIpAddress` /
 * `isPrivateOrReservedIp`(§0.6 单一真相源;那一份里的 `::ffff:` 折叠、6to4/DNS64
 * 嵌入 v4 复检、fail-closed 语义由此自动继承)。
 *
 * 为什么引 `ip-literal` 而不是同名更出名的 `ssrf-guard`:本守卫由 `apps/web/proxy.ts`
 * 消费,而 proxy 跑在 **Edge 运行时** —— `ssrf-guard.ts` 为"域名先解析再逐 IP 判"而
 * import `node:dns/promises`,那两行会让 `next build` 在构建期直接报错(红的是全站部署,
 * 不是这一个文件)。两把尺子本身是纯字符串 + 位运算,与 DNS 无关,故 2026-10-21 把它们
 * 拆进零 Node 内建的 `ip-literal.ts`;`ssrf-guard.ts` 原样 re-export,对外路径不变。
 * **本文件只准引纯模块** —— 一旦改回引 `ssrf-guard`,构建即红。
 *
 * 本文件只做 Host 头的**语法拆解**
 * (RFC 7230 §5.4:IPv6 必须带方括号;裸 IPv6 属畸形 ⇒ 按安全方向放行)。
 *
 * 强度边界(不许夸大):守卫只看 Host 头。攻击者带上 `Host: www.aizhs.top` 直连
 * IP 即可完全绕过本层 —— 它拦的是"扫描器/脚本按 IP 直连"这一最常见形态,
 * 不是鉴权,不是 WAF。真正的门禁仍在 EdgeOne 层;本层是源站暴露后的减噪垫。
 */

import { isPrivateOrReservedIp, parseIpAddress } from '@ihui/shared/utils/ip-literal'

export interface HostGuardDecision {
  readonly allowed: boolean
  readonly reason: string
}

const allow = (reason: string): HostGuardDecision => ({ allowed: true, reason })
const deny = (reason: string): HostGuardDecision => ({ allowed: false, reason })

/**
 * 从 Host 头取出主机字面量;取不出来(畸形)返回 null —— 调用方按放行处理。
 * 只认两种合法形态:`name` / `name:port` / `ip:port`,以及 `[v6]` / `[v6]:port`。
 */
function extractHostLiteral(hostHeader: string): string | null {
  const raw = hostHeader.trim()
  if (!raw) return null

  if (raw.startsWith('[')) {
    const close = raw.indexOf(']')
    if (close < 0) return null
    const rest = raw.slice(close + 1)
    if (rest !== '' && !/^:\d{1,5}$/.test(rest)) return null
    return raw.slice(1, close)
  }

  const firstColon = raw.indexOf(':')
  if (firstColon < 0) return raw
  // 两个及以上裸冒号 = 未加方括号的 IPv6,RFC 7230 不合法 ⇒ 畸形,按放行
  if (raw.indexOf(':', firstColon + 1) >= 0) return null
  if (!/^\d{1,5}$/.test(raw.slice(firstColon + 1))) return null
  return raw.slice(0, firstColon)
}

/**
 * 裁决一个 Host 头是否允许直达源站。
 *
 * 判序(每一步的失败方向都是放行):
 *  1. 非字符串 / 空 / 畸形 Host ⇒ allowed(missing-host / malformed-host)
 *  2. 取出的主机字面量**解析不成任何 IP** ⇒ allowed(named-host)—— 域名一律照旧
 *  3. 解析成 IP 但落在私有/保留网段(ssrf-guard 的 DENIED_CIDRS 即"不可公网直达"集,
 *     含 0.0.0.0/8、127/8、10/8、172.16/12、192.168/16、169.254/16、100.64/10、::1 等)
 *     ⇒ allowed(private-or-reserved-ip)—— 健康检查与局域网流量全在这一步被放过
 *  4. 剩下的只有"裸公网 IP 字面量"(IPv4 与公网 IPv6,含 `::ffff:` 折叠形态)⇒ 拒绝
 */
export function evaluateOriginHostGuard(hostHeader: string | null | undefined): HostGuardDecision {
  if (typeof hostHeader !== 'string') return allow('missing-host')
  const host = extractHostLiteral(hostHeader)
  if (host === null) return allow('malformed-host')
  if (host === '') return allow('empty-host')
  if (parseIpAddress(host) === null) return allow('named-host')
  if (isPrivateOrReservedIp(host)) return allow('private-or-reserved-ip')
  return deny('public-ip-literal-host')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
