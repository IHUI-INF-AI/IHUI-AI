<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# report-8 — batch-8 六票 HEAD 实现面对账(只读审计)

- 判定基准:一律 HEAD(`git show HEAD:<path>` / `git ls-tree -r --name-only HEAD` / `git grep … HEAD`)。工作区未参与任何判定。
- 工具调用消耗:约 32/45。未真跑任何写操作、未改任何源码。
- 摘要:D38 B / D62 B / D19 B / D107 B / D80 B / O19b C(②仍待拍板)

---

### D19 判定 B-部分开工(票面前置已过期一半)

一句话结论:`terminal_delta` 在 **mobile-rn 已于 2026-09-25 真接**(有回调注册 + 定向测试),票面"两移动端均 0 命中"对 web 之外的两端已不成立;真缺口收窄为 **miniapp-taro / extension / cli 三端未接**,hunk 与审批流维持"初步对齐"未做逐项复核。

证据(命令 → 输出片段):

1. `git -c 'safe.directory=*' grep -n -I -F "terminal_delta" HEAD -- apps packages sdks scripts`
   → `HEAD:apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx:469: * D19 terminal_delta live 缓冲(2026-09-25 接,对齐 web store.terminalOutputs 口径)。`
2. `git -c 'safe.directory=*' grep -n -I -E "onTerminalDelta" HEAD -- apps`
   → `HEAD:apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx:1500:        onTerminalDelta: (event) => {`(注册点在位,非注释命中)
   → `HEAD:apps/web/src/hooks/use-chat/send-message.ts:855:        onTerminalDelta: (evt) => {`
   → 全命中仅 mobile-rn + web 两端,**miniapp-taro 零命中**
3. `git -c 'safe.directory=*' grep -n -I -F "terminal_delta" HEAD -- apps/miniapp-taro` → **空输出**(exit 1)
4. `git ls-tree -r --name-only HEAD | grep -i queue` 同族核对:定向测试已入库 `HEAD:apps/mobile-rn/tests/terminal-delta-live.test.ts`(其第 5 行:`// D19 mobile-rn terminal_delta 增量渲染(AiAssistantN8nScreen live 缓冲)定向测试。`)
5. 权威台账口径(守门 90 数据文件,`node -e` 解析 `git show HEAD:scripts/data/sse-dispatch-coverage.json`):
   → `miniapp-taro {"…","onTerminalDelta":"no-terminal-delta-ui"}` 、`extension {… "onTerminalDelta":"no-terminal-delta-ui" …}` 、`cli {… "onTerminalDelta":"no-terminal-delta-ui" …}`
   → 分组理由原文:`"no-terminal-delta-ui": "该端终端渲染走整帧 onTerminalStart/onTerminalEnd,不做增量 delta;台账 D19 已把 terminal_delta 记为两移动端的真缺口,补齐前此处显式声明(而非静默)。"` —— **该理由文本本身已与 HEAD 相反(mobile-rn 已接),属台账文案过期,判据未过期**(守门仍 exit 0,说明 mobile-rn 条目已删)。

已落件:后端帧生产(`apps/ai-service/app/services/mcp_server.py::_emit_terminal_delta` + `agent_events.py:67 SSE_TERMINAL_DELTA`)、解析层双通道(`packages/api-client/src/client.ts:2493+`、`packages/shared/src/utils/sse-parse.ts:337`)、web 消费(`send-message.ts` → `stores/chat.ts:262 terminalOutputs`)、**mobile-rn 消费 + 定向测试**。
还欠件:① miniapp-taro `onTerminalDelta` 注册与渲染位;② extension / cli 同帧(若判定为不需要,须把理由改成"该端无终端流面板",不得继续引用已失效的"两移动端"措辞);③ hunk diff / 审批流逐端 parity 未做门禁级复核(见"未查透")。

