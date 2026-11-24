<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# O60r 裁决 — D29 / D30 / D31 / D39 / D47

取证基准:开工时 `HEAD = 6079d2f3f883daf11e0c191132971bbeb0d7c5ad`(PROJECT_PLAN.md 8399 行);
轮中实测 HEAD 已推进到 `bb4d2b67…`(并发会话在提交),**本报告全部行号与读数钉死在 6079d2f3f**,
主代理落盘时须按文字锚点重新定位。尺子自检:`git grep -c "PROJECT_PLAN" 6079d2f3f -- README.md` → 12(非零,搜索有效)。

---

## 票 D29(团队级知识引擎,G-35)

- 台账位置(HEAD 行号):
  - L527 `- [ ] D29 团队级知识引擎:记忆/Repo Wiki/知识卡云端共享+成员修正+过程审计(对标 Qoder 1.0…)(G-35)` ← 本轮裁决对象
  - L5204 `- [x] ✅(2026-09-21) **D29 小程序端 i18n 修复**…` ← **同编号异题**(i18n 批次撞号复用 D29,不是本票孪生,见"需复核")
- 复跑命令与实测(均对 `6079d2f3f`):
  - 实现面:`git grep -ilE "知识引擎|knowledge.?engine|repo.?wiki|知识卡" HEAD -- apps packages scripts sdks` → 命中 `apps/api/src/routes/{team-memory,repo-wiki,knowledge-card}.ts`、`apps/api/src/services/{team-memory-service,repo-wiki-service,knowledge-chat-context,repo-wiki-context}.ts`、`apps/ai-service/app/services/{repo_wiki_engine,knowledge_card_extractor,knowledge_lookup}.py`、web 三页 `apps/web/app/(main)/{team-memory,repo-wiki,knowledge-cards}/page.tsx`、`packages/database/src/schema/{team-memories,repo-wiki,knowledge-card}.ts`、`packages/api-client/src/endpoints/team-memory.ts`。
  - 消费面(已装车的两半):`routes/index.ts:1286/1289` 注册 repo-wiki 与 knowledge-cards 路由;`nav-data.ts:375/377` 有 `/repo-wiki`、`/knowledge-cards` 入口;两页各 import `@ihui/api-client`(grep -c=1);注入链被消费:`routes/ai-chat-stream.ts:31-32` import `loadRepoWikiContext`/`loadKnowledgeContext`、`routes/chat-resume.ts:12` 同样。
  - **未装车的一半(判"保留未勾"的依据)**:
    - `git grep -n "team-memory\|teamMemory" HEAD -- apps/api/src/routes/index.ts apps/api/src/server.ts` → **零命中**;`teamMemoryRoutes` 全仓仅两处引用:定义(`routes/team-memory.ts:81`)+ 自挂载测试(`routes/__tests__/team-memory.test.ts:130/168`)⇒ 生产 API 没有 `/api/team-memory`,而 web `team-memory/page.tsx:59` 在调 `listTeamMemories()`(api-client 打 `/api/team-memory`)⇒ 团队记忆"云端共享+成员修正"端到端不可用。
    - nav:`git grep -nE "'/team-memory'" HEAD -- apps/web/src` → 仅 `ui-routes.generated.ts:828`(文件路由自动表),`nav-data.ts` 无入口。
    - 过程审计:`git grep -inE "audit|revision|修正|history" HEAD -- apps/api/src/services/team-memory-service.ts` → 零命中;`git grep -inE "audit|revision" HEAD -- packages/database/src/schema/{knowledge-card,repo-wiki,team-memories}.ts` 区段 → 无审计/修订表(team-memories 仅 `sourceUserId/createdAt/updatedAt`)。
