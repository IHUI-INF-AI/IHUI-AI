<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 带值旗标吞下一旗 —— 普查 findings（逐处实证）

判定面 = HEAD（`git show HEAD:<path>`），本机有多个会话在改 `scripts/**`。
判定档：A 大声失败（合规）/ B 静默降级（要修）/ C 形态不佳（喊了但喊错）/ D 未判定。
坏值三形态：`<flag> --staged`、`<flag>`（结尾无值）、`<flag> ""`。
（本文件由普查代理写于 `.ihui-agent/tmp/flag-census/`，不入库。）

## 枚举（覆盖面自证的基线）

`node .ihui-agent/tmp/flag-census/p2/enumerate2.mjs` → HEAD 上 `scripts/**.mjs`（不含 `scripts/tests/`）
取值点 **53** 处；手工补 2 处启发式漏掉的（`scripts/lib/import-graph.mjs:678 --face`、
`scripts/check-watermark-syntax.mjs:455 --root`）；再由"把取值窗口从 6 行放宽到 12 行"的那一轮
（`p2/coverage.mjs` 的补枚举）再补 5 处 ⇒ **总 60**。
分布（`p2/worklist.json` 现数）：`--root` 53 / `--face` 3 / `--rev` 2 / `--policy` 1 / `--port` 1 = **60**。
工作清单：`p2/worklist.json`（60 条，按危害排序：`--rev/--face/--policy/--port` 先做，`--root` 次之）。
**尺子自己的两格漏扫**（这是"扫到 0/少扫要先怀疑尺子"在本票的具体形态）：
① 第一版只认**同行**的 `indexOf(flag)+1`，对 `const ri = argv.indexOf('--root')` 这一族隔行取值全盲
—— 只报出 8 处；② 6 行窗口仍漏 5 处（取值式写在 7–12 行之外，或写成 `flagVal(argv, '--root')` 这种助手形态）。
4 处按"禁跑写盘/起服务档"预先拒绝执行（见汇总表 D 档）。

## 批次 1（站点 1–12）

| # | file:line | 旗标 | 取值写法 | 档 | 三次坏值实跑 RC 与末行原文（截断） |
| --- | --- | --- | --- | --- | --- |
| 1 | `scripts/check-merge-addition-loss.mjs:358` | `--rev` | `argv[revIdx + 1]` | **A** | `--rev --staged` rc=2 `❌ 无法判定(exit 2): git rev-list 失败: usage: git rev-list …` ／ `--rev`（无值）rc=2 `❌ 无法判定(exit 2): git rev-list 失败: fatal: ambiguous argument 'undefined' …` ／ `--rev ""` rc=2 `❌ 无法判定(exit 2): … ambiguous argument '' …` |
| 2 | `scripts/check-no-conflict-markers.mjs:653` | `--rev` | `findIndex(a=>a==='--rev')`+`+1` | **C** | `--rev --staged` rc=2 但**抛裸栈**：`at auditRev (…:381:17) / at main (…:665:7)`，不点名实得 token ／ `--rev` rc=2 `❌ --rev 需要一个提交参数,例:--rev HEAD` ／ `--rev ""` rc=2 同上一句 |
| 3 | `scripts/lib/import-graph.mjs:678` | `--face` | `const v = argv[++i]; if (!v)` | **A** | `--face --staged` rc=2 `⚠️ 无法判定：face 必须是 HEAD \| index \| worktree（或其惯用别名），收到: "--staged"` ／ `--face` rc=2 用法页（含"未登记开关一律 exit 2（不得静默落进默认分支）"）／ `--face ""` rc=2 同 |
| 4 | `scripts/module-context.mjs:94` | `--face` | `taken.add(argv.indexOf('--face')+1)` | **B**（首跑夹具错 ⇒ 曾记 D，见批次 1b） | 首跑未带位置参数 `<模块 id>`，三次 rc=2 的报错都是"缺少模块 id"，**测不到 --face 本身**；带正确 id(`apps/cli`) 重跑后：`--face --staged` rc=2 `❌ 未知开关「--staged」…`、**`--face` 无值 rc=0 出 80 行完整上下文 + `✅ 本模块声明齐备`**、**`--face ""` rc=0 逐字同上** |
| 5 | `scripts/module-context.mjs:95` | `--policy` | 同上 | **B**（同上） | 重跑：`--policy --staged` rc=2；**无值 / 空串均 rc=0 并出 `✅` 结论**；给相对路径则 rc=2 `❌ 取/解析策略表失败 ⇒ 无法判定:--policy 必须是绝对路径…` ⇒ 给了值有校验，不给值直接落默认表 |
| 6 | `scripts/sync-alpha-usage.mjs:65` | `--face` | `argv[i + 1]` | **D（拒绝实跑）** | 该脚本**缺省档就写盘**：`writeFileSync(resolve(ROOT, PLUGIN_REL), rendered)`（HEAD:414），`--check` 才是只读档；普查纪律禁止触发 ⇒ 只做源码判定 |
| 7 | `scripts/dev-web.mjs:34` | `--port` | `process.argv[indexOf('--port') + 1]` | **D（拒绝实跑）** | 该脚本是起 dev server 的宿主（会拉起 next/pnpm，且按 §12d 抢部署锁），不适合在普查里执行 |
| 8 | `scripts/check-agent-status-vocabulary-parity.mjs:710` | `--root` | `argv[ri + 1]` + 目录校验 | **A** | 三次全部 rc=2 `❌ --root 需要一个目录参数` |
| 9 | `scripts/check-api-routes.mjs:29` | `--root` | `process.argv[ARG_ROOT_IDX + 1]` | **B** | `--root --staged` rc=2 `[API 路由比对] 无法判定:--root 是测试通道,只在 --worktree 档有效(换根仍按 staged 读 = 双根分裂)` ／ **`--root`（无值）rc=0 照常打印整份路由比对报告** ／ **`--root ""` rc=0 同上** |
| 10 | `scripts/check-background-task-type-parity.mjs:682` | `--root` | `argv[rootIdx + 1]` | **B** | `--root --staged` rc=2 `--root 只在 --worktree 档有效(双根分裂)` ／ **`--root` rc=0 `结论:声明 ↔ 实现 ↔ 接线三面一致,回显未复潮`** ／ **`--root ""` rc=0 同** |
| 11 | `scripts/check-batch-write-count-honesty.mjs:2068` | `--root` | `argv[ri + 1]` | **B** | `--root --staged` rc=2（但原因是 git 派生 ENOENT，未点名实得 token）／ **`--root` rc=0 `✅ 通过:覆盖面内无自算计数…候选 3 / 违规 0 / 未判定 0`** ／ **`--root ""` rc=0 同** |
| 12 | `scripts/check-button-height.mjs:52` | `--root` | `argv[i + 1]` | **A** | 三次全部 rc=2 `❌ --root 缺少目录参数` |

