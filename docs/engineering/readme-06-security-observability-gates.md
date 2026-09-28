# 可观测性 · 安全设计 · 根目录守门服务 · 工程守门全表 · 提交丢失防护 · 质量证据 · 部署与 CI · 国际化 · LLM 字典化

> 本文件是从 `README.md` 拆出来的**原文收纳件**(2026-09-27,README 瘦身票)。
> 来源:旧 `README.md` 第 2605–3428 行,逐字搬入,未改写任何一句。
> 目录页与索引见 [`docs/engineering/README.md`](./README.md)。

## 可观测性

全栈可观测性,三支柱(指标 / 日志 / 追踪)+ 告警完整就绪:

### 指标(Prometheus + Grafana 3 仪表盘)

- **Prometheus**(:9091):抓取 api `/metrics` + ai-service `/metrics` + node-exporter 主机指标 + alerts.yml 告警规则
- **Grafana**(:8816):**20 个仪表盘 JSON 自动 provision**,包含:

| #   | 仪表盘           | 用途            |
| --- | ---------------- | --------------- |
| 1   | ihui-ai-overview | 总览            |
| 2   | ai-cost          | AI 成本         |
| 3   | ai-latency       | AI 延迟         |
| 4   | alert_history    | 告警历史        |
| 5   | auth-security    | 认证安全        |
| 6   | bullmq           | 队列健康        |
| 7   | business-funnel  | 业务漏斗        |
| 8   | cache            | 缓存命中        |
| 9   | exam-usage       | 考试使用率      |
| 10  | hls              | HLS 流媒体      |
| 11  | jaeger           | 追踪            |
| 12  | live-room        | 直播间          |
| 13  | monitor_health   | 监控健康        |
| 14  | nginx            | Nginx           |
| 15  | oss-storage      | OSS 存储        |
| 16  | payment-flow     | 支付流          |
| 17  | pg_deploy        | PostgreSQL 部署 |
| 18  | postgresql       | PostgreSQL      |
| 19  | redis-cluster    | Redis 集群      |
| 20  | tenant-usage     | 租户使用        |
| 21  | ws               | WebSocket       |

- **Node Exporter**(:8817):主机 CPU / 内存 / 磁盘 / 网络指标

### 日志(Loki + Promtail)

- **Loki**(:8818):日志聚合后端
- **Promtail**:自动发现带 `logging=promtail` 标签的 Docker 容器,采集 Docker + Nginx + API 应用日志

### 追踪(OpenTelemetry + Jaeger)

- **OpenTelemetry Collector**(:8813):接收 OTLP 追踪 / 指标,导出到 Jaeger + Prometheus
- **Jaeger UI**(:8814):分布式追踪可视化,API ↔ AI 服务 ↔ 数据库全链路

### 告警(Alertmanager + noise-rules)

- **Alertmanager**(:9093):告警路由 + 噪音抑制
- **monitoring/alertmanager/noise-rules.yml**:告警噪音抑制规则(单一源,旧根目录副本已合并)

### 健康检查

| 端点                    | 用途                          |
| ----------------------- | ----------------------------- |
| `GET /api/health`       | 后端综合健康(DB + Redis 探针) |
| `GET /api/health/live`  | Liveness                      |
| `GET /api/health/ready` | Readiness                     |
| `GET /health`           | AI 服务健康检查               |

---

## 安全设计

| 维度             | 实现                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------- |
| **认证**         | JWT HS256 + token-family 旋转(防盗用)+ refresh token 黑名单                           |
| **SSO**          | OAuth 2.0 + PKCE / Apple / Google / SSO 中转登录                                      |
| **限流**         | 全局 100/min,auth login/register 10/min,分层 rate-limit                               |
| **加密**         | AES-256-GCM 加密 credentials(OSS 驱动凭证 + 教育设置凭证 + 发布平台账号 + OAuth 私钥) |
| **密码**         | **argon2id 哈希(OWASP 2023 推荐,抗 GPU/ASIC)**+ bcrypt 透明升级 + 旧 SHA256 兼容      |
| **数据脱敏**     | password / passwordHash 字段在 API 响应中解构剥离                                     |
| **GDPR**         | 数据导出 / 删除 / 可携 / gdpr 路由                                                    |
| **敏感词**       | 敏感词过滤 + 内容审核 + admin-sensitive-words                                         |
| **审计日志**     | 登录日志 / 操作日志 / 系统操作日志 / 审计追溯                                         |
| **HMAC 链审计**  | 防篡改链式哈希日志(currentHash = HMAC(prevHash + ...)) + SIEM 导出(CEF/LEEF/JSON)     |
| **事务安全**     | DB 事务化:order 支付/退款 + social tag + gamification 积分 + chat 清空                |
| **行锁**         | `.for('update')` 行锁防 TOCTOU 竞态                                                   |
| **CSRF**         | `@fastify/csrf-protection` 双 token 模式                                              |
| **XSS**          | sanitizer 绕过检测脚本守门(pre-commit 第 6 项)                                        |
| **API key 泄露** | `check-api-key-leak.mjs` 守门(pre-commit 第 1 项)                                     |
| **RBAC**         | roleId >= 1 才能访问 admin 路由,plugin-level preHandler 统一鉴权 + data-scope 5 级    |
| **工作空间权限** | 3 模式 + 7 端点运行时拦截 + 60s 审计超时 + 1h 高风险自动撤销 + 首启确认弹窗           |
| **多租户**       | 租户隔离 + 组织 + 部门 + 菜单权限 + tenant-router + RLS                               |
| **OAuth 私钥**   | oauth-private-keys schema 加密存储                                                    |
| **2FA/MFA**      | TOTP RFC 6238 + 备份恢复码 + 设备指纹 + 信任设备管理                                  |
| **验证码**       | auth-codes + captcha schema + SVG 图形挑战 + 数学后备                                 |
| **mTLS**         | 双向证书认证(高敏感路由要求客户端证书)+ 路由级 CN 白名单                              |
| **零信任**       | 5 维度策略评估(身份/设备/网络/资源敏感度/时间窗)+ allow/deny/challenge 决策           |
| **网络分段**     | IP 分类(内网/公网/黑名单)+ 路由级访问策略 + CIDR 匹配                                 |
| **风控引擎**     | 5 维度风险评分(IP/设备/时间/频率/UA)+ 自动决策 allow/challenge/deny                   |
| **异常检测**     | 6 维度行为分析(频率/时间分布/地理/设备突变/扫描模式/基线)+ Welford 在线基线           |
| **反自动化**     | IP/用户双轨限流 + 扫描器模式即时封禁 + CAPTCHA 挑战 + 机器人 UA 检测                  |
| **IP 信誉**      | 黑名单 + TOR/代理/数据中心段识别 + 历史异常计数 + 30 天 TTL                           |
| **服务间认证**   | mTLS + 短期 JWT(5min)+ 服务白名单 + 常量时间比较防 timing attack                      |

### 国安级安全矩阵(2026-07-24 立)

E1-E5 五层防御体系,从密码学到运行时全链路防护:

| 层级            | 模块                         | 关键能力                                                                        | API 端点                                |
| --------------- | ---------------------------- | ------------------------------------------------------------------------------- | --------------------------------------- |
| **E1 密码学**   | argon2id + bcrypt 透明迁移   | OWASP 2023 推荐,抗 GPU/ASIC 爆破                                                | 内置(login/register/reset)              |
| **E2 MFA/设备** | TOTP + 设备指纹 + 风险评分   | RFC 6238 ±1 窗口 + Canvas/WebGL/UA/时区 hash + user_devices 表 + 登录 upsert    | `/api/mfa/*` + `/api/users/:id/devices` |
| **E3 审计链**   | HMAC-SHA256 链 + CEF/LEEF    | 防篡改链式哈希 + SIEM 三格式导出                                                | `/api/admin/audit-logs/*`               |
| **E4 零信任**   | mTLS + 网络分段 + 服务间认证 | 双向证书 + 5 维度策略评估 + CIDR 黑名单                                         | 插件级 + 路由级配置                     |
| **E5 反自动化** | 异常检测 + CAPTCHA + IP 信誉 | 6 维度行为评分(AnomalyDetector 中间件已激活)+ GeoIP 跨城市判断 + 扫描器即时封禁 | `/api/security/*`                       |

**CLI → 审计链的摄入通道**(2026-09-28 立,补 E3 的 CLI 半边):`POST /api/cli/audit/tool-invokes`(86A2,工具调用证据流水)与 `POST /api/cli/audit/tool-approvals`(86H,agent 审批决策 flag/approval/denial)共用同一个唯一写入器 `recordAuditLog` 落 `audit_logs_chain`(HMAC 链 + advisory lock),主体一律取令牌主体、请求体由 strict schema 拒任何自报身份(userId/user_id ⇒ 400 且零写入),且**入参原文不上线** —— 决策行只记 {sessionId, toolName, route, cause?}。

### 设备维度风控全链路(2026-08-02 立)

8 端同步设备指纹采集 + 后端设备维度封控闭环,激活 audit-logger / anomaly-detector / threat-detector 三模块的设备维度能力:

- **采集层**(8 端 adapter,零依赖自实现,仿 use-clipboard 工厂模式):
  - 契约层 `@ihui/types/device.ts`:`createDeviceFingerprintCollector` 工厂 + `DeviceFingerprintCollector` 接口 + FNV-1a 32 位 hash(4 段拼接 32 字符指纹,碰撞率 2^-32)
  - web/desktop/extension:Canvas + WebGL + UA + 时区 + 屏幕 + CPU 核心 + 设备内存
  - mobile-rn:`Platform.OS` + 设备信息
  - miniapp-taro:`Taro.getSystemInfoSync()`(brand/model/screen/language)
  - cli:`process.platform` + `os.cpus().length` + 自构造 UA
- **注入层**(`@ihui/api-client`):`setDeviceFingerprintProvider` + `injectDeviceFingerprintHeader` helper,5 处 fetchApi 变体(fetchApi/fetchText/fetchRaw/postApi/streamChat)自动注入 `x-device-fingerprint` header,fail-open(采集失败静默降级)
- **接收层**(`apps/api`):
  - audit-logger 读取 `x-device-fingerprint` header 记录到审计链
  - AnomalyDetector 插件(onRequest 钩子)调 `detectAnomaly`,block→403 / challenge→CAPTCHA / monitor→放行+日志
  - GeoIP 服务(MaxMind GeoLite2 + Haversine 距离 + IP 前两段降级)替换"IP 前两段变化"判断
- **存储层**(`packages/database`):`user_devices` 表(userId uuid + fingerprintHash + userAgent + ip + firstSeenAt + lastSeenAt + trusted + lastLocation),(userId, fingerprintHash) 唯一约束 + onConflictDoUpdate 幂等 upsert
- **路由层**(`apps/api`):
  - `GET /api/users/:id/devices` 改查 user_devices 表(替代 api_logs 聚合)
  - 登录成功 upsert 设备(从 x-device-fingerprint header 取指纹)
  - 黑名单 device 分支(`GET /api/admin/member/blacklist?type=device`)按 fingerprintHash 查 user_devices 富化返回

**Admin 安全仪表盘**(2026-07-24):3 个管理后台页面可视化安全态势:

- `/admin/security/threat-dashboard` — 国安级威胁监控(30s 自动刷新,统计卡 + 监控 IP + 最近封禁)
- `/admin/security/ip-reputation` — IP 信誉查询(评分 + 风险原因 + 手动封禁/解封)
- `/admin/security/anomalies` — 异常事件列表(IP/分数过滤 + 分页 + 维度详情展开)

---

## G:\ 根目录实时守门服务(2026-07-24 立;v2.0 白名单优先 2026-07-24 升级)

`FileSystemWatcher` 实时监控 G:\ 根目录,**v2.0 白名单优先模式** — 任何不在白名单且非系统目录的目录/文件创建后**约 110-222ms 内自动删除**,从被动清理升级为主动实时阻止,彻底消除 v1.0 黑名单模式的盲区(如 `guardian-test-allowed` 不在黑名单被保留)。

**组件**:

- [scripts/g-root-guardian.ps1](./scripts/g-root-guardian.ps1) — v2.0 实时监控脚本(allowlist-first + 黑名单 + 启发式 + .NET Directory.Delete 兜底 + 审计日志 + 1MB 日志轮转)
- [scripts/g-root-blacklist.json](./scripts/g-root-blacklist.json) — v2.0 配置(allowlist 15 目录 + blacklist 17 目录/23 文件/10 通配符 + heuristic 7 目录签名/14 文件签名 + systemProtected 8 系统目录)
- [scripts/install-g-root-guardian.ps1](./scripts/install-g-root-guardian.ps1) — 安装脚本(注册 Windows 计划任务,用户登录时自启,失败自动重启 999 次)
- [scripts/uninstall-g-root-guardian.ps1](./scripts/uninstall-g-root-guardian.ps1) — 卸载脚本(停止进程 + 删除计划任务)
- [scripts/g-root-guardian-status.ps1](./scripts/g-root-guardian-status.ps1) — 状态检查脚本(查询运行状态 + 显示最近日志 + 统计 BLOCKED/ALLOWED/ERROR)

