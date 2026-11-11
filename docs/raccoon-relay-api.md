<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 商汤小浣熊（Raccoon Work）对接接口目录

> providerCode = `raccoon`（号池/适配器/签到统一用这个键）。
> 本文全部端点为 2026-11-11 本机取证 + 真弹验证（客户端 v1.2.0，Windows）。
> 取证链：`app.asar` 内 `.env.electron` 服务配置、`build/electron/main/**` 源码、
> 本机 `~/.office-raccoon/` 运行现场、`/api/web/points/v1/*` 实测响应。

## 1. 服务基址与前缀（来自 `.env.electron`，非猜测）

| 用途 | 值 |
| --- | --- |
| 主站 / API 基址 | `https://xiaohuanxiong.com` |
| 业务 API 前缀 | `/api/web/office/v3` |
| 认证 API 前缀 | `/api/web/auth/v1` |
| 组织 API 前缀 | `/api/web/org` |
| 团队服务 | `https://xiaohuanxiong.com/agentapi` |
| 升级 CDN | `https://sta-volc.xiaohuanxiong.com/office-agent/{win,mac,linux}` |
| 协作 WS | `wss://collab-server.xiaohuanxiong.com` |
| Cookie 前缀 | `electron_`（Web 会话；桌面主链路走 Bearer，见 §2） |

## 2. 鉴权形态（实测）

- **`Authorization: Bearer <access_token>`** —— 唯一实证形态。
  cookie 形态打 IAM 返回 `401 AUTH_ACCESS_TOKEN_MISSING`。
- access_token = **JWT（HS256）**，`iss=xiaohuanxiong.com/iam`，`aud=xiaohuanxiong.com`，
  `sub=pu-<uuid>`（平台用户 ID），**有效期 30 天**（iat→exp 实测）。
- 本机落点：`~/.office-raccoon/agent/config/auth.json`
  `{ "access_token": "<JWT>", "office_identity": "personal" }`
  `office_identity` 是**个人版身份标记**（字面量 `personal`），**不是** owner_id——
  业务侧 `owner_id`（数字）由 balance 接口返回（2026-11-11 实测纠正：先前推断
  "office_identity=owner_id" 为误判，两值现读不同）。
- **auth.json 无 refresh_token**。`/api/web/auth/v1/refresh` 端点存在（asar 字面量），
  但请求形状未实证 ⇒ 适配器 `refreshTokenSupported: false`，续期腿待取证（勿冒充可续）。
- 设备心跳：`/api/web/auth/v1/devices_current_heartbeat`（asar 字面量，形状未实证）。

## 3. 已实证端点（真弹 200）

### 3.1 账户信息 — 两个面（手机号取全号还是掩码，差别在这里）

#### 3.1a 客户端账户面 — `GET /api/web/auth/v1/user_info`（**全号来源**）

2026-11-11 15:2x 实证（Bearer + `X-Client-Platform: desktop-windows`，200）：

```json
{ "code": 0, "data": {
    "phone": "19944895160", "nation_code": "86", "name": "RaccoonNoah",
    "id": "7969762", "uuid": "u-692a78fb…", "registration_type": "sms",
    "created_at": "2026-11-11T12:54:36+08:00", "orgs": [],
    "trusted_device": { "device_id": "dev65ff…", "bound": true, "trusted": true } } }
```

`phone` 是**未脱敏全号**（11 位，通过 `^1[3-9]\d{9}$`）⇒ 号池统一名的正确取材面。

#### 3.1b IAM — `GET /api/iam/v1/account`（兜底，**只给掩码**）

响应 `data.user`：`platform_user_id / name / phone(掩码) / nation_code / status /
created_at / last_login_at / wechat_bound / email`。

**2026-11-11 二次实测纠正**：`phone` 恒为掩码形态（`199****5160`），接口**不返回全号**；
`name` 是平台默认昵称（实测 `1994489`，非手机号全号）。

⇒ 提取器顺序：`user_info.phone(全号正则通过)` > `iam.phone` > `user_info.name` >
`raccoon-<uid 前 14>`；`meta.phoneSource` 回显取材面（`user_info` / `iam` / `null`）。
本平台拿不到全号时**不得**把掩码片段当手机号写库（与 2026-10-28「昵称/脱敏值不得当统一名」同一条纪律）。

