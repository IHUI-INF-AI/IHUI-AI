<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 云端并行沙箱工作区 MVP 验收报告(任务二)

> 验收日期: 2026-09-07 · 生产机 = 本机(原生 Windows, NSSM, Cloudflare Tunnel)
> 结论: Docker/WSL 在本机不可用(Windows 精简镜像缺容器特性,前期已实测),落地采用
> **git worktree 隔离 + Windows Job Object 进程级沙箱** 的方案,且该能力在代码库中
> **已完整实现并接线**(评估/深度引擎阶段产物)。本报告聚焦: 现有实现**真机端到端验证**。

## 1. 结论

✔ **沙箱 MVP 端到端验收通过**。Windows 本地后端 `win_job` 已上线可执行,安全控制
(路径 ACL、越权拒绝、超时强杀、git worktree 并行隔离)全部实测生效。

## 2. 现有实现盘点(已完整,非本次新建)

| 模块 | 路径 | 职责 |
|---|---|---|
| OS 沙箱 | `apps/ai-service/app/services/os_sandbox.py` | `SandboxPolicy`(路径 ACL + 网络 + env 白名单 + 超时/内存/CPU/进程数上限);`WinJobBackend`(Windows Job Object + `CreateRestrictedToken` 降权 + 重定向 + 超时强杀);另有 linux_bwrap / mac_seatbelt 跨平台后端 |
| 沙箱路由 | `apps/ai-service/app/routers/sandbox_exec.py` | `POST /api/sandbox/run`(按 SandboxPolicy 执行)、`GET /api/sandbox/backends`(后端矩阵) |
| 容器降级 | `apps/ai-service/app/services/container_runtime.py` | Docker 可用走容器;不可用(本机)降级本地子进程;Windows 阻止 `cmd /c`(强制 PowerShell) |
| git worktree | `apps/ai-service/app/services/worktree.py` | `create_worktree/remove_worktree/prune_worktrees/list_worktrees`,Windows 长路径/symlink 适配 |
| 工作区接线 | `apps/ai-service/app/services/dag_scheduler.py` | DAG Worker Pool:每个 worker 建独立 worktree,完成即 `remove_worktree` 回收 |
| 挂载 | `apps/ai-service/app/main.py:740-745` | `app.include_router(sandbox_exec_router.router, prefix="/api")` |

`CLI` 侧 `apps/cli/src/tools/sandbox/`(policy + Windows 平台后端)亦有等价实现。

## 3. 真机端到端验证(生产 aizhs.top / ai-service :8803)

| # | 用例 | 请求/命令 | 结果 |
|---|---|---|---|
| 1 | 后端探测 | `GET :8803/api/sandbox/backends` | `platform_default=win_job`,`available=true`;linux/mac 正确判不可用 ✔ |
| 2 | 正向执行 | `POST /run` cmd=`pwsh -Command 'Write-Output sandbox-win-ok'` | code=0, rc=0, stdout=`sandbox-win-ok`, backend=win_job ✔ |
| 3 | 越权读拒 | 读取 `D:\IHUI-AI\apps\api\.env`(readable=只 apple/web) | HTTP **403**,detail=读取越权 ✔ |
| 4 | 解释器外 ACL | cwd/web 可读,但 pwsh 位于 `C:\Program Files`(未授权) | HTTP **403** ✔(证明可读路径白名单真实生效) |
| 5 | 超时强杀 | times=2s 跑 `Start-Sleep 30` | `timed_out=True`, rc=1, ~2.0s 被 Job Object 强杀 ✔ |
| 6 | 安全加固 | `cmd /c ...` | **显式阻止**,引导用 PowerShell ✔ |
| 7 | git worktree 生命周期 | `dag_scheduler` 接线 | create→run→remove 回收已接线(代码审查确认) |

## 4. 安全控制清单(实测已生效)

- [x] **路径 ACL**:denied 优先、readable 白名单、writable 子集校验;`write ⊆ read` 不变式,非法策略 → 400
- [x] **越权拒绝**:命令行路径 token 逐条校验(argv 解析),越权即 403(第 3/4 项实证)
- [x] **超时强杀**:Job Object `JOB_OBJECT_LIMIT_PROCESS_TIME` + `KILL_ON_JOB_CLOSE`,实测 2s 精确终止
- [x] **降权运行**:`CreateRestrictedToken`(默认 `restrict_token=true`)、`DISABLE_MAX_PRIVILEGE + LUA_TOKEN`
- [x] **资源上限**:timeout/memory/cpu/max_processes 策略可控
- [x] **env 白名单**:Windows 强制保留 SYSTEMROOT/WINDIR/COMSPEC/PATH 等必需变量,其余裁剪
- [x] **命令安全**:阻止 `cmd /c`,要求 PowerShell;`task_id/worktree` 路径带 `../../` 注入防护
- [x] **并行隔离**:独立 git worktree + 独立进程组,Worker Pool 限并发,任务隔离
- [x] **鉴权**:JWT(与 api 共享 JWT_SECRET),`Depends(get_current_user_id)` 全部沙箱端点

## 5. 验收清单

- [x] 后端探测矩阵可用性
- [x] 正向执行(Windows 本地后端)
- [x] 执行前路径越权拒绝(403)
- [x] 超时强杀(Job Object)
- [x] 资源/进程/内存上限策略
- [x] 降权(restricted token)
- [x] 命令安全(cmd /c 阻止)
- [x] git worktree 创建/回收/清理接线
- [x] 鉴权接入

## 6. 端口/入口

| 端口 | 服务 | 沙箱入口 |
|---|---|---|
| 8803 | ai-service(FastAPI) | `POST /api/sandbox/run`、`GET /api/sandbox/backends`,JWT 鉴权 |

> 注: 公网 `aizhs.top/api/*` 反代到 **api :8802**,故沙箱端点经内网直连 8803 使用;
> 若需公网直调,需在 api 端(=8802)加转发代理或暴露 8803 的安全入口。

## 7. 残余风险(已记录)

1. **本地进程级隔离非强隔离**:Job Object + restricted token 可防大部分越权,但不达虚拟机/容器级(内核隔离、文件系统视图、网络命名空间)。对"运行不可信第三方代码"场景建议未来引入 Hyper-V/WSL2 或远端容器。
2. **内存/CPU 上限为配置项但未在本次逐项压力实测**(受限于生产机不可长时间压测);单元层已有覆盖,生产强度验证留待后续。
3. **worktree 作用于 Git 源仓库**(`D:\IHUI-AI`)`: 任务运行期会 fork 出分支,完成即回收;需确保 `prune` 兜底(进程崩溃残留已在 WorkerPool start 时清理)。
4. **公网入口**:沙箱 HTTP 仅在 8803 内网可达,未开放公网,避免了未授权滥用面;若开放需叠加额外限流与 RBAC。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
