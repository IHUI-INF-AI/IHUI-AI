<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# worktree 自包含 node_modules（判据、读数与迁移队列）

**状态**：自 2026-11-07 起，主仓 `D:\IHUI-AI` 与已完成摘链的 worktree 各自持有 `node_modules`；
共享层不再为任何 worktree 提供依赖。仍挂 junction 的树继续冻结安装与全量运行，按本文队列迁移。

---

## 1. 解冻判据（两条同时满足）

1. **实名目录**：本树所有 `node_modules`（根层 + 每个 per-package 层，**不设深度**）均为实名目录，
   `lstatSync(...).isSymbolicLink() === false`。
2. **门 78 零破损**：在本树真实路径下跑 `node scripts/check-workspace-dep-links.mjs --strict`，
   退出码 0，且汇总行同时满足 `破损 0 条` 与 `断链 0 条`。

### 1.1 枚举全部 `node_modules`（不写死路径）

```bash
node -e "const fs=require('fs'),path=require('path');let n=0;const links=[];function w(d){let es;try{es=fs.readdirSync(d,{withFileTypes:true})}catch{return}for(const e of es){if(!e.isDirectory())continue;const p=path.join(d,e.name);if(e.name==='node_modules'){n++;try{if(fs.lstatSync(p).isSymbolicLink())links.push(p)}catch{}continue}if(e.name==='.git'||e.name==='.pnpm')continue;w(p)}}w(process.cwd());console.log('node_modules 目录总数='+n);console.log('其中 junction/reparse='+links.length);links.forEach(x=>console.log('  LINK '+x))"
```

实测：`wt-infra-defect-mining-1107` 扫到 **24** 个 `node_modules`，其中 junction **0**。

### 1.2 门 78 的判定口径

只有同时看到这两项才算“零破损”：

- 汇总行：`链接完整性:浅扫 N 条 / 深扫 M 条(合计 N+M 条;...),破损 0 条`，
  且 `外部依赖声明 K 条,断链 0 条(严格档判红)`。
- 退出码 0。`--strict` 会把断链升为红；不带 `--strict` 时断链只是告警，**不能拿来判解冻**。

深扫必须 >0 才算有效：只浅扫会漏掉“链接存在但目标目录为空/悬空”这一型
（`existsSync` 对指向空目录的链接仍返回 true）。

---

## 2. 冲突读数裁定（2026-11-07，同一台机、同一时刻）

| 组别 | 命令 | 退出码 | 浅扫/深扫 | 破损 | 断链 | 明细 |
|---|---|---|---|---|---|---|
| 真实路径 `D:\IHUI-AI` | `node scripts/check-workspace-dep-links.mjs --strict` | **0** | 758 / 11235（合计 11993） | **0** | **0** | 外部声明 431 条全解析 |
| 经 junction `wt-ai-service-audit` | 同上 | **1** | 760 / 11235（合计 11995） | **1** | **1** | `apps/mobile-rn/node_modules/expo-intent-launcher` 悬空；`@ihui/mobile-rn` 缺该包 |

**结论：`--strict` 在挂 junction 的树上的读数不能用来判断主仓状态。** 但这次的红不是 junction
路径解析假阳性，而是真实悬空：

- 该树 `apps/mobile-rn/package.json` 声明 `expo-intent-launcher@~57.0.1`（主仓 `main` 的同名
  `package.json` **不声明**）。
- 该树的 per-package 链接指向 `D:\IHUI-AI\node_modules\.pnpm\expo-intent-launcher@57.0.1_expo@57.0.13`。
- 主仓按 `main` 的 lockfile 独占安装时，把这个只属于分支、且不在 main lockfile 里的包从共享
  `.pnpm` 收敛掉了 ⇒ 该树链接变成悬空。

即：**共享 `.pnpm` 会让“主仓安装”删掉别人分支依赖”。这是自包含的又一条硬证据，不是读数误报。**

### 2.1 五个“files=0”的复核（口径问题）

| 包 | 顶层形态 | `.pnpm` 目录 | 条目数 | **递归真实文件数** | 判定 |
|---|---|---|---|---|---|
| `@ihui/eslint-config` | LINK → `packages/eslint-config` | 无（workspace 包） | 8 | **8** | 解析得到且可用 |
| `@next/eslint-plugin-next` | LINK | `@next+eslint-plugin-next@16_054a…` | 3（全是目录） | **56** | 可用 |
| `@svgr/plugin-jsx` | LINK | `@svgr+plugin-jsx@8.1.0_@svg_…` | 4 | **6** | 可用 |
| `@svgr/plugin-svgo` | LINK | `@svgr+plugin-svgo@8.1.0_@sv_…` | 5 | **6** | 可用 |
| `@types/node` | LINK | `@types+node@26.1.2` | 68（绝大多数是目录） | **91** | 可用 |

