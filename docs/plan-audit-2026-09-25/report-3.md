<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# batch-3 对账报告(D14 D30 D43 D68 D85 O10 O20f)

- 仓库 HEAD 实测:`git -c safe.directory=* rev-parse HEAD` → `ae703ea1811d106b65304999c9b4c974c4b1d5aa`
- 口径:全部判定按 **HEAD blob / HEAD 树**(`git show HEAD:<path>`、`git ls-tree -r --name-only HEAD`、`git grep ... HEAD --`),未采用任何工作区磁盘读数。
- 例外:O10 的测试结论是一次 `npx vitest run` 的实时执行(只读跑测,未改文件),命令与输出逐字附在段内。

---

### D14 B-部分开工

一句话结论:容器/远程执行后端(含 Docker)已在 ai-service 落地并挂了路由,但本票命名的"任务队列 / 镜像缓存 / 跨项目并行看板 / 云端沙箱 agent"四件中三件在 HEAD 无任何实现物。

证据(命令 → 输出片段):

1. `git -c safe.directory=* ls-tree -r --name-only HEAD | grep -iE "sandbox|quest"` →
   `apps/ai-service/app/services/sandbox.py` / `apps/ai-service/app/routers/sandbox_exec.py` / `apps/ai-service/app/core/sandbox_policy.py`
2. `git -c safe.directory=* show HEAD:apps/ai-service/app/services/sandbox.py | sed -n '1,28p'`(注:前 3 行是水印横幅) →
   `Local:本地 subprocess…` / `Docker:通过 docker run 命令在容器内执行(不装 docker SDK,用 subprocess 调 docker CLI)` / `Modal:…` / `Daytona:…` / `Singularity:…`
3. 接线点(非注释命中):`git -c safe.directory=* grep -n -I -F "sandbox_exec" HEAD -- apps/ai-service/app` →
   `HEAD:apps/ai-service/app/main.py:856:    app.include_router(sandbox_exec_router.router, prefix="/api", tags=["sandbox-exec"])`
   另一处消费:`HEAD:apps/ai-service/app/services/mcp_server.py:1955:        result = await sandbox_executor.execute(`
4. 三件缺失(否定式已换 4 种命名形态 + 目录枚举复核):
   - `git -c safe.directory=* grep -l -I -F "云端沙箱" HEAD -- apps packages sdks scripts` → **空输出**
   - `git -c safe.directory=* grep -n -I -F "MyQuests" …` → **空输出**
   - `git -c safe.directory=* grep -ln -I -E "sandbox.*(queue|队列)|(queue|队列).*sandbox" HEAD -- apps/ai-service/app apps/api/src` → **空输出**
   - `git -c safe.directory=* ls-tree -r --name-only HEAD -- apps/web/src apps/web/app packages/app | grep -iE "kanban|board"` → 仅 `admin/*-dashboard`、`leaderboard` 等无关项,零沙箱看板

已落件 / 还欠件:

- 已落:沙箱执行抽象 6 后端(Docker/SSH/Modal/Daytona/Singularity/Local)+ `POST /api/sandbox/run`、`GET /api/sandbox/backends` 路由注册 + MCP 工具层委托(`mcp_server.py:1952-1955`)+ 回归测试 `apps/ai-service/tests/test_sandbox.py`。
- 还欠:① **镜像缓存** —— `_execute_docker` 仅拼 `docker run --rm --network=none … <image> sh -c`(sandbox.py:372-381),全文件无 `pull`/预热/缓存键逻辑;② **任务队列**(沙箱运行无排队/并发位/重试,`apps/api/src/queue/` 现有 batch-queue 未与 sandbox 关联);③ **跨项目并行看板**(无页面、无 store、无后端聚合端点);④ "云端沙箱 **agent**"语义(现沙箱只是工具执行后端,不存在以沙箱为运行环境的独立 agent 会话形态)。

落点建议:

