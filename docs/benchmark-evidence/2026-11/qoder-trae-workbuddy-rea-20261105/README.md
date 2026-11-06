<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# rea goal-b49 · WorkBuddy / Qoder CN / Trae 对照取证与复现台账(2026-11-05 开批)

引擎:`rea-agents@6.4.0`(全局装于 `D:/caches/npm/prefix`,项目级 MCP 入口 `scripts/rea-mcp-entry.mjs`,配置 `.ihui/mcp.json`)。
纪律:AGENTS.md §0.11「逆向-复现-超越」四步 + 红线(不粘对方源码、不破解许可证、不绕付费、不提取凭据)。
本册三席报告均按「观察 / 推断 / 未知」三态标注,取不到输入一律记未判定,不冒绿。

## 1. 靶(现读定位,非记忆)

| 对照程序 | 版本 | 实读安装路径 | 取证席 |
| --- | --- | --- | --- |
| WorkBuddy | 5.9.3(Tencent) | `G:\workbuddy\`(Electron,`resources\app.asar` 181,996,084 B) | W1(主进程/CLI/原生面)+ W2(外围与运行时) |
| Qoder CN | 0.5.3 | `G:\Qoder CN\.qoder-versions\0.5.3\`(Electron) | Q1(主程序 bundle,结清上批遗留格) |
| Trae CN | 3.4.15 | `C:\Users\Administrator\AppData\Local\Programs\Trae CN\` | 本批未重取(goal-b44—b48 已量过,残余见 §4) |

版本与路径出处:注册表 `Uninstall` 面 + 开始菜单 `.lnk` 目标 + 进程表 `Win32_Process.ExecutablePath` 三路互证。

## 2. 本枚已落地(代码已进本仓历史)

提交:`e2d819a0a4498b5b0416eaeb49588116e574e2e9` — feat(cli): 复现并超越 WorkBuddy 的按操作分维文件访问裁决

| 件 | 动作 | 内容 |
| --- | --- | --- |
| `apps/cli/src/sandbox/glob-pattern.ts` | 新建 | glob 匹配抽成单一真相源,`checkFolderTrust` 与新裁决共用同一把尺 |
| `apps/cli/src/sandbox/file-access-policy.ts` | 新建 | read/write/delete 三轴独立裁决;凭据族读侧 deny(含根层裸形态);守护面族从 `scripts/data/immutable-guard.json` 逐枚派生,取不到或枚举到 0 条判未判定 |
| `apps/cli/src/sandbox/index.ts` | 改写 | 内联 glob 换成 import 同一原语(行为不变,`tests/sandbox.test.ts` 39 例回归绿) |
| `apps/cli/src/tools/builtins.ts` | 接线 | `read_file` 的判据排在任何 fs 动作之前,拒绝即返回 |
| `apps/cli/src/tools/index.ts` | 接线 | 写侧在 `folder_trust` 之后追加一层,只可能更严 |
| `apps/cli/tests/file-access-policy.test.ts` | 新建 | 16 例:含正向对照、例外族声明序、跨盘绝对路径、未判定不记绿、形状锁(裁决不碰 fs)、装车证明(`read_file` 真走到这层) |

超越轴(逐条可验,不是口号):
1. **清单不抄第二份** — 对方规则随安装包二进制分发(审不到也测不了);我方守护面规则由已审清单派生,门可随时重算。
2. **可测性** — 注入式清单读取器 + 纯函数,CIM 里直接断言;拒绝发生在 `existsSync` 之前由用例钉死。
3. **失效方向** — 取不到清单判「未判定」并点名原因,绝不空表冒充「本仓没有守护件」(§0.3)。
4. **不制造恒拦门** — 守护面写/删默认 advisory(出声放行),严档由 `IHUI_FILE_ACL_STRICT=1` 升;凭据族读侧恒 enforce(§12e)。

## 3. 三席取证读数(数字现读于各自报告)

- W1:40 条能力;缺口表 17 行 = 零对位 10 + 半格 7,其中「零对位且建议落地」8 条(①删除保护链 ②文件 ACL(本枚已落) ③子进程网络出口 ④Job Object ⑤工具面惰性装载 ⑥成本档位审批 ⑦对抗式多票校验 ⑪CLI 启动三件套)。方法学反差已登记:REA 对 main 的 `ipc.literal_channels=0`,人工 grep 同目录得 41 条 `wb:` 通道 ⇒ 该维以人工取证为准。
- W2:16 行缺口表(含零对位 7)。两处**自家活账**由本席顺手挖出,主席三面复算后**一真一伪**:
  ① `packages/database/drizzle` journal ↔ sql 双向差集 —— **该条已作废**:HEAD 面 entries=366 与 sql 文件 366 **逐一对齐,零孤儿、零重号、零断档**;
     席报的"364 entries / 366 files / 2 枚孤儿"取自**落后于 HEAD 的工作树副本**(AGENTS.md §5b 的幻影漂移射程,不是迁移缺账)。
     教训入册:凡"缺件/孤儿"型断言必须 HEAD blob / 索引 blob / 工作树三面各读一次再定性(§0.3),单面读数不作证。
     为此新建的双向对账尺 `scripts/check-drizzle-journal-sync.mjs` 不因结论推翻而作废 —— 它同时能抓真孤儿与这类面滞后,正是这一型。
  ② `apps/cli/src/commands/share.ts` 的报告 HTML 走 marked.js CDN 外链(自称 self-contained) —— **HEAD 面复验成立**
     (`git show HEAD:apps/cli/src/commands/share.ts` 现读 `<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js">`),断网即无正文。
  本席撞 subagent 150 轮上限中止,报告四段齐备、正文中一处「逐调用 context 内容」的关键结论**尚未完成复核** ⇒ 该条按未判定采信,不得当已证结论引用。
- Q1:上批 T12 §7 遗留格「10 枚未接线导出的真实消费方」**已结清** = 10 枚全部 0 消费方(主包未混淆、asar 内既无 mtree 二进制也无装载路径 ⇒ 结构上不可能消费);native 模块内部自调仍标未知(REA Ghidra 330 s 超时)。主程序面另取证 23 条能力,对位 15 条(5 零对位 / 7 半格)。

## 4. 残余清单(逐条给归属与解锁条件,不写「已完成」)

| 残余 | 归属 | 为什么本枚没做完 | 谁解锁 |
| --- | --- | --- | --- |
| 删除保护链(回收站 + 批量两阶段护栏) | **已落地** `cf1e7f9efe`(主席统一落地,B1 席产物) | 判据层住在 `packages/shared/src/delete-guard/`,三个消费点已接线;**未竟 = 跨端展示面**(回收站的「到期清理」节拍已由第七回合落地:端内 adapter `b709aa4ade` + 调度腿 `fd1edb25bd`/`3e3cd3dd9f`) | B1-impl.md |
| 技能目录缓存的廉价判脏 + 自描述 scope | **已落地** `79597fd9fc`(B4 席产物) | 未竟两条:`readSkillCatalog` 尚未挂 `/skills` 命令;watch 失效受 `fsWatcher.enabled=false` 那一端限制 | B4-impl.md |
| 分享页去 CDN 外链(离线可读) | **已落地** `2beafada173`(B3 席产物) | 渲染器为受控子集(标题/列表/代码块/链接/粗斜体/表格),不声称全 CommonMark;阳性对照已插回旧 CDN 验证会被抓 | B3-impl.md |
| 摘掉"我方 git 可用性取决于别人装没装 WorkBuddy" | **已落地** `420e3c3c7a`(主席件,cargo 27 passed 实跑) | 兜底位改指我方 `.ihui` 目录 + 新增 `IHUI_PORTABLE_GIT` 显式登记(与 `gitdir.mjs` 同键名) | W1 §3 第⑩行 |
| 自包含诊断报告(KPI + 阶段瀑布 + findings) | **已落地** `68d68a2cc450e83a8d469ac0e122f16277f17d4f` | 执行席在传输层断掉(83 步 / 81 分钟),状态件只剩首行 ⇒ 主席按其落盘产物收口:补五语言词典(原只有 zh-CN/en)、补 25 例测试、修两处实现与声明相反的缺陷(阈值 0 档本应关判据,实现写成 `count >= 0` ⇒ 干净轨迹也报)|
| 子进程网络出口(DNS / 域名裁决那一半引擎) | **已落地** `923546ffec8e145a90c551f8c9c035eca9bc42f4`(B6) | TCP 代理腿需常驻载体(盲写未接线抽象按 §0.9 不落地)、真 DNS 解析适配器、裸域名取词、desktop 同源腿 = 未竟 |
| 文件 ACL 的 delete 轴消费点 | **已落地** `14e02e57f52337bef3a932d2b23571a84d3c6e1f` | 同一枚还修了两处:①裁决层此前挂在 `folder_trust` 缺省的提前 return 之后 ⇒ 结构性无人问(装了等于没装);②规则表 16 族漏 delete 维(读不到却能删),并加"每条 read deny 必须同管 delete"的穷尽性判据 |
| Job Object 随父而终(TS 侧) | **已落地** `e565814a93`(S6 席产物,主席复量收口) | 对侧用 Win32 Job Object(`KILL_ON_JOB_CLOSE`);我方现读是**半格** ⇒ 复现为 `apps/cli/src/util/parent-bound.ts`(248 行,纯判据 `decideWatchdogTick` 四态含 `unjudged`)+ 接线 `mcp-runtime.ts` 的 stdio 派生点,杀树一律 import 既有 spawn-isolated 出口(零复算)。**超越轴**:判据纯函数化可 diff + 看门狗自身有死亡机制 + 观测不到即不判定也不动手 | S6-impl.md |
| delete 轴**残余**消费点(`git.ts` / `worktree.ts` 的 rm 点从未过裁决) | **已落地** `e99903d61ea`(S7 席产物,主席复量后落地) | 主席逐文件现读(读数 = 该文件内 rm/unlink 点数 / `evaluateFileAccess` 引用数):`git.ts` **2/0**、`worktree.ts` **5/0**、`file-batch-edit.ts` 5/2(对照样板)。S7 逐点定性后接 2 腿(`subagents/worktree.ts` 的 `removeWorktree` + `createWorktreeWithFallback`,目标名来自模型入参 `resumeFrom`,`..` 可折出隔离区)、判**不接** 2 腿各有测试钉住(撤 marker 那一腿加闸反而更不安全;对账腿目录名来自 `readdirSync`,`..` 结构上不可能出现)。未竟两格:① `tools/worktree.ts` 的 `cleanupWorktree`(W-2)前置 = 先改出"可传拒"返回形态并同步 `background-registry.ts:247`(现无论成败都把 `worktreePath` 置 undefined ⇒ 拒绝会被写成静默);② `toAclPath` 越界形态仍走绝对路径回落,正解 = 在两个 worktree 删除出口加"解析后必须仍在 `<worktree 根>` 之下"的容器性断言(与 ACL 不同职,属新增判据维) |
| 守护面 advisory 升 blocking | 机主/下一批 | 升档前置 = 并行席改动工作流先有「带理由声明」的出口(§12e) | 存量归零后升 |
| drizzle journal ↔ sql 双向对账尺 | **已落地** `e38aad1c2c`(含两面分判改造) | 尺 warn-only 挂守护巡检轮,不进提交链;真 drift 那枚提交再同批接到人通道才谈可整改性 | B2-impl.md |
| Trae 面增量 | 未开 | 本批四席全压在 WorkBuddy/Qoder 两个新靶 | goal-b44—b48 残余见 `docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/` |
| 两道**机器状态门**(门 25 项目外路径违规 / 门 26 父目录污染) | **第五回合现读:判定面已不复现红,更正读数** | 主席 2026-11-05 现读两把尺各跑一次:门 25 = 「⚠️ 3 处 warning(不阻塞),0 处 blocking」RC=0;门 26 RC=0(点名的仍是别席 scratch,但档位只告警)。**上一轮"常年红会堵 safe-commit"这一断言在当下不成立** ⇒ 按 §12e **不削判据、不改射程、不收窄覆盖面**,只更正读数;若日后复红,出路仍是原登记的二选一(确认 `gate-audit-1104` 无主后按 §15 清理 / 对 vendored 压缩件不判并带反证用例) | 本行即更正留痕 |
| ~~**推送未落地**~~ | **第四回合结清**(合并枚 `9a9d4e733f4` + 二轮 `c3dc90805bb`,`git-push-converge` 现读 `origin=ALREADY(远端=本地)`) | 上一轮"converge 拒推进"的根因**不是判据坏了,是没走它自己给的具名出口**:本侧对 AGENTS.md / README.md 相对基底**零改动**(现读 `git diff --numstat <merge-base> HEAD -- <file>` 空),那 20 行是**继承行**而非本侧改动,远端 `1a55955234 docs(agents): 压缩 AGENTS.md 至 95,722 字节` 是有意清偿 ⇒ 正解 = `--take-theirs-doc AGENTS.md --take-theirs-doc README.md` 声明式透传(该出口的立因注释里就点过"对侧删 AGENTS.md 两行"同型)。**未削判据、未 ALLOW_STALE** | 残余两条见下 |
| 收敛后的两个非阻断残项 | **第七回合现读:两格均已消解** | ① 同号多候选:现读 `plan-tasks-merge --heal` 全维归零(F1/F2/F3/F4/F10/漂开族皆 0)⇒ 无待裁决族,`--match-prefix-holder` 本轮无调用面;② `heal-worktree-tracked.mjs --align-drift` 现读 `.ihui-agent/state/converge-align-state.json` = `consecutiveFailures 0 / lastNote aligned=0 / lastOkAt` 为当轮 ⇒ 上一轮那条 rc=143 截断**本轮不复现**(如实记为不复现,不据此宣称别席已修) | 本行即留痕 |

