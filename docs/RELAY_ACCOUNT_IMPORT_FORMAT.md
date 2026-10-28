<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 号池导入 JSON 格式规范

> 适用范围:`/api/admin/relay/accounts/import`、[apps/api/scripts/relay-account-import-validate.ts](../apps/api/scripts/relay-account-import-validate.ts) 与一键导入工具 [apps/api/scripts/relay-import-qoder.ts](../apps/api/scripts/relay-import-qoder.ts)
> 判据单源:[relay-account-format.ts](../apps/api/src/services/relay-account-format.ts)

## 1. 两种形状

### 1.1 导出文件(浏览器插件/导出工具直接产出)

```json
{
  "accounts": [
    {
      "name": "账号501",
      "token": "<JWT access token>",
      "refreshToken": "<刷新凭证>",
      "deviceId": "",
      "machineId": "",
      "enabled": true,
      "cookies": [
        {
          "name": "d_ticket",
          "value": "<cookie value>",
          "host_key": ".trae.cn",
          "path": "/",
          "expires_utc": 13467354232000000,
          "is_secure": false,
          "is_httponly": false
        }
      ]
    }
  ]
}
```

顶层也接受裸数组 `[{ ... }]`,导入前会被包装成同样的结构。

### 1.2 导入接口请求体

接口在导出文件外面加一层 `providerCode`:

```json
{
  "providerCode": "trae",
  "accounts": [ ... 与 1.1 相同 ... ]
}
```

`providerCode` 取值:`trae` | `workbuddy` | `codearts` | `qoder`。
`accounts` 单批最多 **500** 条。

## 2. 账号字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string ≤128 | 否 | 展示名;缺省按 `phone` → 平台特化字段 → `#序号` 兜底(2026-10-28 O66 统一口径) |
| `phone` | string ≤128 | 否 | 全平台通用展示名兜底(手机号优先):`name` 缺省时先于平台昵称/标签生效 |
| `token` | string | trae/workbuddy/qoder 必填 | JWT access token(trae/workbuddy)或 Qoder opaque 串(dt- 前缀);codearts 见 §3 |
| `refreshToken` | string ≤128 | 否 | 缺失时过期号入库即摘除 |
| `deviceId` | string ≤128 | 否 | 设备指纹;web 聊天链路不强制 |
| `machineId` | string ≤128 | 否 | 同上;Qoder 侧同时进 Cosy-MachineId 请求头 |
| `enabled` | boolean | 否 | 默认 `true`;必须是布尔值 |
| `cookies` | array | 否 | Chrome 导出格式,见 §4 |
| `proxyUrl` | string ≤512 | 否 | 账号级出口代理,`http(s)://` 或 `socks5://` |
| 其他字段 | any | 否 | 原样透传进 `extraMetadata`(平台扩展用) |

## 3. 非 JWT 平台专用字段

以下两族的凭证都不是三段式 JWT,uid/过期时刻必须显式传入(缺省退化为哈希 uid + 无过期时间)。

### 3.1 Qoder(2026-10-23 立)

Qoder 桌面端(`com.qodercn.app.*`/`com.qoder.app.*`)登录态:token 是 27 字符 **opaque 单段串**(`dt-` 前缀,真机实证),uid 真源是会话 JSON 的 `user.id`(桌面端 `checkin_capture.rs` 从 `auth.v1.dat` 解密提取)。导入条目认以下字段:

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `token` | 是 | `dt-…` access token(auth.v1.dat 的 `token`) |
| `refreshToken` | 否 | `drt-…`(auth.v1.dat 的 `refreshToken`);有它调度器才能自刷新 |
| `uid` | 否* | 账号唯一 id(auth.v1.dat 的 `user.id`);缺省时按 token 哈希去重 |
| `expiresAt` | 否* | access token 到期:ISO 8601 字符串(如 `2026-11-21T11:38:26Z`)或 epoch 秒;缺省则无过期时间、不临期刷新 |
| `refreshTokenExpiresAt` | 否 | refreshToken 到期(ISO/epoch),落 `extraMetadata.refreshTokenExpiresAt` |
| `nickname` | 否 | `name`/`phone` 均缺省时的展示名兜底 |
| `phone` | 否 | 展示名兜底(§2 通用字段,手机号优先于 `nickname`) |
| `machineToken` / `machineCode` / `machineType` / `version` | 否 | Cosy-* 设备头族(客户端 `runtime-info.exe` 产出),落 `extraMetadata.cosy`,刷新/健康检查时带上 |

\* 不填不阻塞导入,但 uid 退化为 `auto:sha256(token)[:32]`、无过期时刻——桌面端捕获的会话应尽量带全。