- 队列:`apps/api/src/queue/`(已有 `batch-queue.ts` 模式可复用)或 ai-service 侧新增 `app/services/sandbox_queue.py`;不得在端内各写一套。运行态类型(队列项/状态机)沉 `packages/types/src/` 供 web/miniapp/rn 共用 —— 按 AGENTS §3"共享层优先",看板的列表与状态取数必须走 `packages/api-client/src/endpoints/`,不得在 `apps/web` 裸 fetch(守门 73 会拦)。
- 镜像缓存:`apps/ai-service/app/services/sandbox.py` 的 `_execute_docker` 前置一层 `ensure_image()`(pull + 本地 tag 指纹缓存),缓存表落在既有 Redis 访问层(`apps/api/src/services/*kv*` 或 ai-service 侧 redis)。
- 看板:`apps/web/app/(main)/sandbox-quests/page.tsx`(新路由页)+ 侧栏 `nav-data.ts` 登记(必须同步,否则 `check-nav-dead-links` 拦死链);列表组件沉 `packages/shared`。

验收命令:

- `cd apps/ai-service && python -m pytest tests/test_sandbox.py -q`(现有后端回归不破)
- `pnpm --filter @ihui/api typecheck` + `pnpm --filter @ihui/web typecheck`
- `node scripts/check-nav-dead-links.mjs`(新增看板路由后)
- `node scripts/check-api-routes.mjs`(前端调用↔后端路由一致性)
- 队列/缓存镜像落地后需新增 `apps/ai-service/tests/test_sandbox_image_cache.py`(可用 monkeypatch mock docker CLI,禁连生产 8810/8811)

---

### D30 B-部分开工

一句话结论:票面链路的三段"事件入口 / 定时执行 / PR 回帖"各自都有真实落地件并已接线,但**信源只有 GitHub 三事件**(缺"代码扫描告警 / 失败测试"),且**修复结果不开 PR**(该段断链),另有授权环节需人回一句话。

证据(命令 → 输出片段):

1. 事件入口:`git -c safe.directory=* show HEAD:apps/api/src/routes/github-webhook.ts | grep -nE "WATCHED_EVENTS|event ==="` →
   `38:const WATCHED_EVENTS: GitHubEventName[] = ['pull_request', 'issues', 'push']` / `43:  if (event === 'issues') return action === 'opened'`
   文件头注:`按 (repo,event,action) 匹配 agent_event_triggers 规则` / `命中则复用现有 agent-runtime 执行器自动创建一次 agent 运行`
2. 认领执行:`git -c safe.directory=* show HEAD:apps/api/src/services/agent-event-trigger.ts | grep -nE "captureAgentRuntimeStream|mode"` →
   `161:  const capture = await captureAgentRuntimeStream(trigger.action.prompt, request, {` / `162:    mode: trigger.action.mode ?? 'auto',`
   定时侧:`HEAD:apps/api/src/services/agent-automation-scheduler.ts:9-10` → `recurring nextRunAt<=now)的自动化,逐条调用 ai-service agent-runtime 执行,`
3. 回帖:`git -c safe.directory=* grep -n -I -E "comments|回帖" HEAD -- apps/api/src/services/github-app` →
   `HEAD:apps/api/src/services/github-app/comment-trigger.ts:133:  \`/repos/${coord.owner}/${coord.repo}/issues/${coord.pullNumber}/comments\`` / `:209:/** 处理一条 @机器人 评论:取上下文 → 问模型 → 回帖。… */`
4. 巡检(自动建会话给诊断+修复预案):`git -c safe.directory=* show HEAD:apps/api/src/services/patrol-scheduler.ts` →
   `阶段2:issue 时主动建(或复用)chat_conversations 会话并注入首条 assistant` / `诊断消息(诊断结论 + 修复预案),conversation_id 回存任务防重复建会话刷屏;`
   装车证据:`apps/api/src/routes/patrol.ts`、`apps/web/app/(main)/patrol/page.tsx`、`apps/web/src/components/patrol/patrol-form-dialog.tsx` 均在 `ls-tree HEAD` 中
