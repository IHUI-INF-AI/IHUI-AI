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
| 删除保护链(回收站 + 批量两阶段护栏) | **已落地** `cf1e7f9efe`(主席统一落地,B1 席产物) | 判据层住在 `packages/shared/src/delete-guard/`,三个消费点已接线;未竟 = 回收站的"到期清理"节拍与跨端展示面 | B1-impl.md |
| 技能目录缓存的廉价判脏 + 自描述 scope | **已落地** `79597fd9fc`(B4 席产物) | 未竟两条:`readSkillCatalog` 尚未挂 `/skills` 命令;watch 失效受 `fsWatcher.enabled=false` 那一端限制 | B4-impl.md |
| 分享页去 CDN 外链(离线可读) | **已落地** `2beafada173`(B3 席产物) | 渲染器为受控子集(标题/列表/代码块/链接/粗斜体/表格),不声称全 CommonMark;阳性对照已插回旧 CDN 验证会被抓 | B3-impl.md |
| 摘掉"我方 git 可用性取决于别人装没装 WorkBuddy" | **已落地** `420e3c3c7a`(主席件,cargo 27 passed 实跑) | 兜底位改指我方 `.ihui` 目录 + 新增 `IHUI_PORTABLE_GIT` 显式登记(与 `gitdir.mjs` 同键名) | W1 §3 第⑩行 |
| 自包含诊断报告(KPI + 阶段瀑布 + findings) | **已落地** `68d68a2cc450e83a8d469ac0e122f16277f17d4f` | 执行席在传输层断掉(83 步 / 81 分钟),状态件只剩首行 ⇒ 主席按其落盘产物收口:补五语言词典(原只有 zh-CN/en)、补 25 例测试、修两处实现与声明相反的缺陷(阈值 0 档本应关判据,实现写成 `count >= 0` ⇒ 干净轨迹也报)|
| 子进程网络出口(DNS / 域名裁决那一半引擎) | **已落地** `923546ffec8e145a90c551f8c9c035eca9bc42f4`(B6) | TCP 代理腿需常驻载体(盲写未接线抽象按 §0.9 不落地)、真 DNS 解析适配器、裸域名取词、desktop 同源腿 = 未竟 |
| 文件 ACL 的 delete 轴消费点 | **已落地** `14e02e57f52337bef3a932d2b23571a84d3c6e1f` | 同一枚还修了两处:①裁决层此前挂在 `folder_trust` 缺省的提前 return 之后 ⇒ 结构性无人问(装了等于没装);②规则表 16 族漏 delete 维(读不到却能删),并加"每条 read deny 必须同管 delete"的穷尽性判据 |
| Job Object 随父而终(TS 侧) | 下一执行席 | 需 Win32 作业对象封装,与 `os_sandbox.py` 那半不同栈 | W2 §3 末条 + W1 §3-④ |
| delete 轴**残余**消费点(`git.ts` / `worktree.ts` 的 rm 点从未过裁决) | S5 席(第五回合在跑) | 上一轮这行与上面「已落地」那行**同名不同格**,现拆开。主席 2026-11-05 逐文件现读(读数 = 该文件内 rm/unlink 点数 / `evaluateFileAccess` 引用数):`git.ts` **2/0**、`worktree.ts` **5/0**、`file-batch-edit.ts` 5/2(已接,作对照样板)。残余=逐点定性(用户可控目标 vs 内部 scratch vs 结构性清理)后接线,不许一把梭全接 | `.ihui-agent/tmp/rea-goal-b49/S5-impl.md` |
| 守护面 advisory 升 blocking | 机主/下一批 | 升档前置 = 并行席改动工作流先有「带理由声明」的出口(§12e) | 存量归零后升 |
| drizzle journal ↔ sql 双向对账尺 | **已落地** `e38aad1c2c`(含两面分判改造) | 尺 warn-only 挂守护巡检轮,不进提交链;真 drift 那枚提交再同批接到人通道才谈可整改性 | B2-impl.md |
| Trae 面增量 | 未开 | 本批四席全压在 WorkBuddy/Qoder 两个新靶 | goal-b44—b48 残余见 `docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/` |
| 两道**机器状态门**(门 25 项目外路径违规 / 门 26 父目录污染) | **第五回合现读:判定面已不复现红,更正读数** | 主席 2026-11-05 现读两把尺各跑一次:门 25 = 「⚠️ 3 处 warning(不阻塞),0 处 blocking」RC=0;门 26 RC=0(点名的仍是别席 scratch,但档位只告警)。**上一轮"常年红会堵 safe-commit"这一断言在当下不成立** ⇒ 按 §12e **不削判据、不改射程、不收窄覆盖面**,只更正读数;若日后复红,出路仍是原登记的二选一(确认 `gate-audit-1104` 无主后按 §15 清理 / 对 vendored 压缩件不判并带反证用例) | 本行即更正留痕 |
| ~~**推送未落地**~~ | **第四回合结清**(合并枚 `9a9d4e733f4` + 二轮 `c3dc90805bb`,`git-push-converge` 现读 `origin=ALREADY(远端=本地)`) | 上一轮"converge 拒推进"的根因**不是判据坏了,是没走它自己给的具名出口**:本侧对 AGENTS.md / README.md 相对基底**零改动**(现读 `git diff --numstat <merge-base> HEAD -- <file>` 空),那 20 行是**继承行**而非本侧改动,远端 `1a55955234 docs(agents): 压缩 AGENTS.md 至 95,722 字节` 是有意清偿 ⇒ 正解 = `--take-theirs-doc AGENTS.md --take-theirs-doc README.md` 声明式透传(该出口的立因注释里就点过"对侧删 AGENTS.md 两行"同型)。**未削判据、未 ALLOW_STALE** | 残余两条见下 |
| 收敛后的两个非阻断残项 | 下一轮主席 | 现读读数:① `[plan-line-loss]` 工作区有 **1 组同号多候选(共 2 行)** ⇒ 拒自动回插,具名出路 `node scripts/plan-tasks-merge.mjs --heal --match-prefix-holder "<持有行原文片段>" --commit`(自动档对 F4/F4b/F10 刻意只报数);② `heal-worktree-tracked.mjs --align-drift` 在收敛器预算内被截断(rc=143),不影响收敛结论 | 本行即留痕 |

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

## 8. 复验命令

```bash
node scripts/watermark.mjs verify docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/README.md
node scripts/check-watermark-coverage.mjs docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105
cd apps/cli && npx vitest run tests/file-access-policy.test.ts tests/sandbox.test.ts
node scripts/git-push-converge.mjs            # 只读六态,判「是否已同步」只认这条
node scripts/git-sync-converge.mjs            # 收敛唯一入口(勿手工 fetch/merge/push 循环)
# 三席报告的复算命令各自末段(W1 §4 / W2 §4 / Q1 §5),含 REA 与 Ghidra 的 env 前置
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
