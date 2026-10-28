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

---

## 5. 2026-10-21 第二批:尾部重复登记副本 51 行逐字移出(守门 207 体积对账)

> 出处:HEAD `fe1031d8df1` 的 AGENTS.md(搬出前 121652 字节,预算 96000,判红超额 25652)。
> 本批全部为"同文保留版已在文中"的重复副本或已取代旧版;唯一增量信息(R13 条款、`check-egress-ip-drift`、
> `desktop-build`/`msvc-env`/`desktop-unsigned-config` 三个常驻工具名、G-921 数据目录分家括注)已逐字并入保留行。
> 下列各行按原行号逐字保留(行号 = 搬出前面位)。

<!-- 原第 230 行 -->
- 守门 30a `check-commit-loss-guard.mjs`(blocking):reflog 50 步 + 远端 tag 校验 + tag 可达性 + **悬空 commit 30 天窗维**(2026-10-11 立:近 30 天内新产生且无 `lost-commit/*` 备份的悬空 commit 阻塞,须先 `git tag lost-commit/<name> <hash>` 再 commit;超窗只报数 = §29 人工 GC 存量;时刻读不到 ⇒ 保守算窗内照拦;`--window-days 0` 回全量语义,`--strict` 问责存量)。tag 自动同步:`sync-lost-commit-tags.mjs`;永久档案 `docs/lost-commit-archive.md`。
<!-- 原第 362 行 -->
- 守门 30a `check-commit-loss-guard.mjs`(blocking):reflog 50 步 + 远端 tag 校验 + tag 可达性 + **悬空 commit 30 天窗维**(2026-10-11 立:近 30 天内新产生且无 `lost-commit/*` 备份的悬空 commit 阻塞,须先 `git tag lost-commit/<name> <hash>` 再 commit;超窗只报数 = §29 人工 GC 存量;时刻读不到 ⇒ 保守算窗内照拦;`--window-days 0` 回全量语义,`--strict` 问责存量)。tag 自动同步 + 全命名空间一致性校验:`sync-lost-commit-tags.mjs`(2026-10-14 起 `--check` 比**名字 + SHA**、覆盖全部命名空间:仅本地 / 同名 SHA 分歧 / 备份族(`lost-commit/`、`backup/` 前缀加斜杠)仅远端 ⇒ exit 1,非备份族仅远端只告警——自治理仓 CI 持续造 `nightly-*`,判红即恒红门;本脚本不在提交链注册表,post-commit 只跑 `--auto-push`);永久档案 `docs/lost-commit-archive.md`。
<!-- 原第 363 行 -->
  - 聚焦反馈这一维(票 G-42 第①格,runner 条目 id 212,2026-10-15):描边的输入/选择控件必须对聚焦有反应,三端同一把尺子;存量按该文件 HEAD 自身棘轮只报数,取证窗只取元素自己的属性区。
