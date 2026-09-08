# GitHub Secrets 最终指南（2026-09-08 修订版）

## 实锤结论：只需要 2 个 secrets，您已全部填完 ✅

| Name | 状态 | 说明 |
|---|---|---|
| `DESKTOP_TAURI_PRIVATE_KEY` | ✅ 已填 | 桌面更新器签名私钥（与 tauri.conf.json pubkey 验证匹配） |
| `DESKTOP_TAURI_KEY_PASSWORD` | ✅ 已填 | 签名密码 |

**这两个填完，桌面签名链已闭环**：下次 push 触发 release-desktop（打 tag 或手动），CI 自动出 0.1.16 四平台签名安装包 + latest.json 更新 feed。历史失败的 release-desktop run 在 Actions 页面点 Re-run 即可立即补出。

## 请把另外 3 个删掉（Settings → Secrets → 各自 Repository secrets 右侧垃圾桶）

| Name | 为什么删 |
|---|---|
| `DEPLOY_HOST`（82.157.209.97） | 填错了，这不是我们的服务器 |
| `DEPLOY_USER`（root） | 同上 |
| `DEPLOY_SSH_PRIVATE_KEY` | 同上，且该私钥文件已从本机销毁 |

### 删除的架构级原因（不是缺配置，是根本不可能成功）

真实拓扑：**另一台电脑做服务器 + cloudflared 内网穿透**（`deploy/README.md` 2026-08 侦察结论 + 生产实测 aizhs.top 200 / api.aizhs.top 200 在线）。

- `blue-green-deploy.yml` 的设计是 GitHub Actions 服务器用 SSH 直连 `DEPLOY_HOST:22`。
- 但穿透机在 NAT 内网，`ssh.aizhs.top:22` 实测超时——Cloudflare Tunnel 暴露 SSH 必须客户端跑 `cloudflared access`，GitHub runner 没有也不该装。
- **这就是蓝绿部署历史上"全失败于 SSH 步骤"的真正根因**：不是缺 secrets，是 workflow 与拓扑不匹配。 secrets 补齐一万次也不会通。

## 部署的正确路径（既有方式，"之前配置过"的就是这套）

在那台服务器机上本地操作（不是从 GitHub 推）：

```powershell
cd C:\IHUI-AI          # 服务器机上的仓库目录
git pull               # 拉最新代码
powershell -ExecutionPolicy Bypass -File deploy\prod-bundle\deploy.ps1
```

nginx 变更（如 /v1 /ws 两条 location）上线：把 `deploy/nginx/` 下新配置复制到服务器机 nginx 目录后 `nginx -s reload`（detail 见 deploy/nginx/README）。

## 遗留小项（不影响任何链路）

- 蓝绿 workflow 已无 secrets 可用，若未来想让它生效需改造为 cloudflared access 方案——项目 shutdown 期不建议动。
- 本机 `cloudflared` 服务（`ihui-local` 隧道，2026-07-23 配置）当前 STOPPED——那是旧穿透机残留配置，与现役服务器无关，无需处理。
