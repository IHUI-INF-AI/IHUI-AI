// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中继出网代理分流(2026-10-23 立)。
 *
 * 背景(全部实测,2026-10-23 深夜):
 * 本机海外出网被掐——api.openai.com / generativelanguage.googleapis.com 直连恒超时
 * (curl 000),号池 openai/gemini 两把 key 因此长期 degraded(健康检查判据:超时/网络错误
 * = degraded,见 relay-health-check-service.ts),转发器对这两个 host 的请求也全部失败。
 * 本机有 Clash Verge(verge-mihomo,mixed-port 7897):「联通优化 直连0.3x」节点实测可达
 * (openai 401/403 = 已到达只是探针没带 key;gemini 403 = 已到达),但普通节点
 * (HK/SG/JP/US)对 OpenAI 全灭(0/4),0.3x 航空线拥塞(约 50% 成功率,对照 gstatic
 * 同样抖 ⇒ 是线路质量问题,不是域名封锁)。
 *
 * 设计:**只让被墙 host 走代理,其余全部直连**——
 * - `RELAY_PROXY_URL` 空(缺省)= 不装配任何东西,行为与从前逐字节一致;
 * - `RELAY_PROXY_HOSTS` 逗号分隔 host 名单(缺省见 DEFAULT_PROXY_HOSTS),命中(含子域)
 *   才走代理;
 * - 未命中 host 的流量永远直连——代理挂了也不影响它们(它们本来直连就通),
 *   不会把国内 provider 或整个中继的可用性绑到本地代理软件上;
 * - 全局 dispatcher 一次装配,健康检查器等走内置 fetch 的调用点自动生效;
 *   上游转发器 2026-10-29 起**直连分支自带守卫② dispatcher**(未装配代理时),
 *   已装配时仍交给本全局 dispatcher —— 届时它会绕开代理腿,不得覆盖。
 *
 * 名单演进(全部实测):
 * - 2026-10-23 首立:api.openai.com / generativelanguage.googleapis.com(直连恒 000);
 * - 同日追加:api.groq.com(真直连 000,Clash 5 轮 2 通≈40%)、apihub.agnes-ai.com
 *   (真直连 000,Clash 5 轮 1 通≈20%)——直连 0% ⇒ 走代理严格更优,航空线拥塞是线路
 *   质量问题(换节点/升套餐可提升,非代码可解);llm7 两条路都不通(上游自身抖)
 *   刻意不进名单——API 服务直连反而时通。
 *
 * 实现走 undici 公开 API:`Agent.compose(interceptor)` 返回正规 ComposedDispatcher,
 * 拦截器只按 origin 换 dispatcher,不碰 body/handler;fetch 对全局 dispatcher 只调
 * `.dispatch()`(undici 8.10.1 lib/web/fetch/index.js 实测),compose 产物满足该面。
 */
import { Agent, ProxyAgent, setGlobalDispatcher } from 'undici'
import { logger } from '../utils/logger.js'
import { relayGuardedLookup } from '../utils/relay-egress-guard.js'

/**
 * 默认被墙 host 名单(2026-10-23 实测直连恒失败确认;新增被墙 host 也可走环境变量
 * RELAY_PROXY_HOSTS 追加,不必改代码)。注意命中名单只意味着"值得走代理试",不保证
 * 代理一定通——航空线拥塞下 groq≈40%、agnes≈20%,仍严格优于直连的 0%。
 */
const DEFAULT_PROXY_HOSTS = [
  'api.openai.com',
  'generativelanguage.googleapis.com',
  'api.groq.com',
  'apihub.agnes-ai.com',
]

let installed = false

/** 代理分流是否已接管出网。调用侧据它决定要不要自带 dispatcher(自带会绕开代理腿)。 */
export function isRelayOutboundProxyInstalled(): boolean {
  return installed
}

/**
 * host 是否命中代理名单(纯函数,供测试与运行时同源复用)。
 * 精确相等或子域(`.` 边界)才算命中;名单 host 自身的小写形式由调用方归一。
 */
export function hostNeedsProxy(host: string, hosts: readonly string[]): boolean {
  const h = host.toLowerCase()
  return hosts.some((x) => h === x || h.endsWith(`.${x}`))
}

/** 进程启动时装配一次(幂等)。未配置 RELAY_PROXY_URL 时静默跳过。 */
export function installRelayOutboundProxy(): void {
  if (installed) return
  const proxyUrl = process.env.RELAY_PROXY_URL?.trim()
  if (!proxyUrl) return

  const hosts = (process.env.RELAY_PROXY_HOSTS?.trim() || DEFAULT_PROXY_HOSTS.join(','))
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  if (hosts.length === 0) return

  const proxyAgent = new ProxyAgent(proxyUrl)
  // 直连分支同样挂连接期守卫(2026-10-29):首跳复检与真正建连之间留着 DNS rebinding 窗口,
  // 未命中名单的 host 走的是本机解析 ⇒ 这一支和"没配代理"时一样需要 connect.lookup 钩子。
  const directAgent = new Agent({ connect: { lookup: relayGuardedLookup } })
  const needsProxy = (origin: string | URL): boolean => {
    try {
      return hostNeedsProxy(new URL(origin).hostname, hosts)
    } catch {
      // origin 解析不了 ⇒ 保守直连(代理是逃生通道,不是默认通道)
      return false
    }
  }

  const dispatcher = directAgent.compose(
    (dispatch) => (options, handler) =>
      needsProxy(options.origin ?? '')
        ? proxyAgent.dispatch(options, handler)
        : dispatch(options, handler),
  )
  setGlobalDispatcher(dispatcher)
  installed = true
  logger.info(
    `[relay-outbound-proxy] 已装配出网代理分流: ${hosts.join(', ')} → ${proxyUrl}(其余 host 直连)`,
  )
}
