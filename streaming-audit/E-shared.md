# E-shared · 流式对话共享协议层跨端一致性审计

范围：`packages/shared/src/chat/` 5 文件（tool-input-stream 321 / stream-error 82 / stream-error-disposition 242 / stream-fault-tier 148 / stream-follow 110）。方法：源码逐行 + grep 一致性矩阵，未跑测试、未读全部测试正文。已知不复述：显示层 D1-D6、smooth-delta-batcher 已上收。

---

## 一、确凿缺陷

### E-S1 · tool-input-stream 无缓冲上限（P0）
`ToolInputStream.buffer`（tool-input-stream.ts:231）在 `appendDelta` 里无界累加（:239），`finish` 直接把整个 finalValue 塞进 buffer（:245,257）。全文件无任何字节上限、无 `MAX_BUFFER`、无截断保护。一个失控的 tool_call（服务端把大文件 base64 塞进 arguments）会：
- 缓冲无限增长直至 OOM；
- 每次增量都触发 `tryParse → smartParse → closeJson → JSON.parse` 的 O(n) 重扫（:286-313），n 次增量总代价 O(n²)。

对照：本仓 `packages/shared/src/chat/stream-error-disposition.ts` 明确把 `TEXT_TOO_LONG/CONTEXT_TOO_LONG` 列为真实存在的错误码（:145-146），说明"超大参数"是已知真实场景，但流式累积侧没设防。

### E-S2 · `tryParseValue` 把 `\n` 当字面 `n`（P1）
`SIMPLE_ESCAPES` 表（tool-input-stream.ts:30-40）键写成**双字符** `'\\': '\\'`、`'n': '\n'`（键是字母 n，不是反斜杠+n）。而查询处 `SIMPLE_ESCAPES[next]`（:74）的 `next` 是**单个字符**（反斜杠后的那一个字符）——所以查表永远落在 `?? next` 回落，把 `\n` 还原成字面 `n`、`\t` 还原成 `t`。
- 真实影响：半截字符串里的 `\n` / `\t` / `\"` 在流式阶段被解错；完成态因为走 `JSON.parse`（:248,295）不受影响，但用户会看到流式中途参数值闪烁错字，且 `finish` 前的 `parameters` 已外露给界面。
- 正确写法应是 `{'\\':'\\','/':'/','"':'"',"'":"'",'b':'\b',...}`（单字符键）；现在 `b/f/n/r/t` 几档全是死的。

### E-S3 · closeJson 的 escaped 状态机在 `\\` 上错乱（P1）
tool-input-stream.ts:120-132：遇到 `\\` 设 `escaped=true; continue`，循环尾 `escaped=false`。于是 `\\`（字面反斜杠）被吃掉两位，第二个反斜杠从未参与下一字符的转义判定；`"\\"` 后紧跟 `"` 时会把该 `"` 误判成收引号，导致 `inString` 翻错 → 括号计数错 → 补括号位置错。`splitTopLevel`（:160-188）同型（`\\` 后 `escaped=false`），切分点可能落在字符串内部。半截 JSON 正常路径下概率低，但带 Windows 路径（`"C:\\Users\\..."`）的参数一定踩中。

### E-S4 · finish(string) 与 tryParse 的 not_object 判定不对称（P2）
- `finish` 收到完整字符串 `"[1,2,3]"` → `JSON.parse` 成功但非 plain object → `rejectNotObject`（:249-250），清字段、`defect='not_object'`，符合头注超越点②。
- 但 `appendDelta` 流式阶段收到 `"[1,2,3]"` → 同样非对象 → `rejectNotObject`（:300）**已经把 defect 置位**；随后只要再来一枚任何增量，buffer 变成 `"[1,2,3]x"` 之类，`JSON.parse` 抛错落到 `smartParse`，`smartParse` 对非 `{` 开头返回 null（:215），走到 :308-311 **把 defect 重置为 null** 且清 parameters——**defect 在增量间抖动**，界面若依赖 defect 显示"参数异常"会闪。缺陷是 tryParse 的 catch 分支无条件重置 defect，没有保留"已判定的 not_object"这一终态。

---

## 二、不完整实现