## 5. Trae 面复取(第三靶,同批 T1 席)与三条环境事实

**版本漂移是真的**:Trae CN 旧册记 1.107.1 内核 / 本批现读 3.4.15,`ai_agent.dll` / `harness.dll` / `toolhost.dll`
三枚的字节数与 sha256 全变 ⇒ **旧册里按字节偏移钉的那级结论本轮起失效**(VSCode 内核 1.107.1 与 `traeVersionCode` 未变)。
旧册 T12 §7 的 `a.bin`/`b.bin`、`deny`/`ask`、argv 分发键三格属 Qoder 靶,不在 Trae 席射程,未被"重开"。
动了 1 格:权限枚举 16 锚点在新构建逐条仍 HIT,且 `enterprise_command_blacklist` / `sandbox_model_escape`
从"仅 harness"扩散进 ai_agent 面;穷尽性(是否还有第 17 个锚点)**仍未判定**。
净新增取证 10 条能力,前 3 落地建议:①AI 代码归属追踪(git-ai,零对位)②企业命令黑名单 + 命令级三段决策(零对位)
③MCP/提示/历史分维配额(`tool_budget_governor`,半格)。巨型 DLL 反编译仍在时间盒外,不冒绿(见 `T1-impl.md`)。

三条环境事实(下批不必重新踩):
1. `apps/cli` 全局入口本轮**无法冒烟**:他席把 `apps/cli/src/skills/packaging/index.ts` 暂存删除而
   `commands/skill-package.ts` 仍 import 它 ⇒ 任何子命令 `ERR_MODULE_NOT_FOUND`。端到端验证一律改走 vitest 直调模块。
2. 门 7(`check-dedupe.mjs`)报 lockfile 依赖碎片化(semver/webpack 族),与本批各枚无关(本批零新增依赖);
   出路 `pnpm dedupe` 会重写 lockfile,影响所有并行席,故本批不动。
3. 门 25 / 26(项目外路径 / 父目录污染)与门 30c(陈旧副本)常年红,点名的都是**别席在飞或已遗留的现场**;
   旁路落地通道不受其拦,本批按 §12e 不代裁决、不为消红削判据。

## 6. 第三回合落地(主席自审后收口,六枚)

| 能力 | 提交(全 40 位) | 主席自审读数 |
| --- | --- | --- |
| 文件 ACL 真正分维(delete 轴 + 两处接线缺陷自纠) | 14e02e57f52337bef3a932d2b23571a84d3c6e1f | 7 例新测 + 既有 ACL 16 例 + delete-guard 15 例 + sandbox 回归合跑 77 passed |
| 自包含诊断报告(KPI/瀑布/findings + 五语言 + 深浅色 + 打印) | 68d68a2cc450e83a8d469ac0e122f16277f17d4f | shared 15 例 + 词典 10 例;五语言真渲染各一份,外链 0、文案欠账 0 |
| 子进程网络出口(DNS 域名裁决引擎) | 923546ffec8e145a90c551f8c9c035eca9bc42f4 | 14 新例 + sandbox/acp 回归 = 58 passed;tsc 触及面 0 错 |
| 本地服务发现(带心跳的认领件 + 代次交叉核验) | 5504153385fd05ad6ba05a0369d8ce0c9119de8f | shared 判据 13 例 + 端到端 8 例(真起服务真发 HTTP 探测);既有服务测试 54 例未破 |
| CLI 启动画像与预热命中读数 | 49061736f9dfe144651a30e183b8cded15a58a34 | 12 passed;接线只落 direct-run 块且 opt-in |
| 工具面惰性装载(本轮 schema 可见集) | 7c2faba74cebab10cc49b2d2e0e904eb88b778dc | pnpm check:pytest verdict=GREEN(29 passed/0 failed);check-mypy --worktree 0 errors |

**两条被现读推翻的派单书事实**(C1 席纠正,记下来免得下批照抄):① 「80 枚工具常驻」是 def _tool_ 口径,按 _TOOLS 现读是 **111 枚**;② 本仓水印族**确实覆盖 .py**,派单书写了「不必注水印」是错的。

## 7. 第四回合落地(2026-11-05,六枚;上一轮的两张死票 D1/D2 重派后结清)

| 能力 | 提交(全 40 位) | 主席自审读数(自己复跑,不采信席报自述) |
| --- | --- | --- |
| 插件贡献词表 3 → 10 档 + 权限接 dataClass **默认拒** | 15f1acea0ce2b24aff3debc90a7ea30eb46318f7 | `packages/types` 全量 38 files / 420 passed RC=0;cli 定向 4 files / 83 passed;`pnpm capabilities:check` = 产物与能力目录一致;门 121 判红文件 0 / 未判定 0 |
| 随包资源装机策略(`ensure-minimum` 三态 + `expires` 到期维)+ 解压炸弹双上限 | b06842c4a9fa0f3ace2ad392d8a82fe2e5a7db67 | 本票 35 例入四票合跑 `Tests 73 passed`;既有相关用例 146 passed;守门 70 现读 `installer.ts` 硬编码中文 17 == HEAD 17(增量 0) |
| 会话快照 `<uuid>@vN` 可寻址版本序列 + 三约束 GC(判不出不删) | e423b7123f364a0d4545bc84936ee7f6dfa7a181 | 19 例入合跑 73 passed;既有 checkpoint/hunk 回归 75 passed。**走出口② `LAND_ALLOW_STALE=1` 显式放行**:底稿实为 HEAD 版(与历史各版比差异最小者正是 `60c5d6d7b6`),"复活"那一行 `return null;` 是本票新写的"体积量不出⇒不删"出口(盘上 3 / HEAD 0),与祖先文本巧合;G-671 损坏隔离腿复核一根没少(`readManifestChecked` 4/3、`lastQuarantined` 5/5) |
| delete 轴裁决接到 `WorktreeManager.remove`(`..` 段可把删除目标折出 `.worktrees/`) | 091a63b0e727093e8c872f8faf1fdc53ea48661b | 9 例入合跑 73 passed;同批回归 9 files / 139 passed;判**不接**的两点各由测试钉住(非只写在报告里) |
| "随父而终"看门狗(MCP stdio 派生点 + 看门狗自带死亡机制) | e565814a9375cb62e6ea0a288423847c5d16e20f | 10 例入合跑 73 passed;MCP/spawn 回归 5 files / 47 passed(含"spawn 分档在位"仍绿 = `detached` 未被改);四档端到端冒烟得证(fail-closed 不杀裸 PID) |
| Trae 的分维工具配额四维 + `capability_matrix` 台账 92 → 96 | 00ef484ebf8e4812df59070be72e1ff6fe1aeb64 | `pnpm check:pytest -- tests/test_tool_budget_dims_b49.py` = 21 passed / 0 失败,`verdict=GREEN`(仓根形态);与既有 run 维同批 200 passed;`check-mypy.mjs --worktree` = no issues in 689 files、0 errors;ruff All checks passed |

**六条派单书事实被本回合现读推翻或纠正**(派单的人也要被证伪):①「落点 `apps/cli/src/lib/registry/`」不存在,真同层 = `apps/cli/src/plugins/`;②「该仓无 `from __future__ import annotations`」实测 1358/1605 个 .py 都有,目标两枚本身就有;③`check:pytest` 的可用形态是**仓根** + `-- tests/x.py`,且 `-p no:xdist` 在本仓不可用(addopts 含 `-n auto`);④「prettier 后 inject」对 .py 不成立(无 Python parser)⇒ 改 ruff;⑤`prettier --check` 对 `apps/cli/**` 是**空判**(`.prettierignore:8` = `cli/`)⇒ 本册不把"prettier 绿"当 cli 侧凭据,格式维真判据 = `check-format-changed` 差值棘轮;⑥上一轮登记的「门 25/26 常年红」今天现读两把尺各 RC=0(见 §4 该行更正)。

**四道 blocking 复跑红的归因**:六枚每次落地后复跑都点名 门 26 / 29 / 30c / 41,它们量的是机器状态(仓库父目录 scratch、悬空 commit、别席 miniapp/rn 的滞后副本、超 48h 滞留分支),点名的路径**不在本回合任何一枚的 diff 里** ⇒ 与提交内容无关。按 §12e **不削判据、不为消红改覆盖面**;六枚一律走旁路落地通道(§12 明列它不跑钩子、落地后自动复跑受影响门并把结果打进 stdout)。

## 8. 第五回合(2026-11-05 11:30–13:00)收口与**一道把合并卡死的新闸**

### 8a. 本回合落地

| 件 | 提交(全 40 位) | 主席自审读数(自己复跑,不采信席报自述) |
| --- | --- | --- |
| delete 轴接线 + `unjudged` 一路出声(S7 席产物;席 10:59 写完状态件即静默死亡,未 commit) | e99903d61ea | `npx vitest run tests/acl-followup-b49 tests/delete-axis-consumers tests/file-access-policy tests/sandbox` = 4 files / **79 passed**;`tsc -p apps/cli` 触及 5 枚 src 文件 0 错(余 7 条全在 `commands/skill-package.ts` = 别席暂存删除 `skills/packaging/index.ts` 的环境态);`watermark verify` 8/8 完好 |
| 活文档对账落盘(HEAD 面 ∪ 工作树副本) | be91ef2c18 | `merge-live-doc --apply` 现读:段=7 插入行=13 无锚点=0;行数 33635→33648;归并后 **lost=0**;≥60 字符长行重复 工作树 4157 / HEAD 4157 / 归并后 4157(新增 0) |
| 漂开同题族折叠 | 0172c44e04 | `plan-tasks-merge --fold-drifted-families --commit` 现读:折 3 族 / 4 行,保留 L33618/L33629/L33632,**被删行逐字留痕 4 条 → `.ihui-agent/state/plan-row-drop.jsonl`**;F1/F2/F3/F4 = 0/0/0/0 |

