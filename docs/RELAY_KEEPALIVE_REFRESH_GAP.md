<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 号池保活/续期能力缺口与收敛（2026-10-27 收口）

## 一、根因

`sweepAccountPool` 的「空闲保活」档（`keepaliveIdleWhere`）与「临期刷新 / down 恢复」档的选号守卫，
原本判定「该账号能不能被刷新」只看两件事：

1. 该账号**库里存了** `refreshTokenEnc` 或 `cookiesEnc`（`recredentialableCondition()`）；
2. 该平台**适配器对象上**有没有 `refreshToken` 方法（循环里 `if (!adapter?.refreshToken)`）。

但这两道判据都**没有区分「方法存在」和「方法真的能续期」**，于是出现两类假象：

- **完全没实现 refreshToken 的平台**（codex / opencode / minimax / zcode / lingma / grokbot）：
  库里一旦存了 rt/cookie，就命中保活窗口（计入 `out.keepalive` 候选数），
  但循环里 `adapter?.refreshToken` 为 `undefined` ⇒ `refreshSkipped++`。
  结果：号池界面上显示「已保活 / 待刷新」，实际**什么都没做**——假命中、假保活计数。
- **有 refreshToken 但是空壳 stub 的平台**（doubao / loomy，方法恒返回 `null`，无实证续期端点）：
  循环判「有方法」⇒ 调用 `refreshOne` ⇒ `adapter.refreshToken` 返回 `null` ⇒ `refreshOne` 返回 `false`
  ⇒ 计为 `refreshFailed++`。连续 3 次（`REFRESH_FAILURE_LIMIT`）⇒ `tempUnschedulable=true` **自动摘除好号**。

## 二、修复口径（已落地）

1. 适配器契约新增 `refreshTokenSupported?: boolean`（`relay-upstream-adapters.ts`）：
   - 省略 / `true`：确有已实证续期端点；
   - `false`：方法有（或没有）但**恒无法续期**，调度器不得对它做保活 / 临期 / 恢复。
2. `doubao-adapter.ts` / `loomy-adapter.ts` 显式置 `refreshTokenSupported: false`。
3. 新增集中判据 `isRefreshableProviderCode(code)`：`typeof refreshToken === 'function' && refreshTokenSupported !== false`；
   配套 `getRefreshableProviderCodes()` 供 WHERE 直接 IN 过滤。新平台接入只要不标 `false` 且方法真实存在即自动生效，**不写硬编码名单**。
4. `keepaliveIdleWhere` 加 `inArray(providerCode, getRefreshableProviderCodes())`：不可续期平台的账号**根本不进保活窗口**（消除假命中计数）。
5. 三处循环守卫由 `!adapter?.refreshToken` 统一换成 `!isRefreshableProviderCode(code)`：
   不可续期平台一律走 `refreshSkipped` / `continue`，**绝不记成 `refreshFailed`** ⇒ 不再误摘好号。

> 说明：保活窗口（#4）只管「闲置」档；临期档 / down 恢复档（#5）的守卫同步换口径，是为了让 stub 平台在那些档里也走 skip 而非被记失败——同一把判据，三档一致，不各写一份口径。

## 三、逐平台续期能力表（2026-10-27 实情）

| 平台 | refreshToken 实现 | 实证续期端点 | 池内语义 | 保活/续期 |
|------|------------------|--------------|----------|-----------|
| trae | 真实现 | 有（ExchangeToken，轮换 rt） | server（client-first 可切） | ✅ 真续期 |
| workbuddy | 真实现 | 有（`/v2/plugin/auth/token/refresh`） | server | ✅ 真续期 |
| qoder | 真实现 | 有（`deviceToken/refresh`） | server | ✅ 真续期 |
| codearts | 真实现 | 有（华为 OAuth 轮转整套 STS） | server | ✅ 真续期 |
| doubao | 空壳 stub（恒 null） | 无（字节 passport 靠重登） | — | ❌ 声明不可续期 |
| loomy | 空壳 stub（恒 null） | 无 | — | ❌ 声明不可续期 |
| codex | 未实现 | 无公开续期协议 | — | ❌ 不续期（401 自愈靠重导） |
| opencode | 未实现 | OAuth 端点未实证 | — | ❌ 不续期 |
| minimax | 真实现（2026-11-06 取证） | 有（`account.minimax.cn/oauth2/token`，轮换 rt） | client-first | ✅ 真续期（回灌腿同批） |
| zcode | 未实现（显式 false，2026-11-12 复核） | 无（但票无 exp，见 §3.1） | — | ✅ 长期票直用；v2 解密修复后不依赖客户端 |
| raccoon | 未实现（显式 false） | 无 | — | ❌ 不续期（会话回灌） |
| lingma | 未实现 | 无公开续期协议 | — | ❌ 不续期 |
| grokbot | 未实现 | 无公开续期协议 | — | ❌ 不续期 |