## B 类阳性对照（批次 1）

判据：**给了值** ⇒ 值被消费（哪怕结论是"这个根不对"），**没给值 / 给空** ⇒ 静默回落默认根并照常出结论。

- `check-api-routes.mjs`：`--root <存在目录>` 与 `--root <不存在目录>` **都**打印
  `[API 路由比对] 无法判定:--root 是测试通道…`（值被读到了才会走到这句），而 `--root`（无值）
  rc=0 打出完整比对报告 ⇒ 空值那一支根本没进 `--root` 的校验，直接落 `ROOT` 默认值。
- `check-background-task-type-parity.mjs`：同一对照 —— 带值（好/坏目录）都喊 `--root 只在 --worktree 档有效`，
  无值 rc=0 出"三面一致"结论。
- `check-batch-write-count-honesty.mjs`：带合法目录喊 `ROOT(…p2)不是仓库根(G:/IHUI-AI),两基准会错位`、
  带不存在目录喊 git 取不到 ⇒ 值确实被消费；无值/空值 rc=0 `✅ 通过` ⇒ **值丢了而结论照发**。

（B 的对照还差一步：把"完全不传 `--root`"与"传 `--root` 而不给值"两次输出逐字对齐，见批次 1b。）

## 批次 1b（站点 4/5 复跑修正 + B 的字节级阳性对照）

**首跑夹具错**：我给 `scripts/module-context.mjs` 传的模块 id 是 `cli`，而真 id 是 `apps/cli` —— 八次实跑全部
`rc=1/2 ❌ 未知模块 id「cli」`，测的是 id 校验不是 `--face`。带正确 id 复跑后：

| # | file:line | 旗标 | 档 | 实跑 |
| --- | --- | --- | --- | --- |
| 4 | `scripts/module-context.mjs:94` | `--face` | **B** | `--face --staged` rc=2 `❌ 未知开关「--staged」:只认 --json / --files / --list / --strict / --face <head\|index> / --policy <绝对路径>`（A 形态）／ **`--face`（无值）rc=0 打出 80 行完整模块上下文并以 `✅ 本模块声明齐备(入口与已声明契约工件都在取材面里)` 收尾**／ **`--face ""` rc=0 逐字同上** ／ 对照 `--face head` rc=0、`--face nosuchface` rc=2 `❌ 未知 --face「nosuchface」(只认 head/index)—— 拼错不得静默走默认档` |
| 5 | `scripts/module-context.mjs:95` | `--policy` | **B** | `--policy --staged` rc=2 未知开关 ／ **`--policy`（无值）rc=0 与 `--policy ""` rc=0 都打出同一份 80 行 + `✅` 结论** ／ 对照 `--policy <相对路径>` rc=2 `❌ 取/解析策略表失败 ⇒ 无法判定:--policy 必须是绝对路径…` ⇒ **给了值就有校验，不给值直接落默认表** |

### B 类阳性对照（字节级，非肉眼）

同一 spawnSync 口径、`cwd=REPO`、全文落盘后比字节数与 rc（`p2/ctl1d.mjs`，全文在 `p2/runs/*__X-*.txt`）：

| 脚本 | 不传 `--root` | `--root`（无值） | `--root ""` | `--root --staged` |
| --- | --- | --- | --- | --- |
| `check-api-routes.mjs` | rc=0 / 2305 B / 29 行 | **rc=0 / 2305 B / 29 行（逐字相同）** | rc=0 / 2305 B / 29 行 | rc=2 / 78 B `无法判定:--root 是测试通道…` |
| `check-background-task-type-parity.mjs` | rc=0 / 309 B / 7 行 | **rc=0 / 309 B / 7 行（逐字相同）** | rc=0 / 309 B / 7 行 | rc=2 / 47 B |
| `check-batch-write-count-honesty.mjs` | rc=0 / 547 B / 2 行 | **rc=0 / 547 B / 2 行（逐字相同）** | rc=0 / 547 B / 2 行 | rc=2 / 164 B |
| `module-context.mjs`（`--face` / `--policy`） | rc=0 / 80 行 | **rc=0 / 80 行（逐字相同）** | rc=0 / 80 行 | rc=2 / 1 行 |

