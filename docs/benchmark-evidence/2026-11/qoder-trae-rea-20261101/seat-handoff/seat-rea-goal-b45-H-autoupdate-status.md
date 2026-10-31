<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# H-autoUpdate 心跳（G-22 次级残腿 · 判据与命令层）

开工时刻：2026-11-01（本席第一次写盘）
基线 HEAD：`88bd07c0c0e2370c2e7ddbae070706356bde07a5`（`git rev-parse HEAD` 现读），分支 main，未做任何 commit。

## 对票面「现状格」的复核结果（以代码为准）

| 票面陈述 | 实测 | 差异点名 |
| --- | --- | --- |
| `apps/cli/src/plugins/` 有 11 个模块 | **实测 12 个**：`cache git-runner index installer loader marketplace paths registry types url-shape` + **`path-safety.ts`** | 票面漏登记 `path-safety.ts`（G-747 链接逃逸判据的持有者）。不影响本票，但它存在 ⇒ 取源侧的「唯一咽喉点」是 `url-shape.ts::assertGitCloneInputs`（`marketplace.ts:172-182` 转发），本席新 git 派生点必须问它。 |
| `defaults.ts:50-51` 两档显式 `enabled:false`，`:48` 注记写明判据 | **逐字吻合**（现读 50-51 行 `pluginMarketplace`/`plugins`） | 无差异；默认态那一格**本席不动**。 |
| 门 277 `scripts/check-plugin-manifest-integrity.mjs` 枚 `6f57e57fe6` 已落 | 门体存在；runner 现读 `id: '277'`、`mode: 'warn'`、`stagedTriggers: ['apps/cli/src/plugins/']`（`scripts/guardian-runner.mjs:6671-6677`） | 无差异。**注意**：本席改 `apps/cli/src/plugins/**` 会触发它 —— 只读判据，不写台账，不会自触发漂移。 |
| 写侧采集器 `installer.ts:507 collectInstallFileDigests`，收口 `:623` | **行号逐字吻合**（现读 507 / 623） | 无差异。本席只 import，不改 `installer.ts`。 |
| 对照程序事实（`~/.qoder-cn/plugins/` 台账 + `known_marketplaces.json` 的 autoUpdate + `G:/Qoder CN/resources/bundled-resources/archives/`） | 目录**存在**：`installed_plugins.json`、`installed_plugins_v2.json`、`known_marketplaces.json`、`marketplaces/`、`cache/`、`data/`；archives 下 `qoder-cn-computer-use/` 等 3 个插件桶 | 无差异；**本席不打印这些文件的值**（票面 T7/T8 规矩：只取结构与字段名）。`known_marketplaces.json` 这一枚正好是「市场登记面」的对照物 ⇒ 本席的 `marketplaces.json` 判据与之同形。 |

## 本席的架构落点（含一处与票面预设不同的取舍，先点名）

票面要求「判据 import 门 277，不得另写第二份哈希/比对实现」，但同时把受影响文件限定在 `apps/cli/src/**`。这两条在本仓**结构上相撞**：
`apps/cli/tsconfig.json` 写死 `rootDir: "src"`，且 `cache.ts:301-303` 的头注已把这条边界写死在案（src import `scripts/**` ⇒ TS6059，发布清单 `files:["dist","src"]` 不含 `scripts/`）。

⇒ 最小可回退的一档（本席选定）：
1. **哈希只有写侧那一份**：新台账一律经 `apps/cli/src/plugins/installer.ts:507 collectInstallFileDigests` 采集（TS 同包 import，零复算）。
2. **比对/三态只有门 277 那一份**：经**运行时动态 import** 取 `scripts/check-plugin-manifest-integrity.mjs` 的 `judgeRecord(record, pluginsRoot)`（唯一出口，仓根按 upward-search + `IHUI_PLUGIN_INTEGRITY_GATE` 覆盖定位）。取不到 ⇒ 判据当场 `unjudged('integrity-gate-unavailable')`，**绝不回落成本端第二份比对**（§0.3 + §0.6）。打包态 CLI 因此如实报「无从判定」，而不是造假绿。
3. 本席**不改**门 277、不改 `installer.ts`、不碰 runner/guardian（派发腿交主席）。

## 进度

- [x] 现状格复核完成（本文件）
- [x] `marketplace.ts`：市场登记面的只读判据（`MARKETPLACE_REGISTRY_FILENAME` / `getMarketplaceRegistryPath` / `loadRegisteredMarketplaces` / `explicitMarketplaces` / `resolveMarketplaceEntryForRecord`）
- [x] `update-plan.ts`：`checkUpdates()` 三态 + `planUpdate()` 只出计划（判序 ①→⑦，三条超越轴都在牙上）
- [x] `commands/plugin-updates.ts`：CLI 出口（`--check-updates` / `--plan-update` / `--json`，默认零副作用；`registerPluginUpdatesCommand` 供主席一行接线）
- [x] `tests/plugin-update-plan.test.ts`：23 例（票面 5 条行为 + CLI 3 条 + 形状锁 3 条 + 市场解析/档位补充）
- [x] 验证：typecheck 0 错 / 本批 23/23 / 邻档插件回归 176/176 / 门 277 --self-test 21/21 / 水印 inject + 门 95 绿
- [x] 台账与 PLAN 未动（票面禁止）；`--apply` 与派发腿留给后续票

## 末行现读（2026-11-01 收尾）

```
ihui-cli:typecheck: $ tsc --noEmit → Tasks: 8 successful, 8 total（--force 轮）
 Test Files  1 passed (1)      Tests  23 passed (23)      # tests/plugin-update-plan.test.ts
 Test Files  7 passed (7)      Tests  176 passed (176)    # 邻档插件回归
[plugin-integrity] [self-test] 21/21 通过
[check:watermark-syntax] 取材=显式文件 4 个 … 全部通过
[plugin-updates] 结论=unjudged 面=装机(只读) …(整面未判定:no-install-records)  RC=2
```

## 遗留与归因（不代他人修）

- 全量 `vitest run`（apps/cli）有 3 枚红与本席无关：`config-merge` / `spec-drift` / `tool-parallelism-cost-guard`。
  取证方式：把本席 3 枚新文件移出工作树、`marketplace.ts` 还原 HEAD 版后同跑 ⇒ **同样 3 红**（可复现）；
  工作树里另有他人未提交的 `apps/cli/src/commands/security.ts`、`src/hooks/index.ts`、`src/security/` 在飞。
- `tsconfig.tests.json` 面本席贡献 1 条 TS7016（`scripts/lib/scratch-dir.mjs` 无声明文件），与同面既有 30 条逐字同形，属存量档（该面未接提交链）。
- `plugins/index.ts` 未加 `export * from './update-plan.js'`（不在本席受影响文件清单内）；主席接线时补一行即可。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
