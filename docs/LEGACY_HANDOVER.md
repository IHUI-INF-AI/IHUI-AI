# 历史项目交接文档（脱敏版）

> **来源**: `H:\历史项目存档\ljd-交接文件\交接文档.docx`（16,568 字节，2026-03-09 编写）
> **处理**: 已提取原始文本内容，敏感凭证（密码/密钥/AppSecret）已脱敏为占位符，**实际值见** `docs/PRODUCTION_CREDENTIALS.md`（gitignored）
> **处理日期**: 2026-06-25

---

## 一、服务器连接配置（导入 Xshell）

> ⚠️ 原始 `服务器连接配置.xts` 是 Xshell 导出文件（11,931 字节，UTF-16 LE 编码），已通过二进制解析还原出以下信息：

### 1.1 服务器 1 - 接口服务器
- **公网 IP**: `82.157.209.97`
- **内网 IP**: `172.21.0.9`
- **配置**: 4核8G / SSD 50G / 20Mbps
- **系统**: Ubuntu
- **密码**: `<S1_SUDO_PASSWORD>` （见加密文档）
- **部署目录**: `/ai_zhs/`
- **运行服务**:
  - `zhs_server` — 启动命令：`startServer` 中逐行复制粘贴
  - `manage` — 总管理端后台服务
  - `console` — 前端页面（无需启动）
  - `Minio` — 文件服务器
  - `Nacos` — 注册中心
  - `Nginx` — 反向代理
  - `Cert` — 域名证书目录

### 1.2 服务器 2 - 数据库服务器（内网）
- **内网 IP**: `172.21.0.15`
- **配置**: 2核4G / SSD 100G
- **MySQL**: `root` / `<S2_MYSQL_PASSWORD>`
- **Redis 密码**: `<S2_REDIS_PASSWORD>`

### 1.3 服务器 3 - 备份服务器（内网）
- **内网 IP**: `172.21.0.13`
- **配置**: 2核4G / SSD 100G
- **MySQL**: `root` / `<S3_MYSQL_PASSWORD>`

### 1.4 服务器 4 - 文件服务器
- **公网 IP**: `101.42.151.162`
- **内网 IP**: `172.21.0.6`
- **配置**: 2核4G / SSD 100G / 5Mbps
- **系统密码**: `<S4_SUDO_PASSWORD>`
- **Minio**: `admin` / `<S4_MINIO_PASSWORD>`
- **部署目录**: `/ai_zhs/cozeApi` — Python 服务，启动命令 `startPy` 中逐行复制

### 1.5 服务器 5 - 后台接口服务器
- **公网 IP**: `82.157.190.172`
- **内网 IP**: `172.21.0.12`
- **配置**: 4核16G / SSD 50G / 5Mbps
- **系统密码**: `<S5_SUDO_PASSWORD>`

---

## 二、当前公司服务器（最新部署）

> 与上方 5 台服务器（早期 172.21.0.x 段）不同，最新部署在阿里云 ECS。

### 2.1 阿里云 ECS
- **公司名**: AI 智汇社
- **账号**: `Ripple_Yu0124`
- **数据库公网**: `47.94.40.108:3306`
- **数据库私网**: `172.16.174.132`
- **数据库 root**: `<CURRENT_DB_ROOT_PASSWORD>`

### 2.2 数据库实例
- **主用户**: `Raindrop_L` / `<RAIN_DROP_PASSWORD>`（zhs_ai_project 库）
- **重部署后**: `root` / `<ROOT_AFTER_REDEPLOY>`

---

## 三、外部服务凭证（脱敏）

