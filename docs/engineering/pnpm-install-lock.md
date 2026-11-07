<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 并发 install 隔离：跨进程安装锁（方案③，默认启用）

> 状态：**互斥默认启用**（2026-11-07 四次安装互踩后按门槛改）。强制点是根 `package.json` 的 `preinstall` 守卫——直连 `pnpm install` 也会被拦，锁目录落在共享根 `.ihui-install.lock`。`IHUI_PNPM_INSTALL_LOCK=0` 为应急关闭（仅排障，非常规）。**"typecheck 查 install" 的那一半仍是 opt-in**（`IHUI_GATE_INSTALL_LOCK=1` 打开，观察期 14 天），不进默认路径。CI 只在 `ci-monorepo.yml` 的 typecheck job 接锁（GitHub 托管 runner 是 no-op，见 §2.3）。

## 1. 事故形态

多个 worktree 共用 `D:\IHUI-AI\node_modules`（各 worktree 里是指向它的 Junction）。A 席 `pnpm install` 会先拆再建顶层链接，B 席同一时刻跑 typecheck 去解析 `node_modules/typescript/bin/tsc`，就会落在"已拆未建"的窗口 ⇒ `ENOENT` / `MODULE_NOT_FOUND`。

门是对的（typecheck 必须读真实 tsc）；错的是两个读写方并发。本锁只解决**编排**，不改任何判据。

## 2. 用法

```bash
# 默认（启用）：安装命令进锁，拿不到锁 exit 3
node scripts/lib/pnpm-install-lock.mjs run -- pnpm install

# 应急关闭（仅排障，非常规）：回到未接线行为
IHUI_PNPM_INSTALL_LOCK=0 node scripts/lib/pnpm-install-lock.mjs run -- pnpm install

# 门位判据（OPT-IN，默认不跑）：安装期间禁止 typecheck
node scripts/lib/pnpm-install-lock.mjs check

# preinstall 守卫（根 package.json 已接线，直连 install 会在这里被拒）
node scripts/lib/pnpm-install-lock.mjs guard

# 现场：pid / pidStart / 开始时刻 / 已持有时长 / 心跳 / cmd
node scripts/lib/pnpm-install-lock.mjs status

# 安装前后取证：本前缀之外的 worktree node_modules 应零变化
node scripts/lib/pnpm-install-lock.mjs snapshot -- before.json
node scripts/lib/pnpm-install-lock.mjs compare -- before.json
```

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `IHUI_PNPM_INSTALL_LOCK` | 启用 | 仅 `0` 关闭（应急口）；不设或 `1` 均启用 |
| `IHUI_GATE_INSTALL_LOCK` | **关闭（opt-in）** | 钩子 `check` 位；仅 `1` 打开（观察期 14 天） |
| `IHUI_PNPM_INSTALL_LOCK_DIR` | `<共享根>/.ihui-install.lock` | 机器级锁目录；共享根 = `git rev-parse --git-common-dir` 的父目录，跨 worktree 一致 |
| `IHUI_PNPM_INSTALL_TOKEN` | 内部 | wrapper 持锁后注入给子进程，`preinstall` 守卫据此自证身份 |
| `IHUI_PNPM_INSTALL_LOCK_TIMEOUT_MS` | `30000` | 拿锁预算，超时 **exit 3** 并打印持有者现场 |

| 退出码 | 含义 |
| --- | --- |
| 0 | 成功 / check 放行（含无锁、锁已陈旧、显式关闭） |
| 2 | 用法错误 |
| 3 | 拿锁超时（**明确失败**，不静默等死） |
| 4 | check 判定：安装进行中，禁止并发 typecheck |
| 其他 | `run` 包裹的命令退出码透传 |

### 2.1 门位接入（opt-in，观察期 14 天：2026-11-07 → 2026-11-21）

"安装进行中 ⇒ 禁止 typecheck" 这一半只影响**所有人每次提交/推送**，爆炸半径比互斥大，按 2026-11-07 裁定先 opt-in：两个钩子只在 `IHUI_GATE_INSTALL_LOCK=1` 时执行 `check`。

