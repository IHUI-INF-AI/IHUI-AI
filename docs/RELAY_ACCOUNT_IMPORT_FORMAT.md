<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 号池导入 JSON 格式规范

> 适用范围:`/api/admin/relay/accounts/import` 与 [apps/api/scripts/relay-account-import-validate.ts](../apps/api/scripts/relay-account-import-validate.ts)
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

`providerCode` 取值:`trae` | `workbuddy` | `codearts`。
`accounts` 单批最多 **500** 条。

## 2. 账号字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string ≤128 | 否 | 展示名;缺省用 `#序号` |
| `token` | string | trae/workbuddy 必填 | JWT access token;codearts 见 §3 |
| `refreshToken` | string ≤128 | 否 | 缺失时过期号入库即摘除 |
| `deviceId` | string ≤128 | 否 | 设备指纹;web 聊天链路不强制 |
| `machineId` | string ≤128 | 否 | 同上 |
| `enabled` | boolean | 否 | 默认 `true`;必须是布尔值 |
| `cookies` | array | 否 | Chrome 导出格式,见 §4 |
| `proxyUrl` | string ≤512 | 否 | 账号级出口代理,`http(s)://` 或 `socks5://` |
| 其他字段 | any | 否 | 原样透传进 `extraMetadata`(平台扩展用) |

## 3. CodeArts 专用字段

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
   全失败时用 `auto:sha256(token)[:32]`。同 uid 再导入 = 覆盖凭证并重置健康状态。
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
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
