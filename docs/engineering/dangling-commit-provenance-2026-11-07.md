<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 悬空提交归宿登记 + 门 30a 信号质量问题（票）

- 记录日期：2026-11-08
- 核查对象：门 30a（`未备份悬空 commit，待处置 2`）点名的两枚提交
- 结论状态：已核查完毕，**不重落、不新增 tag、不删不改**

---

## 一、事实面：两枚悬空提交的归宿

### 1.1 身份

| 字段 | 提交 A | 提交 E |
|---|---|---|
| 完整 sha | `201b051e570a2e5dc4ff85402bc4dffa509630c2` | `e20cdc6e7189a4a25fa7d25ca59b657b4c351cea` |
| author / committer | `智汇AGI社区 <ok502319984@gmail.com>` | `t <t@t.local>` |
| 作者时间 | 2026-11-07T13:40:05+08:00 | 2026-11-07T13:37:37+08:00 |
| 父提交 | `12037d4f7a87a0426c1d7af596fb0126d71097da` | `12037d4f7a87a0426c1d7af596fb0126d71097da` |
| tree | `445dfe2799db940c5325fa493dbe12350395a2c1` | `445dfe2799db940c5325fa493dbe12350395a2c1` |
| patch-id（`git patch-id --stable`） | `3de84b288f170f5571b3a13c59014db7415bbe48` | `3de84b288f170f5571b3a13c59014db7415bbe48` |
| 引用 | 仅 `refs/tags/lost-commit/201b051e570a2e5dc4ff85402bc4dffa509630c2` | 仅 `refs/tags/lost-commit/e20cdc6e7189a4a25fa7d25ca59b657b4c351cea` |

`git diff 201b051e570a e20cdc6e7189` = 空。两枚 tree 相同、patch-id 相同、父相同，属**同一份内容的两次提交**，仅身份不同。

### 1.2 归宿

| 字段 | 值 |
|---|---|
| 归宿提交 | `e69651e43f0014c24a66986117ffec3d883c4c25` |
| 归宿提交父 | `9befaa51cb00fb1fad64cc750a4fc4d1deb963b6` |
| 归宿提交 tree | `d7c2ff17311f220f0c919aa3389d066d11a7f581` |
| 归宿提交 patch-id | `b8f534a6b1504afcec3dc311f974bb9a12fd3f91`（**与两枚不同**） |
| 可达性 | 在 `origin/main`，并被 `feat/cross-end-pipeline-reland-20261108`、`feat/cross-end-pipeline-inventory-20261108`、`feat/align-page-registry-1108` 等分支包含 |

### 1.3 判定方法与读数

| 方法 | 命令 | 读数 |
|---|---|---|
| 祖先 | `git merge-base --is-ancestor <sha> origin/main` | 两枚 = 否；父 `12037d4f7a` = 是 |
| 引用包含 | `git branch -a --contains <sha>` | 两枚均无输出 |
| 补丁等价 | `git cherry origin/main <sha>` | 两枚均输出 `+ <sha>`（上游无等价补丁） |
| 补丁指纹 | `git patch-id --stable` | 两枚 `3de84b28…`；归宿 `b8f534a6…` |
| 逐文件树对比 | 10 文件 blob 对比 A / 归宿 / `origin/main` | 9 文件与归宿及 `origin/main` 逐字节相同 |
| 对象可达性 | `git log origin/main --find-object=8b4a22dfb63e4fb30e9ec364f8d0a0ce6c3a1d2e` | 空 |

逐枚判定：

- `201b051e570a…`：**未被任何活分支以同一 patch 包含**；内容 9/10 文件已与 `origin/main` 逐字节一致，第 10 个文件为改写版，归宿 `e69651e43f`。
- `e20cdc6e7189…`：同上。

### 1.4 改动清单（两枚相同，合计 514+/68−）