**安装(开机自启)**:

```powershell
powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\install-g-root-guardian.ps1
```

**状态查询**:

```powershell
powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\g-root-guardian-status.ps1
```

**卸载**:

```powershell
powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\uninstall-g-root-guardian.ps1
```

**v2.0 白名单优先模式(5 层判定逻辑)**:

1. `systemProtected` → ALLOWED(系统目录,永不删除:`$RECYCLE.BIN` / `System Volume Information` / `Users` / `Windows` 等 8 个)
2. `allowlist` → ALLOWED(用户合法项目/工具:IHUI-AI / QoderCN / 微信web开发者工具 等 14 个 + `tools` 通配符)
3. `blacklist` → BLOCKED(已知垃圾:platforms / iconengines / Qt5*.dll 等 17 目录/23 文件/10 通配符)
4. `heuristic` → BLOCKED(垃圾特征签名:`guardian-test-*` / `test-*` / `tmp_*` / `search_*.ps1` 等 7 目录签名/14 文件签名)
5. 否则 → BLOCKED:unknown(未知项,删除)— **v2.0 核心改动,彻底消除 v1.0 盲区**

**实测验证(v2.0)**:guardian-test-allowed 114ms 删除 / platforms 110ms 删除 / unknown-random-dir-xyz 222ms 删除 / Qt5Core.dll 106ms 删除 / IHUI-AI 保留。

**日志**:`.ihui-agent/tmp/g-root-guardian.log`(1MB 自动轮转为 `.bak`,格式 `yyyy-MM-dd HH:mm:ss [BLOCKED|ALLOWED|ERROR|STARTED|STOPPED] <path> (<reason>)`)。

**根治意义**:从被动清理(`cleanup-external-junk.ps1`)→ v1.0 主动实时阻止(黑名单模式,有盲区)→ **v2.0 白名单优先**(allowlist-first,未知项也删除),用户无需干预,任何垃圾(已知或未知)创建的瞬间就被删除,等同于"不允许往这放垃圾文件夹"。

---

## 工程守门(56+10 pre-commit 项)

项目通过 56+10 pre-commit 项 + post-commit 自动 push + drizzle-kit push 模式 + 9 PowerShell 启动脚本杜绝协作事故:

详细清单见 [核心能力 E4 节](#e4-工程守门30-pre-commit--post-commit--11-迁移审计)。

| runner 项 | 接线点(实测)                                                                                        | 脚本                                    | 一句话                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —         | pre-commit-hook.js                                                                                  | `check-agent-engine-parity.mjs`         | Agent Engine 协议 parity 守门(P2-③/④,2026-09-18 立)。                                                                                                                                                                                                                                                                                                                                                                                                                     |
| —         | pre-commit-hook.js                                                                                  | `check-tool-registry-integrity.mjs`     | 工具注册表完整性守门(V3 #49,2026-09-26 立):工具可达面(本地注册 / 浏览器委托)↔ `_DELEGATE_ONLY_TOOLS` ↔ `_TOOL_ALIASES` 值域四面互咬。                                                                                                                                                                                                                                                                                                                                     |
| —         | pre-commit-hook.js                                                                                  | `check-tool-registry-integrity.mjs`     | **V3 #47a/b/c(2026-09-26)**:① J8–J10 引擎 14 个内置名 ↔ 能力桥 `engine_tool_bridge.py` 双向对账(缺条目 / 留旧条目都红)、声明的等价物必须真在 `_TOOL_HANDLERS`、无等价物必须带理由;② J11 `_TOOL_ALIASES` 在 `apps/ai-service/app` 内必须恰好一处定义(0 处也红);③ 授权归一 —— `unified_exec`/`run_code`/`apply_patch` 按等价物回查同一份高危名单 ⇒ 进审批门,且三条内核现在共用 `resolve_request_role_id` 一个角色出口 + `_ADMIN_ONLY_TOOLS` 一份名单,角色闸排在审批闸之前。 |
| —         | pre-commit-hook.js                                                                                  | `check-capability-matrix.mjs`           | 能力矩阵对账守门(V3 #57,2026-09-26 立):默认关 env 必须登记台账(`capability_matrix.py`,76 条),漏登即红。                                                                                                                                                                                                                                                                                                                                                                   |
| —         | package.json scripts + CI:8end-consistency-cert.yml                                                 | `check-agent-event-parity.mjs`          | 守门脚本: 跨端一致 —— Agent 事件、API 契约、样式 token 的三端对齐(H11 指标)                                                                                                                                                                                                                                                                                                                                                                                               |
| —         | pre-commit-hook.js + package.json scripts                                                           | `check-api-credential-prefix.mjs`       | 凭据前缀一致性守门(2026-09-13 立)。                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| —         | pre-commit-hook.js + package.json scripts                                                           | `check-auth-refresh-singleton.mjs`      | Guard: 客户端 auth refresh 必须走单一权威入口                                                                                                                                                                                                                                                                                                                                                                                                                             |
| —         | package.json scripts                                                                                | `check-button-text-wrap.mjs`            | button 文本换行 2 行 浏览器实测守门 (2026-07-28 立)                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 51        | guardian-runner.mjs + package.json scripts                                                          | `check-capability-catalog.mjs`          | 🧭 能力目录登记守门(产物一致性 / v1 端点必须接能力闸 / scope 语义)                                                                                                                                                                                                                                                                                                                                                                                                        |
| —         | pre-commit-hook.js + package.json scripts                                                           | `check-desktop-event-wiring.mjs`        | 守门脚本: 桌面端(Tauri)事件链路接线守门(2026-09-22 立)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 73        | guardian-runner.mjs                                                                                 | `check-direct-backend-calls.mjs`        | 🈲 端内绕过 @ihui/api-client 直连后端(blocking,裸 fetch/Taro.request 指向本仓后端即拦,存量走基线只减不增)                                                                                                                                                                                                                                                                                                                                                                 |
| 11e       | guardian-runner.mjs                                                                                 | `check-file-size.mjs`                   | 📏 单文件行数上限 (仅拦新增)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2e-dupns  | guardian-runner.mjs + CI:8end-consistency-cert.yml                                                  | `check-i18n-duplicate-namespaces.mjs`   | 🧬 i18n 重复命名空间/重复键(blocking,防 JSON last-wins 静默遮蔽)                                                                                                                                                                                                                                                                                                                                                                                                          |
| 87        | guardian-runner.mjs                                                                                 | `check-i18n-messages-exist.mjs`         | 🈳 语言包文件存在性与合法性对账(blocking,40 项清单,补装)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 46        | guardian-runner.mjs                                                                                 | `check-inline-back-button.mjs`          | 🔙 统一返回键防私接守门(禁页面私写 router.back/history.back)                                                                                                                                                                                                                                                                                                                                                                                                              |
| —         | package.json scripts                                                                                | `check-killer-parity-ends.mjs`          | 全端杀手锏常量同构守门(GAP-PLAN P3-11)。                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 33        | guardian-runner.mjs + package.json scripts + CI:llm-provider-schema-test.yml                        | `check-llm-provider-schema.mjs`         | 🛡️ LLM provider schema 守门 (blocking,阶段 3 主体已落地)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 49        | guardian-runner.mjs + package.json scripts + CI:ci.yml                                              | `check-migration-bookkeeping.mjs`       | 🧾 迁移记账守门(journal ↔ .sql 一一对应 / when 单调唯一)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| —         | package.json scripts + CI:db-from-zero-migrate.yml                                                  | `check-migration-from-zero.mjs`         | O18(2026-09-21):「空库重放整条 drizzle 迁移链」机械化防线。                                                                                                                                                                                                                                                                                                                                                                                                               |
| —         | pre-commit-hook.js                                                                                  | `check-miniapp-replace-antipattern.mjs` | miniapp-taro ICU 反模式静态扫描                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| —         | package.json scripts                                                                                | `check-mobile-rn-style-parity.mjs`      | mobile-rn 跨端样式一致性守门(2026-09-03 立)。                                                                                                                                                                                                                                                                                                                                                                                                                             |
| —         | package.json scripts + CI:nativewind-monitor.yml                                                    | `check-nativewind-status.mjs`           | NativeWind 升级就绪监控脚本                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| —         | package.json scripts                                                                                | `check-nav-dead-links.mjs`              | 侧边栏导航死链静态检查(2026-09-02)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 50        | guardian-runner.mjs                                                                                 | `check-next-env-dist.mjs`               | 🛡️ next-env.d.ts 构建污染守门(禁 .next-* 变体引用)                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 11g       | guardian-runner.mjs                                                                                 | `check-no-mask-image.mjs`               | 🚫 mask-image 渐变遮罩                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 11f       | guardian-runner.mjs                                                                                 | `check-no-native-dialog.mjs`            | 🚫 原生 alert/confirm/prompt 弹窗                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 68        | guardian-runner.mjs                                                                                 | `check-permission-mode-vocabulary.mjs`  | 🔐 权限模式词汇对账(blocking,跨语言注册表一致 + 消费点禁漂移)                                                                                                                                                                                                                                                                                                                                                                                                             |
| —         | package.json scripts                                                                                | `check-pkg-installable.mjs`             | 可安装性自检:证明一个 workspace 包 `npm pack` 出来的 tarball 真的能被外部装到并用。                                                                                                                                                                                                                                                                                                                                                                                       |
| —         | package.json scripts                                                                                | `check-popover-trigger-data-state.mjs`  | 自写 popover trigger data-state 守门(2026-09-02 立)                                                                                                                                                                                                                                                                                                                                                                                                                       |
| —         | pre-commit-hook.js                                                                                  | `check-portal-fixed.mjs`                | createPortal 定位守门 — portal div 必须显式 position: fixed(2026-09-07 立)。                                                                                                                                                                                                                                                                                                                                                                                              |
| —         | pre-commit-hook.js                                                                                  | `check-rn-global-css-sync.mjs`          | Guard: verify mobile-rn/global.css color vars                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 11b       | guardian-runner.mjs                                                                                 | `check-rounded-overflow.mjs`            | 📐 圆角溢出(父 rounded + 子 bg 贴边)                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 40        | guardian-runner.mjs                                                                                 | `check-shared-layer-duplication.mjs`    | 🔗 共享层重复检测(blocking,防端内重新实现 shared hook/util)                                                                                                                                                                                                                                                                                                                                                                                                               |
| —         | pre-commit-hook.js + package.json scripts                                                           | `check-site-footer.mjs`                 | SiteFooter 关键 class + namespace 守门                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 38        | guardian-runner.mjs                                                                                 | `check-solito-residue.mjs`              | 🛡️ solito 幽灵依赖回归守门(blocking,防 P0 优化被回退)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| —         | pre-commit-hook.js                                                                                  | `check-staged-files-count.mjs`          | Pre-commit 守门:staged 文件数预检(2026-07-30 立)。                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 30c       | guardian-runner.mjs                                                                                 | `check-stale-copy.mjs`                  | 🛡️ 陈旧副本守门(blocking,2026-09-14 338 快照事故配套,防 staged 区夹带历史版本回退)                                                                                                                                                                                                                                                                                                                                                                                        |
| —         | .husky/commit-msg                                                                                   | `check-style-verification.mjs`          | 样式改动强制验证守门(AGENTS.md 第 19 节)                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 11c       | guardian-runner.mjs                                                                                 | `check-tagsview-visual.mjs`             | 🏷️ 选中态描边定稿防回退(禁纯黑/纯白,全站)                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 34        | guardian-runner.mjs                                                                                 | `check-ts-ignore.mjs`                   | 🔍 @ts-ignore 新增检测(warn-only,防 215 处历史遗留复发)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 88        | guardian-runner.mjs                                                                                 | `check-ui-react-usage.mjs`              | 🧩 ui-react 组件复用对账(blocking,端内自实现 Dialog/Card/Form 提示,补装)                                                                                                                                                                                                                                                                                                                                                                                                  |
| 54        | guardian-runner.mjs                                                                                 | `check-uncommitted-age.mjs`             | ⏳ 未提交源码改动年龄守门(warn-only,B14 防工作树改动被并行 checkout 抹掉)                                                                                                                                                                                                                                                                                                                                                                                                 |
| 95        | guardian-runner.mjs                                                                                 | `check-watermark-syntax.mjs`            | 🔏 水印载荷/横幅行语法对账(blocking,零宽必须被注释包裹)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 37        | guardian-runner.mjs                                                                                 | `check-web-tokens-sync.mjs`             | 🎨 [web] design-tokens 同步(防 globals.css 漂移)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 74        | guardian-runner.mjs                                                                                 | `check-word-table-resolvable.mjs`       | 🈴 词表键五语言可解析(blocking,静态映射缺语言/小程序离线包过期即红;W5 落点债只告警)                                                                                                                                                                                                                                                                                                                                                                                       |
| 48        | guardian-runner.mjs                                                                                 | `check-workflow-step-order.mjs`         | 🧩 GitHub Actions 步骤顺序守门(setup-node cache:pnpm 必须在 pnpm/action-setup 之后)                                                                                                                                                                                                                                                                                                                                                                                       |
| —         | CI:i18n-dead-key-audit.yml(由 `scripts/tests/scan-web-dead-i18n-keys.test.mjs` 端到端跑其 `main()`) | `scan-web-dead-i18n-keys.mjs`           | web 端 i18n 死 key 审计器 — thin wrapper(2026-07-27 重构,真正实现在 `scripts/scan-dead-i18n-keys.mjs`)                                                                                                                                                                                                                                                                                                                                                                    |
| —         | CI:8end-consistency-cert.yml                                                                        | `check-design-tokens-sync.mjs`          | 统一 design-tokens 同步守门(P1-C + P1-F 合并)。                                                                                                                                                                                                                                                                                                                                                                                                                           |
| —         | CI:8end-consistency-cert.yml                                                                        | `check-i18n-parity.mjs`                 | 语言包叶子键 parity 检查:**目录写死为 `packages/i18n/messages/mobile-rn`**,以 `en.json` 为基准报每语言缺键/多键(无 docstring、无参数,"一句话"按代码逐行读得;要覆盖其他端须先参数化 dir)                                                                                                                                                                                                                                                                                   |
| —         | CI:knip.yml                                                                                         | `check-knip-ratchet.mjs`                | Knip 棘轮门禁(ratchet)。                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| —         | CI:style-spec.yml                                                                                   | `check-no-important.mjs`                | 样式规范守门 —— 禁止 !important(CSS 感知版)。                                                                                                                                                                                                                                                                                                                                                                                                                             |

> 这 48 道门**早就接在提交链 / CI 上,但 AGENTS.md 与 README.md 通篇没点过它们的名字** —— 后果不是"文档不好看",而是下一个人查不到它就又造一道同职责的门(本仓已四次为此补装车),或在守门报错时找不到该找谁。
> 下表「一句话」一律**取自该门自身头部 docstring 或 runner 的 label 字段**,不转述不美化;「接线点」按 `scripts/check-gate-wiring.mjs` 认定的五处权威口径**实测**得出(`.husky/pre-commit` 自 2026-09-22 起只是薄壳,真实 pre-commit 逻辑在 `scripts/lib/pre-commit-hook.js`)。

### 守门补登:已接线但文档从未点名的 48 道(2026-09-24 立,守门 89 的 R4 维度清零票)

**该段刻意不计红**:试过把它升成"新增流式调用点却一帧不承接即拦"的真判据,实测在 HEAD 产 13 处假阳
(`getStreamBaseUrl` 这类同族符号、纯注释、测试文件都会被算成调用点;连被当成线索的
`AiAssistantScreen.tsx:130` 也只是注释),一道与改动无关的恒红只会逼人 `--no-verify` 连带废掉全部守门。
命中图与归因图**共用同一次 `git grep`**,由镜像测试 ②b 钉死"各端文件并集逐帧等于命中集合",
杜绝"矩阵说已接、归因说没人接"的分歧。紧急跳过 `HUSKY_SKIP_SSE_DISPATCH_PARITY=1`。

| 端           | 仅此一面在接的帧                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| web          | `onQuestion` `onCitations` `onInjectionApplied` `onRetryScheduled` —— 全在 `use-chat/send-message.ts`       |
| extension    | 11 帧(含 `onCompaction` `onToolSummary` `onUsage` `onTerminalStart/End`)全在 `sidepanel/pages/ChatPage.tsx` |
| miniapp-taro | `onReasoning` `onCompaction` 只在 `src/api/index.ts`                                                        |
| mobile-rn    | 7 帧(含 `onBudget`)只在 `screens/AiAssistantN8nScreen.tsx`,主聊天屏 `ChatScreen` 不在其上                   |

`scripts/check-sse-dispatch-parity.mjs` 的矩阵按**端**聚合命中,所以"该端已覆盖某帧"看不出是
**哪块界面**接的 —— mobile-rn 的 `budget` 只在 N8n 助手屏注册过、主聊天屏仍一帧不接,矩阵上却与
"全端已接"同形。`--report` 现在在矩阵之后追加**帧名出现位置归因**:逐端列出每个命中文件接了哪些帧,
并用 `◇仅此面` 点名"全仓只有一处在接"的帧。实测(HEAD 口径):

### 守门 90 的归因面:覆盖矩阵之外,还得看得见"是谁在接"(2026-09-24 立)

### 新增守门示例:第 64 / 66 项「适配层未接线即拦」与「硬编码颜色基线」(2026-09-22)

`scripts/check-adapter-wiring.mjs`(第 64 项)要求 `apps/miniapp-taro/src/components/adapters/*.taro.tsx` 必须被适配层**目录之外**的源文件从 adapters 路径 import,否则阻塞提交;`scripts/adapter-style-parity-baseline.json` 同族的硬编码颜色门(第 66 项)此前**只挂在 `check:all`,从未进 pre-commit 链路**,本次一并注册。两者基线均**只减不增**,且共用 `stagedTriggers=['apps/miniapp-taro/src/components/adapters/']` 避免无关提交背成本。

**成因**:18 个适配器中有 9 个屏级文件(3078 行)从写下到删除始终零页面引用,而旧颜色门只守 hex/rgb、不守"是否被 import",所以"造好没装车"这类死代码无闸可挡。判据必须限定 import 的 specifier,否则端内同名自有组件(如 `components/NavBar.tsx`)会造成假阳性,把死适配器误判为已接线。

**同日三批清理合计移除 4662 行零引用死代码**(一批 9 屏 3078 + 二批 PayButton/TabBar/Toolbar 与端内孤儿 PayButton 953 + 三批 Carousel/NavBar/UserInfoCard 631),适配层降至 **3 个且全部已接线**,第 64 项基线清零为**零豁免硬门**。三批的判据是一条可复用教训:**同名 + 有消费点都不构成"重复",必须逐字段比 props 契约**——`Carousel` 端内独有的 `variant='course'` + `courseMeta`、`NavBar` 端内独有的 `notification` / `variant='ai-home'`,接适配器上去就是静默掉功能。

### 守门执行语义(2026-09-22 起:跑完再汇总)

`scripts/guardian-runner.mjs` 不再在首个 blocking 门失败时中止 —— 一轮跑完全部 96 项,末尾输出「失败门清单 + 每道门的单独复现命令」再 `exit(1)`。改造动因是实测而非审美:同一工作区实测真实存在 **5 道门在红**,旧 fail-fast 只报 1 道、遮蔽另外 4 道,还会让人误判"刚注册的门没生效"(注册成功但从未被执行过 ≠ 门失效)。

**两条保持不变的语义**:子门以 `exit 75` 退出仍**立即**向上传播 75(中断 ≠ 检查结论,push guard 据此决定带 hook 重试,不可收敛成 1);需要旧的快速失败时设 `GUARDIAN_STOP_ON_FIRST=1`。全绿路径耗时不变(原本就要跑完所有门),仅失败轮次变长。

---

### 新增守门示例:第 75 / 76 项「mobile-rn 深色前景容器对账」与「反回退对账」(2026-09-23)

**第 83 项 `check-brand-foreground.mjs`(blocking)**(原登记为第 75 项) —— RN 深色档案里 `tokens.brand.DEFAULT`
是**纯白**。它**可以**当主 CTA 的底,但必须与 `tokens.brand.foreground` **成对**(AGENTS §4,= web 的
`--color-primary` + `--color-primary-foreground`);配错前景就是白底白字。四条判据:
**R1** 同一 style 块内 brand.DEFAULT 作背景 × `surface.light`(两端恒白)或 `text.primary`(深色翻白)
作前景,零豁免;**R4** 同一对关系被拆到**兄弟 key**(`retryBtn` × `retryText`)时按命名配对判定
(实测 4 处黑压黑就是这样一路 shipped 到真机的),走基线棘轮;**R2** 拦"浅色当容器底":
`surface.light` 背景 / α≥0.5 的白 rgba / 无 `dark:` 变体的 `bg-white`,存量冻结在
`scripts/brand-foreground-baseline.json` 只减不增;**R3** 数 brand.DEFAULT 作填充/描边的行数,
但**不计 §4 认可的成对 CTA**(同块或兄弟键用了 brand.foreground)—— 删掉端内自立档之后按规矩写
就会红的话,这道门只是在逼人 `--no-verify`。无任何配对前景的白卡片照旧计,自检里用两条阳性对照钉住。
**内容口径**:全量审计与 `--update-baseline` 判 **HEAD blob**(`--staged` 判暂存)—— 共享工作树对
大量路径滞后 HEAD,按磁盘算会让这道门在恒红/假绿之间来回跳,并把错数写回基线。`--self-test` 含
是**纯白**,所以它只能当前景色用。同一个 style 块内它作背景、文字又取 `tokens.surface.light`
(两端恒白)或 `tokens.text.primary`(深色翻白),结果就是白底白字 —— R1 零豁免拦这一类。
R2 用基线棘轮拦"浅色当容器底":`surface.light` 背景 / α≥0.5 的白 rgba / 无 `dark:` 变体的
`bg-white`,13 文件 24 处合法存量(图片、视频上的浮层,以及自带 `dark:` 变体的文件)冻结在
`scripts/brand-foreground-baseline.json`,只减不增。`--self-test` 11 例;紧急跳过
`HUSKY_SKIP_BRAND_FOREGROUND=1`。

**第 83 项新增判据 R8「描边不得取墨档」(2026-09-26 立)** —— R1..R7 全在算"前景 vs 容器"的**配对**,
**描边取哪一档不在任何一条射程内**;而本门自己的修复提示当时还写着「`brand.DEFAULT` 只保留墨色、
**描边**、文字色三义」—— 散文把这一档列为描边的合法语义、判据又看不见描边,两边一起漏,所以
"纯黑描边"这一型能长期写而一路报绿。用户定的规矩是「本项目没有纯黑色的描边」。
禁四档 `brand.DEFAULT` / `brand.foreground` / `brand.ctaForeground` / `text.primary`,
出路只有既有的两条:中性 `border.medium` / `border.light`,强调 `brandAccent.deep` / `brandAccent.light`
(= web 的 `border-brand-accent-deep`,亮 `#4a7a96` / 暗 `#a3c4d6`)。
覆盖面两条:① RN style 面用 `border\w*:` 而不是 `borderColor:` —— 立门当场就抓到
`apps/mobile-rn/src/components/AiModelCard.tsx` 的 `borderBottomColor:` 拼法,而人工按 `borderColor:`
枚举时它是隐身的(判据比清扫清单更全,这就是证据);含 `border: \`1px solid ${…}\``模板串。
② 类名面只拦**满不透明**的`border-primary`/`ring-primary`(`border-primary/20`是染色、`border-primary-foreground` 是另一键,尾部字符类同时排除)。
与 R3 **互斥**:`brand.cta`作描边归 R3 计数面,再算一次就是同一笔债两道门各计、基线互相顶掉。
立门当日 HEAD 实测存量 **148 处**(RN 33 + web/小程序 115),全部并回上述两档后基线键`inkBorderCounts`置**空 = 零容忍**。豁免`border-ink-exempt: <原因>`必须带原因且逐行生效 ——
"上一行也算"的前提是它是纯注释行,否则代码行行尾的标记会把下一行一起救掉(自检 M7 抓出来的)。
类名面走`git grep -P`预筛,失效时退回全量并把`prefallback`旗标打在报告行里:该模式串含`(?!`,
一旦被 shell 历史展开成 `\!` 会让 git 直接 fatal,若把 stderr 吞掉,这台尺子就永久"零命中"而全绿
(本会话实测被骗过一次)。阳性对照:同一条预筛喂清扫前那枚提交得 101 文件、RN 面 3 文件,
喂 HEAD 得 1(且那一处在 e2e 的注释行里,被范围与注释两条规则同时排除)⇒ 分母摆出来才能区分
"债真清完了"与"门瞎了"。

**R8 覆盖面同日两次补(2026-09-26,现行口径以这条为准)** —— 上面那句"覆盖面两条"仍然不完整:同一条
"不得取墨档"的规矩按**书写形态**被切成三块,而 R8 起初只认前两块。① 类名面的端表沿用 R5 立项那张
(web / ui-react / miniapp-taro),`apps/extension` 同样写 Tailwind 类名却不在表里 ⇒ HEAD 面上真留着
一处 `border border-primary` 而门一路报绿;② 类名面扩展名里没有 `.css/.scss` ⇒ `border-color: var(--color-primary)`
这一整面**19 处**(全在 `apps/miniapp-taro/src/**.css`)加 1 处 TSX 内联字符串形态完全隐身。
现在 R8 判三种书写形态(RN style 对象 / Tailwind 类名 / CSS 声明),文件面**不再维护端名单**:
`R8_DIRS = ['apps','packages']` 整面取,只靠 `e2e|tests|__tests__` 与 `*.test/spec.*` 排除叙述行,
扩展名 `tsx|jsx|ts|js|css|scss`;20 处随同笔提交清零,基线键 `inkBorderCounts` 仍为**空 = 零容忍**。
**本票自己踩到的一条留在案**:第一次扩面时只改了 scope 判定,没改 `git ls-files` 的目录表,
于是整块改动静默失效而门照报绿 —— 抓到它靠的是"拿真仓 HEAD 喂新判据,它必须点名已知存量"这把
阳性对照(改完枚举面立刻从 `候选 0` 变成 `17 文件 / 20 处`)。规矩:**给守门扩面必须同批改两半**
(scope 函数 + 枚举/预筛的目录表与扩展名,两处引用同一张表),并把这件事写成镜像测试的源码形状锁
—— 行为断言会跟着实现一起漂绿,只有形状锁不会。

**第 84 项 `check-stale-revert.mjs`(blocking)**(原登记为第 76 项) —— 堵**共享工作区静默回滚**。§12d 的 converge

**第 84 项 `check-stale-revert.mjs`(blocking)**(原登记为第 76 项) —— 堵**共享工作区静默回滚**。§12d 的 converge **2026-09-24 补:性能护栏不再把门自己弄瞎** —— `MAX_FILES=300` 原是一超限就整门跳过,而共享工作区常年滞后数百文件,于是它恰在最需要的时候失明;现把"乘数级"路径(`guardian-runner.mjs` / 各道 `check-*.mjs` / `scripts/lib/` / `.husky/` / 根 `package.json` / `pnpm-*.yaml` / `.github/workflows/` / `scripts/tests/`)摘出护栏恒照判 —— 这类文件被写回旧版不表现为少一个功能,而是**一批守门静默失效**。镜像测试 `scripts/tests/check-stale-revert.test.mjs` 4 例钉死"顶过上限仍判红 + 真新编辑不判红"。
走 `merge-tree` / `commit-tree`,只推进 HEAD 与 index、**不 checkout**,于是工作区长期落后 HEAD
(2026-09-23 实测:503 个文件落后 486 个提交)。此时 `git add <file>` 交上去的是旧基线,对该文件
等价于把别人后续改动静默回滚,而 diff 看上去"只动了几行",人工 review 发现不了。判据 R1 =
暂存 blob != HEAD blob **且字节级等于该路径某个祖先提交的版本** → 拦截并点名它回到了哪个 commit
(真新编辑不可能恰好等于一个历史 blob,故误报极低)。三条护栏:merge / cherry-pick / revert 上下文
整轮豁免;暂存删除只 warn(`git rm` 是合法操作,而宿主层也会静默删文件 —— 两种情形机器分不开);
判定文件数 > 300 直接跳过(性能护栏,免得逼人 `--no-verify` 把全部守门一起关掉)。
取证:`--self-test` 8 例(含"把文件写回 v1 必判红"阳性对照)+ 临时 index 端到端演练 3/3
(造真回退 → exit 1 且点名 / 对齐 HEAD → exit 0 / runner blocking 清单含 76)。紧急跳过
`HUSKY_SKIP_STALE_REVERT_GUARD=1`;**确属有意回退请改用 `git revert` 生成前向提交**。

---

**守门 `check-c-drive-pollution.mjs`(warn-only;同日重排 5 次编号,以 runner 为准,故此处不写号)**(2026-09-23 立) —— 补的是**全链没有一道门看过文件系统**这个缺口。
第 45 项 `check-c-drive-paths.mjs` 只扫 staged 源码里的字面量 `C:\temp\`,而 C 盘残骸恰恰是从
`os.tmpdir()` / `$env:TEMP` 这类"源码里根本没写 C"的路径流出去的;`check-parent-pollution` 只扫项目父目录
(`D:\`),`check-root-dir-clean` 只扫项目根。三道门全绿的同一台机器上,C 盘实攒了 **13.2GB** 的 `.next`
构建备份(`build-next-prod.ps1` 的 `$BackupRoot` 曾写死 `C:\tmp`)和单日 **45 个** git 测试夹具。本门实地扫
`C:\` 根 + `C:\tmp` + `C:\temp` + 活 TEMP,按名字白名单**只认本项目产物**;认不出的条目进"未识别清单",
只登记、不定性、不清理(清理类任务的铁律:先验明身份)。自有特征里有一条
**"盘根单字母目录"** —— `C:\c` 是 MSYS 把 `/c/...` 当相对路径用的错位指纹,实测 08-06 一次就这样在 C 盘
套出 515MB(4 份 origin 浅克隆 + 一份错位的 npm 全局前缀)。另单独判一条 **TEMP 漂移** ——
注册表 `HKCU\Environment\TEMP` 已于 2026-09-23 改指 `D:\DevEnv\Temp`,但环境块只对**新启动的进程**生效,
活着的宿主仍持 `C:\Users\...\AppData\Local\Temp`,这就是"指针改完了、残骸照样天天长"的机制。
定级 warn 而非 blocking:盘根多数条目不属本仓,拦提交只会逼人 `--no-verify` 连带废掉全部守门
(与第 77/52 项同取向);本门**只读,永不删文件**,清理一律走 `scripts/c-drive-auto-maintain.ps1`
(同日修其三段:原扫 `C:\temp` 属**扫错目录**、`ForceDelete` 对单文件必然静默失败、`-DryRun` 必须拦在
`ForceDelete` 这个唯一删除出口上而不是某一段里)。取证:`--self-test` 19 例 + §22c 镜像测试 11 例。

**同日补:盘根"写歪项"封口改道 `scripts/seal-c-root-stray.mjs`(根治复发,而非再删一次)**。
本门能看见 `C:\common_attachment`、`C:\persistent_data`、`C:\tmp`、`C:\tools` 这几项,但**删不掉它们
所解决的问题**:它们是闭源第三方程序(剪映 / 微信输入法 / MSYS 侧工具 / 安装器)用相对路径写状态、
而进程工作目录恰好是 `C:\` 的产物 —— 删了下次照长。正解是把名字换成 **junction** 指向 §15b 落点
(`cache/c-root-stray/*`、`Temp/c-root-tmp`、`tools/c-root-tools`):程序按原路径读写完全不变,
内容落在 D 盘,C 盘 footprint 恒为 0。清单是单一真相源,守门与本门第 4 段(每天 03:00 体检,
封口被删就自动重封)都 **import 同一份**,不得在别处抄名字。本门据此判四态
`SEALED`/`BROKEN`(回潮,计残骸且 `--strict` 判红)/`ABSENT`/`FOREIGN`。
**头号危险不是没封住,而是被穿透**:实测 PowerShell 7 的 `Get-ChildItem -Recurse` 会穿过 junction
枚举到目标里的文件 ⇒ "按名字删 `C:\tmp\ihui-*`"会顺着链接清空 D 盘真实目标。故 `ForceDelete`
这条唯一删除出口对重解析点只 `[System.IO.Directory]::Delete($path,$false)` 断链,量体积遇 junction
一律不跟随(否则把 D 盘的量报成 C 盘的债)。取证:封口器 `--self-test` 11 例 + 镜像测试 7 例
(含两条装车证明:维护脚本必须真的调 `--check`+`--apply`;守门必须 import 而非自抄清单)。
**改道之后还要"看不见"**:junction 在资源管理器里与文件夹长得完全一样,所以 `--apply` 会按策略给
**链接本体**加 Hidden(用户 2026-09-24 选"设隐藏,保留改道")。这里有个能骗过自检的陷阱:
`attrib +h <junction>` 把 Hidden 设到**目标**那侧、链接不动,而 `attrib` 回显又顺着链接读目标 ⇒
打印 `H` 看着像成功(实测第一轮就这样,4 个名字照旧可见、反倒把 D 盘数据目录藏掉了)。正确设法是
PowerShell 提供器位或,**复核只能用父目录枚举** `Get-ChildItem <父> -Force`(Explorer 读的就是那份
目录项属性);隐藏不影响穿透读写,也不影响 `isSymbolicLink()` 判定。
**改名之后还要"看不见"**:junction 在资源管理器里与文件夹长得完全一样,所以 `--apply` 会按策略给
链接本体加 Hidden(用户 2026-09-24 拍板"设隐藏,保留改道")。这里有个足以骗过任何自检的陷阱:
`attrib +h <junction>` 把 Hidden 设到**目标**那侧、链接本体不动,而 `attrib` 回显又顺着链接读目标
⇒ 打印 `H` 看着像成功(实测第一轮就这样"隐藏了 4 次",C 盘名字照旧可见,D 盘数据目录反被藏)。
正确设法是 PowerShell 提供器位或,**复核只能用父目录枚举**(`Get-ChildItem <父> -Force`,即 Explorer
读的那份目录项属性)。隐藏不影响穿透读写,也不影响 `isSymbolicLink()` 判定。
本门另报一条 **页面文件"待重启生效"哨兵**:比对注册表 `PagingFiles` 的配置上限与 WMI
`Win32_PageFileUsage.AllocatedBaseSize` 的已分配大小,落差 >512MB 且 >25% 就点名"下次重启才释放"
(2026-09-24 把本机 `C:\pagefile.sys` 从手设 32768MB 压到 2048MB;磁盘上旧大小必须重启才收缩,
而本机是生产机 ⇒ 重启时机归用户,所以哨兵必须替人记着这件事)。量这一步的三连坑全部
**不报错、只给假绿**:`fs.statSync` 对 `pagefile.sys` 必报 `EINVAL`(打不开句柄)、
`cmd /c for %A in (...) do %~zA` 被"Node 加引号 + cmd 剥首尾引号"的双层规则打掉、属性名写成
MSDN 文档的 `AllocBaseSize`(本机真名 `AllocatedBaseSize`)会被 PowerShell 静默渲染成空串。
因此本门的口径是:**一条都没量到时打印「未判定」,绝不写成「一致」**——第一版就把它写成了
「配置与磁盘一致(合计 0 GB)」,正是本仓反复在防的那类假绿灯。
**编号一天撞四次 + 一次卸闸的实录**(比门本身更值钱):85(与 `check-test-paths` 撞)→ 90(与
`check-sse-dispatch-parity` 撞)→ 91(与 `check-error-code-coverage` 撞)→ 92 **又**撞一次 ——
最后一次不是没查:取 92 时它确实在 91,是别的会话随后把 `errorCode` 重排到 92、把重复号带进了
`origin/main`。⇒ **"提交前查一次占用"在高并发仓里挡不住别人事后挪号**,唯一可靠的是让 runner 自己说话:
本门镜像测试按"反查本门 id + 全 runner 任何 id 不得出现两次 + 三道邻门注册块必须存在"写,
第 3、4 次撞号都是它当场红出来的；本门编号此后仍在漂移，现值以 runner 为准。另一次更严重：改 90 时整文件提交 `guardian-runner.mjs`
把别人刚装上的门**注册块直接覆盖**(提交 `5db08f26e`)—— 撞号只是重名,覆盖却是替别人卸闸,已按原文回插。
两条规矩:① 改共享注册文件必须逐块核对 `git show <commit> -- <f> | grep '^[-+].*(id:|script:|label:)'`;
② **判据要能让机器自己发现撞号**,不要依赖人记得去查。
**守门 `check-home-junctions.mjs`(blocking;编号同日在变动,以 runner 为准)**(2026-09-24 立) ——

**守门 `check-home-junctions.mjs`(warn;编号与落点均以 `scripts/guardian-runner.mjs` 现值为准 —— 本行曾写 blocking,那是 08e837750c 改判 warn 之后又被一次「整文件旧基线回写」盖掉的痕迹,2026-09-24 已按原决定复位并逐字回插目的注释)**(2026-09-24 立) ——
把 AGENTS.md §26 的"家目录工具态一律 junction 改道"从**人肉三条命令**变成机器看守。起因是用户追问
"C 盘怎么还是被我们占用了":`AppData\Roaming\npm` 已长成 **2.05GB**、`AppData\Local\pnpm-cache` **758MB**,
两处都是实体目录,而同期的 `~\.ihui` 与桌面端 appdata 早已是 junction ⇒ **改道机制本身有效,缺的是回潮哨兵**。
判三条:存在却不是指针 = `REAL-DIR`(且必须量出体积,否则报告是"合计约 0 MB"的假小量级);
指针目标不可达 = `DANGLING`(§26 记过 `robocopy rc=9` 会"内容已搬走却不建 junction",反向同理);
登记表被过滤空 = `EMPTY-REGISTRY`(空表 = 恒绿的假门,与守门 78 同取向)。非 Windows 如实报"未判定",不计通过。
**第三方 IDE 自管态(`.workbuddy`、`.qoder-cn`)刻意不登记**,并由镜像测试反向钉死 —— 挪 `.qoder-cn` 等于丢记忆。
同日两处已按机制收口(逐文件字节校验 + 经 junction 回读一致才删源),C 盘可用 44G → 45.75G。
取证:`--self-test` 6 例 + 镜像测试 5 例(`node --test scripts/tests/check-home-junctions.test.mjs`,
含装车证明与"夹具必须活到断言之后" —— 本仓当天就是先踩了注册期清理导致整套 fixture 断言对着空气判定)。
紧急跳过 `HUSKY_SKIP_HOME_JUNCTIONS=1`。

---

### 新增守门示例:第 79 项「提交内容含 Git 冲突标记」(2026-09-23)

**第 79 项 `check-no-conflict-markers.mjs`(blocking)** —— 补的是一个**已经漏过一次**的缺口。
2026-09-23 15:49 本机 `.git` 被宿主清除,恢复期间某个会话在共享工作区里跑了真实 `git merge`,
留下 103 个未合并路径、94 个工作区文件带字面冲突标记;而当时全链 100+ 道守门里**没有任何一道**
检查"将被提交的内容含冲突标记",于是 `apps/cli/tests/file-edit.test.ts` 带着 `<<<<<<<` 一路
被提交进 HEAD 树,直到整轮 merge 结束都没被任何门发现 —— 这类缺陷本地 typecheck/lint/单测全绿
也看不见,因为没有人看字节。

判据(硬要求):**同一文件内成对**出现行首 `<<<<<<< ` 与行首 `>>>>>>> `(中间允许夹整行
`=======`)才算违规。**强制成对**不是为了宽松,而是为了不误伤:单行 `=======` 在 Markdown
setext 标题下划线、表格分隔、ASCII 示意图里都是合法内容,只判单行会满天假红(实测全仓
`^=======$` 命中数远多于成对命中)。未配对的孤立标记**不计红但如实报数** —— "只剩一半"通常
正是"手删三行标记当作已解决"的现场,而这恰是本门要禁掉的动作。

三种取材面:

| 模式                   | 判什么                                                                        | 为什么                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `--staged`(pre-commit) | 只判**索引**内容(`git show :<path>`,取不到退回工作区),路径清单含 `U` 未合并态 | 真正会被提交的是索引不是磁盘;merge 冲突时 git 把该文件标为 unmerged,只按 `ACMR` 过滤会恰好漏掉本门要拦的那一类 |
| 缺省(全量审计)         | 所有 **git 跟踪文件的工作区内容**(`git ls-files`,实测 16561 候选 / 1.5s)      | 未跟踪内容不会被提交,拦它只会逼人 `--no-verify` 连带关掉全部守门                                               |
| `--rev <sha\|HEAD>`    | 某个**提交树**(`git grep -Ilz` 定位候选 + 逐个 blob 复核成对)                 | 事后核验"当时到底有没有把标记带进版本树",也是本门 self-test 的取证面                                           |

护栏:自豁免(本门脚本与其测试必然含这些字面量,按文件名前缀跳过)、单文件 >2MB、二进制
(前 8KB 含 NUL)三类**全部在输出里如实计数**,不静默吞掉;git 可执行文件走候选解析
(`scripts/lib/gitdir.mjs` 的 `resolveGitBin`),解析不到按脚本自身异常 `exit 2` —— 判据失效
绝不等同于通过。退出码 0 通过 / 1 检出 / 2 异常。

取证:`--self-test` 23 例(含正反成对对照 + 真实 merge 未合并路径现场:成对标记判红、单行 `=======` 判绿、索引脏而磁盘已修
仍判红、仅磁盘脏不影响本次提交、`--rev` 与后续提交隔离、自豁免/大文件/二进制只计数)+
§22c 镜像测试 11 例(`node --test scripts/tests/check-no-conflict-markers.test.mjs`)。
修复口径:**用 `git checkout --ours/--theirs <文件>` 取一侧真实内容,或按 AGENTS.md §12b
协作收尾重新归并**;禁止只手删标记。紧急跳过 `HUSKY_SKIP_CONFLICT_MARKERS=1`。

### 新增守门示例:第 81 项「品牌邮件通道对账」(2026-09-23)

**第 81 项 `check-brand-email-channel.mjs`(blocking)** —— 拦的是"**本地全绿、用户收到的邮件却没样式**"这一类。邮件"版式模板"只存在于 `apps/api/src/services/email-templates.ts`(`renderSystemAlertEmail` 等机械风"智汇通报"),但 ops 侧曾存在**第二条绕过模板的自发通道**:`deploy/win/ihui-deploy.ps1` 自拼传输层 —— `Send-MailMessage -Body $text`(无 `-BodyAsHtml`)与 `Invoke-RestMethod https://api.resend.com/emails`(payload 只有 `text`、无 `html`)直发纯文本。这类代码"能发出去、typecheck 全绿、lint 全绿",而全链守门没有一道看得见,与守门 72/78 同族。本门立项实测有一个有价值的副产品:全量审计在 ps1 被并行会话清干净之后,又揪出了**第三条绕过模板的纯文本通道** `scripts/check-credential-health.mjs`(`host`+`path` 分行直连 Resend、body 只有 `text`)—— 它**已于同日迁到同一条派发器**,基线 `scripts/brand-email-channel-baseline.json` 的 `counts` 实测清零(未用 `brand-mail-exempt:` 豁免糊过去),这正是"判据不只要拦回归、还要暴露现状"的样例。

扫描范围刻意收窄:`deploy/**` 与 `scripts/**`(**不含** `scripts/tests`)下的 `.ps1`/`.mjs`/`.js`/`.ts`,加 `.github/workflows/*.yml`;`apps/**` 不扫 —— 运行时服务层本就 import 模板,天然放过。三条判据:

| 规则 | 红条件                                                                                                                           | 认可的修法形态                                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| R1   | PowerShell `Send-MailMessage` 调用语句(**含反引号续行**)缺 `-BodyAsHtml`                                                         | 补 `-BodyAsHtml`,或走豁免/品牌层                          |
| R2   | 出现 `api.resend.com/emails`(**含 host+path 分行形态**)而同一发送上下文(命中行前 12 / 后 6 行)看不到 `html` 字段                 | `html:`、`'html'`、PS `@{ … html = … }`、Python `"html":` |
| R3   | 文件有"发信动作"(`createTransport`/`sendMail`/`api.resend.com`)却**既不引用 `email-templates` 也不调用 `notify-deploy-failure`** | 接入品牌层(每文件至多一条,保守)                           |

判据保守(宁漏不误报,与本仓守门一致取向):注释行不判;裸域名(140 字符内无 `/emails`,如 TLS 连通性探测)不判;窗口外孤立的 `html` 不构成豁免。豁免与存量机制对齐仓库既有风格:命中行或紧邻上行写 `brand-mail-exempt: <一句话原因>`;存量红进 `scripts/brand-email-channel-baseline.json`(key=`<path>#<rule>` → 容忍条数,**只减不增**棘轮,仅超出部分判红;某 key 实发归零时输出"基线余量"提醒下调)。

三种取材面:`--staged`(pre-commit:只判**索引里在范围内**的文件;暂存集为空/取不到 → **退化全量**,防"空暂存恒绿"——守门 70 的既有教训)/ 缺省(全量:跟踪文件工作区内容,建门实测 368 个在范围文件)/ `--self-test`(判据正反成对对照 + 临时仓对 staged/全量两种取材面取证)。退出码 0 通过 / 1 检出未基线化违规 / 2 脚本自身异常(git 解析失败、基线 JSON 损坏 —— 判据失效绝不静默放行)。

**R4 告警接收面(2026-09-24 补)**:`monitoring/alertmanager/**` 的 `.yml/.yaml/.tmpl` 里出现 `email_configs` / `smtp_*`(Alertmanager 原生邮件发的是**无版式纯文本** —— 正是"邮件没有样式"投诉的那一型)、IM 中转 receiver(`dingtalk`/`feishu`/`wechat`/`wecom` 的名字或 `qyapi.`/`oapi.`/`open.feishu` 等 host 特征,改名躲不过)、或 `webhook_configs` 的 url 不等于 bridge 那条,一律提交时点名到行。它补的是"跑渲染才红"到"改了提交就红"的落差:渲染器 `assertBridgeOnlySurface` 已做同一结构对账,但那是人工动作。面**刻意不扩到全仓 yml**(根 compose / prometheus / loki 的历史注释里就写着 `dingtalk-webhook`,全扫必假红),注释行不计红但 `amCommentLiterals` 如实计数。**改前/改后判定文件数 431 → 434(+3 = 那三份 AM 配置),反空转锚是 `amCommentLiterals=2` 这一非零计数**(面被摘掉它就归零,不靠"行数看着像"自证 —— 守门 52 的教训)。

**修法的唯一正确姿势**:PowerShell / CI / 脚本侧发信一律改调 `apps/api/scripts/notify-deploy-failure.ts`(版式由 `email-templates.ts` 单点决定),不得在端内自拼传输层;确需新版式就在 `email-templates.ts` 加 `render*` 函数。取证:§22c 镜像测试(`node --test scripts/tests/check-brand-email-channel.test.mjs`,含**装车证明**:runner 中 id `'81'` 必须出现恰好一次 + blocking + `skipEnv: 'HUSKY_SKIP_BRAND_MAIL_GUARD'`)。紧急跳过 `HUSKY_SKIP_BRAND_MAIL_GUARD=1`。

**扩面与第二个"半装车"教训(2026-09-24)**:本门原判据只扫 `deploy/**` + `scripts/**`,而"告警邮件正文"的实际出口在 `monitoring/alertbridge/*.cjs` —— 目录不在面内、`.cjs` 扩展名也不在面内,**双重不可见**。现按实测数字扩到含 `monitoring/**` + `.cjs/.mts` + `apps/api/scripts/**`(判定 **375 → 427**,新增命中 0);`packages/**`(+714,唯一命中是 `api-client` 里 POST 自家 `/api/mail/send` 的 `sendMail()`)与 `apps/**` 整体(+3380,命中全是管理员 SMTP 试测端点)**用同一把尺量过之后决定不扩** —— 无证据不扩面,否则第一次真红就是最后一次信任。扩面同时补了原判据的一个空档:R1/R2/R3 只看"有没有走模板",对"**接了唯一出口却自带一份 HTML 版式**"完全盲(与守门 52"恒报 0 其实是扫不到"同型),新增 **R3b** 三段与门(邮件版式标记 ∧ ±10 行内样式指纹 ∧ 本文件确在邮件语境,注释行不计),自检 46 例含四类反例。**另一半才是重点**:判据扩面了而 `stagedTriggers` 没跟上,则"只改 bridge 的提交"在 pre-commit 根本不会唤起本门 —— 半装车,由镜像测试的"装车证明"钉死(触发清单必须含 `monitoring/` 与 `apps/api/scripts/`)。

### 同日后续:邮件/告警链的三面收口(2026-09-23,O29)

守门 81 立项后顺带把同族的三面一起收口,它们的共同点是"**本地全绿、线上要么没样式要么根本没发**":

1. **运维告警邮件统一出口 = `apps/api/scripts/notify-deploy-failure.ts`**。它已从"CI 专用一次性脚本"扩为通用品牌告警派发器(`--to`/`--title`/`--severity`/`--source`/`--message-file`/`--plain`/`--strict`/`--dry-run`,自动回读 `apps/api/.env` 且**只补缺失、绝不覆盖进程环境变量**;SMTP 优先、Resend 兜底且 payload 必带 `html`)。三个调用方全部改接它:本机 NSSM 部署环 `deploy/win/ihui-deploy.ps1`(删除自拼传输层,降级也只能走同一条通道的 `--plain`)、CI 蓝绿部署、以及凭据巡检 `scripts/check-credential-health.mjs`。**两个实测坑已钉进注释与测试**:① tsx v4 会劫持 `--env-file` 转发给 node,路径不存在时 node 直接 `exit 9` ⇒ 调用方一律不传;② 经 `smtp.qq.com` 中继时 From 的邮箱段必须等于登录账号,否则 550(旧代码硬编码 `IHUI-AI@aizhs.top` 配 QQ 账号 ⇒ SMTP 分支恒被拒、恒回落纯文本 Resend,这正是"邮件没样式"的直接成因)。
2. **`/api/mail/send` 不再手搓 HTML**,改走 `renderNoticeEmail`;两端点各加 `10 次/分钟/IP` 限流(`/api/mail/*` 公开无鉴权是既定的 Java 兼容契约,故用限流而非鉴权收面)。
3. **"邮件通道没开"从隐形变响铃**。`apps/api/.env` 缺 `SMTP_ENABLED` 一行 ⇒ 默认 false ⇒ 所有国内域名(qq/163/126/…)的验证码/账单/退款等事务邮件路由到 `'stub'` 且旧代码只 `console.info` 一行、调用方不查 `result.sent`。现改为 `logger.warn` **点名缺哪条配置** + `EmailNotSentReason` 精确联合类型 + `diagnoseMailTransport()`(国内与海外双路皆死时启动期打一行全局 warn);`broadcast-email-service` 的 `sent` 也从"按 `allSettled` fulfilled 计"改为按 `result.sent` 真计(原先群发会报"全部送达"而实际 0 封)。**是否打开 `SMTP_ENABLED` 属生产对外行为变更,由用户拍板,本仓默认仍关。**

另两处同期根治:**Alertmanager 邮件通道**——实测 Alertmanager **不展开**配置里的 `${VAR}`(写 `${X}` 直接 `not a valid duration`),所以"占位符 + 注释说需 env 注入"的旧配置文件永远发不出信;现改为 `alertmanager.yml.tmpl` + `scripts/render-alertmanager-config.mjs` **先渲染再挂载**,TLS 形态由端口推导、发信账号单占位符同时喂 from/username、密码优先走 `smtp_auth_password_file` 以做到零落盘,渲染产物含凭据故被 `.gitignore` 钉住且渲染器写盘前先 `git check-ignore` 自证。**`POST /v1/messages` 全族**——出站体与 ai-service 的 pydantic 模型三处不齐、且上游每个端点都套 `{code,message,data}` 壳而转发层按裸 JSON 读 ⇒ `messageId` 恒空、`HTTP 200 + code=500` 被当成功、`subscribe` 更是**静默建了一条没有回调地址的死订阅**(不 422);现全部显式映射 + 拆壳,`channel` 收紧为枚举(值域从 `.py` 源码解析做跨语言对账),并把原来挂在**生产从不存在的 `prefix:'/v1'`** 上的假绿用例改到真实挂载点。

### 运维告警链路收口:bridge = 邮件单通道 + SQLi 子串误杀修复(O29 续,2026-09-24 定稿)

- **基础设施告警到人 = 邮件唯一通道**:`monitoring/alertbridge/alert-webhook-bridge.cjs` 曾长期只有第三方推送腿、零邮件出口(O29 补上邮件并行腿后,2026-09-24 将推送腿**整体摘除**,AGENTS.md §5e)。现行为:正文一律经 ops 唯一出口 `apps/api/scripts/notify-deploy-failure.ts`(即 `renderSystemAlertEmail`),零手抄版式;**只按身份去重**(alertname+instance 在 `BRIDGE_DEDUP_MIN` 窗口内一封,`partitionAlerts()` 单一状态源),**无任何每日预算/计数闸** —— 旧的"每日 N 封"自保是为第三方配额设的,自有 SMTP 上它只会复刻"告警静默"。派发器用**异步 `spawn` + `windowsHide`**(同步会把 tsx 冷启 + SMTP 握手几十秒钉在事件循环上 —— 与守门 80 那起 80 分钟挂起同型)。`BRIDGE_MAIL_ENABLED=0` 关的是"要不要发",不是"发几封"。
- **投递失败必须响(假成功类缺陷的终结)**:推送腿时代"2xx + 非 JSON/缺成功字段也记成功"的判据缺陷(错误 key 被拒时恰回这种形态 ⇒ 发不出去却记"已推送")随该腿一并移除;邮件是唯一通道后,品牌模板与 `--plain` 降级两条都失败 ⇒ 写 `alert-bridge-mail-UNDELIVERED.json` 标记 + `[mail][ERROR]` 日志 + `/health` 报 `mailUndelivered=true`,下一次成功投递自动清除。去重状态在回响应前**同步落盘**,跨进程重启延续(修掉"重启后同一条告警重寄"的实测缺陷)。
- **全站 SQLi 子串误杀已修**:`InputValidator.checkSqlInjection` = "含 `' \" ;` ∧ 关键字**子串**",于是 `IHUI-CORE`(含 `OR`)、`brand`/`Android`(含 `AND`)、`SETTINGS`/`ASSET`(含 `SET`)这类正常词只要带分号就 400 —— 实测一封正常品牌邮件正文被拦,**信根本发不出去**。现关键字侧改为词边界 + 注入结构签名(12 条),字符门一字未放宽:同一批样例旧判误杀 **12/16** → 新判 **0/16**,20 条真载荷 **0 漏放**且**多拦 3 条**(时间盲注、存储过程)。旧死判据连同其关键字表已从 `security-service.ts` 删除,不留"一被调就重演误杀"的后门。非 AI 路径刻意**不**加 `--` 注释符特征:纯文本邮件的签名分隔符就是裸 `-- `(RFC 3676)。
- **源-运行分裂收口**:`deploy/prod-bundle/alert-webhook-bridge.cjs` 手工副本已落后 11 天且藏真缺陷(去重命中时 `return { skipped: toDedupCount }` 抛 ReferenceError ⇒ 对 Alertmanager 回 500)。现改为**转发器**(`require` 入库源码,路径由 `__dirname` 推导)—— 复制只能修今天,转发器让"改源码忘同步"在结构上不存在。
- 取证:bridge `--self-test` **47/47**(入库源码与转发器分别跑同一份代码各 47/47,含去重跨重启正反对照、无总量封顶、失败必留痕三组新用例)、`apps/api/tests/sqli-guard.test.ts` **44 passed** 且邻接 `csrf / mail-routes / prompt-injection-guard` 同跑 **102 passed**、守门 81 全量 0 违规、守门 52/80 全量 0 违规、水印 verify 完整。

### 运维到人 = 邮件单通道:第三方微信推送腿整体摘除(2026-09-24,O46)

用户侧的起因很具体:**"部署失败的邮件怎么还是没有我们自己设计的模板样式"**。追下去发现不是模板坏了,而是**到人链路上并行跑着四条通道**,其中三条压根不发邮件:

| 生产者                                                             | 旧形态                                                           | 现状                                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `deploy/win/ihui-deploy.ps1`(部署环)                               | 在 PowerShell 里自拼 SMTP/Resend 纯文本                          | 只调派发器,版式回到单点                                       |
| `monitoring/alertbridge/alert-webhook-bridge.cjs`(Alertmanager→人) | 纯微信单通道,零邮件出口                                          | 邮件为唯一出口                                                |
| `scripts/check-credential-health.mjs`(凭据巡检)                    | 第三条绕过模板的纯文本 Resend                                    | 同一条派发器                                                  |
| `deploy/prod-bundle/monitor.ps1`(IHUI-MONITOR 5 分钟巡检)          | **仓库里根本没有入库源**,内联第三方推送凭据 + 三条纯文本推送通道 | 真身迁到 `deploy/win/ihui-monitor.ps1`,运行副本改 28 行转发壳 |

三条决定性的实测事实,决定了这是"摘除"而不是"再加一条兜底":① 该第三方推送**免费额度 5 条/天**,`monitor-alerts.log` 里累计 **55338 行推送失败**,尾部一条是 `code=471「超过当天的发送次数限制[5]」`——即它期间判出的 `api(8802) 未监听`、公网 500/502 **一封都没到人**,通道看着在、实际是哑的;② 自建 SMTP 没有他人配额,所以**"每日 N 封"封顶全部删除**(自设总量闸等于把"告警静默"再复制一遍),限制只按**告警身份**去重(默认 4h 重发同一条,压重复不压新故障);③ 寄不出去从此**必须响** —— 两条通道都失败即写 `*-UNDELIVERED.json` + 日志吼 + `/health` 可见,下一次成功自动清除。

顺带修掉两个只有走到这一步才会暴露的既有缺陷:`monitor.ps1` 的 `$buildLogDir` 指向一个从不存在的路径,导致"最近构建于…"这条原因诊断**恒死**(现与 `scripts/build-next-prod.ps1` 的 `$LogDir` 同址并回退部署环日志);以及它把 `cdn(80) 未监听` 当故障——本机公网入口是 **token 模式的 Cloudflared**(outbound 长连接,从不在 80 监听),这条是拓扑层面的恒真误报,过去无人看见只因为唯一通道是哑的;邮件腿一通它就会每 4 小时寄一封真信报警一个不存在的故障,故改为查 `Get-Service Cloudflared` 服务态。**教训已写进 AGENTS.md §5e**:审计"某通道是否摘干净"必须按`nssm get <svc> AppParameters` → 那份文件取径,按 `git ls-files` 做 grep 会整体漏掉 gitignore 目录里没有入库源的运行副本。

取证:bridge `--self-test` 47/47(含去重跨重启正反例)、`check-credential-health --self-test` 33/33、守门 81 全量判定 427 文件 0 违规、`apps/api` 派发器与部署不变量测试 43 passed、PS 5.1/7 双解析器 0 错、`-ProbeMail` 真发一封并在日志留下 `MAIL 已送达 … (品牌模板)`(收信人=值班本人,标题带【核验信】)。两个服务(`ihui-alert-bridge`、`IHUI-MONITOR`)已于本票重启并回读加载证据;`IHUI-DEPLOYLOOP` 每轮重新拉起 `ihui-deploy.ps1`,实测无需重启即已跑上新逻辑。

### 工作区存续自愈(`scripts/heal-worktree-tracked.mjs`,2026-09-23)

守门只能"拦住",这一层负责"补回来"。本机宿主清理层会**成批删除工作区里的已跟踪目录**——实测同一天三轮:137 个 → 27 个 → 1 个,命中 `tests/`、`__tests__/` 整目录与安装器位图资源。缺失只体现为 `git status` 一片 ` D`,而**下一次提交就会把这些文件从版本树里删掉**,等价于一次静默回滚。`.git` 指针、真 gitdir、嵌套 ref 早有 `git-guardian` 分层自愈,工作区文件存续性此前是空白。

判据三条同时成立才恢复:① 工作区缺该文件;② **索引 blob == HEAD blob**(说明没人对它暂存过任何改动,包括 `git rm` 的暂存删除);③ HEAD 中该路径存在。因此被恢复的内容按定义**零独有数据**;他人已在索引里登记的删除只报数、不代裁。触发点挂在 `git-guardian` 巡检的**健康轮次早退之前** —— 计划任务实际执行的是 `main()` 单轮(`startDaemon` 未启用),挂错位置等于永不执行;`--check` 口径保持零副作用。

故障演练实测:删除 `scripts/brand-foreground-baseline.json` → 跑一轮守护 → 文件自动找回,并留下审计行 `✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件`;`--self-test` 5 例含反向对照"他人暂存的删除不被插手"。手动:`node scripts/heal-worktree-tracked.mjs [--dry-run|--json|--self-test]`;跳过 `IHUI_SKIP_WORKTREE_HEAL=1`。

## 🛡️ Commit 丢失防护(AGENTS.md §22 强化,2026-07-26)

多 agent 并行环境下,`git reset HEAD~` 可能把整个 commit 链一并丢弃(2026-07-25 真实事故:丢失 3 个 commit)。本项目建立 4 道防护:

1. **pre-commit blocking 检查**(第 30a 项):`scripts/check-commit-loss-guard.mjs --blocking --filter-stash`
   - reflog 最近 50 步 reset 检测
   - fsck 悬空 commit 检测 + tag 备份核对
   - 远程 tag 完整性(对比 origin)
   - tag 对象可达性(annotated tag 的 commit object)
2. **post-commit 自动 tag 同步**:`scripts/sync-lost-commit-tags.mjs --auto-push`
   - commit 后立即 push 所有 `lost-commit/*` + `backup/*` tag 到 origin
   - 防止本地 git gc 清理后无远端备份
3. **手动恢复**:`pnpm tag:sync:fetch` 从 origin 拉回所有 lost-commit/backup tag
4. **完整档案**:`docs/lost-commit-archive.md` 永久记录每个 lost commit 的 hash / subject / 改动文件 / 重做 commit / tag 状态

**触发背景**:2026-07-25 reflog 记录 6 次 `git reset HEAD~` 丢失 3 个 commit(15b984f90 P0 安全债 + 5ef36e59d / b120c6e20 sidebar 折叠按钮 x2);2026-07-26 本地 tag 被 git gc 清理事故。

---

## 工程质量证据(反驳"AI 生成代码三通病")

> **为什么写这一段**:有外部 AI 评测在未审阅代码的情况下,基于"AI 生成项目的普遍特征"猜测本项目存在三个通病——① 代码冗余度高 ② 边界条件处理不足 ③ 深层业务逻辑连贯性弱。我们用**真实证据**回应这些猜测,而非口头反驳。

### 通病 ① 代码冗余度高 → 实际:Knip + dedupe + 21 钩子守门

| 机制                        | 文件                                                                                                          | 作用                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Knip 未使用代码检测**     | [knip.jsonc](./knip.jsonc) + [.github/workflows/knip.yml](./.github/workflows/knip.yml)                       | CI 守门,任何 export 未被引用 → CI fail                  |
| **依赖碎片化检测**          | [scripts/check-dedupe.mjs](./scripts/check-dedupe.mjs)(pre-commit 第 7 项)                                    | 检测重复依赖版本,统一对齐                               |
| **Tailwind class 冲突检测** | [scripts/check-tailwind-class-conflict.mjs](./scripts/check-tailwind-class-conflict.mjs)(pre-commit 第 20 项) | 检测模板字面量 BASE/BRANCH size 冲突                    |
| **staged 污染预警**         | [scripts/check-staged-pollution.mjs](./scripts/check-staged-pollution.mjs)(pre-commit 第 19 项)               | 检测跨 ≥4 目录的 staged 改动                            |
| **commit scope 一致性预警** | [scripts/check-commit-scope-consistency.mjs](./scripts/check-commit-scope-consistency.mjs)(commit-msg hook)   | 检测 scope 与 staged 文件领域不匹配(防 git add -A 污染) |

### 通病 ② 边界条件处理不足 → 实际:719 测试文件 / ~14839+ 测试用例 + 67 e2e + 微服务工程模式

| 机制               | 证据                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API 单元测试**   | 237 个 `.test.ts` 文件([apps/api/tests/](./apps/api/tests/)),覆盖 auth/billing/order/vip/wallet/alipay/crypto/csrf/outbox 等核心路径                                   |
| **E2E 测试**       | 63 个 `.spec.ts` 文件([apps/web/e2e/](./apps/web/e2e/)),覆盖 admin/ai-chat/auth-2fa/community/education/orders/payment/plaza/pwa/security/seo/workspace 等 17 个业务域 |
| **AI 服务测试**    | pytest 测试套件([apps/ai-service/tests/](./apps/ai-service/tests/)),含 `test_business_flow_integration.py` 业务流程集成测试 + `test_langgraph_service.py` 编排逻辑测试 |
| **微服务容错模式** | Outbox 事务性发件箱 + Refund DLQ 退款死信队列 + Circuit Breaker 断路器 + IDOR 防护 + WS Dedup 消息去重                                                                 |
| **支付闭环测试**   | `apps/api/tests/alipay.test.ts` + `billing.test.ts` + `order.test.ts` + `wallet.test.ts` 覆盖支付/退款/对账/钱包事务                                                   |

### 通病 ③ 深层业务逻辑连贯性弱 → 实际:复杂业务流程有完整链路

| 业务流程             | 关键代码                                                                                                                             | 测试                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **支付闭环**         | `createOrder` → `completeOrderWithSaga` → 支付回调 → VIP 开通 → 钱包入账 → 积分发放 → 退款死信队列                                   | [apps/api/tests/order.test.ts](./apps/api/tests/order.test.ts) + [billing.test.ts](./apps/api/tests/billing.test.ts) |
| **AI 教育全栈**      | 课程报名 → 章节追踪 → 作业批改(`gradeSubjectiveAnswers` 主观题人工批改 + 客观题自动评分)→ 错题本 → 直播回放复习 → 证书发放           | [apps/api/tests/exam.test.ts](./apps/api/tests/exam.test.ts) + [learn.test.ts](./apps/api/tests/learn.test.ts)       |
| **LangGraph 工作流** | `langgraph_service.py` StateGraph(plan → execute → summarize)+ `koubo_workflow.py` 10+ tools + `agent_orchestrator.py` 多 Agent 协作 | [apps/ai-service/tests/test_langgraph_service.py](./apps/ai-service/tests/test_langgraph_service.py)                 |
| **多租户权限**       | RBAC 5 级 + data-scope 5 级 + RLS 行级安全 + workspace 3 模式 + 7 端点运行时拦截 + 60s 审计超时                                      | [apps/api/tests/rbac.test.ts](./apps/api/tests/rbac.test.ts)                                                         |
| **AI 流式输出**      | SSE(Agent 流式)+ WebSocket(聊天室 / 多模型流式)+ REST 三协议分层 + WS Dedup 消息去重                                                 | [apps/api/tests/chat.test.ts](./apps/api/tests/chat.test.ts)                                                         |

---

## AI 编程协作声明

> **本项目使用 AI 编程智能体辅助开发**(Claude Code / Codex / Cursor 等),但通过以下机制保证工程质量,**不是"AI 自动生成无审查代码"**:

### 三重门禁(每行代码必须通过)

1. **写代码前**:AGENTS.md 21 节强制规则 + §11 多 Subagent 并行开发任务分配格式 + §9 全端连通强制
2. **写代码中**:§17 样式改动强制 browser_use 验证 + §19 UI 改动交付前自验 4 状态截图 + §14 Agent 自主验证
3. **写代码后**:`pnpm turbo build typecheck lint test` 全量验证 + 56+10 pre-commit 项 + pre-push typecheck 闸门 + post-commit 自动 push + git-push-guard 验证

### AI 生成代码的针对性反制

| AI 代码通病      | 本项目反制机制                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| 代码冗余         | Knip CI 守门 + check-dedupe + check-tailwind-class-conflict                                          |
| 边界条件缺失     | 719 测试文件 / ~14839+ 测试用例 + 67 e2e + pytest 集成测试 + 微服务容错模式                          |
| 业务逻辑断裂     | 业务流程集成测试(`test_business_flow_integration.py`)+ saga 事务模式 + outbox 事务发件箱             |
| 类型安全漏洞     | TypeScript strict + Zod 端到端校验 + @ihui/types 跨端契约                                            |
| 文档与代码 drift | §13 文件修改持久化强制 Read 验证 + check-project-plan-archive 守门                                   |
| 风格不一致       | ESLint + Prettier + 56+10 pre-commit 项 + check-rounded-full / check-i18n-keys / check-api-routes 等 |
| 协作事故         | §12 多会话并行规则 + §16 push 阶段跨 Agent 改动保护 + git-push-guard + post-commit 自动 push         |

### 客观承认的不足

我们**不否认**以下事实,并将其作为后续优化方向:

- 5 端(desktop / extension / mobile-rn / miniapp-taro / cli)完成度低于 web/api/ai-service,核心场景已通但业务页面覆盖度不足(见[项目状态矩阵](#项目状态矩阵))
- 开源社区生态刚起步,贡献者数量、Issue 沉淀、最佳实践远不如 LangChain / Dify / Claude Code 等成熟项目

---

## 测试

详细测试矩阵见 [核心能力 E5 节](#e5-测试与性能)。

---

## 部署

### Docker Compose(推荐)

```bash
# 配置 .env.production
cp .env.production.example .env.production
# 编辑 JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY / 微信支付证书 / SMTP 等

# 一键启动(7 业务 + 7 监控 = 14 服务)
docker compose up -d
```

**服务清单(14 服务):**

| 类型 | 服务           | 端口 | 用途                                   |
| ---- | -------------- | ---- | -------------------------------------- |
| 业务 | api            | 8802 | Fastify 后端                           |
| 业务 | worker         | 8830 | BullMQ 独立 worker 进程                |
| 业务 | web            | 8801 | Next.js 前端(static export,A 套壳架构) |
| 业务 | ai-service     | 8803 | FastAPI AI 服务                        |
| 业务 | db             | 8810 | PostgreSQL 15                          |
| 业务 | redis          | 8811 | Redis 7                                |
| 业务 | migrate        | -    | 一次性迁移服务(完成后退出)             |
| 监控 | jaeger         | 8814 | 分布式追踪 UI                          |
| 监控 | otel-collector | 8813 | OpenTelemetry Collector                |
| 监控 | prometheus     | 9091 | 指标采集                               |
| 监控 | grafana        | 8816 | 可视化(3 仪表盘)                       |
| 监控 | node-exporter  | 8817 | 主机指标                               |
| 监控 | loki           | 8818 | 日志聚合                               |
| 监控 | promtail       | -    | 日志采集                               |

### 端口管理规则

本项目所有服务统一使用 `88xx` 端口段,避免与系统服务冲突:

| 端口段    | 用途         | 说明                                                                                                                           |
| --------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 8801-8809 | 八端应用服务 | Web / API / AI Service / Taro H5 / Metro / Desktop 等                                                                          |
| 8810-8819 | 基础设施     | PostgreSQL(8810)/ Redis(8811)/ OTel(8812-8813)/ Jaeger(8814)/ Prometheus(8815)/ Grafana(8816)/ Node Exporter(8817)/ Loki(8818) |
| 8820-8829 | 辅助工具     | Storybook(8820)等开发辅助工具                                                                                                  |
| 8830-8839 | SaaS 部署    | Admin API(8830)等 SaaS 化部署服务                                                                                              |

### 生产部署

详见 [DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) — 蓝绿部署 / 镜像 tag 切换 / Nginx upstream 切换 / 数据库备份恢复 / 证书续期 / 健康检查 / 回滚。

```bash
# 部署前 10 项硬性门禁自检
node scripts/pre-deploy.mjs

# PostgreSQL 备份
node apps/api/scripts/pg-backup.mjs

# 健康检查
./deploy/scripts/health-check.sh

# 回滚
./deploy/scripts/rollback.sh

# 证书续期(deploy/cron/cert-renew.cron 自动调度)
./deploy/cron/cert-renew.sh

# GitHub Actions secrets 批量配置
./deploy/setup-github-secrets.sh
```

### IaC 决策

本架构选用 **Docker Compose + GitHub Actions** 而非 K8s + Helm + ArgoCD,理由:

- 单 VM 即可部署,运维门槛低
- 无控制平面开销,资源利用率高
- 部署速度 10-30s(K8s 30s-2min)
- 适用规模 ≤ 5 服务 / 单团队 / 单集群

**何时迁移 K8s**:业务服务 > 10 / 跨可用区多活 / 单 VM 资源触顶 / 需要 HPA 自动伸缩 / 多租户 namespace 级别隔离。所有 Dockerfile 可直接复用为 K8s 容器镜像,迁移路径已预留。

---

## CI 工作流(2026-07-26 新增)

| Workflow                                                                 | 触发条件                                                                                                    | 失败阻塞                                             |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [`i18n-dead-key-audit.yml`](./.github/workflows/i18n-dead-key-audit.yml) | PR 改 i18n 字典 / 五端代码(web·miniapp-taro·mobile-rn·cli·extension)/ `packages/shared/src/chat` / 扫描脚本 | 是(死 key > 0 → exit 1;现跑 `--target all` 五端全扫) |
| [`ci.yml`](./.github/workflows/ci.yml)                                   | PR 推 main / develop                                                                                        | 是                                                   |
| [`build.yml`](./.github/workflows/build.yml)                             | tag 推送 / main 合并                                                                                        | 是(构建产物)                                         |
| [`e2e.yml`](./.github/workflows/e2e.yml)                                 | PR 标 `e2e` 标签                                                                                            | 是(Playwright)                                       |
| [`knip.yml`](./.github/workflows/knip.yml)                               | PR 改源码                                                                                                   | 是(未使用代码)                                       |

**i18n-dead-key-audit 流程**:`scripts/scan-dead-i18n-keys.mjs --target all`(CI 与 `pnpm check:all` 均用此入口;裸跑默认仍是 `--target web`)→ 逐端扫描各自 `scanTargets`(web 端含 `apps/web/src + apps/web/app + apps/miniapp-taro/src + packages/app/src + apps/mobile-rn/src`;cli / extension 端各含 `packages/shared/src/chat`,因为等待语池等键是 shared 运行期拼出来的)→ 每端写 `.ihui-agent/tmp/i18n-dead-keys-YYYY-MM-DD-<端>.md`(artifact)→ 任一端死 key > 0 → exit 1 并逐端点名(`web=ok … cli=exit 1 …`;无 JS 扫描面的 desktop 会如实标"未计入",不静默算绿)→ PR 阻塞。

---

## 国际化

5 语言 parity(键集合 99.7% 一致(5 语言差 1-2 key,守门脚本持续校验)),由 4 守门脚本 + 19 i18n 工具链保证质量:

详细清单见 [核心能力 E3 节](#e3-国际化5-语言-parity)。

### I18n 治理(2026-07-26 新增)

5 语言 i18n 通过 `scripts/scan-dead-i18n-keys.mjs` 系列自动审计,死 key 比例从 43.1% 降至 0.0%(已清零)。

- **基准语言**:`packages/i18n/messages/web/zh-CN.json`(10,174 leaf key,5 语言同步)
- **多端字典目录**:`packages/i18n/messages/{web,shared,extension,cli,miniapp-taro,mobile-rn}/` 6 端独立字典,各 5 语言文件(desktop 是 Rust/Tauri 包装,无 JS 取词面,字典未建 ⇒ 扫描器如实标"未计入"而非算绿)
- **扫描工具**:
  - `scripts/scan-dead-i18n-keys.mjs --target {all|web|cli|extension|miniapp-taro|mobile-rn|desktop}`(主入口;`all` 逐端判定并打印 `web=ok … cli=ok` 结论行,CI 与 `pnpm check:all` 均用 `--target all`;裸跑默认 `--target web`,其 scanTargets 跨端共享)
  - `scripts/scan-extension-dead-i18n-keys.mjs`(extension 端独立)
  - `scripts/scan-miniapp-taro-dead-i18n-keys.mjs`(miniapp-taro 端独立)
  - `scripts/scan-mobile-rn-dead-i18n-keys.mjs`(mobile-rn 端独立)
  - `scripts/scan-desktop-dead-i18n-keys.mjs`(desktop 端独立)
- **CI 集成**:`.github/workflows/i18n-dead-key-audit.yml`(PR 触发,失败即阻塞)
- **AI 翻译流水线**:`pnpm i18n:apply`(从 zh-CN 差异 → 4 语言补全,parity 校验,brand-glossary 约束)
- **死 key 审计**:`node scripts/scan-dead-i18n-keys.mjs --dry-run` 一键查看本端死 key 清单(终端输出统计 + `.ihui-agent/tmp/i18n-dead-keys-YYYY-MM-DD.md` 报告)

---

## LLM Provider 字典化(2026-07-26 阶段 2 完成)

LLM provider 字段从扁平 `*_api_key` 格式升级为 Pydantic 强类型 `ProviderConfig` + JSON 配置(24+7 provider 统一管理)。

- **设计文档**:`docs/llm-provider-dict-design.md`(7 章节,3 阶段实施路线)
- **运行时强类型**:`apps/ai-service/app/core/provider_config.py`(`ProviderConfig` Pydantic 模型,字段校验 + 默认值 + 类型提示)
- **配置格式**:`LLM_PROVIDERS_JSON='{"openai":{...},"anthropic":{...},"deepseek":{...},...}'`(环境变量或 `llm_providers.json` 文件,统一管理 base_url / api_key / models / proxy / timeout)
- **迁移工具**:`scripts/migrate-llm-providers.mjs`(从扁平 `*_api_key` 字段 → JSON 字典格式,支持 `--dry-run` 预览)
- **测试**:`apps/ai-service/tests/test_provider_config.py`(36+ 单测,覆盖字段校验 / 环境变量解析 / 迁移一致性)
- **向后兼容**:1 版本 deprecation 期,旧 `*_api_key` 字段仍可工作(运行时自动 fallback 到 JSON 配置)

---

## LLM 字典化闭环 PoC(2026-07-26 G1+G2 完成)

把"LLM 字典化"从 provider 字段层面推进到 **subagent 长任务**与 **结构化输出**两个层面,PoC 已落地。

### G1 — 业务代号字典(`apps/ai-service/app/core/prompt_dict.py`)

把 IHUI-AI 8 端 + 通用 LLM/Agent 概念映射成短代号,序列化到 system prompt,让 subagent 长任务里反复使用短代号,减少 token 消耗 + 降低假阳性。

- **字典规模**:`DOMAIN_ALIASES` ≥20 条(覆盖 UI 组件 / 渲染方式 / 端 / 模块 / 数据形态 5 类)
- **注入入口**:`project_memory.build_system_prompt()` 自动把 `## 业务代号字典` 段拼接到 system prompt 头部
- **调用方**:`persona_registry.build_persona_system_prompt()` 透传 5 个 persona,所有走 persona 的 LLM 调用自动获得代号字典
- **测试**:`tests/test_prompt_dict.py`(9 单测,全绿)+ `tests/test_project_memory.py` 新增注入验证(19 单测,全绿)

### G2 — LLM 自由输出统一 JSON Schema(`llm_gateway.structured_completion`)

强制 LLM 返回符合 JSON Schema 的结构化输出,替代松散的"prompt 里写'请输出 JSON'+ 后置正则解析"路径。

- **核心 API**:`LLMGateway.structured_completion(messages, schema, model, schema_name, max_retries)` → 解析后的 dict,或 error dict(由调用方降级)
- **协议**:走 OpenAI 原生 `response_format: { type: "json_schema", json_schema: { name, schema, strict: true } }`(LiteLLM 透传给各厂商)
- **校验**:required 字段 + `additionalProperties: False` 强制校验,失败自动 retry(默认 1 次)
- **迁移调用点**:`spec_generator.split_tasks()`(从 `_call_llm + _parse_tasks_json` 改为 `structured_completion`)+ 失败降级到 `mechanical_split`
- **测试**:`tests/test_llm_gateway.py::TestStructuredCompletion*`(15 单测,全绿,覆盖 Success/Validation/Error/Retry 四类)+ `tests/test_spec_generator.py::TestSplitTasks`(10 单测,全绿,验证迁移后等价)

### G4 + G5 + G6 — 知识查询统一门面 + 生产调用点接入 + LTM 源接入

把三个独立的知识检索子系统聚合为一个统一入口,对应"LLM 字典化 4 场景"中的**场景 3 记忆分离式字典化**:模型只负责推理,外部知识统一查表,不与模型权重绑定。G4 完整迁移 + G5 生产调用点接入 + G6 LTM 源接入已落地,LLM 可通过 MCP 协议直接调用知识查询工具查完整三源(代码库 + RAG + 跨会话历史)。

**G4 完整迁移(基础层):**

- **核心 API**:`knowledge_lookup(query, *, user_id, repo_id, session_id, top_k_per_source, source_priority, api_token)` → `KnowledgeLookupResult(hits, errors, duration_ms)`
- **三源并发**:`codebase_indexer`(代码库 AST 切片 + embedding)+ `rag_service.retrieve_only()`(向量检索 + rerank,只取 retrieve 阶段,跳过 generate)+ `long_term_memory`(跨会话摘要),`asyncio.gather(return_exceptions=True)` 任一源失败不阻塞其他
- **降级策略**:IO 失败 → 错误记入 `errors` 字段,`hits` 返回空;`user_id` 为空自动跳过 `long_term_memory`(不报错);`source_priority` 不合法抛 `ValueError`
- **统一格式**:`KnowledgeHit(source, score, content, raw)`,`content` 已格式化为 `[codebase:function name] file:ls-le\n...` / `[rag:role] ts\n...` / `[long_term_memory] summary\n关键事实: ...`,可直接注入 prompt
- **RAGService.retrieve_only() 公有 API**:G4 完整迁移新增,替代 PoC 阶段的 `_retrieve` 私有调用。委托给 `_retrieve()`,无额外逻辑(§3 做减法)
- **AgentLoopV2 接入工厂**(`agent_tools.py`):`make_knowledge_lookup_tool(user_id, repo_id, session_id, top_k_per_source, source_priority, api_token)` → `ToolDefinition`,调用方一行接入(闭包绑定参数,LLM 只控 query + top_k_per_source)

**G5 生产调用点接入(MCP 工具注册表):**

- **MCP 工具注册**(`mcp_server.py`):新增 `_tool_knowledge_lookup(arguments)` 函数,注册到 `_TOOLS`(MCPTool schema)+ `_TOOL_HANDLERS`(handler 调度表),LLM 可通过 MCP 协议直接调 `knowledge_lookup` 工具
- **不在 `_ADMIN_ONLY_TOOLS`**:查询类工具,所有用户可用(类比 `search_codebase`),普通用户(user_role=0)和 admin(user_role>=1)均可调
- **LLM 可控参数**:`query`(required string)+ `top_k_per_source`(optional int,1-20,默认 5)
- **服务端注入(G6,2026-07-26)**:`user_id`/`session_id` 从 FastAPI request 上下文透传(routers/mcp.py 从 `request.state.user_id`,routers/llm.py 从 `req.metadata.userId`),`call_tool` 注入 `__user_id`/`__session_id` 到 arguments 副本(复用 `__user_role` 模式),`_tool_knowledge_lookup` 提取后传给 `knowledge_lookup(user_id=...)` 启用 `long_term_memory` 源(完整三源)。service 层(agent_loop/orchestrator/conversation)无 request 上下文,保持 None 跳过 LTM(不回归)
- **服务端固定(安全)**:`repo_id`/`api_token`/`source_priority` 仍 None(用 knowledge_lookup 默认值)
- **降级策略**:空 query → ok=False;三源全失败 → ok=False + errors 透传;ValueError → ok=False;各源空结果(无 errors)→ ok=True(空结果不算失败)
- **`top_k_per_source` 防御性 clamp**:LLM 传越界值(< 1 或 > 20)自动 clamp 到 1-20
- **hits 序列化**:不含 `raw` 字段(避免 LLM 上下文冗长 + 防泄露),含 `source` / `score`(round 4 位)/ `content`
- **G5 测试**:`tests/test_mcp_server.py` 新增 20 个测试(TestKnowledgeLookupToolRegistration 4 + TestKnowledgeLookupToolExecution 13 + TestKnowledgeLookupViaMCPServer 3),覆盖工具注册 / 权限矩阵 / 空查询 / 三源成功 / 全失败降级 / 空结果 / top_k 透传 + clamp / ValueError 降级 / hits 不含 raw / query strip / MCPServer.call_tool 调度

**G6 LTM 源接入(2026-07-26,架构改动):**

- **call_tool 签名扩展**:`MCPServer.call_tool(name, arguments, *, user_role, user_id, session_id)`,新增 `user_id`/`session_id` kwargs(可选,默认 None,向后兼容)
- **session context 注入**:复用 Wave 8 的 `__user_role` 注入模式,在 arguments 副本里同时注入 `__user_id`/`__session_id`(LLM 不可控,从 FastAPI request 透传)
- **`_tool_knowledge_lookup` 改动**:从 arguments 提取 `__user_id`/`__session_id`,传给 `knowledge_lookup(user_id=..., session_id=...)`,启用 `long_term_memory` 源(此前 G5 固定 None 跳过 LTM)
- **调用方**:routers/mcp.py 从 `request.state.user_id` 拿(JWTAuthMiddleware 已注入),routers/llm.py 从 `owner_uuid`(`req.metadata.userId`)透传;service 层(agent_loop/orchestrator/conversation)无 request 上下文,保持 None 跳过 LTM(与 G5 旧行为一致,不回归)
- **价值**:把 knowledge_lookup 从"两源(codebase+RAG)"升级为"完整三源(+跨会话历史)",LLM 可查用户历史对话,实现"记忆分离式字典化"完整闭环
- **G6 测试**:`tests/test_mcp_server.py::TestKnowledgeLookupG6SessionContext` 新增 6 个测试,覆盖 user_id 透传 / session_id 透传 / 默认 None 向后兼容 / 同时传两者 / 不污染 LLM 可控参数(query/top_k)/ `_tool_knowledge_lookup` 直接提取注入值

**测试覆盖总览**:G4+G5+G6 共 70 个新单测全绿(test_knowledge_lookup 25 + TestRetrieveOnly 5 + test_agent_tools 14 + test_mcp_server knowledge_lookup 20 + G6 session context 6),联合 211/211 全绿(test_mcp_server 全量 + test_knowledge_lookup + test_agent_tools)。

### 字典化四层能力对照

| 层级            | 内容                                                                   | 落地位置                                                                                                                                               | 状态                 |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| L1 数据层       | 24+7 LLM provider 字段字典化                                           | `provider_config.py` + `LLM_PROVIDERS_JSON`                                                                                                            | ✅ 阶段 2            |
| L2 业务代号     | 8 端 + UI 组件 + 模块短代号                                            | `prompt_dict.py` + `project_memory.py`                                                                                                                 | ✅ G1 PoC            |
| L3 输出结构化   | LLM 输出强 JSON Schema 约束                                            | `llm_gateway.structured_completion`                                                                                                                    | ✅ G2 PoC            |
| L4 知识查询门面 | 三源并发统一查询 + 降级 + AgentLoopV2 工厂 + MCP 工具注册 + LTM 源接入 | `knowledge_lookup.py` + `agent_tools.py` + `rag.retrieve_only` + `mcp_server._tool_knowledge_lookup` + `mcp_server.call_tool(user_id/session_id 注入)` | ✅ G4+G5+G6 完整三源 |

---