```bash
# 打开（观察期内的数据采集方式：真实 install 期间跑 typecheck，看是否被正确拦截/误拦）
export IHUI_GATE_INSTALL_LOCK=1
IHUI_GATE_INSTALL_LOCK=1 git push

# 观察期判定：14 天内至少覆盖 3 次真实 install，误拦 ≤ 1 次且均有明确持有者现场；
# 达标后在下一轮把默认改 1，未达标则继续 opt-in 并复盘误拦原因。
```

**判据必须可数（2026-11-07 补）**：上面的「≥3 次真实 install、误拦 ≤1」不是记忆判据，而是从
`<共享根>/.ihui-agent/state/install-lock.log` 重放出来的数字。每次 `run` / `check` / `guard` 判定
都会追加一行 JSON（`run-start` / `run-end` / `check-block` / `check-stale` / `guard-deny`），统计命令：

```bash
# 人读（同时给出判据是否达标；未达标 exit 1）
node scripts/lib/pnpm-install-lock.mjs stats --since=2026-11-07

# 机器读（CI / 归档用）
node scripts/lib/pnpm-install-lock.mjs stats --since=2026-11-07 --json
```

口径：

- `installs`：`run-end` 且 `enabled !== false`、命令含 `install`、退出码 0 的次数；
- `installsFailed`：同上但退出码非 0；
- `installsViaEmergency`：应急口（`IHUI_PNPM_INSTALL_LOCK=0`）直跑的 install 次数，**不计入** `installs`；
- `blocks`：`check` 拦截次数；**`falseBlocks`**：拦截发生时没有任何活跃 `run-start` 的条数（= 误拦）；
- `staleRecoveries`：陈旧清理放行次数；`directDenied`：守卫拒绝「未携带锁 token」的直连次数；
- `pass = installs >= 3 && falseBlocks <= 1`，观察期结束（2026-11-21）只认这一行输出。

- 无锁 / 锁已陈旧（exit 0）⇒ 照常放行；
- 安装进行中（exit 4）⇒ 阻止提交/推送，并打印持有者现场（pid / pidStart / 开始时刻 / 已持有时长 / cmd）；
- pre-commit 经 `scripts/hook-run-hidden.vbs` 隐藏执行，输出落在 `.ihui-agent/state/hook-logs/pre-commit-install-lock.log`；pre-push 直接执行，现场打在终端。

> 前提：安装侧也要走锁，否则锁永远不存在、`check` 只会放行：
>
> ```bash
> node scripts/lib/pnpm-install-lock.mjs run -- pnpm install
> ```

### 2.2 升级门槛已触发（2026-11-07）

写死的门槛是「同一台机器第二次出现 ENOENT 类安装互踩 ⇒ 默认改为开」。这台机器已出现四次：

1. api 席推送死在 `Cannot find module …typescript\bin\tsc`；
2. 集成席 `packages/database/node_modules/typescript`、`apps/web/node_modules/@hookform/resolvers` 指向不存在的相对路径，`check-workspace-dep-links` 报 83 个依赖缺失；
3. 跨端 UI 席 `packages/ui-react` 无 dist、缺 `lucide-react` / `@radix-ui/*`；
4. 2026-11-07 09:21 两次 install 并发，其中一次执行 `Recreating D:\IHUI-AI\node_modules`，随后 `rmdir .pnpm` 撞 `ENOTEMPTY`、`RC=-4051`，链接阶段没开始 ⇒ 根顶层只剩 7 条、`lint-staged` 缺失，全机无法提交。

⇒ **互斥**按门槛改为默认开（`preinstall` 守卫强制，见 §2.4）；**"typecheck 查 install"那一半**单独裁定为 opt-in（观察期 14 天），两者不要混为一谈。应急口 `IHUI_PNPM_INSTALL_LOCK=0` 仅排障，使用后需补一条说明：为什么关、关了多久、下一次怎么防。

