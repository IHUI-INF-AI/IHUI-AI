<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 原路径: D:\IHUI-AI\.ihui-agent\tmp\merge-preflight-20261107.md
> 生成时间: 2026-11-07 15:47:05
> 所属工作线: 收敛线（merge 预演）

<!--
  普通 merge 预演 + 6 文件三方对照（只读，不合并、不 push、不碰索引、不 fetch）
  生成: 2026-11-07
  基准: merge-base 7c247abf7f / ours HEAD 2a752788b4 / theirs e69651e43f
-->

# 普通 merge 预演与 6 文件三方对照

## 0. 裁定与边界

- 路线：**普通 `git merge` + 对真冲突做人工 union + 自带闸验算**，不再重跑全仓 `union-converge`。
- 本次只读：未执行 merge/commit/push，未改索引与工作树，未 fetch。
- 唯一写入：`git merge-tree --write-tree` 在对象库里写出一棵结果树 `65d961c0c47f80f6b1df94a057553ef2804ef97b`（只产生 object，不落工作区、不进索引）。

## 1. 三个基准

| 角色 | sha | 说明 |
|---|---|---|
| merge-base | `7c247abf7f` | 共同祖先 |
| ours | `2a752788b4` | 当前 HEAD（517 ahead / 5 behind） |
| theirs | `e69651e43f` | 当前本地 `origin/main` |

## 2. 六个文件的三方差异（行数）

| 文件 | base 行 | ours 行 | theirs 行 | 合并后行 | ours 增/删 | theirs 增/删 |
|---|---|---|---|---|---|---|
| `apps/web/src/stores/chat.ts` | 2561 | 2578 | 2724 | **2741** | +18 / −1 | +164 / −1 |
| `packages/i18n/messages/web/en.json` | 30103 | 30110 | 30105 | **30112** | +7 / 0 | +3 / −1 |
| `packages/i18n/messages/web/ja.json` | 30106 | 30113 | 30108 | **30115** | +7 / 0 | +3 / −1 |
| `packages/i18n/messages/web/ko.json` | 30106 | 30113 | 30108 | **30115** | +7 / 0 | +3 / −1 |
| `packages/i18n/messages/web/zh-CN.json` | 30107 | 30114 | 30109 | **30116** | +7 / 0 | +3 / −1 |
| `packages/i18n/messages/web/zh-TW.json` | 30107 | 30114 | 30109 | **30116** | +7 / 0 | +3 / −1 |

合并后行数 = ours 行 + theirs 净增，逐文件成立（chat.ts 2578 + 163 = 2741；JSON 30110 + 2 = 30112，依此类推）。

## 3. 逐处并集：保留哪一侧

### 3.1 `chat.ts`（逐块过，未整段取一侧）

| 来源 | base 位置 | 内容 | 并集保留 |
|---|---|---|---|
| ours | 118 | `partialArgs` + `argsStreaming` 两个字段声明（+6 行） | **保留 ours** |
| ours | 1207–1213 | `revokedIds` 分支改为把 `partialArgs` 收敛为正式 `args`（−1/+12） | **保留 ours** |
| theirs | 29 | `queue-interactions` 改多行 import（引入 `admitCapacityQueueOp` 与三个类型） | **保留 theirs** |
| theirs | 779 | `ChatState` 增 `capacityQueuePausedByConversation` 与 `applyCapacityQueueOp` 签名（+13） | **保留 theirs** |
| theirs | 1037 | 初始态 `capacityQueuePausedByConversation: {}`（+1） | **保留 theirs** |
| theirs | 2195 | `applyCapacityQueueOp` 实现（+38） | **保留 theirs** |
| theirs | 2499 | `partialize` 白名单加一项（+1） | **保留 theirs** |
| theirs | 2558（EOF） | `ColdStart*` 类型 + `planColdStartRestore`（+105） | **保留 theirs** |

**语义耦合检查**（决定「能不能两块都要」）：
- theirs 的 `applyCapacityQueueOp` 依赖 `SideQueueItem` —— 该类在 base 的 `apps/miniapp-taro/src/pkg-ai/ai/side-queue-host.ts:30` 已定义，不是任一侧新增。
- theirs import 的 `admitCapacityQueueOp` 在合并树里存在：`packages/shared/src/chat/queue-interactions.ts:347`。
- ours 的 `partialArgs` 只在 ours 自己的两个 hunk 内使用，与 theirs 新增块无交叉。
- 合并树 `chat.ts` 里三方标记（`partialArgs` / `applyCapacityQueueOp` / `planColdStartRestore`）命中 6 处，**两侧内容都在**。
⇒ 两块互不依赖，**不需要在任一处二选一**。

### 3.2 五份 i18n JSON（每份两处 ours + 两处 theirs，位置互不相邻）

| 来源 | 位置 | 键 | 并集保留 |
|---|---|---|---|
| ours | ~14714 | `dagRemoveNode`、`dagRemoveEdge` | **保留 ours** |
| ours | ~29584 | `prevMonth`、`nextMonth`、`thisMonth`、`selfCheckOutSuccess`、`selfCheckOutFailed` | **保留 ours** |
| theirs | ~7981 | `timeout` 行补逗号 + `stub` | **保留 theirs** |
| theirs | ~8584 | `statusStub` | **保留 theirs** |

ours 的键在 14714/29584 区间，theirs 的键在 7981/8584 区间，**没有任何一行是两侧同时改的**；唯一被改动的是 theirs 的 `"timeout"` 行（ours 未碰），因此该行取 theirs 版本即可，不构成取舍。

## 4. 行级集合判定（不是目测）

对合并树 `65d961c0…` 里 6 个文件逐行做**多重集包含**：

| 文件 | 对侧新增行未落入合并树 | 本地新增行未落入 | 对侧已删行被复活 | JSON 可解析 |
|---|---|---|---|---|
| `chat.ts` | **0** | **0** | **0** | — |
| `en.json` | **0** | **0** | **0** | valid |
| `ja.json` | **0** | **0** | **0** | valid |
| `ko.json` | **0** | **0** | **0** | valid |
| `zh-CN.json` | **0** | **0** | **0** | valid |
| `zh-TW.json` | **0** | **0** | **0** | valid |

判定口径：
1. 对每个文本行 `l`，要求 `count(合并树, l) ≥ count(theirs, l)` —— 即「对侧有的行，并集一行不少」；
2. 同样要求覆盖 ours；
3. 对 `base` 有、`theirs` 删掉、`ours` 也没新增的行，要求合并树里出现次数为 0（不得复活）。

三项全为 0 ⇒ **六个文件均无丢行、无复活**。

## 5. merge 预演（`git merge-tree --write-tree`）

```powershell
git -C D:\IHUI-AI merge-tree --write-tree HEAD e69651e43f
```

结果：

```
65d961c0c47f80f6b1df94a057553ef2804ef97b
rc=0
```

- **冲突文件清单：空**（无任何 conflict 行输出）。
- 合并树相对 HEAD 的文件差异数：**142**，恰好等于对侧 `mb..origin/main` 的 142 个文件 ⇒ 对侧 5 个提交的内容全部进树，本侧 818 个文件一个没丢。
- 需要人工并的文件数：**0**（不是 6）。

### 5.1 为什么与「算出 6 个需人工」不一致（这条本身就是判据）

之前的「6 个」来自**文件级**交叠（两侧都改过同一文件）。实际决定是否需要人工的是**块级**交叠：

- `chat.ts`：ours 在 118 / 1207，theirs 在 29 / 779 / 1037 / 2195 / 2499 / 2558 —— 区间互不重叠；
- 五份 JSON：ours 在 ~14714 / ~29584，theirs 在 ~7981 / ~8584 —— 互不重叠。

块不重叠 ⇒ 3-way merge 自动取并集，**文件级交叠只是「潜在冲突」的上界，不是人工量的下界**。正确的人工量预测器是 hunk 交叠，本次为 0。

顺带解释了 13:33 那次为什么判红：判红发生在 6 份**预制件**（`AGENTS.md` / `PROJECT_PLAN.md` / `README*.md`）的人工归并上，而普通 merge 根本不需要这些预制件——这些文件对侧自 merge-base 以来**没改过**（blob 全同），merge 直接保留 ours，不需要任何并集动作。

## 6. 结论

1. **不需要人工并任何文件。** 6 个文件块级无交叠，`merge-tree` 零冲突，行级校验全 0。
2. **普通 merge 可行**：142 个对侧文件全量进入结果树，本地 818 个改动文件全部保留，JSON 全部可解析，交叉依赖（`SideQueueItem` / `admitCapacityQueueOp`）在合并树里可解析。
3. **原先的「6 文件 union」与「6 份预制件对账」在普通 merge 路线下都退化为 0 人工量**；真正剩下的阻断只有索引归属（688 条暂存删除 + 1829 条暂存修改不属本线）。
4. 建议的闸验算（仍未执行）：在合并树或临时 worktree 上跑 `check-miniapp-shell-form` / `typecheck` / i18n 键完整性；本文件不构成执行授权。

## 7. 预演期间索引变化（只报增量）

