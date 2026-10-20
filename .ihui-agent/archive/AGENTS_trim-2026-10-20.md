<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md 2026-10-20 裁剪移出原文(守门 207 体积预算)

> 出处:HEAD `be4b175e6641c41cf3936d87aeb365dcb4243859` 的 AGENTS.md(裁剪前 100,842 字节,预算 96,000)。
> 守门 207 判红后按 §1 两步归档:下列各段逐字移出,原位置留一句指针注记或由同文保留版承接。
> 被移出的内容不是失效内容,只是重复登记副本与守门历史叙述;规则条款由压缩版承接,信息未删。

## 1. 「重复登记副本」指针注记 —— 2026-10-13 立版(原第 37 行)

- **「重复登记副本」指针注记:存量已清零,今后一条也不许再产生(2026-10-13 立,用户指令"彻底根治")**:`〔【归并】重复登记副本…〕`、`**[归并]**`、`（【归并】…）` 等注记形态曾把计划文档堆到 1963 条勾选行里 1137 条是副本指针(其中 1074 条是渲染不可见的登记行注记)。现已由 `node scripts/plan-pointer-purge.mjs --apply` 一次性清偿并**对象空间落地**(`715d495a9b5`,从不写工作树;落地前四条守恒断言 + 门 203 同源自校验必须全绿:L1 同题外部持有行删除 879 / L2 指纹族内归并 345 / L3 纯指针 1 / L4 剥注记保留 163 / 认领标记转移 5,台账 `.ihui-agent/archive/plan-pointer-purge-2026-10-13.md`)。守住清偿成果的是**两道互不可替**的门(2026-10-14 补正:首版只登记了 13d,当天实测它单独守不住):① **守门 13d**(`scripts/check-plan-dup-pointer-ratchet.mjs`,pre-commit blocking,差值棘轮:只拦"本次提交让登记行注记变多";全量档判 **HEAD 真相面**而非工作树 —— 工作树副本滞后 HEAD 且含他人在飞编辑,按它判就是 §12e 禁的恒红门)。② **门 71 的归档豁免射程**(`check-plan-line-loss.mjs` 的 `ARCHIVE_FILE_RE`,纳入清偿台账 `plan-pointer-purge-*.md`):为什么 ② 不可省 —— 门 71 自愈回捞器走 `commit-tree`+CAS **旁路落地,pre-commit 钩子结构性不跑** ⇒ 13d(只在提交时跑)永远拦不到它;实测对打两轮:清偿删 40 条(`7826f3b0741`)⇒ 门 71 把正当移除读成"被并发旧基线抹掉"原样回捞(`2560d82194`/`6e8d2e089e` 各还原 40)⇒ 清偿成果永远守不住。射程放宽**只扩文件名**,豁免的实体条件(被删行逐字原文在已入库归档 blob 里找得到)一字未松,`archivedCopy` 仍按面读 blob 不退回磁盘 readdir;不在台账里的真删照旧判丢(镜像测试 `check-plan-line-loss.test.mjs` 的「射程锁」双向钉住)。⇒ 教训:**旁路落地的机器(回捞器/自愈/落地循环)不跑钩子,任何只活在 pre-commit 的门对它一律无效,防它必须在它自己的判据源头接。****分族键指纹优先**(与门 203 的 `extractTaskFingerprint` 同源,首版按复合主键分族实测 139 键撞车:不同票号抄同一段正文,剥掉注记后露出同一副指纹,清偿自己成了新一批同题多号)。**登记一件事只有一个入口规矩**:同主键的新登记必须翻勾旧行或就地改写(§1 第 22 行的机器闸已在),不要给旧行贴指针注记 —— 计划文档不是"标注了指针"的清单,是"只剩一份活账"的清单;指针注记既不删除也不派单,只是把同一个错抄了两遍。

## 2. 「重复登记副本」指针注记 —— 2026-10-13/14 收口版(原第 38 行)

- **「重复登记副本」指针注记存量已清零、今后一条也不许再产生**(2026-10-13/14 收口,10-14 二次实测补因):自动档已停产指针注记(F4/F10 只报数);守门 13d 差值棘轮拦注记变多、全量档绝对零容忍;门 71 归档豁免射程已纳入清偿台账——**旁路落地(回捞器/自愈)不跑钩子,防它必须在判据源头接**。**回潮实测到三条通道,逐条都得有器物**:①*推送*——对象空间 CAS 不跑 post-commit ⇒ 自动推送腿不触发 ⇒ origin 仍持有被删行,故清偿器落地后必须自带 `git-push-guard.mjs`(2026-10-14 实测 11:48 清偿 350 → 13:45 带回 1699);②*判据输入集*——守恒断言的输入若依赖它要消的形态就会自锁(`foldTwins` 排除带注记行,而清偿正在剥注记 ⇒ "重复第一次被看见"读成"本轮造出重复"、整批拒落),两侧必须同基准归一化;③*活文档行级 union*——按整行字符串比份数,认不出"对侧改写过而本侧已按台账清掉"的行(实测 21:42 本侧 0 → 21:44 合并带回 9),正解是补回前按**复合主键**再问一次清偿台账,归在册票 G-32;兜底已装车在旁路落地自愈源头 `lib/post-merge-ledger-sync.mjs` 第二步(存量>0 才派生 `plan-pointer-purge --apply`,0 条一次都不派生),归并侧那半格仍未收口。分族键指纹优先(与门 203 同源),不要按复合主键分族。 〔2026-10-15 摘除 2 份并发带回的旧副本,被摘行逐字进 `.ihui-agent/archive/AGENTS_dedup-removed-2026-10-15.md`(照本仓 AGENTS_dedup-removed-* 惯例:删副本不删证据)〕

