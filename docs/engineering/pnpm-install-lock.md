<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 并发 install 隔离：跨进程安装锁（方案③，未激活）

> 状态：**只交付脚本与文档**。`scripts/lib/pnpm-install-lock.mjs` **没有**接进任何现有门，`package.json` 没有新增 script，CI / pre-commit / push 默认行为**未改**。默认关闭，需显式 opt-in。

## 1. 事故形态

多个 worktree 共用 `D:\IHUI-AI\node_modules`（各 worktree 里是指向它的 Junction）。A 席 `pnpm install` 会先拆再建顶层链接，B 席同一时刻跑 typecheck 去解析 `node_modules/typescript/bin/tsc`，就会落在"已拆未建"的窗口 ⇒ `ENOENT` / `MODULE_NOT_FOUND`。

门是对的（typecheck 必须读真实 tsc）；错的是两个读写方并发。本锁只解决**编排**，不改任何判据。

## 2. 用法

```bash
# 默认（未 opt-in）：run 原样执行命令，check 恒通过 —— 行为不变
node scripts/lib/pnpm-install-lock.mjs run -- pnpm install

# 显式启用（当前唯一 opt-in 开关）
IHUI_PNPM_INSTALL_LOCK=1 node scripts/lib/pnpm-install-lock.mjs run -- pnpm install

# 供 pre-commit / push 门**可选**调用：安装期间禁止 typecheck
IHUI_PNPM_INSTALL_LOCK=1 node scripts/lib/pnpm-install-lock.mjs check

# 现场（人读/机器读）
node scripts/lib/pnpm-install-lock.mjs status
```

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `IHUI_PNPM_INSTALL_LOCK` | 未设（关闭） | 必须为 `1` 才启用 |
| `IHUI_PNPM_INSTALL_LOCK_DIR` | `os.tmpdir()/ihui-pnpm-install.lock` | 机器级锁目录；跨 worktree 共享 |
| `IHUI_PNPM_INSTALL_LOCK_TIMEOUT_MS` | `30000` | 拿锁预算，超时 **exit 3** 并打印持有者现场 |

| 退出码 | 含义 |
| --- | --- |
| 0 | 成功 / check 放行（含未启用） |
| 2 | 用法错误 |
| 3 | 拿锁超时（**明确失败**，不静默等死） |
| 4 | check 判定：安装进行中，禁止并发 typecheck |
| 其他 | `run` 包裹的命令退出码透传 |

## 3. 判活与失效方向

锁是**原子 mkdir** 的目录锁，`owner.json` 记录 `pid / host / bootEpochSec / startedAt / heartbeatAt / token / cmd / cwd`。陈旧判定（任一"正向"证据成立才判陈旧）：

1. `host` 不同 ⇒ **不抢**（跨机无法验活，宁可超时明确报错）；
2. `bootEpochSec` 差 > 5s ⇒ 机器重启过，陈旧；
3. 进程不存在 ⇒ 陈旧；
4. 心跳 15 分钟未续 ⇒ 陈旧；
5. 读不出 `owner.json` ⇒ 不猜、不删，等超时；只有锁龄 > 6h 才按绝对上限清理。

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
