// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-connect-agent.ts — 给 `ws` 用的 HTTP CONNECT 隧道 agent(2026-11-10 立)。
 *
 * 立因(不是"顺手补个功能"):号池的出口代理是 undici 的 `ProxyAgent`,而 `ws` 只认
 * Node 的 `http.Agent`。两套不通用 ⇒ 带代理的账号此前被迫在有 WS 能力时退回 HTTP,
 * 等于"代理越全的号,长连接越用不上",正好和需求反着。
 *
 * 为什么不装 `https-proxy-agent`:
 * 本仓依赖面已经很宽(见 knip 基线),而这里要的东西只有一条 RFC 7231 §4.3.6 的
 * CONNECT 语义 —— 建隧道、转字节、不碰应用层。自己实现能省一个依赖,也能把
 * "代理协议支持到哪"写死在代码里(只认 http/https 代理,**SOCKS 明确不支持**),
 * 不出现"装了但半残"的错觉。
 *
 * 能力边界(如实,不粉饰):
 * - 支持 http:// 与 https:// 代理,支持 Basic 认证(user:pass@host);
 * - 不支持 SOCKS4/5(需另一套握手,本仓没有 SOCKS 依赖);
 * - 不支持代理侧的 PAC/自动配置;
 * - 隧道建立后不再做 DNS 解析(目标 hostname 原样交代理,由代理侧解析)——
 *   这是 CONNECT 的语义,也正好避开了本地 DNS 泄漏。
 */
import http from 'node:http'
import https from 'node:https'
import tls from 'node:tls'
import type { Socket } from 'node:net'

/** CONNECT 信封的原始形态(与 Node http.Agent.createConnection 的异步回调约定对齐) */
type CreateConnectionCb = (err: Error | null, stream?: Socket) => void

export interface ConnectProxyAgentOptions {
  /** 目标是否为 TLS(wss:// / https://)。决定隧道建立后是否再套一层 tls.connect */
  secureTarget: boolean
  /** CONNECT 请求超时(ms),非隧道内 IO 超时 */
  timeoutMs?: number
  /** 透传给 tls.connect 的额外选项(测试用:自签证书需 rejectUnauthorized:false) */
  tlsOptions?: tls.ConnectionOptions
  /** 注入点(测试可观察握手报文);缺省用 node 原生模块 */
  requestImpl?: typeof http.request
}

/** 代理 URL 是否本层能处理(供选路层判定,避免"声明支持却在建连时才炸") */
export function isSupportedProxyUrl(proxyUrl: string): boolean {
  try {
    const proto = new URL(proxyUrl).protocol
    return proto === 'http:' || proto === 'https:'
  } catch {
    return false
  }
}

function proxyAuthHeader(proxy: URL): Record<string, string> {
  if (!proxy.username && !proxy.password) return {}
  // URL 里的用户名/密码是 percent-encoded,必须解码后再做 Basic(否则 user%40host 会算错)
  const user = decodeURIComponent(proxy.username)
  const pass = decodeURIComponent(proxy.password)
  const token = Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')
  return { 'proxy-authorization': `Basic ${token}` }
}

/**
 * 造一个只做 CONNECT 隧道的 agent(不复用连接:号池一个请求一条连接,
 * keepAlive 只会把已死的隧道留在池里,下次请求先吃一次 ECONNRESET)。
 */
export function createConnectProxyAgent(
  proxyUrl: string,
  options: ConnectProxyAgentOptions,
): http.Agent {
  const proxy = new URL(proxyUrl)
  const secureProxy = proxy.protocol === 'https:'
  const proxyPort = Number(proxy.port) || (secureProxy ? 443 : 80)
  const timeoutMs = options.timeoutMs ?? 15_000
  const requestImpl = options.requestImpl ?? (secureProxy ? https.request : http.request)

  // agent 类型必须跟**目标**一致:ws 内部按 wss:/ws: 选 https/http 模块,
  // 拿错类型会在 request 阶段报 Invalid protocol 而不是在建连处,排查成本高。
  const agent = options.secureTarget
    ? new https.Agent({ keepAlive: false, maxCachedSessions: 0 })
    : new http.Agent({ keepAlive: false })

  agent.createConnection = ((opts: Record<string, unknown>, cb?: CreateConnectionCb): undefined => {
    const targetHost = String(opts['host'] ?? '')
    const targetPort = Number(opts['port']) || (options.secureTarget ? 443 : 80)
    const done: CreateConnectionCb =
      typeof cb === 'function'
        ? cb
        : (err, stream) => {
            if (err) agent.destroy()
            else stream?.destroy()
          }

    const headers: Record<string, string> = {
      host: `${targetHost}:${targetPort}`,
      ...proxyAuthHeader(proxy),
    }

    const req = requestImpl({
      host: proxy.hostname,
      port: proxyPort,
      method: 'CONNECT',
      path: `${targetHost}:${targetPort}`,
      headers,
      agent: false,
      timeout: timeoutMs,
    } as http.RequestOptions)

    let settled = false
    const fail = (err: Error): void => {
      if (settled) return
      settled = true
      req.destroy()
      done(err)
    }

    req.once('connect', (res, socket) => {
      if (settled) {
        socket.destroy()
        return
      }
      if (res.statusCode !== 200) {
        socket.destroy()
        fail(
          new Error(
            `代理 CONNECT 被拒:HTTP ${res.statusCode}${res.statusMessage ? ` ${res.statusMessage}` : ''}`,
          ),
        )
        return
      }
      socket.setNoDelay(true)
      if (!options.secureTarget) {
        settled = true
        done(null, socket)
        return
      }
      // 隧道已通,再在隧道内做 TLS 握手(SNI 用目标 hostname,不用代理的)
      const tlsSocket = tls.connect({
        socket,
        servername: targetHost,
        ALPNProtocols: ['http/1.1'],
        ...(options.tlsOptions ?? {}),
      })
      tlsSocket.once('secureConnect', () => {
        if (settled) return
        settled = true
        done(null, tlsSocket)
      })
      tlsSocket.once('error', (err: Error) => {
        tlsSocket.destroy()
        fail(new Error(`隧道内 TLS 握手失败:${err.message}`))
      })
    })

    req.once('timeout', () => fail(new Error(`代理 CONNECT 超时(${timeoutMs}ms)`)))
    req.once('error', (err: Error) => fail(new Error(`代理连接失败:${err.message}`)))
    req.end()
    return undefined
  }) as http.Agent['createConnection']

  return agent
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