<!-- 原第 376 行 -->
- **守门接线层对账**(89): `scripts/check-gate-wiring.mjs`(blocking)—— 全部守门的"装车检":**R1/R2** 头注或文档声称已接而五处权威点(`guardian-runner` ∪ `scripts/lib/pre-commit-hook.js` ∪ `.husky/*` ∪ 根 `package.json` ∪ `.github/workflows`+cert)零命中 ⇒ 拦;**R4** 已接线而 AGENTS.md/README.md 通篇未点名 ⇒ 拦(去后缀同名即算,文档面按 HEAD∪索引判,绝不读工作区);**R5** 同 id 登记两门 ⇒ 拦;**R7** dispatcher 依据文件不存在 ⇒ 拦;**R8** `stagedTriggers` 会让 `guardian-triggers.mjs` 当场抛错 ⇒ 拦;**R13** 一个注册对象里出现两个 `id:`/`script:` ⇒ 拦(2026-10-19 立:插号器少写一个 `},` 或字段平铺,后写字段覆盖前写,被吞的那道门从注册表**静默消失**,R5 看不见它——两个 id 各出现一次,只是同处一个 `{}`;实测门 224 曾整个嵌进门 225 的对象,门 225 从落地到发一条信都没跑过)。R3/R6/弱接线只报数。台账 `scripts/gate-wiring-allowlist.json` 只救 R3。
<!-- 原第 379 行 -->
- **所有开发工具全局缓存/临时目录必须指向 D 盘**(`D:\DevEnv\`,实测现值为准):`TEMP/TMP→D:\DevEnv\Temp`、`PNPM_HOME=D:\DevEnv\tools\pnpm`、npm/pip/uv cache、`GOPATH/GOMODCACHE/GOCACHE`、`PLAYWRIGHT_BROWSERS_PATH=D:\DevEnv\cache\playwright`;家目录工具态(`.cargo/.rustup/.m2/.cache/.codex/.trae*/.deepseek/.ollama/.ihui/com.ihui.desktop`(+ `com.ihui.desktop.dev`,G-921 起 dev 构建独立标识 ⇒ 数据目录分家,同受本节管辖) 等)一律 junction 改道到 `D:\DevEnv\cache\userhome\`,**改道机制定为 junction 不 env 优先**(硬编码读取方靠旧路径可解析;换机/重装后重跑)。
<!-- 原第 396 行 -->
- 常驻工具(非守门,勿因"不在 runner"当没装车): `watermark.mjs` `guardian-runner.mjs` `safe-commit.mjs` `git-guardian.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `heal-worktree-tracked.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `git-lock.mjs` `deploy-lock.mjs` `union-converge.mjs` `merge-live-doc.mjs` `live-doc-edit.mjs` `object-space-land.mjs` `gate-registry-insert.mjs` `plan-tasks.mjs` `plan-tasks-merge.mjs` `plan-pointer-purge.mjs` `plan-task-index.mjs` `plan-line-age.mjs` `bypass-git.mjs` `face-reader.mjs` `code-mask.mjs` `scratch-dir.mjs` `key-dir.mjs` `secret-path.mjs` `seal-c-root-stray.mjs` `scrub-temp-fixtures.mjs` `c-disk-breakdown.mjs` `plan-union-merge.mjs` `run-evidence.mjs` `visible-window-probe.mjs` `install-console-window-hook.mjs` `commit-gate-attribution.mjs` `plan-bypass-ledger-report.mjs` `alert-volume-report.mjs` `provenance-ledger.mjs` `module-context.mjs` `notify-deploy-failure.ts`
<!-- 原第 398 行 -->
- **未带指针而整行逐字节相同的未勾登记行,唯一合法摘除通道 =** **`node scripts/plan-tasks-merge.mjs --fold-identical-open-rows [--commit]`**(2026-10-16 立,承台账票「台账"同一件事的多份逐字相同待办"没有任何一条合法摘除通道」方向①):同文两份在派单清单里是两行 ⇒ 两个会话各领同一张票,这就是"打架重复做"的机器成因;该档把多重集折到 1,**不加任何注记**(机主 2026-10-13 明令),断言为「claimable 一枚不动 ∧ F4+F4b 副本计数恰好减去删除份数 ∧ 注记枚数不增」,任一不过即整批不落。同题不同号而正文已漂开的副本**不归它**(机器折半即有损,交人工),带指针的那一族仍走 `--dedupe-open-rows`;两面旗同给当场 exit 2。
<!-- 原第 400 行 -->
- 唯一真相源 `packages/design-tokens/src/radius.js`:`RADIUS_STEPS` = xs 2 / sm 4 / md 6 / lg 8 / xl 12 / 2xl 16(px);角色档 `RADIUS_ROLES` = tiny→xs / control→sm / chip→md / card→lg / panel→xl / hero→2xl,新增角色必须同笔有消费方。取用形态:web/Tailwind 用 `rounded-xs..2xl` 与 `var(--radius-*)`;RN 用 `rnRadius.<step>` / `rnRadiusFor.<角色>`;CSS 用 `var(--radius-*)`;**禁止** px/rpx 字面量、`rounded-[任意值]`、字符串形态 `borderRadius:'8px'`、本地 `*_RADIUS` 常量。SVG 内联写 `rx={rnRadius.xs}`;生成式 HTML/CSS 字符串用 `RADIUS_CSS_PX` 插值。**B6 引用** **`rnRadius`、`rnRadiusFor`、`RADIUS_CSS_PX`** **却未在本文件 import ⇒ 判红**(悬空标识符 typecheck 与 HEAD 门双盲)。真圆/胶囊靠量出来的形状不靠标记:半径一刀切 ≤2xl;胶囊判红三条件 = 盒形只取自身属性区 + 非正方盒 + 短边 ≥16px;细于 16px 的进度条/骨架/指示点只开队列不判。守门:`check-radius-single-source.mjs`(77)三判据 A 档位表对账 / B 端内取用 / C 覆盖面;`check-radius-role-conformance.mjs` 角色档;`check-rounded-full.mjs`(11)容器纯圆。
<!-- 原第 401 行 -->
- **单一色值源** `packages/design-tokens/src/styles/tokens.css`;各端副本(`app.css` 受管块、`mobile-rn/global.css`、`rn-tokens.ts`、`@theme` 注册区、theme.json/THEME\_CHROME)一律**派生态**:原位写回、幂等、禁止手改,由 `scripts/lib/design-token-blocks.mjs` 唯一取源 + `sync-miniapp-tokens.mjs`/`sync-miniapp-chrome.mjs` 等派生,挂 `TOKEN_SYNC_TARGETS` 自动写回;守门 36(`check-miniapp-tokens-sync.mjs`)核 `:root/.dark/@theme` 三面。改 token 只改源头 + 跑 sync。新增跨端档位顺序:tokens.css → sync → 门复核。
<!-- 原第 402 行 -->
- **结构与守护**:活 gitdir 形态按当次实测(本机 = 工作区内 `.git` 实体目录;`D:/IHUI-AI-git-repo` 与 `D:/IHUI-AI.git-backup-20260912` 是另一形态的遗留,禁止删除/清理)。守护 = `git-guardian.mjs`(daemon + 计划任务 `IHUI-AI git-guardian` 每 2 分钟),分层自愈 `指针→环境→HEAD→嵌套 ref→本地备份→远端`,破坏性覆盖前先归档到 `gitArchiveDir()`(现 `D:\DevEnv\backups\git\`),**手工抢修也不得把** **`.git*`** **归档 mv 到工作区根**。诊断:`node scripts/git-guardian.mjs --status|--check`;日志 `.workbuddy/git-guardian.log`(健康不写行)。
<!-- 原第 403 行 -->
- **嵌套 ref 存续**:`git update-ref` 对 depth ≥2 嵌套命名空间静默假成功;对齐 `origin/main` 唯一正解 = `git fetch origin main` → `node scripts/git-refs-heal.mjs`(FETCH\_HEAD 权威值固化 packed-refs);禁止手工 update-ref/松散直写 origin/main;禁止 `HUSKY_SKIP_COMMIT_LOSS_CHECK=1` 绕 30a。远端 stale 分支出路 = `git-refs-heal.mjs --refresh-remote`(fetch --prune 连期望清单一起摘)。
<!-- 原第 404 行 -->
- **git 网络与推送**:同步一律 `git fetch <remote> main` + `git merge --ff-only FETCH_HEAD`,**禁止** **`git pull --rebase`**。**agent 禁止手写** **`git push`**:origin 由 post-commit `git-push-guard.mjs` 自动异步推送(ahead 检测+后台 worker+回读验证,状态 `.workbuddy/push-state.json`);Gitee/GitCode 由 `mirror-to-cn.yml` CI 镜像,本地手推 = 违反架构。收尾核验只跑 `node scripts/git-push-converge.mjs`(只读六态);遇 non-FF 跑 `node scripts/git-sync-converge.mjs`(索引层合并,零触碰他人未提交文件),禁止手工 fetch/merge/push 循环。
<!-- 原第 405 行 -->
- **worktree/索引自愈**(`heal-worktree-tracked.mjs`,挂 guardian tick):①恢复被外部删除的跟踪文件(索引==HEAD ∧ HEAD 存在);②对齐幻影漂移(索引==HEAD ∧ 工作区==某祖先版本);③刷新落后索引(逐路径 update-index,绝不全局 reset);**MERGE\_HEAD 在 ⇒ 各写索引层整轮让路**。
<!-- 原第 406 行 -->
- **④落地欠回写层(2026-10-14 立,`alignLandingDebtIndex`,同挂** **`--align-drift`)**:`ALIGN_EXEMPT_PATHS` 把活文档从 ①②③ 整体绕行是**对的**(2026-10-12 那次"刷新索引 + 回写工作树"两层接力吃掉 19339 行台账),但旁路落地(`union-converge --apply` 用 commit-tree+CAS 只推进 HEAD)留下的那条**脏索引**从此无人负责——一次不带 pathspec 的提交会把合并成果写回旧态,而 `git merge --ff-only` 被它挡下 ⇒ 停部署。本层**只写索引、绝不写工作树**,判据 = 索引 blob 逐字节等于某枚 `bypass-landing` 留痕自述的前像(∧ 该枚 `landedSha` 是 HEAD 祖先 ∧ 工作区==索引);证明不了的一律 `held`/`undetermined` 逐条点名(§0.3),守护日志必打印。取证:`scripts/tests/heal-worktree-tracked.test.mjs` T9–T17(含形状锁"函数体内不得出现任何写工作树的动作")。
<!-- 原第 407 行 -->
- 三层水印(`scripts/watermark.mjs`):L1 可见横幅、L2 横幅内零宽载荷、L3 文件末独立不可见行。载荷必须**可解码且等于** **`WATERMARK_TEXT`**;五态:完好/残迹/载荷损坏/仅隐写/未覆盖,后四者 `watermark.mjs verify` 与 `check-watermark-coverage.mjs` 均 exit 1。
<!-- 原第 408 行 -->
- 运行时文件:`.ihui-agent/goal-runtime/STATE.md`(状态机 active/paused/achieved/blocked/budget\_limited)+ `loop-run-log.md`(逐轮追加)。
<!-- 原第 409 行 -->
- 7 步循环:目标解析 → 单轮执行 → 独立评估(禁模型自评 yes)→ 循环判定(连续 3 轮 no 无进展 ⇒ blocked)→ 最终交付校验 → 状态清除交还 → 摘要入 PROJECT\_PLAN + 清理运行时文件。
<!-- 原第 410 行 -->
- 红线:单目标 ≤20 轮;高危操作必须暂停等人工;严禁扩展需求;每轮完整承接上下文;连续 5 轮工具失败 ⇒ blocked。blocked/budget\_limited 下**禁止** `git reset --hard`/`checkout .`/`clean -f`;必须在 PROJECT\_PLAN 记录现场,回滚决策权归用户。
<!-- 原第 411 行 -->
- 每个任务默认 8 端同步开发:"匹配连通好" = 代码同步 + 链路打通 + 验证齐绿;禁止只改一端交付、单端验证、分期交付。平台独占豁免须在 PROJECT\_PLAN 显式标注。主 agent 用 §11 按端拆 subagent,跨端契约对齐不下放。
<!-- 原第 412 行 -->
- 除 main 外禁止新建分支;普通功能/修复/重构/文档一律 main 直接 commit。豁免(逐条点名不静默):`/goal` 的 `goal/*` 临时分支(完成立即删)、48h 在飞窗口内的 PR 分支、linked worktree checkout 分支及其 origin 镜像、镜像远端与幻影引用、stale 远程跟踪引用(出路 `--refresh-remote`)、**`backup/`** **与** **`ihui-backup/`** **引用永不判红**。已合并分支本会话内删净;删未合并分支前必须 tag 备份(§22)。日常 `git fetch origin --prune`。守门:`check-single-branch.mjs`(41,blocking;在飞窗口 `IHUI_SINGLE_BRANCH_GRACE_HOURS`,阳性对照 = 窗口设 0 全翻红)。
<!-- 原第 413 行 -->
- **强制** **`scripts/safe-commit.mjs`** **五步法**(真实事故根治):①暂存文件清单回显 → ②只 add 本任务文件(禁 `git add .`/`-A`)→ ③commit 带 pathspec(只提交声明集)→ ④推送 → ⑤回读验证 local == remote。禁止裸 `git commit`。
<!-- 原第 414 行 -->
- **15c 工作树内禁止嵌套 git 仓**(守门 208 `check-no-nested-git.mjs`,blocking,`stagedTriggers: ['scripts/']` 把射程收到"能造出该状态的那一面";全量档一律跑):2026-10-14 实测——测试夹具在仓库内 `git init` 且**无任何清理钩子**,中断即永久残留 52 个演练仓,IDE 源代码管理把嵌套仓当独立仓库扫描,聚合出「暂存的更改 10000+(全 D)」幻影计数,而主仓命令行面自始至终干净(机主一度无法判断自己有没有活没交)。需要临时 git 仓的夹具一律走 `mkScratch()`(§15b,工作区外 + 进程退出自动回收)。射程外只有一格:扫根直属一层的 `.worktrees/`(§12d 规定的 worktree 检出落点,linked worktree 天然带 `.git` gitfile,判红就是逼所有人不开 worktree 的恒红门);同名目录出现在更深位置照旧命中。
<!-- 原第 415 行 -->
5 条全满足才可声明"完成":①代码合入 main 并推送;②验证齐绿(typecheck/build/test);③守门全过;④PROJECT\_PLAN 翻勾;⑤交付报告带证据。commit 后忘记 push = 协作事故;4 道自动防线:post-commit 自动 push / push-state 跟踪 / converge 核验 / 任务完成定义。工具失联按流程升级,不得静默放弃。
<!-- 原第 416 行 -->
`.gitignore` 的 `__*` 规则会静默吞 `__tests__/` 目录且 `git status` 完全不显示。硬规矩:项目内测试目录用 `tests/`;新建目录前 `git check-ignore -v <path>` 确认不被忽略;守门 `check-test-paths.mjs` 拦被吞的 `__tests__/`。同理警惕 `.cjs` 静默忽略(NODE\_OPTIONS 钩子必须 `.mjs`)。
<!-- 原第 417 行 -->
触发 = 引入 PROJECT\_PLAN 清单之外的新能力。强制动作:暂停 → `AskUserQuestion` 确认(目标/范围/是否入 PLAN 及优先级)→ 显式同意后才开发 → 补登记 PLAN → `feat:` 前缀。红线:禁止未确认直接开发、禁止伪装成修复绕过、禁止"写完了你看下要不要"代替事前确认。豁免:用户本轮明确要求、goal 目标内含、纯修复/重构/测试/文档、PLAN 已有条目细化。
<!-- 原第 418 行 -->
临时验证脚本放 `.ihui-agent/tmp/<任务名>/`,禁止放 apps/\* 根目录或 `.ihui-agent/` 根目录,禁止 commit,禁止留 v1/v2/v3 版本号后缀;`git add` 只加本任务文件。豁免:正式守门脚本(`scripts/check-*.mjs`)、测试文件、已纳 CI 的 `scripts/e2e-*.mjs`。守门:`check-verify-tmp-files.mjs`(warn)。
<!-- 原第 419 行 -->
- **自动维护**:`IHUI C-Drive AutoMaintain` 计划任务(每天 3am,`c-drive-maintain-hidden.vbs` → pwsh;**注册名含空格,查存在只认** **`schtasks /query /fo CSV`** **全量列名法**);删除出口唯一 `ForceDelete`,`-DryRun` 拦在该出口;删除面按名字白名单不整片删。页面文件改动留"待重启生效"哨兵。
<!-- 原第 420 行 -->
React 事件对象的 `e.currentTarget` 在 handler 返回后置 null:异步回调(setTimeout/promise/memoized 闭包)内**禁止访问** **`e.`** **任何属性**;同步作用域先缓存字段(`const id = e.currentTarget.dataset.id`)或用 ref 管理 DOM。守门:`check-event-closure-leak.mjs`(42,blocking,括号配对提取异步回调首参搜 `e.X`)。
<!-- 原第 421 行 -->
- **迁移正文不可变**(185):已进 journal 的 .sql 禁就地改正文(IM1 首次入库 blob 对照/IM2 索引 vs HEAD);守门 49 记账结构(B1-B5 离线,B6-B9 连库)。**受管** **`.env`** **键值被清空对账** `check-env-drift.mjs`(守护巡检档,判机器状态不进提交链)。
<!-- 原第 422 行 -->
| 文档                        | 说明                                                          |
<!-- 原第 423 行 -->
| ------------------------- | ----------------------------------------------------------- |
<!-- 原第 424 行 -->
| `PROJECT_PLAN.md`         | 唯一任务计划文档(必读)                                                |
<!-- 原第 425 行 -->
| `.ihui-agent/archive/`    | 历史归档(只读;含本次压缩前完整原文 `AGENTS_full-pre-compact-2026-10-14.md`) |
<!-- 原第 426 行 -->
| `docs/architecture.md`    | 系统架构文档                                                      |
<!-- 原第 427 行 -->
| `docs/port-management.md` | 端口注册表(88xx 段;端口表描述部署形态,不判引擎存在性——判引擎先读应用自己的 DSN 再看监听归谁)      |
<!-- 原第 428 行 -->
| `docs/UI_GUIDELINES.md`   | UI 规范(§3.1 圆角角色、§4.6 图标对齐算式)                                |
<!-- 原第 429 行 -->
| `docs/learning-assets.md` | 学习资产登记(新增/删除工作流必须同步)                                        |
<!-- 原第 430 行 -->
- 原速查整区(约 800 行超长登记)已逐字归档于 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`;此处只留:门 89 本体 + 横向口径 + 全部门名点名索引(R4 义务:每道已接线门必须在本文或 README 可见)。**mode/blocking、skipEnv、编号一律以** **`scripts/guardian-runner.mjs`** **注册条目现值为准**。
<!-- 原第 431 行 -->
- 计划文档: `check-plan-dup-pointer-ratchet.mjs` `check-plan-sha-resolvable.mjs` `check-plan-sha-form.mjs` `check-baseline-freshness.mjs` `check-agents-doc-size.mjs` `check-plan-id-pool.mjs`
<!-- 原第 432 行 -->
- 接线/守门自身: `check-gate-face-discipline.mjs` `check-skip-env-promise.mjs` `check-selftest-registrant-evaluates.mjs` `check-ci-failure-triage-wiring.mjs`(id 215,blocking:CI 失败自述覆盖面与自洽性对账 —— W2 失明/错位/孤儿锁 + TRIAGE\_WORKFLOW\_FILE 必须指本文件为硬拦;W1 覆盖面按 §12e 全量档只报数、`--staged` 差值棘轮只拦新增;自检 `--self-test`,跳过 `HUSKY_SKIP_CI_TRIAGE_WIRING=1`) `check-api-key-permission-labels.mjs`(id 214,blocking:ApiKeyPermission 三面对账 —— union ↔ web 两处 `Record<ApiKeyPermission, string>` 标签表 ↔ 五语言 `apiKeyPerms.*`;P1 键集等值、P2 表值必须逐端取得到(§19);取不到或枚举为 0 ⇒ exit 2 未判定;按输入面 `stagedTriggers` 收窄不给无关提交造恒红;自检 `--self-test`,跳过 `HUSKY_SKIP_API_KEY_PERM_LABELS=1`) `check-sheet-flex-contract.mjs`(id 217,blocking:mobile-rn sheet/弹窗 flex 弹性契约 —— bounded 容器(maxHeight/height)内列表必须唯一弹性块、固定 chrome 显式 `flexShrink:0`、例外 `// sheet-flex-ok:` 行注释豁免;`--src` 注 fixture 属外部输入恒磁盘读(守门 118 许可条款),仓库面走 face-reader;原注 213/214 两度撞号让位顺延;自检走 `scripts/tests/check-sheet-flex-contract.test.mjs` 10 例) `check-mobile-rn-style-parity.mjs`(id 218,blocking:RN 端硬编码 hex 基线棘轮 —— 基线外新增 #hex 即 BLOCK,存量只减不增;取材口径全量=HEAD blob/`--staged`=索引 blob/`--worktree`=人工逃生舱,取不到 ⇒ exit 2 未判定;自检 `--self-test`,跳过 `HUSKY_SKIP_RN_STYLE_PARITY=1`) `check-list-predicate-has-positive-proof.mjs` `check-baseline-freshness.mjs` `check-ops-patrol.mjs` `check-shared-type-not-redeclared.mjs`(id 219,blocking:端内共享类型重声明对账 —— 差值棘轮锚点 = 该文件 HEAD 自身违规数,存量只报数;`--json` 的 detail 每条带 sameShape(yes/no/undetermined)与 reachable 两维,只有 yes∧reachable 才是"一条命令能收"的,no = 跨层同名不同物(按名字并就是把两件东西并成一件),undetermined 要人工读;自带 `--self-test` 用例(条数现读,别在本文钉数),跳过 `HUSKY_SKIP_SHARED_TYPE_REDECLARED`)
<!-- 原第 433 行 -->
- 接线/守门自身(补登·2026-10-18 加档): `check-grafana-datasource-wiring.mjs` 判据 C 版面坐标对账 —— 同层面板 gridPos 矩形相交(一块被压住,肉眼看是"面板不见了")、x+w>24(右侧被裁出栅格)、缺 gridPos 三型判红;**比只在同一容器内做,row 自身不参与**(折叠行内子板是行内相对坐标,跨容器互比必误咬)。立因:hls 盘一块流水账文本板 24×3\@y0 压住唯一图表,而 uid/幽灵名/JSON 全绿。存量已现读归零才占 blocking(§12e);判据唯一实现住门 222,核验器 import 消费;回归锁住在镜像档 D10–D12(含"≥20 张盘"取材非空断言)。
<!-- 原第 436 行 -->
- API/后端/DB: `check-credential-leak-in-message.mjs` `check-egress-ip-drift.mjs` `check-credential-presence-bypass.mjs` `check-principal-consumed.mjs` `check-public-exposure-list.mjs` `check-capability-field-not-client-supplied.mjs` `check-authorization-column-isolation.mjs` `check-migration-immutable.mjs` `check-db-blind-updatedat-set.mjs` `check-sequence-lag.mjs` `check-error-code-not-text-matching.mjs` `check-error-attribution-single-source.mjs` `check-error-message-bounded.mjs` `check-inbound-schema-strict.mjs` `check-nested-additional-properties.mjs` `check-enum-default-widening.mjs` `check-enum-fallback-terminal.mjs` `check-txn-cancel-boundary.mjs` `check-dockerfile-copy-paths.mjs` `check-edu-arrears-single-source.mjs` `check-sse-frame-watermark.mjs` `check-python-import-landed.mjs` `check-python-import-resolvable.mjs` `check-mode-permission-matrix.mjs` `check-subagent-permission-inherited.mjs` `check-csrf-exemption-shape.mjs`
<!-- 原第 437 行 -->
> **本文件为 2026-10-14 压缩版**:规则条款全部保留;历史叙述、失效原文残留、重复登记副本与超长守门登记整区逐字归档于 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`(出处 HEAD `c7834a8f0388aa006ca746cb1cc4a3006336c23d`,1,261,607 字节)。本文与归档原文冲突时以本文为准;本文未写的历史案例按归档件查。
<!-- 原第 438 行 -->
〔补登@2026-10-18,原句"只判属性名不判取值"按当次实现更正,原句逐字保留在上行只作改判留痕〕同一枚门 193 现另判 **input↔stdin 取值维**:同一 options 里带 `input` 而 stdin 首元素不是 `'pipe'` ⇒ 判红(实测 10/10:`hash-object --stdin` 读到空 stdin 不报错、安静产出 0 字节空 blob,那串"看着像 sha"曾把 1.67MB 的 lock 落进 main);取值取不到字面量 ⇒ 判不出、既不记绿也不冒红;该维按 §12e 走差值棘轮(锚点=该文件 HEAD 面自身命中数,存量只报数,`--strict` 才问责)。
<!-- 原第 439 行 -->
- 〔补登@2026-10-19,上一条原文照旧只作定档留痕〕**出口台账的三条实测边界**(否则这一维又会变成"说过头的话"):① 行的身份字段是 `schema 2` 的 `source + alertId + subject`(不再是"只存 fp 前缀"—— 那是 `schema 1` 生产侧旧档的写法);没给 `--alert-id` 的调用退到"折过数字的标题"分桶,所以 git-guardian 已把真身份交给出入口(`buildGuardMailArgv` 的 `--alert-id`,force 档另带 `--force-alert`),否则"同标题的两次真重报"会被数成假风暴。② **CI 寄的信在本机无账**:出口把行写在它自己那份 checkout 的 `.workbuddy/` 下,临时 runner 随 run 销毁 ⇒ 本机量算仪只量得到本机这一路。③ 人读档的"去重压住 N 轮"是**出口** **`--alert-id`** **窗口**压住的轮数,不是全链路:各生产者(git-guardian / 桥 / ai-service)自压的那些轮次根本走不到出口。三处边界同时登记在 `scripts/data/alert-mail-faces.json` 的逐行 `note`/`gapReason` 里。
<!-- 原第 440 行 -->
- 〔更正@2026-10-19,上一条原文逐字保留只作改判留痕〕**`deprecated-source`** **是节律现象,不是"照信就去做"的工单**:本机的 v6 源地址约每 12 小时退化一次(现读:退化→重启换地址→再退化的循环),而**重启 Cloudflared 的代价实测是约 3 分钟入口 530**(15:40 那次由监控当场抓到;尺子的"重启账"维就是为此而设)。所以收到这封信的正确处置是:先看信里的持续档(`held=`)与 `restart-churn` 读数 —— 同一天已经重启过、或崩溃循环正在抖 ⇒ **不要**再重启;真要动,挑在无人访问的窗口并预先告知影响时长。发信身份已带 `alertHeldTier` 的 6h/24h/72h 折档 ⇒ 同一段退化越拖越响,不会被压成静音,也没有"每 12 小时催一次重启"的形态。⚠️ 上一版本文与本机记忆里"出路 = 受控重启(\~1 分钟)"这句话把代价说小了,并且没写"节律"这一层 —— 机主 2026-10-19 据此在凌晨重启了一次,实际中断 3 分钟量级。
<!-- 原第 441 行 -->
- `check-monitor-runtime-parity.mjs`(2026-10-18 立,票 G-584 同族;镜像测试 `scripts/tests/check-monitor-runtime-parity.test.mjs`):monitoring 运行副本(`D:\DevEnv\monitor`,nssm 原生)↔ 仓内 `monitoring/` 真相逐对同形对账(alertmanager/promtail/grafana.ini/loki 四对 + ai-service `.env` 结构键 COMBO\_CHAINS/*\_URL/*\_PORT,值绝不落输出);三态分桶 同形/差异/未判定,配对清单 <4 枚即 exit 2 空转点名。**不挂提交链也不挂巡检轮**:它判"这台机盘上当下是什么",非生产机上运行副本根本不存在,挂链即 §12e 恒红门;且**差异 ≠ 错**(原生端口/路径改写合法),结论只是差异清单,判红权归人,器物零写入零同步。
<!-- 原第 442 行 -->
- 常驻工具(非守门,勿因"不在 runner"当没装车): `watermark.mjs` `guardian-runner.mjs` `safe-commit.mjs` `git-guardian.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `heal-worktree-tracked.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `git-lock.mjs` `deploy-lock.mjs` `union-converge.mjs` `merge-live-doc.mjs` `live-doc-edit.mjs` `object-space-land.mjs` `gate-registry-insert.mjs` `plan-tasks.mjs` `plan-tasks-merge.mjs` `plan-pointer-purge.mjs` `plan-task-index.mjs` `plan-line-age.mjs` `bypass-git.mjs` `face-reader.mjs` `code-mask.mjs` `scratch-dir.mjs` `key-dir.mjs` `secret-path.mjs` `seal-c-root-stray.mjs` `scrub-temp-fixtures.mjs` `c-disk-breakdown.mjs` `plan-union-merge.mjs` `run-evidence.mjs` `visible-window-probe.mjs` `install-console-window-hook.mjs` `commit-gate-attribution.mjs` `plan-bypass-ledger-report.mjs` `alert-volume-report.mjs` `provenance-ledger.mjs` `module-context.mjs` `notify-deploy-failure.ts` `desktop-build.mjs` `msvc-env.mjs` `desktop-unsigned-config.mjs`
<!-- 原第 443 行 -->
- **Rust/MSVC 构建环境注入(2026-10-19 立,§0.8 的实测反面教材)**:本机 `C:\Program Files\Git\usr\bin` **在系统 PATH 内**且带 GNU coreutils 的 `link.exe`,而 `apps/desktop/src-tauri/.cargo/config.toml` 的 `linker = "link.exe"` 是**裸名按 PATH 解析** ⇒ 未加载 MSVC 的 shell 里 Rust 链接阶段报 `link: missing operand after '\377\376'`,**报错里一个字都不提工具链**。全仓此前零处加载 MSVC(§5b 旧口诀"cargo 在 PATH 即可"是真out路的一半,已订正)。**唯一真相源** `scripts/lib/msvc-env.mjs`(纯判据,自身零 IO;`vswhere` 本机返回 `[]` 故必须带已知安装位兜底;PATH 键大小写不敏感只留一份;剔 `<Git>\usr\bin` 段并把 MSVC bin 前插),入口薄壳 `scripts/desktop-build.mjs`(`--debug`/`--dev`/`--no-artifact-check`/`-- <透传>`;**取不到工具链 ⇒ 显式「未判定」exit 2,绝不静默回落裸 env**;收敛钩子目录随档位走,debug 档不许去判 release 目录)。已接线:`apps/desktop/package.json` 的 `build`/`build:debug`/`dev`/`dev:cdp`、`scripts/desktop-build-saas.mjs`、`scripts/desktop-dev-saas.mjs`、`scripts/release-desktop-local.mjs`;**裸跑** **`tauri build`/`tauri dev`/`cargo build`** **仍不注入**(须自行加载 vcvars)。`scripts/start-dev.ps1` 只做只读诊断并按"desktop 实际怎么被拉起"分档报(经 wrapper ⇒ info,裸 tauri ⇒ warn)。取证 `scripts/tests/desktop-build.test.mjs`(38 例)。
<!-- 原第 444 行 -->
  - **读 cmd 输出必须先** **`chcp 65001`**(实测回归):cmd 写管道用**当前 OEM 码页**(本机 936 GBK),Node 按 utf8 解 ⇒ 每个非 ASCII 字节变 U+FFFD。实测曾把 `Path` 里三段中文目录与 `COMPUTERNAME`/`LOGONSERVER`/`USERDOMAIN`/`USERDOMAIN_ROAMINGPROFILE` 一起改写,而构建**照样 EXIT=0**(坏段只是"不可用但存在",没工具碰它)——静默型。`captureVsEnv` 的命令串必须以 `chcp 65001 >nul &&` 开头。与 §5d 是同一个坑的反向:那次 node **写**,这次 node **读** cmd。
<!-- 原第 445 行 -->
  - **`--dev`** **档 Ctrl+C = 正常结束**:长驻会话被用户打断不是失败。`judgeInterrupt` 收 130 / `0xC000013A` / `signal==='SIGINT'`,命中即打印**实际观测到的那一个**并按 0 计(§0.3:Windows 上究竟落哪一个未实测,故三者都收且不替它编成因);**build 档不享受这条**——被打断仍然是"这次没建成"。