5. 断链取证(否定式,换 3 种形态):
   - `git -c safe.directory=* grep -n -I -E "repos/.*(pulls\")|method: \"post\"" HEAD -- apps/api/src/services` → **空输出**(全仓 api 服务层无"创建 PR"调用)
   - `git -c safe.directory=* grep -ln -I -E "失败测试|扫描告警" HEAD -- apps/api/src apps/ai-service/app` 命中集里无驱动 automations/patrol 的接线(命中项为 `self_healing.py`/`agent_loop_v2.py`,详见下一行)
   - 失败测试能力确实存在但**未被认领链驱动**:`HEAD:apps/ai-service/app/routers/self_healing.py:5` → `"""Self-healing 引擎 HTTP 路由(把离线引擎接到 LLM + pytest)。`

已落件 / 还欠件:

- 已落:①GitHub webhook 鉴权+去重+事件白名单(`github-webhook.ts` / `github-app.ts`,后者注为 D15);②`agent_event_triggers` 规则匹配 → agent 运行;③automations(once/recurring rrule + `executeAutomation` + `run-now`)与路由 `routes/automations.ts`;④patrol 巡检调度器(阶段 1-2 已实现,含 3 个测试文件:`__tests__/{agent-event-trigger,patrol-scheduler,agent-automation-scheduler}.test.ts`);⑤PR/Issue 评论回帖(`comment-trigger.ts`,含 `stage: 'post'` 失败分类)。
- 还欠:①**"失败测试 / 代码扫描告警"两类信源未接入自动认领** —— `self_healing` 是 ai-service 被动 HTTP 端点,无"CI 红 → 建 automation → 认领"的推送/定时桥;②**修复产物不开 PR**(无人值守闭环缺最后一环,现有回帖能力只覆盖"@机器人提问式回答",不是修复结果 PR);③patrol 阶段 3 明确要人回"执行修复"(`巡检结果… 用户在会话内回复"执行修复"即走既有 agent 工具审批流(阶段3 一键授权)`),与"无人值守"仍有距离(此项可能是有意的安全设计,需产品决策)。

落点建议:

- 信源接入:`apps/api/src/services/agent-event-trigger.ts` 扩 trigger kind(加 `ci_failed` / `gate_failed`),由 `apps/api/src/routes/`(webhook 家族)或 CI 回调侧投递;GitHub Actions 侧出口落 `.github/workflows/` 新增 job → 调既有 webhook 面(不得新造裸 HTTP 端点绕能力闸)。
- 开 PR:`apps/api/src/services/github-app/` 内新增 `pr-creator.ts`(与 `comment-trigger.ts` 同族同目录,复用同一 coord/鉴权实现,禁止抄第二份 GitHub 客户端);分支/提交侧复用 ai-service 既有 workspace git 工具面(`apps/ai-service/app/services/workspace_*`),而非在 api 端内重实现。
- 类型沉 `packages/types/src/`,前端调用沉 `packages/api-client/src/endpoints/`。

验收命令:

- `pnpm --filter @ihui/api test -- agent-event-trigger patrol-scheduler agent-automation-scheduler`(现有三件先不破)
- `pnpm --filter @ihui/api typecheck`
- `node scripts/check-api-routes.mjs`(新端点必须成对)
- `cd apps/ai-service && python -m pytest tests -k self_healing -q`
- 信源/PR 落地后需新增 `apps/api/src/services/__tests__/unattended-fix-loop.test.ts`,断言"失败测试事件 → automation 认领 → 生成 PR 号回帖"三段可追溯(全部 mock,禁连 8810/8811)

---

### D43 A-确未开工(票面"已交付 + 实测 18/18、4/4"属虚假记账)

