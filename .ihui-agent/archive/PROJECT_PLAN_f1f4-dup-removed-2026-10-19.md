<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->


# F1/F4 重复登记行摘除留痕(2026-10-19,goal-rn-miniapp)

摘除 6 行:它们与同主键的当前状态行并存(3 组 F1 同主键两态、3 组 F4 重复待办),
经 `git-sync-converge` 的活文档行 union 从并发旧基线合并带回。保留行 = 同主键下已完成或正文最新的一份。
64/68 两族的 w1-permax 认领标记已原样转移到保留行行尾,租约不因摘行而消失。
删除凭据 = 本归档(门 71 允许情形 a);逐字原文如下。

## 被摘行原文(逐字)

1.

```text
- [ ] 85. 离线/边缘优先降级(依赖 72;本地向量索引 + `ollama`/`lmstudio`/`llama_cpp` 三路 provider 已在适配表里)
```

2.

```text
- [ ]G-425 截断可见提示：先只做可见提示、不新增跨端 SSE 字段、不自动续写。已验证的事实（三面现读）：① 整条链路不携带 finish/stop reason（`apps/cli/src/commands/agent.ts`、`packages/api-client/src/endpoints/chat.ts`、`packages/shared/src/sse-parse.ts` 均无；provider 侧只有 `gemini_provider.py:146-170` 解 `finishReason` 且只用于 SAFETY）；② 既有事件表（`packages/shared/src/sse/contract.ts` SSE_EVENTS）里 `FALLBACK`/`ERROR`/`COMPACTION` 各有专门语义，**没有**可承载"截断"的通用提示通道 —— 所以"不新增字段"的口径下，正解是**复用一个既有事件类型**（候选：`ERROR` 带可区分的 code，或 `COMPACTION` 同族的轻提示位），由 ai-service 在流结束处判 `finish_reason === 'length'` 时发出，web/CLI 渲染一行"已被长度上限截断"。开工第一步：定复用哪个既有事件 + 在 `apps/ai-service` 找到流结束的判定位（LiteLLM/openai 兼容层的末块 `choices[0].finish_reason`），契约面与渲染面同笔。**禁止**为省事新增 SSE 事件名 —— 那正是拍板否决的"新增跨端字段"。
```

3.

```text
- [ ] 64. AI 消息可编辑 + 消息级 pin/书签(共用 59 的 sibling 存储)（进行中@2026-10-18/w1-permax:大型票·消费面接线）
```

4.

