<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 钉钉 `Contact.User.Read` 权限申请与端到端验证指南

> **✅ 状态：全部完成（2026-11-25 23:25 收口）**——先看第七节。应用权限 `Contact.User.Read` 实测已开通（无需申请），真人授权已完成，且 token 已落到**生产库**并以用户身份调通讯录接口返回 200。第二/五/六节是当时过程的留档（第六节的"唯一缺扫码授权"已被第七节推翻），仅作换应用/权限被移除/重新授权时的排障参考。

> 适用：用户在智汇AI 连接器页用钉钉扫码授权自己账号后，AI 需以该用户身份真实调用通讯录接口（如查询用户详情）。
> 本指南区分两件**互相独立**的事，缺任一都会导致调用失败：
>
> 1. **用户 OAuth 授权**（`scope=openid`）——扫码拿用户身份，代码链路已就绪。
> 2. **应用级接口权限**（`Contact.User.Read` / 「成员信息读权限」）——**实测已开通**（见上方结论）；换应用或权限被移除时，才需企业管理员在钉钉后台重新申请。

## 一、先分清两层权限（最常见的误判）

| 层次 | 是什么 | 谁来做 | 本平台职责 |
| --- | --- | --- | --- |
| 用户授权 | OAuth2 `scope=openid` + `prompt=consent`，换取 userAccessToken | 用户本人扫码 | 已实现：authorize/callback/token 刷新全链路 |
| 应用权限 | `Contact.User.Read`（通讯录「成员信息读权限」） | 企业管理员在开发者后台申请 | 只做引导 + 申请后验证 |

平台代码侧 OAuth 配置见 `apps/ai-service/app/services/connectors/connector_oauth.py` 的 `dingtalk` 项：
`scope=openid`、`prompt=consent`、`token_url=https://api.dingtalk.com/v1.0/oauth2/userAccessToken`。
这枚 userAccessToken 只解决「我是谁」，**不含通讯读权限**；通讯读权限必须单独在钉钉后台给应用开。

## 二、精确到菜单路径的申请步骤（钉钉官方，2026-09 版）

官方依据：<https://open.dingtalk.com/document/orgapp/apply-for-permissions-6> 与
<https://open.dingtalk.com/document/app/add-interface-call-permissions>。

1. 用**企业管理员账号**登录钉钉开发者后台：<https://open.dingtalk.com/> → 右上角「开发者后台」。
2. 左侧「应用开发」→「钉钉应用」→ 找到本平台配置的那个企业内部应用（即 `tenant_platform_apps` 里钉钉平台绑定的 `clientId` 对应应用），点击进入应用详情。
   - **本平台钉钉应用 Client ID（AppKey）已查明 = `dingojemqcxfzr2f5xzd`**（2026-11-25 现读生产/本地 `tenant_platform_apps.app_id`，平台 `dingtalk` 行；配套 `agent_id=4012380713`、`robot_code=dingojemqcxfzr2f5xzd`）。在开发者后台「基础信息 → 凭证与基础信息」里按此 Client ID 定位应用，**不要申请到别的应用上**。
   - ⚠️ **回调地址（重定向 URL）必须确认**：授权时钉钉会拿 authorize URL 里的 `redirect_uri` 与后台白名单**逐字比对**，不在白名单里会在扫码后报 `redirect_uri参数错误`（见第七节）。2026-11-25 实测该应用后台「登录与分享 → 回调域名」**原本只登记了 `http://localhost:8801/callback?platform=dingtalk` 与 `https://bsm.aizhs.top`，并没有 `https://aizhs.top/callback`**——这是扫码被拦的真实根因；已现场补登。换应用或重置后务必回此页确认白名单含 `https://aizhs.top/callback?platform=dingtalk`。
3. 应用详情左侧 →「权限管理」→ 切到「通讯录管理」页签。
4. 在权限列表里勾选 **「成员信息读权限」**（新版服务端 API 权限点 Code 为 `Contact.User.Read`；旧版界面可能显示为「企业员工手机号信息和邮箱等个人信息」）。
   - 找不到时，用权限管理页的搜索框直接搜 `Contact.User.Read` 或「成员信息读」。