| 文件 | +/− |
|---|---|
| `apps/miniapp-taro/src/components/DrawerComponent.tsx` | 16/7 |
| `apps/mobile-rn/src/components/Drawer.tsx` | 4/2 |
| `apps/web/app/globals.css` | 5/4 |
| `apps/web/src/components/sidebar/Sidebar.tsx` | 10/7 |
| `docs/GATEKEEPERS.md` | 3/3 |
| `docs/engineering/miniapp-shell-backlog.md` | 1/1 |
| `packages/design-tokens/src/geometry.js` | 2/1 |
| `scripts/check-sidebar-width-consistency.mjs` | 271/42 |
| `scripts/guardian-runner.mjs` | 3/1 |
| `scripts/tests/check-sidebar-width-consistency.test.mjs` | 199/0 |

### 1.5 唯一差异文件与差异性质

唯一差异文件：`apps/miniapp-taro/src/components/DrawerComponent.tsx`

| 版本 | blob |
|---|---|
| A / E（悬空） | `8b4a22dfb63e4fb30e9ec364f8d0a0ce6c3a1d2e` |
| 归宿 `e69651e4` | `7cbf3dd66957105864d95aca572fa31d21439530` |
| 现 `origin/main` | `7cbf3dd66957105864d95aca572fa31d21439530` |

差异内容（12 行）：A 版缺图兜底使用 `<LineIcon name="circle" size={taroGeometry.glyphSm} color="var(--color-muted-foreground)" />`，未带 `marginRight`；归宿版改为 `renderIcon('circle', 36, { marginRight: rpx(12) })`。

性质：**A 版为草稿，归宿版为改进版**。竖排菜单下 A 版缺失 `marginRight` 会导致图标贴住文字；归宿版修正该缺陷。原样重落 A 版等于将该处回退为缺陷版本，故不重落。

### 1.6 成因

| 时间（+08） | 事件 |
|---|---|
| 2026-11-07 13:09:56 | `origin/main` = `12037d4f7a`，即两枚的父 |
| 2026-11-07 13:37:37 | 提交 `e20cdc6e7189`（身份 `t <t@t.local>`） |
| 2026-11-07 13:40:05 | 提交 `201b051e570a`（正式身份，同一 tree） |
| 2026-11-07 13:55:30 | `origin/main` 前进到 `7c247abf7f` |
| 2026-11-07 14:10:55 | 提交 `e69651e43f`，基为新 `9befaa51cb`（比父晚 5 个提交），`DrawerComponent` 兜底改写 |
| 2026-11-07 14:11:22 | 推送 `9befaa51cb → e69651e43f`（reflog `update by push`） |

成因读数：扫描 169 个 reflog 文件（本地分支 + 各 worktree HEAD），`201b051e570a`、`e20cdc6e7189`、`e69651e4` 均 **0 命中**。

结论：两枚**从未被任何分支 ref 持有**（提交于 detached / 临时上下文，或持有其的临时 ref 与日志已被清除）。不属 cherry-pick 残留——cherry-pick 产物会挂在目标分支且源/目标 patch-id 相同，此处两者皆不成立（父不同、patch-id 不同、有实质改写）。亦无可追溯的 reset/drop 记录。

### 1.7 处置

- 不重落（草稿会被改进版覆盖，且当前 `fix/gen-artifacts-1107` 无这批文件）。
- 不新增 tag（备份已由 `lost-commit/` 两枚覆盖）。
- 一条未删、未 reset、未改内容。

---

## 二、票：门 30a 信号质量问题（只记录，不实现）

### 2.1 现状读数

| 指标 | 读数 | 来源 |
|---|---|---|
| `uncovered` | 8664 | `worktrees/IHUI-AI-wt-pipeline/ihui-commit-loss-cache.json` → `detail3b` |
| `realGaps` | 3265 | 同上 |
| `noDiff` | 5399 | 同上 |
| `lost-commit/*` tag 数 | 26,592 | `git tag -l 'lost-commit/*'` 行数 |
| 两枚本案例位置 | `realGaps.topHashes` 第 3、4 位 | 同上 |

### 2.2 本案例证据

两枚被门 30a 计入 `realGaps`（"已备份未落地"）。核查结果为：10 个文件中 9 个与 `origin/main` 逐字节相同，剩余 1 个是**已被后续提交取代的草稿变体**。即 `realGaps` 的计数把"已被改写取代的草稿"与"真正丢失的改动"混在同一档。

### 2.3 风险

