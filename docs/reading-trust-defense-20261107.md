<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 读准防线(Reading-Trust Defense)· 2026-11-07

> 目的:把今天反复出现的**同一类缺陷**做成能自动抓住的检查,让同类问题不再靠人肉发现。
> 范围:只新增元门与登记表,不改任何现有门脚本(`check-*.mjs` / `scripts/lib/*`);现有门的缺口
> 只报告、不代修。所有读数都是 2026-11-07 本机现跑所得,不是历史截图。

---

## 0. 病根一句话

**"取不到输入"被当成了"没有输入"** —— 门于是要么静默判绿(空集 ⇒ 零违规),要么误判死
(0 份文件 ⇒ 全部缺失),要么把数字算小(读失败的条目不计入)。今天它换了六张脸出现,
但根因只有一个:门对**取材面**没有任何"取数面不可用"的硬闸。

三面口径(本仓 `scripts/lib/gate-face.mjs` / `face-reader.mjs` 已实现):

| 面 | 读法 | spec 形态 |
|---|---|---|
| head | `HEAD` 树 | `HEAD:<path>` |
| staged | 索引(stage 0) | `:<path>` |
| worktree | 磁盘当前文件 | 直接读文件 |

**门里手拼 spec 是这一型事故的共同入口** —— 拼错一个冒号,git 报 "missing",门把 null 当
"没有",后面所有结论都建立在空输入上。

---

## 1. 失效模式分类(按失效模式,不按脚本)

### F1 面规格语法错 —— "拿不到"发生在最底层

- 形态:手拼 rev/spec 拼成 `::<path>`、`:!0:<path>`、裸路径、条件表达式前缀。
- 后果:取不到正文 ⇒ 门继续跑,把所有"读失败"当"文件不存在/无违规"。
- 今日事故:① `check-guarded-write-affected.mjs:360`(`staged: ':'` + `${rev}:${file}` ⇒ `::path`,
  1411 个文件全部取不到);② `check-generator-resource-release.mjs:702`
  (`` `${face === 'staged' ? '' : 'HEAD:'}${p}` `` ⇒ staged 面裸路径,12 个路径正文全取不到);
  ③ `check-readout-no-break.mjs:288`(`readAt(':!0', p)` ⇒ 非法 rev)。
- 对应元门:**A `scripts/check-face-spec-hardcode.mjs`**。
- 运行环节:CI(经 dispatcher)+ 手动;不进 pre-commit(当日已有四条线在 `scripts/` 并行,
  不再制造第五个共同修改点)。

### F2 空输入冒充空结论 —— "0 就是没有问题"

- 形态:枚举 `0` 个文件、读取 `0` 条正文、`for` 循环体一次都没进,直接产出 `violations: []`
  或"全部通过"。
- 后果:静默判绿(最危险),或把 0 份被审文档当成"内容全错"而判死。
- 今日事故:① 1411 文件全取不到但门从未真正判过;④ `check-rn-compat-coverage.mjs` 的
  `--staged` 整面 exit 2,C1–C10 从未判过;⑤ `check-live-doc-duplicates.mjs --staged`
  把被审文档枚举成 0 份 ⇒ 判死。
- 对应元门:**B `scripts/check-face-empty-guard-coverage.mjs`**(只读盘点)+ 可复用 helper
  `scripts/lib/face-empty-guard.mjs`(新门运行时硬闸)。
- 运行环节:CI 只报清单;人工审计用 `--strict`。**不替现有门改代码**,逐门修复由属主推进。

### F3 命令行/API 语义错 —— 参数位置、调用形态

- 形态:`git grep -l -E <pattern> --cached -- …`(`--cached` 落在 pattern 之后,被当成
  pathspec/revision)⇒ 整面 exit 2;`cat-file --batch` 传裸路径 ⇒ 被当对象名。