5. 点「申请权限」；若要求填写申请说明，写明用途，例如：「智汇AI 连接器以用户身份读取企内通讯录用户详情，用于授权后 AI 调用通讯录接口」。
6. 提交后等钉钉小二审批，**通常 1 个工作日内**，状态变为「已开通」即生效。
   - 被拒时：在权限管理页把鼠标移到「审核未通过」上看拒绝原因，补材料后重提。

> 权限按**应用**维度授予：换应用或重建应用都要重新申请，已有应用的权限不会自动继承。
> 若只需接口返回里的手机号/邮箱字段，还需在同一「通讯录管理」页额外勾选对应的手机号/邮箱权限，否则字段会被脱敏或缺失。

## 三、申请通过后的端到端验证

### 3.1 前置条件

- 钉钉应用权限状态 = 已开通。
- 平台侧钉钉租户应用凭据已配好（Client ID / Secret、回调地址 `https://aizhs.top/callback?platform=dingtalk`）。
- 用户已在本机/生产连接器页走完钉钉扫码授权，平台库里存有该用户的有效钉钉 userAccessToken（过期会自动刷新）。
- 相关服务在线：api 8802、ai-service 8803（生产为 `aizhs.top` 对应后端）。

### 3.2 平台内验证（推荐，走前端真实链路）

1. 浏览器登录平台 →「连接器」页 → 钉钉卡片点「扫码授权自己账号」，用钉钉 App 扫码并同意。
2. 授权成功后，在连接器页对钉钉执行「探测」或调用一个通讯录类 operation（如查询用户详情）。
3. 判定：
   - 成功返回用户详情（姓名/userid 等）⇒ 权限 + 授权链路全通。
   - 返回 `AccessDenied` / `requiredScopes: Contact.User.Read` ⇒ 应用权限仍未生效或申请到了错误的应用，回第二步核对 Client ID 与权限状态。
   - 返回 userAccessToken 失效/过期 ⇒ 走连接器页「续期」重新扫码。

### 3.3 服务端验证（排障用，绕过前端确认根因）

拿到授权用户的钉钉 userAccessToken 后，直接调新版通讯录接口确认权限：

```bash
# 用 userAccessToken 调「获取用户通讯录个人信息」（平台 catalog 同款端点），
# <unionId> 换成目标用户的 unionId；该 operation 的 scope 正是 Contact.User.Read
curl -s 'https://api.dingtalk.com/v1.0/contact/users/<unionId>' \
  -H "x-acs-dingtalk-access-token: <用户 userAccessToken>"
```

- 对应平台 catalog operation：`dingtalk_contact_api_dingtalk_retrieve_user_information`
  （`apps/ai-service/app/services/connectors/catalog_data/dingtalk_api_ledger.json`，`base_url=https://api.dingtalk.com`）。
- HTTP 200 + 用户详情 JSON ⇒ `Contact.User.Read` 已生效。
- 403 / `AccessDeniedDetail.requiredScopes` 含 `Contact.User.Read` ⇒ 应用权限未开通；错误信息里的 `requiredScopes` 就是要申请的权限点 Code，在权限管理页搜它申请即可。
- 401 / token 无效 ⇒ userAccessToken 过期或授权链路有问题，先重新扫码。

> 平台代码侧已按钉钉规范用 `x-acs-dingtalk-access-token` 请求头注入令牌（见
> `apps/ai-service/app/services/connectors/custom_http.py`），无需也无效应改成 `Authorization: Bearer`。

## 四、常见失败与对应动作

| 现象 | 根因 | 动作 |
| --- | --- | --- |
| 扫码成功但调通讯录 403 `Contact.User.Read` | 只做了用户 OAuth，没申请应用级权限 | 走第二节申请，等审批通过 |
| 申请后仍 403 | 申请到了别的应用 / 缓存未刷新 | 核对 Client ID；审批通过后重新扫码授权一次 |
| 手机号/邮箱字段缺失 | 只开了基础读权限，没开敏感字段权限 | 通讯录管理页额外勾选手机号/邮箱权限 |
| 扫码后报 `redirect_uri参数错误` / 回调报 redirect_uri 不匹配 | 钉钉后台「登录与分享 → 回调域名」白名单未登记平台回调（实测曾只登记 localhost 与 bsm 域名） | 后台「登录与分享 → 回调域名」**添加** `https://aizhs.top/callback?platform=dingtalk`（不是改权限页的回调，是登录页的回调域名白名单）；这是扫码被拦的最常见根因，详见第七节 |

