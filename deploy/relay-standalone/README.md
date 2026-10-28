<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# relay-standalone — 号池网关单机档

一条命令起本机最小号池网关,对外只开一个端口(默认 7864),入口用一枚 `RELAY_STANDALONE_KEY` 门保护。

对标 `workbuddy2api-panel` 的「双击 exe + 7864/panel + api_key 门」。我方网关依赖
PostgreSQL + Redis,单 exe 拓扑不成立,所以这里给的是**一条命令的容器档**,不是免依赖二进制。

## 起

```bash
cp deploy/relay-standalone/.env.example deploy/relay-standalone/.env
# 按下面「.env 必填清单」逐项填写(11 枚键,与 .env.example 一一对应)
docker compose -f deploy/relay-standalone/docker-compose.yml up -d --build
```

### .env 必填清单(11 枚,以 `.env.example` 为准)

| 键                           | 必填?    | 说明                                                                                                                                       |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `DB_PASSWORD`                | **必填** | ≥16 字符;留空时 compose 直接拒绝启动(不带默认弱值跑起来)                                                                                   |
| `REDIS_PASSWORD`             | **必填** | 留空同上                                                                                                                                   |
| `JWT_SECRET`                 | **必填** | ≥32 字符随机串                                                                                                                             |
| `CREDENTIALS_ENCRYPTION_KEY` | **必填** | ≥32 字符随机串                                                                                                                             |
| `AI_CALLBACK_SECRET`         | **必填** | ≥32 字符随机串                                                                                                                             |
| `RELAY_STANDALONE_KEY`       | **必填** | ≥32 字符随机串;**唯一对外凭据**(入口门),见下「客户出口用法」                                                                               |
| `DB_USER`                    | 可留默认 | 默认 `ihui`;改成别的值须与 `db` 容器初始化用户一致                                                                                         |
| `DB_NAME`                    | 可留默认 | 默认 `ihui`                                                                                                                                |
| `RELAY_STANDALONE_PORT`      | 可留默认 | 默认 `7864`;改了它 = 改对外口,须同步 `docs/port-management.md` 登记                                                                        |
| `RELAY_STANDALONE_ORIGIN`    | 可留默认 | 默认 `http://localhost:7864`,供 api 侧 CORS 用;换了访问域名/端口要同批改                                                                   |
| `AI_SERVICE_URL`             | 可留默认 | 默认 `http://ai-service:8803`;**单机档默认不含 ai-service**,该默认值指向不存在的服务,依赖它的功能(签到 / 任务自动化 / AI 对话)在本档不可用 |

随机串生成:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

打开 `http://localhost:7864/?key=<RELAY_STANDALONE_KEY>`,门会把 key 种成 Cookie 并跳回面板。
之后同一浏览器直接访问 `http://localhost:7864` 即可。

排障:

```bash
docker compose -f deploy/relay-standalone/docker-compose.yml ps
docker compose -f deploy/relay-standalone/docker-compose.yml logs -f api
curl -s http://localhost:7864/healthz          # 门自身探活,不需要 key
curl -s -H "X-Relay-Key: $KEY" http://localhost:7864/api/health
curl -s -H "X-Relay-Key: $KEY" http://localhost:7864/v1/models   # 对外出口探活
```

## 客户出口用法(OpenAI / Gemini 兼容)

面板用的 `/api/*` 之外,`api` 服务还把对外公开 API 挂在根前缀 `/v1`(OpenAI 兼容,含
`/v1/anthropic` 一族)与 `/v1beta`(Gemini 协议)上。这两条前缀**不在** `/api/` 之下,
所以 gateway 为它们各单独配了 location —— 客户侧把 base_url 指到 7864 即可:

```bash
# OpenAI 兼容
base_url = http://localhost:7864/v1          # /v1/chat/completions、/v1/models、/v1/responses …
# Gemini 协议
base_url = http://localhost:7864/v1beta      # /v1beta/models/<m>:generateContent、streamGenerateContent
```

两把 key 都要带,各管各的事,缺一打不通:

1. **入口门 `RELAY_STANDALONE_KEY`**(nginx 层):`/v1` 与 `/v1beta` 和 `/`、`/api/` 同纪律,
   未命中即 401 `{"code":401,"message":"relay key required"}`。带法三选一 —— 请求头
   `X-Relay-Key: <RELAY_STANDALONE_KEY>` / Cookie `relay_key=<key>` / 查询串 `?key=<key>`。
   注意 SDK 的 `default_headers` 才能塞 `X-Relay-Key`;写在 URL 上会给每个请求带 query。
2. **developer api key**(api 层鉴权):这道门只验「能不能进这台机」,**不是**调模型的凭据。
   进入后仍按各协议的标准用法带自己的 key(`Authorization: Bearer <sk-…>` / Gemini
   `x-goog-api-key`),由 `apps/api` 的 v1 路由校验归属与配额。

流式(SSE)在这三条 api 向 location 上都是 `proxy_buffering off` + 3600s 读写超时,
长回答不会被网关提前掐断。**已知不承诺**:`/v1/realtime` 是 WebSocket 出口,而 gateway 的
这三条 api 向 location 与站内 `/api/` 一样把 `Connection` 固定为空串、不做协议升级,
所以 Realtime(WS)在单机档打不通;需要它请走会做协议升级的部署形态,本档不承诺可用。

## 组成

| 服务           | 作用                                                                 | 是否对外      |
| -------------- | -------------------------------------------------------------------- | ------------- |
| `gateway`      | nginx:入口门 + 反代 `/`、`/api/`、`/v1`、`/v1beta`(SSE 不缓冲)       | **是**,`7864` |
| `web`          | Next.js 面板                                                         | 否            |
| `api`          | Fastify 网关(站内 `/api/*` + 对外 `/v1`、`/v1beta` 出口、账号池管理) | 否            |
| `worker`       | BullMQ 后台作业                                                      | 否            |
| `migrate`      | 一次性迁移,失败则不启动 api                                          | 否            |
| `db` / `redis` | PostgreSQL 18 + Redis 7                                              | 否            |

## 边界(如实写明,不假装包含)

- **不含 ai-service**:签到、WorkBuddy 任务自动化、AI 对话等依赖 FastAPI 的功能在单机档不可用;
  需要时把 `AI_SERVICE_URL` 指向已部署的 ai-service(同 compose 网络内加服务或外部地址)。
- **不是免依赖二进制**:db/redis 仍是必需组件;这与「单 exe」形态的差距是结构性的,不做伪装。
- **门只保护入口**:请勿把 7864 以外的方式暴露到公网;`RELAY_STANDALONE_KEY` 泄露 = 面板与
  `/v1`、`/v1beta` 对外出口同时失守(能列账号、能发起调用),轮换方式 = 改 `.env` 后
  `docker compose ... up -d gateway`。它不替代调模型用的 developer api key(见「客户出口用法」)。
- **无 SSO**:单机档不接第三方登录;这一枚 key 是**进入**这台机的凭据,进入后各路由仍按自己的
  鉴权判归属与配额(面板 `/api/*` 走站内会话,对外 `/v1`、`/v1beta` 走 developer api key)。
- **本机未做 docker 真机演练**(本机无 docker):compose/nginx 的语法由 CI 与
  `scripts/tests/relay-standalone-config.test.mjs` 静态校验,首次真机起栈需按上面排障命令核对一次。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
