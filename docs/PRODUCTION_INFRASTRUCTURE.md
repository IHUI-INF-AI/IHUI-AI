# 生产基础设施清单（Production Infrastructure Inventory）

> **来源**: 整合自 `H:\历史项目存档\ljd-交接文件\交接文档.docx`、`coze_zhs_py\config.py`、各子项目 `.env.production` 文件
> **更新日期**: 2026-06-25
> **状态**: 已整合至 IHUI-AI，原始存档仅作只读参考

---

## 一、生产服务器清单（5 台）

| ID | 角色 | 公网 IP | 内网 IP | 配置 | 带宽 | 用途 |
|---|---|---|---|---|---|---|
| S1 | 接口服务器 | 82.157.209.97 | 172.21.0.9 | 4核8G / SSD 50G | 20Mbps | zhs_server, manage, console, Minio, Nacos, Nginx |
| S2 | 数据库服务器 | - | 172.21.0.15 | 2核4G / SSD 100G | - | MySQL, Redis |
| S3 | 备份服务器 | - | 172.21.0.13 | 2核4G / SSD 100G | - | MySQL Backup |
| S4 | 文件服务器 | 101.42.151.162 | 172.21.0.6 | 2核4G / SSD 100G | 5Mbps | Minio / `/ai_zhs/cozeApi` Python 服务 |
| S5 | 后台接口服务器 | 82.157.190.172 | 172.21.0.12 | 4核16G / SSD 50G | 5Mbps | 后台管理 API |

> ⚠️ 上述 IP 段（172.21.0.x、82.157.x.x、101.42.x.x）已不再使用，最新部署在阿里云 ECS（参考下方「公司服务器」）

---

## 二、生产域名清单（4 个核心域名）

| 域名 | 协议 | 用途 | 对应 IHUI-AI 模块 |
|---|---|---|---|
| `kou.aizhs.top` | HTTPS | 客服/前端主入口 | `client/` 前端 |
| `bsm.aizhs.top` | HTTPS | 后台管理 API（/prod-api 前缀） | `server/app/api/v1/` 旧 RuoYi 兼容 |
| `zca.aizhs.top` | HTTPS/WSS | 智能体 API + Coze WebSocket | `server/app/api/v1/llm/` + WebSocket |
| `47.94.40.108:3306` | MySQL | 公司生产数据库（公网） | `server/app/database.py` |

### 域名 - 模块映射（已迁移至 IHUI-AI）

| 原始路径前缀 | 当前 IHUI-AI 路径 | 状态 |
|---|---|---|
| `/prod-api/ai` | `server/app/api/v1/edu/`, `ai/*` | ✅ 已迁移 |
| `/prod-api` | `server/app/api/v1/router.py` | ✅ 已迁移 |
| `/ai-program` | `server/app/api/v1/llm/` | ✅ 已迁移 |
| `wss://zca.aizhs.top/cozeZhsApi` | `server/app/api/v1/llm/ws.py` | ✅ 已迁移 |
| `/cozeApi` (Python) | `server/app/api/v1/coze/` + `coze_zhs_py/` 整合 | ✅ 已迁移 |

---

## 三、MinIO 存储桶（生产环境）

| 桶名 | 用途 |
|---|---|
| `sys-resource` | 系统资源文件 |
| `sys-basks` | 后台资源 |
| `sys-mini` | 小程序资源文件 |

> 当前 IHUI-AI 使用 `server/app/utils/storage.py` 统一管理，建议参照历史命名规范保留以上桶名。

---

## 四、启动目录结构（生产环境）

```
/ai_zhs/                        # 项目根目录
├── zhs_server                  # zhs_server 服务（已整合至 server/）
├── manage                       # 总管理端后台服务（已整合至 server/）
├── console                      # 前端页面（已整合至 client/）
├── Minio                        # 文件服务器
├── Cert                         # 域名证书
├── Nacos                        # 注册中心
├── Nginx                        # 代理
└── cozeApi                      # Python 服务（已整合至 server/app/api/v1/coze/）
```

