<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-->

# AGENTS.md 重复登记副本清偿归档(2026-10-25)

- 立因:守门 207(check-agents-doc-size.mjs,blocking,预算 96,000)现读 HEAD 面超标。
- 本件逐字收「守门脚本速查(压缩索引)」区里 2026-10-23 压批后由滞后副本回潮的重复登记条目与同目历史指针注释。
- 择保规则:族内默认保留正文区(§0–§29)现行版;速查版更新的 8 族按特征标记保留
  (侧车交代 P1 版、git 网络含 .husky/pre-rebase 硬拦版、计划/台账含 check-plan-archive-monotonic(239) 版、
  API 含 check-public-admin-default(G-875)版、只读尺子含 check-index-unmerged-age(10-24)版、
  UI/样式含 check-cross-end-screen-coverage 版、check:all 三态版、横向口径详版)。
- **门名点名零损失**:上列独有门名全在保留行;跑 `node scripts/check-gate-wiring.mjs --strict` 现读 R4=0 才算数。
- 原行号按 AGENTS.md 母本(HEAD ${'{'}基线 {'}'})记录于各条标题。

---

### 原 L35(保留者=现 L36) 「- **新登记必须有交代**:一条 `- [ ]` 要么带租约、要么写明在等什么」

```text
- **新登记必须有交代**:一条 `- [ ]` 要么带租约、要么写明在等什么、要么带新鲜日期;三样皆无 = 无交代,提交链差值棘轮只拦本次带进来的(守门 130 F7/F8)。
```

### 原 L120(保留者=现 L436) 「- **git 网络与推送**:同步一律 `git fetch <remote>」

```text
- **git 网络与推送**:同步一律 `git fetch <remote> main` + `git merge --ff-only FETCH_HEAD`,**禁止 `git pull --rebase`**。**agent 禁止手写 `git push`**:origin 由 post-commit `git-push-guard.mjs` 自动异步推送(ahead 检测+后台 worker+回读验证,状态 `.ihui-agent/state/push-state.json`);Gitee/GitCode 由 `mirror-to-cn.yml` CI 镜像,本地手推 = 违反架构。收尾核验只跑 `node scripts/git-push-converge.mjs`(只读六态);遇 non-FF 跑 `node scripts/git-sync-converge.mjs`(索引层合并,零触碰他人未提交文件),禁止手工 fetch/merge/push 循环。
```

### 原 L171(保留者=现 L426) 「- `pnpm check:all` = `scripts/all-checks」

```text
- `pnpm check:all` = `scripts/all-checks-runner.mjs`(27 条子步骤,跑完再汇总、不短路)+ `pnpm check:dep-links:strict`;末条(第 27 条)是 `check:benchmark-delivery`(票 G-217 补接,此前造好未装车 = 没有)。**它的牙只有两态**:`--strict` 下"判不出"或"台账腐烂(docAnchor 找不到/重复登记)"⇒ exit 2 并把 `check:all` 顶红;而"仍存在(文档与代码脱节)"只打印、**不顶红** ⇒ 它不是文档↔代码一致性的合格证,别那么读。
```

### 原 L374(保留者=现 L437) 「- 计划/台账: `check-plan-dup-pointer-ratchet」

```text
- 计划/台账: `check-plan-dup-pointer-ratchet.mjs` `check-plan-sha-resolvable.mjs` `check-plan-sha-form.mjs` `check-baseline-freshness.mjs` `check-agents-doc-size.mjs` `check-plan-id-pool.mjs` `check-plan-closed-stock.mjs` `check-plan-claims-vs-head.mjs` `check-live-doc-archive-reinflation.mjs`(门体已造、尚未纳入 runner 注册表) `check-task-claims.mjs` `check-plan-fields.mjs` `check-sweeper-liveness.mjs`(2026-10-23 立:清扫背离巡检只读探针——派发在动 ∧ 留痕静默 >2h ∧ 可清存量 >0 ⇒ 器物空转;不走提交链,派发层 = git-guardian 的 `auditSweeperLiveness`)
```

### 原 L379(保留者=现 L438) 「- API/后端/DB: `check-credential-leak-in-m」

