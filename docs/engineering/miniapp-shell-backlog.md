<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 小程序复制页三桶清单（B 方案 · 第一步，纯只读判定）

- 数据源：门 299 `scripts/check-miniapp-shell-form.mjs --worktree --explain`（2026-11-05 读数）＋ 台账 `scripts/data/miniapp-shell-copy-ledger.jsonl` 90 行。
- 读数：在册 329 / 映射登记 255 / 薄壳 207 / 复制页 89（纯复制 78、本地改动 11）/ 无法判定 0 / 台账 90。
- 判定口径（桶①三条必须同时成立）：(a) 共享屏实体存在；(b) 缺口只是少量 props/回调（本表给新增 prop 数）；(c) 新增 prop 至少被 web 或 RN 真消费（给消费点）。0 新增 prop 视为 c 条由既有 props 满足（列既有消费点）。
- 桶② = 共享屏存在但缺整屏/大块，或新增 prop 只有小程序会用；桶③ = 共享屏缺该概念，端内独有。
- 统计：**桶① 2 / 桶② 85 / 桶③ 2 / 台账可摘除 1 = 90**。

## 桶①「可立即薄壳」（2 页，新增 prop 均为 0）

| page | LOC | 桶 | 共享屏文件 | 缺口描述 | 预估工作量 | 判据依据(file:line) |
|---|---|---|---|---|---|---|
| pkg-content/carte/index | 131 | ① | packages/app/src/features/carte/CarteScreen.tsx | 新增 prop 0；页面按 `CARTE_SEGMENTS` 自绘 7 段，共享屏同表同序；5 个既有 prop（t/avatarSource/qrcodeSource/onBack/colorScheme）全供得起；仅保留 `showShareMenu` | 壳 ~40 行，删 120 行渲染 | 页 `index.tsx:33`（图片槽位）/`CarteScreen.tsx:25`（props）;RN 消费 `apps/mobile-rn/src/screens/CarteScreen.tsx:39`;契约 `packages/types/src/app-ai.ts:878` |
| pkg-about/about/help | 248 | ① | packages/app/src/features/help/HelpScreen.tsx | 新增 prop 0；共享屏 23 个 prop 已覆盖搜索/FAQ 手风琴/反馈三字段/提交态/toast/back；页面仅保留 `getHelp`+`submitFeedback`+`useUiField` | 壳 ~75 行，删 118 行渲染 | 页 `help.tsx:129`（搜索）/`:179`（反馈）;`packages/types/src/app-profile.ts:149`（props）;RN 消费 `apps/mobile-rn/src/screens/HelpScreen.tsx:106` |

## 桶③「平台独有、不做」（2 页）

| page | LOC | 桶 | 共享屏文件 | 缺口描述 | 预估工作量 | 判据依据(file:line) |
|---|---|---|---|---|---|---|
| pages/user/index | 1507 | ③ | features/profile/ProfileScreen.tsx | 共享层缺：小程序 tabBar「我的」页、扫一扫、客服会话、缓存清理、音频播放器、保存相册、微信原生分享菜单 | 不做 | 页 `index.tsx:455`(scanCode)/`:519`(createInnerAudioContext)/`:585`(downloadFile) |
| pages/setting/cache | 206 | ③ | features/settings/SettingsScreen.tsx | 共享层缺：小程序本地存储容量与清理概念（storage 单位/清空语义），RN/Web 无同构能力 | 不做 | 页 `index.tsx:26`(getStorageInfoSync)/`:93`(removeStorageSync) |

## 桶②「需新建/扩共享屏」（85 页）