---

## 五、外部服务清单

### 5.1 阿里云
- **ESC 控制台**: `AI智汇社 / Ripple_Yu0124`
- **SMS 服务**: AccessKey ID/Secret 已记录在加密文档
- **应用名**: aizhs.onaliyun.com

### 5.2 腾讯云
- **账号**: `cyuxiang2025@163.com`
- **SecretId / SecretKey**: 见加密文档

### 5.3 微信生态
- **小程序 AppID**: `wx27028e276ffdbc5d` ✅ 已整合至 `client/miniapp/`
- **微信支付商户号**: `1714645682` ✅ 已整合
- **APIv3 Key**: 见加密文档
- **微信开放平台**: `1952490952@qq.com`

### 5.4 支付宝
- **应用 ID**: `2021005181618474` ✅ 已整合

### 5.5 百度云
- **AccessKey/Secret**: 见加密文档

### 5.6 AI 模型服务
- **Coze (中国区)**: `https://api.coze.cn` ✅ 已整合
- **Coze OAuth Public Key ID**: 已记录在加密文档
- **可灵 AI**: 见加密文档
- **DeepSeek**: 见加密文档
- **智普 GLM**: 见加密文档
- **豆包 (火山引擎)**: 见加密文档
- **即梦 (火山引擎)**: 见加密文档
- **DashScope (阿里云通义)**: 见加密文档
- **OpenRouter**: 见加密文档
- **Luyala**: 见加密文档
- **腾讯混元 3D**: ✅ 已整合至 `client/src/api/ai-team.ts`

### 5.7 数据库
- **公司生产库**: `47.94.40.108:3306`（公网）/ `172.16.174.132:3306`（私网）
- **用户名/密码**: 见加密文档
- **Redis**: 见加密文档

### 5.8 飞书
- **公司飞书**: `aizhihuishe.feishu.cn`
- **企业微信 Token/AESKey**: 见加密文档

---

## 六、生产证书清单（已迁移至 .gitignore）

### 6.1 证书类型与位置

| 证书类型 | 配置文件路径 | 文件名 | 当前本地位置 | 状态 |
|---|---|---|---|---|
| **微信支付商户私钥** | `WX_PAY_PRIVATE_KEY_PATH` | `zhsLogin_private.pem` | `ssl/zhsLogin_private.pem` | ✅ 已 ignore |
| **微信支付平台证书** | `WX_PAY_PLATFORM_CERT_PATH` | `wxpay_cert.pem` | `ssl/wxpay_cert.pem` | ✅ 已 ignore |
| **支付宝应用私钥** | `ALIPAY_PRIVATE_KEY_PATH` | `appSecretRSA2048.txt` | `ssl/appSecretRSA2048.txt` | ✅ 已 ignore |
| **支付宝公钥** | `ALIPAY_PUBLIC_KEY_PATH` | `alipayPublicKey_RSA2.txt` | `ssl/alipayPublicKey_RSA2.txt` | ✅ 已 ignore |
| **JKS 证书 (Java Gateway)** | Java classpath 资源 | `program.aizhs.top.jks` | `ssl/program.aizhs.top.jks` | ✅ 已 ignore |
| **JKS 证书 (Auth Service)** | Java classpath 资源 | `jwt.jks` | `backup/certs/jwt.jks` | ✅ 已 ignore |
| **SSL 全链** | Nginx | `fullchain.pem` | `ssl/fullchain.pem` | ✅ 已 ignore |
| **SSL 私钥** | Nginx | `privkey.pem` | `ssl/privkey.pem` | ✅ 已 ignore |
| **本地 CA** | 开发环境 | `ca.crt`/`ca.key` | `server/certs/ca.crt`、`ca.key` | ✅ 已 ignore |
| **Coze RSA 私钥** | `COZE_PRIVATE_KEY` (env) | - | (从 env 字符串读取) | ✅ 不落盘 |

### 6.2 生产服务器 `/ai_zhs/cert/` 目录