### 8b. 机器状态门(按 §12e 只处置状态本身,不削判据)

- **门 41 单分支**:远端旁支 `ci-knip-1103` 已删。删前三重取证:① 该分支唯一涉及路径 `scripts/tests/knip-taro-alias-parity.test.mjs` 与 main **逐字相同**(`git diff` 空);② 备份 tag `lost-commit/ci-knip-1103-91f5b9b` 已**本地+远端双留**(`git ls-remote --tags` 现读命中);③ tip `91f5b9bafe` 非 main 祖先 ⇒ 结论靠内容等值而非祖先关系。复跑现读:`✅ 单分支检查通过` RC=0(3 枚 gitee 退役跟踪引用/在飞分支/dependabot 分支均归"不判但报数")。
- **门 30a 悬空 commit**:`backup-unreachable-commits.mjs` 现读 `to backup: 35 / tags created: 35`;复跑 `✅ 无 commit 丢失风险`(3 枚同内容副本放行)。
- **门 26 父目录污染 / 门 30c 陈旧副本**:门 26 点名的是仓库父目录 `../tmp/patch{1,2,3}.mjs`(别席遗留);门 30c 点名 `scripts/publish-mobile-apk.mjs` 等**索引面**陈旧 blob(别席在飞)。**两者点名的路径都不在本回合任何一枚的 diff 里** ⇒ 与提交内容无关,按 §12e 不代裁决、不为消红改覆盖面。

### 8c. 卡住合并的那道新闸(下一票的正题,今天才发现)

推送这一格按 §20 还没结清:本地领先、远端领先(现读 `HEAD...origin/main` 分叉,数字每次现量)。走 `git-sync-converge` / `union-converge --apply` 时,两道**同日生效**的机制结论相反:

1. `union-converge` 的活文档行级 union 有 `declaredDropCaps` 那一维(import `scrub-declared-removals.declaredRows`):对侧带回的行若**逐字命中本机摘除台账 ∧ 本侧 0 份 ∧ 是登记行 ⇒ 刻意不回捞**(AGENTS §1「摘了又回来」②,治门 71 回捞)。
2. **今日新加的「内容级防丢闸」**(门体自述 2026-11-05 独立一笔,"治整份取对侧")要求活文档**两侧逐字行都必须在产物面** ⇒ 上面那 15 行被 ① 扣掉的,②当场判红。

现读形态(三种组合都试过,逐条点名):整份取对侧 ⇒ `本侧缺失行 3`(RP-5 + Y-58/Y-70 旧形态);行级 union + `--fold-keep` + `--resolve`/`--declare-side-loss`(4 枚派生语言包保留本侧字节 + 具名少带声明已生效)⇒ 折叠销账 8 行/9 份通过,**只剩 `对侧缺失行 15`**。`--supersede` 结构上补不了这格:它要求"去向行真在产物面",而这 15 行是**已结清摘除**、无去向行。

出路(下一票按序做,任一单点都不算修好):① 防丢闸的活文档维必须**认本机摘除台账的具名声明**(与 `declaredDropCaps` 同一把尺,§0.6),把"合法少带"从"少带内容"里分出来 —— 属判据面改动,提交带 `immutable-exempt`;② 同批改完要用这 15 行的真实形态做成镜像用例(正反对照:回捞件仍判红、台账已声明的摘除不判红);③ 远端被本机摘除台账判为回捞件的那批行,由 `head-recall` 兜底清扫在合并落地后就地摘除(枚 `e32753b929` 已装),不得靠人在合并里手选边。在此之前**不得**用 `--take-theirs-doc` 或手改台账把这道分歧抹平 —— 那是拿活文档内容换绿灯。

### 8d. 本回合派出的三张残余票(执行席不落盘不提交,由主席复量落地)

- **W1** ai-service 四维配额装车:现读 `check_mcp_tool_count|consume_mcp_tokens|check_custom_prompt|check_history_query` 在 `app/**` 的命中**只有 `capability_matrix.py` 三处台账 reason 字符串** ⇒ 除台账文案外零真实消费点。
- **W2** 插件贡献审计装车 + 拆 `loader.ts`(现读 **533 行**):`loadPluginsWithContributionAudit` 在 `plugins/index.ts` **0** 处、`src/` 其余目录 **0** 处 ⇒ 出口既没从包口出去也没有生产调用方。
- **W3** 快照 GC 点名上账 + 拆 `checkpoints/index.ts`(现读 **397 行**):`getLastGcNotes()` 定义于 `:309`,另一处命中只是 `:326` 注释 ⇒ 零消费方,"判不出⇒不删"的原因无人可见。

## 10. 第六回合(2026-11-05 14:30–16:10)五席产出收口 + 推送结清

| 能力 | 提交(全 40 位起) | 主席自审读数(自己复跑,不采信席报自述) |
| --- | --- | --- |
| Trae 式四维工具配额**接到消费点**(MCP 注册数 / MCP 令牌 / 自定义提示 / 历史查询) | 405239526e8(W1) | `pnpm check:pytest -- tests/test_quota_wiring_b49.py` = passed 20 / failed 0 / `verdict=GREEN`;触及面既有测试合跑 = passed 58 / `verdict=GREEN`;`check-ruff-python --worktree` = All checks passed(ruff==0.16.6,.py 1686);`check-mypy --worktree` = **1 error**,位置 `app/services/workbuddy_tasks.py:948` 不在本枚 10 个路径内 ⇒ 别席在飞现场,按 §12e 不代修、不削判据,如实登记 |
| 快照存储层按 fs 适配拆档 + GC「判不出⇒不删」的原因**上账** | d71a551036(W3) | `index.ts` 397→249 且体内零 `node:fs`,fs 落 `snapshot-store-host.ts` 247;快照族 6 files / **45 passed**;新只读尺 `--self-test` 9/9 + 镜像 18/18 + 直跑 `判定 clear RC=0`;tsc 0 错。阈值按本机真实读数(45 枚 / 8,516B / 最老 0.27 天)复核后**不收紧**,数值未动 |
| Qoder 激活事件档位 + 对侧 33 条权限名入库并接 dataClass **默认拒** | 97d676acd8(W6) | 定向 4 files / **42 passed**;tsc 0 错;席报 `pnpm capabilities:check` 63/63 一致(未由本席复算,记为席报)。**取证结论**:对侧"15 种 activationEvent"实为 15 个字符串、去重仅 3 族;`onChatMention` 一族我方无宿主承载面 ⇒ 按观察如实不补(补了就是门 121 的无消费者声明),不是缺功能 |
| 技能目录缓存接上 `/skills` 真消费点 | d51703a8b3(W4 写 + W8 复核) | `npx vitest run tests/skills-catalog-wiring.test.ts` = **6 passed**;tsc 0 错(上一批登记的 `ERR_MODULE_NOT_FOUND` 环境红本轮不复现,不据此宣称别席已修)。未竟:`commands/index.ts` 的 `skills list` 仍直调 `loadSkills` |
| worktree 删除出口的**容器性断言**(与 ACL 分职)+ W-2 连账面副作用一起改对 | 78926473f1(W5 判据 + W9 接线) | 定向 4 files / **47 passed**;tsc 0 错。命拒 = 出声 + 一个字节不删 + `task.worktreePath` 保留(原 `background-registry:247` 无论成败都清账面 ⇒ 拒绝被洗成静默)。**过程教训**:W5 死于中断时把 JSDoc 写坏 —— 注释里嵌 glob 的「星号斜杠」形态会**提前闭合块注释**,当场把全仓 tsc 打成 TS1443/TS1003;主席修措辞后 W9 接完,注释内不得再出现该形态 |
| 删除保护链的**到期清理**判据 + 清理器自身的死亡机制 | c96284038a(W7) | `packages/shared` 定向 2 files / **30 passed**;tsc 0 错;门 126 `check-shared-nonde-node-purity --worktree` 候选 346 / 含内建文件 1(**不可达 1**)绿。本机 `.ihui/delete-trash` 现读 0 枚 ⇒ 本轮不产生任何真实删除;`expiry.ts` 259 行略超 250(`check-file-size` 全量档只 warn),随 adapter 那票一并拆 |

**§8c 那道卡死合并的分歧已结清**:内容级防丢闸的活文档维现认三本账(逐字族 `declaredDropCaps` / 改写形态族 / 本侧处置权族),判据单源在 `scripts/lib/union-converge-judgments.mjs`,防丢闸只举证不复算(§0.6)。逐字族的成对用例(8 例:正例销账并报名、台账没这行照旧红、产物面还留着不扣、非登记行形不扣、未喂台账与初版逐字一致、本侧对称、`dropCreditOf` 单元、形状锁「销账只改判不判红、不改少了哪些行」)由本席补在 `scripts/tests/content-loss-gate-declared-removal.test.mjs`;改写形态族与本侧处置权族已由并发三枚提交(d971ace310 / c78497e238 / edc453d125)接进 `content-loss-gate-fold-ledger.test.mjs`,两本账分文件不混写。
**推送现读**:`git-sync-converge` 第 1 轮 `origin=PUSHED`,`git rev-parse HEAD` 与远端逐字同值 ⇒ §20 的字面判据成立(本回合落地前是 12/131 分叉)。

**本回合剩下的格(逐条给归属与解锁条件,不写"已完成")**
- 回收站到期清理的**调度腿**:端内 adapter `pruneExpiredTrash` 七步 + guardian `sweepTrashExpiry()` 24h 双挂点(刻意不挂 `guardian-runner`,判机器状态 ⇒ §12e);仅 retired 才寄信(§5e-1)。解锁:主席或下一席改 `scripts/git-guardian.mjs`(高扇出,需 `immutable-exempt`)。
- 权限/命令 registry 汇总口(对侧 catalog 面)零生产调用方:席报 4 个,本席定向 grep **未能判定**(计数含定义行与注释,口径不同)⇒ 下一票先把尺子口径钉清再定性,不许照抄席报。
- `commands/index.ts` 的 `skills list` 仍直调 `loadSkills`(W8 射程外)。
- `expiry.ts` 259 行超档随 adapter 票一并拆。
- §4 既存的其余格(TCP 代理腿需常驻载体、Trae 面增量、守护面 advisory 升 blocking 的存量归零前置)本回合未动,归属与解锁条件见 §4 原行。

## 11. 第七回合(2026-11-05 17:00–18:30)三席产物 + 「到期清理」调度腿收口

