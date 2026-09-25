<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# O60r 欠项转正清单(B 类 45 张复测后)

取证基准:HEAD = `bb4d2b670b1`(2026-09-26 本轮实测);全部判据走 `git -c safe.directory=* grep/show/ls-tree ... HEAD`,不判工作树。
占用判定 = `git status --porcelain -- <file>`(整仓脏路径 89 项已逐一比对)。
报告基线:`docs/plan-audit-2026-09-25/report-{1..8}.md` + `code-*.md`(编码批次)。
**总口径**:自 09-25 审计以来 HEAD 已推进百余枚提交并混入两批编码交付 —— 45 张里相当一部分欠项**已被补上或正被并行会话做**;本清单只把「仍欠 ∧ 此刻无人占用」的转成可派单条目。

## 可直接派单(仍欠 ∧ 无在飞冲突)

| 优先级 | 票 | 一句话动作 | 验收判据(可复制命令) | 触达文件 | 端 |
| --- | --- | --- | --- | --- | --- |
| 1 | D48② | 把 `ihui-vault.json` 加进 `.gitignore`(结构性保证密钥不入仓) | `git show HEAD:.gitignore \| grep -ci ihui-vault` 由 0 → ≥1;跑 `node scripts/check-desktop-cache-plaintext.mjs --self-test` 不破 | `.gitignore`(干净) | packages/仓库 |
| 2 | D19② | extension 端接 `terminal_delta`(仿 cli `agent.ts` 的 `onTerminalDelta` 透传);或把豁免理由改写成"该端无终端流面板"并同步台账 groups 文案 | `git grep -n -i "terminal.\?delta" HEAD -- apps/extension` 非空;`node scripts/check-agent-event-parity.mjs` exit 0 | `apps/extension/lib/agent-control-bridge.ts`(干净;注意 `sdks/go/go.mod` 等他票在飞,勿碰) | extension |
| 3 | D107① | 给"阶段标签"层立机器判据(哪帧带阶段、各端有无渲染)并入守门 57 台账 `chat-flow-elements.json` | `git grep -n "阶段标签" HEAD -- scripts` 由 0 → 非 0;`node scripts/check-chat-element-coverage.mjs --staged` 计数不倒退 | 新门脚本 + `scripts/data/chat-flow-elements.json`(干净) | scripts |
| 4 | O13b② | `ADMIN_ROLE_ID` 归一:把 `require-permission.ts:16` 的本地 `const ADMIN_ROLE_ID = 1` 改引 `utils/idor-guard.ts` 叶子模块(该模块已在 HEAD,只差消费收口) | `git grep -n "const ADMIN_ROLE_ID = 1" HEAD -- apps/api/src/plugins/require-permission.ts` 为空;`pnpm --filter @ihui/api typecheck && pnpm --filter @ihui/api test -- idor-guard` | `apps/api/src/plugins/require-permission.ts`(干净) | api |
| 5 | O13② | `rls-context` 把 `app.user_id` 落到受控出口所在的**应用池**(现 `:35` 仍 `import { db } from '../db/index.js'` 只作用主池) | `git show HEAD:apps/api/src/plugins/rls-context.ts \| grep -c "appPool\|createScopedDb\|withScopedContext"` 非 0;`pnpm --filter @ihui/api test` 全绿 | `apps/api/src/plugins/rls-context.ts`(干净) | api |
| 6 | D30① | 把"CI 红/失败测试/扫描告警"接进自动认领:`agent-event-trigger.ts` 扩 `ci_failed`/`gate_failed` trigger kind + `.github/workflows` 侧投递 | `git grep -n -E "ci_failed\|gate_failed" HEAD -- apps/api/src` 非空;`pnpm --filter @ihui/api test -- agent-event-trigger patrol-scheduler` | `apps/api/src/services/agent-event-trigger.ts`、webhook 路由、`.github/workflows/`(均干净) | api+CI |
| 7 | D30② | 修复结果开 PR:`apps/api/src/services/github-app/` 新增 `pr-creator.ts`(复用 coord/鉴权,不抄第二份 GitHub 客户端) | `git ls-tree -r --name-only HEAD \| grep pr-creator` 非空;新用例 `unattended-fix-loop.test.ts` 断言三段可追溯(全 mock,禁连 8810/8811) | `apps/api/src/services/github-app/`(干净) | api |
| 8 | D64⑥残 | goal 卡对照表定档的 4 条差距(编辑目标文本 / 进行中已持续时长 / 折叠态持久化 / budget_limited 第 5 态)——**只派其中未被在飞覆盖的"编辑目标文本 + 折叠态持久化"两小件**;"持续时长"一件缓派:`d89-goal-card-achieved-time.test.tsx` 此刻为脏(他人在做) | `git status --porcelain -- apps/web/src/components/ai/goal-card.tsx` 派单前必查(当前干净,但邻测试脏);`pnpm --filter @ihui/web test -- goal-card` | `apps/web/src/components/ai/goal-card.tsx`(干净) | web |
| 9 | D13①② | 上下文装配面板条目加"可点击跳转源"+核对被引用元素 `id` 锚点对四类注入可得(现 `scrollAndHighlight` 只在 `citation-bar.tsx` 存在) | `git grep -n "scrollAndHighlight" HEAD -- apps/web/src` 命中面扩到装配面板宿主文件;`pnpm --filter @ihui/web typecheck`;e2e 或 DOM 断言点击后目标高亮 | `apps/web/src/components/ai/progress-sections/citation-bar.tsx`(干净)+ 装配面板宿主(派单前跑 `git ls-tree HEAD \| grep -i assembly` 定位) | web |
| 10 | D33① | ai-service 侧立 `queueItems` 数据面(`_fire_callback` 产出该字段;现 HEAD 零命中);`subagentActivities` 落库形状等 D40③ 裁定,**不随本票猜** | `git grep -n "queueItems" HEAD -- apps/ai-service/app \| grep -v test` 非空;`cd apps/ai-service && python -m pytest tests -k "queue or callback" -q` | `apps/ai-service/app/`(queue 相关文件干净;`routers/llm.py` 脏勿碰) | ai-service |
| 11 | D29①②③ | 团队知识引擎三件:team 作用域存储+检索过滤 / 成员修正通道(现仅作者自改 `PATCH /:id`)/ 过程审计表写入(④量化对标属定档项,不入本票) | `git grep -n -E "visibility\|teamId" HEAD -- apps/api/src/routes/knowledge` 非空;新表走 `packages/database/drizzle/` 且 `node scripts/check-migration-bookkeeping.mjs` exit 0(**建表类:本机 `netstat` 实测 8810 零监听,`--db` 验收不可用,按守门 49 离线判据 B1–B5 并显式标注**) | `apps/api/src/routes/knowledge*`、`packages/database/src/schema/`(干净;`drizzle/meta/_journal.json` **当前为脏** ⇒ 建迁移有撞 journal 竞态,**派单需等其收敛或主代理串行**) | api+packages |
| 12 | D6①② | 编排收敛第一步(决策件):在 `PROJECT_PLAN.md` 显式记录"暂不切 `AGENT_EXECUTOR=loop_v2`"或切档;再把四套编排路由(agents-kanban/orchestration/crew-orchestrator/team_orchestration…)向 `agent_loop_v2` 单一构造入口收敛。**整体是大工程,先派"决策记录+薄适配层试点"一小步** | `git show HEAD:apps/ai-service/.env.example \| grep AGENT_EXECUTOR` 或已切 `loop_v2` 或台账有"暂不切"记录;`node scripts/check-agent-engine-parity.mjs --quiet` exit 0 | `.env.example`、`app/core/config.py`、编排四路由(全部干净) | ai-service+api |
| 13 | D80①(=D81⑦) | 消息流内 workflow widget(经既有 `ArtifactCanvas` 通道,禁新建内联渲染栈)。先做小样:一个只读呈现 + 用例 | 报告判据仍在:HEAD `git grep -n workflow HEAD -- apps/web/src/components/chat apps/web/src/components/ai/progress-sections` 为空 → 落地后非空;**注意 `MessageList.tsx`/`use-chat/*` 此刻脏,派单须避开或等收敛** | `apps/web/src/components/chat/message-list/*`(部分脏) | web |

