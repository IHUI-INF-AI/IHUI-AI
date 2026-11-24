<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 三家平台模型清单端点取证定案(2026-11-24)

> 承接 `RELAY_LOOMY_LISTMODELS_EVIDENCE.md` 留下的三家边界。本文以真票实弹 +
> 官方一手文档 + 客户端同源配置,把 codex / doubao / minimax 的模型清单来源逐家定案,
> 并全部落地为 adapter 的 `listModelsDetailed`(补方法即自动进入 15 分钟同步循环)。

## 0. 证据分级(§0.3 不冒绿)

- **实弹**:本机号池真凭据只读 GET 验证(doubao)。
- **官方一手**:OpenAI 帮助文档原文明确 Codex CLI 拉目录的 URL(codex)。
- **客户端同源配置**:平台 CLI 自己读/写的配置文件(minimax),同 qoder CLI 帧范式。

## 1. Doubao —— 真票实弹打通(证据最强)

**端点**:`GET https://www.doubao.com/chat/models`,会话 cookie 鉴权,HTTP 200 返回 HTML。

**清单来源**:HTML 内嵌 `modeSelectConfig.menu_item_list[]`,每项含 `model_item_key`
(正是 chat body `conversation_init_ext.model_item_key` 用的 key)与 `name`。

**实弹结果(2026-11-24,启用号 cookie)**:16 条模型,节选:

| model_item_key | name |
|---|---|
| `9` | 豆包 2.1 Auto |
| `5` | 豆包 2.1 Pro |
| `seed-lite-7b` | 豆包 2.1 Lite |
| `person-deepseek-v4-1-flash-261017` | DeepSeek V4.1 Flash |
| `person-glm-5-4` | GLM 5.4 |
| `person-qwen4-max` | Qwen 4 Max |
| `person-kimi-k3-1-pro-261111` | Kimi K3.1 Pro |

**关键坑**:这是 HTML 内嵌 JSON 片段,不是 JSON API —— 必须做括号配平提取,
不能正则贪婪匹配;字符串字段内的 `]` 会骗到朴素扫描(已单测锁死)。

**落地**:`extractDoubaoModelItems(html)` 纯函数配平提取 + `listModelsDetailed`
(cookie + referer + UA,scope=`upstream-account`)。失败/空一律 `ok:false`,永不抛。

## 2. Codex —— 官方一手端点(本机未实弹,按契约实现)

**端点**:`GET https://chatgpt.com/backend-api/codex/models?client_version=<ver>`。

**一手证据**:OpenAI 帮助文档 help.openai.com/articles/20001607 原文把该 URL 作为
Codex CLI 的 `model_catalog_url` ——「Codex 会单独查询模型目录」「将请求转发到
`https://chatgpt.com/backend-api/codex/models`」。developers.openai.com 的 litellm
文档片段给出 `client_version` 参数、Bearer 鉴权、顶层 `models` 数组。

**鉴权**:与现有 chat 完全同构 —— Bearer `tokens.access_token` + `chatgpt-account-id`
+ `originator: codex_cli_rs`(号池已存这三项,无需新号型)。

**本机未实弹原因(如实)**:号池当前零 codex 号 + chatgpt.com 本机直连超时/代理 502
(网络环境限制,非端点不存在)。故按官方契约实现 + 测试锁死请求面/响应形状,
scope 标 `upstream-account`,判据留 §0.3「未判定」;有真号即自动生效,不冒绿。

**落地**:取 `models[].slug` 为 id(兼容 `id`/`name`),`client_version` 默认 `0.162.1`
(官方示例值)。models 非数组/空/异常一律 `ok:false`。

## 3. MiniMax —— 客户端同源配置(双路)

**上游实弹**:号池存 mcode OAuth 票(`mmoat_`),`GET /v1/models` 官方端点存在但要
API Secret Key(实弹 401 1004 `Please carry the API secret key`);余量端点
`coding_plan/remains` 的 `model_remains` 免费号为 null,不含清单。

**客户端同源源**:mcode CLI 自己的 `~/.minimax/config.yaml`:
- `provider.minimax.models` 键 = 当前可用模型 id(实测 M3 / M3.1-Flash);
- `provider.minimax.whitelist` = CLI 允许全集(实测含 M2.7 / M2.7-highspeed);
- `defaultModel` = `minimax/MiniMax-M3.1-Flash`。
CLI 升级会更新该文件 ⇒ 新模型自动进、旧模型自动出。

**落地(minimax-models.ts + adapter 双路)**:
1. 上游 `GET /v1/models`(Bearer):账号一旦换成 API key 号型即自动可用,
   scope=`upstream-account`;识别 `base_resp.status_code≠0` 业务信封,不读成空清单。
2. 失败回落本机 config.yaml(js-yaml 解析),scope=`local-cli-login`(同 qoder 范式,
   不构成号池账号清单)。两条都取不到才 `ok:false`。
3. 路径可用 env `IHUI_MINIMAX_CONFIG` 覆盖(NSSM 服务 homedir 可能非用户目录)。

## 4. 消费链与回归

三家补 `listModelsDetailed` 后无需改共享消费链:`fetchUpstreamModelIds`
(detailed 优先、ok=false 不回落)、`relay-models-sync` 能力门(两种接口任一)、
admin 路由(富契约优先)均自动接入。新模型自动上架、上游消失模型软下架可复活。

回归:`relay-{doubao,codex,minimax}-adapter.test.ts` + `minimax-models.test.ts`
114/114;相关 11 文件 249/249;`tsc --noEmit` EXIT=0。