```
/ai_zhs/cert/
├── zhsLogin_private.pem      # 微信支付商户私钥 (RSA 2048)
├── wxpay_cert.pem            # 微信支付平台证书
├── appSecretRSA2048.txt      # 支付宝应用私钥 (RSA2)
└── alipayPublicKey_RSA2.txt  # 支付宝公钥
```

> 部署时这 4 个文件必须手动从安全渠道部署到生产服务器，**严禁**通过 git 或任何代码仓库分发。

### 6.3 .gitignore 保护规则（已加固 2026-06-25）

```gitignore
# 证书文件(全部已 ignore)
*.pem      *.key     *.p12     *.jks
*.crt      *.cer     *.pfx     *.keystore
*.truststore
*_private.pem  *_privkey.pem
zhsLogin_private.*   wxpay_cert.*   appSecretRSA.*   alipayPublicKey_*
# SSH/PGP
id_rsa   id_dsa   id_ecdsa   id_ed25519   *.gpg   *.asc
# 整体目录(已 ignore)
ssl/      server/certs/      backup/      storage/
```

**验证结果** (2026-06-25):
- `backup/certs/jwt.jks` → ignored by `.gitignore:171:backup`
- `server/certs/ca.crt`/`ca.key` → ignored by `server/.gitignore:89:certs/`
- `ssl/fullchain.pem`/`privkey.pem`/`program.aizhs.top.jks` → ignored by `.gitignore:222:ssl`
- 微信/支付宝私钥文件名模式 → ignored by 显式规则
- **0 证书文件会被 git 追踪**

### 6.4 阿里云 / 微信支付控制台颁发的证书

| 来源 | 用途 | 存储位置 | 备份建议 |
|---|---|---|---|
| 阿里云 SSL 证书 (`*.aizhs.top`) | Nginx HTTPS | `ssl/fullchain.pem` + `ssl/privkey.pem` | 1Password/Keystore |
| 微信支付商户 API 证书 | 微信支付回调验签 | `ssl/wxpay_cert.pem` | 微信支付商户平台可重新下载 |
| 微信支付商户私钥 | 微信支付签名 | `/ai_zhs/cert/zhsLogin_private.pem` | 微信支付商户平台可重新生成 |
| 支付宝应用公钥 | 支付宝回调验签 | `/ai_zhs/cert/alipayPublicKey_RSA2.txt` | 支付宝开放平台可下载 |
| 支付宝应用私钥 | 支付宝签名 | `/ai_zhs/cert/appSecretRSA2048.txt` | ⚠️ 支付宝私钥**不可重生成**，需永久备份 |

> ⚠️ **关键提醒**: 支付宝应用私钥一旦丢失, 整个支付宝应用需要重新创建, 历史交易无法解密。请务必离线备份 (如 U 盘 + 1Password)。

---

## 七、部署相关脚本（已废弃/已整合）

历史项目中的部署脚本：
- `startServer` (zhs_server 启动)
- `startMinio` (Minio 启动)
- `startPy` (Python Coze 服务启动)
- `compile.bat`, `compile_all.bat`, `package_all.bat` (Java 打包)

> 上述脚本已被 IHUI-AI 替代：
> - 后端启动: `python server/run_dev.py` 或 `bash deploy.sh`
> - 前端启动: `npm run dev` (client)
> - 部署: 根目录 `deploy.sh` + `Dockerfile.server` / `Dockerfile.client`

---

## 七、本文档变更记录

| 日期 | 变更 | 操作人 |
|---|---|---|
| 2026-06-25 | 初始版本（从 H:\历史项目存档 整合） | IHUI-AI Assistant |

---

**关联文档**:
- `docs/LEGACY_HANDOVER.md` — 原始交接文档内容（脱敏版）
- `docs/PRODUCTION_CREDENTIALS.md` — 生产环境凭证（gitignored，已加密）
- `docs/LEGACY_JAVA_SERVICES.md` — 23 个 Java 微服务功能对照表
