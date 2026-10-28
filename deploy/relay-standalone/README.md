<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# relay-standalone — 号池网关单机档

一条命令起本机最小号池网关,对外只开一个端口(默认 7864),入口用一枚 API key 保护。

对标 `workbuddy2api-panel` 的「双击 exe + 7864/panel + api_key 门」。我方网关依赖
PostgreSQL + Redis,单 exe 拓扑不成立,所以这里给的是**一条命令的容器档**,不是免依赖二进制。

## 起

```bash
cp deploy/relay-standalone/.env.example deploy/relay-standalone/.env
# 填 .env:DB_PASSWORD / REDIS_PASSWORD / JWT_SECRET / CREDENTIALS_ENCRYPTION_KEY /
#          AI_CALLBACK_SECRET / RELAY_STANDALONE_KEY(生成:node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
docker compose -f deploy/relay-standalone/docker-compose.yml up -d --build
```

打开 `http://localhost:7864/?key=<RELAY_STANDALONE_KEY>`,门会把 key 种成 Cookie 并跳回面板。
之后同一浏览器直接访问 `http://localhost:7864` 即可。

排障:

```bash
docker compose -f deploy/relay-standalone/docker-compose.yml ps
docker compose -f deploy/relay-standalone/docker-compose.yml logs -f api
curl -s http://localhost:7864/healthz          # 门自身探活,不需要 key
curl -s -H "X-Relay-Key: $KEY" http://localhost:7864/api/health
```

## 组成

| 服务           | 作用                                    | 是否对外      |
| -------------- | --------------------------------------- | ------------- |
| `gateway`      | nginx:API key 门 + 反代(SSE 不缓冲)     | **是**,`7864` |
| `web`          | Next.js 面板                            | 否            |
| `api`          | Fastify 网关(含 `/v1` 转发、账号池管理) | 否            |
| `worker`       | BullMQ 后台作业                         | 否            |
| `migrate`      | 一次性迁移,失败则不启动 api             | 否            |
| `db` / `redis` | PostgreSQL 18 + Redis 7                 | 否            |

## 边界(如实写明,不假装包含)

- **不含 ai-service**:签到、WorkBuddy 任务自动化、AI 对话等依赖 FastAPI 的功能在单机档不可用;
  需要时把 `AI_SERVICE_URL` 指向已部署的 ai-service(同 compose 网络内加服务或外部地址)。
- **不是免依赖二进制**:db/redis 仍是必需组件;这与「单 exe」形态的差距是结构性的,不做伪装。
- **门只保护入口**:请勿把 7864 以外的方式暴露到公网;`RELAY_STANDALONE_KEY` 泄露等于面板失守,
  轮换方式 = 改 `.env` 后 `docker compose ... up -d gateway`。
- **无 SSO**:单机档不接第三方登录;面板/API 的进入凭据就是这一枚 key。
- **本机未做 docker 真机演练**(本机无 docker):compose/nginx 的语法由 CI 与
  `scripts/tests/relay-standalone-config.test.mjs` 静态校验,首次真机起栈需按上面排障命令核对一次。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
