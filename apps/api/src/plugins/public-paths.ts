// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公开面单一真相源(BUG-4 根治)。
 *
 * 此前"哪些路径属于公开面"在三处各写了一份清单,且匹配语义彼此不一:
 *   · `plugins/auth-default-deny.ts` —— 兜底鉴权闸的公开名单,用 `path === p || path.startsWith(p)`
 *     (无段边界,`/api/agents` 会顺带放过 `/api/agentsXYZ`);
 *   · `plugins/tenant.ts` —— 租户隔离绕过的公开名单,用 `matchesPrefix`(段边界安全);
 *   · `server.ts` —— 网络分段的公开名单,用 `url.startsWith(p)`(无段边界)。
 * 三份不同源 + 两种匹配语义 ⇒ 漏登记一处就整链 401,多登记又让相邻未注册路径被误免鉴权。
 *
 * 根治(单一真相源 + 单一匹配原语):
 *   1. 三份清单**同源共存于本模块**,新增/调整公开面只改这一处,不再三文件各写一份、各漂各的;
 *   2. 三份都统一走 `matchesPrefix`(已在 `utils/http-normalize.ts` 实现、段边界安全、tenant.ts 已验证)
 *      —— 根除 `startsWith` 无段边界的毛病,`/api/agents` 不再顺带放过 `/api/agentsXYZ`。
 *
 * 三份清单的语义边界(故意不盲目合并):
 *   · `AUTH_PUBLIC_*` —— 兜底鉴权闸用:无凭据也放行(不需要登录)。这是"真实公开面"的权威定义。
 *   · `TENANT_BYPASS_*` —— 租户隔离绕过用:不强制 X-Tenant-Id / 租户存在性。
 *   · `NETWORK_PUBLIC_*` —— 网络分段用:不注入内网隔离,保持公网可达。
 * 三者是**不同维度**的公开性(`/api/settings` 可"免租户"却仍"需登录"),故分列;但同住一模块、
 * 同用一把尺,既消除漂移,又不破坏各维度的安全语义(如 `/api/settings/contact` 仍须登录)。
 *
 * 段边界约定(由 `matchesPrefix` 强制):
 *   · 带尾斜杠的前缀(`/api/auth/`)→ 仅 `startsWith`(含自身及所有子段);
 *   · 裸前缀(`/api/agents`)→ 精确匹配自身,或 `startsWith(prefix + '/')`(子段),**绝不**顺带放过
 *     `/api/agentsXYZ` 这类"同前缀兄弟路径"。
 *   · 精确集合只匹配自身——`/` 必须在精确集合里,一旦放进前缀集合会退化成"匹配一切"。
 */
import { matchesPrefix } from '../utils/http-normalize.js'

/**
 * 兜底鉴权闸的公开面(权威"真实公开面")。
 * 仅当"这条路径没有、也不需要登录"时才列于此;有凭据或自己的 preHandler 鉴权的路由不应出现。
 */
export const AUTH_PUBLIC_EXACT_PATHS: ReadonlySet<string> = new Set([
  '/',
  '/health',
  '/ready',
  '/live',
  // 探活别名族(2026-11-17):纯文本、免鉴权,与 /health 同语义
  '/ping',
  '/healthz',
  '/livez',
  '/readyz',
  '/metrics',
  '/business-metrics',
  '/api/health',
  '/api/metrics',
  '/api/business-metrics',
  '/api/csrf-token',
  '/api/landing',
  '/api/version',
  '/.well-known/agent.json',
  '/.well-known/agent-card.json',
  '/.well-known/apple-app-site-association',
  '/.well-known/assetlinks.json',
  '/api/configs',
  '/api/announcements',
  '/api/ai-education/teacher-certification',
  '/api/docs',
])