- 后果:与 F1 同——取不到 ⇒ 未判定被洗成结论。
- 今日事故:④ 的 `git grep` 参数位置。
- 对应检查:**没有专门的门能静态证明命令语义正确**(见 §5"抓不住");元门 A 只覆盖 rev/spec
  拼装,不覆盖参数位置;元门 B 只能在其后判"0 值有没有 exit 2"。这一类**需要人工判 + 事故
  回归测试**(`check-rn-compat-coverage.test.mjs` 的镜像用例)。

### F4 读数面错位 —— 用 A 面算的数去判 B 面

- 形态:工作树面重算生成物钉值/README 数字块,却拿它判索引面提交;同一份产物三面读数不同。
- 后果:门时红时绿;别人按索引面写好的块被覆盖。
- 今日事故:⑥ `safe-commit.mjs` Step 2b(worktree 面重算 README 数字块,与提交面不一致,
  门 173 连续 3 次判红);⑦ 派生件钉值面不一致(`ui-routes.generated.ts`、
  `remote-locales.gen.ts`)。
- 对应元门:**C `scripts/check-generated-pin-face.mjs`**(钉值按被审面现算;不一致时再用
  head/staged/worktree 三面重算,直接报"钉值按哪个面算的")。
- 运行环节:CI(默认 audit head)+ 手动(`--staged` / `--worktree`)。

### F5 闭包缩水 —— 读失败的条目被悄悄从分母里删掉

- 形态:逐文件读取失败被当成"文件不存在",于是"应有 1049 个文件"缩成"979 个也全过"。
- 后果:比例/分母算小,缺口被抹平。
- 今日事故:④ 的 C10(HEAD 面 979 vs 索引面 1049,同一棵树三面读数不一致)。
- 对应检查:元门 B **只能部分覆盖**(它要求 0 值有未判定出口,但无法证明"分母该有多少");
  **闭包正确性只能人工判**(见 §4)。
- 运行环节:人工 + 各门镜像测试。

### F6 worktree 链接指向主树 —— 测的是别人的代码图

- 形态:`<worktree>/node_modules/@ihui/*` 指向 `D:\IHUI-AI\packages\*`,`tsc`/单测读主树代码。
- 今日事故:⑧ `apps/web/node_modules/@ihui/rn-app` 在多棵树上指向主树。
- 对应检查:已有 `scripts/check-worktree-link-integrity.mjs`(本次**只加挂载点**,不改判据)
  + `fix-worktree-links.mjs`;开发流程写进 `docs/DEVELOPMENT.md §1.1`。
- 运行环节:CI(`.github/workflows/reading-trust-defense.yml`)+ 新建 worktree 后手动一次。

### F7 多线同改一门 —— 撞车后互相覆盖

- 形态:两条开发线同批修改同一道门,后提交者覆盖前者的修复。
- 今日背景:四条线在 `scripts/` 上并行。
- 对应检查:**`scripts/data/gate-owners.json`** + 元门 D
  `scripts/check-gate-owner-declaration.mjs`(改已登记属主的门,提交信息必须带
  `Gate-Owner: <属主>`;未登记属主的门只列清单,不强行填"公共")。
- 运行环节:CI(判 HEAD 提交)+ 人工补登记。

### F8 约束只存在于对话、机制缺省相反 —— "不许推"在机制上不可执行

- 形态:规则写在对话或文档里,而机制的缺省动作恰好相反。只要执行的人没读到那句话、或忘了设
  环境变量,缺省行为就替人做了那个被禁止的事 —— 约束在机制层面等于不存在。