| 服务 | 用户/账号 | 密码/密钥 | 状态 |
|---|---|---|---|
| 飞书 Wiki | aizhihuishe.feishu.cn | `<FEISHU_WIKI_PASSWORD>` | 链接: https://aizhihuishe.feishu.cn/wiki/EAbHwRekyikyEPkzTi2cUgL9n4e |
| 阿里云 SMS | `Raindrop_L@aizhs.onaliyun.com` | `<ALIYUN_SMS_ACCESS_KEY>` | 详情见加密文档 |
| 腾讯云 | `cyuxiang2025@163.com` | `<TENCENT_PASSWORD>` | SecretId/Key 见加密文档 |
| 微信小程序 | AppID: `wx27028e276ffdbc5d` | `<WX_MINI_APP_SECRET>` | 商户号: `1714645682` |
| 微信开放平台 | `ok502319984@gmail.com` | `<WX_OPEN_PLATFORM_PASSWORD>` | 备: `1952490952@qq.com` |
| Apifox | `18643389808` | `<APIFOX_PASSWORD>` | - |
| Gitee | `18643389808` / `ok502319984@gmail.com` | `<GITEE_PASSWORD>` | 全更改为后者 |
| n8n 服务器 | `root` | `<N8N_SUDO_PASSWORD>` | n8n 账号: `zhangsan12` |
| 可灵 AI | `19944899487` | `<KLING_KEY_PAIR>` | Access Key / Secret Key |
| DeepSeek | - | `<DEEPSEEK_API_KEY>` | - |
| 百度云 | - | `<BAIDU_ACCESS_KEY_PAIR>` | - |
| 智普 GLM | - | `<ZHIPU_GLM_API_KEY>` | - |
| 豆包 (火山引擎) | - | `<DOUBAO_API_KEY>` | - |
| 即梦 (火山引擎) | - | `<DOUBAO_JM_KEY_PAIR>` | - |
| OpenRouter | - | `<OPENROUTER_API_KEY>` | - |
| DashScope (通义) | - | `<DASHSCOPE_API_KEY>` | - |
| Coze OAuth | - | `<COZE_PUBLIC_KEY_ID>` | 私钥见 `coze_zhs_py/coze_oauth_config.json` |
| 移动端名 | 智汇AGI | - | 5BC918198D0CEE405DF3355279BE3C16 |
| 支付宝绑定应用 ID | - | `2021005181618474` | ✅ 已整合 |
| 通用密码 | - | `Lcc0524..` / `Lcc940524` | 公司常用密码 |

---

## 四、MinIO 桶（生产）

| 桶名 | 用途 |
|---|---|
| `sys-resource` | 系统资源文件 |
| `sys-basks` | 后台资源 |
| `sys-mini` | 小程序资源文件 |

---

## 五、代码仓库地址

| 项目 | 仓库地址 | 备注 |
|---|---|---|
| uni-app 前台 | `https://github.com/AIZHS2025/AIzhs.git` | - |
| 后台 | `https://github.com/AIZHS2025/AIzhs.git` | - |
| Java 后端 | `https://gitee.com/gitee-liujiandong/AI_ZHS.git` | 已被 IHUI-AI Python 后端替代 |
| 后台管理 Vue | `https://gitee.com/mr___chang/ai-smart-society-vue.git` | 已被 `client/` 替代 |
| 后台管理 Java | `https://gitee.com/mr___chang/ai-smart-society-java.git` | 已被 `server/` 替代 |

---

## 六、社群与文档资源

| 资源 | 链接 | 提取码 |
|---|---|---|
| 飞书 Wiki 知识库 | https://aizhihuishe.feishu.cn/wiki/EAbHwRekyikyEPkzTi2cUgL9n4e | `<FEISHU_WIKI_PASSWORD>` |
| 社群独家工具资料大全库 | https://pan.quark.cn/s/29dc142f56ab | `PsTK` |
| PsTK 备用库 | https://pan.quark.cn/s/5b8e5af21ced | `SVU5` |
| Dify 部署 | https://pan.baidu.com/s/1sGhtbLOKFjVdlIbGY46_tA?pwd=AIZH | `AIZH` |
| 小程序设计 (墨刀) | https://mastergo.com/file/162030151178514 | - |
| 小程序设计 (Modao) | https://modao.cc/proto/TYOlGwJsuyflwMUoMBFiX | - |

---

## 七、API 接口文档

| 服务 | 文档位置 |
|---|---|
| ZHS Server Java | `H:\历史项目存档\ljd-交接文件\ZHS_Server_java\API接口文档.md` / `.txt` |
| coze_zhs_py | `H:\历史项目存档\ljd-交接文件\coze_zhs_py\openapi.json` / `openapi_latest.json` / `openapi_new.json` |
| Java 微服务 | `H:\历史项目存档\ljd-交接文件\service\api-docs/` |
| 23 微服务详细 | `H:\历史项目存档\ljd-交接文件\service_2\api-docs/` |

> 当前 IHUI-AI 已统一使用 FastAPI 自动生成 OpenAPI 文档（`/docs` / `/redoc`），不再需要历史 API 文档。

---

## 八、原始交接文档关键摘要

- **Java 微服务**: 23 个（ask, auth, behavior, circle, content, exam, gateway, learn, live, member, message, notification, order, oss, pay, point, resource, schedule, search, setting, usercenter, visit-tracking 等）
- **前端**: Vue 2/3 RuoYi 管理后台、uni-app 小程序、Vue3 H5
- **Python**: Coze 集成服务 `coze_zhs_py`
- **架构**: Spring Cloud + Nacos + Minio + MySQL + Redis
- **当前状态**: 全部业务已迁移至 IHUI-AI（Python FastAPI + Vue3 + Vite + Element Plus）

---

## 九、变更记录

| 日期 | 变更 | 操作人 |
|---|---|---|
| 2026-06-25 | 初始脱敏版本 | IHUI-AI Assistant |