报警里 99% 是噪音时，真丢的那一枚会被淹掉。当前 `realGaps` 无分档，3,265 条同权，人工无法逐条核；且 26,592 个备份 tag 本身已是噪音源，"已备份"这一状态被过度使用，无法区分"备份了但没落地"与"备份了且已被取代"。

### 2.4 可行的分类方向（仅设计，不实现）

按两个正交信号分档，产出三档而非一档：

| 档 | 判据 | 含义 |
|---|---|---|
| 已落地 | commit 的 patch-id 或逐文件 blob 在任一活分支可达历史中存在 | 无需处置，可从报警中剔除 |
| 已取代 | 提交自身不可达，但其全部改动文件路径在活分支上存在**且内容已被后续提交改写**（blob 不同、diff 无新增唯一内容） | 备份留档，不进报警 |
| 真丢失 | 提交不可达，且至少一个改动文件的 blob **从未进入任何可达历史**（`git log --find-object=<blob>` 为空） | 真报警，需人工处置 |

参考实现路径（未实现）：在 `check-commit-loss` 现有逐路径覆盖判定之外，增加一次 `--find-object` 反查，把"路径被覆盖"细分为"该提交的 blob 被覆盖"与"路径存在但 blob 被改写"两类；前者剔除，后者降级为 `noDiff`/`superseded` 档，仅保留 blob 从未出现者进入 `realGaps`。

同时建议：`lost-commit/*` 备份 tag 的生成与报警判定解耦——备份可以是全量的，但报警必须按上述三档收敛，避免以 tag 数量代替信号质量。

### 2.5 边界

- 本票只记录问题与分类方向，**不修改 `check-commit-loss` 或任何门判据**。
- 未评估该改动对现有门预算与并发的影响。

---

## 三、票：README 写口与门 173 判面不一致（只记录，不改脚本）

### 3.1 事实

| 角色 | 实现 | 取数面 |
|---|---|---|
| 写口 | `scripts/sync-readme-numbers.mjs` → `node scripts/gen-doc-numbers.mjs --markdown` | **worktree**（`--markdown` 未带 face，取默认） |
| 门 173 | `node scripts/check-doc-numbers.mjs --staged` | **index（staged）** |

两面在同一工作树上可以不同：worktree 面把未跟踪文件计入 `trackedFiles`、`testFiles`、`ciWorkflows`，index 面只算 HEAD + 暂存。

### 3.2 本案例读数（同一时刻、同一工作树）

| 指标 | index 面（门判） | worktree 面（写口取） | 差 |
|---|---|---|---|
| `trackedFiles` | 19790 | 19843 | +53 |
| `testFiles` | 4289 | 4300 | +11 |
| `ciWorkflows` | 55 | 56 | +1 |

差值来源：并发线上 53 个未跟踪文件，含 `scripts/tests/*.test.mjs`、`apps/miniapp-taro/tests/*.test.tsx`、`.github/workflows/mobile-store-publish.yml` 等。

### 3.3 后果

- 写口把**并发线未落库的文件**计入并写入 README，提交后与 index 面判据不一致，门 173 必然判红；本案例连续 3 次红。
- 危险在于该输出仍是"生成器输出"，形式上合法（非手抄），一旦提交即把别人未落库的文件数**固化**为文档事实，且事后难以与真实漂移区分。

### 3.4 建议修法

- 写口增加显式 `--face` 参数，**默认 `staged`**（与门 173 同面）；`--face worktree` 仅用于发布前预演，且执行时必须打印警告说明其包含未跟踪文件。
- `check-doc-numbers.mjs` 与 `sync-readme-numbers.mjs` 共用同一 face 常量与默认值，避免两处默认面各自漂移。
- 若必须保留 worktree 面，则应在写口输出中显式打印 face 与计入的未跟踪文件数，使"生成器输出"可审计。

### 3.5 边界

- 本枚**只记录、不改脚本**：`sync-readme-numbers.mjs`、`gen-doc-numbers.mjs`、`check-doc-numbers.mjs` 均未修改。
- 本案例的 README 数字由 `gen-doc-numbers.mjs --staged --markdown` 输出整块机械替换获得，未手改数字。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