```text
- API/后端/DB: `check-credential-leak-in-message.mjs` `check-egress-ip-drift.mjs` `check-credential-presence-bypass.mjs` `check-principal-consumed.mjs` `check-public-exposure-list.mjs` `check-capability-field-not-client-supplied.mjs` `check-authorization-column-isolation.mjs` `check-migration-immutable.mjs` `check-db-blind-updatedat-set.mjs` `check-sequence-lag.mjs` `check-error-code-not-text-matching.mjs` `check-error-attribution-single-source.mjs` `check-error-message-bounded.mjs` `check-inbound-schema-strict.mjs` `check-nested-additional-properties.mjs` `check-enum-default-widening.mjs` `check-enum-fallback-terminal.mjs` `check-txn-cancel-boundary.mjs` `check-dockerfile-copy-paths.mjs` `check-edu-arrears-single-source.mjs` `check-sse-frame-watermark.mjs` `check-python-import-landed.mjs` `check-python-import-resolvable.mjs` `check-mode-permission-matrix.mjs` `check-subagent-permission-inherited.mjs` `check-csrf-exemption-shape.mjs` `check-batch-write-count-honesty.mjs` `check-prod-bundle-shadow.mjs` `check-env-drift.mjs`
```

### 原 L381(保留者=现 L435) 「- 只读尺子/派生器/核验器(不在 runner,不进提交链,也不进守护巡检轮)」