| page | LOC | 桶 | 共享屏文件 | 缺口描述 | 预估工作量 | 判据依据(file:line) |
|---|---|---|---|---|---|---|
| pages/index/index | 1891 | ② | features/home/HomeScreen.tsx | 缺首页入口宫格、公告条、eventCenter 跨页联动；web 有 `apps/web/app/(main)/home/page.tsx` | 共享屏 +260 / 壳 180 | 页 `index.tsx:294`(ScrollView)/`:264`(eventCenter) |
| pages/community/index | 1003 | ② | features/agent-screen/AgentScreen.tsx | 缺社区信息流、发帖入口、话题筛选整屏；web 无 | 共享屏 +420 / 壳 160 | 页 `index.tsx:643`（唯一自绘块） |
| pages/plaza/index/index | 476 | ② | features/plaza/PlazaScreen.tsx | 缺动态流/筛选/点赞交互；web `apps/web/app/(main)/plaza/page.tsx` | 共享屏 +300 / 壳 120 | 页 `index.tsx:231`/`:265` |
| pages/share/index | 913 | ② | features/share/ShareScreen.tsx + square/SquareScreen.tsx | 缺 ShareHub 整屏（邀请/海报/收益/抽屉）；web `share/page.tsx` 仅 `redirect('/')`，不可复用 | 共享屏 +450 / 壳 170 | 页 `index.tsx:586`/`:726`（Drawer/Modal） |
| pkg-ai/ai/chat | 2463 | ② | features/chat/ChatScreen.tsx | 缺任务状态条/MCP 条/工具审批/队列/模型抽屉/素材与技能弹层 6 大块；web 无 | 共享屏 +700 / 壳 260 | 页 `chat.tsx:2232`-`:2396`（6 块） |
| pkg-ai/ai/history | 919 | ② | features/message-center/MessageCenterScreen.tsx | 缺会话历史列表与批量操作；web `apps/web/app/(main)/messages/page.tsx` | 共享屏 +260 / 壳 120 | 页 `history.tsx:742`-`:822` |
| pkg-ai/ai/conversation-import | 423 | ② | features/conversation-import/ConversationImportScreen.tsx | 缺导入分析面板与 `chooseMessageFile` 平台入口；web 无 | 共享屏 +180 / 壳 110 | 页 `conversation-import.tsx:411`(ImportAnalysisPanel) |
| pkg-ai/ai/agent | 553 | ② | features/agent-screen/AgentScreen.tsx | 缺智能体编辑与模型配置弹窗；web `apps/web/app/(main)/agents/page.tsx` | 共享屏 +220 / 壳 110 | 页 `agent.tsx:543`(ModelConfigDialog) |
| pkg-ai/ai/agent-detail | 622 | ② | features/agent-detail/AgentDetailScreen.tsx + agent-edit | 缺详情屏与编辑屏两份；web `agents/page.tsx` | 共享屏 +380 / 壳 150 | 页 `agent-detail.tsx:366`/`:379` |
| pkg-ai/ai-group/index | 241 | ② | features/agent-screen/AgentScreen.tsx | 缺群组列表/成员管理；web 无 | 共享屏 +160 / 壳 90 | 页 `index.tsx:140`-`:169` |
| pkg-ai/ai-assistant-n8n/index | 166 | ② | features/n8n-model/N8nModelScreen.tsx | 共享屏是编辑屏，缺「n8n 助手列表」整屏；web 无 | 共享屏 +120 / 壳 70 | 页 `index.tsx:97`/`:103` |
| pkg-ai/ai-career/index | 162 | ② | features/ai-career/AiCareerScreen.tsx | 缺测评表单/结果分区（页面只覆盖表单子集）；web 无 | 共享屏 +90 / 壳 70 | 页 `index.tsx:77`/`:81` |
| pkg-ai/ai-chat-detail/index | 523 | ② | features/chat/ChatScreen.tsx | 缺分享态聊天布局（无输入区、带头像条）；web 无 | 共享屏 +200 / 壳 100 | 页 `index.tsx:307`/`:312` |
| pkg-ai/agent-dialogue/index | 677 | ② | features/chat-room/ChatRoomScreen.tsx | 缺 WebSocket 群聊房间与成员条；web 无 | 共享屏 +320 / 壳 150 | 页 `index.tsx:330`(connectSocket)/`:536`-`:654` |
| pkg-ai/aigc/list | 464 | ② | features/aigc-list/AigcListScreen.tsx | 缺作品流/音频预览/分类；web 无 | 共享屏 +260 / 壳 120 | 页 `list.tsx:292`-`:451` |
| pkg-ai/aigc/publish | 245 | ② | features/aigc-publish/AigcPublishScreen.tsx | 缺上传/预览/发布表单；web 无 | 共享屏 +140 / 壳 90 | 页 `publish.tsx:216` |
| pkg-ai/ranking/index | 263 | ② | features/ranking/RankingScreen.tsx | 缺搜索与多维榜单（共享屏只有周/月/总切换）；web `(main)/ranking/page.tsx` | 共享屏 +140 / 壳 90 | 页 `index.tsx:147`-`:163` |
| pkg-ai/developer/income | 698 | ② | features/model-income/ModelIncomeScreen.tsx | 缺模型收益明细/结算卡大块；web `(main)/developer/page.tsx` | 共享屏 +300 / 壳 150 | 页 `income.tsx:292` |
| pkg-ai/developer/withdrawal | 194 | ② | features/income/IncomeScreen.tsx + withdraw/WithdrawScreen.tsx | 缺提现记录列表屏（共享屏是收益总览+提现表单）；web `(main)/wallet/withdraw/page.tsx` | 共享屏 +130 / 壳 80 | 页 `withdrawal.tsx:130` |
| pkg-ai/business-card/index | 149 | ② | features/business-card/BusinessCardScreen.tsx | 缺名片预览/保存相册/分享入口；web `(main)/business-card/page.tsx` | 共享屏 +110 / 壳 80 | 页 `index.tsx:91`/`:65`(saveImageToPhotosAlbum) |
| pkg-ai/dev-enter/cover/index | 336 | ② | features/dev-enter-cover/DevEnterCoverScreen.tsx | 缺创作者封面与入口宫格；web `(main)/developer/page.tsx` | 共享屏 +180 / 壳 100 | 页 `index.tsx:181` |
| pkg-ai/dev-enter/model-edit/index | 403 | ② | features/model-edit/ModelEditScreen.tsx | 缺模型编辑整屏（价格/参数/能力表单）；web 无 | 共享屏 +260 / 壳 140 | 页 `index.tsx:190`/`:218` |
| pkg-ai/dev-enter/n8n-model/index | 538 | ② | features/n8n-model/N8nModelScreen.tsx | 缺工作流模型编辑与文件上传区；web 无 | 共享屏 +300 / 壳 160 | 页 `index.tsx:298`-`:443` |
| pkg-shop/vip/index | 692 | ② | features/vip/VipScreen.tsx | 缺会员权益/套餐/开通 CTA 大块；web `(main)/vip/page.tsx` | 共享屏 +380 / 壳 180 | 页 `index.tsx:362` |
| pkg-shop/vip/privilege | 389 | ② | features/vip-benefit/VipBenefitScreen.tsx | 缺权益矩阵/对比表；web `(main)/vip/page.tsx` | 共享屏 +240 / 壳 120 | 页 `privilege.tsx:149` |
| pkg-shop/vip/upgrade | 214 | ② | features/vip-level/VipLevelScreen.tsx | 缺等级进度/升级路径；web `(main)/vip/page.tsx` | 共享屏 +130 / 壳 90 | 页 `upgrade.tsx:157` |
| pkg-shop/vip/details | 220 | ② | features/vip-compare/VipCompareScreen.tsx | 缺套餐对比表与购买按钮；web `(main)/vip/page.tsx` | 共享屏 +150 / 壳 90 | 页 `details.tsx:111`-`:210` |
| pkg-shop/vip/success | 209 | ② | features/topup-success/TopupSuccessScreen.tsx | 缺开通成功页与权益回执；web 无 | 共享屏 +160 / 壳 90 | 页 `success.tsx:120`/`:80`（storage 回执） |
| pkg-shop/pay/index | 518 | ② | features/payment/PaymentScreen.tsx | 缺支付方式选择与订单回执；web `(main)/payment/page.tsx` | 共享屏 +300 / 壳 150 | 页 `index.tsx:368`/`:244`(showActionSheet) |
| pkg-shop/order/refund | 248 | ② | features/order-refund/OrderRefundScreen.tsx | 缺退款原因与凭证上传；web `(main)/orders/page.tsx` | 共享屏 +150 / 壳 90 | 页 `refund.tsx:125`/`:154` |
| pkg-shop/vip-trader/index/index | 426 | ② | features/vip-trader/VipTraderScreen.tsx | 缺交易员档案与跟单操作；web `(main)/vip/trader/page.tsx` | 共享屏 +260 / 壳 130 | 页 `index.tsx:241`/`:207`(showModal) |
| pkg-shop/wallet/recharge/index | 249 | ② | features/app-topup/AppTopupScreen.tsx | 缺充值档位与协议勾选；web `(main)/wallet/recharge/page.tsx` | 共享屏 +170 / 壳 100 | 页 `index.tsx:134`/`:144` |
| pkg-shop/wallet/withdrawal/index | 171 | ② | features/withdraw/WithdrawScreen.tsx | 缺提现表单与费率说明；web `(main)/wallet/withdraw/page.tsx` | 共享屏 +110 / 壳 80 | 页 `index.tsx:87` |
| pkg-learn/course/list | 195 | ② | features/course-tab/CourseTabScreen.tsx | 缺课程分类/卡片/进度（页面只是共享屏子集）；web 无 | 共享屏 +200 / 壳 100 | 页 `list.tsx:104` |
| pkg-learn/course/detail | 455 | ② | features/course-detail/CourseDetailScreen.tsx | 缺课程详情/章节/分享；web 无 | 共享屏 +300 / 壳 150 | 页 `detail.tsx:237`/`:290` |
| pkg-learn/live/list | 248 | ② | features/live-list/LiveListScreen.tsx | 缺直播列表/预约/日历按钮；web `(main)/live/page.tsx` | 共享屏 +170 / 壳 100 | 页 `list.tsx:142`/`:150`-`:166` |
| pkg-learn/live/subscribe | 138 | ① | features/subscriptions/SubscriptionsScreen.tsx | 共享屏补直播段：封面/讲师/开播时间/状态徽标 + 「已订阅 N 场」计数行 + 提醒开关卡 + 直播行点击 + 空态「去发现」；壳只剩映射与回调；web 无；改前=getLiveList({status:'upcoming'}) 请求 /live/list 撞 listChannelsQuery 数字 schema 恒 400（旧「即将开播」过滤从未生效，是坏功能）；改后=我订阅且启用的频道（含直播中/已结束/未发布但启用，仅滤 status=1）；文案已同步：标题「我的订阅」、计数、空态「去发现直播」、三态徽标（直播中/即将开播/已结束），并补 subscriptions.title 兜底 | 共享屏 +174/-28（新增直播段与样式）；壳 138 行（原 197） | 页 `subscribe.tsx:116`(挂载)/`:101`(直播映射)；共享屏 `SubscriptionsScreen.tsx:139`-`:151`(计数/提醒)、`:57`-`:96`(直播行)、`:172`(空态 CTA)；RN `apps/mobile-rn/src/screens/SubscriptionsScreen.tsx:180`(挂载)；API `apps/api/src/routes/live.ts:444-450`(GET 订阅)/`:489-499`(DELETE 订阅) |
| pkg-learn/live/host/index | 174 | ① | features/live-host/LiveHostScreen.tsx | 共享屏已含全部段(状态徽标/预览/推流地址密钥/开播结束/统计/商品)，本笔零新增；壳只保留 SRS 调用/计时/剪贴板/导航与文案兜底 | 共享屏 +0 / 壳 174（原 292） | 页 `index.tsx:147`(挂载)/`:162`(开播)/`:167`(复制)/`:168`(返回)；RN `apps/mobile-rn/src/screens/LiveHostScreen.tsx:162`(真消费) |
| pkg-learn/teacher/detail | 348 | ② | features/lecturer-detail/LecturerDetailScreen.tsx | 缺讲师档案/课程/预约；web 无 | 共享屏 +220 / 壳 110 | 页 `detail.tsx:99`（无顶块=内联大段） |
| pkg-learn/learn-develop/index | 254 | ② | features/learn-develop/LearnDevelopScreen.tsx | 缺学习发展路径/阶段卡；web 无 | 共享屏 +150 / 壳 90 | 页 `index.tsx:118` |
| pkg-learn/course-planet/index | 286 | ② | features/course-planet/CoursePlanetScreen.tsx | 缺课程星球/任务卡；web 无 | 共享屏 +170 / 壳 100 | 页 `index.tsx:138`-`:178` |
| pkg-learn/subscription/contracts/index | 195 | ② | features/subscriptions/SubscriptionsScreen.tsx | 缺订阅合约/签署流；web 无 | 共享屏 +130 / 壳 80 | 页 `index.tsx:109`/`:63`(showModal) |
| pkg-user/user/settings | 410 | ② | features/settings/SettingsScreen.tsx | 缺账号安全/通知/隐私多区块汇总屏；web `(main)/settings/page.tsx` | 共享屏 +260 / 壳 140 | 页 `index.tsx:167` |
| pkg-user/user/orders | 214 | ② | features/order/OrderScreen.tsx | 缺订单列表/筛选/操作；web `(main)/orders/page.tsx` | 共享屏 +160 / 壳 90 | 页 `orders.tsx:121` |
| pkg-user/user/profile | 212 | ② | features/profile/ProfileScreen.tsx | 缺个人资料头与菜单（页面为设置子集）；web 无 | 共享屏 +140 / 壳 90 | 页 `profile.tsx:124` |
| pkg-user/user/avatar | 174 | ② | features/profile-edit/ProfileEditScreen.tsx | 缺头像上传/裁剪（页面是编辑屏子集）；web 无 | 共享屏 +120 / 壳 80 | 页 `avatar.tsx:107`/`:56`(chooseImage) |
| pkg-user/user/nickname | 172 | ② | features/profile-edit/ProfileEditScreen.tsx | 缺昵称单字段表单屏；web 无 | 共享屏 +100 / 壳 70 | 页 `nickname.tsx:116` |
| pkg-user/user/phone | 325 | ② | features/change-phone/ChangePhoneScreen.tsx | 缺换绑手机号与验证码区；web 无 | 共享屏 +200 / 壳 110 | 页 `phone.tsx:187` |
| pkg-user/user/email | 201 | ② | features/change-phone/ChangePhoneScreen.tsx | 共享屏是「手机」语境（国家码/短信），邮箱绑定字段与文案全不同；web 无 | 共享屏 +160 / 壳 90 | 页 `email.tsx:141` |
| pkg-user/following/index | 272 | ② | features/follow/FollowScreen.tsx | 缺关注/粉丝列表；web 无 | 共享屏 +170 / 壳 100 | 页 `index.tsx:127`/`:146` |
| pkg-user/message/index | 569 | ② | features/message-center/MessageCenterScreen.tsx | 缺站内消息/系统通知/会话删除；web `(main)/messages/page.tsx` | 共享屏 +300 / 壳 150 | 页 `index.tsx:394`-`:526` |
| pkg-user/account-cancel/index | 340 | ② | features/account-cancel/AccountCancelScreen.tsx | 缺注销冷静期与校验流；web 无 | 共享屏 +200 / 壳 110 | 页 `index.tsx:269` |
| pkg-content/news/list | 283 | ② | features/article-list/ArticleListScreen.tsx | 缺资讯列表/搜索/分类；web `(main)/news/page.tsx` | 共享屏 +180 / 壳 100 | 页 `list.tsx:190`-`:199` |
| pkg-content/category-detail/index | 156 | ② | features/category-detail/CategoryDetailScreen.tsx | 缺分类详情与筛选；web 无 | 共享屏 +110 / 壳 70 | 页 `index.tsx:75` |
| pkg-content/share/creation | 283 | ② | 无（声明 ChatScreen/SquareScreen 均为误挂） | 缺 ShareLandingScreen（分享出来的回答落地页：无输入区、带分享菜单）；web `share/page.tsx` 仅 `redirect('/')` | 共享屏 +200 / 壳 100 | 页 `creation.tsx:102`-`:130`（NavBar×3 + ScrollView） |
| pkg-content/plaza/cover/index | 374 | ② | features/plaza-cover/PlazaCoverScreen.tsx | web `(main)/plaza/*` 只有社区广场（PageClient/PlazaHeader/CirclesPanel/AsksPanel），无开发者空间状态行/续费/FAQ/信息卡/三入口；RN 只有 hero/features/2 actions/footer（`PlazaCoverScreen.tsx:42-47`/`:56-87`） | 共享屏 +220 / 壳 110 | 页 `index.tsx:176` |
| pkg-content/plaza/set-need/index | 177 | ③ | features/set-need/SetNeedScreen.tsx | 概念不同：小程序是偏好选择（类别/等级/预算 `set-need/index.tsx:27-42`/`:62`），共享屏是发布需求表单（`SetNeedScreen.tsx:29-47`，RN `SetNeedScreen.tsx:125`）；web `(main)/plaza` 无偏好实现（grep 零命中） | 共享屏 +110 / 壳 70 | 页 `index.tsx:86`-`:165` |
| pkg-content/community/create/index | 235 | ② | features/post-create/PostCreateScreen.tsx | 缺发帖编辑器与圈子选择；web 无 | 共享屏 +150 / 壳 90 | 页 `index.tsx:178`/`:187` |
| pkg-about/about/index | 248 | ② | features/about/AboutScreen.tsx | 缺 3 处：版本号、版权页脚、标题取词键；新增 prop 仅小程序会用（违反桶①c）；web `(main)/about/page.tsx` | 共享屏 +60 / 壳 60 | 页 `index.tsx:45`-`:103`;`AboutScreen.tsx` 无 version |
| pages/distribution/index | 469 | ② | features/distribution/DistributionScreen.tsx | 缺分销总览/收益卡/客服浮标；web `(main)/distribution/page.tsx` | 共享屏 +280 / 壳 140 | 页 `index.tsx:255`-`:380` |
| pages/distribution/team | 339 | ② | features/team/TeamScreen.tsx | 缺团队列表/搜索/层级；web `(main)/distribution/team/page.tsx` | 共享屏 +200 / 壳 110 | 页 `team.tsx:158`-`:174` |
| pages/distribution/commission | 133 | ② | features/income/IncomeScreen.tsx | 缺佣金明细列表屏（共享屏是收益总览）；web `(main)/distribution/commission/page.tsx` | 共享屏 +110 / 壳 70 | 页 `commission.tsx:86` |
| pages/distribution/rank | 141 | ② | features/ranking/RankingScreen.tsx | 缺佣金榜：字段 `commission`、无 range 切换，与共享屏 `points/studyHours` 语义不同 | 共享屏 +110 / 壳 70 | 页 `rank.tsx:86`(PODIUM)/`:111`(rest) |
| pages/distribution/order-list/index | 266 | ② | features/distribution-order-list/DistributionOrderListScreen.tsx | 缺分销订单列表与状态筛选；web `(main)/orders/page.tsx` | 共享屏 +160 / 壳 90 | 页 `index.tsx:164`/`:184` |
| pages/distribution/member-detail/index | 244 | ② | features/team-detail/TeamDetailScreen.tsx | 缺成员详情/业绩；web 无 | 共享屏 +150 / 壳 90 | 页 `index.tsx:125` |
| pages/exam/detail | 275 | ② | features/exam/ExamScreen.tsx | 缺试卷/答题卡；web `(main)/exam/page.tsx` | 共享屏 +180 / 壳 100 | 页 `detail.tsx:147` |
| pages/exam/result | 235 | ② | features/exam-result/ExamResultScreen.tsx | 缺成绩单与分享；web `(main)/exam/page.tsx` | 共享屏 +150 / 壳 90 | 页 `result.tsx:138` |
| pages/study/index | 201 | ② | features/study-index/StudyIndexScreen.tsx | 缺 5 入口宫格/进度总览（RN 端注释已标「无对应区」）；web 无 | 共享屏 +130 / 壳 80 | 页 `index.tsx:95` |
| pages/study/record | 189 | ② | features/study-record/StudyRecordScreen.tsx | 缺学习记录与统计卡；web 无 | 共享屏 +120 / 壳 80 | 页 `record.tsx:138`-`:146` |
| pages/study/plan | 199 | ② | features/study-plan/StudyPlanScreen.tsx | 缺计划编辑与专注输入；web 无 | 共享屏 +120 / 壳 80 | 页 `plan.tsx:100` |
| pages/study/rank | 153 | ② | features/ranking/RankingScreen.tsx | 缺学习榜：无 range 切换、字段/取词与共享屏不同；web `(main)/ranking/page.tsx` | 共享屏 +100 / 壳 70 | 页 `rank.tsx:48` |
| pages/study/my-study/index | 226 | ② | features/study-record/StudyRecordScreen.tsx | 缺我的学习/排行入口两块；web 无 | 共享屏 +140 / 壳 90 | 页 `index.tsx:95`-`:139` |
| pages/study/publish/index | 160 | ② | features/study-publish/StudyPublishScreen.tsx | 缺学习打卡发布；web 无 | 共享屏 +110 / 壳 70 | 页 `index.tsx:83` |
| pages/study/video-detail/index | 420 | ② | features/video-player/VideoPlayerScreen.tsx | 缺视频详情/目录/分享；web 无 | 共享屏 +260 / 壳 130 | 页 `index.tsx:280` |
| pages/circle/detail | 412 | ② | features/post-detail/PostDetailScreen.tsx | 缺帖子详情/评论/点赞；web 无 | 共享屏 +260 / 壳 130 | 页 `detail.tsx:225` |
| pages/circle/create | 407 | ② | features/post-create/PostCreateScreen.tsx | 缺圈子发帖与图片上传；web 无 | 共享屏 +280 / 壳 140 | 页 `create.tsx:226` |
| pages/ask/create | 375 | ② | features/ask-create/AskCreateScreen.tsx | 缺提问编辑器与图片；web `(main)/ask/page.tsx` | 共享屏 +240 / 壳 120 | 页 `create.tsx:190` |
| pages/member/index | 519 | ② | features/vip/VipScreen.tsx | 缺会员中心与权益宫格；web `(main)/vip/page.tsx` | 共享屏 +300 / 壳 160 | 页 `index.tsx:247` |
| pages/setting/index | 217 | ② | features/settings/SettingsScreen.tsx | 缺设置索引与账号入口；web `(main)/settings/page.tsx` | 共享屏 +150 / 壳 90 | 页 `index.tsx:157` |
| pages/setting/notification | 232 | ② | features/notification-settings/NotificationSettingsScreen.tsx | 缺通知开关分组与保存条；web 无 | 共享屏 +150 / 壳 90 | 页 `notification.tsx:125` |
| pages/setting/language | 137 | ② | features/settings/SettingsScreen.tsx | 缺「语言单选」单屏（共享屏是整屏设置，需 mode 或新屏；mode 只有小程序会用） | 共享屏 +110 / 壳 70 | 页 `language.tsx:85` |
| pages/setting/theme | 184 | ② | features/settings/SettingsScreen.tsx | 缺「主题单选」单屏（同上）；web 无 | 共享屏 +120 / 壳 70 | 页 `theme.tsx:108` |
| pages/setting/privacy | 228 | ② | features/security-settings/SecuritySettingsScreen.tsx | 缺隐私开关与系统授权(`openSetting`)；web `(main)/settings/privacy/page.tsx` | 共享屏 +150 / 壳 90 | 页 `privacy.tsx:143`/`:94` |
| pages/register/index | 248 | ② | features/register/RegisterScreen.tsx | 缺注册表单与协议勾选；web 无 | 共享屏 +160 / 壳 90 | 页 `index.tsx:134` |
| pages/forgot-password/index | 267 | ② | features/change-pwd/ChangePwdScreen.tsx | 缺短信验证找回密码流程（共享屏只管已登录改密）；web `(auth)/forgot-password/page.tsx` | 共享屏 +180 / 壳 100 | 页 `index.tsx:126` |