- 今日真实证据(2026-11-07):
  - `.husky/post-commit` → `scripts/lib/post-commit-hook.js` 的缺省行为 = 只要
    `HUSKY_SKIP_PUSH !== '1'` 就自动调 `git-push-guard.mjs` 推送 ⇒ **缺省 = 推**;
  - 同机 `origin` = `ssh://git@ssh.github.com:443/IHUI-INF-AI/IHUI-AI.git`,不是硬约束要求的
    `https://github.com/IHUI-INF-AI/IHUI-AI.git`;
  - **一次默认行为 + 一个 SSH remote = 一次违规推送**,只差远端当时可达。本轮实测**没有推出去**
    (远端不可达:`.ihui-agent/state/hook-logs/post-commit-push-guard.log` 记
    `❌ 远端 origin/tmp/apk-fast-leg 不存在或取不到 ⇒ 本轮不推`),两枚提交留在本地。
    这是"事故恰好没发生",不是"约束被执行"。
- 对应检查(同轮补齐;**不改任何既有校验门**):`scripts/git-push-guard.mjs` 在推送前加两道
  **拒绝**闸,判据本体在 `scripts/lib/push-window-gate.mjs`(纯函数,可单测):
  1. **协议闸**:目标远端不是显式 `https://` 开头(`ssh://` / `git@`(scp-like) / `git://` /
     本地路径 / 取不到 URL)⇒ 拒绝,打印目标 URL 原文 + `违反 HTTPS 显式地址约束，本轮不推`,
     并说明正确写法是显式给 `https://github.com/IHUI-INF-AI/IHUI-AI.git`;
  2. **窗口闸**:没有显式 `PUSH_WINDOW=1` ⇒ 拒绝,打印
     `推送窗口未开启 ⇒ 本轮不推（提交已落地本地）`(缺省 / `'0'` / `'true'` 一律视为无窗口)。
  **缺省值 = 不推**;两道拒绝都走 `process.exit(1)`,绝不降级成 warning 后继续推。
- 阴性对照 / "把修复去掉必须报红":`node --test scripts/tests/push-window-gate.test.mjs`(9 条):
  `ssh://` ⇒ 拒、`https://` 但无 `PUSH_WINDOW` ⇒ 拒、`https://` + `PUSH_WINDOW=1` ⇒ 放行
  (本地 bare + `insteadOf` 测试桩,**不联网、不推真远端**)。另有装车锁:把
  `judgePushRemoteUrl(originUrl)` / `judgePushWindow(process.env)` 任一摘线即判红
  (本仓最高频失效型:判据在、门全绿、主流程没用它)。
- 运行环节:post-commit 自动路径(每次提交都会走到这两道闸);手动收尾同样受约束。
- 残余(如实记录,不在本轮射程):闸读的是 `git config --get remote.origin.url` **原文**;
  `url.<base>.insteadOf` 重写后的实际落点不在判据内(测试正是用这条重写做本地桩)。

---

## 2. 四道元门与挂载点

| 门 | 文件 | 判什么 | 运行环节 | 默认退出码 |
|---|---|---|---|---|
| A | `scripts/check-face-spec-hardcode.mjs` | 门脚本里手拼 rev/spec(6 类形态) | CI dispatcher / 手动 | 新增命中 ⇒ 1;存量只报 |
| B | `scripts/check-face-empty-guard-coverage.mjs` | 三面门的空输入保护盘点 | CI dispatcher(只报清单)/ 手动 `--strict` | 默认 0;`--strict` 缺保护 ⇒ 1 |
| C | `scripts/check-generated-pin-face.mjs` | 生成物 `inputsSha256` 是否等于**被审面**现算值 | CI dispatcher(audit head)/ 手动 staged | 面错位/陈旧 ⇒ 1;取不到 ⇒ 2 |
| D | `scripts/check-gate-owner-declaration.mjs` | 改已登记属主的门是否带 `Gate-Owner:` | CI dispatcher(判 HEAD)/ 手动 `--staged` | 缺声明 ⇒ 1;取不到 ⇒ 2 |
| 链接 | `scripts/check-worktree-link-integrity.mjs`(已有) | `node_modules/@ihui/*` 是否指向别树 | CI `--strict` + 新建 worktree 后手动 | 别树 ⇒ 1 |

