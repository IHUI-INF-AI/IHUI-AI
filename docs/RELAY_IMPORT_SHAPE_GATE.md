<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 号池导入形状闸门(Web 拖拽 ⇄ CLI 一套口径)

> 适用范围:`POST /api/admin/relay/accounts/import`(Web 拖拽导入)、`apps/api/scripts/relay-account-import.ts`(CLI 导入)、`apps/api/scripts/relay-account-import-validate.ts`(CLI 预检)
> 判据单源:[relay-account-format.ts](../apps/api/src/services/relay-account-format.ts) 的 `RELAY_IMPORT_CREDENTIAL_SLOTS` / `recognizeImportShape`
> 落库映射:[relay-account-pool-service.ts](../apps/api/src/services/relay-account-pool-service.ts) 的 `mapXxxImport`(取凭据统一走 `resolveRelayCredentialSlots`)

## 1. 缺口(2026-10-27 立)

Web 号池管理页支持把账号导出 JSON 直接拖进去导入。导入请求走
`POST /api/admin/relay/accounts/import`,路由层用 Zod 校验请求体。

**缺口现象:12 个平台里 10 个平台的原生提取器载荷进不去 Web 拖拽界面**,
只有 trae / workbuddy 的 `{ token }` 能过。

## 2. 根因

路由的 `importBodySchema` 曾要求**每个账号条目必须有顶层 `token`**:

```ts
z.object({
  name: z.string().max(128).optional(),
  token: z.string().min(1),   // ← 闸门只认这一种形状
  ...
}).passthrough()
```

而各平台原生提取器产出的形状彼此不同,凭据根本不在顶层:

| 平台 | 原生凭据落点 |
| --- | --- |
| codex | `tokens.access_token` |
| opencode | `auth.key` / `auth.access` |
| minimax | `accessToken` |
| zcode | `oauth:bigmodel:access_token` / `zcodejwttoken` / `project-key-location:v1:*` |
| loomy / doubao | `value` |
| codearts | `securitytoken` + `accessKey` + `secretKey` |

于是出现两套割裂口径:

- **CLI**(`apps/api/scripts/relay-account-import.ts`)直调 `importAccounts`,**不过 Zod** ⇒ 能导;
- **Web** 走路由 Zod ⇒ 原生载荷在路由层就被挡掉,连 service 都进不去。

两处共用的是 `importAccounts`,但入口闸门不是同一套判据 —— 这才是"CLI 能导、Web 不能导"的真正原因。

## 3. 修复口径(形状校验下沉 + 前移)

### 3.1 路由只守「结构 + 体积」,不再守形状

路由的 `importBodySchema` 现在只做:

- `providerCode`:短字符串(是否为本仓 12 平台由 `isRelayProviderCode` 判,错误人话可读);
- `accounts`:数组,每条必须是**对象**,单批 `1..500` 条(`IMPORT_MAX_ACCOUNTS` 与预检同值);
- 结构闸门(`checkImportStructure`):每条一个对象、键数上限 64、单个字符串长度上限 8192、
  整条序列化体积上限 64KB、键名白名单(`[A-Za-z0-9_:.@\-[\]]`)并拒收原型链键
  (`__proto__` / `constructor` / `prototype`);JSON 解析层另有 `secure-json-parse` 先拦一道。

**不再要求顶层 `token`**,原生字段(`tokens` / `auth` / `accessToken` / `value` …)一律原样透传给 service,
路由不改写、不裁剪载荷。

### 3.2 形状判据单源下沉到 service

新增 `relay-account-format.ts` 的三件套:

- `RELAY_IMPORT_CREDENTIAL_SLOTS`:**全仓唯一一份键位表**(12 平台凭据落点);
- `resolveRelayCredentialSlots()`:取凭据的唯一入口(服务端 `mapXxxImport` 全部改走它);
- `recognizeImportShape()`:形状闸门判定,返回
  `{ recognized, importable, credentialKeys, credential, reason }`:
  - `recognized` = 这条载荷是不是本仓认得的该平台形状;
  - `importable` = 能不能取到**明文**凭据(GrokBot 密封串:形状认得,但没有明文可导);
  - `reason` = 认不出时的人话原因(**只报平台与键名,不回显任何凭据字符**)。

`validateAccountExport`(CLI 预检)与 `importAccounts`(服务端落库)都改为调这一个函数 ⇒
**CLI 预检、Web 路由闸门、服务端落库三处口径不可能再分叉**。

### 3.3 安全红线(放宽 Zod 不等于放宽入库)

- 只有 12 个已知平台的已知形状才认;认不出 → **整批拒绝**(路由层)或**逐条拒**(service 层),
  并点名缺哪个键(如 `Codex 导入缺少 tokens.access_token(...)`);
- **绝不静默丢弃、绝不塞无效账号**:认不出的条目一律带 `status: 'failed'` + 原因进结果;
- 凭据值一律 `encryptField` 落库,响应面零凭据;错误消息只报键名与形状。

### 3.4 路由层的整批拒绝与逐条拒绝

| 情形 | 路由响应 | 说明 |
| --- | --- | --- |
| 结构不合规(非对象/字段数超限/键名非法/超 501 条) | `400` + 结构问题清单 | 结构问题不是形状问题,整批拒 |
| 平台名不认识 | `400` `不支持平台:<x>` | 12 平台白名单 |
| **整批都认不出** | `400` + 逐条原因(`#1 …;#2 …`) | 整批拒绝,一条都不落库 |
| 部分认不出 | `200` 进 service | 好条目照常入库,坏条目带原因进结果表 |
| 形状认得但没有明文(GrokBot) | `200` 进 service | service 逐条点名"密封串,无明文 token 可导入" |