```text
- 只读尺子/派生器/核验器(不在 runner,不进提交链,也不进守护巡检轮): `check-temp-landing.mjs` `check-dispatch-premise.mjs` `check-alertmanager-live-config.mjs` `check-monitor-runtime-parity.mjs` `check-tunnel-leg-health.mjs` `check-prod-checkout-foreign-work.mjs`(git-guardian 巡检轮派生,`--json` 只判不修;未跟踪洪水只计数不判定) `verify-panel-data.mjs` `verify-panel-logql.mjs` `verify-grafana-panel-data.mjs` `verify-grafana-logql-panels.mjs` `sync-panel-live-provisioning.mjs` `sync-grafana-live-provisioning.mjs`(仓内 provisioning 是唯一真相 ⇒ 派生到部署机运行副本,连不上的源不写入并点名原因;幂等 + `pre-sync-backups/` 退路;`--check` 零副作用;大屏核验五档 有数/全零/空板/失败/未判定,全零 ≠ 空板,不许接提交门) `strip-stale-closed-rows.mjs` `strip-stale-claim-marks.mjs` `env-backfill-model-keys.mjs` `quarantine-disk-root-strays.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `heal-worktree-tracked.mjs` `sync-lost-commit-tags.mjs`
```

### 原 L384(保留者=现 L10) 「历史指针」

```text
<!-- 「重复登记副本」指针注记的两版历史原文与三批搬出史(2026-10-13/14/21)已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23b.md;规则条款以本节压缩版为准。 -->
```

### 原 L386(保留者=现 L10) 「历史指针」

```text
<!-- 「认领即租约」速查区旧口径副本(含 2026-10-22 三口径漂移取证叙述)已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23b.md(同文亦见同目录 -23.md);规则本体见 §1。 -->
```

### 原 L387(保留者=现 L10) 「历史指针」

```text
> 旧口径副本已归档：见 `.ihui-agent/archive/AGENTS_trim-2026-10-21b.md`「完成即删要有器物（副本；其中 --apply 为旧值「每 30 分钟」，现行值见 AGENTS.md §1 同题条目）」。
```

### 原 L390(保留者=现 L10) 「历史指针」

```text
<!-- 2026-10-14/10-21 两次压缩的历史叙述与 git 历史取回指引已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23b.md;本文与归档原文冲突时以本文为准(见文件头注)。 -->
```

### 原 L391(保留者=现 L10) 「历史指针」

```text
<!-- 「完成即删要有器物」旧副本(--apply 每 30 分钟派发,已失效)、「worktree/索引自愈」旧副本(无删除意图账)、「认领即租约」两版副本(旧口径与 10-23 合并版)、「完成即删要有器物(10-23 补齐留痕与节拍)」合并副本已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23b.md;规则本体见 §1 与 §5b。 -->
```

### 原 L392(保留者=现 L10) 「历史指针」

```text
<!-- 「计划/台账」索引与「常驻工具」清单的重复登记副本(与上方现行两行同名集一致,仅次序不同)已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23b.md。 -->
```

### 原 L393(保留者=现 L10) 「历史指针」

```text
> 本次(2026-10-23)逐字移出的 11 行重复登记副本、6 行改写原行,以及收敛期由对侧滞后副本带回的旧口径指针行,见 `.ihui-agent/archive/AGENTS_trim-2026-10-23.md`;更早批次见同目录 `AGENTS_trim-2026-10-21b.md` / `-10-21.md` / `-10-20.md`。规则条款以本文为唯一面。
```

### 原 L394(保留者=现 L10) 「历史指针」

```text
<!-- 2026-10-23 收敛期由对侧滞后副本带回的 18 行重复登记副本(§1/§4/§5/§12/§15/§22 各规则本体的漂移旧版)已整区逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23b.md;规则条款以各编号节本体为准。 -->
```

### 原 L395(保留者=现 L10) 「历史指针」

```text
<!-- 历次压缩批逐字移出的副本与旧版原文见 `.ihui-agent/archive/AGENTS_trim-2026-10-20.md` / `.ihui-agent/archive/AGENTS_trim-2026-10-21.md` / `.ihui-agent/archive/AGENTS_trim-2026-10-21b.md` / `.ihui-agent/archive/AGENTS_trim-2026-10-23.md`(含门 89/常驻工具/索引/API 行的重复副本、门 193/出口台账/deprecated-source/Rust-MSVC/chcp/--dev 的已取代旧版);规则条款以本文为唯一面。 -->
```

### 原 L396(保留者=现 L10) 「历史指针」

```text
> 2026-10-23 各压缩批的全部被删副本与被改原行,逐字在 `.ihui-agent/archive/AGENTS_trim-2026-10-23.md`(枚数现读该文件,不在本文写死);更早批次见同目录 `.ihui-agent/archive/AGENTS_trim-2026-10-21b.md` / `.ihui-agent/archive/AGENTS_trim-2026-10-21.md` / `.ihui-agent/archive/AGENTS_trim-2026-10-20.md`。规则条款以本文为唯一面。
```

### 原 L397(保留者=现 L10) 「历史指针」

```text
> **本文件为 2026-10-14 / 2026-10-21 两次压缩版**:规则条款全部保留;被压掉的历史原文**不在工作树** —— 2026-10-16 `7a77c44d86c` 已清除 `.ihui-agent/archive/` 全部存料(本节原引的三份归档,只有第一份曾存在过,且不在原登记的那个 sha 里)。要查时从 git 历史取:`git show 3017301fd0b:.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`(实测 1,262,819 字节;原登记 `c7834a8f0388` / 1,261,607 字节均不成立)、二次压缩前原文 `git show 6efeeadc20c^:AGENTS.md`。本文与历史原文冲突时以本文为准;本文未写的历史案例按上述历史面查 —— 不再有独立的 archive 副本可翻。
```

### 原 L398(保留者=现 L30) 「- **认领即租约**:开始任务在 `- [ ]` 后追加 `（进行中@YYYY」