落点建议(遵守 §3 共享层优先,不得端内重实现解析):
- `apps/miniapp-taro/src/api/index.ts`(该端 SSE dispatch 表所在,守门 90 已点名此文件缺 case)+ `apps/miniapp-taro/src/pkg-ai/ai/chat.tsx`(注册位)+ `apps/miniapp-taro/src/pkg-ai/ai/cards/ai-cards.tsx`(渲染位,与整帧 terminal 卡同族,`ai-card-term-truncated` 已在该文件)。解析增量**必须**复用 `packages/shared/src/utils/sse-parse.ts` 的 `terminalDelta`,不得在端内二次解析。
- 同批把 `scripts/data/sse-dispatch-coverage.json` 的 `groups["no-terminal-delta-ui"]` 文案改成与 HEAD 一致的事实陈述,并按守门 ratchet 上调 `baseline["miniapp-taro"]`。
- desktop 维持 by-design 零(票面已定档,无需实现)。

验收命令:
- `node scripts/check-sse-dispatch-parity.mjs --report && echo exit=$?`(补帧后须仍 0,且 `miniapp-taro` 的 `onTerminalDelta` 条目消失)
- `node scripts/check-sse-dispatch-parity.mjs --self-test`
- `node --test apps/mobile-rn/tests/terminal-delta-live.test.ts`
- `pnpm --filter @ihui/miniapp-taro typecheck`
- `node scripts/check-sse-parser-parity.mjs`(守门 63,解析层不得回退)

---

### D38 判定 B-部分开工(web+cli 已装车,移动端零宿主,五动词之一被显式跳过)

一句话结论:判定层、web 宿主(真实渲染点)、cli 宿主、五动词 e2e 均已在 HEAD;但 (a) `interruptAndRun` 的**成功链路 e2e 被 test.skip**,(b) **mobile-rn / miniapp-taro / packages/app 三处零消费者** —— 排队交互在移动端根本没有宿主。

证据(命令 → 输出片段):

1. `git -c 'safe.directory=*' grep -n -I -F "queue-interactions" HEAD -- apps packages sdks scripts | head -40`
   → `HEAD:apps/web/src/components/chat/queue-interaction-bar.tsx:36:} from '@ihui/shared/chat/queue-interactions'`
   → `HEAD:apps/cli/src/commands/queue-ops.ts:27:} from '@ihui/shared/chat/queue-interactions'`
   → `HEAD:apps/cli/src/prompt-queue.ts:34:import { applyQueueEdit, reorderQueue } from '@ihui/shared/chat/queue-interactions';`
2. 渲染消费点(命中≠实现的复核):`git show HEAD:apps/web/src/components/chat/message-input.tsx | grep -n -E "QueueInteractionBar|onReorder|onInterruptAndRun"`
   → `62:import { QueueInteractionBar } from '@/components/chat/queue-interaction-bar'` / `978:        <QueueInteractionBar` / `988: onReorder={(from, to) => {` / `1000:          onInterruptAndRun={handleInterruptAndRun}`
3. 拖拽 + 键盘双形态(票面要求"拖拽重排"):`git show HEAD:apps/web/src/components/chat/queue-interaction-bar.tsx | grep -n -E "draggable|onDragStart|onDrop|ArrowUp"`
   → `194:              draggable={verdicts.reorder.allowed}` / `204:              onDragStart={() => verdicts.reorder.allowed && setDragIndex(index)}` / `189:            onDrop={(event) => handleDrop(event, index)}`
4. 五动词 e2e 清单:`git show HEAD:apps/web/e2e/queue-interactions.spec.ts | grep -n -E "^\s*test\(|test\.skip"`
   → `275:  test('重排:流式中 ↑ 被拒且顺序不动;流结束后 ↑↓ 键盘重排逐位生效'…)` / `320:'撤回…'` / `339:'编辑…'` / `375:'打断并执行:宿主恒不支持插话…'` / `415:'模式切换…'`
   → `403:  test('打断并执行成功链路(停流 + 队首立即发出)—— 真环境不可达,显式跳过'…)` + `409:    test.skip(`
   → 重排后发送顺序确有断言:`298:await expect.poll(() => bestOfN.calls, { timeout: 30_000 }).toBe(1) // 队首"侧问甲"确实被消费`
5. 移动端宿主缺失(否定式换 3 种落点复核):`git -c 'safe.directory=*' grep -n -I -E "queue-interactions|QUEUE_INTERACTION_KINDS|interactionAllowed|applyQueueEdit|reorderQueue|FollowUpMode" HEAD -- apps/mobile-rn apps/miniapp-taro packages/app` → **空输出**

