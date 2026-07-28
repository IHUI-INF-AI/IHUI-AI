# 企业版 Demo 环境搭建

> **适用**:销售演示 / POC(Proof of Concept,概念验证)验证 / 客户试用
> **目标**:5 分钟内启动一套完整可用的 Demo 环境
> **最后更新**:2026-07-28

本指南提供基于 Docker Compose 的**一键 Demo 环境**搭建方式,包含 API 服务、Web 前端、AI 推理服务、PostgreSQL、Redis 五大组件,并预置 1 个管理员账号 + 5 个测试用户,可立即体验企业版全部核心功能。

---

## 一、环境要求

### 1.1 最低配置

| 资源 | 最低 | 推荐 |
|------|------|------|
| CPU | 4 核 | 8 核 |
| 内存 | 8 GB | 16 GB |
| 磁盘 | 20 GB SSD | 50 GB SSD |
| 网络 | 100 Mbps | 1 Gbps |
| 操作系统 | Linux / macOS / Windows 10+ | Linux(Ubuntu 22.04 LTS) |

### 1.2 软件依赖

- **Docker**:24.0+(含 Docker Compose v2)
- **Git**:2.30+
- **curl**:7.x+
- **openssl**:1.1+ (生成自签证书)
- **jq**:1.6+ (解析 JSON,可选)

```bash
# 检查环境
docker --version
docker compose version
git --version
```

---

## 二、一键启动

### 2.1 方式 A:使用项目提供的脚本(推荐)

```bash
# 1. 克隆项目
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI

# 2. 切换到 demo 模式配置
cp .env.demo .env

# 3. 一键启动(Demo 模式,使用 Mock LLM 节省 token)
./scripts/setup-enterprise-demo.sh
```

脚本执行流程:

1. ✅ 环境自检(Docker / Compose / 端口可用性)
2. ✅ 生成自签证书与 JWT 密钥
3. ✅ 拉取 Docker 镜像(国内用户自动切换阿里云镜像)
4. ✅ 启动 PostgreSQL + Redis + API + Web + AI-Service
5. ✅ 等待健康检查通过(最多 120s)
6. ✅ 自动播种 Demo 数据(管理员 + 5 测试用户 + 10 智能体模板)
7. ✅ 打印访问入口 + 默认账号

### 2.2 方式 B:手动启动

```bash
# 1. 准备环境变量
cat > .env <<'EOF'
POSTGRES_USER=ihui
POSTGRES_PASSWORD=demo_pass_2026
POSTGRES_DB=ihui_demo
REDIS_PASSWORD=demo_redis_2026
JWT_SECRET=demo_jwt_secret_32_chars_random
NODE_ENV=demo
LLM_PROVIDER=mock
EOF

# 2. 启动所有服务
docker compose -f docker-compose.demo.yml up -d

# 3. 等待就绪
docker compose -f docker-compose.demo.yml ps
# 全部显示 healthy 后继续

# 4. 初始化数据库 + 种子数据
docker compose -f docker-compose.demo.yml exec api \
  pnpm db:migrate && pnpm db:seed:demo
```

---

## 三、访问入口

服务启动后,可通过以下地址访问:

| 服务 | 地址 | 说明 |
|------|------|------|
| **Web 前端** | <http://localhost:8801> | 主入口(用户/管理员共用) |
| **API 服务** | <http://localhost:8802/docs> | Swagger API 文档(OpenAPI 3.0) |
| **AI Service** | <http://localhost:8803/docs> | FastAPI 自动文档 |
| **Grafana 监控** | <http://localhost:8816> | 监控仪表盘(admin / admin) |
| **PostgreSQL** | `localhost:5432` | 仅本机访问 |
| **Redis** | `localhost:6379` | 仅本机访问 |

> 端口定义详见 [docs/port-management.md](../../docs/port-management.md)

---

## 四、默认账号

### 4.1 管理员账号

```
邮箱:admin@demo.ihui-ai.com
密码:Demo@2026
角色:Super Admin
权限:全部功能 + 用户管理 + 系统配置
```

### 4.2 测试用户(5 个)