统一入口:`node scripts/run-reading-trust-defense.mjs`。
CI:`[.github/workflows/reading-trust-defense.yml](../.github/workflows/reading-trust-defense.yml)`。

统一 helper(新门必须用,不要再抄一份):

- `scripts/lib/gate-face.mjs` 的 `readFaceBatch(root, face, rels)` —— 三面取材;
- `scripts/lib/face-empty-guard.mjs` 的 `assertFaceEnumeration` / `assertFaceRead` —— 0 值硬闸;
- `scripts/lib/face-spec-scan.mjs` —— 面规格静态识别(门与测试共用)。

---

## 3. 真实事故 ↔ 阴性对照 ↔ "把修复去掉必须报红"

| # | 今日事故(位置) | 抓它的门 | 阴性对照怎么造 | 去掉修复后怎么验证报红 |
|---|---|---|---|---|
| ① | `check-guarded-write-affected.mjs:360` `staged:':'` + `:356` `${rev}:${file}` | A | 测试夹具 `ACCIDENT_1`(常量即事故原写法) | `node --test scripts/tests/check-face-spec-hardcode.test.mjs`;把 `FACE_REV.staged` 改回 `':'` ⇒ `staged-colon-map` 命中 |
| ② | `check-generator-resource-release.mjs:702` 裸路径三元 | A | 夹具 `ACCIDENT_2` | 同上;把三元改回裸路径 ⇒ `bare-path-ternary` 命中 |
| ③ | `check-readout-no-break.mjs:288/322/414` `:!0` | A | 夹具 `ACCIDENT_3` / `ACCIDENT_3_REV` / `ACCIDENT_3_SHOW` | 改回 `readAt(':!0', p)` ⇒ `staged-bang-rev` 命中 |
| ①④⑤ | 0 份/0 条被当结论 | B + helper | `classifyFaceGateSource` 夹具:`if (files.length === 0) return { violations: [] }` | 把该夹具喂给分类 ⇒ `missing-guard`;运行时 `assertFaceEnumeration({count:0})` 必抛 |
| ④ | `git grep pattern --cached` 参数位置 | **无专门门(抓不住)** | 只能靠镜像测试 + 人工 | 见 §5:本组元门不覆盖命令参数语义 |
| ⑥ | `safe-commit.mjs` Step 2b 面错位 | **C 不覆盖 README 数字块**;门 173 与人判 | 人工对比 worktree/索引面生成块 | 见 §5:数字块没有钉,不能自动归属面 |
| ⑦ | 生成物钉值面不一致 | C | `judgeProduct`:钉按 worktree 算、审计 staged ⇒ `face-mismatch`,`pinnedBy=worktree` | 把被审面换成 worktree ⇒ 同一钉值变 `ok`(反向证明它真在判面) |
| ⑧ | worktree 链接指向主树 | 已有链接门 + 挂载 | 删除挂载 ⇒ 无人跑 = 回归不可见 | CI 新 workflow 里 `--strict` 一步即对照 |

> 口径:上表的"去掉修复必须报红"全部落在**新门的镜像测试**里,不依赖现场把别人正在改的门
> 改坏。只有 ④/⑥ 两类如实写"抓不住",没有伪造通过。

---

## 4. 现状读数(2026-11-07 本机现跑)

### 4.1 元门 A

```
面规格静态扫描:face=head 脚本=1124 存量=44 新增=0
```