已落件:`packages/shared/src/chat/queue-interactions.ts`(四动词枚举 + `FollowUpMode` + 许可门 `interactionAllowed` + W27 不变式,自带 `__tests__/queue-interactions.test.ts`)、web 宿主(bar 已挂进 message-input,消费 `sideQueueByConversation`)、cli 宿主(`queue-ops.ts` / `repl.ts:289` 队列模式)、5 语言词包(`ai.pane.queueOps`)、五动词 e2e(4 跑 1 跳)。
还欠件:① `interruptAndRun` 成功链路(前置缺失物 = 宿主写死 `runtimeSupportsInterjection=false`,即插话能力协商的**生产者**未落);② mobile-rn / miniapp-taro 宿主(§9"默认全端连通",票面未标"平台独占");③ 台账未见豁免标注(票面原文亦未标)。

落点建议:
- 能力协商生产者:`apps/ai-service/app/services/agent_events.py` + `apps/api/src/routes/ai-chat*`(SSE 帧/字段)→ 经 `packages/api-client/src/client.ts` 暴露 → `apps/web/src/components/chat/message-input.tsx`(解除写死 false)。这条不通,`apps/web/e2e/queue-interactions.spec.ts:403` 那枚 skip 就永远存在。
- 移动端:队列状态与判定复用共享层(不得在端内重排算法),渲染位分别落在 `apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx` 与 `apps/miniapp-taro/src/pkg-ai/ai/chat.tsx`;若确属端内不适,须按 §9 在 PROJECT_PLAN 显式标"平台独占"并写理由。

验收命令:
- `pnpm --filter @ihui/shared test queue-interactions`
- `pnpm --filter @ihui/web exec playwright test e2e/queue-interactions.spec.ts`(需 dev server;skip 归零才算票面达成)
- `pnpm --filter @ihui/web typecheck` / `pnpm --filter @ihui/cli typecheck`
- 装车核对(防"造好没装车"):`git -c 'safe.directory=*' grep -n -I -F "QueueInteractionBar" HEAD -- apps | grep -v __tests__` 必须含 message-input;扩端后须出现对应端命中

---

### D62 判定 B-部分开工(判据/组件/词包齐备,但渲染位从未装车 ⇒ 用户可见能力等于没有)

一句话结论:`voice-subtitles` 判定层(四类麦克风错误 + 互斥 + 双视图 + miniapp 豁免标注)、`VoiceSubtitleBar` 组件、5 语言词包、组件级测试全部在 HEAD,但**该组件在生产代码里零 import、零渲染**,真录音栈 `voice-input.tsx` 也从不叫 `classifyMicError` ⇒ 除"平台独占豁免标注"外,票面三条验收(四类错误态用例 / 互斥断言)只有测试自证,界面拿不到。

证据(命令 → 输出片段):

1. 判定层在库且判据齐:`git show HEAD:packages/shared/src/chat/voice-subtitles.ts | grep -n -E "MIC_ERROR_KINDS|PLATFORM_EXCLUSIVE|SUMMARY_VIEWS"`
   → `export const MIC_ERROR_KINDS = ['noPermission', 'noDevice', 'occupied', 'startFailed'] as const`
   → `export const PLATFORM_EXCLUSIVE = 'miniapp' as const` / `export const SUMMARY_VIEWS = ['discussionSummary', 'taskFlow'] as const`
2. 谁 import 判定层:`git -c 'safe.directory=*' grep -l -I -E "chat/voice-subtitles|voice-subtitles'" HEAD -- apps packages`
   → 仅 4 项:`apps/web/src/components/ai/voice-subtitle-bar.tsx`、`apps/web/src/components/ai/__tests__/voice-subtitle-bar.test.tsx`、`packages/shared/src/chat/__tests__/voice-subtitles.test.ts`、`packages/shared/src/chat/index.ts`
3. **组件无生产宿主**:`git -c 'safe.directory=*' grep -n -I -E "VoiceSubtitleBar" HEAD -- apps packages` → 命中全部在 `apps/web/src/components/ai/__tests__/voice-subtitle-bar.test.tsx`(`34:      const { container, unmount } = render(<VoiceSubtitleBar micError={kind} />)` 等),无任何非测试文件
4. 真录音栈未走四类归一:`git show HEAD:apps/web/src/components/chat/voice-input.tsx | grep -n -E "classifyMicError|recognition.onerror|setError"`
   → `114:  const [error, setError] = React.useState<string | null>(null)` / `170:    recognition.onerror = () => {` —— **`classifyMicError` 零命中**;错误只作为一条字符串塞进 Tooltip(`394:<Tooltip content={error ?? …}`)
