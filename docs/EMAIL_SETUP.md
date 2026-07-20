# 邮件服务部署手册(腾讯云 SES + IHUI AI)

> **作用域**:`apps/api` 邮件服务(`src/services/email-service.ts`)的完整启用流程。
> 适用场景:验证码邮件 / 事务通知邮件 / 营销订阅邮件。
> **预计耗时**:首次配置 10-15 分钟,DNS 生效后等 5-30 分钟可发件。

---

## 1. 准备清单

| 资源 | 状态 | 说明 |
|---|---|---|
| 已备案域名(本项目:`aizhs.top`) | ✅ | 必须,否则腾讯云 SES 拒审 |
| 域名 DNS 解析在**阿里云** | ✅ | 本项目 aizhs.top 在阿里云 |
| 腾讯云账号 + 实名认证 | ⏳ | 实名后才能用 SES |
| 阿里云子账号(可选) | ❌ | 本手册用主账号,生产建议子账号 |
| `apps/api` 本地可写 | ✅ | 改 `.env` 不需重启 dev server 以外的服务 |

---

## 2. 整体流程(7 步)

```
[1] 阿里云 DNS 加 3 TXT  ─→  [2] 腾讯云 SES 创建发件域名
                                    │
                                    ↓
[5] 注入 .env  ←─ [4] CAM 子账号 ── [3] SES 提交验证
                                            │  等待 5-30 分钟
                                            ↓
[6] 重启 apps/api  →  [7] 跑 e2e 测试验证
```

---

## 3. 步骤 1:阿里云 DNS 加 3 条 TXT 记录

登录阿里云 DNS 控制台 → `https://dc.console.aliyun.com/` → 找到 `aizhs.top` → **DNS 管理** → **添加记录**。

### 3.1 SPF 记录(发件 IP 白名单)

| 字段 | 值 |
|---|---|
| 记录类型 | **TXT** |
| 主机记录 | **@** |
| 记录值 | `v=spf1 include:qcloudmail.com -all` |
| TTL | 10 分钟 |
| 解析线路 | 默认 |

### 3.2 DMARC 记录(收件方投诉反馈)

| 字段 | 值 |
|---|---|
| 记录类型 | **TXT** |
| 主机记录 | **`_dmarc`**(前面有下划线) |
| 记录值 | `v=DMARC1; p=none` |
| TTL | 10 分钟 |
| 解析线路 | 默认 |

### 3.3 DKIM 记录(邮件签名)

| 字段 | 值 |
|---|---|
| 记录类型 | **TXT** |
| 主机记录 | **`qclouddkh2048._domainkey`**(点号是分隔符,无空格) |
| 记录值 | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8...`(从腾讯云 SES 控制台复制完整版,**不能带双引号**) |
| TTL | 10 分钟 |
| 解析线路 | 默认 |

> ⚠️ **DKIM 值的获取**:腾讯云 SES 控制台 → 域名管理 → 你的域名 → 验证 → DKIM 行的**复制按钮**(不是截图里被 `...` 截断的)。
> ⚠️ **阿里云 TXT 记录值不带双引号**:粘贴后如果有,手动删掉。

---

## 4. 步骤 2:腾讯云 SES 创建发件域名

1. 访问 `https://console.cloud.tencent.com/ses/domains`
2. 点击 **创建域名**
3. 填入:`aizhs.top`
4. 默认配置即可(发件类型:触发邮件)
5. 提交

---

## 5. 步骤 3:提交 DNS 验证

回到 `https://console.cloud.tencent.com/ses/domains` → 点击 `aizhs.top` 行的 **验证** 按钮。

- **立即**:状态变 "待验证"
- **5-30 分钟内**:SPF / DKIM 应该变 "已通过"
- **DMARC**:可能一直显示 "待验证" 或 "未配置",**不影响发邮件**

