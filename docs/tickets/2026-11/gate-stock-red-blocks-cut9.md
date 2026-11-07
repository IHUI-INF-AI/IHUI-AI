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

## 处置回填（2026-11-08，独立 worktree，基线 d4e1621806）

- [57] 复核结论：元素本就应当存在，且两端都已真实渲染，只是锚点在共享屏重构后漂移。`ai.chatMessageItem.errorCardTitle` 现于 `packages/app/src/features/chat/ChatMessageItem.tsx:284` 的 `t(...)` 调用中渲染；`<TaskStatusBar` 现于 `apps/miniapp-taro/src/pkg-ai/ai/chat-shell-extras.tsx:330` 渲染。已将 `scripts/data/chat-flow-elements.json` 两条锚点的 `file` 改指真实宿主（同条目锚点数不变），门 57 由红转绿。
- [204] 复核结论：两处 `.message.includes(` 不是错误归因，而是「自己刚抛出的哨兵」身份判断；且哨兵文本与 catch 兜底文本逐字相同，该 `if` 分支完全冗余。已把 try 收窄到只包 `JSON.parse`，形状校验移到 catch 外，行为等价、零文本判定。门 204 `--worktree` 站点 2 → 0，红转绿。夹具：`apps/cli/tests/memory.test.ts` 增 `installed` 非数组、`apps/cli/tests/plugin-marketplace.test.ts` 增 `records` 非数组两条 fail-closed 断言。
- [70b] 复核结论：两键确为 web 侧旧结果页残留，唯一同命名空间消费者 `PageClient.tsx` 已改读 shared 的 `exam.result.*`。五语言同步删除 `examResult.correct` / `examResult.wrongQuestions`，并按 KR 规则在 `scripts/data/i18n-key-removals.json` 逐文件声明（until 2027-11-08）。死键 2 → 0，红转绿；i18n parity 5 语言 OK。
- [41] 仅清点，未删除任何分支。19 条超 48h 旁支分类（证据：`git cherry` + `rev-list --not --remotes=origin`）：
  - 已全部并入 main（可删，命令按门内 A/B 档执行并先 tag 备份）：`fix/ai-service`（4/4）、`fix/cli-p0`（10/10）、`fix/desktop-cap`（6/6）、`fix/internal-ticket-verify`（2/2）、`fix/rls`（2/2）、`fix/web-p0`（2/2）、`land/g40`（1/1）、`wt-root-desktop-auto-refresh`（1/1）、`origin/fix/knip-unused-exports-1106`（tip 即 main 祖先）。
  - 有未并入 main 的独有提交（必须保留，先走分支+PR 入库）：`fix/escape-test-samples`（+1）、`fix/internal-auth`（+1，另 2 已等价入库）、`fix/internal-xsecret-ticket`（+2）、`fix/plugin-path-failopen`（+1）、`fix/root-compose-hardening`（+1）、`wt-apiroutes`（+2）。
  - 仅远程跟踪引用（远端真实存在，本地无同名分支；远端未合并者必须保留）：`origin/fix/knip-unused-exports-1105`（独有 +1）、`origin/fix/orphan-deletion-guard`（+2）、`origin/fix/plan-ledger-close-1106`（+2）、`origin/fix/test-python-qoder-midnight-1106`（+1）；其中 `origin/fix/knip-unused-exports-1106` 已并入，可由远端 owner 删分支。
  - 本地未合并分支的独有提交同时是「未推送」提交（`rev-list --not --remotes=origin` 计数与 `git cherry` 的 `+` 数一致）。