> **Cosy 设备头族怎么取到**(2026-10-29 修):`qoder-capture.ps1` 先从**运行中的 Qoder/Qoder CN
> 进程路径**反推安装根(`<root>\.qoder-versions\<ver>\…` 取上两级),再兜底候选
> (`$QODER_INSTALL_DIR`、`G:\Qoder CN`、`D:\software\Qoder*`、LOCALAPPDATA、ProgramFiles);
> 多版本并存时按**版本号**取最高那份(不是路径字符串序)。此前只有写死候选清单,装在
> 清单外的机器(如 `D:\software\Qoder CN`)整族取不到,落库后 `has_cosy=false`。

### 3.2 CodeArts

CodeArts 不是 JWT,凭证按 STS 凭据包导入。以下三种写法任选其一,但三组信息必须齐全:

| 信息 | 可接受字段 |
| --- | --- |
| security token | `securitytoken` / `security_token` / `cloud_dragon_token` |
| access key | `accessKey` / `access_key_id` |
| secret key | `secretKey` / `secret_access_key` |
| 刷新凭证 | `refresh_token` |
| 到期时间 | `expires_at` / `expiration`(ISO 8601) |
| 账号标识 | `account.id` 或 `user_id`;都缺则按 access key 哈希 |
| DPoP / PKCE | `loginContext.dpopKeyPair.privateKeyJwk`、`loginContext.pkcePair.codeVerifier`(或平铺的 `dpop_private_key` / `code_verifier`) |

缺任意一组 STS 凭据 = 该条 `failed`,不落库。

## 4. Cookie 格式

`cookies` 是 Chrome 导出数组,元素字段:

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | cookie 名 |
| `value` | 是 | cookie 值 |
| `host_key` | 建议 | 域,如 `.trae.cn` |
| `path` | 否 | 默认 `/` |
| `expires_utc` | 否 | **WebKit epoch 微秒**:1601-01-01 起的微秒数 |
| `is_secure` / `is_httponly` | 否 | 布尔值 |

### 4.1 `expires_utc` 换算

```
Unix 毫秒 = floor(expires_utc / 1000) - 11644473600000
```

`expires_utc = 13467354232000000` → `2027-10-07T03:43:52.000Z`。
`0` 或空 = 会话 cookie,不参与"最早 cookie 到期"计算。

> 常见错误:把 `expires_utc` 当 Unix 秒或 Unix 毫秒。数值量级 1.3e16 是 WebKit 微秒。

## 5. 服务端导入语义

导入入口:`POST /api/admin/relay/accounts/import`(管理员 access token)。

1. **去重键** = `(providerCode, uid)`。uid 取 JWT 的 `data.id` → `sub` → `uid` → `data.user_id`;
   Qoder 取显式 `uid`(→ `user.id`,兜底哈希);全失败时用 `auto:sha256(token)[:32]`。同 uid 再导入 = 覆盖凭证并重置健康状态。
2. **批内重复** uid:保留首条,后续标记 `skipped`(不计失败)。
3. **加密落库**:`token` / `refreshToken` / `cookies` / CodeArts secrets 全部 AES-256-GCM
   (`encryptField`),管理端响应永不回传明文或密文。
4. **过期处理**:token 已过期且无 `refreshToken` → 入库但 `healthStatus=down`、
   `tempUnschedulable=true`(诚实标记,不冒充可用);有 `refreshToken` 则交给调度器续期。
5. **不探测上游**:导入只做本地解析,账号是否真的可用由健康检查/转发链路判定。
6. **逐条独立**:一条坏不影响整批,返回 `imported` / `updated` / `skipped` / `failed` 计数与逐条原因。

## 6. 导入前预检

先进入 `apps/api`(文件路径按当前目录解析):

```bash
cd apps/api

# 校验(警告只提示)
pnpm exec tsx scripts/relay-account-import-validate.ts accounts.json --provider trae

# 严格档:临期/缺 refreshToken 等警告也判不通过
pnpm exec tsx scripts/relay-account-import-validate.ts accounts.json --provider trae --strict

# 机器可读
pnpm exec tsx scripts/relay-account-import-validate.ts accounts.json --provider trae --json

# 生成接口请求体(含明文凭证,只在本机用)
pnpm exec tsx scripts/relay-account-import-validate.ts accounts.json --provider trae --emit-body import-body.json
```

> 不要用 `pnpm --filter @ihui/api exec` 包装:pnpm 会把非零退出码统一压成 1,
> 看不出「不通过(1)」与「未判定(2)」的区别。

退出码:`0` 通过 / `1` 不通过 / `2` 参数或文件读取失败(未判定)。
预检不打印 token 明文,只给 uid、到期时刻与问题码。

导入示例:

```bash
curl -X POST https://<host>/api/admin/relay/accounts/import \
  -H "Authorization: Bearer <admin access token>" \
  -H "Content-Type: application/json" \
  --data-binary @import-body.json
```

## 7. 安全与边界

