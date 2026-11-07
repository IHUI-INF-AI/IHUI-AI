<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# worktree 自包含 `node_modules`：摘 junction + 就地安装

时间：2026-11-07 09:20–09:31（实测窗口）。
现场：`D:\IHUI-AI\.worktrees\wt-ui-defect-mining-1107`。

**适用范围**：本文只记录**本 worktree、这一次**的实测。其它 worktree、并发安装、lockfile 变更、
Windows 以外环境均**未测过**，不得据此宣称「已验证可推广」。

## 0. 要解决的问题

本机此前的拓扑是「一个共享 `node_modules` 给所有 worktree 用」，实现方式是在各 worktree 的
`node_modules`（根层或 per-package 层）建 Junction 指回主仓目录。任何一次 `pnpm install`
都会顺着 Junction 把共享目标改写成「相对本 worktree 的 `.pnpm`」，于是：

- 本 worktree 装完是好的；
- 共享目标里的条目从此指向某一个 worktree 的 store；
- 那个 worktree 一被清理/重装，其它 worktree 的 `typescript`、`lint-staged` 立刻 ENOENT。

2026-11-07 上午的现场已经反复发生这一形态：共享根 `D:\IHUI-AI\node_modules` 顶层条目
09:20 还有 2 项、09:31 只剩 `.pnpm` 一项，`typescript` 不存在，全机 tsc / 提交相继不可用。

结论（本文只给出路径，不替其它 worktree 背书）：**正确拓扑是主仓与每个 worktree 各自自包含**，
共享层只作为「历史遗留」逐步摘除，不再作为运行依据。

## 1. 判据：先读出「这是不是指向共享层的链接」

### 1.1 读法

```powershell
# 根层
$i = Get-Item 'D:\IHUI-AI\.worktrees\<wt>\node_modules' -Force
"LinkType=[$($i.LinkType)] Target=[$($i.Target -join ';')] mtime=$($i.LastWriteTime)"

# per-package 层（逐个包目录扫）
$wt = 'D:\IHUI-AI\.worktrees\<wt>'
foreach ($d in @('apps','packages')) {
  Get-ChildItem (Join-Path $wt $d) -Directory -Force | ForEach-Object {
    $nm = Join-Path $_.FullName 'node_modules'
    $i = Get-Item $nm -Force -ErrorAction SilentlyContinue
    if ($i -and $i.LinkType) { "{0}`t{1}`t{2}" -f $_.Name, $i.LinkType, ($i.Target -join ';') }
  }
}
```

### 1.2 实测形态

| 形态 | `LinkType` | `Target` | 含义 |
| --- | --- | --- | --- |
| 实目录 | `[]` | `[]` | 本 worktree 自包含（目标态） |
| Junction | `Junction` | `D:\IHUI-AI\apps\web\node_modules` 之类 | 指向共享层的通道（要摘） |

本次摘除前的实测：

```
apps/web/node_modules  LinkType=Junction  Target=D:\IHUI-AI\apps\web\node_modules
<wt>/node_modules       LinkType=[]        Target=[]        mtime=2026-11-07 09:27:44
```

### 1.3 两层都要查

**根层与 per-package 层都必须查**。本次 per-package 层（`apps/web`）是 Junction，根层本来
就是实目录；如果只查 per-package、或只查根层，就会留下另一条主通道，install 依然可能写进
共享层。「只摘一处等于没摘」。

## 2. 摘链接，不删目标

```powershell
$j = 'D:\IHUI-AI\.worktrees\<wt>\apps\web\node_modules'   # 先按 §1 确认 LinkType=Junction
[System.IO.Directory]::Delete($j, $false)

# 立刻校验：链接没了、目标还在、目标 mtime 没动
Test-Path $j                                  # 期望 False
Test-Path 'D:\IHUI-AI\apps\web\node_modules'  # 期望 True
(Get-Item 'D:\IHUI-AI\apps\web\node_modules' -Force).LastWriteTime  # 期望与摘前一致
```

本次实测：摘除前链接指向 `D:\IHUI-AI\apps\web\node_modules`；摘除后链接为 False，目标为
True，目标 mtime 仍为 **09:09:57**（与摘前一致），即**只摘了 reparse point，没动共享目标**。

### 2.1 为什么不能用 `Remove-Item -Recurse`

- `Remove-Item -Recurse -Force` 在部分 PowerShell 版本对 reparse point 会**递归进目标**，
  等于把共享 `node_modules` 真删一遍——09:31 共享根只剩 `.pnpm` 一项，就是这类动作的形态。
- 即使当次没删目标，`-Force` 也把「删链接」与「删内容」混在一个动作里，事后无法区分是
  链接断了还是目标被清了。
- 本机 `cmd /c rmdir` 被安全策略拦截；`[System.IO.Directory]::Delete($p, $false)` 的第二参
  `$false` 明确表示「不递归」：对 junction 只摘 reparse point，对实目录则直接失败而不误删，
  这正是我们要的安全失败。

## 3. 安装与取证：证明「没有写进共享层」

### 3.1 步骤

1. 按 §1 确认根层与 per-package 层都没有指向共享的 junction。
2. **装前**取一次「本 worktree 之外」的读数：共享根顶层条目数 + mtime、`.pnpm` 条目数、
   共享 per-package 目标（如 `D:\IHUI-AI\apps\web\node_modules`）的条目数 + mtime。
