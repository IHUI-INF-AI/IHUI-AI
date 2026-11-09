<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 原路径: D:\IHUI-AI\.ihui-agent\tmp\INCIDENT-20261107-guardian-runner-truncated.md
> 生成时间: 2026-11-07 14:36:39
> 所属工作线: 看门狗 / 门注册段事故

# 事故票：`scripts/guardian-runner.mjs` 门注册段被截断（已止血，未提交）

- 发现时点：2026-11-07 14:27 +08:00
- 发现场景：门/看门狗线四件只读核对时，发现工作区 `pushGateChecks` 只有 4 门
- 事故定性：**旧版文件被整体暂存覆盖**（非有意删门），与 2026-10-25 记录的「门注册段截断」同型
- 当前状态：**已回填 16 段并写入索引**；未提交、未推送

## 1. 三个来源的门清单对照

| 来源 | 总行数 | `pushGateChecks` | 通用 `checks` 关键门 |
|---|---|---|---|
| HEAD `2a752788b4` | 7973 | **13**：T1, 193, 47p, IG, 299, 300, 301, 302p, 303p, 304p, 306p, 307p, 308p | 298/302/303/304/306/307/308 均在 |
| `origin/main` `e69651e43f` | 7665 | **13**（同一清单） | — |
| 索引（修复前） | 7669 | **4**：T1, 193, 47p, IG | 298/302/303/304/306/307/308 **全缺** |
| 磁盘（修复前） | 7669 | **4**（与索引逐字相同，`git diff --quiet` rc=0） | 同上 |
| 磁盘/索引（修复后） | 7945 | **13**（与 HEAD 同一清单） | 298/302/303/304/306/307/308 均已回填 |

## 2. 修复手法与采纳理由

- **不使用** `git checkout --` / `git restore` 整文件：会连同磁盘上其它改动一起丢。
- 采用**片段级回填**：从 `HEAD:scripts/guardian-runner.mjs` 按唯一锚点切出 3 段，插回磁盘对应位置：
  - checks `298` 段（25 行）：插在 `// --- 工作流/部署脚本引用不存在的脚本(只读门,298)---` 之前；
  - checks `302/303/304/306/307/308` 段（123 行）：插在 checks 数组闭合 `]`（`// === push 门检查集` 之前）之前；
  - push 门 `299/300/301/302p/303p/304p/306p/307p/308p` 段（128 行）：插在 `pushGateChecks` 闭合 `]`（`// === CLI 解析 ===` 之前）之前。
- 校验：`node --check scripts/guardian-runner.mjs` rc=0；回填后 `pushGateChecks=13`、`checks` 含 298/302/303/304/306/307/308；`git status` 由截断的 `M` 变为回填后的 `M`（已 `git add`）。
- 修复前备份：`.ihui-agent/tmp/guardian-runner.pre-fix-20261107.bak`（不留在 `scripts/` 以免触发散落文件/体积门）。

## 3. 为何这是事故而不是意图（三条证据）

1. **HEAD 是 13 门**：`2a752788b4` 的 `pushGateChecks` 完整包含 299/300/301 与 302p–308p，且 193/299/300/301 的 `stagedTriggers` 声明都在。
2. **`origin/main` 也是 13 门**：远端 `e69651e43f` 同一清单，说明截断只发生在本地暂存层，不是仓库演进的结果。
3. **修复前 `308p` 全仓零命中**：若是有意移除 9 门，通常会在台账/文档/allowlist/注释留痕；实际当前工作区（含 `.ihui-agent`）grep `308p` 无任何痕迹，且删除 hunk 呈连续整段塌缩，符合覆盖式截断特征。

## 4. 回填后仍存在的旧版回退（**未修，需另判**）

`git diff HEAD -- scripts/guardian-runner.mjs` 仍为 **+22 / −50**，集中在 10 处「HEAD 升过档、磁盘仍是旧版」的差异：

