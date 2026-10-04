// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { config } from '../config/index.js'
import { parsePath, matchesAnyPrefix, normalizeHeader } from '../utils/http-normalize.js'
import { isVerifiedInternalMachineCall } from '../utils/internal-principal.js'
import { isServerSignedJwt } from '../utils/csrf-exempt-credential.js'

/**
 * CSRF 防护（双提交 Cookie 模式）。
 *
 * 流程：
 *  1. GET /api/csrf-token 签发 token，同时 set-cookie XSRF-TOKEN（httpOnly）
 *  2. 前端写请求（POST/PUT/PATCH/DELETE）需在 header X-CSRF-Token 带相同 token
 *  3. 服务端校验 cookie 值与 header 一致（用 HMAC 签名防伪造，constant-time 比较防计时攻击）
 *
 * 豁免：
 *  - 安全方法（GET/HEAD/OPTIONS）
 *  - 公开白名单（登录/回调/支付通知等无状态端点）
 *  - 凭据**自证通过**的机器调用（内部密钥 / 服务端签名的 JWT / 库里真实存在的 API Key）
 *
 * ⚠️ 豁免的统一原则（G-373「按凭据存在性豁免」这一型无判据的收口）：
 * **豁免的判据是"该凭据本身经过独立验签/验真"，不是"请求里出现了某个 header/cookie/
 * 查询参数"**。本钩子注册在 onRequest，早于所有路由侧鉴权，所以"真伪由路由侧判"
 * 不能作为豁免理由 —— 那一刻 CSRF 已经整块跳过了。任何新豁免都必须走
 * `hasVerifiedBearerCredential` / `hasVerifiedApiKeyCarrier` / `isVerifiedInternalMachineCall`
 * 这三个验真出口之一，并在注释里写明判据。
 */

const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_TOKEN_TTL = 12 * 3600 // 12 小时（秒）

/**
 * Bearer 头的凭据**形态**判定(不是真伪校验):`ihui_` 前缀 API Key,或三段 base64url 的 JWT。
 *
 * ⚠️ 本函数**只是豁免前的廉价前置筛**,单独用它放行即是"按形态豁免"那一型缺陷
 * (见 `hasVerifiedBearerCredential` 与 utils/csrf-exempt-credential.ts 的立因):
 * 任何人都能拼出 `Bearer aaa.bbb.ccc`。保留它只为两件事:
 *  ① 让明显不是凭据的乱码不必进后面的验签/查库(热路径开销);
 *  ② 供既有镜像测试钉住"形态判据未被放宽"(csrf-internal-machine-call.test.ts 的 E 组)。
 * **豁免的最终判据是验签/验真通过,不是本函数返回 true。**
 */
export function isPlausibleBearerCredential(header: string): boolean {
  const trimmed = header.trim()
  if (!/^bearer\s+\S+/i.test(trimmed)) return false
  const token = trimmed.slice(trimmed.indexOf(' ') + 1).trim()
  if (token.startsWith('ihui_')) return true
  const parts = token.split('.')
  return parts.length === 3 && parts.every((p) => p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p))
}

/** 从 `Authorization` 头取出 Bearer 后的凭据原文;形态不成立返回 undefined。 */
function bearerCredentialOf(header: string | undefined): string | undefined {
  if (!header) return undefined
  const trimmed = header.trim()
  if (!/^bearer\s+\S+/i.test(trimmed)) return undefined
  const token = trimmed.slice(trimmed.indexOf(' ') + 1).trim()
  return token.length > 0 ? token : undefined
}

/**
 * Bearer 凭据是否**已自证**——CSRF 豁免的唯一判据。
 *
 * 两族各自有独立验签机制,任一通过即豁免:
 *  ① JWT(三段 base64)⇒ `isServerSignedJwt`:验 HS256 签名,判据是"本服务端签发过的",
 *     客户端无法伪造。**刻意不验 exp**:过期/封禁/refresh 冒充归路由侧 `authenticate()`
 *     判 401,前端 401→静默续期链路(apps/web/src/lib/api.ts)才接得上;在这里因过期
 *     而拒绝会把 401 变成 CSRF 403,续期分支永不触发。
 *  ② `ihui_` API Key ⇒ `isRegisteredUsableApiKey`:查库确认这把 key 真实存在、active、
 *     未过期。这是真伪判据而非形态判据(形态只需要 `Bearer ihui_` 五个字符)。
 *
 * fail-closed:验签/查库任一不可用(密钥缺失、DB 不可达)⇒ 不豁免,请求继续落到
 * 下方 CSRF 双提交校验,而不是"判不出来就当机器调用放行"。
 */