| 邮箱 | 密码 | 角色 | 用途 |
|------|------|------|------|
| `alice@demo.ihui-ai.com` | `Demo@2026` | 创作者 | 演示智能体创建 |
| `bob@demo.ihui-ai.com` | `Demo@2026` | 消费者 | 演示订阅与使用 |
| `carol@demo.ihui-ai.com` | `Demo@2026` | 部门管理员 | 演示 RBAC 权限 |
| `david@demo.ihui-ai.com` | `Demo@2026` | 审计员 | 演示审计日志 |
| `eve@demo.ihui-ai.com` | `Demo@2026` | 财务 | 演示订单/账单 |

### 4.3 预置数据

- **10 个智能体模板**:覆盖客服 / 编程 / 文案 / 数据分析 / 教育等场景
- **5 段示例对话**:每个智能体预填 1 段对话
- **3 个工作空间**:默认 / 市场部 / 研发部
- **1 套 RBAC 角色树**:Admin / Manager / Editor / Viewer / Guest

---

## 五、Demo 演示路径(销售场景)

### 5.1 标准演示(30 分钟)

1. **登录 + 多端体验**(3 分钟)
   - 用 `admin@demo.ihui-ai.com` 登录
   - 切换中/英/日/韩/繁中 5 语言
   - 演示 Web / API 两种访问方式

2. **智能体创建**(5 分钟)
   - 进入"创作者工作台"
   - 拖拽式创建一个"客服智能体"
   - 配置 LLM(用 Mock 模式节省 token)
   - 沙箱测试 + 上架

3. **多租户 + 权限**(5 分钟)
   - 创建"市场部"工作空间
   - 邀请 `carol@demo.ihui-ai.com` 为部门管理员
   - 演示细粒度 RBAC(只读 / 编辑 / 管理员)

4. **审计 + 监控**(5 分钟)
   - 切换到 `david@demo.ihui-ai.com`(审计员)
   - 查看 90 天审计日志(操作 / 登录 / 数据变更)
   - 切换到 Grafana 查看 QPS / 延迟 / 错误率

5. **私有部署 / 国产化**(7 分钟)
   - 演示一键部署脚本 `./scripts/setup-enterprise-demo.sh --deploy k8s`
   - 展示信创适配清单(鲲鹏 / 麒麟 / 达梦 / 东方通)

6. **Q&A + 报价单**(5 分钟)
   - 引导到 [pricing-quote.md](./pricing-quote.md)
   - 介绍 5/10/30/50 万 4 档套餐

### 5.2 深度技术演示(2 小时,针对技术客户)

在标准演示基础上增加:

- 7. **API 集成**(15 分钟):OpenAI 兼容 API + Webhook + 流式响应(SSE)
- 8. **私有 LLM 接入**(15 分钟):演示对接企业内部 LLM(vLLM / Ollama / TGI)
- 9. **数据隔离**(10 分钟):演示多租户数据物理隔离 + 跨租户访问拦截
- 10. **高可用演练**(15 分钟):手动 kill 主节点,观察自动切换(< 30s)
- 11. **灾备演练**(15 分钟):删除主库,观察从库接管 + 数据完整性校验
- 12. **性能压测**(20 分钟):用 Locust 模拟 1000 并发,展示 QPS / 延迟 / 错误率

### 5.3 商务演示(15 分钟,针对决策层)

- 1. 5 分钟:产品总览(参考 [whitepaper.md](./whitepaper.md))
- 2. 5 分钟:案例分享(政府 / 金融 / 制造业 3 个标杆)
- 3. 5 分钟:商务条款 + 报价(参考 [pricing-quote.md](./pricing-quote.md) + [sla-terms.md](./sla-terms.md))

---

## 六、常见问题

### 6.1 启动失败

| 现象 | 排查方法 |
|------|----------|
| 端口被占用 | `lsof -i:8801` 查看占用进程;`./scripts/setup-enterprise-demo.sh --clean` 后重试 |
| 镜像拉取慢 | 脚本自动切换阿里云镜像;若仍慢,手动 `docker pull registry.cn-hangzhou.aliyuncs.com/ihui/api:demo` |
| 内存不足 | Docker Desktop → Settings → Resources → Memory ≥ 8GB |
| 数据库连接失败 | `docker compose logs postgres` 查看;常见为磁盘满或密码错误 |