- 44 条存量全部是"仍在树里的手拼 spec"。**事故 ①② 已指派修复,权威提交如下**(本线不动这两个文件):
  - `scripts/check-generator-resource-release.mjs:702`(裸路径三元)——权威修复 `1b7bd36f9c`
    (`faceBlobSpec()`:staged=`:` / head=`HEAD:`,files / absent / failures 三支分离);收口线正在取该文件字节。
  - `scripts/check-guarded-write-affected.mjs:360`(`staged: ':'`)——权威修复由另一条线导出 diff 后合并;
    本线只登记,不得自行改。
  事故 ③ 的生产路径已改用 `FACE_REV`,但同文件仍保留 `:!0` 镜像测试注入路径,一并如实登记:
  - `scripts/check-readout-and-timer-hygiene.mjs:278`(同类 `FACE_REV.staged=':'`)
  - `scripts/verify-wallboard-readout.mjs:178`(`` `${face === 'staged' ? ':!0' : 'HEAD'}:…` ``)
  - `scripts/check-readout-no-break.mjs`(镜像测试注入 `:!0`;生产路径已改为 `FACE_REV = { staged: ':', head: 'HEAD:' }`)
- **一次判据收紧(实测驱动)**:`staged-colon-map` 原正则会把"rev 值自带尾冒号"的正确形态
  (`{ staged: ':', head: 'HEAD:' }` 配 `${FACE_REV[face]}${path}`)误报成违规。已加 skip 谓词:
  同对象所有 rev 值都以 `:` 结尾 ⇒ 不报;留有单测(阳性对照:`rev 值自带尾冒号的映射不算违规`)。
  这条修正把 `check-readout-no-break.mjs` 从"新增违规"降级为不命中,但**没有放过**事故 1 的
  原始形态(`{ head: 'HEAD', staged: ':' }` 仍命中,阴性对照未动)。
- 存量登记在 `scripts/data/face-spec-hardcode-baseline.json`,**不是豁免**:修复责任在各自属主;
  本门默认只拦"新增",`--strict` 会把存量一起判红(用于人工审计)。

### 4.2 元门 B(只读盘点)

```
空输入保护盘点:face=head 扫描门=482 三面门=327 有保护=201 缺保护=78 无零值判定=8 无枚举=40
```

- 读数随 HEAD 变动:本次提交自带 4 道元门后,门总数 478 → 482、三面门 323 → 327、
  有保护 198 → 201。**缺保护仍是 78 道**,清单不因本线变绿而减少(本线不改别人的门)。
- 缺保护的 78 道门按字母序输出(前 10:`check-agent-engine-parity`、`check-alert-identity-volatility`、
  `check-allowed-diffs-expiry`、`check-api-credential-prefix`、`check-api-failure-throw`、
  `check-api-migration-completeness`、`check-api-route-uniqueness`、`check-architecture-policy`、
  `check-auth-handler-registration-parity`、`check-authorization-column-isolation` …)。
- 今日事故门的当前归类:
  - `check-guarded-write-affected.mjs` → guarded(已有 exit 2,但 F1 面规格仍是存量);
  - `check-generator-resource-release.mjs` → guarded(同上);
  - `check-readout-no-break.mjs` → no-enumeration(逐文件读取,0 值形态不在静态盘点射程内);
  - `check-rn-compat-coverage.mjs` → **missing-guard**(事故④同型:0 值邻域无 exit 2);
  - `check-live-doc-duplicates.mjs` → guarded(修复后)。
- 这份清单是**启发式盘点**,不是语义证明;`--strict` 只把 `missing-guard` 判红。

### 4.3 元门 C

```
派生件钉面一致性:被审面=head 带钉产物=7 一致=7 面错位=0 陈旧=0 未钉=0
派生件钉面一致性:被审面=worktree 带钉产物=7 一致=3 面错位=3 陈旧=1 未钉=0
  - apps/miniapp-taro/src/constants/ui-routes.generated.ts:钉值按(none)面,被审面是 worktree
  - apps/miniapp-taro/src/i18n/generated/remote-locale-manifest.gen.ts:pinnedBy=head,staged
  - apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts:pinnedBy=head,staged
  - apps/miniapp-taro/src/i18n/generated/zh-cn-pack.gen.ts:pinnedBy=head,staged
```

