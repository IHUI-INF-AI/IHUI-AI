<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D125 多用户协作会话 · 设计稿(最小纵向切片)

> 票面:PROJECT_PLAN.md 第五十二批 D125(前瞻,四对标产品均无)。
> owner 已拍板(2026-09-27):开放面获批;执行序 = 先设计稿落档(本文),
> 再最小纵向切片(只读协作 + 逐消息评论);**写锁与"接管发言"视切片验证后另批,本票不实现**。
> 〔2026-10-29 现读〕上句是**立项时点**的排期;写锁/"接管发言"已于 2026-10-23 随同一切片
> 收口落地(不是待做项)。全文现状以紧接着的这一节为准。

## 落地现状(2026-10-29 现读,基线 HEAD `65ae5d6d23cdf79f60d68e4fab9b058324245168`)

本节是**现读事实,不是计划**。取证口径:`git show HEAD:<file>` 读 blob、`git grep <符号> HEAD`
判挂载,一律不读工作树副本(本仓多轮对象空间落地只推进 HEAD);"端点/帧/例数"均为现读计数。
与下文 §3 / §4.3 / §5 / §6 / §7 的"本切片 / 另批"时点措辞冲突时**以本节为准**;
下文原文保留只为留痕设计意图,不据此判断"做了没做"。
本节 A/B 两表与 §1.1 的全部计数,在写本稿时于上述 HEAD 逐条复跑过;复跑命令即证据列的符号名
配合 `git show HEAD:<路径>` + `git grep -n <符号> HEAD`,不依赖任何行号(行号一次 append 就挪位)。

### 票面三格对账(逐格「达成/未达成 + 一手证据」)

票面原文把本票切成「设计稿落档」+「最小纵向切片」+「另批(写锁/接管发言、邀请管理 UI 与接受邀请
web 入口、多实例 `/ws/broadcast` 跨实例缺口)」三格。逐格现读:

| 票面格 | 判定 | 一手证据(现读) |
| --- | --- | --- |
| ① 设计稿落档 | **达成** | 本文件在册(`docs/d125-session-collab-design.md`),且与 HEAD 代码事实逐条对账(本节) |
| ② 最小纵向切片(邀请→接受→评论→广播一条腿) | **达成(链路内)**;端到端**未达成** | 后端 12 端点 + 3 帧 + 迁移 `idx=337` + web 评论面板全部在册(A1–A9);但协作者读不到会话正文(B1)、接受入口不可达(B2)⇒ "只读审阅"这条腿在真实会话里走不通 |
| ③a 写锁 / 接管发言 | **达成**(已非"另批待做") | `apps/api/src/db/chat-collab-write-queries.ts` 的 `resolveFloorGate`/`acquireCollabLock`/`releaseCollabLock`/`clearCollabLockIfHeldBy`,在 `apps/api/src/routes/chat.ts` 的 `POST /conversations/:id/messages` 接线(他人持麦 ⇒ 409) |
| ③b 邀请管理 UI 与接受邀请 web 入口 | **半成品**:组件达成、入口未达成 | `CollabManagePanel.tsx` / `CollabInvitationInbox.tsx` 在册且有 10 例用例;两者全仓**唯一**挂载点在 `MessageCommentPanel.tsx` ⇒ 见 B2 |
| ③c 多实例 `/ws/broadcast` 跨实例 | **达成** | `apps/api/src/plugins/ws-broadcast.ts` 的 `BROADCAST_CHANNEL_PREFIX = 'broadcast:'` + `psubscribe` + `fallback to single-instance mode` 分支(A6) |

未达成两格(B1/B2)的可派单实施方案 = §10;§10 的每条阶段都带承载文件、鉴权语义与验收用例,
不是"后续切片"这一抽象占位。

### A. 已落地(有代码 ∧ 有接线)