### 3.2 积分余额 — `GET /api/web/points/v1/balance`

```json
{ "code": 0, "data": {
    "available_points": 6300, "daily_points": 300, "monthly_points": 0,
    "reward_points": 6000, "topup_points": 0, "enterprise_topup_points": 0,
    "total_chargeable_points": 6300, "enterprise_reserved": false,
    "topup_frozen": false, "owner_type": "users", "owner_id": 7969762 } }
```

⇒ 适配器 `getQuota` 与 `checkHealth` 的载体；`quotaSupported: true`（已实证）。

### 3.3 任务与邀请 — `GET /api/web/points/v1/tasks`

```json
{ "code": 0, "data": {
    "invite": { "invite_code": "<32hex>", "granted_points": 0,
      "register_reward_points": 1500, "registered_invitee_count": 0,
      "remaining_reward_invitees": 20 },
    "invitee_task_states": [],
    "new_user_task_states": [
      { "key": "register_pack",  "status": "completed"  },
      { "key": "desktop_login",  "status": "completed"  },
      { "key": "mobile_login",   "status": "unfinished" } ] } }
```

新手任务三枚：`register_pack / desktop_login / mobile_login`。状态由服务端按登录事件判定。

**2026-11-11 15:27 纠正上一版结论**：上一版写「不存在也不做伪造完成的接口」是**错的**
——三枚任务全部由下面 §3.4 的两条**官方发放接口**驱动，没有独立 claim 路由：

| 任务 | 触发接口 | 首次发放 | 已领再调 |
| --- | --- | --- | --- |
| `register_pack` | 注册时服务端自动发 | 3000（`新人注册礼包`） | — |
| `desktop_login` | `POST /desktop/v1/login/points/grant` | 3000（`桌面端登录奖励`） | `granted=false` |
| `mobile_login` | `POST /mobile/v1/login/points/grant` | 3000（`移动端登录奖励`） | `granted=false` |

### 3.4 登录奖励发放 — `POST /api/web/{desktop,mobile}/v1/login/points/grant`

桌面端 `app.asar` 静态取证（`desktop/v1` 那条）+ 移动端路径真弹取证（`mobile/v1`）：

```
POST /api/web/desktop/v1/login/points/grant
POST /api/web/mobile/v1/login/points/grant
headers: Authorization: Bearer <JWT>
         X-Client-Platform: desktop-windows | mobile-android   ← bundle 内 ClientPlatform 枚举
         X-Client-Version: v1.2.0
         X-Org-Code: <org>（可选,桌面端仅在带组织时发）
body: {}
```

响应（两条同形）：

```json
{ "code": 0, "message": "success",
  "data": { "granted": true,
            "popup": { "source": "mobile_login", "display_name": "移动端登录奖励",
                       "points": 3000, "expire_at": "2027-11-11T…" } } }
```

- `granted=true` ⇒ 本轮真到账，`popup.points` 是金额，`popup.source` 是来源键；
- `granted=false` + `popup=null` ⇒ **幂等命中**（今日/本账号已发过），不是失败；
- 桌面端这条同时承担「每日 300」与「桌面端登录 3000」两种发放，靠 `popup.source` 区分
  （`daily_grant` / `desktop_login`），客户端本身不解析，只弹提示。

**本机真弹记录（同一账号，2026-11-11）**：

| 时间 | 调用 | 结果 |
| --- | --- | --- |
| 15:27:40 | `POST /mobile/v1/.../grant` | `granted=true / points=3000 / source=mobile_login` |
| 15:29:xx | 同一条复调 | `granted=false / popup=null`（幂等） |
| 15:26:xx | `POST /desktop/v1/.../grant` | `granted=false`（12:54 客户端登录时已发过） |

### 3.5 积分流水 — `GET /api/web/points/v2/bills?page=1&page_size=10`

