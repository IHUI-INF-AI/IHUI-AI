<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 门 41 存量分支取证报告（2026-11-13）

> 用途：把 24 枚举报分支的**逐枚定论**与取证方法固化，避免下一位会话重复本轮的人工取证。
> 结论：**24 枚全部必须保留，0 枚可安全收口**。门 41 对这 24 枚判红是**正确的**——它们是各持有席尚未合并的真实工作。

## 一、口径说明

门 41（`scripts/check-single-branch.mjs`）判的是"旁支长期滞留"，两类豁免自动生效：

- `in-flight`：尖端提交距今 ≤ 48h（`IHUI_SINGLE_BRANCH_GRACE_HOURS` 可调）
- `backup`：`backup/`、`ihui-backup/`、`preserve/`（`preserve/` 于 2026-11-13 并入，见提交 `1b33002a4ef`）

被审面 = 本地 `refs/heads` + 远端跟踪引用。判红即 blocking。

## 二、本轮取证方法（三层，层层收紧）

对每枚分支取 `merge-base main <branch>`，逐文件判：

| 层 | 判据 | 含义 |
|---|---|---|
| L1 | `rev-parse <br>:<path>` == `rev-parse main:<path>` | 该文件两版完全一致 |
| L2 | 分支版内容行 ⊂ main 版内容行（子集判定） | 分支的改动已被 main 吸收 |
| L3 | 分支删除该文件 ∧ main 也无此文件 | 双方都已删除 |

三层全部通过才判 `COVERED`（可收口）。任一层有"分支有而 main 没有"的实质内容 ⇒ `KEEP`。

补充排除：`README*.md` / `AGENTS.md` / `PROJECT_PLAN.md` / `plan-fields.jsonl` / `.doc-autoupdate/*` 这类高频全量重写文档不适合 L2 子集判定（内容整体漂移会产生数万行"假未覆盖"），需单独人工判。

## 三、终局定论

### KEEP（实质内容未覆盖）—— 22 枚

| 分支 | 未覆盖实质文件数 | 性质 |
|---|---:|---|
| `archive/local-main-1e9f34aa34` | 20 | 历史保全快照（35 文件） |
| `feat/gate-300-clean` | 13 | 门 300 清理批 |
| `fix/ai-service-audit-1107` | 63 | ai-service 审计批 |
| `fix/api-defect-mining-1107` | 92 | API 缺陷挖掘批 |
| `fix/cli-defect-mining-1107` | 13 | CLI 缺陷挖掘批 |
| `fix/cli-tests-typecheck` | 2 | 含 `apps/cli/tests/types/repo-scripts.d.ts`（main 无此文件） |
| `fix/db-defect-mining-1107` | 44 | DB 缺陷挖掘批 |
| `fix/desktop-defect-mining-1107` | 24 | Desktop 缺陷挖掘批 |
| `fix/e2e-skip-wait` | 23 | e2e skip/wait 纪律批 |
| `fix/g89-r4-face-widen` | 13 | 门 89 R4 取证面放宽 |
| `fix/gate-302p-baseline-1107` | 3 | 门 302p 基线 |
| `fix/gate-strictness-restore-1107` | 5 | 门严格度恢复 |
| `fix/infra-defect-mining-1107` | 69 | 基建缺陷挖掘批（最大一枚，30 独有提交） |
| `fix/readme-legs-deadlock` | 9 | README 维护腿死锁 |
| `fix/redscan-main-red-1108` | 23 | 主分支红点复扫 |
| `fix/rn-shell-types-block` | 1 | `rn-shells.generated.d.ts`（分支 1710 行 ⊄ main 1752 行，main 更全但分支含独立声明） |
| `fix/root-obs-compose-port` | 2 | 含 `scripts/tests/check-port-registry.test.mjs`（150 行 BUG-0011 用例） |
| `fix/test-time-dependence` | 1 | `test_checkin_qoder.py` 固定测试时钟（872 vs 763 行，main 用另一套 `_cn_ts`/`_FrozenTime` 实现，同意图不同实现） |
| `fix/test-tmpdir-coupling` | 1 | `tool-result-envelope.test.ts` 断言基准钉显式 |
| `fix/typecheck-lock-fair-1107` | 66 | typecheck 锁公平性批（12 独有提交） |
| `fix/web-deep-audit-1107` | 45 | Web 深度审计批 |
| `rescue/main-wt-20261108` | 243 | **主工作区快照（279 文件，含 128 删除意图）—— 最高风险，绝不可删** |

### KEEP（仅台账登记未覆盖）—— 2 枚

| 分支 | 未覆盖内容 | 为何必须保留 |
|---|---|---|
| `fix/loomy-r5-register-g` | `PROJECT_PLAN.md`：BUG-101~109 共 9 条缺陷登记 | 全仓 grep 这 9 个编号**零命中**，登记从未入 main |
| `fix/loomy-ship-2` | `plan-fields.jsonl`：7 个 G-101~G-107 侧车键 | 键在 main 侧车里不存在（分支 258 键 / main 1362 键）；其余 3 个代码文件已全部覆盖（`tool_name_sets.json`、`fix-doc-numbers-prose.mjs` 与 main 逐字节相同；`rn-shells.generated.d.ts` 分支版是 main 子集） |

## 四、已排除的收口路径

| 做法 | 为何不做 |
|---|---|
| `git branch -D` + `git push origin --delete` | 违反 §5b；且 -D 会丢真实内容 |
| 代各持有席合并到 main | 会与持有席的在飞改动冲突，且合并意图应由持有者决定 |
| 给门 41 加豁免清单 | 门体明确不设"按分支名豁免"通道（白名单必然腐烂，门 89 的教训） |
| 把 24 枚登记为 backup 类 | 语义不符：它们是未合并的工作分支，不是删除前的保全快照 |

## 五、处置建议（给持有席 / 下一位会话）

1. **各分支持有席自行合并或删除**——这是门 41 设计的三条合法出路（合并 / 删除 / 等窗口）。
2. `rescue/main-wt-20261108` 建议单独评估：279 文件快照，需先确认其价值再决定去向。
3. `fix/loomy-r5-register-g` 与 `fix/loomy-ship-2` 的 9 条 BUG-101~109 登记值得单独捞取——它们是真实缺陷记录，全仓唯一副本。

## 六、复现命令

```bash
# 红名单现状（24 枚）
node scripts/check-single-branch.mjs 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep '✗' | sed 's/.*✗ *//' | sort -u

# 单枚内容级取证（以 typecheck-lock-fair-1107 为例）
base=$(git merge-base main fix/typecheck-lock-fair-1107)
git diff --name-status "$base" fix/typecheck-lock-fair-1107
git rev-parse fix/typecheck-lock-fair-1107:<path> main:<path>

# 补丁等价性（判"是否已被等价收录"）
git cherry main fix/typecheck-lock-fair-1107 | grep -c '^+'
```

---

取证执行：2026-11-13 · 判据实现见本轮 `tmp/pool-audit/g41-forensic.mjs`（临时件，未入库）
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