---

## 五、现读状态快照（2026-11-25 实测）

| 检查面 | 实测结果 | 结论 |
| --- | --- | --- |
| 平台代码链路 | `catalog_data/dingtalk_api_ledger.json` 有 `dingtalk_contact_api_dingtalk_retrieve_user_information`（scope=`Contact.User.Read`）；`custom_http.py` 用 `x-acs-dingtalk-access-token` 注入；OAuth/刷新/回调全实现 | 代码侧完备，无需改 |
| 生产钉钉应用配置 | `tenant_platform_apps` 的 `dingtalk` 行 enabled=true、secret 已设、回调 `https://aizhs.top/callback?platform=dingtalk` | 配置就绪 |
| 本机钉钉 CLI 授权 | `dws contact +me` 成功返回当前用户（李春川）姓名/userId/手机/部门；`dws contact dept search` 可正常读组织 | **本机 dws 链路的通讯录读权限是通的**（这条链路是钉钉 CLI 自身授权，与下方平台连接器链路互相独立） |
| 平台连接器用户授权 | 生产与本地 `oauth_users` 的 `provider='dingtalk'` 行数 = **0** | **从无用户走完平台侧钉钉扫码授权**，平台链路里不存在 userAccessToken，第三节验证的前提尚未建立 |
| 钉钉开放平台后台登录态 | 初次探测（22:06）为未登录；22:43 面板已登录 `open-dev.dingtalk.com`，进入应用详情 → 权限管理搜 `Contact.User.Read` 显示「无需审批 / 已开通」、操作列为「移除权限」 | 后台实测确认权限已开（详见第六节） |

**因此当前只剩一个真人动作：**

1. ~~管理员在钉钉开放平台后台给应用 `dingojemqcxfzr2f5xzd` 申请 `Contact.User.Read`~~ —— **实测已开通（2026-11-25 22:45），无需再做**。仅当换应用/权限被移除时，才按第二节由企业管理员后台申请。
2. ~~用户本人在平台连接器页用钉钉扫码授权~~ —— **已于 2026-11-25 23:25 完成，见第七节**。授权产生的 userAccessToken 已落到生产库并验证可用。

> 注：本节是 22:45 时刻的快照，"唯一未完成项"已被第七节收口；当时依据的 `oauth_users` 表是死表（查表纠偏见 6.2）。

AI 侧已完成：链路核验、应用 Client ID 查明、后台权限状态现场核实（已开通）、临时探针清理、生产库 token 落库与端到端验证（第七节）。

## 六、2026-11-25 22:45 实测复核（重要更新，推翻上节部分结论）

上节是「无管理员登录态」时的**静态快照推测**。本节用**平台自己的钉钉应用凭据**做了实测（不需要管理员登录、不需要用户扫码），结论更新如下：

### 6.1 实测方法与结果

用 `tenant_platform_apps.dingtalk` 的 `app_id/app_secret`（= `apps/api/.env` 的 `DINGTALK_APP_KEY/SECRET`，已核对一致）换取新版应用 accessToken，再直接打钉钉开放平台接口：

| 探测 | 请求 | 实测响应 | 判定 |
| --- | --- | --- | --- |
| 换 token | `POST /v1.0/oauth2/accessToken` | `200`，`expireIn=7200` | 应用凭据有效 |
| 通讯录详情（占位 unionId） | `GET /v1.0/contact/users/probe_nonxxxx_user` | `404 invalidParameter.user.notFound`「找不到该用户」 | **鉴权已放行**——走到查用户业务逻辑，非 403 `requiredScopes` |
| 通讯录搜索（真实词） | `POST /v1.0/contact/users/search` `{queryWord:"李春川",offset:0,size:10}` | `200` `totalCount=1` + 真实 userId | **通讯录读权限确实可用** |

**结论：应用级通讯录读权限（`Contact.User.Read` 及通讯录搜索能力）已开通且可用。** 上节表格「需管理员申请」的推测不成立——权限无需再申请，真人动作从两项缩减为一项。