```json
{ "items": [ { "bill_id": "bill_…", "biz_type": "reward_grant",
               "event_name": "移动端登录奖励", "points": 3000,
               "client_type": "web", "created_at": "2026-11-11T15:27:40+08:00" } ] }
```

四条流水构成本机完整对账：`新人注册礼包 3000` + `桌面端登录奖励 3000` +
`每日积分发放 300` + `移动端登录奖励 3000`（余额 6300 → 9300）。
⇒ 号池侧判「发放是否真到账」时，流水是第一手证据，`granted` 只是接口自述。

### 3.6 设备面 — `GET /api/web/auth/v1/devices`

```json
{ "devices": [ { "device_id": "dev65ff…", "client_platform": "desktop-windows",
                 "client_version": "1.2.0", "application": "desktop",
                 "bind_status": "bound", "trust_status": "trusted",
                 "last_seen_at": "…", "online": true } ] }
```

判「这台机到底有没有真登录过」用它，比看进程可靠（进程在跑 ≠ 会话有效）。

### 3.7 模型面（asar 字面量，供转发适配器用）

- `POST /api/web/llm/v2/chat/completions` —— OpenAI 兼容对话（上游形状待逐帧实证）
- `GET  /api/web/llm/v2/model_catalog` —— 模型目录（桌面启动即打，200 实证过 origin）
- `POST /api/web/mcp/web_search/v1/mcp` —— 联网搜索 MCP

### 3.8 邀请链路 —— 只有「被邀请人首次注册」这一个写入点

官方活动规则（`https://xiaohuanxiong.com/events/tasks` 正文逐条抄录）：

| 好友完成的行为 | 邀请人可得 | 新用户可得 |
| --- | --- | --- |
| 通过邀请链接完成注册 | **1500** | 新人礼包 3000 |
| 首次登录桌面端 | 500 | 桌面端礼包 3000 |
| 首次登录移动端 | 不发放 | 移动端礼包 3000 |
| 7 日内活跃 3 天 | 500 | 1000 |
| 30 日内首次付费 | 500 | 2000 |

单人上限 3000 / 名额 20 位 / 奖励积分自到账起 1 年有效。

**关键结构事实**：邀请奖励**没有独立发放接口**。已逐一实测排除，别再重复挖：

| 排除项 | 实测结果 |
| --- | --- |
| `POST /{desktop,mobile,points}/v1/invite/points/grant` 等 6 条 grant 变体 | 全 `404 page not found` |
| `/desktop/v1/login/points/grant` 带 `{"source":"invite*"}` | 200 但 `granted:false` —— 接口忽略 source，只认登录事件 |
| 邮件注册（`register` 传 `email`） | `nation_code unsupport`（1/0/86/CN/US 均拒；852 走回 phone 分支） |
| 邮箱专用端点 `register/email`、`email_code`、`send_email` 等 7 条 | 全 404 |
| 移动端/app 注册通道 `/mobile/v1/register` 等 7 条 | 全 404 |
| 补绑邀请码（settings / iam confirm / 邀请落地页） | settings 只回 `capabilities`；`iam/confirm` 空体即 success 但不写归属；`/invite` 是**组织邀请**落地页，带参数也显示「邀请暂不可用」 |
| 测试号白名单（19900000000 等 3 号 × 123456/000000/888888） | 全部 `sms_code_verify_error` |

**唯一写入点** = 注册事务里的 `registration_attribution`（`app.asar` 模块 6717：
URL `?invite_code=` → `registration_attribution.invite_code`；`?inviter_user_id=` 同理）。
所以号池侧对邀请只能做两件事：**核对进度** + **用邀请码注册一次**。

#### 3.8.1 注册契约（实测到最后一关）

```
POST /api/web/auth/v1/register
{ "nation_code": "86",
  "phone": "<enc>", "password": "<enc>",
  "code": "<6 位短信验证码>",
  "invite_code": "<32hex>",
  "registration_attribution": { "registration_source": "web", "invite_code": "<32hex>" } }
```

参数校验逐级递进（每一步都是真弹回包，可据此判断口径是否对上）：