5. 词包五语言齐(非幽灵):`git -c 'safe.directory=*' grep -n -I -E "discussionSummary" HEAD -- packages/i18n/messages/web`
   → `HEAD:packages/i18n/messages/web/zh-CN.json:7205:          "discussionSummary": "讨论纪要",` 等 en/ja/ko/zh-TW 共 5 文件
6. 被复用的工具条确已装车(对照组):`git -c 'safe.directory=*' grep -l -I -E "VoiceToolbar" HEAD -- apps packages`
   → `HEAD:apps/web/src/components/chat/message-input.tsx`(证明"能装"的路径存在,唯独字幕条没装)

已落件:四类错误判据(switch 穷尽 + `assertNeverKind`)、`classifyMicError`(DOMException → 四类)、纪要/任务流双视图判据、`summaryRecording × speaking` 互斥判据、组件渲染实现、组件级测试(vitest 四类逐态 + 互斥 + 字幕可见性 + 双视图 + 豁免标注)、五语言词包、miniapp 平台独占豁免标注。
还欠件:① 把 `VoiceSubtitleBar` 挂进对话流宿主(现 `message-input` 只挂 `VoiceToolbar`,`ai-side-panel.tsx` 只挂 `VoiceStreamSpeaker`);② `VoiceInputHandle` 的 `recording`/错误对象 → `micError`/`summaryRecording` prop 的真实连线(现只有 `onerror` 字符串);③ 端到端用例(e2e 或 DOM 断言),现验收全靠组件级 vitest;④ desktop/miniapp 侧口径(豁免已标,但需按 §9 在台账同步标注)。

落点建议:
- `apps/web/src/components/chat/message-input.tsx`(与 `<VoiceToolbar>` 同宿主插入 `<VoiceSubtitleBar>`,prop 由 `VoiceInputHandle` 桥接)
- `apps/web/src/components/chat/voice-input.tsx`:`recognition.onerror` / `getUserMedia` catch 改调共享层 `classifyMicError`,把 `MicErrorKind` 经 handle 冒泡(禁止在端内另写一套四类映射,§3)
- 若 miniapp/RN 也出字幕:同样只 import `@ihui/shared/chat/voice-subtitles`,端内只写渲染位

验收命令:
- `pnpm --filter @ihui/shared test voice-subtitles` / `pnpm --filter @ihui/web test voice-subtitle-bar`(现绿,但只证判据)
- 装车核对(当前必红,即缺口):`git -c 'safe.directory=*' grep -n -I -E "<VoiceSubtitleBar" HEAD -- apps | grep -v __tests__`
- `git -c 'safe.directory=*' grep -n -I -E "classifyMicError" HEAD -- apps | grep -v __tests__`(现仅测试/共享层命中,补线后应出现 voice-input.tsx)
- `pnpm --filter @ihui/web typecheck`

---

### D107 判定 B-部分开工(注册层已成闸并接线;阶段标签层无判据)

一句话结论:票面两层中第一层已落地并接线 —— 守门 `check-sse-dispatch-parity.mjs` 注册为 guardian-runner **id 90(blocking,pre-commit)**,HEAD 实测 5 端 27 帧 exit 0;第二层"阶段标签"在全仓脚本面无任何判据(grep `阶段标签` in `scripts/` = 0 命中),唯一相关物是子票 D107b 的**反向结案**(判定该因果链不成立,留下静态白名单防回潮锁)。

证据(命令 → 输出片段):

1. 闸在库 + 自述分工:`git show HEAD:scripts/check-sse-dispatch-parity.mjs | sed -n '8,14p'`
   → `* 与 check-sse-parser-parity.mjs(守门 63)的分工:` / `*   63 管**解析层** …` / `*   本闸管**注册层** —— 帧被解析出来后,各端 streamChat 的回调表里到底有没有人接。`
   → `* 集成位置:scripts/guardian-runner.mjs 第 90 项(blocking,pre-commit)`
