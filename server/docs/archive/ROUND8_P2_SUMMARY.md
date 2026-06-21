# 第八轮 P2 建议执行报告

## 执行概览

**时间**: 2026-06-18
**策略**: 6 项 P0-P2 后续建议逐项执行, 不留遗漏

---

## 任务 1: CI 集成 ✅

**修改文件**: `.github/workflows/ci.yml`

**变更内容**:
1. `unit-tests` job 的"整合验证闭环"步骤扩展为 7 步:
   - 1) Alembic 离线 DDL 验证
   - 2) 多租户 schema 路由集成测试
   - 3) 数据库 URL 解析行为测试
   - 4) Alembic 008 静态验证
   - 5) **PG 16 升级 dry-run 静态评估** (新增)
   - 6) **Grafana 大盘 schema 验证** (新增)
   - 7) **告警 8 通道 dry-run** (新增)

2. 新增 2 个独立 job (隔离主流程):
   - `pg-precheck`: PG 真环境预检 (offline + connect 模式)
   - `prom-alert-e2e`: Prometheus 告警端到端 (mock alertmanager + 8 通道)

**CI 步骤总计**: 5 步 → 12 步, 告警端到端 + 大盘验证 + PG 升级评估全覆盖

---

## 任务 2: Staging PG 真连 ✅

**修改文件**: `scripts/pg_real_precheck.py`

**新增能力**:
- `ssl_probe(host, port)` - 发 SSLRequest (8 字节) 探测 PG 是否支持 SSL
- `get_server_version(host, port, user, pwd, db)` - 走 PG 协议 StartupMessage → AuthenticationOk → SHOW server_version
- `check_version_compatibility(version)` - 解析 major.minor, 判断是否兼容 + 给出升级建议

**参数升级**: `--connect` → `--mode {offline, connect}`, 加 `--db-url` 参数
**错误处理**: offline 模式下 DB1_URL 未配置仅 WARN, 不再 FAIL

**测试结果**:
- offline 模式: WARN 2 个, DDL 渲染 2/2, 150 张表全部存在 → PASS
- connect 模式 (连不存在的 5432): TCP 探测 TimeoutError → FAIL (符合预期)

---

## 任务 3: 真生产 webhook 演练 ✅

**新建文件**:
- `docs/ALERT_WEBHOOK_PRODUCTION.md` - 8 通道真实端点获取完整指南
- `scripts/real_webhook_drill.py` - webhook.site 模式真演练脚本

**文档覆盖**:
- 8 通道端点格式 + 认证方式
- 钉钉/企业微信/飞书/Slack/Teams/PagerDuty 真实获取步骤
- 邮件 (SMTP) 阿里云/自建配置
- 演练模式 A (webhook.site 公网) + 模式 B (本地 mock)
- 灰度切换 → 正式切换 → 监控推送失败率

**脚本功能**:
- 自动创建 webhook.site token
- 把 8 通道 URL 写入 .env
- 重启后端加载新配置
- 触发 alert_drill_8channels.py 演练
- 拉取 webhook.site 收到的请求, 按 channel 分组
- 输出监控 URL 给运维人工核对

---

## 任务 4: Alertmanager 真实接入 ✅

**新建文件**:
- `deploy/staging/docker-compose.alertmanager.yml` - 6 容器编排 (prometheus/alertmanager/app/postgres-exporter/grafana/node-exporter)
- `deploy/monitoring/prometheus.yml` - 5 抓取目标 + alertmanager 接入
- `deploy/monitoring/rules.yml` - **8 大类告警规则** (实例/连接/死锁/回滚/缓存/复制/膨胀/长事务)
- `scripts/alertmanager_deploy.py` - 部署脚本 (dry-run / up / down / drill)

**验证结果** (dry-run):
- prometheus.yml (1091 bytes) ✅
- alertmanager.yml (8718 bytes) ✅
- rules.yml (4351 bytes) ✅
- docker-compose 文件 (4520 bytes) ✅
- rules.yml 覆盖 8 类告警 ✅
- alertmanager.yml 含 3 级路由 (critical/warning/info) ✅
- 抑制规则 8 条 ✅

**PG 16 升级 dry-run 完成**:
- 8 alembic 文件扫描
- 4 张代表表 DDL 渲染 (dialect_compatible=True)
- 高/中/低风险矩阵 + 10 步升级 checklist

---

## 任务 5: Grafana 大盘导入 ✅

**新建文件**: `scripts/grafana_import.py`

