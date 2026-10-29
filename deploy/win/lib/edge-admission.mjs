// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 边缘准入判定(2026-10-29 加固第二批)。
 *
 * 立因:上一批把「回源鉴权」与「入口限流」接在了 router 的**普通 HTTP 分支**上,而
 * `server.on('upgrade')` 是另一条独立回调 —— 它拿到连接就直接 `net.connect` 到上游,
 * 既不看回源密钥、也不过令牌桶。后果不是"少一层",而是**两层全绕**:
 *   攻击者只要在请求行写 `Upgrade: websocket`,就能以任意速率、任意条数直连上游,
 *   限流日志里一条都不留(它压根没走那条分支)。
 * 这类缺口的共同特征与 AGENTS §0.9 记的那一型同构 ——「装了一半」在类型检查、
 * 单测、构建上全都与装完同形,只有真打一下才看得见。故本模块把判定抽成纯函数,
 * 让"绕没绕过"变成可断言的用例,而不是靠读代码确认。
 *
 * 为什么判定要和执行分开:
 *   原实现是内联在回调里的 if 链,想验证只能起一个真 router 再发真握手 ——
 *   而"从非回环地址发"这件事在本机结构上做不到(全是 127.0.0.1),于是这条路径
 *   在测试里**永远测不到**。抽成纯函数后,`remoteAddress` 直接当参数注入,
 *   公网来源、回环来源、密钥匹配/缺失/错误三种态都能在同一进程里断言。
 */

import net from 'node:net'

import { decideEdgeGuard } from './edge-origin-guard.mjs'
import { isLoopbackAddress } from './ip-rate-limit.mjs'

/**
 * WebSocket 握手准入。
 *
 * 两道闸的顺序与 HTTP 分支保持一致:先回源鉴权、后限流。
 * 理由同 HTTP 侧 —— 直连攻击者不带头,不必为它耗一个限流令牌;
 * 而回源鉴权只做一次定长比较,比令牌桶更便宜。
 *
 * @param {object} input
 * @param {'off'|'observe'|'enforce'} input.edgeMode   回源鉴权档位
 * @param {string} input.edgeSecret                     期望密钥;空串 ⇒ 守卫未配置
 * @param {string} input.remoteAddress                  TCP 对端地址(不可伪造)
 * @param {Record<string, unknown>} input.headers       握手请求头
 * @param {((ip: string) => {allowed: boolean, retryAfterSec: number}) | null} [input.checkRate]
 *        限流检查器;null/缺省 ⇒ 限流层未启用。**由调用方注入**而不是本模块自建桶:
 *        桶必须是全进程唯一的那一个(与 HTTP 分支共用),各建一个等于把阈值翻倍。
 * @returns {{
 *   allow: boolean,
 *   status: 0|403|429,
 *   reason: 'ok'|'edge-guard'|'rate-limit',
 *   edgeReason: string,
 *   retryAfterSec: number,
 * }}
 */
export function decideUpgradeAdmission({
  edgeMode,
  edgeSecret,
  remoteAddress,
  headers,
  checkRate = null,
}) {
  const ip = typeof remoteAddress === 'string' ? remoteAddress : ''
  const loopback = isLoopbackAddress(ip)

  const verdict = decideEdgeGuard({
    mode: edgeMode,
    secret: edgeSecret,
    loopback,
    headers,
  })

  if (verdict.action === 'deny') {
    return {
      allow: false,
      status: 403,
      reason: 'edge-guard',
      edgeReason: verdict.reason,
      retryAfterSec: 0,
    }
  }

  // 回环豁免与 HTTP 分支同源(isLoopbackAddress 单一真相源):内部服务、部署脚本、
  // 健康检查的握手不该被自己的限流挡住 —— 那是「加固把自己打瘫」。
  if (checkRate && !loopback) {
    const r = checkRate(ip)
    if (!r.allowed) {
      return {
        allow: false,
        status: 429,
        reason: 'rate-limit',
        edgeReason: verdict.reason,
        retryAfterSec: r.retryAfterSec,
      }
    }
  }

  return {
    allow: true,
    status: 0,
    reason: 'ok',
    edgeReason: verdict.reason,
    retryAfterSec: 0,
  }
}

