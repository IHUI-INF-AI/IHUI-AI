<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI-AI 故障主动告警链路（Prometheus → Alertmanager → bridge → 运维邮件）

> 2026-09-06 立。补齐线上"故障主动发现/告警到人"的最后一跳。
> 2026-09-24 通道收口：告警到人**只剩运维邮件一条通道**——此前并行的第三方推送腿
> （免费额度 5 条/天的推送网关）已整体摘除，代码、环境变量、状态文件与本文档均不留残余；
> 摘除动机与"为什么自有邮件通道不设总量封顶"见下与 AGENTS.md §5e。

## 全链路

```
Prometheus(127.0.0.1:8815)
   └─ 规则评估 alerts.yml
        └─ Alertmanager(127.0.0.1:9093)  ← 告警分组/抑制
             └─ alert-webhook-bridge(127.0.0.1:9096)  ← 身份去重 + 协议转码
                  └─ apps/api/scripts/notify-deploy-failure.ts → SMTP → Resend 兜底 → 运维邮箱
```

- `alert-webhook-bridge.cjs`：把 Alertmanager 的 webhook JSON 转成品牌派发器调用，并做
  **只按身份的去重（默认 4h/同告警）**。**没有每日预算、没有冷却丢弃**——
  第三方推送时代需要预算，是因为额度是**第三方配额**（不自保就撞墙）；SMTP 是我们自己的，
  自设总量上限等于把"告警静默"再复制一遍。现在寄几封完全由"有多少不同身份的告警在响"决定。
- Alertmanager 自带的原生邮件通道**已从模板删除且不可再加回**（2026-09-24 收口）：它用 Go
  text/template 渲染，不可能带本仓「智汇通报」版式，挂上去等于新开一条绕过品牌层的运维邮件流
  （2026-09-23 实测后曾回滚，但当时只靠"没人去跑渲染器"兜底）。现在
  `scripts/render-alertmanager-config.mjs` 的 `assertBridgeOnlySurface` 对渲染产物做结构自校验：
  出现邮件面 / IM 中转 receiver / 出口不落 9096 webhook，`pnpm alerts:check` 即红。
  运维邮件的唯一出口就是上面那条派发器。

## 邮件通道（唯一到人通道）

| 项       | 口径                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 出口     | 只调 `apps/api/scripts/notify-deploy-failure.ts`（`--severity` / `--title` / `--source ihui-alertbridge` / `--message-file`）                                                                    |
| 版式     | `apps/api/src/services/email-templates.ts` 的 `renderSystemAlertEmail` 单点决定；本目录**不得**出现 SMTP/Resend 传输层或色值                                                                     |
| 收件人   | 不传 `--to` ⇒ 由派发器回读 `apps/api/.env` 的 `ALERT_EMAIL_TO`（不在端内复制第二份收件人真相）                                                                                                   |
| 默认状态 | **开**。收件人就是值班运维本人，邮件没有第三方总量配额，关掉等于回到"告警静默"                                                                                                                   |
| 关闭     | `BRIDGE_MAIL_ENABLED=0`（亦认 `false` / `off` / `no`）——关的是"要不要发"，不是"发几封"                                                                                                           |
| 去重     | 按告警身份（`alertname`+`instance`）在 `BRIDGE_DEDUP_MIN` 窗口（默认 240=4h）内只寄一封；状态在回响应前**同步落盘**，跨重启延续                                                                  |
| 封顶     | **无**。不同身份的告警一律照寄；旧实现（第三方推送时代）的每日预算/冷却队列已随该腿一并摘除                                                                                                      |
| 失败留痕 | 品牌模板失败先 `--plain` 降级；两条都失败 ⇒ 写 `alert-bridge-mail-UNDELIVERED.json`（与 `STATE_FILE` 同目录）+ `[mail][ERROR]` 日志，`/health` 报 `mailUndelivered=true`；下一次成功投递自动清除 |
| 隔离     | 邮件派发用异步 `spawn`（同步会把 tsx 冷启 + SMTP 握手几十秒钉死事件循环 → Alertmanager 推送超时、后续告警堆积）                                                                                  |