> D17④(miniapp/rn 生态聚合入口)与 D38① 的 web 宿主、D62③、D41、D91、D111、D36、D69、D73、D77、D14、D58③、D64⑤、D20 全部**不在此列** —— 触达面被在飞会话占用,见下节。

## 在飞占用(仍欠,但此刻不得派单;占用证据 = 工作区脏/未跟踪)

- **D20**(文件夹/标签/PDF 导出):`apps/api/src/routes/chat.ts`、`packages/database/src/schema/chat.ts` 均为 `M`,且未跟踪 `20260924100000_chat_history_projection.sql` 在途;HEAD 实测 export 仍 `z.enum(['txt','md'])`、folder/tag 零命中。
- **D14**(镜像缓存/队列/看板):未跟踪 `apps/ai-service/app/services/sandbox/` + `test_sandbox_{image_cache,queue,board}.py` —— 并行会话正在做本票欠项。
- **D64⑤**(问卷宿主接线+结构化落库):`FeedbackSurveyCard` 生产消费者仍 0(命中仅其自身测试);宿主邻域 `MessageList.tsx` 脏,落库另需新表(无 PG 端口)。
- **D73**(PaneSplitContainer 宿主挂载):未跟踪 `pane-split-mount.test.tsx` —— 正在装车。
- **D41**(preview/源码切换 + `data-artifact-preview-kind`):HEAD 零命中;`media/__tests__/office-preview.test.tsx`、`office-annotation-anchor.test.tsx` 脏。
- **D91**(PDF/PPTX 坐标注入渲染位 + anchor-label 接线):HEAD `annotation-anchor.tsx` 已有 pdf/pptx 标签分支但 `AnnotationAnchorLabel` 生产 import 仍 0;`chat/annotation-anchor.tsx` 脏。
- **D111**(移动端权限三键/守门57登记/G-161 枚举唯一真源):HEAD 三键 0 命中;但 `permission-tier-text.ts`、`ChatDisclosure.tsx`、未跟踪 `chat-disclosure-tier-approval.test.tsx` 全在途 —— 正是本票工作面。
- **D36**(prompt-drafts 共享实现/多端/切会话用例):未跟踪 `apps/web/src/hooks/use-prompt-drafts.ts(+test)` 在途。
- **D38**(interjection 生产者 + 移动宿主):`message-input.tsx`、`ChatScreen.tsx`、`packages/types/src/agent-control.ts` 脏;e2e 自述"全仓尚无协商生产者"。
- **D58②**(类目层沉共享):web 与 shared 两份 `tool-category.ts` 均脏。
- **D69**(四族欠项):`message-input.tsx`、`auto-topup-settings.tsx`、`shared/chat/auto-topup.ts` 脏;`InputNoticeBanner` 仍仅测试消费。
- **D17③/D78**(connector-auth-card 接线):组件与其测试均脏。
- **D19①** 的 miniapp-taro / mobile-rn 半边:`apps/miniapp-taro/src/api/index.ts`(守门点名的 dispatch 表)与 `ChatScreen.tsx` 脏;**cli 半边已补上**(见下)。
- **D62②③**:宿主挂载已补上(见下),但 `voice-subtitle-bar.test.tsx` 脏,prop 真连线与 e2e 缓派。
- **D64⑥残**之"进行中已持续时长":`d89-goal-card-achieved-time.test.tsx` 脏。

