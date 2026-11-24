<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# O60r 裁决 — D48 / D55 / D62 / D67 / D69

> 取材口径:全部判 `git -c safe.directory=* show HEAD:PROJECT_PLAN.md` 与 `git grep ... HEAD --`,行号为**本次 HEAD 实测行号**(HEAD = 本轮开工时的 main)。
> 尺子自检:`git grep -c "PROJECT_PLAN" HEAD -- AGENTS.md` → `AGENTS.md:24`(非零,搜索链有效)。
> 已核对:本轮结论涉及的 9 个承重文件 `git diff --numstat HEAD --` 全部输出为空(工作树 == HEAD),故两次 vitest 实跑结果可作为 HEAD 面证据。

---

## 票 D48(本地会话数据主权与加密,G-56,桌面端专项)

- 台账位置(HEAD 行号):
  - 未勾:`L6809 - [ ]`(带上一轮 `[O60 判:裸副本]` 尾巴,指针写的是 **L2502**,**已失效** —— 现 L2502 是 D44 处置行)、`L7873 - [ ]`(裸,无标注)
  - 已勾孪生:`L2511` / `L2512` / `L2518 - [x] ✅(2026-09-24)`(**三行逐字同题**,进度子项 L2513-2516 挂在 L2512 下)、`L7262 - [x] ✅(2026-09-24)`(改写行:"实现已在库、生效从未发生")
  - 同票在飞的**另一条独立编号**未勾行:`L7302 - [ ] **O59⑤ D48 的验收在盘上仍不成立…**`(这才是活欠项的登记处)
  - 端覆盖豁免**已在台账显式登记**:`L2621` 豁免清单条 "D57 … / **D48 本地加密(桌面端专项)**:… 仅桌面本地缓存相关" ⇒ 不按"只做一端"判。