### 2.3 CI 接线的边界

GitHub 托管 runner（`.github/workflows/*` 全部 `ubuntu-latest`）每个 job 独立 VM，`<共享根>/.ihui-install.lock` 不共享 ⇒ 机器级锁在 CI 里是 **no-op**。`ci-monorepo.yml` 的 typecheck job 把 install 走锁（互斥），而 `check` 步只在仓库变量 `IHUI_GATE_INSTALL_LOCK=1` 时才跑（与本地 opt-in 同一开关）；意义是：若未来切 self-hosted / 本地 `act` 并发跑，同一份编排直接生效。真正的防护对象是**本机多 worktree**。

### 2.4 强制点：`preinstall` 守卫（2026-11-07 立）

只靠"大家约好走 wrapper"不是锁——直连 `pnpm install` 完全无视它。唯一能强制的位置是根 `package.json` 的 `preinstall`，它对直连 install 同样生效。三条判据一起用：

1. **链接面**：`node_modules` 是 reparse point / junction ⇒ 拒绝（写进去就是改共享层），提示「先摘掉链接，在自包含目录里安装」；实名目录 ⇒ 放行。判据是"是不是经 junction 在使用共享层"，**不是"在哪跑"**——否则 `.worktrees/<wt>` 的自包含 install 会被自己的守卫禁掉。
2. **token**：wrapper 持锁后把 `IHUI_PNPM_INSTALL_TOKEN` 注入子进程；直连 install 没有 token ⇒ 拒绝。
3. **留痕**：每次判定追加到 `<共享根>/.ihui-agent/state/install-guard.log`（时间 / decision / cwd / pid / 原因）。

**验收判据（比 token 硬）**：安装前后对"本前缀之外的链接清单"取快照，要求**本前缀之外零变化**，唯一例外见下：

```bash
node scripts/lib/pnpm-install-lock.mjs snapshot -- before.json
# ... 在锁内安装 ...
node scripts/lib/pnpm-install-lock.mjs compare -- before.json   # 有任何变化即 exit 1
```

**显式例外（2026-11-07 裁定，写入判据原文）**：主仓对共享层做收敛安装时，仍挂 junction 的
worktree 必然看到顶层包减少。这种变化**不计为安装越界**，但必须同时满足三条：

1. 变化只发生在挂 junction 的树上；实名目录树不得有任何变化；
2. 变化项只能是「主仓 lockfile 不包含、且属于某分支的残留包」，逐项给出包名 + lockfile 证据；
3. 变化后受影响树的门 78 若转红，**按迁移队列处理，不得以「预期结果」结案**。

本次实例与逐树清单（16 棵树 × 少了什么包 × 是否被真实 import × 现在能否跑）见
[`docs/engineering/worktree-self-contained-node-modules.md`](./worktree-self-contained-node-modules.md) §3–§4。

已知绕过：`pnpm install --ignore-scripts` 跳过 `preinstall`（无法从脚本层阻止）；责任票见 §2.6。

### 2.5 机器自检与修复（`node_modules` 完整性）

pnpm 把「包目录存在但为空」判为已安装，`--frozen-lockfile` 因此认为无工作可做 ⇒ 手工修完又复发。自检命令：

```bash
node scripts/check-node-modules-integrity.mjs          # 只读，找到空包目录/断链/顶层缺失
node scripts/check-node-modules-integrity.mjs --json    # 机器读，exit 1 表示不通过
node scripts/check-node-modules-integrity.mjs --fix     # 只删空的虚拟层目录（非空不动）
```

判据：`.pnpm/<id>/node_modules/<pkg>` 的文件数是否为 0。`--fix` 只删空目录，随后必须重新 materialize：

```bash
node scripts/lib/pnpm-install-lock.mjs run -- pnpm install --frozen-lockfile
```

### 2.6 已知绕过面的责任票（声明不等于有人负责）

「已在文档声明」不构成闭环：每条绕过面必须有到期日与封堵前置，到期未封即视为未完成。