## 已补上(实测,不再派单)

- **D81②~⑥** — `git grep "tool-activity-line" HEAD -- apps/web/src` → `tool-call-card.tsx:38` 真实 import + `:1080/:1197` 渲染点 + `tool-activity-line-wiring.test.tsx` 反向装车锁(code-d81 批次已入库)。
- **D85** — `apps/web/src/components/ai/__tests__/review-stats-bar.test.tsx` 在 HEAD(7 条用例;code-d85 交付)。
- **D67①** — `FallbackBanner.tsx:179 <QuotaOwnershipCard` + `MessageErrorCard.tsx:19` import + `fromErrorCode` 走 shared 层(code-d67 交付);②③(后端 errorCode / 折扣数据源)仍欠,未见对应改动 ⇒ 留在 D67 票内,`git grep -n "topup-discount\|discountDeadline" HEAD -- apps/web/src` 现仍为空。
- **D83①** — `git grep "describeMcpToolActivity" HEAD` → web `task-status-bar.tsx:154`、`tool-call-card.tsx:938`、miniapp `cards/tool-line.ts:57` 三处装车(code-d83 交付)。
- **D16①②** — `llm_gateway.py` HEAD:1032/1034 实测 `router.route_live(**kwargs)` / `router.route(**kwargs, budget_usd=budget_usd)`,budget 有 env 供给 `_auto_route_budget_usd_from_env()`(code-d16 交付);**残 ③**:`from_catalog(` 仅命中注释行(:957/:960)与 `:1024 ModelRouter.from_catalog(models=pool)` —— 1024 即真实调用,故 ③ 也已补上,派单前复跑 `git grep -n "ModelRouter.from_catalog(" HEAD -- apps/ai-service/app/core` 应为非注释命中。
- **D17①②** — `apps/web/app/(main)/ecosystem/page.tsx` 在 HEAD(含"专家包组合"文案)+ `GlobalTopBar.tsx` ecosystem 引用 22 处(code-d17 + code-d17topbar 交付)。
- **O20c(repo 侧)** — `deploy/win/ihui-pg-backup.ps1`/`ihui-pg-backup-role.sql` 已入库且经 `scripts/secret-path.mjs db-backup ihui-backup.txt` 取凭据;跟踪面 `git grep "PGPASSWORD" HEAD -- deploy scripts` 已无静默空回落。剩余为**机器态**:每日备份是否恢复成功须在部署机核验,本机(无 PG)不判。
- **D64⑥** — 对照表已产出并翻勾:HEAD `PROJECT_PLAN.md` L7305 `- [x] ✅(2026-09-25) D64⑥ …逐字段对照表已产出`,定档 4 差距(已拆入上表优先 8)。
- **O13b①**(idor-guard 落库)— `apps/api/src/utils/idor-guard.ts` 已在 HEAD(报告时"最后一枚未迁"已解);残留仅 ADMIN_ROLE_ID 消费收口,转上表优先 4。
- **D19(cli 半边)** — `apps/cli/src/commands/agent.ts:417-741` 实测 `onTerminalDelta`/`takeTerminalDeltaLines`(2026-09-25 接)。
- **D62①** — `voice-toolbar.tsx:400 <VoiceSubtitleBar` 生产挂载 + `voice-subtitle-mount.test.tsx` 装车回归在 HEAD。
- **D80②的半边** — Python SDK `respond_elicitation`(`packages/sdk/python/.../agent_engine.py:583`)在库;TS 侧桥接仍 0 消费 ⇒ "桥 or 定档两套语义"属 owner 决策,不是可直接派单件。
- **D48①/O59(盘上正面证据)** — 属机器态(桌面端登录产物取证),本机无服务在跑,不构成可派单代码项;报告判据 `node scripts/check-desktop-cache-plaintext.mjs` 待有登录数据的环境执行。

