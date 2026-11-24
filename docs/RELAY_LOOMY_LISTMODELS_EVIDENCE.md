<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Loomy 模型清单端点取证定案(2026-11-24)

> 此前 loomy-adapter.ts 头注与 listModels 注释写「无上游清单端点」,本文以真票实弹
> 当场推翻:**上游存在 `GET /api/v1/models`**,返回标准 OpenAI 风格清单。
> 这是「静态清单发现不了新模型、清不掉旧模型」的活证据,据此补 listModelsDetailed
> 让 loomy 进入 15 分钟自动同步循环。

## 1. 取证环境与方法

- 真号:本机 `ai_relay_account_pool` 的 loomy 启用号(3 个),`token_enc` 经
  AES-256-GCM + `CREDENTIALS_ENCRYPTION_KEY` 在进程内解密(零落盘、零回显),
  再经 `loomySessionToken` 从会话 JSON 取 `session` 字段(32-hex)。
- 只读:全程仅 GET,未改任何数据库行;凭据与响应均不写入文件。
- 取证脚本一次性临时文件 `.ihui-agent/tmp/probe-model-endpoints.py`,用完即弃。

## 2. 端点、鉴权、成败判据(逐条实证)

| 项 | 结论 | 证据 |
|---|---|---|
| 端点 | `GET https://loomyad.xunfei.cn/api/v1/models` | 真票实弹 HTTP 200 |
| 鉴权头 | **裸 `token` 头**,不是 `Authorization: Bearer` | Bearer + session 票 ⇒ `code=100002 缺少 token`;裸 token 头 ⇒ 200 + 清单 |
| 票形态 | 会话 JSON 取 `session` 字段(32-hex) | 整 JSON 当票 ⇒ 100002;session 字段 ⇒ 200 |
| 成功响应 | `{object:'list', reasoning_catalog_version:'sha256:...', data:[{id,name,type,object,created,owned_by,protocol,capabilities,...}]}` | 实弹 9 条,chat 6 / image 3 |
| 失败响应 | HTTP 200 + `{code:'100002', desc:'缺少 token', data:{}}` | 无票/坏票均命中,与 quota 端点同款业务信封 |
| 成败判据 | 有 `code` 字段即业务结论(ok=false),绝不读成空清单 | 100002 是登录失效,不能冒充「上游没模型」 |

**注意**:loomy 网关 HTTP 恒 200,结论全在 body —— 只看 status 会把「登录失效」当成空清单,
触发自动下架把整个平台的模型清光。这是本端点最危险的坑。

## 3. 静态清单已过时(实弹对比)

实弹当日 `data` 共 9 条;而 adapter 里静态 `LOOMY_MODEL_IDS` 只有 7 条,差异:

- **新增(实证有、静态无)**:`deepseek-v4-flash-1017`(chat)、`Hy-Image-3.5-preview` /
  `doubao-seedream-5-lite` / `qwen-image-3.0-pro`(三个 image 档,不入对话清单)。
- **过时(静态有、实证无)**:`deepseek-v4-flash-0731`、`mimo-v2.5`。

即:静态清单既发现不了新模型,也清不掉旧模型 —— 正是用户要的「新模型自动上、旧模型自动清」
的活案例。补上动态清单后,同步器会把 `deepseek-v4-flash-1017` 自动上架,把两条过时模型
软下架(enabled=false,可复活)。

## 4. 其余三家边界(同轮探测,如实记录)

按 §0.3「不冒绿」原则,同轮对 codex/minimax/doubao 也做了候选端点探测,结论是
**「仓内无已实证端点」,不是「已证伪上游没有端点」**(与 qoder 那次的定案等级不同):

| 平台 | 探测 | 结果 | 判断 |
|---|---|---|---|
| minimax | `GET /v1/models` + OAuth 票(`mmoat_`) | HTTP 401 `1004 Please carry the API secret key` | 端点存在,但号池是 coding-plan OAuth 票,清单端点要 API secret key —— **凭据面不匹配,硬边界**;`secrets_enc` 只有 OAuth 元数据,无 API key |
| doubao | `GET /api/v1/models` + OAuth 票 | HTTP 401 + 空体 | web cookie 面,`model_item_key` 固定 `'0'`;无清单抓包证据,不建议投入 |
| codex | `chatgpt.com/backend-api/models` | 无启用号 + 网络 ConnectError | 仓内连候选路径都无,逆向文档对 models 零命中;需先抓包 |

这三家要补自动发现的前提是拿到**另一类凭据/端点证据**(如 minimax API key 号型),
不是改几行 adapter 就能解决。不在本次范围,如实留作边界。

## 5. 落地与回归

- `loomy-adapter.ts` 新增 `listModelsDetailed`,复用 `loomySessionToken` + `resolveFetchImpl`
  + 裸 token 头;成功取 `data[].id` 且 `type==='chat'`(图像档不入对话清单,与既有语义一致);
  失败一律 `ok:false` 且永不抛。静态 `listModels` 保留为历史回落,不抛契约不变。
- 消费链无需改:`fetchUpstreamModelIds` 优先 detailed、`relay-models-sync` 能力门认两种接口、
  admin 路由富契约优先 —— 补方法即自动接入。
- 回归:`relay-loomy-adapter.test.ts` 39/39、相关 5 文件 94/94、`tsc --noEmit` 通过。