- `resolveGitBin` import 缺失（BUG-55 修复被回退）
- `45` 的 `args: ['--staged']` 被删
- `2f-cli` blocking → warn（skipEnv 一并消失）
- `86` blocking → warn（`--strict`/skipEnv 消失）
- `173` label 缩短 + `stagedTriggers` 由 `**/*` 收窄为两份 README
- `217` 触发器由 3 项收窄为 1 项
- `197` blocking → warn（两处 hunk）
- `retry-aliases` 触发器扩面（web/小程序/台账）消失
- 侧栏触发器由 7 项收窄为 3 项

这些不是「磁盘上值得保留的新改动」，而是同一份旧版文件的其余部分。**本票只按指令回填 16 段，未擅自恢复上述差异**；它们是否按 HEAD 恢复、或其中确有有意降档，需另下一笔决定。

## 5. 修复后状态（2026-11-07 15:05 +08:00）

- **最终形态**：磁盘 / 索引 / HEAD 三方逐字节一致：`git diff HEAD` rc=0、`git diff --cached HEAD` rc=0、`git status --short` 对该文件无输出。§4 的「+22/−50 中间态」已被本步取代。
- **HEAD 在作业期间被自动收敛推进**：`2a752788b4` → `4d36cc8f7a`（2026-11-07 14:28:38，`Merge origin/main (worktree-preserving sync via git-sync-converge) round2`）。最终覆盖取的是 `4d36cc8f7a` 版本（345371 字节）；新 HEAD 把侧栏触发器补到 9 项（含 `GlobalShell.tsx` / `globals.css` / `layout.tsx` / ui-react sidebar / mobile Drawer / miniapp Drawer），已随覆盖恢复。
- 验收：`node --check` rc=0；`pushGateChecks` **13 门**（T1, 193, 47p, IG, 299, 300, 301, 302p, 303p, 304p, 306p, 307p, 308p）；`checks` **338 个 id**。
- 备份：`.ihui-agent/tmp/guardian-runner.pre-fix-20261107.bak`（16 段回填前 = `b7ec515d92` 版）、`.ihui-agent/tmp/guardian-runner.pre-headfix-20261107.bak`（回填后混合体）。
- 未提交、未推送；该文件现在对另一条线的 `commit --only` 是**干净**的。

## 6. 10 处判定表（全部为旧版回退，无本地新增）

**判定底座（不靠感觉）**：
- 修复前磁盘/索引 blob `a61dd98822` 经 `git log --all --find-object=a61dd98822` 精确命中 `b7ec515d92`（2026-11-07 10:52，`chore: 三处让号与合成落本地(main 未推侧)`），即整份文件是那一版历史快照。
- `git merge-base --is-ancestor b7ec515d92 HEAD` rc=0 ⇒ 该旧版是 HEAD 的祖先。
- 10 处 HEAD 侧写法各有 HEAD 历史内的引入提交（下表「引入提交」列，`merge-base --is-ancestor <commit> HEAD` 全部 rc=0）及明确提交信息 ⇒ 磁盘侧没有一处是本地新增意图。

