# 智汇 AI 社区 - 贡献者工程规范

> 本文档说明 monorepo 工程约定、常见陷阱、以及 Windows 终端 nul 残留等已知问题。
> 新成员加入请先通读一遍，老成员修改前请先同步更新。

---

## 1. 项目结构

```
g:\1\
├── client/          # iHui AI 前端（Vue 3 + Vite + TypeScript）
│   ├── src/
│   ├── scripts/     # 工具脚本（check-*.ts、scan-*.cjs、check-nul.mjs 等）
│   ├── logs/        # 运行时日志（已 .gitignore 忽略，不会被提交）
│   └── .husky/      # simple-git-hooks 钩子目录
├── server/          # 后端（Python 3.11 + FastAPI + SQLAlchemy + Alembic）
│   ├── app/
│   ├── scripts/     # 工具脚本（按 ci/dev/hooks/ops/startup 分类）
│   ├── scripts/dev/ # 开发工具（含 check_nul.mjs / del_nul.mjs）
│   ├── logs/
│   └── .pre-commit-config.yaml
├── coze_zhs_py/     # Coze 集成（Python 子项目）
├── docs/            # 项目级规范与设计文档
├── .github/workflows/# CI 配置
└── .gitignore
```

**`code/edu/` 是独立 Java + Vue 项目**，有自己的 `.pre-commit-config.yaml`（位置：`g:\code\edu\.pre-commit-config.yaml`）。

---

## 2. 开发环境

### 2.1 必备工具

| 工具 | 版本 | 路径 |
|---|---|---|
| Node.js | 20.x | 系统默认 |
| Python | 3.11 | `1/server/.venv`（推荐 venv） |
| Git for Windows | 最新 | `C:\Program Files\Git` |
| PowerShell | 5.1+ | 系统默认（**注意 PATH 被 IDE 限制**） |

### 2.2 终端陷阱

- **PowerShell `$_` `&&` `||` 等在 IDE 终端会被 `safe_rm_aliases.ps1` hook 改写**
  - 解决：用 `-File xxx.ps1` 调用脚本文件，**不要**用 `-Command "..."` 内联
  - **不要**用 `&&` / `||` / `$Error[0]` 等行内语法
- **`bash` 不在 IDE 终端的 PATH 中**（即使 Git for Windows 已装）
  - 钩子脚本（`pre-commit`）用 Node 跨平台脚本，**不要**依赖 `find` `grep` `sh` 等
- **cmd 终端用 `>nul` 是 NUL 设备，不会创建文件**；**PowerShell 终端用 `>nul` 会创建名为 `nul` 的文件**

---

## 3. Windows NUL 残留文件（重要！）

### 3.1 问题描述

在 PowerShell 或某些 IDE 终端中执行 `command >nul` 重定向时，**PowerShell 解释器不会把 `nul` 识别为 NUL 设备**，而是把它当作文件名，在当前目录创建一个名为 `nul` 的空文件。

常见触发场景：
- `npm script` 里写 `chcp 65001 >nul`（在 cmd 中正常，在 PowerShell 中创建 nul 文件）
- 手动在 PowerShell 里执行 `dir >nul`
- 某些 IDE 终端混用 cmd / PowerShell 模式

### 3.2 为什么难以清理

- `nul` 是 Windows 保留设备名（与 `CON` `PRN` `AUX` `COM1-9` `LPT1-9` 同列）
- **PowerShell `Test-Path` `Get-Content` `Get-Item` API 看不到 nul 文件**（NTFS 元数据缓存异常）
- **PowerShell `Remove-Item` `cmd del` 也无法删除**（Windows 硬限制）

### 3.3 解决方案：用 Node.js 跨平台脚本

**Node.js 的 `libuv` 库能正确看到并删除 nul 文件**（PowerShell API 不可靠）。

各项目已集成扫描/删除脚本：

| 项目 | 扫描 | 删除 |
|---|---|---|
| `1/client` | `scripts/check-nul.mjs` | `scripts/del-nul.mjs` |
| `1/server` | `scripts/dev/check_nul.mjs` | `scripts/dev/del_nul.mjs` |
| `code/edu` | `scripts/dev/check_nul.mjs` | `scripts/dev/del_nul.mjs` |

