// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { booleanFromString } from '../utils/parse-boolean.js'

const optionalUrl = (def: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v))
    .pipe(z.url().or(z.literal('')))

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8802),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  // 2026-09-02 默认追加 Tauri 桌面端 origin(comma 分隔白名单);即便部署未设 env,
  // server.ts 也会固定放行,此处仅保证本地/测试默认配置一致可查。
  // 2026-09-22 追加 http://localhost:8806(mobile-rn Expo web 开发预览,`expo start --web
  // --port 8806`):不加则浏览器端全部 API 调用被 CORS 拦截,OfflineBanner 误报"网络已断开"。
  // localhost 开发源与既有 8801 同级信任;生产部署不监听该端口,无暴露面。
  CORS_ORIGIN: z
    .string()
    .default(
      'http://localhost:8801,http://localhost:8806,http://tauri.localhost,tauri://localhost',
    ),

  DATABASE_URL: z.url(),
  DATABASE_READ_REPLICA_URL: z
    .string()
    .optional()
    .transform((v) => (v === '' ? undefined : v))
    .pipe(z.url().optional()),
  /**
   * O13(2026-09-21):**受控出口专用**的应用角色连接串(非超级用户,如 `ihui_app`)。
   *
   * 为什么要有它:`dbScoped()` / `dbReadScoped()` 上的数据闸对 scoped-* 能力有
   * fail-closed 断言「连接必须被证实非超级用户」,而 `DATABASE_URL` 那条连接历史上
   * 就是超级用户 ⇒ 已接线的开放面读路径在生产恒 503 DATA_ISOLATION_UNAVAILABLE。
   * 角色与逐表 GRANT 由迁移 20260921160000_scoped_app_role_owner_rls.sql 落。
   *
   * 语义(向后兼容优先):
   *  - 未配置(空 / 缺省)→ 受控出口仍与 `db` 同池、探针仍打在主库连接上,
   *    行为与今天逐字节一致,只是启动时会 **明确告警**「隔离前提不成立」;
   *  - 配置了 → 受控出口 + 超级用户探针都改挂到这条连接上(探针必须测**服务 scoped
   *    查询的那条连接**,测主池等于测了个不相干的超级用户);
   *  - 它**只**服务受控出口,`db` / `dbRead` 一律不动 ⇒ 存量第一方链路零回归。
   *
   * 部署要求:该角色只能拿到开放面实际触达表的 DML(见上面那份迁移),
   * 且 `NOSUPERUSER NOBYPASSRLS`;密码由运维在库上 `ALTER ROLE` 设置,不落仓。
   */
  DATABASE_APP_URL: z
    .string()
    .optional()
    .transform((v) => (v === '' ? undefined : v))
    .pipe(z.url().optional()),
  REDIS_URL: z.url().default('redis://localhost:8811'),
  // 文件 CDN 域名(可选):上传接口返回的 path 自动加前缀,生产可指向 file.aizhs.top
  // (需 Nginx 反代 /uploads 到本服务;未配置时返回相对路径 /uploads/<id>)
  FILE_CDN_BASE: z.string().optional().default(''),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET 必须至少 32 字符')
    .refine(
      (v) => {
        // 仅在生产环境拒绝弱默认值/已知占位符(2026-07-21 安全审计加固)
        // 测试环境允许弱密钥(测试套件历史使用 'test-jwt-secret-...' 占位)
        if (process.env.NODE_ENV !== 'production') return true
        if (v === 'a'.repeat(32)) return false
        if (/^(.)\1+$/.test(v)) return false // 全相同字符
        if (v.toLowerCase() === 'change-me' || v.toLowerCase() === 'changeme') return false
        if (/^test[-_]/i.test(v)) return false // test- 前缀(测试密钥误用)
        if (/^dev[-_]/i.test(v)) return false // dev- 前缀
        if (/^placeholder/i.test(v)) return false
        if (/^your[-_]?secret/i.test(v)) return false // your-secret / your_secret
        return true
      },
      { message: 'JWT_SECRET 不能使用弱默认值/全相同字符/test- 前缀/已知占位符' },
    ),
  // P2 修复(2026-08-06):删除死配置 JWT_EXPIRES_IN。
  // access token 实际 TTL 由 @ihui/auth 的 ACCESS_TOKEN_TTL_SECONDS 控制
  // (packages/auth/src/jwt.ts,默认 15 分钟,可用 env.JWT_ACCESS_TTL_SECONDS 覆盖);
  // refresh token 由 REFRESH_TOKEN_TTL_SECONDS 控制(默认 30 天,env.JWT_REFRESH_TTL_SECONDS)。
  // 原默认 '7d' 从未被 jwt.ts 读取,属误导性死配置,统一为实际值并移除。
  CREDENTIALS_ENCRYPTION_KEY: z
    .string()
    .min(32, 'CREDENTIALS_ENCRYPTION_KEY 必须至少 32 字符')
    .refine(
      (v) => {
        // 仅在生产环境拒绝弱默认值/已知占位符(2026-07-21 安全审计加固)
        // 测试环境允许弱密钥(测试套件历史使用 'a'.repeat(32) 占位)
        if (process.env.NODE_ENV !== 'production') return true
        if (v === 'a'.repeat(32)) return false
        if (/^(.)\1+$/.test(v)) return false // 全相同字符(如 aaaa...)
        if (v.toLowerCase() === 'change-me' || v.toLowerCase() === 'changeme') return false
        if (/^test[-_]/i.test(v)) return false // test- 前缀(测试密钥误用)
        if (/^dev[-_]/i.test(v)) return false // dev- 前缀
        if (/^placeholder/i.test(v)) return false
        return true
      },
      { message: 'CREDENTIALS_ENCRYPTION_KEY 不能使用弱默认值/全相同字符/已知占位符' },
    ),

  AI_SERVICE_URL: z.url().default('http://localhost:8803'),

  // AI 回调共享密钥(可选,为空则不校验;配置后 ai-service 回调需带 X-Internal-Secret 头)
  AI_CALLBACK_SECRET: z.string().default(''),

  // TBox webhook 签名密钥(可选,为空则不校验;配置后设备事件通知需带 X-Signature 头)
  TBOX_WEBHOOK_SECRET: z.string().default(''),

  // GitHub webhook 签名密钥(可选,为空则 503 拒绝;配置后 webhook 需带 X-Hub-Signature-256 头)
  GITHUB_WEBHOOK_SECRET: z.string().default(''),

  // 腾讯云直播回调验签密钥(可选,为空时回调端点返回 503;配置后回调需带 X-Signature/X-Timestamp/X-Nonce 头)
  TENCENT_LIVE_CALLBACK_KEY: z.string().default(''),
  // 腾讯云直播 AppID(用于流管理 API,预留)
  TENCENT_LIVE_APP_ID: z.string().default(''),
  // 腾讯云直播 API 密钥(用于流管理 API 签名,预留)
  TENCENT_LIVE_API_KEY: z.string().default(''),

  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('智汇AI官方 <IHUI-AI@aizhs.top>'),
  // P1 修复(2026-08-06):z.coerce.boolean() 把 "false"/"0" 解析为 true,
  // 导致 SMTP_ENABLED=false 实际开启,改为严格布尔解析。
  SMTP_ENABLED: booleanFromString(false),

  // 邮件服务商 (auto=按收件域名智能路由国内/国外; smtp/resend 强制指定)
  MAIL_PROVIDER: z.enum(['auto', 'smtp', 'resend']).default('auto'),
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM: z.string().default(''),

  // 微信支付 V3(全部 optional,缺失时降级 mock;wechat-pay.ts 仍直接读 process.env,此处仅校验存在性)
  WX_API_BASE: optionalUrl('https://api.mch.weixin.qq.com'),
  WX_MINI_APPID: z.string().optional().default(''),
  WX_MINI_SECRET: z.string().optional().default(''),
  // 小程序订阅消息模板 ID(微信公众平台 → 订阅消息 中申请,形如 "AbC123...")。
  // 配置后催费提醒走真实订阅消息外发;未配置则仅站内信兜底。
  WX_MINI_REMIND_TMPL_ID: z.string().optional().default(''),
  WX_APP_APPID: z.string().optional().default(''),
  WX_SHOP_ID: z.string().optional().default(''),
  WX_PAY_V3_KEY: z.string().optional().default(''),
  WX_PAY_CERT_SERIAL: z.string().optional().default(''),
  WX_PAY_PRIVATE_KEY: z.string().optional().default(''),
  WX_PAY_PRIVATE_KEY_PATH: z.string().optional().default(''),
  WX_PAY_PLATFORM_CERT: z.string().optional().default(''),
  WX_PAY_PLATFORM_CERT_PATH: z.string().optional().default(''),
  WX_PAY_NOTIFY_URL: optionalUrl(''),
  WX_PAY_COURSE_NOTIFY_URL: optionalUrl(''),
  WX_ANDROID_NOTIFY_URL: optionalUrl(''),

  // USDT 链上取证确认数阈值(P0 资金安全修复 2026-09-06)
  // 实收 USDT 转账达到该确认数后才允许确认入账(防短时间 double-spend/重组回滚)。
  USDT_CONFIRM_TRC20_MIN: z.coerce.number().int().min(0).default(3),
  USDT_CONFIRM_ERC20_MIN: z.coerce.number().int().min(0).default(12),

  // 信任代理配置(2026-07-21 安全审计第十轮加固)
  // 严禁 `trustProxy: true` 一刀切 — 任意客户端可伪造 X-Forwarded-For 头绕过 IP 限流/IP 拉黑
  // 生产环境必须显式列出可信代理 IP/CIDR(逗号分隔),如:
  //   TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
  // 留空 = 不信任任何代理(直接用 socket remoteAddress,安全但反向代理场景 IP 全部一样)
  // 开发环境默认信任 127.0.0.1(本地起 nginx/cloudflared 时可识别真实 IP)
  TRUSTED_PROXIES: z.string().default('127.0.0.1,::1'),

  // Swagger / OpenAPI 文档(2026-07-21 安全审计第十轮加固 + 2026-07-28 P0-4a 品牌化)
  // 生产环境必须 SWAGGER_ENABLED=true 才暴露 /docs 路由,默认 false(避免未授权 schema 泄露)
  // P1 修复(2026-08-06):同上,SWAGGER_ENABLED=false 不能被解析为 true
  // (生产环境错误暴露 /docs 属未授权 schema 泄露)。
  SWAGGER_ENABLED: booleanFromString(false),
  // Swagger UI 访问 API Key(可选,2026-07-28 P0-4a 立)
  // 配置后访问 /docs 必须带 `X-API-Key: <key>` header(timing-safe 比较)
  // 留空 = /docs 公开(仅推荐开发环境)
  // 生产环境强烈建议配置,推荐:node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  SWAGGER_API_KEY: z.string().default(''),

  // P2 修复(2026-08-06):API_LOG_SAMPLE_RATE 默认 0.1(仅 10% 2xx 落库)→ 1.0(全量)。
  // 原默认导致 90% 正常请求无 api_logs,排查问题盲区大;需要降量可在环境变量显式调低。
  API_LOG_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1),
  API_LOG_ENABLED: booleanFromString(true),
  API_LOG_BATCH_SIZE: z.coerce.number().int().min(1).default(100),
  API_LOG_FLUSH_INTERVAL_MS: z.coerce.number().int().min(100).default(5000),

  // ===== 国安级安全(2026-07-24 立,E1-E5 五层防御)=====
  // E3 审计日志 HMAC 链(未配置降级为空字符串,配置时必须 ≥32 字符)
  AUDIT_LOG_HMAC_SECRET: z.string().min(32).or(z.literal('')).optional().default(''),
  // E4 mTLS 双向证书
  MTLS_CA_CERT_PATH: z.string().optional().default(''),
  MTLS_SERVER_CERT_PATH: z.string().optional().default(''),
  MTLS_SERVER_KEY_PATH: z.string().optional().default(''),
  MTLS_CLIENT_CERT_REQUIRED: z.string().optional().default('false'),
  // E4 零信任
  ZERO_TRUST_ENABLED: z.string().optional().default('false'),
  ZERO_TRUST_POLICY_PATH: z.string().optional().default(''),
  // E5 网络分段(国安级默认 strict:unknown IP 拒绝;开发环境设 NETWORK_SEGMENT_POLICY=permissive 放行)
  NETWORK_SEGMENT_POLICY: z.string().optional().default('strict'),
  // E4 服务间认证(未配置降级为空字符串,配置时必须 ≥32 字符)
  SERVICE_MESH_JWT_SECRET: z.string().min(32).or(z.literal('')).optional().default(''),
  ALLOWED_SERVICES: z.string().optional().default('ihui-web,ihui-ai-service'),
  // E5 CAPTCHA
  RECAPTCHA_SECRET: z.string().optional().default(''),
  // E5 IP 信誉
  SECURITY_TOR_EXIT_NODES: z.string().optional().default(''),
  SECURITY_PROXY_CIDRS: z.string().optional().default(''),
  SECURITY_DATACENTER_CIDRS: z.string().optional().default(''),
  SECURITY_MALICIOUS_ASNS: z.string().optional().default(''),

  // SSE 流注册表状态后端(2026-09-19 立,多副本就绪):memory=进程内(默认,单副本行为
  // 与历史完全一致);redis=回放帧旁路复制 + 会话元数据跨副本可见 + abort 跨副本广播
  // (连接绑定层 raw/controller 永远留在本进程,Redis 只共享可序列化状态)
  SSE_REGISTRY_BACKEND: z.enum(['memory', 'redis']).default('memory'),

  // ===== O2 开发者 API Key 配额强制与凭据形态(2026-09-21 立)=====
  // 限流后端(Redis/DB 计数)不可用时的降级形态:
  // - close(默认):billable / M2M(/v1 等能力目录登记)端点返回 503 RATE_BACKEND_UNAVAILABLE,
  //   纯只读低危端点仍放行 —— 判据来自 @ihui/types capability-catalog 的 risk/billable,不硬编码路由名。
  // - open:维持历史 fail-open 行为(全部放行,仅告警)。
  API_KEY_RATE_LIMIT_FAIL_MODE: z.enum(['close', 'open']).default('close'),
  // 双因子凭据:requireApiKeyAuth 主链路默认必须携带 X-Api-Secret(缺失 → 401 SECRET_REQUIRED)。
  // 置 false 恢复历史"不带即跳过"行为(过渡期/存量纯 key 客户端)。
  API_KEY_REQUIRE_SECRET: booleanFromString(true),

  // ===== O7 OAuth 2.1 / OIDC 授权服务器(2026-09-21 立)=====
  // 对外可达的规范 issuer。优先级见 utils/oauth-as.ts resolveIssuer():
  //   PUBLIC_BASE_URL > OAUTH_ISSUER > env.BASE_URL > x-forwarded-proto + host
  // 两者都留空时才会退化到请求头推导 —— 发现文档里的 issuer 一旦被推导错,
  // 第三方 AS 客户端会缓存错误的端点表,故显式配置其一为生产硬要求。
  PUBLIC_BASE_URL: z.string().default(''),
  OAUTH_ISSUER: z.string().default(''),
  // 授权码链路 PKCE 灰度开关(与 packages/auth pkcePolicyFromEnv() 读的是同一个 env)。
  // 默认 false 的理由(破坏面):不带 code_challenge 的存量授权请求今天被静默降级为
  // plain 比对并正常发 token;硬默认 true 会让这些存量客户端在 **authorize 阶段**
  // 就直接 400(而非换 token 时失败),等于对未升级客户端全线断服。
  // 灰度期由本开关兜住:false 时只强制"带了 challenge 就必须校验 verifier"(不可豁免,
  // 见 evaluatePkce),true 时连未带 challenge 的机密客户端也拒。
  // 公开客户端 / DCR 注册的现代客户端不受本开关影响,永远强制 PKCE。
  OAUTH_REQUIRE_PKCE: booleanFromString(false),
  // 是否允许公开客户端(token_endpoint_auth_method=none → client_secret 落 '!public' 哨兵)
  // 在 token 端点不携带 secret。默认 false = 失败关闭:未显式开启前,公开客户端形态
  // 一律按 invalid_client 拒绝,避免"无 secret 即匿名可换 token"的默认放行面。
  // ⚠️ 打开它必须与 PKCE 判定在同一步骤内完成(evaluatePkce 对公开客户端无条件强制),
  //    分两步写会出现"空 secret 先被 sha256/HMAC 校验和判失败"的假阴性,永远排不掉。
  OAUTH_ALLOW_PUBLIC_WITHOUT_SECRET: booleanFromString(false),
  // error_uri 白名单域名(逗号分隔)。RFC 6749 §5.2 的 error_uri 会被客户端渲染成可点
  // 链接,任何来自请求参数的值都能投毒 → 只允许本清单内的 host,且只走 https。
  // 留空 = 只允许 issuer 自身 host(见 utils/oauth-as.ts isSafeExternalUrl)。
  OAUTH_ERROR_URI_HOSTS: z.string().default(''),
  // 错误文档基址(可选,如 https://aizhs.top/docs/oauth-errors)。设置后 RFC 错误体会带
  // `error_uri#<error>`;该地址仍必须通过 OAUTH_ERROR_URI_HOSTS 白名单,否则字段被丢弃
  // —— 白名单是"是否出这个字段"的唯一判据,配置本身不构成豁免。
  OAUTH_ERROR_URI_BASE: z.string().default(''),
  // M2M(client_credentials)access token TTL 上限;实际签发取 min(请求 scope 集, 该值)
  OAUTH_M2M_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),

  // ===== O10 开放面幂等重放保护(2026-09-21 立)=====
  // 带 Idempotency-Key 的写请求,其"进行中"槽位与已缓存结果在同一 Redis 键上共用的存活秒数。
  // 600s 的依据:覆盖 RATE_PROFILES 里 high 档单次请求最长占用(600_000ms),低于 critical 档,
  // 再短就会出现"原请求还在跑、锁先过期"从而重复计费。它同时是崩溃兜底 —— 进程中途死掉时
  // 锁最多滞留本时长即自愈(正常收口路径由 onResponse 主动删键,不等 TTL)。
  // 只影响"带了 Idempotency-Key 且能力目录 idempotencyRequired=true"的请求,其余不受任何影响。
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(600),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  logger.error('❌ Invalid environment variables', {
    errors: z.flattenError(parsed.error).fieldErrors,
  })
  process.exit(1)
}

export const config = parsed.data
export type Config = typeof config
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