| # | hunk 头 | HEAD 侧 | 磁盘侧 | 判定 | 引入提交 |
|---|---|---|---|---|---|
| 1 | `@@ -41,9 +41,6 @@` | 3 行 BUG-55 注释 + `import { resolveGitBin } from './lib/gitdir.mjs'` | 无（裸 `git`） | 旧版回退 | `d050d90d10` 2026-11-06「批量根治台账 72 项 BUG…」 |
| 2 | `@@ -348,9 +345,7 @@` | 注释（剔除幽灵路径）+ 9 项触发器 | 3 项，且含幽灵路径 `apps/web/src/styles/design-tokens.css` | 旧版回退 | `e69651e43f` 2026-11-07「侧栏宽度守门补齐五面载体…」 |
| 3 | `@@ -554,9 +549,7 @@` | 注释 + `args: ['--staged']` | `args: []`，无注释 | 旧版回退 | `3bed6719e3` 2026-11-04「c-drive 默认即扫暂存区…」 |
| 4 | `@@ -952,26 +945,23 @@` | `mode: 'blocking'` + `skipEnv` + 511 keys + 升档说明 | `mode: 'warn'` + 无 skipEnv + 59 keys/63 行 | 旧版回退 | `c8bd00a636` 2026-11-05「…两道守门升 blocking」 |
| 5 | `@@ -2315,21 +2305,13 @@` | `blocking` + `args: ['--strict']` + `skipEnv` + Z41 升档留痕 | `warn` + `args: []` + 旧注释 | 旧版回退 | `cd3fc5ee79` 2026-11-06「86 号档位 warn→blocking 并补 --strict 与 skipEnv(Z41)」 |
| 6 | `@@ -4536,17 +4518,16 @@` | label 含 DN5 + `stagedTriggers: ['**/*']` + DN5 例外 hint | 短 label + `['README.md','README.en.md']` + 无 DN5 | 旧版回退 | `c7b8f22074` 2026-11-05「门298补工作树臂…」 |
| 7 | `@@ -5214,7 +5195,7 @@` | label 含「RN 百分比高度零容忍」+ 3 项触发器 | 短 label + 仅 `apps/mobile-rn/src/` | 旧版回退 | `88958244a0` 2026-11-06「RN 百分比判据进提交链」 |
| 8 | `@@ -6265,22 +6246,14 @@` | 含 web/、miniapp-taro/、`retry-reload.mjs`、baseline.jsonl、resolutions.jsonl + 完整 hint | 全部缺失 | 旧版回退 | `20280246b6`「onRetry 真重载判据扩到 web+小程序」；`0f288b60bf` 2026-11-05「触发面补 resolutions.jsonl」 |
| 9 | `@@ -6619,18 +6592,17 @@`、`@@ -6639,9 +6611,7 @@` | `blocking` + `skipEnv` + 升档 label + 镜像/应急放行 hint | `warn` + 无 skipEnv + 少 3 行 hint | 旧版回退 | `c8bd00a636` 2026-11-05 |
| 10 | `@@ -7870,7 +7840,7 @@` | `execFileSync(resolveGitBin(), …)` | `execFileSync('git', …)` | 旧版回退（BUG-55 调用侧） | `d050d90d10` 2026-11-06 |

### 6.1 完整 diff 原文（HEAD → 修复后磁盘的回退方向）