async function hasVerifiedBearerCredential(header: string | undefined): Promise<boolean> {
  // 廉价前置筛:形态都不成立就不必付验签/查库的开销(不改变判据,见 isPlausibleBearerCredential 注释)。
  if (!header || !isPlausibleBearerCredential(header)) return false
  const token = bearerCredentialOf(header)
  if (!token) return false
  if (token.startsWith('ihui_')) {
    // 动态导入:csrf 插件在 server.ts 主作用域注册,不因一次豁免判定把 DB 依赖拉进加载图
    // (与 utils/internal-principal.ts 对 secretsEqual 的处理同理由)。
    try {
      const { isRegisteredUsableApiKey } = await import('../utils/api-key-presence.js')
      return await isRegisteredUsableApiKey(token)
    } catch {
      return false // fail-closed:判据不可达时拒绝豁免
    }
  }
  return isServerSignedJwt(token)
}

/**
 * Gemini / OpenAI 原生 API Key 载体(`x-goog-api-key` 头、`x-api-key` 头、`?key=` 查询
 * 参数)里携带的 key 是否**已验真**。
 *
 * 这三个载体与 Bearer 头是同一族机器凭据,只是 SDK 生态用不同方式携带。存在性豁免
 * (`headers['x-goog-api-key']` / `typeof query.key === 'string'`)等于把 CSRF 防线
 * 交给"请求里有没有这个字符串",而 `?key=` 连自定义头都不需要 —— 跨站一个表单即可。
 * 故与 Bearer 族共用 `isRegisteredUsableApiKey` 一个判据(查库确认 key 真实存在)。
 *
 * 任一载体验真通过 ⇒ true。全部缺失/验真失败 ⇒ false(fail-closed)。
 */