/** 兜底鉴权闸的公开前缀(段边界安全)。 */
export const AUTH_PUBLIC_PREFIX_PATHS: readonly string[] = [
  // 探活与指标
  '/api/health/',
  // 静态与公开文件
  '/uploads/',
  '/api/oss/public/',
  '/api/public/',
  // 登录/注册/OAuth/SSO 入口(各端点自己决定要不要凭据)
  '/api/auth/',
  '/api/oauth/',
  '/oauth/',
  '/api/sso/',
  // 外部平台回调(签名校验,不走 JWT)
  '/api/callback/',
  '/api/webhooks/',
  '/api/payments/',
  '/api/payment/',
  '/api/cozeZhsApi/',
  // GitHub App webhook(HMAC 验签,匿名到达)
  '/api/github-app/',
  // 微信智联本地桥 webhook:账号级 secret 验签,桥不带 JWT/租户头;
  // 只放这一条前缀,账号/消息/发送等管理面仍走登录闸(同前缀已列租户豁免)
  '/api/wechat-hub/webhook/',
  // 协议发现
  '/.well-known/',
  // 机器面(API Key 自证;requireApiKeyAuth 会写 request.apiKey)
  '/v1/',
  '/v1beta/',
  '/api/mcp',
  // 公开市场与公开内容
  '/api/agents',
  '/api/categories',
  '/api/landing',
  '/api/voice/',
  '/api/crash-reports',
  // 文档详情 `/api/docs/:slug`(尾斜杠是段边界:不会顺带放过 `/api/docs-xyz` 或 `/api/admin/docs`)
  '/api/docs/',
  // 门户落地页 / 首页内容聚合 / 分类字典缓存
  '/landing',
  '/api/feature-center/',
  '/api/ai-world/',
  '/api/cache/agent-category-dict/',
  // 客户端启动即调的版本检查(注释自述"公开")与新闻列表
  '/api/app-version/',
  '/api/news/',
  '/api/news',
  '/api/articles',
  '/api/tools',
  '/api/help/',
  '/api/ai-feed/',
  '/api/live/',
  '/api/vip/levels',
  '/api/circles',
  '/api/relay/models/public',
  '/api/relay/monitor/',
  // 实时汇率快照(2026-11-14 立):全站金额 USD/CNY/USDT 切换,匿名页面冷启动即调;
  // 只读 GET、无用户数据,与 TENANT_BYPASS_PREFIX_PATHS 同前缀登记。
  '/api/exchange-rates/',
  '/api/model-leaderboard',
  '/api/learn/',
  '/api/teacher/',
  '/api/exam/papers',
  // 匿名埋点:未登录访客也要上报浏览,否则漏斗整段缺失
  '/api/analytics/track',
  '/api/visit-tracking/',
  // 路由自身已显式豁免的探活
  '/api/knowledge/health',
]

/**
 * 租户隔离绕过的公开面:不带 X-Tenant-Id / 不强制租户存在性即放行的路径。
 * 与鉴权公开面是不同维度(可"免租户"却仍"需登录",如 `/api/settings`)。
 */
