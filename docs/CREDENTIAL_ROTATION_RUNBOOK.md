# 凭证轮换手册 (Credential Rotation Runbook)

> **最后更新**: 2026-07-18
> **维护者**: IHUI-AI Assistant
> **触发场景**: 上线前 / 安全事件 / 定期轮换 (建议每 6 个月)

---

## 一、轮换原则

1. **先新后旧**: 先在源端 (商户平台 / 厂商) 生成新凭证,验证可用后再废弃旧凭证
2. **灰度切换**: 凭证变更期间,旧凭证与新凭证同时保留 24h,便于回滚
3. **可审计**: 每次轮换必须在 `docs/CREDENTIAL_ROTATION_LOG.md` 记录 (时间/操作人/旧值后 4 位/新值后 4 位)
4. **环境隔离**: 测试环境与生产环境凭证必须独立,严禁共用
5. **泄露即轮换**: 一旦发现凭证出现在 Git / 聊天记录 / 公开文档,立即按本手册轮换,无论是否到期

---

## 二、P0 - 必改 (上线前必须完成)

### P0-1. 微信支付 V3 KEY (APIv3 Key)

| 项目 | 值 |
|---|---|
| 位置 | `g:\IHUI-AI\.env.production` 第 91 行 `WX_PAY_V3_KEY` |
| 厂商 | 微信支付商户平台 |
| 操作 | https://pay.weixin.qq.com → 账户中心 → API 安全 → APIv3 密钥 |
| 长度 | 32 字节 (32 个 ASCII 字符) |
| 风险 | 持有此 KEY 可解密微信支付回调的 resource.ciphertext,等同支付数据访问权 |
| 轮换频率 | 每 6 个月 / 每次员工离职 / 历史项目封存后 |
| 备份 | 微信支付商户平台不存储历史 V3 KEY,重置后旧值立即失效,务必先在本地备份后再重置 |

**操作步骤**:

1. 登录 https://pay.weixin.qq.com → **账户中心** → **API 安全** → **APIv3 密钥**
2. 备份旧值(本地 1Password/Vault):
   ```bash
   # 复制旧值(注意:此操作会显示密钥,确保屏幕无旁观者)
   cat g:\IHUI-AI\.env.production | Select-String "WX_PAY_V3_KEY"
   ```
3. 生成新值(32 字符随机):
   ```powershell
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
   ```
4. 在商户平台点"重置" → 粘贴新值 → 确认(需要短信验证)
5. 等待 5 分钟(微信服务器缓存)
6. 更新 `g:\IHUI-AI\.env.production` 第 91 行
7. 重启 API 服务: `pnpm --filter @ihui/api start`
8. 验证: `curl http://localhost:8802/api/health/ready` → `checks.wechatPay.status` 应为 `ok`
9. **回滚**: 若新 KEY 无效,5 分钟内(缓存失效前)用旧 KEY 覆盖;超过 5 分钟则必须用新 KEY 排查

---

### P0-2. JKS 证书密码 (历史 Java 项目,保留参考)

| 项目 | 值 |
|---|---|
| 位置 | `D:\历史项目存档\ljd-交接文件\coze_zhs_py\jks-password.txt` |
| 用途 | Java 项目 jwt.jks 解锁 |
| 状态 | **已封存 (SEALED)**,新项目 g:\IHUI-AI 不使用 |
| 轮换频率 | N/A (历史项目已封存,新项目用 JWT_SECRET 替代) |

**新项目做法**: 使用 `JWT_SECRET` (32 字节随机字符串) 替代 JKS,配置在 `g:\IHUI-AI\.env.production` 第 20 行。

---

### P0-3. 智谱 API Key

| 项目 | 值 |
|---|---|
| 位置 | `.env.production` → `STEPFUN_API_KEY` (原 ZHIPU_API_KEY) |
| 厂商 | 智谱 AI / StepFun |
| 操作 | https://open.bigmodel.cn → 个人中心 → API Keys |
| 风险 | 持有可调用所有 GLM 模型的 API,按调用计费 |
| 轮换频率 | 每 6 个月 |

**操作步骤**:
1. https://open.bigmodel.cn → 登录
2. **个人中心** → **API Keys** → **添加新的 API Key**
3. 复制新 Key(只显示一次)
4. 备份旧 Key
5. 更新 `.env.production`
6. 重启 API + AI service
7. 验证: `curl http://localhost:8802/api/health/ready` → `checks.aiService.status` 应为 `ok`
8. **24h 后**删除旧 Key(保留 24h 灰度)

