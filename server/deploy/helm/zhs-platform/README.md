# 智护数平台 - K8s 部署

## 目录

- `helm/zhs-platform/` - Helm Chart (推荐)
- `manifests/` - 原始 K8s YAML (CI 兜底)

## 快速开始

### Helm 安装

```bash
# 1. 创建命名空间
kubectl create ns zhs

# 2. 准备密钥 (生产环境必须用 external-secrets / sealed-secret)
kubectl -n zhs create secret generic zhs-jwt \
  --from-literal=secret=$(openssl rand -base64 48)

kubectl -n zhs create secret generic zhs-redis \
  --from-literal=password=$(openssl rand -base64 24)

kubectl -n zhs create secret generic zhs-db-ai \
  --from-literal=password=$(cat pg-ai.pass)
kubectl -n zhs create secret generic zhs-db-center \
  --from-literal=password=$(cat pg-center.pass)
kubectl -n zhs create secret generic zhs-db-course \
  --from-literal=password=$(cat pg-course.pass)

# 3. 安装 Chart
helm install zhs ./helm/zhs-platform \
  -n zhs \
  -f helm/zhs-platform/values.prod.yaml

# 4. 查看状态
helm status zhs -n zhs
kubectl -n zhs get pods,svc,ing,hpa,pdb
```

### 升级

```bash
# 修改 values 后升级
helm upgrade zhs ./helm/zhs-platform -n zhs -f values.prod.yaml

# 回滚
helm history zhs -n zhs
helm rollback zhs 1 -n zhs
```

### 卸载

```bash
helm uninstall zhs -n zhs
kubectl delete pvc -n zhs -l app.kubernetes.io/instance=zhs
```

## 关键架构

| 组件 | 数量 | 镜像 | 端口 |
| --- | --- | --- | --- |
| API Pod | 2-10 (HPA) | zhs/platform:1.0.0 | 8000 |
| Service (ClusterIP) | 1 | - | 8000 |
| Ingress (nginx) | 1 | - | 80/443 |
| HPA | 1 | - | - |
| PDB | 1 | - | - |

## 存储

- HLS 切片: `50Gi SSD` (ReadWriteOnce)
- 静态前端: `5Gi Standard` (ReadWriteOnce)
- 数据库: 外部 PostgreSQL (运维托管)
- 缓存: 外部 Redis (运维托管)

## 监控

Pod annotation 自动注册 Prometheus 抓取:

```yaml
prometheus.io/scrape: "true"
prometheus.io/port: "8000"
prometheus.io/path: "/metrics"
```

`/metrics` 暴露的指标:
- `BIZ_REQUEST_TOTAL` - 业务请求总数 (endpoint, status)
- `BIZ_LATENCY` - 业务请求延迟直方图
- `HLS_TRANSCODE_SECONDS` - HLS 转码耗时
- `HLS_SEGMENTS_TOTAL` - HLS 切片数 (bitrate)
- `NOTICE_PUSHED_TOTAL` - 通知推送数
- `CACHE_HIT_RATIO` - 缓存命中率
- `PAYMENT_AMOUNT_TOTAL` - 支付金额
- `WS_CONNECTIONS` - WebSocket 活跃连接数
- `JOB_EXECUTIONS_TOTAL` - 定时任务执行数

### Grafana Dashboards

chart 自动注入 4 个 dashboard 到 `{{ .Release.Name }}-grafana-dashboards` ConfigMap:

- `zhs_biz_overview.json` - 业务总览 (请求量/延迟/错误率)
- `zhs_hls.json` - HLS 转码
- `zhs_cache.json` - 缓存命中率
- `zhs_ws.json` - WebSocket 连接

需要在集群 Grafana 启用 dashboard sidecar (label: `grafana_dashboard: "1"`) 自动加载.
关闭方式: `helm install --set grafanaDashboards.enabled=false`.

> 源 dashboard 在 `deploy/grafana/dashboards/`, helm 3.14 不允许 `.Files.Get` 跳出 chart 目录, 所以在 chart 内部 `dashboards/` 也保留一份, 通过 `python scripts/ci/sync_grafana_dashboards.py` 同步.

## 健康检查

- Liveness: `GET /healthz` (30s 间隔, 失败 3 次重启)
- Readiness: `GET /healthz` (10s 间隔, 失败 3 次踢出 Service)

## 安全

- runAsNonRoot: true (UID 1000)
- readOnlyRootFilesystem 暂未启用 (HLS 写入需要临时目录)
- capabilities.drop: ALL
- Secret 通过 external-secrets-operator 注入, 不入库

## 故障排查

```bash
# 查看 Pod 状态
kubectl -n zhs get pods -l app.kubernetes.io/name=zhs-platform

# 查看日志
kubectl -n zhs logs -l app.kubernetes.io/name=zhs-platform --tail=200 -f

# 进入 Pod
kubectl -n zhs exec -it <pod-name> -- sh

# 端口转发调试
kubectl -n zhs port-forward <pod-name> 8000:8000
curl http://localhost:8000/healthz
curl http://localhost:8000/metrics
```

## 部署到生产

1. 推送镜像到镜像仓库
2. 替换 `values.prod.yaml` 中的镜像 tag
3. 用 sealed-secret 加密密钥
4. `helm upgrade --install zhs ./helm/zhs-platform -f values.prod.yaml`
5. 等待 HPA 收敛, 验证 `/healthz` 和 `/metrics`