- 判决:L527 = **保留未勾**;依据:记忆半未挂路由(上面零命中实测)+ 审计无实现面;"已实现的 repo-wiki/知识卡两半被消费"不能替整票翻勾。
- 建议改写文本(行尾追加,不动勾选态):
  `- [ ] D29 团队级知识引擎:…(G-35) 还差(实测@6079d2f3f):①teamMemoryRoutes 未注册进 apps/api/src/routes/index.ts(git grep -n "team-memory" index.ts=0,仅测试自挂载)⇒/api/team-memory 404、web team-memory 页调用即断;②nav-data.ts 无 /team-memory 入口(repo-wiki/knowledge-cards 已有);③过程审计零实现面(git grep -iE "audit|revision" team-memory-service/schema 均零命中,无成员修正留痕表)`

---

## 票 D30(无人值守修复闭环,G-36)

- 台账位置(HEAD 行号):
  - L528 `- [ ] D30 无人值守修复闭环:GitHub issue/代码扫描告警/失败测试→automations 定时认领修复→PR 回帖(对标 QoderWake;与 D14/D15 协同)(G-36)` ← 本轮裁决对象
  - L5202 `- [x] ✅(2026-09-21) **D30 miniapp-taro 端 i18n 补盲…**` ← **同编号异题**(撞号,非孪生)
  - L2565/L2566 = D61 票(题面"与 D30 强协同",非 D30 本体;其"收口"行称"D30 联调以契约断言完成"仅指 D61 与 D30 契约对齐,不构成 D30 完成登记)
- 复跑命令与实测(均对 `6079d2f3f`):
  - 已装车的基础件:`routes/index.ts:1292` 注册 `/api/automations`;`services/agent-automation-scheduler.ts` 60s tick 轮询 `user_automations` 调 ai-service agent-runtime,`apps/api/src/index.ts:257` `startAgentAutomationScheduler()` 实调在位;`index.ts:1295` 注册 `/api/patrol` + `:260 startPatrolScheduler()`(patrol-scheduler 头注:巡检判 `[PATROL:ISSUE]` → 建会话注入"诊断+修复预案" → 用户回"执行修复"走审批流);`routes/index.ts:1300` 注册 `/api/github-app`(comment-trigger.ts = @机器人评论→白名单归类→复用 pr-review 出口**回帖**,属 D15/G-20 的被动响应链);ai-service `app/main.py:772` 挂 `self-healing` 路由(失败测试→归因→补丁重跑引擎,`AGENT_SELF_HEALING_ENABLED` 门控);web 有 `/automations`、`/patrol` 页且走 `@ihui/api-client`(端点 `packages/api-client/src/endpoints/automations.ts`)。
  - **闭环缺项(判"保留未勾"的依据)**:
    - `git grep -n "github-webhook\|githubWebhook" HEAD -- apps/api/src/routes/index.ts` → **零命中**:`routes/github-webhook.ts`(内含 issues/opened、pull_request、push → `fireEventTriggerAsync`,:135)造好**未挂载** ⇒ GitHub 事件根本进不来,`agent_event_triggers` 规则表被这处断链整体悬空。
    - 修复结果回写 GitHub:trigger/执行链零 `createComment`(命中仅在 `github-app/comment-trigger.ts`、`jwt.ts` 自身与测试);`EventTriggerLastResult` 只存本地摘要 ⇒ "定时认领修复→**PR 回帖**"这一腿无任何代码路径。
    - 失败测试→自动认领:`git grep -ln "self-healing|self_healing" HEAD -- .github` → **零命中**,无 CI/调度消费者调 `/self-healing/run`。
- 判决:L528 = **保留未勾**;依据:上面三条零命中——调度器/巡检/自愈/@回帖四块都在,但"issue/扫描告警/失败测试 → 认领修复 → PR 回帖"的闭环接线(入口 webhook 挂载 + 出口回帖)不存在。
- 建议改写文本(行尾追加):
  `- [ ] D30 无人值守修复闭环:…(G-36) 还差(实测@6079d2f3f):①routes/github-webhook.ts 未注册进 routes/index.ts(grep github-webhook index.ts=0)⇒issues/pull_request 事件与 agent_event_triggers 全悬空;②修复结果回写 PR/issue 评论零路径(EventTriggerLastResult 仅本地,createComment 只在 @mention 链);③失败测试→自动认领无消费者(git grep -l self.healing .github=0,自愈引擎仅 HTTP 按需);automations/patrol/github-app 三调度与页面均已装车`

