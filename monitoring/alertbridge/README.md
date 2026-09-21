<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI-AI 故障主动告警链路（Prometheus → Alertmanager → Server酱 → 微信）

> 2026-09-06 立。补齐线上"故障主动发现/告警到人"的最后一跳。
> 此前 Prometheus 规则在评估、告警在触发，但无人接收（Alertmanager 未装、receiver 全是占位符）。

## 全链路

```
Prometheus(127.0.0.1:8815)
   └─ 规则评估 alerts.yml
        └─ Alertmanager(127.0.0.1:9093)  ← 告警分组/抑制
             └─ alert-webhook-bridge(127.0.0.1:9096)  ← 去重/冷却 + 协议转码
                  └─ Server酱(sctapi.ftqq.com) → 个人微信
```

- `alert-webhook-bridge.cjs`：Alertmanager 的 webhook 发 OpenAPI JSON，Server酱只收 form。
  桥负责把 JSON 转成 form，并做**去重(4h/同告警) + 冷却(60s)**，避免触发 Server酱"每天 5 次"上限。
- 密钥：Bridge 从 `D:\DevEnv\secrets\serverchan.txt` 读取 SendKey，不入 git。

## 服务（NSSM）

| 服务              | 二进制                        | 端口 | 日志                       |
| ----------------- | ----------------------------- | ---- | -------------------------- |
| ihui-prometheus   | prometheus.exe                | 8815 | svc-prometheus-nssm*.log   |
| ihui-grafana      | grafana-server.exe            | 8816 | grafana/nssm               |
| ihui-alertmanager | alertmanager.exe (0.34.0)     | 9093 | svc-alertmanager-nssm*.log |
| ihui-alert-bridge | node alert-webhook-bridge.cjs | 9096 | svc-alert-bridge-nssm*.log |
| IHUI-MONITOR      | powershell monitor.ps1        | —    | svc-* / monitor-alerts.log |

## 重建命令（若服务丢失）

```powershell
# Alertmanager
nssm install ihui-alertmanager "D:\DevEnv\monitor\alertmanager\alertmanager-0.34.0.windows-amd64\alertmanager.exe" "--config.file=D:\DevEnv\monitor\alertmanager\alertmanager.yml --web.listen-address=127.0.0.1:9093 --cluster.listen-address="
nssm set ihui-alertmanager AppDirectory "D:\DevEnv\monitor\alertmanager\alertmanager-0.34.0.windows-amd64"

# Bridge → Server酱
nssm install ihui-alert-bridge "D:\DevEnv\runtimes\node\node.exe" "D:\IHUI-AI\monitoring\alertbridge\alert-webhook-bridge.cjs"
nssm set ihui-alert-bridge AppDirectory "D:\IHUI-AI\monitoring\alertbridge"
nssm set ihui-alert-bridge AppEnvironmentExtra "BRIDGE_PORT=9096"
```

> 注意：`deploy/prod-bundle/alert-webhook-bridge.cjs` 是运行副本（该目录被 gitignore）；
> 本目录（`monitoring/alertbridge/`）是入库源码。改动应先改入库版再同步运行副本。

## 验证点

- Prometheus 发现 Alertmanager：`GET http://127.0.0.1:8815/api/v1/alertmanagers` → activeAlertmanagers 含 9093
- Bridge 健康：`GET http://127.0.0.1:9096/health` → `{"ok":true,...,"keyConfigured":true}`
- Alertmanager: `GET http://127.0.0.1:9093/-/healthy` → `OK`

## 注意

- Server酱 free 账号每天 5 次发送上限，跨天 reset。桥的节流/去重缓解误刷。
- Alertmanager 配置运行副本在 `D:\DevEnv\monitor\alertmanager\alertmanager.yml`，
  与 Prometheus 配置的 `alertmanagers: [localhost:9093]` 对齐。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
