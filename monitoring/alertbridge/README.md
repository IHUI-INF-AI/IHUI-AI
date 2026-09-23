<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI-AI 故障主动告警链路（Prometheus → Alertmanager → bridge → 微信 + 品牌邮件）

> 2026-09-06 立。补齐线上"故障主动发现/告警到人"的最后一跳。
> 此前 Prometheus 规则在评估、告警在触发，但无人接收（Alertmanager 未装、receiver 全是占位符）。
> 2026-09-24 补第二条腿：同一批告警并行寄一份**带版式**的运维邮件（此前只有微信）。

## 全链路

```
Prometheus(127.0.0.1:8815)
   └─ 规则评估 alerts.yml
        └─ Alertmanager(127.0.0.1:9093)  ← 告警分组/抑制
             └─ alert-webhook-bridge(127.0.0.1:9096)  ← 去重/冷却/预算 + 协议转码
                  ├─ Server酱(sctapi.ftqq.com) → 个人微信      （主通道，免费额度 5 条/天）
                  └─ apps/api/scripts/notify-deploy-failure.ts → SMTP → Resend 兜底 → 运维邮箱
```

- `alert-webhook-bridge.cjs`：Alertmanager 的 webhook 发 OpenAPI JSON，Server酱只收 form。
  桥负责把 JSON 转成 form，并做**去重(4h/同告警) + 冷却(60s) + 每日预算**，避免触发 Server酱"每天 5 次"上限。
- 密钥：Bridge 从 `D:\DevEnv\secrets\serverchan.txt` 读取 SendKey，不入 git。
- Alertmanager 自带的 `email_configs` **不要启用**：它用 Go text/template 渲染，不可能带本仓
  「智汇通报」版式，挂上去等于新开一条绕过品牌层的运维邮件流（2026-09-23 实测后已回滚，
  结论见 PROJECT_PLAN ⑨）。运维邮件的唯一出口就是上面那条派发器。

## 邮件腿（2026-09-24 接线）

| 项       | 口径                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 出口     | 只调 `apps/api/scripts/notify-deploy-failure.ts`（`--severity` / `--title` / `--source ihui-alertbridge` / `--message-file`）   |
| 版式     | `apps/api/src/services/email-templates.ts` 的 `renderSystemAlertEmail` 单点决定；本目录**不得**出现 SMTP/Resend 传输层或色值    |
| 收件人   | 不传 `--to` ⇒ 由派发器回读 `apps/api/.env` 的 `ALERT_EMAIL_TO`（不在端内复制第二份收件人真相）                                  |
| 默认状态 | **开**。收件人就是值班运维本人，且 Server酱免费额度只有 5 条/天（实测已撞满过），关掉等于回到"告警静默"                         |
| 关闭     | `BRIDGE_MAIL_ENABLED=0`（亦认 `false` / `off` / `no`）                                                                          |
| 去重     | **复用**微信腿那一份去重状态与 `SCT_DEDUP_MIN` 窗口（两条腿取同一个去重后批次）⇒ 同一条告警 4h 内不会重复寄信，也没有第二份状态 |
| 预算     | `BRIDGE_MAIL_DAILY_BUDGET` 默认 10 封/天（与仓库既有"运维邮件 ≤10 封/天"同口径），按自然日随状态文件持久化                      |
| 隔离     | 两条腿各自记录结果：任一条抛错/失败都不得影响另一条；邮件派发用异步 `spawn`（同步会钉死事件循环 → Alertmanager 推送超时）       |
| 降级     | 品牌模板失败时用同一条通道的 `--plain` 再发一次（宁可不带版式，不可静默丢失）                                                   |

### 命令行旗标（不带旗标时行为与既有服务一致）

```bash
node monitoring/alertbridge/alert-webhook-bridge.cjs --self-test     # 49 例逻辑自检:零网络、零子进程、零投递
node monitoring/alertbridge/alert-webhook-bridge.cjs --mail-dry-run  # 只问派发器"通道是否齐备",不发信、不启服务
node monitoring/alertbridge/alert-webhook-bridge.cjs --help
```

自检覆盖：argv 契约（含**绝不传 `--env-file`**、必带 `--strict`/`--message-file`）、正文写成**无 BOM** UTF-8、
去重窗口（两条腿共用）、每日预算与次日重置、微信腿失败不影响邮件腿（及反向）、
以及 Server酱返回体判定（含"伪造/异常响应不得记成功"的四条反例）。

### Server酱成功判定（2026-09-24 修假成功）

旧判据把"HTTP 2xx + 非 JSON / 无 `errno`"一律记成功，实测（伪造 SendKey 沙箱）会写出
假成功日志 `[push] 已推送 N 条告警到微信`，真实业务失败静默丢告警。
现在只有官方返回体里的明确成功信号算成功：`code === 0`（Turbo/SC3）、`errno === 0`（旧 v1）、
`status === "success"`；非 2xx、空体、HTML、非 JSON、缺上述字段 ⇒ 全部判失败并落**脱敏**诊断
（SendKey 就嵌在请求 URL 里，任何诊断文本先过 `redact()`）。未配置 SendKey 同样判失败（旧行为是"跳过并算成功"）。

