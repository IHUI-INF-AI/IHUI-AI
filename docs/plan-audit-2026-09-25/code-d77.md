<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D77 对话流业务表单卡(邮件撰写 / 日历创建更新)—— 编码代理交付报告(2026-09-25)

## 0. 开工前单写者检查结论(决定本票形状的事实)

`git -c safe.directory=* status --porcelain -- <目标文件>` 实测:

| 文件 | 状态 | 后果 |
| --- | --- | --- |
| `apps/ai-service/app/core/sse_contract.py` | **脏**(并行 D49② 正在往 `SSE_EVENT_CONTRACTS` 加 `tool-result.durationMs`) | **只读,未写** |
| `apps/ai-service/app/routers/llm.py` | **脏**(同一代理) | **只读,未写** |
| `apps/web/src/hooks/use-chat/stream-handlers.ts` | **脏**(D49② 抽 `resolveToolDurationMs`) | **未写**,改接我 `git grep` 定位到的另一处帧分发点 `send-message.ts` |
| `packages/shared/src/sse/contract.ts` / `packages/api-client/src/client.ts` / `apps/web/src/components/ai/business-form-card.tsx` | 干净 | 已写(卡片**未改**,见 §3) |

⇒ **任务目标 2(ai-service 生产者)结构上做不了**:两张允许文件全脏。连带后果 = `check-agent-event-parity`
报"契约漂移"红(见 §5),以及 `form_response` 的上行落点(路由)本轮无法建立。这不是遗漏,是被脏文件挡住,
必须排下一轮(§7)。

## 1. 契约层 —— `packages/shared/src/sse/contract.ts`

- `:77-78` `SSE_EVENTS.FORM_REQUEST = 'form_request'` / `FORM_RESPONSE = 'form_response'`(命名沿用
  `plan_updated`/`terminal_end`/`injection_applied` 同族 snake_case,**未另立一套**)
- `:305` `type: 'form_request'` 成员:`requestId` / `sessionId?` / `kind` / `fields` / `actions` / `messageId?`
- `:322` `type: 'form_response'` 成员:`requestId` / `kind` / `action` / `values?` / `rejectReason?` / `messageId?`
- 方向口径写在文件头注释:`form_request` 下行、`form_response` **上行**(全契约唯一一条上行帧,
  与 `tool-delegate → postToolResult` 同族)
- **形状不重定义**:`kind/fields/actions` 直接 `import type` 判定层
  `packages/shared/src/chat/business-forms.ts`(该文件是既有资产、本轮干净、**未改**),与
  `businessFormRequest(kind)` 逐字段等值 —— 否则协议与渲染层各长一份字段表

测试:`packages/shared/src/sse/__tests__/contract.test.ts`(改计数 26→28、补
`PAYLOAD_TYPE_BY_KEY` 两个键、新增一条"actions 成对 + 两侧形状互斥"用例)
→ `node ./node_modules/vitest/vitest.mjs run src/sse/__tests__/contract.test.ts`
末行:**`Tests  13 passed (13)`**

## 2. 客户端层 —— `packages/api-client/src/client.ts`

- `:1000` `onFormRequest?: (event: FormRequestEvent) => void`(照 `onInjectionApplied` 写法)
- `:1336` `interface FormRequestEvent` / `:1359` `interface FormResponseEvent`(本包不依赖
  `@ihui/shared`,沿用 client.ts 内"wire 镜像 + 注释指回权威"的既有做法)
- `:2019` `hasFormRequest` 开关 → `:2917` `tryParseFormRequest`:缺 `requestId`/`kind`、`fields` 空、
  **`actions` 不成对(缺 approve 或缺 reject)一律不发回调** —— 不给用户一张无法应答的表单
- `:3037` `routeLineByType` 加 `case 'form_request'`;`dispatchTryParse` 与 fallback 全量链各接一处
- `:3311` `buildFormResponseEvent()` 纯函数 = **成对判据的唯一实现处**:approve 带 `values` 不写
  `rejectReason`;reject 带 `rejectReason`、**整字段省略 `values`**(不是空对象/空串)
- `:3345` `postFormResponse(sessionId, event)`:`POST /llm/complete/stream/{sessionId}/form-response`,
  body 用 ai-service 侧 snake_case(`request_id`/`reject_reason`),失败必抛(照 `postToolResult` 的
  2026-08-06 教训)
- 顺手收口:`:3283` 抽出 `aiServiceBaseUrl()`,`postToolResult` 与 `postFormResponse` **共用**同一处
  ai-service URL 解析(原 6 行内联逻辑逐字搬移,行为不变,避免第二份默认值)
- `packages/api-client/src/index.ts:32-33` re-export 两个上行出口(**清单外文件,见 §8**)

`pnpm --filter @ihui/api-client build` 末行:**`$ rimraf dist && tsc -p tsconfig.json`**(无错误输出,exit 0)

## 3. 渲染宿主(装车点)—— web