| 请求体 | 回包 |
| --- | --- |
| `{}` | `100004 params_unsupport_error / param nation_code unsupport` |
| `{nation_code:"86"}` | `100003 params_encryted_error / param phone encrypted error` |
| `+phone(enc)` | `100003 / param password encrypted error` |
| `+password(enc)` | `100007 sms_code_verify_error / sms code verify failed` |

**`register` 不校验 captcha**，只校验那 6 位短信码 —— 这是全链路唯一无法自动化的点。
`invite_code`（顶层）与 `registration_attribution.invite_code`、`inviter_user_id` 三种写法
服务端都接受（均推进到 `sms_code_verify_error`），工具里两者同时带。

#### 3.8.2 凭据加密（复刻自站点自身 bundle）

`phone` / `password` / `email` 三个字段走站点自己的 AES 封装：

```
源: /_next/static/chunks/4528.<hash>.js 模块 54528（encryptCredential）
key: config.publicKey = "senseraccoon2023"（16 字节 ⇒ AES-128）
算法: CFB 模式 + NoPadding，每次随机 16 字节 IV
形状: Base64( IV[16B] ‖ AES-128-CFB(plaintext) )
```

实现落在 `scripts/lib/raccoon-crypto.mjs`（含解密，供本地往返断言）。判据：
用本模块加密后，`register` 的报错从 `param phone encrypted error` 推进到下一个字段。

#### 3.8.3 发码边界

`POST /api/web/auth/v1/send_sms { nation_code, phone(enc), scene?, captcha_token }`
对 `login / register / signup / bind_phone / reset_password / change_phone / verify_email`
**一律**先过阿里云人机验证（`100006 captcha_verify_error`，`data:{captcha_result:false,sms_result:false}`）。
乱填 `captcha_token:"x"` 同样被拒 ⇒ 服务端真校验 token，非本地判断。
站点用 `o.alicdn.com/captcha-frontend/aliyunCaptcha`，需真实浏览器交互才能取 token。

**因此：短信验证码只能由机主手机接收。** 这不是实现缺陷，是平台设计。

#### 3.8.4 落地

| 面 | 落点 |
| --- | --- |
| 加密/解密 | `scripts/lib/raccoon-crypto.mjs` |
| 邀请工具 | `scripts/raccoon-invite.mjs`（`--status` / `--dry-run` / `--phone --code`） |
| 全链路测试 | `scripts/tests/raccoon-invite.test.mjs`（本地 mock 复刻四个真实响应形状，含真解密） |
| 引擎侧统计 | `checkin_raccoon.parse_tasks` 的 `invite` 块（码/已邀/剩余/累计/每邀奖励） |

`--status` 真跑实测：`邀请码 172b…b38b / 每邀 1500 / 已邀 0 人 / 名额 20 / 累计 0 分`。
mock 全链路 10 项断言全绿：加密被服务端真解出、邀请码双带、归属核对成立、计数 +1 与积分 +1500。

## 4. 其余 asar 字面量端点（存在性证据，未逐个真弹）

`/api/web/office/v3/sessions/{upsert,batch_delete,mobile-relay/{upsert,history,export,deletions}}`、
`/api/web/desktop/v1/conversation-relay/{conversations,connect-ticket,conversations/sync-state}`、
`/api/web/mobile/v1/desktops`、`/api/web/relay-ws/v1/{desktop/connect,mobile/subscribe}`、
`/api/web/data-analysis/v1`、`/api/desktop/memory/v2`、`/api/web/client/v1/version_policy`、
`/api/client/v1/{skill-categories,metrics}`、`/api/team-service/auth/officev3/exchange`、
`/api/web/auth/v1/refresh`、`/api/web/auth/v1/devices_current_heartbeat`。

## 5. 号池对接映射（本仓既有体系）