| 桶 | 预演前 | 预演后 |
|---|---|---|
| porcelain 总数 | 2814 | 2814 |
| ` M` | 217 | 217 |
| `M ` | 1829 | 1829 |
| `D ` | 688 | 688 |
| `MM` | 38 | 38 |
| `??` | 19 | 19 |

**变化量：0**（HEAD 仍 `2a752788b4`，仍 517 ahead / 5 behind）。不追溯归属。

## 8. 合并对象与四项自检（已造出，未推送）

| 项 | 结果 |
|---|---|
| merge commit | `a27241192dc1ea5ca769753fea55e2f8047911c8` |
| tree | `65d961c0c47f80f6b1df94a057553ef2804ef97b` |
| parent 1（first-parent） | `2a752788b4836d722dcd6ae91b66985d8ba45632`（HEAD） |
| parent 2 | `e69651e43f0014c24a66986117ffec3d883c4c25`（origin/main） |
| ref | `refs/curation/merge-main-20261107` → `a2724119` |
| `HEAD..merge` | **142 文件 / +9683 / −101**（= 对侧全量） |
| `theirs..merge` | **818 文件 / +75918 / −7561**（= 本侧全量） |
| `ours..merge` 路径构成 | 810 个 `O\T` + 8 个 `O∩T`；0 个 `O` 之外 |
| fsck --connectivity-only | **rc=0**，0 条 error/missing/broken，5681 行进可达提示；从 merge 可达 **372,440** 对象 |
| 独有对象 | merge 相对两侧都独有 **56 个**（merge 自身 + union 树的 blob）；相对 HEAD 293、相对 theirs 4347 |

`theirs..merge` 为什么是 818 而不是 810：
- 810 是 `O\T`（本侧改、对侧没改），这些文件对侧仍是 base 内容，合并后取 ours ⇒ 全部出现在 diff 里；
- 另外 8 个是 `O∩T`（两侧都改），合并结果是 **双方并集**，内容严格大于 theirs 的单侧版本 ⇒ 也出现在 diff 里；
- 合计 818，且 `diff_only_outside_O = 0`，说明没有任何文件是「凭空多出来的」。

## 8.1 事实基础（2026-11-07 14:42 实测，落地判定以此为准）

1. **auto-converge 仍在运行**：`union-converge.mjs --apply --theirs a462642509`（pid 39920，14:36:32 起）+ 驱动 `git-sync-converge.mjs --branch main`（pid 14432，14:00:26 起）。
2. **`origin/main` 自己在动**：14:27:30 已到 `a462642509`（round4 merge），`HEAD..origin/main = 18` 个提交。
3. **HEAD 7.4 分钟一动**：13:21→14:28 共 9 个提交，平均 7.4 分钟一枚；merge 每约 22 分钟一次（`b1e95286af` / `bc920ca51e` / `4d36cc8f7a`）。
4. **索引与工作树停在 `1291b6989a` 那代**：19,146 条目里 19,126 与 `1291b6989a` 树逐字节相同；787 条 `D ` 与 1845 条 `M ` 100% 落在 `1291b6989a..HEAD` 的 2690 个改动文件内。⇒ 脏不是「人改的」，是 converge 用 object-space 推进 HEAD 却不更新工作树的必然产物。
5. **索引正被每轮重写**（`.git/index` → 实际在 `D:\IHUI-AI-git-repo\index`，mtime 14:34:44）。索引独有 blob 已存证：
   `refs/curation/index-orphans-20261107` → `44e1de25ed58cbf321ef7095b6d64aba4446428b`（tree `5d35dea688`，parent `4d36cc8f7a`，捕获 16 个 orphan）。
   纯文本另存：`.ihui-agent/tmp/check-staged-resurrection.orphan.txt`、`.ihui-agent/tmp/intentional-file-deletions.orphan.txt`。
6. **锚点每次重算**：`a27241192d` 已过期（p1 落后 1 枚、p2 落后到 round4），**不得复用**。落地一律走 `refs/curation/merge-main-latest`，由落地脚本在落地前用当前 HEAD 与当前 `origin/main` 现算。
7. **14:42 重算结果是 rc=1、3 处冲突**（`PROJECT_PLAN.md` / `README.md` / `README.en.md`）—— 见 §13。**「索引干净」不再是阻断项**；阻断项改为「`merge-main-latest` 的重算结果 + 冲突解算」。

## 9. 落地步骤（待授权执行）

> 以下命令**不得**在当前轮执行。前置条件：`refs/curation/merge-main-latest` 重算通过 + 人类授权。
> 作者：本文件；性质：清单，不是执行记录。
> **落地不依赖工作树**：所有判定以 `merge-main-latest` 的树为准；工作树只影响落地后的验门。

### 9.0 清理索引（**已可做**，本轮仍不执行）

> **状态更新（2026-11-07 15:0x）**：前两版写「必须等收敛进程停下」。现在这个前提**已满足**：
> - `union-converge` / `git-sync-converge` 进程全部退出（15:00:03 实测 pid 39920/14432/16488/14576 皆 DEAD）；
> - 索引树 `5d35dea688` 自 14:42:33 快照以来**逐字节未变**（不是"看起来没动"，是 tree oid 相同）；
> - 索引独有 blob 已有 ref 兜底：`refs/curation/index-orphans-20261107` → `44e1de25ed`（tree `5d35dea688`，16 个 orphan）。
>
> ⇒ **清索引从"可选"回到"可做"**，但它仍**不是落地的前置**：落地走 `merge-main-latest` 的对象树，不依赖工作树。只有在"希望工作树与 HEAD 一致、便于跑验门"时才需要。

**这批脏量是什么**（14:42 普查结论，未变）：索引 19,146 条目中 19,126 条的 blob 等于 `1291b6989a` 的树 ⇒ 索引停在**旧一代**，不是别人的未完成工作。所以 787 `D ` 的 blob 全部现存于 `1291b6989a^{tree}`，1,845 `M ` 的"旧内容"也全部可取回。

**可行形态（索引装置分离，两步；顺序不能反）**

```powershell
$repo='D:\IHUI-AI'
# 步骤 0（前置，只读）：确认两件事
git -C $repo status --porcelain | Group-Object { $_.Substring(0,2) } |
  Sort-Object Count -Descending | Select-Object Count,Name          # 期望 D =787 / M =1845
(Get-Item D:\IHUI-AI-git-repo\index).LastWriteTime                   # 与 60s 后再读一次比对，必须相同
# 步骤 0b（存证，先落清单再挂 ref —— §12.4 更正后的硬要求）
git -C $repo diff --cached --name-status | Set-Content -Encoding utf8 "$repo\.ihui-agent\tmp\index-snapshot-$(Get-Date -Format yyyyMMdd-HHmm).txt"
git -C $repo diff --cached | Set-Content -Encoding utf8 "$repo\.ihui-agent\tmp\index-snapshot-$(Get-Date -Format yyyyMMdd-HHmm).patch"

# 步骤 1（索引归位）：只动索引、不动工作树、不动 HEAD、不动分支
git -C $repo read-tree HEAD
# 等价于 git reset（mixed）但语义更窄：把索引整体置为 HEAD 的树。
# 之后 787 D 变成未暂存删除（" D"）、1845 M 变成未暂存修改（" M"）；文件内容一个都没丢。

# 步骤 2（工作树归位，可选，必须逐路径）：仅当要跑验门时
$gone = git -C $repo diff --name-only --diff-filter=D            # 787 条
$gone | ForEach-Object -Begin {$i=0} -Process { $i++; git -C $repo restore --source=HEAD --worktree -- $_ }
```

**明确禁止**（会把别人的在飞内容一起抹掉，或不可逆）：
- `git checkout .` / `git restore --worktree -- .` —— 工作树里可能真有持牌会话的未提交改动；
- `git reset --hard` —— 连工作树一起回退；
- `git clean -fd` —— 删未跟踪文件，本仓 `.ihui-agent/` 下大量存证会被清掉。

**为什么不选 B（`restore --staged .`）**：`restore --staged .` 与 `read-tree HEAD` 落点相同（索引退回 HEAD），但它按 pathspec 走，容易在多轮之间被误扩到工作树；`read-tree HEAD` 一次原子换树，且不碰 HEAD/分支，回退只需 `read-tree <旧 tree>`（旧树 = `5d35dea688`，已由 orphan ref 固化）。

### 9.1 校验对侧未再前移，然后前移 main（fast-forward，不产生新提交）

```powershell
$repo='D:\IHUI-AI'
git -C $repo fetch origin
git -C $repo rev-parse origin/main          # 必须仍等于锚点重算时记录的值;已前移 ⇒ 停下来重做 merge-tree 预演
git -C $repo rev-parse refs/curation/merge-main-latest   # 锚点;**只有 rc=0 时才会存在**
git -C $repo status --porcelain | Measure-Object -Line   # 期望 0
git -C $repo update-ref refs/backup/main-pre-merge-20261107 (git -C $repo rev-parse HEAD)
git -C $repo switch main
git -C $repo merge --ff-only refs/curation/merge-main-latest
```

`--ff-only` 成立的原因：锚点提交的第一个 parent 就是当时的 HEAD，ref 可直接前移，**不会新建第三个提交**。
> 本条不写死 sha：锚点每轮重算（§2 纪律），写死会立刻过期。当前状态见 §21。