一句话结论:票面点名的 12 phase 状态机模块在 HEAD **以及全仓任何 ref 上都不存在**,而 i18n 词包倒是落了库**却零消费端**,因此这不是"幽灵待办"而是"虚假已做 + 造好没装车"叠加。

证据(命令 → 输出片段):

1. 从未进入任何 ref:`git -c safe.directory=* log --all --oneline --diff-filter=A -- "*voice-note*"` → **空输出**
2. 树上不存在:`git -c safe.directory=* ls-tree -r --name-only HEAD | grep -iE "voice-note|prompt-drafts|history-projection"` → 该 grep 结果里**只有** api 侧无关的 `apps/api/src/services/{run-idempotency,…}` 命中,无 `voice-note.ts`;`git ls-tree -r --name-only HEAD -- packages/shared/src/chat | grep -iE "note|draft|projection"` → 仅 `budget-note.ts` 与其测试
3. 出口仍是注释:`git -c safe.directory=* show HEAD:packages/shared/src/chat/index.ts | sed -n '65,85p'` →
   `// D43 / D36 / D35 这三个模块(voice-note、prompt-drafts、history-projection)在全仓任何 ref 上` / `// 都不存在,而 \`export * from\` 一个解析不到的路径会让 @ihui/shared 的根出口整体不可用 —— 28 个` / `// export * from './voice-note'`
   **独立核实结论:该注释所述与事实一致**(不是照抄注释——由第 1、2 步的 `--all` 历史枚举与目录枚举独立复现)。
4. 测试无对应物:`git -c safe.directory=* ls-tree -r --name-only HEAD -- packages/shared/src/chat/__tests__ | grep -iE "note|voice"` → 只有 `budget-note.test.ts`、`voice-subtitles.test.ts`(票面称"shared 18/18";无任何 156 组合全矩阵用例)
5. 词包在库但零消费(否定式换 5 种命名 + 目录枚举):
   - 存在:`git -c safe.directory=* show HEAD:packages/i18n/messages/web/zh-CN.json | sed -n '10143,10152p'` → `"voiceNote": {` / `"title": "语音笔记",` / `"phase": {` … `ready/recording/waitingTranscript/completed/cancelled/failed/error`
   - 零消费:`git -c safe.directory=* grep -n -I -F "voiceNote" HEAD -- apps/web/src apps/miniapp-taro/src packages/shared packages/ui-react` → **空输出**
   - `git -c safe.directory=* grep -rn -I -l "recordingNote" HEAD -- apps packages` → **唯一命中就是上面那段注释文件**
6. 复用底座在库(说明落点可行):`git ls-tree -r --name-only HEAD | grep -iE "voice-record|voice-input"` →
   `apps/web/src/components/ai/voice-record.tsx` / `apps/web/src/components/chat/voice-record.tsx`(票面"顺带"说的双份同码**确为现实,且仍未收敛**)
   `git -c safe.directory=* grep -n -I -E "waitingTranscript|'finalizing'|phase ===" HEAD -- apps/web/src/components/{ai,chat}/voice-record.tsx` → **空输出**(端内也没有把 phase 状态机就地实现过)

已落件 / 还欠件:B 不适用——核心实现物(状态机/转写接线/归档/插入对话)零件在库。唯一在库件是 i18n 词包,且为孤岛(无消费端)。

落点建议(按共享层优先):

- `packages/shared/src/chat/voice-note.ts`(新建):判别联合 12 相 + 事件集 + 穷尽 `switch` 的 `advance(phase, event)`,矩阵外返回原相 no-op。
- `packages/shared/src/chat/index.ts:76`:模块落地后把 `// export * from './voice-note'` 去掉注释即完成出口(该文件是唯一注入点,不得在端内 import 深路径)。
- `packages/shared/src/chat/__tests__/voice-note.test.ts`(新建):12×13=156 组合全矩阵 + 权限拒绝/中断/最终化失败三条票面点名的用例。
- 词包接线:`apps/web/src/components/chat/voice-record.tsx` 取 `t('voiceNote.phase.*')`(与 `ai/` 那份双码收敛为一份后再写,否则等于把重复实现固化)。
- 转写复用既有 `/api/voice/stt`(不新增 ai-service 端点);`interrupted` 相的 visibilitychange 接线;miniapp-taro 端在 `PROJECT_PLAN.md` 标"平台独占:录音 API 差异"。

