# 智汇 AI 社区 - 安全规范

> 本文档说明项目安全策略、凭据管理、敏感数据保护、漏洞响应流程。
> 所有贡献者必须通读，老成员修改前请先同步更新。

---

## 1. 凭据管理

### 1.1 严禁硬编码

**绝对禁止**把以下凭据硬编码到代码、脚本、注释、提交信息中：
- 数据库密码、连接字符串
- API Key、Secret、Token
- JWT 私钥 / 公钥
- 阿里云 / 腾讯云 / 华为云 AccessKey
- OAuth 客户端 Secret
- Webhook 签名密钥
- SSH 私钥

**违规案例**（已修复并删除）：
- `code/edu/scripts/fix_db.js` 包含 `47.94.40.108:3306` 账号 `Raindrop_L` 密码 `Raindrop_L250604`
- `code/edu/scripts/fix_name.js` 同样硬编码
- `code/edu/scripts/init_lesson_data.js` 同样硬编码

**预防措施**：
- 用 `.env` + `python-dotenv` / `dotenv` / `vite` 的环境变量机制
- CI 用 GitHub Secrets / 阿里云 KMS / Vault
- 本地开发用 `.env.local`（不入库）
- 提交前用 `pre-commit` 钩子 `detect-private-key` + 自定义 `gitleaks` 扫描

### 1.2 凭据存放位置

| 凭据类型 | 本地开发 | CI/CD | 生产 |
|---|---|---|---|
| 数据库 | `.env` | GitHub Secrets | 阿里云 RDS 控制台 |
| 阿里云 OSS | `.env` | GitHub Secrets | 阿里云 RAM 控制台 |
| JWT 私钥 | `.env` | GitHub Secrets | 阿里云 KMS |
| 第三方 API | `.env` | GitHub Secrets | 阿里云 KMS |
| 钉钉 Webhook | `.env` | GitHub Secrets | 钉钉开放平台 |

**`.env` 模板**（`.env.example` / `.env.template`）：
```bash
# 智汇 AI 社区环境变量模板
# 复制为 .env 并填写真实值，.env 已在 .gitignore 忽略
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=
JWT_SECRET=
ALIYUN_ACCESS_KEY_ID=
ALIYUN_ACCESS_KEY_SECRET=
DINGTALK_WEBHOOK=
```

### 1.3 凭据泄露应急响应

**如果发现凭据泄露**（提交到 git、写入日志、截图等）：

1. **立即修改密码/吊销 Key**（不要等清理完成）
2. 检查 `.git` 历史记录（`git log -p`）
3. 如果已进入 git 历史，联系项目维护者用 `git filter-branch` / `bfg-repo-cleaner` 清理
4. 强制推送到远程（如有）
5. 通知所有协作者拉取最新代码
6. 在 `1/docs/SECURITY.md` 附录记录事件（脱敏后）

---

## 2. 敏感数据保护

### 2.1 日志脱敏

**项目已实现**：
- `1/server/app/utils/log_mask.py` - API 路径、邮箱、手机号、Token 脱敏
- `1/server/app/utils/api_mask.py` - API 响应脱敏
- `1/server/app/middleware/logging_middleware.py` - 中间件层脱敏

**脱敏规则**：
- 邮箱：`a***@example.com`
- 手机号：`138****1234`
- Token：保留前 4 + 后 4 字符
- 密码：完全替换为 `***`
- 身份证：保留前 6 + 后 4 字符

**新增日志**必须经过脱敏中间件，**不要**直接 `print()` 原始数据。

### 2.2 数据库访问

- **生产数据库**：仅允许运维 DBA 通过堡垒机访问
- **开发数据库**：使用种子数据 + 脱敏的真实数据子集
- **测试数据库**：使用 mock / factory-boy 生成的假数据
- **数据库备份**：加密后存放阿里云 OSS，保留 30 天

**禁止**：
- 在代码注释、PR 描述、issue 跟踪中贴真实数据
- 把生产数据库导出文件存到 git 仓库
- 用生产数据库凭据连接开发环境