| # | 面 | 现读事实 | 证据 |
| --- | --- | --- | --- |
| A1 | 数据模型 | 两张表 + `tierChk`/`statusChk` 两处 CHECK;迁移已进 journal(`idx=337`) | `packages/database/src/schema/chat-collab.ts`、`packages/database/drizzle/20261023120000_chat_collab.sql`、`packages/database/drizzle/meta/_journal.json`(tag `20261023120000_chat_collab`) |
| A2 | 路由 | **12 个端点(不是 8)**;注册于 `/api/chat` | `apps/api/src/routes/chat-collab.ts`(`server.get/post/patch/delete` 逐条计数 = 12)、`apps/api/src/routes/index.ts` 的 `server.register(chatCollabRoutes, { prefix: '/api/chat' })` |
| A3 | api-client | 12 个与路由一一对应的函数 | `packages/api-client/src/endpoints/chat-collab.ts`(invite / list / myInvitations / accept / revoke / listComments / addComment / deleteComment / getLock / acquireLock / releaseLock / updateTier) |
| A4 | WS 帧 | **3 个帧**:`collab:invitation` / `collab:comment` / `collab:lock`;三步齐(EVENT_NAMES ∧ 联合本体 ∧ DATA_GUARDS) | `packages/types/src/user-broadcast.ts`(`USER_BROADCAST_EVENT_NAMES` 三条 ∧ `CollabInvitationEvent`/`CollabCommentEvent`/`CollabLockEvent` ∧ `DATA_GUARDS` 三条)、`packages/api-client/src/broadcast-client.ts` 的 `USER_BROADCAST_SUBSCRIBABLE_EVENTS` |
| A5 | 写锁 / 接管发言 | **已落地,不是"另批待做"**:锁落 `chat_conversations.metadata.collabLock`(零新迁移),读改写走 `db.transaction + SELECT … FOR UPDATE`;发言强制点在 `POST /api/chat/conversations/:id/messages`,他人持麦 ⇒ 409 | `apps/api/src/db/chat-collab-write-queries.ts`(`readCollabLock` / `resolveFloorGate` / `acquireCollabLock` / `releaseCollabLock` / `clearCollabLockIfHeldBy` / `updateCollaboratorTier`)、`apps/api/src/routes/chat.ts` 的 `POST /conversations/:id/messages`(`resolveFloorGate` 接线) |
| A6 | 跨实例桥接 | **已结清**(§4.3 旧文"另票处理"作废):`/ws/broadcast` 增独立 IORedis subscriber,频道 `broadcast:<userId>`,publisher 复用 `server.redis`;`server.redis` 缺失 ⇒ 降级单实例 | `apps/api/src/plugins/ws-broadcast.ts`(`BROADCAST_CHANNEL_PREFIX = 'broadcast:'` / `psubscribe` / `fallback to single-instance mode` / `publish` 三处) |
| A7 | web 消费面 | **已挂载(不是"无 import 方")**:`chat-pane-body → MessageList → MessageItem`(仅 `commentsOpen && conversationId` 才渲染)→ `MessageCommentPanel` → 面板头部 `CollabInvitationInbox` + `CollabManagePanel`;开关按钮带 `data-testid=message-comments-toggle-*` | `apps/web/src/components/ai/chat-pane-body.tsx`(import `MessageList`)、`.../message-list/MessageList.tsx`(import `MessageItem`)、`.../MessageItem.tsx`(import `MessageCommentPanel` + 评论开关按钮 + 条件渲染块)、`.../MessageCommentPanel.tsx`(import 两面板 + 头部渲染) |
| A8 | 文案 | `collab` 命名空间 35 键 × web 五语言等值 | `packages/i18n/messages/web/{en,zh-CN,zh-TW,ja,ko}.json` |
| A9 | 用例 | 7 文件 64 例:api 5 文件(13 / 13 / 4 / 8 / 3)、types 1(13)、web 1(10) | `apps/api/tests/chat-collab-{routes,lock-routes,revoke-terminal-guard}.test.ts`、`apps/api/tests/chat-floor-gate.test.ts`、`apps/api/tests/ws-broadcast-collab-frame-class.test.ts`、`packages/types/tests/user-broadcast-collab.test.ts`、`apps/web/tests/collab-invitation-manage.test.tsx` |

端点全集(12,均在 `apps/api/src/routes/chat-collab.ts`):
`POST /conversations/:id/collaborators` · `GET /conversations/:id/collaborators` ·
`GET /collaborator-invitations` · `POST /conversations/:id/collaborator-invitations/accept` ·
`DELETE /conversations/:id/collaborators/:userId` · `PATCH /conversations/:id/collaborators/:userId` ·
`GET /conversations/:id/collab-lock` · `POST /conversations/:id/collab-lock/acquire` ·
`DELETE /conversations/:id/collab-lock` · `GET /conversations/:id/messages/:messageId/comments` ·
`POST /conversations/:id/messages/:messageId/comments` ·
`DELETE /conversations/:id/messages/:messageId/comments/:commentId`

### B. 未落地 / 半成品(逐条点名缺口与归属)

| # | 缺口 | 现读事实 | 归属 |
| --- | --- | --- | --- |
| B1 | **协作者读不到会话正文**(结构性缺口:"只读审阅"端到端不成立) | 协作读面判据 `ensureReadAccess` 只存在于 `chat-collab.ts` 内部(未导出),仅覆盖 `/collaborators`、`/collab-lock`、`/comments` 三类;会话正文读取面全在 `chat.ts` 且仍是**另一份** `ensureOwnedConversation`(同名不同体,两处各自 `const` 声明)。现读读面清单(5 条,全按 `ensureOwnedConversation` 判):`GET /conversations`(`findConversationsByUser`)· `GET /conversations/:id` · `GET /conversations/:id/messages` · `GET /conversations/:id/history` · `GET /conversations/:id/messages/:messageId/sync-snapshot`(resync 权威快照,也是读面,原稿漏登记)。⇒ 协作者看不到消息、也拿不到 `messageId`,评论面在真实会话里打不开;且协作面板与正文读面分属两套判据 = §0.6 意义上的第二真相源 | **§10 阶段 S1**(读面判据收口成单源并扩授权) |
| B2 | **接受邀请入口结构性不可达**(半成品) | `CollabInvitationInbox` 全仓唯一挂载点 = `MessageCommentPanel`,而该面板只在会话消息上渲染;被邀请人 accepted 之前打不开那条会话(见 B1),也没有会话列表徽标 / 独立收件箱页。`listMyCollaboratorInvitations` 全仓唯一调用方同在该组件(复跑:`git grep -n "CollabInvitationInbox\|listMyCollaboratorInvitations" HEAD -- apps packages`) | **§10 阶段 S2**(侧栏收件箱挂载点,组件零改动) |
| B3 | **消息帧 fan-out 未扩到协作者** | `server.broadcastChatMessageCreated` 现读两个调用方,`memberUserIds` 各只填一人:`apps/api/src/routes/chat.ts`(`[conversationForFloor.userId]` = 属主)与 `apps/api/src/routes/message.ts`(`[userId]` = 请求主体);`apps/api/src/plugins/ws-broadcast.ts` 的票 71 头注自述"房间成员扩展(accepted 协作者)属下一片,接线点只有 `memberUserIds` 一处" | **§10 阶段 S4**(票 71 成员协议下一片;与 D05 同一条接线点,不新造通道) |
| B4 | **非 web 端协作 UI 零消费** | 五个符号(`collab:invitation` / `collab:lock` / `CollabManagePanel` / `CollabInvitationInbox` / `MessageCommentPanel`)在 `apps/mobile-rn`、`apps/miniapp-taro`、`packages/app`、`packages/ui-react`、`packages/ui-native`、`apps/desktop` 的 HEAD 源码面**零命中**(复跑命令见本节后注) | **§10 阶段 S5**(§9 多端矩阵豁免继续成立,切片验证后另批) |
| B5 | 写锁无 TTL / 租约 | `COLLAB_LOCK_STATES = ['acquired','taken','released']` 无过期档;持麦人不主动交麦时,只能由他人 `takeover=true` 夺麦,或属主 `DELETE /collab-lock` 强制收麦(撤销协作者时 `clearCollabLockIfHeldBy` 顺带夺回) | **设计选择,非遗漏**(登记在此,避免被读成"锁会卡死") |

