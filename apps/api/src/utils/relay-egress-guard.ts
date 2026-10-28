// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { LookupOptions } from 'node:dns'
import { lookup as dnsLookupAll } from 'node:dns/promises'
import { Agent } from 'undici'
import { assertSafeFetchUrl, isBlockedTargetIp } from './ssrf-guard.js'

/**
 * relay 账号池出网复检。
 *
 * 补的窗口:渠道 base_url 在**保存时**已过 safeFetch 校验,但那之后域名改指内网
 * (DNS 变更 / 改解析)就再没人看 —— 转发器用的是裸 fetch。本模块把判定挪到
 * "请求发出去的那一刻"。
 *
 * 档位:放行私网 + 自定义端口。理由是功能面,不是省事 —— 渠道上游允许 LAN 自托管
 * 服务(Ollama 11434 / vLLM 8000 这类),按默认档会把它们全打断。放宽只放宽"私网/端口"
 * 两维;云元数据、回环、本机这三类由 ssrf-guard 的 isBlockedTargetIp **恒拦**,
 * 不受本档位影响。地址分类判据一律住在 ssrf-guard,本文件不另写一份(§0.6)。
 *
 * 两层防线（缺一不可，各挡一类）：
 *  ① 首跳复检 assertRelayEgressSafe —— 管协议/端口/地址族，两条出口分支都过。
 *  ② 连接期守卫 relayGuardedLookup —— 只管"这一条连接真要用的地址"。少了它，
 *     ①就防不住 DNS rebinding：①问的是一次解析，fetch 连接时还会再问一次，
 *     一条 TTL=0 的 A 记录能让"校验时公网、连接时内网"。
 *     探针实测（.ihui-agent/tmp/relay-egress/probe.mjs，两态对照）：connect.lookup 交回的
 *     地址就是连接目标；把它桩成拒绝态时，本地 http server 一个请求都收不到。
 *
 * 覆盖边界（写破）：② 只对**直连**分支有意义。走账号代理时本机不解析目标（由代理解析），
 * 那一分支的防线只有 ① —— 要覆盖它得让代理侧固化解析结果，不在本轮射程。
 */
export const RELAY_EGRESS_GUARD = { allowPrivate: true, allowCustomPort: true } as const

/**
 * 复检目标 URL;不安全直接抛。返回 void —— 改写并回传 URL 会把 Request 对象上的
 * method/headers 语义丢掉,调用方继续用它自己的 input 才对。
 * 判不出(空串 / 非法 URL)一律按"不安全"处理 —— 失效方向是多拦一次,绝不静默放行。
 */
export async function assertRelayEgressSafe(input: Parameters<typeof fetch>[0]): Promise<void> {
  const target =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : ((input as { url?: string }).url ?? '')
  const verdict = await assertSafeFetchUrl(target, RELAY_EGRESS_GUARD)
  if (!verdict.safe) throw new Error(`relay egress blocked: ${verdict.reason}`)
}

export interface RelayLookupAddress {
  address: string
  family: number
}

export type RelayLookupCallback = (
  err: NodeJS.ErrnoException | null,
  addresses: RelayLookupAddress[] | string,
) => void

/**
 * 连接期守卫（Node net 的 lookup 契约）：把"这个地址能不能连"的判定，
 * 挪到 undici 拿它真正建 socket 的那一步 —— 校验与连接共用同一次解析，rebinding 才无效。
 *
 * 判据不重写：地址族一律问 ssrf-guard 的 isBlockedTargetIp（危险族恒拦，私网不拦，
 * 因为 LAN 自托管是允许面）。解析失败 ⇒ 交回错误，绝不"判不出就当放行"。
 */
export function relayGuardedLookup(
  hostname: string,
  options: LookupOptions,
  callback: RelayLookupCallback,
): void {
  // all:true 必须排在展开之后：调用方传 all:false 时不能把"拿数组"这个前提冲掉
  void dnsLookupAll(hostname, { ...options, all: true })
    .then((rows) => {
      for (const row of rows) {
        if (isBlockedTargetIp(row.address)) {
          callback(
            Object.assign(new Error(`relay egress blocked: ${row.address} is a blocked target`), {
              code: 'ERELAYEGRESS',
            }),
            [],
          )
          return
        }
      }
      callback(null, rows)
    })
    .catch((e: unknown) => {
      callback(e instanceof Error ? e : new Error(String(e)), [])
    })
}

let directEgressAgent: Agent | null = null

/**
 * 直连出口的 dispatcher（单例：连接池按 host 复用，不能每请求新建）。
 * 装的是 connect.lookup 钩子，所以它既是"直连用的那个 agent"，也是 ② 的接线点。
 */
export function directEgressDispatcher(): Agent {
  if (!directEgressAgent) {
    directEgressAgent = new Agent({ connect: { lookup: relayGuardedLookup } })
  }
  return directEgressAgent
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