⇒ 判据成立的方式是**"值缺席时输出与不传该旗标逐字等值"**，而不是"看起来差不多"：值被吞掉后
这四道门**照常出具 `✅ 通过` / `✅ 三面一致` / `✅ 声明齐备`**。这正是本票要挖的那一型。

### 一次自纠（记录，免得下一个人当成结论）

`p2/ctl.mjs` 首轮把这三个脚本的"无值"读成 `rc=9 / lines=1`，与 `p2/probe.mjs` 的 `rc=0` 直接矛盾。
两个 harness 的差别是我自己造成的（一个用了被 `head` 截断的输出面 + 旧 worklist 的 site 序号，一个没有），
**没有采信任何一边**，改用 `p2/ctl1d.mjs` 把四份全文各自落盘再比字节数与 rc 才定案。
教训照抄：同一落点两次跑出不同 RC 时，先怀疑取数姿势，再怀疑被测物。

## 批次 2（站点 13–30）

RC 三元组顺序 = `--root --staged` / `--root`（结尾无值）/ `--root ""`。

| # | file:line | 旗标 | 档 | 实跑证据（RC + 末行原文节选） |
| --- | --- | --- | --- | --- |
| 13 | `scripts/check-capability-matrix.mjs:50` | `--root` | **B** | rc=`1/0/0`：`--root --staged` → `❌ …能力台账对账失败(1 条): apps/ai-service/app/core/capability_matrix.py 缺失`（把"根不对"报成"事实源被删"，错因）；无值/空值 → `✅ …台账 79 条 / 扫描 578 个 py 文件…` |
| 14 | `scripts/check-crash-report-redaction.mjs:440` | `--root` | **C** | rc=`2/2/2`：无值/空值 `❌ --root 需要一个目录参数`（A 形态）；但 `--root --staged` **抛裸栈** `at ModuleJob.run (node:internal/modules/esm/module_job:439:25)` |
| 15 | `scripts/check-declared-policy-has-consumer.mjs:572` | `--root` | **B** | rc=`2/0/0`：无值/空值 → `✅ 通过(面=HEAD blob 扫描 4101 文件 / 候选声明 140 / 未接线 28 / 判红文件 0 / 未判定 0)` |
| 16 | `scripts/check-digest-name-reality.mjs:1502` | `--root` | **C** | rc=`2/2/2`：`--root ""` → `❌ 无法判定:--root 后面没有参数`（A）；`--root --staged` → `❌ 无法判定(取材失败…):git rev-parse 失败: …PortableGit\versions\1.2.0\cmd\git.exe ENOENT`；**无值那一次是裸栈**（`at ModuleJob.run`） |
| 17 | `scripts/check-direct-backend-calls.mjs:1377` | `--root` | **B** | rc=`2/2/0`：`--root --staged` → `❌ --root 不存在: G:\IHUI-AI\--staged`（A 形态）；无值 rc=2；**`--root ""` rc=0 `[PASS] 无新增端内直连后端`** |
| 18 | `scripts/check-doom-loop-parity.mjs:487` | `--root` | **B** | rc=`2/0/0`：无值/空值 → `✅ TS 共享层 / CLI 适配器 / agent.ts / Python 等价实现 / agent_loop_v2 五面成套:策略键 10 项逐字等值…` |
| 19 | `scripts/check-env-drift.mjs:775` | `--root` | **B**(rc 非零但错因无关) | rc=`2/2/2`：`--root --staged` → 明细行 `现文件:G:\IHUI-AI\--staged\.env`（值被当路径用并计入未判定 ⇒ 算 A 的弱形态）；无值/空值 → 首行 `✅ .env(仓库根) —— 无漂移(备份键 44 / 现键 44)`，**exit 2 的原因是"未判定 2"，不是这个被吞的 `--root`**；与"不传该旗标"**字节逐字相同**（690B/rc=2） |
| 20 | `scripts/check-gate-face-discipline.mjs:750` | `--root` | **A** | rc=`2/2/2`，三次都给同一段定向出路：`于是既丢了 --staged 档、又对着一个不存在的路径判 —— 这比判红更糟…出路:--root <目录> 给真实目录…或者整个去掉 --root` |
| 21 | `scripts/check-glyph-arrow-icon.mjs:1620` | `--root` | **B** | rc=`2/2/0`：`--root ""` → `✅ 无文本箭头字形、无文字返回键、无字号倒挂、共享矢量实现在位`（无值那次是裸栈） |
| 22 | `scripts/check-i18n-messages-exist.mjs:109` | `--root` | **B（最severe）** | rc=`0/0/0` 三次全零。`--root --staged` → `[i18n-messages-exist] staged 模式: 暂存区无 i18n 改动,跳过`；无值/空值 → `✅ 通过 (G:\IHUI-AI) …合计 40 项全部存在且合法`。源码 `resolveRoot()`：`cli = flagVal && !flagVal.startsWith('-') ? flagVal : null` ⇒ **以 `-` 开头的值被静默丢弃并回落 `REPO_ROOT`**，而 `scripts/tests/check-i18n-messages-exist.test.mjs:86` 把这条回落**当规格钉住**（`assert.equal(resolveRoot([…,'--root','--staged'],{}), gate.REPO_ROOT)`） |
| 23 | `scripts/check-lock-manifest-consistency.mjs:1887` | `--root` | **A** | rc=`2/2/2`：`❌ --root 指向的目录不存在: G:\IHUI-AI\--staged` / `❌ --root 需要一个目录参数` |
| 24 | `scripts/check-mention-engine-wired.mjs:752` | `--root` | **B** | rc=`2/1/0`：`--root` 无值 → `ERR_INVALID_ARG_TYPE` 裸栈 rc=1；`--root ""` → `✅ 三个件都有生产调用方,且维度表与触发解析各只有一处` |
| 25 | `scripts/check-migration-bookkeeping.mjs:88` | `--root` | **C** | rc=`1/1/1` 三次全抛 `new Error('--root 需要一个目录参数')` 的**裸栈**并以 exit 1 收 —— 而本脚本的 1 档语义是"违反判红"，把用法错判成了判红 |
| 26 | `scripts/check-miniapp-css-landing.mjs:3339` | `--root` | **D** | 拒绝实跑：默认档要真 dist 产物、自检档会造夹具（写盘），普查纪律下不跑；只留源码判定 |
| 27 | `scripts/check-miniapp-generated.mjs:546` | `--root` | **B** | rc=`2/0/0`：无值/空值照常出全量报告（`[G3] …87/88 个键…永不判红` 那段）且 rc=0 |
| 28 | `scripts/check-model-capacity-parity.mjs:711` | `--root` | **A** | rc=`2/2/2` 三次同一句 `❌ --root 需要一个目录参数` |
| 29 | `scripts/check-package-barrel-export.mjs:732` | `--root` | **B** | rc=`2/0/0`：无值/空值 → `✅ 本次…`（附 `[覆盖] @ihui/ui-native:…` 全量结论） |
| 30 | `scripts/check-plan-sha-resolvable.mjs:495` | `--root` | **B** | rc=`2/0/0`：`--root --staged` → `❌ 无法判定：git cat-file --batch 失败,G:\IHUI-AI\--staged 的判定面无法取材`（A）；无值/空值 → 打出完整读数行 `末行读数：面=HEAD blob … 定级=warn(未接提交链) · exit=0` |