- 复跑命令与实测:
  - `git -c safe.directory=* show HEAD:PROJECT_PLAN.md | grep -nE '^- \[[x ]\].*\*\*D48 '` → 2511 / 2512 / 2518 / 6809 / 7262 / 7873
  - 接线(HEAD):`git grep -n "createChatPersistStorage" HEAD -- apps/web/src/stores/chat.ts` → `:9 import`、`:1430 name: 'ihui-chat'`、`:1433 storage: createChatPersistStorage(ssrStorage)`;`git grep -n "createAuthPersistStorage" HEAD -- apps/web/src` → `chat-persist-crypto.ts:206` 定义 + `stores/auth.ts:22/163` 调用;`git show HEAD:apps/web/src/lib/local-vault.ts | sed -n '45p'` → 域枚举含 `chat-persist|refresh-token|goal-persist|auth-persist` ⇒ **实现与消费点都在库**。
  - 测试文件在 HEAD:`apps/web/tests/d48-{chat-persist-encryption,goal-domain,local-vault,refresh-token-vault,auth-store-and-read-time-seal}.test.ts`(5 个,`git grep -l` 命中清单)。
  - **盘上验收(票面第一条"静态盘 grep 明文会话为 0")今日实测**:`node scripts/check-desktop-cache-plaintext.mjs` → 首行 `状态: violations`,**GATE_EXIT=1**;明亮点名:`…\EBWebView\Default\Local Storage\leveldb\000003.log` 内 `ihui-chat:plain` ×2(utf8:0/**u16 CJK:11**),该文件 mtime = **2026-09-23T10:11:21Z**(早于 D48 各提交);`…appdata-roaming-com.ihui.desktop\auth.json` 解析后**只有一个键** `refresh_token`,值 416 字符且为三段点分(JWT 形态)⇒ L7270 那条"盘上明文 token 未通"**今日仍未消**。
- 判决:
  - **L6809 = 裸副本**(指针目标须改成 L2511;并按实测补一句盘上现状,见下)
  - **L7873 = 裸副本**(与 L6809 同体且更旧,连上一轮的指针尾巴都没有)
  - 依据:两行正题与 L2511 逐字相同、只缺勾选态(复跑命令见第 1 条);票面唯一未成立项"盘上明文为 0"**已经由另一条独立编号 L7302(O59⑤,未勾)在册**,且本轮再次量到 violations,不必在这两行重复计账,但两行的旧指针必须换号否则后人按 L2502 找不到目标。
- 建议改写文本:
  - L6809 →
    `- [ ] **D48 本地会话数据主权与加密(G-56)**:桌面端本地缓存加密(对标 Trae SQLCipher;我方优势:导入侧已有 redact_secrets 实测 0.07% 命中)。**验收**:静态盘 grep 明文会话为 0 + 解锁失败降级可读空态不崩 + 密钥不落仓(§5d) **[O60r 判:裸副本]** 本行正题逐字存活于 L2511 的同编号登记(那行已勾,旧指针 L2502 已被并发归并挪号),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。盘上验收今日仍不成立(`node scripts/check-desktop-cache-plaintext.mjs` → violations / exit 1:`ihui-chat:plain` ×2 + CJK ×11、`auth.json` 仍是裸 JWT 形态 `refresh_token`),该欠项登记在 L7302 的 O59⑤,按那条追、勿按本行派单。`
  - L7873 →
    `- [ ] **D48 本地会话数据主权与加密(G-56)**:桌面端本地缓存加密(对标 Trae SQLCipher;我方优势:导入侧已有 redact_secrets 实测 0.07% 命中)。**验收**:静态盘 grep 明文会话为 0 + 解锁失败降级可读空态不崩 + 密钥不落仓(§5d) **[O60r 判:裸副本]** 本行正题逐字存活于 L2511 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`

---

## 票 D55(机器代批决策条,G-66,P0)

- 台账位置(HEAD 行号):
  - 未勾:`L6810 - [ ]`(旧 `[O60 判:裸副本]` 指针 **L2530 现是空行** ⇒ 失效)、`L7874 - [ ]`(裸)
  - 已勾孪生:`L2539` / `L2540 - [x] ✅(2026-09-24 复核)`(逐字同体,进度子项 L2541-2543 挂其后)、`L6811 - [x] ✅(2026-09-24)`(带"对账改判"尾巴)
  - 承重判据行:`L2582 **H17 代批决策可见率**:凡自动批准/自动拒绝的工具调用,**对话流内 100%** 有决策徽章 + 理由(D34 帧齐后由 D55 达成)`;`L2583 H18 跨端一致`(D33-D64 须在 web/miniapp/mobile-rn/cli **四端消费矩阵无空项**,平台独占者须在 H19 显式标注);`L2617-2623 豁免清单`**未登记 D55 任何端的豁免**。
- 复跑命令与实测:
  - 词表与判据在库且被消费:`git grep -n "step-decision|permissionDecisionWord|stepDecision" HEAD` 命中 26 文件;逐端计数
    `web => 25` / `miniapp-taro => 30` / `mobile-rn => 11` / `extension => 17` / **`cli => 0`** / `desktop => 0` / `shared => 33`;
  - 词表跨端可用(不欠包):`git grep -rln '"stepDecision"' HEAD -- packages/i18n` → `messages/shared/{en,ja,ko,zh-CN,zh-TW}.json` 五语齐 ⇒ 按 L2631 的合并拓扑,非 web 端也读得到。
  - **但渲染位全部落在"运行时面板",不在"对话流"**:`git grep -rn "decision" HEAD -- apps/web/src/components/chat` → **零命中**(0 文件);miniapp `git grep -c -i decision HEAD -- apps/miniapp-taro/src/pkg-ai` → 零命中;mobile-rn `ChatScreen.tsx / utils/chat-render-model.ts / AiAssistantN8nScreen.tsx` → 三文件零命中。现存四个消费点分别是 web `ai/agent-task-progress-pane.tsx:580,727`、`ai/agent-runtime-panel.tsx:177`、`ai/progress-sections/timeline-event.tsx:391` 与三端 `components/AgentRuntimePanel.tsx`(miniapp `:78` / rn `:77` / extension `:117`)。
  - 数据面第 ① 层**已补**:`git show HEAD:apps/ai-service/app/services/agent_loop_v2.py | sed -n '1036,1058p'` → `emit_plan_step(..., decision=None, reason=None)` 且 payload 里带 `"decision"/"reason"`(L2541 记的"对话流根本不发 decision"这半句已过期)。
  - **端侧接不进去**:`git grep -rn "plan\.step|plan_step|planStep" HEAD -- apps/web/src apps/miniapp-taro/src packages/types/src` 的 TS 侧命全为 `planSteps`(PlanUpdateEvent 快照),web 会话侧步骤类型 `git show HEAD:apps/web/src/hooks/use-agent-progress.ts | sed -n '49,62p'` **不含 decision/reason 字段** ⇒ decision 帧到了对话流仍无处挂。
  - 验收项"与 D34 `injection_applied` 帧不重复计数":`git grep -rn "injection_applied" HEAD -- packages/shared/src/chat/step-decision.ts packages/shared/tests/chat apps/web/src/components/ai` → **零命中**(该帧在别处有 16 个文件命中,尺子有效)。
  - 验收项"cli 消费"(H18 四端矩阵含 cli):`git grep -c -E 'step-decision|permissionDecisionWord|stepDecision' HEAD -- apps/cli` → **0**;`git grep -c -i decision HEAD -- apps/cli/src` 的命中全在 `tools/permissions.ts`/`tools/sandbox/*` 等本地权限引擎,不是取词渲染。
- 判决:**L6810 = 保留未勾;L7874 = 保留未勾**(并建议主代理同批把 L2539/L2540/L6811 三条 ✅ 的"已达成"结论降级或加限定,依据见下)
- 建议改写文本(两条未勾行同法,追加在行尾,**不动勾选态**、**不删编号**):
  - L6810 →
    `- [ ] **D55 机器代批决策条(G-66,P0 首批,低成本反超项)**:…(原文逐字保留)… **还差(O60r 2026-09-25 实测)**:① **对话流渲染位**——H17 要求"对话流内 100% 有徽章",而 `git grep -c -i decision HEAD -- apps/web/src/components/chat` = 0、miniapp `src/pkg-ai` = 0、rn `ChatScreen/AiAssistantN8nScreen/chat-render-model` = 0,现有取词全在 AgentRuntimePanel / 工作台进度面板;② **端内步骤类型缺字段**——`apps/web/src/hooks/use-agent-progress.ts:49-62` 的 PlanStep 不含 decision/reason,而服务端 `agent_loop_v2.emit_plan_step`(:1036-1058)**已发**该字段 ⇒ 差的是承接不是生产;③ **cli 一格空**(H18 四端矩阵含 cli,H19 未登记 D55 豁免;`git grep -c stepDecision HEAD -- apps/cli` = 0);④ 验收"与 D34 `injection_applied` 不重复计数"无任何用例或代码命中。词表不欠(`packages/i18n/messages/shared/*` 五语含 `stepDecision`)。`
  - L7874 → 同上句式(本行与 L6810 同体、更旧且无任何标注;若主代理只想留一处欠项说明,本行可写:`**[O60r 判:保留未勾]** 本行与 L6810 同体,欠项清单以 L6810 行为准,勿重复派单。`)

---

## 票 D62(语音字幕与讨论纪要,G-76)

- 台账位置(HEAD 行号):
  - 未勾:`L6812 - [ ]`(旧 `[O60 判:裸副本]` 指针 **L2558 现是 D58 行** ⇒ 失效)、`L7875 - [ ]`(裸)
  - 已勾孪生:`L2567` / `L2568 - [x] ✅(2026-09-24)`(**逐字同体**,两行末尾都带 `__剩余__:AI 面板宿主接线…待另票`),`L8115 - [x] ✅(2026-09-25)`(装车登记,提交 `7fa94d517d3`)
  - 豁免登记:`L2619`(H19 清单)—— "**D43 快捷笔记 / D62 语音字幕与讨论纪要**:豁免 **cli**(终端无麦克风 UI 栈)、**miniapp-taro** 平台独占理由=录音 API 与 `Taro.getRecorderManager` 能力差异…**extension 已实测核验 = 不豁免**";mobile-rn **未登记 ⇒ 按 L2584"未标注按全端同步计"是义务端**。
- 复跑命令与实测:
  - 实现+消费(web):`git grep -l "voice-subtitles|VoiceSubtitleBar|classifyMicError|subtitleView|voiceSubtitles" HEAD` → 8 文件,其中生产面 `packages/shared/src/chat/voice-subtitles.ts`、`packages/shared/src/chat/index.ts`、`apps/web/src/components/ai/voice-subtitle-bar.tsx`、`apps/web/src/components/chat/voice-toolbar.tsx`、`apps/web/src/components/chat/voice-input.tsx`;宿主链:`git grep -n "voice-toolbar" HEAD -- apps/web/src/components/chat/message-input.tsx` → `:15 import { VoiceToolbar }`。
  - 逐端命中(`git grep -c -iE 'voice-subtitle|classifyMicError|subtitleView|voiceSubtitles' HEAD -- <dir>` 求和):`web => 54`、`packages/shared => 45`、**`miniapp-taro => 0`、`mobile-rn => 0`、`extension => 0`、`cli => 0`、`desktop => 0`、`packages/app => 0`**。
  - 票面要求的"miniapp 平台独占豁免标注"**在库且可机器读**:`git show HEAD:packages/shared/src/chat/voice-subtitles.ts` → `:35 export const PLATFORM_EXCLUSIVE = 'miniapp' as const`、头注 `:25-33` 写明理由与 `data-platform-exempt="miniapp"` 落标(`voice-subtitle-bar.tsx:87/106/131`),并有断言钉(`packages/shared/src/chat/__tests__/voice-subtitles.test.ts:239`)⇒ 豁免只覆盖 miniapp 一端,**不覆盖 extension / mobile-rn**。
  - 两个义务端**确有自建麦克风栈**(故不是"无处可接"):`git grep -ln -iE 'voice|getUserMedia|SpeechRecog' HEAD -- apps/mobile-rn/src` → `components/VoiceInput.tsx`、`hooks/use-voice-recorder.ts`;extension `git grep -n "recognition.onerror" HEAD -- apps/extension/entrypoints/sidepanel/components/VoiceInput.tsx` → `:119 recognition.onerror = () => setRecording(false)`(错误**不分类**、且 :242 把 error 串直接当按钮 title),该文件全仓被 `ChatPage.tsx:34/708` 真实挂载。
  - "剩余:AI 面板宿主接线…待另票"这一半句**已被今日入库覆盖**:`git grep -n "speaking=|muted=|summaryRecording=|view=|onViewChange=" HEAD -- apps/web/src/components/chat/voice-toolbar.tsx` → `:401 speaking={speaking}`、`:402 muted={muted}`、`:405 summaryRecording={recording}`、`:406 view={summaryView}`、`:407 onViewChange={setSummaryView}`;播报态由 `:55 useVoicePlayback()`(window 捕获阶段监听 `HTMLAudioElement`)提供;麦克风异常归类在 `voice-input.tsx`/`voice-toolbar.tsx` 均调 `classifyMicError`。
  - 用例复跑(工作树 == HEAD,已逐文件 `git diff --numstat HEAD` 验空):`npx vitest run voice-subtitle-mount mic-error-classes voice-subtitle-bar` → `Test Files 3 passed (3) / Tests 29 passed (29)`。
- 判决:**L6812 = 保留未勾;L7875 = 保留未勾**(旧 `[O60 判:裸副本]` 定性作废 —— 它的结论前提"该勾选态是否属实以 O60 复跑为准"本轮已复跑:✅ 孪生行确有实打实欠项)
- 建议改写文本:
  - L6812 →
    `- [ ] **D62 语音字幕与讨论纪要(G-76)**:…(原文逐字保留)… **还差(O60r 2026-09-25 实测)**:① **extension 端 = 台账明示不豁免**(见 H19 L2619)而 `git grep -c -iE 'voice-subtitle|classifyMicError|subtitleView' HEAD -- apps/extension` = **0**,其自建 `entrypoints/sidepanel/components/VoiceInput.tsx:119` 仍 `onerror → setRecording(false)` 不分类并把 error 串当 title;② **mobile-rn 端未登记豁免 ⇒ 按 L2584 全端同步**,而该端命中同为 **0**(实有 `src/components/VoiceInput.tsx` + `src/hooks/use-voice-recorder.ts` 两套麦克风面);③ miniapp/cli 两格**豁免已在台账登记**(理由分别为录音 API 能力差异 / 终端无麦克风 UI 栈),`packages/shared/src/chat/voice-subtitles.ts:35 PLATFORM_EXCLUSIVE='miniapp'` 只覆盖 miniapp,**不得当作两端的免检依据**。web + shared 侧四类错误、互斥、字幕可见、双视图均已装车(`voice-toolbar.tsx:401-407`,用例 29 passed 复跑)。`
  - L7875 → 保留未勾 + 短句:`**[O60r 判:保留未勾]** 本行与 L6812 同体,欠项清单(extension 不豁免却 0 命中 / mobile-rn 未登记豁免 / 两端各有自建麦克风栈)以 L6812 行为准,勿重复派单。`
  - **同票另需就地改写半句(L2567 与 L2568 两行各一处,须逐字保留编号"__收口(2026-09-24)__"前半段)**:把行尾
    `__剩余__:AI 面板宿主接线(voice-input 异常→classifyMicError、Speaker 播放态→speaking/muted、VoiceInputHandle.recording→summaryRecording)待另票__`
    改为
    `__剩余(O60r 2026-09-25 复跑):AI 面板宿主接线**已覆盖**(`7fa94d517d3`,`voice-toolbar.tsx:401-407` 传 speaking/muted/summaryRecording + view/onViewChange,`classifyMicError` 已在 voice-input/voice-toolbar 调用,用例 29 passed)__;仍欠 extension(H19 明示不豁免,命中 0)与 mobile-rn(未登记豁免,命中 0)两端的同类接线__`
    —— 原文那句"待另票"若不翻正,会把已入库的一半再次派出去。

---

## 票 D67(额度归属分型与折扣倒计时,G-90)

- 台账位置(HEAD 行号):
  - 未勾:`L6813 - [ ]`(旧 `[O60 判:裸副本]` 指针 **L2742 现是空行** ⇒ 失效)、`L7876 - [ ]`(裸)
  - 已勾孪生:`L2749` / `L2752` / `L2753 - [x] ✅(2026-09-24)`(**三行逐字同体**,均带 `__剩余__` 子句)、`L6720`、`L6814 - [x] ✅(2026-09-24)`(带"对账改判"尾巴)、`L8120 - [x] ✅(2026-09-25)`(装车登记,提交 `4f246c706e1`,其 L8124-8125 已自报两条残余)
  - H19 豁免清单(L2617-2623、L2624-2629)**未登记 D67 任何端豁免** ⇒ §9 / L2584"未标注按全端同步执行"生效。
- 复跑命令与实测:
  - 实现与消费:`git grep -l -iE 'quota-ownership|QuotaOwnershipCard|shouldShowOwnershipCard|discountCountdown|quotaOwnership' HEAD` → 22 文件;生产宿主核链:`git grep -n "FallbackBanner" HEAD -- apps/web/src/components/chat/message-list/MessageList.tsx` → `:32 import` + `:365 <FallbackBanner`(唯一真挂载宿主,与 `docs/plan-audit-2026-09-25/code-d67.md:27` 自述一致)。
  - **第二个"宿主"本身没装车**:`git grep -rn "import.*MessageErrorCard" HEAD -- apps packages` → **仅** `message-list/__tests__/quota-ownership-wiring.test.tsx:20` 一处 ⇒ `MessageErrorCard.tsx` 在 HEAD 生产零 importer(其自身 L8124 已承认)。所以 L8120 那句"接进两个宿主"按消费点口径是 **1/2**。
  - 逐端命中(`git grep -c` 同串求和):`web => 74`、`packages/shared => 86`、**`miniapp-taro => 0`、`mobile-rn => 0`、`extension => 0`、`cli => 0`、`apps/api => 0`、`packages/types => 0`**。
  - 词表只在一端:`git grep -rln "quotaOwnership" HEAD -- packages/i18n` → 只有 `messages/web/{en,ja,ko,zh-CN,zh-TW}.json` ⇒ 按台账 L2631 的合并拓扑(shared + 各端包),**非 web 端拿不到这些叶**,接上即裸键回显。
  - 倒计时**无数据源**:`git grep -rn "discountWindow" HEAD -- apps packages` → 8 处命中全在 `apps/web/src/components/ai/quota-ownership-card.tsx`(形参定义/使用)与其**自身测试**;无任何生产者、无任何宿主传参(与 L8125"需后端产出"一致)。
  - 服务端归属码本轮独立复跑:`git grep -rn -E "teamAdmin|billingGroupCredits" HEAD -- apps packages` → 8 个文件命中,**全部**是 web 卡片测试(`quota-ownership-card.test.tsx:61,62,103,216,217`)、`packages/i18n/messages/web/*` 的标题文案与 shared 卡片的类型定义;对 `apps/ai-service` 与 `apps/api` 单独跑同串 → **零命中** ⇒ 归属码无服务端生产者(报告 code-d67.md:68-81 的结论本轮复现)。
  - 用例复跑(工作树 == HEAD 已验):`npx vitest run quota-ownership-wiring.test.tsx` → `11 passed (11)`。
- 判决:**L6813 = 保留未勾;L7876 = 保留未勾**
- 建议改写文本:
  - L6813 →
    `- [ ] **D67 额度归属分型与折扣倒计时(G-90,与 D56 合并)**:…(原文逐字保留)… **还差(O60r 2026-09-25 实测)**:① **端覆盖只到 web** —— miniapp / mobile-rn / extension / cli 四端对 `quota-ownership|QuotaOwnershipCard|quotaOwnership` 命中**全为 0**,且 `ai.pane.quotaOwnership` 13 叶只在 `packages/i18n/messages/web/`(非 web 端合并 shared+端包 ⇒ 接上即裸键),H19 未登记 D67 豁免;② **"两个宿主"实际只有一个在产** —— `MessageErrorCard` 全仓 importer 仅其自身测试(`import .*MessageErrorCard` 命中 1 = 测试文件),分型卡在那条接缝上无人渲染;③ **折扣倒计时无数据源** —— `discountWindow` 8 处命中全在卡片定义与其测试,无生产者/无传参;④ 团队·需管理员 / 计费组·Credits 两类 errorCode 服务端无产出 ⇒ 四型只有两型可分。`
  - L7876 → 保留未勾 + 短句:`**[O60r 判:保留未勾]** 本行与 L6813 同体,欠项(四端 0 命中 + 词表只在 web 包 + MessageErrorCard 零 importer + 折扣窗口无源)以 L6813 行为准,勿重复派单。`

---

## 票 D69(输入区文案族补齐,G-91/G-92)

- 台账位置(HEAD 行号):
  - 未勾:`L6827 - [ ]`(旧 `[O60 判:裸副本]` 指针 **L2748 现是 D66 行** ⇒ 失效)、`L7884 - [ ]`(裸)
  - 已勾孪生:`L2755 - [x] ✅(2026-09-24)`(唯一 ✅ 正题行,行内 `__剩余__` 自报两条欠项)
  - 覆盖声明:`L2625`(B4e-B4o 组)"纯措辞/i18n 资产类 **D69** … 端覆盖 = web● + miniapp● + rn● + cli● + extension●,desktop○;**豁免仅 D69③ 的 `排队`族在 cli**"。
- 复跑命令与实测:
  - 判据层在库:`packages/shared/src/chat/input-notices.ts`(`git grep -l` 命中含 web/rn/miniapp 的测试与 `packages/shared/src/chat/index.ts`);`git grep -n "queueInteractionPerms" HEAD -- apps/cli/src/commands/queue-ops.ts` → `:28 import … from '@ihui/shared/chat/input-notices'` ⇒ **cli 消费的是排队族**(恰是它唯一被豁免的那族,豁免登记反而比现状更宽)。
  - 逐端命中(`git grep -c -E 'inputNotices|input-notices|canInterject|queueReasonView'` 求和):`web => 33`、`packages/shared => 41`、`cli => 3`、**`miniapp-taro => 0`、`mobile-rn => 0`、`extension => 0`**。
  - 词表只在一端:`git grep -rln -E "inputNotices|voiceSubtitles" HEAD -- packages/i18n` → 只有 `messages/web/{en,ja,ko,zh-CN,zh-TW}.json` ⇒ 非 web 端不可复用。
  - **展示件"造好没装车"**:`git grep -rn "InputNoticeBanner|input-notice-banner" HEAD -- apps packages` → 命中除定义文件自身外**全部**落在 `apps/web/src/components/chat/__tests__/input-notice-banner.test.tsx`,生产 importer = **0**;`git grep -rn "compactionReason" HEAD` 同样只命中定义 + 该测试。
  - 数据面无事件源:`git grep -rn -E "noTurnBoundary|insufficientCredits|runningTurn" HEAD -- apps/ai-service apps/api packages/types` → **零命中**(即压缩不可用三类原因在 Python/Node 侧无生产者)。
  - **族④ 附件与速记上限族不存在**:`git grep -rn -E "每条最多 ?[0-9]|附件上限|attachmentLimit|maxAttachmentsPerMessage" HEAD -- apps packages` → UI 文案零命中(命中项均为服务端尺寸处理注释,非面向用户措辞),与 L2755 行内"④附件上限族需另票"一致。
- 判决:**L6827 = 保留未勾;L7884 = 保留未勾**
- 建议改写文本:
  - L6827 →
    `- [ ] **D69 输入区文案族补齐(G-91/G-92 + D38/D43 规格补强)**:…(原文逐字保留)… **还差(O60r 2026-09-25 实测)**:① `InputNoticeBanner` **零生产 importer**(`git grep "InputNoticeBanner" HEAD` 的命中除自身文件外全在其测试)——宿主接线未做;② 压缩不可用三类原因**无事件源**(`noTurnBoundary|insufficientCredits|runningTurn` 在 `apps/ai-service`/`apps/api`/`packages/types` 零命中);③ **端覆盖仅 web**(miniapp/rn/extension 命中 0;cli 仅消费排队族 `queueInteractionPerms`(`apps/cli/src/commands/queue-ops.ts:28`),而 L2625 要求五端 ●,`ai.pane.inputNotices` 15 叶又只在 `packages/i18n/messages/web/`;④ 族④"附件与速记上限"**无任何用户可见措辞命中**,仍需另票或直接补进本票。`
  - L7884 → 保留未勾 + 短句:`**[O60r 判:保留未勾]** 本行与 L6827 同体,欠项(banner 零宿主 / 原因无源 / 端覆盖仅 web / 附件族未做)以 L6827 行为准,勿重复派单。`

---

## 汇总

| 票 | 未勾行 | 判决 | 一句依据 |
|---|---|---|---|
| D48 | L6809 | 裸副本(须换号) | 正题逐字存活于 L2511;旧指针 L2502 现是 D44 行;盘上欠项另有在册编号 L7302(实测 gate exit 1) |
| D48 | L7873 | 裸副本 | 与 L6809 同体且无任何标注 |
| D55 | L6810 | 保留未勾 | H17 要求"对话流内"徽章,而 `git grep -c -i decision HEAD -- apps/web/src/components/chat`=0、miniapp `pkg-ai`=0、rn 三文件=0;cli 一格空;`injection_applied` 去重验收零命中 |
| D55 | L7874 | 保留未勾 | 同上(与 L6810 同体,欠项以 L6810 为唯一登记处) |
| D62 | L6812 | 保留未勾 | extension 被 H19 L2619 **明示不豁免**而命中 0;mobile-rn 未登记豁免而命中 0;两端各有自建麦克风栈 |
| D62 | L7875 | 保留未勾 | 同上(与 L6812 同体) |
| D67 | L6813 | 保留未勾 | 四端命中 0 且 `quotaOwnership` 只在 web 词包;`MessageErrorCard` 零生产 importer;`discountWindow` 无生产者 |
| D67 | L7876 | 保留未勾 | 同上(与 L6813 同体) |
| D69 | L6827 | 保留未勾 | `InputNoticeBanner` 零生产 importer;原因枚举在 ai-service/api/types 零命中;附件上限族文案不存在;端覆盖仅 web |
| D69 | L7884 | 保留未勾 | 同上(与 L6827 同体) |

**另需主代理处理的三件同票事项(不在四类判决表内,但都在我这五张票的行上)**:

1. **D62 的 `__剩余__…待另票` 半句必须改判"已覆盖"**(L2567 与 L2568 各一处),否则已入库的宿主接线会被再次派出;整行成品见上面 D62 段第三条。
2. **✅ 孪生行自身的重复**:`- [x]` 同体多份 —— D48 三份(L2511/L2512/L2518)、D55 两份(L2539/L2540)、D62 两份(L2567/L2568)、D67 三份(L2749/L2752/L2753)。它们的**正文进度子项只挂在其中一行下**(D48→L2512、D55→L2539、D62→L2567、D67→L2749),其余属活文档 union 残留,可按 §12"只改写不删除"处理。
3. **D48 的 ✅ 定性需要限定**:L2511/2512/2518 三条把票面第一条验收写成"已测",但同日 L7262 自己改判为"实现已在库、**生效从未发生**",而今日盘上实测仍 violations(exit 1)+ `auth.json` 裸 JWT。建议在 L2511 行尾补一句限定并指向 L7302,不改勾选态(改判属主代理职权)。

---

## 我这路没做完 / 需主代理复核

1. **D55 的 ✅ 孪生行是否翻回未勾,我没替主代理定** —— 四类判决只授权我对**未勾行**定性。我量到的事实是:`L6811`/`L2539`/`L2540` 三条 ✅ 的"对账改判"依据(词表 + `agent-task-progress-pane.tsx:578-608` 渲染)**成立但不足以覆盖票面"对话流里没有徽章"这一原始缺口**(web 对话流组件 `decision` 零命中)。若主代理认为 ✅ 已属过度声明,需自行决定是加限定还是回退勾选态(回退会撞守门 71 的"整行消失即拦",建议只加限定句)。
2. **D48 盘上判定属"机器态",不是 HEAD 判据** —— `check-desktop-cache-plaintext.mjs` 读的是 `%LOCALAPPDATA%/%APPDATA%\com.ihui.desktop`(实测已被 junction 改道到 `G:\DevEnv\cache\userhome\…`),换机/干净检出上结论必然不同。我只登记了本机读数 + 文件 mtime(2026-09-23T10:11Z,早于 D48 提交),**没有把桌面端跑起来验证**(本机 8801/8802/8000 无监听,桌面端也不在运行)。若主代理要按"已生效"翻正,需要在桌面端重启后再跑一次该门并把读数写进 L7302。
3. **一次新发现的孤儿重复件(不属于我这五张票的票面,但正是 D62 的判据禁的东西)**:`apps/web/src/components/ai/voice-input.tsx` 在 HEAD **零 importer**(`git grep -rn "ai/voice-input" HEAD` 全仓唯一命中是 `scripts/hardcoded-zh-baseline.json:258`),而它 `:295` 仍写着 `setError('无法访问麦克风,请在浏览器设置中允许麦克风权限')` —— 即 `packages/shared/src/chat/voice-subtitles.ts:22-23` 明令"端内不得再建第二套麦克风错误分类"的那一型。它是"删除/合并"动作,涉及他人可能未提交的引用,**我没动也未建议直接删**,登记交主代理裁决(若删,须走守门 99 的存续性判定)。
4. **未跑的门/测试**:为控制轮次,我只实跑了两组与结论直接相关的 vitest(D62 29 passed / D67 11 passed,均先验过工作树 == HEAD)。台账里 D48 的 `d48-*.test.ts` 30/36 例、D55 的 `packages/shared/tests/chat/step-decision.test.ts`、D69 的 `input-notice-banner.test.tsx` 我**只核了文件在 HEAD 存在,未跑**;这些数字一律引用时请标"报告自述",不得当本轮实测。
5. **cli 对 D67 的义务端判定存疑**:L2625 那句端覆盖声明把 **D69/D81+D83/D94/D100** 列名,却没列 D67;而 D67 属"额度错误文案 + 动作族"型,与 L2628 的 **D100 计费自助**(其豁免是逐条给的:miniapp 只豁免"自助改卡/自动充值",恢复动作不得整项豁免)高度同族。我按"未登记豁免 ⇒ 全端同步"从严判为保留未勾;若主代理认为 D67 应并入 D100 的逐格豁免口径,请把该豁免**显式写进 H19 清单**(L2617-2623 / L2624-2629),否则下一轮仍会按全端派出。
6. **行号会漂**:本报告全部 L 值是本次 HEAD 读数。落盘时务必自己重新定位(尤其 `[O60 判:裸副本]` 里那串旧行号 L2502/L2530/L2558/L2742/L2748 —— 五条**全部**已失效,其中 L2530/L2742 现在是空行,照抄指针会让后人以为登记丢了)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