B4 复跑命令:
`git grep -En "collab:(invitation|lock)|CollabManagePanel|CollabInvitationInbox|MessageCommentPanel" HEAD -- apps/mobile-rn apps/miniapp-taro packages/app packages/ui-react packages/ui-native apps/desktop`(零输出 = 零命中)。

## 1. 与只读分享的关系(存量边界)

会话只读分享已存在:`chat_conversations.share_token`(匿名公开只读页,无身份、无写面)。
本票的协作会话是**另一条腿而不是替代**:

| 维度 | 只读分享(存量) | 协作会话(本票增量) |
| --- | --- | --- |
| 身份 | 匿名持 token | 认证用户,逐人登记 |
| 读面 | 会话快照只读 | 会话只读 + 逐消息评论 |
| 写面 | 无 | 无(接管发言 = 另批) |
| 下行 | 无(拉取制) | WS 广播协作事件(§4) |

分享页零改动;协作不依赖 shareToken,也不把协作者降级成匿名访客。

〔2026-10-29 现读更正〕上表"写面 = 无(接管发言 = 另批)"**已过期**:写档协作者抢到麦后可在
该会话发言(写锁已落地,见 §6 与「落地现状」A5);`plan` 档仍是纯只读 + 评论。
"读面 = 会话只读"这半句也**尚未兑现** —— 协作者目前读不到会话正文(见 B1)。

### 1.1 只读分享链路的现读事实(带符号锚点;票面"shareToken/分享页 both"到底 both 了什么)

票面说"会话只读分享已 both(shareToken/分享页)"。现读这一条链路的四个承载点:

| 环节 | 承载点(路径 + 符号) | 现读事实 |
| --- | --- | --- |
| 签发 | `apps/api/src/routes/chat.ts` 的 `POST /conversations/:id/share` → `apps/api/src/db/chat-queries.ts` 的 `setConversationShareToken(id, userId)` | 路由先 `requireAuth` 取 `request.userId`,再把 userId **显式入参**传给 db 出口;db 出口内**再验一次** `existing.userId !== userId ⇒ throw`(归属判定两跳,不只在 handler 里) |
| token 形态 | 同上(`setConversationShareToken` 体内 `randomBytes(8).toString('hex')`) | 16 位十六进制;**每次调用强制重生成、不复用**已有 token ⇒ 旧链接随新签发即失效(等于自带吊销,无需单独 revoke 端点) |
| 校验/取数 | `apps/api/src/routes/chat.ts` 的 `GET /conversations/share/:token` → `findConversationByShareToken(token)` + `findMessagesForShare(id)` + `serializeConversationPublic(...)` | 该路由**不调 `requireAuth`**(匿名腿),身份只由 token 本身承载;响应经 `serializeConversationPublic` 投影,非全列直吐 |
| 分享页 | `apps/web/app/(main)/chat/share/[id]/PageClient.tsx` | **双模**,由路径参数形状分派:命中 `/^[a-zA-Z0-9]{16}$/` ⇒ 打匿名端点;否则 ⇒ 打 `GET /api/chat/conversations/:id/messages`(`apiOrThrow`,**需登录**,归属门 = `ensureOwnedConversation`)。页内唯一交互是 `copyLink`(写剪贴板),**零 mutation、零写回通道** |

由此得出两条对本票定性有实际作用的结论(原稿 §1 那张表没说出来的部分):

1. **写回面确实为零**:匿名腿没有任何 POST/PATCH/DELETE 调用,也没有任何客户端自报身份的入口。
   协作会话因此**不可能**"顺手复用"分享链路做写回 —— 协作的写面只能经 §5 的认证端点走。
2. **分享页的 id-mode 那条腿,恰好就是 B1 缺的那块展示载体**。它渲染的正是"一条会话的只读正文",
   且已经走登录态与归属门。⇒ 阶段 S1 把读面判据从"仅属主"扩到"属主 ∪ accepted 协作者"之后,
   协作者打开 `/chat/share/<conversationId>`(非 16 位那条分支)即刻可只读审阅,
   **分享页零新增渲染器、零新路由**(不得复制第二份消息渲染器,§0.6)。
   这也解释了"两腿不合并"的正确含义:合并的是**只读渲染组件**,不合并的是**授权判据与身份来源**。

〔风险登记〕id-mode 分支在授权扩权后会把"该会话存在"暴露给持 conversationId 的登录用户(404/403
语义变化)。S1 必须逐路由保持现读形态:`ensureReadAccess` 现为「不存在 ⇒ 404、存在而无权 ⇒ 403」;
`apps/api/src/routes/chat.ts` 的 archives 族则自称「不存在或非属主一律 404(不泄露存在性)」——
**两种形态已并存**,S1 不得静默统一,须在 §10 的验收用例里按路由逐条钉住现有形态。

## 2. 数据模型(两张新表)

`packages/database/src/schema/chat-collab.ts`,迁移 `20261023120000_chat_collab.sql`。

### 2.1 `chat_conversation_collaborators`(邀请/协作关系)

