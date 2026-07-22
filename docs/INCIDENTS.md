# 事故响应手册 (Incident Response Runbook)

> 本文档记录生产事故的响应流程、角色分工、等级定义与处置模板,
> 目标是在最短时间内恢复服务并形成可追溯的复盘记录。

---

## 1. 文档目的

- 标准化生产事故的响应流程,避免慌乱中遗漏关键步骤
- 明确响应角色与分工,减少沟通成本
- 提供事故分级标准,匹配相应响应力度
- 沉淀常见事故 Runbook,缩短平均恢复时间 (MTTR)
- 通过无 blame 复盘持续改进系统韧性

适用范围:IHUI-AI 生产环境 (aizhs.top) 的所有线上事故。

---

## 2. 事故等级定义

| 等级 | 名称 | 判定条件 | 目标恢复时间 | 响应方式 |
|------|------|----------|--------------|----------|
| **P0** | Critical | 全站不可用 / 数据丢失 / 支付故障 / 安全漏洞被利用 | < 30 分钟 | 立即拉群 + 电话,全员响应 |
| **P1** | High | 核心功能不可用 (登录 / 聊天 / 支付) / 性能严重降级 (>50% 用户受影响) | < 2 小时 | 立即拉群,IC 指挥 |
| **P2** | Medium | 部分功能异常 / 非核心服务宕机 / 性能降级 (<50% 用户受影响) | < 8 小时 | 工作时间内响应 |
| **P3** | Low | UI 缺陷 / 单用户问题 / 体验问题 | < 24 小时 | 排入下一迭代 |

### 等级判定原则

1. **影响范围优先**: 受影响用户数 > 功能完整度
2. **数据安全优先**: 涉及数据丢失或泄露一律 P0
3. **支付相关优先**: 任何支付故障一律 P0
4. **就高不就低**: 介于两级之间时取较高等级

---

## 3. 响应角色

| 角色 | 职责 | 默认人选 |
|------|------|----------|
| **Incident Commander (IC)** | 全局指挥协调,决定恢复策略,授权高风险操作 | Tech Lead / 值班 SRE |
| **Communications Lead** | 对外沟通 (用户公告 / 管理层汇报 / status page 更新) | 产品经理 / 运营 |
| **Operations Lead** | 执行具体恢复操作 (回滚 / 重启 / 扩容 / 切换) | 值班开发 / SRE |
| **Scribe** | 记录事故时间线、决策点、操作日志 | 任意可记录人员 |

### 角色协作原则

- IC 不执行具体操作,专注决策与协调
- Operations Lead 一次只执行一个恢复动作,避免叠加效应
- Scribe 在飞书事故群使用「时间线模板」实时记录
- 角色可兼任 (P2/P3 事故),但 P0/P1 必须分离 IC 与 Operations

---

## 4. 响应流程 (5 步)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  1.检测  │ →  │  2.分级  │ →  │  3.响应  │ →  │  4.恢复  │ →  │  5.复盘  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
   监控告警       按定义判定       组建团队       优先恢复       24-48h
   用户反馈       P0-P3           IC 指挥        根因延后       无 blame