- HEAD 面 7/7 一致;**worktree 面的 4 条红正是"钉按 head/staged 算、工作树却是脏的"** ——
  即事故⑦同型。当前主树有大量他人在制脏面,所以 worktree 面红不代表判据坏,而是本门在
  正确指出"这棵树的工作树面与被审面不是同一份内容"。
- CI 固定 audit=head,不会被他人在制脏面影响。

### 4.4 元门 D + 登记表

```
门属主声明:commit:HEAD 改门=4 已声明=reading-trust-defense-2026-11-07 缺声明=0 未登记属主=0 登记表未覆盖=0
```

- `scripts/data/gate-owners.json`:门脚本 482 道,已登记属主 4 道(本线新增的 A/B/C/D),
  **未登记 478 道**,逐条 `owner: null`,没有批量填"公共"。
- 提交 `9124b8ae6b` 自带 `Gate-Owner: reading-trust-defense-2026-11-07` trailer ⇒ 4 道门全部对上账,
  这是本门第一次在真实提交上"改门 + 声明"走到 exit 0。
- 改**未登记属主**的门时本门只列清单(不判红)——今天的 `check-generator-resource-release`、
  `check-readout-no-break` 即属此类。**属主归属需人工裁决**,本线不替它们认领。

---

## 5. 只能人工判的情况(以及为什么)

1. **"0 是不是确实没有"的语义**。同一棵树在 HEAD 面没有某个新文件是合法的;在索引面
   有、HEAD 面没有也是合法的。门只能判"0 且未声明 ⇒ 未判定",**不能判声明是否属实**。
   所以 `emptyIsReal` 必须带 reason,最终仍由人复核。
2. **闭包正确性(事故④ 979 vs 1049)**。要知道"分母该有多少",必须理解 C10 的业务闭包
   定义(哪些路由/文案/平台组合应该被枚举)。静态门无法证明;只能由该门属主补镜像测试。
3. **命令参数/API 语义(事故④ `git grep --cached` 位置)**。静态文本判据在"参数顺序错误"
   上既容易误报又没有通用语法树支持;今天选择**不造一个判不准的门**,而是要求该门保留
   事故回归测试。
4. **属主归属(478 道未登记)**。属主是组织事实,不是代码事实;批量填"公共"等于取消登记,
   故只列清单等人裁决。
5. **提交信息里的"对应属主声明"是否诚实**。门只认 `Gate-Owner:` trailer 存在;**声明与
   实际改动是否匹配**(比如声明 A 却改了 B 的方案)是人的判断。
6. **README 数字块/散文数字**(事故⑥)。数字块由生成器产出,但没有 `inputsSha256` 钉;
   哪一面算的、散文是否同义,门 173 只能判"现读一致",面归属仍需人判。
7. **网络/权限故障 vs 代码缺陷**。`exit 2` 只说明"未判定";是 CI 网络、deploy key 限流
   还是真缺陷,必须人看日志。
8. **内容/平台差异裁决**(门 285/291 一类)。是否"真平台差异"取决于承载位置与产品意图,
   静态对账抓不到。

---

## 6. 已知盲区与需人类裁决(如实记录)

1. **R4(按机主 2026-11-07 裁决执行:补点名 + 同枚压缩,不改判据)**:
   `check-gate-wiring` 的 R4 = "五处权威接线点里已接线,但 AGENTS.md/README.md 通篇未点名" ⇒ 判红。
   本 workflow 直接写了 4 个门名(`node --test` 与步骤名),于是 A/B/C/D 与 worktree 链接门
   都被认成已接线,R4 曾报 5 枚红。处置 = **在 AGENTS.md「守门脚本速查」加一行点名这 5 枚门**,
   并在同一文件删等量以上冗余(两条历史「体积清偿留痕」注释、重复的 207 登记条、
   §12h-补 里与 §16/「git 网络与推送」重复的表述、空注释块);**判据与台账零改动**。
   读数见 §4;若补名后 R4 仍有红,如实保留并报读数,不为绿改判据。