> 原理：若应用权限未开通，钉钉会在鉴权层直接返回 `403 AccessDeniedDetail.requiredScopes=[Contact.User.Read]`，根本不会走到「找不到用户」这类业务错误。实测拿到的是业务错误 + 真实数据，故权限确定已开。

### 6.2 剩余的唯一真人动作

- **用户本人在平台连接器页用钉钉扫码授权**（第三节 3.2）：真人用钉钉 App 扫码同意后产生 `code` → callback 换取 userAccessToken → 加密落 `connector_instances.extra.user_oauth`（`key='dingtalk:user-oauth'`、`spec.auth_kind='dingtalk_user'`）。AI 无法自行生成有效 `code`，无法代劳。
- **查表纠偏（2026-11-25 23:00）**：早期快照用 `oauth_users` 表判断「0 行 = 无人扫码」是**查错了表**——`oauth_users` 在全仓库无任何 INSERT 路径（死表），真实 user token 落在 `connector_instances.extra.user_oauth`。现读该表：`dingtalk:user-oauth` 仅 1 条，且为 `managed=true / credential_source=platform_env / owner_user_id=None` 的**平台兜底授权**，非真人用户授权。故「从无真人用户完成平台侧钉钉扫码授权」的结论仍成立，但依据应以此表为准。
- 用户扫码授权完成后，AI 以本人身份调通讯录接口即可成功——应用权限侧已实测无障碍，届时按第三节 3.2/3.3 验证即可收口。
- **「为何 AI 无法代劳」的页面确证（2026-11-25 23:10）**：本地用 `connector_oauth.make_state` 为 admin 生成真实授权 URL 并在浏览器打开，钉钉 `/oauth2/auth` 经 `challenge.htm` 最终落到 C 端登录页 `login.dingtalk.com/oauth2/challenge.htm`，形态为「使用钉钉扫码 / 继续使用AI智汇社区」+ **手机钉钉 App 扫码二维码**；「账号登录」tab 需账密，本环境 `.env` 无任何钉钉账号密码凭据。管理员后台 `open-dev.dingtalk.com` 的登录态属不同域，不能替代 C 端用户授权登录。故产生有效 `code` 的最后一步**确实必须真人手机扫码**，AI 无凭据、无登录态可绕——这是钉钉 OAuth 协议硬约束，非推测。

### 6.3 关于两种 token 的边界（排障必读）

- 本节实测用的是**应用 accessToken**（appKey+appSecret 换取），证明的是**应用级接口权限**已开通。
- 平台连接器真实调用走的是**用户 userAccessToken**（OAuth 扫码换取，`x-acs-dingtalk-access-token` 注入），证明的是**用户身份授权**。
- 两者互相独立：应用权限已开 ≠ 用户已授权。扫码后仍失败时才需要回头查应用权限；当前实测应用权限无障碍，扫码是唯一前置。

### 6.4 用户 token 链路实测（2026-11-25 23:00，含一次探测副作用留档）

对平台兜底记录 `dingtalk:user-oauth` 的 `user_oauth`（AES-256-GCM 密文，密钥 `data/credentials_key`）解密 + 刷新验证：

| 探测 | 结果 | 判定 |
| --- | --- | --- |
| 解密 `user_oauth` | 得到 `{access_token, refresh_token, expires_at, ...}` | 加密存储链路正常 |
| access_token 有效期 | `expires_at` 对应 2026-11-25 00:16，已过期约 22.7h | 该兜底 token 早已过期且 `last_sync_at` 为空（长期未使用） |
| 用 refresh_token 走项目 `build_refresh_body` + `/v1.0/oauth2/userAccessToken`（`grantType=refresh_token`） | **HTTP 200**，返回新 accessToken/refreshToken | **钉钉用户授权刷新链路本身是通的**（config 端点/字段映射正确） |
| 以刷新后的用户 token 调 `contact/users/search` | 403 `requiredScopes:["qyapi_addresslist_search"]` | search 这个旧版 scope 应用未开（与 `Contact.User.Read` 无关；详情接口 `Contact.User.Read` 已开） |