- `id` uuid PK;`conversation_id` → chat_conversations 级联;`user_id` → users 级联(被邀请人)。
- `invited_by` → users 级联(邀请人,本切片恒为会话属主)。
- `tier` varchar(24) NOT NULL DEFAULT `'plan'` —— **权限档直接取 workspace-permissions 既有四档的
  wire 拼写**(`default / plan / accept-edits / bypass-permissions`,唯一真源
  `@ihui/types/permission-mode` 的 `PERMISSION_MODE_WIRE_VALUES`,不抄第二份清单,§0.6)。
- `status` varchar(16) NOT NULL DEFAULT `'pending'`,封闭集 `pending | accepted | revoked`。
  邀请 = 建行(pending);被邀请人接受 = accepted;属主撤销 = revoked(软删,留审计形)。
- 唯一约束 `(conversation_id, user_id)`:重复邀请走 upsert 复位 pending,不产生第二行。
- 索引:会话列、`(user_id, status)`(被邀请人取"我的待处理邀请")。

### 2.2 `chat_message_comments`(逐消息评论)

- `id` uuid PK;`conversation_id` / `message_id` 双外键级联(冗余会话列同 D49
  `chat_message_feedbacks` 先例:按会话聚合免 join);`user_id` → users 级联(评论人)。
- `body` text NOT NULL(路由侧 zod 限长 1..2000)。
- 索引:`message_id`(逐消息取评论热路径)、`conversation_id`。

## 3. 权限四档映射(谁可邀请 / 谁可评论)

四档 = `workspace-permissions` 既有档位词表(default/plan/accept-edits/bypass-permissions)。
映射判据(本切片):

- **邀请/撤销**:仅会话属主(`conversation.userId === request.userId`)。属主自身档位不参与
  ——邀请是授权动作,授权面只认归属,不认"高危档用户可越权邀请"。
- **评论**:属主 + `status='accepted'` 的协作者。协作者在本切片**只能被授予 `plan` 档**
  (只读审阅 + 评论);请求其它档位 ⇒ 400(另批预留,见 §6)。
  〔2026-10-29 现读更正〕本行**已失效**:邀请现走 `tier: z.enum(PERMISSION_MODE_WIRE_VALUES)`,
  四档全收、缺省仍 `plan`(不再 400);`plan` = 只读 + 评论且**无抢麦资格**
  (`POST …/collab-lock/acquire` ⇒ 403),其余三档 = 可抢麦。证据 `apps/api/src/routes/chat-collab.ts`
  的邀请端点与 acquire 端点;档位与发言权的映射见 §5 的补表。
- 判据实现复用既有出口:档位归一/校验走 `normalizePermissionMode` + `PERMISSION_MODE_WIRE_VALUES`
  (与 workspace-permissions 路由同一注册表);鉴权走 `plugins/auth.ts` 的 `authenticate`
  (与该路由同款 requireAuth 形态);归属过滤同款 `ensureOwnedConversation` 形态。
- 认证 ≠ 授权(AGENTS §5):所有读写先查协作者表,载荷/请求体不承载身份键。

## 4. WS 协作事件帧(与既有广播帧同族)

通道 = `/ws/broadcast` per-user 常连(`server.broadcastToUser(userId, event, data)`),
帧形态 `{event, data}` 与 D153/D154/D163 同族;类型唯一真源 =
`packages/types/src/user-broadcast.ts` 的封闭判别联合(新增事件必须同笔进
①`USER_BROADCAST_EVENT_NAMES` ②联合本体 ③`DATA_GUARDS`,缺 ③ 编译不过;
api-client `USER_BROADCAST_SUBSCRIBABLE_EVENTS` 同步追加,d153 测试硬断言两表等值)。
投影出口只此一份,端内/路由内不手拼 `{event,data}` 字面量(§0.6 不抄第二份)。

### 4.1 `collab:invitation`

`CollabInvitationData = { conversationId, invitationId, invitedBy, state, at }`
- `state ∈ COLLAB_INVITATION_STATES = ['pending','accepted','revoked']`(封闭集,新增须同笔进判据)。
- 收信人:建邀请 → 被邀请人;接受 → 属主;撤销 → 被撤销人。`invitedBy` 是**行为主体**
  (与 `conversation:updated.changedBy` 同性质),载荷内不得出现 `userId` 键(§5,判据拒收)。

### 4.2 `collab:comment`

`CollabCommentData = { conversationId, messageId, commentId, authorId, at }`
- **刻意不带评论正文**(拉取制):广播帧只做"该重取这一条消息的评论了"的失效信号,
  正文经 REST GET 取库确认集 —— 与 D153 `values` 的调和不同,评论不是"以库为准就地改一列",
  而是追加型集合,推正文会造出"帧到了、库里还有别的没看到"的半态。
- 收信人:属主 + 全部 accepted 协作者,**排除发评论者本人**(自己的写自己知道,回声免推)。

### 4.3 帧类别轴(G-201 现态上的扩展,不推翻其判定出口)

`ws-broadcast.ts` 的 `BroadcastEventClass` 追加 `'collab'`,`broadcastEventClassOf` 增加
`collab:` 前缀推导 —— 与 `conversation:`/`mcp:` 同一口径(前缀约定来自真实发射口)。
G-201 的判定出口(`resolveBroadcastRole`/`resolveBroadcastFrameClass`/ceiling 推导表)零改动:
两通道 ceiling 均为 `'all'`,新增类别对既有连接零行为差(门控仍是收窄)。
**多实例取舍**〔2026-10-29 现读:缺口已结清,原"另票处理"作废〕:立项时 `/ws/broadcast` 是
进程内注册表(D153 同型,单实例语义),跨实例化登记为既有缺口。2026-10-23 另批已补齐 ——
`ws-broadcast` 增独立 IORedis subscriber(与 ws-notifications 的 `notify:*` **分属不同命名空间**),
频道 `broadcast:<userId>`、载荷 `{event, data, eventClass}`(eventClass 是发射侧推导结果,收侧喂回
**同一个** `resolveBroadcastFrameClass` 作可选收窄,不抄第二份判据),publisher 复用 `server.redis`;
本机连接不双发(publish 会回环进本实例 subscriber,由 `pmessage` 恰好投一次);
`server.redis` 不存在或订阅初始化失败 ⇒ 降级单实例(role-gate 假 harness 零行为差)。
证据 `apps/api/src/plugins/ws-broadcast.ts`(`BROADCAST_CHANNEL_PREFIX` 常量 / `pmessage` 收侧 /
`psubscribe` / `fallback to single-instance mode` 分支 / `publish` 发侧)。
不变项:协作事件**仍不新造第二条通道**,也不改 ws-notifications。