2. **AGENTS.md 预算:已从 96,444 压到 95,935(−509 字节,≤96,000)**;压缩项均为
   历史留痕/重复登记/与已归档或已迁出内容重复的段落,规则条款未减少。
3. **事故 ①② 已指派修复,本线不动这两个文件**:`check-generator-resource-release.mjs` 的权威修复
   为 `1b7bd36f9c`(`faceBlobSpec()`,files / absent / failures 三支分离);`check-guarded-write-affected.mjs`
   由另一条线导出 diff 后合并。A 门只把这 44 条存量登记在册,修复责任在各自属主。
4. **pre-commit 未挂 A/B/C/D**:`scripts/lib/pre-commit-hook.js` 属禁止改动面;若后续要
   前移,应由该 hook 属主在一个独立提交里接 `run-reading-trust-defense.mjs`
   (建议先跑 A/B 的棘轮档,避免存量红阻断提交)。
5. **B 是启发式清单,不是语义证明**:78 条"缺保护"里必然有误判(例如 0 值在别处已被
   断言覆盖)。`--strict` 只用于人工审计,不建议直接设成 CI 阻断。

---

## 7. 新增文件与运行命令

```
docs/reading-trust-defense-20261107.md                    本文档(唯一正本)
scripts/lib/face-spec-scan.mjs                            面规格识别(唯一实现)
scripts/lib/face-empty-guard.mjs                          空输入硬闸 + 静态分类
scripts/lib/push-window-gate.mjs                          推送两道拒绝闸的判据(协议闸 / 窗口闸)
scripts/tests/push-window-gate.test.mjs                   两道闸的单测 + 装车锁
scripts/check-face-spec-hardcode.mjs                      元门 A
scripts/check-face-empty-guard-coverage.mjs               元门 B
scripts/check-generated-pin-face.mjs                      元门 C
scripts/check-gate-owner-declaration.mjs                  元门 D
scripts/data/face-spec-hardcode-baseline.json             A 的存量棘轮
scripts/data/gate-owners.json                             门属主登记表(478 道待裁决)
scripts/run-reading-trust-defense.mjs                     CI 统一调度入口
.github/workflows/reading-trust-defense.yml               CI 挂载(含 worktree 链接门)
scripts/tests/check-face-spec-hardcode.test.mjs           A 镜像测试(含阴性对照)
scripts/tests/check-face-empty-guard-coverage.test.mjs    B 镜像测试(含阴性对照)
scripts/tests/check-generated-pin-face.test.mjs           C 镜像测试(含阴性对照)
scripts/tests/check-gate-owner-declaration.test.mjs       D 镜像测试(含阴性对照)
docs/DEVELOPMENT.md §1.1                                  新建 worktree 后跑链接完整性门
```

```bash
node scripts/run-reading-trust-defense.mjs                 # 四门(A/B/C/D)
node scripts/check-face-spec-hardcode.mjs --strict         # A:含存量一起判红(人工审计)
node scripts/check-face-empty-guard-coverage.mjs --strict  # B:缺保护清单判红(人工审计)
node scripts/check-generated-pin-face.mjs --staged         # C:审计索引面
node scripts/check-gate-owner-declaration.mjs --staged --message-file=.git/COMMIT_EDITMSG
node scripts/check-worktree-link-integrity.mjs --strict    # 链接完整性
node --test scripts/tests/push-window-gate.test.mjs        # 推送两道拒绝闸(ssh/无窗口必拒)
node --test scripts/tests/check-face-spec-hardcode.test.mjs \
             scripts/tests/check-face-empty-guard-coverage.test.mjs \
             scripts/tests/check-generated-pin-face.test.mjs \
             scripts/tests/check-gate-owner-declaration.test.mjs
```

回滚:以上全部是**新增文件**;删除对应文件并移除 workflow 中 `reading-trust-defense` 一项即可,
不涉及任何现有门脚本或现有 CI 作业的修改。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