export const TENANT_BYPASS_PREFIX_PATHS: readonly string[] = [
  // 顶层探活/存活口:dev-stack 的 api 探针、部署守护、外部监控都直接打 /health,
  // 且**不携带**任何租户头。TENANT_STRICT_MODE 缺省即严格后,不列在这里就等于
  // 让探针稳定收到 401 ⇒ dev-stack 判 api 假死并等满 240s 超时(2026-11-10 实测:
  // dev 启动被卡 4 分钟,页面明明可用)。健康检查与租户身份无关,必须免租户。
  '/health',
  '/api/health',
  '/api/auth/',
  '/api/sms-proxy/',
  // 短信厂商回调:只放完整路径,不放 /api/sms/callback/ 前缀(否则今后往该前缀下加写端点会
  // 自动继承"免租户"待遇;TENANT_STRICT_MODE 开 true 时回执整条链当场 401)。
  '/api/sms/callback/tencent',
  '/api/sms/callback/tencent/status',
  '/api/sms/callback/tencent/reply',
  '/api/oauth/',
  '/api/payments/',
  '/api/ai/callback',
  // 信源入口:同 ai-callback 属"机器回调",调用方不携带租户头(带 HMAC 签名);只放完整路径。
  '/api/webhooks/github',
  // RP-40 超工 webhook 回调落账:同为机器回调(HMAC 验签),只放该端点前缀,
  // 不顺带放过 /api/super-agent/ 其余需登录面。
  '/api/super-agent/webhook-callback/',
  '/api/tbox/events',
  // 客户端启动即调的版本检查:小程序/Web 冷启动在登录前就要读 check-update,调用方不带租户头。
  // 该前缀已同时列于 AUTH_PUBLIC_PREFIX_PATHS(免登录);此处补免租户,否则 TENANT_STRICT_MODE
  // 缺省严格后启动即 401。双清单一致性由 public-paths.test.ts 的回归锁钉住(2026-11-11 立)。
  // App 内更新卡 / 站点下载栏的版本检查:匿名客户端启动即调、SSR 解析腿(填 downloads.json)
  // 也调,均无可带的租户标识;且 app_version 表无 tenant 列、/latest 路由读侧不查租户 ——
  // 该端点本就设计为「公开 + 不分租户」。漏列这里 ⇒ 严格租户闸稳定 401 ⇒ 下载栏 android/mobile
  // 落 snapshot/registry-unreachable、App 更新卡 /latest 误判 undetermined(2026-11-11 实测两族 29 封/7 天)。
  // 与 AUTH_PUBLIC_PREFIX_PATHS 同前缀登记,免登录且免租户,与端点语义对齐。
  '/api/app-version/',
  // 公开内容面:tools / news / articles / announcements 的**读端点**是免登录公开内容
  // (已列于 AUTH_PUBLIC_PREFIX_PATHS),客户端未登录冷启动即调;后端 handler 不按 tenantId
  // 过滤(全局共享内容,非租户隔离数据)。补免租户,否则 TENANT_STRICT_MODE 缺省严格后
  // 未登录冷启动拉取这些列表即 401(2026-11-11 线上实测:/api/tools、/api/news、/api/articles、
  // /api/announcements 均返回"多租户严格模式已启用"401)。
  // 安全边界:前缀豁免只免"租户校验",**不免鉴权**——各前缀下的写端点(增删改)仍挂
  // requireAdmin / requireAuth,读端点本就公开无租户数据可泄露,故前缀豁免不打穿任何面。
  '/api/tools',
  '/api/news',
  '/api/articles',
  '/api/announcements',
  // 讲师目录(公开读):与 /api/learn/ 同属课程内容面,浏览器端不携带租户头;
  // 关注写端点自带 requireAuth,免租户不免鉴权。
  '/api/teacher/',
  // OpenAI 兼容机器面(API Key 自证身份):调用方只会带 Authorization/X-Api-Key,**不带**租户头,
  // 典型如 ai-service 的模型连通性探测与平台中转模型(workbuddy/*)调用。TENANT_STRICT_MODE 缺省
  // 即严格后,不在这里豁免就等于让这 33 个模型全线 401(2026-11-11 实测:带租户头 200、不带 401)。
  '/v1/',
  '/v1beta/',
  /**
   * WebSocket 全族(2026-11-12 立,根因级)。
   *
   * 病灶不是"漏登记某一条 /ws 路径",而是**传输层事实**决定的结构性冲突:
   *   · 租户标识只有两条载体——`X-Tenant-Id` header 或子域名(`tenant.ts:26-46`);
   *   · 浏览器发起的 WebSocket 握手**无法**自定义 header(WHATWG 规范禁止),凭据只能挂
   *     query(`?token=`);而域名侧 `api.aizhs.top` 的 `api` 是 `RESERVED_SUBDOMAINS` 成员,
   *     `resolveTenantIdentifier` 对它恒返回 null ⇒ 严格模式下**任何**浏览器 WS 握手必 401,
   *     与是否登录无关。
   * 实测(本机 8802,2026-11-12):`/ws/relay/chat?token=probe`、`/ws/notifications?token=probe`
   * 均返回 `{"code":401,"message":"多租户严格模式已启用…"}`,而补 `X-Tenant-Id` 头后立刻越过
   * 该闸(落到 404「租户不存在」)——证明租户层是唯一阻断点,也证明浏览器无解。
   * 影响面不止本次的号池通道:平台 16 条 WS 路由(/ws/notifications、/ws/agent/stream、
   * /ws/messages、/ws/tasks/:taskId…)在严格模式下一律不可用。
   *
   * 为什么豁免不降低安全性(三条已核事实,不是"大概没问题"):
   *   1. **免租户 ≠ 免鉴权**:每条 /ws 路由都自带 `wsUpgradeRequiresCredential()` 挡无凭据
   *      握手 + `wsAuth()` 验签/注销态/并发限速(/ws/relay/chat 见 ws-relay-chat.ts:76-86);
   *      且 `/ws/` **不在** `AUTH_PUBLIC_PREFIX_PATHS` 里,兜底鉴权闸的语义面不受影响。
   *   2. **WS 面无租户数据**:`request.tenantId` 在全部 ws-*.ts 中零引用(全仓 grep 证实),
   *      这些端点按 userId 隔离,不存在"豁免后跨租户串数据"的路径。
   *   3. **段边界安全**:尾斜杠条目经 `matchesPrefix` 只覆盖 `/ws/` 子段,`/wsXYZ` 不放行。
   *
   * 结论:租户隔离套在用户级长连接面上属**维度错配**——它零安全收益,却让整族浏览器 WS
   * 结构性不可达。故按"免租户、强制自验凭据"口径统一豁免,而非逐条打补丁。
   * 回归锁:public-paths.test.ts「WS 全族必须免租户、且免租户不免鉴权」逐条钉死。
   */
  '/ws/',
  /**
   * 个人号池面(2026-11-12 立,与 `/ws/` 同批实测暴露)。
   *
   * 事实:浏览器端**从不携带** `X-Tenant-Id`(全仓 `apps/web` + `packages/api-client`
   * 零引用该 header),而租户闸只认 header/子域 ⇒ 该面在严格模式下恒定 401。
   * 实测(本机 8801/8802 双路,带真实 admin 登录态 Bearer):
   * `GET /api/account-pool/models` → `{"code":401,"message":"多租户严格模式已启用…path=/api/account-pool/models"}`。
   * 后果不是"某个接口报错",而是**号池模型在选择器里根本拿不到** ⇒ 用户永远选不到号池通道,
   * 本次接入整条链路在浏览器里等于不存在。
   *
   * 为什么整段前缀豁免而不是逐条补:
   *   · 该前缀下 8 条路由(列表/新增/改/删/签到/状态/概览/模型)全部由 account-pool.ts 的
   *     插件作用域 `preHandler` 强制登录,逐条补必然在下一次新增端点时再漏一次;
   *   · 数据维度是 **userId**,不是 tenant:`ai_relay_account_pool` 与
   *     `ai_relay_account_usage_ledger` 均**无** tenant 列(全表列枚举证实);service 层出现的
   *     `extractTenantId(token)` 是 **trae 上游 token 里的租户**,与平台多租户无关;
   *   · 免租户 ≠ 免鉴权:整段仍走登录闸,且该前缀**不在** AUTH_PUBLIC_PREFIX_PATHS,
   *     兜底鉴权闸的语义面不受影响(与既有的 `/api/settings` 同构:免租户、需登录)。
   * 段边界:裸前缀经 `matchesPrefix` 只覆盖自身与 `/api/account-pool/…` 子段,
   * `/api/account-poolXYZ` 不放行。
   * 回归锁:public-paths.test.ts「个人号池面免租户、且免租户不免鉴权」。
   */
  '/api/account-pool',
  /**
   * Subagent 派单 / Swarm 拓扑面(2026-11-23 立,与 `/api/account-pool` 同型)。
   *
   * 事实:浏览器端**从不携带** `X-Tenant-Id`(全仓 web + api-client 零引用),租户闸只认
   * header/子域名 ⇒ TENANT_STRICT_MODE 缺省严格下,`GET /api/subagents/active|topology`
   * 即使带**有效 admin Bearer** 也恒 401。实测(本机 8802,2026-11-23):
   * `Authorization: Bearer <有效 accessToken>` + `/api/auth/me` 200,但
   * `/api/subagents/active` 返回 `{"code":401,"message":"多租户严格模式已启用…"}`。
   *
   * 后果不是"一个面板没数据":这两个端点由 `use-subagent-dispatch` 每 5s 轮询,401 会触发
   * api-client 的 401 续期腿,按 `REFRESH_SUCCESS_REUSE_MS=10s` 节拍不断轮转 refresh token;
   * 旧 refresh token 迟到重放超过 30s 即被判 reuse ⇒ `revokeRefreshTokenFamily(familyId)`
   * ⇒ 桌面端登录态整族消失。本条是"登录态莫名丢失"的直接根因,不是旁支。
   *
   * 为什么整段前缀豁免:该前缀下路由(active/all/topology/stats/queue/collaboration/roles/
   * evolution/auto-plan…)全部由 `subagent-dispatch.ts` 的 `requireAuth` 或 extended 插件
   * 的登录闸强制鉴权;数据维度是 **userId**(`isDispatchVisibleTo` / `isAdminViewer`),不按
   * tenant 过滤,豁免租户不损任何隔离。免租户 ≠ 免鉴权:该前缀**不在**
   * `AUTH_PUBLIC_PREFIX_PATHS`,兜底鉴权闸语义不变(与 `/api/account-pool`、`/api/settings`
   * 同构:免租户、需登录)。
   *
   * 段边界:裸前缀经 `matchesPrefix` 只覆盖自身与 `/api/subagents/…` 子段,
   * `/api/subagentsXYZ` 不放行。回归锁:public-paths.test.ts「Subagent 面免租户、不免鉴权」。
   */
  '/api/subagents',
  /**
   * Agent 端能力上报面(2026-11-23 立,与 `/api/subagents` 同批实测暴露)。
   *
   * `POST /api/agent-control/capability` 是桌面端/扩展每 60s 上报端能力的固定腿,
   * 浏览器端同样不带 `X-Tenant-Id`。实测(本机 8802,带有效 admin Bearer)：
   * `POST /api/agent-control/capability` → `TENANT_REQUIRED` 401,而同 token 的
   * `/api/auth/me` 200。该 401 同样会触发 refresh token 轮转,是 subagents 之外
   * 第二条把 family 推向 reuse 吊销的固定腿。
   *
   * 数据维度:`agent-control.ts` 的 `/capability` 用 `checkAuth` 拿 `request.userId`,
   * `/execute` 只认内部密钥或 JWT 主体;`_endpoints` 是进程内 Map,不带 tenant 列。
   * 免租户不损隔离;该前缀不在 `AUTH_PUBLIC_PREFIX_PATHS`,鉴权仍由路由自身强制。
   * 段边界:裸前缀只覆盖 `/api/agent-control` 与子段,不放行 `/api/agent-controlXYZ`。
   */
  '/api/agent-control',
  /**
   * 第一方 Web 用户面(2026-11-23 系统性补齐)。
   *
   * 事实:浏览器端从不发 `X-Tenant-Id`,而 `TENANT_STRICT_MODE` 缺省即严格;`tenant.ts`
   * 实际只认 header/子域名(报文里的"或 Authorization"并未实现)。于是所有**按 userId
   * 隔离、但漏登记租户豁免**的第一方端点都会在登录后仍 401。本轮用真实 admin Bearer
   * 逐条实测出下列全族(括号内为 24h 内 401 计数),它们的数据维度均为 userId,
   * 对应 route 文件对 `request.tenantId` 的引用数 = 0(现读):
   *   /api/notifications(1043)、/api/chat/conversations(801)、
   *   /api/user/llm-configs(1004)、/api/workspace/permission/requests(119)、
   *   /api/analytics/track(265)、/api/visit-tracking/(86)、
   *   /api/model-leaderboard(40)、/api/ai-feed/(4+4)、/api/live/(4)、
   *   /api/oauth-keys/(22)、/api/agents(22)、/api/users/me(6)、
   *   /api/admin/news(277)、/api/v1/codebase/(42)。
   * 这些 401 里有非 GET 请求,会直接触发 web 的"登录弹窗";同时每个 401 都会走
   * api-client 续期腿,是 refresh token 轮转/整族吊销的第二大来源。
   *
   * 安全边界(逐条现读,不是"大概没问题"):
   * - 免租户 ≠ 免鉴权:以上前缀**均不在** `AUTH_PUBLIC_PREFIX_PATHS`(除 `/api/agents`
   *   是公开读、写端点自带 requireAuth;/api/analytics/track 与 /api/visit-tracking/
   *   本就是匿名埋点),兜底鉴权闸语义不变;
   * - 路由文件对 tenantId 零引用(`notifications.ts`/`chat.ts`/`user.ts`/`workspace.ts`/
   *   `analytics.ts`/`visit-tracking.ts`/`ai-feed.ts`/`live.ts`/`oauth-keys.ts`/
   *   `agents.ts`/`news.ts`/`workspace-ai.ts` 均 0 命中),不存在"豁免后跨租户串数据"路径;
   * - 真正按 tenant 隔离的 `admin-saas-quota.ts`、`v1-assistants.ts`、`admin/relay-*.ts`
   *   **不在**本组,仍走严格模式。
   * 段边界:`/api/chat`、`/api/workspace` 等裸前缀只覆盖自身与子段,不放行 `…XYZ`。
   * 回归锁:public-paths.test.ts「第一方 Web 用户面免租户、且不免鉴权」。
   */
  '/api/notifications',
  '/api/chat',
  '/api/user',
  '/api/users',
  '/api/workspace',
  '/api/oauth-keys',
  '/api/agents',
  '/api/model-leaderboard',
  '/api/ai-feed/',
  '/api/live/',
  // 匿名埋点:未登录访客也要上报,和 AUTH_PUBLIC 同前缀登记(2026-11-23)
  '/api/analytics/track',
  '/api/visit-tracking/',
  // 后台新闻状态卡是第一方 admin 只读面;news.ts 对 tenantId 零引用
  '/api/admin/news',
  /**
   * 微信智联管理面(2026-11-23 立,与 `/api/subagents` 同型)。
   *
   * 事实:Web 管理台与 api-client 从不发 `X-Tenant-Id`,租户闸只认 header/子域名 ⇒
   * 严格模式缺省下,带有效 admin Bearer 访问 `/api/wechat-hub/capabilities` 仍 401
   * `TENANT_REQUIRED`(本机 8802 实测)。该 401 会让整个管理台所有标签页空白,
   * 非 GET 还会触发登录弹窗与 refresh token 轮转。
   *
   * 数据维度:account/conversation/message/action 全部按 `userId` 隔离(manager.assertAccount
   * 逐次校验 userId),路由文件对 tenantId 零引用 ⇒ 免租户不损隔离。
   * 免租户 ≠ 免鉴权:`/api/wechat-hub` 不在 AUTH_PUBLIC_PREFIX_PATHS,
   * 只有 `/api/wechat-hub/webhook/` 这一机器回调前缀免登录(账号级 secret 验签)。
   */
  '/api/wechat-hub',
  // 代码库语义搜索机器面:调用方带 API Key、不带租户头;v1-assistants 等真租户面不在本前缀
  '/api/v1/codebase/',
  '/api/csrf-token',
  '/api/configs',
  '/api/settings',
  '/api/agreements/',
  '/api/exchange-rates/',
  '/api/share/',
  '/api/openapi/',
  '/api/developer/portal',
  '/api/ai-pricing',
  '/api/vip/levels',
  '/api/vip/products',
  '/docs',
  '/openapi.json',
  /**
   * 指标抓取面(2026-11-16 生产事故收口):Prometheus 按回环抓 /metrics 与
   * /business-metrics,抓取请求不带 X-Tenant-Id、也不带 Authorization。
   * TENANT_STRICT_MODE 缺省即严格后(apps/api/src/plugins/tenant.ts 的全局 onRequest),
   * 这两条腿被判 401 ⇒ 2026-11-11 起 4 个 target 恒 down,
   * ApiDown(critical) / AiBusinessMetricsDown(warning) 连续 firing。
   * 401 报文里的"或 Authorization"与 resolveTenantIdentifier 实现不符,
   * 给 Prometheus 配 basic_auth 实测仍是同一 401 —— 这里要的不是凭据,是免租户。
   * 两端点已同时在 AUTH_PUBLIC_EXACT_PATHS 与 NETWORK_PUBLIC_PREFIX_PATHS,
   * 且 metrics.ts / business-metrics.ts 另有 isPrivateIp 回环闸,
   * 免租户不放宽任何公网面。/api 别名一并对齐,免得下次抓别名再漏。
   * 回归锁:public-paths.test.ts「指标抓取面免租户」。
   */
  '/metrics',
  '/business-metrics',
  '/api/metrics',
  '/api/business-metrics',
]