`git grep` 定位结果:消息级帧的**注册点**是 `apps/web/src/hooks/use-chat/send-message.ts`
(全部 `onXxx` 回调表在 `:513-1005`),**渲染宿主**是
`apps/web/src/components/chat/message-list/MessageList.tsx` 的 `renderItems.map`(`:387` 渲染 `MessageItem`)。

- `apps/web/src/hooks/use-chat/send-message.ts:913-925` `onFormRequest` → 写 store;未知 `kind` 丢弃
- `apps/web/src/stores/business-forms.ts`(新建)`useBusinessFormStore`:按 messageId 存请求,
  `appendFormRequest` 幂等(断线回放不重复出卡)、`markFormResponse` 记 sent/failed
- `apps/web/src/components/ai/business-form-section.tsx`(新建)`:68 BusinessFormSection` →
  渲染既有 `BusinessFormCard`(`kind` + `requestId`),`:88 submitFormResponse()` →
  `buildFormResponseEvent()` → `postFormResponse()`;拒绝理由输入位在 host 侧
  (`data-testid="business-form-reject-reason"`),**卡片 props 形态未改**(任务书允许"仅必要时",本轮不必要)
- `apps/web/src/components/chat/message-list/MessageList.tsx:414` `<BusinessFormSection messageId={m.id} />`
  作为 `MessageItem` 的**兄弟节点** —— 未触碰 `MessageItem.tsx`(禁改清单)
- 消费点自证:`git grep -l "BusinessFormCard" HEAD` 此前**只命中它自己的测试**;现工作树命中
  `business-form-section.tsx`,而 `business-form-section` 命中 `MessageList.tsx`(渲染宿主)

消费用例 `apps/web/src/components/ai/__tests__/business-form-mount.test.tsx`(6 例,含
"点批准走 form_response" / "点拒绝同样走且带拒绝原因且 body 无 values" / 无 sessionId 不静默吞)
末行:**`Tests  6 passed (6)`**

## 4. 验证输出(原文)

```
pnpm --filter @ihui/shared typecheck      → $ tsc --noEmit                       (exit 0)
pnpm --filter @ihui/api-client build      → $ rimraf dist && tsc -p tsconfig.json (exit 0)
pnpm --filter @ihui/api typecheck         → $ tsc --noEmit                        (exit 0)
pnpm --filter @ihui/web typecheck         → Exit status 2 —— 错误全在他人脏文件:
   15 progress-sections/__tests__/tool-category.test.ts   6 chat/message-input.tsx
    3 __tests__/tool-call-summary-category.test.tsx       2 config/desktop-feed-payload.ts
    2 chat/voice-note.tsx   2 app/(路由组)  1 hooks/use-prompt-drafts.ts
    1 hooks/__tests__/use-prompt-drafts.test.tsx          1 progress-sections/tool-category.ts
   归属命令:`pnpm --filter @ihui/web typecheck | grep -E "business-form|MessageList\.tsx|use-chat/send-message"`
   → 零命中 ⇒ **我的文件 0 错**
node scripts/check-agent-event-parity.mjs → 见 §5(仅因 Python 侧被脏文件挡住而红)
node scripts/check-sse-dispatch-parity.mjs →
   ⚠️  端 cli 命中 13 已超过 baseline 12,请把 baseline 上调(ratchet 随增长维护)
   ✅ SSE 端内 dispatch 覆盖守门通过(5 端,帧 27 个)
node scripts/check-sse-parser-parity.mjs  → ✅ 契约 26 帧;api-client 23 / sse-parse 21(基线 21)
```

**门 90 / 63 的绿是"HEAD 口径"的绿**:两门都按提交树取
材(`git grep HEAD` / `git show HEAD:`),我的改动未提交 ⇒ 它们此刻**看不见** `onFormRequest`。
主代理提交时它们切 `--staged` 读索引,**必然要求 §6 的台账同票落地**,否则红。

## 5. 唯一红门与它的解(必须由主代理做)

```
阻断 commit:
  - 契约漂移: 事件 "form_request" 仅存在于 TS 侧契约(packages/shared/src/sse/contract.ts), Python 侧(sse_contract.py)缺失
  - 契约漂移: 事件 "form_response" 仅存在于 TS 侧契约(packages/shared/src/sse/contract.ts), Python 侧(sse_contract.py)缺失
```
(同批另两条 `step_done` / `trace` 是**警告**,他人生产者未消费,不在本票范围。)

修法(等 `sse_contract.py` 干净后照抄,勿放宽判据 —— 我没动任何守门):
```python
# apps/ai-service/app/core/sse_contract.py  SSE_EVENTS frozenset 追加
        "form_request",
        "form_response",
# SSE_EVENT_CONTRACTS 追加(与 contract.ts 字段逐字同)
    SSEEventContract("form_request", ("requestId", "sessionId", "kind", "fields", "actions")),
    SSEEventContract("form_response", ("requestId", "kind", "action", "values", "rejectReason")),
```

## 6. 需要登记的台账条目(**本轮未提交、未改台账**)