2. 接线核对(防"判据存在而永不调用"):`git show HEAD:scripts/guardian-runner.mjs | grep -n -A6 "check-sse-dispatch-parity"`
   → `2342:    id: '90',` / `2344:    script: 'check-sse-dispatch-parity.mjs',` / `2346:    mode: 'blocking',` / `2357:    skipEnv: 'HUSKY_SKIP_SSE_DISPATCH_PARITY'` / `stagedTriggers` 覆盖 web/extension/miniapp-taro/mobile-rn/cli 五端
3. 真跑(HEAD 面,只读):`node scripts/check-sse-dispatch-parity.mjs --report`
   → 末行:`✅ SSE 端内 dispatch 覆盖守门通过(5 端,帧 27 个)`;`mobile-rn:命中文件 27 个 … 16 帧 apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx ◇仅此面: … onTerminalDelta …`
   → `web {}`(零未接),`cli` 15 项未接全部带理由,`miniapp-taro` 5 项
4. 台账自证"帧清单不写在数据文件里"(不可能与代码脱节):`git show HEAD:scripts/data/sse-dispatch-coverage.json` 第 2 行 `$comment` 原文含 `帧清单**不写在这里** —— 由守门每次从 packages/api-client/src/client.ts 的 onXxx 成员自动提取`
5. 第二层缺失(否定式换落点复核):`git -c 'safe.directory=*' grep -n -I -E "阶段标签|阶段名" HEAD -- scripts` → **空**;`git show HEAD:scripts/data/chat-flow-elements.json` 内 `阶段|stage|phase` 命中仅为 D88 diff 暂存与 D106 steer 交代条,**无阶段标签 parity 条目**
6. D107b 的实测结论(不是待办,是防回潮锁):`git show HEAD:apps/ai-service/tests/test_thinking_frame_ledger.py`
   → `所以"用户在长任务期看不到阶段标签"不是这条帧造成的(它压根没上网),D107b 不作为对话流缺陷实施;真正要防的是**将来有人把 message-only 发射点接到活路径上** —— 那才会静默丢弃。本文件用静态白名单把这件事钉住。`

已落件:注册层闸(四判据:判据自洽 / ratchet / missing 键集合精确等于 / 理由完备)+ runner 接线 + `--self-test` 8 例 + 镜像测试 `scripts/tests/check-sse-dispatch-parity.test.mjs` + 覆盖台账(逐端逐帧带理由)+ D107b 防回潮锁(`KNOWN_DEAD_EMITTERS` 白名单)。
还欠件:① "阶段标签"这一层没有任何机器判据(哪一帧带阶段、各端有没有渲染标签,无人守);② 台账 `groups["no-terminal-delta-ui"]` 的理由文案与 HEAD 相反(见 D19 证据 5),属"登记项变墓志铭"的前兆,虽不判红但应改。

落点建议:
- 阶段标签层不宜新写第五份真相源:并入既有 `scripts/check-sse-dispatch-parity.mjs`(同面同口径,已解决取材基准)扩一条判据,或并入 `scripts/data/chat-flow-elements.json`(守门 57)的元素清单,由锚点文件 + `mustMatch` 承担 —— 二者都比新建闸符合仓库现状。
- 若判定阶段标签属"渲染位"而非"帧注册",落 `apps/web/src/components/ai/progress-sections/*`(该族已有 `cloud-chat-activity-card.tsx` / `multi-agent-action-card.tsx` 的 `entry.phase` 渲染形态可复用)。

验收命令:
- `node scripts/check-sse-dispatch-parity.mjs --self-test`(现 8 例)/ `node --test scripts/tests/check-sse-dispatch-parity.test.mjs`
- `node scripts/check-sse-dispatch-parity.mjs`(全量 HEAD 面,现 exit 0)
- 阶段标签判据落地后:`git -c 'safe.directory=*' grep -n -I -E "阶段标签" HEAD -- scripts` 必须非空(当前为空,即缺口本身)
- `pnpm test apps/ai-service/tests/test_thinking_frame_ledger.py` 入口按端实际(`cd apps/ai-service && pytest tests/test_thinking_frame_ledger.py`)

---