```text
- **认领即租约**:开始任务在 `- [ ]` 后追加 `（进行中@YYYY-MM-DD/持有者短名）`,三要素齐备才算认领(裸 `（进行中）` 自 2026-10-22 定档起新增即拦 = CL4,HEAD 已欠着的只报数;年龄 >72h 判红 = CL1;守门 109 四档同用 HEAD 存量棘轮,只拦本次带进来的);完成翻勾并摘牌。**提交链上的门绝不代摘任何人的认领**,超龄牌由兜底器物 `scripts/strip-stale-claim-marks.mjs` 代摘(派发层 `sweepStaleClaimMarks` 每 5 分钟;判据 import 守门 109 的 `claimMarkOf`+`resolveTtlHours`,本层零复算;只摘「完整租约 ∧ 超龄」——在飞席位会续租,天然落在射程外;裸标记由器物默认代摘,依据是同批 CL4 已在提交链拦住新增、而器物只读 HEAD 面)。落地走 `object-space-land` 并把旧形态逐行写进 `LAND_CLASH_SCOPE.removed` ⇒ 活文档行 union 不得再从对侧取回这一型;机主原话写进留痕条目 `ruling`(`IHUI_CLAIM_STRIP_LEGACY_RULING="<原话>"`),行内只留 `#seq` 指针;原牌/持有者/超龄量/摘除前后整行/基线与落地 sha 逐条落仓外留痕 `.ihui-agent/state/stale-claim-strip.jsonl`(90 天窗口老化,被裁条数必报,取不到判未判定)——可追责的真相源是留痕 + 提交信息,不是台账行。**护栏只认"本批旧形态行被别席就地改写"**:工作树副本常年不净不构成整批让路(取材面是 HEAD、落地有行级复活守卫、滞后回潮由 `scrub-declared-removals` 与 `union-converge` 的 `declaredDropCaps` 兜);让路只让被改写那几枚,行走 `planSweep` 的 `skipLines` 移入 held 并在结论行补 `deferred=`;副本读不到 ⇒ 仍让路。接线锁 `scripts/tests/strip-stale-claim-marks.test.mjs`(含原 `planFaceClean` 已退役的形状锁)。派单前先扫进行中项:`node scripts/check-task-claims.mjs`。**挂牌判据单源 = `scripts/lib/plan-task-index.mjs` 的 `claimMarkOf`**(① 复选框后可带空白、② 带 `@日期/持有者` 的完整租约形写在行尾也算、③ 反引号码段内的裸标记属叙述不算)。
```

### 原 L399(保留者=现 L34) 「- **未带指针而整行逐字节相同的未勾登记行,唯一合法摘除通道 = `node 」

```text
- **未带指针而整行逐字节相同的未勾登记行,唯一合法摘除通道 = `node scripts/plan-tasks-merge.mjs --fold-identical-open-rows [--commit]`**:同文两份在派单清单里是两行 ⇒ 两个会话各领同一张票;该档把多重集折到 1,**不加任何注记**(机主 2026-10-13 明令),断言为「claimable 一枚不动 ∧ F4+F4b 副本计数恰好减去删除份数 ∧ 注记枚数不增」,任一不过即整批不落。同题不同号而正文已漂开的副本**不归它**(机器折半即有损,交人工),带指针的那一族仍走 `--dedupe-open-rows`;两面旗同给当场 exit 2。
```

### 原 L400(保留者=现 L36) 「- **新登记必须有交代**:一条 `- [ ]` 要么带租约、要么写明在等什么」

```text
- **新登记必须有交代**:一条 `- [ ]` 要么带租约、要么写明在等什么、要么带新鲜日期;三样皆无 = 无交代,提交链差值棘轮只拦本次带进来的(守门 130 F7/F8)。**结构化侧车记录是第四种交代**:侧车 = `scripts/data/plan-fields.jsonl`(键 = 编号 + 标题前缀逐字),写它只有 `node scripts/plan-fields-extract.mjs --apply` 一条出口(只搬说辞、一个台账行都不改;抽取前后每行归属桶零变化才放行);行内 `〔归:…｜等:…〕` 标头是**投影**、人不手写,渲染与对账唯一实现 = `scripts/lib/plan-field-line.mjs`,机读判据 = `scripts/check-plan-fields.mjs`(blocking,只挂差值维:新增未勾行缺侧车 / 标头≠投影才红,存量只报数,§12e)。整行改写必须过的三维守恒(勾选态 ∧ 认领租约 ∧ 归属桶)实现位置 = `scripts/lib/plan-row-conservation.mjs`,调用方 import 它,不接受口头保证。
```

### 原 L402(保留者=现 L39) 「- **归档机制(2026-10-16 退役,此行为留痕)**:现行口径见上面「」