验收命令:

- `pnpm --filter @ihui/shared typecheck`
- `pnpm --filter @ihui/shared test -- voice-note`(或 `node --test packages/shared/src/chat/__tests__/voice-note.test.ts`,按该包实际 runner)
- 证伪词包孤岛:`node scripts/scan-dead-i18n-keys.mjs --target=web --exit 1`(现状下 `voiceNote.*` 应被判死键;接线后才应转绿)
- 出口一致性:`node scripts/check-dangling-local-imports.mjs`(恢复 `export *` 前若路径不存在会被守门 98 拦住)

---

### D68 A-确未开工

一句话结论:三浮层在 HEAD 仍是**三个独立组件各自被 message-input 分别 import 并渲染**,票面命名的六源聚合、逐源来源标注、降级三句、引用上限、有效性预览、授权声明全部零命中。

证据(命令 → 输出片段):

1. 三件仍是分立且各自装车(说明"收敛"未发生):`git -c safe.directory=* grep -n -I -F "FileMentionPopover" HEAD -- apps/web/src` →
   `HEAD:apps/web/src/components/chat/message-input.tsx:19:import { FileMentionPopover } from '@/components/ai/file-mention-popover'`
   同法:`ContextSelectorPopover` → `message-input.tsx:48:` 与渲染位 `:1011:          <ContextSelectorPopover`;`SlashCommandPalette` → `message-input.tsx:13:import { SlashCommandPalette } from '@/components/ai/slash-command-palette'`
2. 判据词零命中(每条命令单独跑,均空输出):`git -c safe.directory=* grep -n -I -F "引用标签不新增执行授权" HEAD -- apps packages sdks scripts` → 空;同样 `暂时无法加载` → 空;`多源建议` → 空;`SuggestionSource` → 空;`sourceKind` → 空(`来源标注` 命中的 4 处全在 ai-service 无关语境:deep_research 证据单元 / knowledge_card 溯源 / content_engine 扫描,非本票面板)
3. 无聚合面板文件:`git -c safe.directory=* ls-tree -r --name-only HEAD | grep -iE "mention|context-selector|slash-command|unified-suggest|suggestion-panel"` → 结果里只有既存三件 + `context-mentions` 端点/类型,**无 unified/聚合类新文件**
4. 票号未被任何代码点名:`git -c safe.directory=* grep -ln -I -E "D68|G-93|G-94" HEAD -- apps packages scripts` → 命中文件为 `pane-split-container.tsx`/`pane-split.ts`/`multi-pane.ts`/素材与 i18n 生成物(均为编号巧合的其他票),无 D68 面板

已落件 / 还欠件:B 不适用(零落地件)。

落点建议:

- 新增 `apps/web/src/components/ai/unified-suggestion-panel.tsx`(单面板外壳 + 键盘提示行),把三个既存 hook 的取数收敛为一个 source registry:`apps/web/src/hooks/use-context-mention.ts`、`use-context-selector.ts`、`use-slash-commands.tsx` —— 三者现都在 `apps/web/src/hooks/`,聚合层若跨端可用应按 §3 沉 `packages/shared/src/hooks/`(工厂 + 平台 adapter),纯 DOM 部分留端内并注明"平台特有"。
- 六源与来源标注的枚举类型沉 `packages/types/src/`(禁止端内自立);取数一律走 `packages/api-client/src/endpoints/`(守门 73 拦裸 fetch)。
- 三句降级 + 授权声明文案进 `packages/i18n/messages/web/*.json` 五语言,并跑翻译流水线(§19)后过 `node scripts/check-i18n-keys.mjs`。
- 旧三浮层入口"不回归":`message-input.tsx` 的三处 import/渲染位保留可用(或由新面板内部代理),否则本票自身造成回归。