| 能力 | 提交(全 40 位起) | 主席自审读数(自己复跑,不采信席报自述) |
| --- | --- | --- |
| 回收站到期清理落**端内 adapter**(七步 + fail-closed + 连败退休,判据零复算) | b709aa4ade | `cd apps/cli npx vitest run tests/trash-prune.test.ts` = 11 passed;tsc 0 错;**主席补做端到端**:新入口实跑 = `TRASH-PRUNE state=clean gate=empty manifests=0 entries=0 removed=0 failed=0 skipped=0 bytes=0`(本机 `.ihui/delete-trash` 现读 0 枚 ⇒ 空账档,零写零删零账目) |
| 权限/命令 **registry 汇总口定性落档** + manifest 别名归一化 | cb9cb55724 | 席把口径用 TS AST 钉死(排定义/注释/import-export/测试),阳性对照 `readSkillCatalog`=1 才算数;据此**五枚汇总口与两 runner 的生产调用均为 0** ⇒ 判「**待接线**」而非死码(§7 三问未过不删)。真断裂是两族声明在 `normalizeManifest` 被丢,已修并补归一化与适配器出口(11 例)。主席复跑:三文件定向合跑 **31 passed**(trash-prune 11 + skills-catalog-wiring 9 + plugin-registry-surface 11) |
| `skills list` 与 `/skills` **同源同形** + 到期判据按职责拆档 | 4c08c9baf1 | `tests/skills-catalog-wiring.test.ts` = 9 passed;packages/shared 两文件 = 30 passed;`expiry.ts` 259 → **237** 行(<250 档),TTL 解析搬进 `expiry-retention.ts`(42 行),导出集加锁;两个包 tsc 现读 0 错 |
| 回收站到期清理的**调度腿**(24h 节流 + 三态 + 仅退休才寄信) | fd1edb25bd(端内入口)+ 3e3cd3dd9f(调度腿与接线) | 新镜像 `scripts/tests/git-guardian-trash-expiry.test.mjs` = **15/15 通过**;扇出接线锁 = **8/8 通过**;`npx tsc --noEmit -p apps/cli/tsconfig.json` = 0 错;`check-file-write-safety` = 越线 0;`check-sweeper-liveness` = state=live stalled=0 undetermined=0;判据面护栏 `--range` = **state=clean 红 0**(无签名豁免 1 枚,迁移窗口内已记台账);端到端实跑一次 = 空账档零动作 |

**本回合落定的一条架构约束(踩过才知道的)**:守护腿是裸 node 跑的 `.mjs`,端内实现是 TS —— 架构契约表(`config/architecture-policy.yaml` 的 `repo-tooling`)**不含任何 `apps/*`** ⇒ 工具层**不得 import 端内实现**(门 103 D1)。故跨进程边界必须是一个文件:`apps/cli/src/tools/trash-prune-entry.ts`,守护腿用「spawn 一次 tsx 进程读它那一行结论行」取读数(与 `scripts/auto-evolve.mjs` 派发品牌邮件同一形态)。**这一格是本回合唯一踩过的架构坑,记在此处免得下一票再踩。**

### 11a. T1 席七条缺口(§5)的逐条定性(主席现读,不许照抄席报)

| # | 缺口 | 现读定性 | 归属 / 谁解锁 |
| --- | --- | --- | --- |
| 1 | AI 代码归属追踪(git-ai) | **真缺口**:本仓应用面零对位 | 本回合派席 Y1,产出见 §11c |
| 2 | 企业命令黑名单 + 命令级三段决策 | **真缺口**:本仓应用面零对位 —— `apps/ai-service/app/data/command_policy.json` 现读顶层键只有 `version / description / dangerous_patterns(28) / allowed_prefixes(31) / sensitive_file_markers(6)`,**无** black_list / immutable_paths / enterprise 三档 | 本回合派席 Y2,产出见 §11c |
| 3 | MCP/提示/历史分维配额 | **已结清** `405239526e8`(W1 席) | — |
| 4 | 声明式能力开关单源 | **真缺口,但只取两行的交集那一格**:T1 §4 要四维大表、T12 #7 要 `productForm → 能力布尔` 单源;本仓已有的 `packages/types/src/capability-catalog.ts`(机器凭据端点目录)与 `capability-extensions.ts`(扩展 manifest 校验器)**都不是**这一格 ⇒ 按**窄口径**派席 Y3(四维大表是另一票的量,本仓现状撑不起) | 本回合派席 Y3,产出见 §11c |
| 5 | 更新版本门 + 完整性校验 | **不是真缺口**:checksums 半格本仓**已有对位**(`apps/api/src/routes/artifacts.ts` 的 payload sha256 复验 + `CHECKSUM_MISMATCH` + `services/upload-integrity.ts` 的 md5/sha256 + 对应用例);另一半「apps/desktop 版本过低 → 具名 CTA」—— 本仓 `apps/desktop/src` 现读只有一个别席在飞的新测试文件,**零升级路径代码** ⇒ 无宿主承载面,按 §0.9 **不补成无消费者的声明**(与 W6 的 `onChatMention` 同型:如实不补,不是缺功能) | 已结清(结论:非缺口) |
| 6 | AI 生成 commit 模型路由 | **已有对位**(T1 自评),本回合未动 | 不列缺口 |
| 7 | SVN 仓库支持 | T1 自评「低价值,不建议」⇒ 登记为观察即可 | 不落地 |

### 11b. 台账侧(主席现读)

`node scripts/plan-tasks-merge.mjs --heal`(只报不落)现读:F1 0 组 / F2 0 行 / F3 0 处 / F4 0 副本 / F10 0 族 / 漂开族 0 ⇒ **上一轮登记的「4 组同号多行」在本枚已归零,无待裁决族**(`--match-prefix-holder` 出口本轮无调用面)。`check-plan-line-loss` 现读只剩 1 条「同编号仍有别的登记行」的**只报数**项(B31:HEAD 面只有 1 行 B31,历史面另有一行),按该门口径不进自动回捞、不参与退出码 ⇒ 不是待裁决族,不动。`check-task-claims` 现读:超龄完整租约牌 **0 枚** / 裸「（进行中）」标记 **0 枚**。

### 11c. 第七回合末批:三席并行产物(AI 代码归属追踪 / 企业命令黑名单 / 产品形态能力单源)