### 9.2 验门（必须在 push 之前）

```powershell
$repo='D:\IHUI-AI'
node "$repo\scripts\guardian-runner.mjs" --push-gate
# 若 299 仍慢:先确认依赖态健康(本次实测 59–202s),不要设 GUARDIAN_GATE_TIMEOUT_MS;
# 若确需临时覆盖,必须在提交信息/台账留痕,并注明它会压掉 30a 的 900s
```

### 9.3 推送（普通 push，禁止 force）

```powershell
$repo='D:\IHUI-AI'
git -C $repo push origin main
```

## 10. 回退方式

两个 ref：

| ref | 指向 | 用途 |
|---|---|---|
| `refs/backup/main-pre-converge-12037d4f7a` | `76c84394d0`（13:29:41 快照） | 回到 13:17 收敛失败前的旧态 |
| `refs/curation/merge-main-20261107` | `a2724119`（本次合并对象） | 合并结果锚点；也用于 diff / 重放 |

> **重要**：`76c84394d0` **不是**当前 HEAD。它是 13:29 的旧快照，13:29 之后本地新增的提交不在其中。要回到「今天合并前」，应使用 merge 的 first parent `2a752788b4`，或 9.1 新建的 `refs/backup/main-pre-merge-20261107`。

### 10.1 未推送时（main 已前移但还没 push）

```powershell
$repo='D:\IHUI-AI'
git -C $repo switch main
git -C $repo reset --keep 2a752788b4836d722dcd6ae91b66985d8ba45632
# 或等价：git -C $repo switch -C main 2a752788b4
git -C $repo rev-parse HEAD    # 期望 2a752788b4
```
`reset --keep` 会拒绝覆盖未提交改动，比 `--hard` 安全；9.1 之后工作树本应干净。

### 10.2 已推送后（禁止 force push 到 main）

```powershell
$repo='D:\IHUI-AI'
git -C $repo revert -m 1 a27241192dc1ea5ca769753fea55e2f8047911c8
git -C $repo push origin main
```
用 `-m 1` 表示「保 first-parent（本侧历史）、反做对侧引入的 142 个文件」，生成一个新的回退提交，不改写已发布历史。

### 10.3 要退回 13:29 旧快照（仅在明确放弃其后所有本地提交时）

```powershell
$repo='D:\IHUI-AI'
git -C $repo update-ref refs/backup/main-pre-merge-20261107 a27241192dc1ea5ca769753fea55e2f8047911c8
git -C $repo switch -C main 76c84394d01ab11dbae809ed7e9b45a592433bb9
```
警告：这会把 `2a752788b4` 及其 517 笔提交移出 main 线（对象仍可从 `refs/curation/merge-main-20261107` 找回）。文件层兜底：`D:\DevEnv\backups\main-pre-converge-20261107-132945`（5216 文件 / 241.6 MB）。

## 11. 推送载荷结论

- merge 的祖先集合 = HEAD 的 517 笔 + 对侧 5 笔 + merge 自身；不存在第三个来源。
- 对象级实测：`merge ^HEAD ^theirs` 只剩 **56 个**（merge commit + union 产物树/blob）；相对 HEAD 独有 293（= 对侧 5 个提交及其 blob），相对 theirs 独有 4347（= 本侧 517 笔及其 blob）。
- 对侧 5 个提交的对象已在远端，重复推送时不会产生额外传输；它们以**同一 sha** 成为本地 main 的祖先，因此不会在历史里出现第二份。
- 结论：**推送不会被迫带上 517 笔之外的意外内容**；唯一的「新」对象是合并所需的 union blob，属预期产物。

## 12. 索引归属普查（2026-11-07 只读实测）

> 测量时刻 HEAD 已被外部会话推进到 `4d36cc8f7a`（merge，parents `2a752788b4` + `47a298fc78`）。以下所有数字按该时刻计。
> 与上一节（HEAD=`2a752788b4` 时 688/1829）的差异是**外部推进造成的**，不是本线改动。

### 12.0 决定性发现：索引 == `1291b6989a` 的树

| 检验 | 结果 |
|---|---|
| 索引条目总数 | 19,146 |
| `1291b6989a` 树条目总数 | 19,141 |
| 索引中 blob 与 `1291b6989a` **完全相同**的条目 | 19,126 |
| 索引中 blob 与 `1291b6989a` **不同**的条目 | **20**（15 改 + 5 新增） |
| 1846 条 `M ` 里，索引 blob == `1291` blob | **1841** |
| 1846 条 `M ` 里，索引 blob == HEAD blob | **0** |
| 787 条 `D ` 里，路径存在于 HEAD 树 | **787（全部）** |
| 787 条 `D ` 里，路径存在于 `1291` 树 | **0** |

⇒ **索引与工作树都停在 `1291b6989a` 那一代；HEAD 已经往前走了（含 union 合并）。**
所以 787 条「暂存删除」不是有人删文件，而是**合并新增的文件在旧索引里不存在**；1841 条「暂存修改」不是有人改文件，而是**索引里还是旧版本**。

`1291b6989a` 仍可达（`refs/heads/main` 的祖先、`refs/backup/main-pre-converge-12037d4f7a`、`refs/curation/merge-main-20261107` 均包含）。

### 12.1 表一：787 条暂存删除（`D `）

按顶层目录聚类：

| 簇 | 条数 | 盘上存在 | 已登记 | 未登记 |
|---|---|---|---|---|
| `scripts/*` | 201 | 0 | 2 | 199 |
| `apps/cli/*` | 133 | 0 | 0 | 133 |
| `packages/shared/*` | 82 | 0 | 0 | 82 |
| `apps/miniapp-taro/*` | 69 | 0 | 10 | 59 |
| `apps/ai-service/*` | 62 | 0 | 0 | 62 |
| `apps/mobile-rn/*` | 48 | 0 | 0 | 48 |
| `packages/app/*` | 40 | 0 | 0 | 40 |
| `apps/api/*` | 36 | 0 | 0 | 36 |
| `apps/web/*` | 33 | **1** | 0 | 33 |
| `docs/*` | 29 | 0 | 0 | 29 |
| `packages/api-client/*` | 18 | 0 | 0 | 18 |
| `packages/database/*` | 12 | 0 | 0 | 12 |
| `packages/types/*` | 10 | 0 | 0 | 10 |
| `.ihui-agent/*` | 3 | 0 | 0 | 3 |
| `.github/*` | 2 | 0 | 1 | 1 |
| `packages/sdk/*` | 2 | 0 | 0 | 2 |
| `packages/i18n/*` | 2 | 0 | 0 | 2 |
| `apps/desktop/*` | 2 | 0 | 0 | 2 |
| `monitoring/*` | 1 | 0 | 1 | 0 |
| `apps/extension/*` | 1 | 0 | 0 | 1 |
| `deploy/*` | 1 | 0 | 0 | 1 |
| **合计** | **787** | **1** | **14** | **773** |

按扩展名：`.ts` 348 / `.mjs` 183 / `.tsx` 121 / `.py` 63 / `.md` 33 / `.json` 13 / `.jsonl` 8 / `.sql` 6 / `.cjs` 2 / `.yml` 2。

**三个决定性的数**：

| 类别 | 条数 | 说明 |
|---|---|---|
| ① 登记过的有意删除（且盘上确实没有） | **14** | 全部 `until` 为空（未设过期）；理由均为「HEAD 删除历史重建：该路径在 2026-11-01 起的提交历史中被删除，且当前 HEAD 树无此文件」 |
| ② 盘上还在、却被标删除 | **1** | `apps/web/e2e/screenshots/desktop-window-controls-dim/05-close-ask-no-dim.png` |
| ③ 盘上也没有、也没登记 | **772** | 占 98.1% |

14 条已登记明细：`.github/workflows/assistant-release-upload.yml`；`apps/miniapp-taro/src/components/{Avatar.tsx,CountdownTimer.tsx,LevelBadge.tsx,LoadingSpinner.tsx,SkeletonCard.tsx,TagInput.tsx,TitleSwitchTypeBar.css,Toast.tsx,Tooltip.tsx,VipUpgradeToast.tsx}`；`monitoring/grafana/grafana.ini`；`scripts/check-grafana-metric-exists.mjs`；`scripts/data/grafana-external-metrics.json`。

**关键：这 787 条的内容全部在 HEAD 里**（`cat-file -e HEAD:<path>` 全部 rc=0）。包括 `scripts/check-miniapp-shell-form.mjs`、`scripts/lib/miniapp-shell-form.mjs`、`scripts/lib/gate-face.mjs` —— **HEAD 有、盘上没有**。
⇒ 这直接意味着**当前盘上的门链跑不了 299**（脚本文件不存在），不是「门慢」问题。

### 12.2 表二：1846 条暂存修改（`M `）

顶层聚类（前 12）：

| 簇 | 条数 |
|---|---|
| `apps/web/*` | 324 |
| `scripts/*` | 259 |
| `apps/miniapp-taro/*` | 244 |
| `apps/mobile-rn/*` | 217 |
| `packages/app/*` | 185 |
| `apps/ai-service/*` | 152 |
| `apps/cli/*` | 112 |
| `apps/api/*` | 101 |
| `packages/shared/*` | 39 |
| `.github/*` | 36 |
| `packages/i18n/*` | 33 |
| `packages/api-client/*` | 29 |