async function hasVerifiedApiKeyCarrier(request: FastifyRequest): Promise<boolean> {
  const candidates = [
    normalizeHeader(request.headers['x-goog-api-key']),
    normalizeHeader(request.headers['x-api-key']),
    typeof (request.query as { key?: unknown } | undefined)?.key === 'string'
      ? ((request.query as { key: string }).key).trim() || undefined
      : undefined,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0)
  if (candidates.length === 0) return false
  // 动态导入理由同 hasVerifiedBearerCredential(csrf 插件在主作用域注册,不把 DB 拖进加载图)。
  let verify: (key: string | undefined) => Promise<boolean>
  try {
    ;({ isRegisteredUsableApiKey: verify } = await import('../utils/api-key-presence.js'))
  } catch {
    return false // fail-closed:判据不可达时拒绝豁免
  }
  for (const key of candidates) {
    if (await verify(key)) return true
  }
  return false
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** 公开白名单路径前缀（无需 CSRF 校验）。 */
const PUBLIC_PREFIXES = [
  // 认证类（登录/注册/重置/刷新/登出/验证码/SSO/PAT）
  '/api/auth/',
  // SMS Proxy
  '/api/sms-proxy/',
  // OAuth2 token 端点（RFC 6749）
  '/api/oauth/',
  // O7 RFC 7591 动态注册 + OAuth 2.1 token/introspect/revoke:这些是**机器接口**,凭
  // client_id/secret 自证,与浏览器 cookie 会话无关 ⇒ CSRF 在此没有防护对象(防线是
  // grant/凭据校验 + 洪泛闸)。2026-09-21 O17 三通道实跑:先只放开了 `/oauth/register`,
  // 结果 discovery 指出的 `POST /oauth/token` 仍被 403 拦死 ⇒ client_credentials 换不到
  // token,OAuth 通道照样走不通。故整族放开;此前它"能通"只是因为假 Bearer 触发了下面的
  // Bearer 豁免,那是绕过而不是设计。
  '/oauth/',
  // /.well-known/* 发现文档(OAuth/OIDC/A2A 均要求匿名可读)
  '/.well-known/',
  // 服务回调（HMAC/共享密钥，无 JWT）
  '/api/ai/callback',
  // 支付服务端回调（P2 修复 2026-08-06:豁免最小化,仅保留纯回调路径,且入口均有签名/密钥验签）:
  // - wechat/notify + wechat/notify/refund:verifyCallbackSignature 微信平台证书验签
  // - alipay/notify:verifyNotify 支付宝 RSA 验签
  // - paypal/webhook:verifyPaypalWebhook 签名验签
  // - withdrawal/notify + recurring/wechat-notify:verifyCallbackSignature 验签(生产强制)
  // 其余 /api/payments/* 写端点(下单/查询/关单/退款/提现等)均已从豁免名单移除,
  // 它们走 Bearer JWT / auth_token cookie 豁免,未认证请求应返回 401/403 而非绕过 CSRF。
  '/api/payments/wechat/notify',
  '/api/payments/alipay/notify',
  '/api/payments/paypal/webhook',
  '/api/payments/withdrawal/notify',
  '/api/payments/recurring/wechat-notify',
  '/api/tbox/events',
  // IM 网关 webhook 入站(2026-07-31 立,IM 平台调用,用 webhookSecret HMAC 验签,无 CSRF token)
  '/api/im-gateway/webhook/',
  // D30① 无人值守信源(2026-09-25 用户批准挂载):GitHub Actions 机器调用,凭
  // GITHUB_WEBHOOK_SECRET 的 HMAC-SHA256 自证,与浏览器 cookie 会话无关 ⇒ CSRF 在此无防护对象。
  // **刻意写精确整路径而不是 /api/webhooks/ 前缀** —— 前缀会把同族未来路由一起放过
  // (O19 事故原文:参数化前缀连带放开静态子路由,游客打到依赖 request.userId 的 handler 直接 500)。
  // 缺 secret 时该路由回 503、签名错回 401,不存在"豁免即放行"。
  '/api/webhooks/github',
  // D15 GitHub App webhook 入站(2026-09-26 立):GitHub 服务器到服务器的投递,永远不带
  // CSRF token,防线是 X-Hub-Signature-256 的 HMAC-SHA256 验签(fail-closed:缺
  // GITHUB_WEBHOOK_SECRET 回 503、签名缺失/不匹配回 401)—— 与浏览器 cookie 会话无关,
  // CSRF 在此没有防护对象。**刻意写精确整路径而不是 /api/github-app/ 前缀**(纪律同上条):
  // 生产实测(2026-09-26,公网 https://aizhs.top/api/github-app/webhook)POST 被 403
  // `CSRF 令牌缺失或无效` 拦在签名层之前,安装事件/PR 回调全进不来。
  '/api/github-app/webhook',
  // 崩溃上报(2026-08-12 立,匿名可上报,崩溃时未必持有 token;
  // 风险低:仅写 crash_reports 表一条记录,无敏感操作;全局限流防滥用)
  '/api/crash-reports',
  // 下载量统计 track(2026-08-06 立,公开分析端点,匿名用户也记录;
  // 风险低:仅记录点击事件,无敏感操作;anomaly-detector + 全局限流已防自动化滥用)
  '/api/downloads/track',
  // 访问埋点(2026-08-10 立,公开分析端点,匿名访客也上报页面访问;
  // 风险低:仅写 visit_logs 一条访问记录,无敏感操作;全局限流防滥用;
  // 已登录请求走 Bearer JWT 豁免,此白名单主要覆盖未登录访客)
  '/api/visit-tracking/',
  // 行为埋点(2026-08-10 立,公开分析端点,匿名访客也上报行为事件;
  // 风险低:仅写 analytics_events 记录,无敏感操作;全局限流防滥用)
  '/api/analytics/track',
  // P2 修复(2026-08-06):移除 '/api/vip/' 前缀豁免——该前缀下无服务端回调,
  // 全部写端点(purchase/order/levels CRUD/users cancel)均需 authenticate 鉴权,
  // 已登录请求走下方 Bearer JWT / auth_token cookie 豁免,未登录应返 401 而非绕过 CSRF。
  // 2026-07-28 加固:本地工作区文件浏览是 read-only(列目录结构/打开文件夹),
  // 由 fsBridge 处理,无副作用;同时已有 requireAuth 鉴权(workspace-ai.ts:84),
  // CSRF 校验在此是冗余(主要防 csrf 利用已登录 cookie,但 browse 无副作用可攻击),
  // 跨端口 fetch 8801->8802 cookie 传递链路脆弱,直接豁免避免误伤合法用户
  '/api/workspace/fs/',
  // 同源嵌入代理(2026-09-02 立,WorkPanel 内嵌浏览器):无状态开放代理,仅取回并重写目标页,
  // 不写库/不改状态/不读本站 cookie;POST 仅供嵌入式第三方页面表单提交(iframe 拿不到 CSRF token)。
  // 若依赖已登录豁免,反而会在嵌入第三方站点时把本站 cookie 带到请求里,语义更差;
  // 现有防线已足够:SSRF 主机拦截(localhost/私网/链路本地/ULA,含重定向落点复检)+ 每 IP 60s/120 次限流。
  '/api/embed-proxy',
]

function secret(): string {
  return config.JWT_SECRET
}

/**
 * 生成 CSRF token 与 cookie 值。
 * 格式: token = "<sig>.<expiry>.<nonce>"，cookie = hex(sig|expiry|nonce)
 */
function generateCsrfToken(): { token: string; cookieValue: string } {
  const nonce = randomBytes(16).toString('base64url')
  const expiry = Math.floor(Date.now() / 1000) + CSRF_TOKEN_TTL
  const msg = `${expiry}|${nonce}`
  const sig = createHmac('sha256', secret()).update(msg).digest('hex')
  const token = `${sig}.${expiry}.${nonce}`
  const cookieValue = Buffer.from(`${sig}|${expiry}|${nonce}`, 'utf8').toString('hex')
  return { token, cookieValue }
}

/** 校验 header token 与 cookie 值一致且签名有效。 */
function verifyCsrfToken(token: string | undefined, cookieValue: string | undefined): boolean {
  if (!token || !cookieValue) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [sig, expStr, nonce] = parts as [string, string, string]
  const expiry = Number(expStr)
  if (!Number.isInteger(expiry) || expiry < Math.floor(Date.now() / 1000)) return false

  let raw: string
  try {
    raw = Buffer.from(cookieValue, 'hex').toString('utf8')
  } catch {
    return false
  }
  const cookieParts = raw.split('|')
  if (cookieParts.length !== 3) return false
  const [sigB, expB, nonceB] = cookieParts as [string, string, string]
  if (expB !== expStr) return false

  // constant-time 比较 nonce
  const a = Buffer.from(nonce)
  const b = Buffer.from(nonceB)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false

  // 重算签名并比较
  const expected = createHmac('sha256', secret()).update(`${expiry}|${nonce}`).digest('hex')
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return timingSafeEqual(sigBuf, expBuf) && timingSafeEqual(Buffer.from(sig), Buffer.from(sigB))
}

export interface CsrfPluginOptions {
  /** 额外的公开白名单路径前缀。 */
  publicPrefixes?: readonly string[]
}

const csrfPlugin: FastifyPluginAsync<CsrfPluginOptions> = async (
  server: FastifyInstance,
  opts: CsrfPluginOptions,
) => {
  // 2026-08-14 P0 修复:server.ts 主作用域已注册 @fastify/cookie(line 292),
  // csrfPlugin 用 fp 包装,运行在主作用域,自动继承 cookie 装饰器,无需重复注册。
  // 之前 "await server.register(cookie)" 看似有 try/catch 跳过逻辑,实则 avvio 在
  // 插件加载时把 FST_ERR_DEC_ALREADY_PRESENT 升级为 unhandled rejection,try/catch
  // 捕不到 → API 启动失败 → 自动登录修复无效。直接删除冗余 register。

  const publicPrefixes = [...PUBLIC_PREFIXES, ...(opts.publicPrefixes ?? [])]

  // GET /api/csrf-token：签发 token + cookie
  server.get('/api/csrf-token', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { token, cookieValue } = generateCsrfToken()
    reply.setCookie(CSRF_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      // G-998138:档位经 config 的唯一出口(生产 config 恒带 isDevelopmentRuntime,
      // 缺省 fail-safe 为 secure;旧测试 mock 的 config 形状缺该字段 ⇒ 按旧判据回退)
      secure: !(config.isDevelopmentRuntime ?? config.NODE_ENV === 'development'),
      path: '/',
      maxAge: CSRF_TOKEN_TTL,
    })
    return { code: 0, message: 'success', data: { csrfToken: token } }
  })

  // 写请求校验 CSRF
  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase()
    if (SAFE_METHODS.has(method)) return

    const url = parsePath(request.url)
    // 公开白名单豁免
    if (matchesAnyPrefix(url, publicPrefixes)) {
      return
    }
    // Bearer 请求豁免（JWT 本身防 CSRF）
    // 2026-09-21 O17 三通道实跑收紧:原来只判前缀,任何 `Authorization: Bearer 乱码`
    // 都能整块跳过 CSRF —— 对"公开但要写状态"的端点(如 RFC 7591 动态注册)这就成了
    // 免死金牌。
    // 2026-10-04 再收口(G-373「按凭据存在性豁免」型):形态判据本身仍是无判据 ——
    // `Bearer aaa.bbb.ccc` 任何人都会拼。豁免的判据改为**该凭据自证通过**
    // (JWT 验签 / API Key 查库),见 hasVerifiedBearerCredential。
    const auth = request.headers.authorization ?? ''
    if (await hasVerifiedBearerCredential(auth)) return

    // auth_token cookie 鉴权豁免（与 auth 插件一致）
    // 2026-10-04 修(G-373 同型):原 `if (authToken) return` 是**纯存在性豁免** ——
    // cookie 里是空串以外的任何值(攻击者自造一个 `auth_token=x` 即可,或跨站场景下
    // 任何非空 cookie)都整块跳过 CSRF。cookie 里的 token 同样是服务端签发的 JWT,
    // 故判据与 Bearer 族同源:验签通过才豁免。
    // 不验 exp 的理由同 hasVerifiedBearerCredential:过期由路由侧 authenticate() 判 401,
    // 前端 401→静默续期链路依赖这个 401;提前拒绝会把续期场景变成 CSRF 403。
    const authToken = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies
      ?.auth_token
    if (authToken && (await isServerSignedJwt(authToken))) return

    // Internal service token 请求豁免(服务间调用,非浏览器,无 CSRF 风险)
    // ⚠️ #23 收口(2026-09-27):原先这里是 `if (request.headers['x-internal-service-token'])
    // return` —— **头名在场即豁免**,等于把防线换成一个字符串:任何进程带这个头(值随意)
    // 就能整块跳过 CSRF。现要求密钥**验真通过**才豁免,判定与路由侧
    // (internal-service-token.ts 的 checkInternalServiceToken / agent-control.ts /execute)
    // 共用 utils/internal-principal 这一份实现(secretsEqual 定长散列 + timingSafeEqual,
    // 密钥未配置时 fail-closed)。覆盖两族内部凭据:
    //  ① X-Internal-Service-Token == AI_CALLBACK_SECRET(ai-service → /api/memory 等);
    //  ② Authorization: Bearer == AGENT_CONTROL_INTERNAL_SECRET(控制面 /execute)。
    //  第 ② 族正是 #23 现场:裸密钥既非三段 JWT 也非 `ihui_` 前缀,走不到上面的
    //  isPlausibleBearerCredential 形态豁免,而本钩子注册在 **onRequest**(早于路由
    //  preHandler/handler 内的鉴权),于是合法内部调用被 403 拦在自己的密钥校验之前。
    //  这不是按路径放行:同一请求换一把错密钥即不豁免,继续落到 CSRF/路由双层拒。
    if (await isVerifiedInternalMachineCall(request)) return

    // Gemini 协议入站豁免(2026-09-13):Gemini SDK 默认用 x-goog-api-key 头或
    // ?key= 查询参数携带 API Key(非浏览器自动携带的凭证,与 Bearer 同级防 CSRF),
    // 且该鉴权映射发生在路由 preHandler(mapGeminiAuth),晚于本钩子——不豁免
    // 会被 403 拦死,外部 Gemini SDK 客户端无法接入 /v1beta。
    // 2026-10-04 修(G-373 同型):原写法 `if (headers['x-goog-api-key']) return` 与
    // `if (typeof query.key === 'string') return` 是**教科书式的存在性豁免** ——
    // 带上头/带上 ?key= 就跳过 CSRF,值是什么完全不看。而且这一族比内部凭据更糟:
    // `?key=` 在 URL 里,跨站只需一个 <a>/表单就能带上,不需要任何"能发自定义头"的前提。
    // 判据改为与 Bearer 族同源的**验真**:这把 key 必须在 developer_api_keys 里真实存在、
    // active、未过期(与 mapGeminiAuth → requireApiKeyAuth 的前置条件一致,只是提前判)。
    // fail-closed:查库不可达 ⇒ 不豁免。
    // 只看这三个 Gemini/OpenAI 原生载体(Authorization 头已由上方 Bearer 族判过)。
    if (await hasVerifiedApiKeyCarrier(request)) return

    const cookieValue = (request as FastifyRequest & { cookies?: Record<string, string> })
      .cookies?.[CSRF_COOKIE_NAME]
    const rawHeader = request.headers[CSRF_HEADER_NAME]
    const headerToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader

    if (!verifyCsrfToken(headerToken, cookieValue)) {
      return reply.status(403).send({
        code: 403,
        message: 'CSRF 令牌缺失或无效',
      })
    }
  })
}

export default fp(csrfPlugin, {
  name: 'csrf-plugin',
  fastify: '5.x',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
