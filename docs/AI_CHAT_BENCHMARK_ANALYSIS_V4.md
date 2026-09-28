<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AI 对话全链路四竞品深度对标分析 V4（Codex / Trae / Qoder / WorkBuddy）

> 编号续 V3（47–86），本轮新增 **87–105**。
> 本轮主题不是「能力有没有」，而是 **「能力存在，但用户看不见 / 只在一端看得见 / 看见了但不保真」**。
> 成文日期:2026-09-28。前序:V1(1–14 主链路有无)、V2(15–36 对话流元素粒度)、V3(47–86 能力是否真实存在并在跑)。

---

## 一、结论先行

1. **V3 的两条 P0/差距结论已被代码推翻**（按 V3 §八 自己的规矩「台账勾选态会滞后，以代码为准」现读）:
   - **V3 #73**「小程序无 AI 对话页」—— 实测 `apps/miniapp-taro/src/pkg-ai/ai/chat.tsx`(1623 行)在库且最新提交为 2026-09-27(`3f3e71a99`,D113 票),逐名覆盖 23/30 事件。**该差距已不成立**。
   - **V3 #51**「`run_in_background` 只有 sleep/echo 两个演示实现」—— 实测 `apps/ai-service/app/services/task_executors.py` 有 16 个 `async def`,且已有 import 期三面 parity 断言(`:1293-1297`)与守门 `check-background-task-type-parity.mjs`。**核心半边已落地**,只剩「8 类中 2 类仍是自证 stub」这一小口。
   - **V3 #47**「三套执行内核」—— 今天 `class AgentLoopV2` 是唯一内核(`agent_loop_v2.py:1460`),但 `agent_loop.py` 仍以 `agent_executor` 这个名字被 **3 处生产引用**(`routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162`)。准确表述应为「**一套半**」:V2 是真内核,V1 文件作为出口壳活着。
   - ⇒ 这三条**不得再作为待办派单**,否则就是把已交付的东西重新卖一遍。
2. **本轮实测的最大单点不是「缺功能」,是「跨端可达性塌方」**:共享流层 `packages/api-client/src/client.ts:1011-1165` 定义 **30 个 `on*` 回调**,与 SSE 契约主面 30 个事件(`packages/shared/src/sse/contract.ts:28-81`)一一对应;而 RN 主聊天屏 `apps/mobile-rn/src/screens/ChatScreen.tsx` 只接 **7 个**,**23 个未接** —— 包括 `onToolCall / onToolApproval / onPlanUpdate / onTerminal* / onSubagent* / onUsage / onBudget / onQuestion / onFormRequest / onReconnect`。手机上看 AI 对话 = 一个只有文字流的旧式聊天框。
3. **对话流「信息保真」有两处结构性失真**,V1–V3 三轮都没量到:
   - 用户消息按**纯文本**渲染(`MessageItem.tsx:884`),而发送侧把附件**拍平成 Markdown 语法**塞进正文(`use-message-send.ts:256-280`)。两者一撞:**用户自己上传的图片,在自己的气泡里显示成 `![](url)` 源码**。
   - 工具参数用 `JSON.stringify(args, null, 2)` 裸 dump(`tool-call-card.tsx:1247`),而审批弹窗要用户当场决定「允不允许」。**决定审批所需的信息形态,和实际给出的信息形态,不是同一个东西。**
4. **后端有、前端整条链路没有的一档:推理强度(reasoning effort)**。`apps/ai-service/app/core/reasoning_effort_pin.py` 有 19 处实现(对标 Codex `reasoning_effort.rs`),`packages/types/src/subagents.ts` 有 `ReasoningEffort` 类型,但 **`packages/api-client` 与 `packages/types` 的对话请求入参零命中、web 零控件** —— 四款竞品全部在对话界面暴露这一档。
5. **V3 §八 给后续会话留的建议(`scripts/audit-benchmark-delivery.mjs`)至今未落地**(`ls` 实测不存在)。上面第 1 条就是它要防的事:每轮对标都手工重验,而手工重验必漏。**本轮把它列为 #105 并排进最近一个 Sprint**。
6. **本轮自我更正一条(必须写进正文,因为它正是 #105 要防的形态)**:初稿曾把 #89 写成「主聊天流断线无自动重连」,复量后**否证** —— api-client 层有完整重连与续传(`packages/api-client/src/client.ts:2078` `maxRetries = opts.maxRetries ?? STREAM_MAX_RETRIES`、`:2129` 带 `Last-Event-ID` 头、`:3443` 从 `id:` 行记录游标),而 web **确实消费了** `onReconnect`(`apps/web/src/hooks/use-chat/send-message.ts:767-775` 弹 toast「Attempt N, retrying in Xms」,i18n 键 `reconnecting`/`reconnectAttempt` 带兜底)。#89 的真实缺陷因此**窄化为两件**:常驻连接状态件从未上屏、待决审批在重连后的恢复无取证。该条已按实测重写。

---

## 二、证据等级(沿用 V3 口径)

| 级别 | 含义 | 本轮用法 |
| --- | --- | --- |
| **E1** | 本仓代码实测,给 `文件:行号`,可复核 | 所有「现况」条目 |
| **E2** | 本仓运行时实测(命令输出/真机日志) | 未涉及 |
| **E3** | 竞品**官方文档/发布说明**原文 | 所有「竞品基线」条目 |
| **E4** | 竞品评测/社区二手 | 仅作交叉,不单独定罪 |
| **E5** | 二手不可核证 | **WorkBuddy 全部条目**(本机无本体、无安装包、无运行时取证物;本仓 `.workbuddy/` 是我方自建状态目录,与该竞品无关)。E5 不参与「有/无」判定,只作方向参考 —— 承 V3 §一.4 与 D57 票面纪律。 |

> **本轮取证方式**:4 路并行调研(web 展示层 / 引擎与工具层 / 竞品联网调研 / 其余五端),主会话对关键断言逐条自己复量。**复量否证或更正了 7 条**,全部写进正文而非留在口头:
> ① V3 #73「小程序无 AI 页」→ 已被代码推翻(§一.1);② V3 #51「后台只有 sleep/echo」→ 已被代码推翻;③ V3 #47「三套内核」→ 应为「一套半」;
> ④ `packages/app` 的 `ChatScreen` 并非「未导出」,而是**导出在位、零消费方**(`index.ts:684`);⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 票已✅)⇒ 队列**不是**差距;
> ⑥ #89「无自动重连」→ **否证**,api-client 有重连与 `Last-Event-ID` 续传且 web 消费了 `onReconnect`,缺陷窄化为「状态件未上屏 + 待决审批恢复未取证」;#96 的「web 反而没有续传」同批否证;
> ⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空(只在工作树未跟踪面)⇒ 摘出清单;六端覆盖数改用**统一交集判据**重算,并登记两个口径不可混用。