`files=0` 来自“只数顶层普通文件、把子目录计 0”的口径。门 78 的深扫按递归内容判定，
所以它不报这五个包；用顶层文件数替代深扫会造出假破损。**以后判内容用递归文件数或门 78 深扫，
不要用 `readdir().filter(isFile).length`。**

`@ihui/eslint-config` 单独结论：**解析得到且可用**（顶层链接 → 仓内 workspace 包，8 个真实文件），
不是“声明未解析”。真实路径门 78 的 `断链 0 条` 已覆盖它。

### 2.2 152 / 151 定案

当前主仓顶层 **151**。10:07:10 的 152 是安装过程中的瞬时值。差异项 `expo-intent-launcher`：
主仓 `package.json` 未声明、`pnpm-lock.yaml` 零命中、`.pnpm` 现无该目录 ⇒ 它是跨树残留的顶层链接，
被 root install 按 lockfile 收敛清除，不是“共享层本来就有这个包”。

---

## 3. 16 棵受影响树的逐树判定

判定依据：① 根 `node_modules` 是否 junction；② `apps/mobile-rn/node_modules` 形态；
③ `apps/mobile-rn/node_modules/expo-intent-launcher` 解析结果（链接是否悬空）；
④ `expo-intent-launcher` 是否被真实引用。

**“现在能不能跑”的口径**（只判这一条依赖，不是整树全绿）：
从该树的 `apps/mobile-rn` 里能否解析到 `expo-intent-launcher` 的真实内容 ——
`fs.statSync(...)` 走链接得到目录、`package.json` 可读、内容不依赖共享层收敛后的目标。

**grep 证据命令**（每棵树内执行，只读）：

```bash
rg -l --glob '!node_modules' 'expo-intent-launcher' apps/mobile-rn
# 或无 rg 时：
node -e "const fs=require('fs');const p='apps/mobile-rn';let n=0;for(const [k,v] of Object.entries({a:['app.config.js'],b:['plugins/withApkInstaller.cjs'],c:['src/lib/apk-update.ts'],d:['src/lib/auto-install.ts'],e:['package.json']})){try{if(fs.readFileSync(p+'/'+v[0],'utf8').includes('expo-intent-launcher')){n++;console.log(p+'/'+v[0])}}catch{}}console.log('命中='+n)"
```

| # | 树 | 根层 | mobile 层 | 该包解析 | 真实引用（grep 证据） | 现在能不能跑 | 处置 |
|---|---|---|---|---|---|---|---|
| 1 | `wt-navbar-barrel` | LINK | MISSING | 无 | 是：`app.config.js` / `plugins/withApkInstaller.cjs` / `src/lib/apk-update.ts`（+2 处文档/清单） | **否**（mobile 层缺失） | 摘链自包含 · P1 |
| 2 | `wt-e2e-skip-wait` | LINK | MISSING | 无 | 是：同上 4 处 | **否**（mobile 层缺失） | 摘链自包含 · P1 |
| 3 | `ihui-merge-wt` | LINK | REAL | **悬空** | 是：`app.config.js` / `plugins/withApkInstaller.cjs` / `src/lib/apk-update.ts`（+2） | **否** | 摘链自包含 · P1 |
| 4 | `wt-fix-ci` | LINK | MISSING | 无 | 否（0 命中） | 与其无关 | 待观察 · P2 |
| 5 | `wt-fix-readme-gates` | LINK | MISSING | 无 | 否（0 命中） | 与其无关 | 待观察 · P2 |
| 6 | `wt-ai-service-audit` | LINK | REAL | **悬空（门 78 已红）** | 是：`app.config.js` / `plugins/withApkInstaller.cjs` / `src/lib/apk-update.ts` / `auto-install.ts` / `package.json` | **否** | **摘链自包含 · P0** |
| 7 | `wt-cli-defect-mining-1107` | LINK | MISSING | 无 | 是：5 处（同上） | **否**（mobile 层从未装） | 摘链自包含 · P1 |
| 8 | `wt-db-defect-mining-1107` | LINK | REAL | **悬空** | 是：5 处 | **否** | 摘链自包含 · P1 |
| 9 | `wt-desktop-defect-mining-1107` | LINK | MISSING | 无 | 是：5 处 | **否** | 摘链自包含 · P1 |
| 10 | `wt-gate-readonly-20261106` | LINK | LINK→主仓 mobile 层 | 无（目标无此包） | 是：4 处 | **否** | **摘链自包含 · P0** |
| 11 | `wt-gates-5git` | LINK | REAL | **LINK 活** → `D:\IHUI-AI-land\...`（12 条目、`57.0.1`） | 是：5 处 | **可以解析（实跑未验证）** | 待观察 · P2 |
| 12 | `wt-rn-shell-leg-20261106` | LINK | REAL | **悬空** | 是：4 处 | **否** | **摘链自包含 · P0（RN 主线）** |
| 13 | `wt-staging-merge-index` | LINK | MISSING | 无 | 是：5 处 | **否** | 摘链自包含 · P1 |
| 14 | `wt-ui-gates-1106` | LINK | LINK→主仓 mobile 层 | 无（目标无此包） | 是：5 处 | **否** | **摘链自包含 · P0** |
| 15 | `D:\IHUI-AI-wt-dbdrift` | LINK | MISSING | 无 | 是：4 处 | **否** | 摘链自包含 · P1 |
| 16 | `D:\IHUI-AI-wt-strictness-restore-1107` | LINK | MISSING | 无 | 否（0 命中） | 与其无关 | 待观察 · P2 |