/**
 * 握手被拒时写回的 HTTP 响应帧。
 *
 * 为什么不能只 `socket.destroy()`:客户端只会看到 "connection reset",分不清
 * 「被限流(等一会儿再来)」和「被拦(根本不该来)」;而 ws 客户端库拿到 429 会按
 * Retry-After 退避,拿到 403 会直接放弃 —— 这两种行为都是我们要的。
 * 直接断连还会让排障面归零:日志里只有一个 RST,看不出是谁拦的。
 *
 * @param {number} status
 * @param {string} reason
 * @param {number} [retryAfterSec]
 * @returns {string}
 */
export function buildRejectionFrame(status, reason, retryAfterSec = 0) {
  const body = JSON.stringify({ code: status, message: reason })
  const lines = [
    `HTTP/1.1 ${status} ${status === 403 ? 'Forbidden' : 'Too Many Requests'}`,
    'content-type: application/json',
    `content-length: ${Buffer.byteLength(body)}`,
    'connection: close',
  ]
  if (retryAfterSec > 0) lines.push(`retry-after: ${retryAfterSec}`)
  return `${lines.join('\r\n')}\r\n\r\n${body}`
}

/**
 * 运维探针 `/__bg/status` 的可见性。
 *
 * 立因(2026-10-29 实测):该端点原注释写「仅本机可达(监听 127.0.0.1)」,
 * 但那份注释只对 API router 成立 —— WEB router 复用同一份实现且监听 **0.0.0.0**
 * (EdgeOne 回源直填公网 IP 的硬约束)。实测 `curl http://127.0.0.1:8801/__bg/status`
 * 返回 `{"ok":true,"active":"green","upstream":8852}` ⇒ 公网任何人可读走
 * 「当前活跃配色 + 两色内部端口」。单看不是漏洞,但它给攻击者两件事:
 *   ① 确认打的是真源站而非蜜罐/边缘;
 *   ② 知道切流窗口 —— 蓝绿切换时打旧色可命中"已经排空但还没停"的实例。
 * 故判据改为按**来源**而不是按"我以为它监听在哪"。
 *
 * 非回环一律回 404(与未知路径同形),不回 403:403 等于告诉对方"这个路径存在,
 * 只是你没权限",那还是泄露了端点的存在性。
 *
 * @param {string} remoteAddress
 * @returns {boolean} true ⇒ 可以返回真实状态
 */
export function bgStatusVisibleTo(remoteAddress) {
  return isLoopbackAddress(typeof remoteAddress === 'string' ? remoteAddress : '')
}

/**
 * 从 env 读连接数硬顶。
 *
 * 立因:Node 的 `server.maxConnections` 缺省是 `Infinity` —— 反代进程对「同时挂多少条
 * TCP」没有任何上限。headersTimeout=30s 只保证单条连接不会永远挂着,挡不住
 * 「每秒建 N 条、30 秒内堆 30N 条」这种量:FD 与内存按连接数线性涨,而 router 一旦
 * OOM,全站入口同时消失(比被攻击更彻底)。
 *
 * 取值口径与限流一致:给得宽(默认 10000),正常流量远达不到,连接耗尽型攻击会瞬间打满。
 * 非法/非正数一律回落默认值 —— 失效方向恒为「保持有上限」,绝不因配错变成无上限。
 *
 * 为什么**不**复用 `apps/api/src/plugins/http-conn-guard.ts` 的同名函数(§0.6 单一真相源
 * 在这里的例外必须写明,否则下一个人会以为是漏抄):
 *   · 运行时不同 —— 那边是 TS,由 tsx 加载;本文件是 Node 直跑的 .mjs,import 不到 TS;
 *   · 缺省值不同且不能统一 —— 那边缺省 20000,且把 `'0'` 判成 0(它的调用方另行兜底);
 *     本层 `'0'` 若透传成 0,等于**一条连接都不许进**,那是把入口关死,失效方向反了。
 *   两处唯一共享的是"非法值回落"这条语义,故此处独立实现并各自用测试钉住。
 *
 * @param {unknown} raw
 * @returns {number}
 */