## 判据过期(需改写报告里的前提)

- **D58** — 报告写"票面 20 类 vs 表 18 档";实测 `git show HEAD:apps/web/src/components/ai/progress-sections/tool-category.ts | grep -cE "order: [0-9]+"` = **18**。新前提:票面文字应改 18 档,类目数不是欠项;真欠项只有"沉共享包"(在飞)。
- **D83②** — 报告写"票面落点 `packages/shared/src/chat/tool-display.ts` 未扩三层";实测三层(实为五层回落)在 `packages/shared/src/chat/mcp-tool-activity.ts` 且已三处装车。新前提:接管关系以 `mcp-tool-activity.ts` 为单一措辞层,`tool-display.ts` 若确认零消费可另开删除票(派单前 `git grep -c "tool-display" HEAD -- apps packages` 复测)。
- **D19** — report-8 写"mobile-rn 已真接、真缺口收窄为三端";当前 HEAD 对 `apps/mobile-rn` 大小写不敏感 grep `terminal.?delta` **零命中**。新前提:rn 半边回到欠项池(且此刻 `ChatScreen.tsx` 脏,系他人在途);登记"已接"结论不得照抄报告,以 `git grep -n -i "terminal.\?delta" HEAD -- apps/mobile-rn` 现测为准。
- **O13①** — 报告写"`ENABLE ROW LEVEL SECURITY` 未执行";实测 HEAD 迁移 `packages/database/drizzle/0066_rls_tenant_isolation.sql:76-78` 已含 ENABLE 语句。新前提:repo 侧已备,"已执行到库"须在有 PG 的环境按守门 49/`--db` 判,本机不可判。
- **守门57 elements 判据** — 报告用 `"status": "planned"` 计数,实测 `git show HEAD:scripts/data/chat-flow-elements.json | grep -oE '"status": "[a-z]+"'` 为空 ⇒ 该文件状态字段名/形态与判据串不符,派 D107/D111② 前先量真实字段形态,别按旧串写门。