```text
- [ ]G-175 承 G-427 第②步:allowed-tools 要不要真成闸门 —— 等一周影子台账裁决(等环境条件:2026-10-17 之后跑 ihui skills shadow-report 取实据;台账在用户状态根 skill-allowed-tools-shadow.jsonl,无 surface 行时该命令判 UNDETERMINED 且 RC=2 ⇒ 不得把"零命中"读成"没有冲突")。第①步(只记不挡、默认开但无声明即零写盘、hub 分支与显式单点调用两处未覆盖如实登记)已由 00f2cf4d4b02968ce097d506d32a9d2640905bc2 落地并翻勾;本行只管"要不要开"与开在哪:权限层哪一道闸、顺序在 --tools/--disallowed-tools 之前还是之后、那两处未覆盖是否补。**禁止样本到位前提前翻判据,也禁止为省事删声明字段。**（2026-10-10 本席摘认领牌:不再持有,免 72h 租约超期把门 109 变恒红） 〔改号(2026-10-14):原G-1111922〕 〔副本正文并入·承载整段:承 G-427 第②步:allowed-tools 要不要真成闸门 —— 等一周影子台账裁决(等环境条件:2026-10-17 之后跑 ihui skills shadow-report 取实据;台账在用户状态根 skill-allowed-tools-shadow.jsonl,无 surface 行时该命令判 UNDETERMINED 且 RC=2 ⇒ 不得把"零命中"读成"没有冲突")。第①步(只记不挡、默认开但无声明即零写盘、hub 分支与显式单点调用两处未覆盖如实登记)已由 00f2cf4d4b02968ce097d506d32a9d2640905bc2 落地并翻勾;本行只管"要不要开"与开在哪:权限层哪一道闸、顺序在 --tools/--disallowed-tools 之前还是之后、那两处未覆盖是否补。**禁止样本到位前提前翻判据,也禁止为省事删声明字段。**（2026-10-10 本席摘认领牌:不再持有,免 72h 租约超期把门 109 变恒红） 〔副本正文并入·承载整段:承 G-427 第②步:allowed-tools 要不要真成闸门 —— 等一周影子台账裁决(等环境条件:2026-10-17 之后跑 ihui skills shadow-report 取实据;台账在用户状态根 skill-allowed-tools-shadow.jsonl,无 surface 行时该命令判 UNDETERMINED 且 RC=2 ⇒ 不得把"零命中"读成"没有冲突")。第①步(只记不挡、默认开但无声明即零写盘、hub 分支与显式单点调用两处未覆盖如实登记)已由 00f2cf4d4b02968ce097d506d32a9d2640905bc2 落地并翻勾;本行只管"要不要开"与开在哪:权限层哪一道闸、顺序在 --tools/--disallowed-tools 之前还是之后、那两处未覆盖是否补。**禁止样本到位前提前翻判据,也禁止为省事删声明字段。**（2026-10-10 本席摘认领牌:不再持有,免 72h 租约超期把门 109 变恒红） 〔改号(2026-10-14):原G-1111922〕〕 〔副本正文并入·承载整段:承 G-427 第②步:allowed-tools 要不要真成闸门 —— 等一周影子台账裁决(等环境条件:2026-10-17 之后跑 ihui skills shadow-report 取实据;台账在用户状态根 skill-allowed-tools-shadow.jsonl,无 surface 行时该命令判 UNDETERMINED 且 RC=2 ⇒ 不得把"零命中"读成"没有冲突")。第①步(只记不挡、默认开但无声明即零写盘、hub 分支与显式单点调用两处未覆盖如实登记)已由 00f2cf4d4b02968ce097d506d32a9d2640905bc2 落地并翻勾;本行只管"要不要开"与开在哪:权限层哪一道闸、顺序在 --tools/--disallowed-tools 之前还是之后、那两处未覆盖是否补。**禁止样本到位前提前翻判据,也禁止为省事删声明字段。**（2026-10-10 本席摘认领牌:不再持有,免 72h 租约超期把门 109 变恒红） 〔改号(2026-10-14):原G-1111922〕 〔副本正文并入·承载整段:承 G-427 第②步:allowed-tools 要不要真成闸门 —— 等一周影子台账裁决(等环境条件:2026-10-17 之后跑 ihui skills shadow-report 取实据;台账在用户状态根 skill-allowed-tools-shadow.jsonl,无 surface 行时该命令判 UNDETERMINED 且 RC=2 ⇒ 不得把"零命中"读成"没有冲突")。第①步(只记不挡、默认开但无声明即零写盘、hub 分支与显式单点调用两处未覆盖如实登记)已由 00f2cf4d4b02968ce097d506d32a9d2640905bc2 落地并翻勾;本行只管"要不要开"与开在哪:权限层哪一道闸、顺序在 --tools/--disallowed-tools 之前还是之后、那两处未覆盖是否补。**禁止样本到位前提前翻判据,也禁止为省事删声明字段。**（2026-10-10 本席摘认领牌:不再持有,免 72h 租约超期把门 109 变恒红） 〔副本正文并入·承载整段:承 G-427 第②步:allowed-tools 要不要真成闸门 —— 等一周影子台账裁决(等环境条件:2026-10-17 之后跑 ihui skills shadow-report 取实据;台账在用户状态根 skill-allowed-tools-shadow.jsonl,无 surface 行时该命令判 UNDETERMINED 且 RC=2 ⇒ 不得把"零命中"读成"没有冲突")。第①步(只记不挡、默认开但无声明即零写盘、hub 分支与显式单点调用两处未覆盖如实登记)已由 00f2cf4d4b02968ce097d506d32a9d2640905bc2 落地并翻勾;本行只管"要不要开"与开在哪:权限层哪一道闸、顺序在 --tools/--disallowed-tools 之前还是之后、那两处未覆盖是否补。**禁止样本到位前提前翻判据,也禁止为省事删声明字段。**（2026-10-10 本席摘认领牌:不再持有,免 72h 租约超期把门 109 变恒红） 〔改号(2026-10-14):原G-1111922〕〕〕〕〕
```