```text
- **归档机制(2026-10-16 退役,此行为留痕)**:现行口径见上面「完成即删」——翻勾后整行删除,不留档、不归档、不写占位注释。旧那套两步走连同它的三件器物(自动归档器、13c 那道门、根 package.json 的 archive 脚本位)已全部从仓里移除,现读 `git ls-files | grep -c archive-completed-tasks` = 0、`node scripts/check-gate-wiring.mjs --strict` 的 R10 零缺口 ⇒ **不得再照旧文去跑那些命令**(§0.8);历史残余见 `backup/archive-removal-2026-10-16` tag。防误删防线:未勾登记行照旧受守门 71 保护(已勾行不进保护集,删之合法);删行自由不豁免其他守门(130/203/71 未勾半照常判)。
```

### 原 L405(保留者=现 L46) 「- **自动档写活文档的硬规矩**:底稿一律取被审面(`git show HEA」

```text
- **自动档写活文档的硬规矩**:底稿一律取被审面(`git show HEAD:<文档>` / `scripts/lib/face-reader.mjs`),落盘走对象空间(临时索引 + `commit-tree` + CAS,不写工作树);落地前自证"父提交里每条 `[x]` 复合主键本次仍为 `[x]`",不成立拒绝落地。**改写整行时还必须断言 `dispositionOf`(归他人/等条件/等拍板/可做)、`claimMarkOf`(租约)、`keyOfRow`(主键) 三维逐行不变,任一变了就整行还原**——压行会切掉中段的归属句子 ⇒ 别人持有的票变成可领的票,而当时门全绿也照样错:账面要现读,不能只看守门 RC。
```

### 原 L409(保留者=现 L132) 「- **上游工具生成物不进水印覆盖面**(唯一出口 `scripts/data/」