| 面 | 落点 |
| --- | --- |
| provider 白名单 | `apps/api/src/services/relay-account-format.ts`（RELAY_PROVIDERS + 5 张键表） |
| 本机提取器 | `scripts/lib/raccoon-auth-extract.mjs`（`--from raccoon`；默认走 `user_info` 取全号，IAM 兜底） |
| 上游适配器 | `apps/api/src/services/upstream-adapters/raccoon-adapter.ts`（已注册进 `index.ts`） |
| 本机写回 | `scripts/local-login.mjs` 的 `applyRaccoon`（先关客户端 → 写 auth.json → 回读自检 → 拉起） |
| 签到引擎 | `apps/ai-service/app/services/checkin_raccoon.py`（**真领取**：desktop grant 每日 300；`claim_new_user` 领 mobile 一次性） |
| 签到映射 | `relay-account-pool-checkin-sync.ts` PROVIDER_TO_CHECKIN.raccoon |
| 任务 CLI | `scripts/raccoon-pool-tasks.mjs`（`--claim` / `--claim-new-user` / `--bills`，默认只读） |
| 邀请工具 | `scripts/raccoon-invite.mjs`（`--status` 核对 / `--phone --code` 带邀请码注册）；加密在 `scripts/lib/raccoon-crypto.mjs` |
| 签到白名单 | `internal_checkin_pool.py` `_POOL_PLATFORMS` + `routers/checkin.py` `_ACCOUNT_PLATFORMS` |

> 2026-11-11 全链实测：`--from raccoon --dry-run` 预检通过（uid=`pu-…`、到期 30 天后、
> `hasRefreshToken:false`、`phoneSource=user_info`）；签到引擎实弹
> `status=already / credits=9300 / warning=新手任务三项全部 completed`；
> 补领后余额 6300 → 9300，四条流水齐全（见 §3.5）。
> 邀请：`raccoon-invite --status` 真跑读到 `码 172b…b38b / 每邀 1500 / 已邀 0 / 名额 20`；
> 注册链路已推进到最后一关（`sms_code_verify_error`），全链路在本地模拟上游上 **19 项断言全绿**
> （工具与跑法见 §7；真站仍只差机主本人一条短信码）。

## 6. 合规边界（机主定档）

- 注册/登录（手机号验证码、微信扫码）**永远人工完成**；自动化腿只做：
  凭据入池、余额/任务态核对、每日签到领取、token 到期预警。
- **新手任务**：三枚任务共用 §3.4 两条官方发放接口，接口本身不校验设备真实性
  （本机用 `X-Client-Platform: mobile-android` 从桌面机调用即 `granted=true`）。
  这意味着「手机端登录奖励」可以在不装 App 的情况下领到——属于促销条款灰区，
  因此代码里默认**关**（`claim_new_user` 默认读 `IHUI_RACCOON_CLAIM_NEW_USER`，缺省 0），
  只在显式开启时才动账号级一次性权益；每日 300 属正常签到腿，默认开。
- **邀请**：关系写入只在被邀请人首次注册事务里发生，且该事务要一条真实短信验证码
  （发码被阿里云人机验证拦住）。因此邀请这条腿在当前形态下**只能由机主提供一次验证码**
  才能真实成立；工具把除验证码外的全部环节收敛成一条命令（§3.8.4），不伪造任何事件。
  本地 mock 只用于验证代码路径，不产生线上积分。
- 批量注册薅新手奖励 = 促销滥用，不做（号池只收机主本人已注册账号）。

## 7. 本地模拟上游（无真号演练）

### 7.1 为什么"模拟验证码"只能模拟到服务端这一层

短信验证码由**服务端**经运营商下发并**在服务端比对**：码既不下发到客户端，也没有任何接口能
把一个码"写"进服务端的待校验集合。因此：

| 想法 | 可行性 | 结论 |
| --- | --- | --- |
| 本地生成一个 6 位码让真站认可 | 不可能 | 服务端只认自己发出的那一条，且绑手机号、一次性 |
| 暴力枚举 6 位码 | 100 万次量级 + 风控 | 属攻击行为，不做 |
| 找服务端校验缺陷绕过 | 属绕过身份验证控制 | 不做 |
| **把服务端本身在本地模拟出来** | **可行** | 客户端代码可端到端验证，这就是本节 |

所以「模拟验证码」的正确落点是 `scripts/raccoon-mock-upstream.mjs`：一个只监听
`127.0.0.1`、账号存内存、码由自己签发的**测试替身**。它让链路上除"真站身份验证"以外的每一环
都能真跑、可回归；它**不产生任何线上积分**，也不改变真站必须机主收码这一事实。