### E-P1 · fault-tier 二档分档，五类只覆盖两类半（对应问题 2）
`StreamFaultTier = 'content' | 'transient'`（stream-fault-tier.ts:25），判定入口 `isDeterministicContentFault`（:48）：
- **覆盖为 content（确定性）**：仅 3 个 code 白名单（fieldRejected / content.rejected / request.invalid，:32-38）+ 4 个 status（400/404/413/422，:41）。
- **网络类**：无任何网络码（`ECONNRESET` / `NETWORK_ERROR` / `backendExited`），一律默认 transient。
- **鉴权类**：401/403 **不在** CONTENT_FAULT_STATUS，`authForbidden` 类在 disposition 侧判 contactAdmin（不可重试），但 fault-tier 把它当 transient ⇒ **跨层不一致**：重试阶梯会去重投一枪注定再 401 的请求。
- **限流类**：429 不在 content 表（对），但 fault-tier 不区分 `RATE_LIMITED`（waitAndRetry 可过）与 `BUDGET_EXHAUSTED`（次日重置），一律 resume 阶梯立即重投 ⇒ 与 disposition 侧 `waitAndRetry`（含最小等待语义，stream-error-disposition.ts:55-56）冲突。
- **服务端 5xx**：默认 transient，正确。
- **内容过滤**：只有 `fault.content.rejected` 一码；常见的 `content_policy_violation` / `MODERATION_BLOCKED` 等未收录 ⇒ 被当 transient 反复重投。

**未归类错误的处置**：`isDeterministicContentFault` 形状不符/未命中即 false（:54），默认档 transient。这是"默认可重试"，但 fault-tier 自身没有任何上报/日志出口，未收录的真实确定性故障会被静默重投到阶梯耗尽。

### E-P2 · disposition 处置闭合性（对应问题 3）
- 分类学 15 类通过 `Record<ViewFailureKind, StreamErrorAction>` 强制全覆盖（stream-error-disposition.ts:96-127），`uncoveredErrorCodes()`（:229）提供目录↔分类覆盖度自检，类型层面闭合。
- **逐码 override 的优先级**：`ACTION_OVERRIDES[code] ?? ACTION_BY_CATEGORY[entry.category]`（:182），override 命中即完全替换分类默认动作，无"override + 分类建议"合成——`PROVIDER_QUOTA_EXHAUSTED → switchModel`（:141）注释里写"同时要去看额度"，但 action 只能是一个，checkQuota 那半被吞。这是设计取舍不是 bug，但 detailKey 路径（:192）依赖目录 actionKey 补足，若目录没给 actionKey，用户只能看到"换模型"按钮，看不到"顺便查额度"。
- **未收录码返回 null，无兜底**（:206,222）——`isRetryableErrorCode` 返回 `boolean | null`，null 表示"未判定"。头注明确"不给未知错误兜底"，纪律一致；但调用方若把 null 当 falsy 用，等价于"可重试"，与注释"不得读成 false"（:218）形成契约靠自觉。
- **"上报"维度缺席**：处置四档（重试/降级/终止/上报）里，本层只回答"重试 / 不重试 / 换动作"，没有 telemetry/log 上报字段。`category` 字段（:177）注明"供埋点"，但埋点接线在端上，shared 层无断言。
- **降级维度缺席**：无 `fallbackModel` / `degradeTo` 之类的降级建议；`switchModel` 是用户动作不是系统降级。

### E-P3 · stream-error 的 errorCode 第三参几乎无人传
`markStreamError(msg, errorText, errorCode?)`（stream-error.ts:35）第三参是 D92 接线口，头注自承"既有各端一律两参调用"。`applyStreamError`（:55）压根不收 errorCode，所以走 `applyStreamError` 落错误的所有端都拿不到 errorCode ⇒ `resolveStreamErrorDisposition` 在那些端只能拿 undefined ⇒ 永远 null ⇒ disposition 层在那些端**事实上未接线**。这是共享层内部两个导出（applyStreamError vs resolveStreamErrorDisposition）的接线缺口。