### 批次 2 的 B 类阳性对照（字节级；`p2/controls.txt`）

`不传该旗标` vs `--root`（无值）vs `--root ""`，比 RC + **全文字节**（不是肉眼"差不多"）：

```
check-capability-matrix              262B / 262B / 262B   逐字相同: 无值=true 空值=true
check-declared-policy-has-consumer  2109B / 2109B / 2109B 无值=true 空值=true
check-doom-loop-parity               197B / 197B / 197B   无值=true 空值=true
check-i18n-messages-exist            171B / 171B / 171B   无值=true 空值=true
check-miniapp-generated             1624B / 1624B / 1624B 无值=true 空值=true
check-package-barrel-export         3074B / 3074B / 3074B 无值=true 空值=true
check-plan-sha-resolvable           4959B / 4959B / 4959B 无值=true 空值=true
check-env-drift                      690B / 690B / 690B   无值=true 空值=true（rc 三档同 2）
check-direct-backend-calls           200B / 482B / 200B   无值=false 空值=true  ← 只有空串那支静默
check-glyph-arrow-icon               825B / 554B / 825B   无值=false 空值=true  ← 同上
check-mention-engine-wired           681B / 627B / 681B   无值=false 空值=true  ← 同上
check-migration-bookkeeping         1061B / 622B / 622B   无值=false 空值=false（三支都喊，但都裸栈）
```

⇒ 三种坏值形态**不是等价的**：`<flag> --staged`（值被下一个旗标顶掉）与 `<flag>`（无值）在多数门上都能撞到
某个下游报错；真正成片静默的是 **`<flag> ""`（空串）** 与 **`<flag>`（结尾无值）** —— 11/16 个 B 站点的空串支
输出与"完全不传该旗标"**逐字节相同**，且照常出具 `✅ 通过` 类结论。

## 批次 3（站点 31–55）