- 导出文件与 `--emit-body` 产物都含**明文凭证**:不要提交进仓库、不要贴聊天记录、用完即删。
- JWT 只解码不验签;预检通过 ≠ 账号有效,也 ≠ 上游接受该凭证。
- `deviceId` / `machineId` 为空不阻塞导入;是否必须由各平台适配器的请求形状决定。
- 上游平台的服务条款与账号共享限制由使用者自行评估;本仓只提供导入与调度机制。

## 8. 一键导入工具 `relay-import-qoder.ts`(2026-10-23 立)

把「解密本机 Qoder 登录态 → 入号池」固化成可复用入口,**重复性导入**直接一键,免去每次手工解密。
进 `apps/api` 后通过根命令调用:

```bash
# 模式 A(默认):捕获本机 Qoder 登录态 → 导入号池(一键)
pnpm qoder:import

# 模式 B:直接导入账号 JSON(裸数组 / {accounts:[…]} / {providerCode,accounts})
pnpm qoder:import -- --file accounts.json
pnpm qoder:import -- --file accounts.json --provider trae

# 模式 C:已解密的本机会话 JSON(qoder-capture.ps1 产物;无 pwsh 环境的降级通道)
pnpm qoder:import -- --session-file session.json

# 干跑(只解析不落库,核对来源/uid/到期)
pnpm qoder:import -- --dry-run
```

三模式要点:
- **幂等**:同 `(providerCode, uid)` 再导入 = 覆盖凭证 + 重置健康状态(号池续命,重复导入安全)。
- **兼容形状**:`--file` 认裸数组 / `{accounts:[…]}` / `{providerCode,accounts}` / 顶层单条账号对象;
  `--session-file` 认 `{sessions:[…]}` / 顶层单条会话对象(兼容两种导出:`accessToken`+`uid` 的 ps1 产物,
  以及 `token`(accessToken 别名)+ 内联 `user{id,name,phone}` 的原生会话导出)。
- **安全**:输出永不回显 token/refreshToken 明文(只给 uid/到期/问题码)。
  `--file` 的账号 JSON 与 `--session-file` 的会话 JSON 均含**明文凭证**——用完即删、勿入仓(见 §7)。
- **退出码**:`0` 全部成功 / `1` 有失败或缺可导账号 / `2` 参数或输入读取失败(未判定)。
- **导入即体检**(2026-10-29 补):落库后立刻对本次新增/更新的账号调上游健康检查并写
  `healthStatus`/`healthCheckedAt`(与另一入口 `relay-account-import.ts` 同口径,复用其
  `runHealth`,不写第二份判据)。不加这一步,导入后要等下一轮 5 分钟巡检才定级,期间
  管理面显示 `unknown` —— 同一次导入在两套工具下给出不同状态曾是缺陷。`--no-health` 可跳过。
  体检失败/未判定**不影响退出码**(导入成败只看落库),最多一条 `healthError`。
- 模式 A 需要 PowerShell 7+(`pwsh`)且本机已登录 Qoder 客户端;不满足时走模式 C 降级:
  在能解密的机器上 `pwsh -File qoder-capture.ps1 -OutFile session.json`,再加 `--session-file` 导入。

### 8.1 入池后的保活链路(2026-10-28 立)

导入只是入池;**票会不会被顶掉**由续期归属决定:

1. **池内巡检**(`relay-account-pool-worker`,BullMQ 每 5 分钟一轮):
   `unknown` 账号受检定级、距过期 <15 分钟且有 `refreshToken` 则刷新、`down` 且未超失败阈值则重试恢复。
   连续 3 次刷新失败 ⇒ `tempUnschedulable=true`(自动摘除,管理面可见原因)。
2. **Qoder 属 client-first 族**(与 Trae 同构):Qoder 的 `deviceToken/refresh` 会**轮换
   refreshToken**,而桌面客户端与号池共用同一枚 —— 谁先刷谁把对方顶掉。因此池**不主动抢刷新**
   (票未过期不刷,只在已过期后兜底),客户端轮换出的新票由 `scripts/sync-qoder-client-session.mjs`
   每 10 分钟回灌进池(`qoder-session-sync` 定时任务):
   - 判据复用 Trae 的 `decideSync`(同票不写 / 池内更新不写 / 客户端更新才写);
   - 只动凭证四列 + `credVersion + 1` 与 Cosy 设备头,**不碰**健康状态与失败计数;
   - 手工核对:`node scripts/sync-qoder-client-session.mjs --dry-run`;
   - 关掉回灌腿退回池主动刷新:`RELAY_QODER_CLIENT_FIRST_REFRESH=0`(Trae 用
     `RELAY_TRAE_CLIENT_FIRST_REFRESH`)。关回灌腿前先确认本机客户端不再续期,否则两边互顶。
3. **人工复灌**:换机/重登后跑 `pnpm qoder:import`(幂等,同 uid 覆盖凭证并重置健康状态)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