### D80 判定 B-部分开工(两个待自证问题本审计已用 HEAD 证据判定;差距①为真,②为"仅私有协议")

一句话结论:本票是定档审计票,票面两项**答案均已可实测**:①`agentCanvas` 是独立页面、`orchestration-hub` 是侧栏分区,**消息流内不渲染 workflow** ⇒ Codex 式对话流内工作流 widget 属真差距;②`question-dialog` 走 SSE 私有帧 `type:"question"`,而 MCP elicitation 语义(`elicitation/request` / `elicitation.respond`)只存在于 JSON-RPC 引擎面且 TS 侧 `respondElicitation` **零调用方** ⇒ 我方 chat 面**不是** elicitation 语义,两通道未打通。

证据(命令 → 输出片段):

1. ①的形态:workflow/canvas 载体清单 `git ls-tree -r --name-only HEAD | grep -iE "agent-canvas|orchestration"`
   → `apps/web/app/(main)/agent-canvas/page.tsx`(**独立路由页**)、`apps/web/src/components/ai/orchestration-hub-panel.tsx`
2. ①的挂载面:`git -c 'safe.directory=*' grep -n -I -E "orchestration" HEAD -- apps/web/src/components/ai/ai-side-panel-tools.tsx`
   → `45:import { OrchestrationHubPanel } from '@/components/ai/orchestration-hub-panel'` / `100:  | 'orchestration'` / `618:      case 'orchestration':` —— 侧栏工具分区,非消息流
   反向核对:`git -c 'safe.directory=*' grep -n -I -E "agentCanvas|agent-canvas|orchestration" HEAD -- apps/web/src/components/chat` → **空输出**(消息流组件族内没有 workflow 渲染点)
3. ②的私有协议:`git show HEAD:apps/web/src/components/chat/question-dialog.tsx | grep -n -E "PendingQuestion|import"`
   → `19:import type { PendingQuestion } from '@/stores/chat'`(类型来自端内 store,非协议契约)
   → 生产帧形态:`git -c 'safe.directory=*' grep -n -I -E "\"question\"" HEAD -- apps/ai-service/app/services/agent_events.py` → `41:SSE_QUESTION = "question"    # 澄清问题 {"question": Question.to_dict()}`;契约 `apps/ai-service/app/core/sse_contract.py:89 SSEEventContract("question", ("question",))`
   → web 渲染点:`git -c 'safe.directory=*' grep -n -I -E "QuestionDialog|pendingQuestion" HEAD -- apps/web/src/components/ai/ai-side-panel.tsx` → `33:import { QuestionDialog } …` + `1380:            <QuestionDialog`
4. ②的 elicitation 面(存在但未接 chat):`git -c 'safe.directory=*' grep -n -I -E "elicitation" HEAD -- apps/ai-service/app/services/agent_engine.py`
   → `6492: "method": "elicitation/request",` / `1835:            "elicitation.respond": self._handle_elicitation_respond,` / `2213:                "elicitation": True,`(能力声明)
   → TS 侧只有 SDK 方法本体:`git -c 'safe.directory=*' grep -n -I -E "respondElicitation" HEAD -- packages apps` → `793:  async respondElicitation(` + `packages/sdk/tests/agent-engine.test.ts:722` —— **apps 面零调用方**
5. 相关能力闸在位(非本票产出,但是判"已具备/未具备"的口径来源):`git show HEAD:apps/ai-service/app/core/mcp_tool_approval.py | sed -n '123,128p'`
   → `tool_call_elicitation_enabled: bool,` + `allow_persistent_approval=tool_call_elicitation_enabled and allow_persistent_approval`

已落件(与本票相关的既有物):`agent-canvas` 独立页、`orchestration-hub-panel` 侧栏分区、`elicitation_pause.py`(并发计数暂停)、`agent_engine.py` 的 elicitation 请求/回填闭环、`packages/sdk` 双语言 `elicitation.respond` 常量、web `question-dialog` + `pendingQuestion` 续流闭环。
还欠件:① 消息流内 workflow widget(现无任何渲染位);② SSE `question` 帧 ↔ 引擎 elicitation 的桥(或定档为"两套语义,文案对齐即可");③ 本票的定档结论本身未落进任何代码/闸(纯台账动作)。