---

## 票 D31(设计稿转码 Figma,G-37)

- 台账位置(HEAD 行号):
  - L529 `- [ ] D31 设计稿转码:Figma Frame/组件→可运行前端代码(对标 Trae 设计还原)(G-37)` ← 本轮裁决对象
  - L2252 `- [x] ✅(2026-09-21) **D31 mobile-rn 四屏页签回显原始键名…**` ← **同编号异题**(撞号,非孪生)
  - L8367/L8387(O60g 判"确未开工")= 已勾的审计登记,非本票转码票。
- 复跑命令与实测(均对 `6079d2f3f`):
  - 任务书指定复测:`git grep -ilE 'absoluteBoundingBox|componentSet|figma_node|figma\.com/v1' HEAD -- apps packages scripts` → **exit 1,零命中**(与 O60g 结论一致;先跑 `git grep -c "PROJECT_PLAN" HEAD -- README.md`=12 证尺子有效)。
  - 宽口径:`git grep -ilE "figma" HEAD -- apps packages scripts sdks` → 命中均为非实现:`apps/web/app/(main)/**/use-cases/ai-*/page.tsx`(营销页)、`apps/api/src/routes/skills.ts:159`(静态市场清单里一条 `figma-to-code` **硬编码 mock 条目**,author='DesignTools'/假 installCount,无任何执行实现)、`apps/web/src/components/ide/{ide-layout.tsx:66,view-switcher.tsx:46}`(`figma` 视图为占位空壳,view-switcher 注释自认"标签等于说谎")、`packages/shared/src/chat/mcp-tool-activity.ts:87/111`(仅 MCP 活动**词表文案**,服务于用户在自家 MCP 配 Figma server 时的显示)、brand-icon/i18n/seed/e2e 等。
- 判决:L529 = **保留未勾**;依据:上两条 grep——判据词零命中 + 全部 figma 命中落在营销/占位/词表/静态 mock,无任何"节点树→代码"管线。
- **可先行、不依赖 Figma 凭据的切片:存在(独立判断,非照抄 O60g)**。凭据(Figma PAT/OAuth)在本票中只承担一件事——"取稿"(REST `GET /v1/files`);而票面核心能力"节点树 JSON → 可运行前端代码"的输入就是 JSON 本身,用户可手工导出/粘贴(含已保存的 REST 响应),离线可全验。切片与验收判据:
  - 文件面(建议;**属新功能,按 §24 须用户确认后才立项**,此处仅裁决"整票并非 100% 阻塞凭据"):
    - `apps/ai-service/app/services/figma_import/`(纯解析:绝对布局/`layoutMode`→flex、fills/strokes→design-tokens 色档映射、`componentSet` 节点→props 变体表;不发起任何网络)
    - `apps/ai-service/app/routers/figma_import.py`(body 只收 JSON,注册进 `app/main.py`;鉴权走既有面)
    - `apps/api/src/routes/figma-import.ts` 转发 + `routes/index.ts` 注册(§5 显式列举,鉴权必填)
    - `apps/web/src/components/ide/figma-import-panel.tsx`,挂既有 `figma` 占位视图(`ide-layout.tsx:66` case 'figma')
    - `packages/api-client/src/endpoints/figma-import.ts`
    - 测试:golden fixture(1-2 份真实 Figma 节点 JSON 导出)→ 生成码快照 + `tsc --noEmit` 通过
  - 验收判据:fixture 跑通全程**无网络请求**(凭据零参与);生成码的色值/圆角一律引用 `@ihui/design-tokens`(受守门 77/93 约束,不得裸 hex);新增词表键五语齐(守门 74)。
  - 仍阻塞凭据/素材的部分:在线取稿、真实设计稿样例库、视觉回归对比(截图基准)。
- 需主代理复核(登记,不代改):`skills.ts:159` 静态条目对外宣称"Figma 设计稿一键转 React/Vue 组件",全仓零实现 —— 属"广告能力失真"(§4 素材卫生同型),建议删除该 mock 条目或转真实现后再挂。