> 验证失败 → 见 [排错 1](#排错-1-dkim-一直验证失败)

---

## 6. 步骤 4:腾讯云 CAM 创建 ses-sender 子账号(强烈推荐)

> 生产必做:子账号 + 最小权限 + 不开控制台访问 = 安全基线。

1. 访问 `https://console.cloud.tencent.com/cam`
2. 左侧 **用户** → **用户列表** → **新建用户** → **自定义创建**
3. 用户名:`ses-sender`
4. 访问方式:**只勾"编程访问"**(不勾控制台访问)
5. 关联策略:搜索 `QcloudSESFullAccess` → 勾选
6. 审阅 → 完成
7. **立即复制弹窗里的 SecretId(AKID 开头) + SecretKey(32 字符)**

> ⚠️ **SecretKey 只显示这一次**,关掉就找不回来。立即保存到本地 `.env`。

### 6.1 不想用子账号(快速但危险)

API 密钥管理 → 新建密钥 → 复制 SecretId + SecretKey。
**生产环境禁止**——主账号 AK/SK 可控所有云资源。

---

## 7. 步骤 5:注入 AK/SK 到 `apps/api/.env`

打开 `apps/api/.env`(没有就 `cp .env.example .env`),把下面 4 行填上真值:

```bash
# 邮件服务
MAIL_PROVIDER=auto

# 腾讯云 SES(国内邮箱)
TENCENT_SES_SECRET_ID=AKIDxxxxxxxxxxxxxxxxxxxx   # 替换成你的真值
TENCENT_SES_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxx  # 替换成你的真值
TENCENT_SES_FROM=noreply@aizhs.top               # 必须是 aizhs.top 域名下的地址
TENCENT_SES_REGION=ap-hongkong                   # 默认值,无需改
```

> 🚨 **绝不要**把 `.env` 文件 commit 到 git(`.gitignore` 已保护)。
> 🚨 **绝不要**把 SecretId/Key 粘贴到聊天 / Issue / 邮件 / 截图。
> 🚨 **绝不要**用主账号 AK/SK。

---

## 8. 步骤 6:重启 apps/api 加载新环境变量

```bash
# 终止旧的 next-server / node 进程
cd g:\IHUI-AI
pnpm --filter @ihui/api dev    # 重启会读新 .env
```

---

## 9. 步骤 7:跑 e2e 测试验证

启动 mock SMTP(模拟收件,不发真邮件):

```bash
# Terminal 1
cd g:\IHUI-AI\apps\api
node mock-smtp.mjs
```

跑 e2e 测试:

```bash
# Terminal 2
cd g:\IHUI-AI\apps\api
npx tsx tests/email-e2e-test.ts
```

**期望输出**:
```
✅ 通过: N
❌ 失败: 0
📧 mock SMTP 累计邮件: 4 封
✅ 端到端测试全部通过
```

**真实发件测试**(不用 mock-smtp,真发到你的邮箱):

```bash
# 改 .env: SMTP_ENABLED=false
# 改 .env: TENCENT_SES_SECRET_ID=真值
# 改 .env: TENCENT_SES_SECRET_KEY=真值

cd g:\IHUI-AI\apps\api
# 临时脚本:向 你的邮箱@qq.com 发一封测试邮件
npx tsx -e "
import('./src/services/email-service.js').then(async ({ sendEmail }) => {
  const r = await sendEmail({
    to: 'your-real-email@qq.com',
    subject: '【IHUI AI】SES 联通测试',
    html: '<p>如果你收到这封邮件,说明 SES 已配置成功 🎉</p>',
    scene: 'transaction',
  });
  console.log('result:', r);
})
"
```

---

## 10. 排错

### 排错 1:DKIM 一直验证失败

| 症状 | 原因 | 解决 |
|---|---|---|
| 状态 "验证失败:DKIM" | 记录值被截断(截图里 `...`) | 去腾讯云 SES → 域名 → 验证 → 点 DKIM 行的**复制按钮**,不要从截图复制 |
| 状态 "验证失败:DKIM" | 记录值带了双引号 | 阿里云 TXT 记录值粘贴后手动删引号 |
| 状态 "验证失败:DKIM" | DNS 未全球生效 | 等 5-30 分钟,或用 `nslookup -qt=txt qclouddkh2048._domainkey.aizhs.top 8.8.8.8` 查 |
| 状态 "验证失败:DKIM" | 主机记录拼错 | 必须是 `qclouddkh2048._domainkey`,点号分隔,无空格 |

### 排错 2:邮件进垃圾箱

| 症状 | 原因 | 解决 |
|---|---|---|
| 收件在垃圾箱 | SPF / DKIM 未通过 | 看 SES 域名状态,确保两个都是 "已通过" |
| 收件在垃圾箱 | 发件频率突增被反垃圾 | 控制发送速率(代码里加 jitter / 用队列) |
| 收件在垃圾箱 | From 地址与 MAIL FROM 不一致 | `TENCENT_SES_FROM` 必须是 `noreply@aizhs.top`,跟实际 from 一致 |

### 排错 3:SES 返回 429 / 限流

| 症状 | 原因 | 解决 |
|---|---|---|
| 报 `tencent 429: rate limit` | 超过 SES 配额 | 提工单申请提额,或加 BullMQ 队列限流(代码里 `emailQueue` 已存在) |
| 报 `tencent 429: rate limit` | 单 IP 高频 | 用 `MAIL_PROVIDER=tencent` 显式指定 + 配 `distributed-rate-limit` 插件 |

### 排错 4:子账号 SES 权限不足

| 症状 | 原因 | 解决 |
|---|---|---|
| 报 `tencent 403: unauthorized` | 子账号未关联策略 | CAM → 用户 → ses-sender → 关联策略 → 加 `QcloudSESFullAccess` |
| 报 `tencent 403: unauthorized` | AK/SK 复制错位 | 重新生成,SecretId 必须是 `AKID` 开头,SecretKey 是 32 字符 |

---

## 11. 安全红线 🚨

1. **绝不要 commit `.env`** — `.gitignore` 已保护,但要确认 `git status` 不显示 `.env`
2. **绝不要把 SecretId/Key 发到任何聊天 / Issue / 邮件 / 截图** — AI 对话历史不可控
3. **绝不要用主账号 AK/SK** — 子账号 + `QcloudSESFullAccess` 即可,失窃损失最小
4. **SecretKey 只显示一次** — 生成后立即保存,关掉弹窗就找不回来
5. **生产域名不要用 `noreply@` 直接回复** — 配 `reply-to` 到一个监控邮箱,避免用户回复丢

---

## 12. 相关文件

| 文件 | 作用 |
|---|---|
| [apps/api/src/services/email-service.ts](../apps/api/src/services/email-service.ts) | 邮件核心服务(SMTP / Resend / Tencent SES / stub) |
| [apps/api/src/routes/auth-extended.ts](../apps/api/src/routes/auth-extended.ts) | `/api/auth/email/code` `/api/auth/login/email` `/api/auth/register/email` 3 个端点(已迁 Redis) |
| [apps/api/src/utils/code-store.ts](../apps/api/src/utils/code-store.ts) | 验证码存储(Redis 后端,旧 in-memory 灰度保留) |
| [packages/database/src/schema/email-logs.ts](../packages/database/src/schema/email-logs.ts) | 邮件审计日志表 |
| [packages/database/drizzle/0122_uneven_magneto.sql](../packages/database/drizzle/0122_uneven_magneto.sql) | `email_logs` 表的 migration |
| [apps/api/.env.example](../apps/api/.env.example) | 环境变量模板(已补全 13 个邮件配置项) |
| [apps/api/tests/email-e2e-test.ts](../apps/api/tests/email-e2e-test.ts) | SMTP 通道 e2e 测试(需先启动 mock-smtp.mjs) |
| [apps/api/mock-smtp.mjs](../apps/api/mock-smtp.mjs) | 本地 mock SMTP(端口 1025) |

---

## 13. 相关链接

- 腾讯云 SES 控制台:`https://console.cloud.tencent.com/ses/domains`
- 腾讯云 CAM(子账号管理):`https://console.cloud.tencent.com/cam`
- 腾讯云 SES API 文档:`https://cloud.tencent.com/document/product/1288/51034`
- 阿里云 DNS 控制台:`https://dc.console.aliyun.com/`
- DNS 查询工具:`https://toolbox.googleapps.com/apps/dig/#TXT/`