**手动清理示例**：
```bash
# 1/client 项目下
cd g:\1\client
node scripts\del-nul.mjs

# 1/server 项目下
cd g:\1\server
node scripts\dev\del_nul.mjs

# code/edu 项目下
cd g:\code\edu
node scripts\dev\del_nul.mjs
```

### 3.4 防御措施

所有项目的 `.gitignore` 都已添加 `nul con prn aux` 兜底规则，防止 nul 文件被误提交。

**CI 拦截**：
- `1/client/.github/workflows/ci.yml` 的 `nul-residue-scan` job 扫描 nul 残留（小写 `>nul` 用法仅警告）
- 各项目 pre-commit 钩子扫描 nul 残留（不阻断，仅警告）

### 3.5 代码编写规范

**推荐用法**（按解释器）：

| 解释器 | 推荐 | 不推荐 |
|---|---|---|
| **cmd / .bat** | `>NUL`（大写） | `>nul`（小写，混用 IDE 终端时会创建文件） |
| **PowerShell** | `> $null` 或 `Out-Null` | `>nul`（会创建 nul 文件） |
| **bash** | `> /dev/null` 或 `2>&1 >/dev/null` | — |

**当前项目 `chcp 65001 >nul` 用法**（13 处在 `1/client/package.json`）：
- 在 cmd 中是 NUL 设备（**OK**）
- 但在 PowerShell 中会创建 nul 文件（**不安全**）
- **建议改为 `chcp 65001 >NUL`**（大写，更明确，跨解释器一致）

---

## 4. 散落文件管理（清理规范）

### 4.1 禁止在仓库根目录散落

下列类型文件**必须放在对应子目录**，不要放在 `1/` `1/client/` `1/server/` 根目录：

| 类型 | 正确位置 |
|---|---|
| 后端运行时日志 | `1/server/logs/` |
| 前端运行时日志 | `1/client/logs/` |
| 前端构建输出日志 | `1/client/logs/`（不要 `1/client/` 根） |
| 回归跑批结果 | `1/server/_archive/round*/`（按轮次归档） |
| 一次性修复脚本 | `1/server/scripts/dev/`（用后删除） |
| 一次性 SQL | `1/server/alembic/versions/`（Alembic 迁移）或 `1/server/_archive/` |
| 临时调试文件 | `tmp/` 或 `/tmp/`，**项目内临时用 `scripts/dev/`** |

### 4.2 散落文件识别清单

发现下列文件应立即清理：
- `1/` `1/client/` `1/server/` 根目录的 `*.log` `*.txt` `*.err` `*.py` `*.ps1`
- 以 `tmp_` `fix_` `debug_` `test_diag_` `round*_` `r7_` `r8_` `r9_` `r10_` `r12_` `r13_` 开头的文件
- 含明文数据库密码、API Key、JWT Token 的脚本
- `.zhs_db_fallback.sqlite`（0 字节空文件，可删；非 0 字节是业务 fallback 库，保留）

### 4.3 清理流程

```bash
# 1. 用 del-nul.mjs 删 nul 残留
node scripts\del-nul.mjs

# 2. 手动 ls 检查根目录
ls g:\1\*.log *.txt *.py *.ps1
ls g:\1\client\*.log *.txt *.py *.ps1
ls g:\1\server\*.log *.err *.txt *.py *.ps1

# 3. 确认无散落后提交
git add -A
git commit -m "chore: 清理散落文件"
```

---

## 5. 提交规范

### 5.1 Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**type**：`feat` `fix` `chore` `docs` `style` `refactor` `perf` `test` `ci` `build`

**示例**：
```
fix(auth): 修复登录态丢失的边界条件

当用户 token 过期时，shouldRefresh 应优先于 shouldLogout 返回 true。

Closes #123
```

### 5.2 Pre-commit 钩子

| 项目 | 框架 | 钩子 |
|---|---|---|
| `1/client` | `simple-git-hooks`（钩子放 `.husky/`） | `lint-staged` + `check:no-important` + `check-nul` |
| `1/server` | Python `pre-commit` framework（`.pre-commit-config.yaml`） | `black` `isort` `ruff` `pre-commit-hooks` + `check-nul` |
| `code/edu` | Python `pre-commit` framework | `check-nul`（最小集，后续按需加） |