```

### 步骤 1: 检测
- **监控告警**: Prometheus + Alertmanager → 飞书告警群
- **用户反馈**: 客服群 / 工单系统 / 管理后台反馈
- **主动巡检**: 定时健康检查 / 日志异常扫描

### 步骤 2: 分级
- 由首先发现者按「事故等级定义」初步判定
- IC 确认最终等级,可在响应过程中调整
- P0/P1 必须立即拉事故群;P2/P3 可走常规工单

### 步骤 3: 响应
- IC 在飞书事故群 @所有人,宣布事故等级与响应团队
- 指派 Communications Lead / Operations Lead / Scribe
- Scribe 开始记录时间线 (起止时间、决策点、操作)
- Communications Lead 准备对外公告 (P0/P1 必须)

### 步骤 4: 恢复
- **首要目标: 恢复服务,不是找根因**
- 优先使用「恢复手段清单」中的可控操作
- 高风险操作 (数据库故障切换 / 数据回滚) 必须由 IC 授权
- 每一步操作前后记录服务状态 (健康检查 / 监控指标)

### 步骤 5: 复盘
- 事故恢复后 24-48 小时内召开复盘会
- 使用「事故模板」输出 postmortem 文档
- **无 blame 原则**: 聚焦流程与系统改进,不追个人责任
- 行动项必须有 owner 和 due date,纳入下一迭代跟踪

---

## 5. 通讯渠道

| 用途 | 渠道 | 触发条件 |
|------|------|----------|
| **紧急通知** | 电话 + 飞书群 @所有人 | P0/P1 事故 |
| **协调沟通** | 飞书事故群 (临时创建) | P0/P1/P2 事故 |
| **对外公告** | status page (status.aizhs.top) + 公告横幅 | P0/P1 必发,P2 视情况 |
| **管理层汇报** | 飞书私聊 + 邮件 | P0 立即,P1 1 小时内 |
| **用户沟通** | 客服群 / 公告 / 邮件 | 视影响范围 |

### 通讯规范
- 事故群消息必须带时间戳 (HH:MM)
- 决策必须明确「决策人 + 决策内容 + 时间」
- 对外公告由 Communications Lead 统一发出,避免信息混乱
- 事故解决后 IC 宣布「事故已恢复」, Communications Lead 更新 status page

---

## 6. 恢复手段清单 (按优先级)

> 优先尝试影响最小、风险最低的手段,逐级升级。

| 优先级 | 手段 | 命令 / 操作 | 影响范围 | 风险 |
|--------|------|-------------|----------|------|
| 1 | 回滚部署 | `deploy.sh rollback` | 切换到上一稳定版本 | 低 |
| 2 | 切换蓝绿 | `deploy.sh green` 或 `deploy.sh blue` | 切换流量到备用环境 | 低 |
| 3 | 重启服务 | `docker-compose restart <service>` | 短暂中断 (秒级) | 低 |
| 4 | 扩容 | `docker-compose up --scale api=3` | 增加实例分担流量 | 低 |
| 5 | 降级 | 关闭非核心功能 (AI 推荐 / 大文件上传) | 部分功能不可用 | 中 |
| 6 | 数据库故障切换 | 详见 `BUG-R17-DB-FAILOVER` 流程 | 可能丢数据 | 高,需 IC 授权 |
| 7 | 数据回滚 | 从备份恢复 PostgreSQL | 数据丢失 | 极高,需 IC + 管理层授权 |

### 操作前检查
- [ ] 确认当前服务状态 (健康检查 / 监控)
- [ ] 通知 Communications Lead 准备公告
- [ ] Scribe 记录操作开始时间
- [ ] 高风险操作获得 IC 授权
- [ ] 操作后验证服务恢复

---

## 7. 事故模板 (Postmortem)

```markdown
# [事故标题] - [YYYY-MM-DD]

## 事故概述
- **事故等级**: P0 / P1 / P2 / P3
- **发生时间**: YYYY-MM-DD HH:MM (UTC+8)
- **恢复时间**: YYYY-MM-DD HH:MM
- **持续时长**: X 小时 X 分钟
- **影响范围**: 简述受影响功能与用户群
- **IC**: 姓名
- **响应团队**: 姓名1 / 姓名2 / 姓名3

## 时间线
| 时间 (HH:MM) | 事件 | 操作人 |
|--------------|------|--------|
| 14:32 | 监控告警触发,API 502 错误率上升 | - |
| 14:35 | 值班确认事故,拉事故群,定级 P1 | 张三 |
| 14:40 | IC 到位,指派角色 | 张三 |
| 14:45 | Operations 检查 api 容器日志 | 李四 |
| 14:50 | 决定回滚部署 | 张三 |
| 14:55 | 执行 deploy.sh rollback | 李四 |
| 15:02 | 健康检查恢复,监控指标正常 | 李四 |
| 15:05 | IC 宣布事故恢复 | 张三 |

## 根因分析 (5 Why)
1. **为什么 API 出现 502?** → api 容器 OOM 被杀
2. **为什么 OOM?** → 内存泄漏,单实例内存涨到 2GB
3. **为什么内存泄漏?** → 新引入的 LangGraph 会话缓存未设置上限
4. **为什么没设置上限?** → 代码 review 未关注缓存淘汰策略
5. **为什么 review 未关注?** → 缺少缓存相关的代码检查清单

## 影响范围
- **受影响用户数**: ~XXX 人
- **失败请求数**: ~XXXX 次
- **失败订单数**: X 笔 (金额: ¥XXX)
- **服务不可用时长**: XX 分钟

## 恢复措施
- 立即回滚到上一版本
- (后续) 修复缓存淘汰逻辑,增加内存监控告警

## 行动项
| 行动项 | Owner | Due Date | 状态 |
|--------|-------|----------|------|
| 修复 LangGraph 会话缓存淘汰 | 张三 | YYYY-MM-DD | 待办 |
| 增加内存使用率 > 80% 告警 | 李四 | YYYY-MM-DD | 待办 |
| 补充代码 review 缓存检查清单 | 王五 | YYYY-MM-DD | 待办 |
| 增加 api 容器内存限制 | 李四 | YYYY-MM-DD | 待办 |

## 经验教训
- **做得好的**: 监控告警及时,响应团队 5 分钟内就位
- **做得不好的**: 代码 review 漏掉缓存策略
- **下次可以改进的**: 增加缓存相关的自动化检查
```

---

## 8. 常见事故 Runbook

### 8.1 API 502 / 504 错误率上升

```
检测: Prometheus 告警 http_error_rate > 5% 持续 1 分钟
判定: P0 (若全站不可用) / P1 (若部分用户受影响)

处置步骤:
1. 检查 api 容器状态
   docker-compose ps api
2. 查看 api 日志 (最近 200 行)
   docker-compose logs --tail=200 api
3. 检查健康检查
   curl http://localhost:8802/api/health