其中含门注册 / 门脚本 / 预算表 / allowlist 的路径：

| 类别 | 条数 |
|---|---|
| `scripts/guardian-runner.mjs`・`git-guardian.mjs`・`git-push-guard.mjs`・`union-converge.mjs`・`git-sync-converge.mjs`・`heal-*.mjs` | **5** |
| `scripts/data/*.json|jsonl`（含 `land-gate-budgets.json`） | **23** |
| `*allowlist*.json`（含 `staged-deletions-allowlist.json`） | **5** |
| `.husky/*`（`commit-msg`、`pre-push`） | **2** |
| `.github/workflows/*` | **34** |
| `scripts/lib/(gate|guardian)-*.mjs` | **3** |
| `scripts/check-*.mjs` | **51** |
| 合计去重 | **121** |

**「整段注册被删」同形态候选**（判据：暂存版相对 HEAD 删除 ≥20 行，且暂存行数 ≤ HEAD 行数的 70%）：

| 路径 | HEAD 行 | 暂存行 | 磁盘行 | +/− |
|---|---|---|---|---|
| `scripts/data/cross-end-allowed-diffs.json` | 1870 | 917 | 917 | +44/−997 |
| `scripts/check-web-rn-copy-parity.mjs` | 1533 | 657 | 657 | +30/−906 |
| `scripts/check-sidebar-width-consistency.mjs` | 711 | 175 | 175 | +92/−628 |
| `scripts/check-cross-end-component-props-parity.mjs` | 809 | 350 | 350 | +70/−529 |
| `scripts/data/miniapp-interaction-allowlist.json` | 420 | **5** | 5 | +2/−417 |
| `scripts/check-push-sync.mjs` | 675 | 377 | 377 | +114/−412 |
| `scripts/check-retry-aliases.mjs` | 568 | 200 | 200 | +41/−409 |
| `scripts/check-miniapp-interaction-hygiene.mjs` | 927 | 629 | 629 | +51/−349 |
| `scripts/check-no-emoji-icons.mjs` | 965 | 644 | 644 | +23/−344 |
| `scripts/check-verify-tmp-files.mjs` | 489 | 236 | 236 | +50/−303 |
| `scripts/check-token-literal-debt.mjs` | 474 | 198 | 198 | +18/−294 |
| `scripts/data/component-props-equivalence.json` | 425 | 137 | 137 | +2/−290 |
| `.github/workflows/loop-daily-triage.yml` | 374 | 204 | 204 | +69/−239 |
| `scripts/check-sheet-flex-contract.mjs` | 420 | 292 | 292 | +0/−128 |
| `scripts/check-nav-dead-links.mjs` | 166 | 105 | 105 | +43/−104 |
| `.github/workflows/guardian-full.yml` | 184 | 116 | 116 | +4/−72 |
| `.github/workflows/mobile-download-leg.yml` | 73 | 48 | 48 | +0/−25 |

**但这 17 条没有一个是真的「有人删了整段」** —— 它们的索引 blob 全部等于 `1291b6989a` 的 blob（12.0 已批量证明 1841/1845）。真相是：**HEAD 里的版本是「后来补齐/扩写」的那一版，索引里是旧版**。方向与「被截断」正好相反。

**必须更正一条前提**：`scripts/guardian-runner.mjs` 的 `pushGateChecks` **当前没有被截成 5 门**。

| 来源 | `pushGateChecks` 里的门 id |
|---|---|
| HEAD | 13 门：`T1,193,47p,IG,299,300,301,302p,303p,304p,306p,307p,308p` |
| 索引 | 13 门：`T1,193,47p,IG,299,300,301,302p,303p,304p,306p,307p,308p` |
| 差异 | `only_head=`（空）／`only_index=`（空） |

两侧 id 集合完全一致，段长 73,895 vs 73,127 字符（差 768 字符，是 label 文案与 `stagedTriggers` 条目数差异，例如 217 门 HEAD 带 3 个触发前缀、索引只带 1 个）。所以「5 门」这一描述在**当前 HEAD 与当前索引上都不成立**；若确曾观察到，应来自别的 worktree 或更早时刻。

### 12.3 表三：与那笔 5 文件提交的相互作用

三份文件的当前状态：

| 文件 | porcelain | HEAD 行 | 索引行 | 磁盘行 | 索引 blob == `1291`？ | 性质 |
|---|---|---|---|---|---|---|
| `scripts/check-staged-resurrection.mjs` | `M ` | 125 | 144 | 144 | **否**（1291 无此文件） | **真·新内容**（+28/−9） |
| `scripts/lib/intentional-file-deletion.mjs` | 干净 | — | — | — | 否（1291 无此文件） | 已在 HEAD，索引==HEAD |
| `scripts/data/intentional-file-deletions.jsonl` | `M ` | 127 | 182 | 182 | **否**（1291 无此文件） | **真·新内容**（+169/−114） |
| `scripts/staged-deletions-allowlist.json` | `M ` | 135 | 127 | 127 | **是** | **陈旧**（索引是旧版，少 8 行声明） |
| `scripts/lib/hook-tool-path.js` | 干净 | — | — | — | 否 | 已在 HEAD |

`git commit --only <这 5 个路径>` 的推演（**未执行**）：

1. `--only` 用索引内容组提交 ⇒ 新提交里 `check-staged-resurrection.mjs` = 144 行、`intentional-file-deletions.jsonl` = 182 行 ⇒ 这两条状态转干净（索引==新HEAD）。
2. `staged-deletions-allowlist.json` 会以 **127 行**入库，而当前 HEAD 是 **135 行** ⇒ **净删 8 行已声明的删除条目**。这是这笔提交唯一的真实破坏面，且 pre-commit 的复活闸读的正是这份 allowlist，删条目会放宽判据。
3. 其余 1841 条陈旧 `M ` 与 787 条 `D ` 保持原样 —— 提交完 `status` 仍然是 2628 条脏，**问题不会缩小**。
4. 索引仍停在 `1291` 代，下一次任何人 `git commit` 仍会把整棵旧树提交上去。

⇒ 结论：`--only` 这条路**既不清索引，又顺手砍 allowlist**。不应走。

### 12.4 结论：A 还是 B

**都不是。原来的 A/B 二分建立在「索引里是别人的改动」这个错误前提上。**

- 真实形态是「索引 + 工作树 = 旧树，HEAD = 新树」。所以不存在「归还会话」——没有会话在等这些改动，它们只是旧版本。
- `restore --staged .`（B）本身**不造成不可逆内容丢失**：787 条删除的内容全在 HEAD，重置索引后它们变成未暂存删除（` D`），可用 `git restore --worktree --source=HEAD -- <path>` 逐条找回。
  **但 B 也不解决问题**：工作树仍缺 787 个文件（含门 299 的脚本），1841 个文件仍是旧内容，下一枚提交照样提交旧树。
- 唯一有风险的动作是**把工作树和索引一起同步到 HEAD**（`git restore --source=HEAD --staged --worktree .` / `git checkout -- .`）。它会丢掉**20 个 blob**，这 20 个既不在 HEAD、也不在 `1291`：

| 类别 | 文件 |
|---|---|
| 新增（`1291` 里没有，HEAD 也没有） | `scripts/check-staged-resurrection.mjs`、`scripts/data/intentional-file-deletions.jsonl` |
| 修改（HEAD/`1291` 都没有该版本） | `README.md`、`README.en.md`、`README.ja.md`、`README.ko.md`、`PROJECT_PLAN.md`、`apps/api/src/plugins/internal-secret-auth.ts`、`apps/api/src/routes/internal-relay-user-pool.ts`、`apps/api/src/routes/knowledge-card.ts`、`apps/api/src/services/ai-feed-service.ts`、`apps/api/src/services/__tests__/relay-account-pool-reconcile.test.ts`、`apps/api/tests/internal-call-headers.test.ts`、`apps/api/tests/skills-market-create-author-impersonation.test.ts`、`apps/miniapp-taro/tests/voice-input-single-complete-channel.test.ts`、`scripts/data/sse-dispatch-coverage.json`、`scripts/guardian-runner.mjs` |

> **更正（2026-11-07 15:00，§12.4 表的口径缺陷）**
> 上表的「20 个」只记录了**总数与桶数**（2 新增 + 18 修改），**没有逐条存清单**。后果：14:38→14:42 之间 4 个 orphan 被 converge 覆盖后，只有 `scripts/guardian-runner.mjs` 能靠本表反推指认，其余 3 个**无法还原、已永久丢失**。
> 这是**流程缺陷，不是记录疏漏** —— 存证动作应当「先落全清单（path + blob + size），再挂 ref」，而不是先挂 ref 后补清单。
> **自 2026-11-07 15:00 起改为**：每次 `write-tree` 之后，先输出完整 orphan 清单到 `.ihui-agent/tmp/index-orphans-<时间>.txt`，再 `commit-tree` + `update-ref`；两件事同一条命令内完成。

**推荐路径（A′，先存证再同步）**：