---

## 三、本项目对话流现状量化(现读 E1,勿照抄旧档)

| 面 | 现值 | 取法 |
| --- | --- | --- |
| SSE 契约主面事件 | **30** | `awk '/^export const SSE_EVENTS/,/^}/' packages/shared/src/sse/contract.ts \| grep -cE "^  [A-Z_]+:"` |
| Anthropic 兼容面 | **6** | 同上,`SSE_COMPAT_EVENTS` 段 |
| 共享流层回调 | **30**(与主面一一对应) | `grep -oE "^  on[A-Z][A-Za-z]*\??:" packages/api-client/src/client.ts \| sort -u \| wc -l` |
| 服务端工具数 | **90**(`_TOOLS` 清单) | `grep -c "MCPTool(" apps/ai-service/app/services/mcp_server.py` |
| web 消息渲染块型 | **1 套投影 + 20 余个专门组件** | `apps/web/src/components/chat/message-list/MessageItem.tsx` |
| 六端回调覆盖(统一判据:与上面 30 名逐词交集) | **web 30/30**(按 `apps/web` 全域;`streamChat` 主调用点 29/30,第 30 个在别处消费) / extension 19/30 / cli 12/30 / **RN 主屏 7/30** / RN 另一屏 17/30 / miniapp 17/30(它不走 api-client 回调面,见下) / desktop=继承线上包 | 逐名跑 `grep -qw "<回调名>:" <端文件>` 计数(数字与命令同批现跑,勿改判据后再引用旧数) |
| miniapp 按**事件名**口径的分发覆盖 | **23/30**(缺 `thinking` `plan-step` `question` `start` `tool-approval` `budget` `form_request`) | `apps/miniapp-taro/src/api/index.ts:536 streamSSE` |

