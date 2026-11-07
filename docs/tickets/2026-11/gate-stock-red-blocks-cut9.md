<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 原路径: 本仓直写(收敛线 cut1,未在 .ihui-agent/tmp 留副本)
> 生成时间: 2026-11-08 07:15
> 所属工作线: 收敛线(提速分支合入)

# 票：cut9 提速改动被 4 道存量门挡下 —— safe-commit 全量批与 husky 提交批门集不一致

状态：OPEN　　开票：2026-11-08　　开票人：收敛线

## 现象

`feat/gate-302p-speed-1107`（cut9）的 4 个文件（`scripts/check-cross-end-parity-drift.mjs`、`scripts/lib/face-reader.mjs` 及两枚测试）在 cut9 工作树已 staged（HEAD 仍为 `895027a9d6`）。`node scripts/safe-commit.mjs` 跑完 341 门后 4 道 blocking 门判红，提交被阻止；4 道红项均与本笔改动无关。

## 逐条判定（判据面 vs 本笔）

| 门 | 红项 | 判定 | 证据 |
|---|---|---|---|
| [41] 单分支守门 | 19 条超 48h 滞留旁支（`fix/*`、`land/g40`、`wt-*` 等 14 条本地 + 5 条 `origin/fix/*` 陈旧远程跟踪引用） | ① HEAD/仓库存量（判据面=refs，不读文件内容） | 红项清单全部是分支名；cut9 staged 只有 4 个 `scripts/` 文件，未创建/删除任何 ref |
| [57] 对话流元素覆盖 | `anchor-missing-marker`：`apps/miniapp-taro/src/pkg-ai/ai/ChatMessageItem.tsx` 找不到 `ai.chatMessageItem.errorCardTitle`；`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 找不到 `<TaskStatusBar` | ① HEAD 存量 | `git show HEAD:<两个文件>` 均无对应锚点；两文件不在 staged 集，索引 blob 等于 HEAD |
| [204] 错误归因唯一出口 | `apps/cli/src/commands/ai-skills.ts:143`、`apps/cli/src/plugins/installer.ts:284` 两处 `.message.includes(` | ① HEAD 存量 | 两文件不在 staged 集（索引等于 HEAD），命中行属于仓库既有生产面 |
| [70b] i18n 死 key | `examResult.correct`、`examResult.wrongQuestions`（基线 0 → 2） | ① HEAD 存量 | 死键位于 `packages/i18n/messages/*/` 的嵌套 leaf，HEAD 即存在；staged 集无 i18n 文件 |

另有 [29] Push 同步兜底为「未判定」（取不到输入，按 §0.3 不记绿也不冒红）。

## 结构发现

同一仓库状态下，两条提交入口的门集不一致：

- `scripts/safe-commit.mjs` 触发 **341 门全量批**（`.ihui-agent/state/hook-logs/pre-commit.log`）；
- `.husky/pre-commit` 走 guardian 批，本仓实测 **38 门**（同日志 `总检查数: 38(已执行 38)`），4 道红项均不在该批清单中。

⇒ 这 4 道存量红只在 safe-commit 入口可见：同一仓库状态下，cut1 的三次合并提交（`git commit`，husky 入口）均通过；而 cut9 的 4 个文件走 safe-commit 被判红。两条入口门集不一致，使「某入口红」既不能证明本笔有问题，也不能反证仓库干净。

## 处置

- 本票只登记，不实现、不改门、不放宽：cut9 的 4 个文件保持 staged 未提交，等待 4 道存量红另行收口（41 需分支卫生处置；57/204/70b 需各自存量修复或基线裁定）。
- 改造方向（未实现）：两条入口共用同一份门注册表；存量门在提交面按「本笔是否触及」判——未触及只报数，不阻断无关改动，避免存量红顶住提速合并。