## 台账第 90 行（已可摘除，不在三桶内）

| page | LOC | 桶 | 共享屏文件 | 缺口描述 | 预估工作量 | 判据依据(file:line) |
|---|---|---|---|---|---|---|
| pkg-user/user/password | 131 | 已收敛·可摘除 | features/change-pwd/ChangePwdScreen.tsx | 真薄壳：页内仅 `ThemeRoot`+`ChangePwdScreen`；共享屏新增 `inputMaxLength`/`errorVisibility` 由本页与 RN 共同消费（门 299 S2 判可摘） | 摘行待退休通道 | `password.tsx:102`-`:104`;`ChangePwdScreen.tsx` 两个可选 prop |

## 修订：pages/study/rank 判词更正（2026-11-06）

`090b4fecc9`（`feat/share-creator-screen`）里「结构下限」的判词基于落后分支：该树不含 `ca63368c3b`，共享屏缺 `title/subtitle/emptyText/showRanges/showStudyHours/amountFormatter`。`main` 上这些 prop 已存在，可达 2 开标签且无需新增 prop，故**改判真做**，并在 `feat/study-rank-shell`（基于 `main`）落地。

- 页 `apps/miniapp-taro/src/pages/study/rank.tsx`：153 行 / 29 开标签（E25+S4，T4）→ **93 行 / 2 开标签（E1+S1，F0，T0）**，实际结构 = `ThemeRoot` + `<RankingScreen/>`。
- 传值：`top3=[list[1],list[0],list[2]]` 复刻 2-1-3；`amountFormatter` 用 `study.rankPage.minutes`；`showRanges=false`；`showStudyHours=false`；`title/subtitle/emptyText` 用原键（空态 `study.rankPage.empty`）。
- RN 零可见变化：`apps/mobile-rn/src/screens/RankingScreen.tsx:124-125` 显式传 `showRanges={true}`/`showStudyHours={true}`，与共享屏默认值（`packages/app/src/features/ranking/RankingScreen.tsx:54-55`）逐值相同。
- 台账行 103 不删不改（原表仍记 153/②），状态待退休通道统一刷新。
- GitHub 简介与现算不符（简介 340 表 / 176 模型，现算 621 / 100），属仓库外元数据陈旧，非本支引入；更新简介需 GitHub 写权限，另开票。