### 4.4 `collab:lock`(写锁 / 接管发言;立项时预留,2026-10-23 落地)

`CollabLockData = { conversationId, holderUserId, state, at }`
- `state ∈ COLLAB_LOCK_STATES = ['acquired','taken','released']`(封闭集;**无"即将过期"档** ——
  锁无 TTL,造一档没人能操作的词就是第二个真相源,同 `CHECKPOINT_AVAILABILITY` 纪律)。
- `holderUserId` 是**服务端盖章的当前持麦人**:`acquired`/`taken` 必填非空,`released` 恒 `null`
  (说不出人 / 说错人即矛盾);载荷不得出现 `userId`/`user_id` 键(§5,判据拒收)。
- 收信人 = 属主 + 全部 accepted 协作者,**排除行为主体本人**(与 `collab:comment` 同一条规则);
  撤销协作者时若其恰持麦,同一条撤销动作会补发一帧 `released`(收件人集合在写库后重取,
  被撤销人天然不在其中)。
- 跨实例:本帧随 `/ws/broadcast` 整体走 `broadcast:<userId>` 桥接,不单独建通道(见 §4.3)。

## 5. API 面(apps/api,前缀 `/api/chat`,鉴权 `authenticate`)

| 端点 | 动作 | 权限 |
| --- | --- | --- |
| `POST /conversations/:id/collaborators` `{userId, tier?}` | 邀请(默认 `plan`;其它档 400 另批) | 属主 |
| `GET /conversations/:id/collaborators` | 列协作者/邀请 | 属主或 accepted 协作者 |
| `GET /collaborator-invitations` | 我的待处理邀请 | 登录用户本人 |
| `POST /conversations/:id/collaborator-invitations/accept` | 接受邀请 | 被邀请人本人 |
| `DELETE /conversations/:id/collaborators/:userId` | 撤销(软删 revoked) | 属主 |
| `GET /conversations/:id/messages/:messageId/comments` | 逐消息评论列表(join users 出作者名) | 属主或 accepted 协作者 |
| `POST /conversations/:id/messages/:messageId/comments` `{body}` | 评论 | 属主或 accepted 协作者 |
| `DELETE /conversations/:id/messages/:messageId/comments/:commentId` | 删自己的评论(属主可删本会话任意) | 作者或属主 |

〔2026-10-29 现读补全:上表是 8 端点的**立项时点**面;HEAD 实为 12 端点,补 4 行如下。〕
第一行"其它档 400 另批"已失效 —— 四档全收、缺省 `plan`。

| 端点(另批收口,2026-10-23) | 动作 | 权限 |
| --- | --- | --- |
| `PATCH /conversations/:id/collaborators/:userId` `{tier}` | 改档位(邀请管理写面;revoked 行不可改) | 属主 |
| `GET /conversations/:id/collab-lock` | 读当前写锁(`metadata.collabLock`,无锁返回 `null`) | 属主或 accepted 协作者 |
| `POST /conversations/:id/collab-lock/acquire` `{takeover?}` | 抢麦/夺麦(`takeover=true` 才允许从他人手里抢) | 属主,或 accepted **且非 `plan` 档**;`plan` ⇒ 403 |
| `DELETE /conversations/:id/collab-lock` | 交麦(持麦人本人;属主可强制收麦;无人持麦 ⇒ 幂等 no-op) | 属主或 accepted 协作者 |

写锁的强制读面在 `POST /conversations/:id/messages`(`apps/api/src/routes/chat.ts`,
`resolveFloorGate` 接线处):他人持麦 ⇒ 409;本人持麦且非属主 ⇒ 放行(跳过属主门 =
"接管发言"的全部特权);无锁 ⇒ 原语义零行为差。

纪律三条(照 D153 发射口):① 只在写库成功后发帧;② 发帧失败不改响应、`log.warn` 出声;
③ 删除类计数取库确认集(RETURNING),不把请求长度当结果。

### 5.1 "认证不等于授权"在本设计里逐条怎么成立(AGENTS §5 铁律的落点)

归属型记录(conversation / collaborator / comment / lock)的每一个入口,本设计的写法约束是:

1. **主体来源只有一处**:`apps/api/src/plugins/auth.ts` 的 `authenticate`(路由内经 `requireAuth`
   包装),解出 `request.userId`。`request.userId` 取不到 ⇒ 直接 return,不进入任何 db 调用。
2. **主体必须由承载层显式入参传入,不得从被操作记录反推**:db 出口的签名一律把 userId 排在
   记录键之后并**在查询层内再判一次**归属(现读范例:`setConversationShareToken(id, userId)` 体内
   `existing.userId !== userId ⇒ throw`;协作侧同型:`getCollaborator(conversationId, userId)`、
   `acceptCollaboratorInvitation(id, request.userId)`、`deleteMessageComment({conversationId, messageId,
   commentId, userIds})` —— 后者把主体集直接编进 `WHERE`,非属主只能删自己的那格,空确认集 ⇒ 404,
   不把"没删到"读成成功)。
   ⇒ "谁在操作"永远来自令牌主体,不来自 `conversation.userId` 这类被读出来的列。