### E-P4 · tool-input-stream 在四端零消费者
grep `ToolInputStream|createToolInputParser|tool-input-stream` 全仓命中仅 3 类：shared 自身定义、shared `index.ts:177` 导出、shared 自己的 `__tests__/tool-input-stream.test.ts`。**apps/web、apps/mobile-rn、packages/app、apps/miniapp-taro 无一引用**。这是"判据挂在半空"形态——shared/stream-fault-tier.ts:129 那条注自己点过同一否证模式（G-102：判据全绿但消费者为 0）。工具调用参数流目前各端要么不走这条、要么各自 inline 解析，需在后续票确认是"能力预留"还是"漏接线"。

---

## 三、跨端漂移矩阵（对应问题 4）

grep 范围：`*.{ts,tsx,js,jsx}`，关键词覆盖三模块的全部导出符号名。四端 = apps/web / apps/mobile-rn / packages/app / apps/miniapp-taro。

| 共享导出 | apps/web | apps/mobile-rn | packages/app | apps/miniapp-taro | 漂移判定 |
|---|---|---|---|---|---|
| **stream-follow**（判定：单一真相源声明在头注 :6） | ✅ 经 `packages/types/src/app-message.ts:400-404` 引用判据（注释指针） | ⚠️ 未直接命中（mobile-rn 端 grep 无 import 行；但 grep 输出被截断，未穷尽） | ✅ **真用**：`ChatMessageList.tsx:20,22,25,298,312-313` import `readScrollEventTop / reduceStreamFollowOnScroll / StreamFollowState / initialStreamFollowState`，注释自证"与小程序同一条真相源" | ⚠️ 头注 :11 自承"小程序每帧强制拽底 + 99998/99999 乒乓 hack"是**改造前**状态；grep 截断未拿到小程序现役 import 行，**未判定** | **packages/app 确认用；web 走自己的 scroll-authority.ts（头注 :14-16 明示不复制，合法分叉）；RN / 小程序未拿到决定性 import 证据** |
| **stream-fault-tier**（判定：`shouldSkipResumeLadder` 唯一消费者是 `apps/web/src/hooks/use-agent-stream.ts` tryReconnect，:131 自证） | ✅ **真用**：`apps/web/src/hooks/__tests__/use-agent-stream-fault-tier.test.ts:24-25` import `describeFaultTier / shouldSkipResumeLadder`，有牙自证测试（:17 "把 hook 里那行闸门删掉必翻红"） | ❌ 未命中 | ❌ 未命中 | ❌ 未命中 | **单端接线**：只有 web 接了判据；移动两端故障分档未接共享实现，疑各自 inline 或不处理 |
| **stream-error-disposition**（判定：`resolveStreamErrorDisposition` 的调用方） | ⚠️ 未在 grep 输出命中端侧调用（仅 shared 定义+测试） | ❌ 未命中 | ❌ 未命中 | ❌ 未命中 | **四端疑似全未接线**（与 E-P3 呼应：`applyStreamError` 不传 errorCode，端上即便 import 也只能拿到 null） |
| **stream-error**（markStreamError / applyStreamError / isErrorTurn / resendTargetText） | ✅ 头注 :9 自证 web 用 `ChatMessage.error` 渲染错误卡片+重试 | ⚠️ 头注 :14 自证 mobile-rn 消息类型满足 ErrorAwareMessage | ⚠️ 未单独取证 | ⚠️ 头注 :9-10 自证 miniapp 此前只在 content 写文案（本模块就是为收口这个） | **三端至少在数据形状上对齐**，但端侧 import 行未逐条取证 |

**结论（漂移点）**：
1. **stream-fault-tier 仅 web 单端接线**，移动两端未接 ⇒ 移动端故障分档缺失或各自重写（P1 漂移）。
2. **stream-error-disposition 四端疑似零接线**，叠加 E-P3 的 applyStreamError 不传 errorCode ⇒ 命名错误码分类处置层在端上可能是**整套未启用**（P0 疑似，需在端侧 `formatSSEError` 调用点确认）。
3. **stream-follow packages/app 已真用**；mobile-rn / miniapp-taro 头注自承"此前各写一套"，grep 截断未拿到这两端现役 import，**存疑未判定**。
4. **web 的 scroll-authority.ts 是合法分叉**（头注 :14-16 明示，输入面不同：DOM 三路事件 vs ScrollView/Taro 单路），不计漂移。