## 跨页系统性：共享屏自带返回/关闭与原生导航重复（2026-11-06）

这不是单页欠账，而是同一张共享屏/同一批宿主上的共性冗余；单独开票收口，本批不做。

| 共享屏 | 冗余控件 | 涉及消费点 | 宿主已有返回的证据 |
|---|---|---|---|
| `packages/app/src/features/ranking/RankingScreen.tsx` | `BackChevron`（import `:12`，渲染 `:77`） | `study/rank`（`1a1378edeb`）、`distribution/rank`（分销线薄壳） | 两页 `*.config.ts` 均只有 `navigationBarTitleText`、无 `navigationStyle`（`study/rank.config.ts:5-7`、`distribution/rank.config.ts:5-7`）；全局 `app.config.ts:431-437` 的 `window` 也无 `custom` ⇒ 原生导航栏自带返回；两页入口都走 `navigateTo`（`study/index.tsx:128-134`、`learn-develop/index.tsx:107`），栈深恒 >1 |
| `packages/app/src/features/model-edit/ModelEditScreen.tsx` | 「取消」按钮（`:94`，`common.cancel`） | 宿主原生返回/系统返回手势 | 同批已定，RN 与系统返回重复 |

裁决：**当前状态 = 已知冗余，可接受，不算违规**；不回退、不加单端 `showBack`。