5.

```text
- [ ] 68. 流式中切换模型 → 终止后自动带入新模型 〔让号记录(2026-10-02 F9 清偿批②):原号 68 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔副本正文并入·承载整段:流式中切换模型 → 终止后自动带入新模型 〔改号(2026-10-14):原G-1038307〕〕  〔副本正文并入·承载整段:流式中切换模型 → 终止后自动带入新模型 〔改号(2026-10-14):原G-1018221〕〕〔进度@2026-10-15/goal-r51:web 腿已装车可测 —— use-chat/model-switch.ts 被 use-chat.ts(shouldTerminateForModelSwitch/terminateActiveStream)与 send-message.ts(resolveRoundModel)消费,vitest model-switch.test.ts 末行「Tests 18 passed」。miniapp/RN 两腿按 §9 仍是活账,不得据此翻勾。〕 (原编号 68;持有行题面「流式中切换模型→终止后自动带入新模型」) 〔副本正文并入·承载整段:流式中切换模型 → 终止后自动带入新模型   〔副本正文并入·承载整段:流式中切换模型 → 终止后自动带入新模型   〔改号(2026-10-14):原G-1038307〕〕   〔副本正文并入·承载整段:流式中切换模型 → 终止后自动带入新模型   〔改号(2026-10-14):原G-1018221〕〕〔进度@2026-10-15/goal-r51:web 腿已装车可测 —— use-chat/model-switch.ts 被 use-chat.ts(shouldTerminateForModelSwitch/terminateActiveStream)与 send-message.ts(resolveRoundModel)消费,vitest model-switch.test.ts 末行「Tests 18 passed」。miniapp/RN 两腿按 §9 仍是活账,不得据此翻勾。〕〕 〔副本正文并入·承载整段:（认领已释放@2026-10-15/全清-misc:本会话收尾,未执行,交回派单面） 68. 流式中切换模型 → 终止后自动带入新模型   〔副本正文并入·承载整段:流式中切换模型 → 终止后自动带入新模型 〔改号(2026-10-14):原G-1038307〕〕   〕〔进度@2026-10-15/goal-r51:web 腿已装车可测 —— use-chat/model-switch.ts 被 use-chat.ts(shouldTerminateForModelSwitch/terminateActiveStream)与 send-message.ts(resolveRoundModel)消费,vitest model-switch.test.ts 末行「Tests 18 passed」。miniapp/RN 两腿按 §9 仍是活账,不得据此翻勾。〕〕 〕 〔副本正文并入·承载整段:流式中切换模型 → 终止后自动带入新模型   〔改号(2026-10-14):原G-1038307〕 〕〕〕〕 〔副本正文并入·承载整段:（认领已释放@2026-10-15/全清-misc:本会话收尾,未执行,交回派单面） G-1. 流式中切换模型 → 终止后自动带入新模型   〔改号(2026-10-14):原G-1038307〕〕 〔进展@2026-10-17 现读:**小程序腿已入库** —— 枚 2d61515a686c8ca5c91f19dd509387d52afe187f(apps/miniapp-taro/src/pkg-ai/ai/model-switch.ts 三个纯函数 + 16 例,chat.tsx 把 terminateActiveStream 收成唯一中止出口;该批是在隔离 worktree 里按「HEAD⊕本票改动」重算 ui-routes 派生钉后整批落的)。**RN 腿仍开**且落点被他席未提交持有:`apps/mobile-rn/src/screens/ChatScreen.tsx` 盘上 +93/−2(他席在改流式回调族)。另有一格按票面「可见理由」要求还缺 `ai.modelSwitchStopped` 五语言键:小程序离线词包是派生态(`src/i18n/generated/*.gen.ts` 与四枚 b64 此刻均他席持有),补键必须先等那一族落地再走生成器,不手抄。〕（进行中@2026-10-18/w1-permax:大型票·消费面接线）
```

6.

```text
- [ ]G-428 会扩大权限面的键必须三值：缺席 / 无效 / 空表；仓库内输入不得抬权（已拍板@2026-10-14批:解析层三值已在库——缺席/块状 mapping=null/[]=空表三态+permissionMode project 来源丢弃双测试 41/41 绿,现读取证 tmp-r49-act-6977.md;残余一格=标量无效值仍折 undefined 与缺席同形,落点 apps/cli/src/skills 三文件他人在飞,待落定后收尾）—— 上游 `subagent/profile-frontmatter.ts:76-80,103-120` 把块状 mapping 判为非法返回 `null`（注释写明"不能被空数组吞掉后**扩大** child MCP scope"），`profile.ts:183-185` 对 `source==="project"` 一律丢弃 `permissionMode`（仓库输入不能把子运行时提到 bypass）。我方 `apps/cli/src/skills/index.ts:340-346` 把"无 frontmatter"与"显式空列表"都折成 `[]`，且加载优先级 `CWD > repo root > user home`（仓库内技能排最高位）；`apps/cli/tests/skills.test.ts:273` 还把该折叠钉成了期望。今天无消费者所以不构成敞口，接消费者时若无三值区分就会重演上游防的那一型。 〔副本正文并入·承载整段:会扩大权限面的键必须三值：缺席 / 无效 / 空表；仓库内输入不得抬权 —— 上游 `subagent/profile-frontmatter.ts:76-80,103-120` 把块状 mapping 判为非法返回 `null`（注释写明"不能被空数组吞掉后**扩大** child MCP scope"），`profile.ts:183-185` 对 `source==="project"` 一律丢弃 `permissionMode`（仓库输入不能把子运行时提到 bypass）。我方 `apps/cli/src/skills/index.ts:340-346` 把"无 frontmatter"与"显式空列表"都折成 `[]`，且加载优先级 `CWD > repo root > user home`（仓库内技能排最高位）；`apps/cli/tests/skills.test.ts:273` 还把该折叠钉成了期望。今天无消费者所以不构成敞口，接消费者时若无三值区分就会重演上游防的那一型。 〔副本正文并入·承载整段:会扩大权限面的键必须三值：缺席 / 无效 / 空表；仓库内输入不得抬权（等人拍板 + 可小成本先修解析层）—— 上游 `subagent/profile-frontmatter.ts:76-80,103-120` 把块状 mapping 判为非法返回 `null`（注释写明"不能被空数组吞掉后**扩大** child MCP scope"），`profile.ts:183-185` 对 `source==="project"` 一律丢弃 `permissionMode`（仓库输入不能把子运行时提到 bypass）。我方 `apps/cli/src/skills/index.ts:340-346` 把"无 frontmatter"与"显式空列表"都折成 `[]`，且加载优先级 `CWD > repo root > user home`（仓库内技能排最高位）；`apps/cli/tests/skills.test.ts:273` 还把该折叠钉成了期望。今天无消费者所以不构成敞口，接消费者时若无三值区分就会重演上游防的那一型。〕 〔副本正文并入·承载整段:会扩大权限面的键必须三值：缺席 / 无效 / 空表；仓库内输入不得抬权 —— 上游 `subagent/profile-frontmatter.ts:76-80,103-120` 把块状 mapping 判为非法返回 `null`（注释写明"不能被空数组吞掉后**扩大** child MCP scope"），`profile.ts:183-185` 对 `source==="project"` 一律丢弃 `permissionMode`（仓库输入不能把子运行时提到 bypass）。我方 `apps/cli/src/skills/index.ts:340-346` 把"无 frontmatter"与"显式空列表"都折成 `[]`，且加载优先级 `CWD > repo root > user home`（仓库内技能排最高位）；`apps/cli/tests/skills.test.ts:273` 还把该折叠钉成了期望。今天无消费者所以不构成敞口，接消费者时若无三值区分就会重演上游防的那一型。〕〕
```