```powershell
$repo='D:\IHUI-AI'
# 1) 把索引整包存证(20 个 blob 的唯一副本就在这里)
git -C $repo diff --cached | Set-Content -Encoding utf8 "$repo\.ihui-agent\tmp\index-snapshot-20261107.patch"
# 2) 单独导出 20 个 blob 到对象库兜底,并挂 ref
git -C $repo write-tree                                  # 得到索引树 T
git -C $repo commit-tree <T> -p 1291b6989a -m 'snapshot: 索引/工作树的 1291 代状态(同步前存证)'  # 得到 C
git -C $repo update-ref refs/curation/index-snapshot-20261107 <C>
# 3) 确认 20 个文件在 C 里可读
git -C $repo cat-file -p <C>:scripts/guardian-runner.mjs | Select-Object -First 3
# 4) 再把索引+工作树同步到 HEAD(此时无不可逆丢失)
git -C $repo restore --source=HEAD --staged --worktree .
git -C $repo status --porcelain | Measure-Object -Line   # 期望 0
```

**B 会不可逆丢掉哪一类**（直接回答）：
严格说 **B 单独执行不丢任何内容**——787 条 `D ` 的文件正文都在 HEAD 里，重置索引只是把「暂存删除」降级成「未暂存删除」。
真正不可逆的是**紧接着的那次工作树同步**：会覆盖 20 个只存在于索引的 blob，其中 2 个是全新文件、18 个是索引独有版本。**没有第 1 步的 `index-snapshot` 或第 2 步的 `refs/curation/index-snapshot-*`，这 20 个 blob 将无法找回。**

### 12.5 普查期间索引变化

| 桶 | 上一轮 | 本轮 |
|---|---|---|
| HEAD | `2a752788b4` | **`4d36cc8f7a`** |
| 总数 | 2814 | **2930** |
| ` M` | 217 | 217 |
| `M ` | 1829 | **1846** |
| `D ` | 688 | **787** |
| `MM` | 38 | 38 |
| `??` | 19 | 19 |

变化量：`M ` +17、`D ` +99、总数 +116，全部由外部会话把 HEAD 从 `2a752788b4` 推进到 `4d36cc8f7a`（又合入 1 轮 origin/main）引起。不追溯归属。

## 13. 锚点重算（14:42，`merge-main-latest` 未挂出）

### 13.1 读数

| 项 | 值 |
|---|---|
| HEAD | `4d36cc8f7a` |
| origin/main | `a462642509`（14:27:30，round4） |
| merge-base | `47a298fc78`（14:22:26） |
| `merge-tree --write-tree` rc | **1（有冲突）** |
| 输出树 | `f8dfb0e75e33dfc40d4b32bed9360bb9d29169df` |
| 冲突文件数 | **3** |

### 13.2 冲突清单（原样，未尝试解决）

```
CONFLICT (content): Merge conflict in PROJECT_PLAN.md
CONFLICT (content): Merge conflict in README.en.md
CONFLICT (content): Merge conflict in README.md
```

冲突阶段条目（stage 1=base / 2=ours / 3=theirs）：

| path | stage1 (base) | stage2 (ours) | stage3 (theirs) |
|---|---|---|---|
| `PROJECT_PLAN.md` | `dacab446a9` | `bdafc49a5f` | `e280f23437` |
| `README.en.md` | `85e80bf900` | `74a49019bb` | `4c9d32c842` |
| `README.md` | `9a11f854f8` | `4ccea659c5` | `a5cfb0aaba` |

自动合并成功（无需人工）：`packages/i18n/messages/web/{en,ja,ko,zh-CN,zh-TW}.json`（上一轮算出的 6 个交叠文件里，5 个 JSON 仍自动通过，`chat.ts` 未出现在本轮报文中）。

**未挂 `refs/curation/merge-main-latest`**：rc=1 的输出树含未解冲突阶段，不能当作落地锚点。等冲突解算后再挂。

### 13.3 关键发现：`D:\DevEnv\Temp\resolve\*` 的预制件已过期，不能当解算器

`union-converge` 当前那轮用的正是 `--union-capped PROJECT_PLAN.md / README.md / README.en.md = D:/DevEnv/Temp/resolve/...`。但这批预制件生成于 **13:38:41–13:38:46**，当时的两侧内容与现在不同。逐行核验（以 `47a298fc78` 为 base）：

| 文件 | base | ours(HEAD) | theirs(origin/main) | 预制件 | 本侧独有 | 未入预制件 | 对侧独有 | 未入预制件 |
|---|---|---|---|---|---|---|---|---|
| `PROJECT_PLAN.md` | 31,775 | 31,900 | 31,784 | 31,914 | 130 | **6** | 9 | **7** |
| `README.md` | 42,782 | 42,538 | 42,782 | 42,641 | 92 | **2** | 17 | **17** |
| `README.en.md` | 506 | 577 | 506 | 584 | 44 | 0 | 8 | **8** |

⇒ 若直接拿这批预制件落地，会丢掉对侧 7 / 17 / 8 行。**预制件必须按当前 `origin/main` 重新生成**，不能用 13:38 那批。

## 14. 挂起 push 的读数（pid 16488 / 14576，只读）

### 14.1 它跑到第几门

**一门都没开始。** 依据：

| 证据 | 值 |
|---|---|
| `pre-push-gate.log` 最后写入 | **12:45:08**（上一次 4 门批次的结论：47p + IG 两道 blocking 失败、总耗时 596.4s） |
| `gates-progress.log` 最后写入 | 14:27:04 |
| 进程 `guardian-runner --push-gate` 启动 | 14:31:35，CPU 仅 0.42s，存活至 14:42 仍无输出 |
| `index.lock` | 不存在 |

⇒ 它在**取锁 / 第一门前**就停住了，CPU 几乎为零。同时有 `pnpm -r run typecheck`（pid 31232，14:33:31）在跑，符合「等 typecheck 锁」的形态，但**日志未落任何 `wait-lock` 标记**，所以按既有判据只能记为「未判定」，不能记 `BLOCKED_BY_CONCURRENCY`。

### 14.2 若它落地，`origin/main` 会变成什么

**结论：它落不了地（非快进），除非带 force。**

| 检验 | 值 |
|---|---|
| `merge-base --is-ancestor HEAD origin/main` | **false** |
| `HEAD..origin/main` | **18**（对侧独有） |
| `origin/main..HEAD` | **518**（本侧独有） |
| 推送载荷（若强推） | **518 提交 / 4,354 对象** |
| 目标 sha（若强推） | `4d36cc8f7a`（push 完成时 main 的指向，可能又被 converge 推进） |

⚠️ 注意：`HEAD` **不是** `origin/main` 的祖先，且 `origin/main` 也不是 `HEAD` 的祖先 —— 两者已分叉 536 个提交。普通 `git push origin main` 会被服务端 rejected；**推送载荷里的 4,354 个对象刚好等于「518 笔本地提交 + 其 blob/tree」**，不含对侧 18 笔（那些已在远端）。

## 15. 预制件重生成（14:47，已落盘）

### 15.1 `union-converge` 怎么读 `D:\DevEnv\Temp\resolve`

**它根本不读目录。** 源码实证：

| 问题 | 答案 | 依据 |
|---|---|---|
| 会不会扫描目录？ | **不会** | `union-converge.mjs` 里 `DevEnv` 只出现在注释（L72），无任何目录常量或 `readdir` |
| 有没有清单/索引文件？ | **没有** | 同目录只有 `fold_keep_decl.json`，是 `--declare-side-loss` 的声明档，不是清单 |
| 是否按原名自动匹配？ | **不匹配** | 入口是 `--union-capped '<仓库相对路径>=<绝对文件>'`（L85–97），一对一显式配对 |
| `git-sync-converge` 做什么？ | 只做**原样转发** | 白名单 L718–723 只认旗名，不解析路径 |

⇒ `D:\DevEnv\Temp\resolve` 只是调用方约定的产物目录；文件名与仓库相对路径同名是**惯例**，不是读取逻辑。所以重生成只需覆盖同名文件，不需要动任何清单。

### 15.2 生成方法

- 三方：base `47a298fc78` / ours `HEAD`（`4d36cc8f7a`）/ theirs `origin/main`（`a462642509`）
- 先备份旧件到 `.ihui-agent/tmp/resolve-stale-20261107/`（3 份，已确认）
- 并集：`git merge-file --union`（语义即「两侧新增都保留，只有两侧都删才删」；同一位置两侧都有新增时**本侧在前、对侧在后**，与 `union-converge` 的 `--union-capped` 约定一致）
- 封顶：按 G-585 把每行重数收回 `max(本侧, 对侧)`，实际封顶 8 / 16 / 4 行

### 15.3 验收（行级多重集，全部为 0）

| 文件 | base | ours | theirs | 结果 | 本侧独有行 | 未入结果 | 对侧独有行 | 未入结果 | 双方都删 | 结果中复活 | 超封顶 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `PROJECT_PLAN.md` | 31,776 | 31,901 | 31,785 | **31,908** | 131 | **0** | 9 | **0** | 0 | **0** | **0** |
| `README.md` | 42,783 | 42,539 | 42,783 | **42,556** | 138 | **0** | 17 | **0** | 0 | **0** | **0** |
| `README.en.md` | 507 | 578 | 507 | **581** | 71 | **0** | 8 | **0** | 0 | **0** | **0** |