### 6.2 演示过程问题

| 现象 | 解决方案 |
|------|----------|
| LLM 调用慢 / 失败 | 切换 `LLM_PROVIDER=mock`(脚本默认),不依赖外部网络 |
| 中文乱码 | 浏览器设置 UTF-8;或访问 <http://localhost:8801/zh-CN> |
| 登录失败 | 检查是否修改了默认密码;重置见 §7.2 |
| 数据丢失 | 容器重启会导致数据丢失(演示环境),用 `./scripts/setup-enterprise-demo.sh --reset` 恢复 |

### 6.3 清理环境

```bash
# 停止 + 清理容器(保留镜像)
./scripts/setup-enterprise-demo.sh --clean

# 彻底清理(含数据卷)
./scripts/setup-enterprise-demo.sh --purge
```

---

## 七、运维操作

### 7.1 查看日志

```bash
# 实时查看所有服务日志
docker compose -f docker-compose.demo.yml logs -f

# 仅查看 API
docker compose -f docker-compose.demo.yml logs -f api

# 最近 100 行
docker compose -f docker-compose.demo.yml logs --tail=100 api
```

### 7.2 重置数据

```bash
# 重置数据库 + 重新初始化
./scripts/setup-enterprise-demo.sh --reset

# 重置单个用户密码
docker compose -f docker-compose.demo.yml exec api \
  pnpm admin:reset-password --email=admin@demo.ihui-ai.com --password=NewPass@2026
```

### 7.3 备份

```bash
# 备份整个 Demo 环境
./scripts/setup-enterprise-demo.sh --backup

# 备份文件位置
ls -lh .trae-cn/tmp/enterprise-demo/backup-*.tar.gz
```

### 7.4 切换到生产模式

```bash
# 1. 停止 Demo
./scripts/setup-enterprise-demo.sh --stop

# 2. 配置生产环境变量
cp .env.production.example .env
vim .env  # 填入真实 LLM API Key、数据库密码等

# 3. 启动生产模式
docker compose -f docker-compose.yml up -d
```

---

## 八、升级与维护

### 8.1 版本升级

```bash
# 1. 拉取最新镜像
docker compose -f docker-compose.demo.yml pull

# 2. 重启
docker compose -f docker-compose.demo.yml up -d

# 3. 数据库迁移
docker compose -f docker-compose.demo.yml exec api pnpm db:migrate
```

### 8.2 镜像版本固定

生产环境强烈建议**固定镜像版本**,避免 latest 标签导致不可预期升级:

```yaml
# docker-compose.demo.yml
services:
  api:
    image: registry.cn-hangzhou.aliyuncs.com/ihui/api:1.0.0  # 不要用 :latest
  web:
    image: registry.cn-hangzhou.aliyuncs.com/ihui/web:1.0.0
  ai-service:
    image: registry.cn-hangzhou.aliyuncs.com/ihui/ai-service:1.0.0
```

---

## 九、安全提醒

> ⚠️ **演示环境仅用于产品演示与 POC 验证,严禁用于生产业务!**

- 默认密码(`Demo@2026`)是公开知识,任何人都能登录
- 数据库 / Redis 监听 0.0.0.0,公网可访问
- LLM 使用 Mock 模式,真实数据不会被发送到外部
- **生产部署请参考** [deployment-guide.md](./deployment-guide.md)

---

## 十、相关文档

- [README.md](./README.md)— 企业文档总目录
- [deployment-guide.md](./deployment-guide.md)— 三模式部署详解
- [feature-comparison.md](./feature-comparison.md)— 社区版 vs 企业版
- [pricing-quote.md](./pricing-quote.md)— 商务报价
- [sla-terms.md](./sla-terms.md)— 服务等级协议
- [whitepaper.md](./whitepaper.md)— 白皮书
- [ai-community-intro.md](./ai-community-intro.md)— AI 社区介绍
- [decision-maker-community.md](./decision-maker-community.md)— 决策者社群
- [human-ai-collaboration.md](./human-ai-collaboration.md)— 人机协作