验收命令:

- `pnpm --filter @ihui/web typecheck`
- `pnpm --filter @ihui/web test -- unified-suggestion`(需新增:六源聚合用例 + 三句降级用例 + 授权声明可见性断言)
- `node scripts/check-i18n-keys.mjs`(parity)+ `node scripts/scan-i18n-zh-residue.mjs ko`(新文案)
- `node scripts/check-api-routes.mjs`(若新增聚合端点)

---

### D85 B-部分开工(实现件在库并已渲染,验收用例缺)

一句话结论:统计条本体、命令历史展开、无理由缺省三件都在 HEAD 且与逐条徽章同源(同一 `steps` 派生、复用同一分类函数),但票面点名的两条"用例"在 `apps/web/tests` 里一条都没有。

证据(命令 → 输出片段):

1. 实现件在库:`git -c safe.directory=* show HEAD:apps/web/src/components/ai/agent-task-progress-pane.tsx | sed -n '605,700p'` →
   `// ─── D85(G-116):自动审查统计聚合条 + 命令历史展开 ───…` / `export function deriveReviewStats(steps: readonly AgentPlanStepEvent[]): ReviewStatsSummary {` / `/** D85 聚合条:决策区块顶部一行摘要 + 可展开的「命令历史」紧凑时间线 */` / `export function ReviewStatsBar({ steps }…)`
   同源证据(票面核心判据):`:616-617` `// 与 D55 决策徽章同源(验收硬判据):统计与逐条徽章都从同一份 runtimePlanSteps 派生,` / `// 分类复用 @ihui/shared/chat 的 stepDecisionState —— 组件内不存在第二份独立计数状态`
   无理由缺省证据:`export interface ReviewStatsSummary { … /** 有决策但缺 reason 的步骤数(自动审查未提供理由) */ noReason: number }`
2. 渲染消费点(不是死代码):`git -c safe.directory=* grep -n -I -F "ReviewStatsBar" HEAD -- apps packages` →
   `HEAD:apps/web/src/components/ai/agent-task-progress-pane.tsx:1781:              <ReviewStatsBar steps={runtimePlanSteps} />`
   同文件另有 `data-testid="review-stats-bar"` / `data-testid="review-stats-toggle"`
3. 文案齐(五语言各 1 处,`git -c safe.directory=* show HEAD:packages/i18n/messages/web/<locale>.json | grep -c "reviewStats"`):en=1、ja=1、ko=1、zh-CN=1、zh-TW=1(组件内取词为 `t('reviewStats.title' / 'noDecision' / 'accepted' / 'rejected')`)
4. 缺用例:`git -c safe.directory=* grep -n -I -E "review-stats|deriveReviewStats|ReviewStats" HEAD -- apps/web/tests` → **空输出**(该目录确有 `agent-task-progress-pane.test.tsx` 与 `…-keyboard.test.tsx`,但都不碰本条);`grep -F "noReason" HEAD -- apps packages` 命中的是无关功能(`ai.pane.branch.noReason`、admin ip 信誉、实名审核)

已落件 / 还欠件:

- 已落:`deriveReviewStats` 纯函数(单一真相源)、`ReviewStatsBar` 聚合条 + `命令历史` 展开、`noReason` 显式缺省渲染、五语言词包、渲染位 1781、`data-testid` 锚点。
- 还欠:票面验收两条"用例"的自动化断言 —— ①统计计数 === 逐条徽章计数(同源)②有 decision 无 reason 时缺省文案可见。

落点建议:

- `apps/web/tests/agent-task-progress-pane.test.tsx`(在既有文件内加两例,勿新建平行测试文件):
  ① 对同一 `runtimePlanSteps` 断言 `deriveReviewStats(steps).accepted/rejected` 与逐条 `stepDecisionLabel` 分类计数一致(把"两套数"钉死为不可编译/不可通过的形态);
  ② 构造 `{ decision: 'approved' }` 且 `reason` 缺失的步骤,断言 `[data-testid="review-stats-bar"]` 文本含 `zh-CN` 的 `reviewStats.noReason` 文案。
- 若发现分类逻辑在 `stepDecisionState` 之外还有第二份,应回收到 `@ihui/shared/chat`(§3 共享层优先),不得在 web 端补一份。

验收命令:

- `pnpm --filter @ihui/web test -- agent-task-progress-pane`
- `pnpm --filter @ihui/web typecheck`
- 同源回归可用 `node scripts/check-shared-layer-duplication.mjs`(防止第二份分类实现出现在端内)

---

### O10 C-已在库该翻勾

一句话结论:票面四件交付物(幂等 run 创建 / 外部 run 句柄 / 通用幂等层 / 游标分页)在 HEAD 全部存在、路由已挂、测试实跑全绿;台账那句"run 句柄与游标分页另列 O10b"已过期——两者本体也已在库。

证据(命令 → 输出片段):

1. 文件在库:`git -c safe.directory=* ls-tree -r --name-only HEAD | grep -iE "run-idempotency|run-handle|cursor-pagination|agent-runs"` →
   `apps/api/src/routes/agent-runs.ts` / `apps/api/src/services/cursor-pagination.ts` / `apps/api/src/services/run-handle.ts` / `apps/api/src/services/run-idempotency.ts` + 4 个同名测试(另有 `apps/api/tests/chat-cursor-pagination.test.ts`)
2. 注册点:`git -c safe.directory=* grep -n -I -F "agent-runs" HEAD -- apps/api/src` →
   `HEAD:apps/api/src/routes/index.ts:333:import { createAgentRunRoutes } from './agent-runs.js'` / `:1312:      { prefix: '/api/agent-runs' },`
   挂载条件(如实登记):`routes/index.ts:1304-1318` 注为"密钥缺失时**跳过挂载并告警**,而不是让工厂抛错把整个 API 启动带崩",判据是 `process.env.AGENT_RUN_HANDLE_SECRET ?? process.env.JWT_SECRET`
3. 通用幂等层接线:`git -c safe.directory=* grep -n -I -F "open-idempotency" HEAD -- apps/api/src` →
   `HEAD:apps/api/src/server.ts:56:import { openIdempotency } from './plugins/open-idempotency.js'`
   两层关系已写明(`services/run-idempotency.ts:8-12`:HTTP 响应体层 vs run 结果层,"互补,不是两套真相")
4. 测试实跑(只读):`cd apps/api && npx vitest run tests/run-idempotency.test.ts tests/run-handle.test.ts tests/cursor-pagination.test.ts tests/agent-runs-route.test.ts` →
   `Test Files  4 passed (4)` / `Tests  38 passed (38)`
   与票面"实测 46/46"是**计数口径漂移**(实跑 38 例),不是红;首轮 12 条红测确已修绿。

仍欠(建议在本票收尾时一并登记,不构成本票不翻勾的理由):

- `/api/agent-runs` 未进对外能力目录:`git -c safe.directory=* grep -n -I -F "agent-runs" HEAD -- packages/types packages/api-client` → **空输出**(目录真相源在 `packages/types/src/capability-catalog.ts`)。守门 51 的 B 判据只覆盖 `/v1` 面,故这类"新对外面未登记"不会自动变红 —— 属"本地全绿、对外语义缺声明"那一族。
- 句柄签名密钥依赖 env;缺密钥时静默不挂(仅 warn),部署侧需确认 `AGENT_RUN_HANDLE_SECRET` 已设,否则该面 404 而非报错。