export function resolveRouterMaxConnections(raw) {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10_000
}

// ── 客户端 IP 归一(2026-10-29 加固,第四层)─────────────────────────────────
/**
 * 治「上游拿到的客户端 IP 由客户端自己指定」。这一层只能由边缘做,因为它是全链路唯一
 * 同时看得见两样东西的地方:**TCP 对端**(不可伪造)与**回源鉴权结论**(是否来自边缘)。
 *
 * 归一口径:
 *   · 回源鉴权匹配 ⇒ 这条请求确实经 EdgeOne,采信它写进 X-Forwarded-For 的那一段;
 *   · 其余来源     ⇒ 只认 TCP 对端(直连攻击者伪造什么头都没用)。
 *
 * 为什么取 XFF **最右**而不是最左:最左是客户端自己整段写进去的(逐跳追加只是理论约定),
 * 最右才是最近一跳(EdgeOne)写的那一段。实测 api_logs 两小时窗口里的客户端 IP 是真实公网
 * 地址(含 IBM Cloud / GitHub 段的扫描源)⇒ EdgeOne 确实在写这个头;覆盖语义下只有一段、
 * 追加语义下最右是它,两种情形取最右都成立。
 *
 * 归一后**删掉其余 IP 类头**:上游没人读它们(实测 apps/api 与 apps/web 零消费点),
 * 留着只是多一个伪造面。Python 侧 conn_guard 优先读 cf-connecting-ip、其次 XFF ——
 * 删掉前者后它自然落到归一后的 XFF 上,无需改 Python。
 */
export const IP_HEADERS_TO_DROP = Object.freeze([
  'x-real-ip',
  'true-client-ip',
  'x-client-ip',
  'cf-connecting-ip',
  'x-original-forwarded-for',
  'forwarded',
])

/** 把 `1.2.3.4:5678` / `[::1]:443` / `1.2.3.4` 归一成裸 IP 字面量;认不出返回空串。 */
export function normalizeIpLiteral(raw) {
  let v = String(raw ?? '').trim()
  if (!v) return ''
  if (v.startsWith('[')) {
    const end = v.indexOf(']')
    if (end > 0) v = v.slice(1, end)
  } else {
    const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(v)
    if (withPort) v = withPort[1]
  }
  return net.isIP(v) ? v : ''
}

/** 从入站 XFF 里取最近一跳写入的那一段;全认不出 ⇒ 空串。 */
export function resolveEdgeClientIp(headers) {
  const raw = headers ? headers['x-forwarded-for'] : undefined
  const joined = Array.isArray(raw) ? raw.join(',') : typeof raw === 'string' ? raw : ''
  const parts = joined
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const v = normalizeIpLiteral(parts[i])
    if (v) return v
  }
  return ''
}

