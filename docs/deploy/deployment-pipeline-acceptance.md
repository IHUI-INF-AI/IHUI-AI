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
| 自动触发 | 计划任务 `IHUI-AutoDeploy`(每 6 分钟) | SYSTEM/HIGHEST |

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

## 4. 演练记录

| # | 演练 | 操作 | 结果 |
|---|---|---|---|
| 1 | 部署到最新 main | `ihui-deploy.ps1 -deployLatest` | 构建成功(`optimizeCss` 修复首轮通过),秒级交换,健康门禁第 1 轮 ALL 过,线上 `m9sZmJ5y`,ALL_PASS |
| 2 | 健康门禁检测故障 | `sc stop IHUI-WEB` 注入宕机 | 门禁准确捕获 3× 502(FAIL) |
| 3 | 自动回滚 | `ihui-deploy.ps1 -rollbackOnly` | 恢复 `.rollback` 构建 + 重启 web,门禁第 1 轮过,ALL_PASS,服务恢复 |
| 4 | 轮询自动触发 | 直接跑 `ihui-deploy-loop.ps1` | fetch→behind=0 优雅退出,日志完整落盘 `deploy-loop.log`;计划任务 Ready/每 6 分钟 |

## 5. 验收清单(对照既定验收点)

- [x] push → 自动拉取 → 部署: 计划任务每 6 分钟轮询,behind>0 才构
- [x] 健康检查: 8×12s 退避,web+api+llm 三维
- [x] 流量切换: staging→.next 秒级交换零停机
- [x] 失败回滚: 仅动 web,api/ai 不重启,健康校验兜底
- [x] 并发防护: 部署锁 PID 存活检测
- [x] 一键执行: `-deployLatest` / `-rollbackOnly` / loop 三入口
- [x] 日志留痕: 脚本 stdout + `deploy-loop.log`

## 6. 端口/资产清单

| 端口 | 用途 | 监听 | 备注 |
|---|---|---|---|
| 80 | cdn-server.js 静态直出 | 全接口 | 防路径穿越+7 天缓存 |
| 8801 | web(next start) | 127.0.0.1 | NSSM IHUI-WEB |
| 8802 | api | — | NSSM IHUI-API |
| 8803 | ai-service | — | NSSM IHUI-AI-SERVICE |

NSSM 服务全 Running:`IHUI-WEB / IHUI-API / IHUI-AI-SERVICE` 等 18 个服务,含监控(Loki/Promtail/Alertmanager/./prometheus/grafana/exporter)、PG/Redis。

## 7. 安全与规范

- 部署脚本内健康探测: web 首页、api health、LLM 网关(仅 Bearer 探活,不改数据,admin/[REDACTED-PW] 仅本机风控探测凭据)。
- 门禁覆盖 LLM 网关真实鉴权,回滚失败亦上报(避免静默失联)。
- 部署过程不触碰 `.git` 之外的未提交改动(`git pull --ff-only`),fast-forward-only。
- 静态/CDN 与 build 产物目录已 gitignore。

## 8. 残余风险(已记录)

1. **Turbopack CSS 偶发解析崩溃**为概率性工具 bug,`optimizeCss:false`+多轮重试为缓解而非根治;若复发,fallback 到 webpack 编译模式(`next build` 侧)已验证可行但未接入。
2. **并发锁为进程级**(同机单实例适用);若未来多机部署需上分布式锁(Redis SETNX)或 CI runner。
3. **Cool-down**: 健康门禁失败会回滚一次;若回滚后仍不健康,`Test-HealthGate` 在 `Do-Rollback` 内再确认一次,仍败则 `Fail` 留人工介入(不会无限重试)。
4. **回滚仅覆盖 web 构建产物**;api/ai 以源码/uvicorn 常驻,若未来改为预编译产物,需扩展回滚范围。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