落点建议(按 §3 共享层优先):
- ①:先在 `packages/shared/src/chat/` 立交代帧 → 视图模型的装配(同 `budget-note.ts` / `queue-interactions.ts` 模式),渲染位取 `apps/web/src/components/ai/progress-sections/`(该目录已承载 plan/terminal/agent 活动族);不得在端内自拼第二份工作流模型。
- ②:桥应落在 `packages/api-client/src/client.ts`(SSE 帧路由的唯一入口,守门 63/90 的锚点文件)+ `apps/ai-service/app/core/sse_contract.py`(契约登记),再由 `apps/web/src/hooks/use-chat/send-message.ts` 消费。
- 定档动作:结论写回 `PROJECT_PLAN.md` D80 行(§1 唯一台账),不得新建文档。

验收命令:
- ①落地后:`git -c 'safe.directory=*' grep -n -I -E "workflow|agentCanvas" HEAD -- apps/web/src/components/chat apps/web/src/components/ai/progress-sections` 必须出现渲染点(当前为空 = 缺口)
- ②落地后:`git -c 'safe.directory=*' grep -n -I -E "respondElicitation|elicitation/respond" HEAD -- apps` 必须非空(当前仅 packages/sdk)
- `node scripts/check-agent-engine-parity.mjs`(协议三方 parity,现 exit 0;加 elicitation 消费面后仍须 0)
- `node scripts/check-agent-event-parity.mjs`(SSE 事件生产/消费双向对账,新帧名必须过它)
- `cd apps/ai-service && pytest tests/test_elicitation_pause_58.py tests/test_agent_engine*.py -q`

---

### O19b 判定 C-已在库该翻勾(①永久豁免与 HEAD 逐条吻合)/ ②仍需 owner 拍板,不得按"已做"结案

一句话结论:票面描述的四列状态在 HEAD **全部实测成立** —— `users/projects/files.search_vector` 确为触发器自管列且**未**出现在 Drizzle schema(源码注释自证),`ai_model_config_models` 上确有 `metadata`(迁移侧,带 GIN)与 `extra_metadata`(TS 已声明为 `extraMetadata`)两个 jsonb 自由袋且 TS 不声明 `metadata`,故 ① 属"永久豁免"、② 属"无权威证据需人拍板",**不是**可以靠写代码消掉的待办。

证据(命令 → 输出片段):

1. 触发器自管 + GIN 索引(仅存在于迁移):`git -c 'safe.directory=*' grep -n -I -E "search_vector" HEAD -- packages/database/drizzle`
   → `HEAD:packages/database/drizzle/0010_fulltext_search_indexes.sql:9:ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;`
   → `…:11:CREATE TRIGGER search_vector_users_trigger BEFORE INSERT OR UPDATE ON "users"` / `:13: tsvector_update_trigger("search_vector", 'pg_catalog.simple', "nickname", "email");`(projects / files 同族)
2. TS schema 确未声明(按目录枚举而非按名字猜):`git -c 'safe.directory=*' grep -n -I -E "search_vector|searchVector" HEAD -- packages/database/src` → **空输出**
3. 调用方自证"走裸 SQL 且承认 schema 未声明":`git show HEAD:apps/api/src/db/search-queries.ts | sed -n '84,86p'`
   → `* search_vector 列由 0010 migration 创建，Drizzle schema 中未声明，` + 使用点 `:116: sql\`search_vector @@ plainto_tsquery('pg_catalog.simple', ${q})\``
4. ②的两个 jsonb 袋:迁移侧 `git -c 'safe.directory=*' grep -n -I -E "ai_model_config_models" HEAD -- packages/database/drizzle`
   → `HEAD:packages/database/drizzle/20260908010000_add_model_metadata_jsonb.sql:6:-- Description: ai_model_config_models 新增 metadata jsonb 列 —— ModelSyncService` / `:18:CREATE INDEX IF NOT EXISTS idx_ai_model_config_models_metadata`(GIN)
   TS 侧 `git show HEAD:packages/database/src/schema/ai-config.ts | sed -n '109,195p' | grep -nE "metadata|jsonb"`
   → `31:    extraMetadata: jsonb('extra_metadata').default({}),` —— **只声明 `extra_metadata`,不声明 `metadata`**;`git -c 'safe.directory=*' grep -n -I -E "jsonb\('metadata'\)" HEAD -- packages/database/src/schema/ai-config.ts` → 空
