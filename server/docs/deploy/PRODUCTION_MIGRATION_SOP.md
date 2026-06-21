# 生产环境 Alembic 演练 SOP (Phase 8)

> 适用对象：DBA / SRE / 高级后端
> 适用版本：zhs-platform v1.0.0+
> 目标：让 3 个 PostgreSQL 库 (zhs_ai_project / zhs_center_project / zhs_educational_training) 升级到 alembic head，并能 head → -1 → head 双向可逆。

---

## 1. 前置条件

| 项 | 要求 | 验证命令 |
|---|---|---|
| PostgreSQL 网络 | 能连 172.21.0.15:5432 | `nc -zv 172.21.0.15 5432` |
| .env.production | DB1/2/3_URL 已配正确 | `grep DB._URL .env.production` |
| Python | 3.12+ | `python --version` |
| 项目根目录 | g:\1\zhs-platform 或等价 | `pwd` |
| 备份目录 | /var/backup/zhs-$(date +%Y%m%d) | `ls /var/backup` |

---

## 2. 演练流程

### Step 1: Dry-run (不连 DB，仅校验脚本链)

```bash
cd /opt/zhs-platform   # 或 g:\1\zhs-platform
bash scripts/alembic_production_upgrade.sh --dry-run
```

**预期输出**：
```
==> 3/3 库 OK (各 7 个迁移版本, 脚本链连贯)
```

**失败处理**：
- 链不连贯 → 修复 alembic/versions/ 下缺 down_revision 的文件
- 缺 down_revision → `alembic revision -m "fix chain"` 生成占位

### Step 2: 备份 (强烈建议)

```bash
mkdir -p /var/backup/zhs-$(date +%Y%m%d)
for db in zhs_ai_project zhs_center_project zhs_educational_training; do
  pg_dump -h 172.21.0.15 -U postgres \
    -Fc --no-owner --no-privileges \
    $db | gzip > /var/backup/zhs-$(date +%Y%m%d)/$db.dump.gz
done
ls -lh /var/backup/zhs-$(date +%Y%m%d)/
```

### Step 3: 升级 (Upgrade)

```bash
bash scripts/alembic_production_upgrade.sh --upgrade
```

**预期输出**：3/3 库升级到 head，每库显示 `<revision_id> (head)`。

**失败处理**：
- 任一库失败 → 脚本自动停在该库，不会跨库污染
- 看失败原因 → 修迁移文件 → 重新跑该库的 alembic upgrade head
- 极端情况：跑 `bash scripts/alembic_production_upgrade.sh --downgrade -1` 回退

### Step 4: 验证表结构

```bash
psql -h 172.21.0.15 -U postgres -d zhs_ai_project -c "\dt" | wc -l
# 期望 ≈ 60+ (业务核心表)
psql -h 172.21.0.15 -U postgres -d zhs_center_project -c "\dt" | wc -l
# 期望 ≈ 30+
psql -h 172.21.0.15 -U postgres -d zhs_educational_training -c "\dt" | wc -l
# 期望 ≈ 10+
```

### Step 5: 可逆性验证 (Reversibility, 业务低峰跑)

```bash
bash scripts/alembic_production_upgrade.sh --reversibility
```

**机制**：脚本会 head → -1 → head，每步停留 5 秒观察日志。

**预期输出**：
```
[ai] downgrade to 006 OK
[ai] upgrade back to 007 OK
[center] downgrade to 006 OK
...
```

**失败处理**：
- downgrade 失败 → 检查 down_revision 是否实现了 drop_table / drop_column
- 修了再跑 `bash scripts/alembic_production_upgrade.sh --upgrade` 升回 head

### Step 6: 启动应用 + 冒烟

```bash
systemctl restart zhs-platform   # 或 docker compose up -d
sleep 8
curl -s http://127.0.0.1:8000/healthz
# 期望: {"status":"ok",...}
curl -s http://127.0.0.1:8000/metrics | grep zhs_biz_monitor_running
# 期望: zhs_biz_monitor_running 1
```

### Step 7: 监控观察 (持续 30 分钟)

- Grafana 面板 `ZHS Monitor Health (Phase 8)` 是否有数据
- Prometheus 告警 `ZHSMonitorDown` / `ZHSMonitorChecksStalled` 未触发
- 业务核心 5 个 endpoint (chat/ai/courses/agents/orders) 5xx 错误率 < 0.1%

---

## 3. 紧急回滚

如果生产升级后出现严重问题：

```bash
# 1. 停应用
systemctl stop zhs-platform

# 2. 回退 1 个版本
bash scripts/alembic_production_upgrade.sh --downgrade -1

# 3. 验证表结构
psql -h 172.21.0.15 -U postgres -d zhs_ai_project -c "\dt" | wc -l

# 4. 恢复数据 (如备份)
gunzip < /var/backup/zhs-20260615/zhs_ai_project.dump.gz | \
  pg_restore -h 172.21.0.15 -U postgres -d zhs_ai_project -c

# 5. 启动旧版本
systemctl start zhs-platform
```

---

## 4. 演练 checklist (打印此表)

| Step | 命令 | 预期 | ✓ |
|---|---|---|---|
| 1 | `bash scripts/alembic_production_upgrade.sh --dry-run` | 3/3 库 OK | ☐ |
| 2 | pg_dump 3 库 | 3 个 .dump.gz 文件 | ☐ |
| 3 | `bash scripts/alembic_production_upgrade.sh --upgrade` | 3/3 库到 head | ☐ |
| 4 | `\dt` 各库 | 总数 ≥ 100 | ☐ |
| 5 | `bash scripts/alembic_production_upgrade.sh --reversibility` | head→-1→head 全 OK | ☐ |
| 6 | `curl /healthz` | 200 OK | ☐ |
| 7 | Grafana 观察 30 分钟 | 5 指标有数据，无告警 | ☐ |

**演练窗口建议**：业务低峰 (凌晨 02:00 - 04:00) 跑，演练完成后填写此表归档到 `/var/log/zhs-migration/YYYYMMDD.log`。

---

## 5. 故障联系

- 主程：lichunchuan
- DBA：dba-team
- 告警通道：Grafana + 钉钉机器人 (zhs-platform-ops)
