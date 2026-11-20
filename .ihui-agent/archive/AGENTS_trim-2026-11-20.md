<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md 体积清偿归档 · 2026-11-20(门 207 第 1 批)

- 日期:2026-11-20
- 来源文件:`AGENTS.md`(工作树基线,98,150 字节)
- 本批说明:历史叙述 / 已退役机制 / 事故复盘型整行,以及守门速查区已被主文或并集行承载的历史重复残留条文;规则条款零删减。
- 以下为整行逐字原文,未做任何改写。

## 区甲 · 头注与 §24 历史归档指针(共 2 行)

> **本文件为 2026-10-14 压缩版**:规则条款全部保留;历史叙述/失效残留/重复副本/超长登记整区逐字归档于 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`(与本文件冲突以本文为准,未写案例查归档;另见 `AGENTS_history.md`)。2026-10-21 压缩前原文在 `.ihui-agent/archive/AGENTS-pre-compress-2026-10-21.md`。
原「须用户确认」整节(暂停 → AskUserQuestion → 显式同意)逐字归档 `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`,本仓不再走该流程。

## 区乙 · §12h 退役节复盘/外置指针与速查导航注记(共 5 行)

- 2026-10-21 撤装:自动回收器 reap-worktrees.mjs 与计划任务 IHUI-Worktree-Reap 已卸载;ensure-silent-tasks.mjs 的 ④ 回收链路监视段随之摘除,不得复活。
- worktree 共享 `node_modules` 的急救口径与迁移五步(2026-11-07 机主令,整段外置以守本文件体积上限)见 `docs/tickets/2026-11/ops-worktree-node-modules-20261107.md`。
- **孤儿目录壳清扫腿(2026-11-11 立)**:并入 `--reap`,器物 `scripts/agent-worktree.mjs --purge-orphan`;调度 `scripts/lib/git-guardian-worktree-reap.mjs` 24h 派 `--reap --apply --older-than 1`(调度零改动);判据与动作单源 `scripts/agent-worktree.mjs`(§22c),两段式墓碑 + 常驻槽位/兄弟白名单 + 跨进程互斥锁,10 项代码审查收口见该文件头注。
<!-- 门名重复行已于 2026-11-19 裁入 .ihui-agent/archive/AGENTS_gate-index-dedupe-2026-11-19.md(门 207 预算);R4 可见性由下方并集行承载。 -->
- **全文指针**:本节全部条文(横向口径 / 逐门导读与判据面 / 调度与豁免 / 常驻工具清单 / 门名索引)已于 2026-11-04 **逐字迁入** `docs/GATEKEEPERS.md` §「守门脚本速查(自 AGENTS.md 迁入 2026-11-04)」;此后新增门条文/新纪律**先落 `docs/`,本体只加一行指针**(门 207 体积 96000B 硬顶,不靠豁免腾位)。

## 区丙 · 守门速查区历史重复残留条文(门名由并集行与 README 承载)(共 14 行)

8. **文档不得写跑不通的出路**:给用户的每条命令必须真跑得通;应急跳过变量以 `scripts/guardian-runner.mjs` 注册条目现值为准,本文不逐枚罗列;本轮五门(288/292/290/291/298)的跳过变量并入 `docs/GATEKEEPERS.md §6.3`。
- **屏/路由/小程序页登记同步由门 302r 判**(`check-screen-registration-sync.mjs`):提交期双向对账——加了屏/路由却没登记、登记了幽灵键、小程序 pages 与页面文件不同步 ⇒ 红;warn 档只报数不阻断,push 面由 302p 兜底;无应急跳过变量;自检 `node --test scripts/tests/check-screen-registration-sync.test.mjs`。
- **旧 blob 回写由门 298 判**(`scripts/check-staged-downgrade.mjs`):暂存内容**整 blob 逐字**等于该路径某枚祖先提交、而 HEAD 已有更新版本 ⇒ 红并点名「路径 + 祖先 sha + HEAD oid」;确属有意回滚须在提交正文写一行 `intentional-revert: <依据>`(≥8 字符)⇒ 放行并留痕 `.ihui-agent/state/intentional-revert.jsonl`;应急 `HUSKY_SKIP_STALE_DOWNGRADE=1`。写手侧同一判据(`scripts/lib/ancestor-downgrade.mjs`)已前置到 `gen-ui-mirror --apply`:派生结果若逐字等于祖先旧档,一律拒写并点名 `downgrade=`。
- **屏/路由登记同步由门 302r 判**(`scripts/check-screen-registration-sync.mjs`):提交期只报数(warn 档,不阻断)——新增 web 页 / RN 屏必须能在 `scripts/data/web-rn-screen-map.jsonl` 找到认领,新增小程序页必须进 `app.config.ts` pages / subPackages;幽灵登记键、pages 双向不一致同判;push 面兜底仍由 302p 承担;自查 `node scripts/check-screen-registration-sync.mjs --staged`;应急 `HUSKY_SKIP_SCREEN_REGISTRATION_SYNC=1`(跳过留痕)。
- **归档机制(2026-10-16 退役)**:现行口径 = 完成即整行删除,退役器物与旧命令**不得恢复**;原「归档机制」全条(含防误删防线与历史残余 tag)见 `.ihui-agent/archive/AGENTS_history_2026-11-03.md`。
- **一键级联入口(2026-11-04)**：改完任一端先跑 `pnpm sync:cross-end`（2026-11-05 起为**真预演**:各写盘段跑自己登记的零写 `preview` argv,并把"本轮有待落"报成 `pending`;拿不出零写档的段点名跳过,那不等于"没活"），`sync:cross-end:apply` 才落盘；按依赖序跑完派生→落档→造页→重建→校验（段数看 `STAGES`，文档不写死），含「屏覆盖 / props / 措辞」三把功能尺与 `gen-ui-mirror` spec 派生。本层零判据，只派发既有器物。
- **A3/B3 挂账面(2026-11-03 立)**:A3 挂账条目须 owner/expires/evidence/rationale 齐全且 expires ≥ `2027-01-31`(`ADVISORY_MIN_EXPIRES`),认领少于现读即红;门 291 的 B3(`B3-synonym-drift`)按语义族配对 + 归一化取值比较。
- **12i 暂存内容比 HEAD 更旧必须判红(旧 blob 回写,门 298,2026-11-03 立)**:暂存 blob 逐字等于该路径某枚祖先 blob、而 HEAD 已更新 ⇒ 红(点名路径+祖先 sha+HEAD oid),这是"`git add <file>` 交旧基线"的机器化;祖先窗口默认 80 枚,判据单源 `scripts/lib/ancestor-downgrade.mjs`。合法回滚唯一出口 = 提交正文行首 `intentional-revert: <依据>`(大小写不敏感、依据去空白 ≥8 字符),放行并留痕 `.ihui-agent/state/intentional-revert.jsonl`;自查 `node scripts/check-staged-downgrade.mjs --staged`,应急 `HUSKY_SKIP_STALE_DOWNGRADE=1`(跳门留痕)。
- 2026-10-21 撤装与 2026-10-30 补刀①③④(计划任务残留、TEMP 清扫三层、worktree 注册表 5 处产出点封口)的现场叙述全文见 `.ihui-agent/archive/AGENTS_history_2026-11-03.md`;规则结论不变:reap 不带 `--tag-lost`、超预算单列 `overBudget`、删 worktree 目录的每个出口必须补 prune。
  UI 改动必须真机/真浏览器验证(截图或 e2e),禁止只凭代码审查声明"改好了";web 样式改动 commit message 带 `Verified-DOM:` trailer(`check-style-verification.mjs`,commit-msg 已去掉 `|| true`;三态 0/1/2,缺参/git 失败/msg 读不到 = exit 2 阻断)。
- **禁止硬编码 C 盘路径作写入目标**(`C:\temp\*`、`C:\Users\*\AppData\Local\Temp\*` 等;用 `os.tmpdir()`/`$env:TEMP`)。守门:`check-c-drive-paths.mjs`(45,源码字面量;guardian 以 `--staged` 调用,三态 0/1/2,无 `--staged`/git 失败/读不到 = exit 2 未判定,空暂存区 = 0 不适用,warn 档不阻断)、`check-c-drive-pollution.mjs`(93,warn,实地扫 C 盘 + TEMP 漂移判据,只读永不删;`--strict` 问责)。
- **迁移正文不可变**(185,2026-11-07 机主口径):已进 journal 的 .sql 禁就地改正文(IM1 首次入库 blob 对照/IM2 索引 vs HEAD);守门 49 记账结构(B1-B5 离线,B6-B9 连库)。**唯一例外**:只允许修「从零库必挂」的缺陷——已推且在任何环境成功跑过的迁移一律不改;从零库建不起来等于任何新环境都建不起来,修它属修 bug、不属于改历史。判定不看注释与口头担保,只看全新空库整链 PASS1:该条通不过即属例外可修,通过则必须还原上游原样。**受管 `.env` 键值被清空对账** `check-env-drift.mjs`(守护巡检档,判机器状态不进提交链)。
- **R3 五枚接线点名(R4,2026-11-04)**:293-297 = `check-plan-row-length` / `check-panel-metric-exists` / `check-hairline-separator` / `check-retry-aliases` / `check-permission-lease-bounded`,均 blocking,编号/`skipEnv` 以 runner 现值为准;294-297 真执行点 = CI 或 `IHUI_GATE_SCOPE=full`(本地只跑元门档)。
- **门名点名(R4 去后缀同名命中面)**: check-agents-doc-size.mjs check-alertmanager-live-config.mjs check-autonomy-invariants.mjs check-autonomy-leg-health.mjs check-cross-end-parity-drift.mjs check-dead-script-refs.mjs check-dev-db-rotation-window.mjs check-dispatch-premise.mjs check-findings-freshness.mjs check-gate-face-discipline.mjs check-gate-wiring.mjs check-git-probe-headroom.mjs check-hairline-separator.mjs check-hand-migration-snapshot.mjs check-hook-chain-refs.mjs check-immutable-guard.mjs check-landed-reverts.mjs check-lesson-draft.mjs check-like-wildcard-escape.mjs check-mirror-purge-intact.mjs check-monitor-alert-vocabulary.mjs check-monitor-runtime-parity.mjs check-ops-patrol.mjs check-panel-datasource-wiring.mjs check-panel-datasource-wiring.test.mjs check-panel-metric-exists.mjs check-permission-lease-bounded.mjs check-plan-deferred-expiry.mjs check-plan-row-length.mjs check-pool-isolation.mjs check-pwsh-version.mjs check-readout-no-break.mjs check-redirect-target-origin-pinned.mjs check-retry-aliases.mjs check-rn-host-shell-coverage.mjs check-rn-readout-cell.mjs check-service-inventory.mjs check-sms-channel-health.mjs check-temp-landing.mjs check-tracked-ignored.mjs check-typecheck.mjs check-typography-face-coverage.mjs check-button-border-color.mjs check-shadow-single-source.mjs check-acp-method-registration.mjs check-apk-abi.mjs check-worktree-dev-banned.mjs check-staged-artifacts.mjs check-acp-error-mapping.mjs check-import-integrity.mjs check-border-system.mjs check-line-endings.mjs check-mirror-surface-parity.mjs check-runtime-tmp-landing.mjs check-admin-password-frozen.mjs check-plan-claims-vs-head.mjs check-ref-move-loss.mjs check-api-liveness.mjs

## 区丁 · 构建事故复盘与参考外置条(判据门由 README 或主文承载)(共 5 行)

IHUI-AI 全栈 AI 平台(TS Monorepo + pnpm workspace + Turborepo),8 端(2026-10-03 起 apps/assistant 已服务端化并入 ai-service):`apps/api`(Fastify 5 + Drizzle 0.38 + PostgreSQL)、`apps/web`(Next.js 16 + React 19 + Tailwind 4)、`apps/ai-service`(FastAPI + LangGraph + LiteLLM + MCP)、`apps/miniapp-taro`(Taro 4)、`apps/desktop`、`apps/extension`、`apps/mobile-rn`、`apps/cli`;共享层 `packages/`(database / auth / types / ui / config / eslint-config / tsconfig / shared / api-client / design-tokens / app / ui-react / ui-native / i18n 等)。
- **Android 原生构建 MAX_PATH(2026-10-21 立)**:`react-native-worklets` 的 CMake 报 `build.ninja still dirty after 100 tries` 或 `mkdir(... .pnpm/react-native-worklets@0.11._…): No such file or directory`,是 Windows 260 字符路径上限,不是缓存脏:`LongPathsEnabled=1` 已开而 SDK 自带的 ninja 1.10.2 不认长路径。修法 = 换 ninja 1.12.1 覆盖 `Sdk/cmake/3.22.1/bin/ninja.exe`;`CMAKE_SUPPRESS_REGENERATION=ON` 只消 dirty 循环,`CMAKE_OBJECT_PATH_MAX` 无效。模拟器 debug 包连 Metro 走 `10.0.2.2:8081`(本机 AVD 的 `adb reverse` 不通),且须先清模拟器全局 `http_proxy`。
- **`deprecated-source` 是节律现象,不是工单**:本机 v6 源地址约每 12 小时退化一次,重启 Cloudflared 实测约 3 分钟入口 530。收到信先看 `held=` 与 `restart-churn`:同日已重启或崩溃循环正在抖 ⇒ 不要再重启;真要动挑无人窗口并预先告知影响时长。
- 翻译策略 source of truth:`scripts/brand-glossary.json`;ICU 插值走 `t(key,{vars})`,禁 `.replace('{{n}}',…)` 反模式(`check-miniapp-replace-antipattern.mjs`)。
- **桌面事件接线三层对账**:`check-desktop-event-wiring.mjs`(Tauri emit → listen → 前端注册;"就绪点亮"按可达性判,被抽进被调函数也算,允许一跳)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