## 3. `check-monitor-runtime-parity.mjs` 段落重复副本(原第 374 / 376 行,两份逐字相同)

- `check-monitor-runtime-parity.mjs`(2026-10-18 立,票 G-584 同族;镜像测试 `scripts/tests/check-monitor-runtime-parity.test.mjs`):monitoring 运行副本(`D:\DevEnv\monitor`,nssm 原生)↔ 仓内 `monitoring/` 真相逐对同形对账(alertmanager/promtail/grafana.ini/loki 四对 + ai-service `.env` 结构键 COMBO_CHAINS/_\_URL/__PORT,值绝不落输出);三态分桶 同形/差异/未判定,配对清单 <4 枚即 exit 2 空转点名。**不挂提交链也不挂巡检轮**:它判"这台机盘上当下是什么",非生产机上运行副本根本不存在,挂链即 §12e 恒红门;且**差异 ≠ 错**(原生端口/路径改写合法),结论只是差异清单,判红权归人,器物零写入零同步。

> 同文保留在现 AGENTS.md 的 `check-monitor-runtime-parity.mjs` 段落(仅 `COMBO_CHAINS/*_URL/*_PORT` 的转义写法更正的版本)。

## 4. Rust/MSVC 构建环境注入 —— 旧例数版(原第 391 行,尾注 33 例)

- **Rust/MSVC 构建环境注入(2026-10-19 立,§0.8 的实测反面教材)**:本机 `C:\Program Files\Git\usr\bin` **在系统 PATH 内**且带 GNU coreutils 的 `link.exe`,而 `apps/desktop/src-tauri/.cargo/config.toml` 的 `linker = "link.exe"` 是**裸名按 PATH 解析** ⇒ 未加载 MSVC 的 shell 里 Rust 链接阶段报 `link: missing operand after '\377\376'`,**报错里一个字都不提工具链**。全仓此前零处加载 MSVC(§5b 旧口诀"cargo 在 PATH 即可"是真out路的一半,已订正)。**唯一真相源** `scripts/lib/msvc-env.mjs`(纯判据,自身零 IO;`vswhere` 本机返回 `[]` 故必须带已知安装位兜底;PATH 键大小写不敏感只留一份;剔 `<Git>\usr\bin` 段并把 MSVC bin 前插),入口薄壳 `scripts/desktop-build.mjs`(`--debug`/`--dev`/`--no-artifact-check`/`-- <透传>`;**取不到工具链 ⇒ 显式「未判定」exit 2,绝不静默回落裸 env**;收敛钩子目录随档位走,debug 档不许去判 release 目录)。已接线:`apps/desktop/package.json` 的 `build`/`build:debug`/`dev`/`dev:cdp`、`scripts/desktop-build-saas.mjs`、`scripts/desktop-dev-saas.mjs`、`scripts/release-desktop-local.mjs`;**裸跑 `tauri build`/`tauri dev`/`cargo build` 仍不注入**(须自行加载 vcvars)。`scripts/start-dev.ps1` 只做只读诊断并按"desktop 实际怎么被拉起"分档报(经 wrapper ⇒ info,裸 tauri ⇒ warn)。取证 `scripts/tests/desktop-build.test.mjs`(33 例)。

> 更新后的同段(尾注 38 例)保留在现 AGENTS.md。

## 2026-10-20 体积门二次修剪:旧版「常驻工具」行

以下行从 AGENTS.md 逐字移出;保留版在现 AGENTS.md 的「常驻工具」段(含 desktop-build.mjs / msvc-env.mjs / desktop-unsigned-config.mjs 三枚追加)。

- - 常驻工具(非守门,勿因"不在 runner"当没装车): `watermark.mjs` `guardian-runner.mjs` `safe-commit.mjs` `git-guardian.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `heal-worktree-tracked.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `git-lock.mjs` `deploy-lock.mjs` `union-converge.mjs` `merge-live-doc.mjs` `live-doc-edit.mjs` `object-space-land.mjs` `gate-registry-insert.mjs` `plan-tasks.mjs` `plan-tasks-merge.mjs` `plan-pointer-purge.mjs` `plan-task-index.mjs` `plan-line-age.mjs` `bypass-git.mjs` `face-reader.mjs` `code-mask.mjs` `scratch-dir.mjs` `key-dir.mjs` `secret-path.mjs` `seal-c-root-stray.mjs` `scrub-temp-fixtures.mjs` `c-disk-breakdown.mjs` `plan-union-merge.mjs` `run-evidence.mjs` `visible-window-probe.mjs` `install-console-window-hook.mjs` `commit-gate-attribution.mjs` `plan-bypass-ledger-report.mjs` `alert-volume-report.mjs` `provenance-ledger.mjs` `module-context.mjs` `notify-deploy-failure.ts`
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