---

## 票 D39(错误重试可观测 + 额度耗尽处置动作族,G-44/G-45)

- 台账位置(HEAD 行号):
  - 未勾:L6808(行尾已带上一轮 `**[O60 判:裸副本]** …L2476…` 指针,该行号在本次快照已漂移)、L7848(裸,无标记)← 本轮裁决对象
  - 已勾孪生(同题逐字):L2485 `- [x] ✅(2026-09-24) **D39 错误重试可观测…**` 与 L2486(该行自身重复一次)
- 复跑命令与实测(均对 `6079d2f3f`):
  - 孪生核对:`sed -n '2485p;2486p;6808p;7848p'` → 四行正题逐字同(D39 错误重试…验收 FallbackBanner 与 error 卡…),仅勾选态/前缀不同 ⇒ 未勾两行属裸副本形态。
  - 实现被消费证明(支撑孪生行 ✅ 的大半属实):`git grep -rln "retry-countdown" HEAD -- apps/web/src` → `FallbackBanner.tsx`(生产宿主,`MessageItem.tsx:16`/`MessageList.tsx`/`stores/chat.ts` 均 import FallbackBanner)+ `MessageErrorCard.tsx` + `QuotaActionFamily.tsx` + 测试;`git grep -l "MessageErrorCard" HEAD`(**全仓**)→ 仅 `PROJECT_PLAN.md`、定义 `apps/web/src/components/chat/message-list/MessageErrorCard.tsx`、测试 `__tests__/quota-ownership-wiring.test.tsx`、审计文档 `docs/plan-audit-2026-09-25/{code-d67,report-1}.md` ⇒ **"MessageErrorCard 在 HEAD 无生产消费点"结论本轮实测仍成立**(命中只有定义/测试/文档,无渲染宿主)。MessageItem 自身的错误卡是内联渲染(`MessageItem.tsx:160-170` resolveViewFailure + `errorCardTitle`),不经 MessageErrorCard。
- 判决:
  - L6808 = **裸副本**(上一轮 O60 已判,本轮重新出成品行并改钉 O60r、行号修正为 L2485);
  - L7848 = **裸副本**;依据:正题逐字存活于 L2485 的同编号已勾登记。
- 建议改写文本(整行成品,保留原编号与原文字):
  - L6808:`- [ ] **D39 错误重试可观测 + 额度耗尽处置动作族(G-44/G-45)**:error 卡补「第 N/M 次 · Xs 后重试」倒计时 + HTTP 状态 + 无响应超时;**额度型错误**补动作族(补积分/升级套餐/切档/查看用量/重登/重试),接我方既有钱包/VIP/BYOK 体系。**验收**:`FallbackBanner` 与 error 卡两套动作族用例 + 消费 D34 `retry_scheduled`/`injection_applied` 帧 + 免费额度心智不回退(2026-09-21 三轮口径:不充值仍可用心智不得被动作族打断) **[O60r 判:裸副本]** 本行正题逐字存活于 L2485 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`
  - L7848:同上句式(原文部分与其现文本逐字一致,仅替换尾部指针句为 O60r 版)。

---

## 票 D47(规格补强载体行)

- 台账位置(HEAD 行号):
  - 未勾:L2773 `- [ ] **规格补强三条(不新增任务,写入既有任务描述)**:①G-104 两套撤销语义分离(rollback 回代码 / revert 撤问答)+ 代批拒绝后**人工放行**入口 → 补进 D47/D55 规格;②子智能体六态·阶段性回复三键·后台进程六态·「未记录最终结果」→ 补进 D40/D24 规格;③未记录最终结果 → 补进 D44/D65` ← 本轮裁决对象
  - 已勾(异题,非孪生):L2509/L2510 `- [x] ✅(2026-09-23) **D47 检查点载体…"轮内两段式"对齐评估…**(裁定三点均"不做")`、L2620 平台独占标注行。