| # | 绕过面 | 影响 | 到期日 | 封堵前置（做到才算闭环） | 现在谁来管 |
|---|---|---|---|---|---|
| A | `pnpm install --ignore-scripts` | `preinstall` 不执行 ⇒ 守卫、留痕、token 全部失效 | **2026-11-21** | ① 机器级「无锁 install」检出：枚举 `pnpm`/`pnpm.cjs`/`corepack` 安装进程，并与 `install-lock.log` 的 `run-start` 对账（无对应 `run-start` 即违规）；② 该检出接入 hook 或定时巡检并产出 `directDenied`/`bypass` 计数 | 安装域（本线），监控未落地前**无自动封堵** |
| B | 合并前直连安装（主仓 `main` 根 `package.json` 无 `preinstall`） | 全机任意 worktree 可直连安装绕过守卫 | **2026-11-14** | 最小提交（守卫接线 + 锁默认开）经 PR 合入 `main`；合入即关闭本票 | 安装域（本线）提 PR，等 review 合入 |

> 合并前的事实状态：**还没拦**。主仓 `main` 没有 `preinstall`，任何人在任意 worktree 直连
> `pnpm install` 都不会被守卫拒绝；`install-lock.log` 里也不会出现 `guard-deny` 记录。
> 只有在本线分支（`.worktrees/wt-infra-defect-mining-1107`）里，守卫才生效。

## 3. 判活与失效方向（判据唯一出处）

锁是**原子 mkdir / 原子初始化**的目录锁，`owner.json` 记录 `pid / pidStart / pidStartAt(展示用 ISO) / host / bootEpochSec / startedAt / heartbeatAt / token / cmd / cwd`。陈旧判定（任一"正向"证据成立才判陈旧）：

1. `host` 不同 ⇒ **不抢**（跨机无法验活，宁可超时明确报错）；
2. `bootEpochSec` 差 > 5s ⇒ 机器重启过，陈旧；
3. 进程不存在 ⇒ 陈旧；
4. **pid 被复用** ⇒ 由 `scripts/lib/proc-identity.mjs` 的 `verifyHolder()` 判定（`pidStart` 三态：match / mismatch / unverifiable；match 才算原主，mismatch 直接陈旧，**unverifiable 一律不抢**）；
5. 心跳 15 分钟未续 ⇒ 陈旧；
6. 读不出 `owner.json` ⇒ 不猜、不删，等超时；只有锁龄 > 6h 才按绝对上限清理。

> **陈旧判定的唯一出处是 `scripts/lib/proc-identity.mjs`**。本锁的进程身份探测、pid 复用比对全部委托给它（`identityFields()` 写入、`verifyHolder()` 判定），不得在本文件或 typecheck 锁里再复制一套探针。心跳只表示"进程还活着"，**不参与身份判定**；它与 `pidStart` 是两种证据，不允许用同一条代码路径混判。

删锁前复核 `token` 同一性，避免删掉并发者刚写下的新锁。`run` 持锁期间每 15s 续心跳，退出/信号时只删自己那把。

## 4. 实测（2026-11-07，本机 `D:\DevEnv\Temp\ihui-install-lock-demo`）

夹具说明：模拟 pnpm 重建 `node_modules` 的"先拆后建"窗口（installer 删目录→重建，typechecker 反复读 `node_modules/workspace-pkg/index.js`）。**不是真实 pnpm install**，不碰共享 store、不联网。

### 4.1 未加锁：ENOENT 复现

```
=== A：未加锁，install 与 typecheck 并发 ===
installer done: 40 cycles
typechecker: attempts=125 failures=28
  ENOENT: ENOENT: no such file or directory, open 'D:\DevEnv\Temp\ihui-install-lock-demo\node_modules\workspace-pkg\index.js'
  ENOENT: ENOENT: no such file or directory, open 'D:\DevEnv\Temp\ihui-install-lock-demo\node_modules\workspace-pkg\index.js'
  ENOENT: ENOENT: no such file or directory, open 'D:\DevEnv\Temp\ihui-install-lock-demo\node_modules\workspace-pkg\index.js'
结论：typecheck exit=1（1=出现 ENOENT）
```

