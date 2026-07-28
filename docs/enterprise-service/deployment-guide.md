# IHUI-AI 企业版部署指南

> 本文档覆盖 IHUI-AI 企业版三种部署模式:**私有云**、**公有云**、**混合云**。
> 适用版本:Enterprise / Custom 档位(Starter / Business 默认 SaaS 公有云,由官方托管)。
> 端口规划遵循 [docs/port-management.md](../port-management.md) 88xx 段注册表。

## 目录

- [通用架构组件](#通用架构组件)
- [模式一:私有云部署(K8s + Helm)](#模式一私有云部署k8s--helm)
- [模式二:公有云部署(ACK / EKS + Docker Compose)](#模式二公有云部署ack--eks--docker-compose)
- [模式三:混合云部署(核心私有 + 弹性公有)](#模式三混合云部署核心私有--弹性公有)
- [通用运维:备份恢复](#通用运维备份恢复)
- [通用运维:监控告警](#通用运维监控告警)
- [通用运维:升级流程](#通用运维升级流程)

---

## 通用架构组件

IHUI-AI 是 TS Monorepo(pnpm workspace + Turborepo)全栈 AI 平台,8 端清单:

| 组件 | 端 | 技术栈 | 容器内端口 | 宿主端口(88xx) |
|------|------|--------|-----------|------------------|
| Web | apps/web | Next.js 15 + React 19 + Tailwind 4 | 3000 | 8801 |
| API | apps/api | Fastify 5 + Drizzle ORM 0.38 | 8080 | 8802 |
| AI Service | apps/ai-service | FastAPI + LangGraph + LiteLLM | 8000 | 8803 |
| 小程序 H5 | apps/miniapp-taro | Taro 4 + React | 3001 | 8804 |
| Mobile | apps/mobile-rn | React Native + Metro | 8081 | 8805 |
| PostgreSQL | — | 16+ | 5432 | 8810 |
| Redis | — | 7+ | 6379 | 8811 |
| OTel Collector | — | gRPC 4317 / HTTP 4318 | 4317/4318 | 8812/8813 |
| Prometheus | — | 2.x | 9090 | 8815 |
| Grafana | — | 10.x | 3000 | 8816 |

**最小生产资源清单(单节点)**:

| 角色 | CPU | 内存 | 磁盘 | 说明 |
|------|-----|------|------|------|
| 应用节点(Web+API+AI) | 8C | 16G | 100G SSD | 三服务同机部署最低门槛 |
| 数据库节点(PostgreSQL) | 4C | 8G | 200G SSD | 含 pgvector 扩展 |
| 缓存节点(Redis) | 2C | 4G | 20G SSD | 持久化开启 |
| 监控节点(可选) | 2C | 4G | 50G SSD | Prometheus + Grafana |

**推荐生产资源清单(高可用,3 副本)**:

| 角色 | 副本数 | CPU/副本 | 内存/副本 | 磁盘/副本 |
|------|--------|----------|----------|-----------|
| Web | 3 | 4C | 8G | 50G |
| API | 3 | 4C | 8G | 50G |
| AI Service | 3 | 8C | 16G | 100G(GPU 可选) |
| PostgreSQL(主从) | 1主2从 | 8C | 16G | 500G |
| Redis(哨兵) | 3 | 2C | 8G | 50G |

---

## 模式一:私有云部署(K8s + Helm)

### 1.1 适用场景

- 金融 / 政府 / 医疗等强合规行业,数据不出内网
- Custom 档位(源码交付,完全自主可控)
- 客户已有 K8s 集群(1.28+)

### 1.2 架构图

```mermaid
graph TB
    subgraph 客户内网 K8s 集群
        ING[Ingress Nginx<br/>TLS 终止]
        subgraph 应用命名空间 ihui-app
            WEB[Web Deployment<br/>3 副本]
            API[API Deployment<br/>3 副本]
            AI[AI Service Deployment<br/>3 副本]
        end
        subgraph 数据命名空间 ihui-data
            PG[(PostgreSQL StatefulSet<br/>主从 1主2从)]
            RD[(Redis StatefulSet<br/>哨兵 3 节点)]
        end
        subgraph 监控命名空间 ihui-monitor
            PROM[Prometheus]
            GRAF[Grafana]
            LOKI[Loki]
        end
        ING --> WEB
        ING --> API
        ING --> AI
        API --> PG
        API --> RD
        AI --> RD
        AI --> PG
        PROM --> WEB
        PROM --> API
        PROM --> AI
        PROM --> PG
    end
    USER[最终用户] -->|https://ihui.客户域名| ING
```

### 1.3 前置条件

1. K8s 集群 ≥ 1.28,已安装 `ingress-nginx`、`cert-manager`(可选,用于自动 TLS)
2. 存储类(StorageClass)可提供 SSD(建议 `gp3` 或本地盘)
3. 节点总资源 ≥ 24C / 48G(最小)或 60C / 120G(高可用)
4. 私有镜像仓库(Harbor / Nexus / 阿云 ACR 个人版)
5. kubectl + helm 3 客户端工具

### 1.4 Helm Chart 占位(交付后由客户运维填充实际值)

```yaml
# values-private.yaml — 客户私有云配置模板(占位,实际值由客户运维填)
# 镜像:默认走官方公共镜像,Custom 客户可替换为自有仓库镜像
imageRegistry: "registry.客户内网/ihui"   # 占位,客户填私有仓库地址
imagePullSecrets:
  - name: ihui-registry-secret            # 客户预先创建 imagePullSecret

# 副本数(高可用建议 ≥3)
web:
  replicaCount: 3
  resources:
    requests: { cpu: "2", memory: "4Gi" }
    limits:   { cpu: "4", memory: "8Gi" }
api:
  replicaCount: 3
  resources:
    requests: { cpu: "2", memory: "4Gi" }
    limits:   { cpu: "4", memory: "8Gi" }
aiService:
  replicaCount: 3
  resources:
    requests: { cpu: "4", memory: "8Gi" }
    limits:   { cpu: "8", memory: "16Gi" }

# 数据库(私有云建议用客户已有 PG,或部署 CrunchyData PGO operator)
postgres:
  enabled: true                            # true=随 Chart 部署;false=用外部 PG
  external:
    host: ""                               # 占位,外部 PG 时填
    port: 5432
    existingSecret: "ihui-pg-secret"       # 含 user/password/database key
  persistence:
    size: 500Gi
    storageClass: "ssd"

redis:
  enabled: true
  external:
    host: ""
  persistence:
    size: 50Gi

# Ingress(客户域名 + TLS)
ingress:
  enabled: true
  className: "nginx"
  host: "ihui.客户域名.com"                 # 占位
  tls:
    enabled: true
    secretName: "ihui-tls"                 # cert-manager 签发或客户预置

# 环境变量(从 Secret/ConfigMap 注入)
env:
  AI_PROVIDERS_SECRET: "ihui-ai-providers" # 各 AI 厂商 API Key Secret
  JWT_SECRET: "ihui-jwt-secret"
```

### 1.5 部署步骤

```bash
# 1. 添加 Helm 仓库(官方交付 Chart 包后,客户加载到私有仓库)
helm repo add ihui https://charts.aizhs.top
helm repo update

# 2. 创建命名空间
kubectl create namespace ihui-app
kubectl create namespace ihui-data
kubectl create namespace ihui-monitor

# 3. 预置 Secret(镜像拉取 / DB 密码 / AI 厂商 Key)
kubectl -n ihui-app create secret docker-registry ihui-registry-secret \
  --docker-server=registry.客户内网/ihui \
  --docker-username=占位 --docker-password=占位
kubectl -n ihui-data create secret generic ihui-pg-secret \
  --from-literal=user=ihui --from-literal=password=占位 --from-literal=database=ihui

# 4. 部署(用客户填好的 values-private.yaml)
helm install ihui ihui/ihui -n ihui-app -f values-private.yaml

# 5. 验证
kubectl -n ihui-app get pods -w          # 等待所有 Pod Running
kubectl -n ihui-app get ingress           # 获取 Ingress 地址
curl -k https://ihui.客户域名.com         # 健康检查
```

### 1.6 数据库与 Redis 配置

**PostgreSQL**(必须启用 pgvector 扩展用于知识库 RAG):

```sql
-- 客户 DBA 执行(IHUI-AI 依赖 pgvector)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 建库建用户(如未在 Secret 中预置)
CREATE USER ihui WITH PASSWORD '占位' ENCRYPTED;
CREATE DATABASE ihui OWNER ihui;
GRANT ALL PRIVILEGES ON DATABASE ihui TO ihui;
```

连接串配置(注入到 API/AI Service 的环境变量):

```
DATABASE_URL=postgresql://ihui:占位@pg.ihui-data.svc.cluster.local:5432/ihui?sslmode=require
REDIS_URL=redis://:占位@redis.ihui-data.svc.cluster.local:6379/0
```

**Redis**:开启 AOF 持久化(`appendonly yes`),`maxmemory-policy allkeys-lru`,容量建议 ≥4G。

### 1.7 端口规划(私有云)

私有云 Ingress 统一 443 入口,内部 Service 用 88xx 段(参见通用架构组件表),Pod 间用 ClusterIP 通信,仅 Ingress 对外暴露。

### 1.8 升级流程(私有云)

```bash
# 1. 备份(见下文"通用运维:备份恢复")
# 2. 拉取新版本镜像
helm repo update
helm pull ihui/ihui --version <新版本号>
# 3. 滚动升级
helm upgrade ihui ihui/ihui -n ihui-app -f values-private.yaml
# 4. 监控滚动状态
kubectl -n ihui-app rollout status deployment/ihui-web
kubectl -n ihui-app rollout status deployment/ihui-api
kubectl -n ihui-app rollout status deployment/ihui-ai-service
# 5. 回滚(如异常)
helm rollback ihui <上一版本号> -n ihui-app
```

### 1.9 安全加固

**网络策略(NetworkPolicy)**:默认拒绝全部,仅放行同命名空间 + Ingress 控制器:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ihui-default-deny
  namespace: ihui-app
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: ihui-app } }
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: ingress-nginx } }
  egress:
    - to:
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: ihui-data } }
    - to: [{ namespaceSelector: {} }]   # 放行出公网调 AI 厂商(建议加 NAT + 白名单)
      ports: [{ port: 443, protocol: TCP }]
```

**其他加固项**:

| 项目 | 推荐配置 |
|------|----------|
| Pod 安全标准 | enforced `restricted`(禁止 privileged / hostPath / root) |
| etcd 加密 | 开启 KMS provider,Secret at-rest 加密 |
| RBAC | 应用 ServiceAccount 最小权限,禁止绑定 cluster-admin |
| 镜像签名 | Cosign 签名校验,Kyverno 策略拒绝未签名镜像 |
| Secret 管理 | External Secrets Operator 对接 Vault / KMS,禁止明文 Secret 进 Git |
| 审计日志 | 开启 kube-apiserver audit log,留存 ≥180 天 |

### 1.10 故障排查

| 现象 | 排查步骤 | 常见根因 |
|------|----------|----------|
| Pod `CrashLoopBackOff` | `kubectl logs <pod> --previous` 看退出前日志 | DB 连接失败 / 配置缺失 / OOM |
| Pod `ImagePullBackOff` | `kubectl describe pod <pod>` 看 Events | 私有仓库认证失败 / 镜像 tag 拼错 |
| API 返回 502 | `kubectl -n ingress-nginx logs <controller>` | 后端 Pod 未就绪 / 健康检查失败 |
| API 返回 504 | 看 Ingress `proxy-read-timeout` 配置 | AI 厂商调用超时,需调大超时或加熔断 |
| DB 连接耗尽 | `kubectl exec pg -- psql -c "SELECT count(*) FROM pg_stat_activity;"` | 连接池配置过大 / 慢查询占连接 |
| 知识库检索慢 | `EXPLAIN ANALYZE` 向量查询;检查 pgvector 索引 | ivfflat 索引未建 / lists 参数不当 |

**诊断命令速查**:

```bash
kubectl -n ihui-app get events --sort-by='.lastTimestamp'   # 集群事件
kubectl -n ihui-app top pod                                  # 资源占用
kubectl -n ihui-app exec -it deploy/ihui-api -- sh           # 进容器
kubectl -n ihui-data exec pg -- psql -c "SELECT * FROM pg_stat_activity WHERE state='active';"
```

---

## 模式二:公有云部署(ACK / EKS + Docker Compose)

### 2.1 适用场景

- Business / Enterprise 档位,SaaS 公有云托管
- 创业团队 / 中型企业,无 K8s 运维能力
- 阿里云 ACK / AWS EKS / 腾讯云 TKE 任一容器服务

### 2.2 架构图

```mermaid
graph TB
    subgraph 公有云 阿里云 ACK / AWS EKS
        SLB[SLB / ALB 负载均衡<br/>HTTPS 443]
        subgraph 容器集群
            ING[Ingress]
            WEB[Web x3]
            API[API x3]
            AI[AI Service x3]
        end
        subgraph 托管数据服务
            RDS[(RDS PostgreSQL<br/>高可用版 + pgvector)]
            REDIS[(Tair / ElastiCache<br/>Redis 7)]
            OSS[(OSS / S3<br/>对象存储)]
        end
        subgraph 可观测
            SLS[SLS / CloudWatch<br/>日志]
            ARMS[ARMS / CloudWatch<br/>APM]
        end
        SLB --> ING
        ING --> WEB
        ING --> API
        ING --> AI
        API --> RDS
        API --> REDIS
        AI --> REDIS
        AI --> RDS
        WEB --> OSS
        API --> OSS
    end
    USER[最终用户] -->|https://app.aizhs.top| SLB
```

### 2.3 资源清单(ACK / EKS 节点池)

| 节点池 | 实例规格 | 数量 | 用途 |
|--------|----------|------|------|
| app-pool | 8C16G(ecs.g7.2xlarge / m6i.2xlarge) | 3 | Web + API + AI Service |
| data-pool | 4C8G | 1 | 自建 PG/Redis(测试用;生产用托管) |

**生产推荐**:数据库用托管 RDS(PostgreSQL 16 + pgvector 扩展),Redis 用 Tair / ElastiCache,对象存储用 OSS / S3,避免自建运维。

### 2.4 Docker Compose 一键起(单节点 / Demo / 小规模生产)

适合 ≤200 用户的 Business 档小规模部署或售前 Demo:

```yaml
# docker-compose.yml(项目根目录已提供,此处为说明)
# 完整文件见仓库根目录 docker-compose.yml
# 关键服务:
#   web:        镜像 ihui/web,        映射 8801:3000,  依赖 api
#   api:        镜像 ihui/api,        映射 8802:8080,  依赖 postgres redis
#   ai-service: 镜像 ihui/ai-service, 映射 8803:8000,  依赖 redis
#   postgres:   镜像 pgvector/pgvector:pg16, 映射 8810:5432, 数据卷持久化
#   redis:      镜像 redis:7-alpine,  映射 8811:6379,  AOF 持久化
```

启动命令:

```bash
# 1. 克隆代码 + 配置 .env
git clone https://github.com/ihui-ai/ihui-ai.git
cd ihui-ai
cp .env.example .env
# 编辑 .env:DATABASE_URL / REDIS_URL / AI 厂商 Key / JWT_SECRET

# 2. 启动所有服务
docker compose up -d

# 3. 初始化数据库(首次)
docker compose exec api pnpm db:migrate
docker compose exec api pnpm db:seed

# 4. 健康检查
curl http://localhost:8801            # Web
curl http://localhost:8802/health     # API
curl http://localhost:8803/health     # AI Service
```

### 2.5 ACK / EKS 部署步骤(生产)

```bash
# 1. 创建集群(以阿里云 ACK 为例)
aliyun cs POST /clusters --body '{...}'   # 或控制台创建,选 Kubernetes 1.28+

# 2. 配置 kubectl
aliyun cs GET /clusters/<cluster-id>/kubeconfig
# 写入 ~/.kube/config

# 3. 部署 Ingress Controller
helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace

# 4. 创建托管数据库
#    RDS PostgreSQL 16 + 申请 pgvector 扩展(工单或控制台开启)
#    Tair Redis 7 高可用版
#    OSS Bucket(存储用户上传 / 知识库文档)

# 5. 部署 IHUI-AI(用官方 Helm Chart)
helm repo add ihui https://charts.aizhs.top
helm install ihui ihui/ihui -n ihui-app --create-namespace \
  --set postgres.enabled=false \
  --set postgres.external.host=pgm-xxxx.pg.rds.aliyuncs.com \
  --set postgres.external.existingSecret=ihui-pg-secret \
  --set redis.enabled=false \
  --set redis.external.host=r-xxxx.redis.rds.aliyuncs.com \
  --set ingress.host=app.客户域名.com \
  --set ingress.className=nginx

# 6. 配置 SLB + 域名解析
#    ACK 自动创建 SLB,绑定 Ingress;域名 CNAME 到 SLB 公网 IP
```

### 2.6 数据库与 Redis 配置(托管版)

- **RDS PostgreSQL**:开通高可用版(主备),`pgvector` 扩展工单开启,连接串形如 `postgresql://user:pwd@pgm-xxxx.pg.rds.aliyuncs.com:5432/ihui`
- **Tair / ElastiCache Redis**:开通高可用版,开通密码认证,白名单加入 ACK 节点 VPC 网段
- **OSS / S3**:Bucket 设为私有,STS 临时凭证下发到 API,大文件直传

### 2.7 端口规划(公有云)

容器内端口不变(3000/8080/8000/5432/6379),对外仅 SLB 443(HTTPS);开发/调试场景用 88xx 段宿主映射(参见架构组件表),生产环境**禁止**直接暴露 88xx 端口到公网。

### 2.8 升级流程(公有云)

```bash
# 托管数据服务由云厂商负责,仅需升级应用
helm repo update
helm upgrade ihui ihui/ihui -n ihui-app -f values.yaml
kubectl -n ihui-app rollout status deployment/ihui-web
# 托管 RDS 升级通过云控制台(主备切换会有 <30s 闪断,建议低峰操作)
```

### 2.9 安全加固

**安全组最小放行**(以阿里云 ACK 为例):

| 方向 | 源/目的 | 端口 | 用途 |
|------|---------|------|------|
| 入 | 公网(限 IP) | 443 | SLB HTTPS |
| 入 | ACK VPC 网段 | 8810-8818 | 内部服务(仅 VPC) |
| 入 | ACK 节点 SG | 5432 | RDS(仅 ACK SG) |
| 入 | ACK 节点 SG | 6379 | Tair(仅 ACK SG) |
| 出 | 0.0.0.0/0 | 443 | 调 AI 厂商 / OSS |
| 出 | 0.0.0.0/0 | 80 | 镜像拉取 / apt |

**RAM / IAM 最小权限**:ACK 节点角色仅授予 `AliyunCSFullAccess` 的子集(ecs/slbalb/oss 只读 + 必要写);应用 ServiceAccount 用 STS 临时凭证访问 OSS,禁止长效 AccessKey。

**其他加固项**:

| 项目 | 推荐配置 |
|------|----------|
| RDS 网络隔离 | VPC 内网访问,禁止公网地址;白名单仅 ACK 节点 SG |
| Tair / ElastiCache | 开启密码 + AUTH,白名单仅 ACK 节点 SG |
| 密钥管理 | AI 厂商 Key / JWT Secret 存 KMS,通过 CSI Driver 挂载,不入镜像 |
| WAF | 接入云 WAF,启用 SQL 注入 / XSS / CC 防护规则 |
| DDoS | SLB 开启 DDoS 基础防护,高流量场景购买 DDoS 高防 IP |
| 日志审计 | SLS / CloudWatch 采集 ACK 审计日志,留存 ≥180 天 |
| 镜像安全 | ACR 开启镜像扫描(CVE),阻断高危漏洞镜像推送 |

### 2.10 故障排查

| 现象 | 排查步骤 | 常见根因 |
|------|----------|----------|
| SLB 502 | 控制台看 SLB 后端健康检查;`kubectl get pods` 看就绪 | 后端 Pod 未就绪 / 健康检查路径错 |
| SLB 504 | SLB 超时配置 + 后端 P99 延迟 | AI 调用慢,需调超时 + 加熔断 |
| RDS 连接数满 | RDS 控制台看 `active_connections`;`SHOW max_connections` | 连接池过大 / 慢 SQL 占连接 |
| RDS CPU 飙高 | 性能洞察看 TOP SQL | 缺索引 / 全表扫;加索引或优化查询 |
| Tair OOM | 控制台看内存使用率 + eviction | 大 Key / 慢命令;扩容或拆分 |
| AI 厂商 429 限流 | API 日志看 `X-RateLimit-*` 头 | 触发厂商限流;模型路由切换 / 退避重试 |
| OSS 上传 403 | STS 凭证过期 / 权限不足 | 重新签发 STS,检查 RAM Policy |

**日志查询**:

```bash
# 阿里云 SLS 查询 API 错误日志
aliyun sls get-logs --project=ihui --logstore=api \
  --query="status:500 and time > now()-1h" --line=100

# AWS CloudWatch
aws logs filter-log-events --log-group-name /ecs/ihui-api \
  --filter-pattern '"500"' --start-time $(date -d '1 hour ago' +%s)000
```

---

## 模式三:混合云部署(核心私有 + 弹性公有)

### 3.1 适用场景

- Enterprise 档位,核心数据(用户 / 知识库 / 审计日志)必须留在私有云
- 弹性算力(GPU 推理 / 大批量视频生成)用公有云按需付费
- 金融 / 大型集团,既有内网合规要求,又有弹性算力需求

### 3.2 架构图

```mermaid
graph TB
    subgraph 私有云 客户内网
        ING_P[Ingress]
        WEB_P[Web x3]
        API_P[API x3<br/>核心业务逻辑]
        PG_P[(PostgreSQL 主<br/>用户/知识库/审计)]
        RD_P[(Redis 主<br/>会话/限流)]
        OSS_P[(MinIO 对象存储<br/>知识库文档)]
    end
    subgraph 公有云 弹性算力区
        AI_PUB[AI Service xN<br/>GPU 弹性扩缩]
        OSS_PUB[(OSS 临时产物<br/>视频/图片)]
        Q[(消息队列<br/>RocketMQ / SQS)]
    end
    subgraph 专线 / VPN 网关
        GW[专线网关<br/>IPSec VPN<br/>双向 TLS mTLS]
    end
    USER -->|https://ihui.客户内网| ING_P
    ING_P --> WEB_P
    ING_P --> API_P
    API_P --> PG_P
    API_P --> RD_P
    API_P -->|只读副本/审计日志同步| PG_P
    API_P -->|异步任务下发| Q
    Q --> AI_PUB
    AI_PUB --> OSS_PUB
    AI_PUB -.->|只读 知识库向量| PG_P
    GW --- API_P
    GW --- AI_PUB
```

### 3.3 数据流向与隔离原则

| 数据类别 | 存储位置 | 是否可出内网 | 说明 |
|----------|----------|--------------|------|
| 用户身份 / 权限 | 私有云 PG 主库 | 否 | 强合规,绝不外泄 |
| 知识库向量 / 文档 | 私有云 PG + MinIO | 否(向量只读副本可下发) | RAG 检索在私有云完成 |
| 审计日志 | 私有云 PG | 否 | 合规审计要求留存内网 |
| 会话 / 缓存 | 私有云 Redis | 否 | — |
| AI 推理请求 | 公有云 AI Service | 是(仅 prompt,不含 PII) | 调用前脱敏 |
| AI 生成产物(图/视频) | 公有云 OSS(临时) | 是 | 7 天后自动清理,重要产物回传私有云 |

### 3.4 网络打通

1. **专线 / VPN**:客户内网 ↔ 公有云 VPC 建立专线(推荐阿里云高速通道 / AWS Direct Connect)或 IPSec VPN
2. **mTLS 双向认证**:跨云服务间调用强制 mTLS,证书由私有 CA 签发,90 天轮换
3. **安全组**:仅放行 88xx 段(应用)与 5432/6379(数据,限内网),公网入口仅 443
4. **NAT 网关**:公有云 AI Service 通过 NAT 出公网调 AI 厂商 API,不直接暴露公网 IP

### 3.5 弹性扩缩策略

```yaml
# 公有云 AI Service HPA(水平自动扩缩)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ihui-ai-service
  namespace: ihui-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ihui-ai-service
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 60 }
    - type: Resource
      resource:
        name: memory
        target: { type: Utilization, averageUtilization: 70 }
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300   # 缩容冷却 5 分钟,避免抖动
```

### 3.6 数据库与 Redis 配置(混合云)

- **私有云 PG 主库**:承载用户 / 知识库向量 / 审计日志
- **公有云 PG 只读副本**:通过逻辑复制(publication/subscription)从私有云同步知识库向量表(仅此表),供 AI Service 就近检索
- **Redis**:私有云主 + 公有云从(只读),通过 Redis 级联复制同步会话;公有云 AI Service 写操作通过专线回私有云主库

```sql
-- 私有云 PG 主库:为公有云副本创建逻辑复制
CREATE PUBLICATION ihui_pub FOR TABLE knowledge_vectors, knowledge_docs;
-- 公有云 PG:订阅
CREATE SUBSCRIPTION ihui_sub CONNECTION 'host=私有云PG port=5432 user=repl' PUBLICATION ihui_pub;
```

### 3.7 端口规划(混合云)

- 私有云:88xx 段(参见架构组件表),Ingress 443 对内网用户
- 公有云:AI Service 8803 仅内网(专线),通过 NAT 出公网调 AI 厂商
- 跨云:仅专线走 5432/6379/443,禁止跨云裸 88xx

### 3.8 升级流程(混合云)

1. **先升级私有云**(API / Web / PG 主库),验证业务正常
2. **再升级公有云 AI Service**(滚动升级,HPA 缩到 minReplicas 后逐批替换)
3. **验证跨云链路**:专线延迟 / 逻辑复制延迟 / mTLS 证书有效性
4. **回滚**:任一阶段异常,按"公有云 → 私有云"顺序回滚(先回滚弹性算力,再回滚核心)

### 3.9 安全加固

混合云的核心安全风险在**跨云链路**和**公有云算力区的数据边界**:

| 项目 | 推荐配置 |
|------|----------|
| 专线 / VPN 加密 | 专线物理隔离为佳;VPN 走 IPSec(ESP 加密),强制 PFS,禁用弱算法(DH group ≥14) |
| mTLS 双向认证 | 跨云服务调用强制 mTLS,私有 CA 签发,90 天轮换,证书过期告警 30 天前触发 |
| 传输加密 | 跨云所有流量 TLS 1.3;数据库逻辑复制 SSL;Redis 级联复制 TLS |
| 公有云数据最小化 | 公有云仅存脱敏 prompt + 临时产物,7 天自动清理;知识库向量表只读副本,不含原文 |
| 出口 NAT 白名单 | 公有云 AI Service 出公网仅放行 AI 厂商域名(出站防火墙 + DNS 过滤),禁止访问其他公网 |
| 私有云入口 | 私有云 Ingress 仅内网访问,禁止公网暴露;运维通过堡垒机 + 跳板机 |
| 密钥分离 | 私有云主库密码仅在私有云;公有云副本用只读专用账号,权限仅限同步的表 |

**证书轮换流程(mTLS)**:

```bash
# 1. 私有 CA 生成新证书(90 天有效)
openssl x509 -req -in ai-service.csr -CA ca.crt -CAkey ca.key -days 90 -out ai-service.new.crt

# 2. 滚动更新公有云 AI Service Secret
kubectl -n ihui-app create secret tls ihui-ai-mtls --cert=ai-service.new.crt --key=ai-service.key --dry-run=client -o yaml | kubectl apply -f -

# 3. 滚动重启(零停机)
kubectl -n ihui-app rollout restart deployment/ihui-ai-service

# 4. 旧证书 7 天后从信任链移除(观察期)
```

### 3.10 故障排查

| 现象 | 排查步骤 | 常见根因 |
|------|----------|----------|
| 专线中断 | 云控制台看专线状态;`ping` 对端网关 | 运营商故障 / 物理链路中断;切 VPN 降级 |
| 逻辑复制延迟高 | `SELECT * FROM pg_stat_subscription;` 看 `latest_end_lsn` 差距 | 网络带宽不足 / 大事务;扩带宽或拆分大事务 |
| mTLS 证书过期 | `openssl x509 -in cert.crt -noout -dates` | 证书未及时轮换;告警未生效 |
| 跨云调用超时 | API 日志看 `timeout` 堆栈;`traceroute` 专线 | 专线延迟突增 / 公有云 AI Service 负载高;触发 HPA 扩容 |
| 数据不一致 | 校验私有云主库与公有云副本的 `knowledge_vectors` 行数 + checksum | 逻辑复制断开 / DDL 未同步;重建订阅 |
| 弹性扩缩失效 | `kubectl get hpa` 看 `TARGETS`;看 CPU 实际值 | HPA 阈值不当 / metrics-server 异常 |
| 专线带宽打满 | 云监控看专线流量;`iftop` 看连接 | 大文件回传 / 逻辑复制大批量;错峰或扩带宽 |

**降级策略(专线中断时)**:

1. 自动切换至 IPSec VPN 备份链路(带宽降级,延迟升高)
2. 公有云 AI Service 启用本地缓存(只读副本 + 7 天内的 prompt 缓存)
3. 异步任务暂停下发(消息队列堆积,专线恢复后重放)
4. 通知客户运维,监控专线恢复

**数据一致性校验(每周执行)**:

```bash
# 私有云主库与公有云副本的向量表校验
# 私有云执行:
psql -c "SELECT count(*), md5(string_agg(id::text, '' ORDER BY id)) FROM knowledge_vectors;"
# 公有云副本执行同样 SQL,比对 count 与 md5;不一致则重建逻辑订阅
```

### 3.11 容量规划与成本优化

混合云的成本优势在于**按需弹性**,但需精细规划才不致反超纯私有云:

| 资源 | 容量基线 | 弹性策略 | 成本优化点 |
|------|----------|----------|------------|
| 公有云 AI Service | minReplicas=2(保底) | HPA 2→20,CPU 60% 触发 | 用 Spot/抢占式实例(成本 -60%),配合 `pod-disruption-budget` 保可用 |
| 公有云 GPU(视频/大模型) | 0(纯按需) | 队列触发,KEDA 按消息深度扩 0→N | 空闲自动缩 0,仅任务期间计费 |
| 专线带宽 | 保底 100Mbps | 按月评估,峰值超 70% 扩容 | 逻辑复制错峰(夜间批量);大文件走 OSS 而非专线 |
| 公有云 OSS | 按用量 | 7 天生命周期转低频,30 天归档 | 临时产物设 7 天自动删除;知识库原文留私有云 MinIO |
| 监控指标 | Prometheus 15 天 | 30 天后转 Loki 对象存储 | 采样精度从 15s 降到 60s(历史数据) |

**成本告警**:公有云账单日预算告警(日预算 × 1.5 触发),周环比涨幅 >30% 告警,月度出账单明细报表。

**典型成本模型**(参考,实际以云厂商定价为准):

```
私有云(固定):8C16G ×6 节点 + PG/Redis 主从 ≈ 自建硬件折旧 + 电 + 运维人月
公有云弹性(变动):
  - 算力:Spot 实例 ¥0.3/核时 × 平均日 50 核时 = ¥450/日
  - GPU:A10 Spot ¥1.2/时 × 平均日 20 时 = ¥24/日
  - 存储:OSS ¥0.12/GB/月 × 500GB = ¥60/月
  - 专线:100Mbps 独享 ¥3000/月
月度弹性成本约 ¥1.5 万(远低于全量 GPU 自建)
```

---

## 通用运维:备份恢复

### 备份策略

| 数据 | 备份方式 | 频率 | 保留 | 存储位置 |
|------|----------|------|------|----------|
| PostgreSQL | pg_basebackup 全量 + WAL 归档 | 全量每日 / WAL 实时 | 30 天 | 异地 OSS / 私有 NAS |
| Redis | RDB 快照 + AOF | 每 1h RDB / 实时 AOF | 7 天 | 本地持久化卷 |
| 对象存储(知识库文档) | 跨区域复制 / 版本控制 | 实时 | 90 天版本 | 异地 Bucket |
| 配置 / Secret | etcd 快照(K8s) | 每日 | 14 天 | 离线备份 |

### 恢复演练(每季度执行)

```bash
# PostgreSQL 时间点恢复(PITR)
pg_basebackup -D /tmp/restore -h 备份源 -U repl
# 应用 WAL 到目标时间点
recovery_target_time = '2026-07-27 10:00:00+08'

# Redis 恢复
docker compose exec redis redis-cli SHUTDOWN NOSAVE
cp /backup/dump.rdb /data/redis/dump.rdb
docker compose start redis

# 验证:启动应用,检查关键表 row count + 抽样数据
```

---

## 通用运维:监控告警

### 监控栈

- **指标**:Prometheus(8815)+ Grafana(8816),采集 Web/API/AI/PG/Redis 指标
- **链路**:OpenTelemetry Collector(8812/8813)+ Jaeger(8814)
- **日志**:Loki(8818)+ Promtail,聚合容器 stdout
- **告警**:Grafana Alerting / Alertmanager,通知到 飞书 / 钉钉 / 邮件

### 核心告警规则

| 指标 | 阈值 | 持续 | 级别 |
|------|------|------|------|
| API 5xx 错误率 | >1% | 2min | P1 |
| API P99 延迟 | >2s | 5min | P2 |
| PG 连接数使用率 | >80% | 5min | P1 |
| PG 复制延迟(从库) | >10s | 3min | P2 |
| Redis 内存使用率 | >90% | 3min | P1 |
| 磁盘使用率 | >85% | 10min | P2 |
| Pod 重启次数 | >3 次/10min | — | P1 |
| AI Service 排队任务 | >100 | 5min | P2(混合云触发扩缩) |

---

## 通用运维:升级流程

### 升级前检查清单

- [ ] 阅读版本 Release Notes( BREAKING CHANGE / DB Migration)
- [ ] 在 staging 环境完整跑一遍升级 + 回归测试
- [ ] 确认数据库 migration 脚本可前向兼容(支持新老版本并行)
- [ ] 备份当前数据库 + 配置(见上文)
- [ ] 通知客户窗口期(建议低峰 02:00-04:00,与 SLA 维护窗口一致)

### 升级步骤(K8s / Helm)

```bash
# 1. 拉取新 Chart
helm repo update
helm pull ihui/ihui --version <新版本>

# 2. diff 配置(确认 values 变更)
helm diff upgrade ihui ihui/ihui -n ihui-app -f values.yaml

# 3. 执行升级(滚动,无停机)
helm upgrade ihui ihui/ihui -n ihui-app -f values.yaml

# 4. 等待滚动完成
kubectl -n ihui-app rollout status deployment/ihui-web
kubectl -n ihui-app rollout status deployment/ihui-api
kubectl -n ihui-app rollout status deployment/ihui-ai-service

# 5. 数据库 migration(如需,通常随 Pod 启动自动执行)
kubectl -n ihui-app logs job/ihui-migrate

# 6. 烟雾测试
curl https://ihui.客户域名/api/health
```

### 回滚

```bash
helm rollback ihui <上一版本> -n ihui-app
# 数据库 migration 不可逆时,从备份恢复(每季度演练)
```

---

## 联系方式

部署问题请联系:**sales@aizhs.top**(商务)/ 客户专属技术支持群(Enterprise / Custom 档位)。
SLA 与故障响应时效详见 [sla-terms.md](./sla-terms.md)。


---

## 通用上线 Checklist

### 上线前

- [ ] SSL 证书部署完成(TLS 1.2+)
- [ ] DNS 解析配置完成
- [ ] 数据库初始化 + 数据迁移完成
- [ ] LLM 厂商 API Key 配置(支持多家备份)
- [ ] 备份策略配置完成
- [ ] 监控告警配置完成(Grafana Dashboard + AlertManager)
- [ ] 日志聚合配置完成(Loki / SLS)
- [ ] SSO 集成完成(企业版 / 旗舰版 / 行业版)
- [ ] RBAC 角色配置完成
- [ ] 性能压测完成(目标 QPS 1.5x)
- [ ] 容灾演练完成(主备切换 + 数据回滚)
- [ ] 安全扫描完成(漏洞 / 弱口令 / 越权)
- [ ] 渗透测试完成(旗舰版 / 行业版必需)
- [ ] 客户培训完成
- [ ] 应急预案 + 联系人清单就位

### 上线后

- [ ] 7×24 监控(首月)
- [ ] 每周运维报告
- [ ] 月度容量评估
- [ ] 季度灾备演练
- [ ] 半年度安全评估

---

## 六、联系支持

- **企业支持热线**:+86 400-XXX-XXXX
- **工单系统**:<https://support.ihui-ai.com>
- **SLA 条款**:见 [sla-terms.md](./sla-terms.md)
- **紧急联系人**:详见合同附件 SOW