> **探测副作用留档（诚实记录）**：钉钉 refresh_token 是**一次性轮换**的。本次刷新消耗了库里那条 refresh_token，但刷新返回的新 token 未回写数据库（探测脚本仅验证未持久化），导致该兜底记录的 refresh_token 失效。影响面：仅这条 `owner_user_id=None / managed=true` 的平台兜底授权（探测前 access_token 已过期 22.7h、`last_sync_at` 空、无真实用户在用），**不涉及任何真人登录态**。修复方式：真人扫码重新授权，或平台重新播种该兜底记录。后续任何对该记录的刷新验证**必须回写新 token**（走 `_make_refresh_persister`），不可只用裸脚本探测。

## 七、2026-11-25 23:25 真人授权完成 + 端到端验证通过（任务收口）

第六节留下的唯一真人动作已完成，副作用也已随之修复。完整时间线与结论：

### 7.1 授权踩坑与修正（排障必读）

| 环节 | 现象 | 根因 / 修正 |
| --- | --- | --- |
| 首次扫码 | 回调 URL 带了 code，但落库无变化 | 本地生成的 state 把归属 `o` 字段置空，callback 第 540 行 `if not ... or not scope` 直接拒绝（报 `state 缺少平台/归属/用户`） |
| 回调页显示「请先登录 / 返回登录」 | 前端 `OAuthCallbackHandler` 未把 code 转发后端 | 浏览器无平台登录态；**改为拿到 code 后直接调 ai-service `/api/connectors/oauth/callback?code=...&state=...`** 完成换 token 落库，绕开前端未登录阻断 |
| 修正后的 state | `o=6c76c572...`（=tenant，非空）、`t=6c76c572...`、`u=<admin>`，签名有效 | scope 必须与落库隔离键一致（租户模式 = tenant_id），**绝不能置空** |
| 快捷登录 | 钉钉已登录态下授权页显示「此账号已在使用，可直接登录」+「立即登录」按钮 | 点「立即登录」即得新 code（无需手机扫码）；与第六节"最终落到扫码页"并不矛盾——登录态不同则形态不同 |

### 7.2 落库结果（实测）

- 直接调 callback：`{"ok": true, "platform": "dingtalk", "connector_key": "dingtalk:user-oauth", "message": "授权成功..."}`
- `dingtalk:user-oauth` 的 `updated_at` 更新到 `2026-11-25 23:25:09 +08:00`，新 token 未过期、有效期 2h、带 refresh_token。
- 第六节被探测消耗的平台兜底记录 refresh_token，随本次真人重新授权一并刷新回健康状态。

> **⚠️ 关键：本机 dev 库 ≠ 生产库（2026-11-25 23:56 补记，差点造成"授权白做"）**
>
> 上面的 callback 是打在**本地开发机** `127.0.0.1:8803`，token 落在**本地** Postgres `127.0.0.1:5432/ihui`（tenant `6c76c572...`）。而公网 `aizhs.top` 走的是**生产机**（`D:\DevEnv\ihui-prod`）的服务 + **生产库** `localhost:8810/ihui_dev`（tenant `17568535...`），两端是不同 Postgres 实例、不同 tenant、不同加密密钥（`PUBLISH_CREDENTIALS_KEY` 指纹本机 `2710dc28` / 生产 `2dd8e4d6`）。号池同步脚本 `relay-account-pool-sync.mjs` 只同步 relay 账号、**不碰 `connector_instances`**，所以 token 不会自动到生产。
>
> **修复**：在本地解密出 token 明文（内存，不落盘不打印），SCP 到生产机后用**生产 venv + 生产密钥**的 `connector_oauth.encrypt_user_token()` 重新加密，再用 `connector_store.save(tenant=生产实际 tenant, ...)` 落到生产库的 `dingtalk:user-oauth`（owner=None）。生产端回读 + 解密验证 OK（未过期、带 refresh）。临时 token 文件用完立即删除。
>
> **教训**：任何"授权/凭据落库"验证，必须确认**落在用户真正访问的那套库**（生产库），而不是开发机本地库。本地 `curl 127.0.0.1` 验证通过 ≠ 公网用户可用。判据：现读生产机 `connector_instances` 有记录 + 生产密钥能解密 + 生产端以用户身份调目标接口 200（见 7.3）。

