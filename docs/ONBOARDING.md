# IHUI-AI 新用户接入指南(零配置跑通)

> 目标:从 clone 到完成第一个 AI 会话 ≤ 10 分钟。遇到问题先查 §5 常见问题。
> 端口权威来源:`docs/port-management.md`;本文命令与 `scripts/dev-port-registry.json` 保持同步。

## 1. 前置条件(一次性)

| 依赖 | 版本要求 | 用途 |
| --- | --- | --- |
| Node.js | ≥ 22 | 全仓 pnpm 工作区 |
| pnpm | ≥ 9(`corepack enable`) | 包管理 |
| Python | ≥ 3.13 + [uv](https://docs.astral.sh/uv/) | ai-service(FastAPI) |
| PostgreSQL | 17 | api 主库 |
| Redis | ≥ 7 | 缓存/队列 |
| PowerShell | 7+(`pwsh`) | dev 启动器(Windows) |

## 2. 启动(三条命令)

```bash
pnpm install                                            # ① 安装依赖(全 workspace)
pnpm --filter @ihui/database db:push                    # ② 初始化数据库 schema(Drizzle,首次)
pwsh -File scripts/start-dev.ps1                        # ③ 启动默认组 web + api(ai-service 见下)
```

ai-service 单独启动(Python 侧,默认组不含):

```powershell
pwsh -File scripts/start-dev.ps1 -Services web,api,ai-service
```

启动后打开 http://localhost:8801 注册账号即可使用。状态/停止:

```powershell
pwsh -File scripts/start-dev.ps1 -Status   # 查看各端健康状态
pwsh -File scripts/start-dev.ps1 -Stop     # 停止全部
```

日志:`.ihui-agent/tmp/dev-logs/<service>.log`;端口冲突加 `-Force`。

## 3. 端口速查

| 端口 | 服务 | 健康检查 |
| --- | --- | --- |
| 8801 | web(Next.js) | `http://localhost:8801` |
| 8802 | api(Fastify) | `http://localhost:8802/api/health` |
| 8803 | ai-service(FastAPI) | `http://localhost:8803/health` |
| 8804 | miniapp-taro(H5) | `http://localhost:8804` |

## 4. 五步上手 AI 能力

1. **配置模型**:管理员登录 → `设置 → AI 模型`(或 `/admin/ai-cost` 旁的模型管理)配置 Provider Key;免费 Provider(Ollama/Groq/Cloudflare 等)可零 Key 起步
2. **首次对话**:首页聊天输入框直接提问;工具栏可开 Plan Mode / 深度研究
3. **Agent 执行**:`/agent-workbench` 下发目标,Agent 自主多轮执行;`/agent-step-recorder` 输入 run_id 回放逐步工具调用
4. **时间线与回滚**:`/agent-timeline` 输入 session_id 一次查看步骤/压缩/检查点/成本/注入拦截五类活动;检查点支持回滚
5. **成本与价表**:`/admin/ai-cost` 看成本汇总;`/admin/model-pricing` 看单一价目源(公开牌价)覆盖率

MCP 能力:`/mcp-store` 一键注册外部 MCP Server;`/capability-market` 启用平台自研能力。

## 5. 常见问题

- **pwsh 脚本被拒绝**:用了 Windows PowerShell 5.1。所有 .ps1 必须 PowerShell 7+(脚本头 `#requires -Version 7` 守门)。
- **8803 起不来**:ai-service 用 `uv` 管理,首次先 `cd apps/ai-service && uv sync`;健康检查 240s 超时(UV 首次装依赖较慢)。
- **api 报数据库连接失败**:确认 PostgreSQL 17 已启动且 `apps/api/.env.local` 中连接串正确;JWT_SECRET 三端(web/api/ai-service)必须一致,禁止各端自生成。
- **端口被占**:`pwsh -File scripts/start-dev.ps1 -Clean` 清理全部 IHUI 端口后重启,或 `-Force` 强制 kill。
- **web 请求 404 /api/xxx**:部分路由直连 ai-service 8803(next.config.ts rewrites),确认 ai-service 已启动。
- **微信/桌面端**:桌面端 `pnpm --filter @ihui/desktop tauri dev`(自带 web 8801,与 web 服务互斥);小程序 `pwsh -File scripts/start-dev.ps1 -All` 后按 Taro 文档构建。