## 已排除及原因

- **D77** — 欠项触达 `apps/ai-service/app/core/sse_contract.py` 与 `routers/llm.py`,二者此刻均为 `M`(并行会话占用);`business-form-section.tsx`/`pane-split-mount`/`business-form-mount.test.tsx` 未跟踪在途,重复派单即撞车。
- **D35 / D43 / D68** — 他人在写:`agent-control.ts`(routes+types)、`cloud-chat-ops.*`、`use-agent-control.ts`、`agent-control-bridge.ts` 及三个 `agent-control-addressing` 测试全部在途,本轮三票零介入。
- **D31** — 卡 Figma 凭据:实测 `D:/BaiduSyncdisk/密钥/模型/` 无 figma 文件(grep -ci = 0),F: 盘为本机密钥根(`F:/BaiduSyncdisk/密钥/` 在位)但模型目录同样无 Figma 供给;无凭据则验收不可能,属外部资源阻塞而非代码欠项。
- **D50① / D86** — 需新建表且本机无 PG:`netstat -ano | grep -cE '0.0.0.0:8810|127.0.0.1:8810'` 实测 = **0**(端口不在=开发机形态),迁移在本地既应用不了也验证不了,只能等有空库窗口的 CI `db-from-zero-migrate.yml` 链路。
- **O14 / D80②定档 / D30③ / D29④ / D38①web宿主决策** — 属 owner 决策或外部发布动作(npm 未发布⇒brew.rb 的 `PENDING_SHA256` 占位有 odie 守卫,禁猜填;tag 属 git 写由主代理执行),不是可派给编码代理的欠项。
- **O20c 机器态半边 / D48① / O59** — 判据是"部署机/桌面端真实运行产物",本机无服务无 WebView 数据,提交者结构上无法满足(§守门"机器态门不挂 blocking"同型),归运维核验。

## 我这路没做完 / 需主代理复核

1. **"45 张"与实测 34 张的口径差**:逐报告标题枚数,B 类共 34 票(report-1:4、report-2:7、report-3:3、report-4:4、report-5:4、report-6:3(D77 除外的 D91/O14/D17)、report-7:3、report-8:5,另有 report-5 的 D33/D73 等已计入)。台账说 45,可能把子项(①②③)或 O60g 补充票计入了;**未找到额外 11 张的清单来源,派单前请主代理按 PROJECT_PLAN 现存 `- [ ]` 再扫一遍 B 票全集**。
2. **D29 的可派单性存疑**:其建迁移要写 `packages/database/drizzle/meta/_journal.json`,该文件此刻为脏 —— 我在表中给了条件(等收敛/串行),若并发继续推进 journal,此票实际也不可派。
3. **D13 装配面板宿主文件未定位死**:`git ls-tree HEAD | grep -i assembly` 只命中 ai-service 一个无关 py 文件;前端装配面板的真实组件名待派单者自查(线索:`context-attribution` 的测试此刻脏,宿主面可能同样在途)。
4. **D80① 与 D81⑦ 的边界**:两票欠项同源(消息流内 workflow),我只登记一条,合并/拆分请主代理定。
5. **守门 57 elements JSON 字段形态**只量到"旧判据串零命中",没来得及读文件结构 —— 与 D107/D111② 两票的门改直接相关,建议接手先 `git show HEAD:scripts/data/chat-flow-elements.json | head -40`。
6. 本路对 HEAD 取证一次成型(bb4d2b670b1);因本仓推进极快,**每张票派出前重跑该行"验收判据"列的命令**即可自证是否已被他人补上 —— 这比再跑一轮审计便宜得多。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
