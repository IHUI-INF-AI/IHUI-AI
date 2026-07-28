# 企业版部署指南

> **适用版本**:IHUI-AI Enterprise v1.0 及以上
> **部署模式**:私有云(Private Cloud) / 公有云(Public Cloud) / 混合云(Hybrid Cloud)
> **目标读者**:企业 IT 运维 / 集成商交付工程师 / SRE 工程师
> **最后更新**:2026-07-28

本指南覆盖三种部署模式的架构、组件清单、关键配置项和上线 Checklist。详细安装步骤可参考 [demo-environment.md](./demo-environment.md);SLA 与支持等级见 [sla-terms.md](./sla-terms.md);功能差异见 [feature-comparison.md](./feature-comparison.md)。

---

## 一、部署模式对比

| 维度 | 私有云 | 公有云 | 混合云 |
|------|--------|--------|--------|
| **数据位置** | 客户内网 | 云厂商机房 | 核心数据本地 + AI 推理云端 |
| **适用场景** | 强合规 / 数据不出域 | 弹性扩展 / 快速上线 | 核心数据敏感 + 算力弹性 |
| **网络要求** | 客户机房 / 专线 | 公网 / VPC | VPC Peering / 专线 |
| **部署周期** | 4-8 周 | 1-2 周 | 3-6 周 |
| **运维主体** | 客户为主,厂商支持 | 厂商托管 | 共维 |
| **典型客户** | 政府 / 金融 / 央国企 | 中小企业 / 互联网 | 制造业 / 物流 / 零售 |

---

## 二、私有云部署(Private Cloud / On-Premises)

### 2.1 架构概览

```
┌─────────────────────────────────────────────┐
│            客户内网 / 行业云                 │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  K8s 集群 │  │  K8s 集群 │  │  K8s 集群 │  │
│  │  (生产)  │  │  (灾备)  │  │  (测试)  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │       │
│  ┌────▼──────────────▼──────────────▼────┐  │
│  │  共享存储 / PostgreSQL / Redis         │  │
│  └────────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  客户防火墙 + 堡垒机 + 监控告警       │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 2.2 部署方式

#### 方式 A:Kubernetes Helm Chart(推荐)

适用:K8s 1.24+ 集群,3 节点起步,生产 6 节点以上

```bash
# 1. 添加 Helm 仓库
helm repo add ihui https://charts.ihui-ai.com
helm repo update

# 2. 拉取 values.yaml 并定制
helm show values ihui/ihui-enterprise --version 1.0.0 > values.yaml
# 编辑 values.yaml:
#   - replicaCount: 3
#   - persistence.size: 200Gi
#   - ingress.hostname: enterprise.example.com
#   - secrets.llmApiKey: <from-vault>

# 3. 干跑
helm install ihui ihui/ihui-enterprise \
  --namespace ihui-enterprise \
  --create-namespace \
  --values values.yaml \
  --dry-run --debug

# 4. 正式安装
helm install ihui ihui/ihui-enterprise \
  --namespace ihui-enterprise \
  --create-namespace \
  --values values.yaml
```

#### 方式 B:Docker Compose 离线包

适用:无 K8s 集群 / 离线环境 / 演示场景

```bash
# 离线包结构
enterprise-offline-v1.0.0/
├── docker-compose.yml          # 编排文件
├── images/                     # 镜像 tar 包
│   ├── ihui-api-1.0.0.tar
│   ├── ihui-web-1.0.0.tar
│   ├── ihui-ai-service-1.0.0.tar
│   ├── postgres-15.tar
│   └── redis-7.tar
├── config/                     # 配置模板
│   ├── api.env.template
│   ├── web.env.template
│   └── ai-service.env.template
├── init/                       # 初始化 SQL
└── install.sh                  # 离线安装脚本

# 安装命令
tar -xzf enterprise-offline-v1.0.0.tar.gz
cd enterprise-offline-v1.0.0
./install.sh
```

### 2.3 资源清单(最小生产)

| 资源 | 规格 | 数量 | 用途 |
|------|------|------|------|
| 应用节点 | 8C16G | 3+ | API / Web / AI-Service |
| 数据库节点 | 16C32G + 1TB SSD | 2(主从) | PostgreSQL |
| 缓存节点 | 8C16G | 2(主从) | Redis |
| LLM 网关 | 8C16G | 2 | 外部 LLM 接入 |
| 监控节点 | 4C8G | 1 | Prometheus + Grafana |
| 总计 | 60C130G+ | 10+ | - |

### 2.4 关键配置

```yaml
# values.yaml 核心字段
replicaCount: 3
image:
  api: registry.ihui-ai.com/ihui/api:1.0.0
  web: registry.ihui-ai.com/ihui/web:1.0.0
  aiService: registry.ihui-ai.com/ihui/ai-service:1.0.0

persistence:
  size: 200Gi
  storageClass: ssd-provisioner