收口方案（单独开票，本批不做）：共享屏加 `showBack`/`showClose` 开关，**两端在有原生导航的宿主上都显式传 `false`**（两端显式同值不算单端 prop）；改共享屏必须由 RN owner 确认视觉变化。

`study/rank` 其余四条按有意收敛记档，均为**小程序侧变化、RN 零变化**：加载骨架、下拉刷新、错误重试、人数不足 3 时显示已有领奖台。

## 判定方法与已知偏差

- 页内「自绘块」行号由 TS AST 取最外层 JSX 直接子元素起始行（`D:\DevEnv\Temp\ihui-jsx\blocks.mjs`），共享屏缺块由 props 契约（`packages/types/src/app-*.ts`）与 RN 消费壳交叉核对。
- 桶①的 2 页均按「0 新增 prop」入门槛；其余 87 页要么缺整屏/大块，要么所需新增 prop 只有小程序会消费（如 `hideBack`、`mode`、版本号），按用户口径降级桶②。
- `pages/index/index`、`pkg-ai/ai/chat` 等 11 个 `local-delta` 页与纯复制页同口径判定（门 299 的 local-delta 只表示有数据层迹象，不改变缺口性质）。

## 批次③（内容域）可达性复核（2026-11-05）

范围：`--explain` 域内 17 页（`pkg-content/*` 2 页 + `pages/*` 内容类 15 页），全部 ②/③，**0 页可达①**。本批**不换壳、不新建/改共享屏、不改页面源码**；**不写「已薄壳」、不计入复制页下降**；台账 `scripts/data/miniapp-shell-copy-ledger.jsonl` 93 行只读。