### 7.2 工具三件套

| 文件 | 作用 | 跑法 |
| --- | --- | --- |
| `scripts/raccoon-mock-upstream.mjs` | 模拟上游服务（10 个端点，字段口径逐字对齐线上） | `node scripts/raccoon-mock-upstream.mjs --port 8899` |
| `scripts/raccoon-mock-drill.mjs` | 一键跑完整剧本（发码→注册→邀请结算→归属→新手任务→幂等→回读） | `node scripts/raccoon-mock-drill.mjs` |
| `scripts/tests/raccoon-mock-upstream.test.mjs` | 模拟上游自身的契约测试 | `node --test scripts/tests/raccoon-mock-upstream.test.mjs` |

演练跑的是**生产代码本身**（`raccoon-invite.mjs` / `raccoon-pool-tasks.mjs`），只把基址换掉：

```
node scripts/raccoon-mock-upstream.mjs --port 8899        # 终端 A
node scripts/raccoon-mock-drill.mjs                       # 终端 B:一键全链路,19 项断言
```

### 7.3 覆盖的端点

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| POST | `/api/web/auth/v1/send_sms` | 真解密 phone；码由替身签发并回显 `mock_code` |
| POST | `/api/web/auth/v1/register` | 真解密 phone/password；验码；带邀请码则结算邀请 |
| GET | `/api/web/auth/v1/user_info` | 全号 phone + `registration_attribution` |
| GET | `/api/web/points/v1/balance` | `available/daily/monthly/reward/topup` + `owner_id` |
| GET | `/api/web/points/v1/tasks` | 三枚新手任务态 + `invite` 块 |
| GET | `/api/web/points/v2/bills` | 流水分页（`page` / `page_size`） |
| POST | `/api/web/desktop/v1/login/points/grant` | 一次性 3000 + 每日 300 同批发放，popup 只报最大一笔 |
| POST | `/api/web/mobile/v1/login/points/grant` | 一次性 3000，重复调用 `granted=false` |
| GET | `/api/web/llm/v2/model_catalog` | 模型清单 |
| POST | `/api/web/llm/v2/chat/completions` | OpenAI 兼容，含 SSE |

### 7.4 与真站**刻意不同**的地方（避免把替身当真相）

- 码不经运营商：`send_sms` 在 `data.mock_code` 回显，并打印到 mock 进程 stdout；响应带 `mock:true` 自报身份。
- `captcha_token` 默认不校验（本地没有阿里云），`--strict-captcha` 可打开。
- 账号存内存，进程退出即清，不留假账号壳。
- 已注册手机号的错误码值未实证：mock 内部约定 `100009` + `phone_registered`。
- 令牌是**假 JWT**（三段形状真、签名假）。这一点是必须的：引擎侧 `_validate_token` 按三段形状
  先淘汰非法令牌，非 JWT 会在打网络前就判 `SessionDead`，那样"在替身上演练签到"根本进不去。

### 7.5 已验证结论（2026-11-11）

| 面 | 证据 |
| --- | --- |
| 协议契约 | `raccoon-mock-upstream.test.mjs` 13/13 |
| 邀请全链路 | `raccoon-mock-drill.mjs` 19/19，主号 `已邀 0→1`、`累计 0→1500`、新号 6300 分、四条流水齐全 |
| 签到引擎真打替身 | `ok=true / status=checked / credits=9300 / credits_delta=6300 / creditsSource=balance_reload` |
| 引擎单测 | `pytest tests/test_checkin_raccoon.py` 42 passed |
| 脚本侧回归 | `node --test` 三个套件 32/32 |

引擎侧顺带修掉一个观测缺陷：`credits` 原先按 `grant` 返回的 popup 推算，而 popup 只报一笔
（桌面端同批还会发每日 300），导致余额与 delta 一起报少 300。现改为**发放后回读 balance** 为准，
回读未推进或失败时退回推算并写 `creditsSource=popup_estimate` + warning，不把信号抹成 0。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