ingress:
  enabled: true
  className: nginx
  hostname: enterprise.example.com
  tls:
    enabled: true
    secretName: ihui-tls

secrets:
  jwtSecret: <32 字符随机>
  dbPassword: <从 Vault 注入>
  llmApiKey: <从 Vault 注入>
```

---

## 三、公有云部署(Public Cloud)

### 3.1 支持云厂商

| 厂商 | 部署工具 | 一键脚本 |
|------|----------|----------|
| 阿里云 | Terraform Module | `terraform-aliyun-ihui.tf` |
| 腾讯云 | Terraform Module | `terraform-tencent-ihui.tf` |
| AWS | Terraform Module | `terraform-aws-ihui.tf` |
| 华为云 | Terraform Module | `terraform-huawei-ihui.tf` |

### 3.2 一键部署流程

```bash
# 1. 安装 Terraform
brew install terraform  # macOS
# 或 apt install terraform  # Ubuntu

# 2. 配置云厂商 AK/SK
export ALICLOUD_ACCESS_KEY="<your-ak>"
export ALICLOUD_SECRET_KEY="<your-sk>"
export ALICLOUD_REGION="cn-hangzhou"

# 3. 下载并执行 Terraform
git clone https://github.com/IHUI-INF-AI/ihui-terraform-alibaba.git
cd ihui-terraform-alibaba
terraform init
terraform plan
terraform apply

# 4. 等待 10-15 分钟后,获取访问入口
terraform output url
# 输出: https://ihui-enterprise.xxx.aliyuncs.com
```

### 3.3 架构特点

- **VPC 隔离**:每个客户独立 VPC,子网划分 dev / staging / prod
- **SLB 负载均衡**:阿里云 SLB / 腾讯云 CLB / AWS ALB
- **RDS 托管**:PostgreSQL 主从 + 自动备份 + 7 天 PITR(时间点恢复)
- **Redis 托管**:阿里云 Redis 集群版 / 腾讯云 Redis
- **OSS / COS / S3**:静态资源(图片 / 文档 / 视频)
- **WAF 防护**:Web 应用防火墙 + DDoS 防护
- **日志服务(SLS / CLS / CloudWatch)**:全量审计日志 + 操作日志

### 3.4 备份策略

- 数据库:每日全量 + 实时 WAL 归档,RPO(恢复点目标) ≤ 5 分钟
- 文件:跨区域复制(对象存储)
- 配置:Terraform 状态文件 + Helm values 全部进 Git
- 密钥:进云厂商 KMS(Key Management Service)密钥管理服务

---

## 四、混合云部署(Hybrid Cloud)

### 4.1 架构概览

```
┌──────────────────────┐         ┌──────────────────────────┐
│   客户内网(本地)      │         │   云厂商(VPC)            │
│                      │         │                          │
│  ┌────────────────┐  │         │  ┌────────────────────┐  │
│  │ PostgreSQL     │  │  ─────► │  │   AI 推理集群      │  │
│  │ 用户/订单/审计  │  │ 专线/VPN │  │  LLM 网关 + GPU   │  │
│  └────────────────┘  │         │  └────────────────────┘  │
│  ┌────────────────┐  │         │  ┌────────────────────┐  │
│  │ API / Web 节点  │  │  ─────► │  │  弹性 GPU 池      │  │
│  └────────────────┘  │         │  └────────────────────┘  │
│  ┌────────────────┐  │         │                          │
│  │ 堡垒机 + 监控   │  │         │                          │
│  └────────────────┘  │         │                          │
└──────────────────────┘         └──────────────────────────┘
```

### 4.2 数据流向

- **出云(客户 → 云)**:脱敏后的 LLM 请求(prompt 文本,不含 PII)
- **入云(云 → 客户)**:仅 LLM 推理结果(文本 / JSON),无任何用户数据回传
- **本地闭环**:用户数据 / 业务数据 / 审计日志全部在本地

### 4.3 VPC Peering / 专线配置

```bash
# 方式 A:VPC Peering(同地域)
# 客户 VPC ↔ 云厂商 VPC 通过对等连接打通
# 路由表添加:
#   Destination: 10.0.0.0/16
#   Next Hop: pcx-xxxxxxxxxxxxxxx

# 方式 B:专线(跨地域 / 高带宽)
# 通过云厂商专线接入(阿里云 CEN / 腾讯云 CCN / AWS DX)
# 带宽建议 ≥ 100Mbps,延迟 ≤ 20ms
```

### 4.4 安全要求

- 出云数据必须**脱敏**(移除手机号 / 身份证 / 银行卡 / 邮箱)
- 专线两端均部署**防火墙 + IDS / IPS**
- 所有出云请求走**云厂商 API 网关**,统一鉴权 + 限流
- 审计日志全量保留,支持**事后溯源**

---

## 五、通用上线 Checklist

### 5.1 上线前

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

### 5.2 上线后

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