验收口径（多重集）：
- `added_side(l) = max(0, count_side(l) − count_base(l))`；要求 `count_result(l) ≥ added_side(l)`，违者为 0；
- 「双方都删」= `base>0 且 ours=0 且 theirs=0`，要求 `count_result(l)=0`；
- 封顶：要求 `count_result(l) ≤ max(count_ours(l), count_theirs(l))`。

### 15.4 落盘

| 文件 | 字节 | mtime |
|---|---|---|
| `PROJECT_PLAN.md` | 8,296,439 | 14:47:44 |
| `README.md` | 12,782,688 | 14:47:45 |
| `README.en.md` | 56,806 | 14:47:46 |

旧件备份：`.ihui-agent/tmp/resolve-stale-20261107/`（3 份，8,293,339 / 12,796,291 / 57,030 字节）。

## 16. 丢失的 4 个 orphan

### 16.1 能指认的 1 个

`scripts/guardian-runner.mjs`
依据：§12.4 那张表是 14:38 测到 20 个之后写的，表内 17 条路径**除它之外全部**仍在当前 16 个里。可复核：该路径现在 `:path` == `HEAD:path` == `ab0585a1f9`，而 `1291b6989a:path` == `a61dd98822` ⇒ 索引 blob 已被换成 HEAD 版，14:38 那一版不在索引里了。

### 16.2 无法指认的 3 个

**我没有保存 14:38 的 20 条清单。** 当时只记了总数 20 与桶数「2 新增 + 18 修改」，§12.4 只逐条点了 2 个新增、15 个修改。剩下 3 个（属于未点名的「新增」桶）**无法逐条还原**，按用户要求明说：**无法还原，已永久丢失**。

保留一线可能：这 3 个 blob 若仍是 dangling 对象，在被 `git gc --prune` 之前理论上还能捞回，但**没有清单就无法证明哪个 blob 对应哪条路径**，因此不构成可恢复。`git fsck --no-reflogs --unreachable` 在本仓 10 分钟内未返回，未能给出兜底证据。

### 16.3 可核查的一句话

> 14:38→14:42 之间，正在跑的 `union-converge --apply` 重写了 `D:\IHUI-AI-git-repo\index`（mtime 14:34:44），把 4 个路径的索引 blob 从「既非 HEAD 也非 `1291b6989a`」改成 HEAD 版或 `1291` 版；其中 `scripts/guardian-runner.mjs` 可直接验证：现在索引 blob = HEAD blob = `ab0585a1f9`，而 `1291b6989a` 是 `a61dd98822`。

## 17. 判断：要不要先停 `union-converge`

**判断：应该停；但不是因为「会吃对侧 17 行并推上去」，而是因为「每轮空转都在销毁索引独有 blob」。**

### 17.1 为什么不是「吃行上远端」

`--union-capped` 的入口契约（源码 L85–97）明写：喂进来的整份内容**照样跑「两侧独有行重数不得减少」的断言，少哪一侧就当场 bad**。预制件过期 ⇒ 少对侧 7/17/8 行 ⇒ 当场 bad ⇒ **不落地、不提交、不推送**。
所以「静默吃掉对侧行并推到 `origin/main`」这条路被断言堵住了；最坏结果是**空转**，不是**污染**。

### 17.2 真正的最坏情况：索引销毁

每一轮 apply 都会重写索引。14:34:44 那一轮已经销毁 4 个索引独有 blob（20→16）；我们只抢救到 16 个，其中 2 个是全新文件。**再空转 3–4 轮，这 16 个也会没。** 而这些 blob 的唯一副本就在索引里（`HEAD` 与 `1291` 都没有），`refs/curation/index-orphans-20261107` 现在是它们唯一的存证。

### 17.3 事后能不能查出来

能，但**只能靠本地**：

| 手段 | 能查出什么 |
|---|---|
| `git log --all -- PROJECT_PLAN.md` | 定位每枚 merge 提交 |
| `node scripts/check-merge-addition-loss.mjs`（`auditOne`） | 逐枚 merge 的两侧新增行是否齐全 |
| 自行对 `merge^1` / `merge^2` 做行级多重集比对 | 丢了多少行、丢的是哪一侧 |
| `refs/backup/*`（每轮快照） | 回看该轮之前的树 |

⚠️ **远端查不出来**：`origin/main` 上只有合并后的结果，没有两侧父提交的行级内容。一旦本地 `refs/curation/*` / `refs/backup/*` 丢失，**无法从远端重建「是否丢行」的判断**。

### 17.4 结论与不 kill 的处置

- 应该停。理由是 17.2：不停就会继续销毁唯一副本，且 22 分钟一次 merge 意味着预制件永远在过期。
- 但**不需要为了防丢行而停**（17.1 已堵住）。
- 在不停的前提下，可做的两件事本线已完成：①16 个 orphan 已挂 `refs/curation/index-orphans-20261107`；②三份预制件已按当前两侧重生成并落盘 —— **下一轮 apply 读到的就是新版**，空转的成因被消掉一半。
- 仍建议有人去看一眼：预制件每 22 分钟就会再次过期，若连续多轮仍判 bad，说明分歧不只是这三份文档。

## 18. 兜底口径：怀疑某轮丢行时怎么查（可复核三步）

前提：某轮 converge 已把内容推到 `origin/main`，事后怀疑「对侧/本侧独有行被吃掉」。

### 第 1 步：定位该轮 merge 提交与它的两个父

```powershell
$repo='D:\IHUI-AI'
# 该文件历史上所有改动（merge 提交会在其中）
git -C $repo log --all --format='%h %ci %p %s' -- PROJECT_PLAN.md
# 取某枚提交的两个父（merge 必然两个 parent，顺序 = first-parent, 对侧）
git -C $repo rev-parse <merge>^1 <merge>^2
# 共同祖先
git -C $repo merge-base <merge>^1 <merge>^2
```

### 第 2 步：跑判据（二选一）

```powershell
# 2a 用现成判据（推荐，与 union-converge 同一套）
node $repo\scripts\check-merge-addition-loss.mjs --commit <merge>
# 2b 自做行级多重集比对（判据与 §15.3 完全一致）
#   对每个 path：base=<mb>:path, ours=<merge>^1:path, theirs=<merge>^2:path, result=<merge>:path
#   断言:
#     added_side(l) = max(0, count_side(l) - count_base(l))
#     count_result(l) >= added_side(l)        两侧都要满足，违者即丢行
#     base>0 且 ours=0 且 theirs=0  =>  count_result(l) == 0
#     count_result(l) <= max(count_ours(l), count_theirs(l))   （G-585 封顶）
```

判据成立即「该轮没丢行」，且这一结论**可被任何人用同一命令复现**。

### 第 3 步：用 `refs/backup/*` 回看该轮之前的树

```powershell
git -C $repo for-each-ref --sort=-committerdate --format='%(refname) %(objectname:short) %(committerdate:iso8601)' refs/backup
# 与该轮之前任一快照逐文件比对
git -C $repo diff refs/backup/<快照> <merge> -- PROJECT_PLAN.md
```

### ⚠️ 限制：远端查不出来

**`origin/main` 上只有「合并后的结果」，没有两侧父提交的行级内容。**
因此：

- `git log origin/main -- PROJECT_PLAN.md` 只能告诉你「某一轮合了」这个事实；
- 想看「合的时候有没有丢行」，必须能拿到 `merge^1` / `merge^2` 的内容；
- 这两个父提交若只在本地（未推送），**一旦本地 `refs/curation/*`、`refs/backup/*` 对象被 gc，就再也拿不出判据**，远端也无法重建。

⇒ 所以 `refs/curation/*` 与 `refs/backup/*` 是这套口径的唯一依托，不得当成临时垃圾清理。

## 19. 轮次观察记录

### 19.1 第 1 轮（pid 39920，14:36:32 → 15:00 前退出）

| 观测项 | 值 |
|---|---|
| 进程状态 | 15:00:03 查：**DEAD**（同批 14432/16488/14576 亦全部退出） |
| 是否提交 | **否** —— HEAD 仍 `4d36cc8f7a`（14:28:38），无新 merge 提交 |
| rc | **无法取得**（进程由外部会话启动，stdout 未落盘，本机无该轮日志） |
| `bad` 报错原文 | **无法贴出**，原因同上；仅能判定「未提交」 |
| 索引树 | `5d35dea688`，与 14:42:33 快照**完全相同** |
| orphan 变动 | **新增 0 / 消失 0** |
| 同期 `origin/main` | `a462642509` → **`a9897341d1`**（14:49:17，普通提交，parent `7978ca2773`，**非本仓 converge 产出**） |
| 分叉 | `HEAD..origin/main = 22`，`origin/main..HEAD = 518` |

**14:31 那枚挂起的 push 的结论**：`git-push-guard-async.log` 有 `🔍 执行 git push origin main ...` 但**没有任何成功行**，且 `push-state.json` 仍停在 `status=running / headSha=4d36cc8f7a / pid 36896`（该 pid 已死，属残留状态）。⇒ **push 未落地**；`origin/main` 现指向的 `a9897341d1` 不是它推的。