3. **客户端自报身份一律不信**:`inviteSchema` 里的 `userId` 语义是**被邀请人**(授权对象),
   不是调用者;调用者身份仍只取自 `request.userId`。这一点必须逐字写在参数命名与注释里,
   否则后来者会把它读成"客户端可以指定自己是谁"。
   现读缺口:`inviteSchema` 与 `addCommentSchema` **未加 `.strict()`**(其余 `idParam`/`tierSchema`/
   `acquireSchema`/`commentParams` 均已 `.strict()`),多余键靠 zod 默认剥离而不会 400 ⇒
   "拒收自报身份"目前在这两枚上是约定而非机器判据。**§10 阶段 S1 同批补 `.strict()`**,
   让拒收落到与其余 schema 同一形态。
4. **帧载荷不承载收信人身份**:`collab:*` 三类载荷禁止 `userId`/`user_id` 键,行为主体只允许具名键
   (`invitedBy` / `authorId` / `holderUserId`);判据已被 `packages/types/tests/user-broadcast-collab.test.ts`
   的"拒 `userId` 键"用例钉住(现读 13 例含此维)。收信人由 `server.broadcastToUser(userId, ...)`
   的入参钉死,与载荷无耦合。
5. **越权用例必须断言"副作用没发生"并成对留正向对照**(§5 测试铁律):现有 `chat-collab-routes`、
   `chat-collab-revoke-terminal-guard` 两档已是这一形态;S1/S2 新增的读面授权用例同批照此写
   —— 陌生用户/`pending`/`revoked` 协作者读正文 ⇒ 断言既无响应体内容、也无 visit/查询副作用,
   并同时给出"accepted 协作者同参 ⇒ 200"的正向对照,防止判据写反把门焊死成恒 403。
6. **档位不越权**:授权动作(邀请/撤销/改档)只认归属(属主),不认"高危档用户可越权邀请";
   抢麦资格才看档位(`plan` ⇒ 403)。`PERMISSION_MODE_WIRE_VALUES` 的 wire 拼写是唯一真源
   (`@ihui/types/permission-mode`),本票不得抄第二份档位清单。

## 6. 写锁 / 接管发言(立项时"另批预留";2026-10-23 已落地)

本票不实现,预留三处,避免另批回来翻改:
1. `tier` 列四档全收(仅 `plan` 可授予;写档 = 未来"接管发言"的授权面,路由 400 文案点名"另批");
   〔2026-10-29 现读:前半句的"仅 `plan` 可授予"已过期 —— 四档全授,`plan` = 只读 + 评论,
   其余三档 = 可抢麦(见 §5 补表)。〕
2. `collab:` 前缀帧族已进封闭联合,接管类事件(如 `collab:lock`)按同三步追加;
3. 同一时刻单写者锁落 `chat_conversations.metadata` 或独立列,由另批拍板 —— 数据模型不在本切片预设。
   〔2026-10-29 现读:已拍板 = `metadata.collabLock`(`{holderUserId, acquiredAt}`,零新迁移;
   锁与会话同行、`FOR UPDATE` 天然同锁序,无跨表死锁面)。读改写判据单源在
   `apps/api/src/db/chat-collab-write-queries.ts`,不另立一份。〕

〔回填指针(本稿落档后)〕上面"另批"**已落地**,不是待实现项:写锁端点与地板门判据面见
`apps/api/tests/chat-collab-lock-routes.test.ts`、`apps/api/tests/chat-floor-gate.test.ts`
(实现同在本切片的路由文件 `apps/api/src/routes/chat-collab.ts`);撤销终态守卫的直接用例见
`apps/api/tests/chat-collab-revoke-terminal-guard.test.ts`。读者按 §8 测试矩阵核当下判据面,
不要按本稿 §6 的时点措辞以为写锁尚未实现。

## 7. web 最小消费面

- `apps/web/src/components/chat/message-list/MessageCommentPanel.tsx`:逐消息评论面板
  (列表 + 追加 + 删除),react-query 缓存 key `['chat','message-comments',conversationId,messageId]`;
  经 api-client 共享层订阅 `collab:comment` 帧 ⇒ 命中本会话本消息即 invalidate(拉取制兑现 §4.2);
  待处理邀请(`collab:invitation`)在本面板头部给"接受邀请"最小出口(复用既有词表键,零新增 i18n)。
- 挂载点:`MessageItem.tsx` 操作按钮行(`message-actions`)追加评论开关 —— 票面"评论 UI 可挂
  既有消息列表组件族";表单件复用 `@ihui/ui-react` 的 `Input`/`Button`。
- 连接复用 api-client 广播 hub 的设备级单例(引用计数),不新建第二条常连。

〔2026-10-29 现读补全(三条)〕
1. **挂载链是通的**,全仓现读:`apps/web/src/components/ai/chat-pane-body.tsx`(import `MessageList`)
   → `message-list/MessageList.tsx`(import `MessageItem`)→ `MessageItem.tsx`(import `MessageCommentPanel`;
   渲染条件 `commentsOpen && conversationId`;开关按钮 `data-testid='message-comments-toggle-<messageId>'`)
   → `MessageCommentPanel.tsx`。面板头部另有两条腿:`CollabInvitationInbox.tsx`(收件箱)与
   `CollabManagePanel.tsx`(名单/档位/撤销/发言锁),二者唯一挂载点都在这里(见 B2 的可达性缺口)。
2. **文案不是"零新增"**:实际落了 `collab` 顶层命名空间 35 键 × web 五语言(`en/zh-CN/zh-TW/ja/ko`),
   评论面自身复用 `comments` 既有键。
3. 帧订阅三处齐全:`collab:comment`(`MessageCommentPanel`)、`collab:invitation`
   (`CollabInvitationInbox` + `CollabManagePanel`)、`collab:lock`(`CollabManagePanel`);
   三处都只做 invalidate(拉取制),不在客户端拼第二份真相。