### 2.3 用户数据

- 用户密码用 `bcrypt` 哈希（cost=12）
- 用户手机号、邮箱在数据库中加密存储（应用层 AES-256）
- 敏感字段查询必须经过脱敏中间件
- GDPR / 个保法合规：用户申请删除时执行硬删除 + 软删除标记

---

## 3. 依赖与漏洞

### 3.1 依赖管理

- **Node.js**：`package.json` + `package-lock.json` 必须提交
- **Python**：`requirements.txt` + `requirements.lock.txt` 必须提交
- **Java**：`pom.xml` / `build.gradle` + `gradle.lockfile` 必须提交

**定期更新**：
- 每月 1 号用 `npm outdated` / `pip list --outdated` 检查
- 用 `npm audit` / `pip-audit` / `snyk` 扫描漏洞
- CI `1/server/.github/workflows/security-audit.yml` 每周自动扫描

### 3.2 漏洞响应级别

| 级别 | 描述 | 响应时间 |
|---|---|---|
| **P0 - 严重** | 远程代码执行 / 凭据泄露 / SQL 注入 | 24 小时内修复 |
| **P1 - 高** | XSS / CSRF / 越权访问 | 7 天内修复 |
| **P2 - 中** | 信息泄露 / DoS / 弱加密 | 30 天内修复 |
| **P3 - 低** | 最佳实践违反 / 警告 | 下个迭代修复 |

### 3.3 漏洞报告

**内部**：
- 在 `1/server/.github/issues/` 创建 `security` 标签 issue
- 详细描述：影响范围、复现步骤、建议修复

**外部**：
- 邮件到 `security@zhs-platform.com`
- PGP 公钥：项目 `SECURITY.md` 附录

---

## 4. 网络与传输

### 4.1 HTTPS / TLS

- 生产环境**强制** HTTPS
- TLS 1.2+ 协议（禁用 TLS 1.0/1.1）
- 强加密套件：`ECDHE-RSA-AES256-GCM-SHA384` 等
- 证书：阿里云 SSL 免费证书 + Let's Encrypt 自动续期
- 内部服务通信：mTLS（Istio 服务网格）

### 4.2 CORS / CSP

- CORS 白名单：精确到域名 + 协议 + 端口
- CSP 策略：`default-src 'self'`，禁止 `unsafe-inline` / `unsafe-eval`
- HSTS：`max-age=31536000; includeSubDomains; preload`

### 4.3 防火墙与端口

- 生产环境仅开放：80 / 443
- 内部服务通过 VPC 内网通信
- 数据库端口（3306 / 5432）仅内网可访问
- SSH 端口（22）仅堡垒机可达

---

## 5. 应用安全

### 5.1 输入验证

- **所有用户输入**必须经过验证（白名单 + 长度 + 类型 + 范围）
- **SQL 查询**必须用参数化（SQLAlchemy ORM / SQL 参数化）
- **HTML 输出**必须转义（Vue 模板默认 + DOMPurify）
- **URL 跳转**必须白名单（避免开放重定向）

### 5.2 认证授权

- **认证**：JWT（HS256） + Refresh Token
- **授权**：RBAC（基于角色的访问控制）
- **会话**：HttpOnly + Secure + SameSite=Strict Cookie
- **密码策略**：8+ 字符 + 大小写 + 数字 + 特殊字符

### 5.3 防滥用

- 登录失败：5 次锁定 15 分钟
- API 限流：100 req/min/IP（登录 5 req/min/账号）
- 验证码：高频操作触发图形验证码 / 短信验证码
- 风控：异常 IP / 设备 / 时间模式实时拦截

### 5.4 文件上传

- 类型白名单：`jpg` `png` `gif` `pdf` `mp4`（按业务调整）
- 大小限制：图片 5MB、视频 500MB
- 文件名：UUID 重命名（防路径遍历）
- 内容扫描：阿里云内容安全 / 自定义病毒扫描