| # | file:line | 旗标 | 档 | RC 三元组 + 末行原文节选 |
| --- | --- | --- | --- | --- |
| 31 | `scripts/check-principal-consumed.mjs:253` | `--root` | **B（三支全静默）** | rc=`0/0/0`。`--root --staged` → `principal-consumed 对账:被审面=staged 锚点面=head(扫描 0 / 锚点扫描 0)…机器态未判定 1 条`（**根与面各吃了一半**）；无值/空串 → `结论:通过(被审面相对锚点面零新增,无未判定)` |
| 32 | `scripts/check-project-plan-archive.mjs:749` | `--root` | **A（本族最佳写法）** | rc=`2/2/2`，三次都点名实得 token：`❌ 无法判定:--root 需要一个存在的目录(实得 "--staged")` / `(实得 null)` / `(实得 "")` |
| 33 | `scripts/check-prompt-injection-registry.mjs:528` | `--root` | **B** | rc=`2/0/0`：`✅ 提示注入登记对账通过:登记 9 条 / kind 封闭集 3 档 / 扫描 263 文件…` |
| 34 | `scripts/check-public-exposure-list.mjs:465` | `--root` | **B** | rc=`2/0/0`：`结论:consistent \| 违规 0 \| 报数 5 \| 未判定 0`（且该脚本自己声明"RC 只给人看"） |
| 35 | `scripts/check-pwsh-version.mjs:31` | `--root` | **C** | rc=`1/1/1` 三支全非零，但：`--root --staged` → `[FAIL] root path does not exist: G:\IHUI-AI\--staged`（A 形态）；**无值 → 裸栈 `ERR_INVALID_ARG_TYPE`**；**空串 → 把默认根判成"有违规"并 exit 1**（末行是 `#requires -Version 7` 那条叙述，即它拿 cwd 当根扫出了别的东西）⇒ 用法错与判红共用 exit 1 |
| 36 | `scripts/check-readme-table-integrity.mjs:703` | `--root` | **B** | rc=`2/0/0`：`✅ 无新增 T…`（附 `面:head README.md: 表格簇 131…`） |
| 37 | `scripts/check-root-dir-clean.mjs:35` | `--root` | **C** | rc=`1/1/1` **三支全是裸栈**（`at async node:internal/modules/esm/loader:643:26 … Node.js v24.19.0`），无一句点名 `--root` |
| 38 | `scripts/check-selftest-registrant-evaluates.mjs:646` | `--root` | **A** | rc=`2/2/2`：`❌ 无法判定(exit 2): --root 没有收到有效目录 —— 紧邻的 token 实得:"--staged" / (其后没有任何参数) / ""` —— 三态分开点名 |
| 39 | `scripts/check-shared-nonde-node-purity.mjs:591` | `--root` | **B** | rc=`2/0/0`：`✅ full(HEAD blob):候选 shared…`（源码形态 `argv[argv.indexOf('--root') + 1] || '.'` ⇒ **空串直接落 `.`**） |
| 40 | `scripts/check-staged-deletions.mjs:448` | `--root` | **B + C** | rc=`2/2/0`：无值/nextflag 都是**裸栈**；**空串 rc=0 `[staged-deletions] ✅ 无暂存删除,判据未触发(口径=索引 blob)`** |
| 41 | `scripts/check-stale-dist.mjs:863` | `--root` | **B** | rc=`2/0/0`：`✓ 所有 dist 与源码同步,无陈旧问题。` |
| 42 | `scripts/check-statusbar-single-source.mjs:613` | `--root` | **B + C** | rc=`2/2/0`：**空串 rc=0 `✅ 顶距单一源头成立`**；另两支是 git ENOENT / 裸栈 |
| 43 | `scripts/check-subagent-permission-inherited.mjs:452` | `--root` | **B** | rc=`2/0/0`：`✅ 子代理权限档继承对账通过(P1/P3 零违规,P2 无新增;存量 7 处只报数)` |
| 44 | `scripts/check-token-sync-registry.mjs:590` | `--root` | **A** | rc=`2/2/2`：`❌ --root 需要一个目录参数`（无值/空串两支），nextflag 那支 rc=2（git ENOENT，理由不指名） |
| 45 | `scripts/check-tool-arg-routing-identity.mjs:645` | `--root` | **B** | rc=`2/0/0`：`✅ 通过(面=HEAD blob 61 文件 / 违规 0 / 豁免 0 / 判不出 0 / 键清单 16 项…)` |
| 46 | `scripts/check-tool-arg-validation-wired.mjs:447` | `--root` | **B + C** | rc=`2/1/0`：**空串 rc=0 `✅ 校验器有生产调用方,且影子档在位、默认档不是 enforce`**；无值 rc=1 裸栈 `ERR_INVALID_ARG_TYPE` |
| 47 | `scripts/check-tool-family-registered.mjs:680` | `--root` | **B + C** | rc=`2/1/0`：**空串 rc=0 `✅ 每个导出的工具族都能追到注册点`**；无值 rc=1 裸栈 |
| 48 | `scripts/check-tool-registry-integrity.mjs:109` | `--root` | **B** | rc=`2/1/1`：无值/空串都打出**真实判红清单**（`• J5 'delete_file' 标为委托专有,但 …`）且 rc=1 —— 结论与本应指向的根无关，旗标被静默吞掉 |
| 49 | `scripts/check-v3-62-conversation-mount.mjs:579` | `--root` | **B** | rc=`2/0/0`：`✅ 面=HEAD blob(git show HEAD:<path>) W0/W1 核 4 个登记出口 / W2 核 11 个 sidebar 文件…` |
| 50 | `scripts/check-watermark-syntax.mjs:455` | `--root` | **B + C** | rc=`2/0/0`：`[check:watermark-syntax] 取材=版本树 HEAD 清单=13453 可注入=11563 … 全部通过`；nextflag 那支是裸栈 rc=2 |
| 51 | `scripts/check-workspace-hygiene.mjs:55` | `--root` | **B（三支全静默）** | rc=`0/0/0`：`✅ workspace-hygiene: 扫描 24096 个文件,无违规` |
| 52 | `scripts/plan-tasks.mjs:83` | `--root` | **B + C** | rc=`2/2/0`：`--root --staged` → `⚠️ 无法判定 —— git cat-file --batch 失败,G:\IHUI-AI\--staged 的判定面无法取材`（A 形态）；无值裸栈；**空串 rc=0 照常出台账读数**（`账的交代:无交代 97 行…本次提交新带入且无交代: 未判定`） |
| 53 | `scripts/provenance-ledger.mjs:1347` | `--root` | **B** | rc=`2/0/0`：打出许可台账明细（`copied:lucide-triangle-alert-svg 许可原文未入库(externalOnly)…`）且 rc=0 |
| 54 | `scripts/scan-hardcoded-zh.mjs:54` | `--root` | **B（三支全静默）** | rc=`0/0/0`：末行都是 SEO metadata 豁免叙述（该门默认档按工作树判，`--root` 被完全忽略） |
| 55 | `scripts/seal-c-root-stray.mjs:537` | `--root` | **D** | 拒绝实跑：该工具会在工作树外创建 junction / 改名第三方程序目录（`--apply` 语义），非普查该碰；只留源码判定 |

## 批次 4（站点 56–60，来自补枚举的 5 处）