### 3.1 2026-11-12 桌面端取证复核（loomy / zcode）

- **zcode（ZCode 3.17.2）**：客户端确有 token 端点 `/api/v1/oauth/token` 与
  `oauth:<provider>:refresh_token` 存储键，但两个 provider 适配器（kt / zai）**都没有 refresh 交换实现** ——
  `oauthService.refreshToken` 一旦走到 `!adapter.refreshToken` 就抛「暂未提供 refresh token 交换接口，请重新登录」。
  本机 `credentials.json` 解密后的全部键：`oauth:bigmodel:access_token`、`zcodejwttoken`、
  `oauth:bigmodel:user_info`、`oauth:active_provider`、`project-key-location:*` —— **没有 refresh_token**。
  ⇒ 上游既未下发 rt，客户端也没有可复用的刷新调用，适配器继续声明不可续期。
  **2026-11-17 更正（关键）**：「没有 rt」≠「不能永久保活」。实测解出的
  `oauth:bigmodel:access_token` 与 `zcodejwttoken` 都是 **JWT 无 `exp`**（只有 user/customer/iat claims），
  上游按 token_version 失效而非按时间过期；号池落 `tokenExpiresAt=null`，云端可长期直用，不依赖本机。
  同时发现 3.17.2 把值二次封装为 `enc:v2:os:`（系统钥匙串 32B 密钥 + AES-GCM），
  旧提取器只剥外层 `enc:v1:` ⇒ **把密文当令牌回灌**，正是 `billing/balance HTTP 401` 坏号的根因；
  `scripts/lib/zcode-auth-extract.mjs` 现已真解 v2 并拒绝密文回传，重复坏号已禁用。
  适配器的 `refreshTokenSupported:false` 保持不动（确实没有可调用的续期端点），
  但保活语义应读作「长期有效票 + 无需刷新」，不是「到期即死」。
- **loomy（Loomy 0.9.39 / 讯飞 CAccount）**：登录面只有
  `/login/phone/sendMsgCode`、`/login/phone/checkCode`、`/login/account/byPwd`、`/login/account/logout`，
  会话（session）失效一律走重新登录；客户端内 `refreshTokenRequest` 仅来自打包的 `@vercel/oidc`，与本产品无关。
  ⇒ 无 refresh 通路，适配器保持 `refreshTokenSupported: false`。
- **替代保活通路**：loomy / zcode / raccoon 由 worker 的客户端会话回灌腿
  （`loomy-session-sync` / `zcode-session-sync` / `raccoon-session-sync`，每 10 分钟）从本机客户端存储重捞凭据入池，
  再经 `IHUI-Pool-Sync`（每 2 分钟）镜像到生产；池侧三档（临期/空闲/down）对它们一律 skip，绝不记 `refreshFailed`。

### 3.2 2026-11-17 二轮：raccoon / loomy 源码级实证（结论从「未实证」升级为「物理无路径」）

此前 §四 把 raccoon/loomy 记为「续期端点形状未实证 / 刻意不盲写」。本轮直接解包客户端 asar 读到一手实现，
**「未实证」状态可以结清**——不是没找到，是平台架构上确实不存在服务端静默续期通路：

