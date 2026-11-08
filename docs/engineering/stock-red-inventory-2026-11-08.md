<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 存量仓级红清单（2026-11-08 全量复算读数）

- 读数树：`b364b60603`（`fix/gate-body-provenance-1108` 与 `origin/main` 的合并结果）
- 命令：`node scripts/guardian-runner.mjs`（全量档，无 `--staged` / 无 `--push-gate`）
- 读数：**342 项全部执行**；blocking 红 **27 道**；未判定 **3 道**（取不到输入，§0.3 不记绿也不冒红）
- 门体同代自检 / 判面声明相关的三类命中：**0 处**（没有一道红是因「门在旧树上作答」）

## 1. 本轮待办：27 道 blocking 红

均指向仓级存量面（多端一致性、样式档、SSE 解析、依赖碎片化等），**不属本枝改动引入**。

| # | 门 | 复现 |
| --- | --- | --- |
| 1 | `[7]` 依赖碎片化 | `node scripts/check-dedupe.mjs` |
| 2 | `[11h]` UI 图标位 emoji 违规 | `node scripts/check-no-emoji-icons.mjs` |
| 3 | `[41]` 单分支开发守门 | `node scripts/check-single-branch.mjs` |
| 4 | `[52]` 派生弹窗 windowsHide | `node scripts/check-no-visible-spawn.mjs` |
| 5 | `[63]` SSE 双解析器漏接 | `node scripts/check-sse-parser-parity.mjs` |
| 6 | `[77]` 圆角单一源头 | `node scripts/check-radius-single-source.mjs` |
| 7 | `[91]` 主题接线 | `node scripts/check-theme-prop-wiring.mjs` |
| 8 | `[83]` mobile-rn 深色模式前景/容器 | `node scripts/check-brand-foreground.mjs` |
| 9 | `[90]` SSE 帧端内 dispatch 注册层 | `node scripts/check-sse-dispatch-parity.mjs` |
| 10 | `[94]` errorCode 覆盖率 | `node scripts/check-error-code-coverage.mjs` |
| 11 | `[98]` HEAD 悬空具名导入 | `node scripts/check-dangling-local-imports.mjs` |
| 12 | `[100]` 合并新增文件存续性 | `node scripts/check-merge-addition-loss.mjs` |
| 13 | `[103]` 架构契约（architecture-policy.yaml） | `node scripts/check-architecture-policy.mjs` |
| 14 | `[117]` 记忆端点属主绑定 | `node scripts/check-memory-owner-binding.mjs` |
| 15 | `[129]` 提示注入登记 | `node scripts/check-prompt-injection-registry.mjs` |
| 16 | `[139]` 模式×权限档×审批三轴矩阵 | `node scripts/check-mode-permission-matrix.mjs` |
| 17 | `[173]` 对外文档数字对账 | `node scripts/check-doc-numbers.mjs` |
| 18 | `[217]` mobile-rn sheet/弹窗 flex 契约 | `node scripts/check-sheet-flex-contract.mjs` |
| 19 | `[218]` RN 硬编码 hex 基线棘轮 | `node scripts/check-mobile-rn-style-parity.mjs` |
| 20 | `[263]` Python ruff lint | `node scripts/check-ruff-python.mjs` |
| 21 | `[260]` 生产依赖 critical/high | `node scripts/check-prod-dep-advisories.mjs` |
| 22 | `[309]` 工作流/部署脚本死引用 | `node scripts/check-dead-script-refs.mjs` |
| 23 | `[311]` e2e skip 制度化 | `node scripts/check-e2e-skip-wait-policy.mjs` |
| 24 | `[150]` 角色档合规（77 不判的那一型） | `node scripts/check-radius-role-conformance.mjs` |
| 25 | `[198]` DB 盲写 updatedAt 棘轮 | `node scripts/check-db-blind-updatedat-set.mjs` |
| 26 | `[281]` 全工作树未提交状态 | `node scripts/check-worktree-status.mjs` |
| 27 | `[289]` web↔RN 覆盖缺口棘轮 | `node scripts/check-web-rn-gap-ratchet.mjs` |

其中两条是本轮判定面的噪声，不是仓级债：

- `[173]` — 复算时有未提交的新增 docs 文件，`trackedFiles` 与 README 生成块尚未同步；新增文档入库同枚重算后应转绿（见 §3 复核）。
- `[281]` — 同一原因（工作树里有未提交路径），提交后应转绿。

## 2. 本轮待办：3 道未判定（不记绿也不冒红）

| # | 门 | 复现 |
| --- | --- | --- |
| 1 | `[265]` .ps1 必须带 UTF-8 BOM（差值棘轮） | `node scripts/check-ps1-bom.mjs` |
| 2 | `[268]` PROJECT_PLAN.md 回捞件差值棘轮 | `node scripts/check-head-recall-stock.mjs` |
| 3 | `[70b]` i18n 死 key 扫描（索引 blob 面） | `node scripts/scan-dead-i18n-keys.mjs` |

## 3. 处置

1. **不属于本枝**：以上 27 红 / 3 未判定各自开票，谁引入谁修，不在这条线上顺手改；
2. 与门体同代自检无关的（绝大多数）按既有排期推进；
3. 其中 `[173]`、`[281]`、以及 push 面新冒出的 `[193]`（`scripts/check-hand-migration-snapshot.mjs:339` 派生 git 未写 `stdio`，来自 `origin/main` 的 `8a7c642ed4`，非本枝引入）在推送后单独复核并记录；
4. 复核口径：本地 `--staged` 绿不算数，须在 `origin/main` 检出上各跑一次同命令。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