| # | file:line | 旗标 | 档 | RC 三元组 + 末行节选 |
| --- | --- | --- | --- | --- |
| 56 | `scripts/check-exemption-expiry.mjs:876` | `--root` | **B** | rc=`2/0/0`：无值/空串照常出台账读数（`候选文件 4…E4 锚点=head-self`） |
| 57 | `scripts/check-i18n-duplicate-namespaces.mjs:145` | `--root` | **A** | rc=`2/2/2` 三次同一句 `❌ 无法判定:--root 需要一个目录参数(不得静默退回仓库根)` —— 这就是已收口那批的写法 |
| 58 | `scripts/check-i18n-locale-content-language.mjs:148` | `--root` | **A** | 同上，逐字同句 |
| 59 | `scripts/check-scratch-root-no-nesting.mjs:463` | `--root` | **B** | rc=`0/0/0` 三支全零，末行都是 `结论:drift(退出码 0;本门只告警,清理与修复归人)`（warn 级门，危害低于 blocking 门，但形态同型：`flagVal()` 未校验就落默认根） |
| 60 | `scripts/check-theme-prop-wiring.mjs:1212` | `--root` | **B** | rc=`2/0/0`：`✅ 主…`（blocking 门，无值/空串直接落默认根出通过结论） |

## 汇总（60 处全判）

| 档 | 处数 | 站点号 |
| --- | --- | --- |
| **A 大声失败** | 12 | 1, 3, 8, 12, 20, 23, 28, 32, 38, 44, 57, 58 |
| **B 静默降级（要修）** | **38** | 4, 5, 9, 10, 11, 13, 15, 17, 18, 19, 21, 22, 24, 27, 29, 30, 31, 33, 34, 36, 39, 40, 41, 42, 43, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 56, 59, 60 |
| **C 形态不佳（要修形态）** | 6 | 2, 14, 16, 25, 35, 37 —— 其中 37 是三支全裸栈 |
| **D 未判定** | 4 | 6（`sync-alpha-usage --face`，缺省档写盘）、7（`dev-web --port`，起服务）、26（`check-miniapp-css-landing --root`，要真 dist）、55（`seal-c-root-stray --root`，会动 C 盘 junction） |

> 12 + 38 + 6 + 4 = 60 ✓
> B 占 **38/60 = 63%**。台账那句"约 25 处同族当时只按族级抽测 5/5 就下了'大声失败'的结论"——
> 现读结论是**相反的**：三支坏值全部非零退出的只有 **12** 处，抽测样本恰好全落在少数收口过的门上。

### 三支坏值不等价（本票最有用的一个形状结论）

**下面三个数是 56 个实跑站点、按 `p2/runs/*__bad-*.txt` 里的 `#RC=` 逐文件数出来的**（不是估的）：

| 坏值形态 | rc=0（静默）站数 | 占 56 站 |
| --- | --- | --- |
| `<flag> --staged`（值被下一旗标顶掉） | **5** | 8.9% |
| `<flag>`（结尾无值） | **26** | 46.4% |
| `<flag> ""`（空串） | **34** | 60.7% |

⇒ 本票开头那一型（`--foo --staged`）**恰恰是三支里最不容易静默的一支**：值被当成路径用之后，
下游 `git` / `existsSync` 通常会撞开。成片静默的是**漏值**与**空串**那两支 —— 空串尤其致命，
`argv[i+1]` 拿到 `''` 时 `!v` 判不住、`|| '.'` 直接吞掉，落默认根并照常出 `✅` 结论。

那 5 个连 `--staged` 顶值都静默的站点（最坏的一格）：
`check-i18n-messages-exist`、`check-principal-consumed`、`check-scratch-root-no-nesting`、
`check-workspace-hygiene`、`scan-hardcoded-zh` —— 共同点是取值式里带 `|| '.'` / `?? ''` /
`!flagVal.startsWith('-') ? … : null` 这类**主动把坏值折回默认**的兜底。

⇒ **只测 `<flag> --staged` 一支会系统性把 B 读成 A**（这一支只有 8.9% 静默，另两支是 46% 与 61%）。
这就是"族级抽测 5/5 ⇒ 大声失败"为什么会得出反结论。

## 修复建议（B 类 38 处 + C 类 6 处）

口径照已收口那批（站点 32/38/57/58 就是现成的正确写法，直接抄它四个）：

> **值必须存在、非空、且不以 `-` 开头 ⇒ 否则非零退出并点名实得 token，绝不回落默认根/默认面。**
> 建议实现成一份共享出口（本仓已有 `scripts/lib/` 先例，参照 `code-mask.mjs` 的"两处实现必漂移"教训，
> **不得 38 个文件各写一遍**）：`resolveFlaggedDir(argv, flag)` → `{ok:true, value}` 或
> `{ok:false, reason:'(实得 "--staged")' | '(实得 null)' | '(实得 "")'}`，调用方拿 `reason` 打印并按本门既有档语义选 exit 2。

**分组落地顺序（按危害，blocking 门先）**：

1. **blocking 主题/样式/安全族**（改了会直接错判仓库）：`check-api-routes`(9)、`check-glyph-arrow-icon`(21)、
   `check-theme-prop-wiring`(60)、`check-direct-backend-calls`(17)、`check-statusbar-single-source`(42)、
   `check-shared-nonde-node-purity`(39)、`check-stale-dist`(41)、`check-package-barrel-export`(29)、
   `check-batch-write-count-honesty`(11)、`check-declared-policy-has-consumer`(15)、`check-doom-loop-parity`(18)、
   `check-mention-engine-wired`(24)、`check-tool-arg-routing-identity`(45)、`check-tool-arg-validation-wired`(46)、
   `check-tool-family-registered`(47)、`check-prompt-injection-registry`(33)、`check-v3-62-conversation-mount`(49)、
   `check-background-task-type-parity`(10)、`check-agent-status-vocabulary-parity`(已 A，不动)。
