# 密钥轮换手册（KEY_ROTATION_RUNBOOK）

> 本手册记录 `H:\历史项目存档` 向 `g:\IHUI-AI` 迁移封存后，所有历史凭证的轮换流程。历史项目全部凭证自封存日（2026-06-27）起**视为已泄露**，必须按本手册完成轮换方可上线。

| 项目 | 内容 |
|------|------|
| 手册版本 | v1.0 |
| 生成日期 | 2026-06-27 |
| 生成方 | IHUI-AI Assistant（loop 工作流） |
| 历史凭证归档位置 | `g:\IHUI-AI\server\deploy\legacy-archive\secrets\` |
| 新凭证配置位置 | `g:\IHUI-AI\server\.env`（本地）/ CI/CD Secrets（生产） |
| `.gitignore` 排除确认 | ✅ `server/deploy/legacy-archive/secrets/` 已排除 |

---

## 一、轮换优先级总览

| 优先级 | 含义 | 凭证数 | 截止时间 |
|--------|------|--------|---------|
| 🔴 **P0** | 上线前必须完成 | 5 | 上线前 |
| 🟡 **P1** | 上线后 30 天内完成 | 5 类（含 17 个 AI 厂商） | 上线后 30 天内 |

---

## 二、P0 必改（上线前必须完成）

### 2.1 JKS 证书密码

| 项目 | 内容 |
|------|------|
| 凭证名称 | JKS 证书密码 |
| 当前状态 | ❌ 已泄露（明文存储于 `secrets/jks-password.txt`，内容 `ly2rmv64`） |
| 历史位置 | `g:\IHUI-AI\server\deploy\legacy-archive\secrets\jks-password.txt` |
| 用途 | HTTPS 证书密钥库口令 |
| 轮换优先级 | 🔴 P0 |

**轮换步骤**：

1. 生成新的 JKS 密钥库：
   ```powershell
   keytool -genkeypair -alias ihui-ai -keyalg RSA -keysize 2048 -validity 3650 -keystore g:\IHUI-AI\server\deploy\keystore.p12 -storetype PKCS12 -storepass <新口令>
   ```
2. 将新口令写入 `server/.env`（不入库）：
   ```
   JKS_PASSWORD=<新口令>
   ```
3. 删除历史明文文件 `secrets/jks-password.txt`（或保留作归档，但不得再使用）。
4. 在生产环境通过 CI/CD Secret 注入 `JKS_PASSWORD`。

**验证方法**：

- 启动服务：`cd g:\IHUI-AI\server && python -m app.main`
- 访问 `https://localhost/health`，确认证书为新签发（浏览器查看证书指纹）。
- 检查日志：无 `keystore password incorrect` 报错。

---

### 2.2 智谱 API Key

| 项目 | 内容 |
|------|------|
| 凭证名称 | 智谱（ZhipuAI）API Key |
| 当前状态 | ❌ 已泄露（历史环境变量明文） |
| 历史位置 | 历史项目 `.env` / Nacos 配置（已归档入 `secrets/nacos-configs.zip`） |
| 用途 | 智谱流式对话（`server/app/api/v1/chat/zhipu.py`） |
| 轮换优先级 | 🔴 P0 |

**轮换步骤**：

1. 登录智谱开放平台 `https://open.bigmodel.cn/` → 控制台 → API Keys。
2. 撤销历史 Key，创建新 Key。
3. 将新 Key 写入 `server/.env`：
   ```
   ZHIPU_API_KEY=<新Key>
   ```
4. 在生产环境通过 CI/CD Secret 注入。

**验证方法**：

- 调用接口：`POST /api/v1/chat/zhipu/stream`，发送测试消息。
- 检查返回：流式响应正常，无 401/403 错误。
- 检查日志：无 `invalid api key` 报错。

---

### 2.3 INTERNAL_AUTH_KEY

| 项目 | 内容 |
|------|------|
| 凭证名称 | 内部服务间认证密钥（INTERNAL_AUTH_KEY） |
| 当前状态 | ❌ 已泄露（历史环境变量明文） |
| 历史位置 | 历史项目 `.env` / Nacos 配置 |
| 用途 | 微服务间内部调用鉴权（整合后用于管理端接口保护） |
| 轮换优先级 | 🔴 P0 |

**轮换步骤**：

1. 生成新的随机密钥（建议 64 字符以上）：
   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
2. 将新密钥写入 `server/.env`：
   ```
   INTERNAL_AUTH_KEY=<新密钥>
   ```
3. 同步更新前端管理端配置（如需）。
4. 在生产环境通过 CI/CD Secret 注入。

**验证方法**：

- 调用需内部鉴权的接口（如 `GET /api/v1/system/audit/logs`），携带新 Key。
- 检查返回：200 OK，无 401 错误。
- 检查日志：无 `invalid internal auth key` 报错。