---

### P0-4. INTERNAL_AUTH_KEY (内部服务认证)

| 项目 | 值 |
|---|---|
| 位置 | `.env.production` → 内部服务间调用密钥 |
| 用途 | API ↔ AI service 内部认证 |
| 风险 | 持有可绕过 JWT 直接调用受保护端点 |
| 轮换频率 | 每 6 个月 |

**操作步骤**: 同步更新 `apps/api` 和 `apps/ai-service` 两侧,重启两侧,验证 200 OK。

---

### P0-5. VAPID 密钥 (Web Push)

| 项目 | 值 |
|---|---|
| 位置 | `.env.production` → `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` |
| 用途 | Web Push 通知签名 |
| 风险 | 持有可伪造推送通知 |
| 轮换频率 | 每 12 个月 |

**操作步骤**:
```bash
# 1. 生成新 VAPID 密钥对
npx web-push generate-vapid-keys

# 2. 同时更新 .env.production 和数据库 (用户订阅表)
psql -U ihui -d ihui -c "UPDATE push_subscriptions SET vapid_public_key='<new-pub>'"

# 3. 重启 web 推送 worker
```

---

## 三、P1 - 30 天内完成

### P1-1. 数据库密码 (DB_PASSWORD)

| 项目 | 值 |
|---|---|
| 位置 | `.env.production` → `DB_PASSWORD` (第 12 行) |
| 厂商 | PostgreSQL |
| 操作 | 1) 改 PG 密码  2) 改 .env  3) 改 GitHub Secrets  4) 改 K8s Secret |
| 轮换频率 | 每 90 天 |

**操作步骤**:
```sql
-- 1. 改 PG 密码(需要 superuser)
ALTER USER ihui WITH PASSWORD '<new-password-32-chars>';

-- 2. 测试新密码
\q
psql -U ihui -d ihui -W  # 输入新密码

-- 3. 更新 .env.production 第 12 行
-- 4. 更新 GitHub Secrets → DB_PASSWORD
-- 5. 滚动重启所有 API 实例
-- 6. 验证 /api/health/ready.checks.database.status = 'ok'
```

---

### P1-2. 微信 AppSecret

| 项目 | 值 |
|---|---|
| 位置 | `.env.production` → `WX_MINI_SECRET` (第 84 行) |
| 厂商 | 微信公众平台 |
| 操作 | https://mp.weixin.qq.com → 开发 → 开发管理 → AppSecret → 生成 |
| 风险 | 持有可调用所有公众号 API (用户管理/消息推送/支付) |
| 轮换频率 | 每 90 天 |

**操作步骤**:
1. https://mp.weixin.qq.com → **开发** → **开发管理** → **开发者ID**
2. 找到 AppSecret → **重置**(需要管理员扫码)
3. 重置后旧值立即失效,先停服再重置
4. 更新 `.env.production` 第 84 行
5. 重启所有 web/api 实例
6. 验证: 登录任意公众号测试账号 → 应能正常获取 access_token

---

### P1-3. 17 个 AI 厂商 API Key

详细清单见 `apps/api/src/config/vendors.ts` (运行 `pnpm --filter @ihui/api init:vendors` 可查看):

| 厂商 | 环境变量 | 轮换周期 |
|---|---|---|
| StepFun | `STEPFUN_API_KEY` | 180 天 |
| Agnes | `AGNES_API_KEY` | 180 天 |
| Groq | `GROQ_API_KEY` | 90 天 |
| Gemini | `GEMINI_API_KEY` | 90 天 |
| OpenRouter | `OPENROUTER_API_KEY` | 90 天 |
| OpenAI | `OPENAI_API_KEY` | 90 天 |
| Anthropic | `ANTHROPIC_API_KEY` | 90 天 |
| 智谱 | (已并入 STEPFUN) | - |
| 阿里云 DashScope | (迁移到 OpenRouter) | - |
| 字节豆包 | (迁移到 OpenRouter) | - |
| 腾讯混元 | (迁移到 OpenRouter) | - |
| 百度文心 | (迁移到 OpenRouter) | - |
| 讯飞星火 | (迁移到 OpenRouter) | - |
| 商汤日日新 | (迁移到 OpenRouter) | - |
| 阿里通义 | (迁移到 OpenRouter) | - |
| Moonshot Kimi | (迁移到 OpenRouter) | - |
| DeepSeek | (迁移到 OpenRouter) | - |
| MiniMax M3 | (迁移到 OpenRouter) | - |

