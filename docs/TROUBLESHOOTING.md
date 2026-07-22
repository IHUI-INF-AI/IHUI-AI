# 故障排查指南(Troubleshooting Guide)

> IHUI-AI 开发与部署过程中的常见故障排查手册。每个故障用统一模板:症状 / 根因 / 排查命令 / 修复方案 / 预防。守门脚本完整清单见 [AGENTS.md §守门脚本速查](../AGENTS.md),部署运维见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)。

---

## 目录

1. [启动类故障](#1-启动类故障)
2. [数据库类故障](#2-数据库类故障)
3. [认证类故障](#3-认证类故障)
4. [i18n 类故障](#4-i18n-类故障)
5. [守门类故障(pre-commit)](#5-守门类故障pre-commit)
6. [WebSocket 类故障](#6-websocket-类故障)
7. [AI 服务类故障](#7-ai-服务类故障)
8. [部署类故障](#8-部署类故障)
9. [性能类故障](#9-性能类故障)
10. [工具类故障](#10-工具类故障)

---

## 1. 启动类故障

### 1.1 DB 连接失败

| 项 | 内容 |
|---|---|
| **症状** | api 启动报 `Error: connect ECONNREFUSED 127.0.0.1:5432` 或 `password authentication failed for user "ihui"` |
| **根因** | PostgreSQL 未启动 / 端口不对 / 用户密码不匹配 / `DATABASE_URL` 与实际 DB 配置不一致 |
| **排查命令** | `docker compose ps db` 查状态;`docker compose exec db pg_isready -U ihui` 查就绪;`docker compose logs db --tail 30` 查日志 |
| **修复方案** | 1. `docker compose up -d db` 启动 DB<br>2. 确认 `.env` 的 `DATABASE_URL` 与 `docker-compose.yml` 的 `POSTGRES_USER/PASSWORD/DB` 一致<br>3. 首次启动需 `pnpm --filter @ihui/database db:migrate` 建表<br>4. 密码不匹配:删除卷 `docker compose down -v` 后重建(仅开发环境) |
| **预防** | 用 `scripts/dev-up.ps1` 一键启动(自动等待 DB 就绪);`.env.example` 保持与 `docker-compose.yml` 凭据一致 |

### 1.2 Redis 拒绝连接

| 项 | 内容 |
|---|---|
| **症状** | api 报 `Error: connect ECONNREFUSED 127.0.0.1:6379` 或 `[ioredis] Unhandled error event` |
| **根因** | Redis 未启动 / 端口被占 / 密码不匹配(`REDIS_PASSWORD`) |
| **排查命令** | `docker compose ps redis`;`docker compose exec redis redis-cli ping`(应返回 `PONG`);`docker compose logs redis --tail 20` |
| **修复方案** | 1. `docker compose up -d redis`<br>2. 确认 `.env` 的 `REDIS_URL` 与 compose 一致(开发环境无密码)<br>3. Redis 有密码时 `REDIS_URL=redis://:密码@localhost:6379` |
| **预防** | api 健康检查 `/api/health/ready` 会检测 Redis 连通性,启动后先访问该端点 |

### 1.3 端口占用(EADDRINUSE)

| 项 | 内容 |
|---|---|
| **症状** | `Error: listen EADDRINUSE: address already in use :::3000`(或 3001 / 8000 / 8801) |
| **根因** | 上一轮 dev server 未正常退出,端口残留;僵尸 next-server 进程 |
| **排查命令** | `Get-NetTCPConnection -LocalPort 3000 -State Listen` 找 PID;`Get-CimInstance Win32_Process -Filter "ProcessId=<PID>"` 看命令行 |
| **修复方案** | `powershell -File scripts\kill-dev-servers.ps1`(清理 3000/3001/8000/8081 端口 + 僵尸 next-server);或单端口 `taskkill /F /T /PID <pid>` |
| **预防** | 永远用 `node scripts/dev-web.mjs` 启动 web(启动前自动 `taskkill` 清端口);Ctrl+C 退出而非直接关终端 |

### 1.4 Next.js 编译卡住

| 项 | 内容 |
|---|---|
| **症状** | `pnpm --filter @ihui/web dev` 启动后长时间停留在 "Compiling..." 或页面白屏 |
| **根因** | `.next` 缓存损坏 / Turbopack 增量编译异常 / 内存不足 / 某个 import 环形依赖 |
| **排查命令** | 查终端是否有报错;`Get-Process node | Where-Object {$_.WorkingSet -gt 2GB}` 查内存;删除 `apps/web/.next` 重试 |
| **修复方案** | 1. `pnpm --filter @ihui/web dev:clean`(清 `.next` + `.dev.lock` 后重启)<br>2. 或 `node scripts/dev-web.mjs --clean`<br>3. 内存不足:关闭其他 node 进程,或增加 `NODE_OPTIONS=--max-old-space-size=4096`<br>4. 环形依赖:检查最近改动的 import 链 |
| **预防** | dev server 假死时不要裸用 `Start-Process pnpm dev`,永远用 `dev-web.mjs` |

### 1.5 Python 依赖冲突

| 项 | 内容 |
|---|---|
| **症状** | `cd apps/ai-service && uvicorn app.main:app` 报 `ModuleNotFoundError` / `ImportError` / 版本不兼容 |
| **根因** | `uv.lock` 与 `pyproject.toml` 不同步 / 系统 Python 版本 < 3.12 / 未用 `uv` 安装 |
| **排查命令** | `python --version`(需 3.12+);`cd apps/ai-service && uv pip list` 查已装包;`uv lock --check` 查锁文件一致性 |
| **修复方案** | 1. `cd apps/ai-service && uv sync`(按 `uv.lock` 安装精确版本)<br>2. Python 版本不对:用 `pyenv install 3.12` 或 `uv python install 3.12`<br>3. 锁文件损坏:`uv lock` 重新生成 |
| **预防** | 永远用 `uv sync` 而非 `pip install -r requirements.txt`;改依赖后 `uv lock` 更新锁文件 |

### 1.6 Turborepo 缓存损坏

| 项 | 内容 |
|---|---|
| **症状** | `pnpm build` / `pnpm test` 跳过执行(Turbo 命中缓存但产物缺失);或 `.tsbuildinfo` 陈旧导致类型错误被掩盖 |
| **根因** | Turbo 本地缓存(`.turbo` / `node_modules/.cache`)与实际文件不一致;`.tsbuildinfo` 增量缓存过期 |
| **排查命令** | `pnpm turbo run build --dry-run` 看是否命中缓存;`ls packages/*/.tsbuildinfo` 查增量文件 |
| **修复方案** | 1. 清 Turbo 缓存:`pnpm turbo run build --force`<br>2. 清 `.tsbuildinfo`:`pnpm typecheck:full`(自动清所有 `.tsbuildinfo` 后全量检查)<br>3. 彻底清:`pnpm clean`(turbo clean + rimraf node_modules)后 `pnpm install` |
| **预防** | 发版前跑 `pnpm typecheck:full` 全量检查;升级 TypeScript / 改 tsconfig 后清缓存 |

---

## 2. 数据库类故障

### 2.1 迁移失败回滚

| 项 | 内容 |
|---|---|
| **症状** | `pnpm --filter @ihui/database db:migrate` 报 SQL 错误(如 `column already exists` / `relation does not exist`) |
| **根因** | 迁移文件顺序错乱 / 手动改过 DB / `db:push` 与 `db:migrate` 混用导致状态不一致 |
| **排查命令** | `pnpm --filter @ihui/database db:check` 查 drift;`docker compose exec db psql -U ihui -d ihui_dev -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5"` 查已执行迁移 |
| **修复方案** | 1. 开发环境:`pnpm --filter @ihui/database db:push`(直接同步 schema,跳过迁移文件)<br>2. 删除 `drizzle/__drizzle_migrations` 表中失败的记录后重跑<br>3. 彻底重置:`docker compose down -v && docker compose up -d db` 后重新 migrate + seed<br>4. 生产环境:不回滚,编写新的修正迁移文件 |
| **预防** | 开发期用 `db:push` 快速同步;提交前用 `db:generate` 生成正式迁移文件;不混用 `push` 和 `migrate` |

### 2.2 Schema Drift

| 项 | 内容 |
|---|---|
| **症状** | pre-commit 第 3 项报 `[FAIL] check-db-schema-drift`;或 `db:check` 报 `drift detected` |
| **根因** | 改了 `packages/database/src/schema/` 但未 `db:generate` 生成迁移文件 |
| **排查命令** | `node scripts/check-db-schema-drift.mjs`;`pnpm --filter @ihui/database db:check` |
| **修复方案** | `pnpm --filter @ihui/database db:generate` 生成差异迁移文件 → `git add packages/database/drizzle/` → 重新 commit |
| **预防** | 改 schema 后立即 `db:generate`;pre-commit 守门自动检测 |

### 2.3 RLS(行级安全)阻塞

| 项 | 内容 |
|---|---|
| **症状** | API 查询返回空数组(数据实际存在);或报 `permission denied for table` |
| **根因** | RLS 策略未正确设置 `tenant_id` / `user_id` 过滤;查询未通过 `setLocalTenant()` 设置上下文 |
| **排查命令** | `docker compose exec db psql -U ihui -d ihui_dev -c "SELECT relname, relrowsecurity FROM pg_class WHERE relrowsecurity = true"` 查启用 RLS 的表;`SET app.tenant_id = 'xxx'; SELECT ...` 手动验证 |
| **修复方案** | 1. 检查 `packages/database/src/rls.ts` 策略定义<br>2. 确认路由内调用了 `setLocalTenant(request)` / `request.tenantId`<br>3. 开发环境临时调试:`ALTER TABLE <表> DISABLE ROW LEVEL SECURITY`(仅开发) |
| **预防** | 新表加 RLS 策略时同步写测试(`*.real.test.ts` 验证跨租户隔离) |

### 2.4 种子数据失败

| 项 | 内容 |
|---|---|
| **症状** | `pnpm --filter @ihui/database seed` 中途报错退出 |
| **根因** | 表已有数据导致唯一约束冲突 / 迁移未执行(表不存在)/ 外键依赖顺序错 |
| **排查命令** | 看报错的阶段(7 阶段模式化);`docker compose exec db psql -U ihui -d ihui_dev -c "SELECT COUNT(*) FROM users"` 查已有数据 |
| **修复方案** | 1. 种子脚本有容错隔离(单阶段失败不影响其他阶段),重跑即可补齐<br>2. 唯一冲突:`ON CONFLICT DO NOTHING`(种子脚本已内置)<br>3. 表不存在:先 `db:migrate`<br>4. 彻底重置:`docker compose down -v && up -d db → migrate → seed` |
| **预防** | 种子脚本幂等设计(`onConflictDoNothing`);首次 seed 前确保 migrate 完成 |

### 2.5 连接池耗尽

| 项 | 内容 |
|---|---|
| **症状** | API 报 `Too many connections` 或响应变慢;`pg_stat_activity` 显示大量 idle 连接 |
| **根因** | 连接未释放 / 并发请求超 max connections / 路由内创建独立连接未关闭 |
| **排查命令** | `docker compose exec db psql -U ihui -c "SELECT count(*) FROM pg_stat_activity"`;`docker compose exec db psql -U ihui -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state"` |
| **修复方案** | 1. 重启 api 进程释放连接<br>2. 调大 `postgresql.conf` 的 `max_connections`<br>3. 用 PgBouncer 连接池(生产环境)<br>4. 排查泄露:检查 `*.real.test.ts` 的 `forceExit: true` 配置(路由代码的 db 连接池不关闭) |
| **预防** | 所有查询用 Drizzle ORM 的 `db.query` / `db.execute`(自动管理连接);不手动 `pg.connect()` |

### 2.6 锁等待

| 项 | 内容 |
|---|---|
| **症状** | 请求超时 / 部分接口卡住;`pg_locks` 显示大量 `granted=false` |
| **根因** | 长事务未提交 / 并发写同一行 / 迁移期间 DDL 锁 |
| **排查命令** | `docker compose exec db psql -U ihui -c "SELECT pid, state, query, wait_event_type, wait_event FROM pg_stat_activity WHERE state != 'idle'"`;`SELECT pg_terminate_backend(<pid>)` 终止卡住的查询 |
| **修复方案** | 1. `SELECT pg_terminate_backend(<pid>)` 杀掉阻塞进程<br>2. 排查长事务代码(未 `await` 的查询 / 忘记 `commit`)<br>3. 迁移在低峰期执行 |
| **预防** | 事务尽量短;避免 `SELECT *` 长查询;用 `SET statement_timeout = '30s'` |

---

## 3. 认证类故障

### 3.1 JWT 验证失败

| 项 | 内容 |
|---|---|
| **症状** | API 返回 `401 Unauthorized` / `invalid token` / `jwt malformed` |
| **根因** | `JWT_SECRET` 不一致(api 与 web / ai-service 用了不同密钥)/ token 过期 / token 格式错(缺 `Bearer ` 前缀) |
| **排查命令** | 对比 `.env` 与 `apps/api/.env` 的 `JWT_SECRET`;用 [jwt.io](https://jwt.io) 解码 token 看 `exp`;`curl -H "Authorization: Bearer <token>" http://localhost:3001/api/auth/me` |
| **修复方案** | 1. 统一 `JWT_SECRET`(api / ai-service / web 代理必须一致)<br>2. token 过期:重新登录获取新 token<br>3. `JWT_EXPIRES_IN=7d` 调整有效期 |
| **预防** | 密钥变更后所有已签发 token 失效(需全员重新登录);生产环境密钥 ≥ 32 字符随机串 |

### 3.2 Token Family 冲突

| 项 | 内容 |
|---|---|
| **症状** | 刷新 token 时报 `token family conflict` / `refresh token reuse detected`;用户被强制登出 |
| **根因** | 同一个 refresh token 被使用两次(可能客户端多标签页并发刷新)/ 检测到 token 重放攻击 |
| **排查命令** | 查 `packages/auth/src/blacklist.ts` 的黑名单记录;查 Redis 中 token family 状态 |
| **修复方案** | 1. 正常流程:用户重新登录<br>2. 客户端修复:确保 refresh token 请求加锁(同一时间只发一次)<br>3. 清 Redis 中该用户的 token family:`redis-cli DEL token_family:<userId>` |
| **预防** | 客户端 refresh 请求加互斥锁;token family 机制是安全特性,不要关闭 |

### 3.3 Refresh Token 黑名单

| 项 | 内容 |
|---|---|
| **症状** | 登出后旧 token 仍可用 / 或登出后立即刷新失败 |
| **根因** | 黑名单未写入 Redis / Redis 被清空 / token 过期时间与黑名单 TTL 不匹配 |
| **排查命令** | `redis-cli KEYS "blacklist:*"` 查黑名单 key;`redis-cli TTL "blacklist:<tokenHash>"` 查剩余时间 |
| **修复方案** | 1. 确认 Redis 连通<br>2. 登出时 `blacklistToken(token, expiresIn)` 写入黑名单<br>3. Redis 清空后黑名单失效,旧 token 在过期前仍可用(可接受的安全窗口) |
| **预防** | Redis 持久化(`--appendonly yes`,已在 compose 配置);黑名单 TTL = token 剩余有效期 |

### 3.4 OAuth 回调错误

| 项 | 内容 |
|---|---|
| **症状** | 第三方登录(微信 / 钉钉 / 飞书 / GitHub / Google)回调报 `redirect_uri mismatch` / `invalid code` |
| **根因** | `redirect_uri` 与第三方平台配置不一致 / `NEXT_PUBLIC_*_REDIRECT_URI` 改后未重新 build / authorization code 过期(5 分钟) |
| **排查命令** | 对比 `.env` 的 `REDIRECT_URI` 与第三方平台后台配置;查 api 日志的 OAuth 回调请求 |
| **修复方案** | 1. 统一 `redirect_uri`(默认 `http://localhost:8801/callback?platform=<provider>`)<br>2. 改 `NEXT_PUBLIC_*` 后重新 `pnpm --filter @ihui/web build`(build 时静态编译)<br>3. authorization code 5 分钟内使用,超时重新发起登录 |
| **预防** | 开发环境与生产环境的 redirect_uri 分开配置;第三方平台后台添加所有环境 URI |

### 3.5 2FA 卡死

| 项 | 内容 |
|---|---|
| **症状** | 启用两步验证后无法登录 / TOTP 验证码始终报错 / 备用恢复码丢失 |
| **根因** | 设备时间不同步(TOTP 基于 30s 时间窗口)/ 密钥未正确保存 / 恢复码未生成 |
| **排查命令** | 确认设备时间:`w32tm /resync`(Windows);查 `user_auth_info` 表的 `totp_secret` 是否存在 |
| **修复方案** | 1. 同步设备时间<br>2. 用备用恢复码登录(每个只能用一次)<br>3. 管理员重置:`UPDATE user_auth_info SET totp_secret = NULL WHERE user_uuid = 'xxx'`(清除 2FA)<br>4. 重置后用户重新设置 2FA |
| **预防** | 启用 2FA 时务必保存恢复码;`auth-2fa.spec.ts` E2E 覆盖完整流程 |

---

## 4. i18n 类故障

### 4.1 Key Parity 不齐

| 项 | 内容 |
|---|---|
| **症状** | pre-commit 第 2 项报 `[FAIL] check-i18n-keys`;或页面显示 `missing_zh_TW_key` |
| **根因** | 新增 i18n key 只加了 `zh-CN.json` 忘了同步 `zh-TW` / `en` / `ja` / `ko` |
| **排查命令** | `node scripts/check-i18n-keys.mjs --staged`;`node scripts/pre-deploy.mjs`(第 4 项 i18n parity 检查) |
| **修复方案** | 1. 在缺失的语言文件中补齐对应 key(5 语言必须 parity)<br>2. 用 `scripts/verify-i18n.mjs` 辅助检查<br>3. 重复 key:用 Grep 确认同级命名空间无同名块后删除 |
| **预防** | `zh-CN.json` 为基准,其他 4 语言必须 key 集合完全一致;pre-commit 守门 |

### 4.2 zh-TW 简体字残留

| 项 | 内容 |
|---|---|
| **症状** | pre-commit 第 2b 项报 `scan-i18n-zh-residue.mjs zh-TW` 失败;繁体中文文件中出现简体字 |
| **根因** | 翻译时直接从 `zh-CN.json` 复制未做简繁转换 |
| **排查命令** | `node scripts/scan-i18n-zh-residue.mjs zh-TW --staged`(opencc-js cn→tw 字形转换检测) |
| **修复方案** | 1. `node scripts/fix-zh-tw-simp.mjs` 自动转换简体→繁体<br>2. 手动校验品牌名 / 术语(简繁可能用字不同) |
| **预防** | 繁体翻译用 OpenCC 转换后人工校验;品牌名参考 `scripts/brand-glossary.json` |

### 4.3 ko.json 中文残留

| 项 | 内容 |
|---|---|
| **症状** | pre-commit 第 2c 项报 `scan-i18n-zh-residue.mjs ko` 失败;韩语文件中出现未翻译中文 |
| **根因** | 翻译遗漏 / 直接从 `zh-CN.json` 复制值 |
| **排查命令** | `node scripts/scan-i18n-zh-residue.mjs ko --staged`(字符范围检测) |
| **修复方案** | 找到残留中文的 key,翻译为韩语;品牌名用 `scripts/brand-glossary.json` 的 canonical 映射 |
| **预防** | 新增 key 时 5 语言同步翻译;`scripts/apply-brand-glossary.mjs` 应用品牌映射 |

### 4.4 en.json 破碎机翻

| 项 | 内容 |
|---|---|
| **症状** | pre-commit 第 2e 项报 `check-i18n-broken-en.mjs` 失败;英文文件中出现 `AgentDevPlatform` / `M3SubAI` 等拼接破碎词 |
| **根因** | 机翻质量差 / 无空格拼接 / 拼音残留 |
| **排查命令** | `node scripts/check-i18n-broken-en.mjs --staged`(检测 no-space-concat / case-chaos / possible-pinyin / zh-residue) |
| **修复方案** | 1. 手动修正破碎英文<br>2. 品牌 / 技术缩写(AI / GPT / LLM 等 50+)在白名单内不报错<br>3. `node scripts/apply-brand-glossary.mjs` 统一品牌英文名 |
| **预防** | 英文翻译优先用人工或高质量 MT;品牌名参考 `brand-glossary.json` |

---

## 5. 守门类故障(pre-commit)

pre-commit 共 23 项守门(完整清单见 [AGENTS.md §守门脚本速查](../AGENTS.md))。下表列出常见失败项的修复方法。

| # | 守门项 | 常见失败原因 | 修复方案 |
|---|---|---|---|
| 1 | `check-api-key-leak.mjs` | 代码中硬编码了真实 API key | 删除 key,改用环境变量;确认 `.env` 已 gitignore |
| 2 | `check-i18n-keys.mjs` | 5 语言 key 不齐 | 补齐缺失语言的 key(见 §4.1) |
| 2b | `scan-i18n-zh-residue.mjs zh-TW` | 繁体文件有简体字 | `node scripts/fix-zh-tw-simp.mjs`(见 §4.2) |
| 2c | `scan-i18n-zh-residue.mjs ko` | 韩语文件有中文 | 手动翻译残留中文(见 §4.3) |
| 2e | `check-i18n-broken-en.mjs` | 英文破碎机翻 | 手动修正(见 §4.4) |
| 3 | `check-db-schema-drift.mjs` | 改 schema 未 generate 迁移 | `pnpm --filter @ihui/database db:generate`(见 §2.2) |
| 4 | `check-stale-dist.mjs` | packages dist 产物过期 | `pnpm --filter <包名> build` 重建 dist |
| 4b | `check-dist-encoding.mjs` | dist 有 UTF-8 BOM | `pnpm --filter <包名> build` 重建(去掉 BOM) |
| 5 | `lint-staged`(eslint + prettier) | 代码格式 / lint 错误 | `pnpm format` + 修复 lint error |
| 6 | `check-sanitizer-bypass.mjs` | `skipResponseSanitization: true` 绕过 | 删除该标志,或加注释说明合法理由 |
| 7 | `check-dedupe.mjs` | 依赖版本碎片化 | `pnpm --filter <包> add <dep>@<统一版本>` |
| 8 | `check-api-routes.mjs` | 前后端路由不一致 | 补齐缺失的路由定义(api 或 web) |
| 9 | `check-safe-parse.mjs`(warn-only) | `JSON.parse` 裸调无 try-catch | 包 `try-catch` 或用 `safeParse` |
| 11 | `check-rounded-full.mjs` | 容器用了 `rounded-full` | 改用尺寸梯度 `rounded-sm/md/lg/xl`(见 [AGENTS.md §4](../AGENTS.md)) |
| 12 | `check-delivery-report-consistency.mjs` | 交付报告自相矛盾 | 删除"无后续建议"或删除 P1-P5 遗留项 |
| 13b | `check-project-plan-size.mjs` | `PROJECT_PLAN.md` > 50KB | 归档已完成任务到 `.trae-cn/archive/` |
| 13c | `check-project-plan-archive.mjs` | 已完成任务条目被误删 | 恢复条目或留 `<!-- 已归档 -->` 占位注释 |
| 16 | 条件 typecheck | web staged 代码类型错误 | `pnpm --filter @ihui/web typecheck` 修复 |
| 16b | 条件 database build | database src 改了未 build | `pnpm --filter @ihui/database build` |
| 17 | `check-input-border-var.mjs` | CSS `hsl(hsl(...))` 嵌套 | 用扁平颜色 token |
| 18 | `check-native-title-tooltip.mjs` | 原生 `title` 属性当 tooltip | 用 Radix Tooltip 组件替代 |
| 19 | `check-staged-pollution.mjs`(warn-only) | staged 跨 ≥4 目录 | 拆分 commit,只 add 本任务文件 |
| 20 | `check-tailwind-class-conflict.mjs` | Tailwind class 冲突(BASE/BRANCH size) | 用 `cva` 或 `tailwind-merge` 解决冲突 |
| 21 | `check-multi-end-sync.mjs`(warn-only) | 单端改动未标注平台独占 | 在 PROJECT_PLAN.md 标注"平台独占"或补跨端改动 |
| 22 | `check-readme-sync.mjs`(warn-only) | 功能代码改了但 README 未更新 | 同步更新 `README.md`(见 [AGENTS.md §22](../AGENTS.md)) |

> **跳过守门**:仅在 hook 失败原因是其他 agent 代码时可用 `--no-verify`(见 [AGENTS.md §12](../AGENTS.md));本任务自己代码失败必须修复,禁止跳过。

---

## 6. WebSocket 类故障

### 6.1 握手 401

| 项 | 内容 |
|---|---|
| **症状** | 前端 WebSocket 连接报 `Unexpected response code: 401` |
| **根因** | WS 连接未携带 JWT / token 过期 / `@fastify/websocket` 的 `verifyClient` 校验失败 |
| **排查命令** | 浏览器 DevTools → Network → WS → 查请求头是否含 `Authorization` 或 cookie `auth_token`;查 api 日志的 WS 握手错误 |
| **修复方案** | 1. 前端连接 WS 时从 cookie 取 `auth_token` 放入 query 或 header<br>2. 确认 `packages/auth/src/ws-auth.ts` 的 `verifyClient` 逻辑<br>3. token 过期:先刷新 token 再连 WS |
| **预防** | WS 认证逻辑与 HTTP 一致(共用 `@ihui/auth`);`ws-auth.ts` 单元测试覆盖 |

### 6.2 心跳超时

| 项 | 内容 |
|---|---|
| **症状** | WS 连接频繁断开重连 / 客户端报 `ping timeout` |
| **根因** | 心跳间隔与超时配置不匹配 / 网络不稳定 / 服务端未响应 ping |
| **排查命令** | 查 `apps/api/src/plugins/ws-ai.ts` 的心跳配置;浏览器 DevTools 看 WS frame 的 ping/pong |
| **修复方案** | 1. 调大心跳超时(client / server 一致)<br>2. 客户端实现自动重连(指数退避)<br>3. 服务端 `@fastify/websocket` 配置 `pingInterval` / `pingMaxInterval` |
| **预防** | 心跳间隔 30s / 超时 60s(经验值);客户端重连不无限,最多 5 次后提示用户 |

### 6.3 Redis Pub/Sub 不通

| 项 | 内容 |
|---|---|
| **症状** | 多实例部署时 WS 消息只在本实例广播,跨实例收不到 |
| **根因** | Redis Pub/Sub 未配置 / 频道名不一致 / Redis 连接断开 |
| **排查命令** | `redis-cli SUBSCRIBE <channel>` 监听频道;`redis-cli PUBSUB CHANNELS` 查活跃频道;查 api 日志的 Redis 连接状态 |
| **修复方案** | 1. 确认 `apps/api/src/plugins/redis.ts` 的 Pub/Sub 订阅<br>2. 统一频道命名(如 `ws:tenant:<tenantId>:broadcast`)<br>3. Redis 连通性:`redis-cli ping` |
| **预防** | 多实例部署必须用 Redis Pub/Sub 广播 WS;`ws-dedup.ts` 做消息去重避免重复推送 |

### 6.4 多实例广播丢失

| 项 | 内容 |
|---|---|
| **症状** | 部分用户收不到 WS 推送(连在其他实例上) |
| **根因** | 广播只发了本地连接 / Pub/Sub 消息序列化丢失 / 实例间状态不同步 |
| **排查命令** | 在每个实例日志中搜索消息 ID;`ws-dedup.ts` 去重日志;Redis `MONITOR` 查 Pub/Sub 流量 |
| **修复方案** | 1. 广播逻辑走 Redis Pub/Sub 而非本地 `server.publish()`<br>2. 消息序列化用 JSON(含 `messageId` / `tenantId`)<br>3. `ws-dedup.ts` 按 `messageId` 去重 |
| **预防** | WS 广播封装在统一抽象层(自动走 Pub/Sub);去重机制防止跨实例重复消费 |

---

## 7. AI 服务类故障

### 7.1 LiteLLM stub 模式

| 项 | 内容 |
|---|---|
| **症状** | AI 对话返回固定模拟文本(如 `"This is a stub response"`)/ 日志显示 `stub mode active` |
| **根因** | 所有 LLM provider key 均为空 → `_is_stub_mode()` 返回 `True` |
| **排查命令** | `cd apps/ai-service && python -c "from app.core.config import settings; print('stepfun:', bool(settings.stepfun_api_key))"`;查 `.env` 的 `STEPFUN_API_KEY` / `AGNES_API_KEY` 等 |
| **修复方案** | 1. 在 `apps/ai-service/.env` 填入任一 provider key(`STEPFUN_API_KEY` 推荐)<br>2. 重启 ai-service<br>3. `curl http://localhost:8000/health` 确认非 stub |
| **预防** | 开发环境至少配一个 provider;stub 模式仅用于纯前端开发不调 AI |

### 7.2 LangGraph 工作流异常

| 项 | 内容 |
|---|---|
| **症状** | Agent 工作流报 `StateError` / `GraphRecursionError` / 节点卡住 |
| **根因** | 工作流状态 schema 不匹配 / 递归超限(默认 25 步)/ 节点间状态传递丢失字段 |
| **排查命令** | 查 ai-service 日志的 LangGraph trace;`app/services/agent_graph.py` 的节点定义;`test_langgraph_service.py` 复现 |
| **修复方案** | 1. `GraphRecursionError`:调大 `recursion_limit` 或优化工作流减少步数<br>2. 状态不匹配:检查 `AgentState` TypedDict 定义,确认节点返回的字段在 state 中<br>3. 节点卡住:检查工具调用的超时配置 |
| **预防** | `test_agent_loop.py` / `test_langgraph_service.py` 覆盖核心工作流;新节点加单元测试 |

### 7.3 MCP 工具超时

| 项 | 内容 |
|---|---|
| **症状** | Agent 调用 MCP 工具后卡住 / 报 `TimeoutError` / 工具无响应 |
| **根因** | MCP server 未启动 / 工具执行耗时超限 / MCP 传输层(SSE / stdio)断开 |
| **排查命令** | 查 `app/services/mcp_server.py` 的超时配置;`app/routers/mcp.py` 的工具注册;ai-service 日志的 MCP 调用 |
| **修复方案** | 1. 确认 MCP server 进程存活<br>2. 调大工具超时(`timeout` 参数)<br>3. SSE 传输:检查长连接是否被 Nginx / 反代截断(设 `proxy_read_timeout`)<br>4. stdio 传输:检查子进程是否 crash |
| **预防** | MCP 工具设合理超时(默认 30s);`test_mcp_server.py` 覆盖工具调用 |

### 7.4 A2A Redis 持久化失败

| 项 | 内容 |
|---|---|
| **症状** | Agent-to-Agent 通信消息丢失 / `a2a_service` 报 Redis 写入失败 |
| **根因** | Redis 连接断开 / A2A 消息序列化失败 / Redis 内存满 |
| **排查命令** | `redis-cli ping`;`redis-cli INFO memory` 查内存;`redis-cli KEYS "a2a:*"` 查 A2A key;ai-service 日志的 A2A 错误 |
| **修复方案** | 1. 确认 Redis 连通<br>2. 序列化问题:检查 `app/services/a2a_service.py` 的 JSON 编码<br>3. 内存满:`redis-cli FLUSHDB`(仅开发)或扩容<br>4. 降级:A2A 支持内存模式回退 |
| **预防** | `test_a2a_service.py` 覆盖 Redis 写入 / 降级;Redis 持久化 `--appendonly yes` |

### 7.5 向量记忆嵌入失败

| 项 | 内容 |
|---|---|
| **症状** | 向量记忆服务报 `embedding error` / 记忆检索返回空 / `vector_memory` 降级内存模式 |
| **根因** | 嵌入 API 调用失败(key 无效 / 限流)/ Redis 向量存储不可用 / pgvector 扩展未安装 |
| **排查命令** | `docker compose exec db psql -U ihui -c "SELECT extname FROM pg_extension WHERE extname = 'vector'"`(pgvector 是否安装);ai-service 日志的 embedding 错误;`app/services/vector_memory.py` 的 `_use_redis` 状态 |
| **修复方案** | 1. pgvector 未装:`CREATE EXTENSION IF NOT EXISTS vector;`(Docker 镜像 `pgvector/pgvector:pg15-alpine` 已内置)<br>2. 嵌入 API 限流:增加重试 / 降级到本地嵌入模型<br>3. Redis 不可用:自动降级内存模式(`_use_redis = False`)<br>4. 测试环境:conftest 的 `_isolate_vector_memory` fixture 强制内存模式 |
| **预防** | `test_vector_memory.py` 覆盖 Redis / 内存双模式;`test_rag.py` 覆盖嵌入调用 |

---

## 8. 部署类故障

### 8.1 docker-compose 启动失败

| 项 | 内容 |
|---|---|
| **症状** | `docker compose up -d` 报 `Bind for 0.0.0.0:5432 failed: port already allocated` 或容器 `unhealthy` |
| **根因** | 端口冲突(本机已有 PG/Redis)/ 容器依赖未就绪 / 环境变量缺失 |
| **排查命令** | `docker compose ps`(查状态);`docker compose logs <服务名> --tail 50`;`docker compose config`(查渲染后的配置) |
| **修复方案** | 1. 端口冲突:`netstat -ano | findstr :5432` 找占用进程,停掉或改端口<br>2. unhealthy:查 healthcheck 日志,确认依赖服务(db / redis / migrate)已 healthy<br>3. 环境变量:确认 `.env` 的 `DB_PASSWORD` / `JWT_SECRET` / `CREDENTIALS_ENCRYPTION_KEY` 非空<br>4. Grafana 启动失败:必须配 `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`(compose 强制 `:?`) |
| **预防** | 用 `scripts/dev-up.ps1`(自动等依赖就绪);生产环境用 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) 流程 |

### 8.2 Nginx 502 Bad Gateway

| 项 | 内容 |
|---|---|
| **症状** | 浏览器访问返回 `502 Bad Gateway` |
| **根因** | Nginx 反代后端不可达 / api 容器未启动 / 防火墙阻断内部网络 |
| **排查命令** | `docker compose ps api`(查 api 是否 running + healthy);`docker compose exec nginx nginx -t`(查 Nginx 配置);`docker compose exec nginx curl http://api:8080/api/health`(从 Nginx 容器内测连通) |
| **修复方案** | 1. api 容器未启动:`docker compose up -d api`<br>2. api unhealthy:查 api 日志,可能是 DB/Redis 连接失败(见 §1.1 / §1.2)<br>3. Nginx 配置:确认 `proxy_pass http://api:8080` 端口与 api 一致<br>4. 网络:确认 Nginx 与 api 在同一 Docker network(`ihui-net`) |
| **预防** | api healthcheck `wget --spider http://127.0.0.1:8080/api/health`;Nginx 配置见 `deploy/nginx/nginx.conf` |

### 8.3 证书过期

| 项 | 内容 |
|---|---|
| **症状** | 浏览器报 `NET::ERR_CERT_DATE_INVALID` / HTTPS 不可访问 |
| **根因** | Let's Encrypt 证书过期(90 天)/ 自动续期 cron 未执行 |
| **排查命令** | `pnpm cert:check`(检查过期);`openssl s_client -connect <domain>:443 -servername <domain>` 查证书详情;`crontab -l | grep cert`(查续期 cron) |
| **修复方案** | 1. 手动续期:`deploy/scripts/deploy_certs.sh` 或 `certbot renew`<br>2. 续期后重载 Nginx:`docker compose exec nginx nginx -s reload`<br>3. cron 未执行:检查 `deploy/cron/cert-renew.cron` 是否安装 |
| **预防** | `pnpm cert:check` 定期检查;`deploy/cron/cert-renew.sh` 自动续期;证书到期前 7 天告警 |

### 8.4 migrate 容器退出码非 0

| 项 | 内容 |
|---|---|
| **症状** | `docker compose up` 时 `migrate` 容器退出码 1,api 依赖 `service_completed_successfully` 不满足 → api 不启动 |
| **根因** | 迁移 SQL 报错 / DB 不可达 / `DATABASE_URL` 不对 / 迁移文件损坏 |
| **排查命令** | `docker compose logs migrate --tail 50`(查迁移错误);`docker compose exec db pg_isready`(DB 就绪) |
| **修复方案** | 1. 看迁移错误日志,修复 SQL<br>2. DB 不可达:确认 `migrate` 容器的 `DATABASE_URL` 指向 `db:5432`(Docker 内部网络)<br>3. 迁移文件损坏:修复后重建 migrate 镜像 `docker compose build migrate`<br>4. 应急:手动 `docker compose run --rm migrate npx drizzle-kit migrate` |
| **预防** | 迁移文件提交前 `db:check`;migrate 容器 `restart: 'no'`(失败不无限重试) |

### 8.5 镜像构建失败

| 项 | 内容 |
|---|---|
| **症状** | `docker compose build` 或 CI `build.yml` 报 `COPY failed` / `npm error` / `pip install failed` |
| **根因** | `Dockerfile` 路径错 / 依赖安装失败 / 多阶段构建上下文不对 |
| **排查命令** | `docker compose build --no-cache <服务名>`(清缓存重建);`docker compose config` 查 build context |
| **修复方案** | 1. `deploy/docker/Dockerfile.api` / `.web` / `.migrate` 在 deploy/docker/,context 为 `.`<br>2. `apps/ai-service/Dockerfile` context 为 `apps/ai-service`<br>3. pnpm 安装失败:确认 `pnpm-lock.yaml` 已提交,用 `--frozen-lockfile`<br>4. pip 安装失败:确认 `uv.lock` 已提交 |
| **预防** | CI `build.yml` 在 push main 时自动构建 3 镜像验证;改 Dockerfile 后本地 `docker compose build` 验证 |

---

## 9. 性能类故障

### 9.1 API 慢

| 项 | 内容 |
|---|---|
| **症状** | API 响应 > 1s / 超时;P99 延迟高 |
| **根因** | 慢查询 / N+1 查询 / 缺索引 / 序列化大对象 / 限流排队 |
| **排查命令** | api 日志的请求耗时(Pino `responseTime`);`docker compose exec db psql -U ihui -c "SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10"`(慢查询);Prometheus `/metrics` |
| **修复方案** | 1. 慢查询:加索引 / 优化 SQL / 用 `EXPLAIN ANALYZE`<br>2. N+1:用 Drizzle 的 `with` 预加载<br>3. 序列化:分页 / 只查需要的列<br>4. 限流:调大 `@fastify/rate-limit` 的 `max` |
| **预防** | 性能基线见 [architecture.md §13](./architecture.md);Locust 压测验证 |

### 9.2 DB 慢查询

| 项 | 内容 |
|---|---|
| **症状** | 查询耗时 > 100ms / `pg_stat_statements` 显示高频慢查询 |
| **根因** | 缺索引 / 全表扫描 / 锁等待 / 统计信息过期 |
| **排查命令** | `EXPLAIN (ANALYZE, BUFFERS) <SQL>`;`SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10`;`SELECT * FROM pg_locks WHERE NOT granted` |
| **修复方案** | 1. 缺索引:`CREATE INDEX CONCURRENTLY idx_<表>_<列> ON <表>(<列>)`<br>2. 统计信息过期:`ANALYZE <表>`<br>3. 锁等待:见 §2.6<br>4. 全表扫描:检查 `WHERE` 条件是否命中索引 |
| **预防** | 迁移文件中同步建索引;`pg_stat_statements` 扩展开启 |

### 9.3 内存泄漏

| 项 | 内容 |
|---|---|
| **症状** | api / web 进程内存持续增长 / OOM killed / GC 频繁 |
| **根因** | 事件监听器未移除 / 闭包持有大对象 / 流未正确关闭 / 缓存无上限 |
| **排查命令** | `Get-Process node | Select-Object Id, WorkingSet64, StartTime`(查内存);`node --inspect` → Chrome DevTools Memory → Heap snapshot 对比 |
| **修复方案** | 1. 事件监听器:`removeEventListener` / `removeListener` 配对<br>2. 流:`stream.destroy()` 显式关闭<br>3. 缓存:用 LRU 设上限(`max` entries)<br>4. 临时:定时重启进程(PM2 / Docker `restart: unless-stopped`) |
| **预防** | Node.js `--max-old-space-size=4096` 限内存;Prometheus 监控内存趋势 |

### 9.4 Next.js 首屏慢

| 项 | 内容 |
|---|---|
| **症状** | FCP > 2s / LCP > 2.5s / Lighthouse Performance < 0.85 |
| **根因** | 首页 JS bundle 过大 / 服务端渲染慢 / 图片未优化 / 字体阻塞渲染 |
| **排查命令** | `pnpm --filter @ihui/web build:analyze`(bundle 分析);Lighthouse CI(见 [TESTING.md §9](./TESTING.md)) |
| **修复方案** | 1. bundle 大:动态 import / code split / tree shake<br>2. 图片:用 `next/image` 自动优化 + `sharp`<br>3. 字体:`next/font` 自托管 + `font-display: swap`<br>4. SSR 慢:检查 `getServerSideProps` 的查询性能 |
| **预防** | `apps/web/lighthouserc.json` 性能预算(FCP ≤ 2s / LCP ≤ 2.5s / CLS ≤ 0.1);CI 跑 Lighthouse |

### 9.5 AI 首 Token 慢

| 项 | 内容 |
|---|---|
| **症状** | AI 对话发送后等待 > 3s 才出第一个 token / 流式响应卡顿 |
| **根因** | LLM provider 响应慢 / 网络延迟 / 上下文过长导致 prompt 处理慢 / 未用流式 |
| **排查命令** | ai-service 日志的 LLM 调用耗时;`curl -N http://localhost:8000/api/v1/chat/stream`(测流式);检查 `LITELLM_MODEL` 的 provider |
| **修复方案** | 1. 换更快的 provider / 模型(如 `stepfun/step-3.7-flash`)<br>2. 上下文压缩:`app/core/compaction.py` 压缩历史消息<br>3. 确认用流式(`stream: true`)而非等完整响应<br>4. 网络延迟:换离 LLM provider 更近的部署区域 |
| **预防** | `test_compaction.py` 覆盖上下文压缩;SSE buffer 优化流式输出 |

---

## 10. 工具类故障

### 10.1 pnpm install 失败

| 项 | 内容 |
|---|---|
| **症状** | `pnpm install` 报 `ERR_PNPM_PEER_DEP_ISSUES` / `ERR_PNPM_NO_MATCHING_VERSION` / lock 文件不匹配 |
| **根因** | peer 依赖版本冲突 / `pnpm-lock.yaml` 与 `package.json` 不同步 / registry 不通 |
| **排查命令** | `pnpm install --frozen-lockfile`(CI 模式,报具体冲突);`pnpm why <包名>`(查依赖链) |
| **修复方案** | 1. peer 冲突:`pnpm.peerDependencyRules.ignoreMissing` 已忽略 `@opentelemetry/api`;其他需修复版本<br>2. lock 不同步:`pnpm install`(更新 lock)后提交<br>3. registry 不通:检查 `.npmrc` 的 registry 配置;网络代理<br>4. 彻底重装:`pnpm clean && pnpm install` |
| **预防** | CI 用 `--frozen-lockfile`;改依赖后立即提交更新后的 `pnpm-lock.yaml` |

### 10.2 git push 被 hook 阻断

| 项 | 内容 |
|---|---|
| **症状** | `git push` 被 `pre-push` hook 阻断,报 typecheck 失败 / 跨 agent 改动告警 |
| **根因** | pre-push 跑 `pnpm typecheck:full` 失败 / `check-agents.mjs` 检测到跨 agent 改动 / 其他 agent 代码有类型错误 |
| **排查命令** | 看 hook 输出的具体错误;`pnpm typecheck:full`(手动跑确认);`git status --porcelain`(查 working tree) |
| **修复方案** | 1. **本任务代码错误**:修复后正常 push,禁止 `--no-verify`<br>2. **其他 agent 代码错误**:用 `--no-verify` 跳过(合法场景,见 [AGENTS.md §12](../AGENTS.md))<br>3. **跨 agent 改动告警**:在 PROJECT_PLAN.md 标注跨端范围<br>4. **typecheck 太慢**:`HUSKY_SKIP_TYPECHECK=1 git push`(紧急,不推荐) |
| **预防** | push 前自验 `pnpm typecheck`;post-commit 钩子自动 push(`git-push-guard.mjs`) |

### 10.3 RunCommand 工具失联

| 项 | 内容 |
|---|---|
| **症状** | TRAE IDE 内 RunCommand 连续 2 次返回 `{Exited, exit_code 0, 空输出}`;dev server 启动无响应 |
| **根因** | TRAE 终端工具与系统 shell 通信异常(已知问题) |
| **排查命令** | 在 TRAE 终端面板手动执行 `node -v` 确认终端可用 |
| **修复方案** | 1. **不再尝试 `Start-Process` 派生独立窗口**(会污染用户桌面)<br>2. 直接告知用户"RunCommand 工具失联,请在 TRAE 终端面板手动执行"<br>3. 提供手动命令清单:<br>`pnpm --filter @ihui/web dev`<br>`pnpm --filter @ihui/api dev`<br>`cd apps/ai-service && uvicorn app.main:app --reload --port 8000`<br>4. 用户确认服务跑起来后再继续验证 |
| **预防** | 查 `c:\Users\Administrator\.trae-cn\memory\projects\-g-IHUI-AI\project_memory.md` 是否已知约束;dev server 永远用 `long_running_process` + `blocking: false` 在 TRAE 内部跑 |

### 10.4 PowerShell 弹窗污染

| 项 | 内容 |
|---|---|
| **症状** | dev server 启动时用户桌面弹出多个 PowerShell 窗口 |
| **根因** | 用了 `Start-Process` / `cmd /c start` / `WScript.Shell.Run` 等派生独立可见窗口的方式 |
| **排查命令** | 检查启动脚本是否用了 `Start-Process`(无 `-WindowStyle Hidden`) |
| **修复方案** | 1. dev server 永远用 RunCommand `long_running_process` + `blocking: false` 在 TRAE 内部跑<br>2. 必须用 `Start-Process` 时:`-WindowStyle Hidden -RedirectStandardOutput "$env:TEMP\*.log"`<br>3. 用 `scripts/dev-all.ps1`(用户在真实 PowerShell 中执行,独立窗口是预期行为) |
| **预防** | 绝对红线:任何 dev server 永远只在 TRAE 内部运行,不弹独立窗口(见 [AGENTS.md §19](../AGENTS.md)) |

### 10.5 git-push-guard 报 ahead

| 项 | 内容 |
|---|---|
| **症状** | post-commit 钩子报 `local ahead of origin by N commits,pushing...` 后 push 失败 |
| **根因** | 网络不通 / 远端有新提交(push 被拒)/ 分支无 upstream |
| **排查命令** | `git status`(查 ahead/behind);`git log --oneline origin/main..HEAD`(查未推送 commit);`git remote -v`(查 remote) |
| **修复方案** | 1. 网络问题:重试 `git push origin <branch>` 或 `pnpm push:safe`(自动重试)<br>2. 远端有新提交:`git pull --rebase origin main` 后重推<br>3. 无 upstream:`git push -u origin <branch>`<br>4. 验证:`node scripts/git-push-guard.mjs` 确认 local == remote |
| **预防** | post-commit 自动 push;交付前跑 `git-push-guard.mjs` 验证(见 [AGENTS.md §21](../AGENTS.md)) |