5. `extra_metadata` 的列出处(证明两者确为同表两个袋):`git -c 'safe.directory=*' grep -n -I -E "extra_metadata" HEAD -- packages/database/drizzle/20260722180000_llm_config_models_and_groups.sql` → `63:  "extra_metadata" jsonb DEFAULT '{}'::jsonb,`
6. 权威归属反证(两侧都真在被写):`git -c 'safe.directory=*' grep -n -I -E "extraMetadata" HEAD -- apps/api/src | head -5` → `apps/api/src/routes/user-llm-configs-v2.ts:818: 'unknown', NULL, ${JSON.stringify(data.extraMetadata)}::jsonb,` / `apps/api/src/services/relay-channel-router.ts:667: const meta = readKeyMetadata(keyData.extraMetadata)` —— TS 读写走 `extra_metadata`,未见指向 `metadata` 的权威声明

判定说明:① 为**永久豁免**(票面已给理由:drizzle 0.38 无 tsvector 类型、ORM 不该写触发器属主列),HEAD 与之逐条吻合 ⇒ 挂 `- [ ]` 属台账漂移,应改为"结案并登记豁免理由"。② 属 owner 决策事项,结构上无法由 agent 消解 ⇒ 不判"未开工",也**不得**判"已完成";若翻勾只能是"转 owner 决策"形态。

落点建议:无代码落点(不得为消红把 `metadata` 或 `search_vector` 塞进 Drizzle schema —— 那正是票面点名的两个副作用来源:把触发器属主列变可写列、以及替 owner 拍板权威袋)。仅需在 `PROJECT_PLAN.md` O19b 行按 §1 记结论。
验收命令:
- `pnpm --filter @ihui/database build && node scripts/check-db-schema-drift.mjs`(§6 守门项 4 的真实文件名是 `check-db-schema-drift.mjs`,不存在 `check-schema-drift.mjs`;豁免未回潮的机器证据)
- `git -c 'safe.directory=*' grep -c -I -E "search_vector" HEAD -- packages/database/src`(必须为 0/空,非 0 即豁免被破)
- `node scripts/check-migration-bookkeeping.mjs`(迁移记账 B1–B5;本机无 PG 端口,`--db` 模式不可用)

---

## 未查透清单(如实登记,不当结论用)

1. **D19 的 hunk diff / 审批流两条线**:我只做了 token 计数(`apps/miniapp-taro/src` hunk≈58、`apps/mobile-rn/src` hunk≈33、`packages/app/src` hunk≈21;approval:miniapp≈3、mobile-rn≈0、packages/app≈0),这类计数**混含注释与 i18n 键**,不构成 parity 判据。票面原计数(miniapp hunk166 / mobile-rn hunk46、approval 3/5)与我这次口径不一致,未做逐项定位。`terminal_delta` 一侧的判定不受此影响(有注册点 + 台账 + 定向测试三重证据)。
2. **D80 的上游对照**:两项均按我方 HEAD 判,未复核票面引用的 Codex `widgets.hermes.workflow` 60 键 / `widgets.hermes.elicitation` 4 键清单本身(仓外事实,只读审计不取)。
3. **D80① 的"消息流内"边界**:我用的是 `apps/web/src/components/chat` 与 `components/ai/progress-sections` 两族零命中,未逐文件排查是否存在以其他命名(如 timeline/stage)呈现的流内工作流卡;若有,①的结论应从"真差距"下调为"文案对齐"。
4. **D62 的 desktop / extension 面**:只判了 web 与共享层,未查这两端是否有各自语音字幕宿主(desktop 复用 web 页面时结论会连带变化)。
5. **O19b 的两条附属陈述**:票面"另:`oauth_apps` 无任何外键引用(实测)"与"迁移文件被并行会话改动会让按 hash 判未应用误报(须按 journal 序号界定)"两项我**未取证**(不属四列本体)。
6. **D38 的"与 /side 互不回归"**:e2e 的前置构造确实通过 `/side` 注入队列,但我未逐条确认存在一条独立断言"改动队列交互不回归 D28 侧问语义"的用例(只读到 skip 注释与文案 oracle 段)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