> **⚠️ 二次坑：生产部署会轮换 credentials_key，旧密文失效（2026-11-26 00:50 补记）**
>
> 落库后约 1 小时复查，生产端解密报"密钥不匹配或密文损坏"。根因：生产 `apps/ai-service/data/credentials_key` 在部署环中被重建（指纹变了，`2dd8e4d6 → 26b9d533`），之前用它加密的 `user_oauth` 密文随之失效（自加解密往返正常，只是库里旧密文对不上新密钥）。**修复**：从仍有效的本地 token 重新取明文，用**生产当前密钥**再加密落库一次；回读解密 OK、以用户身份调通讯录 HTTP 200 复验通过。
>
> **运维判据**：`decrypt_user_token()` fail-closed（密钥不匹配直接抛错）。每次生产部署/密钥轮换后，任何用旧密钥加密的凭据（user_oauth / app_secret）都可能失效，需复查。持续可用性由 invoke 链路的 `_make_refresh_persister` 保障：token 刷新后用**当时密钥**重新加密回写，新密文自洽；但刷新前若密钥已轮换、旧 refresh_token 密文解不开则无法刷新——此时需重新授权或重新落库。

### 7.3 端到端验证：「AI 以本人身份调通讯录」成功

用落库的**用户 userAccessToken**（非应用 token）实测钉钉新版接口：

| 验证 | 结果 | 判定 |
| --- | --- | --- |
| 以用户 token 调 `/v1.0/oauth2/userinfo` | **HTTP 200**，拿到本人 `unionId=UhE62XV5MoKtr9...` | 用户身份令牌有效 |
| 以用户 token 调 `GET /v1.0/contact/users/{unionId}`（scope=`Contact.User.Read`，即任务目标 operation） | **HTTP 200**，返回 `nick/unionId/avatarUrl/openId/mobile/stateCode/visitor` | ✅ **AI 已能以本人身份成功调用通讯录接口，任务验收达成** |
| 对照：以用户 token 调 `/contact/users/search` | 403 `requiredScopes:["qyapi_addresslist_search"]` | 该 search 是旧版 scope、应用未开，与 `Contact.User.Read` 无关；改用详情接口即用 |

> **结论**：`Contact.User.Read` 详情接口在用户身份下鉴权通过并返回真实数据，任务 #35 的完整验收（真人授权 + 以本人身份调用）全部达成。应用权限侧（第六节 API 实测 + 他席后台 UI 双确认）与用户授权侧（本节）双双闭环。

---

## 八、扫码被拦 `redirect_uri参数错误` 的真实根因（2026-11-25 23:xx 补记）

用户扫码后钉钉报红条 **`redirect_uri参数错误，请修改或在钉钉开放平台的「应用开发」->「登录与分享」中配置相应的回调域名`**，不是用户不配合，是后台白名单缺项：

- **现场实测**：应用 `dingojemqcxfzr2f5xzd`（AI智汇社区，agent_id `4012380713`）后台「登录与分享 → 接入登录 → 回调域名」白名单里**只有** `http://localhost:8801/callback?platform=dingtalk` 和 `https://bsm.aizhs.top`（各重复一遍），**没有** `https://aizhs.top/callback?platform=dingtalk`。而平台 authorize 生成的 `redirect_uri` 正是后者 ⇒ 钉钉逐字比对失败 ⇒ 扫码后被拦。
- **修正**：在该白名单输入框末尾追加 `,https://aizhs.top/callback?platform=dingtalk` 并点「添加」，确认它出现在下方已登记列表；修正后重开授权页，红条消失、出现「此账号已在使用，可直接登录」+「立即登录」按钮（钉钉登录态在时无需再手机扫码）。
- **教训**：第二节那句"回调地址已配置、无需再改"是错的静态结论——它描述的是**平台侧** `_resolve_oauth_redirect_uri` 的返回值（凭据 `extra.redirect_uri`），不是**钉钉后台**白名单实际登记值，二者曾长期不一致且因无人真正走完授权而一直没暴露。排查此类报错必须进后台 UI 现读白名单，不能信代码注释或本文档旧描述。

### 8.1 state 有效期（`STATE_TTL_SECONDS=600`）