- **raccoon（商汤小浣熊，asar `G:\Apps\Xiaohuanxiong\resources\app.asar`，版本见包）**：
  - 登录是**浏览器 OIDC 授权码**流程：`/authorize` → 系统浏览器登录 → 深链 `office-raccoon://auth/callback?code`
    → `POST {authApi}/login_with_authorization_code` 用**一次性 code** 换 token
    （`build/electron/main/account/desktopLogin.js` 一手证据）。一次性 code 服务端无法自行再生产。
  - 换回的 `access_token` 是 **IAM JWT（`iss` 以 `/iam` 结尾，30 天 exp）**；
    `shared/client/iamToken.js::isIamToken` 判 `iss.endsWith('/iam')`。
    `accountState.js::refreshOwned` 明确：IAM token 若带 legacy `refresh_token` 就**立即清除**
    （"Migration consumes the legacy grant. Never retain it after acquiring IAM."）；
    `accountRequests.js::refresh` 的 refresh grant 只服务 legacy token，且注释写明 "IAM has no legacy refresh grant"。
  - ⇒ 到期后只能重走浏览器 OIDC 登录。**号池侧 raccoon 号 `tokenExpiresAt` 约 30 天、`hasRt=false`**，
    完全吻合：服务端无 rt 可刷。
- **loomy（Loomy 0.9.39 / 讯飞 CAccount）**：
  - 登录面 `/login/phone/sendMsgCode` + `/login/phone/checkCode` 等短信/密码接口，服务端下发 `session` 字符串
    （`dist/assets/main-Bv7VZXLM.js` 的 `xfyun.sendSmsCode` / `xfyun.loginBySmsCode` 一手证据）。
  - 渲染层 `dist/assets/sonner-CDo33AnZ.js` 的 `loomy-auth-session` 读写逻辑**只有**
    `{phone, maskedPhone, session, userid, loggedInAt}`，全程无 `refreshToken` / `expiresIn` / `tokenExpire` 字段。
  - 主进程有 `onSessionInvalidated` 与状态 `session_expired` / `evicted`（异地登录踢下线）/ `nexus_auth_failed`
    ⇒ session 会过期、会被顶号，且**无任何 refresh 通路**，只能重新短信登录。
  - `cross-end-sync/device-credential-vault.js` 里的 `deviceToken` 是 **Athena Connect 远程执行通道的设备票**
    （`/athena/connect/bootstrap` 用 `auth.session` 换发，safeStorage/DPAPI 绑定本机 `installation_id`），
    **不是登录会话续期票**；`athena-user-session-channel.js::bootstrap` 入参就是 auth session ⇒ 仍依赖已登录会话，
    无法脱离本机凭空换票。
  - ⇒ 号池侧 loomy 号 `tokenExpiresAt=null`（opaque session，连过期时刻都不下发），`hasRt=false`。

**统一结论（可结清 §四 的 loomy/raccoon 条目）**：这三类的凭证架构分三型——
① **无 exp 长期票 + 无可调用刷新端点**（zcode，按 token_version 失效，云端可长期直用，见 §3.1 更正）；
② **短期 JWT / opaque session + 无 rt**（raccoon / loomy），到期或被踢只能走浏览器 OIDC / 短信重登，
   而登录入口都是**一次性 code 或本机 DPAPI 绑定**，物理上无法服务端静默复现；
③ **有 rt 的平台**（qoder / trae / workbuddy / codearts 等）才走 `keepAliveForever` 服务端自刷。
「脱离本机、云端永久托管」只对 ①③ 成立；② 的根本制约在上游认证架构，不是本仓漏实现。
判「某号能否云托管」看号池元数据 `refreshTokenEnc`/`tokenExpiresAt` + 适配器 `refreshTokenSupported`，
不要再看「有没有签到」。

## 四、未决 / 后续

- doubao / loomy 的「无实证续期端点」是**刻意不盲写**（§0.3：不猜端点、401 自愈靠重新导入号池）。
  若日后抓到字节 passport / loomy 的真实刷新流量，补实现即可，只需去掉 `refreshTokenSupported: false`。
- 号池管理面应在这些平台账号上如实标注「该平台无自动续期通道」，而非显示「待刷新」（见 Web 端改造项）。
- 测试：`tests/relay-account-pool-scheduler.test.ts` 新增收敛组——判据断言 + `refreshOne` 守卫跳过 + `keepaliveIdleWhere` IN 排除（31 例全绿）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
