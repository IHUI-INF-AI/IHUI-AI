<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md 2026-10-21 裁剪移出原文(守门 207 体积预算)

> 出处:HEAD `aba3074862128dc0a28ffcbcf42d8fa0d0a12f72` 的 AGENTS.md(搬出前 100134 字节,预算 96,000,判红超额 4134)。
> 按 §1 两步归档:下列各段逐字移出,原位置由同文保留版承接或并入既有 HTML 指针注记(不新增注记行)。
> 被移出的内容不是失效内容,只是重复登记副本与定档留痕;规则条款一字未减。

1. 「文档体积对账(207)」旧档原文(原第 347 行,已被同区「〔定档更正@2026-10-14〕」行取代)

- **文档体积对账(207** **`check-agents-doc-size.mjs`,warn 起步)**:AGENTS.md 逐字注入每一轮对话,预算 50KB(出处 = `check-project-plan-size.mjs` 头注的 2026-07-19 档,不得另拍新数);超预算的唯一出路 = 按 §1 两步归档把守门历史/取证叙述/重复登记副本整区移入 `.ihui-agent/archive/`,原位置留指针注记。**升 blocking 的前置 = HEAD 面存量归零(§12e),现在还没到 —— 定级以 runner 注册条目现值为准,门体头注与注册条目必须同值**。

2. 「常驻工具(非守门)」旧版清单(原第 371 行;经核验为第 397 行新版的严格子集,由同文保留版承接)

- 常驻工具(非守门,勿因"不在 runner"当没装车): `watermark.mjs` `guardian-runner.mjs` `safe-commit.mjs` `git-guardian.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `heal-worktree-tracked.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `git-lock.mjs` `deploy-lock.mjs` `union-converge.mjs` `merge-live-doc.mjs` `live-doc-edit.mjs` `object-space-land.mjs` `gate-registry-insert.mjs` `plan-tasks.mjs` `plan-tasks-merge.mjs` `plan-pointer-purge.mjs` `plan-task-index.mjs` `plan-line-age.mjs` `bypass-git.mjs` `face-reader.mjs` `code-mask.mjs` `scratch-dir.mjs` `key-dir.mjs` `secret-path.mjs` `seal-c-root-stray.mjs` `scrub-temp-fixtures.mjs` `c-disk-breakdown.mjs` `plan-union-merge.mjs` `run-evidence.mjs` `visible-window-probe.mjs` `install-console-window-hook.mjs` `commit-gate-attribution.mjs` `plan-bypass-ledger-report.mjs` `alert-volume-report.mjs` `provenance-ledger.mjs` `module-context.mjs` `notify-deploy-failure.ts`

3. 门 193〔补登@2026-10-18 input↔stdin 取值维〕游离重复副本(原第 395 行;同文另一枚在位)

  〔补登@2026-10-18,原句"只判属性名不判取值"按当次实现更正,原句逐字保留在上行只作改判留痕〕同一枚门 193 现另判 **input↔stdin 取值维**:同一 options 里带 `input` 而 stdin 首元素不是 `'pipe'` ⇒ 判红(实测 10/10:`hash-object --stdin` 读到空 stdin 不报错、安静产出 0 字节空 blob,那串"看着像 sha"曾把 1.67MB 的 lock 落进 main);取值取不到字面量 ⇒ 判不出、既不记绿也不冒红;该维按 §12e 走差值棘轮(锚点=该文件 HEAD 面自身命中数,存量只报数,`--strict` 才问责)。

4. 「重复登记副本」指针注记长段副本(原第 402 行;规则条款由第 38 行压缩版承接)

- **「重复登记副本」指针注记:存量已清零,今后一条也不许再产生(2026-10-13 立,用户指令"彻底根治";2026-10-19 压缩,两行逐字原文移入** **`.ihui-agent/tmp/plan-pointer-purge-2026-10-19-agents-dup-pointer.md`,规则条款一字未减)**:`〔【归并】重复登记副本…〕`、`**[归并]**`、`（【归并】…）` 等注记形态曾把计划文档堆到 1963 条勾选行里 1137 条是副本指针(其中 1074 条是渲染不可见的登记行注记),已由 `node scripts/plan-pointer-purge.mjs --apply` 一次性清偿并**对象空间落地**(`715d495a9b5`,从不写工作树;落地前四条守恒断言 + 门 203 同源自校验必须全绿:L1 同题外部持有行删除 879 / L2 指纹族内归并 345 / L3 纯指针 1 / L4 剥注记保留 163 / 认领标记转移 5,台账见归档目录)。**守住清偿成果的是两道互不可替的门**:① **守门 13d**(`scripts/check-plan-dup-pointer-ratchet.mjs`,pre-commit blocking,差值棘轮只拦「本次提交让登记行注记变多」;全量档判 **HEAD 真相面**而非工作树——工作树副本滞后 HEAD 且含他人在飞编辑,按它判就是 §12e 禁的恒红门)② **门 71 的归档豁免射程**(`check-plan-line-loss.mjs` 的 `ARCHIVE_FILE_RE`,纳入清偿台账 `plan-pointer-purge-*.md`)。**为什么 ② 不可省**:门 71 自愈回捞器走 `commit-tree`+CAS **旁路落地,pre-commit 钩子结构性不跑** ⇒ 13d(只在提交时跑)永远拦不到它(实测对打两轮:清偿删 40 条 ⇒ 回捞器原样还原 40 ⇒ 清偿成果永远守不住);射程放宽**只扩文件名**,豁免的实体条件(被删行逐字原文在已入库归档 blob 里找得到)一字未松,`archivedCopy` 仍按面读 blob 不退回磁盘 readdir,不在台账里的真删照旧判丢。⇒ 教训:**旁路落地的机器(回捞器/自愈/落地循环)不跑钩子,任何只活在 pre-commit 的门对它一律无效,防它必须在它自己的判据源头接。** 回潮实测到三条通道,逐条都得有器物:① *推送*——对象空间 CAS 不跑 post-commit ⇒ 自动推送腿不触发 ⇒ origin 仍持有被删行,故清偿器落地后必须自带 `git-push-guard.mjs`;② *判据输入集*——守恒断言的输入若依赖它要消的形态就会自锁,两侧必须同基准归一化;③ *活文档行级 union*——按整行字符串比份数认不出对侧改写过的行,正解是补回前按**复合主键**再问一次清偿台账,兜底已装车在旁路落地自愈源头 `lib/post-merge-ledger-sync.mjs` 第二步(存量>0 才派生 `plan-pointer-purge --apply`)。**分族键指纹优先**(与门 203 的 `extractTaskFingerprint` 同源,按复合主键分族实测 139 键撞车:不同票号抄同一段正文,剥掉注记后露出同一副指纹)。**登记一件事只有一个入口规矩**:同主键的新登记必须翻勾旧行或就地改写(§1 的机器闸已在),不要给旧行贴指针注记——计划文档不是"标注了指针"的清单,是"只剩一份活账"的清单;指针注记既不删除也不派单,只是把同一个错抄了两遍。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
