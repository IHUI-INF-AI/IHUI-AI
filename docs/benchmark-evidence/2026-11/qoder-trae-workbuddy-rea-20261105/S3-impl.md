<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S3 落地席 — goal-b49 会话侧写盘簇(版本化文件快照 + shell 快照 + hook 注入件 #16)

- 现场 HEAD(现读 `git rev-parse HEAD`):15f1acea0ce2b24aff3debc90a7ea30eb46318f7
  (开工时主席给的锚点 e557c22648652636498e67f726fe74de1f46291f 已被推进一枚:S2 席
  `feat(types+cli): 复现 Qoder 的插件贡献词表…` 先落地;该枚未触 `apps/cli/src/checkpoints/`,
  故本席工作副本与新 HEAD 无冲突 —— 现读 `git diff e557c226..HEAD --stat -- apps/cli/src/checkpoints/` 为空)
- 开票时刻:2026-11-05;收尾时刻:同轮

## 现场读数(动手前后各扫一遍 `git status --porcelain -- <路径>`)
- `apps/cli/src/checkpoints/`(4 枚:hunk-tracker / hunks / index / manifest-integrity)开工时**全净**,
  票面 §4 点的 `sessions/state-store.ts` 等行号本席未采用(按主席令当线索不当事实)。
- 收尾时本席足迹:`M apps/cli/src/checkpoints/index.ts`、`M apps/cli/tests/checkpoints-corrupt-manifest.test.ts`、
  新增 `?? apps/cli/src/checkpoints/snapshot-series.ts`、`?? apps/cli/src/checkpoints/snapshot-gc.ts`、
  `?? apps/cli/tests/snapshot-series-gc.test.ts`。
- 同层他席足迹(本席未碰,交主席落地时勿并包):`?? apps/cli/tests/delete-axis-consumers.test.ts`、
  `?? apps/cli/tests/install-policy.test.ts`、`?? apps/cli/tests/parent-bound.test.ts`。
- 现读 `git diff --stat HEAD -- <本席两枚被改文件>` = 164 insertions(+), 5 deletions(-)。
- 行数现读:`snapshot-series.ts` 221、`snapshot-gc.ts` 245、`snapshot-series-gc.test.ts` 250、
  `checkpoints-corrupt-manifest.test.ts` 208;**`index.ts` 397(存量 260 已超 250,本席 +137)**
  ⇒ 门 11e `check-file-size.mjs --staged` 只拦"新增文件 >800 行",本席三枚新文件均在闸内;
  index.ts 的超限属存量,拆分需另票(见未竟 3)。

## 落了什么
1. **`apps/cli/src/checkpoints/snapshot-series.ts`(新增,纯判据、零 fs、零时钟、零随机)**
   - `<uuid>@vN` 一等契约:`parseSnapshotSeriesDirName`(6 档拒绝码:empty-name / unsafe-path-segment /
     missing-separator / multiple-separators / malformed-uuid / malformed-version;版本号拒 `v0`、拒前导零 `v007`、
     拒符号与小数;路径分隔符与点段先拦,畸形名绝不"猜"出版本)、`formatSnapshotSeriesDirName`(半档入参直接 RangeError)、
     `seriesUuidFromSeedHex`(32 位十六进制种子 ⇒ 规范 8-4-4-4-12)、`allocateNextSnapshotSeriesRef`
     (取本序列最大 +1,外来命名与其他序列不参与定序,到上界拒分配)、`auditSnapshotSeriesOrdering`
     (按给定顺序逐条走查,回退=version-regression / 重号=duplicate-version / 畸形=malformed-name,跨 uuid 互不牵连)。
   - 超越点:对方 uuid 随机不可寻址(要列盘才知道下一版);我方序列身份由 sessionId 的 sha256 前 32 位推导
     ⇒ 不列盘即可算出该会话序列身份,重号/回退在命名层就被排除。
2. **`apps/cli/src/checkpoints/snapshot-gc.ts`(新增,纯判据、零 fs)**
   - 三约束**同时成立**才删:`keepVersions`(第 N+1 版才进射程)∧ `maxAgeMs`(窗内不删)∧ `maxTotalBytes`
     (删后总量仍超上限才删,未超一枚不动);保住者逐枚记 retained 并写明是哪一档保住的。
   - 删除前逐枚自证清单:`import type { ManifestReadResult } from './manifest-integrity.ts'` **type-only**,
     运行时由调用方注入 `readManifest`;清单缺失/损坏/读取抛错/createdAt 解析不出 ⇒ 该候选进 undetermined。
     判据只在 manifest-integrity 那一份(§0.6 无第二份:测试形状锁反向钉 `not.toContain('readManifestChecked(')`)。
   - §0.3 失效方向:策略不合法、枚举到 0 个候选、体积量不出、重号、版本序与 createdAt 矛盾 ⇒ `state:'undetermined'`
     且 `deletions` 恒空并逐条 `notes` 点名(§0.10「多要一次定向说明」,绝不「多放一次删除」)。时钟与清单都靠注入 ⇒ 可重放。
3. **真消费方(门 121):`apps/cli/src/checkpoints/index.ts` 单点最小改动**
   - `snapshotSync` 目录名从 `cp_<ts>_<rand>` 改为 `<seriesUuid>@vN`(分配器给版本,构函数造序列身份);
   - `pruneOldCheckpoints` 从"超出 20 枚即删"改为走 `planSnapshotGc`(策略 `DEFAULT_SNAPSHOT_GC_POLICY` +
     `keepVersions` 跟随 `maxCheckpoints`,可由新 `snapshotGcPolicy` 选项覆盖),体积由 `measureDirBytes`
     有界枚举(超 2000 条目预算 ⇒ null ⇒ 判不出 ⇒ 不删);`getLastGcNotes()` 把未判定点名行留在账面;
   - 历史 `cp_` 前缀目录无版本档 ⇒ 仍按原「超出 maxCheckpoints 即删」清账(旧死亡机制不降级)。
   - 可达性证据:落盘行为用例直接跑通(v1→v5 序列、越界三约束达成才删),形状锁静态钉住五个调用点。
4. **顺手摘掉一处实测缺陷(同一枚文件内,非新能力)**:`CheckpointManager.list()` 原先无命名空间地扫
   `<sessionId>/` 全部子目录,把同层 `hunk_*` 的清单按 `isCheckpointMeta` 判 shape-invalid 并**改名隔离**
   (探针实测:`exists=false quarantined=["manifest.corrupt-*.json"]` ⇒ hunk 回滚静默失效)。
   现只扫自己的命名空间(`inOwnNamespace`,与 hunk 侧 `startsWith('hunk_')` 同纪律),并在
   `checkpoints-corrupt-manifest.test.ts` 加**成对**用例(hunk 清单保全 ∧ `cp_stillbad` 坏件照旧隔离报名)。
5. **测试 `apps/cli/tests/snapshot-series-gc.test.ts`(19 例,六组齐备)**:①解析与构造 ②回退/重号/畸形各自拒绝
   (每条带正例对照)③三约束各自边界(第 N+1 版才删、窗内不删、未超上限不删、跨序列不牵连、策略不合法即未判定)
   ④清单腐烂/缺失/抛错/量不出 ⇒ 不删并点名 ⑤候选 0 ⇒ 未判定不记绿 ⑥形状锁(判据模块零 fs token、单源出口、
   消费者在场)+ 消费方落盘两例。夹具落点全部走 `scripts/lib/scratch-dir.mjs` 的 `mkScratch`/`rmScratch`(§15b)。

## 验证末行现读
- `cd apps/cli && npx vitest run tests/snapshot-series-gc.test.ts`
  → `Test Files  1 passed (1)` / `Tests  19 passed (19)` / `Duration  553ms`
- 既有 checkpoint/manifest/hunk 相关用例
  `npx vitest run tests/checkpoints.test.ts tests/checkpoints-corrupt-manifest.test.ts tests/checkpoint-session-e2e.test.ts tests/hunks.test.ts tests/hunk-tracker.test.ts`
  → `Tests  75 passed (75)` / `Duration  4.29s`
- `npx tsc --noEmit -p apps/cli/tsconfig.json` → 全量 7 行错误,逐行均在 `src/commands/skill-package.ts`
  (票面已证的他席在飞面:`../skills/packaging/index.js` 被别席暂存删除)⇒ **本席触及面 0 错误**
  (`grep -v skill-package` 后行数为 0)。
- 水印:三枚新文件已 `watermark.mjs inject`;全部五枚
  `node scripts/watermark.mjs verify <file>` → `纳入口径的文件均已携带完整溯源水印。`
  (注:`.prettierignore` 含 `cli/` ⇒ apps/cli 不在 prettier 射程,`prettier --write` 对三枚新文件均为 no-op,载荷未被 reflow)

## 超越轴逐条对账(对方 244 目录 65 版零清理、无到期概念)
- **可寻址版本序列**:已做到 —— 序列身份由 sessionId 摘要推导,不列盘即可算出;下一版由纯函数分配;
  回退/重号/畸形名各有拒绝码并被测试钉住。
- **三约束 GC**:已做到 —— `keepVersions ∧ maxAgeMs ∧ maxTotalBytes` 同时成立才删,retained 逐枚写明
  是哪一档保住的;时钟与清单注入 ⇒ 判据可重放、可入库 diff。
- **"判不出来就不删"的失效方向**:已做到 —— 五类输入缺失(策略不合法 / 候选 0 / 体积量不出 /
  清单不可得 / 序列矛盾)全部落 `state:'undetermined'` 且 `deletions` 恒空 + 逐条点名。
- **入库可被守门 diff**:部分做到 —— 判据与消费方都在版本面、形状锁(门 121 消费者 + 零 fs)已入库可 diff;
  但"快照存量是否无限增长"的只读哨兵尚未造(见未竟 6),故本轴不算全绿。
- 未做(明确不假装):shell 快照与 hook 注入件两格本票未动 —— 对方那两簇在我方已有对位
  (`apps/ai-service/app/core/shell_snapshot.py` 现读存在、CLI hooks 面 `apps/cli/src/hooks/{index,discovery,trust}.ts`
  现读存在),且属他席在飞面(plugins/lib=S1/S2、ai-service=S4),本席不越界重复实现。

## 未竟(逐条带解锁条件)
1. **本席产物未提交未推送**(票面禁 commit/push;AGENTS §12h 由主席执行)。
   解锁 = 主席对这 5 枚路径做 safe-commit/object-space-land,并注意与同层他席三枚未跟踪测试文件分票。
2. **`getLastGcNotes()` 只有 getter,CLI 命令面未显示**(`ihui cp list` 仍只报损坏清单)。
   解锁 = 主席放开 `apps/cli/src/commands/checkpoint.ts`(本票清单外,未动)后,把 notes 逐行打到 stderr;
   GC 判红/未判定经到人通道另按 §5e-1 可整改性评估。
3. **index.ts 现 397 行(存量 260 已超 250)**:拆分需另票 —— 候选方案 = 把 `measureDirBytes`/`existingDirNames`/
   `seriesCandidates`/`inOwnNamespace` 抽出为 `checkpoints/snapshot-store-host.ts`(fs 适配层,判据仍零复算)。
   解锁 = 该另票开工时一并做,避免与 S1/S2 席同时在飞的 `apps/cli/src/**` 改动叠diff。
4. **年龄窗/总量上限的默认值是工程判断**(20 版 / 30 天 / 256 MiB),本席未量本机真实分布。
   解锁 = 由只读哨兵量 `~/.ihui/checkpoints/*/` 真实体积与版本数后调档(§0.1 数字现读,不写死进判据)。
5. **两类快照仍共用 `<sessionId>/` 一层**(只是各自按命名空间自扫:hunk 侧早已 `startsWith('hunk_')`,
   本席把 file 侧对齐成同样的纪律)。彻底分户(`<sid>/files/` 与 `<sid>/hunks/`)可根除"同层互踩"这一型,
   但要动存量目录搬迁与 `commands/checkpoint.ts` 的 restore 入参口径 ⇒ 跨文件改动,不属本票"一处最小改动"。
   解锁 = 主席另票,并须带存量迁移器物(不可只改新写侧留旧目录孤儿)。
6. **未接守门**:三约束 GC 目前只被 `CheckpointManager` 走到,没有独立的提交链/守护巡检尺去量
   "快照目录存量是否无限增长"(即票面"入库可被守门 diff"那一轴,只落了判据与台账出口)。
   解锁 = 落地后另票新增只读哨兵(判机器状态 ⇒ 按 §12e 不进提交链),复用 `snapshot-gc` 判据不复制。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