| 路由 | LOC | 声明共享屏 | 真假 | 缺段（估算行） | 补齐后只有单端消费的原因 |
|---|---|---|---|---|---|
| pkg-content/plaza/cover/index | 374 | features/plaza-cover/PlazaCoverScreen.tsx | 假（共享屏是 AI 需求广场引导封面；本页是开发者空间） | 头部状态+续费 36 / 未开发者引导卡 20 / 成为开发者 12 / 三入口 45 / 账号信息卡 50 / FAQ 30 | 另一端有但没接：RN `DeveloperScreen.tsx:162` 已消费开发者空间，web `(main)/developer/PageClient.tsx` 有同名空间；差入口数 3 vs 4 与信息卡行映射 |
| pkg-content/plaza/set-need/index | 177 | features/set-need/SetNeedScreen.tsx | 假（偏好选择 vs 发布需求表单） | 偏好选择整屏 ~150 | 两端都没有：web `plaza/new` 与 RN `SetNeedScreen.tsx:125` 都是发布需求 |
| pages/plaza/index/index | 476 | features/plaza/PlazaScreen.tsx | 真 | 分类抽屉 60 / 身份切换 50 / 详情居中弹层 70 | 另一端有主体但没接：RN `PlazaScreen.tsx:496`；web `(main)/plaza` 是社区广场，无需求广场 |
| pages/share/index | 913 | features/share/ShareScreen.tsx + square/SquareScreen.tsx | 假（共享屏是单条分享，页是分享广场） | 信息流 600 / 分类 60 / 排行 80 / 分享卡 60 / 抽屉浮层 90 | 两端都没有：web `(main)/share` 仅 redirect；RN `ShareScreen.tsx:287` 是单条详情 |
| pages/community/index | 1003 | features/agent-screen/AgentScreen.tsx | 假（智能体屏 vs 社区信息流） | 信息流 700 / 分类弹层 80 / Banner 60 / 聊天聚合 60 | 两端都没有：web `(main)/plaza` 是圈子/问答两 tab |
| pages/circle/detail | 412 | features/post-detail/PostDetailScreen.tsx | 假（需求/帖子详情，无评论列表/输入/关注/收藏） | 关注 15 / 互动条 30 / 评论列表 80 / 评论输入 40 / 错误态 20 | 两端都没有动态详情：web `(main)/circles/[id]` 与 RN `CircleDetailScreen.tsx:96` 都是圈子主页 |
| pages/circle/create | 407 | features/post-create/PostCreateScreen.tsx | 假（社区帖 title/content/tags） | 话题 45 / AIGC 40 / 可见范围 50 / 评论开关 15 / 草稿 40 | 另一端有同类能力但字段不匹配：RN `CirclePostScreen.tsx:10` + web `(main)/circles/post`（选圈/标题/正文/图≤9） |
| pages/ask/create | 375 | features/ask-create/AskCreateScreen.tsx | 部分（title/content/tags 真，RN `AskCreateScreen.tsx:51`） | 分类 45 / 悬赏 30 / 配图 40 / 匿名 15 | 两端都没有这 4 段：web `asks/edit/AskEditForm.tsx` 与 RN `AskEditScreen` 只有三字段 |
| pages/exam/detail | 275 | features/exam/ExamScreen.tsx + exam-history/ExamHistoryScreen.tsx | 假（列表/历史 vs 试卷详情） | 试卷信息卡 60 / 开始考试 20 / 历史战绩 60 | 另一端有但没接：web `(main)/exam/[id]/ExamIntro.tsx`、RN `ExamQuestionScreen.tsx:209`/ExamHistory；缺共享试卷介绍屏 |
| pages/exam/result | 275 | features/exam-result/ExamResultScreen.tsx | 部分（stats/review 已抽且 web 真 import） | rank 8 / 底部三操作 18 / 无 id query 兜底 13 | 两端都没有：RN `ExamResultScreen.tsx:50` 与 web `PageClient.tsx` 均无 → 缺段表 |
| pages/study/index | 201 | features/study-index/StudyIndexScreen.tsx + study-progress/StudyProgressScreen.tsx | 部分（课程网格真） | 5 入口宫格 80 / 进度总览 60 | 另一端有但没接：RN 两屏均已在，缺组合接线 |
| pages/study/record | 189 | features/study-record/StudyRecordScreen.tsx | 真（RN `StudyRecordScreen.tsx:78`） | 三态 tab 50 / 触底分页 40 | 两端都没有 tab/分页：共享屏只有下拉刷新，新增 props 仅小程序消费 |
| pages/study/plan | 199 | features/study-plan/StudyPlanScreen.tsx | 真（RN `StudyPlanScreen.tsx:89`） | 计划编辑 80 / 专注输入 40 | 另一端有表单但没接：RN `PlanNewScreen.tsx:59` + web `(main)/plan/new`；专注输入两端都没有 |
| pages/study/rank | 153 | features/ranking/RankingScreen.tsx | 部分（积分榜 range+points） | minutes 列 20 / 无 range/返回 15 | 两端都没有：web 用 `score`、RN 用 `points`，`minutes` 语义不同 |
| pages/study/my-study/index | 226 | features/study-record/StudyRecordScreen.tsx + ranking/RankingScreen.tsx | 假（两屏拼装，无「我的学习」聚合） | 聚合头 60 / 记录+排行入口 60 | 两端都没有聚合页：RN 两屏分别存在但无组合屏 |
| pages/study/publish/index | 160 | features/study-publish/StudyPublishScreen.tsx | 真（RN `StudyPublishScreen.tsx:257`） | 可见范围/标签 40 | 另一端有发布表单但字段不匹配：页 title/content/category/visibility/tags vs 共享屏 cover/category/stage |
| pages/study/video-detail/index | 420 | features/video-player/VideoPlayerScreen.tsx | 真（RN `VideoPlayerScreen.tsx:268`） | 详情 60 / 目录交互 60 / 分享 20 | 另一端有播放器但没接全：RN 有播放器+章节，web learn 视频页有播放；详情/目录/分享两端不完整 |

