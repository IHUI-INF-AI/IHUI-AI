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

### 3.3 任务态 — `GET /api/web/points/v1/tasks`

```json
{ "code": 0, "data": {
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
| 签到白名单 | `internal_checkin_pool.py` `_POOL_PLATFORMS` + `routers/checkin.py` `_ACCOUNT_PLATFORMS` |

> 2026-11-11 全链实测：`--from raccoon --dry-run` 预检通过（uid=`pu-…`、到期 30 天后、
> `hasRefreshToken:false`、`phoneSource=user_info`）；签到引擎实弹
> `status=already / credits=9300 / warning=新手任务三项全部 completed`；
> 补领后余额 6300 → 9300，四条流水齐全（见 §3.5）。
> 每日签到在本地模拟上游上 **11 项断言全绿**（`raccoon-mock-drill.mjs`，工具与跑法见 §7；
> 真站注册的最后一道关是机主本人一条短信验证码，与每日签到无关）。

## 6. 合规边界（机主定档）

- 注册/登录（手机号验证码、微信扫码）**永远人工完成**；自动化腿只做：
  凭据入池、余额/任务态核对、每日签到领取、token 到期预警。
- **新手任务**：三枚任务共用 §3.4 两条官方发放接口，接口本身不校验设备真实性
  （本机用 `X-Client-Platform: mobile-android` 从桌面机调用即 `granted=true`）。
  这意味着「手机端登录奖励」可以在不装 App 的情况下领到——属于促销条款灰区，
  因此代码里默认**关**（`claim_new_user` 默认读 `IHUI_RACCOON_CLAIM_NEW_USER`，缺省 0），
  只在显式开启时才动账号级一次性权益；每日 300 属正常签到腿，默认开。
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
| `scripts/raccoon-mock-drill.mjs` | 一键跑每日签到剧本（发码→注册→新手任务→幂等→回读余额） | `node scripts/raccoon-mock-drill.mjs` |
| `scripts/tests/raccoon-mock-upstream.test.mjs` | 模拟上游自身的契约测试 | `node --test scripts/tests/raccoon-mock-upstream.test.mjs` |

演练跑的是**生产代码本身**（`raccoon-pool-tasks.mjs` 客户端编排层 + `checkin_raccoon.py` 引擎层），只把基址换掉：

```
node scripts/raccoon-mock-upstream.mjs --port 8899        # 终端 A
node scripts/raccoon-mock-drill.mjs                       # 终端 B:一键每日签到,11 项断言
```

### 7.3 覆盖的端点

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| POST | `/api/web/auth/v1/send_sms` | 真解密 phone；码由替身签发并回显 `mock_code` |
| POST | `/api/web/auth/v1/register` | 真解密 phone/password；验码（演练注册用，仅建账号、不结算任何奖励） |
| GET | `/api/web/auth/v1/user_info` | 全号 phone + `registration_attribution` |
| GET | `/api/web/points/v1/balance` | `available/daily/monthly/reward/topup` + `owner_id` |
| GET | `/api/web/points/v1/tasks` | 三枚新手任务态 |
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
| 协议契约 | `raccoon-mock-upstream.test.mjs` 12/12 |
| 每日签到演练 | `raccoon-mock-drill.mjs` 11/11，账号A 余额 6300、账号B 引擎积分 9300（增量 +6300）、当日重复 `status=already`、四条流水齐全 |
| 签到引擎真打替身 | `ok=true / status=already / credits=9300 / credits_delta=6300 / creditsSource=balance_reload` |
| 引擎单测 | `pytest tests/test_checkin_raccoon.py` 37 passed |
| 脚本侧回归 | `node --test` 两套件 21/21（pool-tasks 9/9 + mock-upstream 12/12） |

引擎侧顺带修掉一个观测缺陷：`credits` 原先按 `grant` 返回的 popup 推算，而 popup 只报一笔
（桌面端同批还会发每日 300），导致余额与 delta 一起报少 300。现改为**发放后回读 balance** 为准，
回读未推进或失败时退回推算并写 `creditsSource=popup_estimate` + warning，不把信号抹成 0。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