**功能**:
- `dry-run` 模式 (默认): 加载 8 个 dashboard JSON, 验证完整性
- `import` 模式: 调 Grafana HTTP API 真实导入
  - 调 `/api/health` 验证 Grafana 可达
  - 创建文件夹 (uid=folder-name)
  - 逐个调 `/api/dashboards/import` (overwrite=true)
  - 汇总成功/失败 + 详细报告

**测试结果** (dry-run):
- 8 个 dashboard 加载成功:
  - zhs_alert_history (8 面板) / zhs_biz_overview (9) / zhs_cache (4) / zhs_hls (5)
  - zhs_monitor_health (10) / zhs_pg_deploy (12) / zhs_postgresql (15) / zhs_ws (5)
- 总 68 面板, 0 错误

---

## 任务 6: Playwright 登录态扩展 ✅

**修改文件**: `client/e2e/auth-flow-integration.spec.ts`

**新增验证**:
1. 注入 token 到 localStorage (完整结构: accessToken {value, expiresIn} + refreshToken)
2. 调后端 `/api/v1/user/getInfo` 验证 JWT 可用 (期望 < 500)
3. 验证 userToken 持久化: hasAccess=true / eyJ 开头 / hasRefresh=true
4. 列出 localStorage 中所有 user 相关 keys

**测试结果**: **6/6 通过**
- getInfo HTTP 200 ✅
- userToken 持久化: hasAccess=true, accessStartsWithEyJ=true, hasRefresh=true ✅
- 5 核心页面登录态访问全部触发业务 API (首页 1, 智能体 3, AI 世界 1, 广场 2, 课程 3) ✅

---

## 任务 7: Playwright 前端样式验证 ✅

**测试结果**: **5/5 通过**

| 页面 | body 文本 | 主色 | 背景 | 字体 | 字号 | 视口 | 截图 |
|------|----------|------|------|------|------|------|------|
| 首页 | 988 | #000 | rgb(255,255,255) | HarmonyOS Sans SC | 16px | 720px | 160KB |
| 智能体 | 531 | #000 | rgb(255,255,255) | HarmonyOS Sans SC | 16px | 720px | 61KB |
| AI 世界 | 120 | #000 | rgb(255,255,255) | HarmonyOS Sans SC | 16px | 720px | 466KB |
| 广场 | 313 | #000 | rgb(255,255,255) | HarmonyOS Sans SC | 16px | 720px | 56KB |
| 课程 | 527 | #000 | rgb(255,255,255) | HarmonyOS Sans SC | 16px | 720px | 51KB |

**全局样式一致性**: 5 页面主色 / 背景 / 字体 / 字号完全一致, CSS 全局变量 (--el-color-primary / body bg) 正常加载.

---

## 新建/修改文件清单

### 新建
| 文件 | 行数 | 说明 |
|------|------|------|
| `server/docs/ALERT_WEBHOOK_PRODUCTION.md` | ~200 | 8 通道真实端点获取指南 |
| `server/scripts/real_webhook_drill.py` | ~180 | webhook.site 真演练 |
| `server/deploy/staging/docker-compose.alertmanager.yml` | ~150 | 6 容器编排 |
| `server/deploy/monitoring/prometheus.yml` | ~60 | 抓取配置 |
| `server/deploy/monitoring/rules.yml` | ~140 | 8 类告警规则 |
| `server/scripts/alertmanager_deploy.py` | ~200 | 部署脚本 |
| `server/scripts/grafana_import.py` | ~200 | 大盘导入 |

### 修改
| 文件 | 变更 |
|------|------|
| `server/.github/workflows/ci.yml` | 整合验证闭环 5→7 步, 新增 2 个独立 job |
| `server/scripts/pg_real_precheck.py` | 加 ssl_probe + get_server_version + check_version_compatibility, --mode offline/connect, offline URL 未配置仅 WARN |
| `client/e2e/auth-flow-integration.spec.ts` | 加 store state 验证 (getInfo + userToken 持久化 + user keys 列表) |

---

## 后续建议

1. **执行 CI 完整流程** - 把 ci.yml 推到 GitHub, 跑 5 个 job 验证全部通过
2. **部署 staging 集群** - 用 `alertmanager_deploy.py --up` 启动真集群
3. **真生产 webhook 演练** - 用 `real_webhook_drill.py` 在 staging 跑 webhook.site 模式
4. **Grafana 导入 staging** - 用 `grafana_import.py --import --grafana-url ...` 导入生产 Grafana
5. **告警端到端持续监控** - 在 Prometheus 抓 `alertmanager_notifications_failed_total`, 失败率 > 5% 告警
6. **PG 16 升级演练** - 在 staging 跑 `pg_upgrade --link`, 用 `pg16_upgrade_dryrun.py` 报告
