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
| pkg-learn/live/subscribe | 197 | ② | features/subscriptions/SubscriptionsScreen.tsx | 缺订阅列表与空态；web 无 | 共享屏 +120 / 壳 80 | 页 `subscribe.tsx:93` |
| pkg-learn/live/host/index | 292 | ② | features/live-host/LiveHostScreen.tsx | 缺主播开播/控制台；web `(main)/live/host/page.tsx` | 共享屏 +180 / 壳 100 | 页 `index.tsx:148`/`:87` |
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
| pkg-content/plaza/cover/index | 374 | ② | features/plaza-cover/PlazaCoverScreen.tsx | 缺广场封面与入口；web `(main)/plaza/page.tsx` | 共享屏 +220 / 壳 110 | 页 `index.tsx:176` |
| pkg-content/plaza/set-need/index | 177 | ② | features/set-need/SetNeedScreen.tsx | 缺需求设置表单；web 无 | 共享屏 +110 / 壳 70 | 页 `index.tsx:86`-`:165` |
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

## 判定方法与已知偏差

- 页内「自绘块」行号由 TS AST 取最外层 JSX 直接子元素起始行（`D:\DevEnv\Temp\ihui-jsx\blocks.mjs`），共享屏缺块由 props 契约（`packages/types/src/app-*.ts`）与 RN 消费壳交叉核对。
- 桶①的 2 页均按「0 新增 prop」入门槛；其余 87 页要么缺整屏/大块，要么所需新增 prop 只有小程序会消费（如 `hideBack`、`mode`、版本号），按用户口径降级桶②。
- `pages/index/index`、`pkg-ai/ai/chat` 等 11 个 `local-delta` 页与纯复制页同口径判定（门 299 的 local-delta 只表示有数据层迹象，不改变缺口性质）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