```diff
diff --git "a/D:\\DevEnv\\Temp\\gr-head-20261107.mjs" "b/D:\\DevEnv\\Temp\\gr-disk-20261107.mjs"
index ab0585a..c8498b6 100644
--- "a/D:\\DevEnv\\Temp\\gr-head-20261107.mjs"
+++ "b/D:\\DevEnv\\Temp\\gr-disk-20261107.mjs"
@@ -41,9 +41,6 @@ import { readFileSync } from 'node:fs'
 import { fileURLToPath } from 'node:url'
 import { runGuardianBatch } from './lib/guardian-executor.mjs'
 import { resolveGateScope, isMetaGate } from './lib/gate-scope.mjs'
-// BUG-55:档位判定的 git 派生此前用裸 'git',全仓已收口 resolveGitBin();PATH 不通时
-// 该调用恒失败被吞成 warn ⇒ 档位判定恒失败、退回全量档。改用绝对路径 git 二进制。
-import { resolveGitBin } from './lib/gitdir.mjs'
 
 
 // === 检查配置(按 mode 分组;项数与分级见 `--help`,勿在此写死数字——写死必然过期) ===
@@ -348,9 +345,7 @@ const checks = [
     script: 'check-sidebar-width-consistency.mjs',
     args: [],
     mode: 'blocking',
-    // 2026-11-07:剔除幽灵路径 `apps/web/src/styles/design-tokens.css`(该文件在树里不存在,
-    // 触发面里挂着它等于给人一个"改了却不触发"的错觉);补上第五面五处载体的真实路径。
-    stagedTriggers: ["packages/design-tokens/", "apps/web/src/components/sidebar.tsx", "apps/web/src/components/sidebar/", "apps/web/src/components/layout/GlobalShell.tsx", "apps/web/app/globals.css", "apps/web/app/layout.tsx", "packages/ui-react/src/components/sidebar.tsx", "apps/mobile-rn/src/components/Drawer.tsx", "apps/miniapp-taro/src/components/DrawerComponent.tsx"],
+    stagedTriggers: ["packages/design-tokens/", "apps/web/src/styles/design-tokens.css", "apps/web/src/components/sidebar.tsx"],
   },
   {
     id: '25',
@@ -554,9 +549,7 @@ const checks = [
     id: '45',
     label: '🛡️  C 盘路径硬编码扫描(warn-only,AGENTS.md §26)',
     script: 'check-c-drive-paths.mjs',
-    // 2026-11-04:此前无输入面直接返回空数组恒绿。现默认即真扫暂存区(--staged 为兼容别名);
-    // git 取面失败 / 文件读不到 = exit 2 未判定;空暂存区 = 0 不适用(对齐 check-file-size);warn 档不阻断。
-    args: ['--staged'],
+    args: [],
     mode: 'warn',
     stagedTriggers: ["**/*"],
     onFailHint: [
@@ -952,26 +945,23 @@ const checks = [
       '',
     ].join('\n'),
   },
-  // --- 2f-cli (2026-07-28 新增,cli 端 5 语言 i18n parity 守门;2026-11-05 升 blocking) ---
+  // --- 2f-cli (2026-07-28 新增,cli 端 5 语言 i18n parity 守门) ---
   // check-cli-i18n-parity.mjs 是独立脚本(校验 packages/i18n/messages/cli/*.json),
-  // 原未挂载 guardian-runner,CI 未自动跑。cli 端 i18n 体量小(511 keys/5 locales),
-  // 差值面现读为 0(head 与 staged 两面同绿),镜像测试 16 例含「一致→exit 0 / 漂移→exit 1」
-  // 成对夹具 ⇒ 按 §12e(存量归零即升档前置)升 blocking;取材面=磁盘,故配 skipEnv。
+  // 原未挂载 guardian-runner,CI 未自动跑。cli 端 i18n 体量小(59 keys/5 locales),
+  // 风险低,warn-only 起步,后续按需升级 blocking。
   {
     id: '2f-cli',
-    label: '🌐 cli i18n parity 守门(blocking,2026-11-05 由 warn 升档)',
+    label: '🌐 cli i18n parity 守门(warn-only,2026-07-28 立)',
     script: 'check-cli-i18n-parity.mjs',
     args: [],
-    mode: 'blocking',
-    skipEnv: 'HUSKY_SKIP_CLI_I18N_PARITY',
+    mode: 'warn',
     stagedTriggers: ["packages/i18n/messages/cli/"],
     onFailHint: [
       '',
       '  💡 cli 端 5 语言 i18n key 集合不一致。',
       '     修复:node scripts/check-cli-i18n-parity.mjs 查看详情,',
       '     补齐缺失 key 或删除多余 key,确保 zh-CN/zh-TW/en/ja/ko 5 语言 key 集合完全一致。',
-      '     cli 端 i18n 体量小(511 keys),新增状态词必须同批补齐 5 语言(AGENTS §19)。',
-      '     应急放行:HUSKY_SKIP_CLI_I18N_PARITY=1 git commit ...(不推荐;跳过会留痕)',
+      '     cli 端 i18n 体量小(63 行),warn-only 起步,后续按需升级 blocking。',
       '',
     ].join('\n'),
   },
@@ -2315,21 +2305,13 @@ const checks = [
   },
   {
     id: '86',
-    label: '🗂  一次性验证/探针脚本落点对账(verify-*.{mjs,ts} + tmp-*.{mjs,mts,ts,js},blocking,AGENTS §25 配套)',
+    label: '🗂  verify-*.mjs 临时验证文件落点(warn,AGENTS §25 配套,补装)',
     script: 'check-verify-tmp-files.mjs',
-    args: ['--strict'],
-    mode: 'blocking',
-    skipEnv: 'HUSKY_SKIP_VERIFY_TMP_FILES',
+    args: [],
+    mode: 'warn',
     stagedTriggers: ["apps/"],
-    // 升档留痕(2026-11-06,goal-b49 Z41):只翻档位字段(mode/skipEnv/args 的 --strict),
-    //   判据、阈值、覆盖面(射程仍由门体 STRAY_FORMS 登记表决定)一字未动 —— §12e 不许为升档削判据。
-    // 升档前置 = 现读实测存量 0:全量档 0 警告 + --strict exit 0 + --self-test 5 例全过 + 镜像 23 例全过;
-    //   前置不成立时本条目必须留在 warn,故复算入口就是上面那四条命令(数字现读,不采信转述)。
-    // args 必须同批带 --strict:该脚本自身默认 warn-only(有警告也 exit 0),--strict 才阻断 ⇒
-    //   只把 mode 写成 blocking 而不给 --strict,门永远翻不了红 = 判据当场不成立(§0.9);同型先例见 L3172 那条注释。
-    // 取材面 = 工作树文件系统(门体自行声明:"未跟踪"这一事实只在工作树面存在,HEAD/索引面结构上看不见),
-    //   故 §0.4 的 HEAD/索引两档不适用本门;扫描根缺失时 --strict 记 exit 2「未判定」,不冒充全绿(§0.3)。
-    // 旧注释"升 blocking 会拦掉合法 scripts/e2e-* 长期脚本"已随 Z40 扩面失效:豁免口径由门体登记表判定,与档位无关。
+    // 该脚本自身默认 warn-only(有警告也 exit 0),--strict 才阻断 ⇒ 放 CI 用 --strict。
+    // 这里保持 warn:§25 的原意是"提示层",升 blocking 会拦掉合法的 scripts/e2e-* 长期脚本。
   },
   {
     id: '87',
@@ -4536,17 +4518,16 @@ const checks = [
   {
     id: '173',
     label:
-      '对外文档数字对账(README/README.en 的生成块与散文声称必须等于 gen-doc-numbers 现算值;DN5 清单不变式:本轮引入 A/D/R/C 时 trackedFiles 必须同步,与是否触及 README 无关;其余数字判责时机=改动被审文档的那枚,未触及只报漂移数 —— 防恒红)',
+      '对外文档数字对账(README/README.en 的生成块与散文声称必须等于 gen-doc-numbers 现算值;判责时机=改动被审文档的那枚,未触及只报漂移数 —— 防恒红)',
     script: 'check-doc-numbers.mjs',
     args: [],
     mode: 'blocking',
     skipEnv: 'HUSKY_SKIP_DOC_NUMBERS',
-    stagedTriggers: ['**/*'],
+    stagedTriggers: ['README.md', 'README.en.md'],
     onFailHint: [
       '',
       '刷新块: node scripts/gen-doc-numbers.mjs --markdown 替换 README 的 GENERATED NUMBERS 块(务必在 README 已在被审面上的那份面生成,否则 trackedFiles 天生差数);逐数来源: node scripts/gen-doc-numbers.mjs;连仓库简介一起问责: node scripts/check-doc-numbers.mjs --strict --description -',
       '本门只在触及 README.md/README.en.md 的轮次判红;未触及轮次打印的"漂移只报数"是"下次改 README 必须重跑生成块"的前置提醒,不构成跳门理由。',
-      '例外(DN5):本轮引入新增/删除/改名/复制文件时,生成块 trackedFiles 必须同步,与是否触及 README 无关 —— 改清单的那枚会直接红。',
       '红点绝大多数落在 README 的 END RECENT UPDATES 标记之后的旧版全文快照副本(现读 --strict 61098 条:标记之后占 61048,活性声明只占 45,另 5 条是生成块):那些副本记的是当时的账,批量按现算值逐行改写=把历史改成今天,不是结清(2026-10-31 实测一席的手写"收敛到绿"循环改了 23900 行,其中历史区 7217 行)。正解=先跑配套清偿器 node scripts/scrub-doc-numbers.mjs(默认 dry-run,--apply 才写盘),它复用本门自己的 CLAIMS 与生成块同源取值;整片快照的清偿属全仓维护债,不在逐行手改。',
       '',
     ].join('\n'),
@@ -5214,7 +5195,7 @@ const checks = [
   },
 
   // --- 217/218(2026-10-15/16 立;原注 213/214→214/215 两度与上游撞号让位顺延:213 已归盘根写入门、214 已归 ApiKeyPermission 三面对账;病理五类实锤/hex 取材口径逐字归档 .ihui-agent/archive/guardian-runner-comments-pre-6000-2026-10-14.md §门214/215,2026-10-16 C1 腾行)---
-  { id: '217', label: '📐 mobile-rn sheet/弹窗 flex 弹性契约 + RN 百分比高度零容忍(bounded 容器内列表唯一弹性块 / R3 百分比只能走数值真相源)', script: 'check-sheet-flex-contract.mjs', args: [], mode: 'blocking', stagedTriggers: ['apps/mobile-rn/src/', 'packages/app/src/', 'scripts/lib/rn-percent-height-policy.mjs'] },
+  { id: '217', label: '📐 mobile-rn sheet/弹窗 flex 弹性契约(bounded 容器内列表必须唯一弹性块,固定 chrome 不被压扁)', script: 'check-sheet-flex-contract.mjs', args: [], mode: 'blocking', stagedTriggers: ['apps/mobile-rn/src/'] },
   {
     id: '218',
     label: '🎨 RN 端硬编码 hex 基线棘轮(基线之外新增 #hex 即 BLOCK,存量只减不增)',
@@ -6265,22 +6246,14 @@ const checks = [
     stagedTriggers: [
       'packages/app/src/features/',
       'apps/mobile-rn/src/screens/',
-      // 2026-11-05 扩面:同一提取器/分类器覆盖 web 与小程序,新假重载按棘轮判红
-      'apps/web/',
-      'apps/miniapp-taro/src/',
       'scripts/check-retry-aliases.mjs',
-      'scripts/lib/retry-reload.mjs',
-      'scripts/data/retry-reload-baseline.jsonl',
-      // 2026-11-05 接线:门 296 台账(当时 runner 被 299-301 接线占用,现补)
-      'scripts/data/retry-reload-resolutions.jsonl',
       'scripts/check-cross-end-screen-coverage.mjs',
       'scripts/check-rn-host-shell-coverage.mjs',
     ],
     onFailHint: [
       '',
       '  💡 onRetry 必须绑定真重试回调;别名(onBack / onRefresh / onLoadMore / undefined / null)',
-      '     会把失败路径静默吞掉。共享屏 / RN 壳 / web / 小程序要同笔接上同一回调。',
-      '     假重载(退出·翻页·清空)存量在 scripts/data/retry-reload-baseline.jsonl;新增即红。',
+      '     会把失败路径静默吞掉。共享屏与 RN 壳要同笔接上同一回调。',
       '     复验:node scripts/check-retry-aliases.mjs --staged',
       '',
     ].join('\n'),
@@ -6619,18 +6592,17 @@ const checks = [
     ].join('\n'),
   },
 
-  // --- 有界列表截断诚实 + 投递档位收口绊线(G-998100/G-998101,2026-11-05 升 blocking)---
+  // --- 有界列表截断诚实 + 投递档位收口绊线(G-998100/G-998101,观察票 warn 起步)(1 项)---
   {
     id: '197',
-    label: '📉 truncated 声明块计数伴随 + 投递档位收口绊线(DTO 类型层,blocking;2026-11-05 由 warn 升档)',
+    label: '📉 truncated 声明块计数伴随 + 投递档位收口绊线(DTO 类型层,warn)',
     script: 'check-truncation-accounting.mjs',
     args: [],
-    mode: 'blocking',
-    skipEnv: 'HUSKY_SKIP_TRUNCATION_ACCOUNTING',
+    mode: 'warn',
     stagedTriggers: ['packages/', 'apps/api/src/', 'apps/ai-service/app/'],
     onFailHint: [
       '',
-      '  💡 有界列表截断诚实(票 G-998100/G-998101,判红档 = --staged 棘轮:改到哪只咬哪):',
+      '  💡 有界列表截断诚实(票 G-998100/G-998101,观察档):',
       '     ① truncated 声明块裸奔 = interface/type/z.object 块里数组成员 + truncated 却无计数/总量型',
       '        数值兄弟键 ⇒ 同块补 total/unlisted/omitted/… 计数键(正型:packages/types/src/api-contracts.ts',
       '        BoundedListProjection)。函数体/if 块里的同名局部不判。',
@@ -6639,9 +6611,7 @@ const checks = [
       '        终态逐字节一致测试)必须同期落地;字符串槽位/注释提及只报数不判红(绊线咬代码标识符)。',
       '     单独复验:node scripts/check-truncation-accounting.mjs --staged',
       '     自检:node scripts/check-truncation-accounting.mjs --self-test(23 例)',
-      '     镜像:node --test scripts/tests/check-truncation-accounting.test.mjs',
       '     全量档(HEAD 面)只报数恒 exit 0(棘轮:改到哪只咬哪);Python 面只报数不判。',
-      '     应急放行:HUSKY_SKIP_TRUNCATION_ACCOUNTING=1 git commit ...(不推荐;跳过会留痕)',
       '',
     ].join('\n'),
   },
@@ -7870,7 +7840,7 @@ let effectiveChecks = pushGate ? pushGateChecks : checks
 if (passStaged && !pushGate) {
   try {
     const stagedPaths = String(
-      execFileSync(resolveGitBin(), ['-c', 'safe.directory=*', 'diff', '--cached', '--name-only'], {
+      execFileSync('git', ['-c', 'safe.directory=*', 'diff', '--cached', '--name-only'], {
         encoding: 'utf8',
         cwd: process.cwd(),
         windowsHide: true,
```

