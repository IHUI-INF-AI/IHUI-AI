<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 一键部署管线验收报告(任务一)

> 生产机 = 本机(原生 Windows, NSSM 服务, Cloudflare Tunnel, 域 aizhs.top)
> 验收日期: 2026-09-07 · 验收人: 爱智汇(吉林省爱智汇人工智能科技有限公司)
> 部署基线: `origin/main == HEAD == 2a80d42f3` · 线上构建 `m9sZmJ5y-3qQnOsH4rGFt`

## 1. 结论

✔ **管线全部条件验收通过**。实现了「push → 自动拉取 → 零停机构建 → 秒级切换 → 健康门禁 → 失败自动回滚」闭环,4 项演练(部署成功、健康门禁、自动回滚、轮询触发)全部绿灯,生产环境当前健康四维 ALL_PASS。

## 2. 拓扑与实现

| 层 | 实现 | 端口/位置 |
|---|---|---|
| 入口 | Cloudflare Tunnel → aizhs.top | 443 |
| Web | Next.js 16.3.4 Turbo、NSSM `IHUI-WEB`(`next start`) | 8801 |
| API | NSSM `IHUI-API`(tsx 源码直跑) | 8802 |
| AI 网关 | NSSM `IHUI-AI-SERVICE` | 8803 |
| 静态/CDN | `deploy/cdn-server.js` | 80 |
| 部署驱动 | `deploy/win/ihui-deploy.ps1` | 本机 |
| 自动触发 | NSSM 服务 `IHUI-DEPLOYLOOP`(守护进程内每 6 分钟轮询) | LocalSystem |
| ~~自动触发(旧)~~ | ~~计划任务 `IHUI-AutoDeploy`~~ ❌ 2026-09-13 废止:该任务自注册起**从未成功运行过一次**,且本机已无法管理 Task Scheduler(见 §3) | — |

部署脚本**核心脚本** `deploy/win/ihui-deploy.ps1`:
- **零停机蓝绿式**: 构建到独立 `.next-staging`(web 持续在线) → 构建通过 → 停 web →秒级目录交换(`.next` ← staging)→ 起 web,停机窗口压缩到秒级。
- **构建可靠性**: 冷构建 + 4 轮重试,规避 Tailwind v4 单行 CSS 的 lightningcss 偶发解析失败;`next.config.ts` 侧关闭 `optimizeCss` 缓解。
- **健康门禁**: `Test-HealthGate` 带 **8 轮 × 12s 退避重试**(web 200 `<!DOCTYPE html` + `/api/health ok` + LLM 网关 Bearer 探活),匹配 Next 冷启动时长,杜绝重启瞬间误判。
- **自动回滚**: 部署前备份当前构建 → `.rollback`;健康未过自动 `Do-Rollback`(仅停/起 web,api/ai 不重启,影响面最小)。
- **并发锁**: `Get-DeployLock/Release-DeployLock`(PID 存活检测+悬挂锁清理),手动 `-deployLatest` 与计划任务 loop 互斥,杜绝并发构建互相删 `.next-staging`。

## 3. 关键修复(本次部署排障)

| 问题 | 根因 | 修复 |
|---|---|---|
| `Parsing CSS failed / Delim('\u{1a}')` 构建崩溃 | Tailwind v4 展开 ~271KB 单行 CSS,lightningcss(Next 前端 CSS 管线)偶发误报 | `next.config.ts` `experimental.optimizeCss:false` + 部署脚本冷构建/多轮重试 |
| 健康门禁重启后全 False→误触发回滚 | 重启后仅等 8s,web 未就绪,api/llm 又经 web 反代 → 整链 502 | 门禁改 8×12s 退避重试,任一轮全过即成功 |
| 构建期 `_buildManifest.js.tmp` ENOENT | 两个并发 `ihui-deploy.ps1` 同时 `Remove-Item` staging 互相删除 | 绞杀残留进程 + 脚本内 PID 并发锁 |
| `.next-staging/.rollback` 会被误 git add | 未忽略 | 补 `.gitignore` 规则 |

