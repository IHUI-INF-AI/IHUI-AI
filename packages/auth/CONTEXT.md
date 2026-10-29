<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# @ihui/auth — 契约与边界

一句话职责:服务端身份与授权**原语**层 —— JWT 签验、密钥轮换、token family、黑名单、数据范围、
OAuth2 授权码 + PKCE、WS token、第三方 Provider(OIDC / Discord / Telegram / Passkey)。
它是被 `apps/api` 组装的原料,不是"一道鉴权中间件"。

## 1. 对外给谁用(现查 HEAD,`git grep -l "from '@ihui/auth'" HEAD`)

**只有 `apps/api` 这一个消费端**:生产面 21 个文件 + 测试面 41 个。生产面里的主干:

- 插件层:`src/plugins/auth.ts`(`authenticate()` 住这里,不在本包 —— 见 §4)、`ws-helpers.ts`、
  `ws-notifications.ts`、`ws-relay-ops.ts`、`anti-automation.ts`
- 路由层:`routes/auth.ts`、`auth-extended.ts`、`auth-carrier.ts`、`auth-passkey.ts`、`auth-sso.ts`、`mfa.ts`、
  `oauth-authorization-server.ts`、`oauth-register.ts`、`oauth-tokens.ts`、`chat-models.ts`、`ai-audio.ts`、
  `ai-vendors/proxy-tools.ts`、`v1-shared.ts`
- 服务/工具:`services/token-service.ts`、`utils/scoped-guard.ts`、`utils/oauth-as.ts`

`packages/**`(含 `api-client`、`shared`、`app`)对本包**零引用** —— 它不面向浏览器/RN 运行时。

## 2. 公开面(package.json `exports` 只有 `"."`;`main`/`types` = `./src/index.ts`)

`src/index.ts` 是八行 `export *`,公开面 = 八个子模块之和:

- `jwt.ts`:`JWTPayload`、`AUDIENCE`、`ACCESS_TOKEN_TTL_SECONDS`(默认 15min)、`REFRESH_TOKEN_TTL_SECONDS`(默认 30d)、
  `getJwtSecret`、`signAccessToken` / `signRefreshToken` / `verifyAccessToken` / `verifyRefreshToken`
- `key-rotation.ts`:`KeyVersion`、`RotationPhase`、`JwtKeyRotator`、`getJwtKeyRotator`、`rotateJwtKey`、
  `getActiveJwtKey`、`verifyTokenWithGracePeriod`
- `token-family.ts`:`createFamilyId`、`validateFamilyId`、`FamilyRevoker`、`noopFamilyRevoker`
- `blacklist.ts`:`TokenBlacklist`、`createBlacklist(redis)`
- `data-scope.ts`:`DataScope`(enum)、`DEFAULT_ROLE_SCOPE_MAP`、`getDataScopeForRole`、`ScopeFilter`、
  `buildScopeFilter`、`canAccess`
- `oauth2.ts`:`OAuth2Client`、PKCE 三件套(`generatePkceVerifier` / `generatePkceChallenge` / `validatePkce`)、
  `validateRedirectUri`、`generateAuthorizationCode`、两个 code store(内存 + Redis)、
  `validateAuthorizationCode` / `exchangeCodeForToken` / `createAndStoreAuthorizationCode`、
  `generateClientId` / `generateClientSecret`、`OAuth2Error` + `OAUTH_ERROR_HTTP_STATUS` + `oauthErrorStatus`、
  `pkcePolicyFromEnv`
- `ws-auth.ts`:`WsTokenPayload`、`generateWsToken`、`verifyWsToken`、`SocketLike`、`NextFunction`、`createWsAuthMiddleware`
- `providers/`:OIDC / Discord / Telegram 三族 `create*Provider` + `is*Configured`(+ `buildOidcAuthorizationUrl`、
  `generateTelegramAuthToken`)、Passkey 四件套(`generateRegistrationOptions`、`verifyRegistrationResponse`、
  `generateAuthenticationOptions`、`verifyAuthenticationResponse`)+ `getPasskeyConfig`

## 3. 依赖方向与边界(`- id: 'packages/auth'`)

`layer: platform`(rank 20) · `exported: true` · `managed: true` · `requires: []` · `public_entrypoints: ['.']`

- `requires: []` 与现实一致:现查 `packages/auth/src` 内**零条** `@ihui/*` import。运行时依赖只有
  `jose`、`ioredis`、`@simplewebauthn/server`。
- **本包不自己连 Redis、不自己读 `.env` 建连接**:`createBlacklist(redis)` 与 code store 都收**注入的客户端**
  (现查 src 内无 `new Redis`)。⇒ 连接生命周期属宿主(`apps/api`),新代码不得在包内图省事直接建连接。
- 环境变量是本包的配置面:`JWT_SECRET`(强制 ≥32 字符且拒弱默认值,不合规直接抛错并挂 `statusCode = 500`)、
  `JWT_ACCESS_TTL_SECONDS`、`JWT_REFRESH_TTL_SECONDS`、`OIDC_*` / `DISCORD_*` / `TELEGRAM_*`。
  新增 env 必须同批有校验与降级语义,**不得**让"没配"读成"配错了"。
- 只有 `.` 一个出口 ⇒ `@ihui/auth/src/oauth2` 这类穿透是 D3。
- **授权判定不许留在这里就"写完"**:`data-scope` / `canAccess` 只提供纯函数,把身份与归属落到 SQL 是端侧的事
  (AGENTS §5"认证不等于授权"两条:归属条件必须落在被发出的那条 SQL 上;身份只能从承载层显式入参进来)。
  本包递出的都是**无请求上下文**的原语,不得假装它们构成一道闸。
- 凭据卫生:`access/refresh token`、`client_secret`、PKCE verifier 一律不得进日志/错误 message
  (AGENTS §5d「密钥不入仓、不入聊天记录」与守门 67 的同一判据面)。

## 4. 已知缺口 / 未收口的点

- **AGENTS §5 那句"复用 `packages/auth` 的 authenticate 函数"与代码不符。** 现查:
  `export async function authenticate(...)` 只存在于 `apps/api/src/plugins/auth.ts:61`,本包
  `src/**` 里没有任何名为 `authenticate` 的导出(`oauth2.ts:910/914/930` 出现该词只是注释)。
  ⇒ 照文档去找"包里的 authenticate"会找不到,按上一条它其实是"包递原语、端组函数"这一格没写清。
- **`noopFamilyRevoker` 被当默认参数用。** `apps/api/src/services/token-service.ts:106` 写的是
  `familyRevoker: FamilyRevoker = noopFamilyRevoker` —— 调用方漏传时,**登出/改密的家族撤销会静默变成空操作**,
  refresh token 仍然可用,而类型系统完全不红。这与守门 91 立的"默认值就是静默失效开关"是同一条形状。
- 递出的是 **TS 源**(`main: ./src/index.ts`),而 `scripts.build` 与 `clean` 又提到 `dist`(目录实际存在)。
  ⇒ dist 在消费链上无人读取,"发 npm"之前必须先定递源还是递 dist(同 `@ihui/browser-platform` / `@ihui/ui-native` 那一格)。
- `oauth2.ts` 已到 **1270 行**,是本包最大的单文件;策略表 C1 上限是 6000 行,离判红还远,
  但它同时承载 PKCE、授权码、client 凭据与错误码映射四件事 —— 再往里加东西时应先拆,不要等 C1 喊。
- 本包不声明 `contract_files`,也不命中 `contract_file_patterns` ⇒ E2 齐备性由此文档补足。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