- 复跑命令与实测(均对 `6079d2f3f`):
  - `git show HEAD:PROJECT_PLAN.md | grep -nE "G-104|人工放行"` → 仅命中 L2773 本行;`grep -nE "阶段性回复|未记录最终结果"` → 除 L2773 与他票无关"六态"字样外零命中 ⇒ 三条规格补强**均未**写进 D47/D55、D40/D24、D44/D65 的任务描述(D55 行 L7850 现文本仍是"四态卡+理由",无 rollback/revert 分离与人工放行)。
  - D47 评估票本体已勾且有裁定(L2510"三点均不做"),与 L2773 无题面重叠 ⇒ 不构成裸副本。
- 判决:L2773 = **保留未勾**;依据:上条 grep——三个补强项在目标票描述里全部零命中,欠项实打实。
- 建议改写文本(行尾追加,不动勾选态):在 L2773 行尾追加:` 还差(实测@6079d2f3f):①②③三条均未写入目标任务描述 —— git show HEAD:PROJECT_PLAN.md | grep -nE "G-104|人工放行|阶段性回复|未记录最终结果" 除本行外零命中;D55 现行行(L7850)仍无 rollback/revert 分离与人工放行表述`

---

## 汇总

| 票 | 未勾行 | 判决 | 一句依据 |
| --- | --- | --- | --- |
| D29 | L527 | 保留未勾 | `teamMemoryRoutes` 未注册(routes/index.ts grep 零命中)、nav 无 /team-memory 入口、过程审计零实现面;wiki/知识卡两半虽装车不能替整票 |
| D30 | L528 | 保留未勾 | github-webhook 路由未挂载(入口断链)、修复结果→PR 回帖零路径、失败测试无自动认领消费者 |
| D31 | L529 | 保留未勾 | 指定判据 grep exit 1;figma 命中全部为营销页/占位视图/词表/静态 mock,零转码管线;但存在免凭据切片(离线导入解析层,见票节) |
| D39 | L6808 | 裸副本 | 正题逐字存活于已勾孪生 L2485(O60 已判一次,行号漂移本轮重钉) |
| D39 | L7848 | 裸副本 | 同上,L2485/2486 为该正题唯一已勾登记 |
| D47 | L2773 | 保留未勾 | ①②③三条规格补强在全部目标票描述中 grep 零命中,纯欠项 |

## 我这路没做完 / 需主代理复核

1. **行号时效**:全部行号钉在 `6079d2f3f`;轮中 HEAD 已推进到 `bb4d2b67`(并发会话仍在提交),主代理落盘前必须按正题文字重新定位,勿直接用本报告行号。
2. **D29/D30/D31 的"已勾孪生"是撞号不是孪生**:L5204(D29 i18n 修复)/ L5202(D30 i18n 补盲)/ L2252(D31 mobile-rn 键名回显)与 L527-529 的 G-35/36/37 三票**异题同号**。它们是 i18n 批次的登记,不构成任何翻勾依据;建议单开一票处理编号冲突(重命名其引用或加撞号注记)——本轮未触碰已勾行。
3. **D39 ✅ 孪生行的"半装车"疑点**:FallbackBanner 腿已消费(实测),但独立 `MessageErrorCard` 渲染宿主仍为零(本轮复测 D67 残余行 L8100 区"MessageErrorCard 在 HEAD 无生产消费点"**仍属实**)。✅ 是否算整票完成由主代理裁定;若判"半完成",欠项应登记在 D39/D67 进度行上,而**不是**把裸副本行翻回实账。
4. **D31 skills.ts 静态 `figma-to-code` 条目**宣称不存在的能力,建议删除或补真实现(本轮只登记,未改任何仓库文件)。
5. **D30 未核项**:`user_automations` 的 automations 页面与 `/api/automations` CRUD 契约对齐、以及 `agent-event-triggers` 的管理 UI 是否齐备未逐一取证(不影响"闭环未通"的判决,入口断链是结构性的)。
6. **免凭据切片属建议**:文件面与验收判据是本轮取证后的独立设计意见,立项前按 §24 须用户确认;若采纳,凭据阻塞面收窄为"在线取稿+视觉回归"两腿。
7. 轮次用量约 24/40,五票判决均已成型并落盘本报告。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