## 4. 12 平台形状对照表(判据单源:键位表 + 人话原因)

| 平台 | 认得的凭据键(槽位) | 认不出时的人话原因 |
| --- | --- | --- |
| `trae` | `token`(归一后含 `access_token` 等外来别名) | `Trae 导入缺少 token` |
| `workbuddy` | `token`(归一后含 `access_token` 等外来别名) | `WorkBuddy 导入缺少 token` |
| `codearts` | `securitytoken` / `security_token` / `cloud_dragon_token` **且** `accessKey` / `access_key_id` **且** `secretKey` / `secret_access_key`(三槽全中) | `CodeArts 导入缺少 STS 凭据(securitytoken/accessKey/secretAccessKey)` |
| `qoder` | `token`(归一后含 `accessToken`) | `Qoder 导入缺少 token` |
| `codex` | `tokens.access_token` | `Codex 导入缺少 tokens.access_token(auth.json 形状不符或 keyring 模式)` |
| `opencode` | `auth.key` / `auth.access` | `OpenCode 导入条目缺 key/access 字段(auth.json 形状不符)` |
| `minimax` | `accessToken` / `access_token` | `MiniMax 导入缺少 accessToken(mcode auth.json 形状不符)` |
| `zcode` | `oauth:bigmodel:access_token` / `zcodejwttoken` / `project-key-location:v1:*` | `ZCode 导入缺可用凭据(oauth:bigmodel:access_token / zcodejwttoken / project key 全缺)` |
| `loomy` | `value` | `Loomy 导入条目缺 value(会话候选形状不符)` |
| `doubao` | `value` | `豆包导入条目缺 value(cookie 会话族形状不符)` |
| `lingma` | `token` / `accessToken` / `access_token` | `灵码导入 raw 凭证无 token/accessToken/access_token 字段(字段级形状未实证)` |
| `grokbot` | `credential.sandSealedFile` / `credential.data`(密封串,形状认得) | `GrokBot 本机凭证为 sandSealedFile 密封串,无明文 token 可导入(待解封方案取证)` |

> "归一后含 …" 指 `normalizeForeignAccountShape` 的外来形状归一(`access_token` / `accessToken` /
> `id_token` / `idToken` → 规范 `token`),判据单源在该函数,服务端与 CLI 预检共用。

## 5. CLI ⇄ Web 口径是否已统一

**已统一。** 三个入口现在共用同一份判据,不存在"CLI 能导 Web 不能导":

| 入口 | 判据 | 行为 |
| --- | --- | --- |
| Web 拖拽(路由) | 结构闸门(路由)+ `recognizeImportShape` | 整批认不出 → 400 逐条点名;部分认不出 → service 逐条拒 |
| CLI 导入(`relay-account-import.ts`) | `validateAccountExport`(内部即 `recognizeImportShape`) | 预检不过 → 逐条打印原因并退出;过了 → `importAccounts` |
| 服务端落库(`importAccounts`) | `recognizeImportShape` + `mapXxxImport` | 认不出 → 逐条 `failed` + 原因,绝不落库 |

`apps/api/tests/relay-account-import-format.test.ts` 里
「口径统一:CLI 预检说能导的,形状闸门必须也认得(不许分叉)」一节锁的就是这件事。

## 6. 未覆盖的平台与原因

| 平台 | 状态 | 原因 |
| --- | --- | --- |
| `grokbot` | **形状认得,但导不进号池** | 本机凭证是 `sandSealedFile` 密封串,没有明文 token 可导入(解封方案未取证)。Web 拖拽不再把它当"垃圾形状"挡在门外,而是让 service 如实点名失败原因。 |

其余 11 个平台的代表性原生形状都能通过 Web 拖拽导入。

## 7. Web 端现状与待主控接线

后端已能给出逐条原因(`items[].reason`)与整批拒绝的可读消息;Web 端
`apps/web/app/(main)/admin/relay/account-pool/page.tsx` 现状:

- 拖拽载荷**原样**发往后端(不裁字段)⇒ 后端闸门修好后 11 个平台可直接用;
- 导入结果表已逐条渲染 `it.reason` ⇒ 部分失败的原因用户看得见;
- 整批被拒(400)时走 `importMut.onError` → `toast.error(e.message)`,消息里已含逐条原因。

**待主控接线(该文件当前为其他 agent 在飞文件,本次未改动)**:

1. 整批被拒时,除 toast 外建议把后端返回的逐条原因渲染进导入结果表(目前 400 分支不落表);
2. toast 文案可按 `failed` 数量分级(全失败 / 部分失败),避免"导入完成:新增 0 / 失败 N"这种
   看起来像成功的提示;
3. `providerCode` 选错平台时,后端会整批拒绝并点名缺哪个键 —— 前端可在选择平台时就提示
   "所选平台与载荷形状不匹配",减少一次往返。

## 8. 回归与门禁

- 新增:`apps/api/src/routes/__tests__/relay-account-pool-import-shape.test.ts`
  (12 平台原生形状过路由进 service / 垃圾形状被拒且可读 / 老 `{token}` 仍通 / 500 上限 / 零凭据回显);
- 补写:`apps/api/tests/relay-account-import-format.test.ts` 的形状闸门一节(单源判据 + 口径统一);
- 既有回归:`src/routes/__tests__/` 全量 + `apps/api/tests/relay-*` 全量;
- 门禁:`npx tsc --noEmit`、`node scripts/check-format-changed.mjs`、`node scripts/watermark.mjs verify`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