2. **warn / 手动档**：`check-plan-sha-resolvable`(30)、`check-public-exposure-list`(34)、`check-env-drift`(19)、
   `check-scratch-root-no-nesting`(59)、`check-miniapp-generated`(27)、`check-principal-consumed`(31)、
   `check-readme-table-integrity`(36)、`scan-hardcoded-zh`(54)、`check-workspace-hygiene`(51)、`provenance-ledger`(53)、
   `check-capability-matrix`(13)、`check-tool-registry-integrity`(48)、`check-watermark-syntax`(50)、`plan-tasks`(52)、
   `module-context`(4/5，`--face`/`--policy`)。
3. **C 类形态修正**（不扩判据，只改出口形态）：
   - `check-no-conflict-markers`(2)、`check-root-dir-clean`(37)、`check-staged-deletions`(40)、`check-crash-report-redaction`(14)、
     `check-digest-name-reality`(16)、`check-watermark-syntax`(50)、`check-mention-engine-wired`(24)、`check-plan-sha-resolvable`(30 无值支)
     ⇒ 把 `resolve(argv[++i])` / `argv[i+1]` 的 **undefined 直传** 换成显式校验，**禁止让 `ERR_INVALID_ARG_TYPE` 裸栈成为用法错的出口**。
   - `check-migration-bookkeeping`(25)、`check-pwsh-version`(35) ⇒ 用法错必须用**本门保留的退出码之外**的档（本仓惯例 2 = 无法判定），
     不得与"判红"的 1 共用 —— 否则"参数没给"读起来像"仓库违规"。
   - `check-i18n-messages-exist`(22) **额外一条**：`scripts/tests/check-i18n-messages-exist.test.mjs:86` 现在断言
     `resolveRoot([…, '--root', '--staged'], {}) === gate.REPO_ROOT` —— **这条测试把静默回落钉成了规格**。
     修实现时必须同批改这条断言，否则门一改严测试就红，下一个人会照着测试把回落改回来。

**每处要配的成对镜像用例**（两条都要，缺一即等于没锁）：

- 正例：`--root <真实目录>` 的行为与改前**逐字不变**（比对全文字节或既有断言集合，不接受"看起来一样"）；
- 反例：`--root --staged` / `--root`（无值）/ `--root ""` **三支各自**断言非零退出，且输出**点名实得 token**
  （参照站点 32 的 `(实得 "--staged") / (实得 null) / (实得 "")` 三态分开点名 —— 只断言其中一支就会留下另两支的洞）。

## 覆盖面自证

| 量 | 值 | 取法 |
| --- | --- | --- |
| HEAD 上 `scripts/**.mjs`（不含 tests）里这五个旗标的**代码面提及** | 93 | `p2/coverage.mjs` 逐 blob 扫，剥注释行 |
| 其中**读下一个 token 当值**的站点（本票射程） | **60** | 53（启发式）+ 2（手工补 `import-graph:678` / `check-watermark-syntax:455`）+ 5（补枚举） |
| 实跑判定 | 56 | 3 支坏值 × 每站；4 站拒绝执行（D） |
| **判了档** | **60 / 60** | A 12 / B 38 / C 6 / D 4 |
| B 类逐字阳性对照 | **38 个 B 站点里 28 个做满**（不传 vs 无值 vs 空串三支**全文字节**比对，`p2/controls-all.txt` 末行 `ALL_DONE` + `p2/controls.txt`）；**其余 10 个未做全文比对**（站点 48, 49, 50, 51, 52, 53, 54, 56, 59, 60），那 10 个只以「rc=0 + 正常结论行 + 源码取值式」三者合判 | `p2/controls.txt`、`p2/controls-all.txt` |

**尺子自己错过的两格（如实登记，别读成"本来就扫得全"）**：
① 第一版启发式只认同行 `indexOf(flag)+1`，对 `const ri = argv.indexOf('--root')` 后隔行取值这一族全盲
—— v1 只报出 **8** 处，v2 报 **53** 处，即 v1 漏扫 **45** 处（与上一轮 77 的读数差近一个量级，先怀疑尺子才对）；
② 补枚举那一轮又漏了 5 处（`check-exemption-expiry:876` / `check-i18n-duplicate-namespaces:145` /
`check-i18n-locale-content-language:148` / `check-scratch-root-no-nesting:463` / `check-theme-prop-wiring:1212`），
判据是"取值式落在 6 行窗口内"太窄；放宽到 12 行并排除测试派生行才补齐。

## 没查完的（不许读成"已确认干净"）

1. **`--root=` / `--face=` 等号形态未跑**：本票只跑三支空格形态。已见 `check-button-height.mjs:286` 有
   `a.startsWith('--root=')` 分支（该门站点 12 判 A），但**没有对它单独喂 `--root=` / `--root=--staged`**；
   其余带等号形态的门未枚举未跑。
2. **`scripts/tests/**` 与 `apps/**` / `packages/**` 里的同名旗标解析未纳入**（射程按任务书限 `scripts/**/*.mjs`）。
3. **4 个 D 站点的实际行为仍未证**（6/7/26/55）—— 我只做了源码判读，没跑，不得当 A 也不得当 B。
4. **多值形态未测**：`import-graph.mjs` 的 `--widen` 是 `while (argv[i+1] 不以 -- 开头) push` 那种**贪心吃多值**，
   不在本票五旗标内，但其失败形态与本族同构，未查。