### 补共享层的机会（下一轮真能做的）

只列「web 或 RN 已有能力、只是没接」；「两端都没有」归不可达，不为单源给 web 造功能。

1. `pkg-content/plaza/cover/index`（最高优先，误挂）：正确同构是 `features/developer/DeveloperScreen.tsx`；RN `DeveloperScreen.tsx:162` 已消费，web `(main)/developer/PageClient.tsx` 有开发者空间；需映射信息卡行与入口数。
2. `pages/exam/detail`：web `ExamIntro.tsx` 有试卷信息+开始，RN 有 `ExamQuestionScreen.tsx:209`/ExamHistory；缺共享「试卷介绍」屏。
3. `pages/circle/create`：RN `CirclePostScreen.tsx:10` + web `(main)/circles/post` 有选圈/标题/正文/图≤9；缺话题/AIGC/可见范围/评论开关。
4. `pages/plaza/index/index`：RN `PlazaScreen.tsx:496` 有列表主体；缺分类抽屉/身份切换/详情弹层。
5. `pages/study/plan`：RN `PlanNewScreen.tsx:59` + web `(main)/plan/new` 有表单；专注输入两端都无（该段判不可达）。
6. `pages/study/publish/index`：RN `StudyPublishScreen.tsx:257` + web 发布表单；字段集需统一。
7. `pages/study/video-detail/index`：RN `VideoPlayerScreen.tsx:268` 有播放器+章节；详情/目录/分享需补。
8. `pages/study/index`：RN `StudyIndexScreen` + `StudyProgressScreen` 已在；缺组合接线。
9. `pages/study/record`：RN `StudyRecordScreen.tsx:78` 有列表+统计；tab/分页两端都无（该两段判不可达）。

### `pages/exam/result` 三段定性（只许抽段 + web 真 import）

| 段 | 现状 | web | RN | 定性 |
|---|---|---|---|---|
| rank 行 | `result.tsx:219-226` | `PageClient.tsx:54`/`:59` 无 rank | `ExamResultScreen.tsx:50` 无 rank | 不可达/缺段 |
| 底部三操作 | `result.tsx:252-269` | 无三操作/分享（仅 `:126`/`:143`/`:158` href） | 无 | 不可达/缺段 |
| 无 id 用 query 兜底 | `result.tsx:68-80` | `enabled: !!id`（`:65`），无 query 兜底 | 无 | 不可达/缺段 |

以上三段保持「缺段」，不硬扩、不计入复制页下降。

## 口径收口票（2026-11-06；11 行，待合面后由单线一次性改台账）

核对面：`D:\IHUI-AI-wt-content-merge` HEAD `8b2be8d9`（台账 93 行）。行 72 的本方退休尚未合面，见末行备注。票内 route 已逐行与台账原文对齐；此前票上 `pkg-user/...` 属笔误，实际为 `pages/circle/create` / `pages/circle/detail`。

| 行 | route | 现状证据（一句） | 建议动作（一句） |
|---|---|---|---|
| 2 | `pages/circle/create` | 407 行；声明 `features/post-create/PostCreateScreen.tsx:17`；页 `:5` 自述“端内独立实现……不参与镜像对账” | 只留备注，不动台账 |
| 3 | `pages/circle/detail` | 412 行；声明 `features/post-detail/PostDetailScreen.tsx:32`；页 `:5` 同自述 | 只留备注，不动台账 |
| 18 | `pages/plaza/index/index` | 合面树已 retired（`81a06108`） | 已闭环，不动 |
| 24 | `pages/setting/privacy` | 合面树已 retired（资讯线 `972b2d3b8d`） | 已闭环，归资讯线 |
| 38 | `pkg-ai/ai-assistant-n8n/index` | 166 行；声明 `features/n8n-model/N8nModelScreen.tsx`；共享屏是编辑屏，页是「n8n 助手列表」整屏 | 只留备注，不动 |
| 39 | `pkg-ai/ai-career/index` | 162 行；声明 `features/ai-career/AiCareerScreen.tsx`；registry 已记 2026-11-02 `not-app` 摘除 | 只留备注，不动 |
| 41 | `pkg-ai/ai-group/index` | 台账 241 行；chat 线已做真壳（页面 240→86、2 枚开标签、直吃 `AgentScreen.tsx:748`） | 本条作废，不动 |
| 55 | `pkg-ai/ranking/index` | 263 行；声明 `features/ranking/RankingScreen.tsx`；共享屏只有周/月/总切换，页有搜索+多维榜单 | 只留备注，不动 |
| 60 | `pkg-content/plaza/cover/index` | 合面树已 retired（`81a06108`） | 已闭环，不动 |
| 63 | `pkg-content/share/creation` | 早已 retired（`retiredFrom` loc=283；当前文件 134 行） | 已闭环，不动 |
| 72 | `pkg-learn/teacher/detail` | 我方 `feat/agent-home-sections` `68206d93` 已按退休通道摘除；合面树 HEAD 仍 active | 合面后即闭环，不动 |