落点建议(仅上述两项):`packages/types/src/capability-catalog.ts` 登记 agent-runs 端点并跑 `node scripts/check-capability-catalog.mjs`;`packages/api-client/src/endpoints/` 增对应出口供各端调用。

验收命令:

- `pnpm --filter @ihui/api test -- run-idempotency run-handle cursor-pagination agent-runs-route`
- `pnpm --filter @ihui/api typecheck`
- `node scripts/check-capability-catalog.mjs --self-test` 与 `node scripts/check-capability-catalog.mjs`(登记后 A/B/C 三面)
- `node scripts/check-api-routes.mjs`(前端调用面若接入 api-client)

---

### O20f C-已在库该翻勾(本条是事故登记,非功能待办;其中①已被后续实现覆盖、②按票面显式保留)

一句话结论:①`response-sanitizer` 的回调风格 onSend **已在 HEAD**(票面"现 HEAD 仍是 async 返回 payload 版"这句已过时,该工作后来入库了);②`check-capability-catalog.mjs` 的 `[E]`(注册点有、目录未声明)确未在库——与票面"重建价值需再评估、`[C]` 同型判据已存在"的定性一致,属有意未做而非漏做。

证据(命令 → 输出片段):

1. ①已在库:`git -c safe.directory=* show HEAD:apps/api/src/plugins/response-sanitizer.ts | grep -nE "onSend|done\("` →
   `513:  // 刻意用**回调风格**而不是 async(2026-09-22):async onSend 会让 Fastify 5 的` / `519:    'onSend',` / `526:      done(null, rewritePayload(request, reply, payload))`
   ⇒ 被清空的那版工作,其结论/形态现已是 HEAD 现实;票面记录需就地更正。
2. ②未在库:`git -c safe.directory=* show HEAD:scripts/check-capability-catalog.mjs | grep -nE "\[D\]|反向"` →
   `545:// ═══════ D:反向核对(声明了却没注册) ═══════` / `928:  [D] 反向核对: 目录声明 ${s.declaredRoutes} 条路由 → 代码中找不到注册点 ${s.staleDeclaredRoutes}`
   `git -c safe.directory=* grep -n -I -E "未声明|\[E\]" HEAD -- scripts/check-capability-catalog.mjs` → **空输出**(只有"声明未注册"方向,缺"注册未声明"方向)
3. 该门接线现状:`git -c safe.directory=* grep -n -I -F "check-capability-catalog" HEAD -- scripts/guardian-runner.mjs` → `HEAD:scripts/guardian-runner.mjs:1156:    script: 'check-capability-catalog.mjs',`(注册在场;其 id 现值以 runner 为准,本票不改)

落点建议:本票无功能落点。台账动作二选一即可(交主 agent 决):① 把 O20f 从 `- [ ]` 改为已完成并加一行"①已入库(HEAD 回调风格)、②显式不重建";② 若要 ② 的判据,落点是 `scripts/check-capability-catalog.mjs` 新增 `[E]` 段并在 `--staged` 下跳过(需全量路由树,与 `[D]` 同约束),**但先复核 `scripts/openapi-check.mjs` 的 `[C]` 覆盖面**——该引用来自票面,本次未复核。

验收命令:

- `node scripts/check-capability-catalog.mjs --self-test` 与 `node scripts/check-capability-catalog.mjs`
- `node --test scripts/tests/check-capability-catalog.test.mjs`
- ①侧回归:`pnpm --filter @ihui/api test`(脱敏面回归)+ `node scripts/check-credential-leak-in-message.mjs --self-test`

---

## 本批次未查透项

- 无 `U-未判定`。7 票全部给出 A/B/C 判定。
- 两处**未复核的外部引用**(不影响判定结论):O20f 中"同类判据在 `scripts/openapi-check.mjs` 的 `[C]` 已存在且 blocking"引自票面,本次未打开该文件核实;O10 的"部署侧 `AGENT_RUN_HANDLE_SECRET` 是否已在生产 env 设定"属机器/服务态,只读审计不覆盖。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