3. 在自己 worktree 里执行 `pnpm install --frozen-lockfile`（cwd = 本 worktree 根）。
4. **装后**立刻取同一组读数。
5. 判据：共享侧的 mtime 未变（或变化时刻晚于本次装完时刻，且同时段有其它会话在装），
   且本 worktree 根 `node_modules` 是实目录 ⇒ 本次安装未写共享层。

```powershell
$r = Get-Item 'D:\IHUI-AI\node_modules' -Force
$top = Get-ChildItem 'D:\IHUI-AI\node_modules' -Force
$pnpm = Get-ChildItem 'D:\IHUI-AI\node_modules\.pnpm' -Force
"root mtime=$($r.LastWriteTime) top=$($top.Count) names=$((($top|% Name)|Sort-Object) -join ',') pnpm=$($pnpm.Count)"
```

### 3.2 本次实测数字

| 读数 | 值 |
| --- | --- |
| install 耗时 | **25.1 s**（`Done in 25.1s using pnpm v11.18.0`，`Lockfile is up to date`） |
| postinstall | `apps/mobile-cap`、根 `.`（fix-expo-metro-junction / patch-lint-staged-stdio / version-sync）、`apps/web`（`copy-monaco` 已复制 monaco min/vs → public/vs）**全部 Done，无失败** |
| 本 worktree 根 `node_modules` | 实目录，mtime **09:27:44**（本次安装写入） |
| 本 worktree `apps/web/node_modules` | 实目录，mtime **09:27:32**，**63 条**（本地新建，不再指向共享） |
| 共享根 `D:\IHUI-AI\node_modules` mtime | **09:29:00**（晚于本次装完的 09:27:44；同段有其它会话 `pnpm install` 在跑：09:28:28、09:28:48、09:31:03） |
| 共享根顶层条目数 | 装前（09:20:08）= 2（`.pnpm` + `lint-staged` junction）；装后（09:31:11）= **1**（仅 `.pnpm`） |
| 共享根 `.pnpm` 条目数 | **4122** |
| 共享 `D:\IHUI-AI\apps\web\node_modules` | 实目录，mtime **09:09:57 未变**，条目数 2，`typescript=False`（早于本次动作，非本次造成） |

判读：本次 install 的写入面全部落在本 worktree 自己的两层实目录上；共享侧的缩减发生在
**装完之后**，由其它会话的安装造成，不是本次 install 的副作用。

## 4. 验收

装完必须逐条确认这三项（缺一项就不算干净）：

```powershell
Test-Path 'D:\IHUI-AI\.worktrees\<wt>\apps\web\node_modules\typescript\bin\tsc'   # True
Test-Path 'D:\IHUI-AI\.worktrees\<wt>\packages\ui-react\dist'                     # True
Test-Path 'D:\IHUI-AI\.worktrees\<wt>\packages\ui-react\node_modules\lucide-react\package.json'  # True
```

本次实测：三项均为 **True**；`packages/ui-react/dist` 内有 `index.d.ts` / `index.js` /
`index.d.ts.map` / `components` / `lib`；`apps/web/node_modules/.bin/tsc` 亦为 True。
（`packages/ui-react/dist` 与 `lucide-react` 在本次之前就已可解析，本次安装后复核仍为 True。）

## 5. 警告：文件句柄与安装窗口

Windows 上文件句柄会被长跑任务长期持有。若此刻有人正在 `rmdir .pnpm` 重建共享层，任何持
有 `node_modules` 句柄的进程都会让对方报 **`ENOTEMPTY` / `EBUSY`**，修复随之失败，表现为
「一边修、一边坏」。

因此在**安装窗口内**不要跑：

- 全量 `tsc` / `turbo run typecheck`
- `vitest` 长跑 / 多片测试套件
- `next build`、`taro build` 等打包
- 全量 push 门（`[T1]` 全量 typecheck 同样会长期持有句柄）

本次教训：一次 push 门跑到 `[T1]` 全量 typecheck 时，正好有人在重建共享层，双方互相卡住；
停掉推送后，对方的安装才继续。

## 6. 可复用步骤（四步）

1. **判据**：`Get-Item … -Force` 读 `LinkType` / `Target`，**根层 + 每个 per-package 层**都扫；
   `LinkType=[]` 且 `Target=[]` 才是自包含。
2. **摘链接**：`[System.IO.Directory]::Delete($path, $false)`；删后校验目标 `Test-Path=True`
   且目标 mtime 与摘前一致。禁用 `Remove-Item -Recurse`。
3. **就地安装 + 取证**：本 worktree `pnpm install --frozen-lockfile`；装前/装后各取一次共享侧
   顶层条目数 + mtime（及 `.pnpm` 条目数），用时间与条目数证明「未写共享层」。
4. **验收**：`apps/web/node_modules/typescript/bin/tsc`、`packages/ui-react/dist`、
   `lucide-react` 三项可解析。

## 7. 未验证边界（读之前先看这段）

- 只测过 `wt-ui-defect-mining-1107` **一个 worktree、一次安装**。
- 未测：其它 worktree 摘根层 junction 的效果；两个 worktree 并发安装；lockfile 变更后的
  `--frozen-lockfile` 失败路径；非 Windows 平台的 reparse point 行为。
- 本次根层本来就是实目录，所以「摘根层 junction」这一步**在本机没有被实际执行过**，只是
  给了做法与校验口径。
- 因此本文是**单点实例记录**，不是已推广的规范。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