## 服务（NSSM）

| 服务              | 二进制                        | 端口 | 日志                       |
| ----------------- | ----------------------------- | ---- | -------------------------- |
| ihui-prometheus   | prometheus.exe                | 8815 | svc-prometheus-nssm*.log   |
| ihui-grafana      | grafana-server.exe            | 8816 | grafana/nssm               |
| ihui-alertmanager | alertmanager.exe (0.34.0)     | 9093 | svc-alertmanager-nssm*.log |
| ihui-alert-bridge | node alert-webhook-bridge.cjs | 9096 | svc-alert-bridge-nssm*.log |
| IHUI-MONITOR      | powershell monitor.ps1        | —    | svc-* / monitor-alerts.log |

### 源-运行分裂收口（2026-09-24）

实测 `HKLM\SYSTEM\CurrentControlSet\Services\ihui-alert-bridge\Parameters` 的
`AppParameters = D:\IHUI-AI\deploy\prod-bundle\alert-webhook-bridge.cjs`，而 `deploy/prod-bundle/`
被 `.gitignore` 忽略 ⇒ 那里曾是一份**不参与 review、没人更新的手工副本**，实测落后入库源码 11 天
（服务跑的是没有每日预算/状态持久化/冷却补发的旧逻辑，旧副本另有一处 `toDedupCount` 未定义变量，
每次"全部命中去重"都对 Alertmanager 抛 500）。

现在 `deploy/prod-bundle/alert-webhook-bridge.cjs` 改为**转发器**（`require` 本目录的入库源码，
路径由 `__dirname` 推导），两份真相收敛成一份；换机时把 nssm 的 `AppParameters` 直接指向
本目录源码即可，无需再维护副本。

> ⚠️ 转发器要**重启服务**才生效（Node 已把旧文件载入内存）。重启属生产动作，须人工执行：
> `nssm restart ihui-alert-bridge`。本次接线未重启。

## 重建命令（若服务丢失）

```powershell
# Alertmanager
nssm install ihui-alertmanager "D:\DevEnv\monitor\alertmanager\alertmanager-0.34.0.windows-amd64\alertmanager.exe" "--config.file=D:\DevEnv\monitor\alertmanager\alertmanager.yml --web.listen-address=127.0.0.1:9093 --cluster.listen-address="
nssm set ihui-alertmanager AppDirectory "D:\DevEnv\monitor\alertmanager\alertmanager-0.34.0.windows-amd64"

# Bridge → 微信 + 品牌邮件（推荐直接指向入库源码,不经 deploy/prod-bundle 转发器）
nssm install ihui-alert-bridge "D:\DevEnv\runtimes\node\node.exe" "D:\IHUI-AI\monitoring\alertbridge\alert-webhook-bridge.cjs"
nssm set ihui-alert-bridge AppDirectory "D:\IHUI-AI\monitoring\alertbridge"
nssm set ihui-alert-bridge AppEnvironmentExtra "BRIDGE_PORT=9096"
```

## 验证点

- Prometheus 发现 Alertmanager：`GET http://127.0.0.1:8815/api/v1/alertmanagers` → activeAlertmanagers 含 9093
- Bridge 健康：`GET http://127.0.0.1:9096/health` → `{"ok":true,...,"keyConfigured":true,"mailEnabled":true}`
- Alertmanager: `GET http://127.0.0.1:9093/-/healthy` → `OK`
- 邮件腿通道：`node monitoring/alertbridge/alert-webhook-bridge.cjs --mail-dry-run` → `ok=true`（零网络请求、不占配额）
- 投递对账：日志里 `[push]` 行是微信腿结论（含 Server酱判定信号），`[mail]` 行是邮件腿结论（含当日邮件预算用量）

## 注意

- Server酱 free 账号每天 5 次发送上限，跨天 reset。桥的节流/去重缓解误刷；额度耗尽时**邮件腿仍送达**。
- 微信腿预算 `SCT_DAILY_BUDGET` 默认 4（留 1 条余量给 5 次硬限）；邮件腿 `BRIDGE_MAIL_DAILY_BUDGET` 默认 10。
- Alertmanager 配置运行副本在 `D:\DevEnv\monitor\alertmanager\alertmanager.yml`，
  与 Prometheus 配置的 `alertmanagers: [localhost:9093]` 对齐。
- 沙箱自测（不触达真实微信/不占线上状态）：`BRIDGE_PORT=19096 LOG_FILE=... STATE_FILE=... SCT_SENDKEY=SCTFAKE... node alert-webhook-bridge.cjs`，
  临时文件一律落 `.ihui-agent/tmp/` 并用后删除。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