**前端用户规则**（来自用户偏好）：
- ❌ **禁止**使用 `!important`
- ❌ **禁止**高特异性选择器
- ❌ **禁止**复杂嵌套
- ✅ 使用项目现有全局样式的唯一设定

**前端样式检查**：
- `1/client/scripts/check-no-important.ts`（`!important` 扫描）
- `1/client/scripts/check-hardcoded-colors.ts`（硬编码颜色扫描）
- `1/client/scripts/check-i18n.ts`（国际化缺失键扫描）
- `1/client/scripts/check-csp.ts`（CSP 配置扫描）

### 5.3 CI 检查

- `1/client/.github/workflows/ci.yml`
  - `lint-and-typecheck`
  - `style-audit`（no-important + no-hardcoded-colors）
  - `nul-residue-scan`（nul 文件 + `>nul` 用法）
- `1/server/.github/workflows/ci.yml`（多个：fast / nightly / smoke / security-audit / dead-code-cve-scan / ws-loadtest / observability-drills / weekly-phase8-drill / s3-lifecycle-drift / etc.）

---

## 6. 端口规范 (强制遵守, 2026-06-25 新增)

> **后端必须监听 8000 端口, 前端 dev server 必须监听 8888 端口. 不得以任何理由临时改为其他端口.**

### 6.1 端口分配

| 端口 | 用途          | 启动命令                                     | 禁止事项             |
|------|---------------|----------------------------------------------|----------------------|
| 8000 | FastAPI 后端  | `python server/scripts/restart_backend.py`   | 禁止改 Vite 代理指此 |
| 8888 | Vite dev server | `pnpm dev` (在 client 目录)                | 禁止改 BASE_URL 默值 |
| 4173 | Vite preview (CI 集成测试) | `pnpm build && pnpm preview`         | 本地 dev 不要用此端口 |
| 9090 | Prometheus    | (运维侧)                                     | 业务不要监听         |

详细约定见 [client/docs/DEV_PORTS.md](../client/docs/DEV_PORTS.md), 端口配置唯一来源 [client/config/ports.ts](../client/config/ports.ts).

### 6.2 运行时启动规范 (重点)

本规范适用于**所有**启动后端的方式, **包括 AI 助手自动启动**:

```bash
# ✅ 正确: 用 8000 端口
cd server && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# ❌ 违规: 临时改端口为 8001 / 8002 / 9000 等
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8001

# ❌ 违规: 用环境变量临时覆盖
$env:BACKEND_PORT=8001; npm run dev
```

**8000 被占用时, 必须先释放 8000, 不得改端口绕过:**

```bash
netstat -ano | findstr ":8000" | findstr "LISTENING"
Stop-Process -Id <PID> -Force
```

### 6.3 违规案例

