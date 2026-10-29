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

## 落地现状(2026-10-29 现读,基线 `255275c277`)

本节是**现读事实,不是计划**。取证口径:`git show HEAD:<file>` 读 blob、`git grep <符号> HEAD`
判挂载,一律不读工作树副本(本仓多轮对象空间落地只推进 HEAD);"端点/帧/例数"均为现读计数。
与下文 §3 / §4.3 / §5 / §6 / §7 的"本切片 / 另批"时点措辞冲突时**以本节为准**;
下文原文保留只为留痕设计意图,不据此判断"做了没做"。

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
| B1 | **协作者读不到会话正文**(结构性缺口:"只读审阅"端到端不成立) | 协作读面只存在于 `chat-collab.ts` 的 `ensureReadAccess`,仅覆盖 `/collaborators`、`/collab-lock`、`/comments` 三类;会话读取面全在 `chat.ts` 且仍是 `ensureOwnedConversation`:`GET /conversations`(`findConversationsByUser`)、`GET /conversations/:id`、`GET /conversations/:id/messages`、`GET /conversations/:id/history`(web 的实际读路径)。⇒ 协作者看不到消息、也拿不到 `messageId`,评论面在真实会话里打不开 | D05 后续切片(读面授权需从 `ensureOwnedConversation` 扩到与 `ensureReadAccess` 同源判据) |
| B2 | **接受邀请入口结构性不可达**(半成品) | `CollabInvitationInbox` 全仓唯一挂载点 = `MessageCommentPanel`,而该面板只在会话消息上渲染;被邀请人 accepted 之前打不开那条会话(见 B1),也没有会话列表徽标 / 独立收件箱页。`listMyCollaboratorInvitations` 全仓唯一调用方同在该组件 | D05 后续切片(需会话列表侧入口或独立 `/collab/invitations` 页) |
| B3 | **消息帧 fan-out 未扩到协作者** | `broadcastChatMessageCreated` 的 `memberUserIds` 恒为属主 / 请求主体,代码内已标 `TODO(下一片)` | 票 71「成员协议」下一片(不在 D05 切片) |
| B4 | **非 web 端协作 UI 零消费** | 五个符号(`collab:invitation` / `collab:lock` / `CollabManagePanel` / `CollabInvitationInbox` / `MessageCommentPanel`)在 `apps/mobile-rn`、`apps/miniapp-taro`、`packages/app`、`packages/ui-react`、`packages/ui-native`、`apps/desktop` 的 HEAD 源码面**零命中**(复跑命令见本节后注) | §8 §9 豁免继续成立(切片验证后另批) |
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
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