### 6.2 点名：173 / 217 触发器收窄

- **173**：磁盘 `['README.md','README.en.md']`，HEAD `['**/*']`。少的不是某一项，而是**除 README 之外的全部路径**。后果：任何只改代码/数据、不碰 README 的提交都不评估 173。具体例：`git add packages/new-module.ts`（A）→ `gen-doc-numbers` 的 `trackedFiles` 变化 → DN5 不变式要求 README 生成块同步，本该红，但 173 根本不跑。173 不在 `pushGateChecks`（13 门清单无 173），只在 `--staged` 路径评估 ⇒ 窄清单在这个**唯一评估点**直接漏掉。
- **217**：磁盘 `['apps/mobile-rn/src/']`，HEAD 另含 `packages/app/src/` 与 `scripts/lib/rn-percent-height-policy.mjs`。少的正是**共享屏面**与**判据真相源**。具体例：改 `packages/app/src/features/course-planet/CoursePlanetScreen.tsx`，在 bounded 容器内的列表上加 `style={{ height: '50%' }}`（百分比高度零容忍）→ 本该红，但不触发；单独改 `scripts/lib/rn-percent-height-policy.mjs` 同样不触发。
- 与票面对齐：票面证明 **push 段从不评估 `stagedTriggers`**；173/217 又不在 push 门集里，因此窄清单是在唯一会评估该字段的 `--staged` 形态下造成「该跑而不跑」，不是「按范围触发」。

### 6.3 点名：2f-cli / 86 / 197 降 warn 后谁还能拦

- **2f-cli**：本地 pre-commit 与 push 都**不拦**（13 门 push 集无 2f-cli）。CI 的 `.github/workflows/8end-consistency-cert.yml` 仍以 `warnOnly:false` 跑 `check-cli-i18n-parity.mjs`，所以**推 main / 每周一 / 手动**会因 FAIL 变红；**feature 分支提交与本地推无人拦**。
- **86**：**无人拦**。CI 无引用；`guardian-full.yml` / `gates-full.yml` 跑的是 runner，磁盘版 `mode=warn` 不阻断；且磁盘版去掉 `--strict`，脚本自身默认 warn-only ⇒ 双重失效。
- **197**：**无人拦**。CI 无引用；runner 内 `mode=warn` 不阻断；脚本的 `--staged` 棘轮在 warn 下只打印。

## 7. 边界

- 未提交、未推送、未改除 `scripts/guardian-runner.mjs` 之外的任何源码文件。
- 写入清单：本文件、两份备份 `.bak`、以及 `scripts/guardian-runner.mjs`（先片段回填、后按 HEAD `4d36cc8f7a` 整体覆盖）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