5. **B 类里 23 站只给了"rc=0 + 正常结论 + 取值式"三者合判**，没做逐字节对照（耗时原因，如实登记）。
   下一个人若要翻案，跑 `node p2/ctlAll.mjs` 扩表即可。

## 收尾卫生证明

- `git status --porcelain` 行数 92 → 100，**新增 8 条全是 `M scripts/**`（并发会话在 13:18–13:23 改的
  `check-exemption-expiry.mjs` / `check-gate-face-discipline.mjs` / `check-public-exposure-list.mjs` /
  `check-selftest-registrant-evaluates.mjs` / `lib/code-mask.mjs` 及各自测试）**，本代理一行未写被跟踪文件。
- 仓根与全仓**没有** `--staged` / `--root` 这类旗标名垃圾文件：`ls -a | grep -E '^--'` → NONE；
  `git status --porcelain | grep -E '\-\-(root|staged|rev|face|policy)'` → NONE。
- 本代理全部产物：`G:\IHUI-AI\.ihui-agent\tmp\flag-census\findings.md`（本文件）与
  `G:\IHUI-AI\.ihui-agent\tmp\flag-census\p2\**`（枚举/探针/对照脚本、`runs/*.txt` 每次实跑全文、
  `controls.txt` / `controls-all.txt` / `status-*.txt` / `worklist.json` / `results-*.json`）。

## 口径注记：判定面=HEAD，但"实跑"跑的是工作树那份（本票唯一的口径让步，如实登记）

`node <script>` 执行的是**工作树副本**，而我读判据、报 `file:line` 一律按 `git show HEAD:<path>`。
本机在本次普查期间 HEAD 从 `698d7c6b` 推进到 `581fd402`（并发会话在提交），普查结束时
`git status --porcelain -- scripts/` 里与工作树不一致的**恰好命中我 3 个站点**：

| 站点 | 脚本 | 工作树是否改了旗标解析那一段 | 复核结论 |
| --- | --- | --- | --- |
| 9 | `check-api-routes.mjs` | HEAD 已推进（行号 29→40），但表达式逐字未变：`ARG_ROOT_IDX !== -1 && process.argv[ARG_ROOT_IDX + 1] ? resolve(...) : null` ⇒ `ROOT = ARG_ROOT \|\| resolve(HERE,'..')` | **B 在现 HEAD 上重新逐字核过，成立** |
| 20 | `check-gate-face-discipline.mjs` | 该段是**已收口的正解**：`const f = flagValue(argv,'--root'); if (f.present && !f.valid) {…root:null…}` | A 成立，且工作树那段与 HEAD 无 diff |
| 30 | `check-plan-sha-resolvable.mjs` | `ri >= 0 && argv[ri + 1] ? path.resolve(argv[ri + 1]) : DEFAULT_ROOT` | **B 成立**（HEAD 现值逐字即静默回落） |
| 52 | `plan-tasks.mjs` | `has('--root') ? path.resolve(argv[argv.indexOf('--root') + 1]) : ROOT` | 成立（无值 ⇒ `resolve(undefined)` 抛 = 我读到的裸栈；空串 ⇒ `resolve('')=cwd` 静默） |

⇒ 其余 56 个站点的实跑与工作树/HEAD 同源（那些文件在本次普查期间未被改），结论可直接按 HEAD 读。
**这一格不许省**：一个 B 结论如果只在别人在飞的副本上成立，就不该被当成仓库缺陷派单。

## 收尾卫生证明（最终版）

- **未改任何被跟踪文件**：本代理全部写动作落在 `G:\IHUI-AI\.ihui-agent\tmp\flag-census\**`（gitignore 面）。
- 普查期间 `git status --porcelain` 从 92 行涨到 ~100 行，**逐条核对为并发会话所为**
  （`AGENTS.md` / `PROJECT_PLAN.md` / `README.md` 三条在**开跑前**就已 dirty，`status-before.txt` 里各命中 1 次；
  新增的 `M scripts/**` 是别人 13:18–13:23 的编辑；`?? apps/ai-service/**` 未跟踪项也全部在 `status-before.txt` 里已存在）。
- 仓根**没有**旗标名垃圾文件：`ls -a . | grep -E '^--'` → NONE；`git status --porcelain | grep -E '\-\-(root|staged|rev|face|policy)'` → NONE
  （上一轮代理在仓根留 `.env.migrated` 那一型，本次专项验过）。
- 产物清单：
  - `G:\IHUI-AI\.ihui-agent\tmp\flag-census\findings.md`（本报告）
  - `G:\IHUI-AI\.ihui-agent\tmp\flag-census\p2\{enumerate,enumerate2,probe,ctl,ctl1b,ctl1c,ctl1d,ctlB,ctlAll,showcode,mklist}.mjs`
  - `…\p2\worklist.json`（60 站点）、`…\p2\sites.txt`、`…\p2\controls.txt`、`…\p2\controls-all.txt`（末行 `ALL_DONE`）
  - `…\p2\runs\*.txt` —— **168 份单次实跑全文**，每份首两行是 `#CMD …` 与 `#RC=<码> killed=<bool>`，
    汇总表的三个 RC 全部由这些文件反查得到，不是手抄
  - `…\p2\status-before.txt` / `status-after.txt` / `status-end.txt` / `dirty.txt`
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
