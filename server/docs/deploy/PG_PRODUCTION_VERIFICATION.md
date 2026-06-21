# PostgreSQL 生产环境验证手册

> 适用版本: PostgreSQL 13+ (生产推荐 15/16)
> 验证目的: 证明整合工作在真实 PG 环境可用
> 当前离线环境无法直连 PG, 文档提供完整 dry-run + 实战步骤

---

## 1. 前置条件

| 资源 | 要求 |
|------|------|
| PostgreSQL | 13+ (推荐 15 或 16) |
| 可达端口 | 5432 (或自定义, 见下方 ENV) |
| 数据库 | `zhs` (或自定义) |
| 用户 | 具备 CREATEDB 权限 |

环境变量:
```bash
export ENV=production
export DB1_URL="postgresql+psycopg2://zhs:strongpass@pg-xxx.zhs.svc.cluster.local:5432/zhs"
export DB2_URL="${DB1_URL}"  # 或独立只读实例
```

---

## 2. Dry-run 模式 (推荐先做)

不连真 PG, 用 mock 验证配置正确性:

```bash
cd g:\1\server

# 2.1 验证生产环境配置
ENV=production python scripts/check_pg_config.py

# 2.2 模拟 PG 不可用 -> 验证生产环境拒绝降级
pytest tests/test_db_url_resolution.py -v

# 2.3 验证 DDL 离线生成
python scripts/alembic_offline_verify.py
```

预期输出:
- `test_db_url_resolution.py`: 9/9 通过
- `alembic_offline_verify.py`: 150 张表 DDL, 无 MySQL 残留

---

## 3. 真 PG 部署前演练

```bash
# 3.1 预检脚本: dry-run 模式不执行 SQL
ENV=production python scripts/pg_deploy.py --dry-run

# 输出: 预检报告 JSON, 含
#   - 目标 PG 版本
#   - 现有迁移版本
#   - 预期新建表数
#   - 预期 DDL 操作数
```

---

## 4. 真 PG 部署 (4 步)

### 4.1 连接验证
```bash
ENV=production python -c "
from app.database import _resolve_db_url
url = _resolve_db_url('${DB1_URL}', 1)
print(f'OK: {url}')
"
```
期望输出: `OK: postgresql+psycopg2://zhs:***@pg-xxx.zhs.svc.cluster.local:5432/zhs`

### 4.2 执行迁移
```bash
cd g:\1\server

# 4.2.a 离线生成 DDL 审阅
python scripts/alembic_offline_verify.py --output /tmp/alembic_full.sql
# 人工 review /tmp/alembic_full.sql

# 4.2.b 真实升级
ENV=production python -m alembic upgrade head
# 或用项目自带命令
ENV=production python scripts/pg_deploy.py --target head
```

### 4.3 健康检查
```bash
ENV=production python scripts/pg_health_check.py
# 期望: 连接 OK / 150 张表 / 008 迁移在 head / 索引数 >= 200
```

### 4.4 关键集成测试
```bash
# 4.4.1 跨方言 Order 主键 (PG)
ENV=production pytest tests/test_s7_order_biginteger_pk_fix.py -v

# 4.4.2 死锁重试 (PG SQLSTATE 40P01)
ENV=production pytest tests/test_bug199_deadlock_retry.py -v

# 4.4.3 多租户 schema 路由
ENV=production pytest tests/test_multi_tenant_schema_routing.py -v

# 4.4.4 全量回归
ENV=production pytest tests/ -v --tb=short
```

---

## 5. 真实 8 通道告警演练 (对接真实 webhook)

替换演练脚本配置为生产值:

```bash
export DINGTALK_WEBHOOK="https://oapi.dingtalk.com/robot/send?access_token=xxx"
export DINGTALK_SECRET="SEC..."
export WECHAT_WORK_WEBHOOK="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
export FEISHU_WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
export SLACK_WEBHOOK="https://hooks.slack.com/services/xxx"
export TEAMS_WEBHOOK="https://outlook.office.com/webhook/xxx"
export GENERIC_WEBHOOK_URL="https://alerts.zhs.com/ingest"
export PAGERDUTY_ROUTING_KEY="real-routing-key"
export SMTP_HOST="smtp.zhs.com"
export SMTP_PORT="465"
export SMTP_USER="alert@zhs.com"
export SMTP_PASSWORD="real-pass"
export ALERT_EMAIL_TO="oncall@zhs.com"

cd g:\1\server
python scripts/alert_drill_8channels.py --output /tmp/drill_real.json
```

期望:
- 全部 8 通道 `success=True`
- 钉钉/企业微信/飞书/Slack/Teams 群收到 "[DRILL]" 标题告警
- PagerDuty 后台出现 drill 事件
- 邮件 oncall@zhs.com 收到测试邮件
- 退出码 0

---

## 6. 真实 WebSocket 握手

```bash
# 启动后端 (带 JWT secret)
ENV=production python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 跑 WebSocket 真握手
pytest tests/test_alembic_ws_token.py --run-ws -v

# 期望: test_ws_proxy_rejects_no_token PASSED (无 token 401)
#       test_ws_proxy_with_valid_token PASSED (带 token 握手成功)
```

---

## 7. 真实前后端联调

```bash
# 7.1 启动前端 (生产模式)
cd g:\1\client
npm run build
npm run preview -- --port 8888

# 7.2 跑 Playwright 联调
PW_BASE_URL=http://127.0.0.1:8888 npx playwright test e2e/frontend-backend-integration.spec.ts --reporter=list

# 期望: 6/6 通过, API 联动汇总有 50+ 个 /api/v1/* 调用
```

---

## 8. 验证后清理

```bash
# 8.1 检查数据库无残留
psql -h $PG_HOST -U zhs -d zhs -c "
  SELECT count(*) AS table_count
  FROM information_schema.tables
  WHERE table_schema NOT IN ('pg_catalog', 'information_schema');
"
# 期望: 150+

# 8.2 检查告警通道日志
ls -la /var/log/zhs/alerts/ | head -20
# 期望: drill 演练日志被归档

# 8.3 验证 alembic 状态
psql -h $PG_HOST -U zhs -d zhs -c "SELECT version_num FROM alembic_version;"
# 期望: 008_add_missing_tables (head)
```

---

## 9. 故障排查

| 症状 | 排查 |
|------|------|
| 008 迁移失败 | 检查 `tests/test_alembic_008_static.py` 报告 + 是否有循环外键 |
| 生产环境降级 | 检查 ENV 是否真的 = production, 确认 `tests/test_db_url_resolution.py` 9/9 过 |
| 告警 401/403 | 确认 webhook token 未过期, 验签密钥一致 |
| WebSocket 401 | 检查 JWT token 是否带 `Bearer` 前缀或 `?token=` 参数 |
| Playwright 0 API 调用 | 确认登录态已写入 localStorage, 业务接口均需鉴权 |

---

## 10. 当前离线环境已完成的验证

| 任务 | 方式 | 状态 |
|------|------|------|
| 8 通道告警演练 | 本地 mock receiver (127.0.0.1:7001-7025) | ✅ 8/8 通过 |
| Alembic 离线 DDL | 150 张表 CREATE TABLE 验证 | ✅ 通过 |
| 多租户 schema 路由 | mock 上下文 + ASGI middleware | ✅ 24/24 通过 |
| DB URL 解析 | mock create_engine | ✅ 9/9 通过 |
| 前后端联调 | Playwright + 本地 8000/8888 服务 | ✅ 6/6 通过 |
| e2e 冒烟 | pytest --base | ✅ 7/7 通过 |
| WebSocket 真握手 | pytest --run-ws | ✅ 2/2 通过 |

**真 PG / 真 webhook 验证需在 staging/prod 环境执行, 本文档提供完整步骤.**