---

## 6. CI / CD 安全

### 6.1 流水线安全

- **不要**在 CI 日志中打印凭据
- 用 GitHub Secrets 注入敏感配置
- 构建产物加 SHA256 校验
- 部署前必须通过安全扫描（`security-audit` workflow）

### 6.2 部署安全

- 蓝绿部署 / 灰度发布
- 部署前自动回滚机制
- 生产部署需要两人审批
- 部署后 30 分钟内人工监控

---

## 7. 事件日志与审计

### 7.1 审计日志

记录所有：
- 登录 / 登出（成功 / 失败）
- 权限变更
- 数据导出
- 管理员操作
- 异常错误

存储位置：`1/server/logs/audit/`（加密 + 备份）

### 7.2 监控告警

- 异常登录（异地 / 高频失败）
- 敏感操作（数据导出 / 权限变更）
- 系统异常（5xx 错误率 > 1%）
- 数据库慢查询 > 3s

告警渠道：钉钉机器人 + 邮件 + 短信

---

## 8. 应急响应预案

### 8.1 安全事件分类

| 类型 | 描述 | 响应 |
|---|---|---|
| 凭据泄露 | 数据库密码、API Key 进入公网 | 立即修改 + 清理 git 历史 + 通知 |
| 数据泄露 | 用户数据被未授权访问 | 立即关停 + 取证 + 通知用户 + 报告监管 |
| 服务被攻击 | DDoS / 注入 / 越权 | 启动 WAF + 限流 + 取证 |
| 内部违规 | 员工滥用权限 | 立即冻结账号 + 内部调查 |

### 8.2 应急响应流程

1. **发现**（监控告警 / 用户投诉 / 内部报告）
2. **评估**（影响范围、严重程度、是否需要立即行动）
3. **遏制**（隔离受影响的系统 / 账号 / 服务）
4. **根除**（修复漏洞、删除恶意代码、修改凭据）
5. **恢复**（恢复服务、验证系统完整性）
6. **复盘**（事件报告、改进措施、文档更新）

### 8.3 联系方式

- 安全负责人：security-lead@zhs-platform.com
- 7×24 应急电话：+86 xxx-xxxx-xxxx
- 钉钉安全群：搜索"智汇安全应急"

---

## 9. 合规

### 9.1 国内法规

- **网络安全法**：等保 2.0 三级
- **数据安全法**：数据分类分级、风险评估
- **个人信息保护法**：最小必要、知情同意、删除权
- **关键信息基础设施安全保护条例**

### 9.2 行业标准

- ISO 27001（信息安全管理）
- ISO 27701（隐私管理）
- PCI DSS（如果涉及支付）
- SOC 2（如果涉及 B 端）

---

## 10. 培训与意识

### 10.1 新成员

- 入职培训包含安全规范
- 阅读本 `SECURITY.md` + `CONTRIBUTING.md`
- 完成 OWASP Top 10 在线课程
- 签署保密协议（NDA）

### 10.2 定期演练

- 每季度一次安全演练（钓鱼邮件、密码爆破模拟）
- 每年一次红蓝对抗（外部安全团队）
- 重要变更后做安全评审

---

## 附录 A：已处理的泄露事件

### 事件 1：code/edu 数据库凭据泄露
- **时间**：2026-06-17
- **范围**：`code/edu/scripts/fix_db.js` `fix_name.js` `init_lesson_data.js`
- **凭据**：数据库 `47.94.40.108:3306/cloud_learning_content` 账号 `Raindrop_L` 密码 `Raindrop_L250604`
- **处理**：
  1. 三个文件已删除
  2. 1/client/.gitignore + code/edu/.gitignore 已加 `fix_*.js` 规则防再发
  3. **建议**：修改该数据库密码（用户执行）
- **状态**：清理完成，待用户改密码

---

**维护**：本文件由安全负责人 + 项目团队共同维护。修改前请在 `1/docs/` 提交 PR 并通知安全负责人。