### 命令行旗标（不带旗标时行为与既有服务一致）

```bash
node monitoring/alertbridge/alert-webhook-bridge.cjs --self-test     # 47 例逻辑自检:零网络、零子进程、零投递
node monitoring/alertbridge/alert-webhook-bridge.cjs --mail-dry-run  # 只问派发器"通道是否齐备",不发信、不启服务
node monitoring/alertbridge/alert-webhook-bridge.cjs --help
```

自检覆盖：argv 契约（含**绝不传 `--env-file`**、必带 `--strict`/`--message-file`）、正文写成**无 BOM** UTF-8、
身份去重、**去重态跨重启（正反对照：陈旧条目不复活）**、**无总量封顶（第 11 个不同身份告警照寄、
状态文件形态只有 `dedup`）**、**邮件失败必留未送达标记 / 成功必清痕**、脱敏、版式零手抄。

## 服务（NSSM）

| 服务              | 二进制                        | 端口 | 日志                       |
| ----------------- | ----------------------------- | ---- | -------------------------- |
| ihui-prometheus   | prometheus.exe                | 8815 | svc-prometheus-nssm*.log   |
| ihui-grafana      | grafana-server.exe            | 8816 | grafana/nssm               |
| ihui-alertmanager | alertmanager.exe (0.34.0)     | 9093 | svc-alertmanager-nssm*.log |
| ihui-alert-bridge | node alert-webhook-bridge.cjs | 9096 | svc-alert-bridge-nssm*.log |
| IHUI-MONITOR      | pwsh monitor.ps1(转发壳)      | —    | svc-* / monitor-alerts.log |

### 源-运行分裂收口（2026-09-24）

实测 `HKLM\SYSTEM\CurrentControlSet\Services\ihui-alert-bridge\Parameters` 的
`AppParameters = D:\IHUI-AI\deploy\prod-bundle\alert-webhook-bridge.cjs`，而 `deploy/prod-bundle/`
被 `.gitignore` 忽略 ⇒ 那里曾是一份**不参与 review、没人更新的手工副本**，实测落后入库源码 11 天
（服务跑的是没有状态持久化/节流逻辑的旧版本，旧副本另有一处 `toDedupCount` 未定义变量，
每次"全部命中去重"都对 Alertmanager 抛 500）。

现在 `deploy/prod-bundle/alert-webhook-bridge.cjs` 改为**转发器**（`require` 本目录的入库源码，
路径由 `__dirname` 推导），两份真相收敛成一份；换机时把 nssm 的 `AppParameters` 直接指向
本目录源码即可，无需再维护副本。

> ⚠️ 转发器与通道改动都要**重启服务**才生效（Node 已把旧文件载入内存）。重启属生产动作，
> 须人工执行：`nssm restart ihui-alert-bridge`。

### 同一收敛法的第二个实例：IHUI-MONITOR（2026-09-24）

`deploy/prod-bundle/monitor.ps1` 比 bridge 那份更糟：它**在仓库里根本没有入库源**
（`git ls-files | grep monitor.ps1` 为空），于是对跟踪文件做的所有审计——包括"第三方推送腿是否
已摘干净"的 grep 取证——对它**零覆盖**。实测它仍内联着第三方推送凭据常量与三条纯文本推送通道，
而其唯一通道当日已被对端配额打死（`monitor-alerts.log` 累计 55338 行推送失败），期间它判出的
`api(8802) 未监听` 与公网 500/502 一封都没有到人。

现在：入库源 = `deploy/win/ihui-monitor.ps1`（邮件为唯一出口、按告警身份去重、无每日封顶、
两条通道都失败即写 UNDELIVERED），`deploy/prod-bundle/monitor.ps1` = 28 行转发壳。
换机重建：`nssm set IHUI-MONITOR AppParameters "-NoProfile -ExecutionPolicy Bypass -File <仓库根>\deploy\win\ihui-monitor.ps1"`
（直接指向入库源即可，不必再写转发壳）。