手写/脚本生成的合法 state（用生产 `connector_oauth.make_state`，密钥从 `CREDENTIALS_ENCRYPTION_KEY` 派生）只有 **10 分钟** TTL；生成后拖延过久再回调会被 `verify_state` 判「state 已过期或时间异常」，日志乱码看起来像「签名校验失败」，实为过期。生成 state 后应立即完成授权回调；调试中断要重新生成。state 的 `owner(o)` 必须非空且等于落库作用域（个人模式=`user_id`），否则 callback 第 540 行直接拒。


---

## 九、2026-11-26 00:18-00:30 真人授权复查（三个反直觉陷阱）

李总在回调页完成授权后要求"点完了 你看"。复查确认**授权已真正落库、端到端可用**，但排障途中连踩三个反直觉坑，记此备查：

| 现象 | 误判 | 真相 |
| --- | --- | --- |
| 回调页回到主站首页、显示「请先登录」 | 以为前端没转发 code、授权失败 | 前端 `OAuthCallbackHandler` 无平台登录态时不展示结果，但**后端 callback 已执行并落库**。判据是查库 `updated_at`，不是看页面提示 |
| 拿回调 URL 里的 code 再直调一次 callback → 500「用户授权处理失败」 | 以为 token 没落库 | 钉钉 `authCode` **一次性**；前端那次已消费，二次调用在 `userAccessToken` 换 token 时返回 400（`[oauth] 回调失败: Client error '400 Bad Request'`），属正常重复消费，**不影响已落库 token** |
| 用生产 venv + 密钥文件 `data/credentials_key` 解密 `user_oauth` → `InvalidTag` | 以为密文损坏、要重新授权 | 生产服务由 NSSM `AppEnvironmentExtra` 注入 **`PUBLISH_CREDENTIALS_KEY`**（优先级高于密钥文件）。ssh 脚本进程没继承该环境变量 ⇒ 回退到密钥文件（指纹 `26b9d5332dd3`）⇒ 与加密主密钥（指纹 `f727973d…`）不匹配。**验证脚本必须注入同一个 `PUBLISH_CREDENTIALS_KEY` 才能解密** |

### 9.1 复查实测结论（生产库 + 生产密钥）

- 生产库 `dingtalk:user-oauth`（owner=None，租户 `17568535-...`）`updated_at=2026-11-25T16:19:27Z`（本地 00:19:27），`extra.user_oauth` 有 `enc:user-oauth:v1:` 密文。
- 注入 NSSM 的 `PUBLISH_CREDENTIALS_KEY` 后解密成功：`DECRYPT_OK=True has_refresh=True`，访问令牌 2h 有效期。
- **端到端验收**：以用户 token 调 `GET /v1.0/contact/users/me`（新版钉钉**没有** `/v1.0/oauth2/userinfo`，该端点返回 `InvalidAction.NotFound`，别再照旧文档用）→ **HTTP 200**，返回本人 `unionId=UhE62XV5MoKtr9RPZMETqQiEiE`、`nick`、`mobile=186****9808`、`openId`、`avatarUrl`。AI 以本人身份读通讯录能力确认可用。
- `GET /v1.0/contact/users/{unionId}` 的 unionId 必须**完整**，截断前缀会 `invalidParameter.user.notFound`；`/contact/users/me` 无需 unionId，最省事。

### 9.2 生产凭据验证正确姿势（下次照抄）

1. 生产服务密钥**不在密钥文件**，在 NSSM：`Get-ItemProperty 'HKLM://SYSTEM//CurrentControlSet//Services//IHUI-AI-SERVICE//Parameters' -Name AppEnvironmentExtra` 取 `PUBLISH_CREDENTIALS_KEY`。
2. 解密/端到端脚本，进程内先 `os.environ["PUBLISH_CREDENTIALS_KEY"]=<上面的值>`，**再** import `credentials_crypto`（进程级单例，import 时锁定密钥）。
3. 生产 `connector_store` 路径是 `app.services.connector_store`（不是 `app.services.connectors.connector_store`），用 `importlib.import_module` 避包导出差异。
4. 验证用户身份连接器读能力直接用 `/v1.0/contact/users/me`，header `x-acs-dingtalk-access-token: <userAccessToken>`，200 + 本人 unionId 即达标。