补正说明：仅行 2/3 存在 route 错位；行 38/39/55 此前票上 route 留空，本次补齐；其余 route 与台账逐字一致，无第二处同类错位。

## 轮播段结构下限（`pages/community/index`，2026-11-06）

事实面（两端调用点：页 `apps/miniapp-taro/src/pages/community/index.tsx:746`；RN `apps/mobile-rn/src/screens/AgentScreen.tsx:689`）：

- 现成共享件 `packages/app/src/features/_shared/BannerCarousel.tsx`，props 仅 `images: ImageSourcePropType[]` + `height?`；真消费端 `CoursePlanetScreen.tsx:123`、`MoreCourseScreen.tsx:176`（RN 壳 `:85`/`:107`，小程序 `pkg-mirror2/more-course/index.tsx:18-23`）。
- 数据结构：页 `CarouselItem{img:string,title?,subtitle?}` ← `getHomePage().banner`（`coverUrl` 必填）；RN `CarouselSlide{img:string|number,title?,link?}` ← agents 前 5 头像；共享件 `ImageSourcePropType[]`，无 title/link。
- 比例：页整屏等分 `100/total%`、高 160、`aspectFill`；RN `itemWidth ?? useAppFrameWidth()`、高 160、`cover`；共享件容器实测宽/窗口宽、高 160、`cover`。
- 边距：页 wrapper `margin 18rpx 0 0 0` + 渐变描边；RN `carouselWrap` marginTop 18rpx / 水平 20rpx；共享件无（调用方自包）。
- 圆角：页/RN 各 16（组件 + 外层 16）；共享件 `rnRadius.lg`=8。
- 指示点：几何三出口同源（bottom12/gap6/高6/宽6·16）；配色页 `foreground/80`·`/30`、RN `bg-white`·`bg-white/50`、共享件 `white98`·`white50`；点圆角页/RN md6·sm4、共享件 `rnRadius.xs`=2；点跳转仅页有（`goTo`）。
- 自动播放：页显式 3000、RN 默认 3000、共享件写死 3000。
- 点击行为：页整卡 → `item.link` `navigateTo`/toast；RN `TouchableOpacity` 0.9 → agent 对话（登录校验）；共享件无点击。
- 空态：页同高静默盒；RN 同高 +「暂无轮播图」文案（调用点 `length>0` 守卫，实际不触发）；共享件 `return null`。
- 失败图：页/RN 整项摘除；共享件无摘除。无图文案兜底（渐变 + title/subtitle）仅页有，依赖 miniapp `app.css`。

三选一结论：**只能写结构下限**（不动代码、不新造第三件）。

- 直接复用否：换 `BannerCarousel` 会改 RN 可见表现（点色、点圆角、圆角、点击反馈）与 web slide 宽（`#root` 宽 → 容器实测宽，左右裁切量变）。
- 加性 prop 否：补齐至少需 7-8 个 prop，其中 `onDotPress`（指示点跳转）、空态同高盒、无图文案兜底三项只有小程序会传 ⇒ 单端 prop = 搬码；其余项虽可两端显式传，但会把仅做图片展示的共享件扩成带交互/空态/主题点的新件，且该件另有 2 个真实消费方，回归面与收益不符。
- 结构下限：本段两端各自 `Carousel` 保留；`BannerCarousel` 不承接；`pages/community/index` 的 Banner 缺段仍按本文件第 35 行记录（「Banner 60」），不计入任何单源化成果。

## 批次④ 段级上收读数（2026-11-06）

- 共享件：`packages/app/src/features/agent-screen/AgentRecentUsed.tsx`（136 行，J8+T0=8）、`AgentMyApps.tsx`（166 行，J10+T0=10）。
- 两端消费：RN `components/RecentAgents.tsx:37`、`components/MyAgents.tsx:51`（屏幕使用点 `AgentScreen.tsx:711`/`:718`）；小程序 `pages/community/components/RecentAgents.tsx:54`、`MyAgents.tsx:58`（页面使用点 `index.tsx:814`/`:817`）。
- 适配层 LOC：RN 132→46 / 178→64；小程序 82→63 / 91→71。
- 重复 UI AST：41→22（RN `RecentAgents` 8→1、`MyAgents` 10→1；小程序 10→1、13→1；共享件 J8/J10）。
- 页 AST：`pages/community/index.tsx` 51→51（J50+T1，LOC 1003→1003）。如实口径：两段在页内本就是页面级自闭合组件，上收共享件不降页内节点，降的是重复实现。
- RN 零可见变化：共享件样式逐值复制 RN 原件；RN 旧件 J8/J10 与共享件 J8/J10 同构；`defaultAvatar ?? null` 与原 `undefined` 渲染等价；`emptyText` 两端显式传且值不同（RN 字符串、页 `null`）。
- 门读数（树 `D:\IHUI-AI-wt-community`，HEAD `447a0c5d93`）：门 299 共享屏 274 / 在册页 329 / 薄壳 223 / 复制页 72（纯复制 63、本地改动 9；LOC 29162/45098=64.7%）/ 无法判定 0 / 台账 74 行；门 105 绿（自述钉 `8c729fcbef56…` matched `68206d93e1`）；门 173 绿（trackedFiles 19313 / testFiles 4138）。
- 分支与 tip：`feat/agent-home-sections` / `447a0c5d937c3d07ef6a9c001dfbdab26d853c14`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