## 8. 测试矩阵与 §9 豁免(切片显式登记)

- api:`apps/api/tests/chat-collab-routes.test.ts`(归属/档位/评论鉴权/广播 fan-out 排除作者/
  发帧失败不改响应/库确认集删除)。
- 投影:`packages/types/tests/user-broadcast-collab.test.ts`(构造拒空/parse 往返/拒 `userId` 键/
  封闭 state 集)+ api-client `user-broadcast-hub-d153.test.ts`(两表等值断言自动覆盖新事件名)。
- 广播帧类:`apps/api/tests/ws-broadcast-collab-frame-class.test.ts`(`collab:` 前缀推导、
  自报矛盾以推导为准 —— G-201 口径回归)。
- **§9 全端矩阵豁免理由**:本切片为纵向验证腿,web 消费面只落 web 端;
  packages/app / miniapp-taro / RN 的协作 UI 属"切片验证后另批"(票面执行序),
  其广播消费走既有 `parseUserBroadcastFrame` 未知帧计数口径(不静默丢弃),无协议分叉风险。

〔2026-10-29 现读例数(逐文件数行首 `it(` / `test(` 调用,合计 64)〕
api:`chat-collab-routes` 13 · `chat-collab-lock-routes` 13 · `chat-collab-revoke-terminal-guard` 4 ·
`chat-floor-gate` 8 · `ws-broadcast-collab-frame-class` 3;投影 `user-broadcast-collab` 13;
web `apps/web/tests/collab-invitation-manage.test.tsx` 10(收件箱 + 管理面板/档位/撤销/发言锁)。
本切片**不含**协作者读会话正文的用例 —— 该读面尚未授权(见 B1),用例补在后续切片同批。

## 10. 分阶段实施方案(把 B1–B4 写成可直接派单的格)

> 口径:每阶段独立可交付、独立可验证、互不依赖到必须串行;每格给出「承载点(路径 + 符号名)/
> 鉴权语义 / 验收 / 明确不做」。禁止写行号、禁止写 7–12 位短 sha(证据一律用符号名与本节的
> 现读命令)。跨端影响面:现读 `git grep -l "conversations/share" HEAD -- apps/miniapp-taro
> apps/mobile-rn packages/app` 零命中 ⇒ 分享页与协作面**只有 web 端消费**,S1/S3 不触发
> 跨端样式同步铁律(§4),但 S5 一旦动就得同批动。

### S1 · 读面授权同源化(结清 B1;本票端到端成立的前置)

- **唯一判据出口(§0.6)**:新建 `apps/api/src/db/chat-collab-read-access.ts`,导出
  `conversationAccessOf(conversationId: string, userId: string): Promise<'owner' | 'collaborator' | 'none'>`
  与薄封装 `canReadConversation(...)`。实现只查两件事:`findConversationById` 的 `userId` 比对(=owner)
  与 `chat-collab-queries.ts` 的 `getCollaborator(conversationId, userId)` 且 `status='accepted'`(=collaborator)。
  **两处现存的 `ensureReadAccess` / 同名 `ensureOwnedConversation` 必须改为 import 这一份**
  (`chat-collab.ts` 的 `ensureReadAccess`、`chat.ts` 的 `ensureOwnedConversation` 只保留 404/403 投影壳),
  判据本体不得留在路由文件里第二份。
- **改造路由(只读五条,即 B1 清单)**:`GET /conversations`、`GET /conversations/:id`、
  `GET /conversations/:id/messages`、`GET /conversations/:id/history`、
  `GET /conversations/:id/messages/:messageId/sync-snapshot`。写面与运维面
  (`POST …/messages`、`regenerate`、`edit-rerun`、`branch`、`clear`、`archive`、`compress`、
  `auto-title`、`export`、`archives` 族)**一律保持属主门不变** —— 协作 ≠ 会话管理权。
- **列表语义不偷改**:`GET /conversations` 的 `findConversationsByUser(userId, ...)` 保持缺省"只看自己的";
  新增可选查询参数 `scope ∈ {mine, shared-with-me, all}`(zod `.strict()` + 枚举,缺省 `mine`)⇒
  既有分页/游标/D163 同步语义零行为差。协作那一路的取数出口新建
  `findConversationsSharedWithUser(userId, ...)`(join `chat_conversation_collaborators`
  且 `status='accepted'`),**不得**把两路合成一条 where 条件(合成即污染属主列表的 `messageCount`
  与排序语义)。
- **鉴权语义(§5.1 逐条落)**:全部仍是 `requireAuth` + 主体显式入参;**不新增任何匿名路由**
  (故 `check-public-exposure-list.mjs` 白名单零改动)。404/403 形态按 §1.1 风险登记逐路由**保持现状**,
  不得顺手统一:正文读面沿用「不存在 ⇒ 404、存在而无权 ⇒ 403」;archives/export 族沿用「一律 404」。
  同批给 `inviteSchema`、`addCommentSchema` 补 `.strict()`(§5.1 第 3 条的现读缺口)。
- **验收(新用例与本码同批)**:`apps/api/tests/chat-collab-read-surface.test.ts` ——
  三态矩阵(属主 / `accepted` / `pending` / `revoked` / 陌生用户)× 五条读路由全覆盖,
  每格断言响应码 + **越权格断言"没发生副作用"**(不发查询、不写库、不广播)+ 成对正向对照;
  再加一例判据单源自证:`chat.ts` 与 `chat-collab.ts` 内不得再出现 `status !== 'accepted'` 字面判据
  (由该用例直接 import `conversationAccessOf` 跑同一把尺子,§22c 禁止测试里复制判据)。
- **不做**:协作方的会话改名/删除/导出(属主专属,写进 403 文案);`share_token` 与协作关系互不派生。