`scripts/data/sse-dispatch-coverage.json`(门 90,"代码与台账同一枚提交"):
- 新增分组 `groups["no-business-form-ui"] = "该端消息流内没有业务表单卡(邮件撰写 / 日历创建·更新)渲染位;web 侧装车点为 components/ai/business-form-section.tsx ← MessageList.tsx:414。补齐见 PROJECT_PLAN D77 / D103。"`
- `missing.extension["onFormRequest"] = "no-business-form-ui"`
- `missing["miniapp-taro"]["onFormRequest"] = "no-business-form-ui"`
- `missing["mobile-rn"]["onFormRequest"] = "no-business-form-ui"`
- `missing.cli["onFormRequest"] = "no-business-form-ui"`
- `baseline.web` 27 → **28**(web 新增一帧命中,不上调会出"已超过 baseline"提示);
  顺带 `baseline.cli` 12 → 13(**他人**已造成的既有警告,见 §4 门 90 末行,不是本票引入)

`scripts/data/sse-parser-coverage.json`(门 63):`form_request` 被 api-client 解析而
`packages/shared/src/utils/sse-parse.ts` 未解析 ⇒ 二选一:
- 登记 `webOnly` 追加 `{ "event": "form_request", "reason": "表单卡当前只有 web 有渲染位(BusinessFormSection),小程序侧未接 BusinessFormCard;接线见 D77 下一轮" }`,或
- 真去 `sse-parse.ts` 补解析并上调 `parseCoverageBaseline`(该文件干净,但不在本票允许清单内 ⇒ 未动)

`form_response` 刻意**没有**在 client.ts 出现 `onFormResponse` 标识符:它是上行帧,
五端都不会"监听"它,登记成 missing 只会变成门 90 注释里点名的"掩盖真相的墓志铭";
门 90 的帧清单是从 client.ts 的 `onXxx` 抽的 ⇒ 上行出口用函数形态
(`buildFormResponseEvent` + `postFormResponse`)表达,不新增待登记帧。

## 7. 未做完(按依赖顺序,不要在报告里当已完成)

1. **ai-service 生产者 + 上行路由**:被脏文件挡住(`sse_contract.py` / `llm.py`)。下一轮需要
   ① llm.py 在合适触发点 `yield` 一条 `form_request`(至少 `kind:"email"`,字段名与 contract.ts
   `:305` 逐字一致);② `POST /llm/complete/stream/{session_id}/form-response` 路由(接收
   `request_id/kind/action/values/reject_reason`)。二者缺一,本链在真机上**无法端到端验证**
   —— 前端侧已按契约实现完毕,`postFormResponse` 现在打过去会 404。
2. **api-client 解析层独立单测未写**(调用预算耗尽)。落点建议
   `packages/api-client/tests/form-request-frame.test.ts`,模板 = 同目录
   `stream-chat-injection-retry.test.ts`;至少要钉:畸形 `actions`(只 approve)不发回调、
   正常帧发出 `requestId/kind/fields/actions/sessionId`。
3. **续流路径未接**:`apps/web/src/hooks/use-chat/send-answer.ts` 是第二处帧分发表(也注册全套
   `onXxx`),本轮未加 `onFormRequest` ⇒ 续流中到达的 form_request 会被丢。属"邻居文件",停在报告里。
4. **其余 4 端未渲染**(§9 多端连通),已按 §6 显式登记为缺口而非静默。
5. **未提交**(批次规则:只写代码不碰 git)。新文件已 `node scripts/watermark.mjs inject` 注入水印。

## 8. 允许清单外的改动(逐条,均已在正文说明)

- `packages/api-client/src/index.ts`(+2 行 re-export):不改就没有消费出口,`postFormResponse` 将成死代码
- 新建 `apps/web/src/stores/business-forms.ts`、`apps/web/src/components/ai/business-form-section.tsx`、
  `apps/web/src/components/ai/__tests__/business-form-mount.test.tsx`
- 改 `packages/shared/src/sse/__tests__/contract.test.ts`(任务书允许"新增测试";此处是**必要修改**:
  该文件有 `Record<keyof typeof SSE_EVENTS, SSEEventName>` 编译期穷尽性检查,新增事件不补即 tsc 红)
- **未改**:`apps/web/src/components/ai/business-form-card.tsx`(卡片一行未动)、任何 i18n 词包、
  `MessageItem.tsx`、任何守门脚本/台账 JSON

## 9. 待补键(五语对照,请主代理集中 apply)

现在 host 的拒绝理由 Label 临时复用既有键 `ai.pane.inputNotices.queue.reasonTitle`(=「原因」,
五语齐,不直出键名),补键后把 `business-form-section.tsx` 的 `t('inputNotices.queue.reasonTitle')`
换成 `tForm('fields.rejectReason')`:

| 键 | zh-CN | zh-TW | en | ja | ko |
| --- | --- | --- | --- | --- | --- |
| `ai.pane.businessForms.fields.rejectReason` | 拒绝原因 | 拒絕原因 | Rejection reason | 拒否理由 | 거절 사유 |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