> “mobile 层 REAL / LINK→主仓” 的区别：主仓 `apps/mobile-rn/package.json` **不声明**
> `expo-intent-launcher`（main 的 lockfile 也没有），所以 junction 到主仓 mobile 层的树
> 目标里本来就没有这个包，不是链接悬空。

**结论（逐树落地，不是“一律冻结”）**：

- **真的跑不起来：12 棵**（表中 12 个“否”）。它们都声明 `~57.0.1` 且源码真实引用该包；
  根层又是 junction，拿不到该包的真实内容。全部进「必须摘链自包含」队列。
- **跑得起来：1 棵**（`wt-gates-5git`，该依赖链接活着指向 `D:\IHUI-AI-land`）⇒ 降级为**待观察**；
  注意它不是自包含（目标在本树之外），只是当前可解析。
- **与其无关：3 棵**（`wt-fix-ci`、`wt-fix-readme-gates`、`wt-strictness-restore-1107`，
  0 命中）⇒ 待观察，不占队列。

队列优先级：**P0 = 4 棵移动端主线**（`wt-ai-service-audit`、`wt-gate-readonly-20261106`、
`wt-rn-shell-leg-20261106`、`wt-ui-gates-1106`）；**P1 = 8 棵**（表中其余“否”）。
它们都必须摘链后在本树 `pnpm install --frozen-lockfile`（各自 lockfile 含该包，从 store 重新 materialize），
**不许靠“补顶层链接”固化**——目标内容已不在共享层。

### 3.1 摘链迁移的最小步骤（每棵树独立执行，不并发）

```powershell
# 1) 摘掉根层与每个 per-package 的 junction（只删链接，不删目标）
#    判据：lstatSync(p).isSymbolicLink() === true 才删
# 2) 安装（锁内，独占）
node scripts/lib/pnpm-install-lock.mjs run -- pnpm install --frozen-lockfile
# 3) 验收：实名 + 门 78 零破损
node scripts/check-workspace-dep-links.mjs --strict   # 退出 0 / 破损 0 / 断链 0
```

---

## 4. 验收判据的显式例外（快照零变化）

原判据：“安装前后，本前缀之外所有 worktree 的顶层条目数 + mtime + 一层链接清单零变化”。

**显式例外（2026-11-07 裁定）**：主仓对共享层做收敛安装时，仍挂 junction 的树必然看到顶层包减少；
这种变化**不计为安装越界**，但必须同时满足：

1. 变化只发生在挂 junction 的树上（实名目录树不得有任何变化）；
2. 变化项只能是“主仓 lockfile 不包含、且属于某分支的残留包”（逐项给出包名与 lockfile 证据）；
3. 变化后受影响树的门 78 若转红，按第 3 节队列迁移，不得用“预期结果”掩盖。

本次实例：16 棵树各减少 1 项 `expo-intent-launcher`，原因与证据见 §2.2；其中
`wt-ai-service-audit` 的门 78 已由绿转红（1 条悬空），按 P0 迁移。

---

## 5. 报数规范（门禁耗时）

- **只报单门耗时**（guardian 单次 gate 执行秒数），不报整批总耗时。
- 300s 是 `guardian-executor.mjs` 的**逐门 watchdog**（`GUARDIAN_GATE_TIMEOUT_MS` 默认 300000），
  约束的是单个门的一次执行；`check-typecheck.mjs` 内部的 20 分钟超时在 guardian 门内不可达。
- 更正（2026-11-07）：此前把 **321.6s 整批总耗时误读成 T1 单门耗时**；T1 实测 149.6s / 148.8s。
  api 席的“未判定”是同一把尺子下其单门超过 300s 被杀，不是两套判据。差异是读数口径错位。
- 判据表述统一为：“T1 单门 ≤ 300s 视为判定，> 300s 记为未判定（不代表失败）”。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