---

### 2.4 SEED 密码

| 项目 | 内容 |
|------|------|
| 凭证名称 | SEED 初始化密码（管理员种子账号密码） |
| 当前状态 | ❌ 已泄露（历史环境变量明文） |
| 历史位置 | 历史项目 `.env` |
| 用途 | 系统初始化时创建的超级管理员账号密码（`server/scripts/seed_admin.py`） |
| 轮换优先级 | 🔴 P0 |

**轮换步骤**：

1. 生成新的强密码（建议 16 字符以上，含大小写+数字+符号）。
2. 将新密码写入 `server/.env`：
   ```
   SEED_ADMIN_PASSWORD=<新密码>
   ```
3. 重新执行种子脚本：
   ```powershell
   cd g:\IHUI-AI\server && python -m scripts.seed_admin
   ```
4. 登录后立即在管理后台修改密码为二次自定义密码。
5. 在生产环境通过 CI/CD Secret 注入。

**验证方法**：

- 使用新密码登录管理后台 `https://localhost/admin`。
- 检查返回：登录成功，跳转管理面板。
- 检查日志：无 `invalid credentials` 报错。

---

### 2.5 VAPID 密钥

| 项目 | 内容 |
|------|------|
| 凭证名称 | VAPID（Voluntary Application Server Identification）密钥对 |
| 当前状态 | ❌ 已泄露（历史 `.env.vapid` 明文） |
| 历史位置 | 历史项目 `.env.vapid` |
| 用途 | Web Push 推送通知签名（PWA 推送） |
| 轮换优先级 | 🔴 P0 |

**轮换步骤**：

1. 生成新的 VAPID 密钥对：
   ```powershell
   npx web-push generate-vapid-keys
   ```
2. 将新密钥写入 `server/.env` 与 `client/.env`：
   ```
   # server/.env
   VAPID_PUBLIC_KEY=<新公钥>
   VAPID_PRIVATE_KEY=<新私钥>
   VAPID_SUBJECT=mailto:admin@ihui-ai.com

   # client/.env
   VITE_VAPID_PUBLIC_KEY=<新公钥>
   ```
3. 前端重新构建：`cd g:\IHUI-AI\client && npm run build`。
4. 在生产环境通过 CI/CD Secret 注入。

**验证方法**：

- 访问 `https://localhost/`，允许通知权限。
- 触发推送测试：`POST /api/v1/notification/test`。
- 检查返回：推送成功送达浏览器。
- 检查日志：无 `VAPID signature invalid` 报错。

> ⚠️ 轮换后，已订阅的客户端会失效，需重新订阅。

---

## 三、P1 30 天内必改

### 3.1 数据库密码（PostgreSQL）

| 项目 | 内容 |
|------|------|
| 凭证名称 | PostgreSQL 数据库密码 |
| 当前状态 | ⚠️ 历史密码可能泄露（历史 MySQL 密码与 PG 密码相同或相似） |
| 历史位置 | 历史项目 `.env` / `secrets/nacos-configs.zip` |
| 用途 | 主数据库访问 |
| 轮换优先级 | 🟡 P1 |

**轮换步骤**：

1. 登录 PostgreSQL，修改用户密码：
   ```sql
   ALTER USER ihui_ai WITH PASSWORD '<新密码>';
   ```
2. 更新 `server/.env`：
   ```
   DATABASE_URL=postgresql+asyncpg://ihui_ai:<新密码>@localhost:5432/ihui_ai
   ```
3. 重启服务。
4. 在生产环境通过 CI/CD Secret 注入。

**验证方法**：

- 启动服务，检查数据库连接：`GET /api/v1/health/db`。
- 检查日志：无 `authentication failed` 报错。

---

### 3.2 微信 AppSecret

| 项目 | 内容 |
|------|------|
| 凭证名称 | 微信 AppSecret（小程序 / 公众号 / 支付） |
| 当前状态 | ⚠️ 历史可能泄露 |
| 历史位置 | 历史项目 `.env` / Nacos 配置 |
| 用途 | 微信登录、微信支付、公众号消息 |
| 轮换优先级 | 🟡 P1 |

**轮换步骤**：

1. 登录微信公众平台 `https://mp.weixin.qq.com/` → 开发 → 基本配置 → 重置 AppSecret。
2. 登录微信商户平台 `https://pay.weixin.qq.com/` → 账户中心 → API 安全 → 更新 API 密钥。
3. 将新 Secret 写入 `server/.env`：
   ```
   WECHAT_APP_ID=<AppID>
   WECHAT_APP_SECRET=<新AppSecret>
   WECHAT_MCH_ID=<商户号>
   WECHAT_API_KEY=<新API密钥>
   ```