### 4.2 加锁：check 拒绝 + 安装结束后 typecheck 零失败

```
=== B：加锁，install 持锁，typecheck 先过 check ===
[install-lock] 已拿锁 D:\DevEnv\Temp\ihui-install-lock-demo\.lock（pid=40712），执行：... installer.mjs
installer done: 40 cycles
B 的 check 被拒次数=7
B 首次被拒原文：
[install-lock] pnpm 安装进行中：pid=40712 host=服务器 startedAt=2026-11-06T23:10:12.447Z ...
[install-lock] 禁止并发 typecheck（会踩到 node_modules 重建窗口，出现 ENOENT）
typechecker: attempts=145 failures=0
结论：typecheck exit=0（0=无 ENOENT）
```

### 4.3 超时是明确失败（exit 3）

```
check while held -> exit=4
second run with 500ms timeout -> exit=3, elapsed≈1225ms
[install-lock] 获取安装锁超时（500ms）：pid=41224 ... 判定=pid=41224 仍存活且心跳在 3s 内。没有拿到锁，拒绝执行安装命令。
```

持有者被杀后复判：`status` 输出 `stale: true / 持有进程 pid=41224 已不存在`，`check` 清理后 exit 0。

> 复跑命令：在临时目录放 `installer.mjs / typechecker.mjs / driver.mjs`，设 `LOCK_SCRIPT=<repo>\scripts\lib\pnpm-install-lock.mjs`，`node driver.mjs`；超时用例跑 `timeout-demo.mjs`。
> 复跑计数会变（撞窗口命中带随机性，第二次为 12/268、check 被拒 12 次），结论稳定：未加锁必然出现 ENOENT，加锁后为 0。

## 5. 与方案①（每 worktree 独立 `node_modules`）的成本对比

现测底座：store `D:\DevEnv\tools\pnpm\store\v11` = **6.98 GB / 213,500 文件**，与 worktree 同在 `D:` 卷；`.npmrc` 的 `nodeLinker` 实际由 `pnpm-workspace.yaml` 的 `nodeLinker: isolated` 决定。

- **磁盘成本**：同卷时 pnpm 用硬链接，数据块不复制；每个新 worktree 的增量主要是目录项与链接元数据 —— 按 21.3 万文件 × 1–2 KB ≈ **0.2–0.4 GB/worktree**。若把 worktree 放到与 store **不同卷**（如 C:），硬链接失效 ⇒ 退化为全量复制，**≈7 GB/worktree**。
- **store GC**：`pnpm store prune` 回收"无引用"包。多 worktree 只会增加引用计数 ⇒ 回收更保守、孤儿回收更慢，但**不会误删在用数据**。不要在 install 进行中跑 prune。
- **迁移步骤**：① 冻结窗口（启锁或人工停 install）→ ② 每个活跃 worktree 删掉 `node_modules` junction → ③ 在该 worktree `pnpm install --frozen-lockfile`（同 store，硬链接）→ ④ 跑 `typecheck` / `check:dep-links:strict` → ⑤ 回滚：删目录、重建 junction。
- **结论**：方案①能根治共享目录问题，但成本是"每活跃 worktree 0.2–0.4 GB 元数据 + 迁移期全停 + 磁盘余量 ≥ 每席 1 GB"，且异卷会放大到 7 GB/席。**建议方案③先 opt-in 用起来**；等活跃 worktree 常态 ≥ 4 且 `D:` 余量足够时，再切方案①。

## 6. 已知限制

- 跨机共享锁目录不适用（不同 host 一律不抢，只会超时明确失败）。
- Windows 下命令经 `ComSpec /c` 拼接；带空格参数已加引号，复杂引号场景请改用包装脚本。
- 心跳 15s 一拍；进程被挂起（非退出）超过 15 分钟会被判陈旧，这是有意的有界失效方向。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