```text
- **上游工具生成物不进水印覆盖面**(唯一出口 `scripts/data/watermark-tool-generated.json` + 判据 `scripts/lib/tool-generated-roots.mjs`):免的是"必须带载荷"这一项,**不免前提** —— 三条缺一不生效:① 路径落在登记 root 前缀内(逐字节比);② 该文件在**被审面**上自述为工具产物(命中 markerRegex);③ `expires` 未到期。不自述 ⇒ 回到覆盖面按缺载荷判红;台账形状坏 ⇒ 水印层拒绝判定(既不冒绿也不冒红)。接线点在 `watermark.mjs` 的 `scanCoverage` 且**必须在 total++ 之前**(与第三方 excluded 同层,否则覆盖率会被读成暴跌),`list-uncovered` / `check-watermark-coverage` / CI 那一步自动继承。这一档不是行内豁免族,**不进守门 108 的族表**,存活期逐条写在台账里。典型现场:`apps/desktop/src-tauri/permissions/autogenerated/*.toml` 由 tauri 的 Rust build script 每枚重建,inject 进去的载荷会被下一次构建洗掉 ⇒ 按现状判红就是恒红门(§12e)。
```

### 原 L413(保留者=现 L229) 「- **15c 工作树内禁止嵌套 git 仓**(守门 208 `check-n」

```text
- **15c 工作树内禁止嵌套 git 仓**(守门 208 `check-no-nested-git.mjs`,blocking,`stagedTriggers: ['scripts/']` 把射程收到"能造出该状态的那一面";全量档一律跑):测试夹具在仓库内 `git init` 且无清理钩子,中断即永久残留演练仓,IDE 源代码管理把嵌套仓当独立仓库扫描,聚合出「暂存的更改 10000+(全 D)」幻影计数,而主仓命令行面自始至终干净。需要临时 git 仓的夹具一律走 `mkScratch()`(§15b,工作区外 + 进程退出自动回收)。射程外只有一格:扫根直属一层的 `.worktrees/`(§12d 规定的 worktree 检出落点,linked worktree 天然带 `.git` gitfile,判红就是逼所有人不开 worktree 的恒红门);同名目录出现在更深位置照旧命中。同一仓**已注册的** linked worktree 不再靠落点位置豁免,改由门按 `gitfile⇄admin 面双向核验`分流并逐条打印(悬空 gitfile / 回指伪造 / 指向他仓 admin / worktree 内再长出 `git init` 夹具 —— 四种照旧红,镜像 ⑦ 钉死)。另设第二把载体 `scripts/data/no-nested-git-sites.jsonl`:每处一行、只记意图与归属/到期,**存续由门在判的那一刻现算**,失去命中只 ⚠ 不清红(镜像 ⑨⑩ 钉住"未命中免不了任何东西、到期不免、坏行零免")。`entryBudget` 属只增不减覆盖面:被顶穿即恒 `truncated` = 恒红(§12e)。
```

### 原 L414(保留者=现 L230) 「- **15d 盘根写入回归锁**(守门 213 `check-disk-roo」

```text
- **15d 盘根写入回归锁**(守门 213 `check-disk-root-write.mjs`,blocking,无 stagedTriggers=任何提交都跑):扫描仓库代码里“往磁盘根(D:/G:/C: 一级,即项目树与 DevEnv 之外)写文件/建目录”的模式,对**本次提交新增**的判红(差值棘轮,锚点 = 该文件 HEAD 自身 W1 数;存量只报数,§12e)。与 15b 的**盘上**卫生 `check-disk-root-hygiene.mjs` 互补——那道守“盘上别留垃圾”,本门守“代码别再产新的”。收窄集 = literal 首段 ∈ `{IHUI-AI, DevEnv}`(§15b 批准落点,精确匹配非前缀)不立 W1;已知合法生产者走豁免台账 `scripts/data/disk-root-write-exemptions.json`(`{file, reason, ticket, until}`,到期回队列重裁)。影子工具 `scripts/quarantine-disk-root-strays.mjs`(只读预演,未接自愈链)。应急 `HUSKY_SKIP_DISK_ROOT_WRITE=1`(不推荐)。
```

### 原 L415(保留者=现 L265) 「- 守门 30a `check-commit-loss-guard.mjs`(b」

```text
- 守门 30a `check-commit-loss-guard.mjs`(blocking):reflog 50 步 + 远端 tag 校验 + tag 可达性 + **悬空 commit 30 天窗维**(近 30 天内新产生且无 `lost-commit/*` 备份的悬空 commit 阻塞,须先 `git tag lost-commit/<name> <hash>` 再 commit;超窗只报数 = §29 人工 GC 存量;时刻读不到 ⇒ 保守算窗内照拦;`--window-days 0` 回全量语义,`--strict` 问责存量)。tag 自动同步 + 全命名空间一致性校验:`sync-lost-commit-tags.mjs`(`--check` 比名字 + SHA,覆盖全部命名空间;仅本地/同名 SHA 分歧/备份族仅远端 ⇒ exit 1,非备份族仅远端只告警;本脚本不在提交链注册表,post-commit 只跑 `--auto-push`);永久档案 `docs/lost-commit-archive.md`。
```

### 原 L416(保留者=现 L437) 「- 计划/台账: `check-plan-dup-pointer-ratchet」

```text
- 计划/台账: `check-plan-dup-pointer-ratchet.mjs` `check-plan-sha-resolvable.mjs` `check-plan-sha-form.mjs` `check-baseline-freshness.mjs` `check-agents-doc-size.mjs` `check-plan-id-pool.mjs` `check-plan-closed-stock.mjs` `check-plan-claims-vs-head.mjs` `check-live-doc-archive-reinflation.mjs`(门体已造、尚未纳入 runner 注册表) `check-task-claims.mjs` `check-sweeper-liveness.mjs`(2026-10-23 立:清扫背离巡检只读探针——派发在动 ∧ 留痕静默 >2h ∧ 可清存量 >0 ⇒ 器物空转;不走提交链,派发层 = git-guardian 的 `auditSweeperLiveness`) `check-plan-fields.mjs`
```

### 原 L418(保留者=现 L436) 「- **git 网络与推送**:同步一律 `git fetch <remote>」

```text
- **git 网络与推送**:同步一律 `git fetch <remote> main` + `git merge --ff-only FETCH_HEAD`,**禁止 `git pull --rebase`**。**agent 禁止手写 `git push`**:origin 由 post-commit `git-push-guard.mjs` 自动异步推送(ahead 检测+后台 worker+回读验证,状态 `.ihui-agent/state/push-state.json`)。**仓库只有 `origin` 一个远端**:国内代码镜像(Gitee/GitCode)与 `mirror-to-cn.yml` 作业已于 2026-10-23 整体弃用并删除,`git-guardian` / `git-rebuild-local` 也不再写回这两个远端;若见到 `gitee/*`、`gitcode/*` 远端或跟踪引用,那是弃用残留,**删掉而不是修**。收尾核验只跑 `node scripts/git-push-converge.mjs`(只读六态);遇 non-FF 跑 `node scripts/git-sync-converge.mjs`(索引层合并,零触碰他人未提交文件),禁止手工 fetch/merge/push 循环。
```

### 原 L419(保留者=现 L10) 「历史指针」

```text
<!-- 「重复登记副本指针注记存量已清零、今后一条也不许再产生」的完整收口叙述(2026-10-13/14/23 三次回潮取证与三条通道器物)已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23c.md;现行规则一句:自动档已停产指针注记,守门 13d 差值棘轮拦新增,回潮三通道器物见 plan-pointer-purge / lib/post-merge-ledger-sync.mjs / union-converge declaredDropCaps。 -->
```

### 原 L420(保留者=现 L10) 「历史指针」

```text
<!-- 「护栏③收窄」(strip-stale-claim-marks 只让路被别席改写那几枚、派发节流 5min)完整立条与实测已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23c.md;现行规则一句:护栏只认本批旧形态行被别席就地改写,工作树常年不净不构成整批让路;接线锁见 scripts/tests/strip-stale-claim-marks.test.mjs。 -->
```

### 原 L421(保留者=现 L370) 「- **守门接线层对账**(89):`scripts/check-gate-wi」

```text
- **守门接线层对账**(89):`scripts/check-gate-wiring.mjs`(blocking,跳过 `HUSKY_SKIP_GATE_WIRING=1`);R1/R2/R4/R5/R7/R8/R9/R13 判据详解与修法已归档 `.ihui-agent/archive/AGENTS_trim-2026-10-23c.md`。
```

### 原 L424(保留者=现 L10) 「历史指针」

```text
<!-- 速查区 12 条与 §0-§15 规则本体重复的登记副本 + 9 条历次 trim 历史注释/引用,已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23c.md(2026-10-23 守门 207 体积清偿;规则本体在上方各编号节,一字未动)。 -->
```

### 原 L429(保留者=现 L436) 「- **git 网络与推送**:同步一律 `git fetch <remote>」

```text
- **git 网络与推送**:同步一律 `git fetch <remote> main` + `git merge --ff-only FETCH_HEAD`,**禁止 `git pull --rebase`**。**agent 禁止手写 `git push`**:origin 由 post-commit `git-push-guard.mjs` 自动异步推送(ahead 检测+后台 worker+回读验证,状态 `.ihui-agent/state/push-state.json`);**仓库只有 `origin` 一个远端**:国内代码镜像(Gitee/GitCode)与 `mirror-to-cn.yml` 作业已于 2026-10-23 整体弃用并删除,见到残留远端或跟踪引用应删掉而不是修。收尾核验只跑 `node scripts/git-push-converge.mjs`(只读六态);遇 non-FF 跑 `node scripts/git-sync-converge.mjs`(索引层合并,零触碰他人未提交文件),禁止手工 fetch/merge/push 循环。
```

### 原 L434(保留者=现 L377) 「- UI/样式: `check-miniapp-taro-design-toke」

```text
- UI/样式: `check-miniapp-taro-design-tokens.mjs` `check-adapter-style-parity.mjs` `check-percent-clamp-single-source.mjs` `check-line-split-parity.mjs` `check-input-focus-feedback.mjs` `check-button-height.mjs` `check-glyph-arrow-icon.mjs` `check-no-divider.mjs` `check-no-mask-image.mjs` `check-no-native-dialog.mjs` `check-no-emoji-icons.mjs` `check-radius-single-source.mjs` `check-radius-role-conformance.mjs` `check-rounded-full.mjs` `check-statusbar-single-source.mjs` `check-cross-end-ui-parity.mjs` `check-miniapp-tokens-sync.mjs` `check-miniapp-taro-style-parity.mjs` `check-cross-end-tokens.mjs` `check-miniapp-css-landing.mjs`
```