自检不必停服务：`pwsh -File deploy/win/ihui-monitor.ps1 -Once -DryRun`（跑完整链、不发信、
不动服务的去重档案），或 `-ProbeMail` 真发一封【核验信】。

> 2026-09-24 已人工重启 `ihui-alert-bridge` 与 `IHUI-MONITOR`，加载证据：
> `/health` → `{"ok":true,"mailEnabled":true,"mailUndelivered":false}`；bridge 启动行
> "去重窗口 240 分钟(只按身份去重,无总量封顶)"；monitor 侧 `-ProbeMail` 真发一封并在
> `monitor-alerts.log` 留下 `MAIL 已送达 … (品牌模板)`。

## 重建命令（若服务丢失）

```powershell
# Alertmanager
nssm install ihui-alertmanager "D:\DevEnv\monitor\alertmanager\alertmanager-0.34.0.windows-amd64\alertmanager.exe" "--config.file=D:\DevEnv\monitor\alertmanager\alertmanager.yml --web.listen-address=127.0.0.1:9093 --cluster.listen-address="
nssm set ihui-alertmanager AppDirectory "D:\DevEnv\monitor\alertmanager\alertmanager-0.34.0.windows-amd64"

# Bridge → 运维邮件（推荐直接指向入库源码,不经 deploy/prod-bundle 转发器）
nssm install ihui-alert-bridge "D:\DevEnv\runtimes\node\node.exe" "D:\IHUI-AI\monitoring\alertbridge\alert-webhook-bridge.cjs"
nssm set ihui-alert-bridge AppDirectory "D:\IHUI-AI\monitoring\alertbridge"
nssm set ihui-alert-bridge AppEnvironmentExtra "BRIDGE_PORT=9096"
```

## 验证点

- Prometheus 发现 Alertmanager：`GET http://127.0.0.1:8815/api/v1/alertmanagers` → activeAlertmanagers 含 9093
- Bridge 健康：`GET http://127.0.0.1:9096/health` → `{"ok":true,...,"mailEnabled":true,"mailUndelivered":false}`
- Alertmanager: `GET http://127.0.0.1:9093/-/healthy` → `OK`
- 邮件通道：`node monitoring/alertbridge/alert-webhook-bridge.cjs --mail-dry-run` → `ok=true`（零网络请求）
- 投递对账：日志 `[mail]` 行是投递结论；`[mail][ERROR]` + UNDELIVERED 标记 = 有告警未能到人
- 去重跨重启：投一条 → `queued:1`；重投 → `skipped:1`；**杀掉进程重启后再投 → 仍 `skipped:1`**
- IHUI-MONITOR 通道：`pwsh -File deploy/prod-bundle/monitor.ps1 -ProbeMail` → 退出码 0 且
  `monitor-alerts.log` 出现 `MAIL 已送达 … (品牌模板)`；寄到邮箱的信必须带「智汇通报」版式
- IHUI-MONITOR 不误报：本机公网入口是 token 模式 Cloudflared（不在 80 监听），故巡检查
  `Get-Service Cloudflared` 服务态而非 80 端口；`-Once -DryRun` 在链路正常时应打 `全部正常`

## 注意

- 未送达标记、去重状态与日志的默认落点在 `D:\DevEnv\{logs,state}`（仓库外运行态,与既有服务一致）；
  沙箱自测把 `BRIDGE_PORT/LOG_FILE/STATE_FILE` 一起指进 `.ihui-agent/tmp/`（标记随 `STATE_FILE` 同目录走），
  临时文件用后删除。
- 摘除的第三方推送腿遗留的本机运行态（如旧状态文件）留在原地无害：已无任何代码读写它；
  其凭据文件按策略不删（删凭据不是本仓动作），只是不再被任何代码读取。
- Alertmanager 配置运行副本在 `D:\DevEnv\monitor\alertmanager\alertmanager.yml`，
  与 Prometheus 配置的 `alertmanagers: [localhost:9093]` 对齐。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