/**
 * 网络分段的公开面:不注入内网隔离、保持公网可达的路径前缀。
 */
export const NETWORK_PUBLIC_PREFIX_PATHS: readonly string[] = [
  '/api/health',
  '/api/landing',
  '/api/public/',
  '/api/oss/public/',
  '/api/metrics',
  '/business-metrics',
  '/api/csrf-token',
]

/** 兜底鉴权闸:段边界安全的公开面判定。 */
export function isAuthPublicPath(path: string): boolean {
  if (AUTH_PUBLIC_EXACT_PATHS.has(path)) return true
  return AUTH_PUBLIC_PREFIX_PATHS.some((p) => matchesPrefix(path, p))
}

/** 租户隔离绕过:段边界安全的公开面判定。 */
export function isTenantBypassPath(path: string): boolean {
  return TENANT_BYPASS_PREFIX_PATHS.some((p) => matchesPrefix(path, p))
}

/** 网络分段:段边界安全的公开面判定。 */
export function isNetworkPublicPath(path: string): boolean {
  return NETWORK_PUBLIC_PREFIX_PATHS.some((p) => matchesPrefix(path, p))
}

/** 段边界安全的前缀匹配原语(再导出,供需要单独比对的消费方使用,避免第二个实现漂移)。 */
export { matchesPrefix }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
