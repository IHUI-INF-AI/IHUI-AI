<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# chat 多端/多标签实时同步 —— 「同一消息 patch 幂等」契约

> 状态:**通道已接线,余面按 §7 逐项标注**(2026-10-26 现读:WS 房间广播 + rev 持久化 + 快照端点已在 HEAD;
> terminal 帧契约层 + 生产端发射 + web 端投影 + WS 载体登记四处已同批落地,残留见 §7 第 4 项)。
> resync 客户端契约已落,**真实发起/网络重试**仍归 §7 第 6 项各端接线。
> **2026-11-14 现读(G-20261114)**:生成腿已把前端占位 `messageId` 在 `message:created`
> 幂等建成 `chat_messages.id`,并在每帧分配 rev / 广播之前把全量 snapshot 写回该行
> ⇒ 广播 id / DB id / rev 账本 / 终态 rev 同一坐标系,流进行中 resync 即可命中快照。
> `message:terminal` 已从共享 store 的 `unwired` 档移入契约内核;taro / RN / extension
> 已补「订阅 → 共享 store → 页级投影」三层并投影终态(§7 第 4、6 项同步)。
> 三型帧(含 terminal)共用同一 uuid 形态门禁,非法 id 整条腿 fail-closed。
> 零 delta / 上游错误 / 客户端中止路径也恒建占位行(空初面),由 worker 补内容,
> 保证终态有权威坐标且历史不出现第二个 uuid。
> CLI 为平台独占豁免,详见 §7 第 6 项。
> **2026-11-14 phase 2 收口**:gap 后的 resync 真实发起(拉权威快照 + 退避重试 +
> 404/409 摘坐标 + 在飞去重)已四端同源 —— web 走端内 effect,taro / RN / extension
> 走共享泵 `chat-sync-resync-pump`;端点路径与失败分型收在 `chat-sync-snapshot`,
> 端内只交一行 `fetchApi`。验证面仍限 node(jsdom),见 §7 第 6 项。
> 本文件是台账票 B02(V2 #23;票71 那行是同题历史副本,不得再登记第二行)的契约正本;
> 判据内核与类型在 `packages/types/src/chat-sync-contract.ts`,判据回归在
> `packages/types/tests/chat-sync-contract-*.test.ts`。三处同源的规则/表格若要改,必须一次改齐。

## 0. 这份契约管什么、不管什么

管:同一条会话的消息面,同时被**两条投递通道**喂时,接收端如何把"同一逻辑变更到达两次"裁成零变化、
把"迟到/乱序/断链"裁成确定行为。SSE(生成端单播流,含重连重放)与 WS(多端房间广播,未来)都适用。

不管:传输本身(帧编码、连接生命周期、房间成员协议)、发送端乐观本(未到服务端的本地改动)、
消息落库与历史拉取。这些属通道接线票与后续票。

## 1. 通道与投递语义

| 通道 | 角色 | 语义 |
| --- | --- | --- |
| SSE | 生成端单播流(delta/重连重放) | at-least-once |
| WS | conversation 房间广播(`message:created` / `message:patched`) | at-least-once |

两条通道都**不承诺 exactly-once、不承诺有序**。同一逻辑变更大概率到达两次、且可能乱序——
幂等不是通道的恩赐,是接收端的义务。

## 2. 幂等主键与修订号(三条不许漂,与内核头注逐字同源)

1. **幂等主键 = `(messageId, rev)`。** 同一逻辑变更无论走哪条通道,这对键必须逐字相同;
   `message:created` 以 messageId 本身判重(创建天然唯一,无修订号)。
2. **rev 由服务端分配**:每消息从 1 起、严格递增、不重号、不回退。端侧乐观本不在本契约内,
   不得自造 rev 混入同一条链。
3. **`snapshot` 自包含判据**:rev=N 的 snapshot 必须已包含 ≤N 的全部内容变更。
   这一条成立,才有"低 rev 迟到一律丢弃(stale)永远安全"——它防的是
   "WS 快照落地后,SSE 迟到的 delta 把内容回退到半截"。

载荷形态只此两种:`delta`(追加增量,rev 必须恰好 = 已应用 rev + 1)与
`snapshot`(全量替换,自包含、可跨 gap 应用,恢复路径靠它)。新增形态(meta/结构位、
与票64 pin/书签 sibling 存储共面)必须升 `protocolVersion`。

终态**不是第三种载荷形态**,而是独立帧 `message:terminal`(见 §3):它是状态位、不携带内容、
不新增修订号(rev = 终结时的链头)。按本节口径属于新增形态,信封升 `chat-sync.v2`;
既有 `message:created` / `message:patched` 保持 v1 不动。

## 3. 事件形状与类型落点

- 事件封套:`{ protocolVersion, channel: 'sse'|'ws', room: {kind:'conversation', conversationId}, messageId, … }`;
  `channel`/`room`/`emittedAt` 是投递元数据,**不参与幂等判定**(时钟不可信)。
- 三个事件:`message:created`(完整初面,v1)、`message:patched`(rev + delta/snapshot 载荷,v1)、
  `message:terminal`(终态状态位,v2:rev = 链头、reason ∈ 封闭集
  `['stop','length','content_filter','error','aborted']`)。
- 类型与判据内核:`packages/types/src/chat-sync-contract.ts`(`@ihui/types` 内,主入口与
  `@ihui/types/chat-sync-contract` 子路径双出口均已登记)。
  终态标记挂在消息面的可选 `terminal?: { rev, reason }` 上;不新增 `ChatSyncState` 必填字段
  (各端手写的 state 字面量不得因本切片编译变红)。
- 帧名常量:**唯一真相源 = `packages/types/src/chat-sync-contract.ts` 的 `CHAT_SYNC_EVENT_NAMES`**
  (`message:created` / `message:patched` / `message:terminal`)。送信契约 `packages/shared/src/sse/contract.ts` 的
  `SSE_CHAT_SYNC_EVENT_NAMES` 直接引用同一对象(不重写值),且**刻意不并进** `SSE_EVENTS`:
  后者与 ai-service `sse_contract.py` 由 `check-agent-event-parity.mjs` 逐名等值对账(并进去 = 恒红),
  且 `isSSEEventName` 不得把消息面帧路由进生成流处理。两侧引用锁:
  `packages/types/tests/chat-sync-contract-frame-names.test.ts` 与
  `packages/shared/src/sse/__tests__/chat-sync-frame-names.test.ts`。

## 4. 接收端裁定表(与内核 JSDoc 逐字同源;唯一入口 `applyChatSyncEvent`)

| 输入 | 裁定 | 状态 |
| --- | --- | --- |
| created,messages 已有该 id | duplicate | 不变(不得覆盖已收 patch 的面——重放不能把流式增量打回初稿) |
| patched,消息不存在(含 created 未达) | gap | 不变 |
| patched,rev === lastAppliedRev | duplicate | 不变 |
| patched,rev < lastAppliedRev | stale | 不变 |
| delta,rev > lastAppliedRev + 1 | gap | 不变 |
| delta,已存在终态标记 | gap | 不变(终态粘性:流已收尾,续写应是一条新消息) |
| snapshot,rev > lastAppliedRev | 应用 | 自包含,可跨 gap;不清除既有终态标记 |
| delta,rev === lastAppliedRev + 1 | 应用 | 追加 textDelta |
| terminal,消息不存在 | gap | 不变 |
| terminal,rev < lastAppliedRev | stale | 不变 |
| terminal,rev > lastAppliedRev | gap | 不变(缺内容 rev,先 resync) |
| terminal,rev === lastAppliedRev(已同 rev 终态) | duplicate | 不变 |
| terminal,rev === lastAppliedRev(未终态) | 应用 | 只打终态标记,不新增 rev |

被拒(duplicate/stale/gap)时 `applyChatSyncEvent` 返回**原 state 引用**——接收端据此保证
拒绝不触发状态发布/重渲染。判 gap 的接收端应发起 resync(拉服务端权威快照),缺 rev 的帧
**可以原样缓存重投**:补齐缺失 rev 后重投即收敛(用例⑤、⑬),不需要重组载荷。

resync 的客户端契约(2026-10-26,纯函数,不接网络/UI):

- **发起判据** `planChatSyncResync({ conversationId, result })`:只有 `reason === 'gap'` 且未应用时
  返回 `{ needed: true, request: { conversationId, messageId, lastAppliedRev } }`(对应
  `GET /conversations/:id/messages/:messageId/sync-snapshot`);applied / duplicate / stale 一律
  `{ needed: false }` —— 后三者是契约规定的正常路径,发出去等于每帧拉一次全量快照。
- **并回判据** `mergeChatSyncResyncSnapshot(state, snapshot)`:固定三步、每步都走同一内核
  `applyChatSyncEvent`,无旁路写状态 —— ① 缺行时先喂 `message:created`(否则 rev>0 的 snapshot
  会判 gap);② 喂 `message:patched`(kind='snapshot', rev=N);③ 快照带 `terminal` 时按**同一 rev**
  喂 `message:terminal`(未终态 ⇒ 应用、已终态 ⇒ duplicate)。返回逐步裁定与 `applied`
  汇总(任一 applied 即真改过状态)。
- **坏快照零写入**:rev 非非负整数、或 `terminal` 不在封闭集 ⇒ 判 gap 且不改状态(拿坏快照写
  状态等于让 resync 成为新的分叉源);消费端保留 gap 旗、下一轮再拉。

## 5. 幂等判据 ↔ 测试用例映射

| 判据 | 用例(tests/chat-sync-contract-idempotency.test.ts) |
| --- | --- |
| created 双投递判重,且不得覆盖已收 patch 的面 | ① |
| delta 拼接判据(逐 rev 追加) | ② |
| **主判据 apply∘apply = apply**(同 envelope 二次应用零变化、引用不变) | ③ |
| stale:低 rev 迟到一律丢弃;跨通道竞速下快照不被 delta 回退 | ④ |
| gap:delta 断链拒绝、不丢帧位、补齐后收敛 | ⑤ |
| snapshot 自包含跨 gap 落地 | ⑥ |
| 双通道同源:同一逻辑变更 sse/ws 双投恰好生效一次,幂等键相等 | ⑦ |
| created 缺失 → patch 判 gap;created 补达后链恢复 | ⑧ |
| 收敛判据:任一序列逐帧双投递(+乱序迟到),终态与单投递逐字一致 | ⑨ |
| 幂等键字符串形状逐字锁定 | ⑩ |
| terminal 帧形态:独立帧 type、v2 信封、原因封闭集、幂等键仍为 `(messageId, rev)` | ⑪ |
| terminal 四态:链头应用(不推进 rev)/ 重投 duplicate / 低 rev stale / 超前 gap | ⑫ |
| terminal 缺行或内容未补齐判 gap;补齐后原帧重投收敛 | ⑬ |
| 终态粘性:收尾后 delta 判 gap;snapshot 推进内容但保留终态;更高链头可重新宣告 | ⑭ |
| resync 发起:仅 gap 发,applied/duplicate/stale 不发;请求坐标逐字 | ⑮ |
| resync 并回 duplicate 路径:重并零变化;带 terminal 快照先补终态 | ⑯ |
| resync 并回 stale 路径:低 rev 快照内容与终态均 stale,零回退 | ⑰ |
| gap → resync → 收敛:坐标一致、快照一次补齐、重并不再发请求 | ⑱ |
| resync 并回边界:缺行 created 先补达、rev=0 语义、坏快照 / 坏终态零写入 | ⑲ |

## 6. 生产端义务

- 同一逻辑变更在两条通道上必须携带**逐字相同**的 `(messageId, rev, kind, 载荷)`;
  `channel`/`room`/`emittedAt` 允许不同。
- 允许 at-least-once(重复投递、乱序发送都合法);不允许跳过 rev 发明新键。
- rev 分配点是服务端唯一写入方;接收端发现 rev 回退 = 生产端违约,按 stale 处理并另行告警。

## 7. 余面清单(2026-10-25 逐项状态)

1. ✅ **帧名收敛**(2026-10-25 收口):见 §3 —— `CHAT_SYNC_EVENT_NAMES` 单源,sse 侧只引用不重写值。
2. ⬜ **WS 房间协议**:订阅/退订、房间成员与在线态、连接生命周期。已落地的是房间键
   (`conv:<conversationId>`)与按成员 userId 集合的投递面;订阅协议与协作者扩员仍未定。
3. ✅ **resync 传输**(2026-10-25 收口):`ChatSyncMessageSnapshot` +
   `GET /conversations/:id/messages/:messageId/sync-snapshot`(rev=N 全量;rev=0 = 链上无 patch)。
   2026-10-26 补客户端契约:`planChatSyncResync`(仅 gap 发起)+ `mergeChatSyncResyncSnapshot`
   (created → snapshot → terminal 三步并回、坏快照零写入),见 §4。
   **2026-10-31 端侧发起已接**(web):`apps/web/src/lib/chat-sync-resync.ts` 消费 store 的
   `chatSyncGapMessageIds`(内核唯一 gap 出口)→ 逐坐标 `fetchChatSyncSnapshot` → store 的
   `applyChatSyncSnapshot`;404/409 摘坐标不重试、瞬时失败退避 3 次、重试耗尽保留坐标,
   由 `apps/web/src/hooks/use-conversation-broadcast-sync.ts` 的 effect 触发(带取消)。
4. ✅ **terminal 帧**(2026-10-26 收口):独立帧 `message:terminal`(v2 信封、rev = 链头、reason
   封闭集、终态粘性)契约层在内核并有回归(⑪–⑭)。**票面三处已同批落地**:
   ① **生产端** `apps/api/src/routes/ai-chat-stream.ts` —— 上游 `finishReason` 经闭集映射
   (`length` 家族 → `length`、`content_filter` → `content_filter`、其余 → `stop`),上游 HTTP 错 /
   重放窗口放弃 / 中断分别落 `error` / `aborted` / `error`,仅 `replayKey` 存在时在 `finally`
   fire-and-forget 发帧;
   ② **广播载体** `apps/api/src/plugins/ws-broadcast.ts` 装饰器 `broadcastChatMessageTerminal`
   (rev 取账本链头、帧复用 `messageTerminalEvent`)+ `apps/api/src/db/chat-sync-rev-queries.ts` 只读
   `readChatSyncRev`(无账行返 0)、`packages/types/src/user-broadcast.ts` 的
   `USER_BROADCAST_EVENT_NAMES` / `DATA_GUARDS` 均已登记;
   ③ **各端 store 投影**:web 已落(`apps/web/src/stores/chat.ts` 的 `applyChatSyncEvent`);
   taro 端由他席在飞(工作树 `apps/miniapp-taro/src/stores/chat-sync.ts` 未提交),RN/cli/extension
   仍归第 6 项。
   **2026-10-31 残留已清(SSE 腿)**:`apps/api/src/routes/ai-chat-stream.ts` 的转发循环
   现在从**原样** data 行采集主对话 `chunk` / `reasoning`,按 `CHAT_SYNC_STREAM_FRAME_MIN_CHARS`
   聚合后广播 `message:created`(空初面)+ `message:patched`(kind='snapshot',全量自包含);
   流收尾先 flush 帧链再发 terminal(终态 rev = 链头),终态不再落在"账本无行 ⇒ rev=0"。
   只报 snapshot 不报 delta 的理由:流未落库时 resync 拉不到快照,delta 断链无法自愈。
   生成端自己会收到这些帧 —— 端侧按 `isStreaming && streamingAssistantId === messageId`
   判回声,只推进判据面、不投影渲染面(`apps/web/src/stores/chat.ts` 的 applyChatSync)。
   同期把 rev 分配收敛回 PG 账本单源(`ws-broadcast.ts` 的 Redis INCR / 壁钟回落两档退役),
   否则 patched 与 terminal 读两本账,端侧会把终态判 stale。
   信封整体切 v2 仍待另批(现在只 terminal 用 v2,created/patched 保持 v1)。
5. ⬜ **meta 结构性 patch —— 本轮不做**:pin/书签等结构位与票64 的 sibling 存储共面,须一次升
   `chat-sync.v2`(或子版本);同样受"生产 + 消费同批"约束,单侧加字段不得合入。
6. ⬜ **各端 store 接线 —— 订阅/投影已收口,余 gap-resync 发起与真机验证**:
   web 已接(`apps/web/src/stores/chat.ts` 的 `applyChatSync` / `applyChatSyncSnapshot`,
   以及 2026-10-31 的 resync 真实发起 `apps/web/src/lib/chat-sync-resync.ts`)。
   **2026-11-14 补齐** taro / RN / extension 的「订阅 → 共享 store → 页级投影」三层:
   - taro `src/stores/chat-sync.ts` 新增 `useRemoteChatSyncMessages`(`useSyncExternalStore`
     + vanilla store,避开 Taro 4.2.0 Vite runner 归并 bug),`pkg-ai/ai/chat.tsx` 真挂载,
     本端 `thinking` 期间 `paused` 暂停投影(否则 WS snapshot 覆盖本端 SSE 前缀);
   - RN `src/stores/chat-sync.ts` 的 `planChatSyncSurfaceMerge` 增 terminal 位投影,
     `ChatScreen.tsx` 真挂载;
   - extension `ChatPage.tsx` 首次接 `subscribeChatSync`,`chat-send-utils.ts` 出页级
     merge 纯函数,生成端改用 `crypto.randomUUID()` 作占位 id(与 web 同坐标系),
     `onDone` 不再二次落库 assistant。
   共享 `chat-sync-store.ts` 删除 `message:terminal` 的 `unwired` 分支 ⇒ 终态是独立状态位,
   不带 terminal 的后续 snapshot / patch 不得清掉已有终态(粘性,§4);`unwired` 计数位
   为兼容调用方保留但恒 0。desktop / mobile-cap 无独立聊天前端,分别加载 / 同步 web 产物
   ⇒ 继承 web 能力,不单列接线。
   **仍余 ①(功能面,2026-11-14 phase 2 收口)**:失败分类 / 退避重试 / 404·409 摘坐标 /
   在飞去重收进 `@ihui/shared/chat` 的 `chat-sync-resync`;调度收进
   `chat-sync-resync-pump`(微任务合并、失败坐标不自动重跑、`stop()` 即让路);
   端点路径与 ApiResult 失败分型收进 `chat-sync-snapshot`。四端接线:
   web = `useConversationBroadcastSync` 的 gap effect;taro / RN =
   `use-user-broadcast-sync` 的 token effect 启停泵;extension = `ChatPage` 挂载 effect。
   原计划的「`@ihui/api-client` 出 REST 快照口」**未采用**:该包此切片他席在飞,
   改为共享层出路径常量 + `createChatSyncSnapshotFetcher`,端内各交一行 `fetchApi` ——
   目标(端内零路径抄写、失败分型单一真相)不变,且不制造跨包在途冲突。
   接线锁:`tests/chat-sync-store.test.ts`(taro)、`tests/chat-sync-rn.test.ts`(RN)、
   `tests/chat-sync-resync-wiring.test.ts`(extension)。
   **2026-11-14 更正(独立评估证伪)**:「snapshot 可跨 gap」只跨 rev 跳号,
   **不跨「消息不存在」** —— 契约内核 `applyChatSyncEvent` 对 snapshot 同样要求
   `state.messages.has(messageId)`,缺 created 一律判 gap。故 `message:created`
   只发一枚时,晚订阅 / WS 断线重连的旁观端会永久停在半截。
   已落地的单包缓解(§6):每枚 `message:patched(snapshot)` 广播前**幂等重发一次**
   带该帧全量内容的 `message:created`(已有行的端判 duplicate 不覆盖既有 patch 面,
   缺行的端一步补齐 created + 全量正文),零额外 DB 写;`message:terminal` 连发
   两枚,端侧按 duplicate / 终态粘性吸收。任一后续帧即可让迟到端收敛,收敛路径
   不再必须 resync。
   **确定性收敛(2026-11-14 phase 2 补齐)**:连续丢掉末帧及其后所有重发帧、但端侧仍
   收到任意后续帧时,该帧引出的 gap 会进 `pendingResyncs`,由端侧泵拉权威快照补齐
   (含缺 created 的情形:`mergeChatSyncResyncSnapshot` 先补 created 再并 snapshot)。
   仍不承诺的是「整段离线期间连一枚帧都没收到」——那条只剩下次打开会话的全量历史拉取。
   **仍余 ②(验证面)**:微信开发者工具 / Android 模拟器本机不具备(AGENTS §17),
   端侧回归均为 node(jsdom) 下同一条接线,不冒充真机观感。
   **CLI 平台独占豁免**(§9):主 REPL 会话存 `~/.ihui/sessions/*.json`,与后端
   `chat_conversations` / `chat_messages` 不互通,无 `conversationId` 坐标,不订阅账号级
   `/ws/broadcast` ⇒ 不适用本契约,非欠账。
7. ⬜ 跨消息排序与房间的会话级事件(标题改名等)是否入契约。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
