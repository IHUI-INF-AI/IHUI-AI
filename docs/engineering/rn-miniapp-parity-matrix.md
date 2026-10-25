<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# RN → 小程序 镜像缺口账本(自动生成)

> 判据:与 [check-cross-end-screen-coverage.mjs](../scripts/check-cross-end-screen-coverage.mjs) 同一实现(共享屏被小程序页显式镜像的集合);
> 生成命令:`node scripts/report-rn-miniapp-gaps.mjs --write docs/engineering/rn-miniapp-parity-matrix.md`。
> 候选列只是名字 token 线索(不判定),落地时须按该屏实际字段/接口核实。

- 判定面: **HEAD blob**
- 共享屏(真相源): **218**
- 已被小程序显式镜像: **79**
- 缺口(未判定镜像): **139**

## 缺口清单

| # | 共享屏(域) | RN 候选屏 | 小程序既有页线索 | 状态 |
|---|---|---|---|---|
| 1 | `activity-detail/ActivityDetailScreen` | ActivityScreen / AgentDetailScreen | pkg-ai/ai/agent-detail / pkg-ai/ai-skill/detail/index | 🔲 |
| 2 | `agent-chat/AgentChatScreen` | ★AgentChatScreen / AgentCategoriesScreen | pkg-ai/ai/chat / pkg-ai/ai/agent | 🔲 |
| 3 | `agent-create/AgentCreateScreen` | ★AgentCreateScreen / AgentCategoriesScreen | pkg-ai/ai/agent / pkg-ai/ai/agent-detail | 🔲 |
| 4 | `agent-detail/AgentDetailScreen` | ★AgentDetailScreen / AgentCategoriesScreen | pkg-ai/ai/agent-detail / pkg-ai/ai/agent | 🔲 |
| 5 | `agent-market/AgentMarketScreen` | ★AgentMarketScreen / AgentCategoriesScreen | pkg-ai/ai/agent / pkg-ai/ai/agent-detail | 🔲 |
| 6 | `agent-review-detail/AgentReviewDetailScreen` | AgentDetailScreen / AgentReviewListScreen | pkg-ai/ai/agent-detail / pkg-ai/ai/agent | 🔲 |
| 7 | `agent-review-list/AgentReviewListScreen` | ★AgentReviewListScreen / AgentCategoriesScreen | pkg-ai/ai/agent / pkg-ai/ai/agent-detail | 🔲 |
| 8 | `agent-screen/AgentScreen` | ★AgentCategoriesScreen / ★AgentChatScreen | pkg-ai/ai/agent / pkg-ai/ai/agent-detail | 🔲 |
| 9 | `agent-setting/AgentSettingScreen` | ★AgentSettingScreen / AgentCategoriesScreen | pkg-ai/ai/agent / pkg-ai/ai/agent-detail | 🔲 |
| 10 | `agent-stat/AgentStatScreen` | ★AgentStatScreen / AgentCategoriesScreen | pkg-ai/ai/agent / pkg-ai/ai/agent-detail | 🔲 |
| 11 | `agreement/AgreementScreen` | ★AgreementScreen | — | 🔲 |
| 12 | `aigc-cover/AigcCoverScreen` | ★AigcCoverScreen / AigcListScreen | pkg-ai/aigc/list / pkg-ai/aigc/publish | 🔲 |
| 13 | `ai-multimodal/AIMultimodalScreen` | ★AIMultimodalScreen | — | 🔲 |
| 14 | `ai-world/AiWorldScreen` | ★AiWorldCreateScreen / ★AiWorldScreen | pkg-ai/ai/chat / pkg-ai/ai/history | 🔲 |
| 15 | `api-settings/ApiSettingsScreen` | ★ApiSettingsScreen / ApiKeysScreen | pkg-about/about/api-settings/index / pkg-user/user/settings | 🔲 |
| 16 | `app-permission/AppPermissionScreen` | ★AppPermissionScreen | pkg-about/about/app-permission/index | 🔲 |
| 17 | `app-topup/AppTopupScreen` | ★AppTopupScreen / ★TopupFailScreen | — | 🔲 |
| 18 | `assistant/AssistantScreen` | ★AiAssistantN8nScreen / ★AiAssistantScreen | pkg-ai/ai-assistant/index / pkg-ai/ai-assistant-n8n/index | 🔲 |
| 19 | `automations/AutomationsScreen` | ★AutomationsScreen | — | 🔲 |
| 20 | `bank-card/BankCardScreen` | ★BankCardScreen / BusinessCardEditScreen | pkg-ai/business-card/index | 🔲 |
| 21 | `bookmark/BookmarkScreen` | ★BookmarkScreen | — | 🔲 |
| 22 | `cert-apply/CertApplyScreen` | ★CertApplyScreen / CertDetailScreen | — | 🔲 |
| 23 | `cert-detail/CertDetailScreen` | ★CertDetailScreen / AgentDetailScreen | pkg-ai/ai/agent-detail / pkg-ai/ai-skill/detail/index | 🔲 |
| 24 | `certificate/CertificateScreen` | ★CertificateScreen | — | 🔲 |
| 25 | `cert-list/CertListScreen` | ★CertListScreen / AgentReviewListScreen | pkg-ai/aigc/list / pkg-shop/order/list | 🔲 |
| 26 | `cert-verify/CertVerifyScreen` | ★CertVerifyScreen / CertApplyScreen | — | 🔲 |
| 27 | `change-phone/ChangePhoneScreen` | ★ChangePhoneScreen / ChangePwdScreen | pkg-user/user/phone | 🔲 |
| 28 | `change-pwd/ChangePwdScreen` | ★ChangePwdScreen / ChangePhoneScreen | — | 🔲 |
| 29 | `chat-room/ChatRoomScreen` | AgentChatScreen / ChatScreen | pkg-ai/ai/chat / pkg-ai/ai-chat-detail/index | 🔲 |
| 30 | `chat/ChatScreen` | ★AgentChatScreen / ★ChatScreen | pkg-ai/ai/chat / pkg-ai/ai-chat-detail/index | 🔲 |
| 31 | `circle-chat/CircleChatScreen` | ★CircleChatScreen / AgentChatScreen | pkg-ai/ai/chat / pkg-ai/ai-circle/index | 🔲 |
| 32 | `circle-member/CircleMemberScreen` | ★CircleMemberScreen / CircleChatScreen | pkg-ai/ai-circle/index / pages/distribution/member-detail/index | 🔲 |
| 33 | `connected-accounts/ConnectedAccountsScreen` | ★ConnectedAccountsScreen / PublishAccountsScreen | — | 🔲 |
| 34 | `connectors/ConnectorsScreen` | ★ConnectorsScreen | — | 🔲 |
| 35 | `console-table/ConsoleTableScreen` | — | — | 🔲 |
| 36 | `context/ContextScreen` | ★ContextScreen | — | 🔲 |
| 37 | `conversation-import/ConversationImportScreen` | ★ConversationImportScreen | pkg-ai/ai/conversation-import | 🔲 |
| 38 | `coupon/CouponScreen` | ★CouponScreen | pages/member/coupon / pages/member/coupon-list | 🔲 |
| 39 | `course-annex/CourseAnnexScreen` | ★CourseAnnexScreen / CourseCatalogScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 40 | `course-catalog/CourseCatalogScreen` | ★CourseCatalogScreen / CourseAnnexScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 41 | `course-chapter/CourseChapterScreen` | ★CourseChapterScreen / CourseAnnexScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 42 | `course-comment/CourseCommentScreen` | ★CourseCommentScreen / CourseAnnexScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 43 | `course-enroll/CourseEnrollScreen` | ★CourseEnrollScreen / CourseAnnexScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 44 | `course-filter/CourseFilterScreen` | ★CourseFilterScreen / CourseAnnexScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 45 | `course-qa-ask/CourseQAAskScreen` | ★CourseQAAskScreen / CourseAnnexScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 46 | `course-qa-list/CourseQAListScreen` | ★CourseQAListScreen / CourseAnnexScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 47 | `course-resource/CourseResourceScreen` | ★CourseResourceScreen / CourseAnnexScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 48 | `course-screen/CourseScreen` | ★CourseAnnexScreen / ★CourseCatalogScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 49 | `course-tab/CourseTabScreen` | CourseAnnexScreen / CourseCatalogScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 50 | `customer-service/CustomerServiceScreen` | ★CustomerServiceScreen | — | 🔲 |
| 51 | `dashboard/DashboardScreen` | ★DashboardScreen | — | 🔲 |
| 52 | `domain-hub/DomainHubScreen` | ★DomainHubScreen | — | 🔲 |
| 53 | `earn-commission/EarnCommissionScreen` | ★EarnCommissionScreen | pkg-shop/wallet/commission/index / pages/distribution/commission | 🔲 |
| 54 | `exam-history/ExamHistoryScreen` | ★ExamHistoryScreen / ExamQuestionScreen | pkg-ai/ai/history / pkg-learn/live/history | 🔲 |
| 55 | `exam-question/ExamQuestionScreen` | ★ExamQuestionScreen / ExamHistoryScreen | pages/exam/list / pages/exam/detail | 🔲 |
| 56 | `exam/ExamScreen` | ★ExamHistoryScreen / ★ExamQuestionScreen | pages/exam/list / pages/exam/detail | 🔲 |
| 57 | `favorites/FavoritesScreen` | ★FavoritesScreen | pkg-user/favorites/index | 🔲 |
| 58 | `feedback-detail/FeedbackDetailScreen` | ★FeedbackDetailScreen / AgentDetailScreen | pkg-ai/ai/agent-detail / pkg-ai/ai-skill/detail/index | 🔲 |
| 59 | `feedback/FeedbackHistoryScreen` | ★FeedbackHistoryScreen / ExamHistoryScreen | pkg-ai/ai/history / pkg-learn/live/history | 🔲 |
| 60 | `feedback/FeedbackScreen` | ★FeedbackDetailScreen / ★FeedbackHistoryScreen | pkg-user/user/feedback | 🔲 |
| 61 | `finance/FinanceScreen` | ★EduFinanceScreen | pkg-user/edu-mgmt-finance/index | 🔲 |
| 62 | `following/FollowingScreen` | — | pkg-user/following/index | 🔲 |
| 63 | `help-detail/HelpDetailScreen` | AgentDetailScreen / AiSkillDetailScreen | pkg-ai/ai/agent-detail / pkg-ai/ai-skill/detail/index | 🔲 |
| 64 | `help/HelpScreen` | ★HelpScreen | pkg-about/about/help | 🔲 |
| 65 | `history/HistoryScreen` | ★ExamHistoryScreen / ★FeedbackHistoryScreen | pkg-ai/ai/history / pkg-learn/live/history | 🔲 |
| 66 | `home/HomeScreen` | ★HomeScreen | — | 🔲 |
| 67 | `identity-verify/IdentityVerifyScreen` | ★IdentityVerifyScreen / CertVerifyScreen | — | 🔲 |
| 68 | `image-gen-gallery/ImageGenGalleryScreen` | ★ImageGenGalleryScreen / ImageGenCreateScreen | pkg-ai/ai/image | 🔲 |
| 69 | `image-gen-history/ImageGenHistoryScreen` | ★ImageGenHistoryScreen / ImageGenCreateScreen | pkg-ai/ai/history / pkg-ai/ai/image | 🔲 |
| 70 | `image-gen-templates/ImageGenTemplatesScreen` | ★ImageGenTemplatesScreen / ImageGenCreateScreen | pkg-ai/ai/image | 🔲 |
| 71 | `income/IncomeScreen` | ★IncomeScreen / ★ModelIncomeScreen | pkg-ai/developer/income | 🔲 |
| 72 | `invite/InviteScreen` | ★InviteScreen | — | 🔲 |
| 73 | `knowledge-base/KnowledgeBaseScreen` | ★KnowledgeBaseEditScreen / ★KnowledgeBaseScreen | — | 🔲 |
| 74 | `knowledge-base/KnowledgeCreateScreen` | ★KnowledgeCreateScreen / AgentCreateScreen | pkg-content/community/create/index / pages/circle/create | 🔲 |
| 75 | `knowledge-base/KnowledgeDocScreen` | ★KnowledgeDocScreen / KnowledgeBaseEditScreen | — | 🔲 |
| 76 | `knowledge-planet/KnowledgePlanetScreen` | ★KnowledgePlanetScreen / CoursePlanetScreen | pkg-learn/course-planet/index | 🔲 |
| 77 | `learn/LearnScreen` | ★LearnDevelopScreen / ★LearnMapScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 78 | `legal-doc/LegalDocScreen` | KnowledgeDocScreen | — | 🔲 |
| 79 | `live-chat/LiveChatScreen` | ★LiveChatScreen / AgentChatScreen | pkg-ai/ai/chat / pkg-ai/ai-chat-detail/index | 🔲 |
| 80 | `live-playback/LivePlaybackListScreen` | ★LivePlaybackListScreen / LiveListScreen | pkg-learn/live/list / pkg-ai/aigc/list | 🔲 |
| 81 | `live-playback-screen/LivePlaybackScreen` | ★LivePlaybackListScreen / ★LivePlaybackScreen | pkg-learn/live/list / pkg-learn/live/detail | 🔲 |
| 82 | `live-preview/LivePreviewScreen` | ★LivePreviewScreen / LiveChatScreen | pkg-learn/live/list / pkg-learn/live/detail | 🔲 |
| 83 | `live/LiveScreen` | ★LiveChatScreen / ★LiveDetailScreen | pkg-learn/live/list / pkg-learn/live/detail | 🔲 |
| 84 | `login/LoginScreen` | ★LoginScreen | — | 🔲 |
| 85 | `mcp-store/McpStoreScreen` | ★McpStoreScreen | — | 🔲 |
| 86 | `memory/MemoryScreen` | ★MemoryNewScreen / ★MemoryScreen | — | 🔲 |
| 87 | `message-center/MessageCenterScreen` | ★MessageCenterScreen / MessageChatScreen | pkg-user/message/index / pkg-user/task-center/index | 🔲 |
| 88 | `message-chat/MessageChatScreen` | ★MessageChatScreen / AgentChatScreen | pkg-ai/ai/chat / pkg-ai/ai-chat-detail/index | 🔲 |
| 89 | `message-detail/MessageDetailScreen` | ★MessageDetailScreen / AgentDetailScreen | pkg-ai/ai/agent-detail / pkg-ai/ai-skill/detail/index | 🔲 |
| 90 | `message-direct/MessageDirectScreen` | ★MessageDirectScreen / MessageCenterScreen | pkg-user/message/index | 🔲 |
| 91 | `message-group/MessageGroupScreen` | ★MessageGroupScreen / AiGroupScreen | pkg-ai/ai-group/index / pkg-user/message/index | 🔲 |
| 92 | `message-system/MessageSystemScreen` | ★MessageSystemScreen / MessageCenterScreen | pkg-user/message/index | 🔲 |
| 93 | `model-income/ModelIncomeScreen` | ★ModelIncomeScreen / IncomeScreen | pkg-ai/model-plaza/index / pkg-ai/developer/income | 🔲 |
| 94 | `more-course/MoreCourseScreen` | ★MoreCourseScreen / CourseAnnexScreen | pkg-learn/course/list / pkg-learn/course/detail | 🔲 |
| 95 | `note-create/NoteCreateScreen` | ★NoteCreateScreen / AgentCreateScreen | pkg-content/community/create/index / pages/circle/create | 🔲 |
| 96 | `note-detail/NoteDetailScreen` | ★NoteDetailScreen / AgentDetailScreen | pkg-ai/ai/agent-detail / pkg-ai/ai-skill/detail/index | 🔲 |
| 97 | `note-list/NoteListScreen` | ★NoteListScreen / AgentReviewListScreen | pkg-ai/aigc/list / pkg-shop/order/list | 🔲 |
| 98 | `note/NoteScreen` | ★NoteCreateScreen / ★NoteDetailScreen | — | 🔲 |
| 99 | `notification/NotificationListScreen` | ★NotificationListScreen / AgentReviewListScreen | pkg-ai/aigc/list / pkg-shop/order/list | 🔲 |
| 100 | `order-log/OrderLogScreen` | ★OrderLogScreen / DistributionOrderListScreen | pkg-shop/order/list / pkg-shop/order/detail | 🔲 |
| 101 | `order/OrderScreen` | ★DistributionOrderListScreen / ★OrderDetailScreen | pkg-shop/order/list / pkg-shop/order/detail | 🔲 |
| 102 | `order-track/OrderTrackScreen` | ★OrderTrackScreen / DistributionOrderListScreen | pkg-shop/order/list / pkg-shop/order/detail | 🔲 |
| 103 | `payment/PaymentScreen` | ★PaymentScreen | — | 🔲 |
| 104 | `point-history/PointHistoryScreen` | ★PointHistoryScreen / ExamHistoryScreen | pkg-ai/ai/history / pkg-learn/live/history | 🔲 |
| 105 | `point-rule/PointRuleScreen` | ★PointRuleScreen / PointHistoryScreen | — | 🔲 |
| 106 | `points-mall/PointsMallScreen` | ★PointsMallScreen / PointsRecordScreen | — | 🔲 |
| 107 | `points-record/PointsRecordScreen` | ★PointsRecordScreen / IcpRecordScreen | pkg-about/about/icp-record/index / pkg-about/about/model-record/index | 🔲 |
| 108 | `points/PointsScreen` | ★PointsMallScreen / ★PointsRecordScreen | — | 🔲 |
| 109 | `privacy/PrivacyScreen` | ★PrivacyScreen | pkg-about/about/privacy / pages/setting/privacy | 🔲 |
| 110 | `profile-edit/ProfileEditScreen` | ★ProfileEditScreen / ArticleEditScreen | pkg-ai/dev-enter/model-edit/index / pkg-user/user/profile | 🔲 |
| 111 | `profile/ProfileScreen` | ★ProfileEditScreen / ★ProfileScreen | pkg-user/user/profile | 🔲 |
| 112 | `promote/PromoteScreen` | ★PromoteScreen | — | 🔲 |
| 113 | `promotion/PromotionScreen` | ★PromotionScreen | — | 🔲 |
| 114 | `publish/PublishScreen` | ★AigcPublishScreen / ★PublishAccountsScreen | pkg-ai/aigc/publish / pages/study/publish/index | 🔲 |
| 115 | `qr-code/QrCodeScreen` | ★QrCodeScreen | — | 🔲 |
| 116 | `real-name-auth/RealNameAuthScreen` | ★RealNameAuthScreen | — | 🔲 |
| 117 | `referrer/ReferrerScreen` | ★ReferrerScreen | — | 🔲 |
| 118 | `refund-detail/RefundDetailScreen` | ★RefundDetailScreen / AgentDetailScreen | pkg-ai/ai/agent-detail / pkg-ai/ai-skill/detail/index | 🔲 |
| 119 | `refund-history/RefundHistoryScreen` | ★RefundHistoryScreen / ExamHistoryScreen | pkg-ai/ai/history / pkg-shop/order/refund | 🔲 |
| 120 | `security-settings/SecuritySettingsScreen` | ★SecuritySettingsScreen / ApiSettingsScreen | pkg-user/user/settings / pkg-user/llm-settings/index | 🔲 |
| 121 | `self-media/SelfMediaScreen` | ★SelfMediaScreen / SelfHealingScreen | — | 🔲 |
| 122 | `settings-account/SettingsAccountScreen` | ★SettingsAccountScreen / AccountCancelScreen | pkg-user/user/settings / pkg-user/llm-settings/index | 🔲 |
| 123 | `spec/SpecScreen` | ★SpecScreen | — | 🔲 |
| 124 | `square/SquareScreen` | — | — | 🔲 |
| 125 | `study-index/StudyIndexScreen` | ★EduChildStudyPlansScreen / ★StudyIndexScreen | pkg-user/edu-child/study-plans/index / pages/study/index | 🔲 |
| 126 | `study-progress/StudyProgressScreen` | ★StudyProgressScreen / EduChildStudyPlansScreen | pkg-user/edu-child/study-plans/index / pages/study/index | 🔲 |
| 127 | `sub-package-index/SubPackageIndexScreen` | ★SubPackageIndexScreen | — | 🔲 |
| 128 | `switch-prefs/SwitchPrefsScreen` | — | — | 🔲 |
| 129 | `team-detail/TeamDetailScreen` | ★TeamDetailScreen / AgentDetailScreen | pkg-ai/ai/agent-detail / pkg-ai/ai-skill/detail/index | 🔲 |
| 130 | `topup-fail/TopupFailScreen` | ★TopupFailScreen / AppTopupScreen | — | 🔲 |
| 131 | `topup-success/TopupSuccessScreen` | ★TopupSuccessScreen / AppTopupScreen | pkg-shop/vip/success | 🔲 |
| 132 | `usage/UsageScreen` | ★UsageRulesScreen / ★UsageScreen | pkg-about/about/usage-rules/index | 🔲 |
| 133 | `video-player/VideoPlayerScreen` | ★VideoPlayerScreen | pkg-ai/ai/video / pages/study/video-detail/index | 🔲 |
| 134 | `vip-compare/VipCompareScreen` | ★VipCompareScreen / VipBenefitScreen | pkg-shop/vip/index / pkg-shop/vip/privilege | 🔲 |
| 135 | `vip-level/VipLevelScreen` | ★VipLevelScreen / VipBenefitScreen | pkg-shop/vip/index / pkg-shop/vip/privilege | 🔲 |
| 136 | `wallet/WalletScreen` | ★WalletScreen | pkg-shop/wallet/recharge/index / pkg-shop/wallet/top-up/index | 🔲 |
| 137 | `withdraw/WithdrawScreen` | ★WithdrawScreen | pages/distribution/withdraw | 🔲 |
| 138 | `workflows/WorkflowsScreen` | ★WorkflowsScreen | — | 🔲 |
| 139 | `wrong-questions/WrongQuestionsScreen` | ★WrongQuestionsScreen | pages/exam/wrong-list/index | 🔲 |

> 合计 139 条;标 ★ 的是名字完全匹配(仍需核实功能对应)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