4. 在生产环境通过 CI/CD Secret 注入。

**验证方法**：

- 调用小程序登录接口：`POST /api/v1/auth/wechat/login`。
- 调用微信支付下单接口：`POST /api/v1/payments/wechat/order`。
- 检查日志：无 `invalid appsecret` 或 `signature error` 报错。

---

### 3.3 17 个 AI 厂商 API Key

| 项目 | 内容 |
|------|------|
| 凭证名称 | 17 个 AI 厂商 API Key |
| 当前状态 | ⚠️ 历史可能泄露 |
| 历史位置 | 历史项目 `.env` / Nacos 配置 |
| 用途 | 多模型 AI 路由（`server/app/api/v1/ai/` 与 `chat/`） |
| 轮换优先级 | 🟡 P1 |

**17 个 AI 厂商清单**：

| 序号 | 厂商 | 环境变量名 | 对应 Python 路由 |
|------|------|-----------|-----------------|
| 1 | 智谱（ZhipuAI） | `ZHIPU_API_KEY` | `chat/zhipu.py`（P0 已含，此处仅核对） |
| 2 | 通义千问（DashScope） | `DASHSCOPE_API_KEY` | `ai/dashscope/route.py`、`chat/qwen.py` |
| 3 | 通义千问 Omni | `DASHSCOPE_API_KEY`（共用） | `chat/qwen_omni.py` |
| 4 | 豆包（火山方舟） | `ARK_API_KEY` | `chat/doubao.py`、`ai/doubao/route.py` |
| 5 | DeepSeek | `DEEPSEEK_API_KEY` | `chat/deepseek.py` |
| 6 | 可灵（KlingAI） | `KLING_API_KEY` | `chat/kling.py` |
| 7 | 即梦4（Jimeng4） | `JIMENG_API_KEY` | `ai/jimeng4.py` |
| 8 | 火山引擎（Volcengine） | `VOLC_API_KEY` | `ai/volcengine/route.py` |
| 9 | 百炼（Bailian） | `BAILIAN_API_KEY` | `ai/bailian/route.py` |
| 10 | Sora2 | `SORA2_API_KEY` | `ai/sora2/route.py` |
| 11 | Suno | `SUNO_API_KEY` | `ai/suno/route.py` |
| 12 | Gemini | `GEMINI_API_KEY` | `ai/gemini/route.py` |
| 13 | 露雅拉（Luyala） | `LUYALA_API_KEY` | `luyala_proxy/luyala_proxy.py` |
| 14 | OpenRouter | `OPENROUTER_API_KEY` | `openrouter_proxy/openrouter_proxy.py` |
| 15 | n8n | `N8N_API_KEY` | `ai/n8n/route.py` |
| 16 | 阿里云通义（AliAI） | `ALI_AI_API_KEY` | `ai/dashscope/route.py` |
| 17 | 腾讯云 | `TENCENT_SECRET_KEY` | `ai/tencent/route.py` |

**轮换步骤**（每个厂商通用流程）：

1. 登录对应厂商控制台。
2. 撤销历史 Key，创建新 Key。
3. 将新 Key 写入 `server/.env`（按上表环境变量名）。
4. 在生产环境通过 CI/CD Secret 注入。

**验证方法**（每个厂商）：

- 调用对应路由的测试接口（如 `POST /api/v1/chat/zhipu/stream`）。
- 检查返回：流式响应正常，无 401/403 错误。
- 检查日志：无 `invalid api key` 报错。

> 💡 建议编写自动化脚本批量验证 17 个 Key，可放入 `scripts/verify_ai_keys.py`（待补齐）。

---

### 3.4 Redis 密码

| 项目 | 内容 |
|------|------|
| 凭证名称 | Redis 访问密码 |
| 当前状态 | ⚠️ 历史可能泄露 |
| 历史位置 | 历史项目 `.env` |
| 用途 | 缓存、会话、限流 |
| 轮换优先级 | 🟡 P1 |

**轮换步骤**：

1. 登录 Redis，修改密码：
   ```bash
   redis-cli CONFIG SET requirepass "<新密码>"
   ```
2. 更新 `server/.env`：
   ```
   REDIS_URL=redis://:<新密码>@localhost:6379/0
   ```
3. 重启服务。
4. 在生产环境通过 CI/CD Secret 注入。

**验证方法**：

- 启动服务，检查 Redis 连接：`GET /api/v1/health/redis`。
- 检查日志：无 `NOAUTH Authentication required` 或 `WRONGPASS` 报错。

---

### 3.5 MinIO AccessKey / SecretKey