**通用操作步骤**:
1. 登录厂商控制台 → **API Keys** → **创建新 Key**
2. 在 `.env.production` 中**新增**一行(不要立即覆盖): `STEPFUN_API_KEY_V2=<new-key>`
3. 修改 `apps/api/src/config/index.ts` 支持 v1/v2 双 KEY 灰度
4. 部署并观察 24h
5. 删除 v1 KEY,移除 `.env.production` 中的 v1

---

### P1-4. Redis 密码 (REDIS_PASSWORD)

| 项目 | 值 |
|---|---|
| 位置 | `.env.production` → `REDIS_PASSWORD` (第 16 行) |
| 厂商 | Redis |
| 风险 | 持有可读写所有缓存 (含 session / token) |
| 轮换频率 | 每 90 天 |

**操作步骤**:
```bash
# 1. 在 Redis 中设置新密码
redis-cli -a <old-password> CONFIG SET requirepass "<new-password>"
redis-cli -a <new-password> PING  # 应返回 PONG

# 2. 永久写入 redis.conf
# requirepass <new-password>

# 3. 更新 .env.production 第 16 行
# 4. 滚动重启 API 实例
# 5. 验证 /api/health/ready.checks.redis.status = 'ok'
```

---

### P1-5. MinIO AccessKey / SecretKey

| 项目 | 值 |
|---|---|
| 位置 | `.env.production` → `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` |
| 厂商 | MinIO |
| 风险 | 持有可读写所有用户上传文件 |
| 轮换频率 | 每 180 天 |

**操作步骤**:
```bash
# 1. MinIO 控制台 (http://minio:9001) → Identity → Users
# 2. 选中用户 → Change Password
# 3. 同步更新 .env.production
# 4. 滚动重启 web/api
# 5. 验证文件上传/下载
```

---

## 四、轮换检查清单 (Checklist)

执行任何 P0/P1 轮换前,先打印此清单并逐项确认:

- [ ] 已通知相关人员 (客服 / 运维)
- [ ] 已确认维护窗口(避免业务高峰)
- [ ] 已备份旧值(本地 1Password,严禁 Git)
- [ ] 已准备好回滚脚本 (`scripts/rollback-credential.ps1`)
- [ ] 已通知监控系统 (避免误报)
- [ ] 轮换完成后 24h 内观察业务指标
- [ ] 24h 后删除旧值
- [ ] 已在 `docs/CREDENTIAL_ROTATION_LOG.md` 记录(操作人/时间/前后 4 位)

---

## 五、紧急回滚

发现新凭证导致生产故障:

1. **5 分钟内**: 旧值覆盖新值,重启服务
   ```bash
   # 假设旧值在 1Password Vault "IHUI-AI/WeChatPay-V3Key-OLD"
   ./scripts/rollback-credential.ps1 -Service wechat-pay -ToVault IHUI-AI/WeChatPay-V3Key-OLD
   ```
2. **5-60 分钟内**: 微信支付 / 厂商有缓存,需等缓存失效
3. **60 分钟+**: 走故障流程,通知客服/管理层

---

## 六、轮换日志模板

`docs/CREDENTIAL_ROTATION_LOG.md` 每次轮换追加:

```markdown
## 2026-07-18 微信支付 V3 KEY 轮换

- **操作人**: 张三 (微信支付商户管理员)
- **原因**: 历史项目封存后凭证视为泄露 (ARCHIVED.txt §三)
- **旧值后 4 位**: ...A8F2
- **新值后 4 位**: ...K3M9
- **生效时间**: 2026-07-18 14:30 CST
- **验证**: /api/health/ready.checks.wechatPay.status = "ok" ✓
- **回滚预案**: 24h 内保留旧值
- **完成时间**: 2026-07-18 14:35 CST
```

---

## 七、相关工具脚本

- `scripts/cert-expiry-check.mjs` - 检查所有证书有效期(提前 30 天告警)
- `scripts/cert-renew-watchdog.mjs` - 平台证书定期拉取(建议每月 1 次)
- `scripts/check-api-key-leak.mjs` - Git 历史泄露扫描
- `scripts/rollback-credential.ps1` - 一键回滚(需安装 1Password CLI)

---

## 八、参考资料

- [微信支付 APIv3 密钥管理](https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pay/transactions/chapter3_1.shtml)
- [OWASP 密钥管理备忘单](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [NIST SP 800-57 密钥管理建议](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