### S2 · 接受邀请入口可达(结清 B2;组件零改动,只补挂载点)

- **承载点**:`apps/web/src/components/chat/conversation-list.tsx`(侧栏会话列表,现读消费方含
  `apps/web/src/components/sidebar-chat-history.tsx` 与 `workbench/workbench-session-rail.tsx`)
  顶部挂 `apps/web/src/components/chat/collab/CollabInvitationInbox.tsx` —— 该组件已自带
  `listMyCollaboratorInvitations` 取数与 `collab:invitation` 帧订阅,故 S2 只加一处渲染出口与计数徽标。
- **UI 纪律**:计数徽章必须按 §4「数字计数徽章模板」写(`inline-flex h-4 min-w-4 … tabular-nums`),
  不得手搓;按钮走 `@ihui/ui-react` 的 `Button` + `size` 档,CTA 用 `brand.cta`/`brand.ctaForeground` 成对键。
- **文案**:`collab` 命名空间现读 35 键 × web 五语言,若侧栏形态需要新键 ⇒ **五语言同批补齐**(§19),
  禁止端内硬编码中文。
- **不做**:独立 `/collab/invitations` 页 —— 侧栏挂载已让"接受"这一步在 accepted 之前可达,
  再开一页会造出第二份收件箱真相源(同一组件两处挂载可接受,两条取数实现不可接受)。
- **验收**:`apps/web/tests/collab-invitation-manage.test.tsx` 同批扩两例 ——
  ① 未加入任何会话的用户在侧栏看到待处理邀请并可接受;② 接受后 `collab:invitation` 帧 ⇒ invalidate ⇒
  侧栏计数归零(断言走真实组件渲染,不 mock 判据)。

### S3 · 只读审阅端到端(把 §1.1 的两腿接上,依赖 S1)

- **承载点**:`apps/web/app/(main)/chat/share/[id]/PageClient.tsx` 的 **id-mode 分支**(非 16 位 token
  那条腿)。S1 落地后该分支对协作者天然 200 ⇒ 只读正文直接渲染,**零新增渲染器**。
  只在页头加一格身份提示 + 跳转出口:"你是该会话的协作者(只读)/ 审阅并评论" → 跳回主聊天面
  (`MessageItem` 评论开关),不复用匿名投影。
- **不得做**:把 id-mode 降级成 `serializeConversationPublic` 投影(协作者是有身份的主体,
  投影成匿名形态等于把授权结果当 token 用);也不得在分享页内直接实现评论表单(评论面唯一源
  = `MessageCommentPanel`)。
- **验收**:一例 web 用例断言 id-mode 在"协作者身份 + 已 accepted"下渲染正文并出现评论出口;
  对照例断言陌生用户仍拿不到正文(S1 的 403 用例在承载层的镜像)。

### S4 · 消息帧 fan-out 扩到协作者(结清 B3;票 71 成员协议下一片)

- **唯一接线点**:`apps/api/src/plugins/ws-broadcast.ts` 头注自述"接线点只有 `memberUserIds` 一处"。
  现读两个调用方需同批改:
  `apps/api/src/routes/chat.ts`(`broadcastChatMessageCreated({ memberUserIds: [conversationForFloor.userId] })`)
  与 `apps/api/src/routes/message.ts`(`memberUserIds: [userId]`)⇒ 统一换成
  属主 ∪ `listAcceptedCollaboratorUserIds(conversationId)`(该出口已在
  `chat-collab-queries.ts`,不新写第二份取数)。
- **不变项**:地板门 `resolveFloorGate` 语义、房间键 `conversationRoomKey`、帧类别推导
  `broadcastEventClassOf` 全部零改动;投递仍是 per-user 收窄(role-gate 不动)。
- **风险与边界**:成员集扩大 = **每条消息的广播扇出变大**(§5e-3 同型教训:量要看得见)。
  同批在 `apps/api/tests/ws-broadcast-collab-frame-class.test.ts` 增一例断言"N 个 accepted 协作者 ⇒
  恰好 N+1 个收件人、发帧失败不改响应",并保留"排除行为主体本人"的既有规则。
- **验收**:跨实例腿复用 A6 已落地的 `broadcast:<userId>` 桥接,不新建通道。

### S5 · 非 web 端消费(结清 B4;§9 多端矩阵豁免的到期形态)

- 前置 = S1–S3 在 web 端到端跑通并接受一个真实审阅周期;不满足则**不启动**,并继续按 §8 的
  §9 豁免登记(豁免有存活期,到期未启动即回队列重裁,§0.7)。
- 启动时承载点:共享屏源 `packages/app/src/components/`(评论面与收件箱若要跨 RN/小程序,
  必须先提取为平台无关源 + adapter 注入,禁止端内重写,§3 共享层优先);小程序镜像页随之同批
  (跨端样式同步铁律 + `check-cross-end-ui-parity.mjs`);品牌/图标/圆角/读数四档一律按 §4 现成档位取。
- **禁止**为消红而先落 UI 再补读面(S1 未落地时,RN/小程序的评论面板是打不开正文的装饰件)。

### 明确不做 / 设计选择(避免后续被读成遗漏)

- **写锁无 TTL(B5)**:维持"设计选择"。造一个没人能操作的"即将过期"档 = 第二个真相源
  (同 `CHECKPOINT_AVAILABILITY` 纪律)。若将来要加,唯一形态 = 租约 + 服务端盖章的 `expiresAt`
  并同笔进 `COLLAB_LOCK_STATES`,不得只加时钟。
- **shareToken 与协作关系不合并**:匿名腿与身份腿的授权判据不同源(§1、§1.1);
  合并只会让协作者被降级成访客。
- **协作面的实时性上限**:评论正文一律拉取制(§4.2),广播帧只做失效信号。
  本设计不引入"协作光标/共同编辑",那属于另一张票。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