| 项目 | 内容 |
|------|------|
| 凭证名称 | MinIO 对象存储 AccessKey / SecretKey |
| 当前状态 | ⚠️ 历史可能泄露 |
| 历史位置 | 历史项目 `.env` |
| 用途 | 文件上传 / OSS 存储（`server/app/api/v1/content/file_storage.py`） |
| 轮换优先级 | 🟡 P1 |

**轮换步骤**：

1. 登录 MinIO 控制台 `http://localhost:9001` → Identity → Service Accounts。
2. 删除历史 Service Account，创建新 Service Account。
3. 更新 `server/.env`：
   ```
   MINIO_ACCESS_KEY=<新AccessKey>
   MINIO_SECRET_KEY=<新SecretKey>
   MINIO_ENDPOINT=http://localhost:9000
   MINIO_BUCKET=ihui-ai
   ```
4. 重启服务。
5. 在生产环境通过 CI/CD Secret 注入。

**验证方法**：

- 调用上传接口：`POST /api/v1/content/file_upload`，上传测试文件。
- 检查返回：上传成功，返回文件 URL。
- 检查日志：无 `Access Denied` 或 `InvalidAccessKeyId` 报错。

---

## 四、轮换后整体验证

完成全部 P0 + P1 轮换后，执行以下整体验证：

### 4.1 启动服务

```powershell
# 后端
cd g:\IHUI-AI\server
python -m app.main

# 前端
cd g:\IHUI-AI\client
npm run dev
```

### 4.2 调用对应接口

| 验证项 | 接口 | 期望结果 |
|--------|------|---------|
| 健康检查 | `GET /api/v1/health` | 200 OK |
| 数据库连接 | `GET /api/v1/health/db` | 200 OK |
| Redis 连接 | `GET /api/v1/health/redis` | 200 OK |
| HTTPS 证书 | `https://localhost/health` | 新证书指纹 |
| 智谱对话 | `POST /api/v1/chat/zhipu/stream` | 流式响应 |
| 微信登录 | `POST /api/v1/auth/wechat/login` | 200 OK |
| 微信支付 | `POST /api/v1/payments/wechat/order` | 200 OK |
| 文件上传 | `POST /api/v1/content/file_upload` | 200 OK，返回 URL |
| 推送通知 | `POST /api/v1/notification/test` | 推送送达 |
| 管理员登录 | `POST /api/v1/auth/login`（SEED 账号） | 200 OK，返回 token |

### 4.3 检查日志

```powershell
# 后端日志
Get-Content g:\IHUI-AI\server\logs\app.log -Tail 100 | Select-String -Pattern "error|invalid|failed|denied"
```

**期望结果**：无 `invalid api key`、`authentication failed`、`access denied`、`signature error` 等凭证相关错误。

---

## 五、轮换清单核对表

### 5.1 P0 上线前核对

| 序号 | 凭证 | 已轮换 | 已验证 | 签字 |
|------|------|--------|--------|------|
| 1 | JKS 证书密码 | ☐ | ☐ | — |
| 2 | 智谱 API Key | ☐ | ☐ | — |
| 3 | INTERNAL_AUTH_KEY | ☐ | ☐ | — |
| 4 | SEED 密码 | ☐ | ☐ | — |
| 5 | VAPID 密钥 | ☐ | ☐ | — |

### 5.2 P1 上线后 30 天内核对

| 序号 | 凭证 | 已轮换 | 已验证 | 签字 |
|------|------|--------|--------|------|
| 1 | 数据库密码（PostgreSQL） | ☐ | ☐ | — |
| 2 | 微信 AppSecret | ☐ | ☐ | — |
| 3 | 17 个 AI 厂商 API Key | ☐ | ☐ | — |
| 4 | Redis 密码 | ☐ | ☐ | — |
| 5 | MinIO AccessKey / SecretKey | ☐ | ☐ | — |

---

## 六、历史凭证位置（仅供审计回溯，禁止使用）

> ⚠️ 以下凭证自封存日（2026-06-27）起**视为已泄露**，仅供审计回溯，**禁止用于任何运行环境**。

| 凭证类别 | 历史位置 |
|---------|---------|
| JKS 证书密码 | `g:\IHUI-AI\server\deploy\legacy-archive\secrets\jks-password.txt` |
| 服务器连接配置 | `g:\IHUI-AI\server\deploy\legacy-archive\secrets\服务器连接配置.xts` |
| Nacos 配置包（含历史环境变量） | `g:\IHUI-AI\server\deploy\legacy-archive\secrets\nacos-configs.zip` |
| Xshell 会话文件（7 个） | `g:\IHUI-AI\server\deploy\legacy-archive\secrets\xshell-sessions\` |

> ℹ️ 完整凭证归档清单见报告 1 `LEGACY_ARCHIVE_CONFIRMATION.md` 第三节。

---

*手册生成时间：2026-06-27 · 生成方：IHUI-AI Assistant（loop 工作流）*