2026-06-25: AI 助手擅自改 8001 端口启动后端, 导致前后端断链. 详见 [DEV_PORTS.md 违规案例](../client/docs/DEV_PORTS.md#违规案例留档-2026-06-25).

### 6.4 检测工具

- [client/scripts/check-port-drift.mjs](../client/scripts/check-port-drift.mjs) - 字面量端口漂移检测 (pre-commit)
- [client/scripts/check-runtime-port.mjs](../client/scripts/check-runtime-port.mjs) - 运行时进程端口检测 (已集成到 `scripts/dev-up.ps1` Step 4, dev-up 启动后自动跑, 失败仅 warn 不阻断)

---

## 7. 安全提醒

### 6.1 数据库凭据

**严禁**把数据库密码硬编码到脚本里。发现此类脚本请立即删除并修改密码。

**已发现历史问题**（已修复）：
- `code/edu/scripts/fix_db.js` `fix_name.js` `init_lesson_data.js` 含明文生产数据库账号（`47.94.40.108` / `Raindrop_L` / 密码 `Raindrop_L250604` / 库 `cloud_learning_content`），已删除。

**预防**：
- 用 `.env` + `python-dotenv` / `dotenv` 加载
- CI 用 GitHub Secrets / Vault
- **不要**把 `.env` 提交到 git（`.gitignore` 已忽略）

### 7.2 日志脱敏

- `1/server/app/utils/log_mask.py`（API 路径、邮箱、手机号、Token 脱敏）
- `1/server/app/utils/api_mask.py`（API 响应脱敏）

### 6.3 Git 提交前自查

- `git diff --staged` 检查无密码、Token、API Key
- `pre-commit` 钩子的 `detect-private-key` 已自动拦截

---

## 7. 调试与排错

### 7.1 前端调试

- 日志统一在 `1/client/logs/`
- `1/client/scripts/` 下的开发工具：
  - `analyze-code.js` - 代码分析
  - `analyze-css-variables.ts` - CSS 变量使用情况
  - `check-i18n.ts` - 国际化键检查
  - `check-no-important.ts` - `!important` 检查
  - `check-csp.ts` - CSP 检查
  - `check-perf-budget.ts` - 性能预算检查
  - `diag-sass.cjs` / `diag-vite.cjs` - SCSS / Vite 诊断
  - `performance-monitor.js` - 性能监控
  - `pre-deploy-check.js` - 部署前检查

### 8.2 后端调试

- 日志统一在 `1/server/logs/`（按微服务划分）
- `1/server/scripts/dev/` 下的开发工具：
  - `seed.py` - 演示数据
  - `audit_files.py`（已删）→ 临时审计
  - `check_nul.mjs` / `del_nul.mjs` - nul 清理
  - `alembic_autogen.py` - Alembic dry-run

### 8.3 CI / 部署调试

- 看 GitHub Actions 跑批日志
- 找对应 `1/.github/workflows/` yml 文件
- `1/.github/act/event-push.json` 是本地 act 工具的事件文件

---

## 9. 文档组织

- `1/docs/` 项目级规范与设计文档
- `1/PROJECT_HANDOFF.md` 项目交接说明
- `1/ROUND10_P3_SUMMARY.md` Round 10 阶段总结
- `1/交接文件_功能迁移差距分析报告.md` 功能迁移差距分析
- `1/server/docs/HONEST_AUDIT.md` `INDEX_AUDIT.md` `MULTI_TENANT.md` `PRODUCTION.md` 等后端深度文档

---

## 10. 常见问题 FAQ

### Q1: 跑了 `npm run dev` 之后 `1/client/` 根目录出现 `nul` 文件？
A: `package.json` 里 `chcp 65001 >nul`（小写）在 PowerShell 终端会被当作文件名。建议改 `>NUL`（大写），或用 `chcp 65001 > $null`（PowerShell 风格）。

### Q2: `Test-Path 'g:\1\nul'` 返回 false，但 `Get-ChildItem -Force` 能看到？
A: 这是 Windows PowerShell API 与 libuv 之间的差异。PowerShell 5.1 的 .NET API 把 nul 设备别名当作"已删除"处理，但实际文件存在。用 Node.js 脚本能正确看到/删除。

### Q3: `cmd /c "del nul"` 提示"The syntax of the command is incorrect"？
A: nul 是 Windows 保留设备名，cmd 也无法删除。用 `node scripts/del_nul.mjs`。

### Q4: pre-commit 钩子不触发？
A: 确认 `git config core.hooksPath` 指向正确目录（client 用 `.husky/`，server 用 `.git/hooks/` 由 pre-commit framework 管理）。

### Q5: CI 跑 nul-residue-scan 报错了？
A: 大概率是有真实的 nul 文件被提交。跑 `node scripts/del-nul.mjs` 清理，重新提交。

---

## 11. 后续 TODO

- [ ] `1/client/package.json` 里 13 处 `chcp 65001 >nul` 改为 `chcp 65001 >NUL`（大写）
- [ ] `1/client/.env.example` 增加 nul 相关说明
- [ ] 各项目 README 增加"散落文件管理"章节链接到本 CONTRIBUTING.md
- [ ] 增加 pre-push 钩子跑 `npm run typecheck`（client 已有）
- [ ] `code/edu` pre-commit framework 补充 black/isort/ruff（与 server 一致）

---

**维护**：本文件由项目团队共同维护。修改前请在 `1/docs/` 提交 PR。