4. 若容器 OOM 或异常退出 → 重启
   docker-compose restart api
5. 若 QPS 过高 → 扩容
   docker-compose up --scale api=3 -d
6. 若新版本引入 → 回滚
   deploy.sh rollback
7. 若数据库连接耗尽 → 检查 PostgreSQL 连接数
   docker-compose exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

### 8.2 数据库 CPU 100%

```
检测: Prometheus 告警 pg_cpu_usage > 90% 持续 3 分钟
判定: P1

处置步骤:
1. 查看当前活跃查询
   docker-compose exec postgres psql -U postgres -c \
     "SELECT pid, now() - pg_stat_activity.query_start AS duration, query
      FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC;"
2. Kill 耗时长的慢查询
   docker-compose exec postgres psql -U postgres -c "SELECT pg_terminate_backend(<pid>);"
3. 检查是否有未走索引的全表扫描
   查看慢查询日志: /apps/api/logs/slow-query.log
4. 若为流量峰值 → 启动限流
   api 启用 rate limit 中间件
5. 若为索引缺失 → 紧急加索引
   CREATE INDEX CONCURRENTLY ... (注意不锁表)
6. 持续监控 CPU,确认恢复
```

### 8.3 Redis OOM

```
检测: Prometheus 告警 redis_memory_usage > 90% 持续 1 分钟
判定: P1

处置步骤:
1. 查看 Redis 内存使用
   docker-compose exec redis redis-cli INFO memory
2. 查看内存占用最大的 key
   docker-compose exec redis redis-cli --bigkeys
3. 检查过期策略
   docker-compose exec redis redis-cli CONFIG GET maxmemory-policy
4. 清理可丢弃的缓存 (谨慎)
   docker-compose exec redis redis-cli FLUSHDB  # 仅清当前 db,需 IC 授权
5. 调整 maxmemory 与淘汰策略
   修改 redis.conf: maxmemory 2gb / maxmemory-policy allkeys-lru
6. 重启 Redis
   docker-compose restart redis
7. 若数据量持续增长 → 扩容 Redis 实例
```

### 8.4 磁盘满

```
检测: Prometheus 告警 disk_usage > 90% 持续 1 分钟
判定: P1 (影响所有写入)

处置步骤:
1. 检查磁盘占用
   df -h
2. 定位大文件
   du -sh /var/lib/docker/* | sort -rh | head -20
3. 清理 Docker 无用资源 (谨慎,不影响运行中容器)
   docker system prune -a --volumes  # 需 IC 授权
4. 清理旧日志
   truncate -s 0 /apps/api/logs/*.log
   docker-compose logs --tail=0 -f api  # 重定向到 /dev/null
5. 清理 Loki 旧数据
   查看 Loki retention 配置,必要时手动清理
6. 若数据卷已满 → 扩容磁盘 (云盘扩容或迁移)
7. 恢复后设置磁盘使用率 > 80% 告警
```

### 8.5 SSL 证书过期

```
检测: 证书到期前 14 天告警 / 用户反馈浏览器证书警告
判定: P1 (若已过期) / P2 (即将过期)

处置步骤:
1. 检查证书状态
   deploy_certs.sh status
2. 续期证书
   deploy_certs.sh renew
3. 验证新证书
   curl -vI https://aizhs.top 2>&1 | grep -E "expire|subject|issuer"
4. 重载 Nginx
   docker-compose exec nginx nginx -s reload
5. 验证 HTTPS 访问
   浏览器访问 https://aizhs.top 确认无警告
6. 若 certbot 失败 → 检查 DNS 解析 / 80 端口可达性
```

### 8.6 DNS 故障

```
检测: 用户反馈无法访问 / 监控探测失败
判定: P1

处置步骤:
1. 验证 DNS 解析
   nslookup aizhs.top
   dig aizhs.top +short
2. 检查 DNS 服务商状态 (阿里云 DNS / Cloudflare)
   登录控制台查看解析记录
3. 若 DNS 服务商故障 → 切换到备用 DNS
   修改域名 NS 记录到备用服务商
   注意: NS 切换生效较慢 (数小时)
4. 若为解析记录错误 → 紧急修正
5. 临时方案: 引导用户使用 IP 直连 (公告)
6. 通知 Communications Lead 准备用户公告
```

---

## 9. 历史事故记录

> 本节按时间倒序追加已完成复盘的事故,格式: `[YYYY-MM-DD] [等级] [标题] → [postmortem 链接]`

| 日期 | 等级 | 事故标题 | 持续时长 | Postmortem |
|------|------|----------|----------|------------|
| - | - | (暂无) | - | - |

---

## 相关文档

- [生产基础设施拓扑](./PRODUCTION_INFRASTRUCTURE.md)
- [部署决策](./INFRASTRUCTURE_DECISION.md)
- [部署手册](./DEPLOYMENT_RUNBOOK.md)
- [部署脚本](../deploy/README.md)
- [监控日志](../monitoring/README-logging.md)