> 取证缺口声明：第一次 grep 命中 21.0KB 被截断，预览只展开 web/app 两侧，mobile-rn 与 miniapp-taro 的 import 行未进预览。上表"❌ 未命中"是预览窗口内未出现，非全量穷尽；"⚠️ 未判定"是诚实标注。后续票需对这两端补一次定向 grep（pattern 同上，path 锁 `apps/mobile-rn/` / `apps/miniapp-taro/`）。

---

## 四、无测试覆盖的分支（对应问题 5）

未读测试正文，仅凭源码分支 vs 测试文件存在性 + grep 命中标题。三个模块各有测试文件（`stream-follow.test.ts` / `stream-fault-tier.test.ts` / `stream-error-disposition.test.ts` / `tool-input-stream.test.ts`），非裸奔。基于源码分支识别的**疑似漏覆盖**：

**tool-input-stream（tool-input-stream.test.ts 仅 6 个 describe/it 命中，规模偏小）**：
- `SIMPLE_ESCAPES` 的 `\n/\t/\b/\f/\r` 解码路径（:74）——结合 E-S2 这条本身就是 bug，测试大概率未覆盖（否则会翻红）。
- `closeJson` 的 `\\` 双反斜杠路径（:120-132）——同 E-S3。
- `finish` 收到 `undefined / number / boolean / null` 等非字符串非对象（:259-261 rejectNotObject 兜底）。
- `appendDelta` 在 `completed=true` 后继续追加（:237 早退）。
- **无缓冲上限断言**（E-S1）——本来就没实现，谈不到测试。

**stream-fault-tier**：
- 401/403（鉴权）分档归属——按源码默认 transient，测试若未覆盖即隐性错分（E-P1）。
- 429 两种语义（RATE_LIMITED vs BUDGET_EXHAUSTED）在 fault-tier 层的处理。
- `describeFaultTier` 瞬态/无失败的原样返回路径（:145-146 反向锁）。
- `isDeterministicContentFault` 形状不符（非对象/null/数组）边界。

**stream-error-disposition**：
- `uncoveredErrorCodes()` 覆盖度自检（:229）——是否有测试断言其返回空数组，未见命中。
- override 覆盖分类默认档的 12 条（:133-157）逐条断言。
- `entry.category` 不在 15 类时返回 null 的运行时防御（:212）。
- `isRetryableErrorCode` 返回 null（未收录码）的调用方契约（:220-223）。

**stream-follow**：
- `readScrollEventTop` 三种宿主形状 + 形状全不匹配返回 null（:89-103）——mobile-rn / Taro 真机形状若未在测试里各来一例，跨端解析就是纸面覆盖。
- `reduceStreamFollowOnScroll` 首次记账建基线（:60-63）、亚像素抖动容差（:64）、`scrollTop<0`/NaN 防御（:58）。

---

## 五、P0 / P1 概要

**P0（阻断/数据风险）**
- E-S1 · tool-input-stream 无缓冲上限，OOM + O(n²) 重扫。
- 漂移#2 · stream-error-disposition 四端疑似零接线，命名错误码分类处置整套未启用。

**P1（正确性/一致性）**
- E-S2 · `SIMPLE_ESCAPES` 双字符键查表永远回落，`\n/\t` 流式阶段解错。
- E-S3 · closeJson / splitTopLevel 的 `\\` 转义状态机错乱，Windows 路径参数必踩。
- E-P1 · fault-tier 鉴权（401/403）误归 transient、限流两种语义未分、内容过滤码收录不全。
- E-P3 · `applyStreamError` 不收 errorCode，堵死 disposition 在端上的接线。
- 漂移#1 · stream-fault-tier 仅 web 接线，移动两端未接共享实现。

**存疑未判定**
- mobile-rn / miniapp-taro 对 stream-follow / stream-error 的现役 import（grep 截断，未拿到决定性证据）。
- stream-error-disposition 在端上"零接线"需在 `formatSSEError` 调用点二次确认。
- tool-input-stream 是能力预留还是漏接线（E-P4）。