> **两个口径不可混用**:miniapp 自写传输层(#96),它按**事件名**分发所以覆盖 23/30,而按 api-client 的**回调名**交集只有 17/30 —— 差的那几个(`onDelta`/`onDone`/`onError`)它当然有实现,只是不叫这个名字。**引用这类数时必须同时报口径**,否则会出现「同一端 23 与 17 打架」的假矛盾(V3 的 budget 帧两次翻案就是栽在口径上,见其 §五 并行冲突提示④)。

---

## 四、V4 差距总表(87–105)

图例:🔴 **P0**=正确性或信任型缺陷;🟡 **P1**=体验与对等性;⚪ **P2**=长尾。

### G 组 · 对话流信息保真(87–92)——「看得见,但看见的不是真相」

---

**#87 · 🔴 P0 · 用户消息不渲染 Markdown,导致自传附件显示成源码**

- **现况(E1)**:用户消息分支是 `<p className="whitespace-pre-wrap break-words">{m.content}</p>`(`apps/web/src/components/chat/message-list/MessageItem.tsx:884`),**不经过任何 Markdown 解析**;而发送侧 `doSend` 把引用**拍平进正文**:图片 `![]()`、视频 `<video>`、长文本 fenced block、其他 `> 📎 label`(`apps/web/src/hooks/use-chat/use-message-send.ts:256-280`)。
- **后果**:用户传一张图,自己的气泡里显示 `![photo](https://…/xxx.png)` 字面量;传代码片段显示成裸三反引号。**助手侧富渲染、用户侧纯文本,同一屏两种保真度**。
- **竞品基线(E3)**:Codex transcript 对用户消息同样渲染并支持选中复制回填;Trae「添加到对话」把终端选区/浏览器元素做成**独立引用条目**而非正文文本;Qoder 把终端/回复片段转成**引用胶囊**;CodeBuddy 把 @ 引用改成**紧凑引用胶囊(带行号)**。四家共同点:**附件与引用是结构化对象,不是正文字符串**。
- **方案**(两步,第二步才是根治):
  1. **止血**:用户消息分支改用与助手侧同一套 Markdown 渲染器,但**关掉危险项**(不渲染 HTML、不执行 rehype-raw),仅代码块/图片/列表/行内码。一处改动即消除「显示成源码」。
  2. **根治(与 #91 同批)**:消息体增加**结构化附件字段**(`attachments: {kind,url,name,bytes}[]`),渲染层按字段出附件卡;正文里的 `![]()` 拍平逻辑降级为「无结构化字段时的兼容投影」。发送侧与渲染侧**必须共用一份附件判定表**(现判定在 `use-message-references.ts:45-65`,渲染另写一套 = 漂移源)。
- **验收**:① 上传 png/jpg/代码/office 四类各一条,断言用户气泡内**不出现** `![`、```` ``` ````、`> 📎` 字面量;② 图片渲染为可点开预览的缩略图;③ 与 D41(Office/PDF 产物预览)的预览器复用同一组件,**不得造第二个图片预览器**;④ e2e 覆盖暗色/折叠/流中三态。
- **边界**:这是展示层改动,**不改发送协议**,故不动 `apps/api` 的落库形态;第 2 步要动落库形态时另计票并走 §7 删除安全。

---

**#88 🔴 P0 · 推理强度(reasoning effort)前端整条链路缺席**

- **现况(E1)**:后端有实现且成体系 —— `apps/ai-service/app/core/reasoning_effort_pin.py`(19 处引用,含按 provider 钉档)、`apps/ai-service/app/core/capability_matrix.py`、`turn_metadata.py`;CLI 子代理有类型 `ReasoningEffort = minimal|low|medium|high`(`apps/cli/src/subagents/types.ts:21`)。**但对话请求面零命中**:`git grep -iE "reasoningEffort|reasoning_effort" -- packages/api-client packages/types apps/web/src` 结果为空 ⇒ 既无入参通道,也无 UI 控件。
- **后果**:用户完全无法表达「这次要想深一点/快一点」;而模型侧的档位仍按后端默认钉,账单与延迟对用户不可解释。
- **竞品基线(E3)**:Qoder **Thinking Effort low/medium/high/xhigh/max**(与 Tier/Specific Model 并列为第三根轴);Codex `/reasoning` 低中高 + `/fast`(1.5× 速度 2.5× 积分)+ Ultra;CodeBuddy「模型思考强度选择 + 思考模式开关」;Trae「Max 模式」扩上下文/思考。四家**都在对话输入区暴露**。
- **方案**:① 在 `packages/types` 的对话请求类型上开 `reasoningEffort?:` 字段(**封闭枚举,不用 string**,否则 provider 侧无法钉档);② api-client 透传;③ `apps/web/src/components/chat/model-selector.tsx`(已含 5 档 tier + 厂商分组 + 能力徽章)旁边加第三根选择轴,档位可选性**由 capability matrix 驱动**(该 provider/模型不支持就置灰并说明原因,**不得静默接受一个无效值**);④ 后端已有 `reasoning_effort_pin.py`,只需接住入参。
- **验收**:① 选 low 与 high 各发一轮,`turn_metadata` 落库的档位字段必须不同(断言真的透到了上游请求,而不是前端存了个状态);② 不支持该档的模型上,控件置灰且 tooltip 给原因;③ 五语言 i18n parity(`check-i18n-keys`)+ 零死 key;④ 与 D45(会话详情聚合档位)不冲突 —— 那是**展示**档位,这是**推理**档位,两者不得共用一个开关。

---

**#89 🟡 P1 · 连接状态件从未上屏 + 重连后待决审批的恢复无取证**(初稿曾写「无自动重连」,已否证并窄化,见 §一.6)

- **已具备(别重复造)**:自动重连与断点续传在共享层是**真的存在** —— `packages/api-client/src/client.ts:2078`(`maxRetries = opts.maxRetries ?? STREAM_MAX_RETRIES`)、`:2129`(重连请求带 `Last-Event-ID` 头)、`:3443`(从 SSE `id:` 行推进游标);web 也**确实消费**了 `onReconnect`(`apps/web/src/hooks/use-chat/send-message.ts:767-775` 弹 toast,i18n 键 `reconnecting` / `reconnectAttempt` 带未翻译兜底),`send-answer.ts:292` 同形。页面刷新后的续接另有 `resume-stream.ts:67`。
- **真缺陷 A(E1)·常驻状态件零挂载**:`apps/web/src/components/ai/progress-sections/connection-status.tsx` 的四态指示器(connecting/connected/reconnecting/disconnected)+ `deriveConnectionState` **在生产面没有任何挂载方** —— `git grep connection-status -- apps/web` 命中**全部落在测试文件** `apps/web/tests/agent-task-progress-pane.test.tsx`(:460 的 import、:1675/:1685/:1694/:1702/:1752/:1761 的断言)。即重连发生时用户只看到一条**会消失的 toast**,没有常驻状态可读。
- **真缺陷 B(E1 缺口,非已证坏)·重连后待决审批是否恢复,无人取证**:审批帧 `tool-approval` 是一次性下发(`contract.ts:64-67`),而续传按 `Last-Event-ID` 只补**游标之后**的帧。断线恰好发生在「已下发审批、用户未点」的窗口时,重连后那张审批卡会不会永久消失,**本轮未取证**(要取证需构造断线时机的端到端场景)。它不是假想风险:CodeBuddy 的发布说明把「审批弹窗与发送状态随重连恢复」列为**专门修过的问题**(E3),说明这一型在真实产品里确实会发生。
- **竞品基线(E3)**:Codex 重连保留线程状态;CodeBuddy 有重连宽限期、审批弹窗随重连恢复、切换对话 10s 超时自动放弃并明确提示;Trae/Qoder 均有显式停止与状态反馈。
- **方案**:① 把 `connection-status` 挂进消息流容器(与 D45 聚合档位条同位)—— 这是**纯接线**,不写新组件;② 先做取证:构造「断线瞬间存在待决审批」的端到端场景,记录重连后审批卡的实际状态(拿到否证比拿到合格证有用);③ 若 ② 证实会丢,修法唯一在**服务端**:`Last-Event-ID` 续传必须把该会话**未结算的待决表**一并重放(`apps/ai-service/app/services/agent_engine.py:1817/1832` 那两张 requestId→带主记录的表已有主体信息,重放出口现成),不得由前端靠本地缓存兜;④ 与 #94 同批:RN/小程序接上审批帧之后,这条重放才在两端口上成立。
- **验收**:① `connection-status` 的**生产面 importer ≥1 且排除测试面**(本仓为这条栽过 64/70/81/115/138 五次);② 人为断网 3s 再恢复,断言状态条走过 reconnecting→connected 且已到达的部分输出未被清空;③ 断线时存在一张待决审批 → 恢复后该审批仍可见、仍可操作,且**拒绝后副作用确实未发生**(副作用断言,不只看错误码);④ 若 ② 取证结论是「不会丢」,必须在本文登记否证与取证命令,不得留成悬案。

---

**#90 🟡 P1 · `usage` 帧在 TS 判别联合里没有成员,计量展示天然漂移**

- **现况(E1)**:`contract.ts:51` 声明 `USAGE: 'usage'`,Python 侧 `core/sse_contract.py:176` 有 `SSEEventContract("usage", …)`;但 TS 的判别联合 `SSEEventPayload`(`contract.ts:115-355`)**没有 `type:'usage'` 成员** —— usage 只作为 `done` 帧的可选字段存在(`:285`,且类型是 `Record<string, unknown>`)。
- **后果**:各端只能各自 `as` 断言取用,字段名/单位(input/output/cache)无类型约束;`packages/types/src` 改一下字段,六端一个都不红。
- **竞品基线(E3)**:CodeBuddy `/cost` 能按模型列 input/output/cache read/cache write token 并给 Total duration(API/wall)与 Total code changes 行数;Qoder CLI `/usage` 面板含 Total Duration + Total Code Changes 且用量 80%/95% 变色;Codex `/usage` + OTel 导出。共同点:**计量是一等契约,不是 done 帧的附带字段**。
- **方案**:① 给 `usage` 建正式判别成员(字段封闭:`inputTokens/outputTokens/cacheReadTokens/cacheWriteTokens/reasoningTokens?/costMicroUsd?/firstTokenMs?`);② `web/message-item-parts.tsx:231/295` 的徽章与 `live-usage.ts:35` 的流中估算改吃该类型(**估算口径必须与后端计费口径同源,否则用户看到「约」与账单对不上**);③ 双端 parity 由既有 `check-agent-event-parity.mjs` 覆盖,但需把「判别联合成员数 == 主面事件数」加为一条新断言 —— 这正是本条要防的「名字在、类型不在」。
- **验收**:① `tsc` 下故意把字段名写错必须红(证明类型真的在守);② 主面 30 个事件全部有判别成员(计数对账,缺一个即红);③ 六端 usage 取值不再出现 `as` 断言(grep 断言)。

---

**#91 🟡 P1 · 两套 SSE 事件命名族并存且无映射表**

- **现况(E1)**:除对话流主面(`contract.ts`,30 名)外,还有第二套 `packages/shared/src/sse/agent-events.ts`(`tool_call/tool_result/thinking/started/completed/session/…`,agent 任务流),**两族不同名、不同风格、无交叉映射表**;`contract.ts:271-275` 自陈 camelCase 与 snake_case 写错即**整帧静默丢弃**;`packages/types/src/agent-runtime.ts` 的 `AgentSSEEvent` 被 parity 脚本当兜底契约扫。
- **后果**:端内各自 if-else;「一个能力在对话流可用、在任务面板不可用」这类现象无法归因(本轮 RN/miniapp 审批缺失就是同一形态的后果之一)。
- **竞品基线**:四家均未见同型双族并存(E3 未取证到反例);此条属**我方自造复杂度**,不需要竞品来证明它是问题。
- **方案**:① 出一份**事件族登记表**(哪些属于对话流、哪些属于 agent 任务流、哪些共用),放 `packages/shared/src/sse/families.ts`,作为唯一真相;② 命名风格统一由构造层做(生产者写 snake、消费者读 snake,类型层暴露 camel 只做一层投影,投影函数唯一);③ 「写错大小写整帧静默丢弃」这一条必须改成**显式未知事件计数 + 上报**,不得静默(与 §守门速查「把没判写成判过了是最高频失效型」同一条禁令)。
- **验收**:① 未知事件计数在真仓跑一次必须为 0 且**该计数本身可被注入验证**(喂一个假事件名,断言计数 +1 且有点名);② 族登记表被引用数 ≥1 per 族;③ parity 门扩到同时判两族。

---

**#92 🟡 P1 · 工具参数是 JSON 裸 dump,不足以支撑「当场决定是否批准」**

- **现况(E1)**:`tool-call-card.tsx:1247` 把 args 走 `JSON.stringify(…, 2)` 原样打印;`stream-ui.tsx:430-456` 的 `StreamCode` 高度 200px 硬封顶,无搜索、无字段高亮;`tool-approval-dialog.tsx:217-320` 里有 `danger_level` 徽章 + `argsPreview` + once/session/always 三档 + 理由输入(**审批弹窗本身是合格的**),但**默认路径上的参数摘要只有 `describeToolCall` 的 subject/metric 两个字段**(`tool-display.ts:176-181/370`)。
- **差距**:审批要求用户在两秒内判断「这条命令能不能跑」,而界面给的是 JSON。竞品把它做成结构化卡片(见下)。
- **竞品基线(E3)**:Qoder 审批请求「给出具体命令、文件路径、目标地址与原因」并可批准/拒绝/**让 Qoder 换个做法**;Trae 命令卡片带「自动运行」下拉(本次/当前对话/所有对话)+ 超范围时在流内显示审批卡片;CodeBuddy 卡片区分「写文件卡/命令卡」并带接收中转圈态;Codex 审批条目带状态 Reviewing/Approved/Denied/Aborted/Timed out + 风险等级。
- **方案**:按 effect scope 分类给**专用摘要形态**(命令类=可换行的命令本体 + 工作目录 + 是否含删除;写文件类=路径 + 增删行数 + 可点开的 diff;网络类=method + host + path + 是否含凭据段)。分类依据取 `packages/types/src/tool-contract.ts` 的 `TOOL_EFFECT_SCOPES` —— **与 #99 是同一条链的两端**:契约不落地,分类摘要就只能继续靠工具名猜。
- **验收**:① 高危命令(含 `rm`/`DROP`/`curl -d`)在审批卡上**命令本体完整可见**且超 200px 可展开可搜索;② 三档授权语义与现有 `once/session/always`(D84)一致,不得新增第四种;③ 加「换个做法」出口(与 V3 #45 自愈工作区协同)。

---

### H 组 · 跨端可达性(93–98)——「web 做完了,等于做完了吗」

---

**#93 🔴 P0 · RN 主聊天屏只接 7/30 回调,同端两套实现**

- **现况(E1)**:`apps/mobile-rn/src/screens/ChatScreen.tsx`(3615 行,导航注册 `RootNavigator.tsx:654`)在 `streamChat` 调用点(`:652`起)只传 **7 个**回调:`onDelta(:661) / onReasoning(:673) / onError(:683) / onCitations(:703) / onInjectionApplied(:723) / onSteer(:739) / onDone(:756)`。未接的 **23 个**:`onToolCall onToolDelta onToolSummary onToolApproval onToolDelegate onPlanUpdate onTerminalStart onTerminalDelta onTerminalEnd onSubagentSpawn onSubagentProgress onSubagentEnd onUsage onBudget onCompaction onFallback onRetryScheduled onQuestion onFormRequest onReconnect onResponse onAgentDelta onMemoryUpdates`(逐名 `comm -23` 算出)。
- **更难看的是同端两套**:`apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx:1412` 起接了完整工具链(`:1472 applyToolCallEvent`、`:1489 applyToolDelta`、`:1497 applyPlanUpdate`、`:1520/1541` 终端、`:1916 TaskStatusBar`),而 `apps/mobile-rn/src/utils/chat-render-model.ts` 的 4 个 `apply*` 纯函数**在主聊天屏零调用方** —— 引擎写好了没接线。
- **差距**:§9 要求「默认全端连通、禁止只改一端交付」;V2 #23「多端同步」当年就已因此重列为 V3 #71。这一格至今是**用户可感知的最大落差**(手机上看不见 agent 在干什么)。
- **竞品基线(E3)**:Codex iOS/Android Remote 可看可接管在跑会话(带 Live Activity);Qoder 移动端可续接桌面任务并**应答待决交互**;Trae 移动端连 TraeCode;CodeBuddy 有小程序端。共同点:移动端的对话流**不缺工具与审批**。
- **方案**:① 主屏改为消费 `chat-render-model.ts` 那份现成引擎(**不新写**,这是「接线」不是「开发」);② 与 `packages/app/src/features/chat/ChatScreen.tsx`(#95 那条孤儿)二选一作唯一实现,不得两端各留一份;③ 端能力档案表:逐端声明「该端支持哪些回调」,不支持的必须**显式降级并可见**(如终端面板在手机上折叠成一行文本),不得静默不接。
- **验收**:① RN 真机跑一次带 3 个工具调用的会话,截图必须有工具卡与状态;② `applyToolCallEvent` 的**生产面 importer ≥1 且排除测试面**(本仓栽过两次:组件自带测试让孤儿一路绿);③ 与 #97 的新守门联动 —— 覆盖表不填即红。

---

**#94 🔴 P0 · 工具审批在 RN 与小程序聊天流零处理(信任型缺陷,不是体验问题)**

- **现况(E1)**:`tool-approval` 帧已在契约里(`contract.ts:64-67`,V3 #58 立),web 有 `tool-approval-dialog.tsx`、extension 有 `ToolApprovalBanner.tsx:875`、cli 有 `repl.ts:2464 createAuditedDangerGate` + `tools/danger-gate.ts`。而 `git grep "tool-approval|toolApproval" -- apps/mobile-rn/src apps/miniapp-taro/src` **零命中**。
- **后果**:手机上遇到需要审批的操作时,**要么没有弹窗、要么直接执行**,而用户完全不知道发生过这个决定。这比「功能缺失」更严重:它让「我在受控模式下使用 AI」这个承诺在移动端不成立。
- **方案**:与 #93 同一批接线(审批帧本身就在流里,只是没人接)。弹窗形态复用 `packages/app` 的对话框层;三档语义 once/session/always 必须与 web 完全一致(D84),**不得在移动端偷偷只给「允许/拒绝」两档**。
- **验收**:① 两端各跑一条高危命令,截图证明弹窗出现且能选三档;② 断言**被拒后该操作确实未执行**(副作用断言,不是只看错误码 —— 承 §「越权用例要断言未发出查询」同一条纪律);③ 被拒后**仍留人工放行入口**(拒绝是一次判定,不是永久禁止,承 AGENTS §30)。

---

**#95 🟡 P1 · `packages/app` 共享 AI 聊天屏:导出在位、零消费方**

- **现况(E1)**:`packages/app/src/index.ts:684` 确实 `export { ChatScreen } from './features/chat/ChatScreen'`(**更正调研初稿那句「未从 index.ts 导出」**——那是错的,组件本体导出了)。真问题是**全仓无人 import 它**:mobile-rn 复用的是同包其它 4 个聊天屏(`AgentChatScreen`/`CircleChatScreen`/`LiveChatScreen`/`MessageChatScreen`,各自 `src/screens/*.tsx:11-12`),**AI 对话那个屏没被用**;且 `packages/app/src` 对 `@ihui/shared/chat` 的引用数为 **0**,即它完全不在消息渲染契约上。
- **差距**:一个 100% 写好的共享实现躺在共享包里当死代码,而 RN 主屏另写一份只接 7 个回调的 —— 这是 #93 的**成本来源**。
- **方案**:与 #93 合并决策:选定唯一实现(RN 端 adapter + 共享壳),另一份按 V3 §七「孤儿件要么接要么删」处置。**不得两份都留**。
- **验收**:① 决策写进票面(选哪份、为什么);② 落选那份删除前按 §7 删除安全三问(承载什么功能/有无等价实现/无则先迁移),并走守门 99 的存续性判据(索引里仍被引用即拦)。

---

**#96 🟡 P1 · 小程序自写流式传输层,与 api-client 两份重连/退避/超时**

- **现况(E1)**:`apps/miniapp-taro/src/lib/sse.ts`(Taro `enableChunked` / H5 fetch 双通道 + `Last-Event-ID` 断点续传 + 指数退避 + 读超时 + AbortSignal)与 `src/api/index.ts:536 streamSSE` 是**端内另一套实现**;事件分发逐名覆盖 **23/30**,缺 `thinking`、`plan-step`、`question`、`start`、`tool-approval`、`budget`、`form_request` 七帧。
- **反讽点(更正初稿)**:初稿此处写「小程序端自己实现了 `Last-Event-ID` 而 web 反而没有」—— **后半句是错的**,共享层 `packages/api-client/src/client.ts:2129` 就带 `Last-Event-ID` 续传,web 通过它继承。真实形态更值得警惕:**共享层已有的能力,端内又抄了一份自己的实现**(小程序 `src/lib/sse.ts` + `src/api/index.ts:536`),于是同一条续传逻辑存在两份,而两份的退避表、超时值、缺帧处理各自演化。即「不是谁缺功能,是同一功能养了两份实现」—— 承 §4「两处算同一件事必须共用一份实现」。
- **方案**:把 api-client 的传输层做成**平台 adapter 注入**(§3 工厂模式:`createStreamTransport({ fetch | enableChunked })`),小程序端删掉自写层改调工厂 + 传平台 adapter。禁止继续维护两份重连表。
- **验收**:① 全仓 `Last-Event-ID` 语义只有一份实现(`grep -rn Last-Event-ID` 排除测试后必须落在一个文件);② 小程序补接七帧后逐帧有对应用例;③ `pnpm --filter @ihui/miniapp-taro typecheck` 零错误。

---

**#97 🟡 P1 · 事件 parity 守门只护 web,其余五端的缺失结构性不可见**

- **现况(E1)**:`scripts/check-agent-event-parity.mjs:537` 只扫 `apps/web/src`,`:809` 只把 `apps/web + api-client` 认作消费方 ⇒ miniapp / extension / cli / **mobile-rn** 的事件缺失全部不在守门范围。AGENTS §9 声明「默认全端连通」,但**机器判据只覆盖 1/6 端**。
- **差距**:这是本轮最该先修的一条 —— 因为 #93/#94/#96 全部**之所以能长期存在**,就是因为没人看守这一维。**先补尺子,再清偿存量**,顺序反了就会天天漏。
- **方案**:① 建**端能力档案表**(`scripts/data/end-capability-profile.json`,逐端声明支持的回调/帧集合,必须带 `reason` 与 `until`,挂守门 108 到期账);② parity 门把消费面从 web-only 扩到六端,**按档案表判**:档案里声明支持的必须真接,档案里没有的必须在报告里显式列为「该端不支持:原因」,不得静默;③ 与 #105 的交付核验尺子共用一份「存在性判据」。
- **验收**:① 摘掉 web 某个 `on*` 回调,门必须红(阳性对照);② 摘掉 **RN** 某个回调也必须红(证明扩面真的生效,不是只改了清单 —— 本仓 §4「给守门扩面必须同批改两半」同一条);③ 存量按「该文件 HEAD 自身计数」套棘轮,绝不产出恒红门(§12e)。

---

**#98 🟡 P1 · 桌面端三处口径互斥(薄壳本身是决策,矛盾才是缺陷)**

- **现况(E1)**:三处说法互相打脸 ——
  1. `apps/desktop/src-tauri/tauri.conf.json:10` `frontendDist: "shell"`、`:18` `url: "https://aizhs.top/agents"`(**远程壳**);
  2. `scripts/ensure-web-out.mjs` 头注自称「单产物分发契约的唯一校验点」,但 `tauri.conf.json:8` `beforeBuildCommand: ""` 且 `package.json` 的 `build` 直跑 `tauri build` ⇒ **该脚本在构建链上永不执行**;
  3. `docs/MULTI_END.md §2.5` 称桌面端用 React18+Vite 并复用 `@ihui/api-client`/`@ihui/types`/`@ihui/ui-react` —— 而 `apps/desktop/package.json:7-21` 的依赖只有 `@tauri-apps/cli` + `rimraf`,**零相关依赖**。
- **重要边界**:V3 #72 已明确「**保留薄壳策略**(前端单一事实源在 web),只加本地能力层,不复制 UI」—— 这是已拍板的架构,**本条不得把它读成「该改成产物分发」**(承最近记过的教训:文档说 A 代码做 B 时,先查 B 是不是人刚拍的)。矛盾的是**三处文档/脚本/配置互相指认**,不是架构选型。
- **方案**(三选一,建议 A):
  - **A(推荐)·口径对齐 + 盲区显式化**:① 删或改写 `ensure-web-out.mjs` 的「唯一校验点」声称,并在其头注写明它当前**不在构建链**;② `docs/MULTI_END.md §2.5` 按实测改写成「远程壳 + 本地能力层」;③ 明确登记「桌面端 AI 对话的版本由线上站点决定,本仓不可校验」这一事实及其风险(线上部署与本地代码不一致时,桌面端表现不属于本仓可复现范围)。
  - B·真上产物分发:改 `beforeBuildCommand` 跑 `ensure-web-out.mjs`,并给版本锁定与离线降级方案。爆炸半径大,需要用户拍板。
  - C·删脚本:若桌面端永不自带前端,`ensure-web-out.mjs` 属死代码,按 V3 §七 孤儿规矩删除。
- **验收**:① `grep` 断言「自称唯一校验点」这句话不得再出现在一个 `beforeBuildCommand` 为空的配置旁边(可写一条小门);② `docs/MULTI_END.md` 与 `tauri.conf.json`、`package.json` 三者对桌面端形态的描述**逐字一致**;③ 若选 B,断网真机跑一次桌面端并留证据。

---

### I 组 · 契约与引擎一致性(99–104)

---

**#99 🔴 P0 · 工具契约层「类型有定义、运行时零落地」**

- **现况(E1)**:`packages/types/src/tool-contract.ts` 定义了 `TOOL_EFFECT_SCOPES`(7 档,`:36`)、`TOOL_RISK_LEVELS`(`:173`)、`ToolPermissionContract`(`:188`)、`ToolResultBudgetContract`(`:216`)。但服务端 `MCPTool` dataclass 只有三字段 `name/description/input_schema`(`apps/ai-service/app/services/mcp_server.py:612-617`),CLI 侧仓内自证 `apps/cli/src/tools/**` 里 `effectScope` **出现 0 次**(`commands/spec-drift.ts:573`)。
- **后果**:权限判定与审批只能靠**工具名 + dangerLevel 兜底**,而 #92 的结构化摘要、§「发给 provider 的 function parameters 必须由校验面单向投影」(A13)、守门 111/113/115 全都建在这份契约上。**地基在类型层存在,在运行时不存在。**
- **方案**:① `MCPTool` 增字段(`effect_scopes`/`risk_level`/`result_budget`),默认值取**最保守档**并登记「未声明 ⇒ 按保守处理」的迁移期;② 90 个工具逐个补声明(可按族批量,但**每族首个人工核**);③ 把守门 111(`check-tool-contract-declared.mjs`)的判据从「有没有声明文件」升级为「声明是否被运行时消费」(与守门 121 的消费者判据同形)。
- **验收**:① `MCPTool(` 构造点必须全部带三新字段(grep 计数对账);② 把一个工具的 `effect_scopes` 改成错误值,审批门行为必须跟着变(**行为断言,不是文本断言** —— 承「判序要求只能用行为断言钉」);③ 存量按棘轮,先清偿再收紧(§12e 同型)。

---

**#100 🔴 P0 · 高危工具清单默认为空 ⇒ 「高危逐条审批」在默认部署下没有静态依据**

- **现况(E1)**:`_high_risk_tools_from_env()`(`agent_loop_v2.py:288-296`)只从 env `TOOL_APPROVAL_HIGH_RISK_TOOLS` 读取,**未配置时返回 `frozenset()`**;`TOOL_APPROVAL_ENABLED` 默认 true(`:277`)。即「审批开关是开的,但高危清单是空的」。
- **差距**:竞品的高危面是**内置**的(Trae 的 `deleteToolApproval`/`shellFileProtection` 场景规则、Codex 对 `.git`/`.codex`/`.agents` 强制只读、CodeBuddy 的删除进回收站 + 批量阈值默认 500 确认)。我方把它做成了一个「不配就等于没有」的开关。
- **方案**:给一份**内置默认高危集**(至少含:删除类、`run_command` 中含 `rm`/`DROP TABLE`/`git push --force`/`mkfs`、跨账号写、外部网络带凭据),env 只做**追加**不做**替换**;与 #99 的 `TOOL_RISK_LEVELS` 同源(清单从契约推导,不再手写名字表 —— 承 §4「豁免清单必然腐烂」)。
- **验收**:① 不设任何 env 时跑一次删除操作必须触发审批(阳性对照);② 默认集与 `TOOL_RISK_LEVELS` 的映射有一处唯一实现;③ 新增默认高危必须走票面评审(它改变行为,属 §24 确认项)。

---

**#101 🟡 P1 · 主循环轮次上限四个默认值,且没有任何尺子看它**

- **现况(E1)**:`AgentLoopV2` ctor `max_iterations=10`(`agent_loop_v2.py:1480`)、engine 线程默认 8(`agent_engine.py:2334,2551`)、settings 8(`core/config.py:64`)、CLI `maxIterations: 25`(`apps/cli/src/config/defaults.ts:17`)。而 doom-loop 那族参数已有 `scripts/check-doom-loop-parity.mjs` 钉死(P1 十个键两侧逐项等值),**轮次上限一个键都没进任何门**。
- **另**:`agent_loop.py` 的 V1 仍在生产被引用(3 处,见 §一.1),V3 #47 的「归一」剩这一口。
- **方案**:① 轮次上限并入现有 `check-doom-loop-parity` 的键集(同族参数、同一把尺子,不另立门);② 跨语言用同一份「上限语义」定义(默认值不一致必须显式声明理由,如 CLI 面向长任务所以更高),否则红;③ V1 出口壳:要么真归一(把 3 处引用改指 V2),要么在票面写清它承载什么 V2 不承载的东西。
- **验收**:① 改一侧默认值另一侧不跟着改,门必须红;② 报告里逐档列出实际生效值(不得只报「已对齐」)。

---

**#102 🟡 P1 · 子代理词汇双轨 + 状态词汇三域并存**

- **现况(E1)**:CLI persona 5 个(`researcher/coder/reviewer/planner/general`,`apps/cli/src/personas/contracts.ts`)与服务端 `dispatch_subagent` 的 5 个命名 agent(`code-reviewer/bug-fixer/feature-planner/test-writer/refactorer`,`mcp_server.py:8393`)**零映射**。状态词汇三套:`AGENT_TASK_STATUSES` 六态(`packages/types/src/agent-runtime.ts:1215`)、第二域四态(`:1234`)、`BgAgentStatus` 且拼 `cancelled`(`:1483`),文档自认「三域不同名无映射」。守门 151 已管住六态那一族并钉了「第二域不相交」,**另两族仍在**。
- **差距**:用户在 web 上派一个子代理,与在 CLI 里派,**看到的是两套名字、状态语义还不通**;Qoder Experts / CodeBuddy SubAgents / Codex `/subagents` 都是**一套词汇贯通**且可自定义角色(E3)。
- **方案**:① 角色别名表唯一源(放 `packages/types`,服务端与 CLI 都从它投影);② 三域状态各自保留但必须**登记域**并给出映射(不许「同一屏混排两种状态词」);③ 扩守门 151 到 persona 面(它已有「第二域不相交」的框架,天然支持加第三族)。
- **验收**:① 同一角色名在两端的 UI 显示逐字相同;② 摘掉别名表任一侧成员,门必须红;③ 扩族必须同批给消费方(与守门 77「新增角色档必须同笔有消费方」同规矩)。

---

**#103 🟡 P1 · MCP 凭据明文落文件,与本仓既有密钥纪律不成体系**

- **现况(E1)**:`apps/cli/src/tools/mcp-credentials.ts:25 getCredentialsPath()` 把 MCP OAuth 凭据写到文件路径;而 §5d 对模型密钥的纪律是「唯一权威来源在百度网盘同步目录、`.env` 由 gitignore 永不入库、输出恒脱敏」,§26 还专门管到 C 盘残留。MCP 凭据这一族**游离在纪律之外**。
- **竞品基线(E3)**:Qoder Cloud Agents 有 `vaults`;Trae/CodeBuddy 走云托管 OAuth。即竞品也把凭据当独立治理面。
- **方案**:① 优先接 OS 钥匙串(Windows Credential Manager),文件路径只作**非 win32 或钥匙串不可用时的显式降级**,降级时必须大声警告并在 `--capabilities` 里报出落点;② 纳入守门 67(凭据外泄)与 107(第三方来源台账)的射程;③ 与 §5e 的凭据健康巡检同批(它已有 `check-credential-health.mjs` 与 UNDELIVERED 机制)。
- **验收**:① 新建一条 MCP 授权后,盘上明文文件不存在或已被标记为降级(实测取);② 凭据内容不得出现在任何 stdout/日志行(阳性对照);③ 降级路径必须在文档写清并给退出码。

---

**#104 ⚪ P2 · 无可分布式追踪后端,跨四执行体拼不出一条链**

- **现况(E1)**:`core/trace_context.py`、`app/telemetry.py`、`core/tool_call_trace.py` 全自研;grep 未命中 OTel/LangFuse/Jaeger/Sentry 依赖。执行体有 web / api / ai-service / cli 四类(§「runtime-capability-disclosure」自己列的三类 + cli)。
- **竞品基线(E3)**:Codex 有 OTel 导出(含 chat、API 请求、SSE、**工具审批决策与结果**,prompt 默认脱敏);CodeBuddy 监控走 OTel(`cli/monitoring`)。
- **差距**:「为什么这一轮慢/为什么这次审批没弹」目前只能逐端翻日志;§5e 已把「到人」收成邮件单通道,但**内部链路**没有 trace。
- **方案**:先只做**一次对话轮的 trace id 贯通**(客户端生成 → api → ai-service → provider 调用记录 → SSE 帧回带),再谈 OTel 导出。**不做**全量 metrics 平台(超出对标必要范围)。
- **验收**:① 任一轮对话能拿 trace id 在日志里串起四段;② 脱敏:trace 属性不得含 prompt 原文与凭据(阳性对照,承 §5e「From 必须等于账号」那类「不满足就被拒」的实证习惯)。

---

### J 组 · 交付核验卫生(105)

---

**#105 🔴 P0 · 把「按代码判交付」做成常驻尺子(V3 §八 自留建议,至今未落地)**

- **现况(E1)**:`scripts/audit-benchmark-delivery.mjs` **不存在**(`ls` 实测)。V3 §八 原文:「本轮的核验脚本思路(用文件/符号级存在性而非台账勾选态判定交付)建议固化成一个 `scripts/audit-benchmark-delivery.mjs`,每轮对标时直接复用——**台账勾选态会滞后,以代码为准**」。
- **本轮实证它必要性**:V3 自己列的 #73(小程序无 AI 页)、#51(后台只有 sleep/echo)两条,今天都已被代码推翻;而 V3 文档正文与 PROJECT_PLAN 里**没有任何一处会喊「这条已过期」**。手工重验能抓到,是因为这轮恰好重读了它 —— 这不是防线,是运气。
- **方案**:① 输入 = 对标文档里的差距条目(每条带「判据锚」:文件路径 / 符号名 / 命令);② 逐条现读判 `已交付 / 仍存在 / 判不出`,**判不出必须点名原因**(文件不在面/符号改名/需运行时),不得计入「仍存在」也不得计入「已交付」;③ 输出即本轮 V4 §一.1 那种更正清单;④ 定级 **warn 且刻意不进提交链** —— 它判的是「文档与代码是否一致」,与本次提交内容无关,挂 blocking 就是恒红门(§12e);问责走 `pnpm check:benchmark-delivery`。
- **禁止**:`--update` 式把当前读数冻成基线(承 `check-plan-sha-resolvable.mjs` 那条「明令禁止」—— 那等于给腐烂发通行证)。
- **验收**:① 拿 V3 现文喂它,必须点名 #73/#51 两条为「已交付」(阳性对照,证明尺子真能读代码而不是读台账);② 构造一条假条目(指向不存在的符号),必须落「判不出」并点名原因,**不得落「仍存在」**(那是把「没看清」写成「有问题」);③ 反向:构造一条真存在的缺陷锚,必须落「仍存在」。

---

## 五、排期(续 V3 的 S1–S8)

排序原则沿用 V3:**先修「会误导的」,再修「不好用的」,最后做「拉开身位的」**。本轮另加一条本地原则:**先补尺子,再清存量** —— 否则 #93/#94/#96 这类「只在某端缺」的缺陷会继续在无人看守的格子里长。

| Sprint | 编号 | 交付形态 | 关键依赖与风险 |
| --- | --- | --- | --- |
| **S9 · 尺子先行(轻,但决定后四组能不能收敛)** | **105 → 97** | 交付核验尺子 + parity 门扩到六端(带端能力档案表) | 97 扩面必须同批改「枚举面 + 判据」两半(§4 教训);存量套棘轮,绝不造恒红门 |
| **S10 · 移动端可达性(重,用户可感最大落差)** | 93 → 94 → 95 | RN 主屏接线现成引擎 + 审批弹窗 + 共享屏二选一 | 95 的删/留决策要 §7 删除安全三问;**不得两份都留**;需真机取证,不接受只跑 typecheck |
| **S11 · 对话流保真** | 87 → 88 → 89 → 92 | 用户消息渲染 + 推理档位贯通 + 断线重连与状态条 + 工具参数结构化摘要 | 88 需先定 capability matrix 的置灰口径;92 依赖 99 的 effect scope,可先做「命令/删除」两族 |
| **S12 · 契约地基** | 99 → 100 → 101 → 102 | 契约字段落地 + 内置高危集 + 轮次上限进尺子 + 子代理词汇归一 | **100 改变默认行为**(属 §24 确认项,开工前需用户点头);99 是 92 的前置 |
| **S13 · 传输与计量收口** | 96 → 90 → 91 → 103 → 98 | 小程序走共享工厂传输 + usage 判别成员 + 双族登记 + MCP 凭据治理 + 桌面端口径对齐 | 96 动传输层,爆炸半径大,必须先有 90/91 的类型地基;**98 只对齐口径,不改架构选型** |
| **P2 后置** | 104 | trace id 贯通 | 不与上述抢资源 |

**并行冲突提示**(承 V3):① 每 Sprint 开工前跑 `git status` + `node scripts/check-task-claims.mjs`,认领用 `- [ ]（进行中@日期/持有者）`;② 涉及 SSE 契约必须过 `check-agent-event-parity.mjs`(本轮 97 扩面后是六端);③ 涉及 i18n 过 `check-i18n-keys` + `scan-dead-i18n-keys`,**且新增状态词必须五语言同批**(AGENTS §30);④ 跨端事件取证**先查网关层 `apps/api`**(V3 记录的 budget 帧两次翻案共同根因)。

---

## 六、验收与防回潮

**通用验收基线**(沿用 V2/V3 并加严三条):

1. 每项须有单测或 e2e;**命戒指变异验证**(刻意改坏行为确认测试会红)。
2. 涉及 UI 的须五语言 parity + 零死 key。
3. **本轮新增:「组件存在」与「组件上屏」是两件事。** 凡本轮交付的 UI 件,验收必须断言**生产面 importer ≥1 且排除测试面**;`connection-status.tsx` 那种「只有测试引用」不得算交付(本仓已为 64/70/81/115/138 记过同型)。
4. **本轮新增:跨端项必须逐端取证。** #93/#94 不接受「web 绿了」当结论,须真机/真小程序各留一张截图或一段 DOM/computed 值证据(§17 的 4 状态自验纪律)。
5. **本轮新增:改被审代码的写法必须同时改审它的正则。** #99/#100 会改 `MCPTool` 构造形态与审批清单来源,那些正则/判据在守门 111/113/67 里 —— 不同批改,就是把 blocking 升级签发给一台瞎掉的尺子(守门 117 的实录教训)。
6. 三端 `tsc` / `eslint` / `ruff` / `mypy` 零新增错误。

**建议新增的三把尺子**(落地时按 §「登记新门前先查编号占用」取号,编号一律以 `scripts/guardian-runner.mjs` 现值为准,**不得照本文数字派单**):

| 建议脚本 | 断言 | 防的是哪一条回潮 |
| --- | --- | --- |
| `scripts/audit-benchmark-delivery.mjs` | 对标条目按代码现读判三态(已交付/仍存在/**判不出**),判不出不得并入另两桶 | #105;以及 V3 #73/#51 这类「文档已过期而账面不知情」 |
| `scripts/check-stream-callback-coverage.mjs` | 各端 `streamChat` 调用点覆盖的回调集合必须 ⊇ 该端能力档案声明集;档案里每条须带 reason + until | #93 / #94 / #96;把「多端连通」从散文变成判据 |
| `scripts/check-tool-effect-declared.mjs`(或直接扩守门 111) | 运行时工具对象的 effect scope / risk level 非空,且**被审批路径真的读到**(行为断言) | #99 / #100 / #92 的地基 |

**孤儿件卫生**(承 V3 §七 规矩:「全仓零消费者的组件/hook,要么接要么删,不允许留」):

- V3 已列且本轮复验**仍在**的孤儿:CLI `apps/cli/src/tui/mode-indicator.tsx`(`apps/cli/tsconfig.json:19` 的 `include` **至今仍是 `["src/**/*.ts"]`,不含 `.tsx`** ⇒ 永不编译,这条 V3 断言成立);`scripts/ensure-web-out.mjs`(见 #98,本轮升级为「三处口径互斥」)。
- **本轮新增孤儿清单**(逐条 `git grep` 复验,生产面零挂载,仅测试或注释引用):
  - `apps/web/src/components/ai/progress-sections/connection-status.tsx` → 归 #89 接上
  - `apps/web/src/components/ai/model-load-bar.tsx`、`cloud-chat-ops-card.tsx`、`connector-auth-card.tsx`、`edit-resend-rollback-confirm.tsx`、`move-to-worktree-dialog.tsx`、`annotation-anchor-label.tsx`
  - `apps/web/src/components/chat/input-notice-banner.tsx`、`input-source-cards.tsx`、`writing-block.tsx`
  - ~~`apps/web/src/components/chat/voice-note.tsx`~~ —— **调研初稿点名后本人复量否证**:`git cat-file -e HEAD:<该路径>` 与 `git ls-files` 双双落空,它只躺在**工作树未跟踪面**(同目录另有已入库的 `voice-input.tsx`/`voice-record.tsx`/`voice-stream-speaker.tsx`/`voice-toolbar.tsx`)。未入库的文件不构成「已入库孤儿」,且归属未定 ⇒ 按 §12 **不动不删**,只登记事实。
  - `apps/web/src/components/ai/chat-search-bar.tsx`(其邻居注释自称「孤儿件已删除」而文件仍在 —— **注释与磁盘不符,登记为文档失真一条**)
  - `packages/shared/src/chat/render-model.ts` 的 `buildRenderModel`:全仓**仅 extension 一个消费方**(`apps/extension/entrypoints/sidepanel/components/MessageContent.tsx:737`),web 另写投影 ⇒ 共享抽象事实上只服务一端,归 #91 处理
  - `packages/app/src/features/chat/ChatScreen.tsx` → 归 #95
- 处置纪律:每条要么在本轮某个 Sprint 里接上,要么按 §7 删除安全三问走「先迁后删」;**不得只登记不处置**,那正是本清单要反对的状态。

---

## 七、与前三轮的关系

- **V1(1–14)** 解决「主链路有无」。**V2(15–36)** 解决「对话流元素粒度」。**V3(47–86)** 解决「能力是否真实存在并真的在跑」。
- **V4(87–105)** 解决 **「能力真的在跑,但用户看不见 / 只有一端看得见 / 看见了但不保真」**。三轮下来的失效型高度一致:**能力在类型层存在、在运行时缺席、在某一个端沉默。**
- **本轮主动更正三件事**(写下来是为了让下一个人不必重新猜):V3 #73 与 #51 已不成立;#47 应为「一套半」;`packages/app` 的 `ChatScreen` 是「导出在位、零消费方」而非「未导出」;web **有**队列与 Steer(D38 已✅),不是差距。
- **未闭环且如实登记**:① #100 会改变默认行为,按 §24 需用户拍板后才开工;② #98 的架构选型(V3 #72 已定「保留薄壳」)不在本轮改动范围,只对齐口径;③ 本文所有数字(30/7/23/90/16 等)均为 2026-09-28 现读,**派单前必须重跑命令取现值**,不得照抄。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