## 20. 解剖 `a9897341d1`（15:0x 只读）

### 20.1 四样事实

| 项 | 值 |
|---|---|
| sha | `a9897341d14c25512972eb727494c76732ce6c36` |
| parent | **`7978ca2773c3f84290af6e198f81f73b6c409c2f`（仅 1 个，单亲，不是 merge commit）** |
| 时间 | 2026-11-07 14:49:17 +0800 |
| 提交信息 | `fix(plan): HEAD面回捞件兜底清扫——摘除台账已声明删除却仍在HEAD面的登记行(普通git merge带旧台账侧绕开union判据,实测枚7864cde002 父1=40/父2=338/结果=342;判据lib/head-recall单源,留痕form:dropped)` |
| `--stat` | `PROJECT_PLAN.md \| 9 ---------`；**1 file changed, 9 deletions(-)** |
| diff 行数 | **+0 / −9**（`git diff --numstat 7978ca2773 a9897341d1`） |
| hunk | 3 段：`@@ -31446,16 +31446,10 @@`（−6）、`@@ -31663,7 +31657,6 @@`（−1）、`@@ -31779,6 +31772,4 @@`（−2） |
| 删掉的编号 | `Y-25` `Y-26` `Y-27` `Y-24` `RP-74` `RP-37` `S-26` `RP-79`（扩写版） `D05` —— 共 9 行 |
| blob | `e280f23437` → `dacab446a9` |

**关键恒等式（已实测）**：`a9897341d1:PROJECT_PLAN.md` 与 `47a298fc78:PROJECT_PLAN.md` **同一 blob `dacab446a9`（8,236,394 B，逐字节相同）**。
又：`47a298fc78..7978ca2773` 对 `PROJECT_PLAN.md` 是 **+9 / −0**，而 `7978ca2773..a9897341d1` 是 **+0 / −9**。
⇒ 这 9 行删得**极精确**：删的就是对侧（`7978ca2773`）相对 merge-base 新增的那 9 行，删完整个文件退回 merge-base 版本。
⇒ 机制上它等价于 `git checkout 47a298fc78 -- PROJECT_PLAN.md`，不是一次合并。

### 20.2 "绕开 union 判据"绕开了什么

`git diff --name-only 7978ca2773 a9897341d1` 输出**只有 `PROJECT_PLAN.md` 一行**。
⇒ **没有**改 `scripts/union-converge.mjs`、**没有**改 `scripts/git-sync-converge.mjs`、**没有**改任何判据断言代码。

所以"绕开"是**行为面**的，不是**代码面**的：判据没被削弱，只是**这一次根本没被调用**——用一个普通 `commit` 直接产出判据本该拦下的结果。

提交信息里引用的 `7864cde002` 不是本次的两侧来源，是一个**历史 merge 提交**（2026-10-30，parent1 `edba15a8c2` / parent2 `4d0d50774b`，比 `7978ca2773` 落后 4,097 个提交），被当作"实测先例"引用。顺带按同一套 §15.3 口径验了它：**0 / 0 / 0，但 `overCap=5`** —— 那枚先例本身也不合 G-585 封顶（多了 5 行重复），所以它作为"判据可被替代"的证据同样不成立。

### 20.3 三个数（§15.3 口径）

口径：`ours=HEAD(4d36cc8f7a)`、`theirs=7978ca2773`（本次提交真正删除的那一侧）、`base=47a298fc78`（`merge-base HEAD a9897341d1`，也恰好是结果所退回的版本）、`result=a9897341d1`。

| 判据 | 值 |
|---|---|
| **本侧（HEAD）独有未入** | **130** 行（HEAD 31,901 行；base 31,776 行；HEAD 相对 base 的 +130 行副本在结果里**全部缺席**） |
| **对侧（7978ca2773）独有未入** | **9** 行（= 对侧相对 base 的全部新增，**100% 被删**） |
| **双方都删被复活** | **0** |
| 超封顶 `overCap` | **0**（结果 = base，天然不超 `max(ours,theirs)`） |

### 20.4 定性

**判据被绕过**（不是合规替代路径）。

理由三条，都可复核：
1. 结果文件与 merge-base **逐字节相同** ⇒ 这不是"合并后清扫"，是**整文件回退**；
2. 被删的 9 行 = 对侧相对 base 的**全部**新增（9/9），§15.3 的"对侧独有未入"因此等于 9，而合规并集要求它为 0；
3. 提交信息**自称**「绕开union判据」——这是作者自认，不是我的推断。

补充一条可核验性缺口：提交信息称「判据 lib/head-recall 单源，留痕 form:dropped」，但**提交对象里没有任何 dropped 清单或凭据**，只有 9 行删除。被删的 9 个编号里，`Y-25` 在 `7978ca2773` 出现 1 次、在 **`HEAD` 也出现 1 次**（`S-26`/`RP-79` 同型）⇒ 至少这些编号在本地侧仍被当作**在册条目**保留，所谓"台账已声明删除"无法从对象面证实。

**风险落点**：判据本身没坏，所以未来 merge 仍会拦；但这次"清扫"把对侧 9 行**从远端正典里抹掉了**——如果那 9 行里有对侧独有的在飞信息，它现在只剩在本机 `refs/curation/*` 或 reflog 里（`7978ca2773` 仍在远端历史中，可从 `a9897341d1^` 取回，**未永久丢失**）。

## 21. 锚点重算（15:0x，HEAD `4d36cc8f7a` × `origin/main a9897341d1`）

| 项 | 值 |
|---|---|
| 命令 | `git merge-tree --write-tree --name-only HEAD a9897341d1` |
| **rc** | **1** |
| 冲突清单 | **`README.en.md`、`README.md`**（2 个，均为 content 冲突） |
| 输出树 | `91ca802a2b8df55a719e4f148ee55855d0f4b7e3` |
| 结果 vs HEAD | **73 文件，+5,206 / −113** |
| `PROJECT_PLAN.md` | 合并树里 = `bdafc49a5f`，**与 HEAD 相同**（对侧已把它退回 base，我方 130 行原样保留） |
| 自动合并通过（无冲突） | `apps/ai-service/app/routers/llm.py`、`apps/web/src/hooks/use-chat/send-answer.ts`、`send-message.ts`、`apps/web/src/stores/chat.ts`、`packages/i18n/messages/web/{en,ja,ko,zh-CN,zh-TW}.json`、`packages/shared/src/utils/sse-parse.ts` |
| **`refs/curation/merge-main-latest`** | **未挂**（rc≠0，按纪律不挂） |

> 与 14:42 那轮相比：冲突从 3 个（含 `PROJECT_PLAN.md`）降到 2 个 —— 因为对侧把 `PROJECT_PLAN.md` 退回了 base，冲突面消失，但**代价是那 9 行信息只在 `a9897341d1^` 里**。
> 结论：**锚点仍不成立**，落地继续卡在 `README.md` / `README.en.md` 两处。这两处是 13:38 那批预制件的同类问题（活文档行级 union），不是新问题。

## 22. 锚点已造出：`f61693ba57`（15:2x，真 merge commit）

**做法**：临时 worktree `D:\DevEnv\Temp\wt-merge-assemble`（游离 HEAD `d054ea7b7a`）→ `git merge --no-commit --no-ff a9897341d1` → 两处 README 用并集件覆盖 → `git add` → `git write-tree` → `git commit-tree`（plumbing，不跑 commit 钩子）→ `update-ref` → 删 worktree + prune。主工作区**未 checkout**，主索引树仍 `5d35dea688`。

| 项 | 值 |
|---|---|
| merge sha | **`f61693ba571fa10a1e2448192fe95579281045b1`** |
| parent 1 | `d054ea7b7a3b094a0de668595c700e7de9abc5d5`（本地 main） |
| parent 2 | `a9897341d14c25512972eb727494c76732ce6c36`（origin/main） |
| tree | `6fd1e7e5b428dd76322e6af8c79fd75cb3280671` |
| `diff --stat d054ea7b7a..merge` | **73 files changed, 5,159 insertions(+), 128 deletions(-)** |
| `diff --stat a9897341d1..merge` | **820 files changed, 76,110 insertions(+), 7,659 deletions(-)** |
| 合并过程 | merge rc=1，`UU` 恰 2 个（`README.md`/`README.en.md`）；解后 73 条（59 `M ` + 14 `A `），**无** ` M`、无 `??`、无其它未解决冲突 |
| `PROJECT_PLAN.md` | 取本侧 `bdafc49a5f`（与 `d054ea7b7a` 同 blob），不在 73 条 payload 内 |
| `git fsck --connectivity-only` | **rc=0**，无 `error`/`missing`/`broken`（仅有仓内既有 dangling 13,164 条） |
| ref | `refs/curation/merge-main-latest` → `f61693ba57`（**后由 §23 前移到 `ed9bd9b48d`**） |

**两份 README 三项判据（对已提交 blob 复核，非只对盘上文件）**