| 能力(对侧锚点) | 落点 | 主席自审读数(自己复跑,不采信席报自述) |
| --- | --- | --- |
| **AI 代码归属追踪**(Trae `extensions/git-ai.git-ai-vscode` v0.1.20;§5 缺口表第 1 行) | ai-service `core/ai_code_attribution*.py` 5 件 + `services/ai_code_attribution_{store,persistence,git}.py` 3 件 + `routers/ai_code_attribution.py` + CLI `commands/ai-attribution.ts` | `pnpm check:pytest -- tests/test_ai_code_attribution.py` = **19 passed**;CLI 侧 `tests/ai-attribution-cli.test.ts` = 5 passed;`check-mypy --worktree` = **0 errors / 700 文件**;水印 **19/19** 残迹 0 |
| **企业命令黑名单 + 命令级三段决策**(Trae `enterprise_command_blacklist` / `sandbox_model_escape` 进领域侧;§5 缺口表第 2 行) | `core/command_policy_merge.py` + `core/command_policy_tiers.py` + `command_policy.json` 扩两档 + `services/mcp_server.py` 接线 | 新用例 `tests/test_command_policy_merge.py` = **21 passed**;既有消费方回归 6 文件 = **348 passed**;ruff `--worktree` = All checks passed;主席另核 JSON 差异面:旧三段(28/31/6)**逐字未改**、只新增档位键 ⇒ 前端生成物**零漂移** |
| **产品形态 → 能力布尔 声明式单源**(Qoder `products.qoder` vs `qoder-cn`;T12 #7 与 T1 #4 的交集;§5 缺口表第 4 行) | `packages/types/src/product-form-capabilities.ts`(单源)+ CLI `lib/product-form.ts` + `tools/product-form-gate.ts` + `tools/index.ts` / `hooks/index.ts` 两处消费 | `cd apps/cli npx vitest run tests/product-form-capabilities.test.ts` = **15 passed**;`npx tsc --noEmit -p packages/types` 与 `-p apps/cli` 均 **0 错**;门 89 现读 R4「文档未点名」= **0 枚** ⇒ 本机制不需改 AGENTS.md |

**三席共同的纪律现读证据**:①**判据各只有一份** —— Y1 的 CLI 侧加反向锁(读命令文件源码,断言不得出现判据字面量);Y2 的裁决枚举复用既有 `Decision`,不新造 `command_rule_*` 字符串;Y3 的 `grep PRODUCT_FORM_CAPABILITIES\s*[:=]` 全仓只命中单源一处。②**每格都有真消费方** —— Y1 = `file_editor.edit_file` 两处落账 + `/api/ai-code-attribution/*` 读数路由;Y2 = `mcp_server._tool_run_command` 真实执行路径;Y3 = `registerTools` 与 `dispatchHookEntry` 两处。③**「未判定」独立成态、不折成 deny/allow/unknown** —— Y2 的 `COMMAND_POLICY_UNDETERMINED`、Y3 的 `PRODUCT_FORM_CAPABILITY_UNJUDGED`、Y1 的 `unknown` 归属三态。

**一处主席复量纠正(席报与现读不符,已退回重做)**:Y1 首报「core 248 行 / store 230 行」,主席现读为 **302 / 272** ⇒ 退回该席按职责拆档;重做后 **12 个文件全部 < 250 行**(core 聚合面 95 / verdict 121 / record 128 / stats 59 / trace 60 / store 120 / persistence 184 / git 100 / router 145 / tests 237 / CLI 命令 198 / CLI 测试 89),用例由 18 条增至 19 条。**教训**:席报的行数必须在**最后一次写盘之后当场复读**,不能引用编辑过程中的中间读数。

**三席超越轴(§0.11 第④步,逐席一句话)**
- Y1:零常驻进程(对侧是 VSCode 扩展 + daemon + 托管运行时)· 判定纯函数可测 · 三态诚实(`unknown` 不折)+ `ai_ratio` / `known_ratio` 双占比并排。
- Y2:逐条可解释(`matched_rules` 带来源档位)+ 不静默收窄(仓库档被企业档**放宽**时也出声)+ deny 档不可绕门(一次性放行与长期前缀规则都不跳)。
- Y3:缺键显式出声(对侧缺键按 false 静默降级)+ 形态轴扩到本仓真实四端 + 降权判定是纯函数。

**三席未竟项(逐条给归属与解锁条件,不写「已完成」)**

| 席 | 未竟 | 为什么没做完 | 谁解锁 |
| --- | --- | --- | --- |
| Y1 | 人手编辑面没接 | 本仓没有「人手编辑」事件源(人手在编辑器里改代码不经工具链)⇒ 表现为「没记到」,**不是**错记成 human | 需编辑器侧钩子的后续票 |
| Y1 | `session_id` 恒空 ⇒ 「按会话统计」这一维暂空 | `edit_file()` 签名里没有会话上下文,改签名影响面超出本票 | 调用层(agent_loop / MCP 工具派发腿)透传一行 |
| Y1 | `commit_sha` 恒空 ⇒ 回溯恒为「回溯不出:改动尚未提交」 | 编辑发生在提交之前,此刻**物理上**无从 blame;如实出声而不是编一个 sha | 需「提交事件回填 sha 到对应账行」的一格,或改由 `git log` 事后反查 |
| Y1 | 对侧的 checkpoint 日志那一半 | 任务面给的是二选一(CLI checkpoint / ai-service 真调用点),本席选后者先坐实服务端主链 | 与 goal-b49 剩余格同排 |
| Y2 | 多档五段默认留空 | 刻意:填任何规则都会改变某些命令的运行时判定 ⇒ 属产品决策而非形状改造 | 主席/运维;席报建议首个种子(仓库档 `ask` 加 `npm publish`;企业档 `black_list` 加沙箱逃逸族 `nsenter`/`chroot`/`docker run --privileged`) |
| Y2 | 企业快照无「下发 / 签名 / 版本协商」面 | 本仓只有「读一份本地快照 JSON」 | 平台席 |
| Y2 | 对侧枚举穷尽性(是否还有第 17 枚锚点) | 属取证席射程(需函数级反编译),本票只做行为对位 | 取证席 T1 |
| Y3 | `web/miniapp/rn` 三行无实际占用者 | 本仓今天只有 CLI 形态会被声明 ⇒ 三行是「声明契约的形状」,不是已生效的能力 | 第二个内核宿主接线那一票 |
| Y3 | 形态声明按进程生效 | 要按连接/按会话声明需另立票 | 后续票 |

## 12. 第八回合(2026-11-05 19:00–)七席并行收尾

| 能力/格 | 提交(全 40 位起) | 主席自审读数(自己复跑,不采信席报) |
| --- | --- | --- |
| 技能包归档的**解压配额腿**(S1 席未竟 3;主席自办,非席产物) | c6a64290b5 | `tests/skill-pack-archive-quota.test.ts` = 6 passed;同族合跑 3 files / **38 passed**;`apps/cli` tsc 触及面 0 错;eslint RC=0;水印 3/3。`readTar` 现逐条过 `plugins/archive-quota.ts` 那一把尺,超限在 `Buffer.from` 物化之前中止;默认档 `INSTALL_COPY_QUOTA`(数值非拍的);上限形态坏判 `unjudged` 且不放行 |
| 回收站**「恢复」的人用出口** `ihui trash list / restore`(Z2;前席的 `restoreTrashEntry` 零生产调用方 ⇒ §0.9 不成立) | 0a6868f37d | `trash-restore` + `delete-guard` = 2 files / **25 passed**;**真命令冒烟** `ihui trash --help` 现读两条子命令;席复核出原出口两处硬伤(静默覆盖已存在目标 / 恢复全程不过 ACL)已在消费方前置补齐,复用删除那同一把 `evaluateFileAccess`;席另建的 `commands/index.ts` barrel 属"只有一枚消费者却多一层中转",主席摘掉改为直接从 `trash.js` 登记 |
| 子进程网络出口**三条腿**(Z3:脱离式 relay / 真 DNS 适配器 / 裸域名取词) | 7bde582b0a | egress 三新件 + `sandbox-egress-dns` 合跑 = 4 files / **33 passed**;`tests/sandbox` 族 = 11 files / **160 passed**(零回归);水印 10/10;落地后受影响门复跑**无判红**(仅"超出复跑预算"的未跑档)。牙:relay 判拒 ⇒ 目的地 `hits()===0 && bytes()===0` |
| **六格合车**(Z1 插件贡献面接线 / Z6 分享页自写二维码 / Z9 网络命令登记 / Z7 回收站跨盘与冻结容错 —— 四格同枚落;Z8+Z11b 与 Z10 见本节末两行) | c8bd00a636e69fbd0f67422b41e9b3f11597c692(2026-11-05 20:46 主席复量落地;与 origin/main 的文件面零丢失 union 枚 = eff9c8e0f28f34eea81cb39715e55423d8a404db) | cli 侧 10 files / **102 passed** + worktree 族 2 files / **63 passed** + `apps/cli` tsc 触及面 **0 错**;`mypy --worktree` **0 errors**、ruff **0 violations**;主席另核 Z6:自写 7 档纯函数编码器(byte/M 档/v1–10)**零依赖零外链**,与已装 `qrcode@1.5.4` **逐掩码 64/64 格全等**、位图回读 8/8;Z9 补 ssh/scp/sftp 三条 network 基线效应 ⇒ 裸域名闸门自动跟长,**未登记 ⇒ `unknown` 不折成允许**,`nc` 刻意不登记(被 Z3 冻结件当"未登记"示例断言,射程外);Z7 `EXDEV` 走 `mirrorDirIntoTrash`(复制⇒两侧自证⇒记账,失败连壳清掉不留残迹)+ `sameVolume` 核验,冻结改逐条隔离 + 具名点名 + 复位出口 `--reset-strikes --reason`(≥12 字)。**席报读数(contribution 24 files/319 passed、qr 44、command-policy 90)按席报登记、未逐项复算** |
| **事件驱动增量索引装车**(Z8 增量入口/批预扫 + Z11b 去抖桥;对侧锚点 = 对照程序的 workspace 增量索引档) | c8bd00a636e69fbd0f67422b41e9b3f11597c692(同上枚,腿名 `增量索引装车`) | 三档拆分,**hash·切片·摘要·ignore 一律 import 全量判据 ⇒ 零第二把尺**(§0.6);`agent_engine` 落 `pump_incremental_index()` **真消费点**(§0.9:声明必须有消费者),实测接线次序 = **先订阅 → 再分发 → 后排空**——按字面写在分发之后会**永久丢首批**;全量路径保留**冷启动兜底**(增量断链不退化成空索引);读数 = `pnpm check:pytest` **190 条 0 失败 verdict=GREEN** + mypy/ruff 同上枚 |
| **两道守门升 blocking**(Z10;升档前置 = §12e 现读存量归零) | c8bd00a636e69fbd0f67422b41e9b3f11597c692(同上枚,腿名 `两道守门升 blocking`) | 升的两道:`2f-cli check-cli-i18n-parity`(5 locales × 511 keys 双绿、镜像 **16/16**)与 `197 check-truncation-accounting`(`--staged` 站点 0 / 绊线 0 / 取不到 0、self-test **23/23**、新建镜像 **10/10** 含「新增裸奔⇒红 / 补计数⇒绿」三对照);**225/196/190 现读非零或无法判定 ⇒ 当场划掉不升**(升不许留给别人跳门);`immutable-exempt: scripts/guardian-runner.mjs 与 197 门体只改档位字段与头注那两行,判据一字未动` 写在正文;**Z15 席复读(2026-11-05,`scripts/guardian-runner.mjs` 现值)**两条 `mode` 字段均为 `blocking` 且 `skipEnv` 成套 ⇒ 已接线;`check-gate-wiring` RC=0、`guardian-runner --staged` 升档前后 **FAIL 集逐字相同**(零新增红)。本节上一段「升档执行 = Z10 席(在飞)」以本行为终点 |

**两条当场代裁(§24,不留待拍板)**:① 裸 TCP / 不读代理 env 的客户端要机器级硬拦截属内核/驱动面(WinDivert/LSP 类),越出本仓 Node 栈且判的是机器状态 ⇒ **不落地**,出路就是这一行;② `desktop`(Tauri)Rust 侧同源腿 = 另立一票,射程 `apps/desktop/src-tauri/**`。另:Z3 头注的"登记后自动跟长"那条由 Z9 席在补 `syntax-table.ts` 的网络类命令(在飞)。

**Trae 面增量(Z4 只读普查,产物 `.ihui-agent/tmp/rea-goal-b49/Z4-triage.md`)**:旧册目录**从来没有 README**(残余散在 T7–T12 诚实清单 + 16 张 seat-handoff)⇒ 逐条对 HEAD 复验结果 = 真缺口 **10** / 已结清 **14** / 非缺口 **3** / 未判定 **5 族**。穷尽性推进两格:三枚内核 DLL 与 11-05 记录**逐字同 sha**(无二次漂移);两张主决策块按偏移反推**逐字切分恰 16 枚、零余字节**(块内不存在第 17 枚),"扩散进 ai_agent"由**推断**升为**观察**;函数级映射仍**未判定**(Ghidra >1h 时间盒,REA 5.5 min 硬预算)—— 旧册 17/22 与本席 16 不相等这一格不冒绿。

**守护面档位普查(Z5b 只读)/ 死席(Z5)**:非 blocking 共 **36** 条(runner 33 + hook 3);A 堆 21 道逐门真跑取现读存量 ⇒ **可升 10**(甲 3 现读 0 且无未判定尾巴 / 乙 7 各带一条点名前置)、**暂不可升 10**(各带现读存量数)、**永不进链 15**(判机器状态,其中 4 处现读"无人调度")、未判定 2。升档执行 = Z10 席(在飞,铁律是当场复量非零即划掉、还原不许留给别人跳门)。**死席如实登记**:Z5 在 13 分钟 / 36 次调用后 failed,崩前只写了 10 行状态件;`git status` 现读 `scripts/guardian-runner.mjs` **未被改动** ⇒ 没留半截注册面,复跑门 89 现读「R1/R2/R4 零红(已接线 389 / 文档未点名 0)」佐证全仓守门未被它打崩。

## 13. 复验命令

```bash
node scripts/watermark.mjs verify docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/README.md
node scripts/check-watermark-coverage.mjs docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105
cd apps/cli && npx vitest run tests/file-access-policy.test.ts tests/sandbox.test.ts
node scripts/git-push-converge.mjs            # 只读六态,判「是否已同步」只认这条
node scripts/git-sync-converge.mjs            # 收敛唯一入口(勿手工 fetch/merge/push 循环)
# 三席报告的复算命令各自末段(W1 §4 / W2 §4 / Q1 §5),含 REA 与 Ghidra 的 env 前置
```

## 14. 第九回合(2026-11-05 20:40–)九席并行 + 三前置裁决

本回合入库 **7 枚**。提交号一律 `git log --format='%H %s' -20` 现读取全 40 位(§1 禁短 sha;`Z23-impl.md` 表格里的 10 位短形式一律不抄)。读数列**照抄** `.ihui-agent/tmp/rea-goal-b49/Z12~Z23-impl.md` 的 §③/「验证末行」原文,不改数、不四舍五入、不合并两次读数。

| 能力/格 | 提交(全 40 位) | 主席/席自审读数(席件 §③ 末行原文照抄) |
| --- | --- | --- |
| 取证册补账:goal-b47 席 U 件 `T12-mtree-native-and-hook-host.md` 的 §1-3/§4/§5 三格(Z21 席,只读取证 + 一份 docs 账) | 814ed6b94492a648ea6a9e41e7e493dd938a9087(2026-11-05 21:07) | 该席件**没有** §③ 末行读数档(心跳只写了票面边界),承重读数写在落档正文里:`hooks.json` JSON.parse grp.async 逐条计数 `total:8, async:6, sync:2`,靶件 sha256 前 12 与 goal-b46 席**逐字相同**(`bb2502651a15`)⇒ 靶件未漂,系旧席读数口径 |
| 插件事件 `event:matcher` 真派发 + `plugin-dispatch` 单点派发口,registry 299→270 行(Z13 席) | 9cabd2097671bddce53bed5286948c7ca06ebcc2(21:39) | `npx vitest run tests/plugin-*.test.ts tests/contribution-*.test.ts` ⇒ `Test Files 26 passed (26)` / `Tests 338 passed (338)`;`npx tsc --noEmit -p tsconfig.json` ⇒ 触及面 **0 错**,全仓唯一 1 条 `src/utils/prompt-injection-registry.ts(51,3) TS2741: Property 'title' is missing`;水印 `覆盖 3/3 … 残迹 0 … 载荷损坏 0 … 仅隐写 0`;`npx eslint <本票 5 枚>` ⇒ `eslint_exit=0` |
| 命令语法表面三小格:584 行按职责切八档全 <250 + `commandSpecOf` 出口接线 + wget/nc 基线纠偏(Z14 席) | 4ed3be0e2c031028ca63cbe9475d8ef63640db8c(21:50) | `Test Files 17 passed (17) / Tests 259 passed (259)`(前一轮同一读法 1 个 suite 级失败 = `sandbox-exit-attribution` 夹具 EPERM/EBUSY 环境抖动,复跑绿);tsc 4 枚 error 中本次触及面 **0 枚**(3 枚 worktree 他席在飞 + 1 枚 `prompt-injection-registry.ts:51` 非本票射程——§12e 不削判据也不代修);水印 `覆盖 9/9,残迹 0,载荷损坏 0,仅隐写 0` |
| `apps/cli/src/tools/worktree.ts` 985→396 行五档拆净,`mirrorDirIntoTrash` 判据一字未改(Z16 席) | 0c761c6da95c4af1ac1f6c7c63e44d29e6384d95(22:28) | `npx vitest run tests/worktree*.test.ts tests/acl*.test.ts` → **Test Files 7 passed (7), Tests 99 passed (99)**;`tsc --noEmit` → worktree 面 0 错;水印 `覆盖 7/7,残迹 0,载荷损坏 0`;行数现读 worktree.ts 396 / core 95 / trash-mirror 128 / isolated 169 / tools 120 / tools-exit 194;「未 commit、未 push(遵令)」 |
| ai-service 四格合车:Z12 符号扩召回/行区间合并/目录权重六维 + Z19 阶段化遥测六段一行 + Z20 工具预算层二两维 + Z18 轮询门控三态与周期排空 | 699c786f5e2911df06b1d21ef31717159e36fbba(22:37) | Z12:`RESULT verdict=GREEN exit=0` / `跑成功 219 条,0 失败 0 错误`,`check-mypy.mjs --worktree`:`Success: no issues found in 706 source files`,ruff:`All checks passed!`,水印 `覆盖 5/5 … 残迹 0 载荷损坏 0 仅隐写 0`。Z19:`passed=20 failed=0 errors=0` · `RESULT verdict=GREEN exit=0`,mypy/ruff 本席文件 0 命中,`stage_telemetry.py 249` / `test_staged_telemetry.py 247`。Z20:`跑成功 149 条,0 失败 0 错误` / `RESULT verdict=GREEN exit=0`,mypy `Success: no issues found in 2 source files`,ruff(3 文件)`All checks passed!`,台账门 `✅ 台账 99 条 / 可判「默认关」65 个已全部登记; settings 族 13(默认关 9,J4 红域已过)`。Z18:`collected=16 passed=16 failed=0 errors=0` / `RESULT verdict=GREEN exit=0`,ruff `All checks passed!`,水印 `覆盖 3/3 …` |
| 桌面端(Tauri Rust 侧)网络出口门与 CLI 那把尺同源;内置网段表按 §0.6 拒复制并返回 `unjudged`(Z17 席) | cb0aee6bbc1e24796901213d916c54342bd3793f(22:48) | `test result: ok. 344 passed; 0 failed; 7 ignored; 0 measured; 0 filtered out; finished in 44.20s`,其中 `egress_gate::egress_gate_tests = 13 例(e1..e12 + e5b,全绿)`;`node --test apps/desktop/tests/egress-env-keys-parity.test.mjs` ⇒ `ℹ tests 4 · pass 4 · fail 0`;水印 `判定面=worktree 覆盖 7/7, 残迹 0, 载荷损坏 0, 仅隐写 0` |
| `plugins-integration` 期望随 Z13 matcher 真派发收口(5 枚 `it` 各加 120_000ms 独立时限;实现零改动)(Z22 席产物,主席落) | a80276d5a90a93acbafcb7c7a48be838055f40da(23:06) | 整档 15/15 绿(首枚实测 **49.5s**,坐实 15s 结构性不足);合跑 `tests/plugin-*` + `contribution-*` + `command-policy-*` = 29 files 全绿(含 Z14 在飞面);`npx tsc --noEmit -p tsconfig.json` 全包 **0 错**;水印 verify 完整;「他席无红需移交:无」 |

**三前置裁决(Z23 席合车落地前必须裁掉的三格,逐条给依据)**
1. **Z22 的 5 条红** ⇒ 判为「测试把冷转译成本算进用例预算」,不是 matcher 判据问题、不是实现缺陷:`vitest.config` 的 `testTimeout=15s` 撞多席并发下 `agent.ts` 全图转译(实测 12.9–45s+),第 3 条重试次抛的 `Cannot access '__vite_ssr_import_59__' before initialization` 是超时打断 import 后的**级联错态**,非环导入(plugins/** 对 commands/agent 零 import)。修法只动测试文件计时预算,判据一字未动。
2. **Z18 的降级取证档** ⇒ 并发席在飞的 `codebase_indexer.py` 工作树副本(1737 行 `SyntaxError: invalid character '。'`,而 HEAD blob 可正常解析)打断了 `codebase_incremental_index → codebase_indexer` 导入链,开档两例改走 `_attach_entry` 的 seamed 档(**同一枚 `IncrementalIndexBridge`、同一组 window/clock 入参**,增量三件判据零改动),Z11 的 `test_incremental_wiring_apply_patch.py` 真构造链当日结构上跑不起来 ⇒ **未冒充绿**。
3. **Z16 落地预检拒绝** ⇒ 走落地器**具名出口 ③**(`LAND_RESTORE_MANIFEST`,清单 `.ihui-agent/tmp/rea-goal-b49/z16-restore-manifest.json`),行级复活 1 行 `import { stashDirToTrash } from './file-batch-edit.js';`,restoredFrom=`78926473f10d687d1308e04e277fcc00f3b3e8fe`(基线祖先、blob 逐字含该行;本档 201/344 行实调用 ⇒ 无行为回滚)。**未**举 `LAND_ALLOW_STALE=1`(整闸档)、**未** `--deepen`、**未**改判据。

**本回合被现读推翻的派单书事实(逐条,只登记不辩解)**
- 派单书把 `plugins-integration` 5 条红当「Z13 派发有缺陷」→ 现读为 15s 全局时限撞冷转译(见上裁决 1);同码三跑非确定性:21:31 缓存热 15/15 全绿,21:32 与 21:34(他席并发 transform 147s)4 failed | 11 passed。
- 派单书把 Z18 的「真链路用例」当可当场跑绿 → 现读工作树副本 `codebase_indexer.py` 一度 SyntaxError,真链档只能走替模块档(见上裁决 2);该文件本席禁碰。
- 派单书所述基线已腐烂:Z22 心跳现读「任务书所述 `c8bd00a636…` 之后 main 又推进了两枚(`17ca348a12`→`e0c80612cd`→`55b41d5c25`)」,且 Z13 四枚改动在 21:03–21:06 仍停留工作树未入库。
- Z13/Z14 两席同点的全仓唯一 tsc 红 `prompt-injection-registry.ts(51,3) TS2741`:Z23 现读该文件工作树 vs HEAD **零差异**(主席已以全 40 位 `55b41d5c25e14c3a568148c2d3af460aa4656b0b` 单独入库)⇒ 两席登记时它是「别席在飞的索引层改动」,入库时已不是。
- Z15 席「主席被拒的那一格」本席**未复现**:两次落地都走 `object-space-land.mjs` 默认档通过,浅历史取不到祖先 blob 并未把「行复活/整 blob 回写」触成未判定 ⇒ `LAND_ALLOW_STALE` / `LAND_CLASH_SCOPE` / `LAND_RESTORE_MANIFEST` 三面旗一枚都没举(同型旗在 Z16 那枚才真的被用到)。
- 推送腿**未判定**,不得写成完成:Z23 收口现读 `git rev-list --left-right --count HEAD...origin/main` = `6 78`、`git-push-converge` 末行 `收敛结果: origin=DIVERGED`;`git-sync-converge.mjs` 三轮(共 5 次尝试)都落回同一句 `❌ 无冲突合并放大了活文档任务状态(1 条),拒绝推进: F9 撞号:出现基线键集里没有的编号 Y-70(共 1 组)`(base=`5ec48f47136…`/ours=`9e42b71828b…`/theirs=`a80276d5a90…`,合并树无冲突)——三条具名出口逐条验过都不成立(`--take-theirs-doc` 会丢本侧独有的 B76 千段租约行;`--fold-identical-open-rows`/`--dedupe-open-rows` 只认逐字节相同或已带归并指针的行;`--accept-state-growth` 对 F9 不开放)。
- 落档面的「两枚 docs 账」由主席代落:goal-b46 席 `T12-mtree-and-hook-host.md` §C1 表 1.0.91 行的「8 条里 5 条 async」现读为 **6 条 async / 2 条 sync**,「首次出现 `matcher`」现读位置在 **grp 层**(包裹 `hooks:[...]` 那一级)而非叶子 `hook` 层,1.0.91 的 8 条叶子共带 4 处非空 matcher ⇒ 依据 = 同目录 `T12-mtree-native-and-hook-host.md` §3 末「就地更正」表,已就地更正该两行(不抄副本、不加指针注记)。
- 门禁复跑红全部与本次内容无关,按 §12e 只报不修:门 29 push-sync(随推送腿结清)/ 门 30c 点名 `scripts/tests/{check-mobile-download-leg,check-web-rn-copy-parity}.test.mjs` 陈旧副本(他席在飞,`scripts/**` 票面排除)/ 门 41 旁支与 stale 远程跟踪引用(机器状态)/ 门 42 rc=2 未判定(点名 8 个 `apps/miniapp-taro/**`、`packages/database/**` 文件不存在,他席删除面在飞,结构上取不到输入)/ 门 277 未判定(装机根 `C:\Users\Administrator\.ihui\installed-plugins` 不存在)/ 门 275 存量 62 只报数;Z14 那枚曾点名门 30a 的 5 枚悬空 commit 未 tag(`fix(knip)`/`fix(cli)` 他席产物)与 6 道超预算未跑门,后续枚次复跑归零或转绿,无一道点名本席内容。
- 残留未落(全部是票面排除项,非漏落):`apps/cli/tests/checkpoints-corrupt-manifest.test.ts`(头注自述 goal-b49 **S3** 席产物)/ `apps/desktop/src/lib/__tests__/task-receiver.test.mjs`(索引里他席新加)。
## 15. 第十回合(2026-11-06 00:00–)第四波八格 · 主席自写(前一张写账席 Z43 死在读素材阶段,29 次调用零落笔)

### 15a. 已入库(提交号一律 `git log --format='%H %s' -25` 现读,§1 禁短 sha)

| 能力/格 | 提交 | 主席自己复量过的读数 |
| --- | --- | --- |
| 内置网段表改派生态单源件 + 生成器 + 三格对账尺 + Rust `include_str!`(Z26) | 现读取全 40 位,见 `git log --oneline -- scripts/generate-egress-builtin-list.mjs` | 六枚路径中 `generate-egress-builtin-list.mjs` 与 `packages/shared/src/utils/egress-builtin-list.json` 经 `git cat-file -e HEAD:<path>` 逐枚命中 ✓ |
| `registry.ts` 270→248(键集迁 `plugin-extensions.ts`)+ `worktree.ts` 396→223(五档,三把可改锁改指新档并**加严**)+ prettier 长行族具名豁免(Z30) | 同上现读 | `apps/cli/src/plugins/plugin-extensions.ts`、`apps/cli/src/tools/worktree-state.ts` 命中 HEAD ✓ |
| 事件驱动增量索引的关停前排空四路 + 第二条既有 2s 循环兜底(Z32) | 同上现读 | `apps/ai-service/tests/test_file_watch_drain_shutdown.py` 命中 HEAD ✓ |
| MCP `symbol_name` 精确过滤 + 段账改吃 `stage_telemetry` 单源 + 验收尺 J5 维(Z28) | 同上现读 | `apps/ai-service/tests/test_symbol_name_filter_b49z28.py` 命中 HEAD ✓ |
| 取证册 §14 与旧册 §C1 两格就地更正(Z25) | `96cf3502d0704e1b0d2c01e20b52674050868489` / `c72e99d6eb2423352bf35a787bb3bdb3f8a780ac`(Z25 自读) | 该席末行 `origin=ALREADY` 且水印 2/2 |

### 15b. 待落清单(由 Z42 合车落地,落地后必须在下一枚提交补账——**没发生的事不写成已完成**)

- Z36:apps/api 侧 `symbolName` 过滤位前移(条件进 `whereParts`、`LIMIT` 吃脱离 topK 的行预算)。主席自己复跑:`npx vitest run tests/codebase-search-symbol-name-{filter,route}.test.ts` = **2 files / 17 passed** ✓(同族 `codebase-search.test.ts` 在该端不存在,vitest 未点名 ⇒ 记「该路径无此件」而非「跑绿」)。
- Z40:卫生尺 `check-verify-tmp-files.mjs` 扩 `tmp-*` 形态射程 + 镜像 23 条。主席自己复量:全量档「verify-*.* / tmp-*.* 均在合法落点」**存量 0**、`node --test` = **23 pass / 0 fail** ✓。
- Z35:`main.py` 关停步表挂 `agent_engine_watchers`(排 mcp_stdio_bridge 后、shared_db_pool 前)+ 3 例;该席读数 pytest 10/10、mypy 0 errors。
- Z37(Z36 之后那半格:MCP 侧改下推)与 Z41(86 号门升 blocking 前置复量 + `docs/guardian-reference.md` 措辞)**本节节稿时仍在飞**,读数待补,不许预先翻勾。

### 15c. 推翻主席假设的四处现读(派单的人也要被证伪)

1. **Z32 推翻「没有 watchWorkspace 就没有周期 = 选择而非缺陷」**:fork 不携带 `watch_workspace` 字段 ⇒ 分叉后周期**结构上归零**;且确有第二条不依赖它的既有 2s 循环(`fs/watch` 的 `_watch()`)可挂兜底。
2. **Z33 抓到一枚恒真断言**:`command-policy-syntax-surface` 第⑥例把布尔塞进 `expect` 第二参、比的是同一个字符串 ⇒ 自拆档落起从未生效;反向实验(预算改 20 仍全绿)坐实,改真断言后当场翻红,已还原并证零变异残留。
3. **Z36 定位根因是位置不是缺失**:HTTP 侧「按符号取全部」做不到,是因为三腿都 **SQL `LIMIT topK*2` 先截、JS `slice(0,topK)` 后滤**,不是"库里没这个字段"。
4. **Z38 纠正本席派单书**:第二腿错误数是 **4 条**(`tmp-mcode-identity` 2 + `tmp-mcode-queue-state` 2),不是 6 条;`tmp-mcode-guard.ts` 在 include 面内但贡献 0 条。同时量出 §25 那把尺**结构上看不见 `tmp-*` 形态** ⇒ 才有 Z40 的扩射程。

### 15d. 裁决登记(不留待拍板)与合法终态

- **插件执行入口 = 已裁未开**(Z31):真拦路不是信任面缺失(`src/hooks/trust.ts` 默认拒+摘要+fail-closed 早已在场),而是 `LoadPluginsOptions` 无信任入参、`PluginDefinition` 的 JSON 路径产不出可调用体,且加执行腿必破 HEAD 的静态锁。对侧现读纠正:`catalog.v1.json` 10/10 枚带 `main`+`sha256` ⇒ **入口住宿主中央 catalog,不住插件清单**;开通道形态钉死为「约定入口+摘要台账+trust 双条件+dataClass 默认拒」四件同批。`onCommand` 保持 `reject`。
- **prettier 长行族 = 具名豁免**(Z30,`owner/expires=2027-01-31/evidence/why` + 两条到期复评出口),没选改判据;如实边界:既有 `cli/` 通配本就整片排除 apps/cli,这次买到的是把"偶然通配"换成可到期、可问责的裁决。
- **`upgradeGates` = 非缺口**(Z27):版本门三方早已接通(api `decideCliMinVersion` / web `app-version-gate.ts` / CLI `updater.ts`),另立声明维无消费者即 §0.9 空壳。
- **合法终态,不是待办**:巨型 PE 函数级穷尽性 = 未判定·射程外(Ghidra >1h,REA 硬预算 5.5min);`-F`/`ProxyJump` 值内二跳 = 诚实边界(留反例);`tmp-*.{json,md}` 刻意不收(扩展名口径以 tsconfig include 面为准);`SYMBOL_SCOPED_ROW_CAP=200` 触顶按相关度取前 200 = 为守住缺省形状未加 `truncated` 键的已知取舍。

## 16. 第十一回合(2026-11-06 03:00–13:00)第五/六波 · 死席收编与机主面分家定稿

> 本节由 Z70 写账席自写;所有提交号与读数一律本席 17:5x 现读(`git log` / `git cat-file` / `git rev-parse <face>:<path>` / 只读审计器实跑),不照抄席报。
> 票面时间跨度与实际不符一事见 16c 第 6 条。

### 16a. 入库件表(提交号全 40 位,`git log --format='%H %s'` 现读 + `merge-base --is-ancestor` 逐枚自证在 HEAD 祖先链)

| 格/能力 | 提交(全 40 位) | 本席自己复量的凭据 |
| --- | --- | --- |
| 活文档取材面三态(取不到 ⇒ 未判定,不冒绿)——Z46 席 S-26 前半格 | `2cc79d0526b37c17a36dd597113a7aad90d53354` | 该枚 subject 现读点名「Z46 席 L3957 S-26 前半格」;`git log -1 -- scripts/git-sync-converge.mjs` 链上可追 |
| 收编器台账类活文档入库前「面一致性」闸(滞后台账不得按 pathspec 直提)——Z53 席 S-26 后半格 | `c187332042e3e2d02d8155e6e54f58b4ab6ce8e5` | 同枚 subject 现读;镜像 7 例(Z54 席复跑 7/7) |
| guardian tick 覆盖面补搬,`TICK_REQUIRED` 97→98——Z48 席 RP-74 第一批 | `f651be6ca5044c382e8715e7be22aa669358309d` | Z54 席复跑 fanout 8/8 + `LIVENESS-RESULT state=idle-clean stalled=0 undetermined=0 families=3` |
| 号池鉴权面主体改承载层注入(Z51)+ uid 稳定身份键 9 例(Z47) | `7f6b68bcd499b25aeccdfbde8f622bd9d84c663b` | 用例文件 `apps/api/tests/relay-pool-uid-keysource-rotation.test.ts` 现读 IN-HEAD |
| 逐枚迁移落地闸 + 号池解锁收口一条命令 + deploy 切流前三支——Z50 席 Y-70③/S-28 | `4f55375985ed3e393dcd6d602f70948601a3c775` | 本席现读该枚 subject;`scripts/relay-account-unlock-verify.mjs` 在 HEAD,其「下一步」文案即 16d 第 6/7 行出处 |
| 鸿蒙/华为发布链矩阵与门链(Z60 矩阵改动 + Z49 合车一枚) | `cf39ffd6413f1e7b3f9ef21e04e783183fedc946` | 本席现读 `git log -1 -- scripts/mobile-release-gate.mjs` = 该枚;Z67 记的 3 面逐字对上 |
| 鸿蒙/华为两件出口脚本本体(`harmony-build.mjs`、`submit-store-huawei.mjs`)及其镜像测试 | `77d07a5d295e4af81d83f512861b520230c51f27` | 本席 `git cat-file -e HEAD:<path>` 四路全 IN-HEAD;`git log -1 --` 两枚均指该枚 ⇒ Z54 枚六「未落」已由其后的合车枚结清 |
| 旁路落地后索引对齐腿崩溃归一(桶形态 + ref 取空守卫)——Z63 判据面 | `217323b15b17c8b8d78ed1cead5c88482a1c0d6b` | `scripts/lib/landing-worktree-align.mjs` 现读 IN-HEAD;带 `immutable-exempt:` 正文行(Z63 残余 4 要求) |
| Z63 镜像 7 例(`landing-worktree-align.test.mjs`) | `14fc3af6dd13d3f6c64e490067b174cbb707c067` | 现读 IN-HEAD;本席复算 `tests 7` 的形态与 Z67 落地前的 7/7 一致 |
| 对象空间落地器补空跑与静默零推进的显式响,四档退出码自证 | `2a769677b5960321ef9d01bfe6b68f672eb62623` | 本席 `git show --stat` 现读三面(`object-space-land.mjs` + 两枚测试);**归属席未判定**:Z68 心跳文件实测不存在,不据内容反推是谁的产物 |
| 豆包提取器出界载荷补齐 `name` 同值别名(Y-25 席,Z66 残余 1 的那半格) | `1c634a38b2c5a0a972d45b804bf5f8c05e4ce7c6` | 现读 `git show --stat` = `scripts/lib/doubao-auth-extract.mjs` 单面 +11/-1 |
| 台账摘行:Y-25 两格结清、Y-24 就地改写只留 validate 落面那一格 | `796c202e17e140d337894eb75c6608b7e3fd9936`(= 本席起读 HEAD) | subject 现读逐字;活文档面本轮不由写账席动,本席未碰 `PROJECT_PLAN.md` |

**待落清单(工作树/索引现读形态,未入库 ⇒ 依 §0.3 不写 sha、不写成已完成)**

- Z66 件 1:`apps/api/scripts/relay-account-import-validate.ts` = ` M`(validate CLI 键源改吃落库口径 `resolveImportAccountUidProbe`,服务载入失败 exit 2 未判定)。
- Z66 件 3:`apps/api/scripts/relay-pool-uid-keysource-audit.ts` = `??`、`apps/api/tests/relay-pool-uid-keysource-audit.test.ts` = `??`、`apps/api/tests/relay-pool-validate-cli-uid-keysource.test.ts` = `??`(K3 下游档位锁)。
- Z58:`apps/ai-service/app/services/checkin_user_pool_bridge.py` = ` M`,`git diff --stat` 现读 28 insertions / 10 deletions;改后读数缺(见 16b)。
- Z69 起席目标(`scripts/lib/bypass-git.mjs` 的 `alignSharedIndex` 两档桶写成数字 0 ⇒ 治本):**现读未落地**,`:402` 与 `:473` 两行逐字仍是 `return { moved: 0, already: 0, … }`;Z63 只在下游 `landing-worktree-align.mjs` 加了归一守卫。
- Z54 枚六拒落的那格(`scripts/release-mobile-rn.mjs` → `./harmony-build.mjs` 悬空相对引用预检)已由 `77d07a5d295e4af81d83f512861b520230c51f27` + `cf39ffd6413f1e7b3f9ef21e04e783183fedc946` 两枚同链解结:预检要的落点当下 IN-HEAD。

### 16b. 死席登记与三档处置口径

口径(本节自定并逐张套用,不借他票措辞):**甲档** = 心跳齐备带末行读数 ⇒ 直接收编落地;**乙档** = 产物成型而读数缺 ⇒ 由后席复跑收编、台账不翻勾;**丙档** = 零落笔(死在取素材阶段) ⇒ 主席自写代结或重派,不登记为工作。

| 席 | 心跳末次写入(mtime 现读) | 距本席现读静默 | 产物形态 | 档 | 处置 |
| --- | --- | --- | --- | --- | --- |
| Z46 | 11:15:48 | 6h40m | 心跳完整:8 例末行 + 三面回查读数 | 甲 | 已由合车枚 `2cc79d0526b37c17a36dd597113a7aad90d53354` 入库;票面后半格(merge-live-doc 以工作树为底)按其席意见另开一票 |
| Z42 | 11:49:10 | 6h06m | 心跳完整:4 枚 14 面 + 推送四读数自证「未同步」 | 甲 | 六枚全在 HEAD 祖先链;其推送腿由 Z54/Z57 接手结清 |
| Z58 | 12:20:52 | 5h34m | **心跳只有「改前现场」**(行号 + 对照面 + 三面读点枚举),改后读数 0 条;工作树 +28/-10 成型 | 乙 | 代码仍在飞未入库 ⇒ 按乙档登记「产物成型、读数缺失」,**不翻勾**;派单书令「由 Z68 复跑收编」缺凭据(Z68 心跳实测不存在) |
| Z68 | 无心跳文件(MISSING 现读) | 不可测——取不到写入面 ⇒ 静默时长记未判定 | 归属不可证 | 未判定 | 按 §0.3 不冒绿也不反推:16a 那枚 `2a769677b5960321ef9d01bfe6b68f672eb62623` 只登记内容,不登记席位 |
| Z43(第十回合) | — | — | 29 次调用零落笔 | 丙 | 主席自写代结(见 §15 标题),不补登记工作 |

**「死了多久」的口径更正**:派单书给的运行时长(Z46 13 分钟 / Z42 96 分钟 / Z58 4.3 小时)在本席量测面(心跳文件 mtime + 内容完整度 + git 三面)结构上取不到对应读数源 ⇒ 本席只报**静默时长**,运行时长按未判定处理,不照抄进账。

### 16c. 推翻主席(派单书)假设的现读清单

1. **「Y-3 那格是本侧删除」不成立——实测是远端新增**。一手证据(Z57 席,本席复算 `git cat-file -e HEAD:…` = YES):基底 `c76c57d280f5f40b2e81044b1203c33494a334ce` 该路径 NO、本侧父 `c83967490e839b80809548b857bf6addd5975c63` NO、远端父 `a1b1bf04fff95a4d106c57c8229bbbf261b13047` YES;`git log --all --no-renames --diff-filter=D` 全仓 0 命中;删除意图台账 0 命中;全可达历史只有一枚新增提交 `e3c238e2ca1fb192ea48ab5319a6c799cdd5df4c`。§7 三问:承载 `renderVerifySheet` + `renderWxShareButton`;等价实现无(共享屏只收宫格/二维码,弹层与分享按钮按该枚裁决明确「定宿主」);三面消费方(`distribution/index.tsx` import、测试 `readFileSync`、生成物 input 自述)逐条在 ⇒ 不可删。
2. **`ui-routes.generated.ts` 是滞后索引,不是「该重跑的生成物」**。内容寻址:收敛当时 HEAD == origin 同 blob,而索引/工作区逐字节等于合并前 HEAD 的同路径 blob ⇒ 门 298 型「只推进 HEAD、不动索引」残留;`check-miniapp-generated.mjs`(面=head)对该路径的四端自述钉 = matched ⇒ HEAD 侧字节是真生成物。生成器 `apps/miniapp-taro/scripts/generate-ui-routes.mjs` 读工作区源,工作区当时仍滞后,**先对齐 HEAD 再重跑**才是正确顺序,当时的顺序重算只会复现被弃快照。
3. **同一型滞后回写本轮已复发**(Z57 残余 2 的预言命中,本席 17:5x 现读):HEAD 该路径 = `c544afbc80cd37b3e6c73d24f1a552dd0b849522`,而索引 / 工作区 / `origin/main` 三面同为 `0cd8f92137668a881558650e41676b4d69df3381`,后者逐字等于祖先枚 `20d8c2289f16bc9e5cd19d3170a9b180e952ab96` 的同路径 blob;`git status --porcelain` = `M `。⇒ 从该索引提交即触发门 298,不是「重跑生成器」能解释的形态。
4. **Z47 交回的「24 行/23 键 多出一枚同键重复行」归因已追到,不是持久脏行**。本席只读实跑(Z66 待落器物,从工作树跑 `--check`,零写盘):`AUDIT-RESULT state=clean rowCount=23 distinctKeys=23 dupGroups=0 actions=0 noop=0 refused=0 mappings=0 mode=check`。与 Z54 席 04:35Z 的 `rows=24 distinct=23`、Z66 席 06:15Z 的 `23/23` 连成一线 ⇒ 那枚多出行是他席 trae 写入在飞的自然结果;Z54 要求「翻勾前主席请复量这一格」现已复量。
5. **豆包采集腿那半格不属 Z66,而属他席 Y-25——且该半格现已入库**:`1c634a38b2c5a0a972d45b804bf5f8c05e4ce7c6`(出界载荷补 `name` 同值别名,+11/-1)。Z66 残余 1「不提交则 K3 声明档锁只在下游形状层成立」的前提已消;仍欠的是 Z66 自己那三件(validate 键源 + 迁库器物 + 用例),见 16a 待落清单。
6. **派单书两处事实不成立**:① 「`Z58-impl.md` 不存在」——实测存在,1943 字节、mtime 2026-11-06 12:20:52,内容是「改前现场」而非零落笔,所以按乙档(有产物无读数)登记,不按丙档;② 「由 Z68 复跑收编」——`Z68-impl.md` 实测 MISSING,复跑凭据缺位,本席不把它写成已收编。
7. **回合时间跨度**:票面写 03:00–13:00,本席现读第五/六波心跳一直写到 17:50:52(Z69),Z60 14:57 / Z66 17:13 / Z67 17:28 均落在票面窗口之外;标题按票面保留原样,实际跨度以本条为准。
8. **同步态(§20 字面判据)**:本席现读 `git rev-list --left-right --count HEAD...origin/main` = `11 0`,`git rev-parse HEAD` = `796c202e17e140d337894eb75c6608b7e3fd9936`、`origin/main` = `d6d3d747eb5d1c87ed0b624e9fd4db722b760b71` ⇒ 本地领先 11 枚,**本轮不声明「完成」**;写账席按票面禁跑任何落地/推送器物,交并发落地席推送后由下一节补账。

### 16d. 机主面定稿表(分家:机器能代做的已做完,以下每一格只缺机主职权面的供值)

前置口径(三条实测,决定「为什么没有回填这条路」):`apps/mobile-rn/.env` 与 `.env.local` 在工作树**根本不存在**(不是键为空);`submit-store-huawei.mjs` **不加载 dotenv**;四家接口凭据原文在网盘**都不存在** ⇒ 无值可回填,当前唯一生效通道 = 密钥目录里的文件。密钥根现读走 `scripts/lib/key-dir.mjs`(盘符不写死,可 `IHUI_MODEL_KEY_DIR` 覆盖);本轮**零回填、零 `.env` 改动、零新建凭据**。

| 事项 | 要什么(只要字段名,绝不含值) | 放哪 | 验证命令(整条可复制) |
| --- | --- | --- | --- |
| 华为 AppGallery(最轻的一格) | AGC「用户与权限 → Connect API → 创建 API 客户端」(角色勾“应用上架管理”)生成的 `client_id` + `client_secret`(可再带一行 `应用ID`) | 密钥根**新建** `华为Connect API密钥.txt`,逐行 `client_id: <值>` / `client_secret: <值>`;**不要改**现有 `华为appid 密钥.txt`(那枚字段是 `应用ID`/`密钥`,结构上落 HMS 旧凭据分支,实测 `ret.code=203890688` 不认) | `node scripts/submit-store-huawei.mjs`(默认 dry-run 零出网)<br>`node scripts/probe-store-channel.mjs --vendor huawei` |
| 小米应用商店 | dev.mi.com「应用管理 → 自动发布接口」的接口私钥(重置即令旧值失效)+ 开发者账号邮箱 + 包名 | 密钥根新建 `小米接口私钥.txt`(行:`接口私钥:` / `开发者账号邮箱:` / `包名: zh.ai.sq`) | `node scripts/probe-store-channel.mjs --vendor xiaomi` ——如实边界:该家 probe 的 `found` 只代表**凭据件在位**(签名腿仍打占位串),真判“对方接受”要等签名腿落地 |
| 腾讯应用宝 | open.qq.com「账户管理 → API 发布接口」的 `access_secret` + **主账号** `user_id`(官方明写子账号不允许)+ `app_id` | 密钥根新建 `应用宝access_secret.txt`(行:`user_id:` / `access_secret:` / `app_id:`) | `node scripts/probe-store-channel.mjs --vendor yyb` ——官方硬边界:API 不支持新应用发布,首包必须先在后台手工上线 |
| 荣耀应用市场 | developer.honor.com「管理中心 → 开放能力 → 凭证」的 `client_id` + `client_secret` | 密钥根新建 `荣耀API密钥.txt`(两行同字段名) | `node scripts/probe-store-channel.mjs --vendor honor`(官方对查询类限流 <3min/次,勿连打) |
| App 备案号 | 工信部备案管理系统「我的备案 → App」页签里智汇AI 的 **App 备案号**(未办则提交 App 备案,省级通管局约 20 个工作日) | `scripts/data/app-icp-filing.json` = `{"appFilingNumber":"<App备案号>","authority":"工信部ICP/IP地址及域名信息备案管理系统","verifiedAt":"<核验日期 ISO>"}`(号是公开信息,可入仓) | `node scripts/prepare-store-bundle.mjs --json`(国内店 blockers 里 `备案在册性:unjudged` 应消失)<br>**为什么现在不建**:网盘实读只有**网站备案**(`吉ICP备2025027274号-2`,主体号 `吉ICP备2025027274号`,网站 智汇社区AGI / aizhs.top),截图里「网站 \| App」页签的 App 侧没被拍进;把网站备案号写进兜底位会把法律级前置从 unjudged 直接翻成 found,正是 `prepare-store-bundle.mjs` 注释点名的“账面 ready 而法律上发不了”那一型 ⇒ 刻意不建。 |
| MiniMax Code(mcode)重登收口 | 本机 mcode 用手机验证码重新登录一次 | 无需入仓(客户端会话文件由既有回灌腿自取) | `node scripts/relay-account-unlock-verify.mjs --provider minimax --uid <池行uid>`(0 收口完成 / 1 具名拒绝 / 2 未判定;本器绝不代取凭据) |
| OpenCode 新建 key 收口 | 后台新建 API key 并放入本地文件(如 `keys.json`) | 机主自备文件,不入仓不入聊天 | `node scripts/relay-account-unlock-verify.mjs --provider opencode --closure import --file keys.json [--owner <users.id>] [--old-uid <旧行uid>]` |
| 鸿蒙外部件 ① 工具链 | DevEco Studio + HarmonyOS SDK(含 `hvigorw`) | 安装后给 `IHUI_DEVECO_SDK_HOME=<SDK 根>`,或让 `hvigorw` 进 PATH(候选位 `D:\DevEnv\Huawei`、`C:\Program Files\Huawei\DevEco Studio`) | `node scripts/harmony-build.mjs --json`(第三格「构建工具链」转 found) |
| 鸿蒙外部件 ② 签名与商店凭据 | AGC 鸿蒙 appId + 发布证书 `.cer` + Profile `.p7b` + 私钥 `.keystore` | §5d 密钥目录,文件名含 鸿蒙/harmony/ohos 即可被匹配;**不入仓不入聊天** | `node scripts/probe-store-channel.mjs --vendor harmony` 与 `node scripts/release-mobile-rn.mjs --json` 的 `store-harmony` 行 |
| 鸿蒙外部件 ③ 发布端点形态 | 已核实的鸿蒙**查询类**发布 API 端点(文档正文需登录,本器不猜 URL) | 补进 `scripts/probe-store-channel.mjs` 的 `CHANNELS.harmony`(只登记形态,判据不改) | `node scripts/probe-store-channel.mjs --vendor harmony`(由现读 `[unjudged]` 转 found/missing) |
| 鸿蒙第 4 件(不算机主面) | RN for Harmony 产物侧工程 = 独立工程票,归属产物工程席 | — | 现读:`node scripts/harmony-build.mjs` 默认 `--check` rc=1,五格逐条点名缺件(枚举到 0 判死不记绿);本机零 SDK ⇒ 构建腿结构上跑不起来,这是缺件清单而非链没接 |


<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