/**
 * 构造发给上游的请求头。
 *
 * 三档都做 IP 归一:出站 X-Forwarded-For 恒为**单段、不可伪造**的客户端 IP。
 *   · 回源鉴权匹配    ⇒ 采信 EdgeOne 写进 XFF 的最近一跳;
 *   · 对端为本机回环  ⇒ 采信 cloudflared 注入的 CF-Connecting-IP(隧道形态的唯一真源);
 *   · 其余(直连源站) ⇒ 只认 TCP 对端。
 * 注:off 档此前"原样返回"以维持"零行为变化",但原样透传等于让上游采信客户端自带的
 * XFF(限流键与内网判据可被随意指定),故改为同样归一;off 档仍不做回源验证。
 *
 * 同时注入两个供 API 侧消费的头:
 *   · `x-ihui-client-ip`     —— 归一后的客户端 IP(WS 限流键用它);
 *   · `x-ihui-edge-verified` —— 仅当回源鉴权匹配时置 '1',否则**删除**(入站伪造值不透传)。
 * 这两个头不可被外部伪造:API 只监听 127.0.0.1,能连进来的只有本机 router。
 *
 * @param {object} input
 * @param {Record<string, unknown>} input.headers     入站请求头
 * @param {string} input.remoteAddress                TCP 对端(不可伪造)
 * @param {'off'|'observe'|'enforce'} input.edgeMode  回源鉴权档位
 * @param {string} input.edgeReason                   decideEdgeGuard 给出的 reason
 * @returns {Record<string, unknown>}
 */
export function buildForwardHeaders({
  headers,
  remoteAddress,
  edgeMode,
  edgeReason,
  // 仅内部路由(只监听回环、上游只能来自可信公网路由)传 true:把公网路由 8801 经回源鉴权后
  // 注入的 verified 标记原样透传,使"已验证"结论一路带到 API 上游实例 —— ai-service 的
  // per-user 连接/握手限流要靠它拿到真实客户端 IP。
  //   公网路由 8801 自身必须传 false —— 它的上游是开放互联网(cloudflared 在本机以 127.0.0.1
  //   连入,故不能靠 isLoopback 区分),攻击者可在公网请求里自带 x-ihui-edge-verified 骗过,
  //   所以 8801 只认自己比对的 secret,绝不信任入站该头。
  // 角色判定由调用方按 LISTEN_HOST 给出(见 ihui-api-router.mjs),本函数只消费标志。
  trustInboundVerified = false,
}) {
  const out = { ...(headers ?? {}) }
  const socketIp = typeof remoteAddress === 'string' && remoteAddress ? remoteAddress : 'unknown'
  const loopbackPeer = isLoopbackAddress(socketIp)

  // 2026-10-29:cloudflared 隧道在本机以 127.0.0.1 连入(api / ssi / rdp 全走它),
  // 对端恒为回环,真实客户端 IP 只存在于 CF-Connecting-IP。此前把它当"可伪造头"整体删除
  // ⇒ 上游拿到的是 127.0.0.1 ⇒ isPrivateIp 判据失效(实测公网 api.aizhs.top/metrics 返回 200)、
  // 全局限流退化成单桶。直连源站的对端是公网地址,同一个头就是攻击者可控的,故只在对端
  // 为回环(只能来自本机 cloudflared)时采信。
  const cfRaw = headers ? headers['cf-connecting-ip'] : undefined
  const tunnelClientIp = loopbackPeer
    ? normalizeIpLiteral(Array.isArray(cfRaw) ? cfRaw[0] : cfRaw)
    : ''

  // 入站已带 verified ⇒ 来自上游可信路由的真验证(本实例只监听回环时才成立)。
  const inboundVerified = out['x-ihui-edge-verified'] === '1'
  const trusted =
    edgeMode !== 'off' && (edgeReason === 'match' || (trustInboundVerified && inboundVerified))
  const clientIp = (trusted && resolveEdgeClientIp(headers)) || tunnelClientIp || socketIp

  for (const name of IP_HEADERS_TO_DROP) delete out[name]
  // 单段而不是链:上游要的是"这个请求的客户端是谁",不是"谁转发过它"。
  out['x-forwarded-for'] = clientIp
  out['x-ihui-client-ip'] = clientIp
  if (trusted) out['x-ihui-edge-verified'] = '1'
  else delete out['x-ihui-edge-verified']
  // off 档同样做 IP 归一(不再原样返回):归一不是"闸",是身份语义修正 —— off 档下原样
  // 透传等于让上游采信客户端自带的 X-Forwarded-For,那比"没装闸"更糟。回源验证仍不做。
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