| 文件 | ours / theirs / base / result（行） | 本侧独有未入 | 对侧独有未入 | 双方都删被复活 | overCap |
|---|---|---|---|---|---|
| `README.md` | 42,539 / 42,783 / 42,783 / 42,556 | **0** | **0** | **0** | 0 |
| `README.en.md` | 578 / 507 / 507 / 581 | **0** | **0** | **0** | 0 |

**那 9 行被回退内容的结局（逐行核对，不是推断）**：`a9897341d1` 删的 9 行里，**6 行在本侧逐字节存在**（`Y-24`/`Y-25`/`Y-26`/`Y-27`/`RP-74`/`RP-37`）⇒ 合入后**文件内容自动恢复**；**3 行本侧没有同名整行**（`S-26` 长版、`RP-79` 扩写版、`D05` 长版）⇒ **不恢复**，只留在 `a9897341d1^`（`7978ca2773`）的历史里。

## 23. 3 行回填：`ed9bd9b48d`（merge 之上的普通提交）

| 项 | 值 |
|---|---|
| 新 sha | **`ed9bd9b48d141e4797a8c3571908d499e658c02b`** |
| parent | `f61693ba571fa10a1e2448192fe95579281045b1`（单亲，不改 merge 本身） |
| tree | `ccd36241d9409256a816bde82e99ba1dc9d16de4` |
| `PROJECT_PLAN.md` blob | `aede2a6a31471abd29f7cdda52dd0fb4ab84f405` |
| `diff --numstat f61693ba..ed9bd9b` | **`3 0 PROJECT_PLAN.md`**（1 file changed, 3 insertions） |
| 行数 | 31,901 → **31,904**（数组计含尾空行；= +3） |
| `diff --name-only a9897341d1..ed9bd9b` | **820 个文件**（仍 820，+76,113 / −7,659） |

**三行回填明细（逐字节 = `7978ca2773` 版）**

| 行 | 源行号（7978） | 新行号（ed9bd9b） | 字符 | 出现次数 |
|---|---|---|---|---|
| `S-26` 长版 | 31,666 | **31,780** | 931 | 1 |
| `RP-79` 扩写版 | 31,782 | **31,896** | 1,504 | 1 |
| `D05` 长版 | 31,783 | **31,897** | 651 | 1 |

定位方式：沿用 `7978ca2773` 的相邻上下文——`S-26` 插在「待核（本次未直接核验…）」与 `S-28` 之间；`RP-79`+`D05` 插在「第四轮排除面…」与 `RP-75` 之间（7978 里这两行紧随该段、`RP-75` 在其后）。回环校验：从新文件里删掉这三行，剩余内容与 `f61693ba57:PROJECT_PLAN.md` **逐字节相同**。

**推送预判（未执行）**：`a9897341d1` 是 `ed9bd9b` 的祖先（`merge-base --is-ancestor` rc=0）⇒ 对 `refs/heads/main` 是**快进**，不存在非快进拒绝；但 `a9897341d1..ed9bd9b` = **521 笔**（519 本地链 + 1 merge + 1 回填）会一次性出现在远端，first-parent 链从 `a9897341d1` 起向后接 **+521**（`a989 → f61693ba → d054ea7b7a → … → 47a298fc78`）。`a9897341d1` 本身**不会消失**：它是 merge 的第二父，仍在历史里可达，但**不在 first-parent 线上**（`log --first-parent` 不会再看到它）。

## 24. 锚点前移到 `0e2080efb8` + 307p 修复 `75754b8e`（15:4x）

**基准**：`origin/main` = `c22aa69118`（本地 `rev-parse` 与 `git ls-remote` **一致**，15:21:25）；`HEAD` = `d054ea7b7a`；`merge-base` 仍是 **`47a298fc78`**（14:22:26，未变）。

**307p 真红确认**：`git rev-list --count 47a298fc78..origin/main -- apps/ai-service/app/data/tool_name_sets.json` = **0** ⇒ 生成物整段没被重生成；`origin/main` 版 `tool_name_sets.json` 里 **grep 不到 `sandbox_session`**。`a41e6ff7f2`（12:09:15）确实只改了 `tool-category.ts` + 5 份 i18n。

| 项 | 值 |
|---|---|
| `merge-tree --write-tree d054ea7b7a c22aa69118` | **rc=1**，冲突 **仍只有 `README.en.md` / `README.md`**（第三处未出现） |
| 新锚点 | **`0e2080efb8d3d49cd0a6984d2c02a35bbbd5535c`** |
| 锚点两亲 | p1 `d054ea7b7a3b094a0de668595c700e7de9abc5d5` / p2 `c22aa69118708a0838e4c74b79e70db0b2646466` |
| 锚点 tree | `e4a60a24a7234e0ea3ffa8f027c0932ab48e9c76` |
| 锚点 vs HEAD | **76 文件，+5,320 / −147**（62 `M ` + 14 `A `，无 ` M`、无 `??`） |
| README 判据（base `47a298fc78` / ours `d054ea7b7a` / theirs `c22aa69118`） | `README.md` 42,539/42,783/42,783→42,556：**0 / 0 / 0**，overCap 0；`README.en.md` 578/507/507→581：**0 / 0 / 0**，overCap 0 |
| 307p 修复提交 | **`75754b8e647714a00ed070c42c2b3ac6ee3297fc`**（单亲 = 锚点） |
| 修复 tree | `a2ccf2e90eea60d1b388966e5ef10171276cc4a7` |
| `diff --numstat 锚点..修复` | **`2 0 apps/ai-service/app/data/tool_name_sets.json`**（只此一个文件） |
| 生成器 `--check`（在该树上） | **rc=0**，`✅ 生成物与 TS 真相源同步` |
| `diff --name-only c22aa69118..75754b8e` | **821 个文件，+76,112 / −7,659** |
| ref | `refs/curation/merge-main-latest` → **`75754b8e`** |

**重生成差集 = 空**：`tool_name_sets.json` 只多了两行，`categoryByTool` 增 `"sandbox_session": "command"`、`command` 集合增 `"sandbox_session"`；**没有别的陈旧项**，说明该生成物在主线只烂了这一处。

**新事实（须记）**：本线作业期间主仓 HEAD 从 `d054ea7b7a` 前移到 **`60a9d97817`**（15:42:11，`Merge c22aa69118 into d054ea7b7a`，README.en.md 人工归并，`d054..HEAD` = 25 笔）。⇒ 锚点的 p1 已是**旧快照**：`60a9d978` 不在 `75754b8e` 的祖先里，本地 main 与锚点已分叉；但对远端而言 `c22aa69118` 仍是祖先，**推送仍是快进**。

## 25. 验主线自产的 merge `60a9d97817`（15:5x）

| 项 | 值 |
|---|---|
| parents | **`d054ea7b7a`（p1）+ `c22aa69118`（p2）** ⇒ 是真 merge |
| tree | `196554a442e33ddc473038f4e23e233216a1661b` |
| author=committer | `智汇AGI社区 <ok502319984@gmail.com>`，**2026-11-07 15:42:11 +0800**（同秒作者=提交者，无 rebase 痕迹） |
| `d054..60a9` | **25 笔** |
| `--stat` 前几行 | `.env.production.example +20` / `README.en.md 13 +-` / `README.md 16 +` / … |

**九个数（base `47a298fc78` / ours `d054ea7b7a` / theirs `c22aa69118` / result `60a9d97817`）**

| 文件 | ours/theirs/base/result | 本侧独有未入 | 对侧独有未入 | 双方都删被复活 | overCap |
|---|---|---|---|---|---|
| `README.md` | 42,539 / 42,783 / 42,783 / **42,555** | **0** | **0** | **0** | 0 |
| `README.en.md` | 578 / 507 / 507 / **581** | **0** | **0** | **0** | 0 |

⇒ **不是照抄对侧**：若是照抄 theirs，本侧独有未入会是 ~138 而不是 0。与 §24 自己生成的并集件逐行多重集比对，**唯一差 1 行、且是文件末尾的空行**（我方 2 个尾空行、主线 1 个），正文逐行一致。

**307p 在 `60a9d97817` 上：rc=1（仍红）**，原文两行：
`❌ categoryByTool[sandbox_session]:生成器=command 磁盘=(缺)` / `❌ commandTools:只存在于生成器侧 sandbox_session`

| 项 | 值 |
|---|---|
| 修复提交 | **`c0983843019efdc9e0e09ea204e805fa5689f2dd`**（单亲 = `60a9d97817`，tree `f2276b95`） |
| `diff --numstat 60a9d978..c0983843` | **`2 0 apps/ai-service/app/data/tool_name_sets.json`** |
| 生成物 blob | `63ee97e433fe40eb11f6aac47a6a9c0d4116e7ad` —— 与 §24 那笔 `75754b8e` **完全相同**（`--check` 已在那笔上 rc=0） |
| ref | **`refs/curation/main-tip-307p` → `c0983843`** |
| `c22aa69118..c0983843` | **821 文件，+76,135 / −7,683** |
| `origin/main..c0983843` | **821 文件**（`origin/main` 仍 `c22aa69118`） |
| 快进性 | `origin/main` 与 `60a9d97817` 都是 `c0983843` 的祖先（rc=0）⇒ **纯快进**，`origin/main..c0983843` = 521 笔 |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
