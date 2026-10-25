<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D125 多用户协作会话 · 设计稿(最小纵向切片)

> 票面:PROJECT_PLAN.md 第五十二批 D125(前瞻,四对标产品均无)。
> owner 已拍板(2026-09-27):开放面获批;执行序 = 先设计稿落档(本文),
> 再最小纵向切片(只读协作 + 逐消息评论);**写锁与"接管发言"视切片验证后另批,本票不实现**。

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
**多实例取舍(如实登记)**:`/ws/broadcast` 现态是进程内注册表(D153 同型,单实例语义);
Redis Pub/Sub(`notify:*`)住在 ws-notifications。本票**不**为协作事件新造第二条通道,
也不改动 ws-notifications;跨实例化是 `/ws/broadcast` 通道的既有已知缺口,另票处理。

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

纪律三条(照 D153 发射口):① 只在写库成功后发帧;② 发帧失败不改响应、`log.warn` 出声;
③ 删除类计数取库确认集(RETURNING),不把请求长度当结果。

## 6. 写锁 / 接管发言(另批,接口预留)

本票不实现,预留三处,避免另批回来翻改:
1. `tier` 列四档全收(仅 `plan` 可授予;写档 = 未来"接管发言"的授权面,路由 400 文案点名"另批");
2. `collab:` 前缀帧族已进封闭联合,接管类事件(如 `collab:lock`)按同三步追加;
3. 同一时刻单写者锁落 `chat_conversations.metadata` 或独立列,由另批拍板 —— 数据模型不在本切片预设。

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
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