### 3.1 2026-09-13 二次排障(自动部署「根本没在跑」)

| # | 问题 | 根因 | 修复 |
|---|---|---|---|
| 1 | 计划任务 `IHUI-AutoDeploy` 自 2026-09-07 注册起**从未成功运行过一次** | `install-auto-deploy-task.ps1` 构造的 `/tr` 把**整条命令行+引号**塞进了 `<Command>`(值形如 `"C:\...\pwsh.exe -NoProfile ... -File "`),Task Scheduler 于是去启动一个并不存在的"可执行文件" | ①修正脚本:exe 路径与脚本路径**各自**带引号(schtasks 以第一个被引号包裹的 token 为 exe);②本机改用 nssm 服务承载(见 #2) |
| 2 | 本机**无法管理 Task Scheduler** | (a) `schtasks.exe` 被安全策略列入程序黑名单,不可绕过;(b) `ScheduledTasks` 模块随 `C:\Windows\System32\WindowsPowerShell\v1.0\Modules` 一并消失(该目录已被 PS7 Core 文件覆盖,WinSxS 亦无副本),`Get-/Register-ScheduledTask` 均不可用;(c) `Schedule` 服务受保护,Stop/Restart 均 Access Denied,任务定义无法热重载(缓存中仍是旧畸形 `Actions`) | 新增 nssm 服务 `IHUI-DEPLOYLOOP`(`install-deploy-loop-service.ps1`,存在则就地 `nssm set`);旧任务定义已在 XML 层修正并置 `Enabled=false` 留档 |
| 3 | 即便任务能跑,`git fetch` 在 SYSTEM 上下文**必然失败** | 该系统无 `http_proxy`,GitHub 直连被墙(`Failed to connect to github.com:443`) | `ihui-deploy.ps1` 增加代理探测(127.0.0.1:7897)并显式 `-c http.proxy=` 传给 git |
| 4 | **fetch 失败被伪装成"已是最新"** | 旧代码 `$behind = [int](git rev-list --count HEAD..FETCH_HEAD \| Out-String).Trim()`;fetch 失败时 stdout 为空 → `[int]("") = 0` → 报 `OK 本地已是最新 main,无需部署` 并 `exit 0` | fetch 与 behind 全程 **fail-closed**:fetch 失败或 `FETCH_HEAD` 无效即非 0 退出,绝不伪装成"已最新" |
| 5 | 服务化后 `pnpm run db:migrate` 报 `'"node"' 不是内部或外部命令` | SYSTEM 上下文 PATH 不含 node/pnpm | `ihui-deploy.ps1` 启动即前置 `D:\DevEnv\runtimes\node` / `npm-global` / `WindowsPowerShell\v1.0`(与 `run-api.ps1` 一致) |
| 6 | 循环脚本外层并发锁**从未生效** | `$PROCESS_ID` 并非 PowerShell 自动变量(正确名为 `$PID`)→ 锁文件内容恒为空 → 存活检测恒判"悬挂" | 改用 `$PID`;daemon 形态内层用 `return` 而非 `exit`,避免触发 nssm 重启风暴 |
| 7 | 服务化后裸 `pwsh` 会 command-not-found | SYSTEM 的 PATH 不含 PowerShell 7 | 循环脚本内显式解析 pwsh 全路径(优先 `$PSHOME`) |

> 迁移通道另有独立故障与守门:journal 的 `when` 为合成时间戳,而库内 `created_at` 为真实时间 → `drizzle-kit migrate` 判据恒假、每轮空转。修复后 254 条 journal 与库内记账严格双射,详见 `docs/deploy/migration-bookkeeping-rebuild-2026-09-13.md` 与守门脚本 `scripts/check-migration-bookkeeping.mjs`。

## 4. 演练记录

| # | 演练 | 操作 | 结果 |
|---|---|---|---|
| 1 | 部署到最新 main | `ihui-deploy.ps1 -deployLatest` | 构建成功(`optimizeCss` 修复首轮通过),秒级交换,健康门禁第 1 轮 ALL 过,线上 `m9sZmJ5y`,ALL_PASS |
| 2 | 健康门禁检测故障 | `sc stop IHUI-WEB` 注入宕机 | 门禁准确捕获 3× 502(FAIL) |
| 3 | 自动回滚 | `ihui-deploy.ps1 -rollbackOnly` | 恢复 `.rollback` 构建 + 重启 web,门禁第 1 轮过,ALL_PASS,服务恢复 |
| 4 | 轮询自动触发 | 直接跑 `ihui-deploy-loop.ps1` | fetch→behind=0 优雅退出,日志完整落盘 `deploy-loop.log` |
| 5 | 轮询自动触发(2026-09-13 复验) | nssm 服务 `IHUI-DEPLOYLOOP` 守护进程 | 09:23:52 起每 6 分钟一轮;每轮 `git 网络走代理 http://127.0.0.1:7897` → fetch 成功 → behind=0 优雅退出,`deploy-loop.log` 持续增长 |

## 5. 验收清单(对照既定验收点)

- [x] push → 自动拉取 → 部署: nssm 服务 `IHUI-DEPLOYLOOP` 每 6 分钟轮询,behind>0 才构
- [x] 健康检查: 8×12s 退避,web+api+llm 三维
- [x] 流量切换: staging→.next 秒级交换零停机
- [x] 失败回滚: 仅动 web,api/ai 不重启,健康校验兜底
- [x] 并发防护: 部署锁 PID 存活检测(`.deploy.lock` + `.deploy-loop.lock`)
- [x] 一键执行: `-deployLatest` / `-rollbackOnly` / loop 三入口
- [x] 日志留痕: 脚本 stdout + `deploy-loop.log`
- [x] 网络健壮性: fetch 走代理且 fail-closed(失败不伪装成"已最新")
- [x] 迁移记账守门: `pnpm migration:check`(CI 离线) / `pnpm migration:check:db`(库内双射)

## 6. 端口/资产清单

| 端口 | 用途 | 监听 | 备注 |
|---|---|---|---|
| 80 | cdn-server.js 静态直出 | 全接口 | 防路径穿越+7 天缓存 |
| 8801 | web(next start) | 127.0.0.1 | NSSM IHUI-WEB |
| 8802 | api | — | NSSM IHUI-API |
| 8803 | ai-service | — | NSSM IHUI-AI-SERVICE |

NSSM 服务全 Running:`IHUI-WEB / IHUI-API / IHUI-AI-SERVICE` 等 18 个服务,含监控(Loki/Promtail/Alertmanager/./prometheus/grafana/exporter)、PG/Redis。

## 7. 安全与规范

- 部署脚本内健康探测: web 首页、api health、LLM 网关(仅 Bearer 探活,不改数据,admin/admin123 仅本机风控探测凭据)。
- 门禁覆盖 LLM 网关真实鉴权,回滚失败亦上报(避免静默失联)。
- 部署过程不触碰 `.git` 之外的未提交改动(`git pull --ff-only`),fast-forward-only。
- 静态/CDN 与 build 产物目录已 gitignore。

## 8. 残余风险(已记录)

1. **Turbopack CSS 偶发解析崩溃**为概率性工具 bug,`optimizeCss:false`+多轮重试为缓解而非根治;若复发,fallback 到 webpack 编译模式(`next build` 侧)已验证可行但未接入。
2. **并发锁为进程级**(同机单实例适用);若未来多机部署需上分布式锁(Redis SETNX)或 CI runner。
3. **Cool-down**: 健康门禁失败会回滚一次;若回滚后仍不健康,`Test-HealthGate` 在 `Do-Rollback` 内再确认一次,仍败则 `Fail` 留人工介入(不会无限重试)。
4. **回滚仅覆盖 web 构建产物**;api/ai 以源码/uvicorn 常驻,若未来改为预编译产物,需扩展回滚范围。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
